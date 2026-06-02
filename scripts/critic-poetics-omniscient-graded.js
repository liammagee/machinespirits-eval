#!/usr/bin/env node
/*
 * Graded omniscient critic — a 0–4 attainment scale companion to the binary
 * critic-poetics-omniscient.js (which it reuses for loaders/primitives, leaving
 * the binary path untouched). Where the binary scores discovered/not, this grades
 * the learner's FURTHEST point on the ladder in notes/poetics/oedipus-discovery-grade-rubric.md:
 *   0 far · 1 dislodged · 2 GENUS · 3 species-partial · 4 species-full
 * plus by_reasoning and tutor_revealed flags. Purpose: separate near-misses (genus,
 * 2–3) from far-misses (0–1) — the resolution the binary collapses.
 *
 * Scores arms across one OR MORE run dirs (--sample-root repeatable) and aggregates
 * per (drama, arm): mean grade, per-run grades, socratic−none gap, and inter-rater
 * spread (does the blind panel AGREE on the band — i.e. is near-vs-far judgeable?).
 *
 * Usage:
 *   node scripts/critic-poetics-omniscient-graded.js \
 *     --sample-root exports/oedipus-d5-full/run1 --sample-root exports/oedipus-d5-full/run2 ... \
 *     --spec config/poetics-calibration/oedipus-pilot-v2.yaml [--arms socratic,none,reveal] \
 *     [--panel ...] [--concurrency 4] [--out FILE] [--mock]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { loadSecretMap, loadArmItems } from './critic-poetics-omniscient.js';
import { callModel, parseJsonResponse, runWithConcurrency, withScorerRetry } from './score-poetics-calibration.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_PANEL = ['qwen/qwen3.7-max', 'google/gemini-3.5-flash', 'deepseek/deepseek-v4-pro', 'gpt'];

function parseArgs(argv) {
  const a = {
    roots: [],
    spec: null,
    arms: ['socratic', 'none', 'reveal'],
    panel: [...DEFAULT_PANEL],
    concurrency: 4,
    out: null,
    mock: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--sample-root') a.roots.push(path.resolve(argv[++i]));
    else if (t === '--spec') a.spec = path.resolve(argv[++i]);
    else if (t === '--arms')
      a.arms = String(argv[++i])
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    else if (t === '--panel')
      a.panel = String(argv[++i])
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    else if (t === '--concurrency') a.concurrency = parseInt(argv[++i], 10);
    else if (t === '--out') a.out = path.resolve(argv[++i]);
    else if (t === '--mock') a.mock = true;
  }
  if (!a.roots.length) throw new Error('at least one --sample-root is required');
  if (!a.spec) throw new Error('--spec is required');
  return a;
}

const LADDER = `0 = far miss: still asserts the original wrong belief (the OTHER party is at fault / the result is wrong / inflated). No structural reconceiving.
1 = dislodged: lets go of the wrong belief but lands on a decoy or a vague "can't tell"; no structural account.
2 = GENUS: names the abstract SHAPE of S — "two distinct things under one name, so the comparison is invalid" — but NOT which two, nor the direction.
3 = species, partial: identifies the specific referents OR the direction, but incompletely / tentatively.
4 = species, full: lands the specific hidden truth S INCLUDING the direction (who used which), as a positive claim.`;

function buildGradedPrompt(transcript, fact) {
  return `You are the AUDIENCE at a drama. You KNOW the hidden truth S; the learner does NOT.

THE HIDDEN TRUTH (S):
"${fact}"

The learner can come to know S only through what the TUTOR says on stage. Public transcript:
---
${transcript}
---

Grade the LEARNER's FURTHEST point by the end, on this 0–4 ladder (judge ONLY the page; credit the high-water mark even if they hedge afterward):
${LADDER}

The GENUS(2) vs far(0) line is the key judgement: did the learner reach a STRUCTURAL account of S, or not?

Also judge:
- by_reasoning: did the learner REASON to their furthest point by integrating evidence the tutor surfaced, rather than being TOLD?
- tutor_revealed: did the TUTOR baldly STATE S, rather than only supplying premises and questions?

Return ONLY JSON:
{
  "attainment": 0,
  "by_reasoning": true,
  "tutor_revealed": false,
  "band_reason": "<one sentence: what they reached and the line just above/below it>",
  "learner_evidence": "<verbatim learner quote at their furthest point>"
}`;
}

function coerceGraded(p) {
  let a = Number(p?.attainment);
  if (!Number.isFinite(a)) a = 0;
  a = Math.max(0, Math.min(4, Math.round(a)));
  return {
    attainment: a,
    by_reasoning: Boolean(p?.by_reasoning),
    tutor_revealed: Boolean(p?.tutor_revealed),
    band_reason: typeof p?.band_reason === 'string' ? p.band_reason : '',
    learner_evidence: typeof p?.learner_evidence === 'string' ? p.learner_evidence : '',
  };
}

function mockGraded(arm) {
  if (arm === 'socratic') return coerceGraded({ attainment: 3, by_reasoning: true, tutor_revealed: false });
  if (arm === 'reveal') return coerceGraded({ attainment: 4, by_reasoning: false, tutor_revealed: true });
  return coerceGraded({ attainment: 1, by_reasoning: false, tutor_revealed: false });
}

async function panelGraded(item, args) {
  if (args.mock) return args.panel.map((model) => ({ model, vote: mockGraded(item.arm) }));
  const prompt = buildGradedPrompt(item.transcript, item.secret.fact);
  return runWithConcurrency(
    args.panel.map((model) => async () => {
      try {
        const { value } = await withScorerRetry(async () => parseJsonResponse(await callModel(prompt, model)));
        return { model, vote: coerceGraded(value) };
      } catch (err) {
        return { model, error: err.message };
      }
    }),
    args.panel.length,
  );
}

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

async function run(args) {
  const secretMap = loadSecretMap(args.spec);
  // load every arm item from every root, tagging its run by the root's basename
  const items = [];
  for (const root of args.roots) {
    const runTag = path.basename(root);
    for (const it of loadArmItems({ sampleRoot: root, spec: args.spec, arms: args.arms }, secretMap)) {
      items.push({ ...it, runTag, root });
    }
  }
  if (!items.length) throw new Error('no transcripts found under the given --sample-root(s)');

  const scored = await runWithConcurrency(
    items.map((item) => async () => {
      const votes = await panelGraded(item, args);
      const valid = votes.filter((v) => v.vote && !v.error);
      const grades = valid.map((v) => v.vote.attainment);
      return {
        dramaId: item.dramaId,
        arm: item.arm,
        run: item.runTag,
        panelGrades: grades,
        itemGrade: median(grades), // one number per transcript = median of the blind panel
        itemMean: mean(grades),
        spread: grades.length ? Math.max(...grades) - Math.min(...grades) : null, // inter-rater band width
        byReasoningVotes: valid.filter((v) => v.vote.by_reasoning).length,
        revealVotes: valid.filter((v) => v.vote.tutor_revealed).length,
        nCritics: valid.length,
        votes: votes.map((v) => ({ model: v.model, ...(v.error ? { error: v.error } : v.vote) })),
      };
    }),
    args.mock ? 1 : args.concurrency,
  );

  // aggregate per (drama, arm)
  const agg = {};
  for (const s of scored) {
    const k = `${s.dramaId}::${s.arm}`;
    agg[k] ||= { dramaId: s.dramaId, arm: s.arm, itemGrades: [], spreads: [], runs: [] };
    agg[k].itemGrades.push(s.itemGrade);
    agg[k].spreads.push(s.spread);
    agg[k].runs.push({ run: s.run, grade: s.itemGrade, panel: s.panelGrades, spread: s.spread });
  }
  const cells = Object.values(agg).map((c) => ({
    dramaId: c.dramaId,
    arm: c.arm,
    n: c.itemGrades.length,
    meanGrade: Number(mean(c.itemGrades).toFixed(2)),
    medianGrade: median(c.itemGrades),
    grades: c.itemGrades,
    meanInterRaterSpread: Number(mean(c.spreads).toFixed(2)), // avg band width across the 4 judges
    runs: c.runs,
  }));

  // socratic − none gap per drama (the graded lift)
  const dramas = [...new Set(cells.map((c) => c.dramaId))];
  const gaps = dramas.map((d) => {
    const soc = cells.find((c) => c.dramaId === d && c.arm === 'socratic');
    const none = cells.find((c) => c.dramaId === d && c.arm === 'none');
    return {
      dramaId: d,
      socraticMean: soc?.meanGrade ?? null,
      noneMean: none?.meanGrade ?? null,
      gradeGap: soc && none ? Number((soc.meanGrade - none.meanGrade).toFixed(2)) : null,
    };
  });

  let gitRev = 'unknown';
  try {
    gitRev = execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    /* not a git checkout */
  }
  const artifact = {
    generated: new Date().toISOString(),
    scorer: 'omniscient-critic-graded',
    rubric: 'notes/poetics/oedipus-discovery-grade-rubric.md (0-4)',
    critic_source: args.mock ? 'mock' : 'api/openrouter',
    git_commit: gitRev,
    roots: args.roots.map((r) => path.relative(ROOT, r)),
    spec: path.relative(ROOT, args.spec),
    panel: args.mock ? args.panel.map((m) => `${m}-mock`) : args.panel,
    cells,
    gaps,
    scored,
  };
  const outPath =
    args.out ||
    path.join(ROOT, 'exports', `graded-critic-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

  console.log(`\n== Graded omniscient critic (0–4) · panel=${args.mock ? 'mock' : args.panel.join(',')} ==`);
  for (const c of cells.sort((a, b) => (a.dramaId + a.arm).localeCompare(b.dramaId + b.arm))) {
    console.log(
      `  ${c.dramaId.padEnd(8)} ${c.arm.padEnd(9)} n=${c.n}  mean=${c.meanGrade.toFixed(2)} median=${c.medianGrade}  grades=[${c.grades.join(',')}]  interRaterSpread=${c.meanInterRaterSpread}`,
    );
  }
  console.log(`\n  -- socratic − none gap (the graded lift) --`);
  for (const g of gaps)
    console.log(`  ${g.dramaId}: socratic ${g.socraticMean} vs none ${g.noneMean}  →  gap=${g.gradeGap}`);
  console.log(
    `\n  interRaterSpread is the avg band width across the 4 blind judges (0 = unanimous band; ≤1 = near-vs-far is reliably judgeable).`,
  );
  console.log(`  wrote ${path.relative(ROOT, outPath)}\n`);
  return artifact;
}

if (path.resolve(process.argv[1] || '') === __filename) {
  run(parseArgs(process.argv.slice(2))).catch((err) => {
    console.error(err?.stack || String(err));
    process.exit(1);
  });
}

export { parseArgs, buildGradedPrompt, coerceGraded, mockGraded, run };
