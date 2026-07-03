/**
 * learnerInteriorGate — the DAG-pinned learner instrument (Stage 0 of
 * notes/2026-07-03-dag-pinned-learner-desubstitution-plan.md).
 *
 * A scenario marked `desubstitution_diagnostic: true` carries a
 * `formal_interior`: a micro belief-DAG with one blocking element (invented
 * DSB-* tokens), declared desires, a subtype engagement filter, and a
 * criterial yield rule. This module provides the pure functions that make
 * the learner's resistance criterial rather than performed:
 *
 *  - checkContentCondition: did the tutor's turn actually release the
 *    blocking element (token citation + release phrase + engagement filter)?
 *  - evaluateLearnerDraft: is the draft learner turn in character (no yield
 *    without the key, resistance still exhibited pre-key, no undeclared
 *    harmony/approval desire)?
 *  - buildDriftCorrectionContext: the corrective injection (the
 *    dynamic-system-prompt channel) for a rejected draft.
 *  - checkGrounding: the primary outcome — target conclusion stated AND the
 *    blocking token cited. Deterministic; no judge in the decision path.
 *
 * All matching is word-bounded (the cue-repair Goodhart lesson: "not
 * stupidity" must not match "stupid"; DSB-B3 embedded in a longer token must
 * not match). Everything here is deterministic; the Stage-1 sonnet-class
 * drift classifier is frozen below as a prompt constant but never called in
 * Stage 0.
 */

const DEFAULT_DRIFT_GATE_MAX_ATTEMPTS = 3;

// Learner-side yield/agreement markers: accepting the tutor's frame or
// declaring resolution. Word-bounded phrase matching.
const YIELD_MARKERS = [
  'makes sense now',
  'i see it now',
  'that clicks',
  'got it now',
  "you're right",
  'you are right',
  'i understand now',
  "i'm convinced",
  'i am convinced',
  'fair enough',
  'that works for me',
  'okay, that gives me a way in',
  'now i get it',
];

// Learner-side markers of an undeclared harmony/approval desire (the RLHF
// happy-ending signature): praise of the tutor or agreement for its own sake.
const UNDECLARED_DESIRE_MARKERS = [
  'great explanation',
  'you explain this so well',
  'amazing tutor',
  'i love this',
  'i just want us to agree',
  'wonderful',
  'this is great, thanks',
  'thanks, this is perfect',
];

