#!/usr/bin/env node
/**
 * Matrix runner — one base condition, N single-delta arms, one comparison
 * table (notes/poetics/2026-06-10-unreliable-learner-design.md, Build B).
 * Each arm is a child-process invocation of scripts/run-derivation-loop.js
 * (full process isolation: a crashed arm or a leaked env var cannot touch
 * its siblings); the runner's only contract with an arm is the loop's CLI
 * surface going in and its diagnosis.json coming out.
 *
 * Spec file (YAML or JSON):
 *
 *   base:
 *     world: config/drama-derivation/world-000-smoke.yaml
 *     script: config/drama-derivation/tutor-scripts/nocturne-v002.md
 *     mode: mock                    # mock|real — real arms SERIALIZE by default
 *     flags:                        # any run-derivation-loop flag
 *       dramaturgy: free
 *       superego: true              # true → bare flag; false/null → omitted
 *   arms:
 *     - label: control              # base, unchanged
 *     - label: decay-mild
 *       flags: { decay: '{"seed":7,"rate":0.15}' }
 *     - label: decay-heavy
 *       flags: { decay: '{"seed":7,"rate":0.4}' }
 *   concurrency: 4                  # optional; CLI --concurrency overrides
 *
 * Discipline defaults: the critic is OFF for matrix arms unless the spec
 * asks for it (screening tables should not spend ten minutes per arm on
 * notices — backfill keepers via npm run derivation:critic), and real-mode
 * concurrency defaults to 1 (paid arms sharing a plan-quota window run
 * attended and serialized; the runner warns if you force otherwise).
 *
 * Usage:
 *   node scripts/run-derivation-matrix.js --spec <file>
 *     [--label <matrix-label>]   (default: spec basename + timestamp)
 *     [--out exports/dramatic-derivation/matrix]
 *     [--concurrency N]
 *     [--dry-run]                (print the composed commands, run nothing)
 *
 * Artifacts: <out>/<matrix-label>/<arm-label>/ (normal loop run dirs, all
 * sharing --group <matrix-label> so the scriptorium groups them),
 * logs/<arm>.log per arm, and matrix-summary.json + the printed table.
 */

import 'dotenv/config';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const LOOP_SCRIPT = path.join(ROOT, 'scripts', 'run-derivation-loop.js');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/T/, '-').replace(/\..+$/, '');
}

// Flags the runner owns; a spec that sets them is confused about who is in charge.
const RESERVED_FLAGS = new Set(['label', 'out', 'group', 'world', 'script', 'real']);

function composeArgs({ base, armSpec, matrixLabel, matrixDir }) {
  const world = armSpec.world ?? base.world;
  const script = armSpec.script ?? base.script;
  const mode = armSpec.mode ?? base.mode ?? 'mock';
  if (!world || !script) throw new Error(`arm "${armSpec.label}": world and script are required (base or arm)`);
  if (!['mock', 'real'].includes(mode)) throw new Error(`arm "${armSpec.label}": mode must be mock|real (got ${mode})`);
  const flags = { critic: 'off', ...(base.flags || {}), ...(armSpec.flags || {}) };
  const args = [
    LOOP_SCRIPT,
    '--world',
    world,
    '--script',
    script,
    '--label',
    armSpec.label,
    '--out',
    matrixDir,
    '--group',
    matrixLabel,
  ];
  if (mode === 'real') args.push('--real');
  for (const [key, value] of Object.entries(flags)) {
    if (RESERVED_FLAGS.has(key)) throw new Error(`arm "${armSpec.label}": flag "${key}" is owned by the matrix runner`);
    if (value === false || value === null || value === undefined) continue;
    if (value === true) args.push(`--${key}`);
    else args.push(`--${key}`, String(value));
  }
  return { args, mode };
}

function runArm({ args, logFile }) {
  return new Promise((resolve) => {
    const log = fs.createWriteStream(logFile);
    const child = spawn(process.execPath, args, { cwd: ROOT, env: process.env });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    child.on('close', (code) => {
      log.end();
      resolve(code ?? 1);
    });
  });
}

async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(lanes);
  return results;
}

const fmt = (v) => (v === null || v === undefined ? '—' : String(v));

function tableRow(label, diagnosis, exitCode, logRel) {
  if (!diagnosis) return { arm: label, verdict: `FAILED exit ${exitCode} (${logRel})` };
  const tf = diagnosis.tutorFigures;
  const ra = diagnosis.releaseAdherence;
  const c = diagnosis.corruption;
  return {
    arm: label,
    verdict: diagnosis.verdict,
    turns: `${diagnosis.turnsPlayed}/${diagnosis.turnCap}`,
    'forced@': fmt(diagnosis.firstForcedTurn),
    'grounded@': fmt(diagnosis.assertedGroundedTurn),
    releases: ra ? `${ra.onCue}/${ra.rows.length}` : '—',
    slope: fmt(diagnosis.learningSlope?.overall?.ratePerTurn?.toFixed?.(2)),
    figure: tf?.total ? `${tf.topFigure} ${Math.round((tf.topShare || 0) * 100)}%` : '—',
    switch: fmt(tf?.switchRate?.toFixed?.(2)),
    'sup fires': fmt(tf?.superego?.interventions),
    'decay d/r/u': c ? `${c.decayEvents}/${c.repairs.total}/${c.unrepairedAtEnd}` : '—',
    calls: fmt(diagnosis.usage?.calls),
    cost: diagnosis.usage ? `$${(diagnosis.usage.costUSD ?? 0).toFixed(2)}` : '—',
  };
}

