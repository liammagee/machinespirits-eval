/**
 * Multi-Turn Scenario Runner
 *
 * Runs multi-turn evaluation scenarios by orchestrating multiple calls to
 * tutor-core's buildContext/generateSuggestions with conversation history.
 *
 * Moved from tutor-core's tutorApiService to keep eval-specific logic
 * in the eval repo.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  tutorApiService as tutorApi,
  tutorDialogueEngine as dialogueEngine,
  tutorConfigLoader as configLoader,
} from '@machinespirits/tutor-core';
import * as evalConfigLoader from './evalConfigLoader.js';
import * as contentResolver from './contentResolver.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVAL_ROOT = path.resolve(__dirname, '..');
const LOGS_DIR = path.join(EVAL_ROOT, 'logs', 'tutor-dialogues');

/**
 * Build updated context for a follow-up turn in a multi-turn scenario
 */
function buildMultiTurnContext(options) {
  const {
    originalContext,
    conversationHistory = [],
    currentTurn,
    previousSuggestion,
  } = options;

  const contextParts = [originalContext];

  if (conversationHistory.length > 0) {
    contextParts.push('\n### Conversation History');
    for (const turn of conversationHistory) {
      contextParts.push(formatTurnForContext(turn));
    }
  }

  if (previousSuggestion) {
    contextParts.push('\n### Previous Tutor Suggestion');
    contextParts.push(formatSuggestionForContext(previousSuggestion));
  }

  if (currentTurn?.learner_action) {
    contextParts.push('\n### Learner Action');
    contextParts.push(formatLearnerAction(currentTurn));
  }

  if (currentTurn?.context_update) {
    contextParts.push('\n' + currentTurn.context_update.trim());
  }

  return contextParts.join('\n');
}

/**
 * Format a previous turn for inclusion in context
 */
function formatTurnForContext(turn) {
  const lines = [];
  lines.push(`\n**Turn ${turn.turnIndex + 1}** (${turn.turnId})`);

  if (turn.suggestion) {
    lines.push(`- Tutor suggested: "${turn.suggestion.title || turn.suggestion.message?.substring(0, 100)}..."`);
    if (turn.suggestion.actionTarget) {
      lines.push(`  - Action: ${turn.suggestion.action} → ${turn.suggestion.actionTarget}`);
    }
  }

  if (turn.learnerAction) {
    lines.push(`- Learner response: ${turn.learnerAction}`);
    if (turn.learnerMessage) {
      lines.push(`  - Message: "${turn.learnerMessage}"`);
    }
  }

  return lines.join('\n');
}

/**
 * Format a suggestion for inclusion in conversation context
 */
function formatSuggestionForContext(suggestion) {
  const lines = [];

  if (suggestion.title) {
    lines.push(`**Title**: ${suggestion.title}`);
  }
  if (suggestion.message) {
    lines.push(`**Message**: ${suggestion.message}`);
  }
  if (suggestion.action && suggestion.actionTarget) {
    lines.push(`**Suggested Action**: ${suggestion.action} → ${suggestion.actionTarget}`);
  }
  if (suggestion.reasoning) {
    lines.push(`**Reasoning**: ${suggestion.reasoning}`);
  }

  return lines.join('\n');
}

/**
 * Format learner action for context
 */
function formatLearnerAction(turn) {
  const action = turn.learner_action;
  const details = turn.action_details || {};
  const lines = [];

  switch (action) {
    case 'followed_suggestion':
      lines.push(`Learner **followed** the suggestion`);
      if (details.action_taken) {
        lines.push(`- Action: ${details.action_taken}`);
      }
      break;

    case 'ignored_suggestion':
      lines.push(`Learner **did not follow** the suggestion`);
      if (details.explicit_rejection) {
        lines.push(`- Explicitly rejected`);
      }
      break;

    case 'asked_followup':
      lines.push(`Learner **asked a follow-up question**`);
      break;

    case 'reported_confusion':
      lines.push(`Learner **reported confusion**`);
      break;

    case 'completed_activity':
      lines.push(`Learner **completed an activity**`);
      if (details.activity_id) {
        lines.push(`- Activity: ${details.activity_id}`);
      }
      if (details.success !== undefined) {
        lines.push(`- Success: ${details.success}`);
      }
      if (details.score !== undefined) {
        lines.push(`- Score: ${details.score}%`);
      }
      break;

    default:
      lines.push(`Learner action: ${action}`);
  }

  if (details.message) {
    lines.push(`\n**Learner said**: "${details.message}"`);
  }

  return lines.join('\n');
}

/**
 * Format learner action for transcript display (cleaner format for CLI)
 */
