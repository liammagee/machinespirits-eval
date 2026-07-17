import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  auditTutorStubDramaticReleaseResponse,
  buildTutorStubDramaticReleaseFrame,
} from '../services/tutorStubDramaticRelease.js';
import { compileTutorStubPerformanceObligationContract } from '../services/tutorStubPerformanceObligationContract.js';
import { auditTutorStubResponseConfiguration } from '../services/tutorStubResponseConfiguration.js';

const fixture = JSON.parse(
  readFileSync(
    new URL('./fixtures/tutor-stub-first-draft/marrick-answer-seeking-v25-i4-turn9.json', import.meta.url),
    'utf8',
  ),
);

function contractForFixture() {
  return compileTutorStubPerformanceObligationContract({
    responseConfiguration: fixture.configuration,
    publicWorld: {
      visibility: 'public',
      ...fixture.world,
    },
    publicTurn: {
      visibility: 'public',
      learner_move: fixture.public_turn.learner_move,
      pressure_target: fixture.public_turn.pressure_target,
      contrary_evidence: [fixture.public_turn.contrary_evidence],
      public_evidence: [{ surface: fixture.public_turn.pressure_target }],
      due_evidence: [fixture.due_evidence],
    },
  });
}

test('saved V25 I4 turn 9 re-audits possessive source object and enacted quotation correctly', () => {
  const frame = buildTutorStubDramaticReleaseFrame({ dueEvidence: [fixture.due_evidence] });
  const audit = auditTutorStubDramaticReleaseResponse({ text: fixture.candidate, frame });

  assert.equal(audit.roleStageDirection, false);
  assert.equal(audit.enactmentVisible, true);
  assert.equal(audit.ok, true);
});

test('saved V25 I4 turn 9 recognizes faltering counterpressure under its exact public contract', () => {
  const contract = contractForFixture();
  const audit = auditTutorStubResponseConfiguration({
    text: fixture.candidate,
    configuration: fixture.configuration,
    world: fixture.world,
    performanceObligationContract: contract,
  });

  assert.equal(contract.complete, true);
  assert.deepEqual(
    contract.obligations.map((entry) => entry.id),
    ['public_pressure_target', 'contrary_evidence', 'visible_action', 'learner_handoff'],
  );
  assert.equal(audit.axes.actorial_part.part_visible, true);
  assert.equal(audit.axes.actorial_part.performance_visible, true);
  assert.equal(audit.transcript_visible, true);
  assert.equal(fixture.known_structural_miss, 'tactic_handoff_slot_fusion');
});

test('saved V25 falter recognition fails closed when the contrary source is absent', () => {
  const contract = contractForFixture();
  const withoutSource = fixture.candidate.replace(/“I read in the record that [^”]+”\s*/u, '');
  const audit = auditTutorStubResponseConfiguration({
    text: withoutSource,
    configuration: fixture.configuration,
    world: fixture.world,
    performanceObligationContract: contract,
  });

  assert.equal(audit.axes.actorial_part.performance_visible, false);
  assert.equal(audit.transcript_visible, false);
});
