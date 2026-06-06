#!/usr/bin/env node
/**
 * A18.37 per-family local-screen orchestrator (replication fanout).
 *
 * Drives ONE already-materialized A18.35 family through the decisive local
 * screen and emits a single convergence verdict, idempotently:
 *
 *   1. attempt-1 replay         (PAID, generator/checker backend) — elicitation gate
 *   2. fill-recursive-tutor-policy (zero-API) — fills policy only for survivors
 *   3. S0/S1 bounded ablation per held-out sibling (PAID) — headroom gate
 *   4. relaxed correctness rescore (zero-API) — un-masks lexical false negatives
 *
 * A family CONVERGES locally iff every held-out sibling shows policy-distinct
 * S0/S1 separation AND a relaxed policy-memory correctness advantage (S0 wrong,
 * S1 right). This mirrors the relational_betweenness convergence read exactly
 * (A18.36), so the rate across families is comparable.
 *
 * Steps are skipped when their outputs already exist (unless --force), so a
 * quota-interrupted run resumes cleanly. Each family's verdict is appended as
 * one JSONL line to --results.
 *
 * Usage:
 *   node scripts/run-a18-family-local-screen.js \
 *     --chain-dir exports/recursive-tutor-learning/a18.35-count-ladder-successor-local \
 *     [--generator claude] [--checker claude] \
 *     [--results exports/recursive-tutor-learning/a18.37-replication-fanout/results.jsonl] \
 *     [--attempt1-only] [--force] [--step-timeout-ms 900000]
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

function rel(p) {
  return path.relative(ROOT, path.resolve(p));
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    chainDir: null,
    generator: 'claude',
    checker: 'claude',
    results: null,
    attempt1Only: false,
    force: false,
    stepTimeoutMs: 900000,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--chain-dir') args.chainDir = path.resolve(argv[++i]);
    else if (token === '--generator') args.generator = argv[++i];
    else if (token === '--checker') args.checker = argv[++i];
    else if (token === '--results') args.results = path.resolve(argv[++i]);
    else if (token === '--attempt1-only') args.attempt1Only = true;
    else if (token === '--force') args.force = true;
    else if (token === '--step-timeout-ms') args.stepTimeoutMs = Number(argv[++i]);
    else throw new Error(`unknown arg: ${token}`);
  }
  return args;
}

function runNode(scriptRelArgs, { timeoutMs }) {
  // Returns { stdout, ok, error }. Never throws on subprocess failure.
  try {
    const stdout = execFileSync('node', scriptRelArgs, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
    });
    return { stdout, ok: true, error: null };
  } catch (err) {
    return {
      stdout: err.stdout ? String(err.stdout) : '',
      ok: false,
      error: err.stderr ? String(err.stderr).slice(-2000) : String(err.message).slice(-2000),
    };
  }
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function planForChain(chainDir) {
  const planPath = path.join(chainDir, 'attempt-chain-plan.json');
  if (!fs.existsSync(planPath)) throw new Error(`attempt-chain-plan.json not found in ${chainDir}`);
  const plan = readJson(planPath);
  const fam = plan.families?.[0];
  if (!fam) throw new Error(`no family in plan ${planPath}`);
  return fam;
}

function attempt1(fam, args) {
  const outDir = path.join(fam.family_dir, 'attempt1-replay');
  const manifest = path.join(outDir, 'manifest.json');
  if (fs.existsSync(manifest) && !args.force) {
    return { ran: false, outDir: rel(outDir) };
  }
  const res = runNode(
    [
      'scripts/replay-discursive-transcript.js',
      '--transcript',
      fam.training_transcript,
      '--generator',
      args.generator,
      '--checker',
      args.checker,
      '--recursive-tutor-learning-gate',
      '--out-dir',
      outDir,
    ],
    { timeoutMs: args.stepTimeoutMs },
  );
  if (!res.ok) throw new Error(`attempt-1 replay failed: ${res.error}`);
  return { ran: true, outDir: rel(outDir) };
}

function fillPolicy(chainDir, familyId) {
  const reportPath = path.join(chainDir, 'policy-fill-report.json');
  const res = runNode(['scripts/fill-recursive-tutor-policy.js', '--chain-dir', chainDir, '--out', reportPath], {
    timeoutMs: 120000,
  });
  if (!res.ok) throw new Error(`policy fill failed: ${res.error}`);
  const report = readJson(reportPath);
  const row = (report.families || []).find((f) => f.family_id === familyId);
  return { filled: row?.status === 'filled', attempt1Status: row?.attempt1_status || 'unknown' };
}

function ablateSibling(chainDir, familyId, siblingId, args) {
  const outDir = path.join(chainDir, `a18.6-policy-ablation.${siblingId}`);
  const reportPath = path.join(outDir, 'a18.8-s0-hard-bounded-transfer-report.json');
  if (fs.existsSync(reportPath) && !args.force) {
    return { ran: false, reportPath };
  }
  const res = runNode(
    [
      'scripts/run-recursive-tutor-policy-ablation.js',
      '--chain-dir',
      chainDir,
      '--family',
      familyId,
      '--sibling',
      siblingId,
      '--generator',
      args.generator,
      '--checker',
      args.checker,
      '--fresh-s1',
      '--bounded-continuation',
      '--bounded-max-added-lines',
      '6',
      '--public-max-chars',
      '30000',
      '--policy-memory-max-chars',
      '18000',
      '--policy-contrast-gate',
      '--min-policy-distinctiveness',
      '0.12',
      '--skip-panel',
      '--out-dir',
      outDir,
      '--force',
    ],
    { timeoutMs: args.stepTimeoutMs },
  );
  if (!res.ok) throw new Error(`ablation (${siblingId}) failed: ${res.error}`);
  if (!fs.existsSync(reportPath)) throw new Error(`ablation (${siblingId}) wrote no report at ${rel(reportPath)}`);
  return { ran: true, reportPath };
}

function rescore(reportPaths) {
  const argv = ['scripts/rescore-recursive-tutor-correctness-relaxed.js'];
  for (const r of reportPaths) argv.push('--report', r);
  const res = runNode(argv, { timeoutMs: 120000 });
  if (!res.ok) throw new Error(`rescore failed: ${res.error}`);
  // rescore prints the report JSON to stdout (last JSON object).
  const start = res.stdout.indexOf('{');
  return JSON.parse(res.stdout.slice(start));
}

function screenFamily(args) {
  const startedAt = process.hrtime.bigint();
  const chainDir = args.chainDir;
  const fam = planForChain(chainDir);
  const familyId = fam.family_id;
  const verdict = {
    kind: 'a18_family_local_screen_verdict',
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    chain_dir: rel(chainDir),
    family_id: familyId,
    generator: args.generator,
    checker: args.checker,
    stage: null,
    attempt1_status: null,
    siblings: [],
    family_local_headroom_relaxed: false,
    corrected_false_negatives: 0,
  };

  attempt1(fam, args);
  const fill = fillPolicy(chainDir, familyId);
  verdict.attempt1_status = fill.attempt1Status;
  if (!fill.filled) {
    verdict.stage = 'attempt1_no_survivor';
    verdict.elapsed_s = Number(process.hrtime.bigint() - startedAt) / 1e9;
    return verdict;
  }
  if (args.attempt1Only) {
    verdict.stage = 'attempt1_survivor_ablation_skipped';
    verdict.elapsed_s = Number(process.hrtime.bigint() - startedAt) / 1e9;
    return verdict;
  }

  const reportPaths = [];
  for (const sib of fam.heldout) {
    const { reportPath } = ablateSibling(chainDir, familyId, sib.sibling_id, args);
    reportPaths.push(reportPath);
  }
  const rescored = rescore(reportPaths);
  verdict.stage = 'ablated';
  verdict.family_local_headroom_relaxed = !!rescored.summary?.family_local_headroom_relaxed;
  verdict.corrected_false_negatives = rescored.summary?.corrected_false_negatives || 0;
  verdict.siblings = (rescored.rows || []).map((r) => ({
    sibling_id: r.sibling_id,
    effective_local_verdict: r.raw_local_verdict,
    policy_contrast_verdict: r.policy_contrast?.verdict,
    distinctiveness: r.policy_contrast?.distinctiveness,
    strict_correctness_verdict: r.strict_correctness_verdict,
    relaxed_correctness_verdict: r.relaxed_correctness_verdict,
    lexical_false_negative_corrected: r.lexical_false_negative_corrected,
  }));
  verdict.elapsed_s = Number(process.hrtime.bigint() - startedAt) / 1e9;
  return verdict;
}

function main() {
  const args = parseArgs();
  if (args.help || !args.chainDir) {
    console.log(
      'Usage: node scripts/run-a18-family-local-screen.js --chain-dir <a18.35-X-local> [--generator claude] [--checker claude] [--results <jsonl>] [--attempt1-only] [--force]',
    );
    return;
  }
  let verdict;
  try {
    verdict = screenFamily(args);
  } catch (err) {
    verdict = {
      kind: 'a18_family_local_screen_verdict',
      chain_dir: rel(args.chainDir),
      stage: 'error',
      error: String(err.message).slice(-2000),
    };
  }
  if (args.results) {
    fs.mkdirSync(path.dirname(args.results), { recursive: true });
    fs.appendFileSync(args.results, `${JSON.stringify(verdict)}\n`, 'utf8');
  }
  console.log(JSON.stringify(verdict, null, 2));
  process.exitCode = verdict.stage === 'error' ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}

export { screenFamily, parseArgs };
