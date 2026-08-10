/**
 * Live adaptive warrant gate for the tutor stub (Phase 5 of
 * docs/adaptation-refinement/normative-adaptive-dialogue-architecture.md).
 *
 * Consulted at response-configuration selection, BEFORE the tutor's turn-N
 * response is generated — the decision-time evidence window: learner turn N,
 * the learner-DAG record as of turn N, and the gate's own memory of prior
 * turns. Shares its classifier and warrant rules with the offline trace
 * replayer via services/adaptiveWarrantGateCore.js.
 *
 * Modes (env TUTOR_STUB_WARRANT_GATE):
 *   off     — gate absent (default; behaviour identical to before)
 *   observe — gate assesses and records every decision, never intervenes
 *   active  — as observe, plus: when a revision is warranted and the policy
 *             recommends a different action family, the gate overrides the
 *             proposed family and stance for that turn
 *
 * Post-turn outcomes are recorded after tutor turn N commits and consumed at
 * decision point N+1. This gives the live gate the same evidence window as the
 * offline shadow: learner turn N+1, learner-record growth through N+1, and
 * final uptake/repetition/repair/pacing outcomes through tutor turn N.
 */

import { isDeepStrictEqual } from 'node:util';

import {
  classifyLearnerSignal,
  buildAdaptiveWarrantDecisionInputSnapshot,
  evaluateWarrant,
  CONCEPTUAL_STALL_TURNS,
  REPETITION_DEFEATER_THRESHOLD,
} from './adaptiveWarrantGateCore.js';
import { hashAdaptiveWarrantJson } from './adaptiveWarrantDeliveryContract.js';
import {
  createAdaptiveWarrantActionContractTracker,
  getAdaptiveWarrantActionContract,
} from './adaptiveWarrantActionContracts.js';
import {
  assessAdaptiveWarrantInquiryCompletion,
  projectAdaptiveWarrantEvidenceAvailability,
} from './adaptiveWarrantInquiryCompletion.js';
import { buildAdaptiveWarrantObligationDirective } from './adaptiveWarrantPolicy.js';
import { createAdaptiveWarrantPublicObligationLedger } from './adaptiveWarrantPublicObligationLedger.js';

export const TUTOR_STUB_WARRANT_GATE_SCHEMA = 'machinespirits.tutor-stub.warrant-gate.v4';
export const TUTOR_STUB_WARRANT_GATE_OUTCOME_SCHEMA = 'machinespirits.tutor-stub.warrant-gate-outcome.v3';
export const TUTOR_STUB_WARRANT_GATE_FINAL_AUTHORITY_AUDIT_SCHEMA =
  'machinespirits.tutor-stub.warrant-gate-final-authority-audit.v1';
export const TUTOR_STUB_WARRANT_GATE_OUTCOME_CONFIGURATION_PROJECTION_SCHEMA =
  'machinespirits.tutor-stub.warrant-gate-outcome-configuration-projection.v1';
export const TUTOR_STUB_WARRANT_GATE_MODES = Object.freeze(['off', 'observe', 'active']);

export function resolveTutorStubWarrantGateMode(value = process.env.TUTOR_STUB_WARRANT_GATE) {
  const mode = String(value || 'off')
    .trim()
    .toLowerCase();
  if (!mode || mode === '0' || mode === 'off') return 'off';
  if (!TUTOR_STUB_WARRANT_GATE_MODES.includes(mode)) {
    throw new Error(`TUTOR_STUB_WARRANT_GATE must be one of ${TUTOR_STUB_WARRANT_GATE_MODES.join('|')}, got "${mode}"`);
  }
  return mode;
}

/**
 * Reassert an active normative gate decision after optional policy layers have
 * run. Point-of-action, typed-action, and conversational-completion policies
 * may propose candidates, but they cannot silently displace a warranted
 * commitment. Evidence, closure, and response guards still audit the realized
 * turn after this boundary.
 */
