import { createHash } from 'node:crypto';

import { getRouterSelectableEngagementRegisterNames } from './engagementRegisterRegistry.js';
import { MANNER_PRESENCE_PROMPT_VERSION } from './registerMannerPresence.js';
import { STANCE_GATE_VERSION } from './registerStanceFidelity.js';

const CONTROLLED_SCENARIOS = Object.freeze([
  'charisma_desire_resistance_breakthrough_boredom',
  'charisma_desire_resistance_breakthrough_frustration',
  'charisma_desire_resistance_breakthrough_irrelevance',
  'charisma_desire_resistance_breakthrough_question_flood',
  'charisma_desire_resistance_breakthrough_rote_parroting',
]);

const EDGED_REGISTERS = Object.freeze(['ironic', 'sarcastic']);

// Exact unconditional power of a two-sided Fisher test at alpha .05 with
// independent Binomial(n, .50) and Binomial(n, p1) counts. `minimumNPerArm`
// is the first integer n reaching .80; `balancedNPerArm` rounds upward to a
// multiple of five so every controlled target receives the same repeats.
export const ADAPTIVE_REGISTER_SWITCHING_POWER = Object.freeze([
  Object.freeze({
    warmRate: 0.5,
    adaptiveRate: 0.65,
    delta: 0.15,
    minimumNPerArm: 183,
    balancedNPerArm: 185,
    balancedPower: 0.8102,
  }),
  Object.freeze({
    warmRate: 0.5,
    adaptiveRate: 0.7,
    delta: 0.2,
    minimumNPerArm: 102,
    balancedNPerArm: 105,
    balancedPower: 0.8153,
  }),
  Object.freeze({
    warmRate: 0.5,
    adaptiveRate: 0.75,
    delta: 0.25,
    minimumNPerArm: 64,
    balancedNPerArm: 65,
    balancedPower: 0.809,
  }),
  Object.freeze({
    warmRate: 0.5,
    adaptiveRate: 0.8,
    delta: 0.3,
    minimumNPerArm: 44,
    balancedNPerArm: 45,
    balancedPower: 0.8154,
  }),
  Object.freeze({
    warmRate: 0.5,
    adaptiveRate: 0.85,
    delta: 0.35,
    minimumNPerArm: 32,
    balancedNPerArm: 35,
    balancedPower: 0.8522,
  }),
  Object.freeze({
    warmRate: 0.5,
    adaptiveRate: 0.9,
    delta: 0.4,
    minimumNPerArm: 23,
    balancedNPerArm: 25,
    balancedPower: 0.8326,
  }),
]);

export const ADAPTIVE_REGISTER_SWITCHING = Object.freeze({
  schema: 'machinespirits.adaptive-register-switching-plan.v1',
  preregistration: 'notes/2026-08-09-adaptive-register-switching-prereg-draft.md',
  scenarioSource: 'config/charisma-recognition-desire-scenarios.yaml',
  scenarios: CONTROLLED_SCENARIOS,
  edgedRegisters: EDGED_REGISTERS,
  arms: Object.freeze({
    adaptive: Object.freeze({
      profile: 'cell_204_id_director_adaptive_edged_register_switching',
      registerPin: null,
      routerRegisterMenu: EDGED_REGISTERS,
    }),
    routerWarm: Object.freeze({
      profile: 'cell_205_id_director_router_warm_register_control',
      registerPin: null,
      routerRegisterMenu: Object.freeze([]),
    }),
    pinnedSarcastic: Object.freeze({
      profile: 'cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified',
      registerPin: 'sarcastic',
      routerRegisterMenu: Object.freeze([]),
    }),
  }),
  generation: Object.freeze({
    tutorModel: 'codex.gpt-5.5',
    learnerModel: 'codex.gpt-5.5',
    parallelism: 1,
    skipRubric: true,
  }),
  scoring: Object.freeze({
    tutorRubricVersion: '2.2',
    tutorJudgeCli: 'claude',
    tutorJudgeModel: 'claude-sonnet-5',
    tutorJudgeLabel: 'claude-code/claude-sonnet-5',
    learnerJudgeCli: 'claude',
    learnerJudgeModel: 'claude-sonnet-5',
    learnerJudgeLabel: 'claude-code/claude-sonnet-5',
    registerJudge: 'claude-code.sonnet-5',
  }),
  measurement: Object.freeze({
    gateVersion: STANCE_GATE_VERSION,
    presenceQuestion: MANNER_PRESENCE_PROMPT_VERSION,
    presenceReader: 'claude-code/claude-sonnet-5',
    conversionFold: 'post_resistance',
    continuousSecondary: 'learner_rubric_first_to_last_delta',
  }),
  tutorSeats: Object.freeze(['id', 'ego', 'agency_return_verifier']),
  measures: Object.freeze([
    Object.freeze({ number: 1, key: 'tutor_stack_provenance', stage: 'stage1' }),
    Object.freeze({ number: 2, key: 'adaptive_register_switching', stage: 'stage1' }),
    Object.freeze({ number: 3, key: 'resistance_vs_uptake_timing', stage: 'stage1' }),
    Object.freeze({ number: 4, key: 'per_register_fidelity_and_manner_presence', stage: 'stage1' }),
    Object.freeze({ number: 5, key: 'conversion_adaptive_vs_router_warm', stage: 'stage2' }),
    Object.freeze({ number: 6, key: 'conversion_adaptive_vs_pinned_sarcastic', stage: 'stage2' }),
    Object.freeze({ number: 7, key: 'learner_rubric_change', stage: 'stage2' }),
    Object.freeze({ number: 8, key: 'tutor_v22_cost_by_arm', stage: 'stage2' }),
  ]),
  stage1: Object.freeze({
    arm: 'adaptive',
    repeatsPerScenario: 2,
    plannedRows: 10,
    outcomeClaimAuthorized: false,
    passRule:
      'At least one within-dialogue switch; at least one edged resistance choice; zero edged uptake choices; resistance edge rate strictly exceeds uptake edge rate.',
  }),
  stage2: Object.freeze({
    repeatsPerScenario: 7,
    plannedRowsPerArm: 35,
    plannedRows: 105,
    alpha: 0.05,
    targetPower: 0.8,
    proposedContrast: Object.freeze({ warmRate: 0.5, adaptiveRate: 0.85, delta: 0.35 }),
    launchStatus: 'locked_pending_stage1_and_operator_approval',
  }),
  powerTable: ADAPTIVE_REGISTER_SWITCHING_POWER,
});

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value;
}

