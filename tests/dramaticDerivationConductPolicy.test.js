import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  auditConductTutorView,
  conductMoveSpecs,
  CONDUCT_MOVE_FAMILIES,
  CONDUCT_POLICY_SCHEMA,
  diagnose,
  factKey,
  loadWorld,
  makeLlmTutor,
  proofDebtReport,
  selectConductMove,
  tutorProofDebtView,
} from '../services/dramaticDerivation/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const smokeWorld = loadWorld(path.join(ROOT, 'config/drama-derivation/world-000-smoke.yaml'));
const SCRIPT = 'Stay with the inquiry; release on cue; never name the conclusion.';
const fixtures = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'tests/fixtures/a20-conduct-policy-fixtures.json'), 'utf8'),
).fixtures;

const actsOpts = (extra = {}) => ({ script: SCRIPT, actsMode: true, decayVisibility: 'conduct', ...extra });

const actsView = (turn, { ledger = [], transcript = [], proofDebt = null } = {}) => ({
  turn,
  ledger,
  transcript,
  acts: { index: 1, startTurn: 1, turnsThisAct: turn - 1, brief: null, closed: [] },
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

function smokeProofDebtTutorView() {
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
  return tutorProofDebtView(proofDebtReport(smokeWorld, { grounded, releasedIdByKey, turn: 7 }));
}

function fixture(id) {
  const found = fixtures.find((f) => f.fixtureId === id);
  if (!found) throw new Error(`missing fixture ${id}`);
  return found.trigger;
}

test('conduct move specs keep a small explicit move ontology', () => {
  const specs = conductMoveSpecs();
  assert.deepEqual(Object.keys(specs).sort(), [...CONDUCT_MOVE_FAMILIES].sort());
  for (const family of CONDUCT_MOVE_FAMILIES) {
    assert.ok(specs[family].preconditions.length >= 1, `${family} has preconditions`);
    assert.ok(specs[family].blockedActions.length >= 1, `${family} has blocked actions`);
    assert.ok(specs[family].permittedTutorFields.length >= 1, `${family} has permitted fields`);
  }
});

test('A20 dependency-repair fixture selects repair_dependency and blocks premature advance', () => {
  const trigger = fixture('a20-fixture-001-dependency-repair-reference');
  const decision = selectConductMove({
    ...trigger,
    proofDebtTutorView: {
      active: true,
      debts: [
        {
          premiseId: 'p_rill',
          surface: 'above the font-house door the spring runs sweet as ever it did',
          sinceTurn: 13,
          dNow: 2,
          secret: ['turnedFoul', 'joss', 'schoolWell'],
        },
      ],
    },
  });

  assert.equal(decision.schema, CONDUCT_POLICY_SCHEMA);
  assert.equal(decision.selectedMoveFamily, 'repair_dependency');
  assert.equal(decision.reasonCode, 'dependency_repair_needed');
  assert.equal(decision.targetPremise, 'p_rill');
  assert.ok(decision.blockedActions.includes('invite_final_assertion'));
  assert.ok(decision.blockedActions.includes('release_unrelated_evidence'));
  assert.equal(decision.tutorView.surface, 'above the font-house door the spring runs sweet as ever it did');
  assert.equal('dNow' in decision.tutorView, false);
  assert.equal('secret' in decision.tutorView, false);
  assert.equal(decision.nonLeakAudit.ok, true);
});

test('A20 hidden-hurts candidate asks diagnostic instead of repairing by hidden default', () => {
  const trigger = fixture('a20-fixture-002-hidden-hurts-candidate');
  const decision = selectConductMove(trigger);

  assert.equal(decision.selectedMoveFamily, 'ask_diagnostic');
  assert.equal(decision.reasonCode, 'valid_alternative_candidate');
  assert.equal(decision.targetPremise, 'p_point');
  assert.ok(decision.blockedActions.includes('continue_hidden_delay_without_diagnostic'));
  assert.ok(decision.blockedActions.includes('repair_dependency_without_public_check'));
  assert.match(decision.tutorView.publicReason, /public evidence may license/u);
  assert.equal(decision.tutorView.visibleReason, trigger.evidence.intervention.reason);
  assert.equal(decision.nonLeakAudit.ok, true);
});

test('unsupported assertion and underdetermined state select safe moves', () => {
  const blocked = selectConductMove({
    triggerType: 'unsupported_assertion_blocked',
    evidence: {
      assertionGate: {
        blocked: true,
        attempted: ['answer', 'tooSoon'],
        reason: 'assertion blocked: public board does not entail the answer',
      },
      learnerExcerpt: 'So it must be tooSoon.',
    },
  });
  assert.equal(blocked.selectedMoveFamily, 'block_assertion');
  assert.ok(blocked.blockedActions.includes('accept_unsupported_assertion'));
  assert.equal(blocked.nonLeakAudit.ok, true);

  const diagnostic = selectConductMove({ learnerExcerpt: 'I think I follow, maybe.' });
  assert.equal(diagnostic.selectedMoveFamily, 'ask_diagnostic');
  assert.equal(diagnostic.reasonCode, 'underdetermined');
});

test('conduct tutor-view audit catches forbidden hidden fields', () => {
  const audit = auditConductTutorView({
    moveFamily: 'repair_dependency',
    debts: [{ premiseId: 'p1', dNow: 3, proofPath: ['p1', 'p2'] }],
    rawBoard: [['hidden']],
  });
  assert.equal(audit.ok, false);
  assert.deepEqual(
    audit.leaks.map((leak) => leak.key).sort(),
    ['dNow', 'proofPath', 'rawBoard'],
  );
});

test('runtime conduct policy logs inactive rows without entering tutor prompt metadata', async () => {
  const { client, calls } = stubClient({
    tutor: [
      {
        dialogue: 'Let us keep the evidence steady for now.',
        move: { figure: 'erotema', target_premise: null, intent: 'orient' },
      },
    ],
  });
  const tutor = makeLlmTutor(smokeWorld, client, actsOpts({ conductPolicy: true }));
  const out = await tutor(actsView(1));

  assert.equal(out.conductPolicy.schema, CONDUCT_POLICY_SCHEMA);
  assert.equal(out.conductPolicy.active, false);
  assert.equal(out.conductPolicy.loggingOnly, true);
  assert.equal(out.conductPolicy.generatorCompliance.checked, false);
  assert.equal(calls[0].meta.conductPolicy, undefined);
});

test('runtime conduct policy observes proof-debt state without being the enforcement path', async () => {
  const proofDebt = smokeProofDebtTutorView();
  const { client } = stubClient({
    tutor: [
      {
        dialogue: 'We can close from here.',
        move: { figure: 'erotema', target_premise: null, intent: 'stage_recognition' },
      },
    ],
  });
  const tutor = makeLlmTutor(
    smokeWorld,
    client,
    actsOpts({ confront: true, repairClause: true, proofDebtGuard: true, conductPolicy: true }),
  );
  const out = await tutor(actsView(7, { proofDebt }));

  assert.equal(out.proofDebt.forced, true);
  assert.equal(out.move.intent, 'restore');
  assert.equal(out.move.targetPremise, 'p1');
  assert.equal(out.conductPolicy.active, true);
  assert.equal(out.conductPolicy.selectedMoveFamily, 'repair_dependency');
  assert.equal(out.conductPolicy.reasonCode, 'dependency_repair_needed');
  assert.equal(out.conductPolicy.targetPremise, 'p1');
  assert.deepEqual(out.conductPolicy.realizedMove, out.move);
  assert.equal(out.conductPolicy.generatorCompliance.checked, false);
});

test('diagnosis summarizes conduct-policy decisions from transcript metadata', () => {
  const result = {
    worldId: smokeWorld.id,
    verdict: 'turn_cap',
    turnsPlayed: 1,
    firstForcedTurn: null,
    assertedGroundedTurn: null,
    trajectory: [{ turn: 1, D: 3 }],
    events: [],
    ledger: [],
    transcript: [
      {
        turn: 1,
        role: 'tutor',
        text: 'Before we close anything, put this earlier exhibit back in full.',
        meta: {
          move: { figure: 'erotema', targetPremise: 'p1', intent: 'restore' },
          conductPolicy: {
            schema: CONDUCT_POLICY_SCHEMA,
            active: true,
            loggingOnly: true,
            selectedMoveFamily: 'repair_dependency',
            reasonCode: 'dependency_repair_needed',
            targetPremise: 'p1',
            triggerType: 'dependency_repair_needed',
            realizedMove: { figure: 'erotema', targetPremise: 'p1', intent: 'restore' },
            generatorCompliance: { checked: false, reason: 'logging_only_v0' },
          },
        },
      },
    ],
  };
  const report = diagnose(result, smokeWorld).conductPolicyReport;

  assert.equal(report.loggedTurns, 1);
  assert.equal(report.activeTurns, 1);
  assert.equal(report.moveFamilies.repair_dependency, 1);
  assert.equal(report.reasonCodes.dependency_repair_needed, 1);
  assert.equal(report.loggingOnly, true);
  assert.equal(report.complianceChecked, false);
});
