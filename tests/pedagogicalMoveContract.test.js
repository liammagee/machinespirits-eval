import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { PEDAGOGICAL_MOVE_TYPES, validatePedagogicalMove } from '../services/pedagogicalMove/contract.js';
import { createPedagogicalMoveShadowRecord } from '../services/pedagogicalMove/shadow.js';
import {
  ADAPTATION_ACTIONS,
  estimateLearnerStateBelief,
  selectPedagogicalAction,
} from '../services/adaptiveTutor/actionPolicy.js';
import { adaptPedagogicalActionToTutorStub } from '../services/adaptiveTutor/tutorStubActionAdapter.js';
import {
  ADAPTIVE_ACTION_TO_PEDAGOGICAL_MOVE,
  assertAdaptivePedagogicalMoveMappingComplete,
  projectAdaptiveActionToPedagogicalMove,
} from '../services/adaptiveTutor/pedagogicalMoveProjection.js';
import { ADAPTIVE_WARRANT_ACTION_FAMILY_CONTRACTS } from '../services/adaptiveWarrantActionContracts.js';
import {
  TUTOR_STUB_ACTION_FAMILY_TO_PEDAGOGICAL_MOVE,
  assertTutorStubPedagogicalMoveMappingComplete,
  projectTutorStubActionFamilyToPedagogicalMove,
} from '../services/tutorStubPedagogicalMoveProjection.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REALIZATION_KEYS = new Set([
  'actorial_part',
  'audience_register',
  'character',
  'engagement_stance',
  'learner_character',
  'lexical_accessibility',
  'performance_tactic',
  'register',
  'register_vector',
  'scene_immersion',
  'selected_register',
  'stance',
  'tone',
  'tutor_character',
]);

function collectKeys(value, found = new Set()) {
  if (!value || typeof value !== 'object') return found;
  if (Array.isArray(value)) {
    value.forEach((entry) => collectKeys(entry, found));
    return found;
  }
  for (const [key, entry] of Object.entries(value)) {
    found.add(key);
    collectKeys(entry, found);
  }
  return found;
}

function selectedAdaptiveAction() {
  const belief = estimateLearnerStateBelief({
    dialogue: [{ role: 'learner', content: 'I am not sure; can you just tell me the next step?' }],
    turnIndex: 2,
  });
  return selectPedagogicalAction({ stateBelief: belief, mode: 'closed_loop' }).selectedAction;
}

function tutorStubV2Action() {
  return adaptPedagogicalActionToTutorStub({
    action: selectedAdaptiveAction(),
    task: {
      taskId: 'marrick-proof-path',
      knowledgeComponent: 'evidence-to-warrant linkage',
      prerequisitePath: ['identify public evidence', 'state the warrant'],
      itemDifficulty: 0.62,
    },
    register: 'sarcastic',
  });
}

test('the neutral contract imports no host and admits no realization field', () => {
  const source = fs.readFileSync(path.join(ROOT, 'services', 'pedagogicalMove', 'contract.js'), 'utf8');
  assert.doesNotMatch(source, /from\s+['"][^'"]*(?:adaptiveTutor|adaptiveWarrant|tutorStub)/u);

  const move = projectAdaptiveActionToPedagogicalMove(tutorStubV2Action());
  for (const key of collectKeys(move)) assert.equal(REALIZATION_KEYS.has(key), false, `move contains ${key}`);
  assert.throws(() => validatePedagogicalMove({ ...move, register: 'plain' }), /downstream realization field/u);
  assert.throws(() => validatePedagogicalMove({ ...move, character: 'satirist' }), /downstream realization field/u);
});

test('Phase 1 has no live caller for either host projection', () => {
  const roots = ['services', 'scripts', 'routes'];
  const projectionImport =
    /from\s+['"][^'"]*(?:adaptiveTutor\/pedagogicalMoveProjection|tutorStubPedagogicalMoveProjection)\.js['"]/u;
  const callers = [];
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (
        entry.isFile() &&
        entry.name.endsWith('.js') &&
        projectionImport.test(fs.readFileSync(absolute, 'utf8'))
      ) {
        callers.push(path.relative(ROOT, absolute));
      }
    }
  };
  roots.forEach((root) => visit(path.join(ROOT, root)));
  assert.deepEqual(callers, []);
});

test('the adaptive action map is exact, typed, and does not promote a family label', () => {
  assert.equal(assertAdaptivePedagogicalMoveMappingComplete(), true);
  assert.deepEqual(
    Object.keys(ADAPTIVE_ACTION_TO_PEDAGOGICAL_MOVE).sort(),
    ADAPTATION_ACTIONS.map((action) => action.action_type).sort(),
  );
  for (const [actionType, moveType] of Object.entries(ADAPTIVE_ACTION_TO_PEDAGOGICAL_MOVE)) {
    assert.ok(PEDAGOGICAL_MOVE_TYPES.includes(moveType));
    assert.notEqual(moveType, actionType);
  }
});

