/**
 * Rubric Evaluator Service
 *
 * Uses AI to evaluate tutor suggestions against the pedagogical rubric.
 * Judge model configuration is loaded from config/evaluation-rubric.yaml
 * Provider details are resolved from config/providers.yaml
 */

import * as evalConfigLoader from './evalConfigLoader.js';

// Debug logging helper - suppressed in transcript mode for clean output
function debugLog(...args) {
  if (process.env.TUTOR_TRANSCRIPT !== 'true') {
    console.log(...args);
  }
}

/**
 * Get available evaluator configuration, resolving model references via providers.yaml
 * Tries primary model first, then fallback if primary is not configured
 *
 * @param {Object} [overrides] - Optional judge override
 * @param {Object} [overrides.judgeOverride] - Override judge model config
 * @param {string} [overrides.judgeOverride.model] - Model reference (e.g. 'anthropic/claude-opus-4.5')
 * @param {string} [overrides.judgeOverride.apiKeyEnv] - Env var name for API key
 * @param {Object} [overrides.judgeOverride.hyperparameters] - Override hyperparameters
 */
function getAvailableEvaluator(overrides = {}) {
  const { judgeOverride } = overrides;

  // If a judge override is provided, resolve and return it directly
  if (judgeOverride?.model) {
    try {
      const resolved = evalConfigLoader.resolveModel(judgeOverride.model);
      // Allow apiKeyEnv override
      let apiKey = resolved.apiKey;
      if (judgeOverride.apiKeyEnv) {
        apiKey = process.env[judgeOverride.apiKeyEnv] || apiKey;
      }
      return {
        provider: resolved.provider,
        model: resolved.model,
        apiKey,
        baseUrl: resolved.baseUrl,
        hyperparameters: judgeOverride.hyperparameters || {},
      };
    } catch (e) {
      console.warn(`[rubricEvaluator] Failed to resolve judge override: ${e.message}, falling back to rubric config`);
    }
  }

  const rubric = evalConfigLoader.loadRubric();
  // Prefer 'judge' config, fall back to legacy 'evaluator' for backwards compatibility
  const evalConfig = rubric?.judge || rubric?.evaluator;

  if (!evalConfig?.model) {
    console.warn('[rubricEvaluator] No judge config in evaluation-rubric.yaml, using defaults');
    return {
      provider: 'openrouter',
      model: 'deepseek/deepseek-chat-v3-0324',
      hyperparameters: { temperature: 0.2, max_tokens: 4000 },
    };
  }

  // Try primary model
  try {
    const resolved = evalConfigLoader.resolveModel(evalConfig.model);
    if (resolved.isConfigured) {
      return {
        provider: resolved.provider,
        model: resolved.model,
        apiKey: resolved.apiKey,
        baseUrl: resolved.baseUrl,
        hyperparameters: evalConfig.hyperparameters || {},
      };
    }
  } catch (e) {
    console.warn(`[rubricEvaluator] Failed to resolve primary evaluator: ${e.message}`);
  }

  // Try fallback
  if (evalConfig.fallback?.model) {
    try {
      const fallback = evalConfigLoader.resolveModel(evalConfig.fallback.model);
      if (fallback.isConfigured) {
        debugLog(`[rubricEvaluator] Using fallback evaluator: ${fallback.provider}/${fallback.model}`);
        return {
          provider: fallback.provider,
          model: fallback.model,
          apiKey: fallback.apiKey,
          baseUrl: fallback.baseUrl,
          hyperparameters: evalConfig.fallback.hyperparameters || evalConfig.hyperparameters || {},
        };
      }
    } catch (e) {
      console.warn(`[rubricEvaluator] Failed to resolve fallback evaluator: ${e.message}`);
    }
  }

  // Return primary anyway - will fail with helpful error
  const resolved = evalConfigLoader.resolveModel(evalConfig.model);
  return {
    provider: resolved.provider,
    model: resolved.model,
    hyperparameters: evalConfig.hyperparameters || {},
  };
}

/**
 * Get the fallback evaluator config (if different from primary)
 */
function getFallbackEvaluator() {
  const rubric = evalConfigLoader.loadRubric();
  // Prefer 'judge' config, fall back to legacy 'evaluator'
  const evalConfig = rubric?.judge || rubric?.evaluator;

  if (!evalConfig?.fallback?.model) return null;

  try {
    const fallback = evalConfigLoader.resolveModel(evalConfig.fallback.model);
    if (fallback.isConfigured) {
      return {
        provider: fallback.provider,
        model: fallback.model,
        apiKey: fallback.apiKey,
        baseUrl: fallback.baseUrl,
        hyperparameters: evalConfig.fallback.hyperparameters || evalConfig.hyperparameters || {},
      };
    }
  } catch (e) {
    console.warn(`[rubricEvaluator] Failed to resolve fallback: ${e.message}`);
  }
  return null;
}

