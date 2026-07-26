function trainingReusePresentationColors(colors = {}) {
  return {
    dim: colors.dim || '',
    reset: colors.reset || '',
  };
}

export function projectTutorStubTrainingReuseStatusLines({
  prefix = 'training reuse',
  label = 'not applicable',
  requested,
  humanSubjectLabel = 'unknown',
  sourceLabel = 'repository default',
  failClosed = false,
  status = 'not_applicable',
  colors = {},
} = {}) {
  const C = trainingReusePresentationColors(colors);
  const lines = [
    `${C.dim}  ${prefix}: ${label}; requested ${requested}; ${humanSubjectLabel}; source ${sourceLabel}${C.reset}`,
  ];

  if (failClosed) {
    lines.push(`${C.dim}  external or unknown human data stays do not train even when reuse is requested${C.reset}`);
  } else if (status === 'training_candidate') {
    lines.push(
      `${C.dim}  candidate means eligible for later review, not automatically approved or exported for training${C.reset}`,
    );
  } else if (status === 'do_not_train') {
    lines.push(`${C.dim}  this source and derived descendants must remain outside training corpora${C.reset}`);
  }

  return Object.freeze(lines);
}
