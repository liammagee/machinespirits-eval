import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  appendRunEvent,
  assertExperimentRun,
  buildExperimentRunPlan,
  canonicalJson,
  captureGitFingerprint,
  createRunPlan,
  createRunSeal,
  deriveDeterministicSeed,
  deterministicChoice,
  EXPERIMENT_RANDOM_DRAW_CONTRACT_SCHEMA,
  hashCanonicalJson,
  replayRunRandomization,
  tutorStubTraceModelRole,
  verifyExperimentRun,
} from '../experimentRunArtifacts.js';

function requiredHashes() {
  return Object.fromEntries(
    ['runner', 'analyzer', 'policy', 'profile', 'prompt', 'world', 'config'].map((kind) => [
      kind,
      hashCanonicalJson({ kind, version: 1 }),
    ]),
  );
}

function planFixture(overrides = {}) {
  return buildExperimentRunPlan({
    runId: 'mock-qa-001',
    createdAt: '2026-07-11T00:00:00.000Z',
    runner: 'tutor-stub-qa',
    provenance: {
      git: {
        sha: '0123456789abcdef',
        branch: 'codex/adaptive-tutor-implementation',
        dirty: false,
        fingerprintSha256: hashCanonicalJson({ clean: true }),
      },
    },
    models: {
      tutor: { requested: 'mock.tutor', resolved: 'mock.tutor', observed: 'mock.tutor' },
      analyzer: { requested: 'mock.analyzer', resolved: 'mock.analyzer', observed: 'mock.analyzer' },
      learner: { requested: 'mock.learner', resolved: 'mock.learner', observed: 'mock.learner' },
    },
    hashes: requiredHashes(),
    masterSeed: 17,
    jobs: [
      { id: 'diligent-field-r1', profile: 'diligent', policy: 'field', repeat: 1 },
      { id: 'skeptical-bland-r1', profile: 'skeptical', policy: 'bland', repeat: 1 },
    ],
    requiredObservedModelRoles: [],
    lineage: { parentRunId: null, resumeOf: null, supersedes: [] },
    ...overrides,
  });
}

test('canonical JSON and hashes ignore object insertion order but preserve array order', () => {
  const left = { z: 3, nested: { b: 2, a: 1 }, rows: ['first', 'second'] };
  const right = { rows: ['first', 'second'], nested: { a: 1, b: 2 }, z: 3 };
  assert.equal(canonicalJson(left), canonicalJson(right));
  assert.equal(hashCanonicalJson(left), hashCanonicalJson(right));
  assert.notEqual(hashCanonicalJson(left), hashCanonicalJson({ ...right, rows: ['second', 'first'] }));
});

test('seed derivation and weighted choices are stable, inspectable, and divergent', () => {
  const material = {
    profile: 'diligent',
    policy: 'field',
    repeat: 1,
    learnerTurn: 4,
    decisionKind: 'engagement_stance',
  };
  assert.equal(deriveDeterministicSeed(17, material), deriveDeterministicSeed(17, material));
  assert.notEqual(deriveDeterministicSeed(17, material), deriveDeterministicSeed(18, material));

  const distribution = [
    { value: 'plain', weight: 2 },
    { value: 'warm', weight: 1 },
    { value: 'precise', weight: 3 },
  ];
  const first = deterministicChoice(distribution, { masterSeed: 17, material });
  const second = deterministicChoice(distribution, { masterSeed: 17, material });
  assert.deepEqual(first, second);
  assert.equal(
    first.distribution.reduce((sum, row) => sum + row.probability, 0),
    1,
  );
  assert.equal(first.selectedValue, first.distribution[first.selectedIndex].value);
  assert.ok(first.draw >= 0 && first.draw < 1);
  assert.deepEqual(first.material, material);
});

