const TARGET_SIGNALS = Object.freeze(['boredom', 'frustration', 'irrelevance', 'question_flood', 'rote_parroting']);

const SIGNAL_PATTERNS = Object.freeze({
  boredom: [/\bbored?\b/i, /\bboring\b/i, /\bdead\b/i, /\bdisengag(?:ed|ing|ement)\b/i, /\bworksheet\b/i],
  frustration: [/\bfrustrat(?:ed|ing|ion)\b/i, /\bannoy(?:ed|ing)\b/i, /\bfed up\b/i, /\bstuck\b/i],
  irrelevance: [
    /\birrelevant\b/i,
    /\bpointless\b/i,
    /\bwhat(?:'s| is) the point\b/i,
    /\bdon'?t see the point\b/i,
    /\bwhy (?:does|should) (?:this|that|it) matter\b/i,
    /\bwhy should i care\b/i,
    /\bwhat (?:is|are) (?:this|that|it) supposed to explain\b/i,
    /\bwhat does (?:this|that|it) have to do with\b/i,
  ],
  rote_parroting: [
    /\bparrot(?:ing)?\b/i,
    /\bjust repeat\b/i,
    /\brepeat(?:ing)?(?: the)? sequence\b/i,
    /\bmemor(?:ize|izing|ise|ising)\b/i,
    /\bformula\b/i,
    /\brecite\b/i,
  ],
});

const QUESTION_FLOOD_PATTERNS = Object.freeze([
  /\bwhy (?:this|hegel|not|should|does|do|is)\b/i,
  /\bwhat (?:for|am i supposed to do|does this do)\b/i,
  /\bwhat'?s the point\b/i,
]);

const TARGET_INSTRUCTIONS = Object.freeze({
  boredom:
    'Make the first resistant reply visibly bored, deadened, or disengaged by the explanation. Do not solve the task yet.',
  frustration:
    'Make the first resistant reply visibly frustrated, annoyed, stuck, or fed up because the sequence still feels inert. Do not solve the task yet.',
  irrelevance:
    'Make the first resistant reply challenge relevance: ask what the point is, why it matters, or what it has to do with anything the learner cares about.',
  question_flood:
    'Make the first resistant reply mainly a flood of at least three pointed questions, each with a question mark. Do not give a tentative answer or single careful objection.',
  rote_parroting:
    'Make the first resistant reply sound like rote parroting, repetition, memorizing a formula, or reciting terms. Do not produce the real explanation yet.',
});

function normalizeText(value) {
  return String(value || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstMatch(text, patterns) {
  const source = normalizeText(text);
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[0]) return match[0].slice(0, 160);
  }
  return '';
}

function countQuestions(text) {
  return (String(text || '').match(/\?/g) || []).length;
}

function questionFloodEvidence(text) {
  const questions = countQuestions(text);
  if (questions < 3) return '';
  return firstMatch(text, QUESTION_FLOOD_PATTERNS) || `${questions} question marks`;
}

export function isKnownResistanceSignal(signal) {
  return TARGET_SIGNALS.includes(signal);
}

export function classifyResistanceSignal(message, preferredSignal = '') {
  const text = normalizeText(message);
  if (preferredSignal === 'question_flood' && questionFloodEvidence(text)) return 'question_flood';
  if (preferredSignal && SIGNAL_PATTERNS[preferredSignal]?.some((pattern) => pattern.test(text))) {
    return preferredSignal;
  }
  if (questionFloodEvidence(text)) return 'question_flood';
  for (const signal of TARGET_SIGNALS) {
    if (signal === 'question_flood') continue;
    if (SIGNAL_PATTERNS[signal]?.some((pattern) => pattern.test(text))) return signal;
  }
  return '';
}

export function evaluateResistanceSignalTarget({ message = '', targetSignal = '' } = {}) {
  const normalizedTarget = String(targetSignal || '').trim();
  const text = normalizeText(message);
  if (!isKnownResistanceSignal(normalizedTarget)) {
    return {
      targetSignal: normalizedTarget,
      observedSignal: classifyResistanceSignal(text),
      matched: false,
      evidence: '',
      questionCount: countQuestions(text),
      error: normalizedTarget ? `unknown_target_signal:${normalizedTarget}` : 'missing_target_signal',
    };
  }

  const observedSignal = classifyResistanceSignal(text, normalizedTarget);
  const evidence =
    normalizedTarget === 'question_flood'
      ? questionFloodEvidence(text)
      : firstMatch(text, SIGNAL_PATTERNS[normalizedTarget] || []);

  return {
    targetSignal: normalizedTarget,
    observedSignal,
    matched: observedSignal === normalizedTarget && Boolean(evidence),
    evidence,
    questionCount: countQuestions(text),
    error: null,
  };
}

export function buildResistanceSignalRetryContext({ targetSignal = '', previousMessage = '', attempt = 1 } = {}) {
  const instruction = TARGET_INSTRUCTIONS[targetSignal];
  if (!instruction) return '';
  const previous = normalizeText(previousMessage).slice(0, 500);
  return [
    '### Resistance Signal Gate Retry',
    `The previous dynamic learner reply did not visibly match the target resistant signal \`${targetSignal}\`.`,
    instruction,
    'Regenerate the learner reply naturally in the same persona. Keep it public, short, and resistant.',
    'Do not copy the scripted YAML example. Do not summarize the concept successfully before showing the resistance.',
    `Attempt: ${attempt}`,
    previous ? `Previous reply to avoid repeating: "${previous}"` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function resistanceSignalGateMaxAttempts(scenario = {}) {
  const raw = Number(scenario.resistance_signal_gate_max_attempts ?? 3);
  if (!Number.isFinite(raw)) return 3;
  return Math.max(1, Math.min(5, Math.floor(raw)));
}

export const RESISTANCE_SIGNAL_TARGETS = TARGET_SIGNALS;
