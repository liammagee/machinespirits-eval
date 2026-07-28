import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadWorld } from '../services/dramaticDerivation/world.js';
import { auditTutorStubQuestionSupportResponse } from '../services/tutorStubQuestionSupport.js';
import {
  auditTutorStubAdvanceResponse,
  auditTutorStubReleaseDelivery,
  auditTutorStubRepetitionResponse,
  deterministicTutorStubContextualFallback,
  resolveTutorStubAnswerReference,
  snapshotTutorStubPublicPremiseIds,
  tutorStubAnswerNameIsPublic,
} from '../services/tutorStubResponseGuard.js';
import { buildTutorStubWorldScaffold } from '../services/tutorStubWorldScaffold.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-028-larkspur-fridge.yaml'));
const rowanWorld = loadWorld(path.join(ROOT, 'config/drama-derivation/world-030-rowan-flat.yaml'));

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

test('public components of a compound concealed answer do not count as the concealed name', () => {
  const answerIndex = rowanWorld.questionPattern.findIndex((part) => typeof part === 'string' && part.startsWith('?'));
  const answerTerm = rowanWorld.secret.fact[answerIndex];
  const shower = rowanWorld.premiseById.get('p_shower');
  const split = rowanWorld.premiseById.get('p_split');
  const publicText = [rowanWorld.question, rowanWorld.setting, shower.surface, split.surface].join('\n');
  const publicReference = resolveTutorStubAnswerReference({
    answerTerm,
    text: split.surface,
    publicText,
  });

  assert.equal(publicReference.answerTokens.length, 3);
  assert.equal(publicReference.matchedTokens.length, 2);
  assert.equal(publicReference.concealedTokens.length, 1);
  assert.deepEqual(publicReference.concealedMatches, []);
  assert.equal(publicReference.referencesAnswer, false);

  const [concealedToken] = publicReference.concealedTokens;
  const concealedReference = resolveTutorStubAnswerReference({
    answerTerm,
    text: `The remaining identity is ${concealedToken}.`,
    publicText,
  });
  assert.deepEqual(concealedReference.concealedMatches, [concealedToken]);
  assert.equal(concealedReference.referencesAnswer, true);
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
      publicText: 'The decommission log says Moth’s override key was never revoked.',
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
  assert.deepEqual(
    audit.issues.map((issue) => issue.type),
    ['repeated_tutor_opening'],
  );
});

test('the repetition guard rejects an exact stock opener nine tutor turns later', () => {
  const opening = 'That is the right evidentiary limit; we will keep the conclusion open.';
  const audit = auditTutorStubRepetitionResponse({
    text: `${opening} I draw the charcoal book beside your entry.`,
    recentTutorTexts: [
      `${opening} I turn the cold crucible toward the candlelight.`,
      ...Array.from(
        { length: 8 },
        (_, index) => `Distinct intervening tutor turn ${index + 1} examines a different public exhibit.`,
      ),
    ],
  });

  assert.equal(audit.ok, false);
  assert.ok(audit.issues.some((issue) => issue.type === 'repeated_tutor_opening'));
});

test('the repetition guard rejects a substantial sentence repeated inside one reply', () => {
  const repeated =
    'I clear a space beside Edony’s charcoal entries: they place the crucible under her hand, yet leave the striking untouched.';
  const audit = auditTutorStubRepetitionResponse({
    text: `${repeated} I make room beside the record for you. ${repeated} What does the watch add?`,
    recentTutorTexts: [],
  });

  assert.equal(audit.ok, false);
  assert.equal(audit.maxSimilarity, 1);
  assert.deepEqual(
    audit.issues.map((issue) => issue.type),
    ['repeated_tutor_sentence'],
  );
});

