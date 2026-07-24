import { createHash } from 'node:crypto';

import { DataFactory, Store, Writer } from 'n3';

import { factKey, proofTree } from './chainer.js';

const { literal, namedNode, quad } = DataFactory;

export const PROOF_DAG_SEMANTIC_WEB_SCHEMA = 'machinespirits.derivation.proof-dag-semantic-web.v1';

export const PROOF_DAG_NAMESPACES = Object.freeze({
  ms: 'https://machinespirits.org/ns/proof-dag#',
  prov: 'http://www.w3.org/ns/prov#',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
});

const RESOURCE_BASE = 'https://machinespirits.org/derivation/';
const RDF_TYPE = `${PROOF_DAG_NAMESPACES.rdf}type`;
const RDF_JSON = `${PROOF_DAG_NAMESPACES.rdf}JSON`;
const XSD_BOOLEAN = `${PROOF_DAG_NAMESPACES.xsd}boolean`;
const XSD_INTEGER = `${PROOF_DAG_NAMESPACES.xsd}integer`;
const XSD_DECIMAL = `${PROOF_DAG_NAMESPACES.xsd}decimal`;

const FORBIDDEN_PUBLIC_KEYS = new Set([
  'fact',
  'facts',
  'factArray',
  'missingPremiseId',
  'missingPremiseIds',
  'pathId',
  'pathIds',
  'premiseId',
  'premiseIds',
  'proofPaths',
  'releaseSchedule',
  'ruleId',
  'ruleIds',
  'secretLabel',
]);

function segment(value) {
  return encodeURIComponent(String(value ?? 'unknown'));
}

function resource(...parts) {
  return `${RESOURCE_BASE}${parts.map(segment).join('/')}`;
}

function ms(term) {
  return `${PROOF_DAG_NAMESPACES.ms}${term}`;
}

function prov(term) {
  return `${PROOF_DAG_NAMESPACES.prov}${term}`;
}

function rdfs(term) {
  return `${PROOF_DAG_NAMESPACES.rdfs}${term}`;
}

function add(store, subject, predicate, object) {
  store.addQuad(quad(namedNode(subject), namedNode(predicate), object));
}

function addIri(store, subject, predicate, object) {
  add(store, subject, predicate, namedNode(object));
}

function addText(store, subject, predicate, value) {
  if (value === undefined || value === null || String(value).trim() === '') return;
  add(store, subject, predicate, literal(String(value)));
}

function addBoolean(store, subject, predicate, value) {
  add(store, subject, predicate, literal(value ? 'true' : 'false', namedNode(XSD_BOOLEAN)));
}

function addNumber(store, subject, predicate, value) {
  if (!Number.isFinite(Number(value))) return;
  const datatype = Number.isInteger(Number(value)) ? XSD_INTEGER : XSD_DECIMAL;
  add(store, subject, predicate, literal(String(value), namedNode(datatype)));
}

function addJson(store, subject, predicate, value) {
  add(store, subject, predicate, literal(JSON.stringify(value), namedNode(RDF_JSON)));
}

function addType(store, subject, ...types) {
  for (const type of types) addIri(store, subject, RDF_TYPE, type);
}

function shortHash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 20);
}

function factResource(worldId, fact) {
  return resource('world', worldId, 'fact', shortHash(factKey(fact)));
}

function pathId(pathSpec, index) {
  return pathSpec?.id || pathSpec?.name || pathSpec?.label || `path_${index + 1}`;
}

function collectProofApplications(node, applications = []) {
  if (node.base) return applications;
  for (const premise of node.premises) collectProofApplications(premise, applications);
  applications.push({
    rule: node.rule,
    premises: node.premises.map((premise) => premise.fact),
    output: node.fact,
  });
  return applications;
}

function ensureFact(store, worldId, fact, { label = null, kind = 'Fact' } = {}) {
  const id = factResource(worldId, fact);
  addType(store, id, ms(kind), prov('Entity'));
  addJson(store, id, ms('factJson'), fact);
  addText(store, id, rdfs('label'), label || factKey(fact));
  return id;
}

