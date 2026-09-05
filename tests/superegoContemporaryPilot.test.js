import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  UNKNOWN,
  preparePilot,
  buildPilotRequest,
  pilotPayload,
  parsePilotResponse,
  humanPacket,
  loadHumanReferences,
  checkPilotBudget,
  reservationCost,
  summarizePilot,
} from '../services/superegoContemporaryPilot.js';
import { executePilot, recoverPilot, dispatchPilot, main } from '../scripts/run-superego-contemporary-pilot.js';
import { readEvents, readJson } from '../services/superegoCritiqueCausalReplay.js';

import { root, realDesign, fixture, answer, humans, rating, transport } from './helpers/superegoPilotFixture.js';

test('real plan fixes six contexts, twelve drafts, donor topic matching and exact budgets without providers', () => {
  const plan = preparePilot(root, realDesign);
  assert.deepEqual(plan, preparePilot(root, realDesign));
  assert.equal(plan.units.length, 12);
  assert.equal(plan.jobs.length, 156);
  for (const unit of plan.units) {
    const donor = plan.units.find((u) => u.id === unit.donor);
    assert.notEqual(donor.scenario, unit.scenario);
    assert.equal(donor.topic, unit.topic);
    assert.deepEqual(Object.keys(unit.context).sort(), ['learner', 'practice_question', 'teaching_material']);
  }
  assert.equal(new Set(plan.presentations.quality.map((p) => `${p.unit}/${p.arm}`)).size, 48);
  assert.equal(reservationCost(realDesign, 'generation'), 0.0704);
  assert.equal(reservationCost(realDesign, 'quality'), 0.1408);
  assert.ok(Math.abs(66 * 0.0704 + 102 * 0.1408 - 19.008) < 1e-9);
});

test('native schemas and evidence IDs avoid quote transcription while retaining semantic and quality separation', () => {
  const plan = preparePilot(root, realDesign),
    results = new Map();
  for (const job of plan.jobs.filter((j) => j.category === 'generation')) {
    const request = buildPilotRequest(realDesign, plan, job, results);
    assert.equal(request.endpoint, 'https://api.anthropic.com/v1/messages');
    assert.equal(request.body.thinking.type, 'disabled');
    assert.ok(!('temperature' in request.body));
    results.set(
      job.id,
      parsePilotResponse(realDesign, request, job, answer(request), pilotPayload(plan, job, results)),
    );
  }
  for (const category of ['quality', 'semantic']) {
    const job = plan.jobs.find((j) => j.category === category),
      payload = pilotPayload(plan, job, results),
      request = buildPilotRequest(realDesign, plan, job, results);
    assert.equal(request.body.model, 'gpt-5.6-sol');
    assert.equal(request.body.text.format.strict, true);
    assert.ok(!('provider' in request.body));
    assert.ok(!('temperature' in request.body));
    if (category === 'quality') assert.deepEqual(Object.keys(payload), ['context', 'candidate']);
    const parsed = parsePilotResponse(realDesign, request, job, answer(request), payload);
    assert.ok(!parsed.invalid_response);
    const invalid = parsePilotResponse(
      realDesign,
      request,
      job,
      answer(request, (value) => ({ ...value, candidate_refs: ['P999'] })),
      payload,
    );
    assert.equal(invalid.invalid_response, 'invalid_rating_or_reference');
  }
  const semantic = plan.jobs.find((j) => j.category === 'semantic');
  const payload = pilotPayload(plan, semantic, results),
    request = buildPilotRequest(realDesign, plan, semantic, results);
  payload.reference_critique = [];
  assert.ok(
    !parsePilotResponse(
      realDesign,
      request,
      semantic,
      answer(request, () => ({
        ...rating('semantic'),
        directive_fulfillment: UNKNOWN,
        material_change: 'surface_only',
        critique_refs: [],
        candidate_refs: ['P1'],
      })),
      payload,
    ).invalid_response,
  );
  assert.ok(parsePilotResponse(realDesign, request, semantic, answer(request), payload).invalid_response);
});

