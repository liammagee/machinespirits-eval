#!/usr/bin/env node

/**
 * Qualitative Transcript Assessment
 *
 * Sends multi-turn dialogue transcripts to Claude for rich narrative assessment.
 * Complements numeric rubric scores with interpretive analysis of pedagogical
 * dynamics, recognition moments, superego effectiveness, and learner trajectory.
 *
 * Usage:
 *   node scripts/assess-transcripts.js <runId> [options]
 *
 * Options:
 *   --scenario <id>       Filter by scenario ID
 *   --condition <cond>    Filter: recog | base
 *   --profile <name>      Filter by profile name (substring match)
 *   --limit <n>           Max dialogues to assess
 *   --model <m>           claude-code (default) | haiku | sonnet | gpt
 *   --parallelism <n>     Concurrent assessments (default: 2)
 *   --output <path>       Output file path (default: exports/transcript-assessment-<runId>.md)
 *   --resume              Skip already-assessed dialogues (checks DB)
 *   --force               Re-assess even if already assessed in DB
 *   --help                Show this help
 *
 * Assessments are stored in the DB on evaluation_results (qualitative_assessment,
 * qualitative_model columns). A JSONL backup is also written to exports/.
 */

import 'dotenv/config';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { formatTranscript } from '../services/transcriptFormatter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.resolve(__dirname, '..', 'logs', 'tutor-dialogues');
const DB_PATH = path.resolve(__dirname, '..', 'data', 'evaluations.db');

// ── Assessment Tags ──────────────────────────────────────────────────────

const VALID_TAGS = [
  'recognition_moment', 'superego_overcorrection', 'learner_breakthrough',
  'strategy_shift', 'missed_scaffold', 'ego_compliance', 'ego_autonomy',
  'productive_impasse', 'emotional_attunement', 'stalling', 'regression',
];

// ── Model Calls ──────────────────────────────────────────────────────────

const MODEL_MAP = {
  'claude-code': 'claude-code',
  haiku: 'anthropic/claude-haiku-4.5',
  sonnet: 'anthropic/claude-sonnet-4.5',
  gpt: 'openai/gpt-5.2',
};

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
  return stdout.trim();
}

