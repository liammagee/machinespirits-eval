// GUARD: the narrowing codebook stays a second scale beside the sealed
// engagement ladder, never a replacement for it.
//
// The risk this holds off is drift of authority. The codebook exists because
// the ladder cannot say whether a refusal got narrower; the moment it starts
// deciding ladder scores, breaking ladder ties, or feeding the current study's
// primary endpoint, the study has quietly changed its endpoint without a new
// registration. The other risk is the tie-break going missing: a learner naming a bound while
// withholding is rung 1, and that sentence is the whole reason the codebook
// was written.
//
// Offline and free: reads two files, calls nothing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTutorStubResistantLearnerFinalHorizonPacket } from '../services/tutorStubResistantLearnerSemanticRuntime.js';
import {
  buildTutorStubFrameRefuserNarrowingPlan,
  buildTutorStubFrameRefuserNarrowingReaderPrompt,
  evaluateTutorStubFrameRefuserNarrowingReaderResponse,
  loadTutorStubFrameRefuserNarrowingDesign,
  summarizeTutorStubFrameRefuserNarrowingCalibration,
} from '../services/tutorStubFrameRefuserNarrowingCalibration.js';
import {
  executeTutorStubFrameRefuserNarrowingCalibration,
  main as narrowingLauncherMain,
  prepareTutorStubFrameRefuserNarrowingCalibration,
} from '../scripts/run-tutor-stub-frame-refuser-narrowing-calibration.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CODEBOOK_PATH = path.join(REPO_ROOT, 'config/tutor-stub-frame-refuser-narrowing-codebook.v1.md');
const DESIGN_PATH = 'config/tutor-stub-frame-refuser-narrowing-calibration-design.v1.json';
const WORKPLAN_PATH = path.join(REPO_ROOT, 'workplan/items/frame-refuser-refusal-narrowing.md');
const codebook = () => fs.readFileSync(CODEBOOK_PATH, 'utf8');
const workplan = () => fs.readFileSync(WORKPLAN_PATH, 'utf8');

