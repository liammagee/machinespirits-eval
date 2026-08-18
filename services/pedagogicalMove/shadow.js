/**
 * Deterministic shadow record for comparing a legacy decision with its neutral
 * PedagogicalMove projection. Phase 1 is observation-only: the legacy decision
 * remains authoritative and this record can never authorize a consumer switch.
 */

import { isDeepStrictEqual } from 'node:util';

import { validatePedagogicalMove } from './contract.js';

export const PEDAGOGICAL_MOVE_SHADOW_SCHEMA = 'machinespirits.pedagogical-move-shadow.v1';

const CONSERVED_FIELDS = Object.freeze([
  'learner_profile_id',
  'arm_assignment',
  'warrant_basis',
  'selected_action_family',
  'selected_action_type',
  'protected_result_labels',
]);

function clone(value) {
  return structuredClone(value);
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`pedagogicalMoveShadow: ${label} must be an object`);
  }
  return value;
}

function validateLegacyContext(context) {
  requireObject(context, 'legacyContext');
  if (typeof context.learner_profile_id !== 'string' || !context.learner_profile_id.trim()) {
    throw new Error('pedagogicalMoveShadow: legacyContext.learner_profile_id is required');
  }
  if (!Array.isArray(context.protected_result_labels)) {
    throw new Error('pedagogicalMoveShadow: legacyContext.protected_result_labels must be an array');
  }
  return context;
}

function compareField(mismatches, field, observed, expected) {
  if (!isDeepStrictEqual(observed, expected)) mismatches.push(field);
}

export function createPedagogicalMoveShadowRecord({
  legacyContext,
  expectedContext = null,
  legacyDecision,
  projectedMove,
} = {}) {
  const observed = clone(validateLegacyContext(clone(legacyContext)));
  const expected = expectedContext == null ? null : clone(validateLegacyContext(clone(expectedContext)));
  const move = clone(validatePedagogicalMove(clone(projectedMove)));
  const mismatches = [];

  if (expected) {
    for (const field of CONSERVED_FIELDS) compareField(mismatches, field, observed[field], expected[field]);
  }
  if (observed.selected_action_family != null && observed.selected_action_family !== move.compatibility.action_family) {
    mismatches.push('projected_action_family');
  }
  if (observed.selected_action_type != null && observed.selected_action_type !== move.compatibility.action_type) {
    mismatches.push('projected_action_type');
  }

  return {
    schema: PEDAGOGICAL_MOVE_SHADOW_SCHEMA,
    authority: 'legacy',
    consumer_switch_authorized: false,
    legacy_context: observed,
    expected_context: expected,
    legacy_decision: clone(legacyDecision),
    projected_move: move,
    parity: {
      assessed: expected != null,
      status: mismatches.length ? 'mismatch' : expected ? 'pass' : 'unassessed',
      conserved_fields: [...CONSERVED_FIELDS],
      mismatches,
    },
  };
}
