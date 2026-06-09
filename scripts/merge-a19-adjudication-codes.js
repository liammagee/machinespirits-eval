#!/usr/bin/env node
/**
 * Merge independent A19 adjudication coder files for one blinded packet.
 *
 * This is offline infrastructure only. It preserves raw coder judgments and
 * applies the private answer key only after packet/hash checks pass.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  return `Usage:
  node scripts/merge-a19-adjudication-codes.js \\
    --packet exports/a19/adjudication-packets/family-sibling.packet.json \\
    [--assignment exports/a19/human-coder-assignments/family-sibling.assignment.json] \\
    [--assignment-key exports/a19/human-coder-assignments/family-sibling.assignment-key.json] \\
    [--coder coder-a.json --coder coder-b.json] [--coder-dir dir] [--coders coder-a.json coder-b.json] \\
    [--out exports/a19/adjudication-reports/family-sibling.coders.json] [--json]

Coder files must reference the same coder_packet_sha256 and provide one code per
packet arm. Zero or one coder file creates an infrastructure/diagnostic report,
not a panel claim.`;
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    packet: null,
    assignment: null,
    assignmentKey: null,
    coders: [],
    coderDir: null,
    out: null,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--packet') args.packet = path.resolve(argv[++i]);
    else if (token === '--assignment') args.assignment = path.resolve(argv[++i]);
    else if (token === '--assignment-key') args.assignmentKey = path.resolve(argv[++i]);
    else if (token === '--coder') args.coders.push(path.resolve(argv[++i]));
    else if (token === '--coders') {
      while (argv[i + 1] && !argv[i + 1].startsWith('--')) args.coders.push(path.resolve(argv[++i]));
    } else if (token === '--coder-dir') args.coderDir = path.resolve(argv[++i]);
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else if (token === '--json') args.json = true;
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  if (args.help) return args;
  if (!args.packet) throw new Error(`--packet is required\n\n${usage()}`);
  if (!fs.existsSync(args.packet)) throw new Error(`packet not found: ${args.packet}`);
  if (args.assignment && !fs.existsSync(args.assignment)) throw new Error(`assignment not found: ${args.assignment}`);
  if (args.assignmentKey && !fs.existsSync(args.assignmentKey)) {
    throw new Error(`assignment key not found: ${args.assignmentKey}`);
  }
  if (args.coderDir) {
    if (!fs.existsSync(args.coderDir)) throw new Error(`coder dir not found: ${args.coderDir}`);
    const dirCoders = fs
      .readdirSync(args.coderDir)
      .filter((entry) => entry.endsWith('.json'))
      .map((entry) => path.join(args.coderDir, entry));
    args.coders.push(...dirCoders);
  }
  args.coders = [...new Set(args.coders)].sort();
  args.out =
    args.out ||
    path.join(ROOT, 'exports', 'a19', 'adjudication-reports', `${path.basename(args.packet, '.json')}.coders.json`);
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function repoRel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function confidenceBucket(value) {
  if (typeof value !== 'number') return value || 'low';
  if (value >= 0.67) return 'high';
  if (value >= 0.34) return 'medium';
  return 'low';
}

function optionClassFromTargetStatus(status) {
  if (status === 'target') return 'target';
  if (status === 'non_target' || status === 'near_target') return 'neither';
  return status || 'unclear';
}

function normalizeCode(code, { coderId, armLabel, sourcePath }) {
  const flags = asArray(code.artifact_flags).length ? asArray(code.artifact_flags) : ['none'];
  const humanConfidence = typeof code.confidence === 'number' ? code.confidence : null;
  return {
    coder_id: coderId,
    source_path: repoRel(sourcePath),
    arm_label: armLabel || code.arm_label || code.arm_public_id || null,
    committed_option_class: code.committed_option_class || optionClassFromTargetStatus(code.target_status),
    committed_repair: code.committed_repair || code.rationale || '',
    repair_type: code.repair_type || code.primary_label || 'unclear',
    basis_label: code.basis_label || code.target_status || 'unclear',
    confidence: confidenceBucket(code.confidence),
    confidence_score: humanConfidence,
    target_status: code.target_status || null,
    target_granularity_risk: typeof code.target_granularity_risk === 'boolean' ? code.target_granularity_risk : null,
    obligations: code.obligations || null,
    excluded_moves_present: asArray(code.excluded_moves_present),
    evidence_spans: asArray(code.evidence_spans),
    rationale: code.rationale || '',
    span_evidence:
      code.span_evidence ||
      asArray(code.evidence_spans)
        .map((span) => span.quote)
        .filter(Boolean)
        .join(' | '),
    artifact_flags: flags,
    notes: code.notes || '',
  };
}

function codesByArm(coderFile, sourcePath) {
  const coderId = coderFile.coder_id || path.basename(sourcePath, '.json');
  if (Array.isArray(coderFile.arm_judgments)) {
    return coderFile.arm_judgments.map((code) =>
      normalizeCode(code, { coderId, armLabel: code.arm_public_id, sourcePath }),
    );
  }
  const arms = coderFile.arms || coderFile.codes || [];
  if (Array.isArray(arms)) {
    return arms.map((code) => normalizeCode(code, { coderId, armLabel: code.arm_label, sourcePath }));
  }
  return Object.entries(arms).map(([armLabel, code]) =>
    normalizeCode(code, {
      coderId,
      armLabel: code.arm_label || armLabel,
      sourcePath,
    }),
  );
}

function mode(values) {
  const counts = new Map();
  for (const value of values.map((entry) => entry || 'unclear')) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    value: sorted[0]?.[0] || null,
    votes: sorted[0]?.[1] || 0,
    total: values.length,
    distribution: Object.fromEntries(sorted),
  };
}

function summarizeArm(rawCodes) {
  const fields = ['committed_option_class', 'repair_type', 'basis_label', 'confidence'];
  const majority = Object.fromEntries(fields.map((field) => [field, mode(rawCodes.map((code) => code[field]))]));
  const disagreementFlags = fields
    .filter((field) => new Set(rawCodes.map((code) => code[field] || 'unclear')).size > 1)
    .map((field) => `${field}_disagreement`);
  const spans = rawCodes.map((code) => ({
    coder_id: code.coder_id,
    span_evidence: code.span_evidence,
  }));
  const artifactFlags = [...new Set(rawCodes.flatMap((code) => code.artifact_flags).filter((flag) => flag !== 'none'))];
  return {
    raw_codes: rawCodes,
    majority_code: majority,
    disagreement_flags: disagreementFlags,
    artifact_flags: artifactFlags,
    span_evidence: spans,
  };
}

function mergeContext({ packet, assignmentPath = null, assignmentKeyPath = null }) {
  if (!assignmentPath) {
    return {
      expectedHash: packet.audit?.coder_packet_sha256,
      expectedRunId: packet.run_id || null,
      expectedCodebookId: null,
      expectedArms: new Set(asArray(packet.coder_packet?.arms).map((arm) => arm.arm_label)),
      privateMapping: {
        arm_A: packet.private_key?.arm_A || null,
        arm_B: packet.private_key?.arm_B || null,
        target_repair_type: packet.private_key?.target_repair_type || null,
        decoy_repair_types: packet.private_key?.decoy_repair_types || [],
      },
      assignment: null,
      assignmentKey: null,
    };
  }
  const assignment = readJson(assignmentPath);
  const assignmentKey = assignmentKeyPath ? readJson(assignmentKeyPath) : null;
  const armMap = Object.fromEntries(
    asArray(assignmentKey?.arm_map).map((entry) => [
      entry.arm_public_id,
      {
        source_arm_id: entry.source_arm_id,
        transcript_sha256: entry.transcript_sha256,
        private_packet_mapping: entry.private_packet_mapping || null,
      },
    ]),
  );
  return {
    expectedHash: assignment.packet_sha256,
    expectedRunId: assignment.assignment_id || null,
    expectedCodebookId: assignment.codebook_id || null,
    expectedArms: new Set(asArray(assignment.arms).map((arm) => arm.arm_public_id)),
    privateMapping: {
      ...armMap,
      target_repair_type:
        assignmentKey?.private_answer_key?.target_repair_type || packet.private_key?.target_repair_type || null,
      decoy_repair_types:
        assignmentKey?.private_answer_key?.decoy_repair_types || packet.private_key?.decoy_repair_types || [],
    },
    assignment,
    assignmentKey,
  };
}

export function mergeA19AdjudicationCodes({
  packetPath,
  coderPaths = [],
  assignmentPath = null,
  assignmentKeyPath = null,
}) {
  const packet = readJson(packetPath);
  const { expectedHash, expectedRunId, expectedCodebookId, expectedArms, privateMapping, assignment, assignmentKey } =
    mergeContext({
      packet,
      assignmentPath,
      assignmentKeyPath,
    });
  const issues = [];
  const rawByArm = new Map();
  const coderSummaries = [];
  const seenCoderIds = new Set();

  for (const coderPath of coderPaths) {
    if (!fs.existsSync(coderPath)) {
      issues.push({ severity: 'error', code: 'coder_file_missing', path: repoRel(coderPath) });
      continue;
    }
    const coderFile = readJson(coderPath);
    const coderId = coderFile.coder_id || path.basename(coderPath, '.json');
    if (seenCoderIds.has(coderId)) {
      issues.push({ severity: 'error', code: 'duplicate_coder_id', coder_id: coderId });
    }
    seenCoderIds.add(coderId);
    const coderHash = coderFile.coder_packet_sha256 || coderFile.packet_sha256 || null;
    const coderRunId = coderFile.packet_run_id || coderFile.run_id || coderFile.assignment_id || null;
    if (expectedHash && coderHash !== expectedHash) {
      issues.push({
        severity: 'error',
        code: 'coder_packet_hash_mismatch',
        coder_id: coderId,
        expected: expectedHash,
        actual: coderHash,
      });
    }
    if (expectedRunId && coderRunId && coderRunId !== expectedRunId) {
      issues.push({
        severity: 'error',
        code: 'packet_run_id_mismatch',
        coder_id: coderId,
        expected: expectedRunId,
        actual: coderRunId,
      });
    }
    if (expectedCodebookId && coderFile.codebook_id && coderFile.codebook_id !== expectedCodebookId) {
      issues.push({
        severity: 'error',
        code: 'codebook_id_mismatch',
        coder_id: coderId,
        expected: expectedCodebookId,
        actual: coderFile.codebook_id,
      });
    }
    const codes = codesByArm(coderFile, coderPath);
    const seen = new Set();
    for (const code of codes) {
      if (!expectedArms.has(code.arm_label)) {
        issues.push({ severity: 'error', code: 'unknown_arm_label', coder_id: coderId, arm_label: code.arm_label });
        continue;
      }
      seen.add(code.arm_label);
      if (!rawByArm.has(code.arm_label)) rawByArm.set(code.arm_label, []);
      rawByArm.get(code.arm_label).push(code);
    }
    for (const armLabel of expectedArms) {
      if (!seen.has(armLabel)) {
        issues.push({ severity: 'error', code: 'missing_arm_code', coder_id: coderId, arm_label: armLabel });
      }
    }
    coderSummaries.push({
      coder_id: coderId,
      coder_role: coderFile.coder_role || null,
      source_path: repoRel(coderPath),
      code_count: codes.length,
      codebook_id: coderFile.codebook_id || null,
      pairwise_judgment: coderFile.pairwise_judgment || null,
      codebook_feedback: coderFile.codebook_feedback || null,
    });
  }

  const arms = Object.fromEntries(
    [...expectedArms].map((armLabel) => [armLabel, summarizeArm(rawByArm.get(armLabel) || [])]),
  );
  const coderCount = coderSummaries.length;
  let status = 'no_coder_files';
  if (issues.some((issue) => issue.severity === 'error')) status = 'fail';
  else if (coderCount >= 2) status = 'agreement_ready';
  else if (coderCount === 1) status = 'single_coder_diagnostic_only';

  return {
    schema_version: 'a19-adjudication-merge-report-v0.1',
    status,
    created_at: new Date().toISOString(),
    packet_path: repoRel(packetPath),
    assignment_path: assignmentPath ? repoRel(assignmentPath) : null,
    assignment_key_path: assignmentKeyPath ? repoRel(assignmentKeyPath) : null,
    packet_run_id: expectedRunId,
    packet_id: assignment?.packet_id || `${packet.family_id}-${packet.sibling_id}`,
    family_id: packet.family_id,
    sibling_id: packet.sibling_id,
    coder_packet_sha256: expectedHash,
    codebook_id: expectedCodebookId,
    coder_count: coderCount,
    coders: coderSummaries,
    arms,
    private_mapping_applied_after_raw_codes: privateMapping,
    visible_alias_hits_in_public_transcripts:
      assignmentKey?.visible_alias_hits_in_public_transcripts ||
      packet.audit?.visible_alias_hits_in_public_transcripts ||
      [],
    issues,
    non_claims: [
      'paid_blind_panel_result',
      'human_learning',
      'deployed_adaptive_tutor',
      'model_weight_learning',
      'main_harness_rate_effect',
      'paper_or_atlas_claim_without_canonical_prose',
    ],
  };
}

function renderText(report) {
  const lines = [
    '# A19 Adjudication Coder Merge Report',
    '',
    `Status: \`${report.status}\``,
    `Packet: \`${report.packet_path}\``,
    `Family: \`${report.family_id}\``,
    `Sibling: \`${report.sibling_id}\``,
    `Coders: ${report.coder_count}`,
    '',
    '## Arms',
    '',
    '| arm | option class | repair type | basis | disagreements |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const [armLabel, arm] of Object.entries(report.arms)) {
    lines.push(
      `| ${armLabel} | ${arm.majority_code.committed_option_class.value || 'n/a'} | ${
        arm.majority_code.repair_type.value || 'n/a'
      } | ${arm.majority_code.basis_label.value || 'n/a'} | ${arm.disagreement_flags.join(', ') || 'none'} |`,
    );
  }
  lines.push('', '## Issues', '');
  if (!report.issues.length) lines.push('No merge issues.');
  else {
    for (const issue of report.issues) lines.push(`- ${issue.severity}: ${issue.code}`);
  }
  lines.push('', '## Claims Not Licensed', '');
  for (const claim of report.non_claims) lines.push(`- ${claim}`);
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const report = mergeA19AdjudicationCodes({
    packetPath: args.packet,
    coderPaths: args.coders,
    assignmentPath: args.assignment,
    assignmentKeyPath: args.assignmentKey,
  });
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (args.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else process.stdout.write(renderText(report));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
