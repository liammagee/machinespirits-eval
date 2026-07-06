import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  buildDialogueReport,
  DIALOGUE_REPORT_SCHEMA,
  renderDialogueReportArtifacts,
  renderDialogueReportMarkdown,
  renderDynamicLearnerFieldSvg,
} from '../services/dramaticDerivation/dialogueReport.js';
import { buildLearnerDag, buildLearnerDagSnapshot } from '../services/dramaticDerivation/learnerDag.js';
import { loadWorld } from '../services/dramaticDerivation/world.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function smokeWorld() {
  return loadWorld(path.join(ROOT, 'config/drama-derivation/world-000-smoke.yaml'));
}

function ledgerThrough(turn) {
  return [
    { turn: 2, premiseId: 'p1', via: 'director' },
    { turn: 4, premiseId: 'p4', via: 'director' },
    { turn: 5, premiseId: 'p2', via: 'tutor' },
  ].filter((row) => row.turn <= turn);
}

function resultWithLearnerDag(world) {
  const p1 = world.premiseById.get('p1').fact;
  const p2 = world.premiseById.get('p2').fact;
  const learnerDag = buildLearnerDag(
    [
      buildLearnerDagSnapshot(world, {
        turn: 2,
        boardFacts: [p1],
        validFacts: [p1],
        ledger: ledgerThrough(2),
      }),
      buildLearnerDagSnapshot(world, {
        turn: 5,
        boardFacts: [p1, p2],
        validFacts: [p1, p2],
        assertion: ['heir', 'joren'],
        ledger: ledgerThrough(5),
      }),
    ],
    world,
  );
  return {
    worldId: world.id,
    verdict: 'aporia',
    events: [{ turn: 5, type: 'learner_assertion', detail: 'unsupported mirror assertion' }],
    trajectory: [],
    transcript: [],
    ledger: ledgerThrough(5),
    learnerDag,
    firstForcedTurn: null,
    assertedGroundedTurn: null,
    turnsPlayed: 5,
  };
}

test('buildDialogueReport accumulates learner-field movement and renders sibling artifacts', () => {
  const world = smokeWorld();
  const report = buildDialogueReport(resultWithLearnerDag(world), world, {
    label: 'dialogue-report-smoke',
    diagnosis: {
      turnCap: world.turnCap,
      dialogueDiscipline: { learner: { turns: 2, avgWords: 5 } },
    },
  });

  assert.equal(report.schema, DIALOGUE_REPORT_SCHEMA);
  assert.equal(report.label, 'dialogue-report-smoke');
  assert.equal(report.dynamicLearnerField.turns.length, 2);
  assert.equal(report.pedagogicalInteractionField.turns.length, 2);
  assert.equal(report.pedagogicalInteractionField.script.id, 'prediction_failure_repair_generalisation_transfer');
  assert.equal(report.pedagogicalInteractionField.turns[0].tutor.schema, 'machinespirits.derivation.tutor-field.v1');
  assert.equal(report.pedagogicalInteractionField.turns[0].discourse.schema, 'machinespirits.derivation.discourse-field.v1');
  assert.ok(report.pedagogicalInteractionField.turns[0].tutor.evidence);
  assert.ok(report.pedagogicalInteractionField.turns[0].discourse.evidence);
  assert.ok(report.summary.fieldDelta.mastery > 0);
  assert.equal(report.summary.evidenceNodeCount, 1);
  assert.ok((report.summary.finalAttractorCounts.misconception_attractor || 0) >= 1);
  assert.ok(report.summary.interactionFinalDimensions.couplingStrength >= 0);

  const svg = renderDynamicLearnerFieldSvg(report);
  assert.match(svg, /^<svg /);
  assert.match(svg, /Coupled pedagogical interaction field movement/);
  assert.match(svg, /Synchronized fields/);
  assert.match(svg, /Tutor field/);
  assert.match(svg, /Discourse field/);
  assert.match(svg, /Learner-evidence signals/);

  const markdown = renderDialogueReportMarkdown(report);
  assert.match(markdown, /!\[Coupled pedagogical interaction field movement\]\(dynamic-field\.svg\)/);
  assert.match(markdown, /misconception_attractor/);
  assert.match(markdown, /Coupled Pedagogical Interaction Field/);
  assert.match(markdown, /Learner DAG Assessment/);

  const artifacts = renderDialogueReportArtifacts(report);
  assert.deepEqual(Object.keys(artifacts).sort(), ['dialogue-report.json', 'dialogue-report.md', 'dynamic-field.svg']);
  assert.match(artifacts['dialogue-report.json'], /"schema": "machinespirits\.derivation\.dialogue-report\.v1"/);
});