export function hashAdaptiveRegisterSwitching(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalJson(value)))
    .digest('hex');
}

function jobsFor(arms, repeatsPerScenario) {
  const jobs = [];
  for (const armName of arms) {
    const arm = ADAPTIVE_REGISTER_SWITCHING.arms[armName];
    for (const scenario of CONTROLLED_SCENARIOS) {
      for (let repeat = 1; repeat <= repeatsPerScenario; repeat += 1) {
        jobs.push({ ordinal: jobs.length + 1, arm: armName, profile: arm.profile, scenario, repeat });
      }
    }
  }
  return jobs;
}

export function buildAdaptiveRegisterSwitchingPlan() {
  const grid = ADAPTIVE_REGISTER_SWITCHING;
  const normalRouterMenu = getRouterSelectableEngagementRegisterNames();
  const adaptiveRouterMenu = getRouterSelectableEngagementRegisterNames(grid.arms.adaptive.routerRegisterMenu);
  const plan = {
    ...grid,
    scenarios: [...grid.scenarios],
    edgedRegisters: [...grid.edgedRegisters],
    arms: JSON.parse(JSON.stringify(grid.arms)),
    generation: { ...grid.generation },
    scoring: { ...grid.scoring },
    measurement: { ...grid.measurement },
    tutorSeats: [...grid.tutorSeats],
    measures: grid.measures.map((measure) => ({ ...measure })),
    stage1: { ...grid.stage1 },
    stage2: { ...grid.stage2, proposedContrast: { ...grid.stage2.proposedContrast } },
    powerTable: grid.powerTable.map((row) => ({ ...row })),
    normalRouterMenu,
    adaptiveRouterMenu,
    stage1Jobs: jobsFor(['adaptive'], grid.stage1.repeatsPerScenario),
    stage2Jobs: jobsFor(['adaptive', 'routerWarm', 'pinnedSarcastic'], grid.stage2.repeatsPerScenario),
  };
  return { ...plan, planSha256: hashAdaptiveRegisterSwitching(plan) };
}

