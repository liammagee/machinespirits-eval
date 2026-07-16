import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditTutorStubJointPerformanceOwnership,
  composeTutorStubJointPerformanceFirstDraft,
  parseTutorStubJointPerformanceFirstDraft,
  TUTOR_STUB_JOINT_PERFORMANCE_AUDIT_SCHEMA,
} from '../services/tutorStubJointPerformanceFirstDraft.js';
import { compileTutorStubPerformanceObligationContract } from '../services/tutorStubPerformanceObligationContract.js';
import {
  auditTutorStubStructuredSlotOwnership,
  composeTutorStubStructuredFirstDraft,
  parseTutorStubStructuredFirstDraft,
  TUTOR_STUB_STRUCTURED_SLOT_AUDIT_SCHEMA,
} from '../services/tutorStubStructuredFirstDraft.js';

function marrickWorld() {
  return {
    title: 'The Light Shillings',
    setting: 'A shilling, lead-sweat, touchstone, balance, and bench are in the assay room.',
    question: 'Whose hand struck the false shillings?',
    premiseById: new Map(),
  };
}

function warmScenePartnerConfiguration() {
  return {
    engagement_stance: 'warm',
    action_family: 'stage_next_step',
    audience_register: 'adult_novice',
    lexical_accessibility: 'plain',
    scene_immersion: 'immersive',
    actorial_part: 'scene_partner',
    actorial_part_label: 'fellow investigator',
    actorial_part_selection: {},
    actorial_performance: { id: 'shared_scene_invitation', label: 'shared-scene invitation' },
    unresolved_terms: [],
  };
}

const V26_SEMANTIC_SUCCESSES = Object.freeze([
  {
    id: 'iteration_2',
    uptake: 'Write: “The lead-sweat shows the shilling is poor dross, not clipped sterling.”',
    entry: 'Together, we hold the shilling at the touchstone.',
    response: 'What does the touchstone tell you about the shilling, without yet naming its maker?',
    handoff: 'The balance is the next public check, if you wish.',
  },
  {
    id: 'iteration_3',
    uptake: 'Write: The lead-sweat shows the shillings are debased, not merely clipped.',
    entry: 'Together at the touchstone, you and I hold the grey lead-sweat in view.',
    response: 'What does the touchstone tell you about whether these coins were newly struck?',
    handoff: 'We can next weigh what this touchstone mark leaves unproved about the hand that struck them.',
  },
]);

function v2Composition(row, { handoff = row.handoff, dramaticReleaseFrame = null } = {}) {
  const structured = parseTutorStubJointPerformanceFirstDraft(
    JSON.stringify({
      uptake: row.uptake,
      performance: { entry: row.entry, response: row.response },
      handoff,
    }),
  );
  return composeTutorStubJointPerformanceFirstDraft({ structured, dramaticReleaseFrame });
}

test('V27 joint performance recognizes the saved I2 and I3 beats without phrase additions', () => {
  for (const row of V26_SEMANTIC_SUCCESSES) {
    const composition = v2Composition(row);
    const audit = auditTutorStubJointPerformanceOwnership({
      composition,
      candidate: composition.text,
      configuration: warmScenePartnerConfiguration(),
      world: marrickWorld(),
    });

    assert.equal(audit.schema, TUTOR_STUB_JOINT_PERFORMANCE_AUDIT_SCHEMA);
    assert.equal(audit.ok, true, row.id);
    assert.deepEqual(
      Object.fromEntries(Object.entries(audit.axes).map(([axis, value]) => [axis, value.visible])),
      {
        actorial_part: true,
        actorial_performance: true,
        engagement_stance: true,
        scene_immersion: true,
        action_family: true,
      },
      row.id,
    );
    assert.equal(audit.performanceText, `${row.entry} ${row.response}`);
    assert.deepEqual(audit.boundaries.performance, ['performance_entry', 'performance_response']);
    assert.deepEqual(audit.boundaries.handoff, ['handoff']);
  }
});

test('V27 joint performance does not let ENTRY mask the saved I1 RESPONSE generation miss', () => {
  const row = {
    uptake:
      'Write: “The lead-sweat shows these shillings are newly struck from debased metal, not clipped sterling.”',
    entry: 'Together at the touchstone, you and I keep the lead-sweat before us.',
    response: 'Read its grey trace as poor metal, not yet proof of any maker.',
    handoff: 'We may next consider what the touchstone still cannot tell us about the hand.',
  };
  const composition = v2Composition(row);
  const audit = auditTutorStubJointPerformanceOwnership({
    composition,
    candidate: composition.text,
    configuration: warmScenePartnerConfiguration(),
    world: marrickWorld(),
  });

  assert.equal(audit.axes.actorial_part.visible, true);
  assert.equal(audit.axes.actorial_performance.visible, false);
  assert.ok(audit.issues.some((issue) => issue.axis === 'actorial_performance'));
});

