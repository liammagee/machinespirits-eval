import { factKey } from './chainer.js';
import { releaseSolvency } from './pacing.js';

function terminalTurn(result, diagnosis) {
  return diagnosis?.turnsPlayed || result?.turnsPlayed || 0;
}

function finalD(result, diagnosis) {
  if (Array.isArray(diagnosis?.dCurve) && diagnosis.dCurve.length) return diagnosis.dCurve.at(-1);
  if (Array.isArray(result?.trajectory) && result.trajectory.length) return result.trajectory.at(-1).D;
  return null;
}

function releaseDecisionRows(diagnosis) {
  return diagnosis?.releaseDeviations?.decisions || [];
}

function priorLedger(result, turn) {
  return (result?.ledger || []).filter((entry) => entry.turn < turn);
}

function terminalLearnerText(result, turnsBack = 3) {
  const end = terminalTurn(result, null);
  return (result?.transcript || [])
    .filter((line) => line.role === 'learner' && line.turn >= end - turnsBack + 1)
    .map((line) => `${line.text || ''} ${line.hypothesis || ''}`)
    .join('\n');
}

function mentionsFact(text, fact) {
  const haystack = (text || '').toLowerCase();
  return (fact || [])
    .filter((atom) => typeof atom === 'string' && atom.length > 2)
    .some((atom) => haystack.includes(atom.toLowerCase()));
}

function unrepairedSlips(diagnosis) {
  return (diagnosis?.corruption?.timeline || []).filter((row) => row.decayTurn && !row.repairTurn);
}

function tempoFatalReleases(world, result, diagnosis) {
  return releaseDecisionRows(diagnosis)
    .filter((decision) => decision.played && typeof decision.turn === 'number')
    .map((decision) => {
      const solvency =
        decision.pacingGuard?.playedSolvency ||
        releaseSolvency(world, priorLedger(result, decision.turn), {
          premise: decision.played,
          turn: decision.turn,
        });
      return {
        turn: decision.turn,
        premise: decision.played,
        offset: decision.offset,
        reason: decision.reason || null,
        solvency,
      };
    })
    .filter((row) => row.solvency && !row.solvency.safe);
}

function lateOpenWindows(diagnosis, endTurn, window) {
  return releaseDecisionRows(diagnosis).filter(
    (decision) => decision.turn > endTurn - window && decision.turn <= endTurn && decision.windowSize > 0,
  );
}

// The public failure-mode taxonomy (Step 3 of the generalization plan): a coarse
// projection of the detailed detector-split classes onto the four modes that
// travel as a within-arm observable, far more stable than the success rate. Keyed
// on *mechanism* (why the arm failed), not on the terminal verdict shape — an
// early-pull that terminates in an early aporia is still an early-pull death.
const FAILURE_MODE_BY_CLASS = {
  grounded_control: 'grounded',
  tempo_starved_house: 'early_pull_death',
  decay_starved_stall: 'decay_seating_death',
  decay_starved_lucky_leap: 'decay_seating_death',
  supply_starved_stall: 'aporia',
  unresolved_non_grounding: 'unresolved',
};

export function failureModeOf(className) {
  return FAILURE_MODE_BY_CLASS[className] || 'unresolved';
}

// Which guard layer the arm ran under, read from the run's own recorded flags
// (the contingency axis for the guard × failure-mode table). Proof-debt implies
// pacing (E5 stacks on E3), so it is reported as its own, more-specific state.
export function guardStateOf(diagnosis) {
  if (diagnosis?.proofDebtGuard) return 'proof_debt';
  if (diagnosis?.pacingGuard) return 'pacing';
  return 'unguarded';
}

export function classifyBoundaryFailure(world, result, diagnosis) {
  const verdict = diagnosis?.verdict || result?.verdict || 'unknown';
  const endTurn = terminalTurn(result, diagnosis);
  const dFinal = finalD(result, diagnosis);
  const aporiaWindow = world?.slope?.aporia_window || diagnosis?.aporiaWindow || 0;
  const eventsByType = diagnosis?.eventsByType || {};
  const fatalReleases = tempoFatalReleases(world, result, diagnosis);
  const slips = unrepairedSlips(diagnosis);
  const tailText = terminalLearnerText(result);
  const namedDropped = slips
    .filter((row) => mentionsFact(tailText, row.fact))
    .map((row) => row.premiseId || factKey(row.fact));
  const openWindows = lateOpenWindows(diagnosis, endTurn, aporiaWindow);
  const luckyLeaps = eventsByType.lucky_leap || 0;
  const overreaches = eventsByType.overreach || 0;

  let className = 'unresolved_non_grounding';
  const reasons = [];

  if (verdict === 'grounded_anagnorisis') {
    className = 'grounded_control';
    reasons.push('grounded verdict; no detector split applied');
  } else if (fatalReleases.length) {
    className = 'tempo_starved_house';
    reasons.push(
      `tempo-insolvent tutor release(s): ${fatalReleases.map((row) => `${row.premise}@t${row.turn}`).join(', ')}`,
    );
  } else if (slips.length && (luckyLeaps || overreaches)) {
    className = 'decay_starved_lucky_leap';
    reasons.push(`${slips.length} unrepaired dropped premise(s) at end`);
    reasons.push(`${luckyLeaps} lucky leap(s), ${overreaches} overreach event(s)`);
    if (namedDropped.length) reasons.push(`terminal learner text names dropped premise(s): ${namedDropped.join(', ')}`);
  } else if (slips.length) {
    className = 'decay_starved_stall';
    reasons.push(`${slips.length} unrepaired dropped premise(s) at end`);
  } else if ((verdict === 'aporia' || verdict === 'disengagement') && !openWindows.length) {
    className = 'supply_starved_stall';
    reasons.push(`no licensed tutor-supply window in the terminal ${aporiaWindow}-turn detector span`);
  } else {
    reasons.push(`non-grounding verdict ${verdict} with no registered split trigger`);
  }

  return {
    arm: diagnosis?.label || null,
    worldId: diagnosis?.worldId || result?.worldId || world?.id || null,
    verdict,
    endTurn,
    dFinal,
    className,
    failureMode: failureModeOf(className),
    guardState: guardStateOf(diagnosis),
    reasons,
    evidence: {
      fatalReleases,
      unrepairedSlips: slips.map((row) => ({
        premiseId: row.premiseId || null,
        decayTurn: row.decayTurn,
        mode: row.mode || 'delete',
        repairTurn: row.repairTurn || null,
      })),
      namedDropped,
      terminalOpenWindows: openWindows.map((decision) => ({
        turn: decision.turn,
        windowSize: decision.windowSize,
        played: decision.played || null,
      })),
      luckyLeaps,
      overreaches,
    },
  };
}