function formatLearnerActionForTranscript(turn) {
  const action = turn.learner_action;
  const details = turn.action_details || {};
  const lines = [];

  const actionLabels = {
    'followed_suggestion': '✓ Followed suggestion',
    'ignored_suggestion': '✗ Ignored suggestion',
    'asked_followup': '❓ Asked follow-up question',
    'reported_confusion': '😕 Reported confusion',
    'completed_activity': '✅ Completed activity',
    'navigated_away': '🔄 Navigated away',
    'requested_hint': '💡 Requested hint',
  };

  lines.push(actionLabels[action] || `Action: ${action}`);

  if (details.action_taken) {
    lines.push(`  → ${details.action_taken}`);
  }
  if (details.activity_id) {
    lines.push(`  Activity: ${details.activity_id}`);
  }
  if (details.success !== undefined) {
    lines.push(`  Success: ${details.success ? 'Yes' : 'No'}`);
  }
  if (details.score !== undefined) {
    lines.push(`  Score: ${details.score}%`);
  }

  if (details.message) {
    lines.push(`\n  "${details.message}"`);
  }

  return lines.join('\n');
}

/**
 * Get effective provider from profile
 */
function getEffectiveProvider(profileName) {
  const profile = configLoader.getActiveProfile(profileName);
  return profile?.ego?.provider || 'anthropic';
}

/**
 * Get effective model from profile
 */
function getEffectiveModel(profileName) {
  const profile = configLoader.getActiveProfile(profileName);
  const agentConfig = configLoader.getAgentConfig('ego', profileName);
  return agentConfig?.model || 'claude-haiku-4-5';
}

/**
 * Run a complete multi-turn scenario
 *
 * @param {string} scenarioId - The scenario identifier
 * @param {Object} config - Provider/model configuration
 * @returns {Promise<Object>} Multi-turn scenario results
 */
