import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import express from 'express';

import { TUTOR_STUB_SESSION_HTTP_SCHEMA } from '../routes/tutorStubSessionRoutes.js';
import { mountEvalSurfaces } from '../services/evalSurfaces.js';
import { CELL_LAB_RESEARCH_TRACE_SCHEMA } from '../services/legacyChatSessionAdapter.js';
import {
  createTutorStubProcessSessionFactory,
  createTutorStubProcessSessionHost,
  resolveTutorStubProcessResumePath,
  tutorStubProcessCommandLine,
  tutorStubProcessEnvironment,
  tutorStubProcessSessionTraceDirectory,
  tutorStubProcessWorkingDirectory,
} from '../services/tutorStubProcessSessionFactory.js';
import { TUTOR_STUB_SESSION_RPC_SCHEMA, TUTOR_STUB_SESSION_RPC_VERSION } from '../services/tutorStubSessionRpc.js';

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

test('process sessions use collision-safe trace namespaces and the full scaffold launch contract', () => {
  const alpha = tutorStubProcessSessionTraceDirectory('/tmp/tutor-traces', 'alpha');
  const beta = tutorStubProcessSessionTraceDirectory('/tmp/tutor-traces', 'beta');
  assert.notEqual(alpha, beta);
  assert.equal(tutorStubProcessSessionTraceDirectory('/tmp/tutor-traces', 'alpha'), alpha);
  assert.equal(path.dirname(alpha), '/tmp/tutor-traces');

  const args = tutorStubProcessCommandLine(
    ROOT,
    {
      id: 'scaffold-session',
      mode: 'scaffold',
      model: null,
      classifierModel: null,
      learnerRecordModel: null,
      tutor: null,
      topic: null,
      world: 'world_005_marrick',
      curriculum: null,
      module: null,
      lab: 'human_scaffold',
      resume: 'run-2026-07-23',
      resumeLast: false,
    },
    alpha,
  );
  assert.equal(args[args.indexOf('--trace-dir') + 1], alpha);
  assert.ok(args.includes('--dag'));
  assert.ok(args.includes('--tutor-learner-dag'));
  assert.equal(args[args.indexOf('--dag-mode') + 1], 'defeasible_human_scaffold');
  assert.equal(args[args.indexOf('--lab') + 1], 'human_scaffold');
  assert.equal(args[args.indexOf('--resume') + 1], 'run-2026-07-23');
  assert.equal(args.filter((entry) => entry === '--resume').length, 1);
  assert.equal(args.includes('--resume-last'), false);
});

function writeResumeTrace(traceRoot, namespace, runId, { mtimeMs = Date.now() } = {}) {
  const directory = path.join(traceRoot, namespace);
  const filePath = path.join(directory, `${runId}.jsonl`);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    filePath,
    [
      {
        type: 'run_start',
        runId,
        metadata: {
          world: { id: 'world_005_marrick' },
          modelRef: 'codex.gpt-5.6-terra',
        },
      },
      {
        type: 'turn_complete',
        runId,
        turnRecord: { turn: 1, learner: 'Public learner turn.', tutor: 'Public tutor turn.' },
      },
    ]
      .map((entry) => JSON.stringify(entry))
      .join('\n') + '\n',
    'utf8',
  );
  const mtime = new Date(mtimeMs);
  fs.utimesSync(filePath, mtime, mtime);
  return filePath;
}

