function directorPresentationColors(colors = {}) {
  return {
    cyan: colors.cyan || '',
    dim: colors.dim || '',
    reset: colors.reset || '',
  };
}

function directorFieldLines(label, text, colors) {
  const lines = String(text || '').split('\n');
  return [`${colors.dim}  ${label}:${colors.reset} ${lines[0] || ''}`, ...lines.slice(1).map((line) => `    ${line}`)];
}

export function projectTutorStubDirectorContextLines(context, { colors = {} } = {}) {
  if (!context) return Object.freeze([]);
  const C = directorPresentationColors(colors);
  const lines = [
    `${C.cyan}director context >${C.reset}`,
    ...directorFieldLines('stage', context.stageNotes, C),
    ...directorFieldLines('tutor', context.tutorCharacter, C),
    ...directorFieldLines('learner', context.learnerCharacter, C),
  ];
  if (context.audienceContext) lines.push(...directorFieldLines('audience', context.audienceContext, C));
  lines.push(...directorFieldLines('voice', context.registerNote, C), '');
  return Object.freeze(lines);
}

export function projectTutorStubDirectorNotesLines(notes = {}, { colors = {} } = {}) {
  const C = directorPresentationColors(colors);
  const releases = Array.isArray(notes.releases) ? notes.releases : [];
  const lines = [`${C.cyan}director notes so far >${C.reset}`];

  if (!notes.opening && !releases.length) {
    lines.push(`${C.dim}  none have been issued yet${C.reset}\n`);
    return Object.freeze(lines);
  }

  if (notes.opening) {
    lines.push(
      `${C.dim}  opening directions${C.reset}`,
      ...directorFieldLines('stage', notes.opening.stageNotes, C),
      ...directorFieldLines('tutor', notes.opening.tutorCharacter, C),
      ...directorFieldLines('learner', notes.opening.learnerCharacter, C),
      ...directorFieldLines('voice', notes.opening.registerNote, C),
    );
  }

  for (const release of releases) {
    lines.push(`${C.dim}  turn ${release.turn} · scene note${C.reset}`);
    for (const line of String(release.surface || '').split('\n')) lines.push(`    ${line}`);
  }

  lines.push(
    `${C.dim}  through ${notes.throughTurn > 0 ? `completed turn ${notes.throughTurn}` : 'the opening'}; future notes remain withheld${C.reset}\n`,
  );
  return Object.freeze(lines);
}