function changedTopLevelFields(current = {}, frozen = {}, excluded = []) {
  const excludedFields = new Set(excluded);
  return [...new Set([...Object.keys(current || {}), ...Object.keys(frozen || {})])]
    .filter((field) => !excludedFields.has(field))
    .filter((field) => !isDeepStrictEqual(current?.[field], frozen?.[field]))
    .sort();
}

/**
 * A delivered configuration may contain the current final-authority proof,
 * whose two selection snapshots in turn contain the current decision input.
 * Carrying that complete proof into the next reducer outcome recursively nests
 * every earlier proof and makes trace size grow exponentially. The next
 * decision needs the delivered configuration, not a copy of its evidence
 * envelope, so retain a digest-bound projection of that envelope instead.
 */
export function projectTutorStubWarrantGateOutcomeConfiguration(configuration = null) {
  if (!configuration) return { configuration: null, provenance: null };
  const projected = structuredClone(configuration);
  const enforcement = projected.adaptive_warrant_enforcement || null;
  const finalAuthorityAudit = enforcement?.final_authority_audit || null;
  if (!finalAuthorityAudit) return { configuration: projected, provenance: null };
  delete enforcement.final_authority_audit;
  return {
    configuration: projected,
    provenance: {
      schema: TUTOR_STUB_WARRANT_GATE_OUTCOME_CONFIGURATION_PROJECTION_SCHEMA,
      omitted_field: 'adaptive_warrant_enforcement.final_authority_audit',
      omitted_schema: finalAuthorityAudit.schema || null,
      omitted_sha256: hashAdaptiveWarrantJson(finalAuthorityAudit),
    },
  };
}

