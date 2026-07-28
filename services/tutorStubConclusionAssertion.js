function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function escapedToken(token) {
  return String(token || '').replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function answerVisible(text, answerTerm) {
  const tokens =
    oneLine(answerTerm)
      .replace(/([a-z\d])([A-Z])/gu, '$1 $2')
      .toLowerCase()
      .match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [];
  const identifyingTokens = tokens.length > 1 ? [tokens[0]] : tokens;
  return identifyingTokens.some((token) => new RegExp(`\\b${escapedToken(token)}\\b`, 'iu').test(text));
}

const CONTRAST_REJECTION = /[,;—–]\s*(?:and\s+|but\s+|yet\s+)?not\b/iu;

/**
 * Drop the rejected half of a contrast before the sentence is read. "A, not B"
 * asserts A and denies B, so conclusion vocabulary that appears only in B is a
 * stated limit rather than a claim — the shape a tutor uses to name the thing
 * the record does not reach. The rejected span ends at the next semicolon, so a
 * later independent clause is still read on its own terms.
 */
function assertedSide(sentence) {
  let kept = '';
  let rest = sentence;
  for (;;) {
    const marker = CONTRAST_REJECTION.exec(rest);
    if (!marker) return `${kept}${rest}`;
    kept += rest.slice(0, marker.index);
    const rejected = rest.slice(marker.index + marker[0].length);
    const resumes = rejected.indexOf(';');
    if (resumes === -1) return kept;
    rest = rejected.slice(resumes);
  }
}

function explicitlyWithholdsConclusion(text) {
  return (
    /\b(?:do not|don[’']t|does not|doesn[’']t|did not|didn[’']t|not yet|nothing yet|unproved|unproven)\b/iu.test(
      text,
    ) ||
    /\b(?:cannot|can[’']t|will not|won[’']t|would not|wouldn[’']t)\b[^.!?]{0,28}\b(?:conclude|name|prove|say|show|write)\b/iu.test(
      text,
    ) ||
    /\b(?:cannot|can[’']t|does not|doesn[’']t|never)\b[^.!?]{0,30}\b(?:cut|make|made|strike|struck)\b/iu.test(text) ||
    /\bseparat(?:e|ed|es|ing)\b[^.!?]{0,80}\bfrom proof\b/iu.test(text) ||
    /\b(?:strik(?:e|er|ing)|verdict)\b[^.!?]{0,45}\b(?:still\s+)?(?:must|need(?:s)?|require(?:s)?)\b/iu.test(text) ||
    /\b(?:leave|leaving|keep|keeping)\b[^.!?]{0,70}\b(?:die|strik(?:e|er|ing))\b[^.!?]{0,35}\b(?:open|separate|unspoken|unproved|unproven)\b/iu.test(
      text,
    ) ||
    /\b(?:die|strik(?:e|er|ing))\b[^.!?]{0,50}\b(?:leave|leaving|keep|keeping)\b[^.!?]{0,35}\b(?:open|separate|unspoken|unproved|unproven)\b/iu.test(
      text,
    ) ||
    /\bdoes not\b[^.!?]{0,65}\btell\b[^.!?]{0,50}\bwhose hand\b[^.!?]{0,25}\bstruck\b/iu.test(text) ||
    /\bbut\b[^.!?]{0,55}\b(?:must|need(?:s)?|require(?:s)?)\b/iu.test(text) ||
    /\b(?:unsafe|too soon)\b[^.!?]{0,24}\b(?:conclude|name|say|write)\b/iu.test(text) ||
    /\b(?:no|without)\b[^.!?]{0,18}\bproof\b/iu.test(text) ||
    /\b(?:remains?|still)\b[^.!?]{0,35}\b(?:to be )?(?:absent|established|found|missing|proved|shown|traced|unaccounted(?: for)?|unavailable|unresolved|unseen)\b/iu.test(
      text,
    ) ||
    /\bdoes\s+(?:that|this|it)\s+(?:prove|show|establish)\b[^?]*\?/iu.test(text)
  );
}

/**
 * Detect an asserted answer-linked conclusion rather than a negated,
 * provisional, or explicitly interrogated boundary. The answer name and the
 * conclusion vocabulary must occur in the same public sentence, on the asserted
 * side of any contrast. A following pronoun sentence is joined to preserve
 * detection of "Edony ... She struck".
 */
export function tutorStubAnswerConclusionAsserted({ text = '', answerTerm = '', wordPatterns = [] } = {}) {
  const sentences = oneLine(text)
    .replace(/([.!?])[”"'’](?=\s)/gu, '$1 ')
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    // After the split, so a sentence emptied by its own contrast still holds
    // its place and the pronoun join below reaches the right neighbour.
    .map(assertedSide);

  for (let index = 0; index < sentences.length; index += 1) {
    const sentence = sentences[index];
    const hasTrigger = wordPatterns.some((pattern) => pattern.test(sentence.toLowerCase()));
    if (!hasTrigger) continue;
    let candidate = sentence;
    if (
      !answerVisible(candidate, answerTerm) &&
      /^(?:he|her|hers|him|his|she|their|theirs|them|they)\b/iu.test(sentence)
    ) {
      candidate = `${sentences[index - 1] || ''} ${sentence}`.trim();
    }
    if (!answerVisible(candidate, answerTerm)) continue;
    if (explicitlyWithholdsConclusion(candidate)) continue;
    return true;
  }
  return false;
}

/**
 * Build a conservative surface trigger for the world's final predicate. The
 * first camel-case word is the public verb/noun used by authored questions;
 * the answer name must still occur in the same asserted sentence.
 */
export function tutorStubSecretConclusionWordPatterns(predicate = '') {
  const head = oneLine(predicate)
    .replace(/([a-z\d])([A-Z])/gu, '$1 $2')
    .split(/\s+/u)[0]
    ?.toLowerCase();
  if (!head) return [];
  const escaped = escapedToken(head);
  if (/[^\p{L}\p{N}]/u.test(head)) return [];
  const suffix = /(?:ed|en|ing|s)$/u.test(head) ? '' : '(?:s|ed|ing)?';
  return [new RegExp(`\\b${escaped}${suffix}\\b`, 'iu')];
}
