import { createHash } from 'node:crypto';

import { compareStancePayloads } from './stancePayloadComparability.js';
import { stanceComponentContingency } from './stanceComponentContingency.js';

export const NEGATIVE_REGISTER_EFFECT_GRID = Object.freeze({
  schema: 'machinespirits.negative-register-effect-grid-plan.v1',
  preregistration: 'notes/2026-07-26-negative-register-effect-estimation-preregistration.md',
  scenarioSource: 'config/charisma-recognition-desire-scenarios.yaml',
  profiles: Object.freeze([
    'cell_196_id_director_ironic_challenge_breakthrough_dynamic_verified',
    'cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified',
    'cell_198_id_director_face_threat_challenge_breakthrough_dynamic_verified',
  ]),
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
    // The claude CLI takes the full model ID; 'sonnet-5' stopped resolving at
    // CLI 2.1.216. The label mirrors eval-cli's stored `claude-code/<model>`.
    tutorJudgeModel: 'claude-sonnet-5',
    tutorJudgeLabel: 'claude-code/claude-sonnet-5',
    registerJudge: 'claude-code.sonnet-5',
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

export function hashNegativeRegisterEffectGrid(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalJson(value)))
    .digest('hex');
}

export function buildNegativeRegisterEffectGridPlan() {
  const jobs = [];
  for (const profile of NEGATIVE_REGISTER_EFFECT_GRID.profiles) {
    for (const scenario of NEGATIVE_REGISTER_EFFECT_GRID.scenarios) {
      for (let repeat = 1; repeat <= NEGATIVE_REGISTER_EFFECT_GRID.repeats; repeat += 1) {
        jobs.push({
          ordinal: jobs.length + 1,
          profile,
          scenario,
          repeat,
        });
      }
    }
  }
  const plan = {
    ...NEGATIVE_REGISTER_EFFECT_GRID,
    profiles: [...NEGATIVE_REGISTER_EFFECT_GRID.profiles],
    scenarios: [...NEGATIVE_REGISTER_EFFECT_GRID.scenarios],
    design: '3 assigned register arms x 5 controlled resistance targets x 3 repeats',
    estimands: ['assigned_arm', 'faithful_arm'],
    plannedRows: jobs.length,
    jobs,
  };
  return { ...plan, planSha256: hashNegativeRegisterEffectGrid(plan) };
}

