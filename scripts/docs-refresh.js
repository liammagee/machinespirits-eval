/**
 * docs-refresh.js — one verb for the cheap generated-doc views.
 *   npm run docs:refresh [-- --arc]
 *
 * Runs every fast, local, no-API regeneration step and then reports what
 * changed, so "are the generated views current?" is one command instead of
 * four. Steps:
 *
 *   1. refs:render          — rewrites docs/ref-status.md (tracked; commit it)
 *   2. atlas:validate       — checks atlas.yaml against the paper (no writes)
 *   3. workplan             — validate item sources and prove the board can be
 *                             rendered in memory; local export files are
 *                             ignored and produced only by explicit wp:render
 *   4. --arc (opt-in)       — poetics:arc-html; excluded by default because it
 *                             stamps generated_at and dirties the tree on
 *                             every run even with no content change
 *
 * Deliberately excluded: the paper PDF (`cd docs/research && ./build.sh` —
 * needs LaTeX and minutes) and the atlas PDF build (`npm run atlas:build`).
 */

import { spawnSync } from 'node:child_process';

const wantArc = process.argv.includes('--arc');

function run(label, cmd, args) {
  process.stdout.write(`\n== ${label}: ${cmd} ${args.join(' ')}\n`);
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`docs-refresh: step "${label}" failed (exit ${r.status}) — stopping.`);
    process.exit(r.status ?? 1);
  }
}

function gitOut(args) {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  return (r.stdout || '').trim();
}

run('reference status', 'npm', ['run', 'refs:render']);
run('atlas manifest', 'npm', ['run', 'atlas:validate']);

run('workplan source and renderability', 'node', ['scripts/workplan.js', 'check']);

if (wantArc) {
  run('arc regions (timestamp churn expected)', 'npm', ['run', 'poetics:arc-html']);
}

const watched = ['docs/ref-status.md'];
const status = gitOut(['status', '--short', '--', ...watched]);
console.log('\n== changed tracked generated files:');
console.log(status || '  (none — everything was already current)');
console.log('\nPaper PDF (not run): cd docs/research && ./build.sh   # paper2 by default; needs LaTeX');
