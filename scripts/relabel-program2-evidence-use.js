#!/usr/bin/env node
// Re-ask the archived Program 2 classifier calls under the v2_bridge_voiced
// evidence_use rubric, so the stored labels can serve as distillation targets for
// the construct we can actually state.
//
// This is a replay, not a re-derivation. Every archived record already carries the
// exact system prompt, user prompt, message history, token cap and effort that
// produced its label, and the v1->v2 edit touches exactly one line of the user
// prompt. So the tool substitutes that one line and re-issues; everything else is
// held identical because it is read back from the record rather than rebuilt. The
// substitution is proven per record (the v1 precedence line must occur exactly
// once) and a record that fails the proof is refused, not relabelled under a false
// premise.
//
// Two properties are worth naming because they are what make the output readable:
//
//  1. The re-issue regenerates the whole classification, not just evidence_use.
//     Four sibling fields -- agency, discourse_move, epistemic_stance,
//     request_type -- are categorical and their prompt clauses are byte-unchanged
//     by the edit, so their v1-vs-v2 disagreement rate is a same-model re-draw
//     noise floor. `--report` prints it beside the evidence_use migration, which is
//     the difference between "the rubric moved the label" and "the sampler did".
//
//  2. warrant_skip fires on two labels, omits_warrant AND overleaps_evidence, so
//     the gate-relevant quantity is not the omits_warrant rate alone but whether
//     the pair still fires. The report computes that directly.
//
// Two facts make the replay environment-faithful rather than merely
// prompt-faithful, both checked against the bridge rather than assumed:
//
//  - The codex bridge spawns with --ephemeral --ignore-user-config --ignore-rules
//    -C <tmpdir> from a fresh temp cwd (services/cliProviderBridge.js), so no
//    ambient project context reaches the call. A replay issued from any worktree
//    sees the same environment the original did.
//  - The classifier's call site passes no output schema (callPromptModel in
//    scripts/tutor-stub.js forwards only messageHistory, effort, onEvent, signal),
//    so this tool forwarding {messageHistory, effort} matches it. onEvent is a
//    trace callback and signal an abort handle; neither changes the request.
//
// Runs on shared CLI-provider quota, so it is built to be attended: every result is
// appended and flushed immediately, `--checkpoint-every` exits cleanly on a round
// number, and re-running resumes from whatever is already on disk.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import {
  EVIDENCE_USE_RUBRIC_CLAUSES,
  TUTOR_STUB_EVIDENCE_USE_RUBRICS,
} from '../services/tutorStubPublicLearnerAnalysis.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_ARCHIVE = path.join(os.homedir(), '.machinespirits-data', 'program-2');
const DEFAULT_OUT = 'exports/evidence-use-v2-relabel/relabel.jsonl';
const CLASSIFIER_ROLE = 'tutor_stub_learner_analysis';

// The v1 clause is a single line and the v2 clause is five, both taken from the
// service so this tool cannot drift from the rubric it claims to apply.
const V1_CLAUSE = EVIDENCE_USE_RUBRIC_CLAUSES[TUTOR_STUB_EVIDENCE_USE_RUBRICS.V1].join('\n');
const V2_CLAUSE = EVIDENCE_USE_RUBRIC_CLAUSES[TUTOR_STUB_EVIDENCE_USE_RUBRICS.V2_BRIDGE_VOICED].join('\n');

// warrant_skip fires on these two, so they define the gate-relevant partition.
// Kept in step with services/tutorStubPointOfActionCoaching.js.
const GATE_LABELS = new Set(['omits_warrant', 'overleaps_evidence']);

// Categorical classification fields the edit does not touch. Their disagreement
// rate under replay is the re-draw noise floor.
const CONTROL_FIELDS = ['agency', 'discourse_move', 'epistemic_stance', 'request_type'];

function expandHome(value) {
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return value;
}

