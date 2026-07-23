export const TUTOR_STUB_TURN_PROGRESSION_CONTRACT_SCHEMA = 'machinespirits.tutor-stub.turn-progression-contract.v1';
export const TUTOR_STUB_TURN_PROGRESSION_AUDIT_SCHEMA = 'machinespirits.tutor-stub.turn-progression-audit.v1';
export const TUTOR_STUB_LIVE_TURN_PROGRESSION_AUDIT_SCHEMA = 'machinespirits.tutor-stub.live-turn-progression-audit.v1';

const TOKEN_PATTERN = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
const QUESTION_PATTERN = /\?/u;
const WRITABLE_ENTRY_PATTERN =
  /\b(?:what|which)\b[^.!?]{0,55}\b(?:should|could|can|do)\s+i\s+(?:enter|record|say|write)\b|\b(?:give|tell|show) me\b[^.!?]{0,55}\b(?:entry|line|sentence|wording|words?)\b|\bhow (?:should|could|can|do) i (?:enter|record|say|write)\b|\b(?:what|which|how)\b[^.!?]{0,45}\b(?:should|could|can|do)\s+i\s+(?:add|include|note|put)\b[^.!?]{0,100}\bin (?:the )?(?:account|book|journal|ledger|log|minutes|notes?|record|register|trial[- ]?book)\b|\b(?:can|could|may|should|would)\s+i\s+(?:add|enter|include|note|put|record|write)\b[^.!?]{0,100}\b(?:in|into|on|to)\s+(?:the )?(?:account|book|journal|ledger|log|minutes|notes?|record|register|trial[- ]?book)\b/iu;
const GENERIC_WRITABLE_FOCUS_PATTERN =
  /^(?:what|which|how)\b[^.!?]{0,55}\b(?:enter|record|say|write)\b(?:\s+(?:next|now|down|in the .{0,30}))?\s*\??$/iu;
