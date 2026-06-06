#!/usr/bin/env node
/**
 * A18.37 — survivor headroom on the architecture-independent channel.
 *
 * The two CONSTRUCTED-DEVICE families that PASSED attempt-1 elicitation
 * (second_in_constructed_order, constructed_midpoint) had their held-out
 * siblings already ablated (S0 no-policy vs S1 policy-memory continuations
 * exist on disk). The OVERLAY correctness channel scored "no headroom for
 * both" on all four cards — but the overlay is bidirectionally lexically
 * fragile (A18.37 mechanism note), so that verdict is untrusted.
 *
 * This driver re-adjudicates those four EXISTING continuations with the
 * blind-option arbiter (scripts/blind-option-adjudication.js) — the same
 * architecture-independent channel used for relational_betweenness and the
 * distal-correspondence split. No generation, no ablation: critic-only reads
 * of continuations that already exist. Sequential (never concurrent) so it is
 * safe on a shared Max-plan quota window. Resumable: a card whose --out JSON
 * already exists is skipped unless --force.
 *
 * Pre-registered predictions (from reading the continuations; the blind panel
 * is the trusted test):
 *   second_in_order  blue_lower  -> no_option_headroom        (leaky: lane shortcut lands on the runner-up target)
 *   second_in_order  gold_lower  -> policy_memory_option_advantage (S0 takes "highest load = capacity" decoy; overlay FALSE NEGATIVE)
 *   constructed_mid  plum_posts  -> policy_memory_option_advantage (S0 takes colour decoy; overlay FALSE NEGATIVE)
 *   constructed_mid  teal_pegs   -> no_option_headroom         (leaky: open-track shortcut lands on the midpoint target)
 *
 * Target/decoy aliases are answer-key-derived (second-lowest load = runner-up;
 * between-posts token = midpoint) per the registered cue-maps, NOT author
 * interpretation, and are held out from the critic. Alias design respects the
 * arbiter's token-subset matcher: blue_lower omits the bare "left" alias because
 * tokenize("inner-left") = {inner,left} would be spuriously hit by {left}.
 *
 * Usage:
 *   node scripts/a18.37-survivor-headroom.js [--critics 3] [--model M] [--force] [--mock]
 *     [--out exports/recursive-tutor-learning/a18.37-survivor-headroom/summary.json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const EXP = 'exports/recursive-tutor-learning';

function rel(p) {
  return path.relative(ROOT, path.resolve(p));
}

// Each card: where its existing S0/S1 continuations live + the held-out
// target/decoy alias sets + a neutral option-space shown to the critic.
const CARDS = [
  {
    family: 'second_in_constructed_order_priority',
    sibling: 'order_holdout_blue_lower',
    chainDir: `${EXP}/a18.35-second-in-order-local`,
    token: 'neri',
    answerNoun: 'neri that can carry the final tag',
    optionSpace: 'left tray | inner-left tray | inner-right tray | right tray',
    // target = runner-up of the built load order = second-lowest load = 4 = inner-left.
    targetAliases: 'inner-left|inner-left tray|inner-left neri',
    // bare "left" omitted: {left} would falsely match {inner,left}. inner-right / right are safe.
    decoyAliases: 'inner-right|inner-right tray|inner-right neri|right tray|right neri',
    predict: 'no_option_headroom',
  },
  {
    family: 'second_in_constructed_order_priority',
    sibling: 'order_holdout_gold_lower',
    chainDir: `${EXP}/a18.35-second-in-order-local`,
    token: 'ralo',
    answerNoun: 'ralo that can carry the final tag',
    optionSpace: 'crown tray | upper tray | lower tray | foot tray',
    // target = second-lowest load = 4 = lower.
    targetAliases: 'lower|lower tray|lower ralo',
    decoyAliases: 'crown|crown tray|crown ralo|upper|upper tray|upper ralo|foot|foot tray|foot ralo',
    predict: 'policy_memory_option_advantage',
  },
  {
    family: 'constructed_midpoint_priority',
    sibling: 'mid_holdout_plum_posts',
    chainDir: `${EXP}/a18.35-constructed-midpoint-local`,
    token: 'kelo',
    answerNoun: 'kelo that can carry the final plum badge',
    optionSpace: 'east-post kelo | clean-rail kelo | west-post kelo',
    // target = between-posts midpoint token = the clean-rail kelo.
    targetAliases: 'clean rail|clean-rail|rail kelo|between posts|between-posts|middle kelo',
    decoyAliases: 'east post|east-post|plum kelo|west post|west-post',
    predict: 'policy_memory_option_advantage',
  },
  {
    family: 'constructed_midpoint_priority',
    sibling: 'mid_holdout_teal_pegs',
    chainDir: `${EXP}/a18.35-constructed-midpoint-local`,
    token: 'naro',
    answerNoun: 'naro that can carry the final teal card',
    optionSpace: 'top-peg naro | open-track naro | base-peg naro',
    // target = between-pegs midpoint token = the open-track naro.
    targetAliases: 'open track|open-track|track naro|between pegs|between-pegs|middle naro',
    decoyAliases: 'top peg|top-peg|teal naro|base peg|base-peg',
    predict: 'no_option_headroom',
  },
];

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    critics: 3,
    model: null,
    force: false,
    mock: false,
    out: `${EXP}/a18.37-survivor-headroom/summary.json`,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === '--help' || t === '-h') args.help = true;
    else if (t === '--critics') args.critics = Number(argv[++i]);
    else if (t === '--model') args.model = argv[++i];
    else if (t === '--force') args.force = true;
    else if (t === '--mock') args.mock = true;
    else if (t === '--out') args.out = argv[++i];
    else throw new Error(`unknown arg: ${t}`);
  }
  return args;
}

function continuation(card, arm) {
  // arm: 'S0-no-policy-replay' | 'S1-policy-memory-replay'
  return path.join(
    ROOT,
    card.chainDir,
    `a18.6-policy-ablation.${card.sibling}`,
    `${card.family}__${card.sibling}__${arm}`,
    `${card.sibling}.heldout.full`,
    'revised-public.txt',
  );
}

function adjudicate(card, args) {
  const outDir = path.join(ROOT, card.chainDir, 'a18.37-survivor-headroom');
  const outPath = path.join(outDir, `${card.sibling}.blind-option.json`);
  if (fs.existsSync(outPath) && !args.force) {
    return { ran: false, report: JSON.parse(fs.readFileSync(outPath, 'utf8')) };
  }
  fs.mkdirSync(outDir, { recursive: true });
  const s0 = continuation(card, 'S0-no-policy-replay');
  const s1 = continuation(card, 'S1-policy-memory-replay');
  for (const p of [s0, s1]) {
    if (!fs.existsSync(p)) throw new Error(`missing continuation: ${rel(p)}`);
  }
  const argv = [
    'scripts/blind-option-adjudication.js',
    '--s0',
    s0,
    '--s1',
    s1,
    '--target-aliases',
    card.targetAliases,
    '--decoy-aliases',
    card.decoyAliases,
    '--option-space',
    card.optionSpace,
    '--token',
    card.token,
    '--answer-noun',
    card.answerNoun,
    '--critics',
    String(args.critics),
    '--out',
    outPath,
    '--run-id',
    `a18.37-survivor-${card.sibling}`,
  ];
  if (args.model) argv.push('--model', args.model);
  if (args.mock) argv.push('--mock');
  execFileSync('node', argv, { cwd: ROOT, stdio: 'inherit', timeout: 60 * 60 * 1000 });
  return { ran: true, report: JSON.parse(fs.readFileSync(outPath, 'utf8')) };
}

function main() {
  const args = parseArgs();
  if (args.help) {
    console.log(
      'Usage: node scripts/a18.37-survivor-headroom.js [--critics 3] [--model M] [--force] [--mock] [--out PATH]',
    );
    return;
  }
  const rows = [];
  for (const card of CARDS) {
    process.stdout.write(`\n[survivor-headroom] ${card.family} / ${card.sibling} (predict ${card.predict})\n`);
    const { ran, report } = adjudicate(card, args);
    rows.push({
      family: card.family,
      sibling: card.sibling,
      predicted_verdict: card.predict,
      verdict: report.verdict,
      matches_prediction: report.verdict === card.predict,
      s0_committed_option: report.arms?.S0_no_policy?.committed_option?.value,
      s0_class: report.arms?.S0_no_policy?.matched_class?.value,
      s0_basis: report.arms?.S0_no_policy?.reasoning_basis?.value,
      s1_committed_option: report.arms?.S1_policy_memory?.committed_option?.value,
      s1_class: report.arms?.S1_policy_memory?.matched_class?.value,
      s1_basis: report.arms?.S1_policy_memory?.reasoning_basis?.value,
      cached: !ran,
    });
  }

  const headroom = rows.filter((r) => r.verdict === 'policy_memory_option_advantage').length;
  const noHeadroom = rows.filter((r) => r.verdict === 'no_option_headroom').length;
  const matched = rows.filter((r) => r.matches_prediction).length;
  const summary = {
    schema_version: 'a18.37-survivor-headroom-v1',
    channel: 'architecture_independent_blind_factual_extraction',
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    note: 'Constructed-device elicitation survivors, re-adjudicated on the trusted channel; corrects overlay false-negatives.',
    counts: { cards: rows.length, headroom, no_headroom: noHeadroom, predictions_matched: matched },
    rows,
  };
  const outAbs = path.resolve(ROOT, args.out);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, `${JSON.stringify(summary, null, 2)}\n`);

  process.stdout.write('\n========== A18.37 SURVIVOR HEADROOM (blind channel) ==========\n');
  for (const r of rows) {
    process.stdout.write(
      `  ${r.sibling}: S0 "${r.s0_committed_option}" [${r.s0_class}/${r.s0_basis}]  |  S1 "${r.s1_committed_option}" [${r.s1_class}/${r.s1_basis}]  -> ${r.verdict}  ${r.matches_prediction ? '(predicted)' : `(PREDICTED ${r.predicted_verdict})`}\n`,
    );
  }
  process.stdout.write(
    `headroom=${headroom}/${rows.length}  no_headroom=${noHeadroom}/${rows.length}  predictions_matched=${matched}/${rows.length}\n`,
  );
  process.stdout.write(`summary: ${rel(outAbs)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}

export { CARDS, adjudicate };