test('run plans and seals are write-once, events append, and sealed runs verify and replay', () => {
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'experiment-artifacts-'));
  try {
    const plan = planFixture({
      metadata: {
        randomDrawContract: {
          schema: EXPERIMENT_RANDOM_DRAW_CONTRACT_SCHEMA,
          requiredJobIds: ['diligent-field-r1'],
          minimumPerJob: 1,
        },
      },
    });
    const planWrite = createRunPlan(runDir, plan);
    assert.ok(fs.existsSync(planWrite.path));
    assert.throws(() => createRunPlan(runDir, plan), /Refusing to overwrite immutable run plan/u);

    const started = appendRunEvent(runDir, {
      type: 'run_started',
      recordedAt: '2026-07-11T00:00:01.000Z',
    });
    const prefix = fs.readFileSync(started.path, 'utf8');
    const decision = deterministicChoice(
      [
        { value: 'plain', weight: 1 },
        { value: 'precise', weight: 2 },
      ],
      {
        masterSeed: plan.randomization.masterSeed,
        material: {
          profile: 'diligent',
          policy: 'field',
          repeat: 1,
          learnerTurn: 1,
          decisionKind: 'engagement_stance',
          jobId: 'diligent-field-r1',
        },
      },
    );
    appendRunEvent(runDir, {
      type: 'random_draw',
      jobId: 'diligent-field-r1',
      recordedAt: '2026-07-11T00:00:02.000Z',
      decision,
    });
    assert.ok(fs.readFileSync(started.path, 'utf8').startsWith(prefix));

    fs.writeFileSync(
      path.join(runDir, 'mock-result.json'),
      `${JSON.stringify({ schema: 'machinespirits.mock-result.v1', ok: true })}\n`,
    );
    const sealWrite = createRunSeal(runDir, {
      closedAt: '2026-07-11T00:00:03.000Z',
      status: 'complete',
    });
    assert.ok(fs.existsSync(sealWrite.path));
    assert.throws(() => createRunSeal(runDir), /Refusing to overwrite immutable run seal/u);
    assert.throws(() => appendRunEvent(runDir, { type: 'late_event' }), /already sealed/u);

    const verification = verifyExperimentRun(runDir);
    assert.equal(verification.ok, true, verification.errors.join('\n'));
    assert.equal(verification.eventCount, 2);
    assert.equal(verification.inventory.length, 3);

    const replay = replayRunRandomization(runDir);
    assert.equal(replay.ok, true, replay.errors.join('\n'));
    assert.deepEqual(replay.jobOrder, ['diligent-field-r1', 'skeptical-bland-r1']);
    assert.equal(replay.decisions.length, 1);
    assert.equal(replay.decisions[0].matches, true);
  } finally {
    fs.rmSync(runDir, { recursive: true, force: true });
  }
});

test('a declared stochastic job fails replay when no runtime draw was recorded', () => {
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'experiment-missing-draw-'));
  try {
    createRunPlan(
      runDir,
      planFixture({
        metadata: {
          randomDrawContract: {
            schema: EXPERIMENT_RANDOM_DRAW_CONTRACT_SCHEMA,
            requiredJobIds: ['diligent-field-r1'],
            minimumPerJob: 1,
          },
        },
      }),
    );
    appendRunEvent(runDir, { type: 'run_started', recordedAt: '2026-07-11T00:00:01.000Z' });
    createRunSeal(runDir, { closedAt: '2026-07-11T00:00:02.000Z' });
    const verification = verifyExperimentRun(runDir);
    assert.equal(verification.ok, false);
    assert.match(verification.errors.join('\n'), /random draw contract missing decisions for diligent-field-r1/u);
  } finally {
    fs.rmSync(runDir, { recursive: true, force: true });
  }
});

test('exemptDrawContractJobIds waives the draw minimum only for the named rerun rows', () => {
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'experiment-resume-exempt-'));
  try {
    createRunPlan(
      runDir,
      planFixture({
        metadata: {
          randomDrawContract: {
            schema: EXPERIMENT_RANDOM_DRAW_CONTRACT_SCHEMA,
            requiredJobIds: ['diligent-field-r1', 'skeptical-bland-r1'],
            minimumPerJob: 1,
          },
        },
      }),
    );
    appendRunEvent(runDir, { type: 'run_started', recordedAt: '2026-07-11T00:00:01.000Z' });
    createRunSeal(runDir, { closedAt: '2026-07-11T00:00:02.000Z' });

    // Both stochastic rows are drawless (a window-killed source), so the bare
    // check fails on both.
    const bare = verifyExperimentRun(runDir);
    assert.equal(bare.ok, false);
    assert.match(bare.errors.join('\n'), /diligent-field-r1/u);
    assert.match(bare.errors.join('\n'), /skeptical-bland-r1/u);

    // Exempting exactly the rows queued for rerun clears the source.
    const exempted = verifyExperimentRun(runDir, {
      exemptDrawContractJobIds: new Set(['diligent-field-r1', 'skeptical-bland-r1']),
    });
    assert.equal(exempted.ok, true);

    // A partial exemption stays precise: the non-exempt row still fails.
    const partial = verifyExperimentRun(runDir, {
      exemptDrawContractJobIds: new Set(['diligent-field-r1']),
    });
    assert.equal(partial.ok, false);
    assert.doesNotMatch(partial.errors.join('\n'), /diligent-field-r1/u);
    assert.match(partial.errors.join('\n'), /random draw contract missing decisions for skeptical-bland-r1/u);
  } finally {
    fs.rmSync(runDir, { recursive: true, force: true });
  }
});

