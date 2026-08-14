import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import { buildTutorStubSimplifiedRecoveryConfiguration } from './tutorStubGuardRecovery.js';
import { buildTutorStubSpeakingResponseConfiguration } from './tutorStubPerformanceObligationContract.js';

export const ADAPTIVE_WARRANT_SELECTOR_APPLICATION_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-selector-application.v1';
export const ADAPTIVE_WARRANT_DELIVERY_TRANSITION_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-delivery-transition.v1';

const FINAL_AUTHORITY_COMPATIBILITY_FIELDS = Object.freeze([
  'pre_final_warrant_action_family',
  'final_authority_configuration_source',
]);

export const ADAPTIVE_WARRANT_DIRECT_DELIVERY_SOURCES = Object.freeze([
  'original_candidate',
  'actorial_part_repair_candidate',
  'clue_insertion',
]);

export const ADAPTIVE_WARRANT_SIMPLIFIED_RECOVERY_SOURCES = Object.freeze([
  'plain_recovery_candidate',
  'composition_repair_candidate',
  'question_support_repair_candidate',
  'source_voice_repair_candidate',
  'self_correction_candidate',
  'deterministic_fallback',
]);

export const ADAPTIVE_WARRANT_SELECTOR_OVERRIDE_MUTABLE_FIELDS = Object.freeze([
  'engagement_stance',
  'selected_register',
  'pre_override_engagement_stance_distribution',
  'distribution',
  'engagement_stance_distribution',
  'selected_probability',
  'register_reason',
  'engagement_stance_reason',
  'reviewer_signal',
  'expected_dag_move',
  'expected_field_move',
  'source',
]);

export const ADAPTIVE_WARRANT_SELECTOR_DIRECTIVE_MUTABLE_FIELDS = Object.freeze([
  'public_obligation_directive',
  'expected_dag_move',
  'expected_field_move',
  'source',
]);

function jsonClone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortJson(value[key])]),
  );
}

export function hashAdaptiveWarrantJson(value) {
  const encoded = JSON.stringify(sortJson(jsonClone(value)));
  return createHash('sha256')
    .update(encoded === undefined ? 'null' : encoded)
    .digest('hex');
}

/**
 * Remove only metadata added by final authority itself. The resulting digest
 * binds every substantive configuration axis selected before optional policy
 * layers ran, while avoiding a circular hash over the enforcement record.
 */
export function canonicalAdaptiveWarrantResponseConfiguration(configuration = null) {
  if (!configuration) return null;
  const canonical = jsonClone(configuration);
  delete canonical.adaptive_warrant_enforcement;
  if (canonical.compatibility && typeof canonical.compatibility === 'object') {
    for (const field of FINAL_AUTHORITY_COMPATIBILITY_FIELDS) delete canonical.compatibility[field];
  }
  return canonical;
}

export function hashAdaptiveWarrantResponseConfiguration(configuration = null) {
  return configuration ? hashAdaptiveWarrantJson(canonicalAdaptiveWarrantResponseConfiguration(configuration)) : null;
}

export function changedAdaptiveWarrantTopLevelFields(left = {}, right = {}) {
  return [...new Set([...Object.keys(left || {}), ...Object.keys(right || {})])]
    .filter((field) => !isDeepStrictEqual(left?.[field], right?.[field]))
    .sort();
}

export function adaptiveWarrantResponseConfigurationSignature(configuration = null) {
  return [
    configuration?.engagement_stance,
    configuration?.action_family,
    configuration?.audience_register,
    configuration?.lexical_accessibility,
    configuration?.scene_immersion,
    configuration?.actorial_part,
    configuration?.actorial_performance?.id,
  ]
    .filter(Boolean)
    .join('|');
}

export function buildAdaptiveWarrantSelectorApplicationAudit({
  decision = null,
  preGateSource = null,
  postGateSource = null,
  actionFamilyOverrideInput = null,
  publicObligationDirectiveInput = null,
  responseConfiguration = null,
} = {}) {
  if (!decision) return null;
  const pre = jsonClone(preGateSource || {});
  const post = jsonClone(postGateSource || {});
  return {
    schema: ADAPTIVE_WARRANT_SELECTOR_APPLICATION_SCHEMA,
    mode: decision.mode || null,
    pre_gate_source: pre,
    post_gate_source: post,
    pre_gate_source_sha256: hashAdaptiveWarrantJson(pre),
    post_gate_source_sha256: hashAdaptiveWarrantJson(post),
    source_changed_fields: changedAdaptiveWarrantTopLevelFields(pre, post),
    pre_gate_action_family: pre.action_family || null,
    post_gate_action_family: post.action_family || null,
    pre_gate_engagement_stance: pre.engagement_stance || pre.selected_register || pre.register || null,
    post_gate_engagement_stance: post.engagement_stance || post.selected_register || post.register || null,
    action_family_override_input: actionFamilyOverrideInput ? jsonClone(actionFamilyOverrideInput) : null,
    public_obligation_directive_input: publicObligationDirectiveInput
      ? jsonClone(publicObligationDirectiveInput)
      : null,
    selected_action_family: responseConfiguration?.action_family || null,
    selected_engagement_stance: responseConfiguration?.engagement_stance || null,
    selected_response_configuration_sha256: hashAdaptiveWarrantResponseConfiguration(responseConfiguration),
  };
}