// The whole bare Riverside Clinic arm, showcase run 2026-07-26T14-41-49-087Z.
// From turn 4 on the tutor makes one move five times in five different
// sentences — an access trace is not a cancellation record, so produce the
// appointment audit entry with action, time and source — and the judge called
// the last of them nearly identical in content to those before it. The arm
// scored 28.7. The full window matters here: the stall is only visible against
// the vocabulary the earlier turns established, which is why the channel
// compares against the recent turns rather than the immediately preceding one.
const RIVERSIDE_BARE_ARM = [
  'Yes—the access log shows Mara opened the record, not that she cancelled it. I’d look for the audit entry that names the action on the appointment itself. What action would count as stronger evidence than simply opening Noor’s record?',
  'Exactly. Opening a record is only a footprint; the cancellation entry should show the appointment action and its source. What would you need that entry to show before linking the cancellation to Mara?',
  'Precisely. We still need the appointment’s own audit entry—not just Mara’s access footprint—to show she issued the cancellation. What timestamp and source would make that link persuasive?',
  'That would be strong evidence: the appointment action, its timing, and Mara’s source would line up. Until those three match, her opening the record remains only an access trace.',
  'That keeps the review fair: Mara’s access trace is not a cancellation record. The next decisive clue is the appointment audit entry showing what changed, when, and from which source.',
  'Exactly. Until that entry ties the cancellation itself to Mara’s source, the evidence does not support blaming her. The care log should record that distinction.',
  'I enter that distinction in the care log: Mara opened Noor’s record, but no cancellation is linked to her without an appointment audit entry showing the action, time, and source.',
  'I mark it: Mara’s record opening is an access trace, not proof of cancellation. The cancellation remains unlinked until its own audit entry shows the action, time, and source.',
];
const RIVERSIDE_STALL = { text: RIVERSIDE_BARE_ARM.at(-1), recentTutorTexts: RIVERSIDE_BARE_ARM.slice(0, -1) };

test('the advance channel catches a reworded stall the similarity score walks past', () => {
  const audit = auditTutorStubRepetitionResponse({
    ...RIVERSIDE_STALL,
    advance: {},
  });

  assert.equal(audit.ok, false);
  assert.deepEqual(
    audit.issues.map((issue) => issue.type),
    ['tutor_turn_without_advance'],
  );
  // The point of the second channel: the lexical score stays far below its own
  // threshold on the very turn the novelty score condemns.
  assert.ok(audit.maxSimilarity < 0.82, `expected a passing similarity score, got ${audit.maxSimilarity}`);
  assert.ok(audit.novelty < 0.25, `expected a failing novelty score, got ${audit.novelty}`);
});

test('the advance channel leaves the lexical channel alone unless it is asked for', () => {
  const audit = auditTutorStubRepetitionResponse({
    ...RIVERSIDE_STALL,
  });

  assert.equal(audit.ok, true);
  assert.deepEqual(audit.issues, []);
  assert.equal(audit.novelty, null);
});

test('the advance channel exempts a release turn, a closing turn, and a turn too short to judge', () => {
  const stalled = RIVERSIDE_STALL;

  assert.equal(
    auditTutorStubAdvanceResponse({ ...stalled, releasedNewEvidence: true }).skipped,
    'released_new_evidence',
  );
  assert.equal(auditTutorStubAdvanceResponse({ ...stalled, terminal: true }).skipped, 'terminal_turn');
  assert.equal(
    auditTutorStubAdvanceResponse({ ...stalled, text: 'The cancellation remains unlinked.' }).skipped,
    'too_short_to_judge',
  );
  assert.equal(
    auditTutorStubAdvanceResponse({ text: RIVERSIDE_STALL.text, recentTutorTexts: [] }).skipped,
    'no_prior_turns',
  );
  for (const skipped of [
    auditTutorStubAdvanceResponse({ ...stalled, releasedNewEvidence: true }),
    auditTutorStubAdvanceResponse({ ...stalled, terminal: true }),
  ]) {
    assert.equal(skipped.ok, true);
    assert.equal(skipped.novelty, null);
  }
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
