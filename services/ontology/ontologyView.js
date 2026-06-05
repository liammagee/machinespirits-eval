import { Parser } from 'n3';
import { loadModuleSources, ALL_MODULES, DEFAULT_MODULES, NS } from './reasoningOntology.js';

// ============================================================================
// Ontology viewer model (read-only). Parses the shared TBox (config/ontology/*.ttl)
// and projects it into three lenses for the poetics script editor:
//
//   system  — the whole loaded vocabulary: class taxonomy, properties, named
//             individuals grouped by type, role-views, per-module provenance.
//   tutor   — the ms:TutorRole projection: moves it performs, role-prefixed class
//             families (Tutor*), interior agencies (Ego/Superego/Id), the
//             PolicyAction/Tactic space, and the evidence->policy guard table.
//   learner — the ms:LearnerRole projection: moves it performs, Learner* class
//             families, interior agencies (Ego/Superego), and the state-space it
//             can occupy (ReasoningError / RecognitionState / KC / ToM / signals).
//
// Two role-projection mechanisms, both DECLARATIVE (no special-casing per module):
//   1. ABox moves  — individuals with `ms:performedByRole ms:<Role>` (poetics).
//   2. TBox classes — classes whose local name starts with the role prefix
//      (Tutor*/Learner*) PLUS their transitive subclasses (picks up the
//      discursive-game TutorPublicMove/LearnerSignal hierarchies, etc.).
//
// Pure parse — NO reasoner call (a viewer shows the AUTHORED vocabulary; the rule
// files are surfaced as raw source). Fast + deterministic. See the live reasoner
// in reasoningOntology.js (validateTurnPlan) for the inference side.
// ============================================================================

export { ALL_MODULES, DEFAULT_MODULES };

const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const OWL = 'http://www.w3.org/2002/07/owl#';
const RDF_TYPE = `${RDF}type`;

// Compact an IRI to a local name: strip our namespace, prefix the well-known ones.
function localName(term) {
  const v = typeof term === 'string' ? term : term?.value || '';
  if (v.startsWith(NS)) return v.slice(NS.length);
  if (v.startsWith(OWL)) return `owl:${v.slice(OWL.length)}`;
  if (v.startsWith(RDFS)) return `rdfs:${v.slice(RDFS.length)}`;
  if (v.startsWith(RDF)) return `rdf:${v.slice(RDF.length)}`;
  return v;
}

const byId = (a, b) => String(a.id).localeCompare(String(b.id));

function emptyNode(id) {
  return {
    id,
    label: null,
    comment: null,
    module: null,
    types: [],
    subClassOf: [],
    domain: [],
    range: [],
    isClass: false,
    isObjectProperty: false,
    isDatatypeProperty: false,
    isOntology: false,
    isIndividual: false,
    out: {}, // ms:predicateLocal -> [objectLocal]
  };
}

function addOut(node, pred, value) {
  if (!node.out[pred]) node.out[pred] = [];
  if (!node.out[pred].includes(value)) node.out[pred].push(value);
}

// Parse the requested modules' TBox TTL into a node map. The N3 rule files are NOT
// parsed here (they are N3 logic, not declarations) — they ride along as raw text.
export function buildOntologyModel(modules = DEFAULT_MODULES) {
  const sources = loadModuleSources(modules);
  const nodes = new Map();
  const ensure = (id, module) => {
    if (!nodes.has(id)) nodes.set(id, emptyNode(id));
    const node = nodes.get(id);
    if (module && !node.module) node.module = module;
    return node;
  };

  for (const src of sources) {
    let quads;
    try {
      quads = new Parser({ format: 'text/turtle' }).parse(src.tbox.text);
    } catch (err) {
      throw new Error(`failed to parse ontology module "${src.name}" (${src.tbox.file}): ${err.message}`);
    }
    for (const quad of quads) {
      const node = ensure(localName(quad.subject), src.name);
      const predicate = quad.predicate.value;
      const objectLocal = localName(quad.object);
      if (predicate === RDF_TYPE) {
        if (objectLocal === 'owl:Class') node.isClass = true;
        else if (objectLocal === 'owl:ObjectProperty') node.isObjectProperty = true;
        else if (objectLocal === 'owl:DatatypeProperty') node.isDatatypeProperty = true;
        else if (objectLocal === 'owl:Ontology') node.isOntology = true;
        else {
          node.types.push(objectLocal);
          node.isIndividual = true;
        }
      } else if (predicate === `${RDFS}subClassOf`) node.subClassOf.push(objectLocal);
      else if (predicate === `${RDFS}label`) node.label = quad.object.value;
      else if (predicate === `${RDFS}comment`) node.comment = quad.object.value;
      else if (predicate === `${RDFS}domain`) node.domain.push(objectLocal);
      else if (predicate === `${RDFS}range`) node.range.push(objectLocal);
      else if (predicate === `${OWL}disjointWith`) addOut(node, 'disjointWith', objectLocal);
      else if (predicate.startsWith(NS)) {
        addOut(node, localName(predicate), quad.object.termType === 'Literal' ? quad.object.value : objectLocal);
      }
    }
  }

  for (const node of nodes.values()) {
    node.types = [...new Set(node.types)];
    node.subClassOf = [...new Set(node.subClassOf)];
  }
  return { nodes, sources, modules: sources.map((s) => s.name) };
}

