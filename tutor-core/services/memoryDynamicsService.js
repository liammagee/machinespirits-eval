/**
 * Memory Dynamics Service
 *
 * Phase 4 of Recognition Engine: Automates memory transitions between layers
 *
 * This service orchestrates the natural flow of memory through Freud's three-layer system:
 * - Conscious → Preconscious (pattern promotion)
 * - Preconscious → Unconscious (consolidation)
 * - Preconscious decay (forgetting)
 * - Unconscious querying (context retrieval)
 *
 * Unlike Phase 1 which created the infrastructure, Phase 4 makes it actively work.
 */

import * as writingPadService from './writingPadService.js';

// ============================================================================
// Pattern Detection (Conscious → Preconscious)
// ============================================================================

/**
 * Detect patterns from conscious working memory
 *
 * Analyzes ephemeral thoughts to identify recurring patterns worthy of promotion
 */
export function detectPatternsFromConscious(learnerId) {
  const pad = writingPadService.getWritingPad(learnerId);
  if (!pad) return [];

  const thoughts = pad.conscious.workingThoughts || [];
  const notes = pad.conscious.ephemeralNotes || {};

  const patterns = [];

  // Pattern 1: Repeated suggestion types
  const suggestionTypes = thoughts
    .filter(t => t.type === 'suggestion')
    .map(t => t.suggestionType);

  if (suggestionTypes.length > 0) {
    const typeCounts = {};
    suggestionTypes.forEach(type => {
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    // If any type appears >1 time in conscious, it's a pattern
    Object.entries(typeCounts).forEach(([type, count]) => {
      if (count > 1) {
        patterns.push({
          type: 'suggestion_preference',
          signature: `suggest_${type}`,
          observation: `Tutor repeatedly suggests ${type} (${count} times)`,
          confidence: Math.min(0.5 + count * 0.1, 0.9),
        });
      }
    });
  }

  // Pattern 2: Resistance patterns (from notes)
  if (notes.resistanceDetected) {
    patterns.push({
      type: 'resistance_pattern',
      signature: `resistance_${notes.resistanceType}`,
      observation: `Learner shows ${notes.resistanceType} resistance`,
      confidence: 0.6,
    });
  }

  // Pattern 3: Breakthrough patterns (from notes)
  if (notes.breakthroughDetected) {
    patterns.push({
      type: 'breakthrough_pattern',
      signature: `breakthrough_${notes.breakthroughType}`,
      observation: `Learner achieves breakthroughs through ${notes.breakthroughType}`,
      confidence: 0.7,
    });
  }

  // Pattern 4: Demand patterns (from notes)
  if (notes.demandDetected) {
    patterns.push({
      type: 'demand_pattern',
      signature: `demand_${notes.demandCategory}`,
      observation: `Learner demands ${notes.demandCategory}`,
      confidence: 0.6,
    });
  }

  return patterns;
}

/**
 * Automatically promote detected patterns to preconscious
 *
 * Called after each dialogue turn
 */
export function autoPromotePatterns(learnerId) {
  const patterns = detectPatternsFromConscious(learnerId);

  if (patterns.length === 0) {
    return { promoted: 0, patterns: [] };
  }

  const promoted = [];
  for (const pattern of patterns) {
    try {
      writingPadService.promoteToPreconscious(learnerId, pattern);
      promoted.push(pattern);
    } catch (error) {
      console.error(`[MemoryDynamics] Failed to promote pattern:`, error.message);
    }
  }

  console.log(`[MemoryDynamics] Auto-promoted ${promoted.length} pattern(s) for learner ${learnerId}`);

  return {
    promoted: promoted.length,
    patterns: promoted,
  };
}

// ============================================================================
// Consolidation (Preconscious → Unconscious)
// ============================================================================

/**
 * Check if recognition moment should be consolidated to unconscious
 *
 * Criteria:
 * - Transformative (mutual_acknowledgment = true OR struggle_depth > 0.6)
 * - Age > consolidation threshold (default 7 days)
 * - Currently in conscious or preconscious layer
 */
export function shouldConsolidateToUnconscious(recognitionMoment, options = {}) {
  const {
    minAge = 7 * 24 * 60 * 60 * 1000, // 7 days
    requireTransformative = true,
  } = options;

  // Already in unconscious
  if (recognitionMoment.persistence_layer === 'unconscious') {
    return false;
  }

  // Check transformative condition
  if (requireTransformative) {
    const isTransformative =
      recognitionMoment.mutual_acknowledgment ||
      (recognitionMoment.struggle_depth || 0) > 0.6;

    if (!isTransformative) {
      return false;
    }
  }

  // Check age
  const age = Date.now() - new Date(recognitionMoment.created_at).getTime();
  if (age < minAge) {
    return false;
  }

  return true;
}

/**
 * Automatically consolidate recognition moments to unconscious
 *
 * Should be called periodically (e.g., daily background task)
 */
export function autoConsolidateToUnconscious(learnerId, options = {}) {
  const pad = writingPadService.getWritingPad(learnerId);
  if (!pad) {
    return { consolidated: 0, moments: [] };
  }

  // Get all recognition moments for this learner
  const allMoments = writingPadService.getRecognitionMoments(pad.id, {
    limit: 500, // Check up to 500 moments
  });

  const consolidated = [];

  for (const moment of allMoments) {
    if (shouldConsolidateToUnconscious(moment, options)) {
      try {
        writingPadService.settleToUnconscious(learnerId, moment);
        consolidated.push(moment.id);
      } catch (error) {
        console.error(`[MemoryDynamics] Failed to consolidate moment ${moment.id}:`, error.message);
      }
    }
  }

  if (consolidated.length > 0) {
    console.log(`[MemoryDynamics] Auto-consolidated ${consolidated.length} moment(s) to unconscious for learner ${learnerId}`);
  }

  return {
    consolidated: consolidated.length,
    moments: consolidated,
  };
}

// ============================================================================
// Forgetting (Preconscious Decay)
// ============================================================================

/**
 * Automatically forget stale patterns from preconscious
 *
 * Should be called periodically (e.g., daily background task)
 */
export function autoForgetStalePatterns(learnerId) {
  const padBefore = writingPadService.getWritingPad(learnerId);
  if (!padBefore) {
    return { forgotten: 0 };
  }

  const patternsBefore = padBefore.preconscious.recentPatterns.length;

  writingPadService.forgetStalePatterns(learnerId);

  const padAfter = writingPadService.getWritingPad(learnerId);
  const patternsAfter = padAfter.preconscious.recentPatterns.length;
  const forgotten = patternsBefore - patternsAfter;

  if (forgotten > 0) {
    console.log(`[MemoryDynamics] Auto-forgot ${forgotten} stale pattern(s) for learner ${learnerId}`);
  }

  return { forgotten };
}

// ============================================================================
// Context Retrieval (Unconscious Querying)
// ============================================================================

/**
 * Retrieve context from unconscious for suggestion generation
 *
 * Queries unconscious layer based on current situation
 */
export function retrieveUnconsciousContext(learnerId, situationContext = {}) {
  const {
    learnerStruggling = false,
    recentBreakthrough = false,
    demandType = null,
  } = situationContext;

  const queryParams = {
    limit: 5,
  };

  // If learner struggling, look for similar past struggles
  if (learnerStruggling) {
    queryParams.recognitionType = 'existential'; // Unresolved conflicts
    queryParams.minStruggleDepth = 0.5;
  }

  // If recent breakthrough, look for similar breakthrough patterns
  if (recentBreakthrough) {
    queryParams.recognitionType = 'metacognitive'; // Transformative moments
    queryParams.minStruggleDepth = 0.6;
  }

  const traces = writingPadService.queryUnconscious(learnerId, queryParams);

  // Extract insights from traces
  const insights = traces.map(trace => ({
    timestamp: trace.timestamp,
    synthesis: trace.synthesis,
    transformations: trace.transformations,
    struggleDepth: trace.struggleDepth,
  }));

  return {
    relevantTraces: traces.length,
    insights,
  };
}

// ============================================================================
// Integrated Memory Cycle
// ============================================================================

/**
 * Complete memory dynamics cycle after a dialogue turn
 *
 * This is the main integration point called from tutorDialogueEngine
 */
export function runMemoryCycle(learnerId, context = {}) {
  if (!learnerId) {
    return null; // No learner ID, skip memory dynamics
  }

  // Ensure writing pad exists before running memory operations
  writingPadService.getOrInitializeWritingPad(learnerId);

  const results = {
    learnerId,
    timestamp: new Date().toISOString(),
    operations: {},
  };

  try {
    // 1. Detect and promote patterns from conscious to preconscious
    const promotionResult = autoPromotePatterns(learnerId);
    results.operations.promotion = promotionResult;

    // 2. Query unconscious for relevant context (if needed)
    if (context.retrieveContext) {
      const contextResult = retrieveUnconsciousContext(learnerId, context.situationContext || {});
      results.operations.contextRetrieval = contextResult;
    }

    // 3. Clear conscious layer (prepare for next turn)
    writingPadService.clearConscious(learnerId);
    results.operations.consciousCleared = true;

    return results;
  } catch (error) {
    console.error(`[MemoryDynamics] Memory cycle failed for learner ${learnerId}:`, error.message);
    return null;
  }
}

/**
 * Background maintenance tasks (should be run periodically)
 *
 * Handles consolidation and forgetting for all learners
 */
export function runBackgroundMaintenance(learnerId, options = {}) {
  if (!learnerId) {
    throw new Error('learnerId is required for background maintenance');
  }

  const results = {
    learnerId,
    timestamp: new Date().toISOString(),
    tasks: {},
  };

  try {
    // 1. Consolidate old transformative moments to unconscious
    const consolidationResult = autoConsolidateToUnconscious(learnerId, options.consolidation || {});
    results.tasks.consolidation = consolidationResult;

    // 2. Forget stale patterns from preconscious
    const forgettingResult = autoForgetStalePatterns(learnerId);
    results.tasks.forgetting = forgettingResult;

    console.log(`[MemoryDynamics] Background maintenance complete for learner ${learnerId}`);

    return results;
  } catch (error) {
    console.error(`[MemoryDynamics] Background maintenance failed for learner ${learnerId}:`, error.message);
    throw error;
  }
}

// ============================================================================
// Memory State Analysis
// ============================================================================

/**
 * Get comprehensive memory state for a learner
 */
export function getMemoryState(learnerId) {
  const pad = writingPadService.getWritingPad(learnerId);
  if (!pad) {
    return null;
  }

  return {
    learnerId,
    writingPadId: pad.id,
    layers: {
      conscious: {
        workingThoughts: pad.conscious.workingThoughts?.length || 0,
        ephemeralNotes: Object.keys(pad.conscious.ephemeralNotes || {}).length,
        lastCleared: pad.conscious.lastCleared,
      },
      preconscious: {
        recentPatterns: pad.preconscious.recentPatterns?.length || 0,
        provisionalRules: pad.preconscious.provisionalRules?.length || 0,
        fadeThreshold: pad.preconscious.fadeThreshold,
      },
      unconscious: {
        permanentTraces: pad.unconscious.permanentTraces?.length || 0,
        hasLearnerArchetype: !!pad.unconscious.learnerArchetype,
        conflictPatterns: pad.unconscious.conflictPatterns?.length || 0,
        superegoTraces: pad.unconscious.superegoTraces?.length || 0,
      },
    },
    metrics: {
      totalRecognitionMoments: pad.totalRecognitionMoments,
      dialecticalDepth: pad.dialecticalDepth,
      mutualTransformationScore: pad.mutualTransformationScore,
      pedagogicalAttunement: pad.pedagogicalAttunement,
    },
    lastUpdated: pad.updatedAt,
  };
}