test('integrity-only verification tolerates unmet presence contracts but never tampering', () => {
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'experiment-integrity-only-'));
  try {
    createRunPlan(
      runDir,
      planFixture({
        requiredObservedModelRoles: ['tutor', 'analyzer', 'learner'],
        metadata: {
          randomDrawContract: {
            schema: EXPERIMENT_RANDOM_DRAW_CONTRACT_SCHEMA,
            requiredJobIds: ['diligent-field-r1'],
            minimumPerJob: 1,
          },
        },
      }),
    );
    appendRunEvent(runDir, { type: 'run_started', recordedAt: '2026-07-13T00:00:01.000Z' });
    createRunSeal(runDir, { closedAt: '2026-07-13T00:00:02.000Z', status: 'incomplete' });

    const full = verifyExperimentRun(runDir);
    assert.equal(full.ok, false);
    assert.match(full.errors.join('\n'), /random draw contract missing decisions for diligent-field-r1/u);
    assert.match(full.errors.join('\n'), /missing observed model provenance for role tutor/u);

    const integrityOnly = verifyExperimentRun(runDir, { completeness: false });
    assert.equal(integrityOnly.ok, true, integrityOnly.errors.join('\n'));
    assert.equal(assertExperimentRun(runDir, { completeness: false }).ok, true);

    const eventsPath = path.join(runDir, 'run-events.jsonl');
    fs.writeFileSync(eventsPath, fs.readFileSync(eventsPath, 'utf8').replace('run_started', 'run_tampered'));
    const tampered = verifyExperimentRun(runDir, { completeness: false });
    assert.equal(tampered.ok, false);
    assert.match(tampered.errors.join('\n'), /checksum mismatch/u);
    assert.throws(() => assertExperimentRun(runDir, { completeness: false }), /verification failed/u);
  } finally {
    fs.rmSync(runDir, { recursive: true, force: true });
  }
});

test('integrity-only verification still replays every recorded draw', () => {
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'experiment-integrity-draws-'));
  try {
    const plan = planFixture();
    createRunPlan(runDir, plan);
    const decision = deterministicChoice(
      [
        { value: 'plain', weight: 1 },
        { value: 'precise', weight: 2 },
      ],
      {
        masterSeed: plan.randomization.masterSeed,
        material: {
          profile: 'diligent',
          policy: 'field',
          repeat: 1,
          learnerTurn: 1,
          decisionKind: 'engagement_stance',
          jobId: 'diligent-field-r1',
        },
      },
    );
    const corrupted = {
      ...decision,
      selectedIndex: (decision.selectedIndex + 1) % decision.distribution.length,
      selectedValue: decision.distribution[(decision.selectedIndex + 1) % decision.distribution.length].value,
    };
    appendRunEvent(runDir, {
      type: 'random_draw',
      jobId: 'diligent-field-r1',
      recordedAt: '2026-07-13T00:00:01.000Z',
      decision: corrupted,
    });
    createRunSeal(runDir, { closedAt: '2026-07-13T00:00:02.000Z', status: 'incomplete' });

    const integrityOnly = verifyExperimentRun(runDir, { completeness: false });
    assert.equal(integrityOnly.ok, false);
    assert.match(integrityOnly.errors.join('\n'), /random draw mismatch at event 1/u);
  } finally {
    fs.rmSync(runDir, { recursive: true, force: true });
  }
});

