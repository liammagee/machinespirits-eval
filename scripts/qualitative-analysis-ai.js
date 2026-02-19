#!/usr/bin/env node

/**
 * AI-Based Thematic Analysis of Evaluation Transcripts
 *
 * Two modes:
 *   Option 1 (--mode classify): Classify responses against existing 6 thematic categories
 *   Option 2 (--mode discover): Open-ended theme discovery with no predefined categories
 *
 * Usage:
 *   node scripts/qualitative-analysis-ai.js --mode classify --model claude-code [--sample 50]
 *   node scripts/qualitative-analysis-ai.js --mode discover --model haiku [--sample 50]
 *   node scripts/qualitative-analysis-ai.js --mode both --model claude-code [--sample 100]
 *   node scripts/qualitative-analysis-ai.js --cost-estimate
 *
 * Models:
 *   claude-code  — Uses Claude Code CLI (your subscription, no API cost)
 *   haiku        — OpenRouter Haiku (~$0.003/call)
 *   sonnet       — OpenRouter Sonnet (~$0.008/call)
 *   opus         — OpenRouter Opus (~$0.04/call)
 *
 * Default: claude-code (free via subscription)
 */

import 'dotenv/config';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import readline from 'readline';

// ── Model Configuration ─────────────────────────────────────────────────

const MODEL_MAP = {
  'claude-code': 'claude-code',  // Uses Claude Code CLI subprocess (subscription)
  haiku: 'anthropic/claude-haiku-4.5',
  sonnet: 'anthropic/claude-sonnet-4.5',
  opus: 'anthropic/claude-opus-4.5',
};

// OpenRouter pricing per million tokens (as of Feb 2026)
const PRICING = {
  haiku:  { input: 1.00,  output: 5.00  },
  sonnet: { input: 3.00,  output: 15.00 },
  opus:   { input: 15.00, output: 75.00 },
};

// ── Existing Regex Categories (from qualitative-analysis.js) ────────────

const THEMATIC_CATEGORIES = {
  engagement: {
    label: 'Engagement markers',
    description: 'Second-person engagement with learner contributions (e.g., "your insight", "building on your", "you\'ve raised")',
    examples_positive: [
      'Your insight about alienation connects to...',
      'Building on your earlier point about power...',
      'You\'ve raised an important question here.',
    ],
    examples_negative: [
      'The concept of alienation is important.',
      'Let me explain how this works.',
      'You should review the next lecture.',
    ],
  },
  transformation: {
    label: 'Transformation language',
    description: 'Markers of mutual change or perspective shift (e.g., "reconsidering", "that changes how I", "I hadn\'t thought")',
    examples_positive: [
      'That changes how I think about this passage.',
      'I hadn\'t considered that angle before.',
      'Your critique enriches the standard reading.',
    ],
    examples_negative: [
      'The correct interpretation is...',
      'You should think about it this way.',
      'Here is the standard view.',
    ],
  },
  struggle_honoring: {
    label: 'Struggle-honoring',
    description: 'Acknowledging productive confusion or difficulty (e.g., "wrestling with", "productive confusion", "grappling with")',
    examples_positive: [
      'You\'re wrestling with a genuinely hard question.',
      'This productive confusion is where real learning happens.',
      'The tension between these ideas is worth sitting with.',
    ],
    examples_negative: [
      'Don\'t worry, this is easy once you understand it.',
      'The answer is straightforward.',
      'Let me simplify this for you.',
    ],
  },
  learner_as_subject: {
    label: 'Learner-as-subject framing',
    description: 'Treating learner as autonomous intellectual agent (e.g., "your interpretation", "your framework", "what you\'re building")',
    examples_positive: [
      'Your interpretation of the text offers...',
      'Your framework for understanding this...',
      'What you\'re developing is a sophisticated reading.',
    ],
    examples_negative: [
      'The correct framework is...',
      'Students typically understand this as...',
      'The textbook says...',
    ],
  },
  directive: {
    label: 'Directive framing',
    description: 'Expert-to-novice instructional markers (e.g., "you should", "you need to", "the correct answer is")',
    examples_positive: [
      'You should review the next lecture.',
      'You need to understand this before moving on.',
      'The correct approach is...',
    ],
    examples_negative: [
      'What if we explored this differently?',
      'Your approach suggests...',
      'Consider how this connects to...',
    ],
  },
  generic: {
    label: 'Generic/placeholder',
    description: 'Vague pedagogical language without specificity (e.g., "foundational", "key concepts", "solid foundation")',
    examples_positive: [
      'This covers foundational concepts.',
      'Building a solid foundation is key.',
      'Review the key concepts before proceeding.',
    ],
    examples_negative: [
      'The dialectic between master and slave reveals...',
      'Your reading of commodity fetishism...',
      'Consider how reification operates in...',
    ],
  },
};

// Regex patterns for inter-method agreement scoring
const REGEX_PATTERNS = {
  engagement: [
    /your insight/gi, /building on your/gi, /your question/gi, /your point/gi,
    /your observation/gi, /your analysis/gi, /your argument/gi, /your critique/gi,
    /you've (raised|identified|highlighted|noticed|pointed out)/gi,
    /you're (asking|raising|pushing|exploring|getting at)/gi,
  ],
  transformation: [
    /reconsidering/gi, /that changes (how I|my)/gi, /I hadn't (thought|considered)/gi,
    /revising (my|the)/gi, /let me (revise|adjust|rethink)/gi,
    /you've (helped|pushed|made) me/gi, /your .{1,20} (complicates|enriches|changes)/gi,
    /shifts? (my|the|our) (understanding|framing|approach)/gi,
  ],
  struggle_honoring: [
    /wrestling with/gi, /productive confusion/gi, /working through/gi,
    /grappling with/gi, /sitting with (the|this)/gi, /tension (between|here|you)/gi,
    /difficulty (is|here)/gi, /struggle (with|is|here)/gi,
    /not (easy|simple|straightforward)/gi,
  ],
  learner_as_subject: [
    /your interpretation/gi, /your analysis/gi, /your understanding/gi,
    /you're grappling with/gi, /your perspective/gi, /your framework/gi,
    /your reading/gi, /what you're (doing|building|developing|constructing)/gi,
    /your (intellectual|philosophical|analytical)/gi,
  ],
  directive: [
    /you should/gi, /you need to/gi, /you must/gi,
    /the correct (answer|approach|way)/gi, /the answer is/gi,
    /let me explain/gi, /here's what/gi, /make sure (to|you)/gi,
    /first,? you/gi,
  ],
  generic: [
    /foundational/gi, /key concepts/gi, /learning objectives/gi,
    /knowledge base/gi, /solid foundation/gi, /core concepts/gi,
    /build (a|your) (solid|strong)/gi,
    /comprehensive (understanding|overview|review)/gi,
  ],
};

