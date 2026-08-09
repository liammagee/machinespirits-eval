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

import {
  classifyLearnerSignal,
  evaluateWarrant,
  CONCEPTUAL_STALL_TURNS,
  REPETITION_DEFEATER_THRESHOLD,
} from './adaptiveWarrantGateCore.js';
import {
  createAdaptiveWarrantActionContractTracker,
  getAdaptiveWarrantActionContract,
} from './adaptiveWarrantActionContracts.js';

export const TUTOR_STUB_WARRANT_GATE_SCHEMA = 'machinespirits.tutor-stub.warrant-gate.v3';
export const TUTOR_STUB_WARRANT_GATE_OUTCOME_SCHEMA = 'machinespirits.tutor-stub.warrant-gate-outcome.v2';
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
  const pendingOutcomes = new Map();
  const actionContracts = createAdaptiveWarrantActionContractTracker();

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
        defeaters: [...new Set(defeaters)],
      };
      pendingOutcomes.set(normalizedTurn, outcome);
      return outcome;
    },

    /**
     * Assess the decision point at tutor turn N. priorActionFamily is the
     * family of the PREVIOUS turn's delivered selection (null on turn 1).
     */
    assess({ turn, learnerText = '', classification = null, dagModel = null, priorActionFamily = null } = {}) {
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
      const priorTurn = turn - 1;
      const priorTurnOutcome = pendingOutcomes.get(priorTurn) || null;
      const priorTurnDefeaters = [...(priorTurnOutcome?.defeaters || [])];
      if (dagGrowth !== null && dagGrowth <= 0) priorTurnDefeaters.push('no_dag_growth');
      if (priorTurn >= 1 && priorTurnDefeaters.length) {
        troubleTurns.push({ turn: priorTurn, defeaters: [...new Set(priorTurnDefeaters)] });
      }
      pendingOutcomes.delete(priorTurn);
      if (signal.labels.includes('register_complaint')) complaintTurns.push(turn);

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
      const warrant = evaluateWarrant({
        signal,
        signalConsumed: false,
        troubleTurns,
        complaintTurns,
        deferenceSustained,
        divergence,
        strategyInForce,
        actionContract,
      });

      const override =
        mode === 'active' && warrant.revision_warranted && warrant.policy && warrant.policy.family !== strategyInForce
          ? {
              action_family: warrant.policy.family,
              engagement_stance: warrant.policy.stance_hint || 'plain',
              reason: `Adaptive warrant gate: ${warrant.warrant_basis} — ${warrant.policy.rationale}`,
            }
          : null;

      const decision = {
        schema: TUTOR_STUB_WARRANT_GATE_SCHEMA,
        mode,
        turn,
        strategy_in_force: strategyInForce,
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
        divergence,
        revision_warranted: warrant.revision_warranted,
        register_revision_warranted: warrant.register_revision_warranted,
        warrant_basis: warrant.warrant_basis,
        policy: warrant.policy,
        override,
      };
      history.push({ turn, signal, decision });
      return decision;
    },

    decisions() {
      return history.map((row) => row.decision);
    },
  };
}

/**
 * Lazily attach a gate to the session state. Returns null when the gate is
 * off, so the selection runtime stays on its existing path untouched.
 */
export function ensureTutorStubWarrantGate(state, { mode = resolveTutorStubWarrantGateMode() } = {}) {
  if (mode === 'off') return null;
  if (!state.warrantGate) state.warrantGate = createTutorStubWarrantGate({ mode });
  return state.warrantGate;
}

/** Record a completed tutor-turn outcome only when a live gate is attached. */
export function recordTutorStubWarrantGateOutcome(state, outcome = {}) {
  if (!state?.warrantGate?.recordTurnOutcome) return null;
  return state.warrantGate.recordTurnOutcome(outcome);
}
