import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'human-coding-routes-'));
const samplePath = path.join(tmpDir, 'human-validation-pilot-sample.csv');
const outputDir = path.join(tmpDir, 'out');
const impassePath = path.join(tmpDir, 'impasse-episodes.json');
const impasseOutputDir = path.join(tmpDir, 'impasse-out');

process.env.HUMAN_CODING_SAMPLE = samplePath;
process.env.HUMAN_CODING_OUTPUT_DIR = outputDir;
process.env.HUMAN_CODING_KEY = path.join(tmpDir, 'human-validation-pilot-key.jsonl');
process.env.HUMAN_CODING_ANALYSIS = path.join(tmpDir, 'human-validation-pilot-analysis.md');
process.env.LABELLING_GAME_IMPASSE_DATASET = impassePath;
process.env.LABELLING_GAME_IMPASSE_OUTPUT_DIR = impasseOutputDir;

fs.mkdirSync(tmpDir, { recursive: true });
fs.writeFileSync(
  samplePath,
  [
    'item_id,feedback,ego_generate,ego_revision,learner_context_snippet,human_primary,human_secondary,human_confident,human_notes',
    'item-a,"The response ignores the returning learner history.",Initial A,Revision A,Context A,,,,',
    'item-b,"The response invents a 30 minute engagement metric.",Initial B,Revision B,Context B,,,,',
  ].join('\n') + '\n',
  'utf8',
);
fs.writeFileSync(
  process.env.HUMAN_CODING_KEY,
  [
    '{"item_id":"item-a","llm_primary":"MEMORY_FAILURE","llm_rationale":"history"}',
    '{"item_id":"item-b","llm_primary":"FABRICATION","llm_rationale":"invented metric"}',
  ].join('\n') + '\n',
  'utf8',
);
fs.writeFileSync(
  impassePath,
  JSON.stringify({
    schema: 'test.impasse.v1',
    episodes: [
      {
        episode_id: 'E01',
        session_date: '2026-07-08 06:33:03',
        session_file: 'trace-a.jsonl',
        turn_range: [13, 18],
        mixed: false,
        signals_fired: ['h1_clarification[confused]'],
        core_heuristics: ['h1'],
        excerpt_turns: [{ turn: 13, learner_text: 'I am confused.', tutor_text: 'Name the person.' }],
        followup_turns: [{ turn: 14, learner_text: 'Which person?', tutor_text: 'The one in the book.' }],
      },
      {
        episode_id: 'E02',
        session_date: '2026-07-09 11:00:00',
        session_file: 'trace-b.jsonl',
        turn_range: [4, 4],
        mixed: true,
        signals_fired: ['h5_stagnation'],
        core_heuristics: ['h5'],
        excerpt_turns: [{ turn: 4, learner_text: 'Okay.', tutor_text: 'What follows?' }],
        followup_turns: [],
      },
    ],
  }),
  'utf8',
);

const { app } = await import('../server.js');