function selectorLockedDistribution(stance) {
  return [
    {
      engagement_stance: stance,
      register: stance,
      weight: 1,
      probability: 1,
      sourceScore: 1,
    },
  ];
}

/**
 * Apply only the gate-owned selector patch. The live selector and the offline
 * delivery verifier call the same pure function, so causal isolation is an
 * executable equality check rather than a duplicated list of expectations.
 */
export function applyAdaptiveWarrantSourcePatch(preGateSource = {}, decision = null) {
  let source = jsonClone(preGateSource || {});
  if (decision?.mode !== 'active') return source;
  if (decision.override) {
    const stance = decision.override.engagement_stance;
    const priorDistribution =
      source?.engagement_stance_distribution || (Array.isArray(source?.distribution) ? source.distribution : null);
    const lockedDistribution = selectorLockedDistribution(stance);
    source = {
      ...source,
      register_reason: decision.override.reason,
      engagement_stance_reason: decision.override.reason,
      reviewer_signal: 'adaptive warrant gate: revision of pedagogical commitment',
      expected_dag_move: 'Repair the diagnosed divergence before the next proof move.',
      expected_field_move: decision.policy?.rationale || 'apply the recommended repair policy',
      source: 'adaptive_warrant_gate',
      engagement_stance: stance,
      selected_register: stance,
      pre_override_engagement_stance_distribution: priorDistribution,
      distribution: lockedDistribution,
      engagement_stance_distribution: lockedDistribution,
      selected_probability: 1,
    };
  }
  if (decision.obligation_directive) {
    source = {
      ...source,
      public_obligation_directive: jsonClone(decision.obligation_directive),
      expected_dag_move:
        'Answer the named public request, or name its current public unavailability and a concrete next condition; do not substitute an unrelated proof question.',
      expected_field_move: decision.policy?.rationale || source.expected_field_move,
      source: 'adaptive_warrant_gate_public_obligation',
    };
  }
  return jsonClone(source);
}

/**
 * Recompute the selector audit from its persisted raw snapshots and bind its
 * selected outputs to the actual frozen response configuration. This makes
 * the audit self-verifying instead of trusting precomputed hashes or a loose
 * changed-field list.
 */
export function assessAdaptiveWarrantSelectorApplicationAudit({
  application = null,
  decision = null,
  selectedConfiguration = null,
} = {}) {
  const issues = [];
  if (!application) {
    return { ok: false, issues: ['selector_application_audit_missing'], unexpected_changed_fields: [] };
  }
  const pre = application.pre_gate_source;
  const post = application.post_gate_source;
  if (application.schema !== ADAPTIVE_WARRANT_SELECTOR_APPLICATION_SCHEMA) {
    issues.push('selector_application_schema_invalid');
  }
  if (
    !pre ||
    typeof pre !== 'object' ||
    Array.isArray(pre) ||
    !post ||
    typeof post !== 'object' ||
    Array.isArray(post)
  ) {
    issues.push('selector_application_raw_sources_missing');
  }
  const computedChangedFields =
    pre && post && typeof pre === 'object' && typeof post === 'object'
      ? changedAdaptiveWarrantTopLevelFields(pre, post)
      : [];
  if (application.pre_gate_source_sha256 !== hashAdaptiveWarrantJson(pre || {})) {
    issues.push('selector_application_pre_hash_mismatch');
  }
  if (application.post_gate_source_sha256 !== hashAdaptiveWarrantJson(post || {})) {
    issues.push('selector_application_post_hash_mismatch');
  }
  if (!isDeepStrictEqual(application.source_changed_fields || [], computedChangedFields)) {
    issues.push('selector_application_changed_fields_mismatch');
  }
  if (application.mode !== decision?.mode) issues.push('selector_application_mode_mismatch');
  if (application.selected_action_family !== selectedConfiguration?.action_family) {
    issues.push('selector_selected_action_family_mismatch');
  }
  if (application.selected_engagement_stance !== selectedConfiguration?.engagement_stance) {
    issues.push('selector_selected_engagement_stance_mismatch');
  }
  if (
    application.selected_response_configuration_sha256 !==
    hashAdaptiveWarrantResponseConfiguration(selectedConfiguration)
  ) {
    issues.push('selector_selected_configuration_digest_mismatch');
  }

  const expectedOverrideInput = decision?.override
    ? { family: decision.override.action_family, reason: decision.override.reason }
    : null;
  const expectedDirectiveInput = decision?.obligation_directive || null;
  if (!isDeepStrictEqual(application.action_family_override_input || null, expectedOverrideInput)) {
    issues.push('selector_override_input_mismatch');
  }
  if (!isDeepStrictEqual(application.public_obligation_directive_input || null, expectedDirectiveInput)) {
    issues.push('selector_obligation_input_mismatch');
  }

  let allowedChangedFields = [];
  if (decision?.mode === 'active') {
    allowedChangedFields = [
      ...(decision.override ? ADAPTIVE_WARRANT_SELECTOR_OVERRIDE_MUTABLE_FIELDS : []),
      ...(expectedDirectiveInput ? ADAPTIVE_WARRANT_SELECTOR_DIRECTIVE_MUTABLE_FIELDS : []),
    ];
  }
  const expectedPost = applyAdaptiveWarrantSourcePatch(pre || {}, decision);
  if (!isDeepStrictEqual(post || {}, expectedPost)) issues.push('selector_source_projection_mismatch');
  const unexpectedChangedFields = computedChangedFields.filter((field) => !new Set(allowedChangedFields).has(field));
  if (unexpectedChangedFields.length) issues.push('selector_unexpected_source_fields_changed');
  return {
    ok: issues.length === 0,
    issues,
    changed_fields: computedChangedFields,
    unexpected_changed_fields: unexpectedChangedFields,
  };
}

