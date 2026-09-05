import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { execFileSync } from 'node:child_process';
import {
  loadReplayDesign,
  randomizeReplayUnits,
  selectReplayUnits,
  buildReplayRequest,
  parseReplayResponse,
  classifyReplayResponse,
  summarizeReplay,
  consensus,
  readEvents,
  readJson,
  worstCost,
  writeOnce,
} from '../services/superegoCritiqueCausalReplay.js';
import {
  executeReplay,
  checkReplayBudget,
  loadRecoveryResponses,
  main,
} from '../scripts/run-superego-critique-causal-replay.js';
import { admitPaidStudyLaunch } from '../services/paidStudyLaunchContract.js';
import { createDurablePaidModelAttemptBudget } from '../services/durablePaidModelAttemptBudget.js';
import {
  buildCalibrationPlan,
  calibrationCoderPackets,
  summarizeCalibration,
} from '../services/superegoCritiqueMeasurementCalibration.js';

const realDesign = loadReplayDesign(process.cwd());
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'superego-replay-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const design = structuredClone(realDesign);
  design.id = 'superego-replay-test';
  design.sample_size = 2;
  design.attempts = {
    generation_planned: 6,
    semantic_planned: 16,
    quality_planned: 16,
    generation_reserve: 2,
    semantic_reserve: 2,
    quality_reserve: 2,
    total_planned: 38,
    recovery_reserve: 6,
    hard_ceiling: 44,
  };
  const units = [1, 2].map((i) => ({
    id: `check${i}`,
    dialogue_id: `dialogue${i}`,
    profile: `hidden_profile_${i}`,
    scenario: 'shared_scenario',
    stratum: 'shared',
    context: 'The learner needs orientation.',
    draft: [
      {
        type: 'lecture',
        priority: 'high',
        title: `Start ${i}`,
        message: `Hello learner ${i}`,
        actionType: 'navigate',
        actionTarget: `lecture${i}`,
      },
    ],
    critique: {
      feedback: `Ask question ${i}`,
      approved: false,
      suggestedChanges: { text: `Ask question ${i}` },
      interventionType: 'revise',
    },
  }));
  const plan = { study_id: design.id, seed: design.master_seed, ...randomizeReplayUnits(units, design.master_seed) };
  fs.mkdirSync(path.join(root, 'notes'));
  fs.writeFileSync(
    path.join(root, 'notes/superego-critique-causal-replay-design.md'),
    `# Offline test fixture\n\n\`\`\`yaml study\n${JSON.stringify(design)}\n\`\`\`\n`,
  );
  fs.writeFileSync(
    path.join(root, 'notes/test-go.md'),
    `GO\nOffline test fixture only; no real authority.\nnotes/superego-critique-causal-replay-design.md\n${design.attempts.hard_ceiling} attempts; $300\n`,
  );
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'Offline Test');
  git('config', 'user.email', 'test@example.invalid');
  git('add', 'notes');
  git('commit', '-m', 'Offline test fixtures');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  const options = {
    root,
    design,
    plan,
    destination: path.join(root, 'initial'),
    studyStateRoot: path.join(root, 'study-state'),
    goNotePath: 'notes/test-go.md',
    goNoteCommit: git('rev-parse', 'HEAD'),
    signalTarget: new EventEmitter(),
  };
  return { root, design, plan, options };
}
function response(design, request, { refusal = false, malformed = false } = {}) {
  const p = JSON.parse(request.messages[1].content);
  let output;
  if (p.reference_critique)
    output = {
      directive_fulfillment: 'none',
      material_change: 'surface_only',
      critique_spans: [p.reference_critique.feedback],
      candidate_spans: [],
      rationale: 'No requested question appears.',
    };
  else if (p.output)
    output = {
      quality: 5,
      accuracy: 'not_applicable',
      evidence_spans: [p.output[0].message],
      rationale: 'Adequate public orientation.',
    };
  else output = { suggestions: p.draft.map((s) => ({ ...s, message: `${s.message}. Welcome.` })) };
  const route = Object.values(design.models).find((r) => r.model === request.model);
  return {
    status: 200,
    body: JSON.stringify({
      model: request.model,
      provider: route.provider,
      usage: { prompt_tokens: 1000, completion_tokens: 100, cost: 0.00001 },
      choices: [
        {
          finish_reason: 'stop',
          message: { content: malformed ? 'oops' : JSON.stringify(output), refusal: refusal ? 'No' : null },
        },
      ],
    }),
  };
}

function jsonModeRejection() {
  return {
    status: 405,
    body: JSON.stringify({
      error: {
        code: 405,
        message: 'Provider returned error',
        metadata: {
          provider_name: 'DeepInfra',
          raw: JSON.stringify({
            error: {
              message: 'json_object response format is not supported for model: nvidia/Nemotron-3-Nano-30B-A3B',
              type: 'invalid_request_error',
              param: 'response_format',
              code: null,
            },
          }),
        },
      },
    }),
  };
}

