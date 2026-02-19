/**
 * Learner Memory Service
 *
 * Manages persistent learner knowledge base including:
 * - Concept understanding states
 * - Episodic memory (breakthroughs, struggles, insights)
 * - Session summaries
 * - Active threads (unresolved questions)
 * - Personal definitions and connections
 * - Learner preferences
 *
 * This service provides the foundation for cross-session continuity
 * and multi-agent deliberation context.
 */

import crypto from 'crypto';
import { getDb } from '../dbService.js';

// Get shared database connection
const db = getDb();

// ============================================================================
// Database Schema
// ============================================================================

const LEARNER_MEMORY_TABLES = [
  'learner_memory',
  'concept_states',
  'episodes',
  'tutor_session_summaries',
  'threads',
  'personal_definitions',
  'connections',
  'learner_preferences',
  'learning_milestones',
  'agent_cost_log',
];

const createSchemaSQL = `
  -- Learner Knowledge Base (root record)
  CREATE TABLE IF NOT EXISTS learner_memory (
    id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now')),
    last_session TEXT,
    FOREIGN KEY (learner_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_learner_memory_learner ON learner_memory(learner_id);

  -- Concept Understanding States
  CREATE TABLE IF NOT EXISTS concept_states (
    id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL,
    concept_id TEXT NOT NULL,
    label TEXT NOT NULL,
    level TEXT DEFAULT 'unencountered' CHECK(level IN ('unencountered', 'exposed', 'developing', 'proficient', 'mastered')),
    confidence REAL DEFAULT 0.5,
    calibration REAL DEFAULT 0.5,
    last_engaged TEXT,
    engagement_count INTEGER DEFAULT 0,
    decay_rate REAL DEFAULT 0.1,
    sources TEXT DEFAULT '[]',
    struggles TEXT DEFAULT '[]',
    breakthroughs TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(learner_id, concept_id),
    FOREIGN KEY (learner_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_concept_states_learner ON concept_states(learner_id);
  CREATE INDEX IF NOT EXISTS idx_concept_states_concept ON concept_states(concept_id);
  CREATE INDEX IF NOT EXISTS idx_concept_states_level ON concept_states(level);
  CREATE INDEX IF NOT EXISTS idx_concept_states_last_engaged ON concept_states(last_engaged);

  -- Episodic Memory
  CREATE TABLE IF NOT EXISTS episodes (
    id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL,
    session_id TEXT,
    timestamp TEXT DEFAULT (datetime('now')),
    type TEXT NOT NULL CHECK(type IN ('breakthrough', 'struggle', 'insight', 'question', 'connection', 'misconception', 'emotional', 'metacognitive')),
    content TEXT NOT NULL,
    context TEXT,
    concepts TEXT DEFAULT '[]',
    embedding BLOB,
    importance REAL DEFAULT 0.5,
    retrieval_count INTEGER DEFAULT 0,
    agent_notes TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (learner_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_episodes_learner ON episodes(learner_id);
  CREATE INDEX IF NOT EXISTS idx_episodes_session ON episodes(session_id);
  CREATE INDEX IF NOT EXISTS idx_episodes_type ON episodes(type);
  CREATE INDEX IF NOT EXISTS idx_episodes_timestamp ON episodes(timestamp);
  CREATE INDEX IF NOT EXISTS idx_episodes_importance ON episodes(importance);

  -- Tutor Session Summaries (for tutor memory, separate from user-facing session_summaries)
  CREATE TABLE IF NOT EXISTS tutor_session_summaries (
    id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL,
    session_id TEXT NOT NULL UNIQUE,
    timestamp TEXT DEFAULT (datetime('now')),
    duration INTEGER DEFAULT 0,
    topics TEXT DEFAULT '[]',
    concepts_touched TEXT DEFAULT '[]',
    key_insights TEXT DEFAULT '[]',
    unresolved_questions TEXT DEFAULT '[]',
    scaffolding_level_avg REAL DEFAULT 2.0,
    engagement_level TEXT DEFAULT 'engaged' CHECK(engagement_level IN ('struggling', 'engaged', 'flowing', 'disengaged')),
    emotional_arc TEXT,
    message_count INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    agent_calls TEXT DEFAULT '[]',
    narrative_summary TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (learner_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_tutor_session_summaries_learner ON tutor_session_summaries(learner_id);
  CREATE INDEX IF NOT EXISTS idx_tutor_session_summaries_timestamp ON tutor_session_summaries(timestamp);

  -- Active Threads (Unresolved Questions)
  CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'resolved', 'dormant')),
    origin_session TEXT,
    last_touched TEXT DEFAULT (datetime('now')),
    mentions TEXT DEFAULT '[]',
    question TEXT NOT NULL,
    partial_answers TEXT DEFAULT '[]',
    related_concepts TEXT DEFAULT '[]',
    student_interest REAL DEFAULT 0.5,
    pedagogical_importance REAL DEFAULT 0.5,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (learner_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_threads_learner ON threads(learner_id);
  CREATE INDEX IF NOT EXISTS idx_threads_status ON threads(status);
  CREATE INDEX IF NOT EXISTS idx_threads_last_touched ON threads(last_touched);

  -- Personal Definitions (Lexicon)
  CREATE TABLE IF NOT EXISTS personal_definitions (
    id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL,
    term TEXT NOT NULL,
    definition TEXT NOT NULL,
    confidence REAL DEFAULT 0.5,
    evolution TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(learner_id, term),
    FOREIGN KEY (learner_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_personal_definitions_learner ON personal_definitions(learner_id);
  CREATE INDEX IF NOT EXISTS idx_personal_definitions_term ON personal_definitions(term);

  -- Concept Connections
  CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL,
    concept_a TEXT NOT NULL,
    concept_b TEXT NOT NULL,
    relationship TEXT NOT NULL,
    source TEXT DEFAULT 'student' CHECK(source IN ('student', 'tutor_suggested', 'discovered_together')),
    strength REAL DEFAULT 0.5,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(learner_id, concept_a, concept_b),
    FOREIGN KEY (learner_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_connections_learner ON connections(learner_id);
  CREATE INDEX IF NOT EXISTS idx_connections_concepts ON connections(concept_a, concept_b);

  -- Learner Preferences
  CREATE TABLE IF NOT EXISTS learner_preferences (
    learner_id TEXT PRIMARY KEY,
    prefers_examples_first INTEGER DEFAULT 1,
    prefers_socratic_mode INTEGER DEFAULT 0,
    tolerance_for_challenge REAL DEFAULT 0.5,
    best_time_of_day TEXT,
    typical_session_length INTEGER DEFAULT 30,
    preferred_pace TEXT DEFAULT 'moderate' CHECK(preferred_pace IN ('slow', 'moderate', 'fast')),
    responds_to_encouragement INTEGER DEFAULT 1,
    needs_normalization INTEGER DEFAULT 1,
    effective_strategies TEXT DEFAULT '[]',
    preferred_architecture TEXT DEFAULT 'unified',
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (learner_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Learning Milestones
  CREATE TABLE IF NOT EXISTS learning_milestones (
    id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('first_breakthrough', 'concept_mastered', 'connection_made', 'independence_achieved', 'teaching_moment', 'streak', 'deep_engagement', 'recovery')),
    title TEXT NOT NULL,
    description TEXT,
    concept_id TEXT,
    course_id TEXT,
    achieved_at TEXT DEFAULT (datetime('now')),
    acknowledged INTEGER DEFAULT 0,
    FOREIGN KEY (learner_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_learning_milestones_learner ON learning_milestones(learner_id);
  CREATE INDEX IF NOT EXISTS idx_learning_milestones_type ON learning_milestones(type);
  CREATE INDEX IF NOT EXISTS idx_learning_milestones_acknowledged ON learning_milestones(acknowledged);

  -- Agent Cost Tracking
  CREATE TABLE IF NOT EXISTS agent_cost_log (
    id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL,
    session_id TEXT,
    agent_role TEXT NOT NULL,
    architecture TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    latency_ms INTEGER DEFAULT 0,
    model TEXT,
    timestamp TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (learner_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_agent_cost_log_learner ON agent_cost_log(learner_id);
  CREATE INDEX IF NOT EXISTS idx_agent_cost_log_session ON agent_cost_log(session_id);
  CREATE INDEX IF NOT EXISTS idx_agent_cost_log_timestamp ON agent_cost_log(timestamp);
`;

