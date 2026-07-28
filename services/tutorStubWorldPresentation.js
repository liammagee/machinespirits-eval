import path from 'node:path';

// Authorial presentation describes the world's scenario ecology and narrative
// diction. It is deliberately separate from tutor register and engagement
// stance, which control speech and the speaker-hearer relation.
export function tutorStubWorldPresentation(world) {
  return (world && world.presentation) || {};
}

export function tutorStubWorldPickerSummary(world) {
  const presentation = tutorStubWorldPresentation(world);
  if (presentation.summary) return String(presentation.summary);
  const setting = String(world?.setting || '')
    .trim()
    .replace(/\s+/gu, ' ');
  return setting.split(/(?<=\.)\s/u)[0] || world?.question;
}

export function projectTutorStubWorldCatalogLines(entries = [], { root = '.' } = {}) {
  const lines = [];
  for (const { filePath, world, isVariant, familySize } of entries) {
    if (isVariant) {
      lines.push(`  ↳ ${world.id.padEnd(34)} ${world.title}`);
      continue;
    }
    const presentation = tutorStubWorldPresentation(world);
    const tags = [presentation.temporal_frame, presentation.narrative_diction].filter(Boolean).join(', ');
    const familyNote = familySize > 1 ? ` — family of ${familySize}` : '';
    lines.push(
      `${world.id.padEnd(38)} ${world.title}${tags ? ` [${tags}]` : ''}${familyNote}`,
      `  ${path.relative(root, filePath)}`,
      `  ${tutorStubWorldPickerSummary(world)}`,
    );
  }
  return Object.freeze(lines);
}
