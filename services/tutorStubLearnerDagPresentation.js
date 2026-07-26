function learnerDagPresentationColors(colors = {}) {
  return {
    cyan: colors.cyan || '',
    dim: colors.dim || '',
    brightGreen: colors.brightGreen || '',
    red: colors.red || '',
    reset: colors.reset || '',
  };
}

export function projectTutorStubLearnerDagLines(result, { colors = {} } = {}) {
  if (!result?.model) return Object.freeze([]);
  const C = learnerDagPresentationColors(colors);
  const model = result.model;
  const metrics = model.metrics || {};
  const assessment = model.assessment || {};
  const buckets = Object.entries(assessment.missingPremiseBuckets || {})
    .map(([bucket, count]) => `${bucket}:${count}`)
    .join(', ');
  const warning = result.extractor?.error || result.extractor?.parseError;
  const lines = [
    `${C.cyan}tutor learner-DAG model >${C.reset} coverage ${assessment.bestPathCoverage ?? 'n/a'}; bottleneck ${assessment.bottleneck || 'unknown'}`,
  ];

  const dropout = result.dagFactDropout || null;
  if (dropout?.droppedNow?.length || dropout?.repairedNow?.length || dropout?.activeDropped?.length) {
    const parts = [
      dropout.droppedNow?.length ? `${dropout.droppedNow.length} slipped now` : null,
      dropout.repairedNow?.length ? `${dropout.repairedNow.length} re-adopted` : null,
      `${dropout.activeDropped?.length || 0} currently dropped`,
    ].filter(Boolean);
    lines.push(`${C.dim}  accumulated evidence memory: ${parts.join('; ')}${C.reset}`);
  }

  lines.push(
    `${C.dim}  grounded ${metrics.groundedCount || 0}, voiced ${metrics.voicedDerivedCount || 0}, hypotheses ${metrics.hypothesisCount || 0}, answer candidates ${metrics.answerCandidateCount || 0}${buckets ? `; missing ${buckets}` : ''}${C.reset}`,
  );
  if (result.accepted?.adopt?.length || result.accepted?.derive?.length || result.accepted?.hypothesis) {
    lines.push(
      `${C.dim}  update: adopted ${result.accepted.adopt.length}, derived ${result.accepted.derive.length}${result.accepted.hypothesis ? ', hypothesis noted' : ''}${C.reset}`,
    );
  }
  if (result.advance?.accelerated) {
    lines.push(
      `${C.brightGreen}  learner pace: accelerating — ${result.advance.supportedMoveCount} warranted proof moves accepted in this turn${C.reset}`,
    );
  }
  if (warning) lines.push(`${C.red} learner-DAG model warning${C.reset}${C.dim}: ${warning}${C.reset}`);
  return Object.freeze(lines);
}