/**
 * Call judge model with explicit config
 */
async function callJudgeModelWithConfig(prompt, config) {
  const { provider, model, hyperparameters } = config;
  const temperature = hyperparameters?.temperature ?? 0.2;
  const maxTokens = hyperparameters?.max_tokens ?? 1500;

  debugLog(`[rubricEvaluator] Calling fallback judge: ${provider}/${model}`);

  // Wrap in try-catch to prevent unhandled rejections
  try {
    if (provider === 'openrouter') {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          const errorBody = await res.text().catch(() => '');
          throw new Error(`OpenRouter API error: ${res.status} - ${errorBody.slice(0, 200)}`);
        }

        const data = await res.json().catch(err => {
          throw new Error(`Failed to parse OpenRouter response: ${err.message}`);
        });

        return data.choices?.[0]?.message?.content || '';
      } catch (err) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
          throw new Error('OpenRouter API request timed out after 60s');
        }
        throw err;
      }
    }

    if (provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY not set');

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature,
                maxOutputTokens: maxTokens,
              },
            }),
            signal: controller.signal,
          }
        );

        clearTimeout(timeout);

        if (!res.ok) {
          const errorBody = await res.text().catch(() => '');
          throw new Error(`Gemini API error: ${res.status} - ${errorBody.slice(0, 200)}`);
        }

        const data = await res.json().catch(err => {
          throw new Error(`Failed to parse Gemini response: ${err.message}`);
        });

        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } catch (err) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
          throw new Error('Gemini API request timed out after 60s');
        }
        throw err;
      }
    }

    throw new Error(`Unsupported fallback provider: ${provider}`);
  } catch (error) {
    // Log the error before re-throwing to help debugging
    console.error(`[rubricEvaluator] Fallback judge error: ${error.message}`);
    throw error;
  }
}

/**
 * Build the evaluation prompt for the judge model
 */
function buildEvaluationPrompt(suggestion, scenario, context) {
  const dimensions = evalConfigLoader.getRubricDimensions();

  // Build dimension criteria text
  const dimensionCriteria = Object.entries(dimensions).map(([key, dim]) => {
    const criteriaText = Object.entries(dim.criteria || {})
      .map(([score, desc]) => `  ${score}: ${desc}`)
      .join('\n');
    return `**${dim.name}** (weight: ${(dim.weight * 100).toFixed(0)}%)
${dim.description}
Criteria:
${criteriaText}`;
  }).join('\n\n');

  return `You are an expert evaluator of AI tutoring systems. Evaluate the following AI tutor suggestion against the pedagogical rubric.

## EVALUATION RUBRIC

Score each dimension from 1-5:
- 1: Completely fails this criterion
- 2: Weak, significant issues
- 3: Adequate, meets basic expectations
- 4: Good, exceeds expectations
- 5: Excellent, exemplary

${dimensionCriteria}

## SCENARIO CONTEXT

**Scenario**: ${scenario.name}
**Description**: ${scenario.description}
**Expected Behavior**: ${scenario.expectedBehavior}

**Learner Context**:
${scenario.learnerContext || context.learnerContext || 'No context provided'}

## SUGGESTION TO EVALUATE

\`\`\`json
${JSON.stringify(suggestion, null, 2)}
\`\`\`

## VALIDATION REQUIREMENTS

Required elements (must include):
${(scenario.requiredElements || []).map(e => `- ${e}`).join('\n') || '- None specified'}

Forbidden elements (must NOT include):
${(scenario.forbiddenElements || []).map(e => `- ${e}`).join('\n') || '- None specified'}

## YOUR TASK

Evaluate the suggestion and provide:
1. A score (1-5) for each dimension with reasoning AND a direct quote from the suggestion that supports your assessment
2. Whether it passes the required/forbidden element checks
3. An overall score (weighted average, 0-100 scale)

For each dimension, include:
- **score**: 1-5 rating
- **reasoning**: Brief explanation of why this score was given
- **quote**: A short direct quote from the suggestion (title, message, or actionTarget) that exemplifies this dimension's score. Use "N/A" if no relevant quote exists.

Respond with ONLY a JSON object in this exact format:
\`\`\`json
{
  "scores": {
    "relevance": {"score": 4, "reasoning": "Matches learner's idle state", "quote": "Take your time with this concept"},
    "specificity": {"score": 5, "reasoning": "Names exact lecture", "quote": "479-lecture-3"},
    "pedagogical_soundness": {"score": 4, "reasoning": "Uses scaffolding", "quote": "Start with the basics before..."},
    "personalization": {"score": 3, "reasoning": "Generic advice", "quote": "N/A"},
    "actionability": {"score": 5, "reasoning": "Clear next step", "quote": "Click to continue to..."},
    "tone": {"score": 4, "reasoning": "Encouraging", "quote": "You're making great progress"},
    "mutual_recognition": {"score": 4, "reasoning": "Acknowledges learner's interpretation", "quote": "Your metaphor captures..."},
    "dialectical_responsiveness": {"score": 3, "reasoning": "Responds but doesn't create tension", "quote": "N/A"},
    "memory_integration": {"score": 4, "reasoning": "References previous session", "quote": "Building on your insight..."},
    "transformative_potential": {"score": 3, "reasoning": "Informative but not transformative", "quote": "N/A"}
  },
  "validation": {
    "passes_required": true,
    "required_missing": [],
    "passes_forbidden": true,
    "forbidden_found": []
  },
  "overall_score": 82,
  "summary": "Brief overall assessment"
}
\`\`\``;
}

