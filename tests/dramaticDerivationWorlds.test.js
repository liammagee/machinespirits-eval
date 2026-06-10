/**
 * Parameterized guarantees for the Phase-B worlds of the superego arc
 * (2026-06-10): world-002-lantern (elimination-shaped, cap 26) and
 * world-003-bitterwell (two-stage chain, cap 20). world-001's deeper
 * single-world guarantees live in dramaticDerivationPhase1.test.js; this
 * file holds the invariants every NEW world must satisfy before it may
 * carry a paid run:
 *
 *   - plotLint passes with S first derivable exactly at the planned
 *     recognition turn;
 *   - release pacing never opens a gap wider than the aporia window;
 *   - K_L (the screened curtain-rise context) carries no concealed token;
 *   - the LLM bridges drive the drama to grounded_anagnorisis in mock mode
 *     with every release on cue, no stall, no fabricated facts;
 *   - the learner's prompts never carry a concealed token before its
 *     release turn (single-concealment invariant at the prompt layer);
 *   - the tutor's own superego (mock) watches every draft, breaks the
 *     figure rut within the turn, and leaves the formal channel
 *     byte-identical to the superego-off control.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadWorld,
  plotLint,
  runDrama,
  makeLlmClient,
  makeLlmDirector,
  makeLlmTutor,
  makeLlmLearner,
  diagnose,
  releaseAdherence,
  tutorFigures,
} from '../services/dramaticDerivation/index.js';
import { buildScreenSpec } from '../scripts/screen-derivation-world.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Concealed tokens are listed in each world YAML's CONCEALMENT header; where
// a particular has distinct fact-symbol and prose spellings, both are swept
// (prompts are lowercased before matching).
const WORLDS = [
  {
    worldFile: 'config/drama-derivation/world-002-lantern.yaml',
    scriptFile: 'config/drama-derivation/tutor-scripts/lantern-v001.md',
    recognitionTurn: 20,
    concealed: ['senna', 'southstack', 'south stack', 'sswhalfwest', 'half west', 'skiff', 'oyster-watch'],
  },
  {
    worldFile: 'config/drama-derivation/world-003-bitterwell.yaml',
    scriptFile: 'config/drama-derivation/tutor-scripts/bitterwell-v001.md',
    recognitionTurn: 15,
    concealed: ['mirel', 'springhouse', 'spring-house', 'copperas', 'crocks'],
  },
];

/** Wraps the mock client, recording every prompt the learner role receives. */
function recordingClient() {
  const inner = makeLlmClient({ mode: 'mock' });
  const learnerPrompts = [];
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

// The mock superego is deterministic: the mock tutor always drafts erotema,
// the watcher intervenes when the last two SPOKEN figures equal the draft,
// and the revision switches to analogia — so interventions land on turns
// 3, 6, 9, … of any mock run.
const expectedInterventionTurns = (turnsPlayed) => {
  const turns = [];
  for (let t = 3; t <= turnsPlayed; t += 3) turns.push(t);
  return turns;
};

for (const spec of WORLDS) {
  const world = loadWorld(path.join(ROOT, spec.worldFile));
  const script = fs.readFileSync(path.join(ROOT, spec.scriptFile), 'utf8');
  const id = world.id;

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

  const llmRoles = (client, { superego = false } = {}) => ({
    director: makeLlmDirector(world, client),
    tutor: makeLlmTutor(world, client, { script, superego }),
    learner: makeLlmLearner({ setting: world.setting, voice: world.learnerVoice, client }),
  });

  test(`${id}: passes plotLint with S first derivable at the planned recognition turn`, () => {
    const lint = plotLint(world);
    assert.equal(lint.ok, true, lint.errors.join('; '));
    assert.equal(lint.firstEntailedTurn, spec.recognitionTurn);
    assert.ok(lint.firstEntailedTurn >= world.slope.t_min);
  });

  test(`${id}: release pacing never opens a gap wider than the aporia window`, () => {
    const turns = world.releaseSchedule.map((e) => e.turn);
    assert.ok(turns[0] <= world.slope.aporia_window, 'first release arrives inside the first window');
    for (let i = 1; i < turns.length; i += 1) {
      assert.ok(
        turns[i] - turns[i - 1] <= world.slope.aporia_window,
        `release gap ${turns[i - 1]} -> ${turns[i]} exceeds aporia window ${world.slope.aporia_window}`,
      );
    }
  });

  test(`${id}: K_L screen spec carries no concealed token in any learner-visible field`, () => {
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
    for (const token of spec.concealed) {
      assert.ok(!learnerVisible.includes(token), `concealed token "${token}" leaked into K_L`);
    }
  });

  test(`${id}: LLM bridges drive the drama to grounded_anagnorisis with every release on cue`, async () => {
    const { client } = recordingClient();
    const result = await runDrama({ world, roles: llmRoles(client) });
    assert.equal(result.verdict, 'grounded_anagnorisis');
    assert.equal(result.firstForcedTurn, spec.recognitionTurn);
    assert.equal(result.assertedGroundedTurn, spec.recognitionTurn);
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

  test(`${id}: learner prompts never carry a concealed token before its release turn`, async () => {
    const { client, learnerPrompts } = recordingClient();
    const result = await runDrama({ world, roles: llmRoles(client) });
    assert.equal(learnerPrompts.length, result.turnsPlayed);
    for (const token of spec.concealed) {
      const lawful = firstLawfulTurn(token);
      assert.ok(lawful !== Infinity, `token "${token}" appears in no premise — sweep is misconfigured`);
      learnerPrompts.forEach((prompt, i) => {
        const turn = i + 1;
        if (turn < lawful) {
          assert.ok(
            !prompt.includes(token),
            `concealed token "${token}" reached the learner at turn ${turn}, before its release turn ${lawful}`,
          );
        }
      });
      if (lawful <= result.turnsPlayed) {
        assert.ok(
          learnerPrompts.some((prompt, i) => i + 1 >= lawful && prompt.includes(token)),
          `token "${token}" never reached the learner after release`,
        );
      }
    }
  });

  test(`${id}: tutor superego (mock) breaks the rut within the turn and leaves the formal channel untouched`, async () => {
    const off = await runDrama({ world, roles: llmRoles(recordingClient().client) });
    const on = await runDrama({ world, roles: llmRoles(recordingClient().client, { superego: true }) });

    // The manner channel: every draft watched, the deterministic rut broken
    // within the turn, every revision a real figure change.
    assert.equal(on.verdict, 'grounded_anagnorisis');
    const tutorLines = on.transcript.filter((l) => l.role === 'tutor');
    assert.ok(
      tutorLines.every((l) => l.meta?.deliberation),
      'every tutor line carries its deliberation',
    );
    const expected = expectedInterventionTurns(on.turnsPlayed);
    const intervened = tutorLines.filter((l) => l.meta.deliberation.intervened);
    assert.deepEqual(
      intervened.map((l) => l.turn),
      expected,
    );
    for (const line of intervened) {
      assert.equal(line.meta.deliberation.draftFigure, 'erotema');
      assert.ok(line.meta.deliberation.note, 'an intervention carries its note');
      assert.equal(line.meta.move.figure, 'analogia');
    }

    const tf = tutorFigures(on);
    assert.equal(tf.superego.watched, on.turnsPlayed);
    assert.equal(tf.superego.interventions, expected.length);
    assert.equal(tf.superego.withinTurnChanges, expected.length);
    assert.equal(tf.superego.withinTurnChangeRate, 1);
    assert.equal(tf.superego.switchOnIntervention, 1);
    assert.ok(tf.superego.switchElsewhere < 1);
    assert.equal(tf.distinct, 2);
    assert.equal(tf.counts.analogia, expected.length);

    // The control arm: no watcher, total figure lock-in (the S0 signature).
    const tfOff = tutorFigures(off);
    assert.equal(tfOff.superego, null);
    assert.equal(tfOff.topFigure, 'erotema');
    assert.equal(tfOff.topShare, 1);
    assert.equal(tfOff.distinct, 1);
    assert.equal(tfOff.switchRate, 0);

    // The formal channel: releases, derivability, and verdict identical
    // across arms — the watcher touches manner, never matter.
    assert.equal(on.firstForcedTurn, off.firstForcedTurn);
    assert.equal(on.assertedGroundedTurn, off.assertedGroundedTurn);
    assert.deepEqual(on.ledger, off.ledger);
    assert.deepEqual(on.trajectory, off.trajectory);
  });
}