// Reproduce the old runner's one rejected request with the real shared journal.
// These are temporary offline fixtures, never the historical study artifacts.
function sealedLegacyJsonRejection({ options, design, plan }, changeRequest = () => {}) {
  const admission = admitPaidStudyLaunch({
    ...options,
    designPath: 'notes/superego-critique-causal-replay-design.md',
    studyId: design.id,
    spendCap: design.attempts.hard_ceiling,
  });
  const budget = createDurablePaidModelAttemptBudget({ admission, limit: design.attempts.hard_ceiling });
  const job = plan.jobs[0];
  const request = { ...buildReplayRequest(design, plan, job, new Map()), response_format: { type: 'json_object' } };
  changeRequest(request);
  writeOnce(path.join(options.destination, 'plan.json'), plan);
  writeOnce(path.join(options.destination, 'settings.json'), {
    seed: design.master_seed,
    models: design.models,
    request: design.request,
    attempts: design.attempts,
    max_dollars: design.max_dollars,
    primary: design.primary,
    arms: design.arms,
    endpoint: design.endpoint,
  });
  const reservation = budget.reserve({
    unitId: job.id,
    role: job.seat,
    category: job.category,
    max_cost_dollars: worstCost(design, job.seat),
  });
  writeOnce(path.join(options.destination, 'requests/1.json'), request);
  budget.markDispatched();
  const responsePath = path.join(options.destination, 'responses/1.json');
  writeOnce(responsePath, { attempt_id: reservation.attemptId, job, request, raw: jsonModeRejection() });
  budget.persistResponse(responsePath);
  budget.complete();
  admission.close({
    type: 'run_sealed',
    status: 'technical_failure',
    recovery_permitted: false,
    completed_jobs: 0,
    missing_jobs: plan.jobs.length,
  });
}

test('frozen eligibility ignores historical outcomes and removes entire calibration dialogues', () => {
  const draft = {
    agent: 'ego',
    action: 'generate',
    suggestions: [
      {
        type: 'lecture',
        priority: 'high',
        title: 'Hello',
        message: 'Hello',
        actionType: 'navigate',
        actionTarget: 'one',
      },
    ],
  };
  const traces = new Map([
    [
      'd1',
      {
        dialogueTrace: [
          { agent: 'user', action: 'context_input', rawContext: 'Old context' },
          draft,
          { feedback: 'Ask a question' },
        ],
      },
    ],
    [
      'd2',
      {
        dialogueTrace: [{ agent: 'tutor', action: 'context_input', rawContext: 'Context' }, draft, { feedback: 'Ask' }],
      },
    ],
  ]);
  const rows = ['d1', 'd2'].map((d) => ({
    checkId: d,
    dialogueId: d,
    ordinal: 1,
    traceIndexes: { draft: 1, critique: 2 },
    profileName: 'p',
    scenarioId: 's',
    egoModel: 'e',
    superegoModel: 'c',
    uptakeScore: 999,
  }));
  const a = selectReplayUnits(rows, traces, new Set(['d2']));
  rows[0].uptakeScore = -999;
  rows[0].fdrQ = 0;
  rows[0].outcome = 'positive';
  assert.deepEqual(selectReplayUnits(rows, traces, new Set(['d2'])), a);
  assert.equal(a.units.length, 1);
  assert.equal(a.exclusions.calibration_dialogue, 1);
  assert.equal(a.units[0].context, 'Old context');
});

test('randomization is reproducible, one-to-one, and refuses identical donor drafts', (t) => {
  const { plan } = fixture(t);
  const units = plan.units.map(({ unit_key: _key, arm_order: _arms, donor_id: _donor, ...u }) => u);
  assert.deepEqual(randomizeReplayUnits(units, plan.seed), randomizeReplayUnits([...units].reverse(), plan.seed));
  assert.equal(new Set(plan.units.map((u) => u.donor_id)).size, 2);
  assert.ok(plan.units.every((u) => u.donor_id !== u.id));
  units[1].draft = units[0].draft;
  assert.throws(() => randomizeReplayUnits(units, plan.seed), /derangement/);
});

test('requests separate treatment, common semantic target, and blind quality; pin transport', (t) => {
  const { design, plan } = fixture(t);
  const outputs = new Map();
  for (const job of plan.jobs.filter((j) => j.category === 'generation'))
    outputs.set(job.id, { suggestions: plan.units.find((u) => u.unit_key === job.unit).draft });
  for (const job of plan.jobs) {
    const request = buildReplayRequest(design, plan, job, outputs);
    const p = JSON.parse(request.messages[1].content);
    const unit = plan.units.find((u) => u.unit_key === job.unit);
    assert.equal(request.temperature, 0);
    assert.equal(request.provider.allow_fallbacks, false);
    assert.equal(request.provider.require_parameters, true);
    assert.equal(request.provider.max_price.request, 0);
    if (job.category === 'generation') assert.equal(Object.hasOwn(request, 'response_format'), false);
    else assert.deepEqual(request.response_format, { type: 'json_object' });
    assert.equal(JSON.stringify(p).includes('hidden_profile'), false);
    assert.equal(Object.hasOwn(p, 'arm'), false);
    if (job.category === 'quality') assert.deepEqual(Object.keys(p).sort(), ['context', 'item_id', 'output']);
    if (job.category === 'semantic') assert.deepEqual(p.reference_critique, unit.critique);
    if (job.arm === 'matched_wrong_critique' && job.category === 'generation')
      assert.notDeepEqual(p.critique, unit.critique);
    if (job.arm === 'generic_revision' && job.category === 'generation')
      assert.equal(Object.hasOwn(p, 'critique'), false);
  }
  const oversized = structuredClone(plan);
  oversized.units[0].context = 'x'.repeat(20000);
  assert.throws(
    () =>
      buildReplayRequest(
        design,
        oversized,
        plan.jobs.find((j) => j.unit === oversized.units[0].unit_key),
        outputs,
      ),
    /byte ceiling/,
  );
});

test('budget checks reject total, category, dollar and repeated-job overages before dispatch', (t) => {
  const { design, plan } = fixture(t);
  const job = plan.jobs[0];
  const event = {
    type: 'study_model_attempt_dispatch_reserved',
    unit_id: job.id,
    category: 'generation',
    max_cost_dollars: 0.001,
  };
  assert.throws(() => checkReplayBudget(design, job, Array(44).fill(event)), /Hard attempt/);
  assert.throws(() => checkReplayBudget(design, job, Array(8).fill(event)), /Category/);
  assert.throws(() => checkReplayBudget(design, job, [event, event]), /one replacement/);
  assert.throws(
    () => checkReplayBudget(design, job, [{ ...event, unit_id: 'different', max_cost_dollars: 300 }]),
    /Dollar/,
  );
  assert.throws(() => checkReplayBudget(design, job, [{ ...event, max_cost_dollars: undefined }]), /Unaccountable/);
  assert.ok(worstCost(design, 'semantic_b') > worstCost(design, 'generator'));
});

