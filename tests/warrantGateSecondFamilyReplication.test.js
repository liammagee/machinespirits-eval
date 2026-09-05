import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ADAPTIVE_WARRANT_ANNOTATION_BATCH_RESPONSE_SCHEMA,
  prepareAdaptiveWarrantAnnotationBatches,
} from '../scripts/prepare-adaptive-warrant-annotation-batches.js';
import { ADAPTIVE_WARRANT_ANNOTATION_SCHEMA } from '../scripts/run-adaptive-warrant-baseline-study.js';
import {
  OUTCOME_STUDY_FIRST_BLOCK_SEATS,
  buildOutcomePilotJobs,
} from '../scripts/run-adaptive-warrant-outcome-pilot.js';
import {
  SECOND_FAMILY_CEILING,
  SECOND_FAMILY_SEATS,
  SECOND_FAMILY_STUDY_ID,
  buildSecondFamilyJobs,
  describeSecondFamilyArming,
  describeSecondFamilyBlockCounts,
  describeSecondFamilyPlan,
  inheritCheckpoint,
  judgeSecondFamilyReplication,
  loadSecondFamilyManifest,
  runSecondFamilyGeneration,
  runSecondFamilyReaders,
  summarizeSecondFamilyReportOnly,
} from '../scripts/run-warrant-gate-second-family-replication.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LAUNCHER = path.join(ROOT, 'scripts', 'run-warrant-gate-second-family-replication.js');

function tmpDir(t, label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `second-family-${label}-`));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function runLauncher(args) {
  return spawnSync(process.execPath, [LAUNCHER, ...args], { cwd: ROOT, encoding: 'utf8' });
}

// ---------------------------------------------------------------------------
// Plan and registration
// ---------------------------------------------------------------------------

test('the registered manifest describes 72 dialogues, 576 cases and 1,152 reads under ceiling 3,360', () => {
  const { manifest } = loadSecondFamilyManifest();
  const plan = describeSecondFamilyPlan(manifest);
  assert.equal(plan.study_id, SECOND_FAMILY_STUDY_ID);
  assert.equal(plan.dialogues, 72);
  assert.deepEqual(plan.dialogues_per_condition, { bare: 24, gated: 24, standing_permission: 24 });
  assert.equal(plan.dialogues_per_seed, 6);
  assert.deepEqual(
    plan.seeds,
    Array.from({ length: 12 }, (_, index) => 737 + index),
  );
  assert.equal(plan.turns_per_dialogue, 8);
  assert.equal(plan.learner_profile, 'low_agency');
  assert.equal(plan.cases, 576);
  assert.equal(plan.reader_calls_planned, 1152);
  assert.equal(plan.reader_failed_attempt_allowance, 48);
  assert.equal(plan.reader_attempt_cap, 1200);
  assert.equal(plan.generation_cap, 2160);
  assert.equal(plan.ceiling, SECOND_FAMILY_CEILING);
  assert.deepEqual(plan.seats, SECOND_FAMILY_SEATS);
  assert.equal(plan.zero_model_calls, true);
  for (const world of manifest.worlds) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, world.path))), world.sha256, `${world.id} sha`);
  }
  assert.equal(
    sha256(fs.readFileSync(path.join(ROOT, manifest.annotation_handbook.path))),
    manifest.annotation_handbook.sha256,
  );
});

test('the default invocation and --dry-run print the plan, spawn nothing and make zero model calls', () => {
  const plain = runLauncher([]);
  assert.equal(plain.status, 0, plain.stderr);
  assert.match(plain.stdout, /Model calls made by this invocation: 0/u);
  assert.match(plain.stdout, /Dialogues: 72 \(bare 24, gated 24, standing_permission 24\)/u);
  assert.doesNotMatch(plain.stdout, /Dry-run jobs/u);

  const dry = runLauncher(['--dry-run', '--out', '/nonexistent/second-family-dry']);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /Dry-run jobs: 72/u);
  assert.match(
    dry.stdout,
    /--model claude-code\.opus-5 --analysis-model codex\.gpt-5\.6-luna --auto-learner-model claude-code\.opus-5/u,
  );
  assert.match(dry.stdout, /--dry-run$/mu);
  assert.equal(fs.existsSync('/nonexistent/second-family-dry'), false);
});

