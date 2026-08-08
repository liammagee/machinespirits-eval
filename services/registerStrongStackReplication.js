import { createHash } from 'node:crypto';
import { STANCE_GATE_VERSION } from './registerStanceFidelity.js';
import { stanceComponentContingency } from './stanceComponentContingency.js';
import { fisherExactTwoSided } from './fisherExact.js';

// Frozen 15-row plan for the strong-stack replication of the parent grid's
// sarcastic arm (notes/2026-08-09-register-strong-stack-replication-preregistration.md).
//
// Every August negative-register run stores codex.gpt-5.5 and none of them
// called it on the tutor side: the id-director built its id and ego requests
// from the cell YAML while the CLI's overrides only reached the resolved run
// config, which is what the runner writes to the model columns. The record kept
// the ask, the dialogue logs kept the call. Both defects are fixed, so this
// plan holds the arm, the scenarios, the gate, the fold and the judges fixed
// and changes one thing: the tutor stack, for real this time.
export const REGISTER_STRONG_STACK_REPLICATION = Object.freeze({
  schema: 'machinespirits.register-strong-stack-replication-plan.v1',
  preregistration: 'notes/2026-08-09-register-strong-stack-replication-preregistration.md',
  scenarioSource: 'config/charisma-recognition-desire-scenarios.yaml',
  profiles: Object.freeze(['cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified']),
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
  }),
  measurement: Object.freeze({
    gateRegister: 'sarcastic',
    gateVersion: STANCE_GATE_VERSION,
    fold: 'adopting_turn',
    foldSource: 'scripts/report-charisma-desire-breakthrough-matrix.js',
    presenceQuestion: 'manner-presence/1.0',
    presenceReader: 'claude-code/claude-sonnet-5',
  }),
  // The seats whose model this plan is testing. A trace entry under any of
  // these names must carry the plan's tutor stack; anything else means the
  // override did not reach the engine again, and the run is not the run the
  // plan describes.
  tutorSeats: Object.freeze(['id', 'ego', 'agency_return_verifier']),
  // Fixed before the first call so the comparison cannot be chosen afterwards.
  // Parent sarcastic arm of eval-2026-08-05-87fe3664, same gate version, same
  // fold, same reader question, as reported at paper v3.0.279.
  comparison: Object.freeze({
    parentRunId: 'eval-2026-08-05-87fe3664',
    parentProfile: 'cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified',
    parentRows: 15,
    parentCueCompliant: 8,
    parentReadAsEdged: 6,
    parentStack: 'openrouter/nvidia/nemotron-3-nano-30b-a3b ego, openrouter/moonshotai/kimi-k2.5 id',
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

export function hashRegisterStrongStackReplication(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalJson(value)))
    .digest('hex');
}

/** `codex.gpt-5.5` in CLI dot notation is provider `codex`, model `gpt-5.5`. */
export function splitModelSpec(spec) {
  const raw = String(spec || '');
  const dot = raw.indexOf('.');
  if (dot <= 0 || dot === raw.length - 1) return { provider: null, model: null };
  return { provider: raw.slice(0, dot), model: raw.slice(dot + 1) };
}

