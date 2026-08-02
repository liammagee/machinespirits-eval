/**
 * Compile trigger v5 (card: paraphrase-robust-detection): v4's patterns
 * unchanged plus per-pressure token bags built from every ratified realize
 * text and sample line across the stress schedules. Bags key on content
 * words that survive re-phrasing; patterns always win first.
 *
 * Usage: node scripts/compile-manner-trigger-v5.js [--threshold 3]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require2 = createRequire(import.meta.url);
const YAML = require2('yaml');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SCHEDULES = [
  'config/drama-derivation/stress/world-033-stress-schedule.yaml',
  'config/drama-derivation/stress/world-030-stress-schedule.yaml',
  'config/drama-derivation/stress/world-030-escalation-schedule.yaml',
];

// state → the pressure kind whose card answers it (quiet states excluded —
// the quiet detector owns them; concession stays pattern-only).
const STATE_TO_PRESSURE = {
  jumping_ahead: 'demand',
  irritated: 'mockery',
  frustrated: 'grievance',
  forgetting: 'settled_claim',
  opposed: 'stake',
};

const STOP = new Set(
  'the and but for you your not are was were with that this then than there here what when where which just have has had can could would will its it is a an of to in on at me my mine im ive dont wont isnt arent be been being do does did so if or as one sample say says said tell give write me'.split(
    ' ',
  ),
);
const tokens = (value) =>
  (
    String(value || '')
      .toLowerCase()
      .match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{1,}/gu) || []
  )
    .map((t) => t.replace(/[’']/gu, ''))
    .filter((t) => t.length > 2 && !STOP.has(t));

const args = process.argv.slice(2);
const thIdx = args.indexOf('--threshold');
const THRESHOLD = thIdx >= 0 ? Number(args[thIdx + 1]) : 3;

const bagsCounts = {};
for (const rel of SCHEDULES) {
  const y = YAML.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  for (const plant of y.plants || []) {
    const pressure = STATE_TO_PRESSURE[plant.state];
    if (!pressure) continue;
    const bag = (bagsCounts[pressure] = bagsCounts[pressure] || new Map());
    for (const token of tokens(`${plant.realize || ''}`)) bag.set(token, (bag.get(token) || 0) + 1);
  }
}
const bags = Object.fromEntries(
  Object.entries(bagsCounts).map(([kind, counts]) => [
    kind,
    {
      tokens: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t),
      threshold: THRESHOLD,
    },
  ]),
);

const v4 = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/manner-trigger/v4.json'), 'utf8'));
const v5 = {
  ...v4,
  version: 'v5-token-bags',
  notes: `2026-08-03: v4 patterns unchanged; per-pressure token bags compiled from ${SCHEDULES.length} ratified/mechanics schedules by scripts/compile-manner-trigger-v5.js (threshold ${THRESHOLD}). Patterns win first; bags extend recall on pattern-silent turns only.`,
  bags,
};
fs.writeFileSync(path.join(ROOT, 'config/manner-trigger/v5.json'), `${JSON.stringify(v5, null, 2)}\n`);
console.log(
  'wrote config/manner-trigger/v5.json —',
  Object.entries(bags)
    .map(([k, v]) => `${k}:${v.tokens.length}`)
    .join(' '),
);
