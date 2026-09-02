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

import { TUTOR_STUB_PLANT_STATE_TO_PRESSURE } from './tutorStubMannerSwitch.js';

export const TUTOR_STUB_FORM_FEATURE_VERSION = 'form-v1';

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
export const TUTOR_STUB_FORM_STATE_TO_QUIET = Object.freeze({ bored: 'flat', lost: 'confused' });

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
const CUES = [
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

export const TUTOR_STUB_FORM_FEATURE_NAMES = Object.freeze([
  ...CUES.map(([name]) => name),
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

/**
 * Feature vector for one learner line. Context is optional and relational:
 * the tutor's previous line and the learner's earlier lines (most recent last).
 */
export function computeTutorStubFormFeatures(learnerText, { tutorText = '', priorLearnerTexts = [] } = {}) {
  const raw = String(learnerText || '');
  const t = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  const words = t.split(' ').filter(Boolean);
  const denom = Math.max(6, words.length);
  const own = contentTokens(raw);
  const tutor = contentTokens(tutorText);
  const prior = contentTokens(priorLearnerTexts[priorLearnerTexts.length - 1] || '');
  const quoted = raw.match(/[“"']([^“”"']{3,60})[”"']/g) || [];
  const quotedTokens = contentTokens(quoted.join(' '));
  const cueValues = CUES.map(([, re]) => (re.test(t) ? 1 : 0));
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
  if (artifact?.featureVersion !== TUTOR_STUB_FORM_FEATURE_VERSION)
    throw new Error(`form detector: featureVersion ${artifact?.featureVersion} != ${TUTOR_STUB_FORM_FEATURE_VERSION}`);
  if (!artifact.weights || typeof artifact.weights !== 'object') throw new Error('form detector: missing weights');
  const dim = TUTOR_STUB_FORM_FEATURE_NAMES.length;
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
  const read = predictTutorStubFormState(detector, computeTutorStubFormFeatures(learnerText, context));
  return {
    ...read,
    pressure: TUTOR_STUB_FORM_STATE_TO_PRESSURE[read.state] || null,
    quiet: TUTOR_STUB_FORM_STATE_TO_QUIET[read.state] || null,
    version: detector.version,
    featureVersion: detector.featureVersion,
  };
}
