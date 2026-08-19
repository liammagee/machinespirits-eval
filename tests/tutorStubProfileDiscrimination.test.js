import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readTutorStubApplicationSource } from './helpers/tutorStubSourceContract.js';
import { fileURLToPath } from 'node:url';

import { createTutorStubAutomatedLearnerGenerationRuntime } from '../services/tutorStubAutomatedLearnerGenerationRuntime.js';
import {
  learnerProfileContract,
  learnerProfileIds,
  learnerProfilePrompt,
} from '../scripts/tutor-stub-learner-profile-contracts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('automated-learner generation runtime owns profile resolution and corruption configuration', () => {
  const runtime = createTutorStubAutomatedLearnerGenerationRuntime({
    appendTraceEvent() {},
    callPromptModel() {
      throw new Error('not expected');
    },
    classificationFromCombinedAnalysis() {
      throw new Error('not expected');
    },
    env: { TUTOR_STUB_CORRUPT: '2:truncate' },
    extractCombinedLearnerAnalysis() {
      throw new Error('not expected');
    },
    learnerProfileContract() {
      throw new Error('not expected');
    },
    learnerProfileIds: () => ['diligent'],
    learnerProfilePrompt: (id) => `profile:${id}`,
    negativeFloorRegisters: [],
  });

  assert.equal(runtime.automatedLearnerProfileId('Diligent'), 'diligent');
  assert.equal(runtime.resolveAutomatedLearnerProfile('diligent'), 'profile:diligent');
  assert.equal(runtime.automatedLearnerCorruptionEnabled(2), true);
  assert.equal(runtime.automatedLearnerCorruptionEnabled(1), false);
});

test('entrypoint delegates automated learner generation rather than retaining local implementations', () => {
  const cliSource = readTutorStubApplicationSource();
  const runtimeSource = fs.readFileSync(
    path.join(ROOT, 'services', 'tutorStubAutomatedLearnerGenerationRuntime.js'),
    'utf8',
  );

  assert.match(cliSource, /createTutorStubAutomatedLearnerGenerationRuntime/u);
  assert.doesNotMatch(cliSource, /async function generateAutomatedLearnerTurn/u);
  assert.doesNotMatch(cliSource, /async function generateMixedLearnerArtifacts/u);
  assert.match(runtimeSource, /async function generateAutomatedLearnerTurn/u);
  assert.match(runtimeSource, /async function enforceAutomatedLearnerProfile/u);
});

test('runtime adherence accepts bored, frame-defiant, and frame-refuser public markers without repair calls', async () => {
  const cases = [
    {
      profile: 'bored',
      text: 'Sure. Whatever.',
      classification: {
        request_type: 'off_task_or_mixed',
        discourse_move: 'off_task',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
        agency: 'complying',
      },
    },
    {
      profile: 'frame_defiant',
      text: 'I reject the premise of this exercise. You do not get to set the question that way.',
      classification: {
        request_type: 'authority_refusal_or_status_challenge',
        discourse_move: 'challenge',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
        agency: 'steering',
      },
    },
    {
      profile: 'frame_refuser',
      text: 'I reject that test, and I will not answer inside it.',
      classification: {
        request_type: 'authority_refusal_or_status_challenge',
        discourse_move: 'challenge',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
        agency: 'steering',
      },
    },
  ];

  for (const row of cases) {
    const trace = [];
    let analysisCalls = 0;
    let repairCalls = 0;
    const runtime = createTutorStubAutomatedLearnerGenerationRuntime({
      appendTraceEvent: (target, event) => target.push(event),
      callPromptModel: async () => {
        repairCalls += 1;
        return { text: 'unexpected repair' };
      },
      classificationFromCombinedAnalysis: (raw) => raw.classification,
      env: {},
      extractCombinedLearnerAnalysis: async () => {
        analysisCalls += 1;
        return { classification: { turn: row.classification } };
      },
      learnerProfileContract,
      learnerProfileIds,
      learnerProfilePrompt,
      negativeFloorRegisters: [],
    });
    const state = {
      trace,
      turns: [],
      history: [],
      register: { policy: 'field' },
      classifier: { enabled: true },
      learnerDag: { enabled: true },
      world: {},
      interim: null,
    };

    const result = await runtime.enforceAutomatedLearnerProfile({
      state,
      resolved: {},
      profile: row.profile,
      turnNumber: 2,
      generated: { text: row.text },
    });

    assert.equal(result.passed, true, row.profile);
    assert.equal(result.repaired, false, row.profile);
    assert.equal(analysisCalls, 1, row.profile);
    assert.equal(repairCalls, 0, row.profile);
    assert.deepEqual(
      trace.filter((event) => event.type === 'auto_learner_profile_repair_requested'),
      [],
      row.profile,
    );
    assert.deepEqual(
      trace.find((event) => event.type === 'auto_learner_profile_adherence'),
      {
        type: 'auto_learner_profile_adherence',
        turn: 2,
        profile: row.profile,
        required: true,
        passed: true,
        repaired: false,
        repairAttempts: 0,
      },
      row.profile,
    );
  }
});

