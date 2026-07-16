#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  buildTutorStubTrajectoryShadowReport,
  renderTutorStubTrajectoryShadowMarkdown,
} from '../services/tutorStubTrajectoryShadow.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CORPUS = path.join(ROOT, 'config', 'tutor-stub-trajectory-dev-v1.json');
const DEFAULT_OUTPUT = path.join(ROOT, 'exports', 'tutor-stub-trajectory-dev-v1');

const { values: args } = parseArgs({
  options: {
    corpus: { type: 'string', default: DEFAULT_CORPUS },
    'out-dir': { type: 'string', default: DEFAULT_OUTPUT },
    check: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function usage() {
  return `Usage:
  node scripts/build-tutor-stub-trajectory-shadow.js
  node scripts/build-tutor-stub-trajectory-shadow.js --check
  node scripts/build-tutor-stub-trajectory-shadow.js --corpus <file> --out-dir <dir>

Reads the committed, permanently non-held-out trajectory development corpus.
This is model-free shadow reporting only: it makes no API call, consumes no
seed, changes no runtime delivery gate, and does not relabel V18-V22.`;
}

if (args.help) {
  console.log(usage());
  process.exit(0);
}

const corpusPath = path.resolve(args.corpus);
const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
const report = buildTutorStubTrajectoryShadowReport(corpus);

if (args.check) {
  console.log(
    `trajectory shadow corpus ok: ${report.sequenceQuality.episodes.length} episodes, ` +
      `${report.pairedBlindReview.pairCount} blind pairs, ${report.calibrationCases.length} calibration cases`,
  );
  process.exit(0);
}

const outputDir = path.resolve(args['out-dir']);
fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, 'trajectory-shadow-report.json');
const markdownPath = path.join(outputDir, 'trajectory-shadow-report.md');
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
fs.writeFileSync(markdownPath, renderTutorStubTrajectoryShadowMarkdown(report), 'utf8');
console.log(jsonPath);
console.log(markdownPath);
