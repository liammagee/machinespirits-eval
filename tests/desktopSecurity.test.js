// tests/desktopSecurity.test.js — pure, runs under plain `node --test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isLoopbackUrl,
  shouldOpenExternally,
  buildCSP,
  basicAuthHeader,
  loopbackAuthHeaders,
} from '../desktop/security.js';

const base = 'http://127.0.0.1:50000';

test('isLoopbackUrl matches only the loopback origin', () => {
  assert.equal(isLoopbackUrl(base, base), true);
  assert.equal(isLoopbackUrl(base + '/browse', base), true);
  assert.equal(isLoopbackUrl(base + '?x=1', base), true);
  assert.equal(isLoopbackUrl('http://127.0.0.1:60000/x', base), false);
  assert.equal(isLoopbackUrl('https://evil.example/x', base), false);
});

test('shouldOpenExternally routes off-origin links out, keeps app + inline schemes in', () => {
  assert.equal(shouldOpenExternally('https://github.com', base), true);
  assert.equal(shouldOpenExternally(base + '/compose', base), false);
  assert.equal(shouldOpenExternally('data:text/html,hi', base), false);
  assert.equal(shouldOpenExternally('about:blank', base), false);
});

test('buildCSP allows the UI origins and locks the rest', () => {
  const csp = buildCSP();
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /cdn\.jsdelivr\.net/);
  assert.match(csp, /fonts\.googleapis\.com/);
  assert.match(csp, /fonts\.gstatic\.com/);
  assert.match(csp, /script-src[^;]*'unsafe-eval'/); // Alpine needs it
  assert.match(csp, /object-src 'none'/);
});

test('basicAuthHeader encodes user:pass', () => {
  assert.equal(basicAuthHeader('u', 'p'), 'Basic ' + Buffer.from('u:p').toString('base64'));
});

test('loopbackAuthHeaders attaches the token only to the loopback origin', () => {
  const token = { user: 'desktop', pass: 'secret' };
  assert.deepEqual(loopbackAuthHeaders(null, base + '/x', base), {}); // no token → nothing
  assert.deepEqual(loopbackAuthHeaders(token, 'https://fonts.gstatic.com/x', base), {}); // never leak to CDNs
  assert.equal(
    loopbackAuthHeaders(token, base + '/api/eval/runs', base).Authorization,
    basicAuthHeader('desktop', 'secret'),
  );
});
