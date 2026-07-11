import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAddresseeProfileDefinitions,
  getAudienceRegisterDefinitions,
  getCommunicativePragmatics,
  getEngagementStancePragmatics,
  getRegisterOntologyVersion,
} from '../services/engagementRegisterRegistry.js';

test('register ontology v4 distinguishes speaker, hearer, and non-enacted audience', () => {
  const pragmatics = getCommunicativePragmatics();

  assert.equal(getRegisterOntologyVersion(), 4);
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
