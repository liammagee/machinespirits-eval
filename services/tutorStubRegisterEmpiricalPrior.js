const EMPIRICAL_REGISTER_POLICIES = new Set(['empirical_dynamical_system', 'continuous_empirical_dynamical_system']);

export function createTutorStubRegisterEmpiricalPriorModel({
  resolveWorkspacePath,
  defaultPath,
  existsSync,
  readFileSync,
} = {}) {
  function resolveRegisterEmpiricalPriorPath(value, { policy } = {}) {
    const raw = String(value || '').trim();
    if (/^(off|none|false|0)$/iu.test(raw)) return null;
    if (raw && raw !== 'auto') return resolveWorkspacePath(raw);
    if (EMPIRICAL_REGISTER_POLICIES.has(policy) || raw === 'auto') return defaultPath;
    return null;
  }

  function loadRegisterEmpiricalPrior(value, { policy } = {}) {
    const filePath = resolveRegisterEmpiricalPriorPath(value, { policy });
    if (!filePath) return { prior: null, filePath: null, status: 'off' };
    if (!existsSync(filePath)) return { prior: null, filePath, status: 'missing' };
    const prior = JSON.parse(readFileSync(filePath, 'utf8'));
    if (!/register-empirical-priors\.v[12]$/u.test(String(prior.schema || ''))) {
      throw new Error(`Invalid register empirical prior schema in ${filePath}: ${prior.schema || 'missing'}`);
    }
    const status = prior.schema.endsWith('.v1')
      ? 'loaded_legacy_requires_rebuild'
      : prior.deployment?.objectiveRegisterPriorEligible === false
        ? 'loaded_holdout_not_passed'
        : 'loaded';
    return { prior, filePath, status };
  }

  return Object.freeze({ resolveRegisterEmpiricalPriorPath, loadRegisterEmpiricalPrior });
}
