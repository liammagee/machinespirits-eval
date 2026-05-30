/**
 * Recognition Pipeline Orchestrator
 *
 * Chains the 5 phases of the Recognition Engine into connected cycles:
 *
 * Phase 1 (WritingPad) → Phase 2 (DialecticalEngine) → Phase 3 (LearnerIntegration)
 *    → Phase 4 (MemoryDynamics) → Phase 5 (RecognitionGamification)
 *
 * Entry points:
 * - processDialogueResult()  — After tutor dialogue completes
 * - processWritingEvent()    — For non-dialogue events (writing, flow changes)
 * - runMaintenance()         — Periodic background tasks
 * - getFullRecognitionState() — Read complete state from all phases
 */

import * as writingPadService from './writingPadService.js';
import * as learnerIntegrationService from './learnerIntegrationService.js';
import * as memoryDynamicsService from './memoryDynamicsService.js';
import * as recognitionGamificationService from './recognitionGamificationService.js';

// ============================================================================
// processDialogueResult
// ============================================================================

/**
 * Process the result of a tutor dialogue through the full recognition pipeline.
 *
 * Called after each Ego/Superego dialogue completes. Chains:
 * 1. Records dialogue output as conscious working thought (Phase 1)
 * 2. If dialogue had ego/superego conflict, the recognition moment was already
 *    created by dialecticalEngine.negotiateDialectically() (Phase 2)
 * 3. Classifies learner response via Phase 3 detection
 * 4. Records learner events (Phase 3)
 * 5. Runs memory cycle (Phase 4)
 * 6. Returns enriched recognition state (Phase 5)
 *
 * @param {string} learnerId - Learner identifier
 * @param {object} dialogueResult - Result from tutorDialogueEngine.runDialogue()
 * @param {object} [learnerResponse] - How the learner responded to the suggestion
 * @param {object} [options] - Additional options
 * @returns {object} Pipeline result with recognition state
 */
