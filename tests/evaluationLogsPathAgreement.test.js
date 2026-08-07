/**
 * Everything that reads a dialogue trace must look where the writer put it.
 *
 * This is the database incident one directory over, and it hid for longer
 * because of a coincidence. In the main checkout `logs` is a symlink to the
 * archive, so a script that resolves `<checkout>/logs` lands on the archive and
 * works. A worktree has no such symlink: `<worktree>/logs/tutor-dialogues` is an
 * empty directory beside an archive holding forty-nine thousand traces. So
 * seventeen scripts, each carrying its own copy of the rule, read every trace
 * from one place and none from the other, and said so only by reporting no data.
 *
 * Three things are pinned here.
 *
 * 1. The order itself: an explicit EVAL_LOGS_DIR, then a handed-over run folder,
 *    then the archive, then the checkout — with the archive present, which is
 *    the step every hand-written copy left out.
 * 2. That no script has taken its copy back. A source-level scan, because a
 *    behavioural test cannot see a rule that is only reached from a branch the
 *    test does not enter.
 * 3. That the Python mirror agrees with the JavaScript. The mirror exists
 *    because the Python analysis scripts cannot import the JavaScript; a copy is
 *    exactly what caused this, so the two are run over the same cases here.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, describe, it } from 'node:test';

import {
  resolveEvaluationLogsRoot,
  resolveEvaluationLogsRootCandidates,
  resolveTutorDialoguesDir,
  resolveTutorDialoguesDirCandidates,
} from '../services/evaluationDataPaths.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDirs = [];

after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function tempDir(label) {
  const created = fs.mkdtempSync(path.join(os.tmpdir(), `logs-path-agreement-${label}-`));
  tempDirs.push(created);
  return created;
}

/** A directory that looks like a checkout but has no logs symlink — a worktree. */
function fakeWorktree() {
  const root = tempDir('worktree');
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  fs.mkdirSync(path.join(root, 'services'));
  return root;
}

function fakeArchive(traceIds = []) {
  const home = tempDir('archive');
  const dialogues = path.join(home, 'logs', 'tutor-dialogues');
  fs.mkdirSync(dialogues, { recursive: true });
  for (const id of traceIds) fs.writeFileSync(path.join(dialogues, `${id}.json`), '{}');
  return home;
}

/** Readers take their environment from process.env, so stage it there. */
function withEnv(overrides, fn) {
  const previous = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];
    if (overrides[key] == null) delete process.env[key];
    else process.env[key] = overrides[key];
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe('evaluation logs root — the order', () => {
  it('finds a trace in the archive from a worktree that has none of its own', () => {
    const root = fakeWorktree();
    const home = fakeArchive(['dlg-42']);
    fs.mkdirSync(path.join(root, 'logs', 'tutor-dialogues'), { recursive: true });

    withEnv({ MS_DATA_HOME: home, EVAL_LOGS_DIR: null }, () => {
      const dir = resolveTutorDialoguesDir(root);
      assert.equal(dir, path.join(home, 'logs', 'tutor-dialogues'));
      assert.equal(fs.existsSync(path.join(dir, 'dlg-42.json')), true);
    });
  });

  it('takes an explicit EVAL_LOGS_DIR over the archive, and resolves it against the root', () => {
    const root = fakeWorktree();
    const home = fakeArchive(['dlg-42']);
    fs.mkdirSync(path.join(root, 'pinned', 'tutor-dialogues'), { recursive: true });

    withEnv({ MS_DATA_HOME: home, EVAL_LOGS_DIR: 'pinned' }, () => {
      assert.equal(resolveEvaluationLogsRoot(root), path.join(root, 'pinned'));
      assert.equal(resolveTutorDialoguesDir(root), path.join(root, 'pinned', 'tutor-dialogues'));
    });
  });

  it('lets EVAL_LOGS_DIR name the trace directory itself', () => {
    const root = fakeWorktree();
    const home = fakeArchive();
    withEnv({ MS_DATA_HOME: home, EVAL_LOGS_DIR: '/elsewhere/tutor-dialogues' }, () => {
      assert.equal(resolveTutorDialoguesDir(root), '/elsewhere/tutor-dialogues');
    });
  });

  it('prefers a handed-over run folder to the archive it was never part of', () => {
    const handover = tempDir('handover');
    fs.mkdirSync(path.join(handover, 'logs', 'tutor-dialogues'), { recursive: true });
    const home = fakeArchive(['dlg-42']);

    withEnv({ MS_DATA_HOME: home, EVAL_LOGS_DIR: null }, () => {
      assert.equal(resolveEvaluationLogsRoot(handover), path.join(handover, 'logs'));
    });
  });

  it('offers the archive and the checkout both, best first, to readers that search', () => {
    const root = fakeWorktree();
    const home = fakeArchive();
    withEnv({ MS_DATA_HOME: home, EVAL_LOGS_DIR: null }, () => {
      assert.deepEqual(resolveTutorDialoguesDirCandidates(root), [
        path.join(home, 'logs', 'tutor-dialogues'),
        path.join(root, 'logs', 'tutor-dialogues'),
      ]);
    });
  });

  it('falls back to the checkout when there is no archive at all', () => {
    const root = fakeWorktree();
    withEnv({ MS_DATA_HOME: path.join(tempDir('absent'), 'nothing-here'), EVAL_LOGS_DIR: null }, () => {
      assert.deepEqual(resolveEvaluationLogsRootCandidates(root), [path.join(root, 'logs')]);
    });
  });

  it('resolves to the first candidate', () => {
    const root = fakeWorktree();
    const home = fakeArchive();
    withEnv({ MS_DATA_HOME: home, EVAL_LOGS_DIR: null }, () => {
      assert.equal(resolveEvaluationLogsRoot(root), resolveEvaluationLogsRootCandidates(root)[0]);
    });
  });
});

