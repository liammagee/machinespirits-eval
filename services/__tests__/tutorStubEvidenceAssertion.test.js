import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadWorld } from '../dramaticDerivation/world.js';
import { auditTutorStubEvidenceAssertions, tutorStubPrivateTokenAlreadyPublic } from '../tutorStubEvidenceAssertion.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('an inflection of a current clue word is not mistaken for future evidence', () => {
  const publicTokens = new Set(['notch', 'mended', 'square']);

  assert.equal(tutorStubPrivateTokenAlreadyPublic('notched', publicTokens), true);
  assert.equal(tutorStubPrivateTokenAlreadyPublic('unredeemed', publicTokens), false);
});

test('rejects a newly invented positive match between exhibits', () => {
  const audit = auditTutorStubEvidenceAssertions({
    text: 'I press both streaks to the touchstone; they match, copper-grey and lead-sweated.',
    permittedText: 'The shillings are struck coin of poor dross. The broad graver on Verrell’s bench is his alone.',
  });

  assert.equal(audit.ok, false);
  assert.equal(audit.issues[0].type, 'unsupported_evidence_correspondence');
});

test('allows a positive match when the public evidence already states it', () => {
  const audit = auditTutorStubEvidenceAssertions({
    text: 'The shilling’s dross matches the crucible leavings.',
    permittedText: 'That dross answers to the leavings of the weir-forge crucible.',
  });

  assert.equal(audit.ok, true);
});

test('allows a public single-die finding to be carried forward with tie language', () => {
  const audit = auditTutorStubEvidenceAssertions({
    text: 'The shared notch ties these coins to one damaged die.',
    permittedText:
      'The shared notch shows all twelve were struck from one same damaged die; it still does not show whose graver made it.',
  });

  assert.equal(audit.ok, true);
});

test('does not let a public single-die finding license an unrelated exhibit match', () => {
  const audit = auditTutorStubEvidenceAssertions({
    text: 'The shilling’s alloy matches the crucible leavings.',
    permittedText: 'The shared notch shows all twelve shillings were struck from one damaged die.',
  });

  assert.equal(audit.ok, false);
});

test('allows questions, requirements, conditions, and explicit non-matches', () => {
  for (const text of [
    'Which streak must match the crucible leavings?',
    'If the alloy matches, the crucible would matter.',
    'The shilling has not yet been matched to any crucible leavings.',
    'We need to look for a mark that corresponds to this tool.',
    'We still need the shilling’s alloy to answer to its leavings.',
    'A distinctive alloy can lead us to the crucible whose leavings match it.',
    'The missing link is a match between this alloy and one crucible’s leavings.',
    'The tool is tied to Verrell, not yet to this coin.',
    'Yet I object to one phrase: no shared flaw has been proved, nor has any flaw been matched to that graver.',
    'You have kept the graver tied to die-cutting without treating it as proof of the striking hand.',
    'I turn a shilling beneath the lens, seeking a die-flaw that can answer to this broad graver.',
    'The next safe check is a post-filing record tied to that graf.',
    'The well may tell us where to trace the water, not whom to blame.',
    'Examine a trace linking access to the jukebox.',
  ]) {
    assert.equal(auditTutorStubEvidenceAssertions({ text }).ok, true, text);
  }
});

test('keeps a sentence after an exact quoted source outside the source correspondence', () => {
  const source =
    "Fresh docking-clamp marks score the mess-hall ceiling rail, still warm. The maintenance registry matches their spacing and chipped left pad to Moth's retired courier chassis: the little drone docked there.";
  const quoted = `“I can confirm this: ${source}”`;

  assert.equal(
    auditTutorStubEvidenceAssertions({
      text: `I look at the inquiry log; ${quoted} That named public-record release is next.`,
      permittedText: source,
    }).ok,
    true,
  );
});

test('does not read the to inside a hyphenated compound as tracing one exhibit to another', () => {
  // Every recorded Nocturne turn-9 leak was this stage direction: "trace the
  // winter-to" satisfied a pattern looking for "traces ... to".
  for (const text of [
    'I trace the winter-to-thaw entry with my finger.',
    'I trace its winter-to-thaw entry with my finger.',
    'I tie the winter-to-thaw span to nothing yet.',
  ]) {
    assert.equal(auditTutorStubEvidenceAssertions({ text }).ok, true, text);
  }

  assert.equal(auditTutorStubEvidenceAssertions({ text: 'The residue traces to the weir-forge crucible.' }).ok, false);
});

