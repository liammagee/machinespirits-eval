/**
 * Prompt Rewriter Service
 *
 * Synthesizes session evolution directives for dynamic prompt rewriting.
 * Two strategies available:
 *
 * 1. Template-based (synthesizeDirectives): Deterministic, cheap, pattern-matching
 * 2. LLM-based (synthesizeDirectivesLLM): Uses superego model for rich, contextual directives
 *
 * Both analyze turn results, dialogue traces, and conversation history to
 * generate session-specific directives that are prepended to ego's system prompt.
 */

import { unifiedAIProvider } from '@machinespirits/tutor-core';

/**
 * Synthesize directives from accumulated turn data.
 *
 * @param {Object} options
 * @param {Array} options.turnResults - Results from previous turns
 * @param {Array} options.consolidatedTrace - Full dialogue trace so far
 * @param {Array} options.conversationHistory - Conversation history entries
 * @returns {string|null} XML directive block to prepend, or null if no directives
 */
export function synthesizeDirectives({ turnResults = [], consolidatedTrace = [], conversationHistory = [] }) {
  if (turnResults.length === 0) return null;

  const directives = [];

  // 1. Score trajectory — detect quality decline
  const scoreTrajectory = analyzeScoreTrajectory(turnResults);
  if (scoreTrajectory) directives.push(scoreTrajectory);

  // 2. Superego feedback — extract last critique
  const superegoFeedback = extractSuperegoFeedback(consolidatedTrace, turnResults.length);
  if (superegoFeedback) directives.push(superegoFeedback);

  // 3. Learner question detection
  const learnerQuestions = detectLearnerQuestions(conversationHistory);
  if (learnerQuestions) directives.push(learnerQuestions);

  // 4. Strategy stagnation — repeated suggestion types
  const stagnation = detectStrategyStagnation(turnResults);
  if (stagnation) directives.push(stagnation);

  // 5. Recognition signals — learner contributions to build on
  const recognitionSignals = detectRecognitionSignals(conversationHistory, turnResults);
  if (recognitionSignals) directives.push(recognitionSignals);

  if (directives.length === 0) return null;

  const numbered = directives.map((d, i) => `${i + 1}. ${d}`).join('\n');
  return `<session_evolution>
Based on the dialogue so far, prioritize the following in your next response:

${numbered}
</session_evolution>`;
}

/**
 * Analyze score trajectory across turns. If quality decreased, generate directive.
 */
function analyzeScoreTrajectory(turnResults) {
  if (turnResults.length < 2) return null;

  const scores = turnResults.filter(t => t.turnScore !== null && t.turnScore !== undefined).map(t => t.turnScore);
  if (scores.length < 2) return null;

  const last = scores[scores.length - 1];
  const prev = scores[scores.length - 2];
  const delta = last - prev;

  if (delta < -5) {
    // Find what scored well in the earlier turn
    const bestPrevDim = findBestDimension(turnResults[turnResults.length - 2]);
    const worstCurrDim = findWorstDimension(turnResults[turnResults.length - 1]);

    let directive = `Quality declined from the previous turn (${prev.toFixed(0)} → ${last.toFixed(0)}).`;
    if (bestPrevDim) directive += ` Your ${bestPrevDim} was strongest before — maintain that approach.`;
    if (worstCurrDim) directive += ` Focus on improving ${worstCurrDim}.`;
    return directive;
  }

  return null;
}

/**
 * Extract the most recent superego feedback from the dialogue trace.
 */