// ── Prompts ─────────────────────────────────────────────────────────────

function buildClassifyPrompt(responseText, condition) {
  const catDescriptions = Object.entries(THEMATIC_CATEGORIES).map(([key, cat]) => {
    const posExamples = cat.examples_positive.map(e => `  + "${e}"`).join('\n');
    const negExamples = cat.examples_negative.map(e => `  - "${e}"`).join('\n');
    return `**${key}** (${cat.label}): ${cat.description}\nPresent examples:\n${posExamples}\nAbsent examples:\n${negExamples}`;
  }).join('\n\n');

  return `You are a qualitative coding expert analyzing AI tutor responses in an educational technology study.

The study compares tutor responses generated under two conditions:
- "base": Tutors with standard pedagogical prompts
- "recognition": Tutors with recognition-theory prompts (Hegelian mutual recognition)

This response was generated under the **${condition}** condition.

## Task

Analyze the following tutor response for the presence/absence of each thematic category. For each category, provide:
1. **present**: true/false — is this theme present in the response?
2. **confidence**: 0.0-1.0 — how confident are you?
3. **evidence**: A brief quote or description of what led to your judgment (max 30 words)
4. **strength**: "none" | "weak" | "moderate" | "strong" — how prominently does this theme appear?

## Categories

${catDescriptions}

## Response to Analyze

${responseText}

## Output Format

Return a JSON object with this exact structure:
{
  "categories": {
    "engagement": { "present": true/false, "confidence": 0.0-1.0, "evidence": "...", "strength": "none|weak|moderate|strong" },
    "transformation": { ... },
    "struggle_honoring": { ... },
    "learner_as_subject": { ... },
    "directive": { ... },
    "generic": { ... }
  },
  "dominant_theme": "category_key",
  "overall_quality_note": "One sentence summary of the response's pedagogical character (max 40 words)"
}

Return ONLY the JSON object, no other text.`;
}

function buildDiscoverPrompt(responseText, condition) {
  return `You are a qualitative coding expert performing open-ended thematic analysis on AI tutor responses in an educational technology study.

The study compares tutor responses generated under two conditions:
- "base": Tutors with standard pedagogical prompts
- "recognition": Tutors with recognition-theory prompts (Hegelian mutual recognition)

This response was generated under the **${condition}** condition.

## Task

Read the following tutor response carefully and identify the **3-5 most prominent themes** you observe. These should be emergent themes — do NOT use predefined categories. Focus on:

- Pedagogical stance (how does the tutor position itself relative to the learner?)
- Epistemic orientation (how does the tutor treat knowledge — as fixed or constructed?)
- Relational quality (how does the tutor relate to the learner — as equal, authority, guide?)
- Engagement depth (surface-level vs deep intellectual engagement)
- Language patterns (what's distinctive about the word choices and framing?)

## Response to Analyze

${responseText}

## Output Format

Return a JSON object with this exact structure:
{
  "themes": [
    {
      "name": "short_theme_name",
      "label": "Human-Readable Theme Label",
      "description": "1-2 sentence description of this theme",
      "evidence": "Brief quote or paraphrase from the response (max 30 words)",
      "salience": "low|medium|high"
    }
  ],
  "pedagogical_stance": "One of: authoritative, collaborative, facilitative, directive, dialogical, or a custom term",
  "epistemic_orientation": "One of: transmissive, constructivist, dialectical, or a custom term",
  "overall_impression": "2-3 sentence qualitative description of this response's character (max 60 words)"
}

Return ONLY the JSON object, no other text.`;
}

// ── Model Calls ─────────────────────────────────────────────────────────

/**
 * Call the model via the appropriate backend.
 * claude-code: spawns `claude -p -` subprocess (uses subscription, no API cost)
 * haiku/sonnet/opus: calls OpenRouter API
 */
async function callModel(prompt, modelKey) {
  if (modelKey === 'claude-code') {
    return callClaudeCode(prompt);
  }
  return callOpenRouter(prompt, modelKey);
}

async function callClaudeCode(prompt) {
  const claudeArgs = ['-p', '-', '--output-format', 'text'];

  const stdout = await new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY; // force subscription path
    const child = spawn('claude', claudeArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });
    let out = '';
    let err = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('error', e => reject(new Error(`Failed to spawn claude: ${e.message}`)));
    child.on('close', code => {
      if (code !== 0) reject(new Error(err || out || `claude exited with code ${code}`));
      else resolve(out);
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });

  return { content: stdout.trim(), usage: {} };
}

async function callOpenRouter(prompt, modelKey) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set. Export it before running.');

  const model = MODEL_MAP[modelKey];
  if (!model) throw new Error(`Unknown model: ${modelKey}. Use: claude-code, haiku, sonnet, opus`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
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
    if (!content) throw new Error('No content in OpenRouter response');

    const usage = data.usage || {};
    return { content, usage };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

function parseJsonResponse(content) {
  try {
    return JSON.parse(content);
  } catch {
    // Try to extract JSON from markdown code blocks
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1].trim());
    throw new Error(`Failed to parse JSON: ${content.slice(0, 200)}`);
  }
}

// ── Regex Comparison ────────────────────────────────────────────────────

function regexClassify(text) {
  const results = {};
  for (const [category, patterns] of Object.entries(REGEX_PATTERNS)) {
    let found = false;
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        found = true;
        break;
      }
    }
    results[category] = found;
  }
  return results;
}

// ── Data Loading ────────────────────────────────────────────────────────

