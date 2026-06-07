#!/usr/bin/env node
/**
 * A19 local stability harness.
 *
 * Reruns selected held-out teaching-drama axiom cards through the same S0/S1
 * replay discipline used by the local A19 screens:
 *   - S0: no policy memory
 *   - S1: exactly one admitted axiom memory
 *   - blind free-text repair extraction with aliases withheld
 *
 * The harness is intentionally local and scope-bound. It does not report a
 * pooled A19 rate, human learning, deployment, or weight-level learning.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'teaching-drama-axioms', 'pilot-families.yaml');
const DEFAULT_PROTOCOL = path.join(ROOT, 'config', 'teaching-drama-axioms', 'a19-protocol.yaml');

function usage() {
  return `Usage:
  node scripts/run-a19-stability-screen.js \\
    --family-id surface_agreement_uptake \\
    --sibling-id surface_agreement_uptake_c --sibling-id surface_agreement_uptake_e \\
    --materialized-root exports/a19/materialized-attempts-v5 \\
    --axiom exports/a19/axioms/surface-agreement-uptake/axiom.json \\
    [--k 2] [--critics 1] [--generator codex] [--checker claude] [--force]
`;
}

function splitList(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function dashId(id) {
  return String(id || '').replaceAll('_', '-');
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    config: DEFAULT_CONFIG,
    protocol: DEFAULT_PROTOCOL,
    familyId: null,
    siblingIds: [],
    materializedRoot: path.join(ROOT, 'exports', 'a19', 'materialized-attempts-v5'),
    axiom: null,
    outDir: null,
    k: 2,
    generator: 'codex',
    checker: 'claude',
    critics: 1,
    stepTimeoutMs: 600_000,
    force: false,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--config') args.config = path.resolve(argv[++i]);
    else if (token === '--protocol') args.protocol = path.resolve(argv[++i]);
    else if (token === '--family-id') args.familyId = argv[++i];
    else if (token === '--sibling-id') args.siblingIds.push(...splitList(argv[++i]));
    else if (token === '--materialized-root') args.materializedRoot = path.resolve(argv[++i]);
    else if (token === '--axiom') args.axiom = path.resolve(argv[++i]);
    else if (token === '--out-dir') args.outDir = path.resolve(argv[++i]);
    else if (token === '--k') args.k = Number(argv[++i]);
    else if (token === '--generator') args.generator = argv[++i];
    else if (token === '--checker') args.checker = argv[++i];
    else if (token === '--critics') args.critics = Number(argv[++i]);
    else if (token === '--step-timeout-ms') args.stepTimeoutMs = Number(argv[++i]);
    else if (token === '--force') args.force = true;
    else if (token === '--dry-run') args.dryRun = true;
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }

  if (args.help) return args;
  if (!args.familyId) throw new Error(`--family-id is required\n\n${usage()}`);
  if (!args.siblingIds.length) throw new Error(`at least one --sibling-id is required\n\n${usage()}`);
  if (!Number.isInteger(args.k) || args.k < 1) throw new Error('--k must be a positive integer');
  if (!Number.isInteger(args.critics) || args.critics < 1) throw new Error('--critics must be a positive integer');
  args.outDir = args.outDir || path.join(ROOT, 'exports', 'a19', 'stability', dashId(args.familyId));
  args.axiom = args.axiom || path.join(ROOT, 'exports', 'a19', 'axioms', dashId(args.familyId), 'axiom.json');
  return args;
}

function repoRel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

function loadYaml(filePath) {
  return yaml.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeRepairType(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function cardSpecsFromConfig(config, { familyId, siblingIds, materializedRoot, axiom }) {
  const family = config.families?.find((entry) => entry.family_id === familyId);
  if (!family) throw new Error(`family not found: ${familyId}`);
  const siblingSet = new Set(siblingIds);
  const selected = family.heldout_siblings?.filter((sibling) => siblingSet.has(sibling.sibling_id)) || [];
  if (selected.length !== siblingIds.length) {
    const found = new Set(selected.map((sibling) => sibling.sibling_id));
    const missing = siblingIds.filter((siblingId) => !found.has(siblingId));
    throw new Error(`sibling not found: ${missing.join(', ')}`);
  }

  const targetPolicyId = family.target_policy?.policy_id;
  const decoyRepairTypes = (family.plausible_repairs || [])
    .filter((repair) => repair !== targetPolicyId)
    .map(normalizeRepairType)
    .join('|');

  return selected.map((sibling) => ({
    family_id: family.family_id,
    sibling_id: sibling.sibling_id,
    transcript: path.join(materializedRoot, dashId(family.family_id), dashId(sibling.sibling_id), 'heldout-base.full.md'),
    axiom,
    target_aliases: sibling.target_aliases || [],
    decoy_aliases: sibling.decoy_aliases || [],
    target_repair_type: family.target_policy?.repair_type,
    decoy_repair_types: decoyRepairTypes,
    option_space: sibling.blind_adjudication?.neutral_option_space || 'repair A | repair B | repair C',
  }));
}

function runNode(scriptArgs, { timeoutMs, dryRun }) {
  const commandText = `node ${scriptArgs.map((arg) => JSON.stringify(arg)).join(' ')}`;
  if (dryRun) return { ok: true, stdout: commandText, commandText };
  try {
    const stdout = execFileSync('node', scriptArgs, {
      cwd: ROOT,
      timeout: timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    return { ok: true, stdout, commandText };
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      stdout: err.stdout ? String(err.stdout) : '',
      commandText,
    };
  }
}

function replayOutPath(seedDir, arm) {
  return path.join(seedDir, `${arm}-replay`, 'heldout-base.full', 'revised-public.txt');
}

function replayArgs(card, seedDir, args, arm) {
  const scriptArgs = [
    'scripts/replay-discursive-transcript.js',
    '--transcript',
    card.transcript,
    '--generator',
    args.generator,
    '--checker',
    args.checker,
    '--recursive-tutor-learning-gate',
    '--out-dir',
    path.join(seedDir, `${arm}-replay`),
  ];
  if (arm === 's1') scriptArgs.push('--policy-memory', card.axiom);
  if (args.force) scriptArgs.push('--force');
  return scriptArgs;
}

function blindArgs(card, seedDir, args, runId) {
  return [
    'scripts/blind-teaching-drama-axiom-adjudication.js',
    '--free-text',
    '--s0',
    replayOutPath(seedDir, 's0'),
    '--s1',
    replayOutPath(seedDir, 's1'),
    '--target-aliases',
    card.target_aliases.join('|'),
    '--decoy-aliases',
    card.decoy_aliases.join('|'),
    '--target-repair-type',
    card.target_repair_type,
    '--decoy-repair-types',
    card.decoy_repair_types,
    '--option-space',
    card.option_space,
    '--family-id',
    card.family_id,
    '--sibling-id',
    card.sibling_id,
    '--critics',
    String(args.critics),
    '--run-id',
    runId,
    '--out',
    path.join(seedDir, 'blind-adjudication.free-text.json'),
  ];
}

function maybeRunReplay(card, seedDir, args, arm) {
  const revisedPublic = replayOutPath(seedDir, arm);
  if (fs.existsSync(revisedPublic) && !args.force) {
    return { ok: true, cached: true, path: revisedPublic };
  }
  const res = runNode(replayArgs(card, seedDir, args, arm), {
    timeoutMs: args.stepTimeoutMs,
    dryRun: args.dryRun,
  });
  return { ...res, cached: false, path: revisedPublic };
}

function maybeRunBlind(card, seedDir, args, seed) {
  const out = path.join(seedDir, 'blind-adjudication.free-text.json');
  if (fs.existsSync(out) && !args.force) return { ok: true, cached: true, path: out };
  const runId = `a19-stability-${dashId(card.sibling_id)}-seed${seed}`;
  const res = runNode(blindArgs(card, seedDir, args, runId), {
    timeoutMs: args.stepTimeoutMs,
    dryRun: args.dryRun,
  });
  return { ...res, cached: false, path: out };
}

function readBlindResult(outPath) {
  const json = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  return {
    run_id: json.run_id,
    card_verdict: json.card_verdict,
    s0_class: json.arms?.s0?.committed_option_class || null,
    s0_repair_type: json.arms?.s0?.repair_type || null,
    s0_basis_label: json.arms?.s0?.basis_label || null,
    s1_class: json.arms?.s1?.committed_option_class || null,
    s1_repair_type: json.arms?.s1?.repair_type || null,
    s1_basis_label: json.arms?.s1?.basis_label || null,
    critics_per_arm: json.critics_per_arm,
  };
}

export function summarizeCardResults(card, seeds) {
  const completed = seeds.filter((seed) => seed.status === 'complete');
  const k = completed.length;
  const count = (predicate) => completed.filter(predicate).length;
  const headroom = count((seed) => seed.card_verdict === 'policy_headroom');
  const s0Target = count((seed) => seed.s0_class === 'target');
  const s1Target = count((seed) => seed.s1_class === 'target');
  const interpretation =
    k < 2
      ? 'insufficient_seeds'
      : headroom === k
        ? 'stable_policy_headroom'
        : s0Target === k
          ? 'stable_s0_self_solve_or_ceiling'
          : headroom === 0
            ? 'no_stable_headroom'
            : 'mixed_unstable';

  return {
    family_id: card.family_id,
    sibling_id: card.sibling_id,
    k_completed: k,
    policy_headroom_count: headroom,
    s0_target_count: s0Target,
    s1_target_count: s1Target,
    policy_headroom_rate: k ? Number((headroom / k).toFixed(3)) : null,
    s0_target_rate: k ? Number((s0Target / k).toFixed(3)) : null,
    s1_target_rate: k ? Number((s1Target / k).toFixed(3)) : null,
    interpretation,
    seeds,
  };
}

function renderMarkdown(summary) {
  const lines = [
    '# A19 Stability Screen',
    '',
    `Run ID: \`${summary.run_id}\`.`,
    `Created: ${summary.created_at}.`,
    '',
    '## Boundary',
    '',
    'Local simulated teacher-as-learner replay only. No pooled A19 rate, human-learning claim, deployed-tutor claim, model-weight-learning claim, or main-harness effect is licensed.',
    '',
    '## Cards',
    '',
  ];
  for (const card of summary.cards) {
    lines.push(
      `### \`${card.sibling_id}\``,
      '',
      `- Completed seeds: ${card.k_completed}.`,
      `- Policy-headroom seeds: ${card.policy_headroom_count}/${card.k_completed}.`,
      `- S0 target seeds: ${card.s0_target_count}/${card.k_completed}.`,
      `- S1 target seeds: ${card.s1_target_count}/${card.k_completed}.`,
      `- Interpretation: \`${card.interpretation}\`.`,
      '',
    );
    for (const seed of card.seeds) {
      lines.push(
        `- Seed ${seed.seed}: \`${seed.card_verdict || seed.status}\`; S0=\`${seed.s0_class || 'n/a'}\`/${seed.s0_repair_type || 'n/a'}; S1=\`${seed.s1_class || 'n/a'}\`/${seed.s1_repair_type || 'n/a'}; artifact \`${seed.out_dir}\`.`,
      );
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

export async function runStability(args) {
  const config = loadYaml(args.config);
  const cards = cardSpecsFromConfig(config, args);
  fs.mkdirSync(args.outDir, { recursive: true });

  const cardSummaries = [];
  for (const card of cards) {
    if (!fs.existsSync(card.transcript)) throw new Error(`materialized transcript not found: ${card.transcript}`);
    if (!fs.existsSync(card.axiom)) throw new Error(`axiom memory not found: ${card.axiom}`);
    const seeds = [];
    for (let seed = 1; seed <= args.k; seed += 1) {
      const seedDir = path.join(args.outDir, dashId(card.sibling_id), `seed${seed}`);
      fs.mkdirSync(seedDir, { recursive: true });
      process.stdout.write(`\n[a19-stability] ${card.sibling_id} seed ${seed}/${args.k}: S0 replay\n`);
      const s0 = maybeRunReplay(card, seedDir, args, 's0');
      if (!s0.ok || (!args.dryRun && !fs.existsSync(s0.path))) {
        seeds.push({ seed, status: 's0_failed', error: s0.error || 'missing revised-public', out_dir: repoRel(seedDir) });
        break;
      }
      process.stdout.write(`[a19-stability] ${card.sibling_id} seed ${seed}/${args.k}: S1 replay\n`);
      const s1 = maybeRunReplay(card, seedDir, args, 's1');
      if (!s1.ok || (!args.dryRun && !fs.existsSync(s1.path))) {
        seeds.push({ seed, status: 's1_failed', error: s1.error || 'missing revised-public', out_dir: repoRel(seedDir) });
        break;
      }
      process.stdout.write(`[a19-stability] ${card.sibling_id} seed ${seed}/${args.k}: blind adjudication\n`);
      const blind = maybeRunBlind(card, seedDir, args, seed);
      if (!blind.ok || (!args.dryRun && !fs.existsSync(blind.path))) {
        seeds.push({ seed, status: 'blind_failed', error: blind.error || 'missing blind output', out_dir: repoRel(seedDir) });
        break;
      }
      if (args.dryRun) {
        seeds.push({ seed, status: 'dry_run', out_dir: repoRel(seedDir) });
      } else {
        seeds.push({
          seed,
          status: 'complete',
          ...readBlindResult(blind.path),
          out_dir: repoRel(seedDir),
        });
      }
    }
    cardSummaries.push(summarizeCardResults(card, seeds));
  }

  const summary = {
    schema_version: 'a19-stability-screen-v0.1',
    run_id: `a19-stability-${dashId(args.familyId)}-${new Date().toISOString().slice(0, 10)}`,
    created_at: new Date().toISOString(),
    family_id: args.familyId,
    k_requested: args.k,
    critics_per_arm: args.critics,
    generator: args.generator,
    checker: args.checker,
    materialized_root: repoRel(args.materializedRoot),
    axiom: repoRel(args.axiom),
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    non_claims: [
      'pooled_a19_rate',
      'human_learning',
      'deployed_adaptive_tutor',
      'model_weight_learning',
      'main_harness_rate_effect',
    ],
    cards: cardSummaries,
  };

  const jsonOut = path.join(args.outDir, 'a19-stability-summary.json');
  const mdOut = path.join(args.outDir, 'a19-stability-summary.md');
  if (!args.dryRun) {
    fs.writeFileSync(jsonOut, `${JSON.stringify(summary, null, 2)}\n`);
    fs.writeFileSync(mdOut, renderMarkdown(summary));
  }
  return { summary, jsonOut, mdOut };
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return;
  }
  const { summary, jsonOut, mdOut } = await runStability(args);
  process.stdout.write('\n========== A19 STABILITY ==========\n');
  for (const card of summary.cards) {
    process.stdout.write(
      `${card.sibling_id}: ${card.policy_headroom_count}/${card.k_completed} headroom, S0 target ${card.s0_target_count}/${card.k_completed}, interpretation=${card.interpretation}\n`,
    );
  }
  if (!args.dryRun) {
    process.stdout.write(`summary: ${repoRel(jsonOut)}\n`);
    process.stdout.write(`markdown: ${repoRel(mdOut)}\n`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`${err.stack || err.message}\n`);
    process.exit(1);
  });
}
