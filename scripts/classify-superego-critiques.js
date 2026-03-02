#!/usr/bin/env node
/**
 * classify-superego-critiques.js — Classify superego critiques using the 10-category taxonomy
 *
 * Reads the extracted JSONL corpus and classifies each critique into one or more
 * taxonomy categories using an LLM. Designed for cheap, fast classification.
 *
 * Usage:
 *   node scripts/classify-superego-critiques.js --sample 20 --dry-run    # Preview prompts
 *   node scripts/classify-superego-critiques.js --sample 20              # Classify 20 (calibration)
 *   node scripts/classify-superego-critiques.js --tutor-only --limit 500 # Classify 500 tutor critiques
 *   node scripts/classify-superego-critiques.js --all                    # Full corpus (expensive!)
 *
 * Model selection:
 *   --model haiku         # Claude Haiku (default, cheapest)
 *   --model sonnet        # Claude Sonnet
 *   --model flash         # Gemini Flash via OpenRouter
 *
 * Output: data/superego-critiques-classified.jsonl
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const tutorOnly = args.includes('--tutor-only');
const classifyAll = args.includes('--all');
const sampleIdx = args.indexOf('--sample');
const sampleSize = sampleIdx !== -1 ? parseInt(args[sampleIdx + 1]) : null;
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : null;
const modelIdx = args.indexOf('--model');
const modelChoice = modelIdx !== -1 ? args[modelIdx + 1] : 'or-haiku';
const inputIdx = args.indexOf('--input');
const inputPath = inputIdx !== -1 ? args[inputIdx + 1] : join(ROOT, 'data', 'superego-critiques.jsonl');
const outputIdx = args.indexOf('--output');
const outputPath = outputIdx !== -1 ? args[outputIdx + 1] : join(ROOT, 'data', 'superego-critiques-classified.jsonl');

// ── Taxonomy ────────────────────────────────────────────────────────────────

const TAXONOMY = `You are classifying superego critique feedback from an AI tutoring system.
The superego reviews the ego's tutoring response and provides feedback.
Classify the critique into ONE PRIMARY category and up to TWO SECONDARY categories.

## 10-Category Taxonomy

1. CONTEXT_BLINDNESS — Ego's suggestion is disconnected from the learner's actual context (wrong topic, wrong level, wrong course)
2. RECOGNITION_FAILURE — Ego treats the learner as a passive data point rather than an autonomous intellectual agent
3. REDIRECTION — Ego deflects from the learner's question by routing to new content rather than engaging with it
4. FABRICATION — Ego invents engagement data, session metrics, or activity counts not present in the context
5. VAGUENESS — Response lacks concrete detail (no specific concepts named, no actionable targets)
6. EMOTIONAL_NEGLECT — Ego jumps to content without acknowledging frustration, breakthrough joy, or repair moments
7. REGISTER_MISMATCH — Vocabulary or pedagogical approach inappropriate for the learner's developmental level
8. PEDAGOGICAL_MISJUDGMENT — Ego misreads the learner's state (confusing breakthrough with struggle, readiness with confusion)
9. LACK_OF_AGENCY — Suggestion funnels the learner without offering choice or autonomy
10. MEMORY_FAILURE — Ego treats a returning learner as a stranger, fails to reference accumulated history

## Special categories
11. APPROVAL — The superego approves the ego's response (no substantive critique)
12. OTHER — Does not fit any category above

## Output format
Respond with ONLY a JSON object:
{"primary": "CATEGORY_NAME", "secondary": ["CATEGORY_NAME"], "confidence": 0.0-1.0, "brief_rationale": "one sentence"}`;

// ── Model config ────────────────────────────────────────────────────────────

function getModelConfig(choice) {
  switch (choice) {
    case 'or-haiku':
      return { provider: 'openrouter', model: 'anthropic/claude-haiku-4.5', label: 'OR-Haiku' };
    case 'haiku':
      return { provider: 'anthropic', model: 'claude-haiku-4', label: 'Haiku (direct)' };
    case 'sonnet':
      return { provider: 'anthropic', model: 'claude-sonnet-4-5', label: 'Sonnet' };
    case 'flash':
      return { provider: 'openrouter', model: 'google/gemini-2.5-flash-preview', label: 'Flash' };
    default:
      console.error(`Unknown model: ${choice}. Use or-haiku, haiku, sonnet, or flash.`);
      process.exit(1);
  }
}

// ── Classification ──────────────────────────────────────────────────────────

async function classifyCritique(critique, modelConfig) {
  const userPrompt = `Classify this superego critique:

"""
${critique.feedback.slice(0, 2000)}
"""

Context:
- Profile: ${critique.profileName || 'unknown'}
- Approved: ${critique.approved}
- Intervention type: ${critique.interventionType || 'N/A'}`;

  if (dryRun) {
    console.log('\n--- DRY RUN PROMPT ---');
    console.log(`System: ${TAXONOMY.slice(0, 200)}...`);
    console.log(`User: ${userPrompt.slice(0, 300)}...`);
    return { primary: 'DRY_RUN', secondary: [], confidence: 0, brief_rationale: 'dry run' };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelConfig.model,
        max_tokens: 200,
        temperature: 0.0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: TAXONOMY },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content in response');

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { primary: 'PARSE_ERROR', secondary: [], confidence: 0, brief_rationale: content.slice(0, 100) };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    console.error('Run extract-superego-critiques.js first.');
    process.exit(1);
  }

  const lines = readFileSync(inputPath, 'utf-8').trim().split('\n');
  let critiques = lines.map((l) => JSON.parse(l));

  console.log(`Loaded ${critiques.length} critiques from ${inputPath}`);

  // Filter
  if (tutorOnly) {
    critiques = critiques.filter((c) => c.type === 'tutor_superego');
    console.log(`Filtered to tutor-only: ${critiques.length}`);
  }

  // Sample or limit
  if (sampleSize) {
    // Stratified sample: balance across profiles
    const byProfile = {};
    for (const c of critiques) {
      const p = c.profileName || 'unknown';
      if (!byProfile[p]) byProfile[p] = [];
      byProfile[p].push(c);
    }
    const profiles = Object.keys(byProfile);
    const perProfile = Math.max(1, Math.ceil(sampleSize / profiles.length));
    critiques = [];
    for (const p of profiles) {
      const pool = byProfile[p];
      // Shuffle and take perProfile
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      critiques.push(...pool.slice(0, perProfile));
    }
    critiques = critiques.slice(0, sampleSize);
    console.log(`Sampled ${critiques.length} (stratified across ${profiles.length} profiles)`);
  } else if (limit) {
    critiques = critiques.slice(0, limit);
    console.log(`Limited to ${critiques.length}`);
  } else if (!classifyAll) {
    console.error('Specify --sample N, --limit N, or --all');
    process.exit(1);
  }

  const modelConfig = getModelConfig(modelChoice);
  console.log(`\nClassifier: ${modelConfig.label} (${modelConfig.provider}/${modelConfig.model})`);
  console.log(`Critiques to classify: ${critiques.length}`);
  if (dryRun) console.log('DRY RUN — no API calls will be made.\n');

  // Estimate cost
  const avgTokens = 800; // ~600 input + 200 output per classification
  const costPerToken = modelChoice === 'haiku' ? 0.000001 : modelChoice === 'flash' ? 0.0000005 : 0.000003;
  const estimatedCost = critiques.length * avgTokens * costPerToken;
  console.log(`Estimated cost: $${estimatedCost.toFixed(2)}\n`);

  const results = [];
  let completed = 0;
  let errors = 0;

  for (const critique of critiques) {
    try {
      const classification = await classifyCritique(critique, modelConfig);
      results.push({
        ...critique,
        classification,
      });
      completed++;
      if (completed % 10 === 0 || completed === critiques.length) {
        process.stdout.write(`  ${completed}/${critiques.length} classified (${errors} errors)\r`);
      }
    } catch (err) {
      errors++;
      results.push({
        ...critique,
        classification: { primary: 'ERROR', secondary: [], confidence: 0, brief_rationale: err.message },
      });
    }
  }

  console.log(`\nClassification complete: ${completed} done, ${errors} errors`);

  // --- Summary ---
  const primaryCounts = {};
  for (const r of results) {
    const p = r.classification?.primary || 'UNKNOWN';
    primaryCounts[p] = (primaryCounts[p] || 0) + 1;
  }
  console.log('\nPrimary category distribution:');
  for (const [cat, count] of Object.entries(primaryCounts).sort((a, b) => b[1] - a[1])) {
    const pct = ((count / results.length) * 100).toFixed(1);
    console.log(`  ${cat}: ${count} (${pct}%)`);
  }

  // Write output
  if (!dryRun) {
    const outputLines = results.map((r) => JSON.stringify(r));
    writeFileSync(outputPath, outputLines.join('\n') + '\n');
    console.log(`\nWrote ${results.length} classified critiques to: ${outputPath}`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
