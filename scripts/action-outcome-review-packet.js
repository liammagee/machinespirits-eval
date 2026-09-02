#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { buildActionOutcomeMemoryReadiness } from './action-outcome-memory-readiness.js';
import {
  ACTION_OUTCOME_REVIEW_VERSION,
  actionOutcomeReviewCodebook,
  buildActionOutcomeReviewPacket,
  compareActionOutcomeReviews,
  reviewDataHash,
  reviewJson,
} from '../services/adaptiveTutor/actionOutcomeReviewPacket.js';

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function newDirectory(directory) {
  if (fs.existsSync(directory)) throw new Error(`refusing to overwrite review output: ${directory}`);
  fs.mkdirSync(directory, { recursive: false });
}

function writeNew(filePath, content) {
  fs.writeFileSync(filePath, content, { flag: 'wx' });
}

function safeCoderFile(coderId) {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/u.test(coderId)) throw new Error('coder ids must be safe lowercase file names');
  return `${coderId}.submission.json`;
}

export async function prepareActionOutcomeReview({ inputPath, outputPath, packetId, coderIds }) {
  const resolvedInput = path.resolve(inputPath);
  const input = readJson(resolvedInput);
  if (input.reviewsFile || input.replay)
    throw new Error('packet preparation requires review- and replay-free readiness input');
  if (!Array.isArray(input.conditions) || !input.conditions.length) {
    throw new Error('packet preparation requires explicit nonempty conditions');
  }
  if (!Array.isArray(input.sources) || input.sources.some((source) => source.role !== 'memory')) {
    throw new Error('packet preparation accepts memory-role sources only');
  }
  const readiness = await buildActionOutcomeMemoryReadiness(input, { inputDirectory: path.dirname(resolvedInput) });
  const incompatible = readiness.reviewCandidates.filter(
    (candidate) => candidate.assignmentStatus !== 'seeded_uniform_family_assignment',
  );
  const assignedCandidates = readiness.reviewCandidates.filter(
    (candidate) => candidate.assignmentStatus === 'seeded_uniform_family_assignment',
  );
  if (!assignedCandidates.length) throw new Error('packet preparation found no seeded uniform family assignments');
  const artifacts = buildActionOutcomeReviewPacket({
    candidates: assignedCandidates,
    packetId,
    coderIds,
    measurementPolicy: input.measurementPolicy,
  });
  const packetBytes = reviewJson(artifacts.packet);
  const keyBytes = reviewJson(artifacts.machineKey);
  const codebook = actionOutcomeReviewCodebook();
  const submissions = artifacts.submissions.map((submission) => ({
    file: safeCoderFile(submission.coderId),
    bytes: reviewJson(submission),
  }));
  const manifest = {
    version: ACTION_OUTCOME_REVIEW_VERSION,
    packetId,
    measurementPolicy: artifacts.packet.measurementPolicy,
    modelCalls: 0,
    claimBoundary: artifacts.packet.claimBoundary,
    sources: readiness.report.sources,
    exclusions: {
      ...readiness.report.exclusionCounts,
      ...(incompatible.length ? { non_seeded_family_assignment: incompatible.length } : {}),
    },
    eligibleCases: artifacts.packet.cases.length,
    artifactDataHashes: {
      packet: reviewDataHash(packetBytes),
      codebook: reviewDataHash(codebook),
      machineKey: reviewDataHash(keyBytes),
      submissions: Object.fromEntries(submissions.map((row) => [row.file, reviewDataHash(row.bytes)])),
    },
  };
  const resolvedOutput = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  newDirectory(resolvedOutput);
  writeNew(path.join(resolvedOutput, 'packet.json'), packetBytes);
  writeNew(path.join(resolvedOutput, 'codebook.md'), codebook);
  writeNew(path.join(resolvedOutput, 'machine-key.json'), keyBytes);
  for (const submission of submissions) writeNew(path.join(resolvedOutput, submission.file), submission.bytes);
  writeNew(path.join(resolvedOutput, 'manifest.json'), reviewJson(manifest));
  return { outputPath: resolvedOutput, manifest };
}

export function compareActionOutcomeReviewFiles({ rootPath, submissionPaths, outputPath, recordedAt }) {
  const root = path.resolve(rootPath);
  const manifest = readJson(path.join(root, 'manifest.json'));
  const packetBytes = fs.readFileSync(path.join(root, 'packet.json'), 'utf8');
  const codebook = fs.readFileSync(path.join(root, 'codebook.md'), 'utf8');
  const keyBytes = fs.readFileSync(path.join(root, 'machine-key.json'), 'utf8');
  if (
    manifest.version !== ACTION_OUTCOME_REVIEW_VERSION ||
    reviewDataHash(packetBytes) !== manifest.artifactDataHashes?.packet ||
    reviewDataHash(codebook) !== manifest.artifactDataHashes?.codebook ||
    reviewDataHash(keyBytes) !== manifest.artifactDataHashes?.machineKey
  ) {
    throw new Error('packet-root artifact data drift');
  }
  const packet = JSON.parse(packetBytes);
  const machineKey = JSON.parse(keyBytes);
  if (manifest.packetId !== packet.packetId) throw new Error('packet-root manifest identity drift');
  const submissions = submissionPaths.map((filePath) => readJson(path.resolve(filePath)));
  const result = compareActionOutcomeReviews({
    packet,
    machineKey,
    submissions,
    recordedAt,
    source: `action-outcome-review:${packet.packetId}`,
  });
  const resolvedOutput = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  newDirectory(resolvedOutput);
  writeNew(path.join(resolvedOutput, 'review-report.json'), reviewJson(result.report));
  writeNew(path.join(resolvedOutput, 'reviews.json'), reviewJson(result.reviews));
  return { outputPath: resolvedOutput, report: result.report };
}

function usage() {
  return `Usage:
  node scripts/action-outcome-review-packet.js prepare --input <readiness.json> --out <new-dir> --packet-id <id> --coder <id> --coder <id>
  node scripts/action-outcome-review-packet.js compare --root <packet-dir> --submission <file> --submission <file> --recorded-at <timestamp> --out <new-dir>

Zero model calls. The packet builder consumes only prospective compatible typed-action traces.\n`;
}

async function main() {
  const command = process.argv[2];
  const { values } = parseArgs({
    args: process.argv.slice(3),
    options: {
      input: { type: 'string' },
      out: { type: 'string' },
      'packet-id': { type: 'string' },
      coder: { type: 'string', multiple: true },
      root: { type: 'string' },
      submission: { type: 'string', multiple: true },
      'recorded-at': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) return process.stdout.write(usage());
  let result;
  if (command === 'prepare') {
    result = await prepareActionOutcomeReview({
      inputPath: requireString(values.input, '--input'),
      outputPath: requireString(values.out, '--out'),
      packetId: requireString(values['packet-id'], '--packet-id'),
      coderIds: values.coder || [],
    });
  } else if (command === 'compare') {
    result = compareActionOutcomeReviewFiles({
      rootPath: requireString(values.root, '--root'),
      submissionPaths: values.submission || [],
      recordedAt: requireString(values['recorded-at'], '--recorded-at'),
      outputPath: requireString(values.out, '--out'),
    });
  } else {
    throw new Error(usage().trim());
  }
  process.stdout.write(
    `${JSON.stringify({ output: result.outputPath, summary: result.report?.summary || result.manifest }, null, 2)}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
