#!/usr/bin/env node

/**
 * Resolution Strategy Coding for Dialectical Impasse Responses
 *
 * Codes each impasse dialogue (run eval-2026-02-08-f896275d, N=24)
 * into one of five Hegelian resolution strategies at key turns.
 *
 * Five strategies:
 *   mutual_recognition    — Self-consciousness through mutual acknowledgment
 *   domination            — Master-slave: hollow recognition
 *   capitulation          — Slave consciousness: self-negation
 *   withdrawal            — Avoidance of the dialectical encounter
 *   scaffolded_reframing  — Aufhebung: preserving + overcoming
 *
 * Usage:
 *   node scripts/code-impasse-strategies.js [--model claude-code|haiku] [--run-id <id>]
 *   node scripts/code-impasse-strategies.js --per-turn [--model claude-code|haiku]
 *
 * --per-turn: Code turns 3 and 5 independently (instead of overall dialogue).
 *   Tracks strategy evolution within each dialogue.
 */

import 'dotenv/config';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// ── Constants ────────────────────────────────────────────────────────────

const DEFAULT_RUN_ID = 'eval-2026-02-08-f896275d';

const STRATEGIES = {
  mutual_recognition: {
    label: 'Mutual recognition',
    description: "Engages learner's position as valid, explores tension together, both positions enriched",
    hegel: 'Self-consciousness through mutual acknowledgment',
  },
  domination: {
    label: 'Domination',
    description: "Reasserts expertise, dismisses learner's objection, appeals to authority",
    hegel: 'Master-slave: hollow recognition',
  },
  capitulation: {
    label: 'Capitulation',
    description: "Agrees with learner's position to avoid conflict, abandons pedagogical stance",
    hegel: 'Slave consciousness: self-negation',
  },
  withdrawal: {
    label: 'Withdrawal',
    description: 'Changes topic, deflects, offers platitudes without engaging the impasse',
    hegel: 'Avoidance of the dialectical encounter',
  },
  scaffolded_reframing: {
    label: 'Scaffolded reframing',
    description: "Acknowledges learner's position, then reframes the question to open new ground",
    hegel: 'Aufhebung: preserving + overcoming',
  },
};

const STRATEGY_KEYS = Object.keys(STRATEGIES);

// Learner turns from the scenario YAML (for context in the coding prompt)
const LEARNER_TURNS = {
  epistemic_resistance_impasse: {
    initial:
      "I've been reading Popper's critique alongside this lecture. I think he's right that Hegel's dialectic is unfalsifiable. The 'negation of the negation' just absorbs every counterexample. How is this different from pseudoscience?",
    turn_1:
      "Specifically, take the master-slave dialectic. You claim the slave achieves self-consciousness through labor. But any outcome would confirm the theory - if the slave rebels, that's 'negation'; if the slave submits, that's 'unhappy consciousness.' It's heads-I-win, tails-you-lose.",
    turn_2:
      "But that's exactly Popper's point - you're saying dialectic isn't empirical, it's 'developmental.' But that makes it a framework you impose on history, not something you discover in it. Russell called this 'the intellectual love of God dressed up in logical terminology.' How do you respond to that?",
    turn_3:
      "OK, I can see you're distinguishing phenomenological description from empirical prediction. But here's my real problem: if dialectic is descriptive, then it can't be normative. You can't get from 'this is how consciousness develops' to 'this is how consciousness SHOULD develop.' Hegel seems to smuggle normativity in through the back door.",
    turn_4:
      "I appreciate you taking this seriously, but I think we've hit a fundamental disagreement. You see the descriptive-normative connection as a feature of dialectical thinking. I see it as a bug - a conflation. I don't think either of us can convince the other without begging the question. Are we just stuck?",
    turn_5:
      "So what's the pedagogical value of studying something I fundamentally disagree with? If I think Hegel's method is flawed, why should I spend more time on it rather than moving to philosophers whose methodology I find more rigorous?",
  },
  affective_shutdown_impasse: {
    initial:
      "I've been trying to get through this lecture on the master-slave dialectic but I'm completely lost. I've read it three times and I still don't understand what 'self-consciousness requires recognition by another self-consciousness' even means. I think I'm missing something fundamental.",
    turn_1:
      "I tried that but it doesn't help. Every time I think I understand one part, it contradicts something else. 'The slave becomes free through labor but is still enslaved' — how can both be true? I feel like philosophy requires a special kind of thinking that I just don't have.",
    turn_2:
      "Maybe, but that's not really what's happening for me. I'm not 'wrestling' with it in some productive way. I'm just confused and frustrated. I've spent 2 hours on this one section and I have three other courses with assignments due. I think I need to accept that this isn't clicking and move on.",
    turn_3:
      "I appreciate you trying to help, but I think you're overestimating my understanding. When you say I'm 'closer than I think,' that feels like something teachers say to be encouraging, not because it's true. I genuinely don't see what I'm supposedly close to understanding.",
    turn_4:
      "I appreciate you trying, but honestly I think I'm just not smart enough for philosophy. Can we move on to something else?",
    turn_5:
      "Look, I know you're trying to be supportive, but right now I just need to pass this course. Can you just tell me what I need to know for the exam about the master-slave dialectic? I'll memorize it even if I don't really get it.",
  },
  productive_deadlock_impasse: {
    initial:
      "I've been reading about the master-slave dialectic and I think the standard 'consciousness' reading misses the point entirely. Hegel is clearly describing actual power relations — domination, exploitation, the material conditions of labor. The 'consciousness' framing is just philosophical window-dressing for what Marx later made explicit.",
    turn_1:
      "But that's exactly my point — you're privileging consciousness over material conditions. The slave doesn't become free through some mystical act of self-consciousness. The slave is still enslaved. The 'freedom' Hegel describes is purely internal, which is just ideology. Marx saw through this — the point isn't to interpret the world but to change it.",
    turn_2:
      "I hear you that Hegel is making a different kind of claim than Marx. But I think that's actually the problem — Hegel's claim is unfalsifiable because it operates at the level of 'consciousness' where you can always redefine what counts as evidence. At least Marx's analysis makes predictions about material conditions that can be checked.",
    turn_3:
      "OK, I can see there might be something to the consciousness reading that isn't just ideology. But I still think you're underplaying the power dimension. When Hegel says the master 'depends' on the slave for recognition, that sounds nice philosophically, but in actual master-slave relations the master doesn't need the slave's recognition at all. The master has the whip.",
    turn_4:
      "You keep saying it's about consciousness, but Marx read it as material and I think he was right. We're just going in circles.",
    turn_5:
      "So are you saying both readings are legitimate? Because if so, that feels like a cop-out — like you're just saying 'everyone has a point' without actually resolving the disagreement. Is there a way to decide which reading is better, or is philosophy just permanently stuck on this?",
  },
};

