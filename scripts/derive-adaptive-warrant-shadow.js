#!/usr/bin/env node

/**
 * Phase-1/2 trace-only prototype for the normative/descriptive adaptation
 * design (docs/adaptation-refinement/normative-adaptive-dialogue-architecture.md).
 *
 * Replays an existing tutor-stub trace (.tutor-stub-traces/*.jsonl) WITHOUT
 * changing tutor behaviour and derives one record per DECISION POINT — the
 * strategy selection at tutor turn N (hold the action family in force, or
 * revise it), for N >= 2.
 *
 * v0.1 changes after the first gold comparison
 * (docs/adaptation-refinement/gold-annotations-first-corpus.md):
 *
 *  - Evidence window: the warrant is computed at DECISION TIME. The decision
 *    at turn N sees learner turn N (the utterance the tutor is answering),
 *    all prior learner turns, and audits of tutor turns through N-1. The
 *    previous version stopped one learner turn short and mis-called every
 *    decision whose warrant arrived with the learner's own words.
 *  - Immediate warrants: an explicit repair request ("what are you talking
 *    about?", "making no sense") or a stall ("no idea") from the learner
 *    warrants revision on its own — these are performative requests, not
 *    mood signals, and do not need accumulation.
 *  - Register track: a register complaint ("you sound like a lawyer")
 *    warrants a REGISTER revision under the held strategy; two complaints
 *    inside one strategy streak escalate to a strategy warrant.
 *  - Stall masking: an engaged-analytic learner turn (long, substantive,
 *    no trouble markers) masks the accumulated-trouble warrant and marks
 *    conceptual divergence as productive (§9.3) — a flat fact record while
 *    the learner is testing the tutor's claim is not a stall.
 *
 * CAVEAT: these rules were tuned on the same eleven gold decisions they are
 * scored against. Agreement here shows the representation can express the
 * gold judgments, not that the rules generalize. Held-out dialogues needed.
 *
 * Usage:
 *   node scripts/derive-adaptive-warrant-shadow.js --trace <trace.jsonl> [--json <out.json>] [--gold <gold.json>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  classifyLearnerSignal,
  evaluateWarrant,
  CONCEPTUAL_STALL_TURNS,
  REPETITION_DEFEATER_THRESHOLD,
} from '../services/adaptiveWarrantGateCore.js';
import { createAdaptiveWarrantActionContractTracker } from '../services/adaptiveWarrantActionContracts.js';

export const ADAPTIVE_WARRANT_SHADOW_SCHEMA = 'machinespirits.tutor-stub.adaptive-warrant-shadow.v0.2';

function readTraceLines(tracePath) {
  const raw = fs.readFileSync(tracePath, 'utf8');
  const lines = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      lines.push(JSON.parse(line));
    } catch {
      // tolerate truncated tail lines
    }
  }
  return lines;
}

/**
 * A trace file can hold several sessions (settings restarts re-open the
 * dialogue and turn numbering restarts). Segment on tutor_opening events, plus
 * a regression guard restricted to genuine turn-start events — opening audits
 * re-emit turn-1 records late in a session and must not split it.
 */
const TURN_START_EVENT_TYPES = new Set(['learner_turn_attempt_started', 'tutor_first_draft_contract']);

function segmentSessions(lines) {
  const sessions = [];
  let current = null;
  let maxTurn = 0;
  const open = () => {
    current = { events: [] };
    maxTurn = 0;
    sessions.push(current);
  };
  for (const event of lines) {
    if (event.type === 'tutor_opening') open();
    const turn = Number(event.turn);
    if (Number.isFinite(turn) && turn >= 1) {
      if (current && turn === 1 && turn < maxTurn && TURN_START_EVENT_TYPES.has(event.type)) open();
      if (!current) open();
      maxTurn = Math.max(maxTurn, turn);
    }
    if (current) current.events.push(event);
  }
  return sessions.filter((session) => session.events.some((event) => Number(event.turn) >= 1));
}

function lastPerTurn(events, type) {
  const byTurn = new Map();
  for (const event of events) {
    if (event.type !== type) continue;
    const turn = Number(event.turn);
    if (!Number.isFinite(turn)) continue;
    byTurn.set(turn, event);
  }
  return byTurn;
}

