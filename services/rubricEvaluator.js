/**
 * Rubric Evaluator Service
 *
 * Uses AI to evaluate tutor suggestions against the pedagogical rubric.
 * Judge model configuration is loaded from config/evaluation-rubric.yaml
 * Provider details are resolved from config/providers.yaml
 */

import * as evalConfigLoader from './evalConfigLoader.js';
import { jsonrepair } from 'jsonrepair';

// HTTP request timeout for all judge API calls (ms)
const API_CALL_TIMEOUT_MS = 60000;

// Debug logging helper - suppressed in transcript mode for clean output
function debugLog(...args) {
  if (process.env.TUTOR_TRANSCRIPT !== 'true') {
    console.log(...args);
  }
}

/**
 * Normalize a judge model label to a canonical, human-readable form.
 * Strips routing prefixes (e.g. "openrouter/anthropic/") and maps
 * known model IDs to short names with version numbers.
 *
 * Examples:
 *   "openrouter/anthropic/claude-sonnet-4.5" → "claude-sonnet-4.5"
 *   "openrouter/openai/gpt-5.2"             → "gpt-5.2"
 *   "openrouter/moonshotai/kimi-k2.5"       → "kimi-k2.5"
 *   "anthropic/claude-opus-4-5"              → "claude-opus-4.5"
 *   "openrouter/nvidia/nemotron-..."         → "nemotron"
 */
