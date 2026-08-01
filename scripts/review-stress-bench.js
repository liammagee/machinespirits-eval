/**
 * Plant-by-plant review sheet for stress-bench runs. Read-only.
 *
 * Consolidates the inline markdown builder written three times during the
 * 2026-07/08 stress-bench arc: for every planted turn in every trace under
 * the given roots, show the learner's realized line, the tutor's delivered
 * reply, the adjudicated gold, whether the manner switch had a card active,
 * and whether the delivery came from the model or a template. This sheet is
 * the human-adjudication surface the bench's claim gate depends on.
 *
 * Usage:
 *   node scripts/review-stress-bench.js <traceDirOrParent> [more...] \
 *     [--out exports/tutor-stub-outcome/stress-review.md]
 */

import fs from 'node:fs';
import path from 'node:path';

function findTraces(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.endsWith('.jsonl') && !entry.name.includes('summary')) out.push(full);
    }
  }
  return out.sort();
}

function reviewTrace(tracePath, md) {
  const ev = fs
    .readFileSync(tracePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const plants = ev.filter((e) => e.type === 'learner_stress_plant');
  if (!plants.length) return false;
  const turns = Object.fromEntries(
    ev.filter((e) => e.type === 'turn_complete').map((e) => [e.turn, e.turnRecord || {}]),
  );
  const outcomeByTurn = {};
  for (const e of ev.filter((x) => x.type === 'tutor_response_guard_accounting')) {
    outcomeByTurn[e.turn] = e.accounting?.outcome || '?';
  }
  const cardOn = new Set(ev.filter((e) => e.type === 'tutor_manner_switch' && e.cardActive).map((e) => e.turn));
  const closed = ev.some((e) => e.type === 'dialogue_closure_transition');
  const label = path.relative(process.cwd(), path.dirname(tracePath));
  md.push(`\n## ${label} — ${Object.keys(turns).length} turns, closed=${closed}, plants=${plants.length}`);
  for (const plant of plants) {
    const rec = turns[plant.turn] || {};
    const template = /deterministic_fallback/.test(outcomeByTurn[plant.turn] || '');
    md.push(
      `\n### t${plant.turn} — ${plant.state} (gold: ${plant.rightRepair}${plant.alsoRight ? ' / ' + plant.alsoRight : ''})` +
        `${cardOn.has(plant.turn) ? ' **[CARD]**' : ''}${template ? ' **[TEMPLATE]**' : ''}`,
    );
    md.push(`- her: ${String(rec.learner || '').slice(0, 160)}`);
    md.push(`- tutor: ${String(rec.tutor || '').slice(0, 280)}`);
  }
  return true;
}

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outPath = outIndex >= 0 ? args[outIndex + 1] : null;
const roots = args.filter((a, i) => a !== '--out' && i !== outIndex + 1);
if (!roots.length) {
  console.error('usage: node scripts/review-stress-bench.js <traceDirOrParent> [more...] [--out file.md]');
  process.exit(1);
}
const md = ['# Stress-bench review — plant-by-plant'];
let found = 0;
for (const root of roots) {
  for (const tracePath of findTraces(path.resolve(root))) {
    if (reviewTrace(tracePath, md)) found += 1;
  }
}
const body = md.join('\n');
if (outPath) {
  fs.writeFileSync(path.resolve(outPath), `${body}\n`);
  console.log(`wrote ${outPath} (${found} planted runs)`);
} else {
  console.log(body);
}
