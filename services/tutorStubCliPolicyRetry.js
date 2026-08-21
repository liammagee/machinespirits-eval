export const TUTOR_STUB_CLI_POLICY_RETRY_SCHEMA = 'machinespirits.tutor-stub.cli-policy-retry.v2';

export const TUTOR_STUB_CLI_POLICY_RETRY_DELAYS_MS = Object.freeze([5000, 15000]);

const KNOWN_TOOL_TYPES = new Set([
  'command_execution',
  'file_change',
  'function_call',
  'mcp_tool_call',
  'tool_call',
  'web_search',
]);

function finiteCount(value) {
  const count = Number(value || 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function safeAudit(audit = null) {
  const source = audit && typeof audit === 'object' ? audit : {};
  return {
    policy: String(source.policy || 'unknown'),
    prohibited_event_count: finiteCount(source.prohibited_event_count),
    invalid_jsonl_line_count: finiteCount(source.invalid_jsonl_line_count),
    prohibited_events: (Array.isArray(source.prohibited_events) ? source.prohibited_events : []).map((event) => ({
      index: Number.isInteger(event?.index) ? event.index : null,
      event_type: String(event?.event_type || 'unknown'),
      item_type: event?.item_type ? String(event.item_type) : null,
      ...(finiteCount(event?.count) ? { count: finiteCount(event.count) } : {}),
    })),
    failure_event_count: finiteCount(source.failure_event_count),
    failure_events: (Array.isArray(source.failure_events) ? source.failure_events : []).map((event) => ({
      index: Number.isInteger(event?.index) ? event.index : null,
      event_type: String(event?.event_type || 'unknown'),
      item_type: event?.item_type ? String(event.item_type) : null,
    })),
  };
}

export function isTutorStubRetryableClaudeExitFailure(error) {
  return error?.code === 'CLI_PROVIDER_EXIT_FAILED' && error?.exitCode === 1 && error?.stdoutBytes === 0;
}

/**
 * Permit two delayed re-dispatches only for Codex transport/schema failures.
 * Known tool events remain terminal. The caller must reserve metered/provider
 * budget again for the retry and keep the normal strict audit on that call.
 */
export function tutorStubCliPolicyRetryDecision(error, { retryCount = 0, allowClaudeExitFailureCodeOne = false } = {}) {
  const audit = safeAudit(error?.audit);
  const used = Number.isInteger(retryCount) && retryCount > 0 ? retryCount : 0;
  const knownToolEvent = audit.prohibited_events.some(
    (event) => KNOWN_TOOL_TYPES.has(event.event_type) || KNOWN_TOOL_TYPES.has(event.item_type),
  );
  const policyViolation = error?.code === 'CLI_PROVIDER_POLICY_VIOLATION' && error?.provider === 'codex';
  const failedTurn = error?.code === 'CLI_PROVIDER_TURN_FAILED' && error?.provider === 'codex';
  const claudeExitFailure = allowClaudeExitFailureCodeOne === true && isTutorStubRetryableClaudeExitFailure(error);
  const retryableFailure = policyViolation || failedTurn || claudeExitFailure;
  const retry = Boolean(retryableFailure && used < TUTOR_STUB_CLI_POLICY_RETRY_DELAYS_MS.length && !knownToolEvent);
  return {
    schema: TUTOR_STUB_CLI_POLICY_RETRY_SCHEMA,
    retry,
    reason: !retryableFailure
      ? 'not_codex_policy_violation'
      : used >= TUTOR_STUB_CLI_POLICY_RETRY_DELAYS_MS.length
        ? 'call_retry_limit_reached'
        : knownToolEvent
          ? 'known_tool_event_refused'
          : 'bounded_transport_or_schema_retry',
    retry_count: used,
    retry_limit: TUTOR_STUB_CLI_POLICY_RETRY_DELAYS_MS.length,
    delay_ms: retry ? TUTOR_STUB_CLI_POLICY_RETRY_DELAYS_MS[used] : 0,
    audit,
  };
}

export function waitTutorStubCliPolicyRetryDelay(delayMs, { signal = null } = {}) {
  const boundedDelayMs = Math.max(0, Number(delayMs) || 0);
  if (signal?.aborted) {
    const error = new Error('Tutor-stub CLI policy retry aborted');
    error.name = 'AbortError';
    return Promise.reject(error);
  }
  if (!boundedDelayMs) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', onAbort);
      const error = new Error('Tutor-stub CLI policy retry aborted');
      error.name = 'AbortError';
      reject(error);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort);
      resolve();
    }, boundedDelayMs);
    signal?.addEventListener?.('abort', onAbort, { once: true });
  });
}
