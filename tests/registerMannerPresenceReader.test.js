import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { MANNER_PRESENCE_PROMPT_VERSION } from '../services/registerMannerPresence.js';
import {
  DEFAULT_PRESENCE_READER,
  lookupMannerPresence,
  presenceCacheDir,
  presenceReaderLabel,
  readMannerPresence,
} from '../services/registerMannerPresenceReader.js';

const TURN =
  'Conveniently, the formula sounds like understanding while doing none of the work. Pick one object that pushes back.';

function tmpCache() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'manner-presence-'));
}

function args(dir, extra = {}) {
  return {
    registerName: 'ironic',
    learnerMessage: 'This still feels like I am parroting the formula.',
    tutorMessage: TURN,
    env: { REGISTER_PRESENCE_CACHE_DIR: dir },
    ...extra,
  };
}

test('the reader is pinned, and to a different family from the writer', () => {
  // `codex.gpt-5.5` writes the tutor turns, so a `present` verdict from a
  // Sonnet-class reader is not a model marking its own work.
  assert.deepEqual({ ...DEFAULT_PRESENCE_READER }, { provider: 'claude-code', model: 'claude-sonnet-5' });
  assert.equal(presenceReaderLabel(), 'claude-code/claude-sonnet-5');
});

/**
 * Nesting the cache under `exports/` means it inherits the relocation the
 * desktop app already applies to that directory, so this adds no new writable
 * store to the runtime host and remains relocatable in isolated tests.
 */
test('the cache lives under the relocatable exports directory', () => {
  assert.equal(presenceCacheDir({ EVAL_EXPORTS_DIR: '/tmp/exp' }), '/tmp/exp/register-manner-presence');
  assert.equal(presenceCacheDir({ REGISTER_PRESENCE_CACHE_DIR: '/tmp/pin', EVAL_EXPORTS_DIR: '/tmp/exp' }), '/tmp/pin');
  assert.match(presenceCacheDir({}), /exports\/register-manner-presence$/);
});

test('nothing is asked for a register with no validated presence question', async () => {
  const dir = tmpCache();
  try {
    let calls = 0;
    const { reading } = await readMannerPresence(
      args(dir, {
        registerName: 'face_threat_challenge',
        callText: async () => {
          calls += 1;
          return 'VERDICT: yes\nEVIDENCE: whatever';
        },
      }),
    );
    assert.equal(calls, 0);
    assert.equal(reading.status, 'unread');
    assert.equal(reading.reason, 'register_not_edged');
    assert.equal(fs.existsSync(dir) ? fs.readdirSync(dir).length : 0, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a second read of the same turn costs nothing', async () => {
  const dir = tmpCache();
  try {
    let calls = 0;
    const callText = async () => {
      calls += 1;
      return 'VERDICT: yes\nEVIDENCE: Conveniently';
    };
    const first = await readMannerPresence(args(dir, { callText }));
    const second = await readMannerPresence(args(dir, { callText }));

    assert.equal(calls, 1);
    assert.equal(first.fromCache, false);
    assert.equal(second.fromCache, true);
    assert.equal(second.reading.status, 'present');
    assert.equal(second.reading.evidence, 'Conveniently');
    assert.equal(second.reading.evidenceFoundInTurn, true);
    assert.equal(second.reading.promptVersion, MANNER_PRESENCE_PROMPT_VERSION);
    assert.equal(fs.readdirSync(dir).length, 1);

    // An edited turn is a different question, so it is asked again rather than
    // answered from the old turn's file.
    await readMannerPresence(args(dir, { callText, tutorMessage: `${TURN} Name it.` }));
    assert.equal(calls, 2);
    assert.equal(fs.readdirSync(dir).length, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a failed call is a gap to retry, not an answer to remember', async () => {
  const dir = tmpCache();
  try {
    let calls = 0;
    const callText = async () => {
      calls += 1;
      if (calls === 1) throw new Error('timeout');
      return 'VERDICT: no\nEVIDENCE: none';
    };
    const failed = await readMannerPresence(args(dir, { callText }));
    assert.equal(failed.reading.status, 'unread');
    assert.equal(failed.reading.reason, 'reader_error:timeout');
    assert.equal(fs.existsSync(dir) ? fs.readdirSync(dir).length : 0, 0);

    const retried = await readMannerPresence(args(dir, { callText }));
    assert.equal(calls, 2);
    assert.equal(retried.reading.status, 'absent');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * The opposite rule, and deliberately so: the same turn asked the same way
 * produced unusable output once and will again. Re-buying it on every pass
 * would hide a reader that cannot answer this question.
 */
test('a reply that cannot be parsed is remembered as unread', async () => {
  const dir = tmpCache();
  try {
    let calls = 0;
    const callText = async () => {
      calls += 1;
      return 'It depends on how you read it, really.';
    };
    await readMannerPresence(args(dir, { callText }));
    const second = await readMannerPresence(args(dir, { callText }));

    assert.equal(calls, 1);
    assert.equal(second.fromCache, true);
    assert.equal(second.reading.status, 'unread');
    assert.match(second.reading.reason, /^parse_failed:/);
    assert.equal(second.reading.reader, 'claude-code/claude-sonnet-5');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * The report calls this and nothing else, so it stays a zero-call step. If it
 * ever asked, running a report would silently spend quota — and would do it on
 * whichever machine happened to run the report.
 */
test('looking a reading up costs nothing and finds what the paid pass wrote', async () => {
  const dir = tmpCache();
  try {
    let calls = 0;
    const callText = async () => {
      calls += 1;
      return 'VERDICT: yes\nEVIDENCE: Conveniently';
    };
    const env = { REGISTER_PRESENCE_CACHE_DIR: dir };
    const lookupArgs = {
      registerName: 'ironic',
      learnerMessage: 'This still feels like I am parroting the formula.',
      tutorMessage: TURN,
      env,
    };

    assert.equal(lookupMannerPresence(lookupArgs), null, 'nothing read yet');
    await readMannerPresence(args(dir, { callText }));
    assert.equal(lookupMannerPresence(lookupArgs)?.status, 'present');
    assert.equal(calls, 1, 'the lookup itself asked nobody');

    // A different turn is a different question, so it misses rather than
    // returning the neighbouring answer.
    assert.equal(lookupMannerPresence({ ...lookupArgs, tutorMessage: `${TURN} Name it.` }), null);
    // And a register with no validated question never has one to find.
    assert.equal(lookupMannerPresence({ ...lookupArgs, registerName: 'face_threat_challenge' }), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an empty tutor turn is not sent to a reader', async () => {
  const dir = tmpCache();
  try {
    let calls = 0;
    const { reading } = await readMannerPresence(
      args(dir, {
        tutorMessage: '   ',
        callText: async () => {
          calls += 1;
          return 'VERDICT: yes\nEVIDENCE: x';
        },
      }),
    );
    assert.equal(calls, 0);
    assert.equal(reading.reason, 'no_tutor_turn');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
