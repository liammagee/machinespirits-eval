/**
 * Scene/exchange mode and rhetorical move policy.
 *
 * These tests pin the compatibility boundary: the overlay is absent unless
 * requested, records phatic/confusion exchanges when enabled, and gives the
 * tutor an advisory figure distribution without changing the old role path.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadWorld,
  runDrama,
  makeMockDirector,
  makeMockTutor,
  makeMockLearner,
  makeLlmDirector,
  makeLlmTutor,
  diagnose,
  renderEvalPanel,
  renderTranscript,
  normalizeSceneConfig,
  normalizeSceneTempoConfig,
  normalizeDirectorCadence,
  normalizeRhetoricalPolicyConfig,
  normalizePublicRegister,
  describePublicRegister,
  classifyCognitiveTempo,
  detectPhaticRecognition,
  estimateRecognitionNeed,
  recommendSceneTempoBeat,
  recommendRhetoricalMove,
  sanitizePublicDialogue,
} from '../services/dramaticDerivation/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-000-smoke.yaml'));
const SCRIPT = fs.readFileSync(path.join(ROOT, 'config/drama-derivation/tutor-scripts/nocturne-v001.md'), 'utf8');

const mockRoles = (policy = {}) => ({
  director: makeMockDirector(world),
  tutor: makeMockTutor(world),
  learner: makeMockLearner(policy),
});

function stubClient(replies) {
  const calls = [];
  const remaining = new Map(Object.entries(replies).map(([role, list]) => [role, [...list]]));
  return {
    calls,
    client: {
      mode: 'mock',
      usage: () => ({}),
      async call(role, payload) {
        calls.push({ role, ...payload });
        const queue = remaining.get(role);
        if (!queue || !queue.length) throw new Error(`stubClient: no reply queued for ${role}`);
        const next = queue.shift();
        return typeof next === 'string' ? next : JSON.stringify(next);
      },
    },
  };
}

test('scene mode is opt-in and records scene/exchange summaries when enabled', async () => {
  const off = await runDrama({ world, roles: mockRoles() });
  assert.equal('scenes' in off, false);
  assert.equal('scenes' in diagnose(off, world), false);

  const on = await runDrama({
    world,
    roles: mockRoles(),
    options: { sceneMode: { maxExchanges: 4, maxPhaticExchanges: 2 } },
  });
  assert.ok(on.scenes.length > 0);
  assert.ok(on.transcript.some((line) => line.meta?.scene));
  assert.ok(on.transcript.some((line) => line.role === 'learner' && line.meta?.exchange));

  const d = diagnose(on, world);
  assert.equal(d.scenes.count, on.scenes.length);
  assert.ok(d.scenes.exchanges > 0);
  assert.match(renderEvalPanel(d), /\*\*scenes\*\*/);
});

test('phatic exchanges close a scene on the drift guard budget', async () => {
  let turns = 0;
  const phaticLearner = async () => {
    turns += 1;
    return { dialogue: turns <= 2 ? 'I see.' : 'I am still listening.' };
  };
  const result = await runDrama({
    world,
    roles: {
      director: makeMockDirector(world),
      tutor: makeMockTutor(world),
      learner: phaticLearner,
    },
    options: { sceneMode: { maxExchanges: 4, maxPhaticExchanges: 2 } },
  });
  assert.ok(result.scenes.some((scene) => scene.status === 'drift_guard'));
  assert.ok(result.events.some((event) => event.type === 'scene_close' && /drift_guard/.test(event.detail)));
});

test('scene director cadence skips ordinary continuation turns but keeps boundaries and exhibit turns', async () => {
  const result = await runDrama({
    world,
    roles: mockRoles(),
    options: {
      sceneMode: { maxExchanges: 4, maxPhaticExchanges: 2 },
      directorCadence: 'scene',
    },
  });
  const directorTurns = result.transcript.filter((line) => line.role === 'director').map((line) => line.turn);
  assert.equal(result.directorCadence, 'scene');
  assert.ok(directorTurns.length < result.turnsPlayed);
  assert.ok(directorTurns.includes(1), 'scene opening should keep the director');
  assert.ok(directorTurns.includes(2), 'director-owned release should keep the director');
  assert.ok(directorTurns.includes(5), 'tutor-owned scheduled exhibit turn should keep the director');
  assert.equal(normalizeDirectorCadence(null, { sceneMode: true }), 'scene');
  assert.equal(normalizeDirectorCadence(null, { sceneMode: false }), 'turn');
});