function parseArgs(argv) {
  const options = {
    archive: process.env.PROGRAM_2_ARCHIVE_DIR || DEFAULT_ARCHIVE,
    out: DEFAULT_OUT,
    limit: 0,
    checkpointEvery: 100,
    concurrency: 2,
    stratify: 0,
    sample: 0,
    seed: 1,
    plan: false,
    report: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${argument} requires a value`);
      index += 1;
      return value;
    };
    if (argument === '--archive') options.archive = expandHome(next());
    else if (argument === '--out') options.out = next();
    else if (argument === '--limit') options.limit = Number.parseInt(next(), 10);
    else if (argument === '--checkpoint-every') options.checkpointEvery = Number.parseInt(next(), 10);
    else if (argument === '--concurrency') options.concurrency = Number.parseInt(next(), 10);
    else if (argument === '--stratify') options.stratify = Number.parseInt(next(), 10);
    else if (argument === '--sample') options.sample = Number.parseInt(next(), 10);
    else if (argument === '--seed') options.seed = Number.parseInt(next(), 10);
    else if (argument === '--plan') options.plan = true;
    else if (argument === '--report') options.report = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  for (const key of ['limit', 'checkpointEvery', 'concurrency', 'stratify', 'sample', 'seed']) {
    if (!Number.isFinite(options[key]) || options[key] < 0) throw new Error(`--${key} must be a non-negative integer`);
  }
  if (options.concurrency < 1) options.concurrency = 1;
  // Two selectors with opposite intents would silently compose into a third.
  if (options.stratify && options.sample) {
    throw new Error(
      '--stratify and --sample are mutually exclusive: one balances the rare labels, the other stands for the archive',
    );
  }
  return options;
}

function* jsonlFiles(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* jsonlFiles(full);
    else if (entry.name.endsWith('.jsonl')) yield full;
  }
}

// A phase is the archive's top-level directory (phase5-live-pilot, phase5b-live,
// ...) and the cell is the directory under traces/. Both come from the path
// because the records themselves do not carry them.
function provenanceFromPath(archive, file) {
  const parts = path.relative(archive, file).split(path.sep);
  return { phase: parts[0] ?? 'unknown', cell: parts.length >= 3 ? parts[parts.length - 2] : 'unknown' };
}

function readStoredLabel(record) {
  try {
    return JSON.parse(record.response.text)?.classification?.turn ?? null;
  } catch {
    return null;
  }
}

function collectRecords(archive) {
  const records = [];
  const skipped = { unparsedStoredResponse: 0 };
  for (const file of jsonlFiles(archive)) {
    const relative = path.relative(archive, file);
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        continue;
      }
      if (record.type !== 'model_call' || record.role !== CLASSIFIER_ROLE) continue;
      const storedTurn = readStoredLabel(record);
      if (!storedTurn) {
        skipped.unparsedStoredResponse += 1;
        continue;
      }
      const { phase, cell } = provenanceFromPath(archive, file);
      records.push({
        key: `${relative}#${record.seq}`,
        source: relative,
        seq: record.seq,
        phase,
        cell,
        runId: record.runId ?? null,
        turnId: record.turnId ?? null,
        turn: record.turn ?? null,
        provider: record.provider,
        model: record.model,
        request: record.request,
        storedTurn,
      });
    }
  }
  return { records, skipped };
}

// The whole safety claim of the tool: the line being replaced is present exactly
// once, so the substitution cannot silently hit the wrong text, miss, or fire
// twice. A record that fails this is refused rather than relabelled.
export function substituteEvidenceUseClause(prompt) {
  const text = String(prompt ?? '');
  const occurrences = text.split(V1_CLAUSE).length - 1;
  if (occurrences !== 1) {
    return { ok: false, reason: `expected exactly one v1 precedence clause, found ${occurrences}`, prompt: null };
  }
  return { ok: true, reason: null, prompt: text.replace(V1_CLAUSE, V2_CLAUSE) };
}

function loadDone(outFile) {
  const done = new Map();
  if (!fs.existsSync(outFile)) return done;
  for (const line of fs.readFileSync(outFile, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row.key) done.set(row.key, row);
    } catch {
      // A truncated final line is what a kill mid-append looks like; drop it and
      // let the record be re-issued rather than treating it as complete.
    }
  }
  return done;
}

