export function buildTutorStubRegisterPalette(
  mode,
  { definitions = {}, safeNames = [], negativeFloorNames = [], resolveStance = (name) => ({ register: name }) } = {},
) {
  const allNames = Object.keys(definitions);
  const value = String(mode || 'all')
    .trim()
    .toLowerCase();

  let names;
  if (!value || value === 'safe' || value === 'router' || value === 'positive') {
    names = safeNames;
  } else if (value === 'negative' || value === 'negative-floor') {
    names = negativeFloorNames;
  } else if (value === 'non-simulated') {
    names = allNames.filter((name) => definitions[name]?.simulated_only !== true);
  } else if (value === 'all' || value === 'simulated') {
    names = allNames;
  } else {
    names = value
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
  }

  const resolvedNames = names.map((name) => resolveStance(name)?.register || name);
  const unknown = names.filter((name, index) => !definitions[resolvedNames[index]]);
  if (unknown.length) {
    throw new Error(`Unknown --register-palette register(s): ${unknown.join(', ')}. Known: ${allNames.join(', ')}`);
  }

  return [...new Set(resolvedNames)];
}
