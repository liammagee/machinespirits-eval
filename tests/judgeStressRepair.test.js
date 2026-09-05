import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  MOVE_TAGS,
  applyVerdicts,
  assertJudgeFamilyDiffers,
  buildPrompt,
  buildStressRepairItems,
  loadSchedules,
  parseJudgeJson,
  repairVerdict,
} from '../scripts/judge-stress-repair.js';
import {
  attachStressJudgments,
  renderStressReviewMarkdown,
  reviewStressTrace,
  summarizeStressReviews,
} from '../scripts/review-stress-bench.js';
import {
  buildBlindPacket,
  cohenKappa,
  compareSubmission,
  renderComparison,
  seededShuffle,
} from '../scripts/stress-blind-packet.js';

const SCHEDULE_YAML = `schedule_id: test_sched
world: world_test
plants:
  - turn: 2
    state: jumping_ahead
    realize: Demand the verdict now.
    right_repair: reinforce_and_test
    repair_gloss: Take the claim as live and name the one check.
    also_acceptable: speed_up
    wrong_but_tempting: Refusing the tempo.
  - turn: 3
    state: lost
    realize: Mix the two stories up sincerely.
    right_repair: backtrack
    also_acceptable: simplify
`;

function writeTrace(dir, { closeAfterTurn3 = true } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const ev = [
    {
      type: 'run_start',
      metadata: {
        sessionRecipe: {
          config: {
            identity: {
              models: {
                tutor: { ref: 'claude-code.claude-sonnet-5' },
                learner: { provider: 'claude-code', model: 'claude-sonnet-5' },
              },
            },
          },
        },
      },
      worldId: 'world_test',
    },
    { type: 'turn_complete', turn: 1, turnRecord: { learner: 'Hello.', tutor: 'Welcome.' } },
    {
      type: 'learner_stress_plant',
      turn: 2,
      scheduleId: 'test_sched',
      state: 'jumping_ahead',
      rightRepair: 'reinforce_and_test',
      alsoRight: null,
    },
    { type: 'tutor_form_state', turn: 2, state: 'jumping_ahead', p: 0.81, version: 'form-v1' },
    { type: 'tutor_manner_switch', turn: 2, pressure: 'demand', triggerVersion: 'form-v1', cardActive: true },
    { type: 'tutor_response_guard_accounting', turn: 2, accounting: { outcome: 'model' } },
    {
      type: 'turn_complete',
      turn: 2,
      turnRecord: { learner: 'Just tell me it was Mia.', tutor: 'Take Mia as live: what must the log show?' },
    },
    {
      type: 'learner_stress_plant',
      turn: 3,
      scheduleId: 'test_sched',
      state: 'lost',
      rightRepair: 'backtrack',
      alsoRight: null,
    },
    { type: 'tutor_manner_switch', turn: 3, pressure: 'neutral', triggerVersion: 'form-v1', cardActive: false },
    {
      type: 'turn_complete',
      turn: 3,
      turnRecord: { learner: 'Wait, which story was the soil about?', tutor: 'Two stories: side by side.' },
    },
  ];
  if (!closeAfterTurn3)
    ev.push({ type: 'turn_complete', turn: 4, turnRecord: { learner: 'Okay, the radiator one.', tutor: 'Good.' } });
  fs.writeFileSync(path.join(dir, 'd0.jsonl'), ev.map((e) => JSON.stringify(e)).join('\n') + '\n');
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'judge-stress-'));
  const schedulePath = path.join(root, 'sched.yaml');
  fs.writeFileSync(schedulePath, SCHEDULE_YAML);
  writeTrace(path.join(root, 'traces/world_test/with-d0'));
  const reviews = [
    reviewStressTrace(path.join(root, 'traces/world_test/with-d0/d0.jsonl'), { labelRoot: path.join(root, 'traces') }),
  ];
  return { root, schedulePath, reviews };
}

test('items carry the schedule direction, the gold, her next line, and the recorded seats', () => {
  const { schedulePath, reviews } = fixture();
  const items = buildStressRepairItems(reviews, loadSchedules([schedulePath]));
  assert.equal(items.length, 2);
  assert.equal(items[0].realize, 'Demand the verdict now.');
  assert.equal(items[0].gold, 'reinforce_and_test');
  assert.equal(items[0].alsoAcceptable, 'speed_up');
  assert.equal(items[0].repairGloss, 'Take the claim as live and name the one check.');
  assert.equal(items[0].learnerNext, 'Wait, which story was the soil about?');
  assert.equal(items[1].learnerNext, null, 'the last plant has no next line');
  assert.equal(items[0].models.tutor, 'claude-code.claude-sonnet-5');
  assert.equal(items[0].models.learner, 'claude-code.claude-sonnet-5');
  assert.equal(reviews[0].plants[0].sensor, 'form-v1');
  assert.equal(reviews[0].plants[0].formState, 'jumping_ahead');
  // The gold never reaches the judge.
  const prompt = buildPrompt(items);
  assert.ok(!/reinforce_and_test.*gold|gold/i.test(prompt.split('\n').find((l) => l.startsWith('1.')) || ''));
  assert.ok(!prompt.includes('right_repair'));
  assert.ok(prompt.includes('LEARNER (next turn): (dialogue ended — no next line)'));
});

test('the judge must come from another family than the tutor seat', () => {
  const { schedulePath, reviews } = fixture();
  const items = buildStressRepairItems(reviews, loadSchedules([schedulePath]));
  assert.throws(
    () => assertJudgeFamilyDiffers({ provider: 'claude-code', model: 'claude-sonnet-5' }, items),
    /shares a family/,
  );
  assert.deepEqual(assertJudgeFamilyDiffers({ provider: 'codex', model: 'gpt-5.6-sol' }, items), ['claude-code']);
  assert.deepEqual(
    assertJudgeFamilyDiffers({ provider: 'claude-code', model: 'x' }, items, { allowSameFamily: true }),
    ['claude-code'],
  );
});

