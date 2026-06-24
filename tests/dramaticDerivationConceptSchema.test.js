import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getDerivationConceptSchema,
  DERIVATION_CONCEPT_ONTOLOGY_MODULE,
} from '../services/dramaticDerivation/conceptSchema.js';
import { checkAboxConsistency } from '../services/ontology/reasoningOntology.js';
import { buildOntologyView, ALL_MODULES, DEFAULT_MODULES } from '../services/ontology/ontologyView.js';

test('derivation concept schema includes theory layer and requested concepts', () => {
  const schema = getDerivationConceptSchema();
  const layerIds = schema.layers.map((layer) => layer.id);
  assert.deepEqual(layerIds, ['drama', 'rhetoric', 'logic', 'pedagogy', 'theory']);

  const labels = new Set(schema.concepts.map((concept) => concept.label));
  for (const label of ['recognition', 'misrecognition', 'ego', 'superego', 'id', 'charisma', 'Bildung']) {
    assert.ok(labels.has(label), `expected concept ${label}`);
  }

  const theoryTokens = schema.layers.find((layer) => layer.id === 'theory')?.tokens || [];
  assert.ok(theoryTokens.includes('ego.superego'));
  assert.ok(theoryTokens.includes('charisma'));
});

test('derivation concept schema links form a closed local graph', () => {
  const schema = getDerivationConceptSchema();
  const ids = new Set(schema.concepts.map((concept) => concept.id));

  for (const concept of schema.concepts) {
    assert.ok(concept.definition.length > 20, `${concept.id} has a definition`);
    assert.ok(concept.ontology, `${concept.id} has an ontology term`);
    for (const link of concept.links) {
      assert.ok(ids.has(link.target), `${concept.id} link target exists: ${link.target}`);
      assert.ok(link.type, `${concept.id} link has type`);
    }
  }
});

test('derivation concept-world ontology is registered as an opt-in module and parses', async () => {
  assert.ok(ALL_MODULES.includes(DERIVATION_CONCEPT_ONTOLOGY_MODULE));
  assert.ok(!DEFAULT_MODULES.includes(DERIVATION_CONCEPT_ONTOLOGY_MODULE));

  const modules = ['reasoning', 'poetics', 'discursive', 'adaptation', 'rhetoric', DERIVATION_CONCEPT_ONTOLOGY_MODULE];
  const system = buildOntologyView({ view: 'system', modules });
  const ontologyIds = system.ontologies.map((ontology) => ontology.id);
  assert.ok(ontologyIds.includes('DerivationConceptWorldOntology'));

  const conceptWorldGroup = system.individualGroups.find((group) => group.type === 'ConceptWorld');
  assert.ok(conceptWorldGroup?.items.some((item) => item.id === 'DerivationConceptWorld'));

  const philosophicalGroup = system.individualGroups.find((group) => group.type === 'PhilosophicalConcept');
  assert.ok(philosophicalGroup?.items.some((item) => item.id === 'RecognitionConcept'));
  assert.ok(philosophicalGroup?.items.some((item) => item.id === 'BildungConcept'));

  const abox = [
    '@prefix ms: <https://machinespirits.dev/ontology/reasoning#> .',
    '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .',
    '',
    'ms:visibleRunWorld rdf:type ms:DerivationWorldConcept .',
  ].join('\n');
  const check = await checkAboxConsistency(abox, { modules });
  assert.equal(check.consistent, true);
});
