import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  COST_CLASSES,
  JOB_KINDS,
  describeKinds,
  planJob,
  launchJob,
  listJobs,
  getJob,
  stopJob,
  _resetJobs,
} from '../services/poetics/jobRunner.js';

// ── Fakes ─────────────────────────────────────────────────────────────────────

function makeFakeChild() {
  const child = new EventEmitter();
  child.pid = 4242;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.killed = false;
  child.killSignal = null;
  child.kill = (sig) => {
    child.killed = true;
    child.killSignal = sig;
    return true;
  };
  return child;
}

function recordingSpawn() {
  const calls = [];
  const spawn = (cmd, argv, opts) => {
    const child = makeFakeChild();
    calls.push({ cmd, argv, opts, child });
    return child;
  };
  return { spawn, calls };
}

function throwingSpawn(message) {
  return () => {
    throw new Error(message);
  };
}

function testDeps(spawnFn) {
  let t = 1000;
  let n = 0;
  return {
    spawn: spawnFn,
    now: () => (t += 1),
    makeId: () => `job-${++n}`,
    logDir: '/tmp/poetics-job-test-ignored',
    createWriteStream: () => ({ write() {}, end() {} }),
    ensureDir: () => {},
  };
}

beforeEach(() => _resetJobs());

// ── planJob: replay ────────────────────────────────────────────────────────────

test('replay: mock+item is free and emits --mock --item-id', () => {
  const plan = planJob({ kind: 'replay', params: { mock: true, mode: 'item', itemId: 'run:abc:0' } });
  assert.equal(plan.costClass, COST_CLASSES.FREE);
  assert.deepEqual(plan.argv, ['--mock', '--item-id', 'run:abc:0']);
  assert.match(plan.command, /^node scripts\/replay-discursive-transcript\.js /u);
});

test('planJob: exposes checklist, result links, and cloned params for the UI', () => {
  const plan = planJob({ kind: 'online-score', params: { mode: 'run', runId: 'R9', dryRun: true } });
  assert.equal(plan.params.runId, 'R9');
  assert.ok(plan.checks.some((c) => c.label === 'Whitelisted script' && c.state === 'ok'));
  assert.ok(plan.checks.some((c) => c.label === 'Cost gate' && c.detail.includes('free')));
  assert.deepEqual(plan.links, [{ label: 'open scored scripts', href: '/browse?runId=R9&tab=scores' }]);
});

test('replay: codex generator + adversarial checker is quota', () => {
  const plan = planJob({
    kind: 'replay',
    params: { generator: 'codex', checker: 'adversarial', mode: 'item', itemId: 'x' },
  });
  assert.equal(plan.costClass, COST_CLASSES.QUOTA);
  assert.deepEqual(plan.argv, ['--generator', 'codex', '--checker', 'adversarial', '--item-id', 'x']);
});

test('replay: mock generator + none checker stays free', () => {
  const plan = planJob({ kind: 'replay', params: { generator: 'mock', checker: 'none', mode: 'item', itemId: 'x' } });
  assert.equal(plan.costClass, COST_CLASSES.FREE);
});

test('replay: run mode threads --run-id and --limit', () => {
  const plan = planJob({ kind: 'replay', params: { mode: 'run', runId: 'R1', limit: 5, mock: true } });
  assert.deepEqual(plan.argv, ['--mock', '--run-id', 'R1', '--limit', '5']);
});

test('replay: transcript mode + dry-run + force', () => {
  const plan = planJob({
    kind: 'replay',
    params: { mode: 'transcript', transcript: '/tmp/t.txt', generator: 'claude', dryRun: true, force: true },
  });
  assert.deepEqual(plan.argv, [
    '--generator',
    'claude',
    '--checker',
    'none',
    '--transcript',
    '/tmp/t.txt',
    '--dry-run',
    '--force',
  ]);
});

test('replay: missing input mode throws', () => {
  assert.throws(() => planJob({ kind: 'replay', params: { mock: true } }), /mode must be one of/u);
});

test('replay: bad generator enum throws', () => {
  assert.throws(
    () => planJob({ kind: 'replay', params: { generator: 'gpt5', mode: 'item', itemId: 'x' } }),
    /generator must be one of/u,
  );
});

test('replay: item mode without itemId throws', () => {
  assert.throws(() => planJob({ kind: 'replay', params: { mode: 'item', mock: true } }), /itemId is required/u);
});

// ── planJob: generate ──────────────────────────────────────────────────────────

test('generate: always injects --non-interactive and mock is free', () => {
  const plan = planJob({ kind: 'generate', params: { mock: true, id: 'demo' } });
  assert.equal(plan.argv[0], '--non-interactive');
  assert.ok(plan.argv.includes('--mock'));
  assert.deepEqual(plan.argv.slice(-2), ['--id', 'demo']);
  assert.equal(plan.costClass, COST_CLASSES.FREE);
});

