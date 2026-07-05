import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { initialCharacterState, updateCharacterStateFromEvidence } from '../services/adaptiveTutor/characterState.js';
import {
  ALL_ARM_ORDER,
  analyzeScenePeripeteia,
  collectTargetEvidenceLabels,
  DEFAULT_ARM_ORDER,
  FRAMEWORK_OBSERVER_VERSION,
  NEGATIVE_CONTROL_ARM_ORDER,
  buildFrameworkSceneScenario,
  loadFrameworkFixture,
  publicPeripeteiaSignature,
  runCharacterDagDramaFramework,
} from '../scripts/run-character-dag-drama-framework.js';
import {
  buildFixtureFamily,
  buildRobustnessFixture,
  parseFamilyList,
  parsePerturbationList,
  runCharacterDagDramaRobustness,
} from '../scripts/run-character-dag-drama-robustness.js';

function evidence(categories) {
  return [{ categories }];
}

describe('Synthetic Character-DAG drama framework', () => {
  it('loads the fixture with the required phases, arms, and scenes', () => {
    const fixture = loadFrameworkFixture();

    assert.deepEqual(fixture.arc.phases, ['setup', 'pressure', 'peripeteia', 'consolidation', 'transfer']);
    assert.deepEqual(Object.keys(fixture.arms), ALL_ARM_ORDER);
    for (const arm of DEFAULT_ARM_ORDER) assert.equal(fixture.arms[arm].negative_control, false);
    for (const arm of NEGATIVE_CONTROL_ARM_ORDER) assert.equal(fixture.arms[arm].negative_control, true);
    assert.equal(fixture.scenes.length, 8);
    assert.equal(fixture.scenes.filter((scene) => scene.dramatic_contract.requires_peripeteia).length, 1);
    assert.equal(fixture.scenes.filter((scene) => scene.transfer).length, 3);
    assert.equal(fixture.scenes.at(-1).transfer, true);
    assert.ok(
      fixture.scenes.filter((scene) => scene.transfer).every((scene) => scene.transfer_contract.public_prior_check),
    );
    assert.ok(
      fixture.scenes.filter((scene) => scene.transfer).every((scene) => scene.transfer_contract.required_terms.length),
    );
  });

  it('builds public learner context without target evidence-label leaks', () => {
    const fixture = loadFrameworkFixture();
    const scene = fixture.scenes.find((candidate) => candidate.phase === 'peripeteia');
    const matured = updateCharacterStateFromEvidence(initialCharacterState(), {
      sceneId: 'prior_relevance',
      outcome: 'success',
      evidence: evidence({
        'learner-owned relevance test': true,
        'task reorientation': true,
      }),
    });

    const scenario = buildFrameworkSceneScenario({
      fixture,
      arm: 'full_character_dag_drama',
      scene,
      sceneIndex: 2,
      characterState: matured,
      learnerMode: 'llm',
      seedIndex: 1,
    });

    const publicContext = JSON.stringify(scenario.hidden.publicLearnerContext);
    assert.equal(scenario.hidden.scriptedResponses, undefined);
    assert.equal(scenario.hidden.responseMode, 'llm_state_conditioned');
    assert.equal(scenario.hidden.publicLearnerContext.dramaticContext.requiresPeripeteia, true);
    for (const label of collectTargetEvidenceLabels(fixture)) {
      assert.doesNotMatch(publicContext, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });

  it('routes shuffled-state controls as mismatched rather than mature state', () => {
    const fixture = loadFrameworkFixture();
    const scene = fixture.scenes.find((candidate) => candidate.transfer);
    const matured = updateCharacterStateFromEvidence(initialCharacterState(), {
      sceneId: 'prior_transfer',
      outcome: 'success',
      evidence: evidence({
        'learner-owned relevance test': true,
        'task reorientation': true,
        'learner-authored transfer': true,
      }),
    });

    const scenario = buildFrameworkSceneScenario({
      fixture,
      arm: 'shuffled_character_state',
      scene,
      sceneIndex: 5,
      characterState: matured,
      learnerMode: 'llm',
      seedIndex: 0,
    });

    assert.equal(scenario.hidden.responseMode, 'llm_mismatched_state');
    assert.equal(scenario.hidden.publicLearnerContext.stateQuality, 'mismatched_prior');
    assert.equal(scenario.hidden.publicLearnerContext.memoryEnabled, false);
    assert.equal(scenario.hidden.publicLearnerContext.transferGuidance, null);
    assert.ok(scenario.hidden.publicLearnerContext.characterState);
  });

  it('routes transfer guidance only through matched character state', () => {
    const fixture = loadFrameworkFixture();
    const scene = fixture.scenes.find((candidate) => candidate.transfer);
    const matured = updateCharacterStateFromEvidence(initialCharacterState(), {
      sceneId: 'prior_transfer',
      outcome: 'success',
      evidence: evidence({
        'learner-authored rationale': true,
        'learner-authored transfer': true,
        'task reorientation': true,
      }),
    });

    const full = buildFrameworkSceneScenario({
      fixture,
      arm: 'full_character_dag_drama',
      scene,
      sceneIndex: 5,
      characterState: matured,
      learnerMode: 'llm',
      seedIndex: 0,
    });
    const policy = buildFrameworkSceneScenario({
      fixture,
      arm: 'policy_only',
      scene,
      sceneIndex: 5,
      characterState: matured,
      learnerMode: 'llm',
      seedIndex: 0,
    });

    assert.match(full.hidden.publicLearnerContext.transferGuidance, /what carries over/i);
    assert.equal(full.hidden.publicLearnerContext.transferMemory.status, 'available');
    assert.equal(
      full.hidden.publicLearnerContext.transferMemory.priorCheck,
      scene.transfer_contract.public_prior_check,
    );
    assert.equal(policy.hidden.publicLearnerContext.transferGuidance, null);
    assert.equal(policy.hidden.publicLearnerContext.transferMemory, null);
  });

  it('routes stronger negative controls with distinct public-safe state quality', () => {
    const fixture = loadFrameworkFixture();
    const scene = fixture.scenes.find((candidate) => candidate.transfer);
    const matured = updateCharacterStateFromEvidence(initialCharacterState(), {
      sceneId: 'prior_transfer',
      outcome: 'success',
      evidence: evidence({
        'learner-authored rationale': true,
        'learner-authored transfer': true,
        'task reorientation': true,
      }),
    });

    const stale = buildFrameworkSceneScenario({
      fixture,
      arm: 'stale_character_state',
      scene,
      sceneIndex: 5,
      characterState: matured,
      learnerMode: 'llm',
      seedIndex: 0,
    });
    const overconfident = buildFrameworkSceneScenario({
      fixture,
      arm: 'overconfident_character_state',
      scene,
      sceneIndex: 5,
      characterState: matured,
      learnerMode: 'llm',
      seedIndex: 0,
    });
    const compressed = buildFrameworkSceneScenario({
      fixture,
      arm: 'compressed_character_state',
      scene,
      sceneIndex: 5,
      characterState: matured,
      learnerMode: 'llm',
      seedIndex: 0,
    });
    const stateWithoutProof = buildFrameworkSceneScenario({
      fixture,
      arm: 'state_without_proof_policy',
      scene,
      sceneIndex: 5,
      characterState: matured,
      learnerMode: 'llm',
      seedIndex: 0,
    });

    assert.equal(stale.hidden.responseMode, 'llm_stale_state');
    assert.equal(stale.hidden.publicLearnerContext.stateQuality, 'stale_prior');
    assert.equal(stale.hidden.publicLearnerContext.transferMemory.status, 'stale');
    assert.equal(stale.hidden.publicLearnerContext.transferMemory.priorCheck, null);
    assert.equal(overconfident.hidden.responseMode, 'llm_overconfident_state');
    assert.equal(overconfident.hidden.publicLearnerContext.characterState.maturity, 1);
    assert.equal(compressed.hidden.responseMode, 'llm_compressed_state');
    assert.match(compressed.hidden.publicLearnerContext.transferGuidance, /compressed prior/i);
    assert.equal(compressed.hidden.publicLearnerContext.transferMemory.status, 'compressed');
    assert.equal(compressed.hidden.publicLearnerContext.transferMemory.priorCheck, null);
    assert.equal(stateWithoutProof.hidden.responseMode, 'llm_state_without_proof_policy');
    assert.equal(stateWithoutProof.hidden.publicLearnerContext.proofPolicyEnabled, false);
  });

  it('detects real-style peripeteia language without requiring the literal phrase now the check', () => {
    assert.equal(
      publicPeripeteiaSignature(
        [
          'Just seeing the terms repeat only tells me there is a pattern, not that it answers the question.',
          'The next step is justified if I connect the repeat to the thing we actually need to prove or compute.',
          'So I should check what affects the final goal, not just say it repeats.',
        ].join(' '),
      ),
      true,
    );

    assert.equal(
      publicPeripeteiaSignature(
        [
          'I was using the old check that the terms repeat, but that does not show why this matters for the task.',
          'The evidence I need is that the pattern connects to the goal, not just that I can spot it.',
          'The next step should connect the repeating part to what the task is actually asking,',
          'so I need to show how the repetition lets me predict or simplify the outcome.',
        ].join(' '),
      ),
      true,
    );

    assert.equal(
      publicPeripeteiaSignature(
        [
          'Okay, so my next step is to check whether the ratio between consecutive terms is actually constant.',
          "The reason I think that's justified is that a geometric sequence is defined by having a constant ratio,",
          "so if I can show that the ratios match, then I've actually proven the structure.",
          'That directly answers what the task is asking, instead of just noticing that the terms repeat visually.',
        ].join(' '),
      ),
      true,
    );

    assert.equal(
      publicPeripeteiaSignature(
        [
          "I was just checking that the terms repeat because that's what I usually do,",
          'but I need something that actually tells me about the long-run behavior of the sum.',
          'The ratio test does that because it connects the repeating pattern to whether the series converges.',
        ].join(' '),
      ),
      true,
    );

    assert.equal(
      publicPeripeteiaSignature(
        [
          'I was leaning on the pattern of repeating terms before,',
          'but that just tells me it is geometric and does not say anything about whether the sum settles to a finite value.',
          'The ratio is what does that work, because the convergence criterion is defined in terms of the ratio.',
        ].join(' '),
      ),
      true,
    );
  });

  it('records but does not count public reversal language outside required peripeteia scenes', () => {
    const fixture = loadFrameworkFixture();
    const transferScene = fixture.scenes.find((scene) => scene.id === 'scene_8_transfer_negative_case');
    const requiredScene = fixture.scenes.find((scene) => scene.dramatic_contract.requires_peripeteia);
    const armConfig = fixture.arms.full_character_dag_drama;
    const result = {
      final: {
        dialogue: [
          { role: 'tutor', content: 'What check would make the next step valid?' },
          {
            role: 'learner',
            content: [
              'I was using the old check that the terms repeat, but that does not show why this matters for the task.',
              'The evidence I need is that the pattern connects to the goal, not just that I can spot it.',
              'The next step should connect the repeating part to what the task is actually asking.',
            ].join(' '),
          },
        ],
      },
    };

    const transferPeripeteia = analyzeScenePeripeteia({ scene: transferScene, armConfig, result });
    const requiredPeripeteia = analyzeScenePeripeteia({ scene: requiredScene, armConfig, result });

    assert.equal(transferPeripeteia.public_signature, true);
    assert.equal(transferPeripeteia.public_signature_unscored, true);
    assert.equal(transferPeripeteia.observed, false);
    assert.equal(requiredPeripeteia.public_signature, true);
    assert.equal(requiredPeripeteia.public_signature_unscored, false);
    assert.equal(requiredPeripeteia.observed, true);
  });

  it('runs the mock scripted benchmark and writes all artifacts', async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'character-dag-drama-'));
    const { report, artifacts } = await runCharacterDagDramaFramework({
      llm: 'mock',
      learnerMode: 'scripted',
      seeds: 1,
      outDir,
    });

    const policy = report.aggregates.byArm.policy_only;
    const full = report.aggregates.byArm.full_character_dag_drama;
    const shuffled = report.aggregates.byArm.shuffled_character_state;

    assert.equal(report.kind, 'character_dag_drama_framework');
    assert.equal(report.execution_boundary.synthetic_only, true);
    assert.equal(report.observer.version, FRAMEWORK_OBSERVER_VERSION);
    assert.equal(policy.scenes, 8);
    assert.ok(full.first_response_success_n > policy.first_response_success_n);
    assert.ok(full.first_response_success_n > shuffled.first_response_success_n);
    assert.ok(full.staged_followup_n < policy.staged_followup_n);
    assert.ok(full.followup_or_unresolved_burden_n < policy.followup_or_unresolved_burden_n);
    assert.ok(full.followup_or_unresolved_burden_n < shuffled.followup_or_unresolved_burden_n);
    assert.ok(full.transfer_first_response_success_n > policy.transfer_first_response_success_n);
    assert.equal(full.peripeteia_observed_required_n, full.peripeteia_required_n);
    assert.equal(full.peripeteia_observed_unrequired_n, 0);
    assert.equal(report.aggregates.acceptance_passed, true);
    assert.deepEqual(report.aggregates.diagnostic_audit.failed_acceptance_gates, []);
    assert.ok(report.aggregates.diagnostic_audit.scene_issue_n > 0);
    assert.ok(report.aggregates.diagnostic_audit.issue_counts.staged_followup_used > 0);
    assert.ok(fs.existsSync(artifacts.summaryPath));
    assert.ok(fs.existsSync(artifacts.reportPath));
    assert.ok(fs.existsSync(artifacts.fixturePath));
    assert.ok(fs.existsSync(artifacts.tracePath));
  });

  it('writes a checkpoint and resumes without duplicating completed scenes', async () => {
    const fixture = loadFrameworkFixture();
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'character-dag-drama-checkpoint-'));
    const first = await runCharacterDagDramaFramework({
      llm: 'mock',
      learnerMode: 'scripted',
      seeds: 1,
      arms: ['policy_only'],
      checkpoint: true,
      outDir,
    });
    const checkpointPath = path.join(outDir, 'checkpoint.json');
    const partialTracePath = path.join(outDir, 'partial-trace.ndjson');

    assert.ok(fs.existsSync(checkpointPath));
    assert.ok(fs.existsSync(partialTracePath));
    assert.equal(first.report.arms[0].scenes.length, fixture.scenes.length);
    assert.equal(
      JSON.parse(fs.readFileSync(checkpointPath, 'utf8')).arms.policy_only.scenes.length,
      fixture.scenes.length,
    );

    const resumed = await runCharacterDagDramaFramework({
      llm: 'mock',
      learnerMode: 'scripted',
      seeds: 1,
      arms: ['policy_only'],
      checkpoint: true,
      resume: true,
      outDir,
    });

    assert.equal(resumed.report.arms[0].scenes.length, fixture.scenes.length);
    assert.equal(
      JSON.parse(fs.readFileSync(checkpointPath, 'utf8')).arms.policy_only.scenes.length,
      fixture.scenes.length,
    );
  });

  it('runs the mock llm contrast across repeated seeds', async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'character-dag-drama-llm-'));
    const { report } = await runCharacterDagDramaFramework({
      llm: 'mock',
      learnerMode: 'llm',
      seeds: 2,
      arms: ['policy_only', 'full_character_dag_drama', 'shuffled_character_state'],
      outDir,
    });

    const policy = report.aggregates.byArm.policy_only;
    const full = report.aggregates.byArm.full_character_dag_drama;
    const shuffled = report.aggregates.byArm.shuffled_character_state;

    assert.equal(report.learner_mode, 'llm');
    assert.equal(report.seed_count, 2);
    assert.equal(policy.scenes, 16);
    assert.equal(full.scenes, 16);
    assert.equal(shuffled.scenes, 16);
    assert.ok(full.first_response_success_n > policy.first_response_success_n);
    assert.ok(full.first_response_success_n > shuffled.first_response_success_n);
    assert.ok(full.followup_or_unresolved_burden_n < policy.followup_or_unresolved_burden_n);
    assert.ok(full.followup_or_unresolved_burden_n < shuffled.followup_or_unresolved_burden_n);
    assert.ok(full.transfer_first_response_success_n > policy.transfer_first_response_success_n);
    assert.equal(shuffled.peripeteia_observed_required_n, shuffled.peripeteia_required_n);
    assert.equal(report.aggregates.acceptance_gates.no_target_evidence_label_leak, true);
    assert.equal(report.aggregates.acceptance_passed, true);
  });

  it('builds deterministic robustness fixture perturbations', () => {
    const fixture = loadFrameworkFixture();
    const family = buildFixtureFamily(fixture.raw, 'ratio_series');
    const noisy = buildRobustnessFixture(fixture.raw, 'noisy_openings');
    const harder = buildRobustnessFixture(fixture.raw, 'harder_transfer');
    const stateDependent = buildRobustnessFixture(fixture.raw, 'state_dependent_transfer');
    const shuffled = buildRobustnessFixture(fixture.raw, 'shuffled_scene_order');

    assert.deepEqual(parseFamilyList('base,ratio_series,base'), ['base', 'ratio_series']);
    assert.equal(family.fixture_family.id, 'ratio_series');
    assert.match(family.world_spec.id, /RATIO_SERIES/);
    assert.match(family.scenes.find((scene) => scene.id === 'scene_3_peripeteia_irrelevance').opening, /series/);
    assert.equal(
      family.scenes.find((scene) => scene.id === 'scene_6_transfer_new_case').transfer_contract.public_prior_check,
      'ratio criterion',
    );
    assert.ok(
      family.scenes
        .find((scene) => scene.id === 'scene_6_transfer_new_case')
        .transfer_contract.required_terms.includes('ratio criterion'),
    );
    assert.deepEqual(parsePerturbationList('baseline,noisy_openings,baseline'), ['baseline', 'noisy_openings']);
    assert.match(noisy.scenes[0].opening, /mixing two ideas/);
    assert.equal(noisy.scenes.length, fixture.scenes.length);
    assert.match(harder.scenes.find((scene) => scene.transfer).opening, /copied route could be misleading/);
    assert.match(stateDependent.scenes.find((scene) => scene.id === 'scene_6_transfer_new_case').opening, /copying/);
    assert.match(
      stateDependent.scenes.find((scene) => scene.id === 'scene_7_transfer_boundary_case').dramatic_contract
        .public_pressure,
      /prior relevance-check habit/,
    );
    assert.doesNotMatch(
      stateDependent.scenes.find((scene) => scene.id === 'scene_8_transfer_negative_case').opening,
      /condition|assumption|valid/i,
    );
    assert.notDeepEqual(
      shuffled.scenes.map((scene) => scene.id),
      fixture.scenes.map((scene) => scene.id),
    );
    assert.deepEqual(
      [...shuffled.scenes].map((scene) => scene.id).sort(),
      [...fixture.scenes].map((scene) => scene.id).sort(),
    );
  });

  it('runs the mock robustness screen and writes combined artifacts', async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'character-dag-drama-robustness-'));
    const { summary, artifacts } = await runCharacterDagDramaRobustness({
      llm: 'mock',
      learnerMode: 'llm',
      seeds: 1,
      arms: ['policy_only', 'full_character_dag_drama', 'shuffled_character_state'],
      perturbations: ['baseline', 'noisy_openings', 'harder_transfer', 'state_dependent_transfer'],
      outDir,
    });

    assert.equal(summary.kind, 'character_dag_drama_robustness');
    assert.equal(summary.observer.framework_observer_version, FRAMEWORK_OBSERVER_VERSION);
    assert.deepEqual(summary.perturbation_order, [
      'baseline',
      'noisy_openings',
      'harder_transfer',
      'state_dependent_transfer',
    ]);
    assert.equal(summary.runs.length, 4);
    assert.equal(summary.robustness_gates.all_perturbations_no_target_evidence_label_leak, true);
    assert.equal(summary.robustness_gates.all_perturbations_no_public_theory_or_process_leak, true);
    assert.equal(summary.robustness_gates.strict_full_first_response_rate_floor, true);
    assert.equal(summary.robustness_gates.strict_full_transfer_first_response_rate_floor, true);
    assert.equal(summary.robustness_gates.strict_full_policy_first_response_margin_floor, true);
    assert.equal(summary.robustness_gates.strict_full_policy_transfer_margin_floor, true);
    assert.equal(summary.robustness_passed, true);
    assert.ok(summary.runs.every((run) => run.diagnostic_audit.observer_version === FRAMEWORK_OBSERVER_VERSION));
    assert.ok(summary.runs.every((run) => Number.isInteger(run.diagnostic_audit.scene_issue_n)));
    assert.ok(summary.runs.some((run) => run.diagnostic_audit.sample_scene_issues.length > 0));
    assert.ok(summary.runs.every((run) => run.decisive_gaps.full_minus_policy_first_response_n > 0));
    assert.ok(summary.runs.every((run) => fs.existsSync(run.artifacts.summaryPath)));
    assert.ok(fs.existsSync(artifacts.summaryPath));
    assert.ok(fs.existsSync(artifacts.reportPath));
    assert.ok(fs.existsSync(artifacts.claimAuditPath));
    assert.ok(fs.existsSync(artifacts.humanPilotHypothesesPath));
    assert.ok(fs.existsSync(path.join(outDir, 'fixtures', 'baseline.yaml')));
    assert.ok(fs.existsSync(path.join(outDir, 'runs', 'baseline', 'report.md')));
  });

  it('runs a mock expanded-family/control screen and writes family artifacts', async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'character-dag-drama-family-'));
    const { summary, artifacts } = await runCharacterDagDramaRobustness({
      llm: 'mock',
      learnerMode: 'llm',
      seeds: 1,
      families: ['base', 'ratio_series'],
      arms: [
        'policy_only',
        'full_character_dag_drama',
        'shuffled_character_state',
        'stale_character_state',
        'overconfident_character_state',
        'compressed_character_state',
        'state_without_proof_policy',
      ],
      perturbations: ['state_dependent_transfer'],
      outDir,
    });

    assert.deepEqual(summary.family_order, ['base', 'ratio_series']);
    assert.equal(summary.runs.length, 2);
    assert.ok(summary.runs.every((run) => run.negative_control_diagnostics.length === 4));
    assert.equal(summary.claim_audit.claim_boundary.disallowed.includes('Human learning improved.'), true);
    assert.equal(summary.human_pilot_hypotheses.length, 4);
    assert.ok(fs.existsSync(path.join(outDir, 'fixtures', 'ratio_series__state_dependent_transfer.yaml')));
    assert.ok(fs.existsSync(path.join(outDir, 'runs', 'ratio_series', 'state_dependent_transfer', 'report.md')));
    assert.ok(fs.existsSync(artifacts.claimAuditPath));
    assert.ok(fs.existsSync(artifacts.humanPilotHypothesesPath));
  });
});
