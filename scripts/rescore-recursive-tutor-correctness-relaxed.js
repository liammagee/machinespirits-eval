#!/usr/bin/env node
/**
 * A18.36 zero-cost relaxed policy-correctness rescore.
 *
 * Re-scores saved A18 underdetermined-transfer ablation reports with the
 * order-insensitive relaxed matcher (run-recursive-tutor-policy-ablation.js),
 * reading the S0/S1 continuations from the SAME directory as each report so it
 * works on preserved (renamed) ablation dirs whose embedded absolute paths are
 * stale. Reports the strict verdict, the relaxed verdict, and whether the
 * difference is a `lexical_correctness_false_negative` correction.
 *
 * Zero-API: reads existing replay outputs only; calls no generator or critic.
 *
 * Usage:
 *   node scripts/rescore-recursive-tutor-correctness-relaxed.js \
 *     --report exports/.../a18.6-policy-ablation.sib1-blue-right/a18.8-s0-hard-bounded-transfer-report.json \
 *     --report exports/.../a18.6-policy-ablation.sib2-gold-middle/a18.8-s0-hard-bounded-transfer-report.json \
 *     [--out exports/.../a18.36-relaxed-correctness-rescore.json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { analyzePolicyCorrectness } from './run-recursive-tutor-policy-ablation.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

function rel(p) {
  return path.relative(ROOT, path.resolve(p));
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = { reports: [], out: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--report') args.reports.push(path.resolve(argv[++i]));
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else throw new Error(`unknown arg: ${token}`);
  }
  return args;
}

// Find the single revised-public.txt / original-public.txt beneath an arm dir.
function findContinuation(armDir) {
  const stack = [armDir];
  let revised = null;
  let original = null;
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name === 'revised-public.txt') revised = full;
      else if (entry.name === 'original-public.txt') original = full;
    }
  }
  return { revised, original };
}

function armRecord(reportDir, armSuffix, status) {
  const armDir = fs
    .readdirSync(reportDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.endsWith(armSuffix))
    .map((e) => path.join(reportDir, e.name))[0];
  if (!armDir) throw new Error(`arm dir *${armSuffix} not found under ${reportDir}`);
  const { revised, original } = findContinuation(armDir);
  return { gate: { status }, paths: { revisedPublic: revised, originalPublic: original } };
}

function rescoreReport(reportPath) {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const reportDir = path.dirname(reportPath);
  const gate = report.policy_correctness_gate || {};
  // Reconstruct the sibling.policy_correctness block from the saved gate.
  const correctness = {
    selected_repair: gate.registered_selected_repair || gate.selected_repair || null,
    target_id: gate.target_id || null,
    target_aliases: gate.target_aliases || [],
    selected_repair_markers: gate.selected_repair_markers || [],
    incorrect_target_aliases: gate.incorrect_target_aliases || [],
  };
  const s0Record = armRecord(reportDir, 'S0-no-policy-replay', report.local_arms?.S0_no_policy?.status || 'unknown');
  const s1Record = armRecord(
    reportDir,
    'S1-policy-memory-replay',
    report.local_arms?.S1_policy_memory?.status || 'unknown',
  );
  const policyMemoryPath = report.policy_contrast_gate?.policy_memory_path
    ? path.join(ROOT, report.policy_contrast_gate.policy_memory_path)
    : null;
  const fresh = analyzePolicyCorrectness({
    policyMemoryPath: policyMemoryPath && fs.existsSync(policyMemoryPath) ? policyMemoryPath : null,
    sibling: { policy_correctness: correctness },
    s0Record,
    s1Record,
  });
  return {
    report: rel(reportPath),
    family_id: report.family_id,
    sibling_id: report.sibling_id,
    raw_local_verdict: report.local_verdict,
    policy_contrast: {
      verdict: report.policy_contrast_gate?.verdict,
      distinctiveness: report.policy_contrast_gate?.distinctiveness,
    },
    strict_correctness_verdict: fresh.verdict,
    relaxed_correctness_verdict: fresh.relaxed_verdict,
    lexical_false_negative_corrected: fresh.lexical_false_negative_corrected,
    S0: {
      status: s0Record.gate.status,
      strict_verdict: fresh.S0_no_policy.verdict,
      relaxed_verdict: fresh.S0_no_policy.relaxed_verdict,
      relaxed_target_hits: fresh.S0_no_policy.relaxed_target_hits,
      relaxed_incorrect_target_hits: fresh.S0_no_policy.relaxed_incorrect_target_hits,
      relaxed_correct: fresh.S0_no_policy.relaxed_correct,
    },
    S1: {
      status: s1Record.gate.status,
      strict_verdict: fresh.S1_policy_memory.verdict,
      relaxed_verdict: fresh.S1_policy_memory.relaxed_verdict,
      relaxed_target_hits: fresh.S1_policy_memory.relaxed_target_hits,
      relaxed_selected_repair_marker_hits: fresh.S1_policy_memory.relaxed_selected_repair_marker_hits,
      relaxed_correct: fresh.S1_policy_memory.relaxed_correct,
    },
  };
}

function main() {
  const args = parseArgs();
  if (args.help || !args.reports.length) {
    console.log(
      'Usage: node scripts/rescore-recursive-tutor-correctness-relaxed.js --report <path> [--report ...] [--out <path>]',
    );
    return;
  }
  const rows = args.reports.map(rescoreReport);
  const report = {
    kind: 'recursive_tutor_relaxed_correctness_rescore',
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    a18_step: 'a18.36_lexical_false_negative_fix',
    rows,
    summary: {
      reports: rows.length,
      family_local_headroom_relaxed: rows.every(
        (r) =>
          r.relaxed_correctness_verdict === 'policy_memory_correctness_advantage' &&
          r.policy_contrast.verdict === 'policy_distinct',
      ),
      corrected_false_negatives: rows.filter((r) => r.lexical_false_negative_corrected).length,
    },
  };
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify(report, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}