test('generate: OpenRouter org/model slug is metered', () => {
  const plan = planJob({ kind: 'generate', params: { generator: 'openrouter', model: 'anthropic/claude-sonnet-4.6' } });
  assert.equal(plan.costClass, COST_CLASSES.METERED);
  assert.ok(plan.argv.includes('--non-interactive'));
});

test('generate: bare CLI backend (no slash) is quota', () => {
  const plan = planJob({ kind: 'generate', params: { generator: 'codex', model: 'gpt-5-codex' } });
  assert.equal(plan.costClass, COST_CLASSES.QUOTA);
});

test('generate: spec-only and dry-run are free', () => {
  assert.equal(planJob({ kind: 'generate', params: { specOnly: true } }).costClass, COST_CLASSES.FREE);
  assert.equal(planJob({ kind: 'generate', params: { dryRun: true } }).costClass, COST_CLASSES.FREE);
});

test('generate: numeric --max-turns is validated', () => {
  const plan = planJob({ kind: 'generate', params: { mock: true, maxTurns: 8 } });
  assert.ok(plan.argv.includes('--max-turns'));
  assert.equal(plan.argv[plan.argv.indexOf('--max-turns') + 1], '8');
  assert.throws(() => planJob({ kind: 'generate', params: { mock: true, maxTurns: 0 } }), /positive integer/u);
});

// ── planJob: adversarial-score ──────────────────────────────────────────────────

test('adversarial-score: rules critic is free and requires sample-dir + key', () => {
  const plan = planJob({
    kind: 'adversarial-score',
    params: { critic: 'rules', sampleDir: '/tmp/s', key: '/tmp/k.yaml' },
  });
  assert.equal(plan.costClass, COST_CLASSES.FREE);
  assert.deepEqual(plan.argv, ['--critic', 'rules', '--sample-dir', '/tmp/s', '--key', '/tmp/k.yaml']);
});

test('adversarial-score: claude critic is quota', () => {
  const plan = planJob({
    kind: 'adversarial-score',
    params: { critic: 'claude', sampleDir: '/tmp/s', key: '/tmp/k.yaml' },
  });
  assert.equal(plan.costClass, COST_CLASSES.QUOTA);
});

test('adversarial-score: missing sampleDir throws', () => {
  assert.throws(
    () => planJob({ kind: 'adversarial-score', params: { critic: 'rules', key: '/tmp/k.yaml' } }),
    /sampleDir is required/u,
  );
});

test('adversarial-score: mock downgrades a model critic to free', () => {
  const plan = planJob({
    kind: 'adversarial-score',
    params: { critic: 'codex', sampleDir: '/tmp/s', key: '/tmp/k.yaml', mock: true, failOnViolation: true },
  });
  assert.equal(plan.costClass, COST_CLASSES.FREE);
  assert.ok(plan.argv.includes('--mock'));
  assert.ok(plan.argv.includes('--fail-on-violation'));
});

// ── planJob: online-score ────────────────────────────────────────────────────────

test('online-score: real run mode is metered with default model', () => {
  const plan = planJob({ kind: 'online-score', params: { mode: 'run', runId: 'R9' } });
  assert.equal(plan.costClass, COST_CLASSES.METERED);
  assert.deepEqual(plan.argv, ['--run-id', 'R9', '--model', 'anthropic/claude-sonnet-4.6']);
});

test('online-score: mock and dry-run are free', () => {
  assert.equal(
    planJob({ kind: 'online-score', params: { mode: 'run', runId: 'R', mock: true } }).costClass,
    COST_CLASSES.FREE,
  );
  assert.equal(
    planJob({ kind: 'online-score', params: { mode: 'root', rootDir: '/tmp/r', dryRun: true } }).costClass,
    COST_CLASSES.FREE,
  );
});

test('online-score: missing mode throws', () => {
  assert.throws(() => planJob({ kind: 'online-score', params: { runId: 'R' } }), /mode must be one of/u);
});

test('planJob: unknown kind throws', () => {
  assert.throws(() => planJob({ kind: 'nope', params: {} }), /unknown job kind/u);
});

test('describeKinds lists all whitelisted kinds', () => {
  const kinds = describeKinds().map((k) => k.kind);
  assert.deepEqual(kinds.sort(), [
    'adversarial-score',
    'derivation',
    'generate',
    'online-score',
    'pedagogical-drama',
    'replay',
  ]);
  assert.equal(Object.keys(JOB_KINDS).length, 6);
});

// ── planJob: derivation (proof-DAG drama via run-derivation-loop.js) ───────────

