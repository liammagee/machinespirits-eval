import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceTutorStubCurriculumRuntime,
  createTutorStubCurriculumRuntime,
  recordTutorStubCurriculumEvidence,
  selectTutorStubCurriculumRuntimeModule,
  tutorStubCurriculumPrivatePrompt,
  tutorStubCurriculumPublicProjection,
} from '../services/curriculum/tutorStubCurriculumRuntime.js';

function course(id = 'evidence_reasoning') {
  return {
    curriculum: {
      schema_version: 'ms-curriculum-v0.1',
      id,
      title: id === 'evidence_reasoning' ? 'Evidence Reasoning' : 'Systems Thinking',
      source: { source_hash: `sha256:${'a'.repeat(64)}` },
      modules: [
        {
          id: 'M1',
          sequence: 1,
          title: 'Claims and warrants',
          essential_question: 'What makes a claim checkable?',
          main_artifact: 'A bounded claim and warrant',
          canonical_tasks: ['Bound a claim.'],
          knowledge_components: [{ id: 'KC_PRIVATE_1', statement: 'Claims need scoped warrants.' }],
          verifiers: ['PRIVATE_CHECK: warrant must cite observable evidence.'],
          misconception_signatures: ['PRIVATE_MISCONCEPTION: confidence is evidence.'],
          mastery_gate: 'PRIVATE_GATE: independent warrant and counterexample.',
          transfer_challenge: 'Assess a changed public claim.',
        },
        {
          id: 'M2',
          sequence: 2,
          title: 'Counterexamples',
          essential_question: 'When does a counterexample change a claim?',
          main_artifact: 'A revised claim',
          canonical_tasks: ['Revise a claim.'],
          knowledge_components: [{ id: 'KC_PRIVATE_2', statement: 'Counterexamples bound generalizations.' }],
          verifiers: ['PRIVATE_CHECK_2: revision matches the counterexample.'],
          misconception_signatures: ['PRIVATE_MISCONCEPTION_2: one exception proves the opposite.'],
          mastery_gate: 'PRIVATE_GATE_2: independent revision.',
          transfer_challenge: 'Revise a policy claim after a new case.',
        },
      ],
      associations: [{ from: 'M1', to: 'M2', relation: 'prerequisite_of' }],
    },
    sourceRef: `curriculum/${id}.curriculum.yaml`,
  };
}

function supplyEvidence(runtime, turn) {
  recordTutorStubCurriculumEvidence(runtime, {
    text: `Learner-authored public reasoning ${turn}`,
    turnId: `turn-${turn}`,
    at: `2026-07-25T00:00:0${turn}.000Z`,
  });
}

test('curriculum runtime advances only from public evidence and explicit mastery decisions', () => {
  const bundle = course();
  const runtime = createTutorStubCurriculumRuntime(bundle, {
    now: () => new Date('2026-07-25T00:00:00.000Z'),
  });

  assert.equal(advanceTutorStubCurriculumRuntime(runtime).reason, 'evidence_required');
  supplyEvidence(runtime, 1);
  assert.equal(advanceTutorStubCurriculumRuntime(runtime).phase, 'scaffold');
  supplyEvidence(runtime, 2);
  assert.equal(advanceTutorStubCurriculumRuntime(runtime).phase, 'independent_check');
  supplyEvidence(runtime, 3);
  assert.equal(advanceTutorStubCurriculumRuntime(runtime).reason, 'explicit_decision_required');
  assert.equal(advanceTutorStubCurriculumRuntime(runtime, { decision: 'pass' }).phase, 'transfer');
  supplyEvidence(runtime, 4);
  const mastered = advanceTutorStubCurriculumRuntime(runtime, { decision: 'pass' });
  assert.equal(mastered.outcome, 'module_mastered');
  assert.equal(runtime.modules.M1.status, 'mastered');

  const selected = selectTutorStubCurriculumRuntimeModule(runtime, bundle.curriculum, 'M2');
  assert.equal(selected.selected, true);
  assert.equal(runtime.currentModuleId, 'M2');
  assert.equal(runtime.currentPhase, 'diagnostic');
});

test('revision returns to scaffold and prerequisite locks are deterministic', () => {
  const bundle = course('systems_thinking');
  const runtime = createTutorStubCurriculumRuntime(bundle);
  assert.deepEqual(selectTutorStubCurriculumRuntimeModule(runtime, bundle.curriculum, 'M2'), {
    selected: false,
    reason: 'prerequisites_incomplete',
    missing: ['M1'],
    runtime,
  });
  supplyEvidence(runtime, 1);
  advanceTutorStubCurriculumRuntime(runtime);
  supplyEvidence(runtime, 2);
  advanceTutorStubCurriculumRuntime(runtime);
  supplyEvidence(runtime, 3);
  const revised = advanceTutorStubCurriculumRuntime(runtime, { decision: 'revise' });
  assert.equal(revised.outcome, 'revision_requested');
  assert.equal(runtime.currentPhase, 'scaffold');
  assert.equal(runtime.modules.M1.phases.independent_check.status, 'needs_revision');
});

test('public progress excludes verifier, misconception, answer, and learner-text material', () => {
  for (const bundle of [course(), course('systems_thinking')]) {
    const runtime = createTutorStubCurriculumRuntime(bundle);
    supplyEvidence(runtime, 1);
    const privatePrompt = tutorStubCurriculumPrivatePrompt(bundle, runtime);
    const projection = tutorStubCurriculumPublicProjection(bundle, runtime);
    const json = JSON.stringify(projection);

    assert.match(privatePrompt, /PRIVATE_CHECK/u);
    assert.match(privatePrompt, /PRIVATE_MISCONCEPTION/u);
    assert.match(privatePrompt, /PRIVATE_GATE/u);
    assert.doesNotMatch(json, /PRIVATE_CHECK|PRIVATE_MISCONCEPTION|PRIVATE_GATE|KC_PRIVATE/u);
    assert.doesNotMatch(json, /Learner-authored public reasoning/u);
    assert.equal(projection.currentPhaseEvidenceCount, 1);
    assert.equal(projection.externalCompletionInferred, false);
    assert.equal(projection.completionAuthority, 'session_mastery_only');
  }
});

test('live workplan curricula cannot infer external completion from session mastery', () => {
  const bundle = { ...course(), sourceRef: 'workplan:live' };
  const runtime = createTutorStubCurriculumRuntime(bundle);
  const projection = tutorStubCurriculumPublicProjection(bundle, runtime);
  assert.equal(projection.completionAuthority, 'external_workplan_verification_only');
  assert.equal(projection.externalCompletionInferred, false);
});