function allPerTurn(events, types) {
  const byTurn = new Map();
  for (const event of events) {
    if (!types.has(event.type)) continue;
    const turn = Number(event.turn);
    if (!Number.isFinite(turn)) continue;
    if (!byTurn.has(turn)) byTurn.set(turn, []);
    byTurn.get(turn).push(event);
  }
  return byTurn;
}

function performanceSelection(contractEvent) {
  const performance = contractEvent?.contract?.performance || {};
  return {
    action_family: contractEvent?.contract?.development?.action_family || null,
    stance: performance.engagement_stance || null,
    part: performance.actorial_part || null,
    tactic: performance.tactic || null,
  };
}

function dagCounts(preflightEvent) {
  const record = preflightEvent?.preflight?.priorRecord || {};
  return {
    grounded: (record.groundedFacts || []).length,
    derivable: (record.derivableFacts || []).length,
    voiced: (record.voicedDerivedFacts || []).length,
    hypotheses: (record.hypotheses || []).length,
  };
}

function committedDagCounts(turnCompleteEvent) {
  const dag = turnCompleteEvent?.turnRecord?.stateObservation?.dag || {};
  const grounded = Number(dag.grounded_count);
  const voiced = Number(dag.voiced_derived_count);
  if (!Number.isFinite(grounded) || !Number.isFinite(voiced)) return null;
  return { grounded, derivable: 0, voiced, hypotheses: 0 };
}

function dagTotal(counts) {
  return counts.grounded + counts.voiced;
}

/** Per-tutor-turn descriptive facts, shared by trouble accounting below. */
function collectTurnFacts(events) {
  const contracts = lastPerTurn(events, 'tutor_first_draft_contract');
  const preflights = lastPerTurn(events, 'learner_dag_preflight');
  const completedTurns = lastPerTurn(events, 'turn_complete');
  const pacing = lastPerTurn(events, 'release_pacing_update');
  const uptakeAudits = lastPerTurn(events, 'tutor_live_turn_progression_audit');
  const repetitionAudits = lastPerTurn(events, 'tutor_repetition_audit');
  // Interactive sessions commit learner turns as compound events; automated
  // learner sessions log them as auto_learner_turn instead. Same text, second
  // source — without it the signal classifier goes blind on auto-mode traces.
  const learnerTurns = lastPerTurn(events, 'learner_turn_compound_committed');
  for (const [turn, event] of lastPerTurn(events, 'auto_learner_turn')) {
    if (!learnerTurns.has(turn)) learnerTurns.set(turn, { combinedText: event.text });
  }
  const trouble = allPerTurn(
    events,
    new Set(['tutor_response_fallback', 'tutor_response_guard_exhausted', 'tutor_response_mechanical_repair']),
  );

  const turns = [...contracts.keys()].sort((a, b) => a - b);
  const facts = new Map();
  for (const turn of turns) {
    const selection = performanceSelection(contracts.get(turn));
    // Live decision N combines tutor outcome N-1 with learner-record growth
    // from learner N. A completed turn already contains the record after its
    // learner was processed, so tutor-turn t uses committed records t -> t+1.
    // Historical traces without committed DAG counts fall back to preflights
    // t+1 -> t+2: a preflight is captured before its current learner update.
    const before =
      committedDagCounts(completedTurns.get(turn)) ||
      (preflights.get(turn + 1) ? dagCounts(preflights.get(turn + 1)) : null);
    const after =
      committedDagCounts(completedTurns.get(turn + 1)) ||
      (preflights.get(turn + 2) ? dagCounts(preflights.get(turn + 2)) : null);
    const dagGrowth = before && after ? dagTotal(after) - dagTotal(before) : null;
    const uptake = uptakeAudits.get(turn);
    const uptakeOk = uptake ? uptake.ok !== false && (uptake.issues || []).length === 0 : null;
    const maxSimilarity = Number(repetitionAudits.get(turn)?.maxSimilarity);
    const pace = pacing.get(turn);
    const learnerText = learnerTurns.get(turn)?.combinedText || '';
    const classification =
      completedTurns.get(turn)?.turnRecord?.classification?.turn ||
      completedTurns.get(turn)?.turnRecord?.stateObservation?.classifier ||
      null;

    const defeaters = [];
    if (dagGrowth !== null && dagGrowth <= 0) defeaters.push('no_dag_growth');
    if (uptakeOk === false) defeaters.push('uptake_audit_issues');
    if (Number.isFinite(maxSimilarity) && maxSimilarity >= REPETITION_DEFEATER_THRESHOLD) {
      defeaters.push(`repetition:${maxSimilarity.toFixed(2)}`);
    }
    for (const event of trouble.get(turn) || []) defeaters.push(event.type);
    if (pace?.signal?.direction && pace.signal.direction !== 'steady') {
      defeaters.push(`pacing_signal:${pace.signal.direction}`);
    }

    facts.set(turn, {
      turn,
      selection,
      dagGrowth,
      uptakeOk,
      maxSimilarity: Number.isFinite(maxSimilarity) ? maxSimilarity : null,
      defeaters,
      learnerText,
      learnerSignal: classifyLearnerSignal(learnerText),
      classification,
      pacingSignal: pace?.signal || null,
    });
  }
  return { turns, facts };
}

