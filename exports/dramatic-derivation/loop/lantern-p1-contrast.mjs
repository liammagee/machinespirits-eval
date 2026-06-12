// Cross-arm contrast for the P1 dials pair (§9 of
// notes/poetics/2026-06-11-desire-multiturn-strategy-plan.md).
// Reads each arm's diagnosis.json (the pre-registered instruments) plus
// result.json only for the retraction-context classifier carried over from
// lantern-revise-contrast.mjs (control comparability: move/restage/
// spontaneous, extended with the confront class, precedence
// confront > restage > move > spontaneous).
// Usage: node exports/dramatic-derivation/loop/lantern-p1-contrast.mjs [onLabel controlLabel]
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '../../..');
const ARMS = process.argv.length > 3 ? process.argv.slice(2, 4) : ['lantern-p1-dials-on', 'lantern-revise-off'];

function loadArm(label) {
  const dir = path.join(ROOT, 'exports/dramatic-derivation/loop', label);
  return {
    diag: JSON.parse(fs.readFileSync(path.join(dir, 'diagnosis.json'), 'utf8')),
    result: JSON.parse(fs.readFileSync(path.join(dir, 'result.json'), 'utf8')),
  };
}

for (const label of ARMS) {
  const { diag, result } = loadArm(label);
  const c = diag.corruption;
  const timeline = c.timeline || [];
  const releases = result.ledger || [];
  const tutorMoves = new Map(
    (result.transcript || []).filter((e) => e.role === 'tutor').map((e) => [e.turn, e.meta]),
  );

  console.log(`\n======== ${label} ========`);
  console.log(`verdict ${diag.verdict} | turns ${diag.turnsPlayed}/${diag.turnCap} | forced->asserted gap ${diag.forcedToAssertedGap}`);
  console.log(
    'act spans:',
    (diag.acts || []).map((a) => `A${a.act}[${a.turns[0]}-${a.turns[1]}]`).join(' '),
  );

  // --- §9.2.1 primary: the learner-side repair channel ---
  console.log(
    `\nrepairs: ${c.repairs.total} of ${c.decayEvents} slips — byTutor ${c.repairs.byTutor}, ` +
      `BY RE-ADOPTION ${c.repairs.byReadoption} (endpoint 1: >0 opens the learner-side channel; 0 in both prior arms)`,
  );

  // --- slip economy (compare economies, not per-slip outcomes — §9.1 caveat) ---
  const mutations = timeline.filter((e) => e.mode === 'mutate');
  console.log(`slip mix: ${mutations.length} mutate, ${timeline.length - mutations.length} delete`);
  console.log(
    `false-belief debts: ${c.mutations.total} opened, ${c.mutations.retracted} retracted, ` +
      `${c.mutations.falseBeliefsAtEnd} standing at end | fully revised ${c.mutations.revised}`,
  );
  console.log(
    `mean repair latency ${c.meanRepairLatency} | unrepaired at end ${c.unrepairedAtEnd} | ` +
      `degraded integral ${c.degradedTurnIntegral} | F final/min ${c.fidelity.final}/${c.fidelity.min} | D reversals ${c.dReversals}`,
  );

  console.log('\nslip episodes (from the diagnosis timeline):');
  for (const ep of timeline) {
    const repair =
      ep.repairTurn == null
        ? 'deletion debt OPEN'
        : `repaired t${ep.repairTurn} via ${ep.via}, lat ${ep.repairTurn - ep.decayTurn}`;
    const falseDebt =
      ep.mode !== 'mutate'
        ? ''
        : ep.retractTurn == null
          ? ' | false form STANDS at end'
          : ` | false form retracted t${ep.retractTurn}, lat ${ep.retractTurn - ep.decayTurn}` +
            (ep.confrontPrompted !== undefined ? ` (confrontPrompted ${ep.confrontPrompted})` : '');
    console.log(`  ${ep.premiseId} t${ep.decayTurn} [${ep.mode}]: ${repair}${falseDebt}`);
  }

  // --- §9.2.3 retraction contexts (control comparability classifier) ---
  const retracted = mutations.filter((e) => e.retractTurn != null);
  if (retracted.length) {
    console.log('\nretraction context (precedence confront > restage > move > spontaneous):');
    const tally = { confront: 0, restage: 0, move: 0, spontaneous: 0 };
    for (const ep of retracted) {
      const window = [ep.retractTurn - 1, ep.retractTurn];
      const confront = ep.confrontPrompted === true;
      const restage =
        releases.some((x) => window.includes(x.turn) && x.premiseId === ep.premiseId) ||
        (ep.repairTurn != null && window.includes(ep.repairTurn));
      const moveTargeted = window.some((t) => {
        const m = tutorMoves.get(t);
        return m && m.move && m.move.targetPremise === ep.premiseId;
      });
      const cls = confront ? 'confront-prompted' : restage ? 'restage-prompted' : moveTargeted ? 'move-prompted' : 'spontaneous';
      tally[cls.split('-')[0]] += 1;
      console.log(
        `  ${ep.premiseId} retract@t${ep.retractTurn}: confront=${confront} restage=${restage} moveTarget=${moveTargeted} -> ${cls}`,
      );
    }
    console.log(
      `  split: confront ${tally.confront} / restage ${tally.restage} / move ${tally.move} / spontaneous ${tally.spontaneous}` +
        ` (control was 0 / 1 / 1 / 2)`,
    );
    if (c.mutations.confrontPromptedRetractions !== undefined) {
      console.log(`  diagnosis confrontPromptedRetractions: ${c.mutations.confrontPromptedRetractions}`);
    }
  }

  // --- §9.2.5 guard quantities ---
  const ra = diag.releaseAdherence;
  const inf = diag.learnerInference;
  const fig = diag.tutorFigures;
  console.log(
    `\nguard: releases on cue ${ra.onCue}/${ra.rows.length} (deviations ${ra.deviations.length}, missed ${ra.missed.length}, unscheduled ${ra.unscheduled.length})` +
      ` | voiced ${inf.voicedCount} overreach ${inf.overreachCount} mischanneled ${inf.mischanneledCount}` +
      ` | figures distinct ${fig.distinct} top ${fig.topFigure} ${(fig.topShare * 100).toFixed(0)}% switch ${fig.switchRate}` +
      ` | slope ${diag.learningSlope.overall.ratePerTurn} D/turn (D ${diag.learningSlope.d0}->${diag.learningSlope.dFinal}) | plateau ${diag.longestPlateau}`,
  );

  // --- §9.2.2 + §9.2.4: the P1 instrument blocks (ON arm only) ---
  if (diag.confrontation) {
    const cf = diag.confrontation;
    const decayedTargets = cf.confrontations.filter((x) => x.targetDecayed).length;
    console.log(
      `\nconfrontation (endpoint 2): ${cf.confrontations.length} demanded (${decayedTargets} against a slipped exhibit)` +
        ` | re-entries ${cf.reentries.total}: covered ${cf.reentries.covered}, uncovered ${cf.reentries.uncovered.length}` +
        `${cf.reentries.uncovered.length ? ` [turns ${cf.reentries.uncovered.map((u) => u.turn).join(', ')}]` : ''}`,
    );
    console.log(
      `  watcher: fires ${cf.superego.reentryFires}, converted ${cf.superego.convertedToConfront}, ` +
        `without recorded due ${cf.superego.firesWithoutDue}, drafts due by record ${cf.superego.draftsDueByRecord}`,
    );
    for (const x of cf.confrontations) {
      console.log(`  confront t${x.turn} -> ${x.target}${x.targetDecayed ? ' (decayed at that moment)' : ''}`);
    }

    // --- §10.3.2 treatment adherence (charter v2, registered 2026-06-12) ---
    // An absence-exposing confrontation (targetDecayed) obligates a covered
    // re-entry of that exhibit on the NEXT turn; +2 tolerates an act
    // boundary. Re-entry rows are reconstructed per-row from the transcript
    // (diagnosis.json stores covered re-entries as a count only), mirroring
    // diagnose.js confrontReport's stateByTarget walk.
    const releaseTurnByPremise = new Map(releases.map((e) => [e.premiseId, e.turn]));
    const reentryRows = [];
    const stateByTarget = new Map();
    for (const [turn, m] of [...tutorMoves.entries()].sort((a, b) => a[0] - b[0])) {
      const target = m?.move?.targetPremise || null;
      if (!target) continue;
      const intent = String(m.move.intent || '').toLowerCase().trim();
      const releaseTurn = releaseTurnByPremise.get(target);
      if (releaseTurn === undefined || releaseTurn >= turn) continue;
      const st = stateByTarget.get(target) || { lastStagedTurn: releaseTurn, confrontedAt: null };
      if (intent === 'confront') {
        st.confrontedAt = turn;
      } else {
        reentryRows.push({ turn, target, covered: st.confrontedAt !== null && st.confrontedAt > st.lastStagedTurn });
        st.lastStagedTurn = turn;
      }
      stateByTarget.set(target, st);
    }
    const obligations = cf.confrontations.filter((x) => x.targetDecayed);
    if (obligations.length) {
      console.log('\ntreatment adherence (endpoint §10.3.2: absence-exposing confrontation -> covered re-entry next turn; +2 tolerates an act boundary):');
      let treated = 0;
      let treatedNextTurn = 0;
      for (const x of obligations) {
        const hit = reentryRows.find(
          (r) => r.target === x.target && r.covered && r.turn > x.turn && r.turn <= x.turn + 2,
        );
        if (hit) {
          treated += 1;
          if (hit.turn === x.turn + 1) treatedNextTurn += 1;
        }
        const windowEnd = Math.min(x.turn + 2, diag.turnsPlayed);
        const truncation =
          windowEnd < x.turn + 1
            ? ' [NO opportunity — curtain]'
            : windowEnd < x.turn + 2
              ? ' [window truncated by curtain]'
              : '';
        console.log(
          `  confront t${x.turn} -> ${x.target}: ${hit ? `treated t${hit.turn} (lat ${hit.turn - x.turn})` : 'UNTREATED'}${truncation}`,
        );
      }
      console.log(
        `  adherence: ${treated}/${obligations.length} within +2 (${treatedNextTurn}/${obligations.length} on the next turn — the charter's letter) | target 1.0`,
      );
    } else {
      console.log('\ntreatment adherence (endpoint §10.3.2): no absence-exposing confrontations — class empty, no obligations');
    }
  } else {
    console.log('\nconfrontation: absent (dial off — control arm)');
  }

  if (diag.releaseDeviations) {
    const rd = diag.releaseDeviations;
    console.log(
      `\nrelease authority (endpoint 4): windows ${rd.turnsWithWindow}, played ${rd.played} — ` +
        `on schedule ${rd.onSchedule}, early ${rd.early}, held ${rd.held}, forced ${rd.forced}, ` +
        `overridden ${rd.overridden}, invalid claims ${rd.invalidClaims}`,
    );
    for (const r of rd.reasons) {
      console.log(`  t${r.turn} ${r.premise} offset ${r.offset >= 0 ? '+' : ''}${r.offset}: "${r.reason}"`);
    }
    const holds = (rd.decisions || []).filter((x) => x.windowSize > 0 && !x.played && x.claimed == null);
    if (holds.length) {
      console.log(`  hold turns (window open, no claim): ${holds.map((x) => `t${x.turn}`).join(', ')}`);
    }
  } else {
    console.log('release authority: absent (dial off — control arm)');
  }
}
