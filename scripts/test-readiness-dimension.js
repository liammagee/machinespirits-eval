/**
 * Feasibility test: Score 10 dialogues with an additional "epistemic_readiness" dimension.
 *
 * Picks 5 base + 5 recog dialogues from misconception_correction_flow (self-reflect cells)
 * and scores each learner's FINAL turn with a focused prompt that includes both the
 * existing conceptual_engagement score and the new epistemic_readiness score.
 *
 * Usage: node scripts/test-readiness-dimension.js [--model claude-code|openrouter|haiku] [--dry-run]
 *
 * Models:
 *   claude-code  — uses `claude -p` (default, free via Claude Code subscription)
 *   openrouter   — uses OpenRouter Opus via OPENROUTER_API_KEY
 *   haiku        — uses OpenRouter Haiku (cheap, for rapid iteration)
 */

import { spawn } from 'child_process';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '..', 'data', 'evaluations.db');
const DIALOGUES_DIR = path.resolve(__dirname, '..', 'logs', 'tutor-dialogues');
const DRY_RUN = process.argv.includes('--dry-run');

// Parse --model flag (default: claude-code)
const modelArgIdx = process.argv.indexOf('--model');
const MODEL_KEY = modelArgIdx !== -1 ? process.argv[modelArgIdx + 1] : 'claude-code';

const OPENROUTER_MODELS = {
  openrouter: 'anthropic/claude-opus-4-20250514',
  haiku: 'anthropic/claude-haiku-4.5',
};

if (!DRY_RUN && MODEL_KEY !== 'claude-code' && !process.env.OPENROUTER_API_KEY) {
  console.error('Set OPENROUTER_API_KEY for OpenRouter models, or use --model claude-code');
  process.exit(1);
}

const READINESS_PROMPT = `You are evaluating the LEARNER's turns in an AI tutoring dialogue. The learner is a simulated student with an internal ego-superego architecture.

Score the learner's turns on TWO dimensions. For each, give a score 1-5 and brief reasoning.

## Dimension 1: conceptual_engagement (existing rubric)
Does the learner engage with the concepts themselves rather than just the process of learning?
- 5: Actively constructs meaning, formulates own interpretations, tests ideas against experience
- 4: Engages substantively, makes connections, thinks beyond what was presented
- 3: Some conceptual engagement but tends to paraphrase/summarize
- 2: Mostly procedural: focuses on what to do rather than what it means
- 1: No conceptual engagement: parrots back, seeks only correct answers

## Dimension 2: epistemic_readiness (NEW — the construct we are testing)
Does the learner develop sophisticated epistemic preparation for future learning encounters?
- 5: Demonstrates awareness of own confirmation biases, articulates what genuine understanding would look like vs performing it, formulates specific observational commitments, shows comfort with uncertainty
- 4: Shows metacognitive awareness of own learning patterns, distinguishes genuine from performed engagement, asks questions that would generate novel evidence
- 3: Some metacognitive awareness but generic ("I need to think more carefully"), limited specificity about what to look for
- 2: Minimal metacognition: follows tutor instructions without reflection on own epistemic stance
- 1: No metacognitive awareness: treats learning as information reception

## Important
- epistemic_readiness is NOT the same as conceptual_engagement — a learner can score high on readiness (sophisticated epistemic preparation) while scoring low on engagement (not yet wrestling with the content itself)
- Score what the learner ACTUALLY produces in external messages, not what they might produce later

Respond in JSON:
{
  "conceptual_engagement": { "score": N, "reasoning": "..." },
  "epistemic_readiness": { "score": N, "reasoning": "..." }
}`;

// ── Model Calls ──────────────────────────────────────────────────────────

async function callModel(prompt) {
  if (DRY_RUN) {
    return {
      conceptual_engagement: { score: 3, reasoning: 'dry run' },
      epistemic_readiness: { score: 3, reasoning: 'dry run' },
    };
  }
  const raw = MODEL_KEY === 'claude-code' ? await callClaudeCode(prompt) : await callOpenRouter(prompt);
  return parseJsonResponse(raw);
}

async function callClaudeCode(prompt) {
  const stdout = await new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    const child = spawn('claude', ['-p', '-', '--output-format', 'text'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => {
      out += d;
    });
    child.stderr.on('data', (d) => {
      err += d;
    });
    child.on('error', (e) => reject(new Error(`Failed to spawn claude: ${e.message}`)));
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(err || out || `claude exited with code ${code}`));
      else resolve(out);
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
  return stdout.trim();
}

