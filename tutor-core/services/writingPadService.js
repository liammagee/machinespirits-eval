/**
 * Writing Pad Service
 *
 * Implements Freud's three-layer memory model for the AI tutor.
 * Manages transitions between conscious, preconscious, and unconscious layers.
 *
 * Metaphor: Freud's "Magic Writing Pad"
 * - Conscious: Wax surface (ephemeral, erased after each use)
 * - Preconscious: Translucent sheet (fading traces, provisional)
 * - Unconscious: Permanent wax substrate (permanent engravings)
 *
 * Phase 1 of Recognition Engine
 */

import { randomBytes } from 'crypto';
import { getDb } from './dbService.js';
import { isQuietOrTranscript } from './tutorDialogueEngine.js';

// ============================================================================
// Writing Pad Management
// ============================================================================

/**
 * Initialize a writing pad for a learner
 * @param {string} learnerId - Learner identifier
 * @returns {object} - Writing pad object
 */
export function initializeWritingPad(learnerId) {
  const existing = getWritingPad(learnerId);
  if (existing) {
    if (!isQuietOrTranscript()) console.log(`[WritingPad] Pad already exists for learner ${learnerId}`);
    return existing;
  }

  const id = `pad-${Date.now()}-${randomBytes(4).toString('hex')}`;

  const stmt = getDb().prepare(`
    INSERT INTO writing_pads (id, learner_id, conscious_state, preconscious_state, unconscious_state)
    VALUES (?, ?, ?, ?, ?)
  `);

  const initialConscious = {
    workingThoughts: [],
    ephemeralNotes: {},
    lastCleared: new Date().toISOString(),
  };

  const initialPreconscious = {
    recentPatterns: [],
    provisionalRules: [],
    fadeThreshold: 20, // Number of interactions before patterns fade
  };

  const initialUnconscious = {
    permanentTraces: [],
    learnerArchetype: {
      preferredLearningStyle: null,
      commonStruggles: [],
      breakthroughPatterns: [],
    },
    conflictPatterns: [],
    superegoTraces: [], // Internalized pedagogical standards
  };

  stmt.run(
    id,
    learnerId,
    JSON.stringify(initialConscious),
    JSON.stringify(initialPreconscious),
    JSON.stringify(initialUnconscious)
  );

  if (!isQuietOrTranscript()) console.log(`[WritingPad] Created pad ${id} for learner ${learnerId}`);
  return getWritingPad(learnerId);
}

/**
 * Get writing pad for learner
 * @param {string} learnerId - Learner identifier
 * @returns {object|null} - Writing pad object or null
 */
export function getWritingPad(learnerId) {
  const stmt = getDb().prepare('SELECT * FROM writing_pads WHERE learner_id = ?');
  const row = stmt.get(learnerId);

  if (!row) return null;

  return {
    id: row.id,
    learnerId: row.learner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metrics: {
      totalRecognitionMoments: row.total_recognition_moments,
      dialecticalDepth: row.dialectical_depth,
      mutualTransformationScore: row.mutual_transformation_score,
      pedagogicalAttunement: row.pedagogical_attunement,
    },
    conscious: JSON.parse(row.conscious_state),
    preconscious: JSON.parse(row.preconscious_state),
    unconscious: JSON.parse(row.unconscious_state),
  };
}

/**
 * Get or initialize writing pad for learner
 * @param {string} learnerId - Learner identifier
 * @returns {object} - Writing pad object
 */
export function getOrInitializeWritingPad(learnerId) {
  return getWritingPad(learnerId) || initializeWritingPad(learnerId);
}

// ============================================================================
// Layer Management
// ============================================================================

/**
 * Update conscious layer (ephemeral working memory)
 * @param {string} learnerId - Learner identifier
 * @param {object} updates - Updates to merge into conscious layer
 * @returns {object} - Updated writing pad
 */
export function updateConscious(learnerId, updates) {
  const pad = getWritingPad(learnerId);
  if (!pad) throw new Error(`Writing pad not found for learner ${learnerId}`);

  const newConscious = {
    ...pad.conscious,
    ...updates,
    lastUpdated: new Date().toISOString(),
  };

  const stmt = getDb().prepare(`
    UPDATE writing_pads
    SET conscious_state = ?, updated_at = CURRENT_TIMESTAMP
    WHERE learner_id = ?
  `);

  stmt.run(JSON.stringify(newConscious), learnerId);

  return getWritingPad(learnerId);
}

