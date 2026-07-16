import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TUTOR_STUB_SOURCE_ACCESSIBILITY_AUDIT_SCHEMA,
  TUTOR_STUB_SOURCE_ACCESSIBILITY_CONTRACT_SCHEMA,
  auditTutorStubSourceAccessibilityCompensation,
  compileTutorStubSourceAccessibilityContract,
  tutorStubSourceAccessibilityInstruction,
} from '../services/tutorStubSourceAccessibilityContract.js';

const RAVENSMARK_SOURCE =
  "The private-seal register has one entry for the dusk-seal: Elian, night notary of the lower quay, drew it for curfew warrants and returned it chipped at the raven's wing the morning after the coffer left town.";
const RAVENSMARK_COMPENSATION =
  'Elian drew it for curfew warrants and returned it chipped after the coffer left town.';

function configuration(overrides = {}) {
  return {
    audience_register: 'domain_apprentice',
    lexical_accessibility: 'standard',
    source_accessibility_owner: 'performance_response',
    ...overrides,
  };
}

function source(text, overrides = {}) {
  return { id: 'source_1', mode: 'presented_exhibit', surface: text, text, ...overrides };
}

function compensatedContract(overrides = {}) {
  return compileTutorStubSourceAccessibilityContract({
    sources: [source(RAVENSMARK_SOURCE)],
    configuration: configuration(overrides),
    policy: 'direct_or_compensated_v1',
  });
}

function auditText({
  contract = compensatedContract(),
  compensation = RAVENSMARK_COMPENSATION,
  prefix = 'I open the register. ',
  gap = ' ',
  suffix = '',
  owner = contract.owner,
} = {}) {
  const exactSource = contract.compensation.source_text;
  const text = `${prefix}${exactSource}${gap}${compensation}${suffix}`;
  const sourceStart = text.indexOf(exactSource);
  const compensationStart = text.indexOf(compensation, sourceStart + exactSource.length);
  return auditTutorStubSourceAccessibilityCompensation({
    contract,
    text,
    owner,
    sourceSpan: { start: sourceStart, end: sourceStart + exactSource.length },
    compensationSpan: {
      start: compensationStart,
      end: compensationStart + compensation.length,
    },
  });
}

test('direct-only policy remains inert for an accessible source', () => {
  const contract = compileTutorStubSourceAccessibilityContract({
    sources: [source('The noon ledger names Mara.')],
    configuration: configuration(),
  });

  assert.equal(contract.schema, TUTOR_STUB_SOURCE_ACCESSIBILITY_CONTRACT_SCHEMA);
  assert.equal(contract.policy, 'direct_only');
  assert.equal(contract.ok, true);
  assert.equal(contract.effective_mode, 'direct');
  assert.equal(contract.direct_accessible, true);
  assert.equal(contract.compensation_required, false);
  assert.equal(contract.compensation_contract_ready, false);
  assert.equal(contract.compensation, null);
  assert.equal(tutorStubSourceAccessibilityInstruction(contract), '');
});

test('direct-only policy preserves the V28 fail-closed result for a dense source', () => {
  const contract = compileTutorStubSourceAccessibilityContract({
    sources: [source(RAVENSMARK_SOURCE)],
    configuration: configuration(),
    policy: 'direct_only',
  });

  assert.equal(contract.ok, false);
  assert.equal(contract.effective_mode, 'blocked');
  assert.equal(contract.direct_accessible, false);
  assert.equal(contract.compensation_required, false);
  assert.deepEqual(contract.issues, ['direct_source_inaccessible']);
});

test('opt-in policy compiles one generic extractive compensation contract', () => {
  const contract = compensatedContract();

  assert.equal(contract.ok, true);
  assert.equal(contract.effective_mode, 'compensated');
  assert.equal(contract.compensation_required, true);
  assert.equal(contract.compensation_contract_ready, true);
  assert.equal(contract.owner, 'performance_response');
  assert.equal(contract.compensation.max_words, 23);
  assert.equal(contract.compensation.min_material_source_tokens, 4);
  assert.match(contract.compensation.feasibility_witness, /^Elian drew it/iu);
  assert.ok(contract.compensation.source_relation_tokens.includes('drew'));
  assert.deepEqual(contract.compensation.allowed_added_tokens, ['a', 'an', 'the']);
  assert.ok(contract.compensation.fact_derived_anchors.includes('elian'));
  assert.match(tutorStubSourceAccessibilityInstruction(contract), /PERFORMANCE RESPONSE/u);
  assert.match(tutorStubSourceAccessibilityInstruction(contract), /at most 23 words/u);
  assert.doesNotMatch(tutorStubSourceAccessibilityInstruction(contract), /Elian|Ravensmark/u);
});

test('compiler fails closed on an explicit unsupported compensation owner', () => {
  const contract = compensatedContract({ source_accessibility_owner: 'uptake' });

  assert.equal(contract.ok, false);
  assert.equal(contract.effective_mode, 'blocked');
  assert.equal(contract.owner, null);
  assert.ok(contract.issues.includes('unsupported_compensation_owner'));
});