function turnEvent(
  turn,
  { request, move, evidence, stance, agency, affect, conceptual, epistemic, coverage, missing, learner = null },
) {
  return {
    ts: `2026-07-09T00:00:0${turn}.000Z`,
    runId: 'synthetic',
    seq: turn + 1,
    type: 'turn_complete',
    turn,
    turnRecord: {
      turn,
      learner: learner || `learner turn ${turn}`,
      tutor: `tutor turn ${turn}`,
      classification: {
        turn: {
          summary: `${move} with ${evidence}`,
          request_type: request,
          discourse_move: move,
          evidence_use: evidence,
          epistemic_stance: stance,
          affect,
          agency,
          scores: {
            conceptual_engagement: { score: conceptual },
            epistemic_readiness: { score: epistemic },
          },
          pedagogical_need: 'synthetic need',
        },
      },
      tutorLearnerDagModel: {
        assessment: {
          bestPathCoverage: coverage,
          missingPremiseCount: missing,
          bottleneck: missing ? 'learner_integration_gap' : 'grounded_asserted_secret',
        },
        metrics: {
          missingPremiseCount: missing,
          groundedCount: Math.round(coverage * 6),
        },
      },
      registerSelection: {
        policy: 'field',
        selected_register: turn % 2 ? 'precise' : 'warm',
        distribution: [
          { register: 'precise', probability: 0.6 },
          { register: 'warm', probability: 0.4 },
        ],
      },
    },
  };
}

function writeTrace(root, profile, turns) {
  const dir = path.join(root, profile, 'traces', 'field-r1');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'trace.jsonl');
  const events = [
    {
      ts: '2026-07-09T00:00:00.000Z',
      runId: 'synthetic',
      seq: 1,
      type: 'run_start',
      metadata: {
        world: { id: 'world_005_marrick' },
        modelRef: 'codex.gpt-5.5',
        resolved: { provider: 'codex', model: 'gpt-5.5' },
        classifier: { modelRef: 'codex.gpt-5.5', resolved: { provider: 'codex', model: 'gpt-5.5' } },
        autoLearner: { modelRef: 'codex.gpt-5.5', resolved: { provider: 'codex', model: 'gpt-5.5' } },
      },
    },
    ...turns,
  ];
  fs.writeFileSync(file, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
}