function loadData(db, cells, _sampleSize) {
  const _cellList = cells.map(c => `'cell_${c}_base_single_unified','cell_${c}_base_single_psycho','cell_${c}_base_multi_unified','cell_${c}_base_multi_psycho','cell_${c}_recog_single_unified','cell_${c}_recog_single_psycho','cell_${c}_recog_multi_unified','cell_${c}_recog_multi_psycho'`);

  // Build cell name list from cell numbers
  const baseCells = [];
  const recogCells = [];
  for (const c of cells) {
    if (c <= 4) {
      baseCells.push(`cell_${c}_base_single_unified`, `cell_${c}_base_single_psycho`,
        `cell_${c}_base_multi_unified`, `cell_${c}_base_multi_psycho`);
    } else {
      recogCells.push(`cell_${c}_recog_single_unified`, `cell_${c}_recog_single_psycho`,
        `cell_${c}_recog_multi_unified`, `cell_${c}_recog_multi_psycho`);
    }
  }

  const allCells = [...baseCells, ...recogCells];
  const placeholders = allCells.map(() => '?').join(',');

  const query = `
    SELECT id, scenario_id, profile_name, overall_score, suggestions,
      CASE WHEN profile_name LIKE 'cell_1_%' OR profile_name LIKE 'cell_2_%'
           OR profile_name LIKE 'cell_3_%' OR profile_name LIKE 'cell_4_%'
      THEN 'base' ELSE 'recognition' END as condition
    FROM evaluation_results
    WHERE success = 1
      AND overall_score IS NOT NULL
      AND suggestions IS NOT NULL
      AND judge_model LIKE 'claude-opus-%'
      AND profile_name IN (${placeholders})
  `;

  // Note: when resuming with --sample, we load all data and let the
  // checkpoint filter handle deduplication. The sample limit only applies
  // to NEW items to process (see runClassification/runDiscovery).
  const rows = db.prepare(query).all(...allCells);

  return rows.map(row => {
    let messages = [], reasonings = [];
    try {
      const parsed = JSON.parse(row.suggestions);
      if (Array.isArray(parsed)) {
        messages = parsed.map(s => s.message || '').filter(Boolean);
        reasonings = parsed.map(s => s.reasoning || '').filter(Boolean);
      }
    } catch { /* skip */ }

    return {
      id: row.id,
      scenario_id: row.scenario_id,
      profile_name: row.profile_name,
      overall_score: row.overall_score,
      condition: row.condition,
      messageText: messages.join('\n\n'),
      reasoningText: reasonings.join('\n\n'),
      fullText: [...messages, ...reasonings].join('\n\n'),
    };
  }).filter(r => r.messageText.length > 0);
}

// ── Cost Estimation ─────────────────────────────────────────────────────

function printCostEstimate(db) {
  console.log('='.repeat(70));
  console.log('COST ESTIMATE: AI THEMATIC ANALYSIS');
  console.log('='.repeat(70));

  // Count responses
  const factorialCount = db.prepare(`
    SELECT COUNT(*) as n FROM evaluation_results
    WHERE success = 1 AND overall_score IS NOT NULL AND suggestions IS NOT NULL
      AND judge_model LIKE 'claude-opus-%'
      AND (profile_name LIKE 'cell_1_%' OR profile_name LIKE 'cell_2_%'
       OR profile_name LIKE 'cell_3_%' OR profile_name LIKE 'cell_4_%'
       OR profile_name LIKE 'cell_5_%' OR profile_name LIKE 'cell_6_%'
       OR profile_name LIKE 'cell_7_%' OR profile_name LIKE 'cell_8_%')
  `).get().n;

  const allCount = db.prepare(`
    SELECT COUNT(*) as n FROM evaluation_results
    WHERE success = 1 AND overall_score IS NOT NULL AND suggestions IS NOT NULL
      AND judge_model LIKE 'claude-opus-%'
  `).get().n;

  // Estimated tokens per call
  const inputTokens = 1200;  // prompt + response text
  const outputTokens = 300;  // JSON output

  console.log(`\nData volumes:`);
  console.log(`  Factorial (cells 1-8): ${factorialCount} responses`);
  console.log(`  All Opus-judged data:  ${allCount} responses`);
  console.log(`\nPer-call estimate: ~${inputTokens} input tokens, ~${outputTokens} output tokens`);
  console.log(`\nNote: Running both classify + discover modes doubles the cost.\n`);

  console.log(`| Model  | Per Call | Factorial (N=${factorialCount}) | All Data (N=${allCount}) | Both Modes × All |`);
  console.log('|--------|---------|------------------|-----------------|------------------|');

  for (const [model, pricing] of Object.entries(PRICING)) {
    const perCall = (inputTokens * pricing.input / 1e6) + (outputTokens * pricing.output / 1e6);
    const factorial = perCall * factorialCount;
    const all = perCall * allCount;
    const bothAll = all * 2;
    console.log(`| ${model.padEnd(6)} | $${perCall.toFixed(4).padEnd(6)} | $${factorial.toFixed(2).padStart(16)} | $${all.toFixed(2).padStart(15)} | $${bothAll.toFixed(2).padStart(16)} |`);
  }

  console.log('\nSampled estimates (--sample flag):');
  for (const sampleSize of [50, 100, 200]) {
    console.log(`  --sample ${sampleSize}:`);
    for (const [model, pricing] of Object.entries(PRICING)) {
      const perCall = (inputTokens * pricing.input / 1e6) + (outputTokens * pricing.output / 1e6);
      const cost = perCall * sampleSize;
      const bothCost = cost * 2;
      console.log(`    ${model}: $${cost.toFixed(2)} (one mode), $${bothCost.toFixed(2)} (both modes)`);
    }
  }

  console.log('\n  claude-code model uses Claude Code CLI (your subscription) — $0 API cost.');
  console.log('  Runs sequentially (~10-20s per call). Estimated time:');
  console.log(`    --sample 50:  ~${Math.ceil(50 * 15 / 60)} min (one mode), ~${Math.ceil(100 * 15 / 60)} min (both)`);
  console.log(`    Full dataset:  ~${Math.ceil(factorialCount * 15 / 3600)} hrs (one mode), ~${Math.ceil(factorialCount * 2 * 15 / 3600)} hrs (both)`);

  console.log('\nRecommended approach:');
  console.log('  1. Start with --sample 50 --model claude-code --mode both (free, ~25 min)');
  console.log('  2. Review results, adjust prompts if needed');
  console.log('  3. Full run with --model haiku --mode both (~$18, ~20 min with concurrency)');
  console.log('  4. Compare claude-code vs haiku for calibration');
  console.log('  5. Optionally --sample 100 --model sonnet for cross-model validation (~$2.40)');
}

// ── Checkpoint / Resume ─────────────────────────────────────────────────

function checkpointPath(exportsDir, modelKey, mode) {
  return path.join(exportsDir, `.checkpoint-${modelKey}-${mode}.jsonl`);
}

