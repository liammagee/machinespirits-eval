import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TUTOR_STUB_STOCHASTIC_POLICY_IDS,
  sampleTutorStubPolicyDistribution,
  tutorStubPolicyDecisionMaterial,
  tutorStubPolicyRequiresDeterministicDraw,
} from '../tutorStubPolicySampler.js';

const distribution = [
  { register: 'plain', weight: 1, probability: 0.25 },
  { register: 'precise', weight: 3, probability: 0.75 },
];

const context = {
  runSeed: 31,
  profile: 'diligent',
  policy: 'field',
  repeat: 2,
  learnerTurn: 4,
  decisionKind: 'engagement_stance',
  jobId: 'diligent-field-r2',
};

test('tutor-stub policy draws are stable and retain complete replay material', () => {
  const first = sampleTutorStubPolicyDistribution(distribution, context);
  const second = sampleTutorStubPolicyDistribution(distribution, context);
  assert.deepEqual(first, second);
  assert.equal(first.entry.register, first.audit.selectedValue);
  assert.equal(first.audit.material.profile, 'diligent');
  assert.equal(first.audit.material.learnerTurn, 4);
  assert.equal(first.audit.distribution.length, 2);
  assert.equal(first.audit.decision.masterSeed, context.runSeed);
  assert.deepEqual(first.audit.decision.material, first.audit.material);
  assert.ok(first.audit.draw >= 0 && first.audit.draw < 1);
});

test('the stochastic-policy registry matches the policies that invoke the seeded sampler', () => {
  for (const policy of TUTOR_STUB_STOCHASTIC_POLICY_IDS) {
    assert.equal(tutorStubPolicyRequiresDeterministicDraw(policy), true, policy);
  }
  for (const policy of ['bland', 'dynamic', 'continuous_dynamical_system', 'continuous_empirical_dynamical_system']) {
    assert.equal(tutorStubPolicyRequiresDeterministicDraw(policy), false, policy);
  }
});

test('every experimental identity dimension participates in the draw key', () => {
  const variants = [
    context,
    { ...context, runSeed: 32 },
    { ...context, profile: 'skeptical' },
    { ...context, policy: 'trajectory' },
    { ...context, repeat: 3 },
    { ...context, learnerTurn: 5 },
    { ...context, decisionKind: 'negative_floor' },
    { ...context, jobId: 'another-job' },
  ];
  const seeds = variants.map((variant) => sampleTutorStubPolicyDistribution(distribution, variant).audit.seed);
  assert.equal(new Set(seeds).size, variants.length);
});

test('draws are key-addressed and therefore independent of worker completion order', async () => {
  const jobs = Array.from({ length: 8 }, (_, index) => ({
    ...context,
    repeat: index + 1,
    jobId: `job-${index + 1}`,
  }));
  const forward = Object.fromEntries(
    jobs.map((job) => [job.jobId, sampleTutorStubPolicyDistribution(distribution, job).audit]),
  );
  const completedOutOfOrder = await Promise.all(
    jobs
      .slice()
      .reverse()
      .map(async (job) => [job.jobId, sampleTutorStubPolicyDistribution(distribution, job).audit]),
  );
  assert.deepEqual(Object.fromEntries(completedOutOfOrder), forward);
});

test('decision material rejects incomplete or non-replayable identities', () => {
  assert.throws(
    () => tutorStubPolicyDecisionMaterial({ profile: 'diligent', policy: 'field', repeat: 0, learnerTurn: 1 }),
    /repeat/u,
  );
  assert.throws(
    () => sampleTutorStubPolicyDistribution([{ register: 'plain', weight: 0 }], context),
    /positive weight/u,
  );
});