// Try to create schema; if mismatch, drop and recreate
try {
  db.exec(createSchemaSQL);

  // Verify schema has correct columns (may exist with old column names)
  const testQuery = db.prepare(`SELECT learner_id FROM tutor_session_summaries LIMIT 0`);
  testQuery.run(); // Will throw if learner_id column doesn't exist
} catch (err) {
  if (err.message?.includes('no such column') || err.message?.includes('SQLITE_ERROR')) {
    console.log('[LearnerMemory] Schema mismatch detected, recreating tables...');
    for (const table of LEARNER_MEMORY_TABLES) {
      try {
        db.exec(`DROP TABLE IF EXISTS ${table}`);
      } catch {
        /* ignore */
      }
    }
    db.exec(createSchemaSQL);
    console.log('[LearnerMemory] Tables recreated successfully');
  } else {
    throw err;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

const generateId = () => crypto.randomUUID();

const parseJSON = (str, defaultValue = []) => {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
};

const stringifyJSON = (obj) => JSON.stringify(obj || []);

// ============================================================================
// Learner Memory CRUD
// ============================================================================

/**
 * Get or create learner memory record
 */
export const getOrCreateLearnerMemory = (learnerId) => {
  let memory = db.prepare('SELECT * FROM learner_memory WHERE learner_id = ?').get(learnerId);

  if (!memory) {
    const id = generateId();
    db.prepare(
      `
      INSERT INTO learner_memory (id, learner_id)
      VALUES (?, ?)
    `,
    ).run(id, learnerId);
    memory = db.prepare('SELECT * FROM learner_memory WHERE id = ?').get(id);

    // Also create default preferences
    db.prepare(
      `
      INSERT OR IGNORE INTO learner_preferences (learner_id)
      VALUES (?)
    `,
    ).run(learnerId);
  }

  return memory;
};

/**
 * Update last session timestamp
 */
export const updateLastSession = (learnerId, sessionId) => {
  db.prepare(
    `
    UPDATE learner_memory
    SET last_session = ?
    WHERE learner_id = ?
  `,
  ).run(sessionId, learnerId);
};

// ============================================================================
// Concept States
// ============================================================================

/**
 * Get concept state for a learner
 */
export const getConceptState = (learnerId, conceptId) => {
  const row = db
    .prepare(
      `
    SELECT * FROM concept_states
    WHERE learner_id = ? AND concept_id = ?
  `,
    )
    .get(learnerId, conceptId);

  if (!row) return null;

  return {
    ...row,
    sources: parseJSON(row.sources),
    struggles: parseJSON(row.struggles),
    breakthroughs: parseJSON(row.breakthroughs),
  };
};

/**
 * Get all concept states for a learner
 */
export const getAllConceptStates = (learnerId) => {
  const rows = db
    .prepare(
      `
    SELECT * FROM concept_states
    WHERE learner_id = ?
    ORDER BY last_engaged DESC
  `,
    )
    .all(learnerId);

  return rows.map((row) => ({
    ...row,
    sources: parseJSON(row.sources),
    struggles: parseJSON(row.struggles),
    breakthroughs: parseJSON(row.breakthroughs),
  }));
};

/**
 * Get concepts due for review (spaced repetition)
 */
export const getConceptsDueForReview = (learnerId, limit = 5) => {
  // Simple algorithm: concepts not engaged recently with decay factor
  const rows = db
    .prepare(
      `
    SELECT *,
      julianday('now') - julianday(last_engaged) AS days_since,
      (julianday('now') - julianday(last_engaged)) * decay_rate AS review_urgency
    FROM concept_states
    WHERE learner_id = ?
      AND level IN ('exposed', 'developing', 'proficient')
      AND last_engaged IS NOT NULL
    ORDER BY review_urgency DESC
    LIMIT ?
  `,
    )
    .all(learnerId, limit);

  return rows.map((row) => ({
    ...row,
    sources: parseJSON(row.sources),
    struggles: parseJSON(row.struggles),
    breakthroughs: parseJSON(row.breakthroughs),
  }));
};

/**
 * Create or update concept state
 */
export const upsertConceptState = (learnerIdOrData, conceptIdArg, dataArg) => {
  let learnerId = learnerIdOrData;
  let conceptId = conceptIdArg;
  let data = dataArg || {};

  if (learnerIdOrData && typeof learnerIdOrData === 'object' && !Array.isArray(learnerIdOrData)) {
    learnerId = learnerIdOrData.learnerId;
    conceptId = learnerIdOrData.conceptId;
    data = learnerIdOrData;
  }

  if (!learnerId || !conceptId) return null;

  const existing = getConceptState(learnerId, conceptId);

  if (existing) {
    // Update existing
    const updates = [];
    const params = [];

    if (data.label !== undefined) {
      updates.push('label = ?');
      params.push(data.label);
    }
    if (data.level !== undefined) {
      updates.push('level = ?');
      params.push(data.level);
    }
    if (data.confidence !== undefined) {
      updates.push('confidence = ?');
      params.push(data.confidence);
    }
    if (data.calibration !== undefined) {
      updates.push('calibration = ?');
      params.push(data.calibration);
    }
    if (data.decayRate !== undefined) {
      updates.push('decay_rate = ?');
      params.push(data.decayRate);
    }

    // Always update engagement
    updates.push('last_engaged = datetime("now")');
    updates.push('engagement_count = engagement_count + 1');
    updates.push('updated_at = datetime("now")');

    // Handle array updates
    if (data.addSource) {
      const sources = existing.sources.includes(data.addSource)
        ? existing.sources
        : [...existing.sources, data.addSource];
      updates.push('sources = ?');
      params.push(stringifyJSON(sources));
    }

    if (data.addStruggle) {
      const struggle = { ...data.addStruggle, timestamp: new Date().toISOString() };
      const struggles = [...existing.struggles, struggle];
      updates.push('struggles = ?');
      params.push(stringifyJSON(struggles));
    }

    if (data.addBreakthrough) {
      const breakthrough = { ...data.addBreakthrough, timestamp: new Date().toISOString() };
      const breakthroughs = [...existing.breakthroughs, breakthrough];
      updates.push('breakthroughs = ?');
      params.push(stringifyJSON(breakthroughs));
    }

    params.push(learnerId, conceptId);

    db.prepare(
      `
      UPDATE concept_states
      SET ${updates.join(', ')}
      WHERE learner_id = ? AND concept_id = ?
    `,
    ).run(...params);

    return getConceptState(learnerId, conceptId);
  } else {
    // Create new
    const id = generateId();
    db.prepare(
      `
      INSERT INTO concept_states (
        id, learner_id, concept_id, label, level, confidence,
        last_engaged, sources, struggles, breakthroughs
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?)
    `,
    ).run(
      id,
      learnerId,
      conceptId,
      data.label || conceptId,
      data.level || 'exposed',
      data.confidence || 0.5,
      stringifyJSON(data.addSource ? [data.addSource] : []),
      stringifyJSON(data.addStruggle ? [{ ...data.addStruggle, timestamp: new Date().toISOString() }] : []),
      stringifyJSON(data.addBreakthrough ? [{ ...data.addBreakthrough, timestamp: new Date().toISOString() }] : []),
    );

    return getConceptState(learnerId, conceptId);
  }
};

// ============================================================================
// Episodes
// ============================================================================

/**
 * Create an episode
 */
export const createEpisode = (data) => {
  const id = generateId();
  db.prepare(
    `
    INSERT INTO episodes (
      id, learner_id, session_id, type, content, context,
      concepts, importance, agent_notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    data.learnerId,
    data.sessionId,
    data.type,
    data.content,
    data.context || '',
    stringifyJSON(data.concepts || []),
    data.importance || 0.5,
    stringifyJSON(data.agentNotes || []),
  );

  return db.prepare('SELECT * FROM episodes WHERE id = ?').get(id);
};

/**
 * Get recent episodes for a learner
 */
export const getRecentEpisodes = (learnerId, limit = 20) => {
  const rows = db
    .prepare(
      `
    SELECT * FROM episodes
    WHERE learner_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `,
    )
    .all(learnerId, limit);

  return rows.map((row) => ({
    ...row,
    concepts: parseJSON(row.concepts),
    agentNotes: parseJSON(row.agent_notes),
  }));
};

/**
 * Get episodes by type
 */
export const getEpisodesByType = (learnerId, type, limit = 10) => {
  const rows = db
    .prepare(
      `
    SELECT * FROM episodes
    WHERE learner_id = ? AND type = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `,
    )
    .all(learnerId, type, limit);

  return rows.map((row) => ({
    ...row,
    concepts: parseJSON(row.concepts),
    agentNotes: parseJSON(row.agent_notes),
  }));
};

/**
 * Get important episodes (for context injection)
 */
export const getImportantEpisodes = (learnerId, minImportance = 0.7, limit = 10) => {
  const rows = db
    .prepare(
      `
    SELECT * FROM episodes
    WHERE learner_id = ? AND importance >= ?
    ORDER BY importance DESC, timestamp DESC
    LIMIT ?
  `,
    )
    .all(learnerId, minImportance, limit);

  return rows.map((row) => ({
    ...row,
    concepts: parseJSON(row.concepts),
    agentNotes: parseJSON(row.agent_notes),
  }));
};

/**
 * Increment retrieval count (when episode is surfaced in context)
 */
export const incrementEpisodeRetrieval = (episodeId) => {
  db.prepare(
    `
    UPDATE episodes
    SET retrieval_count = retrieval_count + 1
    WHERE id = ?
  `,
  ).run(episodeId);
};

/**
 * Decay episode importance over time
 */
export const decayEpisodeImportance = (olderThanDays = 30, decayFactor = 0.9) => {
  db.prepare(
    `
    UPDATE episodes
    SET importance = importance * ?
    WHERE timestamp < datetime('now', '-' || ? || ' days')
      AND importance > 0.1
  `,
  ).run(decayFactor, olderThanDays);
};

// ============================================================================
// Session Summaries
// ============================================================================

/**
 * Create a session summary
 */
export const createSessionSummary = (data) => {
  const id = generateId();
  db.prepare(
    `
    INSERT INTO tutor_session_summaries (
      id, learner_id, session_id, duration, topics, concepts_touched,
      key_insights, unresolved_questions, scaffolding_level_avg,
      engagement_level, emotional_arc, message_count, tokens_used,
      agent_calls, narrative_summary
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    data.learnerId,
    data.sessionId,
    data.duration || 0,
    stringifyJSON(data.topics || []),
    stringifyJSON(data.conceptsTouched || []),
    stringifyJSON(data.keyInsights || []),
    stringifyJSON(data.unresolvedQuestions || []),
    data.scaffoldingLevelAvg || 2.0,
    data.engagementLevel || 'engaged',
    data.emotionalArc || '',
    data.messageCount || 0,
    data.tokensUsed || 0,
    stringifyJSON(data.agentCalls || []),
    data.narrativeSummary || '',
  );

  return getSessionSummary(data.sessionId);
};

/**
 * Get session summary
 */
export const getSessionSummary = (sessionId) => {
  const row = db
    .prepare(
      `
    SELECT * FROM tutor_session_summaries
    WHERE session_id = ?
  `,
    )
    .get(sessionId);

  if (!row) return null;

  return {
    ...row,
    topics: parseJSON(row.topics),
    conceptsTouched: parseJSON(row.concepts_touched),
    keyInsights: parseJSON(row.key_insights),
    unresolvedQuestions: parseJSON(row.unresolved_questions),
    agentCalls: parseJSON(row.agent_calls),
  };
};

/**
 * Get recent session summaries
 */
export const getRecentSessionSummaries = (learnerId, limit = 5) => {
  const rows = db
    .prepare(
      `
    SELECT * FROM tutor_session_summaries
    WHERE learner_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `,
    )
    .all(learnerId, limit);

  return rows.map((row) => ({
    ...row,
    topics: parseJSON(row.topics),
    conceptsTouched: parseJSON(row.concepts_touched),
    keyInsights: parseJSON(row.key_insights),
    unresolvedQuestions: parseJSON(row.unresolved_questions),
    agentCalls: parseJSON(row.agent_calls),
  }));
};

// ============================================================================
// Threads
// ============================================================================

/**
 * Create a thread
 */
export const createThread = (data) => {
  const id = generateId();
  db.prepare(
    `
    INSERT INTO threads (
      id, learner_id, topic, question, origin_session,
      related_concepts, student_interest, pedagogical_importance
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    data.learnerId,
    data.topic,
    data.question,
    data.originSession,
    stringifyJSON(data.relatedConcepts || []),
    data.studentInterest || 0.5,
    data.pedagogicalImportance || 0.5,
  );

  return getThread(id);
};

/**
 * Get thread by ID
 */
export const getThread = (threadId) => {
  const row = db.prepare('SELECT * FROM threads WHERE id = ?').get(threadId);
  if (!row) return null;

  return {
    ...row,
    mentions: parseJSON(row.mentions),
    partialAnswers: parseJSON(row.partial_answers),
    relatedConcepts: parseJSON(row.related_concepts),
  };
};

/**
 * Get active threads for a learner
 */
export const getActiveThreads = (learnerId) => {
  const rows = db
    .prepare(
      `
    SELECT * FROM threads
    WHERE learner_id = ? AND status = 'active'
    ORDER BY last_touched DESC
  `,
    )
    .all(learnerId);

  return rows.map((row) => ({
    ...row,
    mentions: parseJSON(row.mentions),
    partialAnswers: parseJSON(row.partial_answers),
    relatedConcepts: parseJSON(row.related_concepts),
  }));
};

/**
 * Update thread
 */
export const updateThread = (threadId, data) => {
  const existing = getThread(threadId);
  if (!existing) return null;

  const updates = [];
  const params = [];

  if (data.status !== undefined) {
    updates.push('status = ?');
    params.push(data.status);
  }
  if (data.studentInterest !== undefined) {
    updates.push('student_interest = ?');
    params.push(data.studentInterest);
  }
  if (data.pedagogicalImportance !== undefined) {
    updates.push('pedagogical_importance = ?');
    params.push(data.pedagogicalImportance);
  }

  if (data.addMention) {
    const mentions = [...existing.mentions, data.addMention];
    updates.push('mentions = ?');
    params.push(stringifyJSON(mentions));
  }

  if (data.addPartialAnswer) {
    const partialAnswers = [...existing.partialAnswers, data.addPartialAnswer];
    updates.push('partial_answers = ?');
    params.push(stringifyJSON(partialAnswers));
  }

  updates.push('last_touched = datetime("now")');
  updates.push('updated_at = datetime("now")');
  params.push(threadId);

  db.prepare(
    `
    UPDATE threads
    SET ${updates.join(', ')}
    WHERE id = ?
  `,
  ).run(...params);

  return getThread(threadId);
};

// ============================================================================
// Personal Definitions
// ============================================================================

/**
 * Get or create personal definition
 */
export const upsertPersonalDefinition = (learnerId, term, definition, confidence = 0.5) => {
  const existing = db
    .prepare(
      `
    SELECT * FROM personal_definitions
    WHERE learner_id = ? AND term = ?
  `,
    )
    .get(learnerId, term);

  if (existing) {
    // Track evolution
    const evolution = parseJSON(existing.evolution);
    evolution.push({
      timestamp: new Date().toISOString(),
      definition: existing.definition,
    });

    db.prepare(
      `
      UPDATE personal_definitions
      SET definition = ?, confidence = ?, evolution = ?, updated_at = datetime('now')
      WHERE learner_id = ? AND term = ?
    `,
    ).run(definition, confidence, stringifyJSON(evolution), learnerId, term);
  } else {
    const id = generateId();
    db.prepare(
      `
      INSERT INTO personal_definitions (id, learner_id, term, definition, confidence)
      VALUES (?, ?, ?, ?, ?)
    `,
    ).run(id, learnerId, term, definition, confidence);
  }

  return db
    .prepare(
      `
    SELECT * FROM personal_definitions
    WHERE learner_id = ? AND term = ?
  `,
    )
    .get(learnerId, term);
};

/**
 * Get all personal definitions
 */
export const getPersonalDefinitions = (learnerId) => {
  const rows = db
    .prepare(
      `
    SELECT * FROM personal_definitions
    WHERE learner_id = ?
    ORDER BY updated_at DESC
  `,
    )
    .all(learnerId);

  return rows.map((row) => ({
    ...row,
    evolution: parseJSON(row.evolution),
  }));
};

// ============================================================================
// Connections
// ============================================================================

/**
 * Create a connection
 */
export const createConnection = (data) => {
  const id = generateId();
  try {
    db.prepare(
      `
      INSERT INTO connections (
        id, learner_id, concept_a, concept_b, relationship, source, strength
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      id,
      data.learnerId,
      data.conceptA,
      data.conceptB,
      data.relationship,
      data.source || 'student',
      data.strength || 0.5,
    );

    return db.prepare('SELECT * FROM connections WHERE id = ?').get(id);
  } catch (e) {
    // Unique constraint violation - connection already exists
    return db
      .prepare(
        `
      SELECT * FROM connections
      WHERE learner_id = ? AND concept_a = ? AND concept_b = ?
    `,
      )
      .get(data.learnerId, data.conceptA, data.conceptB);
  }
};

/**
 * Get connections for a learner
 */
export const getConnections = (learnerId) => {
  return db
    .prepare(
      `
    SELECT * FROM connections
    WHERE learner_id = ?
    ORDER BY created_at DESC
  `,
    )
    .all(learnerId);
};

// ============================================================================
// Preferences
// ============================================================================

/**
 * Get learner preferences
 */
export const getPreferences = (learnerId) => {
  const row = db
    .prepare(
      `
    SELECT * FROM learner_preferences
    WHERE learner_id = ?
  `,
    )
    .get(learnerId);

  if (!row) return null;

  return {
    learnerId: row.learner_id,
    prefersExamplesFirst: !!row.prefers_examples_first,
    prefersSocraticMode: !!row.prefers_socratic_mode,
    toleranceForChallenge: row.tolerance_for_challenge,
    bestTimeOfDay: row.best_time_of_day,
    typicalSessionLength: row.typical_session_length,
    preferredPace: row.preferred_pace,
    respondsToEncouragement: !!row.responds_to_encouragement,
    needsNormalization: !!row.needs_normalization,
    effectiveStrategies: parseJSON(row.effective_strategies),
    preferredArchitecture: row.preferred_architecture,
    updatedAt: row.updated_at,
  };
};

/**
 * Update learner preferences
 */
export const updatePreferences = (learnerId, data) => {
  // Ensure record exists
  db.prepare(
    `
    INSERT OR IGNORE INTO learner_preferences (learner_id)
    VALUES (?)
  `,
  ).run(learnerId);

  const updates = [];
  const params = [];

  if (data.prefersExamplesFirst !== undefined) {
    updates.push('prefers_examples_first = ?');
    params.push(data.prefersExamplesFirst ? 1 : 0);
  }
  if (data.prefersSocraticMode !== undefined) {
    updates.push('prefers_socratic_mode = ?');
    params.push(data.prefersSocraticMode ? 1 : 0);
  }
  if (data.toleranceForChallenge !== undefined) {
    updates.push('tolerance_for_challenge = ?');
    params.push(data.toleranceForChallenge);
  }
  if (data.bestTimeOfDay !== undefined) {
    updates.push('best_time_of_day = ?');
    params.push(data.bestTimeOfDay);
  }
  if (data.typicalSessionLength !== undefined) {
    updates.push('typical_session_length = ?');
    params.push(data.typicalSessionLength);
  }
  if (data.preferredPace !== undefined) {
    updates.push('preferred_pace = ?');
    params.push(data.preferredPace);
  }
  if (data.respondsToEncouragement !== undefined) {
    updates.push('responds_to_encouragement = ?');
    params.push(data.respondsToEncouragement ? 1 : 0);
  }
  if (data.needsNormalization !== undefined) {
    updates.push('needs_normalization = ?');
    params.push(data.needsNormalization ? 1 : 0);
  }
  if (data.effectiveStrategies !== undefined) {
    updates.push('effective_strategies = ?');
    params.push(stringifyJSON(data.effectiveStrategies));
  }
  if (data.preferredArchitecture !== undefined) {
    updates.push('preferred_architecture = ?');
    params.push(data.preferredArchitecture);
  }

  if (updates.length > 0) {
    updates.push('updated_at = datetime("now")');
    params.push(learnerId);

    db.prepare(
      `
      UPDATE learner_preferences
      SET ${updates.join(', ')}
      WHERE learner_id = ?
    `,
    ).run(...params);
  }

  return getPreferences(learnerId);
};

// ============================================================================
// Milestones
// ============================================================================

/**
 * Create a milestone
 */
export const createMilestone = (data) => {
  const id = generateId();
  db.prepare(
    `
    INSERT INTO learning_milestones (
      id, learner_id, type, title, description, concept_id, course_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    data.learnerId,
    data.type,
    data.title,
    data.description || '',
    data.conceptId || null,
    data.courseId || null,
  );

  return db.prepare('SELECT * FROM learning_milestones WHERE id = ?').get(id);
};

/**
 * Get unacknowledged milestones
 */
export const getUnacknowledgedMilestones = (learnerId) => {
  return db
    .prepare(
      `
    SELECT * FROM learning_milestones
    WHERE learner_id = ? AND acknowledged = 0
    ORDER BY achieved_at DESC
  `,
    )
    .all(learnerId);
};

/**
 * Acknowledge milestone
 */
export const acknowledgeMilestone = (milestoneId) => {
  db.prepare(
    `
    UPDATE learning_milestones
    SET acknowledged = 1
    WHERE id = ?
  `,
  ).run(milestoneId);
};

// ============================================================================
// Cost Tracking
// ============================================================================

/**
 * Log agent cost
 */
export const logAgentCost = (data) => {
  const id = generateId();
  db.prepare(
    `
    INSERT INTO agent_cost_log (
      id, learner_id, session_id, agent_role, architecture,
      input_tokens, output_tokens, latency_ms, model
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    data.learnerId,
    data.sessionId,
    data.agentRole,
    data.architecture,
    data.inputTokens || 0,
    data.outputTokens || 0,
    data.latencyMs || 0,
    data.model || '',
  );

  return id;
};

/**
 * Get cost statistics
 */
export const getCostStats = (learnerId, days = 30) => {
  const row = db
    .prepare(
      `
    SELECT
      COUNT(*) as total_calls,
      SUM(input_tokens) as total_input_tokens,
      SUM(output_tokens) as total_output_tokens,
      AVG(latency_ms) as avg_latency_ms,
      COUNT(DISTINCT session_id) as session_count
    FROM agent_cost_log
    WHERE learner_id = ?
      AND timestamp > datetime('now', '-' || ? || ' days')
  `,
    )
    .get(learnerId, days);

  const byArchitecture = db
    .prepare(
      `
    SELECT
      architecture,
      COUNT(*) as calls,
      SUM(input_tokens + output_tokens) as total_tokens
    FROM agent_cost_log
    WHERE learner_id = ?
      AND timestamp > datetime('now', '-' || ? || ' days')
    GROUP BY architecture
  `,
    )
    .all(learnerId, days);

  return { ...row, byArchitecture };
};

// ============================================================================
// Context Injection
// ============================================================================

/**
 * Build context for LLM injection
 * Returns a structured summary of the learner's history for system prompts
 */
export const buildContextInjection = (learnerId, options = {}) => {
  const { maxSessionSummaries = 3, maxEpisodes = 5, maxThreads = 3, includePreferences = true } = options;

  // Get recent session summaries
  const recentSessions = getRecentSessionSummaries(learnerId, maxSessionSummaries);

  // Get active threads
  const activeThreads = getActiveThreads(learnerId).slice(0, maxThreads);

  // Get concepts due for review
  const dueForReview = getConceptsDueForReview(learnerId, 3);

  // Get important episodes
  const recentEpisodes = getImportantEpisodes(learnerId, 0.6, maxEpisodes);

  // Get preferences
  const preferences = includePreferences ? getPreferences(learnerId) : null;

  // Build narrative summary
  let narrative = '';

  if (recentSessions.length > 0) {
    const lastSession = recentSessions[0];
    narrative += `Last session: ${lastSession.narrative_summary || 'No summary available'}. `;

    if (lastSession.unresolvedQuestions?.length > 0) {
      narrative += `Unresolved: "${lastSession.unresolvedQuestions[0]}". `;
    }
  }

  if (activeThreads.length > 0) {
    narrative += `Active questions: ${activeThreads.map((t) => t.question).join('; ')}. `;
  }

  if (dueForReview.length > 0) {
    narrative += `Concepts due for review: ${dueForReview.map((c) => c.label).join(', ')}. `;
  }

  if (preferences) {
    const style = [];
    if (preferences.prefersExamplesFirst) style.push('prefers examples before abstractions');
    if (preferences.prefersSocraticMode) style.push('responds well to Socratic questioning');
    if (preferences.needsNormalization) style.push('benefits from hearing that difficulty is normal');
    if (style.length > 0) {
      narrative += `Learning style: ${style.join(', ')}. `;
    }
  }

  // Rough token estimate (4 chars per token average)
  const tokenCount = Math.ceil(narrative.length / 4);

  return {
    narrativeSummary: narrative.trim(),
    recentSessions,
    activeThreads,
    dueForReview,
    recentEpisodes,
    preferences,
    tokenCount,
  };
};

// ============================================================================
// Full Knowledge Base Export
// ============================================================================

/**
 * Get complete learner knowledge base
 * Useful for debugging or data export
 */
export const getFullKnowledgeBase = (learnerId) => {
  getOrCreateLearnerMemory(learnerId);

  return {
    learnerId,
    concepts: getAllConceptStates(learnerId),
    episodes: getRecentEpisodes(learnerId, 100),
    sessions: getRecentSessionSummaries(learnerId, 20),
    activeThreads: getActiveThreads(learnerId),
    lexicon: getPersonalDefinitions(learnerId),
    connections: getConnections(learnerId),
    preferences: getPreferences(learnerId),
    milestones: db
      .prepare(
        `
      SELECT * FROM learning_milestones
      WHERE learner_id = ?
      ORDER BY achieved_at DESC
    `,
      )
      .all(learnerId),
    costStats: getCostStats(learnerId),
  };
};

// ============================================================================
// Health Check
// ============================================================================

/**
 * Check database health without creating records
 * @returns {boolean} - True if database is accessible
 */
export const checkDatabaseHealth = () => {
  try {
    // Simple query to check table existence and connection
    const result = db
      .prepare(
        `
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='learner_memory'
    `,
      )
      .get();
    return !!result;
  } catch (error) {
    console.error('[LearnerMemory] Database health check failed:', error);
    return false;
  }
};

export default {
  getOrCreateLearnerMemory,
  updateLastSession,
  getConceptState,
  getAllConceptStates,
  getConceptsDueForReview,
  upsertConceptState,
  createEpisode,
  getRecentEpisodes,
  getEpisodesByType,
  getImportantEpisodes,
  incrementEpisodeRetrieval,
  decayEpisodeImportance,
  createSessionSummary,
  getSessionSummary,
  getRecentSessionSummaries,
  createThread,
  getThread,
  getActiveThreads,
  updateThread,
  upsertPersonalDefinition,
  getPersonalDefinitions,
  createConnection,
  getConnections,
  getPreferences,
  updatePreferences,
  createMilestone,
  getUnacknowledgedMilestones,
  acknowledgeMilestone,
  logAgentCost,
  getCostStats,
  buildContextInjection,
  getFullKnowledgeBase,
  checkDatabaseHealth,
  // Aliases for consistent naming
  getLearnerPreferences: getPreferences,
  upsertLearnerPreferences: updatePreferences,
};
