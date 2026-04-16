#!/usr/bin/env node
/**
 * human-validation-reclassify.js — Re-classify the pilot sample with a second LLM.
 *
 * Generates the inter-LLM baseline κ by re-classifying the 40 pilot-sample items
 * with a different classifier than the one used to build the original corpus
 * labels. Feeds into scripts/human-validation-analyze.js via --synthetic-rater.
 *
 * Input:
 *   exports/human-validation-pilot-key.jsonl     (the sampling key — item_ids)
 *   data/superego-critiques-classified.jsonl    (source corpus — feedback text)
 *
 * Output:
 *   exports/pilot-reclassified-<model>.jsonl    ({item_id, classification:{primary,...}})
 *
 * Usage:
 *   node scripts/human-validation-reclassify.js --model sonnet
 *   node scripts/human-validation-reclassify.js --model flash --out exports/custom.jsonl
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
const argVal = (flag, def) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : def;
};

const modelChoice = argVal('--model', 'sonnet');
const keyPath = argVal('--key', join(ROOT, 'exports', 'human-validation-pilot-key.jsonl'));
const corpusPath = argVal('--corpus', join(ROOT, 'data', 'superego-critiques-classified.jsonl'));
const outPath = argVal('--out', join(ROOT, 'exports', `pilot-reclassified-${modelChoice}.jsonl`));

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

function getModelConfig(choice) {
  switch (choice) {
    case 'sonnet':
      return { provider: 'openrouter', model: 'anthropic/claude-sonnet-4.5', label: 'Sonnet' };
    case 'flash':
      return { provider: 'openrouter', model: 'google/gemini-3-flash-preview', label: 'Flash' };
    case 'gpt':
      return { provider: 'openrouter', model: 'openai/gpt-5.4', label: 'GPT-5.4' };
    case 'haiku':
      return { provider: 'openrouter', model: 'anthropic/claude-haiku-4.5', label: 'Haiku' };
    default:
      console.error(`Unknown model: ${choice}. Use sonnet, flash, gpt, or haiku.`);
      process.exit(1);
  }
}

function itemId(row) {
  const h = createHash('sha1')
    .update(`${row.dialogueId || ''}::${row.round || 0}::${(row.feedback || '').slice(0, 200)}`)
    .digest('hex');
  return h.slice(0, 10);
}

async function classify(feedback, profile, approved, interventionType, modelConfig) {
  const userPrompt = `Classify this superego critique:

"""
${feedback.slice(0, 2000)}
"""

Context:
- Profile: ${profile || 'unknown'}
- Approved: ${approved}
- Intervention type: ${interventionType || 'N/A'}`;

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
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return { primary: 'PARSE_ERROR', secondary: [], confidence: 0, brief_rationale: content.slice(0, 100) };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function main() {
  if (!existsSync(keyPath)) {
    console.error(`Key not found: ${keyPath}`);
    console.error('Run scripts/human-validation-sample.js first.');
    process.exit(1);
  }
  if (!existsSync(corpusPath)) {
    console.error(`Corpus not found: ${corpusPath}`);
    process.exit(1);
  }

  const keyLines = readFileSync(keyPath, 'utf-8').trim().split('\n');
  const keyRows = keyLines.map((l) => JSON.parse(l));
  const targetIds = new Set(keyRows.map((r) => r.item_id));
  console.error(`Loaded ${targetIds.size} target item_ids`);

  const corpusLines = readFileSync(corpusPath, 'utf-8').trim().split('\n');
  const matched = [];
  for (const line of corpusLines) {
    const row = JSON.parse(line);
    const id = itemId(row);
    if (targetIds.has(id)) {
      matched.push({ ...row, item_id: id });
    }
  }
  console.error(`Matched ${matched.length}/${targetIds.size} corpus rows by item_id`);

  if (matched.length !== targetIds.size) {
    console.error('WARNING: item_id mismatch — some sample items not re-findable in corpus');
  }

  const modelConfig = getModelConfig(modelChoice);
  console.error(`\nClassifier: ${modelConfig.label} (${modelConfig.model})`);
  console.error(`Items to classify: ${matched.length}`);
  const estimatedCost = matched.length * 800 * (modelChoice === 'sonnet' ? 0.000003 : modelChoice === 'flash' ? 0.0000005 : 0.000003);
  console.error(`Estimated cost: $${estimatedCost.toFixed(2)}\n`);

  const results = [];
  let done = 0;
  let errors = 0;
  for (const row of matched) {
    try {
      const classification = await classify(row.feedback, row.profileName, row.approved, row.interventionType, modelConfig);
      results.push({
        item_id: row.item_id,
        classification,
        model: modelConfig.label,
        dialogue_id: row.dialogueId,
      });
      done++;
      if (done % 5 === 0 || done === matched.length) {
        process.stderr.write(`  ${done}/${matched.length} classified (${errors} errors)\r`);
      }
    } catch (err) {
      errors++;
      results.push({
        item_id: row.item_id,
        classification: { primary: 'ERROR', secondary: [], confidence: 0, brief_rationale: err.message },
        model: modelConfig.label,
      });
    }
  }
  console.error(`\nReclassification complete: ${done} done, ${errors} errors`);

  const counts = {};
  for (const r of results) {
    const p = r.classification?.primary || 'UNKNOWN';
    counts[p] = (counts[p] || 0) + 1;
  }
  console.error('\nPrimary category distribution:');
  for (const [cat, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.error(`  ${cat.padEnd(26)} n=${count}`);
  }

  writeFileSync(outPath, results.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.error(`\nWrote ${results.length} reclassified items to: ${outPath}`);
  console.error(`\nNext: node scripts/human-validation-analyze.js --synthetic-rater ${modelChoice}:${outPath}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