/**
 * Call the judge model (simple single-model approach)
 *
 * @param {string} prompt - The evaluation prompt
 * @param {Object} [overrides] - Optional overrides (passed to getAvailableEvaluator)
 */
async function callJudgeModel(prompt, overrides = {}) {
  const evaluator = getAvailableEvaluator(overrides);
  const { provider, model, hyperparameters } = evaluator;
  const temperature = hyperparameters?.temperature ?? 0.2;
  const maxTokens = hyperparameters?.max_tokens ?? 1500;

  if (provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '');
        throw new Error(`Anthropic API error: ${res.status} - ${errorBody.slice(0, 200)}`);
      }

      const data = await res.json().catch(err => {
        throw new Error(`Failed to parse Anthropic response: ${err.message}`);
      });

      return data.content?.[0]?.text || '';
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new Error('Anthropic API request timed out after 60s');
      }
      throw err;
    }
  }

  if (provider === 'openrouter') {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '');
        throw new Error(`OpenRouter API error: ${res.status} - ${errorBody.slice(0, 200)}`);
      }

      const data = await res.json().catch(err => {
        throw new Error(`Failed to parse OpenRouter response: ${err.message}`);
      });

      return data.choices?.[0]?.message?.content || '';
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new Error('OpenRouter API request timed out after 60s');
      }
      throw err;
    }
  }

  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '');
        throw new Error(`OpenAI API error: ${res.status} - ${errorBody.slice(0, 200)}`);
      }

      const data = await res.json().catch(err => {
        throw new Error(`Failed to parse OpenAI response: ${err.message}`);
      });

      return data.choices?.[0]?.message?.content || '';
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new Error('OpenAI API request timed out after 60s');
      }
      throw err;
    }
  }

  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature,
              maxOutputTokens: maxTokens,
            },
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '');
        throw new Error(`Gemini API error: ${res.status} - ${errorBody.slice(0, 200)}`);
      }

      const data = await res.json().catch(err => {
        throw new Error(`Failed to parse Gemini response: ${err.message}`);
      });

      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new Error('Gemini API request timed out after 60s');
      }
      throw err;
    }
  }

  throw new Error(`Unsupported judge provider: ${provider}`);
}

/**
 * Parse the judge model's JSON response
 */
function parseJudgeResponse(responseText) {
  // Extract JSON from response (may be wrapped in markdown code block)
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                    responseText.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('Could not parse judge response as JSON');
  }

  const jsonStr = jsonMatch[1] || jsonMatch[0];
  return JSON.parse(jsonStr);
}

/**
 * Evaluate a single suggestion against the rubric
 *
 * @param {Object} suggestion - The suggestion to evaluate
 * @param {Object} scenario - The test scenario
 * @param {Object} context - Additional context
 * @param {Object} [overrides] - Optional overrides
 * @param {Object} [overrides.judgeOverride] - Override judge model config
 * @returns {Promise<Object>} Evaluation result
 */
