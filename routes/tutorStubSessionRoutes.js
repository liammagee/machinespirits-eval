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
import { isLocalHost } from '../services/httpBasicAuth.js';

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
  if (req.body === undefined || req.body === null) throw invalid('request body must be a JSON object');
  if (!isPlainObject(req.body)) throw invalid('request body must be a JSON object');
  return req.body;
}

function parsedAuthority(value) {
  try {
    const parsed = new URL(`http://${String(value || '')}`);
    const hostname = parsed.hostname.replace(/^\[|\]$/gu, '').toLowerCase();
    return { host: parsed.host.toLowerCase(), hostname, port: parsed.port || '80' };
  } catch {
    return null;
  }
}

function denyCrossOrigin(next) {
  return next(
    new TutorStubSessionHostError(
      'cross_origin_request_denied',
      'cross-origin tutor-stub session mutations are not allowed',
      403,
    ),
  );
}

function requireJsonSameOrigin(req, _res, next) {
  if (req.method !== 'POST') return next();
  if (!req.is('application/json')) {
    return next(
      new TutorStubSessionHostError(
        'invalid_content_type',
        'tutor-stub session mutations require Content-Type: application/json',
        415,
      ),
    );
  }

  if (String(req.get('sec-fetch-site') || '').toLowerCase() === 'cross-site') {
    return denyCrossOrigin(next);
  }

  const origin = req.get('origin');
  if (origin) {
    let originUrl = null;
    try {
      originUrl = new URL(origin);
    } catch {
      // Opaque and malformed browser origins are never valid for this local,
      // process-starting API.
    }
    const requestAuthority = parsedAuthority(req.get('host'));
    const originAuthority = originUrl ? parsedAuthority(originUrl.host) : null;
    if (!requestAuthority || !originAuthority) return denyCrossOrigin(next);

    if (req.evalRole === 'admin') {
      // Authenticated deployments have an independent credential boundary;
      // still require the browser origin and request authority to agree.
      if (originAuthority.host !== requestAuthority.host) return denyCrossOrigin(next);
    } else {
      // In the credential-free localhost mode, Host is attacker-controlled.
      // Requiring both authorities to be literal loopback closes the common
      // DNS-rebinding bypass where evil.example appears in both headers.
      if (
        !isLocalHost(requestAuthority.hostname) ||
        !isLocalHost(originAuthority.hostname) ||
        originAuthority.port !== requestAuthority.port
      ) {
        return denyCrossOrigin(next);
      }
    }
  }
  return next();
}

function administratorRequest(req) {
  const requestAuthority = parsedAuthority(req.get('host'));
  const localOpen = req.evalRole === undefined && requestAuthority && isLocalHost(requestAuthority.hostname);
  return req.evalRole === 'admin' || localOpen;
}

function administratorRequired(subject) {
  return new TutorStubSessionHostError(
    'administrator_required',
    `an administrator role is required for ${subject}`,
    403,
  );
}

function requireAdministrator(req, _res, next) {
  return administratorRequest(req) ? next() : next(administratorRequired('the research projection'));
}

/**
 * Versioned HTTP transport over an injected tutor-stub session host.
 * The router owns validation and status codes only; tutor behavior stays in
 * the runtime factory supplied by the web/Electron host.
 */
export function createTutorStubSessionRouter({ host, catalogProvider = null } = {}) {
  if (!host || typeof host.create !== 'function' || typeof host.step !== 'function') {
    throw new Error('tutor-stub session router requires a session host');
  }

  const router = Router();

  // JSON is intentionally non-simple under the browser CORS rules, and the
  // explicit Origin check is defense in depth for localhost and cached Basic
  // Auth. Together they prevent a foreign HTML form from allocating or
  // mutating model-backed sessions. Non-browser API clients omit Origin.
  router.use('/sessions', requireJsonSameOrigin);

  router.get('/', (_req, res) => {
    res.json(
      envelope({
        host: { schema: TUTOR_STUB_SESSION_HOST_SCHEMA, version: TUTOR_STUB_SESSION_HOST_VERSION },
        runtime: { schema: TUTOR_STUB_SESSION_RUNTIME_SCHEMA, version: TUTOR_STUB_SESSION_RUNTIME_VERSION },
        endpoints: [
          'GET /catalog',
          'POST /sessions',
          'GET /sessions',
          'GET /sessions/:sessionId',
          'GET /sessions/:sessionId/research',
          'POST /sessions/:sessionId/steps',
          'POST /sessions/:sessionId/resume',
          'POST /sessions/:sessionId/reset',
          'POST /sessions/:sessionId/interrupt',
          'POST /sessions/:sessionId/finalize',
        ],
      }),
    );
  });

  if (catalogProvider) {
    router.get(
      '/catalog',
      route(async (_req, res) => {
        const catalog = await catalogProvider();
        res.set('Cache-Control', 'private, no-store').json(envelope({ catalog }));
      }),
    );
  }

  router.post(
    '/sessions',
    route(async (req, res) => {
      const specification = bodyObject(req);
      if (specification.engine === 'cell_lab' && !administratorRequest(req)) {
        throw administratorRequired('cell_lab sessions');
      }
      const session = await host.create(specification);
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

  router.get(
    '/sessions/:sessionId/research',
    requireAdministrator,
    route(async (req, res) => {
      if (typeof host.research !== 'function') {
        throw new TutorStubSessionHostError(
          'research_projection_unavailable',
          'this tutor-stub session host does not expose research projections',
          409,
        );
      }
      const research = await host.research(req.params.sessionId);
      res.set('Cache-Control', 'private, no-store').json(envelope({ research }));
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
    '/sessions/:sessionId/interrupt',
    route(async (req, res) => {
      if (typeof host.interrupt !== 'function') {
        throw new TutorStubSessionHostError(
          'session_interrupt_unavailable',
          'this tutor-stub session host does not support interruption',
          409,
        );
      }
      const body = bodyObject(req);
      if (body.reason !== undefined && typeof body.reason !== 'string') {
        throw invalid('interrupt reason must be a string');
      }
      const reason = body.reason === undefined ? 'http_interrupt' : body.reason.trim();
      if (!reason) throw invalid('interrupt reason must be non-empty');
      if (reason.length > 256) throw invalid('interrupt reason must be at most 256 characters');
      const operation = await host.interrupt(req.params.sessionId, reason);
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

  router.use((error, _req, res, _next) => {
    if (error instanceof TutorStubSessionHostError) {
      return res.status(error.status).json(
        envelope({
          error: {
            code: error.code,
            message: error.message,
          },
        }),
      );
    }
    // Do not let child stderr, prompts, paths, or provider diagnostics cross
    // the public HTTP boundary through a host application's generic handler.
    // The full error remains available to the server operator.
    console.error('[tutor-stub-session] internal operation failed', error);
    return res.status(500).json(
      envelope({
        error: {
          code: 'session_internal_error',
          message: 'Tutor-stub session operation failed',
        },
      }),
    );
  });

  return router;
}

export default createTutorStubSessionRouter;
