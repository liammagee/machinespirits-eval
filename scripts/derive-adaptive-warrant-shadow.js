#!/usr/bin/env node

/**
 * Phase-1 trace-only prototype for the normative/descriptive adaptation design
 * (docs/adaptation-refinement/normative-adaptive-dialogue-architecture.md §18).
 *
 * Replays an existing tutor-stub trace (.tutor-stub-traces/*.jsonl) WITHOUT
 * changing tutor behaviour and derives, per learner turn:
 *
 *   expected   — the normative side already in the trace: clue-release
 *                schedule (release_pacing_update) and the compiled turn
 *                contract (tutor_first_draft_contract);
 *   observed   — the descriptive side: learner-DAG growth
 *                (learner_dag_preflight), uptake and repetition audits,
 *                guard/fallback events;
 *   commitment — a derived cross-turn pedagogical commitment: the streak of
 *                turns holding the same action family + stance + part +
 *                tactic, with warrant evidence and defeater evidence
 *                accumulated over the streak;
 *   divergence — candidate divergence rows (conceptual / interactional /
 *                pacing) with magnitude and persistence;
 *   verdict    — whether a revision was warranted under a simple threshold
 *                rule, and whether the stub ACTUALLY revised its performance
 *                selection at the next turn.
 *
 * The verdict comparison (warranted+held, unwarranted+revised, ...) is the
 * point: it tests whether this representation explains adaptation decisions
 * already present in real sessions. Pure computation; no model calls.
 *
 * Usage:
 *   node scripts/derive-adaptive-warrant-shadow.js --trace <path/to/trace.jsonl> [--json <out.json>]
 */

import fs from 'node:fs';
import { parseArgs } from 'node:util';

export const ADAPTIVE_WARRANT_SHADOW_SCHEMA = 'machinespirits.tutor-stub.adaptive-warrant-shadow.v0';

const REPETITION_DEFEATER_THRESHOLD = 0.35;
const CONCEPTUAL_STALL_TURNS = 2;
const WARRANT_DEFEATER_THRESHOLD = 2;

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
 * dialogue and turn numbering restarts). Segment on tutor_opening events and
 * on turn-number regression as a guard.
 */
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
      if (current && turn < maxTurn && turn === 1) open();
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