async function callOpenRouter(prompt, modelKey) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');
  const model = MODEL_MAP[modelKey];
  if (!model) throw new Error(`Unknown model: ${modelKey}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 3000,
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
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1].trim());
    // Try extracting first { ... } block
    const first = content.indexOf('{');
    const last = content.lastIndexOf('}');
    if (first !== -1 && last > first) {
      return JSON.parse(content.slice(first, last + 1));
    }
    throw new Error(`Failed to parse JSON: ${content.slice(0, 300)}`);
  }
}

// ── DB Schema ────────────────────────────────────────────────────────────

function ensureColumns(db) {
  const cols = db.prepare("PRAGMA table_info(evaluation_results)").all().map(c => c.name);
  if (!cols.includes('qualitative_assessment')) {
    db.exec("ALTER TABLE evaluation_results ADD COLUMN qualitative_assessment TEXT");
  }
  if (!cols.includes('qualitative_model')) {
    db.exec("ALTER TABLE evaluation_results ADD COLUMN qualitative_model TEXT");
  }
  if (!cols.includes('blinded_qualitative_assessment')) {
    db.exec("ALTER TABLE evaluation_results ADD COLUMN blinded_qualitative_assessment TEXT");
  }
  if (!cols.includes('blinded_qualitative_model')) {
    db.exec("ALTER TABLE evaluation_results ADD COLUMN blinded_qualitative_model TEXT");
  }
}

// ── Data Loading ─────────────────────────────────────────────────────────

function loadMultiTurnResults(db, runId, filters = {}) {
  let sql = `
    SELECT id, scenario_id, scenario_name, profile_name, overall_score,
           dialogue_id, dialogue_rounds, factor_recognition,
           factor_multi_agent_tutor, learner_architecture,
           judge_model, ego_model, superego_model,
           qualitative_assessment, qualitative_model,
           blinded_qualitative_assessment, blinded_qualitative_model
    FROM evaluation_results
    WHERE run_id = ? AND success = 1 AND dialogue_id IS NOT NULL
  `;
  const params = [runId];

  if (filters.scenario) {
    sql += ` AND scenario_id LIKE ?`;
    params.push(`%${filters.scenario}%`);
  }
  if (filters.condition === 'recog' || filters.condition === 'recognition') {
    sql += ` AND (profile_name LIKE '%recog%' OR factor_recognition = 1)`;
  } else if (filters.condition === 'base') {
    sql += ` AND profile_name NOT LIKE '%recog%' AND (factor_recognition = 0 OR factor_recognition IS NULL)`;
  }
  if (filters.profile) {
    sql += ` AND profile_name LIKE ?`;
    params.push(`%${filters.profile}%`);
  }

  sql += ` ORDER BY scenario_id, profile_name, id`;

  const rows = db.prepare(sql).all(...params);

  if (filters.limit && rows.length > filters.limit) {
    return rows.slice(0, filters.limit);
  }

  return rows;
}

function loadDialogueTrace(dialogueId) {
  if (!dialogueId || !fs.existsSync(LOGS_DIR)) return null;

  const files = fs.readdirSync(LOGS_DIR).filter(f => f.includes(dialogueId));
  if (files.length === 0) return null;

  try {
    const dialogue = JSON.parse(fs.readFileSync(path.join(LOGS_DIR, files[0]), 'utf-8'));
    return {
      trace: dialogue.dialogueTrace || [],
      totalTurns: dialogue.totalTurns || 0,
      profileName: dialogue.profileName,
    };
  } catch {
    return null;
  }
}

// ── Condition / Mechanism Detection ──────────────────────────────────────

function detectCondition(row) {
  if (row.factor_recognition === 1) return 'recognition';
  if (row.profile_name?.includes('recog')) return 'recognition';
  return 'base';
}

function detectMechanism(profileName) {
  if (!profileName) return 'standard';
  const name = profileName.toLowerCase();
  if (name.includes('_combined')) return 'combined';
  if (name.includes('_quantitative')) return 'quantitative_disposition';
  if (name.includes('_erosion')) return 'prompt_erosion';
  if (name.includes('_intersubjective')) return 'intersubjective';
  if (name.includes('_profile_')) return 'other_ego_profiling';
  if (name.includes('_advocate')) return 'advocate';
  if (name.includes('_adversary')) return 'adversary';
  if (name.includes('_suspicious')) return 'dialectical_suspicious';
  if (name.includes('_self_reflect')) return 'self_reflection';
  if (name.includes('dialectical')) return 'dialectical';
  if (name.includes('enhanced')) return 'enhanced';
  if (name.includes('placebo')) return 'placebo';
  return 'standard';
}

// ── Assessment Prompt ────────────────────────────────────────────────────

function buildAssessmentPrompt(row, transcript, { blinded = false } = {}) {
  const condition = detectCondition(row);
  const mechanism = detectMechanism(row.profile_name);

  const metadataLines = [];
  if (!blinded) metadataLines.push(`- Cell: ${row.profile_name}`);
  metadataLines.push(`- Scenario: ${row.scenario_id}`);
  if (!blinded) metadataLines.push(`- Recognition condition: ${condition}`);
  metadataLines.push(`- Mechanism: ${mechanism}`);
  if (!blinded) metadataLines.push(`- Numeric score: ${row.overall_score != null ? row.overall_score.toFixed(1) : 'N/A'}/100`);
  metadataLines.push(`- Turns: ${row.dialogue_rounds || 'unknown'}`);

  return `You are analyzing a multi-turn AI tutoring dialogue. The dialogue uses an
ego-superego architecture where:
- The EGO generates tutoring responses
- The SUPEREGO critiques and may request revisions
- Between turns, both may reflect on their own practice
- Some dialogues include intersubjective responses (ego responding to superego's reflections)

METADATA:
${metadataLines.join('\n')}

TRANSCRIPT:
${transcript}

ASSESSMENT INSTRUCTIONS:
Provide a qualitative assessment across these axes. Write 2-4 sentences per axis.
Focus on specific moments in the dialogue — cite turn numbers (ACT numbers) and quote key phrases.

1. **Pedagogical Strategy Arc** — How does the tutor's approach evolve? What triggers shifts?
2. **Recognition Dynamics** — Where does the tutor treat the learner as autonomous subject vs. object? Moments of genuine mutual recognition?
3. **Superego Effectiveness** — Is the internal critic helpful or counterproductive? Does ego learn from it?
4. **Learner Trajectory** — Engagement evolution: confusion → engagement → understanding, or stalling?
5. **Missed Opportunities** — What could the tutor have done differently?
6. **Key Turning Point** — The single most consequential moment and why

Return a JSON object with this exact structure:
{
  "pedagogical_arc": "...",
  "recognition_dynamics": "...",
  "superego_effectiveness": "...",
  "learner_trajectory": "...",
  "missed_opportunities": "...",
  "key_turning_point": { "turn": <number>, "description": "..." },
  "overall_narrative": "A 3-5 sentence synthesis of the dialogue's quality and significance.",
  "tags": ["tag1", "tag2"]
}

Valid tags (use only from this list, pick 2-5 that apply):
${VALID_TAGS.map(t => `  - ${t}`).join('\n')}

Return ONLY the JSON object, no other text.`;
}

// ── Concurrency Control ──────────────────────────────────────────────────

async function runWithConcurrency(tasks, concurrency) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ── Report Generation ────────────────────────────────────────────────────

function generateReport(runId, assessments, modelKey) {
  const scored = assessments.filter(a => a.assessment);
  const errored = assessments.filter(a => a.error);

  let md = `# Qualitative Transcript Assessment: ${runId}
Generated: ${new Date().toISOString().slice(0, 10)} | Model: ${modelKey} | N=${scored.length} dialogues`;

  if (errored.length > 0) {
    md += ` (${errored.length} errors)`;
  }
  md += '\n\n';

  // ── Summary Table ──
  md += `## Summary\n\n`;
  md += `| # | Scenario | Cell | Cond | Score | Tags |\n`;
  md += `|---|----------|------|------|-------|------|\n`;

  for (let i = 0; i < scored.length; i++) {
    const a = scored[i];
    const shortProfile = a.profile_name?.replace(/^cell_\d+_/, '') || '';
    const tags = (a.assessment.tags || []).join(', ');
    const score = a.overall_score != null ? a.overall_score.toFixed(1) : '--';
    md += `| ${i + 1} | ${a.scenario_id} | ${shortProfile} | ${a.condition} | ${score} | ${tags} |\n`;
  }

  // ── Tag Frequencies ──
  md += `\n### Tag Frequencies\n\n`;
  const tagCounts = {};
  const tagsByCondition = {};
  for (const a of scored) {
    const tags = a.assessment.tags || [];
    for (const tag of tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      if (!tagsByCondition[tag]) tagsByCondition[tag] = { base: 0, recognition: 0 };
      tagsByCondition[tag][a.condition]++;
    }
  }
  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  for (const [tag, count] of sortedTags) {
    const bc = tagsByCondition[tag];
    md += `- **${tag}**: ${count} (base=${bc.base}, recog=${bc.recognition})\n`;
  }

  // ── Cross-Dialogue Themes ──
  md += `\n### Cross-Dialogue Themes\n\n`;

  // Aggregate narratives for a synthesis
  const baseNarratives = scored.filter(a => a.condition === 'base').map(a => a.assessment.overall_narrative).filter(Boolean);
  const recogNarratives = scored.filter(a => a.condition === 'recognition').map(a => a.assessment.overall_narrative).filter(Boolean);

  if (baseNarratives.length > 0) {
    const baseScores = scored.filter(a => a.condition === 'base').map(a => a.overall_score).filter(s => s != null);
    const baseMean = baseScores.length > 0 ? (baseScores.reduce((a, b) => a + b, 0) / baseScores.length).toFixed(1) : '--';
    md += `**Base condition** (N=${baseNarratives.length}, mean score=${baseMean}): `;
    md += `See individual assessments below.\n\n`;
  }
  if (recogNarratives.length > 0) {
    const recogScores = scored.filter(a => a.condition === 'recognition').map(a => a.overall_score).filter(s => s != null);
    const recogMean = recogScores.length > 0 ? (recogScores.reduce((a, b) => a + b, 0) / recogScores.length).toFixed(1) : '--';
    md += `**Recognition condition** (N=${recogNarratives.length}, mean score=${recogMean}): `;
    md += `See individual assessments below.\n\n`;
  }

  // ── Individual Assessments ──
  for (let i = 0; i < scored.length; i++) {
    const a = scored[i];
    md += `---\n\n`;
    md += `## Dialogue ${i + 1}: ${a.profile_name} × ${a.scenario_id}`;
    md += ` (Score: ${a.overall_score != null ? a.overall_score.toFixed(1) : '--'})\n\n`;

    const ax = a.assessment;
    md += `**Pedagogical Arc**: ${ax.pedagogical_arc}\n\n`;
    md += `**Recognition Dynamics**: ${ax.recognition_dynamics}\n\n`;
    md += `**Superego Effectiveness**: ${ax.superego_effectiveness}\n\n`;
    md += `**Learner Trajectory**: ${ax.learner_trajectory}\n\n`;
    md += `**Missed Opportunities**: ${ax.missed_opportunities}\n\n`;

    if (ax.key_turning_point) {
      const tp = ax.key_turning_point;
      md += `**Key Turning Point** (Turn ${tp.turn}): ${tp.description}\n\n`;
    }

    md += `**Overall Narrative**: ${ax.overall_narrative}\n\n`;

    if (ax.tags?.length > 0) {
      md += `**Tags**: ${ax.tags.join(', ')}\n\n`;
    }
  }

  // ── Errors ──
  if (errored.length > 0) {
    md += `---\n\n## Errors\n\n`;
    for (const a of errored) {
      md += `- **${a.profile_name} × ${a.scenario_id}** (id=${a.id}): ${a.error}\n`;
    }
  }

  return md;
}

// ── CLI ──────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    runId: null,
    scenario: null,
    condition: null,
    profile: null,
    limit: null,
    model: 'claude-code',
    parallelism: 2,
    output: null,
    resume: false,
    force: false,
    blinded: false,
    importFile: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--scenario': opts.scenario = args[++i]; break;
      case '--condition': opts.condition = args[++i]; break;
      case '--profile': opts.profile = args[++i]; break;
      case '--limit': opts.limit = parseInt(args[++i], 10); break;
      case '--model': opts.model = args[++i]; break;
      case '--parallelism': opts.parallelism = parseInt(args[++i], 10); break;
      case '--output': opts.output = args[++i]; break;
      case '--resume': opts.resume = true; break;
      case '--force': opts.force = true; break;
      case '--blinded': opts.blinded = true; break;
      case '--import': opts.importFile = args[++i]; break;
      case '--help':
        console.log(`Usage: node scripts/assess-transcripts.js <runId> [options]

Options:
  --scenario <id>       Filter by scenario ID (substring match)
  --condition <cond>    Filter: recog | base
  --profile <name>      Filter by profile name (substring match)
  --limit <n>           Max dialogues to assess
  --model <m>           claude-code (default) | haiku | sonnet | gpt
  --parallelism <n>     Concurrent assessments (default: 2)
  --output <path>       Output file path
  --resume              Skip dialogues already assessed in DB
  --force               Re-assess even if already in DB (overwrites)
  --blinded             Strip condition labels from metadata and transcript header
  --import <jsonl>      Import assessments from a JSONL file into DB
  --help                Show this help

Examples:
  node scripts/assess-transcripts.js eval-2026-02-14-abcd1234 --limit 3
  node scripts/assess-transcripts.js eval-2026-02-14-abcd1234 --scenario epistemic --condition recog
  node scripts/assess-transcripts.js eval-2026-02-14-abcd1234 --model haiku --parallelism 4`);
        process.exit(0);
      default:
        if (!args[i].startsWith('--') && !opts.runId) {
          opts.runId = args[i];
        } else if (!args[i].startsWith('--')) {
          console.error(`Unknown argument: ${args[i]}`);
          process.exit(1);
        }
    }
  }

  if (!opts.runId && !opts.importFile) {
    console.error('Error: run ID is required.\nUsage: node scripts/assess-transcripts.js <runId> [options]');
    process.exit(1);
  }

  return opts;
}