test('full mocked workflow seals generation, requires human references, then judges without regenerating', async (t) => {
  const f = fixture(t);
  let calls = 0;
  const dispatch = async (request) => {
    calls++;
    return answer(request);
  };
  const generated = await executePilot({ ...f, dispatch });
  assert.equal(calls, 20);
  assert.equal(generated.status, 'handoff_pending');
  assert.equal(readJson(path.join(f.destination, 'workflow-status.json')).current_phase, 'HANDOFF_PENDING');
  assert.equal(humanPacket(f.plan, generated.results, 'quality').items.length, 16);
  await assert.rejects(
    executePilot({
      ...f,
      dispatch,
      phase: 'judging',
      recoveryFrom: f.destination,
      destination: path.join(f.root, 'missing-humans'),
    }),
    /path|argument|undefined/i,
  );
  assert.equal(calls, 20);
  assert.ok(!fs.existsSync(path.join(f.root, 'missing-humans')));
  const refs = humans(f),
    destination = path.join(f.root, 'judging');
  await executePilot({ ...f, ...refs, dispatch, phase: 'judging', recoveryFrom: f.destination, destination });
  assert.equal(calls, 52);
  assert.equal(readJson(path.join(destination, 'report.json')).automatic_promotion, false);
  const events = readEvents(path.join(f.studyStateRoot, f.design.id, 'study-ledger.jsonl'));
  assert.equal(events.filter((e) => e.type === 'study_model_attempt_dispatch_reserved').length, 52);
  assert.equal(
    events.filter((e) => e.type === 'study_model_attempt_dispatch_reserved' && e.category === 'generation').length,
    20,
  );
  await assert.rejects(executePilot({ ...f, dispatch }), /create-once/);
  await assert.rejects(
    executePilot({ ...f, dispatch, destination: path.join(f.root, 'duplicate') }),
    /duplicate fresh launch/,
  );
  assert.equal(calls, 52);
});

test('one technical recovery retains all answers and repeated transport diagnostics stop the workflow', async (t) => {
  const f = fixture(t);
  let calls = 0;
  const dispatch = async (request) => {
    calls++;
    if ([2, 4].includes(calls)) throw transport();
    return answer(request);
  };
  await assert.rejects(executePilot({ ...f, dispatch }), /UND_ERR_SOCKET/);
  const original = fs.readFileSync(path.join(f.destination, 'responses/1.json'));
  const second = path.join(f.root, 'recovery');
  await assert.rejects(
    executePilot({ ...f, dispatch, recoveryFrom: f.destination, destination: second }),
    /UND_ERR_SOCKET/,
  );
  assert.deepEqual(fs.readFileSync(path.join(f.destination, 'responses/1.json')), original);
  assert.equal(readEvents(path.join(second, 'run-ledger.jsonl')).at(-1).recovery_permitted, false);
  await assert.rejects(
    executePilot({ ...f, dispatch, recoveryFrom: second, destination: path.join(f.root, 'third') }),
    /stopped for investigation/,
  );
  assert.equal(calls, 4);
});

test('invalid judgments remain terminal during missing-only recovery and references cannot drift', async (t) => {
  const f = fixture(t);
  await executePilot(f);
  const refs = humans(f),
    first = path.join(f.root, 'judge-first');
  let calls = 0;
  const dispatch = async (request) => {
    calls++;
    if (calls === 2) throw transport();
    return answer(request, (value) => (calls === 1 ? { ...value, candidate_refs: ['bad-id'] } : value));
  };
  await assert.rejects(
    executePilot({ ...f, ...refs, phase: 'judging', dispatch, recoveryFrom: f.destination, destination: first }),
    /Transport/,
  );
  const saved = readJson(refs.qualityPath);
  saved.raters[0].ratings[0].rating.quality = 8;
  fs.writeFileSync(refs.qualityPath, JSON.stringify(saved));
  await assert.rejects(
    executePilot({
      ...f,
      ...refs,
      phase: 'judging',
      dispatch,
      recoveryFrom: first,
      destination: path.join(f.root, 'changed'),
    }),
    /references changed/,
  );
  saved.raters[0].ratings[0].rating.quality = 7;
  fs.writeFileSync(refs.qualityPath, JSON.stringify(saved));
  const second = path.join(f.root, 'judge-recovery');
  await executePilot({ ...f, ...refs, phase: 'judging', dispatch, recoveryFrom: first, destination: second });
  assert.equal(calls, 33);
  assert.equal(readJson(path.join(second, 'report.json')).invalid_model_judgments, 1);
  assert.equal(recoverPilot(f.design, f.plan, second).results.size, 52);
});