export function enforceTutorStubWarrantGateFinalAuthority(
  selection,
  decision = selection?.warrant_gate || null,
  { frozenPreOptionalSelection = null } = {},
) {
  const desiredActionFamily =
    decision?.mode === 'active' && decision?.revision_warranted === true ? decision?.policy?.family || null : null;
  if (!selection || !desiredActionFamily) return selection;
  const responseConfiguration = selection.response_configuration || null;
  const frozenSelection = frozenPreOptionalSelection ? structuredClone(frozenPreOptionalSelection) : null;
  const frozenResponseConfiguration = frozenSelection?.response_configuration || null;
  if (frozenResponseConfiguration && frozenResponseConfiguration.action_family !== desiredActionFamily) {
    throw new Error(
      `Adaptive warrant final authority expected frozen action family ${desiredActionFamily}, got ${
        frozenResponseConfiguration.action_family || 'none'
      }`,
    );
  }
  const displacedActionFamily = responseConfiguration?.action_family || selection.action_family || null;
  const obligationDirective =
    decision.obligation_directive ||
    frozenResponseConfiguration?.public_obligation_directive ||
    responseConfiguration?.public_obligation_directive ||
    null;
  const reason = `Active adaptive warrant final authority: ${decision.warrant_basis || 'typed warrant'}.`;
  const displacedResponseConfigurationFields = frozenResponseConfiguration
    ? changedTopLevelFields(responseConfiguration, frozenResponseConfiguration, ['adaptive_warrant_enforcement'])
    : [];
  const displacedSelectionFields = frozenSelection
    ? changedTopLevelFields(selection, frozenSelection, [
        'adaptive_warrant_enforcement',
        'response_configuration',
        'warrant_gate',
      ])
    : [];
  const finalAuthorityAudit = frozenSelection
    ? {
        schema: TUTOR_STUB_WARRANT_GATE_FINAL_AUTHORITY_AUDIT_SCHEMA,
        pre_final_selection: structuredClone(selection),
        frozen_pre_optional_selection: structuredClone(frozenSelection),
      }
    : null;
  const enforcement = {
    schema: 'machinespirits.tutor-stub.warrant-gate-final-authority.v2',
    applied: true,
    desired_action_family: desiredActionFamily,
    displaced_action_family:
      displacedActionFamily && displacedActionFamily !== desiredActionFamily ? displacedActionFamily : null,
    warrant_basis: decision.warrant_basis || null,
    decision_kind: decision.decision_kind || null,
    configuration_source: frozenResponseConfiguration
      ? 'frozen_pre_optional_gate_configuration'
      : 'legacy_action_family_patch',
    configuration_restored: Boolean(frozenResponseConfiguration),
    optional_configuration_displaced: Boolean(
      displacedResponseConfigurationFields.length || displacedSelectionFields.length,
    ),
    displaced_response_configuration_fields: displacedResponseConfigurationFields,
    displaced_selection_fields: displacedSelectionFields,
    final_authority_audit: finalAuthorityAudit,
  };
  if (frozenResponseConfiguration) {
    const restoredResponseConfiguration = {
      ...structuredClone(frozenResponseConfiguration),
      action_family: desiredActionFamily,
      public_obligation_directive: obligationDirective ? structuredClone(obligationDirective) : null,
      adaptive_warrant_enforcement: enforcement,
      compatibility: {
        ...(frozenResponseConfiguration.compatibility || {}),
        pre_final_warrant_action_family: displacedActionFamily,
        final_authority_configuration_source: enforcement.configuration_source,
      },
    };
    return {
      ...frozenSelection,
      warrant_gate: decision,
      action_family: desiredActionFamily,
      adaptive_warrant_enforcement: enforcement,
      response_configuration: restoredResponseConfiguration,
    };
  }
  return {
    ...selection,
    action_family: desiredActionFamily,
    adaptive_warrant_enforcement: enforcement,
    response_configuration: responseConfiguration
      ? {
          ...responseConfiguration,
          action_family: desiredActionFamily,
          public_obligation_directive: obligationDirective
            ? structuredClone(obligationDirective)
            : responseConfiguration.public_obligation_directive || null,
          adaptive_warrant_enforcement: enforcement,
          selection_reasons: {
            ...(responseConfiguration.selection_reasons || {}),
            action_family: reason,
          },
          compatibility: {
            ...(responseConfiguration.compatibility || {}),
            pre_final_warrant_action_family: displacedActionFamily,
          },
        }
      : responseConfiguration,
  };
}

function dagTotal(dagModel) {
  const record = dagModel?.learnerRecord || {};
  const grounded = Array.isArray(record.grounded) ? record.grounded.length : 0;
  const voiced = Array.isArray(record.voicedDerived) ? record.voicedDerived.length : 0;
  return grounded + voiced;
}