test('integrity-only verification threads into nested child runs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'experiment-integrity-nested-'));
  const child = path.join(root, 'child');
  try {
    createRunPlan(
      child,
      planFixture({
        runId: 'child-run',
        jobs: [{ id: 'field-r1', profile: 'diligent', policy: 'field', repeat: 1 }],
        lineage: { parentRunId: 'parent-run', resumeOf: null, supersedes: [] },
        metadata: {
          randomDrawContract: {
            schema: EXPERIMENT_RANDOM_DRAW_CONTRACT_SCHEMA,
            requiredJobIds: ['field-r1'],
            minimumPerJob: 1,
          },
        },
      }),
    );
    appendRunEvent(child, { type: 'run_started', recordedAt: '2026-07-13T00:00:01.000Z' });
    createRunSeal(child, { closedAt: '2026-07-13T00:00:02.000Z', status: 'incomplete' });

    createRunPlan(root, planFixture({ runId: 'parent-run', jobs: [{ id: 'parent-job' }] }));
    appendRunEvent(root, { type: 'run_started', recordedAt: '2026-07-13T00:00:03.000Z' });
    createRunSeal(root, { closedAt: '2026-07-13T00:00:04.000Z', status: 'incomplete' });

    const full = verifyExperimentRun(root);
    assert.equal(full.ok, false);
    assert.match(full.errors.join('\n'), /nested run child failed verification.*random draw contract missing/u);

    const integrityOnly = verifyExperimentRun(root, { completeness: false });
    assert.equal(integrityOnly.ok, true, integrityOnly.errors.join('\n'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a parent seal binds and recursively verifies nested child seals', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'experiment-nested-seal-'));
  const child = path.join(root, 'child');
  try {
    createRunPlan(
      child,
      planFixture({
        runId: 'child-run',
        jobs: [{ id: 'child-job' }],
        lineage: { parentRunId: 'parent-run', resumeOf: null, supersedes: [] },
      }),
    );
    appendRunEvent(child, { type: 'run_started', recordedAt: '2026-07-11T00:00:01.000Z' });
    createRunSeal(child, { closedAt: '2026-07-11T00:00:02.000Z' });

    createRunPlan(root, planFixture({ runId: 'parent-run', jobs: [{ id: 'parent-job' }] }));
    appendRunEvent(root, { type: 'run_started', recordedAt: '2026-07-11T00:00:03.000Z' });
    createRunSeal(root, { closedAt: '2026-07-11T00:00:04.000Z' });
    let verification = verifyExperimentRun(root);
    assert.equal(verification.ok, true, verification.errors.join('\n'));
    assert.ok(verification.inventory.some((entry) => entry.path === 'child/run-seal.json'));

    const childSealPath = path.join(child, 'run-seal.json');
    const childSeal = JSON.parse(fs.readFileSync(childSealPath, 'utf8'));
    childSeal.status = 'tampered';
    fs.writeFileSync(childSealPath, `${JSON.stringify(childSeal)}\n`);
    verification = verifyExperimentRun(root);
    assert.equal(verification.ok, false);
    assert.match(verification.errors.join('\n'), /checksum mismatch for sealed artifact child\/run-seal\.json/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('nested experiment runs must declare the containing run as their semantic parent', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'experiment-nested-lineage-'));
  const child = path.join(root, 'child');
  try {
    createRunPlan(child, planFixture({ runId: 'orphan-child', jobs: [{ id: 'child-job' }] }));
    appendRunEvent(child, { type: 'run_started', recordedAt: '2026-07-11T00:00:01.000Z' });
    createRunSeal(child, { closedAt: '2026-07-11T00:00:02.000Z' });
    createRunPlan(root, planFixture({ runId: 'parent-run', jobs: [{ id: 'parent-job' }] }));
    appendRunEvent(root, { type: 'run_started', recordedAt: '2026-07-11T00:00:03.000Z' });
    createRunSeal(root, { closedAt: '2026-07-11T00:00:04.000Z' });

    const verification = verifyExperimentRun(root);
    assert.equal(verification.ok, false);
    assert.match(verification.errors.join('\n'), /nested run child declares parent \(missing\); expected parent-run/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the verifier fails closed on corruption, deletion, and unsealed additions', () => {
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'experiment-corruption-'));
  try {
    createRunPlan(runDir, planFixture());
    appendRunEvent(runDir, { type: 'run_started', recordedAt: '2026-07-11T00:00:01.000Z' });
    const resultPath = path.join(runDir, 'result.json');
    fs.writeFileSync(resultPath, `${JSON.stringify({ schema: 'fixture.v1', value: 1 })}\n`);
    createRunSeal(runDir, { closedAt: '2026-07-11T00:00:02.000Z' });

    fs.writeFileSync(resultPath, `${JSON.stringify({ schema: 'fixture.v1', value: 2 })}\n`);
    let verification = verifyExperimentRun(runDir);
    assert.equal(verification.ok, false);
    assert.match(verification.errors.join('\n'), /checksum mismatch.*result\.json/u);
    assert.throws(() => assertExperimentRun(runDir), /verification failed/u);

    fs.rmSync(resultPath);
    verification = verifyExperimentRun(runDir);
    assert.match(verification.errors.join('\n'), /missing sealed artifact.*result\.json/u);

    fs.writeFileSync(path.join(runDir, 'late-report.md'), 'not sealed\n');
    verification = verifyExperimentRun(runDir);
    assert.match(verification.errors.join('\n'), /unsealed artifact.*late-report\.md/u);
  } finally {
    fs.rmSync(runDir, { recursive: true, force: true });
  }
});

test('plan validation requires requested/resolved model provenance, hashes, lineage, and job seeds', () => {
  assert.throws(
    () =>
      planFixture({
        models: {
          tutor: { requested: 'mock.tutor' },
        },
      }),
    /models\.tutor\.resolved/u,
  );
  assert.throws(() => planFixture({ hashes: { runner: hashCanonicalJson('runner') } }), /hashes\.analyzer/u);
  assert.throws(() => planFixture({ jobs: [{ profile: 'diligent' }] }), /jobs\[0\]\.id/u);
  assert.throws(
    () =>
      planFixture({
        models: {
          tutor: {
            requested: 'codex.default',
            resolved: 'codex/gpt-5.5',
            observed: null,
            allowCliDefaultResolution: true,
          },
        },
      }),
    /allowCliDefaultResolution requires resolved to end with/u,
  );
});

test('tutor-stub trace roles map explicitly to frozen tutor, learner, and analyzer roles', () => {
  for (const role of [
    'tutor',
    'tutor_stub_tutor',
    'tutor_stub_tutor_repair',
    'tutor_stub_tutor_prefetch',
    'tutor_stub_clarifier',
  ]) {
    assert.equal(tutorStubTraceModelRole(role), 'tutor', role);
  }
  for (const role of ['learner', 'tutor_stub_auto_learner', 'tutor_stub_mixed_learner_artifacts']) {
    assert.equal(tutorStubTraceModelRole(role), 'learner', role);
  }
  for (const role of [
    'analyzer',
    'tutor_stub_learner_analysis',
    'tutor_stub_learner_analysis_prefetch',
    'tutor_stub_learner_classifier',
    'tutor_stub_learner_record',
  ]) {
    assert.equal(tutorStubTraceModelRole(role), 'analyzer', role);
  }
  assert.equal(tutorStubTraceModelRole('future_unclassified_role'), null);
});

function verifyModelObservationFixture({ model, observations }) {
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'experiment-model-contract-'));
  try {
    createRunPlan(
      runDir,
      planFixture({
        models: { tutor: model },
        requiredObservedModelRoles: ['tutor'],
      }),
    );
    appendRunEvent(runDir, { type: 'run_started', recordedAt: '2026-07-11T00:00:01.000Z' });
    for (const [index, observation] of observations.entries()) {
      appendRunEvent(runDir, {
        type: 'model_observed',
        recordedAt: `2026-07-11T00:00:${String(index + 2).padStart(2, '0')}.000Z`,
        role: 'tutor',
        ...observation,
      });
    }
    createRunSeal(runDir, { closedAt: '2026-07-11T00:00:09.000Z' });
    return verifyExperimentRun(runDir);
  } finally {
    fs.rmSync(runDir, { recursive: true, force: true });
  }
}

test('model observation events must agree with the frozen requested, resolved, and observed contract', () => {
  const model = { requested: 'codex.gpt-5.5', resolved: 'codex/gpt-5.5', observed: null };
  const valid = verifyModelObservationFixture({
    model,
    observations: [{ requested: model.requested, resolved: model.resolved, observed: model.resolved }],
  });
  assert.equal(valid.ok, true, valid.errors.join('\n'));

  const drifted = verifyModelObservationFixture({
    model,
    observations: [{ requested: 'codex.other', resolved: 'codex/gpt-other', observed: 'codex/gpt-other' }],
  });
  assert.equal(drifted.ok, false);
  assert.match(drifted.errors.join('\n'), /requested value.*differs from frozen plan/u);
  assert.match(drifted.errors.join('\n'), /resolved value.*differs from frozen plan/u);
  assert.match(drifted.errors.join('\n'), /outside frozen contract/u);
});

test('conflicting observed models fail closed unless every model is explicitly allowed', () => {
  const base = { requested: 'codex.gpt', resolved: 'codex/gpt-a', observed: null };
  const observations = [
    { requested: base.requested, resolved: base.resolved, observed: 'codex/gpt-a' },
    { requested: base.requested, resolved: base.resolved, observed: 'codex/gpt-b' },
  ];
  const conflict = verifyModelObservationFixture({ model: base, observations });
  assert.equal(conflict.ok, false);
  assert.match(conflict.errors.join('\n'), /conflicting observed models for role tutor/u);

  const declared = verifyModelObservationFixture({
    model: { ...base, allowedObservedModels: ['codex/gpt-a', 'codex/gpt-b'] },
    observations,
  });
  assert.equal(declared.ok, true, declared.errors.join('\n'));
});

test('an explicitly frozen CLI-default contract accepts one resolved model from the same provider', () => {
  const model = {
    requested: 'codex/(cli-default)',
    resolved: 'codex/(cli-default)',
    observed: null,
    allowCliDefaultResolution: true,
  };
  const verification = verifyModelObservationFixture({
    model,
    observations: [{ requested: model.requested, resolved: model.resolved, observed: 'codex/gpt-5.6-terra' }],
  });
  assert.equal(verification.ok, true, verification.errors.join('\n'));
});

test('a sealed run fails closed when a required role has no observed model event', () => {
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'experiment-model-observation-'));
  try {
    const models = {
      tutor: { requested: 'codex.gpt', resolved: 'codex/gpt', observed: null },
    };
    createRunPlan(runDir, planFixture({ models, requiredObservedModelRoles: ['tutor'] }));
    appendRunEvent(runDir, { type: 'run_started', recordedAt: '2026-07-11T00:00:01.000Z' });
    createRunSeal(runDir, { closedAt: '2026-07-11T00:00:02.000Z' });
    const verification = verifyExperimentRun(runDir);
    assert.equal(verification.ok, false);
    assert.match(verification.errors.join('\n'), /missing observed model provenance for role tutor/u);
  } finally {
    fs.rmSync(runDir, { recursive: true, force: true });
  }
});