test('attempt, category, dollar, byte and route failures refuse dispatch or replacement', async (t) => {
  const plan = preparePilot(root, realDesign),
    job = plan.jobs[0];
  const event = {
    type: 'study_model_attempt_dispatch_reserved',
    category: 'generation',
    unit_id: 'other',
    max_cost_dollars: 0.0704,
  };
  assert.throws(() => checkPilotBudget(realDesign, job, Array(168).fill(event)), /ceiling/);
  assert.throws(() => checkPilotBudget(realDesign, job, Array(66).fill(event)), /ceiling/);
  assert.throws(
    () =>
      checkPilotBudget(
        realDesign,
        job,
        [event, event].map((e) => ({ ...e, unit_id: job.id })),
      ),
    /replacement/,
  );
  assert.throws(() => checkPilotBudget({ ...realDesign, max_dollars: 0.01 }, job, []), /Dollar ceiling/);
  assert.throws(
    () => buildPilotRequest({ ...realDesign, max_request_bytes: 10 }, plan, job, new Map()),
    /byte ceiling/,
  );
  const f = fixture(t);
  let calls = 0;
  await assert.rejects(
    executePilot({
      ...f,
      dispatch: async (request) => {
        calls++;
        const raw = answer(request),
          envelope = JSON.parse(raw.body);
        envelope.model = 'another-model';
        return { ...raw, body: JSON.stringify(envelope) };
      },
    }),
    /model drift/,
  );
  assert.equal(calls, 1);
  assert.equal(readEvents(path.join(f.destination, 'run-ledger.jsonl')).at(-1).recovery_permitted, false);
});