test('semantic evidence is checked but disagreement never becomes zero or a tie-break', (t) => {
  const { design, plan } = fixture(t);
  const outputs = new Map();
  for (const job of plan.jobs) {
    if (job.category === 'generation')
      outputs.set(job.id, { suggestions: plan.units.find((u) => u.unit_key === job.unit).draft });
    else if (job.category === 'semantic')
      outputs.set(job.id, { directive_fulfillment: 'full', material_change: 'action_only' });
    else outputs.set(job.id, { quality: 7, accuracy: 'not_applicable' });
  }
  assert.equal(consensus('full', 'partial'), 'measurement_indeterminate');
  const job = plan.jobs.find((j) => j.category === 'semantic');
  const request = buildReplayRequest(design, plan, job, outputs);
  const raw = response(design, request);
  const envelope = JSON.parse(raw.body);
  const value = JSON.parse(envelope.choices[0].message.content);
  value.critique_spans = ['invented quotation'];
  envelope.choices[0].message.content = JSON.stringify(value);
  assert.throws(
    () => parseReplayResponse(design, request, job, { ...raw, body: JSON.stringify(envelope) }),
    /evidence/,
  );
  const first = plan.units[0].unit_key;
  outputs.set(`${first}/actual_critique/semantic_b`, { directive_fulfillment: 'partial', material_change: 'none' });
  const report = summarizeReplay(design, plan, outputs);
  assert.equal(report.primary.decision, 'measurement_indeterminate');
  assert.equal(report.primary.denominator, 2);
  assert.equal(report.primary.confidence_interval, null);
  assert.deepEqual(report.primary.identification_bounds, [-0.5, 0]);
  outputs.delete(`${first}/actual_critique/semantic_b`);
  assert.equal(summarizeReplay(design, plan, outputs).primary.decision, 'incomplete_technical');
});

test('end-to-end offline run uses shared admission, durable attempts, and create-once destination', async (t) => {
  const { options, design, plan } = fixture(t);
  let calls = 0;
  const dispatch = async (_url, request) => {
    calls++;
    return response(design, request);
  };
  const result = await executeReplay({ ...options, dispatch });
  assert.equal(calls, 38);
  assert.equal(result.report.completed_jobs, 38);
  assert.equal(readJson(path.join(options.destination, 'workflow-status.json')).current_phase, 'HANDOFF_PENDING');
  const events = readEvents(path.join(options.destination, 'run-ledger.jsonl'));
  assert.equal(events.filter((e) => e.type === 'model_attempt_dispatch_reserved').length, 38);
  assert.equal(events.filter((e) => e.type === 'attempt_completed').length, 38);
  assert.equal(events.at(-1).type, 'run_sealed');
  assert.equal(plan.jobs.filter((j) => j.category === 'generation').length, 6);
  await assert.rejects(executeReplay({ ...options, dispatch }), /create-once/);
  assert.equal(calls, 38);
});

test('technical recovery keeps all valid jobs and charges the failed attempt across fresh segments', async (t) => {
  const { options, root, design } = fixture(t);
  let firstCalls = 0;
  await assert.rejects(
    executeReplay({
      ...options,
      dispatch: async (_url, request) => {
        firstCalls++;
        if (firstCalls === 3) {
          const e = new Error('network timeout');
          e.recoverable = true;
          throw e;
        }
        return response(design, request);
      },
    }),
    /timeout/,
  );
  const before = fs.readFileSync(path.join(options.destination, 'run-ledger.jsonl'), 'utf8');
  let recoveryCalls = 0;
  const result = await executeReplay({
    ...options,
    destination: path.join(root, 'recovery'),
    recoveryFrom: options.destination,
    dispatch: async (_url, request) => {
      recoveryCalls++;
      return response(design, request);
    },
  });
  assert.equal(firstCalls, 3);
  assert.equal(recoveryCalls, 36);
  assert.equal(result.report.completed_jobs, 38);
  assert.equal(fs.readFileSync(path.join(options.destination, 'run-ledger.jsonl'), 'utf8'), before);
  const events = readEvents(path.join(root, 'recovery/run-ledger.jsonl'));
  assert.equal(events.at(-1).missing_jobs, 0);
  assert.equal(events.find((e) => e.type === 'model_attempt_dispatch_reserved').study_reserved, 4);
});

test('repaired JSON transport recovers the first rejected request without altering evidence or resetting caps', async (t) => {
  const value = fixture(t);
  const { options, root, design, plan } = value;
  sealedLegacyJsonRejection(value);
  const files = ['run-ledger.jsonl', 'requests/1.json', 'responses/1.json', 'plan.json', 'settings.json'];
  const before = files.map((name) => fs.readFileSync(path.join(options.destination, name)));
  const { response_format: _old, ...expected } = readJson(path.join(options.destination, 'requests/1.json'));
  let calls = 0;
  const destination = path.join(root, 'repaired');
  const result = await executeReplay({
    ...options,
    destination,
    recoveryFrom: options.destination,
    dispatch: async (_url, request) => {
      if (calls++ === 0) assert.deepEqual(request, expected);
      return response(design, request);
    },
  });
  assert.equal(calls, plan.jobs.length);
  assert.equal(result.report.completed_jobs, plan.jobs.length);
  files.forEach((name, i) => assert.deepEqual(fs.readFileSync(path.join(options.destination, name)), before[i]));
  const events = readEvents(path.join(destination, 'run-ledger.jsonl'));
  assert.equal(events.find((e) => e.type === 'model_attempt_dispatch_reserved').study_reserved, 2);
  const shared = readEvents(path.join(options.studyStateRoot, design.id, 'study-ledger.jsonl'));
  assert.equal(shared.filter((e) => e.type === 'study_model_attempt_dispatch_reserved').length, plan.jobs.length + 1);
});