test('a plan-declared observed model never substitutes for a required runtime observation event', () => {
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'experiment-model-plan-only-'));
  try {
    createRunPlan(
      runDir,
      planFixture({
        models: {
          tutor: { requested: 'mock/tutor', resolved: 'mock/tutor', observed: 'mock/tutor' },
        },
        requiredObservedModelRoles: ['tutor'],
      }),
    );
    appendRunEvent(runDir, { type: 'run_started', recordedAt: '2026-07-11T00:00:01.000Z' });
    createRunSeal(runDir, { closedAt: '2026-07-11T00:00:02.000Z' });
    const verification = verifyExperimentRun(runDir);
    assert.equal(verification.ok, false);
    assert.match(verification.errors.join('\n'), /missing observed model provenance for role tutor/u);
  } finally {
    fs.rmSync(runDir, { recursive: true, force: true });
  }
});

test('Git fingerprints distinguish clean, tracked-dirty, and untracked state', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'experiment-git-fingerprint-'));
  try {
    execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'codex@example.invalid'], { cwd: repo });
    execFileSync('git', ['config', 'user.name', 'Codex Test'], { cwd: repo });
    fs.writeFileSync(path.join(repo, 'tracked.txt'), 'one\n');
    execFileSync('git', ['add', 'tracked.txt'], { cwd: repo });
    execFileSync('git', ['commit', '-m', 'fixture'], { cwd: repo, stdio: 'ignore' });

    const clean = captureGitFingerprint({ repoRoot: repo });
    assert.equal(clean.dirty, false);
    assert.match(clean.sha, /^[0-9a-f]{40}$/u);

    fs.writeFileSync(path.join(repo, 'tracked.txt'), 'two\n');
    fs.writeFileSync(path.join(repo, 'untracked.txt'), 'three\n');
    const dirty = captureGitFingerprint({ repoRoot: repo });
    assert.equal(dirty.dirty, true);
    assert.notEqual(dirty.fingerprintSha256, clean.fingerprintSha256);
    assert.equal(dirty.untracked.length, 1);
    assert.equal(dirty.untracked[0].path, 'untracked.txt');
    assert.match(dirty.patchSha256, /^[0-9a-f]{64}$/u);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});
