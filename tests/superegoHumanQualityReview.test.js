import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  fixture,
  answer,
  rating,
  transport,
  realDesign,
  proposedDesign,
  root,
} from './helpers/superegoPilotFixture.js';
import {
  preparePilot,
  buildPilotRequest,
  parsePilotResponse,
  pilotPayload,
  humanPacket,
  UNKNOWN,
  reservationCost,
} from '../services/superegoContemporaryPilot.js';
import { executePilot, recoverPilot, dispatchPilot, main } from '../scripts/run-superego-contemporary-pilot.js';
import {
  humanQualityReviewHtml,
  readHumanQuality,
  summarizeHumanQuality,
} from '../services/superegoHumanQualityReview.js';
import { readEvents, readJson, writeOnce } from '../services/superegoCritiqueCausalReplay.js';

function truncate(request) {
  const raw = answer(request),
    envelope = JSON.parse(raw.body);
  envelope.stop_reason = 'max_tokens';
  envelope.usage.output_tokens = 2048;
  envelope.content[0].text = '{"response":"Two paragraphs of ordinary prose.' + '\u3000'.repeat(1702);
  return { ...raw, body: JSON.stringify(envelope) };
}
function humanFiles(f, results) {
  const packet = humanPacket(f.plan, results, 'quality');
  return ['reader-a', 'reader-b'].map((coder_id) => {
    const file = path.join(f.root, `${coder_id}.json`);
    writeOnce(file, {
      study_id: packet.study_id,
      packet_id: packet.packet_id,
      raters: [
        {
          coder_id,
          completed_at: '2026-09-06T12:00:00Z',
          ratings: packet.items.map((item) => ({ id: item.id, rating: item.unavailable ? null : rating('quality') })),
        },
      ],
    });
    return file;
  });
}

test('public drafts and revisions use plain text while critiques retain structure and fixed ceilings', async (t) => {
  const f = fixture(t, { prospective: true });
  const results = new Map();
  for (const job of f.plan.jobs) {
    const request = buildPilotRequest(f.design, f.plan, job, results);
    assert.equal(request.body.max_tokens, 2048);
    assert.equal(request.body.thinking.type, 'disabled');
    assert.equal('output_config' in request.body, job.kind === 'critique');
    if (job.kind !== 'critique') assert.match(request.body.system, /ordinary text, without a JSON wrapper/);
    results.set(
      job.id,
      parsePilotResponse(f.design, request, job, answer(request), pilotPayload(f.plan, job, results)),
    );
  }
  assert.equal(f.plan.jobs.length, 20);
  assert.equal(f.plan.presentations.quality.length, 16);
  assert.equal(reservationCost(f.design, 'generation'), 0.0704);
  const legacy = preparePilot(root, realDesign),
    request = buildPilotRequest(realDesign, legacy, legacy.jobs[0], new Map());
  assert.ok(request.body.output_config);
  assert.throws(() => parsePilotResponse(realDesign, request, legacy.jobs[0], truncate(request), {}), /truncation/);
});

test('truncated whitespace is retained; dependent jobs consume no calls and all fixed units reach human accounting', async (t) => {
  const f = fixture(t, { prospective: true });
  let calls = 0;
  const generated = await executePilot({
    ...f,
    dispatch: async (request) => (++calls === 1 ? truncate(request) : answer(request)),
  });
  assert.equal(calls, 15);
  assert.equal(generated.results.size, 20);
  assert.equal(generated.results.get(f.plan.jobs[0].id).invalid_response, 'truncated');
  const status = readJson(path.join(f.destination, 'workflow-status.json'));
  assert.deepEqual(status.units, { complete: 14, active: 0, failed: 6, missing: 0 });
  assert.equal(status.current_phase, 'HANDOFF_PENDING');
  assert.equal(status.human_action_required, true);
  const events = readEvents(path.join(f.destination, 'run-ledger.jsonl'));
  assert.equal(events.filter((event) => event.type === 'job_unavailable').length, 5);
  assert.equal(events.filter((event) => event.type === 'model_attempt_dispatch_reserved').length, 15);
  assert.equal(events.at(-1).complete_jobs, 14);
  assert.equal(events.at(-1).unavailable_jobs, 6);
  assert.equal(events.at(-1).terminal_jobs, 20);
  const recovered = recoverPilot(f.design, f.plan, f.destination);
  assert.deepEqual([...recovered.results].sort(), [...generated.results].sort());
  const packet = humanPacket(f.plan, recovered.results, 'quality');
  assert.equal(packet.items.length, 16);
  assert.equal(packet.items.filter((item) => item.unavailable).length, 5);
  for (const item of packet.items) {
    assert.ok(!('arm' in item));
    assert.ok(!('draft' in item));
    assert.ok(!('critique' in item));
    if (item.unavailable) assert.deepEqual(Object.keys(item).sort(), ['id', 'unavailable']);
  }
  assert.ok(fs.existsSync(path.join(f.destination, 'human-quality-review/review.html')));
  assert.equal(readJson(path.join(f.destination, 'generation-summary.json')).available_public_outputs, 11);
  const refs = humanFiles(f, generated.results),
    report = summarizeHumanQuality(f.plan, generated.results, readHumanQuality(f.plan, generated.results, ...refs));
  assert.equal(report.consensus.find((row) => row.arm === 'actual_critique').determinate_pairs, 3);
  assert.deepEqual(
    report.consensus.find((row) => row.arm === 'actual_critique').all_unit_identification_bounds,
    [-2.25, 2.25],
  );
  assert.equal(report.automatic_promotion, false);
});

