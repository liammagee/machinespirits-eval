#!/usr/bin/env node

import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  analyzeTutorPrCalibration,
  getTutorPrCalibrationAdjudicationSession,
  getTutorPrCalibrationCodingSession,
  getTutorPrCalibrationStatus,
  prepareTutorPrCalibrationWorkspace,
  renderTutorPrCalibrationAnalysisMarkdown,
  renderTutorPrCalibrationStatus,
  saveTutorPrCalibrationAdjudication,
  saveTutorPrCalibrationCoding,
} from '../services/tutorPrBenchmarkCalibration.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CONFIG = path.join(ROOT, 'config/tutor-pr-benchmark-calibration.yaml');

const HELP = `Usage:
  npm run tutor:stub:pr-benchmark:calibrate -- prepare --report <report.json> --out <directory> [--purpose development|acceptance]
  npm run tutor:stub:pr-benchmark:calibrate -- label --workspace <directory> --coder <id>
  npm run tutor:stub:pr-benchmark:calibrate -- status --workspace <directory> [--json]
  npm run tutor:stub:pr-benchmark:calibrate -- adjudicate --workspace <directory> --coder <id>
  npm run tutor:stub:pr-benchmark:calibrate -- analyze --workspace <directory> [--json]

Options:
  --config <path>       Calibration YAML (default: config/tutor-pr-benchmark-calibration.yaml)
  --purpose <name>      Packet purpose for prepare (default: development)
  --report <path>       Saved tutor PR benchmark report.json
  --out <directory>     New, empty calibration workspace
  --workspace <path>    Existing calibration workspace
  --coder <id>          Independent coder or adjudicator identity
  --json                Print machine-readable output
  --help                Show this help

All commands are artifact-only and make zero model calls. Labelling saves one
sidecar per coder after each completed item, so sessions can pause and resume.`;

function write(output, value = '') {
  output.write(`${value}\n`);
}

function required(value, name) {
  if (!String(value || '').trim()) throw new Error(`--${name} is required`);
  return value;
}

function resolved(value) {
  return path.resolve(process.cwd(), value);
}

