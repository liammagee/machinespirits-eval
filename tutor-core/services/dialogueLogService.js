/**
 * Dialogue Log Service
 *
 * Provides access to tutor API logs and dialogue traces.
 * Used by both CLI (eval-tutor logs) and API endpoints.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const LOGS_DIR = path.join(ROOT_DIR, 'logs');
const API_LOGS_DIR = path.join(LOGS_DIR, 'tutor-api');
const DIALOGUE_LOGS_DIR = path.join(LOGS_DIR, 'tutor-dialogues');
const INTERACTION_EVALS_DIR = path.join(LOGS_DIR, 'interaction-evals');

// ============================================================================
// Log File Access
// ============================================================================

/**
 * List available log dates
 * @returns {string[]} Array of dates (YYYY-MM-DD) with logs
 */
export function listLogDates() {
  if (!fs.existsSync(API_LOGS_DIR)) {
    return [];
  }

  return fs.readdirSync(API_LOGS_DIR)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => f.replace('api-', '').replace('.jsonl', ''))
    .sort()
    .reverse();
}

/**
 * Get raw API log entries for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {object[]} Array of log entries
 */
export function getApiLogEntries(date) {
  const logFile = path.join(API_LOGS_DIR, `api-${date}.jsonl`);

  if (!fs.existsSync(logFile)) {
    return [];
  }

  const content = fs.readFileSync(logFile, 'utf-8');
  return content.trim().split('\n').filter(line => line).map(line => {
    try {
      return JSON.parse(line);
    } catch (e) {
      return null;
    }
  }).filter(Boolean);
}

/**
 * Group log entries into dialogues
 * Prefers grouping by dialogueId when available, falls back to time proximity for older logs
 * @param {object[]} entries - Log entries
 * @param {number} gapMs - Gap in ms that defines a new dialogue for time-based grouping (default 30s)
 * @returns {object[]} Array of dialogue groups
 */