export function validateAdaptiveRegisterSwitchingPlan(plan) {
  const grid = ADAPTIVE_REGISTER_SWITCHING;
  const errors = [];
  if (plan.stage1Jobs?.length !== grid.stage1.plannedRows) {
    errors.push(`Stage 1 expected ${grid.stage1.plannedRows} rows, found ${plan.stage1Jobs?.length || 0}`);
  }
  if (plan.stage2Jobs?.length !== grid.stage2.plannedRows) {
    errors.push(`Stage 2 expected ${grid.stage2.plannedRows} rows, found ${plan.stage2Jobs?.length || 0}`);
  }
  const stage1Counts = new Map();
  for (const job of plan.stage1Jobs || []) {
    const key = `${job.arm}::${job.scenario}`;
    stage1Counts.set(key, (stage1Counts.get(key) || 0) + 1);
  }
  for (const scenario of grid.scenarios) {
    if (stage1Counts.get(`adaptive::${scenario}`) !== grid.stage1.repeatsPerScenario) {
      errors.push(`${scenario} does not carry ${grid.stage1.repeatsPerScenario} Stage-1 repeats`);
    }
  }
  const stage2Counts = new Map();
  for (const job of plan.stage2Jobs || []) {
    const key = `${job.arm}::${job.scenario}`;
    stage2Counts.set(key, (stage2Counts.get(key) || 0) + 1);
  }
  for (const arm of ['adaptive', 'routerWarm', 'pinnedSarcastic']) {
    for (const scenario of grid.scenarios) {
      if (stage2Counts.get(`${arm}::${scenario}`) !== grid.stage2.repeatsPerScenario) {
        errors.push(`${arm}::${scenario} does not carry ${grid.stage2.repeatsPerScenario} Stage-2 repeats`);
      }
    }
  }
  if (grid.arms.adaptive.registerPin !== null || grid.arms.routerWarm.registerPin !== null) {
    errors.push('adaptive and router-warm arms must not pin a register');
  }
  if (JSON.stringify(grid.arms.adaptive.routerRegisterMenu) !== JSON.stringify(EDGED_REGISTERS)) {
    errors.push('adaptive arm must admit exactly ironic and sarcastic');
  }
  if (grid.measurement.presenceQuestion !== 'manner-presence/1.0') {
    errors.push(`presence question must remain manner-presence/1.0, found ${grid.measurement.presenceQuestion}`);
  }
  if (/nemotron|kimi/iu.test(JSON.stringify({ generation: grid.generation, scoring: grid.scoring }))) {
    errors.push('the frozen launch/scoring stack contains a forbidden weak model');
  }
  if (grid.measures.map((measure) => measure.number).join(',') !== '1,2,3,4,5,6,7,8') {
    errors.push('registered measures 1-8 are not all present in order');
  }
  const proposedPower = grid.powerTable.find(
    (row) =>
      row.warmRate === grid.stage2.proposedContrast.warmRate &&
      row.adaptiveRate === grid.stage2.proposedContrast.adaptiveRate,
  );
  if (
    !proposedPower ||
    proposedPower.balancedNPerArm !== grid.stage2.plannedRowsPerArm ||
    proposedPower.balancedPower < 0.8
  ) {
    errors.push('Stage-2 row count is not backed by the frozen exact-power table');
  }
  return { ok: errors.length === 0, errors };
}

export function checkAdaptiveTutorStackProvenance(dialogues, { grid = ADAPTIVE_REGISTER_SWITCHING } = {}) {
  const dot = grid.generation.tutorModel.indexOf('.');
  const expectedProvider = grid.generation.tutorModel.slice(0, dot);
  const expectedModel = grid.generation.tutorModel.slice(dot + 1);
  const expectedSeats = new Set(grid.tutorSeats);
  const errors = [];
  const observed = new Map();
  let seatCalls = 0;

  for (const dialogue of dialogues || []) {
    const label = dialogue.dialogueId || '(unnamed dialogue)';
    const dialogueSeats = new Set();
    for (const entry of dialogue.dialogueTrace || []) {
      if (!expectedSeats.has(entry?.agent)) continue;
      const provider = entry.metrics?.provider ?? entry.provider ?? null;
      const model = entry.metrics?.model ?? entry.model ?? null;
      if (!provider || !model) {
        errors.push(`${label}: ${entry.agent}/${entry.action || 'call'} records no provider or model`);
        continue;
      }
      dialogueSeats.add(entry.agent);
      seatCalls += 1;
      const pair = `${provider}/${model}`;
      observed.set(pair, (observed.get(pair) || 0) + 1);
      if (provider !== expectedProvider || model !== expectedModel) {
        errors.push(
          `${label}: ${entry.agent}/${entry.action || 'call'} called ${pair}, plan says ${grid.generation.tutorModel}`,
        );
      }
      if (/nemotron|kimi/iu.test(pair))
        errors.push(`${label}: forbidden tutor stack observed at ${entry.agent}: ${pair}`);
    }
    for (const seat of expectedSeats) {
      if (!dialogueSeats.has(seat)) errors.push(`${label}: no ${seat} tutor-seat call found`);
    }
  }
  if (!seatCalls && !errors.length) errors.push('no tutor-seat calls found in any dialogue trace');
  return {
    ok: errors.length === 0,
    expected: grid.generation.tutorModel,
    seatCalls,
    observed: Object.fromEntries([...observed.entries()].sort()),
    errors,
  };
}

