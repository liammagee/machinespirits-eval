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
  makeLlmTutor,
  diagnose,
  renderEvalPanel,
  normalizeSceneConfig,
  normalizeRhetoricalPolicyConfig,
  recommendRhetoricalMove,
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
  });
});