export function groupIntoDialogues(entries, gapMs = 30000) {
  // Check if entries have dialogueId - use ID-based grouping if available
  const hasDialogueIds = entries.some(e => e.dialogueId);

  if (hasDialogueIds) {
    // Group by dialogueId for reliable grouping
    const byDialogueId = new Map();

    for (const entry of entries) {
      const id = entry.dialogueId || 'unknown';
      if (!byDialogueId.has(id)) {
        byDialogueId.set(id, []);
      }
      byDialogueId.get(id).push(entry);
    }

    // Convert to dialogue format, sorted by start time
    const dialogues = [];
    for (const [dialogueId, dialogueEntries] of byDialogueId) {
      // Sort entries within each dialogue by step or timestamp
      dialogueEntries.sort((a, b) => {
        if (a.step !== undefined && b.step !== undefined) {
          return a.step - b.step;
        }
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });

      dialogues.push({
        dialogueId,
        startTime: dialogueEntries[0].timestamp,
        endTime: dialogueEntries[dialogueEntries.length - 1].timestamp,
        entries: dialogueEntries,
        entryCount: dialogueEntries.length,
      });
    }

    // Sort dialogues by start time
    dialogues.sort((a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    return dialogues;
  }

  // Fallback: time-based grouping for older logs without dialogueId
  const dialogues = [];
  let currentDialogue = [];
  let lastTime = null;

  for (const entry of entries) {
    const entryTime = new Date(entry.timestamp).getTime();

    if (lastTime && entryTime - lastTime > gapMs) {
      if (currentDialogue.length > 0) {
        dialogues.push({
          startTime: currentDialogue[0].timestamp,
          endTime: currentDialogue[currentDialogue.length - 1].timestamp,
          entries: currentDialogue,
          entryCount: currentDialogue.length,
        });
      }
      currentDialogue = [];
    }

    currentDialogue.push(entry);
    lastTime = entryTime;
  }

  if (currentDialogue.length > 0) {
    dialogues.push({
      startTime: currentDialogue[0].timestamp,
      endTime: currentDialogue[currentDialogue.length - 1].timestamp,
      entries: currentDialogue,
      entryCount: currentDialogue.length,
    });
  }

  return dialogues;
}

// ============================================================================
// Formatted Output (for API responses)
// ============================================================================

/**
 * Parse an Ego response into structured suggestions
 * @param {string} response - Raw response text
 * @returns {object[]} Array of parsed suggestions
 */
export function parseEgoResponse(response) {
  if (!response) return [];

  try {
    let jsonStr = response;
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return parsed.map(s => ({
        type: s.type,
        priority: s.priority,
        title: s.title,
        message: s.message,
        actionType: s.actionType,
        actionTarget: s.actionTarget,
        reasoning: s.reasoning,
      }));
    }
  } catch (e) {
    // Return empty if parsing fails
  }

  return [];
}

/**
 * Parse a Superego response into structured verdict
 * @param {string} response - Raw response text
 * @returns {object|null} Parsed verdict or null
 */
export function parseSuperegoResponse(response) {
  if (!response) return null;

  try {
    let jsonStr = response;
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);
    return {
      approved: parsed.approved,
      confidence: parsed.confidence,
      interventionType: parsed.interventionType,
      feedback: parsed.feedback,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Parse a Superego pre-analysis response (signal reinterpretation)
 * Pre-analysis runs BEFORE Ego generates suggestions and provides
 * alternative interpretations of learner behavior signals.
 * @param {string} response - Raw response text
 * @returns {object|null} Parsed pre-analysis or null
 */
export function parsePreAnalysisResponse(response) {
  if (!response) return null;

  try {
    let jsonStr = response;
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    // Pre-analysis has reinterpretations array and overallCaution
    if (parsed.reinterpretations || parsed.overallCaution) {
      return {
        isPreAnalysis: true,
        reinterpretations: parsed.reinterpretations || [],
        overallCaution: parsed.overallCaution,
      };
    }
  } catch (e) {
    // Return null if parsing fails
  }

  return null;
}

/**
 * Detect if a superego response is pre-analysis or review
 * @param {string} response - Raw response text
 * @param {string} action - The action field (e.g., 'superego-reinterpret_call')
 * @returns {'pre_analysis' | 'review'} The response type
 */
export function detectSuperegoResponseType(response, action) {
  // Check action field first (most reliable)
  if (action && action.includes('reinterpret')) {
    return 'pre_analysis';
  }

  // Fall back to content inspection
  if (response) {
    try {
      let jsonStr = response;
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      }
      const parsed = JSON.parse(jsonStr);

      // Pre-analysis has reinterpretations, review has approved
      if (parsed.reinterpretations !== undefined) {
        return 'pre_analysis';
      }
    } catch (e) {
      // Fall through
    }
  }

  return 'review';
}

/**
 * Format a log entry for API/web display
 * @param {object} entry - Raw log entry
 * @returns {object} Formatted entry
 */
export function formatLogEntry(entry) {
  const formatted = {
    timestamp: entry.timestamp,
    step: entry.step,
    agent: entry.agent,
    action: entry.action,
    model: entry.model,
    provider: entry.provider,
    latencyMs: entry.latencyMs,
    inputTokens: entry.inputTokens,
    outputTokens: entry.outputTokens,
    // Flow direction fields (for all entry types)
    direction: entry.direction,
    from: entry.from,
    to: entry.to,
  };

  if (entry.agent === 'ego') {
    formatted.suggestions = parseEgoResponse(entry.response);
    // Include raw response for expandable view
    formatted.rawResponse = entry.response;
  } else if (entry.agent === 'superego') {
    // Detect if this is pre-analysis or review
    const responseType = detectSuperegoResponseType(entry.response, entry.action);
    formatted.superegoType = responseType;

    if (responseType === 'pre_analysis') {
      // Pre-analysis: reinterprets learner signals before Ego generates
      formatted.preAnalysis = parsePreAnalysisResponse(entry.response);
    } else {
      // Review: evaluates Ego's suggestions
      formatted.verdict = parseSuperegoResponse(entry.response);
    }
    // Include raw response for expandable view
    formatted.rawResponse = entry.response;
  } else if (entry.agent === 'user') {
    // User flow entries (context input / final output)
    formatted.contextSummary = entry.contextSummary;
    formatted.suggestionCount = entry.suggestionCount;
    // Extended context data for expandable view
    formatted.contextData = entry.contextData;
    formatted.rawContext = entry.rawContext;
    // Final output data
    formatted.suggestions = entry.suggestions;
    formatted.converged = entry.converged;
  }

  // Include prompt for all entries (for expandable view)
  if (entry.prompt) {
    formatted.prompt = entry.prompt;
  }

  return formatted;
}

/**
 * Format a dialogue for API/web display
 * @param {object} dialogue - Dialogue group
 * @returns {object} Formatted dialogue
 */
export function formatDialogue(dialogue) {
  // Sort entries by step number for consistent chronological order
  const formattedEntries = dialogue.entries
    .map(formatLogEntry)
    .sort((a, b) => (a.step || 0) - (b.step || 0));

  return {
    dialogueId: dialogue.dialogueId, // For tracing
    startTime: dialogue.startTime,
    endTime: dialogue.endTime,
    entryCount: dialogue.entryCount,
    entries: formattedEntries,
    summary: summarizeDialogue(dialogue),
  };
}

/**
 * Generate a summary of a dialogue
 * @param {object} dialogue - Dialogue group
 * @returns {object} Summary statistics
 */
export function summarizeDialogue(dialogue) {
  const summary = {
    egoCount: 0,
    superegoCount: 0,
    totalSuggestions: 0,
    approvedCount: 0,
    revisedCount: 0,
    totalLatencyMs: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCost: 0,
  };

  for (const entry of dialogue.entries) {
    if (entry.agent === 'ego') {
      summary.egoCount++;
      const suggestions = parseEgoResponse(entry.response);
      summary.totalSuggestions += suggestions.length;
    } else if (entry.agent === 'superego') {
      summary.superegoCount++;
      const verdict = parseSuperegoResponse(entry.response);
      if (verdict?.approved) {
        summary.approvedCount++;
      } else if (verdict) {
        summary.revisedCount++;
      }
    }

    summary.totalLatencyMs += entry.latencyMs || 0;
    summary.totalInputTokens += entry.inputTokens || 0;
    summary.totalOutputTokens += entry.outputTokens || 0;
    summary.totalCost += entry.cost || entry.metrics?.cost || 0;
  }

  return summary;
}

// ============================================================================
// High-Level API
// ============================================================================

/**
 * Get dialogues for a specific date
 * @param {object} options - Query options
 * @param {string} options.date - Date in YYYY-MM-DD format (default: today)
 * @param {number} options.limit - Max dialogues to return (default: 10)
 * @param {number} options.offset - Skip first N dialogues (default: 0)
 * @param {boolean} options.formatted - Return formatted entries (default: true)
 * @returns {object} Dialogues and metadata
 */
export function getDialogues(options = {}) {
  const {
    date = new Date().toISOString().slice(0, 10),
    limit = 10,
    offset = 0,
    formatted = true,
  } = options;

  let allDialogues = [];

  // FIRST: Try to load from dialogue files (richer semantic data)
  if (fs.existsSync(DIALOGUE_LOGS_DIR)) {
    try {
      const dialogueFiles = fs.readdirSync(DIALOGUE_LOGS_DIR)
        .filter(f => f.startsWith('dialogue-') && f.endsWith('.json'));

      for (const file of dialogueFiles) {
        const filePath = path.join(DIALOGUE_LOGS_DIR, file);
        try {
          const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const dialogueId = file.replace('.json', '');

          // Extract timestamp from dialogueId
          const timestampMatch = dialogueId.match(/dialogue-(\d+)-/);
          if (!timestampMatch) continue;

          const timestamp = parseInt(timestampMatch[1], 10);
          const dialogueDate = new Date(timestamp).toISOString().slice(0, 10);

          // Filter by date
          if (dialogueDate === date) {
            const formatted = formatRawDialogueFile(rawData, dialogueId, timestamp);
            allDialogues.push(formatted);
          }
        } catch (err) {
          console.error(`Error reading dialogue file ${file}:`, err.message);
        }
      }
    } catch (err) {
      console.error('Error reading dialogue directory:', err.message);
    }
  }

  // ALSO: Load interaction eval files
  if (fs.existsSync(INTERACTION_EVALS_DIR)) {
    try {
      const evalFiles = fs.readdirSync(INTERACTION_EVALS_DIR)
        .filter(f => (f.startsWith('short-') || f.startsWith('long-')) && f.endsWith('.json'));

      for (const file of evalFiles) {
        const filePath = path.join(INTERACTION_EVALS_DIR, file);
        try {
          const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const evalId = file.replace('.json', '');

          // Extract timestamp from evalId (format: short-{scenario}-{timestamp} or long-{scenario}-{timestamp})
          const timestampMatch = evalId.match(/-(\d+)$/);
          if (!timestampMatch) continue;

          const timestamp = parseInt(timestampMatch[1], 10);
          const evalDate = new Date(timestamp).toISOString().slice(0, 10);

          // Filter by date
          if (evalDate === date) {
            const formatted = formatInteractionEvalFile(rawData, evalId, timestamp);
            allDialogues.push(formatted);
          }
        } catch (err) {
          console.error(`Error reading interaction eval file ${file}:`, err.message);
        }
      }
    } catch (err) {
      console.error('Error reading interaction evals directory:', err.message);
    }
  }

  // FALLBACK: If no dialogue files found, use old API logs
  if (allDialogues.length === 0) {
    const entries = getApiLogEntries(date);

    if (entries.length === 0) {
      return {
        date,
        dialogues: [],
        total: 0,
        availableDates: listLogDates().slice(0, 5),
      };
    }

    allDialogues = groupIntoDialogues(entries);
  }

  // Sort by start time (most recent first)
  allDialogues.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  const total = allDialogues.length;

  // Get slice
  const startIdx = offset;
  const endIdx = Math.min(offset + limit, total);
  const slicedDialogues = allDialogues.slice(startIdx, endIdx);

  return {
    date,
    dialogues: formatted ? slicedDialogues.map(d => d) : slicedDialogues, // Already formatted by formatRawDialogueFile
    total,
    offset,
    limit,
    hasMore: endIdx < total,
  };
}

/**
 * Get a single dialogue by index
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {number} index - Dialogue index (0-based, from most recent)
 * @returns {object|null} Dialogue or null
 */
export function getDialogueByIndex(date, index) {
  // Use getDialogues which now reads from dialogue files first
  const result = getDialogues({ date, limit: 1000, offset: 0, formatted: true });

  if (!result.dialogues || result.dialogues.length === 0) {
    return null;
  }

  // Index is from most recent (0) to oldest, dialogues are sorted most recent first
  if (index < 0 || index >= result.dialogues.length) {
    return null;
  }

  const dialogue = result.dialogues[index];

  return dialogue;
}

/**
 * Get log statistics for a date range
 * @param {object} options - Query options
 * @param {string} options.startDate - Start date (YYYY-MM-DD)
 * @param {string} options.endDate - End date (YYYY-MM-DD)
 * @returns {object} Statistics
 */
export function getLogStatistics(options = {}) {
  const dates = listLogDates();
  const { startDate, endDate } = options;

  const filteredDates = dates.filter(d => {
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  });

  const stats = {
    dateRange: { start: filteredDates[filteredDates.length - 1], end: filteredDates[0] },
    totalDates: filteredDates.length,
    totalDialogues: 0,
    totalEntries: 0,
    byDate: [],
  };

  for (const date of filteredDates.slice(0, 7)) { // Last 7 days max
    const entries = getApiLogEntries(date);
    const dialogues = groupIntoDialogues(entries);

    stats.totalDialogues += dialogues.length;
    stats.totalEntries += entries.length;
    stats.byDate.push({
      date,
      dialogues: dialogues.length,
      entries: entries.length,
    });
  }

  return stats;
}

/**
 * Get dialogue entries by dialogueId
 * Searches across log files for entries matching the dialogueId
 * Supports both tutor dialogue IDs (dialogue-{timestamp}-{random})
 * and interaction eval IDs (short-{scenario}-{timestamp} or long-{scenario}-{timestamp})
 * @param {string} dialogueId - The dialogue ID to search for
 * @returns {object|null} Formatted dialogue or null if not found
 */
export function getDialogueById(dialogueId) {
  if (!dialogueId) return null;

  // Check if this is an interaction eval ID (short-* or long-*)
  const interactionEvalMatch = dialogueId.match(/^(short|long)-.*-(\d+)$/);
  if (interactionEvalMatch) {
    const timestamp = parseInt(interactionEvalMatch[2], 10);
    const evalFile = path.join(INTERACTION_EVALS_DIR, `${dialogueId}.json`);

    if (fs.existsSync(evalFile)) {
      try {
        const rawData = JSON.parse(fs.readFileSync(evalFile, 'utf8'));
        return formatInteractionEvalFile(rawData, dialogueId, timestamp);
      } catch (err) {
        console.error(`Error reading interaction eval file ${evalFile}:`, err.message);
      }
    }
    return null;
  }

  // Extract date from dialogueId (format: dialogue-{timestamp}-{random})
  const timestampMatch = dialogueId.match(/dialogue-(\d+)-/);
  if (!timestampMatch) return null;

  const timestamp = parseInt(timestampMatch[1], 10);
  const date = new Date(timestamp).toISOString().slice(0, 10);

  // PREFER tutor-dialogues file first - it has richer semantic data
  // including action types like 'incorporate-feedback' vs generic 'openrouter_call'
  const dialogueFile = path.join(DIALOGUE_LOGS_DIR, `${dialogueId}.json`);
  if (fs.existsSync(dialogueFile)) {
    try {
      const rawData = JSON.parse(fs.readFileSync(dialogueFile, 'utf8'));
      return formatRawDialogueFile(rawData, dialogueId, timestamp);
    } catch (err) {
      console.error(`Error reading dialogue file ${dialogueFile}:`, err.message);
      // Continue to API logs fallback
    }
  }

  // Fallback: Get log entries from API logs
  const entries = getApiLogEntries(date);
  const matchingEntries = entries.filter(e => e.dialogueId === dialogueId);

  if (matchingEntries.length > 0) {
    return formatDialogue({
      startTime: matchingEntries[0].timestamp,
      endTime: matchingEntries[matchingEntries.length - 1].timestamp,
      entries: matchingEntries,
      entryCount: matchingEntries.length,
    });
  }

  // Try adjacent dates in case of timezone issues
  const dates = listLogDates();
  for (const d of dates.slice(0, 5)) {
    if (d === date) continue;
    const altEntries = getApiLogEntries(d);
    const altMatching = altEntries.filter(e => e.dialogueId === dialogueId);
    if (altMatching.length > 0) {
      return formatDialogue({
        startTime: altMatching[0].timestamp,
        endTime: altMatching[altMatching.length - 1].timestamp,
        entries: altMatching,
        entryCount: altMatching.length,
      });
    }
  }

  return null;
}

/**
 * Format an interaction eval file into the dialogue format
 * Transforms learner/tutor turns with internalDeliberation into ego/superego/user entries
 */
function formatInteractionEvalFile(rawData, evalId, timestamp) {
  const entries = [];
  const startTime = rawData.timestamp || new Date(timestamp).toISOString();
  const turns = rawData.interaction?.turns || rawData.sessions?.[0]?.interaction?.turns || [];

  let step = 0;
  for (const turn of turns) {
    const turnTimestamp = turn.timestamp || startTime;

    if (turn.phase === 'learner') {
      // Learner turn: Goffmanian staging - internal deliberation FIRST (back stage),
      // then external message (front stage)

      // Internal deliberation (ego drafts, superego reviews) - back stage
      if (turn.internalDeliberation && Array.isArray(turn.internalDeliberation)) {
        for (const delib of turn.internalDeliberation) {
          step++;
          const agent = delib.role === 'superego' ? 'superego' : 'ego';
          entries.push({
            step,
            agent,
            action: agent === 'superego' ? 'learner_superego_critique' : 'learner_ego_thought',
            direction: agent === 'superego' ? 'response' : 'request',
            from: agent === 'superego' ? 'ego' : 'user',
            to: agent === 'superego' ? 'user' : 'superego',
            timestamp: turnTimestamp,
            rawResponse: delib.content,
            internalThought: delib.content,
          });
        }
      }

      // External message to tutor - front stage (AFTER internal deliberation)
      step++;
      entries.push({
        step,
        agent: 'user',
        action: 'learner_input',
        direction: 'input',
        from: 'user',
        to: 'ego',
        timestamp: turnTimestamp,
        rawContext: turn.externalMessage,
        contextData: {
          emotionalState: turn.emotionalState,
          understandingLevel: turn.understandingLevel,
        },
      });
    } else if (turn.phase === 'tutor') {
      // Tutor turn: first show internal deliberation (if present), then external response
      if (turn.internalDeliberation && Array.isArray(turn.internalDeliberation)) {
        for (const delib of turn.internalDeliberation) {
          step++;
          const agent = delib.role === 'superego' ? 'superego' : 'ego';
          entries.push({
            step,
            agent,
            action: agent === 'superego' ? 'tutor_superego_critique' : 'tutor_ego_thought',
            direction: agent === 'superego' ? 'response' : 'request',
            from: agent === 'superego' ? 'ego' : 'user',
            to: agent === 'superego' ? 'user' : 'superego',
            timestamp: turnTimestamp,
            rawResponse: delib.content,
            internalThought: delib.content,
            isTutorDeliberation: true,
          });
        }
      }

      // Tutor's external response
      step++;
      entries.push({
        step,
        agent: 'ego',
        action: 'tutor_response',
        direction: 'response',
        from: 'ego',
        to: 'user',
        timestamp: turnTimestamp,
        rawResponse: turn.externalMessage,
        suggestions: turn.strategy ? [{ type: turn.strategy, message: turn.externalMessage }] : [],
      });
    }
  }

  // Calculate metrics
  const metrics = rawData.interaction?.metrics || rawData.metrics || {};

  return {
    dialogueId: evalId,
    isInteractionEval: true,
    scenarioId: rawData.scenarioId,
    scenarioName: rawData.scenarioName,
    personaId: rawData.personaId,
    startTime,
    endTime: turns.length > 0 ? (turns[turns.length - 1].timestamp || startTime) : startTime,
    entryCount: entries.length,
    entries,
    summary: {
      egoCount: entries.filter(e => e.agent === 'ego').length,
      superegoCount: entries.filter(e => e.agent === 'superego').length,
      userCount: entries.filter(e => e.agent === 'user').length,
      totalTurns: turns.length,
      totalLatencyMs: metrics.totalLatencyMs || 0,
      totalInputTokens: (metrics.learnerInputTokens || 0) + (metrics.tutorInputTokens || 0),
      totalOutputTokens: (metrics.learnerOutputTokens || 0) + (metrics.tutorOutputTokens || 0),
    },
    // Include sequence diagram and formatted transcript from the interaction eval
    sequenceDiagram: rawData.sequenceDiagram,
    formattedTranscript: rawData.formattedTranscript,
    // Include judge evaluation if present
    judgeEvaluation: rawData.judgeEvaluation,
  };
}

/**
 * Format a raw dialogue JSON file (from tutor-dialogues folder) into the expected structure
 * This handles files where dialogueTrace may be empty but finalReview/suggestions exist
 */
function formatRawDialogueFile(rawData, dialogueId, timestamp) {
  const entries = [];
  const startTime = new Date(timestamp).toISOString();

  // If dialogueTrace has entries, use them
  if (rawData.dialogueTrace && rawData.dialogueTrace.length > 0) {
    for (const trace of rawData.dialogueTrace) {
      entries.push({
        agent: trace.agent,
        action: trace.action,
        timestamp: trace.timestamp || startTime,
        latencyMs: trace.latencyMs,
        provider: trace.provider,
        model: trace.model || trace.metrics?.model,
        suggestions: trace.suggestions,
        verdict: trace.verdict,
        preAnalysis: trace.preAnalysis,
        inputTokens: trace.inputTokens || trace.metrics?.inputTokens,
        outputTokens: trace.outputTokens || trace.metrics?.outputTokens,
        cost: trace.cost || trace.metrics?.cost,
        // Flow direction fields - critical for dialogue flow visualization
        from: trace.from,
        to: trace.to,
        direction: trace.direction,
        // User context fields
        rawContext: trace.rawContext,
        contextData: trace.contextData,
        // Preserve full output for debugging
        output: trace.output,
      });
    }
  }

  // Synthesize entries from top-level data if trace is empty
  if (entries.length === 0) {
    // Calculate ego's share of tokens (if superego used some, estimate 60% for ego)
    const totalIn = rawData.metrics?.totalInputTokens || 0;
    const totalOut = rawData.metrics?.totalOutputTokens || 0;
    const superegoIn = rawData.finalReview?.metrics?.inputTokens || 0;
    const superegoOut = rawData.finalReview?.metrics?.outputTokens || 0;
    const egoIn = Math.max(0, totalIn - superegoIn);
    const egoOut = Math.max(0, totalOut - superegoOut);

    // Add ego generation entry
    if (rawData.suggestions && rawData.suggestions.length > 0) {
      entries.push({
        agent: 'ego',
        action: 'generate',
        timestamp: startTime,
        suggestions: rawData.suggestions,
        provider: rawData.metrics?.provider,
        model: rawData.metrics?.model,
        latencyMs: rawData.metrics?.totalLatencyMs ? Math.round(rawData.metrics.totalLatencyMs * 0.6) : undefined,
        metrics: {
          inputTokens: egoIn,
          outputTokens: egoOut,
          provider: rawData.metrics?.provider,
          model: rawData.metrics?.model,
          cost: rawData.metrics?.totalCost,
          generationIds: rawData.metrics?.generationIds,
        },
      });
    }

    // Add superego review entry if finalReview exists
    if (rawData.finalReview) {
      entries.push({
        agent: 'superego',
        action: 'review',
        timestamp: startTime,
        verdict: {
          approved: rawData.finalReview.approved,
          feedback: rawData.finalReview.feedback,
          suggestedChanges: rawData.finalReview.suggestedChanges,
          learnerInsight: rawData.finalReview.learnerInsight,
          pedagogicalPrinciple: rawData.finalReview.pedagogicalPrinciple,
          interventionType: rawData.finalReview.interventionType,
          confidence: rawData.finalReview.confidence,
        },
        provider: rawData.finalReview.metrics?.provider,
        model: rawData.finalReview.metrics?.model,
        latencyMs: rawData.finalReview.metrics?.latencyMs,
        metrics: {
          inputTokens: rawData.finalReview.metrics?.inputTokens,
          outputTokens: rawData.finalReview.metrics?.outputTokens,
          provider: rawData.finalReview.metrics?.provider,
          model: rawData.finalReview.metrics?.model,
          latencyMs: rawData.finalReview.metrics?.latencyMs,
          cost: rawData.finalReview.metrics?.cost,
          generationId: rawData.finalReview.metrics?.generationId,
        },
      });
    }

    // Add final output entry
    entries.push({
      agent: 'user',
      action: 'final_output',
      timestamp: startTime,
      suggestions: rawData.suggestions,
      suggestionCount: rawData.suggestions?.length || 0,
      converged: rawData.converged,
    });
  }

  return {
    dialogueId,
    startTime,
    endTime: startTime,
    entryCount: entries.length,
    entries,
    summary: {
      egoCount: entries.filter(e => e.agent === 'ego').length,
      superegoCount: entries.filter(e => e.agent === 'superego').length,
      totalSuggestions: rawData.suggestions?.length || 0,
      approvedCount: rawData.finalReview?.approved ? 1 : 0,
      revisedCount: rawData.rounds > 1 ? rawData.rounds - 1 : 0,
      totalLatencyMs: rawData.metrics?.totalLatencyMs || 0,
      totalInputTokens: rawData.metrics?.totalInputTokens || 0,
      totalOutputTokens: rawData.metrics?.totalOutputTokens || 0,
      totalCost: rawData.metrics?.totalCost || 0,
    },
    converged: rawData.converged,
    rounds: rawData.rounds,
    profileName: rawData.profileName,
  };
}

export default {
  listLogDates,
  getApiLogEntries,
  groupIntoDialogues,
  parseEgoResponse,
  parseSuperegoResponse,
  parsePreAnalysisResponse,
  detectSuperegoResponseType,
  formatLogEntry,
  formatDialogue,
  summarizeDialogue,
  getDialogues,
  getDialogueByIndex,
  getDialogueById,
  getLogStatistics,
};
