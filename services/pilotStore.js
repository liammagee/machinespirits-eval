/**
 * Pilot Store — A1 Human Learner Pilot persistence
 *
 * Tables live in the same SQLite file as the eval data (`data/evaluations.db`)
 * so that post-hoc rubric scoring (§4.3 mediator analysis) can join pilot
 * transcripts against `evaluation_results` rows without cross-DB joins.
 *
 * State machine for a session (column: `status`):
 *   enrolled → consented → intake_done → pretest_done → tutoring →
 *   tutoring_done → posttest_done → completed
 * Plus terminal: abandoned, timed_out (15-min cap exceeded).
 *
 * Hashes recorded per turn (runbook §3.1):
 *   - config_hash  : sha256 of (cell name, ego/superego prompt file CONTENTS,
 *                    topic, lecture text). Lets us prove "this is what the
 *                    cell looked like at the time of this turn" even after
 *                    prompt edits.
 *   - dialogue_content_hash : sha256 of the cumulative ordered (role, content)
 *                             list up to and including this turn. Transcript
 *                             integrity check.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createHash, randomUUID, randomBytes } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const dbPath = process.env.EVAL_DB_PATH || path.join(DATA_DIR, 'evaluations.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS pilot_sessions (
    id TEXT PRIMARY KEY,
    enrolled_at INTEGER NOT NULL,
    participant_pid TEXT,
    participant_pid_hash TEXT,
    condition_cell TEXT NOT NULL,
    scenario_lecture_ref TEXT,
    assignment_seed TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'enrolled',
    consent_at INTEGER,
    intake_at INTEGER,
    intake_data TEXT,
    pretest_started_at INTEGER,
    pretest_completed_at INTEGER,
    tutoring_started_at INTEGER,
    tutoring_completed_at INTEGER,
    posttest_started_at INTEGER,
    posttest_completed_at INTEGER,
    exit_completed_at INTEGER,
    total_tutoring_ms INTEGER,
    abandoned_reason TEXT,
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pilot_sessions_pid_hash ON pilot_sessions(participant_pid_hash);
  CREATE INDEX IF NOT EXISTS idx_pilot_sessions_condition ON pilot_sessions(condition_cell);
  CREATE INDEX IF NOT EXISTS idx_pilot_sessions_status ON pilot_sessions(status);

  CREATE TABLE IF NOT EXISTS pilot_turns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    turn_index INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    deliberation TEXT,
    was_revised INTEGER,
    config_hash TEXT NOT NULL,
    dialogue_content_hash TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    latency_ms INTEGER,
    ego_model TEXT,
    superego_model TEXT,
    created_at INTEGER NOT NULL,
    UNIQUE(session_id, turn_index),
    FOREIGN KEY (session_id) REFERENCES pilot_sessions(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_pilot_turns_session ON pilot_turns(session_id, turn_index);

  CREATE TABLE IF NOT EXISTS pilot_test_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    phase TEXT NOT NULL,
    form TEXT,
    item_id TEXT NOT NULL,
    item_position INTEGER NOT NULL,
    response_value TEXT,
    is_correct INTEGER,
    response_ms INTEGER,
    created_at INTEGER NOT NULL,
    UNIQUE(session_id, phase, item_id),
    FOREIGN KEY (session_id) REFERENCES pilot_sessions(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_pilot_test_items_session_phase ON pilot_test_items(session_id, phase);

  CREATE TABLE IF NOT EXISTS pilot_exit_survey (
    session_id TEXT PRIMARY KEY,
    nasa_tlx TEXT,
    engagement_likert TEXT,
    open_ended TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES pilot_sessions(id) ON DELETE CASCADE
  );
`);

const PILOT_CONDITIONS = (
  process.env.PILOT_CONDITIONS ||
  'cell_1_base_single_unified,cell_5_recog_single_unified'
).split(',').map((s) => s.trim()).filter(Boolean);

const PILOT_DEFAULT_LECTURE =
  process.env.PILOT_DEFAULT_LECTURE || '101-lecture-1';

export const PILOT_TUTORING_CAP_MS =
  Number(process.env.PILOT_TUTORING_CAP_MS) || 15 * 60 * 1000;

const STUDY_SECRET = process.env.PILOT_STUDY_SECRET || 'a1-pilot-dev';

export const PILOT_STATUSES = Object.freeze({
  ENROLLED: 'enrolled',
  CONSENTED: 'consented',
  INTAKE_DONE: 'intake_done',
  PRETEST_IN_PROGRESS: 'pretest_in_progress',
  PRETEST_DONE: 'pretest_done',
  TUTORING: 'tutoring',
  TUTORING_DONE: 'tutoring_done',
  POSTTEST_IN_PROGRESS: 'posttest_in_progress',
  POSTTEST_DONE: 'posttest_done',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned',
  TIMED_OUT: 'timed_out',
});

export function listConditions() {
  return [...PILOT_CONDITIONS];
}

export function getDefaultLectureRef() {
  return PILOT_DEFAULT_LECTURE;
}

function nowMs() {
  return Date.now();
}

function hashPid(pid) {
  if (!pid) return null;
  return createHash('sha256').update(STUDY_SECRET).update('|').update(pid).digest('hex');
}

// Block-randomization-ish balance: assign next session to whichever active
// condition currently has fewer enrollments. Tie-break with a per-session
// random byte so back-to-back ties don't always go to the same arm.
function pickCondition() {
  const counts = new Map(PILOT_CONDITIONS.map((c) => [c, 0]));
  const rows = db
    .prepare(
      `SELECT condition_cell, COUNT(*) AS n FROM pilot_sessions
       WHERE status NOT IN ('abandoned')
       GROUP BY condition_cell`,
    )
    .all();
  for (const row of rows) {
    if (counts.has(row.condition_cell)) counts.set(row.condition_cell, row.n);
  }
  let min = Infinity;
  let candidates = [];
  for (const [cell, n] of counts) {
    if (n < min) {
      min = n;
      candidates = [cell];
    } else if (n === min) {
      candidates.push(cell);
    }
  }
  if (candidates.length === 1) return candidates[0];
  const idx = randomBytes(1)[0] % candidates.length;
  return candidates[idx];
}

export function enrollSession({ participantPid = null, scenarioLectureRef = null, forceCondition = null } = {}) {
  const condition = forceCondition && PILOT_CONDITIONS.includes(forceCondition)
    ? forceCondition
    : pickCondition();
  const id = randomUUID();
  const now = nowMs();
  const seed = randomBytes(16).toString('hex');
  const pidHash = hashPid(participantPid);
  const lectureRef = scenarioLectureRef || PILOT_DEFAULT_LECTURE;

  db.prepare(
    `INSERT INTO pilot_sessions (id, enrolled_at, participant_pid, participant_pid_hash,
       condition_cell, scenario_lecture_ref, assignment_seed, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, now, participantPid, pidHash, condition, lectureRef, seed,
        PILOT_STATUSES.ENROLLED, now, now);

  return getSession(id);
}

export function getSession(id) {
  const row = db.prepare('SELECT * FROM pilot_sessions WHERE id = ?').get(id);
  if (!row) return null;
  if (row.intake_data) {
    try { row.intake_data = JSON.parse(row.intake_data); } catch { /* leave as string */ }
  }
  return row;
}