export function processDialogueResult(learnerId, dialogueResult, learnerResponse = null, options = {}) {
  const { sessionId = null } = options;
  const results = {
    learnerId,
    timestamp: new Date().toISOString(),
    phases: {},
  };

  try {
    // Ensure writing pad exists
    const pad = writingPadService.getOrInitializeWritingPad(learnerId);

    // Phase 1: Record dialogue as conscious working thought
    const thought = {
      type: 'suggestion',
      suggestionType: dialogueResult.type || 'dialogue',
      content: dialogueResult.suggestion || dialogueResult.message || '',
      profile: dialogueResult.profileName || dialogueResult.profile || null,
      converged: dialogueResult.converged ?? null,
      rounds: dialogueResult.rounds || 0,
      timestamp: new Date().toISOString(),
    };

    const currentConscious = pad.conscious;
    writingPadService.updateConscious(learnerId, {
      workingThoughts: [...(currentConscious.workingThoughts || []), thought],
      ephemeralNotes: {
        ...(currentConscious.ephemeralNotes || {}),
        lastDialogue: {
          profile: thought.profile,
          converged: thought.converged,
          rounds: thought.rounds,
        },
      },
    });
    results.phases.conscious = { recorded: true };

    // Phase 2: Recognition moment was already created by dialecticalEngine
    // if the dialogue involved ego/superego negotiation. We just note it here.
    if (dialogueResult.dialogueTrace || dialogueResult.recognitionMoment) {
      results.phases.dialectical = {
        hadNegotiation: true,
        momentId: dialogueResult.recognitionMoment?.id || null,
      };
    } else {
      results.phases.dialectical = { hadNegotiation: false };
    }

    // Phase 3: Classify learner response
    const phase3Results = { events: [] };

    if (learnerResponse) {
      // Resistance detection
      const resistance = learnerIntegrationService.detectResistance({
        learnerId,
        tutorSuggestion: dialogueResult,
        learnerAction: learnerResponse,
        timeSinceSuggestion: learnerResponse.timeSinceSuggestion || 0,
        context: learnerResponse.context || {},
      });

      if (resistance) {
        const event = learnerIntegrationService.recordLearnerEvent({
          learnerId,
          writingPadId: pad.id,
          sessionId,
          eventType: 'resistance',
          tutorSuggestion: resistance.tutorSuggestion,
          learnerResponse: resistance.learnerResponse,
          resistanceInterpretation: resistance.resistanceInterpretation,
          contextSnapshot: resistance.contextSnapshot,
        });
        phase3Results.events.push(event);

        // Note resistance in conscious layer for pattern detection
        writingPadService.updateConscious(learnerId, {
          ephemeralNotes: {
            ...(writingPadService.getWritingPad(learnerId)?.conscious?.ephemeralNotes || {}),
            resistanceDetected: true,
            resistanceType: resistance.resistanceInterpretation,
          },
        });
      }

      // Breakthrough detection
      const breakthrough = learnerIntegrationService.detectBreakthrough({
        learnerId,
        triggerEvent: learnerResponse,
        priorContext: learnerResponse.priorContext || {},
        currentContext: learnerResponse.currentContext || {},
      });

      if (breakthrough) {
        const event = learnerIntegrationService.recordLearnerEvent({
          learnerId,
          writingPadId: pad.id,
          sessionId,
          eventType: 'breakthrough',
          triggerEvent: breakthrough.triggerEvent,
          evidence: breakthrough.evidence,
          recognitionAchieved: breakthrough.recognitionAchieved,
          contextSnapshot: breakthrough.contextSnapshot,
        });
        phase3Results.events.push(event);

        // Note breakthrough in conscious layer
        writingPadService.updateConscious(learnerId, {
          ephemeralNotes: {
            ...(writingPadService.getWritingPad(learnerId)?.conscious?.ephemeralNotes || {}),
            breakthroughDetected: true,
            breakthroughType: learnerResponse.type || 'unknown',
          },
        });
      }

      // Demand detection
      const demand = learnerIntegrationService.detectDemand({
        learnerId,
        learnerAction: learnerResponse,
        context: learnerResponse.context || {},
        recentHistory: learnerResponse.recentHistory || [],
      });

      if (demand) {
        const event = learnerIntegrationService.recordLearnerEvent({
          learnerId,
          writingPadId: pad.id,
          sessionId,
          eventType: 'demand',
          demandCategory: demand.demandCategory,
          demandStrength: demand.demandStrength,
          contextSnapshot: demand.contextSnapshot,
        });
        phase3Results.events.push(event);

        // Note demand in conscious layer
        writingPadService.updateConscious(learnerId, {
          ephemeralNotes: {
            ...(writingPadService.getWritingPad(learnerId)?.conscious?.ephemeralNotes || {}),
            demandDetected: true,
            demandCategory: demand.demandCategory,
          },
        });
      }
    }

    results.phases.learnerIntegration = phase3Results;

    // Phase 4: Run memory cycle (pattern promotion + conscious clear)
    const memoryCycleResult = memoryDynamicsService.runMemoryCycle(learnerId, {
      retrieveContext: true,
      situationContext: {
        learnerStruggling: learnerResponse?.context?.struggling || false,
        recentBreakthrough: phase3Results.events.some(e => e?.eventType === 'breakthrough'),
      },
    });
    results.phases.memoryDynamics = memoryCycleResult;

    // Phase 5: Get updated recognition state
    const recognitionProfile = recognitionGamificationService.getLearnerRecognitionProfile(learnerId);
    results.phases.gamification = {
      compositeDepth: recognitionProfile.depth.compositeDepth,
      trend: recognitionProfile.depth.trend,
      achievedMilestones: recognitionProfile.summary.achievedMilestones,
    };

    results.recognitionState = recognitionProfile;

    return results;
  } catch (error) {
    console.error(`[RecognitionOrchestrator] processDialogueResult failed for ${learnerId}:`, error.message);
    return {
      ...results,
      error: error.message,
    };
  }
}

// ============================================================================
// processWritingEvent
// ============================================================================