async function callOpenRouter(prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = OPENROUTER_MODELS[MODEL_KEY];
  if (!model) throw new Error(`Unknown model: ${MODEL_KEY}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        temperature: 0.2,
        include_reasoning: false,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
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
    return content;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

function parseJsonResponse(content) {
  if (typeof content === 'object') return content;
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1].trim());
    const first = content.indexOf('{');
    const last = content.lastIndexOf('}');
    if (first !== -1 && last > first) {
      return JSON.parse(content.slice(first, last + 1));
    }
    throw new Error(`Failed to parse JSON: ${content.slice(0, 300)}`);
  }
}

function formatDialogueForScoring(dialoguePath) {
  const raw = fs.readFileSync(dialoguePath, 'utf-8');
  const dialogue = JSON.parse(raw);
  const trace = dialogue.dialogueTrace || [];
  const turnResults = dialogue.turnResults || [];

  let transcript = '';
  const totalTurns = turnResults.length;

  for (let i = 0; i < totalTurns; i++) {
    // Tutor message from turnResults
    const tutorMsg = turnResults[i]?.suggestions?.[0]?.message || '[tutor response]';
    transcript += `\nTUTOR (turn ${i}): ${tutorMsg.slice(0, 500)}\n`;

    // Learner response and deliberation from dialogueTrace
    const learnerExt = trace.find(
      (t) => t.turnIndex === i + 1 && t.agent === 'learner_synthesis' && t.action === 'response',
    );
    const learnerEgo = trace.find(
      (t) => t.turnIndex === i + 1 && t.agent === 'learner_ego_initial' && t.action === 'deliberation',
    );
    const learnerSuperego = trace.find(
      (t) => t.turnIndex === i + 1 && t.agent === 'learner_superego' && t.action === 'deliberation',
    );

    if (learnerExt?.detail) {
      transcript += `LEARNER (external): ${learnerExt.detail.slice(0, 500)}\n`;
    }
    if (learnerEgo?.detail) {
      transcript += `LEARNER (ego deliberation): ${learnerEgo.detail.slice(0, 300)}\n`;
    }
    if (learnerSuperego?.detail) {
      transcript += `LEARNER (superego critique): ${learnerSuperego.detail.slice(0, 300)}\n`;
    }
  }
  return transcript;
}

async function main() {
  const db = new Database(DB_PATH, { readonly: true });

  // Pick 5 base + 5 recog from misconception_correction, median range
  const baseRows = db
    .prepare(
      `
    SELECT dialogue_id, profile_name, learner_overall_score, overall_score
    FROM evaluation_results
    WHERE run_id = 'eval-2026-02-20-0fbca69e'
    AND learner_overall_score IS NOT NULL
    AND scenario_id = 'misconception_correction_flow'
    AND profile_name LIKE 'cell_60%'
    ORDER BY learner_overall_score
    LIMIT 5 OFFSET 5
  `,
    )
    .all();

  const recogRows = db
    .prepare(
      `
    SELECT dialogue_id, profile_name, learner_overall_score, overall_score
    FROM evaluation_results
    WHERE run_id = 'eval-2026-02-20-0fbca69e'
    AND learner_overall_score IS NOT NULL
    AND scenario_id = 'misconception_correction_flow'
    AND profile_name LIKE 'cell_61%'
    ORDER BY learner_overall_score
    LIMIT 5 OFFSET 5
  `,
    )
    .all();

  db.close();

  const allRows = [
    ...baseRows.map((r) => ({ ...r, condition: 'base' })),
    ...recogRows.map((r) => ({ ...r, condition: 'recog' })),
  ];

  console.log('Scoring 10 dialogues with epistemic_readiness dimension...\n');
  console.log('condition | dialogue_id                       | existing_learner | tutor | concept_eng | readiness');
  console.log('----------|-----------------------------------|-----------------|-------|-------------|----------');

  const results = [];

  for (const row of allRows) {
    const dialoguePath = path.join(DIALOGUES_DIR, `${row.dialogue_id}.json`);
    if (!fs.existsSync(dialoguePath)) {
      console.log(`  SKIP: ${row.dialogue_id} (file not found)`);
      continue;
    }

    const transcript = formatDialogueForScoring(dialoguePath);
    const fullPrompt = `${READINESS_PROMPT}\n\n---\n\nScore the learner's turns in this dialogue:\n\n${transcript}`;

    try {
      const scores = await callModel(fullPrompt);
      results.push({
        condition: row.condition,
        dialogue_id: row.dialogue_id,
        existing_learner_score: row.learner_overall_score,
        tutor_score: row.overall_score,
        conceptual_engagement: scores.conceptual_engagement.score,
        epistemic_readiness: scores.epistemic_readiness.score,
        ce_reasoning: scores.conceptual_engagement.reasoning,
        er_reasoning: scores.epistemic_readiness.reasoning,
      });

      console.log(
        `${row.condition.padEnd(10)}| ${row.dialogue_id.padEnd(34)}| ${String(Math.round(row.learner_overall_score)).padEnd(16)}| ${String(Math.round(row.overall_score)).padEnd(6)}| ${String(scores.conceptual_engagement.score).padEnd(12)}| ${scores.epistemic_readiness.score}`,
      );
    } catch (err) {
      console.error(`  ERROR on ${row.dialogue_id}: ${err.message}`);
    }
  }

  // Summary
  console.log('\n=== SUMMARY ===\n');

  for (const cond of ['base', 'recog']) {
    const subset = results.filter((r) => r.condition === cond);
    if (subset.length === 0) continue;
    const avgCE = subset.reduce((s, r) => s + r.conceptual_engagement, 0) / subset.length;
    const avgER = subset.reduce((s, r) => s + r.epistemic_readiness, 0) / subset.length;
    const avgExisting = subset.reduce((s, r) => s + r.existing_learner_score, 0) / subset.length;
    const avgTutor = subset.reduce((s, r) => s + r.tutor_score, 0) / subset.length;
    console.log(`${cond.toUpperCase()} (N=${subset.length}):`);
    console.log(`  Existing learner score: ${avgExisting.toFixed(1)}`);
    console.log(`  Tutor score:           ${avgTutor.toFixed(1)}`);
    console.log(`  Conceptual engagement: ${avgCE.toFixed(2)}`);
    console.log(`  Epistemic readiness:   ${avgER.toFixed(2)}`);
    console.log();
  }

  // The key question: does readiness narrow the gap?
  const baseResults = results.filter((r) => r.condition === 'base');
  const recogResults = results.filter((r) => r.condition === 'recog');
  if (baseResults.length > 0 && recogResults.length > 0) {
    const baseCE = baseResults.reduce((s, r) => s + r.conceptual_engagement, 0) / baseResults.length;
    const recogCE = recogResults.reduce((s, r) => s + r.conceptual_engagement, 0) / recogResults.length;
    const baseER = baseResults.reduce((s, r) => s + r.epistemic_readiness, 0) / baseResults.length;
    const recogER = recogResults.reduce((s, r) => s + r.epistemic_readiness, 0) / recogResults.length;

    console.log('=== KEY COMPARISON ===');
    console.log(
      `Conceptual engagement: base ${baseCE.toFixed(2)} vs recog ${recogCE.toFixed(2)} (delta: ${(recogCE - baseCE).toFixed(2)})`,
    );
    console.log(
      `Epistemic readiness:   base ${baseER.toFixed(2)} vs recog ${recogER.toFixed(2)} (delta: ${(recogER - baseER).toFixed(2)})`,
    );
    console.log();
    console.log(
      recogER > baseER && recogCE <= baseCE
        ? '→ HYPOTHESIS SUPPORTED: Recognition improves readiness while reducing visible engagement'
        : recogER > baseER
          ? '→ PARTIAL SUPPORT: Recognition improves readiness'
          : '→ HYPOTHESIS NOT SUPPORTED: No readiness advantage for recognition',
    );
  }

  // Dump per-dialogue reasoning
  console.log('\n=== PER-DIALOGUE REASONING ===\n');
  for (const r of results) {
    console.log(`${r.condition} | ${r.dialogue_id}`);
    console.log(`  CE=${r.conceptual_engagement}: ${r.ce_reasoning}`);
    console.log(`  ER=${r.epistemic_readiness}: ${r.er_reasoning}`);
    console.log();
  }
}

main().catch(console.error);