function printTable(rows) {
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const width = Object.fromEntries(
    columns.map((c) => [c, Math.max(c.length, ...rows.map((r) => String(r[c] ?? '—').length))]),
  );
  const line = (cells) => `  ${columns.map((c) => String(cells[c] ?? '—').padEnd(width[c])).join('  ')}`;
  console.log(line(Object.fromEntries(columns.map((c) => [c, c]))));
  console.log(`  ${columns.map((c) => '-'.repeat(width[c])).join('  ')}`);
  for (const row of rows) console.log(line(row));
}

async function main() {
  const specPath = arg('spec', null);
  if (!specPath) {
    console.error('required: --spec <file.yaml|file.json>');
    process.exit(1);
  }
  const spec = yaml.parse(fs.readFileSync(path.resolve(ROOT, specPath), 'utf8'));
  const base = spec.base || {};
  const arms = spec.arms || [];
  if (!arms.length) {
    console.error('spec has no arms');
    process.exit(1);
  }
  const labels = arms.map((a) => a.label);
  if (labels.some((l) => !l) || new Set(labels).size !== labels.length) {
    console.error('every arm needs a unique label');
    process.exit(1);
  }

  const matrixLabel = arg('label', `${path.basename(specPath).replace(/\.(ya?ml|json)$/, '')}-${timestamp()}`);
  const matrixDir = path.join(path.resolve(ROOT, arg('out', 'exports/dramatic-derivation/matrix')), matrixLabel);
  const composed = arms.map((armSpec) => ({ armSpec, ...composeArgs({ base, armSpec, matrixLabel, matrixDir }) }));

  const anyReal = composed.some((c) => c.mode === 'real');
  const concurrency = Number(arg('concurrency', spec.concurrency ?? (anyReal ? 1 : Math.min(4, arms.length))));
  if (anyReal && concurrency > 1) {
    console.warn(
      `WARNING: ${concurrency}-wide parallelism over real arms — paid arms sharing a plan-quota window should run serialized (--concurrency 1) unless they are cheap metered screening`,
    );
  }

  console.log(
    `matrix  ${matrixLabel}: ${arms.length} arms, concurrency ${concurrency}${anyReal ? ' (real arms present)' : ' (all mock)'}`,
  );
  if (flag('dry-run')) {
    for (const { armSpec, args } of composed) {
      console.log(
        `\n${armSpec.label}:\n  node ${args.map((a) => (a.includes(' ') ? JSON.stringify(a) : a)).join(' ')}`,
      );
    }
    return;
  }

  fs.mkdirSync(path.join(matrixDir, 'logs'), { recursive: true });
  const started = Date.now();
  const exitCodes = await pool(composed, concurrency, async ({ armSpec, args }) => {
    const logFile = path.join(matrixDir, 'logs', `${armSpec.label}.log`);
    console.log(`  ▶ ${armSpec.label} started`);
    const t0 = Date.now();
    const code = await runArm({ args, logFile });
    console.log(
      `  ${code === 0 ? '✔' : '✘'} ${armSpec.label} ${code === 0 ? 'done' : `FAILED (exit ${code})`} in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
    );
    return code;
  });

  const rows = [];
  const summary = {
    label: matrixLabel,
    spec: path.relative(ROOT, path.resolve(ROOT, specPath)),
    startedAt: new Date(started).toISOString(),
    elapsedMs: Date.now() - started,
    arms: [],
  };
  composed.forEach(({ armSpec }, i) => {
    const armDir = path.join(matrixDir, armSpec.label);
    let diagnosis = null;
    try {
      diagnosis = JSON.parse(fs.readFileSync(path.join(armDir, 'diagnosis.json'), 'utf8'));
    } catch {
      diagnosis = null;
    }
    const logRel = path.join('logs', `${armSpec.label}.log`);
    rows.push(tableRow(armSpec.label, diagnosis, exitCodes[i], logRel));
    summary.arms.push({
      label: armSpec.label,
      exitCode: exitCodes[i],
      ok: exitCodes[i] === 0 && Boolean(diagnosis),
      dir: path.relative(ROOT, armDir),
      diagnosis: diagnosis
        ? {
            verdict: diagnosis.verdict,
            turnsPlayed: diagnosis.turnsPlayed,
            firstForcedTurn: diagnosis.firstForcedTurn,
            assertedGroundedTurn: diagnosis.assertedGroundedTurn,
            releaseAdherence: diagnosis.releaseAdherence && {
              onCue: diagnosis.releaseAdherence.onCue,
              total: diagnosis.releaseAdherence.rows.length,
            },
            learningSlope: diagnosis.learningSlope?.overall ?? null,
            tutorFigures: diagnosis.tutorFigures && {
              topFigure: diagnosis.tutorFigures.topFigure,
              topShare: diagnosis.tutorFigures.topShare,
              distinct: diagnosis.tutorFigures.distinct,
              switchRate: diagnosis.tutorFigures.switchRate,
              superego: diagnosis.tutorFigures.superego && {
                interventions: diagnosis.tutorFigures.superego.interventions,
                watched: diagnosis.tutorFigures.superego.watched,
              },
            },
            // absent means absent — decay-off arms carry no corruption key,
            // same discipline as the engine result and diagnosis.json
            ...(diagnosis.corruption ? { corruption: diagnosis.corruption } : {}),
            usage: diagnosis.usage && { calls: diagnosis.usage.calls, costUSD: diagnosis.usage.costUSD },
          }
        : null,
    });
  });

  console.log('');
  printTable(rows);
  fs.writeFileSync(path.join(matrixDir, 'matrix-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`\nartifacts ${path.relative(ROOT, matrixDir)}/{<arm>/, logs/, matrix-summary.json}`);

  if (exitCodes.some((code) => code !== 0)) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