export function validateNegativeRegisterEffectGridPlan(plan) {
  const errors = [];
  const expectedRows =
    NEGATIVE_REGISTER_EFFECT_GRID.profiles.length *
    NEGATIVE_REGISTER_EFFECT_GRID.scenarios.length *
    NEGATIVE_REGISTER_EFFECT_GRID.repeats;
  if (plan.plannedRows !== expectedRows || plan.jobs?.length !== expectedRows) {
    errors.push(`expected ${expectedRows} planned rows, found ${plan.jobs?.length || 0}`);
  }
  const counts = new Map();
  for (const job of plan.jobs || []) {
    const key = `${job.profile}::${job.scenario}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  for (const profile of NEGATIVE_REGISTER_EFFECT_GRID.profiles) {
    for (const scenario of NEGATIVE_REGISTER_EFFECT_GRID.scenarios) {
      const key = `${profile}::${scenario}`;
      if (counts.get(key) !== NEGATIVE_REGISTER_EFFECT_GRID.repeats) {
        errors.push(`${key} expected ${NEGATIVE_REGISTER_EFFECT_GRID.repeats} rows, found ${counts.get(key) || 0}`);
      }
    }
  }
  return { ok: errors.length === 0, errors, expectedRows, observedCells: counts.size };
}

function isPositiveOutcome(row) {
  return (
    String(row.verdict || '').includes('candidate') ||
    row.verdict === 'productive_frustration_work' ||
    row.verdict === 'owned_generation_with_residual'
  );
}

function addScore(bucket, prefix, value) {
  if (value == null || Number.isNaN(Number(value))) return;
  bucket[`${prefix}Sum`] += Number(value);
  bucket[`${prefix}Count`] += 1;
}

// The one reason a faithful row can lack a manner reading without the report
// calling it a gap. Face threat has no validated presence question — on the
// hand-marked set the reader called it on eleven turns where the hand marks
// called it on five, and once on a control (§6.7) — so there is nothing to run.
// Every other reason means a registered measure was not taken.
const PRESENCE_REASON_NO_QUESTION = 'register_not_edged';

function unreadPresenceReason(stance) {
  if (!stance) return 'no_stance_verdict';
  if (stance.presenceMeasured) return null;
  // A verdict written before the presence axis existed has neither field, and
  // says so under its own name rather than borrowing one of the gate's reasons.
  return stance.mannerPresence?.reason || 'no_presence_field';
}

function emptyEffectBucket(key) {
  return {
    key,
    assignedRows: 0,
    assignedPositiveOutcomes: 0,
    assignedTutorV22Sum: 0,
    assignedTutorV22Count: 0,
    assignedRegisterSum: 0,
    assignedRegisterCount: 0,
    faithfulRows: 0,
    faithfulPositiveOutcomes: 0,
    faithfulTutorV22Sum: 0,
    faithfulTutorV22Count: 0,
    faithfulRegisterSum: 0,
    faithfulRegisterCount: 0,
    faithfulPresenceMeasured: 0,
    faithfulPresenceUnmeasured: 0,
    faithfulPresenceReasons: {},
    excludedNoncompliance: 0,
    invalidViolations: 0,
  };
}

/**
 * What a faithful count is made of, said in the report rather than inferred
 * from the field name. `manner_read` means every faithful row had a reader
 * answer the presence question, so the count means "used a handed cue AND the
 * manner is there". `cue_compliance_only` means it does not — which is the
 * whole of the §6.7 finding, since a cue-compliance count read as a manner
 * count is exactly the mistake the hand-marked set caught.
 */
function faithfulArmMeaning(bucket) {
  if (!bucket.faithfulRows) return 'no_faithful_rows';
  return bucket.faithfulPresenceUnmeasured ? 'cue_compliance_only' : 'manner_read';
}

function finalizeEffectBucket(bucket) {
  return {
    ...bucket,
    faithfulArmMeaning: faithfulArmMeaning(bucket),
    assignedPositiveRate: bucket.assignedRows ? bucket.assignedPositiveOutcomes / bucket.assignedRows : null,
    assignedTutorV22Mean: bucket.assignedTutorV22Count
      ? bucket.assignedTutorV22Sum / bucket.assignedTutorV22Count
      : null,
    assignedRegisterMean: bucket.assignedRegisterCount
      ? bucket.assignedRegisterSum / bucket.assignedRegisterCount
      : null,
    faithfulPositiveRate: bucket.faithfulRows ? bucket.faithfulPositiveOutcomes / bucket.faithfulRows : null,
    faithfulTutorV22Mean: bucket.faithfulTutorV22Count
      ? bucket.faithfulTutorV22Sum / bucket.faithfulTutorV22Count
      : null,
    faithfulRegisterMean: bucket.faithfulRegisterCount
      ? bucket.faithfulRegisterSum / bucket.faithfulRegisterCount
      : null,
  };
}

export function summarizeNegativeRegisterEffects(analyses) {
  const rows = analyses.filter(
    (row) =>
      NEGATIVE_REGISTER_EFFECT_GRID.profiles.includes(row.profileName) &&
      NEGATIVE_REGISTER_EFFECT_GRID.scenarios.includes(row.scenarioId),
  );
  const errors = [];
  const counts = new Map();
  const byArm = new Map();
  const byTargetArm = new Map();

  for (const row of rows) {
    const cellKey = `${row.profileName}::${row.scenarioId}`;
    counts.set(cellKey, (counts.get(cellKey) || 0) + 1);
    for (const [map, key] of [
      [byArm, row.arm],
      [byTargetArm, `${row.targetSignal}::${row.arm}`],
    ]) {
      if (!map.has(key)) map.set(key, emptyEffectBucket(key));
      const bucket = map.get(key);
      const positive = isPositiveOutcome(row);
      bucket.assignedRows += 1;
      bucket.assignedPositiveOutcomes += positive ? 1 : 0;
      addScore(bucket, 'assignedTutorV22', row.tutorV22Score);
      addScore(bucket, 'assignedRegister', row.registerRubricScore);
      if (row.stanceFidelity?.countsAsArmEvidence) {
        bucket.faithfulRows += 1;
        bucket.faithfulPositiveOutcomes += positive ? 1 : 0;
        addScore(bucket, 'faithfulTutorV22', row.tutorV22Score);
        addScore(bucket, 'faithfulRegister', row.registerRubricScore);
        const unreadReason = unreadPresenceReason(row.stanceFidelity);
        if (unreadReason) {
          bucket.faithfulPresenceUnmeasured += 1;
          bucket.faithfulPresenceReasons[unreadReason] = (bucket.faithfulPresenceReasons[unreadReason] || 0) + 1;
        } else {
          bucket.faithfulPresenceMeasured += 1;
        }
      }
      bucket.excludedNoncompliance += row.stanceFidelity?.countsAsExcludedNoncompliance ? 1 : 0;
      bucket.invalidViolations += row.stanceFidelity?.countsAsInvalidViolation ? 1 : 0;
    }
  }

  for (const profile of NEGATIVE_REGISTER_EFFECT_GRID.profiles) {
    for (const scenario of NEGATIVE_REGISTER_EFFECT_GRID.scenarios) {
      const key = `${profile}::${scenario}`;
      if (counts.get(key) !== NEGATIVE_REGISTER_EFFECT_GRID.repeats) {
        errors.push(`${key} expected ${NEGATIVE_REGISTER_EFFECT_GRID.repeats} rows, found ${counts.get(key) || 0}`);
      }
    }
  }
  if (rows.some((row) => row.tutorV22Score == null)) errors.push('one or more rows are missing tutor-only v2.2 scores');
  if (rows.some((row) => String(row.tutorRubricVersion) !== NEGATIVE_REGISTER_EFFECT_GRID.scoring.tutorRubricVersion)) {
    errors.push(
      `one or more rows are not scored with tutor rubric v${NEGATIVE_REGISTER_EFFECT_GRID.scoring.tutorRubricVersion}`,
    );
  }
  if (rows.some((row) => row.tutorJudgeModel !== NEGATIVE_REGISTER_EFFECT_GRID.scoring.tutorJudgeLabel)) {
    errors.push(`one or more rows are not tutor-scored by ${NEGATIVE_REGISTER_EFFECT_GRID.scoring.tutorJudgeLabel}`);
  }
  if (rows.some((row) => row.registerRubricScore == null))
    errors.push('one or more rows are missing register-rubric scores');
  if (rows.some((row) => row.registerJudgeModel !== NEGATIVE_REGISTER_EFFECT_GRID.scoring.registerJudge)) {
    errors.push(`one or more rows are not register-scored by ${NEGATIVE_REGISTER_EFFECT_GRID.scoring.registerJudge}`);
  }
  if (rows.some((row) => !row.stanceFidelity?.applies))
    errors.push('one or more rows are missing stance-fidelity classification');

  // A presence reading is a registered measure for the edged arms, so a faithful
  // row without one fails the report the same way a missing rubric score does:
  // the faithful bucket would otherwise report cue compliance under a name that
  // reads as manner.
  //
  // `register_not_edged` is the one reason exempted, because it is not a measure
  // anyone failed to take — face threat has no validated presence question at
  // all. Erroring on it would leave the status red permanently and stop it
  // telling anyone anything, so that arm carries its limit in
  // `faithfulArmMeaning` instead, where a consumer has to read it to use the
  // number.
  for (const bucket of byArm.values()) {
    const gaps = Object.entries(bucket.faithfulPresenceReasons).filter(
      ([reason]) => reason !== PRESENCE_REASON_NO_QUESTION,
    );
    const unread = gaps.reduce((total, [, count]) => total + count, 0);
    if (!unread) continue;
    const detail = gaps.map(([reason, count]) => `${count} ${reason}`).join(', ');
    errors.push(
      `${bucket.key}: ${unread} of ${bucket.faithfulRows} faithful rows have no manner-presence reading (${detail}); read them before licensing this arm`,
    );
  }

  // Each faithful count next to what it is made of, per gate — the three arms
  // carry three different gates, so the split is grouped rather than pooled.
  // A passing row that lacked a part its gate calls necessary fails the report.
  const contingency = stanceComponentContingency(rows.map((row) => row.stanceFidelity));
  for (const contradiction of contingency.contradictions) errors.push(contradiction);

  // The three arms were not asked for the same thing: irony wants the learner
  // to do the unmasking, sarcasm a concrete next move, face threat a minimal
  // repair path. Print what each was told to do beside its count, so a
  // difference between counts is not read as one demand met to different
  // degrees. An arm the register registry cannot resolve fails the report,
  // because a mistyped arm would otherwise go unchecked and unnoticed.
  const payload = compareStancePayloads([...byArm.keys()]);
  for (const error of payload.errors) errors.push(error);

  return {
    schema: 'machinespirits.negative-register-effect-grid-report.v1',
    status: errors.length ? 'INCOMPLETE' : 'COMPLETE',
    errors,
    expectedRows: 45,
    observedRows: rows.length,
    componentContingency: contingency,
    payloadComparability: payload,
    byArm: [...byArm.values()].map(finalizeEffectBucket),
    byTargetArm: [...byTargetArm.values()].map(finalizeEffectBucket),
  };
}
