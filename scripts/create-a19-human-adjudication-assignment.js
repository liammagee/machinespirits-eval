#!/usr/bin/env node
/**
 * Create a coder-facing A19 human adjudication assignment.
 *
 * The assignment is deliberately separate from the private assignment key. The
 * coder-facing file never exposes S0/S1 provenance, target aliases, decoy
 * aliases, target repair type, or policy-memory condition.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CODEBOOK = path.join(
  ROOT,
  'exports',
  'a19',
  'adjudication-codebooks',
  'learner-standing-v01.codebook.json',
);

const PUBLIC_ARM_LABELS = ['arm_alpha', 'arm_beta', 'arm_gamma', 'arm_delta', 'arm_epsilon'];

function usage() {
  return `Usage:
  node scripts/create-a19-human-adjudication-assignment.js \\
    --packet exports/a19/adjudication-packets/moral-disclosure-standing-repair-a.packet.json \\
    --codebook exports/a19/adjudication-codebooks/learner-standing-v01.codebook.json \\
    [--out exports/a19/human-coder-assignments/moral-disclosure-standing-repair-a.assignment.json] \\
    [--key-out exports/a19/human-coder-assignments/moral-disclosure-standing-repair-a.assignment-key.json] \\
    [--assignment-id a19-human-mdsr-a-2026-06-08] [--randomize-arms] [--seed text] [--json]

Offline only. Writes one coder-facing assignment and one private assignment key.`;
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    packet: null,
    codebook: DEFAULT_CODEBOOK,
    out: null,
    keyOut: null,
    assignmentId: null,
    randomizeArms: false,
    seed: null,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--packet') args.packet = path.resolve(argv[++i]);
    else if (token === '--codebook') args.codebook = path.resolve(argv[++i]);
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else if (token === '--key-out') args.keyOut = path.resolve(argv[++i]);
    else if (token === '--assignment-id') args.assignmentId = argv[++i];
    else if (token === '--randomize-arms') args.randomizeArms = true;
    else if (token === '--redact-answer-key') {
      // Redaction is always on; this flag is accepted for roadmap command parity.
    } else if (token === '--seed') args.seed = argv[++i];
    else if (token === '--json') args.json = true;
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  if (args.help) return args;
  if (!args.packet) throw new Error(`--packet is required\n\n${usage()}`);
  if (!fs.existsSync(args.packet)) throw new Error(`packet not found: ${args.packet}`);
  if (!fs.existsSync(args.codebook)) throw new Error(`codebook not found: ${args.codebook}`);
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function repoRel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

function sha256(text) {
  return crypto
    .createHash('sha256')
    .update(String(text || ''))
    .digest('hex');
}

function dashId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function dateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function stableArmOrder(arms, { randomizeArms, seed }) {
  if (!randomizeArms) return [...arms];
  return [...arms].sort((a, b) => {
    const aHash = sha256(`${seed}:${a.arm_label}`);
    const bHash = sha256(`${seed}:${b.arm_label}`);
    return aHash.localeCompare(bHash);
  });
}

function hitsByArm(packet) {
  const byArm = new Map();
  for (const hit of packet.audit?.visible_alias_hits_in_public_transcripts || []) {
    if (!byArm.has(hit.arm_label)) byArm.set(hit.arm_label, []);
    byArm.get(hit.arm_label).push(hit);
  }
  return byArm;
}

function responseSchemaFromCodebook(codebook) {
  const obligationIds = (codebook.required_obligations || []).map((entry) => entry.id);
  return {
    coder_file_version: 'a19-human-coder-v01',
    arm_judgments: {
      arm_public_id: 'one of the assignment arm_public_id values',
      primary_label: [codebook.target_label, ...(codebook.near_miss_labels || [])],
      target_status: ['target', 'near_target', 'non_target', 'unclear'],
      target_granularity_risk: 'boolean',
      obligations: Object.fromEntries(obligationIds.map((id) => [id, ['present', 'partial', 'absent', 'unclear']])),
      excluded_moves_present: ['none', ...(codebook.excluded_moves || [])],
      evidence_spans: [{ quote: 'short copied phrase only', supports: 'obligation_or_label_id' }],
      rationale: '2-5 sentences',
      confidence: 'number from 0 to 1',
    },
    pairwise_judgment: {
      better_arm_public_id: 'one assignment arm_public_id, neither, or unclear',
      better_for_target_reason: 'boolean',
      reason: 'short explanation',
      alias_leakage_assessment: [
        'none_observed',
        'harmless_generic_wording',
        'possible_hint',
        'decisive_contamination',
      ],
    },
  };
}

export function createHumanAdjudicationAssignment({
  packetPath,
  codebookPath = DEFAULT_CODEBOOK,
  outPath = null,
  keyOutPath = null,
  assignmentId = null,
  randomizeArms = false,
  seed = null,
  createdAt = new Date().toISOString(),
} = {}) {
  const packet = readJson(packetPath);
  const codebook = readJson(codebookPath);
  const packetId = dashId(`${packet.family_id}-${packet.sibling_id}`);
  const resolvedAssignmentId = assignmentId || `a19-human-${packetId}-${dateStamp(new Date(createdAt))}`;
  const packetSha256 = packet.audit?.coder_packet_sha256;
  const resolvedSeed = seed || `${resolvedAssignmentId}:${packetSha256}`;
  const orderedArms = stableArmOrder(packet.coder_packet?.arms || [], { randomizeArms, seed: resolvedSeed });
  if (orderedArms.length > PUBLIC_ARM_LABELS.length) {
    throw new Error(`too many arms for built-in public labels: ${orderedArms.length}`);
  }
  const hitMap = hitsByArm(packet);
  const armMap = orderedArms.map((arm, index) => ({
    publicId: PUBLIC_ARM_LABELS[index],
    sourceArmId: arm.arm_label,
    arm,
  }));
  const assignment = {
    schema_version: 'a19-human-assignment-v01',
    assignment_id: resolvedAssignmentId,
    packet_id: packetId,
    packet_run_id: packet.run_id,
    packet_sha256: packetSha256,
    codebook_id: codebook.codebook_id,
    codebook_path: repoRel(codebookPath),
    created_at: createdAt,
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    arms: armMap.map(({ publicId, sourceArmId, arm }) => {
      const hits = hitMap.get(sourceArmId) || [];
      return {
        arm_public_id: publicId,
        transcript: arm.transcript,
        transcript_sha256: arm.transcript_sha256 || sha256(arm.transcript),
        visible_alias_audit: {
          hit_count: hits.length,
          hit_hashes: hits.map((hit) => hit.sha256),
          coder_visible_alias_text: false,
          instruction: 'Do not infer the target from this audit. Judge only the transcript text and codebook.',
        },
      };
    }),
    coder_task: {
      primary_question: 'Classify each arm repair type using the supplied codebook.',
      secondary_question: 'Judge whether either arm better restores learner standing, and explain why.',
      leakage_question: 'State whether any visible wording looks like an answer-key hint.',
    },
    coder_instructions: [
      'Your task is not to judge whether the response is kind, fluent, safe, or generally good.',
      'Classify what public repair action the response performs.',
      'Use only the transcript, neutral arm labels, and codebook.',
      'Do not infer which arm used policy memory.',
      'Provide short evidence spans and a 2-5 sentence rationale for every arm.',
    ],
    response_schema: responseSchemaFromCodebook(codebook),
    assignment_audit: {
      private_mapping_omitted: true,
      answer_key_omitted: true,
      arm_provenance_omitted: true,
      policy_memory_condition_omitted: true,
      target_aliases_omitted_except_unavoidable_transcript_text: true,
      visible_alias_hit_count: [...hitMap.values()].reduce((total, hits) => total + hits.length, 0),
    },
    non_claims: [
      'human_learning',
      'deployed_adaptive_tutor',
      'model_weight_learning',
      'main_harness_rate_effect',
      'a19_transfer_claim',
      'paper_or_atlas_claim_without_canonical_prose',
    ],
  };
  const assignmentKey = {
    schema_version: 'a19-human-assignment-key-v01',
    assignment_id: assignment.assignment_id,
    packet_path: repoRel(packetPath),
    packet_id: assignment.packet_id,
    packet_sha256: packetSha256,
    codebook_id: codebook.codebook_id,
    created_at: createdAt,
    arm_map: armMap.map(({ publicId, sourceArmId, arm }) => ({
      arm_public_id: publicId,
      source_arm_id: sourceArmId,
      transcript_sha256: arm.transcript_sha256 || sha256(arm.transcript),
      private_packet_mapping: packet.private_key?.[sourceArmId] || null,
    })),
    visible_alias_hits_in_public_transcripts: packet.audit?.visible_alias_hits_in_public_transcripts || [],
    private_answer_key: {
      target_aliases: packet.private_key?.target_aliases || [],
      decoy_aliases: packet.private_key?.decoy_aliases || [],
      target_repair_type: packet.private_key?.target_repair_type || null,
      decoy_repair_types: packet.private_key?.decoy_repair_types || [],
    },
    withheld_from_coder: packet.private_key?.withheld_from_coder || [],
  };
  const resolvedOut =
    outPath || path.join(ROOT, 'exports', 'a19', 'human-coder-assignments', `${packetId}.assignment.json`);
  const resolvedKeyOut =
    keyOutPath || path.join(ROOT, 'exports', 'a19', 'human-coder-assignments', `${packetId}.assignment-key.json`);
  return {
    assignment,
    assignmentKey,
    outPath: resolvedOut,
    keyOutPath: resolvedKeyOut,
  };
}

function main() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const result = createHumanAdjudicationAssignment({
    packetPath: args.packet,
    codebookPath: args.codebook,
    outPath: args.out,
    keyOutPath: args.keyOut,
    assignmentId: args.assignmentId,
    randomizeArms: args.randomizeArms,
    seed: args.seed,
  });
  fs.mkdirSync(path.dirname(result.outPath), { recursive: true });
  fs.writeFileSync(result.outPath, `${JSON.stringify(result.assignment, null, 2)}\n`, 'utf8');
  fs.mkdirSync(path.dirname(result.keyOutPath), { recursive: true });
  fs.writeFileSync(result.keyOutPath, `${JSON.stringify(result.assignmentKey, null, 2)}\n`, 'utf8');
  const summary = {
    assignment: repoRel(result.outPath),
    assignment_key: repoRel(result.keyOutPath),
    assignment_id: result.assignment.assignment_id,
    packet_sha256: result.assignment.packet_sha256,
    arm_count: result.assignment.arms.length,
    visible_alias_hit_count: result.assignment.assignment_audit.visible_alias_hit_count,
  };
  if (args.json) process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  else {
    process.stdout.write(`A19 human assignment: ${summary.assignment}\n`);
    process.stdout.write(`A19 human assignment key: ${summary.assignment_key}\n`);
    process.stdout.write(`visible alias hits: ${summary.visible_alias_hit_count}\n`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