test('network diagnostics retain safe underlying codes and body-read request IDs without secrets', async (t) => {
  const previous = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'offline-secret';
  t.after(() => {
    if (previous === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previous;
  });
  const request = buildPilotRequest(
    realDesign,
    preparePilot(root, realDesign),
    preparePilot(root, realDesign).jobs[0],
    new Map(),
  );
  const fail = () => {
    throw new TypeError('unsafe offline-secret payload', {
      cause: { code: 'UND_ERR_SOCKET', secret: 'offline-secret' },
    });
  };
  await assert.rejects(dispatchPilot(request, 100, fail), (error) => {
    assert.equal(error.diagnostic.cause_code, 'UND_ERR_SOCKET');
    assert.ok(!JSON.stringify(error).includes('offline-secret'));
    return true;
  });
  await assert.rejects(
    dispatchPilot(request, 100, async () => ({
      status: 200,
      headers: new Headers({ 'request-id': 'req_fixture' }),
      text: fail,
    })),
    (error) => {
      assert.equal(error.diagnostic.stage, 'body_read');
      assert.equal(error.diagnostic.request_id, 'req_fixture');
      return true;
    },
  );
});

test('only response-free server failures recover; truncation, invalid JSON and invalid generation never resample', () => {
  const plan = preparePilot(root, realDesign),
    job = plan.jobs[0],
    results = new Map();
  const request = buildPilotRequest(realDesign, plan, job, results),
    payload = pilotPayload(plan, job, results);
  for (const status of [429, 500])
    assert.throws(
      () =>
        parsePilotResponse(
          realDesign,
          request,
          job,
          { status, body: JSON.stringify({ type: 'error', error: { message: 'offline' } }) },
          payload,
        ),
      (e) => e.recoverable === true,
    );
  assert.throws(
    () =>
      parsePilotResponse(
        realDesign,
        request,
        job,
        { status: 500, body: JSON.stringify({ error: {}, choices: [{ text: 'an answer' }] }) },
        payload,
      ),
    (e) => e.recoverable === false,
  );
  const raw = answer(request),
    envelope = JSON.parse(raw.body);
  envelope.stop_reason = 'max_tokens';
  assert.throws(
    () => parsePilotResponse(realDesign, request, job, { ...raw, body: JSON.stringify(envelope) }, payload),
    /truncation/,
  );
  envelope.stop_reason = 'end_turn';
  envelope.content[0].text = '{broken';
  assert.equal(
    parsePilotResponse(realDesign, request, job, { ...raw, body: JSON.stringify(envelope) }, payload).invalid_response,
    'invalid_json',
  );
  envelope.content[0].text = '{"response":""}';
  assert.equal(
    parsePilotResponse(realDesign, request, job, { ...raw, body: JSON.stringify(envelope) }, payload).invalid_response,
    'invalid_generation',
  );
});

test('recovery refuses missing or modified sealed response data instead of replacing it', async (t) => {
  const f = fixture(t);
  await executePilot(f);
  const response = path.join(f.destination, 'responses/1.json');
  fs.appendFileSync(response, '\n');
  assert.throws(() => recoverPilot(f.design, f.plan, f.destination), /Sealed response data mismatch/);
  fs.unlinkSync(response);
  assert.throws(() => recoverPilot(f.design, f.plan, f.destination), /Sealed response data mismatch/);
});

test('human disagreements stay indeterminate with full-unit bounds and separate reader scores', async (t) => {
  const f = fixture(t),
    generated = await executePilot(f),
    refs = humans(f);
  const humansDoc = loadHumanReferences(f.plan, generated.results, refs.qualityPath, refs.semanticPath);
  const actual = f.plan.presentations.quality.find((p) => p.arm === 'actual_critique');
  humansDoc.quality.raters[1].ratings.find((r) => r.id === actual.id).rating.quality = 8;
  const report = summarizePilot(f.design, f.plan, generated.results, humansDoc);
  const contrast = report.primary.contrasts.find((c) => c.arm === 'actual_critique');
  assert.equal(contrast.indeterminate_pairs, 1);
  assert.deepEqual(contrast.all_unit_identification_bounds, [-2.25, 2.25]);
  assert.equal(report.primary.individual_readers.length, 3);
  assert.equal(report.readiness, UNKNOWN);
  assert.equal(report.missing_model_judgments, 32);
  const invalidHumans = readJson(refs.semanticPath);
  invalidHumans.raters[0].completed_at = '2025-01-01T00:00:00Z';
  fs.writeFileSync(refs.semanticPath, JSON.stringify(invalidHumans));
  assert.throws(
    () => loadHumanReferences(f.plan, generated.results, refs.qualityPath, refs.semanticPath),
    /quality readers must finish/,
  );
});

test('CLI prepares create-once zero-call artifacts and refuses unapproved dispatch', async (t) => {
  const f = fixture(t),
    destination = path.join(f.root, 'prepared');
  let calls = 0;
  await main(['--prepare', '--out', destination], {
    root: f.root,
    dispatch: async () => {
      calls++;
    },
  });
  assert.equal(readJson(path.join(destination, 'plan.json')).jobs.length, 52);
  await assert.rejects(main(['--prepare', '--out', destination], { root: f.root }), /EEXIST/);
  await assert.rejects(
    main(['--launch', '--out', path.join(f.root, 'unapproved')], {
      root: f.root,
      dispatch: async () => {
        calls++;
      },
    }),
    /accept-charges/,
  );
  assert.equal(calls, 0);
});
