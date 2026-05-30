-- Migration 008: Writing Pad Schema
-- Phase 1 of Recognition Engine: Three-layer memory system (conscious, preconscious, unconscious)
-- Based on Freud's topographic model and Magic Writing Pad metaphor

-- Writing Pads (one per learner, persists across sessions)
CREATE TABLE IF NOT EXISTS writing_pads (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL UNIQUE,  -- One pad per learner
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Metrics (continuously updated)
  total_recognition_moments INTEGER DEFAULT 0,
  dialectical_depth REAL DEFAULT 0.0,           -- 0.0-1.0, sophistication of struggles
  mutual_transformation_score REAL DEFAULT 0.0, -- How much both agents evolve
  pedagogical_attunement REAL DEFAULT 0.5,      -- How well tutor knows learner

  -- Three-layer memory structure (JSON)
  conscious_state TEXT DEFAULT '{}',       -- Ephemeral working memory
  preconscious_state TEXT DEFAULT '{}',    -- Recent patterns, provisional rules
  unconscious_state TEXT DEFAULT '{}'      -- Permanent traces, deep archetype
);

CREATE INDEX IF NOT EXISTS idx_writing_pads_learner ON writing_pads(learner_id);

-- Recognition Moments (historical record of dialectical struggles)
-- Replaces in-memory recognition moments from Phase 0
CREATE TABLE IF NOT EXISTS recognition_moments (
  id TEXT PRIMARY KEY,
  writing_pad_id TEXT NOT NULL,
  session_id TEXT,                         -- Link to tutor session
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Dialectical structure
  thesis_agent TEXT CHECK(thesis_agent IN ('ego', 'superego', 'learner')),
  thesis_position TEXT NOT NULL,
  thesis_reasoning TEXT,

  antithesis_agent TEXT CHECK(antithesis_agent IN ('ego', 'superego', 'learner')),
  antithesis_position TEXT NOT NULL,
  antithesis_reasoning TEXT,

  synthesis_resolution TEXT,               -- May be NULL if struggle unresolved

  -- Transformations (how agents changed)
  ego_transformation TEXT,
  superego_transformation TEXT,
  learner_insight TEXT,

  -- Recognition outcome
  mutual_acknowledgment BOOLEAN DEFAULT FALSE,
  recognition_type TEXT CHECK(recognition_type IN ('pedagogical', 'metacognitive', 'existential')),
  struggle_depth REAL DEFAULT 0.0,         -- How deep/significant this conflict was

  -- Memory persistence
  persistence_layer TEXT CHECK(persistence_layer IN ('conscious', 'preconscious', 'unconscious')),
  consolidated_at DATETIME,                -- When it moved to unconscious

  -- Context
  learner_context TEXT,                    -- JSON snapshot of learner state
  dialogue_trace TEXT,                     -- JSON of full ego-superego dialogue

  -- Phase 0 compatibility (ghost/learner parameters)
  ghost_demand TEXT,                       -- JSON: { disapproves, severity, voice, principle }
  learner_need TEXT,                       -- JSON: { urgent, intensity, need }
  synthesis_strategy TEXT,                 -- ghost_dominates | learner_dominates | dialectical_synthesis
  transformative BOOLEAN DEFAULT FALSE,
  parameters TEXT,                         -- JSON: { superegoCompliance, recognitionSeeking }

  FOREIGN KEY (writing_pad_id) REFERENCES writing_pads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recognition_moments_pad ON recognition_moments(writing_pad_id);
CREATE INDEX IF NOT EXISTS idx_recognition_moments_type ON recognition_moments(recognition_type);
CREATE INDEX IF NOT EXISTS idx_recognition_moments_layer ON recognition_moments(persistence_layer);
CREATE INDEX IF NOT EXISTS idx_recognition_moments_created ON recognition_moments(created_at DESC);

-- Learner Resistance & Breakthroughs (active tracking of learner's role in dialectic)
CREATE TABLE IF NOT EXISTS learner_recognition_events (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL,
  writing_pad_id TEXT NOT NULL,
  session_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  event_type TEXT CHECK(event_type IN ('resistance', 'breakthrough', 'demand')) NOT NULL,

  -- For resistance events
  tutor_suggestion TEXT,                   -- What tutor suggested
  learner_response TEXT,                   -- How learner responded
  resistance_interpretation TEXT CHECK(resistance_interpretation IN ('productive', 'confused', 'disengaged')),

  -- For breakthrough events
  trigger_event TEXT,
  evidence TEXT,                           -- What showed the breakthrough
  recognition_achieved BOOLEAN,

  -- For demand events (learner explicitly requests something)
  demand_category TEXT,                    -- autonomy, scaffolding, challenge, validation
  demand_strength REAL,                    -- 0.0-1.0

  -- Context
  context_snapshot TEXT                    -- JSON
);

CREATE INDEX IF NOT EXISTS idx_learner_events_learner ON learner_recognition_events(learner_id);
CREATE INDEX IF NOT EXISTS idx_learner_events_type ON learner_recognition_events(event_type);
CREATE INDEX IF NOT EXISTS idx_learner_events_pad ON learner_recognition_events(writing_pad_id);
