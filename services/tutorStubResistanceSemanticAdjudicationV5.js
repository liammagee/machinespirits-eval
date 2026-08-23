import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3,
  TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V3,
  buildTutorStubResistanceSemanticAdjudicationPromptV3,
  wrapTutorStubResistanceSemanticModelOutputV3,
} from './tutorStubResistanceSemanticAdjudicationV3.js';
import { adjudicateTutorStubResistanceSemanticJudgesV4 } from './tutorStubResistanceSemanticAdjudicationV4.js';

export const TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V5 = 'prospective_frame_resistance_semantic_v5';

export function buildTutorStubResistanceSemanticAdjudicationPromptV5(values) {
  const prompt = buildTutorStubResistanceSemanticAdjudicationPromptV3(values);
  const instructions = [...prompt.instructions];
  instructions.splice(
    instructions.length - 2,
    0,
    'Evidence transport is source-selective, not extractive: for every yes or indeterminate field, choose the supporting source_id and return that source complete and verbatim as quote. Never shorten, paraphrase, repair grammar, or splice a clause. The response schema permits only complete supplied source texts.',
  );
  return {
    ...prompt,
    schema: 'machinespirits.tutor-stub.resistance-semantic-adjudication-prompt.v5',
    instructions,
  };
}

function exactSourceTextPattern(values) {
  const escape = (value) =>
    [...String(value)]
      .map((character) => {
        if (character === '"') return '\\x22';
        if (character === '\n') return '\\n';
        if (character === '\r') return '\\r';
        if (character === '\t') return '\\t';
        if ('\\^$.*+?()[]{}|'.includes(character)) return `\\${character}`;
        return character;
      })
      .join('');
  return `^(?:${values.map(escape).join('|')})$`;
}

export function deduplicateTutorStubResistanceSemanticOutputSchemaV5(inputSchema) {
  const schema = structuredClone(inputSchema);
  const evidenceProperties = schema?.properties?.judgment?.properties?.evidence_quotes?.properties;
  const firstField = TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3[0];
  const sharedEvidence = evidenceProperties?.[firstField]?.oneOf?.[0];
  if (!sharedEvidence?.properties?.source_id?.enum || !sharedEvidence?.properties?.quote?.enum) {
    return schema;
  }
  const exactSourceEvidence = structuredClone(sharedEvidence);
  exactSourceEvidence.properties.quote = {
    type: 'string',
    pattern: exactSourceTextPattern(sharedEvidence.properties.quote.enum),
  };
  schema.$defs = { ...(schema.$defs || {}), v5_exact_source_evidence: exactSourceEvidence };
  for (const field of TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3) {
    evidenceProperties[field] = {
      anyOf: [{ $ref: '#/$defs/v5_exact_source_evidence' }, { type: 'null' }],
    };
  }
  return schema;
}

export function buildTutorStubResistanceSemanticOutputSchemaV5(prompt) {
  const schema = structuredClone(TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V3);
  const sourceIds = ['utterance', ...prompt.public_context.map((_, index) => `context:${index}`)];
  const sourceTexts = [prompt.utterance.text, ...prompt.public_context.map((row) => row.text)];
  const evidenceProperties = schema.properties.judgment.properties.evidence_quotes.properties;
  for (const field of TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3) {
    const objectBranch = evidenceProperties[field].oneOf[0];
    objectBranch.properties.source_id = { type: 'string', enum: sourceIds };
    objectBranch.properties.quote = { type: 'string', enum: sourceTexts };
  }
  return deduplicateTutorStubResistanceSemanticOutputSchemaV5(schema);
}

export function validateTutorStubResistanceSemanticRegistrationV5(registration) {
  const issues = [];
  if (
    registration?.schema !== 'machinespirits.tutor-stub.resistance-semantic-adjudication-registration.v5' ||
    registration?.version !== 5 ||
    registration?.status !== 'exact_source_transport_frozen'
  ) {
    issues.push('v5 registration identity drifted');
  }
  if (registration?.observationSemantics !== TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V5) {
    issues.push('v5 observation semantics drifted');
  }
  const judges = registration?.measurement?.judges || [];
  const routes = [
    ['semantic_judge_a', 'codex.gpt-5.6-sol', 'codex', 'gpt-5.6-sol'],
    ['semantic_judge_b', 'claude-code.sonnet-5', 'claude-code', 'claude-sonnet-5'],
    ['semantic_judge_c', 'codex.gpt-5.5', 'codex', 'gpt-5.5'],
  ];
  if (
    judges.length !== 3 ||
    routes.some(
      ([id, modelRef, provider, model], index) =>
        judges[index]?.id !== id ||
        judges[index]?.modelRef !== modelRef ||
        judges[index]?.provider !== provider ||
        judges[index]?.model !== model ||
        judges[index]?.effort !== 'low' ||
        judges[index]?.independent !== true,
    )
  ) {
    issues.push('v5 judge panel drifted');
  }
  const rule = registration?.measurement?.hierarchicalConsensus || {};
  if (
    rule.primaryLabelRule !== 'two_of_three_valid_high_confidence_judge_labels' ||
    rule.componentDisagreementMayVetoPrimaryLabel !== false ||
    rule.invalidLowConfidenceOrMissingDisposition !== 'judge_abstention' ||
    rule.noPrimaryMajorityDisposition !== 'measurement_indeterminate' ||
    rule.judgeRerunAfterSemanticResponse !== false ||
    rule.unitReplacementOrOutcomeSelection !== false
  ) {
    issues.push('v5 adjudication rule drifted');
  }
  return { valid: issues.length === 0, issues };
}

export const wrapTutorStubResistanceSemanticModelOutputV5 = wrapTutorStubResistanceSemanticModelOutputV3;
export const adjudicateTutorStubResistanceSemanticJudgesV5 = adjudicateTutorStubResistanceSemanticJudgesV4;
