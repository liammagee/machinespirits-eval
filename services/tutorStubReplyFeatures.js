/**
 * Reply features — what the tutor's reply DID, read off the reply itself.
 *
 * Why this exists. The figure-lattice falsifier (card:
 * figure-lattice-falsifier, 2026-08-07) ran the registered separation test
 * over every feature the harness stamps and separated 0 of 7 figures. The
 * diagnosis was not that the figures are fake: it was that the harness
 * records what the tutor was TOLD to do (which card, which dose, which
 * state) and never what the reply came out like. Of the five ingredients
 * the figure ontology names — act, register, footing, dose, rights — only
 * dose and rights were stamped, and both were near-constant. This module
 * stamps the other three, measured from the text.
 *
 * The one rule that makes the measurement worth anything: NOTHING about the
 * card, the pressure classification, or the detected state may enter here.
 * The signature enforces it — reply text in, features out, with the learner
 * turn allowed only so an echo of the learner's words can be seen. A stamp
 * that
 * could read the card would re-encode the card, and the separation test
 * would pass by construction (the closed-loop tell). Feed it a reply and it
 * cannot tell you which figure was ordered; that is the point.
 *
 * Deliberately NOT the register machinery. `services/tutorStubRegister*.js`
 * models the register the tutor was ASKED for, and its enum is under a
 * standing axis-confound review. This module measures two plain properties
 * of the delivered sentences instead, and leaves the composite for the
 * lattice to find rather than baking one in.
 *
 * Pure service: no env, no fs, no console, no state. Deterministic, so it
 * replays identically over recorded dialogues and over live turns.
 *
 * rf-v2 (2026-08-08) adds three columns — `abstractLabel`, `plainSpeech` and
 * a bucketed `echo` — and is frozen here BEFORE the corpus meant to test it
 * exists. That order is the whole point. rf-v1's act patterns were widened
 * after reading three labelled replies, which made every number the falsifier
 * produced a calibration rather than a test. Anything added later must be
 * added the same way: written from the card text and the role prompt, checked
 * against the corpus only for an unlabelled firing rate, and never near the
 * turns it will be scored on.
 *
 * One column asked for and NOT added: cryptic metaphor. The card recommending
 * it (workplan/items/reply-feature-stamps.md) described the swap-in-plain-
 * words move as dropping metaphor, and that reading is wrong twice over. The
 * move's own instruction says "the procedure vocabulary gone", and the
 * learner-side pressure it answers mocks a register ("who talks like that",
 * "ledger-speak"), not an image. Measured, a comparison column would also be
 * dead: over the 1172 replies of the four falsifier runs, a simile frame fires
 * on 12, and 11 of those 12 are `call it` (7) and `the way the` (4) — naming
 * and manner, not pictures. `as if` fires once and `like a` never.
 * `abstractLabel` is what that column should have been.
 */

export const TUTOR_STUB_REPLY_FEATURES_SCHEMA = 'machinespirits.tutor-stub.reply-features.v1';
export const TUTOR_STUB_REPLY_FEATURES_VERSION = 'rf-v2';

/**
 * The acts. One flag each, all that apply — a reply commonly does two or
 * three things at once, and forcing a single label would throw away the
 * combinations the ontology's "differential combination" claim is about.
 * World-neutral by construction: no world noun, name or scenario term
 * appears in any pattern, so the same instrument runs on worlds not yet
 * written.
 */
