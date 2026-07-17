import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  auditTutorStubJointPerformanceOwnership,
  composeTutorStubJointPerformanceFirstDraft,
  parseTutorStubJointPerformanceFirstDraft,
  tutorStubJointPerformanceActorialScope,
} from '../services/tutorStubJointPerformanceFirstDraft.js';
import {
  auditTutorStubActorialPerformanceRealization,
  auditTutorStubResponseConfiguration,
  TUTOR_STUB_ACTORIAL_PERFORMANCE_REALIZATION_SCHEMA,
} from '../services/tutorStubResponseConfiguration.js';
import {
  auditTutorStubResponseComposition,
  buildTutorStubResponseCompositionFrame,
} from '../services/tutorStubResponseComposition.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'tests', 'fixtures', 'tutor-stub-first-draft', 'v33-canonical-realization-cases.json'),
    'utf8',
  ),
);

function compositionFor(testCase) {
  return composeTutorStubJointPerformanceFirstDraft({
    structured: parseTutorStubJointPerformanceFirstDraft(JSON.stringify(testCase.slots)),
  });
}

test('canonical realization fixtures bind one predicate to the exact PERFORMANCE owner span', () => {
  assert.equal(FIXTURE.schema, 'machinespirits.tutor-stub.actorial-realization-regression-fixture.v1');
  assert.deepEqual(
    FIXTURE.cases.map((row) => row.kind),
    [
      'saved_v33_original',
      'clear_positive',
      'labels_tactic_without_performing_it',
      'handoff_cannot_rescue_performance',
      'tactic_without_selected_advocate_part',
      'owned_advocate_case_and_limit',
      'saved_compact_strict_original',
      'explicit_evidence_to_claim_limit',
      'claim_cannot_support_evidence_negative',
      'positive_support_relation_negative',
      'unresolved_pronoun_negative',
      'negative_support_in_wrong_owner',
      'lexical_only_decoy_negative',
      'unrelated_did_not_negative',
      'causal_inversion_negative',
      'reversed_revision_direction_negative',
    ],
  );

  for (const testCase of FIXTURE.cases) {
    const composition = compositionFor(testCase);
    const scope = tutorStubJointPerformanceActorialScope(composition);
    const canonical = auditTutorStubActorialPerformanceRealization({
      configuration: FIXTURE.configuration,
      world: FIXTURE.world,
      ...scope,
      actorialPartVisible: true,
    });
    const responseConfigurationAudit = auditTutorStubResponseConfiguration({
      text: composition.text,
      configuration: FIXTURE.configuration,
      world: FIXTURE.world,
      actorialPerformanceScope: scope,
    });
    const jointAudit = auditTutorStubJointPerformanceOwnership({
      composition,
      candidate: composition.text,
      configuration: FIXTURE.configuration,
      world: FIXTURE.world,
    });
    const wholeResult = responseConfigurationAudit.actorial_performance_realization;
    const jointResult = jointAudit.axes.actorial_performance.realization;

    assert.equal(canonical.schema, TUTOR_STUB_ACTORIAL_PERFORMANCE_REALIZATION_SCHEMA);
    assert.equal(canonical.visible, testCase.expected.tactic_visible_in_performance, testCase.id);
    assert.equal(wholeResult.predicate, canonical.predicate, testCase.id);
    assert.equal(jointResult.predicate, canonical.predicate, testCase.id);
    assert.equal(wholeResult.scope.owner, 'performance', testCase.id);
    assert.deepEqual(wholeResult.scope.span_ids, ['performance_entry', 'performance_response'], testCase.id);
    assert.equal(wholeResult.scope.owned_text_sha256, jointResult.scope.owned_text_sha256, testCase.id);
    assert.equal(wholeResult.visible, jointResult.visible, testCase.id);
    assert.equal(jointResult.visible, testCase.expected.tactic_visible_in_performance, testCase.id);
    if (testCase.expected.boundary_construction) {
      assert.ok(jointResult.recognition.constructions.includes(testCase.expected.boundary_construction), testCase.id);
    } else {
      assert.deepEqual(jointResult.recognition.constructions, [], testCase.id);
    }
    if (typeof testCase.expected.joint_actorial_part_visible === 'boolean') {
      assert.equal(jointAudit.axes.actorial_part.visible, testCase.expected.joint_actorial_part_visible, testCase.id);
    }
  }
});

test('the V33 audit-recognition repair leaves its causal-role generation failure intact', () => {
  const testCase = FIXTURE.cases.find((row) => row.id === 'exact_v33_candidate');
  const learnerText = 'What should I put in the minutes about the chargers being dark during the stocktake?';
  const firstDraftContract = {
    schema: 'machinespirits.tutor-stub.first-draft-turn-contract.v1',
    opening: { writable_entry_requested: true },
    evidence: {
      committed_public_surfaces: [
        'The depot chargers stood dark throughout the stocktake.',
        'Tallow Street browned out at 18:40 regardless.',
      ],
    },
  };
  const frame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification: { turn: { summary: 'Asks what the minutes can say about the dark chargers.' } },
    registerSelection: { response_configuration: { action_family: 'answer_accountably' } },
  });
  const audit = auditTutorStubResponseComposition({
    learnerText,
    frame,
    firstDraftContract,
    text: compositionFor(testCase).text,
  });
  const grounding = audit.requestedEntryAnswerRecognition.license.material_grounding;

  assert.equal(audit.requestedEntryAnswerRecognition.recognized, false);
  assert.equal(grounding.causal_relation_family, 'prevention');
  assert.equal(grounding.causal_relation_supported, false);
  assert.deepEqual(grounding.public_causal_relation_families, ['inactive_candidate_with_persisting_outcome']);
});

test('directed positive support plus explicit exclusion is a boundary without admitting brittle decoys', () => {
  const cases = [
    {
      id: 'saved_v39_owned_performance',
      text: 'The stocktake evidence supports ruling out depot causation, but establishes no other cause.',
      visible: true,
    },
    {
      id: 'cross_world_valid',
      text: 'The assay result supports the alloy claim, yet identifies no other source.',
      visible: true,
    },
    {
      id: 'anaphoric_supported_proposition',
      text: 'The stocktake evidence supports it, but establishes no other cause.',
      visible: false,
    },
    {
      id: 'non_evidentiary_subject',
      text: 'The depot claim supports charger causation, but establishes no other cause.',
      visible: false,
    },
    {
      id: 'non_epistemic_exclusion',
      text: 'The stocktake evidence supports charger causation, but establishes no other colour.',
      visible: false,
    },
    {
      id: 'positive_support_without_exclusion',
      text: 'The stocktake evidence supports charger causation, and the chargers stayed dark.',
      visible: false,
    },
  ];

  for (const testCase of cases) {
    const composition = composeTutorStubJointPerformanceFirstDraft({
      structured: parseTutorStubJointPerformanceFirstDraft(
        JSON.stringify({
          uptake: 'The minutes need one bounded entry.',
          performance: {
            entry: 'My case is the minutes must record the public result.',
            response: testCase.text,
          },
          handoff: 'Next, compare the result with the public record.',
        }),
      ),
    });
    const result = auditTutorStubActorialPerformanceRealization({
      configuration: FIXTURE.configuration,
      world: FIXTURE.world,
      ...tutorStubJointPerformanceActorialScope(composition),
      actorialPartVisible: true,
    });
    assert.equal(result.visible, testCase.visible, testCase.id);
    assert.equal(
      result.recognition.constructions.includes('positive_support_with_explicit_exclusion'),
      testCase.visible,
      testCase.id,
    );
  }
});
