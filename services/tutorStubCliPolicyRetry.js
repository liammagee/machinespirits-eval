export const TUTOR_STUB_CLI_POLICY_RETRY_SCHEMA = 'machinespirits.tutor-stub.cli-policy-retry.v1';

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
  };
}

/**
 * Permit one re-dispatch only for Codex JSONL framing/schema violations.
 * Known tool events remain terminal. The caller must reserve metered/provider
 * budget again for the retry and keep the normal strict audit on that call.
 */
export function tutorStubCliPolicyRetryDecision(error, { alreadyUsed = false } = {}) {
  const audit = safeAudit(error?.audit);
  const knownToolEvent = audit.prohibited_events.some(
    (event) => KNOWN_TOOL_TYPES.has(event.event_type) || KNOWN_TOOL_TYPES.has(event.item_type),
  );
  const policyViolation = error?.code === 'CLI_PROVIDER_POLICY_VIOLATION' && error?.provider === 'codex';
  const retry = Boolean(policyViolation && !alreadyUsed && !knownToolEvent);
  return {
    schema: TUTOR_STUB_CLI_POLICY_RETRY_SCHEMA,
    retry,
    reason: !policyViolation
      ? 'not_codex_policy_violation'
      : alreadyUsed
        ? 'dialogue_retry_already_used'
        : knownToolEvent
          ? 'known_tool_event_refused'
          : 'bounded_transport_or_schema_retry',
    audit,
  };
}
