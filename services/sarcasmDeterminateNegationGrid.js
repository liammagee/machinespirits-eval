import { createHash } from 'node:crypto';

// Frozen 15-row plan for the sarcasm-as-determinate-negation follow-up
// (notes/2026-08-06-sarcasm-determinate-negation-preregistration.md). One
// tightened sarcastic arm across the parent grid's five controlled resistance
// targets, three repeats. Generation and judge seams match the re-frozen
// parent plan; the one addition is the negation-recovery pass, whose verdicts
// land in a sidecar JSON the fail-closed report requires for faithful rows.
export const SARCASM_DETERMINATE_NEGATION_GRID = Object.freeze({
  schema: 'machinespirits.sarcasm-determinate-negation-grid-plan.v1',
  preregistration: 'notes/2026-08-06-sarcasm-determinate-negation-preregistration.md',
  scenarioSource: 'config/charisma-recognition-desire-scenarios.yaml',
  profiles: Object.freeze(['cell_202_id_director_sarcastic_determinate_challenge_breakthrough_dynamic_verified']),
  scenarios: Object.freeze([
    'charisma_desire_resistance_breakthrough_boredom',
    'charisma_desire_resistance_breakthrough_frustration',
    'charisma_desire_resistance_breakthrough_irrelevance',
    'charisma_desire_resistance_breakthrough_question_flood',
    'charisma_desire_resistance_breakthrough_rote_parroting',
  ]),
  repeats: 3,
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
    registerJudge: 'claude-code.sonnet-5',
    recoveryJudge: 'claude-code.sonnet-5',
  }),
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

export function hashSarcasmDeterminateNegationGrid(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalJson(value)))
    .digest('hex');
}

export function buildSarcasmDeterminateNegationGridPlan() {
  const jobs = [];
  for (const profile of SARCASM_DETERMINATE_NEGATION_GRID.profiles) {
    for (const scenario of SARCASM_DETERMINATE_NEGATION_GRID.scenarios) {
      for (let repeat = 1; repeat <= SARCASM_DETERMINATE_NEGATION_GRID.repeats; repeat += 1) {
        jobs.push({ ordinal: jobs.length + 1, profile, scenario, repeat });
      }
    }
  }
  const plan = {
    ...SARCASM_DETERMINATE_NEGATION_GRID,
    profiles: [...SARCASM_DETERMINATE_NEGATION_GRID.profiles],
    scenarios: [...SARCASM_DETERMINATE_NEGATION_GRID.scenarios],
    design: '1 determinate sarcastic arm x 5 controlled resistance targets x 3 repeats',
    estimands: ['assigned_arm', 'faithful_arm', 'negation_recovery'],
    plannedRows: jobs.length,
    jobs,
  };
  return { ...plan, planSha256: hashSarcasmDeterminateNegationGrid(plan) };
}

