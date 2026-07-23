import { createHash } from 'node:crypto';

import { EvaluationAdmissionError } from './evalRequestAdmission.js';

export const HTTP_MODEL_WORK_ADMISSION_SCHEMA = 'http-model-work-admission-v1';
export const DEFAULT_HTTP_MAX_MODEL_CALLS = 48;

const POLICY_KINDS = new Set(['exact_test_plan', 'fixed_model_calls', 'bounded_session', 'bounded_process']);

// Source-of-truth inventory for HTTP routes that can allocate model or
// model-backed process work. Exact/fixed routes require per-request admission;
// session/process routes document the already-enforced server-side boundary.
export const HTTP_MODEL_WORK_ENDPOINT_POLICIES = Object.freeze([
  { method: 'POST', path: '/api/eval/run', kind: 'exact_test_plan', enforcement: 'eval_request_admission' },
  { method: 'POST', path: '/api/eval/compare', kind: 'exact_test_plan', enforcement: 'eval_request_admission' },
  { method: 'POST', path: '/api/eval/quick', kind: 'exact_test_plan', enforcement: 'route_middleware' },
  { method: 'GET', path: '/api/eval/stream/quick', kind: 'exact_test_plan', enforcement: 'route_middleware' },
  { method: 'POST', path: '/api/eval/matrix', kind: 'exact_test_plan', enforcement: 'route_middleware' },
  { method: 'GET', path: '/api/eval/stream/matrix', kind: 'exact_test_plan', enforcement: 'route_middleware' },
  { method: 'GET', path: '/api/eval/stream/run', kind: 'exact_test_plan', enforcement: 'route_middleware' },
  {
    method: 'GET',
    path: '/api/eval/stream/recognition-ab',
    kind: 'exact_test_plan',
    enforcement: 'route_middleware',
  },
  {
    method: 'POST',
    path: '/api/eval/prompts/recommend',
    kind: 'fixed_model_calls',
    enforcement: 'composite_admission',
  },
  { method: 'GET', path: '/api/eval/stream/interact', kind: 'fixed_model_calls', enforcement: 'route_middleware' },
  { method: 'POST', path: '/api/chat/assist', kind: 'fixed_model_calls', enforcement: 'route_middleware' },
  { method: 'POST', path: '/api/chat/learner-turn', kind: 'fixed_model_calls', enforcement: 'route_middleware' },
  { method: 'POST', path: '/api/chat/turn', kind: 'fixed_model_calls', enforcement: 'route_middleware' },
  { method: 'POST', path: '/api/eval/codex/sessions', kind: 'bounded_process', enforcement: 'codex_session_contract' },
  {
    method: 'POST',
    path: '/api/eval/codex/sessions/:id/input',
    kind: 'bounded_process',
    enforcement: 'codex_session_contract',
  },
  {
    method: 'POST',
    path: '/api/eval/codex/paper-bug-audit-session',
    kind: 'bounded_process',
    enforcement: 'codex_session_contract',
  },
  {
    method: 'POST',
    path: '/api/tutor-stub/sessions/:sessionId/steps',
    kind: 'bounded_session',
    enforcement: 'session_contract',
  },
  { method: 'POST', path: '/api/pilot/session/:id/turn', kind: 'bounded_session', enforcement: 'pilot_time_cap' },
  {
    method: 'POST',
    path: '/api/pilot/admin/session/:id/autoplay',
    kind: 'bounded_session',
    enforcement: 'admin_turn_and_usd_caps',
  },
]);

