#!/usr/bin/env node
/**
 * Hand-audit sheet for the closure detector, required by the pilot gate in
 * workplan/items/tutor-contract-outcome-prereg.md before the main run.
 *
 * The phase-5e record shows the closure matchers have quietly missed
 * legitimate closures before, and the whole outcome experiment stands on this
 * one instrument. This script lays each pilot dialogue's detector verdict
 * beside the evidence a human needs to check it: the final exchanges
 * verbatim, the entailment assessment, and the proof that the prompt carried
 * no advisory blocks. It computes nothing new — it is a reading aid.
 *
 *   node scripts/audit-tutor-stub-closure.js --run exports/tutor-stub-outcome/pilot-1
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = { run: null, tail: 3, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--run') args.run = path.resolve(ROOT, argv[++i]);
    else if (a === '--tail') args.tail = Number(argv[++i]);
    else if (a === '--out') args.out = path.resolve(ROOT, argv[++i]);
    else throw new Error(`unknown flag ${a}`);
  }
  if (!args.run) throw new Error('need --run <outcome run dir>');
  return args;
}

function fence(text) {
  return String(text || '').replace(/^/gmu, '> ');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const resultsPath = path.join(args.run, 'results.jsonl');
  const rows = fs
    .readFileSync(resultsPath, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));

  const ok = rows.filter((row) => row.status === 'ok');
  const sections = ok.map((row) => {
    const verdict = row.closure?.grounded === true ? 'CLOSED' : row.closure?.grounded === false ? 'OPEN' : 'UNMEASURED';
    const tailTurns = (row.turns || []).slice(-args.tail);
    const assessment = row.assessment || {};
    const blocks = row.promptBlocks;
    return [
      `## ${row.world} #${row.k} — detector says ${verdict}`,
      '',
      `- basis: \`${row.closure?.basis || '—'}\` · phase \`${row.closure?.phase || '—'}\` · reached at turn ${row.closure?.reachedAtTurn ?? '—'} · stop: ${row.stopReason || '—'} · ${row.turnCount} turns`,
      `- assessment: entailed=${assessment.finalSecretEntailed ?? '—'} asserted=${assessment.assertedSecret ?? '—'} bottleneck=\`${assessment.bottleneck || '—'}\` coverage=${assessment.bestPathCoverage ?? '—'} missing premises=${assessment.missingPremiseCount ?? '—'}`,
      `- prompt blocks: ${blocks ? `enabled [${blocks.enabled.join(', ') || 'none'}] · omitted [${blocks.omitted.join(', ')}] · stamped on ${blocks.turnsStamped} turns` : 'NO STAMP FOUND — investigate before trusting this row'}`,
      `- trace: \`${row.tracePath}\``,
      '',
      `Final ${tailTurns.length} exchanges:`,
      '',
      ...tailTurns.flatMap((turn) => [`**Learner:**`, fence(turn.learner), '', `**Tutor:**`, fence(turn.tutor), '']),
      `**Hand verdict** (fill in): agree / disagree — reason:`,
      '',
      '---',
      '',
    ].join('\n');
  });

  const errors = rows.filter((row) => row.status !== 'ok');
  const header = [
    '# Closure detector hand-audit',
    '',
    `Run: \`${path.relative(ROOT, args.run)}\` · ${ok.length} dialogues · ${errors.length} errored`,
    '',
    'For each dialogue: does the detector verdict match your reading of the final exchanges?',
    'A CLOSED verdict needs the learner stating the conclusion with the premises on the table entailing it.',
    'An OPEN verdict needs that to be genuinely absent — a learner who said it in other words is a detector miss.',
    '',
    '---',
    '',
  ];
  const outPath = args.out || path.join(args.run, 'closure-audit.md');
  fs.writeFileSync(outPath, [...header, ...sections].join('\n'));
  process.stdout.write(`${ok.length} dialogues written to ${path.relative(ROOT, outPath)}\n`);
}

main();
