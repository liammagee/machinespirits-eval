import { createRequire } from 'module';
import { randomBytes } from 'crypto';

// Use createRequire to bypass vitest module mocking and get the real better-sqlite3
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

/**
 * Create an in-memory better-sqlite3 database with the recognition schema.
 * @returns {Database} In-memory SQLite database
 */
export function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS writing_pads (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_recognition_moments INTEGER DEFAULT 0,
      dialectical_depth REAL DEFAULT 0.0,
      mutual_transformation_score REAL DEFAULT 0.0,
      pedagogical_attunement REAL DEFAULT 0.5,
      conscious_state TEXT DEFAULT '{}',
      preconscious_state TEXT DEFAULT '{}',
      unconscious_state TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS recognition_moments (
      id TEXT PRIMARY KEY,
      writing_pad_id TEXT NOT NULL,
      session_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      thesis_agent TEXT,
      thesis_position TEXT NOT NULL,
      thesis_reasoning TEXT,
      antithesis_agent TEXT,
      antithesis_position TEXT NOT NULL,
      antithesis_reasoning TEXT,
      synthesis_resolution TEXT,
      ego_transformation TEXT,
      superego_transformation TEXT,
      learner_insight TEXT,
      mutual_acknowledgment BOOLEAN DEFAULT FALSE,
      recognition_type TEXT,
      struggle_depth REAL DEFAULT 0.0,
      persistence_layer TEXT,
      consolidated_at DATETIME,
      learner_context TEXT,
      dialogue_trace TEXT,
      ghost_demand TEXT,
      learner_need TEXT,
      synthesis_strategy TEXT,
      transformative BOOLEAN DEFAULT FALSE,
      parameters TEXT,
      FOREIGN KEY (writing_pad_id) REFERENCES writing_pads(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS learner_recognition_events (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL,
      writing_pad_id TEXT NOT NULL,
      session_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      event_type TEXT NOT NULL,
      tutor_suggestion TEXT,
      learner_response TEXT,
      resistance_interpretation TEXT,
      trigger_event TEXT,
      evidence TEXT,
      recognition_achieved BOOLEAN,
      demand_category TEXT,
      demand_strength REAL,
      context_snapshot TEXT
    );
  `);

  return db;
}

/**
 * Seed a writing_pads row.
 * @param {Database} db
 * @param {string} learnerId
 * @param {object} overrides
 * @returns {object} The inserted row
 */
export function seedWritingPad(db, learnerId, overrides = {}) {
  const id = overrides.id || `pad-test-${randomBytes(4).toString('hex')}`;
  const defaults = {
    id,
    learner_id: learnerId,
    total_recognition_moments: 0,
    dialectical_depth: 0.0,
    mutual_transformation_score: 0.0,
    pedagogical_attunement: 0.5,
    conscious_state: '{}',
    preconscious_state: '{}',
    unconscious_state: '{}',
  };
  const data = { ...defaults, ...overrides, id, learner_id: learnerId };

  db.prepare(`
    INSERT INTO writing_pads (id, learner_id, total_recognition_moments, dialectical_depth,
      mutual_transformation_score, pedagogical_attunement, conscious_state, preconscious_state, unconscious_state)
    VALUES (@id, @learner_id, @total_recognition_moments, @dialectical_depth,
      @mutual_transformation_score, @pedagogical_attunement, @conscious_state, @preconscious_state, @unconscious_state)
  `).run(data);

  return db.prepare('SELECT * FROM writing_pads WHERE id = ?').get(id);
}

/**
 * Seed a recognition_moments row.
 * @param {Database} db
 * @param {string} padId
 * @param {object} overrides
 * @returns {object} The inserted row
 */
export function seedRecognitionMoment(db, padId, overrides = {}) {
  const id = overrides.id || `rm-test-${randomBytes(4).toString('hex')}`;
  const defaults = {
    id,
    writing_pad_id: padId,
    session_id: null,
    created_at: new Date().toISOString(),
    thesis_position: 'test thesis',
    antithesis_position: 'test antithesis',
    struggle_depth: 0.0,
    mutual_acknowledgment: 0,
    recognition_type: null,
    persistence_layer: 'conscious',
    consolidated_at: null,
    synthesis_strategy: null,
    synthesis_resolution: null,
    transformative: 0,
  };
  const data = { ...defaults, ...overrides, id, writing_pad_id: padId };

  db.prepare(`
    INSERT INTO recognition_moments (id, writing_pad_id, session_id, created_at,
      thesis_position, antithesis_position, struggle_depth, mutual_acknowledgment,
      recognition_type, persistence_layer, consolidated_at, synthesis_strategy,
      synthesis_resolution, transformative)
    VALUES (@id, @writing_pad_id, @session_id, @created_at,
      @thesis_position, @antithesis_position, @struggle_depth, @mutual_acknowledgment,
      @recognition_type, @persistence_layer, @consolidated_at, @synthesis_strategy,
      @synthesis_resolution, @transformative)
  `).run(data);

  return db.prepare('SELECT * FROM recognition_moments WHERE id = ?').get(id);
}

/**
 * Seed a learner_recognition_events row.
 * @param {Database} db
 * @param {string} learnerId
 * @param {string} padId
 * @param {object} overrides
 * @returns {object} The inserted row
 */
export function seedLearnerEvent(db, learnerId, padId, overrides = {}) {
  const id = overrides.id || `evt-test-${randomBytes(4).toString('hex')}`;
  const defaults = {
    id,
    learner_id: learnerId,
    writing_pad_id: padId,
    session_id: null,
    event_type: 'resistance',
    resistance_interpretation: null,
    trigger_event: null,
    evidence: null,
    recognition_achieved: null,
  };
  const data = { ...defaults, ...overrides, id, learner_id: learnerId, writing_pad_id: padId };

  db.prepare(`
    INSERT INTO learner_recognition_events (id, learner_id, writing_pad_id, session_id,
      event_type, resistance_interpretation, trigger_event, evidence, recognition_achieved)
    VALUES (@id, @learner_id, @writing_pad_id, @session_id,
      @event_type, @resistance_interpretation, @trigger_event, @evidence, @recognition_achieved)
  `).run(data);

  return db.prepare('SELECT * FROM learner_recognition_events WHERE id = ?').get(id);
}

/**
 * Build a mock WritingPad object (the shape returned by writingPadService.getWritingPad).
 * @param {object} overrides
 * @returns {object}
 */
export function buildMockWritingPad(overrides = {}) {
  const defaults = {
    id: 'pad-id',
    learnerId: 'learner-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metrics: {
      totalRecognitionMoments: 0,
      dialecticalDepth: 0,
      mutualTransformationScore: 0,
      pedagogicalAttunement: 0.5,
    },
    conscious: {
      workingThoughts: [],
      lastCleared: null,
    },
    preconscious: {
      recentPatterns: [],
    },
    unconscious: {
      permanentTraces: [],
      learnerArchetype: {
        preferredLearningStyle: null,
        commonStruggles: [],
        breakthroughPatterns: [],
        lastUpdated: null,
      },
      conflictPatterns: [],
    },
  };

  const result = { ...defaults, ...overrides };
  if (overrides.metrics) {
    result.metrics = { ...defaults.metrics, ...overrides.metrics };
  }
  if (overrides.conscious) {
    result.conscious = { ...defaults.conscious, ...overrides.conscious };
  }
  if (overrides.preconscious) {
    result.preconscious = { ...defaults.preconscious, ...overrides.preconscious };
  }
  if (overrides.unconscious) {
    result.unconscious = { ...defaults.unconscious, ...overrides.unconscious };
    if (overrides.unconscious.learnerArchetype) {
      result.unconscious.learnerArchetype = {
        ...defaults.unconscious.learnerArchetype,
        ...overrides.unconscious.learnerArchetype,
      };
    }
  }
  return result;
}