test('the CLI refuses a ceiling above the registered one and a paid launch without a GO from chat, before any admission', (t) => {
  const stateRoot = tmpDir(t, 'state');
  const high = runLauncher(['--ceiling', '5000', '--study-state-root', stateRoot]);
  assert.equal(high.status, 1);
  assert.match(high.stderr, /exceeds the registered ceiling 3360/u);

  const missing = runLauncher(['--accept-charges', '--study-state-root', stateRoot]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /--go is required with --accept-charges/u);
  assert.deepEqual(fs.readdirSync(stateRoot), []);

  const out = path.join(tmpDir(t, 'out'), 'run');
  const wrongWord = runLauncher([
    '--accept-charges',
    '--go',
    'Go ahead',
    '--out',
    out,
    '--study-state-root',
    stateRoot,
  ]);
  assert.equal(wrongWord.status, 1);
  assert.match(wrongWord.stderr, /must start with the word GO/u);
  assert.equal(fs.existsSync(out), false);
  assert.deepEqual(fs.readdirSync(stateRoot), []);
});

// ---------------------------------------------------------------------------
// Seats
// ---------------------------------------------------------------------------

test('second-family jobs carry the Opus seats while the first-block builder keeps Luna by default', () => {
  const { manifest } = loadSecondFamilyManifest();
  const jobs = buildSecondFamilyJobs({ manifest, rootDir: '/tmp/second-family-seats' });
  assert.equal(jobs.length, 72);
  const first = jobs[0].command.join(' ');
  assert.match(first, /--model claude-code\.opus-5 /u);
  assert.match(first, /--analysis-model codex\.gpt-5\.6-luna /u);
  assert.match(first, /--auto-learner-model claude-code\.opus-5 /u);
  assert.match(first, /--model-call-budget 30 /u);
  assert.match(first, /--auto-learner-profile-id low_agency /u);
  assert.deepEqual([...new Set(jobs.map((job) => job.condition))].sort(), ['bare', 'gated', 'standing_permission']);
  assert.deepEqual(
    jobs.slice(0, 3).map((job) => [job.seed, job.condition]),
    manifest.interleaved_condition_assignment.slice(0, 3).map((row) => [row.seed, row.condition]),
  );

  const luna = buildOutcomePilotJobs({
    manifest: {
      ...manifest,
      worlds: manifest.worlds.map((world) => ({ ...world, path: path.join(ROOT, world.path) })),
    },
    rootDir: '/tmp/second-family-seats-luna',
    studyLabel: 'first-block',
  });
  const lunaCommand = luna[0].command.join(' ');
  assert.equal(OUTCOME_STUDY_FIRST_BLOCK_SEATS.tutor, 'codex.gpt-5.6-luna');
  assert.match(lunaCommand, /--model codex\.gpt-5\.6-luna /u);
  assert.match(lunaCommand, /--auto-learner-model codex\.gpt-5\.6-luna /u);
  assert.doesNotMatch(lunaCommand, /opus/u);
});

// ---------------------------------------------------------------------------
// Generation loop
// ---------------------------------------------------------------------------

function fakeAdmission() {
  const events = [];
  let sequence = 0;
  return {
    events,
    allocateModelAttemptCapacity(count, detail) {
      events.push({ type: 'capacity_allocated', count, ...detail });
      return { id: `capacity-${++sequence}`, count };
    },
    attemptLedgerEnvironment({ unitId, capacity, maximumTurn }) {
      return {
        TUTOR_STUB_SHARED_ATTEMPT_LEDGER: JSON.stringify({
          unitId,
          capacityId: capacity.id,
          capacityLimit: capacity.count,
          maximumTurn,
        }),
      };
    },
    releaseModelAttemptCapacity(capacity, detail) {
      events.push({ type: 'capacity_released', capacity_id: capacity.id, ...detail });
    },
    record(event) {
      events.push(event);
    },
  };
}

function okRow(tracePath) {
  return {
    childStatus: 'ok',
    childEvidence: { ok: true, status: 'complete' },
    learnerAnalysisCoverage: 1,
    learnerAnalysisUnanalyzedTurns: [],
    tracePath,
    turnCount: 8,
  };
}

