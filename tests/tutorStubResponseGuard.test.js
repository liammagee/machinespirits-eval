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
  snapshotTutorStubPublicPremiseIds,
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

test('a released multiword answer name is public when its world constant uses camel case', () => {
  assert.equal(
    tutorStubAnswerNameIsPublic({
      answerTerm: 'larkinUnit',
      publicText: 'The Facilities record names the Larkin unit and its retired asset tag.',
    }),
    true,
  );
  assert.equal(
    tutorStubAnswerNameIsPublic({
      answerTerm: 'larkinUnit',
      publicText: 'The Facilities record names a retired incubator but gives no asset identity.',
    }),
    false,
  );
});

test('a released possessive answer name matches a symbolic trailing-s constant', () => {
  assert.equal(
    tutorStubAnswerNameIsPublic({
      answerTerm: 'pipersGullet',
      publicText: "The frost shutter over Piper's Gullet is still bolted fast.",
    }),
    true,
  );
});

test('a possessive released answer name is public without making its conclusion public', () => {
  assert.equal(
    tutorStubAnswerNameIsPublic({
      answerTerm: 'moth',
      publicText: "The decommission log says Moth’s override key was never revoked.",
    }),
    true,
  );
});

test('the speaking boundary snapshots committed and due premise ids once', () => {
  const committed = [{ premise: 'p_seen' }];
  const due = [{ premise: 'p_due' }];
  const snapshot = snapshotTutorStubPublicPremiseIds({ committedEvidence: committed, dueEvidence: due });

  due.splice(0, 1, { premise: 'p_future' });
  committed.push({ premise: 'p_later' });

  assert.deepEqual(snapshot, ['p_seen', 'p_due']);
  assert.equal(Object.isFrozen(snapshot), true);
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

test('bounded deterministic repair stays concrete and names the live public question', () => {
  const permit = world.premiseById.get('p_permit');
  const support = {
    answerability: 'direction_only_until_evidence_is_public',
    modality: 'bounded_directional_choice',
    guardRequired: true,
    clarificationInvitationRequired: true,
  };
  const text = deterministicTutorStubContextualFallback({
    support,
    world,
    learnerText: "I don't know",
    latestEvidence: { premise: 'p_permit', surface: permit.surface },
  });

  assert.match(text, /Who took Priya's labelled lunchbox/u);
  assert.match(text, /A\) a plain explanation of the notice/u);
  assert.match(text, /B\) to look at the next piece of evidence/u);
  assert.doesNotMatch(text, /condition in the rule|whole case|supporting step|complete answer/iu);
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

test('the repetition guard rejects a substantial repeated opener even when the clue changes', () => {
  const opening = 'Right—that gives us a sound place to begin; we’ll examine it before extending the case.';
  const audit = auditTutorStubRepetitionResponse({
    text: `${opening} I draw the cupel close and show the poor alloy.`,
    recentTutorTexts: [`${opening} I open the mint-yard register and read its first line.`],
  });

  assert.equal(audit.ok, false);
  assert.deepEqual(audit.issues.map((issue) => issue.type), ['repeated_tutor_opening']);
});

test('the repetition guard rejects an exact stock opener nine tutor turns later', () => {
  const opening = 'That is the right evidentiary limit; we will keep the conclusion open.';
  const audit = auditTutorStubRepetitionResponse({
    text: `${opening} I draw the charcoal book beside your entry.`,
    recentTutorTexts: [
      `${opening} I turn the cold crucible toward the candlelight.`,
      ...Array.from({ length: 8 }, (_, index) =>
        `Distinct intervening tutor turn ${index + 1} examines a different public exhibit.`,
      ),
    ],
  });

  assert.equal(audit.ok, false);
  assert.ok(audit.issues.some((issue) => issue.type === 'repeated_tutor_opening'));
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
