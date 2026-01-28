/**
 * Learner Writing Pad Service
 *
 * Implements Freud's "Mystic Writing Pad" metaphor for learner memory:
 * - Conscious: Current interaction, immediate understanding
 * - Preconscious: Recent lessons, accessible with attention
 * - Unconscious: Permanent traces of breakthroughs and traumas
 *
 * Tracks what the learner remembers, misremembers, and has forgotten.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

// Initialize database
let db;
try {
  db = new Database(path.join(DATA_DIR, 'learner-writing-pad.db'));

  db.exec(`
    CREATE TABLE IF NOT EXISTS conscious_layer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      learner_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      current_topic TEXT,
      current_understanding TEXT, -- 'none', 'partial', 'solid', 'transforming'
      active_questions TEXT, -- JSON array
      emotional_state TEXT, -- 'curious', 'frustrated', 'engaged', 'confused', etc.
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(learner_id, session_id)
    );

    CREATE TABLE IF NOT EXISTS preconscious_lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      learner_id TEXT NOT NULL,
      concept TEXT NOT NULL,
      initial_understanding TEXT,
      current_understanding TEXT,
      retention_score REAL DEFAULT 1.0, -- Decays over time
      last_accessed TEXT,
      access_count INTEGER DEFAULT 1,
      misunderstandings TEXT, -- JSON array
      connections TEXT, -- JSON array of related concepts
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(learner_id, concept)
    );

    CREATE TABLE IF NOT EXISTS unconscious_breakthroughs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      learner_id TEXT NOT NULL,
      moment_description TEXT NOT NULL,
      concept TEXT,
      impact_score REAL DEFAULT 0.5, -- How significant was this
      session_number INTEGER,
      context TEXT, -- What led to this breakthrough
      emotional_valence TEXT, -- 'positive', 'mixed', 'neutral'
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS unconscious_traumas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      learner_id TEXT NOT NULL,
      moment_description TEXT NOT NULL,
      concept TEXT,
      impact_score REAL DEFAULT 0.5, -- How significant was this
      session_number INTEGER,
      trigger TEXT, -- What triggered this experience
      resolved INTEGER DEFAULT 0, -- Has it been worked through?
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS core_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      learner_id TEXT NOT NULL,
      pattern_type TEXT NOT NULL, -- 'learning_style', 'struggle_pattern', 'strength', etc.
      pattern_key TEXT NOT NULL,
      pattern_value TEXT,
      confidence REAL DEFAULT 0.5,
      observation_count INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(learner_id, pattern_type, pattern_key)
    );

    CREATE TABLE IF NOT EXISTS memory_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      learner_id TEXT NOT NULL,
      eval_run_id TEXT,
      snapshot_data TEXT, -- JSON of full writing pad state
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_conscious_learner ON conscious_layer(learner_id);
    CREATE INDEX IF NOT EXISTS idx_preconscious_learner ON preconscious_lessons(learner_id);
    CREATE INDEX IF NOT EXISTS idx_breakthroughs_learner ON unconscious_breakthroughs(learner_id);
    CREATE INDEX IF NOT EXISTS idx_traumas_learner ON unconscious_traumas(learner_id);
    CREATE INDEX IF NOT EXISTS idx_patterns_learner ON core_patterns(learner_id);
  `);
} catch (e) {
  console.warn('[LearnerWritingPad] Could not initialize database:', e.message);
}

// ============================================================================
// Conscious Layer Operations
// ============================================================================

/**
 * Update the conscious layer (current interaction state)
 */
export function updateConsciousLayer(learnerId, sessionId, data) {
  if (!db) return null;

  const stmt = db.prepare(`
    INSERT INTO conscious_layer (learner_id, session_id, current_topic, current_understanding, active_questions, emotional_state, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(learner_id, session_id) DO UPDATE SET
      current_topic = COALESCE(excluded.current_topic, current_topic),
      current_understanding = COALESCE(excluded.current_understanding, current_understanding),
      active_questions = COALESCE(excluded.active_questions, active_questions),
      emotional_state = COALESCE(excluded.emotional_state, emotional_state),
      updated_at = CURRENT_TIMESTAMP
  `);

  return stmt.run(
    learnerId,
    sessionId,
    data.currentTopic || null,
    data.currentUnderstanding || null,
    data.activeQuestions ? JSON.stringify(data.activeQuestions) : null,
    data.emotionalState || null
  );
}

/**
 * Get current conscious state
 */
