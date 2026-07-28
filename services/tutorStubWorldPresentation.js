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

export function tutorStubWorldLedgerTerm(world) {
  return String(tutorStubWorldPresentation(world).ledger_term || 'evidence record');
}

export function tutorStubWorldFlavourPhrase(world) {
  const diction = tutorStubWorldPresentation(world).narrative_diction;
  return diction ? `${diction} flavour` : "world's authored diction";
}

export function tutorStubWorldFamilyKey(world) {
  const presentation = tutorStubWorldPresentation(world);
  return String(presentation.family || presentation.variant_of || world.id);
}

export function groupTutorStubWorldEntries(entries = []) {
  const families = new Map();
  for (const entry of entries) {
    const key = tutorStubWorldFamilyKey(entry.world);
    if (!families.has(key)) families.set(key, []);
    families.get(key).push(entry);
  }
  const ordered = [];
  for (const members of families.values()) {
    const base = members.find((member) => !tutorStubWorldPresentation(member.world).variant_of) || members[0];
    ordered.push({ ...base, isVariant: false, familySize: members.length });
    for (const member of members) {
      if (member !== base) ordered.push({ ...member, isVariant: true, familySize: members.length });
    }
  }
  return ordered;
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