function extractSuperegoFeedback(consolidatedTrace, turnCount) {
  if (!consolidatedTrace || consolidatedTrace.length === 0) return null;

  // Find the last superego entry from the most recent turn
  const superegoEntries = consolidatedTrace.filter(
    entry => entry.agent === 'superego' && entry.action !== 'deliberation'
  );

  if (superegoEntries.length === 0) return null;

  const lastEntry = superegoEntries[superegoEntries.length - 1];
  const feedback = lastEntry.contextSummary || lastEntry.detail;
  if (!feedback) return null;

  // Look for rejection or revision feedback
  const detail = lastEntry.detail || '';
  const isRejection = detail.includes('"approved": false') || detail.includes('"approved":false');
  const hasRevisions = detail.includes('"specificRevisions"') || detail.includes('"revise"');

  if (isRejection || hasRevisions) {
    // Extract the feedback text
    const feedbackMatch = detail.match(/"feedback"\s*:\s*"([^"]+)"/);
    if (feedbackMatch) {
      return `The internal critic flagged an issue in your last response: "${feedbackMatch[1].substring(0, 150)}". Address this concern in your next suggestion.`;
    }
    return `The internal critic requested revisions on your last response. Ensure your next suggestion addresses its feedback.`;
  }

  return null;
}

/**
 * Detect if the learner asked direct questions that need answering.
 */
function detectLearnerQuestions(conversationHistory) {
  if (conversationHistory.length === 0) return null;

  const lastEntry = conversationHistory[conversationHistory.length - 1];
  const message = lastEntry.learnerMessage || '';

  if (!message) return null;

  // Check for question marks or question-like patterns
  const hasQuestionMark = message.includes('?');
  const hasQuestionWords = /\b(what|why|how|when|where|which|can|could|would|should|do|does|is|are)\b/i.test(message);

  if (hasQuestionMark || (hasQuestionWords && message.length > 20)) {
    // Extract the likely question
    const sentences = message.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const questions = sentences.filter(s => s.includes('?') || /^\s*(what|why|how|when|where|which)\b/i.test(s));

    if (questions.length > 0) {
      const firstQuestion = questions[0].trim().substring(0, 120);
      return `The learner asked a direct question: "${firstQuestion}". Your response must address this question specifically before suggesting new content.`;
    }
  }

  return null;
}

/**
 * Detect if the tutor is repeating the same suggestion strategy.
 */
function detectStrategyStagnation(turnResults) {
  if (turnResults.length < 3) return null;

  const recentTypes = turnResults.slice(-3).map(t => t.suggestion?.type).filter(Boolean);
  if (recentTypes.length < 3) return null;

  const allSame = recentTypes.every(t => t === recentTypes[0]);
  if (allSame) {
    return `You have suggested "${recentTypes[0]}" type content for the last ${recentTypes.length} turns. Consider varying your approach — try a different suggestion type (e.g., reflection, simulation, review) to maintain engagement.`;
  }

  // Check if action targets are too similar (same lecture family)
  const recentTargets = turnResults.slice(-3).map(t => t.suggestion?.actionTarget).filter(Boolean);
  if (recentTargets.length >= 3) {
    const targetPrefixes = recentTargets.map(t => t.split('-').slice(0, 2).join('-'));
    if (targetPrefixes.every(p => p === targetPrefixes[0])) {
      return `Your last ${recentTargets.length} suggestions all pointed to the same course section. Consider broadening — connect to related content in other courses or suggest a different modality (simulation, journal, text analysis).`;
    }
  }

  return null;
}

/**
 * Detect recognition signals from the learner worth building on.
 */
function detectRecognitionSignals(conversationHistory, turnResults) {
  if (conversationHistory.length === 0) return null;

  const lastEntry = conversationHistory[conversationHistory.length - 1];
  const message = lastEntry.learnerMessage || '';
  if (!message) return null;

  const signals = [];

  // Check for learner offering their own interpretation/metaphor
  const interpretationPatterns = [
    /\bi think\b/i,
    /\bit seems like\b/i,
    /\bmaybe\s+it['']?s\b/i,
    /\bwhat if\b/i,
    /\bkind of like\b/i,
    /\bsort of like\b/i,
    /\breminds me of\b/i,
    /\bis like\b/i,
  ];

  const hasInterpretation = interpretationPatterns.some(p => p.test(message));
  if (hasInterpretation) {
    signals.push('offered their own interpretation');
  }

  // Check for learner pushback / critique
  const pushbackPatterns = [
    /\bbut\s+(what about|doesn['']t|isn['']t|that doesn['']t)\b/i,
    /\bi disagree\b/i,
    /\bi don['']t think\b/i,
    /\bthat['']s not\b/i,
    /\bdoesn['']t (apply|work|make sense)\b/i,
  ];

  const hasPushback = pushbackPatterns.some(p => p.test(message));
  if (hasPushback) {
    signals.push('pushed back with a substantive critique');
  }

  // Check for concept connections
  const connectionPatterns = [
    /\bconnects to\b/i,
    /\brelated to\b/i,
    /\bsimilar to\b/i,
    /\bjust like\b/i,
    /\bthis is like\b/i,
  ];

  const hasConnection = connectionPatterns.some(p => p.test(message));
  if (hasConnection) {
    signals.push('connected concepts across topics');
  }

  if (signals.length === 0) return null;

  const signalList = signals.join(', ');
  const snippet = message.substring(0, 100);
  return `The learner ${signalList} ("${snippet}..."). Build on their contribution — acknowledge their specific language and develop it further rather than redirecting.`;
}

