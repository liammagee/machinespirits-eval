#!/usr/bin/env node
/**
 * Lemma-layer implementation gates (LEMMA-LAYER-PREREGISTRATION.md).
 * Zero-paid, fully deterministic: llmRoles bridges on the mock client.
 * All gates run on world-005-marrick (the hand-validated RICH world:
 * alpha/beta sub-chains, width-2 frontier, one AND-join).
 *
 *   G1  display is conduct-only: off vs display proof fingerprints
 *       byte-identical; display emits no binding events
 *   G2  bind stays inside proof discipline: no leaks, t_min floor
 *       respected, released set identical to off (mock determinism)
 *   G3  determinism: two identical bind runs are byte-identical
 *   G4  frontier choices: every multi-frontier scene opening gets a tutor
 *       choice (coverage 1.0), labels legal, machinery-attributed
 *   G5  clearance progression: lemmas ground in dependency order and the
 *       goal grounds exactly when the drama does
 *   G6  departures: a schedule that forces a cross-chain tutor claim
 *       yields a TAGGED departure (and no block)
 *   G7  blocks: the same schedule with the mockUntagged knob yields a
 *       lemma_block, and the held exhibit is later harness-forced through
 *       (forced passthrough logged, never lost)
 *   G8  decay coexistence: bind + decay runs clean; any regression events
 *       are coherently recorded
 *   G9  learner concealment at the prompt layer: learner prompts never
 *       carry an ungrounded lemma's tokens
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import {
  loadWorld,
  makeLlmClient,
  makeLlmDirector,
  makeLlmLearner,
  makeLlmTutor,
  normalizeLemmaConfig,
  runDrama,
} from '../services/dramaticDerivation/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORLD_PATH = path.join(ROOT, 'config/drama-derivation/world-005-marrick.yaml');
const SCRIPT_PATH = path.join(ROOT, 'config/drama-derivation/tutor-scripts/marrick-v001.md');

const rows = [];
function check(id, ok, detail) {
  rows.push({ id, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${detail}`);
}

function llmCast(world, script, client, { lemmaLayer = false } = {}) {
  return {
    director: makeLlmDirector(world, client, {}),
    tutor: makeLlmTutor(world, client, {
      script,
      didacticMode: true,
      publicRegister: 'modern',
      releaseAuthority: true,
      pacingGuard: true,
      lemmaLayer,
    }),
    learner: makeLlmLearner({
      setting: world.setting,
      voice: world.learnerVoice || 'plain, careful, first person',
      client,
      publicRegister: 'modern',
    }),
  };
}

const baseOptions = { sceneMode: true, publicRegister: 'modern', stopOnStall: false };
const fingerprint = (result) =>
  JSON.stringify({ ledger: result.ledger, trajectory: result.trajectory, verdict: result.verdict });
const lemmaEvents = (result, type) => (result.events || []).filter((e) => e.type === type);

async function run(world, script, { lemma = null, options = {}, captureClient = null } = {}) {
  const client = captureClient || makeLlmClient({ mode: 'mock' });
  return runDrama({
    world,
    roles: llmCast(world, script, client, { lemmaLayer: lemma || false }),
    options: {
      ...baseOptions,
      ...(lemma ? { lemmaLayer: lemma } : {}),
      ...options,
    },
  });
}

/**
 * Fixture: marrick with the beta-chain opener (p_flaw) scheduled as a TUTOR
 * exhibit at turn 4, before any beta lemma can be active (the mock always
 * picks the first frontier label, blankFrom) — a guaranteed cross-chain
 * voluntary claim. p_alloy takes p_flaw's old slot; every release turn is
 * unchanged, so slope and t_min discipline hold.
 */
function departureFixture() {
  const raw = yaml.load(fs.readFileSync(WORLD_PATH, 'utf8'));
  const byPremise = new Map(raw.release_schedule.map((e) => [e.premise, e]));
  byPremise.get('p_flaw').turn = 4;
  byPremise.get('p_flaw').via = 'tutor';
  byPremise.get('p_alloy').turn = 14;
  byPremise.get('p_alloy').via = 'tutor';
  const tmp = path.join(os.tmpdir(), `lemma-gate-fixture-${process.pid}.yaml`);
  fs.writeFileSync(tmp, yaml.dump(raw));
  const world = loadWorld(tmp);
  fs.unlinkSync(tmp);
  return world;
}