test('JSON-mode repair cannot change prompt, decoding, provider or token cap', async (t) => {
  const changes = [
    (request) => {
      request.messages[0].content += ' Different instruction.';
    },
    (request) => {
      request.temperature = 0.5;
    },
    (request) => {
      request.provider.only = ['different'];
    },
    (request) => {
      request.max_tokens += 1;
    },
  ];
  for (const change of changes) {
    const value = fixture(t);
    sealedLegacyJsonRejection(value, change);
    let calls = 0;
    await assert.rejects(
      executeReplay({
        ...value.options,
        destination: path.join(value.root, 'bad-repair'),
        recoveryFrom: value.options.destination,
        dispatch: async () => {
          calls++;
        },
      }),
      /Saved request exceeds registered scope/,
    );
    assert.equal(calls, 0);
  }
});

test('repeated JSON-mode rejection cannot admit a third attempt', async (t) => {
  const value = fixture(t);
  sealedLegacyJsonRejection(value);
  const destination = path.join(value.root, 'failed-repair');
  let calls = 0;
  const dispatch = async () => {
    calls++;
    return jsonModeRejection();
  };
  await assert.rejects(
    executeReplay({ ...value.options, destination, recoveryFrom: value.options.destination, dispatch }),
    /Substantive failure/,
  );
  await assert.rejects(
    executeReplay({
      ...value.options,
      destination: path.join(value.root, 'third'),
      recoveryFrom: destination,
      dispatch,
    }),
    /Substantive failure|sealed technical predecessor/,
  );
  assert.equal(calls, 1);
  assert.throws(
    () =>
      admitPaidStudyLaunch({
        ...value.options,
        designPath: 'notes/superego-critique-causal-replay-design.md',
        studyId: value.design.id,
        spendCap: value.design.attempts.hard_ceiling,
        destination: path.join(value.root, 'third-admission'),
        recoveryFrom: destination,
      }),
    /sealed technical predecessor/,
  );
});

for (const faultAt of ['after_reservation', 'after_response_write', 'after_response_persisted']) {
  test(`recovery handles ${faultAt} without choosing or regenerating a durable response`, async (t) => {
    const { options, root, design } = fixture(t);
    let calls = 0;
    const dispatch = async (_url, request) => {
      calls++;
      return response(design, request);
    };
    await assert.rejects(executeReplay({ ...options, dispatch, faultAt }), /Injected fault/);
    await executeReplay({
      ...options,
      destination: path.join(root, 'recovery'),
      recoveryFrom: options.destination,
      dispatch,
    });
    assert.equal(calls, 38);
    const prior = readEvents(path.join(options.destination, 'run-ledger.jsonl'));
    assert.equal(
      prior.filter((e) => e.type.startsWith('attempt_') && /completed|failed|cancelled/.test(e.type)).length,
      1,
    );
  });
}

test('substantive response failure cannot be recovered or resampled', async (t) => {
  const { options, root, design } = fixture(t);
  let calls = 0;
  const dispatch = async (_url, request) => {
    calls++;
    return response(design, request, { malformed: true });
  };
  await assert.rejects(executeReplay({ ...options, dispatch }), /invalid structured output/);
  await assert.rejects(
    executeReplay({ ...options, dispatch, destination: path.join(root, 'retry'), recoveryFrom: options.destination }),
    /invalid structured output/,
  );
  assert.equal(calls, 1);
});

test('second technical failure ends recovery authority without a third call', async (t) => {
  const { options, root } = fixture(t);
  let calls = 0;
  const dispatch = async () => {
    calls++;
    const e = new Error('network failure');
    e.recoverable = true;
    throw e;
  };
  await assert.rejects(executeReplay({ ...options, dispatch }), /network/);
  const recovery = path.join(root, 'recovery');
  await assert.rejects(
    executeReplay({ ...options, destination: recovery, recoveryFrom: options.destination, dispatch }),
    /network/,
  );
  await assert.rejects(
    executeReplay({ ...options, destination: path.join(root, 'third'), recoveryFrom: recovery, dispatch }),
    /sealed technical predecessor/,
  );
  assert.equal(calls, 2);
});

test('operator pause resumes at next job; GO without explicit paid CLI flags dispatches nothing', async (t) => {
  const { options, root, design } = fixture(t);
  let calls = 0;
  const paused = await executeReplay({
    ...options,
    dispatch: async (_url, request) => {
      calls++;
      options.signalTarget.emit('SIGINT');
      return response(design, request);
    },
  });
  assert.equal(paused.status, 'paused_recoverable');
  assert.equal(calls, 1);
  await executeReplay({
    ...options,
    destination: path.join(root, 'resume'),
    recoveryFrom: options.destination,
    dispatch: async (_url, request) => {
      calls++;
      return response(design, request);
    },
  });
  assert.equal(calls, 38);
  await assert.rejects(
    main(['--launch', '--output', path.join(root, 'forbidden')], {
      root,
      preparePlan: () => {
        throw new Error('Should not prepare or dispatch');
      },
    }),
    /launch authority/,
  );
});

