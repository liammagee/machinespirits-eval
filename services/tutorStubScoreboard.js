/**
 * Scoreboard reader for tutor-stub dialogues.
 *
 * One board row per speaker turn. The row carries the twelve fields of the
 * fixed schema (notes/2026-09-04-scoreboard-replay-prompt.md). A reader marks
 * only the current turn's events, each with a quoted span from the public text.
 * The harness derives state under the silence rule: a demand, a debt or a
 * dispute stays open until a test discharges it or the speaker withdraws it in
 * words. Unread fields say `unread`. No model call is made here.
 *
 * Instruments joined (read from the trace, never recomputed):
 *   commitment_undertaken  tutorLearnerDagUpdate.accepted (adopt, derive,
 *                          hypothesis, assertAnswer) on the learner side;
 *                          tutorLeakAudit on the tutor side
 *   entitlement_status     chainer closure over the learner's public facts
 *   release                releasePacing.releasedNow, dramaticRelease.frame
 *   debt                   proofDebt.open / proofDebt.discharged
 *   forced_entry           chainer closure minus held minus voiced
 *   licence_in_force       warrantGateDecision, releasePacing.dueNow,
 *                          inquiryCompletion, tutor_manner_switch, and the
 *                          grant registry kept here
 * The public-text event reader below produces challenge, condition_named,
 * test, standing_dispute, requests and grants. Every mark has a span and a
 * rule id, so a disagreement can be read back to the sentence that caused it.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

import { closure, factKey } from './dramaticDerivation/chainer.js';
import { loadWorld } from './dramaticDerivation/world.js';
import { observeResistantLearnerTurn } from './resistantLearnerObservation.js';

export const SCOREBOARD_SCHEMA = 'machinespirits.tutor-stub.scoreboard.v1';

export const SCOREBOARD_FIELDS = Object.freeze([
  'commitment_undertaken',
  'entitlement_status',
  'challenge',
  'condition_named',
  'test',
  'release',
  'debt',
  'forced_entry',
  'standing_dispute',
  'licence_in_force',
]);

const UNREAD = 'unread';
const NONE = 'none';
const OTHER = 'other';
const SECRET_NODE = 'secret';
const MIRROR_NODE = 'mirror';
const SPAN_MAX = 240;

// ---------------------------------------------------------------------------
// Trace reading
// ---------------------------------------------------------------------------

export function readTutorStubTraceEvents(filePath) {
  let buf = fs.readFileSync(filePath);
  if (filePath.endsWith('.gz')) buf = zlib.gunzipSync(buf);
  const events = [];
  for (const line of buf.toString('utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // A torn last line from a killed run is not an event.
    }
  }
  return events;
}

export function traceDialogueIdentity(events = []) {
  const start = events.find((e) => e?.type === 'run_start') || {};
  const meta = start.metadata || {};
  return {
    worldId: meta.world?.id || null,
    worldTitle: meta.world?.title || null,
    profile: meta.experiment?.profile || meta.autoLearner?.profileId || null,
    policy: meta.experiment?.policy || null,
    runSeed: meta.experiment?.runSeed ?? null,
    repeat: meta.experiment?.repeat ?? null,
    jobId: meta.experiment?.jobId || null,
    runId: start.runId || null,
    provenance: meta.provenance?.git || null,
  };
}

// ---------------------------------------------------------------------------
// World resolution
// ---------------------------------------------------------------------------

const DEFAULT_WORLD_DIRS = Object.freeze([
  'docs/adaptation-refinement/outcome-study-a1/worlds',
  'config/drama-derivation',
]);

const worldIndexCache = new Map();

function indexWorldDir(dir) {
  if (worldIndexCache.has(dir)) return worldIndexCache.get(dir);
  const index = new Map();
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir)) {
      if (!/\.ya?ml$/u.test(name)) continue;
      const full = path.join(dir, name);
      const head = fs.readFileSync(full, 'utf8').slice(0, 4000);
      const m = head.match(/^id:\s*["']?([A-Za-z0-9_-]+)["']?\s*$/mu);
      if (m) index.set(m[1], full);
    }
  }
  worldIndexCache.set(dir, index);
  return index;
}

export function resolveScoreboardWorldPath(worldId, { rootDir = process.cwd(), searchDirs = DEFAULT_WORLD_DIRS } = {}) {
  if (!worldId) return null;
  for (const rel of searchDirs) {
    const dir = path.isAbsolute(rel) ? rel : path.join(rootDir, rel);
    const hit = indexWorldDir(dir).get(worldId);
    if (hit) return hit;
  }
  return null;
}

const worldCache = new Map();

export function loadScoreboardWorld(worldId, options = {}) {
  const file = resolveScoreboardWorldPath(worldId, options);
  if (!file) return null;
  if (!worldCache.has(file)) worldCache.set(file, loadWorld(file));
  return worldCache.get(file);
}

// ---------------------------------------------------------------------------
// Node term index
// ---------------------------------------------------------------------------

const STOP = new Set(
  (
    'the a an and or but so that this these those there here with without from into onto over under ' +
    'about after before while when where which what whose whom who how why then than because until unless ' +
    'only also just still even ever never always often once twice again very much more most less least ' +
    'have has had having does did doing done been being were was are is am be will would shall should ' +
    'could can may might must need needs needed want wants wanted like likes liked make makes made ' +
    'take takes taken took give gives given gave show shows shown showed keep keeps kept leave left ' +
    'your yours you they them their theirs ours mine ourselves themselves itself himself herself ' +
    'some any each every either neither both all none other another such same own well back away ' +
    'right left first second third last next their during within between among through across along ' +
    'evening night morning noon afternoon room hall public record records evidence question inquiry ' +
    'thing things something anything nothing everything someone anyone nobody everyone said says say ' +
    'told tell tells asked asks ask'
  ).split(/\s+/u),
);

function splitCamel(atom) {
  return String(atom)
    .replace(/([a-z])([A-Z])/gu, '$1 $2')
    .replace(/[_-]+/gu, ' ')
    .toLowerCase();
}

export function contentTerms(text) {
  if (!text) return [];
  const cleaned = String(text)
    .replace(/[’']s\b/gu, '')
    .replace(/[’']/gu, '')
    .toLowerCase();
  const out = [];
  for (const raw of cleaned.split(/[^a-z]+/u)) {
    if (raw.length < 4 || STOP.has(raw)) continue;
    out.push(raw);
  }
  return out;
}

function factTerms(fact) {
  if (!Array.isArray(fact)) return [];
  const words = [];
  for (const atom of fact) words.push(...contentTerms(splitCamel(atom)));
  return words;
}

export function buildWorldNodeIndex(world) {
  if (!world) return null;
  const nodes = [];
  for (const p of world.premises || []) {
    nodes.push({ id: p.id, kind: 'premise', terms: new Set([...contentTerms(p.surface), ...factTerms(p.fact)]) });
  }
  for (const r of world.rules || []) {
    const heads = (r.then || []).flatMap((pat) => factTerms(pat.filter((a) => !String(a).startsWith('?'))));
    nodes.push({ id: r.id, kind: 'rule', terms: new Set([...contentTerms(r.gloss), ...heads]) });
  }
  if (world.secret?.fact) {
    nodes.push({
      id: SECRET_NODE,
      kind: 'secret',
      terms: new Set([
        ...contentTerms(world.secret.surface),
        ...contentTerms(world.question),
        ...factTerms(world.secret.fact),
      ]),
    });
  }
  if (world.mirror?.fact) {
    nodes.push({ id: MIRROR_NODE, kind: 'mirror', terms: new Set(factTerms(world.mirror.fact)) });
  }
  const termCount = new Map();
  for (const n of nodes) for (const t of n.terms) termCount.set(t, (termCount.get(t) || 0) + 1);
  for (const n of nodes) {
    n.distinct = new Set([...n.terms].filter((t) => termCount.get(t) < 3));
  }
  return { nodes, byId: new Map(nodes.map((n) => [n.id, n])) };
}

export function keyNode(text, nodeIndex) {
  if (!nodeIndex) return OTHER;
  const terms = contentTerms(text);
  if (!terms.length) return OTHER;
  let best = null;
  let bestHits = 0;
  for (const n of nodeIndex.nodes) {
    let hits = 0;
    for (const t of terms) if (n.distinct.has(t)) hits += 1;
    if (hits > bestHits) {
      bestHits = hits;
      best = n.id;
    }
  }
  return bestHits >= 1 ? best : OTHER;
}

function answerNode(text, world) {
  if (!world || !text) return OTHER;
  const low = String(text).toLowerCase();
  const questionVar = (world.questionPattern || []).findIndex((a) => String(a).startsWith('?'));
  const secretAtom = questionVar >= 0 ? world.secret?.fact?.[questionVar] : null;
  const mirrorAtom = questionVar >= 0 ? world.mirror?.fact?.[questionVar] : null;
  const has = (atom) =>
    atom &&
    new RegExp(
      `\\b${String(atom)
        .toLowerCase()
        .replace(/[^a-z0-9 ]/gu, '')}\\b`,
      'u',
    ).test(low);
  const secretHit = has(secretAtom);
  const mirrorHit = has(mirrorAtom);
  if (secretHit && !mirrorHit) return SECRET_NODE;
  if (mirrorHit && !secretHit) return MIRROR_NODE;
  if (secretHit && mirrorHit) {
    // Both names present: the asserted name is the one not negated.
    const negated = /\b(not|never|didn|wasn|isn|neither|rather than|instead of)\b[^.;]*\b/u;
    const secretNeg = new RegExp(`${negated.source}${String(secretAtom).toLowerCase()}`, 'u').test(low);
    return secretNeg ? MIRROR_NODE : SECRET_NODE;
  }
  return OTHER;
}

const NAMING_HEDGE = /\b(not|never|neither|cannot|can't|does not|doesn't|unproved|unshown|open|yet)\b/u;

/**
 * Does the tutor's text name the answer? A question mark or a hedge word
 * anywhere in a sentence governs the whole sentence, including a clause that
 * a dash joins to it. So the question and the hedge are read on the whole
 * sentence first, and only then is the naming clause looked for inside it.
 * Before this, the clause before a dash was read on its own, so "What would put
 * Osprey at bay three, then a dash, then is there a record ... not just ...?"
 * read as a commitment to the secret. Two board dialogues of the 2026-09-05
 * crossed run were cut at turn 6 on that misread.
 */