/**
 * Process a non-dialogue event through the recognition pipeline.
 *
 * Called for writing events, flow changes, feedback responses, etc.
 *
 * @param {string} learnerId - Learner identifier
 * @param {object} event - The event to process
 * @param {object} [options] - Additional options
 * @returns {object} Pipeline result with recognition state
 */
export function processWritingEvent(learnerId, event, options = {}) {
  const { sessionId = null } = options;
  const results = {
    learnerId,
    timestamp: new Date().toISOString(),
    phases: {},
  };

  try {
    // Ensure writing pad exists
    const pad = writingPadService.getOrInitializeWritingPad(learnerId);

    // Phase 1: Record event as conscious working thought
    const thought = {
      type: event.type || 'event',
      data: event.data || {},
      timestamp: new Date().toISOString(),
    };

    const currentConscious = writingPadService.getWritingPad(learnerId)?.conscious || {};
    writingPadService.updateConscious(learnerId, {
      workingThoughts: [...(currentConscious.workingThoughts || []), thought],
    });
    results.phases.conscious = { recorded: true };

    // Phase 3: Detect patterns from event
    const phase3Results = { events: [] };

    if (event.type === 'analysis_complete' && event.data) {
      // Analysis events may indicate resistance or breakthrough
      if (event.data.isBreakthrough) {
        const breakEvent = learnerIntegrationService.recordLearnerEvent({
          learnerId,
          writingPadId: pad.id,
          sessionId,
          eventType: 'breakthrough',
          triggerEvent: JSON.stringify(event),
          evidence: event.data.evidence || 'Analysis-detected breakthrough',
          recognitionAchieved: true,
        });
        phase3Results.events.push(breakEvent);
      }
    }

    if (event.type === 'feedback_response' && event.data) {
      // Feedback responses may indicate demand
      if (event.data.action === 'saved_to_chat') {
        const demandEvent = learnerIntegrationService.recordLearnerEvent({
          learnerId,
          writingPadId: pad.id,
          sessionId,
          eventType: 'demand',
          demandCategory: 'validation',
          demandStrength: 0.5,
          contextSnapshot: JSON.stringify(event.data),
        });
        phase3Results.events.push(demandEvent);
      }
    }

    if (event.type === 'flow_change' && event.data) {
      // Flow state changes go into conscious notes for pattern detection
      writingPadService.updateConscious(learnerId, {
        ephemeralNotes: {
          ...(writingPadService.getWritingPad(learnerId)?.conscious?.ephemeralNotes || {}),
          flowState: event.data.state,
          flowScore: event.data.score,
        },
      });
    }

    results.phases.learnerIntegration = phase3Results;

    // Phase 4: Run memory cycle
    const memoryCycleResult = memoryDynamicsService.runMemoryCycle(learnerId, {
      retrieveContext: false,
    });
    results.phases.memoryDynamics = memoryCycleResult;

    // Phase 5: Get updated recognition state
    const recognitionProfile = recognitionGamificationService.getLearnerRecognitionProfile(learnerId);
    results.phases.gamification = {
      compositeDepth: recognitionProfile.depth.compositeDepth,
      trend: recognitionProfile.depth.trend,
    };

    results.recognitionState = recognitionProfile;

    return results;
  } catch (error) {
    console.error(`[RecognitionOrchestrator] processWritingEvent failed for ${learnerId}:`, error.message);
    return {
      ...results,
      error: error.message,
    };
  }
}

// ============================================================================
// runMaintenance
// ============================================================================

/**
 * Run periodic maintenance tasks.
 *
 * Should be called on session start and periodically (every ~30 minutes).
 *
 * @param {string} learnerId - Learner identifier
 * @returns {object} Maintenance results
 */
