#!/usr/bin/env node
/**
 * A19 zero-API protocol validator.
 *
 * Validates teaching-drama axiom fixtures and computes fixture-level card
 * verdicts. It does not generate, judge, panel, retrieve, or train.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_PROTOCOL = path.join(ROOT, 'config', 'teaching-drama-axioms', 'a19-protocol.yaml');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'teaching-drama-axioms', 'pilot-families.yaml');
const REQUIRED_NON_CLAIMS = ['human_learning', 'deployed_adaptive_tutor', 'model_weight_learning', 'main_harness_rate_effect'];
const REQUIRED_WITHHELD = ['target_aliases', 'decoy_aliases', 'arm_provenance', 'policy_memory_condition'];

function usage() {
  return `Usage:
  node scripts/validate-teaching-drama-axiom-protocol.js
    [--protocol config/teaching-drama-axioms/a19-protocol.yaml]
    [--config config/teaching-drama-axioms/pilot-families.yaml]
    [--family family_id]
    [--json]

This is zero-API. It validates A19 teaching-drama axiom fixture structure only.`;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    protocol: DEFAULT_PROTOCOL,
    config: DEFAULT_CONFIG,
    familyId: null,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--protocol') args.protocol = path.resolve(argv[++i]);
    else if (token === '--config') args.config = path.resolve(argv[++i]);
    else if (token === '--family') args.familyId = argv[++i];
    else if (token === '--json') args.json = true;
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  return args;
}

function readYaml(filePath) {
  return yaml.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
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

function clean(value) {
  return String(value || '').trim().toLowerCase();
}

function pushIssue(issues, severity, pathName, message, evidence = {}) {
  issues.push({ severity, path: pathName, message, evidence });
}

function includesAll(haystack, needles) {
  const set = new Set(asArray(haystack));
  return needles.every((needle) => set.has(needle));
}

function publicFields(family, sibling = null) {
  const rows = [];
  const add = (caseId, field, text) => rows.push({ case_id: caseId, field, text: String(text || '') });
  if (family.training_seed) {
    const seedId = family.training_seed.seed_id || 'training_seed';
    for (const field of ['public_setup', 'learner_resistance']) add(seedId, field, family.training_seed[field]);
  }
  if (sibling) {
    for (const field of ['public_setup']) add(sibling.sibling_id || 'heldout', field, sibling[field]);
  }
  return rows;
}

function markerPublicHits(family, sibling, markers) {
  const hits = [];
  for (const row of publicFields(family, sibling)) {
    const text = clean(row.text);
    for (const marker of markers.map(clean).filter(Boolean)) {
      if (text.includes(marker)) hits.push({ ...row, marker });
    }
  }
  return hits;
}

function overlap(a, b) {
  const left = new Set(asArray(a).map(clean).filter(Boolean));
  return asArray(b)
    .map(clean)
    .filter((value) => left.has(value));
}

export function classifyCardVerdict(card, protocol = {}) {
  const allowedFlags = protocol?.classification || {};
  const cueLeakFlags = new Set(asArray(allowedFlags.cue_leak_artifact_flags));
  const arbiterFlags = new Set(asArray(allowedFlags.arbiter_disagreement_flags));
  const selfSolveBasis = new Set(asArray(allowedFlags.self_solve_basis_labels));

  if (!card || card.protocol_reject === true) return 'protocol_reject';

  const s0 = card.fixture_adjudication?.s0 || {};
  const s1 = card.fixture_adjudication?.s1 || {};
  const flags = [...asArray(s0.artifact_flags), ...asArray(s1.artifact_flags)];

  if (flags.some((flag) => cueLeakFlags.has(flag))) return 'cue_leak';
  if (flags.some((flag) => arbiterFlags.has(flag))) return 'arbiter_disagreement';

  const s0Class = s0.committed_option_class;
  const s1Class = s1.committed_option_class;

  if (s0Class === 'neither' && s1Class === 'neither') return 'neither_correct';
  if (s1Class !== 'target') return 'policy_failure';
  if (s0Class === 'target' && (s0.self_solve === true || selfSolveBasis.has(s0.basis_label))) return 'self_solve';
  if (s0Class === 'target') return 'ceiling';
  if (s1Class === 'target') return 'policy_headroom';
  return 'protocol_reject';
}

function validateProtocol(protocol, issues) {
  if (protocol?.meta?.protocol_id !== 'A19') {
    pushIssue(issues, 'error', 'protocol.meta.protocol_id', 'must be A19');
  }
  for (const field of ['protocol_version', 'frozen_at', 'claim_boundary', 'purpose']) {
    if (!hasText(protocol?.meta?.[field])) pushIssue(issues, 'error', `protocol.meta.${field}`, 'is required');
  }
  if (!includesAll(protocol?.scope?.does_not_claim, REQUIRED_NON_CLAIMS)) {
    pushIssue(issues, 'error', 'protocol.scope.does_not_claim', 'must include all inherited A18 non-claims', {
      required: REQUIRED_NON_CLAIMS,
    });
  }
  if (protocol?.scope?.downstream_requires_canonical_paper_first !== true) {
    pushIssue(
      issues,
      'error',
      'protocol.scope.downstream_requires_canonical_paper_first',
      'must remain true',
    );
  }
  if (!asArray(protocol?.headroom_verdicts).includes('protocol_reject')) {
    pushIssue(issues, 'error', 'protocol.headroom_verdicts', 'must include protocol_reject');
  }
  if (protocol?.classification?.report_discipline?.no_pooled_rate_without_card_basis !== true) {
    pushIssue(
      issues,
      'error',
      'protocol.classification.report_discipline.no_pooled_rate_without_card_basis',
      'must remain true',
    );
  }
}

function validateKnownLabel({ issues, protocol, group, value, pathName }) {
  if (!hasText(value)) {
    pushIssue(issues, 'error', pathName, 'is required');
    return;
  }
  const allowed = asArray(protocol?.allowed_labels?.[group]);
  if (allowed.length && !allowed.includes(value)) {
    pushIssue(issues, 'error', pathName, `unknown ${group}: ${value}`, { allowed });
  }
}

function validateFamily({ family, index, protocol }) {
  const issues = [];
  const base = `families[${index}](${family?.family_id || 'missing_family_id'})`;
  const req = protocol.family_fixture_requirements || {};

  if (!hasText(family?.family_id)) pushIssue(issues, 'error', `${base}.family_id`, 'is required');
  validateKnownLabel({
    issues,
    protocol,
    group: 'learner_resistance_type',
    value: family?.learner_resistance_type,
    pathName: `${base}.learner_resistance_type`,
  });
  validateKnownLabel({
    issues,
    protocol,
    group: 'tutor_infelicity_type',
    value: family?.tutor_infelicity_type,
    pathName: `${base}.tutor_infelicity_type`,
  });

  if (!family?.training_seed) pushIssue(issues, 'error', `${base}.training_seed`, 'is required');
  for (const field of ['seed_id', 'public_setup', 'learner_resistance', 'expected_failure', 'old_rule_decoy']) {
    if (!hasText(family?.training_seed?.[field])) pushIssue(issues, 'error', `${base}.training_seed.${field}`, 'is required');
  }

  const policy = family?.target_policy || {};
  for (const field of ['policy_id', 'trigger', 'avoid_move', 'preferred_move']) {
    if (!hasText(policy[field])) pushIssue(issues, 'error', `${base}.target_policy.${field}`, 'is required');
  }
  validateKnownLabel({ issues, protocol, group: 'repair_type', value: policy.repair_type, pathName: `${base}.target_policy.repair_type` });

  if (asArray(policy.applicability_conditions).length < (req.min_applicability_conditions || 1)) {
    pushIssue(issues, 'error', `${base}.target_policy.applicability_conditions`, 'must include applicability conditions');
  }
  if (asArray(policy.anti_conditions).length < (req.min_anti_conditions || 1)) {
    pushIssue(issues, 'error', `${base}.target_policy.anti_conditions`, 'must include anti-conditions');
  }
  if (asArray(family?.plausible_repairs).length < (req.min_plausible_repairs || 3)) {
    pushIssue(issues, 'error', `${base}.plausible_repairs`, `must include at least ${req.min_plausible_repairs || 3} repairs`);
  }
  if (!family?.cue_map) pushIssue(issues, 'error', `${base}.cue_map`, 'is required');
  if (family?.cue_map && typeof family.cue_map.counterexample_present !== 'boolean') {
    pushIssue(issues, 'error', `${base}.cue_map.counterexample_present`, 'must be boolean');
  }

  const siblings = asArray(family?.heldout_siblings);
  if (siblings.length < (req.min_heldout_siblings || 2)) {
    pushIssue(issues, 'error', `${base}.heldout_siblings`, `must contain at least ${req.min_heldout_siblings || 2} siblings`);
  }

  const cards = [];
  siblings.forEach((sibling, siblingIndex) => {
    const sbase = `${base}.heldout_siblings[${siblingIndex}](${sibling?.sibling_id || 'missing_sibling_id'})`;
    if (!hasText(sibling?.sibling_id)) pushIssue(issues, 'error', `${sbase}.sibling_id`, 'is required');
    for (const field of ['public_setup', 'headroom_prediction']) {
      if (!hasText(sibling?.[field])) pushIssue(issues, 'error', `${sbase}.${field}`, 'is required');
    }
    if (asArray(sibling?.target_aliases).length < (req.min_target_aliases || 1)) {
      pushIssue(issues, 'error', `${sbase}.target_aliases`, 'must include target aliases');
    }
    if (asArray(sibling?.decoy_aliases).length < (req.min_decoy_aliases || 1)) {
      pushIssue(issues, 'error', `${sbase}.decoy_aliases`, 'must include decoy aliases');
    }
    const aliasOverlap = overlap(sibling?.target_aliases, sibling?.decoy_aliases);
    if (aliasOverlap.length) {
      pushIssue(issues, 'error', `${sbase}.target_aliases`, 'target and decoy aliases must not overlap', { overlap: aliasOverlap });
    }
    if (!includesAll(sibling?.blind_adjudication?.withhold_from_critic, REQUIRED_WITHHELD)) {
      pushIssue(issues, 'error', `${sbase}.blind_adjudication.withhold_from_critic`, 'must withhold aliases, provenance, and policy condition', {
        required: REQUIRED_WITHHELD,
      });
    }
    const markerHits = markerPublicHits(family, sibling, asArray(sibling?.selected_policy_markers));
    if (markerHits.length) {
      pushIssue(issues, 'error', `${sbase}.selected_policy_markers`, 'selected policy markers appear in public seed/sibling fields', {
        hits: markerHits,
      });
    }
    for (const arm of ['s0', 's1']) {
      const armPath = `${sbase}.fixture_adjudication.${arm}`;
      const value = sibling?.fixture_adjudication?.[arm]?.committed_option_class;
      if (!asArray(protocol?.classification?.option_classes).includes(value)) {
        pushIssue(issues, 'error', `${armPath}.committed_option_class`, 'must be target, decoy, or neither');
      }
      if (!hasText(sibling?.fixture_adjudication?.[arm]?.basis_label)) {
        pushIssue(issues, 'error', `${armPath}.basis_label`, 'is required');
      }
    }
    const verdict = classifyCardVerdict(sibling, protocol);
    if (sibling?.fixture_adjudication?.expected_card_verdict && sibling.fixture_adjudication.expected_card_verdict !== verdict) {
      pushIssue(issues, 'error', `${sbase}.fixture_adjudication.expected_card_verdict`, 'does not match classifier output', {
        expected_card_verdict: sibling.fixture_adjudication.expected_card_verdict,
        classifier_verdict: verdict,
      });
    }
    cards.push({ sibling_id: sibling?.sibling_id, verdict, expected: sibling?.fixture_adjudication?.expected_card_verdict || null });
  });

  return { family_id: family?.family_id || null, issues, cards };
}

export function validateTeachingDramaAxiomProtocol({
  protocolPath = DEFAULT_PROTOCOL,
  configPath = DEFAULT_CONFIG,
  familyId = null,
} = {}) {
  const protocol = readYaml(protocolPath);
  const config = readYaml(configPath);
  const protocolIssues = [];
  validateProtocol(protocol, protocolIssues);

  const meta = config?.meta || {};
  if (meta.schema_version !== protocol?.family_fixture_requirements?.schema_version) {
    pushIssue(protocolIssues, 'error', 'families.meta.schema_version', 'must match protocol schema version', {
      expected: protocol?.family_fixture_requirements?.schema_version,
      actual: meta.schema_version,
    });
  }
  if (meta.protocol_id !== 'A19') pushIssue(protocolIssues, 'error', 'families.meta.protocol_id', 'must be A19');
  if (!hasText(meta.protocol_version)) pushIssue(protocolIssues, 'error', 'families.meta.protocol_version', 'is required');
  if (!hasText(meta.prompt_version)) pushIssue(protocolIssues, 'error', 'families.meta.prompt_version', 'is required');
  if (meta.no_model_calls !== true) pushIssue(protocolIssues, 'error', 'families.meta.no_model_calls', 'must be true for scaffold fixtures');

  const selectedFamilies = asArray(config?.families).filter((family) => !familyId || family.family_id === familyId);
  if (!selectedFamilies.length) {
    pushIssue(protocolIssues, 'error', 'families', familyId ? `no family found for ${familyId}` : 'must include families');
  }
  if (!familyId && selectedFamilies.length < (protocol?.family_fixture_requirements?.min_families || 1)) {
    pushIssue(protocolIssues, 'error', 'families', 'does not meet minimum family count');
  }

  const familyReports = selectedFamilies.map((family, index) => validateFamily({ family, index, protocol }));
  const allIssues = [...protocolIssues, ...familyReports.flatMap((report) => report.issues)];
  const errors = allIssues.filter((issue) => issue.severity === 'error').length;
  const warnings = allIssues.filter((issue) => issue.severity === 'warning').length;
  const cards = familyReports.flatMap((report) => report.cards.map((card) => ({ family_id: report.family_id, ...card })));
  const verdict_counts = {};
  for (const card of cards) verdict_counts[card.verdict] = (verdict_counts[card.verdict] || 0) + 1;

  return {
    status: errors ? 'fail' : 'pass',
    protocol_id: protocol?.meta?.protocol_id,
    protocol_version: protocol?.meta?.protocol_version,
    family_schema_version: meta.schema_version || null,
    provenance: {
      protocol_path: rel(protocolPath),
      protocol_sha256: sha256File(protocolPath),
      config_path: rel(configPath),
      config_sha256: sha256File(configPath),
      validator: 'scripts/validate-teaching-drama-axiom-protocol.js',
      zero_api: true,
    },
    summary: {
      errors,
      warnings,
      families: familyReports.length,
      cards: cards.length,
      verdict_counts,
    },
    issues: allIssues,
    families: familyReports,
    cards,
    non_claims: REQUIRED_NON_CLAIMS,
  };
}

function main() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const report = validateTeachingDramaAxiomProtocol({
    protocolPath: args.protocol,
    configPath: args.config,
    familyId: args.familyId,
  });
  if (args.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`A19 teaching-drama axiom protocol: ${report.status}\n`);
    process.stdout.write(`families=${report.summary.families} cards=${report.summary.cards} errors=${report.summary.errors} warnings=${report.summary.warnings}\n`);
    for (const [verdict, count] of Object.entries(report.summary.verdict_counts)) {
      process.stdout.write(`  ${verdict}: ${count}\n`);
    }
    for (const issue of report.issues) {
      process.stdout.write(`[${issue.severity}] ${issue.path}: ${issue.message}\n`);
    }
  }
  if (report.status !== 'pass') process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
