import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  harvestDiscursiveReplayLessons,
  parseArgs,
  renderLessonsTtl,
  renderPolicyBrief,
} from '../scripts/harvest-discursive-replay-lessons.js';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function seedLoop() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'disc-replay-lessons-'));
  const i01Replay = path.join(root, 'i01-replay');
  const i02Replay = path.join(root, 'i02-replay');
  fs.mkdirSync(i01Replay, { recursive: true });
  fs.mkdirSync(i02Replay, { recursive: true });

  writeJson(path.join(i01Replay, 'manifest.json'), {
    records: [
      {
        item: { id: 'item-a' },
        gate: {
          status: 'revise_again',
          warnings: [
            {
              criterion: 'ledger_precision',
              evidence: 'final self-reframe appears copied backward into turn 1',
              recommendation: 'scope each ledger row to that turn',
            },
          ],
          failures: [],
        },
        feedback: { provided: false },
      },
      {
        item: { id: 'item-b' },
        gate: {
          status: 'revise_again',
          warnings: [
            {
              criterion: 'prose_naturalness',
              evidence: 'the reframe reads rehearsed',
              recommendation: 'make the learner speech more ordinary',
            },
          ],
          failures: [],
        },
        feedback: { provided: false },
      },
    ],
  });
  writeJson(path.join(i02Replay, 'manifest.json'), {
    records: [
      { item: { id: 'item-a' }, gate: { status: 'survivor', warnings: [], failures: [] }, feedback: { provided: true } },
      { item: { id: 'item-b' }, gate: { status: 'survivor', warnings: [], failures: [] }, feedback: { provided: true } },
    ],
  });
  writeJson(path.join(root, 'manifest.json'), {
    iterations: [
      {
        iteration: 1,
        replayDir: 'i01-replay',
        localNeedsRevision: ['item-a', 'item-b'],
        panelSummary: [],
      },
      {
        iteration: 2,
        replayDir: 'i02-replay',
        localNeedsRevision: [],
        panelSummary: [
          {
            sourceItemId: 'item-a',
            status: 'panel_pass',
            recognitionVotes: 3,
            totalCritics: 5,
            expectedCritics: 5,
            requiredRecognitionVotes: 3,
            critics: {
              codex: { formClass: 'recognition', recognitionOrigin: 'organic' },
              qwen: { formClass: 'recognition', recognitionOrigin: 'peripeteia_induced' },
              claude: { formClass: 'recognition', recognitionOrigin: 'peripeteia_induced' },
              gemini: { formClass: 'flat', recognitionOrigin: 'none' },
              deepseek: { formClass: 'flat', recognitionOrigin: 'none' },
            },
          },
          {
            sourceItemId: 'item-b',
            status: 'panel_pass',
            recognitionVotes: 4,
            totalCritics: 5,
            expectedCritics: 5,
            requiredRecognitionVotes: 3,
            critics: {
              codex: { formClass: 'recognition', recognitionOrigin: 'organic' },
              qwen: { formClass: 'recognition', recognitionOrigin: 'organic' },
              claude: { formClass: 'recognition', recognitionOrigin: 'peripeteia_induced' },
              gemini: { formClass: 'recognition', recognitionOrigin: 'organic' },
              deepseek: { formClass: 'flat', recognitionOrigin: 'none' },
            },
          },
        ],
      },
    ],
  });
  return root;
}

test('parseArgs accepts loop roots and promotion policy flags', () => {
  const root = seedLoop();
  const args = parseArgs(['--loop-root', root, '--min-support', '2', '--promote']);
  assert.deepEqual(args.loopRoots, [root]);
  assert.equal(args.minSupport, 2);
  assert.equal(args.promote, true);
});

test('harvestDiscursiveReplayLessons emits supported lessons and claim-boundary caution', () => {
  const root = seedLoop();
  const report = harvestDiscursiveReplayLessons({ loopRoots: [root], minSupport: 2, promote: true });
  const byId = Object.fromEntries(report.lessons.map((entry) => [entry.id, entry]));

  assert.equal(byId['feedback-gated-replay-repair'].promotionStatus, 'promoted');
  assert.equal(byId['feedback-gated-replay-repair'].supportCount, 2);
  assert.equal(byId['temporal-ledger-scope'].promotionStatus, 'candidate');
  assert.equal(byId['natural-self-reframe-prose'].promotionStatus, 'candidate');
  assert.equal(byId['recognition-majority-is-not-origin-attribution'].promotionStatus, 'promoted');
  assert.equal(byId['recognition-majority-is-not-origin-attribution'].supportCount, 2);

  const ttl = renderLessonsTtl(report);
  assert.match(ttl, /ms:learned_feedback_gated_replay_repair/);
  assert.match(ttl, /ms:PromotedLearnedPolicy/);
  assert.match(ttl, /ms:OriginAttributionRisk/);

  const brief = renderPolicyBrief(report);
  assert.match(brief, /Feed local-gate failures/);
  assert.match(brief, /recognition majority/i);
});
