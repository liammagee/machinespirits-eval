export const TUTOR_STUB_RESUME_HANDOFF_SCHEMA = 'machinespirits.tutor-stub.resume-handoff.v1';

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function clipAtWord(value, max, { preserveQuestion = false } = {}) {
  const text = oneLine(value);
  if (text.length <= max) return text;
  const available = Math.max(1, max - (preserveQuestion ? 2 : 1));
  const candidate = text.slice(0, available).trimEnd();
  const boundary = candidate.lastIndexOf(' ');
  const clipped = boundary >= Math.floor(available * 0.6) ? candidate.slice(0, boundary) : candidate;
  return `${clipped.replace(/[.!?,;:]+$/gu, '')}…${preserveQuestion ? '?' : ''}`;
}

function sentences(value) {
  const text = oneLine(value);
  if (!text) return [];
  return (text.match(/[^.!?]+(?:[.!?]+["'’”)]*|$)/gu) || [text]).map((sentence) => oneLine(sentence)).filter(Boolean);
}

function normalizedComparison(value) {
  return oneLine(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function terminalSurface(value, fallback = '.') {
  const text = oneLine(value);
  if (!text) return '';
  return /[.!?]["'’”)]*$/u.test(text) ? text : `${text}${fallback}`;
}

export function tutorStubResumeReprise(text, { max = 260 } = {}) {
  const parts = sentences(text);
  const latestQuestion = [...parts].reverse().find((sentence) => sentence.includes('?')) || '';
  if (latestQuestion) {
    return {
      kind: 'question',
      text: terminalSurface(clipAtWord(latestQuestion, max, { preserveQuestion: true }), '?'),
    };
  }
  const latestPoint = parts.at(-1) || oneLine(text);
  return latestPoint
    ? {
        kind: 'point',
        text: terminalSurface(clipAtWord(latestPoint, max)),
      }
    : null;
}

/**
 * Build a public, zero-model-call handoff for a restored dialogue. Every input
 * is already part of the public transcript or the world's public question;
 * proof state and completed turn count remain untouched.
 */
export function buildTutorStubResumeHandoff({ world = null, turns = [] } = {}) {
  const completedTurns = Array.isArray(turns) ? turns : [];
  const lastTurn = completedTurns.at(-1) || null;
  if (!lastTurn?.tutor) return null;

  const publicQuestion = terminalSurface(
    clipAtWord(world?.question || world?.publicQuestion || '', 220, { preserveQuestion: true }),
    '?',
  );
  const learnerPoint = clipAtWord(lastTurn.learner || '', 190);
  const reprise = tutorStubResumeReprise(lastTurn.tutor);
  const sameQuestion = Boolean(
    reprise?.kind === 'question' &&
    publicQuestion &&
    normalizedComparison(reprise.text) === normalizedComparison(publicQuestion),
  );

  const lines = ['Welcome back.'];
  if (publicQuestion && !sameQuestion) lines.push(`We were working on this question: ${publicQuestion}`);
  if (learnerPoint) lines.push(`You had just put this on the table: “${learnerPoint}”`);
  if (reprise) {
    if (sameQuestion) lines.push(`We were working on—and paused at—this question: ${reprise.text}`);
    else if (reprise.kind === 'question') lines.push(`We paused at this question: ${reprise.text}`);
    else lines.push(`We paused at this point: ${reprise.text}`);
  } else if (publicQuestion) {
    lines.push(`Let’s pick the question up again: ${publicQuestion}`);
  }

  return {
    schema: TUTOR_STUB_RESUME_HANDOFF_SCHEMA,
    text: lines.join(' '),
    sourceTurn: Number(lastTurn.turn) || completedTurns.length,
    sourceTurnId: lastTurn.turnId || null,
    publicQuestion: publicQuestion || null,
    learnerPoint: learnerPoint || null,
    repriseKind: reprise?.kind || (publicQuestion ? 'question' : 'none'),
    repriseText: reprise?.text || publicQuestion || null,
    publicTranscriptChanged: true,
    proofStateChanged: false,
  };
}

export default buildTutorStubResumeHandoff;
