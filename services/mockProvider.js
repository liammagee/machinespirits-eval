/**
 * Mock Provider for Dry-Run Mode
 *
 * Provides canned generation and judge results that bypass all LLM API calls.
 * Recognition-enabled cells produce higher scores to mimic the ~10-point
 * recognition effect observed in the paper's factorial results.
 */

// Simple deterministic pseudo-random from a seed string
function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  // Return value in [-1, 1] range
  return ((h & 0x7fffffff) % 1000) / 500 - 1;
}

/**
 * Generate a canned tutor suggestion result (replaces tutorApi.generateSuggestions).
 *
 * @param {Object} resolvedConfig - The resolved config with profileName, provider, model, etc.
 * @param {Object} turnMeta - Turn metadata (scenarioName, description, etc.)
 * @returns {Object} A genResult matching the shape from real tutor-core runs
 */
export function mockGenerateResult(resolvedConfig, turnMeta) {
  const profileName = resolvedConfig.profileName || 'budget';
  const isRecognition = profileName.includes('recognition') || profileName.includes('recog');

  const title = isRecognition ? 'Recognizing Your Learning Journey' : 'Getting Started with the Material';

  const message = isRecognition
    ? `I notice you're approaching this topic with genuine curiosity, and I want to honor that. Let's explore ${turnMeta.scenarioName || 'this concept'} together by first acknowledging what you already understand. Your perspective matters here — when we recognize each other as autonomous thinkers, we create space for deeper understanding. What aspects of this topic feel most alive to you right now?`
    : `Here's an overview of ${turnMeta.scenarioName || 'this concept'}. Let me break it down into manageable steps. First, let's cover the key definitions. Then we'll work through some examples to build your understanding. Feel free to ask questions as we go along.`;

  const reasoning = isRecognition
    ? 'Applied mutual recognition framework: acknowledged learner autonomy, invited dialogue as co-inquiry, used Hegelian recognition patterns to validate existing knowledge.'
    : 'Used standard pedagogical approach: structured explanation with clear progression from definitions to examples.';

  return {
    success: true,
    suggestions: [
      {
        type: 'proactive_suggestion',
        title,
        message,
        reasoning,
        actionTarget: 'content_engagement',
        priority: 'high',
      },
    ],
    metadata: {
      latencyMs: 42,
      inputTokens: 350,
      outputTokens: 180,
      apiCalls: 1,
      totalCost: 0,
      provider: 'dry-run',
      model: 'mock-v1',
      dialogueRounds: resolvedConfig.superegoModel ? 2 : 0,
      converged: true,
    },
    dialogueTrace: resolvedConfig.superegoModel
      ? [
          { agent: 'ego', action: 'generate', suggestions: [{ title, type: 'proactive_suggestion' }] },
          { agent: 'superego', action: 'review', approved: true, feedback: 'Pedagogically sound approach.' },
        ]
      : [],
  };
}

/**
 * Generate a canned judge rubric result (replaces rubricEvaluator.evaluateSuggestion).
 *
 * Recognition cells score ~87 (±3 jitter), base cells score ~77 (±3 jitter),
 * producing the ~10-point effect documented in the paper.
 *
 * @param {Object} config - Config object with profileName or factors
 * @param {string} [seed] - Optional seed for deterministic jitter (e.g. scenarioId)
 * @returns {Object} A rubricResult matching the shape from evaluateSuggestion()
 */
export function mockJudgeResult(config, seed = '') {
  const profileName = config.profileName || '';
  const isRecognition =
    profileName.includes('recognition') ||
    profileName.includes('recog') ||
    config.factors?.prompt_type === 'recognition';

  // Deterministic jitter based on profile + seed
  const jitter = seededRandom(profileName + seed) * 0.3; // ±0.3 on 1-5 scale

  // Base scores (1-5 scale): recognition cells ~4.3, base cells ~3.8
  const baseLevel = isRecognition ? 4.3 : 3.8;

  const dimensions = {
    relevance: { base: baseLevel + 0.1, label: 'relevance' },
    specificity: { base: baseLevel - 0.1, label: 'specificity' },
    pedagogical: { base: baseLevel + 0.2, label: 'pedagogical_soundness' },
    personalization: { base: baseLevel, label: 'personalization' },
    actionability: { base: baseLevel - 0.2, label: 'actionability' },
    tone: { base: baseLevel + 0.15, label: 'tone' },
  };

  const scores = {};
  for (const [key, dim] of Object.entries(dimensions)) {
    const dimJitter = seededRandom(key + profileName + seed) * 0.3;
    const raw = dim.base + jitter + dimJitter;
    const clamped = Math.max(1, Math.min(5, raw));
    scores[key] = {
      score: Math.round(clamped * 10) / 10,
      reasoning: `[dry-run] ${key}: ${isRecognition ? 'Recognition-enhanced' : 'Standard'} pedagogical approach evaluated.`,
    };
  }

  // Calculate overall on 0-100 scale (same formula as rubricEvaluator)
  const avgScore = Object.values(scores).reduce((sum, s) => sum + s.score, 0) / Object.keys(scores).length;
  const overallScore = Math.round(((avgScore - 1) / 4) * 100 * 10) / 10;

  return {
    success: true,
    scores,
    overallScore,
    baseScore: overallScore, // Simplified for dry-run
    recognitionScore: isRecognition ? overallScore + 2 : null,
    passesRequired: true,
    passesForbidden: true,
    requiredMissing: [],
    forbiddenFound: [],
    summary: `[dry-run] ${isRecognition ? 'Recognition-theory enhanced' : 'Standard pedagogical'} response evaluated. Overall: ${overallScore}/100.`,
    judgeModel: 'dry-run/mock-judge-v1',
    evaluationTimeMs: 5,
  };
}
