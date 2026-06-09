import { spawnSync } from 'node:child_process';

const versionCache = new Map();

function compactOutput(result) {
  const out = String(result?.stdout || '').trim();
  const err = String(result?.stderr || '').trim();
  return out || err || null;
}

function detectCliVersion(binary) {
  if (!binary) return null;
  if (versionCache.has(binary)) return versionCache.get(binary);
  let value = null;
  try {
    const result = spawnSync(binary, ['--version'], {
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: 256 * 1024,
    });
    if (!result.error && result.status === 0) value = compactOutput(result);
  } catch {
    value = null;
  }
  versionCache.set(binary, value);
  return value;
}

function modelProvenance({ requestedModel = null, defaultLabel = 'default', effort = null, effortSource = null } = {}) {
  const requested = requestedModel || null;
  return {
    model: requested || defaultLabel,
    requestedModel: requested,
    resolvedModel: requested,
    modelResolution: requested ? 'explicit_cli_arg' : 'unresolved_cli_default',
    reasoningEffort: effort || null,
    reasoningEffortSource: effort ? effortSource || 'explicit_or_environment' : null,
  };
}

export { detectCliVersion, modelProvenance };
