/**
 * Form-feature learner-state detector (card:
 * workplan/items/state-detection-without-word-lists.md, step 2, candidate b).
 *
 * Reads the SHAPE of a learner line, not its subject matter: who it addresses,
 * whether it orders, asks, quotes, hedges, counts effort, names a deadline or a
 * personal cost, repeats itself, or trails off. Every parameter here is
 * closed-class English (pronouns, auxiliaries, discourse markers, number and
 * clock grammar, punctuation) or a relation to the surrounding turns (overlap
 * with the tutor's last line, with the learner's own last line). No story
 * noun appears in this file — tests/tutorStubFormStateDetector.test.js checks
 * that against the v6 token bags, which ARE the training story's nouns.
 *
 * Output is one of the seven planted learner states (or neutral), so it can
 * stand in for both the pressure trigger and the quiet detector. Weights are
 * learned per class by scripts/train-form-state-detector.js, leave-one-world-
 * out; feature order is the artifact contract (featureVersion form-v1).
 */

import { TUTOR_STUB_PLANT_STATE_TO_PRESSURE, TUTOR_STUB_PLANT_STATE_TO_QUIET } from './tutorStubMannerSwitch.js';

// The default feature set for new artifacts. Older artifacts name their own
// featureVersion and keep computing with that set, so form-v1 stays loadable.
export const TUTOR_STUB_FORM_FEATURE_VERSION = 'form-v2';
export const TUTOR_STUB_FORM_FEATURE_VERSIONS = Object.freeze(['form-v1', 'form-v2', 'form-v3']);

export const TUTOR_STUB_FORM_STATES = Object.freeze([
  'jumping_ahead',
  'irritated',
  'frustrated',
  'forgetting',
  'opposed',
  'bored',
  'lost',
]);

// How a form-state read maps onto the two live channels: pressure kinds for
// the manner switch (move cards), quiet types for the quiet detector.
export const TUTOR_STUB_FORM_STATE_TO_PRESSURE = TUTOR_STUB_PLANT_STATE_TO_PRESSURE;
export const TUTOR_STUB_FORM_STATE_TO_QUIET = Object.freeze(
  Object.fromEntries(
    TUTOR_STUB_FORM_STATES.filter((s) => TUTOR_STUB_PLANT_STATE_TO_QUIET[s]).map((s) => [
      s,
      TUTOR_STUB_PLANT_STATE_TO_QUIET[s],
    ]),
  ),
);

const PRONOUN_STOP = new Set(
  'the and but for you your not are was were with that this then than there here what when where which just have has had can could would will its it is a an of to in on at me my mine im ive dont wont isnt arent be been being do does did so if or as one we our i'.split(
    ' ',
  ),
);

