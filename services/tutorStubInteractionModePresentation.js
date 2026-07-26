function presentationColors(colors = {}) {
  return {
    bold: colors.bold || '',
    brightBlue: colors.brightBlue || '',
    brightGreen: colors.brightGreen || '',
    brightYellow: colors.brightYellow || '',
    dim: colors.dim || '',
    reset: colors.reset || '',
  };
}

export function projectTutorStubInteractionModeLabel({ mode = 'learner', mixedEnabled = false, colors = {} } = {}) {
  const C = presentationColors(colors);
  if (mode === 'coach') return `${C.brightYellow}${C.bold}COACH${C.reset}`;
  if (mode === 'auto') return `${C.brightBlue}${C.bold}AUTO${C.reset}`;
  if (mixedEnabled) return `${C.brightGreen}${C.bold}MIXED${C.reset}`;
  return `${C.brightGreen}${C.bold}LEARNER${C.reset}`;
}

export function projectTutorStubInteractionModeBannerLines({
  mode = 'learner',
  mixedEnabled = false,
  detail = true,
  colors = {},
} = {}) {
  const C = presentationColors(colors);
  const description =
    mode === 'coach'
      ? 'your lines are private suggestions for the next tutor response'
      : mode === 'auto'
        ? 'the automated learner and tutor now play without intervention'
        : mixedEnabled
          ? 'your lines become public learner speech; AI drafts, clues, and /use are available'
          : 'your lines become public learner speech';
  const lines = [
    `${C.dim}╭─${C.reset} ${projectTutorStubInteractionModeLabel({ mode, mixedEnabled, colors: C })} ${C.dim}mode · ${description}${C.reset}`,
  ];
  if (detail && mode === 'coach') {
    lines.push(
      `${C.dim}╰─ guidance stays out of the public transcript; switch with /mode learner, or use /use in mixed mode${C.reset}\n`,
    );
  } else if (detail && mode === 'learner') {
    lines.push(`${C.dim}╰─ switch with /coach or hand off with /auto [turns]${C.reset}\n`);
  }
  return Object.freeze(lines);
}
