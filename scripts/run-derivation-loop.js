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
 *     [--stall-watch]                  (requires --superego; charter v3 — the
 *                                       watcher also holds the learner's rules
 *                                       and fires on stalled inferences: the
 *                                       quasi-logical-ToM experiment, notes/
 *                                       poetics/2026-06-10-stall-watcher-*.md)
 *     [--group <name>]                 (named experimental condition; persisted
 *                                       to diagnosis.json, grouped in the
 *                                       scriptorium index)
 *     [--critic-feedback off|latest|<label>]
 *                                      (fold a previous run's critic notice —
 *                                       its closing judgment paragraph — into
 *                                       the director + superego charters as
 *                                       labeled counsel; never into the tutor
 *                                       ego, the pinned iteration artifact.
 *                                       "latest" = most recent same-group run
 *                                       with a notice on file; default off)
 *     [--learner-voice "<text>"]       (override the world's learner voice —
 *                                       personality/tonality variation; never
 *                                       carries plot content)
 *     [--decay '<json>'|off]           (the unreliable-learner condition:
 *                                       seeded parametric decay of the
 *                                       learner's grounded board — harness-
 *                                       implemented, never prompt-roleplayed.
 *                                       JSON keys: seed, rate, graceTurns,
 *                                       maxConcurrent, startTurn (defaults in
 *                                       corruption.js). Run-level condition;
 *                                       worlds stay frozen. Design note:
 *                                       notes/poetics/2026-06-10-unreliable-
 *                                       learner-design.md)
 *     [--decay-visibility told|conduct] (who learns of decay: told = the tutor
 *                                       ego prompt carries the SLIPPED block
 *                                       (default); conduct = block suppressed,
 *                                       the tutor must read decay off the
 *                                       learner's behaviour. Engine view and
 *                                       instruments keep ground truth in both.
 *                                       The registered visibility contrast:
 *                                       UNRELIABLE-LEARNER-PREREG.md §7 G3)
 *     [--critic auto|real|mock|off]    (post-run critic's notice; auto = follow
 *                                       the run mode — real dramas get the
 *                                       Fable notice, mock dramas the
 *                                       deterministic template. The critic is
 *                                       pinned to claude/claude-fable-5;
 *                                       DERIVATION_CRITIC_* overrides. Its
 *                                       notice gates nothing — the verdict
 *                                       stays the checker's.)
 *     [--note "what this iteration changes"]
 *
 * Artifacts land in <out>/<label>/: transcript.md (the drama, movement by
 * movement, instrument panel at the foot, critic's notice at the very end),
 * diagnosis.json (taxonomy verdict, D(t), release adherence, staging,
 * dialogue discipline, usage/cost), result.json (the raw engine output),
 * commentary.md (the critic's notice, standalone).
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadWorld,
  plotLint,
  runDrama,
  normalizeDecayConfig,
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
  runCritic,
  commentaryFileMd,
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

/**
 * The critic-feedback loop (stall-watcher note §4): fold a previous run's
 * notice — its FINAL paragraph, by the critic charter's construction the
 * judgment naming the one change the next performance should make — into the
 * director + superego charters as labeled counsel. Same-group only
 * (cross-group inheritance would contaminate the ON/OFF contrast); the run's
 * own label is excluded; NEVER the tutor ego (the pinned iteration artifact).
 * Returns { source, paragraph } or null; throws rather than silently running
 * uncounseled — diagnosis.json and the charters must never disagree.
 */
function resolveCounsel(baseDir, { request, group, ownLabel }) {
  if (!request || request === 'off') return null;
  const lastParagraph = (file) => {
    const paragraphs = fs
      .readFileSync(file, 'utf8')
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p && !p.startsWith('# ') && !p.startsWith('> critic'));
    return paragraphs.length ? paragraphs[paragraphs.length - 1] : null;
  };
  const runGroup = (dir) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, 'diagnosis.json'), 'utf8')).group ?? null;
    } catch {
      return null;
    }
  };
  if (request !== 'latest') {
    const file = path.join(baseDir, request, 'commentary.md');
    if (!fs.existsSync(file)) throw new Error(`--critic-feedback ${request}: no notice on file at ${file}`);
    const sourceGroup = runGroup(path.join(baseDir, request));
    if (sourceGroup !== group) {
      throw new Error(
        `--critic-feedback ${request}: cross-group counsel forbidden (source group ${JSON.stringify(sourceGroup)}, this run ${JSON.stringify(group)})`,
      );
    }
    const paragraph = lastParagraph(file);
    if (!paragraph) throw new Error(`--critic-feedback ${request}: notice at ${file} has no closing paragraph`);
    return { source: request, paragraph };
  }
  const candidates = !fs.existsSync(baseDir)
    ? []
    : fs
        .readdirSync(baseDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name !== ownLabel)
        .map((e) => path.join(baseDir, e.name))
        .filter((dir) => fs.existsSync(path.join(dir, 'commentary.md')) && runGroup(dir) === group)
        .sort(
          (a, b) =>
            fs.statSync(path.join(b, 'commentary.md')).mtimeMs - fs.statSync(path.join(a, 'commentary.md')).mtimeMs,
        );
  if (!candidates.length) {
    throw new Error(
      `--critic-feedback latest: no prior run in group ${JSON.stringify(group)} has a notice on file under ${baseDir} (a group's first arm runs with --critic-feedback off)`,
    );
  }
  const source = path.basename(candidates[0]);
  const paragraph = lastParagraph(path.join(candidates[0], 'commentary.md'));
  if (!paragraph) throw new Error(`--critic-feedback latest: notice for ${source} has no closing paragraph`);
  return { source, paragraph };
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
  // Normalized up front so a malformed --decay JSON dies here as a CLI error,
  // not twelve turns into a run. 'off' is accepted for matrix-arm overrides.
  const decayArg = arg('decay', null);
  const decay = decayArg && decayArg !== 'off' ? normalizeDecayConfig(decayArg) : null;
  // Who learns of decay, and how: 'told' = the tutor ego prompt carries the
  // SLIPPED block (v1 behaviour, default); 'conduct' = the block is suppressed
  // and the tutor can read decay only off the learner's behaviour. The engine
  // and instruments keep ground truth either way (the manipulation is textual).
  const decayVisibility = arg('decay-visibility', 'told');
  if (!['told', 'conduct'].includes(decayVisibility)) {
    console.error(`--decay-visibility must be "told" or "conduct" (got "${decayVisibility}")`);
    process.exit(1);
  }
  if (decayVisibility === 'conduct' && !decay) {
    console.error('--decay-visibility conduct without --decay is a no-op — refusing (probable arm-B typo)');
    process.exit(1);
  }
  const superego = flag('superego');
  const stallWatch = flag('stall-watch');
  if (stallWatch && !superego) {
    console.error('--stall-watch requires --superego (the stall jurisdiction is a clause of the watcher charter)');
    process.exit(1);
  }
  const group = arg('group', null);
  const criticFeedback = arg('critic-feedback', 'off');
  const criticArg = arg('critic', 'auto');
  if (!['auto', 'real', 'mock', 'off'].includes(criticArg)) {
    console.error(`--critic must be "auto", "real", "mock" or "off" (got "${criticArg}")`);
    process.exit(1);
  }
  // auto = the critic follows the run: real dramas get the Fable notice, mock
  // dramas the deterministic template (so smokes exercise the same plumbing).
  const criticMode = criticArg === 'auto' ? mode : criticArg;
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
  const loopBaseDir = path.resolve(ROOT, arg('out', 'exports/dramatic-derivation/loop'));
  const outDir = path.join(loopBaseDir, label);
  const counsel = resolveCounsel(loopBaseDir, { request: criticFeedback, group, ownLabel: label });

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
    console.log(
      stallWatch
        ? "tutor   superego ON + stall-watch — charter v3: the watcher also holds the learner's rules and fires on stalled inferences"
        : 'tutor   superego ON — the tutor watches its own manner (draft → note → restaging)',
    );
  }
  if (group) console.log(`group   ${group}`);
  if (counsel) console.log(`counsel from ${counsel.source} → director + superego charters (closing paragraph)`);
  if (learnerVoice) console.log(`voice   learner override: ${learnerVoice}`);
  if (decay) {
    console.log(
      `decay   seed ${decay.seed} · rate ${decay.rate} · grace ${decay.graceTurns} · maxConcurrent ${decay.maxConcurrent} · from turn ${decay.startTurn}`,
    );
    console.log(
      decayVisibility === 'conduct'
        ? 'decay   visibility CONDUCT — SLIPPED block suppressed; the tutor must read decay off the learner'
        : 'decay   visibility told — the tutor ego prompt carries the SLIPPED block',
    );
  }

  const client = makeLlmClient({ mode });
  const counselText = counsel ? counsel.paragraph : null;
  const roles = {
    director: makeLlmDirector(world, client, { dials, dramaturgy, counsel: counselText }),
    tutor: makeLlmTutor(world, client, { script, dials, superego, stallWatch, counsel: counselText, decayVisibility }),
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
    for (const e of s.events) {
      if (e.type === 'decay' || e.type === 'repair') continue; // dedicated bits below carry the ids
      bits.push(`⚑ ${e.type}`);
    }
    if (s.decayedNow?.length) bits.push(`☄ ${s.decayedNow.join(', ')} fades`);
    if (s.repairedNow?.length) bits.push(`✚ ${s.repairedNow.join(', ')} restored`);
    if (s.endedBy) bits.push(`— ends: ${s.endedBy}`);
    console.log(bits.join('  '));
  };

  const started = Date.now();
  const result = await runDrama({ world, roles, options: { onTurn, ...(decay ? { decay } : {}) } });
  const elapsedMs = Date.now() - started;
  const usage = client.usage();
  const diagnosis = {
    label,
    group,
    note,
    scriptPath: path.relative(ROOT, scriptPath),
    worldPath: path.relative(ROOT, worldPath),
    backend: { mode, roles: targets },
    dials,
    dramaturgy,
    tutorSuperego: superego,
    tutorStallWatch: stallWatch,
    criticFeedback: counsel,
    learnerVoice: learnerVoice || null,
    // Normalized (defaults filled), so an episode inheriting this run's decay
    // condition (run-derivation-episode.js --from) reproduces it exactly.
    decay: decay || null,
    decayVisibility,
    elapsedMs,
    usage,
    ...diagnose(result, world),
  };

  // Drama artifacts land before the critic runs: a critic failure (CLI not
  // installed, quota window closed) must never cost the run itself.
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'diagnosis.json'), `${JSON.stringify(diagnosis, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);

  let commentaryEmbed = null;
  if (criticMode !== 'off') {
    try {
      if (criticMode === 'real') console.log('\ncritic  reading the performance…');
      const notice = await runCritic({ result, diagnosis, world, label, mode: criticMode });
      const by = `${notice.target.provider}/${notice.target.model || '(cli default)'}`;
      fs.writeFileSync(
        path.join(outDir, 'commentary.md'),
        commentaryFileMd({ label, commentary: notice.commentary, target: notice.target }),
      );
      commentaryEmbed = [`*— notice by ${by}*`, '', notice.commentary].join('\n');
      if (criticMode === 'real') console.log(`critic  notice by ${by} in ${(notice.elapsedMs / 1000).toFixed(1)}s`);
    } catch (err) {
      console.warn(`critic  FAILED (run artifacts are intact): ${err.message}`);
      console.warn(`        backfill later: npm run derivation:critic -- --label ${label}`);
    }
  }

  fs.writeFileSync(
    path.join(outDir, 'transcript.md'),
    renderTranscript(result, world, { title: `${world.title} — ${label}`, diagnosis, commentary: commentaryEmbed }),
  );

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
  if (diagnosis.corruption) {
    const c = diagnosis.corruption;
    console.log(
      `decay   ${c.decayEvents} slips, ${c.repairs.total} repaired (tutor ${c.repairs.byTutor}, re-adoption ${c.repairs.byReadoption}), ${c.unrepairedAtEnd} unrepaired at end, degraded-turn integral ${c.degradedTurnIntegral}, D reversals ${c.dReversals}`,
    );
  }
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
  console.log(
    `artifacts ${path.relative(ROOT, outDir)}/{transcript.md, diagnosis.json, result.json${commentaryEmbed ? ', commentary.md' : ''}}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
