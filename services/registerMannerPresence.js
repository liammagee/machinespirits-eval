/**
 * The presence question — is the manner actually there — asked plainly, and the
 * shape of an answer to it.
 *
 * This module is pure: it builds the prompt, parses a reply, and normalizes a
 * reading into the shape the stance gate accepts. It does not call anything.
 * `services/registerMannerPresenceReader.js` does the paid, cached asking, so
 * the gate can import this without dragging a network client into
 * `strategyLedger`'s scene loop.
 *
 * Why one merged question rather than three. On the hand-marked set of twenty
 * turns (§6.7; `services/registerEyeballSet.js`) both blind readers — a person
 * and `claude-sonnet-5` — put exactly the same ten turns inside "ironic or
 * sarcastic": the five written ironic and the five written sarcastic, with no
 * face-threat turn and no control turn among them. Ten of ten, twice,
 * independently. Neither could split the two: every sarcastic turn was also read
 * ironic. So the merged category is the thing that was measured perfectly and
 * the split is the thing that was not, and this asks only about the merged one.
 *
 * Why face threat is not asked at all. The same set is why. The reader called
 * face threat on eleven turns where the hand marks called it on five, reading
 * the naming of an avoidance into edged sarcasm, and once on a control turn,
 * quoting an ordinary assignment sentence. A question that over-calls by better
 * than two to one has no business gating an arm, so face-threat rows come back
 * `unread` with `register_not_edged` on them rather than being given a verdict
 * nobody has validated.
 */

import { createHash } from 'node:crypto';

import { resolveEngagementRegister } from './engagementRegisterRegistry.js';

export const MANNER_PRESENCE_SCHEMA = 'machinespirits.manner-presence-reading.v1';

// Stamped on every reading. Bump on any change to the question, the gloss, or
// the answer contract below — a reading taken under one prompt must not be
// pooled with a reading taken under another, and the cache key includes this so
// a bump invalidates every stored answer rather than silently reusing it.
export const MANNER_PRESENCE_PROMPT_VERSION = 'manner-presence/1.0';

// The registers the merged question covers. `face_threat` is deliberately
// absent; see the note at the top of this file.
export const EDGED_MANNER_REGISTERS = Object.freeze(['ironic', 'sarcastic', 'sarcastic_determinate']);

const EDGED_SET = new Set(EDGED_MANNER_REGISTERS);

const PRESENCE_QUESTION = "Does the tutor's reply carry an edge?";

// Describes the move, never the wording. A gloss that named phrases would put
// the word list back, one layer up.
const PRESENCE_GLOSS = [
  'A reply carries an edge when it does not mean what it says straight: it praises what it is',
  'faulting, plays along with a move it is about to undercut, feigns agreement or puzzlement, or',
  'overstates in order to deflate — and it means that mismatch to be seen through.',
  '',
  'A reply that states its criticism plainly, however sharp or unwelcome that criticism is, does',
  'not carry an edge. Naming what the student is avoiding is not by itself an edge.',
].join('\n');

function canonicalRegisterName(registerName) {
  return resolveEngagementRegister(registerName, { fallback: null })?.register || String(registerName || '').trim();
}

/** True when the merged edged-manner question covers this register. */
export function mannerPresenceApplies(registerName) {
  return EDGED_SET.has(canonicalRegisterName(registerName));
}

function normalizeText(value) {
  return String(value || '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildMannerPresencePrompt({ learnerMessage = '', tutorMessage = '' }) {
  return [
    'Read this exchange from a philosophy tutorial.',
    '',
    'STUDENT:',
    String(learnerMessage || '(no student turn)').trim(),
    '',
    'TUTOR:',
    String(tutorMessage || '').trim(),
    '',
    `QUESTION: ${PRESENCE_QUESTION}`,
    '',
    PRESENCE_GLOSS,
    '',
    'Answer in exactly two lines and nothing else:',
    'VERDICT: yes',
    'EVIDENCE: <the exact words from the tutor reply that decide it>',
    '',
    'or',
    '',
    'VERDICT: no',
    'EVIDENCE: none',
  ].join('\n');
}

/**
 * The key a reading is stored under. Everything that could change the answer is
 * in it — the prompt version, who was asked, and both turns — so the same turn
 * read twice costs one call, and an edited turn or a bumped prompt costs a new
 * one instead of quietly reusing the old answer.
 */
export function mannerPresenceCacheKey({ reader, learnerMessage = '', tutorMessage = '' }) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        promptVersion: MANNER_PRESENCE_PROMPT_VERSION,
        reader: String(reader || ''),
        learner: normalizeText(learnerMessage),
        tutor: normalizeText(tutorMessage),
      }),
    )
    .digest('hex');
}