test('derivation: mock backend is free, --real is metered, and dirs target the loop', () => {
  const mock = planJob({ kind: 'derivation', params: { world: 'world-000-smoke.yaml', script: 'nocturne-v001.md' } });
  assert.equal(mock.costClass, COST_CLASSES.FREE);
  assert.match(mock.script, /run-derivation-loop\.js$/u);
  assert.ok(mock.argv.includes('config/drama-derivation/world-000-smoke.yaml'));
  assert.ok(mock.argv.includes('config/drama-derivation/tutor-scripts/nocturne-v001.md'));

  const real = planJob({
    kind: 'derivation',
    params: { world: 'world-000-smoke.yaml', script: 'nocturne-v001.md', real: true },
  });
  assert.equal(real.costClass, COST_CLASSES.METERED);
  assert.ok(real.argv.includes('--real'));
});

test('derivation: stall-watch requires superego; unknown world/script rejected', () => {
  assert.throws(
    () =>
      planJob({
        kind: 'derivation',
        params: { world: 'world-000-smoke.yaml', script: 'nocturne-v001.md', stallWatch: true },
      }),
    /stall-watch requires superego/u,
  );
  assert.throws(
    () => planJob({ kind: 'derivation', params: { world: 'does-not-exist.yaml', script: 'nocturne-v001.md' } }),
    /world not found/u,
  );
  assert.throws(
    () => planJob({ kind: 'derivation', params: { world: 'world-000-smoke.yaml', script: 'nope.md' } }),
    /tutor script not found/u,
  );
});

// ── planJob: pedagogical-drama (compiled curriculum drama spec) ────────────────

test('pedagogical-drama: mock is free and dirs are isolated under exports/curriculum-drama', () => {
  const plan = planJob({
    kind: 'pedagogical-drama',
    params: { spec: 'ai-foundations.dramas.yaml', only: 'D_AF6_X', mock: true },
  });
  assert.equal(plan.costClass, COST_CLASSES.FREE);
  assert.match(plan.script, /generate-pedagogical-dramas\.js$/u);
  // A bare basename resolves under curriculum/, and every output dir is pinned
  // under exports/curriculum-drama/<base> — never the phase2 calibration tree.
  assert.ok(plan.argv.includes('curriculum/ai-foundations.dramas.yaml'));
  assert.ok(plan.argv.includes('exports/curriculum-drama/ai-foundations/samples'));
  assert.ok(!plan.command.includes('poetics-calibration'));
});

test('pedagogical-drama: claude generator is quota; api + org/model slug is metered', () => {
  const quota = planJob({ kind: 'pedagogical-drama', params: { spec: 'x.dramas.yaml', generator: 'claude' } });
  assert.equal(quota.costClass, COST_CLASSES.QUOTA);
  const metered = planJob({
    kind: 'pedagogical-drama',
    params: { spec: 'x.dramas.yaml', generator: 'api', model: 'anthropic/claude-sonnet-4.6' },
  });
  assert.equal(metered.costClass, COST_CLASSES.METERED);
});

test('pedagogical-drama: can opt into persistent Claude workers', () => {
  const plan = planJob({
    kind: 'pedagogical-drama',
    params: { spec: 'x.dramas.yaml', generator: 'claude', claudePersistentWorkers: true },
  });
  assert.ok(plan.argv.includes('--claude-persistent-workers'));
  assert.match(plan.command, /--claude-persistent-workers/u);
});

test('pedagogical-drama: rejects traversal, non-yaml, and absolute outBase', () => {
  assert.throws(
    () => planJob({ kind: 'pedagogical-drama', params: { spec: '../secrets.yaml' } }),
    /invalid characters/u,
  );
  assert.throws(() => planJob({ kind: 'pedagogical-drama', params: { spec: 'notes.txt' } }), /must be a \.yaml/u);
  assert.throws(
    () => planJob({ kind: 'pedagogical-drama', params: { spec: 'ok.yaml', outBase: '/etc' } }),
    /repo-relative/u,
  );
  assert.throws(() => planJob({ kind: 'pedagogical-drama', params: {} }), /spec is required/u);
});

// ── launchJob lifecycle ──────────────────────────────────────────────────────────