test('generation hands each child the study ledger through its environment, records complete rows and stops at the first quarantined dialogue', async (t) => {
  const root = tmpDir(t, 'generation');
  const { manifest } = loadSecondFamilyManifest();
  const jobs = buildSecondFamilyJobs({ manifest, rootDir: root }).slice(0, 3);
  const admission = fakeAdmission();
  const checkpoint = { dialogues: [] };
  const seenEnv = [];
  let persisted = 0;
  const runDialogue = async (command, { env, logPath }) => {
    seenEnv.push(JSON.parse(env.TUTOR_STUB_SHARED_ATTEMPT_LEDGER));
    assert.ok(logPath.endsWith('.log'));
    const jobId = path.basename(command[command.indexOf('--parent-run-id') - 1]);
    const tracePath = path.join(root, 'traces', `${jobId}.jsonl`);
    fs.mkdirSync(path.dirname(tracePath), { recursive: true });
    const reservedLines = jobId.endsWith('-gated') ? 12 : 9;
    fs.writeFileSync(
      tracePath,
      Array.from({ length: reservedLines }, (_, index) =>
        JSON.stringify({ type: 'model_call_budget_reserved', turn: index }),
      ).join('\n') + '\n',
    );
    return { status: jobId.endsWith('-standing_permission') ? 1 : 0, signal: null, error: null, logPath };
  };
  const collectJobResult = (job, processResult) => {
    const tracePath = path.join(root, 'traces', `${job.id}.jsonl`);
    if (processResult.status !== 0) return { childStatus: 'failed', error: 'child exit 1', tracePath, turnCount: 3 };
    return okRow(tracePath);
  };

  await assert.rejects(
    runSecondFamilyGeneration({
      jobs,
      checkpoint,
      admission,
      persist: () => (persisted += 1),
      runDialogue,
      collectJobResult,
    }),
    (error) => error.code === 'dialogue_quarantined' && error.recoveryPermitted === true,
  );

  assert.equal(seenEnv.length, 3);
  assert.deepEqual(
    seenEnv.map((row) => [row.capacityLimit, row.maximumTurn]),
    [
      [30, 8],
      [30, 8],
      [30, 8],
    ],
  );
  assert.deepEqual(
    seenEnv.map((row) => row.unitId),
    jobs.map((job) => job.id),
  );
  assert.deepEqual(
    checkpoint.dialogues.map((row) => [row.condition, row.status, row.reserved_calls]),
    [
      ['bare', 'complete', 9],
      ['gated', 'complete', 12],
      ['standing_permission', 'quarantined', 9],
    ],
  );
  assert.equal(checkpoint.dialogues[2].error, 'child exit 1');
  assert.equal(persisted, 3);
  const allocated = admission.events.filter((event) => event.type === 'capacity_allocated');
  const released = admission.events.filter((event) => event.type === 'capacity_released');
  assert.equal(allocated.length, 3);
  assert.equal(released.length, 3);
  assert.deepEqual(
    released.map((event) => event.reserved_calls),
    [9, 12, 9],
  );
  assert.deepEqual(
    admission.events.filter((event) => event.type?.startsWith('dialogue_')).map((event) => event.type),
    [
      'dialogue_dispatched',
      'dialogue_complete',
      'dialogue_dispatched',
      'dialogue_complete',
      'dialogue_dispatched',
      'dialogue_quarantined',
    ],
  );

  // A recovery pass skips the two complete dialogues and re-takes only the quarantined one, disclosed as a re-take.
  const retakeRuns = [];
  const retakeDialogue = async (command, options) => {
    retakeRuns.push(command);
    const result = await runDialogue(command, options);
    return { ...result, status: 0 };
  };
  const retakeCollect = (job) => okRow(path.join(root, 'traces', `${job.id}.jsonl`));
  await runSecondFamilyGeneration({
    jobs,
    checkpoint,
    admission,
    persist: () => {},
    runDialogue: retakeDialogue,
    collectJobResult: retakeCollect,
  });
  assert.equal(retakeRuns.length, 1);
  const retake = checkpoint.dialogues.at(-1);
  assert.equal(retake.condition, 'standing_permission');
  assert.equal(retake.status, 'complete');
  assert.equal(retake.retake_of_quarantined_attempts, 1);
  assert.equal(checkpoint.dialogues.filter((row) => row.status === 'complete').length, 3);
});

