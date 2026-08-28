export const BUDGET_LEDGER_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS evaluation_budget_ledgers (
    run_id TEXT PRIMARY KEY REFERENCES evaluation_runs(id) ON DELETE CASCADE,
    max_usd REAL NOT NULL CHECK (max_usd > 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS evaluation_budget_attempts (
    run_id TEXT NOT NULL REFERENCES evaluation_budget_ledgers(run_id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (length(trim(provider)) > 0),
    model TEXT NOT NULL CHECK (length(trim(model)) > 0),
    role TEXT NOT NULL CHECK (length(trim(role)) > 0),
    attempt_id TEXT NOT NULL CHECK (length(trim(attempt_id)) > 0),
    status TEXT NOT NULL CHECK (status IN ('pending', 'settled', 'ambiguous')),
    reserved_usd REAL NOT NULL CHECK (reserved_usd >= 0),
    reserved_basis TEXT NOT NULL CHECK (
      reserved_basis IN ('catalog_estimate', 'conservative_bound', 'not_metered_here')
    ),
    rate_provenance TEXT NOT NULL CHECK (length(rate_provenance) > 0),
    settled_usd REAL CHECK (settled_usd IS NULL OR settled_usd >= 0),
    cost_basis TEXT CHECK (
      cost_basis IS NULL OR cost_basis IN (
        'provider_reported', 'catalog_estimate', 'conservative_bound', 'not_metered_here'
      )
    ),
    cost_provenance TEXT,
    input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
    output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
    ambiguity_reason TEXT,
    reserved_at TEXT NOT NULL,
    settled_at TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (run_id, provider, attempt_id),
    CHECK (
      (
        status = 'settled'
        AND settled_usd IS NOT NULL
        AND cost_basis IS NOT NULL
        AND cost_provenance IS NOT NULL
        AND length(cost_provenance) > 0
        AND input_tokens IS NOT NULL
        AND output_tokens IS NOT NULL
        AND settled_at IS NOT NULL
      )
      OR (
        status IN ('pending', 'ambiguous')
        AND settled_usd IS NULL
        AND cost_basis IS NULL
        AND cost_provenance IS NULL
        AND input_tokens IS NULL
        AND output_tokens IS NULL
        AND settled_at IS NULL
      )
    ),
    CHECK (status != 'pending' OR ambiguity_reason IS NULL),
    CHECK (status != 'ambiguous' OR (ambiguity_reason IS NOT NULL AND length(trim(ambiguity_reason)) > 0))
  );

  CREATE INDEX IF NOT EXISTS idx_budget_attempts_run_status
    ON evaluation_budget_attempts(run_id, status);
`;

const SETTLED_COST_BASES = new Set(['provider_reported', 'catalog_estimate', 'conservative_bound', 'not_metered_here']);
const RESERVATION_BASES = new Set(['catalog_estimate', 'conservative_bound', 'not_metered_here']);

export const BUDGET_COST_BASIS = Object.freeze({
  PROVIDER_REPORTED: 'provider_reported',
  CATALOG_ESTIMATE: 'catalog_estimate',
  CONSERVATIVE_BOUND: 'conservative_bound',
  NOT_METERED_HERE: 'not_metered_here',
});

export class BudgetLedgerPersistenceError extends Error {
  constructor(message, { reason, details = {}, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'BudgetLedgerPersistenceError';
    this.code = 'BUDGET_LEDGER_PERSISTENCE';
    this.reason = reason || 'database_error';
    Object.assign(this, details);
  }
}

export class BudgetLedgerExceededError extends Error {
  constructor(message, { accumulatedUsd, estimateUsd, maxUsd } = {}) {
    super(message);
    this.name = 'BudgetLedgerExceededError';
    this.code = 'BUDGET_EXCEEDED';
    this.accumulatedUsd = accumulatedUsd;
    this.estimateUsd = estimateUsd;
    this.maxUsd = maxUsd;
    this.currentExposureUsd = accumulatedUsd;
    this.reservedUsd = estimateUsd;
    this.projectedExposureUsd = accumulatedUsd + estimateUsd;
  }
}

function persistenceFailure(reason, message, details = {}, cause = undefined) {
  return new BudgetLedgerPersistenceError(message, { reason, details, cause });
}

function requiredIdentifier(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw persistenceFailure('invalid_argument', `${label} must be a non-empty string`);
  }
  return value.trim();
}

function requiredUsd(value, label, { allowZero = true } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) {
    const range = allowZero ? 'number >= 0' : 'number > 0';
    throw persistenceFailure('invalid_argument', `${label} must be a finite ${range}`);
  }
  return value;
}

function requiredTokenCount(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw persistenceFailure('invalid_argument', `${label} must be an integer >= 0`);
  }
  return value;
}

function requiredBasis(value, label, allowed) {
  if (!allowed.has(value)) {
    throw persistenceFailure('invalid_argument', `${label} must be one of: ${[...allowed].sort().join(', ')}`);
  }
  return value;
}

function serializeJsonSafe(value, label) {
  if (value == null) {
    throw persistenceFailure('invalid_argument', `${label} is required`);
  }
  try {
    const serialized = JSON.stringify(value);
    if (serialized == null) throw new TypeError('value is not JSON-serializable');
    return serialized;
  } catch (error) {
    throw persistenceFailure('invalid_argument', `${label} must be JSON-safe`, {}, error);
  }
}

function parseJson(value) {
  if (value == null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseAttempt(row) {
  if (!row) return null;
  return {
    runId: row.run_id,
    provider: row.provider,
    model: row.model,
    role: row.role,
    attemptId: row.attempt_id,
    status: row.status,
    reservedUsd: row.reserved_usd,
    reservedBasis: row.reserved_basis,
    rateProvenance: parseJson(row.rate_provenance),
    costUsd: row.settled_usd,
    costBasis: row.cost_basis,
    costProvenance: parseJson(row.cost_provenance),
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    ambiguityReason: row.ambiguity_reason,
    reservedAt: row.reserved_at,
    settledAt: row.settled_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Persist a run-wide spend ceiling and its per-provider attempts.
 *
 * Reservations acquire SQLite's writer lock before reading exposure. This is
 * intentionally stronger than a deferred transaction: two processes cannot
 * both observe room under the same ceiling and then commit oversubscribed
 * attempts. Settlement never rejects a provider-reported overage; recording
 * what was actually charged is more important than making the ledger look
 * compliant after dispatch.
 */
export function createBudgetRepository({ db, now = () => new Date() } = {}) {
  if (!db?.prepare || !db?.exec) {
    throw new TypeError('db must be a migrated better-sqlite3 connection');
  }
  if (typeof now !== 'function') throw new TypeError('now must be a function');

  const getEvaluationRunStatement = db.prepare('SELECT id FROM evaluation_runs WHERE id = ?');
  const getLedgerStatement = db.prepare('SELECT * FROM evaluation_budget_ledgers WHERE run_id = ?');
  const insertLedgerStatement = db.prepare(`
    INSERT INTO evaluation_budget_ledgers (run_id, max_usd, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `);
  const touchLedgerStatement = db.prepare('UPDATE evaluation_budget_ledgers SET updated_at = ? WHERE run_id = ?');
  const getAttemptStatement = db.prepare(`
    SELECT * FROM evaluation_budget_attempts
    WHERE run_id = ? AND provider = ? AND attempt_id = ?
  `);
  const currentExposureStatement = db.prepare(`
    SELECT COALESCE(SUM(
      CASE WHEN status = 'settled' THEN settled_usd ELSE reserved_usd END
    ), 0) AS ceiling_exposure_usd
    FROM evaluation_budget_attempts
    WHERE run_id = ?
  `);
  const insertAttemptStatement = db.prepare(`
    INSERT INTO evaluation_budget_attempts (
      run_id, provider, model, role, attempt_id, status,
      reserved_usd, reserved_basis, rate_provenance,
      reserved_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
  `);
  const settleAttemptStatement = db.prepare(`
    UPDATE evaluation_budget_attempts
    SET status = 'settled',
        settled_usd = ?,
        cost_basis = ?,
        cost_provenance = ?,
        input_tokens = ?,
        output_tokens = ?,
        settled_at = ?,
        updated_at = ?
    WHERE run_id = ? AND provider = ? AND attempt_id = ?
  `);
  const markAmbiguousStatement = db.prepare(`
    UPDATE evaluation_budget_attempts
    SET status = 'ambiguous', ambiguity_reason = ?, updated_at = ?
    WHERE run_id = ? AND provider = ? AND attempt_id = ?
  `);
  const summaryStatement = db.prepare(`
    SELECT
      ledger.run_id,
      ledger.max_usd,
      ledger.created_at,
      ledger.updated_at,
      COUNT(attempt.attempt_id) AS attempt_count,
      COALESCE(SUM(CASE WHEN attempt.status = 'settled' THEN 1 ELSE 0 END), 0) AS settled_count,
      COALESCE(SUM(CASE WHEN attempt.status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_count,
      COALESCE(SUM(CASE WHEN attempt.status = 'ambiguous' THEN 1 ELSE 0 END), 0) AS ambiguous_count,
      COALESCE(SUM(CASE
        WHEN attempt.status = 'settled' AND attempt.cost_basis = 'not_metered_here'
          THEN 1 ELSE 0 END), 0) AS not_metered_count,
      COALESCE(SUM(CASE
        WHEN attempt.status = 'settled' AND attempt.cost_basis = 'provider_reported'
          THEN attempt.settled_usd ELSE 0 END), 0) AS provider_reported_usd,
      COALESCE(SUM(CASE
        WHEN attempt.status = 'settled' AND attempt.cost_basis = 'catalog_estimate'
          THEN attempt.settled_usd ELSE 0 END), 0) AS catalog_estimated_usd,
      COALESCE(SUM(CASE
        WHEN attempt.status = 'settled' AND attempt.cost_basis = 'conservative_bound'
          THEN attempt.settled_usd ELSE 0 END), 0) AS conservative_bound_usd,
      COALESCE(SUM(CASE
        WHEN attempt.status = 'pending' THEN attempt.reserved_usd ELSE 0 END), 0) AS pending_exposure_usd,
      COALESCE(SUM(CASE
        WHEN attempt.status = 'ambiguous' THEN attempt.reserved_usd ELSE 0 END), 0) AS ambiguous_exposure_usd,
      COALESCE(SUM(CASE
        WHEN attempt.status = 'settled' THEN attempt.settled_usd
        ELSE attempt.reserved_usd END), 0) AS ceiling_exposure_usd,
      COALESCE(SUM(CASE
        WHEN attempt.status = 'settled' THEN attempt.input_tokens ELSE 0 END), 0) AS total_input_tokens,
      COALESCE(SUM(CASE
        WHEN attempt.status = 'settled' THEN attempt.output_tokens ELSE 0 END), 0) AS total_output_tokens
    FROM evaluation_budget_ledgers AS ledger
    LEFT JOIN evaluation_budget_attempts AS attempt ON attempt.run_id = ledger.run_id
    WHERE ledger.run_id = ?
    GROUP BY ledger.run_id, ledger.max_usd, ledger.created_at, ledger.updated_at
  `);

  const nowIso = () => new Date(now()).toISOString();

  function withImmediateTransaction(operation) {
    try {
      db.exec('BEGIN IMMEDIATE');
      const result = operation();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      if (db.inTransaction) {
        try {
          db.exec('ROLLBACK');
        } catch {
          // Preserve the original failure; the connection will remain visibly
          // unusable if SQLite itself cannot roll back.
        }
      }
      if (error instanceof BudgetLedgerExceededError || error instanceof BudgetLedgerPersistenceError) {
        throw error;
      }
      throw persistenceFailure('database_error', `Budget ledger transaction failed: ${error.message}`, {}, error);
    }
  }

  function requireLedger(runId) {
    const ledger = getLedgerStatement.get(runId);
    if (!ledger) {
      throw persistenceFailure('unknown_run', `Budget ledger is not initialized for run: ${runId}`, { runId });
    }
    return ledger;
  }

  function requireAttempt(runId, provider, attemptId) {
    const attempt = getAttemptStatement.get(runId, provider, attemptId);
    if (!attempt) {
      throw persistenceFailure(
        'unknown_attempt',
        `Budget attempt not found for run=${runId}, provider=${provider}, attempt=${attemptId}`,
        { runId, provider, attemptId },
      );
    }
    return attempt;
  }

  function initializeBudgetLedger({ runId, maxUsd } = {}) {
    const normalizedRunId = requiredIdentifier(runId, 'runId');
    const normalizedMaxUsd = requiredUsd(maxUsd, 'maxUsd', { allowZero: false });

    withImmediateTransaction(() => {
      if (!getEvaluationRunStatement.get(normalizedRunId)) {
        throw persistenceFailure('unknown_run', `Evaluation run not found: ${normalizedRunId}`, {
          runId: normalizedRunId,
        });
      }

      const existing = getLedgerStatement.get(normalizedRunId);
      if (existing) {
        if (existing.max_usd !== normalizedMaxUsd) {
          throw persistenceFailure(
            'ceiling_mismatch',
            `Budget ceiling mismatch for run ${normalizedRunId}: persisted ${existing.max_usd}, requested ${normalizedMaxUsd}`,
            {
              runId: normalizedRunId,
              persistedMaxUsd: existing.max_usd,
              requestedMaxUsd: normalizedMaxUsd,
            },
          );
        }
        return;
      }

      const timestamp = nowIso();
      insertLedgerStatement.run(normalizedRunId, normalizedMaxUsd, timestamp, timestamp);
    });

    return getBudgetSummary(normalizedRunId);
  }

  function reserveBudgetAttempt(reservation = {}) {
    const runId = requiredIdentifier(reservation.runId, 'runId');
    const provider = requiredIdentifier(reservation.provider, 'provider');
    const model = requiredIdentifier(reservation.model, 'model');
    const role = requiredIdentifier(reservation.role, 'role');
    const attemptId = requiredIdentifier(reservation.attemptId, 'attemptId');
    const reservedUsd = requiredUsd(reservation.reservedUsd, 'reservedUsd');
    const reservedBasis = requiredBasis(reservation.reservedBasis, 'reservedBasis', RESERVATION_BASES);
    const rateProvenance = serializeJsonSafe(reservation.rateProvenance, 'rateProvenance');

    return withImmediateTransaction(() => {
      const ledger = requireLedger(runId);
      if (getAttemptStatement.get(runId, provider, attemptId)) {
        throw persistenceFailure(
          'duplicate_attempt',
          `Budget attempt already exists for run=${runId}, provider=${provider}, attempt=${attemptId}`,
          { runId, provider, attemptId },
        );
      }

      const accumulatedUsd = Number(currentExposureStatement.get(runId).ceiling_exposure_usd) || 0;
      const projectedUsd = accumulatedUsd + reservedUsd;
      if (projectedUsd > ledger.max_usd) {
        throw new BudgetLedgerExceededError(
          `BudgetExceeded: exposure $${accumulatedUsd.toFixed(6)} + reservation $${reservedUsd.toFixed(6)} = $${projectedUsd.toFixed(6)} > ceiling $${ledger.max_usd.toFixed(6)}`,
          { accumulatedUsd, estimateUsd: reservedUsd, maxUsd: ledger.max_usd },
        );
      }

      const timestamp = nowIso();
      insertAttemptStatement.run(
        runId,
        provider,
        model,
        role,
        attemptId,
        reservedUsd,
        reservedBasis,
        rateProvenance,
        timestamp,
        timestamp,
      );
      touchLedgerStatement.run(timestamp, runId);
      return parseAttempt(getAttemptStatement.get(runId, provider, attemptId));
    });
  }

  function settleBudgetAttempt(settlement = {}) {
    const runId = requiredIdentifier(settlement.runId, 'runId');
    const provider = requiredIdentifier(settlement.provider, 'provider');
    const attemptId = requiredIdentifier(settlement.attemptId, 'attemptId');
    const costUsd = requiredUsd(settlement.costUsd, 'costUsd');
    const costBasis = requiredBasis(settlement.costBasis, 'costBasis', SETTLED_COST_BASES);
    const costProvenance = serializeJsonSafe(settlement.costProvenance, 'costProvenance');
    const inputTokens = requiredTokenCount(settlement.inputTokens, 'inputTokens');
    const outputTokens = requiredTokenCount(settlement.outputTokens, 'outputTokens');

    return withImmediateTransaction(() => {
      requireLedger(runId);
      const attempt = requireAttempt(runId, provider, attemptId);
      if (attempt.status !== 'pending') {
        throw persistenceFailure(
          'invalid_transition',
          `Only a pending budget attempt can settle; run=${runId}, provider=${provider}, attempt=${attemptId} is ${attempt.status}`,
          { runId, provider, attemptId, status: attempt.status },
        );
      }

      const timestamp = nowIso();
      settleAttemptStatement.run(
        costUsd,
        costBasis,
        costProvenance,
        inputTokens,
        outputTokens,
        timestamp,
        timestamp,
        runId,
        provider,
        attemptId,
      );
      touchLedgerStatement.run(timestamp, runId);
      return parseAttempt(getAttemptStatement.get(runId, provider, attemptId));
    });
  }

  function markBudgetAttemptAmbiguous(mark = {}) {
    const runId = requiredIdentifier(mark.runId, 'runId');
    const provider = requiredIdentifier(mark.provider, 'provider');
    const attemptId = requiredIdentifier(mark.attemptId, 'attemptId');
    const reason = requiredIdentifier(mark.reason, 'reason');

    return withImmediateTransaction(() => {
      requireLedger(runId);
      const attempt = requireAttempt(runId, provider, attemptId);
      if (attempt.status !== 'pending') {
        throw persistenceFailure(
          'invalid_transition',
          `Only a pending budget attempt can become ambiguous; ${attemptId} is ${attempt.status}`,
          { runId, provider, attemptId, status: attempt.status },
        );
      }

      const timestamp = nowIso();
      markAmbiguousStatement.run(reason, timestamp, runId, provider, attemptId);
      touchLedgerStatement.run(timestamp, runId);
      return parseAttempt(getAttemptStatement.get(runId, provider, attemptId));
    });
  }

  function getBudgetAttempt({ runId, provider, attemptId } = {}) {
    const normalizedRunId = requiredIdentifier(runId, 'runId');
    const normalizedProvider = requiredIdentifier(provider, 'provider');
    const normalizedAttemptId = requiredIdentifier(attemptId, 'attemptId');
    requireLedger(normalizedRunId);
    return parseAttempt(requireAttempt(normalizedRunId, normalizedProvider, normalizedAttemptId));
  }

  function getBudgetSummary(runId) {
    const normalizedRunId = requiredIdentifier(runId, 'runId');
    let row;
    try {
      row = summaryStatement.get(normalizedRunId);
    } catch (error) {
      throw persistenceFailure('database_error', `Failed to read budget ledger for run ${normalizedRunId}`, {}, error);
    }
    if (!row) {
      throw persistenceFailure('unknown_run', `Budget ledger is not initialized for run: ${normalizedRunId}`, {
        runId: normalizedRunId,
      });
    }

    const maxUsd = Number(row.max_usd);
    const ceilingExposureUsd = Number(row.ceiling_exposure_usd) || 0;
    return {
      runId: row.run_id,
      maxUsd,
      attemptCount: Number(row.attempt_count) || 0,
      settledCount: Number(row.settled_count) || 0,
      pendingCount: Number(row.pending_count) || 0,
      ambiguousCount: Number(row.ambiguous_count) || 0,
      notMeteredCount: Number(row.not_metered_count) || 0,
      totalInputTokens: Number(row.total_input_tokens) || 0,
      totalOutputTokens: Number(row.total_output_tokens) || 0,
      providerReportedUsd: Number(row.provider_reported_usd) || 0,
      catalogEstimatedUsd: Number(row.catalog_estimated_usd) || 0,
      conservativeBoundUsd: Number(row.conservative_bound_usd) || 0,
      pendingExposureUsd: Number(row.pending_exposure_usd) || 0,
      ambiguousExposureUsd: Number(row.ambiguous_exposure_usd) || 0,
      ceilingExposureUsd,
      remainingUsd: maxUsd - ceilingExposureUsd,
      utilizationPct: maxUsd > 0 ? (ceilingExposureUsd / maxUsd) * 100 : 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  return Object.freeze({
    getBudgetAttempt,
    getBudgetSummary,
    initializeBudgetLedger,
    markBudgetAttemptAmbiguous,
    reserveBudgetAttempt,
    settleBudgetAttempt,
  });
}