test('V27 joint performance excludes a host-owned SOURCE performance cue', () => {
  const world = {
    title: 'The Light Shillings',
    setting: 'The trial-book and shilling rest on the assay bench.',
    question: 'Whose hand struck the false shillings?',
    premiseById: new Map(),
  };
  const pressureTarget = 'The town has its verdict ready: Verrell struck the false shillings.';
  const sourceSurface =
    'The trial-book says the town’s claim now falters because Edony signed for the charcoal.';
  const configuration = {
    engagement_stance: 'charismatic',
    action_family: 'stage_next_step',
    audience_register: 'adult_novice',
    lexical_accessibility: 'plain',
    scene_immersion: 'immersive',
    actorial_part: 'record_keeper',
    actorial_part_label: 'keeper of the trial-book',
    actorial_part_selection: {},
    actorial_performance: { id: 'dramatic_counterpressure', label: 'dramatic counterpressure' },
    unresolved_terms: [],
  };
  const performanceObligationContract = compileTutorStubPerformanceObligationContract({
    responseConfiguration: configuration,
    publicWorld: {
      visibility: 'public',
      title: world.title,
      setting: world.setting,
      question: world.question,
      ledger_term: 'trial-book',
      public_objects: ['trial-book', 'shilling'],
    },
    publicTurn: {
      visibility: 'public',
      learner_move: 'What follows?',
      pressure_target: pressureTarget,
      contrary_evidence: [sourceSurface],
      public_evidence: [{ surface: pressureTarget }],
      due_evidence: [{ surface: sourceSurface }],
    },
  });
  const composition = v2Composition(
    {
      uptake: 'The current accusation remains open.',
      entry: 'I open the trial-book beside the shilling.',
      response: 'The page lies flat on the assay bench.',
      handoff: 'Next, check the signed line in the trial-book.',
    },
    {
      dramaticReleaseFrame: {
        active: true,
        entries: [{ premise: 'p_signed', mode: 'presented_exhibit', role: 'trial-book', surface: sourceSurface }],
      },
    },
  );
  const audit = auditTutorStubJointPerformanceOwnership({
    composition,
    candidate: composition.text,
    configuration,
    world,
    performanceObligationContract,
  });

  assert.equal(composition.text.includes(sourceSurface), true);
  assert.equal(audit.performanceText.includes(sourceSurface), false);
  assert.deepEqual(audit.boundaries.excluded_host_source_spans, ['source_1']);
  assert.equal(audit.axes.actorial_part.visible, true);
  assert.equal(audit.axes.actorial_performance.visible, false);
  assert.ok(audit.issues.some((issue) => issue.axis === 'actorial_performance'));
});

test('V27 keeps action ownership in HANDOFF even when PERFORMANCE carries next-step language', () => {
  const row = {
    uptake: 'Write: The lead-sweat shows poor metal.',
    entry: 'Together, we hold the shilling at the touchstone.',
    response: 'What should we check next on the touchstone?',
    handoff: 'The balance rests on the bench.',
  };
  const composition = v2Composition(row);
  const audit = auditTutorStubJointPerformanceOwnership({
    composition,
    candidate: composition.text,
    configuration: warmScenePartnerConfiguration(),
    world: marrickWorld(),
  });

  assert.equal(audit.axes.actorial_performance.visible, true);
  assert.equal(audit.axes.action_family.owner, 'handoff');
  assert.equal(audit.axes.action_family.visible, false);
  assert.ok(audit.issues.some((issue) => issue.axis === 'action_family' && issue.owner === 'handoff'));
});

test('V27 addition leaves the v1 structured ownership contract unchanged', () => {
  const configuration = {
    engagement_stance: 'precise',
    action_family: 'stage_next_step',
    audience_register: 'adult_novice',
    lexical_accessibility: 'plain',
    scene_immersion: 'minimal',
    actorial_part: 'record_keeper',
    actorial_part_label: 'record keeper',
    actorial_part_selection: {},
    actorial_performance: { id: 'evidentiary_boundary', label: 'evidentiary boundary' },
    unresolved_terms: [],
  };
  const structured = parseTutorStubStructuredFirstDraft(
    JSON.stringify({
      uptake: 'Your caution keeps the claim within the record.',
      part: 'I open the visitor ledger beside you.',
      tactic: 'The entry proves issuance only, not entry into the kitchen.',
      handoff: 'What does the code establish, but not yet prove?',
    }),
  );
  const composition = composeTutorStubStructuredFirstDraft({ structured });
  const audit = auditTutorStubStructuredSlotOwnership({ composition, configuration });

  assert.equal(audit.schema, TUTOR_STUB_STRUCTURED_SLOT_AUDIT_SCHEMA);
  assert.equal(audit.ok, true);
  assert.deepEqual(
    Object.fromEntries(Object.entries(audit.axes).map(([axis, value]) => [axis, value.owner])),
    {
      actorial_part: 'part',
      actorial_performance: 'tactic',
      action_family: 'handoff',
      engagement_stance: 'handoff',
    },
  );
});
