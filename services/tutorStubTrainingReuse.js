export const TUTOR_STUB_TRAINING_REUSE_SCHEMA = 'machinespirits.tutor-stub.training-reuse.v1';

export const TUTOR_STUB_HUMAN_SUBJECT_CLASSES = Object.freeze([
  'owner_operator',
  'external_user',
  'unknown',
  'not_applicable',
]);

const ON_VALUES = new Set(['1', 'true', 'yes', 'on', 'enabled', 'candidate', 'training_candidate']);
const OFF_VALUES = new Set(['0', 'false', 'no', 'off', 'disabled', 'opt_out', 'do_not_train']);

export function normalizeTutorStubTrainingReuseSetting(value, { label = 'training reuse' } = {}) {
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/gu, '_');
  if (ON_VALUES.has(normalized)) return 'on';
  if (OFF_VALUES.has(normalized)) return 'off';
  throw new Error(`${label} must be on or off`);
}

export function normalizeTutorStubHumanSubjectClass(value, { label = 'human subject class' } = {}) {
  const normalized = String(value ?? 'owner_operator')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/gu, '_');
  if (!TUTOR_STUB_HUMAN_SUBJECT_CLASSES.includes(normalized)) {
    throw new Error(`${label} must be ${TUTOR_STUB_HUMAN_SUBJECT_CLASSES.join(', ')}`);
  }
  return normalized;
}

export function resolveTutorStubTrainingReuse({
  requested = 'on',
  source = 'repository_default',
  humanSubjectClass = 'owner_operator',
  humanSubjectClassSource = 'repository_default',
  humanInputExpected = true,
} = {}) {
  const requestedSetting = normalizeTutorStubTrainingReuseSetting(requested);
  const declaredHumanSubjectClass = normalizeTutorStubHumanSubjectClass(humanSubjectClass);
  const effectiveHumanSubjectClass = humanInputExpected
    ? declaredHumanSubjectClass === 'not_applicable'
      ? 'unknown'
      : declaredHumanSubjectClass
    : 'not_applicable';
  const ownerOperated = effectiveHumanSubjectClass === 'owner_operator';
  const applicable = effectiveHumanSubjectClass !== 'not_applicable';
  const enabled = Boolean(applicable && ownerOperated && requestedSetting === 'on');
  const failClosed = Boolean(applicable && !ownerOperated);
  const status = !applicable ? 'not_applicable' : enabled ? 'training_candidate' : 'do_not_train';
  const reason = !applicable
    ? 'no_human_or_mixed_input_expected'
    : failClosed
      ? 'external_or_unknown_human_data_fail_closed'
      : enabled
        ? 'sole_owner_default_or_explicit_opt_in'
        : 'sole_owner_opt_out';

  return Object.freeze({
    schema: TUTOR_STUB_TRAINING_REUSE_SCHEMA,
    policy: 'sole_owner_opt_out',
    requested: requestedSetting,
    effective: enabled ? 'on' : 'off',
    status,
    source: String(source || 'repository_default'),
    humanSubjectClass: effectiveHumanSubjectClass,
    declaredHumanSubjectClass,
    humanSubjectClassSource: String(humanSubjectClassSource || 'repository_default'),
    humanInputExpected: Boolean(humanInputExpected),
    appliesToAuthorship: Object.freeze(['human', 'hybrid']),
    scope: 'source_and_descendants',
    failClosed,
    reason,
    publicTranscriptChanged: false,
  });
}

export function tutorStubTrainingReuseLabel(value) {
  if (value?.status === 'training_candidate') return 'training candidate';
  if (value?.status === 'do_not_train') return 'do not train';
  return 'not applicable';
}
