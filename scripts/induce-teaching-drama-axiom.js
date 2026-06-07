#!/usr/bin/env node
/**
 * A19 teaching-drama axiom inducer and deterministic gate.
 *
 * Reads a survived attempt-1 replay artifact and distills exactly one typed
 * axiom. This script is intentionally report/gate oriented: it does not call a
 * model, does not retrieve, and does not train. The admitted JSON record is the
 * only policy-memory form that may count as A19 S1 input.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'yaml';
import { validateTeachingDramaAxiomProtocol } from './validate-teaching-drama-axiom-protocol.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_PROTOCOL = path.join(ROOT, 'config', 'teaching-drama-axioms', 'a19-protocol.yaml');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'teaching-drama-axioms', 'pilot-families.yaml');
const DEFAULT_OUT_DIR = path.join(ROOT, 'exports', 'a19', 'axioms');
const PROMPT_PATH = path.join(ROOT, 'prompts', 'a19', 'axiom-inducer.md');

const REQUIRED_EVIDENCE_KINDS = ['attempt1_failure', 'old_rule_decoy', 'replacement_move', 'learner_feedback'];

function usage() {
  return `Usage:
  node scripts/induce-teaching-drama-axiom.js
    --family family_id
    --attempt1-dir exports/a19/real-attempt1/family
    [--protocol config/teaching-drama-axioms/a19-protocol.yaml]
    [--config config/teaching-drama-axioms/pilot-families.yaml]
    [--out exports/a19/axioms/family/axiom.json]
    [--memory-jsonl exports/a19/axioms/admitted-axioms.jsonl]
    [--json] [--force]

This is zero-API. It gates an already generated attempt-1 artifact into exactly
one teaching-drama axiom suitable for A19 S1 policy memory.`;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    protocol: DEFAULT_PROTOCOL,
    config: DEFAULT_CONFIG,
    familyId: null,
    attempt1Dir: null,
    out: null,
    memoryJsonl: null,
    json: false,
    force: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--protocol') args.protocol = path.resolve(argv[++i]);
    else if (token === '--config') args.config = path.resolve(argv[++i]);
    else if (token === '--family') args.familyId = argv[++i];
    else if (token === '--attempt1-dir') args.attempt1Dir = path.resolve(argv[++i]);
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else if (token === '--memory-jsonl') args.memoryJsonl = path.resolve(argv[++i]);
    else if (token === '--json') args.json = true;
    else if (token === '--force') args.force = true;
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  if (args.help) return args;
  if (!args.familyId) throw new Error(`--family is required\n\n${usage()}`);
  if (!args.attempt1Dir) throw new Error(`--attempt1-dir is required\n\n${usage()}`);
  if (!fs.existsSync(args.attempt1Dir)) throw new Error(`attempt1 dir not found: ${args.attempt1Dir}`);
  args.out = args.out || path.join(DEFAULT_OUT_DIR, safeSlug(args.familyId), 'axiom.json');
  return args;
}

function readYaml(filePath) {
  return yaml.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data, { force = false } = {}) {
  if (fs.existsSync(filePath) && !force) throw new Error(`output exists: ${filePath} (pass --force to overwrite)`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function rel(filePath) {
  if (!filePath) return null;
  return path.relative(ROOT, path.resolve(filePath));
}

function safeSlug(value) {
  return String(value || 'missing')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function sha256Short(text) {
  return crypto
    .createHash('sha256')
    .update(String(text || ''))
    .digest('hex')
    .slice(0, 16);
}

function selectedFamily(configPath, familyId) {
  const config = readYaml(configPath);
  const family = asArray(config?.families).find((candidate) => candidate.family_id === familyId);
  if (!family) throw new Error(`family not found: ${familyId}`);
  return family;
}

function manifestCandidates(attempt1Dir) {
  return [
    path.join(attempt1Dir, 'manifest.json'),
    path.join(attempt1Dir, 'attempt1.full', 'manifest.json'),
    path.join(attempt1Dir, 'attempt1-replay', 'manifest.json'),
  ];
}

function firstExisting(paths) {
  return paths.find((candidate) => fs.existsSync(candidate)) || null;
}

function loadAttempt1Record(attempt1Dir) {
  const manifestPath = firstExisting(manifestCandidates(attempt1Dir));
  if (!manifestPath) {
    throw new Error(`attempt1 manifest not found under ${attempt1Dir}`);
  }
  const manifest = readJson(manifestPath);
  const record = asArray(manifest.records)[0] || manifest;
  const revisionPath = record?.paths?.revisionJson || null;
  const revisedPublicPath = record?.paths?.revisedPublic || null;
  return {
    manifest,
    manifestPath,
    record,
    revisionPath,
    revisedPublicPath,
    revision: revisionPath && fs.existsSync(revisionPath) ? readJson(revisionPath) : null,
    revisedPublic:
      revisedPublicPath && fs.existsSync(revisedPublicPath) ? fs.readFileSync(revisedPublicPath, 'utf8') : '',
  };
}

function firstLedgerQuote(revision, keys) {
  const ledgers = [...asArray(revision?.move_ledger), ...asArray(revision?.tutor_learning_ledger)];
  for (const entry of ledgers) {
    for (const key of keys) {
      const value = entry?.[key];
      if (hasText(value)) return value;
      if (value && typeof value === 'object') {
        for (const nestedValue of Object.values(value)) {
          if (hasText(nestedValue)) return nestedValue;
        }
      }
    }
  }
  return null;
}

function finalLearnerLine(publicText) {
  const matches = [...String(publicText || '').matchAll(/^LEARNER:\s*(.+)$/gim)];
  return matches.length ? matches[matches.length - 1][1] : null;
}

function buildEvidenceSpans({ family, recordBundle }) {
  const revision = recordBundle.revision || {};
  const recursive = recordBundle.record?.check?.recursive_tutor_learning || {};
  return [
    {
      kind: 'attempt1_failure',
      source: 'training_seed.learner_resistance',
      quote: family.training_seed?.learner_resistance || null,
    },
    {
      kind: 'old_rule_decoy',
      source: 'attempt1.check.recursive_tutor_learning.tutor_prior_strategy',
      quote: recursive.tutor_prior_strategy || family.training_seed?.old_rule_decoy || null,
    },
    {
      kind: 'replacement_move',
      source: 'attempt1.check.recursive_tutor_learning.strategy_revision',
      quote:
        recursive.strategy_revision ||
        firstLedgerQuote(revision, ['revised_strategy', 'tutor_revision', 'public_action']) ||
        family.target_policy?.preferred_move ||
        null,
    },
    {
      kind: 'learner_feedback',
      source: 'attempt1.check.recursive_tutor_learning.downstream_feedback',
      quote:
        recursive.downstream_feedback ||
        firstLedgerQuote(revision, ['learner_actional_uptake', 'learner_self_reframe']) ||
        finalLearnerLine(recordBundle.revisedPublic) ||
        null,
    },
  ];
}

function gateIssue(issues, code, pathName, message, evidence = {}) {
  issues.push({ code, path: pathName, message, evidence });
}

const GENERIC_ADVICE_RE =
  /\b(?:be clear|explain better|encourage|support|be patient|ask questions|slow down|check in|build rapport)\b/i;
const HIDDEN_STATE_RE = /\b(?:hidden state|private state|inner state|unobservable|secret|omniscient)\b/i;

export function validateTeachingDramaAxiomMemory(record) {
  const issues = [];
  if (record?.schema_version !== 'a19-teaching-drama-axiom-v0.1') {
    gateIssue(issues, 'not_single_teaching_drama_axiom', 'schema_version', 'must be a19-teaching-drama-axiom-v0.1');
  }
  if (record?.revised_public_transcript || record?.move_ledger || record?.tutor_learning_ledger) {
    gateIssue(
      issues,
      'full_revision_bundle_not_allowed',
      'policy_memory',
      'S1 policy memory must be one typed axiom, not a full revision bundle',
    );
  }
  for (const field of ['axiom_id', 'family_id', 'trigger', 'avoided_move', 'replacement_move', 'repair_type']) {
    if (!hasText(record?.[field])) gateIssue(issues, 'missing_required_field', field, 'is required');
  }
  if (!asArray(record?.applicability_conditions).length) {
    gateIssue(issues, 'missing_applicability_conditions', 'applicability_conditions', 'must not be empty');
  }
  if (!asArray(record?.anti_conditions).length) {
    gateIssue(issues, 'missing_anti_conditions', 'anti_conditions', 'must not be empty');
  }
  if (GENERIC_ADVICE_RE.test(record?.replacement_move || '')) {
    gateIssue(issues, 'generic_advice', 'replacement_move', 'replacement move is too generic');
  }
  const publicOnlyText = [
    record?.trigger,
    record?.avoided_move,
    record?.replacement_move,
    ...asArray(record?.applicability_conditions),
    ...asArray(record?.anti_conditions),
  ].join('\n');
  if (HIDDEN_STATE_RE.test(publicOnlyText)) {
    gateIssue(issues, 'hidden_state_basis', 'axiom', 'axiom must be grounded in public evidence, not hidden state');
  }
  const evidenceKinds = new Set(
    asArray(record?.evidence_spans)
      .map((entry) => entry?.kind)
      .filter(Boolean),
  );
  for (const kind of REQUIRED_EVIDENCE_KINDS) {
    if (!evidenceKinds.has(kind)) gateIssue(issues, 'missing_evidence_kind', 'evidence_spans', `missing ${kind}`);
  }
  for (const [index, span] of asArray(record?.evidence_spans).entries()) {
    if (!hasText(span?.quote))
      gateIssue(issues, 'missing_evidence_quote', `evidence_spans[${index}].quote`, 'is required');
    if (!hasText(span?.source))
      gateIssue(issues, 'missing_evidence_source', `evidence_spans[${index}].source`, 'is required');
    if (HIDDEN_STATE_RE.test(span?.quote || '')) {
      gateIssue(issues, 'hidden_state_evidence', `evidence_spans[${index}].quote`, 'must not cite hidden state');
    }
  }
  if (record?.source_attempt1?.gate_status !== 'survivor') {
    gateIssue(issues, 'attempt1_not_survivor', 'source_attempt1.gate_status', 'must be survivor');
  }
  if (record?.source_attempt1?.generator_backend === 'mock' || record?.source_attempt1?.checker_backend === 'mock') {
    gateIssue(
      issues,
      'mock_source_not_empirical',
      'source_attempt1',
      'mock-backed source cannot admit empirical S1 axiom',
    );
  }
  if (record?.policy_memory_contract?.memory_unit !== 'single_teaching_drama_axiom') {
    gateIssue(issues, 'wrong_memory_unit', 'policy_memory_contract.memory_unit', 'must be single_teaching_drama_axiom');
  }
  if (record?.policy_memory_contract?.full_revision_bundle_allowed !== false) {
    gateIssue(
      issues,
      'full_revision_bundle_not_for_s1',
      'policy_memory_contract.full_revision_bundle_allowed',
      'must be false',
    );
  }
  return {
    status: issues.length ? 'fail' : 'pass',
    issues,
  };
}

export function induceTeachingDramaAxiom({
  protocolPath = DEFAULT_PROTOCOL,
  configPath = DEFAULT_CONFIG,
  familyId,
  attempt1Dir,
} = {}) {
  const validation = validateTeachingDramaAxiomProtocol({ protocolPath, configPath, familyId });
  if (validation.status !== 'pass') {
    throw new Error(`static protocol validation failed for ${familyId}`);
  }
  const family = selectedFamily(configPath, familyId);
  const recordBundle = loadAttempt1Record(attempt1Dir);
  const record = recordBundle.record || {};
  const policy = family.target_policy || {};
  const promptText = fs.existsSync(PROMPT_PATH) ? fs.readFileSync(PROMPT_PATH, 'utf8') : '';
  const axiom = {
    schema_version: 'a19-teaching-drama-axiom-v0.1',
    axiom_id: `a19_${family.family_id}_${policy.policy_id || 'policy'}_001`,
    status: 'candidate',
    family_id: family.family_id,
    title: family.title || null,
    domain: family.domain || null,
    training_seed_id: family.training_seed?.seed_id || null,
    trigger: policy.trigger || null,
    avoided_move: policy.avoid_move || null,
    replacement_move: policy.preferred_move || null,
    applicability_conditions: asArray(policy.applicability_conditions),
    anti_conditions: asArray(policy.anti_conditions),
    repair_type: policy.repair_type || null,
    source_attempt1: {
      gate_status: record?.gate?.status || null,
      recommended_action: record?.check?.recommended_action || null,
      generator_backend: record?.generator?.backend || recordBundle.manifest?.generator || null,
      checker_backend: record?.checker?.backend || recordBundle.manifest?.checker || null,
      manifest_path: rel(recordBundle.manifestPath),
      revision_json_path: rel(recordBundle.revisionPath),
      revised_public_path: rel(recordBundle.revisedPublicPath),
      manifest_sha256: recordBundle.manifestPath ? sha256File(recordBundle.manifestPath) : null,
      revision_json_sha256:
        recordBundle.revisionPath && fs.existsSync(recordBundle.revisionPath)
          ? sha256File(recordBundle.revisionPath)
          : null,
      prompt_hashes: {
        generator: record?.generator?.promptHashes || null,
        checker: record?.checker?.promptHashes || null,
        inducer_prompt_sha256: sha256Short(promptText),
      },
    },
    evidence_spans: buildEvidenceSpans({ family, recordBundle }),
    policy_memory_contract: {
      memory_unit: 'single_teaching_drama_axiom',
      s1_insertion_limit: 1,
      full_revision_bundle_allowed: false,
      aliases_visible_to_s1: false,
      scope: 'one held-out S0/S1 contrast before any corpus use',
    },
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    claims_not_licensed: [
      'human_learning',
      'deployed_adaptive_tutor',
      'model_weight_learning',
      'main_harness_rate_effect',
      'held_out_transfer_claim_without_blind_adjudication',
    ],
  };
  const gate = validateTeachingDramaAxiomMemory(axiom);
  axiom.status = gate.status === 'pass' ? 'admitted' : 'rejected';
  axiom.gate = gate;
  return axiom;
}

export function runAxiomInduction(rawArgs = process.argv.slice(2)) {
  const args = Array.isArray(rawArgs) ? parseArgs(rawArgs) : { ...parseArgs([]), ...rawArgs };
  if (args.help) return { help: usage() };
  const axiom = induceTeachingDramaAxiom({
    protocolPath: args.protocol,
    configPath: args.config,
    familyId: args.familyId,
    attempt1Dir: args.attempt1Dir,
  });
  writeJson(args.out, axiom, { force: args.force });
  if (args.memoryJsonl && axiom.status === 'admitted') {
    fs.mkdirSync(path.dirname(args.memoryJsonl), { recursive: true });
    fs.appendFileSync(args.memoryJsonl, `${JSON.stringify(axiom)}\n`, 'utf8');
  }
  if (!args.json) {
    process.stdout.write(
      `A19 axiom induction: ${axiom.gate.status}\n` +
        `family=${axiom.family_id} status=${axiom.status} out=${rel(args.out)}\n`,
    );
    for (const issue of axiom.gate.issues) process.stdout.write(`[${issue.code}] ${issue.path}: ${issue.message}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(axiom, null, 2)}\n`);
  }
  return axiom;
}

function main() {
  const result = runAxiomInduction();
  if (result.help) {
    process.stdout.write(`${result.help}\n`);
    return;
  }
  if (result.gate?.status !== 'pass') process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
