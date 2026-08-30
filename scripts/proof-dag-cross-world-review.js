#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import yaml from 'yaml';
import { loadWorld } from '../services/dramaticDerivation/world.js';
import {
  buildProofDagReviewArtifacts,
  compareProofDagReviewSubmissions,
  createProofDagReviewSubmissionTemplate,
} from '../services/dramaticDerivation/proofDagReview.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULTS = Object.freeze({
  spec: path.join(ROOT, 'config/proof-dag-validation/cross-world-v1.yaml'),
  packet: path.join(ROOT, 'config/proof-dag-validation/cross-world-v1.packet.json'),
  key: path.join(ROOT, 'tests/fixtures/proof-dag-cross-world-v1.machine-key.json'),
  template: path.join(ROOT, 'config/proof-dag-validation/cross-world-v1.submission-template.json'),
});

function usage() {
  return `Usage:
  node scripts/proof-dag-cross-world-review.js check [--spec PATH] [--packet PATH] [--key PATH] [--template PATH]
  node scripts/proof-dag-cross-world-review.js write [--spec PATH] [--packet PATH] [--key PATH] [--template PATH]
  node scripts/proof-dag-cross-world-review.js compare --reviewer PATH --reviewer PATH [--packet PATH] [--key PATH] [--out PATH]
`;
}

function parseArgs(argv) {
  const command = argv[0] || 'check';
  if (!['check', 'write', 'compare'].includes(command)) throw new Error(usage());
  const options = { ...DEFAULTS, reviewers: [], out: null };
  for (let index = 1; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag.startsWith('--') || value === undefined) throw new Error(usage());
    index += 1;
    if (flag === '--reviewer') options.reviewers.push(path.resolve(value));
    else if (flag === '--out') options.out = path.resolve(value);
    else if (['--spec', '--packet', '--key', '--template'].includes(flag)) {
      options[flag.slice(2)] = path.resolve(value);
    } else {
      throw new Error(`Unknown option ${flag}\n${usage()}`);
    }
  }
  return { command, options };
}

async function jsonBytes(value, filePath) {
  const config = (await prettier.resolveConfig(filePath)) || {};
  return prettier.format(JSON.stringify(value, null, 2), { ...config, filepath: filePath });
}

function digest(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function relative(filePath) {
  return path.relative(ROOT, filePath) || '.';
}

function loadArtifacts(options) {
  const spec = yaml.parse(fs.readFileSync(options.spec, 'utf8'));
  const loadedWorlds = spec.worlds.map((selection) => loadWorld(path.resolve(ROOT, selection.source)));
  const { packet, machineKey } = buildProofDagReviewArtifacts({ spec, loadedWorlds });
  const template = createProofDagReviewSubmissionTemplate(packet);
  return { packet, machineKey, template };
}

function writeFileCreateOnce(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(filePath, content, { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error(`refusing to overwrite frozen artifact ${relative(filePath)}; choose a new versioned path`);
    }
    throw error;
  }
}

function checkExact(filePath, expected) {
  if (!fs.existsSync(filePath)) throw new Error(`missing frozen artifact ${relative(filePath)}`);
  const actual = fs.readFileSync(filePath, 'utf8');
  if (actual !== expected) throw new Error(`frozen artifact drift: ${relative(filePath)}`);
}

function printArtifactSummary(options, artifacts, serialized) {
  const cases = artifacts.packet.worlds.reduce((total, world) => total + world.cases.length, 0);
  process.stdout.write(
    [
      `proof-DAG review packet: ${artifacts.packet.packet_id}`,
      `worlds: ${artifacts.packet.worlds.length}; cases: ${cases}`,
      `packet: ${relative(options.packet)}; sha256 ${digest(serialized.packet)}`,
      `machine key: ${relative(options.key)}; sha256 ${digest(serialized.key)}`,
      `submission template: ${relative(options.template)}`,
    ].join('\n') + '\n',
  );
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === 'compare') {
    if (options.reviewers.length < 2) throw new Error('compare requires at least two --reviewer files');
    const packet = JSON.parse(fs.readFileSync(options.packet, 'utf8'));
    const machineKey = JSON.parse(fs.readFileSync(options.key, 'utf8'));
    const submissions = options.reviewers.map((filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8')));
    const report = compareProofDagReviewSubmissions({ packet, machineKey, submissions });
    const output = await jsonBytes(report, options.out || path.join(ROOT, 'proof-dag-review-report.json'));
    if (options.out) {
      writeFileCreateOnce(options.out, output);
      process.stdout.write(`proof-DAG review report: ${options.out}\n`);
    } else {
      process.stdout.write(output);
    }
    return;
  }

  const artifacts = loadArtifacts(options);
  const expected = {
    packet: await jsonBytes(artifacts.packet, options.packet),
    key: await jsonBytes(artifacts.machineKey, options.key),
    template: await jsonBytes(artifacts.template, options.template),
  };
  if (command === 'write') {
    writeFileCreateOnce(options.packet, expected.packet);
    writeFileCreateOnce(options.key, expected.key);
    writeFileCreateOnce(options.template, expected.template);
  } else {
    checkExact(options.packet, expected.packet);
    checkExact(options.key, expected.key);
    checkExact(options.template, expected.template);
  }
  printArtifactSummary(options, artifacts, expected);
}

try {
  await main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