test('scene tempo selects public beats and records them on exchanges', async () => {
  const sceneMode = normalizeSceneConfig({
    maxExchanges: 4,
    maxPhaticExchanges: 3,
    closeOnDDecrease: false,
    tempo: {
      mode: 'deterministic',
      seed: 7,
      weights: {
        uptake_only: 1,
        repair_request: 0,
        recap: 0,
        hesitation: 0,
        hypothesis: 0,
        evidence: 0,
        recognition: 0,
      },
    },
  });
  assert.equal(sceneMode.tempo.mode, 'deterministic');
  assert.equal(normalizeSceneTempoConfig(false), null);

  const tutorViews = [];
  const learnerViews = [];
  let tutorTurn = 0;
  const result = await runDrama({
    world,
    roles: {
      director: makeMockDirector(world),
      tutor: async (view) => {
        tutorTurn += 1;
        tutorViews.push(JSON.parse(JSON.stringify(view)));
        return {
          dialogue: tutorTurn === 1 ? 'Yes, your last line can rest here.' : 'Hold the new note briefly.',
          move: { figure: 'erotema', targetPremise: null, intent: 'consolidate' },
        };
      },
      learner: async (view) => {
        learnerViews.push(JSON.parse(JSON.stringify(view)));
        return view.releasedThisTurn.length
          ? { dialogue: 'I take the new note.', adopt: view.releasedThisTurn }
          : { dialogue: 'I see what you mean about that link.' };
      },
    },
    options: { sceneMode, maxTurns: 2 },
  });

  assert.equal(tutorViews[0].scene.tempo.beat, 'uptake_only');
  assert.equal(learnerViews[0].scene.tempo.beat, 'uptake_only');
  assert.equal(learnerViews[1].scene.tempo.beat, 'evidence');
  assert.deepEqual(result.scenes[0].exchanges.map((exchange) => exchange.tempo), ['uptake_only', 'evidence']);
  assert.deepEqual(
    result.transcript
      .find((line) => line.role === 'tutor' && line.turn === 1)
      .meta.phaticRecognition.map((signal) => signal.type),
    ['affirms_learner_uptake', 'uses_learner_language'],
  );
  assert.deepEqual(
    result.transcript
      .find((line) => line.role === 'learner' && line.turn === 1)
      .meta.phaticRecognition.map((signal) => signal.type),
    ['acknowledges_tutor_guidance', 'marks_tutor_line'],
  );
  assert.deepEqual(result.scenes[0].exchanges[0].phaticRecognition.map((signal) => signal.type), [
    'acknowledges_tutor_guidance',
    'marks_tutor_line',
  ]);
  const d = diagnose(result, world);
  assert.equal(d.scenes.tempoBeats.uptake_only, 1);
  assert.equal(d.scenes.tempoBeats.evidence, 1);
  assert.equal(d.scenes.cognitiveTempo.situated_uptake, 1);
  assert.equal(d.scenes.phaticRecognition.total, 4);
  assert.equal(d.scenes.phaticRecognition.byRole.tutor, 2);
  assert.equal(d.scenes.phaticRecognition.byRole.learner, 2);
  assert.match(renderTranscript(result, world), /Tempo: uptake only/);
  assert.match(renderTranscript(result, world), /phatic recognition: acknowledges tutor guidance/);
  assert.match(renderTranscript(result, world), /cognitive tempo: situated uptake/);
  assert.match(renderEvalPanel(d), /tempo: uptake only 1 · evidence 1/);
  assert.match(renderEvalPanel(d), /cognitive tempo: situated uptake 1 · deliberative 1/);
  assert.match(
    renderEvalPanel(d),
    /phatic recognition: affirms learner uptake 1 · uses learner language 1 · acknowledges tutor guidance 1 · marks tutor line 1/,
  );

  const recommended = recommendSceneTempoBeat(
    world,
    { index: 1, exchanges: [], counts: { phatic: 0 } },
    { turn: 1 },
    sceneMode.tempo,
  );
  assert.equal(recommended.beat, 'uptake_only');
  assert.deepEqual(
    detectPhaticRecognition('Yes.', {
      role: 'learner',
      exchangeType: 'phatic_ack',
    }),
    [],
  );
  assert.equal(
    classifyCognitiveTempo({ dialogue: 'Yes.', exchangeType: 'phatic_ack' }).mode,
    'fast_reflex',
  );
  assert.deepEqual(
    detectPhaticRecognition('Wait, you lost me there. Can we go back one step?', {
      role: 'learner',
      exchangeType: 'repair_request',
    }).map((signal) => signal.type),
    ['requests_tutor_repair'],
  );

  const reflexScene = {
    index: 2,
    exchanges: [
      {
        type: 'phatic_ack',
        cognitiveTempo: { mode: 'fast_reflex' },
        phaticRecognition: [],
        countsForProgress: false,
        dDelta: 0,
      },
    ],
    counts: { phatic: 1, substantive: 0, confusion: 0, repairRequest: 0, assertion: 0, situatedUptake: 0 },
  };
  const need = estimateRecognitionNeed(reflexScene);
  assert.equal(need.level, 'medium');
  assert.ok(need.sources.includes('fast_reflex_punctuation'));
  const recognitionTempo = normalizeSceneTempoConfig({
    mode: 'deterministic',
    weights: {
      uptake_only: 0.01,
      repair_request: 0,
      recap: 0,
      hesitation: 0,
      hypothesis: 0,
      evidence: 0,
      recognition: 0,
    },
  });
  assert.equal(
    recommendSceneTempoBeat(world, reflexScene, { turn: 3, recognitionNeed: need }, recognitionTempo).beat,
    'recap',
  );
});

