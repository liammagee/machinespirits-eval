import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Parser } from 'n3';
import { n3reasoner } from 'eyereasoner';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const ONTOLOGY_DIR = path.join(ROOT_DIR, 'config', 'ontology');
export const NS = 'https://machinespirits.dev/ontology/reasoning#';

// The shared TBox is modular but ONE vocabulary in ONE namespace, co-loaded into a
// single EYE pipeline. The runtime previously loaded only `reasoning`, so the drama
// (poetics) vocabulary was never reasoned over alongside reasoning, and there were no
// consistency axioms. See notes/ontology/2026-06-02-unified-ontology-consolidation.md.
const TBOX_MODULES = Object.freeze({
  reasoning: { tbox: 'reasoning-core.ttl', rules: 'reasoning-rules.n3' },
  poetics: { tbox: 'poetics-core.ttl', rules: 'poetics-rules.n3' },
  // Language-game / scorekeeping bridge: strategy -> tactic -> public move ->
  // learner uptake/contest -> accountable dyadic revision. Kept small and
  // monotonic so it remains a construct-boundary layer rather than a hidden
  // quality rubric.
  discursive: { tbox: 'discursive-game-core.ttl', rules: 'discursive-game-rules.n3' },
  // Adaptation / recognition / correction decomposition (v0.1, draft). Lifts the
  // run-poetics-adaptation-loop gate-struct into declarative facts: the 8-stage
  // pipeline, recognition-origin (organic vs peripeteia_induced), correction-origin
  // (scaffolded vs self), and the three "correction" senses. OPT-IN ONLY (not in
  // DEFAULT_MODULES): load via loadSharedTBox([...,'adaptation']). See
  // tests/adaptationOntology.test.js for the verified worked ABox.
  adaptation: { tbox: 'adaptation-core.ttl', rules: 'adaptation-rules.n3' },
  consistency: { tbox: 'consistency-axioms.ttl', rules: 'consistency-rules.n3' },
  // Structural/casting disjointness — spec validation only (decision 2B). NOT in
  // DEFAULT_MODULES: opt in via loadSharedTBox([...,'consistency','casting']). Axioms
  // only; the generic disjointness rule lives in the consistency module.
  casting: { tbox: 'casting-axioms.ttl' },
  // Roman rhetoric (the figures of persuasion) — curriculum companion to the
  // poetics module for course 1001 (content-poetics-rhetoric), lectures 5–8: the
  // five canons, the parts of an oration, the three styles, and the figures
  // (tropes, schemes, figures of thought). TBox only; OPT-IN (not in
  // DEFAULT_MODULES): load via loadSharedTBox([...,'poetics','rhetoric']).
  // Seam: ms:Elocutio rdfs:seeAlso ms:Lexis (style = Aristotle's lexis).
  rhetoric: { tbox: 'rhetoric-core.ttl' },
  // Human-readable derivation concept-world: a semantic schema linking proof DAG
  // terms to drama, rhetoric, pedagogy, recognition, ego/superego, and charisma.
  // TBox/ABox vocabulary only; OPT-IN so default turn-plan validation is unchanged.
  derivation_concepts: { tbox: 'derivation-concepts.ttl' },
});
export const DEFAULT_MODULES = Object.freeze(['reasoning', 'poetics', 'discursive', 'consistency']);

// The full set of registered TBox module names, in declaration order — for tooling
// (e.g. the ontology viewer) that lets a caller toggle modules on/off.
export const ALL_MODULES = Object.freeze(Object.keys(TBOX_MODULES));

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
    if (mod.rules) rules.push(readModuleFile(mod.rules));
  }
  return [...tbox, ...rules].join('\n\n');
}

// Per-module source texts (TBox + rules kept SEPARATE), for tooling that wants to
// parse the structural TBox without the N3 rule bodies, or show the raw source.
// Returns [{ name, tbox: { file, text }, rules: { file, text } | null }]. Same
// validation + default as loadSharedTBox; the order follows the requested modules.
export function loadModuleSources(modules = DEFAULT_MODULES) {
  const names = Array.isArray(modules) && modules.length ? modules : DEFAULT_MODULES;
  return names.map((name) => {
    const mod = TBOX_MODULES[name];
    if (!mod) {
      throw new Error(`Unknown ontology module "${name}". Known: ${Object.keys(TBOX_MODULES).join(', ')}`);
    }
    return {
      name,
      tbox: { file: mod.tbox, text: readModuleFile(mod.tbox) },
      rules: mod.rules ? { file: mod.rules, text: readModuleFile(mod.rules) } : null,
    };
  });
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

// ── Drama-machine turn_plan validation (poetics ontology) ─────────────────────
// Build an ABox for a drama-machine turn_plan: each entry becomes one individual
// `tpN` that `ms:targetsForm` the forms it aims at (the entry's own `target(s)`,
// else the drama's global `targets:`) and `ms:includesMove` each of its moves.
// The poetics rules then derive `ms:hasFormConflict` (a targeted form undercut by
// an included move — e.g. a catharsis-target turn that includes pseudo_catharsis,
// or a peripeteia-target turn that includes hold) and `ms:moveServesTarget`.
export function buildTurnPlanABox(turnPlan = [], dramaTargets = []) {
  const globalTargets = [...new Set((dramaTargets || []).map(safeLocalName).filter(Boolean))];
  const lines = [
    '@prefix ms: <https://machinespirits.dev/ontology/reasoning#> .',
    '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .',
    '',
  ];
  (Array.isArray(turnPlan) ? turnPlan : []).forEach((entry, idx) => {
    const subj = `tp${idx}`;
    const explicit = [].concat(entry?.targets || []).concat(entry?.target ? [entry.target] : []);
    const targets = [...new Set((explicit.length ? explicit : globalTargets).map(safeLocalName).filter(Boolean))];
    const moves = [...new Set((entry?.moves || []).map(safeLocalName).filter(Boolean))];
    for (const f of targets) lines.push(`ms:${subj} ms:targetsForm ms:${f} .`);
    for (const m of moves) lines.push(`ms:${subj} ms:includesMove ms:${m} .`);
  });
  return lines.join('\n');
}

function addToSetMap(map, key, value) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
}

