import {
  ADAPTIVE_REGISTER_SWITCHING as GRID,
  buildAdaptiveRegisterSwitchingPlan,
} from './adaptiveRegisterSwitching.js';
import { summarizeAdaptiveRegisterSwitchingStage2 } from './adaptiveRegisterSwitchingStage2.js';
import { runPaidStudyEndpointPreflight } from './paidStudyEndpointPreflight.js';

function syntheticStance(registerName) {
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

export function buildAdaptiveRegisterSwitchingStage2SyntheticCorpus() {
  const plan = buildAdaptiveRegisterSwitchingPlan();
  return plan.stage2Jobs.map((job) => {
    const menu = job.arm === 'adaptive' ? plan.adaptiveRouterMenu : plan.normalRouterMenu;
    const selected =
      job.arm === 'pinnedSarcastic'
        ? ['brisk', 'sarcastic', 'precise']
        : ['brisk', job.arm === 'adaptive' ? 'ironic' : 'precise', 'precise'];
    const profileName = GRID.arms[job.arm].profile;
    return {
      case_id: `${job.arm}:${job.scenario}:${job.repeat}`,
      arm: job.arm,
      repeat: job.repeat,
      rowId: `${job.arm}:${job.scenario}:${job.repeat}`,
      dialogueId: `synthetic:${job.arm}:${job.scenario}:${job.repeat}`,
      scenarioId: job.scenario,
      profileName,
      positiveOutcome: job.repeat % 2 === 0,
      outcomeVerdict: job.repeat % 2 === 0 ? 'candidate_router_breakthrough' : 'no_breakthrough',
      learnerRubric: {
        first: 50,
        last: 54,
        delta: 4,
        turnCount: 2,
        version: '2.2',
        judge: GRID.scoring.learnerJudgeLabel,
      },
      tutorV22: {
        overall: 82,
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
          routerSelectedRegister: job.arm === 'pinnedSarcastic' && turn === 1 ? 'charismatic' : registerName,
          assignedRegisterArm: job.arm === 'pinnedSarcastic' && turn === 1 ? 'sarcastic' : null,
          registerAssignmentSource: job.arm === 'pinnedSarcastic' && turn === 1 ? 'experiment_arm' : null,
          routerMenu: menu,
          registerRubricScore: edged ? 90 : null,
          registerJudgeModel: edged ? GRID.scoring.registerJudge : null,
          stanceFidelity: edged ? syntheticStance(registerName) : null,
        };
      }),
      dialogueTrace: GRID.tutorSeats.map((agent) => ({
        agent,
        action: 'call',
        metrics: { provider: 'codex', model: 'gpt-5.5' },
      })),
    };
  });
}

export function buildAdaptiveRegisterSwitchingStage2PreflightPackets(cases) {
  const groups = new Map();
  for (const row of cases) {
    const key = row.scenarioId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([key, rows]) => ({
    schema: 'machinespirits.adaptive-register-switching-stage2-preflight-packet.v1',
    packet_id: key,
    case_ids: rows.map((row) => row.case_id),
    cases: rows,
  }));
}

export function assembleAdaptiveRegisterSwitchingStage2Preflight({ packets, contract, stage1Gate = null }) {
  const cases = packets.flatMap((packet) => packet.cases);
  const report = summarizeAdaptiveRegisterSwitchingStage2(cases, {
    stage1Gate: stage1Gate || {
      ok: true,
      errors: [],
      reportDecision: 'PASS_STAGE1',
      runId: 'synthetic-zero-call',
    },
  });
  const measureStatus = new Map(report.registeredMeasures.map((measure) => [measure.key, measure.status]));
  const endpointMeasure = {
    conversion_adaptive_vs_router_warm: 'conversion_adaptive_vs_router_warm',
    conversion_adaptive_vs_pinned_sarcastic: 'conversion_adaptive_vs_pinned_sarcastic',
    learner_rubric_change: 'learner_rubric_change',
    tutor_v22_cost_by_arm: 'tutor_v22_cost_by_arm',
  };
  return {
    case_ids: cases.map((row) => row.case_id),
    endpoint_status: Object.fromEntries(
      contract.endpoints.map((endpoint) => [
        endpoint.id,
        report.status === 'COMPLETE' && /measured/u.test(measureStatus.get(endpointMeasure[endpoint.id]) || '')
          ? 'complete'
          : 'incomplete',
      ]),
    ),
    report,
  };
}

export function runAdaptiveRegisterSwitchingStage2EndpointPreflight(contract) {
  return runPaidStudyEndpointPreflight({
    contract,
    cases: buildAdaptiveRegisterSwitchingStage2SyntheticCorpus(),
    buildPackets: buildAdaptiveRegisterSwitchingStage2PreflightPackets,
    assemble: assembleAdaptiveRegisterSwitchingStage2Preflight,
  });
}

export default {
  assembleAdaptiveRegisterSwitchingStage2Preflight,
  buildAdaptiveRegisterSwitchingStage2PreflightPackets,
  buildAdaptiveRegisterSwitchingStage2SyntheticCorpus,
  runAdaptiveRegisterSwitchingStage2EndpointPreflight,
};