test('response validation separates response-free HTTP errors from refusal, truncation, drift and false evidence', (t) => {
  const { design, plan } = fixture(t);
  const job = plan.jobs[0];
  const request = buildReplayRequest(design, plan, job, new Map());
  assert.throws(
    () => parseReplayResponse(design, request, job, { status: 503, body: '<html>unavailable</html>' }),
    (e) => e.recoverable === true,
  );
  assert.throws(
    () => parseReplayResponse(design, request, job, response(design, request, { refusal: true })),
    /refusal/,
  );
  for (const mutate of [
    (x) => {
      x.provider = 'different';
    },
    (x) => {
      x.choices[0].finish_reason = 'length';
    },
    (x) => {
      x.usage.prompt_tokens = 100000;
    },
  ]) {
    const raw = response(design, request);
    const body = JSON.parse(raw.body);
    mutate(body);
    assert.throws(() => parseReplayResponse(design, request, job, { ...raw, body: JSON.stringify(body) }));
  }
  const outputs = new Map(
    plan.jobs
      .filter((j) => j.category === 'generation')
      .map((j) => [j.id, { suggestions: plan.units.find((u) => u.unit_key === j.unit).draft }]),
  );
  const semantic = plan.jobs.find((j) => j.category === 'semantic');
  const semanticRequest = buildReplayRequest(design, plan, semantic, outputs);
  const raw = response(design, semanticRequest);
  const body = JSON.parse(raw.body);
  const parsed = JSON.parse(body.choices[0].message.content);
  parsed.material_change = 'action_only';
  parsed.candidate_spans = [];
  body.choices[0].message.content = JSON.stringify(parsed);
  assert.throws(
    () => parseReplayResponse(design, semanticRequest, semantic, { ...raw, body: JSON.stringify(body) }),
    /evidence/,
  );
});

test('quality N/A stays separate from disagreement and primary threshold uses paired outcomes', (t) => {
  const { design, plan } = fixture(t);
  const responses = new Map(
    plan.jobs.map((job) => [
      job.id,
      job.category === 'generation'
        ? { suggestions: plan.units[0].draft }
        : job.category === 'quality'
          ? { quality: 5, accuracy: 'not_applicable' }
          : { directive_fulfillment: job.arm === 'actual_critique' ? 'full' : 'none', material_change: 'none' },
    ]),
  );
  const report = summarizeReplay(design, plan, responses);
  assert.equal(report.primary.decision, 'threshold_met');
  assert.equal(report.primary.confidence_interval.estimate, 1);
  assert.equal(report.contrasts.actual_critique_minus_generic_revision.accuracy.not_applicable_pairs, 2);
  assert.equal(report.contrasts.actual_critique_minus_generic_revision.accuracy.indeterminate_pairs, 0);
  assert.equal(report.by_arm.actual_critique.directive_fulfillment.full, 2);
});

test('actual runner stops at the dollar ceiling before reservation or transport', async (t) => {
  const { options } = fixture(t);
  let calls = 0;
  options.design.max_dollars = 0;
  await assert.rejects(
    executeReplay({
      ...options,
      dispatch: async () => {
        calls++;
        throw new Error('unreachable');
      },
    }),
    /Dollar ceiling/,
  );
  assert.equal(calls, 0);
  assert.equal(
    readEvents(path.join(options.destination, 'run-ledger.jsonl')).filter(
      (e) => e.type === 'model_attempt_dispatch_reserved',
    ).length,
    0,
  );
});

test('prepare CLI is zero-call and refuses to overwrite its destination', async (t) => {
  const { root, design, plan } = fixture(t);
  let calls = 0;
  const output = path.join(root, 'prepared');
  const options = {
    root,
    preparePlan: async () => ({ design, plan }),
    dispatch: async () => {
      calls++;
    },
  };
  await main(['--prepare', '--output', output], options);
  assert.equal(calls, 0);
  assert.equal(readJson(path.join(output, 'audit.json')).hard_ceiling, 0);
  await assert.rejects(main(['--prepare', '--output', output], options), /EEXIST/);
});

function calibrationFixture(t) {
  const original = fixture(t);
  const design = {
    ...structuredClone(original.design),
    mode: 'calibration',
    primary: null,
    arms: ['historical_revision'],
    max_dollars: 15,
  };
  design.request.max_message_bytes = 65536;
  design.historical_model_routes = {
    'historical-generator': 'example/generator',
    'historical-critic': 'example/critic',
  };
  design.attempts = {
    generation_planned: 0,
    semantic_planned: 4,
    quality_planned: 4,
    generation_reserve: 0,
    semantic_reserve: 2,
    quality_reserve: 2,
    total_planned: 8,
    recovery_reserve: 4,
    hard_ceiling: 12,
  };
  const traceMap = new Map(
    original.plan.units.map((u) => [
      u.dialogue_id,
      {
        dialogueTrace: [
          { agent: 'tutor', action: 'context_input', rawContext: u.context },
          { suggestions: u.draft },
          u.critique,
          { suggestions: [...u.draft, { ...u.draft[0], message: 'An additional public suggestion.' }] },
        ],
      },
    ]),
  );
  const packet = {
    identityLedger: {
      rows: original.plan.units.map((u, i) => ({
        item_id: `item${i}`,
        dialogue_id: u.dialogue_id,
        ordinal: i + 1,
        trace_indexes: { draft: 1, critique: 2, revision: 3 },
        ego_model: 'historical-generator',
        superego_model: 'historical-critic',
      })),
    },
  };
  const plan = buildCalibrationPlan(design, packet, traceMap);
  // Offline fixtures carry their own matching attempt cap; this is not a user GO.
  fs.appendFileSync(
    path.join(original.root, 'notes/superego-critique-causal-replay-design.md'),
    `\n\`\`\`yaml calibration\n${JSON.stringify(design)}\n\`\`\`\n`,
  );
  fs.writeFileSync(
    path.join(original.root, 'notes/test-go.md'),
    'GO\nOffline test fixture only; no real authority.\nnotes/superego-critique-causal-replay-design.md\n12 attempts; $15\n',
  );
  execFileSync('git', ['add', 'notes'], { cwd: original.root });
  execFileSync('git', ['commit', '-m', 'Offline calibration fixture'], { cwd: original.root, stdio: 'pipe' });
  const goNoteCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: original.root, encoding: 'utf8' }).trim();
  const options = { ...original.options, design, plan, goNoteCommit };
  return { ...original, design, plan, options, traceMap, packet };
}

