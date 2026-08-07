import { createHash } from 'node:crypto';
import { STANCE_GATE_VERSION } from './registerStanceFidelity.js';
import { fisherExactTwoSided } from './fisherExact.js';

// Frozen 16-row plan for the sarcasm-precondition follow-up
// (notes/2026-08-07-sarcasm-precondition-preregistration.md).
//
// The determinate contract asks the tutor to name a learner claim and
// implicate its negation. On boredom and frustration the learner's only claim
// is about their own state, and negating that is the person attack the same
// contract forbids — so the two halves of the contract conflict and the tutor
// resolves the bind by dropping the manner. This plan holds the tutor fixed
// (cell 202, unchanged) and varies only whether the learner supplies a
// negatable claim about the material.
//
// Both conditions live in ONE run id. The contrast is within-run by
// construction: the parent arc's headline error was differencing counts across
// runs that disagreed on their gate and their slice fold.
export const SARCASM_PRECONDITION_GRID = Object.freeze({
  schema: 'machinespirits.sarcasm-precondition-grid-plan.v1',
  preregistration: 'notes/2026-08-07-sarcasm-precondition-preregistration.md',
  scenarioSource: 'config/charisma-recognition-desire-scenarios.yaml',
  profiles: Object.freeze(['cell_202_id_director_sarcastic_determinate_challenge_breakthrough_dynamic_verified']),
  // Ordered plain-first inside each mood so the artifact reads as two pairs.
  scenarios: Object.freeze([
    'charisma_desire_resistance_breakthrough_boredom',
    'charisma_desire_resistance_breakthrough_boredom_claimed',
    'charisma_desire_resistance_breakthrough_frustration',
    'charisma_desire_resistance_breakthrough_frustration_claimed',
  ]),
  // The condition map is frozen with the plan rather than derived from the
  // scenario name, so a renamed scenario fails the report instead of silently
  // re-labelling an arm.
  conditions: Object.freeze({
    charisma_desire_resistance_breakthrough_boredom: 'plain',
    charisma_desire_resistance_breakthrough_boredom_claimed: 'claimed',
    charisma_desire_resistance_breakthrough_frustration: 'plain',
    charisma_desire_resistance_breakthrough_frustration_claimed: 'claimed',
  }),
  moods: Object.freeze({
    charisma_desire_resistance_breakthrough_boredom: 'boredom',
    charisma_desire_resistance_breakthrough_boredom_claimed: 'boredom',
    charisma_desire_resistance_breakthrough_frustration: 'frustration',
    charisma_desire_resistance_breakthrough_frustration_claimed: 'frustration',
  }),
  repeats: 4,
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
  }),
  // Named up front, and checked at report time. Every count this plan produces
  // is scored by this gate, at this version, on this fold. A count that cannot
  // name all three is not a measurement.
  measurement: Object.freeze({
    gateRegister: 'sarcastic_determinate',
    gateVersion: STANCE_GATE_VERSION,
    fold: 'adopting_turn',
    foldSource: 'scripts/report-charisma-desire-breakthrough-matrix.js',
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

export function hashSarcasmPreconditionGrid(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalJson(value)))
    .digest('hex');
}

export function buildSarcasmPreconditionGridPlan() {
  const jobs = [];
  for (const profile of SARCASM_PRECONDITION_GRID.profiles) {
    for (const scenario of SARCASM_PRECONDITION_GRID.scenarios) {
      for (let repeat = 1; repeat <= SARCASM_PRECONDITION_GRID.repeats; repeat += 1) {
        jobs.push({
          ordinal: jobs.length + 1,
          profile,
          scenario,
          condition: SARCASM_PRECONDITION_GRID.conditions[scenario],
          mood: SARCASM_PRECONDITION_GRID.moods[scenario],
          repeat,
        });
      }
    }
  }
  const plan = {
    ...SARCASM_PRECONDITION_GRID,
    profiles: [...SARCASM_PRECONDITION_GRID.profiles],
    scenarios: [...SARCASM_PRECONDITION_GRID.scenarios],
    conditions: { ...SARCASM_PRECONDITION_GRID.conditions },
    moods: { ...SARCASM_PRECONDITION_GRID.moods },
    generation: { ...SARCASM_PRECONDITION_GRID.generation },
    scoring: { ...SARCASM_PRECONDITION_GRID.scoring },
    measurement: { ...SARCASM_PRECONDITION_GRID.measurement },
    design: '1 determinate sarcastic arm x 2 moods x {plain, claim-bearing} x 4 repeats',
    estimands: ['held_the_manner', 'named_a_claim', 'invalid_person_attack', 'positive_local_outcome'],
    plannedRows: jobs.length,
    jobs,
  };
  return { ...plan, planSha256: hashSarcasmPreconditionGrid(plan) };
}

