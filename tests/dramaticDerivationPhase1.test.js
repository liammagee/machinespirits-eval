/**
 * Phase-1 guarantees for world-001 + the LLM role bridges
 * (notes/2026-06-09-dramatic-derivation-plan.md §3 steps 2–4):
 *
 *   - world-001 passes plotLint and its release pacing respects the
 *     anti-aporia window (the schedule cannot stall an ideal learner);
 *   - K_L (the screened curtain-rise context) carries no concealed token;
 *   - the LEARNER bridge's prompts never see a concealed token before the
 *     drama releases it (single-concealment invariant at the prompt layer);
 *   - the bridges drive the full drama to grounded_anagnorisis in mock mode
 *     with every release on cue (mock-first: the paid path replays this);
 *   - the tutor's own superego (--superego, 2026-06-10) watches every draft,
 *     intervenes on the figure rut, and the revision changes the figure
 *     WITHIN the turn — with the formal channel untouched.
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
  resolveTarget,
  diagnose,
  releaseAdherence,
  stagingSegments,
  tutorFigures,
  renderTranscript,
  renderEvalPanel,
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
const normalizedText = (text) => String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
const naturalFact = (fact) =>
  fact
    .map((token) =>
      String(token)
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .toLowerCase(),
    )
    .join(', ');
const premiseSurface = (premise) => normalizedText(premise.surface || naturalFact(premise.fact));
const concealedPremises = CONCEALED_TOKENS.flatMap((token) =>
  world.premises.filter((premise) => normalizedText(`${premise.fact.join(' ')} ${premise.surface || ''}`).includes(token)),
).filter((premise, i, all) => all.findIndex((p) => p.id === premise.id) === i);

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

function llmRoles(client, { superego = false } = {}) {
  return {
    director: makeLlmDirector(world, client),
    tutor: makeLlmTutor(world, client, { script, superego }),
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
  for (const prompt of learnerPrompts) {
    assert.ok(!prompt.includes('formally:'), 'learner prompt should not expose formal rule notation');
    assert.ok(!prompt.includes('question pattern'), 'learner prompt should not expose the symbolic question pattern');
    assert.ok(!prompt.includes('"derives"'), 'learner prompt should not ask the model for formal derive arrays');
  }
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
  }
  const normalizedPrompts = learnerPrompts.map(normalizedText);
  for (const premise of concealedPremises) {
    const lawful = releaseTurnOf(premise.id);
    if (lawful !== Infinity) {
      // And the released premise DOES arrive in its learner-facing surface form.
      const surface = premiseSurface(premise);
      assert.ok(
        normalizedPrompts.some((prompt, i) => i + 1 >= lawful && prompt.includes(surface)),
        `premise "${premise.id}" never reached the learner after release`,
      );
    }
  }
});

test('free dramaturgy: mock director declares the sketched movements; diagnosis reports the staging', async () => {
  const { client } = recordingClient();
  const result = await runDrama({ world, roles: llmRoles(client) });

  // The mock director converts each phaseHint (sketch-act boundary) into a
  // declared movement — so declarations land exactly at the sketch's act
  // starts, within the turns actually played. Stage directions are ALL the
  // director has since 2026-06-10: no director line may carry a tutor note.
  const actStarts = world.dramaturgy.acts.map((a) => a.turns[0]).filter((t) => t <= result.turnsPlayed);
  const declares = result.transcript.filter((l) => l.role === 'director' && l.meta?.phase?.name);
  assert.deepEqual(
    declares.map((l) => l.turn),
    actStarts,
  );
  assert.ok(
    !result.transcript.some((l) => l.role === 'director' && l.meta?.tutorNote),
    'the tutor-note channel was removed — a reappearing note means the engine regressed',
  );

  // Realized segments come from the declarations (source director), not the
  // sketch — and the diagnosis surfaces the same staging summary the shell
  // and the viewer report.
  const segments = stagingSegments(result, world);
  assert.ok(segments.every((s) => s.source === 'director'));
  assert.deepEqual(
    segments.map((s) => s.turns[0]),
    actStarts,
  );

  const d = diagnose(result, world);
  assert.equal(d.staging.source, 'director');
  assert.deepEqual(
    d.staging.movements.map((m) => m.turn),
    actStarts,
  );
  // tutorNotes is now a legacy READ (pre-06-10 artifacts on disk only).
  assert.equal(d.staging.tutorNotes.length, 0);

  const panel = renderEvalPanel(d);
  assert.match(panel, /movements declared by the director/);
  assert.doesNotMatch(panel, /notes? to the tutor/);
});

test('frozen dramaturgy (control arm): the movement channel is hard-dropped; the formal layer is untouched', async () => {
  const { client } = recordingClient();
  const roles = {
    director: makeLlmDirector(world, client, { dramaturgy: 'frozen' }),
    tutor: makeLlmTutor(world, client, { script }),
    learner: makeLlmLearner({ setting: world.setting, voice: world.learnerVoice, client }),
  };
  const result = await runDrama({ world, roles });

  // The evidence channel is identical to the free run: same verdict, same
  // recognition turn, every release on cue. Only the movement channel differs
  // (since 2026-06-10 it is the director's ONLY staging channel).
  assert.equal(result.verdict, 'grounded_anagnorisis');
  assert.equal(result.firstForcedTurn, 32);
  const adherence = releaseAdherence(world, result.ledger, result.turnsPlayed);
  assert.equal(adherence.onCue, world.releaseSchedule.length);

  // No director line carries a declared movement — the parser gate, not the
  // charter, is what the test leans on.
  assert.ok(!result.transcript.some((l) => l.role === 'director' && l.meta?.phase));

  const d = diagnose(result, world);
  assert.equal(d.staging.source, 'sketch');
  assert.equal(d.staging.movements.length, 0);
  const segments = stagingSegments(result, world);
  assert.ok(segments.length > 0 && segments.every((s) => s.source === 'sketch'));

  // The shell composes the diagnosis as {dramaturgy, ...diagnose(...)} —
  // the panel then carries the control-arm marker.
  const panel = renderEvalPanel({ ...d, dramaturgy: 'frozen' });
  assert.match(panel, /no movements declared \(author's sketch held\)/);
  assert.match(panel, /\*\*dramaturgy\*\* frozen \(control/);
});

test('tutorFigures: mock run reads as total lock-in (the instrument the S0→S1 contrast scores)', async () => {
  const { client } = recordingClient();
  const result = await runDrama({ world, roles: llmRoles(client) });
  const tf = tutorFigures(result);

  // The mock tutor plays erotema every turn — the degenerate S0 the paid
  // baseline approximated at 30/32. The instrument must read it exactly.
  assert.equal(tf.total, result.turnsPlayed);
  assert.equal(tf.topFigure, 'erotema');
  assert.equal(tf.topShare, 1);
  assert.equal(tf.distinct, 1);
  assert.equal(tf.switchRate, 0);

  // The director-note channel no longer exists, so the legacy note split is
  // empty (it still reads pre-06-10 artifacts), and without --superego the
  // tutor records no deliberation: the superego block is absent.
  assert.equal(tf.noteTurns, 0);
  assert.equal(tf.switchOnNoteTurns, null);
  assert.equal(tf.switchElsewhere, 0);
  assert.equal(tf.superego, null);

  const panel = renderEvalPanel(diagnose(result, world));
  assert.match(panel, /\*\*figures\*\* erotema \d+\/\d+ \(100%\)/);
  assert.doesNotMatch(panel, /\*\*superego\*\*/);
});

