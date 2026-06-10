#!/usr/bin/env node
/**
 * One attended iteration of the phase-1 staging loop
 * (notes/dramatic-derivation-plan.md §3 step 3): run the drama with the
 * LLM role bridges → programmatic diagnosis → readable transcript → artifacts.
 *
 * The loop's discipline:
 *   - release schedule + checker + slope constraints + turn cap are FROZEN;
 *     the dramaturgy is the director's (free movements — engine.js header;
 *     the per-turn tutor-note channel was removed 2026-06-10, manner-watching
 *     belongs to the tutor's own superego via --superego); the iterated
 *     artifact is the tutor role-script (--script).
 *   - plotLint must pass before any roles run (frozen guardrail §5).
 *   - mock-first: default backend is the zero-cost mock; --real is the
 *     explicit, attended opt-in to paid calls (DERIVATION_PROVIDER /
 *     DERIVATION_MODEL select the target; default openrouter/gemini-flash;
 *     DERIVATION_PROVIDER=codex routes ALL roles through the local codex
 *     CLI). Per-role overrides: DERIVATION_<ROLE>_PROVIDER / _MODEL
 *     (e.g. DERIVATION_LEARNER_MODEL) — six-role ready.
 *   - real runs report status live: one compact line per turn (the engine's
 *     onTurn hook) + per-call trace on stderr (DERIVATION_TRACE, defaulted
 *     on for --real; export DERIVATION_TRACE=0 to silence).
 *
 * Usage:
 *   node scripts/run-derivation-loop.js
 *     [--world config/drama-derivation/world-001-nocturne.yaml]
 *     [--script config/drama-derivation/tutor-scripts/nocturne-v001.md]
 *     [--label nocturne-v001-trial1]   (default: <script>-<mode>-<timestamp>)
 *     [--out exports/dramatic-derivation/loop]
 *     [--real]                         (paid calls; default is mock)
 *     [--recognition 0-3]              (tutor register dial; 0 = absent)
 *     [--charisma 0-3]                 (tutor + director-staging dial; 0 = absent)
 *     [--dramaturgy free|frozen]       (frozen = director cannot declare
 *                                       movements — the pre-06-09 fixed-acts
 *                                       behavior, flag-gated on the same code)
 *     [--superego]                     (the tutor's own superego watches each
 *                                       draft and may demand a restaging before
 *                                       the line is spoken — the internal
 *                                       channel; control arm = flag absent)
 *     [--learner-voice "<text>"]       (override the world's learner voice —
 *                                       personality/tonality variation; never
 *                                       carries plot content)
 *     [--note "what this iteration changes"]
 *
 * Artifacts land in <out>/<label>/: transcript.md (the drama, movement by
 * movement, instrument panel at the foot), diagnosis.json (taxonomy verdict,
 * D(t), release adherence, staging, dialogue discipline, usage/cost),
 * result.json (the raw engine output).
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
  clampDial,
  diagnose,
  stagingSegments,
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
  const dials = {
    recognition: clampDial(arg('recognition', 0)),
    charisma: clampDial(arg('charisma', 0)),
  };
  const dramaturgy = arg('dramaturgy', 'free');
  if (!['free', 'frozen'].includes(dramaturgy)) {
    console.error(`--dramaturgy must be "free" or "frozen" (got "${dramaturgy}")`);
    process.exit(1);
  }
  const learnerVoice = arg('learner-voice', null);
  const superego = flag('superego');
  // Real runs report per-call liveness by default (the dramas are slow to
  // build; an opaque shell was the complaint). DERIVATION_TRACE=0 silences.
  if (mode === 'real' && process.env.DERIVATION_TRACE === undefined) process.env.DERIVATION_TRACE = '1';

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

  const ROLE_NAMES = ['director', 'tutor', ...(superego ? ['tutor_superego'] : []), 'learner'];
  const targets = Object.fromEntries(
    ROLE_NAMES.map((r) => [r, mode === 'real' ? resolveTarget(r) : { provider: 'mock', model: 'mock' }]),
  );
  const showTarget = (t) => `${t.provider}/${t.model || '(cli default)'}`;
  console.log(`world   ${world.id} (lint PASS, S first derivable at release-turn ${lint.firstEntailedTurn})`);
  console.log(`script  ${path.relative(ROOT, scriptPath)}`);
  if (mode === 'real') {
    console.log('backend real');
    for (const r of ROLE_NAMES) console.log(`          ${r.padEnd(14)} ${showTarget(targets[r])}`);
    if (Object.values(targets).some((t) => t.cli)) {
      console.log('          (CLI roles bill plan quota; the CLI reports no token usage)');
    }
    // Worst case per turn: director + tutor draft + learner, plus superego +
    // ego revision when the watcher is on — one repair each.
    const maxCalls = world.turnCap * (superego ? 5 : 3) * 2;
    console.log(`        attended run: ≤${maxCalls} calls hard-bounded by turn_cap ${world.turnCap}`);
  } else {
    console.log('backend mock (zero-cost)');
  }
  if (dials.recognition || dials.charisma) {
    console.log(`dials   recognition ${dials.recognition}/3, charisma ${dials.charisma}/3`);
  }
  if (dramaturgy === 'frozen') {
    console.log('staging dramaturgy FROZEN (control arm — no movements declared)');
  }
  if (superego) {
    console.log('tutor   superego ON — the tutor watches its own manner (draft → note → restaging)');
  }
  if (learnerVoice) console.log(`voice   learner override: ${learnerVoice}`);

  const client = makeLlmClient({ mode });
  const roles = {
    director: makeLlmDirector(world, client, { dials, dramaturgy }),
    tutor: makeLlmTutor(world, client, { script, dials, superego }),
    learner: makeLlmLearner({ setting: world.setting, voice: learnerVoice || world.learnerVoice, client }),
  };

  // One compact line per completed turn — the shell's live pulse.
  const onTurn = (s) => {
    const bits = [`  t${String(s.turn).padStart(2, '0')}/${s.turnCap}`, `D=${s.D}${s.forced ? ' FORCED' : ''}`];
    if (s.released.length) bits.push(`▲ ${s.released.map((f) => f.join(' ')).join('; ')}`);
    if (s.adopted) bits.push(`+${s.adopted} adopted`);
    if (s.retracted) bits.push(`−${s.retracted} retracted`);
    if (s.phase && s.phase.turn === s.turn) bits.push(`movement "${s.phase.name}"`);
    if (s.intervened) bits.push('✎ superego');
    if (s.asserted) bits.push('ASSERTS');
    for (const e of s.events) bits.push(`⚑ ${e.type}`);
    if (s.endedBy) bits.push(`— ends: ${s.endedBy}`);
    console.log(bits.join('  '));
  };

  const started = Date.now();
  const result = await runDrama({ world, roles, options: { onTurn } });
  const elapsedMs = Date.now() - started;
  const usage = client.usage();
  const diagnosis = {
    label,
    note,
    scriptPath: path.relative(ROOT, scriptPath),
    worldPath: path.relative(ROOT, worldPath),
    backend: { mode, roles: targets },
    dials,
    dramaturgy,
    tutorSuperego: superego,
    learnerVoice: learnerVoice || null,
    elapsedMs,
    usage,
    ...diagnose(result, world),
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'transcript.md'),
    renderTranscript(result, world, { title: `${world.title} — ${label}`, diagnosis }),
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
  console.log(
    renderDCurve(result.trajectory, {
      acts: stagingSegments(result, world),
      releaseTurns: new Set(result.ledger.map((entry) => entry.turn)),
      slope: diagnosis.learningSlope,
    }),
  );
  console.log('');
  const adherence = diagnosis.releaseAdherence;
  console.log(
    `releases ${adherence.onCue} on cue, ${adherence.deviations.length} deviations, ${adherence.missed.length} missed, ${adherence.unscheduled.length} unscheduled`,
  );
  const eventLine = Object.entries(diagnosis.eventsByType)
    .map(([k, v]) => `${k}×${v}`)
    .join(', ');
  console.log(`events  ${eventLine || 'none'}`);
  const staging = diagnosis.staging;
  console.log(
    `staging ${
      staging.source === 'director'
        ? `${staging.movements.length} movements declared by the director`
        : "no movements declared (author's sketch held)"
    }${staging.tutorNotes.length ? `, ${staging.tutorNotes.length} tutor notes` : ''}`,
  );
  const tf = diagnosis.tutorFigures;
  if (tf && tf.total) {
    const fmt = (r) => (r === null || r === undefined ? '—' : r.toFixed(2));
    console.log(
      `figures ${tf.topFigure} ${tf.counts[tf.topFigure]}/${tf.total} (${Math.round((tf.topShare || 0) * 100)}%), ${tf.distinct} distinct, switch rate ${fmt(tf.switchRate)}${tf.noteTurns ? ` (on note turns ${fmt(tf.switchOnNoteTurns)} vs elsewhere ${fmt(tf.switchElsewhere)})` : ''}`,
    );
    const sg = tf.superego;
    if (sg) {
      console.log(
        `superego intervened ${sg.interventions}/${sg.watched}, within-turn figure change ${sg.withinTurnChanges}/${sg.interventions}${sg.switchOnIntervention !== null ? `, switch on intervention ${fmt(sg.switchOnIntervention)} vs elsewhere ${fmt(sg.switchElsewhere)}` : ''}`,
      );
    }
  }
  for (const [role, stats] of Object.entries(diagnosis.dialogueDiscipline)) {
    console.log(
      `        ${role}: ${stats.turns} turns, avg ${stats.avgSentences} sentences (max ${stats.maxSentences}), avg ${stats.avgWords} words`,
    );
  }
  console.log(
    `cost    ${usage.calls} calls, ${usage.inputTokens}+${usage.outputTokens} tokens, $${usage.costUSD.toFixed(4)}`,
  );
  for (const [role, u] of Object.entries(usage.byRole || {})) {
    console.log(
      `        ${role.padEnd(8)} ${u.calls} calls, ${u.inputTokens}+${u.outputTokens} tokens, $${u.costUSD.toFixed(4)}`,
    );
  }
  console.log('');
  console.log(`artifacts ${path.relative(ROOT, outDir)}/{transcript.md, diagnosis.json, result.json}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
