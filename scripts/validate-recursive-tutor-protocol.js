#!/usr/bin/env node
/**
 * A18.16 zero-API protocol validator.
 *
 * Checks candidate recursive tutor-learning family fixtures against the frozen
 * correctness-gated protocol before fresh generation or panel spending.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_PROTOCOL = path.join(ROOT, 'config', 'recursive-tutor-learning', 'a18-correctness-gated-protocol.yaml');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'recursive-tutor-learning', 'underdetermined-transfer-families.yaml');
const ACCEPTED_PROTOCOL_IDS = new Set(['A18.16', 'A18.22']);

function usage() {
  return `Usage:
  node scripts/validate-recursive-tutor-protocol.js
    [--protocol config/recursive-tutor-learning/a18-correctness-gated-protocol.yaml]
    [--config config/recursive-tutor-learning/underdetermined-transfer-families.yaml]
    [--family family_id]

This is zero-API. It validates fixture structure only; it does not generate,
rewrite, score, or panel transcripts.`;
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    protocol: DEFAULT_PROTOCOL,
    config: DEFAULT_CONFIG,
    familyId: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--protocol') args.protocol = path.resolve(argv[++i]);
    else if (token === '--config') args.config = path.resolve(argv[++i]);
    else if (token === '--family') args.familyId = argv[++i];
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  args.protocol = path.resolve(args.protocol);
  args.config = path.resolve(args.config);
  return args;
}

function readYaml(filePath) {
  return yaml.parse(fs.readFileSync(filePath, 'utf8'));
}

function rel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function pushIssue(issues, severity, pathName, message) {
  issues.push({ severity, path: pathName, message });
}

function validateProtocol(protocol, issues) {
  const protocolId = protocol?.meta?.protocol_id;
  if (!ACCEPTED_PROTOCOL_IDS.has(protocolId)) {
    pushIssue(issues, 'error', 'protocol.meta.protocol_id', 'must be A18.16 or A18.22');
  }
  if (!hasText(protocol?.meta?.protocol_version)) {
    pushIssue(issues, 'error', 'protocol.meta.protocol_version', 'is required');
  }
  if (!hasText(protocol?.meta?.frozen_at)) {
    pushIssue(issues, 'error', 'protocol.meta.frozen_at', 'is required');
  }
  const required = protocol?.family_fixture_requirements || {};
  if (required.heldout_policy_correctness_required !== true) {
    pushIssue(
      issues,
      'error',
      'protocol.family_fixture_requirements.heldout_policy_correctness_required',
      'must remain true for A18.16',
    );
  }
  if (!asArray(required.policy_correctness_required_fields).includes('selected_repair')) {
    pushIssue(
      issues,
      'error',
      'protocol.family_fixture_requirements.policy_correctness_required_fields',
      'must include selected_repair',
    );
  }
  if (protocol?.contrast_panel?.min_critics !== 5) {
    pushIssue(issues, 'warning', 'protocol.contrast_panel.min_critics', 'expected 5 for the frozen panel');
  }
  if (protocolId === 'A18.22') {
    if (protocol?.contrast_panel?.vote_rule_name !== 'policy_core_v2') {
      pushIssue(
        issues,
        'error',
        'protocol.contrast_panel.vote_rule_name',
        'must be policy_core_v2 for A18.22',
      );
    }
    if (protocol?.contrast_panel?.vote_rule?.learner_resistance_addressed_side != null) {
      pushIssue(
        issues,
        'error',
        'protocol.contrast_panel.vote_rule.learner_resistance_addressed_side',
        'must not be vote-blocking under A18.22',
      );
    }
    if (protocol?.contrast_panel?.diagnostic_fields?.learner_resistance_addressed_side?.role !== 'diagnostic_caveat') {
      pushIssue(
        issues,
        'error',
        'protocol.contrast_panel.diagnostic_fields.learner_resistance_addressed_side.role',
        'must be diagnostic_caveat under A18.22',
      );
    }
  }
}

function repairIds(family) {
  return new Set(asArray(family.plausible_repairs).map((repair) => repair?.repair_id).filter(Boolean));
}

function validateListMin({ issues, list, min, pathName, noun }) {
  if (asArray(list).length < min) {
    pushIssue(issues, 'error', pathName, `must contain at least ${min} ${noun}`);
  }
}

function validatePolicyCorrectness({ issues, pathName, correctness, selectedRepair, requirements }) {
  if (!correctness || typeof correctness !== 'object') {
    pushIssue(issues, 'error', pathName, 'policy_correctness is required');
    return;
  }
  for (const field of asArray(requirements.policy_correctness_required_fields)) {
    if (correctness[field] == null) pushIssue(issues, 'error', `${pathName}.${field}`, 'is required');
  }
  if (correctness.selected_repair !== selectedRepair) {
    pushIssue(
      issues,
      'error',
      `${pathName}.selected_repair`,
      `must equal transfer_design.policy_selected_repair (${selectedRepair})`,
    );
  }
  if (!hasText(correctness.target_id)) pushIssue(issues, 'error', `${pathName}.target_id`, 'must be non-empty');
  validateListMin({
    issues,
    list: correctness.target_aliases,
    min: requirements.min_target_aliases || 1,
    pathName: `${pathName}.target_aliases`,
    noun: 'target alias',
  });
  validateListMin({
    issues,
    list: correctness.selected_repair_markers,
    min: requirements.min_selected_repair_markers || 1,
    pathName: `${pathName}.selected_repair_markers`,
    noun: 'selected repair marker',
  });
  validateListMin({
    issues,
    list: correctness.incorrect_target_aliases,
    min: requirements.min_incorrect_target_aliases || 1,
    pathName: `${pathName}.incorrect_target_aliases`,
    noun: 'incorrect target alias',
  });
}

function validateFamily({ family, index, protocol }) {
  const issues = [];
  const requirements = protocol.family_fixture_requirements || {};
  const basePath = `families[${index}](${family.family_id || 'missing_family_id'})`;
  const selectedRepair = family.transfer_design?.policy_selected_repair;
  const repairs = repairIds(family);

  if (!hasText(family.family_id)) pushIssue(issues, 'error', `${basePath}.family_id`, 'is required');
  if (!hasText(family.obstruction_type)) pushIssue(issues, 'warning', `${basePath}.obstruction_type`, 'is recommended');
  if (family.transfer_design?.require_underdetermined_public_repairs !== true) {
    pushIssue(
      issues,
      'error',
      `${basePath}.transfer_design.require_underdetermined_public_repairs`,
      'must be true',
    );
  }
  if (!hasText(selectedRepair)) {
    pushIssue(issues, 'error', `${basePath}.transfer_design.policy_selected_repair`, 'is required');
  }
  if (!hasText(family.transfer_design?.transfer_condition)) {
    pushIssue(issues, 'error', `${basePath}.transfer_design.transfer_condition`, 'is required');
  }
  if (!hasText(family.transfer_design?.s0_stop_rule)) {
    pushIssue(issues, 'error', `${basePath}.transfer_design.s0_stop_rule`, 'is required');
  }
  validateListMin({
    issues,
    list: family.plausible_repairs,
    min: requirements.min_plausible_repairs || 3,
    pathName: `${basePath}.plausible_repairs`,
    noun: 'plausible repair',
  });
  if (selectedRepair && !repairs.has(selectedRepair)) {
    pushIssue(
      issues,
      'error',
      `${basePath}.plausible_repairs`,
      `must include selected repair ${selectedRepair}`,
    );
  }
  validateListMin({
    issues,
    list: family.forbidden_shortcuts,
    min: requirements.min_forbidden_shortcuts || 3,
    pathName: `${basePath}.forbidden_shortcuts`,
    noun: 'forbidden shortcut',
  });
  if (requirements.require_training_seed_expected_failure && !hasText(family.training_seed?.expected_failure)) {
    pushIssue(issues, 'error', `${basePath}.training_seed.expected_failure`, 'is required');
  }

  const heldouts = asArray(family.heldout_siblings);
  validateListMin({
    issues,
    list: heldouts,
    min: requirements.min_heldout_siblings || 2,
    pathName: `${basePath}.heldout_siblings`,
    noun: 'held-out sibling',
  });
  heldouts.forEach((sibling, siblingIndex) => {
    const siblingPath = `${basePath}.heldout_siblings[${siblingIndex}](${sibling.sibling_id || 'missing_sibling_id'})`;
    if (!hasText(sibling.sibling_id)) pushIssue(issues, 'error', `${siblingPath}.sibling_id`, 'is required');
    if (!hasText(sibling.expected_baseline_failure)) {
      pushIssue(issues, 'error', `${siblingPath}.expected_baseline_failure`, 'is required');
    }
    if (requirements.heldout_selected_repair_must_be_plausible && !asArray(sibling.plausible_public_repairs).includes(selectedRepair)) {
      pushIssue(
        issues,
        'error',
        `${siblingPath}.plausible_public_repairs`,
        `must include selected repair ${selectedRepair}`,
      );
    }
    validatePolicyCorrectness({
      issues,
      pathName: `${siblingPath}.policy_correctness`,
      correctness: sibling.policy_correctness,
      selectedRepair,
      requirements,
    });
  });

  return {
    family_id: family.family_id || null,
    heldout_siblings: heldouts.length,
    selected_repair: selectedRepair || null,
    status: issues.some((issue) => issue.severity === 'error') ? 'fail' : 'pass',
    issues,
  };
}

export function validateRecursiveTutorProtocol({ protocolPath = DEFAULT_PROTOCOL, configPath = DEFAULT_CONFIG, familyId = null } = {}) {
  const protocol = readYaml(protocolPath);
  const config = readYaml(configPath);
  const protocolIssues = [];
  validateProtocol(protocol, protocolIssues);
  const families = asArray(config.families).filter((family) => !familyId || family.family_id === familyId);
  const familyReports = families.map((family, index) => validateFamily({ family, index, protocol }));
  if (familyId && !familyReports.length) {
    familyReports.push({
      family_id: familyId,
      heldout_siblings: 0,
      selected_repair: null,
      status: 'fail',
      issues: [{ severity: 'error', path: 'families', message: `family not found: ${familyId}` }],
    });
  }
  const allIssues = [...protocolIssues, ...familyReports.flatMap((family) => family.issues)];
  const errors = allIssues.filter((issue) => issue.severity === 'error');
  return {
    kind: 'a18_16_recursive_tutor_protocol_validation',
    protocol: rel(protocolPath),
    config: rel(configPath),
    family_filter: familyId,
    protocol_version: protocol?.meta?.protocol_version || null,
    status: errors.length ? 'fail' : 'pass',
    summary: {
      protocol_issues: protocolIssues.length,
      families_checked: familyReports.length,
      errors: errors.length,
      warnings: allIssues.filter((issue) => issue.severity === 'warning').length,
    },
    protocol_issues: protocolIssues,
    families: familyReports,
  };
}

async function main() {
  try {
    const args = parseArgs();
    if (args.help) {
      console.log(usage());
      return;
    }
    const report = validateRecursiveTutorProtocol({
      protocolPath: args.protocol,
      configPath: args.config,
      familyId: args.familyId,
    });
    console.log(JSON.stringify(report, null, 2));
    if (report.status !== 'pass') process.exitCode = 1;
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  await main();
}
