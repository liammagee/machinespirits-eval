import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ADAPTIVE_REGISTER_SWITCHING as GRID,
  ADAPTIVE_REGISTER_SWITCHING_POWER,
  buildAdaptiveRegisterSwitchingPlan,
  checkAdaptiveTutorStackProvenance,
  summarizeAdaptiveRegisterSwitchingStage1,
  validateAdaptiveRegisterSwitchingPlan,
} from '../services/adaptiveRegisterSwitching.js';
import {
  followUpCommands,
  generationCommand,
  registerScoringCommands,
} from '../scripts/run-adaptive-register-switching.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function resistanceRegister(scenarioId) {
  if (/boredom|rote_parroting/u.test(scenarioId)) return 'sarcastic';
  if (/irrelevance|question_flood/u.test(scenarioId)) return 'ironic';
  return 'charismatic';
}

function stance(registerName) {
  return {
    applies: true,
    gateRegister: registerName,
    gateVersion: GRID.measurement.gateVersion,
    passed: true,
    missingRequired: [],
    mannerPresence: {
      status: 'present',
      promptVersion: GRID.measurement.presenceQuestion,
      reader: GRID.measurement.presenceReader,
    },
  };
}

function syntheticDialogues() {
  const menu = buildAdaptiveRegisterSwitchingPlan().adaptiveRouterMenu;
  const dialogues = [];
  for (const scenarioId of GRID.scenarios) {
    for (let repeat = 1; repeat <= GRID.stage1.repeatsPerScenario; repeat += 1) {
      const chosen = resistanceRegister(scenarioId);
      const edge = GRID.edgedRegisters.includes(chosen);
      dialogues.push({
        rowId: `${scenarioId}:${repeat}`,
        dialogueId: `dialogue:${scenarioId}:${repeat}`,
        scenarioId,
        profileName: GRID.arms.adaptive.profile,
        turns: [
          {
            turn: 0,
            phase: 'other',
            selectedRegister: 'brisk',
            routerSelectedRegister: 'brisk',
            routerMenu: menu,
          },
          {
            turn: 1,
            phase: 'resistance',
            selectedRegister: chosen,
            routerSelectedRegister: chosen,
            routerMenu: menu,
            registerRubricScore: edge ? 4.2 : null,
            registerJudgeModel: edge ? GRID.scoring.registerJudge : null,
            stanceFidelity: edge ? stance(chosen) : null,
          },
          {
            turn: 2,
            phase: 'uptake',
            selectedRegister: 'precise',
            routerSelectedRegister: 'precise',
            routerMenu: menu,
          },
        ],
        dialogueTrace: GRID.tutorSeats.map((agent) => ({
          agent,
          action: 'call',
          metrics: { provider: 'codex', model: 'gpt-5.5' },
        })),
      });
    }
  }
  return dialogues;
}

test('the frozen plan carries measures 1-8, exact power, and Stage 1/2 row discipline', () => {
  const plan = buildAdaptiveRegisterSwitchingPlan();
  const validation = validateAdaptiveRegisterSwitchingPlan(plan);

  assert.equal(validation.ok, true, validation.errors.join('; '));
  assert.equal(plan.stage1Jobs.length, 10);
  assert.equal(plan.stage2Jobs.length, 105);
  assert.equal(plan.stage2.plannedRowsPerArm, 35);
  assert.equal(plan.measures.map((measure) => measure.number).join(','), '1,2,3,4,5,6,7,8');
  assert.equal(plan.measurement.presenceQuestion, 'manner-presence/1.0');
  assert.match(plan.planSha256, /^[0-9a-f]{64}$/u);
  assert.deepEqual(plan.arms.adaptive.routerRegisterMenu, ['ironic', 'sarcastic']);
  assert.equal(plan.arms.adaptive.registerPin, null);
  assert.equal(plan.arms.routerWarm.registerPin, null);
  assert.equal(plan.arms.pinnedSarcastic.registerPin, 'sarcastic');
  assert.ok(plan.adaptiveRouterMenu.includes('ironic'));
  assert.ok(plan.adaptiveRouterMenu.includes('sarcastic'));
  assert.ok(!plan.normalRouterMenu.includes('ironic'));
  assert.ok(!plan.normalRouterMenu.includes('sarcastic'));
  assert.doesNotMatch(JSON.stringify({ generation: plan.generation, scoring: plan.scoring }), /nemotron|kimi/iu);

  const proposed = ADAPTIVE_REGISTER_SWITCHING_POWER.find((row) => row.adaptiveRate === 0.85);
  assert.deepEqual(proposed, {
    warmRate: 0.5,
    adaptiveRate: 0.85,
    delta: 0.35,
    minimumNPerArm: 32,
    balancedNPerArm: 35,
    balancedPower: 0.8522,
  });
});