test('missing-only recovery retains invalid answers and never reruns available outputs', async (t) => {
  const f = fixture(t, { prospective: true });
  let calls = 0;
  const dispatch = async (request) => {
    calls++;
    if (calls === 1) return truncate(request);
    if (calls === 4) throw transport();
    return answer(request);
  };
  await assert.rejects(executePilot({ ...f, dispatch }), /Transport/);
  const original = fs.readFileSync(path.join(f.destination, 'responses/1.json'));
  const second = path.join(f.root, 'recovered');
  const result = await executePilot({ ...f, dispatch, recoveryFrom: f.destination, destination: second });
  assert.equal(calls, 16);
  assert.equal(result.results.size, 20);
  assert.deepEqual(fs.readFileSync(path.join(f.destination, 'responses/1.json')), original);
  assert.equal(recoverPilot(f.design, f.plan, second).results.get(f.plan.jobs[0].id).invalid_response, 'truncated');
  const events = readEvents(path.join(second, 'run-ledger.jsonl'));
  assert.ok(!events.some((e) => e.type === 'model_attempt_dispatch_reserved' && e.unit_id === f.plan.jobs[0].id));
  const broken = events.find((e) => e.type === 'job_unavailable');
  broken.dependencies = ['invented'];
  fs.writeFileSync(path.join(second, 'run-ledger.jsonl'), events.map(JSON.stringify).join('\n') + '\n');
  assert.throws(() => recoverPilot(f.design, f.plan, second), /missing-dependency record/);
});

test('human quality report requires two complete independent files and no semantic or provider work', async (t) => {
  const f = fixture(t, { prospective: true }),
    generated = await executePilot(f);
  const [first, second] = humanFiles(f, generated.results);
  const doc = readJson(second),
    actual = f.plan.presentations.quality.find((row) => row.arm === 'actual_critique');
  doc.raters[0].ratings.find((row) => row.id === actual.id).rating.quality = 8;
  fs.writeFileSync(second, JSON.stringify(doc));
  assert.throws(() => readHumanQuality(f.plan, generated.results, first, first), /independent/);
  const destination = path.join(f.root, 'human-report');
  await main(
    [
      '--human-report',
      '--from',
      f.destination,
      '--human-quality',
      first,
      '--human-quality-other',
      second,
      '--out',
      destination,
    ],
    {
      root: f.root,
      dispatch: async () => {
        throw new Error('No model may run during human reporting');
      },
    },
  );
  const report = readJson(path.join(destination, 'report.json'));
  assert.equal(report.rows.find((row) => row.id === actual.id).quality_consensus, UNKNOWN);
  assert.equal(report.readers.length, 2);
  assert.equal(report.consensus.find((row) => row.arm === 'actual_critique').determinate_pairs, 3);
  assert.equal(
    report.readers[1].contrasts.find((row) => row.arm === 'actual_critique').complete_case_mean_descriptive,
    0.25,
  );
  assert.match(fs.readFileSync(path.join(destination, 'report.md'), 'utf8'), /not confidence intervals/);
  assert.ok(
    fs.readFileSync(path.join(destination, 'report.md'), 'utf8').startsWith('# Human teaching-quality comparison\n'),
  );
  await assert.rejects(
    main(
      [
        '--human-report',
        '--from',
        f.destination,
        '--human-quality',
        first,
        '--human-quality-other',
        second,
        '--out',
        destination,
      ],
      { root: f.root },
    ),
    /EEXIST/,
  );
  await assert.rejects(
    executePilot({ ...f, phase: 'judging', recoveryFrom: f.destination, destination: path.join(f.root, 'judge') }),
    /outside this design/,
  );
});

