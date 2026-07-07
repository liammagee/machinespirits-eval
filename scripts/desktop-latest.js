#!/usr/bin/env node
/**
 * desktop-latest.js — run up the latest Scriptorium desktop app off `main`.
 *
 * The desktop app lives in a sibling git worktree (branch `desktop-dev`) whose
 * node_modules carries the Electron-ABI native modules, kept separate from the
 * main checkout's Node-ABI build so `npm test` / `eval-cli` and the app don't
 * clobber each other. `desktop-dev` mirrors `main`; it is not a divergent branch.
 *
 * This script, run from anywhere in the repo:
 *   1. locates the worktree checked out on `desktop-dev`,
 *   2. fast-forwards it to local `main` (fails loudly if it has diverged), and
 *   3. launches `desktop:dev` there.
 *
 * If a desktop dev instance is already running it holds Electron's single-instance
 * lock, so a plain launch would only refocus that (stale) window without booting
 * the freshly-synced code. By default the script detects this and tells you to quit
 * it first; `--restart` quits it for you and relaunches, so one command always lands
 * you on the synced code.
 *
 * Flags:
 *   --no-launch   sync the worktree only; don't start the app
 *                 (or set MS_DESKTOP_LATEST_NO_LAUNCH=1)
 *   --restart     if an instance is already running, stop it before launching
 */
import { execFileSync, spawn } from 'node:child_process';

const DESKTOP_BRANCH = 'desktop-dev';
const SOURCE_BRANCH = 'main';
// The dev launch only — matches `electron desktop/main.js`, NOT the packaged
// Scriptorium.app (which runs from its own bundle path).
const DEV_PROC_PATTERN = 'electron desktop/main.js';
const noLaunch = process.argv.includes('--no-launch') || process.env.MS_DESKTOP_LATEST_NO_LAUNCH === '1';
const restart = process.argv.includes('--restart');

const log = (m) => console.log(`[desktop:latest] ${m}`);
const die = (m) => {
  console.error(`[desktop:latest] ${m}`);
  process.exit(1);
};

const git = (args, opts = {}) => execFileSync('git', args, { encoding: 'utf8', ...opts }).trim();

// PIDs of any running desktop dev instance (empty if none).
const runningDevPids = () => {
  try {
    return execFileSync('pgrep', ['-f', DEV_PROC_PATTERN], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  } catch {
    return []; // pgrep exits non-zero when nothing matches
  }
};

// Synchronous, subprocess-free sleep (Node allows Atomics.wait on the main thread).
const sleepMs = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// 1. Find the worktree checked out on DESKTOP_BRANCH (parse `worktree`/`branch` blocks).
let target = null;
let cur = {};
for (const line of git(['worktree', 'list', '--porcelain']).split('\n')) {
  if (line.startsWith('worktree ')) cur = { path: line.slice('worktree '.length) };
  else if (line.startsWith('branch ')) {
    if (line.slice('branch '.length).replace('refs/heads/', '') === DESKTOP_BRANCH) {
      target = cur.path;
      break;
    }
  } else if (line === '') cur = {};
}
if (!target) {
  die(`no worktree is on '${DESKTOP_BRANCH}'.\n` + `  Create one:  git worktree add ../ms-electron ${DESKTOP_BRANCH}`);
}
log(`worktree: ${target}`);

// 2. Fast-forward the desktop branch to local main (no merge commits).
try {
  const out = git(['merge', '--ff-only', SOURCE_BRANCH], { cwd: target });
  log(out.split('\n')[0] || `already up to date with ${SOURCE_BRANCH}`);
} catch (e) {
  die(
    `could not fast-forward ${DESKTOP_BRANCH} to ${SOURCE_BRANCH}:\n` +
      `${(e.stderr || e.message || '').trim()}\n` +
      `  Resolve by hand in ${target} (it may have diverged from ${SOURCE_BRANCH}).`,
  );
}

// 3. Launch the app from the worktree (its node_modules has the Electron-ABI natives).
if (noLaunch) {
  log('--no-launch: synced only, not starting the app.');
  process.exit(0);
}

// A running dev instance holds Electron's single-instance lock, so a plain launch
// would only refocus that (stale) window — never silently leave the user there.
const running = runningDevPids();
if (running.length && !restart) {
  log('');
  log(`a desktop dev instance is already running (PID ${running.join(', ')}).`);
  log('It holds the single-instance lock, so it keeps serving the code it booted');
  log(`from and will NOT pick up the just-synced ${SOURCE_BRANCH}.`);
  log('Quit it (⌘Q) and re-run, or:  npm run desktop:latest -- --restart');
  process.exit(0); // synced, but deliberately not relaunched
}
if (running.length && restart) {
  log(`--restart: stopping running instance (PID ${running.join(', ')}) …`);
  try {
    execFileSync('pkill', ['-f', DEV_PROC_PATTERN]);
  } catch {
    /* pkill exits non-zero if the match vanished first — fine */
  }
  let gone = false;
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    if (runningDevPids().length === 0) {
      gone = true;
      break;
    }
    sleepMs(250);
  }
  if (!gone) die('the running instance did not exit in time; quit it by hand (⌘Q) and re-run.');
  log('stopped; the lock is released.');
}

log('launching desktop:dev …');
const child = spawn('npm', ['run', 'desktop:dev'], { cwd: target, stdio: 'inherit' });
child.on('error', (err) => die(`failed to launch: ${err.message}`));
child.on('exit', (code) => process.exit(code ?? 0));
