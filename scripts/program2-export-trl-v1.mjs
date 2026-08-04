#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { sha256, sha256File } from '../services/dataGovernance.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function argValue(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function readJsonl(filePath) {
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

export function flattenProgram2BaseRequest(request) {
  const lines = [String(request.systemPrompt).trim(), '', '--- Dialogue transcript ---'];
  for (const message of request.messages) {
    const speaker = message.role === 'assistant' ? 'Tutor' : 'Learner';
    lines.push('', `${speaker}: ${String(message.content).trim()}`);
  }
  lines.push('', 'Tutor:');
  return lines.join('\n');
}

function assertRequest(row, label) {
  if (!row?.request || typeof row.request.systemPrompt !== 'string' || !Array.isArray(row.request.messages)) {
    throw new Error(`${label} ${row?.turnId || '<unknown>'} has no reconstructable request`);
  }
}

function exclusionKey(value) {
  return `${value.dialogueId}\u0000${value.turnId}`;
}

function sftIdentity(row) {
  return JSON.stringify({ request: row.request, target: row.target });
}

export function formatProgram2TrlRows({ taskARows = [], generalRows, ktoRows, exclusions = [] }) {
  const taskATrainRows = taskARows.filter((row) => row.split === 'train');
  const sourceSft = generalRows.filter((row) => row.split === 'train');
  const exclusionKeys = new Set(exclusions.map(exclusionKey));
  const excluded = sourceSft.filter((row) => exclusionKeys.has(exclusionKey(row)));
  const unknownExclusions = exclusions.filter(
    (exclusion) => !excluded.some((row) => exclusionKey(row) === exclusionKey(exclusion)),
  );
  if (unknownExclusions.length) {
    throw new Error(`exclusion rows not found in SFT train split: ${unknownExclusions.map(exclusionKey).join(', ')}`);
  }
  const taskAIdentities = new Set(taskATrainRows.map(sftIdentity));
  const sftRows = [
    ...taskATrainRows,
    ...sourceSft.filter((row) => !taskAIdentities.has(sftIdentity(row)) && !exclusionKeys.has(exclusionKey(row))),
  ];
  for (const row of sftRows) {
    assertRequest(row, 'SFT row');
    if (typeof row.target !== 'string' || !row.target.trim()) throw new Error(`SFT row ${row.turnId} has no target`);
  }
  const ktoTrainRows = ktoRows.filter((row) => row.split === 'train');
  for (const row of ktoTrainRows) {
    assertRequest(row, 'KTO row');
    if (typeof row.text !== 'string' || !row.text.trim() || typeof row.label !== 'boolean') {
      throw new Error(`KTO row ${row.turnId} has invalid text or label`);
    }
  }
  return {
    sftInstruct: sftRows.map((row) => ({
      messages: [
        { role: 'system', content: row.request.systemPrompt },
        ...row.request.messages,
        { role: 'assistant', content: row.target },
      ],
    })),
    sftBase: sftRows.map((row) => ({
      prompt: flattenProgram2BaseRequest(row.request),
      completion: ` ${row.target.trim()}`,
    })),
    kto: ktoTrainRows.map((row) => ({
      prompt: [{ role: 'system', content: row.request.systemPrompt }, ...row.request.messages],
      completion: [{ role: 'assistant', content: row.text }],
      label: row.label,
    })),
    lineage: [
      ...sftRows.map((row, index) => ({
        schema: 'machinespirits.data-governance.row-lineage.v1',
        outputFile: 'sft-instruct.jsonl,sft-base.jsonl',
        outputRow: index,
        sourceAssetId: 'program2-dataset-v1',
        sourceFile: taskAIdentities.has(sftIdentity(row)) ? 'taskA-sft.jsonl' : 'general-sft.jsonl',
        sourceGroupId: row.dialogueId,
        turnId: row.turnId,
        targetSha256: sha256(row.target),
      })),
      ...ktoTrainRows.map((row, index) => ({
        schema: 'machinespirits.data-governance.row-lineage.v1',
        outputFile: 'kto.jsonl',
        outputRow: index,
        sourceAssetId: 'program2-dataset-v1',
        sourceFile: 'kto.jsonl',
        sourceGroupId: row.dialogueId,
        turnId: row.turnId,
        targetSha256: sha256(row.text),
      })),
    ],
    reconciliation: {
      sourceSftTrainRows: sourceSft.length,
      prioritizedTaskATrainRows: taskATrainRows.length,
      outputSftRows: sftRows.length,
      excludedSftRows: excluded.map((row) => ({ turnId: row.turnId, dialogueId: row.dialogueId, turn: row.turn })),
      sourceKtoTrainRows: ktoTrainRows.length,
      outputKtoRows: ktoTrainRows.length,
    },
  };
}