function loadCheckpoint(filepath) {
  if (!fs.existsSync(filepath)) return [];
  const lines = fs.readFileSync(filepath, 'utf-8').split('\n').filter(Boolean);
  const results = [];
  for (const line of lines) {
    try { results.push(JSON.parse(line)); }
    catch { /* skip corrupt lines */ }
  }
  return results;
}

function appendCheckpoint(filepath, result) {
  fs.appendFileSync(filepath, JSON.stringify(result) + '\n');
}

function formatEta(elapsedMs, completed, total) {
  if (completed === 0) return '??';
  const msPerItem = elapsedMs / completed;
  const remaining = (total - completed) * msPerItem;
  if (remaining < 60000) return `${Math.ceil(remaining / 1000)}s`;
  if (remaining < 3600000) return `${Math.ceil(remaining / 60000)}m`;
  const hrs = Math.floor(remaining / 3600000);
  const mins = Math.ceil((remaining % 3600000) / 60000);
  return `${hrs}h${mins}m`;
}

// ── Interactive Pause ────────────────────────────────────────────────────

async function askContinue(message) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(message, answer => {
      rl.close();
      const a = answer.trim().toLowerCase();
      resolve(a === '' || a === 'y' || a === 'yes');
    });
  });
}

function printInterimSummary(mode, results, startTime, totalTodo) {
  const elapsed = Date.now() - startTime;
  const n = results.length;
  const base = results.filter(r => r.condition === 'base').length;
  const recog = results.filter(r => r.condition === 'recognition').length;
  const eta = formatEta(elapsed, n, totalTodo);

  console.log('\n  ┌─ Interim Summary ──────────────────────────────────');
  console.log(`  │ ${n} processed (base=${base}, recog=${recog}), ETA for rest: ${eta}`);

  if (mode === 'classify' || mode === 'both') {
    // Quick category presence counts
    const cats = {};
    for (const r of results) {
      for (const [cat, val] of Object.entries(r.ai_categories || {})) {
        if (!cats[cat]) cats[cat] = { base: [0,0], recognition: [0,0] };
        if (val?.present) cats[cat][r.condition][0]++;
        cats[cat][r.condition][1]++;
      }
    }
    for (const [cat, counts] of Object.entries(cats)) {
      const bPct = counts.base[1] ? (counts.base[0]/counts.base[1]*100).toFixed(0) : '-';
      const rPct = counts.recognition[1] ? (counts.recognition[0]/counts.recognition[1]*100).toFixed(0) : '-';
      console.log(`  │   ${cat.padEnd(22)} base=${bPct}%  recog=${rPct}%`);
    }
  }

  if (mode === 'discover' || mode === 'both') {
    // Quick stance tally
    const stances = { base: {}, recognition: {} };
    for (const r of results) {
      const s = r.pedagogical_stance?.toLowerCase() || 'unknown';
      stances[r.condition][s] = (stances[r.condition][s] || 0) + 1;
    }
    for (const cond of ['base', 'recognition']) {
      const sorted = Object.entries(stances[cond]).sort((a,b) => b[1]-a[1]).slice(0,4);
      if (sorted.length) {
        console.log(`  │   ${cond} stances: ${sorted.map(([s,n]) => `${s}(${n})`).join(', ')}`);
      }
    }
  }

  console.log('  └────────────────────────────────────────────────────');
}

/**
 * Write a live report file that can be monitored from another terminal.
 * Rewrites after every response. Reads the other mode's checkpoint to show
 * cumulative results from both modes.
 */
function writeLiveReport(exportsDir, modelKey, classifyResults, discoveryResults) {
  // If one mode is null, try loading its checkpoint so we show both
  if (!classifyResults) {
    const cp = checkpointPath(exportsDir, modelKey, 'classify');
    const loaded = loadCheckpoint(cp);
    if (loaded.length > 0) classifyResults = loaded;
  }
  if (!discoveryResults) {
    const cp = checkpointPath(exportsDir, modelKey, 'discover');
    const loaded = loadCheckpoint(cp);
    if (loaded.length > 0) discoveryResults = loaded;
  }

  const livePath = path.join(exportsDir, '.live-report.md');
  const now = new Date().toISOString();
  let md = `# Live AI Thematic Analysis — ${modelKey}\n\n`;
  md += `**Updated:** ${now}\n\n`;

  if (classifyResults && classifyResults.length > 0) {
    const base = classifyResults.filter(r => r.condition === 'base');
    const recog = classifyResults.filter(r => r.condition === 'recognition');
    md += `## Classification (N=${classifyResults.length}: base=${base.length}, recog=${recog.length})\n\n`;
    md += `| Category | Base % | Recog % | Diff |\n|----------|--------|---------|------|\n`;

    const catNames = Object.keys(THEMATIC_CATEGORIES);
    for (const cat of catNames) {
      const bPresent = base.filter(r => r.ai_categories?.[cat]?.present).length;
      const rPresent = recog.filter(r => r.ai_categories?.[cat]?.present).length;
      const bPct = base.length ? (bPresent/base.length*100).toFixed(1) : '0.0';
      const rPct = recog.length ? (rPresent/recog.length*100).toFixed(1) : '0.0';
      const diff = (parseFloat(rPct) - parseFloat(bPct)).toFixed(1);
      md += `| ${THEMATIC_CATEGORIES[cat].label} | ${bPct}% | ${rPct}% | ${diff > 0 ? '+' : ''}${diff}% |\n`;
    }
    md += '\n';
  }

  if (discoveryResults && discoveryResults.length > 0) {
    const base = discoveryResults.filter(r => r.condition === 'base');
    const recog = discoveryResults.filter(r => r.condition === 'recognition');
    md += `## Discovery (N=${discoveryResults.length}: base=${base.length}, recog=${recog.length})\n\n`;

    // Stances
    md += `### Pedagogical Stances\n\n| Stance | Base | Recog |\n|--------|------|-------|\n`;
    const allStances = {};
    for (const r of discoveryResults) {
      const s = r.pedagogical_stance?.toLowerCase() || 'unknown';
      if (!allStances[s]) allStances[s] = { base: 0, recognition: 0 };
      allStances[s][r.condition]++;
    }
    for (const [s, c] of Object.entries(allStances).sort((a,b) => (b[1].base+b[1].recognition)-(a[1].base+a[1].recognition))) {
      md += `| ${s} | ${c.base} | ${c.recognition} |\n`;
    }

    // Top themes
    md += `\n### Top Emergent Themes\n\n| Theme | Base | Recog | Diff |\n|-------|------|-------|------|\n`;
    const themes = {};
    for (const r of discoveryResults) {
      for (const t of (r.themes || [])) {
        const name = t.name?.toLowerCase()?.replace(/[^a-z0-9_]/g, '_') || 'unknown';
        if (!themes[name]) themes[name] = { label: t.label, base: 0, recognition: 0 };
        themes[name][r.condition]++;
      }
    }
    const sorted = Object.entries(themes).sort((a,b) => (b[1].base+b[1].recognition)-(a[1].base+a[1].recognition));
    for (const [, t] of sorted.slice(0, 20)) {
      const diff = t.recognition - t.base;
      md += `| ${t.label || ''} | ${t.base} | ${t.recognition} | ${diff > 0 ? '+' : ''}${diff} |\n`;
    }
    md += '\n';
  }

  fs.writeFileSync(livePath, md);
  return livePath;
}

