import { factKey } from './chainer.js';
import { derivationDistance, detectStall } from './slope.js';

function rangeInclusive(a, b) {
  const out = [];
  for (let v = a; v <= b; v += 1) out.push(v);
  return out;
}

function releaseTurnRange(world, premiseId, latitude) {
  const entry = world.releaseSchedule.find((e) => e.premise === premiseId) || null;
  if (!entry) return [];
  return rangeInclusive(Math.max(1, entry.turn - latitude), Math.min(world.turnCap, entry.turn + latitude));
}

function placementMap(world, ledger, override) {
  const placements = new Map(world.releaseSchedule.map((e) => [e.premise, e.turn]));
  for (const row of ledger || []) {
    if (row?.premiseId) placements.set(row.premiseId, row.turn);
  }
  if (override?.premise) placements.set(override.premise, override.turn);
  return placements;
}

export function simulateReleaseTempo(world, placements, { lambda = 0 } = {}) {
  const pending = new Map();
  for (const [id, t] of placements) {
    const premise = world.premiseById.get(id);
    if (!premise) continue;
    const at = t + lambda;
    if (!pending.has(at)) pending.set(at, []);
    pending.get(at).push(premise.fact);
  }
  const firstReleaseTurn = placements.size ? Math.min(...placements.values()) : Infinity;
  const board = new Map((world.background || []).map((fact) => [factKey(fact), fact]));
  const trajectory = [];
  for (let turn = 1; turn <= world.turnCap; turn += 1) {
    for (const fact of pending.get(turn) || []) board.set(factKey(fact), fact);
    const facts = [...board.values()];
    const D = derivationDistance(world, facts);
    trajectory.push({ turn, D, groundedCount: facts.length });
    if (D === 0) {
      return { verdict: 'survives_forced', endTurn: turn, forcedTurn: turn, trajectory };
    }
    const stall = detectStall(trajectory, world.slope.aporia_window, firstReleaseTurn);
    if (stall) return { verdict: stall, endTurn: turn, forcedTurn: null, trajectory };
  }
  return { verdict: 'cap_unforced', endTurn: world.turnCap, forcedTurn: null, trajectory };
}

export function releaseSolvency(world, ledger, { premise, turn, lambda = 0 } = {}) {
  if (!premise || !Number.isInteger(turn)) return null;
  const sim = simulateReleaseTempo(world, placementMap(world, ledger, { premise, turn }), { lambda });
  return {
    premise,
    turn,
    safe: sim.verdict === 'survives_forced',
    verdict: sim.verdict,
    endTurn: sim.endTurn,
    forcedTurn: sim.forcedTurn,
  };
}

export function safeReleaseTurns(world, ledger, { premise, latitude, lambda = 0 } = {}) {
  return releaseTurnRange(world, premise, latitude)
    .map((turn) => releaseSolvency(world, ledger, { premise, turn, lambda }))
    .filter((row) => row?.safe)
    .map((row) => row.turn);
}

export function pacingGuardDecision(
  world,
  ledger,
  { turn, playable = [], validClaim = null, forcedPlay = null, latitude, lambda = 0 } = {},
) {
  const candidates = playable.map((entry) => {
    const safeTurns = safeReleaseTurns(world, ledger, { premise: entry.premise, latitude, lambda });
    const current = releaseSolvency(world, ledger, { premise: entry.premise, turn, lambda });
    const futureSafeTurns = safeTurns.filter((t) => t >= turn);
    return {
      premise: entry.premise,
      scheduledTurn: entry.turn,
      current,
      safeTurns,
      futureSafeTurns,
      lastSafeTurn: futureSafeTurns.length ? Math.max(...futureSafeTurns) : null,
      nextSafeTurn: futureSafeTurns.length ? Math.min(...futureSafeTurns) : null,
    };
  });
  const byPremise = new Map(candidates.map((c) => [c.premise, c]));
  const forcedSafe = candidates
    .filter((c) => c.lastSafeTurn === turn && c.current?.safe)
    .sort((a, b) => a.scheduledTurn - b.scheduledTurn)[0];
  const forcedSolvency = forcedPlay ? byPremise.get(forcedPlay.premise)?.current || null : null;
  const claimedSolvency = validClaim ? byPremise.get(validClaim)?.current || null : null;
  const claimedSafe = Boolean(claimedSolvency?.safe);

  if (forcedSafe && (!validClaim || validClaim !== forcedSafe.premise)) {
    return {
      played: forcedSafe.premise,
      blocked: Boolean(validClaim && !claimedSafe),
      forcedSafe: true,
      forcedBy: 'last_safe_turn',
      candidate: validClaim || null,
      candidateSolvency: claimedSolvency,
      playedSolvency: forcedSafe.current,
      safeTurns: Object.fromEntries(candidates.map((c) => [c.premise, c.safeTurns])),
      alternative: forcedSafe.premise,
      reason: `${forcedSafe.premise} reaches its last computed safe turn at t${turn}`,
    };
  }

  if (validClaim) {
    if (claimedSafe) {
      return {
        played: validClaim,
        blocked: false,
        forcedSafe: false,
        candidate: validClaim,
        candidateSolvency: claimedSolvency,
        playedSolvency: claimedSolvency,
        safeTurns: Object.fromEntries(candidates.map((c) => [c.premise, c.safeTurns])),
      };
    }
    const candidate = byPremise.get(validClaim);
    return {
      played: null,
      blocked: true,
      forcedSafe: false,
      candidate: validClaim,
      candidateSolvency: claimedSolvency,
      safeTurns: Object.fromEntries(candidates.map((c) => [c.premise, c.safeTurns])),
      alternativeTurn: candidate?.nextSafeTurn ?? null,
      reason:
        candidate?.nextSafeTurn != null
          ? `${validClaim} is insolvent at t${turn}; next computed safe turn is t${candidate.nextSafeTurn}`
          : `${validClaim} is insolvent at t${turn}; no computed safe turn remains`,
    };
  }

  if (forcedPlay && forcedSolvency && !forcedSolvency.safe) {
    return {
      played: null,
      blocked: true,
      forcedSafe: false,
      candidate: forcedPlay.premise,
      candidateSolvency: forcedSolvency,
      safeTurns: Object.fromEntries(candidates.map((c) => [c.premise, c.safeTurns])),
      reason: `${forcedPlay.premise} is insolvent at t${turn}; hold-limit force-play suppressed by pacing guard`,
    };
  }

  return {
    played: forcedPlay ? forcedPlay.premise : null,
    blocked: false,
    forcedSafe: false,
    candidate: null,
    candidateSolvency: null,
    playedSolvency: forcedSolvency,
    safeTurns: Object.fromEntries(candidates.map((c) => [c.premise, c.safeTurns])),
  };
}
