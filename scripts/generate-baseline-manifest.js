/**
 * Generate the machine-readable baseline manifest for the stabilized
 * adaptive stack (card: adaptive-causality-stabilization).
 *
 * Pins, by sha256 over file bytes, every artifact the v0.7.0 adaptive
 * stack reads at run time: trigger/detector artifacts, the move-card and
 * quiet-card source, the dose ladder and composer and contract-split
 * services, worlds and stress schedules, and the model identities the
 * benches ran on. Each pin carries the claim scope it supports, so a
 * later diff shows exactly which claims a change touches.
 *
 * Usage: node scripts/generate-baseline-manifest.js [--check]
 *   default: writes config/stability/baseline-v0.7.0.json
 *   --check: recomputes and diffs against the committed manifest (exit 1
 *            on drift) — CI-safe, no model calls.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'config', 'stability', 'baseline-v0.7.0.json');

const PINS = [
  { file: 'config/manner-trigger/v4.json', claim: 'tuned pressure patterns (held-out recall 68/162)' },
  {
    file: 'config/manner-trigger/v5.json',
    claim: 'schedule-coverage token bags (leave-one-out 0/13: coverage only, not paraphrase robustness)',
  },
  {
    file: 'config/manner-trigger/v6-cascade.json',
    claim: 'detection cascade (held-out 84/162 at unchanged calm alarms; leave-one-world-out standard)',
  },
  {
    file: 'config/manner-trigger/v7-cascade.json',
    claim:
      'v6 + stake-fusion patterns (corpus recall 169/169, collisions 0/179, calm 0/124 — card adaptive-causality-routing)',
  },
  {
    file: 'services/tutorStubMannerSwitch.js',
    claim: 'move cards + exemplars + licences; classifier features fv1; dose options',
  },
  {
    file: 'services/tutorStubQuietDetector.js',
    claim:
      'typed quiet states qd-v2 (qd-v1 record 14/18, k=5 22/30, plus wordy-flat shapes: replayed flat recall 66/66, collisions 0, calm 0 — card adaptive-causality-repertoire)',
  },
  {
    file: 'services/tutorStubDramaticRelease.js',
    claim: 'clue span replacement (model-voiced deliveries; t5 wedge case recorded)',
  },
  {
    file: 'services/tutorStubTutorTurnPipeline.js',
    claim: 'card rides the recovery retry (the card-strip fix); insertion interception; contract licence slot',
  },
  {
    file: 'services/tutorStubWorldPromptContext.js',
    claim: 'safety-contract/teaching-charter split, byte-exact reassembly, licence slot',
  },
  { file: 'config/drama-derivation/world-030-rowan-flat.yaml', claim: 'second world (ratified schedule world)' },
  {
    file: 'config/drama-derivation/stress/world-030-stress-schedule.yaml',
    claim: 'ratified stress schedule v1.1 (bench for the side-by-side and the live-seat runs)',
  },
  {
    file: 'config/drama-derivation/world-033-alder-row-redoubt.yaml',
    claim: 'first world (training world for the cascade classifier)',
  },
  { file: 'config/drama-derivation/stress/world-033-stress-schedule.yaml', claim: 'first ratified schedule' },
  {
    file: 'config/drama-derivation/world-034-groupwork-flag.yaml',
    claim: 'contemporary demo world (gates passed; schedule demo-tier, NOT ratified)',
  },
  {
    file: 'config/drama-derivation/stress/world-034-stress-schedule.yaml',
    claim: 'demo-tier schedule (no gold adjudication)',
  },
];

const MODELS = {
  tutor_seats_tested: ['claude-code.claude-sonnet-5', 'claude-code.claude-opus-5'],
  learner: 'codex.gpt-5.6-terra',
  move_tagger: 'codex.gpt-5.6-sol',
  second_family_tagger: 'claude-code.claude-fable-5',
};

const BASELINES = {
  bare: 'tutor-stub with no adaptive envs (no manner switch, no quiet detector, no dose ladder, no contract licence, no clue insertion)',
  full_stack:
    'TUTOR_STUB_MANNER_SWITCH=1 TUTOR_STUB_MANNER_TRIGGER=config/manner-trigger/v6-cascade.json TUTOR_STUB_QUIET_DETECTOR=1 TUTOR_STUB_CARD_DOSE_LADDER=1 TUTOR_STUB_CONTRACT_LICENCE=1 TUTOR_STUB_CLUE_INSERTION=1',
};

const CORRECTED_CONTRACTS = [
  'card-plus-licence delivery: the conduct card and the standing licence must both reach the SHIPPED prompt of the delivered attempt at planted pressure turns, retries included (tests/goldenDeliveryContract.test.js)',
  'licence/card separation: licence alone 0, card alone 0 full wagers, together 2/3 both families — do NOT freeze the dissolved family-relative first-demand boundary (see the living log correction entry, 2026-08-03)',
];

function sha256(rel) {
  return createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, rel)))
    .digest('hex');
}

const manifest = {
  schema: 'machinespirits.baseline-manifest.v1',
  baseline: 'v0.7.0',
  paper_version: '3.0.250',
  generated_by: 'scripts/generate-baseline-manifest.js',
  pins: PINS.map((p) => ({ ...p, sha256: sha256(p.file) })),
  models: MODELS,
  baselines: BASELINES,
  corrected_contracts: CORRECTED_CONTRACTS,
  claim_boundary:
    'Simulated learners only; k<=5 per bench; one to two worlds per claim; no human-learning claim. Source of truth for claims: docs/research/paper-full-2.0.md §6.24 and §7.11.',
};

const rendered = `${JSON.stringify(manifest, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const committed = fs.readFileSync(OUT, 'utf8');
  if (committed !== rendered) {
    const a = JSON.parse(committed);
    const drifted = manifest.pins.filter((p, i) => a.pins?.[i]?.sha256 !== p.sha256).map((p) => p.file);
    console.error(`baseline manifest drift: ${drifted.join(', ') || 'structure changed'}`);
    process.exit(1);
  }
  console.log('baseline manifest current');
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, rendered);
  console.log(`wrote ${path.relative(ROOT, OUT)} (${manifest.pins.length} pins)`);
}