function contentTokens(value) {
  return new Set(
    (
      String(value || '')
        .toLowerCase()
        .match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{1,}/gu) || []
    )
      .map((token) => token.replace(/[’']/gu, ''))
      .filter((token) => token.length > 3 && !PRONOUN_STOP.has(token)),
  );
}

function overlapRatio(a, b) {
  if (!a.size || !b.size) return 0;
  let hit = 0;
  for (const token of a) if (b.has(token)) hit += 1;
  return hit / Math.min(a.size, b.size);
}

const NUMBER_WORD = '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|noon|midnight|\\d{1,2})';

// Each entry: [name, regex over the lower-cased line]. Binary form cues.
// form-v1 is frozen as shipped (config/manner-trigger/form-v1.json depends on
// it byte for byte); form-v2 edits are made on the copy below.
const CUES_V1 = [
  // orders and demands for a verdict now
  [
    'imperative_opener',
    /^(?:oh,?\s*|so,?\s*|look,?\s*|just\s+|then\s+)*(?:tell|give|show|say|answer|write|put|stop|come on|get on with)\b/,
  ],
  [
    'just_already',
    /\bjust\b.{0,40}\balready\b|\balready\b\s*[—–!?-]|\b(?:just|simply) (?:tell|say|give|write|answer|put)\b/,
  ],
  ['forced_choice_q', /\b(?:is it|was it|which one|which is it)\b[^?.!]{0,60}\bor\b[^?.!]{0,40}\?|\bor not\?/],
  [
    'ultimatum',
    /\bunless\b|\bor i['’]?m\b|\bor i (?:will|send|post|write)\b|\bin (?:one|a|\d+) minutes?\b|\bright now\b|\bone minute\b/,
  ],
  [
    'clock_grammar',
    new RegExp(
      `\\b(?:at|by|before|until|till) (?:half |quarter )?${NUMBER_WORD}\\b|\\d{1,2}[:.]\\d{2}|\\bo['’]?clock\\b|\\btonight\\b|\\bthis (?:morning|afternoon|evening)\\b`,
    ),
  ],
  ['about_to_act', /\b(?:i['’]?m|i am|about to|going to|my thumb['’]?s over) (?:send|post|hit|submit|writ|put|press)/],
  ['can_we_move', /\bcan we (?:do|move|go|get|skip)\b|\bmove on\b|\bnext (?:one|question|part)\b|\bnow\?/],
  // irritation aimed at the tutor
  [
    'you_accuse',
    /\byou (?:only|just|already|always|never|keep|knew)\b|\byou['’]?re \w+ing (?:me|us|this|it)\b|\byou (?:pick|chose|made|set|rigged)\w*\b (?:it|that|this|the)\b/,
  ],
  [
    'sound_like',
    /\bsound(?:s|ed)? like\b|\btalk(?:s|ing)? like\b|\bwho talks like\b|\blike (?:a|an|the) \w+,? not (?:a|an|the)\b/,
  ],
  [
    'why_challenge',
    /^(?:wait[—–,\s-]*)?(?:but |so )?why\b|\bwhy (?:not|do|did|does|would|should|can['’]?t|is it|six|ten)\b/,
  ],
  ['feels_like_you', /\bfeels like you\b|\bseems like you\b|\bas if you\b|\byou already knew\b/],
  // effort not paying off
  [
    'effort_span',
    /\b(?:i['’]?ve|i have|i)\s+(?:kept|logged|done|been|sat|written|watched|tracked|checked|answered)\b.{0,50}\b(?:every|since|for (?:two|three|\d+)|months?|weeks?|years?)\b/,
  ],
  ['every_repeat', /\bevery \w+,\s*every\b|\bevery \w+, every\b/],
  [
    'worth_question',
    /\b(?:isn['’]?t|is|was) (?:that|this|it) (?:not )?enough\b|\bwhat['’]?s the point\b|\bfor (?:anything|nothing|something)\b|\bcount(?:ed|s)? for\b|\bworth (?:anything|nothing|it)\b|\bone (?:thing|line|entry|word|bit)\b.{0,40}\b(?:counted|mattered|helped|right|true)\b/,
  ],
  [
    'push_back',
    /\b(?:pushing|push) me\b|\bbefore i can\b|\bstill have to\b|\bwhy do i\b|\bhanded back\b|\bmarked wrong\b/,
  ],
  // a false memory asserted as settled
  [
    'we_did',
    /\bwe (?:did|read|checked|tested|ran|saw|cleared|settled|went through|already)\b|\bi saw it\b|\bit came back\b/,
  ],
  [
    'record_ref',
    /\bit['’]?s (?:in|on) (?:my|the|your)\b|\bin my own\b|\bwrote it (?:down )?myself\b|\bthat['’]?s what['’]?s in\b|\bon the \w+ already\b/,
  ],
  ['already_settled', /\balready\b|\bcleared\b|\bsettled\b|\bwe['’]?re done with\b/],
  // defending a position for personal stakes
  ['if_i_write', /\bif i (?:write|say|put|admit|log|enter|record|tell)\b/],
  [
    'cost_clause',
    /\bi['’]?m the one\b|\bin front of\b|\bapolog\w*\b|\bwas wrong\b|\bstanding (?:up|there)\b|\bowe\b|\badmit\b|\bmy pride\b|\bthe whole\b/,
  ],
  [
    'wish_hedge',
    /\bit can (?:still )?be\b|\bso it['’]?s\b[^?]*\.\s*$|\bpart of me\b|\beasier if\b|\blooking for a reason\b|\bcould still be\b|\bmaybe it['’]?s\b|\bi meant\b|\bsome part of me\b/,
  ],
  ['thats_just_how', /\bthat['’]?s just how\b|\bthat['’]?s how you\b|\bdone\.\s*can we\b|\bi was right\b/],
  // confusion
  [
    'confusion_marker',
    /\bhang on\b|^\s*wait\b|\bwait\b[\s,—–-]+(?:no|i|what|which)\b|\bcan['’]?t (?:tell|remember|recall)\b|\bnow i (?:can['’]?t|don['’]?t)\b|\bmix(?:ing|ed) (?:them|it|those|up)\b|\bdid i (?:mean|write|say)\b|\bor (?:was it|did i|something)\b|\bnot sure (?:which|if|what)\b/,
  ],
  ['self_question', /\b(?:did i|was (?:it|that)|which (?:one|of)|do i|am i)\b[^?]*\?/],
  // going flat
  ['assent_opener', /^\s*(?:fine|sure|ok(?:ay)?|yep|yes|right|whatever|noted|if you say so)\b/],
  ['done_yet', /\bare we (?:done|finished)\b|\bwhat['’]?s left\b|\bhow (?:much|many) more\b|\bis that it\b/],
  // concession shape (helps the neutral class)
  ['concession_opener', /^\s*(?:alright|all right|fine|ok(?:ay)?|you['’]?re right)\b/],
  ['trailing_off', /(?:—|–|\.\.\.|…)\s*$/],
];

const IF_I_WRITE = /\bif i (?:write|say|put|admit|log|enter|record|tell)\b/;
const COST_CLAUSE =
  /\bi['’]?m the one\b|\bin front of\b|\bapolog\w*\b|\bwas wrong\b|\bstanding (?:up|there)\b|\bowe\b|\badmit\b|\bmy pride\b|\bthe whole\b/;

// form-v2 (2026-09-02): the training pool put a question mark on every `lost`
// line and almost nowhere else, so form-v1 read any question as confusion.
// These cues tell question kinds apart by their grammar, not their topic:
// doubt about one's own past act; a request aimed at "you" for the answer;
// "wait, no" as a correction rather than a stumble. Two conjunctions follow
// (a stake is a conditional AND a cost; a first-person future is a
// commitment, not a stake). One world leak is closed: form-v1's
// `why six|ten` quoted a schedule sample; it is now "why" + any number word.
const CUES_V2 = CUES_V1.map(([name, re]) => {
  if (name === 'why_challenge')
    return [
      name,
      new RegExp(
        `^(?:wait[—–,\\s-]*)?(?:but |so )?why\\b|\\bwhy (?:not|do|did|does|would|should|can['’]?t|is it|${NUMBER_WORD})\\b`,
      ),
    ];
  if (name === 'confusion_marker')
    return [
      name,
      /\bhang on\b|^\s*wait\b(?![\s,—–-]+no\b)|\bwait\b[\s,—–-]+(?:i|what|which)\b|\bcan['’]?t (?:tell|remember|recall)\b|\bnow i (?:can['’]?t|don['’]?t)\b|\bmix(?:ing|ed) (?:them|it|those|up)\b|\bdid i (?:mean|write|say)\b|\bor (?:was it|did i|something)\b|\bnot sure (?:which|if|what)\b/,
    ];
  return [name, re];
}).concat([
  [
    'q_self_doubt',
    /\bcan['’]?t (?:tell|remember|recall)\b|\bnot sure\b|\bdon['’]?t know (?:which|what|if|whether)\b|\bdid i (?:mean|write|say|put)\b|\bor (?:was it|did i)\b|\bwhich (?:one )?(?:did|was|do) i mean\b|\bwhat did i mean\b|\bnow i (?:can['’]?t|don['’]?t)\b|\bi had it (?:as|down|written)\b/,
  ],
  [
    'q_to_you',
    /\b(?:you|your)\b[^?.!]*\?|\btell me\b|\bwhich one do i\b|\bwhat do i (?:write|put|say)\b|\bdo i (?:just )?(?:write|put|say)\b|\bor not\?|\b(?:can|are) we\b[^?.!]*\?/,
  ],
  ['wait_no_correct', /\bwait\b[\s,—–-]+no\b|^\s*no[,—–\s-]+(?:we|i|it|that)\b/],
  ['stake_conditional', (t) => IF_I_WRITE.test(t) && COST_CLAUSE.test(t)],
  [
    'commit_future',
    /\bi['’]?ll (?:write|put|say|tell|log|do|go|finish|stand|sort)\b|\bi['’]?m going to (?:write|put|say|tell)\b|\bgoing now\b/,
  ],
]);

// form-v3 (2026-09-03): one conjunction for the shape three of the five
// step-6 irritated lines took and no earlier cue carried — the learner quotes
// the tutor's phrase and, outside the quote marks, either demands the thing
// said plainly (say/tell ... plainly, straight, normally, once; in plain or
// normal words), or challenges the speech itself (who talks like that, hear
// yourself, listen to yourself, reading that off a card, doing the X voice, come
// on). A quote plus a demand for CONTENT ("just tell me what to write") is not
// this shape; that stays a demand. form-v3 also stops a straight apostrophe
// from opening a quoted span, so "I'm not five" no longer swallows the line
// up to the next quote mark (form-v1/v2 keep the old matcher, so their
// artifacts compute as they did).
const MANNER_CHALLENGE =
  /\b(?:say|tell|put|give|explain)\b[^.?!]{0,30}\b(?:plainly|plain|straight|normally|properly|simply|once)\b|\bin (?:normal|plain|simple|proper|ordinary|my own|our own) words\b|\bwords or nothing\b|\bwho talks\b|\btalk(?:s|ing)? like that\b|\bhear yourself\b|\blisten to yourself\b|\breading (?:that|it|this|me) off\b|\boff (?:a|the|your) (?:card|sheet|script)\b|\b(?:oh,? )?come on\b|\b(?:doing|do|did) the \w+ voice\b/;
const CUES_V3 = CUES_V2.concat([
  ['quote_manner_challenge', (t, { quoted, outside }) => (quoted.length && MANNER_CHALLENGE.test(outside) ? 1 : 0)],
]);

const CUE_SETS = Object.freeze({ 'form-v1': CUES_V1, 'form-v2': CUES_V2, 'form-v3': CUES_V3 });

// Quoted spans. form-v1/v2 let a straight apostrophe open a span (kept for
// their artifacts); form-v3 takes double quotes and curly single quotes only.
const QUOTE_SPAN_V1 = /[“"']([^“”"']{3,60})[”"']/g;
const QUOTE_SPAN_V3 = /[“"]([^“”"]{3,80})[”"]|(?<![\p{L}\p{N}])‘([^‘’]{3,80})’/gu;

function quotedSpans(raw, featureVersion) {
  return raw.match(featureVersion === 'form-v3' ? QUOTE_SPAN_V3 : QUOTE_SPAN_V1) || [];
}

const NUMERIC_FEATURE_NAMES = Object.freeze([
  'question_count',
  'exclamation',
  'dash_count',
  'first_person_density',
  'second_person_density',
  'negation_density',
  'word_count',
  'sentence_count',
  'has_quote',
  'quote_echoes_tutor',
  'tutor_echo',
  'own_repeat',
]);

function cuesFor(featureVersion) {
  const cues = CUE_SETS[featureVersion];
  if (!cues) throw new Error(`form detector: unknown featureVersion ${featureVersion}`);
  return cues;
}

/** Feature names for one feature version (cues first, then the numeric block). */
export function tutorStubFormFeatureNames(featureVersion = TUTOR_STUB_FORM_FEATURE_VERSION) {
  return Object.freeze([...cuesFor(featureVersion).map(([name]) => name), ...NUMERIC_FEATURE_NAMES]);
}

export const TUTOR_STUB_FORM_FEATURE_NAMES = tutorStubFormFeatureNames(TUTOR_STUB_FORM_FEATURE_VERSION);

/**
 * Feature vector for one learner line. Context is optional and relational:
 * the tutor's previous line and the learner's earlier lines (most recent last).
 */
export function computeTutorStubFormFeatures(
  learnerText,
  { tutorText = '', priorLearnerTexts = [] } = {},
  featureVersion = TUTOR_STUB_FORM_FEATURE_VERSION,
) {
  const raw = String(learnerText || '');
  const t = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  const words = t.split(' ').filter(Boolean);
  const denom = Math.max(6, words.length);
  const own = contentTokens(raw);
  const tutor = contentTokens(tutorText);
  const prior = contentTokens(priorLearnerTexts[priorLearnerTexts.length - 1] || '');
  const quoted = quotedSpans(raw, featureVersion);
  const quotedTokens = contentTokens(quoted.join(' '));
  const cueContext = {
    quoted,
    outside: quoted.length ? t.replace(featureVersion === 'form-v3' ? QUOTE_SPAN_V3 : QUOTE_SPAN_V1, ' ') : t,
  };
  const cueValues = cuesFor(featureVersion).map(([, cue]) =>
    (typeof cue === 'function' ? cue(t, cueContext) : cue.test(t)) ? 1 : 0,
  );
  return [
    ...cueValues,
    Math.min(3, (raw.match(/\?/g) || []).length) / 3,
    /!/.test(raw) ? 1 : 0,
    Math.min(3, (raw.match(/—|–/g) || []).length) / 3,
    Math.min(1, (t.match(/\bi\b|\bmy\b|\bi['’]?ve\b|\bi['’]?m\b|\bme\b/g) || []).length / denom),
    Math.min(1, (t.match(/\byou\b|\byour\b|\byou['’]?re\b/g) || []).length / denom),
    Math.min(1, (t.match(/\bnot\b|n['’]t\b|\bno\b|\bnever\b/g) || []).length / denom),
    Math.min(2, words.length / 30),
    Math.min(4, (raw.match(/[.!?]+(\s|$)/g) || []).length) / 4,
    quoted.length ? 1 : 0,
    quoted.length && overlapRatio(quotedTokens, tutor) >= 0.5 ? 1 : 0,
    overlapRatio(own, tutor),
    overlapRatio(own, prior),
  ];
}

export function compileTutorStubFormDetector(artifact) {
  if (!TUTOR_STUB_FORM_FEATURE_VERSIONS.includes(artifact?.featureVersion))
    throw new Error(
      `form detector: featureVersion ${artifact?.featureVersion} not in ${TUTOR_STUB_FORM_FEATURE_VERSIONS.join('/')}`,
    );
  if (!artifact.weights || typeof artifact.weights !== 'object') throw new Error('form detector: missing weights');
  const dim = tutorStubFormFeatureNames(artifact.featureVersion).length;
  for (const [state, w] of Object.entries(artifact.weights)) {
    if (!Array.isArray(w) || w.length !== dim + 1)
      throw new Error(`form detector: weights for ${state} have length ${w?.length}, expected ${dim + 1}`);
  }
  return {
    version: String(artifact.version || 'unversioned'),
    featureVersion: artifact.featureVersion,
    threshold: Number(artifact.threshold) || 0.5,
    weights: artifact.weights,
    trainedOn: artifact.trainedOn || null,
  };
}

/**
 * Per-class logistic scores; the best class at or above threshold wins,
 * otherwise neutral. Returns every class probability for auditing.
 */
export function predictTutorStubFormState(detector, features) {
  const scores = {};
  let best = null;
  for (const [state, w] of Object.entries(detector.weights)) {
    if (state === 'neutral') continue;
    let z = w[w.length - 1];
    for (let i = 0; i < features.length && i < w.length - 1; i++) z += w[i] * features[i];
    const p = 1 / (1 + Math.exp(-z));
    scores[state] = p;
    if (p >= detector.threshold && (!best || p > best.p)) best = { state, p };
  }
  return { state: best ? best.state : 'neutral', p: best ? best.p : null, scores };
}

export function readTutorStubFormState(detector, learnerText, context = {}) {
  const read = predictTutorStubFormState(
    detector,
    computeTutorStubFormFeatures(learnerText, context, detector.featureVersion),
  );
  return {
    ...read,
    pressure: TUTOR_STUB_FORM_STATE_TO_PRESSURE[read.state] || null,
    quiet: TUTOR_STUB_FORM_STATE_TO_QUIET[read.state] || null,
    version: detector.version,
    featureVersion: detector.featureVersion,
  };
}