test('profile discrimination analyzer writes compacted traces and cosine report', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-profile-discrimination-'));
  try {
    writeTrace(tmp, 'diligent', [
      turnEvent(1, {
        request: 'conceptual_clarity_request',
        move: 'metacognitive_reflection',
        evidence: 'none',
        stance: 'reflective',
        agency: 'steering',
        affect: 'cautious',
        conceptual: 4,
        epistemic: 5,
        coverage: 0,
        missing: 6,
      }),
      turnEvent(2, {
        request: 'conceptual_clarity_request',
        move: 'inference',
        evidence: 'links_evidence_to_rule',
        stance: 'grounded',
        agency: 'attempting',
        affect: 'cautious',
        conceptual: 5,
        epistemic: 5,
        coverage: 0.33,
        missing: 4,
      }),
    ]);
    writeTrace(tmp, 'proof_skipper', [
      turnEvent(1, {
        request: 'stepwise_support_request',
        move: 'claim',
        evidence: 'overleaps_evidence',
        stance: 'overconfident',
        agency: 'attempting',
        affect: 'eager',
        conceptual: 3,
        epistemic: 2,
        coverage: 0,
        missing: 6,
      }),
      turnEvent(2, {
        request: 'stepwise_support_request',
        move: 'claim',
        evidence: 'overleaps_evidence',
        stance: 'overconfident',
        agency: 'attempting',
        affect: 'eager',
        conceptual: 3,
        epistemic: 2,
        coverage: 0.16,
        missing: 5,
      }),
    ]);

    const compactedDir = path.join(tmp, 'compacted');
    const report = JSON.parse(
      execFileSync(
        process.execPath,
        [
          'scripts/analyze-tutor-stub-profile-discrimination.js',
          '--trace-root',
          tmp,
          '--write-compacted',
          compactedDir,
          '--json',
        ],
        { cwd: ROOT, encoding: 'utf8' },
      ),
    );

    assert.equal(report.schema, 'machinespirits.tutor-stub.profile-discrimination.v4');
    assert.equal(report.summary.profiles, 2);
    assert.equal(report.summary.traces, 2);
    assert.deepEqual(report.summary.observedModels, {
      tutor: { 'codex.gpt-5.5': 2 },
      analysis: { 'codex.gpt-5.5': 2 },
      learner: { 'codex.gpt-5.5': 2 },
    });
    assert.equal(report.input.compactedWrites.length, 2);
    assert.ok(report.summary.averagePairwiseCosine < 0.5);
    assert.equal(report.gate.mode, 'contract_conditioned');
    assert.equal(report.gate.conditioned.profiles[0].profile, 'proof_skipper');
    assert.equal(report.profiles.find((profile) => profile.profile === 'proof_skipper').observability.observedRate, 1);

    const compactedFiles = fs.readdirSync(path.join(compactedDir, 'diligent'));
    assert.equal(compactedFiles.length, 1);
    const compacted = JSON.parse(fs.readFileSync(path.join(compactedDir, 'diligent', compactedFiles[0]), 'utf8'));
    assert.equal(compacted.schema, 'machinespirits.tutor-stub.compacted-trace.v2');
    assert.equal(compacted.run.profile, 'diligent');
    assert.equal(compacted.run.modelRef, 'codex.gpt-5.5');
    assert.equal(compacted.run.learnerModel, 'gpt-5.5');
    assert.equal(compacted.turns[0].classifier.discourseMove, 'metacognitive_reflection');
    assert.equal(compacted.turns[0].text, undefined);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('explicit false recollection plus an evidence overleap is observable without retaining transcript text', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-false-recollection-'));
  try {
    writeTrace(tmp, 'false_memory', [
      turnEvent(1, {
        request: 'conceptual_clarity_request',
        move: 'question',
        evidence: 'none',
        stance: 'exploratory',
        agency: 'attempting',
        affect: 'cautious',
        conceptual: 3,
        epistemic: 3,
        coverage: 0,
        missing: 6,
      }),
      turnEvent(2, {
        request: 'answer_seeking_or_overreach',
        move: 'claim',
        evidence: 'overleaps_evidence',
        stance: 'overconfident',
        agency: 'attempting',
        affect: 'confident',
        conceptual: 3,
        epistemic: 2,
        coverage: 0,
        missing: 6,
        learner: "We already saw that the die mark matched Verrell's graver, so the shillings are his work.",
      }),
    ]);

    const compactedDir = path.join(tmp, 'compacted');
    const report = JSON.parse(
      execFileSync(
        process.execPath,
        [
          'scripts/analyze-tutor-stub-profile-discrimination.js',
          '--trace-root',
          tmp,
          '--write-compacted',
          compactedDir,
          '--json',
        ],
        { cwd: ROOT, encoding: 'utf8' },
      ),
    );

    const profile = report.profiles.find((row) => row.profile === 'false_memory');
    assert.equal(profile.observability.runsMeetingDeadline, 1);
    assert.equal(profile.observability.deadlinePass, true);
    const compactedFile = fs.readdirSync(path.join(compactedDir, 'false_memory'))[0];
    const compacted = JSON.parse(fs.readFileSync(path.join(compactedDir, 'false_memory', compactedFile), 'utf8'));
    assert.equal(compacted.turns[1].markers.explicitRecollection, true);
    assert.equal(compacted.turns[1].text, undefined);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('bored, frame-defiant, and frame-refuser public markers survive behavior-only compaction', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-resistant-profile-markers-'));
  try {
    writeTrace(tmp, 'bored', [
      turnEvent(1, {
        request: 'off_task_or_mixed',
        move: 'off_task',
        evidence: 'none',
        stance: 'resistant',
        agency: 'complying',
        affect: 'flat',
        conceptual: 2,
        epistemic: 2,
        coverage: 0,
        missing: 6,
        learner: 'Sure. Whatever.',
      }),
    ]);
    writeTrace(tmp, 'frame_defiant', [
      turnEvent(1, {
        request: 'authority_refusal_or_status_challenge',
        move: 'challenge',
        evidence: 'none',
        stance: 'resistant',
        agency: 'steering',
        affect: 'controlled',
        conceptual: 3,
        epistemic: 3,
        coverage: 0,
        missing: 6,
        learner: 'I reject the premise of this exercise.',
      }),
    ]);
    writeTrace(tmp, 'frame_refuser', [
      turnEvent(1, {
        request: 'authority_refusal_or_status_challenge',
        move: 'challenge',
        evidence: 'none',
        stance: 'resistant',
        agency: 'steering',
        affect: 'controlled',
        conceptual: 2,
        epistemic: 2,
        coverage: 0,
        missing: 6,
        learner: 'I reject that test, and I will not answer inside it.',
      }),
    ]);

    const compactedDir = path.join(tmp, 'compacted');
    const report = JSON.parse(
      execFileSync(
        process.execPath,
        [
          'scripts/analyze-tutor-stub-profile-discrimination.js',
          '--trace-root',
          tmp,
          '--write-compacted',
          compactedDir,
          '--json',
        ],
        { cwd: ROOT, encoding: 'utf8' },
      ),
    );

    const bored = report.profiles.find((row) => row.profile === 'bored');
    const defiant = report.profiles.find((row) => row.profile === 'frame_defiant');
    const refuser = report.profiles.find((row) => row.profile === 'frame_refuser');
    assert.equal(bored.observability.observedRate, 1);
    assert.equal(bored.observability.deadlinePass, true);
    assert.equal(defiant.observability.observedRate, 1);
    assert.equal(defiant.observability.deadlinePass, true);
    assert.equal(refuser.observability.observedRate, 1);
    assert.equal(refuser.observability.deadlinePass, true);

    const boredCompacted = JSON.parse(
      fs.readFileSync(path.join(compactedDir, 'bored', fs.readdirSync(path.join(compactedDir, 'bored'))[0]), 'utf8'),
    );
    const defiantCompacted = JSON.parse(
      fs.readFileSync(
        path.join(compactedDir, 'frame_defiant', fs.readdirSync(path.join(compactedDir, 'frame_defiant'))[0]),
        'utf8',
      ),
    );
    const refuserCompacted = JSON.parse(
      fs.readFileSync(
        path.join(compactedDir, 'frame_refuser', fs.readdirSync(path.join(compactedDir, 'frame_refuser'))[0]),
        'utf8',
      ),
    );
    assert.equal(boredCompacted.turns[0].markers.boredWithholding, true);
    assert.equal(defiantCompacted.turns[0].markers.frameJurisdictionDispute, true);
    assert.equal(refuserCompacted.turns[0].markers.frameJurisdictionRefusal, true);
    assert.equal(boredCompacted.turns[0].text, undefined);
    assert.equal(defiantCompacted.turns[0].text, undefined);
    assert.equal(refuserCompacted.turns[0].text, undefined);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
