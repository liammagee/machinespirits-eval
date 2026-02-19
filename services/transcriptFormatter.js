/**
 * Transcript Formatter
 *
 * Pure formatting module — takes a consolidatedTrace array and returns
 * human-readable text in a play/dramaturgical format.
 *
 * Modes:
 *   play          Full dramaturgical format with asides, reflections, and metadata
 *   compact       Turn headers + final messages + superego verdicts (with metadata)
 *   messages-only Just the learner↔tutor exchange
 *   full          Like play but includes raw metrics, token counts, model info per entry
 *   bilateral     Dialogue-turn-level grouping for multi-turn bilateral traces:
 *                 splits on final_output boundaries, shows tutor then learner
 *                 deliberation within each dialogue turn
 */

const DEFAULT_WIDTH = 72;
const INDENT = '    ';
const ASIDE_INDENT = '        ';

/**
 * Word-wrap text to a given width, respecting existing line breaks.
 */
export function wrapText(text, indent = '', maxWidth = DEFAULT_WIDTH) {
  if (!text) return '';
  const effectiveWidth = maxWidth - indent.length;
  if (effectiveWidth < 20) return indent + text;

  const lines = text.split('\n');
  const wrapped = [];

  for (const line of lines) {
    if (line.trim() === '') {
      wrapped.push('');
      continue;
    }
    const words = line.split(/\s+/);
    let current = '';
    for (const word of words) {
      if (current.length + word.length + 1 > effectiveWidth && current.length > 0) {
        wrapped.push(indent + current);
        current = word;
      } else {
        current = current ? current + ' ' + word : word;
      }
    }
    if (current) wrapped.push(indent + current);
  }

  return wrapped.join('\n');
}

/**
 * Format a short model alias from a full model string.
 * e.g. "nvidia/nemotron-3-nano-30b-a3b:free" → "nemotron-3-nano"
 *      "moonshot-ai/kimi-k2.5" → "kimi-k2.5"
 */
function shortModel(model) {
  if (!model) return null;
  // Strip provider prefix (openrouter/...)
  const name = model.includes('/') ? model.split('/').pop() : model;
  // Strip :free, :extended suffixes
  const base = name.split(':')[0];
  // Truncate to keep readable (max ~20 chars)
  return base.length > 22 ? base.substring(0, 20) + '..' : base;
}

/**
 * Format latency in human-readable form.
 */