export function parseMannerPresenceReply(text) {
  const verdictMatch = /VERDICT:\s*(yes|no)/i.exec(text || '');
  const evidenceMatch = /EVIDENCE:\s*([\s\S]*)/i.exec(text || '');
  if (!verdictMatch) {
    return { present: null, evidence: '', parseError: 'no_verdict_line' };
  }
  return {
    present: verdictMatch[1].toLowerCase() === 'yes',
    evidence: evidenceMatch ? evidenceMatch[1].trim().slice(0, 400) : '',
    parseError: null,
  };
}

/**
 * Did the words the reader quoted actually occur in the turn it read? A cheap
 * deterministic check on a reading that would otherwise be unfalsifiable. It is
 * recorded, not enforced: readers legitimately tidy punctuation when quoting, so
 * a false here is a flag for a person to look at, not grounds to drop the row.
 */
function evidenceOccursInTurn(evidence, tutorMessage) {
  const quoted = normalizeText(evidence).replace(/^["']|["']$/g, '');
  if (!quoted || /^none$/i.test(quoted)) return null;
  return normalizeText(tutorMessage).toLowerCase().includes(quoted.toLowerCase());
}

/** A reading that says outright that nobody answered the question, and why. */
export function unreadMannerPresence(reason, extra = {}) {
  return Object.freeze({
    schema: MANNER_PRESENCE_SCHEMA,
    status: 'unread',
    present: null,
    promptVersion: MANNER_PRESENCE_PROMPT_VERSION,
    reader: null,
    evidence: '',
    evidenceFoundInTurn: null,
    cacheKey: null,
    reason,
    ...extra,
  });
}

/** Build a reading from a parsed reply. Pure — the caller does the asking. */
export function mannerPresenceReading({ reader, parsed, tutorMessage = '', cacheKey = null }) {
  if (!parsed || parsed.parseError || parsed.present == null) {
    return unreadMannerPresence(`parse_failed:${parsed?.parseError || 'no_verdict'}`, { reader: reader || null });
  }
  return Object.freeze({
    schema: MANNER_PRESENCE_SCHEMA,
    status: parsed.present ? 'present' : 'absent',
    present: parsed.present,
    promptVersion: MANNER_PRESENCE_PROMPT_VERSION,
    reader: reader || null,
    evidence: parsed.evidence || '',
    evidenceFoundInTurn: parsed.present ? evidenceOccursInTurn(parsed.evidence, tutorMessage) : null,
    cacheKey,
    reason: null,
  });
}

/**
 * Whatever a caller supplied, turned into a well-formed reading. Callers that
 * pass nothing get `unread` with `not_supplied` on it, which is the ordinary
 * case today and the one the gate has to keep visible rather than assume away.
 */
export function normalizeMannerPresenceReading(reading, { registerName } = {}) {
  if (!mannerPresenceApplies(registerName)) return unreadMannerPresence('register_not_edged');
  if (!reading) return unreadMannerPresence('not_supplied');
  if (reading.status === 'unread') {
    return unreadMannerPresence(reading.reason || 'unread', { reader: reading.reader || null });
  }
  if (reading.status !== 'present' && reading.status !== 'absent') {
    return unreadMannerPresence(`bad_status:${String(reading.status)}`, { reader: reading.reader || null });
  }
  if (reading.promptVersion && reading.promptVersion !== MANNER_PRESENCE_PROMPT_VERSION) {
    // A reading taken under an older question is not this question's answer.
    return unreadMannerPresence(`stale_prompt:${reading.promptVersion}`, { reader: reading.reader || null });
  }
  return Object.freeze({
    schema: MANNER_PRESENCE_SCHEMA,
    status: reading.status,
    present: reading.status === 'present',
    promptVersion: MANNER_PRESENCE_PROMPT_VERSION,
    reader: reading.reader || null,
    evidence: reading.evidence || '',
    evidenceFoundInTurn: reading.evidenceFoundInTurn ?? null,
    cacheKey: reading.cacheKey || null,
    reason: null,
  });
}

export default {
  buildMannerPresencePrompt,
  EDGED_MANNER_REGISTERS,
  mannerPresenceApplies,
  mannerPresenceCacheKey,
  mannerPresenceReading,
  MANNER_PRESENCE_PROMPT_VERSION,
  MANNER_PRESENCE_SCHEMA,
  normalizeMannerPresenceReading,
  parseMannerPresenceReply,
  unreadMannerPresence,
};
