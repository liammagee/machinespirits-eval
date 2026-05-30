/**
 * Learner Integration Service
 *
 * Phase 3 of the Recognition Engine: Integrates learner's actual behavior
 * into the recognition process.
 *
 * Key Functions:
 * - Resistance detection (productive, confused, disengaged)
 * - Breakthrough detection (insights, achievements)
 * - Demand detection (autonomy, scaffolding, challenge, validation)
 * - Learner archetype evolution (unconscious layer updates)
 *
 * Based on: RECOGNITION-ENGINE.md Phase 3
 */

import { randomBytes } from 'crypto';
import * as writingPadService from './writingPadService.js';
import { getDb } from './dbService.js';

/**
 * Detect resistance from learner behavior
 *
 * Resistance occurs when learner's actions don't align with tutor suggestions.
 * Three types:
 * - Productive: Learner has valid alternative path
 * - Confused: Learner doesn't understand suggestion
 * - Disengaged: Learner ignoring suggestions
 */
export function detectResistance(options) {
  const {
    learnerId,
    tutorSuggestion,
    learnerAction,
    timeSinceSuggestion, // milliseconds
    context = {},
  } = options;

  // No resistance if no suggestion was given
  if (!tutorSuggestion) {
    return null;
  }

  // Check if learner followed suggestion
  const followed = checkIfSuggestionFollowed(tutorSuggestion, learnerAction);

  if (followed) {
    return null; // No resistance
  }

  // Analyze type of resistance
  const resistanceType = analyzeResistanceType(
    tutorSuggestion,
    learnerAction,
    timeSinceSuggestion,
    context
  );

  return {
    eventType: 'resistance',
    tutorSuggestion: JSON.stringify(tutorSuggestion),
    learnerResponse: JSON.stringify(learnerAction),
    resistanceInterpretation: resistanceType,
    timeSinceSuggestion,
    contextSnapshot: JSON.stringify(context),
  };
}

/**
 * Check if learner followed tutor suggestion
 */
function checkIfSuggestionFollowed(suggestion, action) {
  if (!suggestion || !action) return false;

  // Extract suggestion type and target
  const suggestionType = suggestion.type;
  const suggestionTarget = suggestion.actionTarget || suggestion.id;

  // Check if action matches suggestion
  if (action.type === 'navigate' && suggestionType === 'lecture') {
    return action.target === suggestionTarget;
  }

  if (action.type === 'start_quiz' && suggestionType === 'quiz') {
    return action.target === suggestionTarget;
  }

  if (action.type === 'simulation' && suggestionType === 'simulation') {
    return action.target === suggestionTarget;
  }

  return false;
}

/**
 * Analyze type of resistance
 */
function analyzeResistanceType(suggestion, action, timeSinceSuggestion, context) {
  // Confused resistance: Rapid back-and-forth navigation, no sustained engagement (check first)
  if (context.rapidNavigation || context.bouncing) {
    return 'confused';
  }

  // Disengaged resistance: Long delay or idle/away action
  if (timeSinceSuggestion > 300000 || action.type === 'idle' || action.type === 'away') {
    // More than 5 minutes or idle/away
    return 'disengaged';
  }

  // Productive resistance: Learner took meaningful alternative action quickly
  if (timeSinceSuggestion < 60000 && action.type !== 'idle') {
    // Within 1 minute, took action (just not suggested one)
    return 'productive';
  }

  // Default to confused if uncertain
  return 'confused';
}

/**
 * Detect breakthrough from learner behavior
 *
 * Breakthrough occurs when learner achieves insight or success after struggle.
 * Indicators:
 * - Quiz success after multiple failures
 * - Sustained engagement after period of struggle
 * - Rapid progression after being stuck
 */
