import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAddresseeProfileDefinitions,
  getAudienceRegisterDefinitions,
  getCommunicativePragmatics,
  getEngagementStancePragmatics,
  getRegisterOntologyVersion,
} from '../services/engagementRegisterRegistry.js';
import {
  buildTutorStubRegisterPragmatics,
  normalizeTutorStubResponseConfiguration,
} from '../services/tutorStubRegisterPragmatics.js';
import {
  buildTutorStubResponseConfiguration,
  tutorStubResponseConfigurationPrompt,
} from '../services/tutorStubResponseConfiguration.js';

test('register ontology v5 distinguishes speaker, hearer, and non-enacted audience', () => {
  const pragmatics = getCommunicativePragmatics();

  assert.equal(getRegisterOntologyVersion(), 5);
  assert.equal(pragmatics.position_model.speaker.default_role, 'tutor');
  assert.equal(pragmatics.position_model.hearer.default_role, 'learner');
  assert.equal(pragmatics.position_model.audience.ontology_class, 'Audience');
  assert.equal(pragmatics.position_model.audience.enacted, false);
  assert.equal(pragmatics.position_model.audience.optional, true);
});

test('sarcastic stance declares the typical triadic, speaker-aligned audience relation', () => {
  const sarcastic = getEngagementStancePragmatics('sarcastic');
  const plain = getEngagementStancePragmatics('plain');

  assert.equal(sarcastic.address_structure, 'triadic');
  assert.equal(sarcastic.audience_presence, 'implied');
  assert.equal(sarcastic.audience_distinct_from_hearer, true);
  assert.equal(sarcastic.audience_alignment, 'speaker');
  assert.equal(plain.address_structure, 'dyadic');
  assert.equal(plain.audience_presence, 'unspecified');
});

test('legacy audience_register definitions are exposed canonically as addressee profiles', () => {
  const pragmatics = getCommunicativePragmatics();

  assert.strictEqual(getAudienceRegisterDefinitions(), getAddresseeProfileDefinitions());
  assert.equal(pragmatics.compatibility.audience_register.canonical_concept, 'addressee_profile');
  assert.ok(getAddresseeProfileDefinitions().adult_novice);
});

test('runtime pragmatics keeps addressee proficiency separate from a non-enacted audience', () => {
  const world = {
    audience: {
      context: {
        description: 'Two apprentices observe the inquiry.',
        relationToSpeaker: 'They will later review the tutor’s explanation.',
        relationToHearer: 'They are peers of the learner.',
        knowledge: 'They know only the public record.',
      },
    },
  };
  const configuration = buildTutorStubResponseConfiguration({
    engagementStance: 'plain',
    learnerText: 'Please make that clearer.',
    world,
  });

  assert.equal(configuration.schema, 'machinespirits.tutor-stub.response-configuration.v3');
  assert.equal(configuration.addressee_profile, configuration.audience_register);
  assert.equal(configuration.register_pragmatics.address_structure, 'triadic');
  assert.deepEqual(configuration.register_pragmatics.speaker, { role: 'tutor', enacted: true });
  assert.equal(configuration.register_pragmatics.hearer.role, 'learner');
  assert.equal(configuration.register_pragmatics.hearer.addressee_profile, configuration.addressee_profile);
  assert.equal(configuration.register_pragmatics.audience.presence, 'declared');
  assert.equal(configuration.register_pragmatics.audience.enacted, false);
  assert.equal(configuration.register_pragmatics.audience.turn_bearing, false);
  assert.equal(configuration.register_pragmatics.audience.cast_binding, null);
  assert.equal(configuration.register_pragmatics.audience.belief_graph_binding, null);
  assert.match(tutorStubResponseConfigurationPrompt(configuration), /audience is non-speaking/iu);
});

test('stance pragmatics can represent an implied audience without inventing an enacted role', () => {
  const pragmatics = buildTutorStubRegisterPragmatics({
    engagementStance: 'sarcastic',
    addresseeProfile: 'informed_peer',
  });

  assert.equal(pragmatics.address_structure, 'triadic');
  assert.equal(pragmatics.audience.presence, 'implied');
  assert.equal(pragmatics.audience.alignment, 'speaker');
  assert.equal(pragmatics.audience.distinct_from_hearer, true);
  assert.equal(pragmatics.audience.context, null);
  assert.equal(pragmatics.audience.enacted, false);
});

test('legacy v2 response configurations migrate without changing stance vectors', () => {
  const legacy = {
    schema: 'machinespirits.tutor-stub.response-configuration.v2',
    engagement_stance: 'precise',
    audience_register: 'adult_novice',
    engagement_stance_vector: { precise: 0.75, warm: 0.25 },
    register_vector: { precise: 0.75, warm: 0.25 },
    compatibility: { selected_register: 'precise' },
  };
  const migrated = normalizeTutorStubResponseConfiguration(legacy);

  assert.equal(migrated.schema, 'machinespirits.tutor-stub.response-configuration.v3');
  assert.equal(migrated.addressee_profile, 'adult_novice');
  assert.equal(migrated.audience_register, 'adult_novice');
  assert.equal(migrated.compatibility.selected_register, 'precise');
  assert.equal(migrated.compatibility.migrated_from_schema, legacy.schema);
  assert.deepEqual(migrated.engagement_stance_vector, legacy.engagement_stance_vector);
  assert.deepEqual(migrated.register_vector, legacy.register_vector);
});