describe('evaluation logs root — no script keeps its own copy', () => {
  const OWN_COPY = /EVAL_LOGS_DIR\s*\|\|/;
  const OWN_COPY_PY = /environ\.get\(\s*["']EVAL_LOGS_DIR["']\s*,/;
  // These set the variable for a child process or a sandbox; they do not resolve it.
  const SETTERS = new Set([
    'run-adaptive-cell-smoke.js',
    'run-adaptive-cell-real-smoke.js',
    'run-canonical-posthoc-pipeline.js',
    'run-hermetic-tests.js',
    'run-tutor-stub-surface-acceptance.mjs',
    'report-longitudinal-drift-stage-a3.js',
    'with-canonical-eval-data.js',
  ]);

  it('no script under scripts/ or services/ resolves the logs root itself', () => {
    const offenders = [];
    for (const dir of ['scripts', 'services']) {
      const stack = [path.join(REPO_ROOT, dir)];
      while (stack.length) {
        const current = stack.pop();
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
          const full = path.join(current, entry.name);
          if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== '__pycache__') stack.push(full);
            continue;
          }
          if (!/\.(js|mjs|py)$/.test(entry.name)) continue;
          if (SETTERS.has(entry.name)) continue;
          const src = fs.readFileSync(full, 'utf8');
          if (OWN_COPY.test(src) || OWN_COPY_PY.test(src)) offenders.push(path.relative(REPO_ROOT, full));
        }
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `these files resolve the logs root themselves instead of calling services/evaluationDataPaths.js:\n  ${offenders.join('\n  ')}`,
    );
  });
});

describe('evaluation data paths — the Python mirror agrees', () => {
  const MIRROR = path.join(REPO_ROOT, 'scripts', 'lib', 'eval_data_paths.py');

  function python(root, env) {
    const script = `
import json, sys
sys.path.insert(0, ${JSON.stringify(path.dirname(MIRROR))})
from eval_data_paths import resolve_logs_root_candidates, resolve_tutor_dialogues_dir_candidates, resolve_db_path
root = ${JSON.stringify(root)}
print(json.dumps({
  "logs": resolve_logs_root_candidates(root),
  "dialogues": resolve_tutor_dialogues_dir_candidates(root),
  "db": resolve_db_path(root),
}))
`;
    const out = execFileSync('python3', ['-c', script], {
      env: { ...process.env, ...env },
      encoding: 'utf8',
    });
    return JSON.parse(out);
  }

  const cases = [
    ['worktree with an archive', () => ({ root: fakeWorktree(), home: fakeArchive(['dlg-42']), explicit: null })],
    [
      'worktree with no archive',
      () => ({ root: fakeWorktree(), home: path.join(tempDir('gone'), 'nope'), explicit: null }),
    ],
    ['explicit relative override', () => ({ root: fakeWorktree(), home: fakeArchive(), explicit: 'pinned' })],
    [
      'explicit trace-dir override',
      () => ({ root: fakeWorktree(), home: fakeArchive(), explicit: '/x/tutor-dialogues' }),
    ],
  ];

  for (const [label, build] of cases) {
    it(`agrees with JavaScript — ${label}`, () => {
      const { root, home, explicit } = build();
      const env = { MS_DATA_HOME: home };
      if (explicit) env.EVAL_LOGS_DIR = explicit;
      else delete env.EVAL_LOGS_DIR;

      const fromPython = python(root, { ...env, EVAL_LOGS_DIR: explicit ?? '', EVAL_DB_PATH: '' });

      withEnv({ MS_DATA_HOME: home, EVAL_LOGS_DIR: explicit, EVAL_DB_PATH: null }, () => {
        assert.deepEqual(fromPython.logs, resolveEvaluationLogsRootCandidates(root));
        assert.deepEqual(fromPython.dialogues, resolveTutorDialoguesDirCandidates(root));
      });
    });
  }
});
