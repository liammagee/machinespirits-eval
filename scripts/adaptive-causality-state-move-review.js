#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import {
  STATE_MOVE_HASH_MANIFEST_SCHEMA,
  assertPublicArtifactsBlind,
  buildStateMoveReviewArtifacts,
  compareStateMoveSubmissions,
  createStateMoveCodebook,
  createStateMoveSubmissionTemplate,
  sha256,
} from '../services/adaptiveCausalityStateMoveReview.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULTS = Object.freeze({
  spec: path.join(ROOT, 'config/adaptive-causality-validation/state-move-v1.spec.json'),
  sourceDir: path.join(ROOT, 'exports/crossed-effects'),
  packet: path.join(ROOT, 'config/adaptive-causality-validation/state-move-v1.packet.json'),
  codebook: path.join(ROOT, 'config/adaptive-causality-validation/state-move-v1.codebook.md'),
  coderA: path.join(ROOT, 'config/adaptive-causality-validation/state-move-v1.coder-a.json'),
  coderB: path.join(ROOT, 'config/adaptive-causality-validation/state-move-v1.coder-b.json'),
  key: path.join(ROOT, 'tests/fixtures/adaptive-state-move-v1.machine-key.json'),
  hashes: path.join(ROOT, 'config/adaptive-causality-validation/state-move-v1.hashes.json'),
});

function usage() {
  return `Usage:
  node scripts/adaptive-causality-state-move-review.js check [--source-dir PATH] [artifact path overrides]
  node scripts/adaptive-causality-state-move-review.js write [--source-dir PATH] [artifact path overrides]
  node scripts/adaptive-causality-state-move-review.js frozen-check [artifact path overrides]
  node scripts/adaptive-causality-state-move-review.js compare --submission PATH --submission PATH [--out PATH] [artifact path overrides]

Artifact path overrides: --spec --packet --codebook --coder-a --coder-b --key --hashes
`;
}

function parseArgs(argv) {
  const command = argv[0] || 'check';
  if (!['check', 'write', 'frozen-check', 'compare'].includes(command)) throw new Error(usage());
  const options = { ...DEFAULTS, submissions: [], out: null };
  const names = new Map([
    ['--spec', 'spec'],
    ['--source-dir', 'sourceDir'],
    ['--packet', 'packet'],
    ['--codebook', 'codebook'],
    ['--coder-a', 'coderA'],
    ['--coder-b', 'coderB'],
    ['--key', 'key'],
    ['--hashes', 'hashes'],
  ]);
  for (let index = 1; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag.startsWith('--') || value === undefined) throw new Error(usage());
    index += 1;
    if (flag === '--submission') options.submissions.push(path.resolve(value));
    else if (flag === '--out') options.out = path.resolve(value);
    else if (names.has(flag)) options[names.get(flag)] = path.resolve(value);
    else throw new Error(`Unknown option ${flag}\n${usage()}`);
  }
  return { command, options };
}

async function jsonBytes(value, filePath) {
  const config = (await prettier.resolveConfig(filePath)) || {};
  return prettier.format(JSON.stringify(value, null, 2), { ...config, filepath: filePath });
}

