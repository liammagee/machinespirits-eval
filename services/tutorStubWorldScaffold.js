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

function uniquePredicates(facts = []) {
  return [...new Set((Array.isArray(facts) ? facts : []).map(predicateOf).filter(Boolean))];
}

function publicRelationMap({ evidence = null, rule = null } = {}) {
  const evidencePredicate = predicateOf(evidence?.fact);
  if (!evidencePredicate || !rule?.id) return null;
  const authoredFocus = evidence?.public_focus || evidence?.presentation?.public_focus || rule?.public_focus || null;
  const authoredRelationship = ['direct', 'sibling'].includes(authoredFocus?.relationship)
    ? authoredFocus.relationship
    : null;
  return {
    source: 'world_scaffold_rule',
    rule_id: rule.id,
    evidence_predicate: evidencePredicate,
    premise_id: evidence?.premise || null,
    input_predicates: uniquePredicates(rule.if),
    conclusion_predicates: uniquePredicates(rule.then),
    relationship: authoredRelationship,
    authored_focus_surface: oneLine(authoredFocus?.surface || authoredFocus?.focus),
  };
}

function authoredPublicFocus(row) {
  return row?.public_focus || row?.presentation?.public_focus || null;
}

function ruleContainsPredicate(rule, predicate, side) {
  return (rule?.[side] || []).some((fact) => predicateOf(fact) === predicate);
}

function relevantRuleResolution(world, row) {
  const predicate = predicateOf(row?.fact);
  const rules = Array.isArray(world?.rules) ? world.rules : [];
  const explicitRuleId = oneLine(authoredPublicFocus(row)?.rule_id);
  const inputMatches = predicate
    ? rules.filter((rule) => ruleContainsPredicate(rule, predicate, 'if'))
    : [];
  const outputMatches = predicate
    ? rules.filter((rule) => ruleContainsPredicate(rule, predicate, 'then'))
    : [];
  const candidateRules = [...new Map([...inputMatches, ...outputMatches].map((rule) => [rule.id, rule])).values()];
  const explicitRule = explicitRuleId
    ? candidateRules.find((rule) => oneLine(rule?.id) === explicitRuleId) || null
    : null;
  const rule = explicitRule ||
    (inputMatches.length === 1 ? inputMatches[0] : null) ||
    (inputMatches.length === 0 && outputMatches.length === 1 ? outputMatches[0] : null);
  const strategy = explicitRule
    ? 'explicit_public_focus_rule'
    : inputMatches.length === 1
      ? 'unique_input_predicate'
      : inputMatches.length === 0 && outputMatches.length === 1
        ? 'unique_output_predicate'
        : 'unmapped';
  return {
    rule,
    trace: {
      predicate: predicate || null,
      explicit_rule_id: explicitRuleId || null,
      explicit_rule_valid: explicitRuleId ? Boolean(explicitRule) : null,
      input_rule_ids: inputMatches.map((candidate) => candidate.id),
      output_rule_ids: outputMatches.map((candidate) => candidate.id),
      candidate_rule_ids: candidateRules.map((candidate) => candidate.id),
      selected_rule_id: rule?.id || null,
      strategy,
      ambiguous: !rule && candidateRules.length > 1,
    },
  };
}

function concludesQuestion(world, rule) {
  const questionPredicate = world?.questionPattern?.[0] || world?.secret?.fact?.[0] || null;
  return Boolean(questionPredicate && (rule?.then || []).some((fact) => predicateOf(fact) === questionPredicate));
}

export function buildTutorStubWorldScaffold({ world = null, evidence = null, conclusionReady = false } = {}) {
  const surface = oneLine(evidence?.surface || '');
  const ruleResolution = relevantRuleResolution(world, evidence);
  const rule = ruleResolution.rule;
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
      publicRelationMap: publicRelationMap({ evidence, rule }),
      ruleResolution: ruleResolution.trace,
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
      publicRelationMap: null,
      ruleResolution: ruleResolution.trace,
    };
  }
  return {
    schema: TUTOR_STUB_WORLD_SCAFFOLD_SCHEMA,
    id: 'world_evidence_scaffold',
    label: 'current public clue',
    localQuestion: `Keep “${oneLine(world?.question || 'What happened?', 150)}” in view while discussing this stated clue: “${oneLine(surface, 150)}”.`,
    warrantFrame: gloss
      ? `Explain this connection in ordinary scene language: ${gloss} Do not call it a rule or condition.`
      : `Ask what this stated clue tells us about “${oneLine(world?.question || 'what happened', 150)}”.`,
    joinReminder: concludesQuestion(world, rule)
      ? 'Do not name the final answer until the conversation contains every clue needed to answer the public question.'
      : `Keep what this clue tells us separate from what is still unknown about “${oneLine(world?.question || 'what happened', 150)}”.`,
    ruleId: rule?.id || null,
    publicRelationMap: publicRelationMap({ evidence, rule }),
    ruleResolution: ruleResolution.trace,
  };
}
