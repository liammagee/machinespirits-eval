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
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => {
          data += c;
        });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
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
    assert.strictEqual(body.session.condition_cell, undefined, 'blinded view must NOT include condition_cell');
    assert.strictEqual(body.session.assignment_seed, undefined, 'blinded view must NOT include assignment_seed');
    assert.strictEqual(body.session.participant_pid, undefined, 'blinded view must NOT include participant_pid');
  });

  it('POST /api/pilot/enroll with PID is gated when recruitment is disabled', async () => {
    // PID-bearing enrollment is the real-participant (Prolific) path, closed by
    // default until IRB sign-off flips PILOT_RECRUITMENT_ENABLED on.
    const r = await request(baseUrl, 'POST', '/api/pilot/enroll', { participant_pid: `gated-${Date.now()}` });
    assert.strictEqual(r.status, 403);
    assert.strictEqual(r.body.code, 'PILOT_RECRUITMENT_DISABLED');
  });

  it('POST /api/pilot/enroll with PID is idempotent for active session (recruitment enabled)', async () => {
    // Idempotency only matters once the gated real-participant path is open, so
    // exercise it in the recruitment-enabled regime and restore the gate after.
    process.env.PILOT_RECRUITMENT_ENABLED = 'true';
    try {
      const pid = `test-pid-${Date.now()}`;
      const first = await request(baseUrl, 'POST', '/api/pilot/enroll', { participant_pid: pid });
      const second = await request(baseUrl, 'POST', '/api/pilot/enroll', { participant_pid: pid });
      assert.strictEqual(first.body.session.id, second.body.session.id, 'same PID should return same session');
      assert.strictEqual(second.body.resumed, true);
    } finally {
      delete process.env.PILOT_RECRUITMENT_ENABLED;
    }
  });

  it('full phase walk: enroll → consent → intake → pretest → tutoring → posttest → exit', async () => {
    const enroll = await request(baseUrl, 'POST', '/api/pilot/enroll', {
      force_condition: 'cell_5_recog_single_unified',
    });
    const id = enroll.body.session.id;

    let r = await request(baseUrl, 'POST', `/api/pilot/session/${id}/consent`, { consented: true });
    assert.strictEqual(r.body.session.status, 'consented');

    r = await request(baseUrl, 'POST', `/api/pilot/session/${id}/intake`, {
      age_band: '25-34',
      prior_math: 'some_high_school',
      comfort_screener_score: 4,
    });
    assert.strictEqual(r.body.session.status, 'intake_done');
    assert.deepStrictEqual(r.body.session.intake_data, {
      age_band: '25-34',
      prior_math: 'some_high_school',
      comfort_screener_score: 4,
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
      assert.strictEqual(item.correct, undefined, 'public item view must NOT include `correct`');
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
    assert.notStrictEqual(
      postItemsResp.body.form,
      preItemsResp.body.form,
      'pre/post forms must differ for counterbalancing',
    );

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

    const queryOnly = await request(baseUrl, 'GET', '/api/pilot/admin/counts?token=test-admin-token');
    assert.strictEqual(queryOnly.status, 401);

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
      { role: 'learner', content: 'a' },
      { role: 'tutor', content: 'A' },
      { role: 'learner', content: 'b' },
      { role: 'tutor', content: 'B' },
    ];
    const pairs = pairTurns(turns);
    assert.strictEqual(pairs.length, 2);
    assert.strictEqual(pairs[0].learner.content, 'a');
    assert.strictEqual(pairs[0].tutor.content, 'A');
  });

  it('pairTurns drops orphan learner turn at end (timer expiry)', () => {
    const turns = [
      { role: 'learner', content: 'a' },
      { role: 'tutor', content: 'A' },
      { role: 'learner', content: 'b' }, // no tutor reply
    ];
    const pairs = pairTurns(turns);
    assert.strictEqual(pairs.length, 1);
  });

  it('pairTurns skips an out-of-order tutor-first sequence', () => {
    const turns = [
      { role: 'tutor', content: 'huh' }, // shouldn't happen but we tolerate
      { role: 'learner', content: 'a' },
      { role: 'tutor', content: 'A' },
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
      {
        role: 'tutor',
        content: 'hi there',
        config_hash: 'c1',
        dialogue_content_hash: 'd2',
        latency_ms: 1000,
        input_tokens: 500,
        output_tokens: 30,
        ego_model: 'sonnet',
        deliberation: null,
        was_revised: 0,
      },
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
      phase: 'pretest',
      form: 'A',
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
      role: 'learner',
      content: 'what is 1/2 + 1/4?',
      configHash,
    });
    const t2 = pilotStore.appendTurn(session.id, {
      role: 'tutor',
      content: "Good question — let's think about it.",
      configHash,
      latencyMs: 1234,
      inputTokens: 100,
      outputTokens: 50,
    });
    assert.strictEqual(t1.turnIndex, 0);
    assert.strictEqual(t2.turnIndex, 1);
    assert.notStrictEqual(
      t1.dialogueContentHash,
      t2.dialogueContentHash,
      'cumulative hashes must change as conversation grows',
    );

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

// ─────────────────────────────────────────────────────────────────────────────
// learner_source seam — the swappable human|llm provenance column. Both sources
// feed the identical tutor engine + the same pilot_turns store; these tests pin
// the three places the seam changes behaviour: enrollment defaults, the
// recruitment gate, and the llm fast-path transition table.
// ─────────────────────────────────────────────────────────────────────────────

describe('pilotStore — learner_source seam', () => {
  const { LEARNER_SOURCES } = pilotStore;

  it('enrollSession defaults learner_source to human', () => {
    const s = pilotStore.enrollSession({ forceCondition: 'cell_1_base_single_unified' });
    assert.strictEqual(s.learner_source, 'human');
  });

  it('enrollSession with LLM source persists learner_source=llm', () => {
    const s = pilotStore.enrollSession({
      learnerSource: LEARNER_SOURCES.LLM,
      forceCondition: 'cell_5_recog_single_unified',
    });
    assert.strictEqual(s.learner_source, 'llm');
  });

  it('blinded view exposes learner_source but still hides condition_cell', () => {
    // learner_source is not an assignment leak (it says nothing about which arm),
    // so it passes through the blind — but condition_cell must stay stripped.
    const s = pilotStore.enrollSession({
      learnerSource: LEARNER_SOURCES.LLM,
      forceCondition: 'cell_1_base_single_unified',
    });
    const blinded = pilotStore.getBlindedSessionView(s.id);
    assert.strictEqual(blinded.learner_source, 'llm');
    assert.strictEqual(blinded.condition_cell, undefined, 'condition_cell still stripped');
  });

  it('recruitment gate: PID-bearing human enrollment throws 403 when disabled', () => {
    // Default test env leaves PILOT_RECRUITMENT_ENABLED unset → gate is closed.
    assert.strictEqual(pilotStore.isRecruitmentEnabled(), false);
    assert.throws(
      () =>
        pilotStore.enrollSession({
          participantPid: 'real-participant-1',
          forceCondition: 'cell_1_base_single_unified',
        }),
      (err) => err.code === 'PILOT_RECRUITMENT_DISABLED' && err.statusCode === 403,
    );
  });

  it('recruitment gate: pid-less human (self/colleague) enrollment passes when disabled', () => {
    const s = pilotStore.enrollSession({ forceCondition: 'cell_1_base_single_unified' });
    assert.strictEqual(s.status, 'enrolled');
    assert.strictEqual(s.learner_source, 'human');
  });

  it('recruitment gate: llm enrollment bypasses the gate even with a PID', () => {
    // Synthetic sessions are not human subjects — the IRB gate must not apply.
    const s = pilotStore.enrollSession({
      participantPid: 'synthetic-1',
      learnerSource: LEARNER_SOURCES.LLM,
      forceCondition: 'cell_1_base_single_unified',
    });
    assert.strictEqual(s.learner_source, 'llm');
    assert.strictEqual(s.status, 'enrolled');
  });

  it('recruitment gate: PID-bearing human passes when PILOT_RECRUITMENT_ENABLED=true', () => {
    process.env.PILOT_RECRUITMENT_ENABLED = 'true';
    try {
      assert.strictEqual(pilotStore.isRecruitmentEnabled(), true);
      const s = pilotStore.enrollSession({
        participantPid: `irb-approved-${Date.now()}`,
        forceCondition: 'cell_1_base_single_unified',
      });
      assert.strictEqual(s.status, 'enrolled');
    } finally {
      delete process.env.PILOT_RECRUITMENT_ENABLED;
    }
  });

  it('llm fast-path: enrolled → tutoring is legal (skips consent/intake/pretest)', () => {
    const s = pilotStore.enrollSession({
      learnerSource: LEARNER_SOURCES.LLM,
      forceCondition: 'cell_1_base_single_unified',
    });
    const t = pilotStore.startTutoring(s.id);
    assert.strictEqual(t.status, 'tutoring');
  });

  it('human path: enrolled → tutoring is illegal (must consent first)', () => {
    // Same transition, different source → the asymmetry the LLM table encodes.
    const s = pilotStore.enrollSession({ forceCondition: 'cell_1_base_single_unified' });
    assert.throws(
      () => pilotStore.startTutoring(s.id),
      (err) => err.code === 'PILOT_BAD_TRANSITION' && err.statusCode === 409,
    );
  });

  it('getConditionCounts splits human / llm subtotals per cell', () => {
    const cell = 'cell_5_recog_single_unified';
    const before = pilotStore.getConditionCounts()[cell];
    pilotStore.enrollSession({ forceCondition: cell });
    pilotStore.enrollSession({ learnerSource: LEARNER_SOURCES.LLM, forceCondition: cell });
    const after = pilotStore.getConditionCounts()[cell];
    assert.strictEqual(after.human, before.human + 1, 'human subtotal must increment');
    assert.strictEqual(after.llm, before.llm + 1, 'llm subtotal must increment');
    assert.strictEqual(after.total, before.total + 2, 'total must include both sources');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Autoplay mock smoke. The whole point of the mock dep set is a wiring test that
// spends nothing: it drives the real orchestration (enrolled → N pairs →
// tutoring_done, real config_hash + cumulative dialogue_content_hash) while the
// only two paid calls — the learner and the tutor — are swapped for deterministic
// stubs. A regression here that reached the network would surface as a non-zero
// spend, which we assert is exactly 0.
// ─────────────────────────────────────────────────────────────────────────────

describe('pilotAutoplay — mock smoke (no paid calls)', () => {
  let runAutoplay;
  let buildMockDeps;
  let MAX_TURN_PAIRS_CEILING;

  before(async () => {
    const mod = await import('../services/pilotAutoplay.js');
    runAutoplay = mod.runAutoplay;
    buildMockDeps = mod.buildMockDeps;
    MAX_TURN_PAIRS_CEILING = mod.MAX_TURN_PAIRS_CEILING;
  });

  it('drives an llm session to tutoring_done with a format-identical transcript and zero spend', async () => {
    const session = pilotStore.enrollSession({
      learnerSource: pilotStore.LEARNER_SOURCES.LLM,
      forceCondition: 'cell_1_base_single_unified',
    });

    const result = await runAutoplay({ sessionId: session.id, maxTurnPairs: 2 }, buildMockDeps());

    assert.strictEqual(result.mock, true, 'mock dep set must mark the run as mock');
    assert.strictEqual(result.learnerSource, 'llm');
    assert.strictEqual(result.turnPairs, 2, 'should run exactly the requested pair budget');
    assert.strictEqual(result.status, 'tutoring_done', 'autoplay must end the tutoring phase');
    assert.strictEqual(result.stoppedReason, 'max_turn_pairs');

    // ZERO SPEND — the safety invariant of the mock path.
    assert.strictEqual(result.spend.inputTokens, 0);
    assert.strictEqual(result.spend.outputTokens, 0);
    assert.strictEqual(result.spend.estimatedCostUsd, 0);

    // Persisted transcript is format-identical to a human session: alternating
    // learner→tutor turns with a monotonically advancing cumulative hash.
    const turns = pilotStore.listTurns(session.id);
    assert.strictEqual(turns.length, 4, '2 pairs = 4 turns');
    assert.deepStrictEqual(
      turns.map((t) => t.role),
      ['learner', 'tutor', 'learner', 'tutor'],
    );
    const hashes = new Set(turns.map((t) => t.dialogue_content_hash));
    assert.strictEqual(hashes.size, 4, 'cumulative hash must advance every turn');

    // The learner turns carry their ego/superego deliberation — the one artifact
    // a human session has no analogue for.
    for (const lt of turns.filter((t) => t.role === 'learner')) {
      assert.ok(lt.deliberation, 'llm learner turn must persist deliberation');
      const delib = JSON.parse(lt.deliberation);
      assert.ok(Array.isArray(delib) && delib.length >= 1);
    }
  });

  it('rejects a human session with 409 PILOT_NOT_LLM_SESSION', async () => {
    const human = pilotStore.enrollSession({ forceCondition: 'cell_1_base_single_unified' });
    await assert.rejects(
      () => runAutoplay({ sessionId: human.id }, buildMockDeps()),
      (err) => err.code === 'PILOT_NOT_LLM_SESSION' && err.statusCode === 409,
    );
  });

  it('clamps maxTurnPairs to the ceiling', async () => {
    const session = pilotStore.enrollSession({
      learnerSource: pilotStore.LEARNER_SOURCES.LLM,
      forceCondition: 'cell_1_base_single_unified',
    });
    const result = await runAutoplay({ sessionId: session.id, maxTurnPairs: 999 }, buildMockDeps());
    assert.strictEqual(result.turnPairs, MAX_TURN_PAIRS_CEILING, 'pair budget must be clamped to the ceiling');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin surface for the llm-learner track: synthetic enrollment, the recruitment
// flag the operator UI reads, and the metered autoplay endpoint driven in its
// safe-by-default mock mode (zero spend).
// ─────────────────────────────────────────────────────────────────────────────

describe('pilot routes — llm-learner admin surface', () => {
  let server;
  let baseUrl;
  const ADMIN = { 'x-pilot-admin-token': 'test-admin-token' };

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise((r) => server.close(r));
  });

  it('POST /admin/enroll-llm requires a valid admin token', async () => {
    const noAuth = await request(baseUrl, 'POST', '/api/pilot/admin/enroll-llm', {});
    assert.strictEqual(noAuth.status, 401);
  });

  it('POST /admin/enroll-llm creates an unblinded llm session', async () => {
    const r = await request(
      baseUrl,
      'POST',
      '/api/pilot/admin/enroll-llm',
      { condition: 'cell_5_recog_single_unified' },
      ADMIN,
    );
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.session.learner_source, 'llm');
    // The operator (admin) view is UNBLINDED — condition is visible by design.
    assert.strictEqual(r.body.session.condition_cell, 'cell_5_recog_single_unified');
  });

  it('GET /admin/counts surfaces the recruitmentEnabled flag', async () => {
    const r = await request(baseUrl, 'GET', '/api/pilot/admin/counts', null, ADMIN);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.recruitmentEnabled, false);
    assert.ok(r.body.counts);
  });

  it('POST /admin/session/:id/autoplay (mock) drives the session with zero spend', async () => {
    const enroll = await request(
      baseUrl,
      'POST',
      '/api/pilot/admin/enroll-llm',
      { condition: 'cell_1_base_single_unified' },
      ADMIN,
    );
    const id = enroll.body.session.id;

    const r = await request(
      baseUrl,
      'POST',
      `/api/pilot/admin/session/${id}/autoplay`,
      { max_turn_pairs: 2, mock: true },
      ADMIN,
    );
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.autoplay.turnPairs, 2);
    assert.strictEqual(r.body.autoplay.mock, true);
    assert.strictEqual(r.body.autoplay.status, 'tutoring_done');
    assert.strictEqual(r.body.autoplay.spend.estimatedCostUsd, 0);
  });

  it('POST /admin/session/:id/autoplay rejects a human session (409)', async () => {
    const enroll = await request(baseUrl, 'POST', '/api/pilot/enroll', {
      force_condition: 'cell_1_base_single_unified',
    });
    const id = enroll.body.session.id;
    const r = await request(baseUrl, 'POST', `/api/pilot/admin/session/${id}/autoplay`, { mock: true }, ADMIN);
    assert.strictEqual(r.status, 409);
    assert.strictEqual(r.body.code, 'PILOT_NOT_LLM_SESSION');
  });
});
