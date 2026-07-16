/**
 * Build the exact public prose available to response guards.
 *
 * Runtime and frozen replay must consult the same provenance boundary. A
 * previously spoken word is public even when it also occurs in a later clue;
 * omitting the transcript makes harmless continuity look like leakage.
 */
export function tutorStubPublicProvenanceText({
  world = null,
  publicPremiseIds = [],
  priorTurns = [],
  learnerText = '',
} = {}) {
  if (!world) return '';
  const available =
    publicPremiseIds instanceof Set
      ? publicPremiseIds
      : new Set((Array.isArray(publicPremiseIds) ? publicPremiseIds : []).filter(Boolean));
  const releasedSurface = [...available]
    .map((premiseId) => world?.premiseById?.get?.(premiseId)?.surface || '')
    .join('\n');
  const transcript = (Array.isArray(priorTurns) ? priorTurns : [])
    .flatMap((turn) => [turn?.learner || '', turn?.tutor || ''])
    .join('\n');
  return [
    world.question,
    world.setting,
    world.openingFrame?.situation,
    world.openingFrame?.authoredText,
    world.learnerVoice,
    ...(world.rules || []).map((rule) => rule.gloss || ''),
    releasedSurface,
    transcript,
    learnerText,
  ].join('\n');
}
