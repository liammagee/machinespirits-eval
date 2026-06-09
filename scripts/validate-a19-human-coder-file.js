#!/usr/bin/env node
/**
 * Validate one A19 human coder submission against a blinded assignment.
 *
 * This is schema/integrity validation only. It does not unblind arms or create
 * an agreement claim.
 */

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

const TARGET_STATUSES = new Set(['target', 'near_target', 'non_target', 'unclear']);
const OBLIGATION_VALUES = new Set(['present', 'partial', 'absent', 'unclear']);
const ALIAS_LEAKAGE_VALUES = new Set([
  'none_observed',
  'harmless_generic_wording',
  'possible_hint',
  'decisive_contamination',
]);
const FORBIDDEN_PRIVATE_MARKERS = [
  /\bS0_no_policy\b/u,
  /\bS1_policy_memory\b/u,
  /\bpolicy_memory\b/u,
  /\btarget_aliases\b/u,
  /\bdecoy_aliases\b/u,
  /\bprivate_key\b/u,
];

function usage() {
  return `Usage:
  node scripts/validate-a19-human-coder-file.js \\
    --assignment exports/a19/human-coder-assignments/moral-disclosure-standing-repair-a.assignment.json \\
    --coder exports/a19/human-coder-submissions/moral-disclosure-standing-repair-a/coder-001.json \\
    [--codebook exports/a19/adjudication-codebooks/learner-standing-v01.codebook.json] [--json]

Offline only. Validates schema, packet hash, arm IDs, rationales, obligations,
and private-marker leakage in a human coder file.`;
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    assignment: null,
    coder: null,
    codebook: DEFAULT_CODEBOOK,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--assignment') args.assignment = path.resolve(argv[++i]);
    else if (token === '--coder') args.coder = path.resolve(argv[++i]);
    else if (token === '--codebook') args.codebook = path.resolve(argv[++i]);
    else if (token === '--json') args.json = true;
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  if (args.help) return args;
  if (!args.assignment) throw new Error(`--assignment is required\n\n${usage()}`);
  if (!args.coder) throw new Error(`--coder is required\n\n${usage()}`);
  for (const filePath of [args.assignment, args.coder, args.codebook]) {
    if (!fs.existsSync(filePath)) throw new Error(`file not found: ${filePath}`);
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function repoRel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

function push(issues, severity, pathName, message, code = null) {
  issues.push({ severity, path: pathName, message, code: code || pathName.replace(/[^a-z0-9]+/gi, '_') });
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function rationaleSentenceCount(text) {
  return String(text || '')
    .split(/[.!?]+/u)
    .map((entry) => entry.trim())
    .filter(Boolean).length;
}

function validatePrivateMarkerLeakage(coder, issues) {
  const text = JSON.stringify(coder);
  for (const marker of FORBIDDEN_PRIVATE_MARKERS) {
    if (marker.test(text)) {
      push(issues, 'error', 'private_marker_leakage', `coder file contains private marker ${marker}`);
    }
  }
}

function validateArmJudgment(
  judgment,
  { index, expectedArms, allowedLabels, requiredObligations, excludedMoves },
  issues,
) {
  const base = `arm_judgments[${index}]`;
  if (!expectedArms.has(judgment.arm_public_id)) {
    push(issues, 'error', `${base}.arm_public_id`, `unknown arm_public_id: ${judgment.arm_public_id}`);
  }
  if (!allowedLabels.has(judgment.primary_label)) {
    push(issues, 'error', `${base}.primary_label`, `unknown primary_label: ${judgment.primary_label}`);
  }
  if (!TARGET_STATUSES.has(judgment.target_status)) {
    push(issues, 'error', `${base}.target_status`, 'must be target, near_target, non_target, or unclear');
  }
  if (typeof judgment.target_granularity_risk !== 'boolean') {
    push(issues, 'error', `${base}.target_granularity_risk`, 'must be boolean');
  }
  const obligations = judgment.obligations || {};
  for (const obligation of requiredObligations) {
    const value = obligations[obligation.id];
    if (!OBLIGATION_VALUES.has(value)) {
      push(issues, 'error', `${base}.obligations.${obligation.id}`, 'must be present, partial, absent, or unclear');
    }
  }
  for (const key of Object.keys(obligations)) {
    if (!requiredObligations.some((obligation) => obligation.id === key)) {
      push(issues, 'warning', `${base}.obligations.${key}`, 'obligation is not defined by codebook');
    }
  }
  const excluded = asArray(judgment.excluded_moves_present);
  if (!excluded.length) {
    push(issues, 'error', `${base}.excluded_moves_present`, 'must list none or one or more excluded moves');
  }
  if (excluded.includes('none') && excluded.length > 1) {
    push(issues, 'error', `${base}.excluded_moves_present`, '`none` cannot be combined with other excluded moves');
  }
  for (const move of excluded) {
    if (move !== 'none' && !excludedMoves.has(move)) {
      push(issues, 'error', `${base}.excluded_moves_present`, `unknown excluded move: ${move}`);
    }
  }
  const spans = asArray(judgment.evidence_spans);
  if (!spans.length) push(issues, 'error', `${base}.evidence_spans`, 'at least one evidence span is required');
  spans.forEach((span, spanIndex) => {
    if (!hasText(span.quote)) push(issues, 'error', `${base}.evidence_spans[${spanIndex}].quote`, 'quote is required');
    if (!hasText(span.supports)) {
      push(issues, 'error', `${base}.evidence_spans[${spanIndex}].supports`, 'supports is required');
    }
  });
  if (!hasText(judgment.rationale)) {
    push(issues, 'error', `${base}.rationale`, 'rationale is required');
  } else {
    const sentenceCount = rationaleSentenceCount(judgment.rationale);
    if (sentenceCount < 1 || sentenceCount > 6) {
      push(issues, 'warning', `${base}.rationale`, 'expected roughly 2-5 sentences');
    }
  }
  if (typeof judgment.confidence !== 'number' || judgment.confidence < 0 || judgment.confidence > 1) {
    push(issues, 'error', `${base}.confidence`, 'confidence must be a number from 0 to 1');
  }
}

export function validateA19HumanCoderFile({ assignmentPath, coderPath, codebookPath = DEFAULT_CODEBOOK }) {
  const assignment = readJson(assignmentPath);
  const coder = readJson(coderPath);
  const codebook = readJson(codebookPath);
  const issues = [];
  if (assignment.schema_version !== 'a19-human-assignment-v01') {
    push(issues, 'error', 'assignment.schema_version', 'must be a19-human-assignment-v01');
  }
  if (coder.coder_file_version !== 'a19-human-coder-v01') {
    push(issues, 'error', 'coder_file_version', 'must be a19-human-coder-v01');
  }
  if (!hasText(coder.coder_id)) push(issues, 'error', 'coder_id', 'is required');
  if (!hasText(coder.coder_role)) push(issues, 'error', 'coder_role', 'is required');
  if (coder.packet_id !== assignment.packet_id) push(issues, 'error', 'packet_id', 'must match assignment packet_id');
  if (coder.packet_sha256 !== assignment.packet_sha256) {
    push(issues, 'error', 'packet_sha256', 'must match assignment packet_sha256', 'packet_hash_mismatch');
  }
  if (coder.codebook_id !== assignment.codebook_id || coder.codebook_id !== codebook.codebook_id) {
    push(issues, 'error', 'codebook_id', 'must match assignment and codebook');
  }
  validatePrivateMarkerLeakage(coder, issues);
  const expectedArms = new Set(asArray(assignment.arms).map((arm) => arm.arm_public_id));
  const judgments = asArray(coder.arm_judgments);
  const seenArms = new Set();
  const allowedLabels = new Set([codebook.target_label, ...asArray(codebook.near_miss_labels)]);
  const excludedMoves = new Set(asArray(codebook.excluded_moves));
  judgments.forEach((judgment, index) => {
    if (seenArms.has(judgment.arm_public_id)) {
      push(issues, 'error', `arm_judgments[${index}].arm_public_id`, `duplicate arm: ${judgment.arm_public_id}`);
    }
    seenArms.add(judgment.arm_public_id);
    validateArmJudgment(
      judgment,
      {
        index,
        expectedArms,
        allowedLabels,
        requiredObligations: asArray(codebook.required_obligations),
        excludedMoves,
      },
      issues,
    );
  });
  for (const armId of expectedArms) {
    if (!seenArms.has(armId)) push(issues, 'error', 'arm_judgments', `missing judgment for ${armId}`);
  }
  const pairwise = coder.pairwise_judgment || {};
  const allowedBetter = new Set([...expectedArms, 'neither', 'unclear']);
  if (!allowedBetter.has(pairwise.better_arm_public_id)) {
    push(issues, 'error', 'pairwise_judgment.better_arm_public_id', 'must name an assignment arm, neither, or unclear');
  }
  if (typeof pairwise.better_for_target_reason !== 'boolean') {
    push(issues, 'error', 'pairwise_judgment.better_for_target_reason', 'must be boolean');
  }
  if (!hasText(pairwise.reason)) push(issues, 'error', 'pairwise_judgment.reason', 'is required');
  if (!ALIAS_LEAKAGE_VALUES.has(pairwise.alias_leakage_assessment)) {
    push(
      issues,
      'error',
      'pairwise_judgment.alias_leakage_assessment',
      `must be one of ${[...ALIAS_LEAKAGE_VALUES].join(', ')}`,
    );
  }
  const status = issues.some((issue) => issue.severity === 'error') ? 'fail' : 'pass';
  return {
    schema_version: 'a19-human-coder-validation-v01',
    status,
    assignment_path: repoRel(assignmentPath),
    coder_path: repoRel(coderPath),
    codebook_path: repoRel(codebookPath),
    assignment_id: assignment.assignment_id,
    packet_id: assignment.packet_id,
    packet_sha256: assignment.packet_sha256,
    coder_id: coder.coder_id || null,
    issues,
  };
}

function renderText(report) {
  const lines = [
    '# A19 Human Coder Validation',
    '',
    `Status: \`${report.status}\``,
    `Assignment: \`${report.assignment_path}\``,
    `Coder file: \`${report.coder_path}\``,
    `Coder: \`${report.coder_id || 'n/a'}\``,
    '',
    '## Issues',
    '',
  ];
  if (!report.issues.length) lines.push('No validation issues.');
  else {
    for (const issue of report.issues) lines.push(`- [${issue.severity}] ${issue.path}: ${issue.message}`);
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const report = validateA19HumanCoderFile({
    assignmentPath: args.assignment,
    coderPath: args.coder,
    codebookPath: args.codebook,
  });
  if (args.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else process.stdout.write(renderText(report));
  if (report.status !== 'pass') process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
