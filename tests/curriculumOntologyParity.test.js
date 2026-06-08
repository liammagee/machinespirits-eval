// Curriculum ↔ ontology parity gate.
//
// Turns the hand-verified claim "the formal TBox is in lockstep with course 1001"
// into a mechanical CI invariant. The relation is NOT a clean isomorphism, and the
// test encodes exactly that asymmetry:
//
//   • rhetoric-core.ttl  ↔  lectures 5–8 : a figure-level bijection. Every owl:Class
//     declared there (canons, oration parts, styles, virtues, tropes, schemes,
//     figures of thought) is taught in a lecture.
//   • poetics-core.ttl   ⊃  lectures 1–4 : a proper SUPERSET. The Greek-poetics
//     slices (forms, the six parts, plot architecture, hamartia/catharsis/wonder,
//     the appeals/genres) are taught; layered on top is an OPERATIONAL drama-machine
//     vocabulary (roles, characters, interior agencies, plot devices, adaptation
//     moves, casting, critic panel) that the course deliberately does not teach.
//
// INVARIANT (the ontology→content direction, which is the mechanizable one):
//   every owl:Class is EITHER taught in some lecture OR part of the operational
//   layer (the transitive subclass-closure of the operational roots below).
//
// So: add a new figure class but forget to write it into a lecture → this fails.
// Add a new Caster/PlotDevice/AdaptationMove subtype → auto-exempt (operational).
// Mis-file a curriculum class under no teaching and no operational root → fails
// until it is taught, aliased, or correctly placed under an operational root.
//
// Scope note: the gate asserts curriculum-wide PRESENCE (the class's term appears in
// the lecture corpus), not per-lecture placement. That is the claim "is in lockstep"
// makes concrete and the claim a forgotten class would violate.

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModuleSources } from '../services/ontology/reasoningOntology.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COURSE_DIR = path.resolve(__dirname, '..', 'content-poetics-rhetoric', 'courses', '1001');

// The operational drama-machine layer of poetics-core.ttl (lines ~144–181): the
// GENERATIVE design vocabulary, exempt from the curriculum. We exempt the transitive
// rdfs:subClassOf closure of these 8 roots, so the exemption maintains itself instead
// of rotting as a frozen name-list. See CLAUDE.md "Dramatic-form-not-mindreading":
// these are staging classes, never taught as poetics content.
const OPERATIONAL_ROOTS = new Set([
  'DramaticRole', // + TutorRole, LearnerRole, DirectorRole, CriticRole
  'Character', //     + TutorCharacter, LearnerCharacter
  'InteriorAgency', //+ Ego, Superego, Id
  'PlotDevice', //    + ContinuationPolicy, TutorAdaptationPolicy, ReversalTrigger, WithheldKnowledgeDevice
  'AdaptationMove', //(moves themselves are ABox individuals, not owl:Class)
  'MoveRegister',
  'Caster', //        + HumanCaster, LLMCaster, MockCaster
  'CriticPanel',
]);

