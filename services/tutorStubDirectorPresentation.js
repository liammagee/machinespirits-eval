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

export function buildTutorStubDirectorInitialContext(world, { audienceLines = [] } = {}) {
  if (!world) return null;
  return {
    stageNotes: [
      `Before the first exchange, ${world.title} is set as a public inquiry: ${world.question}`,
      String(world.setting || '').trim(),
    ]
      .filter(Boolean)
      .join('\n'),
    tutorCharacter:
      'The tutor enters as an adaptive scene actor: patient with the learner, but ready to examine, keep the record, argue, witness, or close as the public evidence demands.',
    learnerCharacter:
      String(world.learnerVoice || '').trim() ||
      'The learner enters as attentive but not yet committed, willing to test each claim aloud.',
    audienceContext: audienceLines.join('\n') || null,
    registerNote:
      "The tutor's voice should follow the public characters and scene pressure without adding hidden evidence or proof machinery.",
  };
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
