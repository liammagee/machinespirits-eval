function modelChoicePresentationColors(colors = {}) {
  return {
    brightCyan: colors.brightCyan || '',
    cyan: colors.cyan || '',
    dim: colors.dim || '',
    reset: colors.reset || '',
  };
}

export const PREFERRED_TUTOR_MODEL_REFS = Object.freeze([
  'codex.gpt-5.6-terra',
  'codex.gpt-5.6-sol',
  'codex.gpt-5.6-luna',
  'codex.gpt-5.5',
  'claude-code.sonnet',
  'claude-code.fable',
  'claude-code.opus',
  'claude-code.haiku',
]);

export function buildTutorStubModelChoiceEntries({
  currentRef,
  providers = {},
  getProviderConfig,
  isCliProvider,
  resolveModel,
  unsupportedRefs = new Set(),
  preferredRefs = PREFERRED_TUTOR_MODEL_REFS,
}) {
  const entries = [];
  for (const [provider, config] of Object.entries(providers)) {
    let providerConfig;
    try {
      providerConfig = getProviderConfig(provider);
    } catch {
      continue;
    }
    if (!providerConfig.isConfigured && !String(currentRef).startsWith(`${provider}.`)) continue;
    for (const [alias, model] of Object.entries(config.models || {})) {
      const ref = `${provider}.${alias}`;
      if (unsupportedRefs.has(ref.toLowerCase())) continue;
      const access = isCliProvider(provider)
        ? 'CLI login'
        : config.api_key_env
          ? `${config.api_key_env} configured`
          : 'local endpoint';
      entries.push({ ref, provider, alias, model, access, current: ref === currentRef });
    }
  }
  if (!entries.some((entry) => entry.ref === currentRef)) {
    try {
      const resolved = resolveModel(currentRef);
      entries.push({
        ref: currentRef,
        provider: resolved.provider,
        alias: currentRef.slice(currentRef.indexOf('.') + 1),
        model: resolved.model,
        access: 'current launch model',
        current: true,
      });
    } catch {
      // The caller's normal launch validation reports an invalid current model.
    }
  }
  const preferredIndex = new Map(preferredRefs.map((ref, index) => [ref, index]));
  return entries.sort((left, right) => {
    if (left.current !== right.current) return left.current ? -1 : 1;
    const leftPreferred = preferredIndex.has(left.ref) ? preferredIndex.get(left.ref) : Number.MAX_SAFE_INTEGER;
    const rightPreferred = preferredIndex.has(right.ref) ? preferredIndex.get(right.ref) : Number.MAX_SAFE_INTEGER;
    return (
      leftPreferred - rightPreferred ||
      left.provider.localeCompare(right.provider) ||
      left.alias.localeCompare(right.alias)
    );
  });
}

export function assertTutorStubSupportedModelRefs(refs, { unsupportedRefs = new Set() } = {}) {
  for (const [label, ref] of Object.entries(refs || {})) {
    const normalized = String(ref || '')
      .trim()
      .toLowerCase();
    if (unsupportedRefs.has(normalized)) {
      throw new Error(
        `${label}=${ref} is not supported by the local Codex CLI ChatGPT-account route. ` +
          'Use codex.gpt-5.6-terra for the CLI-backed speaking tutor, codex.gpt-5.6-sol for interpretation, or openai.mini/openrouter.gpt-mini for GPT mini.',
      );
    }
  }
}

export function createTutorStubModelSelection({
  loadProviders,
  getProviderConfig,
  isCliProvider,
  resolveModel,
  unsupportedRefs = new Set(),
} = {}) {
  function assertSupportedModelRefs(refs) {
    return assertTutorStubSupportedModelRefs(refs, { unsupportedRefs });
  }

  function tutorModelChoiceEntries(currentRef) {
    return buildTutorStubModelChoiceEntries({
      currentRef,
      providers: loadProviders()?.providers || {},
      getProviderConfig,
      isCliProvider,
      resolveModel,
      unsupportedRefs,
    });
  }

  function resolveTutorModelSelection(ref) {
    const modelRef = String(ref || '').trim();
    assertSupportedModelRefs({ model: modelRef });
    const resolved = resolveModel(modelRef);
    const providerConfig = getProviderConfig(resolved.provider);
    if (!providerConfig.isConfigured) {
      const requirement = providerConfig.api_key_env || providerConfig.base_url || 'provider configuration';
      throw new Error(`${modelRef} is unavailable; configure ${requirement} first`);
    }
    return { modelRef, resolved, providerConfig };
  }

  return Object.freeze({ assertSupportedModelRefs, tutorModelChoiceEntries, resolveTutorModelSelection });
}

export function projectTutorStubModelChoiceLines({
  definition = {},
  currentRef = '',
  entries = [],
  visibleLimit = 16,
  colors = {},
} = {}) {
  const C = modelChoicePresentationColors(colors);
  const visible = entries.slice(0, visibleLimit);
  const lines = [`${C.cyan}${definition.label.toLowerCase()} models >${C.reset} current ${currentRef}`];

  for (const entry of visible) {
    lines.push(
      `${entry.current ? C.brightCyan : C.dim}${entry.current ? '›' : ' '} ${entry.ref.padEnd(34)} ${entry.model} · ${entry.access}${C.reset}`,
    );
  }

  if (entries.length > visible.length) {
    lines.push(
      `${C.dim}  … ${entries.length - visible.length} more configured aliases; type /settings model and a prefix, then use Tab${C.reset}`,
    );
  }

  lines.push(
    `${C.dim}  choose with /settings models ${definition.setting} <provider.alias>; default restores ${definition.defaultRef}${C.reset}\n`,
  );
  return Object.freeze(lines);
}
