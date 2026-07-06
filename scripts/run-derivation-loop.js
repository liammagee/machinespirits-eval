#!/usr/bin/env node
/**
 * One attended iteration of the phase-1 staging loop
 * (notes/2026-06-09-dramatic-derivation-plan.md §3 step 3): run the drama with the
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
 *                                       maxConcurrent, startTurn, mutateShare,
 *                                       pool (defaults in corruption.js;
 *                                       mutateShare > 0 lets a slip
 *                                       misremember — one argument swapped —
 *                                       instead of vanish; pool "staged"
 *                                       confines the swap to met-on-stage
 *                                       names, registration §13).
 *                                       Run-level condition; worlds stay
 *                                       frozen. Design notes: notes/poetics/
 *                                       2026-06-10-unreliable-learner-design.md
 *                                       + 2026-06-11-act-bounded-learner-
 *                                       design.md)
 *     [--decay-visibility told|conduct] (who learns of decay: told = the tutor
 *                                       ego prompt carries the SLIPPED block
 *                                       (default); conduct = block suppressed,
 *                                       the tutor must read decay off the
 *                                       learner's behaviour. Engine view and
 *                                       instruments keep ground truth in both.
 *                                       The registered visibility contrast:
 *                                       UNRELIABLE-LEARNER-PREREG.md §7 G3.
 *                                       Acts mode implies conduct; an explicit
 *                                       told there is refused.)
 *     [--acts '<json>'|off]            (stage v2: the director judges per turn
 *                                       whether the act's work is done — min/
 *                                       maxActTurns bound the verdict; an act
 *                                       boundary clears the learner's stage
 *                                       (its theory store is the only carry-
 *                                       over) and the closing direction opens
 *                                       the next act as its strategic brief.
 *                                       JSON keys: minActTurns, maxActTurns.
 *                                       Design note: notes/poetics/2026-06-11-
 *                                       act-bounded-learner-design.md)
 *     [--scene-mode '<json>'|on|off]   (scene/exchange overlay, new regime.
 *                                       Scenes carry local proof obligations;
 *                                       turns become exchanges inside a scene
 *                                       and may be phatic, confused, repair-
 *                                       seeking, or substantive. Does not
 *                                       overwrite the formal turn loop.
 *                                       JSON keys: maxExchanges,
 *                                       maxPhaticExchanges,
 *                                       closeOnDDecrease, closeOnConfusion,
 *                                       recognitionNeed, tempo.
 *                                       recognitionNeed=false ablates the
 *                                       dialogical pressure signal.
 *                                       tempo=true samples exchange beats:
 *                                       uptake_only, repair_request,
 *                                       recap, hesitation, hypothesis,
 *                                       evidence, recognition.)
 *     [--strategy-ledger '<json>'|on|off]
 *                                      (LAYERED-DECISION-LOOPS-PLAN.md
 *                                       Phases 0-1; requires --scene-mode.
 *                                       Blocks segment pressing exchange
 *                                       episodes with deterministic exit-
 *                                       condition checks; the tutor commits
 *                                       a scene strategy at each opening —
 *                                       register (palette-bound, harness-
 *                                       held), didactic default (held
 *                                       within blocks; failed modes
 *                                       escalate), release POSTURE,
 *                                       recognition budget — audited
 *                                       deterministically at the close;
 *                                       the audit binds the next opening.
 *                                       Conduct only: proof control and
 *                                       the release calendar untouched.
 *                                       JSON keys: maxBlockTurns,
 *                                       registerPalette.)
 *     [--learner-ledger]               (Phase 2, the learner mirror;
 *                                       requires --scene-mode. The learner
 *                                       commits its own scene intent
 *                                       (want / if_lost / speech_posture)
 *                                       and, in acts mode, an act carry-
 *                                       forward; private to the learner,
 *                                       conformance-audited at boundaries.)
 *     [--director-cadence turn|scene|release]
 *                                      (when the director speaks. Default:
 *                                       turn without scene mode; scene with
 *                                       scene mode. scene = scene openings
 *                                       plus scheduled exhibit turns; release
 *                                       = scheduled exhibit turns only.)
 *     [--stage-prologue [on|off]]      (director writes opening stage notes
 *                                       plus tutor/learner character sketches
 *                                       before turn 1. Default on in scene
 *                                       mode, off otherwise.)
 *     [--register default|modern|period|sample|auto|'<json>']
 *                                      (public surface language. Default:
 *                                       sampled once before the prologue when
 *                                       scene/rhetoric mode is on, default
 *                                       otherwise. JSON sample keys: seed,
 *                                       scope="run", palette, weights, base.)
 *     [--reconstruct]                  (adapt-ON arm dial; requires --acts.
 *                                       The tutor commits a per-turn theory of
 *                                       the learner's store — believed_held/
 *                                       missing/mistaken — recorded beside the
 *                                       harness-truth snapshot. Arm-internal
 *                                       color; never cross-arm scoring.)
 *     [--confront]                     (P1/C5; requires --superego + --acts,
 *                                       excludes --stall-watch. The
 *                                       confrontation obligation: the first
 *                                       move back onto an already-staged
 *                                       exhibit must be intent "confront" —
 *                                       demand the learner's read-back,
 *                                       restate nothing — and one confrontation
 *                                       licenses one re-entry. The superego
 *                                       charter gains the re-entry
 *                                       jurisdiction; a confront move never
 *                                       repairs. Design: notes/poetics/
 *                                       2026-06-11-desire-multiturn-strategy-
 *                                       plan.md §C5)
 *     [--repair-clause]                (§12; requires --confront + --decay.
 *                                       The exception that runs the other
 *                                       way: a learner-NAMED loss is already
 *                                       the read-back — the tutor's next turn
 *                                       re-stages the named exhibit (intent
 *                                       "restore") before any new matter; the
 *                                       superego verifies the claimed license
 *                                       against the learner's last line.
 *                                       Design: same plan §12)
 *     [--release-authority]            (P1/C2. The tutor's via-tutor exhibit
 *                                       cues become a window: hold a due
 *                                       release or play one early, up to
 *                                       RELEASE_LATITUDE turns either way,
 *                                       with a declared one-line reason; the
 *                                       harness force-plays at the hold limit
 *                                       and validates every claim against the
 *                                       window. Decision records land in the
 *                                       ledger + transcript meta. Design:
 *                                       same note §C2)
 *     [--pacing-guard]                 (E3/M1; requires --release-authority.
 *                                       A mechanical no-decay solvency check
 *                                       narrows the release window to computed
 *                                       safe placements, can hold clock-fatal
 *                                       claims, and can force an exhibit on
 *                                       its last safe turn. Uses production
 *                                       derivationDistance/detectStall.)
 *     [--pacing-guard-visible]         (Step-1 V arm; requires --release-authority,
 *                                       excludes --pacing-guard. The SAME window-
 *                                       narrowing decided from transcript-visible
 *                                       page state ONLY — turns since last release,
 *                                       whether the learner echoed the prior
 *                                       exhibit, the hedging/length trend — never
 *                                       the proof DAG or decay ledger. The hidden-
 *                                       vs-visible-signal contrast; services/
 *                                       dramaticDerivation/visiblePacing.js, audit-
 *                                       tested to import no hidden-state module.)
 *     [--pacing-guard-selective]       (Step-4 draft selector; requires
 *                                       --release-authority, excludes explicit H/V.
 *                                       Builds static WorldIR once and selects H
 *                                       for independent top-level secret joins,
 *                                       otherwise V. No online switching and no
 *                                       new prompt channel.)
 *     [--pacing-guard-selective-v1]    (Selector v1 probe; separate from v0.
 *                                       H for independent joins; V for a formal
 *                                       mirror dead-predicate decoy; otherwise
 *                                       fail closed to H when decay is active.)
 *     [--pacing-guard-selective-v2]    (Selector v2 probe; separate from v0/v1.
 *                                       H for independent joins and for
 *                                       decay-exposed shared proof-critical
 *                                       source premises in the consolidated
 *                                       proof graph; V only when no proof-
 *                                       continuity override defeats a mirror
 *                                       dead-predicate route.)
 *     [--pacing-guard-selective-v3]    (Selector v3 probe; hidden default plus
 *                                       a shadow visible-stall push probe,
 *                                       accepted only when the hidden guard
 *                                       also marks the release safe.)
 *     [--pacing-guard-selective-v4]    (Selector v4 probe; hidden default plus
 *                                       visible hold/consolidation and a
 *                                       grounded-answer gate. Conduct-policy
 *                                       logging/enforcement must be requested
 *                                       explicitly. Visible state cannot
 *                                       accelerate release.)
 *     [--proof-debt-guard]             (requires --repair-clause. When decay has
 *                                       dropped an already-staged proof-critical
 *                                       exhibit, the harness authorizes a restore
 *                                       move before closure/new work. Exposes only
 *                                       released exhibit ids/surfaces, not the raw
 *                                       learner board or corruption ledger.)
 *     [--conduct-policy]               (A20 diagnostic. Logs conduct-policy
 *                                       move-family decisions from the same
 *                                       release/proof-debt evidence, but does
 *                                       not constrain generation.)
 *     [--conduct-progress-policy]      (A20 Phase 6 probe. When repeated
 *                                       visible/hidden diagnostics exhaust the
 *                                       local budget, prefer certified release
 *                                       or consolidation over another diagnostic.
 *                                       Implies --conduct-policy.)
 *     [--conduct-policy-enforce]       (A20 opt-in enforcement. Implies
 *                                       --conduct-policy, mechanically rewrites
 *                                       tutor move/release metadata to satisfy
 *                                       selected conduct-family constraints when
 *                                       this can be done without bypassing a
 *                                       forced release.)
 *     [--compiled-guard]               (P1 guard compiler runtime. Compile this
 *                                       world's WorldIR -> GuardSpec and feed it
 *                                       to active --pacing-guard / --proof-debt-
 *                                       guard mechanisms. No online LLM guard
 *                                       authoring.)
 *     [--plot]                         (P2/C1; requires --superego + --acts.
 *                                       At each act opening the tutor ego
 *                                       commits a per-act plot — hold_by_end /
 *                                       withhold / friction / fallback, built
 *                                       from conduct only — and plays under
 *                                       it; at the act close the superego
 *                                       audits plot against play clause by
 *                                       clause (kept / justified_deviation /
 *                                       drift) and the verdict binds the next
 *                                       act's plot. Design: same note §5)
 *     [--throughline]                  (two-layer planning; requires --plot.
 *                                       At the first turn the tutor commits a
 *                                       whole-play THROUGHLINE — arc waypoints
 *                                       / hold_to_end / risk / salvage — read
 *                                       back every turn above the act plot;
 *                                       the act-close audit adds an on_arc /
 *                                       off_arc verdict, off_arc binds a
 *                                       revision at the next opening, and the
 *                                       run-end audit reckons the throughline
 *                                       clause by clause. Design: same note
 *                                       §11 pre-run amendment, 2026-06-12)
 *     [--rhetorical-policy '<json>']   (advisory shallow map from visible
 *                                       proof/dialogue pressure to a figure
 *                                       distribution and selected move. JSON:
 *                                       mode deterministic|sample, seed,
 *                                       temperature. Pair with --scene-mode
 *                                       for phatic/scene calibration.)
 *     [--rhetorical-policy-stochastic] (shortcut: same policy, mode=sample
 *                                       with fixed seed unless overridden.)
 *     [--discursive-calibration]       (public-only advisory layer that biases
 *                                       rhetorical move advice from learner
 *                                       stance/uptake/strain; never authorizes
 *                                       release, restore, hold, or assertion.)
 *     [--didactic-mode]                (public-only scene/act explanatory-mode
 *                                       advisory. Reads public learner/dialogue
 *                                       signals and recommends how to teach the
 *                                       same proof obligation; no release,
 *                                       restore, hold, or assertion authority.)
 *     [--cast-layer]                   (public cast layer. Projects authored
 *                                       tutor/learner/relation character into
 *                                       director, tutor, learner, and tutor
 *                                       superego prompts. Advisory only; no
 *                                       proof-control authority.)
 *     [--cast-reinvention]             (requires --cast-layer. Allows bounded
 *                                       tutor stance reinvention from public
 *                                       discourse/didactic signals. Changes
 *                                       tone/figure/tempo/example/recognition
 *                                       conduct only, never release/restore/
 *                                       hold/assertion/proof target.)
 *     [--learner-drift]                (public learner character drift, if the
 *                                       world declares learner_drift. The
 *                                       learner may harden under brittle
 *                                       correction or soften under explicit
 *                                       acknowledgement. Speech/uptake only;
 *                                       no proof-control authority.)
 *     [--ownership-proof]              (tutor-private public learner-ownership
 *                                       target, if the world declares
 *                                       ownership_target. Tracks whether the
 *                                       learner owns the revision in public
 *                                       conduct; no release/restore/hold/
 *                                       assertion authority.)
 *     [--ownership-transfer-gate]      (requires --ownership-proof. If final
 *                                       closure is available but the declared
 *                                       ownership target still lacks a nearby
 *                                       transfer, advise one compact parallel
 *                                       case before closure. Conduct only.)
 *     [--learner-proxy-dag]            (adds a leak-safe private proxy-DAG
 *                                       memory block to the learner view:
 *                                       grounded surface facts, learner-voiced
 *                                       conclusions, hypotheses, and candidate
 *                                       conclusions from the learner record.
 *                                       No authored proof paths, premise ids,
 *                                       rule ids, release schedule, or
 *                                       unreleased facts.)
 *     [--proxy-dag-pacing]             (adds an advisory proxy-DAG pacing
 *                                       signal to director/tutor views and
 *                                       artifacts. Advisory only: it does not
 *                                       authorize releases or assertions.)
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
 * dialogue discipline, logic projection, usage/cost), result.json (the raw
 * engine output, including harness-only logic snapshots), dialogue-report.md,
 * dialogue-report.json, dynamic-field.svg (the dynamic learner-field report),
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
  normalizeActsConfig,
  normalizeSceneConfig,
  normalizeDirectorCadence,
  normalizeRhetoricalPolicyConfig,
  normalizeStrategyLedgerConfig,
  normalizeLemmaConfig,
  normalizePublicRegister,
  describePublicRegister,
  makeLlmClient,
  llmMode,
  resolveTarget,
  makeLlmDirector,
  makeLlmTutor,
  makeLlmLearner,
  learnerVoiceForWorld,
  clampDial,
  RELEASE_LATITUDE,
  diagnose,
  stagingSegments,
  renderDCurve,
  renderTranscript,
  runCritic,
  commentaryFileMd,
  buildDialogueReport,
  renderDialogueReportArtifacts,
} from '../services/dramaticDerivation/index.js';
import {
  buildWorldIR,
  compileGuardSpec,
  selectGuardRepresentation,
  selectGuardRepresentationV1,
  selectGuardRepresentationV2,
  selectGuardRepresentationV3,
  selectGuardRepresentationV4,
} from '../services/dramaticDerivation/guardCompiler.js';

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
  const publicLine = (entry) => entry.role !== 'director' || entry.meta?.release || entry.meta?.phase?.name;
  const line = (entry) => ({
    role: entry.role === 'director' ? 'stage' : entry.role,
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
    scene: summary.scene || null,
    closedScene: summary.closedScene || null,
    exchange: summary.exchange || null,
    didacticMode: summary.didacticMode || null,
    castState: summary.castState || null,
    tutorReinvention: summary.tutorReinvention || null,
    learnerDrift: summary.learnerDrift || null,
    learnerTransformation: summary.learnerTransformation || null,
    learnerTransformationPost: summary.learnerTransformationPost || null,
    proxyDagPacing: summary.proxyDagPacing || null,
    events: summary.events || [],
    lines: (summary.lines || []).filter(publicLine).map(line),
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
      write();
    },
    fail(error) {
      state.status = 'failed';
      state.error = error?.stack || error?.message || String(error);
      write();
    },
  };
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
  // Stage v2: acts mode (director-judged act termination + bounded learner +
  // act-boundary briefs) and the adapt-ON arm dial (reconstructing tutor).
  const actsArg = arg('acts', null);
  const acts = actsArg && actsArg !== 'off' ? normalizeActsConfig(actsArg) : null;
  const sceneArg = arg('scene-mode', null);
  const sceneMode =
    flag('scene-mode') && sceneArg !== 'off'
      ? normalizeSceneConfig(sceneArg && sceneArg !== 'on' ? sceneArg : true)
      : null;
  let directorCadence;
  try {
    directorCadence = normalizeDirectorCadence(arg('director-cadence', null), { sceneMode: Boolean(sceneMode) });
  } catch (err) {
    console.error(`--director-cadence ${err.message}`);
    process.exit(1);
  }
  const stagePrologueArg = arg('stage-prologue', flag('stage-prologue') ? 'on' : null);
  if (stagePrologueArg && !['on', 'off'].includes(stagePrologueArg)) {
    console.error(`--stage-prologue must be "on" or "off" (got "${stagePrologueArg}")`);
    process.exit(1);
  }
  const stagePrologue = stagePrologueArg ? stagePrologueArg !== 'off' : Boolean(sceneMode);
  // Strategy ledger (LAYERED-DECISION-LOOPS-PLAN.md Phases 0-2): tutor-side
  // blocks + scene commitments (+ audits) and the learner's own scene/act
  // commitments. Both need the scene overlay; malformed JSON dies here.
  const strategyLedgerArg = arg('strategy-ledger', null);
  let strategyLedger = null;
  if (flag('strategy-ledger') && strategyLedgerArg !== 'off') {
    try {
      strategyLedger = normalizeStrategyLedgerConfig(
        strategyLedgerArg && strategyLedgerArg !== 'on' ? strategyLedgerArg : true,
      );
    } catch (err) {
      console.error(`--strategy-ledger ${err.message}`);
      process.exit(1);
    }
  }
  const learnerLedger = flag('learner-ledger');
  // Lemma layer (LEMMA-LAYER-PREREGISTRATION.md): a maintained proof
  // structure one level above the premise grain. display = map as prompt
  // signal; bind = frontier choice at scene openings + voluntary proof
  // releases gated to the active lemma (tagged departures). Needs the scene
  // overlay; malformed JSON dies here.
  const lemmaLayerArg = arg('lemma-layer', null);
  let lemmaLayer = null;
  if (flag('lemma-layer') && lemmaLayerArg !== 'off') {
    try {
      lemmaLayer = normalizeLemmaConfig(lemmaLayerArg && lemmaLayerArg !== 'on' ? lemmaLayerArg : true);
    } catch (err) {
      console.error(`--lemma-layer ${err.message}`);
      process.exit(1);
    }
  }
  if (lemmaLayer && !sceneMode) {
    console.error('--lemma-layer requires --scene-mode (the frontier choice is a scene-opening decision)');
    process.exit(1);
  }
  // Register router (classifier-dag-register Phase B): per tutor turn the
  // learner's last message is classified (audited lexical sensor, chain
  // grain) and a stance register is routed from classifier x DAG state.
  // Value 'on' (bare) or JSON {"mockLabel":...,"mockDagState":true} (test).
  const registerRouterArg = arg('register-router', null);
  let registerRouter = null;
  if (flag('register-router') && registerRouterArg !== 'off') {
    try {
      registerRouter = registerRouterArg && registerRouterArg !== 'on' ? JSON.parse(registerRouterArg) : true;
    } catch (err) {
      console.error(`--register-router ${err.message}`);
      process.exit(1);
    }
  }
  // Learner mirror refusal (exploration 6): one criterial refusal retry to
  // the LEARNER when they re-voice the mirror hypothesis against their own
  // grounded record. Value 'on' (bare) or JSON {"mock":"reconcile"|"reexamine"}.
  const learnerMirrorRefusalArg = arg('learner-mirror-refusal', null);
  let learnerMirrorRefusal = null;
  if (flag('learner-mirror-refusal') && learnerMirrorRefusalArg !== 'off') {
    try {
      learnerMirrorRefusal =
        learnerMirrorRefusalArg && learnerMirrorRefusalArg !== 'on' ? JSON.parse(learnerMirrorRefusalArg) : true;
    } catch (err) {
      console.error(`--learner-mirror-refusal ${err.message}`);
      process.exit(1);
    }
  }
  if (strategyLedger && !sceneMode) {
    console.error(
      '--strategy-ledger requires --scene-mode (blocks segment scene exchanges; commitments bind at scene boundaries)',
    );
    process.exit(1);
  }
  if (learnerLedger && !sceneMode) {
    console.error('--learner-ledger requires --scene-mode (scene intents bind at scene boundaries)');
    process.exit(1);
  }
  if (strategyLedger?.releaseIntent && !flag('release-authority')) {
    console.error(
      '--strategy-ledger releaseIntent requires --release-authority (intent is planning over the authority the tutor already holds; guards stay binding)',
    );
    process.exit(1);
  }
  const reconstruct = flag('reconstruct');
  if (reconstruct && !acts) {
    console.error(
      '--reconstruct requires --acts (reconstruction is acts-mode machinery — without the bounded learner there is nothing to reconstruct)',
    );
    process.exit(1);
  }
  // Who learns of decay, and how: 'told' = the tutor ego prompt carries the
  // SLIPPED block (v1 behaviour, default); 'conduct' = the block is suppressed
  // and the tutor can read decay only off the learner's behaviour. The engine
  // and instruments keep ground truth either way (the manipulation is textual).
  // Acts mode forces 'conduct': the told channel reads a corruption view the
  // acts-mode tutor no longer has — an explicit 'told' is a config error.
  const decayVisibilityArg = arg('decay-visibility', null);
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
  const decayVisibility = decayVisibilityArg || (acts ? 'conduct' : 'told');
  if (decayVisibility === 'conduct' && !decay && !acts) {
    console.error('--decay-visibility conduct without --decay is a no-op — refusing (probable arm-B typo)');
    process.exit(1);
  }
  const superego = flag('superego');
  const stallWatch = flag('stall-watch');
  if (stallWatch && !superego) {
    console.error('--stall-watch requires --superego (the stall jurisdiction is a clause of the watcher charter)');
    process.exit(1);
  }
  // P1 dials (notes/poetics/2026-06-11-desire-multiturn-strategy-plan.md):
  // C5 = the confrontation obligation (charter clause + superego re-entry
  // watch); C2 = release authority (the exhibit calendar becomes a window).
  const confront = flag('confront');
  if (confront && !superego) {
    console.error('--confront requires --superego (the re-entry jurisdiction is a clause of the watcher charter)');
    process.exit(1);
  }
  if (confront && !acts) {
    console.error(
      '--confront requires --acts (re-entry is an acts-mode concept — outside acts the tutor reads decay directly and a read-back tests nothing)',
    );
    process.exit(1);
  }
  if (confront && stallWatch) {
    console.error(
      '--confront and --stall-watch cannot combine in v1 — the superego charter renders one criterial watch block (pick one jurisdiction pair)',
    );
    process.exit(1);
  }
  // §12 = the repair clause: the learner's named loss licenses a next-turn
  // re-staging (declared intent "restore"); the watcher verifies the claim.
  const repairClause = flag('repair-clause');
  if (repairClause && !confront) {
    console.error('--repair-clause requires --confront (the clause is an exception to the confrontation obligation)');
    process.exit(1);
  }
  if (repairClause && !decay) {
    console.error('--repair-clause requires --decay (without slips there is nothing to restore — probable arm typo)');
    process.exit(1);
  }
  const releaseAuthority = flag('release-authority');
  const requestedPacingGuard = flag('pacing-guard');
  if (requestedPacingGuard && !releaseAuthority) {
    console.error('--pacing-guard requires --release-authority (it narrows the exhibit window)');
    process.exit(1);
  }
  // Step-1 V arm: the form-matched guard that decides from transcript-visible
  // state only. Same authority requirement as --pacing-guard, and mutually
  // exclusive with it — the experiment IS hidden-signal vs visible-signal.
  const requestedVisibleGuard = flag('pacing-guard-visible');
  if (requestedVisibleGuard && !releaseAuthority) {
    console.error('--pacing-guard-visible requires --release-authority (it narrows the exhibit window)');
    process.exit(1);
  }
  if (requestedVisibleGuard && requestedPacingGuard) {
    console.error(
      '--pacing-guard-visible is mutually exclusive with --pacing-guard (the hidden-vs-visible-signal contrast runs one guard per arm)',
    );
    process.exit(1);
  }
  const pacingGuardSelective = flag('pacing-guard-selective');
  if (pacingGuardSelective && !releaseAuthority) {
    console.error('--pacing-guard-selective requires --release-authority (it selects a release-window guard)');
    process.exit(1);
  }
  if (pacingGuardSelective && (requestedPacingGuard || requestedVisibleGuard)) {
    console.error(
      '--pacing-guard-selective is mutually exclusive with explicit --pacing-guard / --pacing-guard-visible',
    );
    process.exit(1);
  }
  const pacingGuardSelectiveV1 = flag('pacing-guard-selective-v1');
  if (pacingGuardSelectiveV1 && !releaseAuthority) {
    console.error('--pacing-guard-selective-v1 requires --release-authority (it selects a release-window guard)');
    process.exit(1);
  }
  if (pacingGuardSelectiveV1 && (requestedPacingGuard || requestedVisibleGuard || pacingGuardSelective)) {
    console.error(
      '--pacing-guard-selective-v1 is mutually exclusive with explicit --pacing-guard / --pacing-guard-visible and v0 --pacing-guard-selective',
    );
    process.exit(1);
  }
  const pacingGuardSelectiveV2 = flag('pacing-guard-selective-v2');
  if (pacingGuardSelectiveV2 && !releaseAuthority) {
    console.error('--pacing-guard-selective-v2 requires --release-authority (it selects a release-window guard)');
    process.exit(1);
  }
  if (
    pacingGuardSelectiveV2 &&
    (requestedPacingGuard || requestedVisibleGuard || pacingGuardSelective || pacingGuardSelectiveV1)
  ) {
    console.error(
      '--pacing-guard-selective-v2 is mutually exclusive with explicit --pacing-guard / --pacing-guard-visible and v0/v1 selector arms',
    );
    process.exit(1);
  }
  const pacingGuardSelectiveV3 = flag('pacing-guard-selective-v3');
  if (pacingGuardSelectiveV3 && !releaseAuthority) {
    console.error('--pacing-guard-selective-v3 requires --release-authority (it selects a release-window guard)');
    process.exit(1);
  }
  if (
    pacingGuardSelectiveV3 &&
    (requestedPacingGuard ||
      requestedVisibleGuard ||
      pacingGuardSelective ||
      pacingGuardSelectiveV1 ||
      pacingGuardSelectiveV2)
  ) {
    console.error(
      '--pacing-guard-selective-v3 is mutually exclusive with explicit --pacing-guard / --pacing-guard-visible and v0/v1/v2 selector arms',
    );
    process.exit(1);
  }
  const pacingGuardSelectiveV4 = flag('pacing-guard-selective-v4');
  if (pacingGuardSelectiveV4 && !releaseAuthority) {
    console.error('--pacing-guard-selective-v4 requires --release-authority (it selects a release-window guard)');
    process.exit(1);
  }
  if (
    pacingGuardSelectiveV4 &&
    (requestedPacingGuard ||
      requestedVisibleGuard ||
      pacingGuardSelective ||
      pacingGuardSelectiveV1 ||
      pacingGuardSelectiveV2 ||
      pacingGuardSelectiveV3)
  ) {
    console.error(
      '--pacing-guard-selective-v4 is mutually exclusive with explicit --pacing-guard / --pacing-guard-visible and v0/v1/v2/v3 selector arms',
    );
    process.exit(1);
  }
  const sameTurnAssertionAffordance = flag('same-turn-assertion-affordance');
  const proofDebtGuard = flag('proof-debt-guard');
  if (proofDebtGuard && !repairClause) {
    console.error(
      '--proof-debt-guard requires --repair-clause (proof-debt restores live inside the restore/re-entry discipline)',
    );
    process.exit(1);
  }
  const conductPolicyEnforce = flag('conduct-policy-enforce');
  const conductProgressPolicy = flag('conduct-progress-policy');
  const conductPolicy = flag('conduct-policy') || conductPolicyEnforce || conductProgressPolicy;
  const compiledGuard = flag('compiled-guard');
  if (
    compiledGuard &&
    (pacingGuardSelective ||
      pacingGuardSelectiveV1 ||
      pacingGuardSelectiveV2 ||
      pacingGuardSelectiveV3 ||
      pacingGuardSelectiveV4)
  ) {
    console.error('--compiled-guard is not combined with selector arms in this selector slice');
    process.exit(1);
  }
  if (compiledGuard && !requestedPacingGuard && !proofDebtGuard) {
    console.error('--compiled-guard requires --pacing-guard and/or --proof-debt-guard');
    process.exit(1);
  }
  // P2/C1 = the act-plot commitment loop (same note §5): plot at the act
  // opening, audit at the act close, the audit binds the next plot.
  const plot = flag('plot');
  if (plot && !acts) {
    console.error(
      '--plot requires --acts (the plot is an act-scale commitment — no acts, no opening to commit at or close to audit)',
    );
    process.exit(1);
  }
  if (plot && !superego) {
    console.error('--plot requires --superego (the act-close audit is its jurisdiction)');
    process.exit(1);
  }
  // Two-layer planning (§11 pre-run amendment, 2026-06-12): the whole-play
  // throughline above the per-act plot — no plot loop, nothing for the arc
  // verdict to ride or bind.
  const throughline = flag('throughline');
  if (throughline && !plot) {
    console.error('--throughline requires --plot (the arc verdict rides the act-close audit)');
    process.exit(1);
  }
  const rhetoricalPolicyArg = arg('rhetorical-policy', null);
  const rhetoricalPolicyRequested = flag('rhetorical-policy') || flag('rhetorical-policy-stochastic');
  let rhetoricalPolicy = rhetoricalPolicyRequested
    ? normalizeRhetoricalPolicyConfig(rhetoricalPolicyArg && rhetoricalPolicyArg !== 'on' ? rhetoricalPolicyArg : true)
    : null;
  if (rhetoricalPolicy && flag('rhetorical-policy-stochastic')) {
    rhetoricalPolicy = { ...rhetoricalPolicy, mode: 'sample' };
  }
  const discursiveCalibration = flag('discursive-calibration');
  const didacticMode = flag('didactic-mode');
  const fieldPlannerEnforce = flag('field-planner-enforce');
  const fieldPlanner = flag('field-planner') || fieldPlannerEnforce;
  if (fieldPlanner && acts) {
    console.error('--field-planner currently requires non-acts mode (acts redacts learner-store state from the tutor)');
    process.exit(1);
  }
  const castLayer = flag('cast-layer');
  const castReinvention = flag('cast-reinvention');
  const learnerDrift = flag('learner-drift');
  const characterArc = flag('character-arc');
  const ownershipProof = flag('ownership-proof');
  const ownershipTransferGate = flag('ownership-transfer-gate');
  const learnerProxyDag = flag('learner-proxy-dag');
  const proxyDagPacing = flag('proxy-dag-pacing');
  const tutorLearnerDag = flag('tutor-learner-dag');
  if (castReinvention && !castLayer) {
    console.error('--cast-reinvention requires --cast-layer');
    process.exit(1);
  }
  if (ownershipTransferGate && !ownershipProof) {
    console.error('--ownership-transfer-gate requires --ownership-proof');
    process.exit(1);
  }
  let publicRegister;
  try {
    publicRegister = normalizePublicRegister(arg('register', null), {
      sceneMode: Boolean(sceneMode),
      rhetoricalPolicy: Boolean(rhetoricalPolicy),
      discursiveCalibration,
      didacticMode,
    });
  } catch (err) {
    console.error(`--register ${err.message}`);
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
  const assertionGroundingGate = pacingGuardSelectiveV4 || sameTurnAssertionAffordance;
  const guardSpec = compiledGuard ? compileGuardSpec(world, worldIR || buildWorldIR(world)) : null;
  const scriptName = path.basename(scriptPath, path.extname(scriptPath));
  const label = arg('label', `${scriptName}-${mode}-${timestamp()}`);
  const loopBaseDir = path.resolve(ROOT, arg('out', 'exports/dramatic-derivation/loop'));
  const outDir = path.join(loopBaseDir, label);
  const counsel = resolveCounsel(loopBaseDir, { request: criticFeedback, group, ownLabel: label });

  const ROLE_NAMES = ['director', 'tutor', ...(superego ? ['tutor_superego'] : []), 'learner'];
  const targets = Object.fromEntries(
    ROLE_NAMES.map((r) => [r, mode === 'real' ? resolveTarget(r) : { provider: 'mock', model: 'mock' }]),
  );
  const live = createLiveRunPublisher(outDir, {
    label,
    group,
    note,
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
      rhetoricalPolicy: rhetoricalPolicy || null,
      discursiveCalibration,
      didacticMode,
      fieldPlanner,
      fieldPlannerEnforce,
      castLayer,
      castReinvention,
      learnerDrift,
      characterArc,
      ownershipProof,
      ownershipTransferGate,
      learnerProxyDag,
      proxyDagPacing,
      tutorLearnerDag,
    },
  });
  live.start();
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
    // ego revision when the watcher is on — one repair each. Plot adds at
    // most one act-close audit call per turn (openings only, but bound it).
    const maxCalls = world.turnCap * ((superego ? 5 : 3) + (plot ? 1 : 0)) * 2;
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
  if (acts) {
    console.log(
      `acts    ON — director judges the work: min ${acts.minActTurns} · max ${acts.maxActTurns} turns per act; the learner is bounded to the current act (its theory store is the only carry-over)`,
    );
  }
  if (sceneMode) {
    console.log(
      `scenes  ON — scene/exchange overlay: max ${sceneMode.maxExchanges} exchanges, phatic budget ${sceneMode.maxPhaticExchanges}; phatic/confusion lines are recorded as exchanges`,
    );
    if (sceneMode.tempo) {
      console.log(
        `tempo  ON — ${sceneMode.tempo.mode}, seed ${sceneMode.tempo.seed}: uptake/repair/recap/hesitation/hypothesis/evidence/recognition beats`,
      );
    }
    console.log(`stage   director cadence ${directorCadence}`);
  }
  if (stagePrologue) {
    console.log('stage   prologue ON — director opening notes and tutor/learner character sketches before turn 1');
  }
  if (publicRegister !== 'default') {
    console.log(`style   public register ${describePublicRegister(publicRegister)}`);
  }
  if (reconstruct) {
    console.log(
      "theory  RECONSTRUCT ON — the tutor commits a per-turn theory of the learner's store (arm-internal color; never cross-arm scoring)",
    );
  }
  if (confront) {
    console.log(
      'tutor   CONFRONT ON — re-entry of a staged exhibit requires a prior confrontation (the learner reads it back, or is seen to have lost it); the superego watches the re-entry jurisdiction',
    );
  }
  if (repairClause) {
    console.log(
      'tutor   REPAIR CLAUSE ON — a learner-named loss is the read-back: the next turn re-stages the named exhibit (intent "restore") before any new matter; the superego verifies the claimed license against the learner\'s last line',
    );
  }
  if (releaseAuthority) {
    console.log(
      `tutor   RELEASE AUTHORITY ON — the exhibit calendar is the tutor's to keep or bend (±${RELEASE_LATITUDE} turns, declared reason; the harness force-plays at the hold limit)`,
    );
  }
  if (pacingGuardSelector) {
    console.log(
      `tutor   SELECTIVE PACING ON (${pacingGuardSelector.schema}) — ${pacingGuardSelector.gate || (pacingGuardSelector.input.independentTopLevelJoin ? 'independent top-level join' : 'no independent top-level join')} -> ${pacingGuardSelector.selectedFlag}`,
    );
  }
  if (pacingGuard) {
    console.log(
      'tutor   PACING GUARD ON — no-decay tempo solvency narrows the release window; clock-fatal claims are held and last-safe turns may be force-played',
    );
  }
  if (visibleGuard) {
    console.log(
      'tutor   VISIBLE PACING GUARD ON — the same window-narrowing decided from transcript-visible page state only (turns since last release, learner echo of the prior exhibit, hedging/length trend); clock-blind by construction',
    );
  }
  if (visiblePushProbeGuard) {
    console.log(
      'tutor   VISIBLE PUSH PROBE ON — shadow page-state probe can override hidden only on hidden-safe visible_stall pushes; visible blocks/echo alone are ignored',
    );
  }
  if (visibleConsolidationGuard) {
    console.log(
      'tutor   VISIBLE CONSOLIDATION ON — page-state can hold or request consolidation, but cannot accelerate releases',
    );
  }
  if (assertionGroundingGate) {
    console.log('learner ANSWER GATE ON — assertions require learner-visible board entailment');
  }
  if (sameTurnAssertionAffordance) {
    console.log(
      'learner SAME-TURN ASSERTION AFFORDANCE ON — after adopting visible exhibits, the learner must re-check and answer immediately if the board entails it',
    );
  }
  if (proofDebtGuard) {
    console.log(
      'tutor   PROOF-DEBT GUARD ON — already-staged proof-critical exhibits that drop from the proof state authorize immediate restore moves before closure/new work',
    );
  }
  if (conductPolicy) {
    console.log(
      conductPolicyEnforce
        ? 'tutor   CONDUCT POLICY LOG ON — A20 move-family decisions are recorded beside tutor turns before/after enforcement'
        : 'tutor   CONDUCT POLICY LOG ON — A20 move-family decisions are recorded beside tutor turns; no generation constraint yet',
    );
  }
  if (conductProgressPolicy) {
    console.log(
      'tutor   CONDUCT PROGRESS POLICY ON — repeated diagnostics can become certified release/consolidation pressure',
    );
  }
  if (conductPolicyEnforce) {
    console.log(
      'tutor   CONDUCT POLICY ENFORCE ON — A20 move-family decisions may mechanically rewrite tutor move/release metadata before the turn is recorded',
    );
  }
  if (guardSpec) {
    console.log(
      `guard   COMPILED — WorldIR -> GuardSpec -> RuntimeMonitor (${guardSpec.world.id}; no online LLM guard authoring)`,
    );
  }
  if (plot) {
    console.log(
      'tutor   PLOT ON — at each act opening the tutor commits a per-act plot (hold/withhold/friction/fallback, from conduct only); the superego audits it clause by clause at the act close, and the audit binds the next plot',
    );
  }
  if (throughline) {
    console.log(
      'tutor   THROUGHLINE ON — at the first turn the tutor commits a whole-play plan (arc/hold_to_end/risk/salvage) above the act plots; the act-close audit adds an on_arc/off_arc verdict, off_arc binds a revision at the next opening, and the run-end audit reckons the throughline clause by clause',
    );
  }
  if (rhetoricalPolicy) {
    console.log(
      `rhetor  POLICY ON (${rhetoricalPolicy.mode}) — visible-state figure distribution, seed ${rhetoricalPolicy.seed}, temperature ${rhetoricalPolicy.temperature}`,
    );
  }
  if (discursiveCalibration) {
    console.log('discurs CALIBRATION ON — public stance/uptake/strain biases advisory rhetoric only');
  }
  if (didacticMode) {
    console.log('didact  MODE ON — public scene/act learning signals choose explanatory mode only');
  }
  if (fieldPlanner) {
    console.log(
      fieldPlannerEnforce
        ? 'field   PLANNER ON + ENFORCE — coupled learner/tutor/discourse field selects and enforces the tutor conduct family'
        : 'field   PLANNER ON — coupled learner/tutor/discourse field selects the tutor conduct family and didactic mode',
    );
  }
  if (castLayer) {
    console.log(
      `cast    LAYER ON${castReinvention ? ' + REINVENTION ON' : ''} — public character/relation conduct advisory only`,
    );
  }
  if (learnerDrift) {
    console.log('learner DRIFT ON — public learner stance may harden or soften from recent dialogue only');
  }
  if (ownershipProof) {
    console.log('learner OWNERSHIP PROOF ON — tutor sees public ownership target; proof control remains dominant');
  }
  if (ownershipTransferGate) {
    console.log('learner OWNERSHIP TRANSFER GATE ON — near-transfer check is conduct-only before closure');
  }
  if (learnerProxyDag) {
    console.log('learner PROXY DAG MEMORY ON — private learner record sketch from visible board state only');
  }
  if (proxyDagPacing) {
    console.log('tutor   PROXY DAG PACING ON — external learner-DAG assessment advises pacing; no release authority');
  }
  if (tutorLearnerDag) {
    console.log('tutor   LEARNER DAG MODEL ON — redacted reconstruction of the learner-owned proof sketch');
  }
  if (decay) {
    console.log(
      `decay   seed ${decay.seed} · rate ${decay.rate} · grace ${decay.graceTurns} · maxConcurrent ${decay.maxConcurrent} · from turn ${decay.startTurn}${decay.mutateShare ? ` · mutateShare ${decay.mutateShare} (slips may misremember, not just vanish)` : ''}${decay.pool === 'staged' ? ' · pool STAGED (false forms confuse only met-on-stage names)' : ''}`,
    );
    console.log(
      decayVisibility === 'conduct'
        ? 'decay   visibility CONDUCT — SLIPPED block suppressed; the tutor must read decay off the learner'
        : 'decay   visibility told — the tutor ego prompt carries the SLIPPED block',
    );
  }

  const client = makeLlmClient({ mode });
  const counselText = counsel ? counsel.paragraph : null;
  const actsMode = Boolean(acts);
  const roles = {
    director: makeLlmDirector(world, client, {
      dials,
      dramaturgy,
      counsel: counselText,
      actsMode,
      publicRegister,
      castLayer,
      castReinvention,
    }),
    tutor: makeLlmTutor(world, client, {
      script,
      dials,
      superego,
      stallWatch,
      counsel: counselText,
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
      conductProgressPolicy,
      guardSpec,
      plot,
      throughline,
      rhetoricalPolicy,
      discursiveCalibration,
      didacticMode,
      fieldPlanner,
      fieldPlannerEnforce,
      castLayer,
      castReinvention,
      ownershipTarget: world.ownershipTarget,
      ownershipProof,
      ownershipTransferGate,
      publicRegister,
      strategyLedger: Boolean(strategyLedger),
      strategyLedgerV2: Boolean(strategyLedger?.trialling),
      strategyLedgerPlanMode: Boolean(strategyLedger?.planMode),
      lemmaLayer: lemmaLayer || false,
    }),
    learner: makeLlmLearner({
      setting: world.setting,
      voice: learnerVoice || learnerVoiceForWorld(world),
      client,
      publicRegister,
      assertionGroundingGate,
      sameTurnAssertionAffordance,
      cast: world.cast,
      castLayer,
      learnerDrift: world.learnerDrift,
      learnerDriftLayer: learnerDrift,
      learnerLedger,
    }),
  };

  // One compact line per completed turn — the shell's live pulse.
  const onTurn = (s) => {
    live.turn(s);
    const bits = [`  t${String(s.turn).padStart(2, '0')}/${s.turnCap}`, `D=${s.D}${s.forced ? ' FORCED' : ''}`];
    if (s.released.length) bits.push(`▲ ${s.released.map((f) => f.join(' ')).join('; ')}`);
    if (s.adopted) bits.push(`+${s.adopted} adopted`);
    if (s.retracted) bits.push(`−${s.retracted} retracted`);
    if (s.exchange?.type) bits.push(`exchange ${s.exchange.type}`);
    if (s.exchange?.tempo) bits.push(`tempo ${s.exchange.tempo}`);
    if (s.didacticMode?.recommendedMode) {
      bits.push(`didactic ${s.didacticMode.recommendedMode}/${s.didacticMode.learningSignal || 'unknown'}`);
    }
    if (s.fieldPlanner?.selectedMoveFamily) {
      bits.push(
        `field ${s.fieldPlanner.selectedMoveFamily}${s.fieldPlanner.targetPremise ? `/${s.fieldPlanner.targetPremise}` : ''}${s.fieldPlanner.efficacy ? `/${s.fieldPlanner.efficacy}` : ''}`,
      );
    }
    if (s.castState?.tutor?.currentStance) bits.push(`cast ${s.castState.tutor.currentStance}`);
    if (s.tutorReinvention?.active) bits.push(`reinvent ${s.tutorReinvention.toStance}`);
    if (s.learnerDrift?.mode) bits.push(`L-drift ${s.learnerDrift.mode}`);
    if (s.learnerTransformation?.status) {
      bits.push(
        `own ${s.learnerTransformation.status}${s.learnerTransformation.complete ? '✓' : ''}/${
          s.learnerTransformation.ownershipLevel || 'unknown'
        }${s.learnerTransformation.lateOwnershipCheck ? '/late-check' : ''}${
          s.learnerTransformation.transferGateActive ? '/transfer-gate' : ''
        }`,
      );
    }
    if (s.learnerTransformationPost?.status) {
      bits.push(
        `own-post ${s.learnerTransformationPost.status}${s.learnerTransformationPost.complete ? '✓' : ''}/${
          s.learnerTransformationPost.ownershipLevel || 'unknown'
        }`,
      );
    }
    if (s.proxyDagPacing?.recommendedAction) bits.push(`proxy-dag ${s.proxyDagPacing.recommendedAction}`);
    if (s.closedScene) bits.push(`scene ${s.closedScene.index} ${s.closedScene.status}`);
    if (s.strategyLedger?.commitment) {
      const c = s.strategyLedger.commitment;
      bits.push(`⚖ commit ${[c.register, c.didacticDefault, c.releasePosture].filter(Boolean).join('/') || 'scene'}`);
    }
    if (s.strategyLedger?.audit) bits.push(`⚖ audit s${s.strategyLedger.audit.sceneIndex}`);
    if (s.strategyLedger?.block) {
      bits.push(
        `▤ block ${s.strategyLedger.block.type}${s.strategyLedger.block.heldMode ? `/${s.strategyLedger.block.heldMode}` : ''}`,
      );
    }
    if (s.learnerLedger?.intent) bits.push('◆ L-intent');
    if (s.learnerLedger?.carry) bits.push('◆ L-carry');
    if (s.phase && s.phase.turn === s.turn) bits.push(`movement "${s.phase.name}"`);
    if (s.intervened) bits.push('✎ superego');
    if (s.asserted) bits.push('ASSERTS');
    for (const e of s.events) {
      if (e.type === 'decay' || e.type === 'repair') continue; // dedicated bits below carry the ids
      bits.push(`⚑ ${e.type}`);
    }
    if (s.decayedNow?.length) bits.push(`☄ ${s.decayedNow.join(', ')} fades`);
    if (s.repairedNow?.length) bits.push(`✚ ${s.repairedNow.join(', ')} restored`);
    if (typeof s.F === 'number') bits.push(`F=${s.F.toFixed(2)}`);
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
        logicProjection: true,
        characterArc,
        learnerProxyDag,
        proxyDagPacing,
        tutorLearnerDag,
        fieldPlanner,
        fieldPlannerEnforce,
        directorCadence,
        stagePrologue,
        publicRegister,
        ...(sceneMode ? { sceneMode } : {}),
        ...(decay ? { decay } : {}),
        ...(acts ? { acts } : {}),
        ...(strategyLedger ? { strategyLedger } : {}),
        ...(lemmaLayer ? { lemmaLayer } : {}),
        ...(learnerMirrorRefusal ? { learnerMirrorRefusal } : {}),
        ...(registerRouter ? { registerRouter } : {}),
        ...(learnerLedger ? { learnerLedger } : {}),
        ...(proofDebtGuard ? { proofDebtGuard } : {}),
        ...(conductPolicy ? { conductPolicy } : {}),
        ...(conductPolicyEnforce ? { conductPolicyEnforce } : {}),
        ...(conductProgressPolicy ? { conductProgressPolicy } : {}),
        ...(guardSpec ? { guardSpec } : {}),
      },
    });
    live.finalizing();
  } catch (err) {
    live.fail(err);
    throw err;
  }
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
    // Stage v2 condition (normalized) + arm dial — null/false on v1 runs.
    actsConfig: acts || null,
    // Scene/exchange overlay — null on old turn-level runs.
    sceneMode: sceneMode || null,
    // Strategy ledger dials (LAYERED-DECISION-LOOPS-PLAN.md) — null/false off.
    strategyLedger: strategyLedger || null,
    learnerLedger,
    // Lemma layer (LEMMA-LAYER-PREREGISTRATION.md) — null off.
    lemmaLayer: lemmaLayer || null,
    directorCadence,
    stagePrologue,
    publicRegister,
    reconstruct,
    // P1 dials — false on every run before 2026-06-11.
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
    // Step-1 V arm (the visible-signal guard) — false on every run before
    // 2026-06-13. Recorded as its own top-level flag, distinct from pacingGuard,
    // so the failure-mode classifier's guardStateOf and the Step-1 analysis read
    // V apart from H.
    visibleGuard,
    proofDebtGuard,
    conductPolicy,
    conductPolicyEnforce,
    conductProgressPolicy,
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
    // §12 dial (the repair clause) — false on every run before 2026-06-12.
    repairClause,
    // P2/C1 dial — false on every run before 2026-06-12. Named plotDial so it
    // can't collide with diagnose()'s `plot` report (the audit/discipline
    // block, present only when the arm produced plots).
    plotDial: plot,
    // Two-layer dial (§11 pre-run amendment) — false on every run before
    // 2026-06-12. Same naming rule as plotDial.
    throughlineDial: throughline,
    rhetoricalPolicy: rhetoricalPolicy || null,
    discursiveCalibration,
    didacticMode,
    fieldPlanner,
    fieldPlannerEnforce,
    castLayer,
    castReinvention,
    learnerDrift,
    characterArc,
    ownershipProof,
    ownershipTransferGate,
    learnerProxyDag,
    proxyDagPacing,
    tutorLearnerDag,
    elapsedMs,
    usage,
    ...diagnose(result, world),
  };

  // Drama artifacts land before the critic runs: a critic failure (CLI not
  // installed, quota window closed) must never cost the run itself.
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'diagnosis.json'), `${JSON.stringify(diagnosis, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  const dialogueReport = buildDialogueReport(result, world, { label, diagnosis });
  for (const [filename, content] of Object.entries(renderDialogueReportArtifacts(dialogueReport))) {
    fs.writeFileSync(path.join(outDir, filename), content);
  }

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
  live.complete({ result, diagnosis });

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
  if (diagnosis.proofDebt) {
    const p = diagnosis.proofDebt;
    console.log(
      `proof   debt detected on ${p.detectedTurns} turns (${p.debtsDetected} debts), restore actions ${p.actionTurns} (forced ${p.forcedMoves}, repaired ${p.repairedTargets})${p.targets.length ? `: ${p.targets.join(', ')}` : ''}`,
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
    `artifacts ${path.relative(ROOT, outDir)}/{transcript.md, diagnosis.json, result.json, dialogue-report.md, dialogue-report.json, dynamic-field.svg${commentaryEmbed ? ', commentary.md' : ''}}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