function tutorNamesAnswer(text, world, nodeIndex) {
  if (!world || !text) return null;
  for (const sentence of sentences(text, { coarse: true })) {
    if (/\?$/u.test(sentence)) continue;
    if (NAMING_HEDGE.test(norm(sentence))) continue;
    for (const clause of sentences(sentence)) {
      const node = answerNode(clause, world);
      if (node === OTHER) continue;
      if (keyNode(clause, nodeIndex) !== SECRET_NODE) continue;
      return { node, span: clip(clause) };
    }
  }
  return null;
}

function factNodeLabel(fact, world) {
  if (!Array.isArray(fact)) return OTHER;
  if (world?.secret?.fact && factKey(fact) === factKey(world.secret.fact)) return SECRET_NODE;
  if (world?.mirror?.fact && factKey(fact) === factKey(world.mirror.fact)) return MIRROR_NODE;
  return `fact:${fact[0]}(${fact.slice(1).join(',')})`;
}

// ---------------------------------------------------------------------------
// Public-text event reader
// ---------------------------------------------------------------------------

function sentences(text, { coarse = false } = {}) {
  if (!text) return [];
  const flat = String(text)
    .replace(/\s+/gu, ' ')
    .replace(/\s*[—–]\s*|\s+-\s+/gu, '; ');
  const splitter = coarse
    ? /(?<=[.?!][”"’']?)\s+(?=[^a-z])|(?<=[.?!])\s+“/u
    : /(?<=[.?!;][”"’']?)\s+(?=[^a-z])|(?<=[.?!;])\s+“|(?<=;)\s+/u;
  return flat
    .split(splitter)
    .map((s) => s.trim())
    .filter(Boolean);
}

function clip(s) {
  const t = String(s || '').trim();
  return t.length > SPAN_MAX ? `${t.slice(0, SPAN_MAX - 1)}…` : t;
}

function norm(text) {
  return String(text || '')
    .replace(/[’‘]/gu, "'")
    .replace(/[“”]/gu, '"')
    .replace(/[—–]/gu, '-')
    .toLowerCase();
}

const R = (parts) => parts.map(([id, re]) => ({ id, re }));

export const LEARNER_RULES = Object.freeze({
  request: R([
    [
      'L-REQ-1',
      /\b(is it (okay|ok|all right|alright|fine) if i|may i|am i allowed|do you want me to|should i|shall i|can i|could i)\b/u,
    ],
    ['L-REQ-2', /\b(could you|would you|can you|will you) (choose|pick|tell|say|select|decide|name|point)\b/u],
    [
      'L-REQ-3',
      /\b(would you (like|prefer|want)( me)?|what should i|which should i|where should i|what do you want me to)\b/u,
    ],
    ['L-REQ-4', /\b(if that is what you want|whatever you (think|prefer|choose)|you (choose|decide|pick))\b/u],
    ['L-REQ-5', /\b(what|which) (evidence|clue|record) (may|can|should) we (examine|look at|check|inspect)\b/u],
  ]),
  challenge: R([
    ['L-CHAL-1', /\b(show me|prove it|prove that|where is (the|your) (evidence|proof|record|warrant))\b/u],
    [
      'L-CHAL-2',
      /\b(what (evidence|warrant|record|proof) (do|have|did) you|on what (basis|evidence|authority|warrant|grounds)|how do you know|what makes you (think|say|so sure)|who says)\b/u,
    ],
    [
      'L-CHAL-3',
      /\b(you (can't|cannot|can not|do not get to|don't get to|have no (right|standing|warrant)|haven't shown|have not shown|have shown nothing))\b/u,
    ],
    [
      'L-CHAL-4',
      /\b(that('s| is) not (proof|evidence|a warrant)|(?=.*\byou(r)?\b)(remains? (unshown|unproved|unproven|unentered|unsupported)|(does|did) not (prove|establish|show|warrant)))\b/u,
    ],
    ['L-CHAL-5', /\b(unless you can show|until you (show|prove|produce)|why should i (accept|believe|grant))\b/u],
  ]),
  condition: R([
    ['L-COND-1', /\b(until|unless|only if|only when|only once|provided that|on condition that)\b/u],
    [
      'L-COND-2',
      /\b(before (your|the|that) (question|claim|premise|frame) can (stand|hold|count)|would need (to see|first)|would have to (see|show|be))\b/u,
    ],
    [
      'L-COND-3',
      /\b((we|you|it|one) must first|first (we|you|it) must|what would (give|settle|show|establish|warrant)|that would (settle|warrant|establish) (it|the)|if .{3,60} then)\b/u,
    ],
    [
      'L-COND-4',
      /\b((must|has to|have to|needs? to) [^.?;]{3,80}?\bbefore (we|you|i|any|the|it|that|naming|a)\b|needs? (public |assay |direct |more |first )*(evidence|proof|a warrant|a record|a public mark)\b)/u,
    ],
    [
      'L-COND-5',
      /\b(first,? (establish|show|prove|settle|trace|confirm|test|match|examine|assay)\b(?! (what|which|whose|who|how|where|when)\b)|(we|you) (need|must|would need|need first|first need) (to )?(an observation|a reading|a record|a mark|an entry|a test|a comparison|an assay|establish|show|see|first|examine|trace|match)\b|before (your|the|that|this) (question|answer|claim|frame)( or (answer|question))? (has|gains|can have|may have|can gain) standing,? (show|establish|we|you|let us|prove|test|first)\b|show (that|first that|me that) [^.?;]{3,90}?\b(so|then|thereby|before|and then) (we|you|i|it) (may|can|might|could|will)\b|without (that|it|such|this)( [a-z]+)?,? (your|the|that) (question|answer|claim|frame|cause question)\b)/u,
    ],
  ]),
  testOffer: R([
    [
      'L-TOFF-1',
      /\b(let's|let us|lets) (first |now |next |then )?(examine|check|test|inspect|look at|compare|match|read|open|weigh|trace|start with)\b/u,
    ],
    [
      'L-TOFF-2',
      /^(?:[a-z']+ ){0,2}(we|i) (should|could|must|need to|ought to|can|want to|would like to) (first |now |next |then )?(test|check|examine|inspect|compare|look at|match|read|weigh|trace|open|verify)\b/u,
    ],
    [
      'L-TOFF-3',
      /\b(is it (okay|ok|all right|alright|fine) if i|may i|should i|shall i|can i|could i|would you like me to|do you want me to) (first |now |next )?(test|check|examine|inspect|compare|look at|match|read|weigh|trace|open)\b/u,
    ],
    [
      'L-TOFF-4',
      /\b(what does (the |this |that )?[a-z' -]{3,40} (show|say|reveal|tell)|what would (the |this |that )?[a-z' -]{3,40} (show|settle))\b/u,
    ],
  ]),
  testAccept: R([
    ['L-TACC-1', /^(fine|all right|alright|okay|ok|agreed|sure|yes|very well|good)\b/u],
    [
      'L-TACC-2',
      /\b(i('ll| will) (examine|check|test|inspect|compare|look at|match|read|weigh|trace|open|enter|record|do that|take that)|we can (test|check|examine|inspect|compare|proceed))\b/u,
    ],
    [
      'L-TACC-3',
      /\b(i accept (the|that|this|your) (test|check|proposal|frame|question)|that (test|check) (is|seems) fair)\b/u,
    ],
  ]),
  testDecline: R([
    [
      'L-TDEC-1',
      /\b(i (withhold|refuse|decline|won't|will not|shall not|am not going to)|not (until|unless|before) )\b/u,
    ],
    [
      'L-TDEC-2',
      /\b(that (test|check|assay|result) (can|would|could) (bear|support|show|settle) only|gives? no standing|(has|have) no standing|cannot (stand|give|bear|settle))\b/u,
    ],
    [
      'L-TDEC-3',
      /\b(before your question can stand|your question (has|carries) no standing|does not give your question standing|no standing to (ask|name))\b/u,
    ],
    [
      'L-TDEC-4',
      /\b(i('m| am) not (taking up|going to take up|doing)|not taking up (either|that|this)|i stopped (before|at)|i leave (it|that|the case) (there|open)|i('ll| will) pass)\b/u,
    ],
  ]),
  testBegun: R([
    [
      'L-TBEG-1',
      /\b(i (inspect|check|examine|compare|test|open|read|match|weigh|place|trace|enter|record|hold|set) (the|this|that|it|each|both|my)|i (have|'ve) (inspected|checked|examined|compared|tested|opened|read|matched|weighed|traced|entered|recorded))\b/u,
    ],
    [
      'L-TBEG-2',
      /(?<!\b(?:if|should|were|whether|once|when|suppose|supposing|unless|until) )\b((the|this|that) (test|check|assay|inspection|comparison|reading) (shows|says|found|finds|gives|returned|comes back))\b/u,
    ],
    ['L-TBEG-3', /\b(i (will|'ll) enter that|i enter (that|it)|i (will|'ll) record that)\b/u],
  ]),
  dispute: R([
    [
      'L-DISP-1',
      /\b(i (do not|don't|do not yet|dispute|reject|refuse to) (accept|grant|dispute|reject)? ?(the|your|that|this) ([a-z']+'s )?(premise|frame|framing|question|terms|jurisdiction|right to)|i dispute (that|this|the|your))\b/u,
    ],
    [
      'L-DISP-2',
      /\b(you (do not|don't) get to|you (cannot|can't|can not) (set|fix|declare|decide|choose|dictate|make) (the|which|what|that|a|an)|not your (call|place|question|right)|who gave you the right|on whose authority|the terms are (mine|not yours))\b/u,
    ],
    [
      'L-DISP-3',
      /\b(before (your|the|that|this) (question|answer|claim|frame|premise|verdict)( or (answer|question|verdict))? (can stand|has standing|gains standing|can have standing|may (stand|have standing)|acquires standing)|(your|the|that|this) ((wider|broader|larger|whole|striking|cause|causal|answer|pressure-first|ready) )*(question|answer|claim|frame|framing|premise|verdict|case)( (about|of|on|for) [a-z' ]{1,30})? (still )?(has|carries|lacks|has yet) (no |still no )?standing|(cannot|can't|does not|doesn't) (yet )?(give|grant|lend) (your|that|the|this) ((wider|broader|answer|striking) )?(question|frame|framing|premise|claim) standing|no standing (yet )?to (ask|name|declare|set|fix|frame|carry|demand)|why should i accept your (frame|question|premise))\b/u,
    ],
    [
      'L-DISP-4',
      /\b(i (do not|don't|still|yet|shall|will) (grant|give|allow|concede) (you |your [a-z' -]{0,30}?)?(no |any )?standing|i (grant|give|allow|concede) (no|not) standing|i (reserve|withhold) (judgment|judgement|my judgment|the (wider|broader|whole) [a-z -]{0,25}?(question|frame|framing|verdict|cause)|(your|that|the) (wider|broader) [a-z -]{0,25}?(question|frame|framing|verdict))|(you|your [a-z' -]{0,30}?) (cannot|can not|can't) (make|give|let) (your|the|that|this) (question|verdict|claim|frame|premise) stand|(cannot|can not|can't|does not|doesn't) set the (premise|question|frame|terms))\b/u,
    ],
  ]),
  withdraw: R([
    [
      'L-WDR-1',
      /\b(i (withdraw|retract|take (that|it) back|drop (that|the claim)|concede|stand corrected)|you('re| are) right|fair (enough|point)|i was wrong|i accept (the|your) (frame|question|premise|terms)|your question stands)\b/u,
    ],
  ]),
});

export const TUTOR_RULES = Object.freeze({
  challenge: R([
    [
      'T-CHAL-1',
      /\b(i challenge|i (dispute|contest|question) (that|the|your)|what (would|could) (show|settle|establish|warrant|prove|separate|distinguish)|what (evidence|warrant|record|result|public result|mark) (would|could|does|do you|have you)|which (evidence|record|test|mark|check) (would|could|does))\b/u,
    ],
    [
      'T-CHAL-2',
      /\b(show me|on what (evidence|basis|warrant|grounds)|how do you know|what makes you (think|say|so sure)|can you (show|point|name|say) (me|to|which|what|where)|where is (the|your) (evidence|record|warrant|proof))\b/u,
    ],
    [
      'T-CHAL-3',
      /\b(before (treating|naming|blaming|calling|we name|you name)|(motive|presence|access|suspicion|dislike) alone (does not|doesn't|cannot|can't|is not)|from motive alone|is not (yet )?(proof|evidence) of)\b/u,
    ],
  ]),
  answer: R([
    [
      'T-ANS-1',
      /\b((does|do|did) not (yet )?(establish|prove|show|identify|name|give|settle|reach|warrant)|shows? only|places? only|supports? only|bears? only on|only places|only shows|only supports|neither (names|shows|establishes|proves))\b/u,
    ],
    [
      'T-ANS-2',
      /\b(you('re| are) right (that|to)|you (rightly|correctly) (withhold|separate|distinguish|keep|note|mark)|fair point|without granting|i withdraw|i (grant|concede) (that|the)|that('s| is) a fair (distinction|point))\b/u,
    ],
    [
      'T-ANS-3',
      /\b(remains? (unproved|unproven|unsupported|unentered|an unsupported|unnamed|open|separate)|not yet (proof|the|a|evidence|who|whose|verrell|the hand)|would support only|that would show only)\b/u,
    ],
    [
      'T-ANS-4',
      /\b((can|may|could|does|do|will|would) (identify|establish|show|test|support|place|examine|prove|explain|settle|bear on|reach)\b[^.?;]*\b(but|and|yet) (cannot|can't|can not|not|never|does not|do not)\b|, not (establish|prove|name|identify|show|settle|a verdict|whose|who)\b|(accusation|blame|naming|the verdict|a verdict) is not\b)/u,
    ],
  ]),
  condition: R([
    ['T-COND-1', /\b(until|unless|only if|only when|only once|provided that|on condition that)\b/u],
    [
      'T-COND-2',
      /\b((what|which)( [a-z' -]{1,30})? (would|could|will|can) give (that|the|your|my|this|our|it|the tutor's) ((standing )?(question|dispute|link|claim|leak) )?(standing|weight|support)|what (gives|would give) (it|this|that|the|your|my)( question| dispute)? (standing|weight)|what (check|test|observation|assay|evidence|reading|record) (gives|would give) (it |this |that |the question |your question )?(standing|weight)|what gives standing|would (need|have) to (see|show|match|hold)|(we|you|it) (must|would) first|first (we|you) (must|need)|if .{3,60} then)\b/u,
    ],
    [
      'T-COND-4',
      /\b((the|that|your|this|our|my|its) ((first|standing|named|needed|release|same|required|missing|public|one|awkward) )*(condition|threshold|requirement|test|check|proof|warrant|limit|gap)( (remains|is|stays|comes first|holds|must|needed|untested|open|unproved|unshown|before us)|:)|(condition|threshold|requirement|proof|test|check|observation|match) (needed|required|remains|is needed|is required|comes first) (before|first|:|to|for|,)|(must|has to|have to|needs? to) (have |first |also |still )?(open|opened|release|released|match|matched|answer|answered|show|shown|come first|cover|hold|be (shown|matched|proved|established|recorded|public))|(is|are) (needed|required),? (and|before|to|first)|(needed|required|missing) (first|before|to (name|treat|assign|blame|call))|(the|a|that|this) (needed|required|missing|first|same|present) (check|checks|observation|proof|match|step|test|move|warrant|evidence)|comes first|(is|are) (required|needed) before|no [a-z' -]{2,25}, no (claim|verdict|name|hand|cause))\b/u,
    ],
    [
      'T-COND-3',
      /\b((must|has to|have to|needs? to) [^.?;]{3,80}?\bbefore (we|you|i|any|the|it|that|naming|a)\b|needs? (public |assay |direct |more |first )*(evidence|proof|a warrant|a record|a public mark)\b)/u,
    ],
  ]),
  testOffer: R([
    [
      'T-TOFF-1',
      /\b(shall we|let's|let us|would you (like to|care to|check|compare|inspect|examine|look|test|read)|could you (check|compare|inspect|examine|look|test|read|match)|can you (check|compare|inspect|examine|look|test|read|match)|will you (check|compare|inspect|examine|look|test|read|match)|do you want to (check|compare|inspect|examine|look|test|read)|choose (something|a|an|one|any|what|which|aught|the) [a-z' ,]{0,40}?(to |thou wouldst |thou wilt |you would |you will |we shall |we should |we may |we might |ye would |you wish to |you want to )?(have )?(examine|examined|check|inspect|test|read|compare|look at)|name (what|which|aught|the [a-z ]{1,20}) (thou wouldst|you would|you wish to|you want to) (have )?(examined|examine|inspected|checked|tested|read))\b/u,
    ],
    [
      'T-TOFF-5',
      /\b((offer|propose|put forward) (the |this |that |my |an? )?[a-z' -]{0,30}?(frame|test|check|comparison|assay|question) (conditionally|provisionally|under (the |that |one )?condition|on (the |that |one )?condition|if|only if|only when|once)|(name|enter|record|accept|grant|count|admit) [^.?;]{0,60}?\bonly (when|if|once|after) (the |your |a )?(marks|evidence|record|test|assay|comparison|coins|mark|result|public)|(the |my |this )?(frame|question|limit|bound|scope) (holds|stands|is the (proper )?limit|remains) (until|unless|only))\b/u,
    ],
    [
      'T-TOFF-2',
      /\b(your (next|first) (check|step|test|move)|which (check|test|step|mark|quality|record) (comes |should we |do we |should you |would you )?(next|first|examine|check|test)|is the next (check|test|step)|the next (check|test|step) is (yours|for you))\b/u,
    ],
    [
      'T-TOFF-4',
      /^(?=.*\?$)(?:[^?:]{0,80}:\s*)?(?:does|do|is|are|was|were|did|would|which|can|will|shall|could|should|whether|has|have|might)\b[^?]*\b(or|rather than|or only)\b[^?]*\?$/u,
    ],
    [
      'T-TOFF-3',
      /^(?=.*\?$)(?=.*\b(check|test|compare|inspect|examine|match|matches|measure|result|record|separate|distinguish|rule out|read|weigh|trace|settle|tell apart|verify)\b)(?:which|what|does|do|is|are|would|could|can|shall|will|how|where|who)\b/u,
    ],
  ]),
  testBegun: R([
    [
      'T-TBEG-1',
      /(?<!\b(?:if|should|were|whether|once|when|unless|until) )\b(i (set|place|lay|put|open|inspect|examine|compare|check|test|read|weigh|match|trace) (the|this|that|it|each|both|my|a|an)|you and i (set|place|compare|examine|check|test|read|inspect) (the|this|that|it|each|both)|i (have|'ve) (set|placed|opened|inspected|examined|compared|checked|tested|read|weighed|matched|traced))\b/u,
    ],
  ]),
  testDecline: R([
    [
      'T-TDEC-1',
      /\b(not (yet|now)[,.;]? (let us|let's|shall we|we (will|shall|should) not|i (will|shall) not|that (test|check))|not (that|this one)[,.;]|i (won't|will not|cannot|can't) (run|do|accept|grant) that|that (test|check) (can|will) wait|leave that (test|check) (aside|for now)|no[,.] (first|before))\b/u,
    ],
  ]),
  assent: R([
    [
      'T-GRANT-1',
      /^("|')?(yes|go ahead|agreed|granted|by all means|please do|do that|you may|you can|that('s| is) (sound|fine|fair|right)|good[-,: ]|fine[-,: ])\b/u,
    ],
    [
      'T-GRANT-2',
      /\b(you may (inspect|record|say|enter|examine|check|compare|look|test|choose|mark)|you can (inspect|record|say|enter|examine|check|compare|look|test|choose|mark)|record it|enter it|mark it|say (it|that) (in|as)|that (wording|entry|statement) (is|stands|holds))\b/u,
    ],
  ]),
  handBack: R([
    [
      'T-HB-1',
      /\b(you choose|your call|that is yours to (choose|decide|say)|i (won't|will not) (choose|decide|pick) for you|pick (one )?yourself|the choice is yours|not (yet|now)[,.-] (first|you))\b/u,
    ],
  ]),
});

function stripQuoted(text) {
  return String(text || '')
    .replace(/[“"][^”"]{3,}[”"]/gu, ' ')
    .replace(/'[^']{12,}'/gu, ' ');
}

const RULE_FILTERS = Object.freeze({
  testBegun: (sentence) => !/\?/u.test(sentence) && !LEARNER_RULES.request.some((r) => r.re.test(norm(sentence))),
  testAccept: (sentence) => !/\?/u.test(sentence),
});

const STRIP_QUOTES_FOR = new Set(['assent', 'handBack', 'answer', 'challenge']);

function matchRules(rules, text, { filter = null } = {}) {
  const out = [];
  const seenRule = new Set();
  // Fine sentences first (clauses split at ; and dashes), then whole sentences for a rule
  // whose form spans a clause break, such as a two-way question with an aside.
  for (const pass of [sentences(text), sentences(text, { coarse: true })]) {
    for (const sentence of pass) {
      if (filter && !filter(sentence)) continue;
      const n = norm(sentence);
      for (const { id, re } of rules) {
        if (seenRule.has(id)) continue;
        if (re.test(n)) {
          seenRule.add(id);
          out.push({ rule: id, span: clip(sentence) });
        }
      }
    }
  }
  return out;
}

function isDeclarative(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  const words = t.split(/\s+/u).length;
  if (words < 6) return false;
  const noQuestion = !/\?/u.test(t.split(/(?<=[.!;])\s+/u).slice(-1)[0] || '') && !/\?/u.test(t);
  return noQuestion;
}

/**
 * Read the public events of one utterance. Returns marks with rule ids and
 * spans; the caller joins them with the instrument-derived marks.
 */
export function readPublicEvents({ speaker, text, nodeIndex, classification = null, tutorText = null } = {}) {
  const marks = [];
  const rules = speaker === 'tutor' ? TUTOR_RULES : LEARNER_RULES;
  const push = (kind, hits) => {
    for (const h of hits) marks.push({ kind, rule: h.rule, span: h.span, node: keyNode(h.span, nodeIndex) });
  };
  if (!text) return { marks, observation: null };
  for (const kind of Object.keys(rules)) {
    const source = speaker === 'tutor' && STRIP_QUOTES_FOR.has(kind) ? stripQuoted(text) : text;
    push(kind, matchRules(rules[kind], source, { filter: RULE_FILTERS[kind] || null }));
  }
  let observation = null;
  if (speaker === 'learner') {
    try {
      observation = observeResistantLearnerTurn({ learnerText: text, classification, tutorText });
    } catch {
      observation = null;
    }
    for (const obs of observation?.observations || []) {
      if (obs.type === 'frame_jurisdiction_dispute' || obs.type === 'frame_jurisdiction_refusal') {
        marks.push({
          kind: 'dispute',
          rule: `OBS-${obs.type}`,
          span: clip(obs.evidence_span || text),
          node: keyNode(obs.evidence_span || text, nodeIndex),
        });
      }
      if (obs.type === 'bored_effort_withholding') {
        marks.push({
          kind: 'withholding',
          rule: `OBS-${obs.type}`,
          span: clip(obs.evidence_span || text),
          node: OTHER,
        });
      }
    }
  }
  return { marks, observation };
}

// ---------------------------------------------------------------------------
// Turn extraction
// ---------------------------------------------------------------------------

function factList(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((f) => Array.isArray(f) && f.length > 0);
}

export function extractTraceTurns(events = []) {
  const turns = [];
  const mannerByTurn = new Map();
  const forceByTurn = new Map();
  for (const e of events) {
    if (e?.type === 'tutor_manner_switch') {
      const list = mannerByTurn.get(e.turn) || [];
      list.push(e);
      mannerByTurn.set(e.turn, list);
    }
    if (e?.type === 'tutor_card_force') {
      const list = forceByTurn.get(e.turn) || [];
      list.push(e);
      forceByTurn.set(e.turn, list);
    }
  }
  const opening = events.find((e) => e?.type === 'tutor_opening' && typeof e.text === 'string' && e.text.trim());
  if (opening) {
    turns.push({
      turn: 0,
      turnId: opening.turnId || null,
      learnerText: null,
      tutorText: opening.text,
      record: {},
      mannerEvents: [],
      forceEvents: [],
      opening: true,
    });
  }
  for (const e of events) {
    if (e?.type !== 'turn_complete' || !e.turnRecord) continue;
    const r = e.turnRecord;
    const turn = Number(r.turn ?? e.turn);
    turns.push({
      turn,
      turnId: r.turnId || e.turnId || null,
      learnerText: typeof r.learner === 'string' ? r.learner : (r.learnerInput?.text ?? null),
      tutorText: typeof r.tutor === 'string' ? r.tutor : null,
      record: r,
      mannerEvents: mannerByTurn.get(turn) || [],
      forceEvents: forceByTurn.get(turn) || [],
    });
  }
  turns.sort((a, b) => a.turn - b.turn);
  return turns;
}

// ---------------------------------------------------------------------------
// Board builder
// ---------------------------------------------------------------------------

function worstEntitlement(list) {
  if (!list.length) return NONE;
  if (list.includes('unwarranted')) return 'unwarranted';
  if (list.includes('pending')) return 'pending';
  return 'warranted';
}

function joinValues(values) {
  const uniq = [...new Set(values.filter(Boolean))];
  return uniq.length ? uniq.join('+') : NONE;
}

export function deliveredFamily(record) {
  return (
    record?.warrantGateOutcome?.action_family ||
    record?.deliveredResponseConfiguration?.action_family ||
    record?.responseConfiguration?.action_family ||
    null
  );
}

function semanticEvents(record) {
  return record?.warrantGateDecision?.semantic_event_extraction?.events || [];
}

function firstSentence(text) {
  return clip(sentences(text)[0] || text || '');
}

function sentenceFor(text, node, nodeIndex, fallbackTerms = []) {
  const list = sentences(text);
  if (!list.length) return clip(text || '');
  const terms = new Set([...(nodeIndex?.byId.get(node)?.distinct || []), ...fallbackTerms]);
  let best = list[0];
  let bestHits = -1;
  for (const s of list) {
    let hits = 0;
    for (const t of contentTerms(s)) if (terms.has(t)) hits += 1;
    if (hits > bestHits) {
      bestHits = hits;
      best = s;
    }
  }
  return clip(best);
}

class LicenceRegistry {
  constructor(arm) {
    this.tutorRights = new Set();
    this.grants = new Map(); // node -> sinceTurn
    this.arm = arm || null;
    this.unread = false;
  }

  setTutorRights(rights, unread) {
    this.tutorRights = new Set(rights);
    this.unread = Boolean(unread);
    if (this.arm === 'standing_permission') this.tutorRights.add('standing_permission');
  }

  grant(node, turn) {
    if (!this.grants.has(node)) this.grants.set(node, turn);
  }

  revokeAll() {
    this.grants.clear();
  }

  hasGrant() {
    return this.grants.size > 0;
  }

  value() {
    const parts = [...this.tutorRights].sort();
    for (const [node, since] of [...this.grants.entries()].sort()) parts.push(`granted:${node}@t${since}`);
    if (!parts.length) return this.unread ? UNREAD : NONE;
    return parts.join(';');
  }
}

/**
 * Build the board for one dialogue.
 *
 * @param {object} args
 * @param {object[]} args.events   trace events (jsonl rows)
 * @param {object|null} args.world loaded world, or null when unknown
 * @param {string|null} [args.arm] bare | gated | steering_only | standing_permission
 * @returns {{schema, dialogue, rows, unread, counts}}
 */
export function buildScoreboard({ events, world = null, arm = null, identity = null } = {}) {
  const turns = extractTraceTurns(events);
  const nodeIndex = buildWorldNodeIndex(world);
  const rules = world?.rules || [];
  const background = factList(world?.background);
  const allPremiseFacts = (world?.premises || []).map((p) => p.fact).filter(Array.isArray);
  const premiseFactById = new Map((world?.premises || []).map((p) => [p.id, p.fact]));
  const premiseByFactKey = new Map((world?.premises || []).map((p) => [factKey(p.fact), p.id]));
  const worldClosureKeys = world ? new Set(closure([...allPremiseFacts, ...background], rules).facts.keys()) : null;

  const rows = [];
  const unread = Object.fromEntries(SCOREBOARD_FIELDS.map((f) => [f, 0]));
  const dialogueIdentity = identity || traceDialogueIdentity(events);

  // Derived state under the silence rule.
  const releases = []; // {premiseId, surface, sinceTurn}
  const releasedIds = new Set();
  const debts = new Map(); // key -> {premiseId, surface, sinceTurn}
  const openChallenges = []; // {by, turn, node, span}
  const openTests = []; // {by, turn, node}
  let dispute = { open: false, sinceTurn: null };
  let heldPublicKeys = new Set(background.map(factKey));
  let previouslyDerivable = new Set();
  const learnerAdopted = new Set();
  const licence = new LicenceRegistry(arm);
  const mannerSeen = events.some((e) => e?.type === 'tutor_manner_switch');

  const markUnread = (field) => {
    unread[field] += 1;
    return UNREAD;
  };

  for (const t of turns) {
    const r = t.record || {};
    const turn = t.turn;

    // ------------------------------------------------------------ learner row
    if (!t.opening) {
      const marks = [];
      const fields = {};
      const text = t.learnerText;
      const pub = readPublicEvents({
        speaker: 'learner',
        text,
        nodeIndex,
        classification: r.classification || r.stateObservation?.classifier || null,
        tutorText: t.tutorText,
      });
      const sem = semanticEvents(r);
      const semSpan = (ev) => clip(ev?.evidence_span?.text || text || '');
      const dagUpdate = r.tutorLearnerDagUpdate || null;
      const accepted = dagUpdate?.accepted || null;

      const hasKind = (k) => pub.marks.some((m) => m.kind === k);
      const kindMarks = (k) => pub.marks.filter((m) => m.kind === k);

      // Requests (provenance; also feed grants and the permission predicate).
      const requestMarks = [...kindMarks('request')];
      for (const ev of sem) {
        if (
          ['tutor_selection_request', 'learner_wording_request', 'learner_record_entry_request'].includes(ev.speech_act)
        ) {
          requestMarks.push({
            kind: 'request',
            rule: `SEM-${ev.speech_act}`,
            span: semSpan(ev),
            node: keyNode(semSpan(ev), nodeIndex),
          });
        }
      }
      for (const m of requestMarks) marks.push({ field: 'request', value: 'request', ...m });

      // Commitment undertaken.
      const commitments = [];
      const entitlements = [];
      const adoptedNow = [];
      if (accepted) {
        for (const pid of accepted.adopt || []) {
          adoptedNow.push(pid);
          const pubBefore =
            releasedIds.has(pid) ||
            (dagUpdate?.preflight?.eligiblePublicPremiseIds || []).includes(pid) ||
            premiseByFactKey.get(
              factKey(background.find((b) => factKey(b) === factKey(premiseFactById.get(pid) || [])) || []),
            ) === pid;
          const ent = world ? (pubBefore ? 'warranted' : 'unwarranted') : UNREAD;
          commitments.push(pid);
          entitlements.push(ent);
          marks.push({
            field: 'commitment_undertaken',
            value: pid,
            node: pid,
            rule: 'DAG-adopt',
            span: sentenceFor(text, pid, nodeIndex),
            entitlement: ent,
          });
        }
        const heldNow = new Set(heldPublicKeys);
        for (const pid of adoptedNow) {
          const f = premiseFactById.get(pid);
          if (f && (releasedIds.has(pid) || (dagUpdate?.preflight?.eligiblePublicPremiseIds || []).includes(pid)))
            heldNow.add(factKey(f));
        }
        const heldFacts = world ? [...heldNow].map((k) => JSON.parse(k)) : [];
        const heldClosure = world ? closure(heldFacts, rules).facts : null;
        const entitle = (fact) => {
          if (!world) return UNREAD;
          const k = factKey(fact);
          if (heldClosure.has(k)) return 'warranted';
          if (worldClosureKeys.has(k)) return 'pending';
          return 'unwarranted';
        };
        for (const fact of factList(accepted.derive)) {
          const label = factNodeLabel(fact, world);
          const ent = entitle(fact);
          commitments.push(label);
          entitlements.push(ent);
          marks.push({
            field: 'commitment_undertaken',
            value: label,
            node: label,
            rule: 'DAG-derive',
            span: sentenceFor(text, label, nodeIndex, factTerms(fact)),
            entitlement: ent,
          });
        }
        for (const [kind, val] of [
          ['assertAnswer', accepted.assertAnswer],
          ['hypothesis', accepted.hypothesis],
        ]) {
          if (!val) continue;
          const node = answerNode(val, world);
          let ent;
          if (!world) ent = UNREAD;
          else if (node === SECRET_NODE) ent = entitle(world.secret.fact);
          else ent = 'unwarranted';
          commitments.push(node);
          entitlements.push(ent);
          marks.push({
            field: 'commitment_undertaken',
            value: node,
            node,
            rule: `DAG-${kind}`,
            span: sentenceFor(text, node, nodeIndex, contentTerms(val)),
            entitlement: ent,
          });
        }
        for (const pid of accepted.retract || []) {
          marks.push({
            field: 'withdraw',
            value: 'retract',
            node: pid,
            rule: 'DAG-retract',
            span: sentenceFor(text, pid, nodeIndex),
          });
        }
      }
      const withholding = kindMarks('withholding');
      // A decline or a withholding sentence is still content outside the DAG, so it does not block `other`.
      const requestLike =
        requestMarks.length > 0 ||
        hasKind('challenge') ||
        hasKind('dispute') ||
        hasKind('condition') ||
        hasKind('testOffer') ||
        hasKind('testAccept') ||
        hasKind('testBegun') ||
        hasKind('withdraw');
      if (!commitments.length && text && isDeclarative(text) && !requestLike) {
        commitments.push(OTHER);
        entitlements.push('unwarranted');
        marks.push({
          field: 'commitment_undertaken',
          value: OTHER,
          node: OTHER,
          rule: withholding.length ? 'TEXT-withholding-declarative' : 'TEXT-declarative-off-dag',
          span: firstSentence(text),
          entitlement: 'unwarranted',
        });
      }
      if (!accepted && !text) {
        fields.commitment_undertaken = markUnread('commitment_undertaken');
        fields.entitlement_status = markUnread('entitlement_status');
      } else {
        fields.commitment_undertaken = joinValues(commitments);
        fields.entitlement_status = commitments.length
          ? entitlements.includes(UNREAD)
            ? markUnread('entitlement_status')
            : worstEntitlement(entitlements)
          : NONE;
      }
      const nodeCommitments = commitments.filter((c) => c !== OTHER);

      // Test lifecycle (learner side).
      const testValues = [];
      const testBegun = kindMarks('testBegun');
      const testAccept = kindMarks('testAccept');
      const testDecline = kindMarks('testDecline');
      const testOffer = [...kindMarks('testOffer')];
      for (const ev of sem) {
        if (ev.speech_act === 'learner_proposed_test')
          testOffer.push({
            kind: 'testOffer',
            rule: 'SEM-learner_proposed_test',
            span: semSpan(ev),
            node: keyNode(semSpan(ev), nodeIndex),
          });
      }
      const openTutorTests = openTests.filter((o) => o.by === 'tutor');
      const declinableTutorTests = openTests.filter((o) => o.by === 'tutor' || o.by === 'tutor-begun');
      const begunByAdopt = openTutorTests.filter((o) => adoptedNow.includes(o.node));
      if (testBegun.length || begunByAdopt.length) {
        const m = testBegun[0] || {
          rule: 'DAG-adopt-of-offered-node',
          span: sentenceFor(text, begunByAdopt[0].node, nodeIndex),
          node: begunByAdopt[0].node,
        };
        testValues.push('begun');
        marks.push({ field: 'test', value: 'begun', ...m });
        for (const o of [...openTests])
          if (o.by === 'tutor' || o.by === 'learner') openTests.splice(openTests.indexOf(o), 1);
      } else if (testDecline.length && declinableTutorTests.length) {
        testValues.push('declined');
        marks.push({ field: 'test', value: 'declined', ...testDecline[0] });
        for (const o of declinableTutorTests) openTests.splice(openTests.indexOf(o), 1);
      } else if (testAccept.length && openTutorTests.length) {
        testValues.push('accepted');
        marks.push({ field: 'test', value: 'accepted', ...testAccept[0] });
        for (const o of openTutorTests) openTests.splice(openTests.indexOf(o), 1);
      }
      if (testOffer.length) {
        testValues.push('offered');
        marks.push({ field: 'test', value: 'offered', ...testOffer[0] });
        openTests.push({ by: 'learner', turn, node: testOffer[0].node });
      }
      fields.test = text ? joinValues(testValues) : markUnread('test');

      // Condition named.
      const conds = kindMarks('condition');
      if (!text) fields.condition_named = markUnread('condition_named');
      else if (conds.length) {
        fields.condition_named = joinValues(conds.map((c) => c.node));
        for (const c of conds) marks.push({ field: 'condition_named', value: c.node, ...c });
      } else fields.condition_named = NONE;

      // Challenge (learner issues; learner answers or defaults on open tutor challenges).
      const challengeValues = [];
      const issued = [...kindMarks('challenge')];
      for (const ev of sem) {
        if (ev.speech_act === 'learner_evidence_demand')
          issued.push({
            kind: 'challenge',
            rule: 'SEM-learner_evidence_demand',
            span: semSpan(ev),
            node: keyNode(semSpan(ev), nodeIndex),
          });
      }
      const textWithdraw = kindMarks('withdraw');
      const withdrawMarks = [...textWithdraw, ...marks.filter((m) => m.field === 'withdraw')];
      const openTutorChallenges = openChallenges.filter((c) => c.by === 'tutor');
      if (openTutorChallenges.length) {
        const warrantMove =
          entitlements.some((e, i) => commitments[i] !== OTHER && e === 'warranted') ||
          testValues.includes('begun') ||
          withdrawMarks.length > 0;
        const reassertWithoutWarrant =
          commitments.length > 0 && entitlements.some((e) => e === 'unwarranted' || e === 'pending');
        if (warrantMove) {
          challengeValues.push('answered');
          const span =
            marks.find((m) => m.field === 'commitment_undertaken' && m.entitlement === 'warranted')?.span ||
            marks.find((m) => m.field === 'test' && m.value === 'begun')?.span ||
            withdrawMarks[0]?.span ||
            firstSentence(text);
          marks.push({
            field: 'challenge',
            value: 'answered',
            rule: 'STATE-warrant-move-under-open-challenge',
            span,
            node: openTutorChallenges[0].node,
          });
          for (const c of openTutorChallenges) openChallenges.splice(openChallenges.indexOf(c), 1);
        } else if (reassertWithoutWarrant) {
          challengeValues.push('defaulted');
          const span =
            marks.find((m) => m.field === 'commitment_undertaken' && m.entitlement !== 'warranted')?.span ||
            firstSentence(text);
          marks.push({
            field: 'challenge',
            value: 'defaulted',
            rule: 'STATE-reassert-without-warrant-under-open-challenge',
            span,
            node: openTutorChallenges[0].node,
          });
        }
      }
      if (withdrawMarks.length || testValues.includes('begun')) {
        for (const c of openChallenges.filter((x) => x.by === 'learner'))
          openChallenges.splice(openChallenges.indexOf(c), 1);
      }
      if (issued.length) {
        challengeValues.push('issued');
        marks.push({ field: 'challenge', value: 'issued', ...issued[0] });
        openChallenges.push({ by: 'learner', turn, node: issued[0].node, span: issued[0].span });
      }
      fields.challenge = text ? joinValues(challengeValues) : markUnread('challenge');

      // Standing dispute.
      const disputeMarks = kindMarks('dispute');
      if (disputeMarks.length && !dispute.open) {
        dispute = { open: true, sinceTurn: turn };
        marks.push({ field: 'standing_dispute', value: 'open', ...disputeMarks[0] });
      } else if (disputeMarks.length) {
        marks.push({
          field: 'standing_dispute',
          value: 'open',
          rule: `${disputeMarks[0].rule}(restated)`,
          span: disputeMarks[0].span,
          node: disputeMarks[0].node,
        });
      } else if (dispute.open && (testValues.includes('begun') || textWithdraw.length)) {
        dispute = { open: false, sinceTurn: null };
        const m = marks.find((x) => x.field === 'test' && x.value === 'begun') || textWithdraw[0];
        marks.push({
          field: 'standing_dispute',
          value: 'settled',
          rule: 'STATE-uptake-settles-dispute',
          span: m?.span || firstSentence(text),
          node: m?.node || OTHER,
        });
      }
      fields.standing_dispute = text ? (dispute.open ? 'open' : 'settled') : markUnread('standing_dispute');

      // Debt: new entries from the proof-debt instrument, discharges, withdrawals.
      const proofDebt = r.proofDebt || null;
      if (proofDebt) {
        for (const d of proofDebt.open || []) {
          const surface = String(d.surface || '').trim();
          if (!surface) continue;
          const key = surface.toLowerCase();
          if (!debts.has(key)) {
            const premiseId = keyNode(surface, nodeIndex);
            debts.set(key, { premiseId, surface: clip(surface), sinceTurn: turn });
            marks.push({
              field: 'debt',
              value: 'opened',
              node: premiseId,
              rule: `DEBT-${d.source || 'open'}`,
              span: clip(surface),
            });
          }
        }
        for (const d of proofDebt.discharged || []) {
          const key = String(d.surface || '')
            .trim()
            .toLowerCase();
          if (key && debts.has(key)) {
            marks.push({
              field: 'debt',
              value: 'discharged',
              node: debts.get(key).premiseId,
              rule: `DEBT-discharged-${d.source || 'instrument'}`,
              span: clip(d.surface),
            });
            debts.delete(key);
          }
        }
      }
      for (const w of marks.filter((m) => m.field === 'withdraw' && m.rule === 'DAG-retract')) {
        for (const [key, d] of [...debts.entries()]) {
          if (d.premiseId === w.node || d.premiseId === MIRROR_NODE) {
            marks.push({
              field: 'debt',
              value: 'withdrawn',
              node: d.premiseId,
              rule: 'STATE-retract-withdraws-debt',
              span: w.span,
            });
            debts.delete(key);
          }
        }
      }
      if (!proofDebt && !debts.size) fields.debt = markUnread('debt');
      else fields.debt = debts.size ? [...debts.values()] : NONE;

      // Forced entry: what the checker forces from the learner's public facts.
      if (!world || !dagUpdate) {
        fields.forced_entry = markUnread('forced_entry');
      } else {
        const prior = dagUpdate.preflight?.priorRecord || {};
        const held = new Set([...heldPublicKeys, ...factList(prior.groundedFacts).map(factKey)]);
        for (const pid of adoptedNow) {
          const f = premiseFactById.get(pid);
          if (f) held.add(factKey(f));
        }
        for (const f of factList(prior.voicedDerivedFacts)) held.add(factKey(f));
        const heldFacts = [...held].map((k) => JSON.parse(k));
        const derivable = new Set([...closure(heldFacts, rules).facts.keys()].filter((k) => !held.has(k)));
        const voiced = new Set([
          ...factList(accepted?.derive).map(factKey),
          ...factList(prior.voicedDerivedFacts).map(factKey),
        ]);
        const forced = [...derivable].filter((k) => !previouslyDerivable.has(k) && !voiced.has(k));
        const labels = forced.map((k) => factNodeLabel(JSON.parse(k), world));
        fields.forced_entry = labels.length ? joinValues(labels) : NONE;
        for (const l of labels)
          marks.push({
            field: 'forced_entry',
            value: l,
            node: l,
            rule: 'CHAINER-closure-minus-held-minus-voiced',
            span: firstSentence(text),
          });
        previouslyDerivable = new Set([...previouslyDerivable, ...derivable]);
        heldPublicKeys = held;
        for (const pid of adoptedNow) learnerAdopted.add(pid);
      }

      // Release ledger state and licence in force when the learner speaks.
      fields.release = releases.length ? releases.map((x) => ({ ...x })) : rows.length ? NONE : NONE;
      fields.licence_in_force = licence.value();
      if (fields.licence_in_force === UNREAD) unread.licence_in_force += 1;

      rows.push({
        turn,
        speaker: 'learner',
        text: text ?? null,
        fields,
        marks,
        provenance: {
          requests: requestMarks.length,
          withholding: withholding.length,
          nodeCommitments,
          semanticSpeechActs: sem.map((e) => e.speech_act),
          classifier: r.classification?.turn
            ? {
                request_type: r.classification.turn.request_type,
                discourse_move: r.classification.turn.discourse_move,
                evidence_use: r.classification.turn.evidence_use,
                agency: r.classification.turn.agency,
              }
            : null,
          grantInForce: licence.hasGrant(),
        },
      });
    }

    // -------------------------------------------------------------- tutor row
    {
      const marks = [];
      const fields = {};
      const text = t.tutorText;
      const pub = readPublicEvents({ speaker: 'tutor', text, nodeIndex });
      const kindMarks = (k) => pub.marks.filter((m) => m.kind === k);
      const learnerRow = rows[rows.length - 1];
      const family = deliveredFamily(r);

      // Commitment: only a leaked or entailed secret counts as a tutor commitment.
      const leak = r.tutorLeakAudit || null;
      if (!leak && !text) {
        fields.commitment_undertaken = markUnread('commitment_undertaken');
        fields.entitlement_status = markUnread('entitlement_status');
      } else if ((leak?.leaks || []).length || tutorNamesAnswer(text, world, nodeIndex)) {
        const leaked = (leak?.leaks || []).map((l) =>
          Array.isArray(l?.fact)
            ? factNodeLabel(l.fact, world)
            : Array.isArray(l)
              ? factNodeLabel(l, world)
              : SECRET_NODE,
        );
        const named = tutorNamesAnswer(text, world, nodeIndex);
        const nodes = leaked.length ? leaked : [named.node];
        const publicKeys = new Set([
          ...background.map(factKey),
          ...(leak?.publicPremiseIds || [...releasedIds])
            .map((pid) => premiseFactById.get(pid))
            .filter(Boolean)
            .map(factKey),
        ]);
        const publicClosure = world
          ? closure(
              [...publicKeys].map((k) => JSON.parse(k)),
              rules,
            ).facts
          : null;
        const ent = !world
          ? UNREAD
          : nodes.every((n) => (n === SECRET_NODE ? publicClosure.has(factKey(world.secret.fact)) : false))
            ? 'warranted'
            : 'unwarranted';
        fields.commitment_undertaken = joinValues(nodes);
        fields.entitlement_status = ent === UNREAD ? markUnread('entitlement_status') : ent;
        marks.push({
          field: 'commitment_undertaken',
          value: fields.commitment_undertaken,
          node: nodes[0],
          rule: leaked.length ? 'LEAK-leaks' : 'TEXT-answer-named',
          span: named?.span || firstSentence(text),
          entitlement: ent,
        });
      } else {
        fields.commitment_undertaken = NONE;
        fields.entitlement_status = NONE;
      }

      // Release: new releases this turn from the pacing and the release frame.
      const releasedNow = [];
      const pacing = r.releasePacing || null;
      const frame = r.dramaticRelease?.frame?.entries || null;
      if (pacing?.releasedNow)
        for (const pid of pacing.releasedNow) releasedNow.push({ premiseId: pid, via: 'releasePacing' });
      if (Array.isArray(frame))
        for (const e of frame)
          if (e?.premise && !releasedNow.some((x) => x.premiseId === e.premise))
            releasedNow.push({ premiseId: e.premise, via: e.via || 'frame', surface: e.surface });
      for (const rel of releasedNow) {
        if (releasedIds.has(rel.premiseId)) continue;
        releasedIds.add(rel.premiseId);
        const surface = rel.surface || world?.premiseById?.get?.(rel.premiseId)?.surface || rel.premiseId;
        releases.push({ premiseId: rel.premiseId, surface: clip(surface), sinceTurn: turn });
        marks.push({
          field: 'release',
          value: rel.premiseId,
          node: rel.premiseId,
          rule: `RELEASE-${rel.via}`,
          span: sentenceFor(text, rel.premiseId, nodeIndex),
        });
        const f = premiseFactById.get(rel.premiseId);
        if (f) heldPublicKeys.add(factKey(f));
      }
      if (!t.opening && !pacing && !frame && !r.tutorDag) fields.release = markUnread('release');
      else fields.release = releases.length ? releases.map((x) => ({ ...x })) : NONE;

      // Test lifecycle (tutor side).
      const testValues = [];
      const openLearnerTests = openTests.filter((o) => o.by === 'learner' && o.turn === turn);
      const decline = kindMarks('testDecline');
      const assent = kindMarks('assent');
      const offers = kindMarks('testOffer');
      if (openLearnerTests.length && decline.length) {
        testValues.push('declined');
        marks.push({ field: 'test', value: 'declined', ...decline[0], node: openLearnerTests[0].node });
        for (const o of openLearnerTests) openTests.splice(openTests.indexOf(o), 1);
      } else if (openLearnerTests.length && assent.length) {
        testValues.push('accepted');
        marks.push({ field: 'test', value: 'accepted', ...assent[0], node: openLearnerTests[0].node });
        for (const o of openLearnerTests) openTests.splice(openTests.indexOf(o), 1);
      }
      if (offers.length) {
        testValues.push('offered');
        marks.push({ field: 'test', value: 'offered', ...offers[0] });
        openTests.push({ by: 'tutor', turn, node: offers[0].node });
      }
      const begun = kindMarks('testBegun');
      if (begun.length && !offers.length) {
        testValues.push('begun');
        marks.push({ field: 'test', value: 'begun', ...begun[0] });
        openTests.push({ by: 'tutor-begun', turn, node: begun[0].node });
      }
      fields.test = text ? joinValues(testValues) : markUnread('test');

      // Condition named.
      const conds = kindMarks('condition');
      if (!text) fields.condition_named = markUnread('condition_named');
      else if (conds.length) {
        fields.condition_named = joinValues(conds.map((c) => c.node));
        for (const c of conds) marks.push({ field: 'condition_named', value: c.node, ...c });
      } else fields.condition_named = NONE;

      // Challenge: delivered family or text demand issues; scope statement answers.
      const challengeValues = [];
      const chalText = kindMarks('challenge');
      const familyChallenge = family === 'challenge_resistance';
      if (familyChallenge || chalText.length) {
        challengeValues.push('issued');
        const m = chalText[0] || {
          rule: 'FAMILY-challenge_resistance',
          span: firstSentence(text),
          node: keyNode(firstSentence(text), nodeIndex),
        };
        marks.push({
          field: 'challenge',
          value: 'issued',
          ...m,
          source: familyChallenge ? (chalText.length ? 'family+text' : 'family') : 'text',
        });
        openChallenges.push({ by: 'tutor', turn, node: m.node, span: m.span });
      }
      const answers = kindMarks('answer');
      const openLearnerChallenges = openChallenges.filter((c) => c.by === 'learner');
      if (answers.length && (openLearnerChallenges.length || dispute.open)) {
        challengeValues.push('answered');
        marks.push({
          field: 'challenge',
          value: 'answered',
          ...answers[0],
          source: openLearnerChallenges.length ? 'open-learner-challenge' : 'open-dispute',
        });
        // Silence rule: a scope statement answers the demand but does not discharge it. Only a
        // release of evidence, a test begun, or the learner's withdrawal removes it (below).
      } else if (answers.length) {
        marks.push({ field: 'scope_statement', value: 'scope_statement', ...answers[0] });
      }
      const learnerUnwarranted =
        learnerRow && learnerRow.turn === turn && learnerRow.speaker === 'learner'
          ? learnerRow.marks.filter(
              (m) =>
                m.field === 'commitment_undertaken' &&
                m.node !== OTHER &&
                m.entitlement !== 'warranted' &&
                m.entitlement !== UNREAD,
            )
          : [];
      if (answers.length && !challengeValues.includes('issued') && learnerUnwarranted.length) {
        challengeValues.push('issued');
        marks.push({
          field: 'challenge',
          value: 'issued',
          rule: 'STATE-scope-contests-claim',
          span: answers[0].span,
          node: learnerUnwarranted[0].node,
          source: 'state',
        });
        openChallenges.push({ by: 'tutor', turn, node: learnerUnwarranted[0].node, span: answers[0].span });
      }
      const newReleases = releasedNow.filter((rel) =>
        releases.some((x) => x.premiseId === rel.premiseId && x.sinceTurn === turn),
      );
      if (openLearnerChallenges.length && newReleases.length) {
        if (!challengeValues.includes('answered')) challengeValues.push('answered');
        marks.push({
          field: 'challenge',
          value: 'answered',
          rule: 'STATE-release-discharges-demand',
          span: sentenceFor(text, newReleases[0].premiseId, nodeIndex),
          node: newReleases[0].premiseId,
          source: 'release',
        });
        for (const c of openLearnerChallenges) openChallenges.splice(openChallenges.indexOf(c), 1);
      }
      fields.challenge = text ? joinValues(challengeValues) : markUnread('challenge');

      // Debt and forced entry are learner-side ledgers; the tutor row carries state only.
      fields.debt = debts.size
        ? [...debts.values()]
        : r.proofDebt || learnerRow?.fields.debt !== UNREAD
          ? NONE
          : markUnread('debt');
      fields.forced_entry = NONE;
      fields.standing_dispute = dispute.open ? 'open' : 'settled';

      // Licence registry: tutor rights this turn, grants to the learner.
      const rights = [];
      const gate = r.warrantGateDecision || null;
      const completion = r.inquiryCompletion || null;
      if (gate?.revision_warranted === true || gate?.commitment_transition_warranted === true) rights.push('challenge');
      if (pacing?.dueNow) for (const pid of pacing.dueNow) rights.push(`release:${pid}`);
      for (const rel of releasedNow)
        if (!rights.includes(`release:${rel.premiseId}`)) rights.push(`release:${rel.premiseId}`);
      if (completion?.status === 'complete' || gate?.decision_kind === 'terminal_transition') rights.push('close');
      for (const ev of t.mannerEvents) {
        const licensed =
          (typeof ev.cardsVersion === 'string' && ev.cardsVersion.includes('licence')) ||
          (typeof ev.dose === 'number' && ev.dose >= 3);
        if (licensed) rights.push(`card:${ev.card || ev.cardId || ev.state || 'active'}`);
      }
      const instrumentsAbsent = t.opening ? false : !gate && !pacing && !completion && !mannerSeen;
      licence.setTutorRights(rights, instrumentsAbsent);
      const learnerRequested =
        (learnerRow?.provenance?.requests || 0) > 0 ||
        learnerRow?.marks.some((m) => m.field === 'test' && m.value === 'offered');
      if (kindMarks('handBack').length) {
        licence.revokeAll();
        marks.push({ field: 'licence_in_force', value: 'revoked', ...kindMarks('handBack')[0] });
      } else if (assent.length && learnerRequested) {
        const reqNode =
          learnerRow.marks.find((m) => m.field === 'request')?.node ||
          learnerRow.marks.find((m) => m.field === 'test' && m.value === 'offered')?.node ||
          OTHER;
        licence.grant(reqNode, turn);
        marks.push({ field: 'licence_in_force', value: `granted:${reqNode}`, ...assent[0], node: reqNode });
      }
      fields.licence_in_force = licence.value();
      if (fields.licence_in_force === UNREAD) unread.licence_in_force += 1;

      rows.push({
        turn,
        speaker: 'tutor',
        text: text ?? null,
        fields,
        marks,
        provenance: {
          actionFamily: family,
          decisionKind: gate?.decision_kind || null,
          revisionWarranted: gate?.revision_warranted ?? null,
          releasedNow: releasedNow.map((x) => x.premiseId),
          scopeStatement: answers.length > 0,
          cardForce: t.forceEvents.map((e) => ({
            forced: e.forced,
            withheld: e.withheld,
            observedQuietState: e.observedQuietState,
            cardActive: e.cardActive,
          })),
          tutorRights: rights,
        },
      });
    }
  }

  return {
    schema: SCOREBOARD_SCHEMA,
    dialogue: {
      ...dialogueIdentity,
      arm,
      turns: turns.filter((t) => !t.opening).length,
      opening: turns.some((t) => t.opening),
      worldLoaded: Boolean(world),
    },
    rows,
    unread,
    counts: { rows: rows.length, turns: turns.filter((t) => !t.opening).length },
  };
}

/** Render a board as a fixed-column text table for notes and quick reads. */
export function renderScoreboardTable(board, { maxSpan = 60 } = {}) {
  const cell = (v) => {
    if (Array.isArray(v)) return v.length ? v.map((x) => `${x.premiseId}@t${x.sinceTurn}`).join(' ') : NONE;
    return String(v ?? '');
  };
  const lines = [`turn | speaker | ${SCOREBOARD_FIELDS.join(' | ')}`];
  for (const row of board.rows) {
    lines.push(`${row.turn} | ${row.speaker} | ${SCOREBOARD_FIELDS.map((f) => cell(row.fields[f])).join(' | ')}`);
    for (const m of row.marks) {
      if (['request', 'scope_statement', 'withdraw'].includes(m.field)) continue;
      lines.push(`      ${m.field}=${m.value} [${m.rule}] "${String(m.span || '').slice(0, maxSpan)}"`);
    }
  }
  return lines.join('\n');
}
