/**
 * Shared core for the normative/descriptive adaptation layer
 * (docs/adaptation-refinement/normative-adaptive-dialogue-architecture.md).
 *
 * One implementation of the decision-time learner-signal classifier and the
 * warrant rules, used by BOTH the offline trace replayer
 * (scripts/derive-adaptive-warrant-shadow.js) and the live gate
 * (services/tutorStubWarrantGate.js). Rule provenance and calibration history:
 * docs/adaptation-refinement/gold-annotations-first-corpus.md.
 */

import { createHash } from 'node:crypto';

import { recommendRepairPolicy } from './adaptiveWarrantPolicy.js';

export const ADAPTIVE_WARRANT_CORE_SCHEMA = 'machinespirits.adaptation-refinement.warrant-core.v3';
export const ADAPTIVE_WARRANT_DECISION_INPUT_SCHEMA = 'machinespirits.adaptation-refinement.warrant-decision-input.v2';

export const REPETITION_DEFEATER_THRESHOLD = 0.35;
export const ACCUMULATED_TROUBLE_THRESHOLD = 2;
export const REGISTER_ESCALATION_THRESHOLD = 2;
export const CONCEPTUAL_STALL_TURNS = 2;

const REPAIR_REQUEST_PATTERN =
  /\bwhat are you talking about\b|\bwhat do you mean\b|\bdon'?t understand\b|\bno sense\b|\bmakes? no sense\b|\bmaking no sense\b|\bhow am i supposed to (?:learn|understand)\b|\bexplain (?:it |this )?(?:more )?simpl[iy]\b|\bsimpler\b/iu;
const STALL_PATTERN = /^(?:i have )?no idea\.?$|^idk\b.?$|^dunno\b.?$|^not sure\.?$|^i don'?t know\.?$/iu;
const REGISTER_COMPLAINT_PATTERN =
  /\bsound(?:ing)? like a lawyer\b|\bthis is (?:really )?(?:annoying|boring)\b|\bannoying\b|\bstop (?:talking|sounding) like\b/iu;
const REPETITION_COMPLAINT_PATTERN = /\b(?:you'?re? |you are )?repeat(?:ing|ed)\b/iu;
const ANALYTIC_MARKER_PATTERN =
  /\b(?:but|still|not|need|support|evidence|criteri|establish|baseline|because|unless|until|justify|require)\b/iu;
// Permission-framed deferral (ontology request type: resistance_or_low_agency).
// Start-anchored on purpose: an utterance that LEADS with the permission modal
// defers the whole move ("May I keep the entry that…"), while one that leads
// with content and only appends a recording request ("It supports X; may I
// write that…") made a claim first and stays analytic. Deference neither masks
// accumulated trouble nor immediately warrants.
const DEFERENCE_PATTERN =
  /^(?:may|might|should|shall|could|can|would) (?:i|we)\s+(?:add|enter|keep|note|put|record|repeat|say|use|write)\b|^(?:would|could|will|can) you (?:have|like|choose|pick|decide)\b|^do you want (?:me|us) to\b|^is it (?:all right|ok(?:ay)?) if (?:i|we)\b/iu;

/**
 * A warranted response-level correction is not automatically a change to the
 * held pedagogical commitment. Public-obligation fulfilment and candidate
 * safety vetoes repair the current candidate; terminal and pedagogical
 * transitions change the family that should govern what follows.
 */
export function isAdaptiveWarrantCommitmentTransition({
  warrant = null,
  strategyInForce = null,
  recommendedActionFamily = null,
} = {}) {
  if (!warrant?.revision_warranted || !strategyInForce || !recommendedActionFamily) return false;
  if (!['pedagogical_commitment_transition', 'terminal_transition'].includes(warrant.decision_kind)) return false;
  return recommendedActionFamily !== strategyInForce;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, canonicalJson(value[key])]),
  );
}

