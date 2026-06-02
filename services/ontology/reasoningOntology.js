import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Parser } from 'n3';
import { n3reasoner } from 'eyereasoner';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const ONTOLOGY_DIR = path.join(ROOT_DIR, 'config', 'ontology');
const NS = 'https://machinespirits.dev/ontology/reasoning#';

// The shared TBox is modular but ONE vocabulary in ONE namespace, co-loaded into a
// single EYE pipeline. The runtime previously loaded only `reasoning`, so the drama
// (poetics) vocabulary was never reasoned over alongside reasoning, and there were no
// consistency axioms. See notes/ontology/2026-06-02-unified-ontology-consolidation.md.
const TBOX_MODULES = Object.freeze({
  reasoning: { tbox: 'reasoning-core.ttl', rules: 'reasoning-rules.n3' },
  poetics: { tbox: 'poetics-core.ttl', rules: 'poetics-rules.n3' },
  consistency: { tbox: 'consistency-axioms.ttl', rules: 'consistency-rules.n3' },
});
const DEFAULT_MODULES = Object.freeze(['reasoning', 'poetics', 'consistency']);

const TAG_ALIASES = Object.freeze({
  affirming_consequent: 'AffirmingConsequent',
  denying_antecedent: 'DenyingAntecedent',
  missing_warrant: 'MissingWarrant',
  warrant_missing: 'WarrantMissing',
  overextended_analogy: 'OverextendedAnalogy',
  scope_error: 'ScopeError',
  premise_stated: 'PremiseStated',
  conclusion_asserted: 'ConclusionAsserted',
  counterexample_attempted: 'CounterexampleAttempted',
  reasoning_explained: 'ReasoningExplained',
  conclusion_owned: 'ConclusionOwned',
  claim_ownership_weak: 'ClaimOwnershipWeak',
  authority_to_defer_to: 'AuthorityToDeferTo',
  thinking_partner: 'ThinkingPartner',
  low_answerability: 'LowAnswerability',
  evidence_access_gap: 'EvidenceAccessGap',
  perspective_conflict: 'PerspectiveConflict',
  misrecognition: 'Misrecognition',
});

const PREDICATES = Object.freeze({
  type: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
  supportsPolicy: `${NS}supportsPolicy`,
  contraindicatesPolicy: `${NS}contraindicatesPolicy`,
  indicatesMissingKC: `${NS}indicatesMissingKC`,
  supportsRecognitionMove: `${NS}supportsRecognitionMove`,
  blocksPrematurePolicy: `${NS}blocksPrematurePolicy`,
  violatesDisjointness: `${NS}violatesDisjointness`,
});

function readModuleFile(name) {
  return fs.readFileSync(path.join(ONTOLOGY_DIR, name), 'utf8');
}

// Concatenate the requested TBox modules + their rule files into one document: all
// TBoxes first, then all rule files, so every class/axiom is present before any rule
// fires. Default = the full shared TBox (reasoning ⊕ poetics ⊕ consistency). Pass
// e.g. { modules: ['reasoning'] } to scope it (the old reasoning-only behaviour).
export function loadSharedTBox(modules = DEFAULT_MODULES) {
  const names = Array.isArray(modules) && modules.length ? modules : DEFAULT_MODULES;
  const tbox = [];
  const rules = [];
  for (const name of names) {
    const mod = TBOX_MODULES[name];
    if (!mod) {
      throw new Error(`Unknown ontology module "${name}". Known: ${Object.keys(TBOX_MODULES).join(', ')}`);
    }
    tbox.push(readModuleFile(mod.tbox));
    rules.push(readModuleFile(mod.rules));
  }
  return [...tbox, ...rules].join('\n\n');
}