test('process resume resolution stays inside bounded trace namespaces and rejects ambiguous run ids', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-resume-resolution-'));
  const traceRoot = path.join(tmp, 'traces');
  const outside = writeResumeTrace(tmp, 'outside', 'outside-run');
  const older = writeResumeTrace(traceRoot, 'session-alpha', 'run-alpha', { mtimeMs: Date.now() - 2_000 });
  const newer = writeResumeTrace(traceRoot, 'session-beta', 'run-beta', { mtimeMs: Date.now() - 1_000 });
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  assert.equal(
    resolveTutorStubProcessResumePath({ resume: 'run-alpha', resumeLast: false }, { root: ROOT, traceDir: traceRoot }),
    fs.realpathSync(older),
  );
  assert.equal(
    resolveTutorStubProcessResumePath({ resume: null, resumeLast: true }, { root: ROOT, traceDir: traceRoot }),
    fs.realpathSync(newer),
  );
  assert.throws(
    () =>
      resolveTutorStubProcessResumePath(
        { resume: path.resolve(outside), resumeLast: false },
        { root: ROOT, traceDir: traceRoot },
      ),
    (error) => {
      assert.equal(error.code, 'invalid_resume_source');
      assert.equal(error.status, 400);
      assert.doesNotMatch(error.message, new RegExp(tmp.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
      return true;
    },
  );

  writeResumeTrace(traceRoot, 'session-gamma', 'run-alpha', { mtimeMs: Date.now() });
  assert.throws(
    () =>
      resolveTutorStubProcessResumePath(
        { resume: 'run-alpha', resumeLast: false },
        { root: ROOT, traceDir: traceRoot },
      ),
    (error) => error.code === 'ambiguous_resume_source' && error.status === 400 && !error.message.includes(tmp),
  );
});

test('process resume traversal fails closed when trace namespace bounds are exceeded', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-resume-bounds-'));
  const traceRoot = path.join(tmp, 'traces');
  fs.mkdirSync(traceRoot, { recursive: true });
  // The production bound is 256 immediate per-session namespaces. The scan is
  // deliberately one level deep; a 257th namespace must stop resolution
  // before any child process can be spawned.
  for (let index = 0; index < 257; index += 1) {
    fs.mkdirSync(path.join(traceRoot, `session-${String(index).padStart(3, '0')}`));
  }
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  assert.throws(
    () => resolveTutorStubProcessResumePath({ resume: null, resumeLast: true }, { root: ROOT, traceDir: traceRoot }),
    (error) => error.code === 'resume_trace_scan_limit' && error.status === 400 && !error.message.includes(tmp),
  );
});

function fakeReadyRpcChild(sessionId) {
  const child = new EventEmitter();
  const command = new PassThrough();
  const response = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdio = [null, child.stdout, child.stderr, command, response];
  child.exitCode = null;
  child.signalCode = null;
  child.kill = (signal) => {
    child.signalCode = signal;
    queueMicrotask(() => child.emit('exit', null, signal));
    return true;
  };
  queueMicrotask(() => {
    response.write(
      `${JSON.stringify({
        schema: TUTOR_STUB_SESSION_RPC_SCHEMA,
        version: TUTOR_STUB_SESSION_RPC_VERSION,
        type: 'ready',
        session: { sessionId, status: 'active', state: { publicMessages: [] } },
      })}\n`,
    );
  });
  return child;
}

test('process factory gives the child one validated absolute resume path', async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-resume-spawn-'));
  const traceRoot = path.join(tmp, 'traces');
  const sourcePath = writeResumeTrace(traceRoot, 'source-session', 'source-run');
  let spawnedArgs = null;
  let spawnedChild = null;
  const createSession = createTutorStubProcessSessionFactory({
    root: ROOT,
    traceDir: traceRoot,
    startupTimeoutMs: 100,
    spawnProcess(_executable, args) {
      spawnedArgs = args;
      spawnedChild = fakeReadyRpcChild('new-session');
      return spawnedChild;
    },
  });
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const runtime = await createSession({ id: 'new-session', mode: 'direct', resume: 'source-run' });
  await runtime.load();
  assert.equal(spawnedArgs.filter((entry) => entry === '--resume').length, 1);
  assert.equal(spawnedArgs[spawnedArgs.indexOf('--resume') + 1], fs.realpathSync(sourcePath));
  assert.equal(spawnedArgs.includes('--resume-last'), false);
  runtime.terminate('test_cleanup');
  await runtime.closed;
  assert.equal(spawnedChild.signalCode, 'SIGTERM');
});

