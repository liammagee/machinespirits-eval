#!/usr/bin/env node
/**
 * A18.13 zero-cost policy-correctness report.
 *
 * Re-scores saved underdetermined-transfer ablation reports without
 * regenerating transcripts. The stricter read separates generic local
 * adaptation from application of the registered selected repair to the
 * registered held-out target.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  analyzePolicyCorrectness,
  buildAblationPlan,
  effectiveLocalVerdict,
} from './run-recursive-tutor-policy-ablation.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_CHAIN_DIR = path.join(ROOT, 'exports', 'recursive-tutor-learning', 'a18.12-second-family-repair-local');

function usage() {
  return `Usage:
  node scripts/report-recursive-tutor-policy-correctness.js
    [--chain-dir exports/recursive-tutor-learning/a18.12-second-family-repair-local]
    [--out exports/recursive-tutor-learning/.../a18.13-policy-correctness-report.json]
    [--family bead_predecessor_priority]

This is zero-API. It reads existing A18 underdetermined-transfer ablation
reports and saved replay manifests; it does not call generator or critic CLIs.`;
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    chainDir: DEFAULT_CHAIN_DIR,
    out: null,
    familyId: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--chain-dir') args.chainDir = path.resolve(argv[++i]);
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else if (token === '--family') args.familyId = argv[++i];
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  args.chainDir = path.resolve(args.chainDir);
  args.out = path.resolve(args.out || path.join(args.chainDir, 'a18.13-policy-correctness-report.json'));
  return args;
}

function rel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

function resolveRepoPath(filePath) {
  if (!filePath) return null;
  return path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function reportPaths(chainDir) {
  const paths = [];
  for (const entry of fs.readdirSync(chainDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const runDir = path.join(chainDir, entry.name);
    for (const reportEntry of fs.readdirSync(runDir, { withFileTypes: true })) {
      if (!reportEntry.isFile()) continue;
      if (/^a18\.[0-9]+.*underdetermined-transfer-family.*-report\.json$/.test(reportEntry.name)) {
        paths.push(path.join(runDir, reportEntry.name));
      }
    }
  }
  return paths.sort();
}

function armRecordFromReport(report, arm) {
  const armReport = report.local_arms?.[arm] || {};
  const manifestPath = resolveRepoPath(armReport.manifest_path);
  if (manifestPath && fs.existsSync(manifestPath)) {
    const manifest = readJson(manifestPath);
    return manifest.records?.[0] || manifest;
  }
  return {
    gate: { status: armReport.status || 'unknown' },
    paths: {
      revisedPublic: resolveRepoPath(armReport.revised_public_path),
    },
  };
}

function summarizeCounts(rows, field) {
  const counts = {};
  for (const row of rows) {
    const value = row[field] || 'unknown';
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

export function buildPolicyCorrectnessReport({ chainDir = DEFAULT_CHAIN_DIR, out = null, familyId = null } = {}) {
  const rows = [];
  for (const reportPath of reportPaths(chainDir)) {
    const sourceReport = readJson(reportPath);
    if (familyId && sourceReport.family_id !== familyId) continue;
    const plan = buildAblationPlan({
      chainDir,
      familyId: sourceReport.family_id,
      siblingId: sourceReport.sibling_id,
      requireLocalGate: false,
      requireS1Manifest: false,
    });
    const s0Record = armRecordFromReport(sourceReport, 'S0_no_policy');
    const s1Record = armRecordFromReport(sourceReport, 'S1_policy_memory');
    const policyMemoryPath = resolveRepoPath(sourceReport.policy_contrast_gate?.policy_memory_path || plan.paths.policyMemory);
    const policyCorrectnessGate = analyzePolicyCorrectness({
      policyMemoryPath,
      sibling: plan.sibling,
      s0Record,
      s1Record,
    });
    const effectiveVerdict = effectiveLocalVerdict(
      sourceReport.local_arms?.S0_no_policy || { status: 'unknown' },
      sourceReport.local_arms?.S1_policy_memory || { status: 'unknown' },
      policyCorrectnessGate,
    );
    rows.push({
      source_report: rel(reportPath),
      family_id: sourceReport.family_id,
      sibling_id: sourceReport.sibling_id,
      raw_local_verdict: sourceReport.local_verdict,
      effective_local_verdict: effectiveVerdict,
      policy_contrast_verdict: sourceReport.policy_contrast_gate?.verdict || null,
      policy_correctness_verdict: policyCorrectnessGate.verdict,
      panel_candidate:
        effectiveVerdict === 'policy_memory_local_advantage' &&
        sourceReport.policy_contrast_gate?.verdict === 'policy_distinct',
      policy_correctness_gate: policyCorrectnessGate,
    });
  }
  const report = {
    kind: 'recursive_tutor_policy_correctness_report',
    created_at: new Date().toISOString(),
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    chain_dir: rel(chainDir),
    out: out ? rel(out) : null,
    family_filter: familyId,
    rows,
    summary: {
      total_reports: rows.length,
      effective_local_verdict_counts: summarizeCounts(rows, 'effective_local_verdict'),
      policy_correctness_verdict_counts: summarizeCounts(rows, 'policy_correctness_verdict'),
      panel_candidates: rows.filter((row) => row.panel_candidate).length,
    },
    decisive_read:
      'A transcript can remain a raw local survivor while failing policy correctness if it solves learner resistance with a different plausible public repair.',
  };
  if (out) writeJson(out, report);
  return report;
}

async function main() {
  try {
    const args = parseArgs();
    if (args.help) {
      console.log(usage());
      return;
    }
    const report = buildPolicyCorrectnessReport(args);
    console.log(
      JSON.stringify(
        {
          out: rel(args.out),
          total_reports: report.summary.total_reports,
          effective_local_verdict_counts: report.summary.effective_local_verdict_counts,
          policy_correctness_verdict_counts: report.summary.policy_correctness_verdict_counts,
          panel_candidates: report.summary.panel_candidates,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  await main();
}
