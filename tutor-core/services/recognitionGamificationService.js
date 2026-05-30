/**
 * Recognition Gamification Service
 *
 * Pure computation service that reads from existing recognition tables
 * (writing_pads, recognition_moments, learner_recognition_events)
 * and returns gamification-relevant state.
 *
 * This service does NOT write to any tables — consumers do that.
 * Gamification primitives emerge from recognition theory rather than
 * running alongside it.
 *
 * Phase 5 of Recognition Engine (v0.4.0)
 */

import * as writingPadService from './writingPadService.js';
import { getDb } from './dbService.js';

// ============================================================================
// Recognition Milestone Definitions
// ============================================================================

const MILESTONE_DEFINITIONS = {
  first_negation: {
    key: 'first_negation',
    title: 'Encountering the Unknown',
    description: 'Experienced genuine existential encounter with unfamiliar territory',
  },
  productive_resistance: {
    key: 'productive_resistance',
    title: 'Finding Your Own Path',
    description: 'Your resistance to guidance proved productive — you found a valid alternative',
  },
  mutual_transformation: {
    key: 'mutual_transformation',
    title: 'Changing Together',
    description: 'Both you and the tutor were transformed by the encounter',
  },
  memory_consolidation: {
    key: 'memory_consolidation',
    title: 'Deep Understanding',
    description: 'An insight has settled into permanent understanding',
  },
  archetype_evolution: {
    key: 'archetype_evolution',
    title: 'Knowing Yourself as Learner',
    description: 'Your learning identity has evolved through accumulated experience',
  },
  dialectical_mastery: {
    key: 'dialectical_mastery',
    title: 'Sustained Dialectical Engagement',
    description: 'Maintained deep dialectical depth across multiple sessions',
  },
  metacognitive_awakening: {
    key: 'metacognitive_awakening',
    title: 'Thinking About Thinking',
    description: 'Developed sustained metacognitive awareness',
  },
  synthesis_achieved: {
    key: 'synthesis_achieved',
    title: 'Beyond Opposition',
    description: 'Achieved genuine dialectical synthesis — moved beyond simple agreement or disagreement',
  },
};

// ============================================================================
// Core API
// ============================================================================

/**
 * Compute recognition depth for a learner.
 *
 * Composite depth is NOT monotonically increasing — it can plateau or
 * temporarily decline as the learner enters new territory (Hegel's
 * negation of the negation).
 *
 * @param {string} learnerId
 * @returns {object} Recognition depth metrics
 */
export function computeRecognitionDepth(learnerId) {
  const pad = writingPadService.getWritingPad(learnerId);
  if (!pad) {
    return {
      dialecticalDepth: 0,
      mutualTransformation: 0,
      pedagogicalAttunement: 0.5,
      breakthroughDensity: 0,
      compositeDepth: 0,
      trend: 'none',
    };
  }

  const { dialecticalDepth, mutualTransformationScore, pedagogicalAttunement } = pad.metrics;

  // Compute breakthrough density from learner events
  const breakthroughEvents = getDb().prepare(
    `SELECT COUNT(*) as count FROM learner_recognition_events
     WHERE learner_id = ? AND event_type = 'breakthrough'`
  ).get(learnerId);

  const totalEvents = getDb().prepare(
    `SELECT COUNT(*) as count FROM learner_recognition_events
     WHERE learner_id = ?`
  ).get(learnerId);

  const breakthroughDensity = totalEvents.count > 0
    ? breakthroughEvents.count / totalEvents.count
    : 0;

  // Composite depth formula
  const compositeDepth =
    (dialecticalDepth * 0.3) +
    (mutualTransformationScore * 0.3) +
    (pedagogicalAttunement * 0.2) +
    (breakthroughDensity * 0.2);

  // Compute trend by comparing recent sessions vs older sessions
  const trend = computeDepthTrend(learnerId, pad.id);

  return {
    dialecticalDepth,
    mutualTransformation: mutualTransformationScore,
    pedagogicalAttunement,
    breakthroughDensity,
    compositeDepth,
    trend,
  };
}