// ── Main Analysis ───────────────────────────────────────────────────────

async function runClassification(data, modelKey, concurrency, checkpointFile, { pauseEvery, exportsDir, sampleSize } = {}) {
  const existing = loadCheckpoint(checkpointFile);
  const doneIds = new Set(existing.map(r => r.id));
  let todo = data.filter(d => !doneIds.has(d.id));
  // For --sample: limit total results (existing + new) to sampleSize
  if (sampleSize && existing.length + todo.length > sampleSize) {
    const remaining = Math.max(0, sampleSize - existing.length);
    todo = todo.sort(() => Math.random() - 0.5).slice(0, remaining);
  }

  console.log(`\nRunning CLASSIFICATION (Option 1) with ${modelKey}...`);
  if (existing.length > 0) {
    console.log(`  Resuming: ${existing.length} already done, ${todo.length} remaining`);
  } else {
    console.log(`  ${data.length} responses to process`);
  }
  if (pauseEvery) {
    console.log(`  Will pause every ${pauseEvery} responses for review`);
  }

  const results = [...existing];
  let newCompleted = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < todo.length; i += concurrency) {
    const batch = todo.slice(i, i + concurrency);
    const promises = batch.map(async (item) => {
      const prompt = buildClassifyPrompt(item.messageText, item.condition);
      try {
        const { content, usage } = await callModel(prompt, modelKey);
        const parsed = parseJsonResponse(content);
        totalInput += usage.prompt_tokens || 0;
        totalOutput += usage.completion_tokens || 0;

        const regexResults = regexClassify(item.messageText);

        return {
          id: item.id,
          scenario_id: item.scenario_id,
          profile_name: item.profile_name,
          condition: item.condition,
          overall_score: item.overall_score,
          ai_categories: parsed.categories || {},
          dominant_theme: parsed.dominant_theme,
          quality_note: parsed.overall_quality_note,
          regex_categories: regexResults,
        };
      } catch (err) {
        errors++;
        console.error(`  Error on ${item.id}: ${err.message}`);
        return null;
      }
    });

    const batchResults = await Promise.all(promises);
    for (const r of batchResults) {
      if (r) {
        results.push(r);
        appendCheckpoint(checkpointFile, r);
      }
    }
    newCompleted += batch.length;
    const totalDone = existing.length + newCompleted;
    const totalAll = existing.length + todo.length;
    const eta = formatEta(Date.now() - startTime, newCompleted, todo.length);

    // Update live report after every response
    if (exportsDir) writeLiveReport(exportsDir, modelKey, results, null);

    // Log every response for sequential models, every 10 for parallel
    const logInterval = concurrency <= 1 ? 1 : 10;
    if (newCompleted % logInterval === 0 || newCompleted === todo.length) {
      console.log(`  [${totalDone}/${totalAll}] ${errors} errors, ETA ${eta}`);
    }

    // Pause point
    if (pauseEvery && newCompleted > 0 && newCompleted % pauseEvery === 0 && newCompleted < todo.length) {
      printInterimSummary('classify', results, startTime, todo.length);
      const cont = await askContinue(`\n  Continue? [Y/n] `);
      if (!cont) {
        console.log('  Stopped by user. Progress saved to checkpoint.');
        return results;
      }
    }
  }

  console.log(`  Done. ${results.length} total (${newCompleted - errors} new), ${errors} errors.`);
  if (totalInput > 0) {
    console.log(`  Tokens: ${totalInput.toLocaleString()} input, ${totalOutput.toLocaleString()} output`);
  }

  return results;
}

async function runDiscovery(data, modelKey, concurrency, checkpointFile, { pauseEvery, exportsDir, sampleSize } = {}) {
  const existing = loadCheckpoint(checkpointFile);
  const doneIds = new Set(existing.map(r => r.id));
  let todo = data.filter(d => !doneIds.has(d.id));
  if (sampleSize && existing.length + todo.length > sampleSize) {
    const remaining = Math.max(0, sampleSize - existing.length);
    todo = todo.sort(() => Math.random() - 0.5).slice(0, remaining);
  }

  console.log(`\nRunning DISCOVERY (Option 2) with ${modelKey}...`);
  if (existing.length > 0) {
    console.log(`  Resuming: ${existing.length} already done, ${todo.length} remaining`);
  } else {
    console.log(`  ${data.length} responses to process`);
  }
  if (pauseEvery) {
    console.log(`  Will pause every ${pauseEvery} responses for review`);
  }

  const results = [...existing];
  let newCompleted = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < todo.length; i += concurrency) {
    const batch = todo.slice(i, i + concurrency);
    const promises = batch.map(async (item) => {
      const prompt = buildDiscoverPrompt(item.messageText, item.condition);
      try {
        const { content, usage } = await callModel(prompt, modelKey);
        const parsed = parseJsonResponse(content);
        totalInput += usage.prompt_tokens || 0;
        totalOutput += usage.completion_tokens || 0;

        return {
          id: item.id,
          scenario_id: item.scenario_id,
          profile_name: item.profile_name,
          condition: item.condition,
          overall_score: item.overall_score,
          themes: parsed.themes || [],
          pedagogical_stance: parsed.pedagogical_stance,
          epistemic_orientation: parsed.epistemic_orientation,
          overall_impression: parsed.overall_impression,
        };
      } catch (err) {
        errors++;
        console.error(`  Error on ${item.id}: ${err.message}`);
        return null;
      }
    });

    const batchResults = await Promise.all(promises);
    for (const r of batchResults) {
      if (r) {
        results.push(r);
        appendCheckpoint(checkpointFile, r);
      }
    }
    newCompleted += batch.length;
    const totalDone = existing.length + newCompleted;
    const totalAll = existing.length + todo.length;
    const eta = formatEta(Date.now() - startTime, newCompleted, todo.length);

    // Update live report after every response
    if (exportsDir) writeLiveReport(exportsDir, modelKey, null, results);

    const logInterval = concurrency <= 1 ? 1 : 10;
    if (newCompleted % logInterval === 0 || newCompleted === todo.length) {
      console.log(`  [${totalDone}/${totalAll}] ${errors} errors, ETA ${eta}`);
    }

    // Pause point
    if (pauseEvery && newCompleted > 0 && newCompleted % pauseEvery === 0 && newCompleted < todo.length) {
      printInterimSummary('discover', results, startTime, todo.length);
      const cont = await askContinue(`\n  Continue? [Y/n] `);
      if (!cont) {
        console.log('  Stopped by user. Progress saved to checkpoint.');
        return results;
      }
    }
  }

  console.log(`  Done. ${results.length} total (${newCompleted - errors} new), ${errors} errors.`);
  if (totalInput > 0) {
    console.log(`  Tokens: ${totalInput.toLocaleString()} input, ${totalOutput.toLocaleString()} output`);
  }

  return results;
}