export function getSessionByPid(participantPid) {
  if (!participantPid) return null;
  const pidHash = hashPid(participantPid);
  const row = db
    .prepare('SELECT * FROM pilot_sessions WHERE participant_pid_hash = ? ORDER BY enrolled_at DESC LIMIT 1')
    .get(pidHash);
  if (!row) return null;
  if (row.intake_data) {
    try { row.intake_data = JSON.parse(row.intake_data); } catch { /* leave as string */ }
  }
  return row;
}

// Returns the public-facing session view — strips condition_cell so nothing
// in the participant's response payload leaks the assignment.
export function getBlindedSessionView(id) {
  const session = getSession(id);
  if (!session) return null;
  const {
    condition_cell, // eslint-disable-line no-unused-vars
    assignment_seed, // eslint-disable-line no-unused-vars
    participant_pid, // eslint-disable-line no-unused-vars
    participant_pid_hash, // eslint-disable-line no-unused-vars
    ...blinded
  } = session;
  return blinded;
}

const ALLOWED_TRANSITIONS = {
  [PILOT_STATUSES.ENROLLED]: [PILOT_STATUSES.CONSENTED, PILOT_STATUSES.ABANDONED],
  [PILOT_STATUSES.CONSENTED]: [PILOT_STATUSES.INTAKE_DONE, PILOT_STATUSES.ABANDONED],
  [PILOT_STATUSES.INTAKE_DONE]: [PILOT_STATUSES.PRETEST_IN_PROGRESS, PILOT_STATUSES.ABANDONED],
  [PILOT_STATUSES.PRETEST_IN_PROGRESS]: [PILOT_STATUSES.PRETEST_DONE, PILOT_STATUSES.ABANDONED],
  [PILOT_STATUSES.PRETEST_DONE]: [PILOT_STATUSES.TUTORING, PILOT_STATUSES.ABANDONED],
  [PILOT_STATUSES.TUTORING]: [PILOT_STATUSES.TUTORING_DONE, PILOT_STATUSES.TIMED_OUT, PILOT_STATUSES.ABANDONED],
  [PILOT_STATUSES.TUTORING_DONE]: [PILOT_STATUSES.POSTTEST_IN_PROGRESS, PILOT_STATUSES.ABANDONED],
  [PILOT_STATUSES.POSTTEST_IN_PROGRESS]: [PILOT_STATUSES.POSTTEST_DONE, PILOT_STATUSES.ABANDONED],
  [PILOT_STATUSES.POSTTEST_DONE]: [PILOT_STATUSES.COMPLETED, PILOT_STATUSES.ABANDONED],
};

