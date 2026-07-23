/**
 * Pilot Routes — A1 Human Learner Pilot
 *
 * Phase endpoints walk a session through the runbook §2.4 flow:
 *   enroll → consent → intake → pretest → tutoring → posttest → exit
 *
 * Tutor turns go through the dedicated `/session/:id/turn` adapter. The pilot
 * row, not the browser, owns condition, curriculum, history, provider, and cap.
 *
 * Blinding: every response uses `pilotStore.getBlindedSessionView(...)` which
 * strips `condition_cell`, `participant_pid`, and `assignment_seed`. The only
 * way to read condition is via the admin endpoint, gated by PILOT_ADMIN_TOKEN.
 */

import { Router } from 'express';
import * as pilotStore from '../services/pilotStore.js';
import * as pilotItemBank from '../services/pilotItemBank.js';
import * as pilotAutoplay from '../services/pilotAutoplay.js';
import { pilotTutorSessionAdapter } from '../services/pilotTutorSessionAdapter.js';

const router = Router();

const ADMIN_TOKEN = process.env.PILOT_ADMIN_TOKEN || null;

function sendError(res, err, fallbackStatus = 500) {
  const status = err.statusCode || fallbackStatus;
  console.error('[pilot]', err.code || 'ERR', err.message);
  res.status(status).json({ error: err.message, code: err.code || null });
}

function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) {
    return res.status(503).json({ error: 'PILOT_ADMIN_TOKEN env var not configured' });
  }
  const provided = req.get('x-pilot-admin-token');
  if (provided !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'invalid admin token' });
  }
  return next();
}

// ─── Public meta ─────────────────────────────────────────────────────────

router.get('/config', (req, res) => {
  res.json({
    conditions: pilotStore.listConditions(),
    defaultLectureRef: pilotStore.getDefaultLectureRef(),
    tutoringCapMs: pilotStore.PILOT_TUTORING_CAP_MS,
    statuses: pilotStore.PILOT_STATUSES,
  });
});

// ─── Enrollment ──────────────────────────────────────────────────────────
//
// The public /enroll path is HUMAN-ONLY by construction: it never reads a
// learner_source from the body, so a participant can't mint a session that
// skips consent. Synthetic (llm) sessions are created through the admin-gated
// /admin/enroll-llm below — an operator affordance, not a participant one.

router.post('/enroll', (req, res) => {
  try {
    const { participant_pid = null, scenario_lecture_ref = null, force_condition = null } = req.body || {};

    // Idempotency for Prolific: if a PID has an active session, return it
    // rather than enrolling twice.
    if (participant_pid) {
      const existing = pilotStore.getSessionByPid(participant_pid);
      if (
        existing &&
        existing.status !== pilotStore.PILOT_STATUSES.ABANDONED &&
        existing.status !== pilotStore.PILOT_STATUSES.COMPLETED
      ) {
        return res.json({
          session: pilotStore.getBlindedSessionView(existing.id),
          resumed: true,
        });
      }
    }

    // force_condition is an internal-testing affordance. Off by default.
    const allowForce = process.env.PILOT_ALLOW_FORCE_CONDITION === 'true';
    const session = pilotStore.enrollSession({
      participantPid: participant_pid,
      scenarioLectureRef: scenario_lecture_ref,
      forceCondition: allowForce ? force_condition : null,
    });
    res.json({
      session: pilotStore.getBlindedSessionView(session.id),
      resumed: false,
    });
  } catch (err) {
    sendError(res, err);
  }
});

// ─── Session lookup ──────────────────────────────────────────────────────

router.get('/session/:id', (req, res) => {
  try {
    const view = pilotStore.getBlindedSessionView(req.params.id);
    if (!view) return res.status(404).json({ error: 'session not found' });
    res.json({
      session: view,
      tutoringTimeRemainingMs: view.tutoring_started_at
        ? pilotStore.tutoringTimeRemainingMs(pilotStore.getSession(req.params.id))
        : null,
    });
  } catch (err) {
    sendError(res, err);
  }
});

// ─── Phase transitions ───────────────────────────────────────────────────

