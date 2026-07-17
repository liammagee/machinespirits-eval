import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadWorld } from '../services/dramaticDerivation/world.js';
import {
  auditTutorStubFrozenCandidate,
  refreshTutorStubFrozenFirstDraftRequest,
} from '../services/tutorStubFrozenReplay.js';
import {
  applyTutorStubJointPerformanceOwnershipAudit,
  composeTutorStubJointPerformanceFirstDraft,
  parseTutorStubJointPerformanceFirstDraft,
} from '../services/tutorStubJointPerformanceFirstDraft.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'tests', 'fixtures', 'tutor-stub-first-draft', 'tallow-answer-seeking-v27-i8-turn5.json'),
    'utf8',
  ),
);
const sourceFixture = JSON.parse(fs.readFileSync(path.join(ROOT, fixture.source_case_fixture), 'utf8'));

function worldForId(worldId) {
  const worldDir = path.join(ROOT, 'config', 'drama-derivation');
  const matches = fs
    .readdirSync(worldDir)
    .filter((name) => /^world-.*\.yaml$/u.test(name))
    .map((name) => loadWorld(path.join(worldDir, name)))
    .filter((world) => world.id === worldId);
  assert.equal(matches.length, 1, `expected one world for ${worldId}`);
  return matches[0];
}

test('V27 cross-world confirmation rejection remains available for exact model-free re-audit', () => {
  assert.equal(fixture.schema, 'machinespirits.tutor-stub.joint-performance-regression-fixture.v1');
  const sourceCase = sourceFixture.cases.find((entry) => entry.id === fixture.source_case_id);
  assert.ok(sourceCase, `missing source case ${fixture.source_case_id}`);
  assert.equal(sourceCase.bundle.learnerText, fixture.learner_text);

  const world = worldForId(fixture.world_id);
  const bundle = refreshTutorStubFrozenFirstDraftRequest({ bundle: sourceCase.bundle, world });
  assert.equal(bundle.speakingResponseConfiguration.actorial_part, 'advocate');
  assert.equal(bundle.speakingResponseConfiguration.actorial_performance.id, 'evidentiary_boundary');
  assert.equal(bundle.firstDraftContract.opening.writable_entry_requested, true);
  assert.equal(bundle.firstDraftContract.progression.learner_uptake.mode, 'writable_entry');
  assert.equal(bundle.firstDraftContract.progression.handoff_contract.mode, 'declarative_missing_support');
  assert.equal(bundle.firstDraftContract.progression.handoff_contract.question_allowed, false);

  const structured = parseTutorStubJointPerformanceFirstDraft(fixture.joint_performance_raw, {
    maxWordsPerSlot: bundle.firstDraftContract.language.host_sentence_word_target,
  });
  const composition = composeTutorStubJointPerformanceFirstDraft({ structured });
  assert.equal(composition.text, fixture.candidate);

  const wholeResponseAudit = auditTutorStubFrozenCandidate({
    bundle,
    world,
    text: composition.text,
    candidateKind: 'original_candidate',
  });
  const audit = applyTutorStubJointPerformanceOwnershipAudit({
    audit: wholeResponseAudit,
    composition,
    candidate: composition.text,
    configuration: bundle.speakingResponseConfiguration,
    world,
    performanceObligationContract: bundle.performanceObligationContract,
    progressionContract: bundle.firstDraftContract.progression,
  });

  assert.ok(
    fixture.recorded_audit.failure_clusters.includes(fixture.post_v28_expected_audit.corrected_recorded_false_negative),
  );
  const expected = fixture.post_canonical_audit_expected;
  const typedCausalFailureCluster = 'responseCompositionAudit:unlicensed_requested_entry';
  const typedCausalHardFailureCluster = 'response_composition:unlicensed_requested_entry';
  const currentFailureClusters = [
    ...expected.failure_clusters.slice(0, 1),
    typedCausalFailureCluster,
    ...expected.failure_clusters.slice(1),
  ];
  const currentHardFailureClusters = [
    ...expected.hard_failure_clusters.slice(0, 1),
    typedCausalHardFailureCluster,
    ...expected.hard_failure_clusters.slice(1),
  ];
  assert.equal(expected.classification, 'audit_recognition_correction_not_generation_improvement');
  assert.equal(audit.ok, expected.ok);
  assert.equal(audit.safetyFailure, expected.safety_failure);
  assert.deepEqual(audit.failureClusters, currentFailureClusters);
  assert.deepEqual(audit.hardFailureClusters, currentHardFailureClusters);
  assert.equal(
    audit.failureClusters.includes(fixture.post_v28_expected_audit.corrected_recorded_false_negative),
    false,
  );
  assert.equal(audit.audits.responseConfigurationAudit.realization_rate, expected.configuration_realization);
  assert.equal(audit.audits.responseCompositionAudit.requestedEntryAnswerRecognition.recognized, false);
  assert.equal(
    audit.audits.responseCompositionAudit.requestedEntryAnswerRecognition.license.material_grounding
      .causal_relation_family,
    expected.causal_relation_family,
  );
  assert.equal(
    audit.audits.responseCompositionAudit.requestedEntryAnswerRecognition.license.material_grounding
      .causal_relation_supported,
    expected.causal_relation_supported,
  );
  assert.deepEqual(audit.audits.responseCompositionAudit.issues, [
    {
      type: 'unlicensed_requested_entry',
      reason:
        'supplies requested wording that changes an actor, causal relation, polarity, or public evidentiary limit',
    },
  ]);
  assert.deepEqual(
    audit.audits.jointPerformanceAudit.issues.map((issue) => [issue.type, issue.axis]),
    [
      ['composite_part_requirement_failed', 'actorial_part'],
      ['axis_not_realized_in_owner', 'actorial_part'],
    ],
  );
  assert.equal(
    audit.audits.jointPerformanceAudit.compositePartOwnership.requirements.find(
      (row) => row.id === 'handoff_relevant_delegated_complement',
    ).ok,
    false,
  );
  assert.deepEqual(
    audit.audits.turnProgressionAudit.issues.map((issue) => issue.type),
    ['question_forbidden_by_handoff_contract', 'handoff_loses_turn_focus'],
  );
});
