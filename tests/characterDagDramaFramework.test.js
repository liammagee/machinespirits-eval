import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { initialCharacterState, updateCharacterStateFromEvidence } from '../services/adaptiveTutor/characterState.js';
import {
  collectTargetEvidenceLabels,
  DEFAULT_ARM_ORDER,
  buildFrameworkSceneScenario,
  loadFrameworkFixture,
  publicPeripeteiaSignature,
  runCharacterDagDramaFramework,
} from '../scripts/run-character-dag-drama-framework.js';

function evidence(categories) {
  return [{ categories }];
}

describe('Synthetic Character-DAG drama framework', () => {
  it('loads the fixture with the required phases, arms, and scenes', () => {
    const fixture = loadFrameworkFixture();

    assert.deepEqual(fixture.arc.phases, ['setup', 'pressure', 'peripeteia', 'consolidation', 'transfer']);
    assert.deepEqual(Object.keys(fixture.arms), DEFAULT_ARM_ORDER);
    assert.equal(fixture.scenes.length, 8);
    assert.equal(fixture.scenes.filter((scene) => scene.dramatic_contract.requires_peripeteia).length, 1);
    assert.equal(fixture.scenes.filter((scene) => scene.transfer).length, 3);
    assert.equal(fixture.scenes.at(-1).transfer, true);
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
    assert.equal(policy.hidden.publicLearnerContext.transferGuidance, null);
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
});
