function modelChoicePresentationColors(colors = {}) {
  return {
    brightCyan: colors.brightCyan || '',
    cyan: colors.cyan || '',
    dim: colors.dim || '',
    reset: colors.reset || '',
  };
}

export function projectTutorStubModelChoiceLines({
  definition = {},
  currentRef = '',
  entries = [],
  visibleLimit = 16,
  colors = {},
} = {}) {
  const C = modelChoicePresentationColors(colors);
  const visible = entries.slice(0, visibleLimit);
  const lines = [`${C.cyan}${definition.label.toLowerCase()} models >${C.reset} current ${currentRef}`];

  for (const entry of visible) {
    lines.push(
      `${entry.current ? C.brightCyan : C.dim}${entry.current ? '›' : ' '} ${entry.ref.padEnd(34)} ${entry.model} · ${entry.access}${C.reset}`,
    );
  }

  if (entries.length > visible.length) {
    lines.push(
      `${C.dim}  … ${entries.length - visible.length} more configured aliases; type /settings model and a prefix, then use Tab${C.reset}`,
    );
  }

  lines.push(
    `${C.dim}  choose with /settings models ${definition.setting} <provider.alias>; default restores ${definition.defaultRef}${C.reset}\n`,
  );
  return Object.freeze(lines);
}
