#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  buildTutorStubFirstDraftBlindReview,
  compileTutorStubFirstDraftBlindReview,
  extractTutorStubFirstDraftReviewRows,
  readTutorStubTraceEvents,
  summarizeTutorStubFirstDraftReviewInventory,
  tutorStubFirstDraftBlindReviewHtml,
  tutorStubFirstDraftBlindReviewMarkdown,
} from '../services/tutorStubFirstDraftBlindReview.js';

const { values: args } = parseArgs({
  options: {
    'trace-root': { type: 'string', multiple: true },
    'out-dir': { type: 'string', default: 'exports/tutor-stub-first-draft-blind-review' },
    seed: { type: 'string', default: '20260716' },
    pairs: { type: 'string', default: '6' },
    calibrations: { type: 'string', default: '8' },
    ratings: { type: 'string' },
  },
});

function findTraces(root) {
  const traces = [];
  function walk(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(filePath);
      else if (entry.name.endsWith('.jsonl') && entry.name !== 'run-events.jsonl') traces.push(filePath);
    }
  }
  walk(path.resolve(root));
  return traces;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

const outDir = path.resolve(args['out-dir']);
fs.mkdirSync(outDir, { recursive: true });

if (args.ratings) {
  const blind = JSON.parse(fs.readFileSync(path.join(outDir, 'blind-corpus.json'), 'utf8'));
  const key = JSON.parse(fs.readFileSync(path.join(outDir, 'review-key.json'), 'utf8'));
  const ratings = JSON.parse(fs.readFileSync(path.resolve(args.ratings), 'utf8'));
  const report = compileTutorStubFirstDraftBlindReview({ blind, key, ratings });
  writeJson(path.join(outDir, 'review-report.json'), report);
  fs.writeFileSync(path.join(outDir, 'review-report.md'), tutorStubFirstDraftBlindReviewMarkdown(report));
  console.log(`blind review report: ${path.join(outDir, 'review-report.md')}`);
} else {
  const roots = args['trace-root'] || [];
  if (!roots.length) throw new Error('at least one --trace-root is required');
  const traces = roots.flatMap(findTraces).sort();
  const rows = traces.flatMap((tracePath) =>
    extractTutorStubFirstDraftReviewRows({ events: readTutorStubTraceEvents(tracePath), tracePath }),
  );
  const { blind, key } = buildTutorStubFirstDraftBlindReview({
    rows,
    seed: Number(args.seed),
    pairCount: Number(args.pairs),
    calibrationCount: Number(args.calibrations),
  });
  writeJson(path.join(outDir, 'blind-corpus.json'), blind);
  writeJson(path.join(outDir, 'review-key.json'), key);
  writeJson(path.join(outDir, 'inventory.json'), summarizeTutorStubFirstDraftReviewInventory(rows));
  fs.writeFileSync(path.join(outDir, 'review.html'), tutorStubFirstDraftBlindReviewHtml(blind));
  console.log(`traces: ${traces.length}; eligible rows: ${rows.length}; candidates sampled: ${blind.candidateCount}`);
  console.log(`blind review: ${path.join(outDir, 'review.html')}`);
  console.log(`sealed key: ${path.join(outDir, 'review-key.json')}`);
}