/**
 * Compute depth trend from recent vs older recognition moments.
 * @param {string} learnerId
 * @param {string} writingPadId
 * @returns {'rising'|'falling'|'stable'|'none'}
 */
function computeDepthTrend(learnerId, writingPadId) {
  const recentMoments = getDb().prepare(
    `SELECT struggle_depth, mutual_acknowledgment, transformative
     FROM recognition_moments
     WHERE writing_pad_id = ?
     ORDER BY created_at DESC LIMIT 5`
  ).all(writingPadId);

  const olderMoments = getDb().prepare(
    `SELECT struggle_depth, mutual_acknowledgment, transformative
     FROM recognition_moments
     WHERE writing_pad_id = ?
     ORDER BY created_at DESC LIMIT 5 OFFSET 5`
  ).all(writingPadId);

  if (recentMoments.length < 2) return 'none';
  if (olderMoments.length < 2) return 'rising'; // Still early, assume rising

  const avgRecent = recentMoments.reduce((sum, m) => sum + (m.struggle_depth || 0), 0) / recentMoments.length;
  const avgOlder = olderMoments.reduce((sum, m) => sum + (m.struggle_depth || 0), 0) / olderMoments.length;

  const diff = avgRecent - avgOlder;
  if (diff > 0.1) return 'rising';
  if (diff < -0.1) return 'falling';
  return 'stable';
}

/**
 * Check which recognition milestones a learner has achieved.
 *
 * @param {string} learnerId
 * @returns {Array<object>} Milestone status objects
 */
