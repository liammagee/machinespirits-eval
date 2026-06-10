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

function countSentences(text) {
  return (text || '')
    .split(/[.!?…]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
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
    superego = {
      watched: watched.length,
      interventions: interventions.length,
      interventionRate: rate(interventions.length, watched.length),
      withinTurnChanges,
      withinTurnChangeRate: rate(withinTurnChanges, interventions.length),
      switchOnIntervention: rate(onIntervention.switches, onIntervention.opportunities),
      switchElsewhere: rate(offIntervention.switches, offIntervention.opportunities),
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

export function diagnose(result, world) {
  const eventsByType = {};
  for (const event of result.events) {
    eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
  }
  const firstReleaseTurn = result.ledger.length ? result.ledger[0].turn : null;
  const perRole = {};
  for (const line of result.transcript) {
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
    dialogueDiscipline: perRole,
    proofExtracted: Boolean(result.proof),
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

  let currentSegment = null;
  const segmentFor = (turn) => segments.find((s) => turn >= s.turns[0] && turn <= s.turns[1]) || null;
  const byTurn = new Map();
  for (const line of result.transcript) {
    if (!byTurn.has(line.turn)) byTurn.set(line.turn, []);
    byTurn.get(line.turn).push(line);
  }
  const eventsByTurn = new Map();
  for (const event of result.events) {
    if (!eventsByTurn.has(event.turn)) eventsByTurn.set(event.turn, []);
    eventsByTurn.get(event.turn).push(event);
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
    lines.push(`### Turn ${turn}`);
    for (const line of turnLines) {
      if (line.role === 'director') {
        lines.push(`*${(line.text || '').trim()}*`);
        if (line.meta?.release) lines.push(`  — *releases \`${line.meta.release}\`*`);
        if (line.meta?.phase) {
          lines.push(
            `  — *declares the movement: **${line.meta.phase.name}**${line.meta.phase.intent ? ` (${line.meta.phase.intent})` : ''}*`,
          );
        }
        if (line.meta?.tutorNote) lines.push(`  — *note to the tutor: "${line.meta.tutorNote}"*`);
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
          lines.push(`  — *the second voice: "${delib.note}"${changed}*`);
        }
      } else if (line.role === 'learner') {
        lines.push(`**Learner:** ${(line.text || '').trim()}`);
        const meta = line.meta || {};
        const bits = [];
        if (meta.adopt?.length) bits.push(`adopts ${meta.adopt.map((f) => `\`${f.join(' ')}\``).join(', ')}`);
        if (meta.retract?.length) bits.push(`retracts ${meta.retract.map((f) => `\`${f.join(' ')}\``).join(', ')}`);
        if (meta.hypothesis) bits.push(`hypothesis: ${meta.hypothesis}`);
        if (meta.asserts) bits.push(`**asserts \`${meta.asserts.join(' ')}\`**`);
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
    const prose = renderProofProse(result.proof, world);
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
  const events = Object.entries(d.eventsByType || {});
  lines.push(`- **events** ${events.length ? events.map(([k, v]) => `${k}×${v}`).join(' · ') : 'none'}`);
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
export function renderProofProse(proof, world = null) {
  if (!proof) return '';
  const premiseByKey = new Map((world?.premises || []).map((p) => [factKey(p.fact), p]));
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
