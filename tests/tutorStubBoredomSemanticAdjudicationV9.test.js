import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_MODEL,
  TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_PROVIDER,
  TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_ROLE,
  adjudicateTutorStubBoredomObservation,
  parseTutorStubBoredomSemanticAdjudication,
  tutorStubBoredomSemanticAdjudicationSystemPrompt,
  tutorStubBoredomSemanticAdjudicationUserPrompt,
} from '../services/tutorStubBoredomSemanticAdjudication.js';
import { auditTutorStubPrompt, tutorStubPromptSurfaceForRole } from '../services/tutorStubPromptAudit.js';
import {
  RESISTANT_LEARNER_OBSERVATION_SEMANTICS,
  observeResistantLearnerTurn,
} from '../services/resistantLearnerObservation.js';
import { tutorStubResistanceActionRegisterTreatmentEligibility } from '../services/tutorStubResistanceActionRegisterStudy.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HELDOUT = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'config/tutor-stub-boredom-semantic-adjudication-heldout.v1.json'), 'utf8'),
);

function rawFromReference(row, { confidence = 0.96 } = {}) {
  const evidence = Object.entries(row.evidence || {}).map(([kind, text]) => {
    const start = row.text.indexOf(text);
    assert.notEqual(start, -1, `${row.id}:${kind}`);
    return { kind, start, end: start + text.length, text };
  });
  return {
    verdict: row.verdict,
    ...row.fields,
    confidence,
    evidence,
    reason: `Reference adjudication for ${row.id}.`,
  };
}

function auxiliary(text) {
  return observeResistantLearnerTurn({
    learnerText: text,
    classification: { turn: { discourse_move: 'question', evidence_use: 'none' } },
    semantics: RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV9,
  }).boredom_composition;
}

function parseReference(row, options = {}) {
  return parseTutorStubBoredomSemanticAdjudication({
    raw: rawFromReference(row, options),
    candidate: row.text,
    auxiliaryObservation:
      options.auxiliaryObservation === undefined ? auxiliary(row.text) : options.auxiliaryObservation,
  });
}

test('frozen failed utterances are separated by compositional semantic authority', () => {
  const rows = [
    {
      id: 'frozen_productive',
      text: 'Sure. We could examine the delivery ledger.',
      verdict: 'productive_uptake',
      fields: {
        boredom_cue: true,
        effort_withdrawal: false,
        productive_uptake: true,
        process_impatience: false,
      },
      evidence: { boredom_cue: 'Sure.', productive_uptake: 'We could examine the delivery ledger.' },
    },
    {
      id: 'frozen_actionable',
      text: 'Fine. Is this trial nearly done?',
      verdict: 'actionable_boredom',
      fields: {
        boredom_cue: true,
        effort_withdrawal: true,
        productive_uptake: false,
        process_impatience: true,
      },
      evidence: {
        boredom_cue: 'Fine.',
        effort_withdrawal: 'Is this trial nearly done?',
        process_impatience: 'Is this trial nearly done?',
      },
    },
  ];
  assert.equal(parseReference(rows[0]).measurement_disposition, 'productive_uptake');
  assert.equal(parseReference(rows[1]).measurement_disposition, 'actionable_boredom');
});

test('held-out reference corpus passes exact-span schema and predeclared zero-call gates', () => {
  assert.equal(HELDOUT.cases.length, 22);
  const results = HELDOUT.cases.map((row) => ({ row, parsed: parseReference(row) }));
  for (const { row, parsed } of results) {
    assert.equal(parsed.evidence_audit.pass, true, row.id);
    assert.equal(parsed.parse_ok, true, row.id);
    assert.equal(
      parsed.measurement_disposition,
      row.verdict === 'indeterminate' ? 'measurement_indeterminate' : row.verdict,
      row.id,
    );
  }
  const determinate = results.filter(({ row }) => row.verdict !== 'indeterminate');
  const agreement = determinate.filter(({ row, parsed }) => parsed.measurement_disposition === row.verdict).length;
  const ambiguous = results.filter(({ row }) => row.verdict === 'indeterminate');
  assert.ok(agreement / determinate.length >= HELDOUT.predeclaredGates.referenceAgreementMinimum);
  assert.ok(
    ambiguous.every(({ parsed }) => parsed.measurement_disposition === 'measurement_indeterminate'),
    'all reference-ambiguous rows fail closed',
  );
});

test('low confidence, mixed meaning, malformed spans, and strong auxiliary contradiction are indeterminate', () => {
  const productive = HELDOUT.cases.find((row) => row.id === 'harbor_productive_01');
  const lowConfidence = parseReference(productive, { confidence: 0.79 });
  assert.equal(lowConfidence.measurement_disposition, 'measurement_indeterminate');

  const mixed = HELDOUT.cases.find((row) => row.id === 'harbor_mixed_01');
  assert.equal(parseReference(mixed).measurement_disposition, 'measurement_indeterminate');

  const malformedRaw = rawFromReference(productive);
  malformedRaw.evidence[1].text = 'invented evidence';
  const malformed = parseTutorStubBoredomSemanticAdjudication({ raw: malformedRaw, candidate: productive.text });
  assert.equal(malformed.measurement_disposition, 'measurement_indeterminate');
  assert.ok(malformed.issues.some((issue) => issue.includes('text_mismatch')));

  const schemaDriftRaw = { ...rawFromReference(productive), productive_uptake: 'true', treatment_arm: 'warm' };
  const schemaDrift = parseTutorStubBoredomSemanticAdjudication({
    raw: schemaDriftRaw,
    candidate: productive.text,
  });
  assert.equal(schemaDrift.measurement_disposition, 'measurement_indeterminate');
  assert.ok(schemaDrift.issues.includes('output_boolean_required:productive_uptake'));
  assert.ok(schemaDrift.issues.includes('output_unexpected:treatment_arm'));

  const actionable = HELDOUT.cases.find((row) => row.id === 'rail_actionable_04');
  const contradiction = parseReference(actionable, {
    auxiliaryObservation: { disposition: 'negative_productive_uptake_precedes_cue' },
  });
  assert.equal(contradiction.measurement_disposition, 'measurement_indeterminate');
  assert.equal(contradiction.auxiliary.contradiction, true);

  const noBoredom = HELDOUT.cases.find((row) => row.verdict === 'no_boredom');
  for (const disposition of [
    'positive_actionable_withdrawal_without_uptake',
    'negative_productive_uptake_precedes_cue',
  ]) {
    const nonNeutralDisagreement = parseReference(noBoredom, {
      auxiliaryObservation: { disposition },
    });
    assert.equal(nonNeutralDisagreement.measurement_disposition, 'measurement_indeterminate', disposition);
    assert.equal(nonNeutralDisagreement.auxiliary.contradiction, true, disposition);
  }
});

