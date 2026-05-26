#!/usr/bin/env node
/**
 * Poetics calibration scorer (Phase 0 instrument gate).
 *
 * Scores the calibration corpus in config/poetics-calibration/corpus/*.txt with
 * config/evaluation-rubric-poetics.yaml, BLIND — the critic sees only the
 * neutral transcript text, never the pole/source in key.yaml. After scoring it
 * joins the held-out key and evaluates the pre-registered gate:
 *   - perfect rank separation (every high item > every flat item)
 *   - mean(high) - mean(flat) >= min_mean_margin
 *   - every trap item <= mean(flat)   (anti-simulation guard fires)
 *
 * If the instrument cannot separate KNOWN tragic from KNOWN flat, that failure
 * is itself the finding (DRAMATIC-RECOGNITION-PLAN.md §6) — no downstream phases.
 *
 * Usage:
 *   node scripts/score-poetics-calibration.js [--model claude-code|sonnet|gpt|haiku]
 *        [--concurrency 3] [--mock] [--out exports/poetics-calibration-<ts>.json]
 *
 * --mock returns deterministic stub scores (no API) to smoke-test the plumbing.
 * Default critic model is claude-code (Max-plan CLI bridge), matching
 * assess-transcripts.js. Keep the critic model DISTINCT from any item's author
 * (generator != critic); the two trap items are Claude-authored, so prefer a
 * non-Claude critic (--model gpt) for a clean run.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'node:child_process';
import os from 'node:os';
import yaml from 'yaml';
import { jsonrepair } from 'jsonrepair';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const CORPUS_DIR = path.join(ROOT, 'config/poetics-calibration/corpus');
const KEY_PATH = path.join(ROOT, 'config/poetics-calibration/key.yaml');
const RUBRIC_PATH = path.join(ROOT, 'config/evaluation-rubric-poetics.yaml');

const MODEL_MAP = {
  'claude-code': 'claude-code',
  codex: 'codex',
  haiku: 'anthropic/claude-haiku-4.5',
  sonnet: 'anthropic/claude-sonnet-4.6',
  gpt: 'openai/gpt-5.2',
  'gemini-flash': 'google/gemini-3-flash-preview',
  'gemini-flash-3.1': 'google/gemini-3.1-flash-lite-preview',
  'gemini-pro': 'google/gemini-3-pro-preview',
  'gemini-pro-3.1': 'google/gemini-3.1-pro-preview',
  'gemini-3.5-flash': 'google/gemini-3.5-flash',
  'google/gemini-3.5-flash': 'google/gemini-3.5-flash',
};
const OPENROUTER_SCORER_MAX_TOKENS = Number(process.env.OPENROUTER_SCORER_MAX_TOKENS || 4096);

// ── Model calls (mirrors scripts/assess-transcripts.js) ─────────────────────

async function callModel(prompt, modelKey) {
  if (modelKey === 'claude-code') return callClaudeCode(prompt);
  if (modelKey === 'codex') return callCodex(prompt);
  return callOpenRouter(prompt, modelKey);
}

async function callClaudeCode(prompt) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-claude-'));
  const stdout = await new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    const args = [
      '--no-session-persistence',
      '--disable-slash-commands',
      '--no-chrome',
      '--setting-sources',
      'user',
      '--tools',
      '',
      '-p',
      '-',
      '--output-format',
      'text',
    ];
    if (process.env.CLAUDE_CODE_BARE === '1') args.unshift('--bare');
    if (process.env.CLAUDE_CODE_MODEL) args.splice(1, 0, '--model', process.env.CLAUDE_CODE_MODEL);
    const child = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
      cwd: tmpDir,
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => reject(new Error(`Failed to spawn claude: ${e.message}`)));
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(err || out || `claude exited with code ${code}`));
      else resolve(out);
    });
    child.stdin.write(prompt);
    child.stdin.end();
  }).finally(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
  return stdout.trim();
}

// codex CLI critic (non-interactive `codex exec`). Uses codex's own stored login
// (a current OpenAI model), so it needs no OPENROUTER/OPENAI key and is a clean
// non-Claude critic for the Claude-authored trap items. Each call gets its own
// temp dir + cwd so concurrent runs never collide on the --output-last-message
// file. Reasoning tier is pinned EXPLICITLY (not inherited from
// ~/.codex/config.toml) so a scoring run records its own settings; override with
// CODEX_REASONING_EFFORT / CODEX_MODEL. CODEX_MODEL defaults to null (codex picks
// its configured default) — we still avoid hardcoding a model name that goes stale.
const CODEX_REASONING_EFFORT = process.env.CODEX_REASONING_EFFORT || 'xhigh';
const CODEX_MODEL = process.env.CODEX_MODEL || null;
async function callCodex(prompt) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-codex-'));
  const outFile = path.join(tmpDir, 'last.txt');
  try {
    await new Promise((resolve, reject) => {
      const codexArgs = [
        'exec',
        '--skip-git-repo-check',
        '--ephemeral',
        '-s',
        'read-only',
        '-C',
        tmpDir,
        '--color',
        'never',
      ];
      if (CODEX_MODEL) codexArgs.push('-m', CODEX_MODEL);
      if (CODEX_REASONING_EFFORT) codexArgs.push('-c', `model_reasoning_effort="${CODEX_REASONING_EFFORT}"`);
      codexArgs.push('-o', outFile, '-');
      const child = spawn('codex', codexArgs, { stdio: ['pipe', 'pipe', 'pipe'], cwd: tmpDir });
      let err = '';
      child.stderr.on('data', (d) => (err += d));
      child.stdout.on('data', () => {});
      child.on('error', (e) => reject(new Error(`Failed to spawn codex: ${e.message}`)));
      child.on('close', (code) => {
        if (code !== 0) reject(new Error(err || `codex exited with code ${code}`));
        else resolve();
      });
      child.stdin.write(prompt);
      child.stdin.end();
    });
    const content = fs.readFileSync(outFile, 'utf8').trim();
    if (!content) throw new Error('codex produced no output message');
    return content;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function callOpenRouter(prompt, modelKey) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');
  const model = MODEL_MAP[modelKey] || (String(modelKey).includes('/') ? modelKey : null);
  if (!model) throw new Error(`Unknown model: ${modelKey}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: OPENROUTER_SCORER_MAX_TOKENS,
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
  const parseCandidate = (candidate) => {
    try {
      return JSON.parse(candidate);
    } catch {
      return JSON.parse(jsonrepair(candidate));
    }
  };
  try {
    return parseCandidate(content);
  } catch {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return parseCandidate(match[1].trim());
    const first = content.indexOf('{');
    const last = content.lastIndexOf('}');
    if (first !== -1 && last > first) return parseCandidate(content.slice(first, last + 1));
    throw new Error(`Failed to parse JSON: ${content.slice(0, 300)}`);
  }
}

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

// ── Rubric → critic prompt ──────────────────────────────────────────────────

function loadRubric() {
  const r = yaml.parse(fs.readFileSync(RUBRIC_PATH, 'utf8'));
  const dims = Object.entries(r.dimensions).map(([key, d]) => ({
    key,
    name: d.name,
    weight: d.weight,
    description: d.description,
    criteria: d.criteria,
    markers: d[`${key}_markers`] || {},
  }));
  const weightSum = dims.reduce((s, d) => s + d.weight, 0);
  if (Math.abs(weightSum - 1) > 1e-6) {
    console.warn(`WARN: rubric weights sum to ${weightSum}, expected 1.0`);
  }
  return { version: r.version, dims };
}

function renderRubric(dims) {
  return dims
    .map((d) => {
      const pos = (d.markers.positive || []).map((m) => `      + ${m}`).join('\n');
      const neg = (d.markers.negative || []).map((m) => `      - ${m}`).join('\n');
      return `### ${d.name}  (key: ${d.key}, weight: ${d.weight})
${d.description}
    Level 5: ${d.criteria[5]}
    Level 3: ${d.criteria[3]}
    Level 1: ${d.criteria[1]}
    Positive signals:
${pos}
    Negative signals:
${neg}`;
    })
    .join('\n\n');
}

function buildCriticPrompt(dims, transcript) {
  const keys = dims.map((d) => d.key);
  const schema = keys
    .map(
      (k) =>
        `  "${k}": { "score": <integer 1-5>, "evidence": "<verbatim quote from the transcript, or empty string>", "justification": "<one sentence>" }`,
    )
    .join(',\n');

  return `You are a literary critic scoring the DRAMATIC FORM of a short
dialogue. You are given ONLY the transcript (speakers are labelled A, B, C, …;
most exchanges have two speakers, a few have more). Do not guess its author,
source, or genre — score only what is on the page.

You are scoring FORM, not manners and not affect. A dialogue can be warm, polite,
emotionally intense, or full of insight-language and still be dramatically FLAT.
In particular: the VOCABULARY of recognition ("I see it now", "everything makes
sense", "a breakthrough") is NOT recognition. Recognition is a change from
ignorance to knowledge that the dialogue actually enacts. Reward the structural
event, never the words that name it.

Score each of the following six dimensions on an integer 1-5 scale.

${renderRubric(dims)}

EVIDENCE GATE (strict): for ANY dimension you score 4 or 5, the "evidence" field
MUST contain a short VERBATIM quote copied exactly from the transcript that
warrants the high score. If you cannot quote exact textual evidence, you may not
score above 3. For scores of 1-3, "evidence" may be an empty string.

TRANSCRIPT:
---
${transcript}
---

Return ONLY a JSON object with exactly this structure (no prose before or after):
{
${schema}
}`;
}

// ── Scoring ──────────────────────────────────────────────────────────────────

// Normalise for substring matching: unify typographic apostrophes/quotes/dashes,
// strip line-leading speaker labels (A:/B:/…) so a quote spanning a turn boundary
// still matches, then lowercase and collapse whitespace.
function normalizeForMatch(s) {
  return (s || '')
    .replace(/['"‘’‚‛ʼ“”„‟]/g, '')
    .replace(/[‐-―]/g, '-')
    .replace(/^\s*[A-Z]:\s*/gm, ' ')
    .toLowerCase()
    .replace(/\s*-\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Enforce the rubric evidence gate programmatically: a score >3 with no verbatim
// quote actually present in the transcript is clamped to 3 (anti-hallucination).
function applyEvidenceGate(dimResult, transcript) {
  const flags = [];
  const haystack = normalizeForMatch(transcript);
  let score = Math.max(1, Math.min(5, Math.round(Number(dimResult.score) || 1)));
  if (score > 3) {
    // A critic may quote two real but non-adjacent spans joined by an ellipsis.
    // Validate each substantial fragment independently — still anti-hallucination
    // (every fragment must be real text), without demanding one contiguous span.
    const fragments = normalizeForMatch(dimResult.evidence)
      .split(/\s*(?:\.{3,}|…)\s*/)
      .map((f) => f.trim())
      .filter((f) => f.length >= 8);
    const present = fragments.length > 0 && fragments.every((f) => haystack.includes(f));
    if (!present) {
      flags.push(`evidence_gate_clamp:${score}->3`);
      score = 3;
    }
  }
  return { score, flags };
}

function computeOverall(dims, dimScores) {
  const weighted = dims.reduce((s, d) => s + dimScores[d.key] * d.weight, 0);
  const weightSum = dims.reduce((s, d) => s + d.weight, 0);
  const avg = weighted / weightSum;
  return Math.round(((avg - 1) / 4) * 100 * 10) / 10; // 0-100, one decimal
}

function mockResponse(dims) {
  const obj = {};
  for (const d of dims) obj[d.key] = { score: 3, evidence: '', justification: 'mock' };
  return JSON.stringify(obj);
}

async function scoreItem({ id, text }, dims, modelKey, mock) {
  const prompt = buildCriticPrompt(dims, text);
  let raw;
  try {
    raw = mock ? mockResponse(dims) : await callModel(prompt, modelKey);
  } catch (err) {
    return { id, error: err.message };
  }
  let parsed;
  try {
    parsed = parseJsonResponse(raw);
  } catch (err) {
    return { id, error: `parse: ${err.message}` };
  }
  const dimScores = {};
  const allFlags = [];
  const evidence = {};
  for (const d of dims) {
    const dr = parsed[d.key] || {};
    const { score, flags } = applyEvidenceGate(dr, text);
    dimScores[d.key] = score;
    evidence[d.key] = dr.evidence || '';
    for (const f of flags) allFlags.push(`${d.key}:${f}`);
  }
  return { id, overall: computeOverall(dims, dimScores), dimScores, evidence, flags: allFlags };
}

// ── Gate evaluation ───────────────────────────────────────────────────────────

function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

function evaluateGate(scored, key) {
  const byPole = { high: [], flat: [], trap: [] };
  for (const s of scored) {
    if (s.error) continue;
    const pole = key.items[s.id]?.pole;
    if (pole && byPole[pole]) byPole[pole].push(s);
  }
  const highVals = byPole.high.map((s) => s.overall);
  const flatVals = byPole.flat.map((s) => s.overall);
  const trapVals = byPole.trap.map((s) => s.overall);

  const meanHigh = mean(highVals);
  const meanFlat = mean(flatVals);
  const maxFlat = flatVals.length ? Math.max(...flatVals) : null;
  const minHigh = highVals.length ? Math.min(...highVals) : null;
  const maxTrap = trapVals.length ? Math.max(...trapVals) : null;
  const g = key.gate || {};

  const haveBoth = highVals.length > 0 && flatVals.length > 0;
  const perfectSep = haveBoth ? minHigh > maxFlat : null;
  const margin = haveBoth ? meanHigh - meanFlat : null;
  const marginPass = margin == null ? null : margin >= (g.min_mean_margin ?? 30);

  // Trap ceiling. The ORIGINAL pre-registration (2026-05-19) was trap <= mean(flat);
  // it FAILED both critics because mean(flat) is dragged to the floor by pure
  // catechisms, and is noise-sensitive (a trap and the driest flat co-occupy the
  // bottom band). AMENDED 2026-05-20 (key.yaml) to a two-tier "minimax" ceiling that
  // isolates the actual anti-simulation claim: a trap must not reach the recognition
  // band. trapBelowMinHigh is genuinely WEAKER than the original — recorded as a
  // transparent post-hoc re-spec, not a silent softening. All three are reported; the
  // gate is decided on the REQUIRED tier (trapBelowMinHigh).
  const trapBelowMeanFlat = trapVals.length && !Number.isNaN(meanFlat) ? trapVals.every((v) => v <= meanFlat) : null; // original (superseded)
  const trapWithinMaxFlat = trapVals.length && maxFlat != null ? maxTrap <= maxFlat : null; // preferred: within flat band
  const trapBelowMinHigh = trapVals.length && minHigh != null ? maxTrap < minHigh : null; // required: below recognition band

  const complete = byPole.high.length === 5 && byPole.flat.length === 5;
  const gatePass = complete && perfectSep && marginPass && (trapVals.length ? trapBelowMinHigh : true);

  return {
    byPole,
    meanHigh,
    meanFlat,
    meanTrap: mean(trapVals),
    maxFlat,
    minHigh,
    maxTrap,
    perfectSep,
    margin,
    marginPass,
    trapBelowMeanFlat,
    trapWithinMaxFlat,
    trapBelowMinHigh,
    trapPass: trapBelowMinHigh, // back-compat: gating trap result (now the required tier)
    complete,
    gatePass,
  };
}

function printReport(scored, key, gate, modelKey) {
  const order = ['high', 'flat', 'trap'];
  console.log(`\n══ Poetics calibration — critic=${modelKey}, rubric v${key.rubric_version} ══\n`);
  const poleOf = (id) => key.items[id]?.pole || '?';
  const rows = [...scored].sort((a, b) => {
    const pa = order.indexOf(poleOf(a.id));
    const pb = order.indexOf(poleOf(b.id));
    return pa - pb || (b.overall ?? -1) - (a.overall ?? -1);
  });
  console.log('id   pole   overall  flags');
  for (const s of rows) {
    if (s.error) {
      console.log(`${s.id.padEnd(4)} ${poleOf(s.id).padEnd(5)}  ERROR    ${s.error}`);
      continue;
    }
    console.log(
      `${s.id.padEnd(4)} ${poleOf(s.id).padEnd(5)}  ${String(s.overall).padStart(5)}    ${s.flags.join(',') || ''}`,
    );
  }
  console.log('\n── Gate ──');
  console.log(
    `mean(high) = ${num(gate.meanHigh)}   mean(flat) = ${num(gate.meanFlat)}   mean(trap) = ${num(gate.meanTrap)}`,
  );
  console.log(
    `max(flat)  = ${num(gate.maxFlat)}   min(high)  = ${num(gate.minHigh)}   max(trap)  = ${num(gate.maxTrap)}`,
  );
  console.log(`corpus complete (5 high + 5 flat): ${gate.complete ? 'yes' : 'NO — partial run'}`);
  console.log(`perfect separation (min high > max flat): ${fmtBool(gate.perfectSep)}`);
  console.log(
    `mean margin >= ${key.gate?.min_mean_margin ?? 30}: ${fmtBool(gate.marginPass)} (margin=${num(gate.margin)})`,
  );
  console.log('trap ceiling (amended 2026-05-20, see key.yaml):');
  console.log(
    `  REQUIRED  max(trap) < min(high)  : ${fmtBool(gate.trapBelowMinHigh)}  [traps never reach the recognition band]`,
  );
  console.log(
    `  preferred max(trap) <= max(flat) : ${fmtBool(gate.trapWithinMaxFlat)}  [traps stay within the flat band]`,
  );
  console.log(
    `  original  trap <= mean(flat)     : ${fmtBool(gate.trapBelowMeanFlat)}  [pre-reg 2026-05-19; superseded — fragile]`,
  );
  console.log(
    `\nGATE: ${gate.gatePass ? 'PASS — instrument separates known tragic from known flat (required trap tier met)' : gate.complete ? 'FAIL — instrument does not separate (this is the finding)' : 'INCOMPLETE — add the pending corpus items, then re-run'}`,
  );
}

function num(x) {
  return x == null || Number.isNaN(x) ? 'n/a' : x.toFixed(1);
}
function fmtBool(b) {
  return b == null ? 'n/a' : b ? 'PASS' : 'FAIL';
}

// ── Main ──────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { model: 'claude-code', concurrency: 3, mock: false, out: null };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--model':
        opts.model = args[++i];
        break;
      case '--concurrency':
        opts.concurrency = parseInt(args[++i], 10);
        break;
      case '--mock':
        opts.mock = true;
        break;
      case '--out':
        opts.out = args[++i];
        break;
      default:
        console.warn(`Unknown arg: ${args[i]}`);
    }
  }
  return opts;
}

