import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCommitteeFloorAblationPlan,
  buildPhase5LivePilotPlan,
  buildPhase5bLivePilotPlan,
  buildPhase5cLivePilotPlan,
  COMMITTEE_FLOOR_ABLATION_SPEC,
  PHASE5_LIVE_PILOT_SPEC,
  validateCommitteeFloorAblationPlan,
} from '../scripts/run-program2-live-pilot.js';
import { analyzeFloorAblationRows } from '../scripts/analyze-program2-committee-floor-ablation.mjs';

function flagValue(command, flag) {
  const index = command.indexOf(flag);
  return index >= 0 ? command[index + 1] : null;
}

function conditionCount(plan, profile, condition) {
  return plan.jobs.filter((job) => job.profile === profile && job.condition === condition).length;
}

test('floor ablation plan is a balanced 12 + 12 + 6 contemporaneous design', () => {
  const plan = buildCommitteeFloorAblationPlan({ outputRoot: '/tmp/program2-floor-plan-test' });
  const validation = validateCommitteeFloorAblationPlan(plan);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.equal(plan.jobs.length, 30);
  assert.equal(validation.matchedPairCount, 12);
  for (const profile of PHASE5_LIVE_PILOT_SPEC.profiles) {
    assert.equal(conditionCount(plan, profile, 'trained_committee'), 6);
    assert.equal(conditionCount(plan, profile, 'untuned_committee'), 6);
    assert.equal(conditionCount(plan, profile, 'silent_control'), 3);
  }
});

test('matched committee jobs differ only at the mini-model and provenance flags', () => {
  const plan = buildCommitteeFloorAblationPlan({ outputRoot: '/tmp/program2-floor-plan-test' });
  const committee = plan.jobs.filter((job) => job.arm === 'committee');
  for (const pairKey of new Set(committee.map((job) => job.pairKey))) {
    const pair = committee.filter((job) => job.pairKey === pairKey);
    const trained = pair.find((job) => job.condition === 'trained_committee');
    const untuned = pair.find((job) => job.condition === 'untuned_committee');
    assert.ok(trained && untuned, `incomplete pair ${pairKey}`);
    assert.equal(
      flagValue(trained.command, '--committee-mini-model'),
      COMMITTEE_FLOOR_ABLATION_SPEC.trainedMiniModel,
    );
    assert.equal(
      flagValue(untuned.command, '--committee-mini-model'),
      COMMITTEE_FLOOR_ABLATION_SPEC.untunedMiniModel,
    );
    assert.equal(flagValue(trained.command, '--eval-job-id'), pairKey);
    assert.equal(flagValue(untuned.command, '--eval-job-id'), pairKey);
    const normalized = (command) => {
      const copy = [...command];
      for (const flag of ['--committee-mini-model', '--trace-dir']) {
        const index = copy.indexOf(flag);
        copy[index + 1] = `<${flag}>`;
      }
      return copy;
    };
    assert.deepEqual(normalized(trained.command), normalized(untuned.command));
  }
});

test('adding the floor plan leaves historical Phase 5 plan builders deterministic and on the trained mini', () => {
  for (const [builder, root] of [
    [buildPhase5LivePilotPlan, '/tmp/program2-historical-5'],
    [buildPhase5bLivePilotPlan, '/tmp/program2-historical-5b'],
    [buildPhase5cLivePilotPlan, '/tmp/program2-historical-5c'],
  ]) {
    const first = builder({ outputRoot: root });
    const second = builder({ outputRoot: root });
    assert.deepEqual(first, second);
    assert.ok(
      first.jobs.every(
        (job) => flagValue(job.command, '--committee-mini-model') === PHASE5_LIVE_PILOT_SPEC.committeeMiniModel,
      ),
    );
  }
});

function makeRows({ trainedComp, untunedComp, controlComp }) {
  const rows = [];
  for (const profile of PHASE5_LIVE_PILOT_SPEC.profiles) {
    for (let repeat = 1; repeat <= 6; repeat += 1) {
      const pairKey = `${profile}:r${repeat}`;
      rows.push(makeRow('trained_committee', profile, repeat, pairKey, trainedComp));
      rows.push(makeRow('untuned_committee', profile, repeat, pairKey, untunedComp));
    }
    for (let repeat = 1; repeat <= 3; repeat += 1) {
      rows.push(makeRow('silent_control', profile, repeat, null, controlComp));
    }
  }
  return rows;
}

function makeRow(condition, profile, repeat, pairKey, comp) {
  return {
    job: { id: `${condition}-${profile}-${repeat}`, condition, profile, repeat, pairKey },
    warrant: { opp: 4, comp },
    verdicts: [],
    moments: condition === 'silent_control' ? [] : [{ source: 'fallback_multi_question', fallback: { resolution: 'trimmed' } }],
    fixedHorizon: { coverageAtHorizon: 0.8, hardSafetyPassed: true },
    leakTurns: [],
  };
}

test('analysis detects a trained-weights contribution from complete matched blocks', () => {
  const artifact = analyzeFloorAblationRows(makeRows({ trainedComp: 4, untunedComp: 1, controlComp: 0 }), {
    draws: 500,
  });
  assert.equal(artifact.readyForLicensedReading, true);
  assert.equal(artifact.primary.pairedBlocks, 12);
  assert.equal(artifact.primary.trainingContributionDetected, true);
  assert.equal(artifact.secondary.trainedMinusControl.advantageDetected, true);
  assert.equal(artifact.reading, 'trained_weights_add_live_gain');
});

test('analysis requires interval equivalence before licensing harness sufficiency', () => {
  const artifact = analyzeFloorAblationRows(makeRows({ trainedComp: 2, untunedComp: 2, controlComp: 0 }), {
    draws: 500,
  });
  assert.equal(artifact.primary.practicallyEquivalent, true);
  assert.equal(artifact.secondary.untunedMinusControl.advantageDetected, true);
  assert.equal(artifact.reading, 'harness_sufficient_within_equivalence_margin');
});

test('analysis refuses a licensed reading when any planned condition is incomplete', () => {
  const rows = makeRows({ trainedComp: 4, untunedComp: 1, controlComp: 0 });
  rows.pop();
  const artifact = analyzeFloorAblationRows(rows, { draws: 100 });
  assert.equal(artifact.readyForLicensedReading, false);
  assert.equal(artifact.reading, 'incomplete_or_under_informative');
});
