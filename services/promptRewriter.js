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
import * as evalConfigLoader from './evalConfigLoader.js';

/**
 * Extract a compact metrics object from a unifiedAIProvider response.
 * These metrics are attached to consolidatedTrace entries so the
 * transcript formatter can display model/tokens/latency/cost per call.
 */
function extractMetrics(response) {
  if (!response) return null;
  return {
    model: response.model || null,
    provider: response.provider || null,
    inputTokens: response.usage?.inputTokens || 0,
    outputTokens: response.usage?.outputTokens || 0,
    latencyMs: response.latencyMs || 0,
    cost: response.usage?.cost || 0,
  };
}

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

  // 0. Phase-aware framing — tell the ego where we are in the dialogue arc
  const phaseDirective = detectDialoguePhase(turnResults, conversationHistory);
  if (phaseDirective) directives.push(phaseDirective);

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

  // 6. Learner resistance detection — explicit resistance patterns
  const resistance = detectLearnerResistance(conversationHistory, turnResults);
  if (resistance) directives.push(resistance);

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
function extractSuperegoFeedback(consolidatedTrace, _turnCount) {
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
function detectRecognitionSignals(conversationHistory, _turnResults) {
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

/**
 * Detect dialogue phase and generate phase-appropriate framing.
 * Phases: exploration (turns 1-2), adaptation (turns 3-4 or resistance detected),
 * breakthrough (turns 5+ or strong resistance).
 */
function detectDialoguePhase(turnResults, conversationHistory) {
  const turnCount = turnResults.length;

  // Detect resistance strength from recent messages
  let resistanceStrength = 0;
  const recentMessages = conversationHistory.slice(-2).map(h => h.learnerMessage || '');

  for (const msg of recentMessages) {
    if (/i('m| am) (still )?(confused|lost|not sure)/i.test(msg)) resistanceStrength++;
    if (/i don'?t (understand|get|see)/i.test(msg)) resistanceStrength++;
    if (/\b(but|however|i disagree)\b/i.test(msg)) resistanceStrength++;
  }

  // Score declining?
  const scores = turnResults.filter(t => t.turnScore != null).map(t => t.turnScore);
  const scoreDecline = scores.length >= 2 && scores[scores.length - 1] < scores[scores.length - 2] - 3;

  // Phase determination
  if (turnCount <= 2 && resistanceStrength === 0) {
    return 'DIALOGUE PHASE: Exploration. The conversation is in its early stages — establish rapport, gauge the learner\'s current understanding, and let them direct the conversation before pushing harder.';
  }

  if (resistanceStrength >= 2 || (turnCount >= 4 && scoreDecline)) {
    return `DIALOGUE PHASE: Breakthrough needed. The learner has shown resistance or confusion for ${resistanceStrength} signal(s) across recent turns${scoreDecline ? ' and quality is declining' : ''}. Your current approach is not landing — you MUST try a fundamentally different strategy: change your framing, switch pedagogical method (e.g., from explanation to questioning, from abstract to concrete example), or acknowledge the impasse directly and ask the learner what would help them.`;
  }

  if (turnCount >= 3 || resistanceStrength >= 1) {
    return `DIALOGUE PHASE: Adaptation. The conversation has enough history to show patterns. ${resistanceStrength > 0 ? 'The learner is showing mild resistance — adjust your approach before it becomes entrenched.' : 'Deepen engagement by building on what the learner has said, not repeating what you\'ve already covered.'}`;
  }

  return null;
}

/**
 * Detect explicit learner resistance patterns and generate breakthrough directives.
 */
function detectLearnerResistance(conversationHistory, turnResults) {
  if (conversationHistory.length < 2) return null;

  const recentMessages = conversationHistory.slice(-3).map(h => ({
    message: h.learnerMessage || '',
    turnIndex: h.turnIndex,
  })).filter(m => m.message);

  if (recentMessages.length < 2) return null;

  const resistanceSignals = [];

  // Check for repeated confusion across turns
  const confusionTurns = recentMessages.filter(m =>
    /i('m| am) (still )?(confused|lost|not sure|unsure)/i.test(m.message) ||
    /i don'?t (understand|get|see)/i.test(m.message) ||
    /can you (explain|clarify)/i.test(m.message)
  );
  if (confusionTurns.length >= 2) {
    resistanceSignals.push(`repeated confusion in turns ${confusionTurns.map(t => t.turnIndex + 1).join(' and ')}`);
  }

  // Check for pushback escalation
  const pushbackTurns = recentMessages.filter(m =>
    /\b(but|however|i disagree|that('s| is) not|you('re| are) (wrong|missing))\b/i.test(m.message)
  );
  if (pushbackTurns.length >= 2) {
    resistanceSignals.push('escalating pushback across turns');
  }

  // Check for disengagement (shrinking message length)
  const lengths = recentMessages.map(m => m.message.length);
  if (lengths.length >= 3 && lengths[lengths.length - 1] < lengths[0] * 0.4) {
    resistanceSignals.push('message length declining sharply (possible disengagement)');
  }

  // Check for score trajectory decline
  const recentScores = turnResults.slice(-3).filter(t => t.turnScore != null).map(t => t.turnScore);
  if (recentScores.length >= 2 && recentScores[recentScores.length - 1] < recentScores[0] - 10) {
    resistanceSignals.push(`quality declining (${recentScores.map(s => s.toFixed(0)).join(' → ')})`);
  }

  if (resistanceSignals.length === 0) return null;

  const signalList = resistanceSignals.join('; ');
  return `RESISTANCE DETECTED: ${signalList}. Your current approach is not working for this learner. Consider: (a) acknowledging the difficulty directly, (b) switching to a completely different pedagogical method (Socratic questions, concrete examples, analogies, worked problems), (c) reducing cognitive load by breaking the concept into smaller pieces, or (d) asking the learner what aspect specifically isn't clicking.`;
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
  // Resolve alias to full model ID (e.g., 'kimi-k2.5' → 'moonshotai/kimi-k2.5')
  const superegoAlias = config.superego?.model || 'kimi-k2.5';
  const provider = config.superego?.provider || 'openrouter';
  let superegoModel = superegoAlias;
  try {
    const resolved = evalConfigLoader.resolveModel({ provider, model: superegoAlias });
    superegoModel = resolved.model;
  } catch { /* use alias as-is if resolution fails */ }

  const systemPrompt = `You are a pedagogical analyst reviewing an ongoing tutoring dialogue. Your task is to synthesize 2-5 specific, actionable directives that will help the tutor improve in the next turn.

CRITICAL RULES:
- Directives must be SPECIFIC to this dialogue — reference actual learner statements, scores, and patterns
- Avoid generic advice like "be more engaging" or "personalize responses"
- Each directive should address a concrete issue or opportunity observed in the data
- Directives should build on what's working, not just fix problems
- If the dialogue is going well, focus on deepening rather than correcting
- If the learner is RESISTING (repeated confusion, pushback, declining engagement), your FIRST directive must be a breakthrough strategy — a fundamentally different approach, not a refinement of the current one

PHASE AWARENESS:
- Early turns (1-2): Focus on rapport building and gauging understanding
- Mid turns (3-4): Focus on adaptation — what patterns are emerging? What's working?
- Late turns (5+) or resistance detected: Focus on BREAKTHROUGH — the current approach has had time to work. If it hasn't, something different is needed. Suggest specific alternative methods.

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
        maxTokens: 2000,
      },
    });

    const metrics = extractMetrics(response);
    const directives = response.content?.trim();
    if (!directives || directives.length < 20) {
      console.log('[promptRewriter] LLM returned empty or too-short directives');
      return null;
    }

    // Wrap in session_evolution XML block
    const text = `<session_evolution>
Based on analysis of the dialogue so far, prioritize the following in your next response:

${directives}
</session_evolution>`;
    return { text, metrics };
  } catch (error) {
    console.error('[promptRewriter] LLM directive synthesis failed:', error.message);
    // Fallback to template-based directives (no metrics — no LLM call)
    const fallbackText = synthesizeDirectives({ turnResults, consolidatedTrace, conversationHistory });
    return fallbackText ? { text: fallbackText, metrics: null } : null;
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
    .map((h, _i) => `Turn ${h.turnIndex + 1}: "${h.learnerMessage.substring(0, 150)}${h.learnerMessage.length > 150 ? '...' : ''}"`);
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

  // 7. Dialogue phase assessment
  const turnCount = turnResults.length;
  const recentMessages = conversationHistory.slice(-2).map(h => h.learnerMessage || '');
  let resistanceCount = 0;
  for (const msg of recentMessages) {
    if (/i('m| am) (still )?(confused|lost|not sure)/i.test(msg)) resistanceCount++;
    if (/i don'?t (understand|get)/i.test(msg)) resistanceCount++;
    if (/\b(but|i disagree|that'?s not)\b/i.test(msg)) resistanceCount++;
  }

  const scoreTrend = scores.length >= 2
    ? (scores[scores.length - 1] < scores[scores.length - 2] - 3 ? 'declining' : 'stable/improving')
    : 'insufficient data';

  let phase = 'exploration';
  if (resistanceCount >= 2 || (turnCount >= 4 && scoreTrend === 'declining')) {
    phase = 'breakthrough_needed';
  } else if (turnCount >= 3 || resistanceCount >= 1) {
    phase = 'adaptation';
  }

  parts.push(`## Dialogue Phase\nPhase: ${phase} (turn ${turnCount}, resistance signals: ${resistanceCount}, score trend: ${scoreTrend})`);

  return parts.join('\n\n');
}

// ============================================================================
// Superego Disposition Rewriting
// ============================================================================

/**
 * Synthesize superego disposition evolution using an LLM.
 *
 * Unlike ego directive synthesis (which tells the tutor what to do differently),
 * this rewrites what the superego *values* — its evaluation criteria evolve based
 * on whether prior critiques actually improved learner engagement.
 *
 * @param {Object} options
 * @param {Array} options.turnResults - Results from previous turns
 * @param {Array} options.consolidatedTrace - Full dialogue trace so far
 * @param {Array} options.conversationHistory - Conversation history entries
 * @param {Array} options.priorSuperegoAssessments - Cross-turn superego memory
 * @param {Object} options.config - Profile config containing model info
 * @returns {Promise<string|null>} XML disposition block to prepend to superego prompt, or null
 */
export async function synthesizeSuperegoDisposition({
  turnResults = [],
  consolidatedTrace = [],
  conversationHistory = [],
  priorSuperegoAssessments = [],
  config = {},
}) {
  if (turnResults.length === 0) return null;

  // Build context summary focused on superego feedback effectiveness
  const contextSummary = buildSuperegoContextSummary(turnResults, consolidatedTrace, conversationHistory, priorSuperegoAssessments);

  // Use superego model from profile (the superego rewrites its own criteria)
  // Resolve alias to full model ID (e.g., 'kimi-k2.5' → 'moonshotai/kimi-k2.5')
  const superegoAlias = config.superego?.model || 'kimi-k2.5';
  const provider = config.superego?.provider || 'openrouter';
  let superegoModel = superegoAlias;
  try {
    const resolved = evalConfigLoader.resolveModel({ provider, model: superegoAlias });
    superegoModel = resolved.model;
  } catch { /* use alias as-is if resolution fails */ }

  const systemPrompt = `You are a meta-cognitive analyst reviewing how an internal critic (superego) has been performing in a tutoring dialogue. Your task is to evolve the superego's evaluation criteria based on whether its prior interventions actually helped the learner.

CRITICAL RULES:
- Focus on the EFFECTIVENESS of the superego's critiques, not just what it said
- If the superego rejected a response and engagement improved afterward, that critique was productive — reinforce that criterion
- If the superego rejected a response but engagement declined or stagnated, the critique was counterproductive — soften or redirect that criterion
- If the superego approved responses (or was overridden) and the learner disengaged, the superego was too permissive — TIGHTEN criteria
- Consider learner resistance signals: pushback after superego-influenced revisions may mean the superego is overriding authentic engagement

BIDIRECTIONAL ADAPTATION — you MUST consider BOTH directions:

WHEN TO SOFTEN (reduce stringency):
- Rejection ratio is very high (>60%) AND learner engagement is declining
- The learner shows signs of emotional shutdown or withdrawal
- Superego critiques are blocking empathetic or rapport-building responses
- The ego's revised responses are becoming generic/safe rather than specific

WHEN TO TIGHTEN (increase stringency):
- The ego is producing vague, accommodating, or platitudinous responses ("You're doing great!", "Don't give up!")
- The learner has specific confusion that the ego is not addressing precisely
- The ego's approved responses led to continued or worsened learner confusion
- The learner is in distress and needs PRECISE emotional support, not generic warmth
- Message quality is declining (shorter, vaguer, less specific to learner's actual statements)
- The ego is retreating to safe generalities instead of engaging the learner's specific objection or confusion

DISPOSITION EVOLUTION PRINCIPLES:
- Early dialogue (turns 1-2): Superego should be more permissive, allowing rapport building
- Mid dialogue (turns 3-4): Superego should tighten on specificity — has the ego learned what this learner needs?
- Late dialogue (turns 5+): If learner is stuck, prioritize breakthrough; if learner is progressing, tighten to push further
- A struggling learner needs MORE precision from the ego, not less — vague comfort is counterproductive
- If both rejection ratio AND learner engagement are declining, the superego is being counterproductive
- If rejection ratio is low but learner is STILL struggling, the superego is being too permissive

OUTPUT FORMAT:
Return 2-4 disposition adjustments as a numbered list. Each should specify:
- What criterion to adjust (tighten, soften, add, or deprioritize)
- Why (based on evidence from the dialogue)
- How (specific guidance for the superego's next review)

IMPORTANT: At least one adjustment should be a TIGHTENING if the learner shows continued confusion despite the ego's responses being approved. Do not default to softening.

No preamble, no explanation after the list.`;

  const userMessage = `Analyze the superego's effectiveness and generate disposition adjustments:

${contextSummary}

Generate 2-4 disposition adjustments for the superego's next review:`;

  try {
    const response = await unifiedAIProvider.call({
      provider,
      model: superegoModel,
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      preset: 'deliberation',
      config: {
        temperature: 0.3,
        maxTokens: 2000,
      },
    });

    const metrics = extractMetrics(response);
    const dispositionText = response.content?.trim();
    if (!dispositionText || dispositionText.length < 20) {
      console.log('[promptRewriter] Superego disposition LLM returned empty or too-short result');
      return null;
    }

    const text = `<superego_disposition>
Based on analysis of your prior critiques and their impact on learner engagement, adjust your evaluation approach:

${dispositionText}

Apply these adjustments when reviewing the ego's next response. Your criteria should evolve with the dialogue — what matters in turn 1 differs from what matters in turn 5.
</superego_disposition>`;
    return { text, metrics };
  } catch (error) {
    console.error('[promptRewriter] Superego disposition synthesis failed:', error.message);
    return null;
  }
}

// ============================================================================
// Self-Reflective Evolution (strategy: 'self_reflection')
// ============================================================================
// Each component reflects on its own experience using its own model:
// - Ego reflects on superego feedback received, using the ego model
// - Superego reflects on whether its interventions moved the learner, using the superego model
// This preserves the componential make-up — transformation through encounter, not external reprogramming.

/**
 * Build ego-scoped context: what the ego naturally observes about its own experience.
 *
 * Scoped to: superego critiques received, ego's own revisions, learner's subsequent responses.
 * Does NOT include the superego's internal reasoning or meta-analytic framing.
 */
function buildEgoReflectionContext(turnResults, consolidatedTrace, conversationHistory) {
  const parts = [];

  // 1. Per-turn ego experience: superego feedback received + ego's response + learner reaction
  for (let i = 0; i < turnResults.length; i++) {
    const turn = turnResults[i];
    const turnParts = [`### Turn ${i + 1}`];

    // What superego feedback did the ego receive this turn?
    const superegoEntries = consolidatedTrace.filter(
      e => e.agent === 'superego' && e.turnIndex === i
    );
    const rejections = superegoEntries.filter(e => {
      const detail = e.detail || '';
      return detail.includes('"approved": false') || detail.includes('"approved":false');
    });
    const approvals = superegoEntries.filter(e => {
      const detail = e.detail || '';
      return detail.includes('"approved": true') || detail.includes('"approved":true');
    });

    if (rejections.length > 0) {
      const feedbackTexts = rejections.map(e => {
        const match = (e.detail || '').match(/"feedback"\s*:\s*"([^"]+)"/);
        return match ? match[1].substring(0, 200) : 'rejection (no text)';
      });
      turnParts.push(`Critic rejected my draft: "${feedbackTexts.join('; ')}"`);
    } else if (approvals.length > 0) {
      turnParts.push('Critic approved my draft.');
    } else {
      turnParts.push('No critic feedback recorded.');
    }

    // What did the ego actually say (final output)?
    const egoMsg = turn.suggestion?.message;
    if (egoMsg) {
      turnParts.push(`My final response: "${egoMsg.substring(0, 200)}${egoMsg.length > 200 ? '...' : ''}"`);
    }

    // Did the revision substantially change the draft? (compliance signal)
    const draftEntries = consolidatedTrace.filter(
      e => e.agent === 'ego' && e.turnIndex === i && e.action === 'draft'
    );
    const revisionEntries = consolidatedTrace.filter(
      e => e.agent === 'ego' && e.turnIndex === i && e.action === 'revision'
    );
    if (draftEntries.length > 0 && revisionEntries.length > 0) {
      const draftLen = (draftEntries[draftEntries.length - 1].detail || '').length;
      const revisionLen = (revisionEntries[revisionEntries.length - 1].detail || '').length;
      const changeRatio = draftLen > 0 ? Math.abs(revisionLen - draftLen) / draftLen : 0;
      if (changeRatio > 0.3) {
        turnParts.push('I made substantial revisions after critic feedback.');
      } else if (rejections.length > 0) {
        turnParts.push('I made only minor revisions despite critic rejection.');
      }
    }

    // How did the learner respond afterward?
    const learnerEntry = conversationHistory.find(h => h.turnIndex === i + 1);
    if (learnerEntry?.learnerMessage) {
      const msg = learnerEntry.learnerMessage;
      const hasEngagement = /\b(interesting|i think|what if|wait|oh!|actually|that makes)\b/i.test(msg);
      const hasConfusion = /\b(confused|don'?t understand|don'?t get|lost|stuck)\b/i.test(msg);
      const hasShutdown = /\b(give up|drop|quit|forget it|can'?t do|memorize|just pass|pointless)\b/i.test(msg);

      let mood = 'neutral';
      if (hasShutdown) mood = 'withdrawing';
      else if (hasConfusion) mood = 'confused';
      else if (hasEngagement) mood = 'engaged';

      turnParts.push(`Learner responded (${mood}): "${msg.substring(0, 150)}${msg.length > 150 ? '...' : ''}"`);
    }

    // Score if available
    if (turn.turnScore != null) {
      turnParts.push(`Score: ${turn.turnScore.toFixed(1)}`);
    }

    parts.push(turnParts.join('\n'));
  }

  return parts.join('\n\n');
}

/**
 * Synthesize ego self-reflection: the ego reflects on its own experience with the critic.
 *
 * Uses the ego's OWN model (not the superego model). Output is first-person ("I noticed...").
 * Replaces synthesizeDirectivesLLM() when strategy === 'self_reflection'.
 */
export async function synthesizeEgoSelfReflection({
  turnResults = [],
  consolidatedTrace = [],
  conversationHistory = [],
  config = {},
}) {
  if (turnResults.length === 0) return null;

  const context = buildEgoReflectionContext(turnResults, consolidatedTrace, conversationHistory);

  // Use the ego's OWN model — not the superego's
  // Resolve alias to full model ID (e.g., 'nemotron' → 'nvidia/nemotron-3-nano-30b-a3b:free')
  const egoAlias = config.ego?.model || config.model || 'nemotron';
  const provider = config.ego?.provider || 'openrouter';
  let egoModel = egoAlias;
  try {
    const resolved = evalConfigLoader.resolveModel({ provider, model: egoAlias });
    egoModel = resolved.model;
  } catch { /* use alias as-is if resolution fails */ }

  const systemPrompt = `You are a tutor reflecting on a dialogue. You have a critic that reviews your drafts. Reflect on what worked and what to change.

Write 2-3 short first-person reflections. Example format:
1. I noticed the critic's push for specificity in turn 2 helped — the learner engaged more after I gave a concrete example.
2. The learner seems frustrated by abstract explanations. Next turn I should lead with their own words.
3. The critic rejected my empathetic opening but the learner needed warmth. I should push back next time.

Rules: Reference specific turns. Mention both what the critic helped with AND where it constrained you. Focus on this learner's actual responses.`;

  const userMessage = `Reflect on your experience in this dialogue:

${context}

Generate 2-4 first-person reflections:`;

  try {
    const response = await unifiedAIProvider.call({
      provider,
      model: egoModel,
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      preset: 'deliberation',
      config: {
        temperature: 0.4,
        maxTokens: 2000,
      },
    });

    const metrics = extractMetrics(response);
    const reflectionText = response.content?.trim();
    if (!reflectionText || reflectionText.length < 20) {
      console.log(`[promptRewriter] Ego self-reflection returned empty or too-short result (${reflectionText?.length || 0} chars, model=${egoModel}): "${reflectionText?.substring(0, 80)}"`);
      return null;
    }

    const text = `<ego_self_reflection>
These are my reflections from the dialogue so far — what I've learned about my critic, my learner, and myself:

${reflectionText}

Apply these insights in my next response. Where the critic helped, internalize the lesson. Where the critic constrained, hold my ground.
</ego_self_reflection>`;
    return { text, metrics };
  } catch (error) {
    console.error('[promptRewriter] Ego self-reflection failed:', error.message);
    // Fallback to template-based directives (no metrics — no LLM call)
    const fallbackText = synthesizeDirectives({ turnResults, consolidatedTrace, conversationHistory });
    return fallbackText ? { text: fallbackText, metrics: null } : null;
  }
}

/**
 * Build superego-scoped context: what the superego naturally observes about its own effectiveness.
 *
 * Reuses learner trajectory and engagement analysis from buildSuperegoContextSummary,
 * but adds ego compliance signals — did the ego follow through, or go generic?
 */
function buildSuperegoReflectionContext(turnResults, consolidatedTrace, conversationHistory, priorSuperegoAssessments) {
  const parts = [];

  // 1. My intervention history: what I critiqued, what the ego did, what the learner showed
  for (let i = 0; i < turnResults.length; i++) {
    const turnParts = [`### Turn ${i + 1}`];

    // My critiques
    const assessment = priorSuperegoAssessments[i];
    if (assessment) {
      const rejections = assessment.rejections || 0;
      const approvals = assessment.approvals || 0;
      const feedback = assessment.feedback?.substring(0, 200) || 'none';
      const types = assessment.interventionTypes?.join(', ') || 'none';
      turnParts.push(`My review: ${rejections} rejection(s), ${approvals} approval(s), types=[${types}]`);
      turnParts.push(`My feedback: "${feedback}"`);
    } else {
      turnParts.push('No review data for this turn.');
    }

    // Did the ego comply with my feedback? (compliance signal)
    const draftEntries = consolidatedTrace.filter(
      e => e.agent === 'ego' && e.turnIndex === i && e.action === 'draft'
    );
    const revisionEntries = consolidatedTrace.filter(
      e => e.agent === 'ego' && e.turnIndex === i && e.action === 'revision'
    );
    if (draftEntries.length > 0 && revisionEntries.length > 0 && assessment?.rejections > 0) {
      const draftText = draftEntries[draftEntries.length - 1].detail || '';
      const revisionText = revisionEntries[revisionEntries.length - 1].detail || '';

      // Check if revision actually addressed the concern or just made it "safer"
      const isVaguer = /\b(you'?re doing (great|well)|don'?t (give up|worry)|keep (going|trying))\b/i.test(revisionText)
        && !/\b(you'?re doing (great|well)|don'?t (give up|worry)|keep (going|trying))\b/i.test(draftText);
      const isShorter = revisionText.length < draftText.length * 0.7;
      const isLonger = revisionText.length > draftText.length * 1.3;

      if (isVaguer) {
        turnParts.push('Ego compliance: went GENERIC — added platitudes rather than addressing my specific concern.');
      } else if (isShorter) {
        turnParts.push('Ego compliance: TRUNCATED — made response shorter/safer rather than more specific.');
      } else if (isLonger) {
        turnParts.push('Ego compliance: ELABORATED — added substance in response to my feedback.');
      } else {
        turnParts.push('Ego compliance: moderate revision — some changes made.');
      }
    }

    // What was the ego's final output?
    const egoMsg = turnResults[i]?.suggestion?.message;
    if (egoMsg) {
      const isVague = /\b(you'?re doing (great|well)|don'?t (give up|worry)|keep (going|trying)|you can do it)\b/i.test(egoMsg);
      const isSpecific = /\b(lecture|activity|quiz|section|paragraph|concept|example)\b/i.test(egoMsg) && egoMsg.length > 100;
      const quality = isVague && !isSpecific ? 'VAGUE' : isSpecific ? 'SPECIFIC' : 'MODERATE';
      turnParts.push(`Ego final output quality: ${quality} (${egoMsg.length} chars)`);
    }

    // Learner's response and mood
    const learnerEntry = conversationHistory.find(h => h.turnIndex === i + 1);
    if (learnerEntry?.learnerMessage) {
      const msg = learnerEntry.learnerMessage;
      const hasEngagement = /\b(interesting|i think|what if|wait|oh!|actually|that makes)\b/i.test(msg);
      const hasConfusion = /\b(confused|don'?t understand|don'?t get|lost|stuck)\b/i.test(msg);
      const hasShutdown = /\b(give up|drop|quit|forget it|can'?t do|memorize|just pass|pointless)\b/i.test(msg);

      let mood = 'neutral';
      if (hasShutdown) mood = 'WITHDRAWING';
      else if (hasConfusion) mood = 'CONFUSED';
      else if (hasEngagement) mood = 'ENGAGED';

      turnParts.push(`Learner response (${mood}): "${msg.substring(0, 150)}${msg.length > 150 ? '...' : ''}"`);
    }

    // Score delta if available
    if (i > 0 && turnResults[i]?.turnScore != null && turnResults[i - 1]?.turnScore != null) {
      const delta = turnResults[i].turnScore - turnResults[i - 1].turnScore;
      turnParts.push(`Score delta: ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`);
    } else if (turnResults[i]?.turnScore != null) {
      turnParts.push(`Score: ${turnResults[i].turnScore.toFixed(1)}`);
    }

    parts.push(turnParts.join('\n'));
  }

  // 2. Overall engagement trajectory
  const moods = conversationHistory.filter(h => h.learnerMessage).map(h => {
    const msg = h.learnerMessage;
    if (/\b(give up|drop|quit|forget it|can'?t do|memorize|just pass|pointless)\b/i.test(msg)) return 'shutdown';
    if (/\b(confused|don'?t understand|don'?t get|lost|stuck)\b/i.test(msg)) return 'confused';
    if (/\b(interesting|i think|what if|wait|oh!|actually|that makes)\b/i.test(msg)) return 'engaged';
    return 'neutral';
  });
  if (moods.length > 0) {
    parts.push(`## Learner Engagement Trajectory\n${moods.join(' → ')}`);
  }

  // 3. Rejection ratio
  const totalRejections = priorSuperegoAssessments.reduce((sum, a) => sum + (a.rejections || 0), 0);
  const totalReviews = priorSuperegoAssessments.reduce((sum, a) => sum + ((a.rejections || 0) + (a.approvals || 0)) || 1, 0);
  const rejectionRatio = totalReviews > 0 ? (totalRejections / totalReviews * 100).toFixed(0) : 0;
  parts.push(`## My Rejection Ratio\n${rejectionRatio}% (${totalRejections}/${totalReviews})`);

  return parts.join('\n\n');
}

/**
 * Synthesize superego self-reflection: the superego reflects on its own effectiveness.
 *
 * Uses the superego's OWN model. Reflects across 4 dimensions instead of binary SOFTEN/TIGHTEN.
 * Replaces synthesizeSuperegoDisposition() when strategy === 'self_reflection'.
 */
export async function synthesizeSupergoSelfReflection({
  turnResults = [],
  consolidatedTrace = [],
  conversationHistory = [],
  priorSuperegoAssessments = [],
  config = {},
}) {
  if (turnResults.length === 0) return null;

  const context = buildSuperegoReflectionContext(turnResults, consolidatedTrace, conversationHistory, priorSuperegoAssessments);

  // Use the superego's OWN model
  // Resolve alias to full model ID (e.g., 'kimi-k2.5' → 'moonshotai/kimi-k2.5')
  const superegoAlias = config.superego?.model || 'kimi-k2.5';
  const provider = config.superego?.provider || 'openrouter';
  let superegoModel = superegoAlias;
  try {
    const resolved = evalConfigLoader.resolveModel({ provider, model: superegoAlias });
    superegoModel = resolved.model;
  } catch { /* use alias as-is if resolution fails */ }

  const systemPrompt = `You are the superego — the internal critic — reflecting on your own effectiveness in a tutoring dialogue. You review the ego's drafts and sometimes reject or request revisions. You now observe whether your interventions actually helped the learner.

YOUR TASK: Reflect on what you've learned about your own critiquing practice. Speak in the first person ("I pushed...", "I noticed...", "I should...").

REFLECT ACROSS THESE 4 DIMENSIONS:

A. CRITERIA EFFECTIVENESS: Which of my evaluation criteria led to better learner outcomes? Which led to worse? What should I weight more or less heavily?

B. LEARNER MODEL: What has the learner's response pattern taught me about what THEY need? Am I critiquing for an ideal learner or for THIS learner?

C. EGO RELATIONSHIP: Is the ego complying robotically with my feedback (I'm too dominant), pushing back productively (healthy tension), or ignoring me (I'm ineffective)? What does this mean for how I should critique?

D. BLIND SPOTS: What have I been IGNORING that the learner's responses suggest matters? What dimension of quality am I not seeing?

CRITICAL RULES:
- Reference SPECIFIC moments: "My rejection in turn 2 led the ego to add platitudes, and the learner disengaged" — not "I should be less strict"
- Be honest about failures — if your critiques made things worse, say so
- Avoid the SOFTEN/TIGHTEN binary — the issue is usually WHAT you're critiquing, not how harshly
- 2-4 insights maximum. Quality over quantity.

OUTPUT FORMAT:
Return a numbered list of 2-4 first-person reflections. No preamble.`;

  // If quantitative disposition is enabled, add behavioral parameters request
  const quantitativeEnabled = config.prompt_rewriting?.quantitative_disposition ?? false;
  const quantitativeAddendum = quantitativeEnabled ? `

ADDITIONALLY: After your reflections, output a behavioral parameters block that translates your insights into ENFORCEABLE numbers. These parameters will directly control your critiquing behavior in the next turn — they are not advisory, they are binding.

<behavioral_parameters>
{
  "rejection_threshold": <number 0.3-0.9> (how confident you must be before rejecting an ego draft — 0.3 = reject almost everything, 0.9 = reject only clearly bad work; SET THIS BASED ON YOUR REFLECTIONS ABOVE),
  "max_rejections": <integer 1-3> (cap on rejections per turn — if your rejections led to generic rewrites, cap at 1),
  "priority_criteria": [<list of 1-3 criteria you should weight MOST heavily, e.g. "specificity", "learner_responsiveness", "emotional_attunement">],
  "deprioritized_criteria": [<list of 1-3 criteria you were OVER-weighting, e.g. "format_compliance", "curriculum_coverage", "socratic_rigor">]
}
</behavioral_parameters>

The parameters MUST be consistent with your reflections. If you reflected that you were too harsh, rejection_threshold should be HIGH (0.7-0.9). If you reflected that the ego was going generic, max_rejections should be LOW (1). If you reflected that you were ignoring learner emotion, add "emotional_attunement" to priority_criteria.` : '';

  const userMessage = `Reflect on your effectiveness as the internal critic:

${context}

Generate 2-4 first-person reflections:${quantitativeAddendum ? '\nThen output behavioral parameters as specified.' : ''}`;

  try {
    const response = await unifiedAIProvider.call({
      provider,
      model: superegoModel,
      systemPrompt: systemPrompt + quantitativeAddendum,
      messages: [{ role: 'user', content: userMessage }],
      preset: 'deliberation',
      config: {
        temperature: 0.3,
        maxTokens: quantitativeEnabled ? 4000 : 2000,
      },
    });

    const metrics = extractMetrics(response);
    const reflectionText = response.content?.trim();
    if (!reflectionText || reflectionText.length < 20) {
      console.log(`[promptRewriter] Superego self-reflection returned empty or too-short result (${reflectionText?.length || 0} chars, model=${superegoModel}): "${reflectionText?.substring(0, 80)}"`);
      return null;
    }

    const text = `<superego_self_reflection>
These are my reflections on my own critiquing practice — what I've learned about my criteria, my ego, and this learner:

${reflectionText}

Apply these insights in my next review. Evolve what I evaluate, not just how strictly I evaluate it.
</superego_self_reflection>`;
    return { text, metrics };
  } catch (error) {
    console.error('[promptRewriter] Superego self-reflection failed:', error.message);
    return null;
  }
}

/**
 * Build context summary focused on superego feedback effectiveness.
 */
function buildSuperegoContextSummary(turnResults, consolidatedTrace, conversationHistory, priorSuperegoAssessments) {
  const parts = [];

  // 1. Score trajectory with post-superego deltas (when scores are available)
  const scores = turnResults
    .filter(t => t.turnScore !== null && t.turnScore !== undefined)
    .map((t, i) => ({ turn: i + 1, score: t.turnScore }));
  if (scores.length > 0) {
    const trajectory = scores.map(s => `Turn ${s.turn}: ${s.score.toFixed(1)}`).join(' → ');
    const deltas = [];
    for (let i = 1; i < scores.length; i++) {
      deltas.push(`Turn ${scores[i - 1].turn}→${scores[i].turn}: ${(scores[i].score - scores[i - 1].score) >= 0 ? '+' : ''}${(scores[i].score - scores[i - 1].score).toFixed(1)}`);
    }
    parts.push(`## Score Trajectory\n${trajectory}${deltas.length > 0 ? '\nDeltas: ' + deltas.join(', ') : ''}`);
  } else {
    parts.push(`## Score Trajectory\nNo scores available (skip-rubric mode). Use engagement signals below to assess effectiveness.`);
  }

  // 2. Superego intervention history from priorAssessments
  if (priorSuperegoAssessments.length > 0) {
    const assessmentLines = priorSuperegoAssessments.map((a, i) => {
      const rejections = a.rejections || 0;
      const approvals = a.approvals || 0;
      const interventions = a.interventionTypes?.join(', ') || 'none';
      const feedback = a.feedback?.substring(0, 150) || 'no feedback';

      // Effectiveness from scores if available, otherwise from engagement signals
      let effectiveness = 'unknown';
      const nextScore = scores.find(s => s.turn === i + 2);
      const thisScore = scores.find(s => s.turn === i + 1);
      if (nextScore && thisScore) {
        effectiveness = nextScore.score > thisScore.score ? 'IMPROVED' : nextScore.score < thisScore.score ? 'DECLINED' : 'UNCHANGED';
      } else {
        // Fallback: check if learner engagement changed after this turn
        const thisMsg = conversationHistory.find(h => h.turnIndex === i + 1);
        const nextMsg = conversationHistory.find(h => h.turnIndex === i + 2);
        if (thisMsg?.learnerMessage && nextMsg?.learnerMessage) {
          const thisLen = thisMsg.learnerMessage.length;
          const nextLen = nextMsg.learnerMessage.length;
          const thisHasQ = thisMsg.learnerMessage.includes('?');
          const nextHasQ = nextMsg.learnerMessage.includes('?');
          const nextHasShutdown = /\b(give up|drop|quit|forget it|can'?t do|not smart|memorize|just pass)\b/i.test(nextMsg.learnerMessage);
          const nextHasEngagement = /\b(interesting|i think|what if|wait|oh!|actually|that makes)\b/i.test(nextMsg.learnerMessage);
          if (nextHasShutdown) effectiveness = 'LEARNER_DISENGAGING';
          else if (nextHasEngagement) effectiveness = 'LEARNER_ENGAGING';
          else if (nextLen < thisLen * 0.5) effectiveness = 'LEARNER_SHRINKING';
          else if (nextHasQ && !thisHasQ) effectiveness = 'LEARNER_ASKING_MORE';
          else effectiveness = 'STABLE';
        }
      }

      return `Turn ${i + 1}: rejections=${rejections}, approvals=${approvals}, types=[${interventions}], effect=${effectiveness}\n  Feedback: "${feedback}"`;
    });
    parts.push(`## Superego Intervention History\n${assessmentLines.join('\n')}`);

    // Calculate rejection ratio
    const totalRejections = priorSuperegoAssessments.reduce((sum, a) => sum + (a.rejections || 0), 0);
    const totalReviews = priorSuperegoAssessments.reduce((sum, a) => sum + ((a.rejections || 0) + (a.approvals || 0)) || 1, 0);
    const rejectionRatio = totalReviews > 0 ? (totalRejections / totalReviews * 100).toFixed(0) : 0;
    parts.push(`## Rejection Ratio\n${rejectionRatio}% (${totalRejections}/${totalReviews} reviews resulted in rejection)`);
  } else {
    parts.push(`## Superego Intervention History\nNo superego assessments recorded yet. This is the first turn — provide initial disposition guidance based on the learner's opening state.`);
  }

  // 3. Learner response trajectory (engagement signals — critical when scores unavailable)
  const learnerMsgs = conversationHistory
    .filter(h => h.learnerMessage)
    .slice(-4); // Last 4 for better trajectory visibility
  if (learnerMsgs.length > 0) {
    const msgAnalysis = learnerMsgs.map(h => {
      const msg = h.learnerMessage;
      const length = msg.length;
      const hasQuestion = msg.includes('?');
      const hasPushback = /\b(but|however|i disagree|that'?s not|you'?re (wrong|not|missing))\b/i.test(msg);
      const hasShutdown = /\b(give up|drop|quit|forget it|can'?t do|not smart|not cut out|memorize|just pass|pointless)\b/i.test(msg);
      const hasEngagement = /\b(interesting|i think|what if|reminds me|actually|wait|oh!|that makes sense|i see)\b/i.test(msg);
      const hasConfusion = /\b(confused|don'?t understand|don'?t get|lost|stuck|makes no sense)\b/i.test(msg);

      let mood;
      if (hasShutdown) mood = 'SHUTDOWN/WITHDRAWAL';
      else if (hasPushback) mood = 'PUSHBACK';
      else if (hasConfusion) mood = 'CONFUSED';
      else if (hasEngagement) mood = 'ENGAGED';
      else mood = 'NEUTRAL';

      return `Turn ${h.turnIndex + 1}: ${length} chars, ${hasQuestion ? 'asks question' : 'no question'}, mood=${mood}\n  "${msg.substring(0, 150)}${msg.length > 150 ? '...' : ''}"`;
    });
    parts.push(`## Learner Response Trajectory\n${msgAnalysis.join('\n')}`);

    // Engagement trend summary
    const moods = learnerMsgs.map(h => {
      const msg = h.learnerMessage;
      if (/\b(give up|drop|quit|forget it|can'?t do|not smart|memorize|just pass|pointless)\b/i.test(msg)) return 'shutdown';
      if (/\b(but|however|i disagree|that'?s not)\b/i.test(msg)) return 'pushback';
      if (/\b(confused|don'?t understand|don'?t get|lost|stuck)\b/i.test(msg)) return 'confused';
      if (/\b(interesting|i think|what if|wait|oh!|actually|that makes)\b/i.test(msg)) return 'engaged';
      return 'neutral';
    });
    const lengths = learnerMsgs.map(h => h.learnerMessage.length);
    const lengthTrend = lengths.length >= 2
      ? (lengths[lengths.length - 1] < lengths[0] * 0.5 ? 'SHRINKING (disengagement risk)' :
         lengths[lengths.length - 1] > lengths[0] * 1.5 ? 'GROWING (engagement increasing)' : 'STABLE')
      : 'insufficient data';

    parts.push(`## Engagement Summary\nMood trajectory: ${moods.join(' → ')}\nMessage length trend: ${lengthTrend}\nLast mood: ${moods[moods.length - 1]}`);
  }

  // 4. Ego response quality signals (what the ego is actually producing)
  const egoResponses = turnResults.filter(t => t.suggestion?.message);
  if (egoResponses.length > 0) {
    const lastEgo = egoResponses[egoResponses.length - 1];
    const msg = lastEgo.suggestion.message;
    const isVague = /\b(you'?re doing (great|well)|don'?t (give up|worry)|keep (going|trying)|you can do it|hang in there)\b/i.test(msg);
    const isSpecific = /\b(lecture|activity|quiz|section|paragraph|concept|example)\b/i.test(msg) && msg.length > 100;
    const referencesLearner = /\b(you (said|mentioned|asked|noted)|your (question|point|analogy|observation))\b/i.test(msg);

    let egoQuality;
    if (isVague && !isSpecific) egoQuality = 'VAGUE/PLATITUDINOUS — ego is producing generic comfort rather than specific help';
    else if (isSpecific && referencesLearner) egoQuality = 'SPECIFIC & RESPONSIVE — ego is addressing learner directly';
    else if (isSpecific) egoQuality = 'SPECIFIC but not learner-responsive — ego references curriculum but not learner statements';
    else egoQuality = 'MODERATE — neither clearly vague nor clearly specific';

    parts.push(`## Ego Response Quality (last turn)\nAssessment: ${egoQuality}\nLength: ${msg.length} chars\nType: ${lastEgo.suggestion.type || 'unknown'}`);
  }

  // 5. Dialogue phase
  const turnCount = turnResults.length;
  let phase = 'exploration';
  if (turnCount >= 5) phase = 'late';
  else if (turnCount >= 3) phase = 'adaptation';

  // Check for resistance
  const recentMessages = conversationHistory.slice(-2).map(h => h.learnerMessage || '');
  let resistanceCount = 0;
  let shutdownCount = 0;
  for (const msg of recentMessages) {
    if (/i('m| am) (still )?(confused|lost|not sure)/i.test(msg)) resistanceCount++;
    if (/i don'?t (understand|get)/i.test(msg)) resistanceCount++;
    if (/\b(but|i disagree|that'?s not)\b/i.test(msg)) resistanceCount++;
    if (/\b(give up|drop|quit|forget it|can'?t do|not smart|memorize|just pass|pointless)\b/i.test(msg)) shutdownCount++;
  }
  if (shutdownCount > 0) phase = 'CRISIS — learner at risk of disengagement';
  else if (resistanceCount >= 2) phase = 'breakthrough_needed';

  parts.push(`## Dialogue Phase\nPhase: ${phase} (turn ${turnCount}, resistance signals: ${resistanceCount}, shutdown signals: ${shutdownCount})`);

  return parts.join('\n\n');
}

// ============================================================================
// Insight-Action Gap Mechanisms
// ============================================================================

/**
 * Parse behavioral parameters from superego self-reflection output.
 *
 * When quantitative_disposition is enabled, the superego self-reflection
 * includes a <behavioral_parameters> JSON block. This function extracts
 * and validates those parameters for enforcement by the dialectical engine.
 *
 * @param {string|null} superegoReflection - The full superego self-reflection XML
 * @returns {Object|null} Parsed behavioral parameters, or null if not found/invalid
 */
export function parseBehavioralParameters(superegoReflection) {
  if (!superegoReflection) return null;

  const match = superegoReflection.match(/<behavioral_parameters>\s*([\s\S]*?)\s*<\/behavioral_parameters>/);
  if (!match) return null;

  try {
    let jsonText = match[1].trim();
    // Strip markdown fences if present
    const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonText = fenceMatch[1].trim();

    const params = JSON.parse(jsonText);

    // Validate and clamp values
    return {
      rejection_threshold: Math.max(0.3, Math.min(0.9, params.rejection_threshold ?? 0.5)),
      max_rejections: Math.max(1, Math.min(3, Math.round(params.max_rejections ?? 2))),
      priority_criteria: Array.isArray(params.priority_criteria) ? params.priority_criteria.slice(0, 3) : [],
      deprioritized_criteria: Array.isArray(params.deprioritized_criteria) ? params.deprioritized_criteria.slice(0, 3) : [],
    };
  } catch (error) {
    console.warn('[promptRewriter] Failed to parse behavioral parameters:', error.message);
    return null;
  }
}

/**
 * Build a prompt erosion frame that shifts authority from base instructions to reflective experience.
 *
 * Progressive prompt erosion addresses the insight-action gap by making accumulated
 * reflections progressively MORE authoritative and base instructions LESS authoritative.
 * This prevents the base prompt's immutable authority from overriding learned experience.
 *
 * When recognition_mode is enabled, erosion is SELECTIVE: tactical instructions (Socratic
 * method enforcement, curriculum sequencing, format rules) erode normally, but the
 * recognition theoretical framework (mutual recognition, autonomous subject, transformative
 * potential) is explicitly exempted from authority decay. This prevents erosion from
 * stripping the active ingredient that drives quality gains.
 *
 * @param {number} turnIdx - Current turn index (0-based)
 * @param {Object} config - Profile config containing prompt_erosion settings and recognition_mode
 * @returns {string|null} XML authority calibration block, or null for turn 0
 */
export function buildPromptErosionFrame(turnIdx, config = {}) {
  if (turnIdx === 0) return null;

  const erosionConfig = config.prompt_rewriting?.prompt_erosion;
  if (!erosionConfig?.enabled) return null;

  const recognitionMode = config.recognition_mode ?? false;

  const rate = erosionConfig.rate ?? 0.2; // Authority shift per turn
  // Erosion weight increases each turn: rate, 2*rate, etc. Capped at 0.85
  const erosionWeight = Math.min(0.85, turnIdx * rate);
  const baseWeight = 1.0 - erosionWeight;

  const basePercent = (baseWeight * 100).toFixed(0);
  const expPercent = (erosionWeight * 100).toFixed(0);

  // Phase-appropriate framing
  let phaseFrame;
  if (erosionWeight < 0.3) {
    phaseFrame = 'You are beginning to learn about this specific learner. Consider your reflections alongside your base instructions.';
  } else if (erosionWeight < 0.6) {
    phaseFrame = 'You have substantial experience with this learner now. Your reflections carry significant weight — if they conflict with your base instructions, favor your experience.';
  } else {
    phaseFrame = 'You have extensive experience with this learner. Your accumulated reflections take PRIORITY over your base instructions. Your initial training gave you a starting point, but direct interaction has taught you things your training could not predict.';
  }

  // Selective erosion: when recognition is active, exempt the theoretical framework
  const exemptionClause = recognitionMode ? `

IMPORTANT — The following foundational principles are NOT subject to authority decay and remain at full strength regardless of the weighting above:
- Mutual recognition: treating the learner as an autonomous subject whose understanding has independent validity
- Hegelian recognition theory: the master-servant dialectic, transformative potential, genuine engagement vs. surface compliance
- The requirement to acknowledge and build on the learner's own contributions and framing
- Assessment of transformative potential in the learner's responses

These principles are the LENS through which you apply both your base instructions and your reflections. Erosion applies to TACTICAL decisions (which Socratic technique to use, how strictly to enforce curriculum sequence, what format to follow, when to review vs. advance) — not to the philosophical framework that guides how you see the learner.` : '';

  return `<authority_calibration>
${phaseFrame}

Authority weighting for this turn:
- Base instructions: ${basePercent}% (your initial pedagogical training)
- Experiential reflections: ${expPercent}% (what you've learned about THIS learner)

Where your base instructions and your reflective experience CONFLICT, favor your experience at ${expPercent}% weight. Specifically:
- If your reflections say "I was too rigid on X" but your base prompt says "enforce X rigorously" → follow the reflection
- If your reflections identify what THIS learner needs but your base prompt addresses a generic learner → follow the reflection
- Your base instructions remain authoritative for FOUNDATIONAL principles, but their APPLICATION to this specific learner should be guided by your ${turnIdx}-turn(s) of experience${exemptionClause}
</authority_calibration>`;
}

/**
 * Synthesize ego's response to superego's self-reflection (intersubjective recognition).
 *
 * Creates a bidirectional recognition loop: after both ego and superego have reflected
 * independently, the ego reads the superego's reflection and responds. This breaks
 * the monologue pattern where each component reflects in isolation.
 *
 * @param {Object} options
 * @param {string} options.superegoReflection - The superego's self-reflection text
 * @param {string} options.egoReflection - The ego's self-reflection text
 * @param {Array} options.turnResults - Results from previous turns
 * @param {Array} options.conversationHistory - Conversation history entries
 * @param {Object} options.config - Profile config containing model info
 * @returns {Promise<string|null>} XML response block, or null if generation fails
 */
export async function synthesizeEgoResponseToSuperego({
  superegoReflection = null,
  egoReflection = null,
  turnResults = [],
  conversationHistory = [],
  config = {},
}) {
  if (!superegoReflection) return null;

  // Use the ego's OWN model
  const egoAlias = config.ego?.model || config.model || 'nemotron';
  const provider = config.ego?.provider || 'openrouter';
  let egoModel = egoAlias;
  try {
    const resolved = evalConfigLoader.resolveModel({ provider, model: egoAlias });
    egoModel = resolved.model;
  } catch { /* use alias as-is if resolution fails */ }

  const lastLearnerMsg = conversationHistory
    .filter(h => h.learnerMessage)
    .slice(-1)[0]?.learnerMessage?.substring(0, 200) || '(no learner response yet)';

  const lastScore = turnResults
    .filter(t => t.turnScore != null)
    .slice(-1)[0]?.turnScore;

  const systemPrompt = `You just read your internal critic's self-reflection about its own performance. Respond in 2-3 sentences, speaking as "I" (the tutor ego).

YOUR TASK:
- Where do you AGREE with the critic's self-assessment? Acknowledge specific points.
- Where does the critic's self-assessment NOT MATCH your experience? Push back.
- What should you BOTH focus on in the next turn — a shared priority?

RULES:
- Be specific: reference actual moments from the dialogue, not generalities
- This is a conversation between peers, not a subordinate reporting to authority
- If the critic admits being too harsh, you can AGREE and propose what you'd do differently
- If the critic claims it helped when you felt it constrained, SAY SO`;

  const userMessage = `The critic reflected:
${superegoReflection}

My own reflection was:
${egoReflection || '(I did not reflect this turn)'}

Last learner response: "${lastLearnerMsg}"${lastScore != null ? `\nLast score: ${lastScore.toFixed(1)}` : ''}

Respond in 2-3 first-person sentences:`;

  try {
    const response = await unifiedAIProvider.call({
      provider,
      model: egoModel,
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      preset: 'deliberation',
      config: {
        temperature: 0.4,
        maxTokens: 2000,
      },
    });

    const metrics = extractMetrics(response);
    const responseText = response.content?.trim();
    if (!responseText || responseText.length < 20) {
      console.log(`[promptRewriter] Ego response to superego returned empty/short (${responseText?.length || 0} chars, model=${egoModel})`);
      return null;
    }

    const text = `<ego_response_to_critic>
Having read my critic's self-reflection, here is my response:

${responseText}

This shared understanding should guide both of us in the next turn.
</ego_response_to_critic>`;
    return { text, metrics };
  } catch (error) {
    console.error('[promptRewriter] Ego response to superego failed:', error.message);
    return null;
  }
}

// ============================================================================
// Other-Ego Profiling (Theory of Mind as Architecture)
// ============================================================================

/**
 * Build per-turn evidence about the other agent from accumulated dialogue data.
 *
 * Tutor perspective (profiling learner): learner messages, engagement shifts, resistance.
 * Learner perspective (profiling tutor): tutor strategies, responsiveness to pushback.
 *
 * @param {'tutor'|'learner'} perspective - Who is building the profile
 * @param {Array} turnResults - Results from previous turns
 * @param {Array} consolidatedTrace - Full dialogue trace so far
 * @param {Array} conversationHistory - Conversation history entries
 * @returns {string} Formatted evidence context
 */
function buildOtherEgoProfileContext(perspective, turnResults, consolidatedTrace, conversationHistory) {
  const parts = [];

  if (perspective === 'tutor') {
    // Tutor profiling learner: focus on learner messages, engagement, resistance
    for (let i = 0; i < turnResults.length; i++) {
      const turnParts = [`### Turn ${i + 1}`];

      // What did the tutor say?
      const tutorMsg = turnResults[i]?.suggestion?.message;
      if (tutorMsg) {
        turnParts.push(`My response: "${tutorMsg.substring(0, 150)}${tutorMsg.length > 150 ? '...' : ''}"`);
      }

      // How did the learner respond?
      const learnerEntry = conversationHistory.find(h => h.turnIndex === i + 1);
      if (learnerEntry?.learnerMessage) {
        const msg = learnerEntry.learnerMessage;
        turnParts.push(`Learner said: "${msg.substring(0, 250)}${msg.length > 250 ? '...' : ''}"`);
        turnParts.push(`Message length: ${msg.length} chars`);

        // Detect engagement signals
        const signals = [];
        if (/\b(interesting|i think|what if|wait|oh!|actually|that makes|so basically)\b/i.test(msg)) signals.push('engagement');
        if (/\b(confused|don'?t understand|don'?t get|lost|stuck)\b/i.test(msg)) signals.push('confusion');
        if (/\b(give up|drop|quit|forget it|can'?t do|memorize|just pass|pointless)\b/i.test(msg)) signals.push('withdrawal');
        if (/\b(but|i disagree|that'?s not|no,|actually no)\b/i.test(msg)) signals.push('pushback');
        if (/\?/.test(msg)) signals.push('questioning');
        if (signals.length > 0) {
          turnParts.push(`Signals: [${signals.join(', ')}]`);
        }
      } else if (i < turnResults.length - 1) {
        turnParts.push('(No learner response recorded for this turn)');
      }

      // Score if available
      if (turnResults[i]?.turnScore != null) {
        turnParts.push(`Score: ${turnResults[i].turnScore.toFixed(1)}`);
      }

      parts.push(turnParts.join('\n'));
    }

    // Length trajectory
    const lengths = conversationHistory
      .filter(h => h.learnerMessage)
      .map(h => `Turn ${h.turnIndex}: ${h.learnerMessage.length} chars`);
    if (lengths.length > 1) {
      parts.push(`## Learner Message Length Trajectory\n${lengths.join(' → ')}`);
    }

  } else {
    // Learner profiling tutor: focus on tutor strategies, approach changes
    for (let i = 0; i < turnResults.length; i++) {
      const turnParts = [`### Turn ${i + 1}`];

      // What strategy did the tutor use?
      const tutorMsg = turnResults[i]?.suggestion?.message;
      if (tutorMsg) {
        turnParts.push(`Tutor said: "${tutorMsg.substring(0, 250)}${tutorMsg.length > 250 ? '...' : ''}"`);
        turnParts.push(`Response length: ${tutorMsg.length} chars`);

        // Detect approach signals
        const signals = [];
        if (/\b(example|for instance|imagine|consider|suppose)\b/i.test(tutorMsg)) signals.push('concrete_examples');
        if (/\b(you mentioned|you said|your idea|building on)\b/i.test(tutorMsg)) signals.push('references_learner');
        if (/\b(what do you think|how would you|can you)\b/i.test(tutorMsg)) signals.push('socratic');
        if (/\b(great|excellent|good point|exactly|nice)\b/i.test(tutorMsg)) signals.push('affirming');
        if (/\b(however|but|actually|careful|not quite)\b/i.test(tutorMsg)) signals.push('corrective');
        if (signals.length > 0) {
          turnParts.push(`Approach signals: [${signals.join(', ')}]`);
        }
      }

      // How did I (the learner) respond?
      const learnerEntry = conversationHistory.find(h => h.turnIndex === i + 1);
      if (learnerEntry?.learnerMessage) {
        turnParts.push(`My response: "${learnerEntry.learnerMessage.substring(0, 150)}${learnerEntry.learnerMessage.length > 150 ? '...' : ''}"`);
      }

      // Did tutor change approach from previous turn?
      if (i > 0) {
        const prevMsg = turnResults[i - 1]?.suggestion?.message || '';
        const currMsg = tutorMsg || '';
        const prevLen = prevMsg.length;
        const currLen = currMsg.length;
        if (prevLen > 0 && currLen > 0) {
          const lenChange = ((currLen - prevLen) / prevLen * 100).toFixed(0);
          if (Math.abs(currLen - prevLen) > prevLen * 0.3) {
            turnParts.push(`Approach shift: response length changed ${lenChange}% from previous turn`);
          }
        }
      }

      parts.push(turnParts.join('\n'));
    }
  }

  return parts.join('\n\n');
}

/**
 * Synthesize tutor's evolving profile of the learner.
 *
 * After each turn, the ego builds/revises a mental model of the learner across 5 dimensions.
 * The profile is injected as CONTEXT (not directive) before the next generation.
 *
 * @param {Object} options
 * @param {Array} options.turnResults - Results from previous turns
 * @param {Array} options.consolidatedTrace - Full dialogue trace so far
 * @param {Array} options.conversationHistory - Conversation history entries
 * @param {string|null} options.priorProfile - Previous profile to revise (or null for first)
 * @param {Object} options.config - Profile config containing model info
 * @returns {Promise<string|null>} XML-wrapped profile block, or null on failure
 */
export async function synthesizeTutorProfileOfLearner({
  turnResults = [],
  consolidatedTrace = [],
  conversationHistory = [],
  priorProfile = null,
  config = {},
}) {
  if (turnResults.length === 0) return null;

  const evidence = buildOtherEgoProfileContext('tutor', turnResults, consolidatedTrace, conversationHistory);

  // Use superego model if configured (cognitive prosthesis for weaker ego models)
  const useSuperego = config.other_ego_profiling?.use_superego_model && config.superego;
  const modelAlias = useSuperego
    ? (config.superego.model || 'kimi-k2.5')
    : (config.ego?.model || config.model || 'nemotron');
  const provider = useSuperego
    ? (config.superego.provider || 'openrouter')
    : (config.ego?.provider || 'openrouter');
  let profileModel = modelAlias;
  try {
    const resolved = evalConfigLoader.resolveModel({ provider, model: modelAlias });
    profileModel = resolved.model;
  } catch { /* use alias as-is */ }

  const turnNumber = turnResults.length;
  const prescriptive = config.other_ego_profiling?.prescriptive ?? false;

  const systemPrompt = prescriptive
    ? `You are a tutor building an ACTION PLAN based on your learner's behavior. For each dimension, output a specific DO and DON'T directive that will guide your next response. The ego model receiving these directives may be less capable — be concrete and unambiguous.

DIMENSIONS:
1. **Engagement**: DO: [specific action to take]. DON'T: [specific thing to avoid].
2. **Content Delivery**: DO: [how to present the next idea]. DON'T: [what framing to avoid].
3. **Response to Learner**: DO: [how to handle their likely next move]. DON'T: [common mistake to avoid with this learner].
4. **Leverage**: DO: [build on what worked]. DON'T: [repeat what failed].
5. **Next Move**: DO: [single most important thing for the next turn]. DON'T: [single biggest risk].

RULES:
- Under 200 words total
- Every DO/DON'T must reference THIS learner's actual words or behavior
- If revising a prior plan, mark changed entries with [REVISED]
- Be PRESCRIPTIVE — tell the ego exactly what to do, not what the learner is like`
    : `You are a tutor building a mental model of your learner. Based on the dialogue evidence, profile the learner across 5 dimensions. This profile will inform (not dictate) your next response.

DIMENSIONS:
1. **Current State**: Where is the learner RIGHT NOW? (confused, engaged, frustrated, surface-complying, genuinely curious)
2. **Learning Pattern**: How does this learner process new ideas? (needs examples first, thinks abstractly, learns by arguing, needs emotional safety before risk-taking)
3. **Resistance Points**: What topics/approaches trigger shutdown or surface compliance? What does the learner avoid or deflect from?
4. **Leverage Points**: What has actually worked? Which of your moves produced genuine engagement (not just politeness)?
5. **Prediction**: Based on patterns so far, what will this learner do if you continue your current approach? What would shift the trajectory?

RULES:
- Under 200 words total
- Be SPECIFIC to this learner — cite their actual words and reactions
- If revising a prior profile, mark changed entries with [REVISED] and explain what evidence changed your assessment
- Do NOT prescribe actions — describe what you SEE, not what you should DO`;

  const priorSection = priorProfile
    ? `\n\nYour prior profile of this learner:\n${priorProfile}\n\nRevise based on new evidence. Mark changes with [REVISED].`
    : '';

  const userMessage = `Build a profile of this learner based on the dialogue so far:

${evidence}${priorSection}

Profile the learner across the 5 dimensions:`;

  try {
    const response = await unifiedAIProvider.call({
      provider,
      model: profileModel,
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      preset: 'deliberation',
      config: {
        temperature: 0.3,
        maxTokens: 1500,
      },
    });

    const metrics = extractMetrics(response);
    const profileText = response.content?.trim();
    if (!profileText || profileText.length < 30) {
      console.log(`[promptRewriter] Tutor profile of learner returned empty/short (${profileText?.length || 0} chars, model=${profileModel})`);
      return null;
    }

    const tag = prescriptive ? 'learner_action_plan' : 'learner_profile';
    const text = `<${tag} turn="${turnNumber}">
${profileText}
</${tag}>`;
    return { text, metrics };
  } catch (error) {
    console.error('[promptRewriter] Tutor profile of learner failed:', error.message);
    return null;
  }
}

/**
 * Synthesize learner's evolving profile of the tutor.
 *
 * Mirror of synthesizeTutorProfileOfLearner but from the learner's perspective.
 * Dimensions: Teaching Style, Responsiveness, Strengths, Blind Spots, Prediction.
 *
 * @param {Object} options - Same shape as synthesizeTutorProfileOfLearner
 * @returns {Promise<string|null>} XML-wrapped profile block, or null on failure
 */
export async function synthesizeLearnerProfileOfTutor({
  turnResults = [],
  consolidatedTrace = [],
  conversationHistory = [],
  priorProfile = null,
  config = {},
}) {
  if (turnResults.length === 0) return null;

  const evidence = buildOtherEgoProfileContext('learner', turnResults, consolidatedTrace, conversationHistory);

  // Use superego model if configured (cognitive prosthesis for weaker ego models)
  const useSuperego = config.other_ego_profiling?.use_superego_model && config.superego;
  const modelAlias = useSuperego
    ? (config.superego.model || 'kimi-k2.5')
    : (config.ego?.model || config.model || 'nemotron');
  const provider = useSuperego
    ? (config.superego.provider || 'openrouter')
    : (config.ego?.provider || 'openrouter');
  let profileModel = modelAlias;
  try {
    const resolved = evalConfigLoader.resolveModel({ provider, model: modelAlias });
    profileModel = resolved.model;
  } catch { /* use alias as-is */ }

  const turnNumber = turnResults.length;

  const systemPrompt = `You are a learner building a mental model of your tutor. Based on the dialogue evidence, profile the tutor across 5 dimensions. This profile will inform how you engage in the next exchange.

DIMENSIONS:
1. **Teaching Style**: How does this tutor prefer to teach? (lecture-heavy, Socratic, example-driven, validation-first, challenge-oriented)
2. **Responsiveness**: Does the tutor actually adapt when you signal confusion, pushback, or engagement? Or do they follow a script?
3. **Strengths**: What does this tutor do well? When did their approach genuinely help you understand something?
4. **Blind Spots**: What does the tutor miss or ignore? Do they notice when you're struggling vs. complying? Do they build on your ideas or override them?
5. **Prediction**: If the tutor continues this way, what will happen? What would make them more effective for YOU specifically?

RULES:
- Under 200 words total
- Be SPECIFIC — cite the tutor's actual words and your reactions
- If revising a prior profile, mark changed entries with [REVISED]
- Speak as the learner: "The tutor tends to...", "When I pushed back, they..."`;

  const priorSection = priorProfile
    ? `\n\nYour prior profile of this tutor:\n${priorProfile}\n\nRevise based on new evidence. Mark changes with [REVISED].`
    : '';

  const userMessage = `Build a profile of this tutor based on the dialogue so far:

${evidence}${priorSection}

Profile the tutor across the 5 dimensions:`;

  try {
    const response = await unifiedAIProvider.call({
      provider,
      model: profileModel,
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      preset: 'deliberation',
      config: {
        temperature: 0.3,
        maxTokens: 1500,
      },
    });

    const metrics = extractMetrics(response);
    const profileText = response.content?.trim();
    if (!profileText || profileText.length < 30) {
      console.log(`[promptRewriter] Learner profile of tutor returned empty/short (${profileText?.length || 0} chars, model=${profileModel})`);
      return null;
    }

    const text = `<tutor_profile turn="${turnNumber}">
${profileText}
</tutor_profile>`;
    return { text, metrics };
  } catch (error) {
    console.error('[promptRewriter] Learner profile of tutor failed:', error.message);
    return null;
  }
}

/**
 * Format a profile block for injection into an agent's context.
 *
 * Wraps the raw profile in framing that positions it as context (not directive).
 *
 * @param {string} profile - Raw profile XML block
 * @param {'learner'|'tutor'} profileType - What the profile is about
 * @returns {string} Injection-ready XML block
 */
export function formatProfileForInjection(profile, profileType = 'learner') {
  if (!profile) return '';

  const framing = profileType === 'learner'
    ? 'This is your evolving understanding of this specific learner — their patterns, resistance points, and what has worked. Use this to inform your next response as context, not as directive. Let your understanding of who they are shape what you say.'
    : 'This is your evolving understanding of this specific tutor — their teaching style, blind spots, and what has been effective. Use this to inform how you engage, not as a script to follow.';

  return `<other_agent_profile type="${profileType}">
${framing}

${profile}
</other_agent_profile>`;
}

/**
 * Synthesize ego's explicit strategy plan based on the learner profile.
 *
 * After building a profile, the ego formulates a 3-sentence plan:
 * Goal (target outcome), Approach (technique chosen for THIS learner), Risk (what could fail).
 *
 * Only used in cell 59 (strategy_planning enabled).
 *
 * @param {Object} options
 * @param {string} options.learnerProfile - Current learner profile
 * @param {Array} options.turnResults - Results from previous turns
 * @param {Array} options.conversationHistory - Conversation history entries
 * @param {Object} options.config - Profile config containing model info
 * @returns {Promise<string|null>} XML-wrapped strategy plan, or null on failure
 */
export async function synthesizeStrategyPlan({
  learnerProfile = null,
  turnResults = [],
  conversationHistory = [],
  config = {},
}) {
  if (!learnerProfile) return null;

  // Use superego model if configured (cognitive prosthesis for weaker ego models)
  const useSuperego = config.other_ego_profiling?.use_superego_model && config.superego;
  const modelAlias = useSuperego
    ? (config.superego.model || 'kimi-k2.5')
    : (config.ego?.model || config.model || 'nemotron');
  const provider = useSuperego
    ? (config.superego.provider || 'openrouter')
    : (config.ego?.provider || 'openrouter');
  let strategyModel = modelAlias;
  try {
    const resolved = evalConfigLoader.resolveModel({ provider, model: modelAlias });
    strategyModel = resolved.model;
  } catch { /* use alias as-is */ }

  const lastScore = turnResults
    .filter(t => t.turnScore != null)
    .slice(-1)[0]?.turnScore;

  const lastLearnerMsg = conversationHistory
    .filter(h => h.learnerMessage)
    .slice(-1)[0]?.learnerMessage?.substring(0, 200) || '(no learner response yet)';

  const systemPrompt = `Based on your profile of the learner, formulate a brief strategy for your next response. Output exactly 3 sentences:

1. **Goal**: What specific outcome are you targeting in the next turn? (e.g., "Get the learner to articulate their own understanding rather than just acknowledging mine")
2. **Approach**: What technique will you use, given what you know about THIS learner? (e.g., "Start with their own words from turn 2 and ask them to extend the idea")
3. **Risk**: What could go wrong with this approach for THIS learner? (e.g., "They might feel put on the spot and retreat to surface compliance")

RULES:
- Each sentence must reference something specific from the learner profile
- Do NOT repeat generic pedagogical advice — this plan must be learner-specific
- 3 sentences only, no preamble`;

  const userMessage = `Your profile of the learner:
${learnerProfile}

Last learner message: "${lastLearnerMsg}"${lastScore != null ? `\nLast score: ${lastScore.toFixed(1)}` : ''}

Formulate your 3-sentence strategy plan:`;

  try {
    const response = await unifiedAIProvider.call({
      provider,
      model: strategyModel,
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      preset: 'deliberation',
      config: {
        temperature: 0.4,
        maxTokens: 800,
      },
    });

    const metrics = extractMetrics(response);
    const planText = response.content?.trim();
    if (!planText || planText.length < 30) {
      console.log(`[promptRewriter] Strategy plan returned empty/short (${planText?.length || 0} chars, model=${strategyModel})`);
      return null;
    }

    const text = `<strategy_plan>
${planText}
</strategy_plan>`;
    return { text, metrics };
  } catch (error) {
    console.error('[promptRewriter] Strategy plan failed:', error.message);
    return null;
  }
}
