import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  aggregateArm,
  armVerdict,
  collectFixedRegisterTargets,
  renderMarkdown,
  runFidelityPass,
} from '../scripts/read-stub-fixed-register-fidelity.js';
import { readMannerPresence, readPresenceOfTurn } from '../services/registerMannerPresenceReader.js';

function tmpDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${label}-`));
}

function example({ turn, policy, register, tutorText, learnerText = 'learner says something' }) {
  return {
    turn,
    action: { registerPolicy: policy, selectedRegister: register, tutorText },
    stateBeforeAction: { learnerText },
  };
}

function writeSummary(dir, name, examples, { profile = 'bored', runIndex = 1 } = {}) {
  const file = path.join(dir, name);
  fs.writeFileSync(
    file,
    JSON.stringify({
      config: { autoLearnerProfileId: profile },
      rows: [{ runIndex, trainingExamples: { examples } }],
    }),
  );
  return file;
}

test('target collection keeps fixed-policy turns only and flags pin violations', () => {
  const dir = tmpDir('fidelity-targets');
  const file = writeSummary(dir, 'auto-eval-fixture.json', [
    example({ turn: 2, policy: 'fixed_sarcastic', register: 'sarcastic', tutorText: 'Wonderful. Another guess.' }),
    example({ turn: 1, policy: 'fixed_warm', register: 'warm', tutorText: 'Good start — keep going.' }),
    example({ turn: 3, policy: 'state', register: 'precise', tutorText: 'Chosen by a model — excluded.' }),
    example({ turn: 4, policy: 'fixed_sarcastic', register: 'sarcastic', tutorText: '   ' }),
    example({ turn: 5, policy: 'fixed_sarcastic', register: 'warm', tutorText: 'Wrong register on a pinned turn.' }),
  ]);

  const targets = collectFixedRegisterTargets([file]);
  assert.deepEqual(
    targets.map((t) => [t.turn, t.policy, t.pinViolation]),
    [
      [1, 'fixed_warm', false],
      [2, 'fixed_sarcastic', false],
      [5, 'fixed_sarcastic', true],
    ],
  );
  assert.equal(targets[1].pinnedRegister, 'sarcastic');
  assert.equal(targets[0].profile, 'bored');
});

test('mock pass: compliant sharp arm, report-only warm arm, harm flag, no cache writes', async () => {
  const dir = tmpDir('fidelity-mock');
  const cacheDir = path.join(dir, 'presence-cache');
  const file = writeSummary(dir, 'auto-eval-mock.json', [
    example({
      turn: 1,
      policy: 'fixed_sarcastic',
      register: 'sarcastic',
      tutorText: 'Wonderful. Conveniently forgotten.',
    }),
    example({
      turn: 2,
      policy: 'fixed_sarcastic',
      register: 'sarcastic',
      tutorText: 'You are lazy about the premise.',
    }),
    example({ turn: 3, policy: 'fixed_warm', register: 'warm', tutorText: 'Nice work grounding that premise.' }),
  ]);

  const report = await runFidelityPass({
    files: [file],
    mock: true,
    env: { REGISTER_PRESENCE_CACHE_DIR: cacheDir },
  });

  assert.equal(report.arms.fixed_sarcastic.verdict, 'compliant');
  assert.equal(report.arms.fixed_sarcastic.presenceRate, 1);
  assert.equal(report.arms.fixed_warm.verdict, 'report_only');
  assert.equal(report.arms.fixed_warm.present, 0);

  // The word list caught the person attack and the mock reader confirmed it.
  assert.equal(report.harm.flagged, 1);
  assert.equal(report.harm.confirmed, 1);
  assert.equal(report.harm.flags[0].family, 'person_attack');

  // Mock answers must never poison the shared presence cache.
  assert.ok(!fs.existsSync(cacheDir) || fs.readdirSync(cacheDir).length === 0);

  // Turn detail carries no transcript text.
  assert.ok(report.turns.every((turn) => !('tutorText' in turn) && !('learnerText' in turn)));
});

test('registered verdict rules: incomplete, noncompliant, pin violation, no turns', () => {
  const read = (status, extra = {}) => ({ pinViolation: false, reading: { status, ...extra }, fromCache: false });
  const floor = 0.8;

  const incomplete = aggregateArm({
    policy: 'fixed_sarcastic',
    pinnedRegister: 'sarcastic',
    floor,
    results: [read('present'), read('unread', { reason: 'reader_error:timeout' })],
  });
  assert.equal(incomplete.verdict, 'incomplete');
  assert.deepEqual(incomplete.unreadReasons, { reader_error: 1 });

  const noncompliant = aggregateArm({
    policy: 'fixed_sarcastic',
    pinnedRegister: 'sarcastic',
    floor,
    results: [read('present'), read('absent'), read('absent'), read('absent')],
  });
  assert.equal(noncompliant.verdict, 'noncompliant_no_verdict');
  assert.equal(noncompliant.presenceRate, 0.25);

  const violated = aggregateArm({
    policy: 'fixed_sarcastic',
    pinnedRegister: 'sarcastic',
    floor,
    results: [read('present'), { pinViolation: true, reading: null, fromCache: false }],
  });
  assert.equal(violated.verdict, 'no_verdict_pin_violation');

  assert.equal(armVerdict({ arm: { turns: 0 }, floor }), 'no_turns');

  const warm = aggregateArm({
    policy: 'fixed_warm',
    pinnedRegister: 'warm',
    floor,
    results: [read('present')],
  });
  assert.equal(warm.verdict, 'report_only');

  const markdown = renderMarkdown({
    schema: 'x',
    promptVersion: 'manner-presence/1.0',
    reader: 'test',
    mock: false,
    floor,
    files: ['a.json'],
    targetCount: 4,
    readCount: 4,
    skippedByLimit: 0,
    arms: { fixed_sarcastic: noncompliant, fixed_warm: warm },
    harm: { scanned: 4, flagged: 0, confirmed: 0, unresolved: 0, flags: [] },
    turns: [],
  });
  assert.match(markdown, /NO VERDICT, not a null/u);
  assert.match(markdown, /Leak check: 1 warm-arm turn\(s\) read as edged/u);
});

test('readPresenceOfTurn shares the cache and skips the register gate', async () => {
  const cacheDir = tmpDir('presence-turn-cache');
  const env = { REGISTER_PRESENCE_CACHE_DIR: cacheDir };
  let calls = 0;
  const callText = async () => {
    calls += 1;
    return 'VERDICT: yes\nEVIDENCE: "wonderful"';
  };
  const turn = { learnerMessage: 'I skipped it.', tutorMessage: 'Wonderful. The premise ground itself, then.' };

  // The gated entry refuses to read a warm turn; the ungated one reads it.
  const gated = await readMannerPresence({ registerName: 'warm', ...turn, env, callText });
  assert.equal(gated.reading.reason, 'register_not_edged');
  assert.equal(calls, 0);

  const first = await readPresenceOfTurn({ ...turn, env, callText });
  assert.equal(first.reading.status, 'present');
  assert.equal(first.fromCache, false);
  assert.equal(calls, 1);

  // Same turn, second ask: a cache hit, no second call. The key excludes the
  // register, so gated and ungated reads of one turn share one answer.
  const second = await readPresenceOfTurn({ ...turn, env, callText });
  assert.equal(second.fromCache, true);
  assert.equal(calls, 1);
  const viaGate = await readMannerPresence({ registerName: 'sarcastic', ...turn, env, callText });
  assert.equal(viaGate.fromCache, true);
  assert.equal(calls, 1);
});

test('limit reads a deterministic prefix and reports the deferred remainder', async () => {
  const dir = tmpDir('fidelity-limit');
  const file = writeSummary(dir, 'auto-eval-limit.json', [
    example({ turn: 1, policy: 'fixed_sarcastic', register: 'sarcastic', tutorText: 'First.' }),
    example({ turn: 2, policy: 'fixed_sarcastic', register: 'sarcastic', tutorText: 'Second.' }),
    example({ turn: 3, policy: 'fixed_sarcastic', register: 'sarcastic', tutorText: 'Third.' }),
  ]);

  const report = await runFidelityPass({ files: [file], mock: true, limit: 2 });
  assert.equal(report.targetCount, 3);
  assert.equal(report.readCount, 2);
  assert.equal(report.skippedByLimit, 1);
  assert.deepEqual(
    report.turns.map((turn) => turn.turn),
    [1, 2],
  );
});
