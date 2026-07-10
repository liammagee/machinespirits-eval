import { factKey } from './dramaticDerivation/chainer.js';

export const TUTOR_STUB_DAG_FACT_DROPOUT_SCHEMA = 'machinespirits.tutor-stub.dag-fact-dropout.v1';
export const TUTOR_STUB_DAG_FACT_DROPOUT_TURN_SCHEMA =
  'machinespirits.tutor-stub.dag-fact-dropout-turn.v1';
export const DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE = 0;
export const DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_SEED = 1;
export const DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_GRACE_TURNS = 2;
export const DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_MAX_CONCURRENT = 2;

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function nonNegativeInteger(value, { label }) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return parsed;
}

export function normalizeTutorStubDagFactDropoutRate(value, { label = 'DAG fact dropout' } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`${label} must be between 0 and 1`);
  }
  return parsed;
}

export function normalizeTutorStubDagFactDropoutSeed(value, { label = 'DAG fact dropout seed' } = {}) {
  return nonNegativeInteger(value, { label });
}

function normalizedStateSnapshot(snapshot = null) {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  return {
    schema: TUTOR_STUB_DAG_FACT_DROPOUT_SCHEMA,
    rate: normalizeTutorStubDagFactDropoutRate(
      source.rate ?? DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
    ),
    seed: normalizeTutorStubDagFactDropoutSeed(
      source.seed ?? DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_SEED,
    ),
    graceTurns: nonNegativeInteger(
      source.graceTurns ?? DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_GRACE_TURNS,
      { label: 'DAG fact dropout grace turns' },
    ),
    maxConcurrent: Math.max(
      1,
      nonNegativeInteger(
        source.maxConcurrent ?? DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_MAX_CONCURRENT,
        { label: 'DAG fact dropout maximum concurrent facts' },
      ),
    ),
    adoptions: clone(source.adoptions || {}),
    activeDropped: clone(source.activeDropped || {}),
    ledger: clone(source.ledger || []),
  };
}

export function createTutorStubDagFactDropoutState({
  rate = DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
  seed = DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_SEED,
  graceTurns = DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_GRACE_TURNS,
  maxConcurrent = DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_MAX_CONCURRENT,
  snapshot = null,
} = {}) {
  return normalizedStateSnapshot(
    snapshot || {
      rate,
      seed,
      graceTurns,
      maxConcurrent,
    },
  );
}

export function tutorStubDagFactDropoutSnapshot(state) {
  const normalized = normalizedStateSnapshot(state);
  return {
    ...normalized,
    enabled: normalized.rate > 0,
    activeCount: Object.keys(normalized.activeDropped).length,
    adoptedCount: Object.keys(normalized.adoptions).length,
  };
}

function restoreState(target, snapshot) {
  const restored = normalizedStateSnapshot(snapshot);
  for (const key of Object.keys(target || {})) delete target[key];
  Object.assign(target, restored);
  return target;
}

