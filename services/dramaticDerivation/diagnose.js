/**
 * Programmatic diagnosis + readable transcript for staging-loop iterations
 * (notes/dramatic-derivation-plan.md §3 step 3: "run → programmatic diagnosis
 * (the §2.5 taxonomy) + a transcript read → revise the tutor's role-script").
 *
 * diagnose() computes everything the loop needs to decide WHAT failed —
 * trajectory shape, recognition timing, release adherence against the frozen
 * plot, dialogue discipline — without a judge anywhere. renderTranscript()
 * produces the markdown the operator actually reads: the drama as a drama,
 * act by act, with the instrument panel alongside.
 */

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
    longestPlateau:
      firstReleaseTurn === null ? 0 : longestPlateau(result.trajectory, firstReleaseTurn, result.firstForcedTurn),
    aporiaWindow: world.slope.aporia_window,
    eventsByType,
    fabricatedFacts: result.events.filter((e) => e.type === 'fabricated_fact').map((e) => e.detail),
    releaseAdherence: releaseAdherence(world, result.ledger, result.turnsPlayed),
    dialogueDiscipline: perRole,
    proofExtracted: Boolean(result.proof),
  };
}

/** ASCII D(t) staircase for the console + note files. */
export function renderDCurve(trajectory) {
  if (!trajectory.length) return '(no trajectory)';
  const maxD = Math.max(...trajectory.map((p) => p.D), 1);
  const lines = [];
  for (let level = maxD; level >= 0; level -= 1) {
    const row = trajectory.map((p) => (p.D === level ? (p.forced ? '◉' : '●') : p.D > level ? ' ' : '·')).join('');
    lines.push(`D=${String(level).padStart(2)} ${row}`);
  }
  const axis = trajectory
    .map((p) => (p.turn % 10 === 0 ? String((p.turn / 10) % 10) : p.turn % 5 === 0 ? '+' : ' '))
    .join('');
  lines.push(`turn  ${axis} (+=5, digit=x10)`);
  return lines.join('\n');
}

function actFor(world, turn) {
  const acts = world.dramaturgy?.acts || [];
  return acts.find((a) => turn >= a.turns[0] && turn <= a.turns[1]) || null;
}

/** The drama as a readable artifact: acts, lines, releases, instrument panel. */
export function renderTranscript(result, world, { title = null } = {}) {
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
  lines.push(renderDCurve(result.trajectory));
  lines.push('```');

  let currentAct = null;
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
    const act = actFor(world, turn);
    if (act && act !== currentAct) {
      currentAct = act;
      lines.push('');
      lines.push(`## Act ${act.act} — ${act.title} (turns ${act.turns[0]}–${act.turns[1]})`);
    }
    lines.push('');
    lines.push(`### Turn ${turn}`);
    for (const line of turnLines) {
      if (line.role === 'director') {
        lines.push(`*${(line.text || '').trim()}*`);
        if (line.meta?.release) lines.push(`  — *releases \`${line.meta.release}\`*`);
      } else if (line.role === 'tutor') {
        lines.push(`**Tutor:** ${(line.text || '').trim()}`);
        const move = line.meta?.move;
        if (move)
          lines.push(
            `  — move: ${move.figure || '—'} → ${move.targetPremise || '—'} (${move.intent || '—'})${line.meta?.release ? `, releases \`${line.meta.release}\`` : ''}`,
          );
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
  }
  lines.push('');
  return lines.join('\n');
}

export function renderProof(node, depth = 0) {
  const pad = '  '.repeat(depth);
  if (node.base) return `${pad}${node.fact.join(' ')}   [grounded]`;
  return [`${pad}${node.fact.join(' ')}   [${node.rule}]`, ...node.premises.map((p) => renderProof(p, depth + 1))].join(
    '\n',
  );
}
