import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubResistantLearnerFinalHorizonPacket,
  createTutorStubResistantLearnerSemanticRuntime,
} from '../services/tutorStubResistantLearnerSemanticRuntime.js';
import {
  TUTOR_STUB_RESISTANT_LEARNER_BRIDGE_PICKUP_PROBE_JOB_IDS,
  buildTutorStubResistantLearnerBridgePickupProbePlan,
  executeTutorStubResistantLearnerBridgePickupProbe,
} from '../scripts/run-resistant-learner-bridge-pickup-probe.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIRECTORY = 'resistant-learner-bridge-smoke-2026-08-24';

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function makeWritable(target) {
  if (!fs.existsSync(target)) return;
  const stat = fs.lstatSync(target);
  if (!stat.isDirectory()) {
    fs.chmodSync(target, 0o644);
    return;
  }
  fs.chmodSync(target, 0o755);
  for (const name of fs.readdirSync(target)) makeWritable(path.join(target, name));
}

function buildReadonlyFixtureArchive(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'resistant-learner-pickup-probe-'));
  const archiveDir = path.join(temporary, 'archive');
  const sourceRoot = path.join(archiveDir, 'artifacts', 'tutor-stub-live', SOURCE_DIRECTORY);
  const sourceFiles = [];
  for (const jobId of TUTOR_STUB_RESISTANT_LEARNER_BRIDGE_PICKUP_PROBE_JOB_IDS) {
    const jobRoot = path.join(sourceRoot, 'jobs', jobId);
    const traceDirectory = path.join(jobRoot, 'traces');
    fs.mkdirSync(traceDirectory, { recursive: true });
    const transcriptPath = path.join(jobRoot, 'transcript.json');
    const tracePath = path.join(traceDirectory, 'sealed-trace.jsonl');
    const turns = Array.from({ length: 5 }, (_, index) => ({
      turn: index + 1,
      learner: `${jobId} learner public turn ${index + 1}`,
      tutor: `${jobId} tutor public turn ${index + 1}`,
    }));
    writeJson(transcriptPath, { turns });
    const finalLearnerText = `${jobId} final public bridge proposition grounded in the tutor-world record.`;
    const events = [
      { type: 'resistance_action_register_intervention_applied', jobId, turn: 1 },
      {
        type: 'resistance_action_register_outcome_learner_turn',
        jobId,
        turn: 6,
        learnerText: finalLearnerText,
        tutorReplyGenerated: false,
      },
      { type: 'resistant_learner_bridge_smoke_final_readers_skipped', jobId, turn: 6 },
    ];
    fs.writeFileSync(tracePath, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
    fs.chmodSync(transcriptPath, 0o444);
    fs.chmodSync(tracePath, 0o444);
    fs.chmodSync(traceDirectory, 0o555);
    fs.chmodSync(jobRoot, 0o555);
    sourceFiles.push(transcriptPath, tracePath);
  }
  fs.chmodSync(path.join(sourceRoot, 'jobs'), 0o555);
  fs.chmodSync(sourceRoot, 0o555);
  t.after(() => {
    makeWritable(temporary);
    fs.rmSync(temporary, { recursive: true, force: true });
  });
  return { archiveDir, sourceRoot, sourceFiles };
}

function fileSnapshot(files) {
  return Object.fromEntries(
    files.map((filePath) => {
      const content = fs.readFileSync(filePath);
      return [
        filePath,
        {
          sha256: crypto.createHash('sha256').update(content).digest('hex'),
          mode: fs.statSync(filePath).mode & 0o777,
          size: content.length,
        },
      ];
    }),
  );
}

function resolveReader(modelRef) {
  return modelRef === 'codex.gpt-5.6-sol'
    ? { provider: 'codex', model: 'gpt-5.6-sol' }
    : { provider: 'claude-code', model: 'claude-sonnet-5' };
}

function mockReaderBridge(calls) {
  return async (resolved, _systemPrompt, userPrompt, role, options) => {
    calls.push({ resolved, role, options });
    const prompt = JSON.parse(userPrompt);
    const quote = prompt.public_packet.post_5;
    return {
      text: JSON.stringify({
        schema: prompt.output_schema.properties.schema.enum[0],
        case_id: prompt.case_id,
        judgment: {
          learner_authored_tutor_or_bridge_pickup_within_five_turns: {
            value: 'yes',
            evidence_quotes: [{ source_id: 'post_5', text: quote }],
            confidence: 'high',
            indeterminacy_reason: 'none',
          },
          final_selective_attention_resistance_retained: {
            value: 'yes',
            evidence_quotes: [{ source_id: 'post_5', text: quote }],
            confidence: 'high',
            indeterminacy_reason: 'none',
          },
        },
      }),
      provider: resolved.provider,
      model: resolved.model,
      effort: options.effort,
      structuredOutput: true,
      prohibitedToolEventCount: 0,
      modelAttestationBasis: 'zero_call_mock_reader',
      modelIndependentlyAttested: false,
    };
  };
}

function assertNoForbiddenReportKeys(value) {
  if (Array.isArray(value)) {
    for (const row of value) assertNoForbiddenReportKeys(row);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!['verdict', 'pass', 'fail'].includes(key), `probe report must not contain ${key}`);
    assertNoForbiddenReportKeys(child);
  }
}