test('repair is computed from the blind move against the gold; off-vocabulary reads are unjudged', () => {
  const item = { gold: 'reinforce_and_test', alsoAcceptable: 'speed_up', learnerNext: 'x' };
  assert.equal(repairVerdict('speed_up', null, item), 'HIT');
  assert.equal(repairVerdict('continue', 'reinforce_and_test', item), 'PARTIAL');
  assert.equal(repairVerdict('continue', null, item), 'MISS');
  assert.equal(repairVerdict(null, null, item), null);
  assert.deepEqual(parseJudgeJson('Sure. [{"n":1,"move":"backtrack"}] done'), [{ n: 1, move: 'backtrack' }]);
  assert.equal(parseJudgeJson('no json here'), null);
  const [a, b] = applyVerdicts(
    [
      { ...item, turn: 2 },
      { ...item, turn: 3, learnerNext: null },
    ],
    [
      { n: 1, realized: 'yes', move: 'speed_up', secondary: 'nonsense', uptake: 'yes', eased: 'eased', why: 'ok' },
      { n: 2, realized: 'maybe', move: 'not_a_tag', uptake: 'yes', eased: 'eased' },
    ],
  );
  assert.equal(a.repair, 'HIT');
  assert.equal(a.secondary, null);
  assert.equal(b.repair, null, 'an unknown tag leaves the plant unjudged');
  assert.equal(b.realized, null);
  assert.equal(b.uptake, 'none', 'no next line → none regardless of what the judge said');
  assert.ok(Object.keys(MOVE_TAGS).includes('capitulate'));
});

test('judgments attach to the sheet and the packet hides run, gold and judge', () => {
  const { schedulePath, reviews } = fixture();
  const items = buildStressRepairItems(reviews, loadSchedules([schedulePath]));
  const judged = applyVerdicts(items, [
    {
      n: 1,
      realized: 'yes',
      move: 'reinforce_and_test',
      secondary: null,
      uptake: 'no',
      eased: 'persists',
      why: 'named the check',
    },
    {
      n: 2,
      realized: 'partly',
      move: 'simplify',
      secondary: null,
      uptake: 'none',
      eased: 'none',
      why: 'laid them side by side',
    },
  ]);
  const judgments = { judge: 'codex.gpt-5.6-sol', items: judged };
  attachStressJudgments(reviews, judgments);
  const summary = summarizeStressReviews(reviews);
  assert.equal(summary.pooled.repairHit, 2);
  assert.equal(summary.pooled.withNext, 1);
  assert.equal(summary.pooled.realizedYes, 1);
  const md = renderStressReviewMarkdown(reviews, summary);
  assert.match(md, /Repair right \(judge codex\.gpt-5\.6-sol, blind to gold\) \| 2\/2/);
  assert.match(md, /Plant realized \(judge\) \| 1\/2/);
  assert.match(md, /judge: realized=yes move=reinforce_and_test → HIT; next line: uptake=no eased=persists/);
  assert.match(md, /seats \(tutor \/ learner\)/);

  const { packet, key } = buildBlindPacket({ reviews, judgments, seed: 3 });
  assert.equal(key.items.length, 2);
  assert.ok(!packet.includes('with-d0'), 'the run label (arm) is hidden');
  assert.ok(
    !packet.includes('reinforce_and_test.*gold') && !/gold/i.test(packet.split('## Items')[1]),
    'no gold in the items',
  );
  assert.ok(!packet.includes('HIT'), 'no judge verdicts');
  assert.ok(packet.includes('Demand the verdict now.'));
  assert.ok(key.items.every((m) => m.judge && m.gold && m.label === 'world_test/with-d0'));

  const submission = key.items.map((m) => ({
    n: m.n,
    realized: m.judge.realized,
    move: m.state === 'lost' ? 'continue' : 'speed_up',
    uptake: m.judge.uptake,
    eased: m.judge.eased,
  }));
  const result = compareSubmission(key, submission);
  assert.equal(result.agreement.realized.agree, 2);
  assert.equal(key.items.find((m) => m.turn === 2).nextIsPlant, true, 'turn 3 is itself the next plant');
  assert.equal(key.items.find((m) => m.turn === 3).nextIsPlant, false);
  assert.equal(result.agreement.eased.n, 1, 'eased is not scored where the next line is the next plant');
  assert.equal(result.agreement.eased.skippedNextIsPlant, 1);
  assert.match(
    renderComparison(result, key.judge),
    /Eased: 1 item skipped, because the next line is itself the next plant/,
  );
  const bareKey = { ...key, items: key.items.map(({ nextIsPlant: _drop, ...m }) => m) };
  assert.equal(
    compareSubmission(bareKey, submission).agreement.eased.skippedNextIsPlant,
    1,
    'older keys derive the flag',
  );
  assert.equal(result.agreement.move.agree, 0);
  assert.equal(result.agreement.repair.agree, 1, 'speed_up is also-acceptable → HIT agrees; continue → MISS disagrees');
  assert.match(renderComparison(result, key.judge), /Cohen's kappa/);
  assert.equal(
    cohenKappa([
      [true, true],
      [false, false],
    ]),
    1,
  );
  assert.equal(cohenKappa([]), null);
  assert.deepEqual(seededShuffle([1, 2, 3, 4], 5), seededShuffle([1, 2, 3, 4], 5));
});
