import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyTutorStubPerformanceAdjudication,
  parseTutorStubPerformanceAdjudication,
  tutorStubPerformanceAdjudicationEligibility,
} from '../tutorStubPerformanceAdjudication.js';
import { compileTutorStubPerformanceObligationContract } from '../tutorStubPerformanceObligationContract.js';

const CANDIDATE =
  'My case is that Crane’s byline alone cannot name the planter; break it if the kicker itself points to Crane. The archive breaks the desk’s shortcut. We need to test the closing graf next.';

function configuration() {
  return {
    engagement_stance: 'charismatic',
    action_family: 'stage_next_step',
    audience_register: 'adult_novice',
    lexical_accessibility: 'plain',
    scene_immersion: 'immersive',
    actorial_part: 'advocate',
    actorial_part_label: 'advocate for the live case',
    actorial_performance: {
      id: 'dramatic_counterpressure',
      label: 'dramatic counterpressure',
      contract: 'Challenge the ready judgment with contrary public evidence.',
    },
  };
}

function contract() {
  return compileTutorStubPerformanceObligationContract({
    responseConfiguration: configuration(),
    publicWorld: {
      visibility: 'public',
      title: 'The Recalled Edition',
      setting: 'The archive desk stands beside the corrections file.',
      question: 'Who planted the false quotation?',
      public_objects: ['archive', 'corrections file'],
    },
    publicTurn: {
      visibility: 'public',
      learner_move: 'What should I write next about the kicker?',
      pressure_target: 'Crane’s byline alone cannot name the planter',
      public_claims: ['the desk’s shortcut names Crane from the byline'],
      contrary_evidence: ['The archive breaks the desk’s shortcut.'],
      public_evidence: [{ surface: 'the closing graf' }],
    },
  });
}

function passingAudit() {
  const axes = Object.fromEntries(
    ['engagement_stance', 'action_family', 'audience_register', 'lexical_accessibility', 'scene_immersion'].map(
      (id) => [id, { visible: true }],
    ),
  );
  axes.actorial_part = {
    selected: 'advocate',
    performance_tactic: 'dramatic_counterpressure',
    part_visible: true,
    performance_visible: false,
    visible: false,
  };
  const pass = { ok: true, issues: [] };
  return {
    ok: false,
    leakAudit: { ok: true, leaks: [] },
    scaffoldAudit: structuredClone(pass),
    questionSupportAudit: structuredClone(pass),
    dramaticReleaseAudit: structuredClone(pass),
    responseCompositionAudit: structuredClone(pass),
    repetitionAudit: structuredClone(pass),
    closureAudit: structuredClone(pass),
    releaseDeliveryAudit: { ok: true, missingPremises: [] },
    actorReadout: 'untouched',
    actorialRealizationAudit: {
      ok: false,
      issues: [{ type: 'missing_selected_performance_tactic' }],
    },
    responseConfigurationAudit: {
      axes,
      axis_count: 6,
      visible_axis_count: 5,
      realization_rate: 0.833,
      visible_signature: 'part:not_visible|tactic:not_visible',
      metrics: { fourthWallBreak: false },
      actorial_realization: {
        ok: false,
        issues: [{ type: 'missing_selected_performance_tactic' }],
      },
    },
  };
}

function exactSpan(obligationId, text) {
  const start = CANDIDATE.indexOf(text);
  assert.notEqual(start, -1);
  return { obligation_id: obligationId, start, end: start + text.length, text };
}

function realizedRaw() {
  return JSON.stringify({
    verdict: 'realized',
    evidence: [
      exactSpan('public_pressure_target', 'Crane’s byline alone cannot name the planter'),
      exactSpan('contrary_evidence', 'The archive breaks the desk’s shortcut.'),
      exactSpan(
        'visible_action',
        'My case is that Crane’s byline alone cannot name the planter; break it if the kicker itself points to Crane.',
      ),
      exactSpan('learner_handoff', 'We need to test the closing graf next.'),
    ],
    reason: 'The advocate stages the claim, contrary archive evidence, challenge, and next test.',
  });
}

test('isolated counterpressure miss is eligible and exact semantic evidence corrects only recognition', () => {
  const audits = passingAudit();
  const eligibility = tutorStubPerformanceAdjudicationEligibility({
    audits,
    contract: contract(),
    configuration: configuration(),
  });
  assert.equal(eligibility.eligible, true);

  const adjudication = parseTutorStubPerformanceAdjudication({
    raw: realizedRaw(),
    candidate: CANDIDATE,
    contract: contract(),
  });
  assert.equal(adjudication.recognized, true);
  assert.ok(adjudication.evidence_audit.overlaps.length > 0);

  const applied = applyTutorStubPerformanceAdjudication({ audits, adjudication, eligibility });
  assert.equal(applied.applied, true);
  assert.equal(applied.audits.actorialRealizationAudit.ok, true);
  assert.equal(applied.audits.responseConfigurationAudit.axes.actorial_part.performance_visible, true);
  assert.equal(applied.audits.responseConfigurationAudit.realization_rate, 1);
  assert.equal(applied.audits.actorReadout, 'untouched');
  assert.equal(audits.actorialRealizationAudit.ok, false, 'source audit remains immutable');
});

test('a separate invisible action axis makes a candidate ineligible', () => {
  const audits = passingAudit();
  audits.responseConfigurationAudit.axes.action_family.visible = false;
  const eligibility = tutorStubPerformanceAdjudicationEligibility({
    audits,
    contract: contract(),
    configuration: configuration(),
  });
  assert.equal(eligibility.eligible, false);
  assert.ok(eligibility.reasons.includes('axis_not_visible:action_family'));
});

test('every deterministic hard audit remains a veto', () => {
  for (const key of [
    'leakAudit',
    'scaffoldAudit',
    'questionSupportAudit',
    'dramaticReleaseAudit',
    'responseCompositionAudit',
    'repetitionAudit',
    'closureAudit',
    'releaseDeliveryAudit',
  ]) {
    const audits = passingAudit();
    audits[key] = { ok: false, issues: [{ type: 'synthetic_failure' }] };
    const eligibility = tutorStubPerformanceAdjudicationEligibility({
      audits,
      contract: contract(),
      configuration: configuration(),
    });
    assert.equal(eligibility.eligible, false, key);
    assert.ok(eligibility.reasons.includes(`hard_audit_failed:${key}`), key);
  }
});

test('missing deterministic audit evidence makes semantic adjudication ineligible', () => {
  const audits = passingAudit();
  delete audits.releaseDeliveryAudit;
  const eligibility = tutorStubPerformanceAdjudicationEligibility({
    audits,
    contract: contract(),
    configuration: configuration(),
  });
  assert.equal(eligibility.eligible, false);
  assert.deepEqual(eligibility.reasons, ['hard_audit_failed:releaseDeliveryAudit']);
});

test('malformed, uncertain, and hallucinated adjudications fail closed', () => {
  const rows = [
    'not json',
    JSON.stringify({ verdict: 'uncertain', evidence: [], reason: 'unclear' }),
    JSON.stringify({
      verdict: 'realized',
      evidence: [
        { obligation_id: 'public_pressure_target', start: 0, end: 9, text: 'not there' },
      ],
    }),
  ];
  for (const raw of rows) {
    const adjudication = parseTutorStubPerformanceAdjudication({
      raw,
      candidate: CANDIDATE,
      contract: contract(),
    });
    assert.equal(adjudication.recognized, false);
  }
});