test('public dialogue sanitizer strips proof-interface labels from spoken text', () => {
  const scrubbed = sanitizePublicDialogue(
    'R2_succession needs the second conjunct on my board; signedBy(gatePass, ?x) is the predicate for p3.',
  );
  assert.doesNotMatch(scrubbed, /R2_succession|conjunct|board|signedBy|predicate|p3/);
  assert.match(scrubbed, /succession rule/);
  assert.match(scrubbed, /record/);
});

test('public register defaults to run-level sampling for scene/rhetoric runs', () => {
  const sceneDefault = normalizePublicRegister(null, { sceneMode: true });
  const rhetoricDefault = normalizePublicRegister(null, { rhetoricalPolicy: true });
  assert.equal(sceneDefault.mode, 'sample');
  assert.equal(sceneDefault.scope, 'run');
  assert.deepEqual(sceneDefault.palette, ['modern', 'default', 'period']);
  assert.equal(rhetoricDefault.mode, 'sample');
  assert.equal(normalizePublicRegister(null), 'default');
  assert.match(describePublicRegister(sceneDefault), /sample\/run seed 1/);
});

test('modern register uses contemporary public terms when explicitly selected', () => {
  const scrubbed = sanitizePublicDialogue(
    'R2_succession needs the second conjunct on my board; the sealed paper is the next exhibit in the hall.',
    { register: 'modern' },
  );
  assert.doesNotMatch(scrubbed, /R2_succession|conjunct|board|exhibit|hall|sealed paper/);
  assert.match(scrubbed, /succession rule/);
  assert.match(scrubbed, /notes/);
  assert.match(scrubbed, /detail/);
  assert.match(scrubbed, /room/);
  assert.equal(sanitizePublicDialogue('A new record lands on the table.', { register: 'modern' }), 'A new note lands on the table.');
});

test('sampled public register is chosen once and annotates transcript lines', async () => {
  const publicRegister = normalizePublicRegister({ mode: 'sample', seed: 3 });
  const result = await runDrama({
    world,
    roles: mockRoles(),
    options: {
      sceneMode: { maxExchanges: 4, maxPhaticExchanges: 2 },
      publicRegister,
      stagePrologue: true,
    },
  });
  assert.equal(result.publicRegister.mode, 'sample');
  assert.equal(result.publicRegisters.length, 1);
  assert.equal(result.publicRegisters[0].turn, 0);
  assert.equal(result.publicRegisters[0].scope, 'run');
  const annotated = result.transcript.filter((line) => line.meta?.publicRegister);
  assert.ok(annotated.length > 0);
  assert.ok(annotated.every((line) => line.meta.publicRegister === result.publicRegisters[0].register));
  const md = renderTranscript(result, world);
  assert.match(md, /sampled register:/);
  assert.doesNotMatch(md, /register .+ — Turn/);
});