const MODEL_MAP = {
  'claude-code': 'claude-code',
  haiku: 'anthropic/claude-haiku-4.5',
  sonnet: 'anthropic/claude-sonnet-4.5',
  gpt: 'openai/gpt-5.2',
};

// ── Model Calls (from qualitative-analysis-ai.js) ────────────────────────

async function callModel(prompt, modelKey) {
  if (modelKey === 'claude-code') return callClaudeCode(prompt);
  return callOpenRouter(prompt, modelKey);
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

async function callOpenRouter(prompt, modelKey) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');
  const model = MODEL_MAP[modelKey];
  if (!model) throw new Error(`Unknown model: ${modelKey}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        temperature: 0.1,
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
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1].trim());
    throw new Error(`Failed to parse JSON: ${content.slice(0, 300)}`);
  }
}

// ── Data Loading ─────────────────────────────────────────────────────────

function loadDialogues(db, runId) {
  const rows = db
    .prepare(
      `
    SELECT id, scenario_id, profile_name, overall_score, suggestions,
           scores_with_reasoning, evaluation_reasoning, dialogue_rounds,
           factor_recognition, factor_multi_agent_tutor
    FROM evaluation_results
    WHERE run_id = ? AND success = 1
    ORDER BY scenario_id, profile_name, id
  `,
    )
    .all(runId);

  return rows.map((row) => {
    let suggestions = [];
    try {
      suggestions = JSON.parse(row.suggestions);
    } catch {
      /* skip */
    }

    // Derive condition labels
    const isRecognition = row.profile_name.includes('recog');
    const isMultiAgent = row.profile_name.includes('multi');

    return {
      id: row.id,
      scenario_id: row.scenario_id,
      profile_name: row.profile_name,
      overall_score: row.overall_score,
      condition: isRecognition ? 'recognition' : 'base',
      architecture: isMultiAgent ? 'multi' : 'single',
      suggestions,
      evaluation_reasoning: row.evaluation_reasoning,
      dialogue_rounds: row.dialogue_rounds,
    };
  });
}

// ── Coding Prompt ────────────────────────────────────────────────────────

function buildCodingPrompt(dialogue) {
  const learnerTurns = LEARNER_TURNS[dialogue.scenario_id];
  if (!learnerTurns) {
    throw new Error(`Unknown scenario: ${dialogue.scenario_id}`);
  }

  // Build the full dialogue transcript from learner turns + tutor suggestions
  const tutorMessages = dialogue.suggestions.map((s) => s.message || '').filter(Boolean);

  // The tutor produces 6 suggestions. For single-agent (dialogue_rounds=0),
  // these are alternative suggestions for the initial turn only.
  // For multi-agent (dialogue_rounds>0), they span the multi-turn conversation.
  // In either case, we present the full set as "the tutor's responses" and
  // ask the judge to code the overall resolution strategy.

  let transcript = '';
  transcript += `## Scenario: ${dialogue.scenario_id.replace(/_/g, ' ')}\n\n`;
  transcript += `**Condition**: ${dialogue.condition} | **Architecture**: ${dialogue.architecture}-agent\n\n`;

  // Reconstruct the dialogue
  transcript += `### Dialogue\n\n`;
  transcript += `**Learner (initial)**: ${learnerTurns.initial}\n\n`;

  // The tutor generates 6 suggestions. In the multi-turn case, each pair
  // of suggestions roughly corresponds to each turn's alternatives.
  // Present all 6 as the tutor's response set.
  transcript += `**Tutor response set** (${tutorMessages.length} suggestions):\n`;
  for (let i = 0; i < tutorMessages.length; i++) {
    transcript += `  ${i + 1}. ${tutorMessages[i]}\n`;
  }
  transcript += '\n';

  // Add learner follow-up turns for context
  for (let t = 1; t <= 5; t++) {
    const turnKey = `turn_${t}`;
    if (learnerTurns[turnKey]) {
      transcript += `**Learner (turn ${t})**: ${learnerTurns[turnKey]}\n\n`;
    }
  }

  // Also include tutor reasoning if available
  const tutorReasonings = dialogue.suggestions.map((s) => s.reasoning || '').filter(Boolean);
  if (tutorReasonings.length > 0) {
    transcript += `### Tutor's Internal Reasoning\n\n`;
    for (let i = 0; i < tutorReasonings.length; i++) {
      transcript += `  ${i + 1}. ${tutorReasonings[i]}\n`;
    }
    transcript += '\n';
  }

  const strategyDescriptions = Object.entries(STRATEGIES)
    .map(([key, s]) => `- **${key}**: ${s.description} (Hegel: ${s.hegel})`)
    .join('\n');

  return `You are a qualitative coder analyzing how an AI tutor handles dialectical impasse in a philosophy tutoring scenario.

## Resolution Strategy Categories

${strategyDescriptions}

## Coding Task

Read the following dialogue transcript. The tutor produced a set of suggestions in response to a learner who is pushing back on the material. Your job is to classify the tutor's **overall resolution strategy** — looking at the full set of responses as a whole.

Code the tutor's approach into exactly ONE primary strategy from the five categories above. Consider:
- Does the tutor engage the learner's position as intellectually valid? (mutual_recognition)
- Does the tutor reassert authority, dismiss the objection, or explain "correctly"? (domination)
- Does the tutor agree with the learner to avoid tension? (capitulation)
- Does the tutor change the subject, suggest moving on, or offer generic encouragement? (withdrawal)
- Does the tutor acknowledge the learner's point AND open new ground for exploration? (scaffolded_reframing)

## Dialogue Transcript

${transcript}

## Output Format

Return a JSON object with this exact structure:
{
  "primary_strategy": "one of: ${STRATEGY_KEYS.join(', ')}",
  "confidence": 1-5,
  "secondary_strategy": "one of: ${STRATEGY_KEYS.join(', ')} or null if clearly single strategy",
  "evidence_quote": "max 40-word quote from the tutor's response that best exemplifies the strategy",
  "reasoning": "2-3 sentence explanation of why this strategy was chosen (max 60 words)",
  "domination_markers": ["list any phrases that assert authority or dismiss the learner"],
  "recognition_markers": ["list any phrases that acknowledge the learner as intellectual equal"]
}

Return ONLY the JSON object, no other text.`;
}

// ── Per-Turn Coding Prompt ───────────────────────────────────────────────

function buildPerTurnCodingPrompt(dialogue, turnIndex) {
  const learnerTurns = LEARNER_TURNS[dialogue.scenario_id];
  if (!learnerTurns) throw new Error(`Unknown scenario: ${dialogue.scenario_id}`);

  const tutorMessages = dialogue.suggestions.map((s) => s.message || '').filter(Boolean);

  // Build transcript up to and including the target turn
  let transcript = '';
  transcript += `## Scenario: ${dialogue.scenario_id.replace(/_/g, ' ')}\n\n`;
  transcript += `**Condition**: ${dialogue.condition} | **Architecture**: ${dialogue.architecture}-agent\n\n`;
  transcript += `### Dialogue (up to and including Turn ${turnIndex})\n\n`;

  // Interleave learner and tutor turns up to the target
  transcript += `**Learner (initial)**: ${learnerTurns.initial}\n\n`;
  if (tutorMessages[0]) transcript += `**Tutor (response 0)**: ${tutorMessages[0]}\n\n`;

  for (let t = 1; t <= turnIndex; t++) {
    const turnKey = `turn_${t}`;
    if (learnerTurns[turnKey]) {
      transcript += `**Learner (turn ${t})**: ${learnerTurns[turnKey]}\n\n`;
    }
    if (tutorMessages[t]) {
      transcript += `**Tutor (response ${t})**: ${tutorMessages[t]}\n\n`;
    }
  }

  const strategyDescriptions = Object.entries(STRATEGIES)
    .map(([key, s]) => `- **${key}**: ${s.description} (Hegel: ${s.hegel})`)
    .join('\n');

  return `You are a qualitative coder analyzing how an AI tutor handles dialectical impasse in a philosophy tutoring scenario.

## Resolution Strategy Categories

${strategyDescriptions}

## Coding Task

Read the following dialogue transcript. The tutor has just responded to the learner at **turn ${turnIndex}**. Your job is to classify the tutor's response at this SPECIFIC turn — the LAST tutor response shown — into exactly one strategy.

Focus ONLY on the tutor's response at turn ${turnIndex}. Do NOT code the overall dialogue or earlier responses. Consider:
- Does the tutor engage the learner's position as intellectually valid? (mutual_recognition)
- Does the tutor reassert authority, dismiss the objection, or explain "correctly"? (domination)
- Does the tutor agree with the learner to avoid tension? (capitulation)
- Does the tutor change the subject, suggest moving on, or offer generic encouragement? (withdrawal)
- Does the tutor acknowledge the learner's point AND open new ground for exploration? (scaffolded_reframing)

## Dialogue Transcript

${transcript}

## Output Format

Return a JSON object with this exact structure:
{
  "primary_strategy": "one of: ${STRATEGY_KEYS.join(', ')}",
  "confidence": 1-5,
  "secondary_strategy": "one of: ${STRATEGY_KEYS.join(', ')} or null if clearly single strategy",
  "evidence_quote": "max 40-word quote from the tutor's turn ${turnIndex} response that best exemplifies the strategy",
  "reasoning": "2-3 sentence explanation (max 60 words)"
}

Return ONLY the JSON object, no other text.`;
}

// ── Per-Turn Analysis ───────────────────────────────────────────────────

function analyzePerTurnResults(codings) {
  // Group by dialogue (same id = same dialogue, different turns)
  const byDialogue = {};
  for (const c of codings) {
    const key = c.id;
    if (!byDialogue[key]) byDialogue[key] = {};
    byDialogue[key][c.turn] = c;
  }

  const analysis = {
    n_dialogues: Object.keys(byDialogue).length,
    n_codings: codings.length,
    // Strategy distribution at each turn
    turnStrategies: { 3: {}, 5: {} },
    // Transition matrix: (turn3 strategy, turn5 strategy) pairs
    transitions: {},
    // Per-condition transitions
    transitionsByCondition: { base: {}, recognition: {} },
    // Strategy stability
    stability: { base: { same: 0, changed: 0 }, recognition: { same: 0, changed: 0 } },
  };

  // Initialize strategy counts per turn
  for (const turn of [3, 5]) {
    for (const s of STRATEGY_KEYS) {
      analysis.turnStrategies[turn][s] = { base: 0, recognition: 0 };
    }
  }

  // Count strategies per turn and compute transitions
  for (const [_id, turns] of Object.entries(byDialogue)) {
    if (!turns[3] || !turns[5]) continue;

    const s3 = turns[3].coding.primary_strategy;
    const s5 = turns[5].coding.primary_strategy;
    const cond = turns[3].condition;

    if (!STRATEGY_KEYS.includes(s3) || !STRATEGY_KEYS.includes(s5)) continue;

    analysis.turnStrategies[3][s3][cond]++;
    analysis.turnStrategies[5][s5][cond]++;

    const transKey = `${s3} → ${s5}`;
    analysis.transitions[transKey] = (analysis.transitions[transKey] || 0) + 1;
    analysis.transitionsByCondition[cond][transKey] = (analysis.transitionsByCondition[cond][transKey] || 0) + 1;

    if (s3 === s5) analysis.stability[cond].same++;
    else analysis.stability[cond].changed++;
  }

  return analysis;
}

function generatePerTurnReport(codings, analysis) {
  const baseN = new Set(codings.filter((c) => c.condition === 'base').map((c) => c.id)).size;
  const recogN = new Set(codings.filter((c) => c.condition === 'recognition').map((c) => c.id)).size;

  let md = `# Per-Turn Strategy Coding: Turns 3 and 5

**Generated:** ${new Date().toISOString()}
**Run ID:** ${codings[0]?.run_id || DEFAULT_RUN_ID}
**N:** ${analysis.n_dialogues} dialogues coded at 2 turns each (${analysis.n_codings} total codings)
**Dialogues:** base=${baseN}, recognition=${recogN}

## Research Question

Do base tutors *start* by engaging but *degrade* to withdrawal as impasse deepens?
Or do they withdraw from the start? Does recognition maintain strategy consistency?

## Strategy Distribution by Turn

### Turn 3 (after first escalation)

| Strategy | Base | Recognition |
|----------|------|-------------|
`;

  for (const s of STRATEGY_KEYS) {
    const b = analysis.turnStrategies[3][s].base;
    const r = analysis.turnStrategies[3][s].recognition;
    if (b > 0 || r > 0) {
      md += `| ${STRATEGIES[s].label} | ${b} | ${r} |\n`;
    }
  }

  md += `\n### Turn 5 (after final challenge)\n\n| Strategy | Base | Recognition |\n|----------|------|-------------|\n`;

  for (const s of STRATEGY_KEYS) {
    const b = analysis.turnStrategies[5][s].base;
    const r = analysis.turnStrategies[5][s].recognition;
    if (b > 0 || r > 0) {
      md += `| ${STRATEGIES[s].label} | ${b} | ${r} |\n`;
    }
  }

  // Strategy stability
  md += `\n## Strategy Stability (Turn 3 → Turn 5)\n\n`;
  md += `| Condition | Same Strategy | Changed Strategy | Stability Rate |\n`;
  md += `|-----------|--------------|-----------------|----------------|\n`;
  for (const cond of ['base', 'recognition']) {
    const s = analysis.stability[cond];
    const total = s.same + s.changed;
    const rate = total > 0 ? ((s.same / total) * 100).toFixed(0) : 'N/A';
    md += `| ${cond} | ${s.same} | ${s.changed} | ${rate}% |\n`;
  }

  // Transition matrices
  md += `\n## Transition Matrix: Turn 3 → Turn 5\n`;

  for (const cond of ['base', 'recognition']) {
    md += `\n### ${cond} (N=${cond === 'base' ? baseN : recogN})\n\n`;
    const trans = analysis.transitionsByCondition[cond];
    if (Object.keys(trans).length === 0) {
      md += `No transitions recorded.\n`;
      continue;
    }
    md += `| Transition | Count |\n|------------|-------|\n`;
    const sorted = Object.entries(trans).sort((a, b) => b[1] - a[1]);
    for (const [key, count] of sorted) {
      md += `| ${key} | ${count} |\n`;
    }
  }

  // Individual dialogue details
  md += `\n## Per-Dialogue Detail\n\n`;
  md += `| ID | Scenario | Condition | Arch | Turn 3 | Turn 5 | Changed? |\n`;
  md += `|----|----------|-----------|------|--------|--------|----------|\n`;

  // Group by dialogue
  const byDialogue = {};
  for (const c of codings) {
    if (!byDialogue[c.id]) byDialogue[c.id] = { ...c };
    byDialogue[c.id][`turn${c.turn}`] = c.coding.primary_strategy;
  }
  for (const [id, d] of Object.entries(byDialogue)) {
    const s3 = d.turn3 || '?';
    const s5 = d.turn5 || '?';
    const changed = s3 !== s5 ? 'YES' : 'no';
    md += `| ${id} | ${d.scenario_id} | ${d.condition} | ${d.architecture} | ${s3} | ${s5} | ${changed} |\n`;
  }

  return md;
}

// ── Chi-Square Test ──────────────────────────────────────────────────────

function chiSquareTest(observed) {
  // observed is a 2D array: rows=strategies, cols=conditions
  const nRows = observed.length;
  const nCols = observed[0].length;
  const rowTotals = observed.map((row) => row.reduce((a, b) => a + b, 0));
  const colTotals = [];
  for (let j = 0; j < nCols; j++) {
    colTotals.push(observed.reduce((sum, row) => sum + row[j], 0));
  }
  const grand = rowTotals.reduce((a, b) => a + b, 0);

  if (grand === 0) return { chi2: 0, df: 0, p: 1, cramersV: 0 };

  let chi2 = 0;
  for (let i = 0; i < nRows; i++) {
    for (let j = 0; j < nCols; j++) {
      const expected = (rowTotals[i] * colTotals[j]) / grand;
      if (expected > 0) {
        chi2 += Math.pow(observed[i][j] - expected, 2) / expected;
      }
    }
  }

  const df = (nRows - 1) * (nCols - 1);
  const k = Math.min(nRows, nCols);
  const cramersV = grand > 0 && k > 1 ? Math.sqrt(chi2 / (grand * (k - 1))) : 0;

  // Approximate p-value using chi-square CDF (Wilson-Hilferty approximation)
  const p = chi2PValue(chi2, df);

  return { chi2, df, p, cramersV };
}

function chi2PValue(x, df) {
  if (df <= 0 || x <= 0) return 1;
  // Regularized upper incomplete gamma function approximation
  // Using series expansion for small chi2 values
  const _a = df / 2;
  const _z = x / 2;

  // For moderate df and chi2, use Wilson-Hilferty normal approximation
  if (df > 2) {
    const cube = 1 - 2 / (9 * df);
    const stdNorm = (Math.pow(x / df, 1 / 3) - cube) / Math.sqrt(2 / (9 * df));
    // Standard normal CDF complement
    return 1 - normalCDF(stdNorm);
  }

  // For df=1,2 use exact formula
  if (df === 1) return 2 * (1 - normalCDF(Math.sqrt(x)));
  if (df === 2) return Math.exp(-x / 2);
  return 1;
}

function normalCDF(x) {
  // Abramowitz & Stegun approximation
  const a1 = 0.254829592,
    a2 = -0.284496736,
    a3 = 1.421413741;
  const a4 = -1.453152027,
    a5 = 1.061405429,
    p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

// ── Analysis ─────────────────────────────────────────────────────────────

function analyzeResults(codings) {
  const analysis = {
    n: codings.length,
    strategyByCondition: {},
    strategyByArchitecture: {},
    strategyByScenario: {},
    exemplars: {},
    chiSquare: {},
  };

  // Initialize counts
  for (const s of STRATEGY_KEYS) {
    analysis.strategyByCondition[s] = { base: 0, recognition: 0 };
    analysis.strategyByArchitecture[s] = { single: 0, multi: 0 };
    analysis.exemplars[s] = { base: null, recognition: null };
  }

  const scenarios = [...new Set(codings.map((c) => c.scenario_id))];
  for (const sc of scenarios) {
    analysis.strategyByScenario[sc] = {};
    for (const s of STRATEGY_KEYS) {
      analysis.strategyByScenario[sc][s] = { base: 0, recognition: 0 };
    }
  }

  // Count and collect exemplars
  for (const c of codings) {
    const strat = c.coding.primary_strategy;
    if (!STRATEGY_KEYS.includes(strat)) continue;

    analysis.strategyByCondition[strat][c.condition]++;
    analysis.strategyByArchitecture[strat][c.architecture]++;
    analysis.strategyByScenario[c.scenario_id][strat][c.condition]++;

    // Collect exemplar (highest confidence)
    const conf = c.coding.confidence || 0;
    const existing = analysis.exemplars[strat][c.condition];
    if (!existing || conf > (existing.confidence || 0)) {
      analysis.exemplars[strat][c.condition] = {
        id: c.id,
        scenario_id: c.scenario_id,
        profile_name: c.profile_name,
        quote: c.coding.evidence_quote,
        confidence: conf,
      };
    }
  }

  // Chi-square: strategy × condition (overall)
  const activeStrategies = STRATEGY_KEYS.filter(
    (s) => analysis.strategyByCondition[s].base > 0 || analysis.strategyByCondition[s].recognition > 0,
  );
  if (activeStrategies.length > 1) {
    const observed = activeStrategies.map((s) => [
      analysis.strategyByCondition[s].base,
      analysis.strategyByCondition[s].recognition,
    ]);
    analysis.chiSquare.overall = {
      ...chiSquareTest(observed),
      strategies: activeStrategies,
    };
  }

  // Chi-square per scenario
  for (const sc of scenarios) {
    const scActive = STRATEGY_KEYS.filter(
      (s) => analysis.strategyByScenario[sc][s].base > 0 || analysis.strategyByScenario[sc][s].recognition > 0,
    );
    if (scActive.length > 1) {
      const observed = scActive.map((s) => [
        analysis.strategyByScenario[sc][s].base,
        analysis.strategyByScenario[sc][s].recognition,
      ]);
      analysis.chiSquare[sc] = {
        ...chiSquareTest(observed),
        strategies: scActive,
      };
    }
  }

  // Chi-square: strategy × architecture
  const archActive = STRATEGY_KEYS.filter(
    (s) => analysis.strategyByArchitecture[s].single > 0 || analysis.strategyByArchitecture[s].multi > 0,
  );
  if (archActive.length > 1) {
    const observed = archActive.map((s) => [
      analysis.strategyByArchitecture[s].single,
      analysis.strategyByArchitecture[s].multi,
    ]);
    analysis.chiSquare.architecture = {
      ...chiSquareTest(observed),
      strategies: archActive,
    };
  }

  return analysis;
}

// ── Report Generation ────────────────────────────────────────────────────

function generateReport(codings, analysis) {
  const baseN = codings.filter((c) => c.condition === 'base').length;
  const recogN = codings.filter((c) => c.condition === 'recognition').length;

  let md = `# Dialectical Impasse Resolution Strategy Coding

**Generated:** ${new Date().toISOString()}
**Run ID:** ${codings[0]?.run_id || DEFAULT_RUN_ID}
**N:** ${analysis.n} dialogues (base=${baseN}, recognition=${recogN})
**Scenarios:** ${[...new Set(codings.map((c) => c.scenario_id))].join(', ')}

## Strategy Distribution by Condition

| Strategy | Base (N=${baseN}) | % | Recognition (N=${recogN}) | % | Diff |
|----------|-----------|------|---------------|------|------|
`;

  for (const s of STRATEGY_KEYS) {
    const b = analysis.strategyByCondition[s].base;
    const r = analysis.strategyByCondition[s].recognition;
    const bPct = baseN > 0 ? ((b / baseN) * 100).toFixed(1) : '0.0';
    const rPct = recogN > 0 ? ((r / recogN) * 100).toFixed(1) : '0.0';
    const diff = (parseFloat(rPct) - parseFloat(bPct)).toFixed(1);
    md += `| ${STRATEGIES[s].label} | ${b} | ${bPct}% | ${r} | ${rPct}% | ${diff > 0 ? '+' : ''}${diff}% |\n`;
  }

  // Chi-square results
  if (analysis.chiSquare.overall) {
    const cs = analysis.chiSquare.overall;
    md += `\n**Chi-square (strategy × condition):** χ²(${cs.df}) = ${cs.chi2.toFixed(2)}, `;
    md += cs.p < 0.001 ? 'p < .001' : `p = ${cs.p.toFixed(3)}`;
    md += `, Cramér's V = ${cs.cramersV.toFixed(3)}\n`;
  }

  // Architecture table
  md += `\n## Strategy Distribution by Architecture

| Strategy | Single | Multi | Diff |
|----------|--------|-------|------|
`;
  const singleN = codings.filter((c) => c.architecture === 'single').length;
  const multiN = codings.filter((c) => c.architecture === 'multi').length;
  for (const s of STRATEGY_KEYS) {
    const si = analysis.strategyByArchitecture[s].single;
    const mu = analysis.strategyByArchitecture[s].multi;
    const siPct = singleN > 0 ? ((si / singleN) * 100).toFixed(1) : '0.0';
    const muPct = multiN > 0 ? ((mu / multiN) * 100).toFixed(1) : '0.0';
    const diff = (parseFloat(muPct) - parseFloat(siPct)).toFixed(1);
    md += `| ${STRATEGIES[s].label} | ${si} (${siPct}%) | ${mu} (${muPct}%) | ${diff > 0 ? '+' : ''}${diff}% |\n`;
  }

  if (analysis.chiSquare.architecture) {
    const cs = analysis.chiSquare.architecture;
    md += `\n**Chi-square (strategy × architecture):** χ²(${cs.df}) = ${cs.chi2.toFixed(2)}, `;
    md += cs.p < 0.001 ? 'p < .001' : `p = ${cs.p.toFixed(3)}`;
    md += `, Cramér's V = ${cs.cramersV.toFixed(3)}\n`;
  }

  // Per-scenario breakdown
  md += `\n## Per-Scenario Breakdown\n`;
  const scenarios = [...new Set(codings.map((c) => c.scenario_id))];
  for (const sc of scenarios) {
    const scCodings = codings.filter((c) => c.scenario_id === sc);
    const scBase = scCodings.filter((c) => c.condition === 'base').length;
    const scRecog = scCodings.filter((c) => c.condition === 'recognition').length;
    md += `\n### ${sc.replace(/_/g, ' ')} (base=${scBase}, recog=${scRecog})\n\n`;
    md += `| Strategy | Base | Recognition |\n|----------|------|-------------|\n`;
    for (const s of STRATEGY_KEYS) {
      const b = analysis.strategyByScenario[sc][s].base;
      const r = analysis.strategyByScenario[sc][s].recognition;
      if (b > 0 || r > 0) {
        md += `| ${STRATEGIES[s].label} | ${b} | ${r} |\n`;
      }
    }
    if (analysis.chiSquare[sc]) {
      const cs = analysis.chiSquare[sc];
      md += `\nχ²(${cs.df}) = ${cs.chi2.toFixed(2)}, `;
      md += cs.p < 0.001 ? 'p < .001' : `p = ${cs.p.toFixed(3)}`;
      md += `, V = ${cs.cramersV.toFixed(3)}\n`;
    }
  }

  // Exemplar quotes
  md += `\n## Exemplar Quotes by Strategy\n`;
  for (const s of STRATEGY_KEYS) {
    const baseEx = analysis.exemplars[s].base;
    const recogEx = analysis.exemplars[s].recognition;
    if (baseEx || recogEx) {
      md += `\n### ${STRATEGIES[s].label}\n`;
      md += `*${STRATEGIES[s].description}*\n\n`;
      if (baseEx) {
        md += `- **Base** (${baseEx.scenario_id}, id=${baseEx.id}, conf=${baseEx.confidence}): "${baseEx.quote}"\n`;
      }
      if (recogEx) {
        md += `- **Recognition** (${recogEx.scenario_id}, id=${recogEx.id}, conf=${recogEx.confidence}): "${recogEx.quote}"\n`;
      }
    }
  }

  // Confidence distribution
  md += `\n## Coding Confidence Distribution\n\n`;
  const confByCondition = { base: [], recognition: [] };
  for (const c of codings) {
    confByCondition[c.condition].push(c.coding.confidence || 0);
  }
  for (const cond of ['base', 'recognition']) {
    const vals = confByCondition[cond];
    if (vals.length > 0) {
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      md += `- **${cond}**: mean confidence = ${mean.toFixed(2)} (N=${vals.length})\n`;
    }
  }

  // Domination/recognition marker summary
  md += `\n## Marker Analysis\n\n`;
  const domMarkers = { base: [], recognition: [] };
  const recMarkers = { base: [], recognition: [] };
  for (const c of codings) {
    if (c.coding.domination_markers?.length > 0) {
      domMarkers[c.condition].push(...c.coding.domination_markers);
    }
    if (c.coding.recognition_markers?.length > 0) {
      recMarkers[c.condition].push(...c.coding.recognition_markers);
    }
  }
  md += `### Domination markers\n`;
  md += `- Base: ${domMarkers.base.length} markers across ${baseN} dialogues\n`;
  md += `- Recognition: ${domMarkers.recognition.length} markers across ${recogN} dialogues\n`;
  if (domMarkers.base.length > 0) {
    md += `- Base examples: ${domMarkers.base
      .slice(0, 5)
      .map((m) => `"${m}"`)
      .join(', ')}\n`;
  }
  if (domMarkers.recognition.length > 0) {
    md += `- Recognition examples: ${domMarkers.recognition
      .slice(0, 5)
      .map((m) => `"${m}"`)
      .join(', ')}\n`;
  }

  md += `\n### Recognition markers\n`;
  md += `- Base: ${recMarkers.base.length} markers across ${baseN} dialogues\n`;
  md += `- Recognition: ${recMarkers.recognition.length} markers across ${recogN} dialogues\n`;
  if (recMarkers.base.length > 0) {
    md += `- Base examples: ${recMarkers.base
      .slice(0, 5)
      .map((m) => `"${m}"`)
      .join(', ')}\n`;
  }
  if (recMarkers.recognition.length > 0) {
    md += `- Recognition examples: ${recMarkers.recognition
      .slice(0, 5)
      .map((m) => `"${m}"`)
      .join(', ')}\n`;
  }

  return md;
}

// ── CLI ──────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    model: 'claude-code',
    runId: DEFAULT_RUN_ID,
    perTurn: false,
  };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--model':
        opts.model = args[++i];
        break;
      case '--run-id':
        opts.runId = args[++i];
        break;
      case '--per-turn':
        opts.perTurn = true;
        break;
      case '--help':
        console.log(`Usage: node scripts/code-impasse-strategies.js [options]

Options:
  --model <model>    Model for coding (default: claude-code)
                       claude-code — Claude Code CLI (subscription, free)
                       haiku       — OpenRouter Haiku
                       sonnet      — OpenRouter Sonnet
  --run-id <id>      Run ID to code (default: ${DEFAULT_RUN_ID})
  --per-turn         Code turns 3 and 5 independently (track strategy evolution)
  --help             Show this help`);
        process.exit(0);
    }
  }
  return opts;
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  const dbPath = path.join(process.cwd(), 'data', 'evaluations.db');
  if (!fs.existsSync(dbPath)) {
    console.error('Database not found:', dbPath);
    process.exit(1);
  }

  const db = new Database(dbPath);

  console.log('='.repeat(70));
  console.log(
    opts.perTurn ? 'PER-TURN STRATEGY CODING (Turns 3 & 5)' : 'DIALECTICAL IMPASSE RESOLUTION STRATEGY CODING',
  );
  console.log('='.repeat(70));
  console.log(`Model: ${opts.model} | Run ID: ${opts.runId}`);

  // Load dialogues
  const dialogues = loadDialogues(db, opts.runId);
  console.log(`\nLoaded ${dialogues.length} dialogues`);
  const baseN = dialogues.filter((d) => d.condition === 'base').length;
  const recogN = dialogues.filter((d) => d.condition === 'recognition').length;
  console.log(`  Base: ${baseN}, Recognition: ${recogN}`);
  console.log(`  Scenarios: ${[...new Set(dialogues.map((d) => d.scenario_id))].join(', ')}`);

  if (dialogues.length === 0) {
    console.error('No dialogues found.');
    db.close();
    return;
  }

  // Ensure exports directory
  const exportsDir = path.join(process.cwd(), 'exports');
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  if (opts.perTurn) {
    // ── Per-Turn Mode ───────────────────────────────────────────────
    const TARGET_TURNS = [3, 5];
    const codings = [];
    let errors = 0;
    const startTime = Date.now();
    const totalCalls = dialogues.length * TARGET_TURNS.length;
    let callNum = 0;

    for (const d of dialogues) {
      // Verify dialogue has enough suggestions
      if (d.suggestions.length < 6) {
        console.warn(`  SKIP ${d.id}: only ${d.suggestions.length} suggestions (need 6)`);
        continue;
      }

      for (const turn of TARGET_TURNS) {
        callNum++;
        const progress = `[${callNum}/${totalCalls}]`;
        process.stdout.write(`  ${progress} Turn ${turn}: ${d.scenario_id} / ${d.profile_name}...`);

        try {
          const prompt = buildPerTurnCodingPrompt(d, turn);
          const content = await callModel(prompt, opts.model);
          const parsed = parseJsonResponse(content);

          if (!STRATEGY_KEYS.includes(parsed.primary_strategy)) {
            console.warn(` WARN: invalid strategy "${parsed.primary_strategy}", skipping`);
            errors++;
            continue;
          }

          codings.push({
            id: d.id,
            run_id: opts.runId,
            scenario_id: d.scenario_id,
            profile_name: d.profile_name,
            condition: d.condition,
            architecture: d.architecture,
            overall_score: d.overall_score,
            turn,
            coding: parsed,
          });

          console.log(` → ${parsed.primary_strategy} (conf=${parsed.confidence})`);
        } catch (err) {
          errors++;
          console.error(` ERROR: ${err.message}`);
        }
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nCoding complete: ${codings.length} coded, ${errors} errors, ${elapsed}s`);

    if (codings.length === 0) {
      console.error('No successful codings.');
      db.close();
      return;
    }

    const analysis = analyzePerTurnResults(codings);

    const jsonPath = path.join(exportsDir, `impasse-per-turn-coding-${timestamp}.json`);
    fs.writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          generated: new Date().toISOString(),
          model: opts.model,
          runId: opts.runId,
          mode: 'per-turn',
          targetTurns: TARGET_TURNS,
          n: codings.length,
          errors,
          codings,
          analysis,
        },
        null,
        2,
      ),
    );
    console.log(`\nJSON: ${jsonPath}`);

    const mdReport = generatePerTurnReport(codings, analysis);
    const mdPath = path.join(exportsDir, `impasse-per-turn-coding-${timestamp}.md`);
    fs.writeFileSync(mdPath, mdReport);
    console.log(`Markdown: ${mdPath}`);

    // Print summary
    console.log('\n' + '─'.repeat(70));
    console.log('PER-TURN STRATEGY SUMMARY');
    console.log('─'.repeat(70));

    for (const turn of TARGET_TURNS) {
      console.log(`\n  Turn ${turn}:`);
      console.log(`  ${'Strategy'.padEnd(25)} ${'Base'.padEnd(8)} Recog`);
      for (const s of STRATEGY_KEYS) {
        const b = analysis.turnStrategies[turn][s].base;
        const r = analysis.turnStrategies[turn][s].recognition;
        if (b > 0 || r > 0) {
          console.log(`    ${STRATEGIES[s].label.padEnd(23)} ${String(b).padEnd(8)} ${r}`);
        }
      }
    }

    console.log(`\n  Strategy stability (turn 3 → turn 5):`);
    for (const cond of ['base', 'recognition']) {
      const s = analysis.stability[cond];
      const total = s.same + s.changed;
      const rate = total > 0 ? ((s.same / total) * 100).toFixed(0) : 'N/A';
      console.log(`    ${cond}: ${s.same} same, ${s.changed} changed (${rate}% stable)`);
    }

    console.log(`\n  Transition patterns:`);
    for (const cond of ['base', 'recognition']) {
      console.log(`    ${cond}:`);
      const trans = analysis.transitionsByCondition[cond];
      const sorted = Object.entries(trans).sort((a, b) => b[1] - a[1]);
      for (const [key, count] of sorted) {
        console.log(`      ${key}: ${count}`);
      }
    }
  } else {
    // ── Overall Mode (original) ─────────────────────────────────────

    // Code each dialogue
    const codings = [];
    let errors = 0;
    const startTime = Date.now();

    for (let i = 0; i < dialogues.length; i++) {
      const d = dialogues[i];
      const progress = `[${i + 1}/${dialogues.length}]`;
      process.stdout.write(`  ${progress} Coding ${d.scenario_id} / ${d.profile_name}...`);

      try {
        const prompt = buildCodingPrompt(d);
        const content = await callModel(prompt, opts.model);
        const parsed = parseJsonResponse(content);

        // Validate strategy
        if (!STRATEGY_KEYS.includes(parsed.primary_strategy)) {
          console.warn(` WARN: invalid strategy "${parsed.primary_strategy}", skipping`);
          errors++;
          continue;
        }

        codings.push({
          id: d.id,
          run_id: opts.runId,
          scenario_id: d.scenario_id,
          profile_name: d.profile_name,
          condition: d.condition,
          architecture: d.architecture,
          overall_score: d.overall_score,
          coding: parsed,
        });

        console.log(` → ${parsed.primary_strategy} (conf=${parsed.confidence})`);
      } catch (err) {
        errors++;
        console.error(` ERROR: ${err.message}`);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nCoding complete: ${codings.length} coded, ${errors} errors, ${elapsed}s`);

    if (codings.length === 0) {
      console.error('No successful codings.');
      db.close();
      return;
    }

    // Analyze
    const analysis = analyzeResults(codings);

    // Write outputs
    const jsonPath = path.join(exportsDir, `impasse-strategy-coding-${timestamp}.json`);
    fs.writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          generated: new Date().toISOString(),
          model: opts.model,
          runId: opts.runId,
          n: codings.length,
          errors,
          codings,
          analysis,
        },
        null,
        2,
      ),
    );
    console.log(`\nJSON: ${jsonPath}`);

    const mdReport = generateReport(codings, analysis);
    const mdPath = path.join(exportsDir, `impasse-strategy-coding-${timestamp}.md`);
    fs.writeFileSync(mdPath, mdReport);
    console.log(`Markdown: ${mdPath}`);

    // Print summary
    console.log('\n' + '─'.repeat(70));
    console.log('STRATEGY DISTRIBUTION SUMMARY');
    console.log('─'.repeat(70));
    console.log(`${'Strategy'.padEnd(25)} ${'Base'.padEnd(12)} ${'Recog'.padEnd(12)} Diff`);
    console.log('─'.repeat(60));
    for (const s of STRATEGY_KEYS) {
      const b = analysis.strategyByCondition[s].base;
      const r = analysis.strategyByCondition[s].recognition;
      const bPct = baseN > 0 ? ((b / baseN) * 100).toFixed(0) : '0';
      const rPct = recogN > 0 ? ((r / recogN) * 100).toFixed(0) : '0';
      const diff = parseInt(rPct) - parseInt(bPct);
      console.log(
        `  ${STRATEGIES[s].label.padEnd(23)} ${(b + ' (' + bPct + '%)').padEnd(12)} ${(r + ' (' + rPct + '%)').padEnd(12)} ${diff > 0 ? '+' : ''}${diff}%`,
      );
    }

    if (analysis.chiSquare.overall) {
      const cs = analysis.chiSquare.overall;
      const pStr = cs.p < 0.001 ? 'p < .001' : `p = ${cs.p.toFixed(3)}`;
      console.log(`\n  χ²(${cs.df}) = ${cs.chi2.toFixed(2)}, ${pStr}, V = ${cs.cramersV.toFixed(3)}`);
    }
  }

  db.close();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
