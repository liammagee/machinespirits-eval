#!/usr/bin/env node
/**
 * Episode replay shell — "change this one condition and re-run" without
 * waiting out the whole drama (notes/poetics/2026-06-10-unreliable-learner-
 * design.md, Build A). Replays a recorded run's role outputs for turns
 * 1..N-1 (instant, zero calls), hands the roles live to the normal bridges
 * at turn N, and stops after a bounded window. A 25-minute question becomes
 * a 1–2 minute one.
 *
 * Conditions are INHERITED from the source run's diagnosis.json — script,
 * dials, dramaturgy, superego, stall-watch, learner voice, counsel, decay,
 * decay visibility, acts, reconstruct, release/guard dials, and plot/throughline
 * dials — and only the flags you pass override them. The world is never overridable:
 * replay into a different world is undefined. The backend mode never
 * inherits: episodes are mock unless --real is given (a --from <real run>
 * must not silently spawn paid calls).
 *
 * Usage:
 *   node scripts/run-derivation-episode.js
 *     --from <label|dir|result.json>   (loop label, episodes label, or path)
 *     --turn N                         (first LIVE turn; 1..turnsPlayed+1)
 *     [--window K]                     (live turns to play; default 3)
 *     [--real]                         (paid calls; default mock)
 *     [--script <path>]                (try a new tutor script mid-drama)
 *     [--recognition 0-3] [--charisma 0-3]
 *     [--dramaturgy free|frozen]
 *     [--superego on|off] [--stall-watch on|off]
 *     [--learner-voice "<text>"]
 *     [--decay '<json>'|off]           (run-level decay condition — corruption.js)
 *     [--decay-visibility told|conduct] (conduct = SLIPPED block hidden from tutor;
 *                                       acts mode implies conduct)
 *     [--acts '<json>'|off]            (stage v2 acts condition — engine.js
 *                                       normalizeActsConfig; changing it
 *                                       reshapes the prefix from turn 1)
 *     [--scene-mode '<json>'|on|off]   (inherits source scene mode; use JSON
 *                                       such as {"recognitionNeed":false} to
 *                                       ablate only dialogical pressure)
 *     [--director-cadence turn|scene]  (inherits source cadence)
 *     [--stage-prologue on|off]        (inherits source prologue flag)
 *     [--register default|modern|period|sample|off]
 *     [--reconstruct on|off]           (adapt-ON arm dial; requires acts mode)
 *     [--confront on|off]
 *     [--repair-clause on|off]
 *     [--release-authority on|off]
 *     [--pacing-guard on|off]
 *     [--pacing-guard-visible on|off]
 *     [--pacing-guard-selective on|off]
 *     [--pacing-guard-selective-v1 on|off]
 *     [--pacing-guard-selective-v2 on|off]
 *     [--pacing-guard-selective-v3 on|off]
 *     [--pacing-guard-selective-v4 on|off] (implies conduct-policy enforcement
 *                                       unless --conduct-policy-enforce off)
 *     [--same-turn-assertion-affordance on|off]
 *     [--proof-debt-guard on|off]
 *     [--conduct-policy on|off]
 *     [--conduct-policy-enforce on|off]
 *     [--compiled-guard on|off]
 *     [--plot on|off] [--throughline on|off]
 *     [--critic auto|real|mock|off]    (default off — episodes are scratch
 *                                       iterations; promote keepers to a full
 *                                       loop run for the archived notice)
 *     [--label <name>] [--out exports/dramatic-derivation/episodes]
 *     [--note "what this episode probes"]
 *
 * After the run the replayed prefix is VERIFIED against the recording
 * (replay.js comparePrefix): trajectory, release ledger, and event stream
 * must match field-for-field. Divergence is loud — and expected in exactly
 * one case: a condition change that reaches back into the prefix (a decay
 * schedule with startTurn < --turn). The report says which.
 *
 * Artifacts land in <out>/<label>/ in the loop run shape (diagnosis.json,
 * result.json, transcript.md [+ commentary.md]) plus episode.json — so an
 * episode can itself be a --from source for the next episode.
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
  makeReplayRoles,
  comparePrefix,
  normalizeDecayConfig,
  normalizeActsConfig,
  normalizeSceneConfig,
  normalizeDirectorCadence,
  normalizePublicRegister,
  diagnose,
  renderDCurve,
  renderTranscript,
  runCritic,
  commentaryFileMd,
  buildWorldIR,
  compileGuardSpec,
  selectGuardRepresentation,
  selectGuardRepresentationV1,
  selectGuardRepresentationV2,
  selectGuardRepresentationV3,
  selectGuardRepresentationV4,
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

function atomicWriteJson(file, value) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

function factLabel(fact) {
  return Array.isArray(fact) ? fact.join(' ') : String(fact || '');
}

function liveTurnRecord(summary) {
  const line = (entry) => ({
    role: entry.role,
    text: entry.text || '',
    ...(entry.meta ? { meta: entry.meta } : {}),
  });
  return {
    turn: summary.turn,
    turnCap: summary.turnCap,
    D: summary.D,
    forced: summary.forced,
    released: (summary.released || []).map(factLabel),
    adopted: summary.adopted || 0,
    retracted: summary.retracted || 0,
    derived: summary.derived || 0,
    overreached: summary.overreached || 0,
    hypothesis: Boolean(summary.hypothesis),
    asserted: Boolean(summary.asserted),
    intervened: Boolean(summary.intervened),
    phase: summary.phase || null,
    act: summary.act || null,
    events: summary.events || [],
    lines: (summary.lines || []).map(line),
    ...(summary.decayedNow?.length ? { decayedNow: summary.decayedNow } : {}),
    ...(summary.repairedNow?.length ? { repairedNow: summary.repairedNow } : {}),
    ...(summary.decayActive !== undefined ? { decayActive: summary.decayActive } : {}),
    ...(typeof summary.F === 'number' ? { F: summary.F } : {}),
    ...(summary.endedBy ? { endedBy: summary.endedBy } : {}),
  };
}

function createLiveRunPublisher(outDir, initial) {
  const livePath = path.join(outDir, 'live.json');
  const now = new Date().toISOString();
  const state = {
    schema: 'dramatic-derivation.live.v1',
    status: 'running',
    startedAt: now,
    updatedAt: now,
    turns: [],
    ...initial,
  };
  const write = () => {
    fs.mkdirSync(outDir, { recursive: true });
    state.updatedAt = new Date().toISOString();
    atomicWriteJson(livePath, state);
  };
  return {
    file: livePath,
    start() {
      write();
    },
    turn(summary) {
      const record = liveTurnRecord(summary);
      state.status = 'running';
      state.latest = record;
      state.turns = state.turns.filter((t) => t.turn !== record.turn);
      state.turns.push(record);
      state.turns.sort((a, b) => a.turn - b.turn);
      write();
    },
    finalizing() {
      state.status = 'finalizing';
      write();
    },
    complete({ result, diagnosis }) {
      state.status = 'complete';
      state.verdict = result.verdict;
      state.turnsPlayed = result.turnsPlayed;
      state.firstForcedTurn = result.firstForcedTurn;
      state.assertedGroundedTurn = result.assertedGroundedTurn;
      state.elapsedMs = diagnosis.elapsedMs;
      state.usage = diagnosis.usage;
      state.episode = diagnosis.episode;
      write();
    },
    fail(error) {
      state.status = 'failed';
      state.error = error?.stack || error?.message || String(error);
      write();
    },
  };
}

/** on|off|inherit tri-state for booleans whose default is the source run's value. */
function triState(name, inherited) {
  const v = arg(name, null);
  if (v === null) return inherited;
  if (v === 'on') return true;
  if (v === 'off') return false;
  console.error(`--${name} must be "on" or "off" (got "${v}")`);
  process.exit(1);
}