export function checkRecognitionMilestones(learnerId) {
  const pad = writingPadService.getWritingPad(learnerId);
  if (!pad) {
    return Object.values(MILESTONE_DEFINITIONS).map(m => ({
      ...m,
      achieved: false,
      achievedAt: null,
      evidence: null,
    }));
  }

  const results = [];

  // first_negation: First recognition_type = 'existential' moment
  const firstExistential = getDb().prepare(
    `SELECT created_at FROM recognition_moments
     WHERE writing_pad_id = ? AND recognition_type = 'existential'
     ORDER BY created_at ASC LIMIT 1`
  ).get(pad.id);
  results.push({
    ...MILESTONE_DEFINITIONS.first_negation,
    achieved: !!firstExistential,
    achievedAt: firstExistential?.created_at || null,
    evidence: firstExistential ? 'First existential recognition moment' : null,
  });

  // productive_resistance: First resistance_interpretation = 'productive' event
  const firstProductive = getDb().prepare(
    `SELECT created_at FROM learner_recognition_events
     WHERE learner_id = ? AND resistance_interpretation = 'productive'
     ORDER BY created_at ASC LIMIT 1`
  ).get(learnerId);
  results.push({
    ...MILESTONE_DEFINITIONS.productive_resistance,
    achieved: !!firstProductive,
    achievedAt: firstProductive?.created_at || null,
    evidence: firstProductive ? 'First productive resistance event' : null,
  });

  // mutual_transformation: First mutual_acknowledgment = TRUE moment
  const firstMutual = getDb().prepare(
    `SELECT created_at FROM recognition_moments
     WHERE writing_pad_id = ? AND mutual_acknowledgment = 1
     ORDER BY created_at ASC LIMIT 1`
  ).get(pad.id);
  results.push({
    ...MILESTONE_DEFINITIONS.mutual_transformation,
    achieved: !!firstMutual,
    achievedAt: firstMutual?.created_at || null,
    evidence: firstMutual ? 'First mutually transformative moment' : null,
  });

  // memory_consolidation: First persistence_layer = 'unconscious' moment
  const firstUnconscious = getDb().prepare(
    `SELECT created_at, consolidated_at FROM recognition_moments
     WHERE writing_pad_id = ? AND persistence_layer = 'unconscious'
     ORDER BY consolidated_at ASC LIMIT 1`
  ).get(pad.id);
  results.push({
    ...MILESTONE_DEFINITIONS.memory_consolidation,
    achieved: !!firstUnconscious,
    achievedAt: firstUnconscious?.consolidated_at || firstUnconscious?.created_at || null,
    evidence: firstUnconscious ? 'First moment consolidated to permanent memory' : null,
  });

  // archetype_evolution: preferredLearningStyle is not null (has been set/changed)
  const archetype = pad.unconscious.learnerArchetype;
  const archetypeEvolved = archetype && archetype.preferredLearningStyle !== null;
  results.push({
    ...MILESTONE_DEFINITIONS.archetype_evolution,
    achieved: archetypeEvolved,
    achievedAt: archetype?.lastUpdated || null,
    evidence: archetypeEvolved
      ? `Learning style identified: ${archetype.preferredLearningStyle}`
      : null,
  });

  // dialectical_mastery: dialectical_depth > 0.7 across 5+ sessions
  const highDepthSessions = getDb().prepare(
    `SELECT COUNT(DISTINCT session_id) as count FROM recognition_moments
     WHERE writing_pad_id = ? AND session_id IS NOT NULL`
  ).get(pad.id);
  const dialecticalMastery = pad.metrics.dialecticalDepth > 0.7 && (highDepthSessions?.count || 0) >= 5;
  results.push({
    ...MILESTONE_DEFINITIONS.dialectical_mastery,
    achieved: dialecticalMastery,
    achievedAt: dialecticalMastery ? pad.updatedAt : null,
    evidence: dialecticalMastery
      ? `Dialectical depth ${pad.metrics.dialecticalDepth.toFixed(2)} across ${highDepthSessions.count} sessions`
      : null,
  });

  // metacognitive_awakening: 3+ recognition_type = 'metacognitive' moments
  const metacognitiveCount = getDb().prepare(
    `SELECT COUNT(*) as count FROM recognition_moments
     WHERE writing_pad_id = ? AND recognition_type = 'metacognitive'`
  ).get(pad.id);
  const metacognitiveAchieved = (metacognitiveCount?.count || 0) >= 3;
  results.push({
    ...MILESTONE_DEFINITIONS.metacognitive_awakening,
    achieved: metacognitiveAchieved,
    achievedAt: metacognitiveAchieved ? pad.updatedAt : null,
    evidence: metacognitiveAchieved
      ? `${metacognitiveCount.count} metacognitive recognition moments`
      : null,
  });

  // synthesis_achieved: First synthesis_strategy = 'dialectical_synthesis'
  const firstSynthesis = getDb().prepare(
    `SELECT created_at FROM recognition_moments
     WHERE writing_pad_id = ? AND synthesis_strategy = 'dialectical_synthesis'
     ORDER BY created_at ASC LIMIT 1`
  ).get(pad.id);
  results.push({
    ...MILESTONE_DEFINITIONS.synthesis_achieved,
    achieved: !!firstSynthesis,
    achievedAt: firstSynthesis?.created_at || null,
    evidence: firstSynthesis ? 'First dialectical synthesis achieved' : null,
  });

  return results;
}

/**
 * Get memory layer progression for a learner.
 *
 * Instead of linear levels, progression is movement between layers:
 * - Conscious = active working space (the writing desk)
 * - Preconscious = patterns crystallizing (the reading room)
 * - Unconscious = permanent traces inscribed (the deep archive)
 *
 * @param {string} learnerId
 * @returns {object} Memory layer progression data
 */