export function normalizeJudgeLabel(provider, model) {
  // For known model IDs, extract the canonical name
  const MODEL_MAP = {
    'anthropic/claude-opus-4.5': 'claude-opus-4.5',
    'anthropic/claude-opus-4-5': 'claude-opus-4.5',
    'anthropic/claude-opus-4-6': 'claude-opus-4.6',
    'anthropic/claude-sonnet-4.5': 'claude-sonnet-4.5',
    'anthropic/claude-sonnet-4-5': 'claude-sonnet-4.5',
    'anthropic/claude-haiku-4.5': 'claude-haiku-4.5',
    'anthropic/claude-haiku-4-5': 'claude-haiku-4.5',
    'openai/gpt-5.2': 'gpt-5.2',
    'openai/gpt-5-mini': 'gpt-5-mini',
    'openai/gpt-oss-120b': 'gpt-oss-120b',
    'moonshotai/kimi-k2.5': 'kimi-k2.5',
    'moonshotai/kimi-k2-thinking': 'kimi-k2',
    'deepseek/deepseek-v3.2': 'deepseek-v3.2',
    'z-ai/glm-4.7': 'glm-4.7',
    'z-ai/glm-5': 'glm-5',
    'google/gemini-3-flash-preview': 'gemini-3-flash',
    'google/gemini-3-pro-preview': 'gemini-3-pro',
    'minimax/minimax-m2.5': 'minimax-m2.5',
  };

  // Try direct model lookup (handles openrouter paths like "anthropic/claude-sonnet-4.5")
  if (MODEL_MAP[model]) return MODEL_MAP[model];

  // Try full provider/model path
  const fullPath = `${provider}/${model}`;
  if (MODEL_MAP[fullPath]) return MODEL_MAP[fullPath];

  // For nvidia/nemotron variants, normalize to "nemotron"
  if (model.includes('nemotron')) return 'nemotron';

  // Fallback: strip common routing prefixes, keep the model name
  const stripped = model
    .replace(/^(anthropic|openai|moonshotai|deepseek|z-ai|google|minimax|nvidia)\//, '')
    .replace(/:free$/, '');

  return stripped || `${provider}/${model}`;
}

/**
 * Get available judge configuration, resolving model references via providers.yaml
 * Tries primary model first, then fallback if primary is not configured
 *
 * @param {Object} [overrides] - Optional judge override
 * @param {Object} [overrides.judgeOverride] - Override judge model config
 * @param {string} [overrides.judgeOverride.model] - Model reference (e.g. 'anthropic/claude-opus-4.5')
 * @param {string} [overrides.judgeOverride.apiKeyEnv] - Env var name for API key
 * @param {Object} [overrides.judgeOverride.hyperparameters] - Override hyperparameters
 */
export function getAvailableJudge(overrides = {}) {
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
  const evalConfig = rubric?.judge;

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
    console.warn(`[rubricEvaluator] Failed to resolve primary judge: ${e.message}`);
  }

  // Try fallback
  if (evalConfig.fallback?.model) {
    try {
      const fallback = evalConfigLoader.resolveModel(evalConfig.fallback.model);
      if (fallback.isConfigured) {
        debugLog(`[rubricEvaluator] Using fallback judge: ${fallback.provider}/${fallback.model}`);
        return {
          provider: fallback.provider,
          model: fallback.model,
          apiKey: fallback.apiKey,
          baseUrl: fallback.baseUrl,
          hyperparameters: evalConfig.fallback.hyperparameters || evalConfig.hyperparameters || {},
        };
      }
    } catch (e) {
      console.warn(`[rubricEvaluator] Failed to resolve fallback judge: ${e.message}`);
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
 * Get the fallback judge config (if different from primary)
 */
function getFallbackJudge() {
  const rubric = evalConfigLoader.loadRubric();
  const evalConfig = rubric?.judge;

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
      const timeout = setTimeout(() => controller.abort(), API_CALL_TIMEOUT_MS); // 60 second timeout

      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature,
            include_reasoning: false,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          const errorBody = await res.text().catch(() => '');
          throw new Error(`OpenRouter API error: ${res.status} - ${errorBody.slice(0, 200)}`);
        }

        const data = await res.json().catch((err) => {
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
      const timeout = setTimeout(() => controller.abort(), API_CALL_TIMEOUT_MS);

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
          },
        );

        clearTimeout(timeout);

        if (!res.ok) {
          const errorBody = await res.text().catch(() => '');
          throw new Error(`Gemini API error: ${res.status} - ${errorBody.slice(0, 200)}`);
        }

        const data = await res.json().catch((err) => {
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
 * Format a dialogue transcript for the judge prompt.
 * Renders the conversation history and internal deliberation traces as
 * a readable exchange so the judge can evaluate the suggestion in context.
 *
 * @param {Object} dialogueContext - Dialogue context from the evaluation runner
 * @param {Array} dialogueContext.conversationHistory - Array of turn objects
 * @param {Array} dialogueContext.dialogueTrace - Current turn's dialogue trace
 * @param {Array} dialogueContext.consolidatedTrace - Full multi-turn consolidated trace
 * @returns {string|null} Formatted transcript section, or null if no dialogue data
 */
function formatDialogueTranscript(dialogueContext) {
  if (!dialogueContext) return null;

  const { conversationHistory, _dialogueTrace, consolidatedTrace } = dialogueContext;

  // Use consolidatedTrace if available (richest source), otherwise fall back to conversationHistory
  const trace = consolidatedTrace?.length > 0 ? consolidatedTrace : null;
  const history = conversationHistory?.length > 0 ? conversationHistory : null;

  if (!trace && !history) return null;

  const lines = [];

  if (trace) {
    // Format from consolidated trace (includes internal deliberation)
    let currentTurnIdx = -1;
    for (const entry of trace) {
      // Turn separator
      if (entry.turnIndex !== undefined && entry.turnIndex !== currentTurnIdx) {
        currentTurnIdx = entry.turnIndex;
        lines.push(`\n--- Turn ${currentTurnIdx} ---`);
      }

      if (entry.agent === 'user' && entry.action === 'turn_action') {
        lines.push(`[Learner Action] ${entry.detail || entry.contextSummary}`);
      } else if (entry.agent === 'learner_ego') {
        lines.push(`  (Learner Ego: ${truncate(entry.detail || entry.contextSummary, 200)})`);
      } else if (entry.agent === 'learner_superego') {
        lines.push(`  (Learner Superego: ${truncate(entry.detail || entry.contextSummary, 200)})`);
      } else if (entry.agent === 'learner_synthesis') {
        lines.push(`[Learner] "${truncate(entry.detail || entry.contextSummary, 300)}"`);
      } else if (entry.agent === 'ego' && entry.action === 'initial_draft') {
        lines.push(`  (Tutor Ego draft: ${truncate(entry.contextSummary || '', 150)})`);
      } else if (entry.agent === 'superego') {
        lines.push(`  (Tutor Superego: ${truncate(entry.contextSummary || '', 150)})`);
      } else if (entry.agent === 'ego' && (entry.action === 'revision' || entry.action === 'final_revision')) {
        lines.push(`[Tutor] (revised after superego feedback)`);
      } else if (entry.agent === 'user' && entry.action === 'final_output') {
        lines.push(`[Tutor → Learner] Delivered ${entry.suggestionCount} suggestion(s)`);
      } else if (entry.agent === 'ego') {
        // Single-agent tutor response
        lines.push(`[Tutor] ${truncate(entry.contextSummary || '', 200)}`);
      }
    }
  } else if (history) {
    // Format from conversation history (less detail, no internal deliberation)
    for (const turn of history) {
      lines.push(`\n--- Turn ${turn.turnIndex} ---`);
      if (turn.learnerMessage) {
        lines.push(`[Learner] "${truncate(turn.learnerMessage, 300)}"`);
      } else if (turn.learnerAction) {
        lines.push(`[Learner Action] ${turn.learnerAction}`);
      }
      if (turn.suggestion) {
        const msg = turn.suggestion.message || turn.suggestion.title || '';
        lines.push(`[Tutor] "${truncate(msg, 300)}"`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Truncate a string to maxLen characters, adding ellipsis if needed.
 */
function truncate(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Build the evaluation prompt for the judge model
 */
function buildEvaluationPrompt(suggestion, scenario, context) {
  const dimensions = evalConfigLoader.getRubricDimensions();

  // Build dimension criteria text
  const dimensionCriteria = Object.entries(dimensions)
    .map(([_key, dim]) => {
      const criteriaText = Object.entries(dim.criteria || {})
        .map(([score, desc]) => `  ${score}: ${desc}`)
        .join('\n');
      return `**${dim.name}** (weight: ${(dim.weight * 100).toFixed(0)}%)
${dim.description}
Criteria:
${criteriaText}`;
    })
    .join('\n\n');

  // Build optional dialogue transcript section
  const dialogueTranscript = formatDialogueTranscript(context.dialogueContext);
  const dialogueSection = dialogueTranscript
    ? `\n## DIALOGUE TRANSCRIPT

The following is the full learner-tutor exchange leading to this suggestion. Internal deliberation traces (ego/superego) show the reasoning process. Use this context to evaluate how well the tutor responded to the learner's actual engagement, struggle, and development.

${dialogueTranscript}
`
    : '';

  return `You are an expert evaluator of AI tutoring systems. Evaluate the following AI tutor suggestion against the pedagogical rubric.${dialogueTranscript ? " The suggestion was produced in the context of a multi-turn dialogue — evaluate it in that context, considering how the tutor responds to the learner's actual engagement and development." : ''}

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
${dialogueSection}
## SUGGESTION TO EVALUATE

\`\`\`json
${JSON.stringify(suggestion, null, 2)}
\`\`\`

## VALIDATION REQUIREMENTS

Required elements (must include):
${(scenario.requiredElements || []).map((e) => `- ${e}`).join('\n') || '- None specified'}

Forbidden elements (must NOT include):
${(scenario.forbiddenElements || []).map((e) => `- ${e}`).join('\n') || '- None specified'}

## YOUR TASK

Evaluate the suggestion${dialogueTranscript ? ' in the context of the dialogue above' : ''} and provide:
1. A score (1-5) for each dimension with reasoning
2. Whether it passes the required/forbidden element checks
3. An overall score (weighted average, 0-100 scale)

For each dimension, include:
- **score**: 1-5 rating
- **reasoning**: Brief explanation of why this score was given${dialogueTranscript ? ". For recognition dimensions, consider how the tutor engaged with the learner's actual responses and development." : ''}

CRITICAL JSON RULES:
- Never use unescaped double quotes inside JSON string values. Use single quotes or rephrase.
- Keep "reasoning" values under 25 words.
- BAD:  "reasoning": "Says "great job" which is encouraging"
- GOOD: "reasoning": "Says 'great job' which is encouraging"

Respond with ONLY a JSON object in this exact format (no other text before or after):
\`\`\`json
{
  "scores": {
    "relevance": {"score": 4, "reasoning": "Matches idle state well"},
    "specificity": {"score": 5, "reasoning": "Names exact lecture"},
    "pedagogical_soundness": {"score": 4, "reasoning": "Uses scaffolding"},
    "personalization": {"score": 3, "reasoning": "Generic advice"},
    "actionability": {"score": 5, "reasoning": "Clear next step"},
    "tone": {"score": 4, "reasoning": "Encouraging tone"},
    "mutual_recognition": {"score": 4, "reasoning": "Acknowledges interpretation"},
    "dialectical_responsiveness": {"score": 3, "reasoning": "Responds without tension"},
    "memory_integration": {"score": 4, "reasoning": "References prior session"},
    "transformative_potential": {"score": 3, "reasoning": "Informative not transformative"},
    "tutor_adaptation": {"score": 3, "reasoning": "Some adjustment to input"},
    "learner_growth": {"score": 4, "reasoning": "Shows conceptual development"},
    "productive_struggle": {"score": 4, "reasoning": "Sustains appropriate tension"},
    "epistemic_honesty": {"score": 4, "reasoning": "Represents complexity fairly"}
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
// Models/prefixes that support response_format: { type: "json_object" }
const JSON_MODE_PREFIXES = ['gpt-', 'deepseek-', 'claude-'];

function supportsJsonMode(model) {
  return JSON_MODE_PREFIXES.some((prefix) => model.startsWith(prefix));
}

async function callJudgeModel(prompt, overrides = {}) {
  const judge = getAvailableJudge(overrides);
  const { provider, model, hyperparameters } = judge;
  const temperature = hyperparameters?.temperature ?? 0.2;
  const maxTokens = hyperparameters?.max_tokens ?? 1500;

  if (provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_CALL_TIMEOUT_MS);

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

      const data = await res.json().catch((err) => {
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
    const timeout = setTimeout(() => controller.abort(), API_CALL_TIMEOUT_MS);

    try {
      const body = {
        model,
        max_tokens: maxTokens,
        temperature,
        include_reasoning: false,
        messages: [{ role: 'user', content: prompt }],
      };
      if (supportsJsonMode(model)) {
        body.response_format = { type: 'json_object' };
      }

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '');
        throw new Error(`OpenRouter API error: ${res.status} - ${errorBody.slice(0, 200)}`);
      }

      const data = await res.json().catch((err) => {
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
    const timeout = setTimeout(() => controller.abort(), API_CALL_TIMEOUT_MS);

    try {
      const body = {
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [{ role: 'user', content: prompt }],
      };
      if (supportsJsonMode(model)) {
        body.response_format = { type: 'json_object' };
      }

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '');
        throw new Error(`OpenAI API error: ${res.status} - ${errorBody.slice(0, 200)}`);
      }

      const data = await res.json().catch((err) => {
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
    const timeout = setTimeout(() => controller.abort(), API_CALL_TIMEOUT_MS);

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
        },
      );

      clearTimeout(timeout);

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '');
        throw new Error(`Gemini API error: ${res.status} - ${errorBody.slice(0, 200)}`);
      }

      const data = await res.json().catch((err) => {
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
 * Repair unescaped double quotes inside JSON string values.
 * Targets patterns like: "key": "text with "inner" quotes"
 * Replaces inner unescaped quotes with single quotes.
 */
function repairUnescapedQuotes(jsonStr) {
  // Strategy: walk through the string tracking whether we're inside a JSON string value.
  // When we find a quote that isn't at a key/value boundary, replace it with a single quote.
  let result = '';
  let i = 0;
  const len = jsonStr.length;

  while (i < len) {
    const ch = jsonStr[i];

    if (ch === '"') {
      // Find the matching close quote for this JSON string
      result += '"';
      i++;
      // Scan for the true end of this string value
      while (i < len) {
        const c = jsonStr[i];
        if (c === '\\') {
          // Escaped character — pass through both chars
          result += jsonStr[i] + (jsonStr[i + 1] || '');
          i += 2;
          continue;
        }
        if (c === '"') {
          // Is this the real end of the string? Look ahead for JSON structure chars
          const after = jsonStr.slice(i + 1).trimStart();
          if (after[0] === ':' || after[0] === ',' || after[0] === '}' || after[0] === ']' || after.length === 0) {
            // This is a real closing quote
            result += '"';
            i++;
            break;
          } else {
            // This is an unescaped inner quote — replace with single quote
            result += "'";
            i++;
            continue;
          }
        }
        result += c;
        i++;
      }
    } else {
      result += ch;
      i++;
    }
  }

  return result;
}

/**
 * Last-resort regex extraction of individual dimension scores.
 * Returns a partial result object or null if too few scores found.
 */
function regexScoreRescue(text) {
  const dimensionNames = [
    'relevance',
    'specificity',
    'pedagogical_soundness',
    'personalization',
    'actionability',
    'tone',
    'mutual_recognition',
    'dialectical_responsiveness',
    'memory_integration',
    'transformative_potential',
    'tutor_adaptation',
    'learner_growth',
    'productive_struggle',
    'epistemic_honesty',
  ];

  const scores = {};
  for (const dim of dimensionNames) {
    // Match patterns like: "relevance": {"score": 4  or  "relevance":{"score":4
    const pattern = new RegExp(`"${dim}"\\s*:\\s*\\{?\\s*"?score"?\\s*:\\s*(\\d)`, 'i');
    const match = text.match(pattern);
    if (match) {
      scores[dim] = { score: parseInt(match[1], 10), reasoning: null };
    }
  }

  // Need at least 3 scores for a useful partial result
  if (Object.keys(scores).length < 3) return null;

  debugLog(`[rubricEvaluator] Regex rescue recovered ${Object.keys(scores).length} scores`);

  // Try to extract overall_score and summary
  const overallMatch = text.match(/"overall_score"\s*:\s*(\d+)/);
  const summaryMatch = text.match(/"summary"\s*:\s*"([^"]+)"/);

  return {
    scores,
    validation: { passes_required: true, required_missing: [], passes_forbidden: true, forbidden_found: [] },
    overall_score: overallMatch ? parseInt(overallMatch[1], 10) : null,
    summary: summaryMatch ? summaryMatch[1] : 'Partial scores recovered via regex rescue',
  };
}

/**
 * Parse the judge model's JSON response
 */
function parseJudgeResponse(responseText) {
  // Extract JSON from response (may be wrapped in markdown code block)
  let jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);

  if (!jsonMatch) {
    // Strip preamble/postamble text — find first { and last }
    const firstBrace = responseText.indexOf('{');
    const lastBrace = responseText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonMatch = [null, responseText.slice(firstBrace, lastBrace + 1)];
    }
  }

  if (!jsonMatch) {
    throw new Error('Could not parse judge response as JSON');
  }

  const jsonStr = jsonMatch[1] || jsonMatch[0];

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // Try to fix common JSON issues: trailing commas, unescaped newlines in strings
    const cleaned = jsonStr
      .replace(/,\s*([}\]])/g, '$1') // trailing commas
      .replace(
        // eslint-disable-next-line no-control-regex
        /[\x00-\x1f]/g,
        (
          m, // control chars in strings
        ) => (m === '\n' ? '\\n' : m === '\t' ? '\\t' : m === '\r' ? '\\r' : ''),
      );
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      // Attempt JSON repair: fix unescaped double quotes inside string values
      // Pattern: "key": "text with "inner" quotes" → "key": "text with 'inner' quotes"
      debugLog('[rubricEvaluator] Attempting JSON repair for unescaped quotes...');
      try {
        const repaired = repairUnescapedQuotes(cleaned);
        return JSON.parse(repaired);
      } catch (e3) {
        // Final fallback: use jsonrepair library which handles many more edge cases
        debugLog('[rubricEvaluator] Attempting jsonrepair library fallback...');
        try {
          const robustRepaired = jsonrepair(jsonStr);
          return JSON.parse(robustRepaired);
        } catch (e4) {
          // Last resort: regex rescue — extract individual scores
          debugLog('[rubricEvaluator] Attempting regex score rescue...');
          const rescued = regexScoreRescue(jsonStr);
          if (rescued) return rescued;
          throw new Error(
            `Could not parse judge response as JSON: initial=${e.message}, repair=${e3.message}, jsonrepair=${e4.message}`,
          );
        }
      }
    }
  }
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
  const judge = getAvailableJudge(overrides);

  try {
    const prompt = buildEvaluationPrompt(suggestion, scenario, context);
    let responseText = await callJudgeModel(prompt, overrides);

    // Log raw response for debugging
    debugLog('[rubricEvaluator] Judge raw response (first 300 chars):', responseText.slice(0, 300));

    // Handle empty response - try fallback model
    if (!responseText || responseText.trim() === '') {
      console.warn('[rubricEvaluator] Primary judge returned empty response, trying fallback...');
      const fallbackConfig = getFallbackJudge();
      if (fallbackConfig) {
        responseText = await callJudgeModelWithConfig(prompt, fallbackConfig);
        debugLog('[rubricEvaluator] Fallback response (first 300 chars):', responseText.slice(0, 300));
      }
      if (!responseText || responseText.trim() === '') {
        throw new Error('Judge model returned empty response (primary and fallback)');
      }
    }

    let parsed;
    try {
      parsed = parseJudgeResponse(responseText);
    } catch (parseError) {
      // JSON parse failed — retry with fallback model before giving up
      console.warn(`[rubricEvaluator] Parse failed (${parseError.message}), retrying with fallback...`);
      const fallbackConfig = getFallbackJudge();
      if (fallbackConfig) {
        let retryText = await callJudgeModelWithConfig(prompt, fallbackConfig);
        if (retryText && retryText.trim()) {
          try {
            parsed = parseJudgeResponse(retryText);
          } catch (retryParseError) {
            // Second attempt: models are non-deterministic, retry once more
            console.warn(
              `[rubricEvaluator] Fallback parse also failed (${retryParseError.message}), retrying once more...`,
            );
            retryText = await callJudgeModelWithConfig(prompt, fallbackConfig);
            if (retryText && retryText.trim()) {
              parsed = parseJudgeResponse(retryText);
            } else {
              throw retryParseError;
            }
          }
        } else {
          throw parseError;
        }
      } else {
        throw parseError;
      }
    }

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
      // Handle both {score, reasoning} objects and plain numbers
      if (typeof value === 'object' && value !== null) {
        scores[normalizedKey] = {
          score: value.score,
          reasoning: value.reasoning,
        };
      } else if (typeof value === 'number') {
        scores[normalizedKey] = {
          score: value,
          reasoning: null,
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
      baseScore: calculateBaseScore(scores),
      recognitionScore: calculateRecognitionScore(scores),
      passesRequired: parsed.validation?.passes_required ?? true,
      passesForbidden: parsed.validation?.passes_forbidden ?? true,
      requiredMissing: parsed.validation?.required_missing || [],
      forbiddenFound: parsed.validation?.forbidden_found || [],
      summary: parsed.summary,
      judgeModel: normalizeJudgeLabel(judge.provider, judge.model),
      evaluationTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      scores: {},
      overallScore: null,
      baseScore: null,
      recognitionScore: null,
      error: error.message,
      judgeModel: normalizeJudgeLabel(judge.provider, judge.model),
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
    const dimensions = [
      'relevance',
      'specificity',
      'pedagogical',
      'personalization',
      'actionability',
      'tone',
      'productive_struggle',
      'epistemic_honesty',
    ];

    for (const dim of dimensions) {
      const scores = results.filter((r) => r.success && r.scores?.[dim]).map((r) => r.scores[dim].score);

      if (scores.length > 0) {
        avgScores[dim] = scores.reduce((a, b) => a + b, 0) / scores.length;
      }
    }

    const overallScores = results.filter((r) => r.success).map((r) => r.overallScore);
    const avgOverall = overallScores.length > 0 ? overallScores.reduce((a, b) => a + b, 0) / overallScores.length : 0;

    return {
      individualResults: results,
      aggregateScores: avgScores,
      aggregateOverall: avgOverall,
      allPassRequired: results.every((r) => r.passesRequired),
      allPassForbidden: results.every((r) => r.passesForbidden),
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
  const userFacingText = [suggestion.title || '', suggestion.message || ''].join(' ').toLowerCase();

  const result = {
    passesRequired: true,
    passesForbidden: true,
    requiredMissing: [],
    forbiddenFound: [],
    // Transformation marker analysis (for multi-turn scenarios)
    transformationMarkersFound: [],
    staticMarkersFound: [],
    learnerGrowthMarkersFound: [],
    learnerStaticMarkersFound: [],
    transformationScore: null,
    learnerGrowthScore: null,
    bilateralTransformationScore: null,
  };

  // Check required elements (can appear anywhere including actionTarget, reasoning)
  // ALL elements in requiredElements must be present
  for (const required of scenario.requiredElements || []) {
    const normalizedRequired = required.toLowerCase();
    const found =
      fullSuggestionText.includes(normalizedRequired) ||
      (suggestion.actionTarget && suggestion.actionTarget.toLowerCase().includes(normalizedRequired)) ||
      (suggestion.title && suggestion.title.toLowerCase().includes(normalizedRequired)) ||
      (suggestion.message && suggestion.message.toLowerCase().includes(normalizedRequired));

    if (!found) {
      result.passesRequired = false;
      result.requiredMissing.push(required);
    }
  }

  // Check requiredElementsAny - ANY one of these must be present
  const anyElements = scenario.requiredElementsAny || [];
  if (anyElements.length > 0) {
    const anyFound = anyElements.some((required) => {
      const normalizedRequired = required.toLowerCase();
      return (
        fullSuggestionText.includes(normalizedRequired) ||
        (suggestion.actionTarget && suggestion.actionTarget.toLowerCase().includes(normalizedRequired)) ||
        (suggestion.title && suggestion.title.toLowerCase().includes(normalizedRequired)) ||
        (suggestion.message && suggestion.message.toLowerCase().includes(normalizedRequired))
      );
    });

    if (!anyFound) {
      result.passesRequired = false;
      result.requiredMissing.push(`one of: ${anyElements.join(', ')}`);
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

  // Check transformation markers (for multi-turn scenarios)
  const markers = scenario.transformationMarkers || scenario.transformation_markers;
  if (markers) {
    // Tutor evolving markers (in tutor response)
    const tutorEvolving = markers.tutor_evolving || markers.tutorEvolving || [];
    for (const marker of tutorEvolving) {
      if (userFacingText.includes(marker.toLowerCase())) {
        result.transformationMarkersFound.push(marker);
      }
    }

    // Tutor static markers (in tutor response)
    const tutorStatic = markers.tutor_static || markers.tutorStatic || [];
    for (const marker of tutorStatic) {
      if (userFacingText.includes(marker.toLowerCase())) {
        result.staticMarkersFound.push(marker);
      }
    }

    // Calculate tutor transformation score
    const tutorEvolvingCount = result.transformationMarkersFound.length;
    const tutorStaticCount = result.staticMarkersFound.length;
    const tutorTotal = tutorEvolvingCount + tutorStaticCount;
    if (tutorTotal > 0) {
      result.transformationScore = tutorEvolvingCount / tutorTotal;
    }

    // Learner growth markers (these will typically be found in context/history, not suggestion)
    // Included for completeness when analyzing full dialogue
    const learnerEvolving = markers.learner_evolving || markers.learnerEvolving || [];
    const learnerStatic = markers.learner_static || markers.learnerStatic || [];

    // Store marker definitions for use by turn analysis
    result._markerDefinitions = {
      tutorEvolving,
      tutorStatic,
      learnerEvolving,
      learnerStatic,
    };
  }

  return result;
}

// Dimension groups for dual scoring
const BASE_DIMENSIONS = [
  'relevance',
  'specificity',
  'pedagogical',
  'personalization',
  'actionability',
  'tone',
  'productive_struggle',
  'epistemic_honesty',
];
const RECOGNITION_DIMENSIONS = [
  'mutual_recognition',
  'dialectical_responsiveness',
  'memory_integration',
  'transformative_potential',
  'tutor_adaptation',
  'learner_growth',
];

/**
 * Calculate base score from the 6 core pedagogical dimensions.
 * Weights are re-normalized to sum to 1.0 across only the base dimensions.
 *
 * @param {Object} scores - Scores object from evaluation
 * @returns {number} 0-100 score
 */
export function calculateBaseScore(scores) {
  const dimensions = evalConfigLoader.getRubricDimensions();
  const keyMap = { pedagogical_soundness: 'pedagogical' };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const [key, dim] of Object.entries(dimensions)) {
    const normalizedKey = keyMap[key] || key;
    if (!BASE_DIMENSIONS.includes(normalizedKey)) continue;

    const scoreData = scores[normalizedKey] || scores[key];
    const score = scoreData?.score ?? scoreData;

    if (typeof score === 'number') {
      weightedSum += score * (dim.weight || 0);
      totalWeight += dim.weight || 0;
    }
  }

  if (totalWeight === 0) return 0;
  const avgScore = weightedSum / totalWeight;
  return ((avgScore - 1) / 4) * 100;
}

/**
 * Calculate recognition score from the 4 recognition dimensions.
 * Weights are re-normalized to sum to 1.0 across only the recognition dimensions.
 *
 * @param {Object} scores - Scores object from evaluation
 * @returns {number} 0-100 score
 */
export function calculateRecognitionScore(scores) {
  const dimensions = evalConfigLoader.getRubricDimensions();

  let weightedSum = 0;
  let totalWeight = 0;

  for (const [key, dim] of Object.entries(dimensions)) {
    if (!RECOGNITION_DIMENSIONS.includes(key)) continue;

    const scoreData = scores[key];
    const score = scoreData?.score ?? scoreData;

    if (typeof score === 'number') {
      weightedSum += score * (dim.weight || 0);
      totalWeight += dim.weight || 0;
    }
  }

  if (totalWeight === 0) return 0;
  const avgScore = weightedSum / totalWeight;
  return ((avgScore - 1) / 4) * 100;
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
    'tutor_adaptation',
    'learner_growth',
  ];

  const metrics = {
    recognitionScore: 0,
    transformationRate: false,
    memoryUtilization: false,
    mutualAcknowledgment: false,
    tutorAdaptation: false,
    learnerGrowth: false,
    bilateralTransformation: false,
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
      if (dim === 'tutor_adaptation' && score >= 4) {
        metrics.tutorAdaptation = true;
      }
      if (dim === 'learner_growth' && score >= 4) {
        metrics.learnerGrowth = true;
      }
    }
  }

  // Bilateral transformation: both tutor and learner show adaptation
  metrics.bilateralTransformation = metrics.tutorAdaptation && metrics.learnerGrowth;

  if (scoredCount > 0) {
    metrics.recognitionScore = totalScore / scoredCount;
    metrics.hasRecognitionData = true;
  }

  return metrics;
}

export { buildEvaluationPrompt };

export default {
  evaluateSuggestion,
  evaluateSuggestions,
  quickValidate,
  calculateOverallScore,
  calculateBaseScore,
  calculateRecognitionScore,
  calculateRecognitionMetrics,
  getAvailableJudge,
  buildEvaluationPrompt,
};