function assertTransition(currentStatus, nextStatus) {
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    const err = new Error(`illegal pilot status transition: ${currentStatus} → ${nextStatus}`);
    err.code = 'PILOT_BAD_TRANSITION';
    err.statusCode = 409;
    throw err;
  }
}

function updateSession(id, patch) {
  const session = getSession(id);
  if (!session) {
    const err = new Error(`session ${id} not found`);
    err.code = 'PILOT_SESSION_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  if (patch.status) assertTransition(session.status, patch.status);
  const fields = Object.keys(patch);
  if (fields.length === 0) return session;
  const sets = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => {
    const v = patch[f];
    if (v && typeof v === 'object') return JSON.stringify(v);
    return v;
  });
  db.prepare(`UPDATE pilot_sessions SET ${sets}, updated_at = ? WHERE id = ?`)
    .run(...values, nowMs(), id);
  return getSession(id);
}

export function recordConsent(id) {
  return updateSession(id, { status: PILOT_STATUSES.CONSENTED, consent_at: nowMs() });
}

export function recordIntake(id, intakeData) {
  return updateSession(id, {
    status: PILOT_STATUSES.INTAKE_DONE,
    intake_at: nowMs(),
    intake_data: intakeData ?? {},
  });
}

export function startPretest(id) {
  return updateSession(id, {
    status: PILOT_STATUSES.PRETEST_IN_PROGRESS,
    pretest_started_at: nowMs(),
  });
}

export function startPosttest(id) {
  return updateSession(id, {
    status: PILOT_STATUSES.POSTTEST_IN_PROGRESS,
    posttest_started_at: nowMs(),
  });
}

