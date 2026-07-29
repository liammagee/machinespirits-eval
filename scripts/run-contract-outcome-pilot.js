#!/usr/bin/env node
/**
 * Pilot runner for the contract outcome pre-registration
 * (workplan/items/tutor-contract-outcome-prereg.md).
 *
 * Runs free dialogues one at a time: an LLM learner answering an LLM tutor on
 * a chosen world, headless, with the closure machinery on and the speaker
 * advisory blocks gated by env. `--blocks none` is the bare tutor measured
 * without being instrumented: the DAG flags stay on so legitimate closure is
 * computed, while the gate keeps every advisory block out of the prompt, and
 * each turn's trace row proves which blocks the prompt carried.
 *
 * Each world runs to its own authored turn cap; --turn-cap overrides that for
 * every world and is refused where it falls below a world's t_min.
 *
 * Every dialogue's outcome appends to results.jsonl as it lands, and a rerun
 * with the same --out skips dialogues already recorded, so a run interrupted
 * by a quota window resumes rather than restarts. Paid: run attended.
 *
 *   node scripts/run-contract-outcome-pilot.js --dry-run
 *   node scripts/run-contract-outcome-pilot.js --worlds world_001_nocturne --n 1
 *   node scripts/run-contract-outcome-pilot.js --out exports/tutor-stub-outcome/pilot-1
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { loadWorld } from '../services/dramaticDerivation/world.js';
import { parseTutorStubShowcaseTrace, readTutorStubShowcaseTrace } from '../services/tutorStubShowcase.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/**
 * Backstop for a hung child, not a schedule. The first pilot averaged ~40
 * seconds a turn, so three times that per turn leaves room for a slow window
 * without letting a wedged process hold the run all night.
 */
const TIMEOUT_MS_PER_TURN = 2 * 60 * 1000;
const MIN_DIALOGUE_TIMEOUT_MS = 20 * 60 * 1000;

// The three A/B worlds plus the one held-out world the contract has never
// been tuned against (world_030 is the newest and least referenced).
const DEFAULT_WORLDS = [
  'world_001_nocturne',
  'world_023_greyfen_lab',
  'world_025_tallow_street',
  'world_030_rowan_flat',
];

/** Model calls each turn is allowed, before the per-dialogue budget is set. */
const CALLS_PER_TURN = 5;

/**
 * Each world's own turn cap, and the turn before which its author guarantees
 * the answer is not derivable.
 *
 * A world is written to a length. Nocturne withholds derivability until turn 28
 * and runs to 40; Rowan Flat is derivable by turn 6 and runs to 12. The first
 * pilot ran every world at a flat 12 turns and read Nocturne's 0/5 as a floor,
 * when in fact no tutor could have closed it — the run stopped sixteen turns
 * before the world permits an answer. So the cap comes from the world unless a
 * caller overrides it, and the run refuses a cap below t_min rather than
 * producing another unmeasurable zero.
 */
function worldTurnBounds(worldIds) {
  const bounds = new Map();
  for (const id of worldIds) {
    const file = path.join(ROOT, 'config', 'drama-derivation', `${id.replace(/_/gu, '-')}.yaml`);
    const world = loadWorld(file);
    bounds.set(id, { turnCap: world.turnCap ?? null, tMin: world.slope?.t_min ?? null });
  }
  return bounds;
}

/**
 * The turn cap and model-call budget this world will run at.
 *
 * An explicit --turn-cap applies to every world and is refused where it lands
 * below that world's t_min, since a dialogue stopped before the answer is
 * derivable measures the cap, not the tutor.
 */
function resolveBounds({ args, world, bounds }) {
  const { turnCap: authored, tMin } = bounds.get(world) || {};
  const turnCap = args.turnCap ?? authored;
  if (!turnCap) throw new Error(`${world}: no turn_cap in the world file and no --turn-cap given`);
  if (tMin && turnCap < tMin) {
    throw new Error(`${world}: cap ${turnCap} is below the world's t_min ${tMin} — the secret is not derivable by then`);
  }
  return { turnCap, budget: args.budget ?? turnCap * CALLS_PER_TURN };
}

function parseArgs(argv) {
  const args = {
    worlds: DEFAULT_WORLDS,
    n: 5,
    turnCap: null,
    budget: null,
    blocks: 'none',
    armId: 'bare',
    speaker: 'codex.gpt-5.6-terra',
    effort: 'medium',
    learnerModel: 'codex.gpt-5.6-terra',
    learnerProfile: 'diligent',
    out: null,
    dryRun: false,
    limit: Infinity,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--worlds')
      args.worlds = argv[++i]
        .split(',')
        .map((w) => w.trim())
        .filter(Boolean);
    else if (a === '--n') args.n = Number(argv[++i]);
    else if (a === '--turn-cap') args.turnCap = Number(argv[++i]);
    else if (a === '--budget') args.budget = Number(argv[++i]);
    else if (a === '--blocks') args.blocks = argv[++i];
    else if (a === '--arm') args.armId = argv[++i];
    else if (a === '--speaker') args.speaker = argv[++i];
    else if (a === '--effort') args.effort = argv[++i];
    else if (a === '--learner-model') args.learnerModel = argv[++i];
    else if (a === '--learner-profile') args.learnerProfile = argv[++i];
    else if (a === '--out') args.out = path.resolve(ROOT, argv[++i]);
    else if (a === '--limit') args.limit = Number(argv[++i]);
    else if (a === '--dry-run') args.dryRun = true;
    else throw new Error(`unknown flag ${a}`);
  }
  return args;
}

