import { tutorStubFieldDelta } from './tutorStubFieldPresentation.js';
import { topNumericEntries } from './tutorStubRegisterPolicy.js';

function presentationColors(colors = {}) {
  return {
    brightBlue: colors.brightBlue || '',
    brightCyan: colors.brightCyan || '',
    brightYellow: colors.brightYellow || '',
    brightMagenta: colors.brightMagenta || '',
    bold: colors.bold || '',
    dim: colors.dim || '',
    reset: colors.reset || '',
  };
}

function oneLine(value, { max = 220 } = {}) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

function appendAnalysisLine(lines, colors, label, value, { max = 220 } = {}) {
  const text = oneLine(value, { max });
  if (!text) return;
  lines.push(`${colors.dim}  ${label}: ${text}${colors.reset}`);
}

function debugNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(3)) : 'n/a';
}

function debugDelta(current, previous) {
  if (previous === null || previous === undefined) return 'baseline';
  const delta = tutorStubFieldDelta(current, previous);
  return `${delta >= 0 ? '+' : ''}${delta}`;
}

export function projectTutorStubTechnicalDebugLines({
  turn = null,
  turnIdentifier = null,
  selection = null,
  previousSelection = null,
  policyCalculation = null,
  field = null,
  distribution = '',
  registerPolicy = 'off',
  registerTemperature = null,
  colors = {},
} = {}) {
  const C = presentationColors(colors);
  if (!turn) {
    return Object.freeze([`${C.brightBlue}${C.bold}debug explain >${C.reset} no completed turns yet\n`]);
  }

  const calculation = policyCalculation || { features: null, scores: null, drivers: [] };
  const classification = turn.classification || {};
  const turnAnalysis = classification.turn || {};
  const overall = classification.overall || {};
  const learnerDag = turn.tutorLearnerDagModel || {};
  const assessment = learnerDag.assessment || {};
  const metrics = learnerDag.metrics || {};
  const policyFeatures = calculation.features || {};
  const policyField = policyFeatures.field || null;
  const policyDag = policyFeatures.dag || null;
  const fieldRow = field?.rows?.at(-1) || null;
  const previousFieldRow = field?.rows?.at(-2) || null;
  const inputs = fieldRow?.calculation?.inputs || {};
  const currentRegister = selection?.engagement_stance || selection?.selected_register || 'off';
  const previousRegister = previousSelection?.engagement_stance || previousSelection?.selected_register || 'none';
  const registerChanged = previousRegister !== 'none' && previousRegister !== currentRegister;
  const activatedPolicy = selection?.activated_policy || selection?.primary_policy || selection?.policy || 'off';
  const releasePacing = turn.releasePacing || null;
  const lines = [
    `${C.brightBlue}${C.bold}debug explain >${C.reset} turn ${turn.turn} · ${turnIdentifier || turn.turnId || 'unknown'}`,
    `${C.brightCyan}${C.bold}  A · learner analysis${C.reset}`,
  ];

  appendAnalysisLine(
    lines,
    C,
    'reading',
    turnAnalysis.summary || overall.summary || 'No classifier summary was stored.',
  );
  appendAnalysisLine(
    lines,
    C,
    'labels',
    `request=${turnAnalysis.request_type || 'unknown'}; move=${turnAnalysis.discourse_move || 'unknown'}; evidence=${
      turnAnalysis.evidence_use || 'unknown'
    }; stance=${turnAnalysis.epistemic_stance || 'unknown'}; agency=${turnAnalysis.agency || 'unknown'}`,
  );
  appendAnalysisLine(
    lines,
    C,
    'reasoning record',
    `coverage=${assessment.bestPathCoverage ?? 'n/a'}; grounded=${metrics.groundedCount || 0}; missing=${
      metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 'n/a'
    }; bottleneck=${assessment.bottleneck || 'unknown'}`,
  );

  lines.push(`${C.brightYellow}${C.bold}  B · calculations and field update${C.reset}`);
  if (policyField) {
    appendAnalysisLine(
      lines,
      C,
      'policy input field',
      `surface ${policyField.beforeScore ?? 'n/a'} → ${policyField.afterScore ?? 'n/a'} (Δ ${
        policyField.delta === null || policyField.delta === undefined
          ? 'initial'
          : `${policyField.delta >= 0 ? '+' : ''}${policyField.delta}`
      }); relation=${policyField.relation || 'unknown'}`,
    );
  }
  if (policyDag) {
    appendAnalysisLine(
      lines,
      C,
      'policy proof calculation',
      `progressScore=${policyDag.progressScore ?? 'n/a'}; progress=${policyDag.progress ?? 'n/a'}; coverage=${
        policyDag.bestPathCoverage ?? 'n/a'
      }; missing=${policyDag.missingPremiseCount ?? 'n/a'}; bottleneck=${policyDag.bottleneck || 'unknown'}`,
    );
  }
  if (fieldRow) {
    appendAnalysisLine(
      lines,
      C,
      'mastery calculation',
      `0.34×${debugNumber(inputs.conceptual)} + 0.26×${debugNumber(inputs.readiness)} + 0.30×${debugNumber(
        inputs.coverage,
      )} + 0.10×${debugNumber(inputs.grounded)} = ${fieldRow.learnerMastery}`,
    );
    appendAnalysisLine(
      lines,
      C,
      'risk calculation',
      `0.45×${debugNumber(inputs.missing)} + 0.25×(1-${debugNumber(inputs.readiness)}) + ${debugNumber(
        inputs.overreach,
      )} overreach = ${fieldRow.learnerRisk}`,
    );
    appendAnalysisLine(
      lines,
      C,
      'alignment calculation',
      `0.30×${debugNumber(inputs.registerConfidence)} + 0.24×${debugNumber(
        inputs.efficacyScore,
      )} + 0.22×${debugNumber(inputs.brevity)} + 0.24×${inputs.leakOk ? 1 : 0} = ${fieldRow.tutorAlignment}`,
    );
    appendAnalysisLine(
      lines,
      C,
      'momentum calculation',
      `0.42×${debugNumber(inputs.masteryGain)} + 0.28×${debugNumber(
        inputs.coverageGain,
      )} + 0.18×${debugNumber(inputs.efficacyScore)} + 0.12×${debugNumber(inputs.releasedShare)} = ${
        fieldRow.jointMomentum
      }`,
    );
    appendAnalysisLine(
      lines,
      C,
      'field updated for next turn',
      `mastery=${fieldRow.learnerMastery} (${debugDelta(
        fieldRow.learnerMastery,
        previousFieldRow?.learnerMastery,
      )}); risk=${fieldRow.learnerRisk} (${debugDelta(
        fieldRow.learnerRisk,
        previousFieldRow?.learnerRisk,
      )}); alignment=${fieldRow.tutorAlignment} (${debugDelta(
        fieldRow.tutorAlignment,
        previousFieldRow?.tutorAlignment,
      )}); momentum=${fieldRow.jointMomentum} (${debugDelta(fieldRow.jointMomentum, previousFieldRow?.jointMomentum)})`,
    );
  }
  const dynamical = selection?.dynamical_system_policy || null;
  if (dynamical?.state_vector) {
    appendAnalysisLine(lines, C, 'system vector', topNumericEntries(dynamical.state_vector, { limit: 5 }).join(', '));
    appendAnalysisLine(
      lines,
      C,
      'derivatives',
      topNumericEntries(dynamical.derivative_vector, { limit: 4, abs: true }).join(', '),
    );
    appendAnalysisLine(lines, C, 'stance scores', topNumericEntries(dynamical.scores, { limit: 5 }).join(', '));
  } else if (calculation.scores) {
    appendAnalysisLine(lines, C, 'stance scores', topNumericEntries(calculation.scores, { limit: 5 }).join(', '));
  }

  lines.push(`${C.brightMagenta}${C.bold}  C · resulting register decision${C.reset}`);
  appendAnalysisLine(
    lines,
    C,
    'register change',
    previousRegister === 'none'
      ? `initial choice → ${currentRegister}`
      : registerChanged
        ? `${previousRegister} → ${currentRegister}`
        : `${currentRegister} held`,
  );
  appendAnalysisLine(
    lines,
    C,
    'policy path',
    `stack=${selection?.policy || registerPolicy || 'off'}; activated=${activatedPolicy}; temperature=${
      selection?.temperature ?? registerTemperature ?? 'n/a'
    }`,
  );
  if (selection?.random_performance?.enabled) {
    appendAnalysisLine(
      lines,
      C,
      'random performance',
      'engagement stance and host character sampled without learner-assessment influence; the field calculations above did not select them',
    );
  }
  if (selection?.policy_composition) {
    const composition = selection.policy_composition;
    appendAnalysisLine(
      lines,
      C,
      'overlay result',
      composition.activated_overlay
        ? `${composition.activated_overlay} overrode the primary at strength ${composition.activated_strength}`
        : `no overlay crossed ${composition.overlay_threshold}; primary retained`,
    );
  }
  if (distribution) appendAnalysisLine(lines, C, 'stance distribution', distribution);
  if (releasePacing) {
    appendAnalysisLine(
      lines,
      C,
      'clue release pace',
      `${releasePacing.baseSpeed}x base → ${releasePacing.effectiveSpeed}x effective (${releasePacing.direction}); ${
        releasePacing.signal?.reason || 'no pace-change request'
      }${releasePacing.releasedNow?.length ? `; released ${releasePacing.releasedNow.join(', ')}` : ''}`,
    );
  }
  appendAnalysisLine(
    lines,
    C,
    'decision basis',
    selection?.register_reason || calculation.drivers.slice(0, 4).join('; '),
  );
  if (selection) {
    appendAnalysisLine(
      lines,
      C,
      'response configuration',
      `action=${selection.action_family || 'none'}; audience=${selection.audience_register || 'unknown'}; language=${
        selection.lexical_accessibility || 'unknown'
      }; scene=${selection.scene_immersion || 'unknown'}`,
    );
  }
  lines.push(
    `${C.dim}  /debug off returns to dialogue plus the compact model/stance line · /debug on returns to concise prose${C.reset}\n`,
  );
  return Object.freeze(lines);
}