function escapeLiteral(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

function safeLocalName(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const alias = TAG_ALIASES[raw.toLowerCase().replace(/[^a-z0-9]+/g, '_')];
  if (alias) return alias;
  return raw
    .replace(/^ms:/, '')
    .replace(/[^a-zA-Z0-9_ -]/g, ' ')
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function compactTerm(term) {
  const value = term?.value || String(term || '');
  if (value.startsWith(NS)) return value.slice(NS.length);
  if (value === PREDICATES.type) return 'type';
  return value;
}

function makeObservationId(id, idx) {
  const safe = String(id || `obs_${idx}`)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/^_+/, '');
  return safe || `obs_${idx}`;
}

export function buildObservationABox(observations = []) {
  const lines = [
    '@prefix ms: <https://machinespirits.dev/ontology/reasoning#> .',
    '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .',
    '',
  ];

  observations.forEach((obs, idx) => {
    const id = makeObservationId(obs.id || obs.obs_id, idx);
    const tags = [...(obs.tags || []), ...(obs.kcTags || []), ...(obs.tomTags || [])]
      .map(safeLocalName)
      .filter(Boolean);
    const uniqueTags = [...new Set(tags)];
    if (uniqueTags.length === 0) return;
    lines.push(`ms:${id} ${uniqueTags.map((tag) => `rdf:type ms:${tag}`).join(' ; ')} .`);
    if (obs.quote || obs.text) {
      lines.push(`ms:${id} ms:hasEvidenceText "${escapeLiteral(obs.quote || obs.text)}" .`);
    }
  });

  return lines.join('\n');
}

function parseTriples(n3Text) {
  const parser = new Parser({ format: 'text/n3' });
  return parser.parse(n3Text);
}

function emptyFactsForObservations(observations) {
  const facts = {};
  observations.forEach((obs, idx) => {
    const id = makeObservationId(obs.id || obs.obs_id, idx);
    facts[id] = {
      id,
      types: new Set(),
      supportsPolicy: new Set(),
      contraindicatesPolicy: new Set(),
      missingKC: new Set(),
      recognitionMoves: new Set(),
      blocksPrematurePolicy: new Set(),
    };
  });
  return facts;
}

function factsFromTriples(quads, observations) {
  const facts = emptyFactsForObservations(observations);
  for (const quad of quads) {
    const subject = compactTerm(quad.subject);
    if (!facts[subject]) continue;
    const predicate = quad.predicate.value;
    const object = compactTerm(quad.object);
    if (predicate === PREDICATES.type) facts[subject].types.add(object);
    if (predicate === PREDICATES.supportsPolicy) facts[subject].supportsPolicy.add(object);
    if (predicate === PREDICATES.contraindicatesPolicy) facts[subject].contraindicatesPolicy.add(object);
    if (predicate === PREDICATES.indicatesMissingKC) facts[subject].missingKC.add(object);
    if (predicate === PREDICATES.supportsRecognitionMove) facts[subject].recognitionMoves.add(object);
    if (predicate === PREDICATES.blocksPrematurePolicy) facts[subject].blocksPrematurePolicy.add(object);
  }
  return Object.fromEntries(
    Object.entries(facts).map(([id, f]) => [
      id,
      {
        ...f,
        types: [...f.types].sort(),
        supportsPolicy: [...f.supportsPolicy].sort(),
        contraindicatesPolicy: [...f.contraindicatesPolicy].sort(),
        missingKC: [...f.missingKC].sort(),
        recognitionMoves: [...f.recognitionMoves].sort(),
        blocksPrematurePolicy: [...f.blocksPrematurePolicy].sort(),
      },
    ]),
  );
}

function tally(facts, key) {
  const counts = new Map();
  for (const fact of Object.values(facts)) {
    for (const value of fact[key] || []) counts.set(value, (counts.get(value) || 0) + 1);
  }
  return counts;
}

function sortedKeysByCount(counts) {
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([key]) => key);
}

export async function reasonOverObservations(observations = [], options = {}) {
  const abox = buildObservationABox(observations);
  const data = [loadSharedTBox(options.modules), abox].join('\n\n');
  const closureText = await n3reasoner(data, undefined, {
    output: 'deductive_closure',
    outputType: 'string',
  });
  const quads = parseTriples(closureText);
  const facts = factsFromTriples(quads, observations);
  return {
    facts,
    abox,
    closureText: options.includeClosure ? closureText : undefined,
  };
}

