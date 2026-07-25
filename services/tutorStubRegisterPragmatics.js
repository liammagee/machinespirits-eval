import {
  getCommunicativePragmatics,
  getEngagementStancePragmatics,
  getRegisterOntologyVersion,
} from './engagementRegisterRegistry.js';

export const TUTOR_STUB_REGISTER_PRAGMATICS_SCHEMA = 'machinespirits.tutor-stub.register-pragmatics.v1';

const AUDIENCE_CONTEXT_FIELDS = Object.freeze([
  ['description', 'description'],
  ['relation_to_speaker', 'relationToSpeaker'],
  ['relation_to_hearer', 'relationToHearer'],
  ['knowledge', 'knowledge'],
]);

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : '';
}

export function normalizeDramaticAudience(
  rawAudience,
  {
    fail = (message) => {
      throw new Error(message);
    },
  } = {},
) {
  if (rawAudience === undefined || rawAudience === null) return null;
  if (!rawAudience || typeof rawAudience !== 'object' || Array.isArray(rawAudience)) {
    fail('audience must be an object when supplied');
    return null;
  }
  const rawContext = rawAudience.context;
  if (!rawContext || typeof rawContext !== 'object' || Array.isArray(rawContext)) {
    fail('audience.context must be an object when audience is supplied');
    return null;
  }
  const context = {};
  for (const [sourceField, runtimeField] of AUDIENCE_CONTEXT_FIELDS) {
    if (rawContext[sourceField] === undefined) continue;
    const value = cleanText(rawContext[sourceField]);
    if (!value) {
      fail(`audience.context.${sourceField} must be a non-empty string when supplied`);
      return null;
    }
    context[runtimeField] = value;
  }
  if (Object.keys(context).length === 0) {
    fail('audience.context must describe at least one public audience relation');
    return null;
  }
  return Object.freeze({ context: Object.freeze(context) });
}

export function dramaticAudienceContext(world) {
  return world?.audience?.context || null;
}

export function dramaticAudiencePromptLines(world, { heading = 'Non-speaking audience context' } = {}) {
  const context = dramaticAudienceContext(world);
  if (!context) return [];
  return [
    `${heading}:`,
    context.description ? `- Description: ${context.description}` : null,
    context.relationToSpeaker ? `- Relation to speaker: ${context.relationToSpeaker}` : null,
    context.relationToHearer ? `- Relation to hearer: ${context.relationToHearer}` : null,
    context.knowledge ? `- Publicly attributed knowledge: ${context.knowledge}` : null,
    '- This audience is contextual only: never give it dialogue, a turn, a role, agency, private beliefs, or a cast binding.',
  ].filter(Boolean);
}

export function buildTutorStubRegisterPragmatics({ engagementStance, addresseeProfile, world = null } = {}) {
  const model = getCommunicativePragmatics();
  const positions = model.position_model || {};
  const stancePragmatics = getEngagementStancePragmatics(engagementStance) || {};
  const context = dramaticAudienceContext(world);
  const explicitAudience = Boolean(context);
  return {
    schema: TUTOR_STUB_REGISTER_PRAGMATICS_SCHEMA,
    ontology_version: getRegisterOntologyVersion(),
    address_structure: explicitAudience ? 'triadic' : stancePragmatics.address_structure || 'dyadic',
    speaker: {
      role: positions.speaker?.default_role || 'tutor',
      enacted: positions.speaker?.enacted !== false,
    },
    hearer: {
      role: positions.hearer?.default_role || 'learner',
      enacted: positions.hearer?.enacted !== false,
      addressee_profile: addresseeProfile || 'domain_apprentice',
    },
    audience: {
      presence: explicitAudience ? 'declared' : stancePragmatics.audience_presence || 'unspecified',
      alignment: stancePragmatics.audience_alignment || 'none',
      distinct_from_hearer: explicitAudience
        ? true
        : stancePragmatics.audience_distinct_from_hearer === undefined
          ? null
          : Boolean(stancePragmatics.audience_distinct_from_hearer),
      context: context ? structuredClone(context) : null,
      enacted: false,
      turn_bearing: false,
      cast_binding: null,
      belief_graph_binding: null,
    },
  };
}

export function normalizeTutorStubResponseConfiguration(configuration, { world = null } = {}) {
  if (!configuration || typeof configuration !== 'object') return configuration || null;
  const addresseeProfile = configuration.addressee_profile || configuration.audience_register || 'domain_apprentice';
  const migratedFromSchema =
    configuration.schema && configuration.schema !== 'machinespirits.tutor-stub.response-configuration.v3'
      ? configuration.schema
      : null;
  const registerPragmatics =
    world || !configuration.register_pragmatics
      ? buildTutorStubRegisterPragmatics({
          engagementStance: configuration.engagement_stance || configuration.compatibility?.selected_register,
          addresseeProfile,
          world,
        })
      : structuredClone(configuration.register_pragmatics);
  return {
    ...structuredClone(configuration),
    schema: 'machinespirits.tutor-stub.response-configuration.v3',
    addressee_profile: addresseeProfile,
    audience_register: addresseeProfile,
    register_pragmatics: registerPragmatics,
    selection_reasons: {
      ...(configuration.selection_reasons || {}),
      addressee_profile:
        configuration.selection_reasons?.addressee_profile ||
        configuration.selection_reasons?.audience_register ||
        null,
      audience_register:
        configuration.selection_reasons?.addressee_profile ||
        configuration.selection_reasons?.audience_register ||
        null,
    },
    compatibility: {
      ...(configuration.compatibility || {}),
      audience_register: 'addressee_profile',
      ...(migratedFromSchema ? { migrated_from_schema: migratedFromSchema } : {}),
    },
  };
}
