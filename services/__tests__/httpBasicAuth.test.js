/**
 * Unit + HTTP-integration tests for the shared basic-auth guard.
 * Hermetic: the integration cases boot a 2-route express app on an ephemeral
 * port (no DB, no real server.js / browse-poetics-scripts.js wiring needed).
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import {
  isLocalHost,
  parseBasicAuthHeader,
  basicAuthMiddleware,
  resolveBasicAuthGuard,
  roleAuthMiddleware,
  makeRoleGate,
  PARTICIPANT_ALLOWLIST,
} from '../httpBasicAuth.js';

const servers = [];
after(() => servers.forEach((s) => s.close()));

// Boot a tiny app behind `mw`, return its base URL.
function boot(mw) {
  const app = express();
  if (mw) app.use(mw);
  app.get('/x', (_req, res) => res.type('text/plain').send('ok'));
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      servers.push(server);
      resolve(`http://127.0.0.1:${server.address().port}`);
    });
  });
}

// GET helper with optional basic-auth user/pass.
function get(base, { user, pass } = {}) {
  const headers = {};
  if (user != null) headers.Authorization = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
  return new Promise((resolve, reject) => {
    http
      .get(`${base}/x`, { headers }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      })
      .on('error', reject);
  });
}

describe('httpBasicAuth · isLocalHost', () => {
  it('treats loopback forms as local and everything else as public', () => {
    for (const h of ['127.0.0.1', 'localhost', '::1', '::ffff:127.0.0.1', 'LocalHost'])
      assert.equal(isLocalHost(h), true, `${h} should be local`);
    for (const h of ['0.0.0.0', '192.168.1.5', 'example.com', '', null, undefined])
      assert.equal(isLocalHost(h), false, `${h} should be public`);
  });
});

describe('httpBasicAuth · parseBasicAuthHeader', () => {
  it('parses a well-formed Basic header into user/pass', () => {
    const h = 'Basic ' + Buffer.from('alice:s3cr3t:with:colons').toString('base64');
    assert.deepEqual(parseBasicAuthHeader(h), { user: 'alice', pass: 's3cr3t:with:colons' });
  });
  it('returns null for missing, non-Basic, or colon-less credentials', () => {
    assert.equal(parseBasicAuthHeader(undefined), null);
    assert.equal(parseBasicAuthHeader('Bearer xyz'), null);
    assert.equal(parseBasicAuthHeader('Basic ' + Buffer.from('nocolon').toString('base64')), null);
  });
});

describe('httpBasicAuth · resolveBasicAuthGuard (fail-safe)', () => {
  it('returns middleware when prefixed creds are set', () => {
    const g = resolveBasicAuthGuard({
      env: { POETICS_AUTH_USER: 'u', POETICS_AUTH_PASS: 'p' },
      prefix: 'POETICS',
      host: '127.0.0.1',
    });
    assert.equal(typeof g, 'function');
  });
  it('falls back to shared MS_AUTH_* across servers', () => {
    const g = resolveBasicAuthGuard({
      env: { MS_AUTH_USER: 'u', MS_AUTH_PASS: 'p' },
      prefix: 'EVAL',
      host: '0.0.0.0',
    });
    assert.equal(typeof g, 'function');
  });
  it('returns null (open) on localhost with no creds', () => {
    assert.equal(resolveBasicAuthGuard({ env: {}, prefix: 'POETICS', host: '127.0.0.1' }), null);
  });
  it('THROWS on a public bind with no creds — never expose unauthenticated', () => {
    assert.throws(
      () => resolveBasicAuthGuard({ env: {}, prefix: 'EVAL', host: '0.0.0.0' }),
      /Refusing to bind non-local host/,
    );
  });
});

describe('httpBasicAuth · basicAuthMiddleware over HTTP', () => {
  it('401s with a WWW-Authenticate challenge when no credentials are sent', async () => {
    const base = await boot(basicAuthMiddleware({ user: 'u', pass: 'p', realm: 'test realm' }));
    const r = await get(base);
    assert.equal(r.status, 401);
    assert.match(r.headers['www-authenticate'] || '', /^Basic realm="test realm"/);
  });
  it('401s on wrong credentials', async () => {
    const base = await boot(basicAuthMiddleware({ user: 'u', pass: 'p' }));
    assert.equal((await get(base, { user: 'u', pass: 'WRONG' })).status, 401);
    assert.equal((await get(base, { user: 'WRONG', pass: 'p' })).status, 401);
  });
  it('200s and reaches the route on correct credentials', async () => {
    const base = await boot(basicAuthMiddleware({ user: 'u', pass: 'p' }));
    const r = await get(base, { user: 'u', pass: 'p' });
    assert.equal(r.status, 200);
    assert.equal(r.body, 'ok');
  });
});

// ─── Design A: perimeter RBAC (roles + default-deny gate) ───────────────────

// Path- and method-flexible request helper for the role tests.
function req(base, p, { user, pass, method = 'GET' } = {}) {
  const headers = {};
  if (user != null) headers.Authorization = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
  return new Promise((resolve, reject) => {
    const r = http.request(`${base}${p}`, { method, headers }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    r.on('error', reject);
    r.end();
  });
}

// Boot an app wired like the real servers: [optional role-aware guard] → role
// gate → routes spanning the allowlist boundary.
function bootRoles(guard) {
  const app = express();
  if (guard) app.use(guard);
  app.use(makeRoleGate());
  const ok = (label) => (_q, s) => s.type('text/plain').send(label);
  app.get('/api/eval/runs', ok('eval')); // admin-only
  app.get('/api/pilot/admin/counts', ok('pilot-admin')); // admin-only
  app.get('/browse', ok('browse')); // admin-only (researcher dashboard)
  app.get('/pilot/index.html', ok('pilot-ui')); // participant-allowed (static)
  app.post('/api/pilot/session/abc/turn', ok('turn')); // participant-allowed bounded pilot turn
  app.get('/api/pilot/session/abc/consent', ok('consent')); // participant-allowed
  app.get('/api/a19/adjudication/assignment', ok('adj')); // participant-allowed
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      servers.push(server);
      resolve(`http://127.0.0.1:${server.address().port}`);
    });
  });
}

const ADMIN = { user: 'a', pass: 'ap' };
const PART = { user: 'p', pass: 'pp' };

describe('httpBasicAuth · resolveBasicAuthGuard (roles)', () => {
  it('returns a role-aware guard when a participant pair is configured', () => {
    const g = resolveBasicAuthGuard({
      env: { EVAL_AUTH_USER: 'a', EVAL_AUTH_PASS: 'ap', EVAL_PARTICIPANT_USER: 'p', EVAL_PARTICIPANT_PASS: 'pp' },
      prefix: 'EVAL',
      host: '127.0.0.1',
    });
    assert.equal(typeof g, 'function');
  });
  it('binds a participant-only public server (does NOT throw) when only participant creds are set', () => {
    const g = resolveBasicAuthGuard({
      env: { MS_PARTICIPANT_USER: 'p', MS_PARTICIPANT_PASS: 'pp' },
      prefix: 'EVAL',
      host: '0.0.0.0',
    });
    assert.equal(typeof g, 'function');
  });
  it('STILL throws on a public bind with no creds of either role', () => {
    assert.throws(() => resolveBasicAuthGuard({ env: {}, prefix: 'EVAL', host: '0.0.0.0' }), /Refusing to bind/);
  });
});

describe('httpBasicAuth · roleAuthMiddleware tags req.evalRole', () => {
  it('authenticates admin and participant pairs, 401s anything else', async () => {
    const base = await bootRoles(roleAuthMiddleware({ admin: ADMIN, participant: PART, realm: 'r' }));
    assert.equal((await req(base, '/pilot/index.html', ADMIN)).status, 200);
    assert.equal((await req(base, '/pilot/index.html', PART)).status, 200);
    assert.equal((await req(base, '/pilot/index.html', { user: 'x', pass: 'y' })).status, 401);
    assert.equal((await req(base, '/pilot/index.html')).status, 401);
  });
});

describe('httpBasicAuth · makeRoleGate default-deny', () => {
  it('admin role reaches every surface', async () => {
    const base = await bootRoles(roleAuthMiddleware({ admin: ADMIN, participant: PART, realm: 'r' }));
    for (const p of ['/api/eval/runs', '/api/pilot/admin/counts', '/browse', '/pilot/index.html'])
      assert.equal((await req(base, p, ADMIN)).status, 200, `admin → ${p}`);
  });
  it('participant role reaches ONLY the allowlist (pilot flow and adjudication)', async () => {
    const base = await bootRoles(roleAuthMiddleware({ admin: ADMIN, participant: PART, realm: 'r' }));
    assert.equal((await req(base, '/pilot/index.html', PART)).status, 200);
    assert.equal((await req(base, '/api/pilot/session/abc/turn', { ...PART, method: 'POST' })).status, 200);
    assert.equal((await req(base, '/api/pilot/session/abc/consent', PART)).status, 200);
    assert.equal((await req(base, '/api/a19/adjudication/assignment', PART)).status, 200);
  });
  it('participant role is 403d on every metered/admin surface', async () => {
    const base = await bootRoles(roleAuthMiddleware({ admin: ADMIN, participant: PART, realm: 'r' }));
    for (const p of ['/api/eval/runs', '/api/pilot/admin/counts', '/browse'])
      assert.equal((await req(base, p, PART)).status, 403, `participant → ${p} must be 403`);
  });
  it('localhost-open (no guard, req.evalRole undefined) reaches everything', async () => {
    const base = await bootRoles(null); // no guard → evalRole undefined → admin-equivalent
    for (const p of ['/api/eval/runs', '/browse', '/pilot/index.html'])
      assert.equal((await req(base, p)).status, 200, `open → ${p}`);
  });
});

describe('httpBasicAuth · PARTICIPANT_ALLOWLIST excludes the danger paths', () => {
  const matches = (p) => PARTICIPANT_ALLOWLIST.some((e) => p === e || p.startsWith(e + '/'));
  it('denies every metered/admin surface', () => {
    for (const p of [
      '/pilot-admin',
      '/pilot-admin/index.html',
      '/human-coding-admin',
      '/human-coding-admin/index.html',
      '/chat',
      '/chat/index.html',
      '/tutor',
      '/tutor/index.html',
      '/api/tutor-stub/catalog',
      '/api/tutor-stub/sessions',
      '/api/eval/quick',
      '/api/human-coding/status',
      '/api/jobs',
      '/api/compose/live/turn',
      '/api/chat/learner-turn',
      '/api/chat/cells',
      '/api/chat/turn',
      '/api/pilot/admin/counts',
    ])
      assert.equal(matches(p), false, `${p} must NOT be participant-allowed`);
  });
  it('allows exactly the participant/coder surfaces', () => {
    for (const p of [
      '/pilot',
      '/pilot/x.js',
      '/api/pilot/session/1/turn',
      '/api/pilot/session/1/consent',
      '/api/a19/adjudication/submissions',
    ])
      assert.equal(matches(p), true, `${p} must be participant-allowed`);
  });
});
