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

const EVIDENTIAL_HANDOFF = /\b(?:supports?|supporting|points? to|indicates?|suggests?|is consistent with)\b/iu;

/**
 * Drop what an evidential verb governs. "The swab matches Larkin, so that
 * supports the incubator as the source that ruined the Corvat line" names the
 * verdict only as the thing the evidence points at — the learner reports a
 * relation between record and conclusion instead of stating the conclusion. A
 * claim matcher counts tokens, so without this the sentence reads as the
 * verdict itself.
 *
 * Kept deliberately narrow, in the shape of `assertedSide`: only the governed
 * span goes, and a later independent clause after a semicolon is read on its
 * own terms. That is what lets "Liane composed the nocturne; the dating and the
 * copybooks support it" still land — the verdict stands in its own clause there,
 * rather than only as the object of "support".
 */
function evidentialSide(sentence) {
  let kept = '';
  let rest = sentence;
  for (;;) {
    const marker = EVIDENTIAL_HANDOFF.exec(rest);
    if (!marker) return `${kept}${rest}`;
    kept += rest.slice(0, marker.index);
    const governed = rest.slice(marker.index + marker[0].length);
    const resumes = governed.indexOf(';');
    if (resumes === -1) return kept;
    rest = governed.slice(resumes);
  }
}

/**
 * Shapes that mark a sentence as short of a verdict, beyond what
 * `explicitlyWithholdsConclusion` already sees.
 *
 * Both come from the 2026-07-30 pilot, where a widened claim matcher closed two
 * dialogues on sentences that assert nothing. The first is a concession that
 * names what is still owed ("...though we still need evidence that G17 was what
 * contaminated the flasks"): the existing check only reads "but" before a
 * must/need, and a learner hedges with though, although, however and yet just as
 * readily. The second is epistemic status worn as an adjective — a "plausible
 * exposure route" is a candidate, not a finding.
 *
 * Deliberately absent: might, may, could. They hedge often enough, but they also
 * carry flat verdicts ("we may now conclude"), and this guard sits in front of a
 * closure decision where a false negative merely costs a turn.
 */
function hedgesClaim(text) {
  return (
    /\b(?:but|though|although|however|yet)\b[^.!?]{0,60}\b(?:must|needs?|needed|requires?|required|lacks?|lacking|awaits?|awaiting|missing|unproved|unproven)\b/iu.test(
      text,
    ) || /\b(?:plausible|possible|probable|likely|potential|speculative|hypothesis|candidate)\b/iu.test(text)
  );
}

/**
 * The learner's words with everything that is not a stated verdict removed.
 *
 * The authored-claim backstop reads a learner's utterance for the case verdict,
 * and four shapes carry every token of a claim while asserting none of it. A
 * question ("Did the hose cause the ceiling mark?") names the claim to ask about
 * it. A contrast ("...but not that it ruined the Corvat flasks") names it to
 * deny it. A concession ("...though we still need evidence") names it to say it
 * is not yet owed. An evidential handoff ("...supports G17 as what ruined the
 * line") names it as the thing the record points at rather than as a finding.
 * Every one of the four closed a pilot dialogue that should have stayed open, so
 * all four come off before the pattern is matched.
 *
 * What survives is joined, so a claim whose parts span two statements still
 * matches. An empty result means the learner said nothing assertive.
 *
 * `withoutQuotedNonClaims` reuses this as its arbiter, so the tutor-side leak
 * guard reads a quotation by the same four shapes.
 */
export function tutorStubAssertedClaimText(text) {
  return oneLine(text)
    .replace(/([.!?])[”"'’](?=\s)/gu, '$1 ')
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !sentence.endsWith('?'))
    .map((sentence) => evidentialSide(assertedSide(sentence)))
    .filter((sentence) => sentence.trim() && !explicitlyWithholdsConclusion(sentence) && !hedgesClaim(sentence))
    .join(' ');
}

const MARKED_QUOTATION = /[“"][^“”"]*[”"]/gu;

/**
 * Drop a marked quotation whose own words assert nothing.
 *
 * A tutor that opens by reading the learner's sentence back — `Your reading of
 * “Liane's presence in the copy-room makes her a possible maker of the folio
 * during that winter, but it provides no…” is the one I will answer now.` —
 * carries the answer name and the conclusion verb inside one span, which is the
 * shape a claim matcher counts. That killed a paid world_001_nocturne dialogue
 * at turn 16 on 2026-07-30: the model's draft and the deterministic fallback
 * both quoted the learner, so the guard rejected both and the run threw at 65
 * model calls.
 *
 * Quotation is not a blanket exemption, though. Echoing a learner's flat
 * unsupported claim does put the conclusion back in the record, which is why the
 * Tideway A2 fallback is held to be a leak. So the marks only frame the span;
 * the quoted words decide. `tutorStubAssertedClaimText` is the arbiter already
 * used on the learner's own turn: a hedged, questioned, denied or handed-off
 * quotation reduces to nothing and comes off, and a flat verdict survives inside
 * its marks and is still read as the speaker's own.
 *
 * Only balanced double marks count. An unpaired mark leaves the text alone,
 * because stripping to the end of a reply on one stray quote would blind the
 * guard to everything after it. Single marks are never read as quotation — in
 * this corpus `’` is an apostrophe far more often than a closing quote. A span
 * whose terminal punctuation sits inside the closing mark leaves a `.` behind,
 * so the sentence boundary the quotation carried survives and the frame does not
 * merge with what follows.
 */
function withoutQuotedNonClaims(text) {
  return text.replace(MARKED_QUOTATION, (span) => {
    if (tutorStubAssertedClaimText(span.slice(1, -1))) return span;
    return /[.!?][”"]$/u.test(span) ? '. ' : ' ';
  });
}

/**
 * Detect an asserted answer-linked conclusion rather than a negated,
 * provisional, or explicitly interrogated boundary. The answer name and the
 * conclusion vocabulary must occur in the same public sentence, on the asserted
 * side of any contrast, and outside any quotation whose own words assert
 * nothing. A following pronoun sentence is joined to preserve detection of
 * "Edony ... She struck".
 */
export function tutorStubAnswerConclusionAsserted({ text = '', answerTerm = '', wordPatterns = [] } = {}) {
  const sentences = withoutQuotedNonClaims(oneLine(text))
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