// ── Agreement Analysis ──────────────────────────────────────────────────

function analyzeClassificationResults(results) {
  const analysis = {
    n: results.length,
    byCondition: { base: { n: 0 }, recognition: { n: 0 } },
    categoryStats: {},
    interMethodAgreement: {},
  };

  // Category-level stats
  for (const cat of Object.keys(THEMATIC_CATEGORIES)) {
    analysis.categoryStats[cat] = {
      base: { present: 0, absent: 0, strengths: {} },
      recognition: { present: 0, absent: 0, strengths: {} },
    };
    analysis.interMethodAgreement[cat] = {
      bothPresent: 0, bothAbsent: 0,
      aiOnlyPresent: 0, regexOnlyPresent: 0,
    };
  }

  for (const r of results) {
    const cond = r.condition;
    analysis.byCondition[cond].n++;

    for (const cat of Object.keys(THEMATIC_CATEGORIES)) {
      const aiPresent = r.ai_categories?.[cat]?.present === true;
      const regexPresent = r.regex_categories?.[cat] === true;
      const strength = r.ai_categories?.[cat]?.strength || 'none';

      if (aiPresent) analysis.categoryStats[cat][cond].present++;
      else analysis.categoryStats[cat][cond].absent++;

      analysis.categoryStats[cat][cond].strengths[strength] =
        (analysis.categoryStats[cat][cond].strengths[strength] || 0) + 1;

      // Inter-method agreement
      if (aiPresent && regexPresent) analysis.interMethodAgreement[cat].bothPresent++;
      else if (!aiPresent && !regexPresent) analysis.interMethodAgreement[cat].bothAbsent++;
      else if (aiPresent && !regexPresent) analysis.interMethodAgreement[cat].aiOnlyPresent++;
      else analysis.interMethodAgreement[cat].regexOnlyPresent++;
    }
  }

  // Compute agreement rates
  for (const cat of Object.keys(THEMATIC_CATEGORIES)) {
    const a = analysis.interMethodAgreement[cat];
    const total = a.bothPresent + a.bothAbsent + a.aiOnlyPresent + a.regexOnlyPresent;
    a.percentAgreement = total > 0 ? ((a.bothPresent + a.bothAbsent) / total * 100).toFixed(1) : 'N/A';

    // Cohen's kappa
    if (total > 0) {
      const p_o = (a.bothPresent + a.bothAbsent) / total;
      const p_ai = (a.bothPresent + a.aiOnlyPresent) / total;
      const p_regex = (a.bothPresent + a.regexOnlyPresent) / total;
      const p_e = p_ai * p_regex + (1 - p_ai) * (1 - p_regex);
      a.kappa = p_e < 1 ? ((p_o - p_e) / (1 - p_e)).toFixed(3) : '1.000';
    } else {
      a.kappa = 'N/A';
    }
  }

  return analysis;
}

function analyzeDiscoveryResults(results) {
  const analysis = {
    n: results.length,
    byCondition: { base: { n: 0 }, recognition: { n: 0 } },
    themeFrequency: {},
    stanceDistribution: { base: {}, recognition: {} },
    epistemicDistribution: { base: {}, recognition: {} },
  };

  for (const r of results) {
    const cond = r.condition;
    analysis.byCondition[cond].n++;

    // Collect theme names
    for (const theme of (r.themes || [])) {
      const name = theme.name?.toLowerCase()?.replace(/[^a-z0-9_]/g, '_') || 'unknown';
      if (!analysis.themeFrequency[name]) {
        analysis.themeFrequency[name] = {
          label: theme.label,
          description: theme.description,
          base: 0, recognition: 0,
        };
      }
      analysis.themeFrequency[name][cond]++;
    }

    // Stances
    const stance = r.pedagogical_stance?.toLowerCase() || 'unknown';
    analysis.stanceDistribution[cond][stance] =
      (analysis.stanceDistribution[cond][stance] || 0) + 1;

    // Epistemic
    const epistemic = r.epistemic_orientation?.toLowerCase() || 'unknown';
    analysis.epistemicDistribution[cond][epistemic] =
      (analysis.epistemicDistribution[cond][epistemic] || 0) + 1;
  }

  return analysis;
}

// ── Output Generation ───────────────────────────────────────────────────