// ── projection helpers ────────────────────────────────────────────────────────

const classList = (nodes) => [...nodes.values()].filter((n) => n.isClass);
const individualList = (nodes) =>
  [...nodes.values()].filter(
    (n) => n.isIndividual && !n.isClass && !n.isObjectProperty && !n.isDatatypeProperty && !n.isOntology,
  );

// class id -> direct subclass ids (only among loaded classes).
function childrenMap(nodes) {
  const map = new Map();
  const ids = new Set(classList(nodes).map((c) => c.id));
  for (const cls of classList(nodes)) {
    for (const parent of cls.subClassOf) {
      if (!ids.has(parent)) continue;
      if (!map.has(parent)) map.set(parent, []);
      map.get(parent).push(cls.id);
    }
  }
  return map;
}

function descendants(childMap, roots) {
  const out = [];
  const seen = new Set();
  const stack = [...roots];
  while (stack.length) {
    const current = stack.pop();
    for (const child of childMap.get(current) || []) {
      if (seen.has(child)) continue;
      seen.add(child);
      out.push(child);
      stack.push(child);
    }
  }
  return out;
}

function briefOf(nodes, id) {
  const node = nodes.get(id);
  if (!node) return null;
  return { id, label: node.label, comment: node.comment, module: node.module, subClassOf: node.subClassOf };
}

function moduleSummary(model) {
  const counts = (name) => {
    let classes = 0;
    let individuals = 0;
    for (const node of model.nodes.values()) {
      if (node.module !== name) continue;
      if (node.isClass) classes += 1;
      else if (node.isIndividual) individuals += 1;
    }
    return { classes, individuals };
  };
  return model.sources.map((s) => ({
    name: s.name,
    tboxFile: s.tbox.file,
    tboxText: s.tbox.text,
    rulesFile: s.rules?.file || null,
    rulesText: s.rules?.text || null,
    ...counts(s.name),
  }));
}

// ── system lens ───────────────────────────────────────────────────────────────

function classTree(nodes) {
  const ids = new Set(classList(nodes).map((c) => c.id));
  const cmap = childrenMap(nodes);
  // A root is a class with no parent that is itself a loaded class.
  const roots = classList(nodes)
    .filter((c) => c.subClassOf.filter((p) => ids.has(p)).length === 0)
    .map((c) => c.id)
    .sort();
  const view = (id) => {
    const node = nodes.get(id);
    return {
      id,
      label: node?.label || null,
      comment: node?.comment || null,
      module: node?.module || null,
      children: (cmap.get(id) || []).slice().sort().map(view),
    };
  };
  return roots.map(view);
}

function systemView(model) {
  const { nodes } = model;
  const individuals = individualList(nodes);
  const properties = (flag) =>
    [...nodes.values()]
      .filter((n) => n[flag])
      .map((n) => ({
        id: n.id,
        label: n.label,
        comment: n.comment,
        domain: n.domain,
        range: n.range,
        module: n.module,
      }))
      .sort(byId);

  const groups = new Map();
  for (const ind of individuals) {
    const key = ind.types.slice().sort().join(' + ') || '(untyped)';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ id: ind.id, label: ind.label, comment: ind.comment, out: ind.out, module: ind.module });
  }

  return {
    view: 'system',
    modules: moduleSummary(model),
    counts: {
      classes: classList(nodes).length,
      individuals: individuals.length,
      objectProperties: properties('isObjectProperty').length,
      datatypeProperties: properties('isDatatypeProperty').length,
    },
    ontologies: [...nodes.values()]
      .filter((n) => n.isOntology)
      .map((n) => ({ id: n.id, label: n.label, comment: n.comment, module: n.module }))
      .sort(byId),
    classTree: classTree(nodes),
    objectProperties: properties('isObjectProperty'),
    datatypeProperties: properties('isDatatypeProperty'),
    individualGroups: [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([type, items]) => ({ type, items: items.sort(byId) })),
    roleViews: individuals
      .filter((i) => i.types.includes('RoleView'))
      .map((i) => i.id)
      .sort(),
  };
}

// ── role lenses (tutor / learner) ─────────────────────────────────────────────

const ROLE_SPEC = Object.freeze({
  tutor: {
    prefix: 'Tutor',
    roleClass: 'TutorRole',
    character: 'TutorCharacter',
    roleViews: ['tutor_ego', 'tutor_superego'],
    blurb:
      'The tutor reads the learner’s public signals, forms an evidence-bound hypothesis, and selects a policy/tactic. Its repertoire is the moves it performs; its decision layer is the evidence→policy guard table and the PolicyAction / DiscursiveTactic space.',
  },
  learner: {
    prefix: 'Learner',
    roleClass: 'LearnerRole',
    character: 'LearnerCharacter',
    roleViews: ['learner_ego', 'learner_superego'],
    blurb:
      'The learner occupies reasoning / recognition / theory-of-mind states and the public signals it can emit, and moves between them. Its repertoire is the moves it performs; its state-space is the classes it can hold.',
  },
});

