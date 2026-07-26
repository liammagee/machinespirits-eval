/**
 * Scene diction for the deterministic tutor-stub fallback banks.
 *
 * The deterministic fallbacks (dramatic release, learner uptake) were authored
 * against the original assay/guild worlds, so their phrase banks carry a period
 * register — "I examine the record", "the next public fact must answer it" — and
 * a hardcoded prop whitelist of period nouns (crucible, cupel, trial-book,
 * touchstone). A domestic world such as world_030_rowan_flat matches none of
 * those nouns and receives the abstract default object "record", spoken in a
 * register its own `presentation.narrative_diction` explicitly disclaims.
 *
 * This module reads the author's declared costume and answers two questions the
 * fallback banks need:
 *
 *   - which register the deterministic phrasing should use, and
 *   - which concrete noun names this world's evidence record.
 *
 * Resolution is deliberately default-preserving. A world is treated as period
 * unless its declared diction is free of period markers, so frozen worlds keep
 * their learner-visible conditions byte-for-byte and only worlds that declare a
 * contemporary costume receive the plainspoken variants.
 */

export const TUTOR_STUB_SCENE_DICTION_PERIOD = 'period';
export const TUTOR_STUB_SCENE_DICTION_CONTEMPORARY = 'contemporary';

/**
 * Markers of the authored period costumes. Presence of any marker pins the
 * world to the legacy phrase banks; absence releases it to the contemporary
 * variants. Keep this list narrow — a new marker silently re-freezes a world.
 */
const PERIOD_DICTION_PATTERN =
  /\b(?:medieval|guild|guild-hall|cloister|priory|parish|heraldic|romantic|archival|assize|maritime|commission)\b/iu;

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function declaredDiction(world) {
  return oneLine(world?.presentation?.narrative_diction || world?.narrative_diction || world?.narrativeDiction);
}

/**
 * Resolve the deterministic-fallback register for a world.
 *
 * Returns `period` when no world is supplied, when the world declares no
 * diction, or when the declared diction carries a period marker. Only an
 * explicit, marker-free diction resolves to `contemporary`.
 */
export function resolveTutorStubSceneDiction(world = null) {
  const diction = declaredDiction(world);
  if (!diction) return TUTOR_STUB_SCENE_DICTION_PERIOD;
  return PERIOD_DICTION_PATTERN.test(diction) ? TUTOR_STUB_SCENE_DICTION_PERIOD : TUTOR_STUB_SCENE_DICTION_CONTEMPORARY;
}

export function tutorStubSceneDictionIsContemporary(world = null) {
  return resolveTutorStubSceneDiction(world) === TUTOR_STUB_SCENE_DICTION_CONTEMPORARY;
}

/**
 * The author's own noun for this world's evidence record ("repair notebook",
 * "corrections file", "trial-book"). Returns '' when the world declares none;
 * callers keep their existing default in that case.
 */
export function tutorStubSceneLedgerTerm(world = null) {
  return oneLine(world?.presentation?.ledger_term || world?.ledger_term || world?.ledgerTerm);
}

/**
 * Concrete public props this world names, most specific first. Used to extend
 * the fallback prop whitelist so a world's own objects win over the generic
 * default before any period noun is consulted.
 */
export function tutorStubScenePublicObjects(world = null) {
  const declared = [
    tutorStubSceneLedgerTerm(world),
    ...(Array.isArray(world?.presentation?.public_objects) ? world.presentation.public_objects : []),
    ...(Array.isArray(world?.public_objects) ? world.public_objects : []),
  ]
    .map((value) => oneLine(value))
    .filter(Boolean);
  return [...new Set(declared)].sort((left, right) => right.length - left.length);
}

/**
 * Choose between a period phrasing and its contemporary variant. Callers pass
 * the resolved diction so a single world lookup covers a whole fallback build.
 */
export function tutorStubDictionPhrase(diction, periodText, contemporaryText) {
  return diction === TUTOR_STUB_SCENE_DICTION_CONTEMPORARY && contemporaryText ? contemporaryText : periodText;
}
