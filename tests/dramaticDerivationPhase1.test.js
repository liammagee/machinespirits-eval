/**
 * Phase-1 guarantees for world-001 + the LLM role bridges
 * (notes/dramatic-derivation-plan.md §3 steps 2–4):
 *
 *   - world-001 passes plotLint and its release pacing respects the
 *     anti-aporia window (the schedule cannot stall an ideal learner);
 *   - K_L (the screened curtain-rise context) carries no concealed token;
 *   - the LEARNER bridge's prompts never see a concealed token before the
 *     drama releases it (single-concealment invariant at the prompt layer);
 *   - the bridges drive the full drama to grounded_anagnorisis in mock mode
 *     with every release on cue (mock-first: the paid path replays this).
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  factKey,
  loadWorld,
  plotLint,
  runDrama,
  makeLlmClient,
  makeLlmDirector,
  makeLlmTutor,
  makeLlmLearner,
  diagnose,
  releaseAdherence,
} from '../services/dramaticDerivation/index.js';
import { buildScreenSpec } from '../scripts/screen-derivation-world.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORLD_PATH = path.join(ROOT, 'config/drama-derivation/world-001-nocturne.yaml');
const SCRIPT_PATH = path.join(ROOT, 'config/drama-derivation/tutor-scripts/nocturne-v001.md');

const world = loadWorld(WORLD_PATH);
const script = fs.readFileSync(SCRIPT_PATH, 'utf8');

// Concealed particulars of world-001 (see the CONCEALMENT note in the world
// YAML header): they exist only in premises/secret, so no learner-facing
// text may carry them before release.
const CONCEALED_TOKENS = ['liane', 'vara', 'cradle', 'heron', 'galley', 'odile'];
const releaseTurnOf = (premiseId) => {
  const entry = world.releaseSchedule.find((e) => e.premise === premiseId);
  return entry ? entry.turn : Infinity;
};
// First turn each concealed token may lawfully reach the learner: the
// earliest release whose premise fact or surface mentions it.
const firstLawfulTurn = (token) => {
  let first = Infinity;
  for (const premise of world.premises) {
    const text = `${premise.fact.join(' ')} ${premise.surface || ''}`.toLowerCase();
    if (text.includes(token)) first = Math.min(first, releaseTurnOf(premise.id));
  }
  return first;
};

/** Wraps the mock client, recording every prompt the learner role receives. */
function recordingClient() {
  const inner = makeLlmClient({ mode: 'mock' });
  const learnerPrompts = []; // {turn-ish order, text}
  return {
    client: {
      mode: inner.mode,
      usage: inner.usage,
      call(role, payload) {
        if (role === 'learner') {
          learnerPrompts.push(`${payload.system}\n${payload.user}`.toLowerCase());
        }
        return inner.call(role, payload);
      },
    },
    learnerPrompts,
  };
}

function llmRoles(client) {
  return {
    director: makeLlmDirector(world, client),
    tutor: makeLlmTutor(world, client, { script }),
    learner: makeLlmLearner({ setting: world.setting, voice: world.learnerVoice, client }),
  };
}

// ---------------------------------------------------------------------------
// world-001: lint + pacing
// ---------------------------------------------------------------------------

test('world-001 passes plotLint with S first derivable at the planned recognition turn', () => {
  const lint = plotLint(world);
  assert.equal(lint.ok, true, lint.errors.join('; '));
  assert.equal(lint.firstEntailedTurn, 32);
  assert.ok(lint.firstEntailedTurn >= world.slope.t_min);
});

test('world-001 release pacing never opens a gap wider than the aporia window', () => {
  const turns = world.releaseSchedule.map((e) => e.turn);
  assert.ok(turns[0] <= world.slope.aporia_window, 'first release arrives inside the first window');
  for (let i = 1; i < turns.length; i += 1) {
    assert.ok(
      turns[i] - turns[i - 1] <= world.slope.aporia_window,
      `release gap ${turns[i - 1]} -> ${turns[i]} exceeds aporia window ${world.slope.aporia_window}`,
    );
  }
});