// FNV-1a over a stable, turn-local key. Unlike a closure-backed PRNG, this is
// serializable and therefore stays deterministic across mixed-mode speculative
// clones, trace replay, and resume.
function deterministicUnit(seed, key) {
  let hash = (0x811c9dc5 ^ (Number(seed) >>> 0)) >>> 0;
  for (const char of String(key)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash / 4294967296;
}

function premiseRow(world, premiseId) {
  const premise = world?.premiseById?.get?.(premiseId) || null;
  if (!premise?.fact) return null;
  return {
    premiseId,
    fact: clone(premise.fact),
    factKey: factKey(premise.fact),
    surface: String(premise.surface || '').trim() || premiseId,
  };
}

function eventRow(type, turn, row, extra = {}) {
  return {
    type,
    turn,
    premiseId: row.premiseId,
    fact: clone(row.fact),
    surface: row.surface,
    ...extra,
  };
}

function activeRows(dropout) {
  return Object.values(dropout.activeDropped || {}).sort(
    (a, b) => Number(a.droppedTurn || 0) - Number(b.droppedTurn || 0) || a.premiseId.localeCompare(b.premiseId),
  );
}

function turnResult({ dropout, turn, eligibleCount = 0, droppedNow = [], repairedNow = [], replayed = false }) {
  return {
    schema: TUTOR_STUB_DAG_FACT_DROPOUT_TURN_SCHEMA,
    turn,
    configuredRate: dropout.rate,
    seed: dropout.seed,
    graceTurns: dropout.graceTurns,
    maxConcurrent: dropout.maxConcurrent,
    eligibleCount,
    droppedNow: clone(droppedNow),
    repairedNow: clone(repairedNow),
    activeDropped: clone(activeRows(dropout)),
    replayed,
    after: tutorStubDagFactDropoutSnapshot(dropout),
  };
}

/**
 * Apply one end-of-learner-turn dropout step to the strict learner board.
 * The public transcript is deliberately untouched: forgotten facts may still
 * be re-derived or explicitly re-adopted from what was said on stage.
 */
export function applyTutorStubDagFactDropout({
  dropout,
  board,
  world,
  turn,
  adoptedPremiseIds = [],
  retractedPremiseIds = [],
  replay = null,
} = {}) {
  if (!dropout || !(board instanceof Map) || !world) return null;
  const safeTurn = Number.isFinite(Number(turn)) ? Number(turn) : 0;

  if (replay?.after) {
    restoreState(dropout, replay.after);
    for (const row of activeRows(dropout)) board.delete(row.factKey || factKey(row.fact));
    return turnResult({
      dropout,
      turn: safeTurn,
      eligibleCount: replay.eligibleCount || 0,
      droppedNow: replay.droppedNow || [],
      repairedNow: replay.repairedNow || [],
      replayed: true,
    });
  }

  const repairedNow = [];
  for (const premiseId of new Set(retractedPremiseIds || [])) {
    delete dropout.adoptions[premiseId];
    delete dropout.activeDropped[premiseId];
  }

  for (const premiseId of new Set(adoptedPremiseIds || [])) {
    const row = premiseRow(world, premiseId);
    if (!row || !board.has(row.factKey)) continue;
    const dropped = dropout.activeDropped[premiseId];
    if (dropped) {
      const repair = eventRow('repair', safeTurn, row, {
        via: 'learner_readoption',
        droppedTurn: dropped.droppedTurn,
      });
      repairedNow.push(repair);
      dropout.ledger.push(repair);
      delete dropout.activeDropped[premiseId];
      dropout.adoptions[premiseId] = { ...row, adoptedTurn: safeTurn };
    } else if (!dropout.adoptions[premiseId]) {
      dropout.adoptions[premiseId] = { ...row, adoptedTurn: safeTurn };
    }
  }

  const eligible = Object.values(dropout.adoptions)
    .filter((row) => {
      if (dropout.activeDropped[row.premiseId]) return false;
      if (!board.has(row.factKey || factKey(row.fact))) return false;
      return safeTurn - Number(row.adoptedTurn || 0) >= dropout.graceTurns;
    })
    .sort((a, b) => a.premiseId.localeCompare(b.premiseId));

  // Legacy traces predate the dropout field. Replaying one must reconstruct
  // its accumulated adoptions without retroactively applying today's rate to
  // already-completed turns; the configured rate begins on the next live turn.
  if (replay?.legacyNoDropout === true) {
    return turnResult({
      dropout,
      turn: safeTurn,
      eligibleCount: eligible.length,
      repairedNow,
      replayed: true,
    });
  }

  const capacity = Math.max(0, dropout.maxConcurrent - activeRows(dropout).length);
  const hits = eligible.filter((row) => {
    const draw = deterministicUnit(dropout.seed, `${safeTurn}:${row.premiseId}:${row.adoptedTurn}`);
    return draw < dropout.rate;
  });
  const droppedNow = [];
  for (const row of hits.slice(0, capacity)) {
    board.delete(row.factKey || factKey(row.fact));
    const event = eventRow('dropout', safeTurn, row, {
      adoptedTurn: row.adoptedTurn,
    });
    dropout.activeDropped[row.premiseId] = {
      ...row,
      droppedTurn: safeTurn,
    };
    dropout.ledger.push(event);
    droppedNow.push(event);
  }

  return turnResult({
    dropout,
    turn: safeTurn,
    eligibleCount: eligible.length,
    droppedNow,
    repairedNow,
  });
}
