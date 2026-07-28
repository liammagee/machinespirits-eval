import { closure } from './dramaticDerivation/chainer.js';
import { tutorStubFactMatches } from './tutorStubFactModel.js';
import { tutorStubPublicProvenanceText } from './tutorStubPublicProvenance.js';

export function createTutorStubPublicEvidenceModel({ committedReleaseRows, currentReleaseRows } = {}) {
  const committedRows = typeof committedReleaseRows === 'function' ? committedReleaseRows : () => [];
  const currentRows = typeof currentReleaseRows === 'function' ? currentReleaseRows : () => [];

  function candidatePublicPremiseIds({ state = null, world = null, tutorTurn = null, publicPremiseIds = null } = {}) {
    if (publicPremiseIds instanceof Set) return new Set(publicPremiseIds);
    if (Array.isArray(publicPremiseIds)) return new Set(publicPremiseIds.filter(Boolean));
    if (!world) return new Set();
    if (state?.releasePacing) {
      return new Set([
        ...committedRows(state, tutorTurn).map((row) => row.premise),
        ...currentRows(state, tutorTurn).map((row) => row.premise),
      ]);
    }
    return new Set(
      (world.releaseSchedule || [])
        .filter((entry) => Number(entry.turn) <= Number(tutorTurn))
        .map((entry) => entry.premise),
    );
  }

  function publicFactsAtTurn(world, tutorTurn, state = null, publicPremiseIds = null) {
    if (!world) return [];
    const available = candidatePublicPremiseIds({ state, world, tutorTurn, publicPremiseIds });
    const released = [...available].map((premiseId) => world.premiseById.get(premiseId)?.fact).filter(Boolean);
    return [...(world.background || []), ...released];
  }

  function entailedFactsAtTurn(world, tutorTurn, state = null, publicPremiseIds = null) {
    if (!world) return [];
    return [...closure(publicFactsAtTurn(world, tutorTurn, state, publicPremiseIds), world.rules || []).facts.values()];
  }

  function entailsFactAtTurn(world, tutorTurn, fact, state = null, publicPremiseIds = null) {
    return entailedFactsAtTurn(world, tutorTurn, state, publicPremiseIds).some((entailed) =>
      tutorStubFactMatches(entailed, fact),
    );
  }

  function answerTermForWorld(world) {
    const pattern = world?.questionPattern || [];
    const answerIndex = pattern.findIndex((part) => typeof part === 'string' && part.startsWith('?'));
    if (answerIndex < 0) return null;
    return world?.secret?.fact?.[answerIndex] || null;
  }

  function publicTextForTurn(world, tutorTurn, learnerText = '', state = null, publicPremiseIds = null) {
    if (!world) return '';
    const available = candidatePublicPremiseIds({ state, world, tutorTurn, publicPremiseIds });
    return tutorStubPublicProvenanceText({
      world,
      publicPremiseIds: available,
      priorTurns: state?.turns || [],
      learnerText,
    });
  }

  function publicEvidenceTextForAssertion(world, tutorTurn, learnerText = '', state = null, publicPremiseIds = null) {
    if (!world) return '';
    const available = candidatePublicPremiseIds({ state, world, tutorTurn, publicPremiseIds });
    const releasedSurface = [...available]
      .map((premiseId) => world.premiseById.get(premiseId)?.surface || '')
      .join('\n');
    const transcript = (state?.turns || []).flatMap((turn) => [turn?.learner || '', turn?.tutor || '']).join('\n');
    return [
      world.question,
      world.setting,
      world.openingFrame?.situation,
      releasedSurface,
      transcript,
      learnerText,
    ].join('\n');
  }

  return Object.freeze({
    answerTermForWorld,
    candidatePublicPremiseIds,
    entailedFactsAtTurn,
    entailsFactAtTurn,
    publicEvidenceTextForAssertion,
    publicFactsAtTurn,
    publicTextForTurn,
  });
}