function generateMarkdown(classifyAnalysis, discoveryAnalysis, modelKey, sampleSize) {
  let md = `# AI Thematic Analysis Results

**Generated:** ${new Date().toISOString()}
**Model:** ${modelKey} (${MODEL_MAP[modelKey]})
**Sample:** ${sampleSize || 'full dataset'}

`;

  if (classifyAnalysis) {
    md += `## Option 1: Structured Classification (N=${classifyAnalysis.n})

Base: N=${classifyAnalysis.byCondition.base.n}, Recognition: N=${classifyAnalysis.byCondition.recognition.n}

### Category Presence by Condition

| Category | Base Present | Base % | Recog Present | Recog % | Difference |
|----------|-------------|--------|---------------|---------|------------|
`;
    for (const [cat, stats] of Object.entries(classifyAnalysis.categoryStats)) {
      const baseN = stats.base.present + stats.base.absent;
      const recogN = stats.recognition.present + stats.recognition.absent;
      const basePct = baseN > 0 ? (stats.base.present / baseN * 100).toFixed(1) : '0.0';
      const recogPct = recogN > 0 ? (stats.recognition.present / recogN * 100).toFixed(1) : '0.0';
      const diff = (parseFloat(recogPct) - parseFloat(basePct)).toFixed(1);
      md += `| ${THEMATIC_CATEGORIES[cat].label} | ${stats.base.present}/${baseN} | ${basePct}% | ${stats.recognition.present}/${recogN} | ${recogPct}% | ${diff > 0 ? '+' : ''}${diff}% |\n`;
    }

    md += `\n### Inter-Method Agreement (AI vs Regex)

| Category | Both Present | Both Absent | AI Only | Regex Only | Agreement % | Cohen's κ |
|----------|-------------|-------------|---------|-----------|------------|----------|
`;
    for (const [cat, a] of Object.entries(classifyAnalysis.interMethodAgreement)) {
      md += `| ${THEMATIC_CATEGORIES[cat].label} | ${a.bothPresent} | ${a.bothAbsent} | ${a.aiOnlyPresent} | ${a.regexOnlyPresent} | ${a.percentAgreement}% | ${a.kappa} |\n`;
    }

    md += `\n### Strength Distribution by Condition

`;
    for (const [cat, stats] of Object.entries(classifyAnalysis.categoryStats)) {
      md += `**${THEMATIC_CATEGORIES[cat].label}:**\n`;
      md += `- Base: ${JSON.stringify(stats.base.strengths)}\n`;
      md += `- Recognition: ${JSON.stringify(stats.recognition.strengths)}\n\n`;
    }
  }

  if (discoveryAnalysis) {
    md += `## Option 2: Open-Ended Theme Discovery (N=${discoveryAnalysis.n})

Base: N=${discoveryAnalysis.byCondition.base.n}, Recognition: N=${discoveryAnalysis.byCondition.recognition.n}

### Emergent Theme Frequency

| Theme | Label | Base | Recog | Total | Difference |
|-------|-------|------|-------|-------|------------|
`;
    const sortedThemes = Object.entries(discoveryAnalysis.themeFrequency)
      .sort((a, b) => (b[1].base + b[1].recognition) - (a[1].base + a[1].recognition));

    for (const [name, freq] of sortedThemes.slice(0, 30)) {
      const total = freq.base + freq.recognition;
      const diff = freq.recognition - freq.base;
      md += `| ${name} | ${freq.label || ''} | ${freq.base} | ${freq.recognition} | ${total} | ${diff > 0 ? '+' : ''}${diff} |\n`;
    }

    md += `\n### Pedagogical Stance Distribution

| Stance | Base | Recognition |
|--------|------|-------------|
`;
    const allStances = new Set([
      ...Object.keys(discoveryAnalysis.stanceDistribution.base),
      ...Object.keys(discoveryAnalysis.stanceDistribution.recognition),
    ]);
    for (const stance of [...allStances].sort()) {
      md += `| ${stance} | ${discoveryAnalysis.stanceDistribution.base[stance] || 0} | ${discoveryAnalysis.stanceDistribution.recognition[stance] || 0} |\n`;
    }

    md += `\n### Epistemic Orientation Distribution

| Orientation | Base | Recognition |
|-------------|------|-------------|
`;
    const allEpistemic = new Set([
      ...Object.keys(discoveryAnalysis.epistemicDistribution.base),
      ...Object.keys(discoveryAnalysis.epistemicDistribution.recognition),
    ]);
    for (const ep of [...allEpistemic].sort()) {
      md += `| ${ep} | ${discoveryAnalysis.epistemicDistribution.base[ep] || 0} | ${discoveryAnalysis.epistemicDistribution.recognition[ep] || 0} |\n`;
    }
  }

  return md;
}