export function recordTestResponses(id, { phase, form = null, responses = [] }) {
  if (!['pretest', 'posttest', 'screener'].includes(phase)) {
    throw new Error(`invalid test phase: ${phase}`);
  }
  if (!Array.isArray(responses) || responses.length === 0) {
    throw new Error('responses must be a non-empty array');
  }
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO pilot_test_items
       (session_id, phase, form, item_id, item_position, response_value, is_correct, response_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const now = nowMs();
  const insert = db.transaction((rows) => {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const v = r.response_value !== undefined && r.response_value !== null
        ? String(r.response_value) : null;
      stmt.run(
        id,
        phase,
        form,
        String(r.item_id),
        Number(r.item_position ?? i),
        v,
        r.is_correct === undefined ? null : (r.is_correct ? 1 : 0),
        r.response_ms ?? null,
        now,
      );
    }
  });
  insert(responses);

  if (phase === 'pretest') {
    return updateSession(id, {
      status: PILOT_STATUSES.PRETEST_DONE,
      pretest_completed_at: nowMs(),
    });
  }
  if (phase === 'posttest') {
    return updateSession(id, {
      status: PILOT_STATUSES.POSTTEST_DONE,
      posttest_completed_at: nowMs(),
    });
  }
  return getSession(id);
}

export function listTestResponses(id, phase = null) {
  const sql = phase
    ? 'SELECT * FROM pilot_test_items WHERE session_id = ? AND phase = ? ORDER BY item_position'
    : 'SELECT * FROM pilot_test_items WHERE session_id = ? ORDER BY phase, item_position';
  const params = phase ? [id, phase] : [id];
  return db.prepare(sql).all(...params);
}

export function startTutoring(id) {
  return updateSession(id, {
    status: PILOT_STATUSES.TUTORING,
    tutoring_started_at: nowMs(),
  });
}

export function endTutoring(id, { reason = 'completed' } = {}) {
  const session = getSession(id);
  if (!session) {
    const err = new Error(`session ${id} not found`);
    err.statusCode = 404;
    throw err;
  }
  const total = session.tutoring_started_at ? nowMs() - session.tutoring_started_at : null;
  const status = reason === 'timed_out' ? PILOT_STATUSES.TIMED_OUT : PILOT_STATUSES.TUTORING_DONE;
  return updateSession(id, {
    status,
    tutoring_completed_at: nowMs(),
    total_tutoring_ms: total,
  });
}

// Returns true if the 15-min cap would be exceeded by another turn. Caller
// decides whether to short-circuit before generation or after.
export function isTutoringExpired(session, atMs = nowMs()) {
  if (!session?.tutoring_started_at) return false;
  return atMs - session.tutoring_started_at > PILOT_TUTORING_CAP_MS;
}

export function tutoringTimeRemainingMs(session, atMs = nowMs()) {
  if (!session?.tutoring_started_at) return PILOT_TUTORING_CAP_MS;
  return Math.max(0, PILOT_TUTORING_CAP_MS - (atMs - session.tutoring_started_at));
}