test('V1 owner is explicit and the compiler never infers it from source content', () => {
  const contract = compensatedContract({ source_accessibility_owner: 'post_source_sentence' });

  assert.equal(contract.owner, 'post_source_sentence');
  assert.equal(contract.compensation.owner, 'post_source_sentence');
  assert.match(tutorStubSourceAccessibilityInstruction(contract), /first complete sentence/u);
});

test('compensation fails closed for multiple dense sources or a multi-sentence source', () => {
  const multiple = compileTutorStubSourceAccessibilityContract({
    sources: [source(RAVENSMARK_SOURCE), source(`${RAVENSMARK_SOURCE} Again.`, { id: 'source_2' })],
    configuration: configuration(),
    policy: 'direct_or_compensated_v1',
  });
  assert.equal(multiple.ok, false);
  assert.equal(multiple.effective_mode, 'blocked');
  assert.ok(multiple.issues.includes('compensation_requires_exactly_one_source'));

  const multiSentence = compileTutorStubSourceAccessibilityContract({
    sources: [source(`${RAVENSMARK_SOURCE} ${RAVENSMARK_SOURCE}`)],
    configuration: configuration(),
    policy: 'direct_or_compensated_v1',
  });
  assert.equal(multiSentence.ok, false);
  assert.equal(multiSentence.effective_mode, 'blocked');
  assert.ok(multiSentence.issues.includes('source_must_be_one_sentence'));
});

test('Ravensmark regression accepts an exact adjacent extractive compensation', () => {
  const audit = auditText();

  assert.equal(audit.schema, TUTOR_STUB_SOURCE_ACCESSIBILITY_AUDIT_SCHEMA);
  assert.equal(audit.ok, true);
  assert.equal(audit.visible, true);
  assert.equal(audit.effective_mode, 'compensated');
  assert.equal(audit.checks.source_exact_once, true);
  assert.equal(audit.checks.immediately_after_source, true);
  assert.equal(audit.checks.ordered_extractive_subsequence, true);
  assert.equal(audit.checks.fact_derived_anchor, true);
  assert.equal(audit.checks.within_audience_budget, true);
  assert.equal(audit.checks.within_lexical_budget, true);
  assert.ok(audit.material_source_tokens.length >= 4);
});

test('audit rejects added people, objects, numbers, and reordered source claims', () => {
  for (const compensation of [
    'Elian and Mara drew it for curfew warrants and returned it chipped after the coffer left town.',
    'Elian drew WF-22 for curfew warrants and returned it chipped after the coffer left town.',
    'Elian drew the key for curfew warrants and returned it chipped after the coffer left town.',
    'Elian returned it chipped and drew it for curfew warrants.',
  ]) {
    const audit = auditText({ compensation });
    assert.equal(audit.ok, false, compensation);
    assert.ok(
      audit.issues.includes('compensation_not_ordered_source_subsequence'),
      `${compensation}: ${audit.issues.join(', ')}`,
    );
  }
});

test('audit licenses only articles as added grammar without consuming later source order', () => {
  const denseSource =
    'Mara filed seal beside quay after midnight while wardens watched shutters close and lanterns dim across every upper room before the final bell sounded beneath the old stone arch.';
  const contract = compileTutorStubSourceAccessibilityContract({
    sources: [source(denseSource)],
    configuration: configuration({
      audience_register: 'adult_novice',
      lexical_accessibility: 'plain',
    }),
    policy: 'direct_or_compensated_v1',
  });
  const audit = auditText({ contract, compensation: 'Mara filed the seal beside quay.' });

  assert.equal(audit.ok, true, audit.issues.join(', '));
  assert.deepEqual(audit.added_article_tokens.map((row) => row.token), ['the']);
});

test('audit preserves no, only, and may with their source-bound terms', () => {
  const qualifiedSource =
    'Only Elian may draw the dusk seal for curfew warrants, while no clerk can carry the seal beyond the quay after midnight because the coffer remains locked beneath the northern archive stair.';
  const contract = compileTutorStubSourceAccessibilityContract({
    sources: [source(qualifiedSource)],
    configuration: configuration(),
    policy: 'direct_or_compensated_v1',
  });
  const valid = auditText({
    contract,
    compensation: 'Only Elian may draw the dusk seal; no clerk can carry the seal.',
  });
  assert.equal(valid.ok, true, valid.issues.join(', '));
  assert.equal(valid.checks.qualifiers_preserved, true);

  const lost = auditText({
    contract,
    compensation: 'Elian draw the dusk seal; clerk can carry the seal.',
  });
  assert.equal(lost.ok, false);
  assert.ok(lost.issues.includes('source_qualifier_not_preserved'));

  const added = auditText({
    compensation:
      'Only Elian drew it for curfew warrants and returned it chipped after the coffer left town.',
  });
  assert.equal(added.ok, false);
  assert.ok(added.issues.includes('compensation_not_ordered_source_subsequence'));
});

