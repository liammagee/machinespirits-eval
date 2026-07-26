/**
 * Observed audits: evaluate a bare turn, gate nothing.
 *
 * `--passthrough` is the only genuinely bare mode the stub has, and it earns
 * that by returning the first draft straight to the learner — no guard, no
 * repair, no deterministic fallback. The side effect is that a passthrough arm
 * records *no* audits at all, so it cannot be scored on the same gate as an
 * instrumented arm and every cross-arm merit table has an empty column.
 *
 * `--observe-audits` separates the two things `--passthrough` had fused:
 * evaluation and enforcement. With it on, the bare arm runs its audits and
 * writes them to the turn record, and the draft still goes out untouched
 * whatever they say. The envelope below is the contract for that: it names the
 * checks that ran, names the checks that could not run and why, and carries
 * `enforced: false` so no downstream reader can mistake an observed audit for
 * a guard.
 *
 * **Only two of the seven canonical audits are observable on a bare turn**, and
 * the split is structural rather than a matter of effort. The leak and
 * repetition audits need nothing but (world, turn index, draft text, prior
 * tutor texts) — all of which a passthrough turn has. The other five check a
 * draft against a per-turn contract that the instrumented pipeline builds
 * before it speaks: a question-support frame, a release plan, a discourse
 * scaffold, a closure frame, a live source/action pairing. A bare arm never
 * builds one, so those checks have no referent on its turns. They are reported
 * as unavailable, never as passed — an absent contract must not read as a
 * clean sheet.
 *
 * The one thing this module refuses to do is let an observed audit act. Every
 * enforcement marker the guard path can set is asserted absent before the
 * envelope is built, so a future edit that routes an observed result into the
 * repair loop fails loudly here instead of quietly making the baseline arm
 * instrumented.
 */

export const TUTOR_STUB_OBSERVED_AUDITS_SCHEMA = 'machinespirits.tutor-stub.observed-audits.v1';

/** Turn-record keys an observed pass can fill. */
export const TUTOR_STUB_OBSERVED_AUDIT_KEYS = Object.freeze(['tutorLeakAudit', 'tutorRepetitionAudit']);

/**
 * Turn-record keys an observed pass must leave null, with the reason. Each of
 * these audits scores a draft against a contract the bare arm never builds.
 */
export const TUTOR_STUB_UNOBSERVABLE_AUDITS = Object.freeze({
  tutorQuestionSupportAudit: 'no question-support frame is built on a bare turn',
  tutorDramaticReleaseAudit: 'no release plan is built on a bare turn',
  tutorHumanScaffoldAudit: 'no discourse scaffold is built on a bare turn',
  tutorDialogueClosureAudit: 'no closure frame is built on a bare turn',
  tutorLiveSourceActionAlignmentAudit: 'no live source/action pairing is built on a bare turn',
});

/** Markers the guard path sets. An observed pass may set none of them. */
const ENFORCEMENT_MARKERS = Object.freeze([
  'repaired',
  'deterministicFallback',
  'guardAccounting',
  'responseGuardAccounting',
]);

function auditOk(audit) {
  return audit ? audit.ok !== false : null;
}

/**
 * Build the envelope for one observed turn.
 *
 * @param {object} input
 * @param {object|null} input.leakAudit result of the leak audit, or null if it could not run
 * @param {object|null} input.repetitionAudit result of the repetition audit, or null if it could not run
 * @param {object|null} input.response the tutor response the audits scored, checked for enforcement markers
 */
export function buildTutorStubObservedAudits({ leakAudit = null, repetitionAudit = null, response = null } = {}) {
  assertTutorStubObservedAuditsUnenforced(response);
  const evaluated = [];
  if (leakAudit) evaluated.push('tutorLeakAudit');
  if (repetitionAudit) evaluated.push('tutorRepetitionAudit');
  const results = { tutorLeakAudit: auditOk(leakAudit), tutorRepetitionAudit: auditOk(repetitionAudit) };
  const failed = evaluated.filter((key) => results[key] === false);
  return Object.freeze({
    schema: TUTOR_STUB_OBSERVED_AUDITS_SCHEMA,
    // The whole point of the flag: these ran, and none of them could stop the
    // draft. A reader that treats `ok: false` here as a blocked turn is wrong.
    enforced: false,
    evaluated: Object.freeze([...evaluated]),
    failed: Object.freeze([...failed]),
    auditsRecorded: evaluated.length,
    auditsFailed: failed.length,
    unavailable: Object.freeze(
      Object.entries(TUTOR_STUB_UNOBSERVABLE_AUDITS).map(([key, reason]) => Object.freeze({ key, reason })),
    ),
  });
}

/**
 * Throw if the response carries any marker only the guard path can set.
 *
 * Called before the envelope is built rather than after, so an observed pass
 * that has somehow acquired enforcement authority fails before it can record
 * itself as unenforced.
 */
export function assertTutorStubObservedAuditsUnenforced(response) {
  if (!response) return;
  for (const marker of ENFORCEMENT_MARKERS) {
    if (response[marker]) {
      throw new Error(
        `observed audits must not enforce: response carries ${marker}; --observe-audits evaluates a bare turn and gates nothing`,
      );
    }
  }
}
