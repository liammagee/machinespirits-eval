// A17 §5 — the persisted move-efficacy memory (the "tiny LM over moves").
//
// Minimal faithful form: a table
//   P(unlock-progress | recent move n-gram × learner-state bucket)
// updated online within a session and CARRIED ACROSS SESSIONS. This is the
// single channel the three arms differ on:
//   A1 (no-memory)  — wipe() between sessions: cold start every time → flat.
//   A2 (persistent) — never wiped: value of the key move accumulates → rises.
//   A3 (oracle)     — bypasses this store entirely (movePolicySelect forces
//                     the handed key), so its trajectory is the ceiling.
//
// Discipline pattern-cloned from A14's evidenceLog (append-only accumulation,
// content-stable, EVAL_DB_PATH-aware) per the §5.12.6 precedent — but a
// DISTINCT module: services/adaptiveTutor/persistence.js writes
// evaluation_results rows + dialogue logs, NOT a keyed move table.
//
// No gradients, no LLM in the update path — the reward is Δ(probe sub-skills
// passed), a programmatic integer. The selection policy is ε-greedy with
// optimistic-initial-values over candidate moves given the state bucket: the
// minimal bandit that exhibits cross-session transfer under a deterministic
// mock without any larger machinery (§1 scope guard 4).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVAL_ROOT = path.resolve(__dirname, '..', '..');

// Honour an explicit env override the same way persistence.js honours
// EVAL_LOGS_DIR, so a hermetic smoke (its own tmp file) is fully isolated and
// the production data dir is never touched.
function defaultDbPath() {
  return process.env.MOVE_EFFICACY_DB_PATH || path.join(EVAL_ROOT, 'data', 'move-efficacy.db');
}

let db = null;
let dbPathInUse = null;

function ensureSchema(handle) {
  handle.exec(`
    CREATE TABLE IF NOT EXISTS move_efficacy (
      family        TEXT NOT NULL,
      recent_ngram  TEXT NOT NULL,
      candidate_move TEXT NOT NULL,
      state_bucket  INTEGER NOT NULL,
      n             INTEGER NOT NULL DEFAULT 0,
      sum_reward    REAL    NOT NULL DEFAULT 0,
      PRIMARY KEY (family, recent_ngram, candidate_move, state_bucket)
    );
  `);
}

// Open (or re-open) the store. Explicit dbPath wins; else the env override;
// else the default data-dir file. Idempotent — re-configuring closes the
// prior handle so the smoke can hand each arm its own tmp file.
export function configure({ dbPath } = {}) {
  const target = dbPath || defaultDbPath();
  if (db && dbPathInUse === target) return db;
  if (db) {
    try {
      db.close();
    } catch {
      /* already closed */
    }
  }
  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = new Database(target);
  db.pragma('journal_mode = WAL');
  ensureSchema(db);
  dbPathInUse = target;
  return db;
}

function handle() {
  if (!db) configure();
  return db;
}

// A1 cold start: drop all accumulated efficacy before a session. This is the
// ENTIRE operationalisation of the no-memory arm — same posture as A16's
// "stateless arm never writes the ledger" (the channel difference IS the
// pre-registered contrast, §6).
export function wipe() {
  handle().prepare('DELETE FROM move_efficacy').run();
}

// Online update. reward = Δ(probe sub-skills passed) attributed to the move
// played from `stateBucket`. recentNgram is '' for the MVP unigram model
// (n>1 is a §9 deviation away — the column exists for forward-compat).
export function recordOutcome({ family, recentNgram = '', candidateMove, stateBucket, reward }) {
  if (!family || !candidateMove || stateBucket == null) {
    throw new Error('recordOutcome requires family, candidateMove, stateBucket');
  }
  handle()
    .prepare(
      `INSERT INTO move_efficacy (family, recent_ngram, candidate_move, state_bucket, n, sum_reward)
       VALUES (@family, @recentNgram, @candidateMove, @stateBucket, 1, @reward)
       ON CONFLICT(family, recent_ngram, candidate_move, state_bucket)
       DO UPDATE SET n = n + 1, sum_reward = sum_reward + @reward`,
    )
    .run({ family, recentNgram, candidateMove, stateBucket, reward: Number(reward) || 0 });
}

// Mean reward of a (family, recentNgram, candidateMove, stateBucket) cell, or
// null if never observed. Exposed for the smoke / analyzer to introspect the
// learned table directly (judge-free verification of WHAT was learned).
export function meanReward({ family, recentNgram = '', candidateMove, stateBucket }) {
  const row = handle()
    .prepare(
      `SELECT n, sum_reward FROM move_efficacy
       WHERE family=@family AND recent_ngram=@recentNgram
         AND candidate_move=@candidateMove AND state_bucket=@stateBucket`,
    )
    .get({ family, recentNgram, candidateMove, stateBucket });
  if (!row || row.n === 0) return null;
  return row.sum_reward / row.n;
}

// ε-greedy with optimistic-initial-values. Unseen candidates are treated as
// having `optimisticPrior` mean (default above any realistic Δ), so early
// sessions explore broadly and, once the key move's true high mean is
// recorded while others decay toward 0, exploitation converges on it — the
// cross-session "rise" of arm A2. rng is injectable for deterministic smokes.
export function selectMove({
  family,
  recentNgram = '',
  stateBucket,
  candidateMoves,
  epsilon = 0.1,
  optimisticPrior = 999,
  rng = Math.random,
}) {
  if (!Array.isArray(candidateMoves) || candidateMoves.length === 0) {
    throw new Error('selectMove requires a non-empty candidateMoves array');
  }
  const pick = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];

  if (rng() < epsilon) return pick(candidateMoves); // explore

  let best = -Infinity;
  let bestMoves = [];
  for (const m of candidateMoves) {
    const mean = meanReward({ family, recentNgram, candidateMove: m, stateBucket });
    const v = mean == null ? optimisticPrior : mean;
    if (v > best + 1e-9) {
      best = v;
      bestMoves = [m];
    } else if (Math.abs(v - best) <= 1e-9) {
      bestMoves.push(m);
    }
  }
  return pick(bestMoves); // exploit (ties broken by rng — keeps it stochastic)
}

// Smoke / analyzer introspection: total cells + the learned mean per move at a
// given bucket. Used to assert the construct learned the RIGHT thing (the key
// move tops the table), not merely that a number moved.
export function stats({ family, stateBucket = 0, recentNgram = '' } = {}) {
  const total = handle().prepare('SELECT COUNT(*) AS c FROM move_efficacy').get().c;
  if (!family) return { totalCells: total };
  const rows = handle()
    .prepare(
      `SELECT candidate_move, n, sum_reward FROM move_efficacy
       WHERE family=@family AND recent_ngram=@recentNgram AND state_bucket=@stateBucket
       ORDER BY (sum_reward / n) DESC`,
    )
    .all({ family, recentNgram, stateBucket });
  return {
    totalCells: total,
    byMove: rows.map((r) => ({ move: r.candidate_move, n: r.n, mean: r.sum_reward / r.n })),
  };
}

export function close() {
  if (db) {
    try {
      db.close();
    } catch {
      /* already closed */
    }
    db = null;
    dbPathInUse = null;
  }
}

export default { configure, wipe, recordOutcome, meanReward, selectMove, stats, close };