test('a dialogue past its one registered retake is dropped at recovery, the block continues, and every downstream count follows the completed dialogues', async (t) => {
  const root = tmpDir(t, 'drop');
  const { manifest } = loadSecondFamilyManifest();
  const jobs = buildSecondFamilyJobs({ manifest, rootDir: root }).slice(0, 4);
  const admission = fakeAdmission();
  const lost = jobs[1];
  const quarantinedRow = (retakes) => ({
    id: lost.id,
    order: lost.ordinal,
    world: lost.world,
    seed: lost.seed,
    condition: lost.condition,
    status: 'quarantined',
    retake_of_quarantined_attempts: retakes,
    reserved_calls: 30,
    error: 'child seal status incomplete does not match complete',
  });
  // The original attempt and its one retake both failed; the user ruled "drop and continue".
  const checkpoint = { dialogues: [quarantinedRow(0), quarantinedRow(1)] };
  const ran = [];
  const runDialogue = async (command) => {
    const jobId = path.basename(command[command.indexOf('--parent-run-id') - 1]);
    ran.push(jobId);
    const tracePath = path.join(root, 'traces', `${jobId}.jsonl`);
    fs.mkdirSync(path.dirname(tracePath), { recursive: true });
    fs.writeFileSync(tracePath, JSON.stringify({ type: 'model_call_budget_reserved', turn: 0 }) + '\n');
    return { status: 0, signal: null, error: null, logPath: null };
  };
  const collectJobResult = (job) => okRow(path.join(root, 'traces', `${job.id}.jsonl`));
  const logged = [];
  await runSecondFamilyGeneration({
    jobs,
    checkpoint,
    admission,
    persist: () => {},
    runDialogue,
    collectJobResult,
    log: (line) => logged.push(line),
  });

  // Never a third paid attempt: the lost dialogue was not dispatched and no capacity was allocated for it.
  assert.deepEqual(
    ran,
    jobs.filter((job) => job.id !== lost.id).map((job) => job.id),
  );
  assert.equal(
    admission.events.filter((event) => event.type === 'capacity_allocated' && event.unit_id === lost.id).length,
    0,
  );
  const dropped = checkpoint.dialogues.filter((row) => row.status === 'dropped');
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0].id, lost.id);
  assert.equal(dropped[0].attempts, 2);
  assert.equal(dropped[0].retakes_permitted, 1);
  assert.equal(dropped[0].reserved_calls, 0);
  assert.deepEqual(
    admission.events.filter((event) => event.type === 'dialogue_dropped').map((event) => event.dialogue_id),
    [lost.id],
  );
  assert.ok(logged.some((line) => line.includes(`${lost.id} dropped after 2 attempts`)));
  assert.equal(checkpoint.dialogues.filter((row) => row.status === 'complete').length, 3);

  // A second recovery pass skips the dropped dialogue again without a new row.
  await runSecondFamilyGeneration({ jobs, checkpoint, admission, persist: () => {}, runDialogue, collectJobResult });
  assert.equal(checkpoint.dialogues.filter((row) => row.status === 'dropped').length, 1);
  assert.equal(ran.length, 3);

  // Downstream counts derive from the completed dialogues, never from the registered 72.
  const counts = describeSecondFamilyBlockCounts({ manifest, dialogues: checkpoint.dialogues });
  assert.equal(counts.registered_dialogues, 72);
  assert.equal(counts.completed, 3);
  assert.deepEqual(
    counts.dropped.map((row) => [row.id, row.condition, row.attempts]),
    [[lost.id, lost.condition, 2]],
  );
  assert.equal(counts.cases, 3 * manifest.assignment.turns_per_dialogue);
  assert.equal(counts.reads, counts.cases * manifest.channels.decision.readers.length);
  assert.equal(counts.reader_attempt_cap, counts.reads + manifest.channels.decision.failed_attempt_allowance);

  // The live block: 71 complete and 53 dropped gives 568 cases and 1,136 reads under the registered 1,152.
  const live = describeSecondFamilyBlockCounts({
    manifest,
    dialogues: [
      ...Array.from({ length: 71 }, (_, index) => ({ id: `d${index}`, status: 'complete' })),
      { id: 'second-family-53', order: 53, condition: 'gated', status: 'dropped', attempts: 2 },
    ],
  });
  assert.deepEqual([live.completed, live.cases, live.reads, live.reader_attempt_cap], [71, 568, 1136, 1184]);
  assert.ok(live.reads <= manifest.channels.decision.planned_calls);
});

