import { getRouterSelectableEngagementRegisterNames } from './engagementRegisterRegistry.js';
import { fisherExactTwoSided } from './fisherExact.js';
import {
  ADAPTIVE_REGISTER_SWITCHING as GRID,
  checkAdaptiveTutorStackProvenance,
} from './adaptiveRegisterSwitching.js';

const ARM_ORDER = Object.freeze(['adaptive', 'routerWarm', 'pinnedSarcastic']);
const PROFILE_TO_ARM = new Map(ARM_ORDER.map((arm) => [GRID.arms[arm].profile, arm]));

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function sampleSd(values) {
  if (values.length < 2) return null;
  const center = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1));
}

function sameMenu(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  return [...actual].sort().join('\n') === [...expected].sort().join('\n');
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

function continuousSummary(rows, accessor) {
  const values = rows.map(accessor).filter(Number.isFinite);
  return { n: values.length, mean: mean(values), sampleSd: sampleSd(values) };
}

function binarySummary(rows) {
  const positive = rows.filter((row) => row.positiveOutcome === true).length;
  return { n: rows.length, positive, negative: rows.length - positive, rate: rows.length ? positive / rows.length : null };
}

function contrast(left, right) {
  return left == null || right == null ? null : left - right;
}

export function armForAdaptiveRegisterProfile(profileName) {
  return PROFILE_TO_ARM.get(profileName) || null;
}

export function validateAdaptiveRegisterSwitchingStage1Gate(artifact, expectedPlanSha) {
  const errors = [];
  const report = artifact?.report;
  if (report?.schema !== 'machinespirits.adaptive-register-switching-stage1-report.v1') {
    errors.push('Stage-1 artifact has the wrong or missing report schema');
  }
  if (report?.status !== 'COMPLETE') errors.push(`Stage-1 report status is ${report?.status || 'missing'}, not COMPLETE`);
  if (report?.decision !== 'PASS_STAGE1') {
    errors.push(`Stage-1 decision is ${report?.decision || 'missing'}, not PASS_STAGE1`);
  }
  if (report?.observedRows !== GRID.stage1.plannedRows || report?.expectedRows !== GRID.stage1.plannedRows) {
    errors.push(`Stage-1 report does not certify exactly ${GRID.stage1.plannedRows} rows`);
  }
  if (Array.isArray(report?.errors) && report.errors.length) errors.push('Stage-1 report contains errors');
  const measures = Array.isArray(report?.registeredMeasures) ? report.registeredMeasures : [];
  for (const number of [1, 2, 3, 4]) {
    const measure = measures.find((entry) => entry.number === number);
    if (measure?.status !== 'measured') errors.push(`Stage-1 measure ${number} is not measured`);
  }
  if (!/^[0-9a-f]{64}$/u.test(expectedPlanSha || '')) errors.push('approved plan SHA is missing or malformed');
  return {
    ok: errors.length === 0,
    runId: artifact?.runId || null,
    reportDecision: report?.decision || null,
    approvedPlanSha256: expectedPlanSha || null,
    errors,
  };
}

/**
 * Fail-closed Stage-2 report. The primary verdict is keyed only to the
 * adaptive-versus-router-warm Fisher contrast. Cue counts remain separated by
 * register; no cross-register cue contrast is computed or returned.
 */
export function summarizeAdaptiveRegisterSwitchingStage2(dialogues, { stage1Gate = null } = {}) {
  const errors = [];
  const rows = Array.isArray(dialogues) ? dialogues : [];
  const expectedAdaptiveMenu = getRouterSelectableEngagementRegisterNames(GRID.arms.adaptive.routerRegisterMenu);
  const expectedWarmMenu = getRouterSelectableEngagementRegisterNames();
  const byArmRows = Object.fromEntries(ARM_ORDER.map((arm) => [arm, []]));
  const scenarioArmCounts = new Map();
  const fidelity = Object.fromEntries(GRID.edgedRegisters.map((name) => [name, emptyFidelityBucket(name)]));

  if (!stage1Gate?.ok) {
    errors.push('Stage-1 launch gate is missing or invalid');
    for (const error of stage1Gate?.errors || []) errors.push(`Stage-1 gate: ${error}`);
  }
  if (rows.length !== GRID.stage2.plannedRows) {
    errors.push(`expected ${GRID.stage2.plannedRows} Stage-2 rows, found ${rows.length}`);
  }

  for (const row of rows) {
    const label = row.rowId || row.dialogueId || '(unnamed row)';
    const arm = armForAdaptiveRegisterProfile(row.profileName);
    if (!arm) {
      errors.push(`${label}: unexpected profile ${row.profileName || 'missing'}`);
      continue;
    }
    row.arm = arm;
    byArmRows[arm].push(row);
    if (!GRID.scenarios.includes(row.scenarioId)) errors.push(`${label}: unexpected scenario ${row.scenarioId || 'missing'}`);
    else {
      const key = `${arm}::${row.scenarioId}`;
      scenarioArmCounts.set(key, (scenarioArmCounts.get(key) || 0) + 1);
    }
    if (row.dialogueLogMissing) errors.push(`${label}: dialogue log missing`);
    const turns = Array.isArray(row.turns) ? row.turns : [];
    if (!turns.length) errors.push(`${label}: no router turns found`);
    let pinnedAssignmentTurns = 0;
    for (const turn of turns) {
      const turnLabel = `${label}:turn_${turn.turn}`;
      const expectedMenu = arm === 'adaptive' ? expectedAdaptiveMenu : expectedWarmMenu;
      if (!sameMenu(turn.routerMenu, expectedMenu)) errors.push(`${turnLabel}: recorded router menu does not match ${arm}`);
      if (!turn.selectedRegister) errors.push(`${turnLabel}: no selected register recorded`);
      if (arm === 'adaptive' && turn.routerSelectedRegister !== turn.selectedRegister) {
        errors.push(`${turnLabel}: adaptive selected register and router choice disagree`);
      }
      if (arm === 'routerWarm' && GRID.edgedRegisters.includes(turn.selectedRegister)) {
        errors.push(`${turnLabel}: router-warm selected edged register ${turn.selectedRegister}`);
      }
      if (arm === 'pinnedSarcastic') {
        if (turn.assignedRegisterArm) {
          pinnedAssignmentTurns += 1;
          if (turn.assignedRegisterArm !== GRID.arms.pinnedSarcastic.registerPin) {
            errors.push(`${turnLabel}: pinned-sarcastic assignment is ${turn.assignedRegisterArm}`);
          }
          if (turn.selectedRegister !== GRID.arms.pinnedSarcastic.registerPin) {
            errors.push(`${turnLabel}: pinned-sarcastic assignment selected ${turn.selectedRegister || 'nothing'}`);
          }
          if (turn.routerSelectedRegister !== 'charismatic') {
            errors.push(`${turnLabel}: pinned-sarcastic assignment did not replace the charismatic router choice`);
          }
          if (turn.registerAssignmentSource !== 'experiment_arm') {
            errors.push(`${turnLabel}: pinned-sarcastic assignment source is not experiment_arm`);
          }
          if (turn.phase !== 'resistance') {
            errors.push(`${turnLabel}: pinned-sarcastic assignment occurred outside the resistance phase`);
          }
        } else if (GRID.edgedRegisters.includes(turn.selectedRegister)) {
          errors.push(`${turnLabel}: unassigned pinned-control turn selected edged register ${turn.selectedRegister}`);
        } else if (!turn.routerMenu?.includes(turn.selectedRegister)) {
          errors.push(`${turnLabel}: unassigned pinned-control selection is outside the recorded menu`);
        }
      } else if (!turn.routerMenu?.includes(turn.selectedRegister)) {
        errors.push(`${turnLabel}: selected register is outside the recorded menu`);
      }

      if (!GRID.edgedRegisters.includes(turn.selectedRegister)) continue;
      const bucket = fidelity[turn.selectedRegister];
      bucket.turns += 1;
      const stance = turn.stanceFidelity;
      if (!stance?.applies) errors.push(`${turnLabel}: missing ${turn.selectedRegister} stance-fidelity verdict`);
      else {
        bucket.gateIdentities.add(`${stance.gateRegister}@${stance.gateVersion}`);
        if (stance.gateRegister !== turn.selectedRegister || stance.gateVersion !== GRID.measurement.gateVersion) {
          errors.push(`${turnLabel}: ${turn.selectedRegister} was not scored under its own registered gate`);
        }
        if (stance.passed) bucket.cueCompliant += 1;
        const presence = stance.mannerPresence;
        if (presence?.promptVersion !== GRID.measurement.presenceQuestion) {
          errors.push(`${turnLabel}: manner reading is not ${GRID.measurement.presenceQuestion}`);
        }
        if (presence?.reader !== GRID.measurement.presenceReader) {
          errors.push(`${turnLabel}: manner reader is not ${GRID.measurement.presenceReader}`);
        }
        if (presence?.status === 'present') bucket.mannerPresent += 1;
        else if (presence?.status === 'absent') bucket.mannerAbsent += 1;
        else {
          bucket.mannerUnread += 1;
          errors.push(`${turnLabel}: manner presence unread (${presence?.reason || 'missing'})`);
        }
      }
      if (!Number.isFinite(turn.registerRubricScore)) errors.push(`${turnLabel}: missing register-rubric score`);
      else {
        bucket.registerScoreSum += turn.registerRubricScore;
        bucket.registerScoreCount += 1;
      }
      if (turn.registerJudgeModel !== GRID.scoring.registerJudge) {
        errors.push(`${turnLabel}: register judge is ${turn.registerJudgeModel || 'missing'}, not ${GRID.scoring.registerJudge}`);
      }
    }
    if (arm === 'pinnedSarcastic' && pinnedAssignmentTurns === 0) {
      errors.push(`${label}: pinned-sarcastic dialogue has no resistance-gated experiment-arm assignment`);
    }

    if (typeof row.positiveOutcome !== 'boolean' || !row.outcomeVerdict) {
      errors.push(`${label}: registered conversion outcome missing`);
    }
    const learner = row.learnerRubric || {};
    if (![learner.first, learner.last, learner.delta].every(Number.isFinite) || learner.turnCount < 2) {
      errors.push(`${label}: learner first-to-last rubric change missing`);
    }
    if (!learner.version) errors.push(`${label}: learner rubric version missing`);
    if (learner.judge !== GRID.scoring.learnerJudgeLabel) {
      errors.push(`${label}: learner judge is ${learner.judge || 'missing'}, not ${GRID.scoring.learnerJudgeLabel}`);
    }
    const tutor = row.tutorV22 || {};
    if (![tutor.overall, tutor.first, tutor.last].every(Number.isFinite)) {
      errors.push(`${label}: tutor v2.2 scores missing`);
    }
    if (tutor.version !== GRID.scoring.tutorRubricVersion) {
      errors.push(`${label}: tutor rubric is ${tutor.version || 'missing'}, not ${GRID.scoring.tutorRubricVersion}`);
    }
    if (tutor.judge !== GRID.scoring.tutorJudgeLabel) {
      errors.push(`${label}: tutor judge is ${tutor.judge || 'missing'}, not ${GRID.scoring.tutorJudgeLabel}`);
    }
  }

  for (const arm of ARM_ORDER) {
    if (byArmRows[arm].length !== GRID.stage2.plannedRowsPerArm) {
      errors.push(`${arm}: expected ${GRID.stage2.plannedRowsPerArm} rows, found ${byArmRows[arm].length}`);
    }
    for (const scenario of GRID.scenarios) {
      const count = scenarioArmCounts.get(`${arm}::${scenario}`) || 0;
      if (count !== GRID.stage2.repeatsPerScenario) {
        errors.push(`${arm}::${scenario}: expected ${GRID.stage2.repeatsPerScenario} rows, found ${count}`);
      }
    }
  }

  const provenance = checkAdaptiveTutorStackProvenance(rows);
  if (!provenance.ok) for (const error of provenance.errors) errors.push(`provenance: ${error}`);

  const conversionByArm = Object.fromEntries(ARM_ORDER.map((arm) => [arm, binarySummary(byArmRows[arm])]));
  const primaryP = fisherExactTwoSided(
    conversionByArm.adaptive.positive,
    conversionByArm.adaptive.negative,
    conversionByArm.routerWarm.positive,
    conversionByArm.routerWarm.negative,
  );
  const timingP = fisherExactTwoSided(
    conversionByArm.adaptive.positive,
    conversionByArm.adaptive.negative,
    conversionByArm.pinnedSarcastic.positive,
    conversionByArm.pinnedSarcastic.negative,
  );
  const learnerChangeByArm = Object.fromEntries(
    ARM_ORDER.map((arm) => [arm, continuousSummary(byArmRows[arm], (row) => row.learnerRubric?.delta)]),
  );
  const tutorV22ByArm = Object.fromEntries(
    ARM_ORDER.map((arm) => [arm, continuousSummary(byArmRows[arm], (row) => row.tutorV22?.overall)]),
  );
  const status = errors.length ? 'INCOMPLETE' : 'COMPLETE';
  const primaryPass =
    status === 'COMPLETE' &&
    primaryP < GRID.stage2.alpha &&
    conversionByArm.adaptive.rate > conversionByArm.routerWarm.rate;

  return {
    schema: 'machinespirits.adaptive-register-switching-stage2-report.v1',
    status,
    decision: status === 'COMPLETE' ? (primaryPass ? 'PASS_PRIMARY' : 'NO_PRIMARY_EVIDENCE') : null,
    stage1Gate,
    stage2Authorized: true,
    stage3Authorized: false,
    expectedRows: GRID.stage2.plannedRows,
    observedRows: rows.length,
    provenance,
    conversion: {
      byArm: conversionByArm,
      primary: {
        contrast: 'adaptive_vs_router_warm',
        rateDifference: contrast(conversionByArm.adaptive.rate, conversionByArm.routerWarm.rate),
        fisherExactTwoSidedP: primaryP,
        alpha: GRID.stage2.alpha,
        controlsDecision: true,
      },
      timingVsEdge: {
        contrast: 'adaptive_vs_pinned_sarcastic',
        rateDifference: contrast(conversionByArm.adaptive.rate, conversionByArm.pinnedSarcastic.rate),
        fisherExactTwoSidedP: timingP,
        controlsDecision: false,
      },
    },
    learnerRubricChange: {
      byArm: learnerChangeByArm,
      adaptiveMinusRouterWarm: contrast(learnerChangeByArm.adaptive.mean, learnerChangeByArm.routerWarm.mean),
      adaptiveMinusPinnedSarcastic: contrast(
        learnerChangeByArm.adaptive.mean,
        learnerChangeByArm.pinnedSarcastic.mean,
      ),
      inferentialTest: 'not_preregistered_descriptive_only',
    },
    tutorV22Cost: {
      byArm: tutorV22ByArm,
      adaptiveMinusRouterWarm: contrast(tutorV22ByArm.adaptive.mean, tutorV22ByArm.routerWarm.mean),
      adaptiveMinusPinnedSarcastic: contrast(tutorV22ByArm.adaptive.mean, tutorV22ByArm.pinnedSarcastic.mean),
    },
    fidelityByRegister: Object.fromEntries(
      Object.entries(fidelity).map(([name, bucket]) => [name, finishFidelityBucket(bucket)]),
    ),
    registeredMeasures: GRID.measures.map((measure) => ({
      ...measure,
      status: status === 'COMPLETE' ? (measure.stage === 'stage1' ? 'measured_stage1' : 'measured') : 'incomplete',
    })),
    errors,
  };
}

export default {
  armForAdaptiveRegisterProfile,
  summarizeAdaptiveRegisterSwitchingStage2,
  validateAdaptiveRegisterSwitchingStage1Gate,
};