// Deterministic so a stratified slice can be reproduced and extended.
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Balanced across (phase, stored evidence_use label), because a slice drawn in
// file order would be one phase and a slice drawn uniformly would be mostly the
// three commonest labels.
function stratifiedSlice(records, count, seed) {
  const random = mulberry32(seed);
  const strata = new Map();
  for (const record of records) {
    const key = `${record.phase}|${record.storedTurn.evidence_use}`;
    if (!strata.has(key)) strata.set(key, []);
    strata.get(key).push(record);
  }
  const shuffled = [...strata.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, group]) => group.sort((a, b) => a.key.localeCompare(b.key)).sort(() => random() - 0.5));
  const picked = [];
  let cursor = 0;
  while (picked.length < count) {
    let addedThisPass = false;
    for (const group of shuffled) {
      if (picked.length >= count) break;
      if (cursor < group.length) {
        picked.push(group[cursor]);
        addedThisPass = true;
      }
    }
    if (!addedThisPass) break;
    cursor += 1;
  }
  return picked;
}

// The other selector, and the one to use when the output has to stand for the
// archive. `--limit` takes records in directory order, which is one phase and
// its earliest dialogues; `--stratify` balances the rare labels on purpose. Both
// are the wrong shape for estimating a rate, because the estimate inherits the
// selector's bias and no amount of sampling removes it.
//
// Fisher-Yates over a name-sorted list, not `sort(() => random() - 0.5)`: a
// comparator that ignores its arguments is not a shuffle. It biases toward the
// input order and the result depends on the engine's sort algorithm, so it would
// neither be uniform nor reproducible across Node versions.
export function uniformSample(records, count, seed) {
  const pool = [...records].sort((a, b) => a.key.localeCompare(b.key));
  if (count >= pool.length) return pool;
  const random = mulberry32(seed);
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  // Re-sort the drawn subset so the sweep still runs in a stable order and a
  // resumed run picks up where it left off.
  return pool.slice(0, count).sort((a, b) => a.key.localeCompare(b.key));
}

