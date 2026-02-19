/**
 * Tutor Writing Pad Service
 *
 * Implements Freud's "Mystic Writing Pad" metaphor for tutor memory:
 * - Conscious: Current pedagogical state, immediate goals
 * - Preconscious: Accumulated strategies, what works for this learner
 * - Unconscious: Deep insights about learner, relationship dynamics
 *
 * Tracks what the tutor has learned about teaching THIS specific learner.
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
  db = new Database(path.join(DATA_DIR, 'tutor-writing-pad.db'));

  db.exec(`
    CREATE TABLE IF NOT EXISTS conscious_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      learner_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      current_strategy TEXT, -- 'scaffolding', 'socratic', 'direct', 'emotional_support'
      learner_perceived_state TEXT, -- 'confused', 'engaged', 'frustrated', etc.
      immediate_goal TEXT,
      current_topic TEXT,
      scaffolding_level INTEGER DEFAULT 2, -- 1-5, where 5 is most support
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(learner_id, session_id)
    );

    CREATE TABLE IF NOT EXISTS strategy_effectiveness (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      learner_id TEXT NOT NULL,
      strategy_type TEXT NOT NULL, -- 'concrete_examples', 'socratic', 'analogies', etc.
      success_count INTEGER DEFAULT 0,
      failure_count INTEGER DEFAULT 0,
      last_used TEXT,
      context_notes TEXT, -- When does this strategy work best?
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(learner_id, strategy_type)
    );

    CREATE TABLE IF NOT EXISTS learner_triggers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      learner_id TEXT NOT NULL,
      trigger_type TEXT NOT NULL, -- 'frustration', 'engagement', 'breakthrough', 'shutdown'
      trigger_description TEXT,
      confidence REAL DEFAULT 0.5,
      observation_count INTEGER DEFAULT 1,
      examples TEXT, -- JSON array of observed examples
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(learner_id, trigger_type, trigger_description)
    );

    CREATE TABLE IF NOT EXISTS pedagogical_insights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      learner_id TEXT NOT NULL,
      insight TEXT NOT NULL,
      insight_type TEXT, -- 'learning_style', 'emotional_need', 'content_preference', etc.
      confidence REAL DEFAULT 0.5,
      supporting_evidence TEXT, -- JSON array
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS relationship_dynamics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      learner_id TEXT NOT NULL,
      trust_level REAL DEFAULT 0.5, -- 0-1
      mutual_recognition_score REAL DEFAULT 0.0, -- 0-1
      vulnerability_shown INTEGER DEFAULT 0, -- Has learner been vulnerable?
      transformation_potential TEXT, -- 'low', 'medium', 'high'
      relationship_stage TEXT, -- 'stranger', 'acquaintance', 'trusted', 'recognized'
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(learner_id)
    );

    CREATE TABLE IF NOT EXISTS intervention_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      learner_id TEXT NOT NULL,
      session_id TEXT,
      intervention_type TEXT NOT NULL, -- 'scaffolding', 'challenge', 'validation', 'redirection'
      intervention_description TEXT,
      learner_response TEXT, -- 'positive', 'neutral', 'negative', 'breakthrough'
      context TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tutor_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      learner_id TEXT NOT NULL,
      eval_run_id TEXT,
      snapshot_data TEXT, -- JSON of full writing pad state
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_conscious_learner ON conscious_state(learner_id);
    CREATE INDEX IF NOT EXISTS idx_strategy_learner ON strategy_effectiveness(learner_id);
    CREATE INDEX IF NOT EXISTS idx_triggers_learner ON learner_triggers(learner_id);
    CREATE INDEX IF NOT EXISTS idx_insights_learner ON pedagogical_insights(learner_id);
    CREATE INDEX IF NOT EXISTS idx_relationship_learner ON relationship_dynamics(learner_id);
    CREATE INDEX IF NOT EXISTS idx_interventions_learner ON intervention_history(learner_id);
  `);
} catch (e) {
  console.warn('[TutorWritingPad] Could not initialize database:', e.message);
}

// ============================================================================
// Conscious Layer Operations
// ============================================================================

/**
 * Update the conscious state (current pedagogical situation)
 */
