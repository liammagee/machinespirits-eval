export const TUTOR_STUB_LEARNER_RESPONSE_PROVENANCE_SCHEMA = 'machinespirits.tutor-stub.learner-response-provenance.v1';

const AUTHORSHIP_VALUES = new Set(['human', 'ai', 'hybrid', 'unknown']);

function compactObject(value) {
  if (!value || typeof value !== 'object') return null;
  const compact = Object.fromEntries(
    Object.entries(value).filter(([, child]) => child !== null && child !== undefined && child !== ''),
  );
  return Object.keys(compact).length ? compact : null;
}

export function createTutorStubLearnerResponseProvenance({
  authorship = 'unknown',
  origin = 'unknown',
  inputMethod = 'unknown',
  humanInLoop = null,
  modelRef = null,
  provider = null,
  model = null,
  learnerProfileId = null,
  suggestion = null,
  automation = null,
} = {}) {
  if (!AUTHORSHIP_VALUES.has(authorship)) {
    throw new Error(`invalid learner response authorship: ${authorship}`);
  }
  const humanGenerated = authorship === 'human' || authorship === 'hybrid';
  const aiGenerated = authorship === 'ai' || authorship === 'hybrid';
  return {
    schema: TUTOR_STUB_LEARNER_RESPONSE_PROVENANCE_SCHEMA,
    authorship,
    humanGenerated,
    aiGenerated,
    aiAssisted: authorship === 'hybrid',
    humanInLoop: humanInLoop === null ? humanGenerated : Boolean(humanInLoop),
    origin,
    inputMethod,
    model: aiGenerated ? compactObject({ modelRef, provider, model }) : null,
    learnerProfileId: learnerProfileId || null,
    suggestion: aiGenerated ? compactObject(suggestion) : null,
    automation: aiGenerated ? compactObject(automation) : null,
  };
}

export function aggregateTutorStubLearnerResponseProvenance(provenanceRows = []) {
  const rows = provenanceRows.filter(Boolean);
  if (!rows.length) return createTutorStubLearnerResponseProvenance();
  const authorships = new Set(rows.map((row) => row.authorship || 'unknown'));
  let authorship = authorships.size === 1 ? [...authorships][0] : 'hybrid';
  if (authorships.has('hybrid') || (authorships.has('human') && authorships.has('ai'))) authorship = 'hybrid';
  if (!AUTHORSHIP_VALUES.has(authorship)) authorship = 'unknown';
  const humanGenerated = rows.some((row) => row.humanGenerated === true);
  const aiGenerated = rows.some((row) => row.aiGenerated === true);
  const models = rows.map((row) => row.model).filter(Boolean);
  const uniqueModels = [...new Map(models.map((row) => [JSON.stringify(row), row])).values()];
  const uniqueProfiles = [...new Set(rows.map((row) => row.learnerProfileId).filter(Boolean))];
  return {
    schema: TUTOR_STUB_LEARNER_RESPONSE_PROVENANCE_SCHEMA,
    authorship,
    humanGenerated,
    aiGenerated,
    aiAssisted: authorship === 'hybrid' || rows.some((row) => row.aiAssisted === true),
    humanInLoop: rows.some((row) => row.humanInLoop === true),
    origin: rows.length === 1 ? rows[0].origin : 'compound_learner_turn',
    inputMethod: rows.length === 1 ? rows[0].inputMethod : 'compound',
    model: uniqueModels.length === 1 ? uniqueModels[0] : null,
    learnerProfileId: uniqueProfiles.length === 1 ? uniqueProfiles[0] : null,
    suggestion: rows.length === 1 ? rows[0].suggestion || null : null,
    automation: rows.length === 1 ? rows[0].automation || null : null,
    components: rows.map((row, index) => ({
      index: index + 1,
      authorship: row.authorship || 'unknown',
      origin: row.origin || 'unknown',
      inputMethod: row.inputMethod || 'unknown',
    })),
  };
}

export function tutorStubLearnerResponseProvenanceLabel(provenance) {
  if (provenance?.authorship === 'human') return 'Human-authored learner response';
  if (provenance?.authorship === 'ai') {
    return provenance.humanInLoop
      ? 'AI-authored learner response, accepted by a human'
      : 'AI-generated learner response';
  }
  if (provenance?.authorship === 'hybrid') return 'Human-edited AI learner response';
  return 'Learner response authorship not recorded';
}

export function summarizeTutorStubLearnerResponseProvenance(turns = []) {
  const counts = { human: 0, ai: 0, hybrid: 0, unknown: 0 };
  for (const turn of turns) {
    const authorship = turn?.learnerResponseProvenance?.authorship;
    counts[AUTHORSHIP_VALUES.has(authorship) ? authorship : 'unknown'] += 1;
  }
  return {
    schema: TUTOR_STUB_LEARNER_RESPONSE_PROVENANCE_SCHEMA,
    total: turns.length,
    counts,
    humanInvolved: counts.human + counts.hybrid,
    aiInvolved: counts.ai + counts.hybrid,
  };
}