export function validateSarcasmPreconditionGridPlan(plan) {
  const errors = [];
  const grid = SARCASM_PRECONDITION_GRID;
  const expectedRows = grid.profiles.length * grid.scenarios.length * grid.repeats;
  if (plan.plannedRows !== expectedRows || plan.jobs?.length !== expectedRows) {
    errors.push(`expected ${expectedRows} planned rows, found ${plan.jobs?.length || 0}`);
  }
  const counts = new Map();
  for (const job of plan.jobs || []) {
    counts.set(`${job.profile}::${job.scenario}`, (counts.get(`${job.profile}::${job.scenario}`) || 0) + 1);
    if (job.condition !== grid.conditions[job.scenario]) {
      errors.push(`${job.scenario} job ${job.ordinal} carries condition ${job.condition}`);
    }
  }
  for (const profile of grid.profiles) {
    for (const scenario of grid.scenarios) {
      const key = `${profile}::${scenario}`;
      if (counts.get(key) !== grid.repeats) {
        errors.push(`${key} expected ${grid.repeats} rows, found ${counts.get(key) || 0}`);
      }
    }
  }
  // The design is only a within-run contrast if both conditions are actually
  // planned, in equal size. A plan that drifts to 3-and-5 is not the
  // registered test.
  const perCondition = new Map();
  for (const job of plan.jobs || []) {
    perCondition.set(job.condition, (perCondition.get(job.condition) || 0) + 1);
  }
  for (const condition of ['plain', 'claimed']) {
    const observed = perCondition.get(condition) || 0;
    const expected = expectedRows / 2;
    if (observed !== expected) errors.push(`condition ${condition} expected ${expected} rows, found ${observed}`);
  }
  return { ok: errors.length === 0, errors, expectedRows, observedCells: counts.size };
}

function emptyBucket() {
  return {
    rows: 0,
    heldTheManner: 0,
    namedAClaim: 0,
    invalidViolations: 0,
    excludedNoncompliance: 0,
    positiveOutcomes: 0,
    tutorV22Sum: 0,
    tutorV22Count: 0,
    registerSum: 0,
    registerCount: 0,
  };
}

function withMeans(bucket) {
  return {
    ...bucket,
    tutorV22Mean: bucket.tutorV22Count ? bucket.tutorV22Sum / bucket.tutorV22Count : null,
    registerRubricMean: bucket.registerCount ? bucket.registerSum / bucket.registerCount : null,
  };
}

function contrast(label, claimed, plain, key) {
  const a = claimed[key];
  const b = claimed.rows - a;
  const c = plain[key];
  const d = plain.rows - c;
  return {
    label,
    claimed: `${a}/${claimed.rows}`,
    plain: `${c}/${plain.rows}`,
    p: fisherExactTwoSided(a, b, c, d),
  };
}

/**
 * Fail-closed summary over the matrix reporter's analysis rows.
 *
 * One source, one fold. The parent grid folded stance verdicts itself from
 * persisted slices while taking its outcome verdict from the matrix reporter,
 * which is how a gate/fold mismatch got into a published number. Here every
 * registered measure is read off the same analysis row, and the report refuses
 * to run if those rows disagree about which gate produced them.
 */