test('does not carry a physical trace action across a colon into a licensed dating inference', () => {
  const text =
    'I inspect the steward\u2019s stock-book beside the marked leaf. I trace the entry: it dates the nocturne to that span.';
  const permittedText =
    'Held to the lamp, every leaf of the nocturne shows the same heron watermark \u2014 the Brell mill\u2019s mark. ' +
    'The steward\u2019s stock-book is plain: heron paper entered the copy-room in the winter of the flood, and the last of it was spent before the thaw.';

  assert.equal(auditTutorStubEvidenceAssertions({ text, permittedText }).ok, true);
  assert.equal(
    auditTutorStubEvidenceAssertions({
      text: 'I inspect the entry: the residue traces to the weir-forge crucible.',
      permittedText,
    }).ok,
    false,
  );
});

test('lets the tutor handle a named match as stage business without claiming one', () => {
  assert.equal(
    auditTutorStubEvidenceAssertions({
      text: 'I open the Larkin log and mark the match, while the contamination source remains unproved.',
    }).ok,
    true,
  );

  // A match with its two sides named is still a claim.
  assert.equal(
    auditTutorStubEvidenceAssertions({ text: 'I mark a match between this alloy and the crucible leavings.' }).ok,
    false,
  );
});

test('ignores conversational agreement that is not an exhibit correspondence', () => {
  assert.equal(auditTutorStubEvidenceAssertions({ text: 'Your answer matches the distinction we entered.' }).ok, true);
});

test('ignores an attribution conclusion that uses tied to without asserting an exhibit match', () => {
  assert.equal(
    auditTutorStubEvidenceAssertions({
      text: 'Edony’s hand is tied to casting these blanks, but the shilling’s die remains unaccounted for.',
    }).ok,
    true,
  );
});

test('allows a public tool-to-person inference without treating it as a new exhibit match', () => {
  const audit = auditTutorStubEvidenceAssertions({
    text: 'Edony’s sole keeping of the sprung-heel burin ties her to cutting the flawed die. The same hand is already tied to the weir-forge blanks.',
    permittedText:
      'That ties the damaged die to Edony’s worn burin, so she likely cut it, though it does not prove she struck the shillings.',
  });

  assert.equal(audit.ok, true);
});

test('allows a public job-number entry to support a handling attribution', () => {
  const audit = auditTutorStubEvidenceAssertions({
    text: 'The Wrenfold job number ties that 12:14 entry to their handling of Priya’s lunchbox.',
    permittedText:
      'Priya’s labelled lunchbox was logged at 12:14, tagged with the Wrenfold job number, with a shelf photo attached.',
  });

  assert.equal(audit.ok, true);
});

test('ignores an explicit tool-custody boundary that is not an exhibit match', () => {
  assert.equal(
    auditTutorStubEvidenceAssertions({
      text: 'You have kept the graver tied to its owner without pretending it has marked this coin.',
    }).ok,
    true,
  );
});

test('ignores a released burin-to-hand custody attribution', () => {
  assert.equal(
    auditTutorStubEvidenceAssertions({
      text: 'This ties that burin to Edony’s hand, though the striking remains open.',
    }).ok,
    true,
  );
});

test('accepts a same-strain conclusion only when that strain correspondence is public', () => {
  const text = 'Whole-genome typing identifies the Corvat contaminant as the same G17 strain.';
  const permittedText = 'Whole-genome typing identifies the Corvat contaminant as the same G17 strain.';

  assert.equal(auditTutorStubEvidenceAssertions({ text, permittedText }).ok, true);
  assert.equal(auditTutorStubEvidenceAssertions({ text, permittedText: '' }).ok, false);
});

test('allows world-030 correspondence wording from its released structured fact', () => {
  const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-030-rowan-flat.yaml'));
  const premise = world.premiseById.get('p_dye');
  const text = 'The dye traces a path from the hose split to the ceiling mark.';

  assert.equal(
    auditTutorStubEvidenceAssertions({ text, permittedText: premise.surface }).ok,
    false,
    'the authored plain-language surface alone reproduces the vocabulary mismatch',
  );
  assert.equal(
    auditTutorStubEvidenceAssertions({ text, permittedText: premise.surface, permittedFacts: [premise.fact] }).ok,
    true,
    'the released tracedPathTo fact licenses the same relation in different prose',
  );
  assert.equal(
    auditTutorStubEvidenceAssertions({
      text,
      permittedText: premise.surface,
      permittedFacts: [['pressureRoseDuring', 'basinFeedHose', 'kitchenCeiling']],
    }).ok,
    false,
    'shared endpoints without the asserted relation do not license the claim',
  );
  assert.equal(
    auditTutorStubEvidenceAssertions({
      text: 'The ceiling mark traces a path to the basin hose split.',
      permittedText: premise.surface,
      permittedFacts: [premise.fact],
    }).ok,
    false,
    'a directed fact does not license the same endpoints in reverse',
  );
});
