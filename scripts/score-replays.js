#!/usr/bin/env node
/*
 * Graded-score a directory of one-side replay transcripts (replay-*.txt from
 * scripts/replay-one-side.js) and report the grade DISTRIBUTION on the 0–4 ladder.
 * The distribution is the answer to "structural cap vs learner draw": a tight cluster
 * (e.g. all ~2) means the frozen scene caps the learner at the genus; a bimodal spread
 * (some 2, some 4) means the near-miss was a learner draw the scene sometimes resolves.
 *
 * Usage:
 *   node scripts/score-replays.js exports/replay-d5-run3-socratic \
 *     --spec config/poetics-calibration/oedipus-pilot-v2.yaml --scenario D_OED5 [--mock]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { buildGradedPrompt, coerceGraded, mockGraded } from './critic-poetics-omniscient-graded.js';
import { callModel, parseJsonResponse, runWithConcurrency, withScorerRetry } from './score-poetics-calibration.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_PANEL = ['qwen/qwen3.7-max', 'google/gemini-3.5-flash', 'deepseek/deepseek-v4-pro', 'gpt'];

function parseArgs(argv) {
  const a = { dir: null, spec: null, scenario: null, panel: [...DEFAULT_PANEL], mock: false, out: null };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--spec') a.spec = path.resolve(argv[++i]);
    else if (t === '--scenario') a.scenario = argv[++i];
    else if (t === '--panel')
      a.panel = String(argv[++i])
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    else if (t === '--mock') a.mock = true;
    else if (t === '--out') a.out = path.resolve(argv[++i]);
    else if (!t.startsWith('--')) a.dir = path.resolve(t);
  }
  if (!a.dir) throw new Error('replay dir (containing replay-*.txt) is required');
  if (!a.spec) throw new Error('--spec is required');
  if (!a.scenario) throw new Error('--scenario is required');
  return a;
}

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (xs) => (xs.length ? xs.reduce((x, y) => x + y, 0) / xs.length : null);

async function run(args) {
  const spec = yaml.parse(fs.readFileSync(args.spec, 'utf8'));
  const d = (spec.dramas || spec.scenarios || []).find((x) => x.id === args.scenario);
  if (!d?.secret?.fact) throw new Error(`scenario ${args.scenario} has no secret.fact in ${args.spec}`);
  const fact = d.secret.fact;

  const files = fs
    .readdirSync(args.dir)
    .filter((f) => /^replay-\d+\.txt$/.test(f))
    .sort((x, y) => parseInt(x.match(/\d+/)[0], 10) - parseInt(y.match(/\d+/)[0], 10));
  if (!files.length) throw new Error(`no replay-*.txt files in ${args.dir}`);

  const scored = [];
  for (const f of files) {
    const transcript = fs.readFileSync(path.join(args.dir, f), 'utf8');
    let votes;
    if (args.mock) {
      votes = args.panel.map((model) => ({ model, vote: mockGraded('socratic') }));
    } else {
      const prompt = buildGradedPrompt(transcript, fact);
      votes = await runWithConcurrency(
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
    const grades = votes.filter((v) => v.vote && !v.error).map((v) => v.vote.attainment);
    scored.push({
      file: f,
      grade: median(grades),
      panel: grades,
      spread: grades.length ? Math.max(...grades) - Math.min(...grades) : null,
    });
  }

  const itemGrades = scored.map((s) => s.grade).filter((g) => g != null);
  const hist = [0, 0, 0, 0, 0];
  for (const g of itemGrades) hist[Math.round(g)] += 1;

  const summary = {
    scenario: args.scenario,
    dir: path.relative(ROOT, args.dir),
    n: itemGrades.length,
    meanGrade: itemGrades.length ? Number(mean(itemGrades).toFixed(2)) : null,
    medianGrade: median(itemGrades),
    min: itemGrades.length ? Math.min(...itemGrades) : null,
    max: itemGrades.length ? Math.max(...itemGrades) : null,
    histogram: { 0: hist[0], 1: hist[1], 2: hist[2], 3: hist[3], 4: hist[4] },
    meanInterRaterSpread: scored.length
      ? Number(mean(scored.map((s) => s.spread).filter((x) => x != null)).toFixed(2))
      : null,
    scored,
  };
  const outPath = args.out || path.join(args.dir, 'graded-replays.json');
  fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(`\n== graded replay distribution · ${args.scenario} · n=${summary.n} ==`);
  console.log(`  grades: [${itemGrades.join(', ')}]`);
  console.log(
    `  mean=${summary.meanGrade} median=${summary.medianGrade} range=[${summary.min}, ${summary.max}] interRaterSpread=${summary.meanInterRaterSpread}`,
  );
  console.log(`  histogram  0:${hist[0]}  1:${hist[1]}  2:${hist[2]}  3:${hist[3]}  4:${hist[4]}`);
  const spread = summary.max != null ? summary.max - summary.min : null;
  console.log(
    `\n  read: ${spread === 0 ? 'UNANIMOUS band → structural cap' : spread <= 1 ? 'tight cluster → mostly structural' : 'wide/bimodal → learner draw the scene sometimes resolves'}`,
  );
  console.log(`  wrote ${path.relative(ROOT, outPath)}\n`);
  return summary;
}

if (path.resolve(process.argv[1] || '') === __filename) {
  run(parseArgs(process.argv.slice(2))).catch((err) => {
    console.error(err?.stack || String(err));
    process.exit(1);
  });
}

export { parseArgs, run };