export function detectBreakthrough(options) {
  const {
    learnerId,
    triggerEvent,
    priorContext = {},
    currentContext = {},
  } = options;

  // Check for quiz breakthrough
  if (triggerEvent.type === 'quiz_complete') {
    const priorAttempts = priorContext.quizAttempts || [];
    const recentFailures = priorAttempts.filter(
      a => a.quizId === triggerEvent.quizId && !a.passed
    ).length;

    if (recentFailures >= 2 && triggerEvent.passed) {
      return {
        eventType: 'breakthrough',
        triggerEvent: JSON.stringify(triggerEvent),
        evidence: `Passed quiz after ${recentFailures} failed attempts`,
        recognitionAchieved: true,
        contextSnapshot: JSON.stringify({ priorContext, currentContext }),
      };
    }
  }

  // Check for engagement breakthrough
  if (triggerEvent.type === 'sustained_engagement') {
    const wasStuck = priorContext.stuck || priorContext.idle;
    const nowEngaged = currentContext.engaged;

    if (wasStuck && nowEngaged) {
      return {
        eventType: 'breakthrough',
        triggerEvent: JSON.stringify(triggerEvent),
        evidence: 'Sustained engagement after period of being stuck',
        recognitionAchieved: true,
        contextSnapshot: JSON.stringify({ priorContext, currentContext }),
      };
    }
  }

  // Check for comprehension breakthrough
  if (triggerEvent.type === 'rapid_progression') {
    const wasStruggling = priorContext.struggling;
    const nowProgressing = currentContext.progressing;

    if (wasStruggling && nowProgressing) {
      return {
        eventType: 'breakthrough',
        triggerEvent: JSON.stringify(triggerEvent),
        evidence: 'Rapid progression after prolonged struggle',
        recognitionAchieved: true,
        contextSnapshot: JSON.stringify({ priorContext, currentContext }),
      };
    }
  }

  return null; // No breakthrough detected
}

/**
 * Detect demand from learner behavior
 *
 * Demand occurs when learner explicitly or implicitly requests something.
 * Categories:
 * - Autonomy: Wants to explore independently
 * - Scaffolding: Needs more support/guidance
 * - Challenge: Wants harder content
 * - Validation: Seeks acknowledgment
 */
export function detectDemand(options) {
  const {
    learnerId,
    learnerAction,
    context = {},
    recentHistory = [],
  } = options;

  // Explicit demands (e.g., user clicks "need help" button)
  if (learnerAction.type === 'request_help') {
    return {
      eventType: 'demand',
      demandCategory: 'scaffolding',
      demandStrength: 0.9,
      contextSnapshot: JSON.stringify({ learnerAction, context }),
    };
  }

  if (learnerAction.type === 'request_challenge') {
    return {
      eventType: 'demand',
      demandCategory: 'challenge',
      demandStrength: 0.9,
      contextSnapshot: JSON.stringify({ learnerAction, context }),
    };
  }

  // Implicit demands from behavior patterns

  // Autonomy demand: Skipping suggested content, exploring freely
  if (context.skipsSuggestions && context.exploratoryBehavior) {
    return {
      eventType: 'demand',
      demandCategory: 'autonomy',
      demandStrength: 0.7,
      contextSnapshot: JSON.stringify({ context, recentHistory }),
    };
  }

  // Scaffolding demand: Multiple failures, seeking hints, returning to basics
  if (context.multipleFailures || context.seekingHints || context.returningToBasics) {
    const strength = Math.min(
      1.0,
      0.5 + (context.failureCount || 0) * 0.1 + (context.hintsRequested || 0) * 0.15
    );

    return {
      eventType: 'demand',
      demandCategory: 'scaffolding',
      demandStrength: strength,
      contextSnapshot: JSON.stringify({ context, recentHistory }),
    };
  }

  // Challenge demand: Rapid completion, perfect scores, skipping ahead
  if (context.rapidCompletion && context.perfectScores) {
    return {
      eventType: 'demand',
      demandCategory: 'challenge',
      demandStrength: 0.8,
      contextSnapshot: JSON.stringify({ context, recentHistory }),
    };
  }

  // Validation demand: Repeated checking of scores, seeking feedback
  if (context.checkingScores || context.seekingFeedback) {
    return {
      eventType: 'demand',
      demandCategory: 'validation',
      demandStrength: 0.6,
      contextSnapshot: JSON.stringify({ context, recentHistory }),
    };
  }

  return null; // No demand detected
}

/**
 * Record learner recognition event
 */
