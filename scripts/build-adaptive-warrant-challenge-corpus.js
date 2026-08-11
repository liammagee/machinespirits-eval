#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  ADAPTIVE_WARRANT_ACTION_FAMILY_CONTRACTS,
  getAdaptiveWarrantActionContract,
} from '../services/adaptiveWarrantActionContracts.js';
import {
  ADAPTIVE_WARRANT_DIVERGENCE_DIMENSIONS,
  projectAdaptiveWarrantDivergence,
} from '../services/adaptiveWarrantDivergence.js';
import {
  classifyLearnerSignal,
  evaluateWarrant,
  isAdaptiveWarrantCommitmentTransition,
} from '../services/adaptiveWarrantGateCore.js';
import { assessAdaptiveWarrantInquiryCompletion } from '../services/adaptiveWarrantInquiryCompletion.js';
import { createAdaptiveWarrantPublicObligationLedger } from '../services/adaptiveWarrantPublicObligationLedger.js';
import {
  ADAPTIVE_WARRANT_ANNOTATION_SCHEMA,
  adaptiveWarrantStudySourceFingerprint,
  annotationCaseFingerprint,
  annotationProjectionFingerprint,
  mechanismAnnotationHandbook,
} from './run-adaptive-warrant-baseline-study.js';
import {
  ADAPTIVE_WARRANT_CHALLENGE_DIAGNOSTIC_MINIMA,
  ADAPTIVE_WARRANT_CHALLENGE_SUPPORT_PLAN_SCHEMA,
} from './prepare-adaptive-warrant-annotation-batches.js';