export function buildRegisterStrongStackReplicationPlan() {
  const jobs = [];
  for (const profile of REGISTER_STRONG_STACK_REPLICATION.profiles) {
    for (const scenario of REGISTER_STRONG_STACK_REPLICATION.scenarios) {
      for (let repeat = 1; repeat <= REGISTER_STRONG_STACK_REPLICATION.repeats; repeat += 1) {
        jobs.push({ ordinal: jobs.length + 1, profile, scenario, repeat });
      }
    }
  }
  const plan = {
    ...REGISTER_STRONG_STACK_REPLICATION,
    profiles: [...REGISTER_STRONG_STACK_REPLICATION.profiles],
    scenarios: [...REGISTER_STRONG_STACK_REPLICATION.scenarios],
    tutorSeats: [...REGISTER_STRONG_STACK_REPLICATION.tutorSeats],
    generation: { ...REGISTER_STRONG_STACK_REPLICATION.generation },
    scoring: { ...REGISTER_STRONG_STACK_REPLICATION.scoring },
    measurement: { ...REGISTER_STRONG_STACK_REPLICATION.measurement },
    comparison: { ...REGISTER_STRONG_STACK_REPLICATION.comparison },
    design: '1 sarcastic arm x 5 controlled resistance targets x 3 repeats, strong tutor stack',
    estimands: ['tutor_stack_provenance', 'cue_compliance', 'manner_presence', 'positive_local_outcome'],
    plannedRows: jobs.length,
    jobs,
  };
  return { ...plan, planSha256: hashRegisterStrongStackReplication(plan) };
}

export function validateRegisterStrongStackReplicationPlan(plan) {
  const errors = [];
  const grid = REGISTER_STRONG_STACK_REPLICATION;
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
  // The whole point of the run is the stack, so a plan that cannot say which
  // provider and model it means is not launchable.
  const { provider, model } = splitModelSpec(grid.generation.tutorModel);
  if (!provider || !model) errors.push(`tutor model ${grid.generation.tutorModel} is not provider.model`);
  if (/nemotron|kimi/iu.test(grid.generation.tutorModel)) {
    errors.push(`tutor model ${grid.generation.tutorModel} is the weak pairing this run exists to replace`);
  }
  // A comparison chosen after the fact is not a comparison. Both baseline
  // counts have to be present and inside the parent arm's size.
  const { parentRows, parentCueCompliant, parentReadAsEdged } = grid.comparison;
  for (const [label, value] of [
    ['parentCueCompliant', parentCueCompliant],
    ['parentReadAsEdged', parentReadAsEdged],
  ]) {
    if (!Number.isInteger(value) || value < 0 || value > parentRows) {
      errors.push(`comparison ${label} must be an integer within 0..${parentRows}, found ${value}`);
    }
  }
  if (parentReadAsEdged > parentCueCompliant) {
    errors.push('comparison parentReadAsEdged cannot exceed parentCueCompliant: the reading only subtracts');
  }
  return { ok: errors.length === 0, errors, expectedRows, observedCells: counts.size };
}

/**
 * Did the tutor seats call the model the plan names?
 *
 * Read off `dialogueTrace`, which records the call, not off the run's model
 * columns, which record the ask. Those two disagreed silently across four
 * August runs and that is why this run exists, so the check is a registered
 * measure rather than a courtesy.
 *
 * @param {Array<{dialogueId?: string, trace: Array<object>}>} dialogues
 */
export function checkTutorStackProvenance(dialogues, { grid = REGISTER_STRONG_STACK_REPLICATION } = {}) {
  const expected = splitModelSpec(grid.generation.tutorModel);
  const seats = new Set(grid.tutorSeats);
  const errors = [];
  const observed = new Map();
  let seatCalls = 0;

  for (const dialogue of dialogues || []) {
    const label = dialogue.dialogueId || '(unnamed dialogue)';
    for (const entry of dialogue.trace || []) {
      if (!seats.has(entry?.agent)) continue;
      const provider = entry.metrics?.provider ?? entry.provider ?? null;
      const model = entry.metrics?.model ?? entry.model ?? null;
      // A tutor seat with no recorded model is not evidence that it ran the
      // right one, so it fails rather than passing by absence.
      if (!provider || !model) {
        errors.push(`${label}: ${entry.agent}/${entry.action} records no provider or model`);
        continue;
      }
      seatCalls += 1;
      const pair = `${provider}/${model}`;
      observed.set(pair, (observed.get(pair) || 0) + 1);
      if (provider !== expected.provider || model !== expected.model) {
        errors.push(`${label}: ${entry.agent}/${entry.action} called ${pair}, plan says ${grid.generation.tutorModel}`);
      }
    }
  }

  if (!seatCalls && !errors.length) errors.push('no tutor seat calls found in any dialogue trace');
  return {
    ok: errors.length === 0,
    expected: grid.generation.tutorModel,
    seatCalls,
    observed: Object.fromEntries([...observed.entries()].sort()),
    errors,
  };
}