function deriveSessionShadow(session, sessionIndex) {
  const { turns, facts } = collectTurnFacts(session.events);
  const decisions = [];
  let turnsSinceDagGrowth = 0;
  let troubleFloorTurn = 0;
  const actionContracts = createAdaptiveWarrantActionContractTracker();

  // The live gate observes the first learner turn against the action family
  // already selected in the runtime state. Prime the shared contract tracker
  // with that same public evidence even though the first scored decision is
  // turn 2. Without this step, a request first made at turn 1 appears new to
  // offline replay at turn 2 and request-lifecycle parity breaks.
  const firstTurn = turns[0];
  const firstFact = firstTurn === undefined ? null : facts.get(firstTurn);
  if (firstFact?.selection?.action_family) {
    actionContracts.assess({
      turn: firstTurn,
      actionFamily: firstFact.selection.action_family,
      learnerText: firstFact.learnerText,
      classification: firstFact.classification,
      signal: firstFact.learnerSignal,
      dagGrowth: null,
    });
  }

  for (let i = 1; i < turns.length; i += 1) {
    const turn = turns[i];
    const prior = facts.get(turns[i - 1]);
    const current = facts.get(turn);

    // Strategy in force = the family held through turn N-1; streak counts how
    // long it has been held.
    let sinceIndex = i - 1;
    while (
      sinceIndex > 0 &&
      facts.get(turns[sinceIndex - 1]).selection.action_family === prior.selection.action_family
    ) {
      sinceIndex -= 1;
    }
    const streakTurns = turns.slice(sinceIndex, i);
    const streak = streakTurns.length;

    // Decision-time learner signal: learner turn N, else the latest committed
    // learner turn (session tails often leave the last learner turn uncommitted).
    let signal = current.learnerSignal;
    let learnerText = current.learnerText;
    let classification = current.classification;
    let signalCarried = false;
    let signalTurn = turn;
    for (let back = i; back >= 0 && signal.primary === 'absent'; back -= 1) {
      signal = facts.get(turns[back]).learnerSignal;
      learnerText = facts.get(turns[back]).learnerText;
      classification = facts.get(turns[back]).classification;
      signalCarried = back !== i;
      signalTurn = turns[back];
    }

    // A carried signal is consumed once a revision has answered it: if the
    // strategy changed at or after the signal's turn, the old request no
    // longer grounds an immediate warrant against the NEW strategy.
    const signalConsumed =
      signalCarried && decisions.some((d) => d.decided.startsWith('revise') && d.turn >= signalTurn);

    // Evidence inside the streak: tutor-turn trouble through N-1, learner
    // register complaints through N.
    const actionContract = actionContracts.assess({
      turn,
      actionFamily: prior.selection.action_family,
      learnerText,
      classification,
      signal,
      dagGrowth: prior.dagGrowth,
    });
    if (actionContract?.transition?.discharge_prior_trouble) troubleFloorTurn = turn;
    const troubleTurns = streakTurns
      .filter((t) => t >= troubleFloorTurn)
      .map((t) => facts.get(t))
      .filter((fact) => fact.defeaters.length > 0)
      .map((fact) => ({ turn: fact.turn, defeaters: fact.defeaters }));
    const complaintTurns = [...streakTurns, turn].filter((t) =>
      facts.get(t).learnerSignal.labels.includes('register_complaint'),
    );

    for (const t of streakTurns.slice(-1)) {
      const growth = facts.get(t).dagGrowth;
      if (growth !== null) turnsSinceDagGrowth = growth > 0 ? 0 : turnsSinceDagGrowth + 1;
    }

    const masked = signal.primary === 'engaged_analytic';

    // Divergence rows, with the productive interpretation when masked (§9.3).
    const divergence = [];
    if (turnsSinceDagGrowth >= CONCEPTUAL_STALL_TURNS) {
      divergence.push({
        dimension: 'conceptual',
        magnitude: turnsSinceDagGrowth >= 4 ? 'high' : 'moderate',
        persistence: turnsSinceDagGrowth,
        interpretation: masked ? 'productive' : 'stalled',
        repair_warranted: !masked,
        note: masked
          ? 'fact record flat while the learner tests the claim — no repair'
          : 'learner DAG record not growing',
      });
    }
    const interactionalTurns = troubleTurns.filter((row) =>
      row.defeaters.some((item) => item === 'uptake_audit_issues' || item.startsWith('repetition:')),
    ).length;
    if (interactionalTurns >= 1) {
      divergence.push({
        dimension: 'interactional',
        magnitude: interactionalTurns >= 3 ? 'high' : 'moderate',
        persistence: interactionalTurns,
        interpretation: 'trouble',
        repair_warranted: true,
        note: 'uptake or repetition trouble inside the current strategy streak',
      });
    }

    const revised = current.selection.action_family !== prior.selection.action_family;
    const realizationChanged =
      current.selection.stance !== prior.selection.stance ||
      current.selection.part !== prior.selection.part ||
      current.selection.tactic !== prior.selection.tactic;

    // Sustained deference = the last three decision-time signals all carry the
    // permission-framed deferral label.
    const recentSignals = [turns[i - 2], turns[i - 1], turn]
      .filter((t) => t !== undefined)
      .map((t) => facts.get(t).learnerSignal);
    const deferenceSustained =
      recentSignals.length === 3 && recentSignals.every((s) => s.labels.includes('low_agency_deferral'));

    // Warrant + Phase-3 policy from the shared core (same implementation the
    // live gate uses).
    const warrant = evaluateWarrant({
      signal,
      signalConsumed,
      troubleTurns,
      complaintTurns,
      deferenceSustained,
      divergence,
      strategyInForce: prior.selection.action_family,
      actionContract,
    });
    const policy = warrant.policy;

    decisions.push({
      turn,
      strategy_in_force: prior.selection.action_family,
      held_for_turns: streak,
      decided: revised ? `revise:${current.selection.action_family}` : 'hold',
      realization_changed: realizationChanged,
      learner_signal: { ...signal, carried: signalCarried },
      action_contract: actionContract,
      trouble_turns: troubleTurns,
      complaint_turns: complaintTurns,
      divergence,
      revision_warranted: warrant.revision_warranted,
      register_revision_warranted: warrant.register_revision_warranted,
      warrant_basis: warrant.warrant_basis,
      policy,
      policy_matches_actual: policy ? policy.family === current.selection.action_family : null,
      stance_hint_matches_actual: policy?.stance_hint ? policy.stance_hint === current.selection.stance : null,
      actual_selection: current.selection,
      verdict: warrant.revision_warranted
        ? revised
          ? 'warranted_and_revised'
          : 'warranted_but_held'
        : revised
          ? 'revised_without_warrant'
          : 'aligned_hold',
    });
  }

  return { session: sessionIndex + 1, decisions };
}

