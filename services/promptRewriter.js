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
  const superegoModel = config.superego?.model || 'moonshotai/kimi-k2.5';
  const provider = config.superego?.provider || 'openrouter';

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
  const superegoModel = config.superego?.model || 'moonshotai/kimi-k2.5';
  const provider = config.superego?.provider || 'openrouter';

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
        maxTokens: 500,
      },
    });

    const dispositionText = response.content?.trim();
    if (!dispositionText || dispositionText.length < 20) {
      console.log('[promptRewriter] Superego disposition LLM returned empty or too-short result');
      return null;
    }

    return `<superego_disposition>
Based on analysis of your prior critiques and their impact on learner engagement, adjust your evaluation approach:

${dispositionText}

Apply these adjustments when reviewing the ego's next response. Your criteria should evolve with the dialogue — what matters in turn 1 differs from what matters in turn 5.
</superego_disposition>`;
  } catch (error) {
    console.error('[promptRewriter] Superego disposition synthesis failed:', error.message);
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