router.post('/session/:id/consent', (req, res) => {
  try {
    if (!req.body?.consented) {
      return res.status(400).json({ error: 'consented: true required' });
    }
    const updated = pilotStore.recordConsent(req.params.id);
    res.json({ session: pilotStore.getBlindedSessionView(updated.id) });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/session/:id/intake', (req, res) => {
  try {
    const updated = pilotStore.recordIntake(req.params.id, req.body || {});
    res.json({ session: pilotStore.getBlindedSessionView(updated.id) });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/session/:id/pretest/start', (req, res) => {
  try {
    const updated = pilotStore.startPretest(req.params.id);
    res.json({ session: pilotStore.getBlindedSessionView(updated.id) });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/session/:id/items', (req, res) => {
  try {
    const phase = String(req.query.phase || '');
    if (!['pretest', 'posttest'].includes(phase)) {
      return res.status(400).json({ error: 'phase must be pretest or posttest' });
    }
    const session = pilotStore.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'session not found' });
    const { form, items } = pilotItemBank.getItemsForSession(req.params.id, phase);
    res.json({ phase, form, items });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/session/:id/pretest/submit', (req, res) => {
  try {
    const { responses } = req.body || {};
    const scored = pilotItemBank.scoreResponses(req.params.id, 'pretest', responses || []);
    const form = pilotItemBank.getFormForPhase(req.params.id, 'pretest');
    const updated = pilotStore.recordTestResponses(req.params.id, {
      phase: 'pretest',
      form,
      responses: scored,
    });
    res.json({
      session: pilotStore.getBlindedSessionView(updated.id),
      scored: scored.length,
    });
  } catch (err) {
    sendError(res, err, 400);
  }
});

router.post('/session/:id/tutoring/start', (req, res) => {
  try {
    const updated = pilotStore.startTutoring(req.params.id);
    res.json({
      session: pilotStore.getBlindedSessionView(updated.id),
      tutoringCapMs: pilotStore.PILOT_TUTORING_CAP_MS,
      tutoringEndsAt: updated.tutoring_started_at + pilotStore.PILOT_TUTORING_CAP_MS,
    });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/session/:id/turn', async (req, res) => {
  const wantsStream = req.query.stream === '1' || req.query.stream === 'true';
  const send = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
  try {
    if (wantsStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-store');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();
    }
    const result = await pilotTutorSessionAdapter.executeTurn({
      sessionId: req.params.id,
      learnerMessage: req.body?.learnerMessage,
      onDelta: wantsStream ? (delta) => send({ delta }) : null,
    });
    const publicResult = {
      finalMessage: result.finalMessage,
      sessionId: result.sessionId,
      turnIndex: result.turnIndex,
      tutoringTimeRemainingMs: result.tutoringTimeRemainingMs,
    };
    if (wantsStream) {
      send({ done: true, ...publicResult });
      return res.end();
    }
    return res.json(publicResult);
  } catch (err) {
    if (wantsStream && res.headersSent) {
      send({ error: err.message, code: err.code || null });
      return res.end();
    }
    return sendError(res, err);
  }
});

router.post('/session/:id/tutoring/complete', (req, res) => {
  try {
    const reason = req.body?.reason === 'timed_out' ? 'timed_out' : 'completed';
    const updated = pilotStore.endTutoring(req.params.id, { reason });
    res.json({ session: pilotStore.getBlindedSessionView(updated.id) });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/session/:id/posttest/start', (req, res) => {
  try {
    const updated = pilotStore.startPosttest(req.params.id);
    res.json({ session: pilotStore.getBlindedSessionView(updated.id) });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/session/:id/posttest/submit', (req, res) => {
  try {
    const { responses } = req.body || {};
    const scored = pilotItemBank.scoreResponses(req.params.id, 'posttest', responses || []);
    const form = pilotItemBank.getFormForPhase(req.params.id, 'posttest');
    const updated = pilotStore.recordTestResponses(req.params.id, {
      phase: 'posttest',
      form,
      responses: scored,
    });
    res.json({
      session: pilotStore.getBlindedSessionView(updated.id),
      scored: scored.length,
    });
  } catch (err) {
    sendError(res, err, 400);
  }
});

router.post('/session/:id/exit', (req, res) => {
  try {
    const updated = pilotStore.recordExitSurvey(req.params.id, req.body || {});
    res.json({ session: pilotStore.getBlindedSessionView(updated.id) });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/session/:id/abandon', (req, res) => {
  try {
    const updated = pilotStore.abandonSession(req.params.id, req.body?.reason || null);
    res.json({ session: pilotStore.getBlindedSessionView(updated.id) });
  } catch (err) {
    sendError(res, err);
  }
});

// ─── Admin (token-gated) ─────────────────────────────────────────────────

router.get('/admin/counts', requireAdmin, (req, res) => {
  try {
    res.json({
      counts: pilotStore.getConditionCounts(),
      recruitmentEnabled: pilotStore.isRecruitmentEnabled(),
    });
  } catch (err) {
    sendError(res, err);
  }
});

// Create a synthetic llm-learner session. Enrollment itself spends nothing; the
// paid tutor↔learner loop is driven separately by /admin/session/:id/autoplay.
// Returns the FULL (unblinded) session — the operator may see the condition.
router.post('/admin/enroll-llm', requireAdmin, (req, res) => {
  try {
    const { scenario_lecture_ref = null, condition = null } = req.body || {};
    const session = pilotStore.enrollSession({
      learnerSource: pilotStore.LEARNER_SOURCES.LLM,
      scenarioLectureRef: scenario_lecture_ref,
      forceCondition: condition,
    });
    res.json({ session });
  } catch (err) {
    sendError(res, err);
  }
});

// Drive an llm-learner session through the tutor loop. METERED when mock=false.
// Safe-by-default: mock=true (deterministic, zero network) unless the operator
// explicitly opts into spend. The real path blocks until the run completes; it
// is bounded by max_turn_pairs (clamped server-side) and a USD backstop. Spend
// is returned so the operator sees exactly what it cost.
router.post('/admin/session/:id/autoplay', requireAdmin, async (req, res) => {
  try {
    const {
      max_turn_pairs = pilotAutoplay.DEFAULT_MAX_TURN_PAIRS,
      cost_cap_usd = pilotAutoplay.DEFAULT_COST_CAP_USD,
      topic = null,
      persona_id = 'eager_novice',
      mock = true,
    } = req.body || {};

    const deps = mock ? pilotAutoplay.buildMockDeps() : {};
    const result = await pilotAutoplay.runAutoplay(
      {
        sessionId: req.params.id,
        maxTurnPairs: max_turn_pairs,
        costCapUsd: cost_cap_usd,
        topic,
        personaId: persona_id,
      },
      deps,
    );
    res.json({ autoplay: result });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/admin/sessions', requireAdmin, (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const status = req.query.status || null;
    res.json({ sessions: pilotStore.listSessions({ limit, status }) });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/admin/session/:id', requireAdmin, (req, res) => {
  try {
    const session = pilotStore.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'session not found' });
    const turns = pilotStore.listTurns(req.params.id);
    const tests = pilotStore.listTestResponses(req.params.id);
    res.json({ session, turns, tests });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
