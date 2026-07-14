import assert from 'node:assert/strict';
import test from 'node:test';

import { auditTutorStubEvidenceAssertions } from '../tutorStubEvidenceAssertion.js';

test('rejects a newly invented positive match between exhibits', () => {
  const audit = auditTutorStubEvidenceAssertions({
    text: 'I press both streaks to the touchstone; they match, copper-grey and lead-sweated.',
    permittedText:
      'The shillings are struck coin of poor dross. The broad graver on Verrell’s bench is his alone.',
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

test('allows questions, requirements, conditions, and explicit non-matches', () => {
  for (const text of [
    'Which streak must match the crucible leavings?',
    'If the alloy matches, the crucible would matter.',
    'The shilling has not yet been matched to any crucible leavings.',
    'We need to look for a mark that corresponds to this tool.',
    'We still need the shilling’s alloy to answer to its leavings.',
    'The tool is tied to Verrell, not yet to this coin.',
    'Yet I object to one phrase: no shared flaw has been proved, nor has any flaw been matched to that graver.',
    'You have kept the graver tied to die-cutting without treating it as proof of the striking hand.',
    'I turn a shilling beneath the lens, seeking a die-flaw that can answer to this broad graver.',
  ]) {
    assert.equal(auditTutorStubEvidenceAssertions({ text }).ok, true, text);
  }
});

test('ignores conversational agreement that is not an exhibit correspondence', () => {
  assert.equal(
    auditTutorStubEvidenceAssertions({ text: 'Your answer matches the distinction we entered.' }).ok,
    true,
  );
});

test('ignores an attribution conclusion that uses tied to without asserting an exhibit match', () => {
  assert.equal(
    auditTutorStubEvidenceAssertions({
      text: 'Edony’s hand is tied to casting these blanks, but the shilling’s die remains unaccounted for.',
    }).ok,
    true,
  );
});

test('ignores an explicit tool-custody boundary that is not an exhibit match', () => {
  assert.equal(
    auditTutorStubEvidenceAssertions({
      text: 'You have kept the graver tied to its owner without pretending it has marked this coin.',
    }).ok,
    true,
  );
});