function pythonJsonString(value) {
  return [...JSON.stringify(value)]
    .map((character) => {
      const point = character.codePointAt(0);
      if (point <= 0x7f) return character;
      const codeUnits =
        point <= 0xffff ? [point] : [0xd800 + ((point - 0x10000) >> 10), 0xdc00 + ((point - 0x10000) & 0x3ff)];
      return codeUnits.map((codeUnit) => `\\u${codeUnit.toString(16).padStart(4, '0')}`).join('');
    })
    .join('');
}

function pythonJsonDumps(value) {
  if (typeof value === 'string') return pythonJsonString(value);
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(pythonJsonDumps).join(', ')}]`;
  return `{${Object.entries(value)
    .map(([key, entry]) => `${pythonJsonString(key)}: ${pythonJsonDumps(entry)}`)
    .join(', ')}}`;
}

function writeJsonl(filePath, rows) {
  fs.writeFileSync(filePath, rows.map((row) => pythonJsonDumps(row)).join('\n') + '\n');
}

export function exportProgram2TrlV1({ inputDir, outputDir, exclusionsPath, force = false }) {
  if (fs.existsSync(outputDir)) {
    if (!force) throw new Error(`output directory exists (pass --force to replace it): ${outputDir}`);
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
  const exclusions = JSON.parse(fs.readFileSync(exclusionsPath, 'utf8'));
  const formatted = formatProgram2TrlRows({
    taskARows: readJsonl(path.join(inputDir, 'taskA-sft.jsonl')),
    generalRows: readJsonl(path.join(inputDir, 'general-sft.jsonl')),
    ktoRows: readJsonl(path.join(inputDir, 'kto.jsonl')),
    exclusions: exclusions.exclusions,
  });
  fs.mkdirSync(outputDir, { recursive: true });
  const files = [
    ['kto.jsonl', formatted.kto],
    ['sft-base.jsonl', formatted.sftBase],
    ['sft-instruct.jsonl', formatted.sftInstruct],
  ];
  for (const [name, rows] of files) writeJsonl(path.join(outputDir, name), rows);
  writeJsonl(path.join(outputDir, 'lineage.jsonl'), formatted.lineage);
  const manifest = Object.fromEntries(
    files.map(([name, rows]) => [name, { rows: rows.length, sha256: sha256File(path.join(outputDir, name)) }]),
  );
  fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(
    path.join(outputDir, 'reconciliation.json'),
    `${JSON.stringify(
      {
        schema: 'machinespirits.program2.trl-reconciliation.v1',
        exclusionLedger: path.relative(ROOT, exclusionsPath),
        lineage: {
          file: 'lineage.jsonl',
          rows: formatted.lineage.length,
          sha256: sha256File(path.join(outputDir, 'lineage.jsonl')),
        },
        ...formatted.reconciliation,
      },
      null,
      2,
    )}\n`,
  );
  return { manifest, reconciliation: formatted.reconciliation };
}

function main() {
  const dataHome = process.env.MS_DATA_HOME || path.join(os.homedir(), '.machinespirits-data');
  const inputDir = path.resolve(argValue('--input', path.join(dataHome, 'program-2', 'datasets', 'v1')));
  const outputDir = path.resolve(argValue('--out', path.join(dataHome, 'program-2', 'datasets', 'trl-v1-rebuilt')));
  const exclusionsPath = path.resolve(
    argValue('--exclusions', path.join(ROOT, 'config', 'data-governance', 'program2-v1-trl-exclusions.json')),
  );
  const result = exportProgram2TrlV1({
    inputDir,
    outputDir,
    exclusionsPath,
    force: process.argv.includes('--force'),
  });
  console.log(JSON.stringify({ outputDir, ...result }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
