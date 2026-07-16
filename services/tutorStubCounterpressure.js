function premiseIds(rows = []) {
  return new Set(
    (Array.isArray(rows) ? rows : [])
      .map((row) => (typeof row === 'string' ? row : row?.premise || row?.id))
      .filter(Boolean),
  );
}

function premiseSurface(world, premiseId) {
  return String(world?.premiseById?.get?.(premiseId)?.surface || '').trim();
}

/**
 * Resolve an authored counterpressure relation into exact public surfaces.
 *
 * The relation lives on the due release's public presentation metadata. The
 * target must already have been released before this turn; the contrary
 * premise must be either already public or due now. Nothing is inferred from
 * learner questions, previous tutor prose, or merely adjacent evidence.
 */
export function resolveTutorStubPublicCounterpressure({
  world = null,
  publicEvidence = [],
  dueEvidence = [],
} = {}) {
  if (!world) return null;
  const publicIds = premiseIds(publicEvidence);
  const dueIds = premiseIds(dueEvidence);
  for (const dueId of dueIds) publicIds.delete(dueId);

  for (const dueId of dueIds) {
    const release = (world.releaseSchedule || []).find((entry) => entry.premise === dueId);
    const relation = release?.presentation?.counterpressure;
    if (!relation) continue;

    const pressurePremise = String(relation.pressure_premise || '').trim();
    const contraryPremise = String(relation.contrary_premise || '').trim();
    if (!pressurePremise || !contraryPremise) continue;
    if (!publicIds.has(pressurePremise)) continue;
    if (!publicIds.has(contraryPremise) && !dueIds.has(contraryPremise)) continue;

    const pressureTarget = premiseSurface(world, pressurePremise);
    const contraryEvidence = premiseSurface(world, contraryPremise);
    if (!pressureTarget || !contraryEvidence || pressureTarget === contraryEvidence) continue;
    return {
      pressureTarget,
      contraryEvidence,
      provenance: {
        source: 'authored_release_counterpressure',
        duePremise: dueId,
        pressurePremise,
        contraryPremise,
      },
    };
  }
  return null;
}
