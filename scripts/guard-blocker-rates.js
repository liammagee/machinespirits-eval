#!/usr/bin/env node
/**
 * How often does one guard stop a turn — out of all turns, not just the
 * vetoed ones? (workplan: guard-validity-study)
 *
 * The item file `exports/guard-validity/items.jsonl` holds one row per turn
 * where the template shipped, and since the policy flip each row records what
 * still blocks the draft under the live rules. Counting sole blockers there
 * gives a shape: which guard accounts for which share of the failures. It does
 * not give a rate, because the denominator is turns that already failed.
 *
 * "The contract cuts source-alignment failures six times" is a claim about a
 * rate, and reading it off the item file alone gets it wrong: a version of the
 * tutor that fails less often overall will look worse per failure. This script
 * supplies the missing denominator — every turn that reached delivery, from
 * `censusRun` — and divides against it.
 *
 * Two counts that are easy to confuse, both printed:
 *   vetoed   turns the template spoke on (census)
 *   items    those of them where a draft could be picked to judge. Lower when
 *            no draft cleared the safety checks. The gap is not attributable
 *            to any guard, so it sits outside the per-guard columns.
 *
 * No model is called and nothing is written.
 *
 * Usage:
 *   node scripts/guard-blocker-rates.js [runDir] [--family <guard>] [--items path]
 */
import fs from 'node:fs';
import path from 'node:path';

import { censusRun } from './census-guard-template-rate.js';

const DEFAULT_RUN_DIR = 'exports/tutor-stub-outcome/fallible-phaseB';
const DEFAULT_ITEMS = path.resolve('exports/guard-validity/items.jsonl');

function flag(argv, name) {
  const exact = argv.indexOf(`--${name}`);
  if (exact >= 0 && argv[exact + 1] && !argv[exact + 1].startsWith('--')) return argv[exact + 1];
  const joined = argv.find((a) => a.startsWith(`--${name}=`));
  return joined ? joined.slice(name.length + 3) : null;
}

function loadItems(itemsPath) {
  if (!fs.existsSync(itemsPath)) {
    console.error(`no item file at ${itemsPath}: run \`guard-validity-study.js extract\` first (no model calls)`);
    process.exit(1);
  }
  const rows = fs
    .readFileSync(itemsPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
  if (!rows.some((r) => r.draftHardRelaxed)) {
    console.error(
      'the item file predates the live-policy field: re-run `extract` first (no model calls, nothing is lost)',
    );
    process.exit(1);
  }
  return rows;
}

/** The one guard still stopping this draft, or null when none or several do. */
function soleBlocker(item) {
  const families = [...new Set((item.draftHardRelaxed || []).map((k) => k.split('.')[0]))];
  return families.length === 1 ? families[0] : null;
}

// Census keys the condition by the path between the run root and `traces/` —
// `low_agency--rowan/contract`. The item file keeps the two halves apart.
const conditionOf = (item) => `${item.cell}/${item.version}`;

function tallies(items, census, family) {
  const rows = new Map();
  const row = (key) => {
    if (!rows.has(key)) rows.set(key, { turns: 0, vetoed: 0, items: 0, blocked: 0 });
    return rows.get(key);
  };
  for (const [key, tally] of census.byCondition) {
    const r = row(key);
    r.turns += tally.turns;
    r.vetoed += tally.template;
  }
  for (const item of items) {
    const r = row(conditionOf(item));
    r.items += 1;
    if (soleBlocker(item) === family) r.blocked += 1;
  }
  return rows;
}

/** Sum the per-condition rows along one axis — the world, or the tutor's load. */
function collapse(rows, pick) {
  const out = new Map();
  for (const [key, r] of rows) {
    const k = pick(key);
    const cur = out.get(k) || { turns: 0, vetoed: 0, items: 0, blocked: 0 };
    for (const f of ['turns', 'vetoed', 'items', 'blocked']) cur[f] += r[f];
    out.set(k, cur);
  }
  return out;
}

const pct = (part, whole) => (whole ? `${((part / whole) * 100).toFixed(1)}%` : '—');

function print(title, rows) {
  console.log(`\n${title}`);
  const width = Math.max(...[...rows.keys()].map((k) => k.length), 9);
  console.log(
    `  ${'condition'.padEnd(width)}  ${'turns'.padStart(6)}  ${'vetoed'.padStart(6)}  ${'blocked'.padStart(7)}  ${'of turns'.padStart(9)}  ${'of vetoed'.padStart(9)}`,
  );
  for (const key of [...rows.keys()].sort()) {
    const r = rows.get(key);
    console.log(
      `  ${key.padEnd(width)}  ${String(r.turns).padStart(6)}  ${String(r.vetoed).padStart(6)}  ${String(r.blocked).padStart(7)}  ${pct(r.blocked, r.turns).padStart(9)}  ${pct(r.blocked, r.vetoed).padStart(9)}`,
    );
  }
}

function main() {
  const argv = process.argv.slice(2);
  const runDir = argv.find((a) => !a.startsWith('--')) || DEFAULT_RUN_DIR;
  const family = flag(argv, 'family') || 'live_source_action_alignment_v1';
  const itemsPath = path.resolve(flag(argv, 'items') || DEFAULT_ITEMS);
  if (!fs.existsSync(runDir)) {
    console.error(`no run directory at ${runDir}`);
    process.exit(1);
  }

  const items = loadItems(itemsPath);
  const census = censusRun(runDir);
  const rows = tallies(items, census, family);

  const total = { turns: 0, vetoed: 0, items: 0, blocked: 0 };
  for (const r of rows.values()) for (const f of Object.keys(total)) total[f] += r[f];

  console.log(`run   ${runDir}`);
  console.log(`items ${itemsPath}`);
  console.log(
    `\n${total.turns} turns reached delivery; the template spoke on ${total.vetoed} (${pct(total.vetoed, total.turns)}).`,
  );
  if (total.items !== total.vetoed) {
    console.log(
      `${total.items} of those carry a draft to judge; on ${total.vetoed - total.items} no draft cleared the safety checks.`,
    );
  }
  console.log(
    `${family} is the only check still blocking on ${total.blocked} turns — ` +
      `${pct(total.blocked, total.turns)} of all turns, ${pct(total.blocked, total.vetoed)} of vetoed ones.`,
  );

  print(
    'by world',
    collapse(rows, (k) => k.split('/')[0]),
  );
  print(
    'by what the tutor carries',
    collapse(rows, (k) => k.split('/')[1] || '(none)'),
  );
  print('full grid', rows);

  const thin = [...rows.values()].filter((r) => r.blocked > 0 && r.blocked < 5).length;
  if (thin) {
    console.log(
      `\n${thin} of ${rows.size} cells hold fewer than five blocked turns. Read the rates whole; ` +
        'a difference resting on a cell that thin is not a difference.',
    );
  }
}

main();