const ELLIPTICAL_OR_AFFECTIVE_SURFACE_PATTERN =
  /^(?:dunno|i (?:do not|don[’']t) know|not sure|sorry[,:]? what|what\??|huh\??|lost|i(?:[’']m| am) lost)\s*[.!?]*$|\b(?:move it along|slow down|speed (?:it|this) up|this is (?:boring|too slow)|let(?:[’']s| us) move)\b/iu;
const SEMANTIC_FOCUS_SIGNAL_PATTERN =
  /\b(?:affective|bored|boredom|clarif|confus|disengag|frustrat|lost|pace|speed|uncertain|unsure)\b/iu;
const BRIDGE_PATTERN =
  /\b(?:before (?:we|you|i)|first\b|to (?:answer|connect|decide|learn|reach|settle|show|test)|because\b|so (?:that|we|you)|which (?:bears on|connects|means|shows)|this (?:bears on|connects to|matters because)|that (?:bears on|connects to|matters because)|with (?:that|this) (?:answered|established|settled))\b/iu;
const RESPONSIVE_UPTAKE_PATTERN =
  /^(?:yes\b|no\b|right\b|fair\b|exactly\b|not quite\b|you (?:are asking|asked|mean|noticed|point(?:ed)? out|say|want)|your (?:claim|distinction|question|reading|reason|suggestion)|that (?:answer|claim|distinction|question|reading|reason|suggestion)|this (?:answer|claim|distinction|question|reading|reason|suggestion)|i (?:accept|answer|carry|credit|hear|keep|mark|record|see|take)|we (?:accept|carry|keep|mark|record|take))\b/iu;
const NO_QUESTION_ACTIONS = new Set([
  'answer_accountably',
  'close_inquiry',
  'compress_sayback',
  'reanchor_lived_stake',
  'reanchor_public_evidence',
  'receive_vulnerability',
]);
const liveSentenceSegmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
const FOCUS_STOP_WORDS = new Set([
  'a',
  'about',
  'after',
  'again',
  'also',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'because',
  'before',
  'but',
  'by',
  'can',
  'could',
  'did',
  'do',
  'does',
  'down',
  'enter',
  'for',
  'from',
  'give',
  'had',
  'has',
  'have',
  'how',
  'i',
  'in',
  'into',
  'is',
  'it',
  'its',
  'line',
  'me',
  'next',
  'not',
  'now',
  'of',
  'on',
  'only',
  'or',
  'record',
  'say',
  'sentence',
  'should',
  'show',
  'that',
  'the',
  'their',
  'them',
  'then',
  'this',
  'to',
  'us',
  'was',
  'were',
  'what',
  'when',
  'where',
  'which',
  'him',
  'who',
  'whose',
  'why',
  'will',
  'with',
  'wording',
  'words',
  'would',
  'write',
  'you',
  'your',
]);

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function exactAuthoredSourceSpans(text = '', authoredSourceTexts = []) {
  const source = String(text || '');
  return (Array.isArray(authoredSourceTexts) ? authoredSourceTexts : [])
    .flatMap((value) => {
      const needle = String(value || '');
      if (!needle) return [];
      const spans = [];
      let from = 0;
      while (from <= source.length - needle.length) {
        const start = source.indexOf(needle, from);
        if (start < 0) break;
        spans.push({ start, end: start + needle.length });
        from = start + needle.length;
      }
      return spans;
    })
    .sort((left, right) => left.start - right.start || left.end - right.end);
}

function hostQuestionPositions(text = '', authoredSourceTexts = []) {
  const source = String(text || '');
  const spans = exactAuthoredSourceSpans(source, authoredSourceTexts);
  const positions = [];
  for (let index = source.indexOf('?'); index >= 0; index = source.indexOf('?', index + 1)) {
    if (!spans.some((span) => index >= span.start && index < span.end)) positions.push(index);
  }
  return positions;
}

function normalizeToken(value) {
  const token = String(value || '')
    .toLowerCase()
    .replace(/[’']/gu, '')
    .replace(/(?:ies)$/u, 'y')
    .replace(/(?:ing|ed|es|s)$/u, (suffix) => (String(value || '').length - suffix.length >= 4 ? '' : suffix));
  return (
    {
      begin: 'start',
      confirmation: 'confirm',
      pacing: 'pace',
      proof: 'prove',
      slower: 'slow',
      suspicion: 'suspect',
    }[token] || token
  );
}

function contentTerms(value) {
  return [
    ...new Set(
      (oneLine(value).replace(/[_-]+/gu, ' ').match(TOKEN_PATTERN) || [])
        .map(normalizeToken)
        .filter((token) => token.length >= 3 && !FOCUS_STOP_WORDS.has(token)),
    ),
  ];
}

function predicateTerms(value) {
  return contentTerms(
    oneLine(value)
      .replace(/([\p{Ll}\d])([\p{Lu}])/gu, '$1 $2')
      .replace(/[_-]+/gu, ' '),
  );
}

function overlap(left = [], right = []) {
  const rightSet = new Set(right);
  return left.filter((token) => rightSet.has(token));
}

function substantiveLearnerUptake({ uptake = '', focusTerms = [], acceptedMeaning = '' } = {}) {
  const uptakeTerms = contentTerms(uptake);
  const requiredTerms = [...focusTerms, ...contentTerms(acceptedMeaning)];
  const matchedTerms = overlap(requiredTerms, uptakeTerms);
  const materiallyLinked = requiredTerms.length === 0 || matchedTerms.length > 0;
  return {
    uptakeTerms,
    requiredTerms,
    matchedTerms,
    materiallyLinked,
    visible:
      uptakeTerms.length >= 3 &&
      materiallyLinked &&
      (RESPONSIVE_UPTAKE_PATTERN.test(uptake) || matchedTerms.length > 0),
  };
}

function boundedPublicFocus(value, maxLength = 120) {
  const surface = oneLine(value)
    .replace(/[?]+/gu, '')
    .replace(/[.!]+$/gu, '')
    .trim();
  if (surface.length <= maxLength) return surface;
  const bounded = surface
    .slice(0, maxLength + 1)
    .replace(/\s+\S*$/u, '')
    .trim();
  return `${bounded || surface.slice(0, maxLength).trim()}…`;
}

function interrogativeUptake(value) {
  const text = oneLine(value);
  return (
    /\?/u.test(text) ||
    /^(?:what|which|who|whose|where|when|why|how|can|could|do|does|did|is|are|was|were|have|has|had|may|might|shall|should|will|would)\b/iu.test(
      text,
    )
  );
}

function realizeTurnProgressionUptakeVariants(quotedFocus) {
  return [
    `I keep your point about “${quotedFocus}” in view before we develop it.`,
    `I hear the focus: “${quotedFocus}”; that stays at the centre of this turn.`,
    `Your point about “${quotedFocus}” is the one I will answer now.`,
  ];
}

function trimQuotedFocusFragment(value) {
  const words = oneLine(value)
    .replace(/[\s,;:—–]+$/gu, '')
    .split(' ')
    .filter(Boolean);
  while (words.length && FOCUS_STOP_WORDS.has(normalizeToken(words.at(-1)))) words.pop();
  return words.join(' ').replace(/[\s,;:—–]+$/gu, '');
}

/**
 * Shrinking public sub-spans of the quoted focus, longest clause run first,
 * for realizing a bounded uptake when quoting the whole focus would repeat
 * the learner's substantive wording (the response-composition echo audit).
 */
function boundedQuotedFocusCandidates(focus) {
  const source = oneLine(focus);
  const candidates = [];
  const seen = new Set([source]);
  const push = (value) => {
    const fragment = trimQuotedFocusFragment(value);
    if (fragment && !seen.has(fragment)) {
      seen.add(fragment);
      candidates.push(fragment);
    }
  };
  const clauses = source
    .split(/\s*(?:[;:—–]|,)\s*|\s+(?:and|because|but|so|which|while)\s+/iu)
    .map(oneLine)
    .filter(Boolean);
  for (let end = clauses.length - 1; end >= 2; end -= 1) push(clauses.slice(0, end).join(', '));
  push(clauses[0] || '');
  const words = (clauses[0] || source).split(' ').filter(Boolean);
  for (const length of [10, 8, 6, 5, 4, 3]) {
    if (length < words.length) push(words.slice(0, length).join(' '));
  }
  return candidates;
}

/**
 * Preserve a deterministic acknowledgement only when it satisfies the same
 * typed learner-focus linkage as the live progression audit. If a generic
 * acknowledgement loses that focus, realize a bounded public-only uptake from
 * the compiled contract instead of weakening recognition. When the caller
 * supplies the delivery echo audit (`learnerEchoGuard`), the realized uptake
 * must also clear it: quoting the learner's whole surface back verbatim is a
 * `verbatim_learner_echo`, so the quoted focus is bounded to the longest
 * sub-span that keeps typed linkage without the echo.
 */
export function deterministicTutorStubTurnProgressionUptake({
  contract = null,
  defaultUptake = '',
  recentTutorTexts = [],
  variationKey = '',
  learnerEchoGuard = null,
} = {}) {
  const fallback = oneLine(defaultUptake);
  if (contract?.schema !== TUTOR_STUB_TURN_PROGRESSION_CONTRACT_SCHEMA || contract.complete !== true) {
    return fallback;
  }
  const focusTerms = contract.learner_uptake?.focus_terms || [];
  const acceptedMeaning = contract.learner_uptake?.accepted_meaning || '';
  const linkage = substantiveLearnerUptake({ uptake: fallback, focusTerms, acceptedMeaning });
  if (linkage.visible && !interrogativeUptake(fallback)) return fallback;

  const focus = boundedPublicFocus(
    contract.turn_focus_contract?.primary_surface || contract.learner_uptake?.learner_surface,
  );
  if (!focus) return fallback;
  const variants = realizeTurnProgressionUptakeVariants(focus);
  const variantIndex = (Array.isArray(recentTutorTexts) ? recentTutorTexts : []).filter(oneLine).length
    ? 1 + stableVariationIndex(variationKey, variants.length - 1)
    : 0;
  const echoes = (candidate) => typeof learnerEchoGuard === 'function' && learnerEchoGuard(candidate) === true;
  const visible = (candidate) => substantiveLearnerUptake({ uptake: candidate, focusTerms, acceptedMeaning }).visible;
  const candidate = variants[variantIndex];
  if (!echoes(candidate)) return visible(candidate) ? candidate : fallback;
  const bounded = boundedQuotedFocusCandidates(focus)
    .map((quotedFocus) => realizeTurnProgressionUptakeVariants(quotedFocus)[variantIndex])
    .find((row) => !echoes(row) && visible(row));
  return bounded || fallback;
}

function stableVariationIndex(value, count) {
  if (count <= 1) return 0;
  let hash = 2166136261;
  for (const character of String(value || '')) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % count;
}

function coverage(required = [], text = '') {
  if (!required.length) return { matched: [], count: 0, coverage: 1 };
  const matched = overlap(required, contentTerms(text));
  return {
    matched,
    count: matched.length,
    coverage: Number((matched.length / required.length).toFixed(3)),
  };
}

function semanticFocusCandidate(value = '') {
  return oneLine(value)
    .replace(
      /^(?:the\s+)?learner\s+(?:(?:asks?|requests?|signals?|says?|shows?|expresses?|wants?|needs?)\s+(?:that\s+|to\s+)?|(?:is|seems?)\s+)/iu,
      '',
    )
    .replace(/[?.!]+$/gu, '')
    .trim();
}

function focusSurface({ learnerText = '', responseCompositionFrame = null } = {}) {
  const learner = oneLine(learnerText);
  const move = responseCompositionFrame?.learner_move || {};
  const summary = semanticFocusCandidate(move.summary);
  const pedagogicalNeed = semanticFocusCandidate(move.pedagogical_need);
  const completion = responseCompositionFrame?.conversational_completion || null;
  const acceptedMeaning = completion?.resolved ? semanticFocusCandidate(completion.acceptedMeaning) : '';
  const writable = tutorStubLearnerRequestsWritableEntry(learner);
  if (writable && (GENERIC_WRITABLE_FOCUS_PATTERN.test(learner) || contentTerms(learner).length === 0) && summary) {
    return {
      surface: summary,
      source: 'learner_move_summary',
      semanticCandidates: {
        accepted_meaning: acceptedMeaning || null,
        summary: summary || null,
        pedagogical_need: pedagogicalNeed || null,
      },
    };
  }
  const typedSignals = [
    move.request_type,
    move.discourse_move,
    move.epistemic_stance,
    move.affect,
    move.pedagogical_need,
  ]
    .map(oneLine)
    .join(' ');
  if (
    !writable &&
    (Boolean(acceptedMeaning) ||
      ELLIPTICAL_OR_AFFECTIVE_SURFACE_PATTERN.test(learner) ||
      SEMANTIC_FOCUS_SIGNAL_PATTERN.test(typedSignals))
  ) {
    const selected = [
      [acceptedMeaning, 'conversational_completion'],
      [summary, 'learner_move_summary'],
      [pedagogicalNeed, 'pedagogical_need'],
    ].find(([surface]) => contentTerms(surface).length > 0);
    if (selected) {
      return {
        surface: selected[0],
        source: selected[1],
        semanticCandidates: {
          accepted_meaning: acceptedMeaning || null,
          summary: summary || null,
          pedagogical_need: pedagogicalNeed || null,
        },
      };
    }
  }
  return {
    surface: learner || summary,
    source: learner ? 'learner_surface' : 'learner_move_summary',
    semanticCandidates: {
      accepted_meaning: acceptedMeaning || null,
      summary: summary || null,
      pedagogical_need: pedagogicalNeed || null,
    },
  };
}

function focusGroups(surface = '') {
  const source = oneLine(surface)
    .replace(/^[\s\S]*?\babout\s+/iu, '')
    .replace(/[?.!]+$/gu, '');
  const pieces = source
    .split(/\s+(?:and|versus|vs\.?|to)\s+/iu)
    .map(oneLine)
    .filter(Boolean);
  const groups = pieces
    .map((piece) => ({ surface: piece, terms: contentTerms(piece) }))
    .filter((row) => row.terms.length);
  return groups.slice(0, 3);
}

function dueSurfaces({ responseCompositionFrame = null, dramaticReleaseFrame = null } = {}) {
  const frameSurfaces = Array.isArray(responseCompositionFrame?.due_evidence_surfaces)
    ? responseCompositionFrame.due_evidence_surfaces
    : [];
  const releaseSurfaces = Array.isArray(dramaticReleaseFrame?.entries)
    ? dramaticReleaseFrame.entries.map((entry) => entry?.surface)
    : [];
  return [...new Set([...frameSurfaces, ...releaseSurfaces].map(oneLine).filter(Boolean))];
}

function typedFocusRelation({ primaryTerms = [], dramaticReleaseFrame = null, publicFocusMapping = null } = {}) {
  const mapping = publicFocusMapping || null;
  const dueEntries = Array.isArray(dramaticReleaseFrame?.entries) ? dramaticReleaseFrame.entries : [];
  if (!mapping || !dueEntries.length) return { kind: 'unmapped', basis: null };
  if (mapping.relationship === 'direct' || mapping.relationship === 'sibling') {
    return { kind: mapping.relationship, basis: 'explicit_public_focus_mapping' };
  }
  const conclusionPredicates = Array.isArray(mapping.conclusion_predicates) ? mapping.conclusion_predicates : [];
  const conclusionGroups = conclusionPredicates.map(predicateTerms).filter((terms) => terms.length >= 2);
  const focusMatchesConclusion = conclusionGroups.some((terms) => terms.every((term) => primaryTerms.includes(term)));
  const mappedPremise = oneLine(mapping.premise_id);
  const mappedPredicate = oneLine(mapping.evidence_predicate);
  const dueMatchesInput = dueEntries.some((entry) => {
    const premiseMatches = mappedPremise && oneLine(entry?.premise) === mappedPremise;
    const predicateMatches = mappedPredicate && oneLine(entry?.fact?.[0]) === mappedPredicate;
    return premiseMatches || predicateMatches;
  });
  if (focusMatchesConclusion && dueMatchesInput) {
    return { kind: 'direct', basis: 'typed_world_rule' };
  }
  return { kind: 'unmapped', basis: 'typed_world_rule_ambiguous' };
}

export function tutorStubLearnerRequestsWritableEntry(value = '') {
  return WRITABLE_ENTRY_PATTERN.test(oneLine(value));
}

function chooseHandoffMode({
  writableEntryRequested = false,
  completion = null,
  due = [],
  dialogueClosureFrame = null,
  questionSupport = null,
  actionFamily = null,
} = {}) {
  if (dialogueClosureFrame?.mandatory === true) return 'closure';
  if (questionSupport?.responsiveRepairRequired === true) return 'direct_answer';
  if (completion?.resolved === true && due.length) return 'new_unresolved_check';
  if (completion?.resolved === true) return 'declarative_missing_support';
  if (writableEntryRequested && !due.length) return 'declarative_missing_support';
  if (questionSupport?.answerability === 'direction_only_until_evidence_is_public' && !due.length) {
    return 'declarative_missing_support';
  }
  if (due.length) return 'question_on_due_source';
  if (NO_QUESTION_ACTIONS.has(actionFamily)) return 'declarative_current_limit';
  return 'new_unresolved_check';
}

function handoffInstruction(contract) {
  const handoff = contract.handoff_contract;
  const focus = contract.turn_focus_contract;
  const target = focus.due_surfaces.length ? 'the due SOURCE' : 'TURN FOCUS';
  const settled = handoff.prohibited_settled_surfaces.length ? ' Do not reopen the settled point.' : '';
  const bridge = focus.sibling_relation_requires_explicit_bridge
    ? ' Explicitly connect SOURCE back to the learner’s requested relation.'
    : '';
  const question = handoff.question_required
    ? `HANDOFF alone asks one final question about ${target}.`
    : handoff.question_allowed
      ? `HANDOFF may ask one final question about ${target}; otherwise end declaratively.`
      : 'End declaratively; ask no question.';
  return `${question}${settled}${bridge}`.trim();
}

export function compileTutorStubTurnProgressionContract({
  learnerText = '',
  responseCompositionFrame = null,
  dramaticReleaseFrame = null,
  dialogueClosureFrame = null,
  questionSupport = null,
  actionFamily = null,
  tactic = null,
} = {}) {
  const completion = responseCompositionFrame?.conversational_completion || null;
  const focus = focusSurface({ learnerText, responseCompositionFrame });
  const primaryGroups = focusGroups(focus.surface);
  const primaryTerms = [...new Set(primaryGroups.flatMap((group) => group.terms))];
  const due = dueSurfaces({ responseCompositionFrame, dramaticReleaseFrame });
  const dueTerms = [...new Set(due.flatMap(contentTerms))];
  const writableEntryRequested = tutorStubLearnerRequestsWritableEntry(learnerText);
  const handoffMode = chooseHandoffMode({
    writableEntryRequested,
    completion,
    due,
    dialogueClosureFrame,
    questionSupport,
    actionFamily,
  });
  const questionAllowed = ['new_unresolved_check', 'question_on_due_source'].includes(handoffMode);
  const requiredTargetSurfaces = due.length && questionAllowed ? due : focus.surface ? [focus.surface] : [];
  const requiredTargetTerms = due.length && questionAllowed ? dueTerms : primaryTerms;
  const prohibitedSettledSurfaces = completion?.resolved
    ? [completion.sourceTutorQuestion, completion.acceptedMeaning].map(oneLine).filter(Boolean)
    : [];
  const focusRelation = typedFocusRelation({
    primaryTerms,
    dramaticReleaseFrame,
    publicFocusMapping: responseCompositionFrame?.public_focus_mapping,
  });
  const siblingBridgeRequired = due.length > 0 && focusRelation.kind === 'sibling';
  const contract = {
    schema: TUTOR_STUB_TURN_PROGRESSION_CONTRACT_SCHEMA,
    complete: Boolean(focus.surface || due.length || dialogueClosureFrame?.mandatory),
    public_only: true,
    learner_uptake: {
      required: Boolean(oneLine(learnerText)),
      mode: writableEntryRequested
        ? 'writable_entry'
        : completion?.resolved
          ? 'credit_or_qualify_resolved_move'
          : 'direct_response',
      learner_surface: oneLine(learnerText) || null,
      accepted_meaning: oneLine(completion?.acceptedMeaning) || null,
      focus_terms: primaryTerms,
      instruction: writableEntryRequested
        ? 'UPTAKE must answer the wording request directly with the licensed entry; it must not substitute another question.'
        : 'UPTAKE must visibly answer, credit, qualify, correct, or receive the learner’s actual move before development begins.',
    },
    turn_focus_contract: {
      primary_surface: focus.surface || null,
      primary_source: focus.source,
      raw_learner_surface: oneLine(learnerText) || null,
      semantic_focus_candidates: focus.semanticCandidates,
      primary_terms: primaryTerms,
      primary_groups: primaryGroups,
      due_surfaces: due,
      due_terms: dueTerms,
      sibling_relation_requires_explicit_bridge: siblingBridgeRequired,
      relation_kind: focusRelation.kind,
      relation_basis: focusRelation.basis,
      bridge_markers: ['before we', 'first', 'to answer', 'to connect', 'because', 'so that', 'which bears on'],
      instruction: focus.surface
        ? `Keep the learner’s requested focus primary: “${focus.surface}”. Do not silently replace its relation with a neighbouring one.`
        : 'Keep the current public relation primary; do not silently substitute a neighbouring relation.',
    },
    handoff_contract: {
      mode: handoffMode,
      question_allowed: questionAllowed,
      question_required: questionAllowed && (tactic === 'shared_scene_invitation' || due.length > 0),
      question_owner: questionAllowed ? 'handoff' : null,
      terminal_if_question: questionAllowed,
      required_target_surfaces: requiredTargetSurfaces,
      required_target_terms: requiredTargetTerms,
      prohibited_settled_surfaces: prohibitedSettledSurfaces,
      instruction: null,
    },
  };
  contract.handoff_contract.instruction = handoffInstruction(contract);
  return contract;
}

export function tutorStubTurnProgressionContractPrompt(contract = null) {
  if (contract?.schema !== TUTOR_STUB_TURN_PROGRESSION_CONTRACT_SCHEMA || contract.complete !== true) return '';
  return [
    '[Tutor-only turn progression contract]',
    `UPTAKE CONTRACT — ${contract.learner_uptake.instruction}`,
    `TURN FOCUS — ${contract.turn_focus_contract.instruction}`,
    `HANDOFF CONTRACT — ${contract.handoff_contract.instruction}`,
    '[End tutor-only turn progression contract]',
  ].join('\n');
}

function declarativeFallbackFocus(
  contract,
  { clarificationInvitationRequired = false, boundedChoiceRequired = false, publicObject = '' } = {},
) {
  const focus = contract?.turn_focus_contract || {};
  const uptake = contract?.learner_uptake || {};
  const surface = oneLine(focus.primary_surface || uptake.accepted_meaning || uptake.learner_surface);
  const terms = new Set([...(focus.primary_terms || []), ...(uptake.focus_terms || [])].map(normalizeToken));
  if (
    ['pace', 'slow', 'confus', 'overwhelm'].some((term) => terms.has(term)) ||
    /\b(?:slow down|one step at a time|overwhelm|confus)\b/iu.test(surface)
  ) {
    const object = oneLine(publicObject) || 'public record';
    if (boundedChoiceRequired) {
      return clarificationInvitationRequired
        ? `We will slow the pace: either begin with the ${object}, or ask me to unpack one word or connection before we take the next concrete step.`
        : `We will slow the pace: either begin with the ${object}, or hold there before the next concrete step.`;
    }
    return clarificationInvitationRequired
      ? 'You can ask me to unpack any word while we slow the pace and take one concrete public step at a time.'
      : 'We will slow the pace and take one concrete public step at a time.';
  }
  if (boundedChoiceRequired) {
    const object = oneLine(publicObject) || 'public record';
    const publicFocus = surface
      .replace(/^(?:expresses?|signals?|shows?)\s+(?:uncertainty|confusion)\s+(?:about|over)\s+/iu, '')
      .replace(/^(?:is|seems?)\s+(?:uncertain|unsure|confused)\s+(?:about|over)\s+/iu, '')
      .replace(/[?]+/gu, '')
      .replace(/[.!]+$/gu, '')
      .trim();
    const focus =
      publicFocus && !/^(?:not really sure|not sure|unsure|uncertain|confused)$/iu.test(publicFocus)
        ? publicFocus
        : `what the ${object} establishes`;
    return clarificationInvitationRequired
      ? `Choose one way forward: use the ${object} to decide ${focus}, or leave that reading open until another public fact arrives; you may also ask me to unpack one word or connection.`
      : `Choose one way forward: use the ${object} to decide ${focus}, or leave that reading open until another public fact arrives.`;
  }
  if (uptake.mode === 'writable_entry') {
    const ledger = surface.match(
      /\b(?:account|book|journal|ledger|log|minutes|notes?|record|register|trial-book)\b/iu,
    )?.[0];
    return ledger
      ? `The ${ledger} will carry only that supported public line for now.`
      : 'The record will carry only that supported public line for now.';
  }
  if (uptake.accepted_meaning) {
    return `We will carry this settled point forward: ${oneLine(uptake.accepted_meaning)
      .replace(/[?]+/gu, '')
      .replace(/[.!]+$/gu, '')}.`;
  }
  const focusObject = surface.match(
    /\b(?:badge log|call log|incident log|visitor log|trial-book|book|ledger|log|record|register|notice|report|file|photograph|photo|crucible|coin|shilling|tool|sample|lunchbox)\b/iu,
  )?.[0];
  if (focusObject) return `We will keep the ${focusObject} as the current public check.`;
  const boundedSurface = surface
    .replace(/[?]+/gu, '')
    .replace(/[.!]+$/gu, '')
    .trim();
  return boundedSurface
    ? `We will carry this point forward as stated: ${boundedSurface}.`
    : 'We will carry that public point forward as stated.';
}

function handoffTargetVisible(handoff, text) {
  const requiredTerms = handoff?.required_target_terms || [];
  if (!requiredTerms.length) return true;
  const target = coverage(requiredTerms, text);
  const minimumTargetCount = Math.min(2, requiredTerms.length);
  return (
    target.count >= minimumTargetCount && target.coverage >= Math.min(0.5, minimumTargetCount / requiredTerms.length)
  );
}

function contractAwareFallbackQuestion(contract, defaultQuestion) {
  const question = oneLine(defaultQuestion) || 'What does that public evidence change?';
  const handoff = contract?.handoff_contract || {};
  const dueSurfaces = contract?.turn_focus_contract?.due_surfaces || [];
  if (dueSurfaces.length || handoffTargetVisible(handoff, question)) return question;
  const targetSurface = oneLine(handoff.required_target_surfaces?.[0] || contract?.turn_focus_contract?.primary_surface)
    .replace(/[?]+/gu, '')
    .replace(/[.!]+$/gu, '')
    .trim();
  return targetSurface ? `What does that let us carry forward about “${targetSurface}”?` : question;
}

/**
 * Realize the compiled V1 handoff for deterministic recovery. This consumes
 * the same public progression contract as the speaking prompt; it does not
 * infer V2 slot spans or weaken the delivery audit.
 */
export function deterministicTutorStubTurnProgressionHandoff({
  contract = null,
  support = null,
  defaultQuestion = '',
  publicObject = '',
} = {}) {
  if (contract?.schema !== TUTOR_STUB_TURN_PROGRESSION_CONTRACT_SCHEMA || contract.complete !== true) {
    return oneLine(defaultQuestion);
  }
  if (contract.handoff_contract?.question_allowed === false) {
    return declarativeFallbackFocus(contract, {
      clarificationInvitationRequired: support?.clarificationInvitationRequired === true,
      boundedChoiceRequired: /bounded.*choice/u.test(String(support?.modality || '')),
      publicObject,
    });
  }
  return contractAwareFallbackQuestion(contract, defaultQuestion);
}

function compositionSlots(composition = null) {
  const slots = composition?.slots || {};
  return {
    uptake: oneLine(slots.uptake),
    performanceEntry: oneLine(slots.performance?.entry),
    performanceResponse: oneLine(slots.performance?.response),
    handoff: oneLine(slots.handoff),
  };
}

function reopensSettledPoint(question = '', surfaces = []) {
  const questionTerms = contentTerms(question);
  return surfaces.some((surface) => {
    const settledTerms = contentTerms(surface);
    if (!settledTerms.length || !questionTerms.length) return false;
    const shared = overlap(settledTerms, questionTerms).length;
    return (
      shared >= Math.min(2, settledTerms.length) && shared / Math.min(settledTerms.length, questionTerms.length) >= 0.55
    );
  });
}

export function auditTutorStubTurnProgression({ contract = null, composition = null } = {}) {
  const issues = [];
  if (contract?.schema !== TUTOR_STUB_TURN_PROGRESSION_CONTRACT_SCHEMA || contract.complete !== true) {
    return {
      schema: TUTOR_STUB_TURN_PROGRESSION_AUDIT_SCHEMA,
      active: true,
      ok: false,
      issues: [{ type: 'invalid_turn_progression_contract' }],
    };
  }
  const slots = compositionSlots(composition);
  const modelText = [slots.uptake, slots.performanceEntry, slots.performanceResponse, slots.handoff]
    .filter(Boolean)
    .join(' ');
  if (!modelText) {
    return {
      schema: TUTOR_STUB_TURN_PROGRESSION_AUDIT_SCHEMA,
      active: true,
      ok: false,
      issues: [{ type: 'missing_model_owned_composition' }],
    };
  }

  const uptakeLinkage = substantiveLearnerUptake({
    uptake: slots.uptake,
    focusTerms: contract.learner_uptake.focus_terms || [],
    acceptedMeaning: contract.learner_uptake.accepted_meaning,
  });
  const uptakeOverlap = uptakeLinkage.matchedTerms;
  const writableUptake =
    contract.learner_uptake.mode === 'writable_entry' &&
    /^Write:\s*[“"]/u.test(slots.uptake) &&
    uptakeLinkage.materiallyLinked;
  const responsiveUptake = contract.learner_uptake.mode === 'writable_entry' ? writableUptake : uptakeLinkage.visible;
  if (contract.learner_uptake.required && (!slots.uptake || !responsiveUptake)) {
    issues.push({
      type: 'learner_uptake_not_realized',
      owner: 'uptake',
      reason: 'the uptake slot does not visibly answer or carry the learner’s public move',
      matched_focus_terms: uptakeOverlap,
    });
  }

  const questionSlots = [
    ['uptake', slots.uptake],
    ['performance_entry', slots.performanceEntry],
    ['performance_response', slots.performanceResponse],
    ['handoff', slots.handoff],
  ].filter(([, text]) => QUESTION_PATTERN.test(text));
  const handoff = contract.handoff_contract;
  if (!handoff.question_allowed && questionSlots.length) {
    issues.push({
      type: 'question_forbidden_by_handoff_contract',
      owner: questionSlots.map(([id]) => id),
      reason: `handoff mode ${handoff.mode} is declarative`,
    });
  }
  if (handoff.question_allowed && questionSlots.some(([id]) => id !== handoff.question_owner)) {
    issues.push({
      type: 'question_in_non_owner_slot',
      owner: questionSlots.filter(([id]) => id !== handoff.question_owner).map(([id]) => id),
      required_owner: handoff.question_owner,
    });
  }
  if (handoff.question_required && !QUESTION_PATTERN.test(slots.handoff)) {
    issues.push({ type: 'required_handoff_question_missing', owner: 'handoff' });
  }
  if (handoff.terminal_if_question && QUESTION_PATTERN.test(slots.handoff) && !/\?(?:[”"'’])?$/u.test(slots.handoff)) {
    issues.push({ type: 'handoff_question_not_terminal', owner: 'handoff' });
  }
  for (const [owner, text] of questionSlots) {
    if (reopensSettledPoint(text, handoff.prohibited_settled_surfaces)) {
      issues.push({
        type: 'settled_point_requestioned',
        owner,
        reason: 'the question overlaps a point the learner has already resolved',
      });
    }
  }

  const target = coverage(handoff.required_target_terms, slots.handoff);
  const minimumTargetCount = Math.min(2, handoff.required_target_terms.length);
  if (
    handoff.required_target_terms.length &&
    (target.count < minimumTargetCount ||
      target.coverage < Math.min(0.5, minimumTargetCount / handoff.required_target_terms.length))
  ) {
    issues.push({
      type: 'handoff_loses_turn_focus',
      owner: 'handoff',
      required_target_surfaces: handoff.required_target_surfaces,
      matched_terms: target.matched,
      coverage: target.coverage,
    });
  }

  const focus = contract.turn_focus_contract;
  if (focus.sibling_relation_requires_explicit_bridge) {
    const bridgeText = `${slots.performanceResponse} ${slots.handoff}`;
    const primary = coverage(focus.primary_terms, bridgeText);
    const dueFocus = coverage(focus.due_terms, bridgeText);
    if (!BRIDGE_PATTERN.test(bridgeText) || primary.count === 0 || dueFocus.count === 0) {
      issues.push({
        type: 'sibling_relation_without_explicit_bridge',
        owner: ['performance_response', 'handoff'],
        primary_matched_terms: primary.matched,
        due_matched_terms: dueFocus.matched,
      });
    }
  }

  return {
    schema: TUTOR_STUB_TURN_PROGRESSION_AUDIT_SCHEMA,
    active: true,
    ok: issues.length === 0,
    issues,
    learner_uptake: {
      owner: 'uptake',
      mode: contract.learner_uptake.mode,
      visible: responsiveUptake,
      matched_focus_terms: uptakeOverlap,
    },
    handoff: {
      owner: 'handoff',
      mode: handoff.mode,
      question_owner: handoff.question_owner,
      target_coverage: target,
    },
  };
}

/**
 * Audit the plain-text live speaker without pretending that a V1 utterance has
 * the four model-owned slots available in the V2 structured replay path. The
 * existing response-composition audit supplies only a real uptake/development
 * boundary; question ownership and focus are therefore checked at the actual
 * terminal sentence boundary of the whole public response.
 */
export function auditTutorStubLiveTurnProgressionV1({
  contract = null,
  text = '',
  responseComposition = null,
  authoredSourceTexts = [],
} = {}) {
  const issues = [];
  if (contract?.schema !== TUTOR_STUB_TURN_PROGRESSION_CONTRACT_SCHEMA || contract.complete !== true) {
    return {
      schema: TUTOR_STUB_LIVE_TURN_PROGRESSION_AUDIT_SCHEMA,
      active: true,
      ok: false,
      scope: 'whole_response_terminal_boundary',
      slot_ownership_inferred: false,
      issues: [{ type: 'invalid_turn_progression_contract' }],
    };
  }
  const responseText = oneLine(text);
  const observedComposition = responseComposition?.segments || responseComposition || {};
  const uptake = oneLine(observedComposition?.uptake);
  const development = oneLine(observedComposition?.development);
  const sentences = [...liveSentenceSegmenter.segment(responseText)]
    .map((segment) => oneLine(segment.segment))
    .filter(Boolean);
  const terminalSurface = sentences.at(-1) || '';
  const questionPositions = hostQuestionPositions(responseText, authoredSourceTexts);
  const questionCount = questionPositions.length;
  const uptakeQuestionCount = hostQuestionPositions(uptake, authoredSourceTexts).length;
  const developmentQuestionCount = hostQuestionPositions(development, authoredSourceTexts).length;

  const uptakeLinkage = substantiveLearnerUptake({
    uptake,
    focusTerms: contract.learner_uptake.focus_terms || [],
    acceptedMeaning: contract.learner_uptake.accepted_meaning,
  });
  const uptakeOverlap = uptakeLinkage.matchedTerms;
  const requestedEntryAnswerRecognition = responseComposition?.requestedEntryAnswerRecognition || null;
  const writableUptake =
    contract.learner_uptake.mode === 'writable_entry' && requestedEntryAnswerRecognition?.recognized === true;
  const responsiveUptake = contract.learner_uptake.mode === 'writable_entry' ? writableUptake : uptakeLinkage.visible;
  if (contract.learner_uptake.required && (!uptake || !responsiveUptake)) {
    issues.push({
      type: 'learner_uptake_not_realized',
      owner: 'observed_uptake_segment',
      reason: 'the observed uptake does not substantively answer or carry the learner’s public move',
      matched_focus_terms: uptakeOverlap,
    });
  }

  const handoff = contract.handoff_contract;
  if (!handoff.question_allowed && questionCount > 0) {
    issues.push({
      type: 'question_forbidden_by_handoff_contract',
      owner: 'whole_response',
      reason: `handoff mode ${handoff.mode} is declarative`,
    });
  }
  if (handoff.question_allowed && uptakeQuestionCount > 0) {
    issues.push({
      type: 'question_outside_terminal_handoff',
      owner: 'observed_uptake_segment',
      reason: 'the V1 uptake asks a question before the terminal handoff boundary',
    });
  }
  if (questionCount > 1) {
    issues.push({
      type: 'multiple_questions_violate_terminal_handoff',
      owner: 'whole_response',
      question_count: questionCount,
    });
  }
  if (handoff.question_required && questionCount === 0) {
    issues.push({ type: 'required_handoff_question_missing', owner: 'terminal_sentence' });
  }
  if (
    handoff.terminal_if_question &&
    questionCount > 0 &&
    !/^[”"'’)\]]*\s*$/u.test(responseText.slice(questionPositions.at(-1) + 1))
  ) {
    issues.push({
      type: 'handoff_question_not_terminal',
      owner: 'whole_response',
      reason: 'the question is followed by more public speech',
    });
  }
  if (questionCount > 0 && developmentQuestionCount === 0) {
    issues.push({
      type: 'question_outside_terminal_handoff',
      owner: 'outside_observed_development_segment',
    });
  }
  if (questionCount > 0 && reopensSettledPoint(terminalSurface, handoff.prohibited_settled_surfaces)) {
    issues.push({
      type: 'settled_point_requestioned',
      owner: 'terminal_sentence',
      reason: 'the terminal question overlaps a point the learner has already resolved',
    });
  }

  // A terminal deictic question such as “What does that show?” is grounded
  // only when its immediately preceding public sentence carries the typed
  // target. V1 has no trustworthy HANDOFF slot span, so inspect that real
  // adjacent boundary instead of fabricating V2 ownership. Declarative endings
  // must still carry their own focus in the terminal sentence.
  const targetSurface =
    questionCount > 0 && handoff.question_owner === 'handoff' ? sentences.slice(-2).join(' ') : terminalSurface;
  const target = coverage(handoff.required_target_terms, targetSurface);
  const minimumTargetCount = Math.min(2, handoff.required_target_terms.length);
  if (
    handoff.required_target_terms.length &&
    (target.count < minimumTargetCount ||
      target.coverage < Math.min(0.5, minimumTargetCount / handoff.required_target_terms.length))
  ) {
    issues.push({
      type: 'handoff_loses_turn_focus',
      owner: 'terminal_sentence',
      required_target_surfaces: handoff.required_target_surfaces,
      audited_target_surface: targetSurface,
      matched_terms: target.matched,
      coverage: target.coverage,
    });
  }

  const focus = contract.turn_focus_contract;
  if (focus.sibling_relation_requires_explicit_bridge) {
    const primary = coverage(focus.primary_terms, development);
    const dueFocus = coverage(focus.due_terms, development);
    if (!BRIDGE_PATTERN.test(development) || primary.count === 0 || dueFocus.count === 0) {
      issues.push({
        type: 'sibling_relation_without_explicit_bridge',
        owner: 'observed_development_segment',
        primary_matched_terms: primary.matched,
        due_matched_terms: dueFocus.matched,
      });
    }
  }

  return {
    schema: TUTOR_STUB_LIVE_TURN_PROGRESSION_AUDIT_SCHEMA,
    active: true,
    ok: issues.length === 0,
    scope: 'whole_response_terminal_boundary',
    slot_ownership_inferred: false,
    issues,
    observed: {
      uptake,
      development,
      terminal_surface: terminalSurface,
      question_count: questionCount,
      uptake_question_count: uptakeQuestionCount,
      development_question_count: developmentQuestionCount,
      host_question_positions: questionPositions,
      authored_source_question_count: (responseText.match(/\?/gu) || []).length - questionPositions.length,
      handoff_focus_surface: targetSurface,
    },
    learner_uptake: {
      owner: 'observed_uptake_segment',
      mode: contract.learner_uptake.mode,
      visible: responsiveUptake,
      matched_focus_terms: uptakeOverlap,
      requested_entry_recognized: requestedEntryAnswerRecognition?.recognized === true,
    },
    handoff: {
      owner: 'terminal_sentence',
      mode: handoff.mode,
      question_owner: handoff.question_owner,
      target_coverage: target,
    },
  };
}
