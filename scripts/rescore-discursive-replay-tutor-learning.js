#!/usr/bin/env node
/**
 * Re-score existing discursive replay bundles for recursive tutor learning.
 *
 * This does not rewrite transcripts and does not overwrite the original
 * check.json/gate.json. It reads each selected replay record's original public
 * transcript + revision.json, runs the updated smoke-check prompt, and writes:
 *
 *   recursive-check.prompt.txt
 *   recursive-check.raw.txt
 *   recursive-check.json
 *   recursive-gate.json
 *
 * plus recursive-learning-summary.json at the replay root.
 */

import 'dotenv/config';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  adversarialCheckerFor,
  buildCheckPrompt,
  callBackend,
  evaluateLocalGate,
  normalizeBackend,
  parseJsonResponse,
} from './replay-discursive-transcript.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_TIMEOUT_MS = 360_000;
const DEFAULT_AGY_BIN = process.env.AGY_BIN || path.join(os.homedir(), '.local/bin/agy');
const DEFAULT_CODEX_EFFORT = process.env.CODEX_REASONING_EFFORT || 'xhigh';

function usage() {
  return `Usage:
  node scripts/rescore-discursive-replay-tutor-learning.js --replay-dir DIR [--force]
    [--checker mock|codex|claude|agy|gemini|adversarial]
    [--include-status survivor[,revise_again|reject|unchecked|disabled]]
    [--policy-memory path]
    [--min-tutor-learning-signal N] [--min-resistance-diagnosis N]
    [--min-strategy-revision-accountability N]
    [--min-strategic-timing N] [--min-recursive-dyadic-update N]
    [--timeout-ms N] [--dry-run]

Default: --checker mock, include only survivor records, and enable the recursive
tutor-learning local gate. Use --checker adversarial to choose the opposing CLI
from each record's generator provenance.`;
}

function defaultArgs() {
  return {
    replayDir: null,
    checker: 'mock',
    includeStatus: ['survivor'],
    policyMemoryFiles: [],
    timeoutMs: DEFAULT_TIMEOUT_MS,
    codexEffort: DEFAULT_CODEX_EFFORT,
    codexModel: process.env.CODEX_MODEL || null,
    claudeModel: process.env.CLAUDE_CODE_MODEL || null,
    claudeEffort: process.env.CLAUDE_CODE_EFFORT || null,
    agyBin: DEFAULT_AGY_BIN,
    agyModelLabel: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    recursiveTutorGate: true,
    recursiveTutorThresholds: {},
    force: false,
    dryRun: false,
  };
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = defaultArgs();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--replay-dir') args.replayDir = path.resolve(argv[++i]);
    else if (token === '--checker') args.checker = normalizeBackend(argv[++i]);
    else if (token === '--include-status') args.includeStatus = splitCsv(argv[++i]);
    else if (token === '--policy-memory') args.policyMemoryFiles.push(path.resolve(argv[++i]));
    else if (token === '--timeout-ms') args.timeoutMs = Number(argv[++i]);
    else if (token === '--codex-effort') args.codexEffort = argv[++i];
    else if (token === '--codex-model') args.codexModel = argv[++i];
    else if (token === '--claude-model') args.claudeModel = argv[++i];
    else if (token === '--claude-effort') args.claudeEffort = argv[++i];
    else if (token === '--agy-bin') args.agyBin = path.resolve(argv[++i]);
    else if (token === '--agy-model-label') args.agyModelLabel = argv[++i];
    else if (token === '--min-tutor-learning-signal') {
      args.recursiveTutorThresholds.tutor_learning_signal = Number(argv[++i]);
    } else if (token === '--min-resistance-diagnosis') {
      args.recursiveTutorThresholds.resistance_diagnosis = Number(argv[++i]);
    } else if (token === '--min-strategy-revision-accountability') {
      args.recursiveTutorThresholds.strategy_revision_accountability = Number(argv[++i]);
    } else if (token === '--min-strategic-timing') {
      args.recursiveTutorThresholds.strategic_timing = Number(argv[++i]);
    } else if (token === '--min-recursive-dyadic-update') {
      args.recursiveTutorThresholds.recursive_dyadic_update = Number(argv[++i]);
    } else if (token === '--force') args.force = true;
    else if (token === '--dry-run') args.dryRun = true;
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  if (args.help) return args;
  if (!args.replayDir) throw new Error(`--replay-dir is required\n\n${usage()}`);
  if (!fs.existsSync(path.join(args.replayDir, 'manifest.json'))) {
    throw new Error(`replay manifest not found: ${path.join(args.replayDir, 'manifest.json')}`);
  }
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 1) throw new Error('--timeout-ms must be positive');
  for (const filePath of args.policyMemoryFiles) {
    if (!fs.existsSync(filePath)) throw new Error(`policy memory file not found: ${filePath}`);
  }
  return args;
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function rel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