test('the adaptive projection preserves action semantics while dropping register', () => {
  const source = tutorStubV2Action();
  const frozenSource = structuredClone(source);
  const move = projectAdaptiveActionToPedagogicalMove(source);

  assert.deepEqual(source, frozenSource);
  assert.equal(move.compatibility.action_type, source.action_type);
  assert.equal(move.compatibility.action_family, source.move_family);
  assert.deepEqual(move.target.axes, source.target_axes);
  assert.deepEqual(move.expected_uptake.required_signals, source.success_signal.required_evidence);
  assert.deepEqual(move.expected_uptake.forbidden_signals, source.success_signal.forbidden_evidence);
  assert.deepEqual(move.constraints.forbidden_moves, source.forbidden_moves);
  assert.deepEqual(move.transition_contract.expected_state_delta, source.expected_transition);
  assert.equal(move.provenance.host, 'adaptive_tutor');
  assert.equal(Object.hasOwn(move, 'register'), false);
});

test('the tutor-stub family map is exact and preserves expected-uptake lifecycle contracts', () => {
  assert.equal(assertTutorStubPedagogicalMoveMappingComplete(), true);
  assert.deepEqual(
    Object.keys(TUTOR_STUB_ACTION_FAMILY_TO_PEDAGOGICAL_MOVE).sort(),
    Object.keys(ADAPTIVE_WARRANT_ACTION_FAMILY_CONTRACTS).sort(),
  );

  for (const [actionFamily, contract] of Object.entries(ADAPTIVE_WARRANT_ACTION_FAMILY_CONTRACTS)) {
    const move = projectTutorStubActionFamilyToPedagogicalMove({ actionFamily });
    assert.ok(PEDAGOGICAL_MOVE_TYPES.includes(move.move_type));
    assert.notEqual(move.move_type, actionFamily);
    assert.equal(move.compatibility.action_family, actionFamily);
    assert.deepEqual(move.expected_uptake.required_signals, contract.expected_learner_responses);
    assert.equal(move.expected_uptake.deadline_turns, contract.deadline_turns);
    assert.deepEqual(move.transition_contract.lifecycle, {
      success: contract.success_transition,
      defeat: contract.defeat_transition,
      expiry: contract.expiry_transition,
    });
    assert.equal(move.transition_contract.terminal, contract.terminal);
  }
});

test('low-agency and overconfident shadow fixtures conserve legacy identity and labels', () => {
  const fixtures = [
    {
      learner_profile_id: 'low_agency',
      arm_assignment: 'gated',
      warrant_basis: { kind: 'commitment_transition', status: 'satisfied' },
      selected_action_family: 'challenge_resistance',
      selected_action_type: null,
      protected_result_labels: ['development-tier', 'no-human-learning'],
    },
    {
      learner_profile_id: 'overconfident',
      arm_assignment: 'standing_permission',
      warrant_basis: { kind: 'claim_check', status: 'satisfied' },
      selected_action_family: 'clarify_distinction',
      selected_action_type: null,
      protected_result_labels: ['post-hoc', 'late-scored-registered-endpoint', 'directional-only'],
    },
  ];

  for (const context of fixtures) {
    const projectedMove = projectTutorStubActionFamilyToPedagogicalMove({
      actionFamily: context.selected_action_family,
    });
    const legacyDecision = {
      action_family: context.selected_action_family,
      warrant_basis: structuredClone(context.warrant_basis),
    };
    const record = createPedagogicalMoveShadowRecord({
      legacyContext: context,
      expectedContext: structuredClone(context),
      legacyDecision,
      projectedMove,
    });

    assert.equal(record.authority, 'legacy');
    assert.equal(record.consumer_switch_authorized, false);
    assert.equal(record.parity.status, 'pass');
    assert.deepEqual(record.parity.mismatches, []);
    assert.deepEqual(record.legacy_context, context);
    assert.deepEqual(record.legacy_decision, legacyDecision);
  }
});

test('a conservation mismatch is explicit and can never authorize a consumer switch', () => {
  const expected = {
    learner_profile_id: 'low_agency',
    arm_assignment: 'gated',
    warrant_basis: { kind: 'commitment_transition' },
    selected_action_family: 'challenge_resistance',
    selected_action_type: null,
    protected_result_labels: ['development-tier'],
  };
  const observed = { ...structuredClone(expected), arm_assignment: 'bare' };
  const record = createPedagogicalMoveShadowRecord({
    legacyContext: observed,
    expectedContext: expected,
    legacyDecision: { action_family: 'challenge_resistance' },
    projectedMove: projectTutorStubActionFamilyToPedagogicalMove({ actionFamily: 'challenge_resistance' }),
  });

  assert.equal(record.parity.status, 'mismatch');
  assert.deepEqual(record.parity.mismatches, ['arm_assignment']);
  assert.equal(record.consumer_switch_authorized, false);
});