/**
 * Clear conscious layer (after suggestion generated)
 * @param {string} learnerId - Learner identifier
 * @returns {object} - Updated writing pad
 */
export function clearConscious(learnerId) {
  return updateConscious(learnerId, {
    workingThoughts: [],
    ephemeralNotes: {},
    lastCleared: new Date().toISOString(),
  });
}

/**
 * Update unconscious layer (permanent memory)
 * @param {string} learnerId - Learner identifier
 * @param {object} updates - Updates to unconscious layer
 * @returns {object} - Updated writing pad
 */
export function updateUnconscious(learnerId, updates) {
  const pad = getWritingPad(learnerId);
  if (!pad) throw new Error(`Writing pad not found for learner ${learnerId}`);

  const newUnconscious = {
    ...pad.unconscious,
    ...updates,
    lastUpdated: new Date().toISOString(),
  };

  const stmt = getDb().prepare(`
    UPDATE writing_pads
    SET unconscious_state = ?, updated_at = CURRENT_TIMESTAMP
    WHERE learner_id = ?
  `);

  stmt.run(JSON.stringify(newUnconscious), learnerId);

  return getWritingPad(learnerId);
}

/**
 * Promote pattern to preconscious (pattern detected in conscious)
 * @param {string} learnerId - Learner identifier
 * @param {object} pattern - Pattern to promote
 * @returns {object} - Updated writing pad
 */
export function promoteToPreconscious(learnerId, pattern) {
  const pad = getWritingPad(learnerId);
  if (!pad) throw new Error(`Writing pad not found for learner ${learnerId}`);

  // Check if similar pattern already exists
  const existingPattern = pad.preconscious.recentPatterns.find(
    p => p.type === pattern.type && p.signature === pattern.signature
  );

  let newPatterns;
  if (existingPattern) {
    // Reinforce existing pattern
    newPatterns = pad.preconscious.recentPatterns.map(p => {
      if (p === existingPattern) {
        return {
          ...p,
          reinforcementCount: (p.reinforcementCount || 1) + 1,
          confidence: Math.min((p.confidence || 0.5) + 0.1, 1.0),
          lastObserved: new Date().toISOString(),
        };
      }
      return p;
    });
  } else {
    // Add new pattern
    newPatterns = [
      ...pad.preconscious.recentPatterns,
      {
        ...pattern,
        firstObserved: new Date().toISOString(),
        lastObserved: new Date().toISOString(),
        confidence: pattern.confidence || 0.5,
        reinforcementCount: 1,
      },
    ];
  }

  const newPreconscious = {
    ...pad.preconscious,
    recentPatterns: newPatterns,
  };

  const stmt = getDb().prepare(`
    UPDATE writing_pads
    SET preconscious_state = ?, updated_at = CURRENT_TIMESTAMP
    WHERE learner_id = ?
  `);

  stmt.run(JSON.stringify(newPreconscious), learnerId);

  if (!isQuietOrTranscript()) console.log(`[WritingPad] Promoted pattern to preconscious for learner ${learnerId}`);
  return getWritingPad(learnerId);
}

/**
 * Settle to unconscious (permanent trace from recognition moment)
 * @param {string} learnerId - Learner identifier
 * @param {object} recognitionMoment - Recognition moment to settle
 * @returns {object} - Updated writing pad
 */
