#!/usr/bin/env node

/**
 * Registered endpoint 5, report-only: defensive speech acts per turn.
 *
 * Reads the live semantic-event extraction the warrant gate stored on each
 * decision, so no reader and no model call is involved. Point it at one or more
 * run directories, or at the event JSONL files directly.
 *
 *   node scripts/report-adaptive-warrant-defensive-acts.js <run-dir|jsonl> [...] [--out <file>] [--json]
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  countAdaptiveWarrantDefensiveActs,
  summarizeAdaptiveWarrantDefensiveActs,
} from '../services/adaptiveWarrantDefensiveActCounts.js';
import { ADAPTIVE_WARRANT_SEMANTIC_DEFENSIVE_SPEECH_ACTS } from '../services/adaptiveWarrantSemanticEvents.js';

const GATE_DECISION_EVENT = 'tutor_warrant_gate_decision';

/** The run's turn-event JSONL files, newest name last. */
export function resolveDefensiveActEventFiles(target) {
  const resolved = path.resolve(target);
  if (!fs.existsSync(resolved)) throw new Error(`no such run directory or file: ${target}`);
  if (fs.statSync(resolved).isFile()) return [resolved];
  return fs
    .readdirSync(resolved)
    .filter((name) => name.endsWith('.jsonl') && !name.startsWith('run-'))
    .sort()
    .map((name) => path.join(resolved, name));
}

/** Gate decisions from one JSONL file, in turn order. */
export function readGateDecisions(filePath) {
  const rows = [];
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (row?.type !== GATE_DECISION_EVENT || !row.decision) continue;
    rows.push({ ...row.decision, turn: row.turn ?? row.decision.turn ?? null });
  }
  return rows.sort((left, right) => (left.turn || 0) - (right.turn || 0));
}

export function reportDefensiveActsForTargets(targets = []) {
  const dialogues = [];
  for (const target of targets) {
    for (const filePath of resolveDefensiveActEventFiles(target)) {
      const decisions = readGateDecisions(filePath);
      if (!decisions.length) continue;
      dialogues.push(countAdaptiveWarrantDefensiveActs({ decisions, dialogueId: path.basename(filePath, '.jsonl') }));
    }
  }
  return summarizeAdaptiveWarrantDefensiveActs(dialogues);
}

function renderTable(summary) {
  const lines = [
    `dialogues ${summary.dialogue_count}  turns ${summary.turn_count}  measured ${summary.measured_turn_count}  unmeasured ${summary.unmeasured_turn_count}`,
    '',
  ];
  for (const act of ADAPTIVE_WARRANT_SEMANTIC_DEFENSIVE_SPEECH_ACTS) {
    lines.push(`${act.padEnd(30)} ${String(summary.totals[act]).padStart(5)}`);
  }
  lines.push(`${'total'.padEnd(30)} ${String(summary.total).padStart(5)}`);
  if (!summary.complete) {
    lines.push('', 'Unmeasured turns (endpoint 5 is incomplete for this set):');
    for (const dialogue of summary.dialogues) {
      for (const row of dialogue.unmeasured_turns) {
        lines.push(`  ${dialogue.dialogue_id} turn ${row.turn}: ${row.reason}`);
      }
    }
  }
  return lines.join('\n');
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string' },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  if (values.help || !positionals.length) {
    process.stdout.write(
      'Usage:\n  node scripts/report-adaptive-warrant-defensive-acts.js <run-dir|jsonl> [...] [--out <file>] [--json]\n',
    );
    return;
  }
  const summary = reportDefensiveActsForTargets(positionals);
  if (values.out) {
    const resolved = path.resolve(values.out);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, `${JSON.stringify(summary, null, 2)}\n`);
  }
  process.stdout.write(`${values.json ? JSON.stringify(summary, null, 2) : renderTable(summary)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`[defensive-acts] ${error.message}`);
    process.exitCode = 1;
  }
}
