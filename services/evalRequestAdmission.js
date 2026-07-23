import { createHash, timingSafeEqual } from 'node:crypto';

export const EVAL_API_ADMISSION_SCHEMA = 'eval-api-admission-v1';
export const DEFAULT_EVAL_API_MAX_PLANNED_TESTS = 100;

export class EvaluationAdmissionError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'EvaluationAdmissionError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function fail(status, code, message, details) {
  throw new EvaluationAdmissionError(status, code, message, details);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function positiveSafeInteger(value, field, { malformedStatus = 400 } = {}) {
  if (typeof value !== 'number') {
    fail(malformedStatus, 'invalid_request_schema', `${field} must be a number`);
  }
  if (!Number.isSafeInteger(value) || value <= 0) {
    fail(422, 'invalid_request_value', `${field} must be a positive safe integer`);
  }
  return value;
}

function normalizeRegistryIds(values) {
  return new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => (typeof value === 'string' ? value : value?.id || value?.name))
      .filter((value) => typeof value === 'string' && value.length > 0),
  );
}

function normalizeUniqueIds(value, field, registry, { allowAll = false } = {}) {
  if (allowAll && value === 'all') return [...registry];
  if (!Array.isArray(value)) {
    fail(400, 'invalid_request_schema', `${field} must be a JSON array${allowAll ? ' or "all"' : ''}`);
  }
  if (value.length === 0) fail(422, 'invalid_request_value', `${field} must not be empty`);

  const ids = [];
  const seen = new Set();
  for (const raw of value) {
    if (typeof raw !== 'string') {
      fail(400, 'invalid_request_schema', `${field} entries must be strings`);
    }
    const id = raw.trim();
    if (!id) fail(422, 'invalid_request_value', `${field} entries must not be blank`);
    if (seen.has(id)) fail(422, 'duplicate_request_value', `${field} must contain unique entries`, { duplicate: id });
    seen.add(id);
    ids.push(id);
  }

  const unknown = ids.filter((id) => !registry.has(id));
  if (unknown.length > 0) {
    fail(422, 'unknown_registry_value', `${field} contains unknown entries`, { field, unknown });
  }
  return ids;
}

function exactPlannedTestCount(profileCount, scenarioCount, runsPerConfig) {
  const count = BigInt(profileCount) * BigInt(scenarioCount) * BigInt(runsPerConfig);
  if (count > BigInt(Number.MAX_SAFE_INTEGER)) {
    fail(413, 'evaluation_plan_too_large', 'Planned test count exceeds the safe integer range');
  }
  return Number(count);
}

export function resolveEvalApiMaxPlannedTests(env = process.env) {
  const raw = env?.EVAL_API_MAX_PLANNED_TESTS;
  if (raw === undefined || raw === '') return DEFAULT_EVAL_API_MAX_PLANNED_TESTS;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : DEFAULT_EVAL_API_MAX_PLANNED_TESTS;
}

export function hasEvalApiPrivilegedOverride(req, env = process.env) {
  if (req?.body?.allowOversizedPlan !== true) return false;
  const configured = String(env?.EVAL_API_OVERRIDE_TOKEN || '');
  const supplied = String(req?.get?.('x-eval-override-token') || req?.headers?.['x-eval-override-token'] || '');
  if (!configured || !supplied) return false;
  const configuredBytes = Buffer.from(configured);
  const suppliedBytes = Buffer.from(supplied);
  return configuredBytes.length === suppliedBytes.length && timingSafeEqual(configuredBytes, suppliedBytes);
}

export function admitEvaluationRequest(
  body,
  {
    profileRegistry,
    scenarioRegistry,
    minProfiles = 1,
    maxPlannedTests = DEFAULT_EVAL_API_MAX_PLANNED_TESTS,
    privilegedOverride = false,
    endpoint = '/api/eval/run',
    now = () => new Date().toISOString(),
  } = {},
) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    fail(400, 'invalid_request_schema', 'Request body must be a JSON object');
  }
  if (body.dryRun !== undefined && typeof body.dryRun !== 'boolean') {
    fail(400, 'invalid_request_schema', 'dryRun must be a boolean');
  }
  if (body.skipRubric !== undefined && typeof body.skipRubric !== 'boolean') {
    fail(400, 'invalid_request_schema', 'skipRubric must be a boolean');
  }
  if (body.allowOversizedPlan !== undefined && typeof body.allowOversizedPlan !== 'boolean') {
    fail(400, 'invalid_request_schema', 'allowOversizedPlan must be a boolean');
  }

  const profilesAvailable = normalizeRegistryIds(profileRegistry);
  const scenariosAvailable = normalizeRegistryIds(scenarioRegistry);
  if (profilesAvailable.size === 0 || scenariosAvailable.size === 0) {
    fail(503, 'evaluation_registry_unavailable', 'Evaluation registries are unavailable');
  }

  const profiles = normalizeUniqueIds(body.profiles, 'profiles', profilesAvailable);
  if (profiles.length < minProfiles) {
    fail(422, 'insufficient_profiles', `At least ${minProfiles} unique profiles are required`);
  }
  const scenarios = normalizeUniqueIds(body.scenarios ?? 'all', 'scenarios', scenariosAvailable, { allowAll: true });
  const runsPerConfig = positiveSafeInteger(body.runsPerConfig ?? 1, 'runsPerConfig');
  const effectiveMax = positiveSafeInteger(maxPlannedTests, 'maxPlannedTests');
  const plannedTestCount = exactPlannedTestCount(profiles.length, scenarios.length, runsPerConfig);
  const ceilingOverridden = plannedTestCount > effectiveMax && privilegedOverride === true;
  if (plannedTestCount > effectiveMax && !ceilingOverridden) {
    fail(
      413,
      'evaluation_plan_too_large',
      `Planned test count ${plannedTestCount} exceeds server ceiling ${effectiveMax}`,
      {
        plannedTestCount,
        maxPlannedTests: effectiveMax,
      },
    );
  }

  const dryRun = body.dryRun === true;
  if (!dryRun && body.confirmTestCount === undefined) {
    fail(428, 'evaluation_confirmation_required', 'Non-dry-run requests must confirm the exact planned test count', {
      plannedTestCount,
    });
  }
  if (!dryRun) {
    const confirmed = positiveSafeInteger(body.confirmTestCount, 'confirmTestCount');
    if (confirmed !== plannedTestCount) {
      fail(422, 'evaluation_confirmation_mismatch', 'confirmTestCount does not match the admitted plan', {
        confirmedTestCount: confirmed,
        plannedTestCount,
      });
    }
  }

  const planBasis = {
    schema: EVAL_API_ADMISSION_SCHEMA,
    endpoint,
    profiles,
    scenarios,
    runsPerConfig,
    plannedTestCount,
    maxPlannedTests: effectiveMax,
    dryRun,
    skipRubric: body.skipRubric === true,
    confirmation: dryRun ? 'dry_run_exempt' : 'exact_count',
    ceilingOverridden,
  };
  const requestHash = createHash('sha256').update(JSON.stringify(planBasis)).digest('hex');
  const admissionPlan = deepFreeze({ ...planBasis, requestHash, admittedAt: now() });

  return deepFreeze({
    profiles: [...profiles],
    scenarios: [...scenarios],
    runsPerConfig,
    dryRun,
    skipRubric: body.skipRubric === true,
    plannedTestCount,
    admissionPlan,
  });
}
