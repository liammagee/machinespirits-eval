#!/usr/bin/env node
/**
 * Analyze Evaluation Costs
 *
 * Calculates token usage and costs for evaluation runs.
 * Supports both scripted and dynamic learner evaluations.
 *
 * Usage:
 *   node scripts/analyze-eval-costs.js                    # Analyze all recent evals
 *   node scripts/analyze-eval-costs.js --battery          # Analyze battery scenarios
 *   node scripts/analyze-eval-costs.js --file <path>      # Analyze specific file
 *   node scripts/analyze-eval-costs.js --summary          # Show cost summary only
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ============================================================================
// Model Pricing (per million tokens) - Update as needed
// ============================================================================

const MODEL_PRICING = {
  // OpenRouter pricing as of January 2026
  'nvidia/nemotron-3-nano-30b-a3b:free': {
    input: 0,
    output: 0,
    name: 'Nemotron 3 Nano 30B (free)',
  },
  'anthropic/claude-sonnet-4.5': {
    input: 3.00,
    output: 15.00,
    name: 'Claude Sonnet 4.5',
  },
  'anthropic/claude-haiku-4.5': {
    input: 0.80,
    output: 4.00,
    name: 'Claude Haiku 4.5',
  },
  'openai/gpt-5.2': {
    input: 2.50,
    output: 10.00,
    name: 'GPT-5.2',
  },
  'google/gemini-3-pro-preview': {
    input: 1.25,
    output: 5.00,
    name: 'Gemini 3 Pro',
  },
  // Aliases
  'nemotron': {
    input: 0,
    output: 0,
    name: 'Nemotron 3 Nano 30B (free)',
  },
  'sonnet': {
    input: 3.00,
    output: 15.00,
    name: 'Claude Sonnet 4.5',
  },
};

// Default model assignments by role
const DEFAULT_MODELS = {
  tutor_ego: 'nemotron',
  tutor_superego: 'nemotron',
  learner_ego: 'nemotron',
  learner_superego: 'nemotron',
  judge: 'sonnet',
};

// ============================================================================
// Cost Calculation Functions
// ============================================================================

function calculateCost(inputTokens, outputTokens, model) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['nemotron'];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    model: pricing.name,
  };
}

function estimateTokenSplit(totalTokens, inputRatio = 0.7) {
  // Estimate input/output split if not provided
  // Default assumes 70% input (prompts, context) and 30% output (responses)
  return {
    input: Math.round(totalTokens * inputRatio),
    output: Math.round(totalTokens * (1 - inputRatio)),
  };
}

// ============================================================================
// Analysis Functions
// ============================================================================

function analyzeBatteryScenario(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const metrics = data.metrics || {};

  // Extract scenario info
  const scenarioName = data.scenarioName || path.basename(filePath);
  const tutorProfile = data.tutorProfile;
  const learnerArch = data.learnerArchitecture;

  // Token counts
  const tutorTokens = metrics.tutorTokens || 0;
  const learnerTokens = metrics.learnerTokens || 0;
  const totalTokens = metrics.totalTokens || (tutorTokens + learnerTokens);

  // Estimate input/output split
  // Tutor: more output (responses), Learner: more output (responses)
  // Judge: high input (transcript), moderate output (evaluation)
  const tutorSplit = estimateTokenSplit(tutorTokens, 0.6);
  const learnerSplit = estimateTokenSplit(learnerTokens, 0.5);

  // Estimate judge tokens (transcript + rubric as input, evaluation as output)
  const judgeInput = Math.round(totalTokens * 0.8); // Transcript context
  const judgeOutput = 2000; // Typical evaluation response

  // Calculate costs
  const tutorCost = calculateCost(tutorSplit.input, tutorSplit.output, DEFAULT_MODELS.tutor_ego);
  const learnerCost = calculateCost(learnerSplit.input, learnerSplit.output, DEFAULT_MODELS.learner_ego);
  const judgeCost = calculateCost(judgeInput, judgeOutput, DEFAULT_MODELS.judge);

  return {
    scenario: scenarioName,
    tutorProfile,
    learnerArch,
    turns: metrics.turnCount || 0,
    latencyMs: metrics.totalLatencyMs || 0,
    tokens: {
      tutor: tutorTokens,
      learner: learnerTokens,
      total: totalTokens,
      judgeEstimate: judgeInput + judgeOutput,
    },
    costs: {
      tutor: tutorCost,
      learner: learnerCost,
      judge: judgeCost,
      total: tutorCost.totalCost + learnerCost.totalCost + judgeCost.totalCost,
    },
    score: data.judgeEvaluation?.overallScore || null,
  };
}

function analyzeBatteryDirectory(dirPath) {
  const files = fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.json') && f.includes('battery'))
    .map(f => path.join(dirPath, f));

  return files.map(f => analyzeBatteryScenario(f));
}

// ============================================================================
// Output Formatting
// ============================================================================

function formatCurrency(amount) {
  return `$${amount.toFixed(4)}`;
}

function formatNumber(num) {
  return num.toLocaleString();
}

function printDetailedReport(results) {
  console.log('\n' + '='.repeat(80));
  console.log('EVALUATION COST ANALYSIS');
  console.log('='.repeat(80));

  // Per-scenario breakdown
  console.log('\n## Per-Scenario Breakdown\n');
  console.log('| Scenario | Turns | Tutor Tokens | Learner Tokens | Judge Est. | Total Cost | Score |');
  console.log('|----------|-------|--------------|----------------|------------|------------|-------|');

  let totalTokens = 0;
  let totalCost = 0;

  for (const r of results) {
    const scenarioShort = r.scenario.replace('battery_', '').substring(0, 25);
    console.log(`| ${scenarioShort.padEnd(25)} | ${String(r.turns).padStart(5)} | ${formatNumber(r.tokens.tutor).padStart(12)} | ${formatNumber(r.tokens.learner).padStart(14)} | ${formatNumber(r.tokens.judgeEstimate).padStart(10)} | ${formatCurrency(r.costs.total).padStart(10)} | ${r.score !== null ? String(r.score).padStart(5) : 'N/A'.padStart(5)} |`);
    totalTokens += r.tokens.total + r.tokens.judgeEstimate;
    totalCost += r.costs.total;
  }

  console.log('|' + '-'.repeat(78) + '|');
  console.log(`| **TOTAL** | | | | ${formatNumber(totalTokens).padStart(10)} | ${formatCurrency(totalCost).padStart(10)} | |`);

  // Cost breakdown by component
  console.log('\n## Cost Breakdown by Component\n');
  console.log('| Component | Model | Input Tokens | Output Tokens | Cost |');
  console.log('|-----------|-------|--------------|---------------|------|');

  const componentTotals = {
    tutor: { input: 0, output: 0, cost: 0 },
    learner: { input: 0, output: 0, cost: 0 },
    judge: { input: 0, output: 0, cost: 0 },
  };

  for (const r of results) {
    const tutorSplit = estimateTokenSplit(r.tokens.tutor, 0.6);
    const learnerSplit = estimateTokenSplit(r.tokens.learner, 0.5);
    componentTotals.tutor.input += tutorSplit.input;
    componentTotals.tutor.output += tutorSplit.output;
    componentTotals.tutor.cost += r.costs.tutor.totalCost;
    componentTotals.learner.input += learnerSplit.input;
    componentTotals.learner.output += learnerSplit.output;
    componentTotals.learner.cost += r.costs.learner.totalCost;
    componentTotals.judge.input += r.tokens.judgeEstimate * 0.8;
    componentTotals.judge.output += 2000;
    componentTotals.judge.cost += r.costs.judge.totalCost;
  }

  console.log(`| Tutor (Ego+Superego) | ${MODEL_PRICING[DEFAULT_MODELS.tutor_ego].name} | ${formatNumber(Math.round(componentTotals.tutor.input))} | ${formatNumber(Math.round(componentTotals.tutor.output))} | ${formatCurrency(componentTotals.tutor.cost)} |`);
  console.log(`| Learner (Ego+Superego) | ${MODEL_PRICING[DEFAULT_MODELS.learner_ego].name} | ${formatNumber(Math.round(componentTotals.learner.input))} | ${formatNumber(Math.round(componentTotals.learner.output))} | ${formatCurrency(componentTotals.learner.cost)} |`);
  console.log(`| Judge | ${MODEL_PRICING[DEFAULT_MODELS.judge].name} | ${formatNumber(Math.round(componentTotals.judge.input))} | ${formatNumber(Math.round(componentTotals.judge.output))} | ${formatCurrency(componentTotals.judge.cost)} |`);
  console.log(`| **TOTAL** | | ${formatNumber(Math.round(componentTotals.tutor.input + componentTotals.learner.input + componentTotals.judge.input))} | ${formatNumber(Math.round(componentTotals.tutor.output + componentTotals.learner.output + componentTotals.judge.output))} | **${formatCurrency(totalCost)}** |`);

  // Hypothetical costs
  console.log('\n## Hypothetical: All Claude Sonnet 4.5\n');
  const allSonnetCost = calculateCost(
    componentTotals.tutor.input + componentTotals.learner.input + componentTotals.judge.input,
    componentTotals.tutor.output + componentTotals.learner.output + componentTotals.judge.output,
    'sonnet'
  );
  console.log(`| Current Cost (Nemotron + Sonnet Judge) | ${formatCurrency(totalCost)} |`);
  console.log(`| Hypothetical (All Sonnet 4.5) | ${formatCurrency(allSonnetCost.totalCost)} |`);
  console.log(`| Cost Multiplier | ${(allSonnetCost.totalCost / totalCost).toFixed(1)}x |`);

  return { totalTokens, totalCost, componentTotals, allSonnetCost };
}

function printSummary(results) {
  let totalTokens = 0;
  let totalCost = 0;

  for (const r of results) {
    totalTokens += r.tokens.total + r.tokens.judgeEstimate;
    totalCost += r.costs.total;
  }

  console.log('\n## Cost Summary');
  console.log(`- Scenarios: ${results.length}`);
  console.log(`- Total Tokens: ${formatNumber(totalTokens)}`);
  console.log(`- Total Cost: ${formatCurrency(totalCost)}`);
  console.log(`- Average Cost/Scenario: ${formatCurrency(totalCost / results.length)}`);
}

// ============================================================================
// Export for Programmatic Use
// ============================================================================

export {
  MODEL_PRICING,
  DEFAULT_MODELS,
  calculateCost,
  estimateTokenSplit,
  analyzeBatteryScenario,
  analyzeBatteryDirectory,
};

// ============================================================================
// CLI Entry Point
// ============================================================================

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Analyze Evaluation Costs

Usage:
  node scripts/analyze-eval-costs.js                    # Analyze all battery evals
  node scripts/analyze-eval-costs.js --battery          # Analyze battery scenarios
  node scripts/analyze-eval-costs.js --file <path>      # Analyze specific file
  node scripts/analyze-eval-costs.js --summary          # Show cost summary only
  node scripts/analyze-eval-costs.js --json             # Output as JSON

Model Pricing (per million tokens):
  Nemotron 3 Nano 30B (free): $0 input, $0 output
  Claude Sonnet 4.5: $3 input, $15 output
  Claude Haiku 4.5: $0.80 input, $4 output
`);
  process.exit(0);
}

// Default: analyze battery directory
const batteryDir = path.join(PROJECT_ROOT, 'logs', 'interaction-evals');
const results = analyzeBatteryDirectory(batteryDir);

if (results.length === 0) {
  console.log('No battery evaluation files found in', batteryDir);
  process.exit(1);
}

if (args.includes('--json')) {
  console.log(JSON.stringify(results, null, 2));
} else if (args.includes('--summary')) {
  printSummary(results);
} else {
  const totals = printDetailedReport(results);

  // Save to analysis file
  const analysisPath = path.join(PROJECT_ROOT, 'docs', 'research', 'COST-ANALYSIS.md');
  const markdown = generateMarkdownReport(results, totals);
  fs.writeFileSync(analysisPath, markdown);
  console.log(`\nReport saved to: ${analysisPath}`);
}

function generateMarkdownReport(results, totals) {
  const timestamp = new Date().toISOString();

  return `# Evaluation Cost Analysis

**Generated:** ${timestamp}

## Overview

This document provides token usage and cost analysis for evaluation runs, supporting reproducibility and cost planning.

## Model Pricing

| Model | Input ($/M) | Output ($/M) | Provider |
|-------|-------------|--------------|----------|
| Nemotron 3 Nano 30B | $0.00 | $0.00 | OpenRouter (free) |
| Claude Sonnet 4.5 | $3.00 | $15.00 | OpenRouter |
| Claude Haiku 4.5 | $0.80 | $4.00 | OpenRouter |

## Battery Scenario Results

| Scenario | Turns | Tutor Tokens | Learner Tokens | Total Cost | Score |
|----------|-------|--------------|----------------|------------|-------|
${results.map(r => {
  const scenarioShort = r.scenario.replace('short-battery_', '').replace(/-\d+$/, '');
  return `| ${scenarioShort} | ${r.turns} | ${r.tokens.tutor.toLocaleString()} | ${r.tokens.learner.toLocaleString()} | ${formatCurrency(r.costs.total)} | ${r.score || 'N/A'} |`;
}).join('\n')}
| **TOTAL** | ${results.reduce((sum, r) => sum + r.turns, 0)} | ${results.reduce((sum, r) => sum + r.tokens.tutor, 0).toLocaleString()} | ${results.reduce((sum, r) => sum + r.tokens.learner, 0).toLocaleString()} | **${formatCurrency(totals.totalCost)}** | |

## Cost by Component

| Component | Model | Tokens | Cost |
|-----------|-------|--------|------|
| Tutor (Ego+Superego) | Nemotron 3 Nano 30B | ${Math.round(totals.componentTotals.tutor.input + totals.componentTotals.tutor.output).toLocaleString()} | ${formatCurrency(totals.componentTotals.tutor.cost)} |
| Learner (Ego+Superego) | Nemotron 3 Nano 30B | ${Math.round(totals.componentTotals.learner.input + totals.componentTotals.learner.output).toLocaleString()} | ${formatCurrency(totals.componentTotals.learner.cost)} |
| Judge | Claude Sonnet 4.5 | ${Math.round(totals.componentTotals.judge.input + totals.componentTotals.judge.output).toLocaleString()} | ${formatCurrency(totals.componentTotals.judge.cost)} |

## Hypothetical: All Claude Sonnet 4.5

| Configuration | Total Cost | Multiplier |
|---------------|------------|------------|
| Current (Nemotron + Sonnet Judge) | ${formatCurrency(totals.totalCost)} | 1.0x |
| All Sonnet 4.5 | ${formatCurrency(totals.allSonnetCost.totalCost)} | ${(totals.allSonnetCost.totalCost / totals.totalCost).toFixed(1)}x |

## Reproducibility

To regenerate this analysis:

\`\`\`bash
node scripts/analyze-eval-costs.js
\`\`\`

To get JSON output for programmatic use:

\`\`\`bash
node scripts/analyze-eval-costs.js --json
\`\`\`
`;
}
