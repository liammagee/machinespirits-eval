#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { sha256File } from '../services/dataGovernance.js';
import { buildTutorStubRatingCandidates, collectTutorStubFeedbackRecords } from '../services/tutorStubRatingCorpus.js';

function values(name) {
  return process.argv.flatMap((value, index) =>
    value === name && process.argv[index + 1] ? [process.argv[index + 1]] : [],
  );
}

function value(name, fallback = null) {
  return values(name).at(-1) || fallback;
}

function jsonl(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${filePath}:${index + 1}: invalid JSON: ${error.message}`);
      }
    });
}

function inputFiles(inputPath) {
  const stat = fs.statSync(inputPath);
  if (stat.isFile()) return [inputPath];
  if (!stat.isDirectory()) throw new Error(`unsupported input: ${inputPath}`);
  return fs
    .readdirSync(inputPath, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const child = path.join(inputPath, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`symbolic-link input rejected: ${child}`);
      if (entry.isDirectory()) return inputFiles(child);
      return entry.isFile() && entry.name.endsWith('.jsonl') ? [child] : [];
    });
}

function writeJsonl(filePath, rows) {
  fs.writeFileSync(filePath, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''), {
    mode: 0o600,
  });
}

function main() {
  const dataHome = process.env.MS_DATA_HOME || path.join(os.homedir(), '.machinespirits-data');
  const inputs = values('--input').map((entry) => path.resolve(entry));
  if (!inputs.length) throw new Error('at least one --input trace file or directory is required');
  const holdoutPath = path.resolve(value('--holdouts', path.join(dataHome, 'catalog', 'holdouts.jsonl')));
  const assetPath = path.resolve(value('--assets', path.join(dataHome, 'catalog', 'assets.jsonl')));
  if (!fs.existsSync(holdoutPath)) {
    throw new Error(`holdout registry is required; exporter fails closed when it is absent: ${holdoutPath}`);
  }
  if (!fs.existsSync(assetPath)) {
    throw new Error(`asset registry is required; exporter fails closed when it is absent: ${assetPath}`);
  }
  const outputDir = path.resolve(
    value('--out', path.join(dataHome, 'tutor-stub', 'training-candidates', `ratings-${Date.now()}`)),
  );
  if (fs.existsSync(outputDir)) throw new Error(`output directory already exists: ${outputDir}`);
  const events = inputs.flatMap((entry) => inputFiles(entry).flatMap(jsonl));
  const records = collectTutorStubFeedbackRecords(events);
  const holdoutRecords = jsonl(holdoutPath);
  const assetRecords = jsonl(assetPath);
  const result = buildTutorStubRatingCandidates({ records, holdoutRecords, assetRecords });

  fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  const candidateFile = path.join(outputDir, 'rating-candidates.jsonl');
  const exclusionFile = path.join(outputDir, 'exclusions.jsonl');
  writeJsonl(candidateFile, result.candidates);
  writeJsonl(exclusionFile, result.exclusions);
  const manifest = {
    schema: 'machinespirits.data-governance.corpus-manifest.v1',
    corpusId: path.basename(outputDir),
    createdAt: new Date().toISOString(),
    trainingStatus: 'candidate',
    sourceAssetIds: [...new Set(result.candidates.map((row) => row.source.assetId))],
    sourceGroupIds: [...new Set(result.candidates.map((row) => row.source.sourceGroupId))],
    files: [candidateFile, exclusionFile].map((filePath) => ({
      path: path.basename(filePath),
      bytes: fs.statSync(filePath).size,
      sha256: sha256File(filePath),
    })),
    splitPolicy: { groupedBy: 'source_group', seed: null },
    notes: 'Zero-model ratings export. Candidate status is not training approval.',
  };
  fs.writeFileSync(path.join(outputDir, 'corpus-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, {
    mode: 0o600,
  });
  console.log(
    JSON.stringify(
      {
        outputDir,
        records: records.length,
        candidates: result.candidates.length,
        exclusions: result.exclusions.length,
        status: 'candidate_not_approved',
      },
      null,
      2,
    ),
  );
}

try {
  main();
} catch (error) {
  console.error(`rating-candidate-export: ${error.message}`);
  process.exitCode = 1;
}
