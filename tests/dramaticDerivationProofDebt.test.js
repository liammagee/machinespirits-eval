/**
 * Proof-debt guard: a proof-state hygiene mechanism for the decay condition.
 * It detects already-released, currently decayed premises whose restoration
 * would lower D, then authorizes a restore move without exposing the raw
 * learner board or corruption ledger to the acts-mode tutor.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  factKey,
  loadWorld,
  runDrama,
  makeLlmClient,
  makeLlmDirector,
  makeLlmTutor,
  makeLlmLearner,
  proofDebtReport,
  tutorProofDebtView,
  diagnose,
  renderEvalPanel,
} from '../services/dramaticDerivation/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const smokeWorld = loadWorld(path.join(ROOT, 'config/drama-derivation/world-000-smoke.yaml'));
const lanternWorld = loadWorld(path.join(ROOT, 'config/drama-derivation/world-002-lantern.yaml'));
const lanternScript = fs.readFileSync(path.join(ROOT, 'config/drama-derivation/tutor-scripts/lantern-v001.md'), 'utf8');
const SCRIPT = 'Stay with the inquiry; release on cue; never name the conclusion.';

const actsOpts = (extra = {}) => ({ script: SCRIPT, actsMode: true, decayVisibility: 'conduct', ...extra });

const tutorLine = (turn, move) => ({
  turn,
  role: 'tutor',
  text: '(line)',
  meta: { move: { figure: 'erotema', ...move } },
});

const actsView = (turn, { ledger = [], transcript = [], proofDebt = null } = {}) => ({
  turn,
  ledger,
  transcript,
  acts: { index: 1, startTurn: 1, turnsThisAct: turn - 1, brief: null },
  ...(proofDebt ? { proofDebt } : {}),
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

test('proofDebtReport only marks released, decayed premises that lower D', () => {
  const grounded = new Map();
  for (const fact of smokeWorld.background) grounded.set(factKey(fact), { fact, turn: 0, valid: true });
  for (const id of ['p1', 'p2', 'p3', 'p4']) {
    const premise = smokeWorld.premiseById.get(id);
    grounded.set(factKey(premise.fact), {
      fact: premise.fact,
      turn: id === 'p4' ? 4 : 2,
      valid: true,
      decayed: id === 'p1' || id === 'p4',
      decayTurn: 6,
    });
  }
  const releasedIdByKey = new Map(
    ['p1', 'p2', 'p3', 'p4'].map((id) => {
      const premise = smokeWorld.premiseById.get(id);
      return [factKey(premise.fact), id];
    }),
  );

  const report = proofDebtReport(smokeWorld, { grounded, releasedIdByKey, turn: 7 });
  assert.equal(report.active, true);
  assert.deepEqual(
    report.debts.map((d) => d.premiseId),
    ['p1'],
  );
  assert.equal(report.debts[0].dNow, 1);
  assert.equal(report.debts[0].dIfRestored, 0);

  const tutorView = tutorProofDebtView(report);
  assert.deepEqual(Object.keys(tutorView.debts[0]).sort(), ['premiseId', 'sinceTurn', 'surface']);
  assert.ok(!('dNow' in tutorView.debts[0]));
  assert.ok(!('fact' in tutorView.debts[0]));
});

test('proof-debt guard requires the restore/re-entry discipline', () => {
  const { client } = stubClient({});
  assert.throws(
    () => makeLlmTutor(smokeWorld, client, actsOpts({ confront: true, proofDebtGuard: true })),
    /proofDebtGuard requires repairClause/,
  );
});

test('bridge: proof-debt guard rewrites an ignored debt into a restore move', async () => {
  const draft = {
    dialogue: 'Let us close the chain.',
    move: { figure: 'erotema', target_premise: null, intent: 'stage_recognition' },
  };
  const { client, calls } = stubClient({
    tutor: [draft],
    tutor_superego: [{ intervene: false, jurisdiction: null, diagnosis: 'authorized proof repair', note: null }],
  });
  const tutor = makeLlmTutor(
    smokeWorld,
    client,
    actsOpts({ superego: true, confront: true, repairClause: true, proofDebtGuard: true }),
  );

  const out = await tutor(
    actsView(3, {
      ledger: [{ turn: 2, premiseId: 'p1', via: 'director' }],
      transcript: [tutorLine(2, { targetPremise: 'p1', intent: 'release' })],
      proofDebt: {
        active: true,
        debts: [
          { premiseId: 'p1', surface: "Marin is Tessa's child", sinceTurn: 2 },
          { premiseId: 'p2', surface: 'Tessa carried the lamp', sinceTurn: 2 },
        ],
      },
    }),
  );

  assert.equal(out.move.intent, 'restore');
  assert.equal(out.move.targetPremise, 'p1');
  assert.equal(out.proofDebt.forced, true);
  assert.equal(out.proofDebt.target, 'p1');
  assert.deepEqual(out.proofDebt.targets, ['p1', 'p2']);
  assert.equal(out.proofDebt.debtCount, 2);
  assert.equal(out.deliberation.reentry.proofDebtClaim, true);

  const superegoPrompt = calls.find((c) => c.role === 'tutor_superego').user;
  assert.ok(superegoPrompt.includes('PROOF-DEBT GUARD'));
  assert.ok(superegoPrompt.includes('authorized by that guard'));
});

test('engine: proof-debt restore repairs the grouped target set before the learner speaks', async () => {
  const scheduled = (turn, via) => smokeWorld.releaseSchedule.find((entry) => entry.turn === turn && entry.via === via);
  const roles = {
    director: async (view) => {
      const entry = scheduled(view.turn, 'director');
      return { direction: 'director', release: entry?.premise || null };
    },
    tutor: async (view) => {
      if (view.turn === 5) {
        return {
          dialogue: 'Restore the slipped entries.',
          move: { figure: 'anaphora', targetPremise: 'p1', intent: 'restore' },
          proofDebt: { active: true, target: 'p1', targets: ['p1', 'p4'], debtCount: 2, forced: true },
        };
      }
      return {
        dialogue: 'Hold the board.',
        move: { figure: 'erotema', targetPremise: null, intent: 'consolidate' },
        release: null,
      };
    },
    learner: async (view) => ({ dialogue: 'I adopt what is staged.', adopt: view.releasedThisTurn }),
  };
  const result = await runDrama({
    world: smokeWorld,
    roles,
    options: {
      maxTurns: 5,
      decay: { rate: 1, graceTurns: 0, maxConcurrent: 2, startTurn: 3, seed: 1, mutateShare: 0, pool: 'staged' },
    },
  });
  const repairedAtFive = result.corruption.ledger
    .filter((entry) => entry.turn === 5 && entry.type === 'repair')
    .map((entry) => entry.premiseId)
    .sort();
  assert.deepEqual(repairedAtFive, ['p1', 'p4']);
});

test('mock chain: proof-debt guard produces tutor repairs and panel accounting on lantern', async () => {
  const client = makeLlmClient({ mode: 'mock' });
  const roles = {
    director: makeLlmDirector(lanternWorld, client, { actsMode: true }),
    tutor: makeLlmTutor(lanternWorld, client, {
      script: lanternScript,
      superego: true,
      decayVisibility: 'conduct',
      actsMode: true,
      confront: true,
      repairClause: true,
      releaseAuthority: true,
      pacingGuard: true,
      proofDebtGuard: true,
      plot: true,
      throughline: true,
    }),
    learner: makeLlmLearner({ setting: lanternWorld.setting, voice: lanternWorld.learnerVoice, client }),
  };
  const result = await runDrama({
    world: lanternWorld,
    roles,
    options: {
      decay: {
        rate: 0.75,
        graceTurns: 1,
        maxConcurrent: 2,
        startTurn: 17,
        mutateShare: 1.0,
        seed: 1,
        pool: 'staged',
      },
      acts: { minActTurns: 3, maxActTurns: 8 },
      proofDebtGuard: true,
    },
  });
  const d = diagnose(result, lanternWorld);
  assert.ok(d.proofDebt, 'proof-debt report is present');
  assert.ok(d.proofDebt.actionTurns >= 1, 'the guard spoke at least one restore');
  assert.ok(d.proofDebt.repairedTargets >= 1, 'at least one proof-debt restore repaired a decayed premise');
  assert.equal(d.confrontation.superego.firesWithoutDue, 0);
  assert.ok(renderEvalPanel(d).includes('**proof debt**'));
});