export function createTutorStubWarrantGate({ mode = 'observe' } = {}) {
  const history = [];
  let strategyInForce = null;
  let strategySince = null;
  let troubleTurns = [];
  let complaintTurns = [];
  let previousDagTotal = null;
  let turnsSinceDagGrowth = 0;
  let boundedInquiryScopeAtDecision = null;
  const pendingOutcomes = new Map();
  const actionContracts = createAdaptiveWarrantActionContractTracker();
  const publicObligations = createAdaptiveWarrantPublicObligationLedger();

  return {
    schema: TUTOR_STUB_WARRANT_GATE_SCHEMA,
    mode,

    /**
     * Freeze the final, delivered outcome of tutor turn N. It remains pending
     * until decision N+1, because only then can it be combined with the next
     * learner-record observation without leaking post-decision information
     * backward into turn N.
     */
    recordTurnOutcome({
      turn,
      actionFamily = null,
      uptakeAudit = null,
      repetitionAudit = null,
      deterministicFallback = false,
      mechanicalRepair = false,
      guardAccounting = null,
      pacingSignal = null,
      tutorText = '',
      releasedEvidence = [],
      deliveredResponseConfiguration = null,
    } = {}) {
      const normalizedTurn = Number(turn);
      if (!Number.isFinite(normalizedTurn) || normalizedTurn < 1) {
        throw new Error('warrant-gate turn outcome requires a positive turn number');
      }
      const uptakeOk = uptakeAudit ? uptakeAudit.ok !== false && (uptakeAudit.issues || []).length === 0 : null;
      const maxSimilarity = Number(repetitionAudit?.maxSimilarity);
      const defeaters = [];
      if (uptakeOk === false) defeaters.push('uptake_audit_issues');
      if (Number.isFinite(maxSimilarity) && maxSimilarity >= REPETITION_DEFEATER_THRESHOLD) {
        defeaters.push(`repetition:${maxSimilarity.toFixed(2)}`);
      }
      if (deterministicFallback) defeaters.push('tutor_response_fallback');
      if (mechanicalRepair) defeaters.push('tutor_response_mechanical_repair');
      if (guardAccounting?.outcome === 'guard_exhausted_without_public_delivery') {
        defeaters.push('tutor_response_guard_exhausted');
      }
      if (pacingSignal?.direction && pacingSignal.direction !== 'steady') {
        defeaters.push(`pacing_signal:${pacingSignal.direction}`);
      }
      const deliveredConfigurationProjection = projectTutorStubWarrantGateOutcomeConfiguration(
        deliveredResponseConfiguration,
      );
      const outcome = {
        schema: TUTOR_STUB_WARRANT_GATE_OUTCOME_SCHEMA,
        turn: normalizedTurn,
        action_family: actionFamily || null,
        action_contract: getAdaptiveWarrantActionContract(actionFamily),
        uptake_ok: uptakeOk,
        repetition_max_similarity: Number.isFinite(maxSimilarity) ? maxSimilarity : null,
        deterministic_fallback: Boolean(deterministicFallback),
        mechanical_repair: Boolean(mechanicalRepair),
        guard_outcome: guardAccounting?.outcome || null,
        pacing_signal: pacingSignal || null,
        tutor_text: String(tutorText || ''),
        released_evidence: structuredClone(Array.isArray(releasedEvidence) ? releasedEvidence : []),
        delivered_response_configuration: deliveredConfigurationProjection.configuration,
        delivered_response_configuration_provenance: deliveredConfigurationProjection.provenance,
        defeaters: [...new Set(defeaters)],
      };
      pendingOutcomes.set(normalizedTurn, outcome);
      return outcome;
    },

    /**
     * Assess the decision point at tutor turn N. priorActionFamily is the
     * family of the PREVIOUS turn's delivered selection (null on turn 1).
     */
    assess({
      turn,
      learnerText = '',
      classification = null,
      dagModel = null,
      priorActionFamily = null,
      proposedActionFamily = null,
      dialogueClosureFrame = null,
      evidenceAvailability = null,
      boundedInquiryScope = null,
      unsupportedAssertionCount = 0,
      activeDroppedFactCount = 0,
      releasedEvidenceIntegrated = true,
    } = {}) {
      const priorTurn = turn - 1;
      boundedInquiryScopeAtDecision = boundedInquiryScope ? structuredClone(boundedInquiryScope) : null;
      const priorTurnOutcome = pendingOutcomes.get(priorTurn) || null;
      const publicObligationBefore = publicObligations.snapshot();
      const reducerStateBefore = {
        strategy_in_force: strategyInForce,
        strategy_since_turn: strategySince,
        previous_dag_total: previousDagTotal,
        turns_since_dag_growth: turnsSinceDagGrowth,
        trouble_turns: structuredClone(troubleTurns),
        complaint_turns: [...complaintTurns],
        recent_signals: history.slice(-2).map((row) => structuredClone(row.signal)),
        action_contract_state: actionContracts.snapshot(),
        pending_prior_turn_outcome: priorTurnOutcome,
        public_obligation_ledger: publicObligationBefore,
      };

      // Strategy streak bookkeeping: a family change (by whatever mechanism)
      // resets the trouble and complaint pools.
      if (priorActionFamily && priorActionFamily !== strategyInForce) {
        strategyInForce = priorActionFamily;
        strategySince = turn;
        troubleTurns = [];
        complaintTurns = [];
      }

      const signal = classifyLearnerSignal(learnerText);
      const total = dagTotal(dagModel);
      const dagGrowth = previousDagTotal === null ? null : total - previousDagTotal;
      previousDagTotal = total;
      if (dagGrowth !== null) turnsSinceDagGrowth = dagGrowth > 0 ? 0 : turnsSinceDagGrowth + 1;
      // Final audits for tutor turn N-1 and learner-record growth observed at
      // decision N describe one outcome row. Add it only after a possible
      // family-change reset: the outcome belongs to the family actually
      // delivered on N-1, not to the older family that preceded it.
      const priorTurnDefeaters = [...(priorTurnOutcome?.defeaters || [])];
      if (dagGrowth !== null && dagGrowth <= 0) priorTurnDefeaters.push('no_dag_growth');
      if (priorTurn >= 1 && priorTurnDefeaters.length) {
        troubleTurns.push({ turn: priorTurn, defeaters: [...new Set(priorTurnDefeaters)] });
      }
      pendingOutcomes.delete(priorTurn);
      if (signal.labels.includes('register_complaint')) complaintTurns.push(turn);

      const publicObligation = publicObligations.assess({
        turn,
        learnerText,
        classification,
        priorTutorOutcome: priorTurnOutcome,
      });
      const inquiryCompletion = assessAdaptiveWarrantInquiryCompletion({
        dagModel,
        classification,
        closureFrame: dialogueClosureFrame,
        evidenceAvailability,
        publicObligation,
        boundedScope: boundedInquiryScopeAtDecision,
        unsupportedAssertionCount,
        activeDroppedFactCount,
        releasedEvidenceIntegrated,
      });
      const recentSignals = [...history.slice(-2).map((row) => row.signal), signal];
      const deferenceSustained =
        recentSignals.length === 3 && recentSignals.every((s) => s.labels.includes('low_agency_deferral'));

      const masked = signal.primary === 'engaged_analytic';
      const divergence = [];
      if (turnsSinceDagGrowth >= CONCEPTUAL_STALL_TURNS) {
        divergence.push({
          dimension: 'conceptual',
          magnitude: turnsSinceDagGrowth >= 4 ? 'high' : 'moderate',
          persistence: turnsSinceDagGrowth,
          interpretation: masked ? 'productive' : 'stalled',
          repair_warranted: !masked,
        });
      }
      const actionContract = actionContracts.assess({
        turn,
        actionFamily: strategyInForce,
        learnerText,
        classification,
        signal,
        dagGrowth,
      });
      if (actionContract?.transition?.discharge_prior_trouble) troubleTurns = [];
      const decisionInput = buildAdaptiveWarrantDecisionInputSnapshot({
        turn,
        learnerText,
        classification,
        dagModel,
        priorActionFamily: strategyInForce,
        proposedActionFamily,
        dialogueClosureFrame,
        evidenceAvailability,
        publicObligationBefore,
        priorTurnOutcome,
        boundedInquiryScope: boundedInquiryScopeAtDecision,
        unsupportedAssertionCount,
        activeDroppedFactCount,
        releasedEvidenceIntegrated,
        reducerStateBefore,
        currentReducerInputs: {
          strategy_in_force: strategyInForce,
          strategy_since_turn: strategySince,
          learner_signal: signal,
          dag_total: total,
          dag_growth: dagGrowth,
          turns_since_dag_growth: turnsSinceDagGrowth,
          trouble_turns: structuredClone(troubleTurns),
          complaint_turns: [...complaintTurns],
          recent_signals: recentSignals.map((row) => structuredClone(row)),
          deference_sustained: deferenceSustained,
          divergence,
          action_contract: actionContract,
          public_obligation: publicObligation,
          inquiry_completion: inquiryCompletion,
        },
      });
      const warrant = evaluateWarrant({
        signal,
        signalConsumed: false,
        troubleTurns,
        complaintTurns,
        deferenceSustained,
        divergence,
        strategyInForce,
        actionContract,
        publicObligation,
        inquiryCompletion,
        proposedActionFamily,
      });

      const recommendedActionFamily = warrant.policy?.family || null;
      const commitmentTransitionWarranted = Boolean(
        warrant.revision_warranted &&
        strategyInForce &&
        recommendedActionFamily &&
        recommendedActionFamily !== strategyInForce,
      );
      const candidateOverrideRequired = Boolean(
        warrant.revision_warranted && recommendedActionFamily && recommendedActionFamily !== proposedActionFamily,
      );
      const override =
        mode === 'active' && candidateOverrideRequired
          ? {
              action_family: recommendedActionFamily,
              engagement_stance: warrant.policy.stance_hint || 'plain',
              reason: `Adaptive warrant gate: ${warrant.warrant_basis} — ${warrant.policy.rationale}`,
            }
          : null;
      const obligationDirective = mode === 'active' ? buildAdaptiveWarrantObligationDirective(publicObligation) : null;

      const decision = {
        schema: TUTOR_STUB_WARRANT_GATE_SCHEMA,
        mode,
        turn,
        strategy_in_force: strategyInForce,
        prior_delivered_action_family: strategyInForce,
        pre_gate_proposed_action_family: proposedActionFamily || null,
        strategy_since_turn: strategySince,
        learner_signal: signal,
        dag_total: total,
        dag_growth: dagGrowth,
        prior_turn_outcome: priorTurnOutcome,
        turns_since_dag_growth: turnsSinceDagGrowth,
        trouble_turns: troubleTurns.map((row) => row.turn),
        complaint_turns: [...complaintTurns],
        deference_sustained: deferenceSustained,
        action_contract: actionContract,
        public_obligation: publicObligation,
        public_obligation_before: publicObligationBefore,
        inquiry_completion: inquiryCompletion,
        bounded_inquiry_scope: boundedInquiryScopeAtDecision,
        input_snapshot: decisionInput.snapshot,
        input_digest: decisionInput.sha256,
        divergence,
        decision_kind: warrant.decision_kind,
        revision_warranted: warrant.revision_warranted,
        commitment_transition_warranted: commitmentTransitionWarranted,
        current_candidate_override_required: candidateOverrideRequired,
        register_revision_warranted: warrant.register_revision_warranted,
        warrant_basis: warrant.warrant_basis,
        policy: warrant.policy,
        obligation_directive: obligationDirective,
        override,
      };
      history.push({ turn, signal, decision });
      return decision;
    },

    decisions() {
      return history.map((row) => row.decision);
    },

    snapshot() {
      return {
        schema: TUTOR_STUB_WARRANT_GATE_SCHEMA,
        mode,
        strategy_in_force: strategyInForce,
        strategy_since_turn: strategySince,
        previous_dag_total: previousDagTotal,
        turns_since_dag_growth: turnsSinceDagGrowth,
        trouble_turns: structuredClone(troubleTurns),
        complaint_turns: [...complaintTurns],
        bounded_inquiry_scope: boundedInquiryScopeAtDecision ? structuredClone(boundedInquiryScopeAtDecision) : null,
        public_obligation_ledger: publicObligations.snapshot(),
        decisions: history.map((row) => structuredClone(row.decision)),
      };
    },
  };
}