// Aliases: the exact lecture phrasing for classes whose camelCase name does not
// surface verbatim (plural-headed families, English glosses of Greek/Latin terms,
// umbrella classes named differently in prose). Each entry is a curated pointer to
// where the class is taught — adding one is a deliberate, reviewable act. A class
// passes on its lowercased name, its camelCase-split phrase, OR any alias here.
const ALIASES = Object.freeze({
  // ── poetics-core curriculum (lectures 1–4) ──
  DramaticForm: ['dramatic form'],
  SurpriseInevitability: ['surprising yet inevitable', 'surprising, yet', 'inevitabil'],
  HamartiaIntegration: ['hamartia'],
  TragicPart: ['parts of tragedy', 'six parts'],
  WholeAction: ['whole action', 'complete action'],
  PlotPhase: ['phases of the plot', 'plot phase'],
  Affect: ['emotion'],
  Thaumaston: ['wonder', 'thaumaston', 'marvellous'],
  Eunoia: ['eunoia', 'goodwill'],
  Paradeigma: ['paradeigma', 'example'],
  EthosAppeal: ['ethos'],
  PathosAppeal: ['pathos'],
  LogosAppeal: ['logos'],
  RhetoricalGenre: ['genre'],
  // ── rhetoric-core curriculum (lectures 5–8) ──
  RhetoricalCanon: ['canon'],
  OrationPart: ['parts of an oration', 'oration'],
  StyleLevel: ['levels of style', 'three styles', 'genera dicendi'],
  StyleVirtue: ['virtues of style', 'virtutes'],
  Latinitas: ['latinitas', 'correctness'],
  Perspicuitas: ['perspicuitas', 'clarity'],
  Ornatus: ['ornatus', 'ornament'],
  Decorum: ['decorum', 'propriety'],
  Confutatio: ['confutatio', 'refutatio', 'refutation'],
  Pronuntiatio: ['pronuntiatio', 'actio', 'delivery'],
  SchemeOfRepetition: ['schemes of repetition'],
  SchemeOfBalance: ['schemes of balance'],
  SchemeOfOmission: ['schemes of omission', 'omission and excess'],
  SchemeOfSound: ['schemes of sound'],
  FigureOfThought: ['figures of thought'],
});

// The three rdfs:seeAlso seams that stitch the two files together (and back to the
// Greek). Each is asserted to live on the right subject line.
const SEAMS = [
  ['Elocutio', 'Lexis'], //          Roman style IS Aristotle's lexis (lecture 5 hinge)
  ['FigureOfThought', 'Dianoia'], // figures of thought are the heirs of dianoia (lecture 8)
  ['Chiasmus', 'Peripeteia'], //     the mirror-scheme is the syntactic kin of reversal
];

// camelCase / PascalCase → spaced lowercase: "FigureOfThought" → "figure of thought".
function splitCamel(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase();
}

// Parse owl:Class declarations + their rdfs:subClassOf parents. Line-based: every
// class in these files is declared on a single line, and rdfs:subClassOf always
// precedes the rdfs:label, so a literal '.' inside a label never confuses us.
function parseClasses(text) {
  const classes = [];
  const parents = new Map(); // child -> [parent, ...]
  for (const line of text.split('\n')) {
    const m = line.match(/^ms:(\w+)\s+a\s+owl:Class\b/);
    if (!m) continue;
    const name = m[1];
    classes.push(name);
    const supers = [...line.matchAll(/rdfs:subClassOf\s+ms:(\w+)/g)].map((x) => x[1]);
    if (supers.length) parents.set(name, supers);
  }
  return { classes, parents };
}

// Operational iff the class is, or transitively subclasses, an operational root.
function isOperational(name, parents) {
  const seen = new Set();
  const stack = [name];
  while (stack.length) {
    const n = stack.pop();
    if (OPERATIONAL_ROOTS.has(n)) return true;
    if (seen.has(n)) continue;
    seen.add(n);
    for (const p of parents.get(n) || []) stack.push(p);
  }
  return false;
}

// A class is "taught" if its lowercased name, its camelCase-split phrase, or any
// alias appears as a substring of the lowercased lecture corpus.
function taughtVia(name, corpus) {
  const candidates = new Set([name.toLowerCase(), splitCamel(name)]);
  for (const a of ALIASES[name] || []) candidates.add(a.toLowerCase());
  for (const c of candidates) {
    if (c && corpus.includes(c)) return c;
  }
  return null;
}

function seamOnLine(text, subj, obj) {
  return text.split('\n').some((l) => l.includes(`ms:${subj}`) && l.includes(`rdfs:seeAlso ms:${obj}`));
}

let tbox = '';
let classes = [];
let parents = new Map();
let curriculum = [];
let operational = [];
let lectureFiles = [];
let corpus = '';

