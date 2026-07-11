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
  assert.deepEqual(layerIds, ['drama', 'rhetoric', 'logic', 'pedagogy', 'theory', 'novel']);

  const labels = new Set(schema.concepts.map((concept) => concept.label));
  for (const label of [
    'recognition',
    'misrecognition',
    'ego',
    'superego',
    'id',
    'charisma',
    'audience',
    'register',
    'Bildung',
    'desire',
    'infosomatic',
    'pleasurable guilt',
  ]) {
    assert.ok(labels.has(label), `expected concept ${label}`);
  }

  const theoryTokens = schema.layers.find((layer) => layer.id === 'theory')?.tokens || [];
  assert.ok(theoryTokens.includes('ego.superego'));
  assert.ok(theoryTokens.includes('charisma'));

  const dramaTokens = schema.layers.find((layer) => layer.id === 'drama')?.tokens || [];
  const rhetoricTokens = schema.layers.find((layer) => layer.id === 'rhetoric')?.tokens || [];
  assert.ok(dramaTokens.includes('audience'));
  assert.ok(rhetoricTokens.includes('register'));

  const audience = schema.concepts.find((concept) => concept.id === 'drama.audience');
  const register = schema.concepts.find((concept) => concept.id === 'rhetoric.register');
  assert.equal(audience?.ontology, 'Audience');
  assert.equal(register?.ontology, 'RegisterRealization');
  assert.ok(register?.links.some((link) => link.target === 'drama.audience'));

  const novelTokens = schema.layers.find((layer) => layer.id === 'novel')?.tokens || [];
  assert.deepEqual(novelTokens, ['infosomatic', 'pleasurable guilt']);
  assert.deepEqual(schema.novelConceptIds, ['novel.infosomatic', 'novel.pleasurable_guilt']);

  const novelGroup = schema.vocabularyGroups.find((group) => group.title === 'novel concepts');
  assert.deepEqual(novelGroup?.tokens, ['infosomatic', 'pleasurable guilt']);
});

test('derivation concept schema links form a closed local graph', () => {
  const schema = getDerivationConceptSchema();
  const ids = new Set(schema.concepts.map((concept) => concept.id));
  const layerIds = new Set(schema.layers.map((layer) => layer.id));

  for (const concept of schema.concepts) {
    assert.ok(layerIds.has(concept.layer), `${concept.id} layer exists: ${concept.layer}`);
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

  const novelItems = system.individualGroups
    .filter((group) => group.type.includes('NovelConcept'))
    .flatMap((group) => group.items.map((item) => item.id));
  assert.ok(novelItems.includes('InfosomaticConcept'));
  assert.ok(novelItems.includes('PleasurableGuiltConcept'));

  const abox = [
    '@prefix ms: <https://machinespirits.dev/ontology/reasoning#> .',
    '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .',
    '',
    'ms:visibleRunWorld rdf:type ms:DerivationWorldConcept .',
  ].join('\n');
  const check = await checkAboxConsistency(abox, { modules });
  assert.equal(check.consistent, true);
});
