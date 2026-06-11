#!/usr/bin/env node
/**
 * One-time backfill of `group` into existing derivation-run diagnosis.json
 * files (stall-watcher note §5: "group derivative transcripts by these
 * conditions, as named groups" — runs from before --group existed get their
 * historical condition assigned here, by a STATIC map, so the scriptorium
 * index and the counsel resolver see one consistent field).
 *
 * The four historical conditions (2026-06-09 → 2026-06-10):
 *   mock-smoke        — deterministic mock plumbing checks (no models on stage)
 *   phase1-nocturne   — the phase-1 staging loop on nocturne v001/v002
 *   figure-mechanism  — the S0→S1 figure-authority experiment (note→figure)
 *   superego-internal — the internal-superego phase (charter v2, 7 paid arms)
 *
 * Idempotent: a run whose diagnosis.group already equals the mapped value is
 * left untouched; a differing existing value is NEVER overwritten (reported
 * instead — group assignment is an operator decision, not a script's).
 * Unmapped labels are reported and skipped. New runs should use --group at
 * run time; this script's map is frozen to the pre-flag population.
 *
 * Usage: node scripts/backfill-derivation-groups.js [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOOP_DIR = path.resolve(ROOT, 'exports/dramatic-derivation/loop');
const DRY = process.argv.includes('--dry-run');

const GROUP_BY_LABEL = {
  // deterministic mock plumbing checks
  'free-figures-mockcheck': 'mock-smoke',
  'freelance-director-mockcheck': 'mock-smoke',
  'frozen-gate-mockcheck': 'mock-smoke',
  'note-semantics-mockcheck': 'mock-smoke',
  'nocturne-v001-mock-smoke': 'mock-smoke',
  'nocturne-v002-mock-roleplumbing': 'mock-smoke',
  'nocturne-v002-mock-slopecheck': 'mock-smoke',
  'mock-superego-off': 'mock-smoke',
  'mock-superego-on': 'mock-smoke',
  'mock-bitterwell-superego-off': 'mock-smoke',
  'mock-bitterwell-superego-on': 'mock-smoke',
  'mock-lantern-superego-off': 'mock-smoke',
  'mock-lantern-superego-on': 'mock-smoke',
  // phase-1 staging loop (nocturne)
  'nocturne-v001-real-001': 'phase1-nocturne',
  'nocturne-v002-real-001': 'phase1-nocturne',
  'nocturne-v002-codex-001': 'phase1-nocturne',
  'nocturne-v002-mixed-001': 'phase1-nocturne',
  // S0→S1 figure-authority experiment
  'nocturne-v002-s0-control': 'figure-mechanism',
  'nocturne-v002-s1-full': 'figure-mechanism',
  'nocturne-v002-s1-staging': 'figure-mechanism',
  'nocturne-v002-s1-staging-2': 'figure-mechanism',
  // internal-superego phase (charter v2 arms)
  'nocturne-v002-real-superego-on-t1-charterv2': 'superego-internal',
  'lantern-v001-real-off-t1': 'superego-internal',
  'lantern-v001-real-superego-on-t1': 'superego-internal',
  'lantern-v001-real-superego-on-t2-charterv2': 'superego-internal',
  'bitterwell-v001-real-off-t1': 'superego-internal',
  'bitterwell-v001-real-superego-on-t1-charterv2': 'superego-internal',
  'bitterwell-v001-real-superego-on-revoiced-t1': 'superego-internal',
};

function main() {
  if (!fs.existsSync(LOOP_DIR)) {
    console.error(`no loop dir at ${LOOP_DIR}`);
    process.exit(1);
  }
  const counts = { set: 0, already: 0, conflict: 0, unmapped: 0, unreadable: 0 };
  for (const name of fs.readdirSync(LOOP_DIR).sort()) {
    const diagPath = path.join(LOOP_DIR, name, 'diagnosis.json');
    if (!fs.existsSync(diagPath)) continue;
    let diagnosis;
    try {
      diagnosis = JSON.parse(fs.readFileSync(diagPath, 'utf8'));
    } catch {
      counts.unreadable += 1;
      console.log(`  ?  ${name} — diagnosis.json unreadable, skipped`);
      continue;
    }
    const mapped = GROUP_BY_LABEL[name];
    const existing = diagnosis.group ?? null;
    if (!mapped) {
      counts.unmapped += 1;
      console.log(`  -  ${name} — not in the frozen map${existing ? ` (already grouped: ${existing})` : ''}, skipped`);
      continue;
    }
    if (existing === mapped) {
      counts.already += 1;
      continue;
    }
    if (existing !== null) {
      counts.conflict += 1;
      console.log(`  !  ${name} — has group "${existing}", map says "${mapped}"; NOT overwritten`);
      continue;
    }
    counts.set += 1;
    console.log(`  +  ${name} → ${mapped}${DRY ? ' (dry-run)' : ''}`);
    if (!DRY) {
      // `label` sits first in the loop runner's diagnosis; keep group beside it.
      const { label, ...rest } = diagnosis;
      const next = label !== undefined ? { label, group: mapped, ...rest } : { group: mapped, ...rest };
      fs.writeFileSync(diagPath, `${JSON.stringify(next, null, 2)}\n`);
    }
  }
  console.log(
    `${DRY ? '[dry-run] ' : ''}set ${counts.set} · already grouped ${counts.already} · conflicts ${counts.conflict} · unmapped ${counts.unmapped} · unreadable ${counts.unreadable}`,
  );
}

main();
