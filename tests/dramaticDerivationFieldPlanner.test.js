import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  buildDialogueReport,
  FIELD_PLANNER_SCHEMA,
  FIELD_PLANNER_PROJECTION_SCHEMA,
  loadWorld,
  runDrama,
  selectFieldPlannerMove,
} from '../services/dramaticDerivation/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SMOKE_WORLD = loadWorld(path.join(ROOT, 'config/drama-derivation/world-000-smoke.yaml'));

test('field planner maps high-risk learner attractor to scope test and contrast case', () => {
  const plan = selectFieldPlannerMove({
    world: SMOKE_WORLD,
    turn: 3,
    interactionField: {
      final: {
        turn: 3,
        learner: {
          dimensions: {
            mastery: 0.1,
            evidenceGrounding: 0.1,
            productiveConfusion: 0.2,
          },
          attractorCounts: { misconception_attractor: 1 },
          meanSpeed: 0.1,
        },
        tutor: { dimensions: { pedagogicalUncertainty: 0.8 } },
        discourse: { dimensions: { openQuestions: 0.8 } },
        joint: {
          dimensions: {
            couplingStrength: 0.2,
            pedagogicalAlignment: 0.3,
            productiveTension: 0.25,
            interactionMomentum: 0.2,
            trajectoryRisk: 0.75,
          },
          attractor: 'asymmetric_drift',
        },
        script: { stage: 'failure' },
      },
    },
    learnerField: {
      turns: [
        {
          turn: 3,
          nodes: [{ premiseId: 'p1', released: true, held: false, releaseTurn: 2 }],
          summary: {
            dimensions: { mastery: 0.1, evidenceGrounding: 0.1 },
            attractorCounts: { misconception_attractor: 1 },
            meanSpeed: 0.1,
          },
        },
      ],
    },
  });

  assert.equal(plan.schema, FIELD_PLANNER_SCHEMA);
  assert.equal(plan.projection.schema, FIELD_PLANNER_PROJECTION_SCHEMA);
  assert.equal(plan.selectedMoveFamily, 'ask_scope_test');
  assert.equal(plan.targetPremise, 'p1');
  assert.equal(plan.didacticMode.recommendedMode, 'contrast_case');
  assert.equal(plan.conductDecision.selectedMoveFamily, 'ask_scope_test');
  assert.equal(plan.conductDecision.nonLeakAudit.ok, true);
  assert.ok(plan.candidateMoves.length >= 8);
  assert.equal(plan.candidateMoves[0].moveFamily, 'ask_scope_test');
  assert.ok(plan.expectedMovement.joint.trajectoryRisk < 0);
  assert.match(plan.promptLines.join('\n'), /conduct family: ask_scope_test/u);
  assert.match(plan.promptLines.join('\n'), /candidate projection:/u);
});

test('field planner cannot let consolidation outrank a due scheduled release', () => {
  const plan = selectFieldPlannerMove({
    world: SMOKE_WORLD,
    turn: 8,
    interactionField: {
      final: {
        turn: 8,
        learner: {
          dimensions: {
            mastery: 0.42,
            evidenceGrounding: 0.46,
            productiveConfusion: 0.35,
          },
          attractorCounts: {},
          meanSpeed: 0.08,
        },
        tutor: { dimensions: { diagnosticConfidence: 0.5, instructionalMomentum: 0.3 } },
        discourse: { dimensions: { explanatoryStructure: 0.55, commitmentStrength: 0.45 } },
        joint: {
          dimensions: {
            couplingStrength: 0.5,
            pedagogicalAlignment: 0.55,
            productiveTension: 0.5,
            interactionMomentum: 0.3,
            trajectoryRisk: 0.2,
          },
          attractor: 'productive_tension',
        },
        script: {
          stage: 'stress-test',
          preferredMoves: ['consolidate_subproof'],
          antiPatterns: ['release_next_evidence'],
        },
      },
    },
    learnerField: { turns: [] },
    nextScheduledRelease: { turn: 8, premise: 'p1', via: 'tutor' },
  });

  const scores = Object.fromEntries(plan.candidateMoves.map((candidate) => [candidate.moveFamily, candidate.score]));
  assert.ok(scores.consolidate_subproof > scores.release_next_evidence);
  assert.equal(plan.projection.context.selectionOverride, 'due_release_dominates_field_score');
  assert.equal(plan.selectedMoveFamily, 'release_next_evidence');
  assert.equal(plan.targetPremise, 'p1');
  assert.equal(plan.conductDecision.selectedMoveFamily, 'release_next_evidence');
});

test('runDrama computes and records field planner rows before tutor turns', async () => {
  const tutorViews = [];
  const result = await runDrama({
    world: SMOKE_WORLD,
    roles: {
      director: async () => ({ direction: '[The inquiry opens.]' }),
      tutor: async (view) => {
        tutorViews.push(JSON.parse(JSON.stringify(view)));
        return {
          dialogue: 'Hold the current public object and say what it licenses.',
          move: { figure: 'erotema', targetPremise: view.fieldPlanner?.targetPremise || null, intent: 'consolidate' },
        };
      },
      learner: async () => ({ dialogue: 'I am listening.' }),
    },
    options: {
      fieldPlanner: true,
      maxTurns: 1,
      stopOnStall: false,
    },
  });

  assert.equal(tutorViews.length, 1);
  assert.equal(tutorViews[0].fieldPlanner.schema, FIELD_PLANNER_SCHEMA);
  assert.equal(result.fieldPlanner.length, 1);
  assert.equal(result.fieldPlanner[0].schema, FIELD_PLANNER_SCHEMA);
  assert.ok(result.fieldPlanner[0].candidateMoves.length >= 8);
  assert.ok(result.fieldPlanner[0].expectedMovement);
  assert.ok(result.fieldPlanner[0].projection.selected.score !== null);
  assert.equal(result.fieldPlanner[0].outcome.efficacy, 'no_immediate_movement');
  assert.equal(result.fieldPlanner[0].outcome.projectionAlignment, 'not_observed_yet');
  const tutorLine = result.transcript.find((line) => line.role === 'tutor');
  assert.equal(tutorLine.meta.fieldPlanner.schema, FIELD_PLANNER_SCHEMA);
  assert.ok(tutorLine.meta.fieldPlanner.selectedScore !== null);

  const report = buildDialogueReport(result, SMOKE_WORLD, { label: 'field-planner-report-smoke' });
  assert.equal(report.fieldPlanner.count, 1);
  assert.equal(report.summary.fieldPlannerCount, 1);
  assert.equal(report.fieldPlanner.rows[0].candidateCount, result.fieldPlanner[0].candidateMoves.length);
});