function tally(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

function formatPercent(numerator, denominator) {
  if (!denominator) return 'n/a';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function printReport(rows) {
  const graded = rows.filter((row) => row.ok && row.v2?.evidence_use);
  console.log(`\nrelabelled: ${graded.length} of ${rows.length} rows on disk`);
  if (!graded.length) return;

  console.log('\nevidence_use migration (stored v1 -> replayed v2):');
  const matrix = new Map();
  for (const row of graded) {
    const key = `${row.v1.evidence_use} -> ${row.v2.evidence_use}`;
    matrix.set(key, (matrix.get(key) || 0) + 1);
  }
  for (const [key, count] of [...matrix.entries()].sort((a, b) => b[1] - a[1])) {
    const [from] = key.split(' -> ');
    const fromTotal = graded.filter((row) => row.v1.evidence_use === from).length;
    console.log(`  ${key.padEnd(56)} ${String(count).padStart(5)}  (${formatPercent(count, fromTotal)} of ${from})`);
  }

  const changed = graded.filter((row) => row.v1.evidence_use !== row.v2.evidence_use).length;
  console.log(`\nevidence_use changed: ${changed}/${graded.length} (${formatPercent(changed, graded.length)})`);

  // The noise floor. Same model, same prompt except one clause these fields do
  // not mention, so whatever moves here moves for reasons other than the edit.
  console.log('\nre-draw noise floor on fields the edit does not touch:');
  let noiseDiffer = 0;
  let noiseTotal = 0;
  for (const field of CONTROL_FIELDS) {
    const comparable = graded.filter((row) => row.v1[field] !== undefined && row.v2[field] !== undefined);
    const differ = comparable.filter((row) => row.v1[field] !== row.v2[field]).length;
    noiseDiffer += differ;
    noiseTotal += comparable.length;
    console.log(
      `  ${field.padEnd(20)} ${String(differ).padStart(5)}/${String(comparable.length).padEnd(5)} differ  (${formatPercent(differ, comparable.length)})`,
    );
  }
  console.log(
    `  ${'pooled'.padEnd(20)} ${String(noiseDiffer).padStart(5)}/${String(noiseTotal).padEnd(5)} differ  (${formatPercent(noiseDiffer, noiseTotal)})`,
  );
  // Field stability varies (request_type is far less stable than agency), so a
  // sibling rate is an approximation of evidence_use's own floor, not a substitute
  // for it. evidence_use's same-rubric self-reproducibility was measured separately
  // at 84.9%, i.e. a ~15% floor; read the migration rate against that.
  console.log('  reference: evidence_use same-rubric self-reproducibility was measured at 84.9% (a ~15% floor).');
  console.log('  a single draw per record therefore cannot separate rubric effect from sampler variance turn by turn.');

  // The quantity that actually reaches the tutor: warrant_skip fires on the pair,
  // so a turn that moves omits_warrant -> overleaps_evidence still triggers.
  const firedV1 = graded.filter((row) => GATE_LABELS.has(row.v1.evidence_use));
  const firedV2 = graded.filter((row) => GATE_LABELS.has(row.v2.evidence_use));
  const stayed = firedV1.filter((row) => GATE_LABELS.has(row.v2.evidence_use)).length;
  console.log('\nwarrant_skip gate (fires on omits_warrant OR overleaps_evidence):');
  console.log(
    `  fired under v1 labels: ${firedV1.length}/${graded.length} (${formatPercent(firedV1.length, graded.length)})`,
  );
  console.log(
    `  fired under v2 labels: ${firedV2.length}/${graded.length} (${formatPercent(firedV2.length, graded.length)})`,
  );
  console.log(
    `  fired under both:      ${stayed}/${firedV1.length} (${formatPercent(stayed, firedV1.length)} of v1 firings retained)`,
  );
  console.log(
    '  note: a v1 gate turn that moves omits_warrant -> overleaps_evidence still fires, so the label-level change overstates the gate-level change.',
  );

  const failures = rows.filter((row) => !row.ok);
  if (failures.length) {
    console.log(`\nrefused or failed: ${failures.length}`);
    for (const [reason, count] of tally(failures.map((row) => row.reason || 'unknown'))) {
      console.log(`  ${String(count).padStart(5)}  ${reason}`);
    }
  }
}

async function relabelOne(record) {
  const substitution = substituteEvidenceUseClause(record.request.prompt);
  if (!substitution.ok) {
    return { ok: false, reason: substitution.reason };
  }
  const startedAt = Date.now();
  const result = await callAIWithCliBridge(
    { provider: record.provider, model: record.model },
    record.request.systemPrompt,
    substitution.prompt,
    CLASSIFIER_ROLE,
    {
      messageHistory: Array.isArray(record.request.messageHistory) ? record.request.messageHistory : [],
      effort: record.request.cliEffort ?? null,
    },
  );
  let v2Turn = null;
  let parseError = null;
  try {
    v2Turn = JSON.parse(result.text)?.classification?.turn ?? null;
  } catch (error) {
    parseError = error.message;
  }
  if (!v2Turn) return { ok: false, reason: `unparsed v2 response${parseError ? `: ${parseError}` : ''}` };
  return {
    ok: true,
    v2: v2Turn,
    latencyMs: result.latencyMs ?? Date.now() - startedAt,
    usage: {
      inputTokens: result.inputTokens || 0,
      outputTokens: result.outputTokens || 0,
      cost: result.cost || 0,
    },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outFile = path.isAbsolute(options.out) ? options.out : path.join(ROOT, options.out);

  if (options.report) {
    const rows = [...loadDone(outFile).values()];
    if (!rows.length) {
      console.log(`No relabel rows at ${path.relative(ROOT, outFile)} yet.`);
      return;
    }
    printReport(rows);
    return;
  }

  const { records, skipped } = collectRecords(options.archive);
  if (!records.length) {
    console.log(`No classifier calls found under ${options.archive}.`);
    return;
  }

  // Prove the substitution across the whole archive before issuing anything, so a
  // drifted prompt is a plan-time failure rather than a discovery 400 calls in.
  const unsubstitutable = records.filter((record) => !substituteEvidenceUseClause(record.request.prompt).ok);
  const done = loadDone(outFile);
  let pending = records.filter((record) => !done.has(record.key));
  if (options.stratify) pending = stratifiedSlice(pending, options.stratify, options.seed);
  if (options.sample) pending = uniformSample(pending, options.sample, options.seed);
  if (options.limit) pending = pending.slice(0, options.limit);

  console.log(`archive:        ${options.archive}`);
  console.log(
    `classifier calls: ${records.length} (${skipped.unparsedStoredResponse} skipped: stored response unparsed)`,
  );
  console.log(
    `models:         ${[...new Set(records.map((record) => `${record.provider}/${record.model}`))].join(', ')}`,
  );
  console.log(
    `substitution:   ${records.length - unsubstitutable.length}/${records.length} records carry exactly one v1 clause`,
  );
  if (unsubstitutable.length) {
    console.log(`  REFUSED (prompt drift): ${unsubstitutable.length} — these will not be relabelled`);
  }
  console.log(`already done:   ${done.size}`);
  const selector = options.stratify
    ? ` (stratified, seed ${options.seed})`
    : options.sample
      ? ` (uniform sample, seed ${options.seed})`
      : '';
  console.log(`this run:       ${pending.length}${selector}`);
  console.log(
    `stored v1 labels: ${tally(records.map((record) => record.storedTurn.evidence_use))
      .map(([label, count]) => `${label}=${count}`)
      .join(' ')}`,
  );

  if (options.plan) {
    console.log('\n--plan: no calls issued.');
    return;
  }
  if (!pending.length) {
    console.log('\nNothing pending.');
    printReport([...done.values()]);
    return;
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const handle = fs.openSync(outFile, 'a');
  const checkpoint = options.checkpointEvery || pending.length;
  const batch = pending.slice(0, checkpoint);
  console.log(
    `\nissuing ${batch.length} call(s) at concurrency ${options.concurrency}; append target ${path.relative(ROOT, outFile)}\n`,
  );

  let completed = 0;
  let failed = 0;
  const startedAt = Date.now();
  const queue = [...batch];
  const worker = async () => {
    while (queue.length) {
      const record = queue.shift();
      if (!record) break;
      let outcome;
      try {
        outcome = await relabelOne(record);
      } catch (error) {
        outcome = { ok: false, reason: `bridge error: ${error.message}` };
      }
      const row = {
        key: record.key,
        source: record.source,
        seq: record.seq,
        phase: record.phase,
        cell: record.cell,
        runId: record.runId,
        turnId: record.turnId,
        turn: record.turn,
        provider: record.provider,
        model: record.model,
        rubricFrom: TUTOR_STUB_EVIDENCE_USE_RUBRICS.V1,
        rubricTo: TUTOR_STUB_EVIDENCE_USE_RUBRICS.V2_BRIDGE_VOICED,
        v1: record.storedTurn,
        ...outcome,
      };
      // Flush per row: a kill loses at most the row in flight.
      fs.writeSync(handle, `${JSON.stringify(row)}\n`);
      fs.fsyncSync(handle);
      completed += 1;
      if (!outcome.ok) failed += 1;
      const moved = outcome.ok && record.storedTurn.evidence_use !== outcome.v2.evidence_use;
      const elapsed = (Date.now() - startedAt) / 1000;
      console.log(
        `[${String(completed).padStart(4)}/${batch.length}] ${record.phase}/${record.cell} t${record.turn} ` +
          `${record.storedTurn.evidence_use} -> ${outcome.ok ? outcome.v2.evidence_use : 'FAILED'}` +
          `${moved ? ' *' : ''} ${outcome.ok ? `${outcome.latencyMs}ms` : outcome.reason} ` +
          `| ${(elapsed / completed).toFixed(1)}s/call avg`,
      );
    }
  };
  await Promise.all(Array.from({ length: Math.min(options.concurrency, batch.length) }, worker));
  fs.closeSync(handle);

  const elapsed = (Date.now() - startedAt) / 1000;
  const perCall = elapsed / Math.max(1, completed);
  console.log(
    `\ncheckpoint: ${completed} issued (${failed} failed) in ${elapsed.toFixed(0)}s, ${perCall.toFixed(1)}s/call`,
  );
  // Re-read from disk rather than trusting the in-memory tally, so the remaining
  // count reflects what a resumed run would actually see.
  const stillPending = records.length - unsubstitutable.length - loadDone(outFile).size;
  if (stillPending > 0) {
    const minutes = Math.ceil((stillPending * perCall) / 60 / options.concurrency);
    console.log(
      `${stillPending} record(s) still pending. Re-run the same command to continue; ` +
        `at ${perCall.toFixed(1)}s/call that is roughly ${minutes} more minute(s) of wall clock at concurrency ${options.concurrency}.`,
    );
  } else {
    console.log('All substitutable records relabelled.');
  }
  printReport([...loadDone(outFile).values()]);
}

// Guarded so tests can import substituteEvidenceUseClause to prove the
// substitution identity without the module issuing any calls on load.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
