import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyTutorStubComprehensionRequest,
  applyTutorStubComprehensionResponse,
  createTutorStubComprehensionState,
  detectTutorStubComprehensionRequest,
  tutorStubComprehensionFeatures,
  tutorStubComprehensionPrompt,
  tutorStubComprehensionSnapshot,
} from '../tutorStubComprehensionState.js';

test('natural terminology questions create non-DAG comprehension pressure', () => {
  const state = createTutorStubComprehensionState();
  const request = detectTutorStubComprehensionRequest({
    text: 'What does “cupel” mean?',
    classification: { turn: { request_type: 'plain_language_request' } },
    turn: 3,
  });
  applyTutorStubComprehensionRequest(state, request);

  const features = tutorStubComprehensionFeatures(state, { turn: 3 });
  const snapshot = tutorStubComprehensionSnapshot(state, { turn: 3 });
  assert.deepEqual(features.unresolvedTerms, ['cupel']);
  assert.equal(features.pressure, 0.85);
  assert.equal(features.requiresGloss, true);
  assert.equal(request.advancesLearnerDag, false);
  assert.equal(snapshot.advancesLearnerDag, false);
  assert.match(tutorStubComprehensionPrompt(state, { turn: 3 }), /not resistance or low agency/u);
  assert.match(tutorStubComprehensionPrompt(state, { turn: 3 }), /Do not advance the proof DAG/u);
});

test('slash explanations remain recent after the term is explained', () => {
  const state = createTutorStubComprehensionState();
  const request = detectTutorStubComprehensionRequest({
    explicitTerm: 'burin',
    source: 'slash_explain',
    turn: 4,
  });
  applyTutorStubComprehensionRequest(state, request);
  const result = applyTutorStubComprehensionResponse(state, {
    text: 'A burin is a small engraving tool.',
    source: 'slash_explain',
    turn: 4,
    force: true,
  });

  assert.deepEqual(result.explainedTerms, ['burin']);
  const nextTurn = tutorStubComprehensionFeatures(state, { turn: 5 });
  assert.deepEqual(nextTurn.unresolvedTerms, []);
  assert.equal(nextTurn.recentRequest, true);
  assert.equal(nextTurn.pressure, 0.55);
});

test('asking about an explained term reopens it', () => {
  const state = createTutorStubComprehensionState();
  const request = detectTutorStubComprehensionRequest({
    text: 'Define dross',
    classification: { turn: { request_type: 'plain_language_request' } },
    turn: 2,
  });
  applyTutorStubComprehensionRequest(state, request);
  applyTutorStubComprehensionResponse(state, {
    text: 'Dross is the impure residue left from working metal.',
    turn: 2,
  });
  applyTutorStubComprehensionRequest(state, { ...request, turn: 6 });

  assert.equal(state.terms[0].status, 'reopened');
  assert.equal(state.terms[0].requestCount, 2);
});

test('ordinary evidence questions do not become comprehension requests', () => {
  const request = detectTutorStubComprehensionRequest({
    text: 'What evidence should I test next?',
    classification: { turn: { request_type: 'conceptual_clarity_request' } },
    turn: 2,
  });

  assert.equal(request.detected, false);
  assert.deepEqual(request.terms, []);
});

test('a clarification response resolves only the requested term', () => {
  const state = createTutorStubComprehensionState();
  for (const term of ['cupel', 'burin']) {
    applyTutorStubComprehensionRequest(
      state,
      detectTutorStubComprehensionRequest({ explicitTerm: term, source: 'slash_explain', turn: 2 }),
    );
  }
  const result = applyTutorStubComprehensionResponse(state, {
    text: 'A cupel is a small porous vessel used in assaying metal.',
    source: 'slash_explain',
    turn: 2,
    force: true,
    terms: ['cupel'],
  });

  assert.deepEqual(result.explainedTerms, ['cupel']);
  assert.deepEqual(result.snapshot.features.unresolvedTerms, ['burin']);
});