// Validate a turn_plan against the poetics ontology. Reasons the turn-plan ABox
// over the poetics TBox+rules and reports: `conflicts` (a targeted form undercut
// by an included move — the load-bearing error), `serves` (moves doing the work
// their turn was specified for — positive confirmation), and `warnings` (an
// explicitly-targeted form with no move serving it). Pure read; the only I/O is
// the in-process EYE reasoner. `entries` are the original turn_plan objects, used
// to map `tpN` individuals back to {turn, role}.
export async function validateTurnPlan(turnPlan = [], dramaTargets = [], options = {}) {
  const entries = Array.isArray(turnPlan) ? turnPlan : [];
  const allowedRoles = new Set(['tutor', 'learner', 'director']);
  const abox = buildTurnPlanABox(entries, dramaTargets);
  const data = [loadSharedTBox(options.modules || ['poetics']), abox].join('\n\n');
  const closureText = await n3reasoner(data, undefined, {
    output: 'deductive_closure',
    outputType: 'string',
  });
  const quads = parseTriples(closureText);

  const conflictForms = new Map(); // idx -> Set(form)
  const targetedForms = new Map(); // idx -> Set(form)
  const aimsByMove = new Map(); // moveLocal -> Set(form)
  const contraByMove = new Map(); // moveLocal -> Set(form)

  for (const quad of quads) {
    const predicate = quad.predicate.value;
    const subject = compactTerm(quad.subject);
    const object = compactTerm(quad.object);
    if (/^tp\d+$/.test(subject)) {
      const idx = Number(subject.slice(2));
      if (predicate === `${NS}hasFormConflict`) addToSetMap(conflictForms, idx, object);
      else if (predicate === `${NS}targetsForm`) addToSetMap(targetedForms, idx, object);
    } else if (predicate === `${NS}aimsAtForm`) {
      addToSetMap(aimsByMove, subject, object);
    } else if (predicate === `${NS}contraindicatesForm`) {
      addToSetMap(contraByMove, subject, object);
    }
  }

  const meta = (idx) => ({
    index: idx,
    turn: entries[idx]?.at?.turn ?? entries[idx]?.turn ?? null,
    role: entries[idx]?.role ?? null,
  });
  const conflicts = [];
  const errors = [];
  const serves = [];
  const warnings = [];

  entries.forEach((entry, idx) => {
    if (entry?.role != null && !allowedRoles.has(entry.role)) {
      errors.push({
        ...meta(idx),
        code: 'unsupported_role',
        message: `unsupported turn-plan role "${entry.role}"; audience is a non-enacted position`,
      });
    }
    const moveLocals = (entry?.moves || []).map((raw) => ({ raw, local: safeLocalName(raw) })).filter((m) => m.local);
    const explicitForms = new Set(
      []
        .concat(entry?.targets || [])
        .concat(entry?.target ? [entry.target] : [])
        .map(safeLocalName)
        .filter(Boolean),
    );
    for (const form of conflictForms.get(idx) || []) {
      const offending = moveLocals.filter((m) => contraByMove.get(m.local)?.has(form)).map((m) => m.raw);
      conflicts.push({ ...meta(idx), form, moves: offending });
    }
    for (const form of targetedForms.get(idx) || []) {
      const serving = moveLocals.filter((m) => aimsByMove.get(m.local)?.has(form)).map((m) => m.raw);
      if (serving.length) serves.push({ ...meta(idx), form, moves: serving });
      else if (explicitForms.has(form)) warnings.push({ ...meta(idx), form, message: `no move serves ${form}` });
    }
  });

  return {
    ok: conflicts.length === 0 && errors.length === 0,
    turns: entries.length,
    errors,
    conflicts,
    serves,
    warnings,
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
  buildTurnPlanABox,
  validateTurnPlan,
};
