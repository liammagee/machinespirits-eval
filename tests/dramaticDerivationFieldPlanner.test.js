import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  FIELD_PLANNER_SCHEMA,
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
  assert.equal(plan.selectedMoveFamily, 'ask_scope_test');
  assert.equal(plan.targetPremise, 'p1');
  assert.equal(plan.didacticMode.recommendedMode, 'contrast_case');
  assert.equal(plan.conductDecision.selectedMoveFamily, 'ask_scope_test');
  assert.equal(plan.conductDecision.nonLeakAudit.ok, true);
  assert.match(plan.promptLines.join('\n'), /conduct family: ask_scope_test/u);
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
  assert.equal(result.fieldPlanner[0].outcome.efficacy, 'no_immediate_movement');
  const tutorLine = result.transcript.find((line) => line.role === 'tutor');
  assert.equal(tutorLine.meta.fieldPlanner.schema, FIELD_PLANNER_SCHEMA);
});