function childCommand({ args, world, traceDir, turnCap, budget }) {
  return [
    'scripts/tutor-stub.js',
    '--lab',
    'automated_eval',
    '--auto-learner',
    '--auto-turns',
    String(turnCap),
    '--auto-safety-turns',
    String(turnCap + 4),
    '--world',
    world,
    '--model',
    args.speaker,
    '--cli-effort',
    args.effort,
    '--auto-learner-model',
    args.learnerModel,
    '--auto-learner-profile',
    args.learnerProfile,
    '--dag',
    '--tutor-learner-dag',
    '--model-call-budget',
    String(budget),
    '--no-stream',
    '--no-interim-animation',
    '--no-remember-settings',
    '--trace-dir',
    traceDir,
  ];
}

function runDialogue({ args, world, traceDir, turnCap, budget }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, childCommand({ args, world, traceDir, turnCap, budget }), {
      cwd: ROOT,
      env: { ...process.env, NO_COLOR: '1', TUTOR_STUB_SPEAKER_ADVISORY_BLOCKS: args.blocks },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderrTail = '';
    child.stderr.on('data', (chunk) => {
      stderrTail = (stderrTail + chunk).slice(-2000);
    });
    const timer = setTimeout(
      () => child.kill('SIGKILL'),
      Math.max(MIN_DIALOGUE_TIMEOUT_MS, turnCap * TIMEOUT_MS_PER_TURN),
    );
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code, stderrTail });
    });
  });
}

/**
 * One row per dialogue, complete enough that the audit sheet and the
 * dialogue judge never have to re-open the trace: the whole public
 * transcript, the closure verdict, the closeout assessment, and the per-turn
 * proof of which advisory blocks the prompt carried.
 */
function extractResult({ traceDir }) {
  const { tracePath, rows } = readTutorStubShowcaseTrace(traceDir);
  const dialogue = parseTutorStubShowcaseTrace(rows);
  const closeout = rows.find((row) => row.type === 'closeout_report') || null;
  const closeoutBody = closeout?.report || closeout?.payload || closeout || {};
  const stamps = rows.filter((row) => row.type === 'tutor_speaker_advisory_blocks');
  return {
    tracePath: path.relative(ROOT, tracePath),
    turns: (dialogue.turns || []).map((turn) => ({
      index: turn.index ?? null,
      learner: turn.learner?.text || '',
      tutor: turn.tutor?.text || '',
    })),
    openingText: dialogue.openingText || '',
    turnCount: dialogue.turnCount ?? (dialogue.turns || []).length,
    stopReason: dialogue.stopReason || null,
    modelCalls: dialogue.modelCalls ?? null,
    closure: dialogue.closure || { available: false },
    assessment: closeoutBody.finalAssessment || null,
    finalStatus: closeoutBody.finalStatus || null,
    promptBlocks: stamps.length
      ? { enabled: stamps[0].enabled, omitted: stamps[0].omitted, turnsStamped: stamps.length }
      : null,
  };
}

function loadDone(resultsPath) {
  const done = new Set();
  if (!fs.existsSync(resultsPath)) return done;
  for (const line of fs.readFileSync(resultsPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row.status === 'ok') done.add(`${row.world}#${row.k}`);
    } catch {
      /* a half-written last line is redone */
    }
  }
  return done;
}

function bandVerdict(rate) {
  if (rate === null) return 'unmeasured';
  if (rate < 0.2) return 'BELOW BAND (closure too rare — re-pick cap or drop world)';
  if (rate > 0.8) return 'ABOVE BAND (saturated — re-pick cap or drop world)';
  return 'in band';
}