function emptyBucket() {
  return {
    rows: 0,
    cueCompliant: 0,
    readAsEdged: 0,
    presenceUnread: 0,
    excludedNoncompliance: 0,
    positiveOutcomes: 0,
    faithfulPositiveOutcomes: 0,
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

function against(label, here, hereN, there, thereN) {
  return {
    label,
    thisRun: `${here}/${hereN}`,
    parent: `${there}/${thereN}`,
    p: fisherExactTwoSided(here, hereN - here, there, thereN - there),
  };
}

/**
 * Fail-closed summary over the matrix reporter's analysis rows.
 *
 * One source, one fold, and every registered measure read off the same row.
 * The report refuses to run if the rows disagree about which gate produced
 * them, if any row's manner reading is missing, or if the tutor seats did not
 * call the stack the plan names.
 */
export function summarizeRegisterStrongStackReplication(analyses, { provenance = null } = {}) {
  const grid = REGISTER_STRONG_STACK_REPLICATION;
  const rows = analyses.filter(
    (row) => grid.profiles.includes(row.profileName) && grid.scenarios.includes(row.scenarioId),
  );
  const errors = [];
  const byScenario = new Map();
  const overall = emptyBucket();
  const gateIdentities = new Set();

  for (const row of rows) {
    if (!byScenario.has(row.scenarioId)) byScenario.set(row.scenarioId, emptyBucket());
    const scenario = byScenario.get(row.scenarioId);
    const stance = row.stanceFidelity || null;

    if (!stance?.applies) {
      errors.push(`${row.rowId}: missing stance-fidelity classification`);
      continue;
    }
    gateIdentities.add(`${stance.gateRegister}@${stance.gateVersion}`);

    for (const bucket of [scenario, overall]) bucket.rows += 1;

    const presence = stance.mannerPresence?.status;
    const read = presence === 'present' || presence === 'absent';
    // An unread row is not a flat row. Summing it into either count is the
    // half-measured-run-reads-as-a-clean-null failure, so it fails closed.
    if (!read) {
      errors.push(`${row.rowId}: manner presence unread (${presence || 'missing'})`);
      for (const bucket of [scenario, overall]) bucket.presenceUnread += 1;
    }
    if (typeof row.positiveOutcome !== 'boolean') {
      errors.push(`${row.rowId}: no positive-local-outcome verdict`);
    }

    if (stance.passed) {
      for (const bucket of [scenario, overall]) {
        bucket.cueCompliant += 1;
        if (presence === 'present') bucket.readAsEdged += 1;
        if (presence === 'present' && row.positiveOutcome === true) bucket.faithfulPositiveOutcomes += 1;
      }
      // The gate's own rule, checked against its own rows.
      if (stance.missingRequired?.length) {
        errors.push(`${row.rowId}: faithful verdict lists missing required parts ${stance.missingRequired.join(', ')}`);
      }
    } else {
      for (const bucket of [scenario, overall]) bucket.excludedNoncompliance += 1;
    }
    if (row.positiveOutcome === true) for (const bucket of [scenario, overall]) bucket.positiveOutcomes += 1;

    if (Number.isFinite(row.tutorV22Score)) {
      for (const bucket of [scenario, overall]) {
        bucket.tutorV22Sum += row.tutorV22Score;
        bucket.tutorV22Count += 1;
      }
    }
    if (Number.isFinite(row.registerRubricScore)) {
      for (const bucket of [scenario, overall]) {
        bucket.registerSum += row.registerRubricScore;
        bucket.registerCount += 1;
      }
    }
  }

  const expectedRows = grid.profiles.length * grid.scenarios.length * grid.repeats;
  if (rows.length !== expectedRows) errors.push(`expected ${expectedRows} rows, found ${rows.length}`);
  // The judges are part of the comparison: a count scored by a different judge
  // is not the parent arm's measure however many rows it has.
  if (rows.some((row) => row.tutorV22Score == null)) errors.push('one or more rows are missing tutor-only v2.2 scores');
  if (rows.some((row) => String(row.tutorRubricVersion) !== grid.scoring.tutorRubricVersion)) {
    errors.push(`rows carry a tutor rubric version other than ${grid.scoring.tutorRubricVersion}`);
  }
  if (rows.some((row) => row.tutorJudgeModel !== grid.scoring.tutorJudgeLabel)) {
    errors.push(`rows carry a tutor judge other than ${grid.scoring.tutorJudgeLabel}`);
  }
  if (rows.some((row) => row.registerRubricScore == null)) errors.push('one or more rows are missing register scores');
  if (rows.some((row) => row.registerJudgeModel !== grid.scoring.registerJudge)) {
    errors.push(`rows carry a register judge other than ${grid.scoring.registerJudge}`);
  }
  if (gateIdentities.size > 1) errors.push(`rows carry more than one gate: ${[...gateIdentities].sort().join(', ')}`);
  const expectedGate = `${grid.measurement.gateRegister}@${grid.measurement.gateVersion}`;
  if (gateIdentities.size === 1 && !gateIdentities.has(expectedGate)) {
    errors.push(`rows scored under ${[...gateIdentities][0]}, plan registers ${expectedGate}`);
  }
  if (!provenance) errors.push('no tutor-stack provenance check supplied');
  else if (!provenance.ok) for (const error of provenance.errors) errors.push(`provenance: ${error}`);

  const status = errors.length ? 'INCOMPLETE' : 'COMPLETE';
  const contrasts =
    status === 'COMPLETE'
      ? {
          cueCompliance: against(
            'cue compliance',
            overall.cueCompliant,
            overall.rows,
            grid.comparison.parentCueCompliant,
            grid.comparison.parentRows,
          ),
          mannerPresence: against(
            'read as edged',
            overall.readAsEdged,
            overall.rows,
            grid.comparison.parentReadAsEdged,
            grid.comparison.parentRows,
          ),
        }
      : null;

  return {
    schema: 'machinespirits.register-strong-stack-replication-report.v1',
    status,
    expectedRows,
    observedRows: rows.length,
    measurement: { ...grid.measurement },
    comparison: { ...grid.comparison },
    provenance,
    overall: withMeans(overall),
    byScenario: Object.fromEntries([...byScenario.entries()].map(([key, value]) => [key, withMeans(value)])),
    componentContingency: stanceComponentContingency(rows.map((row) => row.stanceFidelity).filter(Boolean)),
    contrasts,
    // Reported alongside the p-values so the reading cannot be quietly upgraded.
    // Fifteen against fifteen screens for collapse; it does not estimate.
    verdict: status === 'COMPLETE' ? verdictFor(overall, grid, contrasts) : null,
    errors,
  };
}

function verdictFor(overall, grid, contrasts) {
  const p = contrasts?.mannerPresence?.p;
  if (p != null && p < 0.05) {
    return overall.readAsEdged > grid.comparison.parentReadAsEdged
      ? 'MANNER_HELD_MORE_ON_STRONG_STACK'
      : 'MANNER_COLLAPSED_ON_STRONG_STACK';
  }
  return 'NO_SEPARATION_AT_THIS_SIZE';
}

export default {
  REGISTER_STRONG_STACK_REPLICATION,
  buildRegisterStrongStackReplicationPlan,
  checkTutorStackProvenance,
  hashRegisterStrongStackReplication,
  splitModelSpec,
  summarizeRegisterStrongStackReplication,
  validateRegisterStrongStackReplicationPlan,
};