test('launchJob: free job spawns and close→done', () => {
  const { spawn, calls } = recordingSpawn();
  const pub = launchJob({ kind: 'replay', params: { mock: true, mode: 'item', itemId: 'x' } }, testDeps(spawn));
  assert.equal(pub.status, 'running');
  assert.equal(pub.pid, 4242);
  assert.equal(pub.params.itemId, 'x');
  assert.ok(pub.links.some((l) => l.href === '/replays'));
  // spawned node <scriptPath> --mock --item-id x  (argv array, no shell string)
  assert.equal(calls.length, 1);
  assert.match(calls[0].argv[0], /replay-discursive-transcript\.js$/u);
  assert.deepEqual(calls[0].argv.slice(1), ['--mock', '--item-id', 'x']);
  assert.equal(calls[0].opts.cwd !== undefined, true);

  calls[0].child.emit('close', 0, null);
  const done = getJob(pub.id);
  assert.equal(done.status, 'done');
  assert.equal(done.exitCode, 0);
  // public projection never leaks the live child handle
  assert.equal(Object.prototype.hasOwnProperty.call(done, 'child'), false);
});

test('launchJob: non-zero close→failed', () => {
  const { spawn, calls } = recordingSpawn();
  const pub = launchJob(
    { kind: 'adversarial-score', params: { sampleDir: '/tmp/s', key: '/tmp/k.yaml' } },
    testDeps(spawn),
  );
  calls[0].child.emit('close', 1, null);
  assert.equal(getJob(pub.id).status, 'failed');
  assert.equal(getJob(pub.id).exitCode, 1);
});

test('launchJob: serial gate blocks a second non-free job, free overlaps', () => {
  const { spawn, calls } = recordingSpawn();
  const deps = testDeps(spawn);
  const paid = launchJob({ kind: 'online-score', params: { mode: 'run', runId: 'R1' } }, deps);
  assert.equal(paid.costClass, COST_CLASSES.METERED);
  assert.equal(paid.status, 'running');

  // a second quota/metered job must be refused while one runs
  assert.throws(
    () => launchJob({ kind: 'online-score', params: { mode: 'run', runId: 'R2' } }, deps),
    (e) => e.code === 'SERIAL_BUSY',
  );

  // a free job is allowed to overlap
  const free = launchJob({ kind: 'replay', params: { mock: true, mode: 'item', itemId: 'x' } }, deps);
  assert.equal(free.status, 'running');

  // once the paid job closes, the lock frees and a new paid job launches
  calls[0].child.emit('close', 0, null);
  const paid2 = launchJob({ kind: 'online-score', params: { mode: 'run', runId: 'R3' } }, deps);
  assert.equal(paid2.status, 'running');
});

test('launchJob: stopJob sends SIGTERM and close keeps stopped', () => {
  const { spawn, calls } = recordingSpawn();
  const pub = launchJob({ kind: 'online-score', params: { mode: 'run', runId: 'R1' } }, testDeps(spawn));
  const stopped = stopJob(pub.id);
  assert.equal(stopped.status, 'stopped');
  assert.equal(calls[0].child.killed, true);
  assert.equal(calls[0].child.killSignal, 'SIGTERM');

  // the eventual close must NOT flip 'stopped' back to done/failed
  calls[0].child.emit('close', null, 'SIGTERM');
  const after = getJob(pub.id);
  assert.equal(after.status, 'stopped');
  assert.equal(after.signal, 'SIGTERM');
});

test('launchJob: spawn throwing marks the job errored (and frees the lock)', () => {
  const pub = launchJob(
    { kind: 'online-score', params: { mode: 'run', runId: 'R1' } },
    testDeps(throwingSpawn('ENOENT node')),
  );
  assert.equal(pub.status, 'error');
  assert.match(pub.error, /ENOENT node/u);
  // errored job does not hold the serial lock
  const { spawn } = recordingSpawn();
  const next = launchJob({ kind: 'online-score', params: { mode: 'run', runId: 'R2' } }, testDeps(spawn));
  assert.equal(next.status, 'running');
});

test('launchJob: stdout/stderr feed the log tail', () => {
  const { spawn, calls } = recordingSpawn();
  const pub = launchJob({ kind: 'replay', params: { mock: true, mode: 'item', itemId: 'x' } }, testDeps(spawn));
  calls[0].child.stdout.emit('data', Buffer.from('hello\nworld\n'));
  calls[0].child.stderr.emit('data', Buffer.from('a warning\n'));
  const tail = getJob(pub.id).logTail;
  assert.match(tail, /hello/u);
  assert.match(tail, /world/u);
  assert.match(tail, /a warning/u);
});

test('listJobs is newest-first and stopJob on unknown id returns null', () => {
  const { spawn } = recordingSpawn();
  const deps = testDeps(spawn);
  const a = launchJob({ kind: 'replay', params: { mock: true, mode: 'item', itemId: 'a' } }, deps);
  const b = launchJob({ kind: 'replay', params: { mock: true, mode: 'item', itemId: 'b' } }, deps);
  const ids = listJobs().map((j) => j.id);
  assert.deepEqual(ids, [b.id, a.id]);
  assert.equal(stopJob('does-not-exist'), null);
});
