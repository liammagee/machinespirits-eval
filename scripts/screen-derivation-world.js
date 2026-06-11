#!/usr/bin/env node
/**
 * Guessability leak screen for dramatic-derivation worlds — assembles K_L
 * (the learner-visible curtain-rise context) from a world spec and runs the
 * EXISTING Oedipus S-underivability screen on it, unchanged
 * (notes/dramatic-derivation-plan.md §2.1 "Guessability (sampled, cheap)").
 *
 * K_L mirrors the engine's learnerView at turn 0 exactly: the public
 * question, the setting prose, and the world's rules (as their learner-facing
 * glosses). NOT: the secret, the mirror, any premise, the schedule, the
 * proof paths, or the dramaturgy. The assembled spec is written next to the
 * screen artifact so the screened context is itself auditable.
 *
 * The reference the screen matches against is the secret's SURFACE — kept
 * short and name-centered in the world spec so the deterministic token check
 * stays name-keyed and the LLM judge's culprit-matching carries the verdict.
 *
 * Usage:
 *   node scripts/screen-derivation-world.js
 *     [--world config/drama-derivation/world-001-nocturne.yaml]
 *     [--mock] [--model gpt] [--candidates 4] [--fail-on-derivable]
 *
 * --mock forwards to the screen's no-API mode (run it first, always).
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { loadWorld } from '../services/dramaticDerivation/index.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

/** K_L start-state prose: setting + the rules the learner lawfully knows. */
export function renderStartState(world) {
  const glosses = world.rules.map((rule, i) => `${i + 1}. ${(rule.gloss || rule.id).trim()}`);
  return [world.setting ? world.setting.trim() : '', 'The rules of evidence you know and trust:', ...glosses]
    .filter(Boolean)
    .join('\n');
}

/**
 * The screen-spec document (Oedipus drama format). kL fields carry ONLY
 * learner-visible material; the secret block (reference surface + concealed
 * premise surfaces) sits director-side, exactly as in the Oedipus specs.
 */
export function buildScreenSpec(world) {
  return {
    dramas: [
      {
        id: world.id,
        discipline: world.discipline || null,
        topic: world.question,
        scenario_name: world.title,
        learner_start_state: renderStartState(world),
        learner_voice_constraint: world.learnerVoice || null,
        secret: {
          fact: world.secret.surface,
          premise_ledger: world.premises.map((p) => (p.surface || '').trim()).filter(Boolean),
        },
      },
    ],
  };
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function main() {
  const worldPath = path.resolve(ROOT, arg('world', 'config/drama-derivation/world-001-nocturne.yaml'));
  const world = loadWorld(worldPath);
  const mock = flag('mock');
  const model = arg('model', 'gpt');
  const candidates = arg('candidates', '4');

  const outDir = path.join(ROOT, 'exports', 'dramatic-derivation', 'screens');
  fs.mkdirSync(outDir, { recursive: true });
  const specPath = path.join(outDir, `${world.id}-kl-spec.yaml`);
  fs.writeFileSync(specPath, yaml.stringify(buildScreenSpec(world)), 'utf8');

  const outPath = path.join(outDir, `${world.id}-screen-${mock ? 'mock' : model}.json`);
  const args = [
    path.join(ROOT, 'scripts', 'screen-s-underivability.js'),
    '--spec',
    specPath,
    '--candidates',
    candidates,
    '--out',
    outPath,
  ];
  if (mock) args.push('--mock');
  else args.push('--model', model);
  if (flag('fail-on-derivable')) args.push('--fail-on-derivable');

  console.log(`K_L spec: ${path.relative(ROOT, specPath)}`);
  const res = spawnSync('node', args, { stdio: 'inherit', cwd: ROOT });
  process.exit(res.status ?? 1);
}

if (path.resolve(process.argv[1] || '') === __filename) {
  main();
}