test('audit rejects a full copy, an over-budget extract, and a generic fragment', () => {
  const full = auditText({ compensation: RAVENSMARK_SOURCE });
  assert.equal(full.ok, false);
  assert.ok(full.issues.includes('compensation_copies_full_source'));

  const long = auditText({
    compensation:
      'The private-seal register has one entry for the dusk-seal Elian night notary of the lower quay drew it for curfew warrants and returned it chipped at.',
  });
  assert.equal(long.ok, false);
  assert.ok(long.issues.includes('compensation_exceeds_audience_budget'));
  assert.ok(long.issues.includes('compensation_exceeds_lexical_budget'));

  const generic = auditText({ compensation: 'Elian drew it.' });
  assert.equal(generic.ok, false);
  assert.ok(generic.issues.includes('insufficient_material_source_tokens'));
});

test('ordered noun fragments cannot impersonate a complete source-derived clause', () => {
  for (const compensation of [
    'register dusk-seal Elian notary.',
    'Elian notary curfew warrants.',
  ]) {
    const audit = auditText({ compensation });
    assert.equal(audit.ok, false, compensation);
    assert.ok(
      audit.issues.includes('compensation_must_be_complete_relational_clause'),
      `${compensation}: ${audit.issues.join(', ')}`,
    );
  }
});

test('compiler derives semantic constraints from authored surface rather than enacted wrapper text', () => {
  const authored =
    'Mara filed the seal beside the quay after midnight while wardens watched the shutters close before the bell sounded beneath the old stone arch.';
  const contract = compileTutorStubSourceAccessibilityContract({
    sources: [
      source(`“I give this account: ${authored}”`, {
        mode: 'enacted_role',
        surface: authored,
      }),
    ],
    configuration: configuration(),
    policy: 'direct_or_compensated_v1',
  });

  assert.equal(contract.ok, true, contract.issues.join(', '));
  assert.equal(contract.compensation.semantic_source_text, authored);
  assert.ok(!contract.compensation.source_material_tokens.includes('account'));
  assert.ok(!contract.compensation.fact_derived_anchors.includes('give'));
  const wrapperOnly = auditText({
    contract,
    compensation: 'I give this account.',
  });
  assert.equal(wrapperOnly.ok, false);
  assert.ok(wrapperOnly.issues.includes('compensation_not_ordered_source_subsequence'));
});

test('preflight readiness proves a bounded relational witness and blocks noun-list sources', () => {
  const impossible = compileTutorStubSourceAccessibilityContract({
    sources: [
      source(
        'Register dusk-seal Elian notary lower quay curfew warrants raven wing morning coffer town archive ledger midnight harbour office corridor chamber doorway staircase lantern window courtyard warehouse.',
      ),
    ],
    configuration: configuration(),
    policy: 'direct_or_compensated_v1',
  });

  assert.equal(impossible.ok, false);
  assert.equal(impossible.effective_mode, 'blocked');
  assert.ok(impossible.issues.includes('missing_source_relation'));

  const contract = compensatedContract();
  const witness = contract.compensation.feasibility_witness;
  const witnessAudit = auditText({ contract, compensation: witness });
  assert.equal(witnessAudit.ok, true, witnessAudit.issues.join(', '));
  assert.equal(witnessAudit.checks.complete_relational_clause, true);
});

test('audit requires one unquoted declarative sentence directly after the source', () => {
  const nonAdjacent = auditText({ gap: ' An interruption crosses the room. ' });
  assert.equal(nonAdjacent.ok, false);
  assert.ok(nonAdjacent.issues.includes('compensation_not_immediately_after_source'));

  const quoted = auditText({ compensation: `“${RAVENSMARK_COMPENSATION}”` });
  assert.equal(quoted.ok, false);
  assert.ok(quoted.issues.includes('compensation_must_be_unquoted'));

  const question = auditText({
    compensation:
      'Elian drew it for curfew warrants and returned it chipped after the coffer left town?',
  });
  assert.equal(question.ok, false);
  assert.ok(question.issues.includes('compensation_must_be_declarative'));

  const ownerMismatch = auditText({ owner: 'post_source_sentence' });
  assert.equal(ownerMismatch.ok, false);
  assert.ok(ownerMismatch.issues.includes('compensation_owner_mismatch'));
});

test('a curly possessive apostrophe is not mistaken for quotation', () => {
  const compensation =
    'Elian drew it for curfew warrants and returned it chipped at the raven’s wing.';
  const audit = auditText({ compensation });

  assert.equal(audit.ok, true, audit.issues.join(', '));
  assert.equal(audit.checks.unquoted, true);
});

test('direct contracts audit uniformly without asking for compensation spans', () => {
  const contract = compileTutorStubSourceAccessibilityContract({
    sources: [source('The noon ledger names Mara.')],
    configuration: configuration(),
  });
  const audit = auditTutorStubSourceAccessibilityCompensation({ contract });

  assert.equal(audit.active, false);
  assert.equal(audit.ok, true);
  assert.equal(audit.visible, true);
  assert.equal(audit.effective_mode, 'direct');
});

test('unsupported policies throw instead of silently widening delivery', () => {
  assert.throws(
    () =>
      compileTutorStubSourceAccessibilityContract({
        sources: [source(RAVENSMARK_SOURCE)],
        configuration: configuration(),
        policy: 'best_effort',
      }),
    /unsupported tutor source accessibility policy/u,
  );
});