export async function evaluateSuggestion(suggestion, scenario, context = {}, overrides = {}) {
  const startTime = Date.now();
  const evaluator = getAvailableEvaluator(overrides);

  try {
    const prompt = buildEvaluationPrompt(suggestion, scenario, context);
    let responseText = await callJudgeModel(prompt, overrides);

    // Log raw response for debugging
    debugLog('[rubricEvaluator] Judge raw response (first 300 chars):', responseText.slice(0, 300));

    // Handle empty response - try fallback model
    if (!responseText || responseText.trim() === '') {
      console.warn('[rubricEvaluator] Primary judge returned empty response, trying fallback...');
      const fallbackConfig = getFallbackEvaluator();
      if (fallbackConfig) {
        responseText = await callJudgeModelWithConfig(prompt, fallbackConfig);
        debugLog('[rubricEvaluator] Fallback response (first 300 chars):', responseText.slice(0, 300));
      }
      if (!responseText || responseText.trim() === '') {
        throw new Error('Judge model returned empty response (primary and fallback)');
      }
    }

    const parsed = parseJudgeResponse(responseText);

    // Debug: log what was parsed
    debugLog('[rubricEvaluator] Parsed keys:', Object.keys(parsed));
    if (parsed.scores) {
      debugLog('[rubricEvaluator] Score keys:', Object.keys(parsed.scores));
    }

    // Warning if scores are missing
    if (!parsed.scores || Object.keys(parsed.scores).length === 0) {
      console.warn('[rubricEvaluator] Warning: Judge response missing dimension scores');
      console.warn('[rubricEvaluator] Full parsed response:', JSON.stringify(parsed, null, 2).slice(0, 800));
    }

    // Normalize dimension keys
    const scores = {};
    const dimensionMap = {
      relevance: 'relevance',
      specificity: 'specificity',
      pedagogical_soundness: 'pedagogical',
      pedagogical: 'pedagogical',
      personalization: 'personalization',
      actionability: 'actionability',
      tone: 'tone',
    };

    for (const [key, value] of Object.entries(parsed.scores || {})) {
      const normalizedKey = dimensionMap[key] || key;
      // Handle both {score, reasoning, quote} objects and plain numbers
      if (typeof value === 'object' && value !== null) {
        scores[normalizedKey] = {
          score: value.score,
          reasoning: value.reasoning,
          quote: value.quote || null,
        };
      } else if (typeof value === 'number') {
        scores[normalizedKey] = {
          score: value,
          reasoning: null,
          quote: null,
        };
      }
    }

    // Calculate overall score from dimension scores if available, otherwise use judge's score
    let overallScore = parsed.overall_score;
    if (Object.keys(scores).length > 0) {
      const calculatedScore = calculateOverallScore(scores);
      if (calculatedScore > 0) {
        overallScore = calculatedScore;
      }
    }

    return {
      success: true,
      scores,
      overallScore,
      passesRequired: parsed.validation?.passes_required ?? true,
      passesForbidden: parsed.validation?.passes_forbidden ?? true,
      requiredMissing: parsed.validation?.required_missing || [],
      forbiddenFound: parsed.validation?.forbidden_found || [],
      summary: parsed.summary,
      evaluatorModel: `${evaluator.provider}/${evaluator.model}`,
      evaluationTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      evaluatorModel: `${evaluator.provider}/${evaluator.model}`,
      evaluationTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Evaluate multiple suggestions (batch)
 */
export async function evaluateSuggestions(suggestions, scenario, context = {}, overrides = {}) {
  const results = [];

  for (const suggestion of suggestions) {
    const result = await evaluateSuggestion(suggestion, scenario, context, overrides);
    results.push(result);
  }

  // Aggregate scores if multiple suggestions
  if (results.length > 0 && results[0].success) {
    const avgScores = {};
    const dimensions = ['relevance', 'specificity', 'pedagogical', 'personalization', 'actionability', 'tone'];

    for (const dim of dimensions) {
      const scores = results
        .filter(r => r.success && r.scores?.[dim])
        .map(r => r.scores[dim].score);

      if (scores.length > 0) {
        avgScores[dim] = scores.reduce((a, b) => a + b, 0) / scores.length;
      }
    }

    const overallScores = results.filter(r => r.success).map(r => r.overallScore);
    const avgOverall = overallScores.length > 0
      ? overallScores.reduce((a, b) => a + b, 0) / overallScores.length
      : 0;

    return {
      individualResults: results,
      aggregateScores: avgScores,
      aggregateOverall: avgOverall,
      allPassRequired: results.every(r => r.passesRequired),
      allPassForbidden: results.every(r => r.passesForbidden),
    };
  }

  return {
    individualResults: results,
    aggregateScores: {},
    aggregateOverall: 0,
    allPassRequired: false,
    allPassForbidden: false,
  };
}

/**
 * Quick validation without AI (rule-based checks only)
 *
 * @param {Object} suggestion - The suggestion to validate
 * @param {Object} scenario - The test scenario
 * @returns {Object} Validation result
 */
export function quickValidate(suggestion, scenario) {
  // For required elements, check all fields including actionTarget
  const fullSuggestionText = JSON.stringify(suggestion).toLowerCase();

  // For forbidden elements, only check user-facing fields (title, message)
  // NOT the internal 'reasoning' field which may contain context-derived text
  const userFacingText = [
    suggestion.title || '',
    suggestion.message || '',
  ].join(' ').toLowerCase();

  const result = {
    passesRequired: true,
    passesForbidden: true,
    requiredMissing: [],
    forbiddenFound: [],
  };

  // Check required elements (can appear anywhere including actionTarget, reasoning)
  for (const required of scenario.requiredElements || []) {
    const normalizedRequired = required.toLowerCase();
    const found = fullSuggestionText.includes(normalizedRequired) ||
      (suggestion.actionTarget && suggestion.actionTarget.toLowerCase().includes(normalizedRequired)) ||
      (suggestion.title && suggestion.title.toLowerCase().includes(normalizedRequired)) ||
      (suggestion.message && suggestion.message.toLowerCase().includes(normalizedRequired));

    if (!found) {
      result.passesRequired = false;
      result.requiredMissing.push(required);
    }
  }

  // Check forbidden elements (only in user-facing text: title, message)
  // The 'reasoning' field is internal and may legitimately reference context terms
  for (const forbidden of scenario.forbiddenElements || []) {
    const normalizedForbidden = forbidden.toLowerCase();
    if (userFacingText.includes(normalizedForbidden)) {
      result.passesForbidden = false;
      result.forbiddenFound.push(forbidden);
    }
  }

  return result;
}

/**
 * Calculate weighted overall score from dimension scores
 */
export function calculateOverallScore(scores) {
  const dimensions = evalConfigLoader.getRubricDimensions();

  // Map rubric keys to normalized score keys (pedagogical_soundness -> pedagogical)
  const keyMap = {
    pedagogical_soundness: 'pedagogical',
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const [key, dim] of Object.entries(dimensions)) {
    // Try both the rubric key and the normalized key
    const normalizedKey = keyMap[key] || key;
    const scoreData = scores[normalizedKey] || scores[key];
    const score = scoreData?.score ?? scoreData;

    if (typeof score === 'number') {
      weightedSum += score * (dim.weight || 0);
      totalWeight += dim.weight || 0;
    }
  }

  if (totalWeight === 0) return 0;

  // Convert 1-5 scale to 0-100
  const avgScore = weightedSum / totalWeight;
  return ((avgScore - 1) / 4) * 100;
}

/**
 * Calculate recognition-specific metrics from scores
 * These metrics track the quality of mutual recognition between tutor and learner
 *
 * @param {Object} scores - Scores object from evaluation
 * @returns {Object} Recognition metrics
 */
export function calculateRecognitionMetrics(scores) {
  const recognitionDimensions = [
    'mutual_recognition',
    'dialectical_responsiveness',
    'memory_integration',
    'transformative_potential',
  ];

  const metrics = {
    recognitionScore: 0,
    transformationRate: false,
    memoryUtilization: false,
    mutualAcknowledgment: false,
    dimensionScores: {},
    hasRecognitionData: false,
  };

  let totalScore = 0;
  let scoredCount = 0;

  for (const dim of recognitionDimensions) {
    const scoreData = scores[dim];
    const score = scoreData?.score ?? scoreData;

    if (typeof score === 'number') {
      metrics.dimensionScores[dim] = score;
      totalScore += score;
      scoredCount++;

      // Track specific thresholds
      if (dim === 'transformative_potential' && score >= 4) {
        metrics.transformationRate = true;
      }
      if (dim === 'memory_integration' && score >= 3) {
        metrics.memoryUtilization = true;
      }
      if (dim === 'mutual_recognition' && score >= 4) {
        metrics.mutualAcknowledgment = true;
      }
    }
  }

  if (scoredCount > 0) {
    metrics.recognitionScore = totalScore / scoredCount;
    metrics.hasRecognitionData = true;
  }

  return metrics;
}

export default {
  evaluateSuggestion,
  evaluateSuggestions,
  quickValidate,
  calculateOverallScore,
  calculateRecognitionMetrics,
};
