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

function escapeForPattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/**
 * Find the first of `props` named in a piece of scene text. Props are matched
 * longest-first so a compound prop wins over any shorter prop nested inside it
 * ("repair notebook" rather than the bare "notebook"). Returns '' when nothing
 * matches, which leaves the caller's own whitelist chain in charge.
 */
export function tutorStubNamedSceneProp(text, props = []) {
  const candidates = (Array.isArray(props) ? props : [props])
    .map((value) => oneLine(value))
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
  const haystack = oneLine(text);
  if (!candidates.length || !haystack) return '';
  const pattern = new RegExp(`\\b(?:${candidates.map(escapeForPattern).join('|')})\\b`, 'iu');
  return haystack.match(pattern)?.[0] || '';
}

/**
 * Find the world's own name for a prop inside a piece of scene text.
 *
 * The static whitelists in the fallback banks were drawn from the assay/guild
 * worlds, so a world whose props are absent from them silently degrades to an
 * abstract default, and a world whose prop merely *contains* a whitelist noun
 * gets truncated to that fragment. Consulting the author's own nouns first
 * fixes both.
 */
export function tutorStubDeclaredSceneObject(text, world = null) {
  return tutorStubNamedSceneProp(text, tutorStubScenePublicObjects(world));
}

/**
 * Freeze a world's costume into a plain value that can be stamped onto a
 * built frame entry and travel with it.
 *
 * Some consumers of a due-source entry are several exported signatures away
 * from the world — three of them receive the entry through a bare
 * `.map(renderTutorStubDueSource)`, where a third argument would collide with
 * the array index. Resolving the costume once at frame-build time and hanging
 * it on the entry, the way the frame already hangs `action_referents` there,
 * reaches all of them without touching a single signature. An entry that never
 * passed through the builder — a recorded bundle, a hand-built fixture — simply
 * carries no stamp and the reader's period defaults apply.
 */
export function tutorStubSceneStamp(world = null) {
  return { diction: resolveTutorStubSceneDiction(world) };
}

/**
 * Choose between a period phrasing and its contemporary variant. Callers pass
 * the resolved diction so a single world lookup covers a whole fallback build.
 */
export function tutorStubDictionPhrase(diction, periodText, contemporaryText) {
  return diction === TUTOR_STUB_SCENE_DICTION_CONTEMPORARY && contemporaryText ? contemporaryText : periodText;
}
