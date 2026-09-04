import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { archiveRun, ledgerPath, resolveArchiveDir, runDirs } from '../scripts/archive-run-artifacts.js';

const ARCHIVE_SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'scripts',
  'archive-run-artifacts.js',
);

/** A run laid out the way the pilot runner writes one: reports and results at
 *  the top, per-call traces in their own directory. */
function makeRun(root, name) {
  const dir = path.join(root, 'exports', 'tutor-stub-outcome', name);
  fs.mkdirSync(path.join(dir, 'traces', 'world_030_rowan_flat'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'results.jsonl'), '{"world":"world_030_rowan_flat","turnCount":9}\n');
  fs.writeFileSync(path.join(dir, 'report.md'), '# report\n');
  fs.writeFileSync(path.join(dir, 'traces', 'world_030_rowan_flat', 'd1.jsonl'), '{"event":"turn_complete"}\n');
  return dir;
}

function withTempCwd(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-run-'));
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-dest-'));
  const cwd = process.cwd();
  process.chdir(root);
  try {
    fn({ root, dest });
  } finally {
    process.chdir(cwd);
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(dest, { recursive: true, force: true });
  }
}

test('copies the light layer as-is and packs traces into one archive', () => {
  withTempCwd(({ dest }) => {
    const run = makeRun(process.cwd(), 'pilot-1');
    const summary = archiveRun(run, { dest });

    assert.equal(summary.copied, 2, 'results.jsonl and report.md');
    assert.equal(summary.packed, 1, 'one traces directory');
    const out = path.join(dest, 'exports', 'tutor-stub-outcome', 'pilot-1');
    assert.equal(fs.readFileSync(path.join(out, 'report.md'), 'utf8'), '# report\n');
    assert.ok(fs.existsSync(path.join(out, 'results.jsonl')), 'transcripts land unpacked and greppable');
    assert.ok(fs.existsSync(path.join(out, 'traces.tgz')), 'traces land packed');
    assert.ok(!fs.existsSync(path.join(out, 'traces')), 'and not also unpacked');
  });
});

test('a second pass copies nothing, so a resumed run is cheap to re-archive', () => {
  withTempCwd(({ dest }) => {
    const run = makeRun(process.cwd(), 'pilot-1');
    archiveRun(run, { dest });
    const again = archiveRun(run, { dest });
    assert.equal(again.copied, 0);
    assert.equal(again.packed, 0);
    assert.equal(again.skipped, 3);
    assert.equal(again.missing, 0);
  });
});

test('check reports what is missing and writes nothing', () => {
  withTempCwd(({ dest }) => {
    const run = makeRun(process.cwd(), 'pilot-1');
    const summary = archiveRun(run, { dest, check: true });
    assert.equal(summary.missing, 4, 'three artifacts plus the ledger line');
    assert.equal(summary.copied, 0);
    assert.equal(summary.packed, 0);
    assert.deepEqual(fs.readdirSync(dest), []);
  });
});

test('light-only leaves the traces behind, which is what a finished run copies', () => {
  withTempCwd(({ dest }) => {
    const run = makeRun(process.cwd(), 'pilot-1');
    const summary = archiveRun(run, { dest, lightOnly: true });
    assert.equal(summary.copied, 2);
    assert.equal(summary.packed, 0);
    const out = path.join(dest, 'exports', 'tutor-stub-outcome', 'pilot-1');
    assert.ok(fs.existsSync(path.join(out, 'results.jsonl')));
    assert.ok(!fs.existsSync(path.join(out, 'traces.tgz')));
  });
});

test('archiving records a ledger line once, with the checkpoint learner profile', () => {
  withTempCwd(({ dest }) => {
    const run = makeRun(process.cwd(), 'pilot-1');
    fs.writeFileSync(
      path.join(run, 'outcome-pilot-checkpoint.json'),
      JSON.stringify({ learner_profile: 'overconfident' }),
    );

    const first = archiveRun(run, { dest });
    assert.equal(first.ledger, 1);
    const text = fs.readFileSync(ledgerPath(dest), 'utf8');
    assert.match(text, /pilot-1 \| archived \d{4}-\d{2}-\d{2} \| profile overconfident \|/u);

    const again = archiveRun(run, { dest });
    assert.equal(again.ledger, 0, 'a second pass appends nothing');
    assert.equal(fs.readFileSync(ledgerPath(dest), 'utf8'), text);

    const checked = archiveRun(run, { dest, check: true });
    assert.equal(checked.missing, 0, 'check passes once artifacts and ledger line exist');
  });
});

