import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let tmpDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'greenroom-store-test-'));
  process.env.GREENROOM_DIR = tmpDir;
});

after(() => {
  delete process.env.GREENROOM_DIR;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// Import after GREENROOM_DIR is controllable (module reads env at call time).
const store = await import('../services/greenroom/store.js');

test('createProfile lays down template, v0 snapshot, and ledger', () => {
  const profile = store.createProfile({ id: 'marrick-a', actorModel: 'claude-code.claude-sonnet-5' });
  assert.equal(profile.memoryVersion, 0);
  for (const section of store.MEMORY_SECTIONS) {
    assert.match(profile.memoryText, new RegExp(`## ${section}`));
  }
  assert.ok(fs.existsSync(path.join(profile.dir, 'versions', 'v000.md')));
  const ledger = store.readLedger('marrick-a');
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].type, 'create');
  assert.equal(ledger[0].after_hash, profile.memoryHash);
});

test('createProfile rejects bad ids and duplicates', () => {
  assert.throws(() => store.createProfile({ id: 'Bad Id!', actorModel: 'x.y' }), /slug/);
  assert.throws(() => store.createProfile({ id: 'marrick-a', actorModel: 'x.y' }), /already exists/);
});

test('applyMemoryPatch add bumps version, snapshots, and ledgers hashes', () => {
  const before_ = store.loadProfile('marrick-a');
  const result = store.applyMemoryPatch(
    'marrick-a',
    {
      section: 'Recurring patterns',
      op: 'add',
      text: 'Do not stack a second question before the learner answers the first.',
    },
    { source: { session_file: 'test' } },
  );
  assert.equal(result.version, 1);
  const after_ = store.loadProfile('marrick-a');
  assert.match(after_.memoryText, /Do not stack a second question/);
  assert.notEqual(after_.memoryHash, before_.memoryHash);
  const ledger = store.readLedger('marrick-a');
  const last = ledger[ledger.length - 1];
  assert.equal(last.type, 'patch:add');
  assert.equal(last.before_hash, before_.memoryHash);
  assert.equal(last.after_hash, after_.memoryHash);
  assert.ok(fs.existsSync(path.join(after_.dir, 'versions', 'v001.md')));
});

test('edit and remove ops target entries by match', () => {
  store.applyMemoryPatch('marrick-a', {
    section: 'Technique',
    op: 'add',
    text: 'Release the final word to the learner.',
  });
  store.applyMemoryPatch('marrick-a', {
    section: 'Technique',
    op: 'edit',
    match: 'final word',
    text: 'Release the terminal recognition to the learner; close on their syllable.',
  });
  let profile = store.loadProfile('marrick-a');
  assert.match(profile.memoryText, /terminal recognition/);
  assert.doesNotMatch(profile.memoryText, /Release the final word/);
  store.applyMemoryPatch('marrick-a', { section: 'Technique', op: 'remove', match: 'terminal recognition' });
  profile = store.loadProfile('marrick-a');
  assert.doesNotMatch(profile.memoryText, /terminal recognition/);
  assert.throws(
    () => store.applyMemoryPatch('marrick-a', { section: 'Technique', op: 'remove', match: 'nonexistent' }),
    /no entry matching/,
  );
});

test('patch rejects unknown sections', () => {
  assert.throws(
    () => store.applyMemoryPatch('marrick-a', { section: 'Vibes', op: 'add', text: 'x' }),
    /section must be one of/,
  );
});

test('budget overflow throws E_BUDGET and leaves the book unchanged', () => {
  const before_ = store.loadProfile('marrick-a');
  const huge = 'x'.repeat((store.MEMORY_TOKEN_BUDGET + 100) * 4);
  let code = null;
  try {
    store.applyMemoryPatch('marrick-a', { section: 'Scenario cues', op: 'add', text: huge });
  } catch (error) {
    code = error.code;
  }
  assert.equal(code, 'E_BUDGET');
  const after_ = store.loadProfile('marrick-a');
  assert.equal(after_.memoryHash, before_.memoryHash);
  assert.equal(after_.memoryVersion, before_.memoryVersion);
});

test('frozen profile refuses durable writes until unfrozen', () => {
  store.freezeProfile('marrick-a');
  let code = null;
  try {
    store.applyMemoryPatch('marrick-a', { section: 'Technique', op: 'add', text: 'nope' });
  } catch (error) {
    code = error.code;
  }
  assert.equal(code, 'E_FROZEN');
  store.unfreezeProfile('marrick-a');
  const result = store.applyMemoryPatch('marrick-a', { section: 'Technique', op: 'add', text: 'after unfreeze' });
  assert.ok(result.version > 0);
});

test('replaceMemory (distillation) is budget-enforced and ledgered', () => {
  const distilled = `# Prompt Book — marrick-a\n\n${store.MEMORY_SECTIONS.map((s) => `## ${s}\n`).join('\n')}\n- kept entry`;
  const result = store.replaceMemory('marrick-a', distilled, { type: 'distill' });
  const ledger = store.readLedger('marrick-a');
  assert.equal(ledger[ledger.length - 1].type, 'distill');
  assert.equal(result.tokens, store.estimateTokens(distilled));
  assert.throws(() => store.replaceMemory('marrick-a', 'y'.repeat(store.MEMORY_TOKEN_BUDGET * 5)), /budget/);
});

test('forkProfile checkpoints at a version with parent provenance', () => {
  const src = store.loadProfile('marrick-a');
  const fork = store.forkProfile('marrick-a', src.memoryVersion, 'marrick-a-ckpt');
  assert.equal(fork.memoryVersion, 0);
  assert.equal(fork.memoryText, src.memoryText);
  assert.deepEqual(fork.meta.parent, { id: 'marrick-a', version: src.memoryVersion });
  const ledger = store.readLedger('marrick-a-ckpt');
  assert.equal(ledger[0].type, 'fork');
  // Fork at an EARLIER version reproduces that snapshot, not the current book.
  const v0 = store.loadMemoryVersion('marrick-a', 0);
  const early = store.forkProfile('marrick-a', 0, 'marrick-a-v0');
  assert.equal(early.memoryText, v0.text);
});

test('recordSession lands the artifact and a note ledger event', () => {
  const file = store.recordSession('marrick-a', { exchanges: [], structured: { notes: [] } }, { source: { t: 'x' } });
  assert.ok(fs.existsSync(file));
  const ledger = store.readLedger('marrick-a');
  assert.equal(ledger[ledger.length - 1].type, 'note');
  assert.equal(ledger[ledger.length - 1].session_file, path.basename(file));
});

test('listProfiles sees all created profiles', () => {
  const ids = store.listProfiles();
  assert.ok(ids.includes('marrick-a'));
  assert.ok(ids.includes('marrick-a-ckpt'));
  assert.ok(ids.includes('marrick-a-v0'));
});
