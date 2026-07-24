export const TUTOR_STUB_FIELD_TURN_PROJECTION_MODES = Object.freeze({
  INTERACTIVE_V1: 'interactive_v1',
  AUTO_EVAL_REPORT_V1: 'auto_eval_report_v1',
});

const FIELD_TURN_PROJECTION_MODE_SET = new Set(Object.values(TUTOR_STUB_FIELD_TURN_PROJECTION_MODES));

function scoreValue(score) {
  if (score && typeof score === 'object' && score.score !== undefined) return score.score;
  if (score !== undefined && score !== null) return score;
  return '?';
}

function clampField01(value) {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.max(0, Math.min(1, Number(value)));
}

function roundField(value) {
  return Number((Number(value) || 0).toFixed(3));
}

function fieldScore(score) {
  const raw = scoreValue(score);
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? clampField01(numeric / 5) : 0;
}

function fieldDelta(current, previous) {
  return roundField((current || 0) - (previous || 0));
}

function wordsInText(text) {
  return String(text || '')
    .split(/\s+/)
    .filter(Boolean).length;
}

function resolveProjectionMode(options) {
  const mode = options?.mode || TUTOR_STUB_FIELD_TURN_PROJECTION_MODES.INTERACTIVE_V1;
  if (!FIELD_TURN_PROJECTION_MODE_SET.has(mode)) {
    throw new Error(`Unknown tutor-stub field-turn projection mode: ${mode}`);
  }
  return mode;
}

export function projectTutorStubLightweightFieldTurn(turn, previous = null, options = {}) {
  const mode = resolveProjectionMode(options);
  const autoEvalReportV1 = mode === TUTOR_STUB_FIELD_TURN_PROJECTION_MODES.AUTO_EVAL_REPORT_V1;
  const classification = turn?.classification || {};
  const turnAnalysis = classification.turn || {};
  const scores = turnAnalysis.scores || {};
  const model = turn?.tutorLearnerDagModel || {};
  const metrics = model.metrics || {};
  const assessment = model.assessment || {};
  const register = turn?.registerSelection || {};
  const priorEfficacy = turn?.previousRegisterEfficacy || null;
  const learnerAdvance = turn?.learnerAdvance || turn?.tutorLearnerDagUpdate?.advance || model.learnerAdvance || null;
  const leakOk = !turn?.tutorLeakAudit || turn.tutorLeakAudit.ok === true;
  const conceptual = fieldScore(scores.conceptual_engagement);
  const readiness = fieldScore(scores.epistemic_readiness);
  const coverage = clampField01(Number(assessment.bestPathCoverage || 0));
  const grounded = clampField01(Number(metrics.groundedCount || 0) / 8);
  const missing = clampField01(Number(metrics.missingPremiseCount || 0) / 8);
  const overreachPattern = autoEvalReportV1
    ? /overconfident|answer_seeking|overleaps_evidence|unsupported|resistant/iu
    : /overconfident|answer_seeking|omits_warrant|overleaps_evidence|distorts_public_evidence|unsupported|resistant/iu;
  const overreach = overreachPattern.test(
    [turnAnalysis.epistemic_stance, turnAnalysis.evidence_use, assessment.bottleneck, priorEfficacy?.label]
      .filter(Boolean)
      .join(' '),
  )
    ? 0.25
    : 0;
  const responseWords = wordsInText(turn?.tutor);
  const brevity = clampField01(1 - Math.max(0, responseWords - 95) / 130);
  const registerConfidence = Number.isFinite(Number(register.confidence))
    ? clampField01(Number(register.confidence))
    : 0.5;
  const efficacyScore = priorEfficacy
    ? clampField01(
        (Number(
          autoEvalReportV1
            ? priorEfficacy.progressScore || 0
            : (priorEfficacy.selfAssessmentScore ?? priorEfficacy.progressScore ?? 0),
        ) +
          4) /
          8,
      )
    : 0.5;
  const coverageGain = Math.max(0, fieldDelta(coverage, previous?.coverage));
  const releasedShare = autoEvalReportV1
    ? (turn?.tutorDag?.leavesReleased || 0) / Math.max(1, turn?.tutorDag?.leavesTotal || 1)
    : Number(turn?.tutorDag?.leavesReleased || 0) / Math.max(1, Number(turn?.tutorDag?.leavesTotal || 1));

  const learnerMastery = roundField(0.34 * conceptual + 0.26 * readiness + 0.3 * coverage + 0.1 * grounded);
  const masteryGain = Math.max(0, fieldDelta(learnerMastery, previous?.learnerMastery));
  const learnerRisk = roundField(clampField01(0.45 * missing + 0.25 * (1 - readiness) + overreach));
  const tutorAlignment = roundField(
    clampField01(0.3 * registerConfidence + 0.24 * efficacyScore + 0.22 * brevity + 0.24 * (leakOk ? 1 : 0)),
  );
  const jointMomentum = roundField(
    clampField01(0.42 * masteryGain + 0.28 * coverageGain + 0.18 * efficacyScore + 0.12 * releasedShare),
  );

  const projection = {
    turn: turn.turn,
    learnerMastery,
    learnerRisk,
    tutorAlignment,
    jointMomentum,
    coverage,
    groundedCount: Number(metrics.groundedCount || 0),
    missingCount: Number(metrics.missingPremiseCount || 0),
    conceptual,
    readiness,
    register: register.selected_register || null,
    bottleneck: assessment.bottleneck || 'unknown',
    learnerMove: turnAnalysis.discourse_move || 'unknown',
  };

  if (!autoEvalReportV1) {
    projection.learnerAdvance = learnerAdvance;
    projection.calculation = {
      inputs: {
        conceptual,
        readiness,
        coverage,
        grounded,
        missing,
        overreach,
        responseWords,
        brevity: roundField(brevity),
        registerConfidence: roundField(registerConfidence),
        efficacyScore: roundField(efficacyScore),
        leakOk,
        masteryGain: roundField(masteryGain),
        coverageGain: roundField(coverageGain),
        releasedShare: roundField(releasedShare),
        learnerAdvanceStrength: roundField(learnerAdvance?.strength || 0),
      },
      formulas: {
        learnerMastery: '0.34*conceptual + 0.26*readiness + 0.30*coverage + 0.10*grounded',
        learnerRisk: '0.45*missing + 0.25*(1-readiness) + overreach',
        tutorAlignment: '0.30*registerConfidence + 0.24*efficacy + 0.22*brevity + 0.24*leakOk',
        jointMomentum: '0.42*masteryGain + 0.28*coverageGain + 0.18*efficacy + 0.12*releasedShare',
      },
    };
  }

  projection.speed = previous
    ? roundField(
        Math.sqrt(
          fieldDelta(learnerMastery, previous.learnerMastery) ** 2 +
            fieldDelta(learnerRisk, previous.learnerRisk) ** 2 +
            fieldDelta(tutorAlignment, previous.tutorAlignment) ** 2 +
            fieldDelta(jointMomentum, previous.jointMomentum) ** 2,
        ),
      )
    : 0;
  return projection;
}

