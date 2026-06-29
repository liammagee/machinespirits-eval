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

  it('runs the key mock contrast and writes longitudinal artifacts', async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dag-character-dev-'));
    const { report, artifacts } = await runCharacterDevelopmentExperiment({
      llm: 'mock',
      arms: ['v2_policy_only', 'character_state_plus_v2'],
      outDir,
    });

    const v2Only = report.aggregates.byArm.v2_policy_only;
    const combined = report.aggregates.byArm.character_state_plus_v2;

    assert.equal(v2Only.success_n, v2Only.scenes);
    assert.equal(combined.success_n, combined.scenes);
    assert.equal(v2Only.mature_response_n, 0);
    assert.ok(combined.mature_response_n > 0);
    assert.ok(combined.first_response_success_n > v2Only.first_response_success_n);
    assert.equal(combined.transfer_first_response_success_n, 1);
    assert.ok(combined.final_maturity > v2Only.final_maturity);
    assert.ok(fs.existsSync(artifacts.summaryPath));
    assert.ok(fs.existsSync(artifacts.reportPath));
    assert.ok(fs.existsSync(artifacts.fixturePath));
  });
});
