import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TUTOR_STUB_CAPABILITY_FLAG_IDS,
  TUTOR_STUB_CAPABILITY_IDS,
  TUTOR_STUB_CAPABILITY_REGISTRY,
  TUTOR_STUB_CAPABILITY_REGISTRY_SCHEMA,
  TUTOR_STUB_CAPABILITY_REGISTRY_VERSION,
  TUTOR_STUB_CAPABILITY_SNAPSHOT_SCHEMA,
  assertTutorStubCapabilityCompatibility,
  assertTutorStubCapabilityRegistryInvariants,
  resolveTutorStubCapabilities,
  tutorStubCapabilityActive,
  tutorStubCapabilityAvailable,
  tutorStubCapabilityFeatureRows,
} from '../services/tutorStubCapabilities.js';

function normalConfig(overrides = {}) {
  return {
    interactive: true,
    world: true,
    classifier: true,
    registerSelection: true,
    turnFeedback: true,
    trace: true,
    learningSummary: true,
    responseChecks: true,
    ...overrides,
  };
}

test('v1 capability registry is frozen, grouped, and internally valid', () => {
  assert.equal(TUTOR_STUB_CAPABILITY_REGISTRY.schema, TUTOR_STUB_CAPABILITY_REGISTRY_SCHEMA);
  assert.equal(TUTOR_STUB_CAPABILITY_REGISTRY.version, TUTOR_STUB_CAPABILITY_REGISTRY_VERSION);
  assert.equal(TUTOR_STUB_CAPABILITY_REGISTRY_VERSION, 1);
  assert.equal(TUTOR_STUB_CAPABILITY_REGISTRY.groups.length, 7);
  assert.equal(TUTOR_STUB_CAPABILITY_REGISTRY.capabilities.length, 23);
  assert.equal(TUTOR_STUB_CAPABILITY_IDS.length, 23);
  assert.equal(TUTOR_STUB_CAPABILITY_FLAG_IDS.length, 21);
  assert.equal(new Set(TUTOR_STUB_CAPABILITY_IDS).size, TUTOR_STUB_CAPABILITY_IDS.length);
  assert.equal(Object.isFrozen(TUTOR_STUB_CAPABILITY_REGISTRY), true);
  assert.equal(Object.isFrozen(TUTOR_STUB_CAPABILITY_REGISTRY.capabilities), true);
  assert.equal(Object.isFrozen(TUTOR_STUB_CAPABILITY_REGISTRY.compatibilityRules), true);
  assert.equal(assertTutorStubCapabilityRegistryInvariants(), true);

  const drifted = {
    ...TUTOR_STUB_CAPABILITY_REGISTRY,
    capabilities: TUTOR_STUB_CAPABILITY_REGISTRY.capabilities.map((entry, index) =>
      index === 0 ? { ...entry, activeWhen: { ...entry.activeWhen, all: ['typoFlag'] } } : entry,
    ),
  };
  assert.throws(
    () => assertTutorStubCapabilityRegistryInvariants(drifted),
    /unknown capability flag in public_dialogue\.activeWhen: typoFlag/u,
  );
});

test('resolver emits an immutable direct-session snapshot with available and active states separated', () => {
  const snapshot = resolveTutorStubCapabilities(normalConfig());
  assert.equal(snapshot.schema, TUTOR_STUB_CAPABILITY_SNAPSHOT_SCHEMA);
  assert.equal(snapshot.mode, 'direct');
  assert.equal(snapshot.compatibility.valid, true);
  assert.equal(tutorStubCapabilityAvailable(snapshot, 'mixed_drafting'), true);
  assert.equal(tutorStubCapabilityActive(snapshot, 'mixed_drafting'), false);
  assert.equal(tutorStubCapabilityAvailable(snapshot, 'turn_feedback'), true);
  assert.equal(tutorStubCapabilityActive(snapshot, 'turn_feedback'), true);
  assert.equal(tutorStubCapabilityActive(snapshot, 'adaptive_delivery'), true);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.flags), true);
  assert.equal(Object.isFrozen(snapshot.capabilities.mixed_drafting), true);
  assert.equal(assertTutorStubCapabilityCompatibility(snapshot), true);
});

test('resolved mode names distinguish passthrough, scaffold, mixed, auto, and curriculum sessions', () => {
  const passthrough = resolveTutorStubCapabilities({ passthrough: true, trace: true });
  assert.equal(passthrough.mode, 'passthrough');
  assert.equal(passthrough.compatibility.valid, true);
  assert.equal(tutorStubCapabilityActive(passthrough, 'speaker_only'), true);
  assert.equal(tutorStubCapabilityAvailable(passthrough, 'learner_reading'), false);

  assert.equal(resolveTutorStubCapabilities(normalConfig({ dag: true, learnerDag: true })).mode, 'scaffold');
  assert.equal(resolveTutorStubCapabilities(normalConfig({ mixedLearner: true })).mode, 'mixed');
  assert.equal(
    resolveTutorStubCapabilities(normalConfig({ interactive: false, autoLearner: true, turnFeedback: false })).mode,
    'auto',
  );
  assert.equal(
    resolveTutorStubCapabilities(
      normalConfig({ world: false, curriculum: true, classifier: true, registerSelection: false }),
    ).mode,
    'curriculum',
  );
});

test('compatibility rules fail with actionable machine-readable issues', () => {
  const passthrough = resolveTutorStubCapabilities({
    passthrough: true,
    classifier: true,
    registerSelection: true,
    responseChecks: true,
  });
  assert.equal(passthrough.compatibility.valid, false);
  assert.deepEqual(passthrough.compatibility.issues[0].conflicts, [
    'classifier',
    'registerSelection',
    'responseChecks',
  ]);
  assert.throws(
    () => assertTutorStubCapabilityCompatibility(passthrough),
    /passthrough_isolation: Passthrough is speaker-only/u,
  );

  const learnerDagWithoutWorld = resolveTutorStubCapabilities({ learnerDag: true });
  assert.deepEqual(
    learnerDagWithoutWorld.compatibility.issues.find((issue) => issue.id === 'learner_dag_requires_world').missing,
    ['world'],
  );

  const curriculumWithWorld = resolveTutorStubCapabilities({ curriculum: true, world: true, dag: true });
  assert.deepEqual(
    curriculumWithWorld.compatibility.issues.find((issue) => issue.id === 'curriculum_excludes_world').conflicts,
    ['world', 'dag'],
  );
});

test('feature rows are generated from the registry and expose resolved active labels', () => {
  const snapshot = resolveTutorStubCapabilities(normalConfig({ mixedLearner: true }));
  const rows = tutorStubCapabilityFeatureRows(snapshot);
  assert.equal(rows.length, TUTOR_STUB_CAPABILITY_REGISTRY.groups.length);
  assert.deepEqual(
    rows.map((row) => row.id),
    ['participate', 'teach', 'adapt', 'control', 'access', 'inspect', 'evaluate'],
  );
  assert.ok(rows.find((row) => row.id === 'participate').active.includes('mixed learner drafting'));
  assert.ok(rows.find((row) => row.id === 'adapt').active.includes('adaptive delivery'));
  assert.equal(Object.isFrozen(rows), true);
  assert.equal(Object.isFrozen(rows[0]), true);
});
