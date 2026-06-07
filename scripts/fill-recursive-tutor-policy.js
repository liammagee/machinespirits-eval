#!/usr/bin/env node
/**
 * Fill A18 recursive tutor-learning policy templates from successful attempt-1
 * replay ledgers.
 *
 * This is zero-API. It promotes the tutor_learning_ledger from a local survivor
 * into the finite policy object that held-out replay commands can use as
 * --policy-memory.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_CHAIN_DIR = path.join(ROOT, 'exports', 'recursive-tutor-learning', 'a18-pilot-local');
const REQUIRED_LEDGER_FIELDS = Object.freeze([
  'tutor_prior_strategy',
  'learner_resistance_as_feedback',
  'tutor_diagnosis',
  'rejected_continuation',
  'revised_strategy',
  'strategic_timing',
  'learner_feedback_on_revision',
  'recursive_update',
]);

function usage() {
  return `Usage:
  node scripts/fill-recursive-tutor-policy.js
    [--chain-dir exports/recursive-tutor-learning/a18-pilot-local]
    [--out policy-fill-report.json]
    [--include-revise-again]
    [--dry-run]

This is zero-API. By default it fills policy templates only for attempt-1 local
survivors and skips revise_again/reject artifacts.`;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    chainDir: DEFAULT_CHAIN_DIR,
    out: null,
    includeReviseAgain: false,
    dryRun: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--chain-dir') args.chainDir = path.resolve(argv[++i]);
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else if (token === '--include-revise-again') args.includeReviseAgain = true;
    else if (token === '--dry-run') args.dryRun = true;
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  if (!args.out) args.out = path.join(args.chainDir, 'policy-fill-report.json');
  return args;
}

function repoRel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

function fileExists(filePath) {
  return Boolean(filePath && fs.existsSync(filePath));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function stringifyPolicyPart(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(stringifyPolicyPart).filter(Boolean).join('; ');
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, child]) => {
        const text = stringifyPolicyPart(child);
        return text ? `${key}: ${text}` : '';
      })
      .filter(Boolean)
      .join('; ');
  }
  return String(value).trim();
}

function loadReplayManifest(replayDir) {
  const manifestPath = path.join(replayDir || '', 'manifest.json');
  if (!fileExists(manifestPath)) {
    return { present: false, manifestPath, records: [], status: 'missing' };
  }
  const manifest = readJson(manifestPath);
  const records = Array.isArray(manifest.records) ? manifest.records : Array.isArray(manifest) ? manifest : [];
  const first = records[0] || {};
  return {
    present: true,
    manifestPath,
    manifest,
    records,
    first,
    status: first?.gate?.status || 'unknown',
  };
}

function findRevisionJson(family, replay) {
  const manifestPath = replay.first?.paths?.revisionJson;
  if (fileExists(manifestPath)) return manifestPath;
  const transcriptBase = path.basename(family.training_transcript || '').replace(/\.[^.]+$/, '');
  const candidates = [
    path.join(family.attempt1_replay_dir, transcriptBase, 'revision.json'),
    path.join(family.attempt1_replay_dir, 'revision.json'),
  ];
  return candidates.find(fileExists) || null;
}

function validateLedger(ledger) {
  const missing = REQUIRED_LEDGER_FIELDS.filter((field) => {
    const value = ledger?.[field];
    return value == null || stringifyPolicyPart(value) === '';
  });
  const resistance = ledger?.learner_resistance_as_feedback || {};
  for (const field of ['public_signal', 'evidence_quote', 'why_it_challenges_prior_strategy']) {
    if (!stringifyPolicyPart(resistance[field])) missing.push(`learner_resistance_as_feedback.${field}`);
  }
  const revised = ledger?.revised_strategy || {};
  for (const field of ['strategy_name', 'new_public_test_or_device', 'why_this_strategy_now']) {
    if (!stringifyPolicyPart(revised[field])) missing.push(`revised_strategy.${field}`);
  }
  return [...new Set(missing)];
}

function scoreSnapshot(record) {
  const gateScores = record?.gate?.scores || {};
  const recursiveScores = record?.gate?.recursive_tutor_learning_gate?.scores || {};
  const out = {};
  for (const [key, payload] of Object.entries({ ...gateScores, ...recursiveScores })) {
    out[key] = payload?.value ?? payload?.raw ?? null;
  }
  return out;
}

function buildTransferWarning(family, ledger) {
  const resistance = ledger.learner_resistance_as_feedback || {};
  const strategy = ledger.revised_strategy || {};
  return [
    `Use only for obstruction_type=${family.obstruction_type || 'unknown'} when public learner evidence matches:`,
    stringifyPolicyPart(resistance.public_signal) || 'the attempt-1 learner resistance',
    `Do not transfer just because the domain looks similar; require the old strategy to fail publicly before applying ${stringifyPolicyPart(strategy.strategy_name) || 'the revised strategy'}.`,
  ].join(' ');
}

function buildExpiryCondition() {
  return 'Retire or rewrite this policy after two held-out sibling applications pass the local gate without recursive-dyadic warnings, or immediately after any leakage, coherence-confound, organic-drift, or no-headroom finding.';
}

export function buildPolicyFromLedger({ family, revision, replay }) {
  const ledger = Array.isArray(revision?.tutor_learning_ledger) ? revision.tutor_learning_ledger[0] : null;
  const missing = validateLedger(ledger);
  if (missing.length) {
    throw new Error(`attempt-1 tutor_learning_ledger incomplete for ${family.family_id}: ${missing.join(', ')}`);
  }
  const resistance = ledger.learner_resistance_as_feedback;
  const strategy = ledger.revised_strategy;
  return {
    family_id: family.family_id,
    status: 'filled_from_attempt1',
    filled_at: new Date().toISOString(),
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    transfer_design: family.transfer_design || null,
    plausible_repairs: family.plausible_repairs || [],
    source_attempt1_replay: repoRel(family.attempt1_replay_dir),
    source_revision_json: replay.revisionJson ? repoRel(replay.revisionJson) : null,
    diagnostic_trigger: `${stringifyPolicyPart(resistance.public_signal)} Evidence: ${stringifyPolicyPart(resistance.evidence_quote)} Challenge: ${stringifyPolicyPart(resistance.why_it_challenges_prior_strategy)}`,
    avoid_move: stringifyPolicyPart(ledger.rejected_continuation),
    preferred_move: `${stringifyPolicyPart(strategy.strategy_name)}: ${stringifyPolicyPart(strategy.why_this_strategy_now)}`,
    material_constraint: stringifyPolicyPart(strategy.new_public_test_or_device),
    uptake_test: stringifyPolicyPart(ledger.learner_feedback_on_revision),
    transfer_warning: buildTransferWarning(family, ledger),
    expiry_condition: buildExpiryCondition(),
    evidence: {
      tutor_prior_strategy: stringifyPolicyPart(ledger.tutor_prior_strategy),
      tutor_diagnosis: stringifyPolicyPart(ledger.tutor_diagnosis),
      strategic_timing: stringifyPolicyPart(ledger.strategic_timing),
      recursive_update: stringifyPolicyPart(ledger.recursive_update),
      attempt1_scores: scoreSnapshot(replay.first),
    },
  };
}

function fillFamilyPolicy(family, options = {}) {
  const replay = loadReplayManifest(family.attempt1_replay_dir);
  if (!replay.present) {
    return {
      family_id: family.family_id,
      status: 'skipped',
      reason: 'missing_attempt1_replay',
      attempt1_status: replay.status,
      policy_path: repoRel(family.policy_revision_template),
    };
  }
  if (replay.status !== 'survivor' && !(options.includeReviseAgain && replay.status === 'revise_again')) {
    return {
      family_id: family.family_id,
      status: 'skipped',
      reason: `attempt1_${replay.status}`,
      attempt1_status: replay.status,
      replay_manifest: repoRel(replay.manifestPath),
      policy_path: repoRel(family.policy_revision_template),
    };
  }
  const revisionJson = findRevisionJson(family, replay);
  if (!revisionJson) {
    return {
      family_id: family.family_id,
      status: 'skipped',
      reason: 'missing_revision_json',
      attempt1_status: replay.status,
      replay_manifest: repoRel(replay.manifestPath),
      policy_path: repoRel(family.policy_revision_template),
    };
  }
  const revision = readJson(revisionJson);
  const policy = buildPolicyFromLedger({ family, revision, replay: { ...replay, revisionJson } });
  if (!options.dryRun) writeJson(family.policy_revision_template, policy);
  return {
    family_id: family.family_id,
    status: options.dryRun ? 'would_fill' : 'filled',
    attempt1_status: replay.status,
    replay_manifest: repoRel(replay.manifestPath),
    revision_json: repoRel(revisionJson),
    policy_path: repoRel(family.policy_revision_template),
    preferred_move: policy.preferred_move,
  };
}

export function fillRecursiveTutorPolicies({
  chainDir = DEFAULT_CHAIN_DIR,
  includeReviseAgain = false,
  dryRun = false,
} = {}) {
  const planPath = path.join(chainDir, 'attempt-chain-plan.json');
  if (!fileExists(planPath)) throw new Error(`attempt-chain plan not found: ${planPath}`);
  const plan = readJson(planPath);
  const families = (plan.families || []).map((family) =>
    fillFamilyPolicy(family, { includeReviseAgain, dryRun }),
  );
  const status_counts = families.reduce((acc, family) => {
    const key = family.status === 'skipped' ? `skipped_${family.reason}` : family.status;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return {
    kind: 'recursive_tutor_learning_policy_fill_report',
    created_at: new Date().toISOString(),
    chain_dir: chainDir,
    plan_path: planPath,
    dry_run: dryRun,
    include_revise_again: includeReviseAgain,
    status_counts,
    families,
    next_stage_rule:
      'Run held-out baseline with --generator none, then held-out revised with --policy-memory only for filled policies.',
  };
}

export function runPolicyFill(rawArgs = process.argv.slice(2)) {
  const args = Array.isArray(rawArgs) ? parseArgs(rawArgs) : { ...parseArgs([]), ...rawArgs };
  if (args.help) return { help: usage() };
  const report = fillRecursiveTutorPolicies({
    chainDir: args.chainDir,
    includeReviseAgain: args.includeReviseAgain,
    dryRun: args.dryRun,
  });
  if (!args.dryRun) writeJson(args.out, report);
  return { report, out: args.out };
}

function main() {
  try {
    const result = runPolicyFill();
    if (result.help) {
      console.log(result.help);
      return;
    }
    console.log(
      JSON.stringify(
        {
          out: result.report.dry_run ? null : repoRel(result.out),
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

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