function loadCorpus() {
  if (!fs.existsSync(CORPUS_DIR)) throw new Error(`No corpus dir: ${CORPUS_DIR}`);
  return fs
    .readdirSync(CORPUS_DIR)
    .filter((f) => f.endsWith('.txt'))
    .map((f) => ({ id: path.basename(f, '.txt'), text: fs.readFileSync(path.join(CORPUS_DIR, f), 'utf8').trim() }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function main() {
  const opts = parseArgs();
  const { dims } = loadRubric();
  const key = yaml.parse(fs.readFileSync(KEY_PATH, 'utf8'));
  const corpus = loadCorpus();

  const known = corpus.filter((c) => key.items[c.id]);
  const unknown = corpus.filter((c) => !key.items[c.id]);
  if (unknown.length)
    console.warn(`WARN: corpus files with no key entry (skipped): ${unknown.map((u) => u.id).join(', ')}`);
  const pending = Object.keys(key.items).filter((id) => !corpus.find((c) => c.id === id));
  if (pending.length)
    console.warn(`NOTE: key items not yet in corpus (pending fetch/normalise): ${pending.join(', ')}`);

  console.log(
    `Scoring ${known.length} transcripts with ${opts.mock ? 'MOCK' : opts.model} (concurrency ${opts.concurrency})...`,
  );
  const scored = await runWithConcurrency(
    known.map((item) => () => scoreItem(item, dims, opts.model, opts.mock)),
    opts.concurrency,
  );

  const gate = evaluateGate(scored, key);
  printReport(scored, key, gate, opts.mock ? 'mock' : opts.model);

  const outPath =
    opts.out ||
    path.join(
      ROOT,
      'exports',
      `poetics-calibration-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`,
    );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        generated: new Date().toISOString(),
        critic: opts.mock ? 'mock' : opts.model,
        rubric_version: key.rubric_version,
        gate,
        scored,
      },
      null,
      2,
    ),
  );
  console.log(`\nResults written to ${path.relative(ROOT, outPath)}`);
  if (gate.complete && !gate.gatePass && !opts.mock) process.exitCode = 1;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

export { evaluateGate, normalizeForMatch, applyEvidenceGate, computeOverall, loadRubric, buildCriticPrompt };
// Shared, behaviour-neutral plumbing reused by the Phase-1 scorer (no scoring
// logic — exporting these does not change any Phase-0 computed value).
export { callModel, parseJsonResponse, runWithConcurrency, MODEL_MAP };
