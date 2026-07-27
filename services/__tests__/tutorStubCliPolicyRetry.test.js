import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { tutorStubCliPolicyRetryDecision } from '../tutorStubCliPolicyRetry.js';

function policyError(prohibitedEvents, extraAudit = {}) {
  return {
    code: 'CLI_PROVIDER_POLICY_VIOLATION',
    provider: 'codex',
    audit: {
      policy: 'strict_no_tools_allowlist',
      prohibited_event_count: prohibitedEvents.length,
      prohibited_events: prohibitedEvents,
      invalid_jsonl_line_count: 0,
      ...extraAudit,
    },
  };
}

describe('tutor-stub Codex policy retry', () => {
  it('allows one bounded retry for an unknown transport/schema event', () => {
    const error = policyError([{ index: 3, event_type: 'unknown', item_type: null }]);
    const first = tutorStubCliPolicyRetryDecision(error);
    const second = tutorStubCliPolicyRetryDecision(error, { alreadyUsed: true });

    assert.equal(first.retry, true);
    assert.equal(first.reason, 'bounded_transport_or_schema_retry');
    assert.equal(second.retry, false);
    assert.equal(second.reason, 'dialogue_retry_already_used');
  });

  it('never retries a known tool event', () => {
    const error = policyError([{ index: 2, event_type: 'item.started', item_type: 'mcp_tool_call' }]);
    const decision = tutorStubCliPolicyRetryDecision(error);

    assert.equal(decision.retry, false);
    assert.equal(decision.reason, 'known_tool_event_refused');
  });

  it('retains only the bridge audit labels and counts', () => {
    const error = policyError([
      { index: 1, event_type: 'unknown', item_type: 'unknown', raw_payload: 'SECRET-CANARY' },
    ]);
    const decision = tutorStubCliPolicyRetryDecision(error);

    assert.doesNotMatch(JSON.stringify(decision), /SECRET-CANARY/u);
    assert.deepEqual(decision.audit.prohibited_events, [{ index: 1, event_type: 'unknown', item_type: 'unknown' }]);
  });
});
