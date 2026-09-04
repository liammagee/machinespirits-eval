import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { checkReply, formatReason, lastTurn } from '../scripts/plain-speech-stop-hook.js';

const ROOT = path.join(import.meta.dirname, '..');
const HOOK = path.join(ROOT, 'scripts', 'plain-speech-stop-hook.js');

// Names built at run time so that this test file itself never puts them into
// the repo for the git-grep lookup to find.
const MADE_UP_LABEL = ['arch', 'ivory'].join('') + ' gap';
const MADE_UP_COMPOUND = ['flim', 'flammery'].join('-');

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-speech-hook-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function writeTranscript(directory, promptText, replyTexts) {
  const rows = [
    { type: 'user', message: { role: 'user', content: promptText } },
    ...replyTexts.map((text) => ({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text }] },
    })),
  ];
  const file = path.join(directory, 'session.jsonl');
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return file;
}

function runHook(input) {
  return spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    cwd: ROOT,
    env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT },
  });
}

const rules = (findings) => findings.map((f) => f.rule);

test('flags the recorded tells and the motto shape', () => {
  const reply = [
    'Neither claim is load-bearing. The scripts may suffer bit-rot.',
    'The loss is provenance, not knowledge. The character pilot is the one to buy.',
  ].join('\n\n');
  const findings = checkReply(reply, { promptText: 'how important are they?', cwd: ROOT });
  const got = rules(findings);
  assert.ok(got.includes('tell'), `expected a tell, got ${JSON.stringify(findings)}`);
  assert.ok(got.includes('epigram'), 'expected the motto shape to be flagged');
  const quotes = findings.map((f) => f.quote);
  assert.ok(quotes.some((q) => q === 'load-bearing'));
  assert.ok(quotes.some((q) => q === 'bit-rot'));
  assert.ok(quotes.some((q) => q === 'buy'));
  assert.ok(quotes.some((q) => q.startsWith('The loss is provenance')));
});

test('flags a label and a compound found nowhere in the repo', () => {
  const reply = `Fix the ${MADE_UP_LABEL} first. The run needs ${MADE_UP_COMPOUND} to pass.`;
  const findings = checkReply(reply, { promptText: 'what next?', cwd: ROOT });
  assert.ok(rules(findings).includes('coined-label'), JSON.stringify(findings));
  assert.ok(rules(findings).includes('coined-compound'), JSON.stringify(findings));
});

test('does not flag a label the user used, or a compound inside code', () => {
  const reply = `You asked about the ${MADE_UP_LABEL}. Run \`${MADE_UP_COMPOUND}\` to see it.`;
  const findings = checkReply(reply, { promptText: `what is the ${MADE_UP_LABEL}?`, cwd: ROOT });
  assert.deepEqual(findings, []);
});

test('flags dashes, arrows, long sentences, double brackets and headers', () => {
  const long = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ') + '.';
  const reply = [
    '## A header',
    'One thing — another thing. Then A -> B.',
    'This claim (first aside) has two asides (second aside) in it.',
    long,
  ].join('\n');
  const got = rules(checkReply(reply, { promptText: 'why?', cwd: ROOT }));
  for (const rule of ['header', 'dash', 'parentheticals', 'long-sentence']) {
    assert.ok(got.includes(rule), `missing ${rule} in ${got}`);
  }
});

test('flags a long reply to a short question, and latinate words', () => {
  const reply = Array.from({ length: 120 }, () => 'The run finished and the row landed.').join(' ');
  const findings = checkReply(`${reply} We will subsequently verify it.`, {
    promptText: 'did it finish?',
    cwd: ROOT,
  });
  const got = rules(findings);
  assert.ok(got.includes('length'), got);
  assert.ok(got.includes('latinate'), got);
});

test('a plain reply passes', () => {
  const reply = [
    'Both runs finished. The first wrote 18 rows, the second 17.',
    'The scorer read every row. No row is missing a score.',
    'Next step: run the archive command, then commit in the archive repo.',
  ].join('\n');
  assert.deepEqual(checkReply(reply, { promptText: 'did both runs finish?', cwd: ROOT }), []);
});

test('reads the last turn from a transcript, skipping tool results', (t) => {
  const directory = temporaryDirectory(t);
  const file = path.join(directory, 'session.jsonl');
  const rows = [
    { type: 'user', message: { role: 'user', content: 'old question' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'old answer' }] } },
    { type: 'user', message: { role: 'user', content: 'new question' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'first part' }] } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Bash', input: {} }] } },
    { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'ignored' }] } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'second part' }] } },
  ];
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const turn = lastTurn(file);
  assert.equal(turn.promptText, 'new question');
  assert.equal(turn.replyText, 'first part\n\nsecond part');
});

test('hook mode blocks once, then lets the rewrite through', (t) => {
  const directory = temporaryDirectory(t);
  const transcript = writeTranscript(directory, 'how important?', ['The loss is provenance, not knowledge.']);
  const first = runHook({ transcript_path: transcript, stop_hook_active: false, cwd: ROOT });
  assert.equal(first.status, 0, first.stderr);
  const out = JSON.parse(first.stdout);
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /epigram/);
  const second = runHook({ transcript_path: transcript, stop_hook_active: true, cwd: ROOT });
  assert.equal(second.status, 0);
  assert.equal(second.stdout, '');
});

test('hook mode stays silent on a clean reply, a missing transcript, and bad input', (t) => {
  const directory = temporaryDirectory(t);
  const clean = writeTranscript(directory, 'did it finish?', ['Yes. Both runs wrote 18 rows.']);
  assert.equal(runHook({ transcript_path: clean, stop_hook_active: false, cwd: ROOT }).stdout, '');
  const missing = runHook({ transcript_path: path.join(directory, 'nope.jsonl'), cwd: ROOT });
  assert.equal(missing.status, 0);
  assert.equal(missing.stdout, '');
  const garbage = spawnSync(process.execPath, [HOOK], { input: '{not json', encoding: 'utf8', cwd: ROOT });
  assert.equal(garbage.status, 0);
  assert.equal(garbage.stdout, '');
});

test('the reason text numbers every finding and names the rule file', () => {
  const reason = formatReason([{ rule: 'tell', quote: 'load-bearing', fix: 'say what depends on it' }]);
  assert.match(reason, /^Plain-speech check failed .*\(1 item\)/);
  assert.match(reason, /1\. \[tell\] "load-bearing" - say what depends on it/);
  assert.match(reason, /\.claude\/style-rule\.md/);
});
