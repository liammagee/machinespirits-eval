function learnerClassificationPresentationColors(colors = {}) {
  return {
    cyan: colors.cyan || '',
    dim: colors.dim || '',
    red: colors.red || '',
    reset: colors.reset || '',
  };
}

export function projectTutorStubLearnerClassificationLines(presentation, { colors = {} } = {}) {
  if (!presentation) return Object.freeze([]);
  const C = learnerClassificationPresentationColors(colors);
  const lines = [
    `${C.cyan}learner classifier >${C.reset} ${presentation.summary}`,
    `${C.dim}  request: ${presentation.requestType}; move: ${presentation.discourseMove}; stance: ${presentation.epistemicStance}; conceptual ${presentation.conceptual}/5, readiness ${presentation.readiness}/5${C.reset}`,
  ];

  if (presentation.learningPace || presentation.reasoningSpan) {
    lines.push(
      `${C.dim}  pace: ${presentation.learningPace || 'steady'}; reasoning span: ${presentation.reasoningSpan || 'unknown'}${C.reset}`,
    );
  }
  lines.push(`${C.dim}  overall: ${presentation.overallSummary}${C.reset}`);
  if (presentation.pedagogicalNeed) {
    lines.push(`${C.dim}  tutor cue: ${presentation.pedagogicalNeed}${C.reset}`);
  }
  if (presentation.warning) {
    lines.push(`${C.red} learner-classifier warning${C.reset}${C.dim}: ${presentation.warning}${C.reset}`);
  }
  return Object.freeze(lines);
}