test('tutor superego (mock): watches every draft, breaks the rut within the turn, leaves the formal channel alone', async () => {
  const { client, learnerPrompts } = recordingClient();
  const result = await runDrama({ world, roles: llmRoles(client, { superego: true }) });

  // The formal channel is untouched by deliberation: same verdict, same
  // recognition turn, every release on cue — only the MANNER moves.
  assert.equal(result.verdict, 'grounded_anagnorisis');
  assert.equal(result.firstForcedTurn, 32);
  const adherence = releaseAdherence(world, result.ledger, result.turnsPlayed);
  assert.equal(adherence.onCue, world.releaseSchedule.length);
  assert.equal(adherence.deviations.length, 0);

  // Every tutor line carries deliberation (the superego watched every turn);
  // the mock watcher fires exactly when the last two figures equal the draft
  // — turns 3, 6, 9, … — and every intervention carries diagnosis + note.
  const tutorLines = result.transcript.filter((l) => l.role === 'tutor');
  assert.ok(tutorLines.every((l) => l.meta.deliberation));
  const intervened = tutorLines.filter((l) => l.meta.deliberation.intervened);
  const expectedTurns = [];
  for (let t = 3; t <= result.turnsPlayed; t += 3) expectedTurns.push(t);
  assert.deepEqual(
    intervened.map((l) => l.turn),
    expectedTurns,
  );
  assert.ok(intervened.every((l) => l.meta.deliberation.draftFigure === 'erotema' && l.meta.deliberation.note));

  // The instrument's within-turn causal read: every intervention turned the
  // erotema draft into a spoken analogia; switches concentrate on
  // intervention turns (1.0) against a lower elsewhere rate (the mock snaps
  // back to its default the turn after).
  const tf = tutorFigures(result);
  assert.equal(tf.superego.watched, result.turnsPlayed);
  assert.equal(tf.superego.interventions, expectedTurns.length);
  assert.equal(tf.superego.withinTurnChanges, expectedTurns.length);
  assert.equal(tf.superego.withinTurnChangeRate, 1);
  assert.equal(tf.superego.switchOnIntervention, 1);
  assert.ok(tf.superego.switchElsewhere < 1);
  assert.equal(tf.distinct, 2);
  assert.equal(tf.counts.analogia, expectedTurns.length);
  assert.equal(tf.counts.erotema, result.turnsPlayed - expectedTurns.length);

  // Diagnosis + renderers surface the deliberation trail the operator reads.
  const d = diagnose(result, world);
  assert.equal(d.superegoNotes.length, expectedTurns.length);
  assert.ok(d.superegoNotes.every((n) => n.draftFigure === 'erotema' && n.figure === 'analogia' && n.note));
  const panel = renderEvalPanel(d);
  assert.match(
    panel,
    new RegExp(`\\*\\*superego\\*\\* intervened ${expectedTurns.length}/${result.turnsPlayed} watched turns`),
  );
  assert.match(
    panel,
    new RegExp(`figure changed within-turn on ${expectedTurns.length}/${expectedTurns.length} interventions`),
  );
  const md = renderTranscript(result, world, { diagnosis: d });
  assert.match(md, /the second voice: "/);
  assert.match(md, /\(draft erotema → analogia\)/);

  // Single-concealment holds through the deliberation loop: the extra
  // superego/revision calls never leak a concealed token into the learner.
  for (const token of CONCEALED_TOKENS) {
    const lawful = firstLawfulTurn(token);
    learnerPrompts.forEach((prompt, i) => {
      if (i + 1 < lawful) {
        assert.ok(!prompt.includes(token), `concealed token "${token}" reached the learner at turn ${i + 1}`);
      }
    });
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

// ---------------------------------------------------------------------------
// per-role provider/model targeting (six-role ready: the cast will grow to
// director, tutor, learner + the two superegos — resolution must be generic
// over role NAMES, not a hardcoded trio)
// ---------------------------------------------------------------------------

test('resolveTarget: role env overrides shared; codex is a CLI target; superego-style names resolve', () => {
  const keys = [
    'DERIVATION_PROVIDER',
    'DERIVATION_MODEL',
    'DERIVATION_LEARNER_MODEL',
    'DERIVATION_DIRECTOR_PROVIDER',
    'DERIVATION_DIRECTOR_MODEL',
    'DERIVATION_TUTOR_SUPEREGO_PROVIDER',
    'DERIVATION_TUTOR_SUPEREGO_MODEL',
  ];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    process.env.DERIVATION_PROVIDER = 'codex';
    delete process.env.DERIVATION_MODEL;
    process.env.DERIVATION_LEARNER_MODEL = 'gpt-5.2';
    process.env.DERIVATION_DIRECTOR_PROVIDER = 'claude';
    process.env.DERIVATION_DIRECTOR_MODEL = 'opus';
    process.env.DERIVATION_TUTOR_SUPEREGO_PROVIDER = 'openrouter';
    process.env.DERIVATION_TUTOR_SUPEREGO_MODEL = 'gemini-flash';

    // shared codex default: CLI target, model null = the CLI's own default
    const tutor = resolveTarget('tutor');
    assert.deepEqual(tutor, { provider: 'codex', model: null, cli: true });

    // role-level model override rides on the shared CLI provider
    const learner = resolveTarget('learner');
    assert.deepEqual(learner, { provider: 'codex', model: 'gpt-5.2', cli: true });

    // claude is the second CLI provider — a full per-role provider+model
    // override (the mixed-cast pattern: claude director over codex shared)
    const director = resolveTarget('director');
    assert.deepEqual(director, { provider: 'claude', model: 'opus', cli: true });

    // a future role name resolves generically (non-alphanumerics → '_') and
    // API providers still get providers.yaml alias resolution
    const superego = resolveTarget('tutor_superego');
    assert.equal(superego.provider, 'openrouter');
    assert.equal(superego.model, 'google/gemini-3-flash-preview');
    assert.ok(!superego.cli);
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
});
