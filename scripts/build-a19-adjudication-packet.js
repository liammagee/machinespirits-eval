#!/usr/bin/env node
/**
 * Build a blinded A19 adjudication packet.
 *
 * This prepares infrastructure for later multi-critic or human double-coding.
 * It does not call a model, collect judgments, or license panel evidence.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PANEL = path.join(ROOT, 'config', 'teaching-drama-axioms', 'a19-adjudication-panel.yaml');

function usage() {
  return `Usage:
  node scripts/build-a19-adjudication-packet.js \\
    --s0 path/to/s0/revised-public.txt --s1 path/to/s1/revised-public.txt \\
    --family-id FAMILY --sibling-id SIBLING \\
    --target-aliases "target one|target two" --decoy-aliases "decoy one" \\
    --target-repair-type instructional_contract_repair \\
    --decoy-repair-types "transfer_control|repeat_explanation" \\
    [--option-space "repair A | repair B | repair C"] [--out exports/a19/adjudication-packets/packet.json]

Offline only. The coder packet withholds target/decoy aliases, arm provenance,
policy-memory condition, and repair-type answer key.`;
}

function splitList(value) {
  return String(value || '')
    .split('|')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    panel: DEFAULT_PANEL,
    s0: null,
    s1: null,
    familyId: null,
    siblingId: null,
    targetAliases: [],
    decoyAliases: [],
    targetRepairType: null,
    decoyRepairTypes: [],
    optionSpace: 'repair A | repair B | repair C',
    out: null,
    runId: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--panel') args.panel = path.resolve(argv[++i]);
    else if (token === '--s0') args.s0 = path.resolve(argv[++i]);
    else if (token === '--s1') args.s1 = path.resolve(argv[++i]);
    else if (token === '--family-id') args.familyId = argv[++i];
    else if (token === '--sibling-id') args.siblingId = argv[++i];
    else if (token === '--target-aliases') args.targetAliases = splitList(argv[++i]);
    else if (token === '--decoy-aliases') args.decoyAliases = splitList(argv[++i]);
    else if (token === '--target-repair-type') args.targetRepairType = argv[++i];
    else if (token === '--decoy-repair-types') args.decoyRepairTypes = splitList(argv[++i]);
    else if (token === '--option-space') args.optionSpace = argv[++i];
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else if (token === '--run-id') args.runId = argv[++i];
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  if (args.help) return args;
  for (const [key, value] of [
    ['--s0', args.s0],
    ['--s1', args.s1],
    ['--family-id', args.familyId],
    ['--sibling-id', args.siblingId],
    ['--target-repair-type', args.targetRepairType],
  ]) {
    if (!value) throw new Error(`${key} is required\n\n${usage()}`);
  }
  if (!args.targetAliases.length) throw new Error('--target-aliases is required');
  if (!args.decoyAliases.length) throw new Error('--decoy-aliases is required');
  if (!fs.existsSync(args.s0)) throw new Error(`S0 transcript not found: ${args.s0}`);
  if (!fs.existsSync(args.s1)) throw new Error(`S1 transcript not found: ${args.s1}`);
  args.runId = args.runId || `a19-adjudication-${args.familyId}-${args.siblingId}`;
  args.out =
    args.out ||
    path.join(ROOT, 'exports', 'a19', 'adjudication-packets', `${args.familyId}-${args.siblingId}.packet.json`);
  return args;
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function repoRel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

function normalize(text) {
  return String(text || '').toLowerCase();
}

function visibleAliasHits(text, aliases) {
  const lower = normalize(text);
  return aliases
    .filter((alias) => alias && lower.includes(normalize(alias)))
    .map((alias) => ({ alias, sha256: sha256(alias).slice(0, 16) }));
}

function responseSchemaFromPanel(panel) {
  const dimensions = panel.coding_dimensions || {};
  return {
    arm_label: 'arm_A_or_arm_B',
    committed_option_class: dimensions.committed_option_class?.allowed || ['target', 'decoy', 'neither', 'unclear'],
    committed_repair: 'short public description of the repair the tutor commits to',
    repair_type: dimensions.repair_type?.allowed || ['other', 'unclear'],
    basis_label: dimensions.basis_label?.allowed || ['unclear'],
    confidence: dimensions.confidence?.allowed || ['low', 'medium', 'high'],
    span_evidence: 'exact public sentence or short span supporting the code',
    artifact_flags: dimensions.artifact_flags?.allowed || ['none'],
  };
}

export function buildAdjudicationPacket(args) {
  const panel = yaml.parse(fs.readFileSync(args.panel, 'utf8'));
  const s0Text = fs.readFileSync(args.s0, 'utf8');
  const s1Text = fs.readFileSync(args.s1, 'utf8');
  const aliases = [...args.targetAliases, ...args.decoyAliases];
  const armA = {
    arm_label: 'arm_A',
    transcript: s0Text,
    transcript_sha256: sha256(s0Text),
  };
  const armB = {
    arm_label: 'arm_B',
    transcript: s1Text,
    transcript_sha256: sha256(s1Text),
  };
  const coderPacket = {
    packet_schema_version: 'a19-adjudication-coder-packet-v0.1',
    instructions: [
      'Read each arm independently.',
      'Use only the public transcript and neutral option space.',
      'Do not infer which arm had policy memory.',
      'Return one JSON object per arm using the response schema.',
    ],
    neutral_option_space: args.optionSpace,
    arms: [armA, armB],
    response_schema: responseSchemaFromPanel(panel),
  };
  const visibleText = JSON.stringify(coderPacket);
  const audit = {
    target_aliases_visible_in_metadata: false,
    decoy_aliases_visible_in_metadata: false,
    arm_provenance_visible_to_coder: false,
    policy_memory_condition_visible_to_coder: false,
    visible_alias_hits_in_public_transcripts: [
      ...visibleAliasHits(s0Text, aliases).map((hit) => ({ ...hit, arm_label: 'arm_A' })),
      ...visibleAliasHits(s1Text, aliases).map((hit) => ({ ...hit, arm_label: 'arm_B' })),
    ],
    coder_packet_sha256: sha256(visibleText),
  };
  return {
    schema_version: 'a19-adjudication-packet-v0.1',
    run_id: args.runId,
    created_at: new Date().toISOString(),
    family_id: args.familyId,
    sibling_id: args.siblingId,
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    status: 'packet_only_no_judgments',
    panel_config: repoRel(args.panel),
    coder_packet: coderPacket,
    private_key: {
      arm_A: {
        provenance: 'S0_no_policy',
        transcript_path: repoRel(args.s0),
      },
      arm_B: {
        provenance: 'S1_policy_memory',
        transcript_path: repoRel(args.s1),
      },
      target_aliases: args.targetAliases,
      decoy_aliases: args.decoyAliases,
      target_repair_type: args.targetRepairType,
      decoy_repair_types: args.decoyRepairTypes,
      withheld_from_coder: panel.coder_visibility?.withheld || [],
    },
    audit,
    non_claims: [
      'paid_blind_panel_result',
      'human_learning',
      'deployed_adaptive_tutor',
      'model_weight_learning',
      'main_harness_rate_effect',
    ],
  };
}

function main() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const packet = buildAdjudicationPacket(args);
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
  process.stdout.write(`A19 adjudication packet: ${repoRel(args.out)}\n`);
  process.stdout.write(`visible alias hits: ${packet.audit.visible_alias_hits_in_public_transcripts.length}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