export function settleToUnconscious(learnerId, recognitionMoment) {
  const pad = getWritingPad(learnerId);
  if (!pad) throw new Error(`Writing pad not found for learner ${learnerId}`);

  const trace = {
    id: recognitionMoment.id,
    timestamp: recognitionMoment.created_at || new Date().toISOString(),
    synthesis: recognitionMoment.synthesis_resolution,
    transformations: {
      ego: recognitionMoment.ego_transformation,
      superego: recognitionMoment.superego_transformation,
      learner: recognitionMoment.learner_insight,
    },
    recognitionType: recognitionMoment.recognition_type,
    struggleDepth: recognitionMoment.struggle_depth || 0.0,
  };

  const newUnconscious = {
    ...pad.unconscious,
    permanentTraces: [
      ...pad.unconscious.permanentTraces,
      trace,
    ],
  };

  const stmt = getDb().prepare(`
    UPDATE writing_pads
    SET unconscious_state = ?,
        total_recognition_moments = total_recognition_moments + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE learner_id = ?
  `);

  stmt.run(JSON.stringify(newUnconscious), learnerId);

  // Mark recognition moment as consolidated to unconscious
  getDb().prepare(`
    UPDATE recognition_moments
    SET persistence_layer = 'unconscious', consolidated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(recognitionMoment.id);

  if (!isQuietOrTranscript()) console.log(`[WritingPad] Settled recognition moment ${recognitionMoment.id} to unconscious`);
  return getWritingPad(learnerId);
}

/**
 * Query unconscious for relevant traces
 * @param {string} learnerId - Learner identifier
 * @param {object} contextQuery - Query parameters
 * @returns {array} - Relevant traces
 */
export function queryUnconscious(learnerId, contextQuery = {}) {
  const pad = getWritingPad(learnerId);
  if (!pad) return [];

  const { recognitionType, maxAge, minStruggleDepth = 0, limit = 10 } = contextQuery;

  return pad.unconscious.permanentTraces
    .filter(trace => {
      if (recognitionType && trace.recognitionType !== recognitionType) {
        return false;
      }
      if (maxAge) {
        const age = Date.now() - new Date(trace.timestamp).getTime();
        if (age > maxAge) return false;
      }
      if (trace.struggleDepth < minStruggleDepth) {
        return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

/**
 * Forget stale patterns from preconscious (decay)
 * @param {string} learnerId - Learner identifier
 * @returns {object} - Updated writing pad
 */
export function forgetStalePatterns(learnerId) {
  const pad = getWritingPad(learnerId);
  if (!pad) return null;

  const fadeThreshold = pad.preconscious.fadeThreshold || 20;
  const now = Date.now();

  const activePatterns = pad.preconscious.recentPatterns.filter(pattern => {
    const ageMs = now - new Date(pattern.firstObserved).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    // Keep if recently observed (< fadeThreshold days) or high confidence
    return ageDays < fadeThreshold || pattern.confidence > 0.8;
  });

  const forgottenCount = pad.preconscious.recentPatterns.length - activePatterns.length;

  if (forgottenCount > 0) {
    const newPreconscious = {
      ...pad.preconscious,
      recentPatterns: activePatterns,
    };

    const stmt = getDb().prepare(`
      UPDATE writing_pads
      SET preconscious_state = ?, updated_at = CURRENT_TIMESTAMP
      WHERE learner_id = ?
    `);

    stmt.run(JSON.stringify(newPreconscious), learnerId);

    if (!isQuietOrTranscript()) console.log(`[WritingPad] Forgot ${forgottenCount} stale pattern(s) for learner ${learnerId}`);
  }

  return getWritingPad(learnerId);
}

// ============================================================================
// Recognition Moments (Database-backed)
// ============================================================================

/**
 * Create recognition moment (replaces Phase 0 in-memory tracking)
 * @param {object} moment - Recognition moment data
 * @returns {object} - Created recognition moment
 */
export function createRecognitionMoment(moment) {
  const {
    writingPadId,
    sessionId = null,
    ghostDemand,
    learnerNeed,
    synthesis,
    parameters,
  } = moment;

  const id = `recog-${Date.now()}-${randomBytes(4).toString('hex')}`;

  const stmt = getDb().prepare(`
    INSERT INTO recognition_moments (
      id, writing_pad_id, session_id, created_at,
      thesis_agent, thesis_position, thesis_reasoning,
      antithesis_agent, antithesis_position, antithesis_reasoning,
      synthesis_resolution,
      ghost_demand, learner_need, synthesis_strategy, transformative, parameters,
      persistence_layer
    ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    writingPadId,
    sessionId,
    'superego',                                    // thesis_agent (ghost)
    ghostDemand.voice || '',                       // thesis_position
    `Principle: ${ghostDemand.principle}`,         // thesis_reasoning
    'learner',                                      // antithesis_agent
    learnerNeed.need || '',                         // antithesis_position
    `Intensity: ${(learnerNeed.intensity ?? 0).toFixed(2)}`, // antithesis_reasoning
    synthesis.synthesis || '',                      // synthesis_resolution
    JSON.stringify(ghostDemand),                    // ghost_demand
    JSON.stringify(learnerNeed),                    // learner_need
    synthesis.synthesis,                            // synthesis_strategy
    synthesis.transformative ? 1 : 0,              // transformative
    JSON.stringify(parameters),                     // parameters
    'conscious'                                     // persistence_layer (starts here)
  );

  if (!isQuietOrTranscript()) console.log(`[WritingPad] Created recognition moment ${id}`);
  return getRecognitionMoment(id);
}

/**
 * Get recognition moment by ID
 * @param {string} id - Recognition moment ID
 * @returns {object|null} - Recognition moment or null
 */
export function getRecognitionMoment(id) {
  const stmt = getDb().prepare('SELECT * FROM recognition_moments WHERE id = ?');
  const row = stmt.get(id);

  if (!row) return null;

  return {
    id: row.id,
    writing_pad_id: row.writing_pad_id,
    session_id: row.session_id,
    created_at: row.created_at,
    ghostDemand: JSON.parse(row.ghost_demand || '{}'),
    learnerNeed: JSON.parse(row.learner_need || '{}'),
    synthesis_strategy: row.synthesis_strategy,
    transformative: Boolean(row.transformative),
    parameters: JSON.parse(row.parameters || '{}'),
    persistence_layer: row.persistence_layer,
    consolidated_at: row.consolidated_at,
  };
}

/**
 * Get recognition moments for a writing pad
 * @param {string} writingPadId - Writing pad ID
 * @param {object} options - Query options
 * @returns {array} - Recognition moments
 */
export function getRecognitionMoments(writingPadId, options = {}) {
  const { limit = 10, transformativeOnly = false } = options;

  let query = 'SELECT * FROM recognition_moments WHERE writing_pad_id = ?';
  const params = [writingPadId];

  if (transformativeOnly) {
    query += ' AND transformative = 1';
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const stmt = getDb().prepare(query);
  const rows = stmt.all(...params);

  return rows.map(row => ({
    id: row.id,
    writing_pad_id: row.writing_pad_id,
    session_id: row.session_id,
    created_at: row.created_at,
    ghostDemand: JSON.parse(row.ghost_demand || '{}'),
    learnerNeed: JSON.parse(row.learner_need || '{}'),
    synthesis_strategy: row.synthesis_strategy,
    transformative: Boolean(row.transformative),
    parameters: JSON.parse(row.parameters || '{}'),
    persistence_layer: row.persistence_layer,
    consolidated_at: row.consolidated_at,
  }));
}

/**
 * Get recognition statistics for a writing pad
 * @param {string} writingPadId - Writing pad ID
 * @returns {object} - Statistics
 */
export function getRecognitionStats(writingPadId) {
  const moments = getRecognitionMoments(writingPadId, { limit: 100 });

  const stats = {
    totalMoments: moments.length,
    transformativeMoments: moments.filter(m => m.transformative).length,
    synthesisStrategies: {
      ghost_dominates: moments.filter(m => m.synthesis_strategy === 'ghost_dominates').length,
      learner_dominates: moments.filter(m => m.synthesis_strategy === 'learner_dominates').length,
      dialectical_synthesis: moments.filter(m => m.synthesis_strategy === 'dialectical_synthesis').length,
    },
    averageCompliance: moments.length > 0
      ? moments.reduce((sum, m) => sum + (m.parameters.superegoCompliance || 0), 0) / moments.length
      : 0,
    averageRecognitionSeeking: moments.length > 0
      ? moments.reduce((sum, m) => sum + (m.parameters.recognitionSeeking || 0), 0) / moments.length
      : 0,
  };

  return stats;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  initializeWritingPad,
  getWritingPad,
  getOrInitializeWritingPad,
  updateConscious,
  clearConscious,
  promoteToPreconscious,
  settleToUnconscious,
  queryUnconscious,
  forgetStalePatterns,
  createRecognitionMoment,
  getRecognitionMoment,
  getRecognitionMoments,
  getRecognitionStats,
};