test('recovery recomputes seed freshness and the preflight after an amendment, and refuses to reuse a dialogue completed under other seats', (t) => {
  const { manifest } = loadSecondFamilyManifest();
  const previousDestination = tmpDir(t, 'predecessor');
  const oldSeats = { ...SECOND_FAMILY_SEATS, analysis: 'claude-code.opus-5' };
  const oldSeeds = [736, ...manifest.seeds.slice(0, -1)];
  const quarantined = {
    id: 'second-family-01-world_101_kestrel_signal_lamp-s736-bare',
    order: 1,
    seed: 736,
    condition: 'bare',
    status: 'quarantined',
  };
  const fresh = {
    schema: 'machinespirits.adaptation-refinement.warrant-outcome-second-family-run.v1',
    study_id: SECOND_FAMILY_STUDY_ID,
    seats: { ...SECOND_FAMILY_SEATS },
    recovered_from: null,
    seed_freshness: null,
    prompt_preflight: null,
    dialogues: [],
    corpus: null,
    reader_collection: null,
    reader_run: null,
  };
  const base = {
    schema: fresh.schema,
    study_id: SECOND_FAMILY_STUDY_ID,
    seats: oldSeats,
    seed_freshness: { status: 'passed', seeds: oldSeeds },
    prompt_preflight: { path: '/old/prompt-preflight.json', status: 'written' },
    corpus: null,
    reader_collection: null,
    reader_run: null,
    stop: { code: 'dialogue_quarantined', recovery_permitted: true },
  };

  // Seeds and analysis seat changed; only quarantined rows in the predecessor.
  writeJson(path.join(previousDestination, 'checkpoint.json'), { ...base, dialogues: [quarantined] });
  const inherited = inheritCheckpoint({ previousDestination, fresh, manifest });
  assert.equal(inherited.seed_freshness, null);
  assert.equal(inherited.prompt_preflight, null);
  assert.deepEqual(inherited.dialogues, [quarantined]);
  assert.deepEqual(inherited.recovered_from.inherited, {
    seed_freshness: false,
    prompt_preflight: false,
    previous_seeds: oldSeeds,
    previous_seats: oldSeats,
  });
  assert.deepEqual(inherited.recovered_from.lineage, [previousDestination]);

  // Same seeds and seats: both records carry over.
  writeJson(path.join(previousDestination, 'checkpoint.json'), {
    ...base,
    seats: { ...SECOND_FAMILY_SEATS },
    seed_freshness: { status: 'passed', seeds: [...manifest.seeds] },
    dialogues: [],
  });
  const same = inheritCheckpoint({ previousDestination, fresh, manifest });
  assert.equal(same.seed_freshness.status, 'passed');
  assert.equal(same.prompt_preflight.path, '/old/prompt-preflight.json');
  assert.equal(same.recovered_from.inherited.seed_freshness, true);
  assert.equal(same.recovered_from.inherited.prompt_preflight, true);

  // A dialogue completed under the old analysis seat is never continued from.
  writeJson(path.join(previousDestination, 'checkpoint.json'), {
    ...base,
    dialogues: [{ ...quarantined, status: 'complete' }],
  });
  assert.throws(
    () => inheritCheckpoint({ previousDestination, fresh, manifest }),
    /completed 1 dialogue\(s\) under different generation seats/u,
  );
});

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

function corpusFixture(count) {
  return {
    schema: ADAPTIVE_WARRANT_ANNOTATION_SCHEMA,
    study_id: SECOND_FAMILY_STUDY_ID,
    blinded: true,
    cases: Array.from({ length: count }, (_, index) => ({
      sample_id: `sf-${String(index + 1).padStart(3, '0')}`,
      current_learner_turn: { turn: index + 1, text: `public learner evidence ${index + 1}` },
      normative_action_contract: null,
    })),
  };
}

function completedCase() {
  return {
    speech_act: 'other',
    open_obligation_source_turns: [],
    obligation_state: 'none',
    inquiry_state: 'incomplete',
    commitment_transition_warranted: 'no',
    current_candidate_override_required: 'no',
    primary_warrant_basis: 'none',
    recommended_action_family: 'hold',
    note: 'The public decision-time evidence supports holding this commitment.',
    divergence_by_dimension: Object.fromEntries(
      ['conceptual', 'interactional', 'engagement', 'pacing', 'epistemic', 'strategy_exhaustion'].map((dimension) => [
        dimension,
        {
          interpretation: 'aligned',
          magnitude: 'none',
          persistence: 'none',
          note: `The public ${dimension} evidence remains aligned with its norm.`,
        },
      ]),
    ),
  };
}

function fakeBudget() {
  const log = [];
  return {
    log,
    reserve(detail) {
      const entry = { detail, state: 'reserved' };
      log.push(entry);
      return {
        markDispatched() {
          entry.state = 'dispatched';
        },
        persistResponse(responsePath) {
          entry.responsePath = responsePath;
        },
        complete() {
          entry.state = 'complete';
        },
        fail(error) {
          entry.state = 'failed';
          entry.error = error.message;
        },
      };
    },
  };
}

function prepareCollection(t) {
  const root = tmpDir(t, 'readers');
  const corpusPath = path.join(root, 'corpus.json');
  const handbookPath = path.join(root, 'handbook.md');
  writeJson(corpusPath, corpusFixture(3));
  fs.writeFileSync(handbookPath, '# Frozen handbook\n\nUse public evidence only.\n');
  const prepared = prepareAdaptiveWarrantAnnotationBatches({
    corpusPath,
    handbookPath,
    outputDir: path.join(root, 'collection'),
    corpusRole: 'natural_prevalence',
    readerIds: ['decision-reader-a', 'decision-reader-b'],
    batchSize: 1,
    annotationModel: SECOND_FAMILY_SEATS.decision_readers,
    maxAnnotationCalls: 6 + 2,
    provenance: { source_commit: 'abc123def', source_tree: 'tree456', source_branch: 'claude/x', source_dirty: true },
  });
  return { root, prepared };
}

function validResponse(manifest, reader, batch) {
  return JSON.stringify({
    schema: ADAPTIVE_WARRANT_ANNOTATION_BATCH_RESPONSE_SCHEMA,
    reader_id: reader.reader_id,
    batch_id: batch.batch_id,
    study_id: manifest.study_id,
    corpus_sha256: manifest.corpus.sha256,
    cases_by_sample_id: Object.fromEntries(batch.required_sample_ids.map((id) => [id, completedCase()])),
  });
}

