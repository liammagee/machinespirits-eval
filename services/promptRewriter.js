/**
 * Prompt Rewriter Service
 *
 * Template-based directive synthesizer for dynamic prompt rewriting.
 * Analyzes turn results, dialogue traces, and conversation history to
 * generate session-specific directives that are prepended to context.
 *
 * No extra LLM calls — fully deterministic and cheap.
 */

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