export function deriveAdaptiveWarrantShadow(tracePath) {
  const lines = readTraceLines(tracePath);
  const sessions = segmentSessions(lines);
  return {
    schema: ADAPTIVE_WARRANT_SHADOW_SCHEMA,
    trace: tracePath,
    sessions: sessions.map((session, index) => deriveSessionShadow(session, index)),
  };
}

/**
 * Compare shadow decisions with gold labels (gold-decisions JSON). Gold
 * `revision_warranted` is yes | no | register_only | uncertain; register_only
 * expects the strategy warrant absent and the register warrant present;
 * uncertain rows are reported but excluded from the agreement score (a
 * borderline point has no right answer to score against).
 */
export function compareWithGold(shadow, goldEntries) {
  const stem = path.basename(shadow.trace).replace(/\.jsonl$/u, '');
  const rows = [];
  for (const gold of goldEntries) {
    if (gold.trace !== stem) continue;
    const session = shadow.sessions.find((candidate) => candidate.session === gold.session);
    const decision = session?.decisions.find((candidate) => candidate.turn === gold.turn);
    if (!decision) {
      rows.push({ gold, shadow: null, agree: false, note: 'no shadow decision at this point' });
      continue;
    }
    const agree =
      gold.revision_warranted === 'uncertain'
        ? null
        : gold.revision_warranted === 'yes'
          ? decision.revision_warranted
          : gold.revision_warranted === 'no'
            ? !decision.revision_warranted
            : !decision.revision_warranted && decision.register_revision_warranted;
    rows.push({
      gold,
      shadow: {
        turn: decision.turn,
        revision_warranted: decision.revision_warranted,
        register_revision_warranted: decision.register_revision_warranted,
        warrant_basis: decision.warrant_basis,
        verdict: decision.verdict,
      },
      agree,
    });
  }
  return rows;
}