export function recordLearnerEvent(options) {
  const {
    learnerId,
    writingPadId,
    sessionId = null,
    eventType,
    tutorSuggestion = null,
    learnerResponse = null,
    resistanceInterpretation = null,
    triggerEvent = null,
    evidence = null,
    recognitionAchieved = null,
    demandCategory = null,
    demandStrength = null,
    contextSnapshot = null,
  } = options;

  const id = `learner-event-${Date.now()}-${randomBytes(4).toString('hex')}`;

  const stmt = getDb().prepare(`
    INSERT INTO learner_recognition_events (
      id, learner_id, writing_pad_id, session_id, event_type,
      tutor_suggestion, learner_response, resistance_interpretation,
      trigger_event, evidence, recognition_achieved,
      demand_category, demand_strength, context_snapshot
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    learnerId,
    writingPadId,
    sessionId,
    eventType,
    tutorSuggestion,
    learnerResponse,
    resistanceInterpretation,
    triggerEvent,
    evidence,
    recognitionAchieved ? 1 : 0,
    demandCategory,
    demandStrength,
    contextSnapshot
  );

  return getLearnerEvent(id);
}

/**
 * Get learner recognition event by ID
 */
export function getLearnerEvent(eventId) {
  const stmt = getDb().prepare('SELECT * FROM learner_recognition_events WHERE id = ?');
  const row = stmt.get(eventId);

  if (!row) return null;

  return {
    id: row.id,
    learnerId: row.learner_id,
    writingPadId: row.writing_pad_id,
    sessionId: row.session_id,
    createdAt: row.created_at,
    eventType: row.event_type,
    tutorSuggestion: row.tutor_suggestion,
    learnerResponse: row.learner_response,
    resistanceInterpretation: row.resistance_interpretation,
    triggerEvent: row.trigger_event,
    evidence: row.evidence,
    recognitionAchieved: row.recognition_achieved === 1,
    demandCategory: row.demand_category,
    demandStrength: row.demand_strength,
    contextSnapshot: row.context_snapshot,
  };
}

/**
 * Get learner events for a learner
 */
export function getLearnerEvents(learnerId, options = {}) {
  const {
    eventType = null,
    limit = 50,
    since = null, // timestamp
  } = options;

  let query = 'SELECT * FROM learner_recognition_events WHERE learner_id = ?';
  const params = [learnerId];

  if (eventType) {
    query += ' AND event_type = ?';
    params.push(eventType);
  }

  if (since) {
    query += ' AND created_at > ?';
    params.push(since);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const stmt = getDb().prepare(query);
  const rows = stmt.all(...params);

  return rows.map(row => ({
    id: row.id,
    learnerId: row.learner_id,
    writingPadId: row.writing_pad_id,
    sessionId: row.session_id,
    createdAt: row.created_at,
    eventType: row.event_type,
    tutorSuggestion: row.tutor_suggestion,
    learnerResponse: row.learner_response,
    resistanceInterpretation: row.resistance_interpretation,
    triggerEvent: row.trigger_event,
    evidence: row.evidence,
    recognitionAchieved: row.recognition_achieved === 1,
    demandCategory: row.demand_category,
    demandStrength: row.demand_strength,
    contextSnapshot: row.context_snapshot,
  }));
}

/**
 * Analyze learner events to identify patterns
 *
 * Returns insights about learner's:
 * - Resistance patterns
 * - Breakthrough patterns
 * - Demand patterns
 */
export function analyzeLearnerPatterns(learnerId) {
  const events = getLearnerEvents(learnerId, { limit: 100 });

  const resistanceEvents = events.filter(e => e.eventType === 'resistance');
  const breakthroughEvents = events.filter(e => e.eventType === 'breakthrough');
  const demandEvents = events.filter(e => e.eventType === 'demand');

  // Resistance patterns
  const resistanceByType = {
    productive: resistanceEvents.filter(e => e.resistanceInterpretation === 'productive').length,
    confused: resistanceEvents.filter(e => e.resistanceInterpretation === 'confused').length,
    disengaged: resistanceEvents.filter(e => e.resistanceInterpretation === 'disengaged').length,
  };

  const dominantResistanceType =
    Object.entries(resistanceByType).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';

  // Breakthrough patterns
  const breakthroughTriggers = breakthroughEvents
    .map(e => {
      try {
        return JSON.parse(e.triggerEvent);
      } catch {
        return null;
      }
    })
    .filter(t => t !== null);

  const breakthroughTypes = {};
  for (const trigger of breakthroughTriggers) {
    breakthroughTypes[trigger.type] = (breakthroughTypes[trigger.type] || 0) + 1;
  }

  // Demand patterns
  const demandByCategory = {
    autonomy: demandEvents.filter(e => e.demandCategory === 'autonomy').length,
    scaffolding: demandEvents.filter(e => e.demandCategory === 'scaffolding').length,
    challenge: demandEvents.filter(e => e.demandCategory === 'challenge').length,
    validation: demandEvents.filter(e => e.demandCategory === 'validation').length,
  };

  const dominantDemandCategory =
    Object.entries(demandByCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';

  return {
    totalEvents: events.length,
    resistanceEvents: resistanceEvents.length,
    breakthroughEvents: breakthroughEvents.length,
    demandEvents: demandEvents.length,
    resistancePatterns: {
      byType: resistanceByType,
      dominantType: dominantResistanceType,
      ratio:
        resistanceEvents.length > 0
          ? resistanceByType[dominantResistanceType] / resistanceEvents.length
          : 0,
    },
    breakthroughPatterns: {
      byType: breakthroughTypes,
      totalBreakthroughs: breakthroughEvents.length,
      breakthroughRate:
        events.length > 0 ? breakthroughEvents.length / events.length : 0,
    },
    demandPatterns: {
      byCategory: demandByCategory,
      dominantCategory: dominantDemandCategory,
      ratio:
        demandEvents.length > 0
          ? demandByCategory[dominantDemandCategory] / demandEvents.length
          : 0,
    },
  };
}

/**
 * Evolve learner archetype based on patterns
 *
 * Updates the unconscious layer of the Writing Pad with:
 * - Preferred learning style
 * - Common struggles
 * - Breakthrough patterns
 */
export function evolveLearnerArchetype(learnerId) {
  const patterns = analyzeLearnerPatterns(learnerId);
  const writingPad = writingPadService.getWritingPad(learnerId);

  if (!writingPad) {
    console.warn('[LearnerIntegration] No writing pad found for learner', learnerId);
    return null;
  }

  const currentArchetype = writingPad.unconscious.learnerArchetype || {
    preferredLearningStyle: null,
    commonStruggles: [],
    breakthroughPatterns: [],
  };

  // Infer preferred learning style from resistance and demand patterns
  let preferredStyle = currentArchetype.preferredLearningStyle;

  if (patterns.resistancePatterns.dominantType === 'productive') {
    preferredStyle = 'autonomous'; // Prefers independent exploration
  } else if (patterns.demandPatterns.dominantCategory === 'scaffolding') {
    preferredStyle = 'guided'; // Prefers structured guidance
  } else if (patterns.demandPatterns.dominantCategory === 'challenge') {
    preferredStyle = 'accelerated'; // Prefers challenging content
  }

  // Identify common struggles from resistance events
  const commonStruggles = [];

  if (patterns.resistancePatterns.byType.confused > 2) {
    commonStruggles.push('Confusion with abstract concepts');
  }

  if (patterns.resistancePatterns.byType.disengaged > 2) {
    commonStruggles.push('Disengagement when not immediately rewarded');
  }

  if (patterns.demandPatterns.byCategory.scaffolding > 3) {
    commonStruggles.push('Needs more scaffolding for complex tasks');
  }

  // Identify breakthrough patterns
  const breakthroughPatterns = [];

  if (patterns.breakthroughPatterns.byType.quiz_complete) {
    breakthroughPatterns.push('Achieves breakthroughs through repeated practice');
  }

  if (patterns.breakthroughPatterns.byType.sustained_engagement) {
    breakthroughPatterns.push('Benefits from sustained engagement periods');
  }

  if (patterns.breakthroughPatterns.byType.rapid_progression) {
    breakthroughPatterns.push('Experiences sudden comprehension after struggle');
  }

  // Update archetype
  const updatedArchetype = {
    preferredLearningStyle: preferredStyle,
    commonStruggles: [
      ...new Set([...currentArchetype.commonStruggles, ...commonStruggles]),
    ].slice(0, 5), // Keep max 5
    breakthroughPatterns: [
      ...new Set([...currentArchetype.breakthroughPatterns, ...breakthroughPatterns]),
    ].slice(0, 5), // Keep max 5
    lastUpdated: new Date().toISOString(),
    totalEvents: patterns.totalEvents,
  };

  // Update Writing Pad unconscious layer
  const updatedUnconscious = {
    ...writingPad.unconscious,
    learnerArchetype: updatedArchetype,
  };

  writingPadService.updateUnconscious(learnerId, updatedUnconscious);

  console.log(`[LearnerIntegration] Evolved archetype for learner ${learnerId}`);
  console.log(`  - Preferred style: ${preferredStyle}`);
  console.log(`  - Common struggles: ${commonStruggles.length}`);
  console.log(`  - Breakthrough patterns: ${breakthroughPatterns.length}`);

  return updatedArchetype;
}

/**
 * Get learner archetype summary
 */
export function getLearnerArchetype(learnerId) {
  const writingPad = writingPadService.getWritingPad(learnerId);

  if (!writingPad) {
    return null;
  }

  return writingPad.unconscious.learnerArchetype;
}

export default {
  detectResistance,
  detectBreakthrough,
  detectDemand,
  recordLearnerEvent,
  getLearnerEvent,
  getLearnerEvents,
  analyzeLearnerPatterns,
  evolveLearnerArchetype,
  getLearnerArchetype,
};