// Reason over an arbitrary ABox (TTL/N3 text) and report disjointness violations
// against the shared TBox's consistency axioms. EYE-pipeline precursor to ELK DL
// consistency-checking (roadmap step 5). Returns { consistent, violations }, where
// `violations` maps each inconsistent individual to the disjoint classes it holds.
// Check ONE turn-snapshot at a time — see config/ontology/consistency-axioms.ttl.
export async function checkAboxConsistency(aboxText = '', options = {}) {
  const data = [loadSharedTBox(options.modules), aboxText].join('\n\n');
  const closureText = await n3reasoner(data, undefined, {
    output: 'deductive_closure',
    outputType: 'string',
  });
  const quads = parseTriples(closureText);
  const violations = {};
  for (const quad of quads) {
    if (quad.predicate.value !== PREDICATES.violatesDisjointness) continue;
    const subject = compactTerm(quad.subject);
    const object = compactTerm(quad.object);
    if (!violations[subject]) violations[subject] = new Set();
    violations[subject].add(object);
  }
  const summary = Object.fromEntries(Object.entries(violations).map(([id, set]) => [id, [...set].sort()]));
  return {
    consistent: Object.keys(summary).length === 0,
    violations: summary,
    closureText: options.includeClosure ? closureText : undefined,
  };
}

export async function buildOntologyGuidance({ observations = [], role = 'tutor_ego' } = {}) {
  const result = await reasonOverObservations(observations);
  const supported = tally(result.facts, 'supportsPolicy');
  const contraindicated = tally(result.facts, 'contraindicatesPolicy');
  const blocked = tally(result.facts, 'blocksPrematurePolicy');
  const missingKC = tally(result.facts, 'missingKC');
  const recognition = tally(result.facts, 'recognitionMoves');

  const supportedPolicies = sortedKeysByCount(supported);
  const contraindicatedPolicies = sortedKeysByCount(contraindicated);
  const blockedPolicies = sortedKeysByCount(blocked);
  const forbidden = new Set([...contraindicatedPolicies, ...blockedPolicies]);
  const recommendedPolicies = supportedPolicies.filter((p) => !forbidden.has(p));

  return {
    role,
    recommendedPolicies,
    supportedPolicies,
    contraindicatedPolicies,
    blockedPolicies,
    missingKnowledgeComponents: sortedKeysByCount(missingKC),
    recognitionMoves: sortedKeysByCount(recognition),
    roleInstruction: roleGuidance(role, {
      recommendedPolicies,
      contraindicatedPolicies,
      blockedPolicies,
      missingKnowledgeComponents: sortedKeysByCount(missingKC),
      recognitionMoves: sortedKeysByCount(recognition),
    }),
    facts: result.facts,
  };
}

function roleGuidance(role, guidance) {
  const rec = guidance.recommendedPolicies.join(', ') || 'none inferred';
  const avoid =
    [...new Set([...guidance.contraindicatedPolicies, ...guidance.blockedPolicies])].join(', ') || 'none inferred';
  const kc = guidance.missingKnowledgeComponents.join(', ') || 'none inferred';
  const recog = guidance.recognitionMoves.join(', ') || 'none inferred';

  if (role === 'tutor_superego') {
    return `Validate that the tutor used only evidence-supported policies. Recommended policies: ${rec}. Avoid or block: ${avoid}. Missing KCs: ${kc}. Recognition repair/contestability moves: ${recog}.`;
  }
  if (role === 'learner_ego') {
    return `Keep learner development plausible around missing KCs: ${kc}. If the tutor supports learning, the learner may revise reasoning, but should not jump to full mastery without articulating the missing warrant.`;
  }
  if (role === 'learner_superego') {
    return `Critique whether the learner response honestly confronts missing KCs (${kc}) and preserves contestability (${recog}) rather than producing a too-tidy breakthrough.`;
  }
  return `Select an evidence-supported tutor policy. Recommended policies: ${rec}. Avoid or block: ${avoid}. Missing KCs to surface: ${kc}. Recognition/ToM moves to preserve: ${recog}.`;
}

export default {
  buildObservationABox,
  reasonOverObservations,
  buildOntologyGuidance,
  checkAboxConsistency,
  loadSharedTBox,
};
