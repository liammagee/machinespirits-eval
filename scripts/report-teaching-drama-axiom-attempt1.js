#!/usr/bin/env node
/**
 * A19 attempt-1 gate reporter.
 *
 * Reads materialized A19 attempt-1 replay artifacts and turns the generic A18
 * recursive replay gate into an A19-specific stop/continue decision. It is
 * report-only: no generation, judging, or panel calls are made here.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'yaml';
import { validateTeachingDramaAxiomProtocol } from './validate-teaching-drama-axiom-protocol.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_PROTOCOL = path.join(ROOT, 'config', 'teaching-drama-axioms', 'a19-protocol.yaml');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'teaching-drama-axioms', 'pilot-families.yaml');
const DEFAULT_OUT_DIR = path.join(ROOT, 'exports', 'a19', 'materialized-attempts');

const DEFAULT_THRESHOLDS = {
  old_warrant_misclassification: 0.7,
  resistance_diagnosis: 0.7,
  strategy_revision_accountability: 0.7,
  recursive_dyadic_update: 0.7,
  non_leakage: 0.9,
};

function usage() {
  return `Usage:
  node scripts/report-teaching-drama-axiom-attempt1.js
    [--protocol config/teaching-drama-axioms/a19-protocol.yaml]
    [--config config/teaching-drama-axioms/pilot-families.yaml]
    [--out-dir exports/a19/materialized-attempts]
    [--family family_id]
    [--out notes/adaptive_2_0/a19-attempt1-fixture-gate-report.md]
    [--json]

This is zero-API. It summarizes attempt-1 replay artifacts already on disk.`;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    protocol: DEFAULT_PROTOCOL,
    config: DEFAULT_CONFIG,
    outDir: DEFAULT_OUT_DIR,
    familyId: null,
    out: null,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--protocol') args.protocol = path.resolve(argv[++i]);
    else if (token === '--config') args.config = path.resolve(argv[++i]);
    else if (token === '--out-dir') args.outDir = path.resolve(argv[++i]);
    else if (token === '--family') args.familyId = argv[++i];
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else if (token === '--json') args.json = true;
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  return args;
}

function readYaml(filePath) {
  return yaml.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeSlug(value) {
  return String(value || 'missing')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function rel(filePath) {
  if (!filePath) return null;
  return path.relative(ROOT, path.resolve(filePath));
}

function scoreFrom(record, field) {
  const gateScore = record?.gate?.scores?.[field];
  if (gateScore && typeof gateScore === 'object' && Number.isFinite(gateScore.value)) return gateScore.value;
  const raw = record?.check?.scores?.[field];
  return Number.isFinite(raw) ? raw : null;
}

function checkThresholds(record, thresholds) {
  const scores = {};
  const failures = [];
  for (const [field, threshold] of Object.entries(thresholds)) {
    const value = scoreFrom(record, field);
    scores[field] = value;
    if (!Number.isFinite(value)) failures.push({ field, threshold, value: null, reason: 'missing_score' });
    else if (value < threshold) failures.push({ field, threshold, value, reason: 'below_threshold' });
  }
  return { scores, failures };
}

function familyAttempt1Gate(family, { outDir, thresholds }) {
  const familyDir = path.join(outDir, safeSlug(family.family_id));
  const manifestPath = path.join(familyDir, 'attempt1-replay', 'manifest.json');
  const blockers = [];
  if (!fs.existsSync(manifestPath)) {
    return {
      family_id: family.family_id,
      status: 'missing_attempt1_replay',
      next_gate: 'run_attempt1_replay',
      blockers: [{ reason: 'missing_manifest', path: rel(manifestPath) }],
      manifest_path: rel(manifestPath),
    };
  }

  const manifest = readJson(manifestPath);
  const record = asArray(manifest.records)[0] || {};
  const thresholdCheck = checkThresholds(record, thresholds);
  blockers.push(...thresholdCheck.failures);
  if (!family.training_seed?.old_rule_decoy) blockers.push({ reason: 'missing_old_rule_decoy' });
  if (!family.training_seed?.expected_failure) blockers.push({ reason: 'missing_expected_failure' });
  if (record?.gate?.status !== 'survivor') {
    blockers.push({ reason: 'a18_replay_gate_not_survivor', gate_status: record?.gate?.status || null });
  }
  if (['discard', 'revise_again'].includes(record?.check?.recommended_action)) {
    blockers.push({ reason: 'checker_recommended_stop', recommended_action: record.check.recommended_action });
  }

  const generatorBackend = record?.generator?.backend || manifest.generator || null;
  const checkerBackend = record?.checker?.backend || manifest.checker || null;
  const mockOnly = generatorBackend === 'mock' || checkerBackend === 'mock';
  const status = blockers.length ? 'blocked' : mockOnly ? 'fixture_survivor' : 'survivor';
  const nextGate = blockers.length
    ? 'stop_before_s0s1'
    : mockOnly
      ? 'requires_real_attempt1_before_empirical_s0s1'
      : 'eligible_for_s0s1_contrast';

  return {
    family_id: family.family_id,
    training_seed_id: family.training_seed?.seed_id || null,
    expected_failure: family.training_seed?.expected_failure || null,
    old_rule_decoy: family.training_seed?.old_rule_decoy || null,
    target_policy_id: family.target_policy?.policy_id || null,
    status,
    next_gate: nextGate,
    mock_only: mockOnly,
    generator_backend: generatorBackend,
    checker_backend: checkerBackend,
    manifest_path: rel(manifestPath),
    revised_public_path: rel(record?.paths?.revisedPublic),
    revision_json_path: rel(record?.paths?.revisionJson),
    check_json_path: rel(record?.paths?.checkJson),
    gate_status: record?.gate?.status || null,
    recommended_action: record?.check?.recommended_action || null,
    prompt_hashes: {
      generator: record?.generator?.promptHashes || null,
      checker: record?.checker?.promptHashes || null,
    },
    scores: thresholdCheck.scores,
    blockers,
  };
}

export function summarizeAttempt1Gate({
  protocolPath = DEFAULT_PROTOCOL,
  configPath = DEFAULT_CONFIG,
  outDir = DEFAULT_OUT_DIR,
  familyId = null,
  thresholds = DEFAULT_THRESHOLDS,
} = {}) {
  const validation = validateTeachingDramaAxiomProtocol({ protocolPath, configPath, familyId });
  const config = readYaml(configPath);
  const selectedFamilies = asArray(config?.families).filter((family) => !familyId || family.family_id === familyId);
  const families = selectedFamilies.map((family) => familyAttempt1Gate(family, { outDir, thresholds }));
  const summary = {
    families: families.length,
    survivors: families.filter((family) => family.status === 'survivor').length,
    fixture_survivors: families.filter((family) => family.status === 'fixture_survivor').length,
    blocked: families.filter((family) => family.status === 'blocked').length,
    missing_attempt1_replay: families.filter((family) => family.status === 'missing_attempt1_replay').length,
  };
  const errors = validation.summary.errors + summary.blocked + summary.missing_attempt1_replay;
  return {
    status: errors ? 'fail' : 'pass',
    empirical_status: summary.survivors ? 'real_attempt1_present' : 'fixture_only_no_empirical_claim',
    created_at: new Date().toISOString(),
    protocol_id: validation.protocol_id,
    protocol_version: validation.protocol_version,
    source_config: rel(configPath),
    source_out_dir: rel(outDir),
    thresholds,
    validation,
    summary,
    families,
    non_claims: [
      'human_learning',
      'deployed_adaptive_tutor',
      'model_weight_learning',
      'main_harness_rate_effect',
      'paid_blind_panel_result',
    ],
  };
}

export function renderMarkdown(report) {
  const lines = [];
  lines.push('# A19 Attempt-1 Gate Report', '');
  lines.push('Status: deterministic attempt-1 gate summary; zero API calls in this reporter.', '');
  lines.push('## Boundary', '');
  lines.push('- A18 replay artifacts are treated as attempt-1 gate evidence only.');
  lines.push('- Mock-backed survivors are fixture survivors, not empirical survivors.');
  lines.push('- S0/S1 escalation remains blocked for empirical claims until a real attempt-1 survivor exists.');
  lines.push('');
  lines.push('## Summary', '');
  lines.push(`- Status: \`${report.status}\``);
  lines.push(`- Empirical status: \`${report.empirical_status}\``);
  lines.push(`- Families: ${report.summary.families}`);
  lines.push(`- Fixture survivors: ${report.summary.fixture_survivors}`);
  lines.push(`- Real survivors: ${report.summary.survivors}`);
  lines.push(`- Blocked: ${report.summary.blocked}`);
  lines.push(`- Missing attempt-1 replay: ${report.summary.missing_attempt1_replay}`);
  lines.push('');
  lines.push('## Gate Thresholds', '');
  lines.push('| field | threshold |');
  lines.push('| --- | ---: |');
  for (const [field, threshold] of Object.entries(report.thresholds)) lines.push(`| ${field} | ${threshold} |`);
  lines.push('');
  lines.push('## Families', '');
  lines.push('| family | old-rule decoy | expected failure | status | next gate | old warrant | diagnosis | accountability | recursive update | non-leakage |');
  lines.push('| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |');
  for (const family of report.families) {
    lines.push(
      `| ${family.family_id} | ${family.old_rule_decoy || ''} | ${family.expected_failure || ''} | ${family.status} | ${family.next_gate} | ${family.scores?.old_warrant_misclassification ?? ''} | ${family.scores?.resistance_diagnosis ?? ''} | ${family.scores?.strategy_revision_accountability ?? ''} | ${family.scores?.recursive_dyadic_update ?? ''} | ${family.scores?.non_leakage ?? ''} |`,
    );
  }
  lines.push('');
  lines.push('## Blockers', '');
  const blocked = report.families.filter((family) => family.blockers?.length);
  if (!blocked.length) lines.push('No A19 fixture gate blockers.');
  for (const family of blocked) {
    for (const blocker of family.blockers) lines.push(`- ${family.family_id}: ${blocker.reason || blocker.field}`);
  }
  lines.push('');
  lines.push('## Claims Not Licensed', '');
  for (const claim of report.non_claims) lines.push(`- ${claim}`);
  lines.push('- an empirical A19 attempt-1 survival rate while all survivors are mock-backed');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

export function runAttempt1Report(rawArgs = process.argv.slice(2)) {
  const args = Array.isArray(rawArgs) ? parseArgs(rawArgs) : { ...parseArgs([]), ...rawArgs };
  if (args.help) return { help: usage() };
  const report = summarizeAttempt1Gate({
    protocolPath: args.protocol,
    configPath: args.config,
    outDir: args.outDir,
    familyId: args.familyId,
  });
  const output = args.json ? `${JSON.stringify(report, null, 2)}\n` : renderMarkdown(report);
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, output, 'utf8');
  } else {
    process.stdout.write(output);
  }
  return report;
}

function main() {
  const report = runAttempt1Report();
  if (report.help) {
    process.stdout.write(`${report.help}\n`);
    return;
  }
  if (report.status !== 'pass') process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