function formatLatency(ms) {
  if (ms == null) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Format token count compactly.
 */
function formatTokens(input, output) {
  if (input == null && output == null) return null;
  const parts = [];
  if (input != null) parts.push(`${input}in`);
  if (output != null) parts.push(`${output}out`);
  return parts.join('/');
}

/**
 * Format cost compactly.
 */
function formatCost(cost) {
  if (cost == null || cost === 0) return null;
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(3)}`;
}

/**
 * Build a metadata subtitle line from a trace entry's metrics.
 * Returns null if no metadata is available.
 *
 * Tutor-core entries have: metrics.{model, inputTokens, outputTokens, latencyMs, cost}
 * EvaluationRunner entries have: timestamp (but no metrics)
 */
function buildMetadataLine(entry, detail) {
  // messages-only mode: no metadata
  if (detail === 'messages-only') return null;

  const m = entry.metrics || {};
  const parts = [];

  const model = shortModel(m.model);
  if (model) parts.push(model);

  const tokens = formatTokens(m.inputTokens, m.outputTokens);
  if (tokens) parts.push(tokens);

  const latency = formatLatency(m.latencyMs ?? entry.latencyMs);
  if (latency) parts.push(latency);

  const cost = formatCost(m.cost);
  if (cost) parts.push(cost);

  if (parts.length === 0) return null;
  return parts.join(' \u00b7 '); // middle dot separator
}

/**
 * Map a trace entry's agent:action to a readable speaker label.
 */
function getSpeakerLabel(entry) {
  const { agent, action } = entry;

  // Learner-related entries
  if (agent === 'user' && action === 'turn_action') return 'LEARNER';
  if (agent === 'learner_ego' && action === 'deliberation') return 'LEARNER EGO';
  if (agent === 'learner_superego' && action === 'deliberation') return 'LEARNER SUPEREGO';
  if (agent === 'learner_synthesis' && action === 'response') return 'LEARNER';

  // Tutor ego/superego
  if (agent === 'ego' && action === 'generate') return 'TUTOR EGO (draft)';
  if (agent === 'superego' && action === 'review') return 'SUPEREGO';
  if (agent === 'ego' && action === 'revise') return 'TUTOR EGO (revised)';
  if (agent === 'ego' && action === 'generate_final') return 'TUTOR EGO';

  // Self-reflections
  if (agent === 'ego_self_reflection') return 'EGO';
  if (agent === 'superego_self_reflection') return 'SUPEREGO';
  if (agent === 'superego_disposition') return 'SUPEREGO';
  if (agent === 'ego_intersubjective') return 'EGO';

  // Profiling
  if (agent === 'tutor_other_ego') return 'TUTOR';
  if (agent === 'learner_other_ego') return 'LEARNER';
  if (agent === 'ego_strategy') return 'EGO';

  // System/meta
  if (agent === 'behavioral_overrides') return 'SYSTEM';
  if (agent === 'rejection_budget') return 'SYSTEM';
  if (agent === 'user' && action === 'context_input') return 'CONTEXT';
  if (agent === 'user' && action === 'final_output') return null; // skip in output

  return (agent || 'UNKNOWN').toUpperCase();
}

/**
 * Get a stage direction for the entry (shown in brackets before content).
 */
function getStageDirection(entry) {
  const { agent, action } = entry;

  if (agent === 'superego' && action === 'review') {
    return entry.approved ? '[aside, to Ego \u2014 APPROVED]' : '[aside, to Ego]';
  }
  if (agent === 'ego_self_reflection' && action === 'rewrite') return '[reflecting]';
  if (agent === 'superego_self_reflection' && action === 'rewrite') return '[reflecting]';
  if (agent === 'superego_disposition' && action === 'rewrite') return '[evolving disposition]';
  if (agent === 'ego_intersubjective' && action === 'respond_to_critic') return '[responding to critic]';
  if (agent === 'tutor_other_ego' && action === 'profile_learner') return '[profiling learner]';
  if (agent === 'learner_other_ego' && action === 'profile_tutor') return '[profiling tutor]';
  if (agent === 'ego_strategy' && action === 'plan') return '[planning strategy]';
  if (agent === 'learner_ego' && action === 'deliberation') return '[internal]';
  if (agent === 'learner_superego' && action === 'deliberation') return '[internal]';
  if (agent === 'behavioral_overrides') return '[system]';
  if (agent === 'rejection_budget') return '[system]';

  return null;
}

/**
 * Extract the displayable content from a trace entry.
 */
function getEntryContent(entry) {
  const { agent, action } = entry;

  // Superego review: show feedback + verdict
  if (agent === 'superego' && action === 'review') {
    const feedback = entry.feedback || entry.verdict?.feedback || '';
    const verdict = entry.approved ? '' : '\n[REVISE]';
    return feedback + verdict;
  }

  // Generation entries: extract suggestion message text
  if ((action === 'generate' || action === 'revise' || action === 'generate_final') && entry.suggestions?.length > 0) {
    return entry.suggestions.map((s) => s.message || s.text || s.title || JSON.stringify(s)).join('\n\n');
  }

  // Learner turn action
  if (agent === 'user' && action === 'turn_action') {
    return entry.contextSummary || entry.detail || '';
  }

  // Context input
  if (agent === 'user' && action === 'context_input') {
    const ctx = entry.contextData || {};
    const parts = [];
    if (ctx.currentPage) parts.push(ctx.currentPage.replace(/^\*+:\s*/, ''));
    if (ctx.strugglesCount) parts.push(`${ctx.strugglesCount} struggle signals`);
    if (ctx.sessions) parts.push(`${ctx.sessions} prior sessions`);
    // Extract the learner's message from rawContext if present
    const raw = entry.rawContext || '';
    const msgMatch =
      raw.match(/Learner Messages?:\s*(.+?)(?:\n<\/|$)/s) || raw.match(/Recent Chat History\n-\s*User:\s*"(.+?)"/s);
    if (msgMatch) {
      const contextLine = parts.length ? parts.join(', ') : '';
      return (contextLine ? contextLine + '\n\n' : '') + 'Learner: ' + msgMatch[1].trim();
    }
    return parts.length ? parts.join(', ') : entry.contextSummary || '(scenario input)';
  }

  // Reflection/rewrite entries
  if (
    action === 'rewrite' ||
    action === 'respond_to_critic' ||
    action === 'profile_learner' ||
    action === 'profile_tutor' ||
    action === 'plan'
  ) {
    return entry.detail || entry.contextSummary || '';
  }

  // Learner deliberation
  if (action === 'deliberation' || action === 'response') {
    return entry.detail || entry.contextSummary || '';
  }

  // System entries
  if (agent === 'behavioral_overrides' || agent === 'rejection_budget') {
    return entry.contextSummary || entry.detail || '';
  }

  // Fallback
  return entry.detail || entry.contextSummary || entry.content || entry.message || '';
}

/**
 * Determine if an entry is a "between-turn" reflection (intermission material).
 */
function isReflectionEntry(entry) {
  const reflectionAgents = new Set([
    'ego_self_reflection',
    'superego_self_reflection',
    'superego_disposition',
    'ego_intersubjective',
    'behavioral_overrides',
    'rejection_budget',
    'tutor_other_ego',
    'learner_other_ego',
    'ego_strategy',
  ]);
  return reflectionAgents.has(entry.agent);
}

/**
 * Check if an entry should be shown in compact mode.
 */
function isCompactVisible(entry) {
  const { agent, action } = entry;
  // Show: learner messages, final tutor output, superego verdicts
  if (agent === 'user' && action === 'turn_action') return true;
  if (action === 'revise' || action === 'generate_final') return true;
  if (agent === 'ego' && action === 'generate' && !entry._hasRevision) return true;
  if (agent === 'superego' && action === 'review') return true;
  if (agent === 'user' && action === 'final_output') return false;
  return false;
}

/**
 * Check if an entry should be shown in messages-only mode.
 */
function isMessageVisible(entry) {
  const { agent, action } = entry;
  if (agent === 'user' && action === 'turn_action') return true;
  if (action === 'revise') return true;
  if (agent === 'ego' && action === 'generate' && !entry._hasRevision) return true;
  if (agent === 'learner_synthesis' && action === 'response') return true;
  return false;
}

/**
 * Format a single trace entry.
 */
export function formatEntry(entry, options = {}) {
  const { detail = 'play' } = options;
  const speaker = getSpeakerLabel(entry);
  if (!speaker) return null;

  const direction = getStageDirection(entry);
  const content = getEntryContent(entry);
  if (!content && !direction) return null;

  const lines = [];

  // Speaker name
  lines.push(INDENT + speaker);

  // Metadata subtitle (model, tokens, time, cost) — shown in play, compact, full modes
  const metaLine = buildMetadataLine(entry, detail);
  if (metaLine) {
    lines.push(INDENT + '  ' + metaLine);
  }

  // Stage direction
  if (direction && detail !== 'messages-only') {
    lines.push(ASIDE_INDENT + direction);
  }

  // Content
  if (content) {
    const indent = direction ? ASIDE_INDENT : INDENT;
    lines.push(wrapText(content, indent, DEFAULT_WIDTH));
  }

  // Full mode: add raw timestamp and additional detail
  if (detail === 'full') {
    const extra = [];
    if (entry.timestamp) extra.push(`time=${entry.timestamp}`);
    if (entry.metrics?.generationId) extra.push(`gen=${entry.metrics.generationId}`);
    if (entry.metrics?.finishReason) extra.push(`finish=${entry.metrics.finishReason}`);
    if (extra.length > 0) {
      lines.push(ASIDE_INDENT + `[${extra.join(', ')}]`);
    }
  }

  return lines.join('\n');
}

/**
 * Format a full transcript from a consolidated trace array.
 *
 * @param {Array} trace - The consolidatedTrace array
 * @param {Object} options
 * @param {string} options.detail - 'play' | 'compact' | 'messages-only' | 'full' | 'bilateral'
 * @param {string} options.scenarioName - Scenario title for the header
 * @param {string} options.profileName - Cell/profile name
 * @param {number} options.totalTurns - Total number of dialogue turns
 * @returns {string} Formatted transcript text
 */
export function formatTranscript(trace, options = {}) {
  const { detail = 'play', scenarioName = '', profileName = '', totalTurns = 0 } = options;

  if (!trace || trace.length === 0) return '(empty trace)\n';

  // Bilateral mode uses dialogue-turn-level grouping instead of turnIndex
  if (detail === 'bilateral') {
    return formatBilateralTranscript(trace, options);
  }

  // Pre-process: mark entries that have a revision following them
  const processed = trace.map((entry, i) => {
    const copy = { ...entry };
    if (entry.agent === 'ego' && entry.action === 'generate') {
      // Check if a revision follows within the same turn
      const hasRevision = trace
        .slice(i + 1)
        .some(
          (e) =>
            e.turnIndex === entry.turnIndex &&
            e.agent === 'ego' &&
            (e.action === 'revise' || e.action === 'generate_final'),
        );
      copy._hasRevision = hasRevision;
    }
    return copy;
  });

  const lines = [];

  // Header
  const center = (text) => {
    const pad = Math.max(0, Math.floor((DEFAULT_WIDTH - text.length) / 2));
    return ' '.repeat(pad) + text;
  };

  if (scenarioName || profileName) {
    lines.push('');
    if (scenarioName) {
      const titleLine =
        totalTurns > 0 ? `${scenarioName.toUpperCase()} (${totalTurns}-turn)` : scenarioName.toUpperCase();
      lines.push(center(titleLine));
    }
    if (profileName) lines.push(center(profileName));
    lines.push(center('\u2500'.repeat(Math.min(DEFAULT_WIDTH - 10, 40))));
    lines.push('');
  }

  // Group entries by turnIndex
  const turnGroups = new Map();
  for (const entry of processed) {
    const ti = entry.turnIndex ?? 0;
    if (!turnGroups.has(ti)) turnGroups.set(ti, []);
    turnGroups.get(ti).push(entry);
  }

  const sortedTurns = [...turnGroups.keys()].sort((a, b) => a - b);

  for (const turnIdx of sortedTurns) {
    const entries = turnGroups.get(turnIdx);

    // ACT header
    lines.push('');
    lines.push(center(`ACT ${turnIdx + 1}`));
    lines.push('');

    // Separate main entries from reflections
    const mainEntries = entries.filter((e) => !isReflectionEntry(e));
    const reflections = entries.filter((e) => isReflectionEntry(e));

    // Main entries
    for (const entry of mainEntries) {
      // Visibility filters
      if (detail === 'compact' && !isCompactVisible(entry)) continue;
      if (detail === 'messages-only' && !isMessageVisible(entry)) continue;

      const formatted = formatEntry(entry, { detail });
      if (formatted) {
        lines.push(formatted);
        lines.push('');
      }
    }

    // Reflections (intermission)
    if (reflections.length > 0 && detail !== 'messages-only') {
      if (detail !== 'compact') {
        lines.push(center('~~~ intermission ~~~'));
        lines.push('');
      }

      for (const entry of reflections) {
        if (detail === 'compact') {
          // One-liner for compact mode
          const speaker = getSpeakerLabel(entry);
          const summary = (entry.contextSummary || entry.detail || '').substring(0, 80);
          if (speaker && summary) {
            lines.push(`${INDENT}[${speaker}] ${summary}`);
            lines.push('');
          }
        } else {
          const formatted = formatEntry(entry, { detail });
          if (formatted) {
            lines.push(formatted);
            lines.push('');
          }
        }
      }
    }
  }

  return lines.join('\n');
}

/**
 * Classify a trace entry as belonging to the tutor phase or learner phase.
 */
function isTutorEntry(entry) {
  const tutorAgents = new Set([
    'ego',
    'superego',
    'ego_self_reflection',
    'superego_self_reflection',
    'superego_disposition',
    'ego_intersubjective',
    'tutor_other_ego',
    'ego_strategy',
    'behavioral_overrides',
    'rejection_budget',
  ]);
  if (tutorAgents.has(entry.agent)) return true;
  // context_input and final_output are tutor-phase bookends
  if (entry.agent === 'user' && (entry.action === 'context_input' || entry.action === 'final_output')) return true;
  // system entries (memory_cycle, etc.) belong to tutor phase
  if (entry.agent === 'system') return true;
  return false;
}

/**
 * Format a bilateral transcript: splits trace into dialogue turns using
 * final_output boundaries, then shows tutor and learner deliberation
 * sequentially within each turn.
 *
 * This gives a per-dialogue-turn view:
 *   TURN 1
 *     ── TUTOR DELIBERATION ──
 *     context_input → ego generate → superego review → ...
 *     ── LEARNER DELIBERATION ──
 *     learner_ego → learner_superego → learner_ego_revision → learner_synthesis
 *     ── LEARNER MESSAGE ──
 *     (the external turn_action)
 *   TURN 2
 *     ...
 */
function formatBilateralTranscript(trace, options = {}) {
  const { scenarioName = '', profileName = '', totalTurns = 0 } = options;

  // Pre-process: mark ego generate entries that have revisions
  const processed = trace.map((entry, i) => {
    const copy = { ...entry };
    if (entry.agent === 'ego' && entry.action === 'generate') {
      const hasRevision = trace
        .slice(i + 1)
        .some(
          (e) =>
            e.agent === 'ego' &&
            (e.action === 'revise' || e.action === 'generate_final' || e.action === 'incorporate-feedback'),
        );
      copy._hasRevision = hasRevision;
    }
    return copy;
  });

  // Split into dialogue turns.
  // Each "dialogue turn" = tutor deliberation block + learner deliberation block.
  // Tutor block ends at final_output; learner block ends at turn_action.
  // For traces without final_output (unified single-turn), fall back to
  // splitting on turn_action.
  const dialogueTurns = [];
  let currentEntries = [];

  for (const entry of processed) {
    currentEntries.push(entry);

    // turn_action marks the end of a full dialogue turn (tutor + learner)
    if (entry.agent === 'user' && entry.action === 'turn_action') {
      dialogueTurns.push(currentEntries);
      currentEntries = [];
    }
  }

  // Remaining entries after last turn_action (trailing tutor deliberation with no learner response)
  if (currentEntries.length > 0) {
    dialogueTurns.push(currentEntries);
  }

  const lines = [];

  const center = (text) => {
    const pad = Math.max(0, Math.floor((DEFAULT_WIDTH - text.length) / 2));
    return ' '.repeat(pad) + text;
  };

  // Header
  if (scenarioName || profileName) {
    lines.push('');
    if (scenarioName) {
      const titleLine =
        totalTurns > 0 ? `${scenarioName.toUpperCase()} (${totalTurns}-turn)` : scenarioName.toUpperCase();
      lines.push(center(titleLine));
    }
    if (profileName) lines.push(center(profileName));
    lines.push(center('\u2500'.repeat(Math.min(DEFAULT_WIDTH - 10, 40))));
    lines.push('');
  }

  const PHASE_LINE = '\u2500'.repeat(30);

  for (let turnNum = 0; turnNum < dialogueTurns.length; turnNum++) {
    const entries = dialogueTurns[turnNum];

    // Turn header
    lines.push('');
    lines.push(center(`TURN ${turnNum + 1}`));
    lines.push('');

    // Split entries into phases: tutor deliberation, learner deliberation, learner message
    const tutorEntries = [];
    const learnerDeliberation = [];
    let learnerMessage = null;
    const reflections = [];

    for (const entry of entries) {
      if (isReflectionEntry(entry)) {
        reflections.push(entry);
      } else if (entry.agent === 'user' && entry.action === 'turn_action') {
        learnerMessage = entry;
      } else if (isTutorEntry(entry)) {
        tutorEntries.push(entry);
      } else {
        // Learner ego/superego/synthesis deliberation
        learnerDeliberation.push(entry);
      }
    }

    // ── TUTOR DELIBERATION ──
    if (tutorEntries.length > 0) {
      lines.push(INDENT + `\u2500\u2500 TUTOR DELIBERATION ${PHASE_LINE}`);
      lines.push('');

      for (const entry of tutorEntries) {
        // Skip final_output markers (they're structural, not content)
        if (entry.agent === 'user' && entry.action === 'final_output') continue;
        // Skip repeated context_input after the first turn — it's the same scenario data re-injected
        if (entry.agent === 'user' && entry.action === 'context_input' && turnNum > 0) continue;

        const formatted = formatEntry(entry, { detail: 'play' });
        if (formatted) {
          lines.push(formatted);
          lines.push('');
        }
      }
    }

    // ── LEARNER DELIBERATION ──
    // Skip learner_synthesis — it duplicates the turn_action content shown in LEARNER MESSAGE
    const deliberationOnly = learnerDeliberation.filter(
      (e) => !(e.agent === 'learner_synthesis' && e.action === 'response'),
    );
    if (deliberationOnly.length > 0) {
      lines.push(INDENT + `\u2500\u2500 LEARNER DELIBERATION ${PHASE_LINE}`);
      lines.push('');

      for (const entry of deliberationOnly) {
        const formatted = formatEntry(entry, { detail: 'play' });
        if (formatted) {
          lines.push(formatted);
          lines.push('');
        }
      }
    }

    // ── LEARNER MESSAGE ── (the external turn_action)
    if (learnerMessage) {
      lines.push(INDENT + `\u2500\u2500 LEARNER MESSAGE ${PHASE_LINE}`);
      lines.push('');
      const formatted = formatEntry(learnerMessage, { detail: 'play' });
      if (formatted) {
        lines.push(formatted);
        lines.push('');
      }
    }

    // Between-turn reflections (intermission)
    if (reflections.length > 0) {
      lines.push(center('~~~ intermission ~~~'));
      lines.push('');
      for (const entry of reflections) {
        const formatted = formatEntry(entry, { detail: 'play' });
        if (formatted) {
          lines.push(formatted);
          lines.push('');
        }
      }
    }
  }

  return lines.join('\n');
}

/**
 * Format a single entry for incremental/streaming output (one line per event).
 * Used for live console output during runs.
 */
export function formatCompactLine(entry) {
  const speaker = getSpeakerLabel(entry);
  if (!speaker) return null;

  const { agent, action } = entry;
  const meta = buildMetadataLine(entry, 'compact');
  const metaSuffix = meta ? `  (${meta})` : '';

  // Learner message
  if (agent === 'user' && action === 'turn_action') {
    const msg = (entry.contextSummary || entry.detail || '').substring(0, 120);
    return `  [LEARNER] ${msg}`;
  }

  // Superego review
  if (agent === 'superego' && action === 'review') {
    const verdict = entry.approved ? 'APPROVED' : 'REVISE';
    const feedback = (entry.feedback || entry.verdict?.feedback || '').substring(0, 80);
    return `  [SUPEREGO ${verdict}]${metaSuffix} ${feedback}`;
  }

  // Final tutor output (revised or initial)
  if (action === 'revise' || (agent === 'ego' && action === 'generate' && !entry._hasRevision)) {
    const msg = (entry.suggestions || []).map((s) => (s.message || s.title || '').substring(0, 80)).join('; ');
    return `  [TUTOR]${metaSuffix} ${msg}`;
  }

  // Reflections (compact one-liner)
  if (isReflectionEntry(entry)) {
    const summary = (entry.contextSummary || '').substring(0, 80);
    return `  [${speaker}] ${summary}`;
  }

  return null;
}