/**
 * Find the best-scoring dimension for a turn result.
 */
function findBestDimension(turnResult) {
  if (!turnResult?.scores) return null;
  let best = null;
  let bestScore = -Infinity;
  for (const [dim, score] of Object.entries(turnResult.scores)) {
    if (score != null && score > bestScore) {
      bestScore = score;
      best = dim;
    }
  }
  return best;
}

/**
 * Find the worst-scoring dimension for a turn result.
 */
function findWorstDimension(turnResult) {
  if (!turnResult?.scores) return null;
  let worst = null;
  let worstScore = Infinity;
  for (const [dim, score] of Object.entries(turnResult.scores)) {
    if (score != null && score < worstScore) {
      worstScore = score;
      worst = dim;
    }
  }
  return worst;
}

// ============================================================================
// LLM-Based Directive Synthesis
// ============================================================================

/**
 * Synthesize directives using an LLM for contextually rich evolution guidance.
 *
 * Unlike the template-based approach, this uses the superego model to analyze
 * the full dialogue context and generate targeted, non-generic directives.
 *
 * @param {Object} options
 * @param {Array} options.turnResults - Results from previous turns
 * @param {Array} options.consolidatedTrace - Full dialogue trace so far
 * @param {Array} options.conversationHistory - Conversation history entries
 * @param {Object} options.config - Profile config containing model info
 * @returns {Promise<string|null>} XML directive block to prepend, or null if synthesis fails
 */
export async function synthesizeDirectivesLLM({
  turnResults = [],
  consolidatedTrace = [],
  conversationHistory = [],
  config = {},
}) {
  if (turnResults.length === 0) return null;

  // Build context summary for the LLM
  const contextSummary = buildContextSummaryForLLM(turnResults, consolidatedTrace, conversationHistory);

  // Determine model to use (superego model from profile, or fallback)
  const superegoModel = config.superego?.model || 'moonshotai/kimi-k2.5';
  const provider = config.superego?.provider || 'openrouter';

  const systemPrompt = `You are a pedagogical analyst reviewing an ongoing tutoring dialogue. Your task is to synthesize 2-5 specific, actionable directives that will help the tutor improve in the next turn.

CRITICAL RULES:
- Directives must be SPECIFIC to this dialogue — reference actual learner statements, scores, and patterns
- Avoid generic advice like "be more engaging" or "personalize responses"
- Each directive should address a concrete issue or opportunity observed in the data
- Directives should build on what's working, not just fix problems
- If the dialogue is going well, focus on deepening rather than correcting

OUTPUT FORMAT:
Return ONLY a numbered list of 2-5 directives, one per line. No preamble, no explanation after.

Example output:
1. The learner's analogy comparing dialectics to "debugging code" in turn 2 shows technical framing — extend this metaphor when introducing Aufhebung.
2. Score trajectory shows personalization dropping (87→71). The last response addressed "students" generally — use the learner's name and reference their earlier question about AI ethics.
3. Superego flagged lack of curriculum grounding. The learner is exploring emergence — connect to 479-lecture-5 which covers complexity and emergent properties.`;

  const userMessage = `Analyze this tutoring dialogue and generate evolution directives:

${contextSummary}

Generate 2-5 specific directives for the next turn:`;

  try {
    const response = await unifiedAIProvider.call({
      provider,
      model: superegoModel,
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      preset: 'deliberation',
      config: {
        temperature: 0.3, // Lower temp for focused analysis
        maxTokens: 500,
      },
    });

    const directives = response.content?.trim();
    if (!directives || directives.length < 20) {
      console.log('[promptRewriter] LLM returned empty or too-short directives');
      return null;
    }

    // Wrap in session_evolution XML block
    return `<session_evolution>
Based on analysis of the dialogue so far, prioritize the following in your next response:

${directives}
</session_evolution>`;
  } catch (error) {
    console.error('[promptRewriter] LLM directive synthesis failed:', error.message);
    // Fallback to template-based directives
    return synthesizeDirectives({ turnResults, consolidatedTrace, conversationHistory });
  }
}