// Classes scoped to a role by the Tutor*/Learner* naming convention, plus every
// transitive subclass (so e.g. AccountableRepair ⊑ RepairMove ⊑ TutorPublicMove is
// pulled into the tutor lens even though only the top of the chain is name-tagged).
function roleScopedClasses(nodes, prefix) {
  const cmap = childrenMap(nodes);
  const seeds = classList(nodes)
    .filter((c) => c.id.startsWith(prefix))
    .map((c) => c.id);
  const ids = new Set([...seeds, ...descendants(cmap, seeds)]);
  return [...ids]
    .map((id) => briefOf(nodes, id))
    .filter(Boolean)
    .sort(byId);
}

function groupIndividualsByTypes(individuals, types) {
  return types
    .map((type) => ({
      type,
      items: individuals
        .filter((i) => i.types.includes(type))
        .map((i) => ({
          id: i.id,
          label: i.label,
          comment: i.comment,
          aimsAtForm: (i.out.aimsAtForm || []).slice().sort(),
          contraindicatesForm: (i.out.contraindicatesForm || []).slice().sort(),
        }))
        .sort(byId),
    }))
    .filter((g) => g.items.length);
}

function roleView(model, role) {
  const spec = ROLE_SPEC[role];
  const { nodes } = model;
  const individuals = individualList(nodes);

  const moves = individuals
    .filter((i) => (i.out.performedByRole || []).includes(spec.roleClass))
    .map((i) => ({
      id: i.id,
      label: i.label,
      comment: i.comment,
      register: (i.out.hasRegister || []).slice().sort(),
      aimsAtForm: (i.out.aimsAtForm || []).slice().sort(),
      contraindicatesForm: (i.out.contraindicatesForm || []).slice().sort(),
      module: i.module,
    }))
    .sort(byId);

  const result = {
    view: role,
    role,
    blurb: spec.blurb,
    modules: moduleSummary(model),
    roleClass: briefOf(nodes, spec.roleClass),
    character: briefOf(nodes, spec.character),
    interiorAgencies: (nodes.get(spec.character)?.out.hasInteriorAgency || []).slice().sort(),
    roleViews: spec.roleViews.filter((rv) => nodes.has(rv)),
    moves,
    advancesForms: [...new Set(moves.flatMap((m) => m.aimsAtForm))].sort(),
    roleClasses: roleScopedClasses(nodes, spec.prefix),
  };

  if (role === 'tutor') {
    const cmap = childrenMap(nodes);
    const tacticIds = new Set(descendants(cmap, ['PolicyAction']));
    result.policyActions = individuals
      .filter((i) => i.types.includes('PolicyAction'))
      .map((i) => ({ id: i.id, requiresKC: (i.out.requiresKC || []).slice().sort() }))
      .sort(byId);
    result.tactics = [...tacticIds]
      .map((id) => briefOf(nodes, id))
      .filter(Boolean)
      .sort(byId);
    result.guards = classList(nodes)
      .filter(
        (c) =>
          c.out.supportsPolicy ||
          c.out.contraindicatesPolicy ||
          c.out.indicatesMissingKC ||
          c.out.supportsRecognitionMove,
      )
      .map((c) => ({
        state: c.id,
        label: c.label,
        supportsPolicy: (c.out.supportsPolicy || []).slice().sort(),
        contraindicatesPolicy: (c.out.contraindicatesPolicy || []).slice().sort(),
        indicatesMissingKC: (c.out.indicatesMissingKC || []).slice().sort(),
        supportsRecognitionMove: (c.out.supportsRecognitionMove || []).slice().sort(),
      }))
      .sort((a, b) => a.state.localeCompare(b.state));
    result.plotDevices = groupIndividualsByTypes(individuals, [
      'ContinuationPolicy',
      'TutorAdaptationPolicy',
      'ReversalTrigger',
      'WithheldKnowledgeDevice',
    ]);
  } else {
    const cmap = childrenMap(nodes);
    const families = ['ReasoningError', 'RecognitionState', 'KnowledgeComponent', 'TheoryOfMindState', 'LearnerSignal'];
    result.stateFamilies = families
      .filter((f) => nodes.has(f))
      .map((family) => ({
        family,
        label: nodes.get(family)?.label || null,
        comment: nodes.get(family)?.comment || null,
        members: descendants(cmap, [family])
          .sort()
          .map((id) => ({ id, label: nodes.get(id)?.label || null, comment: nodes.get(id)?.comment || null })),
      }))
      .filter((g) => g.members.length);
  }

  return result;
}

// Build one of the three lenses. `modules` is validated by loadModuleSources.
export function buildOntologyView({ view = 'system', modules = DEFAULT_MODULES } = {}) {
  const model = buildOntologyModel(modules);
  if (view === 'tutor' || view === 'learner') return roleView(model, view);
  return systemView(model);
}

export default { buildOntologyModel, buildOntologyView, ALL_MODULES, DEFAULT_MODULES };