function relative(filePath) {
  return path.relative(ROOT, filePath) || '.';
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadSources(spec, sourceDir) {
  return spec.sources.map((source) => {
    const filePath = path.join(sourceDir, source.file);
    const bytes = fs.readFileSync(filePath);
    return {
      source_id: source.source_id,
      bytes,
      rows: JSON.parse(bytes.toString('utf8')),
    };
  });
}

function writeFileCreateOnce(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(filePath, content, { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`refusing to overwrite frozen artifact ${relative(filePath)}`);
    throw error;
  }
}

function checkExact(filePath, expected) {
  if (!fs.existsSync(filePath)) throw new Error(`missing frozen artifact ${relative(filePath)}`);
  const actual = fs.readFileSync(filePath, 'utf8');
  if (actual !== expected) throw new Error(`frozen artifact drift: ${relative(filePath)}`);
}

function artifactEntries(options, serialized) {
  return [
    ['packet', options.packet, serialized.packet],
    ['codebook', options.codebook, serialized.codebook],
    ['coder_a_template', options.coderA, serialized.coderA],
    ['coder_b_template', options.coderB, serialized.coderB],
    ['machine_key', options.key, serialized.key],
  ].map(([role, filePath, bytes]) => ({ role, file: relative(filePath), sha256: sha256(bytes) }));
}

async function buildFrozenArtifacts(spec, sourceDocuments, options) {
  const { packet, machineKey } = buildStateMoveReviewArtifacts({ spec, sourceDocuments });
  const codebook = createStateMoveCodebook(spec);
  const packetBytes = await jsonBytes(packet, options.packet);
  const packetDigest = sha256(packetBytes);
  const coderA = createStateMoveSubmissionTemplate(packet, packetDigest, 'coder_a');
  const coderB = createStateMoveSubmissionTemplate(packet, packetDigest, 'coder_b');
  assertPublicArtifactsBlind({ packet, codebook, submissions: [coderA, coderB] });
  const serialized = {
    packet: packetBytes,
    codebook,
    coderA: await jsonBytes(coderA, options.coderA),
    coderB: await jsonBytes(coderB, options.coderB),
    key: await jsonBytes(machineKey, options.key),
  };
  const hashes = {
    schema: STATE_MOVE_HASH_MANIFEST_SCHEMA,
    packet_id: spec.packet_id,
    sealed_sources: spec.sources.map(({ source_id, file, sha256: digest }) => ({
      source_id,
      file,
      sha256: digest,
    })),
    artifacts: artifactEntries(options, serialized),
  };
  serialized.hashes = await jsonBytes(hashes, options.hashes);
  return { packet, machineKey, codebook, coderA, coderB, packetDigest, serialized, hashes };
}

function frozenArtifactOptions(options) {
  return new Map([
    ['packet', options.packet],
    ['codebook', options.codebook],
    ['coder_a_template', options.coderA],
    ['coder_b_template', options.coderB],
    ['machine_key', options.key],
  ]);
}

function verifyFrozenHashes(options) {
  const manifest = readJson(options.hashes);
  if (manifest.schema !== STATE_MOVE_HASH_MANIFEST_SCHEMA) throw new Error('frozen hash manifest schema mismatch');
  const paths = frozenArtifactOptions(options);
  for (const entry of manifest.artifacts || []) {
    const filePath = paths.get(entry.role);
    if (!filePath) throw new Error(`unknown frozen artifact role ${entry.role}`);
    if (!fs.existsSync(filePath)) throw new Error(`missing frozen artifact ${relative(filePath)}`);
    const actual = sha256(fs.readFileSync(filePath));
    if (actual !== entry.sha256) throw new Error(`frozen artifact hash mismatch: ${relative(filePath)}`);
  }
  if ((manifest.artifacts || []).length !== paths.size)
    throw new Error('hash manifest must cover every frozen artifact');
  return manifest;
}

function printSummary(options, artifacts) {
  process.stdout.write(
    [
      `adaptive state/move packet: ${artifacts.packet.packet_id}`,
      `cases: ${artifacts.packet.cases.length}; source strata: state x world x assignment relation`,
      `packet: ${relative(options.packet)}; sha256 ${artifacts.packetDigest}`,
      `machine key: ${relative(options.key)}; sha256 ${sha256(artifacts.serialized.key)}`,
      `coder templates: ${relative(options.coderA)}, ${relative(options.coderB)}`,
      `model calls: 0`,
    ].join('\n') + '\n',
  );
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  const spec = readJson(options.spec);

  if (command === 'frozen-check') {
    const manifest = verifyFrozenHashes(options);
    process.stdout.write(`frozen adaptive state/move artifacts verified: ${manifest.packet_id}; model calls: 0\n`);
    return;
  }

  if (command === 'compare') {
    if (options.submissions.length !== 2) throw new Error('compare requires exactly two --submission files');
    verifyFrozenHashes(options);
    const packetBytes = fs.readFileSync(options.packet);
    const packet = JSON.parse(packetBytes.toString('utf8'));
    const machineKey = readJson(options.key);
    const submissions = options.submissions.map(readJson);
    const report = compareStateMoveSubmissions({
      packet,
      packetSha256: sha256(packetBytes),
      spec,
      machineKey,
      submissions,
    });
    const output = await jsonBytes(report, options.out || path.join(ROOT, 'state-move-review-report.json'));
    if (options.out) {
      writeFileCreateOnce(options.out, output);
      process.stdout.write(`adaptive state/move comparison report: ${options.out}\n`);
    } else {
      process.stdout.write(output);
    }
    return;
  }

  const sourceDocuments = loadSources(spec, options.sourceDir);
  const artifacts = await buildFrozenArtifacts(spec, sourceDocuments, options);
  const files = [
    [options.packet, artifacts.serialized.packet],
    [options.codebook, artifacts.serialized.codebook],
    [options.coderA, artifacts.serialized.coderA],
    [options.coderB, artifacts.serialized.coderB],
    [options.key, artifacts.serialized.key],
    [options.hashes, artifacts.serialized.hashes],
  ];
  if (command === 'write') {
    for (const [filePath, content] of files) writeFileCreateOnce(filePath, content);
  } else {
    for (const [filePath, content] of files) checkExact(filePath, content);
  }
  printSummary(options, artifacts);
}

try {
  await main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
