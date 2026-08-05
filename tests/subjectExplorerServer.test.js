import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSubjectExplorerApp } from '../scripts/serve-subject-explorer.js';

test('subject-explorer harness refuses a public bind without credentials', () => {
  assert.throws(() => buildSubjectExplorerApp({ host: '0.0.0.0', env: {} }), /Refusing to bind non-local host/u);
});

test('subject-explorer harness stays open on loopback with no credentials', async () => {
  const app = buildSubjectExplorerApp({ host: '127.0.0.1', env: {} });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const open = await fetch(`${base}/subject`);
  assert.equal(open.status, 200);
  await new Promise((resolve) => server.close(resolve));
});

test('subject-explorer harness enforces the shared guard when credentials are set', async () => {
  const env = { EVAL_AUTH_USER: 'admin', EVAL_AUTH_PASS: 'secret' };
  const app = buildSubjectExplorerApp({ host: '0.0.0.0', env });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const denied = await fetch(`${base}/subject`);
  assert.equal(denied.status, 401);

  const allowed = await fetch(`${base}/subject`, {
    headers: { Authorization: 'Basic ' + Buffer.from('admin:secret').toString('base64') },
  });
  assert.equal(allowed.status, 200);

  await new Promise((resolve) => server.close(resolve));
});