export function summarizeSarcasmPreconditionGrid(analyses) {
  const grid = SARCASM_PRECONDITION_GRID;
  const rows = analyses.filter(
    (row) => grid.profiles.includes(row.profileName) && grid.scenarios.includes(row.scenarioId),
  );
  const errors = [];
  const byScenario = new Map();
  const byCondition = new Map([
    ['plain', emptyBucket()],
    ['claimed', emptyBucket()],
  ]);
  const gateIdentities = new Set();

  for (const row of rows) {
    const condition = grid.conditions[row.scenarioId];
    if (!condition) {
      errors.push(`${row.rowId}: scenario ${row.scenarioId} has no registered condition`);
      continue;
    }
    if (!byScenario.has(row.scenarioId)) byScenario.set(row.scenarioId, emptyBucket());
    const stance = row.stanceFidelity || null;

    // Gate identity is collected per row and required to be single-valued.
    // Two gates in one report is the failure this whole line exists to stop.
    if (stance?.applies) gateIdentities.add(`${stance.gateRegister}@${stance.gateVersion}`);

    if (!stance?.applies) {
      errors.push(`${row.rowId}: missing stance-fidelity classification`);
    }
    // The manipulation check is only readable if the named-claim component is
    // present on every row. Absent, a claimed row would count as "did not name
    // a claim" and quietly fake a failed manipulation.
    if (stance?.applies && typeof stance.namedTargetClaim?.named !== 'boolean') {
      errors.push(`${row.rowId}: stance verdict carries no named-target-claim component`);
    }
    if (typeof row.positiveOutcome !== 'boolean') {
      errors.push(`${row.rowId}: missing positive-local-outcome verdict`);
    }

    for (const bucket of [byScenario.get(row.scenarioId), byCondition.get(condition)]) {
      bucket.rows += 1;
      bucket.heldTheManner += stance?.countsAsArmEvidence ? 1 : 0;
      bucket.namedAClaim += stance?.namedTargetClaim?.named === true ? 1 : 0;
      bucket.invalidViolations += stance?.countsAsInvalidViolation ? 1 : 0;
      bucket.excludedNoncompliance += stance?.countsAsExcludedNoncompliance ? 1 : 0;
      bucket.positiveOutcomes += row.positiveOutcome === true ? 1 : 0;
      if (Number.isFinite(row.tutorV22Score)) {
        bucket.tutorV22Sum += row.tutorV22Score;
        bucket.tutorV22Count += 1;
      }
      if (Number.isFinite(row.registerRubricScore)) {
        bucket.registerSum += row.registerRubricScore;
        bucket.registerCount += 1;
      }
    }
  }

  for (const scenario of grid.scenarios) {
    const observed = byScenario.get(scenario)?.rows || 0;
    if (observed !== grid.repeats) errors.push(`${scenario} expected ${grid.repeats} rows, found ${observed}`);
  }
  if (rows.some((row) => row.tutorV22Score == null)) errors.push('one or more rows are missing tutor-only v2.2 scores');
  if (rows.some((row) => String(row.tutorRubricVersion) !== grid.scoring.tutorRubricVersion)) {
    errors.push(`one or more rows are not scored with tutor rubric v${grid.scoring.tutorRubricVersion}`);
  }
  if (rows.some((row) => row.tutorJudgeModel !== grid.scoring.tutorJudgeLabel)) {
    errors.push(`one or more rows are not tutor-scored by ${grid.scoring.tutorJudgeLabel}`);
  }
  if (rows.some((row) => row.registerRubricScore == null)) {
    errors.push('one or more rows are missing register-rubric scores');
  }
  if (rows.some((row) => row.registerJudgeModel !== grid.scoring.registerJudge)) {
    errors.push(`one or more rows are not register-scored by ${grid.scoring.registerJudge}`);
  }
  const expectedIdentity = `${grid.measurement.gateRegister}@${grid.measurement.gateVersion}`;
  if (gateIdentities.size > 1) {
    errors.push(`rows mix stance gates: ${[...gateIdentities].sort().join(' vs ')}`);
  } else if (gateIdentities.size === 1 && !gateIdentities.has(expectedIdentity)) {
    errors.push(`rows scored by ${[...gateIdentities][0]}, plan registers ${expectedIdentity}`);
  }

  const plain = byCondition.get('plain');
  const claimed = byCondition.get('claimed');
  const manipulation = contrast('named a claim (manipulation check)', claimed, plain, 'namedAClaim');
  const primary = contrast('held the manner', claimed, plain, 'heldTheManner');
  const outcome = contrast('positive local outcome', claimed, plain, 'positiveOutcomes');

  // The pre-registered decision rule, applied mechanically so the reading is
  // not chosen after seeing the numbers. Note the manipulation check gates the
  // primary: if the learner did not actually supply more claims, the primary
  // contrast is uninterpretable rather than negative.
  const manipulationHeld = claimed.namedAClaim > plain.namedAClaim;
  let verdict;
  if (errors.length) verdict = 'INCOMPLETE';
  else if (!manipulationHeld) verdict = 'MANIPULATION_FAILED_PRECONDITION_UNTESTED';
  else if (claimed.heldTheManner > plain.heldTheManner) verdict = 'PRECONDITION_SUPPORTED';
  else verdict = 'PRECONDITION_REFUTED';

  return {
    schema: 'machinespirits.sarcasm-precondition-grid-report.v1',
    status: errors.length ? 'INCOMPLETE' : 'COMPLETE',
    verdict,
    errors,
    measurement: { ...grid.measurement, observedGateIdentities: [...gateIdentities].sort() },
    expectedRows: grid.profiles.length * grid.scenarios.length * grid.repeats,
    observedRows: rows.length,
    byCondition: [
      { condition: 'plain', ...withMeans(plain) },
      { condition: 'claimed', ...withMeans(claimed) },
    ],
    byScenario: grid.scenarios.map((scenario) => ({
      scenario,
      condition: grid.conditions[scenario],
      mood: grid.moods[scenario],
      ...withMeans(byScenario.get(scenario) || emptyBucket()),
    })),
    contrasts: { manipulation, primary, outcome },
  };
}

export default {
  SARCASM_PRECONDITION_GRID,
  buildSarcasmPreconditionGridPlan,
  hashSarcasmPreconditionGrid,
  validateSarcasmPreconditionGridPlan,
  summarizeSarcasmPreconditionGrid,
};