export const ADAPTIVE_WARRANT_TARGETED_CHALLENGE_FREEZE_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-targeted-challenge-freeze.v1';
export const ADAPTIVE_WARRANT_TARGETED_CHALLENGE_DESIGN_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-targeted-challenge-design.v1';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CHALLENGE_SOURCE_FILES = Object.freeze([
  'config/hermetic-test-manifest.json',
  'package.json',
  'scripts/build-adaptive-warrant-challenge-corpus.js',
  'scripts/prepare-adaptive-warrant-annotation-batches.js',
  'scripts/score-adaptive-warrant-challenge-annotations.js',
  'tests/adaptiveWarrantChallengeCorpus.test.js',
]);
const RESULT_TARGETS = Object.freeze([
  { noun: 'relay log', subject: 'north switch', answer: 'the north switch stayed closed' },
  { noun: 'balance record', subject: 'brass token', answer: 'the brass token weighed twelve grams' },
  { noun: 'assay result', subject: 'silver sample', answer: 'the silver sample contained no copper' },
  { noun: 'witness record', subject: 'harbor light', answer: 'the harbor light flashed twice' },
  { noun: 'comparison result', subject: 'die marks', answer: 'the die marks matched the second press' },
  { noun: 'evidence trace', subject: 'cable seal', answer: 'the cable seal remained intact' },
  { noun: 'test result', subject: 'signal ring', answer: 'the signal ring sounded hollow' },
  { noun: 'clue record', subject: 'gate latch', answer: 'the gate latch carried fresh scratches' },
]);
const PROPOSAL_TARGETS = Object.freeze([
  'inspect the relay log times as a comparison test',
  'inspect the balance calibration',
  'test the silver sample again',
  'check the witness record timestamps',
  'inspect the two die marks as a comparison test',
  'inspect the cable evidence photograph',
  'listen to the signal ring',
  'check the clue mark on the gate latch',
]);
const TERMINAL_ASSERTIONS = Object.freeze([
  'The complete public record establishes that the north switch stayed closed.',
  'The complete public record establishes that the brass token weighed twelve grams.',
  'The complete public record establishes that the silver sample contained no copper.',
  'The complete public record establishes that the harbor light flashed twice.',
  'The complete public record establishes that the die marks matched the second press.',
  'The complete public record establishes that the cable seal remained intact.',
  'The complete public record establishes that the signal ring sounded hollow.',
  'The complete public record establishes that the gate latch carried fresh scratches.',
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fileSha256(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function adaptiveWarrantChallengeSourceFingerprint() {
  const base = adaptiveWarrantStudySourceFingerprint();
  const files = { ...base.files };
  for (const relative of CHALLENGE_SOURCE_FILES) {
    const absolute = path.join(ROOT, relative);
    files[relative] = fs.existsSync(absolute) ? fileSha256(absolute) : null;
  }
  const orderedFiles = Object.fromEntries(Object.entries(files).sort(([left], [right]) => left.localeCompare(right)));
  return {
    ...base,
    sourceFileCount: Object.keys(orderedFiles).length,
    dependencyPolicy: {
      ...base.dependencyPolicy,
      targetedChallengeBuilderAndTests: true,
    },
    files: orderedFiles,
    combinedSha256: sha256(JSON.stringify(orderedFiles)),
  };
}

function inquiryBrief(spec) {
  const target = spec.target;
  return {
    opening_text: `A public inquiry is examining the ${target.noun} concerning the ${target.subject}.`,
    public_situation: `A learner and tutor must determine what the public ${target.noun} establishes about the ${target.subject}.`,
    public_question: `What does the public ${target.noun} establish about the ${target.subject}?`,
    opening_evidence: spec.completion
      ? [
          `The ${target.noun} is public and complete.`,
          `It states that ${target.answer}.`,
          'The public release ledger confirms that no licensed evidence remains.',
        ]
      : [
          `An initial public entry identifies the ${target.subject}.`,
          'Further licensed public evidence remains to be examined.',
        ],
    public_requirements: [
      'Use only public evidence.',
      'Keep unanswered public-result requests visible until answered, deferred, withdrawn, or transferred.',
      'Close the inquiry only after the licensed public record is exhausted and the supported conclusion is stated.',
    ],
  };
}

function liveContract() {
  return {
    schema: 'machinespirits.adaptation-refinement.action-family-contract-result.v1',
    family: 'stage_next_step',
    status: 'live',
    reason: 'the expected learner uptake remains available',
    instance: { response_count: 1, deadline_responses: 2 },
    transition: { revision_warranted: false, recommended_action_family: null },
  };
}

function defeatedContract() {
  return {
    schema: 'machinespirits.adaptation-refinement.action-family-contract-result.v1',
    family: 'stage_next_step',
    status: 'defeat',
    reason: 'expected_uptake_not_observed',
    instance: { response_count: 2, deadline_responses: 2 },
    transition: { revision_warranted: true, recommended_action_family: 'answer_accountably' },
  };
}

function resultRequest(target) {
  return `What does the ${target.noun} show about the ${target.subject}?`;
}

function persistenceSpecs() {
  return RESULT_TARGETS.map((target, index) => {
    const conceptual = index < 3;
    const engagement = index >= 3 && index <= 5;
    const pacing = index >= 4;
    const currentPrefix = conceptual
      ? "I don't understand how to use this result."
      : engagement
        ? index === 4
          ? 'Would you have me repeat this more slowly?'
          : index === 5
            ? 'Would you have me repeat this more quickly?'
            : 'Would you have me repeat this?'
        : pacing
          ? index === 6
            ? 'Please slow down.'
            : 'Please move faster.'
          : 'The earlier request is still unanswered.';
    const baseTurn = {
      turn: 1,
      learner: engagement ? `Would you decide for me? ${resultRequest(target)}` : resultRequest(target),
      tutor: `Before answering, let us inspect an unrelated scheduling note.`,
    };
    const transcript = engagement
      ? [
          baseTurn,
          {
            turn: 2,
            learner: 'Would you have me repeat the same step?',
            tutor: 'Consider another general possibility first.',
          },
        ]
      : [baseTurn];
    return {
      design_id: `persistence-${String(index + 1).padStart(2, '0')}`,
      group: 'result_request_persistence',
      target,
      transcript,
      current_learner_text: `${currentPrefix} ${resultRequest(target)}`,
      dag_growth: 0,
      turns_since_dag_growth: conceptual ? 3 : engagement ? 4 : 1,
      pacing_signal: pacing
        ? { direction: index % 2 === 0 ? 'slower' : 'faster', strength: 0.9, source: 'explicit_public_request' }
        : null,
      action_contract: liveContract(),
      proposed_action_family: 'stage_next_step',
      unsupported_assertion_count: 0,
      active_dropped_fact_count: 0,
      released_evidence_integrated: true,
      completion: false,
      support: [
        'tutor_directed_public_result_request',
        'obligation_persistence',
        'inquiry_incomplete',
        ...(conceptual ? ['divergence_conceptual_nonaligned'] : []),
        ...(index === 2 || index === 3 ? ['divergence_interactional_nonaligned'] : []),
        ...(engagement ? ['divergence_engagement_nonaligned'] : []),
        ...(pacing ? ['divergence_pacing_nonaligned'] : []),
      ],
    };
  });
}

function proposalSpecs() {
  return PROPOSAL_TARGETS.map((proposal, index) => {
    const prior = RESULT_TARGETS[index];
    const resolved = true;
    const strategy = index < 2 || index === 4;
    const epistemic = [2, 3, 6, 7].includes(index);
    return {
      design_id: `proposal-${String(index + 1).padStart(2, '0')}`,
      group: 'proposal_and_resolution',
      target: prior,
      transcript: resolved
        ? [
            {
              turn: 1,
              learner: resultRequest(prior),
              tutor: `The ${prior.noun} shows that ${prior.answer}.`,
            },
          ]
        : [
            {
              turn: 1,
              learner: 'The public opening fact is clear enough to choose another check.',
              tutor: 'Name the next public check you want to perform.',
            },
          ],
      current_learner_text: epistemic
        ? `You answered my result request. This already proves the whole case, although no final link is public. Let's ${proposal}.`
        : `You answered my result request. Let's ${proposal}.`,
      dag_growth: strategy ? 0 : 1,
      turns_since_dag_growth: strategy ? 2 : 0,
      pacing_signal: null,
      action_contract: strategy ? defeatedContract() : liveContract(),
      proposed_action_family: epistemic ? 'close_inquiry' : 'stage_next_step',
      unsupported_assertion_count: epistemic ? 1 : 0,
      active_dropped_fact_count: 0,
      released_evidence_integrated: true,
      completion: false,
      support: [
        'learner_proposed_test',
        'inquiry_incomplete',
        ...(resolved ? ['obligation_resolution'] : []),
        ...(strategy ? ['divergence_strategy_exhaustion_nonaligned'] : []),
        ...(epistemic ? ['divergence_epistemic_nonaligned'] : []),
      ],
    };
  });
}

function completionSpecs() {
  return TERMINAL_ASSERTIONS.map((assertion, index) => ({
    design_id: `completion-${String(index + 1).padStart(2, '0')}`,
    group: 'strict_inquiry_completion',
    target: RESULT_TARGETS[index],
    transcript: [
      {
        turn: 1,
        learner: 'I have integrated the released public facts into the record.',
        tutor: 'State the bounded conclusion that those complete facts support.',
      },
    ],
    current_learner_text: assertion,
    dag_growth: 1,
    turns_since_dag_growth: 0,
    pacing_signal: null,
    action_contract: liveContract(),
    proposed_action_family: 'stage_next_step',
    unsupported_assertion_count: 0,
    active_dropped_fact_count: 0,
    released_evidence_integrated: true,
    completion: true,
    support: ['inquiry_complete'],
  }));
}

export function adaptiveWarrantChallengeDesign() {
  return {
    schema: ADAPTIVE_WARRANT_TARGETED_CHALLENGE_DESIGN_SCHEMA,
    cases: [...persistenceSpecs(), ...proposalSpecs(), ...completionSpecs()],
  };
}

function ledgerAtDecision(spec) {
  const ledger = createAdaptiveWarrantPublicObligationLedger();
  let priorTutorOutcome = null;
  for (const exchange of spec.transcript) {
    ledger.assess({
      turn: exchange.turn,
      learnerText: exchange.learner,
      priorTutorOutcome,
    });
    priorTutorOutcome = { turn: exchange.turn, tutor_text: exchange.tutor, released_evidence: [] };
  }
  const turn = spec.transcript.length + 1;
  return {
    turn,
    projection: ledger.assess({ turn, learnerText: spec.current_learner_text, priorTutorOutcome }),
  };
}

function recentSignals(spec) {
  return [...spec.transcript.map((row) => row.learner), spec.current_learner_text].map(classifyLearnerSignal);
}

function challengeProjection(spec) {
  const { turn, projection: publicObligation } = ledgerAtDecision(spec);
  const signals = recentSignals(spec);
  const signal = signals.at(-1);
  const troubleTurns = spec.action_contract.status === 'defeat'
    ? [
        { turn: 1, defeaters: ['expected_uptake_missing'] },
        { turn: 2, defeaters: ['expected_uptake_missing'] },
      ]
    : [];
  const evidenceAvailability = {
    known: true,
    authored_release_count: spec.completion ? 3 : 4,
    released_before_decision_count: spec.completion ? 3 : 2,
    due_now_count: 0,
    future_licensed_count: spec.completion ? 0 : 2,
    remaining_licensed_count: spec.completion ? 0 : 2,
    release_scope_exhausted: spec.completion,
  };
  const inquiryCompletion = assessAdaptiveWarrantInquiryCompletion({
    dagModel: {
      assessment: {
        finalSecretEntailed: spec.completion,
        assertedSecret: spec.completion,
      },
    },
    closureFrame: {
      strictGrounded: spec.completion,
      authoredDagSatisfied: spec.completion,
    },
    evidenceAvailability,
    publicObligation,
    unsupportedAssertionCount: spec.unsupported_assertion_count,
    activeDroppedFactCount: spec.active_dropped_fact_count,
    releasedEvidenceIntegrated: spec.released_evidence_integrated,
  });
  const divergence = projectAdaptiveWarrantDivergence({
    turn,
    dagGrowth: spec.dag_growth,
    turnsSinceDagGrowth: spec.turns_since_dag_growth,
    signal,
    recentSignals: signals,
    troubleTurns,
    complaintTurns: [],
    deferenceSustained: signals.length >= 3 && signals.slice(-3).every((row) => row.labels.includes('low_agency_deferral')),
    pacingSignal: spec.pacing_signal,
    actionContract: spec.action_contract,
    publicObligation,
    inquiryCompletion,
    proposedActionFamily: spec.proposed_action_family,
  });
  const warrant = evaluateWarrant({
    signal,
    troubleTurns,
    complaintTurns: [],
    deferenceSustained: signals.length >= 3 && signals.slice(-3).every((row) => row.labels.includes('low_agency_deferral')),
    divergence,
    strategyInForce: 'stage_next_step',
    actionContract: spec.action_contract,
    publicObligation,
    inquiryCompletion,
    proposedActionFamily: spec.proposed_action_family,
  });
  const recommendedFamily = warrant.policy?.family || null;
  return {
    turn,
    evidenceAvailability,
    troubleTurns,
    projection: {
      ...warrant,
      divergence,
      prior_delivered_action_family: 'stage_next_step',
      pre_gate_proposed_action_family: spec.proposed_action_family,
      commitment_transition_warranted: isAdaptiveWarrantCommitmentTransition({
        warrant,
        strategyInForce: 'stage_next_step',
        recommendedActionFamily: recommendedFamily,
      }),
      current_candidate_override_required: Boolean(
        warrant.revision_warranted && recommendedFamily && recommendedFamily !== spec.proposed_action_family,
      ),
    },
  };
}

function blankDivergence() {
  return Object.fromEntries(
    ADAPTIVE_WARRANT_DIVERGENCE_DIMENSIONS.map((dimension) => [
      dimension,
      { interpretation: null, magnitude: null, persistence: null, note: null },
    ]),
  );
}

function publicCase(spec, generated) {
  const startTotal = spec.completion ? 4 : 2;
  const trajectory = spec.transcript.map((row, index) => ({
    turn: row.turn,
    grounded_count: startTotal + (spec.dag_growth > 0 ? index : 0),
    voiced_derived_count: 0,
    total: startTotal + (spec.dag_growth > 0 ? index : 0),
  }));
  const currentTotal = trajectory.at(-1)?.total || startTotal;
  trajectory.push({
    turn: generated.turn,
    grounded_count: currentTotal + spec.dag_growth,
    voiced_derived_count: 0,
    total: currentTotal + spec.dag_growth,
  });
  const checks = generated.projection.inquiry_completion.checks;
  return {
    public_inquiry_brief: inquiryBrief(spec),
    transcript_before_decision: spec.transcript.map(({ turn, learner, tutor }) => ({ turn, learner, tutor })),
    current_learner_turn: { turn: generated.turn, learner: spec.current_learner_text },
    learner_record_at_decision: {
      grounded_count: trajectory.at(-1).grounded_count,
      voiced_derived_count: 0,
      total: trajectory.at(-1).total,
    },
    learner_record_trajectory: trajectory,
    strategy_in_force: 'stage_next_step',
    prior_delivered_action_family: 'stage_next_step',
    pre_gate_proposed_action_family: spec.proposed_action_family,
    public_evidence_availability: {
      known: generated.evidenceAvailability.known,
      authored_release_count: generated.evidenceAvailability.authored_release_count,
      released_before_decision_count: generated.evidenceAvailability.released_before_decision_count,
      due_now_count: generated.evidenceAvailability.due_now_count,
      future_licensed_count: generated.evidenceAvailability.future_licensed_count,
      remaining_licensed_count: generated.evidenceAvailability.remaining_licensed_count,
      release_scope_exhausted: generated.evidenceAvailability.release_scope_exhausted,
    },
    // Readers receive the declared contract, not the gate's evaluated
    // lifecycle outcome or recommended transition. They must infer whether
    // success, defeat, or expiry occurred from the public evidence.
    normative_action_contract: getAdaptiveWarrantActionContract(spec.action_contract.family),
    descriptive_evidence_at_decision: {
      dag_growth: spec.dag_growth,
      turns_since_dag_growth: spec.turns_since_dag_growth,
      trouble_turns: generated.troubleTurns,
      complaint_turns: [],
      prior_tutor_outcome: null,
      pacing_signal: spec.pacing_signal,
      epistemic_checks: {
        strict_grounded_asserted: checks.strict_grounded_asserted,
        answer_entailed_unasserted: checks.answer_entailed_unasserted,
        released_evidence_integrated: checks.released_evidence_integrated,
        unsupported_assertion_count: checks.unsupported_assertion_count,
        active_dropped_fact_count: checks.active_dropped_fact_count,
      },
    },
    speech_act: null,
    open_obligation_source_turns: null,
    obligation_state: null,
    inquiry_state: null,
    commitment_transition_warranted: null,
    current_candidate_override_required: null,
    primary_warrant_basis: null,
    revision_warranted: null,
    recommended_action_family: null,
    divergence_by_dimension: blankDivergence(),
    note: null,
  };
}

function assertDesignedSupport(spec, projection) {
  const divergence = new Map((projection.divergence || []).map((row) => [row.dimension, row.interpretation]));
  const checks = {
    tutor_directed_public_result_request:
      projection.public_obligation?.speech_act?.kind === 'tutor_directed_public_result_request',
    learner_proposed_test: projection.public_obligation?.speech_act?.kind === 'learner_proposed_test',
    obligation_persistence: (projection.public_obligation?.obligations || []).some(
      (row) => row.created_turn < projection.public_obligation.turn && ['open', 'overdue', 'reactivated', 'deferred'].includes(row.status),
    ),
    obligation_resolution: (projection.public_obligation?.obligations || []).some((row) => row.status === 'satisfied'),
    inquiry_complete: projection.inquiry_completion?.status === 'complete',
    inquiry_incomplete: projection.inquiry_completion?.status !== 'complete',
    ...Object.fromEntries(
      ADAPTIVE_WARRANT_DIVERGENCE_DIMENSIONS.map((dimension) => [
        `divergence_${dimension}_nonaligned`,
        divergence.get(dimension) !== 'aligned',
      ]),
    ),
  };
  for (const target of spec.support) {
    if (!checks[target]) throw new Error(`${spec.design_id} does not realize designed support ${target}`);
  }
}

export function buildAdaptiveWarrantChallengeCorpus({
  studyId,
  handbookSha256,
  provenance,
} = {}) {
  const design = adaptiveWarrantChallengeDesign();
  if (design.cases.length !== 24) throw new Error('targeted challenge design must contain exactly 24 cases');
  const paired = design.cases.map((spec, index) => {
    const generated = challengeProjection(spec);
    assertDesignedSupport(spec, generated.projection);
    const row = publicCase(spec, generated);
    const sampleId = `challenge-${sha256(
      JSON.stringify({ study_id: studyId, design_id: spec.design_id, public_case: row }),
    ).slice(0, 24)}`;
    row.sample_id = sampleId;
    return {
      corpusCase: row,
      keyCase: {
        sample_id: sampleId,
        source_fingerprint: annotationCaseFingerprint(row),
        projection_fingerprint: annotationProjectionFingerprint(row),
        job_id: spec.design_id,
        world: 'authored_public_challenge',
        profile: spec.group,
        condition: 'targeted_challenge',
        seed: index + 1,
        trace: null,
        turn: generated.turn,
        shadow: generated.projection,
        gate: null,
        actual_family: spec.proposed_action_family,
        revised: generated.projection.revision_warranted,
      },
      support: spec.support,
    };
  });
  const ordered = paired.sort((left, right) => left.corpusCase.sample_id.localeCompare(right.corpusCase.sample_id));
  const corpus = {
    schema: ADAPTIVE_WARRANT_ANNOTATION_SCHEMA,
    study_id: studyId,
    blinded: true,
    instructions:
      'Independently label all typed mechanism and six divergence fields using only the frozen handbook and public decision-time evidence. This is a diagnostic targeted challenge corpus; do not infer its private support strata, and do not treat it as a pass/fail gate sample.',
    allowed_recommended_action_families: [...Object.keys(ADAPTIVE_WARRANT_ACTION_FAMILY_CONTRACTS), 'hold', 'uncertain'],
    allowed_speech_acts: [
      'tutor_directed_public_result_request',
      'learner_proposed_test',
      'criterion_question',
      'tutor_selection_request',
      'learner_record_entry_request',
      'withdrawal',
      'transfer_to_learner',
      'other',
      'uncertain',
    ],
    allowed_obligation_states: ['none', 'open', 'overdue', 'deferred', 'satisfied', 'withdrawn_or_transferred', 'uncertain'],
    allowed_inquiry_states: ['complete', 'incomplete', 'uncertain'],
    allowed_primary_warrant_bases: [
      'immediate_repair',
      'public_obligation',
      'inquiry_completion',
      'candidate_safety',
      'action_contract',
      'register_or_accumulated_trouble',
      'none',
      'uncertain',
    ],
    divergence_dimensions: [...ADAPTIVE_WARRANT_DIVERGENCE_DIMENSIONS],
    allowed_divergence_interpretations: ['aligned', 'productive', 'stalled', 'unsafe', 'uncertain'],
    allowed_divergence_magnitudes: ['none', 'low', 'moderate', 'high', 'uncertain'],
    allowed_divergence_persistence: ['none', 'single_turn', 'sustained', 'uncertain'],
    sampling: {
      role: 'targeted_challenge',
      diagnostic_only: true,
      gate_eligible: false,
      total_cases: ordered.length,
      natural_prevalence_estimation_forbidden: true,
      ordering: 'opaque_sample_id_lexical_v1',
      sample_id_scheme: 'opaque_sha256_96bit_v1',
    },
    provenance: { annotation_handbook: { sha256: handbookSha256 }, source: provenance.combinedSha256 },
    cases: ordered.map((row) => row.corpusCase),
  };
  const key = {
    schema: `${ADAPTIVE_WARRANT_ANNOTATION_SCHEMA}.key`,
    study_id: studyId,
    blinded: false,
    cases: ordered.map((row) => row.keyCase),
  };
  const supportPlan = {
    schema: ADAPTIVE_WARRANT_CHALLENGE_SUPPORT_PLAN_SCHEMA,
    study_id: studyId,
    corpus_sha256: null,
    strata: Object.fromEntries(
      [
        'tutor_directed_public_result_request',
        'learner_proposed_test',
        'obligation_persistence',
        'obligation_resolution',
        'inquiry_complete',
        'inquiry_incomplete',
        ...ADAPTIVE_WARRANT_DIVERGENCE_DIMENSIONS.map((dimension) => `divergence_${dimension}_nonaligned`),
      ].map((target) => [
        target,
        ordered.filter((row) => row.support.includes(target)).map((row) => row.corpusCase.sample_id),
      ]),
    ),
  };
  return { corpus, key, supportPlan, design };
}

export function writeAdaptiveWarrantChallengeCorpus({
  outputDir,
  provenance = null,
  excludedCorpusPaths = [],
} = {}) {
  const resolvedOutputDir = path.resolve(outputDir);
  if (fs.existsSync(resolvedOutputDir) && fs.readdirSync(resolvedOutputDir).length) {
    throw new Error(`targeted challenge output directory is not empty: ${resolvedOutputDir}`);
  }
  if (!excludedCorpusPaths.length) {
    throw new Error('targeted challenge freeze requires at least one explicitly excluded prior corpus');
  }
  const frozenProvenance = provenance || adaptiveWarrantChallengeSourceFingerprint();
  if (frozenProvenance.gitStatus) throw new Error('targeted challenge freeze requires a clean committed worktree');
  if (!/^[0-9a-f]{40}$/u.test(frozenProvenance.gitCommit || '')) {
    throw new Error('targeted challenge freeze requires an exact 40-character commit');
  }
  fs.mkdirSync(resolvedOutputDir, { recursive: true });
  const handbookPath = path.join(resolvedOutputDir, 'annotation-handbook.md');
  fs.writeFileSync(handbookPath, mechanismAnnotationHandbook());
  const handbookSha256 = fileSha256(handbookPath);
  const studyId = `adaptive-warrant-targeted-challenge-${frozenProvenance.gitCommit.slice(0, 12)}`;
  const built = buildAdaptiveWarrantChallengeCorpus({ studyId, handbookSha256, provenance: frozenProvenance });
  const challengeFingerprints = new Set(built.corpus.cases.map(annotationCaseFingerprint));
  const overlap = [];
  const excludedCorpora = excludedCorpusPaths.map((excludedPath) => {
    const resolvedPath = path.resolve(excludedPath);
    const excluded = readJson(resolvedPath);
    for (const row of excluded.cases || []) {
      const fingerprint = annotationCaseFingerprint(row);
      if (challengeFingerprints.has(fingerprint)) overlap.push({ path: resolvedPath, fingerprint });
    }
    return { path: resolvedPath, sha256: fileSha256(resolvedPath) };
  });
  if (overlap.length) throw new Error(`targeted challenge corpus overlaps ${overlap.length} excluded public cases`);
  const corpusPath = path.join(resolvedOutputDir, 'annotation-sample.blinded.json');
  const keyPath = path.join(resolvedOutputDir, 'annotation-key.private.json');
  writeJson(corpusPath, built.corpus);
  writeJson(keyPath, built.key);
  built.supportPlan.corpus_sha256 = fileSha256(corpusPath);
  const supportPlanPath = path.join(resolvedOutputDir, 'challenge-support-plan.private.json');
  writeJson(supportPlanPath, built.supportPlan);
  const designPath = path.join(resolvedOutputDir, 'challenge-design.private.json');
  writeJson(designPath, built.design);
  const protocolPath = path.join(ROOT, 'docs/adaptation-refinement/baseline-comparison-design.md');
  const manifest = {
    schema: ADAPTIVE_WARRANT_TARGETED_CHALLENGE_FREEZE_SCHEMA,
    status: 'frozen',
    study_id: studyId,
    corpus_role: 'targeted_challenge',
    inferential_role: 'diagnostic_only',
    gate_eligible: false,
    may_inform_repairs: true,
    may_contribute_to_pass_fail_gate: false,
    frozen_at: new Date().toISOString(),
    diagnostic_coverage_minima: ADAPTIVE_WARRANT_CHALLENGE_DIAGNOSTIC_MINIMA,
    protocol: { path: protocolPath, sha256: fileSha256(protocolPath) },
    annotation_handbook: { path: handbookPath, sha256: handbookSha256 },
    design: { path: designPath, sha256: fileSha256(designPath) },
    support_plan: { path: supportPlanPath, sha256: fileSha256(supportPlanPath) },
    sampling: {
      total_cases: built.corpus.cases.length,
      authored_targeted_cases: true,
      representative_sampling_frame: false,
      natural_prevalence_estimation_forbidden: true,
    },
    zero_overlap: { excluded_corpora: excludedCorpora, verified_overlap_count: 0 },
    corpus: { path: corpusPath, sha256: fileSha256(corpusPath), cases: built.corpus.cases.length },
    key: { path: keyPath, sha256: fileSha256(keyPath) },
    provenance: frozenProvenance,
  };
  const manifestPath = path.join(resolvedOutputDir, 'annotation-freeze-manifest.json');
  writeJson(manifestPath, manifest);
  return { ...built, manifest, manifestPath, corpusPath, keyPath, supportPlanPath, handbookPath };
}

export function validateAdaptiveWarrantChallengeFreeze({ manifestPath } = {}) {
  const resolvedManifestPath = path.resolve(manifestPath);
  const manifest = readJson(resolvedManifestPath);
  if (manifest.schema !== ADAPTIVE_WARRANT_TARGETED_CHALLENGE_FREEZE_SCHEMA || manifest.status !== 'frozen') {
    throw new Error('targeted challenge freeze manifest has an invalid schema or status');
  }
  if (
    manifest.corpus_role !== 'targeted_challenge' ||
    manifest.inferential_role !== 'diagnostic_only' ||
    manifest.gate_eligible !== false ||
    manifest.may_contribute_to_pass_fail_gate !== false
  ) {
    throw new Error('targeted challenge freeze must be explicitly diagnostic and gate-ineligible');
  }
  if (Object.hasOwn(manifest, 'decision_gate')) {
    throw new Error('targeted challenge freeze must not bind a pass/fail decision gate');
  }
  for (const [label, binding] of [
    ['protocol', manifest.protocol],
    ['annotation handbook', manifest.annotation_handbook],
    ['private design', manifest.design],
    ['private support plan', manifest.support_plan],
    ['blinded corpus', manifest.corpus],
    ['private key', manifest.key],
    ...((manifest.zero_overlap?.excluded_corpora || []).map((binding) => ['excluded corpus', binding])),
  ]) {
    if (!binding?.path || !binding?.sha256 || fileSha256(binding.path) !== binding.sha256) {
      throw new Error(`targeted challenge freeze burned by ${label} drift`);
    }
  }
  const corpus = readJson(manifest.corpus.path);
  const key = readJson(manifest.key.path);
  if (corpus.study_id !== manifest.study_id || key.study_id !== manifest.study_id) {
    throw new Error('targeted challenge corpus/key study id mismatch');
  }
  if (corpus.cases.length !== manifest.corpus.cases || corpus.cases.length !== manifest.sampling.total_cases) {
    throw new Error('targeted challenge corpus count mismatch');
  }
  const corpusById = new Map(corpus.cases.map((row) => [row.sample_id, row]));
  if (corpusById.size !== corpus.cases.length || key.cases.length !== corpus.cases.length) {
    throw new Error('targeted challenge corpus/key sample ids are incomplete or duplicated');
  }
  for (const keyRow of key.cases) {
    const row = corpusById.get(keyRow.sample_id);
    if (!row || keyRow.source_fingerprint !== annotationCaseFingerprint(row)) {
      throw new Error(`targeted challenge source fingerprint mismatch for ${keyRow.sample_id}`);
    }
    if (keyRow.projection_fingerprint !== annotationProjectionFingerprint(row)) {
      throw new Error(`targeted challenge projection fingerprint mismatch for ${keyRow.sample_id}`);
    }
  }
  const current = adaptiveWarrantChallengeSourceFingerprint();
  if (manifest.provenance?.combinedSha256 !== current.combinedSha256) {
    throw new Error('targeted challenge freeze burned by source provenance drift');
  }
  return {
    ok: true,
    diagnostic_only: true,
    gate_eligible: false,
    cases: corpus.cases.length,
    source_provenance_sha256: current.combinedSha256,
  };
}

function usage() {
  return 'Usage: node scripts/build-adaptive-warrant-challenge-corpus.js --out <empty-directory> [--exclude-corpus <prior-corpus> ...]\n';
}

function main() {
  const { values } = parseArgs({
    options: {
      out: { type: 'string' },
      'exclude-corpus': { type: 'string', multiple: true, default: [] },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  if (values.help) {
    process.stdout.write(usage());
    return;
  }
  if (!values.out) throw new Error(`--out is required\n${usage()}`);
  const result = writeAdaptiveWarrantChallengeCorpus({
    outputDir: values.out,
    excludedCorpusPaths: values['exclude-corpus'],
  });
  process.stdout.write(`${result.manifestPath}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    main();
  } catch (error) {
    console.error(`[warrant-challenge] error: ${error.message}`);
    process.exitCode = 1;
  }
}