export async function runMultiTurnScenario(scenarioId, config = {}) {
  const scenario = evalConfigLoader.getScenario(scenarioId);
  if (!scenario) {
    throw new Error(`Unknown scenario: ${scenarioId}`);
  }

  const turns = scenario.turns || [];

  // Create a SINGLE dialogue ID for the entire multi-turn conversation
  const dialogueId = `dialogue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Set the dialogue ID for the entire multi-turn session
  dialogueEngine.setCurrentDialogueId(dialogueId);

  const results = {
    scenarioId,
    scenarioName: scenario.name,
    isMultiTurn: turns.length > 0,
    totalTurns: turns.length + 1, // Include initial turn
    turnResults: [],
    conversationHistory: [],
    dialogueId, // Single dialogue ID for all turns
  };

  // Resolve curriculum context once for all turns
  const curriculumContext = contentResolver.isConfigured()
    ? contentResolver.buildCurriculumContext(
        contentResolver.resolveScenarioContent(scenario)
      )
    : null;

  // Run initial turn (turn 0)
  const initialContext = tutorApi.buildContext(scenario.learner_context, curriculumContext);
  initialContext.isNewUser = scenario.is_new_user;

  // Extract learnerArchitecture from config (not passed to tutor API, used for eval metadata)
  const { learnerArchitecture, ...tutorConfig } = config;

  const initialResult = await tutorApi.generateSuggestions(initialContext, {
    ...tutorConfig,
    trace: true,
    _dialogueId: dialogueId, // Pass dialogue ID to continue same session
    _skipLogging: true, // Skip logging - we'll consolidate all turns at the end
  });

  // Validate initial result
  if (!initialResult || !initialResult.suggestions) {
    throw new Error(`Multi-turn scenario ${scenarioId}: Initial turn failed to generate suggestions`);
  }

  results.turnResults.push({
    turnIndex: 0,
    turnId: 'initial',
    context: scenario.learner_context,
    expectedBehavior: scenario.expected_behavior,
    requiredElements: scenario.required_elements || [],
    forbiddenElements: scenario.forbidden_elements || [],
    ...initialResult,
    metadata: {
      ...initialResult.metadata,
      dialogueId, // Override with continuous dialogue ID
    },
  });

  // Track conversation history
  let conversationHistory = [];
  let previousSuggestion = initialResult.suggestions?.[0];

  // Run follow-up turns
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];

    // Show learner action in transcript mode
    if (dialogueEngine.isTranscriptMode()) {
      dialogueEngine.transcript('LEARNER ACTION', formatLearnerActionForTranscript(turn));
    }

    // Add previous turn to history
    conversationHistory.push({
      turnIndex: i,
      turnId: i === 0 ? 'initial' : turns[i - 1]?.id,
      suggestion: previousSuggestion,
      learnerAction: turn.learner_action,
      learnerMessage: turn.action_details?.message,
    });

    // Build updated context for this turn
    const updatedContextStr = buildMultiTurnContext({
      originalContext: scenario.learner_context,
      conversationHistory,
      currentTurn: turn,
      previousSuggestion,
    });

    const turnContext = tutorApi.buildContext(updatedContextStr, curriculumContext);
    turnContext.isNewUser = false; // Multi-turn implies returning user

    // Generate suggestions for this turn - CONTINUE THE SAME DIALOGUE
    const turnResult = await tutorApi.generateSuggestions(turnContext, {
      ...tutorConfig,
      trace: true,
      _dialogueId: dialogueId, // Continue same dialogue session
      _skipLogging: true, // Skip logging - we'll consolidate all turns at the end
    });

    // Validate turn result
    if (!turnResult || !turnResult.suggestions) {
      throw new Error(`Multi-turn scenario ${scenarioId}: Turn ${i + 1} (${turn.id}) failed to generate suggestions`);
    }

    results.turnResults.push({
      turnIndex: i + 1,
      turnId: turn.id,
      learnerAction: turn.learner_action,
      actionDetails: turn.action_details,
      context: updatedContextStr,
      expectedBehavior: turn.expected_behavior,
      requiredElements: turn.required_elements || [],
      forbiddenElements: turn.forbidden_elements || [],
      minAcceptableScore: turn.min_acceptable_score,
      ...turnResult,
      metadata: {
        ...turnResult.metadata,
        dialogueId, // Override with continuous dialogue ID
      },
    });

    // Update for next iteration
    previousSuggestion = turnResult.suggestions?.[0];
  }

  results.conversationHistory = conversationHistory;

  // Consolidate all dialogue traces from all turns into a single continuous log
  const consolidatedTrace = [];
  const consolidatedMetrics = {
    totalLatencyMs: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCost: 0,
    apiCalls: 0,
    generationIds: [],
  };

  for (let i = 0; i < results.turnResults.length; i++) {
    const turn = results.turnResults[i];

    // Insert user turn action entry before each turn (except initial)
    if (i > 0) {
      const historyEntry = conversationHistory[i];
      const userMessage = historyEntry?.learnerMessage || `${historyEntry?.learnerAction || 'Action'}`;

      consolidatedTrace.push({
        agent: 'user',
        action: 'turn_action',
        turnIndex: i,
        contextSummary: userMessage,
        detail: `Learner: ${historyEntry?.learnerAction}`,
        timestamp: new Date().toISOString(),
      });
    }

    // Accumulate dialogue traces
    if (turn.dialogueTrace && turn.dialogueTrace.length > 0) {
      consolidatedTrace.push(...turn.dialogueTrace);
    }

    // Add final delivery to user for this turn (ONLY for multi-agent mode)
    const hasSuperego = turn.dialogueTrace?.some(entry => entry.agent === 'superego');

    if (hasSuperego) {
      const suggestionCount = turn.suggestions?.length || 0;
      consolidatedTrace.push({
        agent: 'user',
        action: 'final_output',
        turnIndex: i,
        from: 'ego',
        to: 'user',
        direction: 'response',
        suggestionCount,
        contextSummary: `Delivered ${suggestionCount} suggestion${suggestionCount !== 1 ? 's' : ''}`,
        detail: `Turn ${i + 1} complete`,
        timestamp: new Date().toISOString(),
      });
    }

    // Accumulate metrics
    if (turn.metrics) {
      consolidatedMetrics.totalLatencyMs += turn.metrics.totalLatencyMs || 0;
      consolidatedMetrics.totalInputTokens += turn.metrics.totalInputTokens || 0;
      consolidatedMetrics.totalOutputTokens += turn.metrics.totalOutputTokens || 0;
      consolidatedMetrics.totalCost += turn.metrics.totalCost || 0;
      consolidatedMetrics.apiCalls += turn.metrics.apiCalls || 0;
      if (turn.metrics.generationIds) {
        consolidatedMetrics.generationIds.push(...turn.metrics.generationIds);
      }
    }
  }

  // Write consolidated dialogue log (single continuous transcript for all turns)
  const lastTurn = results.turnResults[results.turnResults.length - 1];
  const profileName = config.profileName || lastTurn?.profileName || 'default';
  const consolidatedDialogue = {
    suggestions: lastTurn?.suggestions || [],
    dialogueTrace: consolidatedTrace,
    converged: lastTurn?.converged || false,
    rounds: results.turnResults.reduce((sum, t) => sum + (t.rounds || 0), 0),
    metrics: consolidatedMetrics,
    dialogueId,
    profileName,
    provider: getEffectiveProvider(profileName),
    model: getEffectiveModel(profileName),
    learnerContext: scenario.learner_context,
    isMultiTurn: true,
    learnerArchitecture: learnerArchitecture || 'unified',
    totalTurns: results.totalTurns,
    turnResults: results.turnResults.map(t => ({
      turnIndex: t.turnIndex,
      turnId: t.turnId,
      suggestions: t.suggestions,
      rounds: t.rounds,
    })),
  };

  // Ensure logs directory exists
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }

  // Write consolidated dialogue log
  const logPath = path.join(LOGS_DIR, `${dialogueId}.json`);
  fs.writeFileSync(logPath, JSON.stringify(consolidatedDialogue, null, 2));

  return results;
}

export default {
  runMultiTurnScenario,
};