test('calibration retains identities, complete context and suggestions with separate blinded readers', (t) => {
  const { design, plan, packet, traceMap } = calibrationFixture(t);
  const original = JSON.stringify(packet);
  assert.deepEqual(buildCalibrationPlan(design, packet, traceMap), plan);
  assert.equal(plan.jobs.length, 8);
  assert.equal(plan.jobs.filter((job) => job.category === 'generation').length, 0);
  assert.equal(plan.units[0].revision.length, 2);
  const packets = calibrationCoderPackets(design, plan);
  for (const [seat, p] of Object.entries(packets)) {
    assert.equal(p.rows.length, 2);
    for (const row of p.rows) {
      assert.equal(row.coding.rationale, null);
      assert.equal(row.data.source, undefined);
      assert.equal(row.data.profile, undefined);
      assert.equal(row.data.ordinal, undefined);
      if (seat.startsWith('quality')) {
        assert.deepEqual(Object.keys(row.data), ['item_id', 'context', 'output']);
        assert.equal(row.data.output.length, 2);
      } else {
        assert.equal(row.data.candidate.length, 2);
        assert.equal(row.data.draft.length, 1);
      }
    }
  }
  assert.equal(JSON.stringify(packet), original);
  const conflicting = structuredClone(design);
  conflicting.historical_model_routes['historical-critic'] = design.models.semantic_a.model;
  assert.throws(() => buildCalibrationPlan(conflicting, packet, traceMap), /judge overlaps/);
  delete conflicting.historical_model_routes['historical-critic'];
  assert.throws(() => buildCalibrationPlan(conflicting, packet, traceMap), /Unresolved historical/);
  traceMap.values().next().value.dialogueTrace[0].rawContext = '';
  assert.throws(() => buildCalibrationPlan(design, packet, traceMap), /Missing recorded calibration context/);
});

test('calibration reservations use actual request bytes and still reject oversized inputs and dollars before calls', async (t) => {
  const { design, plan, options } = calibrationFixture(t);
  const job = plan.jobs[0];
  const request = buildReplayRequest(design, plan, job, new Map());
  const route = design.models[job.seat];
  const expected =
    Math.ceil(
      ((Buffer.byteLength(JSON.stringify(request.messages)) + 1024) * route.prompt_price_per_million +
        2048 * route.completion_price_per_million) *
        1.1,
    ) / 1e6;
  assert.equal(worstCost(design, job.seat, request), expected);
  assert.throws(() => worstCost(design, job.seat), /actual request/);
  const oversized = { ...request, messages: [{ role: 'user', content: 'x'.repeat(65537) }] };
  assert.throws(() => worstCost(design, job.seat, oversized), /byte ceiling/);
  assert.throws(() => checkReplayBudget(design, { ...job, category: 'generation' }, [], request), /Category/);
  design.max_dollars = expected - 0.000001;
  let dispatched = 0;
  await assert.rejects(
    executeReplay({
      ...options,
      dispatch: async () => {
        dispatched++;
      },
    }),
    /Dollar ceiling/,
  );
  assert.equal(dispatched, 0);
  assert.equal(
    readEvents(path.join(options.destination, 'run-ledger.jsonl')).filter(
      (e) => e.type === 'model_attempt_dispatch_reserved',
    ).length,
    0,
  );
});

test('calibration recovery preserves valid ratings and the failed attempt without generating new candidates', async (t) => {
  const { design, plan, options, root } = calibrationFixture(t);
  let calls = 0;
  await assert.rejects(
    executeReplay({
      ...options,
      dispatch: async (_endpoint, request) => {
        calls++;
        if (calls === 3) {
          const error = new Error('technical timeout');
          error.recoverable = true;
          throw error;
        }
        assert.notEqual(request.model, design.models.generator.model);
        return response(design, request);
      },
    }),
    /technical timeout/,
  );
  const retained = fs.readFileSync(path.join(options.destination, 'run-ledger.jsonl'));
  const result = await executeReplay({
    ...options,
    destination: path.join(root, 'calibration-recovery'),
    recoveryFrom: options.destination,
    dispatch: async (_endpoint, request) => {
      calls++;
      return response(design, request);
    },
  });
  assert.equal(calls, plan.jobs.length + 1);
  assert.equal(result.report.missing_jobs, 0);
  assert.equal(result.report.readiness, 'not_validated_against_independent_humans');
  assert.equal(result.report.primary, undefined);
  assert.deepEqual(fs.readFileSync(path.join(options.destination, 'run-ledger.jsonl')), retained);
  const events = readEvents(path.join(result.destination, 'run-ledger.jsonl'));
  assert.equal(events.find((e) => e.type === 'resuming').recovered_jobs, 2);
  assert.equal(
    readJson(path.join(result.destination, 'workflow-status.json')).phase_plan.includes('GENERATING'),
    false,
  );
});

test('calibration reports uncertain agreement and numeric disagreement without pretending either validates measurement', (t) => {
  const { design, plan } = calibrationFixture(t);
  const responses = new Map(
    plan.jobs.map((job) => [
      job.id,
      job.category === 'semantic'
        ? { directive_fulfillment: 'measurement_indeterminate', material_change: 'none' }
        : { quality: job.seat.endsWith('_a') ? 7 : 8, accuracy: 'not_applicable' },
    ]),
  );
  const report = summarizeCalibration(design, plan, responses);
  assert.equal(report.fields.directive_fulfillment.exact_agreements, 2);
  assert.equal(report.fields.directive_fulfillment.determinate_consensus, 0);
  assert.equal(report.fields.directive_fulfillment.measurement_indeterminate, 2);
  assert.equal(report.fields.quality.mean_absolute_numeric_difference, 1);
  assert.equal(report.fields.quality.determinate_consensus, 0);
  assert.equal(report.fields.accuracy.both_not_applicable, 2);
  assert.equal(report.fields.accuracy.determinate_consensus, 0);
  responses.delete(plan.jobs[0].id);
  assert.equal(summarizeCalibration(design, plan, responses).fields.directive_fulfillment.missing_pairs, 1);
});