test('director prologue is public character context, not a formal turn', async () => {
  const tutorViews = [];
  const learnerViews = [];
  const tutor = makeMockTutor(world);
  const learner = makeMockLearner();
  const result = await runDrama({
    world,
    roles: {
      director: makeMockDirector(world),
      tutor: async (view) => {
        tutorViews.push(JSON.parse(JSON.stringify(view)));
        return tutor(view);
      },
      learner: async (view) => {
        learnerViews.push(JSON.parse(JSON.stringify(view)));
        return learner(view);
      },
    },
    options: { stagePrologue: true, maxTurns: 2 },
  });
  assert.equal(result.transcript[0].turn, 0);
  assert.equal(result.transcript[0].role, 'director');
  assert.ok(result.transcript[0].meta.prologue);
  assert.ok(result.stagePrologue.tutorCharacter);
  assert.ok(tutorViews[0].stagePrologue);
  assert.ok(learnerViews[0].stagePrologue);
  assert.equal(result.trajectory[0].turn, 1);
  assert.equal(result.ledger[0].turn, 2);
  const md = renderTranscript(result, world);
  assert.match(md, /Director's opening notes/);
  assert.match(md, /Tutor:/);
  assert.doesNotMatch(md, /### Turn 0/);
});

test('LLM director prologue charter frames period register through characters', async () => {
  const { client, calls } = stubClient({
    director: [
      {
        stage_notes: 'R2_succession should not appear on my board.',
        tutor_character: 'The tutor is exact but warm.',
        learner_character: 'The learner is cautious and asks for ordinary reasons.',
        register_note: 'Period color follows these people, not generic Elizabethan costume.',
      },
    ],
  });
  const director = makeLlmDirector(world, client, { publicRegister: 'modern' });
  const prologue = await director.prologue({ turn: 0, publicRegister: 'modern' });
  assert.ok(calls[0].system.includes('For period register: refine the period color from these public character'));
  assert.doesNotMatch(prologue.stageNotes, /R2_succession|board/);
  assert.match(prologue.stageNotes, /succession rule/);
  assert.match(prologue.stageNotes, /notes/);
  assert.match(prologue.registerNote, /Period color follows/);
});

test('rhetorical policy prompt is advisory and records the selected distribution', async () => {
  const { client, calls } = stubClient({
    tutor: [
      {
        dialogue: 'Let us keep the next link small.',
        move: { figure: 'erotema', target_premise: null, intent: 'test' },
      },
    ],
  });
  const tutor = makeLlmTutor(world, client, { script: SCRIPT, rhetoricalPolicy: true });
  const out = await tutor({
    turn: 1,
    role: 'tutor',
    world,
    ledger: [],
    releasedFacts: [],
    transcript: [{ turn: 1, role: 'learner', text: 'I see.', meta: { exchange: { type: 'phatic_ack' } } }],
    staging: { phase: null },
    trajectory: [],
    learnerAbox: { grounded: world.background, hypotheses: [] },
    inference: { frontier: [], voiced: [], overreachCount: 0 },
  });
  const tutorCall = calls.find((call) => call.role === 'tutor');
  assert.ok(tutorCall.system.includes('# The rhetorical move policy'));
  assert.ok(tutorCall.user.includes('RHETORICAL MOVE POLICY'));
  assert.equal(out.rhetoricalPolicy.schema, 'dramatic-derivation.rhetorical-policy.v0');
  assert.ok(out.rhetoricalPolicy.distribution.length > 0);
});

test('rhetorical policy supports seeded sampling over the same distribution', () => {
  const view = {
    turn: 3,
    ledger: [{ turn: 2, premiseId: 'p1' }],
    transcript: [{ turn: 2, role: 'learner', text: 'No sorry, you lost me.', meta: { exchange: { type: 'confusion' } } }],
    trajectory: [{ turn: 2, D: 3 }],
    learnerAbox: { grounded: world.background, hypotheses: [] },
    inference: { frontier: [] },
  };
  const deterministic = recommendRhetoricalMove(world, view, {}, normalizeRhetoricalPolicyConfig(true));
  const sampled = recommendRhetoricalMove(
    world,
    view,
    {},
    normalizeRhetoricalPolicyConfig({ mode: 'sample', seed: 7, temperature: 1 }),
  );
  assert.equal(deterministic.distribution.length, sampled.distribution.length);
  assert.equal(sampled.mode, 'sample');
  assert.ok(sampled.selected.figure);
  assert.deepEqual(normalizeSceneConfig('on'), {
    maxExchanges: 4,
    maxPhaticExchanges: 2,
    closeOnDDecrease: true,
    closeOnConfusion: true,
    tempo: null,
  });
});

test('recognition need biases rhetorical policy without changing proof state', () => {
  const view = {
    turn: 4,
    ledger: [{ turn: 2, premiseId: 'p1' }],
    transcript: [{ turn: 3, role: 'learner', text: 'Yes.', meta: { exchange: { type: 'phatic_ack' } } }],
    trajectory: [{ turn: 3, D: 2 }],
    learnerAbox: { grounded: world.background, hypotheses: [] },
    inference: { frontier: [] },
    scene: {
      index: 1,
      recognitionNeed: {
        debt: 0.8,
        level: 'high',
        sources: ['fast_reflex_punctuation'],
        desiredActs: ['invite_situated_uptake'],
      },
    },
  };
  const advice = recommendRhetoricalMove(world, view, {}, normalizeRhetoricalPolicyConfig(true));
  assert.equal(advice.selected.stance, 'recognitive_recap');
  assert.ok(advice.distribution.some((row) => row.stance === 'situated_uptake_check'));
});
