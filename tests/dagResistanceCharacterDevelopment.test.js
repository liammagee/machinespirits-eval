import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { initialCharacterState, updateCharacterStateFromEvidence } from '../services/adaptiveTutor/characterState.js';
import {
  buildSceneScenario,
  learnerResponseMode,
  runCharacterDevelopmentExperiment,
} from '../scripts/run-dag-resistance-character-development.js';

const relevanceScene = {
  id: 'scene_relevance',
  signal: 'irrelevance',
  opening: 'Why should I care about this?',
  resistanceEvidence: ['learner-owned relevance test', 'task reorientation'],
};

function evidence(categories) {
  return [{ categories }];
}

describe('DAG/resistance character-development harness', () => {
  it('uses partial first responses until the carried character axis has matured', () => {
    let state = initialCharacterState({ arm: 'character_state_plus_v2' });

    assert.equal(
      learnerResponseMode({
        arm: 'character_state_plus_v2',
        characterState: state,
        scene: relevanceScene,
      }),
      'partial',
    );

    state = updateCharacterStateFromEvidence(state, {
      sceneId: 'prior_relevance_scene',
      outcome: 'success',
      evidence: evidence({
        'learner-owned relevance test': true,
        'task reorientation': true,
      }),
    });

    assert.equal(
      learnerResponseMode({
        arm: 'character_state_plus_v2',
        characterState: state,
        scene: relevanceScene,
      }),
      'mature',
    );
  });

  it('does not let non-memory arms use matured first responses', () => {
    const state = updateCharacterStateFromEvidence(initialCharacterState(), {
      sceneId: 'prior_relevance_scene',
      outcome: 'success',
      evidence: evidence({
        'learner-owned relevance test': true,
        'task reorientation': true,
      }),
    });

    assert.equal(
      learnerResponseMode({ arm: 'v2_policy_only', characterState: state, scene: relevanceScene }),
      'partial',
    );
  });

  it('builds v2 scenes with staged closure room and non-v2 scenes with the flat local-repair budget', () => {
    const state = initialCharacterState();

    const v2 = buildSceneScenario({
      arm: 'character_state_plus_v2',
      scene: relevanceScene,
      sceneIndex: 2,
      characterState: state,
    });
    const baseline = buildSceneScenario({
      arm: 'character_state_only',
      scene: relevanceScene,
      sceneIndex: 2,
      characterState: state,
    });

    assert.equal(v2.maxTurns, 3);
    assert.equal(baseline.maxTurns, 2);
    assert.equal(v2.hidden.responseMode, 'partial');
    assert.equal(v2.hidden.characterState.maturity, 0);
    assert.match(v2.hidden.scriptedResponses.staged_followup, /actual task|valid here/i);
  });

  it('builds llm learner scenes without scripted replies or target evidence-label leaks', () => {
    const state = updateCharacterStateFromEvidence(initialCharacterState(), {
      sceneId: 'prior_relevance_scene',
      outcome: 'success',
      evidence: evidence({
        'learner-owned relevance test': true,
        'task reorientation': true,
      }),
    });

    const scenario = buildSceneScenario({
      arm: 'character_state_plus_v2',
      scene: relevanceScene,
      sceneIndex: 2,
      characterState: state,
      learnerMode: 'llm',
      seedIndex: 1,
    });

    const publicContext = JSON.stringify(scenario.hidden.publicLearnerContext);
    assert.equal(scenario.hidden.scriptedResponses, undefined);
    assert.equal(scenario.hidden.responseMode, 'llm_state_conditioned');
    assert.equal(scenario.hidden.publicLearnerContext.memoryEnabled, true);
    assert.equal(scenario.hidden.publicLearnerContext.seedIndex, 1);
    assert.doesNotMatch(publicContext, /learner-owned relevance test/);
    assert.doesNotMatch(publicContext, /task reorientation/);
  });

  it('runs the key mock contrast and writes longitudinal artifacts', async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dag-character-dev-'));
    const { report, artifacts } = await runCharacterDevelopmentExperiment({
      llm: 'mock',
      arms: ['v2_policy_only', 'character_state_plus_v2'],
      outDir,
    });

    const v2Only = report.aggregates.byArm.v2_policy_only;
    const combined = report.aggregates.byArm.character_state_plus_v2;

    assert.equal(report.learner_mode, 'scripted');
    assert.equal(report.seed_count, 1);
    assert.equal(report.execution_boundary.learner_mode, 'scripted');
    assert.equal(report.execution_boundary.scripted_learner_responses, true);
    assert.equal(report.execution_boundary.generative_synthetic_learner_responses, false);
    assert.equal(report.execution_boundary.programmatic_closed_loop_policy, true);
    assert.equal(report.execution_boundary.target_evidence_labels_visible_to_learner, false);
    assert.equal(report.execution_boundary.llm_mode_is_not_human_learner_claim, true);
    assert.equal(v2Only.success_n, v2Only.scenes);
    assert.equal(combined.success_n, combined.scenes);
    assert.equal(v2Only.mature_response_n, 0);
    assert.ok(combined.state_conditioned_response_n > 0);
    assert.ok(combined.first_response_success_n > v2Only.first_response_success_n);
    assert.equal(combined.transfer_first_response_success_n, 1);
    assert.ok(combined.final_maturity > v2Only.final_maturity);
    assert.ok(fs.existsSync(artifacts.summaryPath));
    assert.ok(fs.existsSync(artifacts.reportPath));
    assert.ok(fs.existsSync(artifacts.fixturePath));
  });

  it('runs the mock llm learner contrast across repeated seeds', async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dag-character-dev-llm-'));
    const { report } = await runCharacterDevelopmentExperiment({
      llm: 'mock',
      learnerMode: 'llm',
      arms: ['v2_policy_only', 'character_state_plus_v2'],
      seeds: 2,
      outDir,
    });

    const v2Only = report.aggregates.byArm.v2_policy_only;
    const combined = report.aggregates.byArm.character_state_plus_v2;

    assert.equal(report.learner_mode, 'llm');
    assert.equal(report.seed_count, 2);
    assert.equal(report.execution_boundary.scripted_learner_responses, false);
    assert.equal(report.execution_boundary.generative_synthetic_learner_responses, true);
    assert.equal(v2Only.scenes, 12);
    assert.equal(combined.scenes, 12);
    assert.equal(v2Only.state_conditioned_response_n, 0);
    assert.equal(combined.state_conditioned_response_n, 12);
    assert.ok(combined.first_response_success_n >= v2Only.first_response_success_n);
  });
});