function writeReport({ outDir, args, rows }) {
  const worlds = [...new Set(rows.map((row) => row.world))];
  const perWorld = worlds.map((world) => {
    const ok = rows.filter((row) => row.world === world && row.status === 'ok');
    const measurable = ok.filter((row) => row.closure?.grounded === true || row.closure?.grounded === false);
    const closed = measurable.filter((row) => row.closure.grounded === true);
    const rate = measurable.length ? closed.length / measurable.length : null;
    return {
      world,
      turnCap: ok[0]?.turnCap ?? null,
      dialogues: ok.length,
      measurable: measurable.length,
      closed: closed.length,
      closureRate: rate,
      band: bandVerdict(rate),
      meanTurns: ok.length
        ? Math.round((ok.reduce((s, row) => s + (row.turnCount || 0), 0) / ok.length) * 10) / 10
        : null,
    };
  });
  const report = {
    schema: 'machinespirits.tutor-stub.outcome-pilot-report.v1',
    prereg: 'workplan/items/tutor-contract-outcome-prereg.md',
    settings: {
      armId: args.armId,
      blocks: args.blocks,
      speaker: args.speaker,
      effort: args.effort,
      learnerModel: args.learnerModel,
      learnerProfile: args.learnerProfile,
      turnCapOverride: args.turnCap,
      budgetOverride: args.budget,
    },
    perWorld,
    errors: rows.filter((row) => row.status !== 'ok').length,
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  const md = [
    '# Contract outcome pilot — bare tutor, closure band check',
    '',
    `Pre-registration: \`${report.prereg}\`. Gate: bare closure must land in the 20–80% band per world before the main run.`,
    '',
    `Speaker \`${args.speaker}\` (${args.effort}) · learner \`${args.learnerModel}\` (${args.learnerProfile}) · advisory blocks: ${args.blocks}`,
    '',
    'Each world runs to its own authored turn cap. A world stopped short of its `t_min` cannot close, so a shared cap would measure the runner rather than the tutor.',
    '',
    '| World | Cap | Dialogues | Measurable | Closed | Rate | Band | Mean turns |',
    '|---|---|---|---|---|---|---|---|',
    ...perWorld.map(
      (row) =>
        `| ${row.world} | ${row.turnCap ?? '—'} | ${row.dialogues} | ${row.measurable} | ${row.closed} | ${row.closureRate === null ? '—' : `${Math.round(row.closureRate * 100)}%`} | ${row.band} | ${row.meanTurns ?? '—'} |`,
    ),
    '',
    report.errors ? `${report.errors} dialogue(s) errored — see results.jsonl.` : 'No dialogue errors.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'report.md'), md);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
  const outDir = args.out || path.join(ROOT, 'exports', 'tutor-stub-outcome', `pilot-${stamp}`);
  const resultsPath = path.join(outDir, 'results.jsonl');

  const bounds = worldTurnBounds(args.worlds);
  const resolved = new Map(args.worlds.map((world) => [world, resolveBounds({ args, world, bounds })]));
  const jobs = [];
  for (const world of args.worlds) {
    for (let k = 0; k < args.n; k += 1) jobs.push({ world, k, ...resolved.get(world) });
  }
  const done = loadDone(resultsPath);
  const todo = jobs.filter((job) => !done.has(`${job.world}#${job.k}`)).slice(0, args.limit);

  process.stderr.write(
    `${jobs.length} dialogues planned (${args.worlds.length} worlds × ${args.n}); ${done.size} already recorded; running ${todo.length}\n` +
      `arm ${args.armId} · blocks ${args.blocks} · cap ${args.turnCap ? `${args.turnCap} (override)` : 'per world'}\n` +
      `${args.worlds
        .map(
          (world) =>
            `  ${world} cap ${resolved.get(world).turnCap} budget ${resolved.get(world).budget} (t_min ${bounds.get(world).tMin ?? '—'})`,
        )
        .join('\n')}\n`,
  );
  if (args.dryRun) {
    for (const job of todo) {
      const traceDir = path.join(outDir, 'traces', job.world, `d${job.k}`);
      process.stdout.write(
        `node ${childCommand({ args, world: job.world, traceDir, turnCap: job.turnCap, budget: job.budget }).join(' ')}\n`,
      );
    }
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  for (const [i, job] of todo.entries()) {
    const traceDir = path.join(outDir, 'traces', job.world, `d${job.k}`);
    fs.mkdirSync(traceDir, { recursive: true });
    const startedAt = Date.now();
    const { exitCode, stderrTail } = await runDialogue({
      args,
      world: job.world,
      traceDir,
      turnCap: job.turnCap,
      budget: job.budget,
    });
    let row;
    try {
      const extracted = extractResult({ traceDir });
      row = {
        world: job.world,
        k: job.k,
        armId: args.armId,
        blocks: args.blocks,
        turnCap: job.turnCap,
        budget: job.budget,
        status: 'ok',
        exitCode,
        wallClockMs: Date.now() - startedAt,
        ...extracted,
      };
    } catch (error) {
      row = {
        world: job.world,
        k: job.k,
        armId: args.armId,
        blocks: args.blocks,
        status: 'error',
        exitCode,
        wallClockMs: Date.now() - startedAt,
        error: String(error?.message || error),
        stderrTail: stderrTail.slice(-600),
      };
    }
    fs.appendFileSync(resultsPath, `${JSON.stringify(row)}\n`);
    const closure = row.closure?.grounded === true ? 'closed' : row.closure?.grounded === false ? 'open' : '?';
    process.stderr.write(
      `  ${String(i + 1).padStart(3)}/${todo.length} ${job.world}#${job.k} ${row.status} ${closure} turns=${row.turnCount ?? '—'} calls=${row.modelCalls ?? '—'}\n`,
    );
  }

  const rows = fs
    .readFileSync(resultsPath, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
  writeReport({ outDir, args, rows });
  process.stdout.write(`report written to ${path.relative(ROOT, outDir)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exit(1);
});