// ---------------------------------------------------------------------------
// K_L purity (the screened context is what the learner factory is built from)
// ---------------------------------------------------------------------------

test('K_L screen spec carries no concealed token in any learner-visible field', () => {
  const drama = buildScreenSpec(world).dramas[0];
  const learnerVisible = [
    drama.discipline,
    drama.topic,
    drama.scenario_name,
    drama.learner_start_state,
    drama.learner_voice_constraint,
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
  for (const token of CONCEALED_TOKENS) {
    assert.ok(!learnerVisible.includes(token), `concealed token "${token}" leaked into K_L`);
  }
});

// ---------------------------------------------------------------------------
// bridge-driven drama (mock backend) — the paid path replays exactly this
// ---------------------------------------------------------------------------

test('LLM bridges drive world-001 to grounded_anagnorisis with every release on cue', async () => {
  const { client } = recordingClient();
  const result = await runDrama({ world, roles: llmRoles(client) });
  assert.equal(result.verdict, 'grounded_anagnorisis');
  assert.equal(result.firstForcedTurn, 32);
  assert.equal(result.assertedGroundedTurn, 32);
  assert.ok(result.proof, 'proof tree extracted');

  const adherence = releaseAdherence(world, result.ledger, result.turnsPlayed);
  assert.equal(adherence.onCue, world.releaseSchedule.length);
  assert.equal(adherence.deviations.length, 0);
  assert.equal(adherence.missed.length, 0);
  assert.equal(adherence.unscheduled.length, 0);

  const diagnosis = diagnose(result, world);
  assert.equal(diagnosis.fabricatedFacts.length, 0);
  assert.ok(diagnosis.longestPlateau <= world.slope.aporia_window);
});

test('learner prompts never carry a concealed token before its release turn', async () => {
  const { client, learnerPrompts } = recordingClient();
  const result = await runDrama({ world, roles: llmRoles(client) });
  // One learner call per turn (mock JSON always parses — no repair calls).
  assert.equal(learnerPrompts.length, result.turnsPlayed);
  for (const token of CONCEALED_TOKENS) {
    // lawful === Infinity: the token lives only in authored-but-unscheduled
    // premises (e.g. the ink branch's "galley") — it must NEVER arrive.
    const lawful = firstLawfulTurn(token);
    learnerPrompts.forEach((prompt, i) => {
      const turn = i + 1;
      if (turn < lawful) {
        assert.ok(
          !prompt.includes(token),
          `concealed token "${token}" reached the learner at turn ${turn}, before its release turn ${lawful}`,
        );
      }
    });
    if (lawful !== Infinity) {
      // And it DOES arrive once released (the drama actually delivers).
      assert.ok(
        learnerPrompts.some((prompt, i) => i + 1 >= lawful && prompt.includes(token)),
        `token "${token}" never reached the learner after release`,
      );
    }
  }
});

test('learner adoption is index-mapped: nothing unreleased can enter the success channel', async () => {
  const { client } = recordingClient();
  const result = await runDrama({ world, roles: llmRoles(client) });
  const lawfulKeys = new Set([...world.background, ...world.premises.map((p) => p.fact)].map(factKey));
  for (const line of result.transcript) {
    if (line.role !== 'learner') continue;
    for (const fact of line.meta.adopt || []) {
      assert.ok(lawfulKeys.has(factKey(fact)), `learner adopted out-of-world fact ${fact.join(' ')}`);
    }
  }
  assert.ok(!result.events.some((e) => e.type === 'fabricated_fact'));
});

// ---------------------------------------------------------------------------
// factory contracts
// ---------------------------------------------------------------------------

test('tutor factory requires a role-script; learner factory requires a client', () => {
  const { client } = recordingClient();
  assert.throws(() => makeLlmTutor(world, client, { script: '  ' }), /role-script/);
  assert.throws(() => makeLlmLearner({ setting: 'x', voice: 'y' }), /client/);
});