function selectionKey(selection) {
  return [selection.action_family, selection.stance, selection.part, selection.tactic].join('|');
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

function dagTotal(counts) {
  return counts.grounded + counts.voiced;
}

function deriveSessionShadow(session, sessionIndex) {
  const events = session.events;
  const contracts = lastPerTurn(events, 'tutor_first_draft_contract');
  const preflights = lastPerTurn(events, 'learner_dag_preflight');
  const pacing = lastPerTurn(events, 'release_pacing_update');
  const uptakeAudits = lastPerTurn(events, 'tutor_live_turn_progression_audit');
  const repetitionAudits = lastPerTurn(events, 'tutor_repetition_audit');
  const trouble = allPerTurn(
    events,
    new Set(['tutor_response_fallback', 'tutor_response_guard_exhausted', 'tutor_response_mechanical_repair']),
  );

  const turns = [...contracts.keys()].sort((a, b) => a - b);
  const rows = [];
  let commitment = null;
  let turnsSinceDagGrowth = 0;

  for (const turn of turns) {
    const contract = contracts.get(turn);
    const selection = performanceSelection(contract);
    // The commitment is the pedagogical STRATEGY (action family). Stance, part
    // and tactic are its per-turn realization: they jitter turn to turn in real
    // traces, so treating them as the commitment makes every turn a revision.
    const key = selection.action_family || 'unknown';

    // Descriptive side. The preflight for turn N describes the learner record
    // BEFORE the tutor's turn-N response, so growth attributable to turn N is
    // read from the next turn's preflight.
    const before = preflights.get(turn) ? dagCounts(preflights.get(turn)) : null;
    const after = preflights.get(turn + 1) ? dagCounts(preflights.get(turn + 1)) : null;
    const dagGrowth = before && after ? dagTotal(after) - dagTotal(before) : null;

    const uptake = uptakeAudits.get(turn);
    const uptakeOk = uptake ? uptake.ok !== false && (uptake.issues || []).length === 0 : null;
    const repetition = repetitionAudits.get(turn);
    const maxSimilarity = Number(repetition?.maxSimilarity);
    const pace = pacing.get(turn);
    const lateReleases = (pace?.releasePacing?.counts?.late ?? 0) + (pace?.dueNow?.length ?? 0);
    const troubleEvents = (trouble.get(turn) || []).map((event) => event.type);

    if (dagGrowth !== null) turnsSinceDagGrowth = dagGrowth > 0 ? 0 : turnsSinceDagGrowth + 1;

    // Commitment: streak of turns holding the same performance selection.
    if (!commitment || commitment.key !== key) {
      commitment = {
        key,
        selection,
        sinceTurn: turn,
        streak: 0,
        warrantEvidence: [],
        defeaterEvidence: [],
      };
    }
    commitment.streak += 1;

    const warrantEvidence = [];
    const defeaterEvidence = [];
    if (dagGrowth !== null && dagGrowth > 0) warrantEvidence.push(`dag_growth:+${dagGrowth}`);
    if (uptakeOk === true) warrantEvidence.push('uptake_audit_clean');
    if (Number.isFinite(maxSimilarity) && maxSimilarity < REPETITION_DEFEATER_THRESHOLD) {
      warrantEvidence.push('low_repetition');
    }
    if (dagGrowth !== null && dagGrowth <= 0) defeaterEvidence.push('no_dag_growth');
    if (uptakeOk === false) defeaterEvidence.push('uptake_audit_issues');
    if (Number.isFinite(maxSimilarity) && maxSimilarity >= REPETITION_DEFEATER_THRESHOLD) {
      defeaterEvidence.push(`repetition:${maxSimilarity.toFixed(2)}`);
    }
    for (const type of troubleEvents) defeaterEvidence.push(type);
    if (pace?.signal?.direction && pace.signal.direction !== 'steady') {
      defeaterEvidence.push(`pacing_signal:${pace.signal.direction}`);
    }
    commitment.warrantEvidence.push({ turn, evidence: warrantEvidence });
    commitment.defeaterEvidence.push({ turn, evidence: defeaterEvidence });

    // Divergence rows. Conceptual stalling is session-wide (the learner record
    // does not care which strategy failed to grow it).
    const divergence = [];
    if (turnsSinceDagGrowth >= CONCEPTUAL_STALL_TURNS) {
      divergence.push({
        dimension: 'conceptual',
        magnitude: turnsSinceDagGrowth >= 4 ? 'high' : 'moderate',
        persistence: turnsSinceDagGrowth,
        note: 'learner DAG record not growing',
      });
    }
    const interactionalTurns = commitment.defeaterEvidence.filter((row) =>
      row.evidence.some((item) => item === 'uptake_audit_issues' || item.startsWith('repetition:')),
    ).length;
    if (interactionalTurns >= 1) {
      divergence.push({
        dimension: 'interactional',
        magnitude: interactionalTurns >= 3 ? 'high' : 'moderate',
        persistence: interactionalTurns,
        note: 'uptake or repetition trouble inside the current commitment',
      });
    }
    if (lateReleases > 0) {
      divergence.push({
        dimension: 'pacing',
        magnitude: lateReleases >= 2 ? 'high' : 'moderate',
        persistence: lateReleases,
        note: 'clue releases behind the authored schedule',
      });
    }

    // Warrant threshold: enough defeater-bearing turns inside this commitment,
    // and the most recent turn contributed a defeater.
    const defeaterTurns = commitment.defeaterEvidence.filter((row) => row.evidence.length > 0).length;
    const latestDefeated = defeaterEvidence.length > 0;
    const revisionWarranted = defeaterTurns >= WARRANT_DEFEATER_THRESHOLD && latestDefeated;

    rows.push({
      turn,
      commitment: {
        strategy: selection.action_family,
        realization: { stance: selection.stance, part: selection.part, tactic: selection.tactic },
        since_turn: commitment.sinceTurn,
        streak: commitment.streak,
      },
      expected: {
        next_release: pace?.nextRelease || null,
      },
      observed: {
        dag_before: before,
        dag_growth: dagGrowth,
        uptake_ok: uptakeOk,
        repetition_max_similarity: Number.isFinite(maxSimilarity) ? Number(maxSimilarity.toFixed(3)) : null,
        trouble: troubleEvents,
        pacing_signal: pace?.signal || null,
      },
      warrant_evidence: warrantEvidence,
      defeater_evidence: defeaterEvidence,
      divergence,
      revision_warranted: revisionWarranted,
    });
  }

  // Actual revisions: a strategy revision is an action-family change at the
  // next turn. Realization churn (stance/part/tactic changing under the same
  // strategy) is reported separately — it is a finding, not a revision.
  for (let i = 0; i < rows.length; i += 1) {
    const next = rows[i + 1];
    const revised = next ? next.commitment.strategy !== rows[i].commitment.strategy : null;
    const realizationChanged = next
      ? selectionKey({ action_family: null, ...next.commitment.realization }) !==
        selectionKey({ action_family: null, ...rows[i].commitment.realization })
      : null;
    rows[i].revised_next_turn = revised;
    rows[i].realization_churn_next_turn = realizationChanged;
    rows[i].verdict =
      revised === null
        ? 'last_turn'
        : rows[i].revision_warranted && revised
          ? 'warranted_and_revised'
          : rows[i].revision_warranted && !revised
            ? 'warranted_but_held'
            : !rows[i].revision_warranted && revised
              ? 'revised_without_warrant'
              : 'aligned_hold';
  }

  return { session: sessionIndex + 1, turns: rows };
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

function formatRow(row) {
  const real = row.commitment.realization;
  const commitmentLabel = `${row.commitment.strategy} [${real.stance}/${real.part}/${real.tactic}]`;
  const streak = row.commitment.streak > 1 ? ` (held ${row.commitment.streak})` : '';
  const growth =
    row.observed.dag_growth === null
      ? 'dag ?'
      : `dag ${row.observed.dag_growth >= 0 ? '+' : ''}${row.observed.dag_growth}`;
  const uptake = row.observed.uptake_ok === null ? 'uptake ?' : row.observed.uptake_ok ? 'uptake ok' : 'uptake ISSUES';
  const div = row.divergence.map((d) => `${d.dimension}:${d.magnitude}(p${d.persistence})`).join(' ') || '—';
  const defeaters = row.defeater_evidence.join(',') || '—';
  return [
    `  t${String(row.turn).padStart(2)}`,
    commitmentLabel + streak,
    `${growth}, ${uptake}`,
    `div: ${div}`,
    `defeaters: ${defeaters}`,
    `→ ${row.verdict}${row.revision_warranted ? ' [REVISION WARRANTED]' : ''}`,
  ].join('\n      ');
}

function main() {
  const { values } = parseArgs({
    options: {
      trace: { type: 'string' },
      json: { type: 'string' },
    },
  });
  if (!values.trace) {
    console.error('Usage: node scripts/derive-adaptive-warrant-shadow.js --trace <trace.jsonl> [--json <out.json>]');
    process.exit(1);
  }
  const shadow = deriveAdaptiveWarrantShadow(values.trace);
  for (const session of shadow.sessions) {
    console.log(`Session ${session.session} — ${session.turns.length} tutor turns`);
    for (const row of session.turns) console.log(formatRow(row));
    const verdicts = session.turns.reduce((acc, row) => {
      acc[row.verdict] = (acc[row.verdict] || 0) + 1;
      return acc;
    }, {});
    console.log(`  summary: ${JSON.stringify(verdicts)}`);
    console.log('');
  }
  if (values.json) {
    fs.writeFileSync(values.json, `${JSON.stringify(shadow, null, 2)}\n`);
    console.log(`JSON written to ${values.json}`);
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  main();
}
