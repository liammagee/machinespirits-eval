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
 * v1 evidence limits (recorded here so results are read correctly): the live
 * gate sees record growth, learner signals, and complaint/deference streaks.
 * Uptake, repetition, and guard audits land after the response and are NOT in
 * the decision-time pool yet — the offline shadow sees more than the live
 * gate. Fold post-turn audits in via recordTurnOutcome when that asymmetry
 * starts to matter.
 */

import { classifyLearnerSignal, evaluateWarrant, CONCEPTUAL_STALL_TURNS } from './adaptiveWarrantGateCore.js';

export const TUTOR_STUB_WARRANT_GATE_SCHEMA = 'machinespirits.tutor-stub.warrant-gate.v1';
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

  return {
    schema: TUTOR_STUB_WARRANT_GATE_SCHEMA,
    mode,

    /**
     * Assess the decision point at tutor turn N. priorActionFamily is the
     * family of the PREVIOUS turn's delivered selection (null on turn 1).
     */
    assess({ turn, learnerText = '', dagModel = null, priorActionFamily = null } = {}) {
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
      // The prior turn contributed trouble when it produced no record growth.
      if (dagGrowth !== null && dagGrowth <= 0) {
        troubleTurns.push({ turn: turn - 1, defeaters: ['no_dag_growth'] });
      }
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

      const warrant = evaluateWarrant({
        signal,
        signalConsumed: false,
        troubleTurns,
        complaintTurns,
        deferenceSustained,
        divergence,
        strategyInForce,
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
        turns_since_dag_growth: turnsSinceDagGrowth,
        trouble_turns: troubleTurns.map((row) => row.turn),
        complaint_turns: [...complaintTurns],
        deference_sustained: deferenceSustained,
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
