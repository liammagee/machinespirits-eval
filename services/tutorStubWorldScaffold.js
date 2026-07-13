export const TUTOR_STUB_WORLD_SCAFFOLD_SCHEMA = 'machinespirits.tutor-stub.world-scaffold.v1';

function oneLine(value, max = 180) {
  const text = String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…` : text;
}

function predicateOf(fact) {
  return Array.isArray(fact) ? fact[0] : null;
}

function relevantRule(world, row) {
  const predicate = predicateOf(row?.fact);
  if (!predicate) return null;
  return (world?.rules || []).find((rule) =>
    [...(rule?.if || []), ...(rule?.then || [])].some((fact) => predicateOf(fact) === predicate),
  );
}

function concludesQuestion(world, rule) {
  const questionPredicate = world?.questionPattern?.[0] || world?.secret?.fact?.[0] || null;
  return Boolean(questionPredicate && (rule?.then || []).some((fact) => predicateOf(fact) === questionPredicate));
}

export function buildTutorStubWorldScaffold({ world = null, evidence = null, conclusionReady = false } = {}) {
  const surface = oneLine(evidence?.surface || '');
  const rule = relevantRule(world, evidence);
  const gloss = oneLine(rule?.gloss || '', 260);
  if (conclusionReady) {
    return {
      schema: TUTOR_STUB_WORLD_SCAFFOLD_SCHEMA,
      id: 'world_conclusion_join',
      label: `closing ${oneLine(world?.title || 'the case', 70)}`,
      localQuestion: `Do the stated clues now answer this question: ${oneLine(world?.question || '', 180)}`,
      warrantFrame: gloss
        ? `Use the world’s own closing rule in plain language: ${gloss}`
        : 'Join only the clues already stated in the conversation.',
      joinReminder: 'Name the conclusion only if the stated clues satisfy the full public rule, then close naturally.',
      ruleId: rule?.id || null,
    };
  }
  if (!surface) {
    return {
      schema: TUTOR_STUB_WORLD_SCAFFOLD_SCHEMA,
      id: 'world_open_scaffold',
      label: `opening ${oneLine(world?.title || 'the case', 70)}`,
      localQuestion: `Keep this concrete question in view: ${oneLine(world?.question || 'What happened?', 180)}`,
      warrantFrame: 'Introduce or restate one actual clue before asking the learner to interpret it.',
      joinReminder: 'Leave the wider conclusion open until the conversation contains the clues its rule requires.',
      ruleId: null,
    };
  }
  return {
    schema: TUTOR_STUB_WORLD_SCAFFOLD_SCHEMA,
    id: 'world_evidence_scaffold',
    label: 'current public clue',
    localQuestion: `What does this clue show on its own: “${oneLine(surface, 150)}”?`,
    warrantFrame: gloss
      ? `Use this world rule in ordinary language: ${gloss}`
      : 'Ask for the smallest conclusion this stated clue supports.',
    joinReminder: concludesQuestion(world, rule)
      ? 'Do not name the final answer until every condition in this rule has a stated supporting clue.'
      : 'Carry only what this clue and its public rule support; leave the rest of the case open.',
    ruleId: rule?.id || null,
  };
}