function fail(status, code, message, details) {
  throw new EvaluationAdmissionError(status, code, message, details);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function positiveSafeInteger(value, field) {
  if (typeof value !== 'number') fail(400, 'invalid_request_schema', `${field} must be a number`);
  if (!Number.isSafeInteger(value) || value <= 0) {
    fail(422, 'invalid_request_value', `${field} must be a positive safe integer`);
  }
  return value;
}

export function resolveHttpMaxModelCalls(env = process.env) {
  const raw = env?.HTTP_MAX_MODEL_CALLS;
  if (raw === undefined || raw === '') return DEFAULT_HTTP_MAX_MODEL_CALLS;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : DEFAULT_HTTP_MAX_MODEL_CALLS;
}

export function assertHttpModelWorkPolicyInventory(policies = HTTP_MODEL_WORK_ENDPOINT_POLICIES) {
  const seen = new Set();
  for (const policy of policies) {
    if (!policy || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(policy.method)) {
      throw new Error('HTTP model-work policy has an invalid method');
    }
    if (typeof policy.path !== 'string' || !policy.path.startsWith('/api/')) {
      throw new Error('HTTP model-work policy has an invalid path');
    }
    if (!POLICY_KINDS.has(policy.kind)) throw new Error(`Invalid HTTP model-work policy kind for ${policy.path}`);
    if (typeof policy.enforcement !== 'string' || !policy.enforcement) {
      throw new Error(`Missing HTTP model-work enforcement for ${policy.path}`);
    }
    const key = `${policy.method} ${policy.path}`;
    if (seen.has(key)) throw new Error(`Duplicate HTTP model-work policy: ${key}`);
    seen.add(key);
  }
  return true;
}

export function admitFixedModelCalls(
  input,
  {
    endpoint,
    plannedModelCallLimit,
    maxModelCalls = DEFAULT_HTTP_MAX_MODEL_CALLS,
    privilegedOverride = false,
    now = () => new Date().toISOString(),
  } = {},
) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    fail(400, 'invalid_request_schema', 'Request input must be an object');
  }
  if (input.dryRun !== undefined && typeof input.dryRun !== 'boolean') {
    fail(400, 'invalid_request_schema', 'dryRun must be a boolean');
  }
  if (input.allowOversizedPlan !== undefined && typeof input.allowOversizedPlan !== 'boolean') {
    fail(400, 'invalid_request_schema', 'allowOversizedPlan must be a boolean');
  }
  if (typeof endpoint !== 'string' || !endpoint.startsWith('/api/')) {
    fail(500, 'invalid_admission_configuration', 'A canonical API endpoint is required');
  }

  const planned = positiveSafeInteger(plannedModelCallLimit, 'plannedModelCallLimit');
  const ceiling = positiveSafeInteger(maxModelCalls, 'maxModelCalls');
  const ceilingOverridden = planned > ceiling && privilegedOverride === true;
  if (planned > ceiling && !ceilingOverridden) {
    fail(413, 'model_call_plan_too_large', `Planned model-call limit ${planned} exceeds server ceiling ${ceiling}`, {
      plannedModelCallLimit: planned,
      maxModelCalls: ceiling,
    });
  }

  const dryRun = input.dryRun === true;
  if (!dryRun && input.confirmModelCallLimit === undefined) {
    fail(428, 'model_call_confirmation_required', 'Non-dry-run requests must confirm the model-call limit', {
      plannedModelCallLimit: planned,
    });
  }
  if (!dryRun) {
    const confirmed = positiveSafeInteger(input.confirmModelCallLimit, 'confirmModelCallLimit');
    if (confirmed !== planned) {
      fail(422, 'model_call_confirmation_mismatch', 'confirmModelCallLimit does not match the admitted limit', {
        confirmedModelCallLimit: confirmed,
        plannedModelCallLimit: planned,
      });
    }
  }

  const basis = {
    schema: HTTP_MODEL_WORK_ADMISSION_SCHEMA,
    endpoint,
    kind: 'fixed_model_calls',
    plannedModelCallLimit: planned,
    maxModelCalls: ceiling,
    dryRun,
    confirmation: dryRun ? 'dry_run_exempt' : 'exact_call_limit',
    ceilingOverridden,
  };
  const requestHash = createHash('sha256').update(JSON.stringify(basis)).digest('hex');
  return deepFreeze({ ...basis, requestHash, admittedAt: now() });
}

export function createModelCallBudget(admissionPlan) {
  const limit = positiveSafeInteger(admissionPlan?.plannedModelCallLimit, 'plannedModelCallLimit');
  let used = 0;
  return Object.freeze({
    reserve(label = 'model_call') {
      if (used >= limit) {
        fail(409, 'model_call_budget_exhausted', `Model-call budget exhausted before ${label}`, {
          plannedModelCallLimit: limit,
          usedModelCalls: used,
        });
      }
      used += 1;
      return used;
    },
    snapshot() {
      return Object.freeze({ plannedModelCallLimit: limit, usedModelCalls: used, remainingModelCalls: limit - used });
    },
  });
}

assertHttpModelWorkPolicyInventory();
