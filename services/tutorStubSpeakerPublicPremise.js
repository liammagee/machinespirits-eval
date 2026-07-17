export const TUTOR_STUB_SPEAKER_PUBLIC_PREMISE_SCHEMA =
  'machinespirits.tutor-stub.speaker-public-premise.v1';

function cloneCausalRelation(value = null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return structuredClone(value);
}

/**
 * Project one already-public premise for the deterministic speaking compiler.
 * This is not sent to the learner classifier: typed relation metadata remains
 * host-owned and only constrains the public sentence the speaker may produce.
 */
export function projectTutorStubSpeakerPublicPremise(premise = null, release = {}) {
  if (!premise) return null;
  const surface = String(premise.surface || '').trim();
  if (!surface) return null;
  return {
    schema: TUTOR_STUB_SPEAKER_PUBLIC_PREMISE_SCHEMA,
    premise: String(release.premise || premise.id || '').trim() || null,
    turn: Number.isFinite(Number(release.turn)) ? Number(release.turn) : null,
    via: String(release.via || '').trim() || null,
    surface,
    fact: Array.isArray(premise.fact) ? structuredClone(premise.fact) : null,
    causal_relation: cloneCausalRelation(premise.causal_relation),
  };
}
