import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildTutorStubFirstDraftContract } from '../services/tutorStubFirstDraftContract.js';
import {
  auditTutorStubJointPerformanceOwnership,
  buildTutorStubJointPerformanceHostPlan,
  composeTutorStubJointPerformanceFirstDraft,
  parseTutorStubJointPerformanceFirstDraft,
} from '../services/tutorStubJointPerformanceFirstDraft.js';
import { compileTutorStubPerformanceObligationContract } from '../services/tutorStubPerformanceObligationContract.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'tutor-stub-typed-composite-advocate.json'), 'utf8'),
);

function responseConfiguration() {
  return {
    engagement_stance: 'charismatic',
    action_family: 'stage_next_step',
    audience_register: 'adult_novice',
    lexical_accessibility: 'plain',
    scene_immersion: 'immersive',
    actorial_part: 'advocate',
    actorial_part_label: 'advocate for the live case',
    actorial_part_selection: {},
    actorial_performance: {
      id: 'evidentiary_boundary',
      label: 'evidentiary boundary',
      contract: 'State the exact support and its limit with concrete boundary words.',
    },
    surface_budgets: { max_average_sentence_words: 18 },
    unresolved_terms: [],
  };
}

function contextFor(row) {
  const sourceWorld = row.world || fixture.world;
  const sourceTurn = row.public_turn || fixture.public_turn;
  const world = {
    ...sourceWorld,
    premiseById: new Map(),
  };
  const configuration = responseConfiguration();
  const publicWorld = {
    visibility: 'public',
    title: sourceWorld.title,
    setting: sourceWorld.setting,
    question: sourceWorld.question,
    public_objects: sourceWorld.public_objects,
  };
  const performanceObligationContract = compileTutorStubPerformanceObligationContract({
    responseConfiguration: configuration,
    publicWorld,
    publicTurn: sourceTurn,
  });
  const firstDraftContract = buildTutorStubFirstDraftContract({
    learnerText: sourceTurn.learner_move,
    responseConfiguration: configuration,
    responseCompositionFrame: {
      learner_move: { summary: sourceTurn.learner_move },
      scene_action_budget: { saturated: false },
    },
    dramaticReleaseFrame: row.source ? { active: true, entries: [row.source] } : { active: false, entries: [] },
    performanceObligationContract,
  });
  const jointPerformanceHostPlan = buildTutorStubJointPerformanceHostPlan(firstDraftContract);
  return {
    world,
    configuration,
    performanceObligationContract,
    firstDraftContract,
    jointPerformanceHostPlan,
  };
}

function auditCase(row) {
  const context = contextFor(row);
  const structured = parseTutorStubJointPerformanceFirstDraft(
    JSON.stringify({
      uptake: row.uptake,
      performance: { entry: row.entry, response: row.response },
      handoff: row.handoff,
    }),
    { maxWordsPerSlot: 24 },
  );
  const composition = composeTutorStubJointPerformanceFirstDraft({
    structured,
    dramaticReleaseFrame: row.source ? { active: true, entries: [row.source] } : { active: false, entries: [] },
  });
  const audit = auditTutorStubJointPerformanceOwnership({
    composition,
    candidate: composition.text,
    configuration: context.configuration,
    world: context.world,
    performanceObligationContract: context.performanceObligationContract,
    firstDraftContract: context.firstDraftContract,
    jointPerformanceHostPlan: context.jointPerformanceHostPlan,
  });
  return { audit, composition, context };
}

function assertCompositeRequirements(row, audit) {
  assert.equal(audit.compositePartOwnership?.active, true, row.id);
  assert.equal(audit.compositePartOwnership?.selected_part, 'advocate', row.id);
  assert.equal(audit.compositePartOwnership?.mode, 'delegated_complement', row.id);
  const requirements = Object.fromEntries(
    (audit.compositePartOwnership?.requirements || []).map((requirement) => [requirement.id, requirement]),
  );
  assert.deepEqual(
    Object.fromEntries(Object.entries(requirements).map(([id, requirement]) => [id, requirement.ok])),
    row.expected.composite_requirements,
    row.id,
  );
  assert.deepEqual(requirements.performance_initiation.owner, 'performance', row.id);
  assert.deepEqual(requirements.performance_initiation.slot_ids, ['performance_entry'], row.id);
  assert.deepEqual(requirements.performance_action_absent.owner, 'performance', row.id);
  assert.deepEqual(
    requirements.performance_action_absent.slot_ids,
    ['performance_entry', 'performance_response'],
    row.id,
  );
  assert.deepEqual(requirements.handoff_relevant_delegated_complement.owner, 'handoff', row.id);
  assert.deepEqual(requirements.handoff_relevant_delegated_complement.slot_ids, ['handoff'], row.id);
  assert.deepEqual(requirements.handoff_selected_action.owner, 'handoff', row.id);
  assert.deepEqual(requirements.handoff_selected_action.slot_ids, ['handoff'], row.id);
}

test('typed composite advocate accepts bounded PERFORMANCE plus a related HANDOFF action', () => {
  for (const row of fixture.cases.filter((entry) => entry.kind === 'positive')) {
    const { audit } = auditCase(row);
    assert.equal(audit.ok, row.expected.audit_ok, `${row.id}: ${JSON.stringify(audit.issues)}`);
    assert.equal(audit.axes.actorial_part.visible, row.expected.actorial_part_visible, row.id);
    assert.equal(audit.axes.action_family.visible, row.expected.action_family_visible, row.id);
    assertCompositeRequirements(row, audit);
  }
});

test('typed composite advocate rejects owner substitution and unrelated handoffs', () => {
  for (const row of fixture.cases.filter((entry) => entry.kind === 'negative')) {
    const { audit, composition } = auditCase(row);
    assert.equal(audit.ok, row.expected.audit_ok, row.id);
    assert.equal(audit.axes.actorial_part.visible, row.expected.actorial_part_visible, row.id);
    assert.equal(audit.axes.action_family.visible, row.expected.action_family_visible, row.id);
    assertCompositeRequirements(row, audit);
    if (row.expected.excluded_source_count !== undefined) {
      assert.equal(composition.sourceCount, row.expected.excluded_source_count, row.id);
      assert.equal(audit.boundaries.excluded_host_source_spans.length, row.expected.excluded_source_count, row.id);
      assert.equal(audit.performanceText.includes(row.source.surface), false, row.id);
      assert.deepEqual(audit.compositePartOwnership.excluded_span_ids, ['source_1'], row.id);
    }
  }
});

test('typed composite fixture binds only the declared advocate compatibility decision', () => {
  for (const row of fixture.cases) {
    const context = contextFor(row);
    const advocateDecisions = context.firstDraftContract.compatibility.decisions.filter((decision) =>
      decision.startsWith('advocate_'),
    );
    assert.deepEqual(advocateDecisions, ['advocate_case_delegates_concrete_test_to_final_handoff'], row.id);
    assert.deepEqual(
      context.jointPerformanceHostPlan.compatibility.decisions,
      context.firstDraftContract.compatibility.decisions,
      row.id,
    );
    assert.deepEqual(context.jointPerformanceHostPlan.axis_ownership.actorial_part, ['performance'], row.id);
    assert.deepEqual(context.jointPerformanceHostPlan.axis_ownership.action_family, ['handoff'], row.id);
  }
});