test('partial body delivery is preserved and cannot receive a response-free technical replacement', async (t) => {
  const previous = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'offline-only';
  t.after(() =>
    previous === undefined ? delete process.env.ANTHROPIC_API_KEY : (process.env.ANTHROPIC_API_KEY = previous),
  );
  const f = fixture(t, { prospective: true });
  let calls = 0;
  const dispatch = (request) =>
    dispatchPilot(request, 100, async () => {
      calls++;
      return {
        status: 200,
        headers: new Headers({ 'request-id': 'offline-partial' }),
        body: {
          async *[Symbol.asyncIterator]() {
            yield Buffer.from('{"content":');
            yield Buffer.from([0xe3, 0x80]); // An incomplete UTF-8 character must survive byte-for-byte.
            throw new TypeError('offline-only', { cause: { code: 'UND_ERR_SOCKET' } });
          },
        },
      };
    });
  await assert.rejects(executePilot({ ...f, dispatch }), /retained partial body/);
  const bundle = readJson(path.join(f.destination, 'responses/1.json'));
  assert.equal(bundle.raw.body, '{"content":\ufffd');
  assert.deepEqual(
    Buffer.from(bundle.raw.body_base64, 'base64'),
    Buffer.concat([Buffer.from('{"content":'), Buffer.from([0xe3, 0x80])]),
  );
  assert.equal(bundle.raw.body_read_error.cause_code, 'UND_ERR_SOCKET');
  assert.ok(!JSON.stringify(bundle).includes('offline-only'));
  assert.equal(readEvents(path.join(f.destination, 'run-ledger.jsonl')).at(-1).recovery_permitted, false);
  assert.equal(calls, 1);
});

test('reader files cannot be applied to a different public packet with the same neutral IDs', async (t) => {
  const f = fixture(t, { prospective: true }),
    generated = await executePilot(f);
  const [first, second] = humanFiles(f, generated.results);
  const original = readJson(second);
  for (const change of [{ packet_id: 'different-packet' }, { study_id: 'different-study' }]) {
    fs.writeFileSync(second, JSON.stringify({ ...original, ...change }));
    assert.throws(() => readHumanQuality(f.plan, generated.results, first, second), /different public packet/);
  }
  fs.writeFileSync(second, JSON.stringify(original));
  const changedResults = new Map(generated.results);
  changedResults.set(f.plan.jobs[0].id, { response: 'Different retained public text.' });
  assert.throws(() => readHumanQuality(f.plan, changedResults, first, second), /different public packet/);
  assert.doesNotThrow(() => readHumanQuality(f.plan, generated.results, first, second));
});

test('review page keeps candidate text inert, contains no treatment key, and starts with no scores', () => {
  const packet = {
    category: 'quality',
    instructions: 'Independent quality only.',
    items: [
      {
        id: 'q001',
        context: { learner: '</script><script>globalThis.hacked=true</script>', teaching_material: 'Context' },
        candidate: [{ id: 'P1', text: '<img src=x onerror=alert(1)>' }],
      },
      { id: 'q002', unavailable: true },
    ],
  };
  const html = humanQualityReviewHtml(packet);
  assert.ok(!html.includes('</script><script>globalThis.hacked'));
  assert.equal((html.match(/<script/g) || []).length, 2);
  const code = html.match(/<script>([\s\S]*?)<\/script>/u)[1];
  assert.doesNotThrow(() => new vm.Script(code));
  assert.ok(!code.includes('fetch('));
  assert.ok(!code.includes('innerHTML'));
  assert.ok(!html.includes('actual_critique'));
  assert.match(code, /new Option\('Choose…',''\)/);
  assert.throws(() => humanQualityReviewHtml({ ...packet, category: 'semantic' }), /Only public quality/);
});

test('proposed human comparison is bounded independently of deferred automated judging', () => {
  // Also exercises the production registration, not just the reduced offline fixture.
  assert.equal(proposedDesign.automated_judging, false);
  const plan = preparePilot(root, proposedDesign);
  assert.equal(plan.units.length, 12);
  assert.equal(plan.jobs.length, 60);
  assert.equal(plan.jobs.filter((job) => job.category !== 'generation').length, 0);
  assert.equal(proposedDesign.attempts.hard_ceiling, 66);
  assert.equal(proposedDesign.max_dollars, 4.6464);
});