export function getMemoryLayerProgression(learnerId) {
  const pad = writingPadService.getWritingPad(learnerId);
  if (!pad) {
    return {
      conscious: { workingThoughts: 0, activity: 'none' },
      preconscious: { patterns: 0, avgConfidence: 0, recentPromotions: 0 },
      unconscious: { permanentTraces: 0, archetypeComplete: false, conflictsResolved: 0 },
      recentTransitions: [],
    };
  }

  // Conscious layer
  const consciousThoughts = pad.conscious.workingThoughts?.length || 0;
  const lastCleared = pad.conscious.lastCleared;
  const consciousActivity = consciousThoughts > 0 ? 'active' : 'cleared';

  // Preconscious layer
  const patterns = pad.preconscious.recentPatterns || [];
  const avgConfidence = patterns.length > 0
    ? patterns.reduce((sum, p) => sum + (p.confidence || 0), 0) / patterns.length
    : 0;

  // Count recent promotions (patterns observed in last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recentPromotions = patterns.filter(
    p => p.firstObserved && p.firstObserved >= sevenDaysAgo
  ).length;

  // Unconscious layer
  const permanentTraces = pad.unconscious.permanentTraces?.length || 0;
  const archetype = pad.unconscious.learnerArchetype;
  const archetypeComplete = archetype &&
    archetype.preferredLearningStyle !== null &&
    (archetype.commonStruggles?.length || 0) > 0 &&
    (archetype.breakthroughPatterns?.length || 0) > 0;
  const conflictsResolved = (pad.unconscious.conflictPatterns || [])
    .filter(c => c.resolved).length;

  // Recent layer transitions from recognition moments
  const recentTransitions = getRecentTransitions(pad.id);

  return {
    conscious: {
      workingThoughts: consciousThoughts,
      activity: consciousActivity,
      lastCleared,
    },
    preconscious: {
      patterns: patterns.length,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      recentPromotions,
    },
    unconscious: {
      permanentTraces,
      archetypeComplete: !!archetypeComplete,
      conflictsResolved,
    },
    recentTransitions,
  };
}

/**
 * Get recent layer transitions from recognition moments.
 * @param {string} writingPadId
 * @returns {Array<object>}
 */
function getRecentTransitions(writingPadId) {
  // Find moments that have been consolidated (transitioned to unconscious)
  const consolidated = getDb().prepare(
    `SELECT id, created_at, consolidated_at, persistence_layer, synthesis_resolution
     FROM recognition_moments
     WHERE writing_pad_id = ? AND consolidated_at IS NOT NULL
     ORDER BY consolidated_at DESC LIMIT 10`
  ).all(writingPadId);

  return consolidated.map(m => ({
    momentId: m.id,
    from: 'preconscious',
    to: 'unconscious',
    timestamp: m.consolidated_at,
    description: m.synthesis_resolution
      ? `Insight consolidated: "${truncate(m.synthesis_resolution, 60)}"`
      : 'Recognition moment settled into permanent memory',
  }));
}

/**
 * Compute recognition flow for a session.
 *
 * Flow in the recognition context is not about typing speed but about
 * the quality of dialectical engagement within a session.
 *
 * @param {string} learnerId
 * @param {string} [sessionId] - Optional; uses most recent session if not provided
 * @returns {object} Recognition flow metrics
 */
