import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadWorld } from '../services/dramaticDerivation/world.js';
import { auditTutorStubQuestionSupportResponse } from '../services/tutorStubQuestionSupport.js';
import {
  auditTutorStubReleaseDelivery,
  auditTutorStubRepetitionResponse,
  deterministicTutorStubContextualFallback,
  tutorStubAnswerNameIsPublic,
} from '../services/tutorStubResponseGuard.js';
import { buildTutorStubWorldScaffold } from '../services/tutorStubWorldScaffold.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-028-larkspur-fridge.yaml'));

test('the Larkspur clearance clue may name Wrenfold without asserting the concealed answer', () => {
  const permit = world.premiseById.get('p_permit');
  assert.equal(
    tutorStubAnswerNameIsPublic({
      answerTerm: 'wrenfold',
      publicText: `${world.question}\n${permit.surface}`,
    }),
    true,
  );
  assert.equal(
    tutorStubAnswerNameIsPublic({
      answerTerm: 'wrenfold',
      publicText: `${world.question}\nThe visitor badge is WF-11.`,
    }),
    false,
  );
});

test('release delivery requires the clue, not merely the answer name', () => {
  const delivered = auditTutorStubReleaseDelivery({
    text: [
      'The notice by the lifts says the Wrenfold crew was authorized to clear the fridge for outlet testing.',
      'That shows permission to move the lunchbox, not proof that they did.',
    ].join(' '),
    world,
    premiseIds: ['p_permit'],
  });
  assert.deepEqual(delivered.deliveredPremises, ['p_permit']);

  const nameOnly = auditTutorStubReleaseDelivery({
    text: 'Wrenfold might matter here.',
    world,
    premiseIds: ['p_permit'],
  });
  assert.deepEqual(nameOnly.deliveredPremises, []);
  assert.deepEqual(nameOnly.missingPremises, ['p_permit']);
});

test('the deterministic repair uses the current Larkspur clue and passes the clarification guard', () => {
  const support = {
    answerability: 'answerable_after_staging',
    modality: 'stage_then_ask',
    guardRequired: true,
    clarificationInvitationRequired: true,
  };
  const text = deterministicTutorStubContextualFallback({
    support,
    world,
    learnerText: 'Sorry, what does that mean?',
    dueEvidence: [
      {
        premise: 'p_permit',
        surface: world.premiseById.get('p_permit').surface,
      },
    ],
  });

  assert.match(text, /Wrenfold crew/u);
  assert.match(text, /fire-safety inspection|outlet testing/u);
  assert.doesNotMatch(text, /decisive act|forge|die-route|blank branch/iu);
  assert.equal(auditTutorStubQuestionSupportResponse({ text, support }).ok, true);
});

test('the repetition guard rejects verbatim and near-verbatim tutor loops', () => {
  const previous =
    'That is as far as the public evidence carries us for now. The missing link is evidence of who controlled the act.';
  assert.equal(auditTutorStubRepetitionResponse({ text: previous, recentTutorTexts: [previous] }).ok, false);
  assert.equal(
    auditTutorStubRepetitionResponse({
      text: 'The public evidence carries us only this far; we still lack evidence showing who controlled the act.',
      recentTutorTexts: [previous],
      threshold: 0.4,
    }).ok,
    false,
  );
  assert.equal(
    auditTutorStubRepetitionResponse({
      text: 'The lift notice authorizes Wrenfold to clear appliances during outlet testing.',
      recentTutorTexts: [previous],
    }).ok,
    true,
  );
});

test('world scaffolds derive their language from Larkspur rules rather than Marrick vocabulary', () => {
  const permit = world.premiseById.get('p_permit');
  const scaffold = buildTutorStubWorldScaffold({
    world,
    evidence: { premise: 'p_permit', fact: permit.fact, surface: permit.surface },
  });

  assert.equal(scaffold.ruleId, 'R1_clear');
  assert.match(scaffold.localQuestion, /Wrenfold crew|fire-safety inspection/u);
  assert.match(scaffold.warrantFrame, /appliance-clearance authority/u);
  assert.doesNotMatch(
    `${scaffold.label} ${scaffold.localQuestion} ${scaffold.warrantFrame} ${scaffold.joinReminder}`,
    /coin|blank|die|graver|crucible|Verrell/iu,
  );
});
