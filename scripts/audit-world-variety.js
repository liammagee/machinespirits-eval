#!/usr/bin/env node
/**
 * Family-normalized variety audit for the derivation-world roster.
 *
 * Counting files overstates costume skew (seven hethel files are one
 * setting), so this audit groups by presentation.family first and reports
 * the distribution of temporal_frame, scene_ecology, and narrative_diction
 * across FAMILIES, plus untagged fields worth backfilling. Presentation is
 * authorial costume — deliberately not register or engagement stance.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWorld } from '../services/dramaticDerivation/world.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORLD_DIR = path.join(ROOT, 'config', 'drama-derivation');

function familyKey(world) {
  const p = world.presentation || {};
  return String(p.family || p.variant_of || world.id);
}

function tally(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function renderTally(label, map, total) {
  const rows = [...map.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`\n${label} (over ${total} families):`);
  for (const [key, count] of rows) {
    const pct = Math.round((count / total) * 100);
    console.log(`  ${String(key).padEnd(28)} ${String(count).padStart(3)}  ${'#'.repeat(count)} ${pct}%`);
  }
}

function main() {
  const files = fs
    .readdirSync(WORLD_DIR)
    .filter((file) => /^world-.*\.yaml$/u.test(file))
    .sort();
  const families = new Map();
  for (const file of files) {
    const world = loadWorld(path.join(WORLD_DIR, file));
    const key = familyKey(world);
    if (!families.has(key)) families.set(key, []);
    families.get(key).push({ file, world });
  }

  const frameTally = new Map();
  const ecologyTally = new Map();
  const dictionTally = new Map();
  const untagged = [];

  console.log(`worlds: ${files.length} files in ${families.size} presentation families\n`);
  for (const [family, members] of [...families.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const base = members.find((member) => !(member.world.presentation || {}).variant_of) || members[0];
    const p = base.world.presentation || {};
    const tags = [p.temporal_frame, p.scene_ecology, p.narrative_diction].filter(Boolean).join(' · ');
    console.log(
      `${family.padEnd(22)} ${String(members.length).padStart(2)} world${members.length === 1 ? ' ' : 's'}  ${tags || '(untagged)'}`,
    );
    tally(frameTally, p.temporal_frame || '(untagged)');
    tally(ecologyTally, p.scene_ecology || '(untagged)');
    tally(dictionTally, p.narrative_diction || '(untagged: legacy assay default)');
    for (const field of ['scene_ecology', 'narrative_diction', 'summary']) {
      if (!p[field]) untagged.push(`${family}: ${field}`);
    }
  }

  renderTally('temporal_frame', frameTally, families.size);
  renderTally('scene_ecology', ecologyTally, families.size);
  renderTally('narrative_diction', dictionTally, families.size);

  if (untagged.length) {
    console.log(`\nbackfill candidates (${untagged.length} fields):`);
    for (const item of untagged) console.log(`  - ${item}`);
  }

  const periodShare = (frameTally.get('period') || 0) / families.size;
  console.log(
    `\nverdict: ${Math.round(periodShare * 100)}% of families are period-framed; ` +
      (periodShare > 0.6
        ? 'the roster still leans period — prefer contemporary/speculative settings for the next base worlds.'
        : 'the roster carries a workable mix of frames.'),
  );
}

main();