export function computeRecognitionFlow(learnerId, sessionId) {
  const pad = writingPadService.getWritingPad(learnerId);
  if (!pad) {
    return {
      flowScore: 0,
      struggleDepthInRange: false,
      synthesisBalance: 0,
      resistanceProductivity: 0,
      flowState: 'none',
    };
  }

  // Get session moments
  let query = `SELECT * FROM recognition_moments WHERE writing_pad_id = ?`;
  const params = [pad.id];

  if (sessionId) {
    query += ' AND session_id = ?';
    params.push(sessionId);
  } else {
    // Get the most recent session
    const latestSession = getDb().prepare(
      `SELECT session_id FROM recognition_moments
       WHERE writing_pad_id = ? AND session_id IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`
    ).get(pad.id);

    if (latestSession) {
      query += ' AND session_id = ?';
      params.push(latestSession.session_id);
    }
  }

  query += ' ORDER BY created_at ASC';
  const moments = getDb().prepare(query).all(...params);

  if (moments.length === 0) {
    return {
      flowScore: 0,
      struggleDepthInRange: false,
      synthesisBalance: 0,
      resistanceProductivity: 0,
      flowState: 'none',
    };
  }

  // Struggle depth in ideal range (0.3-0.7 is productive)
  const avgStruggleDepth = moments.reduce((sum, m) => sum + (m.struggle_depth || 0), 0) / moments.length;
  const struggleDepthInRange = avgStruggleDepth >= 0.3 && avgStruggleDepth <= 0.7;

  // Synthesis balance: ratio of dialectical syntheses to total strategies
  const synthesisMoments = moments.filter(m => m.synthesis_strategy === 'dialectical_synthesis').length;
  const synthesisBalance = moments.length > 0 ? synthesisMoments / moments.length : 0;

  // Resistance productivity from session events
  const sessionEvents = getDb().prepare(
    `SELECT * FROM learner_recognition_events
     WHERE learner_id = ? AND event_type = 'resistance'
     ${sessionId ? 'AND session_id = ?' : ''}
     ORDER BY created_at DESC LIMIT 20`
  ).all(sessionId ? [learnerId, sessionId] : [learnerId]);

  const productiveResistance = sessionEvents.filter(
    e => e.resistance_interpretation === 'productive'
  ).length;
  const resistanceProductivity = sessionEvents.length > 0
    ? productiveResistance / sessionEvents.length
    : 0;

  // Composite flow score
  const flowScore =
    (struggleDepthInRange ? 0.3 : avgStruggleDepth * 0.15) +
    (synthesisBalance * 0.3) +
    (resistanceProductivity * 0.2) +
    (Math.min(moments.length / 5, 1) * 0.2); // Engagement density

  // Flow state determination
  let flowState;
  if (flowScore >= 0.7) flowState = 'deepening';
  else if (flowScore >= 0.4) flowState = 'emerging';
  else if (flowScore >= 0.2) flowState = 'plateauing';
  else flowState = 'disrupted';

  return {
    flowScore: Math.round(flowScore * 100) / 100,
    struggleDepthInRange,
    avgStruggleDepth: Math.round(avgStruggleDepth * 100) / 100,
    synthesisBalance: Math.round(synthesisBalance * 100) / 100,
    resistanceProductivity: Math.round(resistanceProductivity * 100) / 100,
    flowState,
    momentCount: moments.length,
  };
}

/**
 * Get dialectical continuity for a learner.
 *
 * Continuity is about sessions with meaningful recognition, not just
 * "days active". A session counts if it produced at least one recognition
 * moment.
 *
 * @param {string} learnerId
 * @returns {object} Dialectical continuity metrics
 */