function policyMemoryForArgs(args) {
  return args.policyMemoryFiles
    .map((filePath) => readText(filePath).trim())
    .filter(Boolean)
    .join('\n\n---\n\n');
}

function recordStatus(record) {
  return record?.gate?.status || 'unknown';
}

function checkerForRecord(args, record) {
  if (args.checker !== 'adversarial') return args.checker;
  const generator = record?.generator?.backend;
  if (!generator) throw new Error(`record ${record?.item?.id || 'unknown'} has no generator backend for adversarial check`);
  return adversarialCheckerFor(generator);
}

function summarizeRecord(record, gate, checkPath, gatePath) {
  const scores = gate?.recursive_tutor_learning_gate?.scores || {};
  const compactScores = {};
  for (const [key, value] of Object.entries(scores)) compactScores[key] = value.value;
  return {
    item_id: record?.item?.id || null,
    run_id: record?.item?.run_id || null,
    previous_gate_status: recordStatus(record),
    recursive_gate_status: gate.status,
    recursive_gate_escalate: gate.escalate,
    recursive_scores: compactScores,
    failures: gate.failures || [],
    warnings: gate.warnings || [],
    recursive_check_path: checkPath,
    recursive_gate_path: gatePath,
  };
}

export async function runRecursiveTutorLearningRescore(rawArgs) {
  const args = typeof rawArgs?.replayDir === 'string' ? { ...defaultArgs(), ...rawArgs } : parseArgs(rawArgs);
  if (args.help) return { help: usage() };

  const manifestPath = path.join(args.replayDir, 'manifest.json');
  const manifest = readJson(manifestPath);
  const records = (manifest.records || []).filter((record) => args.includeStatus.includes(recordStatus(record)));
  const policyMemoryText = policyMemoryForArgs(args);
  const results = [];

  for (const record of records) {
    const itemDir = record?.paths?.itemDir;
    if (!itemDir) continue;
    const promptPath = path.join(itemDir, 'recursive-check.prompt.txt');
    const rawPath = path.join(itemDir, 'recursive-check.raw.txt');
    const checkPath = path.join(itemDir, 'recursive-check.json');
    const gatePath = path.join(itemDir, 'recursive-gate.json');
    if ((fs.existsSync(checkPath) || fs.existsSync(gatePath)) && !args.force) {
      throw new Error(`recursive rescore exists for ${itemDir} (pass --force to overwrite)`);
    }

    const revision = readJson(record.paths.revisionJson);
    const publicTranscript = readText(record.paths.originalPublic);
    const prompt = buildCheckPrompt({
      item: record.item || {},
      publicTranscript,
      revision,
      policyMemoryText,
    });
    fs.writeFileSync(promptPath, `${prompt.systemPrompt}\n\n---\n\n${prompt.userPrompt}`);

    if (args.dryRun) {
      results.push({
        item_id: record?.item?.id || null,
        previous_gate_status: recordStatus(record),
        dry_run: true,
        recursive_check_prompt_path: promptPath,
      });
      continue;
    }

    const checker = checkerForRecord(args, record);
    const checkerCall = await callBackend(checker, prompt, { ...args, publicTranscript }, 'checker');
    fs.writeFileSync(rawPath, checkerCall.content);
    const parsed = parseJsonResponse(checkerCall.content);
    const check = { parsed, provenance: checkerCall.provenance };
    writeJson(checkPath, check);
    const gate = evaluateLocalGate(parsed, revision, {
      ...args,
      localGate: true,
      recursiveTutorGate: true,
    });
    writeJson(gatePath, gate);
    results.push(summarizeRecord(record, gate, checkPath, gatePath));
  }

  const summary = {
    kind: 'discursive_replay_recursive_tutor_learning_rescore',
    created_at: new Date().toISOString(),
    replay_dir: args.replayDir,
    checker: args.checker,
    include_status: args.includeStatus,
    recursive_tutor_gate: true,
    count: results.length,
    status_counts: results.reduce((acc, row) => {
      const status = row.recursive_gate_status || (row.dry_run ? 'dry_run' : 'unknown');
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {}),
    results,
  };
  const summaryPath = path.join(args.replayDir, 'recursive-learning-summary.json');
  writeJson(summaryPath, summary);
  return { summaryPath, summary };
}

async function main() {
  try {
    const args = parseArgs();
    if (args.help) {
      console.log(usage());
      return;
    }
    const result = await runRecursiveTutorLearningRescore(args);
    console.log(
      JSON.stringify(
        {
          summaryPath: rel(result.summaryPath),
          count: result.summary.count,
          status_counts: result.summary.status_counts,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    console.error(err.message || String(err));
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  await main();
}
