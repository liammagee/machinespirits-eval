import assert from 'node:assert/strict';
import test from 'node:test';

import { projectTutorStubGuardAttemptEnvelope } from '../services/tutorStubGuardAttemptProjection.js';

test('guard attempt projection preserves candidate, audit, generation, and span contracts', () => {
  const usage = { inputTokens: 4, nested: { cost: 0.01 } };
  const deliveryConfiguration = { engagement_stance: 'plain' };
  const transition = { from: 'precise', to: 'plain' };
  const audits = { deliveryOk: false, issues: ['unsafe'] };
  const repairedSpans = [{ original: { start: 1, end: 2 } }];
  const envelope = projectTutorStubGuardAttemptEnvelope({
    kind: 'repair_candidate',
    attempt: 2,
    response: {
      text: 'Unsafe clue',
      provider: 'test',
      model: 'fixture',
      guardCallId: 'call-2',
      guardRole: 'repair',
      latencyMs: '12',
      usage,
      tokenUsageAvailable: true,
      recoveryCandidateKind: 'plain_recovery',
      recoveryStrategy: { strategy: 'simplify' },
      deliveryResponseConfiguration: deliveryConfiguration,
      responseConfigurationTransition: transition,
    },
    audits,
    issues: [{ guard: 'evidence', type: 'leak', matches: ['Unsafe clue'] }],
    repairedSpans,
  });

  assert.deepEqual(envelope, {
    kind: 'repair_candidate',
    attempt: 2,
    provider: 'test',
    model: 'fixture',
    deliveryConfiguration,
    configurationTransition: transition,
    candidate: {
      start: 0,
      end: 11,
      text: 'Unsafe clue',
      offsetEncoding: 'utf16_code_units',
    },
    audits,
    auditOk: false,
    generation: {
      callId: 'call-2',
      role: 'repair',
      latencyMs: 12,
      usage,
      tokenUsageAvailable: true,
      candidateKind: 'plain_recovery',
      strategy: 'simplify',
    },
    guardedSpans: [
      {
        guard: 'evidence',
        issueType: 'leak',
        reason: null,
        start: 0,
        end: 11,
        text: 'Unsafe clue',
        offsetEncoding: 'utf16_code_units',
        basis: 'literal_audit_match',
      },
    ],
    repairedSpans,
  });

  usage.nested.cost = 9;
  deliveryConfiguration.engagement_stance = 'changed';
  transition.to = 'changed';
  assert.equal(envelope.generation.usage.nested.cost, 0.01);
  assert.equal(envelope.deliveryConfiguration.engagement_stance, 'plain');
  assert.equal(envelope.configurationTransition.to, 'plain');
});

test('guard attempt projection preserves empty and recovery-batch defaults', () => {
  assert.deepEqual(projectTutorStubGuardAttemptEnvelope({ kind: 'original_candidate', attempt: 0, response: null }), {
    kind: 'original_candidate',
    attempt: 0,
    provider: null,
    model: null,
    deliveryConfiguration: null,
    configurationTransition: null,
    candidate: { start: 0, end: 0, text: '', offsetEncoding: 'utf16_code_units' },
    audits: null,
    auditOk: null,
    generation: {
      callId: null,
      role: null,
      latencyMs: 0,
      usage: null,
      tokenUsageAvailable: null,
    },
    guardedSpans: [],
    repairedSpans: [],
  });

  const batch = projectTutorStubGuardAttemptEnvelope({
    kind: 'repair_candidate',
    attempt: 1,
    response: { text: 'Safe', recoveryBatch: { batchSize: 3 } },
  });
  assert.equal(batch.generation.candidateKind, 'repair_candidate');
  assert.equal(batch.generation.batchSize, 3);
});