export function recordExitSurvey(id, { nasa_tlx = null, engagement_likert = null, open_ended = null } = {}) {
  const session = getSession(id);
  if (!session) {
    const err = new Error(`session ${id} not found`);
    err.statusCode = 404;
    throw err;
  }
  db.prepare(
    `INSERT OR REPLACE INTO pilot_exit_survey
       (session_id, nasa_tlx, engagement_likert, open_ended, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    id,
    nasa_tlx ? JSON.stringify(nasa_tlx) : null,
    engagement_likert ? JSON.stringify(engagement_likert) : null,
    open_ended ? JSON.stringify(open_ended) : null,
    nowMs(),
  );
  return updateSession(id, {
    status: PILOT_STATUSES.COMPLETED,
    exit_completed_at: nowMs(),
  });
}

export function abandonSession(id, reason = null) {
  return updateSession(id, {
    status: PILOT_STATUSES.ABANDONED,
    abandoned_reason: reason,
  });
}

// ─── Turn persistence ────────────────────────────────────────────────────

export function computeConfigHash({ cellName, egoConfig, superegoConfig, egoPromptText = '', superegoPromptText = '', topic = '', lectureText = '' }) {
  const h = createHash('sha256');
  h.update(cellName || '');
  h.update('\0');
  h.update(JSON.stringify({
    p: egoConfig?.provider || null,
    m: egoConfig?.model || null,
    f: egoConfig?.prompt_file || null,
    t: egoConfig?.hyperparameters?.temperature ?? null,
  }));
  h.update('\0');
  h.update(egoPromptText);
  h.update('\0');
  h.update(JSON.stringify(superegoConfig ? {
    p: superegoConfig.provider,
    m: superegoConfig.model,
    f: superegoConfig.prompt_file || null,
    t: superegoConfig.hyperparameters?.temperature ?? null,
  } : null));
  h.update('\0');
  h.update(superegoPromptText || '');
  h.update('\0');
  h.update(topic || '');
  h.update('\0');
  h.update(lectureText || '');
  return h.digest('hex');
}

function computeDialogueContentHash(turns) {
  const h = createHash('sha256');
  for (const t of turns) {
    h.update(t.role || '');
    h.update('\0');
    h.update(t.content || '');
    h.update('\x01');
  }
  return h.digest('hex');
}

export function listTurns(sessionId) {
  return db.prepare(
    'SELECT * FROM pilot_turns WHERE session_id = ? ORDER BY turn_index',
  ).all(sessionId);
}

export function appendTurn(sessionId, params) {
  const session = getSession(sessionId);
  if (!session) {
    const err = new Error(`session ${sessionId} not found`);
    err.statusCode = 404;
    throw err;
  }
  if (!params.role || !['tutor', 'learner'].includes(params.role)) {
    throw new Error(`invalid turn role: ${params.role}`);
  }
  if (typeof params.content !== 'string') {
    throw new Error('turn content must be a string');
  }
  if (!params.configHash) {
    throw new Error('configHash is required (use computeConfigHash)');
  }

  const existing = listTurns(sessionId);
  const turnIndex = existing.length;
  const cumulative = [
    ...existing.map((t) => ({ role: t.role, content: t.content })),
    { role: params.role, content: params.content },
  ];
  const dialogueContentHash = computeDialogueContentHash(cumulative);

  db.prepare(
    `INSERT INTO pilot_turns
       (session_id, turn_index, role, content, deliberation, was_revised,
        config_hash, dialogue_content_hash, input_tokens, output_tokens,
        latency_ms, ego_model, superego_model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    sessionId,
    turnIndex,
    params.role,
    params.content,
    params.deliberation ? JSON.stringify(params.deliberation) : null,
    params.wasRevised ? 1 : 0,
    params.configHash,
    dialogueContentHash,
    params.inputTokens ?? null,
    params.outputTokens ?? null,
    params.latencyMs ?? null,
    params.egoModel ?? null,
    params.superegoModel ?? null,
    nowMs(),
  );

  return { turnIndex, dialogueContentHash };
}

// ─── Operational queries ─────────────────────────────────────────────────

export function getConditionCounts() {
  const rows = db
    .prepare(
      `SELECT condition_cell, status, COUNT(*) AS n
       FROM pilot_sessions GROUP BY condition_cell, status`,
    )
    .all();
  const out = {};
  for (const cell of PILOT_CONDITIONS) out[cell] = { total: 0 };
  for (const row of rows) {
    if (!out[row.condition_cell]) out[row.condition_cell] = { total: 0 };
    out[row.condition_cell][row.status] = row.n;
    out[row.condition_cell].total += row.n;
  }
  return out;
}

export function listSessions({ limit = 100, status = null } = {}) {
  const sql = status
    ? 'SELECT * FROM pilot_sessions WHERE status = ? ORDER BY enrolled_at DESC LIMIT ?'
    : 'SELECT * FROM pilot_sessions ORDER BY enrolled_at DESC LIMIT ?';
  const params = status ? [status, limit] : [limit];
  return db.prepare(sql).all(...params);
}

export default {
  enrollSession,
  getSession,
  getSessionByPid,
  getBlindedSessionView,
  recordConsent,
  recordIntake,
  startPretest,
  startPosttest,
  recordTestResponses,
  listTestResponses,
  startTutoring,
  endTutoring,
  isTutoringExpired,
  tutoringTimeRemainingMs,
  recordExitSurvey,
  abandonSession,
  computeConfigHash,
  appendTurn,
  listTurns,
  getConditionCounts,
  listSessions,
  listConditions,
  getDefaultLectureRef,
  PILOT_TUTORING_CAP_MS,
  PILOT_STATUSES,
};
