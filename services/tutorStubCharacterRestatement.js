import { auditTutorStubEvidenceAssertions } from './tutorStubEvidenceAssertion.js';
import { cleanTutorStubStageSpeech } from './tutorStubStageSpeech.js';

export const TUTOR_STUB_CHARACTER_RESTATEMENT_SCHEMA = 'machinespirits.tutor-stub.character-restatement.v1';
export const TUTOR_STUB_CHARACTER_RESTATEMENT_AUDIT_SCHEMA = 'machinespirits.tutor-stub.character-restatement-audit.v1';
export const TUTOR_STUB_CHARACTER_RESTATEMENT_BRIDGE = 'Let me rephrase that.';

export const TUTOR_STUB_CHARACTER_RESTATEMENT_SYSTEM_PROMPT = [
  'You restate one already-public tutor utterance after its public speaking character changes.',
  'Preserve the pedagogical intent, evidence boundary, live question, and any quoted source text.',
  'Change only the realization of that intent into the requested current character.',
  'Never add evidence, a conclusion, a proof step, an answer, or private scene knowledge.',
  'Return public tutor speech only.',
].join(' ');

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizedComparisonText(value) {
  return oneLine(value)
    .toLowerCase()
    .replace(/^[“”"'‘’]+|[“”"'‘’]+$/gu, '')
    .replace(/[^\p{L}\p{N}?]+/gu, ' ')
    .trim();
}

function quotedSpans(value) {
  return [...String(value || '').matchAll(/[“"]([^”"]{4,})[”"]/gu)].map((match) => oneLine(match[1])).filter(Boolean);
}

export function buildTutorStubCharacterRestatementPrompt({
  previousText,
  characterId,
  characterLabel,
  characterContract,
  publicWorld,
} = {}) {
  return [
    '# Character restatement task',
    '',
    `Current character id: ${oneLine(characterId)}`,
    `Current character: ${oneLine(characterLabel || characterId)}`,
    'Current character contract:',
    oneLine(characterContract),
    '',
    '# Public learning setting',
    '',
    String(publicWorld || '').trim() || 'No structured learning world is active.',
    '',
    '# Previous tutor utterance',
    '',
    String(previousText || '').trim(),
    '',
    '# Output contract',
    '',
    `- Begin with exactly: ${TUTOR_STUB_CHARACTER_RESTATEMENT_BRIDGE}`,
    '- Then re-express the same pedagogical intent in the current character. Do not merely repeat the old wording.',
    '- Preserve the same public evidence, same claim or question, and every quoted source passage exactly.',
    '- Do not advance the lesson, release another clue, answer the question, or add a new inference.',
    '- Keep the active subject and its objects, concepts, texts, problems, methods, and standards in the foreground.',
    '- Legal, dramatic, and philosophical metaphors may be used only as subordinate aids, never as the teaching domain.',
    '- Use one brief bridge sentence followed by one compact restatement. Output speech only.',
  ].join('\n');
}

export function cleanTutorStubCharacterRestatement(text) {
  let cleaned = String(text || '')
    .replace(/^```(?:text|markdown)?\s*/iu, '')
    .replace(/\s*```$/u, '')
    .replace(/^\s*(?:tutor|teacher|character)\s*(?:↻|>)?\s*:\s*/iu, '')
    .trim();
  cleaned = cleanTutorStubStageSpeech(cleaned, { voice: 'tutor' });
  const withoutBridge = cleaned.replace(/^\s*let me rephrase that[.!:]?\s*/iu, '').trim();
  return withoutBridge
    ? `${TUTOR_STUB_CHARACTER_RESTATEMENT_BRIDGE} ${withoutBridge}`
    : TUTOR_STUB_CHARACTER_RESTATEMENT_BRIDGE;
}

export function auditTutorStubCharacterRestatement({ previousText, text, characterId, permittedText = '' } = {}) {
  const previous = oneLine(previousText);
  const candidate = oneLine(text);
  const body = candidate.replace(/^let me rephrase that[.!:]?\s*/iu, '').trim();
  const issues = [];
  const bridgePresent = candidate.startsWith(TUTOR_STUB_CHARACTER_RESTATEMENT_BRIDGE);
  if (!bridgePresent) {
    issues.push({ type: 'missing_restatement_bridge', reason: 'the public reset bridge is missing' });
  }
  if (!body) {
    issues.push({ type: 'empty_restatement', reason: 'the bridge is not followed by a restatement' });
  }
  if (normalizedComparisonText(body) === normalizedComparisonText(previous)) {
    issues.push({ type: 'verbatim_repetition', reason: 'the old utterance was repeated instead of re-realized' });
  }
  if (previous.includes('?') && !body.includes('?')) {
    issues.push({ type: 'live_question_lost', reason: 'the previous live question was not preserved as a question' });
  }
  const missingQuotedSpans = quotedSpans(previous).filter((span) => !candidate.includes(span));
  if (missingQuotedSpans.length) {
    issues.push({
      type: 'quoted_source_changed',
      reason: 'quoted public source text must be retained verbatim',
      missingQuotedSpans,
    });
  }
  if (/\b(?:the tutor|the learner|the prompt|the model|the policy|the dag|this dialogue)\b/iu.test(body)) {
    issues.push({ type: 'fourth_wall_break', reason: 'the restatement stepped outside the public learning scene' });
  }
  const evidenceAssertionAudit = auditTutorStubEvidenceAssertions({
    text: candidate,
    permittedText: [permittedText, previous].filter(Boolean).join('\n'),
  });
  issues.push(...evidenceAssertionAudit.issues);
  return {
    schema: TUTOR_STUB_CHARACTER_RESTATEMENT_AUDIT_SCHEMA,
    ok: issues.length === 0,
    characterId: oneLine(characterId) || null,
    bridgePresent,
    changedWording: normalizedComparisonText(body) !== normalizedComparisonText(previous),
    liveQuestionPreserved: !previous.includes('?') || body.includes('?'),
    quotedSourceCount: quotedSpans(previous).length,
    evidenceAssertionAudit,
    issues,
  };
}
