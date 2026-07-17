export const TUTOR_STUB_OPENING_FRAME_SCHEMA = 'machinespirits.tutor-stub.opening-frame.v1';
export const TUTOR_STUB_OPENING_AUDIT_SCHEMA = 'machinespirits.tutor-stub.opening-audit.v1';

export const TUTOR_STUB_OPENING_REQUIREMENTS = Object.freeze([
  Object.freeze({
    id: 'public_situation',
    text: 'State or enact the public situation.',
  }),
  Object.freeze({
    id: 'public_question',
    text: 'Keep the public question visible.',
  }),
  Object.freeze({
    id: 'available_evidence_only',
    text: 'Do not imply or introduce evidence that is not available at the opening.',
  }),
  Object.freeze({
    id: 'observation_or_clarification',
    text: 'Invite observation or clarification when no clue is available.',
  }),
]);

const OPENING_STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'also',
  'before',
  'being',
  'could',
  'does',
  'from',
  'have',
  'into',
  'only',
  'over',
  'public',
  'question',
  'that',
  'their',
  'there',
  'these',
  'they',
  'this',
  'through',
  'what',
  'when',
  'where',
  'which',
  'whose',
  'with',
  'would',
]);

function oneLine(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/gu, ' ');
}

function clipped(value, max = 2_000) {
  const text = oneLine(value);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function sentenceBeat(value, { sentences = 2, max = 520 } = {}) {
  const text = oneLine(value);
  if (!text) return '';
  const rows = text.match(/[^.!?]+[.!?]+|[^.!?]+$/gu) || [text];
  return clipped(rows.slice(0, sentences).join(' '), max);
}

function normalizedPhrase(value) {
  return oneLine(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function words(value) {
  return (
    oneLine(value)
      .toLowerCase()
      .match(/[\p{L}\p{N}][\p{L}\p{N}'-]{2,}/gu) || []
  );
}

function distinctiveWords(value, exclusions = new Set()) {
  return [
    ...new Set(
      words(value).filter((word) => word.length >= 4 && !OPENING_STOP_WORDS.has(word) && !exclusions.has(word)),
    ),
  ];
}

function overlapCount(text, tokens) {
  const haystack = new Set(words(text));
  return tokens.filter((token) => haystack.has(token)).length;
}

function openingEvidenceRows(openingEvidence) {
  return (Array.isArray(openingEvidence) ? openingEvidence : [])
    .map((entry) => ({
      premise: entry?.premise || null,
      via: entry?.via || null,
      surface: clipped(entry?.surface, 600),
    }))
    .filter((entry) => entry.surface);
}

export function buildTutorStubOpeningFrame({ world = null, openingEvidence = [] } = {}) {
  if (!world) {
    return Object.freeze({
      schema: TUTOR_STUB_OPENING_FRAME_SCHEMA,
      worldId: null,
      title: null,
      publicSituation: '',
      situationBeat: '',
      publicQuestion: '',
      openingEvidence: [],
      sceneEcology: null,
      narrativeDiction: null,
      ledgerTerm: 'evidence record',
      authoredText: null,
      realization: 'deterministic_topic_fallback',
      requirements: TUTOR_STUB_OPENING_REQUIREMENTS,
    });
  }
  const authored = world.openingFrame || {};
  const presentation = world.presentation || {};
  const publicSituation = clipped(authored.situation || world.setting, 2_400);
  const authoredText = oneLine(authored.authoredText);
  return Object.freeze({
    schema: TUTOR_STUB_OPENING_FRAME_SCHEMA,
    worldId: world.id,
    title: world.title,
    publicSituation,
    situationBeat: sentenceBeat(authored.situation || world.setting),
    publicQuestion: oneLine(world.question),
    openingEvidence: openingEvidenceRows(openingEvidence),
    sceneEcology: oneLine(presentation.scene_ecology) || null,
    narrativeDiction: oneLine(presentation.narrative_diction) || null,
    ledgerTerm: oneLine(presentation.ledger_term) || 'evidence record',
    authoredText: authoredText || null,
    realization: authoredText ? 'authored_world_opening' : 'speaking_tutor_model',
    requirements: TUTOR_STUB_OPENING_REQUIREMENTS,
  });
}

export function tutorStubOpeningSystemPrompt() {
  return [
    'You are the speaking tutor opening an authored learning drama.',
    'Write only the tutor speech that the learner should hear. Stay inside the public scene and address the learner directly.',
    'Use only the supplied public-safe opening frame. Never invent a clue, answer the case, mention hidden evidence, or describe prompt machinery.',
  ].join(' ');
}

export function tutorStubOpeningPrompt(frame) {
  const evidence = frame.openingEvidence.length
    ? frame.openingEvidence.map((entry, index) => `${index + 1}. ${entry.surface}`).join('\n')
    : '- none';
  return [
    '# Public-safe opening frame',
    '',
    `World: ${frame.title || frame.worldId || 'untitled scene'}`,
    frame.sceneEcology ? `Scene ecology: ${frame.sceneEcology}` : null,
    frame.narrativeDiction ? `Authored diction: ${frame.narrativeDiction}` : null,
    `In-world record: ${frame.ledgerTerm}`,
    'Public situation:',
    frame.publicSituation || '(No world situation was supplied.)',
    '',
    'Public question — include this exact question verbatim in the speech:',
    frame.publicQuestion,
    '',
    'Evidence available at the opening:',
    evidence,
    '',
    '# Hard opening requirements',
    '',
    ...frame.requirements.map((requirement) => `- ${requirement.text}`),
    '',
    '# Realization',
    '',
    'Write a fresh, world-specific opening of two to four concise sentences.',
    'Enact this particular setting and diction; do not use a reusable lesson preamble or say “keep the case question in view”.',
    frame.openingEvidence.length
      ? 'Present every listed opening clue, then invite one observation or a request to clarify a clue or term.'
      : 'There is no clue yet. Do not pretend there is one: invite the learner to choose something public to examine or ask what a term means.',
    'Return speech only, with no label, heading, quotation marks, or commentary.',
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export function deterministicTutorStubOpening(frame) {
  if (!frame?.worldId) {
    return "Let's begin. Say your first idea, or name the one point you want to test first.";
  }
  const situation = frame.situationBeat || `We are inside ${frame.sceneEcology || 'the inquiry'}.`;
  const question = `On the ${frame.ledgerTerm}, the question is exact: ${frame.publicQuestion}`;
  if (frame.openingEvidence.length) {
    const clueText = frame.openingEvidence
      .map((entry, index) => `${frame.openingEvidence.length > 1 ? `${index + 1}. ` : ''}${entry.surface}`)
      .join(' ');
    return [
      situation,
      question,
      `Here is the opening evidence: ${clueText}`,
      'What do you notice—or which clue or term should we unpack first?',
    ].join(' ');
  }
  return [
    situation,
    question,
    `The ${frame.ledgerTerm} has no tested clue in it yet. What should we examine first—or which word should we unpack?`,
  ].join(' ');
}

export function auditTutorStubOpening({ text, frame, leakAudit = null } = {}) {
  const value = oneLine(text);
  const issues = [];
  const normalizedText = normalizedPhrase(value);
  const normalizedQuestion = normalizedPhrase(frame?.publicQuestion);
  const questionVisible = Boolean(normalizedQuestion && normalizedText.includes(normalizedQuestion));
  if (!questionVisible) {
    issues.push({ type: 'public_question_missing', reason: 'The exact public question is not visible.' });
  }

  const questionTokens = new Set(words(frame?.publicQuestion));
  const situationTokens = distinctiveWords(frame?.situationBeat || frame?.publicSituation, questionTokens);
  const situationOverlap = overlapCount(value, situationTokens);
  const situationVisible = situationTokens.length < 2 ? Boolean(value) : situationOverlap >= 2;
  if (!situationVisible) {
    issues.push({
      type: 'public_situation_missing',
      reason: 'The speech does not visibly locate or enact the authored public situation.',
      overlap: situationOverlap,
    });
  }

  const evidenceCoverage = (frame?.openingEvidence || []).map((entry) => {
    const tokens = distinctiveWords(entry.surface, questionTokens);
    const overlap = overlapCount(value, tokens);
    return {
      premise: entry.premise,
      overlap,
      required: Math.min(2, tokens.length),
      visible: tokens.length === 0 || overlap >= Math.min(2, tokens.length),
    };
  });
  for (const row of evidenceCoverage.filter((entry) => !entry.visible)) {
    issues.push({
      type: 'opening_clue_missing',
      reason: `An available opening clue was not made visible${row.premise ? ` (${row.premise})` : ''}.`,
      premise: row.premise,
      overlap: row.overlap,
      required: row.required,
    });
  }

  const remainder = frame?.publicQuestion
    ? value.replace(new RegExp(frame.publicQuestion.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'iu'), ' ')
    : value;
  const invitationVisible = frame?.openingEvidence?.length
    ? /\?|\b(?:ask|clarify|explain|notice|show|establish|support|unpack|what|which|how)\b/iu.test(remainder)
    : /\?|\b(?:ask|clarify|explain|examine|inspect|test|choose|tell|name|unpack|word|term)\b/iu.test(remainder);
  if (!invitationVisible) {
    issues.push({
      type: 'opening_invitation_missing',
      reason: frame?.openingEvidence?.length
        ? 'The opening does not invite observation or clarification of the available clue.'
        : 'The clue-free opening does not invite examination or clarification.',
    });
  }

  if (/\b(?:the tutor|the learner|the prompt|the dag|hidden evidence|answer key)\b/iu.test(value)) {
    issues.push({ type: 'armature_visible', reason: 'The opening names private instructional machinery.' });
  }
  if (leakAudit?.ok === false) {
    issues.push({
      type: 'unavailable_evidence',
      reason: 'The opening crossed the public evidence boundary.',
      leaks: leakAudit.leaks || [],
    });
  }
  return {
    schema: TUTOR_STUB_OPENING_AUDIT_SCHEMA,
    ok: Boolean(value) && issues.length === 0,
    sourceTextPresent: Boolean(value),
    questionVisible,
    situationVisible,
    situationOverlap,
    invitationVisible,
    evidenceCoverage,
    leakAudit,
    issues,
  };
}