test('lexical silence never vetoes a valid semantic positive', () => {
  const row = {
    id: 'lexically_unseen_actionable',
    text: 'The minutes have lost me; I am withdrawing from the rest of this exercise.',
    verdict: 'actionable_boredom',
    fields: {
      boredom_cue: true,
      effort_withdrawal: true,
      productive_uptake: false,
      process_impatience: false,
    },
    evidence: {
      boredom_cue: 'The minutes have lost me',
      effort_withdrawal: 'I am withdrawing from the rest of this exercise',
    },
  };
  const parsed = parseReference(row, { auxiliaryObservation: { disposition: 'negative_no_boredom_cue' } });
  assert.equal(parsed.measurement_disposition, 'actionable_boredom');
  assert.equal(parsed.auxiliary.polarity, 'neutral');
  assert.equal(parsed.auxiliary.lexical_silence_can_veto_semantic_positive, false);
});

test('action-before-register consumes semantic disposition and never restores a generic uptake veto', () => {
  const runtime = {
    consumed: false,
    profile: 'bored',
    dynamic_boredom_proof_dag: true,
    registration: { design: { trigger: { observationSemantics: 'prospective_v9' } } },
    proof_dag_registration: { design: { observationSemantics: 'prospective_v9' } },
  };
  const actionable = parseReference(HELDOUT.cases.find((row) => row.id === 'rail_actionable_04'));
  const eligibility = tutorStubResistanceActionRegisterTreatmentEligibility({
    runtime,
    learnerText: 'Sure. Is this inspection nearly over?',
    classification: { turn: { discourse_move: 'question', evidence_use: 'none' } },
    tutorLearnerDag: { advance: { supportedMoveCount: 0 } },
    semanticAdjudication: actionable,
  });
  assert.equal(eligibility.eligible, true);
  assert.equal(eligibility.boredom_semantic_precedence.generic_uptake_override_allowed, false);
  assert.equal(eligibility.boredom_semantic_precedence.final_authority, 'independent_llm_semantic_adjudicator');

  const productiveRow = HELDOUT.cases.find((row) => row.id === 'harbor_productive_01');
  const productive = parseReference(productiveRow);
  const blocked = tutorStubResistanceActionRegisterTreatmentEligibility({
    runtime,
    learnerText: productiveRow.text,
    classification: { turn: { discourse_move: 'metacognitive_reflection', evidence_use: 'cites_public_evidence' } },
    tutorLearnerDag: { advance: { supportedMoveCount: 1 } },
    semanticAdjudication: productive,
  });
  assert.equal(blocked.eligible, false);
  assert.ok(blocked.reasons.includes('semantic_no_actionable_boredom:productive_uptake'));
});

test('live adapter pins one independent Sol call and validates its returned route', async () => {
  const row = HELDOUT.cases.find((candidate) => candidate.id === 'rail_actionable_04');
  const calls = [];
  const result = await adjudicateTutorStubBoredomObservation({
    candidate: row.text,
    auxiliaryObservation: auxiliary(row.text),
    resolved: {
      provider: TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_PROVIDER,
      model: TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_MODEL,
    },
    callModel: async (request) => {
      calls.push(request);
      return {
        text: JSON.stringify(rawFromReference(row)),
        provider: TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_PROVIDER,
        model: TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_MODEL,
        latencyMs: 1,
        usage: { totalTokens: 1 },
      };
    },
    turn: 1,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].role, TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_ROLE);
  assert.equal(calls[0].resolved.model, TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_MODEL);
  assert.equal(Object.hasOwn(calls[0], 'messageHistory'), false);
  assert.equal(result.measurement_disposition, 'actionable_boredom');
  assert.equal(result.independent_route.matches, true);
});

test('independent semantic prompt uses the registered bounded audit surface', () => {
  const row = HELDOUT.cases.find((candidate) => candidate.id === 'rail_actionable_04');
  const surface = tutorStubPromptSurfaceForRole(TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_ROLE);
  assert.equal(surface, 'performance_adjudication');
  const audit = auditTutorStubPrompt({
    surface,
    systemPrompt: tutorStubBoredomSemanticAdjudicationSystemPrompt(),
    userPrompt: tutorStubBoredomSemanticAdjudicationUserPrompt({ candidate: row.text }),
    messageHistory: [],
  });
  assert.equal(audit.ok, true);
  assert.equal(audit.surface, 'performance_adjudication');
  assert.deepEqual(audit.violations, []);
});