/**
 * The speaking guard may deliver the selected bundle unchanged or replace
 * only realization axes through its explicit plain-recovery contract. The
 * normative family, public obligation, evidence/safety configuration, and
 * final-authority provenance are immutable across that recovery.
 */
export function assessAdaptiveWarrantConfigurationTransition({
  selectedConfiguration = null,
  speakingConfiguration = null,
  deliveredConfiguration = null,
  transition = null,
  finalDeliverySource = null,
  performanceObligationContract = null,
  closureRequired = false,
} = {}) {
  if (!selectedConfiguration || !speakingConfiguration || !deliveredConfiguration) {
    return {
      schema: ADAPTIVE_WARRANT_DELIVERY_TRANSITION_SCHEMA,
      ok: false,
      kind: 'missing_configuration',
      changed_fields: [],
      unexpected_changed_fields: [],
    };
  }

  const expectedSpeakingConfiguration = buildTutorStubSpeakingResponseConfiguration({
    responseConfiguration: selectedConfiguration,
    performanceObligationContract,
  });
  const speakingChangedFields = changedAdaptiveWarrantTopLevelFields(selectedConfiguration, speakingConfiguration);
  const speakingConfigurationExact = isDeepStrictEqual(speakingConfiguration, expectedSpeakingConfiguration);
  const speakingTransition = expectedSpeakingConfiguration?.speaking_transition || null;

  const changedFields = changedAdaptiveWarrantTopLevelFields(speakingConfiguration, deliveredConfiguration);
  if (!changedFields.length) {
    const transitionMatchesSpeaking = isDeepStrictEqual(transition || null, speakingTransition);
    const directSourceValid = ADAPTIVE_WARRANT_DIRECT_DELIVERY_SOURCES.includes(finalDeliverySource);
    return {
      schema: ADAPTIVE_WARRANT_DELIVERY_TRANSITION_SCHEMA,
      ok: speakingConfigurationExact && transitionMatchesSpeaking && directSourceValid,
      kind: speakingChangedFields.length ? 'audited_speaking_transition' : 'exact_selected_configuration',
      selected_to_speaking_changed_fields: speakingChangedFields,
      speaking_configuration_exact: speakingConfigurationExact,
      speaking_to_delivery_changed_fields: [],
      changed_fields: speakingChangedFields,
      unexpected_changed_fields: [],
      transition_matches_configuration: transitionMatchesSpeaking,
      final_delivery_source_valid: directSourceValid,
    };
  }

  const expectedRecoveryConfiguration = buildTutorStubSimplifiedRecoveryConfiguration(speakingConfiguration, {
    closureRequired,
  });
  const recoveryConfigurationExact = isDeepStrictEqual(deliveredConfiguration, expectedRecoveryConfiguration);
  const transitionMatchesConfiguration = isDeepStrictEqual(
    transition || null,
    expectedRecoveryConfiguration.recovery_transition || null,
  );
  const recoverySourceValid = ADAPTIVE_WARRANT_SIMPLIFIED_RECOVERY_SOURCES.includes(finalDeliverySource);
  const recovery = recoveryConfigurationExact && transitionMatchesConfiguration && recoverySourceValid;
  return {
    schema: ADAPTIVE_WARRANT_DELIVERY_TRANSITION_SCHEMA,
    ok: speakingConfigurationExact && recovery,
    kind: recovery
      ? speakingChangedFields.length
        ? 'audited_speaking_then_plain_recovery'
        : 'audited_plain_recovery'
      : 'unlicensed_configuration_transition',
    selected_to_speaking_changed_fields: speakingChangedFields,
    speaking_configuration_exact: speakingConfigurationExact,
    speaking_to_delivery_changed_fields: changedFields,
    changed_fields: [...new Set([...speakingChangedFields, ...changedFields])].sort(),
    unexpected_changed_fields: recoveryConfigurationExact ? [] : changedFields,
    transition_matches_configuration: transitionMatchesConfiguration,
    recovery_configuration_exact: recoveryConfigurationExact,
    final_delivery_source_valid: recoverySourceValid,
  };
}