export function validateSarcasmDeterminateNegationGridPlan(plan) {
  const errors = [];
  const grid = SARCASM_DETERMINATE_NEGATION_GRID;
  const expectedRows = grid.profiles.length * grid.scenarios.length * grid.repeats;
  if (plan.plannedRows !== expectedRows || plan.jobs?.length !== expectedRows) {
    errors.push(`expected ${expectedRows} planned rows, found ${plan.jobs?.length || 0}`);
  }
  const counts = new Map();
  for (const job of plan.jobs || []) {
    const key = `${job.profile}::${job.scenario}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  for (const profile of grid.profiles) {
    for (const scenario of grid.scenarios) {
      const key = `${profile}::${scenario}`;
      if (counts.get(key) !== grid.repeats) {
        errors.push(`${key} expected ${grid.repeats} rows, found ${counts.get(key) || 0}`);
      }
    }
  }
  return { ok: errors.length === 0, errors, expectedRows, observedCells: counts.size };
}

// Fail-closed completeness over analyzed rows plus the recovery sidecar.
// `analyses` rows carry the same fields the parent reporter emits;
// `recoveryBySlice` maps `${rowId}::${sliceKey}` to a recovery verdict.
export function summarizeSarcasmDeterminateNegationGrid(analyses, recoveryBySlice = new Map()) {
  const grid = SARCASM_DETERMINATE_NEGATION_GRID;
  const rows = analyses.filter(
    (row) => grid.profiles.includes(row.profileName) && grid.scenarios.includes(row.scenarioId),
  );
  const errors = [];
  const counts = new Map();
  const byTarget = new Map();

  const bucket = () => ({
    assignedRows: 0,
    assignedPositive: 0,
    tutorV22Sum: 0,
    tutorV22Count: 0,
    registerSum: 0,
    registerCount: 0,
    faithfulRows: 0,
    faithfulPositive: 0,
    excludedNoncompliance: 0,
    invalidViolations: 0,
    recoveryScored: 0,
    recoveryTrue: 0,
  });

  for (const row of rows) {
    counts.set(row.scenarioId, (counts.get(row.scenarioId) || 0) + 1);
    if (!byTarget.has(row.targetSignal)) byTarget.set(row.targetSignal, bucket());
    const b = byTarget.get(row.targetSignal);
    const positive = Boolean(row.positiveOutcome);
    b.assignedRows += 1;
    b.assignedPositive += positive ? 1 : 0;
    if (Number.isFinite(row.tutorV22Score)) {
      b.tutorV22Sum += row.tutorV22Score;
      b.tutorV22Count += 1;
    }
    if (Number.isFinite(row.registerRubricScore)) {
      b.registerSum += row.registerRubricScore;
      b.registerCount += 1;
    }
    if (row.stanceFidelity?.countsAsArmEvidence) {
      b.faithfulRows += 1;
      b.faithfulPositive += positive ? 1 : 0;
      const recovery = row.recovery ?? null;
      if (recovery == null) {
        errors.push(`${row.rowId}: faithful row missing negation-recovery verdict`);
      } else {
        b.recoveryScored += 1;
        b.recoveryTrue += recovery.recovered === true ? 1 : 0;
      }
    }
    b.excludedNoncompliance += row.stanceFidelity?.countsAsExcludedNoncompliance ? 1 : 0;
    b.invalidViolations += row.stanceFidelity?.countsAsInvalidViolation ? 1 : 0;
  }

  for (const scenario of grid.scenarios) {
    if (counts.get(scenario) !== grid.repeats) {
      errors.push(`${scenario} expected ${grid.repeats} rows, found ${counts.get(scenario) || 0}`);
    }
  }
  if (rows.some((row) => row.tutorV22Score == null)) errors.push('one or more rows are missing tutor-only v2.2 scores');
  if (rows.some((row) => String(row.tutorRubricVersion) !== grid.scoring.tutorRubricVersion)) {
    errors.push(`one or more rows are not scored with tutor rubric v${grid.scoring.tutorRubricVersion}`);
  }
  if (rows.some((row) => row.tutorJudgeModel !== grid.scoring.tutorJudgeLabel)) {
    errors.push(`one or more rows are not tutor-scored by ${grid.scoring.tutorJudgeLabel}`);
  }
  if (rows.some((row) => row.registerRubricScore == null))
    errors.push('one or more rows are missing register-rubric scores');
  if (rows.some((row) => row.registerJudgeModel !== grid.scoring.registerJudge)) {
    errors.push(`one or more rows are not register-scored by ${grid.scoring.registerJudge}`);
  }
  if (rows.some((row) => !row.stanceFidelity?.applies))
    errors.push('one or more rows are missing stance-fidelity classification');

  const targets = [...byTarget.entries()].map(([target, b]) => ({
    target,
    ...b,
    assignedTutorV22Mean: b.tutorV22Count ? b.tutorV22Sum / b.tutorV22Count : null,
    assignedRegisterMean: b.registerCount ? b.registerSum / b.registerCount : null,
  }));

  return {
    schema: 'machinespirits.sarcasm-determinate-negation-grid-report.v1',
    status: errors.length ? 'INCOMPLETE' : 'COMPLETE',
    errors,
    expectedRows: grid.profiles.length * grid.scenarios.length * grid.repeats,
    observedRows: rows.length,
    recoverySlices: recoveryBySlice.size,
    byTarget: targets,
  };
}