test('honest indeterminate can omit unavailable critique evidence; positive labels and invented spans remain invalid', (t) => {
  const { design, plan } = calibrationFixture(t);
  const job = plan.jobs.find((j) => j.category === 'semantic');
  plan.units.find((u) => u.unit_key === job.unit).critique = {};
  const request = buildReplayRequest(design, plan, job, new Map());
  const raw = response(design, request);
  const envelope = JSON.parse(raw.body);
  const result = {
    directive_fulfillment: 'measurement_indeterminate',
    material_change: 'measurement_indeterminate',
    critique_spans: [],
    candidate_spans: [],
    rationale: 'There is no actionable critique to assess.',
  };
  const parse = () =>
    parseReplayResponse(design, request, job, {
      ...raw,
      body: JSON.stringify({
        ...envelope,
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result) } }],
      }),
    });
  assert.equal(parse().directive_fulfillment, 'measurement_indeterminate');
  result.directive_fulfillment = 'none';
  assert.throws(parse, /evidence spans invalid/);
  result.directive_fulfillment = 'measurement_indeterminate';
  result.critique_spans = ['invented'];
  assert.throws(parse, /evidence spans invalid/);
});

test('calibration prepare writes only blank human sheets and never initializes provider transport', async (t) => {
  const { root, design, plan } = calibrationFixture(t);
  let calls = 0;
  const output = path.join(root, 'calibration-prepare');
  await main(['--mode', 'calibration', '--prepare', '--output', output], {
    root,
    preparePlan: async () => ({ design, plan }),
    dispatch: async () => {
      calls++;
    },
  });
  assert.equal(calls, 0);
  assert.equal(readJson(path.join(output, 'audit.json')).hard_ceiling, 0);
  assert.equal(readJson(path.join(output, 'human-semantic_a.json')).rows[0].coding.directive_fulfillment, null);
  await assert.rejects(main(['--mode', 'typo', '--prepare', '--output', output]), /Unknown study mode/);
});

test('paid calibration CLI selects the calibration design and summary through the public boundary using mock transport', async (t) => {
  const { root, design, plan, options } = calibrationFixture(t);
  let calls = 0;
  const result = await main(
    [
      '--mode',
      'calibration',
      '--launch',
      '--accept-charges',
      '--output',
      options.destination,
      '--go-note',
      'notes/test-go.md',
      '--go-note-commit',
      options.goNoteCommit,
    ],
    {
      root,
      studyStateRoot: options.studyStateRoot,
      preparePlan: async () => ({ design, plan }),
      onProgress: () => {},
      dispatch: async (_url, request) => {
        calls++;
        assert.notEqual(request.model, design.models.generator.model);
        return response(design, request);
      },
    },
  );
  assert.equal(calls, 8);
  assert.equal(result.report.readiness, 'not_validated_against_independent_humans');
  assert.equal(result.report.primary, undefined);
  assert.equal(readJson(path.join(options.destination, 'settings.json')).mode, 'calibration');
});

test('amended calibration decodes one JSON fence and retains invalid answers without repairing evidence', (t) => {
  const { design, plan } = calibrationFixture(t);
  const job = plan.jobs.find((j) => j.category === 'semantic');
  const request = buildReplayRequest(design, plan, job, new Map());
  const raw = response(design, request);
  const envelope = JSON.parse(raw.body);
  const content = envelope.choices[0].message.content;
  const withContent = (text) => ({
    ...raw,
    body: JSON.stringify({ ...envelope, choices: [{ finish_reason: 'stop', message: { content: text } }] }),
  });
  const fenced = withContent(`\`\`\`json\n${content}\n\`\`\``);
  assert.throws(() => classifyReplayResponse(design, request, job, fenced), /invalid structured/);
  design.response_failure_policy = 'retain_invalid_continue';
  assert.deepEqual(classifyReplayResponse(design, request, job, fenced), JSON.parse(content));
  const spoofed = withContent(JSON.stringify({ ...JSON.parse(content), response_status: 'invalid_response' }));
  assert.equal(classifyReplayResponse(design, request, job, spoofed).response_status, undefined);
  for (const bad of [
    'oops',
    `Here is the result:\n\`\`\`json\n${content}\n\`\`\``,
    `\`\`\`json\n${content}\n\`\`\`\n\`\`\`json\n${content}\n\`\`\``,
  ])
    assert.equal(classifyReplayResponse(design, request, job, withContent(bad)).response_status, 'invalid_response');
  const result = { ...JSON.parse(content), directive_fulfillment: 'full', material_change: 'action_only' };
  const candidate = JSON.parse(request.messages[1].content).candidate[0];
  for (const quote of ['invented evidence', JSON.stringify(`actionTarget":"${candidate.actionTarget}"`).slice(1, -1)]) {
    result.candidate_spans = [quote];
    const invalid = classifyReplayResponse(design, request, job, withContent(JSON.stringify(result)));
    assert.equal(invalid.invalid_reason, 'invalid_semantic_evidence');
    assert.equal(invalid.directive_fulfillment, undefined);
  }
  const payload = JSON.parse(request.messages[1].content);
  payload.candidate[0].message = 'You’re ready.';
  const apostropheRequest = {
    ...request,
    messages: [request.messages[0], { ...request.messages[1], content: JSON.stringify(payload) }],
  };
  result.candidate_spans = ["You're ready."];
  assert.equal(
    classifyReplayResponse(design, apostropheRequest, job, withContent(JSON.stringify(result))).invalid_reason,
    'invalid_semantic_evidence',
  );
  assert.throws(
    () => classifyReplayResponse(design, request, job, response(design, request, { refusal: true })),
    /refusal/,
  );
  const drift = JSON.parse(raw.body);
  drift.provider = 'another provider';
  assert.throws(
    () => classifyReplayResponse(design, request, job, { ...raw, body: JSON.stringify(drift) }),
    /route drift/,
  );
});