export function updateConsciousState(learnerId, sessionId, data) {
  if (!db) return null;

  const stmt = db.prepare(`
    INSERT INTO conscious_state (learner_id, session_id, current_strategy, learner_perceived_state, immediate_goal, current_topic, scaffolding_level, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(learner_id, session_id) DO UPDATE SET
      current_strategy = COALESCE(excluded.current_strategy, current_strategy),
      learner_perceived_state = COALESCE(excluded.learner_perceived_state, learner_perceived_state),
      immediate_goal = COALESCE(excluded.immediate_goal, immediate_goal),
      current_topic = COALESCE(excluded.current_topic, current_topic),
      scaffolding_level = COALESCE(excluded.scaffolding_level, scaffolding_level),
      updated_at = CURRENT_TIMESTAMP
  `);

  return stmt.run(
    learnerId,
    sessionId,
    data.currentStrategy || null,
    data.learnerPerceivedState || null,
    data.immediateGoal || null,
    data.currentTopic || null,
    data.scaffoldingLevel || null,
  );
}

/**
 * Get current conscious state
 */
export function getConsciousState(learnerId, sessionId) {
  if (!db) return null;

  const row = db
    .prepare(
      `
    SELECT * FROM conscious_state WHERE learner_id = ? AND session_id = ?
  `,
    )
    .get(learnerId, sessionId);

  if (!row) return null;

  return {
    currentStrategy: row.current_strategy,
    learnerPerceivedState: row.learner_perceived_state,
    immediateGoal: row.immediate_goal,
    currentTopic: row.current_topic,
    scaffoldingLevel: row.scaffolding_level,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// Strategy Effectiveness Operations
// ============================================================================

/**
 * Record a strategy use and its outcome
 */
export function recordStrategyUse(learnerId, strategyType, success, contextNotes = null) {
  if (!db) return null;

  const existing = db
    .prepare(
      `
    SELECT * FROM strategy_effectiveness WHERE learner_id = ? AND strategy_type = ?
  `,
    )
    .get(learnerId, strategyType);

  if (existing) {
    const stmt = db.prepare(`
      UPDATE strategy_effectiveness
      SET success_count = success_count + ?,
          failure_count = failure_count + ?,
          last_used = CURRENT_TIMESTAMP,
          context_notes = COALESCE(?, context_notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE learner_id = ? AND strategy_type = ?
    `);
    return stmt.run(success ? 1 : 0, success ? 0 : 1, contextNotes, learnerId, strategyType);
  } else {
    const stmt = db.prepare(`
      INSERT INTO strategy_effectiveness (learner_id, strategy_type, success_count, failure_count, last_used, context_notes)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `);
    return stmt.run(learnerId, strategyType, success ? 1 : 0, success ? 0 : 1, contextNotes);
  }
}

/**
 * Get strategy effectiveness for a learner
 */
export function getStrategyEffectiveness(learnerId) {
  if (!db) return [];

  const rows = db
    .prepare(
      `
    SELECT *,
      CASE WHEN success_count + failure_count > 0
        THEN CAST(success_count AS REAL) / (success_count + failure_count)
        ELSE 0.5
      END as success_rate
    FROM strategy_effectiveness
    WHERE learner_id = ?
    ORDER BY success_rate DESC
  `,
    )
    .all(learnerId);

  return rows.map((row) => ({
    strategyType: row.strategy_type,
    successCount: row.success_count,
    failureCount: row.failure_count,
    successRate: row.success_rate,
    lastUsed: row.last_used,
    contextNotes: row.context_notes,
  }));
}

/**
 * Get the best strategy for this learner
 */
export function getBestStrategy(learnerId, excludeTypes = []) {
  if (!db) return null;

  const strategies = getStrategyEffectiveness(learnerId);
  return strategies.find((s) => !excludeTypes.includes(s.strategyType) && s.successRate > 0.5);
}

// ============================================================================
// Learner Triggers Operations
// ============================================================================

/**
 * Record an observed trigger
 */
export function recordTrigger(learnerId, triggerType, description, example = null) {
  if (!db) return null;

  const existing = db
    .prepare(
      `
    SELECT * FROM learner_triggers WHERE learner_id = ? AND trigger_type = ? AND trigger_description = ?
  `,
    )
    .get(learnerId, triggerType, description);

  if (existing) {
    let examples = existing.examples ? JSON.parse(existing.examples) : [];
    if (example) examples.push(example);
    examples = examples.slice(-5); // Keep last 5 examples

    const stmt = db.prepare(`
      UPDATE learner_triggers
      SET confidence = MIN(1.0, confidence + 0.1),
          observation_count = observation_count + 1,
          examples = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(JSON.stringify(examples), existing.id);
  } else {
    const stmt = db.prepare(`
      INSERT INTO learner_triggers (learner_id, trigger_type, trigger_description, examples)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(learnerId, triggerType, description, example ? JSON.stringify([example]) : null);
  }
}

/**
 * Get triggers for a learner
 */
export function getTriggers(learnerId, triggerType = null) {
  if (!db) return [];

  let query = 'SELECT * FROM learner_triggers WHERE learner_id = ?';
  const params = [learnerId];

  if (triggerType) {
    query += ' AND trigger_type = ?';
    params.push(triggerType);
  }

  query += ' ORDER BY confidence DESC';

  const rows = db.prepare(query).all(...params);

  return rows.map((row) => ({
    triggerType: row.trigger_type,
    description: row.trigger_description,
    confidence: row.confidence,
    observationCount: row.observation_count,
    examples: row.examples ? JSON.parse(row.examples) : [],
  }));
}

// ============================================================================
// Pedagogical Insights Operations
// ============================================================================

/**
 * Record a pedagogical insight about this learner
 */
export function recordInsight(learnerId, insight, insightType, confidence = 0.5, evidence = []) {
  if (!db) return null;

  const stmt = db.prepare(`
    INSERT INTO pedagogical_insights (learner_id, insight, insight_type, confidence, supporting_evidence)
    VALUES (?, ?, ?, ?, ?)
  `);

  return stmt.run(learnerId, insight, insightType, confidence, JSON.stringify(evidence));
}

/**
 * Get pedagogical insights for a learner
 */
export function getInsights(learnerId, minConfidence = 0) {
  if (!db) return [];

  const rows = db
    .prepare(
      `
    SELECT * FROM pedagogical_insights
    WHERE learner_id = ? AND confidence >= ?
    ORDER BY confidence DESC
  `,
    )
    .all(learnerId, minConfidence);

  return rows.map((row) => ({
    id: row.id,
    insight: row.insight,
    insightType: row.insight_type,
    confidence: row.confidence,
    supportingEvidence: row.supporting_evidence ? JSON.parse(row.supporting_evidence) : [],
    createdAt: row.created_at,
  }));
}

// ============================================================================
// Relationship Dynamics Operations
// ============================================================================

/**
 * Update relationship dynamics with a learner
 */
export function updateRelationshipDynamics(learnerId, data) {
  if (!db) return null;

  const existing = db
    .prepare(
      `
    SELECT * FROM relationship_dynamics WHERE learner_id = ?
  `,
    )
    .get(learnerId);

  if (existing) {
    const stmt = db.prepare(`
      UPDATE relationship_dynamics
      SET trust_level = COALESCE(?, trust_level),
          mutual_recognition_score = COALESCE(?, mutual_recognition_score),
          vulnerability_shown = COALESCE(?, vulnerability_shown),
          transformation_potential = COALESCE(?, transformation_potential),
          relationship_stage = COALESCE(?, relationship_stage),
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE learner_id = ?
    `);
    return stmt.run(
      data.trustLevel ?? null,
      data.mutualRecognitionScore ?? null,
      data.vulnerabilityShown ?? null,
      data.transformationPotential ?? null,
      data.relationshipStage ?? null,
      data.notes ?? null,
      learnerId,
    );
  } else {
    const stmt = db.prepare(`
      INSERT INTO relationship_dynamics (learner_id, trust_level, mutual_recognition_score, vulnerability_shown, transformation_potential, relationship_stage, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      learnerId,
      data.trustLevel ?? 0.5,
      data.mutualRecognitionScore ?? 0.0,
      data.vulnerabilityShown ?? 0,
      data.transformationPotential ?? 'medium',
      data.relationshipStage ?? 'stranger',
      data.notes ?? null,
    );
  }
}

/**
 * Get relationship dynamics for a learner
 */
export function getRelationshipDynamics(learnerId) {
  if (!db) return null;

  const row = db
    .prepare(
      `
    SELECT * FROM relationship_dynamics WHERE learner_id = ?
  `,
    )
    .get(learnerId);

  if (!row) return null;

  return {
    trustLevel: row.trust_level,
    mutualRecognitionScore: row.mutual_recognition_score,
    vulnerabilityShown: row.vulnerability_shown === 1,
    transformationPotential: row.transformation_potential,
    relationshipStage: row.relationship_stage,
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// Intervention History Operations
// ============================================================================

/**
 * Record an intervention and its outcome
 */
export function recordIntervention(learnerId, sessionId, data) {
  if (!db) return null;

  const stmt = db.prepare(`
    INSERT INTO intervention_history (learner_id, session_id, intervention_type, intervention_description, learner_response, context)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  return stmt.run(
    learnerId,
    sessionId,
    data.interventionType,
    data.interventionDescription || null,
    data.learnerResponse || null,
    data.context || null,
  );
}

/**
 * Get recent interventions for a learner
 */
export function getRecentInterventions(learnerId, limit = 10) {
  if (!db) return [];

  const rows = db
    .prepare(
      `
    SELECT * FROM intervention_history
    WHERE learner_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `,
    )
    .all(learnerId, limit);

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    interventionType: row.intervention_type,
    interventionDescription: row.intervention_description,
    learnerResponse: row.learner_response,
    context: row.context,
    createdAt: row.created_at,
  }));
}

// ============================================================================
// Full Writing Pad Operations
// ============================================================================

/**
 * Get the complete writing pad state for a tutor's knowledge of a learner
 */
export function getFullWritingPad(learnerId, sessionId = null) {
  const conscious = sessionId ? getConsciousState(learnerId, sessionId) : null;
  const strategies = getStrategyEffectiveness(learnerId);
  const triggers = getTriggers(learnerId);
  const insights = getInsights(learnerId);
  const relationship = getRelationshipDynamics(learnerId);
  const recentInterventions = getRecentInterventions(learnerId, 5);

  return {
    conscious,
    preconscious: {
      effectiveStrategies: strategies.filter((s) => s.successRate > 0.6),
      ineffectiveStrategies: strategies.filter((s) => s.successRate < 0.4),
      triggers: {
        frustration: triggers.filter((t) => t.triggerType === 'frustration'),
        engagement: triggers.filter((t) => t.triggerType === 'engagement'),
        breakthrough: triggers.filter((t) => t.triggerType === 'breakthrough'),
        shutdown: triggers.filter((t) => t.triggerType === 'shutdown'),
      },
    },
    unconscious: {
      insights,
      relationshipDynamics: relationship,
    },
    recentInterventions,
  };
}

/**
 * Create a snapshot of tutor writing pad state (for long-term tracking)
 */
export function createSnapshot(learnerId, evalRunId = null) {
  if (!db) return null;

  const fullState = getFullWritingPad(learnerId);

  const stmt = db.prepare(`
    INSERT INTO tutor_snapshots (learner_id, eval_run_id, snapshot_data)
    VALUES (?, ?, ?)
  `);

  const result = stmt.run(learnerId, evalRunId, JSON.stringify(fullState));
  return {
    id: result.lastInsertRowid,
    ...fullState,
  };
}

/**
 * Get snapshots for comparing tutor learning across evals
 */
export function getSnapshots(learnerId, limit = 10) {
  if (!db) return [];

  const rows = db
    .prepare(
      `
    SELECT * FROM tutor_snapshots WHERE learner_id = ?
    ORDER BY created_at DESC LIMIT ?
  `,
    )
    .all(learnerId, limit);

  return rows.map((row) => ({
    id: row.id,
    evalRunId: row.eval_run_id,
    snapshotData: JSON.parse(row.snapshot_data),
    createdAt: row.created_at,
  }));
}

/**
 * Build narrative summary for injection into prompts
 */
export function buildNarrativeSummary(learnerId, sessionId = null) {
  const pad = getFullWritingPad(learnerId, sessionId);
  const parts = [];

  // Current state
  if (pad.conscious) {
    parts.push(`Current strategy: ${pad.conscious.currentStrategy || 'adaptive'}`);
    if (pad.conscious.learnerPerceivedState) {
      parts.push(`Learner appears: ${pad.conscious.learnerPerceivedState}`);
    }
    if (pad.conscious.immediateGoal) {
      parts.push(`Working toward: ${pad.conscious.immediateGoal}`);
    }
    parts.push(`Scaffolding level: ${pad.conscious.scaffoldingLevel || 3}/5`);
  }

  // What works
  if (pad.preconscious.effectiveStrategies.length > 0) {
    parts.push(`\nEffective approaches for this learner:`);
    for (const s of pad.preconscious.effectiveStrategies.slice(0, 3)) {
      parts.push(`  - ${s.strategyType} (${Math.round(s.successRate * 100)}% success)`);
    }
  }

  // What to avoid
  if (pad.preconscious.ineffectiveStrategies.length > 0) {
    parts.push(`\nApproaches that haven't worked:`);
    for (const s of pad.preconscious.ineffectiveStrategies.slice(0, 3)) {
      parts.push(`  - ${s.strategyType}`);
    }
  }

  // Triggers
  const triggers = pad.preconscious.triggers;
  if (triggers.frustration.length > 0) {
    const desc = triggers.frustration.map((t) => t.description).join('; ');
    parts.push(`\nFrustration triggers: ${desc}`);
  }
  if (triggers.engagement.length > 0) {
    const desc = triggers.engagement.map((t) => t.description).join('; ');
    parts.push(`Engagement triggers: ${desc}`);
  }

  // Insights
  const highConfidenceInsights = pad.unconscious.insights.filter((i) => i.confidence > 0.7);
  if (highConfidenceInsights.length > 0) {
    parts.push(`\nKey insights about this learner:`);
    for (const i of highConfidenceInsights.slice(0, 3)) {
      parts.push(`  - ${i.insight}`);
    }
  }

  // Relationship
  if (pad.unconscious.relationshipDynamics) {
    const r = pad.unconscious.relationshipDynamics;
    parts.push(`\nRelationship: ${r.relationshipStage || 'developing'}`);
    parts.push(`Trust level: ${Math.round((r.trustLevel || 0.5) * 100)}%`);
    if (r.transformationPotential) {
      parts.push(`Transformation potential: ${r.transformationPotential}`);
    }
  }

  return parts.join('\n');
}

/**
 * Clear all data for a learner (for test isolation)
 */
export function clearTutorData(learnerId) {
  if (!db) return;

  db.prepare('DELETE FROM conscious_state WHERE learner_id = ?').run(learnerId);
  db.prepare('DELETE FROM strategy_effectiveness WHERE learner_id = ?').run(learnerId);
  db.prepare('DELETE FROM learner_triggers WHERE learner_id = ?').run(learnerId);
  db.prepare('DELETE FROM pedagogical_insights WHERE learner_id = ?').run(learnerId);
  db.prepare('DELETE FROM relationship_dynamics WHERE learner_id = ?').run(learnerId);
  db.prepare('DELETE FROM intervention_history WHERE learner_id = ?').run(learnerId);
  db.prepare('DELETE FROM tutor_snapshots WHERE learner_id = ?').run(learnerId);
}

export default {
  // Conscious
  updateConsciousState,
  getConsciousState,
  // Strategies
  recordStrategyUse,
  getStrategyEffectiveness,
  getBestStrategy,
  // Triggers
  recordTrigger,
  getTriggers,
  // Insights
  recordInsight,
  getInsights,
  // Relationship
  updateRelationshipDynamics,
  getRelationshipDynamics,
  // Interventions
  recordIntervention,
  getRecentInterventions,
  // Full pad
  getFullWritingPad,
  createSnapshot,
  getSnapshots,
  buildNarrativeSummary,
  clearTutorData,
};