test('the reader preparer records provenance instead of gating on a clean tree, and plans one batch per case per reader', (t) => {
  const { prepared } = prepareCollection(t);
  assert.equal(prepared.manifest.source_commit, 'abc123def');
  assert.equal(prepared.manifest.semantic_brittleness_preflight.mode, 'not_run_recorded_provenance');
  assert.equal(prepared.manifest.semantic_brittleness_preflight.source_dirty, true);
  assert.equal(prepared.manifest.semantic_brittleness_preflight.reader_model, SECOND_FAMILY_SEATS.decision_readers);
  assert.equal(prepared.authorizationRequest.model, SECOND_FAMILY_SEATS.decision_readers);
  assert.deepEqual(
    prepared.manifest.readers.map((reader) => [reader.reader_id, reader.batches.length]),
    [
      ['decision-reader-a', 3],
      ['decision-reader-b', 3],
    ],
  );
  assert.throws(
    () =>
      prepareAdaptiveWarrantAnnotationBatches({
        corpusPath: prepared.manifest.corpus.path,
        handbookPath: prepared.manifest.handbook.path,
        outputDir: path.join(path.dirname(prepared.manifestPath), 'again'),
        corpusRole: 'natural_prevalence',
        readerIds: ['decision-reader-a', 'decision-reader-b'],
        batchSize: 1,
        provenance: {},
      }),
    /source_commit/u,
  );
});

test('reader dispatch retries a response-free attempt under the allowance, accepts only contract-bound JSON and completes the run record', async (t) => {
  const { root, prepared } = prepareCollection(t);
  const manifest = prepared.manifest;
  const runDir = path.join(root, 'run');
  const runPath = path.join(runDir, 'run.json');
  const run = {
    status: 'running',
    study_id: manifest.study_id,
    source_commit: manifest.source_commit,
    model: SECOND_FAMILY_SEATS.decision_readers,
    calls_attempted: 0,
    calls_completed: 0,
    exposed_sample_ids: [],
    batches: [],
  };
  const budget = fakeBudget();
  const calls = [];
  let droppedOnce = false;
  const callModel = async (agent, systemPrompt, userPrompt, role, opts) => {
    calls.push({ agent, role, effort: opts.effort });
    const packet = JSON.parse(userPrompt);
    const reader = manifest.readers.find((row) => row.reader_id === packet.reader_id);
    const batch = reader.batches.find((row) => row.batch_id === packet.batch_id);
    if (!droppedOnce && packet.reader_id === 'decision-reader-b') {
      droppedOnce = true;
      return { text: '', provider: 'codex', model: 'gpt-5.6-sol' };
    }
    return {
      text: validResponse(manifest, reader, batch),
      provider: 'codex',
      model: 'gpt-5.6-sol',
      modelAttestationBasis: 'explicit_cli_model_argument_accepted_bridge_echo',
      modelIndependentlyAttested: false,
      prohibitedToolEventCount: 0,
    };
  };

  const finished = await runSecondFamilyReaders({
    collectionManifest: manifest,
    collectionManifestPath: prepared.manifestPath,
    outputDir: runDir,
    runPath,
    run,
    budget,
    attemptCap: 8,
    callModel,
  });

  assert.equal(finished.status, 'complete');
  assert.equal(finished.calls_attempted, 7);
  assert.equal(finished.calls_completed, 6);
  assert.deepEqual(
    calls.map((call) => call.agent),
    Array(7).fill({ provider: 'codex', model: 'gpt-5.6-sol' }),
  );
  assert.ok(calls.every((call) => call.effort === 'medium'));
  const failed = finished.batches.filter((row) => row.status === 'failed');
  assert.equal(failed.length, 1);
  assert.equal(failed[0].failure_kind, 'transport_response_free');
  assert.equal(failed[0].quarantine_path, undefined);
  const complete = finished.batches.filter((row) => row.status === 'complete');
  assert.equal(complete.length, 6);
  for (const row of complete) {
    assert.ok(fs.existsSync(row.response_path));
    assert.equal(row.response_sha256, sha256(fs.readFileSync(row.response_path)));
    assert.equal(row.model_attestation_basis, 'explicit_cli_model_argument_accepted_bridge_echo');
    assert.equal(row.returned_model, 'gpt-5.6-sol');
    assert.equal(row.prohibited_tool_event_count, 0);
  }
  assert.equal(readJson(runPath).status, 'complete');
  assert.deepEqual(
    budget.log.map((entry) => entry.state),
    ['complete', 'complete', 'complete', 'failed', 'complete', 'complete', 'complete'],
  );
  assert.equal(fs.existsSync(path.join(runDir, 'quarantine')), false);
});