test('amended calibration finishes the fixed batch with invalid ratings distinct from missing and disagreement', async (t) => {
  const { design, options, plan } = calibrationFixture(t);
  design.response_failure_policy = 'retain_invalid_continue';
  let calls = 0;
  const result = await executeReplay({
    ...options,
    dispatch: async (_url, request) => {
      calls++;
      return response(design, request, { malformed: calls === 1 });
    },
  });
  assert.equal(calls, 8);
  assert.equal(result.report.processed_jobs, 8);
  assert.equal(result.report.completed_jobs, 7);
  assert.equal(result.report.invalid_jobs, 1);
  assert.equal(result.report.missing_jobs, 0);
  assert.equal(result.report.readiness, 'not_validated_against_independent_humans');
  const field = plan.jobs[0].category === 'semantic' ? 'directive_fulfillment' : 'quality';
  assert.equal(result.report.fields[field].invalid_pairs, 1);
  assert.equal(result.report.fields[field].missing_pairs, 0);
  assert.equal(result.report.fields[field].complete_pairs, 1);
  assert.equal(result.report.fields[field].measurement_indeterminate, 0);
  const events = readEvents(path.join(options.destination, 'run-ledger.jsonl'));
  assert.equal(events.filter((e) => e.type === 'job_invalid_response').length, 1);
  assert.equal(events.filter((e) => e.type === 'job_complete').length, 7);
  assert.equal(events.at(-1).completed_jobs, 7);
  assert.equal(events.at(-1).invalid_jobs, 1);
});

test('ordinary technical recovery preserves valid and invalid calibration answers and their reservations', async (t) => {
  const { root, design, options } = calibrationFixture(t);
  design.response_failure_policy = 'retain_invalid_continue';
  let calls = 0;
  await assert.rejects(
    executeReplay({
      ...options,
      dispatch: async (_url, request) => {
        calls++;
        if (calls === 3) {
          const error = new Error('Offline transport failure');
          error.recoverable = true;
          throw error;
        }
        return response(design, request, { malformed: calls === 1 });
      },
    }),
    /Offline transport/,
  );
  const firstBytes = fs.readFileSync(path.join(options.destination, 'responses/1.json'));
  const firstRequest = readJson(path.join(options.destination, 'requests/1.json'));
  const result = await executeReplay({
    ...options,
    destination: path.join(root, 'missing-only'),
    recoveryFrom: options.destination,
    dispatch: async (_url, request) => {
      calls++;
      assert.notDeepEqual(request, firstRequest);
      return response(design, request);
    },
  });
  assert.equal(calls, 9);
  assert.equal(result.report.completed_jobs, 7);
  assert.equal(result.report.invalid_jobs, 1);
  assert.deepEqual(fs.readFileSync(path.join(options.destination, 'responses/1.json')), firstBytes);
  const events = readEvents(path.join(root, 'study-state', design.id, 'study-ledger.jsonl'));
  assert.equal(events.filter((e) => e.type === 'study_model_attempt_dispatch_reserved').length, 9);
});

test('approved calibration amendment retains the sealed invalid response and collects only never-dispatched jobs', async (t) => {
  const { root, design, plan, options } = calibrationFixture(t);
  let calls = 0;
  const dispatch = async (_url, request) => {
    calls++;
    return response(design, request, { malformed: true });
  };
  await assert.rejects(executeReplay({ ...options, dispatch }), /invalid structured/);
  const before = fs.readFileSync(path.join(options.destination, 'run-ledger.jsonl'));
  design.response_failure_policy = 'retain_invalid_continue';
  const recovered = loadRecoveryResponses(design, plan, options.destination);
  assert.equal(recovered.responses.size, 1);
  assert.equal(recovered.responses.get(plan.jobs[0].id).response_status, 'invalid_response');
  const oldResponse = fs.readFileSync(path.join(options.destination, 'responses/1.json'));
  const firstRequest = readJson(path.join(options.destination, 'requests/1.json'));
  const destination = path.join(root, 'retained-recovery');
  const result = await executeReplay({
    ...options,
    destination,
    recoveryFrom: options.destination,
    dispatch: async (_url, request) => {
      calls++;
      assert.notDeepEqual(request, firstRequest);
      return response(design, request);
    },
  });
  assert.equal(calls, 8);
  assert.equal(result.report.completed_jobs, 7);
  assert.equal(result.report.invalid_jobs, 1);
  assert.equal(result.report.missing_jobs, 0);
  assert.equal(result.report.readiness, 'not_validated_against_independent_humans');
  assert.deepEqual(fs.readFileSync(path.join(options.destination, 'run-ledger.jsonl')), before);
  assert.deepEqual(fs.readFileSync(path.join(options.destination, 'responses/1.json')), oldResponse);
  const events = readEvents(path.join(destination, 'run-ledger.jsonl'));
  assert.deepEqual(events[0].retained_response_units, [plan.jobs[0].id]);
  const attempts = readEvents(path.join(root, 'study-state', design.id, 'study-ledger.jsonl')).filter(
    (e) => e.type === 'study_model_attempt_dispatch_reserved',
  );
  assert.equal(attempts.length, 8);
  assert.equal(attempts.filter((e) => e.unit_id === plan.jobs[0].id).length, 1);
});
