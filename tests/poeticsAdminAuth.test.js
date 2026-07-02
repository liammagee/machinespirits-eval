import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-admin-auth-'));
const dbPath = path.join(tmp, 'evaluations.db');

let createPoeticsBrowserApp;
let oldUser;
let oldPass;
let app;
let poeticsApp;
let server;
let baseUrl;

before(async () => {
  oldUser = process.env.POETICS_AUTH_USER;
  oldPass = process.env.POETICS_AUTH_PASS;
  process.env.POETICS_AUTH_USER = 'admin';
  process.env.POETICS_AUTH_PASS = 'secret';
  ({ createPoeticsBrowserApp } = await import('../scripts/browse-poetics-scripts.js'));
  app = express();
  poeticsApp = createPoeticsBrowserApp({ dbPath, host: '0.0.0.0' });
  app.use('/poetics', poeticsApp);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/poetics`;
});

after(async () => {
  await new Promise((resolve) => server?.close(resolve));
  poeticsApp?.locals?.db?.close?.();
  if (oldUser == null) delete process.env.POETICS_AUTH_USER;
  else process.env.POETICS_AUTH_USER = oldUser;
  if (oldPass == null) delete process.env.POETICS_AUTH_PASS;
  else process.env.POETICS_AUTH_PASS = oldPass;
});

function request(pathname, { method = 'GET', user, pass, body } = {}) {
  const headers = {};
  let payload = null;
  if (user != null) headers.Authorization = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
  if (body != null) {
    payload = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(payload);
  }
  return new Promise((resolve, reject) => {
    const req = http.request(baseUrl + pathname, { method, headers }, (res) => {
      let text = '';
      res.on('data', (chunk) => (text += chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: text }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test('read-only poetics pages stay public on a public-bind app', async () => {
  assert.equal((await request('/healthz')).status, 200);
  const browse = await request('/browse');
  assert.equal(browse.status, 200);
  assert.match(browse.body, /Poetics Script Browser/);
});

test('admin tool pages require Basic Auth', async () => {
  const denied = await request('/admin/runs');
  assert.equal(denied.status, 401);
  assert.match(denied.headers['www-authenticate'] || '', /^Basic realm="machine spirits poetics"/);

  const allowed = await request('/admin/runs', { user: 'admin', pass: 'secret' });
  assert.equal(allowed.status, 200);
  assert.match(allowed.body, /Run launcher/);

  const chatDenied = await request('/admin/chat/');
  assert.equal(chatDenied.status, 401);

  const chatAllowed = await request('/admin/chat/', { user: 'admin', pass: 'secret' });
  assert.equal(chatAllowed.status, 200);
  assert.match(chatAllowed.body, /Machine Spirits \/ Chat/);
});

test('legacy public tool paths redirect pages but do not execute APIs', async () => {
  const page = await request('/runs?kind=generate');
  assert.equal(page.status, 302);
  assert.equal(page.headers.location, '/poetics/admin/runs?kind=generate');

  const api = await request('/api/jobs', { method: 'POST', body: { kind: 'generate', params: { mock: true } } });
  assert.equal(api.status, 404);
  assert.match(api.body, /admin endpoint moved/);
  assert.equal(JSON.parse(api.body).adminPath, '/poetics/admin/api/jobs');

  const chatPage = await request('/chat/');
  assert.equal(chatPage.status, 302);
  assert.equal(chatPage.headers.location, '/poetics/admin/chat/');

  const chatCells = await request('/api/chat/cells');
  assert.equal(chatCells.status, 404);
  assert.equal(JSON.parse(chatCells.body).adminPath, '/poetics/admin/api/chat/cells');

  const publicChatTurn = await request('/api/chat/turn', {
    method: 'POST',
    body: { learnerMessage: 'hello', dryRun: true },
  });
  assert.equal(publicChatTurn.status, 404);
  assert.equal(JSON.parse(publicChatTurn.body).adminPath, '/poetics/admin/api/chat/turn');

  const pilotChatTurn = await request('/api/chat/turn', {
    method: 'POST',
    body: { sessionId: 'missing-session', learnerMessage: 'hello', dryRun: true },
  });
  assert.equal(pilotChatTurn.status, 404);
  assert.match(pilotChatTurn.body, /pilot session missing-session not found/);
});

test('admin chat API exposes the full playground behind auth', async () => {
  const denied = await request('/admin/api/chat/cells');
  assert.equal(denied.status, 401);

  const cells = await request('/admin/api/chat/cells', { user: 'admin', pass: 'secret' });
  assert.equal(cells.status, 200);
  const parsedCells = JSON.parse(cells.body);
  assert.ok(parsedCells.count >= 100);

  const dryTurn = await request('/admin/api/chat/turn', {
    method: 'POST',
    user: 'admin',
    pass: 'secret',
    body: {
      cellName: 'cell_7_recog_multi_unified',
      learnerMessage: 'I think bigger denominators always mean bigger fractions.',
      topic: 'fractions',
      dryRun: true,
    },
  });
  assert.equal(dryTurn.status, 200);
  assert.equal(JSON.parse(dryTurn.body).dryRun, true);
});
