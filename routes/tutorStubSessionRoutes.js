import { Router } from 'express';

import {
  TUTOR_STUB_SESSION_HOST_SCHEMA,
  TUTOR_STUB_SESSION_HOST_VERSION,
  TutorStubSessionHostError,
} from '../services/tutorStubSessionHost.js';
import {
  TUTOR_STUB_SESSION_RUNTIME_SCHEMA,
  TUTOR_STUB_SESSION_RUNTIME_VERSION,
} from '../services/tutorStubSessionRuntime.js';

export const TUTOR_STUB_SESSION_HTTP_SCHEMA = 'machinespirits.tutor-stub.session-http.v1';
export const TUTOR_STUB_SESSION_HTTP_VERSION = 1;

const MAX_INPUT_LENGTH = 32_768;
const STEP_KINDS = new Set(['auto', 'learner', 'command']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function invalid(message) {
  return new TutorStubSessionHostError('invalid_request', message, 400);
}

function route(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

function envelope(payload = {}) {
  return {
    schema: TUTOR_STUB_SESSION_HTTP_SCHEMA,
    version: TUTOR_STUB_SESSION_HTTP_VERSION,
    ...payload,
  };
}

function bodyObject(req) {
  if (req.body === undefined || req.body === null) return {};
  if (!isPlainObject(req.body)) throw invalid('request body must be a JSON object');
  return req.body;
}

/**
 * Versioned HTTP transport over an injected tutor-stub session host.
 * The router owns validation and status codes only; tutor behavior stays in
 * the runtime factory supplied by the web/Electron host.
 */
export function createTutorStubSessionRouter({ host } = {}) {
  if (!host || typeof host.create !== 'function' || typeof host.step !== 'function') {
    throw new Error('tutor-stub session router requires a session host');
  }

  const router = Router();

  router.get('/', (_req, res) => {
    res.json(
      envelope({
        host: { schema: TUTOR_STUB_SESSION_HOST_SCHEMA, version: TUTOR_STUB_SESSION_HOST_VERSION },
        runtime: { schema: TUTOR_STUB_SESSION_RUNTIME_SCHEMA, version: TUTOR_STUB_SESSION_RUNTIME_VERSION },
        endpoints: [
          'POST /sessions',
          'GET /sessions',
          'GET /sessions/:sessionId',
          'POST /sessions/:sessionId/steps',
          'POST /sessions/:sessionId/resume',
          'POST /sessions/:sessionId/reset',
          'POST /sessions/:sessionId/finalize',
        ],
      }),
    );
  });

  router.post(
    '/sessions',
    route(async (req, res) => {
      const session = await host.create(bodyObject(req));
      res.status(201).json(envelope({ session }));
    }),
  );

  router.get('/sessions', (_req, res) => {
    const sessions = host.list();
    res.json(envelope({ count: sessions.length, sessions }));
  });

  router.get(
    '/sessions/:sessionId',
    route(async (req, res) => {
      res.json(envelope({ session: await host.get(req.params.sessionId) }));
    }),
  );

  router.post(
    '/sessions/:sessionId/steps',
    route(async (req, res) => {
      const body = bodyObject(req);
      if (typeof body.input !== 'string' || !body.input.trim()) throw invalid('step input must be a non-empty string');
      if (body.input.length > MAX_INPUT_LENGTH) {
        throw invalid(`step input must be at most ${MAX_INPUT_LENGTH} characters`);
      }
      const kind = body.kind || 'auto';
      if (!STEP_KINDS.has(kind)) throw invalid('step kind must be auto, learner, or command');
      if (body.context !== undefined && !isPlainObject(body.context)) throw invalid('step context must be an object');
      const operation = await host.step(req.params.sessionId, body.input, {
        kind,
        context: body.context || {},
      });
      res.json(envelope(operation));
    }),
  );

  router.post(
    '/sessions/:sessionId/resume',
    route(async (req, res) => {
      const operation = await host.resume(req.params.sessionId, bodyObject(req));
      res.json(envelope(operation));
    }),
  );

  router.post(
    '/sessions/:sessionId/reset',
    route(async (req, res) => {
      const operation = await host.reset(req.params.sessionId, bodyObject(req));
      res.json(envelope(operation));
    }),
  );

  router.post(
    '/sessions/:sessionId/finalize',
    route(async (req, res) => {
      const body = bodyObject(req);
      if (body.reason !== undefined && typeof body.reason !== 'string') {
        throw invalid('finalize reason must be a string');
      }
      const reason = body.reason === undefined ? 'http_finalize' : body.reason.trim();
      if (!reason) throw invalid('finalize reason must be non-empty');
      if (reason.length > 256) throw invalid('finalize reason must be at most 256 characters');
      const payload = body.payload === undefined ? {} : body.payload;
      if (!isPlainObject(payload)) throw invalid('finalize payload must be an object');
      const operation = await host.finalize(req.params.sessionId, reason, payload);
      res.json(envelope(operation));
    }),
  );

  router.use((error, _req, res, next) => {
    if (!(error instanceof TutorStubSessionHostError)) return next(error);
    return res.status(error.status).json(
      envelope({
        error: {
          code: error.code,
          message: error.message,
        },
      }),
    );
  });

  return router;
}

export default createTutorStubSessionRouter;
