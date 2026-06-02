#!/usr/bin/env node
/*
 * One-side replay (v1: --side learner). Freeze the TUTOR's turns + the SCENE
 * (directorPlan) from a source transcript and regenerate the LEARNER K times via a
 * pluggable bridge. Isolates learner-variance from scene-variance — the counterfactual
 * the binary/graded critics can't give (each fresh run is a new scene). Reuses
 * runInteraction's `scriptedTutorTurns` hook for full fidelity: the engine still
 * applies the source directorPlan's per-turn cues, the learner persona/profile, and the
 * withheld secret; only the tutor turns are replayed verbatim instead of generated.
 *
 * The directorPlan must come from the SOURCE run (regenerating it = a different scene =
 * a confounded counterfactual). Load it from the run's `.full.md` (## Director Scene
 * Card block) or a persisted `.json`.
 *
 * Usage:
 *   node scripts/replay-one-side.js \
 *     --director-plan exports/oedipus-d5-full/run3/socratic.full.md \
 *     --source-transcript exports/oedipus-d5-full/run3/sample/socratic/T01.txt \
 *     --spec config/poetics-calibration/oedipus-pilot-v2.yaml --scenario D_OED5 \
 *     --side learner --generator api --model sonnet --repeats 8 \
 *     --out exports/replay-d5-run3-socratic
 *   (--generator mock for a free plumbing check)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { makeRouterLlmCall } from './generate-pedagogical-dramas.js';
import { runInteraction } from '../services/learnerTutorInteractionEngine.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

function parseArgs(argv) {
  const a = {
    directorPlan: null,
    source: null,
    spec: null,
    scenario: null,
    side: 'learner',
    generator: 'mock',
    model: 'sonnet',
    repeats: 1,
    out: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--director-plan') a.directorPlan = path.resolve(argv[++i]);
    else if (t === '--source-transcript' || t === '--source') a.source = path.resolve(argv[++i]);
    else if (t === '--spec') a.spec = path.resolve(argv[++i]);
    else if (t === '--scenario' || t === '--only') a.scenario = argv[++i];
    else if (t === '--side') a.side = argv[++i];
    else if (t === '--generator') a.generator = argv[++i];
    else if (t === '--model') a.model = argv[++i];
    else if (t === '--repeats') a.repeats = parseInt(argv[++i], 10);
    else if (t === '--out') a.out = path.resolve(argv[++i]);
  }
  if (!a.directorPlan) throw new Error('--director-plan <.full.md|.json> required (the SOURCE scene, held fixed)');
  if (!a.source) throw new Error('--source-transcript <T01.txt> required (the frozen tutor turns)');
  if (!a.spec) throw new Error('--spec required');
  if (!a.scenario) throw new Error('--scenario <id> required');
  if (a.side !== 'learner')
    throw new Error('v1 supports --side learner only (tutor side needs a scriptedLearnerTurns hook)');
  return a;
}

// directorPlan from a run's `.full.md` (## Director Scene Card yaml block) or a `.json`.
function loadDirectorPlan(p) {
  const raw = fs.readFileSync(p, 'utf8');
  if (p.endsWith('.json')) return JSON.parse(raw);
  const m = raw.match(/## Director Scene Card\s*```yaml\s*\n([\s\S]*?)\n```/);
  if (!m) throw new Error(`no "## Director Scene Card" yaml block in ${p}`);
  return yaml.parse(m[1]);
}

// frozen tutor external messages, in order, from the public T01.txt
function frozenTutorTurns(p) {
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  const blocks = [];
  let cur = null;
  for (const ln of lines) {
    const mm = ln.match(/^(LEARNER|TUTOR|STAGE):\s?(.*)$/);
    if (mm) {
      if (cur) blocks.push(cur);
      cur = { role: mm[1], lines: [mm[2]] };
    } else if (cur) cur.lines.push(ln);
  }
  if (cur) blocks.push(cur);
  return blocks
    .filter((b) => b.role === 'TUTOR')
    .map((b) => b.lines.join('\n').trim())
    .filter(Boolean);
}

async function run(args) {
  const spec = yaml.parse(fs.readFileSync(args.spec, 'utf8'));
  const d = (spec.dramas || spec.scenarios || []).find((x) => x.id === args.scenario);
  if (!d) throw new Error(`scenario ${args.scenario} not found in ${args.spec}`);
  if (!d.secret) throw new Error(`scenario ${args.scenario} has no secret block (not a guided-discovery scenario)`);

  const directorPlan = loadDirectorPlan(args.directorPlan);
  directorPlan._secret = d.secret; // engine's runLearnerPhase reads directorPlan._secret
  const tutorTurns = frozenTutorTurns(args.source);
  if (!tutorTurns.length) throw new Error(`no TUTOR turns parsed from ${args.source}`);

  const backend = args.generator === 'mock' ? 'claude' : args.generator;
  const llmCall = makeRouterLlmCall({
    roleMap: {},
    fallback: backend,
    claudeModelAlias: args.model,
    claudeEffort: null,
    apiModelKey: args.model,
    mock: args.generator === 'mock',
  });

  const config = {
    learnerId: `replay-${args.scenario}`,
    personaId: d.persona,
    tutorProfile: d.tutor_profile || 'default',
    topic: d.topic,
    scenario: { name: d.scenario_name, learnerStartState: d.learner_start_state, directorPlan },
    sessionId: 'replay',
  };

  const outDir = args.out || path.join(ROOT, 'exports', `replay-${args.scenario}-${args.side}`);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(
    `\n== one-side replay · ${args.scenario} · regenerate LEARNER vs frozen tutor (${tutorTurns.length} turns) · ${args.generator}/${args.model} · K=${args.repeats} ==`,
  );
  const results = [];
  for (let k = 1; k <= args.repeats; k++) {
    // per-replay retry: a network drop on one replay shouldn't lose the whole batch
    let trace = null;
    for (let attempt = 1; attempt <= 4 && !trace; attempt++) {
      try {
        trace = await runInteraction(config, llmCall, {
          directorPlan,
          learnerProfile: d.learner_profile,
          scriptedTutorTurns: tutorTurns,
          maxTurns: tutorTurns.length,
          // play out ALL frozen tutor turns even if a turn reads as a close — matches the
          // generator's branch loop (forceMaxTurns: true); else a learner that ends early
          // never reaches the later metering turns and the replay is invalid.
          forceMaxTurns: true,
          observeInternals: false,
        });
      } catch (err) {
        console.error(`  replay ${k} attempt ${attempt}/4 failed: ${String(err.message || err).slice(0, 120)}`);
        if (attempt < 4 && args.generator !== 'mock') await new Promise((r) => setTimeout(r, 120000));
      }
    }
    if (!trace) {
      console.error(`  replay ${k} gave up after 4 attempts — skipping`);
      results.push({ k, learnerTurns: 0, finalLearner: null, error: 'gave_up' });
      continue;
    }
    const learnerTurns = (trace.turns || []).filter((t) => t.phase === 'learner');
    const finalLearner = learnerTurns.length ? learnerTurns[learnerTurns.length - 1].externalMessage : '';
    const pub = (trace.turns || [])
      .map((t) => `${String(t.phase || '').toUpperCase()}: ${t.externalMessage}`)
      .join('\n\n');
    fs.writeFileSync(path.join(outDir, `replay-${k}.txt`), pub, 'utf8');
    results.push({ k, learnerTurns: learnerTurns.length, finalLearner });
    console.log(
      `  replay ${k}/${args.repeats}: ${learnerTurns.length} learner turns · final: "${finalLearner.replace(/\s+/g, ' ').slice(0, 90)}…"`,
    );
  }

  fs.writeFileSync(
    path.join(outDir, 'replays.json'),
    `${JSON.stringify(
      {
        generated: new Date().toISOString(),
        scenario: args.scenario,
        side: args.side,
        generator: args.generator,
        model: args.model,
        frozenTutorTurns: tutorTurns.length,
        repeats: args.repeats,
        source: path.relative(ROOT, args.source),
        directorPlan: path.relative(ROOT, args.directorPlan),
        results,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`\n  wrote ${args.repeats} replay transcript(s) + replays.json → ${path.relative(ROOT, outDir)}`);
  console.log(
    `  next: graded-score the replays (scripts/critic-poetics-omniscient-graded.js) → the grade DISTRIBUTION = structural-cap vs learner-draw.\n`,
  );
  return { outDir, results };
}

if (path.resolve(process.argv[1] || '') === __filename) {
  run(parseArgs(process.argv.slice(2))).catch((err) => {
    console.error(err?.stack || String(err));
    process.exit(1);
  });
}

export { parseArgs, loadDirectorPlan, frozenTutorTurns, run };