export function runMaintenance(learnerId) {
  const results = {
    learnerId,
    timestamp: new Date().toISOString(),
    tasks: {},
  };

  try {
    // Ensure writing pad exists
    writingPadService.getOrInitializeWritingPad(learnerId);

    // Phase 4: Consolidate old moments, forget stale patterns
    const maintenanceResult = memoryDynamicsService.runBackgroundMaintenance(learnerId);
    results.tasks.memoryMaintenance = maintenanceResult.tasks;

    // Phase 3: Evolve learner archetype based on accumulated patterns
    const archetype = learnerIntegrationService.evolveLearnerArchetype(learnerId);
    results.tasks.archetypeEvolution = archetype ? {
      evolved: true,
      style: archetype.preferredLearningStyle,
    } : { evolved: false };

    return results;
  } catch (error) {
    console.error(`[RecognitionOrchestrator] runMaintenance failed for ${learnerId}:`, error.message);
    return {
      ...results,
      error: error.message,
    };
  }
}

// ============================================================================
// getFullRecognitionState
// ============================================================================

/**
 * Get complete recognition state from all phases.
 *
 * @param {string} learnerId - Learner identifier
 * @returns {object} Full recognition state across all phases
 */
export function getFullRecognitionState(learnerId) {
  try {
    const pad = writingPadService.getWritingPad(learnerId);
    if (!pad) {
      return {
        learnerId,
        initialized: false,
        writingPad: null,
        memoryState: null,
        learnerPatterns: null,
        recognitionProfile: null,
        dialecticalHistory: null,
      };
    }

    // Phase 1: Writing pad state
    const writingPad = {
      id: pad.id,
      metrics: pad.metrics,
      conscious: {
        workingThoughts: pad.conscious.workingThoughts?.length || 0,
        lastCleared: pad.conscious.lastCleared,
      },
      preconscious: {
        patterns: pad.preconscious.recentPatterns?.length || 0,
        provisionalRules: pad.preconscious.provisionalRules?.length || 0,
      },
      unconscious: {
        permanentTraces: pad.unconscious.permanentTraces?.length || 0,
        learnerArchetype: pad.unconscious.learnerArchetype,
        conflictPatterns: pad.unconscious.conflictPatterns?.length || 0,
      },
    };

    // Phase 2: Recent recognition moments with dialogue traces
    const recentMoments = writingPadService.getRecognitionMoments(pad.id, { limit: 20 });
    const dialecticalHistory = recentMoments.map(m => ({
      id: m.id,
      createdAt: m.created_at,
      strategy: m.synthesis_strategy,
      transformative: m.transformative,
      layer: m.persistence_layer,
    }));

    // Phase 3: Learner patterns
    const learnerPatterns = learnerIntegrationService.analyzeLearnerPatterns(learnerId);

    // Phase 4: Memory state
    const memoryState = memoryDynamicsService.getMemoryState(learnerId);

    // Phase 5: Full recognition profile
    const recognitionProfile = recognitionGamificationService.getLearnerRecognitionProfile(learnerId);

    return {
      learnerId,
      initialized: true,
      writingPad,
      memoryState,
      learnerPatterns,
      recognitionProfile,
      dialecticalHistory,
    };
  } catch (error) {
    console.error(`[RecognitionOrchestrator] getFullRecognitionState failed for ${learnerId}:`, error.message);
    return {
      learnerId,
      initialized: false,
      error: error.message,
    };
  }
}

// ============================================================================
// Convenience accessors for individual phase data
// ============================================================================

/**
 * Get dialectical history (recent recognition moments with traces).
 */
export function getDialecticalHistory(learnerId, options = {}) {
  const { limit = 20 } = options;
  const pad = writingPadService.getWritingPad(learnerId);
  if (!pad) return [];

  return writingPadService.getRecognitionMoments(pad.id, { limit });
}

/**
 * Get memory state across all three layers.
 */
export function getMemoryState(learnerId) {
  return memoryDynamicsService.getMemoryState(learnerId);
}

/**
 * Get learner patterns analysis.
 */
export function getLearnerPatterns(learnerId) {
  return learnerIntegrationService.analyzeLearnerPatterns(learnerId);
}

export default {
  processDialogueResult,
  processWritingEvent,
  runMaintenance,
  getFullRecognitionState,
  getDialecticalHistory,
  getMemoryState,
  getLearnerPatterns,
};