function parse(argv) {
  const command = argv[0];
  if (!command || command.startsWith('--')) return { command: 'help', values: {} };
  const { values } = parseArgs({
    args: argv.slice(1),
    options: {
      config: { type: 'string', default: DEFAULT_CONFIG },
      purpose: { type: 'string', default: 'development' },
      report: { type: 'string', default: '' },
      out: { type: 'string', default: '' },
      workspace: { type: 'string', default: '' },
      coder: { type: 'string', default: '' },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });
  return { command: values.help ? 'help' : command, values };
}

function renderTurn(turn) {
  if (typeof turn === 'string') return turn;
  const speaker = turn?.speaker || turn?.role || turn?.agent || 'turn';
  const text = turn?.text || turn?.content || turn?.message || JSON.stringify(turn);
  return `${speaker}> ${text}`;
}

function renderItem(output, item, index, total) {
  write(output, `\n${'='.repeat(76)}`);
  write(output, `${item.item_id} · ${index + 1}/${total} · case ${item.case_id}`);
  if (item.criterion) write(output, `Criterion: ${item.criterion}`);
  write(output, '\nFrozen public context');
  for (const turn of item.prior_turns || []) write(output, renderTurn(turn));
  write(output, `learner> ${item.learner_text || '—'}`);
  write(output, '\nExact candidate');
  write(output, item.candidate || '—');
}

async function askChoice(rl, output, prompt, choices) {
  while (true) {
    choices.forEach((choice, index) => write(output, `  ${index + 1}. ${choice}`));
    const answer = String(await rl.question(`${prompt} [or q to pause]: `))
      .trim()
      .toLowerCase();
    if (answer === 'q' || answer === 'quit') return null;
    const index = Number.parseInt(answer, 10) - 1;
    if (Number.isInteger(index) && index >= 0 && index < choices.length) return choices[index];
    if (choices.includes(answer)) return answer;
    write(output, 'Choose a listed number or value.');
  }
}

async function runLabel({ values, input, output }) {
  const workspaceDir = resolved(required(values.workspace, 'workspace'));
  const configPath = resolved(values.config);
  const coderId = required(values.coder, 'coder');
  const session = getTutorPrCalibrationCodingSession({ workspaceDir, configPath, coderId });
  const axisIds = session.codebook.axes.map((axis) => axis.id);
  const saved = new Set(
    session.saved
      .filter((item) => axisIds.every((axis) => ['pass', 'fail', 'unsure'].includes(item.labels?.[axis])))
      .map((item) => item.item_id),
  );
  const pending = session.items.filter((item) => !saved.has(item.item_id));
  write(output, `Packet ${session.packet_sha256} · ${session.purpose}`);
  write(output, `Coder ${coderId} · ${session.items.length - pending.length}/${session.items.length} complete`);
  if (!pending.length) {
    write(output, 'This coder has completed the packet.');
    return;
  }
  const rl = readline.createInterface({ input, output, terminal: Boolean(input.isTTY && output.isTTY) });
  try {
    for (let index = 0; index < pending.length; index += 1) {
      const item = pending[index];
      renderItem(output, item, session.items.indexOf(item), session.items.length);
      const labels = {};
      for (const axis of session.codebook.axes) {
        write(output, `\n${axis.title}: ${axis.question}`);
        const value = await askChoice(rl, output, axis.id, ['pass', 'fail', 'unsure']);
        if (!value) {
          write(output, 'Paused without saving the current partial item. Earlier items remain saved.');
          return;
        }
        labels[axis.id] = value;
      }
      const notes = await rl.question('Notes [optional]: ');
      saveTutorPrCalibrationCoding({ workspaceDir, configPath, coderId, itemId: item.item_id, labels, notes });
      write(output, `Saved ${item.item_id}.`);
    }
  } finally {
    rl.close();
  }
  write(output, 'Coder packet complete.');
}

async function runAdjudicate({ values, input, output }) {
  const workspaceDir = resolved(required(values.workspace, 'workspace'));
  const configPath = resolved(values.config);
  const coderId = required(values.coder, 'coder');
  const session = getTutorPrCalibrationAdjudicationSession({ workspaceDir, configPath });
  if (!session.unresolved_disagreements.length) {
    write(output, 'No unresolved coder disagreements.');
    return;
  }
  const items = new Map(session.items.map((item) => [item.item_id, item]));
  const axes = new Map(session.codebook.axes.map((axis) => [axis.id, axis]));
  const rl = readline.createInterface({ input, output, terminal: Boolean(input.isTTY && output.isTTY) });
  try {
    for (const dispute of session.unresolved_disagreements) {
      const item = items.get(dispute.item_id);
      renderItem(output, item, session.items.indexOf(item), session.items.length);
      write(output, `\nDisputed axis: ${axes.get(dispute.axis)?.title || dispute.axis}`);
      dispute.coders.forEach((coder, index) => write(output, `- ${coder}: ${dispute.values[index]}`));
      const value = await askChoice(rl, output, 'Gold label', ['pass', 'fail']);
      if (!value) {
        write(output, 'Paused. Earlier adjudications remain saved.');
        return;
      }
      const notes = await rl.question('Adjudication notes [optional]: ');
      saveTutorPrCalibrationAdjudication({
        workspaceDir,
        configPath,
        coderId,
        itemId: dispute.item_id,
        axis: dispute.axis,
        value,
        notes,
      });
      write(output, `Adjudicated ${dispute.item_id}:${dispute.axis}.`);
    }
  } finally {
    rl.close();
  }
  write(output, 'Adjudication complete.');
}

export async function runTutorPrBenchmarkCalibrationScript(
  argv = process.argv.slice(2),
  { input = process.stdin, output = process.stdout, errorOutput = process.stderr } = {},
) {
  try {
    const parsed = parse(argv);
    const { command, values } = parsed;
    if (command === 'help') {
      write(output, HELP);
      return 0;
    }
    const configPath = resolved(values.config);
    if (command === 'prepare') {
      const prepared = prepareTutorPrCalibrationWorkspace({
        root: ROOT,
        reportPath: resolved(required(values.report, 'report')),
        configPath,
        outDir: resolved(required(values.out, 'out')),
        purpose: values.purpose,
      });
      if (values.json) write(output, JSON.stringify(prepared.manifest, null, 2));
      else {
        write(output, `Prepared ${prepared.manifest.purpose} calibration packet.`);
        write(output, `Workspace: ${prepared.workspace}`);
        write(output, `Items: ${prepared.manifest.item_count}`);
        write(output, `Packet: ${prepared.manifest.packet_sha256}`);
      }
      return 0;
    }
    if (command === 'label') {
      await runLabel({ values, input, output });
      return 0;
    }
    if (command === 'status') {
      const status = getTutorPrCalibrationStatus({
        workspaceDir: resolved(required(values.workspace, 'workspace')),
        configPath,
      });
      write(output, values.json ? JSON.stringify(status, null, 2) : renderTutorPrCalibrationStatus(status));
      return 0;
    }
    if (command === 'adjudicate') {
      await runAdjudicate({ values, input, output });
      return 0;
    }
    if (command === 'analyze') {
      const report = analyzeTutorPrCalibration({
        workspaceDir: resolved(required(values.workspace, 'workspace')),
        configPath,
      });
      write(output, values.json ? JSON.stringify(report, null, 2) : renderTutorPrCalibrationAnalysisMarkdown(report));
      return 0;
    }
    throw new Error(`unknown command ${command}`);
  } catch (error) {
    errorOutput.write(`Tutor PR benchmark calibration failed: ${error.message}\n`);
    return 1;
  }
}

if (path.resolve(process.argv[1] || '') === path.resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = await runTutorPrBenchmarkCalibrationScript();
}