function request(baseUrl, method, route, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${baseUrl}${route}`);
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed, contentType: res.headers['content-type'] });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('human coding dashboard routes', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    delete process.env.HUMAN_CODING_SAMPLE;
    delete process.env.HUMAN_CODING_OUTPUT_DIR;
    delete process.env.HUMAN_CODING_KEY;
    delete process.env.HUMAN_CODING_ANALYSIS;
    delete process.env.LABELLING_GAME_IMPASSE_DATASET;
    delete process.env.LABELLING_GAME_IMPASSE_OUTPUT_DIR;
  });

  it('reports sample status and serves the admin shell', async () => {
    const status = await request(baseUrl, 'GET', '/api/human-coding/status');
    assert.equal(status.status, 200);
    assert.equal(status.body.success, true);
    assert.equal(status.body.sample.exists, true);
    assert.equal(status.body.sample.total, 2);
    assert.ok(status.body.categories.some((entry) => entry.id === 'MEMORY_FAILURE'));

    const page = await request(baseUrl, 'GET', '/human-coding-admin/');
    assert.equal(page.status, 200);
    assert.match(page.contentType || '', /text\/html/);
    assert.match(page.body, /Labelling Game/);
  });

  it('lists both datasets through the consolidated labelling-game API', async () => {
    const response = await request(baseUrl, 'GET', '/api/human-coding/datasets');
    assert.equal(response.status, 200);
    assert.deepEqual(
      response.body.datasets.map((dataset) => [dataset.id, dataset.total]),
      [
        ['superego-taxonomy', 2],
        ['tutor-stub-impasses', 2],
      ],
    );

    const taxonomy = await request(
      baseUrl,
      'GET',
      '/api/human-coding/datasets/superego-taxonomy/items?coder_id=rater-B',
    );
    assert.equal(taxonomy.status, 200);
    assert.equal(taxonomy.body.items[0].labelling_complete, false);
    assert.equal(taxonomy.body.items[0].labelling_summary, 'open');
  });

  it('loads and saves structured tutor-stub impasse labels', async () => {
    const items = await request(
      baseUrl,
      'GET',
      '/api/human-coding/datasets/tutor-stub-impasses/items?coder_id=impasse-rater',
    );
    assert.equal(items.status, 200);
    assert.equal(items.body.items.length, 2);
    assert.equal(items.body.items[0].excerpt_turns[0].learner_text, 'I am confused.');
    assert.equal(items.body.progress.complete, 0);

    const saved = await request(baseUrl, 'PUT', '/api/human-coding/datasets/tutor-stub-impasses/items/E01', {
      coder_id: 'impasse-rater',
      impasse: 'yes',
      impasse_types: ['comprehension', 'pacing-stall'],
      tutor_addressed: 'partly',
      resolved_within_2: 'no',
      notes: 'The learner asks twice for the missing referent.',
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.item.labelling_complete, true);
    assert.deepEqual(saved.body.item.impasse_types, ['comprehension', 'pacing_stall']);
    assert.equal(saved.body.progress.complete, 1);

    const sidecarPath = path.join(impasseOutputDir, 'impasse-corpus-phase1-rater-impasse-rater.json');
    const sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
    assert.equal(sidecar.schema, 'machinespirits.labelling-game.impasse-rater.v1');
    assert.equal(sidecar.items[0].tutor_addressed, 'partly');

    const unavailable = await request(
      baseUrl,
      'GET',
      '/api/human-coding/datasets/tutor-stub-impasses/comparison?coder_id=impasse-rater',
    );
    assert.equal(unavailable.status, 409);
    assert.equal(unavailable.body.code, 'comparison_unavailable');
  });

  it('rejects incomplete or unknown impasse labels without writing them', async () => {
    const missingType = await request(baseUrl, 'PUT', '/api/human-coding/datasets/tutor-stub-impasses/items/E02', {
      coder_id: 'impasse-rater',
      impasse: 'yes',
      impasse_types: [],
      tutor_addressed: 'no',
      resolved_within_2: 'session ended',
    });
    assert.equal(missingType.status, 422);
    assert.equal(missingType.body.code, 'impasse_type_required');

    const unknownType = await request(baseUrl, 'PUT', '/api/human-coding/datasets/tutor-stub-impasses/items/E02', {
      coder_id: 'impasse-rater',
      impasse: 'yes',
      impasse_types: ['not-a-type'],
      tutor_addressed: 'no',
      resolved_within_2: 'no',
    });
    assert.equal(unknownType.status, 422);
    assert.equal(unknownType.body.code, 'invalid_impasse_type');

    const unexplainedOther = await request(baseUrl, 'PUT', '/api/human-coding/datasets/tutor-stub-impasses/items/E02', {
      coder_id: 'impasse-rater',
      impasse: 'yes',
      impasse_types: ['other'],
      tutor_addressed: 'no',
      resolved_within_2: 'no',
      notes: '',
    });
    assert.equal(unexplainedOther.status, 422);
    assert.equal(unexplainedOther.body.code, 'impasse_other_notes_required');
  });

  it('loads a coder packet and writes analyzer-compatible rater CSV rows', async () => {
    const items = await request(baseUrl, 'GET', '/api/human-coding/items?coder_id=rater-A');
    assert.equal(items.status, 200);
    assert.equal(items.body.success, true);
    assert.equal(items.body.items.length, 2);
    assert.equal(items.body.progress.complete, 0);

    const saved = await request(baseUrl, 'PUT', '/api/human-coding/items/item-a', {
      coder_id: 'rater-A',
      human_primary: 'memory failure',
      human_secondary: ['RECOGNITION_FAILURE'],
      human_confident: '2',
      human_notes: 'The feedback points to prior-session history.',
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.success, true);
    assert.equal(saved.body.item.human_primary, 'MEMORY_FAILURE');
    assert.equal(saved.body.progress.complete, 1);

    const csvPath = path.join(outputDir, 'human-validation-pilot-rater-rater-A.csv');
    assert.equal(fs.existsSync(csvPath), true);
    const csv = fs.readFileSync(csvPath, 'utf8');
    assert.match(csv, /^item_id,feedback,ego_generate/m);
    assert.match(csv, /item-a,/);
    assert.match(csv, /MEMORY_FAILURE,RECOGNITION_FAILURE,2/);
  });

  it('locks AI comparison until the rater has completed every item', async () => {
    const locked = await request(baseUrl, 'GET', '/api/human-coding/comparison?coder_id=rater-A');
    assert.equal(locked.status, 409);
    assert.equal(locked.body.success, false);
    assert.equal(locked.body.code, 'coding_incomplete');
    assert.equal(locked.body.details.remaining, 1);
  });

  it('compares completed human labels against the AI key', async () => {
    const saved = await request(baseUrl, 'PUT', '/api/human-coding/items/item-b', {
      coder_id: 'rater-A',
      human_primary: 'VAGUENESS',
      human_confident: '1',
      human_notes: 'This reads as generic rather than fabricated.',
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.progress.remaining, 0);

    const comparison = await request(baseUrl, 'GET', '/api/human-coding/comparison?coder_id=rater-A');
    assert.equal(comparison.status, 200);
    assert.equal(comparison.body.success, true);
    assert.equal(comparison.body.stats.n, 2);
    assert.equal(comparison.body.stats.agreements, 1);
    assert.equal(comparison.body.stats.disagreements, 1);
    assert.ok(Math.abs(comparison.body.stats.kappa - 1 / 3) < 0.001);
    assert.equal(comparison.body.disagreements[0].item_id, 'item-b');
    assert.equal(comparison.body.disagreements[0].human_primary, 'VAGUENESS');
    assert.equal(comparison.body.disagreements[0].ai_primary, 'FABRICATION');
  });

  it('rejects invalid labels without overwriting the rater file', async () => {
    const before = fs.readFileSync(path.join(outputDir, 'human-validation-pilot-rater-rater-A.csv'), 'utf8');
    const bad = await request(baseUrl, 'PUT', '/api/human-coding/items/item-b', {
      coder_id: 'rater-A',
      human_primary: 'NOT_A_LABEL',
    });
    assert.equal(bad.status, 422);
    assert.equal(bad.body.success, false);
    assert.equal(bad.body.code, 'invalid_category');
    const after = fs.readFileSync(path.join(outputDir, 'human-validation-pilot-rater-rater-A.csv'), 'utf8');
    assert.equal(after, before);
  });
});
