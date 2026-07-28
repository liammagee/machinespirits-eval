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

export function summarizeTutorStubEngagementStanceDefinition(name, { getDefinition } = {}) {
  const definition = getDefinition(name) || {};
  return {
    register: name,
    valence: definition.valence || 'unknown',
    router_selectable: definition.router_selectable === true,
    simulated_only: definition.simulated_only === true,
    public_signature: String(definition.public_signature || '').trim() || null,
    contrast: String(definition.contrast || '').trim() || null,
    reviewer_cues: definition.reviewer_cues || definition.trigger || null,
    stance_contract: String(definition.stance_contract || '').trim(),
    required_moves: Array.isArray(definition.required_moves) ? definition.required_moves : [],
    risk_flags: Array.isArray(definition.risk_flags) ? definition.risk_flags : [],
    forbidden_phrases: Array.isArray(definition.forbidden_phrases) ? definition.forbidden_phrases : [],
    recognition_guardrail: String(definition.recognition_guardrail || '').trim() || null,
  };
}

export function createTutorStubRegisterPromptVocabulary({
  getEngagementStanceDefinition,
  getRequestTypeDefinitions,
} = {}) {
  function engagementStanceDefinitionSummary(name) {
    return summarizeTutorStubEngagementStanceDefinition(name, {
      getDefinition: getEngagementStanceDefinition,
    });
  }

  function engagementStancePalettePromptRows(palette) {
    return JSON.stringify(palette.map(engagementStanceDefinitionSummary), null, 2);
  }

  function requestTypePromptRows() {
    const definitions = getRequestTypeDefinitions();
    const rows = Object.entries(definitions).map(([requestType, definition]) => ({
      request_type: requestType,
      role: definition.role || 'logical_armature',
      description: definition.description || '',
      dag_use: definition.dag_use || '',
    }));
    return rows.length ? JSON.stringify(rows, null, 2) : 'No request-type registry is configured.';
  }

  return Object.freeze({ engagementStanceDefinitionSummary, engagementStancePalettePromptRows, requestTypePromptRows });
}