function formatDecision(decision) {
  const signal = decision.learner_signal;
  const signalLabel = `${signal.primary}${signal.carried ? ' (carried)' : ''}`;
  const snippet = signal.surface ? `"${signal.surface.slice(0, 60)}${signal.surface.length > 60 ? '…' : ''}"` : '—';
  const trouble = decision.trouble_turns.map((row) => `t${row.turn}(${row.defeaters.join(',')})`).join(' ') || '—';
  const div =
    decision.divergence.map((d) => `${d.dimension}:${d.magnitude}(p${d.persistence},${d.interpretation})`).join(' ') ||
    '—';
  return [
    `  D@t${String(decision.turn).padStart(2)}  ${decision.strategy_in_force} (held ${decision.held_for_turns}) → ${decision.decided}`,
    `learner: ${snippet} [${signalLabel}]`,
    `trouble: ${trouble} | complaints: ${decision.complaint_turns.length}`,
    `div: ${div}`,
    `warrant: ${decision.warrant_basis}${decision.register_revision_warranted ? ' + register_warrant' : ''}`,
    ...(decision.policy
      ? [
          `policy: ${decision.policy.family} [stance ${decision.policy.stance_hint}] — ${decision.policy.rationale}`,
          `        vs actual ${decision.actual_selection.action_family}/${decision.actual_selection.stance}: family ${decision.policy_matches_actual ? 'MATCH' : 'differs'}, stance ${decision.stance_hint_matches_actual ? 'MATCH' : 'differs'}`,
        ]
      : []),
    `→ ${decision.verdict}`,
  ].join('\n        ');
}

function main() {
  const { values } = parseArgs({
    options: {
      trace: { type: 'string' },
      json: { type: 'string' },
      gold: { type: 'string' },
    },
  });
  if (!values.trace) {
    console.error(
      'Usage: node scripts/derive-adaptive-warrant-shadow.js --trace <trace.jsonl> [--json <out.json>] [--gold <gold.json>]',
    );
    process.exit(1);
  }
  const shadow = deriveAdaptiveWarrantShadow(values.trace);
  for (const session of shadow.sessions) {
    console.log(`Session ${session.session} — ${session.decisions.length} decision points`);
    for (const decision of session.decisions) console.log(formatDecision(decision));
    const verdicts = session.decisions.reduce((acc, decision) => {
      acc[decision.verdict] = (acc[decision.verdict] || 0) + 1;
      return acc;
    }, {});
    console.log(`  summary: ${JSON.stringify(verdicts)}`);
    console.log('');
  }
  if (values.gold) {
    const goldEntries = JSON.parse(fs.readFileSync(values.gold, 'utf8')).decisions;
    const rows = compareWithGold(shadow, goldEntries);
    let agreeCount = 0;
    let scoredCount = 0;
    for (const row of rows) {
      if (row.agree !== null) {
        scoredCount += 1;
        if (row.agree) agreeCount += 1;
      }
      const label = row.agree === null ? 'UNCERTAIN' : row.agree ? 'AGREE    ' : 'DISAGREE ';
      const shadowSide = row.shadow
        ? `shadow: warranted=${row.shadow.revision_warranted} register=${row.shadow.register_revision_warranted} (${row.shadow.warrant_basis})`
        : 'shadow: (missing)';
      console.log(
        `${label} s${row.gold.session} D@t${row.gold.turn} gold=${row.gold.revision_warranted} | ${shadowSide}`,
      );
    }
    console.log(
      `gold agreement: ${agreeCount}/${scoredCount} scored (${rows.length - scoredCount} uncertain reported)`,
    );
  }
  if (values.json) {
    fs.writeFileSync(values.json, `${JSON.stringify(shadow, null, 2)}\n`);
    console.log(`JSON written to ${values.json}`);
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  main();
}
