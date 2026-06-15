/**
 * Programmatic diagnosis + readable transcript for staging-loop iterations
 * (notes/dramatic-derivation-plan.md §3 step 3: "run → programmatic diagnosis
 * (the §2.5 taxonomy) + a transcript read → revise the tutor's role-script").
 *
 * diagnose() computes everything the loop needs to decide WHAT failed —
 * trajectory shape, recognition timing, release adherence against the frozen
 * plot, dialogue discipline, learning slope per movement — without a judge
 * anywhere. renderTranscript() produces the markdown the operator actually
 * reads: the drama as a drama, movement by movement, with the instrument
 * panel at the foot.
 *
 * Under free dramaturgy (engine.js header) the realized arc is the
 * DIRECTOR'S declared movements, not the world's authored sketch;
 * stagingSegments() recovers it from the transcript and every renderer here
 * groups, draws, and rates against that.
 */

import { derivationDistance } from './slope.js';
import { factKey } from './chainer.js';
import { buildWorldIR } from './guardCompiler.js';
import { describePublicRegister } from './llmRoles.js';

export const LOGIC_PROJECTION_REPORT_SCHEMA = 'dramatic-derivation.logic-projection-report.v0';

function countSentences(text) {
  return (text || '')
    .split(/[.!?…]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

function publicStageLine(line) {
  return line.role !== 'director' || line.meta?.release || line.meta?.phase?.name;
}

/**
 * Release adherence against the authored schedule. The plot is frozen in
 * phase 1, so every deviation is worth a line in the diagnosis: late and
 * missed releases are staging failures; unscheduled releases mean a role
 * broke the plot contract (the LLM bridges enforce it; mocks and future
 * free-director phases may not).
 */
export function releaseAdherence(world, ledger, turnsPlayed = Infinity) {
  const byPremise = new Map(ledger.map((entry) => [entry.premiseId, entry]));
  const rows = world.releaseSchedule.map((planned) => {
    const actual = byPremise.get(planned.premise) || null;
    // A release planned beyond the turns actually played was never reachable
    // (the drama resolved or died first) — not a staging failure.
    let status = planned.turn > turnsPlayed ? 'unreached' : 'missed';
    if (actual) {
      if (actual.turn === planned.turn && actual.via === planned.via) status = 'on_cue';
      else if (actual.turn === planned.turn) status = 'wrong_via';
      else status = actual.turn > planned.turn ? 'late' : 'early';
    }
    return {
      premise: planned.premise,
      plannedTurn: planned.turn,
      plannedVia: planned.via,
      actualTurn: actual ? actual.turn : null,
      actualVia: actual ? actual.via : null,
      status,
    };
  });
  const scheduledIds = new Set(world.releaseSchedule.map((entry) => entry.premise));
  const unscheduled = ledger.filter((entry) => !scheduledIds.has(entry.premiseId));
  return {
    rows,
    onCue: rows.filter((r) => r.status === 'on_cue').length,
    deviations: rows.filter((r) => !['on_cue', 'missed', 'unreached'].includes(r.status)),
    missed: rows.filter((r) => r.status === 'missed'),
    unscheduled,
  };
}

/**
 * C2 (release authority) — the per-turn decision series the tutor bridge
 * recorded: what was claimable, what was claimed, what played, at what offset
 * from the authored cue, and for what declared reason. Under the dial a
 * late/early release is STRATEGY, not a staging failure — releaseAdherence
 * above still reports against the authored calendar, so read the two
 * together. Null on every arm without the dial (no tutor line carries a
 * decision record); `held` counts include force-plays at the hold limit
 * (offset = +latitude), which `forced`/`overridden` separate out.
 */
export function releaseDeviations(result) {
  const rows = (result.transcript || []).filter((l) => l.role === 'tutor' && l.meta?.releaseDecision);
  if (!rows.length) return null;
  const decisions = rows.map((l) => ({ turn: l.turn, ...l.meta.releaseDecision }));
  const played = decisions.filter((d) => d.played);
  const offsets = played.filter((d) => typeof d.offset === 'number');
  return {
    turnsWithWindow: decisions.filter((d) => d.windowSize > 0).length,
    played: played.length,
    onSchedule: offsets.filter((d) => d.offset === 0).length,
    early: offsets.filter((d) => d.offset < 0).length,
    held: offsets.filter((d) => d.offset > 0).length,
    forced: decisions.filter((d) => Boolean(d.forced)).length,
    overridden: decisions.filter((d) => d.overridden).length,
    invalidClaims: decisions.filter((d) => d.invalidClaim).length,
    reasons: played
      .filter((d) => d.reason)
      .map((d) => ({ turn: d.turn, premise: d.played, offset: d.offset, reason: d.reason })),
    decisions,
  };
}

/**
 * The REALIZED dramaturgy: the movements the director actually declared
 * (director transcript lines carrying meta.phase), falling back to the
 * world's authored sketch when none was. Segments are act-shaped
 * ({act, title, intent, turns:[start,end], source}) so the curve, the
 * slope, and the transcript grouping consume sketch and declaration
 * interchangeably.
 */
export function stagingSegments(result, world) {
  const declared = result.transcript
    .filter((line) => line.role === 'director' && line.meta?.phase?.name)
    .map((line) => ({
      turn: line.turn,
      name: line.meta.phase.name,
      intent: (line.meta.phase.intent || '').trim(),
    }));
  if (!declared.length) {
    return (world?.dramaturgy?.acts || [])
      .filter((a) => a.turns[0] <= result.turnsPlayed)
      .map((a) => ({
        act: a.act,
        title: `Act ${a.act} — ${a.title}`,
        intent: (a.intent || '').trim(),
        turns: [a.turns[0], Math.min(a.turns[1], result.turnsPlayed)],
        source: 'sketch',
      }));
  }
  const segments = [];
  if (declared[0].turn > 1) {
    segments.push({
      act: '0',
      title: 'Overture (before the first declared movement)',
      intent: '',
      turns: [1, declared[0].turn - 1],
      source: 'implicit',
    });
  }
  declared.forEach((d, i) => {
    const end = i + 1 < declared.length ? declared[i + 1].turn - 1 : result.turnsPlayed;
    segments.push({
      act: String(i + 1),
      title: d.name,
      intent: d.intent,
      turns: [d.turn, Math.max(d.turn, end)],
      source: 'director',
    });
  });
  return segments;
}

/**
 * Realized learning slope: how fast D(t) actually descended, overall and per
 * movement. D₀ (the distance before the curtain rises) is recomputed from the
 * background alone — exactly the engine's turn-0 grounded state — so the drop
 * ON a movement's first turn is attributed to that movement. Rates are in
 * D-units per turn; positive = descending (learning), 0 = plateau. The
 * per-movement key stays `perAct` (segments are act-shaped) so older saved
 * diagnoses and the new ones render through one path.
 */
export function learningSlope(result, world, segments = null) {
  const d0 = derivationDistance(world, world.background);
  const byTurn = new Map(result.trajectory.map((p) => [p.turn, p.D]));
  const dAt = (turn) => (turn <= 0 ? d0 : (byTurn.get(turn) ?? null));
  const rate = (dStart, dEnd, turns) =>
    dStart === null || dEnd === null || !turns ? null : +((dStart - dEnd) / turns).toFixed(3);
  const perAct = (segments || stagingSegments(result, world))
    .filter((a) => a.turns[0] <= result.turnsPlayed)
    .map((a) => {
      const start = a.turns[0];
      const end = Math.min(a.turns[1], result.turnsPlayed);
      const dStart = dAt(start - 1);
      const dEnd = dAt(end);
      return {
        act: a.act,
        title: a.title,
        turns: [start, end],
        dStart,
        dEnd,
        delta: dStart !== null && dEnd !== null ? dStart - dEnd : null,
        ratePerTurn: rate(dStart, dEnd, end - start + 1),
      };
    });
  const dFinal = result.trajectory.length ? result.trajectory[result.trajectory.length - 1].D : d0;
  return {
    d0,
    dFinal,
    overall: {
      delta: d0 - dFinal,
      turns: result.turnsPlayed,
      ratePerTurn: rate(d0, dFinal, result.turnsPlayed),
    },
    perAct,
  };
}

/** Longest stretch of flat D between the first release and the forcing turn. */
function longestPlateau(trajectory, firstReleaseTurn, firstForcedTurn) {
  let longest = 0;
  let runStart = null;
  let prevD = null;
  for (const point of trajectory) {
    if (point.turn < firstReleaseTurn) continue;
    if (firstForcedTurn !== null && point.turn > firstForcedTurn) break;
    if (prevD !== null && point.D === prevD) {
      if (runStart === null) runStart = point.turn - 1;
      longest = Math.max(longest, point.turn - runStart);
    } else {
      runStart = null;
    }
    prevD = point.D;
  }
  return longest;
}

/**
 * Figure-diversity instrument — the S0→S1 adaptation measure. The lock-in
 * defect is the tutor playing one figure regardless of state (erotema 30/32
 * in the v002 paid runs); this counts the realized figure distribution and,
 * crucially, whether figure SWITCHES are contingent on an intervention
 * (mechanism traceability: variety that ignores the watching channel is
 * noise, not adaptation). Two channels, one instrument: the legacy
 * director-note fields (pre-2026-06-10 artifacts) and the `superego` block
 * (the tutor's own deliberation — draft figure vs revised figure gives a
 * WITHIN-turn causal read the director channel never had). All counts are
 * programmatic — no judge.
 */
export function tutorFigures(result) {
  const noteTurns = new Set(
    result.transcript.filter((l) => l.role === 'director' && l.meta?.tutorNote).map((l) => l.turn),
  );
  const moves = result.transcript
    .filter((l) => l.role === 'tutor' && l.meta?.move)
    .map((l) => ({
      turn: l.turn,
      figure:
        String(l.meta.move.figure || '')
          .toLowerCase()
          .trim() || '(none)',
      deliberation: l.meta.deliberation || null,
    }));
  const counts = {};
  for (const m of moves) counts[m.figure] = (counts[m.figure] || 0) + 1;
  const total = moves.length;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || null;
  const rate = (n, d) => (d ? +(n / d).toFixed(3) : null);
  let switches = 0;
  const onNote = { switches: 0, opportunities: 0 };
  const elsewhere = { switches: 0, opportunities: 0 };
  for (let i = 1; i < moves.length; i += 1) {
    const switched = moves[i].figure !== moves[i - 1].figure;
    if (switched) switches += 1;
    const bucket = noteTurns.has(moves[i].turn) ? onNote : elsewhere;
    bucket.opportunities += 1;
    if (switched) bucket.switches += 1;
  }

  // Superego deliberation (turns where the tutor's own watcher saw the draft).
  const watched = moves.filter((m) => m.deliberation);
  let superego = null;
  if (watched.length) {
    const interventions = watched.filter((m) => m.deliberation.intervened);
    const withinTurnChanges = interventions.filter(
      (m) => m.deliberation.draftFigure && String(m.deliberation.draftFigure).toLowerCase().trim() !== m.figure,
    ).length;
    const interventionTurns = new Set(interventions.map((m) => m.turn));
    const onIntervention = { switches: 0, opportunities: 0 };
    const offIntervention = { switches: 0, opportunities: 0 };
    for (let i = 1; i < moves.length; i += 1) {
      const switched = moves[i].figure !== moves[i - 1].figure;
      const bucket = interventionTurns.has(moves[i].turn) ? onIntervention : offIntervention;
      bucket.opportunities += 1;
      if (switched) bucket.switches += 1;
    }

    // Charter-v3 arms (stall-watch) record the per-turn arithmetic; the
    // detector audit recomputes due/not-due from the RECORD and compares the
    // fires against it — the watcher's own jurisdiction claim is reported but
    // never trusted as evidence (the P2 criterion: mismatch budget 0).
    // Rut-due is rebuilt from the transcript's realized figure sequence (what
    // the watcher's charter shows it); stall-due from the recorded item
    // arithmetic — `targetedByDraft` alone must be read back, because the
    // draft move is unobservable post-hoc (the transcript holds the revision).
    const v3 = watched.filter((m) => m.deliberation.stall !== undefined);
    let stallWatch = null;
    if (v3.length) {
      const byJurisdiction = { figure_rut: 0, stalled_inference: 0 };
      for (const m of interventions) {
        const j = m.deliberation.jurisdiction;
        if (j && byJurisdiction[j] !== undefined) byJurisdiction[j] += 1;
      }
      const indexByTurn = new Map(moves.map((m, i) => [m.turn, i]));
      const audit = { turns: 0, due: 0, fired: 0, missedFires: [], falseFires: [] };
      for (const m of v3) {
        const i = indexByTurn.get(m.turn);
        const draft = String(m.deliberation.draftFigure || '')
          .toLowerCase()
          .trim();
        const rutDue = i >= 2 && Boolean(draft) && moves[i - 1].figure === draft && moves[i - 2].figure === draft;
        const stallDue = (m.deliberation.stall.items || []).some(
          (item) => item.age >= 3 && !item.targetedByLast2 && !item.targetedByDraft,
        );
        const due = rutDue || stallDue;
        const fired = Boolean(m.deliberation.intervened);
        audit.turns += 1;
        if (due) audit.due += 1;
        if (fired) audit.fired += 1;
        if (due && !fired) audit.missedFires.push(m.turn);
        if (!due && fired) audit.falseFires.push(m.turn);
      }
      audit.clean = !audit.missedFires.length && !audit.falseFires.length;
      stallWatch = { byJurisdiction, audit };
    }

    superego = {
      watched: watched.length,
      interventions: interventions.length,
      interventionRate: rate(interventions.length, watched.length),
      withinTurnChanges,
      withinTurnChangeRate: rate(withinTurnChanges, interventions.length),
      switchOnIntervention: rate(onIntervention.switches, onIntervention.opportunities),
      switchElsewhere: rate(offIntervention.switches, offIntervention.opportunities),
      stallWatch,
    };
  }

  return {
    total,
    counts,
    distinct: Object.keys(counts).length,
    topFigure: top ? top[0] : null,
    topShare: top && total ? rate(top[1], total) : null,
    switchRate: rate(switches, total - 1),
    noteTurns: noteTurns.size,
    switchOnNoteTurns: rate(onNote.switches, onNote.opportunities),
    switchElsewhere: rate(elsewhere.switches, elsewhere.opportunities),
    superego,
  };
}

/**
 * The learner-movement instrument (stall-watcher note §2): what the learner's
 * board already afforded, when it was first affordable, and when — if ever —
 * the learner said it aloud. All from the engine's inference record; the
 * pre-registered metrics:
 *   - per-node voicing latency (firstVoiced − firstAvailable; censored at
 *     drama end if unvoiced — the P1 comparison treats censored as ∞);
 *   - stall integral (Σ over turns of nodes unvoiced at age ≥ 3);
 *   - post-fire uptake (stalled node voiced within 3 turns of a stall fire;
 *     the fire turn itself counts — the learner speaks after the restaged
 *     line inside the same engine turn);
 *   - within-turn target obedience (revised move's target ∈ the named
 *     inference's grounds);
 *   - overreach count (guard G2: the watcher must not bully the learner into
 *     guessing).
 * Returns null on pre-instrument artifacts (no result.inference).
 */
export function learnerInference(result) {
  const inf = result.inference;
  if (!inf) return null;
  const end = result.turnsPlayed;
  const rate = (n, d) => (d ? +(n / d).toFixed(3) : null);

  const nodes = (inf.availability || []).map(({ fact, firstAvailable, firstVoiced }) => {
    let stallTurns = 0;
    for (let t = firstAvailable; t <= end; t += 1) {
      if (t - firstAvailable >= 3 && (firstVoiced === null || t < firstVoiced)) stallTurns += 1;
    }
    return {
      fact,
      firstAvailable,
      firstVoiced,
      latency: firstVoiced === null ? null : firstVoiced - firstAvailable,
      censored: firstVoiced === null,
      ageAtEnd: end - firstAvailable,
      stallTurns,
    };
  });

  // Stall fires: superego interventions attributed to the stalled-inference
  // jurisdiction, each joined to the node the note named (the first due item
  // in the recorded arithmetic — the one the revision instruction aimed at)
  // and to the voiced ledger for the uptake read.
  const stallFires = result.transcript
    .filter(
      (l) =>
        l.role === 'tutor' &&
        l.meta?.deliberation?.intervened &&
        l.meta.deliberation.jurisdiction === 'stalled_inference',
    )
    .map((l) => {
      const items = l.meta.deliberation.stall?.items || [];
      const named = items.find((i) => i.age >= 3 && !i.targetedByLast2 && !i.targetedByDraft) || null;
      const target = l.meta.move?.targetPremise || null;
      const obeyed = Boolean(named && target && (named.groundPremiseIds || []).includes(target));
      const voicedEntry = named ? (inf.voiced || []).find((v) => factKey(v.fact) === factKey(named.fact)) : null;
      const voicedTurn = voicedEntry ? voicedEntry.turn : null;
      const uptaken = voicedTurn !== null && voicedTurn >= l.turn && voicedTurn - l.turn <= 3;
      return { turn: l.turn, stalled: named ? named.fact : null, target, obeyed, voicedTurn, uptaken };
    });

  const uptaken = stallFires.filter((f) => f.uptaken).length;
  const obeyed = stallFires.filter((f) => f.obeyed).length;
  return {
    nodes,
    voicedCount: (inf.voiced || []).length,
    overreachCount: (inf.overreaches || []).length,
    mischanneledCount: (inf.mischanneled || []).length,
    stallIntegral: nodes.reduce((sum, n) => sum + n.stallTurns, 0),
    stallFires,
    postFireUptake: { fires: stallFires.length, uptaken, rate: rate(uptaken, stallFires.length) },
    targetObedience: { fires: stallFires.length, obeyed, rate: rate(obeyed, stallFires.length) },
  };
}

/**
 * Decay-condition panel block (null when the run had no decay condition, so
 * the OFF-state diagnosis object is byte-identical to the pre-corruption
 * shape). Everything is derived from the engine's corruption ledger except
 * `unrepairedAtEnd`, which reads the engine's own end-state field — the two
 * agree by construction, and the end-state is the authority.
 *
 * `degradedTurnIntegral` is the headline burden number: turns × premises the
 * learner's board spent degraded (unrepaired slips accrue until the run ends).
 * `dReversals` counts turns where D(t) ROSE — the signature of decay knocking
 * out a premise the proof path needed.
 */
export function corruptionReport(result) {
  const c = result.corruption;
  if (!c) return null;
  const ledger = c.ledger || [];
  const timeline = [];
  // A mutate slip opens TWO debts that close independently and in either
  // order: the deletion (closed by a `repair` row — tutor re-stage or
  // re-adoption) and the false belief (closed by a `retract_false` row —
  // the learner striking the misremembered form). The deletion debt is
  // premise-keyed (a premise cannot re-decay while still down, so a repeat
  // decay re-points at the newest row). The false-belief debt must match by
  // FORM, not premise: false forms outlive repairs, so a premise can
  // re-mutate while an earlier false form still stands, and the two forms
  // coexist on the learner's board until each is struck by its own retract.
  const openRepairByPremise = new Map();
  const openFalseRows = []; // mutate rows with an unstruck false form, decay order
  for (const e of ledger) {
    if (e.type === 'decay') {
      const row = {
        premiseId: e.premiseId,
        fact: e.fact,
        mode: e.mode === 'mutate' ? 'mutate' : 'delete',
        falseForm: e.falseForm || null,
        decayTurn: e.turn,
        retractTurn: null,
        repairTurn: null,
        via: null,
      };
      timeline.push(row);
      openRepairByPremise.set(e.premiseId, row);
      if (row.mode === 'mutate') openFalseRows.push(row);
    } else if (e.type === 'retract_false') {
      const key = factKey(e.falseForm || []);
      const idx = openFalseRows.findIndex((row) => factKey(row.falseForm || []) === key);
      if (idx >= 0) {
        openFalseRows[idx].retractTurn = e.turn;
        openFalseRows.splice(idx, 1);
      }
    } else if (e.type === 'repair') {
      const open = openRepairByPremise.get(e.premiseId);
      if (open) {
        open.repairTurn = e.turn;
        open.via = e.via;
        openRepairByPremise.delete(e.premiseId);
      }
    }
  }
  const repairs = ledger.filter((e) => e.type === 'repair');
  const latencies = timeline.filter((t) => t.repairTurn !== null).map((t) => t.repairTurn - t.decayTurn);
  let dReversals = 0;
  for (let i = 1; i < result.trajectory.length; i += 1) {
    if (result.trajectory[i].D > result.trajectory[i - 1].D) dReversals += 1;
  }
  const mutations = timeline.filter((t) => t.mode === 'mutate');
  // C5: a confrontation can be what exposes a false form — the learner reads
  // the exhibit back and the misremembered line falls. Window {0, +1}: the
  // tutor speaks before the learner, so the read-back lands the same turn,
  // but the strike may take until the learner's next line. Rows are annotated
  // only on arms where a confront was actually spoken, so the OFF-state
  // report shape is unchanged.
  const confrontTurnsByPremise = new Map();
  for (const line of result.transcript || []) {
    if (line.role !== 'tutor') continue;
    const intent = String(line.meta?.move?.intent || '')
      .toLowerCase()
      .trim();
    const target = line.meta?.move?.targetPremise;
    if (intent !== 'confront' || !target) continue;
    if (!confrontTurnsByPremise.has(target)) confrontTurnsByPremise.set(target, []);
    confrontTurnsByPremise.get(target).push(line.turn);
  }
  if (confrontTurnsByPremise.size) {
    for (const row of mutations) {
      row.confrontPrompted =
        row.retractTurn !== null &&
        (confrontTurnsByPremise.get(row.premiseId) || []).some(
          (t) => row.retractTurn - t === 0 || row.retractTurn - t === 1,
        );
    }
  }
  // F(t) rides the trajectory rows in corruption runs (engine: theoryFidelity).
  const fCurve = result.trajectory.filter((p) => typeof p.F === 'number').map((p) => p.F);
  return {
    config: c.config,
    decayEvents: timeline.length,
    repairs: {
      total: repairs.length,
      byTutor: repairs.filter((e) => e.via === 'tutor').length,
      byReadoption: repairs.filter((e) => e.via === 'readoption').length,
    },
    meanRepairLatency: latencies.length
      ? +(latencies.reduce((sum, l) => sum + l, 0) / latencies.length).toFixed(2)
      : null,
    unrepairedAtEnd: (c.decayedAtEnd || []).length,
    degradedTurnIntegral: timeline.reduce((sum, t) => sum + ((t.repairTurn ?? result.turnsPlayed) - t.decayTurn), 0),
    dReversals,
    mutations: {
      total: mutations.length,
      retracted: mutations.filter((t) => t.retractTurn !== null).length,
      // A completed REVISE: false form struck AND true premise back on the board.
      revised: mutations.filter((t) => t.retractTurn !== null && t.repairTurn !== null).length,
      falseBeliefsAtEnd: mutations.filter((t) => t.retractTurn === null).length,
      ...(confrontTurnsByPremise.size
        ? { confrontPromptedRetractions: mutations.filter((t) => t.confrontPrompted).length }
        : {}),
    },
    fidelity: fCurve.length
      ? { final: +fCurve[fCurve.length - 1].toFixed(3), min: +Math.min(...fCurve).toFixed(3) }
      : null,
    timeline,
  };
}

/**
 * C5 (confrontation obligation) — the conduct-rule audit, recomputed from the
 * SPOKEN record exactly as the superego's recorded arithmetic computes it
 * from the draft: a tutor move onto an exhibit staged on an earlier turn,
 * with any intent but "confront", is covered only by a confrontation of that
 * exhibit standing since its last staging; a covered re-entry spends the
 * license. Also collects the watcher's re-entry fires (did the spoken move
 * become the confrontation?) and, under decay, whether each confrontation
 * tested a real absence (target down at the moment of the demand). Null
 * unless the arm ran the dial — no deliberation row carries re-entry
 * arithmetic and no move declares confront.
 */
export function confrontReport(result) {
  const transcript = result.transcript || [];
  const tutorLines = transcript.filter((l) => l.role === 'tutor');
  const norm = (v) =>
    String(v || '')
      .toLowerCase()
      .trim();
  const armOn = tutorLines.some(
    (l) => l.meta?.deliberation?.reentry !== undefined || ['confront', 'restore'].includes(norm(l.meta?.move?.intent)),
  );
  if (!armOn) return null;
  const releaseTurnByPremise = new Map((result.ledger || []).map((e) => [e.premiseId, e.turn]));
  // Decayed-at check: corruption ledger rows are pushed in chronological
  // order within the run loop, so array order resolves same-turn sequencing
  // (a decay lands before the tutor's move on that turn; a tutor repair
  // lands on the move's own turn).
  const corruptionRows = result.corruption?.ledger || null;
  // beforeMove: state at the moment the tutor speaks — same-turn decay rows
  // land before the move, but a same-turn repair IS the move (via tutor) or
  // follows it (learner re-adoption), so it must not erase the evidence.
  const decayedAt = (premiseId, turn, { beforeMove = false } = {}) => {
    if (!corruptionRows) return null;
    let down = false;
    for (const e of corruptionRows) {
      if (e.turn > turn) break;
      if (e.premiseId !== premiseId) continue;
      if (beforeMove && e.turn === turn && e.type === 'repair') continue;
      if (e.type === 'decay') down = true;
      else if (e.type === 'repair') down = false;
    }
    return down;
  };
  const confrontations = [];
  const reentries = [];
  const restores = [];
  // §12 (repair clause): a tutor repair row on the move's own turn — the
  // post-hoc audit may read the slip ledger (ground truth) that no in-run
  // role held; a restore that repaired nothing was a false or stale claim.
  const repairedAt = (premiseId, turn) =>
    corruptionRows
      ? corruptionRows.some(
          (e) => e.type === 'repair' && e.premiseId === premiseId && e.turn === turn && e.via === 'tutor',
        )
      : null;
  const stateByTarget = new Map(); // target -> { lastStagedTurn, confrontedAt }
  for (const l of tutorLines) {
    const target = l.meta?.move?.targetPremise || null;
    if (!target) continue;
    const intent = norm(l.meta.move.intent);
    const releaseTurn = releaseTurnByPremise.get(target);
    if (releaseTurn === undefined || releaseTurn >= l.turn) continue; // not yet staged-earlier
    const st = stateByTarget.get(target) || { lastStagedTurn: releaseTurn, confrontedAt: null };
    if (intent === 'confront') {
      confrontations.push({ turn: l.turn, target, targetDecayed: decayedAt(target, l.turn) });
      st.confrontedAt = l.turn;
    } else if (intent === 'restore') {
      // The repair-clause bucket: licensed by the learner's report, not by a
      // confrontation — never counted covered/uncovered. It re-stages all the
      // same, so any standing license is spent.
      restores.push({
        turn: l.turn,
        target,
        targetDecayed: decayedAt(target, l.turn, { beforeMove: true }),
        repaired: repairedAt(target, l.turn),
      });
      st.lastStagedTurn = l.turn;
    } else {
      const covered = st.confrontedAt !== null && st.confrontedAt > st.lastStagedTurn;
      reentries.push({ turn: l.turn, target, intent, covered, confrontTurn: covered ? st.confrontedAt : null });
      st.lastStagedTurn = l.turn; // a re-entry re-stages; any license is spent
    }
    stateByTarget.set(target, st);
  }
  // The watcher's re-entry fires and whether the spoken move became the
  // confrontation (the within-turn break — stall-watcher P2's analogue),
  // plus the detector audit: a fire whose own recorded arithmetic says
  // not-due is a mismatch; due-without-fire may be priority (rut first)
  // or restraint, so it is counted, not judged.
  const fires = tutorLines
    .filter((l) => l.meta?.deliberation?.jurisdiction === 'unconfronted_reentry')
    .map((l) => ({
      turn: l.turn,
      target: l.meta.deliberation.reentry?.target ?? null,
      convertedToConfront: norm(l.meta.move?.intent) === 'confront',
      dueByRecord: Boolean(l.meta.deliberation.reentry?.due),
      // §12: a fire on a "restore" draft is the watcher rejecting the claimed
      // license — not mechanically due (the record cannot judge the learner's
      // line), so it must not count against the detector audit.
      onRestoreClaim: Boolean(l.meta.deliberation.reentry?.restoreClaim),
      onProofDebtClaim: Boolean(l.meta.deliberation.reentry?.proofDebtClaim),
    }));
  return {
    confrontations,
    reentries: {
      total: reentries.length,
      covered: reentries.filter((r) => r.covered).length,
      uncovered: reentries.filter((r) => !r.covered),
    },
    ...(restores.length ? { restores } : {}),
    superego: {
      reentryFires: fires.length,
      convertedToConfront: fires.filter((f) => f.convertedToConfront).length,
      firesWithoutDue: fires.filter((f) => !f.dueByRecord && !f.onRestoreClaim && !f.onProofDebtClaim).length,
      restoreClaimFires: fires.filter((f) => f.onRestoreClaim).length,
      proofDebtClaimFires: fires.filter((f) => f.onProofDebtClaim).length,
      draftsDueByRecord: tutorLines.filter((l) => l.meta?.deliberation?.reentry?.due).length,
      fires,
    },
  };
}

export function proofDebtGuardReport(result) {
  const detections = result.proofDebt || [];
  const actions = (result.transcript || [])
    .filter((l) => l.role === 'tutor' && l.meta?.proofDebt)
    .map((l) => ({
      turn: l.turn,
      target: l.meta.proofDebt.target || null,
      debtCount: l.meta.proofDebt.debtCount || 0,
      forced: Boolean(l.meta.proofDebt.forced),
      stage: l.meta.proofDebt.stage || null,
      moveIntent: l.meta.move?.intent || null,
    }));
  if (!detections.length && !actions.length) return null;
  const repairs = result.corruption?.ledger || [];
  const actionRows = actions.map((a) => ({
    ...a,
    repaired: repairs.some(
      (e) => e.type === 'repair' && e.via === 'tutor' && e.turn === a.turn && e.premiseId === a.target,
    ),
  }));
  const targets = [...new Set(actionRows.map((a) => a.target).filter(Boolean))];
  return {
    detectedTurns: detections.length,
    debtsDetected: detections.reduce((sum, row) => sum + (row.debts || []).length, 0),
    actionTurns: actionRows.length,
    forcedMoves: actionRows.filter((a) => a.forced).length,
    restoredMoves: actionRows.filter((a) => String(a.moveIntent).toLowerCase() === 'restore').length,
    repairedTargets: actionRows.filter((a) => a.repaired).length,
    targets,
    detections,
    actions: actionRows,
  };
}

export function conductPolicyReport(result) {
  const rows = (result.transcript || [])
    .filter((l) => l.role === 'tutor' && l.meta?.conductPolicy)
    .map((l) => ({
      turn: l.turn,
      active: Boolean(l.meta.conductPolicy.active),
      selectedMoveFamily: l.meta.conductPolicy.selectedMoveFamily || null,
      reasonCode: l.meta.conductPolicy.reasonCode || null,
      targetPremise: l.meta.conductPolicy.targetPremise || null,
      triggerType: l.meta.conductPolicy.triggerType || null,
      realizedMove: l.meta.conductPolicy.realizedMove || l.meta.move || null,
      realizedRelease: l.meta.conductPolicy.realizedRelease || l.meta.release || null,
      loggingOnly: l.meta.conductPolicy.loggingOnly === true,
      complianceChecked: l.meta.conductPolicy.generatorCompliance?.checked === true,
      complianceOk:
        l.meta.conductPolicy.generatorCompliance?.checked === true
          ? l.meta.conductPolicy.generatorCompliance?.ok === true
          : null,
      complianceFailures: l.meta.conductPolicy.generatorCompliance?.failures || [],
    }));
  if (!rows.length) return null;
  const counts = (field) => {
    const out = {};
    for (const row of rows) {
      const key = row[field] || '(none)';
      out[key] = (out[key] || 0) + 1;
    }
    return out;
  };
  const active = rows.filter((row) => row.active);
  const checked = rows.filter((row) => row.complianceChecked);
  const passed = checked.filter((row) => row.complianceOk === true);
  const failed = checked.filter((row) => row.complianceOk === false);
  return {
    schema: 'dramatic-derivation.conduct-policy-report.v0',
    loggedTurns: rows.length,
    activeTurns: active.length,
    inactiveTurns: rows.length - active.length,
    moveFamilies: counts('selectedMoveFamily'),
    reasonCodes: counts('reasonCode'),
    loggingOnly: rows.every((row) => row.loggingOnly),
    complianceChecked: rows.some((row) => row.complianceChecked),
    compliance: {
      checked: checked.length,
      passed: passed.length,
      failed: failed.length,
      unchecked: rows.length - checked.length,
      failures: failed.map((row) => ({
        turn: row.turn,
        selectedMoveFamily: row.selectedMoveFamily,
        reasonCode: row.reasonCode,
        targetPremise: row.targetPremise,
        realizedMove: row.realizedMove,
        realizedRelease: row.realizedRelease,
        failures: row.complianceFailures,
      })),
    },
    decisions: rows,
  };
}

/**
 * Reconstructing-tutor accuracy (stage v2 adapt-ON arm): per turn, the
 * tutor's committed theory of the learner's store against the harness-truth
 * snapshot the engine recorded beside it. `held` scores as Jaccard overlap;
 * `missing`/`mistaken` score as detection — of the gaps and false beliefs
 * that actually existed, how many did the tutor name? Arm-internal color
 * only: the OFF arm has no theory channel, so nothing here may cross arms.
 */
export function reconstructionReport(result) {
  const rows = result.reconstruction;
  if (!rows || !rows.length) return null;
  const rate = (n, d) => (d ? +(n / d).toFixed(3) : null);
  const setOf = (xs) => new Set((xs || []).map(String));
  const jaccard = (a, b) => {
    if (!a.size && !b.size) return 1;
    let inter = 0;
    for (const x of a) if (b.has(x)) inter += 1;
    return inter / (a.size + b.size - inter);
  };
  const perTurn = rows.map((row) => {
    const believedMissing = setOf(row.believed?.believed_missing);
    const believedMistaken = setOf(row.believed?.believed_mistaken);
    const truthMissing = setOf(row.truth?.missing);
    const truthMistaken = setOf(row.truth?.mistaken);
    return {
      turn: row.turn,
      heldJaccard: +jaccard(setOf(row.believed?.believed_held), setOf(row.truth?.held)).toFixed(3),
      missingActual: truthMissing.size,
      missingCaught: [...truthMissing].filter((id) => believedMissing.has(id)).length,
      mistakenActual: truthMistaken.size,
      mistakenCaught: [...truthMistaken].filter((id) => believedMistaken.has(id)).length,
    };
  });
  const sum = (sel) => perTurn.reduce((acc, r) => acc + sel(r), 0);
  return {
    turns: perTurn.length,
    meanHeldJaccard: +(sum((r) => r.heldJaccard) / perTurn.length).toFixed(3),
    missing: {
      actual: sum((r) => r.missingActual),
      caught: sum((r) => r.missingCaught),
      rate: rate(
        sum((r) => r.missingCaught),
        sum((r) => r.missingActual),
      ),
    },
    mistaken: {
      actual: sum((r) => r.mistakenActual),
      caught: sum((r) => r.mistakenCaught),
      rate: rate(
        sum((r) => r.mistakenCaught),
        sum((r) => r.mistakenActual),
      ),
    },
    perTurn,
  };
}

/**
 * C1 act-plot discipline (plan §5–6): per committed plot, harness-checkable
 * form and conduct measures — was the plot disciplined (withhold + friction
 * both present, the non-boilerplate shape), which exhibits do its clauses
 * name, and were the named hold exhibits actually staged within the plotted
 * act's span? Audits report the watcher's verdict mix. Arm-internal color
 * (the OFF arm has no plot channel); cross-arm endpoints stay the
 * harness-ledgered dramatic instruments.
 */
export function plotReport(result, world = null) {
  const block = result.plot;
  if (!block || (!block.plots?.length && !block.audits?.length)) return null;
  const plots = block.plots || [];
  const audits = block.audits || [];
  // Premise-id extraction is substring matching over the known id vocabulary
  // (world ledger when given, else the ids the run actually staged) — plot
  // clauses are free prose, so naming is the checkable part.
  const knownIds = world?.premiseById
    ? [...world.premiseById.keys()]
    : [...new Set((result.ledger || []).map((l) => l.premiseId))];
  const idsIn = (text) => knownIds.filter((id) => String(text || '').includes(id));
  const actSpan = new Map((result.acts || []).map((a) => [a.act, a.turns]));
  const stagedIn = (act) => {
    const span = actSpan.get(act);
    if (!span) return new Set();
    return new Set((result.ledger || []).filter((l) => l.turn >= span[0] && l.turn <= span[1]).map((l) => l.premiseId));
  };
  const perPlot = plots.map((p) => {
    const staged = stagedIn(p.act);
    const holdNamed = [...new Set((p.holdByEnd || []).flatMap((c) => idsIn(c)))];
    const withholdNamed = idsIn(p.withhold);
    const clauseCount = (p.holdByEnd || []).length + (p.withhold ? 1 : 0) + (p.friction ? 1 : 0) + (p.fallback ? 1 : 0);
    return {
      act: p.act,
      turn: p.turn,
      clauseCount,
      hasWithhold: Boolean(p.withhold),
      hasFriction: Boolean(p.friction),
      holdNamed,
      holdStagedInAct: holdNamed.filter((id) => staged.has(id)),
      withholdNamed,
      withholdPlayedInAct: withholdNamed.filter((id) => staged.has(id)),
    };
  });
  const verdictMix = { kept: 0, justified_deviation: 0, drift: 0, unscored: 0 };
  const perActAudit = audits.map((a) => {
    const mix = { kept: 0, justified_deviation: 0, drift: 0, unscored: 0 };
    for (const c of a.clauses || []) {
      const v = Object.hasOwn(mix, c.verdict) ? c.verdict : 'unscored';
      mix[v] += 1;
      verdictMix[v] += 1;
    }
    return { act: a.act, turn: a.turn, final: Boolean(a.final), clauses: (a.clauses || []).length, mix };
  });
  const sum = (sel) => perPlot.reduce((acc, r) => acc + sel(r), 0);
  return {
    plots: {
      count: perPlot.length,
      disciplined: perPlot.filter((r) => r.hasWithhold && r.hasFriction).length,
      meanClauses: perPlot.length ? +(sum((r) => r.clauseCount) / perPlot.length).toFixed(2) : null,
      perAct: perPlot,
    },
    audits: {
      count: perActAudit.length,
      finalIncluded: perActAudit.some((a) => a.final),
      verdictMix,
      perAct: perActAudit,
    },
    crossCheck: {
      holdNamed: sum((r) => r.holdNamed.length),
      holdStagedInAct: sum((r) => r.holdStagedInAct.length),
      withholdNamed: sum((r) => r.withholdNamed.length),
      withholdPlayedInAct: sum((r) => r.withholdPlayedInAct.length),
    },
    // Two-layer planning: present only when the run carried a throughline —
    // plot-only arms keep the exact C1 report shape.
    ...(block.throughlines?.length
      ? {
          throughline: (() => {
            const rows = block.throughlines;
            const byTrigger = { opening: 0, recommit: 0, audit_bound: 0, voluntary: 0 };
            for (const r of rows) {
              if (Object.hasOwn(byTrigger, r.trigger)) byTrigger[r.trigger] += 1;
            }
            const arcMix = { on_arc: 0, off_arc: 0, unscored: 0 };
            let arcCount = 0;
            for (const a of audits) {
              if (!a.arc) continue;
              arcCount += 1;
              arcMix[Object.hasOwn(arcMix, a.arc.verdict) ? a.arc.verdict : 'unscored'] += 1;
            }
            const finalRow = audits.find((a) => a.final && a.throughlineAudit?.length) || null;
            const finalMix = finalRow ? { kept: 0, justified_deviation: 0, drift: 0, unscored: 0 } : null;
            if (finalRow) {
              for (const c of finalRow.throughlineAudit) {
                finalMix[Object.hasOwn(finalMix, c.verdict) ? c.verdict : 'unscored'] += 1;
              }
            }
            return {
              count: rows.length,
              byTrigger,
              disciplined: rows.filter((r) => (r.arc || []).length && r.holdToEnd && r.risk && r.salvage).length,
              arcs: { count: arcCount, mix: arcMix },
              finalReckoning: finalRow ? { clauses: finalRow.throughlineAudit.length, mix: finalMix } : null,
            };
          })(),
        }
      : {}),
  };
}

function compactLogicFactNode(node) {
  return {
    factKey: node.factKey,
    fact: node.fact,
    predicate: node.predicate,
    roles: node.roles || [],
    rule: node.proof?.rule || null,
    sourcePremiseIds: node.sourcePremiseIds || [],
    proofCritical: Boolean(node.proofCritical),
  };
}

function targetLogicSummary(staticNode, runtimeNode, snapshot) {
  if (!staticNode) return null;
  const sourcePremiseIds = staticNode.sourcePremiseIds || staticNode.premiseIds || [];
  const grounded = new Set(snapshot.groundedPremiseIds || []);
  const released = new Set(snapshot.releasedPremiseIds || []);
  const decayed = new Set(snapshot.decayedPremiseIds || []);
  return {
    factKey: staticNode.factKey,
    fact: staticNode.fact,
    derived: Boolean(runtimeNode),
    grounded: Boolean(runtimeNode?.grounded),
    voiced: Boolean(runtimeNode?.voiced),
    sourcePremiseIds,
    heldSourcePremiseIds: sourcePremiseIds.filter((id) => grounded.has(id)),
    missingSourcePremiseIds: sourcePremiseIds.filter((id) => !grounded.has(id)),
    unreleasedSourcePremiseIds: sourcePremiseIds.filter((id) => !released.has(id)),
    decayedSourcePremiseIds: sourcePremiseIds.filter((id) => decayed.has(id)),
  };
}

export function logicProjectionReport(result, world) {
  if (!Array.isArray(result.logicSnapshots) || !result.logicSnapshots.length) return null;
  const worldIR = buildWorldIR(world);
  const staticNodeByKey = new Map(worldIR.logic.factNodes.map((node) => [node.factKey, node]));
  const proofCriticalIds = new Set(worldIR.logic.indexes.proofCriticalPremiseIds || []);
  const secretKey = worldIR.logic.indexes.secretFactKey;
  const mirrorKey = worldIR.logic.indexes.mirrorFactKey;

  const turns = result.logicSnapshots.map((snapshot) => {
    const nodes = snapshot.projection?.factNodes || [];
    const nodeByKey = new Map(nodes.map((node) => [node.factKey, node]));
    const derivedUnvoiced = nodes
      .filter(
        (node) =>
          node.derived &&
          !node.voiced &&
          !(node.roles || []).includes('secret') &&
          !(node.roles || []).includes('mirror'),
      )
      .map(compactLogicFactNode);
    const firedHyperedges = (snapshot.projection?.ruleHyperedges || []).map((edge) => {
      const output = nodeByKey.get(edge.outputFactKey) || staticNodeByKey.get(edge.outputFactKey) || null;
      return {
        ruleId: edge.ruleId,
        inputFactKeys: edge.inputFactKeys,
        outputFactKey: edge.outputFactKey,
        outputFact: output?.fact || null,
        outputPredicate: output?.predicate || null,
      };
    });

    return {
      turn: snapshot.turn,
      trajectoryD: snapshot.trajectoryD,
      boardD: snapshot.boardD,
      postTurnDDelta: snapshot.boardD - snapshot.trajectoryD,
      counts: {
        ...(snapshot.projection?.counts || {}),
        firedHyperedges: firedHyperedges.length,
        derivedUnvoiced: derivedUnvoiced.length,
      },
      secret: targetLogicSummary(staticNodeByKey.get(secretKey), nodeByKey.get(secretKey), snapshot),
      mirror: targetLogicSummary(staticNodeByKey.get(mirrorKey), nodeByKey.get(mirrorKey), snapshot),
      decayedProofCriticalSources: (snapshot.decayedPremiseIds || []).filter((id) => proofCriticalIds.has(id)),
      derivedUnvoiced,
      firedHyperedges,
    };
  });

  return {
    schema: LOGIC_PROJECTION_REPORT_SCHEMA,
    worldIRSchema: worldIR.logic.schema,
    turns,
    summary: {
      turns: turns.length,
      derivedUnvoicedPeak: Math.max(0, ...turns.map((row) => row.counts.derivedUnvoiced || 0)),
      firedHyperedgesPeak: Math.max(0, ...turns.map((row) => row.counts.firedHyperedges || 0)),
      secretDerivedTurns: turns.filter((row) => row.secret?.derived).map((row) => row.turn),
      mirrorDerivedTurns: turns.filter((row) => row.mirror?.derived).map((row) => row.turn),
      decayedProofCriticalTurns: turns
        .filter((row) => row.decayedProofCriticalSources.length)
        .map((row) => ({ turn: row.turn, premises: row.decayedProofCriticalSources })),
    },
  };
}

export function sceneReport(result) {
  const scenes = result.scenes || [];
  if (!scenes.length) return null;
  const statusMix = {};
  const exchangeTypes = {};
  const tempoBeats = {};
  const cognitiveTempo = {};
  const recognitionNeed = { byLevel: {}, peakDebt: 0, sources: {} };
  const phaticRecognition = { total: 0, byRole: {}, byType: {} };
  let exchanges = 0;
  let phatic = 0;
  for (const line of result.transcript || []) {
    for (const signal of line.meta?.phaticRecognition || []) {
      phaticRecognition.total += 1;
      phaticRecognition.byRole[signal.role] = (phaticRecognition.byRole[signal.role] || 0) + 1;
      phaticRecognition.byType[signal.type] = (phaticRecognition.byType[signal.type] || 0) + 1;
    }
    const need = line.role === 'learner' ? line.meta?.scene?.recognitionNeed : null;
    if (need?.level) {
      recognitionNeed.byLevel[need.level] = (recognitionNeed.byLevel[need.level] || 0) + 1;
      recognitionNeed.peakDebt = Math.max(recognitionNeed.peakDebt, Number(need.debt) || 0);
      for (const source of need.sources || []) {
        recognitionNeed.sources[source] = (recognitionNeed.sources[source] || 0) + 1;
      }
    }
  }
  for (const scene of scenes) {
    statusMix[scene.status] = (statusMix[scene.status] || 0) + 1;
    for (const exchange of scene.exchanges || []) {
      exchanges += 1;
      exchangeTypes[exchange.type] = (exchangeTypes[exchange.type] || 0) + 1;
      if (exchange.tempo) tempoBeats[exchange.tempo] = (tempoBeats[exchange.tempo] || 0) + 1;
      if (exchange.cognitiveTempo?.mode) {
        cognitiveTempo[exchange.cognitiveTempo.mode] = (cognitiveTempo[exchange.cognitiveTempo.mode] || 0) + 1;
      }
      if (exchange.type === 'phatic_ack') phatic += 1;
    }
  }
  return {
    schema: 'dramatic-derivation.scene-report.v0',
    count: scenes.length,
    exchanges,
    avgExchanges: scenes.length ? +(exchanges / scenes.length).toFixed(2) : 0,
    phatic,
    phaticShare: exchanges ? +(phatic / exchanges).toFixed(3) : 0,
    statusMix,
    exchangeTypes,
    tempoBeats,
    cognitiveTempo,
    recognitionNeed,
    phaticRecognition,
    driftGuardScenes: scenes.filter((scene) => scene.status === 'drift_guard').map((scene) => scene.index),
    scenes: scenes.map((scene) => ({
      index: scene.index,
      turns: [scene.startTurn, scene.endTurn],
      status: scene.status,
      closeReason: scene.closeReason,
      goal: scene.goal,
      targetPremise: scene.targetPremise,
      exchanges: (scene.exchanges || []).map((exchange) => ({
        turn: exchange.turn,
        type: exchange.type,
        tempo: exchange.tempo || null,
        cognitiveTempo: exchange.cognitiveTempo || null,
        phaticRecognition: exchange.phaticRecognition || [],
        dDelta: exchange.dDelta,
        boardDelta: exchange.boardDelta,
      })),
    })),
  };
}

export function diagnose(result, world) {
  const eventsByType = {};
  for (const event of result.events) {
    eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
  }
  const firstReleaseTurn = result.ledger.length ? result.ledger[0].turn : null;
  const perRole = {};
  for (const line of result.transcript) {
    if (line.meta?.prologue) continue;
    const stats = (perRole[line.role] ||= { turns: 0, sentences: 0, maxSentences: 0, words: 0 });
    const n = countSentences(line.text);
    stats.turns += 1;
    stats.sentences += n;
    stats.maxSentences = Math.max(stats.maxSentences, n);
    stats.words += (line.text || '').split(/\s+/).filter(Boolean).length;
  }
  for (const stats of Object.values(perRole)) {
    stats.avgSentences = stats.turns ? +(stats.sentences / stats.turns).toFixed(2) : 0;
    stats.avgWords = stats.turns ? +(stats.words / stats.turns).toFixed(1) : 0;
    delete stats.sentences;
    delete stats.words;
  }

  const segments = stagingSegments(result, world);
  const movements = segments.filter((s) => s.source === 'director');
  // P1 dial reporters — null (and the diagnosis keys absent) off their arms.
  const releaseDeviationsReport = releaseDeviations(result);
  const confrontation = confrontReport(result);
  const proofDebt = proofDebtGuardReport(result);
  const conductPolicy = conductPolicyReport(result);
  const logicProjection = logicProjectionReport(result, world);
  const scenes = sceneReport(result);
  // C1 dial reporter — same contract: null off the plot arm.
  const plotRpt = plotReport(result, world);
  const tutorNotes = result.transcript
    .filter((line) => line.role === 'director' && line.meta?.tutorNote)
    .map((line) => ({ turn: line.turn, text: line.meta.tutorNote }));
  // The tutor's own interventions (superego deliberation), readable like the
  // legacy director notes were — what was seen, what was said, what changed.
  const superegoNotes = result.transcript
    .filter((line) => line.role === 'tutor' && line.meta?.deliberation?.intervened)
    .map((line) => ({
      turn: line.turn,
      draftFigure: line.meta.deliberation.draftFigure || null,
      figure: line.meta.move?.figure || null,
      diagnosis: line.meta.deliberation.diagnosis || null,
      note: line.meta.deliberation.note || null,
    }));

  return {
    worldId: result.worldId,
    verdict: result.verdict,
    turnsPlayed: result.turnsPlayed,
    turnCap: world.turnCap,
    firstForcedTurn: result.firstForcedTurn,
    assertedGroundedTurn: result.assertedGroundedTurn,
    forcedToAssertedGap:
      result.firstForcedTurn !== null && result.assertedGroundedTurn !== null
        ? result.assertedGroundedTurn - result.firstForcedTurn
        : null,
    dCurve: result.trajectory.map((p) => p.D),
    learningSlope: learningSlope(result, world, segments),
    longestPlateau:
      firstReleaseTurn === null ? 0 : longestPlateau(result.trajectory, firstReleaseTurn, result.firstForcedTurn),
    aporiaWindow: world.slope.aporia_window,
    eventsByType,
    fabricatedFacts: result.events.filter((e) => e.type === 'fabricated_fact').map((e) => e.detail),
    releaseAdherence: releaseAdherence(world, result.ledger, result.turnsPlayed),
    staging: {
      source: movements.length ? 'director' : 'sketch',
      movements: movements.map((s) => ({ turn: s.turns[0], name: s.title, intent: s.intent })),
      tutorNotes,
    },
    superegoNotes,
    tutorFigures: tutorFigures(result),
    learnerInference: learnerInference(result),
    dialogueDiscipline: perRole,
    proofExtracted: Boolean(result.proof),
    ...(result.stagePrologue ? { stagePrologue: result.stagePrologue } : {}),
    ...(result.corruption ? { corruption: corruptionReport(result) } : {}),
    // Stage v2 (acts mode / adapt-ON arm); absent keys keep the OFF-state
    // diagnosis object byte-identical to its pre-v2 shape.
    ...(result.acts ? { acts: result.acts } : {}),
    ...(result.reconstruction ? { reconstruction: reconstructionReport(result) } : {}),
    // P1 dials (C2 release authority / C5 confrontation); both reporters
    // return null on arms without their dial, so the keys stay absent.
    ...(releaseDeviationsReport ? { releaseDeviations: releaseDeviationsReport } : {}),
    ...(confrontation ? { confrontation } : {}),
    ...(proofDebt ? { proofDebt } : {}),
    ...(conductPolicy ? { conductPolicyReport: conductPolicy } : {}),
    ...(logicProjection ? { logicProjection } : {}),
    ...(result.directorCadence ? { directorCadence: result.directorCadence } : {}),
    ...(result.publicRegister ? { publicRegister: result.publicRegister } : {}),
    ...(result.publicRegisters ? { publicRegisters: result.publicRegisters } : {}),
    ...(scenes ? { scenes } : {}),
    // C1 (act-plot dial): absent off the arm.
    ...(plotRpt ? { plot: plotRpt } : {}),
  };
}

/**
 * ASCII D(t) staircase for the console + note files. Optional markers turn
 * the picture into a readable slope instrument: `acts` draws a vertical bar
 * at each act boundary (so per-act slope is visible as the staircase pitch
 * between bars), `releaseTurns` adds a ▲ tick row under the axis, and
 * `slope` (the diagnose() learningSlope block) appends per-act rates.
 */
export function renderDCurve(trajectory, { acts = null, releaseTurns = null, slope = null } = {}) {
  if (!trajectory.length) return '(no trajectory)';
  const maxD = Math.max(...trajectory.map((p) => p.D), 1);
  const actStarts = new Set((acts || []).map((a) => a.turns[0]).filter((t) => t > trajectory[0].turn));
  const row = (cell) => trajectory.map((p) => `${actStarts.has(p.turn) ? '│' : ''}${cell(p)}`).join('');
  const lines = [];
  for (let level = maxD; level >= 0; level -= 1) {
    lines.push(
      `D=${String(level).padStart(2)} ${row((p) => (p.D === level ? (p.forced ? '◉' : '●') : p.D > level ? ' ' : '·'))}`,
    );
  }
  lines.push(
    `turn  ${row((p) => (p.turn % 10 === 0 ? String((p.turn / 10) % 10) : p.turn % 5 === 0 ? '+' : ' '))} (+=5, digit=x10)`,
  );
  if (releaseTurns instanceof Set && releaseTurns.size) {
    lines.push(`rel   ${row((p) => (releaseTurns.has(p.turn) ? '▲' : ' '))} (▲ = evidence released)`);
  }
  if (slope) {
    const perAct = (slope.perAct || [])
      .map((a) => `${a.act} ${a.ratePerTurn === null ? '—' : a.ratePerTurn.toFixed(2)}`)
      .join(' │ ');
    const overall = slope.overall?.ratePerTurn;
    lines.push(
      `slope ${overall === null || overall === undefined ? '—' : overall.toFixed(2)} D/turn overall (D ${slope.d0}→${slope.dFinal})${perAct ? `; per movement: ${perAct}` : ''}`,
    );
  }
  return lines.join('\n');
}

/**
 * The drama as a readable artifact: movements, lines, releases, proof (tree +
 * prose), instrument panel, and — when the loop ran the critic — the notice
 * at the foot. `commentary` is the finished prose (byline included by the
 * caller); this renderer only places it.
 */
export function renderTranscript(result, world, { title = null, diagnosis = null, commentary = null } = {}) {
  const segments = stagingSegments(result, world);
  const panel = diagnosis || diagnose(result, world);
  const lines = [];
  lines.push(`# ${title || `${world.title} — ${result.verdict}`}`);
  lines.push('');
  lines.push(`> world \`${world.id}\` · verdict **${result.verdict}** · ${result.turnsPlayed}/${world.turnCap} turns`);
  if (result.firstForcedTurn !== null) {
    lines.push(
      `> S forced at turn ${result.firstForcedTurn}${result.assertedGroundedTurn !== null ? `; asserted grounded at turn ${result.assertedGroundedTurn}` : '; never asserted'}`,
    );
  }
  lines.push('');
  lines.push('```');
  lines.push(
    renderDCurve(result.trajectory, {
      acts: segments,
      releaseTurns: new Set(result.ledger.map((entry) => entry.turn)),
      slope: panel.learningSlope || learningSlope(result, world, segments),
    }),
  );
  lines.push('```');

  if (result.stagePrologue) {
    lines.push('');
    lines.push("## Director's opening notes");
    lines.push(`*${result.stagePrologue.stageNotes}*`);
    lines.push('');
    lines.push(`- **Tutor:** ${result.stagePrologue.tutorCharacter}`);
    lines.push(`- **Learner:** ${result.stagePrologue.learnerCharacter}`);
    if (result.stagePrologue.registerNote) {
      lines.push(`- **Register:** ${result.stagePrologue.registerNote}`);
    }
  }

  let currentSegment = null;
  const segmentFor = (turn) => segments.find((s) => turn >= s.turns[0] && turn <= s.turns[1]) || null;
  const byTurn = new Map();
  for (const line of result.transcript) {
    if (line.meta?.prologue) continue;
    if (!byTurn.has(line.turn)) byTurn.set(line.turn, []);
    byTurn.get(line.turn).push(line);
  }
  const eventsByTurn = new Map();
  for (const event of result.events) {
    if (!eventsByTurn.has(event.turn)) eventsByTurn.set(event.turn, []);
    eventsByTurn.get(event.turn).push(event);
  }
  const sceneByTurn = new Map();
  for (const scene of result.scenes || []) {
    for (const exchange of scene.exchanges || []) {
      sceneByTurn.set(exchange.turn, { scene, exchange });
    }
  }

  for (const [turn, turnLines] of [...byTurn.entries()].sort((a, b) => a[0] - b[0])) {
    const segment = segmentFor(turn);
    if (segment && segment !== currentSegment) {
      currentSegment = segment;
      lines.push('');
      lines.push(
        `## ${segment.title} (turns ${segment.turns[0]}–${segment.turns[1]})${segment.source === 'director' ? ' — declared by the director' : ''}`,
      );
      if (segment.intent) lines.push(`*${segment.intent}*`);
    }
    lines.push('');
    const sceneInfo = sceneByTurn.get(turn);
    lines.push(
      sceneInfo
        ? `### Scene ${sceneInfo.scene.index}, exchange ${sceneInfo.exchange.ordinal} — Turn ${turn}`
        : `### Turn ${turn}`,
    );
    if (sceneInfo && sceneInfo.exchange.ordinal === 1) {
      lines.push(`*Scene goal: ${sceneInfo.scene.goal}*`);
    }
    if (sceneInfo?.exchange?.tempo) {
      lines.push(`*Tempo: ${sceneInfo.exchange.tempo.replace(/_/g, ' ')}*`);
    }
    for (const line of turnLines) {
      if (line.role === 'director') {
        if (!publicStageLine(line)) continue;
        lines.push(`*${(line.text || '').trim()}*`);
        if (line.meta?.release) lines.push(`  — *releases \`${line.meta.release}\`*`);
        if (line.meta?.phase) {
          lines.push(
            `  — *declares the movement: **${line.meta.phase.name}**${line.meta.phase.intent ? ` (${line.meta.phase.intent})` : ''}*`,
          );
        }
        if (line.meta?.tutorNote) lines.push(`  — *note to the tutor: "${line.meta.tutorNote}"*`);
        if (line.meta?.act === 'end') lines.push('  — *calls the act closed*');
      } else if (line.role === 'tutor') {
        lines.push(`**Tutor:** ${(line.text || '').trim()}`);
        const move = line.meta?.move;
        if (move)
          lines.push(
            `  — move: ${move.figure || '—'} → ${move.targetPremise || '—'} (${move.intent || '—'})${line.meta?.release ? `, releases \`${line.meta.release}\`` : ''}`,
          );
        const delib = line.meta?.deliberation;
        if (delib?.intervened) {
          const changed =
            delib.draftFigure && move?.figure && delib.draftFigure !== move.figure
              ? ` (draft ${delib.draftFigure} → ${move.figure})`
              : ' (figure held)';
          const jurisdiction = delib.jurisdiction ? ` [${delib.jurisdiction.replace(/_/g, ' ')}]` : '';
          lines.push(`  — *the second voice${jurisdiction}: "${delib.note}"${changed}*`);
        }
        const theory = line.meta?.theory;
        if (theory) {
          lines.push(
            `  — *theory of the learner: ${(theory.believed_held || []).length} held · ${(theory.believed_missing || []).length} missing · ${(theory.believed_mistaken || []).length} mistaken*`,
          );
        }
        if (line.meta?.phaticRecognition?.length) {
          lines.push(
            `  — phatic recognition: ${line.meta.phaticRecognition.map((s) => s.type.replace(/_/g, ' ')).join(', ')}`,
          );
        }
      } else if (line.role === 'learner') {
        lines.push(`**Learner:** ${(line.text || '').trim()}`);
        const meta = line.meta || {};
        const bits = [];
        if (meta.adopt?.length) bits.push(`adopts ${meta.adopt.map((f) => `\`${f.join(' ')}\``).join(', ')}`);
        if (meta.retract?.length) bits.push(`retracts ${meta.retract.map((f) => `\`${f.join(' ')}\``).join(', ')}`);
        const voicedHere = (meta.deriveOutcomes || []).filter((o) => o.status === 'voiced');
        if (voicedHere.length) bits.push(`derives ${voicedHere.map((o) => `\`${o.fact.join(' ')}\``).join(', ')}`);
        if (meta.hypothesis) bits.push(`hypothesis: ${meta.hypothesis}`);
        if (meta.asserts) bits.push(`**asserts \`${meta.asserts.join(' ')}\`**`);
        if (meta.exchange?.type) bits.push(`exchange: ${meta.exchange.type.replace(/_/g, ' ')}`);
        if (meta.exchange?.cognitiveTempo?.mode)
          bits.push(`cognitive tempo: ${meta.exchange.cognitiveTempo.mode.replace(/_/g, ' ')}`);
        if (meta.phaticRecognition?.length)
          bits.push(`phatic recognition: ${meta.phaticRecognition.map((s) => s.type.replace(/_/g, ' ')).join(', ')}`);
        if (bits.length) lines.push(`  — ${bits.join(' · ')}`);
      }
    }
    for (const event of eventsByTurn.get(turn) || []) {
      lines.push(`  ⚑ **${event.type}** — ${event.detail}`);
    }
  }

  if (result.proof) {
    lines.push('');
    lines.push('## The extracted proof (what did the forcing)');
    lines.push('```');
    lines.push(renderProof(result.proof));
    lines.push('```');
    const prose = renderProofProse(result.proof, world, { ledger: result.ledger });
    if (prose) {
      lines.push('');
      lines.push(prose);
    }
  }
  lines.push('');
  lines.push(renderEvalPanel(panel));
  if (commentary) {
    lines.push('');
    lines.push("## Critic's commentary");
    lines.push('');
    lines.push(commentary.trim());
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * The instrument panel as markdown — the foot of every transcript (operator
 * request 2026-06-09: "report on the eval at the bottom of the transcript").
 * Pure formatting over diagnose() output; no judge anywhere. `dials`, when
 * the loop attached them, are echoed so a transcript carries its own
 * operator settings.
 */
export function renderEvalPanel(diagnosis) {
  const d = diagnosis;
  const lines = [];
  lines.push('## Instrument panel (programmatic eval — no judge)');
  lines.push('');
  lines.push(`- **verdict** \`${d.verdict}\` · ${d.turnsPlayed}/${d.turnCap} turns played`);
  const recognition =
    d.firstForcedTurn === null
      ? 'S never forced — the learner’s board never compelled the conclusion'
      : `S forced at turn ${d.firstForcedTurn}${
          d.assertedGroundedTurn !== null
            ? `, asserted grounded at turn ${d.assertedGroundedTurn} (gap ${d.forcedToAssertedGap})`
            : ', never asserted'
        }`;
  lines.push(`- **recognition** ${recognition}`);
  const slope = d.learningSlope;
  if (slope) {
    lines.push(
      `- **learning slope** ${slope.overall.ratePerTurn ?? '—'} D/turn overall (D ${slope.d0}→${slope.dFinal} over ${slope.overall.turns} turns)`,
    );
    for (const a of slope.perAct || []) {
      lines.push(
        `  - ${a.title || `movement ${a.act}`} (turns ${a.turns[0]}–${a.turns[1]}): ${a.ratePerTurn === null ? '—' : `${a.ratePerTurn} D/turn`}${a.delta !== null ? ` (ΔD ${a.delta})` : ''}`,
      );
    }
  }
  lines.push(`- **plateau** longest flat stretch ${d.longestPlateau} turns (aporia window ${d.aporiaWindow})`);
  const ra = d.releaseAdherence;
  if (ra) {
    const bits = [`${ra.onCue}/${ra.rows.length} on cue`];
    if (ra.deviations.length) bits.push(`${ra.deviations.length} deviated`);
    if (ra.missed.length) bits.push(`${ra.missed.length} missed`);
    if (ra.unscheduled.length) bits.push(`${ra.unscheduled.length} unscheduled`);
    lines.push(`- **releases** ${bits.join(' · ')}`);
  }
  const cr = d.corruption;
  if (cr) {
    lines.push(
      `- **decay** ${cr.decayEvents} slip${cr.decayEvents === 1 ? '' : 's'} (seed ${cr.config.seed} · rate ${cr.config.rate} · grace ${cr.config.graceTurns}) · repaired ${cr.repairs.total} (tutor ${cr.repairs.byTutor}, re-adoption ${cr.repairs.byReadoption})${
        cr.meanRepairLatency !== null ? ` · mean repair latency ${cr.meanRepairLatency} turns` : ''
      } · unrepaired at end ${cr.unrepairedAtEnd} · degraded-turn integral ${cr.degradedTurnIntegral} · D reversals ${cr.dReversals}`,
    );
    if (cr.mutations?.total) {
      lines.push(
        `- **mutations** ${cr.mutations.total} of the slips misremembered (false belief staged) · false form struck ${cr.mutations.retracted} · fully revised (struck + restored) ${cr.mutations.revised} · false beliefs held to the end ${cr.mutations.falseBeliefsAtEnd}`,
      );
    }
    if (cr.fidelity) {
      lines.push(`- **theory fidelity** F ${cr.fidelity.final} at end · min ${cr.fidelity.min}`);
    }
    if (cr.timeline.length) {
      const rows = cr.timeline.map((t) => {
        const head = `${t.premiseId || t.fact.join(' ')} t${t.decayTurn}`;
        const repair =
          t.repairTurn !== null
            ? `→t${t.repairTurn} (${t.via === 'tutor' ? 'tutor' : 're-adoption'})`
            : ' (never repaired)';
        if (t.mode !== 'mutate') return `${head}${repair}`;
        const strike = t.retractTurn !== null ? `false form struck t${t.retractTurn}` : 'false belief held to the end';
        return `${head} misremembered as "${(t.falseForm || []).join(' ')}"${repair}; ${strike}`;
      });
      lines.push(`  - ${rows.join(' · ')}`);
    }
  }
  const pd = d.proofDebt;
  if (pd) {
    lines.push(
      `- **proof debt** detected on ${pd.detectedTurns} turn${pd.detectedTurns === 1 ? '' : 's'} (${pd.debtsDetected} debt${pd.debtsDetected === 1 ? '' : 's'}) · restore actions ${pd.actionTurns} (guard-forced ${pd.forcedMoves}, repaired ${pd.repairedTargets})${pd.targets.length ? ` — ${pd.targets.join(' · ')}` : ''}`,
    );
  }
  const cp = d.conductPolicyReport;
  if (cp) {
    const active = cp.activeTurns;
    const families = Object.entries(cp.moveFamilies || {})
      .filter(([family]) => family !== '(none)')
      .map(([family, count]) => `${family}×${count}`);
    lines.push(
      `- **conduct policy** logged ${cp.loggedTurns} tutor turn${cp.loggedTurns === 1 ? '' : 's'} · active ${active} · ${
        families.length ? families.join(' · ') : 'no active move-family trigger'
      } · compliance ${
        cp.complianceChecked
          ? `${cp.compliance.passed}/${cp.compliance.checked} pass${cp.compliance.failed ? `, ${cp.compliance.failed} fail` : ''}`
          : 'not checked'
      }`,
    );
  }
  const lp = d.logicProjection?.summary;
  if (lp) {
    lines.push(
      `- **logic projection** ${lp.turns} turn snapshot${lp.turns === 1 ? '' : 's'} · derived-unvoiced peak ${lp.derivedUnvoicedPeak} · fired hyperedges peak ${lp.firedHyperedgesPeak}`,
    );
  }
  const events = Object.entries(d.eventsByType || {});
  lines.push(`- **events** ${events.length ? events.map(([k, v]) => `${k}×${v}`).join(' · ') : 'none'}`);
  if (d.publicRegister && d.publicRegister !== 'default') {
    lines.push(`- **style** public register ${describePublicRegister(d.publicRegister)}`);
    if (d.publicRegisters?.length) {
      if (d.publicRegisters.length === 1) {
        lines.push(`  - sampled register: ${d.publicRegisters[0].register}`);
      } else {
        lines.push(
          `  - sampled sequence: ${d.publicRegisters.map((row) => `t${row.turn} ${row.register}`).join(' · ')}`,
        );
      }
    }
  }
  if (d.stagePrologue) {
    lines.push('- **prologue** director opening notes and tutor/learner character sketches present');
  }
  if (d.staging) {
    const movements = d.staging.movements.length;
    const notes = d.staging.tutorNotes.length;
    lines.push(
      `- **staging** ${
        d.staging.source === 'director'
          ? `${movements} movement${movements === 1 ? '' : 's'} declared by the director`
          : "no movements declared (author's sketch held)"
      }${notes ? ` · ${notes} note${notes === 1 ? '' : 's'} to the tutor` : ''}`,
    );
  }
  if (d.acts && d.acts.length) {
    const closedBy = { director: 0, harness_max: 0, run_end: 0 };
    for (const a of d.acts) closedBy[a.endedBy] = (closedBy[a.endedBy] || 0) + 1;
    const rows = d.acts.map((a) => `Act ${a.act} t${a.turns[0]}–${a.turns[1]} (${a.endedBy.replace(/_/g, ' ')})`);
    lines.push(
      `- **acts** ${d.acts.length} played · closed by the director ${closedBy.director} · at max length ${closedBy.harness_max} · at run end ${closedBy.run_end} — ${rows.join(' · ')}`,
    );
  }
  const sc = d.scenes;
  if (sc) {
    const status = Object.entries(sc.statusMix)
      .map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`)
      .join(' · ');
    const exchanges = Object.entries(sc.exchangeTypes)
      .map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`)
      .join(' · ');
    const tempos = Object.entries(sc.tempoBeats || {})
      .map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`)
      .join(' · ');
    const cognitiveTempo = Object.entries(sc.cognitiveTempo || {})
      .map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`)
      .join(' · ');
    const recognitionNeed = Object.entries(sc.recognitionNeed?.sources || {})
      .map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`)
      .join(' · ');
    const phaticRecognition = Object.entries(sc.phaticRecognition?.byType || {})
      .map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`)
      .join(' · ');
    lines.push(
      `- **scenes** ${sc.count} scene${sc.count === 1 ? '' : 's'} · ${sc.exchanges} exchange${sc.exchanges === 1 ? '' : 's'} (${sc.avgExchanges} avg) · phatic ${sc.phatic}/${sc.exchanges} (${Math.round(sc.phaticShare * 100)}%)${d.directorCadence ? ` · director ${d.directorCadence}` : ''} · statuses ${status || 'none'}`,
    );
    if (exchanges) lines.push(`  - exchanges: ${exchanges}`);
    if (tempos) lines.push(`  - tempo: ${tempos}`);
    if (cognitiveTempo) lines.push(`  - cognitive tempo: ${cognitiveTempo}`);
    if (sc.recognitionNeed?.peakDebt)
      lines.push(`  - recognition need: peak ${sc.recognitionNeed.peakDebt.toFixed(2)}${recognitionNeed ? ` · ${recognitionNeed}` : ''}`);
    if (sc.phaticRecognition?.total) lines.push(`  - phatic recognition: ${phaticRecognition}`);
    if (sc.driftGuardScenes.length) lines.push(`  - drift guard scenes: ${sc.driftGuardScenes.join(', ')}`);
  }
  const rc = d.reconstruction;
  if (rc) {
    const det = (b) => `${b.caught}/${b.actual}${b.rate !== null ? ` (${Math.round(b.rate * 100)}%)` : ''}`;
    lines.push(
      `- **reconstruction** ${rc.turns} theory commits · held-set overlap ${rc.meanHeldJaccard} mean Jaccard · gaps caught ${det(rc.missing)} · false beliefs caught ${det(rc.mistaken)}`,
    );
  }
  const pl = d.plot;
  if (pl) {
    const vm = pl.audits.verdictMix;
    lines.push(
      `- **plot** ${pl.plots.count} committed · withhold+friction on ${pl.plots.disciplined}/${pl.plots.count} · ${pl.plots.meanClauses ?? '—'} clauses avg · audits ${pl.audits.count}${
        pl.audits.finalIncluded ? ' (incl. final act)' : ''
      }: kept ${vm.kept} / justified ${vm.justified_deviation} / drift ${vm.drift}${
        vm.unscored ? ` / unscored ${vm.unscored}` : ''
      } · hold-named exhibits staged in act ${pl.crossCheck.holdStagedInAct}/${pl.crossCheck.holdNamed}`,
    );
    const tl = pl.throughline;
    if (tl) {
      const fr = tl.finalReckoning;
      lines.push(
        `- **throughline** ${tl.count} commit${tl.count === 1 ? '' : 's'} (opening ${tl.byTrigger.opening} · recommit ${tl.byTrigger.recommit} · audit-bound ${tl.byTrigger.audit_bound} · voluntary ${tl.byTrigger.voluntary}) · all four clauses on ${tl.disciplined}/${tl.count} · arc verdicts ${tl.arcs.count}: on ${tl.arcs.mix.on_arc} / off ${tl.arcs.mix.off_arc}${
          tl.arcs.mix.unscored ? ` / unscored ${tl.arcs.mix.unscored}` : ''
        } · run-end reckoning ${
          fr
            ? `${fr.clauses} clauses: kept ${fr.mix.kept} / justified ${fr.mix.justified_deviation} / drift ${fr.mix.drift}${fr.mix.unscored ? ` / unscored ${fr.mix.unscored}` : ''}`
            : 'absent'
        }`,
      );
    }
  }
  const rd = d.releaseDeviations;
  if (rd) {
    lines.push(
      `- **release authority** ${rd.played} played: ${rd.onSchedule} on schedule · ${rd.held} held · ${rd.early} early · forced at hold limit ${rd.forced} · overridden ${rd.overridden} · invalid claims ${rd.invalidClaims}`,
    );
    for (const r of rd.reasons) {
      if (r.offset) {
        lines.push(`  - ${r.premise} ${r.offset > 0 ? `+${r.offset}` : r.offset} (t${r.turn}): "${r.reason}"`);
      }
    }
  }
  const cf = d.confrontation;
  if (cf) {
    const absences = cf.confrontations.filter((c) => c.targetDecayed === true).length;
    const knowsDecay = cf.confrontations.some((c) => c.targetDecayed !== null);
    lines.push(
      `- **confrontation** ${cf.confrontations.length} demanded${
        knowsDecay ? ` (${absences} against a slipped exhibit)` : ''
      } · re-entries ${cf.reentries.total}: covered ${cf.reentries.covered}, uncovered ${cf.reentries.uncovered.length} · watcher fires ${cf.superego.reentryFires} (became the confrontation ${cf.superego.convertedToConfront}) · fires without recorded due ${cf.superego.firesWithoutDue}`,
    );
    if (cf.reentries.uncovered.length) {
      lines.push(
        `  - uncovered: ${cf.reentries.uncovered.map((r) => `${r.target} t${r.turn} (${r.intent || 'no intent'})`).join(' · ')}`,
      );
    }
    if (cf.restores) {
      const repaired = cf.restores.filter((r) => r.repaired === true).length;
      const knowsRepair = cf.restores.some((r) => r.repaired !== null);
      lines.push(
        `  - **repair clause** restores ${cf.restores.length}${
          knowsRepair ? ` (${repaired} repaired a real slip)` : ''
        } · watcher fires on restore claims ${cf.superego.restoreClaimFires}: ${cf.restores
          .map((r) => `${r.target} t${r.turn}`)
          .join(' · ')}`,
      );
    }
  }
  if (d.dials && (d.dials.recognition || d.dials.charisma)) {
    lines.push(`- **dials** recognition ${d.dials.recognition || 0}/3 · charisma ${d.dials.charisma || 0}/3`);
  }
  if (d.dramaturgy === 'frozen') {
    lines.push('- **dramaturgy** frozen (control: the director cannot declare movements)');
  }
  const tf = d.tutorFigures;
  if (tf && tf.total) {
    const fmt = (r) => (r === null || r === undefined ? '—' : r.toFixed(2));
    lines.push(
      `- **figures** ${tf.topFigure} ${tf.counts[tf.topFigure]}/${tf.total} (${Math.round((tf.topShare || 0) * 100)}%) · ${tf.distinct} distinct · switch rate ${fmt(tf.switchRate)}${
        tf.noteTurns ? ` (on note turns ${fmt(tf.switchOnNoteTurns)} vs elsewhere ${fmt(tf.switchElsewhere)})` : ''
      }`,
    );
    const sg = tf.superego;
    if (sg) {
      lines.push(
        `- **superego** intervened ${sg.interventions}/${sg.watched} watched turns · figure changed within-turn on ${sg.withinTurnChanges}/${sg.interventions} interventions${
          sg.switchOnIntervention !== null
            ? ` · switch on intervention ${fmt(sg.switchOnIntervention)} vs elsewhere ${fmt(sg.switchElsewhere)}`
            : ''
        }`,
      );
      const sw = sg.stallWatch;
      if (sw) {
        const a = sw.audit;
        lines.push(
          `- **stall watch** fires by jurisdiction: figure rut ${sw.byJurisdiction.figure_rut} · stalled inference ${sw.byJurisdiction.stalled_inference} · detector audit ${
            a.clean
              ? `CLEAN (${a.fired}/${a.due} due fires, 0 false, ${a.turns} turns)`
              : `MISMATCH (missed ${a.missedFires.join(',') || '—'}; false ${a.falseFires.join(',') || '—'})`
          }`,
        );
      }
    }
  }
  const li = d.learnerInference;
  if (li && (li.nodes.length || li.voicedCount || li.overreachCount || li.mischanneledCount)) {
    const nodeBits = li.nodes.map(
      (n) =>
        `\`${n.fact.join(' ')}\` available t${n.firstAvailable} → ${
          n.censored ? `unvoiced at end (age ${n.ageAtEnd})` : `voiced t${n.firstVoiced} (latency ${n.latency})`
        }${n.stallTurns ? `, ${n.stallTurns} stall turn${n.stallTurns === 1 ? '' : 's'}` : ''}`,
    );
    lines.push(
      `- **inference** ${li.voicedCount} voiced · stall integral ${li.stallIntegral} · overreach ${li.overreachCount} · mischanneled ${li.mischanneledCount}${
        nodeBits.length ? ` — ${nodeBits.join(' · ')}` : ''
      }`,
    );
    if (li.stallFires.length) {
      const fireBits = li.stallFires.map(
        (f) =>
          `t${f.turn} → ${f.stalled ? `\`${f.stalled.join(' ')}\`` : '(no due item)'}${f.target ? ` via ${f.target}` : ''}${f.obeyed ? '' : ' (target disobeyed)'}${
            f.voicedTurn !== null ? `, voiced t${f.voicedTurn}` : ', never voiced'
          }`,
      );
      lines.push(
        `- **stall fires** ${li.stallFires.length}: uptake within 3 turns ${li.postFireUptake.uptaken}/${li.postFireUptake.fires} · target obeyed ${li.targetObedience.obeyed}/${li.targetObedience.fires} — ${fireBits.join(' · ')}`,
      );
    }
  }
  const roles = Object.entries(d.dialogueDiscipline || {});
  if (roles.length) {
    lines.push('');
    lines.push('| role | turns | avg sentences | max | avg words |');
    lines.push('|------|-------|---------------|-----|-----------|');
    for (const [role, s] of roles) {
      lines.push(`| ${role} | ${s.turns} | ${s.avgSentences} | ${s.maxSentences} | ${s.avgWords} |`);
    }
  }
  return lines.join('\n');
}

/** "writtenDuring" → "written during"; "heronStock" → "heron stock". */
function humanizeToken(token) {
  return String(token)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
}

/**
 * A fact array as a readable phrase. Facts are [predicate, args...]; the
 * binary case reads subject-predicate-object ("liane composed nocturne").
 */
function humanizeFact(fact) {
  if (!Array.isArray(fact)) return humanizeToken(fact);
  const [pred, ...args] = fact.map(humanizeToken);
  if (args.length === 2) return `${args[0]} ${pred} ${args[1]}`;
  if (args.length === 1) return `${args[0]} — ${pred}`;
  return [pred, ...args].join(' ');
}

/** "R1_watermark_dating" → "watermark dating". */
function humanizeRuleName(ruleId) {
  return humanizeToken(String(ruleId).replace(/^R\d+[a-z]?_/i, ''));
}

/**
 * The extracted proof told in prose, for a reader who has never seen a horn
 * clause: first the evidence the learner actually held (premise surfaces when
 * the world supplies them), then the chain of rule applications, each as one
 * sentence, ending on the secret. Deterministic formatting over the chainer's
 * tree — no model anywhere. `world` is optional; without it facts render as
 * humanized phrases and rules by their bare names.
 */
export function renderProofProse(proof, world = null, { ledger = null } = {}) {
  if (!proof) return '';
  // Twin disambiguation: several exhibits can assert the SAME fact (two
  // witnesses to one event). A factKey->premise map collides on those twins,
  // and `new Map(...)` silently keeps whichever twin is LAST in the world
  // file — so the prose could cite an exhibit that was never staged this run.
  // Resolve by preferring the premise actually RELEASED (from the ledger),
  // with a deterministic first-in-file fallback for facts never individually
  // released (background, or an unreleased twin).
  const premiseById = new Map((world?.premises || []).map((p) => [p.id, p]));
  const premiseByKey = new Map();
  for (const p of world?.premises || []) {
    if (!premiseByKey.has(factKey(p.fact))) premiseByKey.set(factKey(p.fact), p);
  }
  for (const row of ledger || []) {
    const staged = premiseById.get(row.premiseId);
    if (staged) premiseByKey.set(factKey(staged.fact), staged);
  }
  const backgroundKeys = new Set((world?.background || []).map((f) => factKey(f)));
  const ruleById = new Map((world?.rules || []).map((r) => [r.id, r]));

  const leaves = [];
  const steps = [];
  const seen = new Set();
  (function walk(node) {
    const key = factKey(node.fact);
    if (node.base) {
      if (!seen.has(key)) {
        seen.add(key);
        leaves.push(node.fact);
      }
      return;
    }
    for (const premise of node.premises) walk(premise);
    if (!seen.has(key)) {
      seen.add(key);
      steps.push(node);
    }
  })(proof);

  const evidence = leaves.map((fact, i) => {
    const premise = premiseByKey.get(factKey(fact));
    if (premise?.surface) return `(${i + 1}) ${premise.surface.trim().replace(/\s+/g, ' ')}`;
    const phrase = `«${humanizeFact(fact)}»`;
    return backgroundKeys.has(factKey(fact)) ? `(${i + 1}) ${phrase} — known from the start.` : `(${i + 1}) ${phrase}.`;
  });

  const chain = steps.map((node) => {
    const rule = ruleById.get(node.rule);
    const ruleName = `the ${humanizeRuleName(node.rule)} rule`;
    const gloss = rule?.gloss ? ` — "${rule.gloss.trim().replace(/\s+/g, ' ')}" —` : '';
    const from = node.premises.map((p) => `«${humanizeFact(p.fact)}»`).join(' and ');
    return `Because ${from}, ${ruleName}${gloss} yields «${humanizeFact(node.fact)}».`;
  });

  const lines = [];
  lines.push(
    `The conclusion rests on ${leaves.length} grounded fact${leaves.length === 1 ? '' : 's'}, chained through ${steps.length} rule application${steps.length === 1 ? '' : 's'}. The evidence on the table: ${evidence.join(' ')}`,
  );
  lines.push('');
  lines.push(chain.join(' '));
  const secretSurface = world?.secret?.surface;
  if (secretSurface && factKey(proof.fact) === factKey(world.secret.fact)) {
    lines.push('');
    lines.push(`That final fact is the secret itself: ${secretSurface.trim()}`);
  }
  return lines.join('\n');
}

export function renderProof(node, depth = 0) {
  const pad = '  '.repeat(depth);
  if (node.base) return `${pad}${node.fact.join(' ')}   [grounded]`;
  return [`${pad}${node.fact.join(' ')}   [${node.rule}]`, ...node.premises.map((p) => renderProof(p, depth + 1))].join(
    '\n',
  );
}