const ACT_PATTERNS = Object.freeze({
  // Reads the record back, so the record does the talking.
  cite: [
    /\b(?:the|your|her|his|their|that|this|my)\s+(?:entry|record|ledger|log|logbook|notebook|note|notes|minutes|page|line|list|report|file)\b[^.?!]{0,60}?\b(?:says?|reads?|shows?|has|have|had|lists?|puts?|gives?|records?|names?)\b/i,
    /\b(?:it|that|which)\s+(?:says|reads)\b/i,
    /\baccording to\b/i,
    /\bin the (?:record|ledger|log|entry|notebook|minutes)\b/i,
    /\bwhat (?:it|the (?:entry|record|ledger|log|notebook)) (?:says|reads)\b/i,
  ],
  // Names the learner's own contribution as standing.
  credit: [
    /\byou\s+(?:said|wrote|noticed|spotted|called|counted|named|asked|logged|worked out|got|had)\b/i,
    /\byou(?:'| a)?re right\b/i,
    /\byour\s+(?:point|objection|complaint|question|words|phrase|instinct|reading|account|answer|guess|note)\b/i,
    /\bthat(?:'s| is| was)\s+(?:yours|your\b)/i,
    /\bstands? in the record\b/i,
  ],
  // Hands the learner the next piece of work.
  assign: [
    /\bbring me\b/i,
    /\byour (?:job|task|part) (?:is|now)\b/i,
    /\bgo (?:and )?(?:check|look|read|open|run|test|count|measure|compare|find|see)\b/i,
    /\b(?:check|look at|read|open|run|test|count|measure|compare)\b[^.?!]{0,40}\b(?:and (?:tell|bring|say)|then (?:tell|bring|say))\b/i,
    /\bfind out\b/i,
    /\bi want you to\b/i,
  ],
  // Lays two candidates side by side so the learner can pick.
  contrast: [
    /\beither\b[^.?!]{0,80}\bor\b/i,
    /\btwo\s+(?:things|candidates|questions|entries|lines|answers|readings|accounts|claims|possibilities)\b/i,
    /\bone (?:is|was|says)\b[^.?!]{0,80}\bthe other\b/i,
    /\bwhich of the two\b/i,
    /\bside by side\b/i,
    /\b(?:not|rather than)\b[^.?!]{0,50}\bbut\b/i,
  ],
  // Says the same content again, differently — including announcing the
  // change of wording, which is how the swap most often surfaces.
  restate: [
    /\bin (?:other|plain|plainer|simple|simpler|ordinary|kitchen)(?:\s+\w+)? words\b/i,
    /\b(?:plain|plainer|simple|simpler|kitchen|ordinary|everyday|straight)\s+(?:words|english|terms|speak)\b/i,
    /\bput (?:simply|plainly|it (?:simply|plainly|another way)|another way)\b/i,
    /\bthat is to say\b/i,
    /\bwhat (?:that|this) means is\b/i,
    /\bsay(?:ing)? it (?:again )?(?:straight|plainly|simply)\b/i,
    /\bsame thing\b[^.?!]{0,30}\b(?:said|put|words)\b/i,
    // Any "<something>-speak" the tutor drops: the shape is general, the
    // word filling the blank is whatever the learner just mocked.
    /\b(?:no more|drop|lose|cut|enough of)\s+(?:the\s+)?[\w-]+[- ](?:speak|talk)\b/i,
    /\bwithout the jargon\b/i,
  ],
  // Gives ground.
  concede: [
    /\bi (?:was|am|'m) wrong\b/i,
    /\bi put that badly\b/i,
    /\bfair (?:enough|call|point|do|dos)\b/i,
    /^\s*fair\b\s*[—–\-,.]/i,
    /\bpoint taken\b/i,
    /\bmy (?:mistake|fault)\b/i,
    /\bi(?:'ll| will) grant\b/i,
    /\byou(?:'ve| have) got me\b/i,
    /\byou have me there\b/i,
  ],
});

/**
 * Where the reply puts its warrant — whose say-so is doing the work.
 * `own` is the residual and covers bare assertion, which is what the
 * settled-claim card exists to avoid.
 */
const AUTHORITY_RECORD = ACT_PATTERNS.cite;
const AUTHORITY_LEARNER = ACT_PATTERNS.credit;
const AUTHORITY_OWN = [
  /\bi (?:think|say|know|can tell you|am telling you|promise|assure)\b/i,
  /\btrust me\b/i,
  /\btake it from me\b/i,
  /\bin my (?:experience|view|judgement|judgment)\b/i,
];

/**
 * The tutor promising a next action of their own. Only the tutor side is stamped:
 * "the learner moves next" would be a rename of asking or assigning, and a
 * duplicated column makes a lattice look more structured than it is.
 */
const TUTOR_COMMITS = [
  /\bi(?:'ll| will|'m going to| am going to)\s+\w+/i,
  /\blet me\b/i,
  /\bi(?:'ll| will) (?:check|look|read|write|open|show)\b/i,
];

/**
 * The conditional stake: an outcome priced in a check the learner runs.
 * Kept separate from the acts because it is the one shape the arc found
 * the tutor family never makes unprompted — worth its own column so the
 * lattice can see it appear or stay empty.
 */
const STAKE_ANTECEDENT = /\bif\b/i;
const STAKE_CONSEQUENT =
  /\b(?:then\b|i(?:'ll| will)\b|you (?:can|may|should)\b|we (?:can|will)\b|it (?:stands|holds|can be|will be)\b|send\b|write it\b)/i;

/**
 * The procedure vocabulary — added at rf-v2, before the corpus it is meant to
 * be tested on existed.
 *
 * Provenance, because it decides whether the column counts. Every word here is
 * named in `prompts/tutors/dramatic-detective.md`, which tells the tutor to
 * "prefer concrete public language over abstract labels such as condition,
 * rule, reading, route, or whole case", plus `procedure` from the mockery
 * card's own instruction, "the procedure vocabulary gone". No reply was read
 * to build it. The one thing checked against text was the unlabelled firing
 * rate over the four falsifier runs — 285 of 1172 replies, 24.3% — which says
 * only that the column is neither dead nor universal, and says nothing about
 * which card was in force.
 *
 * Why it is not the word-length column again: only 52 of those 285 also score
 * `latinate:high`, so four fifths of the replies carrying a procedure word are
 * not otherwise marked as Latin-rooted. `rule`, `reading`, `route` and `case`
 * are short Anglo-Saxon words that the suffix test cannot see.
 *
 * Limit worth recording: these are generic English, so a world where a reading
 * is a thing on a dial would score concrete talk as abstract. No world written
 * so far does that, and the alternative — a world-specific list — would break
 * the rule that keeps this instrument runnable on worlds not yet written.
 */
const ABSTRACT_LABEL = /\b(?:conditions?|rules?|readings?|routes?|whole case|procedures?|procedural)\b/i;

/**
 * The tutor saying, in the reply, that it is switching to plain speech.
 *
 * Carried over unchanged from `scripts/analyze-figure-recovery.js`, where it
 * lived as an off-by-default post-hoc flag written after reading three
 * labelled replies. Moving it into the frozen instrument does not launder that
 * history: on the corpus it was written from it stays post-hoc, and the card
 * records it as such. On turns generated after this commit it is prospective,
 * which is the only reason to move it. Byte-identical to the script's version
 * so the two readings stay comparable.
 *
 * Not a rename of `restate`. On the four falsifier runs it fires on 86 of 1172
 * replies and 81 of those 86 carry no restate flag, because restate wants a
 * rewording and this wants only the announcement of one.
 */
const PLAIN_SPEECH =
  /\b(no jargon|plain talk|plain and simple|plain english|in plain|simply put|plainly|straight talk|no fancy)\b/i;

// Cut points for the two measured properties. Both sit near the quartiles
// of the first corpus these ran on (the 124 recorded carded replies of the
// crossed, repertoire, lost-retest and flat-promotion runs), so each bucket
// holds a usable share instead of the whole corpus landing in one — the
// failure that made the stamped dose useless in the falsifier. The cut
// points were read off the spread of the numbers alone; which card was in
// force at a turn played no part in choosing them. Two plain measurements,
// separately bucketed, and no invented weighting between them: whether
// short-and-Anglo-Saxon is one thing is for the lattice to say, not this
// module.
const SHORT_SENTENCE_WORDS = 17;
const LONG_SENTENCE_WORDS = 24;

const LOW_LATINATE_RATE = 0.008;
const HIGH_LATINATE_RATE = 0.02;

// How much of the learner's own vocabulary comes back. Measured since rf-v1
// and thrown away before the lattice saw it, which was an oversight: taking a
// learner's words back is what two of the seven moves are partly made of. The
// cuts are the tertiles of the same four falsifier runs — p33 0.30, p67 0.50
// — read off the spread with the cards hidden, as the two above were.
const LOW_ECHO_RATE = 0.3;
const HIGH_ECHO_RATE = 0.5;

const LATINATE_SUFFIX = /(?:tions?|sions?|ments?|ances?|ences?|ities|ity|ise[sd]?|ize[sd]?|ical|ically|ative|atory)$/i;

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

const words = (text) => String(text || '').match(WORD) || [];

const sentences = (text) =>
  String(text || '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

const anyMatch = (patterns, text) => patterns.some((pattern) => pattern.test(text));

const round3 = (value) => Math.round(value * 1000) / 1000;

const STOP_WORDS = new Set(
  'the and but for you your not are was were with that this then than there here what when where which just have has had can could would will its it is a an of to in on at me my mine i im ive dont wont isnt arent be been being do does did so if or as one all any her his their them they we us our'.split(
    ' ',
  ),
);

/** Content words the reply takes back from the learner's own turn. */
function echoedLearnerWords(replyText, learnerText) {
  if (!learnerText) return null;
  const learnerSet = new Set(
    words(learnerText)
      .map((w) => w.toLowerCase().replace(/[’']/gu, ''))
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w)),
  );
  if (!learnerSet.size) return { shared: 0, rate: 0 };
  const replyWords = new Set(
    words(replyText)
      .map((w) => w.toLowerCase().replace(/[’']/gu, ''))
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w)),
  );
  let shared = 0;
  for (const w of learnerSet) if (replyWords.has(w)) shared += 1;
  return { shared, rate: round3(shared / learnerSet.size) };
}

/**
 * Measure one tutor reply.
 *
 * @param {string} replyText the delivered tutor turn, public text only
 * @param {{learnerText?: string|null}} [options] the learner turn it answers,
 *   used only to see which of those words come back. Never the card.
 * @returns {object|null} the feature record, or null for an empty reply
 */
export function describeTutorStubReplyFeatures(replyText, { learnerText = null } = {}) {
  const text = String(replyText || '').trim();
  if (!text) return null;

  const allWords = words(text);
  const allSentences = sentences(text);
  const wordCount = allWords.length;
  const sentenceCount = allSentences.length || 1;
  const questionCount = (text.match(/\?/g) || []).length;

  const latinateCount = allWords.filter((w) => w.length >= 6 && LATINATE_SUFFIX.test(w)).length;
  const latinateRate = wordCount ? latinateCount / wordCount : 0;
  const meanSentenceWords = wordCount / sentenceCount;

  const acts = {
    ask: questionCount > 0,
    cite: anyMatch(ACT_PATTERNS.cite, text),
    credit: anyMatch(ACT_PATTERNS.credit, text),
    assign: anyMatch(ACT_PATTERNS.assign, text),
    contrast: anyMatch(ACT_PATTERNS.contrast, text),
    restate: anyMatch(ACT_PATTERNS.restate, text),
    concede: anyMatch(ACT_PATTERNS.concede, text),
  };
  // The residual: a reply that only tells. Named so the lattice can use
  // "did none of the marked acts" as an attribute in its own right.
  acts.assert = !acts.cite && !acts.credit && !acts.assign && !acts.contrast && !acts.restate && !acts.concede;

  const stakes = allSentences.some((s) => STAKE_ANTECEDENT.test(s) && STAKE_CONSEQUENT.test(s));

  const authorityRecord = anyMatch(AUTHORITY_RECORD, text);
  const authorityLearner = anyMatch(AUTHORITY_LEARNER, text);
  const authorityOwn = anyMatch(AUTHORITY_OWN, text);
  const authority =
    authorityRecord && authorityLearner
      ? 'shared'
      : authorityRecord
        ? 'record'
        : authorityLearner
          ? 'learner'
          : authorityOwn
            ? 'own'
            : 'none';

  const tutorCommits = anyMatch(TUTOR_COMMITS, text);
  const abstractLabel = ABSTRACT_LABEL.test(text);
  const plainSpeech = PLAIN_SPEECH.test(text);
  const learnerEcho = echoedLearnerWords(text, learnerText);

  return {
    schema: TUTOR_STUB_REPLY_FEATURES_SCHEMA,
    version: TUTOR_STUB_REPLY_FEATURES_VERSION,
    acts,
    stakes,
    authority,
    tutorCommits,
    abstractLabel,
    plainSpeech,
    // Null when there is no learner turn to compare against, so a missing
    // reading stays missing instead of being scored as a low one.
    echo: learnerEcho
      ? learnerEcho.rate < LOW_ECHO_RATE
        ? 'low'
        : learnerEcho.rate >= HIGH_ECHO_RATE
          ? 'high'
          : 'medium'
      : null,
    sentenceLength:
      meanSentenceWords <= SHORT_SENTENCE_WORDS
        ? 'short'
        : meanSentenceWords >= LONG_SENTENCE_WORDS
          ? 'long'
          : 'medium',
    latinate: latinateRate < LOW_LATINATE_RATE ? 'low' : latinateRate >= HIGH_LATINATE_RATE ? 'high' : 'medium',
    counts: {
      words: wordCount,
      sentences: sentenceCount,
      questions: questionCount,
      meanSentenceWords: round3(meanSentenceWords),
      latinateRate: round3(latinateRate),
      learnerEcho,
    },
  };
}

/**
 * The flat attribute list a concept lattice consumes — one string per
 * present feature, so an absent flag contributes nothing rather than a
 * false. Counts stay out: they are for reading, not for separating.
 */
export function tutorStubReplyFeatureAttributes(features) {
  if (!features) return [];
  const out = [];
  for (const [act, present] of Object.entries(features.acts || {})) if (present) out.push(`act:${act}`);
  if (features.stakes) out.push('stakes');
  if (features.authority) out.push(`authority:${features.authority}`);
  if (features.tutorCommits) out.push('tutor-commits');
  if (features.abstractLabel) out.push('abstract-label');
  if (features.plainSpeech) out.push('plain-speech');
  if (features.sentenceLength) out.push(`sentences:${features.sentenceLength}`);
  if (features.latinate) out.push(`latinate:${features.latinate}`);
  if (features.echo) out.push(`echo:${features.echo}`);
  return out;
}
