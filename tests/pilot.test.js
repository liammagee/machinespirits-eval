/**
 * Pilot routes — A1 human-learner pilot persistence layer.
 *
 * Exercises the phase state machine, blinding (condition_cell never echoed
 * to participants), admin auth, and turn persistence. Does NOT call
 * `/api/chat/turn` because that requires an LLM substrate; turn-level
 * persistence is tested by calling `pilotStore.appendTurn` directly.
 *
 * Uses an isolated temp DB via dynamic import so prod data isn't touched.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';

// Configure isolated DB BEFORE importing modules that open it.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pilot-test-'));
process.env.EVAL_DB_PATH = path.join(tmpDir, 'pilot-test.db');
process.env.PILOT_ALLOW_FORCE_CONDITION = 'true';
process.env.PILOT_ADMIN_TOKEN = 'test-admin-token';

const { app } = await import('../server.js');
const pilotStore = await import('../services/pilotStore.js');

function request(baseUrl, method, route, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${baseUrl}${route}`);
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('pilot routes', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise((r) => server.close(r));
    // tmpDir is left in place for the rest of the test suites that share the
    // EVAL_DB_PATH (otherwise the dynamic-imported ingest script would try to
    // open a connection to a now-deleted directory).
  });

  it('GET /api/pilot/config returns conditions, default lecture, cap', async () => {
    const { status, body } = await request(baseUrl, 'GET', '/api/pilot/config');
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(body.conditions));
    assert.ok(body.conditions.length >= 2, 'expected at least 2 conditions');
    assert.ok(body.tutoringCapMs > 0);
    assert.strictEqual(typeof body.defaultLectureRef, 'string');
  });

  it('POST /api/pilot/enroll creates a session, blinded view omits condition_cell', async () => {
    const { status, body } = await request(baseUrl, 'POST', '/api/pilot/enroll', {});
    assert.strictEqual(status, 200);
    assert.ok(body.session);
    assert.ok(body.session.id);
    assert.strictEqual(body.session.status, 'enrolled');
    assert.strictEqual(body.session.condition_cell, undefined,
      'blinded view must NOT include condition_cell');
    assert.strictEqual(body.session.assignment_seed, undefined,
      'blinded view must NOT include assignment_seed');
    assert.strictEqual(body.session.participant_pid, undefined,
      'blinded view must NOT include participant_pid');
  });

  it('POST /api/pilot/enroll with PID is idempotent for active session', async () => {
    const pid = `test-pid-${Date.now()}`;
    const first = await request(baseUrl, 'POST', '/api/pilot/enroll', { participant_pid: pid });
    const second = await request(baseUrl, 'POST', '/api/pilot/enroll', { participant_pid: pid });
    assert.strictEqual(first.body.session.id, second.body.session.id,
      'same PID should return same session');
    assert.strictEqual(second.body.resumed, true);
  });

  it('full phase walk: enroll → consent → intake → pretest → tutoring → posttest → exit', async () => {
    const enroll = await request(baseUrl, 'POST', '/api/pilot/enroll', {
      force_condition: 'cell_5_recog_single_unified',
    });
    const id = enroll.body.session.id;

    let r = await request(baseUrl, 'POST', `/api/pilot/session/${id}/consent`, { consented: true });
    assert.strictEqual(r.body.session.status, 'consented');

    r = await request(baseUrl, 'POST', `/api/pilot/session/${id}/intake`, {
      age_band: '25-34', prior_math: 'some_high_school', comfort_screener_score: 4,
    });
    assert.strictEqual(r.body.session.status, 'intake_done');
    assert.deepStrictEqual(r.body.session.intake_data, {
      age_band: '25-34', prior_math: 'some_high_school', comfort_screener_score: 4,
    });

    r = await request(baseUrl, 'POST', `/api/pilot/session/${id}/pretest/start`);
    assert.strictEqual(r.body.session.status, 'pretest_in_progress');

    // Fetch the actual items the server will score against (form is determined
    // by session UUID parity, not chosen by client).
    const preItemsResp = await request(baseUrl, 'GET', `/api/pilot/session/${id}/items?phase=pretest`);
    assert.strictEqual(preItemsResp.status, 200);
    assert.ok(preItemsResp.body.items.length > 0);
    assert.ok(['A', 'B'].includes(preItemsResp.body.form));
    // Items returned to participants must NOT carry the answer key
    for (const item of preItemsResp.body.items) {
      assert.strictEqual(item.correct, undefined,
        'public item view must NOT include `correct`');
    }

    // Submit responses — pick the first choice for each item so we get a
    // mixed correctness pattern.
    const preResponses = preItemsResp.body.items.slice(0, 3).map((item, i) => ({
      item_id: item.id,
      item_position: i,
      response_value: item.choices[0].value,
    }));
    r = await request(baseUrl, 'POST', `/api/pilot/session/${id}/pretest/submit`, {
      responses: preResponses,
    });
    assert.strictEqual(r.body.session.status, 'pretest_done');
    assert.strictEqual(r.body.scored, preResponses.length);

    r = await request(baseUrl, 'POST', `/api/pilot/session/${id}/tutoring/start`);
    assert.strictEqual(r.body.session.status, 'tutoring');
    assert.ok(r.body.tutoringEndsAt > Date.now());

    r = await request(baseUrl, 'POST', `/api/pilot/session/${id}/tutoring/complete`);
    assert.strictEqual(r.body.session.status, 'tutoring_done');

    r = await request(baseUrl, 'POST', `/api/pilot/session/${id}/posttest/start`);
    assert.strictEqual(r.body.session.status, 'posttest_in_progress');

    const postItemsResp = await request(baseUrl, 'GET', `/api/pilot/session/${id}/items?phase=posttest`);
    assert.strictEqual(postItemsResp.status, 200);
    // Pretest and posttest must be DIFFERENT forms (counterbalanced)
    assert.notStrictEqual(postItemsResp.body.form, preItemsResp.body.form,
      'pre/post forms must differ for counterbalancing');

    const postResponses = postItemsResp.body.items.slice(0, 3).map((item, i) => ({
      item_id: item.id,
      item_position: i,
      response_value: item.choices[0].value,
    }));
    r = await request(baseUrl, 'POST', `/api/pilot/session/${id}/posttest/submit`, {
      responses: postResponses,
    });
    assert.strictEqual(r.body.session.status, 'posttest_done');

    r = await request(baseUrl, 'POST', `/api/pilot/session/${id}/exit`, {
      nasa_tlx: { mental: 50, effort: 40 },
      engagement_likert: { understood: 4, would_use_again: 5, learned_something: 4 },
      open_ended: { tutor_got_right: 'asked good questions', felt_misunderstood: 'glossed over fractions of a set' },
    });
    assert.strictEqual(r.body.session.status, 'completed');
  });

  it('illegal phase transitions return 409 PILOT_BAD_TRANSITION', async () => {
    const enroll = await request(baseUrl, 'POST', '/api/pilot/enroll', {});
    const id = enroll.body.session.id;
    // try to start tutoring straight from enrolled (must consent first)
    const r = await request(baseUrl, 'POST', `/api/pilot/session/${id}/tutoring/start`);
    assert.strictEqual(r.status, 409);
    assert.strictEqual(r.body.code, 'PILOT_BAD_TRANSITION');
  });

  it('admin endpoints require valid token', async () => {
    const noAuth = await request(baseUrl, 'GET', '/api/pilot/admin/counts');
    assert.strictEqual(noAuth.status, 401);

    const wrong = await request(baseUrl, 'GET', '/api/pilot/admin/counts', null, {
      'x-pilot-admin-token': 'wrong',
    });
    assert.strictEqual(wrong.status, 401);

    const ok = await request(baseUrl, 'GET', '/api/pilot/admin/counts', null, {
      'x-pilot-admin-token': 'test-admin-token',
    });
    assert.strictEqual(ok.status, 200);
    assert.ok(ok.body.counts);
  });

  it('admin session detail exposes condition_cell (unblinded analyst view)', async () => {
    const enroll = await request(baseUrl, 'POST', '/api/pilot/enroll', {
      force_condition: 'cell_1_base_single_unified',
    });
    const id = enroll.body.session.id;
    const r = await request(baseUrl, 'GET', `/api/pilot/admin/session/${id}`, null, {
      'x-pilot-admin-token': 'test-admin-token',
    });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.session.condition_cell, 'cell_1_base_single_unified');
  });

  it('GET unknown session returns 404', async () => {
    const r = await request(baseUrl, 'GET', '/api/pilot/session/00000000-0000-0000-0000-000000000000');
    assert.strictEqual(r.status, 404);
  });
});

describe('ingest-pilot-sessions — pure helpers', () => {
  let pairTurns, buildDialogueLog;

  before(async () => {
    const mod = await import('../scripts/ingest-pilot-sessions.js');
    pairTurns = mod.pairTurns;
    buildDialogueLog = mod.buildDialogueLog;
  });

  it('pairTurns groups alternating learner→tutor turns', () => {
    const turns = [
      { role: 'learner', content: 'a' }, { role: 'tutor', content: 'A' },
      { role: 'learner', content: 'b' }, { role: 'tutor', content: 'B' },
    ];
    const pairs = pairTurns(turns);
    assert.strictEqual(pairs.length, 2);
    assert.strictEqual(pairs[0].learner.content, 'a');
    assert.strictEqual(pairs[0].tutor.content, 'A');
  });

  it('pairTurns drops orphan learner turn at end (timer expiry)', () => {
    const turns = [
      { role: 'learner', content: 'a' }, { role: 'tutor', content: 'A' },
      { role: 'learner', content: 'b' }, // no tutor reply
    ];
    const pairs = pairTurns(turns);
    assert.strictEqual(pairs.length, 1);
  });

  it('pairTurns skips an out-of-order tutor-first sequence', () => {
    const turns = [
      { role: 'tutor', content: 'huh' }, // shouldn't happen but we tolerate
      { role: 'learner', content: 'a' }, { role: 'tutor', content: 'A' },
    ];
    const pairs = pairTurns(turns);
    assert.strictEqual(pairs.length, 1);
    assert.strictEqual(pairs[0].learner.content, 'a');
  });

  it('buildDialogueLog produces eval-runner-shaped JSON', () => {
    const session = {
      id: 'test-session',
      condition_cell: 'cell_5_recog_single_unified',
      scenario_lecture_ref: '101-lecture-1',
      participant_pid_hash: 'hash',
      tutoring_started_at: 1000,
      tutoring_completed_at: 2000,
      total_tutoring_ms: 1000,
    };
    const turns = [
      { role: 'learner', content: 'hello', config_hash: 'c1', dialogue_content_hash: 'd1' },
      { role: 'tutor',   content: 'hi there',
        config_hash: 'c1', dialogue_content_hash: 'd2',
        latency_ms: 1000, input_tokens: 500, output_tokens: 30,
        ego_model: 'sonnet', deliberation: null, was_revised: 0 },
    ];
    const profile = {
      ego: { provider: 'openrouter', model: 'sonnet' },
      superego: null,
      factors: { multi_agent_tutor: false },
      recognition_mode: true,
    };
    const log = buildDialogueLog(session, turns, profile);
    assert.strictEqual(log.dialogueId, 'pilot-test-session');
    assert.strictEqual(log.conversationMode, 'messages');
    assert.strictEqual(log.rounds, 1);
    assert.strictEqual(log.turns.length, 1);
    assert.strictEqual(log.turns[0].learnerMessage, 'hello');
    assert.strictEqual(log.turns[0].suggestion.message, 'hi there');
    // trace must include the four canonical entries the rubric scorer expects
    const actions = log.dialogueTrace.map((e) => `${e.agent}/${e.action}`);
    assert.ok(actions.includes('learner/turn_action'), `missing learner/turn_action; got ${actions}`);
    assert.ok(actions.includes('tutor/context_input'));
    assert.ok(actions.includes('ego/generate'));
    assert.ok(actions.includes('tutor/final_output'));
    // unblinded analyst data preserved
    assert.strictEqual(log.pilot.sessionId, 'test-session');
    assert.strictEqual(log.pilot.conditionCell, 'cell_5_recog_single_unified');
  });
});

describe('pilotStore — turn persistence + hashing', () => {
  it('appendTurn computes monotonic dialogue_content_hash and turn_index', () => {
    const session = pilotStore.enrollSession({ forceCondition: 'cell_1_base_single_unified' });
    pilotStore.recordConsent(session.id);
    pilotStore.recordIntake(session.id, {});
    pilotStore.startPretest(session.id);
    pilotStore.recordTestResponses(session.id, {
      phase: 'pretest', form: 'A',
      responses: [{ item_id: 'x', item_position: 0, response_value: '1', is_correct: true }],
    });
    pilotStore.startTutoring(session.id);

    const configHash = pilotStore.computeConfigHash({
      cellName: 'cell_1_base_single_unified',
      egoConfig: { provider: 'openrouter', model: 'sonnet', prompt_file: 'tutor-ego.md' },
      egoPromptText: 'You are a tutor.',
      topic: 'fractions',
    });

    const t1 = pilotStore.appendTurn(session.id, {
      role: 'learner', content: 'what is 1/2 + 1/4?', configHash,
    });
    const t2 = pilotStore.appendTurn(session.id, {
      role: 'tutor', content: 'Good question — let\'s think about it.',
      configHash, latencyMs: 1234, inputTokens: 100, outputTokens: 50,
    });
    assert.strictEqual(t1.turnIndex, 0);
    assert.strictEqual(t2.turnIndex, 1);
    assert.notStrictEqual(t1.dialogueContentHash, t2.dialogueContentHash,
      'cumulative hashes must change as conversation grows');

    const turns = pilotStore.listTurns(session.id);
    assert.strictEqual(turns.length, 2);
    assert.strictEqual(turns[0].role, 'learner');
    assert.strictEqual(turns[1].role, 'tutor');
    assert.strictEqual(turns[1].latency_ms, 1234);
  });

  it('isTutoringExpired enforces the 15-min cap', () => {
    const session = pilotStore.enrollSession({ forceCondition: 'cell_1_base_single_unified' });
    pilotStore.recordConsent(session.id);
    pilotStore.recordIntake(session.id, {});
    pilotStore.startPretest(session.id);
    pilotStore.recordTestResponses(session.id, {
      phase: 'pretest',
      responses: [{ item_id: 'x', item_position: 0 }],
    });
    pilotStore.startTutoring(session.id);
    const refreshed = pilotStore.getSession(session.id);
    assert.strictEqual(pilotStore.isTutoringExpired(refreshed), false);
    // Simulate elapsed time by forcing the at-now argument past the cap
    const futureMs = refreshed.tutoring_started_at + pilotStore.PILOT_TUTORING_CAP_MS + 1;
    assert.strictEqual(pilotStore.isTutoringExpired(refreshed, futureMs), true);
  });

  it('computeConfigHash is deterministic and prompt-content-sensitive', () => {
    const a = pilotStore.computeConfigHash({
      cellName: 'cell_1_base_single_unified',
      egoConfig: { provider: 'or', model: 'm', prompt_file: 'p.md' },
      egoPromptText: 'prompt v1',
    });
    const b = pilotStore.computeConfigHash({
      cellName: 'cell_1_base_single_unified',
      egoConfig: { provider: 'or', model: 'm', prompt_file: 'p.md' },
      egoPromptText: 'prompt v1',
    });
    const c = pilotStore.computeConfigHash({
      cellName: 'cell_1_base_single_unified',
      egoConfig: { provider: 'or', model: 'm', prompt_file: 'p.md' },
      egoPromptText: 'prompt v2',
    });
    assert.strictEqual(a, b, 'identical inputs must produce identical hash');
    assert.notStrictEqual(a, c, 'changed prompt text must change hash');
  });
});
