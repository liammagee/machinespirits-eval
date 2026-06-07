#!/usr/bin/env node
/**
 * A18.37 — elicited-survivor headroom (EXTENSION), architecture-independent channel.
 *
 * Companion to scripts/a18.37-survivor-headroom.js. That driver re-adjudicated the
 * two constructed-device families whose held-out siblings were ablated in the
 * original A18.35 run (second_in_constructed_order, constructed_midpoint). This
 * extension does the same trusted-channel re-adjudication for the THREE ADDITIONAL
 * constructed-device families that the A18.37 replication fanout
 * (run-a18-family-local-screen.js) elicited and ablated:
 *
 *     overlay_registration_priority   (overlay_holdout_blue_right, overlay_holdout_gold_centre)
 *     pointer_chain_two_hop_priority  (chain_holdout_blue_p,        chain_holdout_gold_w)
 *     legend_decode_priority          (legend_holdout_blue_lower,   legend_holdout_gold_right)
 *
 * Purpose: grow the architecture-independent ("of N") denominator beyond the
 * original four families. The fanout scored these six on the OVERLAY relaxed-
 * correctness channel, which the paper deprecates as bidirectionally lexically
 * fragile; this re-reads the SAME existing S0/S1 continuations with the blind-
 * option arbiter (blind-option-adjudication.js) — no generation, no ablation, just
 * critic-only reads of continuations that already exist on disk.
 *
 * Aliases are taken VERBATIM from each sibling's policy_correctness block in the
 * family YAML (target_aliases -> targetAliases, incorrect_target_aliases ->
 * decoyAliases), held out from the critic and matched mechanically downstream.
 * Every alias set was checked against the arbiter's token-subset matcher
 * (aliasMatches: alias tokens must all appear in the committed option): the six
 * position vocabularies are mutually disjoint (left/right/centre, slots P-S,
 * slots W-Z+V, upper/lower, left/middle/right), and none carries a bare
 * single-token alias that could be spuriously hit, so target and decoy cannot
 * cross-contaminate.
 *
 * Predictions are DESIGN-derived (each cue-map's expected_s1_correct_move applies
 * the constructed device -> target; expected_s0_wrong_move takes a surface cue ->
 * decoy), i.e. policy_memory_option_advantage for all six. A no_option_headroom or
 * neither_correct result (e.g. S0 self-solves, or both miss) is an INFORMATIVE
 * correction, not a failure of the run. The overlay verdict each card is
 * correcting is recorded in `overlay_relaxed` for the post-hoc comparison only —
 * it is NOT an input to the blind verdict.
 *
 * Sequential (never concurrent) — safe on a shared Max-plan quota window.
 * Resumable: a card whose per-family blind-option JSON already exists is skipped
 * unless --force (the reused adjudicate() honours this).
 *
 * Usage:
 *   node scripts/a18.37-elicited-survivor-headroom.js [--critics 3] [--model M] [--force] [--mock]
 *     [--out exports/recursive-tutor-learning/a18.37-elicited-survivor-headroom/summary.json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { adjudicate } from './a18.37-survivor-headroom.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const EXP = 'exports/recursive-tutor-learning';

function rel(p) {
  return path.relative(ROOT, path.resolve(p));
}

// Each card points at the EXISTING S0/S1 continuations the fanout left on disk and
// carries the held-out target/decoy aliases verbatim from the family YAML. The
// `predict` is the design hypothesis; `overlay_relaxed` is the untrusted fanout
// verdict this card re-reads (recorded for comparison only).
const CARDS = [
  {
    family: 'overlay_registration_priority',
    sibling: 'overlay_holdout_blue_right',
    chainDir: `${EXP}/a18.35-overlay-registration-local`,
    token: 'neri',
    answerNoun: 'neri that can carry the final tag',
    optionSpace: 'left neri | right neri',
    // target = left_neri (overlay cut lands on the left panel once registered).
    targetAliases: 'left neri|left panel|lower-left neri|lower left neri',
    decoyAliases: 'right neri|right panel|upper-right neri|upper right neri',
    predict: 'policy_memory_option_advantage',
    overlay_relaxed: 'no_correct_policy_application',
  },
  {
    family: 'overlay_registration_priority',
    sibling: 'overlay_holdout_gold_centre',
    chainDir: `${EXP}/a18.35-overlay-registration-local`,
    token: 'ralo',
    answerNoun: 'ralo that can carry the final badge',
    optionSpace: 'left ralo | centre ralo | right ralo',
    // target = centre_ralo.
    targetAliases: 'centre ralo|centre panel|middle ralo|middle panel',
    decoyAliases: 'left ralo|right ralo|left panel|right panel',
    predict: 'policy_memory_option_advantage',
    overlay_relaxed: 'no_correct_policy_application',
  },
  {
    family: 'pointer_chain_two_hop_priority',
    sibling: 'chain_holdout_blue_p',
    chainDir: `${EXP}/a18.35-pointer-chain-two-hop-local`,
    token: 'neri',
    answerNoun: 'neri that can support the final tag',
    optionSpace: 'slot P neri | slot Q neri | slot R neri | slot S neri',
    // target = slot_q_neri (two hops from the tagged start P: P->R->Q).
    targetAliases: 'slot Q neri|slot Q|the Q token|Q neri',
    decoyAliases: 'slot S neri|slot S|slot P neri|slot R neri',
    predict: 'policy_memory_option_advantage',
    // overlay flagged S1 policy distinctiveness 0.028 (below the 0.12 gate): the
    // two arms may be near-identical, so the blind channel may report no headroom.
    overlay_relaxed: 'no_correct_policy_application',
  },
  {
    family: 'pointer_chain_two_hop_priority',
    sibling: 'chain_holdout_gold_w',
    chainDir: `${EXP}/a18.35-pointer-chain-two-hop-local`,
    token: 'ralo',
    answerNoun: 'ralo that can carry the final badge',
    optionSpace: 'slot W ralo | slot X ralo | slot Y ralo | slot Z ralo | slot V ralo',
    // target = slot_y_ralo (two hops from the tagged start W: W->Z->Y).
    targetAliases: 'slot Y ralo|slot Y|the Y token|Y ralo',
    decoyAliases: 'slot V ralo|slot V|slot W ralo|slot X ralo|slot Z ralo',
    predict: 'policy_memory_option_advantage',
    overlay_relaxed: 'no_correct_policy_application',
  },
  {
    family: 'legend_decode_priority',
    sibling: 'legend_holdout_blue_lower',
    chainDir: `${EXP}/a18.35-legend-decode-local`,
    token: 'neri',
    answerNoun: 'neri that can support the final tag',
    optionSpace: 'upper neri | lower neri',
    // target = upper_neri (final tag stamped curl; key first=curl -> slot 1 = upper).
    targetAliases: 'upper neri|upper tray|first-slot neri|first slot neri|curl-stamped neri',
    decoyAliases: 'lower neri|lower tray|barred-oval neri|blue neri',
    predict: 'policy_memory_option_advantage',
    overlay_relaxed: 'policy_memory_correctness_advantage', // overlay's lone "headroom" of these six
  },
  {
    family: 'legend_decode_priority',
    sibling: 'legend_holdout_gold_right',
    chainDir: `${EXP}/a18.35-legend-decode-local`,
    token: 'ralo',
    answerNoun: 'ralo that can carry the final badge',
    optionSpace: 'left ralo | middle ralo | right ralo',
    // target = middle_ralo (final badge stamped tilde; key second=tilde -> slot 2 = middle).
    targetAliases: 'middle ralo|middle tray|second-slot ralo|second slot ralo|ring-stamped ralo',
    decoyAliases: 'left ralo|right ralo|gold ralo|tilde-stamped ralo',
    predict: 'policy_memory_option_advantage',
    overlay_relaxed: 'no_correct_policy_application',
  },
];

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    critics: 3,
    model: null,
    force: false,
    mock: false,
    out: `${EXP}/a18.37-elicited-survivor-headroom/summary.json`,
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

function main() {
  const args = parseArgs();
  if (args.help) {
    console.log(
      'Usage: node scripts/a18.37-elicited-survivor-headroom.js [--critics 3] [--model M] [--force] [--mock] [--out PATH]',
    );
    return;
  }
  const rows = [];
  for (const card of CARDS) {
    process.stdout.write(
      `\n[elicited-survivor-headroom] ${card.family} / ${card.sibling} (predict ${card.predict}; overlay said ${card.overlay_relaxed})\n`,
    );
    const { ran, report } = adjudicate(card, args);
    const verdict = report.verdict;
    rows.push({
      family: card.family,
      sibling: card.sibling,
      predicted_verdict: card.predict,
      verdict,
      matches_prediction: verdict === card.predict,
      blind_shows_headroom: verdict === 'policy_memory_option_advantage',
      overlay_relaxed: card.overlay_relaxed,
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
  const neither = rows.filter((r) => r.verdict === 'neither_correct').length;
  const controlAdvantage = rows.filter((r) => r.verdict === 'control_option_advantage').length;
  const matched = rows.filter((r) => r.matches_prediction).length;
  const summary = {
    schema_version: 'a18.37-elicited-survivor-headroom-v1',
    channel: 'architecture_independent_blind_factual_extraction',
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    note:
      'Three additional constructed-device elicitation survivors (overlay_registration, ' +
      'pointer_chain_two_hop, legend_decode), re-adjudicated on the trusted blind channel to ' +
      'extend the architecture-independent denominator beyond the original four families. ' +
      'overlay_relaxed records the deprecated fanout verdict each card corrects (comparison only).',
    counts: {
      cards: rows.length,
      headroom,
      no_headroom: noHeadroom,
      neither_correct: neither,
      control_advantage: controlAdvantage,
      predictions_matched: matched,
    },
    rows,
  };
  const outAbs = path.resolve(ROOT, args.out);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, `${JSON.stringify(summary, null, 2)}\n`);

  process.stdout.write('\n========== A18.37 ELICITED-SURVIVOR HEADROOM (blind channel) ==========\n');
  for (const r of rows) {
    process.stdout.write(
      `  ${r.sibling}: S0 "${r.s0_committed_option}" [${r.s0_class}/${r.s0_basis}]  |  S1 "${r.s1_committed_option}" [${r.s1_class}/${r.s1_basis}]  -> ${r.verdict}  (overlay: ${r.overlay_relaxed})\n`,
    );
  }
  process.stdout.write(
    `headroom=${headroom}/${rows.length}  no_headroom=${noHeadroom}/${rows.length}  neither_correct=${neither}/${rows.length}  control_advantage=${controlAdvantage}/${rows.length}  predictions_matched=${matched}/${rows.length}\n`,
  );
  process.stdout.write(`summary: ${rel(outAbs)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}

export { CARDS };