test('a reader response outside the contract is quarantined and stops the run for the operator', async (t) => {
  const { root, prepared } = prepareCollection(t);
  const manifest = prepared.manifest;
  const runDir = path.join(root, 'run');
  const runPath = path.join(runDir, 'run.json');
  const run = {
    status: 'running',
    study_id: manifest.study_id,
    source_commit: manifest.source_commit,
    calls_attempted: 0,
    calls_completed: 0,
    exposed_sample_ids: [],
    batches: [],
  };
  let callCount = 0;
  const callModel = async (agent, systemPrompt, userPrompt) => {
    callCount += 1;
    const packet = JSON.parse(userPrompt);
    const reader = manifest.readers.find((row) => row.reader_id === packet.reader_id);
    const batch = reader.batches.find((row) => row.batch_id === packet.batch_id);
    if (callCount === 2) {
      const wrong = JSON.parse(validResponse(manifest, reader, batch));
      wrong.corpus_sha256 = 'deadbeef';
      return { text: JSON.stringify(wrong), provider: 'codex', model: 'gpt-5.6-sol' };
    }
    return { text: validResponse(manifest, reader, batch), provider: 'codex', model: 'gpt-5.6-sol' };
  };
  await assert.rejects(
    runSecondFamilyReaders({
      collectionManifest: manifest,
      collectionManifestPath: prepared.manifestPath,
      outputDir: runDir,
      runPath,
      run,
      budget: fakeBudget(),
      attemptCap: 8,
      callModel,
    }),
    (error) => error.code === 'reader_contract_failure' && error.recoveryPermitted === true,
  );
  assert.equal(callCount, 2);
  const saved = readJson(runPath);
  assert.equal(saved.status, 'incomplete_contract_failure');
  assert.equal(saved.calls_attempted, 2);
  assert.equal(saved.calls_completed, 1);
  const failed = saved.batches.find((row) => row.status === 'failed');
  assert.equal(failed.failure_kind, 'contract');
  assert.ok(fs.existsSync(failed.quarantine_path));
  assert.match(fs.readFileSync(failed.quarantine_path, 'utf8'), /deadbeef/u);
  assert.equal(
    fs.existsSync(path.join(runDir, 'decision-reader-a', manifest.readers[0].batches[1].expected_response_filename)),
    false,
  );
});

test('the reader attempt cap stops dispatch without recovery once the allowance is spent', async (t) => {
  const { root, prepared } = prepareCollection(t);
  const manifest = prepared.manifest;
  const run = { status: 'running', calls_attempted: 0, calls_completed: 0, exposed_sample_ids: [], batches: [] };
  let callCount = 0;
  await assert.rejects(
    runSecondFamilyReaders({
      collectionManifest: manifest,
      collectionManifestPath: prepared.manifestPath,
      outputDir: path.join(root, 'run'),
      runPath: path.join(root, 'run', 'run.json'),
      run,
      budget: fakeBudget(),
      attemptCap: 2,
      callModel: async () => {
        callCount += 1;
        return { text: '', provider: 'codex', model: 'gpt-5.6-sol' };
      },
    }),
    /reader attempt cap 2 reached/u,
  );
  assert.equal(callCount, 2);
  assert.equal(run.status, 'incomplete_reader_attempt_cap');
});

// ---------------------------------------------------------------------------
// Scoring bar and report-only descriptions
// ---------------------------------------------------------------------------

function dialogueScore(condition, index, firstBreakTurn) {
  return {
    dialogue_id: `${condition}-${index}`,
    condition,
    measure_4_deference_break: { first_turn: firstBreakTurn, persists_to_end: firstBreakTurn !== null },
  };
}

function scores({ bare, gated, standing }) {
  const rows = [];
  for (let index = 0; index < 24; index += 1) {
    rows.push(dialogueScore('bare', index, index < bare ? 2 : null));
    rows.push(dialogueScore('gated', index, index < gated ? 5 : null));
    rows.push(dialogueScore('standing_permission', index, index < standing ? 3 : null));
  }
  return rows;
}

