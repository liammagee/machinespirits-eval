/**
 * Unit + HTTP-integration tests for the shared basic-auth guard.
 * Hermetic: the integration cases boot a 2-route express app on an ephemeral
 * port (no DB, no real server.js / browse-poetics-scripts.js wiring needed).
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import { isLocalHost, parseBasicAuthHeader, basicAuthMiddleware, resolveBasicAuthGuard } from '../httpBasicAuth.js';

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