function authoredDataset(world, sourcePath) {
  const store = new Store();
  const root = resource('world', world.id, 'authored-proof-dag');
  const secret = ensureFact(store, world.id, world.secret.fact, {
    label: world.secret.surface || factKey(world.secret.fact),
    kind: 'SecretFact',
  });
  const source = resource('source', sourcePath || world.id);

  addType(store, root, ms('AuthoredProofDag'), prov('Entity'));
  addText(store, root, ms('schema'), PROOF_DAG_SEMANTIC_WEB_SCHEMA);
  addText(store, root, ms('worldId'), world.id);
  addText(store, root, rdfs('label'), world.title || world.id);
  addIri(store, root, ms('hasSecret'), secret);
  addIri(store, root, prov('wasDerivedFrom'), source);
  addType(store, source, ms('WorldSpecification'), prov('Entity'));
  addText(store, source, ms('sourcePath'), sourcePath || world.id);

  for (const [index, fact] of (world.background || []).entries()) {
    const factId = ensureFact(store, world.id, fact, { label: `background ${index + 1}`, kind: 'BackgroundFact' });
    addIri(store, root, ms('hasBackgroundFact'), factId);
  }

  const premiseResourceById = new Map();
  for (const premise of world.premises || []) {
    const premiseId = resource('world', world.id, 'premise', premise.id);
    const factId = ensureFact(store, world.id, premise.fact, { label: premise.surface, kind: 'PremiseFact' });
    premiseResourceById.set(premise.id, premiseId);
    addType(store, premiseId, ms('AuthoredPremise'), prov('Entity'));
    addText(store, premiseId, ms('premiseId'), premise.id);
    addText(store, premiseId, rdfs('label'), premise.surface || premise.id);
    addIri(store, premiseId, ms('describesFact'), factId);
    addIri(store, root, ms('hasPremise'), premiseId);
  }

  const ruleResourceById = new Map();
  for (const rule of world.rules || []) {
    const ruleId = resource('world', world.id, 'rule', rule.id);
    ruleResourceById.set(rule.id, ruleId);
    addType(store, ruleId, ms('HornRule'), prov('Plan'));
    addText(store, ruleId, ms('ruleId'), rule.id);
    addText(store, ruleId, rdfs('label'), rule.gloss || rule.id);
    addJson(store, ruleId, ms('antecedentJson'), rule.if || []);
    addJson(store, ruleId, ms('consequentJson'), rule.then || []);
    addIri(store, root, ms('hasRule'), ruleId);
  }

  for (const [index, pathSpec] of (world.proofPaths || []).entries()) {
    const authoredPathId = pathId(pathSpec, index);
    const pathResource = resource('world', world.id, 'proof-path', authoredPathId);
    const baseFacts = [
      ...(world.background || []),
      ...(pathSpec.premises || []).map((id) => world.premiseById.get(id)?.fact).filter(Boolean),
    ];
    const tree = proofTree(baseFacts, world.rules || [], world.secret.fact);
    if (!tree) throw new Error(`authored proof path ${authoredPathId} does not entail the secret`);

    addType(store, pathResource, ms('AuthoredProofPath'), prov('Collection'));
    addText(store, pathResource, ms('pathId'), authoredPathId);
    addIri(store, pathResource, ms('concludes'), secret);
    addIri(store, root, ms('hasProofPath'), pathResource);
    for (const premiseId of pathSpec.premises || []) {
      const premiseResource = premiseResourceById.get(premiseId);
      if (premiseResource) addIri(store, pathResource, ms('requiresPremise'), premiseResource);
    }

    collectProofApplications(tree).forEach((application, applicationIndex) => {
      const applicationId = resource(
        'world',
        world.id,
        'proof-path',
        authoredPathId,
        'rule-application',
        applicationIndex + 1,
      );
      const outputId = ensureFact(store, world.id, application.output);
      addType(store, applicationId, ms('RuleApplication'), prov('Activity'));
      addNumber(store, applicationId, ms('order'), applicationIndex + 1);
      addIri(store, applicationId, ms('appliesRule'), ruleResourceById.get(application.rule));
      addIri(store, applicationId, ms('output'), outputId);
      addIri(store, applicationId, prov('generated'), outputId);
      addIri(store, outputId, prov('wasGeneratedBy'), applicationId);
      addIri(store, pathResource, ms('hasRuleApplication'), applicationId);
      addIri(store, pathResource, prov('hadMember'), applicationId);
      for (const input of application.premises) {
        const inputId = ensureFact(store, world.id, input);
        addIri(store, applicationId, ms('input'), inputId);
        addIri(store, applicationId, prov('used'), inputId);
      }
    });
  }

  return { root, store };
}

function authoredIdentifiers(world) {
  return [
    ...(world.premises || []).map((row) => row.id),
    ...(world.rules || []).map((row) => row.id),
    ...(world.proofPaths || []).map(pathId),
  ].filter(Boolean);
}

function tokenPattern(token) {
  const escaped = String(token).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`(^|[^A-Za-z0-9_])${escaped}(?=$|[^A-Za-z0-9_])`, 'u');
}