test('process session specification allowlists HTTP labs, enforces their modes, and rejects ambiguous resume selectors', async () => {
  const createSession = createTutorStubProcessSessionFactory({ root: ROOT });
  await assert.rejects(
    createSession({ id: 'unimplemented-engine', engine: 'cell_lab' }),
    (error) => error.code === 'invalid_request' && /engine must be one of: tutor_stub/u.test(error.message),
  );
  await assert.rejects(
    createSession({ id: 'invalid-lab', lab: 'unbounded_custom_lab' }),
    (error) => error.code === 'invalid_request' && /registered tutor-stub capability lab/u.test(error.message),
  );
  await assert.rejects(
    createSession({ id: 'research-lab', lab: 'automated_eval', mode: 'direct' }),
    (error) => error.code === 'lab_transport_unavailable' && error.status === 409,
  );
  await assert.rejects(
    createSession({ id: 'mismatched-lab', lab: 'pure_chat', mode: 'mixed' }),
    (error) => error.code === 'lab_mode_mismatch' && /requires mode passthrough/u.test(error.message),
  );
  const pure = await createSession({ id: 'derived-pure-chat', lab: 'pure_chat' });
  assert.equal(pure.snapshot().capabilitySnapshot.mode, 'passthrough');
  assert.equal(pure.snapshot().state.engine, 'tutor_stub');
  pure.terminate('test_cleanup');
  await assert.rejects(
    createSession({ id: 'ambiguous-resume', resume: 'run-1', resumeLast: true }),
    (error) => error.code === 'invalid_request' && /mutually exclusive/u.test(error.message),
  );
  await assert.rejects(
    createSession({ id: 'oversized-resume', resume: 'x'.repeat(1_025) }),
    (error) => error.code === 'invalid_request' && /at most 1024 characters/u.test(error.message),
  );
});

test('process termination rejects an in-flight RPC and settles the child lifecycle', async () => {
  let spawnedChild;
  const spawnProcess = () => {
    spawnedChild = fakeReadyRpcChild('interrupt-process');
    return spawnedChild;
  };
  const createSession = createTutorStubProcessSessionFactory({
    root: ROOT,
    spawnProcess,
    startupTimeoutMs: 100,
    requestTimeoutMs: 1_000,
  });
  const runtime = await createSession({ id: 'interrupt-process', mode: 'direct' });
  await runtime.load();
  const pending = runtime.step('waiting on a model');
  await new Promise((resolve) => setImmediate(resolve));
  runtime.terminate('test_interrupt');

  await assert.rejects(pending, (error) => error.code === 'session_terminated');
  const closed = await runtime.closed;
  assert.equal(closed.reason, 'test_interrupt');
  assert.equal(spawnedChild.signalCode, 'SIGTERM');
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

  const unknownLab = await request(base, '/sessions', {
    method: 'POST',
    body: { id: 'invalid-lab-http', lab: 'custom_shell_lab' },
  });
  assert.equal(unknownLab.status, 400);
  assert.equal(unknownLab.body.error.code, 'invalid_request');

  const unavailableEngine = await request(base, '/sessions', {
    method: 'POST',
    body: { id: 'unavailable-engine-http', engine: 'unavailable_engine' },
  });
  assert.equal(unavailableEngine.status, 400);
  assert.equal(unavailableEngine.body.error.code, 'invalid_request');

  const ambiguousResume = await request(base, '/sessions', {
    method: 'POST',
    body: { id: 'invalid-resume-http', resume: 'run-1', resumeLast: true },
  });
  assert.equal(ambiguousResume.status, 400);
  assert.equal(ambiguousResume.body.error.code, 'invalid_request');
});