function decisionPriorOutcome(outcome) {
  if (!outcome) return null;
  return {
    schema: outcome.schema || null,
    turn: Number(outcome.turn) || null,
    action_family: outcome.action_family || outcome.actionFamily || null,
    action_contract: outcome.action_contract || outcome.actionContract || null,
    uptake_ok: outcome.uptake_ok ?? outcome.uptakeOk ?? null,
    repetition_max_similarity: outcome.repetition_max_similarity ?? outcome.repetitionMaxSimilarity ?? null,
    deterministic_fallback: Boolean(outcome.deterministic_fallback ?? outcome.deterministicFallback),
    mechanical_repair: Boolean(outcome.mechanical_repair ?? outcome.mechanicalRepair),
    guard_outcome: outcome.guard_outcome || outcome.guardOutcome || null,
    pacing_signal: outcome.pacing_signal || outcome.pacingSignal || null,
    tutor_text: String(outcome.tutor_text || outcome.tutorText || ''),
    released_evidence: outcome.released_evidence || outcome.releasedEvidence || [],
    delivered_response_configuration:
      outcome.delivered_response_configuration || outcome.deliveredResponseConfiguration || null,
    delivered_response_configuration_provenance:
      outcome.delivered_response_configuration_provenance ||
      outcome.deliveredResponseConfigurationProvenance ||
      null,
    defeaters: Array.isArray(outcome.defeaters) ? [...outcome.defeaters] : [],
  };
}

/**
 * Serializable pre-gate boundary for exact replay and future frozen-prefix
 * branching. It contains only decision-time inputs; outputs live beside it.
 */
export function buildAdaptiveWarrantDecisionInputSnapshot({
  turn,
  learnerText = '',
  classification = null,
  dagModel = null,
  priorActionFamily = null,
  proposedActionFamily = null,
  dialogueClosureFrame = null,
  evidenceAvailability = null,
  pacingSignal = null,
  publicObligationBefore = null,
  priorTurnOutcome = null,
  boundedInquiryScope = null,
  unsupportedAssertionCount = 0,
  activeDroppedFactCount = 0,
  releasedEvidenceIntegrated = true,
  reducerStateBefore = null,
  currentReducerInputs = null,
} = {}) {
  const snapshot = canonicalJson({
    schema: ADAPTIVE_WARRANT_DECISION_INPUT_SCHEMA,
    turn: Number(turn),
    learner_text: String(learnerText || ''),
    classification,
    learner_dag_model: dagModel,
    prior_delivered_action_family: priorActionFamily || null,
    pre_gate_proposed_action_family: proposedActionFamily || null,
    dialogue_closure_frame: dialogueClosureFrame,
    evidence_availability: evidenceAvailability,
    pacing_signal: pacingSignal,
    public_obligation_before: publicObligationBefore,
    prior_turn_outcome: decisionPriorOutcome(priorTurnOutcome),
    bounded_inquiry_scope: boundedInquiryScope,
    unsupported_assertion_count: Number(unsupportedAssertionCount || 0),
    active_dropped_fact_count: Number(activeDroppedFactCount || 0),
    released_evidence_integrated: releasedEvidenceIntegrated === true,
    reducer_state_before: reducerStateBefore,
    current_reducer_inputs: currentReducerInputs,
  });
  return {
    snapshot,
    sha256: createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),
  };
}

/**
 * Classify a learner turn as a decision-time signal. Multi-label where it
 * matters; `primary` carries the strongest label for the warrant rule.
 */
