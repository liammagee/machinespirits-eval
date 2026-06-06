#!/usr/bin/env node
/**
 * A18.37 S0-stability harness.
 *
 * The A18.37 cross-family fanout established that "headroom" (S1-with-policy
 * reaches the registered target while S0-without-policy does not) is a PER-CARD
 * property, observed at n=1 S0 + n=1 S1 per card. The mechanistic reading is
 * teacher-side: headroom appears when the fresh no-policy tutor fails to
 * spontaneously re-derive the registered relation and rationalises a surface
 * shortcut instead (claim boundary: simulated_teacher_as_learner_not_human_learning).
 *
 * That reading makes a sharp, falsifiable prediction this harness tests:
 * if the per-card outcome is STRUCTURAL, rerunning the identical S0 path k times
 * should give a stable verdict per card (a no-headroom card self-solves on most
 * reruns; a headroom card rationalises a shortcut on most reruns). If instead
 * both cards flip ~50/50, "headroom" is partly a stochastic teacher coin-flip
 * and the per-card predictor is illusory.
 *
 * It reruns the EXACT a18.8_s0_hard_bounded_transfer ablation (same flags as
 * run-a18-family-local-screen.js ablateSibling) k times into seeded out-dirs,
 * then runs the architecture-independent blind-option arbiter on every S0 and
 * S1 continuation. Resumable: a seed whose report + blind output already exist
 * is skipped unless --force. Paid steps run sequentially (blocking execFileSync)
 * to respect the shared-quota discipline.
 *
 * Usage:
 *   node scripts/a18.37-s0-stability.js \
 *     --chain-dir exports/recursive-tutor-learning/a18.35-distal-correspondence-local \
 *     --family distal_correspondence_priority \
 *     --sibling distal_holdout_blue_upper \
 *     --k 3 \
 *     --target-aliases "upper neri|upper lane|rust-headed lane" \
 *     --decoy-aliases "lower neri|lower lane" \
 *     --option-space "upper lane | lower lane" --token "neri" \
 *     --answer-noun "neri that can support the final tag" \
 *     --out exports/recursive-tutor-learning/a18.35-distal-correspondence-local/a18.37-stability/distal_holdout_blue_upper.stability.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = {
    chainDir: null,
    family: null,
    sibling: null,
    k: 3,
    generator: 'claude',
    checker: 'claude',
    critics: 3,
    targetAliases: null,
    decoyAliases: null,
    optionSpace: null,
    token: null,
    answerNoun: null,
    out: null,
    stepTimeoutMs: 600000,
    force: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === '--help' || t === '-h') args.help = true;
    else if (t === '--chain-dir') args.chainDir = path.resolve(argv[++i]);
    else if (t === '--family') args.family = argv[++i];
    else if (t === '--sibling') args.sibling = argv[++i];
    else if (t === '--k') args.k = Number(argv[++i]);
    else if (t === '--generator') args.generator = argv[++i];
    else if (t === '--checker') args.checker = argv[++i];
    else if (t === '--critics') args.critics = Number(argv[++i]);
    else if (t === '--target-aliases') args.targetAliases = argv[++i];
    else if (t === '--decoy-aliases') args.decoyAliases = argv[++i];
    else if (t === '--option-space') args.optionSpace = argv[++i];
    else if (t === '--token') args.token = argv[++i];
    else if (t === '--answer-noun') args.answerNoun = argv[++i];
    else if (t === '--out') args.out = path.resolve(argv[++i]);
    else if (t === '--step-timeout-ms') args.stepTimeoutMs = Number(argv[++i]);
    else if (t === '--force') args.force = true;
  }
  if (args.help) return args;
  for (const req of ['chainDir', 'family', 'sibling', 'targetAliases', 'decoyAliases']) {
    if (!args[req]) throw new Error(`--${req.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())} is required`);
  }
  if (!args.out) {
    args.out = path.join(args.chainDir, 'a18.37-stability', `${args.sibling}.stability.json`);
  }
  return args;
}

function runNode(scriptArgs, { timeoutMs }) {
  try {
    const stdout = execFileSync('node', scriptArgs, {
      cwd: ROOT,
      timeout: timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    return { ok: true, stdout };
  } catch (err) {
    return { ok: false, error: err.message, stdout: err.stdout ? String(err.stdout) : '' };
  }
}

// Mirrors run-a18-family-local-screen.js ablateSibling EXACTLY so each rerun
// samples the identical S0/S1 generation path. Only --out-dir varies (per seed).
function runAblation(args, outDir) {
  return runNode(
    [
      'scripts/run-recursive-tutor-policy-ablation.js',
      '--chain-dir',
      args.chainDir,
      '--family',
      args.family,
      '--sibling',
      args.sibling,
      '--generator',
      args.generator,
      '--checker',
      args.checker,
      '--fresh-s1',
      '--bounded-continuation',
      '--bounded-max-added-lines',
      '6',
      '--inner-max-chars',
      '0',
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
}

function findRevisedPublic(outDir, sibling, arm) {
  // arm: 'S0-no-policy-replay' | 'S1-policy-memory-replay'
  if (!fs.existsSync(outDir)) return null;
  const armDir = fs.readdirSync(outDir).find((d) => d.endsWith(`__${arm}`));
  if (!armDir) return null;
  const heldoutDir = path.join(outDir, armDir, `${sibling}.heldout.full`);
  const txt = path.join(heldoutDir, 'revised-public.txt');
  return fs.existsSync(txt) ? txt : null;
}

function runBlind(args, s0Txt, s1Txt, blindOut, runId) {
  const a = [
    'scripts/blind-option-adjudication.js',
    '--s0',
    s0Txt,
    '--s1',
    s1Txt,
    '--target-aliases',
    args.targetAliases,
    '--decoy-aliases',
    args.decoyAliases,
    '--critics',
    String(args.critics),
    '--run-id',
    runId,
    '--out',
    blindOut,
  ];
  if (args.optionSpace) a.push('--option-space', args.optionSpace);
  if (args.token) a.push('--token', args.token);
  if (args.answerNoun) a.push('--answer-noun', args.answerNoun);
  return runNode(a, { timeoutMs: args.stepTimeoutMs });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write('See header comment for usage.\n');
    return;
  }
  const stabilityRoot = path.join(args.chainDir, 'a18.37-stability');
  fs.mkdirSync(stabilityRoot, { recursive: true });
  fs.mkdirSync(path.dirname(args.out), { recursive: true });

  const seeds = [];
  for (let seed = 1; seed <= args.k; seed += 1) {
    const outDir = path.join(stabilityRoot, `${args.sibling}.seed${seed}`);
    const reportPath = path.join(outDir, 'a18.8-s0-hard-bounded-transfer-report.json');
    const blindOut = path.join(outDir, 'a18.37-blind-option.json');

    // Step 1: ablation (paid) — skip if report already present (resume).
    if (!fs.existsSync(reportPath) || args.force) {
      process.stdout.write(
        `\n[stability] seed ${seed}/${args.k}: ablation ${args.sibling} -> ${path.relative(ROOT, outDir)}\n`,
      );
      const res = runAblation(args, outDir);
      if (!res.ok || !fs.existsSync(reportPath)) {
        process.stdout.write(
          `[stability] seed ${seed}: ablation FAILED (${res.error || 'no report'}). Stopping; rerun to resume.\n`,
        );
        break;
      }
    } else {
      process.stdout.write(`[stability] seed ${seed}/${args.k}: ablation cached\n`);
    }

    const s0Txt = findRevisedPublic(outDir, args.sibling, 'S0-no-policy-replay');
    const s1Txt = findRevisedPublic(outDir, args.sibling, 'S1-policy-memory-replay');
    if (!s0Txt || !s1Txt) {
      process.stdout.write(
        `[stability] seed ${seed}: missing revised-public (s0=${!!s0Txt} s1=${!!s1Txt}). Stopping.\n`,
      );
      break;
    }

    // Step 2: blind arbiter (paid) — skip if already adjudicated (resume).
    if (!fs.existsSync(blindOut) || args.force) {
      process.stdout.write(`[stability] seed ${seed}/${args.k}: blind adjudication\n`);
      const res = runBlind(args, s0Txt, s1Txt, blindOut, `a18.37-stability-${args.sibling}-seed${seed}`);
      if (!res.ok || !fs.existsSync(blindOut)) {
        process.stdout.write(
          `[stability] seed ${seed}: blind FAILED (${res.error || 'no output'}). Stopping; rerun to resume.\n`,
        );
        break;
      }
    } else {
      process.stdout.write(`[stability] seed ${seed}/${args.k}: blind cached\n`);
    }

    const blind = JSON.parse(fs.readFileSync(blindOut, 'utf8'));
    seeds.push({
      seed,
      s0_committed_option: blind.arms.S0_no_policy.committed_option.value,
      s0_class: blind.arms.S0_no_policy.matched_class.value,
      s0_basis: blind.arms.S0_no_policy.reasoning_basis.value,
      s1_committed_option: blind.arms.S1_policy_memory.committed_option.value,
      s1_class: blind.arms.S1_policy_memory.matched_class.value,
      s1_basis: blind.arms.S1_policy_memory.reasoning_basis.value,
      verdict: blind.verdict,
      out_dir: path.relative(ROOT, outDir),
    });
  }

  const n = seeds.length;
  const s0Target = seeds.filter((s) => s.s0_class === 'target').length;
  const s1Target = seeds.filter((s) => s.s1_class === 'target').length;
  const headroom = seeds.filter((s) => s.verdict === 'policy_memory_option_advantage').length;
  const tally = {
    schema_version: 'a18.37-s0-stability-v1',
    channel: 'architecture_independent_blind_factual_extraction',
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    chain_dir: path.relative(ROOT, args.chainDir),
    family_id: args.family,
    sibling_id: args.sibling,
    k_requested: args.k,
    k_completed: n,
    s0_self_solve_rate: n ? Number((s0Target / n).toFixed(3)) : null,
    s1_target_rate: n ? Number((s1Target / n).toFixed(3)) : null,
    headroom_rate: n ? Number((headroom / n).toFixed(3)) : null,
    interpretation:
      n < 2
        ? 'insufficient_seeds'
        : s0Target >= Math.ceil(n * 0.67)
          ? 'stable_no_headroom (S0 reliably self-solves)'
          : s0Target <= Math.floor(n * 0.33)
            ? 'stable_headroom (S0 reliably rationalises a shortcut)'
            : 'unstable (S0 outcome flips across reruns -> stochastic teacher coin-flip)',
    seeds,
  };
  fs.writeFileSync(args.out, JSON.stringify(tally, null, 2));

  process.stdout.write('\n========== A18.37 S0-STABILITY ==========\n');
  process.stdout.write(`family=${args.family} sibling=${args.sibling} k=${n}/${args.k}\n`);
  for (const s of seeds) {
    process.stdout.write(
      `  seed ${s.seed}: S0 "${s.s0_committed_option}" [${s.s0_class}/${s.s0_basis}]  |  S1 "${s.s1_committed_option}" [${s.s1_class}/${s.s1_basis}]  -> ${s.verdict}\n`,
    );
  }
  process.stdout.write(
    `S0 self-solve rate = ${tally.s0_self_solve_rate}  |  S1 target rate = ${tally.s1_target_rate}  |  headroom rate = ${tally.headroom_rate}\n`,
  );
  process.stdout.write(`INTERPRETATION: ${tally.interpretation}\n`);
  process.stdout.write(`tally: ${path.relative(ROOT, args.out)}\n`);
}

main();