export function buildTutorStubLightweightDialogueField(turns = [], options = {}) {
  const mode = resolveProjectionMode(options);
  const rows = [];
  for (const turn of turns) {
    rows.push(projectTutorStubLightweightFieldTurn(turn, rows.at(-1) || null, { mode }));
  }
  const first = rows[0] || {};
  const final = rows.at(-1) || {};
  return {
    schema: 'machinespirits.tutor-stub.lightweight-field.v1',
    turnCount: rows.length,
    rows,
    summary: {
      finalTurn: final.turn || null,
      meanSpeed: roundField(rows.reduce((sum, row) => sum + row.speed, 0) / Math.max(1, rows.length)),
      fieldDelta: {
        learnerMastery: fieldDelta(final.learnerMastery, first.learnerMastery),
        learnerRisk: fieldDelta(final.learnerRisk, first.learnerRisk),
        tutorAlignment: fieldDelta(final.tutorAlignment, first.tutorAlignment),
        jointMomentum: fieldDelta(final.jointMomentum, first.jointMomentum),
      },
      final: {
        learnerMastery: final.learnerMastery ?? null,
        learnerRisk: final.learnerRisk ?? null,
        tutorAlignment: final.tutorAlignment ?? null,
        jointMomentum: final.jointMomentum ?? null,
        coverage: final.coverage ?? null,
        bottleneck: final.bottleneck || null,
      },
    },
  };
}

export function projectTutorStubAutoEvalLightweightFieldTurn(turn, previous = null) {
  return projectTutorStubLightweightFieldTurn(turn, previous, {
    mode: TUTOR_STUB_FIELD_TURN_PROJECTION_MODES.AUTO_EVAL_REPORT_V1,
  });
}

export function buildTutorStubAutoEvalLightweightDialogueField(turns = []) {
  return buildTutorStubLightweightDialogueField(turns, {
    mode: TUTOR_STUB_FIELD_TURN_PROJECTION_MODES.AUTO_EVAL_REPORT_V1,
  });
}