before(() => {
  const sources = loadModuleSources(['poetics', 'rhetoric']);
  tbox = sources.map((s) => s.tbox.text).join('\n');
  ({ classes, parents } = parseClasses(tbox));
  operational = classes.filter((c) => isOperational(c, parents));
  curriculum = classes.filter((c) => !isOperational(c, parents));

  lectureFiles = fs
    .readdirSync(COURSE_DIR)
    .filter((f) => /^lecture-\d+\.md$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  corpus = lectureFiles
    .map((f) => fs.readFileSync(path.join(COURSE_DIR, f), 'utf8'))
    .join('\n')
    .toLowerCase()
    // Strip markdown emphasis/code markers so they cannot break term adjacency:
    // the lectures write "the **plain** style", and a raw substring match for
    // "plain style" would fail on the embedded "**". Spacing is preserved.
    .replace(/[*_`]/g, '');
});

test('the parse finds a sane TBox and a complete lecture corpus', () => {
  // Guard against a silently-empty parse or a moved course directory turning the
  // whole gate into a vacuous pass.
  assert.ok(classes.length >= 80, `expected ≥80 owl:Class declarations, found ${classes.length}`);
  assert.ok(curriculum.length >= 70, `expected ≥70 curriculum classes, found ${curriculum.length}`);
  assert.ok(operational.length >= 20, `expected ≥20 operational classes, found ${operational.length}`);
  assert.ok(lectureFiles.length >= 8, `expected ≥8 lectures, found ${lectureFiles.length}: ${lectureFiles.join(', ')}`);
  assert.ok(corpus.length > 10_000, `lecture corpus suspiciously small (${corpus.length} chars)`);
});

test('every operational root still exists as a class (allow-list anti-rot)', () => {
  for (const root of OPERATIONAL_ROOTS) {
    assert.ok(classes.includes(root), `operational root ms:${root} no longer exists — update OPERATIONAL_ROOTS`);
  }
});

test('every curriculum class is taught in a lecture (ontology → content)', (t) => {
  const missing = [];
  const witnessed = [];
  for (const c of curriculum) {
    const via = taughtVia(c, corpus);
    if (via) witnessed.push([c, via]);
    else missing.push([c, [...new Set([c.toLowerCase(), splitCamel(c), ...(ALIASES[c] || [])])]]);
  }

  t.diagnostic(`curriculum classes taught: ${witnessed.length}/${curriculum.length}`);
  t.diagnostic(`operational classes exempted: ${operational.length}`);
  t.diagnostic(`lectures scanned: ${lectureFiles.join(', ')}`);

  if (missing.length) {
    const lines = missing
      .map(([c, tried]) => `  • ms:${c} — not found. Tried: ${tried.map((s) => `"${s}"`).join(', ')}`)
      .join('\n');
    assert.fail(
      `${missing.length} curriculum class(es) are declared in the TBox but not taught in any lecture:\n${lines}\n\n` +
        `Fix one of three ways:\n` +
        `  1. teach the term in a lecture (content-poetics-rhetoric/courses/1001/lecture-*.md), or\n` +
        `  2. add the exact lecture phrasing to the ALIASES map in this test, or\n` +
        `  3. if it is an operational drama-machine class, place it under an operational root.`,
    );
  }
});

test('the three seeAlso seams stitch the files together', () => {
  for (const [subj, obj] of SEAMS) {
    assert.ok(
      seamOnLine(tbox, subj, obj),
      `missing seam: ms:${subj} rdfs:seeAlso ms:${obj} (the curriculum↔ontology hinge)`,
    );
  }
});

test('the operational layer is exempt by construction, not by accident', () => {
  // Spot-check that representative operational leaves resolve as operational via the
  // subclass closure (so the exemption is doing real work, not masking a typo).
  for (const leaf of ['TutorRole', 'Superego', 'LLMCaster', 'WithheldKnowledgeDevice']) {
    assert.ok(classes.includes(leaf), `expected operational class ms:${leaf} to exist`);
    assert.ok(isOperational(leaf, parents), `ms:${leaf} should resolve as operational via subclass closure`);
  }
  // And that a curriculum figure does NOT accidentally resolve as operational.
  for (const fig of ['Metaphor', 'Chiasmus', 'Peripeteia']) {
    assert.ok(!isOperational(fig, parents), `ms:${fig} must be curriculum, not operational`);
  }
});
