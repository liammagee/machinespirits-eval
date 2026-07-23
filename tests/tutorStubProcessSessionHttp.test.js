import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import express from 'express';

import { TUTOR_STUB_SESSION_HTTP_SCHEMA } from '../routes/tutorStubSessionRoutes.js';
import { mountEvalSurfaces } from '../services/evalSurfaces.js';
import {
  createTutorStubProcessSessionHost,
  tutorStubProcessEnvironment,
  tutorStubProcessWorkingDirectory,
} from '../services/tutorStubProcessSessionFactory.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('packaged Electron launches the tutor child as Node outside the asar working directory', () => {
  const packagedRoot = '/Applications/Scriptorium.app/Contents/Resources/app.asar';
  assert.equal(tutorStubProcessWorkingDirectory(packagedRoot), '/Applications/Scriptorium.app/Contents/Resources');
  assert.deepEqual(tutorStubProcessEnvironment({ API_KEY: 'server-only' }, { electronRunAsNode: true }), {
    API_KEY: 'server-only',
    ELECTRON_RUN_AS_NODE: '1',
    TUTOR_STUB_SUMMARY_OPEN: '0',
    TUTOR_STUB_TRANSCRIPT_OPEN: '0',
    TUTOR_STUB_VOICE_OPEN: '0',
  });
});

function installFakeCodex(directory) {
  const executable = path.join(directory, 'codex');
  fs.writeFileSync(
    executable,
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const outputIndex = args.indexOf('-o');
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  const response = input.includes('# Current learner turn')
    ? JSON.stringify({
        classification: {
          turn: {
            summary: 'The learner asks to compare public assay evidence.',
            request_type: 'conceptual_clarity_request',
            discourse_move: 'repair_request',
            evidence_use: 'specific',
            epistemic_stance: 'tentative',
            affect: 'engaged',
            agency: 'steering',
            scores: {
              conceptual_engagement: { score: 2, reason: 'The learner selects a relevant comparison.' },
              epistemic_readiness: { score: 3, reason: 'The request is specific and answerable.' }
            },
            pedagogical_need: 'Help compare the two public marks.'
          },
          overall: {
            summary: 'The learner is testing a public evidence link.',
            trajectory: 'more specific',
            recurring_pattern: 'none yet',
            current_state: 'ready to compare evidence',
            next_best_tutor_move: 'Ask for one concrete contrast.'
          }
        },
        learner_record: { human_discourse: { proof_status: 'unclear' }, notes: 'No proof update.' }
      })
    : 'Take the assay as a fingerprint: which public mark differs between the two coins?';
  if (process.env.FAKE_CODEX_LOG) fs.appendFileSync(process.env.FAKE_CODEX_LOG, input + '\\n---request---\\n');
  if (outputPath) fs.writeFileSync(outputPath, response);
  process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: response } }) + '\\n');
});
`,
    'utf8',
  );
  fs.chmodSync(executable, 0o755);
}

async function listen(t, app) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}/api/tutor-stub`;
}

async function request(base, pathName = '', { method = 'GET', body } = {}) {
  const response = await fetch(`${base}${pathName}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test('shared eval surfaces mount the real tutor-stub host by default without starting a model process', async (t) => {
  const app = express();
  app.use(express.json());
  mountEvalSurfaces(app, { root: ROOT });
  t.after(() => app.locals.tutorStubSessionHost.closeAll('test_cleanup'));
  const base = await listen(t, app);

  const contract = await request(base);
  assert.equal(contract.status, 200);
  assert.equal(contract.body.schema, TUTOR_STUB_SESSION_HTTP_SCHEMA);
  assert.equal(typeof app.locals.tutorStubSessionHost.create, 'function');
});

test('HTTP learner step traverses the real CLI tutor runtime through a fake model executable', async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-process-http-'));
  const binDir = path.join(tmp, 'bin');
  const traceDir = path.join(tmp, 'traces');
  const promptLog = path.join(tmp, 'model-prompts.log');
  fs.mkdirSync(binDir, { recursive: true });
  fs.mkdirSync(traceDir, { recursive: true });
  installFakeCodex(binDir);

  const host = createTutorStubProcessSessionHost({
    root: ROOT,
    traceDir,
    maxSessions: 2,
    startupTimeoutMs: 15_000,
    requestTimeoutMs: 15_000,
    env: {
      ...process.env,
      PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
      FAKE_CODEX_LOG: promptLog,
      CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
      TUTOR_STUB_OPENING_REALIZER: 'deterministic',
    },
  });
  t.after(async () => {
    await host.closeAll('test_cleanup');
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const app = express();
  app.use(express.json());
  mountEvalSurfaces(app, { root: ROOT, tutorStubSessionHost: host });
  app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
  const base = await listen(t, app);

  const created = await request(base, '/sessions', {
    method: 'POST',
    body: {
      id: 'real-http-session',
      mode: 'direct',
      model: 'codex.gpt-5.6-terra',
      world: 'world_005_marrick',
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.session.status, 'active');
  assert.equal(created.body.session.sessionId, 'real-http-session');
  assert.equal(created.body.session.capabilitySnapshot.mode, 'direct');

  const stepped = await request(base, '/sessions/real-http-session/steps', {
    method: 'POST',
    body: { input: 'Can we compare the public assay marks?', kind: 'learner' },
  });
  assert.equal(stepped.status, 200, JSON.stringify(stepped.body));
  assert.equal(stepped.body.result.accepted, true);
  assert.equal(stepped.body.result.turn.learner, 'Can we compare the public assay marks?');
  assert.match(stepped.body.result.turn.tutor, /Marrick's ready verdict/u);
  assert.match(stepped.body.result.turn.tutor, /Verrell alone draws the mint-yard crucible/u);
  assert.notEqual(
    stepped.body.result.turn.tutor,
    'Take the assay as a fingerprint: which public mark differs between the two coins?',
    'the real tutor runtime should apply its staged-release and response-guard pipeline to the fake draft',
  );
  assert.equal(stepped.body.session.state.turnCount, 1);
  assert.equal(stepped.body.session.state.publicMessageCount, 2);
  assert.match(fs.readFileSync(promptLog, 'utf8'), /Can we compare the public assay marks\?/u);

  const command = await request(base, '/sessions/real-http-session/steps', {
    method: 'POST',
    body: { input: '/settings', kind: 'command' },
  });
  assert.equal(command.status, 409);
  assert.equal(command.body.error.code, 'command_transport_unavailable');

  const reset = await request(base, '/sessions/real-http-session/reset', {
    method: 'POST',
    body: { reason: 'repeat_inquiry' },
  });
  assert.equal(reset.status, 200, JSON.stringify(reset.body));
  assert.equal(reset.body.session.state.turnCount, 0);
  assert.equal(reset.body.session.state.publicMessageCount, 0);

  const finalized = await request(base, '/sessions/real-http-session/finalize', {
    method: 'POST',
    body: { reason: 'integration_complete' },
  });
  assert.equal(finalized.status, 200, JSON.stringify(finalized.body));
  assert.equal(finalized.body.session.status, 'finalized');
  assert.equal(finalized.body.session.lifecycle.finalizedReason, 'integration_complete');
});
