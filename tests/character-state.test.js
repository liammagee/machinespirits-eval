import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CHARACTER_AXES,
  categoriesFromEvidence,
  characterMaturityScore,
  characterStateForTutorContext,
  initialCharacterState,
  shouldUseMatureFirstResponse,
  updateCharacterStateFromEvidence,
} from '../services/adaptiveTutor/characterState.js';

function evidence(categories) {
  return [{ categories }];
}

describe('adaptive character state', () => {
  it('starts with neutral axes and a zero maturity score', () => {
    const state = initialCharacterState({ learnerId: 'learner-a', arm: 'test_arm' });

    assert.equal(state.learner_id, 'learner-a');
    assert.equal(state.arm, 'test_arm');
    assert.equal(state.scene_count, 0);
    assert.equal(characterMaturityScore(state), 0);
    for (const axis of CHARACTER_AXES) {
      assert.equal(state.axes[axis], 0);
    }
  });

  it('aggregates positive evidence labels into character axes', () => {
    const state = initialCharacterState();
    const next = updateCharacterStateFromEvidence(state, {
      sceneId: 'scene_relevance',
      outcome: 'success',
      evidence: evidence({
        'learner-authored rationale': true,
        'learner-owned relevance test': true,
        'task reorientation': true,
        'mere agreement': false,
      }),
    });

    assert.equal(next.scene_count, 1);
    assert.ok(next.axes.proof_ownership > state.axes.proof_ownership);
    assert.ok(next.axes.relevance_orientation > state.axes.relevance_orientation);
    assert.ok(next.axes.next_step_agency > state.axes.next_step_agency);
    assert.ok(characterMaturityScore(next) > characterMaturityScore(state));
    assert.deepEqual(next.evidence_counts, {
      'learner-authored rationale': 1,
      'learner-owned relevance test': 1,
      'task reorientation': 1,
    });
  });

  it('does not mature from empty or negative evidence', () => {
    const state = updateCharacterStateFromEvidence(
      { axes: {}, evidence_counts: {}, scene_summaries: [] },
      {
        sceneId: 'empty_scene',
        outcome: 'failure',
        evidence: evidence({
          'learner-authored rationale': false,
          'learner-owned relevance test': false,
        }),
      },
    );

    assert.equal(state.scene_count, 1);
    assert.equal(characterMaturityScore(state), 0);
    assert.equal(shouldUseMatureFirstResponse(state, { signal: 'irrelevance' }), false);
  });

  it('routes later first responses from the matured axis for the current resistance signal', () => {
    let state = initialCharacterState();
    state = updateCharacterStateFromEvidence(state, {
      sceneId: 'scene_relevance',
      outcome: 'success',
      evidence: evidence({
        'learner-owned relevance test': true,
        'task reorientation': true,
      }),
    });

    assert.equal(shouldUseMatureFirstResponse(state, { signal: 'irrelevance' }), true);
    assert.equal(shouldUseMatureFirstResponse(state, { signal: 'question_flood' }), false);
  });

  it('routes transfer only after cross-axis maturity is high enough', () => {
    let state = initialCharacterState();
    assert.equal(shouldUseMatureFirstResponse(state, { transfer: true }), false);

    state = updateCharacterStateFromEvidence(state, {
      sceneId: 'scene_relevance',
      outcome: 'success',
      evidence: evidence({
        'learner-authored rationale': true,
        'learner-owned relevance test': true,
        'task reorientation': true,
      }),
    });
    state = updateCharacterStateFromEvidence(state, {
      sceneId: 'scene_frustration',
      outcome: 'success',
      evidence: evidence({
        'renewed attempt after affective repair': true,
        'smaller learner-owned move': true,
      }),
    });
    state = updateCharacterStateFromEvidence(state, {
      sceneId: 'scene_question_flood',
      outcome: 'success',
      evidence: evidence({
        'collapsed question set': true,
        'state-disambiguating response': true,
      }),
    });
    state = updateCharacterStateFromEvidence(state, {
      sceneId: 'scene_rote',
      outcome: 'success',
      evidence: evidence({
        'learner-authored prediction': true,
        'non-formulaic learner rationale': true,
      }),
    });

    assert.ok(characterMaturityScore(state) >= 0.22);
    assert.equal(shouldUseMatureFirstResponse(state, { transfer: true }), true);
  });

  it('builds a compact tutor-context view without leaking scene history', () => {
    const state = updateCharacterStateFromEvidence(initialCharacterState(), {
      sceneId: 'scene_relevance',
      outcome: 'success',
      evidence: evidence({
        'learner-owned relevance test': true,
      }),
    });

    const context = characterStateForTutorContext(state);
    assert.equal(context.version, state.version);
    assert.equal(context.scene_count, 1);
    assert.equal(context.maturity, characterMaturityScore(state));
    assert.equal(context.axes.relevance_orientation, state.axes.relevance_orientation);
    assert.equal(Object.hasOwn(context, 'scene_summaries'), false);
  });

  it('flattens evidence entries into boolean categories', () => {
    assert.deepEqual(
      categoriesFromEvidence([{ categories: { a: true, b: false } }, { categories: { b: true, c: false } }]),
      { a: true, b: true, c: false },
    );
  });
});
