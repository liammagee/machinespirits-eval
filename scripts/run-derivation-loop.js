#!/usr/bin/env node
/**
 * One attended iteration of the phase-1 staging loop
 * (notes/dramatic-derivation-plan.md §3 step 3): run the drama with the
 * LLM role bridges → programmatic diagnosis → readable transcript → artifacts.
 *
 * The loop's discipline:
 *   - world + director + checker + slope are FROZEN; the only thing revised
 *     between iterations is the tutor role-script (--script).
 *   - plotLint must pass before any roles run (frozen guardrail §5).
 *   - mock-first: default backend is the zero-cost mock; --real is the
 *     explicit, attended opt-in to paid calls (DERIVATION_PROVIDER /
 *     DERIVATION_MODEL select the target; default openrouter/gemini-flash).
 *
 * Usage:
 *   node scripts/run-derivation-loop.js
 *     [--world config/drama-derivation/world-001-nocturne.yaml]
 *     [--script config/drama-derivation/tutor-scripts/nocturne-v001.md]
 *     [--label nocturne-v001-trial1]   (default: <script>-<mode>-<timestamp>)
 *     [--out exports/dramatic-derivation/loop]
 *     [--real]                         (paid calls; default is mock)
 *     [--note "what this iteration changes"]
 *
 * Artifacts land in <out>/<label>/: transcript.md (the drama, act by act),
 * diagnosis.json (taxonomy verdict, D(t), release adherence, dialogue
 * discipline, usage/cost), result.json (the raw engine output).
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadWorld,
  plotLint,
  runDrama,
  makeLlmClient,
  llmMode,
  resolveTarget,
  makeLlmDirector,
  makeLlmTutor,
  makeLlmLearner,
  diagnose,
  renderDCurve,
  renderTranscript,
} from '../services/dramaticDerivation/index.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/T/, '-').replace(/\..+$/, '');
}

async function main() {
  const worldPath = path.resolve(ROOT, arg('world', 'config/drama-derivation/world-001-nocturne.yaml'));
  const scriptPath = path.resolve(ROOT, arg('script', 'config/drama-derivation/tutor-scripts/nocturne-v001.md'));
  const mode = flag('real') ? 'real' : llmMode() === 'real' ? 'real' : 'mock';
  const note = arg('note', null);

  const world = loadWorld(worldPath);
  const lint = plotLint(world);
  if (!lint.ok) {
    console.error(`REFUSING TO RUN — plotLint failed for ${world.id}:`);
    for (const err of lint.errors) console.error(`  - ${err}`);
    process.exit(1);
  }

  const script = fs.readFileSync(scriptPath, 'utf8');
  const scriptName = path.basename(scriptPath, path.extname(scriptPath));
  const label = arg('label', `${scriptName}-${mode}-${timestamp()}`);
  const outDir = path.resolve(ROOT, arg('out', 'exports/dramatic-derivation/loop'), label);

  const target = mode === 'real' ? resolveTarget() : { provider: 'mock', model: 'mock' };
  console.log(`world   ${world.id} (lint PASS, S first derivable at release-turn ${lint.firstEntailedTurn})`);
  console.log(`script  ${path.relative(ROOT, scriptPath)}`);
  console.log(`backend ${mode}${mode === 'real' ? ` → ${target.provider}/${target.model}` : ' (zero-cost)'}`);
  if (mode === 'real') {
    const maxCalls = world.turnCap * 3 * 2; // 3 roles/turn, worst-case one repair each
    console.log(`        attended paid run: ≤${maxCalls} calls hard-bounded by turn_cap ${world.turnCap}`);
  }

  const client = makeLlmClient({ mode });
  const roles = {
    director: makeLlmDirector(world, client),
    tutor: makeLlmTutor(world, client, { script }),
    learner: makeLlmLearner({ setting: world.setting, voice: world.learnerVoice, client }),
  };

  const started = Date.now();
  const result = await runDrama({ world, roles });
  const elapsedMs = Date.now() - started;
  const usage = client.usage();
  const diagnosis = {
    label,
    note,
    scriptPath: path.relative(ROOT, scriptPath),
    worldPath: path.relative(ROOT, worldPath),
    backend: { mode, ...target },
    elapsedMs,
    usage,
    ...diagnose(result, world),
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'transcript.md'),
    renderTranscript(result, world, { title: `${world.title} — ${label}` }),
  );
  fs.writeFileSync(path.join(outDir, 'diagnosis.json'), `${JSON.stringify(diagnosis, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);

  console.log('');
  console.log(
    `VERDICT ${result.verdict}  (${result.turnsPlayed}/${world.turnCap} turns, ${(elapsedMs / 1000).toFixed(1)}s)`,
  );
  if (result.firstForcedTurn !== null) {
    console.log(
      `        S forced at turn ${result.firstForcedTurn}; ${
        result.assertedGroundedTurn !== null
          ? `asserted grounded at turn ${result.assertedGroundedTurn}`
          : 'never asserted'
      }`,
    );
  }
  console.log('');
  console.log(renderDCurve(result.trajectory));
  console.log('');
  const adherence = diagnosis.releaseAdherence;
  console.log(
    `releases ${adherence.onCue} on cue, ${adherence.deviations.length} deviations, ${adherence.missed.length} missed, ${adherence.unscheduled.length} unscheduled`,
  );
  const eventLine = Object.entries(diagnosis.eventsByType)
    .map(([k, v]) => `${k}×${v}`)
    .join(', ');
  console.log(`events  ${eventLine || 'none'}`);
  for (const [role, stats] of Object.entries(diagnosis.dialogueDiscipline)) {
    console.log(
      `        ${role}: ${stats.turns} turns, avg ${stats.avgSentences} sentences (max ${stats.maxSentences}), avg ${stats.avgWords} words`,
    );
  }
  console.log(
    `cost    ${usage.calls} calls, ${usage.inputTokens}+${usage.outputTokens} tokens, $${usage.costUSD.toFixed(4)}`,
  );
  console.log('');
  console.log(`artifacts ${path.relative(ROOT, outDir)}/{transcript.md, diagnosis.json, result.json}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