export function getConsciousLayer(learnerId, sessionId) {
  if (!db) return null;

  const row = db.prepare(`
    SELECT * FROM conscious_layer WHERE learner_id = ? AND session_id = ?
  `).get(learnerId, sessionId);

  if (!row) return null;

  return {
    currentTopic: row.current_topic,
    currentUnderstanding: row.current_understanding,
    activeQuestions: row.active_questions ? JSON.parse(row.active_questions) : [],
    emotionalState: row.emotional_state,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// Preconscious Layer Operations
// ============================================================================

/**
 * Record or update a learned concept
 */
export function recordLesson(learnerId, concept, data) {
  if (!db) return null;

  const stmt = db.prepare(`
    INSERT INTO preconscious_lessons (learner_id, concept, initial_understanding, current_understanding, retention_score, last_accessed, misunderstandings, connections)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
    ON CONFLICT(learner_id, concept) DO UPDATE SET
      current_understanding = COALESCE(excluded.current_understanding, current_understanding),
      retention_score = CASE
        WHEN excluded.retention_score IS NOT NULL THEN excluded.retention_score
        ELSE MIN(1.0, retention_score + 0.1)
      END,
      last_accessed = CURRENT_TIMESTAMP,
      access_count = access_count + 1,
      misunderstandings = COALESCE(excluded.misunderstandings, misunderstandings),
      connections = COALESCE(excluded.connections, connections),
      updated_at = CURRENT_TIMESTAMP
  `);

  return stmt.run(
    learnerId,
    concept,
    data.initialUnderstanding || null,
    data.currentUnderstanding || null,
    data.retentionScore || 1.0,
    data.misunderstandings ? JSON.stringify(data.misunderstandings) : null,
    data.connections ? JSON.stringify(data.connections) : null
  );
}

/**
 * Apply memory decay to all preconscious lessons
 * Called at session start to simulate forgetting
 */
export function applyMemoryDecay(learnerId, decayRate = 0.05) {
  if (!db) return null;

  return db.prepare(`
    UPDATE preconscious_lessons
    SET retention_score = MAX(0.1, retention_score - ?),
        updated_at = CURRENT_TIMESTAMP
    WHERE learner_id = ?
  `).run(decayRate, learnerId);
}

/**
 * Get all preconscious lessons for a learner
 */
export function getPreconsciousLessons(learnerId, minRetention = 0) {
  if (!db) return [];

  const rows = db.prepare(`
    SELECT * FROM preconscious_lessons
    WHERE learner_id = ? AND retention_score >= ?
    ORDER BY retention_score DESC
  `).all(learnerId, minRetention);

  return rows.map(row => ({
    concept: row.concept,
    initialUnderstanding: row.initial_understanding,
    currentUnderstanding: row.current_understanding,
    retentionScore: row.retention_score,
    lastAccessed: row.last_accessed,
    accessCount: row.access_count,
    misunderstandings: row.misunderstandings ? JSON.parse(row.misunderstandings) : [],
    connections: row.connections ? JSON.parse(row.connections) : [],
  }));
}

/**
 * Get lessons that are at risk of being forgotten
 */
export function getLessonsAtRisk(learnerId, threshold = 0.4) {
  if (!db) return [];

  const rows = db.prepare(`
    SELECT * FROM preconscious_lessons
    WHERE learner_id = ? AND retention_score < ?
    ORDER BY retention_score ASC
  `).all(learnerId, threshold);

  return rows.map(row => ({
    concept: row.concept,
    retentionScore: row.retention_score,
    lastAccessed: row.last_accessed,
    misunderstandings: row.misunderstandings ? JSON.parse(row.misunderstandings) : [],
  }));
}

// ============================================================================
// Unconscious Layer Operations
// ============================================================================

/**
 * Record a breakthrough moment
 */
export function recordBreakthrough(learnerId, data) {
  if (!db) return null;

  const stmt = db.prepare(`
    INSERT INTO unconscious_breakthroughs (learner_id, moment_description, concept, impact_score, session_number, context, emotional_valence)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  return stmt.run(
    learnerId,
    data.momentDescription,
    data.concept || null,
    data.impactScore || 0.5,
    data.sessionNumber || null,
    data.context || null,
    data.emotionalValence || 'positive'
  );
}

/**
 * Record a learning trauma (frustration, confusion, shame)
 */
export function recordTrauma(learnerId, data) {
  if (!db) return null;

  const stmt = db.prepare(`
    INSERT INTO unconscious_traumas (learner_id, moment_description, concept, impact_score, session_number, trigger)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  return stmt.run(
    learnerId,
    data.momentDescription,
    data.concept || null,
    data.impactScore || 0.5,
    data.sessionNumber || null,
    data.trigger || null
  );
}

/**
 * Mark a trauma as resolved (worked through)
 */
export function resolveTrauma(learnerId, traumaId) {
  if (!db) return null;

  return db.prepare(`
    UPDATE unconscious_traumas SET resolved = 1 WHERE id = ? AND learner_id = ?
  `).run(traumaId, learnerId);
}

/**
 * Get breakthroughs for a learner
 */
export function getBreakthroughs(learnerId) {
  if (!db) return [];

  const rows = db.prepare(`
    SELECT * FROM unconscious_breakthroughs WHERE learner_id = ? ORDER BY impact_score DESC
  `).all(learnerId);

  return rows.map(row => ({
    id: row.id,
    momentDescription: row.moment_description,
    concept: row.concept,
    impactScore: row.impact_score,
    sessionNumber: row.session_number,
    context: row.context,
    emotionalValence: row.emotional_valence,
    createdAt: row.created_at,
  }));
}

/**
 * Get unresolved traumas for a learner
 */
export function getUnresolvedTraumas(learnerId) {
  if (!db) return [];

  const rows = db.prepare(`
    SELECT * FROM unconscious_traumas WHERE learner_id = ? AND resolved = 0 ORDER BY impact_score DESC
  `).all(learnerId);

  return rows.map(row => ({
    id: row.id,
    momentDescription: row.moment_description,
    concept: row.concept,
    impactScore: row.impact_score,
    sessionNumber: row.session_number,
    trigger: row.trigger,
    createdAt: row.created_at,
  }));
}

// ============================================================================
// Core Patterns Operations
// ============================================================================

/**
 * Record or update a core pattern observation
 */
export function recordPattern(learnerId, patternType, patternKey, patternValue, confidence = 0.5) {
  if (!db) return null;

  const stmt = db.prepare(`
    INSERT INTO core_patterns (learner_id, pattern_type, pattern_key, pattern_value, confidence)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(learner_id, pattern_type, pattern_key) DO UPDATE SET
      pattern_value = excluded.pattern_value,
      confidence = MIN(1.0, confidence + 0.1),
      observation_count = observation_count + 1,
      updated_at = CURRENT_TIMESTAMP
  `);

  return stmt.run(learnerId, patternType, patternKey, patternValue, confidence);
}

/**
 * Get core patterns for a learner
 */
export function getCorePatterns(learnerId) {
  if (!db) return {};

  const rows = db.prepare(`
    SELECT * FROM core_patterns WHERE learner_id = ? ORDER BY confidence DESC
  `).all(learnerId);

  const patterns = {};
  for (const row of rows) {
    if (!patterns[row.pattern_type]) {
      patterns[row.pattern_type] = {};
    }
    patterns[row.pattern_type][row.pattern_key] = {
      value: row.pattern_value,
      confidence: row.confidence,
      observationCount: row.observation_count,
    };
  }
  return patterns;
}

// ============================================================================
// Full Writing Pad Operations
// ============================================================================

/**
 * Get the complete writing pad state for a learner
 */
export function getFullWritingPad(learnerId, sessionId = null) {
  const conscious = sessionId ? getConsciousLayer(learnerId, sessionId) : null;
  const preconscious = getPreconsciousLessons(learnerId);
  const breakthroughs = getBreakthroughs(learnerId);
  const traumas = getUnresolvedTraumas(learnerId);
  const patterns = getCorePatterns(learnerId);
  const atRisk = getLessonsAtRisk(learnerId);

  return {
    conscious,
    preconscious: {
      lessons: preconscious,
      atRisk,
    },
    unconscious: {
      breakthroughs,
      unresolvedTraumas: traumas,
    },
    corePatterns: patterns,
  };
}

/**
 * Create a snapshot of writing pad state (for long-term tracking)
 */
export function createSnapshot(learnerId, evalRunId = null) {
  if (!db) return null;

  const fullState = getFullWritingPad(learnerId);

  const stmt = db.prepare(`
    INSERT INTO memory_snapshots (learner_id, eval_run_id, snapshot_data)
    VALUES (?, ?, ?)
  `);

  const result = stmt.run(learnerId, evalRunId, JSON.stringify(fullState));
  return {
    id: result.lastInsertRowid,
    ...fullState,
  };
}

/**
 * Get snapshots for a learner (for comparing across evals)
 */
export function getSnapshots(learnerId, limit = 10) {
  if (!db) return [];

  const rows = db.prepare(`
    SELECT * FROM memory_snapshots WHERE learner_id = ?
    ORDER BY created_at DESC LIMIT ?
  `).all(learnerId, limit);

  return rows.map(row => ({
    id: row.id,
    evalRunId: row.eval_run_id,
    snapshotData: JSON.parse(row.snapshot_data),
    createdAt: row.created_at,
  }));
}

/**
 * Build narrative summary of writing pad for injection into prompts
 */
export function buildNarrativeSummary(learnerId, sessionId = null) {
  const pad = getFullWritingPad(learnerId, sessionId);
  const parts = [];

  // Conscious layer
  if (pad.conscious) {
    parts.push(`Currently focused on: ${pad.conscious.currentTopic || 'nothing specific'}`);
    if (pad.conscious.currentUnderstanding) {
      parts.push(`Understanding level: ${pad.conscious.currentUnderstanding}`);
    }
    if (pad.conscious.activeQuestions?.length > 0) {
      parts.push(`Active questions: ${pad.conscious.activeQuestions.join('; ')}`);
    }
    if (pad.conscious.emotionalState) {
      parts.push(`Emotional state: ${pad.conscious.emotionalState}`);
    }
  }

  // Preconscious - strong memories
  const strongLessons = pad.preconscious.lessons.filter(l => l.retentionScore > 0.7);
  if (strongLessons.length > 0) {
    parts.push(`\nStrong understanding of: ${strongLessons.map(l => l.concept).join(', ')}`);
  }

  // Preconscious - at risk
  if (pad.preconscious.atRisk.length > 0) {
    parts.push(`Fading memories of: ${pad.preconscious.atRisk.map(l => l.concept).join(', ')}`);
  }

  // Unconscious - breakthroughs
  const recentBreakthroughs = pad.unconscious.breakthroughs.slice(0, 3);
  if (recentBreakthroughs.length > 0) {
    parts.push(`\nPast breakthroughs:`);
    for (const b of recentBreakthroughs) {
      parts.push(`  - ${b.momentDescription}`);
    }
  }

  // Unconscious - traumas
  if (pad.unconscious.unresolvedTraumas.length > 0) {
    parts.push(`\nUnresolved difficulties:`);
    for (const t of pad.unconscious.unresolvedTraumas) {
      parts.push(`  - ${t.momentDescription}${t.concept ? ` (related to ${t.concept})` : ''}`);
    }
  }

  // Core patterns
  if (Object.keys(pad.corePatterns).length > 0) {
    parts.push(`\nCore patterns:`);
    for (const [type, patterns] of Object.entries(pad.corePatterns)) {
      const patternStrs = Object.entries(patterns)
        .filter(([_, p]) => p.confidence > 0.5)
        .map(([key, p]) => `${key}: ${p.value}`);
      if (patternStrs.length > 0) {
        parts.push(`  ${type}: ${patternStrs.join(', ')}`);
      }
    }
  }

  return parts.join('\n');
}

/**
 * Clear all data for a learner (for test isolation)
 */
export function clearLearnerData(learnerId) {
  if (!db) return;

  db.prepare('DELETE FROM conscious_layer WHERE learner_id = ?').run(learnerId);
  db.prepare('DELETE FROM preconscious_lessons WHERE learner_id = ?').run(learnerId);
  db.prepare('DELETE FROM unconscious_breakthroughs WHERE learner_id = ?').run(learnerId);
  db.prepare('DELETE FROM unconscious_traumas WHERE learner_id = ?').run(learnerId);
  db.prepare('DELETE FROM core_patterns WHERE learner_id = ?').run(learnerId);
  db.prepare('DELETE FROM memory_snapshots WHERE learner_id = ?').run(learnerId);
}

export default {
  // Conscious
  updateConsciousLayer,
  getConsciousLayer,
  // Preconscious
  recordLesson,
  applyMemoryDecay,
  getPreconsciousLessons,
  getLessonsAtRisk,
  // Unconscious
  recordBreakthrough,
  recordTrauma,
  resolveTrauma,
  getBreakthroughs,
  getUnresolvedTraumas,
  // Patterns
  recordPattern,
  getCorePatterns,
  // Full pad
  getFullWritingPad,
  createSnapshot,
  getSnapshots,
  buildNarrativeSummary,
  clearLearnerData,
};
