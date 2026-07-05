import { deriveTaskMasteryState, fixedProgressionRecommendation, TASK_LOOP_BENCHMARK_SCHEMA } from './taskMastery.js';

export const TASK_LOOP_HELDOUT_GATE_SCHEMA = 'dramatic-derivation.task-loop-heldout-gate.v0';

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function cleanRelativePath(path) {
  return typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.includes('..');
}

function proofFingerprint(row = {}, key) {
  return row[key] || row.proofControlFingerprint || null;
}

function proofUnchanged(row = {}) {
  const fixed = proofFingerprint(row, 'fixedProofControlFingerprint');
  const adaptive = proofFingerprint(row, 'adaptiveProofControlFingerprint');
  if (!fixed || !adaptive) return false;
  return stableStringify(fixed) === stableStringify(adaptive);
}

export function evaluateTaskLoopHeldoutArtifact(row = {}, options = {}) {
  const state = deriveTaskMasteryState(row.input || {});
  const fixedRecommendation = fixedProgressionRecommendation(row.input || {});
  const expectedRecommendation = row.expectedRecommendation || 'unknown';
  const adaptivePassed = state.nextTaskRecommendation === expectedRecommendation;
  const fixedPassed = fixedRecommendation === expectedRecommendation;
  const splitOk = row.split === 'heldout';
  const sourceArtifactOk = cleanRelativePath(row.sourceArtifact);
  const sourceExistsOk = options.sourceExists ? Boolean(options.sourceExists(row.sourceArtifact)) : true;
  const publicOnlyOk = state.inputAudit.ok;
  const proofControlUnchanged = proofUnchanged(row);
  const advisoryOnly = state.authority === 'advisory' && state.mayOverrideProofControl === false;
  const passed =
    splitOk &&
    sourceArtifactOk &&
    sourceExistsOk &&
    publicOnlyOk &&
    proofControlUnchanged &&
    advisoryOnly &&
    adaptivePassed;

  return {
    schema: TASK_LOOP_HELDOUT_GATE_SCHEMA,
    id: row.id || 'unknown-heldout-row',
    split: row.split || 'unknown',
    sourceArtifact: row.sourceArtifact || null,
    sourceRef: row.sourceRef || null,
    worldId: row.worldId || row.input?.worldId || null,
    expectedRecommendation,
    adaptiveRecommendation: state.nextTaskRecommendation,
    fixedRecommendation,
    adaptivePassed,
    fixedPassed,
    publicOnlyOk,
    proofControlUnchanged,
    advisoryOnly,
    splitOk,
    sourceArtifactOk,
    sourceExistsOk,
    passed,
    masteryEstimate: state.masteryEstimate,
    state,
  };
}

export function evaluateTaskLoopHeldoutGate(artifacts = [], options = {}) {
  const rows = (Array.isArray(artifacts) ? artifacts : []).map((artifact) =>
    evaluateTaskLoopHeldoutArtifact(artifact, options),
  );
  const adaptivePass = rows.filter((row) => row.adaptivePassed).length;
  const fixedPass = rows.filter((row) => row.fixedPassed).length;
  const count = rows.length;
  const adaptiveAccuracy = count ? +(adaptivePass / count).toFixed(3) : 0;
  const fixedAccuracy = count ? +(fixedPass / count).toFixed(3) : 0;
  const improvement = +(adaptiveAccuracy - fixedAccuracy).toFixed(3);
  const minImprovement = Number.isFinite(Number(options.minImprovement)) ? Number(options.minImprovement) : 0.25;
  const summary = {
    schema: TASK_LOOP_HELDOUT_GATE_SCHEMA,
    count,
    adaptivePass,
    adaptiveFail: count - adaptivePass,
    fixedPass,
    fixedFail: count - fixedPass,
    adaptiveAccuracy,
    fixedAccuracy,
    improvement,
    minImprovement,
    publicOnlyFail: rows.filter((row) => !row.publicOnlyOk).length,
    proofControlChanged: rows.filter((row) => !row.proofControlUnchanged).length,
    nonAdvisoryRows: rows.filter((row) => !row.advisoryOnly).length,
    sourceMissing: rows.filter((row) => !row.sourceExistsOk).length,
    sourceInvalid: rows.filter((row) => !row.sourceArtifactOk).length,
    nonHeldoutRows: rows.filter((row) => !row.splitOk).length,
  };
  summary.allPassed =
    count > 0 &&
    summary.adaptiveFail === 0 &&
    summary.improvement >= minImprovement &&
    summary.publicOnlyFail === 0 &&
    summary.proofControlChanged === 0 &&
    summary.nonAdvisoryRows === 0 &&
    summary.sourceMissing === 0 &&
    summary.sourceInvalid === 0 &&
    summary.nonHeldoutRows === 0;

  return {
    schema: TASK_LOOP_HELDOUT_GATE_SCHEMA,
    baseSchema: TASK_LOOP_BENCHMARK_SCHEMA,
    summary,
    rows,
  };
}

export function renderTaskLoopHeldoutGateMarkdown(report) {
  const lines = [
    '# Derivation Task-Loop Held-Out Artifact Gate',
    '',
    `Schema: \`${report.schema}\``,
    'Zero-paid status: deterministic scoring of frozen held-out artifacts',
    `Artifacts: ${report.summary.count}`,
    `Adaptive passed: ${report.summary.adaptivePass}`,
    `Fixed progression passed: ${report.summary.fixedPass}`,
    `Accuracy delta: ${report.summary.improvement.toFixed(3)}`,
    `Minimum delta: ${report.summary.minImprovement.toFixed(3)}`,
    `Public-only failures: ${report.summary.publicOnlyFail}`,
    `Proof-control drift rows: ${report.summary.proofControlChanged}`,
    `Decision: ${report.summary.allPassed ? 'pass' : 'fail'}`,
    '',
    '| Artifact | Source | Expected | Adaptive | Fixed | Mastery | Proof unchanged | Public-only | Pass |',
    '|---|---|---|---|---|---:|---|---|---|',
  ];

  for (const row of report.rows) {
    lines.push(
      `| ${row.id} | ${row.sourceRef || row.sourceArtifact || ''} | ${row.expectedRecommendation} | ${
        row.adaptiveRecommendation
      } | ${row.fixedRecommendation} | ${row.masteryEstimate.toFixed(2)} | ${
        row.proofControlUnchanged ? 'yes' : 'no'
      } | ${row.publicOnlyOk ? 'yes' : 'no'} | ${row.passed ? 'yes' : 'no'} |`,
    );
  }

  lines.push(
    '',
    'Boundary: this is held-out task-selection evidence. It is not proof-control adaptation, runtime deployment, or human-learning evidence.',
    'Proof-control fingerprints are compared only as no-harm witnesses; they are never passed into the task/session selector.',
  );
  return `${lines.join('\n')}\n`;
}