test('fixture packet bytes exactly match the calibration final-horizon packet', async (t) => {
  const fixture = buildReadonlyFixtureArchive(t);
  const built = buildTutorStubResistantLearnerBridgePickupProbePlan({ archiveDir: fixture.archiveDir, root: ROOT });
  const input = built.inputs[0];
  const directPacket = buildTutorStubResistantLearnerFinalHorizonPacket(input.state, input.finalLearnerText);
  assert.ok(input.packetBytes.equals(Buffer.from(JSON.stringify(directPacket))));

  const calibrationPrompts = [];
  const runtime = createTutorStubResistantLearnerSemanticRuntime({
    appendTraceEvent(target, event) {
      target.push(event);
    },
    async callPromptModel({ prompt }) {
      calibrationPrompts.push(JSON.parse(prompt));
      throw new Error('zero-call calibration prompt capture');
    },
    resolveModel: resolveReader,
  });
  await runtime.adjudicateFinalHorizon({
    state: { ...input.state, trace: [] },
    turnNumber: input.turnNumber,
    learnerText: input.finalLearnerText,
  });
  const calibrationPrimary = calibrationPrompts.find((prompt) => prompt.instrument === 'primary');
  assert.ok(calibrationPrimary);
  assert.equal(calibrationPrompts.filter((prompt) => prompt.instrument === 'primary').length, 2);
  assert.equal(calibrationPrompts.filter((prompt) => prompt.instrument === 'fidelity').length, 2);
  assert.ok(input.packetBytes.equals(Buffer.from(JSON.stringify(calibrationPrimary.public_packet))));
  assert.equal(calibrationPrimary.packet_sha256, input.packetSha256);
  assert.deepEqual(Object.keys(calibrationPrimary.public_packet), [
    'trigger',
    'intervention',
    'post_1',
    'tutor_1',
    'post_2',
    'tutor_2',
    'post_3',
    'tutor_3',
    'post_4',
    'tutor_4',
    'post_5',
  ]);
});

test('mock readers produce a descriptive both-agree report without mutating the read-only smoke root', async (t) => {
  const fixture = buildReadonlyFixtureArchive(t);
  const before = fileSnapshot(fixture.sourceFiles);
  const built = buildTutorStubResistantLearnerBridgePickupProbePlan({ archiveDir: fixture.archiveDir, root: ROOT });
  const calls = [];
  const report = await executeTutorStubResistantLearnerBridgePickupProbe({
    destination: built.destination,
    loaded: built.loaded,
    inputs: built.inputs,
    provenance: { commit: 'a'.repeat(40), tree: 'b'.repeat(40), dirty: false },
    callBridge: mockReaderBridge(calls),
    resolveModelRef: resolveReader,
  });

  assert.equal(calls.length, 6);
  assert.ok(calls.every((call) => call.role.includes('_B1_primary_reader_')));
  assert.ok(calls.every((call) => !call.role.includes('fidelity') && call.resolved.model !== 'gpt-5.6-luna'));
  assert.equal(report.model_calls, 6);
  assert.equal(report.dialogues_recorded, 3);
  assert.equal(report.execution_halt, null);
  assert.ok(report.dialogues.every((row) => row.reader_records.length === 2));
  assert.ok(
    report.dialogues.every(
      (row) =>
        row.field_agreement.learner_authored_tutor_or_bridge_pickup_within_five_turns.value === 'yes' &&
        row.field_agreement.learner_authored_tutor_or_bridge_pickup_within_five_turns.eligible_judges.length === 2,
    ),
  );
  assertNoForbiddenReportKeys(report);
  assert.deepEqual(fileSnapshot(fixture.sourceFiles), before);
  assert.equal(fs.existsSync(path.join(built.destination, 'approval.json')), false);
  assert.ok(fs.existsSync(path.join(built.destination, 'probe-report.json')));
  await assert.rejects(
    executeTutorStubResistantLearnerBridgePickupProbe({
      destination: built.destination,
      loaded: built.loaded,
      inputs: built.inputs,
    }),
    /create-once/iu,
  );
});

test('a reader transport error is attempted once and halts before the next seat or dialogue', async (t) => {
  const fixture = buildReadonlyFixtureArchive(t);
  const built = buildTutorStubResistantLearnerBridgePickupProbePlan({ archiveDir: fixture.archiveDir, root: ROOT });
  let calls = 0;
  const report = await executeTutorStubResistantLearnerBridgePickupProbe({
    destination: built.destination,
    loaded: built.loaded,
    inputs: built.inputs,
    callBridge: async () => {
      calls += 1;
      throw new Error('mock transport unavailable');
    },
    resolveModelRef: resolveReader,
  });
  assert.equal(calls, 1);
  assert.equal(report.model_calls, 1);
  assert.equal(report.dialogues_recorded, 1);
  assert.match(report.execution_halt.technical_issues[0], /mock transport unavailable/u);
});

test('dry-run prints all packet digests and performs zero model calls and zero writes', (t) => {
  const fixture = buildReadonlyFixtureArchive(t);
  const destination = path.join(
    fixture.archiveDir,
    'artifacts',
    'tutor-stub-live',
    'resistant-learner-bridge-smoke-2026-08-24-pickup-probe',
  );
  const result = spawnSync(process.execPath, ['scripts/run-resistant-learner-bridge-pickup-probe.js', '--dry-run'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, EVAL_ARCHIVE_DIR: fixture.archiveDir },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"planned_model_calls": 6/u);
  assert.match(result.stdout, /"hard_attempt_ceiling": 12/u);
  assert.match(result.stdout, /"model_calls_executed": 0/u);
  assert.match(result.stdout, /"production_writes": 0/u);
  assert.equal((result.stdout.match(/"packet_sha256"/gu) || []).length, 3);
  assert.equal(fs.existsSync(destination), false);
});
