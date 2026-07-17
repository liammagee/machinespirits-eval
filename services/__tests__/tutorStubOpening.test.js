import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TUTOR_STUB_OPENING_REQUIREMENTS,
  auditTutorStubOpening,
  buildTutorStubOpeningFrame,
  deterministicTutorStubOpening,
  tutorStubOpeningPrompt,
} from '../tutorStubOpening.js';

function world(overrides = {}) {
  return {
    id: 'world_test_kitchen',
    title: 'The Missing Lunch',
    question: "Who took Priya's lunchbox?",
    setting:
      'The studio kettle is boiling and Priya has found an empty shelf in the kitchen fridge. The incident log is open beside the sink.',
    presentation: {
      scene_ecology: 'studio office kitchen',
      narrative_diction: 'plain contemporary',
      ledger_term: 'incident log',
    },
    openingFrame: null,
    ...overrides,
  };
}

test('opening frames expose only structural requirements plus the authored public world', () => {
  const frame = buildTutorStubOpeningFrame({ world: world() });
  const prompt = tutorStubOpeningPrompt(frame);

  assert.deepEqual(
    TUTOR_STUB_OPENING_REQUIREMENTS.map((row) => row.id),
    ['public_situation', 'public_question', 'available_evidence_only', 'observation_or_clarification'],
  );
  assert.equal(frame.realization, 'speaking_tutor_model');
  assert.match(prompt, /studio kettle is boiling/u);
  assert.match(prompt, /Who took Priya's lunchbox\?/u);
  assert.match(prompt, /State or enact the public situation/u);
  assert.match(prompt, /There is no clue yet/u);
  assert.doesNotMatch(prompt, /secret|proof path|future release/iu);
});

test('a world may author exact opening speech instead of calling the speaking model', () => {
  const authoredText =
    "Priya is at the fridge and the incident log is open. Who took Priya's lunchbox? Tell me what you want checked first.";
  const frame = buildTutorStubOpeningFrame({
    world: world({ openingFrame: { authoredText } }),
  });

  assert.equal(frame.realization, 'authored_world_opening');
  assert.equal(frame.authoredText, authoredText);
  assert.equal(auditTutorStubOpening({ text: authoredText, frame, leakAudit: { ok: true, leaks: [] } }).ok, true);
});

test('deterministic fallback is grounded in each world instead of repeating the old boilerplate', () => {
  const kitchen = buildTutorStubOpeningFrame({ world: world() });
  const assay = buildTutorStubOpeningFrame({
    world: world({
      id: 'world_test_assay',
      title: 'The Light Coins',
      question: 'Whose hand struck the light coins?',
      setting: 'The guild-hall balance is ready and the false coins lie under the assay lamp.',
      presentation: {
        scene_ecology: "moneyer's assay",
        narrative_diction: 'medieval',
        ledger_term: 'trial-book',
      },
    }),
  });
  const kitchenText = deterministicTutorStubOpening(kitchen);
  const assayText = deterministicTutorStubOpening(assay);

  assert.notEqual(kitchenText, assayText);
  assert.match(kitchenText, /studio kettle/u);
  assert.match(assayText, /guild-hall balance/u);
  assert.doesNotMatch(kitchenText, /Keep the case question in view/u);
  assert.equal(auditTutorStubOpening({ text: kitchenText, frame: kitchen, leakAudit: { ok: true } }).ok, true);
  assert.equal(auditTutorStubOpening({ text: assayText, frame: assay, leakAudit: { ok: true } }).ok, true);
});

test('opening audit rejects missing situation, missing invitation, or unavailable evidence', () => {
  const frame = buildTutorStubOpeningFrame({ world: world() });
  const text = "Who took Priya's lunchbox?";
  const audit = auditTutorStubOpening({
    text,
    frame,
    leakAudit: { ok: false, leaks: [{ type: 'unreleased_premise_content' }] },
  });

  assert.equal(audit.ok, false);
  assert.deepEqual(
    audit.issues.map((issue) => issue.type),
    ['public_situation_missing', 'opening_invitation_missing', 'unavailable_evidence'],
  );
});

test('opening evidence must be presented before the tutor invites an observation', () => {
  const frame = buildTutorStubOpeningFrame({
    world: world(),
    openingEvidence: [
      {
        premise: 'p_badge',
        via: 'tutor',
        surface: 'The badge log places Dario in the kitchen at 12:02 with a mug in hand.',
      },
    ],
  });
  const accepted =
    "The studio kettle is boiling and Priya has found an empty shelf. Who took Priya's lunchbox? The badge log places Dario in the kitchen at 12:02. What does that show on its own?";
  const missingClue =
    "The studio kettle is boiling and Priya has found an empty shelf. Who took Priya's lunchbox? What do you notice?";

  assert.equal(auditTutorStubOpening({ text: accepted, frame, leakAudit: { ok: true } }).ok, true);
  assert.ok(
    auditTutorStubOpening({ text: missingClue, frame, leakAudit: { ok: true } }).issues.some(
      (issue) => issue.type === 'opening_clue_missing',
    ),
  );
});
