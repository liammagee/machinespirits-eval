#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { buildActionOutcomeMemory } from '../services/adaptiveTutor/actionOutcomeMemory.js';
import {
  ACTION_OUTCOME_MEMORY_READINESS_VERSION,
  extractActionOutcomeMemoryEvidence,
  replayActionOutcomeMemoryDecisions,
} from '../services/adaptiveTutor/actionOutcomeMemoryReadiness.js';

const RETAINED_TYPES = new Set([
  'run_start',
  'history_clear',
  'tutor_typed_action_decision',
  'tutor_typed_action_decision_displaced',
  'tutor_typed_action_outcome_closed',
  'turn_complete',
]);

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a nonempty string`);
  return value.trim();
}

function listJsonlFiles(root) {
  const stat = fs.lstatSync(root);
  if (stat.isSymbolicLink()) throw new Error(`readiness inputs must not be symlinks: ${root}`);
  if (stat.isFile()) {
    if (!root.endsWith('.jsonl')) throw new Error(`readiness inputs must be JSONL: ${root}`);
    return [root];
  }
  if (!stat.isDirectory()) throw new Error(`readiness input is not a file or directory: ${root}`);
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => !entry.isSymbolicLink() && (entry.isDirectory() || entry.name.endsWith('.jsonl')))
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => listJsonlFiles(path.join(root, entry.name)));
}

async function readTrace(filePath) {
  const before = fs.statSync(filePath);
  const stream = fs.createReadStream(filePath);
  const hash = createHash('sha256');
  stream.on('data', (chunk) => hash.update(chunk));
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  const events = [];
  const errors = [];
  let lineNumber = 0;
  let eventCount = 0;
  let previousSeq = 0;
  let previousTime = -Infinity;
  let runId = null;
  for await (const line of lines) {
    lineNumber += 1;
    if (!line.trim()) continue;
    eventCount += 1;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      errors.push({ line: lineNumber, reason: 'malformed_jsonl' });
      continue;
    }
    const time = typeof event?.ts === 'string' ? Date.parse(event.ts) : NaN;
    if (!Number.isInteger(event?.seq) || event.seq <= previousSeq || !Number.isFinite(time) || time < previousTime) {
      errors.push({ line: lineNumber, reason: 'invalid_event_order_or_time' });
    }
    if (!event?.runId || (runId && event.runId !== runId))
      errors.push({ line: lineNumber, reason: 'mixed_or_missing_run_id' });
    runId ||= event?.runId || null;
    previousSeq = event?.seq;
    previousTime = time;
    if (RETAINED_TYPES.has(event?.type)) events.push(event);
  }
  const after = fs.statSync(filePath);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ino !== after.ino) {
    errors.push({ reason: 'source_changed_during_read' });
  }
  return { events, eventCount, errors, sha256: hash.digest('hex'), bytes: after.size };
}

function addCounts(target, counts) {
  for (const [key, count] of Object.entries(counts)) target[key] = (target[key] || 0) + count;
}

function sourceMetadata(metadata = {}) {
  metadata ||= {};
  return {
    world: metadata.world || null,
    modelRef: metadata.modelRef || null,
    tutor: metadata.resolved ? { provider: metadata.resolved.provider, model: metadata.resolved.model } : null,
    classifierModelRef: metadata.classifier?.modelRef || null,
    learnerRecordModelRef: metadata.tutorLearnerDag?.modelRef || null,
    autoLearnerModelRef: metadata.autoLearner?.modelRef || null,
    automatedLearner: metadata.autoLearner?.enabled === true,
    learnerAnalysisPromptProfile: metadata.learnerAnalysisPromptProfile || null,
    typedActionsEnabled: metadata.typedPedagogicalActions?.enabled === true,
    sourceCommit: metadata.provenance?.git?.commit || metadata.provenance?.gitCommit || null,
  };
}

export async function buildActionOutcomeMemoryReadiness(input, { inputDirectory = process.cwd() } = {}) {
  const asOf = requireString(input?.asOf, 'asOf');
  if (!Number.isFinite(Date.parse(asOf))) throw new Error('asOf must be a valid timestamp');
  if (!Array.isArray(input?.sources) || !input.sources.length) throw new Error('sources must be a nonempty array');
  const conditions = input.conditions || [];
  const reviews = input.reviewsFile
    ? JSON.parse(fs.readFileSync(path.resolve(inputDirectory, input.reviewsFile), 'utf8'))
    : [];
  const specifications = [];
  for (const source of input.sources) {
    const sourcePath = path.resolve(inputDirectory, requireString(source?.path, 'source.path'));
    const contextKey = requireString(source.contextKey, 'source.contextKey');
    if (!['memory', 'evaluation'].includes(source.role)) throw new Error('source.role must be memory or evaluation');
    const files = listJsonlFiles(sourcePath);
    if (!files.length) throw new Error(`no JSONL files under ${sourcePath}`);
    for (const filePath of files) specifications.push({ path: filePath, contextKey, role: source.role });
  }
  const paths = new Set();
  for (const source of specifications) {
    if (paths.has(source.path)) throw new Error(`source path listed more than once: ${source.path}`);
    paths.add(source.path);
  }
  const sources = [];
  for (const specification of specifications.sort((left, right) => left.path.localeCompare(right.path))) {
    const read = await readTrace(specification.path);
    const extracted = extractActionOutcomeMemoryEvidence({
      events: read.events,
      source: specification.path,
      contextKey: specification.contextKey,
      conditions,
      reviews,
      asOf,
    });
    sources.push({ ...specification, ...read, extracted });
  }
  const runGroups = new Map();
  for (const source of sources) {
    const runId = source.extracted.runId;
    if (!runGroups.has(runId)) runGroups.set(runId, []);
    runGroups.get(runId).push(source);
  }
  for (const group of runGroups.values()) {
    if (group.length < 2) continue;
    if (
      new Set(group.map((source) => source.sha256)).size === 1 &&
      new Set(group.map((source) => `${source.role}:${source.contextKey}`)).size === 1
    ) {
      for (const source of group.slice(1)) source.errors.push({ reason: 'duplicate_source_copy' });
    } else {
      for (const source of group) source.errors.push({ reason: 'conflicting_run_copies' });
    }
  }
  for (const source of sources) {
    if (source.events.some((event) => event.type === 'history_clear') || source.extracted.metadata?.resume?.runId) {
      source.errors.push({ reason: 'history_reset_or_resume_requires_complete_lineage' });
    }
  }
  const usable = sources.filter((source) => !source.errors.length);
  const memorySources = usable.filter((source) => source.role === 'memory');
  const records = memorySources.flatMap((source) => source.extracted.records);
  const memory = buildActionOutcomeMemory(records, { asOf, source: 'action-outcome-memory-readiness' });
  const evaluationSources = usable
    .filter((source) => source.role === 'evaluation')
    .map((source) => ({
      source: source.path,
      contextKey: source.contextKey,
      metadata: source.extracted.metadata,
      events: source.events,
    }));
  const replay = input.replay
    ? replayActionOutcomeMemoryDecisions({
        ...input.replay,
        evaluationSources,
        records,
        conditions,
        asOf,
      })
    : { summary: null, cases: [], reason: 'replay_not_configured' };
  const exclusionCounts = {};
  for (const source of sources) {
    addCounts(exclusionCounts, source.extracted.exclusionCounts);
    for (const error of source.errors) addCounts(exclusionCounts, { [error.reason]: 1 });
  }
  for (const exclusion of memory.exclusions) addCounts(exclusionCounts, { [exclusion.reason]: 1 });
  const decisions = sources.reduce((sum, source) => sum + source.extracted.inventory.decisions, 0);
  const binary = memory.records.filter((record) => ['success', 'failure'].includes(record.outcome));
  const gaps = [];
  if (!decisions) gaps.push('No typed-action decisions were found in the supplied traces.');
  if (!memory.records.length) gaps.push('No usable, conditioned action-outcome records were produced.');
  if (!binary.length) gaps.push('No independently human-confirmed binary outcomes are available.');
  if (!input.replay) gaps.push('Offline replay has not been configured; no scientific thresholds were invented.');
  else if (!replay.summary.replayed) gaps.push('No evaluation decisions had all required pre-action replay inputs.');
  const report = {
    schema: ACTION_OUTCOME_MEMORY_READINESS_VERSION,
    asOf,
    modelCalls: 0,
    claimBoundary:
      'Structural evidence readiness and deterministic choice replay only; no learning, transfer, or causal outcome estimate.',
    conditions: cloneForReport(conditions),
    replaySettings: input.replay ? cloneForReport(input.replay) : null,
    summary: {
      sourceFiles: sources.length,
      memorySources: sources.filter((source) => source.role === 'memory').length,
      evaluationSources: sources.filter((source) => source.role === 'evaluation').length,
      quarantinedSources: sources.filter((source) => source.errors.length).length,
      events: sources.reduce((sum, source) => sum + source.eventCount, 0),
      typedDecisions: decisions,
      closedOutcomes: sources.reduce((sum, source) => sum + source.extracted.inventory.outcomes, 0),
      joinedMemoryRecords: memory.records.length,
      humanConfirmedBinary: binary.length,
      measurementIndeterminate: memory.records.filter((record) => record.outcome === 'measurement_indeterminate')
        .length,
      independentDialogues: new Set(binary.map((record) => record.dialogueId)).size,
      worlds: [...new Set(memory.records.map((record) => record.worldId))].sort(),
      cells: memory.cells.length,
    },
    sources: sources.map((source) => ({
      path: source.path,
      role: source.role,
      contextKey: source.contextKey,
      runId: source.extracted.runId,
      sha256: source.sha256,
      bytes: source.bytes,
      inventory: source.extracted.inventory,
      metadata: sourceMetadata(source.extracted.metadata),
      errors: source.errors,
      exclusionCounts: source.extracted.exclusionCounts,
    })),
    exclusionCounts,
    evidenceRows: memorySources.flatMap((source) => source.extracted.rows),
    recordExclusions: memorySources.flatMap((source) => source.extracted.exclusions),
    coverage: memory.cells,
    replay: replay.summary,
    gaps,
  };
  return { report, memory, replay };
}

function cloneForReport(value) {
  return JSON.parse(JSON.stringify(value));
}

export function renderActionOutcomeMemoryReadiness(report) {
  const summary = report.summary;
  return [
    '# Action-outcome memory readiness',
    '',
    `As of: ${report.asOf}. Model calls: 0.`,
    '',
    report.claimBoundary,
    '',
    '| Evidence | Count |',
    '| --- | ---: |',
    `| Source trace files | ${summary.sourceFiles} |`,
    `| Quarantined source files | ${summary.quarantinedSources} |`,
    `| Typed-action decisions | ${summary.typedDecisions} |`,
    `| Closed next-turn outcomes | ${summary.closedOutcomes} |`,
    `| Joined, conditioned memory records | ${summary.joinedMemoryRecords} |`,
    `| Human-confirmed binary outcomes | ${summary.humanConfirmedBinary} |`,
    `| Measurement-indeterminate records | ${summary.measurementIndeterminate} |`,
    `| Independent dialogues with binary support | ${summary.independentDialogues} |`,
    `| Worlds / condition-family-support cells | ${summary.worlds.length} / ${summary.cells} |`,
    '',
    '## Gaps',
    '',
    ...(report.gaps.length
      ? report.gaps.map((gap) => `- ${gap}`)
      : [
          '- No structural gap was detected under the supplied settings. Measurement validity and study design still require separate assessment.',
        ]),
    '',
    '## Exclusions',
    '',
    ...Object.entries(report.exclusionCounts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([reason, count]) => `- ${reason}: ${count}`),
    '',
    '## Offline decisions',
    '',
    ...(report.replay
      ? [
          `Replayed ${report.replay.replayed}/${report.replay.decisions} decisions; excluded ${report.replay.excluded}.`,
          `Choices changed: current ${report.replay.currentChanged}; stale ${report.replay.staleChanged}; scrambled ${report.replay.scrambledChanged}. Current-memory abstentions: ${report.replay.currentAbstained}.`,
          `Scrambled comparisons not evaluable: ${report.replay.scrambledNotEvaluable}; these are not unchanged choices.`,
        ]
      : ['Not configured.']),
    '',
    'Replay holds the recorded decision inputs fixed. A different choice has no observed counterfactual learner outcome. Same-world lookup and held-out-world pooling are distinct settings; this report does not infer transfer from either.',
    '',
    'See readiness.json for source provenance, per-record exclusions and coverage; memory.json for the supplied snapshot; replay.json for per-decision arm results. Raw public text is not copied into these outputs.',
    '',
  ].join('\n');
}

async function main() {
  const { values } = parseArgs({
    options: { input: { type: 'string' }, out: { type: 'string' }, help: { type: 'boolean' } },
  });
  if (values.help) {
    console.log(
      'Usage: node scripts/action-outcome-memory-readiness.js --input <json> --out <new-directory>\nZero-call trace audit and deterministic choice replay. See docs/action-outcome-memory-readiness.md.',
    );
    return;
  }
  const inputPath = path.resolve(requireString(values.input, '--input'));
  const outputPath = path.resolve(requireString(values.out, '--out'));
  if (fs.existsSync(outputPath)) throw new Error(`refusing to overwrite readiness output: ${outputPath}`);
  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const result = await buildActionOutcomeMemoryReadiness(input, { inputDirectory: path.dirname(inputPath) });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.mkdirSync(outputPath);
  for (const [name, value] of [
    ['readiness.json', result.report],
    ['memory.json', result.memory],
    ['replay.json', result.replay],
  ]) {
    fs.writeFileSync(path.join(outputPath, name), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  }
  fs.writeFileSync(path.join(outputPath, 'README.md'), renderActionOutcomeMemoryReadiness(result.report), {
    flag: 'wx',
  });
  console.log(
    JSON.stringify({ output: outputPath, summary: result.report.summary, gaps: result.report.gaps }, null, 2),
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
