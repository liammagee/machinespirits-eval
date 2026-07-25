import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveTutorStubConversationalCompletion } from '../services/tutorStubConversationalCompletion.js';
import { resolveTutorStubGenerousInference } from '../services/tutorStubGenerousInference.js';
import {
  auditTutorStubLiveTurnProgressionV1,
  auditTutorStubTurnProgression,
  compileTutorStubTurnProgressionContract,
} from '../services/tutorStubTurnProgressionContract.js';

const ACT_DESCRIPTION =
  'The learner gives a short answer whose referent and scope are supplied by the immediately preceding public question.';

function frame({ completion, summary = 'The learner names a next check to run.' } = {}) {
  return {
    learner_move: { summary },
    conversational_completion: completion,
    due_evidence_surfaces: [],
  };
}

function actDescriptiveCompletion() {
  return {
    resolved: true,
    status: 'resolved',
    acceptedMeaning: ACT_DESCRIPTION,
    acceptedMeaningKind: 'discourse_act',
    sourceTutorQuestion: 'What would you check first?',
  };
}

function contentParaphraseCompletion() {
  return {
    resolved: true,
    status: 'resolved',
    acceptedMeaning: 'The learner wants to check the sources of water.',
    acceptedMeaningKind: 'content_paraphrase',
    sourceTutorQuestion: 'What would you check first?',
  };
}

test('a generous-inference resolution is marked as a discourse act, not a content paraphrase', () => {
  const generousInference = resolveTutorStubGenerousInference({
    mode: 'defeasible_human_scaffold',
    learnerText: 'the same',
    previousTutorText: 'Do these marks show the same hand alone, or a second hand?',
  });
  assert.equal(generousInference.applied, true, JSON.stringify(generousInference));

  const resolved = resolveTutorStubConversationalCompletion({
    mode: 'defeasible_human_scaffold',
    learnerText: 'the same',
    previousTutorText: 'Do these marks show the same hand alone, or a second hand?',
    generousInference,
  });
  assert.equal(resolved.resolved, true, JSON.stringify(resolved));
  assert.equal(resolved.acceptedMeaning, generousInference.resolvedMeaning);
  assert.equal(resolved.acceptedMeaningKind, 'discourse_act');

  const classified = resolveTutorStubConversationalCompletion({
    mode: 'defeasible_human_scaffold',
    learnerText: 'The tap was left open overnight.',
    previousTutorText: 'What would you check first?',
    classification: { turn: { discourse_move: 'hypothesis', summary: 'The learner proposes the tap was left open.' } },
  });
  if (classified.resolved) assert.equal(classified.acceptedMeaningKind, 'content_paraphrase');
});

test('an act-descriptive accepted meaning never becomes the turn focus surface', () => {
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'check for sources of water',
    responseCompositionFrame: frame({ completion: actDescriptiveCompletion() }),
    actionFamily: 'stage_next_step',
    tactic: 'shared_scene_invitation',
  });

  assert.equal(contract.learner_uptake.accepted_meaning_kind, 'discourse_act');
  assert.notEqual(contract.turn_focus_contract.primary_source, 'conversational_completion');
  for (const term of ['referent', 'scope', 'preced', 'immediately']) {
    assert.ok(
      !contract.learner_uptake.focus_terms.includes(term),
      `focus terms must not carry the analyst term "${term}": ${JSON.stringify(contract.learner_uptake.focus_terms)}`,
    );
  }
});

test('a content-paraphrase accepted meaning still supplies the turn focus surface', () => {
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'the same',
    responseCompositionFrame: frame({ completion: contentParaphraseCompletion() }),
    actionFamily: 'stage_next_step',
    tactic: 'shared_scene_invitation',
  });

  assert.equal(contract.learner_uptake.accepted_meaning_kind, 'content_paraphrase');
  assert.equal(contract.turn_focus_contract.primary_source, 'conversational_completion');
  assert.ok(contract.learner_uptake.focus_terms.includes('water'));
});

test('a natural uptake that echoes the learner’s own words passes the live guard', () => {
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'check for sources of water',
    responseCompositionFrame: frame({ completion: actDescriptiveCompletion() }),
    actionFamily: 'stage_next_step',
    tactic: 'shared_scene_invitation',
  });

  const uptake = 'Yes, sources of water is the right thing to check next.';
  const development = 'The repair notebook lists the two taps that were opened that morning.';
  const audit = auditTutorStubLiveTurnProgressionV1({
    contract,
    text: `${uptake} ${development}`,
    responseComposition: { segments: { uptake, development } },
  });

  assert.ok(!audit.issues.some((issue) => issue.type === 'learner_uptake_not_realized'), JSON.stringify(audit.issues));
});

test('a responsive uptake in the learner’s own words passes when the focus surface came from elsewhere', () => {
  // The instructional-meta plane takes its focus from the move summary, so the
  // focus terms here share nothing with what the learner actually said. Route A
  // cannot fire; the learner-surface echo route is the only way through.
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'check for sources of water',
    responseCompositionFrame: {
      learner_move: { summary: 'The learner asks for a simpler explanation.' },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [],
      discourse_plane: { plane: 'instructional_meta', meta_target: 'explanation' },
    },
    actionFamily: 'stage_next_step',
    tactic: 'shared_scene_invitation',
  });
  const focusTerms = contract.learner_uptake.focus_terms;
  assert.ok(!focusTerms.some((term) => ['check', 'sourc', 'water'].includes(term)), JSON.stringify(focusTerms));

  const uptake = 'Yes, sources of water is the right place to start.';
  const audit = auditTutorStubLiveTurnProgressionV1({
    contract,
    text: uptake,
    responseComposition: { segments: { uptake, development: '' } },
  });
  const finding = audit.issues.find((issue) => issue.type === 'learner_uptake_not_realized');
  assert.ok(!finding, JSON.stringify(audit.issues));
});

test('the learner-surface echo route requires a responsive opening, not merely a shared word', () => {
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'check for sources of water',
    responseCompositionFrame: frame({ completion: actDescriptiveCompletion() }),
    actionFamily: 'stage_next_step',
    tactic: 'shared_scene_invitation',
  });

  const uptake = 'The kettle boiled dry on the stove that morning.';
  const audit = auditTutorStubLiveTurnProgressionV1({
    contract,
    text: uptake,
    responseComposition: { segments: { uptake, development: '' } },
  });

  assert.ok(audit.issues.some((issue) => issue.type === 'learner_uptake_not_realized'));
});

test('focus-term overlap remains sufficient on its own', () => {
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'Does the blue seal prove the custody chain?',
    responseCompositionFrame: frame({
      completion: { resolved: false },
      summary: 'The learner asks whether the blue seal proves the custody chain.',
    }),
    actionFamily: 'stage_next_step',
    tactic: 'shared_scene_invitation',
  });

  const uptake = 'Your question about the blue seal and the custody chain is the one to settle.';
  const audit = auditTutorStubTurnProgression({
    contract,
    composition: {
      slots: {
        uptake,
        performance: {
          entry: 'I hold the blue seal beside the custody sheet.',
          response: 'The seal is identified; the custody chain is not yet proved.',
        },
        handoff: 'The next check must connect the blue seal to its custody chain.',
      },
    },
  });

  assert.ok(!audit.issues.some((issue) => issue.type === 'learner_uptake_not_realized'), JSON.stringify(audit.issues));
});