test('administrator session boundary runs cell_lab with separate public and research projections', async (t) => {
  const observed = [];
  const host = createTutorStubProcessSessionHost({
    root: ROOT,
    maxSessions: 2,
    env: { OPENROUTER_API_KEY: 'adapter-test-key' },
    cellLab: {
      async runTutorTurnFn(input) {
        observed.push(input);
        return {
          finalMessage: 'Let us test that claim against one concrete case.',
          wasRevised: true,
          architecture: { hasSuperego: true, promptType: 'recognition', recognitionMode: true },
          deliberation: [
            {
              role: 'ego',
              content: 'PRIVATE EGO DRAFT',
              provider: 'test-provider',
              model: 'test/ego',
              inputTokens: 11,
              outputTokens: 7,
              latencyMs: 13,
            },
            {
              role: 'superego',
              content: 'PRIVATE SUPEREGO CRITIQUE',
              provider: 'test-provider',
              model: 'test/superego',
              inputTokens: 9,
              outputTokens: 5,
              latencyMs: 8,
            },
          ],
          totals: { inputTokens: 20, outputTokens: 12, latencyMs: 21, costUsd: 0.01 },
        };
      },
    },
  });
  t.after(() => host.closeAll('test_cleanup'));

  const app = express();
  app.use(express.json());
  mountEvalSurfaces(app, { root: ROOT, tutorStubSessionHost: host });
  const base = await listen(t, app);

  const adaptiveRejected = await request(base, '/sessions', {
    method: 'POST',
    body: {
      id: 'adaptive-through-cell-lab',
      engine: 'cell_lab',
      mode: 'cell_lab',
      cell: 'cell_110_langgraph_adaptive',
    },
  });
  assert.equal(adaptiveRejected.status, 409, JSON.stringify(adaptiveRejected.body));
  assert.equal(adaptiveRejected.body.error.code, 'cell_lab_runner_unsupported');

  const created = await request(base, '/sessions', {
    method: 'POST',
    body: {
      id: 'cell-lab-http',
      engine: 'cell_lab',
      mode: 'cell_lab',
      cell: 'cell_7_recog_multi_unified',
      topic: 'fraction magnitude',
      curriculumRef: 'drama:rhetorical#D_AF1_CURRICULUM_ADAPTIVE',
      personaId: 'struggling_anxious',
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.session.state.engine, 'cell_lab');
  assert.equal(created.body.session.capabilitySnapshot.mode, 'cell_lab');
  assert.equal(created.body.session.state.publicMessageCount, 0);
  assert.doesNotMatch(
    JSON.stringify(created.body.session),
    /cell_7|configHash|deliberation|PRIVATE|prompt_file|test-provider|test\/ego|struggling_anxious/iu,
  );

  const stepped = await request(base, '/sessions/cell-lab-http/steps', {
    method: 'POST',
    body: { input: 'A larger denominator should make the fraction larger.', kind: 'learner' },
  });
  assert.equal(stepped.status, 200, JSON.stringify(stepped.body));
  assert.deepEqual(stepped.body.result, {
    accepted: true,
    turn: {
      learner: 'A larger denominator should make the fraction larger.',
      tutor: 'Let us test that claim against one concrete case.',
    },
  });
  assert.equal(stepped.body.session.state.publicMessageCount, 2);
  assert.doesNotMatch(
    JSON.stringify(stepped.body.session),
    /cell_7|configHash|deliberation|PRIVATE|prompt_file|test-provider|test\/ego|struggling_anxious/iu,
  );

  const projected = await request(base, '/sessions/cell-lab-http/research');
  assert.equal(projected.status, 200, JSON.stringify(projected.body));
  assert.equal(projected.body.research.schema, CELL_LAB_RESEARCH_TRACE_SCHEMA);
  assert.equal(projected.body.research.cell.name, 'cell_7_recog_multi_unified');
  assert.equal(projected.body.research.cell.architecture.hasSuperego, true);
  assert.match(projected.body.research.configHash, /^[a-f0-9]{64}$/u);
  assert.equal(projected.body.research.source.curriculum.moduleId, 'AF1');
  assert.equal(projected.body.research.source.personaId, 'struggling_anxious');
  assert.equal(projected.body.research.turns[0].deliberation[0].content, 'PRIVATE EGO DRAFT');
  assert.equal(projected.body.research.turns[0].deliberation[1].model, 'test/superego');
  assert.deepEqual(projected.body.research.totals, {
    inputTokens: 20,
    outputTokens: 12,
    latencyMs: 21,
    costUsd: 0.01,
  });
  assert.equal(observed.length, 1);
  assert.equal(observed[0].profile.factors.prompt_type, 'recognition');
  assert.equal(observed[0].curriculum.moduleId, 'AF1');
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
  assert.equal(created.body.session.state.engine, 'tutor_stub');
  assert.equal(created.body.session.capabilitySnapshot.mode, 'direct');
  assert.equal(created.body.session.state.publicMessageCount, 1);
  assert.equal(created.body.session.state.opening.role, 'assistant');
  assert.equal(created.body.session.state.publicMessages[0].content, created.body.session.state.opening.content);

  const runtimeResume = await request(base, '/sessions/real-http-session/resume', {
    method: 'POST',
    body: { source: 'ambiguous-runtime-request' },
  });
  assert.equal(runtimeResume.status, 409);
  assert.equal(runtimeResume.body.error.code, 'runtime_resume_unavailable');

  const stepped = await request(base, '/sessions/real-http-session/steps', {
    method: 'POST',
    body: { input: 'Can we compare the public assay marks?', kind: 'learner' },
  });
  assert.equal(stepped.status, 200, JSON.stringify(stepped.body));
  assert.equal(stepped.body.result.accepted, true);
  assert.deepEqual(Object.keys(stepped.body.result).sort(), ['accepted', 'turn']);
  assert.deepEqual(Object.keys(stepped.body.result.turn).sort(), ['learner', 'tutor']);
  assert.equal('provider' in stepped.body.result.turn, false);
  assert.equal('model' in stepped.body.result.turn, false);
  assert.doesNotMatch(JSON.stringify(stepped.body.result), /provider|model|private/iu);
  assert.equal(stepped.body.result.turn.learner, 'Can we compare the public assay marks?');
  assert.match(stepped.body.result.turn.tutor, /Marrick's ready verdict/u);
  assert.match(stepped.body.result.turn.tutor, /Verrell alone draws the mint-yard crucible/u);
  assert.notEqual(
    stepped.body.result.turn.tutor,
    'Take the assay as a fingerprint: which public mark differs between the two coins?',
    'the real tutor runtime should apply its staged-release and response-guard pipeline to the fake draft',
  );
  assert.equal(stepped.body.session.state.turnCount, 1);
  assert.equal(stepped.body.session.state.publicMessageCount, 3);
  assert.deepEqual(
    stepped.body.session.state.publicMessages.map((message) => message.role),
    ['assistant', 'user', 'assistant'],
  );
  assert.equal(stepped.body.session.state.publicMessages.at(-1).content, stepped.body.result.turn.tutor);
  assert.match(fs.readFileSync(promptLog, 'utf8'), /Can we compare the public assay marks\?/u);

  const command = await request(base, '/sessions/real-http-session/steps', {
    method: 'POST',
    body: { input: '/settings', kind: 'command' },
  });
  assert.equal(command.status, 409);
  assert.equal(command.body.error.code, 'command_transport_unavailable');

  const firstFinalized = await request(base, '/sessions/real-http-session/finalize', {
    method: 'POST',
    body: { reason: 'first_pass_complete' },
  });
  assert.equal(firstFinalized.status, 200, JSON.stringify(firstFinalized.body));
  assert.deepEqual(firstFinalized.body.result, { finalized: true, reason: 'first_pass_complete' });
  assert.doesNotMatch(JSON.stringify(firstFinalized.body.result), /provider|model|private/iu);
  const sessionTraceDir = tutorStubProcessSessionTraceDirectory(traceDir, 'real-http-session');
  const explicitResumePath = path.join(
    sessionTraceDir,
    fs.readdirSync(sessionTraceDir).find((name) => name.endsWith('.jsonl')),
  );
  const sourceRunId = path.basename(explicitResumePath, '.jsonl');

  const outsideResumePath = writeResumeTrace(tmp, 'outside-http-traces', 'outside-http-run');
  const outsideResume = await request(base, '/sessions', {
    method: 'POST',
    body: {
      id: 'outside-resume-http-session',
      mode: 'direct',
      model: 'codex.gpt-5.6-terra',
      world: 'world_005_marrick',
      resume: outsideResumePath,
    },
  });
  assert.equal(outsideResume.status, 400);
  assert.equal(outsideResume.body.error.code, 'invalid_resume_source');
  assert.doesNotMatch(
    JSON.stringify(outsideResume.body),
    new RegExp(tmp.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'),
  );

  const resumedLast = await request(base, '/sessions', {
    method: 'POST',
    body: {
      id: 'resume-last-http-session',
      mode: 'direct',
      model: 'codex.gpt-5.6-terra',
      world: 'world_005_marrick',
      resumeLast: true,
    },
  });
  assert.equal(resumedLast.status, 201, JSON.stringify(resumedLast.body));
  assert.equal(resumedLast.body.session.sessionId, 'resume-last-http-session');
  assert.equal(resumedLast.body.session.state.turnCount, 1);
  assert.equal(resumedLast.body.session.state.publicMessageCount, 3);
  const resumeLastFinalized = await request(base, '/sessions/resume-last-http-session/finalize', {
    method: 'POST',
    body: { reason: 'resume_last_verified' },
  });
  assert.equal(resumeLastFinalized.status, 200, JSON.stringify(resumeLastFinalized.body));
  assert.deepEqual(resumeLastFinalized.body.result, { finalized: true, reason: 'resume_last_verified' });

  const resumed = await request(base, '/sessions', {
    method: 'POST',
    body: {
      id: 'named-resume-http-session',
      mode: 'direct',
      model: 'codex.gpt-5.6-terra',
      world: 'world_005_marrick',
      resume: sourceRunId,
    },
  });
  assert.equal(resumed.status, 201, JSON.stringify(resumed.body));
  assert.equal(resumed.body.session.sessionId, 'named-resume-http-session');
  assert.equal(resumed.body.session.state.turnCount, 1);
  assert.equal(resumed.body.session.state.publicMessageCount, 3);
  assert.equal(resumed.body.session.state.opening.role, 'assistant');

  const reset = await request(base, '/sessions/named-resume-http-session/reset', {
    method: 'POST',
    body: { reason: 'repeat_inquiry' },
  });
  assert.equal(reset.status, 200, JSON.stringify(reset.body));
  assert.deepEqual(reset.body.result, { reset: true });
  assert.doesNotMatch(JSON.stringify(reset.body.result), /provider|model|private/iu);
  assert.equal(reset.body.session.state.turnCount, 0);
  assert.equal(reset.body.session.state.publicMessageCount, 1);
  assert.equal(reset.body.session.state.opening.role, 'assistant');

  const finalized = await request(base, '/sessions/named-resume-http-session/finalize', {
    method: 'POST',
    body: { reason: 'integration_complete' },
  });
  assert.equal(finalized.status, 200, JSON.stringify(finalized.body));
  assert.deepEqual(finalized.body.result, { finalized: true, reason: 'integration_complete' });
  assert.doesNotMatch(JSON.stringify(finalized.body.result), /provider|model|private/iu);
  assert.equal(finalized.body.session.status, 'finalized');
  assert.equal(finalized.body.session.lifecycle.finalizedReason, 'integration_complete');

  const evicted = await request(base, '/sessions/named-resume-http-session');
  assert.equal(evicted.status, 404);
  assert.equal(evicted.body.error.code, 'session_not_found');
  assert.ok(fs.existsSync(tutorStubProcessSessionTraceDirectory(traceDir, 'resume-last-http-session')));
  assert.ok(fs.existsSync(tutorStubProcessSessionTraceDirectory(traceDir, 'named-resume-http-session')));

  const duplicateNamespace = path.join(traceDir, 'duplicate-run-id-namespace');
  fs.mkdirSync(duplicateNamespace);
  fs.copyFileSync(explicitResumePath, path.join(duplicateNamespace, `${sourceRunId}.jsonl`));
  const ambiguousResume = await request(base, '/sessions', {
    method: 'POST',
    body: {
      id: 'ambiguous-resume-http-session',
      mode: 'direct',
      model: 'codex.gpt-5.6-terra',
      world: 'world_005_marrick',
      resume: sourceRunId,
    },
  });
  assert.equal(ambiguousResume.status, 400);
  assert.equal(ambiguousResume.body.error.code, 'ambiguous_resume_source');
  assert.doesNotMatch(
    JSON.stringify(ambiguousResume.body),
    new RegExp(tmp.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'),
  );

  const labSession = await request(base, '/sessions', {
    method: 'POST',
    body: {
      id: 'pure-chat-lab-session',
      lab: 'pure_chat',
      mode: 'passthrough',
      model: 'codex.gpt-5.6-terra',
      world: 'none',
    },
  });
  assert.equal(labSession.status, 201, JSON.stringify(labSession.body));
  assert.equal(labSession.body.session.capabilitySnapshot.mode, 'passthrough');
  const labFinalized = await request(base, '/sessions/pure-chat-lab-session/finalize', {
    method: 'POST',
    body: { reason: 'lab_mapping_verified' },
  });
  assert.equal(labFinalized.status, 200, JSON.stringify(labFinalized.body));
});
