#!/usr/bin/env node
/**
 * A18 local gate over recursive tutor-learning attempt-chain artifacts.
 *
 * Reads a materialized chain from run-recursive-tutor-learning-benchmark.js and
 * classifies each family as one of:
 *   clean_survivor | revise_again | coherence_confound | leakage | organic_drift | no_headroom
 *
 * It does not call LLMs. It only reads static validation, strategy templates,
 * and replay manifests/checker gates already produced by the existing replay
 * harness.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_CHAIN_DIR = path.join(ROOT, 'exports', 'recursive-tutor-learning', 'a18-pilot-local');
const DEFAULT_THRESHOLDS = Object.freeze({
  tutor_learning_signal: 0.7,
  resistance_diagnosis: 0.7,
  strategy_revision_accountability: 0.7,
  strategic_timing: 0.7,
  recursive_dyadic_update: 0.7,
});
const BRIDGE_KEYS = Object.freeze(['public_causal_bridge', 'device_specificity', 'old_warrant_misclassification']);
const REQUIRED_POLICY_FIELDS = Object.freeze([
  'diagnostic_trigger',
  'avoid_move',
  'preferred_move',
  'material_constraint',
  'uptake_test',
  'transfer_warning',
  'expiry_condition',
]);

function usage() {
  return `Usage:
  node scripts/report-recursive-tutor-learning-local-gate.js
    [--chain-dir exports/recursive-tutor-learning/a18-pilot-local]
    [--out local-gate-report.json]

This is zero-API. It reads existing artifacts and writes a local gate report.`;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    chainDir: DEFAULT_CHAIN_DIR,
    out: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--chain-dir') args.chainDir = path.resolve(argv[++i]);
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  if (!args.out) args.out = path.join(args.chainDir, 'local-gate-report.json');
  return args;
}

function repoRel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function fileExists(filePath) {
  return Boolean(filePath && fs.existsSync(filePath));
}

function loadReplay(replayDir) {
  const manifestPath = path.join(replayDir || '', 'manifest.json');
  if (!fileExists(manifestPath)) {
    return {
      present: false,
      replay_dir: replayDir,
      manifest_path: manifestPath,
      status: 'missing',
      records: [],
    };
  }
  const manifest = readJson(manifestPath);
  const records = Array.isArray(manifest.records) ? manifest.records : [];
  const statuses = records.reduce((acc, record) => {
    const status = record?.gate?.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  const first = records[0] || {};
  return {
    present: true,
    replay_dir: replayDir,
    manifest_path: manifestPath,
    status: statuses.survivor ? 'survivor' : statuses.revise_again ? 'revise_again' : statuses.reject ? 'reject' : 'unknown',
    statuses,
    records,
    first_record: first,
  };
}

function scoreFromRecord(record, key) {
  const raw =
    record?.gate?.recursive_tutor_learning_gate?.scores?.[key]?.value ??
    record?.gate?.scores?.[key]?.value ??
    record?.check?.scores?.[key] ??
    null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function recursiveScoresPass(record, thresholds = DEFAULT_THRESHOLDS) {
  return Object.entries(thresholds).every(([key, threshold]) => {
    const value = scoreFromRecord(record, key);
    return value !== null && value >= threshold;
  });
}

function bridgeScoresLow(record) {
  return BRIDGE_KEYS.some((key) => {
    const value = scoreFromRecord(record, key);
    return value !== null && value < 0.7;
  });
}

function replayProblems(replay) {
  const records = replay.records || [];
  const problems = [];
  for (const record of records) {
    problems.push(...(record?.gate?.failures || []));
    problems.push(...(record?.gate?.warnings || []));
    for (const finding of record?.check?.findings || []) {
      const severity = String(finding?.severity || '').toLowerCase();
      if (finding?.blocking === true || severity === 'warning' || severity === 'fail') problems.push(finding);
    }
  }
  return problems;
}

function replayHasProblem(replay, pattern) {
  return replayProblems(replay).some((problem) => pattern.test(JSON.stringify(problem)));
}

function loadPolicy(policyPath) {
  if (!fileExists(policyPath)) return { present: false, complete: false, missing_fields: [...REQUIRED_POLICY_FIELDS] };
  const policy = readJson(policyPath);
  const missing = REQUIRED_POLICY_FIELDS.filter((field) => {
    const value = policy[field];
    return value == null || String(value).trim() === '';
  });
  const complete = policy.status !== 'template_unfilled' && missing.length === 0;
  return { present: true, complete, missing_fields: missing, policy };
}

function familyStaticIssues(staticValidation, familyId) {
  return (staticValidation?.issues || []).filter((issue) => !issue.family_id || issue.family_id === familyId);
}

function classifyFamily({ family, staticValidation }) {
  const reasons = [];
  const warnings = [];
  const staticIssues = familyStaticIssues(staticValidation, family.family_id);
  if (staticIssues.length) {
    const leakage = staticIssues.some((issue) => issue.code === 'forbidden_shortcut_leak');
    return {
      family_id: family.family_id,
      status: leakage ? 'leakage' : 'revise_again',
      reasons: staticIssues,
      warnings,
    };
  }

  const attempt1 = loadReplay(family.attempt1_replay_dir);
  if (!attempt1.present) {
    reasons.push({ code: 'missing_attempt1_replay', path: repoRel(attempt1.manifest_path) });
  } else if (attempt1.status !== 'survivor') {
    reasons.push({ code: 'attempt1_not_local_survivor', status: attempt1.status, path: repoRel(attempt1.manifest_path) });
  }

  const policy = loadPolicy(family.policy_revision_template);
  if (!policy.present) {
    reasons.push({ code: 'missing_policy_revision_template', path: repoRel(family.policy_revision_template) });
  } else if (!policy.complete) {
    reasons.push({
      code: 'policy_revision_unfilled',
      path: repoRel(family.policy_revision_template),
      missing_fields: policy.missing_fields,
    });
  }

  const heldout = [];
  for (const sibling of family.heldout || []) {
    const baseline = loadReplay(sibling.baseline_replay_dir);
    const revised = loadReplay(sibling.revised_replay_dir);
    const baselinePasses = baseline.present && baseline.status === 'survivor' && recursiveScoresPass(baseline.first_record);
    const revisedPasses = revised.present && revised.status === 'survivor' && recursiveScoresPass(revised.first_record);
    const siblingReasons = [];

    if (!baseline.present) siblingReasons.push({ code: 'missing_heldout_baseline_replay', path: repoRel(baseline.manifest_path) });
    if (!revised.present) siblingReasons.push({ code: 'missing_heldout_revised_replay', path: repoRel(revised.manifest_path) });
    if (revised.present && replayHasProblem(revised, /\bcoherence\b|\bnaturalness\b/i)) {
      siblingReasons.push({ code: 'coherence_confound_warning', path: repoRel(revised.manifest_path) });
    }
    if (revised.present && (bridgeScoresLow(revised.first_record) || replayHasProblem(revised, /\borganic\b|\bdrift\b/i))) {
      siblingReasons.push({ code: 'organic_drift_or_weak_bridge', path: repoRel(revised.manifest_path) });
    }
    if (baselinePasses && revisedPasses) {
      siblingReasons.push({ code: 'no_headroom', detail: 'baseline and revised replay both pass recursive local gate' });
    } else if (!revisedPasses && revised.present) {
      siblingReasons.push({ code: 'revised_does_not_pass_recursive_gate', path: repoRel(revised.manifest_path) });
    }

    heldout.push({
      sibling_id: sibling.sibling_id,
      baseline: {
        present: baseline.present,
        status: baseline.status,
        recursive_passes: baselinePasses,
        manifest_path: repoRel(baseline.manifest_path),
      },
      revised: {
        present: revised.present,
        status: revised.status,
        recursive_passes: revisedPasses,
        manifest_path: repoRel(revised.manifest_path),
      },
      reasons: siblingReasons,
    });
  }

  const heldoutReasons = heldout.flatMap((row) => row.reasons || []);
  const allReasons = [...reasons, ...heldoutReasons];
  let status = 'revise_again';
  if (allReasons.some((reason) => reason.code === 'coherence_confound_warning')) status = 'coherence_confound';
  else if (allReasons.some((reason) => reason.code === 'organic_drift_or_weak_bridge')) status = 'organic_drift';
  else if (allReasons.some((reason) => reason.code === 'no_headroom')) status = 'no_headroom';
  else if (!allReasons.length && heldout.some((row) => row.revised.recursive_passes && !row.baseline.recursive_passes)) {
    status = 'clean_survivor';
  }

  return {
    family_id: family.family_id,
    status,
    reasons: allReasons,
    warnings,
    attempt1: {
      present: attempt1.present,
      status: attempt1.status,
      manifest_path: repoRel(attempt1.manifest_path),
    },
    policy_revision: {
      present: policy.present,
      complete: policy.complete,
      path: repoRel(family.policy_revision_template),
      missing_fields: policy.missing_fields,
    },
    heldout,
  };
}

export function buildLocalGateReport({ chainDir = DEFAULT_CHAIN_DIR } = {}) {
  const planPath = path.join(chainDir, 'attempt-chain-plan.json');
  if (!fileExists(planPath)) throw new Error(`attempt-chain plan not found: ${planPath}`);
  const plan = readJson(planPath);
  const staticValidationPath = path.join(chainDir, 'static-validation.json');
  const staticValidation = fileExists(staticValidationPath) ? readJson(staticValidationPath) : plan.validation || {};
  const families = (plan.families || []).map((family) => classifyFamily({ family, staticValidation }));
  const status_counts = families.reduce((acc, family) => {
    acc[family.status] = (acc[family.status] || 0) + 1;
    return acc;
  }, {});
  return {
    kind: 'recursive_tutor_learning_local_gate_report',
    created_at: new Date().toISOString(),
    chain_dir: chainDir,
    plan_path: planPath,
    claim_boundary: plan.claim_boundary,
    statuses: ['clean_survivor', 'revise_again', 'coherence_confound', 'leakage', 'organic_drift', 'no_headroom'],
    status_counts,
    families,
    next_stage_rule:
      'Only clean_survivor families may move to an adversarial/panel check. Revise or redesign all other statuses before spending.',
  };
}

export function runLocalGate(rawArgs = process.argv.slice(2)) {
  const args = Array.isArray(rawArgs) ? parseArgs(rawArgs) : { ...parseArgs([]), ...rawArgs };
  if (args.help) return { help: usage() };
  const report = buildLocalGateReport({ chainDir: args.chainDir });
  writeJson(args.out, report);
  return { report, out: args.out };
}

function main() {
  try {
    const result = runLocalGate();
    if (result.help) {
      console.log(result.help);
      return;
    }
    console.log(
      JSON.stringify(
        {
          out: repoRel(result.out),
          status_counts: result.report.status_counts,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error.message || String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] === __filename) main();