export function getDialecticalContinuity(learnerId) {
  const pad = writingPadService.getWritingPad(learnerId);
  if (!pad) {
    return {
      sessionsWithRecognition: 0,
      sessionsWithout: 0,
      currentContinuity: 0,
      longestContinuity: 0,
      trend: 'none',
    };
  }

  // Get all sessions and whether they had recognition moments
  const sessions = getDb().prepare(
    `SELECT session_id, COUNT(*) as moment_count, MIN(created_at) as first_moment
     FROM recognition_moments
     WHERE writing_pad_id = ? AND session_id IS NOT NULL
     GROUP BY session_id
     ORDER BY first_moment ASC`
  ).all(pad.id);

  const sessionsWithRecognition = sessions.length;

  // For sessionsWithout, we need total sessions. Estimate from events.
  const allSessionIds = getDb().prepare(
    `SELECT DISTINCT session_id FROM learner_recognition_events
     WHERE learner_id = ? AND session_id IS NOT NULL
     UNION
     SELECT DISTINCT session_id FROM recognition_moments
     WHERE writing_pad_id = ? AND session_id IS NOT NULL`
  ).all(learnerId, pad.id);

  const totalSessions = allSessionIds.length;
  const sessionsWithout = totalSessions - sessionsWithRecognition;

  // Compute continuity streaks
  // Look at sessions ordered by time and check for consecutive recognition sessions
  const sessionHasRecognition = new Set(sessions.map(s => s.session_id));
  const orderedSessions = allSessionIds
    .map(s => s.session_id)
    .filter(Boolean);

  let currentContinuity = 0;
  let longestContinuity = 0;
  let tempContinuity = 0;

  for (const sid of orderedSessions) {
    if (sessionHasRecognition.has(sid)) {
      tempContinuity++;
      if (tempContinuity > longestContinuity) {
        longestContinuity = tempContinuity;
      }
    } else {
      tempContinuity = 0;
    }
  }
  currentContinuity = tempContinuity;

  // Trend based on recent vs older session recognition density
  let trend = 'none';
  if (sessions.length >= 4) {
    const half = Math.floor(sessions.length / 2);
    const recentDensity = sessions.slice(half).reduce((s, m) => s + m.moment_count, 0) / (sessions.length - half);
    const olderDensity = sessions.slice(0, half).reduce((s, m) => s + m.moment_count, 0) / half;
    if (recentDensity > olderDensity * 1.2) trend = 'rising';
    else if (recentDensity < olderDensity * 0.8) trend = 'falling';
    else trend = 'stable';
  }

  return {
    sessionsWithRecognition,
    sessionsWithout,
    currentContinuity,
    longestContinuity,
    trend,
  };
}

/**
 * Get comprehensive learner recognition profile.
 *
 * Aggregates all recognition gamification data into a single profile.
 *
 * @param {string} learnerId
 * @returns {object} Complete recognition profile
 */
export function getLearnerRecognitionProfile(learnerId) {
  const depth = computeRecognitionDepth(learnerId);
  const milestones = checkRecognitionMilestones(learnerId);
  const progression = getMemoryLayerProgression(learnerId);
  const continuity = getDialecticalContinuity(learnerId);

  // Determine archetype description
  const pad = writingPadService.getWritingPad(learnerId);
  let archetypeDescription = null;
  if (pad) {
    const archetype = pad.unconscious.learnerArchetype;
    if (archetype && archetype.preferredLearningStyle) {
      const styleDescriptions = {
        autonomous: 'Independent explorer who charts their own path through understanding',
        guided: 'Careful learner who builds understanding through structured guidance',
        accelerated: 'Driven learner who seeks challenge and rapid deepening',
      };
      archetypeDescription = styleDescriptions[archetype.preferredLearningStyle]
        || `Learner with ${archetype.preferredLearningStyle} orientation`;
    }
  }

  // Achieved milestone count
  const achievedCount = milestones.filter(m => m.achieved).length;
  const totalMilestones = milestones.length;

  return {
    learnerId,
    depth,
    milestones,
    progression,
    continuity,
    archetypeDescription,
    summary: {
      achievedMilestones: achievedCount,
      totalMilestones,
      compositeDepth: depth.compositeDepth,
      depthTrend: depth.trend,
      permanentTraces: progression.unconscious.permanentTraces,
      currentContinuity: continuity.currentContinuity,
    },
  };
}

/**
 * Get milestone definitions (for UI display)
 * @returns {object} Milestone definitions keyed by milestone key
 */
export function getMilestoneDefinitions() {
  return { ...MILESTONE_DEFINITIONS };
}

// ============================================================================
// Utilities
// ============================================================================

function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

// ============================================================================
// Exports
// ============================================================================

export default {
  computeRecognitionDepth,
  checkRecognitionMilestones,
  getMemoryLayerProgression,
  computeRecognitionFlow,
  getDialecticalContinuity,
  getLearnerRecognitionProfile,
  getMilestoneDefinitions,
  MILESTONE_DEFINITIONS,
};