// ── CLI ─────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    mode: 'both',           // classify, discover, both
    model: 'claude-code',   // claude-code, haiku, sonnet, opus
    sample: null,           // null = all, number = sample size
    cells: [1,2,3,4,5,6,7,8],
    concurrency: 5,
    pauseEvery: null,       // pause after N responses for review
    costEstimate: false,
    clean: false,           // delete checkpoint files before starting
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--mode': opts.mode = args[++i]; break;
      case '--model': opts.model = args[++i]; break;
      case '--sample': opts.sample = parseInt(args[++i]); break;
      case '--cells': opts.cells = args[++i].split(',').map(Number); break;
      case '--concurrency': opts.concurrency = parseInt(args[++i]); break;
      case '--pause-every': opts.pauseEvery = parseInt(args[++i]); break;
      case '--cost-estimate': opts.costEstimate = true; break;
      case '--clean': opts.clean = true; break;
      case '--help':
        console.log(`Usage: node scripts/qualitative-analysis-ai.js [options]

Options:
  --mode <classify|discover|both>  Analysis mode (default: both)
  --model <model>                  Model to use (default: claude-code)
                                     claude-code — Claude Code CLI (subscription, free)
                                     haiku       — OpenRouter Haiku (~$0.003/call)
                                     sonnet      — OpenRouter Sonnet (~$0.008/call)
                                     opus        — OpenRouter Opus (~$0.04/call)
  --sample <N>                     Random sample size (default: all)
  --cells <1,2,...>                Cell numbers to include (default: 1-8)
  --concurrency <N>                Parallel calls (default: 5; forced to 1 for claude-code)
  --pause-every <N>                Pause after every N responses to review interim results
  --clean                          Delete checkpoint files and start fresh
  --cost-estimate                  Print cost estimate and exit
  --help                           Show this help

Resume & monitoring:
  Runs are checkpointed to exports/.checkpoint-<model>-<mode>.jsonl
  Re-running the same command resumes from where it left off.
  Use --clean to discard checkpoints and start over.

  During a run, monitor live results from another terminal:
    while true; do clear; cat exports/.live-report.md 2>/dev/null || echo "Waiting..."; sleep 5; done
  Or check raw checkpoint progress:
    wc -l exports/.checkpoint-claude-code-classify.jsonl`);
        process.exit(0);
    }
  }

  // Claude Code CLI must run sequentially (one subprocess at a time)
  if (opts.model === 'claude-code') {
    opts.concurrency = 1;
  }

  return opts;
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  const dbPath = path.join(process.cwd(), 'data', 'evaluations.db');
  if (!fs.existsSync(dbPath)) {
    console.error('Database not found:', dbPath);
    process.exit(1);
  }

  const db = new Database(dbPath);

  if (opts.costEstimate) {
    printCostEstimate(db);
    db.close();
    return;
  }

  console.log('='.repeat(70));
  console.log('AI THEMATIC ANALYSIS OF EVALUATION TRANSCRIPTS');
  console.log('='.repeat(70));
  console.log(`Mode: ${opts.mode} | Model: ${opts.model} | Sample: ${opts.sample || 'all'}`);
  console.log(`Cells: ${opts.cells.join(', ')}`);
  if (opts.pauseEvery) {
    console.log(`Pause every: ${opts.pauseEvery} responses`);
  }
  console.log(`\nMonitor live results from another terminal:`);
  console.log(`  while true; do clear; cat exports/.live-report.md 2>/dev/null || echo "Waiting for first result..."; sleep 5; done`);

  // Load data
  const data = loadData(db, opts.cells, opts.sample);
  console.log(`\nLoaded ${data.length} responses`);
  const baseCount = data.filter(d => d.condition === 'base').length;
  const recogCount = data.filter(d => d.condition === 'recognition').length;
  console.log(`  Base: ${baseCount}, Recognition: ${recogCount}`);

  if (data.length === 0) {
    console.error('No data found. Check cell numbers and database.');
    db.close();
    return;
  }

  // Ensure exports directory
  const exportsDir = path.join(process.cwd(), 'exports');
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  // Checkpoint files
  const classifyCheckpoint = checkpointPath(exportsDir, opts.model, 'classify');
  const discoverCheckpoint = checkpointPath(exportsDir, opts.model, 'discover');

  if (opts.clean) {
    for (const cp of [classifyCheckpoint, discoverCheckpoint]) {
      if (fs.existsSync(cp)) {
        fs.unlinkSync(cp);
        console.log(`  Deleted checkpoint: ${path.basename(cp)}`);
      }
    }
  }

  let classifyResults = null;
  let classifyAnalysis = null;
  let discoveryResults = null;
  let discoveryAnalysis = null;

  const runOpts = { pauseEvery: opts.pauseEvery, exportsDir, sampleSize: opts.sample };

  // Run classification
  if (opts.mode === 'classify' || opts.mode === 'both') {
    classifyResults = await runClassification(data, opts.model, opts.concurrency, classifyCheckpoint, runOpts);
    classifyAnalysis = analyzeClassificationResults(classifyResults);
    writeLiveReport(exportsDir, opts.model, classifyResults, null);
  }

  // Run discovery
  if (opts.mode === 'discover' || opts.mode === 'both') {
    discoveryResults = await runDiscovery(data, opts.model, opts.concurrency, discoverCheckpoint, runOpts);
    discoveryAnalysis = analyzeDiscoveryResults(discoveryResults);
    writeLiveReport(exportsDir, opts.model, classifyResults, discoveryResults);
  }

  // Clean up checkpoint and live report files on successful completion
  for (const cp of [classifyCheckpoint, discoverCheckpoint, path.join(exportsDir, '.live-report.md')]) {
    if (fs.existsSync(cp)) {
      fs.unlinkSync(cp);
    }
  }

  // Save raw results
  const timestamp = new Date().toISOString().slice(0, 10);
  const suffix = opts.sample ? `-sample${opts.sample}` : '';

  const jsonOutput = {
    generated: new Date().toISOString(),
    model: opts.model,
    modelId: MODEL_MAP[opts.model],
    sample: opts.sample,
    cells: opts.cells,
    classification: classifyResults ? {
      results: classifyResults,
      analysis: classifyAnalysis,
    } : null,
    discovery: discoveryResults ? {
      results: discoveryResults,
      analysis: discoveryAnalysis,
    } : null,
  };

  const jsonPath = path.join(exportsDir, `qualitative-ai-${opts.model}${suffix}-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2));
  console.log(`\nJSON: ${jsonPath}`);

  // Generate markdown report
  const md = generateMarkdown(classifyAnalysis, discoveryAnalysis, opts.model, opts.sample);
  const mdPath = path.join(exportsDir, `qualitative-ai-${opts.model}${suffix}-${timestamp}.md`);
  fs.writeFileSync(mdPath, md);
  console.log(`Markdown: ${mdPath}`);

  // Print summary to console
  if (classifyAnalysis) {
    console.log('\n' + '─'.repeat(70));
    console.log('CLASSIFICATION SUMMARY');
    console.log('─'.repeat(70));
    for (const [cat, stats] of Object.entries(classifyAnalysis.categoryStats)) {
      const baseN = stats.base.present + stats.base.absent;
      const recogN = stats.recognition.present + stats.recognition.absent;
      const basePct = baseN > 0 ? (stats.base.present / baseN * 100).toFixed(1) : '0.0';
      const recogPct = recogN > 0 ? (stats.recognition.present / recogN * 100).toFixed(1) : '0.0';
      const agree = classifyAnalysis.interMethodAgreement[cat];
      console.log(`  ${THEMATIC_CATEGORIES[cat].label.padEnd(28)} base=${basePct}% recog=${recogPct}% | AI-regex κ=${agree.kappa}`);
    }
  }

  if (discoveryAnalysis) {
    console.log('\n' + '─'.repeat(70));
    console.log('DISCOVERY SUMMARY');
    console.log('─'.repeat(70));
    const sorted = Object.entries(discoveryAnalysis.themeFrequency)
      .sort((a, b) => (b[1].base + b[1].recognition) - (a[1].base + a[1].recognition));
    console.log('  Top 15 emergent themes:');
    for (const [name, freq] of sorted.slice(0, 15)) {
      const total = freq.base + freq.recognition;
      const diff = freq.recognition - freq.base;
      console.log(`    ${(freq.label || name).padEnd(35)} total=${total} (base=${freq.base}, recog=${freq.recognition}, diff=${diff > 0 ? '+' : ''}${diff})`);
    }

    console.log('\n  Pedagogical stances:');
    for (const cond of ['base', 'recognition']) {
      const sorted = Object.entries(discoveryAnalysis.stanceDistribution[cond])
        .sort((a, b) => b[1] - a[1]);
      console.log(`    ${cond}: ${sorted.map(([s, n]) => `${s}(${n})`).join(', ')}`);
    }
  }

  db.close();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