/**
 * Build a structured context summary for the LLM to analyze.
 */
function buildContextSummaryForLLM(turnResults, consolidatedTrace, conversationHistory) {
  const parts = [];

  // 1. Score trajectory
  const scores = turnResults
    .filter(t => t.turnScore !== null && t.turnScore !== undefined)
    .map((t, i) => `Turn ${i + 1}: ${t.turnScore.toFixed(1)}`);
  if (scores.length > 0) {
    parts.push(`## Score Trajectory\n${scores.join(' → ')}`);
  }

  // 2. Dimension breakdown for last turn
  const lastTurn = turnResults[turnResults.length - 1];
  if (lastTurn?.scores) {
    const dimScores = Object.entries(lastTurn.scores)
      .filter(([_, v]) => v != null)
      .map(([k, v]) => `  - ${k}: ${v}`)
      .join('\n');
    if (dimScores) {
      parts.push(`## Last Turn Dimension Scores\n${dimScores}`);
    }
  }

  // 3. Superego feedback from trace
  const superegoFeedback = consolidatedTrace
    .filter(e => e.agent === 'superego')
    .slice(-3) // Last 3 superego entries
    .map(e => {
      const summary = e.contextSummary || '';
      const detail = e.detail || '';
      // Extract key feedback
      const feedbackMatch = detail.match(/"feedback"\s*:\s*"([^"]+)"/);
      return feedbackMatch ? feedbackMatch[1].substring(0, 200) : summary.substring(0, 200);
    })
    .filter(Boolean);
  if (superegoFeedback.length > 0) {
    parts.push(`## Recent Superego Feedback\n${superegoFeedback.map((f, i) => `${i + 1}. ${f}`).join('\n')}`);
  }

  // 4. Conversation history (learner messages)
  const learnerMsgs = conversationHistory
    .filter(h => h.learnerMessage)
    .slice(-3) // Last 3 learner messages
    .map((h, i) => `Turn ${h.turnIndex + 1}: "${h.learnerMessage.substring(0, 150)}${h.learnerMessage.length > 150 ? '...' : ''}"`);
  if (learnerMsgs.length > 0) {
    parts.push(`## Recent Learner Messages\n${learnerMsgs.join('\n')}`);
  }

  // 5. Tutor suggestion types
  const suggTypes = turnResults
    .filter(t => t.suggestion?.type)
    .map((t, i) => `Turn ${i + 1}: ${t.suggestion.type}${t.suggestion.actionTarget ? ` (${t.suggestion.actionTarget})` : ''}`);
  if (suggTypes.length > 0) {
    parts.push(`## Tutor Suggestion Types\n${suggTypes.join('\n')}`);
  }

  // 6. Learner emotional state if available
  const emotionalStates = turnResults
    .filter(t => t.learnerEmotionalState)
    .map((t, i) => `Turn ${i + 1}: ${t.learnerEmotionalState}`);
  if (emotionalStates.length > 0) {
    parts.push(`## Learner Emotional States\n${emotionalStates.join('\n')}`);
  }

  return parts.join('\n\n');
}
