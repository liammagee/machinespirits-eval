import fs from 'node:fs';
import path from 'node:path';
import { spawn as realSpawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// ============================================================================
// Poetics job launcher — guarded spawner for the four poetics run types.
//
// The browser can kick off (1) new generative drama runs, (2) discursive
// replays (counterfactual revisions), (3) adversarial CLI structure scores, and
// (4) online OpenRouter-METERED Sonnet scores. Each kind maps to exactly one
// whitelisted script; user input is turned into an argv ARRAY by a per-kind
// builder (never a shell string), and the resolved cost class drives the UI's
// confirm gate + a serial lock.
//
// Cost classes:
//   free      — mock / rules / dry-run. No spend, may overlap.
//   quota     — CLI / Max-plan routing (codex/claude/agy/gemini). Drains the
//               plan; no per-call $. Serialised: one at a time.
//   metered   — OpenRouter real money (score-poetics-missing-sonnet.js, or any
//               run whose --model is an `org/model` OpenRouter slug). Serialised.
//
// Auth is DEFERRED (localhost-only operation, sanctioned 2026-06-04). Before any
// non-localhost deploy, password protection is REQUIRED around this surface.
// ============================================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '../..');
// Exports root is overridable via EVAL_EXPORTS_DIR (the Electron desktop app
// relocates it into the user-data dir, the same way EVAL_DB_PATH / EVAL_LOGS_DIR
// relocate the DB + logs). Defaults to <repo>/exports for the web servers + CLI,
// so behaviour is unchanged when the env var is unset.
const EXPORTS_ROOT = process.env.EVAL_EXPORTS_DIR || path.join(ROOT_DIR, 'exports');
const LOG_DIR = path.join(EXPORTS_ROOT, '.poetics-job-logs');

// Keep only the tail of stdout/stderr in memory; the full stream goes to logFile.
const MAX_LOG_LINES = 300;

export const COST_CLASSES = Object.freeze({
  FREE: 'free',
  QUOTA: 'quota',
  METERED: 'metered',
});

// ── Param coercion helpers (builders throw on bad input → route maps to 400) ──

function reqString(params, key) {
  const v = params[key];
  if (typeof v !== 'string' || v.trim() === '') throw new Error(`${key} is required`);
  return v.trim();
}

function optString(params, key) {
  const v = params[key];
  if (v == null || v === '') return null;
  if (typeof v !== 'string') throw new Error(`${key} must be a string`);
  return v.trim();
}

function optPosInt(params, key) {
  const v = params[key];
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${key} must be a positive integer`);
  return n;
}

function enumValue(params, key, allowed, dflt) {
  const v = params[key];
  if (v == null || v === '') return dflt;
  if (!allowed.includes(v)) throw new Error(`${key} must be one of: ${allowed.join(', ')}`);
  return v;
}

function bool(v) {
  return v === true || v === 'true' || v === 'on' || v === 1 || v === '1';
}

// An OpenRouter-style `org/model` slug means real metered spend, wherever it
// appears (some backends accept an arbitrary --model). A bare CLI backend name
// (codex/claude/agy/gemini) routes through the plan → quota, not metered.
function looksMetered(model) {
  return typeof model === 'string' && model.includes('/');
}

// ── Per-kind argv builders ────────────────────────────────────────────────────

const REPLAY_GENERATORS = ['mock', 'codex', 'claude', 'agy', 'gemini'];
const REPLAY_CHECKERS = ['none', 'mock', 'codex', 'claude', 'agy', 'gemini', 'adversarial'];

function buildReplay(params) {
  const mock = bool(params.mock);
  const generator = mock ? 'mock' : enumValue(params, 'generator', REPLAY_GENERATORS, 'mock');
  const checker = mock ? 'mock' : enumValue(params, 'checker', REPLAY_CHECKERS, 'none');
  const dryRun = bool(params.dryRun);
  const force = bool(params.force);

  const argv = [];
  if (mock) argv.push('--mock');
  else argv.push('--generator', generator, '--checker', checker);

  // Exactly one input selector.
  const mode = enumValue(params, 'mode', ['item', 'run', 'transcript'], null);
  if (mode === 'item') {
    argv.push('--item-id', reqString(params, 'itemId'));
  } else if (mode === 'run') {
    argv.push('--run-id', reqString(params, 'runId'));
    const limit = optPosInt(params, 'limit');
    if (limit) argv.push('--limit', String(limit));
  } else if (mode === 'transcript') {
    argv.push('--transcript', reqString(params, 'transcript'));
  } else {
    throw new Error('mode must be one of: item, run, transcript');
  }

  const db = optString(params, 'db');
  if (db) argv.push('--db', db);
  const outDir = optString(params, 'outDir');
  if (outDir) argv.push('--out-dir', outDir);
  if (dryRun) argv.push('--dry-run');
  if (force) argv.push('--force');

  // The replay generators route through the CLI/plan, never OpenRouter billing,
  // so the worst case here is quota — never metered $.
  const free = generator === 'mock' && (checker === 'none' || checker === 'mock');
  const costClass = free ? COST_CLASSES.FREE : COST_CLASSES.QUOTA;
  const label = `replay · ${mode} · gen=${generator} · check=${checker}${dryRun ? ' · dry-run' : ''}`;
  const costNote =
    costClass === COST_CLASSES.FREE
      ? 'Mock generator + no/mock checker — no spend.'
      : `Generator "${generator}"${checker !== 'none' ? ` + checker "${checker}"` : ''} route through the CLI/Max plan (quota drain, no per-call $).`;
  return { argv, costClass, label, costNote };
}

function buildGenerate(params) {
  const mock = bool(params.mock);
  const dryRun = bool(params.dryRun);
  const specOnly = bool(params.specOnly);
  const force = bool(params.force);

  // drama-generator.js is interactive (readline) by default — a spawned process
  // would hang waiting on stdin. --non-interactive is mandatory here.
  const argv = ['--non-interactive'];
  if (mock) argv.push('--mock');
  if (dryRun) argv.push('--dry-run');
  if (specOnly) argv.push('--spec-only');
  if (force) argv.push('--force');

  const id = optString(params, 'id');
  if (id) argv.push('--id', id);
  const generator = optString(params, 'generator');
  if (generator) argv.push('--generator', generator);
  const model = optString(params, 'model');
  if (model) argv.push('--model', model);
  const effort = optString(params, 'effort');
  if (effort) argv.push('--effort', effort);
  const maxTurns = optPosInt(params, 'maxTurns');
  if (maxTurns) argv.push('--max-turns', String(maxTurns));
  const title = optString(params, 'title');
  if (title) argv.push('--title', title);
  const outRoot = optString(params, 'outRoot');
  if (outRoot) argv.push('--out-root', outRoot);
  const roleMap = optString(params, 'roleMap');
  if (roleMap) argv.push('--role-map', roleMap);
  const answers = optString(params, 'answers');
  if (answers) argv.push('--answers', answers);

  const free = mock || dryRun || specOnly;
  let costClass;
  if (free) costClass = COST_CLASSES.FREE;
  else if (looksMetered(model)) costClass = COST_CLASSES.METERED;
  else costClass = COST_CLASSES.QUOTA;

  const label = `generate · ${id || 'auto-id'}${mock ? ' · mock' : ''}${dryRun ? ' · dry-run' : ''}${specOnly ? ' · spec-only' : ''}`;
  const costNote =
    costClass === COST_CLASSES.FREE
      ? 'Mock / dry-run / spec-only — no spend.'
      : costClass === COST_CLASSES.METERED
        ? `--model "${model}" is an OpenRouter slug — REAL metered spend.`
        : `Generator backend routes through the CLI/Max plan (quota drain).`;
  return { argv, costClass, label, costNote };
}

const DRAMA_GENERATORS = ['claude', 'codex', 'gemini', 'api'];

// Enact a compiled curriculum drama spec (curriculum/<name>.dramas.yaml) through
// generate-pedagogical-dramas.js — the SAME batch generator the curriculum
// compiler targets. --only picks one drama; omit it to run the whole spec. A bare
// spec basename resolves under curriculum/; a slashed path is taken relative to
// the repo root. Generator claude/codex/gemini route through the Max plan (quota);
// only generator=api with an OpenRouter slug is metered $.
function buildPedagogicalDrama(params) {
  const mock = bool(params.mock);
  const dryRun = bool(params.dryRun);
  const force = bool(params.force);
  const generator = enumValue(params, 'generator', DRAMA_GENERATORS, 'claude');
  const model = optString(params, 'model');
  const only = optString(params, 'only');
  const maxTurns = optPosInt(params, 'maxTurns');
  const claudePersistentWorkers = bool(params.claudePersistentWorkers);

  const spec = reqString(params, 'spec');
  if (spec.includes('..') || !/^[\w.\-/]+$/.test(spec)) throw new Error('spec has invalid characters');
  if (!spec.endsWith('.yaml') && !spec.endsWith('.yml')) throw new Error('spec must be a .yaml file');
  // No leading slash, and a slashed path must stay repo-relative (the guard above
  // already blocks ".."). A bare basename is a compiled spec under curriculum/.
  if (spec.startsWith('/')) throw new Error('spec must be a repo-relative path');
  const specPath = spec.includes('/') ? spec : `curriculum/${spec}`;

  const argv = ['--spec', specPath];
  if (only) argv.push('--only', only);
  argv.push('--generator', generator);
  if (model) argv.push('--model', model);
  if (maxTurns) argv.push('--max-turns', String(maxTurns));

  // The generator otherwise defaults its out/transcripts/delib/key dirs INTO the
  // config/poetics-calibration/phase2-* tree (its native home). A UI-launched
  // curriculum run must never land there, so pin all four under one dedicated base
  // — exports/curriculum-drama/<specBase> by default, or an operator override.
  const specBase = (specPath.split('/').pop() || 'curriculum').replace(/\.dramas\.ya?ml$|\.ya?ml$/, '');
  const outBase = optString(params, 'outBase') || `exports/curriculum-drama/${specBase}`;
  if (outBase.includes('..') || outBase.startsWith('/')) throw new Error('outBase must be a repo-relative path');
  argv.push('--out-dir', `${outBase}/samples`);
  argv.push('--transcripts-dir', `${outBase}/transcripts`);
  argv.push('--delib-dir', `${outBase}/deliberations`);
  argv.push('--key', `${outBase}/key.yaml`);

  if (mock) argv.push('--mock');
  if (dryRun) argv.push('--dry-run');
  if (force) argv.push('--force');
  if (claudePersistentWorkers) argv.push('--claude-persistent-workers');

  const free = mock || dryRun;
  let costClass;
  if (free) costClass = COST_CLASSES.FREE;
  else if (generator === 'api' && looksMetered(model)) costClass = COST_CLASSES.METERED;
  else costClass = COST_CLASSES.QUOTA;

  const label = `pedagogical-drama · ${only || 'all'} · gen=${generator}${mock ? ' · mock' : ''}${dryRun ? ' · dry-run' : ''}`;
  const costNote = free
    ? 'Mock / dry-run — no spend.'
    : costClass === COST_CLASSES.METERED
      ? `generator=api + --model "${model}" is an OpenRouter slug — REAL metered spend.`
      : `Generator "${generator}" routes through the CLI/Max plan (quota drain, no per-call $).`;
  return { argv, costClass, label, costNote };
}

// Launch a proof-DAG derivation run (scripts/run-derivation-loop.js) — a tutor
// script enacted against a world, rule-checked into grounded / impasse /
// disengagement. The loop writes live.json under exports/dramatic-derivation/loop/
// <label>, so a launched run STREAMS to /derivation/live and lands on /derivation
// when it closes. Mock backend is zero-cost; --real targets OpenRouter
// (default gemini-flash) = metered $. The full experimental flag surface stays on
// the CLI — this exposes the core dials (world × script + register + superego).
const DERIVATION_CONFIG_REL = 'config/drama-derivation';

function buildDerivation(params) {
  const real = bool(params.real);
  const superego = bool(params.superego);
  const stallWatch = bool(params.stallWatch);

  const world = reqString(params, 'world');
  if (world.includes('..') || !/^[\w.-]+\.ya?ml$/.test(world)) throw new Error('world must be a world-*.yaml basename');
  const script = reqString(params, 'script');
  if (script.includes('..') || !/^[\w.-]+\.md$/.test(script))
    throw new Error('script must be a tutor-script .md basename');
  const worldRel = `${DERIVATION_CONFIG_REL}/${world}`;
  const scriptRel = `${DERIVATION_CONFIG_REL}/tutor-scripts/${script}`;
  if (!fs.existsSync(path.join(ROOT_DIR, worldRel))) throw new Error(`world not found: ${world}`);
  if (!fs.existsSync(path.join(ROOT_DIR, scriptRel))) throw new Error(`tutor script not found: ${script}`);

  const argv = ['--world', worldRel, '--script', scriptRel];
  const label = optString(params, 'label');
  if (label) {
    if (!/^[\w.-]+$/.test(label)) throw new Error('label has invalid characters');
    argv.push('--label', label);
  }
  const recognition = enumValue(params, 'recognition', ['0', '1', '2', '3'], null);
  if (recognition != null) argv.push('--recognition', recognition);
  const charisma = enumValue(params, 'charisma', ['0', '1', '2', '3'], null);
  if (charisma != null) argv.push('--charisma', charisma);
  const dramaturgy = enumValue(params, 'dramaturgy', ['free', 'frozen'], null);
  if (dramaturgy) argv.push('--dramaturgy', dramaturgy);
  if (superego) argv.push('--superego');
  if (stallWatch) {
    if (!superego) throw new Error('stall-watch requires superego');
    argv.push('--stall-watch');
  }
  if (real) argv.push('--real');

  const costClass = real ? COST_CLASSES.METERED : COST_CLASSES.FREE;
  const label2 = `derivation · ${world.replace(/\.ya?ml$/, '')} × ${script.replace(/\.md$/, '')}${real ? ' · REAL' : ' · mock'}`;
  const costNote = real
    ? 'Real run — OpenRouter metered spend (default gemini-flash; DERIVATION_MODEL overrides). Streams live to /derivation/live.'
    : 'Mock backend — zero cost. Streams live to /derivation/live; lands on /derivation when it closes.';
  return { argv, costClass, label: label2, costNote };
}

const STRUCTURE_CRITICS = ['rules', 'codex', 'claude', 'claude-code'];

function buildAdversarialScore(params) {
  const mock = bool(params.mock);
  const critic = enumValue(params, 'critic', STRUCTURE_CRITICS, 'rules');
  const sampleDir = reqString(params, 'sampleDir');
  const key = reqString(params, 'key');

  const argv = ['--critic', critic, '--sample-dir', sampleDir, '--key', key];
  const out = optString(params, 'out');
  if (out) argv.push('--out', out);
  const concurrency = optPosInt(params, 'concurrency');
  if (concurrency) argv.push('--concurrency', String(concurrency));
  const batchSize = optPosInt(params, 'batchSize');
  if (batchSize) argv.push('--batch-size', String(batchSize));
  if (mock) argv.push('--mock');
  if (bool(params.failOnViolation)) argv.push('--fail-on-violation');

  // The "rules" critic is pure local computation — no model calls at all.
  const free = critic === 'rules' || mock;
  const costClass = free ? COST_CLASSES.FREE : COST_CLASSES.QUOTA;
  const label = `adversarial-score · critic=${critic}${mock ? ' · mock' : ''}`;
  const costNote =
    costClass === COST_CLASSES.FREE
      ? critic === 'rules'
        ? 'Rules critic — pure local computation, no model calls.'
        : 'Mock critic — no spend.'
      : `Critic "${critic}" routes through the CLI/Max plan (quota drain).`;
  return { argv, costClass, label, costNote };
}

function buildOnlineScore(params) {
  const mock = bool(params.mock);
  const dryRun = bool(params.dryRun);
  const force = bool(params.force);
  const model = optString(params, 'model') || 'anthropic/claude-sonnet-4.6';

  const argv = [];
  const mode = enumValue(params, 'mode', ['run', 'root'], null);
  if (mode === 'run') argv.push('--run-id', reqString(params, 'runId'));
  else if (mode === 'root') argv.push('--root-dir', reqString(params, 'rootDir'));
  else throw new Error('mode must be one of: run, root');

  argv.push('--model', model);
  const scoreConcurrency = optPosInt(params, 'scoreConcurrency');
  if (scoreConcurrency) argv.push('--score-concurrency', String(scoreConcurrency));
  if (dryRun) argv.push('--dry-run');
  if (force) argv.push('--force');
  if (mock) argv.push('--mock');
  if (bool(params.allowQualityWarnings)) argv.push('--allow-quality-warnings');

  const free = mock || dryRun;
  const costClass = free ? COST_CLASSES.FREE : COST_CLASSES.METERED;
  const label = `online-score · ${mode} · ${model}${mock ? ' · mock' : ''}${dryRun ? ' · dry-run' : ''}`;
  const costNote =
    costClass === COST_CLASSES.FREE
      ? 'Mock / dry-run — no spend.'
      : `Scores via OpenRouter "${model}" — REAL metered spend on your API key.`;
  return { argv, costClass, label, costNote };
}

// ── Whitelisted job kinds ─────────────────────────────────────────────────────

export const JOB_KINDS = Object.freeze({
  replay: {
    kind: 'replay',
    script: 'scripts/replay-discursive-transcript.js',
    title: 'Replay — counterfactual revision',
    build: buildReplay,
  },
  generate: {
    kind: 'generate',
    script: 'scripts/drama-generator.js',
    title: 'Generate — pedagogical drama',
    build: buildGenerate,
  },
  'pedagogical-drama': {
    kind: 'pedagogical-drama',
    script: 'scripts/generate-pedagogical-dramas.js',
    title: 'Curriculum drama — enact a compiled spec',
    build: buildPedagogicalDrama,
  },
  derivation: {
    kind: 'derivation',
    script: 'scripts/run-derivation-loop.js',
    title: 'Derivation — proof-DAG drama (watch live)',
    build: buildDerivation,
  },
  'adversarial-score': {
    kind: 'adversarial-score',
    script: 'scripts/critic-poetics-structure.js',
    title: 'Adversarial score — structure critic (CLI)',
    build: buildAdversarialScore,
  },
  'online-score': {
    kind: 'online-score',
    script: 'scripts/score-poetics-missing-sonnet.js',
    title: 'Online score — Sonnet (OpenRouter, metered $)',
    build: buildOnlineScore,
  },
});

export function describeKinds() {
  return Object.values(JOB_KINDS).map(({ kind, title, script }) => ({ kind, title, script }));
}

// planJob resolves params → argv + cost class WITHOUT spawning. The UI calls
// this for the confirm screen so the exact command is shown before anything runs.
export function planJob({ kind, params }) {
  const spec = JOB_KINDS[kind];
  if (!spec) throw new Error(`unknown job kind: ${kind}`);
  const built = spec.build(params || {});
  return {
    kind,
    script: spec.script,
    title: spec.title,
    argv: built.argv,
    costClass: built.costClass,
    label: built.label,
    costNote: built.costNote,
    command: `node ${spec.script} ${built.argv.join(' ')}`,
  };
}

// ── Job registry + lifecycle ──────────────────────────────────────────────────

const jobs = new Map(); // jobId -> internal job record (carries the live child)

function pushLog(job, text) {
  const parts = String(text).split('\n');
  for (const line of parts) {
    if (line === '') continue;
    job.logTail.push(line);
  }
  if (job.logTail.length > MAX_LOG_LINES) {
    job.logTail.splice(0, job.logTail.length - MAX_LOG_LINES);
  }
}

// Client-facing projection — never leaks the child handle or the write stream.
function publicJob(job) {
  return {
    id: job.id,
    kind: job.kind,
    label: job.label,
    costClass: job.costClass,
    costNote: job.costNote,
    status: job.status,
    command: job.command,
    argv: job.argv,
    pid: job.pid,
    exitCode: job.exitCode,
    signal: job.signal || null,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    error: job.error,
    logFile: job.logFile,
    logTail: job.logTail.join('\n'),
  };
}

export function listJobs() {
  return [...jobs.values()].sort((a, b) => b.startedAt - a.startedAt).map(publicJob);
}

export function getJob(id) {
  const job = jobs.get(id);
  return job ? publicJob(job) : null;
}

// A non-free job holds an exclusive lock: only one quota/metered run at a time so
// paid work stays attended + human-gated. Free (mock/rules/dry-run) jobs overlap.
function activeNonFreeJob() {
  for (const job of jobs.values()) {
    if (job.status === 'running' && job.costClass !== COST_CLASSES.FREE) return job;
  }
  return null;
}

export function launchJob({ kind, params }, deps = {}) {
  const spawnFn = deps.spawn || realSpawn;
  const now = deps.now || (() => Date.now());
  const makeId = deps.makeId || (() => randomUUID());
  const logDir = deps.logDir || LOG_DIR;
  const createWriteStream = deps.createWriteStream || ((p) => fs.createWriteStream(p, { flags: 'a' }));
  const ensureDir = deps.ensureDir || ((d) => fs.mkdirSync(d, { recursive: true }));

  const plan = planJob({ kind, params });

  if (plan.costClass !== COST_CLASSES.FREE) {
    const active = activeNonFreeJob();
    if (active) {
      const err = new Error(
        `a ${active.costClass} job is already running (${active.label}); stop it or wait for it to finish`,
      );
      err.code = 'SERIAL_BUSY';
      throw err;
    }
  }

  ensureDir(logDir);
  const id = makeId();
  const logFile = path.join(logDir, `${id}.log`);
  const logStream = createWriteStream(logFile);
  const scriptPath = path.join(ROOT_DIR, plan.script);
  const fullArgv = [scriptPath, ...plan.argv];

  const job = {
    id,
    kind,
    label: plan.label,
    costClass: plan.costClass,
    costNote: plan.costNote,
    argv: plan.argv,
    command: plan.command,
    script: plan.script,
    status: 'running',
    pid: null,
    exitCode: null,
    signal: null,
    startedAt: now(),
    endedAt: null,
    error: null,
    logFile,
    logTail: [],
    logStream,
    child: null,
  };
  jobs.set(id, job);

  let child;
  try {
    child = spawnFn(process.execPath, fullArgv, {
      cwd: ROOT_DIR,
      env: process.env, // API keys stay server-side; never forwarded to the client
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    job.status = 'error';
    job.error = e.message;
    job.endedAt = now();
    if (logStream && logStream.end) logStream.end();
    return publicJob(job);
  }

  job.child = child;
  job.pid = child.pid || null;

  const onData = (buf) => {
    const text = buf.toString();
    if (logStream && logStream.write) logStream.write(text);
    pushLog(job, text);
  };
  if (child.stdout && child.stdout.on) child.stdout.on('data', onData);
  if (child.stderr && child.stderr.on) child.stderr.on('data', onData);

  child.on('error', (e) => {
    job.status = 'error';
    job.error = e.message;
    job.endedAt = now();
    pushLog(job, `\n[spawn error] ${e.message}\n`);
    if (logStream && logStream.end) logStream.end();
    job.child = null;
  });

  child.on('close', (code, signal) => {
    // A user-initiated stop already set status='stopped'; keep it.
    if (job.status === 'running') {
      job.status = code === 0 ? 'done' : 'failed';
    }
    job.exitCode = code;
    job.signal = signal || null;
    job.endedAt = now();
    pushLog(job, `\n[exit ${code}${signal ? ` signal ${signal}` : ''}]\n`);
    if (logStream && logStream.end) logStream.end();
    job.child = null;
  });

  return publicJob(job);
}

export function stopJob(id) {
  const job = jobs.get(id);
  if (!job) return null;
  if (job.status !== 'running') return publicJob(job);
  job.status = 'stopped';
  job.error = 'stopped by user';
  if (job.child && job.child.kill) {
    try {
      job.child.kill('SIGTERM');
    } catch {
      /* process already gone */
    }
  }
  return publicJob(job);
}

// Test-only: drop all registry state between cases.
export function _resetJobs() {
  jobs.clear();
}

export default {
  COST_CLASSES,
  JOB_KINDS,
  describeKinds,
  planJob,
  launchJob,
  listJobs,
  getJob,
  stopJob,
};