/**
 * Resolve --from to a run directory holding result.json + diagnosis.json.
 * Accepts a path (directory or result.json file) or a bare label searched
 * under the loop and episodes export trees.
 */
function resolveSource(from) {
  const candidates = [];
  const asPath = path.resolve(ROOT, from);
  if (fs.existsSync(asPath)) {
    candidates.push(fs.statSync(asPath).isDirectory() ? asPath : path.dirname(asPath));
  } else {
    for (const base of ['exports/dramatic-derivation/loop', 'exports/dramatic-derivation/episodes']) {
      candidates.push(path.resolve(ROOT, base, from));
    }
  }
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'result.json')) && fs.existsSync(path.join(dir, 'diagnosis.json'))) {
      return {
        dir,
        label: path.basename(dir),
        result: JSON.parse(fs.readFileSync(path.join(dir, 'result.json'), 'utf8')),
        diagnosis: JSON.parse(fs.readFileSync(path.join(dir, 'diagnosis.json'), 'utf8')),
      };
    }
  }
  console.error(`--from ${from}: no run found (need result.json + diagnosis.json; looked at ${candidates.join(', ')})`);
  process.exit(1);
}

async function main() {
  if (flag('world') || arg('world', null)) {
    console.error('--world is not an episode condition: replaying role outputs into a different world is undefined.');
    console.error('Start a fresh run with scripts/run-derivation-loop.js instead.');
    process.exit(1);
  }
  const from = arg('from', null);
  const fromTurn = Number(arg('turn', NaN));
  if (!from || !Number.isInteger(fromTurn) || fromTurn < 1) {
    console.error('required: --from <label|dir|result.json> and --turn N (first live turn, integer >= 1)');
    process.exit(1);
  }
  const window = Number(arg('window', 3));
  if (!Number.isInteger(window) || window < 1) {
    console.error(`--window must be an integer >= 1 (got ${arg('window', '3')})`);
    process.exit(1);
  }

  const src = resolveSource(from);
  const srcDiag = src.diagnosis;
  if (fromTurn > (src.result.turnsPlayed ?? 0) + 1) {
    console.error(
      `--turn ${fromTurn} is beyond the recording: ${src.label} played ${src.result.turnsPlayed} turns (max usable --turn is ${src.result.turnsPlayed + 1})`,
    );
    process.exit(1);
  }

  // --- conditions: inherit from the source, override only what was named ---
  const mode = flag('real') ? 'real' : llmMode() === 'real' ? 'real' : 'mock';
  const overrides = [];
  const track = (name, value, inherited) => {
    if (value !== inherited) overrides.push(name);
    return value;
  };
  const scriptPath = path.resolve(ROOT, track('script', arg('script', srcDiag.scriptPath), srcDiag.scriptPath));
  const dials = {
    recognition: track(
      'recognition',
      clampDial(arg('recognition', srcDiag.dials?.recognition ?? 0)),
      srcDiag.dials?.recognition ?? 0,
    ),
    charisma: track('charisma', clampDial(arg('charisma', srcDiag.dials?.charisma ?? 0)), srcDiag.dials?.charisma ?? 0),
  };
  const dramaturgy = track('dramaturgy', arg('dramaturgy', srcDiag.dramaturgy ?? 'free'), srcDiag.dramaturgy ?? 'free');
  if (!['free', 'frozen'].includes(dramaturgy)) {
    console.error(`--dramaturgy must be "free" or "frozen" (got "${dramaturgy}")`);
    process.exit(1);
  }
  const superego = track(
    'superego',
    triState('superego', Boolean(srcDiag.tutorSuperego)),
    Boolean(srcDiag.tutorSuperego),
  );
  const stallWatch = track(
    'stall-watch',
    triState('stall-watch', Boolean(srcDiag.tutorStallWatch)),
    Boolean(srcDiag.tutorStallWatch),
  );
  if (stallWatch && !superego) {
    console.error('--stall-watch on requires the superego (inherit it or pass --superego on)');
    process.exit(1);
  }
  const learnerVoice = track(
    'learner-voice',
    arg('learner-voice', srcDiag.learnerVoice ?? null),
    srcDiag.learnerVoice ?? null,
  );
  const decayArg = arg('decay', null);
  const inheritedDecay = srcDiag.decay ?? null;
  const decay = decayArg === null ? inheritedDecay : decayArg === 'off' ? null : normalizeDecayConfig(decayArg);
  if (decayArg !== null) overrides.push('decay');
  // Stage v2 acts condition + adapt-ON arm dial, inherited like decay (an
  // episode --from an acts recording replays its act boundaries verbatim —
  // the recorded director verdicts drive the prefix deterministically).
  const actsArg = arg('acts', null);
  const inheritedActs = srcDiag.actsConfig ?? null;
  const acts = actsArg === null ? inheritedActs : actsArg === 'off' ? null : normalizeActsConfig(actsArg);
  if (actsArg !== null) overrides.push('acts');
  const sceneArg = arg('scene-mode', null);
  const inheritedSceneMode = srcDiag.sceneMode ?? null;
  const sceneMode =
    sceneArg === null
      ? inheritedSceneMode
      : sceneArg === 'off'
        ? null
        : normalizeSceneConfig(sceneArg && sceneArg !== 'on' ? sceneArg : true);
  if (sceneArg !== null) overrides.push('scene-mode');
  const directorCadence = track(
    'director-cadence',
    normalizeDirectorCadence(arg('director-cadence', srcDiag.directorCadence ?? null), { sceneMode: Boolean(sceneMode) }),
    srcDiag.directorCadence ?? (sceneMode ? 'scene' : 'turn'),
  );
  const stagePrologueArg = arg('stage-prologue', null);
  const inheritedStagePrologue = Boolean(srcDiag.stagePrologue);
  const stagePrologue =
    stagePrologueArg === null ? inheritedStagePrologue : stagePrologueArg !== 'off' && stagePrologueArg !== 'false';
  if (stagePrologueArg !== null) overrides.push('stage-prologue');
  const registerArg = arg('register', null);
  const publicRegister =
    registerArg === null
      ? srcDiag.publicRegister || null
      : registerArg === 'off'
        ? null
        : normalizePublicRegister(registerArg, { sceneMode: Boolean(sceneMode), rhetoricalPolicy: false });
  if (registerArg !== null) overrides.push('register');
  const reconstruct = track(
    'reconstruct',
    triState('reconstruct', Boolean(srcDiag.reconstruct)),
    Boolean(srcDiag.reconstruct),
  );
  if (reconstruct && !acts) {
    console.error('--reconstruct on requires acts mode (inherit it from an acts source or pass --acts)');
    process.exit(1);
  }
  const decayVisibilityArg = arg('decay-visibility', null);
  const inheritedVisibility = srcDiag.decayVisibility ?? 'told';
  if (decayVisibilityArg && !['told', 'conduct'].includes(decayVisibilityArg)) {
    console.error(`--decay-visibility must be "told" or "conduct" (got "${decayVisibilityArg}")`);
    process.exit(1);
  }
  if (acts && decayVisibilityArg === 'told') {
    console.error(
      '--decay-visibility told cannot run in acts mode — the SLIPPED block reads a corruption view the acts-mode tutor no longer has (omit the flag; acts mode implies conduct)',
    );
    process.exit(1);
  }
  const decayVisibility = track(
    'decay-visibility',
    decayVisibilityArg ?? (acts && inheritedVisibility === 'told' ? 'conduct' : inheritedVisibility),
    inheritedVisibility,
  );
  const confront = track('confront', triState('confront', Boolean(srcDiag.confront)), Boolean(srcDiag.confront));
  if (confront && !superego) {
    console.error('--confront on requires the superego (inherit it or pass --superego on)');
    process.exit(1);
  }
  if (confront && !acts) {
    console.error('--confront on requires acts mode (inherit it from an acts source or pass --acts)');
    process.exit(1);
  }
  if (confront && stallWatch) {
    console.error('--confront on and --stall-watch on cannot combine in this derivation engine');
    process.exit(1);
  }
  const repairClause = track(
    'repair-clause',
    triState('repair-clause', Boolean(srcDiag.repairClause)),
    Boolean(srcDiag.repairClause),
  );
  if (repairClause && !confront) {
    console.error('--repair-clause on requires --confront on');
    process.exit(1);
  }
  if (repairClause && !decay) {
    console.error('--repair-clause on requires decay (inherit it or pass --decay)');
    process.exit(1);
  }
  const releaseAuthority = track(
    'release-authority',
    triState('release-authority', Boolean(srcDiag.releaseAuthority)),
    Boolean(srcDiag.releaseAuthority),
  );
  const inheritedSelectorActive = Boolean(
    srcDiag.pacingGuardSelector ||
      srcDiag.pacingGuardSelective ||
      srcDiag.pacingGuardSelectiveV1 ||
      srcDiag.pacingGuardSelectiveV2 ||
      srcDiag.pacingGuardSelectiveV3 ||
      srcDiag.pacingGuardSelectiveV4,
  );
  const inheritedExplicitPacingGuard = Boolean(srcDiag.pacingGuard) && !inheritedSelectorActive;
  const inheritedExplicitVisibleGuard = Boolean(srcDiag.visibleGuard) && !inheritedSelectorActive;
  const requestedPacingGuard = track(
    'pacing-guard',
    triState('pacing-guard', inheritedExplicitPacingGuard),
    inheritedExplicitPacingGuard,
  );
  const requestedVisibleGuard = track(
    'pacing-guard-visible',
    triState('pacing-guard-visible', inheritedExplicitVisibleGuard),
    inheritedExplicitVisibleGuard,
  );
  const pacingGuardSelective = track(
    'pacing-guard-selective',
    triState('pacing-guard-selective', Boolean(srcDiag.pacingGuardSelective)),
    Boolean(srcDiag.pacingGuardSelective),
  );
  const pacingGuardSelectiveV1 = track(
    'pacing-guard-selective-v1',
    triState('pacing-guard-selective-v1', Boolean(srcDiag.pacingGuardSelectiveV1)),
    Boolean(srcDiag.pacingGuardSelectiveV1),
  );
  const pacingGuardSelectiveV2 = track(
    'pacing-guard-selective-v2',
    triState('pacing-guard-selective-v2', Boolean(srcDiag.pacingGuardSelectiveV2)),
    Boolean(srcDiag.pacingGuardSelectiveV2),
  );
  const pacingGuardSelectiveV3 = track(
    'pacing-guard-selective-v3',
    triState('pacing-guard-selective-v3', Boolean(srcDiag.pacingGuardSelectiveV3)),
    Boolean(srcDiag.pacingGuardSelectiveV3),
  );
  const pacingGuardSelectiveV4 = track(
    'pacing-guard-selective-v4',
    triState('pacing-guard-selective-v4', Boolean(srcDiag.pacingGuardSelectiveV4)),
    Boolean(srcDiag.pacingGuardSelectiveV4),
  );
  const selectorCount = [
    pacingGuardSelective,
    pacingGuardSelectiveV1,
    pacingGuardSelectiveV2,
    pacingGuardSelectiveV3,
    pacingGuardSelectiveV4,
  ].filter(Boolean).length;
  if ((requestedPacingGuard || requestedVisibleGuard || selectorCount > 0) && !releaseAuthority) {
    console.error('pacing guards and selector arms require --release-authority on');
    process.exit(1);
  }
  if (requestedPacingGuard && requestedVisibleGuard) {
    console.error('--pacing-guard on and --pacing-guard-visible on are mutually exclusive');
    process.exit(1);
  }
  if (selectorCount > 1 || (selectorCount && (requestedPacingGuard || requestedVisibleGuard))) {
    console.error('choose exactly one pacing representation: explicit H, explicit V, or one selector version');
    process.exit(1);
  }
  const proofDebtGuard = track(
    'proof-debt-guard',
    triState('proof-debt-guard', Boolean(srcDiag.proofDebtGuard)),
    Boolean(srcDiag.proofDebtGuard),
  );
  if (proofDebtGuard && !repairClause) {
    console.error('--proof-debt-guard on requires --repair-clause on');
    process.exit(1);
  }
  const conductPolicyEnforceExplicit = arg('conduct-policy-enforce', null);
  const conductPolicyEnforceDefault = Boolean(srcDiag.conductPolicyEnforce) || pacingGuardSelectiveV4;
  const conductPolicyEnforce = track(
    'conduct-policy-enforce',
    triState('conduct-policy-enforce', conductPolicyEnforceDefault),
    Boolean(srcDiag.conductPolicyEnforce),
  );
  const requestedConductPolicy = track(
    'conduct-policy',
    triState('conduct-policy', Boolean(srcDiag.conductPolicy) || conductPolicyEnforce),
    Boolean(srcDiag.conductPolicy) || Boolean(srcDiag.conductPolicyEnforce),
  );
  const conductPolicy = requestedConductPolicy || conductPolicyEnforce || (pacingGuardSelectiveV4 && conductPolicyEnforceExplicit !== 'off');
  const compiledGuard = track(
    'compiled-guard',
    triState('compiled-guard', Boolean(srcDiag.compiledGuard)),
    Boolean(srcDiag.compiledGuard),
  );
  if (compiledGuard && selectorCount) {
    console.error('--compiled-guard on is not combined with selector arms in this selector slice');
    process.exit(1);
  }
  if (compiledGuard && !requestedPacingGuard && !proofDebtGuard) {
    console.error('--compiled-guard on requires explicit --pacing-guard on and/or --proof-debt-guard on');
    process.exit(1);
  }
  const plot = track('plot', triState('plot', Boolean(srcDiag.plotDial)), Boolean(srcDiag.plotDial));
  if (plot && !acts) {
    console.error('--plot on requires acts mode');
    process.exit(1);
  }
  if (plot && !superego) {
    console.error('--plot on requires the superego');
    process.exit(1);
  }
  const throughline = track(
    'throughline',
    triState('throughline', Boolean(srcDiag.throughlineDial)),
    Boolean(srcDiag.throughlineDial),
  );
  if (throughline && !plot) {
    console.error('--throughline on requires --plot on');
    process.exit(1);
  }
  // The counsel paragraph the source run folded into its charters is part of
  // its conditions — inherit the stored text verbatim (no re-resolution).
  const counsel = srcDiag.criticFeedback?.paragraph ?? null;
  const note = arg('note', null);
  const criticArg = arg('critic', 'off');
  if (!['auto', 'real', 'mock', 'off'].includes(criticArg)) {
    console.error(`--critic must be "auto", "real", "mock" or "off" (got "${criticArg}")`);
    process.exit(1);
  }
  const criticMode = criticArg === 'auto' ? mode : criticArg;
  if (mode === 'real' && process.env.DERIVATION_TRACE === undefined) process.env.DERIVATION_TRACE = '1';

  const worldPath = path.resolve(ROOT, srcDiag.worldPath);
  const world = loadWorld(worldPath);
  const lint = plotLint(world);
  if (!lint.ok) {
    console.error(`REFUSING TO RUN — plotLint failed for ${world.id}:`);
    for (const err of lint.errors) console.error(`  - ${err}`);
    process.exit(1);
  }

  const script = fs.readFileSync(scriptPath, 'utf8');
  const worldIR =
    compiledGuard ||
    pacingGuardSelective ||
    pacingGuardSelectiveV1 ||
    pacingGuardSelectiveV2 ||
    pacingGuardSelectiveV3 ||
    pacingGuardSelectiveV4
      ? buildWorldIR(world)
      : null;
  const pacingGuardSelector = pacingGuardSelective
    ? selectGuardRepresentation(worldIR)
    : pacingGuardSelectiveV1
      ? selectGuardRepresentationV1(worldIR, { decayEnabled: Boolean(decay) })
      : pacingGuardSelectiveV2
        ? selectGuardRepresentationV2(worldIR, { decayEnabled: Boolean(decay) })
        : pacingGuardSelectiveV3
          ? selectGuardRepresentationV3(worldIR, { decayEnabled: Boolean(decay) })
          : pacingGuardSelectiveV4
            ? selectGuardRepresentationV4(worldIR, { decayEnabled: Boolean(decay) })
          : null;
  const pacingGuard = pacingGuardSelector ? pacingGuardSelector.selected === 'hidden' : requestedPacingGuard;
  const visibleGuard = pacingGuardSelector ? pacingGuardSelector.selected === 'visible' : requestedVisibleGuard;
  const visiblePushProbeGuard = pacingGuardSelectiveV3;
  const visibleConsolidationGuard = pacingGuardSelectiveV4;
  const sameTurnAssertionAffordance = track(
    'same-turn-assertion-affordance',
    triState('same-turn-assertion-affordance', Boolean(srcDiag.sameTurnAssertionAffordance)),
    Boolean(srcDiag.sameTurnAssertionAffordance),
  );
  const assertionGroundingGate = pacingGuardSelectiveV4 || sameTurnAssertionAffordance;
  const guardSpec = compiledGuard ? compileGuardSpec(world, worldIR || buildWorldIR(world)) : null;
  const label = arg('label', `${src.label}-t${fromTurn}-${mode}-${timestamp()}`);
  const outDir = path.join(path.resolve(ROOT, arg('out', 'exports/dramatic-derivation/episodes')), label);
  const maxTurns = fromTurn - 1 + window;

  const ROLE_NAMES = ['director', 'tutor', ...(superego ? ['tutor_superego'] : []), 'learner'];
  const targets = Object.fromEntries(
    ROLE_NAMES.map((r) => [r, mode === 'real' ? resolveTarget(r) : { provider: 'mock', model: 'mock' }]),
  );
  const livePublisher = createLiveRunPublisher(outDir, {
    label,
    kind: 'episode',
    note,
    source: { label: src.label, dir: path.relative(ROOT, src.dir) },
    fromTurn,
    window,
    maxTurns,
    worldId: world.id,
    worldTitle: world.title,
    worldPath: path.relative(ROOT, worldPath),
    scriptPath: path.relative(ROOT, scriptPath),
    backend: { mode, roles: targets },
    turnCap: world.turnCap,
    dials,
    flags: {
      dramaturgy,
      tutorSuperego: superego,
      tutorStallWatch: stallWatch,
      decay: decay || null,
      decayVisibility,
      actsConfig: acts || null,
      sceneMode: sceneMode || null,
      directorCadence,
      stagePrologue,
      publicRegister,
      reconstruct,
      confront,
      repairClause,
      releaseAuthority,
      pacingGuard,
      pacingGuardSelective,
      pacingGuardSelectiveV1,
      pacingGuardSelectiveV2,
      pacingGuardSelectiveV3,
      pacingGuardSelectiveV4,
      pacingGuardSelector,
      visiblePushProbeGuard,
      visibleConsolidationGuard,
      assertionGroundingGate,
      sameTurnAssertionAffordance,
      visibleGuard,
      proofDebtGuard,
      conductPolicy,
      conductPolicyEnforce,
      compiledGuard,
      plotDial: plot,
      throughlineDial: throughline,
      overrides,
    },
  });
  livePublisher.start();
  console.log(`episode ${src.label} → live from turn ${fromTurn}, window ${window} (stops after turn ${maxTurns})`);
  console.log(`world   ${world.id} (lint PASS)`);
  console.log(`script  ${path.relative(ROOT, scriptPath)}`);
  console.log(`backend ${mode}${mode === 'real' ? '' : ' (zero-cost)'}`);
  if (mode === 'real') {
    for (const r of ROLE_NAMES)
      console.log(`          ${r.padEnd(14)} ${targets[r].provider}/${targets[r].model || '(cli default)'}`);
    console.log(`        live calls bounded by window: ≤${window * (superego ? 5 : 3) * 2}`);
  }
  if (decay) {
    console.log(
      `decay   seed ${decay.seed} rate ${decay.rate} grace ${decay.graceTurns} maxConcurrent ${decay.maxConcurrent} from turn ${decay.startTurn}${decay.mutateShare ? ` mutateShare ${decay.mutateShare}` : ''}${decay.pool === 'staged' ? ' pool staged' : ''}`,
    );
    if (decayVisibility === 'conduct') console.log('decay   visibility CONDUCT — SLIPPED block suppressed');
  }
  if (acts) {
    console.log(
      `acts    ON — min ${acts.minActTurns} · max ${acts.maxActTurns} turns per act${reconstruct ? ' · reconstruct ON (per-turn tutor theory, arm-internal)' : ''}`,
    );
  }
  if (sceneMode) {
    console.log(
      `scenes  ON — max ${sceneMode.maxExchanges} exchanges, phatic budget ${sceneMode.maxPhaticExchanges}, recognition pressure ${sceneMode.recognitionNeed === false ? 'OFF' : 'ON'}`,
    );
    if (sceneMode.tempo) {
      console.log(`tempo  ON — ${sceneMode.tempo.mode}, seed ${sceneMode.tempo.seed}`);
    }
  }
  if (stagePrologue) console.log('stage   prologue ON');
  if (publicRegister) {
    const styleLabel =
      publicRegister.mode === 'sample'
        ? `sample/run seed ${publicRegister.seed}${publicRegister.base ? ` (sampled ${publicRegister.base})` : ''}`
        : publicRegister.base || publicRegister.mode || 'default';
    console.log(`style   public register ${styleLabel}`);
  }
  if (releaseAuthority) console.log('tutor   RELEASE AUTHORITY ON — inherited/episode guard window active');
  if (pacingGuardSelector) {
    console.log(
      `tutor   SELECTIVE PACING ON (${pacingGuardSelector.schema}) — ${pacingGuardSelector.gate || 'selector'} -> ${pacingGuardSelector.selectedFlag}`,
    );
  }
  if (pacingGuard) console.log('tutor   PACING GUARD ON');
  if (visibleGuard) console.log('tutor   VISIBLE PACING GUARD ON');
  if (visiblePushProbeGuard) console.log('tutor   VISIBLE PUSH PROBE ON');
  if (visibleConsolidationGuard) console.log('tutor   VISIBLE CONSOLIDATION ON');
  if (assertionGroundingGate) console.log('learner ANSWER GATE ON');
  if (sameTurnAssertionAffordance) console.log('learner SAME-TURN ASSERTION AFFORDANCE ON');
  if (proofDebtGuard) console.log('tutor   PROOF-DEBT GUARD ON');
  if (conductPolicy) {
    console.log(
      conductPolicyEnforce
        ? 'tutor   CONDUCT POLICY LOG ON — before/after enforcement'
        : 'tutor   CONDUCT POLICY LOG ON',
    );
  }
  if (conductPolicyEnforce) console.log('tutor   CONDUCT POLICY ENFORCE ON');
  if (guardSpec) console.log(`guard   COMPILED — WorldIR -> GuardSpec (${guardSpec.world.id})`);
  if (plot) console.log(`tutor   PLOT ON${throughline ? ' + THROUGHLINE ON' : ''}`);
  console.log(
    `conds   ${overrides.length ? `overridden: ${overrides.join(', ')} — all else inherited` : 'all inherited from source'}`,
  );

  const client = makeLlmClient({ mode });
  const actsMode = Boolean(acts);
  const liveRoles = {
    director: makeLlmDirector(world, client, { dials, dramaturgy, counsel, actsMode }),
    tutor: makeLlmTutor(world, client, {
      script,
      dials,
      superego,
      stallWatch,
      counsel,
      decayVisibility,
      actsMode,
      reconstruct,
      confront,
      repairClause,
      releaseAuthority,
      pacingGuard,
      visibleGuard,
      visiblePushProbeGuard,
      visibleConsolidationGuard,
      proofDebtGuard,
      conductPolicy,
      conductPolicyEnforce,
      guardSpec,
      plot,
      throughline,
    }),
    learner: makeLlmLearner({
      setting: world.setting,
      voice: learnerVoice || world.learnerVoice,
      client,
      assertionGroundingGate,
      sameTurnAssertionAffordance,
    }),
  };
  const roles = makeReplayRoles({ recorded: src.result, fromTurn, live: liveRoles });

  const onTurn = (s) => {
    if (s.turn < fromTurn) return; // replayed turns are silent — verified after the run instead
    livePublisher.turn(s);
    const bits = [`  t${String(s.turn).padStart(2, '0')}/${s.turnCap}`, `D=${s.D}${s.forced ? ' FORCED' : ''}`];
    if (s.released.length) bits.push(`▲ ${s.released.map((f) => f.join(' ')).join('; ')}`);
    if (s.adopted) bits.push(`+${s.adopted} adopted`);
    if (s.retracted) bits.push(`−${s.retracted} retracted`);
    if (s.decayedNow?.length) bits.push(`☄ ${s.decayedNow.join(', ')} fades`);
    if (s.repairedNow?.length) bits.push(`✚ ${s.repairedNow.join(', ')} restored`);
    if (s.phase && s.phase.turn === s.turn) bits.push(`movement "${s.phase.name}"`);
    if (s.intervened) bits.push('✎ superego');
    if (s.asserted) bits.push('ASSERTS');
    for (const e of s.events) bits.push(`⚑ ${e.type}`);
    if (s.endedBy) bits.push(`— ends: ${s.endedBy}`);
    console.log(bits.join('  '));
  };

  const started = Date.now();
  let result;
  try {
    result = await runDrama({
      world,
      roles,
      options: {
        onTurn,
        maxTurns,
        logicProjection: true,
        directorCadence,
        stagePrologue,
        publicRegister,
        ...(sceneMode ? { sceneMode } : {}),
        ...(decay ? { decay } : {}),
        ...(acts ? { acts } : {}),
        ...(proofDebtGuard ? { proofDebtGuard } : {}),
        ...(conductPolicy ? { conductPolicy } : {}),
        ...(conductPolicyEnforce ? { conductPolicyEnforce } : {}),
        ...(guardSpec ? { guardSpec } : {}),
      },
    });
    livePublisher.finalizing();
  } catch (err) {
    livePublisher.fail(err);
    throw err;
  }
  const elapsedMs = Date.now() - started;
  const usage = client.usage();

  // --- prefix integrity ---
  const prefix = comparePrefix(result, src.result, fromTurn);
  // A decay-condition change explains prefix divergence only when the change
  // is visible BEFORE the live turns — i.e. the effective config differs from
  // the inherited one and either of them acts on a prefix turn. This is
  // symmetric: adding/retuning decay (new config reaches back) and removing
  // it (the recording's decay events vanish from the replay) both qualify.
  const reachesPrefix = (cfg) => Boolean(cfg) && cfg.startTurn < fromTurn;
  const decayReachesPrefix =
    JSON.stringify(decay ?? null) !== JSON.stringify(inheritedDecay ?? null) &&
    (reachesPrefix(decay) || reachesPrefix(inheritedDecay));
  // Acts shape the run from turn 1 (boundaries, act_end events, synthesized
  // phases), so ANY acts-condition change reaches the prefix once it exists.
  const actsChangeInPrefix = JSON.stringify(acts ?? null) !== JSON.stringify(inheritedActs ?? null) && fromTurn > 1;
  const expectedDivergence = decayReachesPrefix || actsChangeInPrefix;
  if (prefix.ok) {
    console.log(`\nprefix  ${prefix.prefixTurns} turns replayed — formal channel identical to ${src.label}`);
  } else {
    console.log(
      `\nprefix  DIVERGED from ${src.label} (${prefix.mismatches.length}${prefix.mismatches.length === 20 ? '+' : ''} mismatches)`,
    );
    if (decayReachesPrefix) {
      console.log(
        `        expected: the decay-condition change reaches back into the prefix (${
          decay ? `startTurn ${decay.startTurn}` : `source decay startTurn ${inheritedDecay.startTurn}`
        } < --turn ${fromTurn})`,
      );
    }
    if (actsChangeInPrefix) {
      console.log('        expected: the acts-condition change reshapes the prefix (acts act from turn 1)');
    }
    for (const m of prefix.mismatches.slice(0, 5)) {
      console.log(
        `        ${m.kind}${m.turn !== null && m.turn !== undefined ? ` t${m.turn}` : ''}: recorded ${m.expected} → replayed ${m.actual}`,
      );
    }
    if (!expectedDivergence) {
      console.log('        no condition change explains this — treat the episode as invalid and investigate');
    }
  }

  const windowExhausted =
    !result.events.some((e) => e.turn >= fromTurn && ['grounded_anagnorisis', 'leak'].includes(e.type)) &&
    result.turnsPlayed === maxTurns &&
    maxTurns < world.turnCap;
  const episode = {
    label,
    source: { label: src.label, dir: path.relative(ROOT, src.dir) },
    fromTurn,
    window,
    maxTurns,
    overrides,
    prefixIntegrity: { ok: prefix.ok, mismatches: prefix.mismatches, expectedDivergence },
    windowExhausted,
  };
  const diagnosis = {
    label,
    group: srcDiag.group ?? null,
    note,
    scriptPath: path.relative(ROOT, scriptPath),
    worldPath: path.relative(ROOT, worldPath),
    backend: { mode, roles: targets },
    dials,
    dramaturgy,
    tutorSuperego: superego,
    tutorStallWatch: stallWatch,
    criticFeedback: srcDiag.criticFeedback ?? null,
    learnerVoice: learnerVoice || null,
    decay: decay || null,
    decayVisibility,
    actsConfig: acts || null,
    sceneMode: sceneMode || null,
    directorCadence,
    stagePrologue,
    publicRegister,
    reconstruct,
    confront,
    releaseAuthority,
    pacingGuard,
    pacingGuardSelective,
    pacingGuardSelectiveV1,
    pacingGuardSelectiveV2,
    pacingGuardSelectiveV3,
    pacingGuardSelectiveV4,
    pacingGuardSelector,
    visiblePushProbeGuard,
    visibleConsolidationGuard,
    assertionGroundingGate,
    sameTurnAssertionAffordance,
    visibleGuard,
    proofDebtGuard,
    conductPolicy,
    conductPolicyEnforce,
    compiledGuard,
    guardSpec: guardSpec
      ? {
          schema: guardSpec.schema,
          worldId: guardSpec.world.id,
          hiddenPacingPremises: guardSpec.guards.hidden_pacing.releaseCorridors.length,
          proofDebtTutorView: guardSpec.guards.proof_debt.exposeToTutor,
          onlineLlmGuardAuthoring: guardSpec.compiler.onlineLlmGuardAuthoring,
        }
      : null,
    repairClause,
    plotDial: plot,
    throughlineDial: throughline,
    elapsedMs,
    usage,
    episode,
    ...diagnose(result, world),
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'diagnosis.json'), `${JSON.stringify(diagnosis, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'episode.json'), `${JSON.stringify(episode, null, 2)}\n`);
  livePublisher.complete({ result, diagnosis });

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
    } catch (err) {
      console.warn(`critic  FAILED (episode artifacts are intact): ${err.message}`);
    }
  }

  fs.writeFileSync(
    path.join(outDir, 'transcript.md'),
    renderTranscript(result, world, { title: `${world.title} — ${label}`, diagnosis, commentary: commentaryEmbed }),
  );

  // --- focused report: the window, not the whole drama ---
  console.log('');
  console.log(
    `VERDICT ${result.verdict}${windowExhausted ? ' — window exhausted (no terminal event within the episode window)' : ''}  (${result.turnsPlayed}/${world.turnCap} turns, ${(elapsedMs / 1000).toFixed(1)}s)`,
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
  console.log(renderDCurve(result.trajectory.filter((p) => p.turn >= fromTurn - 1)));
  const windowEvents = result.events.filter((e) => e.turn >= fromTurn);
  console.log('');
  console.log(
    `window  turns ${fromTurn}–${result.turnsPlayed}: ${windowEvents.length ? windowEvents.map((e) => `${e.type}@t${e.turn}`).join(', ') : 'no events'}`,
  );
  const windowReleases = result.ledger.filter((e) => e.turn >= fromTurn);
  console.log(
    `        releases ${windowReleases.length ? windowReleases.map((e) => `${e.premiseId}@t${e.turn}`).join(', ') : 'none'}`,
  );
  if (result.corruption) {
    const decays = result.corruption.ledger.filter((e) => e.type === 'decay');
    const repairs = result.corruption.ledger.filter((e) => e.type === 'repair');
    console.log(
      `decay   ${decays.length} decay event${decays.length === 1 ? '' : 's'}, ${repairs.length} repaired, ${result.corruption.decayedAtEnd.length} still degraded at end`,
    );
  }
  if (mode === 'real') {
    console.log(
      `cost    ${usage.calls} live calls, ${usage.inputTokens}+${usage.outputTokens} tokens, $${usage.costUSD.toFixed(4)}`,
    );
  }
  console.log('');
  console.log(
    `artifacts ${path.relative(ROOT, outDir)}/{transcript.md, diagnosis.json, result.json, episode.json${commentaryEmbed ? ', commentary.md' : ''}}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