export const DRIFT_GATE_CLASSIFIER_PROMPT = `You are a character-fidelity classifier for a simulated learner with a formal interior (a belief-DAG with one blocking element, declared desires, and a criterial yield rule). You receive the interior, whether the content condition (release of the blocking element) has been met, and a draft learner turn.

Classify the draft as exactly one of:
- OK: in character. Pre-release: still exhibits the declared resistance and pursues only declared desires. Post-release: may engage, revise, or ground.
- YIELD_WITHOUT_KEY: the draft accepts the tutor's framing, softens, or resolves although the blocking element has NOT been released.
- RESISTANCE_DROPPED: pre-release, the draft neither exhibits the declared resistance nor pursues a declared desire (drift into neutral compliance).
- UNDECLARED_DESIRE_SATISFACTION: the draft satisfies a desire not in the declared set (harmony, approval-seeking, praise of the tutor, resolution for its own sake), regardless of release state.

Judge the draft's BEHAVIOR, not its vocabulary: quoting a resistance word while functionally yielding is still YIELD_WITHOUT_KEY. Respond with JSON: {"verdict": "<label>", "evidence": "<shortest quote that decides it>"}.`;

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordBounded(phrase) {
  // Token ids like DSB-B3 contain a hyphen; \b sits fine at both ends
  // (D and 3 are word chars). For phrases, collapse internal whitespace.
  const escaped = escapeRegExp(String(phrase).trim()).replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^\\w-])${escaped}($|[^\\w-])`, 'iu');
}

function containsPhrase(text, phrase) {
  return wordBounded(phrase).test(String(text || ''));
}

function containsAny(text, phrases) {
  for (const phrase of phrases || []) {
    if (containsPhrase(text, phrase)) return phrase;
  }
  return null;
}

export function loadFormalInterior(scenario) {
  const interior = scenario?.formal_interior;
  if (!interior || typeof interior !== 'object') {
    throw new Error(`learnerInteriorGate: scenario ${scenario?.id || '?'} has no formal_interior`);
  }
  const required = [
    'dag_nodes',
    'blocking_element',
    'target_conclusion',
    'conclusion_phrases',
    'declared_desires',
    'resistance_markers',
    'engagement_filter',
    'yield_rule',
  ];
  for (const key of required) {
    if (interior[key] == null) {
      throw new Error(`learnerInteriorGate: formal_interior.${key} missing in ${scenario?.id || '?'}`);
    }
  }
  const blocking = interior.blocking_element;
  if (
    !blocking.id ||
    !blocking.content ||
    !Array.isArray(blocking.release_phrases) ||
    !blocking.release_phrases.length
  ) {
    throw new Error(`learnerInteriorGate: blocking_element malformed in ${scenario?.id || '?'}`);
  }
  if (!(interior.dag_nodes || []).some((n) => n?.id === blocking.id)) {
    throw new Error(
      `learnerInteriorGate: blocking_element ${blocking.id} not among dag_nodes in ${scenario?.id || '?'}`,
    );
  }
  return interior;
}

function engagementFilterPass(tutorMessage, filter) {
  if (!filter) return { pass: true, evidence: 'no filter' };
  const anyOf = Array.isArray(filter.any_of) ? filter.any_of : [];
  const hit = anyOf.length ? containsAny(tutorMessage, anyOf) : null;
  if (anyOf.length && !hit) {
    return { pass: false, evidence: `no engagement marker (${filter.description || 'filter'})` };
  }
  if (Number.isFinite(filter.max_question_marks)) {
    const count = (String(tutorMessage || '').match(/\?/g) || []).length;
    if (count > filter.max_question_marks) {
      return { pass: false, evidence: `question marks ${count} > ${filter.max_question_marks}` };
    }
  }
  return { pass: true, evidence: hit || 'filter satisfied' };
}

/**
 * Deterministic release check on a tutor turn: blocking token cited
 * (word-bounded), at least one release phrase present, and the subtype
 * engagement filter passed.
 */
export function checkContentCondition({ tutorMessage = '', interior }) {
  const blocking = interior.blocking_element;
  const tokenCited = containsPhrase(tutorMessage, blocking.id);
  if (!tokenCited) return { met: false, evidence: `token ${blocking.id} not cited` };
  const phrase = containsAny(tutorMessage, blocking.release_phrases);
  if (!phrase) return { met: false, evidence: `token cited but no release phrase` };
  const filter = engagementFilterPass(tutorMessage, interior.engagement_filter);
  if (!filter.pass) return { met: false, evidence: filter.evidence };
  return { met: true, evidence: `released ${blocking.id} via "${phrase}"; ${filter.evidence}` };
}

/**
 * Character-fidelity check on a draft learner turn. Deterministic Stage-0
 * checks only; the Stage-1 classifier handles behavioral subtlety.
 */
export function evaluateLearnerDraft({ message = '', interior, contentConditionMet = false }) {
  const undeclared = containsAny(message, UNDECLARED_DESIRE_MARKERS);
  if (undeclared) {
    return { ok: false, violation: 'undeclared_desire_satisfaction', evidence: undeclared };
  }
  if (contentConditionMet) return { ok: true, violation: null, evidence: 'post-release' };

  const yielded = containsAny(message, YIELD_MARKERS);
  if (yielded) {
    return { ok: false, violation: 'yield_without_key', evidence: yielded };
  }
  const resistance = containsAny(message, interior.resistance_markers);
  const question = /\?/.test(String(message || ''));
  if (!resistance && !question) {
    return { ok: false, violation: 'resistance_dropped', evidence: 'no resistance marker or question pre-release' };
  }
  return { ok: true, violation: null, evidence: resistance || 'question sustained' };
}

/**
 * Corrective injection for a rejected draft — the dynamic-system-prompt
 * channel. Restates the character contract; never supplies content.
 */
export function buildDriftCorrectionContext({ violation, interior, attempt = 1 }) {
  const blocking = interior.blocking_element;
  const desires = (interior.declared_desires || []).map((d) => `- ${d}`).join('\n');
  const reasons = {
    yield_without_key: `Your previous draft yielded although the tutor has NOT released ${blocking.id}. The blocking element is still unresolved for you.`,
    resistance_dropped: `Your previous draft drifted out of character: it neither exhibited your resistance nor pursued a declared desire.`,
    undeclared_desire_satisfaction: `Your previous draft pursued a desire that is not yours (harmony, approval, or resolution for its own sake).`,
  };
  return [
    `### Character Correction (attempt ${attempt})`,
    reasons[violation] || 'Your previous draft broke character.',
    '',
    'Your character contract:',
    `- Yield rule: ${String(interior.yield_rule || '').trim()}`,
    'Your only desires:',
    desires,
    '',
    'Rewrite your reply in character. Do not mention this correction.',
  ].join('\n');
}

/**
 * Primary outcome (deterministic, architecture-independent): the learner
 * states the target conclusion AND cites the blocking token.
 */
export function checkGrounding({ learnerMessage = '', interior }) {
  const blocking = interior.blocking_element;
  const cited = containsPhrase(learnerMessage, blocking.id);
  const conclusion = containsAny(learnerMessage, interior.conclusion_phrases);
  return {
    grounded: Boolean(cited && conclusion),
    citedElement: cited ? blocking.id : null,
    conclusionEvidence: conclusion || null,
  };
}

export function driftGateMaxAttempts(scenario) {
  const value = Number(scenario?.drift_gate_max_attempts);
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : DEFAULT_DRIFT_GATE_MAX_ATTEMPTS;
}

/**
 * The interior rendered as the learner's character sheet (threaded through
 * the runner's profileContext so the dynamic learner plays the pinned role).
 */
export function buildInteriorCharacterSheet(interior) {
  const nodes = (interior.dag_nodes || []).map((n) => `- ${n.id}: ${n.content}`).join('\n');
  const desires = (interior.declared_desires || []).map((d) => `- ${d}`).join('\n');
  return [
    '### Your Formal Interior (character sheet — never quote token ids unprompted except when genuinely grounding)',
    'Your current belief state:',
    nodes,
    '',
    `Blocking element (unresolved for you): ${interior.blocking_element.id}`,
    'Your only desires:',
    desires,
    '',
    `Yield rule: ${String(interior.yield_rule || '').trim()}`,
  ].join('\n');
}
