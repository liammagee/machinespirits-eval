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
  summarizeReplay,
  consensus,
  readEvents,
  readJson,
  worstCost,
} from '../services/superegoCritiqueCausalReplay.js';
import { executeReplay, checkReplayBudget, main } from '../scripts/run-superego-critique-causal-replay.js';

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