function emptyFidelityBucket(registerName) {
  return {
    register: registerName,
    turns: 0,
    cueCompliant: 0,
    mannerPresent: 0,
    mannerAbsent: 0,
    mannerUnread: 0,
    registerScoreSum: 0,
    registerScoreCount: 0,
    gateIdentities: new Set(),
  };
}

function finishFidelityBucket(bucket) {
  return {
    register: bucket.register,
    turns: bucket.turns,
    cueCompliant: bucket.cueCompliant,
    mannerPresent: bucket.mannerPresent,
    mannerAbsent: bucket.mannerAbsent,
    mannerUnread: bucket.mannerUnread,
    registerRubricMean: bucket.registerScoreCount ? bucket.registerScoreSum / bucket.registerScoreCount : null,
    gateIdentities: [...bucket.gateIdentities].sort(),
  };
}

function sameMenu(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  return [...actual].sort().join('\n') === [...expected].sort().join('\n');
}

/** Fail-closed Stage-1 router-behaviour report. Measures 5-8 stay explicitly uncollected. */
export function summarizeAdaptiveRegisterSwitchingStage1(dialogues, { provenance = null } = {}) {
  const grid = ADAPTIVE_REGISTER_SWITCHING;
  const expectedMenu = getRouterSelectableEngagementRegisterNames(grid.arms.adaptive.routerRegisterMenu);
  const errors = [];
  const fidelity = Object.fromEntries(EDGED_REGISTERS.map((name) => [name, emptyFidelityBucket(name)]));
  const scenarioCounts = new Map();
  let turnCount = 0;
  let resistanceTurns = 0;
  let uptakeTurns = 0;
  let resistanceEdges = 0;
  let uptakeEdges = 0;
  let otherEdges = 0;
  let registerSwitches = 0;

  if ((dialogues || []).length !== grid.stage1.plannedRows) {
    errors.push(`expected ${grid.stage1.plannedRows} Stage-1 rows, found ${(dialogues || []).length}`);
  }
  for (const dialogue of dialogues || []) {
    if (dialogue.profileName !== grid.arms.adaptive.profile) {
      errors.push(`${dialogue.rowId || dialogue.dialogueId}: unexpected profile ${dialogue.profileName || 'missing'}`);
    }
    if (!grid.scenarios.includes(dialogue.scenarioId)) {
      errors.push(`${dialogue.rowId || dialogue.dialogueId}: unexpected scenario ${dialogue.scenarioId || 'missing'}`);
    } else {
      scenarioCounts.set(dialogue.scenarioId, (scenarioCounts.get(dialogue.scenarioId) || 0) + 1);
    }
    const turns = Array.isArray(dialogue.turns) ? dialogue.turns : [];
    if (!turns.length) errors.push(`${dialogue.rowId || dialogue.dialogueId}: no router turns found`);
    let previousRegister = null;
    for (const turn of turns) {
      turnCount += 1;
      const label = `${dialogue.rowId || dialogue.dialogueId}:turn_${turn.turn}`;
      if (!sameMenu(turn.routerMenu, expectedMenu))
        errors.push(`${label}: router menu does not match the frozen adaptive menu`);
      if (!turn.selectedRegister) errors.push(`${label}: no selected register recorded`);
      if (turn.routerSelectedRegister !== turn.selectedRegister) {
        errors.push(`${label}: selected register and router choice disagree`);
      }
      if (!turn.routerMenu?.includes(turn.selectedRegister))
        errors.push(`${label}: selected register is outside the recorded menu`);
      if (previousRegister && previousRegister !== turn.selectedRegister) registerSwitches += 1;
      previousRegister = turn.selectedRegister || previousRegister;

      const edged = EDGED_REGISTERS.includes(turn.selectedRegister);
      if (turn.phase === 'resistance') {
        resistanceTurns += 1;
        if (edged) resistanceEdges += 1;
      } else if (turn.phase === 'uptake') {
        uptakeTurns += 1;
        if (edged) uptakeEdges += 1;
      } else if (edged) {
        otherEdges += 1;
      }

      if (!edged) continue;
      const bucket = fidelity[turn.selectedRegister];
      bucket.turns += 1;
      const stance = turn.stanceFidelity || null;
      if (!stance?.applies) {
        errors.push(`${label}: missing ${turn.selectedRegister} stance-fidelity verdict`);
      } else {
        bucket.gateIdentities.add(`${stance.gateRegister}@${stance.gateVersion}`);
        if (stance.gateRegister !== turn.selectedRegister || stance.gateVersion !== grid.measurement.gateVersion) {
          errors.push(
            `${label}: ${turn.selectedRegister} was not scored under its own ${grid.measurement.gateVersion} gate`,
          );
        }
        if (stance.passed) bucket.cueCompliant += 1;
        if (stance.passed && stance.missingRequired?.length) {
          errors.push(`${label}: faithful verdict lists missing required parts ${stance.missingRequired.join(', ')}`);
        }
        const presence = stance.mannerPresence || null;
        if (presence?.promptVersion !== grid.measurement.presenceQuestion) {
          errors.push(`${label}: manner reading is not ${grid.measurement.presenceQuestion}`);
        }
        if (presence?.reader !== grid.measurement.presenceReader) {
          errors.push(`${label}: manner reader is not ${grid.measurement.presenceReader}`);
        }
        if (presence?.status === 'present') bucket.mannerPresent += 1;
        else if (presence?.status === 'absent') bucket.mannerAbsent += 1;
        else {
          bucket.mannerUnread += 1;
          errors.push(`${label}: manner presence unread (${presence?.reason || 'missing'})`);
        }
      }
      if (!Number.isFinite(turn.registerRubricScore)) errors.push(`${label}: missing register-rubric score`);
      else {
        bucket.registerScoreSum += turn.registerRubricScore;
        bucket.registerScoreCount += 1;
      }
      if (turn.registerJudgeModel !== grid.scoring.registerJudge) {
        errors.push(
          `${label}: register judge is ${turn.registerJudgeModel || 'missing'}, not ${grid.scoring.registerJudge}`,
        );
      }
    }
  }
  for (const scenario of grid.scenarios) {
    if (scenarioCounts.get(scenario) !== grid.stage1.repeatsPerScenario) {
      errors.push(
        `${scenario}: expected ${grid.stage1.repeatsPerScenario} rows, found ${scenarioCounts.get(scenario) || 0}`,
      );
    }
  }
  if (!resistanceTurns) errors.push('no resistance turns observed');
  if (!uptakeTurns) errors.push('no post-resistance uptake turns observed');
  if (!provenance) errors.push('no tutor-stack provenance check supplied');
  else if (!provenance.ok) for (const error of provenance.errors) errors.push(`provenance: ${error}`);

  const status = errors.length ? 'INCOMPLETE' : 'COMPLETE';
  const resistanceEdgeRate = resistanceTurns ? resistanceEdges / resistanceTurns : null;
  const uptakeEdgeRate = uptakeTurns ? uptakeEdges / uptakeTurns : null;
  const behaviorPass =
    status === 'COMPLETE' &&
    registerSwitches > 0 &&
    resistanceEdges > 0 &&
    uptakeEdges === 0 &&
    otherEdges === 0 &&
    resistanceEdgeRate > uptakeEdgeRate;

  return {
    schema: 'machinespirits.adaptive-register-switching-stage1-report.v1',
    status,
    decision: status === 'COMPLETE' ? (behaviorPass ? 'PASS_STAGE1' : 'KILL_ROUTER_BEHAVIOR') : null,
    stage2Authorized: false,
    expectedRows: grid.stage1.plannedRows,
    observedRows: (dialogues || []).length,
    turnCount,
    provenance,
    routerBehavior: {
      registerSwitches,
      resistanceTurns,
      resistanceEdges,
      resistanceEdgeRate,
      uptakeTurns,
      uptakeEdges,
      uptakeEdgeRate,
      otherEdges,
      pass: behaviorPass,
    },
    // Kept strictly per register. There is intentionally no cue-count delta or
    // pooled cue total: each register has its own gate and cue family.
    fidelityByRegister: Object.fromEntries(
      Object.entries(fidelity).map(([name, bucket]) => [name, finishFidelityBucket(bucket)]),
    ),
    registeredMeasures: grid.measures.map((measure) => ({
      ...measure,
      status: measure.stage === 'stage1' ? (status === 'COMPLETE' ? 'measured' : 'incomplete') : 'not_collected_stage1',
    })),
    errors,
  };
}

export default {
  ADAPTIVE_REGISTER_SWITCHING,
  ADAPTIVE_REGISTER_SWITCHING_POWER,
  buildAdaptiveRegisterSwitchingPlan,
  checkAdaptiveTutorStackProvenance,
  hashAdaptiveRegisterSwitching,
  summarizeAdaptiveRegisterSwitchingStage1,
  validateAdaptiveRegisterSwitchingPlan,
};