test('the Stage-1 report passes only timed resistance edge and keeps fidelity per register', () => {
  const dialogues = syntheticDialogues();
  const provenance = checkAdaptiveTutorStackProvenance(dialogues);
  const report = summarizeAdaptiveRegisterSwitchingStage1(dialogues, { provenance });

  assert.equal(provenance.ok, true, provenance.errors.join('; '));
  assert.equal(report.status, 'COMPLETE', report.errors.join('; '));
  assert.equal(report.decision, 'PASS_STAGE1');
  assert.equal(report.stage2Authorized, false);
  assert.equal(report.routerBehavior.resistanceEdges, 8);
  assert.equal(report.routerBehavior.resistanceTurns, 10);
  assert.equal(report.routerBehavior.uptakeEdges, 0);
  assert.equal(report.routerBehavior.uptakeTurns, 10);
  assert.equal(report.fidelityByRegister.ironic.turns, 4);
  assert.equal(report.fidelityByRegister.sarcastic.turns, 4);
  assert.equal(report.fidelityByRegister.ironic.gateIdentities[0], `ironic@${GRID.measurement.gateVersion}`);
  assert.equal(report.fidelityByRegister.sarcastic.gateIdentities[0], `sarcastic@${GRID.measurement.gateVersion}`);
  assert.ok(!Object.hasOwn(report, 'cueCountContrast'));
  assert.ok(report.registeredMeasures.slice(0, 4).every((measure) => measure.status === 'measured'));
  assert.ok(report.registeredMeasures.slice(4).every((measure) => measure.status === 'not_collected_stage1'));
});

test('the Stage-1 report fails closed when a register measure is missing', () => {
  const dialogues = syntheticDialogues();
  dialogues[0].turns[1].registerJudgeModel = null;
  const provenance = checkAdaptiveTutorStackProvenance(dialogues);
  const report = summarizeAdaptiveRegisterSwitchingStage1(dialogues, { provenance });

  assert.equal(report.status, 'INCOMPLETE');
  assert.equal(report.decision, null);
  assert.ok(report.errors.some((error) => /register judge/u.test(error)));
});

test('indiscriminate edge is a complete Stage-1 kill, not a missing-data null', () => {
  const dialogues = syntheticDialogues();
  const uptake = dialogues[0].turns[2];
  uptake.selectedRegister = 'sarcastic';
  uptake.routerSelectedRegister = 'sarcastic';
  uptake.registerRubricScore = 4.5;
  uptake.registerJudgeModel = GRID.scoring.registerJudge;
  uptake.stanceFidelity = stance('sarcastic');
  const provenance = checkAdaptiveTutorStackProvenance(dialogues);
  const report = summarizeAdaptiveRegisterSwitchingStage1(dialogues, { provenance });

  assert.equal(report.status, 'COMPLETE', report.errors.join('; '));
  assert.equal(report.decision, 'KILL_ROUTER_BEHAVIOR');
  assert.equal(report.routerBehavior.uptakeEdges, 1);
  assert.equal(report.stage2Authorized, false);
});

test('runner exposes only the ten-row Stage-1 launch and SHA-gated attended follow-ups', () => {
  const generation = generationCommand().join(' ');
  const followUps = followUpCommands('eval-test', 'a'.repeat(40)).map((command) => command.join(' '));
  const registerScoring = registerScoringCommands('eval-test').map((command) => command.join(' '));

  assert.match(generation, new RegExp(GRID.arms.adaptive.profile, 'u'));
  assert.match(generation, /--runs 2/u);
  assert.doesNotMatch(generation, new RegExp(GRID.arms.routerWarm.profile, 'u'));
  assert.doesNotMatch(generation, new RegExp(GRID.arms.pinnedSarcastic.profile, 'u'));
  assert.doesNotMatch(generation, /nemotron|kimi/iu);
  assert.equal(followUps.length, 3);
  assert.ok(followUps.slice(0, 2).every((command) => /--launch-approved --expected-sha a{40}/u.test(command)));
  assert.match(followUps[0], /--score-register-run eval-test/u);
  assert.match(followUps[1], /--read-manner-run eval-test/u);
  assert.match(followUps[2], /--report-run eval-test/u);
  assert.deepEqual(
    registerScoring.map((command) => /--register (ironic|sarcastic)/u.exec(command)?.[1]),
    ['ironic', 'sarcastic'],
  );
  assert.ok(registerScoring.every((command) => /--judge claude-code\.sonnet-5/u.test(command)));
});

test('runner uses the read-only DB helper and never hardcodes or overrides evaluation data paths', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts/run-adaptive-register-switching.js'), 'utf8');
  assert.match(source, /openEvaluationDbReadonly/u);
  assert.doesNotMatch(source, /new Database\s*\(/u);
  assert.doesNotMatch(source, /data\/evaluations\.db/u);
  assert.doesNotMatch(source, /EVAL_DB_PATH|EVAL_LOGS_DIR/u);
  assert.doesNotMatch(source, /stage2-run|launch-stage2/iu);
});
