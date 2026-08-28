import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ADAPTIVE_REGISTER_SWITCHING as GRID,
  buildAdaptiveRegisterSwitchingPlan,
} from '../services/adaptiveRegisterSwitching.js';
import {
  summarizeAdaptiveRegisterSwitchingStage2,
  validateAdaptiveRegisterSwitchingStage1Gate,
} from '../services/adaptiveRegisterSwitchingStage2.js';
import {
  ADAPTIVE_REGISTER_SWITCHING_STAGE2_FIELDED_CHANNELS,
  assembleAdaptiveRegisterSwitchingStage2Preflight,
  buildAdaptiveRegisterSwitchingStage2PreflightPackets,
  buildAdaptiveRegisterSwitchingStage2SyntheticCorpus,
  runAdaptiveRegisterSwitchingStage2EndpointPreflight,
} from '../services/adaptiveRegisterSwitchingStage2Preflight.js';
import {
  runPaidStudyEndpointPreflight,
  validatePaidStudyEndpointGoCertificate,
} from '../services/paidStudyEndpointPreflight.js';
import {
  stage2FollowUpCommands,
  stage2GenerationCommand,
  stage2OutcomeScoringCommands,
  stage2RegisterScoringCommands,
} from '../scripts/run-adaptive-register-switching-stage2.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLAN_SHA = 'da2723e47de143305e88a9a7b26688f6f58e4958e0b310ed4d7e147cd9734845';
const ENDPOINT_CONTRACT_PATH = path.join(ROOT, 'config/paid-study-endpoints/adaptive-register-switching-stage2.json');
const ENDPOINT_GO_PATH = path.join(
  ROOT,
  'config/paid-study-endpoints/adaptive-register-switching-stage2.endpoint-go.json',
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

function stage1Artifact() {
  return {
    runId: 'eval-stage1',
    report: {
      schema: 'machinespirits.adaptive-register-switching-stage1-report.v1',
      status: 'COMPLETE',
      decision: 'PASS_STAGE1',
      expectedRows: 10,
      observedRows: 10,
      errors: [],
      registeredMeasures: GRID.measures.map((measure) => ({
        ...measure,
        status: measure.stage === 'stage1' ? 'measured' : 'not_collected_stage1',
      })),
    },
  };
}

function syntheticStage2Dialogues() {
  const plan = buildAdaptiveRegisterSwitchingPlan();
  const rows = [];
  const positives = { adaptive: 30, routerWarm: 17, pinnedSarcastic: 22 };
  for (const arm of ['adaptive', 'routerWarm', 'pinnedSarcastic']) {
    let ordinal = 0;
    for (const scenarioId of GRID.scenarios) {
      for (let repeat = 1; repeat <= GRID.stage2.repeatsPerScenario; repeat += 1) {
        ordinal += 1;
        const menu = arm === 'adaptive' ? plan.adaptiveRouterMenu : plan.normalRouterMenu;
        const selected =
          arm === 'pinnedSarcastic'
            ? ['brisk', 'sarcastic', 'precise']
            : ['brisk', arm === 'adaptive' ? 'ironic' : 'precise', 'precise'];
        rows.push({
          rowId: `${arm}:${scenarioId}:${repeat}`,
          dialogueId: `dialogue:${arm}:${scenarioId}:${repeat}`,
          scenarioId,
          profileName: GRID.arms[arm].profile,
          positiveOutcome: ordinal <= positives[arm],
          outcomeVerdict: ordinal <= positives[arm] ? 'candidate_router_breakthrough' : 'no_breakthrough',
          learnerRubric: {
            first: 50,
            last: 50 + (arm === 'adaptive' ? 8 : arm === 'routerWarm' ? 3 : 4),
            delta: arm === 'adaptive' ? 8 : arm === 'routerWarm' ? 3 : 4,
            turnCount: 2,
            version: '2.2',
            judge: GRID.scoring.learnerJudgeLabel,
          },
          tutorV22: {
            overall: arm === 'adaptive' ? 82 : arm === 'routerWarm' ? 84 : 78,
            first: 80,
            last: 84,
            version: GRID.scoring.tutorRubricVersion,
            judge: GRID.scoring.tutorJudgeLabel,
          },
          turns: selected.map((registerName, turn) => {
            const edged = GRID.edgedRegisters.includes(registerName);
            return {
              turn,
              phase: turn === 1 ? 'resistance' : turn === 2 ? 'uptake' : 'other',
              selectedRegister: registerName,
              routerSelectedRegister: arm === 'pinnedSarcastic' && turn === 1 ? 'charismatic' : registerName,
              assignedRegisterArm: arm === 'pinnedSarcastic' && turn === 1 ? 'sarcastic' : null,
              registerAssignmentSource: arm === 'pinnedSarcastic' && turn === 1 ? 'experiment_arm' : null,
              routerMenu: menu,
              registerRubricScore: edged ? 90 : null,
              registerJudgeModel: edged ? GRID.scoring.registerJudge : null,
              stanceFidelity: edged ? stance(registerName) : null,
            };
          }),
          dialogueTrace: GRID.tutorSeats.map((agent) => ({
            agent,
            action: 'call',
            metrics: { provider: 'codex', model: 'gpt-5.5' },
          })),
        });
      }
    }
  }
  return rows;
}

test('Stage-2 gate accepts only the completed ten-row Stage-1 report', () => {
  const gate = validateAdaptiveRegisterSwitchingStage1Gate(stage1Artifact(), PLAN_SHA);
  assert.equal(gate.ok, true, gate.errors.join('; '));
  assert.equal(gate.runId, 'eval-stage1');

  const incomplete = stage1Artifact();
  incomplete.report.registeredMeasures[2].status = 'incomplete';
  const failed = validateAdaptiveRegisterSwitchingStage1Gate(incomplete, PLAN_SHA);
  assert.equal(failed.ok, false);
  assert.ok(failed.errors.some((error) => /measure 3/u.test(error)));
});

test('Stage-2 report is complete and keys its sole decision to adaptive versus router-warm', () => {
  const gate = validateAdaptiveRegisterSwitchingStage1Gate(stage1Artifact(), PLAN_SHA);
  const report = summarizeAdaptiveRegisterSwitchingStage2(syntheticStage2Dialogues(), { stage1Gate: gate });

  assert.equal(report.status, 'COMPLETE', report.errors.join('; '));
  assert.equal(report.decision, 'PASS_PRIMARY');
  assert.equal(report.stage3Authorized, false);
  assert.deepEqual(
    Object.fromEntries(Object.entries(report.conversion.byArm).map(([arm, row]) => [arm, row.positive])),
    { adaptive: 30, routerWarm: 17, pinnedSarcastic: 22 },
  );
  assert.equal(report.conversion.primary.controlsDecision, true);
  assert.equal(report.conversion.timingVsEdge.controlsDecision, false);
  assert.ok(report.conversion.primary.fisherExactTwoSidedP < GRID.stage2.alpha);
  assert.equal(report.learnerRubricChange.byArm.adaptive.mean, 8);
  assert.equal(report.tutorV22Cost.byArm.adaptive.mean, 82);
  assert.ok(!Object.hasOwn(report, 'cueCountContrast'));
  assert.deepEqual(report.fidelityByRegister.ironic.gateIdentities, [`ironic@${GRID.measurement.gateVersion}`]);
  assert.deepEqual(report.fidelityByRegister.sarcastic.gateIdentities, [`sarcastic@${GRID.measurement.gateVersion}`]);
  assert.ok(report.registeredMeasures.every((measure) => /measured/u.test(measure.status)));
});

test('Stage-2 report fails closed on any missing registered measure', () => {
  const rows = syntheticStage2Dialogues();
  rows[0].learnerRubric.delta = null;
  rows[1].turns[1].stanceFidelity.mannerPresence.status = 'not_supplied';
  const gate = validateAdaptiveRegisterSwitchingStage1Gate(stage1Artifact(), PLAN_SHA);
  const report = summarizeAdaptiveRegisterSwitchingStage2(rows, { stage1Gate: gate });

  assert.equal(report.status, 'INCOMPLETE');
  assert.equal(report.decision, null);
  assert.ok(report.errors.some((error) => /learner first-to-last/u.test(error)));
  assert.ok(report.errors.some((error) => /manner presence unread/u.test(error)));
});

test('Stage-2 report validates the sarcastic arm only at resistance-gated experiment assignments', () => {
  const rows = syntheticStage2Dialogues();
  const pinned = rows.find((row) => row.profileName === GRID.arms.pinnedSarcastic.profile);
  const assigned = pinned.turns.find((turn) => turn.assignedRegisterArm);
  assigned.assignedRegisterArm = null;
  assigned.registerAssignmentSource = null;

  const gate = validateAdaptiveRegisterSwitchingStage1Gate(stage1Artifact(), PLAN_SHA);
  const report = summarizeAdaptiveRegisterSwitchingStage2(rows, { stage1Gate: gate });

  assert.equal(report.status, 'INCOMPLETE');
  assert.equal(report.decision, null);
  assert.ok(report.errors.some((error) => /unassigned pinned-control turn selected edged register/u.test(error)));
  assert.ok(!report.errors.some((error) => /turn_0: pinned-sarcastic selected brisk/u.test(error)));
});

test('Stage-2 runner freezes 105 serial rows and SHA-gated attended follow-ups', () => {
  const generation = stage2GenerationCommand().join(' ');
  const outcomes = stage2OutcomeScoringCommands('eval-test').map((command) => command.join(' '));
  const register = stage2RegisterScoringCommands('eval-test').map((command) => command.join(' '));
  const followUps = stage2FollowUpCommands('eval-test', 'a'.repeat(40), 'stage1.json', PLAN_SHA).map((command) =>
    command.join(' '),
  );

  assert.match(generation, new RegExp(GRID.arms.adaptive.profile, 'u'));
  assert.match(generation, new RegExp(GRID.arms.routerWarm.profile, 'u'));
  assert.match(generation, new RegExp(GRID.arms.pinnedSarcastic.profile, 'u'));
  assert.match(generation, /--runs 7 --parallelism 1 --skip-rubric/u);
  assert.doesNotMatch(generation, /nemotron|kimi/iu);
  assert.equal(outcomes.length, 2);
  assert.match(outcomes[0], /evaluate eval-test .*--model claude-sonnet-5 .*--tutor-only/u);
  assert.match(outcomes[1], /evaluate-learner eval-test .*--model claude-sonnet-5/u);
  assert.deepEqual(
    register.map((command) => /--register (ironic|sarcastic)/u.exec(command)?.[1]),
    ['ironic', 'sarcastic'],
  );
  assert.equal(followUps.length, 4);
  assert.ok(followUps.slice(0, 3).every((command) => /--launch-approved --expected-sha a{40}/u.test(command)));
  assert.ok(followUps.every((command) => command.includes(`--approved-plan-sha ${PLAN_SHA}`)));
  assert.match(followUps.at(-1), /--report-run eval-test/u);
});

test('paid-study endpoint preflight exercises the full 105-row production assembler with zero calls and writes', () => {
  const contract = readJson(ENDPOINT_CONTRACT_PATH);
  const certificate = readJson(ENDPOINT_GO_PATH);
  const preflight = runAdaptiveRegisterSwitchingStage2EndpointPreflight(contract);
  const go = validatePaidStudyEndpointGoCertificate({ certificate, contract, preflight });

  assert.equal(preflight.status, 'passed');
  assert.equal(preflight.model_calls, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(preflight.packet_audit.covered_cases, GRID.stage2.plannedRows);
  assert.equal(preflight.assembly_audit.covered_cases, GRID.stage2.plannedRows);
  assert.equal(preflight.packet_audit.packets, GRID.scenarios.length);
  assert.ok(Object.values(preflight.assembly_audit.endpoint_status).every((status) => status === 'complete'));
  assert.equal(go.ok, true, go.errors.join('; '));
});

test('paid-study endpoint preflight fails closed for every registered runtime mismatch', () => {
  const baseline = readJson(ENDPOINT_CONTRACT_PATH);
  const cases = buildAdaptiveRegisterSwitchingStage2SyntheticCorpus();
  const fieldedChannels = [...ADAPTIVE_REGISTER_SWITCHING_STAGE2_FIELDED_CHANNELS];
  const run = (contract, options = {}) =>
    runPaidStudyEndpointPreflight({
      contract,
      fieldedChannels: options.fieldedChannels ?? fieldedChannels,
      cases: options.cases || cases,
      buildPackets: options.buildPackets || buildAdaptiveRegisterSwitchingStage2PreflightPackets,
      assemble: options.assemble || assembleAdaptiveRegisterSwitchingStage2Preflight,
    });

  const validFielding = run(baseline);
  assert.equal(validFielding.model_calls, 0);
  assert.equal(validFielding.production_writes, 0);

  let packetBuilds = 0;
  let assemblies = 0;
  assert.throws(
    () =>
      run(baseline, {
        fieldedChannels: fieldedChannels.filter((channelId) => channelId !== 'manner_presence_reader'),
        buildPackets: (...args) => {
          packetBuilds += 1;
          return buildAdaptiveRegisterSwitchingStage2PreflightPackets(...args);
        },
        assemble: (...args) => {
          assemblies += 1;
          return assembleAdaptiveRegisterSwitchingStage2Preflight(...args);
        },
      }),
    /conversion_adaptive_vs_router_warm: required channel manner_presence_reader is not fielded by the prospective run/u,
  );
  assert.equal(packetBuilds, 0);
  assert.equal(assemblies, 0);

  const unfieldedContractChannel = structuredClone(baseline);
  unfieldedContractChannel.channels.shadow_reader = {
    enabled: true,
    implementation: 'prospective adapter does not field this channel',
  };
  unfieldedContractChannel.endpoints[0].required_channels.push('shadow_reader');
  assert.throws(
    () => runAdaptiveRegisterSwitchingStage2EndpointPreflight(unfieldedContractChannel),
    /conversion_adaptive_vs_router_warm: required channel shadow_reader is not fielded by the prospective run/u,
  );

  const disabledReader = structuredClone(baseline);
  disabledReader.channels.manner_presence_reader.enabled = false;
  assert.throws(() => run(disabledReader), /required channel manner_presence_reader is disabled/u);

  const missingEventCases = structuredClone(cases);
  delete missingEventCases[0].positiveOutcome;
  assert.throws(() => run(baseline, { cases: missingEventCases }), /missing required event positiveOutcome/u);

  const tinyPacket = structuredClone(baseline);
  tinyPacket.runner.packet_cap_bytes = 100;
  assert.throws(() => run(tinyPacket), /exceeds 100-byte packet cap/u);

  const splitPairs = (rows) => rows.map((row) => ({ packet_id: row.case_id, case_ids: [row.case_id], cases: [row] }));
  assert.throws(() => run(baseline, { buildPackets: splitPairs }), /sharding split pairing group/u);

  const incompleteAssembler = (input) => {
    const assembled = assembleAdaptiveRegisterSwitchingStage2Preflight(input);
    assembled.case_ids.pop();
    return assembled;
  };
  assert.throws(() => run(baseline, { assemble: incompleteAssembler }), /does not cover the synthetic corpus exactly/u);

  const demotedPrimary = structuredClone(baseline);
  demotedPrimary.endpoints[0].role = 'secondary';
  assert.throws(() => run(demotedPrimary), /registered primary endpoint .* was disabled or demoted/u);
});

test('endpoint GO certificate fails closed on executable contract or preflight drift', () => {
  const contract = readJson(ENDPOINT_CONTRACT_PATH);
  const certificate = readJson(ENDPOINT_GO_PATH);
  const preflight = runAdaptiveRegisterSwitchingStage2EndpointPreflight(contract);
  const drifted = structuredClone(certificate);
  drifted.preflight_sha256 = '0'.repeat(64);

  const go = validatePaidStudyEndpointGoCertificate({ certificate: drifted, contract, preflight });
  assert.equal(go.ok, false);
  assert.match(go.errors.join('; '), /preflight digest does not match/u);
});

test('Stage-2 runner uses the read-only DB helper and has no Stage-3 or evaluation-path override', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts/run-adaptive-register-switching-stage2.js'), 'utf8');
  assert.match(source, /openEvaluationDbReadonly/u);
  assert.doesNotMatch(source, /new Database\s*\(/u);
  assert.doesNotMatch(source, /data\/evaluations\.db/u);
  assert.doesNotMatch(source, /EVAL_DB_PATH|EVAL_LOGS_DIR/u);
  assert.doesNotMatch(source, /stage3-run|launch-stage3/iu);
  assert.match(source, /Stage 3 is not authorized or available/u);
  assert.match(
    source,
    /const endpointPreflight = runStage2EndpointGoPreflight\(\);\s+const launchSha = launch \? assertStage2LaunchAuthorization/su,
  );
});
