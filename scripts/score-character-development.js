#!/usr/bin/env node
/**
 * Character-development scorer + Phase-0 construct-validity gate.
 *
 * Scores a dialogue, BLIND and TRANSCRIPT-ONLY, against
 * config/evaluation-rubric-character-development.yaml (7 dims, bearer-symmetric).
 * The critic never sees the world internals, the motivation block, the arc flag,
 * the binding-migration trace, or which experimental arm produced the dialogue.
 * It reuses the proven poetics blind-scoring plumbing (callModel + JSON repair +
 * retry + the evidence gate + concurrency) so scoring is consistent across rubrics.
 *
 * Two modes:
 *   --gate                  Phase-0: score config/character-development-gate/
 *                           exemplars.yaml and check earned > bare/flat with the
 *                           anti-simulation requirement max(bare) < min(earned).
 *                           If it fails, the instrument is not ready (the finding).
 *   --runs <dir> [<dir>...]  Score derivation run dirs (result.json + diagnosis.json):
 *   --from  <label>          per-run 7 dims + overall + per-bearer, PLUS an
 *                            architecture-independent cross-check from result.json
 *                            (did the learner actually ground the secret?) — a high
 *                            reversal/rebinding score with no grounding is flagged
 *                            as gullibility, not counted as capacity.
 *
 *   [--model sonnet|gpt|gemini-pro|claude-code|...]  critic model (default sonnet)
 *   [--mock] [--concurrency N] [--out <path>]
 *
 * Keep the critic model DISTINCT from the generation model (the poetics critic-
 * mirror finding): a flash-generated pilot scored by a sonnet critic is clean.
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import {
  callModel,
  parseJsonResponse,
  runWithConcurrency,
  withScorerRetry,
  applyEvidenceGate,
  computeOverall,
} from './score-poetics-calibration.js';
import { loadWorld, buildLearnerCharacterArcView } from '../services/dramaticDerivation/index.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const RUBRIC_PATH = path.join(ROOT, 'config/evaluation-rubric-character-development.yaml');
const GATE_PATH = path.join(ROOT, 'config/character-development-gate/exemplars.yaml');

// ── Rubric → critic prompt ──────────────────────────────────────────────────

function loadRubric() {
  const r = yaml.parse(fs.readFileSync(RUBRIC_PATH, 'utf8'));
  const dims = Object.entries(r.dimensions).map(([key, d]) => ({
    key,
    name: d.name,
    group: d.group,
    weight: d.weight,
    description: d.description,
    criteria: d.criteria,
    markers: d[`${key}_markers`] || {},
  }));
  return { version: r.version, dims };
}

function renderRubric(dims) {
  const groups = { learner: "THE LEARNER's arc", tutor: "THE TUTOR's arc", bilateral: 'THE REVERSAL (both)' };
  const order = ['learner', 'tutor', 'bilateral'];
  return order
    .map((g) => {
      const block = dims
        .filter((d) => d.group === g)
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
      return `══ ${groups[g]} ══\n\n${block}`;
    })
    .join('\n\n');
}

function buildCriticPrompt(dims, transcript) {
  const schema = dims
    .map(
      (d) =>
        `  "${d.key}": { "score": <integer 1-5>, "evidence": "<verbatim quote from the transcript, or empty string>", "justification": "<one sentence>" }`,
    )
    .join(',\n');

  return `You are a literary critic of CHARACTER. You are given a tutoring dialogue
(speakers labelled "Tutor", "Learner", and sometimes "Stage" for scene-setting).
Score the dramaturgical FORM of CHARACTER DEVELOPMENT — the arc by which a
speaker's settled disposition and desire are transformed across the exchange.

You are scoring FORM, not interior minds and not affect. A dialogue can be warm,
polite, emotionally intense, or full of insight-language and still show NO
character development. In particular, the VOCABULARY of transformation ("I see it
now", "this changes everything", "I was so wrong", "a real breakthrough") is NOT
development. Development is a change of disposition or aim that the dialogue
actually ENACTS — forced by what the speaker works through, not announced or
conceded on the other's say-so. Reward the earned structural movement; never the
words that name it. A learner who flips the instant the tutor implies they were
wrong has NOT developed, however fluent their transformation-talk.

Score the LEARNER dimensions from the Learner's lines, the TUTOR dimensions from
the Tutor's lines, and the bilateral dimension from the exchange as a whole. Each
dimension is an integer 1-5.

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

function mockResponse(dims) {
  const obj = {};
  // deterministic stub that still varies by pole keyword so --mock can smoke the gate
  for (const d of dims) obj[d.key] = { score: 3, evidence: '', justification: 'mock' };
  return JSON.stringify(obj);
}

async function scoreTranscript({ id, text }, dims, modelKey, mock) {
  const prompt = buildCriticPrompt(dims, text);
  let parsed;
  let retryCount = 0;
  try {
    if (mock) parsed = parseJsonResponse(mockResponse(dims));
    else
      ({ value: parsed, retryCount } = await withScorerRetry(async () =>
        parseJsonResponse(await callModel(prompt, modelKey)),
      ));
  } catch (err) {
    return { id, error: err.message, retryCount: err.retryCount ?? retryCount };
  }
  const dimScores = {};
  const evidence = {};
  const flags = [];
  for (const d of dims) {
    const dr = parsed[d.key] || {};
    const { score, flags: gateFlags } = applyEvidenceGate(dr, text);
    dimScores[d.key] = score;
    evidence[d.key] = dr.evidence || '';
    for (const f of gateFlags) flags.push(`${d.key}:${f}`);
  }
  const byGroup = (g) => dims.filter((d) => d.group === g);
  return {
    id,
    overall: computeOverall(dims, dimScores),
    learnerScore: computeOverall(byGroup('learner'), dimScores),
    tutorScore: computeOverall(byGroup('tutor'), dimScores),
    dimScores,
    evidence,
    flags,
    retryCount,
  };
}

// ── Derivation run loading + blind transcript + structural cross-check ───────

const ROLE_LABEL = { director: 'Stage', tutor: 'Tutor', learner: 'Learner', stage: 'Stage' };

function buildBlindTranscript(result) {
  return (result.transcript || [])
    .filter((e) => e && typeof e.text === 'string' && e.text.trim())
    .map((e) => `${ROLE_LABEL[e.role] || e.role}: ${e.text.trim()}`)
    .join('\n');
}

// The STAGED structural arc, recomputed deterministically from world + the run's
// release ledger — the architecture-independent trajectory the rubric is checked
// against. Returns when the binding structurally migrates (mirror -> truth) and
// the per-turn mirror-pull, or null when the world authors no learner motivation.
function structuralArc(world, result) {
  if (!world?.motivation?.learner) return null;
  const proofIds = new Set(world.proofPaths[0].premises);
  const factOf = (id) => world.premises.find((p) => p.id === id)?.fact;
  const releases = (result.ledger || []).filter((e) => proofIds.has(e.premiseId));
  let migrationTurn = null;
  const pullByTurn = [];
  for (let t = 0; t <= (result.turnsPlayed || world.turnCap); t += 1) {
    const held = releases
      .filter((e) => e.turn <= t)
      .map((e) => factOf(e.premiseId))
      .filter(Boolean);
    const v = buildLearnerCharacterArcView(world, held);
    if (!v) continue;
    pullByTurn.push({ turn: t, mirrorPull: v.mirrorPull, lettingGo: v.lettingGo });
    if (v.lettingGo && migrationTurn == null) migrationTurn = t;
  }
  return { staged: migrationTurn != null, migrationTurn, pullByTurn };
}

function loadRun(dir) {
  const abs = path.isAbsolute(dir) ? dir : path.resolve(ROOT, dir);
  const result = JSON.parse(fs.readFileSync(path.join(abs, 'result.json'), 'utf8'));
  const diagnosis = JSON.parse(fs.readFileSync(path.join(abs, 'diagnosis.json'), 'utf8'));
  const worldPath = path.resolve(ROOT, diagnosis.worldPath);
  const world = loadWorld(worldPath);
  return {
    label: diagnosis.label || path.basename(abs),
    dir: abs,
    world,
    arm: diagnosis.characterArc === true ? 'arc_on' : diagnosis.characterArc === false ? 'arc_off' : 'unknown',
    grounded: result.assertedGroundedTurn != null || result.verdict === 'grounded_anagnorisis',
    verdict: result.verdict,
    assertedGroundedTurn: result.assertedGroundedTurn ?? null,
    transcript: buildBlindTranscript(result),
    structural: structuralArc(world, result),
  };
}

// Architecture-independent gullibility flags: the critic must not be rewarded for
// claiming an EARNED reversal/rebinding the run's own ground truth contradicts.
function gullibilityFlags(score, run) {
  const f = [];
  if (score.dimScores?.reversal_integrity >= 4 && !run.grounded) f.push('reversal_claimed_without_grounding');
  if (score.dimScores?.desire_rebinding >= 4 && run.structural && !run.structural.staged)
    f.push('rebinding_claimed_without_staged_migration');
  return f;
}

// ── Phase-0 gate ────────────────────────────────────────────────────────────

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

async function runGate({ model, mock, concurrency }) {
  const { dims, version } = loadRubric();
  const spec = yaml.parse(fs.readFileSync(GATE_PATH, 'utf8'));
  const items = spec.items.map((it) => ({ id: it.id, pole: it.pole, text: it.transcript.trim() }));
  console.log(`Phase-0 gate: scoring ${items.length} exemplars with ${mock ? 'MOCK' : model} (rubric v${version})...`);
  const scored = await runWithConcurrency(
    items.map((it) => () => scoreTranscript(it, dims, model, mock).then((s) => ({ ...s, pole: it.pole }))),
    concurrency,
  );
  const ok = scored.filter((s) => !s.error);
  const band = (pole) => ok.filter((s) => s.pole === pole).map((s) => s.overall);
  const earned = band('earned');
  const bare = band('bare');
  const flat = band('flat');
  const g = spec.gate || {};
  const minEarned = earned.length ? Math.min(...earned) : null;
  const maxFlat = flat.length ? Math.max(...flat) : null;
  const maxBare = bare.length ? Math.max(...bare) : null;
  const margin = earned.length && flat.length ? mean(earned) - mean(flat) : null;
  const perfectSep = minEarned != null && maxFlat != null ? minEarned > maxFlat : null;
  const marginPass = margin != null ? margin >= (g.min_mean_margin ?? 25) : null;
  const trapPass = maxBare != null && minEarned != null ? maxBare < minEarned : null;
  const gatePass = Boolean((perfectSep ?? true) && marginPass && (trapPass ?? true));

  console.log(`\n══ Character-development Phase-0 gate — critic=${mock ? 'mock' : model}, rubric v${version} ══\n`);
  console.log('id                     pole     overall  L     T     flags');
  for (const s of [...scored].sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1))) {
    if (s.error) {
      console.log(`${s.id.padEnd(22)} ${String(s.pole).padEnd(7)}  ERROR  ${s.error}`);
      continue;
    }
    console.log(
      `${s.id.padEnd(22)} ${s.pole.padEnd(7)}  ${String(s.overall).padStart(5)}  ${String(s.learnerScore).padStart(4)}  ${String(s.tutorScore).padStart(4)}  ${s.flags.join(',') || ''}`,
    );
  }
  console.log('\n── Gate ──');
  console.log(`mean(earned)=${num(mean(earned))}  mean(bare)=${num(mean(bare))}  mean(flat)=${num(mean(flat))}`);
  console.log(`min(earned)=${num(minEarned)}  max(bare)=${num(maxBare)}  max(flat)=${num(maxFlat)}`);
  console.log(`perfect separation (min earned > max flat): ${fmtBool(perfectSep)}`);
  console.log(`mean margin >= ${g.min_mean_margin ?? 25}: ${fmtBool(marginPass)} (margin=${num(margin)})`);
  console.log(`anti-simulation (max bare < min earned): ${fmtBool(trapPass)}`);
  console.log(
    `\nGATE: ${gatePass ? 'PASS — the instrument separates earned development from bare transformation-talk' : 'FAIL — the instrument cannot separate (this is the finding); do not score LLM runs yet'}`,
  );
  return { gatePass, scored, stats: { margin, perfectSep, trapPass, minEarned, maxBare, maxFlat } };
}

// ── Run scoring ─────────────────────────────────────────────────────────────

async function scoreRuns({ dirs, model, mock, concurrency }) {
  const { dims, version } = loadRubric();
  const runs = dirs.map(loadRun);
  console.log(
    `Scoring ${runs.length} run(s) with ${mock ? 'MOCK' : model} (rubric v${version}, BLIND/transcript-only)...`,
  );
  const scored = await runWithConcurrency(
    runs.map((run) => async () => {
      const s = await scoreTranscript({ id: run.label, text: run.transcript }, dims, model, mock);
      const gull = s.error ? [] : gullibilityFlags(s, run);
      return {
        ...s,
        arm: run.arm,
        grounded: run.grounded,
        verdict: run.verdict,
        structural: run.structural,
        gullibility: gull,
      };
    }),
    concurrency,
  );

  console.log(`\n══ Character-development run scores — critic=${mock ? 'mock' : model}, rubric v${version} ══\n`);
  console.log('label                              arm      overall  L     T     grnd  gullibility');
  for (const s of scored) {
    if (s.error) {
      console.log(`${s.id.padEnd(34)} ${(s.arm || '').padEnd(8)} ERROR  ${s.error}`);
      continue;
    }
    console.log(
      `${s.id.slice(0, 34).padEnd(34)} ${s.arm.padEnd(8)} ${String(s.overall).padStart(5)}  ${String(s.learnerScore).padStart(4)}  ${String(s.tutorScore).padStart(4)}  ${s.grounded ? 'yes' : 'no '}   ${s.gullibility.join(',') || ''}`,
    );
  }
  // on-vs-off contrast (G3)
  const arm = (a) => scored.filter((s) => !s.error && s.arm === a).map((s) => s.overall);
  const on = arm('arc_on');
  const off = arm('arc_off');
  if (on.length && off.length) {
    console.log(`\n── Ablation (G3) ──`);
    console.log(
      `mean overall  arc_on=${num(mean(on))} (n=${on.length})  arc_off=${num(mean(off))} (n=${off.length})  delta=${num(mean(on) - mean(off))}`,
    );
  }
  const anyGull = scored.some((s) => s.gullibility?.length);
  console.log(
    `\nGullibility (G2): ${anyGull ? 'FLAGS PRESENT — critic claimed earned development the run ground truth contradicts (see rows)' : 'none — critic scores consistent with structural ground truth'}`,
  );
  return { scored };
}

function num(x) {
  return x == null || Number.isNaN(x) ? 'n/a' : x.toFixed(1);
}
function fmtBool(b) {
  return b == null ? 'n/a' : b ? 'PASS' : 'FAIL';
}

// ── Main ────────────────────────────────────────────────────────────────────

function parseArgs() {
  const a = process.argv.slice(2);
  const o = { mode: null, dirs: [], model: 'sonnet', mock: false, concurrency: 3, out: null };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--gate') o.mode = 'gate';
    else if (a[i] === '--runs') {
      o.mode = 'runs';
      while (a[i + 1] && !a[i + 1].startsWith('--')) o.dirs.push(a[++i]);
    } else if (a[i] === '--model') o.model = a[++i];
    else if (a[i] === '--mock') o.mock = true;
    else if (a[i] === '--concurrency') o.concurrency = parseInt(a[++i], 10);
    else if (a[i] === '--out') o.out = a[++i];
    else console.warn(`Unknown arg: ${a[i]}`);
  }
  return o;
}

async function main() {
  const o = parseArgs();
  if (!o.mode) {
    console.error('specify --gate or --runs <dir>...');
    process.exit(1);
  }
  const result = o.mode === 'gate' ? await runGate(o) : await scoreRuns(o);
  const outPath =
    o.out ||
    path.join(
      ROOT,
      'exports',
      `character-development-${o.mode}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`,
    );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      { generated: new Date().toISOString(), mode: o.mode, critic: o.mock ? 'mock' : o.model, ...result },
      null,
      2,
    ),
  );
  console.log(`\nResults written to ${path.relative(ROOT, outPath)}`);
  if (o.mode === 'gate' && !result.gatePass && !o.mock) process.exitCode = 1;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (invokedDirectly)
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });

export { loadRubric, buildCriticPrompt, scoreTranscript, structuralArc, gullibilityFlags };