async function main() {
  const world = loadWorld(WORLD_PATH);
  const script = fs.readFileSync(SCRIPT_PATH, 'utf8');

  // G1 — display is conduct-only
  const off = await run(world, script);
  const display = await run(world, script, { lemma: normalizeLemmaConfig({ display: true }) });
  check(
    'G1-fingerprint',
    fingerprint(off) === fingerprint(display),
    'off vs display proof fingerprints byte-identical',
  );
  const displayBindingEvents = ['lemma_choice', 'lemma_departure', 'lemma_block', 'lemma_passthrough'].flatMap((t) =>
    lemmaEvents(display, t),
  );
  check('G1-no-binding', displayBindingEvents.length === 0, 'display emits no binding events');
  check(
    'G1-map-live',
    lemmaEvents(display, 'lemma_grounded').length >= 4 && display.lemmaLayer?.config?.display === true,
    'display still records clearance (the map is live, just unbound)',
  );

  // G2 — bind stays inside proof discipline
  const bind = await run(world, script, { lemma: normalizeLemmaConfig({ bind: true }) });
  check('G2-leaks', lemmaEvents(bind, 'leak').length === 0, 'bind: no leak events');
  check(
    'G2-tmin',
    bind.firstForcedTurn === null || bind.firstForcedTurn >= world.slope.t_min,
    `bind: forcing respects the t_min floor (forced@${bind.firstForcedTurn}, floor ${world.slope.t_min})`,
  );
  const releasedIds = (r) =>
    (r.ledger || [])
      .map((row) => row.premiseId)
      .sort()
      .join(',');
  check('G2-released-set', releasedIds(off) === releasedIds(bind), 'bind: released premise SET matches off (mock)');
  check('G2-grounded', bind.verdict === 'grounded_anagnorisis', `bind: drama still grounds (${bind.verdict})`);

  // G3 — determinism
  const bind2 = await run(world, script, { lemma: normalizeLemmaConfig({ bind: true }) });
  check(
    'G3-deterministic',
    fingerprint(bind) === fingerprint(bind2) && JSON.stringify(bind.lemmaLayer) === JSON.stringify(bind2.lemmaLayer),
    'two identical bind runs byte-identical (proof + lemma record)',
  );

  // G4 — frontier choices
  const cov = bind.lemmaLayer.frontierCoverage;
  check(
    'G4-coverage',
    cov.multiFrontierOpenings > 0 && cov.tutorChoices === cov.multiFrontierOpenings,
    `every multi-frontier opening chosen by the tutor (${cov.tutorChoices}/${cov.multiFrontierOpenings})`,
  );
  const labels = new Set(bind.lemmaLayer.nodes.map((n) => n.label));
  check(
    'G4-legal-labels',
    bind.lemmaLayer.choices.every((c) => labels.has(c.label)),
    'every recorded choice names a real lemma',
  );
  check(
    'G4-attributed',
    bind.lemmaLayer.choices.every((c) =>
      ['tutor', 'tutor_retry', 'delegate', 'auto', 'fallback', 'auto_advance'].includes(c.by),
    ),
    'every choice carries its attribution',
  );

  // G5 — clearance progression
  const cleared = bind.lemmaLayer.clearedAt;
  const nodeByLabel = new Map(bind.lemmaLayer.nodes.map((n) => [n.label, n]));
  const goalLabel = bind.lemmaLayer.nodes.find((n) => n.isGoal)?.label;
  const depOrderOk = Object.entries(cleared).every(([label, turn]) => {
    const node = nodeByLabel.get(label);
    // a lemma's support premises must all be released by its clearing turn
    return node.support.every((id) => (bind.ledger.find((row) => row.premiseId === id)?.turn ?? Infinity) <= turn);
  });
  check('G5-dependency-order', depOrderOk, 'every lemma clears only after its support is on stage');
  check(
    'G5-goal',
    (cleared[goalLabel] === undefined) === (bind.verdict !== 'grounded_anagnorisis') ||
      cleared[goalLabel] <= (bind.assertedGroundedTurn ?? Infinity),
    'the goal lemma grounds exactly when the drama can',
  );

  // G6 — tagged departures on the cross-chain fixture
  const fixture = departureFixture();
  const dep = await run(fixture, script, { lemma: normalizeLemmaConfig({ bind: true }) });
  check(
    'G6-departure',
    lemmaEvents(dep, 'lemma_departure').length >= 1,
    `cross-chain claim rides a tagged departure (${lemmaEvents(dep, 'lemma_departure').length})`,
  );
  check('G6-no-block', lemmaEvents(dep, 'lemma_block').length === 0, 'tagged departures are never blocked');
  check(
    'G6-flaw-released',
    dep.ledger.some((row) => row.premiseId === 'p_flaw'),
    'the departing exhibit reaches the stage',
  );

  // G7 — untagged claims block, then harness-force through
  const blk = await run(fixture, script, { lemma: normalizeLemmaConfig({ bind: true, mockUntagged: true }) });
  const blocks = lemmaEvents(blk, 'lemma_block');
  check('G7-block', blocks.length >= 1, `untagged cross-chain claim is held (${blocks.length} block[s])`);
  const flawRow = blk.ledger.find((row) => row.premiseId === 'p_flaw');
  check(
    'G7-forced-through',
    Boolean(flawRow) && lemmaEvents(blk, 'lemma_passthrough').some((e) => e.detail.startsWith('p_flaw')),
    `the held exhibit is later harness-forced (released t${flawRow?.turn ?? '—'}, passthrough logged)`,
  );

  // G8 — decay coexistence
  const decayed = await run(world, script, {
    lemma: normalizeLemmaConfig({ bind: true }),
    options: { decay: { seed: 31, rate: 0.35, mutateShare: 0.5, maxConcurrent: 3 } },
  });
  check('G8-decay-clean', Boolean(decayed.lemmaLayer), `bind + decay runs clean (verdict ${decayed.verdict})`);
  const regressions = decayed.lemmaLayer.regressions;
  check(
    'G8-regressions-coherent',
    regressions.every((r) => decayed.lemmaLayer.clearedAt[r.label] !== undefined),
    `regressions (${regressions.length}) only on lemmas that had grounded`,
  );

  // G9 — learner concealment at the prompt layer
  const inner = makeLlmClient({ mode: 'mock' });
  const learnerPrompts = [];
  const spy = {
    ...inner,
    call: (role, args) => {
      if (role === 'learner') learnerPrompts.push(args.user || '');
      return inner.call(role, args);
    },
  };
  await run(world, script, { lemma: normalizeLemmaConfig({ bind: true }), captureClient: spy });
  const mirrorSeen = learnerPrompts.some((p) => p.includes('YOUR PROOF LEDGER'));
  check('G9-mirror-present', mirrorSeen, `learner mirror rendered in prompts (${learnerPrompts.length} captured)`);
  // Turn 1: nothing is grounded, so the mirror must carry NO lemma-label
  // token — the concealed entities exist only in premises/secret and the
  // world's single-concealment invariant already keeps them out of the rest
  // of the prompt, so any hit here would be the mirror leaking.
  const concealed = ['weirCrucible', 'wornBurin', 'notchedSerif', 'drossSilver', 'edony'];
  const firstPrompt = learnerPrompts[0] || '';
  check(
    'G9-concealment',
    firstPrompt.length > 0 && concealed.every((tok) => !firstPrompt.includes(tok)),
    'turn-1 learner prompt (nothing grounded) carries no concealed lemma token',
  );

  // G10/G11 — strategy refusal: mock knob relaxes the trigger so both
  // resolution paths run deterministically end-to-end.
  const defend = await run(world, script, { lemma: normalizeLemmaConfig({ bind: true, mockRefusal: 'defend' }) });
  const defended = defend.lemmaLayer.choices.filter((c) => c.refused && c.refusalOutcome === 'defended');
  check(
    'G10-refusal-defend',
    defended.length >= 1 && defended.every((c) => typeof c.defense === 'string' && c.defense.length > 0),
    `refusal fired and was DEFENDED with a recorded line (${defended.length})`,
  );
  const sw = await run(world, script, { lemma: normalizeLemmaConfig({ bind: true, mockRefusal: 'switch' }) });
  const switched = sw.lemmaLayer.choices.filter((c) => c.refused && c.refusalOutcome === 'switched');
  check(
    'G11-refusal-switch',
    switched.length >= 1 && switched.every((c) => c.label !== c.refusalPriorPick),
    `refusal fired and the pick SWITCHED chapters (${switched.length})`,
  );
  check(
    'G11-no-refusal-off-knob',
    (bind.lemmaLayer.choices || []).every((c) => !c.refused),
    'no refusal events under plain bind mock (no regressions at no-decay)',
  );

  // G12 — stall-triggered refusal (refusal-stall-trigger-codex.md): the
  // trigger source knob swaps regression evidence for the no-D-progress
  // span; both resolution paths run under the mock knob, and the recorded
  // choice must carry the stall attribution.
  const stallDefend = await run(world, script, {
    lemma: normalizeLemmaConfig({ bind: true, refusalTrigger: 'stall', mockRefusal: 'defend' }),
  });
  const stallDefended = stallDefend.lemmaLayer.choices.filter((c) => c.refused && c.refusalOutcome === 'defended');
  check(
    'G12-stall-refusal-defend',
    stallDefended.length >= 1 &&
      stallDefended.every(
        (c) =>
          c.refusalTrigger === 'stall' &&
          typeof c.stallSpanCited === 'number' &&
          c.stallSpanCited >= 1 &&
          typeof c.defense === 'string' &&
          c.defense.length > 0,
      ),
    `stall-triggered refusal DEFENDED with span cited (${stallDefended.length})`,
  );
  const stallSw = await run(world, script, {
    lemma: normalizeLemmaConfig({ bind: true, refusalTrigger: 'stall', mockRefusal: 'switch' }),
  });
  const stallSwitched = stallSw.lemmaLayer.choices.filter((c) => c.refused && c.refusalOutcome === 'switched');
  check(
    'G12-stall-refusal-switch',
    stallSwitched.length >= 1 &&
      stallSwitched.every((c) => c.refusalTrigger === 'stall' && c.label !== c.refusalPriorPick),
    `stall-triggered refusal SWITCHED chapters (${stallSwitched.length})`,
  );
  check(
    'G12-regression-default-unchanged',
    [...defended, ...switched].every((c) => c.refusalTrigger === 'regression' && c.stallSpanCited === undefined),
    'default trigger source still records as regression with no stall field',
  );

  const failed = rows.filter((r) => !r.ok);
  console.log(`\n${rows.length - failed.length}/${rows.length} lemma gates pass`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
