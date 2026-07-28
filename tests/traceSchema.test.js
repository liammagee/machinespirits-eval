import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  captureTutorStubRunProvenance,
  learnerDeliberationTraceAgent,
  learnerTraceStage,
  projectLearnerDeliberationTrace,
  redactTraceSecrets,
  TRACE_SCHEMA_VERSION,
  TUTOR_STUB_RUN_PROVENANCE_SCHEMA,
} from '../services/traceSchema.js';

const DELIBERATION = [
  { role: 'ego', stage: 'initial', content: 'First reaction.', metrics: { model: 'test-ego' } },
  { role: 'superego', stage: 'critique', content: 'Review it.', metrics: { model: 'test-superego' } },
  { role: 'ego', stage: 'adjudication', content: 'Revised reaction.', metrics: { model: 'test-ego' } },
];

describe('trace secret redaction', () => {
  it('redacts normalized secret keys, API-key strings, arrays, and cycles without mutating input', () => {
    const shared = { safe: 'value' };
    const input = {
      api_key: 'not-even-key-shaped',
      nested: {
        Authorization: 'Bearer private',
        tokenLike: 'sk-abcdefghijklmnop',
        ordinary: 'sk-short',
      },
      array: [shared, shared],
    };
    input.self = input;

    assert.deepEqual(redactTraceSecrets(input), {
      api_key: '[redacted]',
      nested: {
        Authorization: '[redacted]',
        tokenLike: '[redacted]',
        ordinary: 'sk-short',
      },
      array: [{ safe: 'value' }, { safe: 'value' }],
      self: '[circular]',
    });
    assert.equal(input.api_key, 'not-even-key-shaped');
    assert.equal(input.self, input);
  });

  it('preserves null, undefined, primitive, and non-secret string values', () => {
    assert.equal(redactTraceSecrets(null), null);
    assert.equal(redactTraceSecrets(undefined), undefined);
    assert.equal(redactTraceSecrets(7), 7);
    assert.equal(redactTraceSecrets('public'), 'public');
  });
});

describe('tutor-stub run provenance', () => {
  it('captures the resolved-config hash and Git summary with the canonical schema', () => {
    const metadata = { model: 'test' };
    assert.deepEqual(
      captureTutorStubRunProvenance(metadata, {
        hashCanonicalJson: (value) => {
          assert.equal(value, metadata);
          return 'config-hash';
        },
        captureGitProvenanceSummary: ({ repoRoot }) => ({ repoRoot, sha: 'abc123' }),
        repoRoot: '/repo',
      }),
      {
        schema: TUTOR_STUB_RUN_PROVENANCE_SCHEMA,
        configSha256: 'config-hash',
        git: { repoRoot: '/repo', sha: 'abc123' },
      },
    );
  });

  it('records independent hash and Git errors without blocking provenance creation', () => {
    assert.deepEqual(
      captureTutorStubRunProvenance(null, {
        hashCanonicalJson: () => {
          throw new Error('hash unavailable');
        },
        captureGitProvenanceSummary: () => {
          throw 'git unavailable';
        },
      }),
      {
        schema: TUTOR_STUB_RUN_PROVENANCE_SCHEMA,
        configSha256: null,
        git: null,
        configHashError: 'hash unavailable',
        gitError: 'git unavailable',
      },
    );
  });
});

describe('learner trace schema v2', () => {
  it('emits the exact symmetric learner sequence', () => {
    const trace = projectLearnerDeliberationTrace({
      internalDeliberation: DELIBERATION,
      finalMessage: 'Public learner response.',
      turnIndex: 2,
      timestamp: '2026-07-23T00:00:00.000Z',
    });

    assert.deepEqual(
      trace.map((entry) => `${entry.agent}/${entry.action}`),
      [
        'learner_ego_initial/deliberation',
        'learner_superego/deliberation',
        'learner_ego_revision/deliberation',
        'learner/final_output',
      ],
    );
    assert.ok(trace.every((entry) => entry.traceSchemaVersion === TRACE_SCHEMA_VERSION));
    assert.ok(trace.every((entry) => entry.turnIndex === 2));
  });

  it('maps actual role plus stage metadata instead of collapsing both ego calls', () => {
    assert.equal(learnerDeliberationTraceAgent({ role: 'ego', stage: 'initial' }), 'learner_ego_initial');
    assert.equal(learnerDeliberationTraceAgent({ role: 'ego', stage: 'adjudication' }), 'learner_ego_revision');
  });

  it('classifies historical learner_ego entries without rewriting stored logs', () => {
    const legacyTrace = [
      { agent: 'learner_ego', action: 'deliberation', turnIndex: 1, detail: 'Initial.' },
      { agent: 'learner_superego', action: 'deliberation', turnIndex: 1, detail: 'Review.' },
      { agent: 'learner_ego', action: 'deliberation', turnIndex: 1, detail: 'Revision.' },
      { agent: 'learner', action: 'final_output', turnIndex: 1, detail: 'Final.' },
    ];

    assert.deepEqual(
      legacyTrace.map((entry, index) => learnerTraceStage(entry, legacyTrace, index)),
      ['initial', 'review', 'revision', 'final'],
    );
  });
});