test('check flags an archived run whose ledger line is missing', () => {
  withTempCwd(({ dest }) => {
    const run = makeRun(process.cwd(), 'pilot-1');
    archiveRun(run, { dest });
    fs.rmSync(ledgerPath(dest));
    const checked = archiveRun(run, { dest, check: true });
    assert.equal(checked.missing, 1);
    assert.deepEqual(checked.missingPaths, ['RUN-LEDGER.md line for pilot-1']);
  });
});

test('a run whose blocks sit one level down is found by --all', () => {
  withTempCwd(() => {
    const parent = path.join(process.cwd(), 'exports', 'tutor-stub-outcome');
    makeRun(process.cwd(), path.join('phaseB', 'bare--world_030'));
    makeRun(process.cwd(), path.join('phaseB', 'contract--world_030'));
    const found = runDirs(parent, true);
    assert.deepEqual(
      found.map((d) => path.basename(d)),
      ['phaseB'],
    );
  });
});

test('a run nested under plain directories is found by --all, and a cohort stays one unit', () => {
  withTempCwd(() => {
    const exports = path.join(process.cwd(), 'exports');
    makeRun(process.cwd(), 'pilot-1');
    for (const name of ['run-a', 'run-b']) {
      const dir = path.join(exports, 'arc', '2026-06', name);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'report.md'), '# report\n');
    }
    fs.mkdirSync(path.join(exports, 'arc', 'notes-only'), { recursive: true });
    fs.writeFileSync(path.join(exports, 'arc', 'notes-only', 'readme.txt'), 'no run here\n');
    fs.mkdirSync(path.join(exports, 'solo-pilot'), { recursive: true });
    fs.writeFileSync(path.join(exports, 'solo-pilot', 'summary.json'), '{}\n');
    fs.writeFileSync(path.join(exports, 'solo-pilot', 'report.md'), '# report\n');
    fs.writeFileSync(path.join(exports, 'stray.json'), '{}\n');
    const found = runDirs(exports, true).map((d) => path.relative(exports, d));
    assert.deepEqual(found, [path.join('arc', '2026-06'), 'solo-pilot', 'tutor-stub-outcome']);
  });
});

test('a missing archive directory resolves to null rather than a stray path', () => {
  const previous = process.env.EVAL_ARCHIVE_DIR;
  process.env.EVAL_ARCHIVE_DIR = path.join(os.tmpdir(), 'no-such-archive-dir-0f1a');
  try {
    assert.equal(resolveArchiveDir(), null);
  } finally {
    if (previous === undefined) delete process.env.EVAL_ARCHIVE_DIR;
    else process.env.EVAL_ARCHIVE_DIR = previous;
  }
});

test('default archive discovery anchors to the repository root rather than the process cwd', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-repo-parent-'));
  const root = path.join(parent, 'machinespirits-eval');
  const unrelatedCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-unrelated-cwd-'));
  const archive = path.join(parent, 'machinespirits-eval-private');
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(archive, { recursive: true });
  try {
    assert.equal(
      resolveArchiveDir(null, { cwd: unrelatedCwd, repoRoot: root, env: {}, commonGitDirectory: null }),
      archive,
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
    fs.rmSync(unrelatedCwd, { recursive: true, force: true });
  }
});

test('archive CLI covers every run under exports/ by default and accepts one explicit cohort root', () => {
  withTempCwd(({ dest }) => {
    makeRun(process.cwd(), 'pilot-1');
    const elsewhere = path.join(process.cwd(), 'exports', 'character-pilot');
    fs.mkdirSync(elsewhere, { recursive: true });
    fs.writeFileSync(path.join(elsewhere, 'report.md'), '# report\n');
    fs.writeFileSync(path.join(elsewhere, 'summary.json'), '{}\n');
    const defaultResult = spawnSync(process.execPath, [ARCHIVE_SCRIPT, '--check', '--dest', dest], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    assert.equal(defaultResult.status, 1);
    // tutor-stub-outcome is one cohort unit (2 light files, 1 traces pack, 1 ledger line);
    // character-pilot is a run of its own (2 light files, 1 ledger line).
    assert.match(defaultResult.stdout, /2 run\(s\): 7 artifact\(s\) missing/u);

    const cohort = path.join(process.cwd(), 'exports', 'learner-profile-world-deconfound', 'prospective-plan');
    fs.mkdirSync(path.join(cohort, 'traces'), { recursive: true });
    fs.writeFileSync(path.join(cohort, 'run-manifest.json'), '{}\n');
    fs.writeFileSync(path.join(cohort, 'traces', 'd0.jsonl'), '{}\n');
    const cohortResult = spawnSync(process.execPath, [ARCHIVE_SCRIPT, '--check', '--dest', dest, cohort], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    assert.equal(cohortResult.status, 1);
    assert.match(cohortResult.stdout, /1 run\(s\): 3 artifact\(s\) missing/u);
  });
});
