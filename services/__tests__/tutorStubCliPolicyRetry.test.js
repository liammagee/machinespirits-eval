import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isTutorStubRetryableClaudeResponseFreeError,
  tutorStubCliPolicyRetryDecision,
  waitTutorStubCliPolicyRetryDelay,
} from '../tutorStubCliPolicyRetry.js';

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
  it('allows two delayed retries for an unknown transport/schema event', () => {
    const error = policyError([{ index: 3, event_type: 'unknown', item_type: null }]);
    const first = tutorStubCliPolicyRetryDecision(error);
    const second = tutorStubCliPolicyRetryDecision(error, { retryCount: 1 });
    const third = tutorStubCliPolicyRetryDecision(error, { retryCount: 2 });

    assert.equal(first.retry, true);
    assert.equal(first.reason, 'bounded_transport_or_schema_retry');
    assert.equal(first.delay_ms, 5000);
    assert.equal(second.retry, true);
    assert.equal(second.delay_ms, 15000);
    assert.equal(third.retry, false);
    assert.equal(third.reason, 'call_retry_limit_reached');
  });

  it('allows two bounded retries for an explicit failed Codex turn', () => {
    const error = {
      code: 'CLI_PROVIDER_TURN_FAILED',
      provider: 'codex',
      audit: {
        policy: 'strict_no_tools_allowlist',
        prohibited_event_count: 0,
        prohibited_events: [],
        failure_event_count: 2,
        failure_events: [
          { index: 2, event_type: 'error', item_type: null },
          { index: 3, event_type: 'turn.failed', item_type: null },
        ],
      },
    };

    const first = tutorStubCliPolicyRetryDecision(error);
    const second = tutorStubCliPolicyRetryDecision(error, { retryCount: 1 });
    const third = tutorStubCliPolicyRetryDecision(error, { retryCount: 2 });

    assert.equal(first.retry, true);
    assert.equal(first.audit.failure_event_count, 2);
    assert.equal(second.retry, true);
    assert.equal(third.retry, false);
  });

  it('never retries a known tool event', () => {
    const error = policyError([{ index: 2, event_type: 'item.started', item_type: 'mcp_tool_call' }]);
    const decision = tutorStubCliPolicyRetryDecision(error);

    assert.equal(decision.retry, false);
    assert.equal(decision.reason, 'known_tool_event_refused');
  });

  it('retries exact Claude exit-code-one failures only under the explicit successor-V3 opt-in', () => {
    const error = {
      code: 'CLI_PROVIDER_EXIT_FAILED',
      exitCode: 1,
      stdoutBytes: 0,
      stderrBytes: 128,
    };
    assert.equal(tutorStubCliPolicyRetryDecision(error).retry, false);
    const first = tutorStubCliPolicyRetryDecision(error, { allowClaudeExitFailureCodeOne: true });
    const second = tutorStubCliPolicyRetryDecision(error, {
      allowClaudeExitFailureCodeOne: true,
      retryCount: 1,
    });
    const third = tutorStubCliPolicyRetryDecision(error, {
      allowClaudeExitFailureCodeOne: true,
      retryCount: 2,
    });
    assert.deepEqual(
      [first.retry, first.delay_ms, second.retry, second.delay_ms, third.retry, third.delay_ms],
      [true, 5000, true, 15000, false, 0],
    );
    assert.equal(
      tutorStubCliPolicyRetryDecision({ ...error, exitCode: 2 }, { allowClaudeExitFailureCodeOne: true }).retry,
      false,
    );
    assert.equal(
      tutorStubCliPolicyRetryDecision({ ...error, stdoutBytes: 1 }, { allowClaudeExitFailureCodeOne: true }).retry,
      false,
    );
  });

  it('retries exact Claude JSON response-free errors only under the prospective opt-in', () => {
    const error = {
      code: 'CLI_PROVIDER_RESPONSE_FREE_ERROR',
      provider: 'claude-code',
      classification: 'response_free_error',
      responseFree: true,
      exitCode: 1,
      stdoutBytes: 165,
      stderrBytes: 0,
      stdoutSha256: 'a'.repeat(64),
      stderrSha256: 'b'.repeat(64),
    };
    assert.equal(isTutorStubRetryableClaudeResponseFreeError(error), true);
    assert.equal(tutorStubCliPolicyRetryDecision(error).retry, false);
    const first = tutorStubCliPolicyRetryDecision(error, { allowClaudeResponseFreeError: true });
    const second = tutorStubCliPolicyRetryDecision(error, {
      allowClaudeResponseFreeError: true,
      retryCount: 1,
    });
    const third = tutorStubCliPolicyRetryDecision(error, {
      allowClaudeResponseFreeError: true,
      retryCount: 2,
    });
    assert.deepEqual(
      [first.retry, first.delay_ms, second.retry, second.delay_ms, third.retry, third.delay_ms],
      [true, 5000, true, 15000, false, 0],
    );
    for (const mutation of [
      { responseFree: false },
      { classification: 'indeterminate' },
      { stdoutBytes: 0 },
      { stdoutSha256: null },
      { stderrSha256: 'not-a-digest' },
    ]) {
      assert.equal(
        tutorStubCliPolicyRetryDecision({ ...error, ...mutation }, { allowClaudeResponseFreeError: true }).retry,
        false,
      );
    }
  });

  it('retains only the bridge audit labels and counts', () => {
    const error = policyError([
      { index: 1, event_type: 'unknown', item_type: 'unknown', raw_payload: 'SECRET-CANARY' },
    ]);
    const decision = tutorStubCliPolicyRetryDecision(error);

    assert.doesNotMatch(JSON.stringify(decision), /SECRET-CANARY/u);
    assert.deepEqual(decision.audit.prohibited_events, [{ index: 1, event_type: 'unknown', item_type: 'unknown' }]);
  });

  it('makes retry waiting abort-aware', async () => {
    const controller = new AbortController();
    controller.abort();

    await assert.rejects(
      waitTutorStubCliPolicyRetryDelay(5000, { signal: controller.signal }),
      (error) => error.name === 'AbortError',
    );
  });
});
