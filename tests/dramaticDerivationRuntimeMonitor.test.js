import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  factKey,
  loadWorld,
  makeLlmClient,
  makeLlmDirector,
  makeLlmLearner,
  makeLlmTutor,
  proofDebtReport,
  runDrama,
  diagnose,
} from '../services/dramaticDerivation/index.js';
import { buildWorldIR, compileGuardSpec } from '../services/dramaticDerivation/guardCompiler.js';
import { createRuntimeMonitor, RUNTIME_MONITOR_SCHEMA } from '../services/dramaticDerivation/runtimeMonitor.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const smokeWorld = loadWorld(path.join(ROOT, 'config/drama-derivation/world-000-smoke.yaml'));
const lanternWorld = loadWorld(path.join(ROOT, 'config/drama-derivation/world-002-lantern.yaml'));
const lanternScript = fs.readFileSync(path.join(ROOT, 'config/drama-derivation/tutor-scripts/lantern-v001.md'), 'utf8');
const SCRIPT = 'Stay with the inquiry; release on cue; never name the conclusion.';

const actsOpts = (extra = {}) => ({ script: SCRIPT, actsMode: true, decayVisibility: 'conduct', ...extra });

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

function smokeProofDebtReport() {
  const grounded = new Map();
  for (const fact of smokeWorld.background) grounded.set(factKey(fact), { fact, turn: 0, valid: true });
  for (const id of ['p1', 'p2', 'p3']) {
    const premise = smokeWorld.premiseById.get(id);
    grounded.set(factKey(premise.fact), {
      fact: premise.fact,
      turn: id === 'p1' ? 2 : 5,
      valid: true,
      decayed: id === 'p1',
      decayTurn: 6,
    });
  }
  const releasedIdByKey = new Map(
    ['p1', 'p2', 'p3'].map((id) => {
      const premise = smokeWorld.premiseById.get(id);
      return [factKey(premise.fact), id];
    }),
  );
  return proofDebtReport(smokeWorld, { grounded, releasedIdByKey, turn: 7 });
}

test('RuntimeMonitor executes hidden pacing from compiled GuardSpec', () => {
  const spec = compileGuardSpec(lanternWorld, buildWorldIR(lanternWorld));
  const monitor = createRuntimeMonitor(lanternWorld, spec);
  const decision = monitor.hiddenPacingDecision({
    ledger: [],
    turn: 3,
    playable: [{ turn: 4, premise: 'p_bearing', via: 'tutor' }],
    validClaim: 'p_bearing',
  });

  assert.equal(monitor.schema, RUNTIME_MONITOR_SCHEMA);
  assert.equal(monitor.releaseLatitude, spec.guards.hidden_pacing.releaseLatitude);
  assert.equal(decision.played, null);
  assert.equal(decision.blocked, true);
  assert.equal(decision.runtimeMonitor.guard, 'hidden_pacing');
  assert.equal(decision.runtimeMonitor.guardSpecSchema, spec.schema);
});

test('RuntimeMonitor proof-debt view obeys GuardSpec non-leak fields', () => {
  const spec = compileGuardSpec(smokeWorld, buildWorldIR(smokeWorld));
  const monitor = createRuntimeMonitor(smokeWorld, spec);
  const report = smokeProofDebtReport();
  const view = monitor.proofDebtTutorView(report);
  const audit = monitor.auditProofDebtTutorView(view);

  assert.equal(report.active, true);
  assert.deepEqual(Object.keys(view.debts[0]).sort(), ['premiseId', 'sinceTurn', 'surface']);
  assert.equal(audit.ok, true);
  assert.deepEqual(audit.leaks, []);
});

test('makeLlmTutor can enforce hidden pacing through a compiled GuardSpec', async () => {
  const spec = compileGuardSpec(lanternWorld, buildWorldIR(lanternWorld));
  const { client } = stubClient({
    tutor: [
      {
        dialogue: 'The bearing is ready now.',
        move: { figure: 'exemplum', target_premise: 'p_bearing', intent: 'release' },
        release: 'p_bearing',
      },
    ],
  });
  const tutor = makeLlmTutor(
    lanternWorld,
    client,
    actsOpts({ releaseAuthority: true, pacingGuard: true, guardSpec: spec }),
  );

  const out = await tutor(actsView(3));
  assert.equal(out.release, null);
  assert.equal(out.releaseDecision.pacingGuard.blocked, true);
  assert.equal(out.releaseDecision.pacingGuard.runtimeMonitor.guard, 'hidden_pacing');
});

test('mock chain can run proof-debt guard with compiled GuardSpec tutor view', async () => {
  const spec = compileGuardSpec(lanternWorld, buildWorldIR(lanternWorld));
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
      guardSpec: spec,
      plot: true,
      throughline: true,
    }),
    learner: makeLlmLearner({ setting: lanternWorld.setting, voice: lanternWorld.learnerVoice, client }),
  };
  const result = await runDrama({
    world: lanternWorld,
    roles,
    options: {
      guardSpec: spec,
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
  const diagnosis = diagnose(result, lanternWorld);
  const tutorProofDebt = result.transcript
    .filter((row) => row.role === 'tutor' && row.meta?.proofDebt)
    .map((row) => row.meta.proofDebt);

  assert.ok(diagnosis.proofDebt?.repairedTargets >= 1);
  assert.ok(tutorProofDebt.length >= 1);
  for (const row of tutorProofDebt) {
    assert.equal('dNow' in row, false);
    assert.equal('dIfRestored' in row, false);
    assert.equal('deltaD' in row, false);
    assert.equal('closesProof' in row, false);
  }
});
