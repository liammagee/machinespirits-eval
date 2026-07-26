function presentationColors(colors = {}) {
  return {
    accent: colors.accent || '',
    bold: colors.bold || '',
    brightCyan: colors.brightCyan || '',
    dim: colors.dim || '',
    reset: colors.reset || '',
  };
}

export function projectTutorStubReleaseNotesLines({ notes, colors = {} } = {}) {
  const C = presentationColors(colors);
  const through = notes?.through?.shortHash ? ` · through ${notes.through.shortHash}` : '';
  const commitCount = Number(notes?.relevantCommitCount || 0);
  const lines = [
    `${C.brightCyan}${C.bold}release notes >${C.reset} last ${notes?.hours} hours${through} · ${commitCount} relevant ${commitCount === 1 ? 'commit' : 'commits'}`,
  ];

  if (!notes?.groups?.length) {
    lines.push(`${C.dim}  no tutor-stub commits landed in this window${C.reset}\n`);
    return Object.freeze(lines);
  }

  for (const group of notes.groups) {
    lines.push(
      `\n${C.accent}${C.bold}${group.title}${C.reset}${C.dim} · ${group.commits.length} ${group.commits.length === 1 ? 'commit' : 'commits'}${C.reset}`,
      `${C.dim}  effect >${C.reset} ${group.effect}`,
      `${C.dim}  look for >${C.reset} ${group.lookFor}`,
    );
    const visibleLimit = group.id === 'validation' ? 4 : 6;
    for (const commit of group.commits.slice(0, visibleLimit)) {
      lines.push(`${C.dim}    ${commit.shortHash} ·${C.reset} ${commit.subject}`);
    }
    if (group.commits.length > visibleLimit) {
      lines.push(`${C.dim}    + ${group.commits.length - visibleLimit} earlier commits in this window${C.reset}`);
    }
  }

  lines.push(
    `\n${C.dim}  This view is rebuilt from Git each time, so newly committed changes enter automatically. Verification commits are separated from changes that directly affect an exchange.${C.reset}\n`,
  );
  return Object.freeze(lines);
}