export function auditPublicProofDagProjection(world, projection) {
  const violations = [];
  const tokens = authoredIdentifiers(world).map((value) => ({ value, pattern: tokenPattern(value) }));
  const visit = (value, path = '$') => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}[${index}]`));
      return;
    }
    if (!value || typeof value !== 'object') {
      if (typeof value === 'string') {
        for (const token of tokens) {
          if (token.pattern.test(value)) violations.push(`${path} contains authored identifier ${token.value}`);
        }
      }
      return;
    }
    for (const [key, entry] of Object.entries(value)) {
      if (FORBIDDEN_PUBLIC_KEYS.has(key)) violations.push(`${path}.${key} is an authored-only field`);
      visit(entry, `${path}.${key}`);
    }
  };
  visit(projection);
  return { ok: violations.length === 0, violations: [...new Set(violations)].sort() };
}

function assertPublicProjection(world, projection, label) {
  const audit = auditPublicProofDagProjection(world, projection);
  if (!audit.ok) throw new Error(`${label} violates the public projection boundary: ${audit.violations.join('; ')}`);
}

function addPublicRecordRows(store, { root, source, worldId, projection, categories }) {
  for (const [category, className, textField] of categories) {
    for (const [index, row] of (projection?.[category] || []).entries()) {
      const rowId = resource('world', worldId, 'public-record', root.split('/').at(-1), category, index + 1);
      addType(store, rowId, ms(className), ms('PublicProjectionNode'), prov('Entity'));
      addText(store, rowId, ms(textField), row?.[textField]);
      if (textField !== 'surface') addText(store, rowId, ms('surface'), row?.surface);
      addText(store, rowId, ms('answer'), row?.answer);
      addText(store, rowId, ms('sourceKind'), row?.source);
      addNumber(store, rowId, ms('turn'), row?.turn);
      addIri(store, rowId, prov('wasDerivedFrom'), source);
      addIri(store, root, ms('hasRecord'), rowId);
      addIri(store, root, prov('hadMember'), rowId);
    }
  }
}

function addMetrics(store, root, metrics = {}) {
  for (const [key, value] of Object.entries(metrics || {}).sort(([a], [b]) => a.localeCompare(b))) {
    if (Number.isFinite(Number(value))) addNumber(store, root, ms(key), value);
  }
}

function learnerDataset(world, projection) {
  assertPublicProjection(world, projection, 'learner proxy DAG');
  const store = new Store();
  const turn = Number.isFinite(projection?.turn) ? projection.turn : 0;
  const root = resource('world', world.id, 'learner-proxy-dag', turn);
  const source = resource('world', world.id, 'public-interaction-record', turn);
  addType(store, root, ms('LearnerProxyDag'), ms('PublicProjectionNode'), prov('Collection'), prov('Entity'));
  addText(store, root, ms('schema'), projection?.schema);
  addText(store, root, ms('worldId'), world.id);
  addBoolean(store, root, ms('publicOnly'), projection?.publicOnly === true);
  addNumber(store, root, ms('turn'), turn);
  addIri(store, root, prov('wasDerivedFrom'), source);
  addType(store, source, ms('PublicInteractionRecord'), ms('PublicProjectionNode'), prov('Entity'));
  addText(store, source, ms('worldId'), world.id);
  addNumber(store, source, ms('turn'), turn);
  addPublicRecordRows(store, {
    root,
    source,
    worldId: world.id,
    projection,
    categories: [
      ['grounded', 'GroundedPublicFact', 'surface'],
      ['voicedDerived', 'VoicedPublicConclusion', 'surface'],
      ['hypotheses', 'LearnerHypothesis', 'text'],
      ['candidateConclusions', 'CandidatePublicConclusion', 'surface'],
      ['answerCandidates', 'AnswerCandidate', 'surface'],
    ],
  });
  addMetrics(store, root, projection?.metrics);
  return { root, store };
}

function tutorDataset(world, projection) {
  assertPublicProjection(world, projection, 'tutor learner-DAG model');
  const store = new Store();
  const turn = Number.isFinite(projection?.turn) ? projection.turn : 0;
  const root = resource('world', world.id, 'tutor-learner-dag-model', turn);
  const source = resource('world', world.id, 'learner-proxy-dag', turn);
  addType(store, root, ms('TutorLearnerDagModel'), ms('PublicProjectionNode'), prov('Collection'), prov('Entity'));
  addText(store, root, ms('schema'), projection?.schema);
  addText(store, root, ms('worldId'), world.id);
  addText(store, root, ms('role'), projection?.role || 'tutor');
  addBoolean(store, root, ms('publicOnly'), projection?.publicOnly === true);
  addBoolean(store, root, ms('advisoryOnly'), projection?.advisoryOnly === true);
  addNumber(store, root, ms('turn'), turn);
  addIri(store, root, prov('wasDerivedFrom'), source);
  addType(store, source, ms('LearnerProxyDagReference'), ms('PublicProjectionNode'), prov('Entity'));
  addText(store, source, ms('worldId'), world.id);
  addNumber(store, source, ms('turn'), turn);
  addPublicRecordRows(store, {
    root,
    source,
    worldId: world.id,
    projection: projection?.learnerRecord,
    categories: [
      ['grounded', 'GroundedPublicFact', 'surface'],
      ['voicedDerived', 'VoicedPublicConclusion', 'surface'],
      ['hypotheses', 'LearnerHypothesis', 'text'],
      ['candidateConclusions', 'CandidatePublicConclusion', 'surface'],
      ['answerCandidates', 'AnswerCandidate', 'surface'],
    ],
  });
  const assessment = projection?.assessment || {};
  addText(store, root, ms('assessmentStatus'), assessment.status);
  addNumber(store, root, ms('bestPathCoverage'), assessment.bestPathCoverage);
  addBoolean(store, root, ms('finalSecretEntailed'), assessment.finalSecretEntailed === true);
  addBoolean(store, root, ms('assertedSecret'), assessment.assertedSecret === true);
  addBoolean(store, root, ms('assertedMirror'), assessment.assertedMirror === true);
  addText(store, root, ms('bottleneck'), assessment.bottleneck);
  addNumber(store, root, ms('missingPremiseCount'), assessment.missingPremiseCount);
  addJson(store, root, ms('missingPremiseBucketsJson'), assessment.missingPremiseBuckets || {});
  addMetrics(store, root, projection?.metrics);
  return { root, store };
}

function quadSortKey(entry) {
  return [entry.graph, entry.subject, entry.predicate, entry.object]
    .map((term) => `${term.termType}:${term.value}`)
    .join('|');
}

function sortedQuads(store) {
  return store.getQuads(null, null, null, null).sort((a, b) => quadSortKey(a).localeCompare(quadSortKey(b)));
}

function compactIri(value) {
  for (const [prefix, namespace] of Object.entries(PROOF_DAG_NAMESPACES)) {
    if (value.startsWith(namespace)) return `${prefix}:${value.slice(namespace.length)}`;
  }
  return value;
}

function jsonLdValue(term) {
  if (term.termType === 'NamedNode') return { '@id': compactIri(term.value) };
  if (term.termType !== 'Literal') return { '@value': term.value };
  if (term.datatype?.value === XSD_BOOLEAN) return term.value === 'true';
  if (term.datatype?.value === XSD_INTEGER || term.datatype?.value === XSD_DECIMAL) return Number(term.value);
  if (term.datatype?.value === RDF_JSON) return { '@value': JSON.parse(term.value), '@type': '@json' };
  if (term.language) return { '@value': term.value, '@language': term.language };
  return term.value;
}

export function proofDagDatasetToJsonLd(store) {
  const nodes = new Map();
  for (const entry of sortedQuads(store)) {
    const id = compactIri(entry.subject.value);
    if (!nodes.has(id)) nodes.set(id, { '@id': id });
    const node = nodes.get(id);
    if (entry.predicate.value === RDF_TYPE) {
      node['@type'] ||= [];
      node['@type'].push(compactIri(entry.object.value));
      continue;
    }
    const key = compactIri(entry.predicate.value);
    node[key] ||= [];
    node[key].push(jsonLdValue(entry.object));
  }
  for (const node of nodes.values()) {
    if (node['@type']) node['@type'].sort();
  }
  return {
    '@context': {
      '@version': 1.1,
      ...PROOF_DAG_NAMESPACES,
    },
    '@graph': [...nodes.values()].sort((a, b) => a['@id'].localeCompare(b['@id'])),
  };
}

export function serializeProofDagJsonLd(store) {
  return `${JSON.stringify(proofDagDatasetToJsonLd(store), null, 2)}\n`;
}

export function serializeProofDagRdf(store, { format = 'Turtle' } = {}) {
  return new Promise((resolve, reject) => {
    const writer = new Writer({ format, prefixes: PROOF_DAG_NAMESPACES });
    writer.addQuads(sortedQuads(store));
    writer.end((error, output) => (error ? reject(error) : resolve(output)));
  });
}

export async function buildProofDagSemanticWebArtifacts({
  world,
  learnerProxyDag,
  tutorLearnerDagModel,
  sourcePath = null,
} = {}) {
  if (!world?.id) throw new Error('world is required');
  if (!learnerProxyDag) throw new Error('learnerProxyDag is required');
  if (!tutorLearnerDagModel) throw new Error('tutorLearnerDagModel is required');
  const authored = authoredDataset(world, sourcePath);
  const learner = learnerDataset(world, learnerProxyDag);
  const tutor = tutorDataset(world, tutorLearnerDagModel);
  const combined = new Store();
  for (const [name, artifact] of Object.entries({ authored, learner, tutor })) {
    const graph = namedNode(resource('world', world.id, 'graph', name));
    for (const entry of sortedQuads(artifact.store)) {
      combined.addQuad(quad(entry.subject, entry.predicate, entry.object, graph));
    }
  }
  return {
    schema: PROOF_DAG_SEMANTIC_WEB_SCHEMA,
    worldId: world.id,
    authored,
    learner,
    tutor,
    combined,
  };
}