/** Rebuild all reducer state from committed public turn records. */
export function restoreTutorStubWarrantGateFromTurns(gate, turns = []) {
  if (!gate || !Array.isArray(turns) || !turns.length) return gate;
  let priorDeliveredActionFamily = null;
  for (const record of turns) {
    const turn = Number(record?.turn);
    if (!Number.isFinite(turn) || turn < 1) continue;
    const delivered = record.deliveredResponseConfiguration || record.responseConfiguration || null;
    const deliveredActionFamily =
      delivered?.action_family ||
      record.registerSelection?.action_family ||
      record.responseConfiguration?.action_family ||
      null;
    const storedDecision = record.warrantGateDecision || record.registerSelection?.warrant_gate || null;
    const storedInput = storedDecision?.input_snapshot || null;
    const storedCompletionChecks = storedDecision?.inquiry_completion?.checks || {};
    gate.assess({
      turn,
      learnerText: storedInput?.learner_text ?? record.learner ?? '',
      classification: storedInput?.classification || record.classification || null,
      dagModel: storedInput?.learner_dag_model || record.tutorLearnerDagModel || null,
      priorActionFamily: priorDeliveredActionFamily,
      proposedActionFamily: storedDecision?.pre_gate_proposed_action_family || deliveredActionFamily,
      dialogueClosureFrame: storedInput?.dialogue_closure_frame || record.dialogueClosure?.frame || null,
      evidenceAvailability:
        storedInput?.evidence_availability ||
        projectAdaptiveWarrantEvidenceAvailability(record.releasePacing, { turn }),
      boundedInquiryScope: Object.hasOwn(storedInput || {}, 'bounded_inquiry_scope')
        ? storedInput.bounded_inquiry_scope
        : storedDecision?.bounded_inquiry_scope || null,
      unsupportedAssertionCount: Number(
        storedInput?.unsupported_assertion_count ||
          record.tutorLearnerDagModel?.assessment?.unsupportedAssertionCount ||
          storedCompletionChecks.unsupported_assertion_count ||
          0,
      ),
      activeDroppedFactCount: Number(
        storedInput?.active_dropped_fact_count ||
          record.tutorLearnerDagModel?.memoryReliability?.activeDroppedCount ||
          record.dagFactDropout?.activeCount ||
          0,
      ),
      releasedEvidenceIntegrated:
        storedInput?.released_evidence_integrated !== undefined
          ? storedInput.released_evidence_integrated === true
          : storedCompletionChecks.released_evidence_integrated !== undefined
            ? storedCompletionChecks.released_evidence_integrated === true
            : record.tutorLearnerDagModel?.assessment?.bottleneck !== 'learner_integration_gap',
    });
    gate.recordTurnOutcome({
      turn,
      actionFamily: deliveredActionFamily,
      uptakeAudit: record.tutorLiveTurnProgressionAudit || null,
      repetitionAudit: record.tutorRepetitionAudit || null,
      deterministicFallback: Boolean(record.tutorDeterministicFallback),
      mechanicalRepair: Boolean(record.tutorMechanicalRepair),
      guardAccounting: record.tutorGuardAccounting || null,
      pacingSignal: record.releasePacing?.signal || null,
      tutorText: record.tutor || '',
      releasedEvidence: record.dramaticRelease?.frame?.entries || [],
      deliveredResponseConfiguration: delivered,
    });
    priorDeliveredActionFamily = deliveredActionFamily;
  }
  return gate;
}

/**
 * Lazily attach a gate to the session state. Returns null when the gate is
 * off, so the selection runtime stays on its existing path untouched.
 */
export function ensureTutorStubWarrantGate(state, { mode = resolveTutorStubWarrantGateMode() } = {}) {
  if (mode === 'off') return null;
  if (!state.warrantGate) {
    state.warrantGate = createTutorStubWarrantGate({ mode });
    restoreTutorStubWarrantGateFromTurns(state.warrantGate, state.turns || []);
  }
  return state.warrantGate;
}

/** Record a completed tutor-turn outcome only when a live gate is attached. */
export function recordTutorStubWarrantGateOutcome(state, outcome = {}) {
  if (!state?.warrantGate?.recordTurnOutcome) return null;
  return state.warrantGate.recordTurnOutcome(outcome);
}