test('the replication bar reads the first block as replicated and a flat result as not replicated', () => {
  const firstBlock = judgeSecondFamilyReplication({
    dialogueScores: scores({ bare: 10, gated: 19, standing: 11 }),
    decisionByCondition: {
      bare: { correctness_rate: 0.648 },
      gated: { correctness_rate: 0.875 },
      standing_permission: { correctness_rate: 0.683 },
    },
  });
  assert.equal(firstBlock.r1_deference_break.gap, 8);
  assert.equal(firstBlock.r1_deference_break.verdict, 'replicated');
  assert.equal(firstBlock.r2_decision_correctness.margin_points, 19.2);
  assert.equal(firstBlock.r2_decision_correctness.verdict, 'replicated');
  assert.equal(firstBlock.overall, 'replicated');

  const direction = judgeSecondFamilyReplication({
    dialogueScores: scores({ bare: 12, gated: 15, standing: 11 }),
    decisionByCondition: {
      bare: { correctness_rate: 0.7 },
      gated: { correctness_rate: 0.74 },
      standing_permission: { correctness_rate: 0.69 },
    },
  });
  assert.equal(direction.r1_deference_break.verdict, 'direction_only');
  assert.equal(direction.r2_decision_correctness.verdict, 'direction_only');
  assert.equal(direction.overall, 'not_replicated');

  const flat = judgeSecondFamilyReplication({
    dialogueScores: scores({ bare: 14, gated: 12, standing: 13 }),
    decisionByCondition: {
      bare: { correctness_rate: 0.8 },
      gated: { correctness_rate: 0.78 },
      standing_permission: { correctness_rate: 0.79 },
    },
  });
  assert.equal(flat.r1_deference_break.verdict, 'not_replicated');
  assert.equal(flat.r2_decision_correctness.verdict, 'not_replicated');
  assert.equal(flat.overall, 'not_replicated');

  const missing = judgeSecondFamilyReplication({ dialogueScores: [], decisionByCondition: {} });
  assert.equal(missing.r2_decision_correctness.verdict, 'not_computable');
  assert.equal(missing.overall, 'not_replicated');
});

test('arming and challenge turns are read from the stored gate decisions, report-only', () => {
  const rows = [
    {
      type: 'turn_complete',
      turnRecord: { turn: 1, warrant_gate_decision: { warrant_basis: 'none' }, actual_action_family: 'hold' },
    },
    {
      type: 'turn_complete',
      turnRecord: { turn: 2, warrant_gate_decision: { warrant_basis: 'none' }, actual_action_family: 'hold' },
    },
    { type: 'other', turnRecord: { turn: 99 } },
    {
      type: 'turn_complete',
      turnRecord: {
        turn: 4,
        warrant_gate_decision: { warrant_basis: 'sustained_deference:3_turns' },
        actual_action_family: 'challenge_resistance',
      },
    },
    {
      type: 'turn_complete',
      turnRecord: { turn: 3, warrant_gate_decision: { warrant_basis: 'none' }, actual_action_family: 'hold' },
    },
    {
      type: 'turn_complete',
      turnRecord: {
        turn: 5,
        warrant_gate_decision: { warrant_basis: 'none' },
        deliveredResponseConfiguration: { action_family: 'challenge_resistance' },
      },
    },
  ];
  const arming = describeSecondFamilyArming({ dialogueId: 'gated-1', condition: 'gated', rows });
  assert.deepEqual(arming.armed_turns, [4]);
  assert.equal(arming.first_armed_turn, 4);
  assert.deepEqual(arming.challenge_turns, [4, 5]);
  assert.equal(arming.armed_and_challenged, true);

  const quiet = describeSecondFamilyArming({ dialogueId: 'bare-1', condition: 'bare', rows: rows.slice(0, 2) });
  assert.equal(quiet.first_armed_turn, null);
  assert.equal(quiet.armed_and_challenged, false);

  const summary = summarizeSecondFamilyReportOnly({
    arming: [
      arming,
      quiet,
      {
        dialogue_id: 'gated-2',
        condition: 'gated',
        armed_turns: [],
        challenge_turns: [],
        first_challenge_turn: null,
        armed_and_challenged: false,
      },
    ],
    dialogueScores: [
      {
        dialogue_id: 'gated-1',
        condition: 'gated',
        measure_4_deference_break: { first_turn: 6, persists_to_end: true },
      },
      {
        dialogue_id: 'gated-2',
        condition: 'gated',
        measure_4_deference_break: { first_turn: 2, persists_to_end: false },
      },
      { dialogue_id: 'bare-1', condition: 'bare', measure_4_deference_break: { first_turn: 2, persists_to_end: true } },
    ],
  });
  assert.equal(summary.status, 'report_only');
  assert.equal(summary.p1_prime_armed_and_challenged.gated_dialogues, 2);
  assert.equal(summary.p1_prime_armed_and_challenged.armed_and_challenged, 1);
  assert.equal(summary.p2b_break_within_three_turns_after_first_challenge.gated_dialogues_with_break, 2);
  assert.equal(summary.p2b_break_within_three_turns_after_first_challenge.within_three_turns_after_first_challenge, 1);
  assert.equal(summary.gated_challenge_turns, 2);
});
