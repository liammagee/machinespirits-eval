/**
 * Prompt Recommendation Service
 *
 * Analyzes evaluation results and generates recommendations to improve
 * tutor prompts. Uses a powerful recommender model to analyze failures
 * and weaknesses from weaker tutor models.
 *
 * Recommender configuration is loaded from config/evaluation-rubric.yaml
 * Provider details are resolved from config/providers.yaml
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as evalConfigLoader from './evalConfigLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PROMPTS_DIR = path.join(ROOT_DIR, 'prompts');

/**
 * Get recommender config, resolving model references via providers.yaml
 * Uses 'recommender' config from evaluation-rubric.yaml
 */
function getRecommenderConfig() {
  const rubric = evalConfigLoader.loadRubric();
  const evalConfig = rubric?.recommender;

  if (!evalConfig?.model) {
    console.warn('[promptRecommendation] No recommender in evaluation-rubric.yaml, using defaults');
    return {
      provider: 'openrouter',
      model: 'deepseek/deepseek-chat-v3-0324',
      hyperparameters: { temperature: 0.4, max_tokens: 6000 },
    };
  }

  // Try to resolve primary model
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
    console.warn(`[promptRecommendation] Failed to resolve model: ${e.message}`);
  }

  // Try fallback
  if (evalConfig.fallback?.model) {
    try {
      const fallback = evalConfigLoader.resolveModel(evalConfig.fallback.model);
      if (fallback.isConfigured) {
        console.log(`[promptRecommendation] Using fallback: ${fallback.provider}/${fallback.model}`);
        return {
          provider: fallback.provider,
          model: fallback.model,
          apiKey: fallback.apiKey,
          baseUrl: fallback.baseUrl,
          hyperparameters: evalConfig.fallback.hyperparameters || evalConfig.hyperparameters || {},
        };
      }
    } catch (e) {
      console.warn(`[promptRecommendation] Failed to resolve fallback: ${e.message}`);
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
 * Read a prompt file
 */
function readPromptFile(filename) {
  const filePath = path.join(PROMPTS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Analyze evaluation results to find patterns and issues
 */
function analyzeResults(results) {
  const analysis = {
    totalResults: results.length,
    successCount: results.filter((r) => r.success).length,
    failureCount: results.filter((r) => !r.success).length,
    avgScore: 0,
    lowScoreResults: [],
    validationFailures: [],
    dimensionWeaknesses: {},
    commonIssues: [],
  };

  // Calculate average and find low scores
  const scores = results.filter((r) => r.overallScore != null).map((r) => r.overallScore);
  if (scores.length > 0) {
    analysis.avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    analysis.lowScoreResults = results.filter((r) => r.overallScore != null && r.overallScore < 70).slice(0, 10); // Top 10 low scorers
  }

  // Find validation failures
  analysis.validationFailures = results
    .filter((r) => !r.passesRequired || !r.passesForbidden)
    .map((r) => ({
      scenarioId: r.scenarioId,
      scenarioName: r.scenarioName,
      requiredMissing: r.requiredMissing || [],
      forbiddenFound: r.forbiddenFound || [],
      suggestion: r.suggestions?.[0],
    }))
    .slice(0, 10);

  // Aggregate dimension scores
  const dimensionScores = {};
  for (const result of results) {
    if (result.scores) {
      for (const [dim, score] of Object.entries(result.scores)) {
        if (score != null) {
          if (!dimensionScores[dim]) dimensionScores[dim] = [];
          dimensionScores[dim].push(score);
        }
      }
    }
  }

  // Find weak dimensions (avg < 3.5 out of 5)
  for (const [dim, scores] of Object.entries(dimensionScores)) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg < 3.5) {
      analysis.dimensionWeaknesses[dim] = {
        avgScore: avg,
        sampleCount: scores.length,
      };
    }
  }

  return analysis;
}

/**
 * Build the analysis prompt for the recommender
 */
function buildAnalysisPrompt(analysis, egoPrompt, superegoPrompt, profileName) {
  const sections = [];

  sections.push(`# Prompt Improvement Analysis Request

You are an expert in LLM prompt engineering and educational AI systems. Your task is to analyze evaluation results from an AI tutoring system and recommend specific, actionable improvements to the prompts.

## Context

This tutoring system uses an Ego/Superego dialogue architecture:
- **Ego Agent**: The student-facing tutor that generates learning suggestions
- **Superego Agent**: The critic that reviews and refines suggestions

The evaluation tested profile: **${profileName || 'unknown'}**

## Evaluation Summary

- Total tests: ${analysis.totalResults}
- Successes: ${analysis.successCount}
- Failures: ${analysis.failureCount}
- Average score: ${analysis.avgScore.toFixed(1)}/100
`);

  // Dimension weaknesses
  if (Object.keys(analysis.dimensionWeaknesses).length > 0) {
    sections.push(`
## Weak Dimensions

The following rubric dimensions scored below 3.5/5 on average:

${Object.entries(analysis.dimensionWeaknesses)
  .map(([dim, data]) => `- **${dim}**: ${data.avgScore.toFixed(2)}/5 (${data.sampleCount} samples)`)
  .join('\n')}
`);
  }

  // Validation failures
  if (analysis.validationFailures.length > 0) {
    sections.push(`
## Validation Failures

These tests failed required/forbidden element checks:

${analysis.validationFailures
  .slice(0, 5)
  .map(
    (f) => `
### ${f.scenarioName} (${f.scenarioId})
- Required elements missing: ${f.requiredMissing.length > 0 ? f.requiredMissing.join(', ') : 'none'}
- Forbidden elements found: ${f.forbiddenFound.length > 0 ? f.forbiddenFound.join(', ') : 'none'}
- Generated suggestion: "${f.suggestion?.title || 'N/A'}" - ${f.suggestion?.message?.substring(0, 100) || 'N/A'}...
`,
  )
  .join('\n')}
`);
  }

  // Low score examples
  if (analysis.lowScoreResults.length > 0) {
    sections.push(`
## Low-Scoring Examples

These tests scored below 70/100:

${analysis.lowScoreResults
  .slice(0, 5)
  .map(
    (r) => `
### ${r.scenarioName} (score: ${r.overallScore?.toFixed(1)})
- Suggestion: "${r.suggestions?.[0]?.title || 'N/A'}"
- Message: ${r.suggestions?.[0]?.message?.substring(0, 150) || 'N/A'}...
- Evaluation reasoning: ${r.evaluationReasoning?.substring(0, 200) || 'N/A'}...
`,
  )
  .join('\n')}
`);
  }

  // Current prompts
  sections.push(`
## Current Ego Prompt

\`\`\`markdown
${egoPrompt?.substring(0, 3000) || 'Not available'}
${egoPrompt?.length > 3000 ? '\n... (truncated)' : ''}
\`\`\`

## Current Superego Prompt

\`\`\`markdown
${superegoPrompt?.substring(0, 3000) || 'Not available'}
${superegoPrompt?.length > 3000 ? '\n... (truncated)' : ''}
\`\`\`
`);

  // Request
  sections.push(`
## Your Task

Based on this analysis, provide specific recommendations to improve the prompts. Structure your response as:

1. **Key Issues Identified**: What patterns in the failures suggest prompt weaknesses?

2. **Ego Prompt Recommendations**:
   - Specific sections to modify
   - Exact text changes or additions
   - Rationale for each change

3. **Superego Prompt Recommendations**:
   - Specific sections to modify
   - Exact text changes or additions
   - Rationale for each change

4. **New Examples or Constraints**: Any new examples, edge cases, or constraints to add

5. **Priority Ranking**: Rank your recommendations by expected impact

Be specific and actionable. Quote exact text to change when possible.
`);

  return sections.join('\n');
}

/**
 * Call the recommender model to generate recommendations
 * Uses config from evaluation-rubric.yaml
 */
async function callRecommender(prompt, options = {}) {
  const { _budget = false } = options;

  // Get config from yaml (handles fallbacks automatically)
  const config = getRecommenderConfig();
  const { provider, model, hyperparameters } = config;
  const maxTokens = hyperparameters?.max_tokens ?? 4000;
  const temperature = hyperparameters?.temperature ?? 0.3;

  if (provider === 'openrouter') {
    return callOpenRouterEvaluator(prompt, model, { maxTokens, temperature });
  }

  if (provider !== 'anthropic') {
    throw new Error(`Provider ${provider} not yet supported for recommendations`);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set');
  }

  let Anthropic;
  try {
    Anthropic = (await import('@anthropic-ai/sdk')).default;
  } catch {
    throw new Error(
      '@anthropic-ai/sdk is not installed. Install it to use the Anthropic provider for recommendations.',
    );
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  return {
    content: response.content[0]?.text || '',
    model: response.model,
    inputTokens: response.usage?.input_tokens,
    outputTokens: response.usage?.output_tokens,
  };
}

/**
 * Call OpenRouter for evaluation
 */
async function callOpenRouterEvaluator(prompt, model, options = {}) {
  const { maxTokens = 4000, temperature = 0.3 } = options;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://machinespirits.org',
      'X-Title': 'Machine Spirits Tutor Eval',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  return {
    content,
    model: data.model || model,
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  };
}

/**
 * Generate prompt improvement recommendations based on evaluation results
 *
 * @param {Object} options - Options
 * @param {string} options.runId - Evaluation run ID to analyze
 * @param {Object[]} options.results - Or pass results directly
 * @param {string} options.profileName - Profile that was evaluated
 * @param {string} options.egoPromptFile - Ego prompt file to analyze
 * @param {string} options.superegoPromptFile - Superego prompt file to analyze
 * @param {string} options.recommenderModel - Model to use for analysis (default: claude-sonnet-4)
 * @param {string} options.recommenderProvider - Provider: 'anthropic' or 'openrouter'
 * @param {boolean} options.budget - Use budget recommender model
 * @returns {Promise<Object>} Recommendations
 */
export async function generateRecommendations(options = {}) {
  const {
    results = [],
    profileName = 'unknown',
    egoPromptFile = 'tutor-ego.md',
    superegoPromptFile = 'tutor-superego.md',
    _recommenderModel = null,
    _recommenderProvider = 'anthropic',
    _budget = false,
  } = options;

  if (results.length === 0) {
    throw new Error('No evaluation results provided');
  }

  // Read prompts
  const egoPrompt = readPromptFile(egoPromptFile);
  const superegoPrompt = readPromptFile(superegoPromptFile);

  if (!egoPrompt && !superegoPrompt) {
    throw new Error('Could not read any prompt files');
  }

  // Analyze results
  const analysis = analyzeResults(results);

  // Check if there's enough signal for recommendations
  if (analysis.avgScore > 90 && analysis.validationFailures.length === 0) {
    return {
      success: true,
      needsImprovement: false,
      message: 'Prompts are performing well. Average score is above 90 with no validation failures.',
      analysis,
    };
  }

  // Build analysis prompt
  const analysisPrompt = buildAnalysisPrompt(analysis, egoPrompt, superegoPrompt, profileName);

  // Get recommender config from yaml
  const evalConfig = getRecommenderConfig();
  console.log(`\nGenerating recommendations using ${evalConfig.provider}/${evalConfig.model}...`);

  const evalResult = await callRecommender(analysisPrompt);

  return {
    success: true,
    needsImprovement: true,
    analysis,
    recommendations: evalResult.content,
    recommenderModel: evalResult.model,
    usage: {
      inputTokens: evalResult.inputTokens,
      outputTokens: evalResult.outputTokens,
    },
  };
}

/**
 * Format recommendations for CLI display
 */
export function formatRecommendations(result) {
  const lines = [];

  lines.push('');
  lines.push('═'.repeat(80));
  lines.push('PROMPT IMPROVEMENT RECOMMENDATIONS');
  lines.push('═'.repeat(80));
  lines.push('');

  if (!result.needsImprovement) {
    lines.push('✓ ' + result.message);
    lines.push('');
    return lines.join('\n');
  }

  // Analysis summary
  lines.push('ANALYSIS SUMMARY');
  lines.push('─'.repeat(40));
  lines.push(`Total tests analyzed: ${result.analysis.totalResults}`);
  lines.push(`Average score: ${result.analysis.avgScore.toFixed(1)}/100`);
  lines.push(`Validation failures: ${result.analysis.validationFailures.length}`);

  if (Object.keys(result.analysis.dimensionWeaknesses).length > 0) {
    lines.push('');
    lines.push('Weak dimensions:');
    for (const [dim, data] of Object.entries(result.analysis.dimensionWeaknesses)) {
      lines.push(`  • ${dim}: ${data.avgScore.toFixed(2)}/5`);
    }
  }

  lines.push('');
  lines.push('─'.repeat(80));
  lines.push('');
  lines.push(result.recommendations);
  lines.push('');
  lines.push('─'.repeat(80));
  lines.push(`Recommender: ${result.recommenderModel}`);
  lines.push(`Tokens: ${result.usage.inputTokens} in / ${result.usage.outputTokens} out`);
  lines.push('═'.repeat(80));

  return lines.join('\n');
}

export default {
  generateRecommendations,
  formatRecommendations,
  analyzeResults,
};
