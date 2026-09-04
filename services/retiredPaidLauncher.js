/**
 * Fail-closed retirement boundary for paid launchers that remain in the tree
 * only so their sealed historical artifacts can still be inspected and
 * analyzed.
 *
 * Retirement is intentionally independent of design files, GO notes, and
 * provider configuration. A retired launcher must stop before admission,
 * destination creation, or provider dispatch even when every old launch flag
 * is supplied.
 */

export const RETIRED_PAID_LAUNCHERS = Object.freeze({
  'adaptive-warrant-outcome-main-block': 'historical pre-policy launcher',
  'adaptive-warrant-outcome-pilot': 'historical pre-policy launcher',
  'adaptive-warrant-steering-decomposition': 'historical pre-policy launcher',
  'tutor-stub-defiant-warrant-pilot': 'historical pre-policy launcher',
  'tutor-stub-frame-refuser-depth-calibration': 'historical pre-policy launcher',
  'tutor-stub-resistance-action-register-manipulation-validation': 'historical pre-policy launcher',
  'tutor-stub-resistance-warm-nonwarm-confirmation': 'historical pre-policy launcher',
  'tutor-stub-resistant-learner-calibration-v2': 'historical pre-policy launcher',
  'tutor-stub-resistant-learner-calibration': 'historical pre-policy launcher',
  'tutor-stub-resistant-learner-merged-calibration': 'historical pre-policy launcher',
  'tutor-stub-action-outcome-model-judge-shadow':
    'fixed ceiling has no recovery reserve and the registered design forbids replacement attempts',
  'tutor-stub-frame-refuser-narrowing-calibration':
    'fixed ceiling does not permit replacement of a technically failed unit',
  'tutor-stub-frame-refuser-satisfiable-calibration': 'fixed ceiling has no recovery reserve',
});

export class RetiredPaidLauncherError extends Error {
  constructor(launcherId, reason) {
    super(
      `paid launcher retired: ${launcherId}; new paid/provider dispatch is disabled (${reason}). ` +
        'Historical artifacts and zero-call inspection or analysis remain available.',
    );
    this.name = 'RetiredPaidLauncherError';
    this.code = 'PAID_LAUNCHER_RETIRED';
    this.launcherId = launcherId;
  }
}

export function refuseRetiredPaidLaunch(launcherId) {
  const reason = RETIRED_PAID_LAUNCHERS[launcherId];
  if (!reason) throw new Error(`retired paid launcher id is not registered: ${launcherId}`);
  throw new RetiredPaidLauncherError(launcherId, reason);
}
