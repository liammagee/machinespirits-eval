const CELL_PROFILE_NAME = /^cell_\d+_[A-Za-z0-9][A-Za-z0-9_]*$/u;

/**
 * Historical evaluation names retained for database and CLI compatibility.
 *
 * These are aliases, not canonical cells. Their targets name in-housed
 * tutor-core profiles and are resolved directly instead of entering the YAML
 * cell prompt-type dispatch chain.
 */
export const LEGACY_EVAL_PROFILE_ALIASES = Object.freeze({
  single_baseline: 'budget',
  single_baseline_paid: 'budget',
  single_recognition: 'recognition',
  single_recognition_paid: 'recognition',
  single_enhanced: 'enhanced',
  baseline: 'budget',
  baseline_paid: 'budget',
  recognition: 'recognition',
  recognition_paid: 'recognition',
  enhanced: 'enhanced',
});

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

export function canonicalCellNamesFromProfiles(profiles) {
  if (!profiles || typeof profiles !== 'object' || Array.isArray(profiles)) {
    throw new TypeError('Evaluation profile registry requires a profiles object');
  }
  return Object.freeze(Object.keys(profiles).filter((name) => name.startsWith('cell_')));
}

export function validateEvalProfileRegistry({
  profiles,
  canonicalCellNames,
  legacyAliases = LEGACY_EVAL_PROFILE_ALIASES,
}) {
  const yamlCellNames = canonicalCellNamesFromProfiles(profiles);
  const registryCellNames = [...(canonicalCellNames || [])];
  const yamlSet = new Set(yamlCellNames);
  const registrySet = new Set(registryCellNames);
  const aliasNames = Object.keys(legacyAliases || {});

  const yamlOnly = yamlCellNames.filter((name) => !registrySet.has(name));
  const registryOnly = registryCellNames.filter((name) => !yamlSet.has(name));
  const duplicateCells = duplicateValues(registryCellNames);
  const malformedCells = [...new Set([...yamlCellNames, ...registryCellNames])]
    .filter((name) => !CELL_PROFILE_NAME.test(name))
    .sort();
  const aliasCollisions = aliasNames.filter((name) => yamlSet.has(name) || registrySet.has(name)).sort();
  const malformedAliases = aliasNames
    .filter((name) => name.startsWith('cell_') || typeof legacyAliases[name] !== 'string' || !legacyAliases[name])
    .sort();

  const errors = [];
  if (yamlOnly.length) errors.push(`YAML-only cells: ${yamlOnly.join(', ')}`);
  if (registryOnly.length) errors.push(`registry-only cells: ${registryOnly.join(', ')}`);
  if (duplicateCells.length) errors.push(`duplicate registry cells: ${duplicateCells.join(', ')}`);
  if (malformedCells.length) errors.push(`malformed cell names: ${malformedCells.join(', ')}`);
  if (aliasCollisions.length) errors.push(`alias/canonical collisions: ${aliasCollisions.join(', ')}`);
  if (malformedAliases.length) errors.push(`malformed aliases: ${malformedAliases.join(', ')}`);

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    yamlCellNames,
    registryCellNames: Object.freeze(registryCellNames),
    legacyAliases: Object.freeze({ ...legacyAliases }),
    yamlOnly: Object.freeze(yamlOnly),
    registryOnly: Object.freeze(registryOnly),
    duplicateCells: Object.freeze(duplicateCells),
    malformedCells: Object.freeze(malformedCells),
    aliasCollisions: Object.freeze(aliasCollisions),
    malformedAliases: Object.freeze(malformedAliases),
  });
}

export function createEvalProfileRegistry(profiles, legacyAliases = LEGACY_EVAL_PROFILE_ALIASES) {
  const canonicalCellNames = canonicalCellNamesFromProfiles(profiles);
  const validation = validateEvalProfileRegistry({ profiles, canonicalCellNames, legacyAliases });
  if (!validation.valid) {
    throw new Error(`Invalid evaluation profile registry: ${validation.errors.join('; ')}`);
  }

  return Object.freeze({
    canonicalCellNames,
    legacyAliases: validation.legacyAliases,
    allEvaluationNames: Object.freeze([...Object.keys(validation.legacyAliases), ...canonicalCellNames]),
  });
}

export function assertEvalProfileTargetExists(profileName, targetProfileName, tutorProfiles) {
  if (!tutorProfiles?.[targetProfileName]) {
    throw new Error(
      `Evaluation profile "${profileName}" resolves to missing tutor-core profile "${targetProfileName}"`,
    );
  }
  return targetProfileName;
}
