export function projectTutorStubCurriculumCatalogLines({ curriculum, sourceRef } = {}, modules = []) {
  if (!curriculum) return Object.freeze([]);

  const lines = [`${curriculum.title} (${curriculum.id})`, `  source: ${sourceRef}`];
  for (const module of modules) {
    const state = [module.priority, module.status, module.owner].filter(Boolean).join(' · ');
    lines.push(`  ${module.id}${state ? `  [${state}]` : ''}`, `    ${module.title}`);
  }
  return Object.freeze(lines);
}
