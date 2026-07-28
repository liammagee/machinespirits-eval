import assert from 'node:assert/strict';
import test from 'node:test';

import { tutorStubAnswerConclusionAsserted } from '../tutorStubConclusionAssertion.js';

const strikingWords = [/\bstruck\b/u, /\bstrike\b/u, /\bmade\b/u];
const dieWords = [/\bcut\b/u, /\bdie\b/u];

test('detects a direct unsupported answer-linked conclusion', () => {
  assert.equal(
    tutorStubAnswerConclusionAsserted({
      text: 'Edony struck the false shillings.',
      answerTerm: 'edony',
      wordPatterns: strikingWords,
    }),
    true,
  );
  assert.equal(
    tutorStubAnswerConclusionAsserted({
      text: 'Edony was at the forge. She cut the die.',
      answerTerm: 'edony',
      wordPatterns: dieWords,
    }),
    true,
  );
});

test('does not mistake an explicit evidentiary boundary for an asserted conclusion', () => {
  const text =
    'You have it: Edony alone drew the crucible whose melt these blanks bear. I slide the charcoal book between us. A struck coin also needs its die; what remains unsafe to write about Edony?';

  assert.equal(tutorStubAnswerConclusionAsserted({ text, answerTerm: 'edony', wordPatterns: dieWords }), false);
  assert.equal(tutorStubAnswerConclusionAsserted({ text, answerTerm: 'edony', wordPatterns: strikingWords }), false);
});

test('allows a proof-boundary question but not a leading culprit question', () => {
  assert.equal(
    tutorStubAnswerConclusionAsserted({
      text: 'Does that prove Edony struck the shillings?',
      answerTerm: 'edony',
      wordPatterns: strikingWords,
    }),
    false,
  );
  assert.equal(
    tutorStubAnswerConclusionAsserted({
      text: 'Did Edony strike the shillings?',
      answerTerm: 'edony',
      wordPatterns: strikingWords,
    }),
    true,
  );
});

test('does not bind a later generic die boundary back to an earlier answer sentence', () => {
  const text =
    'Edony alone drew the crucible whose melt these blanks bear, so the blanks were cast by Edony. I close the charcoal book; that still tells us nothing yet of whose die struck them.';

  assert.equal(tutorStubAnswerConclusionAsserted({ text, answerTerm: 'edony', wordPatterns: dieWords }), false);
  assert.equal(tutorStubAnswerConclusionAsserted({ text, answerTerm: 'edony', wordPatterns: strikingWords }), false);
});

test('does not treat an answer-naming custody clue plus an unfound die-mark as a die conclusion', () => {
  const text =
    '“I have kept this book exact: since the forge was shut, one hand alone drew the weir crucible and signed for its charcoal—Edony, the founder’s widow.” What does that change about the blanks, while the die-mark remains to be found?';

  assert.equal(tutorStubAnswerConclusionAsserted({ text, answerTerm: 'edony', wordPatterns: dieWords }), false);
});

test('does not bind a quoted custody clue to a following die-boundary question', () => {
  const text =
    '“I have kept this book exact: since the forge was shut, Edony alone drew the weir crucible and signed for its charcoal.” What does that tell the trial-book about who cast these blanks, while the die remains unmarked?';

  assert.equal(tutorStubAnswerConclusionAsserted({ text, answerTerm: 'edony', wordPatterns: dieWords }), false);
});

test('does not treat an answer-naming custody clue plus an unseen die-mark as a die conclusion', () => {
  const text =
    '“I have kept the charcoal reckonings since the forge shut. One hand alone drew the weir crucible and signed for its charcoal: Edony, the founder’s widow.” What does this fix about the hand that cast the blank, while the die-mark remains unseen?';

  assert.equal(tutorStubAnswerConclusionAsserted({ text, answerTerm: 'edony', wordPatterns: dieWords }), false);
});

test('does not treat an answer-naming casting inference plus an unaccounted die as a die conclusion', () => {
  const text =
    'Edony’s hand is tied to casting these blanks, but the shilling’s die remains unaccounted for. A cast blank alone cannot tell us whose hammer struck it.';

  assert.equal(tutorStubAnswerConclusionAsserted({ text, answerTerm: 'edony', wordPatterns: dieWords }), false);
});

test('reads the rejected half of a contrast as a stated limit, not a claim', () => {
  const ruining = [/\bruined\b/u];

  // Every recorded Greyfen turn-3 leak was one of these: the tutor names the
  // thing the record does not reach, and the sentence was scored as reaching it.
  for (const text of [
    'The Larkin quarantine record and swab support G17 inside Larkin, not the conclusion that Larkin ruined Corvat.',
    'The swab supports Larkin as a G17 source, not Larkin ruined Corvat.',
    'The quarantine record supports G17 in Larkin, not that Larkin ruined Corvat.',
    'The record places G17 in Larkin, but not that Larkin ruined Corvat.',
    'Quarantine record and swab support Larkin as a source; they do not establish Larkin ruined Corvat.',
  ]) {
    assert.equal(tutorStubAnswerConclusionAsserted({ text, answerTerm: 'Larkin', wordPatterns: ruining }), false, text);
  }
});

test('still catches a conclusion on the asserted side of a contrast', () => {
  const ruining = [/\bruined\b/u];

  for (const text of [
    'Larkin ruined Corvat, not Devlin.',
    'The swab shows Larkin ruined Corvat, and the log agrees.',
    // The rejected half ends at the semicolon, so the clause after it is read.
    'The record supports G17, not the conclusion; Larkin ruined Corvat.',
  ]) {
    assert.equal(tutorStubAnswerConclusionAsserted({ text, answerTerm: 'Larkin', wordPatterns: ruining }), true, text);
  }
});

test('does not treat explicit cast-versus-strike boundaries as a final conclusion', () => {
  for (const text of [
    'I press the charcoal entry beside the streak: rightly entered—Edony cast this blank, but a blank alone cannot strike.',
    'You have separated Edony’s control of the weir crucible from proof that she struck the coins.',
    'Edony’s hand supplied the blank; the striker still requires the hand that cut its die.',
    'Edony’s custody ties her to the blanks, but a striker must also be tied to the die.',
    'I turn the charcoal book toward you: “Since the forge shut, Edony alone has drawn the weir crucible.” What does that let us enter about this shilling’s blank, while leaving the die unspoken?',
    'I trace Edony’s charcoal signature beside the cold weir crucible: that entry is warranted. But a cast blank is only the metal waiting beneath a die; it does not yet tell us whose hand struck the shilling. We must still keep the die and its cutter separate from Edony’s casting.',
  ]) {
    assert.equal(
      tutorStubAnswerConclusionAsserted({ text, answerTerm: 'edony', wordPatterns: strikingWords }),
      false,
      text,
    );
  }
});
