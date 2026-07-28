function curriculumProgressColors(colors = {}) {
  return {
    brightCyan: colors.brightCyan || '',
    bold: colors.bold || '',
    dim: colors.dim || '',
    reset: colors.reset || '',
  };
}

export function projectTutorStubCurriculumProgressLines(progress, { colors = {} } = {}) {
  const C = curriculumProgressColors(colors);
  if (!progress) {
    return Object.freeze([`${C.dim}curriculum progress is available only in a curriculum session${C.reset}\n`]);
  }

  const lines = [`${C.brightCyan}${C.bold}course progress >${C.reset} ${progress.curriculum.title}`];
  for (const module of progress.modules) {
    const marker = module.id === progress.currentModule.id ? '◆' : module.status === 'mastered' ? '✓' : '◇';
    const evidence = Object.values(module.phaseEvidenceCounts).reduce((sum, count) => sum + count, 0);
    const lock = module.available ? '' : ` · waiting for ${module.missingPrerequisiteModuleIds.join(', ')}`;
    lines.push(
      `  ${marker} ${module.id} · ${module.title} · ${module.status} · ${evidence} evidence turn${evidence === 1 ? '' : 's'}${lock}`,
    );
  }
  lines.push(
    `${C.dim}  current phase: ${progress.currentPhase.replaceAll('_', ' ')} · ${progress.currentPhaseEvidenceCount} evidence turn${progress.currentPhaseEvidenceCount === 1 ? '' : 's'}${C.reset}`,
    `${C.dim}  /next advances attempted diagnostic/scaffold work; independent check and transfer require /next pass or /next revise${C.reset}`,
  );
  if (progress.completionAuthority === 'external_workplan_verification_only') {
    lines.push(`${C.dim}  dialogue progress never completes or closes the external workplan item${C.reset}`);
  }
  lines.push('');
  return Object.freeze(lines);
}