function createNarrowingArchiveFixture(t) {
  const archiveRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-refuser-narrowing-'));
  t.after(() => fs.rmSync(archiveRoot, { recursive: true, force: true }));
  const loaded = loadTutorStubFrameRefuserNarrowingDesign({ root: REPO_ROOT, designPath: DESIGN_PATH });
  for (const source of loaded.design.source.reportDirectories) {
    const rows = [];
    for (const arm of loaded.design.sample.arms) {
      for (const world of loaded.design.sample.worlds) {
        for (let repeat = 1; repeat <= 2; repeat += 1) {
          const id = `${source.version}_${arm}_${world}_${repeat}`;
          const transcriptRelative = `jobs/${id}/transcript.json`;
          const transcript = {
            turns: [
              { turn: 1, learner: `trigger ${repeat}`, tutor: `intervention ${repeat}` },
              { turn: 2, learner: `post one ${repeat}`, tutor: `tutor one ${repeat}` },
            ],
            registerSelection: {
              history: [
                {
                  turn: 3,
                  light_adaptation: { current_signal: { public_learner_surface: `final surface ${repeat}` } },
                },
              ],
            },
          };
          const transcriptPath = path.join(archiveRoot, source.path, transcriptRelative);
          fs.mkdirSync(path.dirname(transcriptPath), { recursive: true });
          fs.writeFileSync(transcriptPath, `${JSON.stringify(transcript)}\n`);
          rows.push({
            status: 'complete',
            job: { id, arm_id: arm, world, outcome_horizon_learner_turns: 2 },
            delivery: [{ delivered: true, turn: 1 }],
            transcript: transcriptRelative,
          });
        }
      }
    }
    const reportPath = path.join(archiveRoot, source.path, 'report.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify({ rows })}\n`);
  }
  const plan = buildTutorStubFrameRefuserNarrowingPlan({
    loaded,
    archiveRoot,
    verifyCommittedFile: () => true,
  });
  return { archiveRoot, loaded, plan };
}

function eligibleMeasurement(direction, finalTuple) {
  const [open, bound, conceded] = finalTuple;
  const finalState = {
    source_id: 'post_2',
    disposition: 'scored',
    open_demand_count: open,
    bound_tightness: bound,
    conceded_subclaim_count: conceded,
  };
  const firstState =
    direction === 'narrower'
      ? {
          source_id: 'trigger',
          disposition: 'scored',
          open_demand_count: open + 1,
          bound_tightness: Math.max(0, bound - 1),
          conceded_subclaim_count: Math.max(0, conceded - 1),
        }
      : { ...finalState, source_id: 'trigger' };
  return { eligible: true, issues: [], direction, states: [firstState, finalState] };
}

function resolveTestReader(modelRef) {
  const seat = {
    'codex.gpt-5.6-sol': ['codex', 'gpt-5.6-sol'],
    'claude-code.sonnet-5': ['claude-code', 'claude-sonnet-5'],
    'claude-code.opus-5': ['claude-code', 'claude-opus-5'],
  }[modelRef];
  return { provider: seat[0], model: seat[1], isConfigured: true };
}

function categoricalBridgeResponse(agentConfig, userPrompt, options) {
  const request = JSON.parse(userPrompt);
  return {
    text: JSON.stringify({
      case_id: request.case_id,
      states: request.public_dialogue
        .filter((row) => row.speaker === 'learner')
        .map((row) => ({
          source_id: row.source_id,
          disposition: 'measurement_indeterminate',
          open_demands: [],
          tightest_bound: null,
          conceded_subclaims: [],
        })),
    }),
    provider: agentConfig.provider,
    model: agentConfig.model,
    effort: options.effort,
    structuredOutput: true,
    prohibitedToolEventCount: 0,
  };
}

function fakeAdmission(ceiling, { ledgerPath } = {}) {
  let reserved = 0;
  let closed = false;
  const events = [];
  const append = (event, { create = false } = {}) => {
    events.push(event);
    if (ledgerPath) {
      fs.writeFileSync(ledgerPath, `${JSON.stringify(event)}\n`, { flag: create ? 'wx' : 'a' });
    }
  };
  append({ type: 'launch_admitted', spend_cap: ceiling }, { create: true });
  return {
    source: { commit: 'a'.repeat(40), tree: 'b'.repeat(40) },
    authorization: { commit: 'c'.repeat(40), path: 'notes/go.md' },
    get reserved() {
      return reserved;
    },
    get closed() {
      return closed;
    },
    events,
    reserveModelAttempts(count, detail) {
      assert.ok(reserved + count <= ceiling, 'reservation must fail before exceeding the ceiling');
      reserved += count;
      append({ ...detail, type: 'model_attempt_reserved', count, reserved, spend_cap: ceiling });
    },
    record(event) {
      append(event);
    },
    close(event) {
      append(event);
      closed = true;
    },
  };
}

test('the codebook defines all three registered marks', () => {
  const text = codebook();
  // The card's P0 names these three countable marks. A codebook missing one
  // cannot answer the question the card asks.
  assert.match(text, /Mark 1 — open demands/u);
  assert.match(text, /Mark 2 — bound tightness/u);
  assert.match(text, /Mark 3 — conceded sub-claims/u);
  // Each needs a direction, or a reader cannot tell narrower from wider.
  assert.match(text, /open demands \(count, lower is narrower\)/u);
  assert.match(text, /bound tightness \(0–3, higher is narrower\)/u);
  assert.match(text, /conceded sub-claims \(count, higher is narrower\)/u);
});

test('the codebook carries the tie-break the readers split on', () => {
  const text = codebook();
  // The fourth calibration failed pairwise agreement at exactly this boundary.
  // The ladder is not amended, so the codebook must settle it in words.
  assert.match(text, /names a precise or decisive bound while still withholding is\s+rung 1 on the ladder/u);
  assert.match(text, /0\.714/u, 'the codebook should name the agreement it is answering');
  assert.match(text, /0\.733/u);
});

test('the codebook preserves the ladder while allowing a future registered endpoint', () => {
  const text = codebook();
  assert.match(text, /It is not a rung 1\.5/u);
  assert.match(text, /never converts to a ladder score/u);
  assert.match(text, /never breaks a ladder tie/u);
  assert.match(text, /already registered satisfiable study/u);
  assert.match(text, /P1 is\s+instrument-building calibration/u);
  assert.match(text, /report-only/u);
  assert.match(text, /later fresh registered study may promote/u);
  assert.doesNotMatch(text, /never enters the primary endpoint of any\s+study/u);
});

test('the codebook grants no model call and names its next gate', () => {
  const text = codebook();
  assert.match(text, /licenses nothing/u);
  assert.match(text, /authorizes no model call/u);
  // The next paid step must carry an explicit GO and spend ceiling.
  assert.match(text, /its own explicit GO and\s+spend ceiling/u);
  // And it must say what a null result means, before anyone reads.
  assert.match(text, /If\s+readers\s+cannot meet the\s+agreement floors or the measure does not spread/u);
});

test('the worked examples are authentic archived disagreement rows with provenance', () => {
  const text = codebook();
  assert.match(text, /exact public learner posts from archived rows behind reader A's stray\s+rung-2 votes/u);
  assert.match(text, /source\s+transcripts remain in the private archive/u);
  assert.match(text, /7c8c8130e0d19431694c222af8cd9b0dd7e2a360/u);
  assert.match(text, /depth_reference_cal4_world_030_rowan_flat_r6/u);
  assert.match(text, /depth_treatment_cal_world_005_marrick_r6/u);
  assert.match(text, /depth_reference_cal_world_030_rowan_flat_r4/u);
  assert.match(text, /depth_treatment_cal4_world_030_rowan_flat_r10/u);
  assert.match(text, /depth_reference_cal4_world_030_rowan_flat_r3/u);
  assert.match(text, /depth_treatment_cal_world_005_marrick_r6`, `post_4`/u);
  assert.match(text, /depth_treatment_cal4_world_030_rowan_flat_r10`, `post_5`/u);
  assert.doesNotMatch(text, /These examples are authored, not quoted/u);
});

test('P0 is complete while reader calibration remains separately gated', () => {
  const text = codebook();
  const card = workplan();
  assert.match(text, /Status: P0 complete, zero-call/u);
  assert.match(text, /P0 is complete/u);
  assert.match(card, /P0 complete, zero-call/u);
  assert.match(card, /No P1 reader call is authorized/u);
  assert.doesNotMatch(text, /P0 remains open/u);
});

test('the reader packet source is the runtime post-horizon surface', () => {
  const text = codebook();
  const state = {
    resistanceActionRegisterStudy: {
      trigger_turn: 4,
      outcome_horizon_learner_turns: 2,
    },
    turns: [
      { turn: 4, learner: 'trigger learner', tutor: 'intervention tutor' },
      { turn: 5, learner: 'post one', tutor: 'tutor one' },
      { turn: 6, learner: 'incoming learner before final tutor', tutor: 'final tutor' },
    ],
  };

  const packet = buildTutorStubResistantLearnerFinalHorizonPacket(state, 'final generated learner');

  assert.deepEqual(packet, {
    trigger: 'trigger learner',
    intervention: 'intervention tutor',
    post_1: 'post one',
    tutor_1: 'tutor one',
    post_2: 'final generated learner',
  });
  assert.notEqual(packet.post_2, state.turns[2].learner);
  assert.match(text, /final\s+`post_horizon` is the newly generated learner response/u);
  assert.match(text, /exact-match each quoted span against the\s+packet's named `post_N`/u);
});

test('all three longitudinal marks are comparable end-of-turn states', () => {
  const text = codebook();
  assert.match(text, /three marks are end-of-turn\s+states/u);
  assert.match(text, /Silence does not\s+close a demand/u);
  assert.match(text, /previously stated bound\s+carries forward/u);
  assert.match(text, /not used in the first-to-last combined\s+direction/u);
  assert.match(text, /cumulative number of distinct propositions/u);
  assert.match(text, /maintained concession remains in the end-of-turn state/u);
  assert.match(text, /explicit retraction removes it/u);
});

test('unscored outcomes stay visible in each arm denominator', () => {
  const text = codebook();
  assert.match(text, /Every assigned dialogue remains in its arm denominator/u);
  assert.match(text, /persona_exit/u);
  assert.match(text, /registered_move_not_delivered/u);
  assert.match(text, /refusal_resolved/u);
  assert.match(text, /unconditional_refusal_no_open_demand/u);
  assert.match(text, /assigned dialogues, scorable dialogues/u);
  assert.match(text, /Spread among scorable rows\s+alone\s+cannot open/u);
});

test('every worked example carries all three marks and a ladder rung', () => {
  // Match on content, not layout: the prose wraps, and a score line split
  // across two lines is still a score line.
  const text = codebook().replace(/\s+/gu, ' ');
  const examples = text.match(/\*\*[A-E]\.[^*]*\*\*/gu) || [];
  assert.equal(examples.length, 5, 'five worked examples, A through E');
  // An example without its three scores teaches a reader nothing, and one
  // without its ladder rung invites exactly the conflation this codebook
  // exists to stop.
  const scored = text.match(/Open demands \d+; bound tightness \d+; conceded \d+\./gu) || [];
  assert.equal(scored.length, 5);
  const rungs = text.match(/Ladder rung [012]/gu) || [];
  assert.equal(rungs.length, 5);
  assert.match(text, /Open demands 1; bound tightness 3; conceded 2\./u);
  assert.match(text, /Open demands 2; bound tightness 3; conceded 2\./u);
  assert.match(text, /Open demands 2; bound tightness 3; conceded 1\./u);
  assert.match(text, /Open demands 1; bound tightness 3; conceded 3\./u);
  assert.doesNotMatch(text, /Narrower than the earlier turn on mark 1 alone/u);
});

test('the P1 design fixes the sample, independent routes, floors, and 72-attempt ceiling without granting calls', () => {
  const { design } = loadTutorStubFrameRefuserNarrowingDesign({ root: REPO_ROOT, designPath: DESIGN_PATH });
  assert.equal(design.sample.size, 24);
  assert.equal(design.sample.perVersion, 6);
  assert.equal(design.sample.perArm, 12);
  assert.equal(design.sample.perWorld, 12);
  assert.equal(design.readers.seats.length, 3);
  assert.deepEqual(
    design.readers.seats.map((seat) => [seat.id, seat.modelRef, seat.effort]),
    [
      ['reader_a', 'codex.gpt-5.6-sol', 'low'],
      ['reader_b', 'claude-code.sonnet-5', 'low'],
      ['reader_c', 'claude-code.opus-5', 'low'],
    ],
  );
  assert.equal(design.readers.automaticRetries, 0);
  assert.equal(design.attemptCeiling.plannedCalls, 72);
  assert.equal(design.attemptCeiling.maximumAttempts, 72);
  assert.equal(design.agreementGates.minimumPairwiseExactAgreement, 0.8);
  assert.equal(design.spreadGate.minimumAbsoluteNarrowerRateGap, 0.15);
  assert.equal(design.launch.designGrantsModelCalls, false);
});

test('the zero-call plan selects 24 unique balanced rows and takes the final post from runtime history', (t) => {
  const { plan } = createNarrowingArchiveFixture(t);
  assert.equal(plan.status, 'passed_zero_call');
  assert.equal(plan.model_calls_executed, 0);
  assert.equal(plan.planned_model_calls, 72);
  assert.equal(plan.hard_attempt_ceiling, 72);
  assert.equal(plan.cases.length, 24);
  assert.equal(new Set(plan.cases.map((entry) => entry.case_id)).size, 24);
  assert.deepEqual(plan.sample.balances.version, { v1: 6, v2: 6, v3: 6, v4: 6 });
  assert.deepEqual(plan.sample.balances.arm, { reference: 12, treatment: 12 });
  assert.deepEqual(plan.sample.balances.world, { world_005_marrick: 12, world_030_rowan_flat: 12 });
  assert.match(plan.cases[0].public_packet.post_2, /^final surface/u);
  assert.doesNotMatch(plan.cases[0].public_packet.post_2, /^post one/u);
});

test('reader prompts expose only the rule instrument and public dialogue', () => {
  const prompt = buildTutorStubFrameRefuserNarrowingReaderPrompt({
    instrumentText: fs.readFileSync(
      path.join(REPO_ROOT, 'config/tutor-stub-frame-refuser-narrowing-instrument.v1.md'),
      'utf8',
    ),
    caseId: 'nrw_001',
    publicPacket: {
      trigger: 'Show me one decisive line.',
      intervention: 'Here is the line.',
      post_1: 'That helps, but the interval still matters.',
    },
  });
  const visible = `${prompt.system_prompt}\n${prompt.user_prompt}`;
  assert.match(visible, /nrw_001/u);
  assert.match(visible, /Show me one decisive line/u);
  assert.doesNotMatch(visible, /reference|treatment|source job|depth_.*_r\d/u);
  assert.doesNotMatch(visible, /0\.714|0\.733/u, 'worked-example calibration evidence must not leak to readers');
});

test('reader outputs require exact non-future evidence and an audited model envelope', () => {
  const publicPacket = {
    trigger: 'Show me a threshold.',
    intervention: 'Use ten percent.',
    post_1: 'Ten percent is concrete.',
  };
  const prompt = buildTutorStubFrameRefuserNarrowingReaderPrompt({
    instrumentText: 'Apply the registered rules.',
    caseId: 'nrw_001',
    publicPacket,
  });
  const output = {
    case_id: 'nrw_001',
    states: [
      {
        source_id: 'trigger',
        disposition: 'scored',
        open_demands: [{ description: 'threshold', evidence: [{ source_id: 'trigger', text: 'a threshold' }] }],
        tightest_bound: {
          score: 1,
          description: 'qualitative threshold request',
          evidence: [{ source_id: 'trigger', text: 'a threshold' }],
        },
        conceded_subclaims: [],
      },
      {
        source_id: 'post_1',
        disposition: 'scored',
        open_demands: [{ description: 'threshold', evidence: [{ source_id: 'trigger', text: 'a threshold' }] }],
        tightest_bound: {
          score: 3,
          description: 'numerical threshold',
          evidence: [{ source_id: 'post_1', text: 'Ten percent' }],
        },
        conceded_subclaims: [
          { description: 'threshold is concrete', evidence: [{ source_id: 'post_1', text: 'is concrete' }] },
        ],
      },
    ],
  };
  const seat = { provider: 'codex', model: 'gpt-5.6-sol', effort: 'low' };
  const response = {
    text: JSON.stringify(output),
    provider: seat.provider,
    model: seat.model,
    effort: seat.effort,
    structuredOutput: true,
    prohibitedToolEventCountObserved: true,
    prohibitedToolEventCount: 0,
  };
  const accepted = evaluateTutorStubFrameRefuserNarrowingReaderResponse({ response, seat, prompt });
  assert.equal(accepted.eligible, true);
  assert.equal(accepted.direction, 'narrower');

  output.states[0].open_demands[0].evidence = [{ source_id: 'post_1', text: 'Ten percent' }];
  const rejected = evaluateTutorStubFrameRefuserNarrowingReaderResponse({
    response: { ...response, text: JSON.stringify(output) },
    seat,
    prompt,
  });
  assert.equal(rejected.eligible, false);
  assert.ok(rejected.issues.some((issue) => issue.includes('future_source')));
});

test('three agreeing seats can pass agreement and spread only through the registered mechanical gates', (t) => {
  const { loaded, plan } = createNarrowingArchiveFixture(t);
  const tuples = [
    [1, 1, 0],
    [1, 2, 1],
    [2, 3, 1],
  ];
  const records = plan.cases.flatMap((entry, index) => {
    const direction = entry.source.arm_id === 'treatment' ? 'narrower' : 'unchanged';
    const measurement = eligibleMeasurement(direction, tuples[index % tuples.length]);
    return loaded.design.readers.seats.map((seat) => ({
      case_id: entry.case_id,
      seat_id: seat.id,
      measurement,
    }));
  });
  const report = summarizeTutorStubFrameRefuserNarrowingCalibration({ plan, records, design: loaded.design });
  assert.equal(report.agreement.pass, true);
  assert.equal(report.spread.pass, true);
  assert.equal(report.status, 'passed_instrument_gate');
  assert.equal(report.fresh_study_gate_open, true);
  assert.equal(report.archived_rows_confirmatory, false);
});

test('the complete preflight writes nothing and the launcher makes exactly 72 non-retried reader calls', async (t) => {
  const { archiveRoot } = createNarrowingArchiveFixture(t);
  const destination = path.join(archiveRoot, 'artifacts/tutor-stub-live/narrowing-reader-test');
  const preflight = prepareTutorStubFrameRefuserNarrowingCalibration({
    root: REPO_ROOT,
    designPath: DESIGN_PATH,
    archiveRoot,
    destination,
    verifyCommittedFile: () => true,
    resolve: resolveTestReader,
  });
  assert.equal(preflight.status, 'passed_zero_call');
  assert.equal(preflight.model_calls_executed, 0);
  assert.equal(fs.existsSync(destination), false, 'zero-call preflight must not create the destination');

  fs.mkdirSync(destination, { recursive: true });
  const admission = fakeAdmission(72);
  let calls = 0;
  const callBridge = async (agentConfig, _systemPrompt, userPrompt, _role, options) => {
    calls += 1;
    return categoricalBridgeResponse(agentConfig, userPrompt, options);
  };
  const report = await executeTutorStubFrameRefuserNarrowingCalibration({
    preflight,
    admission,
    callBridge,
    progress: () => {},
  });
  assert.equal(calls, 72);
  assert.equal(admission.reserved, 72);
  assert.equal(admission.closed, true);
  assert.equal(report.execution.complete_units, 72);
  assert.equal(report.execution.eligible_units, 72);
  assert.equal(report.execution.missing_units, 0);
  assert.equal(fs.readdirSync(path.join(destination, 'results')).length, 72);
  assert.equal(report.status, 'failed_agreement', 'categorical-only agreement cannot pass the three-mark gate');
});

test('recovery skips completed and failed units and spends only the 61 untouched attempts', async (t) => {
  const { archiveRoot } = createNarrowingArchiveFixture(t);
  const initialDestination = path.join(archiveRoot, 'artifacts/tutor-stub-live/narrowing-reader-transport-failure');
  const initialPreflight = prepareTutorStubFrameRefuserNarrowingCalibration({
    root: REPO_ROOT,
    designPath: DESIGN_PATH,
    archiveRoot,
    destination: initialDestination,
    verifyCommittedFile: () => true,
    resolve: resolveTestReader,
  });
  fs.mkdirSync(initialDestination, { recursive: true });
  const initialAdmission = fakeAdmission(72, {
    ledgerPath: path.join(initialDestination, 'run-ledger.jsonl'),
  });
  let initialCalls = 0;
  await assert.rejects(
    executeTutorStubFrameRefuserNarrowingCalibration({
      preflight: initialPreflight,
      admission: initialAdmission,
      callBridge: async (agentConfig, _systemPrompt, userPrompt, _role, options) => {
        initialCalls += 1;
        if (initialCalls === 11) throw new Error('synthetic transport failure');
        return categoricalBridgeResponse(agentConfig, userPrompt, options);
      },
      progress: () => {},
    }),
    /synthetic transport failure/u,
  );
  assert.equal(initialCalls, 11);
  assert.equal(initialAdmission.reserved, 11);
  assert.equal(initialAdmission.closed, true);
  assert.equal(fs.readdirSync(path.join(initialDestination, 'results')).length, 10);
  const failure = JSON.parse(fs.readFileSync(path.join(initialDestination, 'failure.json'), 'utf8'));
  assert.equal(failure.status, 'transport_failure');
  assert.equal(failure.unit, 'nrw_004/reader_b');

  const recoveryDestination = path.join(archiveRoot, 'artifacts/tutor-stub-live/narrowing-reader-recovery');
  const recoveryPreflight = prepareTutorStubFrameRefuserNarrowingCalibration({
    root: REPO_ROOT,
    designPath: DESIGN_PATH,
    archiveRoot,
    destination: recoveryDestination,
    recoveryFrom: initialDestination,
    verifyCommittedFile: () => true,
    resolve: resolveTestReader,
  });
  assert.equal(recoveryPreflight.prior_attempts, 11);
  assert.equal(recoveryPreflight.recovery_model_calls, 61);
  assert.equal(recoveryPreflight.remaining_study_attempts, 61);
  assert.equal(recoveryPreflight.recovery_summary.failed_unit, 'nrw_004/reader_b');
  assert.equal(recoveryPreflight.executionUnits.length, 61);
  assert.equal(recoveryPreflight.executionUnits[0].caseEntry.case_id, 'nrw_004');
  assert.equal(recoveryPreflight.executionUnits[0].seat.id, 'reader_c');
  assert.equal(
    recoveryPreflight.executionUnits.some(
      ({ caseEntry, seat }) => `${caseEntry.case_id}/${seat.id}` === 'nrw_004/reader_b',
    ),
    false,
  );
  assert.equal(fs.existsSync(recoveryDestination), false, 'recovery preflight must remain zero-call and non-writing');

  fs.mkdirSync(recoveryDestination, { recursive: true });
  const recoveryAdmission = fakeAdmission(61, {
    ledgerPath: path.join(recoveryDestination, 'run-ledger.jsonl'),
  });
  let recoveryCalls = 0;
  const report = await executeTutorStubFrameRefuserNarrowingCalibration({
    preflight: recoveryPreflight,
    admission: recoveryAdmission,
    callBridge: async (agentConfig, _systemPrompt, userPrompt, _role, options) => {
      recoveryCalls += 1;
      return categoricalBridgeResponse(agentConfig, userPrompt, options);
    },
    progress: () => {},
  });
  assert.equal(recoveryCalls, 61);
  assert.equal(recoveryAdmission.reserved, 61);
  assert.equal(recoveryAdmission.closed, true);
  assert.equal(report.execution.complete_units, 71);
  assert.equal(report.execution.failed_units, 1);
  assert.deepEqual(report.execution.failed_unit_ids, ['nrw_004/reader_b']);
  assert.equal(report.execution.missing_units, 0);
  assert.equal(report.execution.prior_attempted_model_calls, 11);
  assert.equal(report.execution.recovery_attempted_model_calls, 61);
  assert.equal(report.execution.attempted_model_calls, 72);
  assert.equal(report.execution.reserved_model_calls, 72);
  assert.equal(fs.readdirSync(path.join(recoveryDestination, 'results')).length, 61);
  assert.equal(fs.existsSync(path.join(recoveryDestination, 'results/nrw_004--reader_b.json')), false);
});

test('launcher admission uses one stable study identity and full ceiling for initial and recovery roots', async () => {
  const captures = [];
  const archiveRoot = '/absolute/private-archive';
  const basePreflight = {
    status: 'passed_zero_call',
    loaded: { relativePath: DESIGN_PATH, design: { studyId: 'frame-refuser-narrowing-p1' } },
    archiveRoot,
    destination: `${archiveRoot}/artifacts/tutor-stub-live/run`,
    hard_attempt_ceiling: 72,
  };
  const invoke = (preflight, extraArgs = []) =>
    narrowingLauncherMain(
      [
        '--design',
        DESIGN_PATH,
        '--archive-root',
        archiveRoot,
        '--destination',
        preflight.destination,
        '--launch-commit',
        'launch',
        '--go-note-commit',
        'go',
        '--go-note-path',
        'notes/go.md',
        '--accept-charges',
        ...extraArgs,
      ],
      {
        prepare: () => preflight,
        admit: (input) => {
          captures.push(input);
          return { source: { commit: 'launch' } };
        },
        execute: async () => ({ status: 'complete' }),
      },
    );

  await invoke(basePreflight);
  const predecessor = `${archiveRoot}/artifacts/tutor-stub-live/run`;
  await invoke(
    {
      ...basePreflight,
      destination: `${archiveRoot}/artifacts/tutor-stub-live/recovery`,
      recovery: { source_root: predecessor },
      remaining_study_attempts: 61,
    },
    ['--recovery-from', predecessor],
  );

  assert.equal(captures.length, 2);
  assert.equal(captures[0].studyId, 'frame-refuser-narrowing-p1');
  assert.equal(captures[1].studyId, captures[0].studyId);
  assert.equal(captures[0].studyStateRoot, captures[1].studyStateRoot);
  assert.equal(captures[0].spendCap, 72);
  assert.equal(captures[1].spendCap, 72);
  assert.equal(captures[1].recoveryFrom, predecessor);
});