// ── Import from JSONL ────────────────────────────────────────────────────

function importFromFile(db, filePath, modelKey) {
  ensureColumns(db);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const updateStmt = db.prepare(`
    UPDATE evaluation_results
    SET qualitative_assessment = ?, qualitative_model = ?
    WHERE id = ?
  `);

  // Load entries from JSONL or JSON format
  const entries = [];
  const raw = fs.readFileSync(filePath, 'utf-8').trim();

  if (filePath.endsWith('.jsonl')) {
    // JSONL: one entry per line
    for (const line of raw.split('\n').filter(l => l.trim())) {
      try { entries.push(JSON.parse(line)); } catch { /* skip */ }
    }
  } else {
    // JSON: expect { assessments: [...] } or bare array
    try {
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : (parsed.assessments || []);
      entries.push(...arr);
    } catch (err) {
      console.error(`Failed to parse JSON: ${err.message}`);
      process.exit(1);
    }
  }

  let imported = 0;
  let skipped = 0;

  const importMany = db.transaction(() => {
    for (const entry of entries) {
      if (!entry.assessment || !entry.id) {
        skipped++;
        continue;
      }
      updateStmt.run(JSON.stringify(entry.assessment), modelKey, entry.id);
      imported++;
    }
  });

  importMany();

  console.log(`Imported ${imported} assessments from ${filePath}`);
  if (skipped > 0) console.log(`  Skipped ${skipped} (no assessment or no id)`);

  return imported;
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  if (!fs.existsSync(DB_PATH)) {
    console.error('Database not found:', DB_PATH);
    process.exit(1);
  }

  const db = new Database(DB_PATH);
  ensureColumns(db);

  // Handle --import mode (accepts .json or .jsonl)
  if (opts.importFile) {
    const n = importFromFile(db, opts.importFile, opts.model);
    db.close();
    console.log(`Done. ${n} assessments written to DB.`);
    return;
  }

  // Prepare DB statements — blinded assessments go to separate columns
  const assessCol = opts.blinded ? 'blinded_qualitative_assessment' : 'qualitative_assessment';
  const modelCol = opts.blinded ? 'blinded_qualitative_model' : 'qualitative_model';
  const updateStmt = db.prepare(`
    UPDATE evaluation_results
    SET ${assessCol} = ?, ${modelCol} = ?
    WHERE id = ?
  `);

  console.log('='.repeat(70));
  console.log(`QUALITATIVE TRANSCRIPT ASSESSMENT${opts.blinded ? ' (BLINDED)' : ''}`);
  console.log('='.repeat(70));
  console.log(`Run: ${opts.runId} | Model: ${opts.model} | Parallelism: ${opts.parallelism}${opts.blinded ? ' | BLINDED' : ''}`);

  // Load results with multi-turn dialogues
  const rows = loadMultiTurnResults(db, opts.runId, {
    scenario: opts.scenario,
    condition: opts.condition,
    profile: opts.profile,
    limit: opts.limit,
  });

  console.log(`\nFound ${rows.length} results with dialogue logs`);

  if (rows.length === 0) {
    console.log('No multi-turn dialogues found. Ensure the run has dialogue_id values.');
    db.close();
    return;
  }

  // Load transcripts and filter to those with valid traces
  const dialogues = [];
  let skipped = 0;
  for (const row of rows) {
    const dialogue = loadDialogueTrace(row.dialogue_id);
    if (!dialogue || dialogue.trace.length === 0) {
      skipped++;
      continue;
    }

    const transcript = formatTranscript(dialogue.trace, {
      detail: 'play',
      scenarioName: row.scenario_name || row.scenario_id,
      profileName: opts.blinded ? '' : row.profile_name,
      totalTurns: dialogue.totalTurns,
    });

    dialogues.push({
      row,
      transcript,
      condition: detectCondition(row),
      mechanism: detectMechanism(row.profile_name),
    });
  }

  if (skipped > 0) {
    console.log(`  Skipped ${skipped} results without dialogue logs`);
  }
  console.log(`  ${dialogues.length} dialogues ready for assessment`);

  if (dialogues.length === 0) {
    console.log('No dialogue traces found.');
    db.close();
    return;
  }

  // Estimate and confirm
  const conditions = [...new Set(dialogues.map(d => d.condition))];
  const scenarios = [...new Set(dialogues.map(d => d.row.scenario_id))];
  console.log(`  Conditions: ${conditions.join(', ')}`);
  console.log(`  Scenarios: ${scenarios.join(', ')}`);

  if (opts.model === 'claude-code') {
    console.log(`  Cost: Free (Claude Code subscription)`);
  } else {
    const estTokens = dialogues.length * 3000;
    console.log(`  Estimated tokens: ~${(estTokens / 1000).toFixed(0)}K`);
  }

  // Ensure exports directory
  const exportsDir = path.resolve(__dirname, '..', 'exports');
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  const outputPath = opts.output || path.join(exportsDir, `transcript-assessment-${opts.runId}.md`);
  const jsonlPath = outputPath.replace(/\.md$/, '.jsonl');

  // Determine which dialogues need assessment
  let remaining;
  // Use blinded column when --blinded, otherwise the standard column
  const checkCol = opts.blinded ? 'blinded_qualitative_assessment' : 'qualitative_assessment';
  const hasAssessment = (d) => d.row[checkCol] != null;

  if (opts.force) {
    remaining = dialogues;
    console.log(`  --force: will re-assess all ${dialogues.length} dialogues`);
  } else if (opts.resume) {
    // Check DB for existing assessments
    const alreadyDone = dialogues.filter(hasAssessment);
    remaining = dialogues.filter(d => !hasAssessment(d));
    if (alreadyDone.length > 0) {
      console.log(`\n  ${alreadyDone.length} already assessed in DB, ${remaining.length} remaining`);
    }
  } else {
    // Default: skip rows that already have assessments (same as --resume)
    remaining = dialogues.filter(d => !hasAssessment(d));
    const alreadyDone = dialogues.length - remaining.length;
    if (alreadyDone > 0) {
      console.log(`  ${alreadyDone} already assessed in DB (use --force to re-assess)`);
    }
  }

  if (remaining.length === 0) {
    console.log('All dialogues already assessed. Regenerating report...');
  }

  // Clear JSONL backup for fresh run (append mode for resume)
  if (!opts.resume && !opts.force) {
    // Fresh: truncate
  }

  // Run assessments
  const startTime = Date.now();
  let completed = 0;
  let errors = 0;

  if (remaining.length > 0) {
    console.log(`\nAssessing ${remaining.length} dialogues...\n`);

    const tasks = remaining.map((d, idx) => async () => {
      const label = `[${idx + 1}/${remaining.length}]`;
      process.stdout.write(`  ${label} ${d.row.scenario_id} / ${d.row.profile_name} (${d.condition})...`);

      const prompt = buildAssessmentPrompt(d.row, d.transcript, { blinded: opts.blinded });

      // Retry once on failure
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const content = await callModel(prompt, opts.model);
          const assessment = parseJsonResponse(content);

          // Validate tags
          if (assessment.tags) {
            assessment.tags = assessment.tags.filter(t => VALID_TAGS.includes(t));
          }

          // Write to DB immediately
          updateStmt.run(JSON.stringify(assessment), opts.model, d.row.id);

          completed++;
          const tags = (assessment.tags || []).slice(0, 3).join(', ');
          console.log(` OK [${tags}]`);

          const result = {
            id: d.row.id,
            scenario_id: d.row.scenario_id,
            profile_name: d.row.profile_name,
            overall_score: d.row.overall_score,
            condition: d.condition,
            mechanism: d.mechanism,
            assessment,
          };

          // Append to JSONL backup
          fs.appendFileSync(jsonlPath, JSON.stringify(result) + '\n');

          return result;
        } catch (err) {
          if (attempt === 0) {
            process.stdout.write(` retry...`);
            continue;
          }
          errors++;
          console.log(` ERROR: ${err.message.slice(0, 80)}`);

          return {
            id: d.row.id,
            scenario_id: d.row.scenario_id,
            profile_name: d.row.profile_name,
            overall_score: d.row.overall_score,
            condition: d.condition,
            mechanism: d.mechanism,
            error: err.message,
          };
        }
      }
    });

    await runWithConcurrency(tasks, opts.parallelism);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nAssessment complete: ${completed} new, ${errors} errors, ${elapsed}s`);

  // Reload all assessments from DB (the source of truth)
  const allAssessments = db.prepare(`
    SELECT id, scenario_id, profile_name, overall_score, factor_recognition,
           ${assessCol} AS qualitative_assessment, ${modelCol} AS qualitative_model
    FROM evaluation_results
    WHERE run_id = ? AND success = 1 AND ${assessCol} IS NOT NULL
    ORDER BY scenario_id, profile_name, id
  `).all(opts.runId).map(row => ({
    id: row.id,
    scenario_id: row.scenario_id,
    profile_name: row.profile_name,
    overall_score: row.overall_score,
    condition: detectCondition(row),
    mechanism: detectMechanism(row.profile_name),
    assessment: JSON.parse(row.qualitative_assessment),
  }));

  if (allAssessments.length === 0) {
    console.error('No successful assessments in DB.');
    db.close();
    return;
  }

  console.log(`Total assessments in DB: ${allAssessments.length}`);

  // Generate report from DB
  const report = generateReport(opts.runId, allAssessments, opts.model);
  fs.writeFileSync(outputPath, report);
  console.log(`\nReport: ${outputPath}`);

  // Also write a consolidated JSON
  const jsonPath = outputPath.replace(/\.md$/, '.json');
  fs.writeFileSync(jsonPath, JSON.stringify({
    generated: new Date().toISOString(),
    runId: opts.runId,
    model: opts.model,
    n: allAssessments.length,
    errors,
    assessments: allAssessments,
  }, null, 2));
  console.log(`JSON:   ${jsonPath}`);

  // Print summary
  console.log('\n' + '─'.repeat(70));
  console.log('TAG DISTRIBUTION');
  console.log('─'.repeat(70));

  const tagCounts = {};
  for (const a of allAssessments) {
    if (!a.assessment) continue;
    for (const tag of (a.assessment.tags || [])) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }
  const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  for (const [tag, count] of sorted) {
    const bar = '█'.repeat(Math.min(count, 20));
    console.log(`  ${tag.padEnd(28)} ${String(count).padStart(3)} ${bar}`);
  }

  // Score comparison by condition
  const byCondition = { base: [], recognition: [] };
  for (const a of allAssessments) {
    if (a.overall_score != null && a.condition) {
      byCondition[a.condition]?.push(a.overall_score);
    }
  }
  if (byCondition.base.length > 0 || byCondition.recognition.length > 0) {
    console.log('\n' + '─'.repeat(70));
    console.log('SCORE SUMMARY');
    console.log('─'.repeat(70));
    for (const [cond, scores] of Object.entries(byCondition)) {
      if (scores.length === 0) continue;
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const sd = Math.sqrt(scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length);
      console.log(`  ${cond.padEnd(15)} N=${String(scores.length).padStart(3)}  M=${mean.toFixed(1)}  SD=${sd.toFixed(1)}`);
    }
  }

  db.close();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
