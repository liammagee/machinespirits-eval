import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  applyTutorStubComprehensionRequest,
  applyTutorStubComprehensionResponse,
  createTutorStubComprehensionState,
  detectTutorStubComprehensionRequest,
  restoreTutorStubComprehensionState,
  tutorStubComprehensionFeatures,
  tutorStubComprehensionPrompt,
  tutorStubComprehensionSnapshot,
} from '../tutorStubComprehensionState.js';

test('comprehension restoration preserves event precedence, schema filtering, turn fallback, and cloning', () => {
  const turnSnapshot = { terms: [{ key: 'turn', term: 'turn' }] };
  const oldEventSnapshot = { terms: [{ key: 'old', term: 'old' }] };
  const newEventSnapshot = { terms: [{ key: 'new', term: 'new' }] };
  const state = {};
  assert.deepEqual(
    restoreTutorStubComprehensionState(
      state,
      [{ comprehension: { afterTutor: turnSnapshot } }],
      [
        { comprehensionState: oldEventSnapshot },
        { state: { schema: 'wrong-schema', terms: [{ key: 'wrong', term: 'wrong' }] } },
        { state: { schema: 'machinespirits.tutor-stub.comprehension-side-state.v1', ...newEventSnapshot } },
      ],
    ),
    { restored: true, terms: 1 },
  );
  assert.equal(state.comprehension.terms[0].key, 'new');
  assert.notEqual(state.comprehension.terms, newEventSnapshot.terms);

  const turnState = {};
  assert.deepEqual(
    restoreTutorStubComprehensionState(turnState, [
      { comprehension: { afterTutor: { terms: [{ key: 'earlier', term: 'earlier' }] } } },
      {
        comprehension: {
          afterTutor: { terms: [{ key: 'after', term: 'after' }] },
          state: { terms: [{ key: 'state', term: 'state' }] },
        },
      },
    ]),
    { restored: true, terms: 1 },
  );
  assert.equal(turnState.comprehension.terms[0].key, 'after');
});

test('comprehension restoration creates a clean empty state without snapshots', () => {
  const state = { comprehension: { stale: true } };
  assert.deepEqual(restoreTutorStubComprehensionState(state, [], []), { restored: false, terms: 0 });
  assert.equal(state.comprehension.schema, 'machinespirits.tutor-stub.comprehension-side-state.v1');
  assert.deepEqual(state.comprehension.terms, []);
});

test('the CLI imports rather than redeclares comprehension restoration', () => {
  const source = fs.readFileSync(new URL('../../scripts/tutor-stub.js', import.meta.url), 'utf8');
  assert.match(source, /restoreTutorStubComprehensionState as restoreComprehensionState/u);
  assert.doesNotMatch(source, /function restoreComprehensionState\(/u);
});

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

test('a classifier cannot turn an ordinary declarative pronoun into a comprehension request', () => {
  const request = detectTutorStubComprehensionRequest({
    text: 'The light shillings are newly struck from a copper-and-lead alloy, so clipping cannot explain them.',
    classification: { turn: { request_type: 'plain_language_request' } },
    turn: 5,
  });

  assert.equal(request.detected, false);
  assert.deepEqual(request.terms, []);
});

test('a visible generic clarification request still uses the classifier signal', () => {
  const request = detectTutorStubComprehensionRequest({
    text: 'I do not understand. Can you say that in plain words?',
    classification: { turn: { request_type: 'plain_simplification_followup' } },
    turn: 5,
  });

  assert.equal(request.detected, true);
  assert.equal(request.generic, true);
});

test('quoted term definitions resolve the requested term', () => {
  const state = createTutorStubComprehensionState();
  applyTutorStubComprehensionRequest(
    state,
    detectTutorStubComprehensionRequest({ explicitTerm: 'them', source: 'slash_explain', turn: 5 }),
  );
  const result = applyTutorStubComprehensionResponse(state, {
    text: '“Them” means the light shillings on the assay cloth.',
    turn: 5,
  });

  assert.deepEqual(result.explainedTerms, ['them']);
  assert.deepEqual(result.snapshot.features.unresolvedTerms, []);
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