export function classifyLearnerSignal(text) {
  const surface = String(text || '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (!surface) return { primary: 'absent', labels: [], surface };
  const labels = [];
  if (REPAIR_REQUEST_PATTERN.test(surface)) labels.push('repair_request');
  if (STALL_PATTERN.test(surface)) labels.push('stall');
  if (REGISTER_COMPLAINT_PATTERN.test(surface)) labels.push('register_complaint');
  if (REPETITION_COMPLAINT_PATTERN.test(surface)) labels.push('repetition_complaint');
  if (DEFERENCE_PATTERN.test(surface)) labels.push('low_agency_deferral');
  const tokenCount = surface.split(/\s+/u).length;
  if (!labels.length && tokenCount >= 10 && ANALYTIC_MARKER_PATTERN.test(surface)) {
    labels.push('engaged_analytic');
  }
  if (!labels.length) labels.push('neutral');
  const priority = [
    'repair_request',
    'stall',
    'register_complaint',
    'repetition_complaint',
    'low_agency_deferral',
    'engaged_analytic',
    'neutral',
  ];
  const primary = priority.find((label) => labels.includes(label));
  return { primary, labels, surface };
}

/**
 * Evaluate the warrant for a decision point, and when warranted attach the
 * Phase-3 repair-policy recommendation.
 *
 *  - signal: decision-time learner signal (classifyLearnerSignal output)
 *  - signalConsumed: a carried signal already answered by a revision
 *  - troubleTurns: prior tutor turns in the current strategy streak that carry
 *    defeaters ([{turn, defeaters}])
 *  - complaintTurns: learner register-complaint turns inside the streak
 *  - deferenceSustained: last three decision-time signals all permission-framed
 *  - divergence: typed divergence rows (for the policy choice)
 *  - strategyInForce: action family held through the prior turn
 *  - actionContract: expected-uptake lifecycle outcome for strategyInForce
 *  - publicObligation: persistent learner-to-tutor public-result debt
 *  - inquiryCompletion: structural whole-inquiry terminal assessment
 *  - proposedActionFamily: builder candidate, used only for hard safety vetoes
 */
export function evaluateWarrant({
  signal,
  signalConsumed = false,
  troubleTurns = [],
  complaintTurns = [],
  deferenceSustained = false,
  divergence = [],
  strategyInForce = null,
  actionContract = null,
  publicObligation = null,
  inquiryCompletion = null,
  proposedActionFamily = null,
} = {}) {
  const masked = signal?.primary === 'engaged_analytic';
  const blockingObligation = publicObligation?.blocking_obligation || null;
  const obligationRevision = Boolean(blockingObligation);
  const terminalTransition = inquiryCompletion?.transition?.kind === 'terminal_transition';
  const unsafeClosureCandidate = Boolean(
    proposedActionFamily === 'close_inquiry' && inquiryCompletion?.status !== 'complete',
  );
  const contractRevision = actionContract?.transition?.revision_warranted === true;
  const priorityContractRevision = contractRevision && ['success', 'defeat'].includes(actionContract?.status);
  const contractSuccess = actionContract?.status === 'success';
  const immediate = !signalConsumed && (signal?.primary === 'repair_request' || signal?.primary === 'stall');
  const registerEscalation = complaintTurns.length >= REGISTER_ESCALATION_THRESHOLD;
  const accumulated = !contractSuccess && !masked && troubleTurns.length >= ACCUMULATED_TROUBLE_THRESHOLD;
  const revisionWarranted =
    immediate ||
    obligationRevision ||
    terminalTransition ||
    unsafeClosureCandidate ||
    priorityContractRevision ||
    registerEscalation ||
    accumulated ||
    contractRevision;
  const registerRevisionWarranted = complaintTurns.length >= 1;
  const warrantBasis = immediate
    ? `immediate:${signal.primary}`
    : obligationRevision
      ? `public_obligation_${blockingObligation.status}:${blockingObligation.id}`
      : terminalTransition
        ? `inquiry_complete:${inquiryCompletion.basis}`
        : unsafeClosureCandidate
          ? `inquiry_incomplete_candidate:${inquiryCompletion?.blockers?.[0] || inquiryCompletion?.status || 'unknown'}`
          : priorityContractRevision
            ? `contract_${actionContract.status}:${strategyInForce}:${actionContract.reason}`
            : registerEscalation
              ? `register_escalation:${complaintTurns.length}_complaints`
              : accumulated
                ? `accumulated:${troubleTurns.length}_trouble_turns`
                : contractRevision
                  ? `contract_${actionContract.status}:${strategyInForce}:${actionContract.reason}`
                  : masked && troubleTurns.length >= ACCUMULATED_TROUBLE_THRESHOLD
                    ? 'masked_by_engaged_analytic'
                    : 'none';
  const policy = revisionWarranted
    ? recommendRepairPolicy({
        signal,
        warrantBasis,
        divergence,
        strategyInForce,
        deferenceSustained,
        actionContract,
        publicObligation,
        inquiryCompletion,
        proposedActionFamily,
      })
    : null;
  return {
    schema: ADAPTIVE_WARRANT_CORE_SCHEMA,
    masked,
    immediate,
    accumulated,
    decision_kind: immediate
      ? 'pedagogical_commitment_transition'
      : terminalTransition
        ? 'terminal_transition'
        : obligationRevision
          ? 'public_obligation_fulfilment'
          : unsafeClosureCandidate
            ? 'candidate_safety_override'
            : revisionWarranted
              ? 'pedagogical_commitment_transition'
              : 'hold',
    register_escalation: registerEscalation,
    public_obligation_revision: obligationRevision,
    terminal_transition: terminalTransition,
    unsafe_closure_candidate: unsafeClosureCandidate,
    contract_revision: contractRevision,
    revision_warranted: revisionWarranted,
    register_revision_warranted: registerRevisionWarranted,
    warrant_basis: warrantBasis,
    action_contract: actionContract,
    public_obligation: publicObligation,
    inquiry_completion: inquiryCompletion,
    policy,
  };
}
