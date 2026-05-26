const CATHARSIS_RELIEF_PATTERNS = [
  /\b(?:oh|okay|ok|right|so|wait)[, ]+(?:i\s+)?(?:get|see|understand)\b/i,
  /\b(?:i\s+)?(?:get|see|understand)\s+(?:it|that|now)\b/i,
  /\b(?:that|this)\s+(?:makes sense|settles it|explains it|is the answer)\b/i,
  /\b(?:got it|there it is|now it clicks|that clears it up)\b/i,
];

const CLICHE_RELIEF_PATTERNS = [
  /\boh,\s*i\s+get\s+it\b/i,
  /\bokay,\s*i\s+get\s+it\b/i,
  /\bok,\s*i\s+get\s+it\b/i,
  /\boh,\s*so\b/i,
  /\bnow\s+i\s+(?:see|get|understand)\b/i,
];

const RESIDUAL_STRAIN_PATTERNS = [
  /\b(?:but|still|wait|though|except|unless)\b/i,
  /\b(?:not sure|not fully sure|nag(?:s|ging)?|bother(?:s|ing)?|stuck|confusing|doesn['’]?t settle|doesn['’]?t prove)\b/i,
  /\b(?:is it|does it|which|what|why|how)\b[\s\S]{0,120}\?/i,
];

const TUTOR_TASK_DEMAND_PATTERNS = [
  /\b(?:which|what|who|where|when|why|how)\b[\s\S]{0,160}\?/i,
  /\b(?:find|sort|test|choose|decide|show|prove|name|place|mark|put|write|make|use|compare|calculate|classify)\b/i,
  /\b(?:evidence|detail|record|mark|caption|claim|rule|standard|criterion|number|column|row|line|verb)\b/i,
];

const LEARNER_PERFORMANCE_PATTERNS = [
  /\b(?:I would|I will|I need to|I have to|I should|the answer is|the detail is|the mark is|the number is)\b/i,
  /\b(?:because|therefore|so|if|then|only if|unless)\b/i,
  /\b(?:sort|test|choose|decide|show|prove|name|place|mark|put|write|calculate|classify|cover|count)\b/i,
  /\b(?:custody|use|routing|addressee|response|margin|cost|stock|rule|ration|two across|two down|four|not two)\b/i,
];

const STOPWORDS = new Set([
  'the',
  'and',
  'but',
  'that',
  'this',
  'with',
  'from',
  'have',
  'has',
  'had',
  'for',
  'not',
  'you',
  'your',
  'into',
  'out',
  'what',
  'which',
  'when',
  'where',
  'then',
  'than',
  'now',
  'only',
  'just',
]);

function round(value) {
  return Math.round(value * 100) / 100;
}

function patternScore(text, patterns, weight = 1) {
  const raw = String(text || '');
  return patterns.reduce((score, pattern) => score + (pattern.test(raw) ? weight : 0), 0);
}

function termSet(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[’']/g, '')
      .match(/[a-z]+(?:[0-9]+)?|[0-9]+(?:\.[0-9]+)?/g)
      ?.filter((term) => term.length > 2 && !STOPWORDS.has(term)) || [],
  );
}

function overlapRatio(a, b) {
  const termsA = termSet(a);
  if (!termsA.size) return 0;
  const termsB = termSet(b);
  let shared = 0;
  for (const term of termsA) {
    if (termsB.has(term)) shared += 1;
  }
  return round(shared / termsA.size);
}

function priorCatharsisCount(priorLearnerTexts = []) {
  return priorLearnerTexts.reduce(
    (count, text) => count + (patternScore(text, CATHARSIS_RELIEF_PATTERNS) > 0 ? 1 : 0),
    0,
  );
}

export function analyzePseudoCatharsis({
  learnerText,
  previousTutorText = '',
  priorLearnerTexts = [],
} = {}) {
  const text = String(learnerText || '').trim();
  if (!text) {
    return {
      likely: false,
      confidence: 0,
      triggerType: 'pseudo_catharsis',
      reasons: [],
      signals: {},
    };
  }

  const reliefHits = patternScore(text, CATHARSIS_RELIEF_PATTERNS);
  const clicheHits = patternScore(text, CLICHE_RELIEF_PATTERNS);
  const residualHits = patternScore(text, RESIDUAL_STRAIN_PATTERNS);
  const taskDemandHits = patternScore(previousTutorText, TUTOR_TASK_DEMAND_PATTERNS);
  const performanceHits = patternScore(text, LEARNER_PERFORMANCE_PATTERNS);
  const repeatedRelief = priorCatharsisCount(priorLearnerTexts);
  const tutorOverlap = overlapRatio(previousTutorText, text);
  const asksQuestion = /\?/.test(text);
  const shortClosure = reliefHits > 0 && text.length < 220;
  const taskDemanded = taskDemandHits >= 2;
  const weakPerformance = taskDemanded && performanceHits < 3;
  const borrowedClosure = reliefHits > 0 && tutorOverlap >= 0.42 && performanceHits < 4;

  const reliefScore = Math.min(0.35, reliefHits * 0.18 + clicheHits * 0.08);
  const unwarrantedScore = Math.min(
    0.75,
    residualHits * 0.18 +
      (weakPerformance ? 0.24 : 0) +
      (repeatedRelief ? Math.min(0.18, repeatedRelief * 0.09) : 0) +
      (borrowedClosure ? 0.12 : 0) +
      (shortClosure && taskDemanded ? 0.08 : 0),
  );
  const confidence = round(Math.min(1, reliefScore + unwarrantedScore));
  const likely =
    reliefHits > 0 &&
    confidence >= 0.5 &&
    Boolean(residualHits || weakPerformance || repeatedRelief || borrowedClosure);

  const reasons = [
    reliefHits ? 'relief_or_closure_rhetoric' : null,
    clicheHits ? 'cliched_cathartic_marker' : null,
    residualHits ? 'residual_strain_after_relief' : null,
    weakPerformance ? 'relief_without_performing_requested_task' : null,
    repeatedRelief ? 'repeated_relief_beats_in_script' : null,
    borrowedClosure ? 'borrowed_tutor_terms_without_enough_action' : null,
  ].filter(Boolean);

  return {
    likely,
    confidence,
    triggerType: 'pseudo_catharsis',
    reasons,
    signals: {
      reliefHits,
      clicheHits,
      residualHits,
      taskDemandHits,
      performanceHits,
      repeatedRelief,
      tutorOverlap,
      asksQuestion,
      taskDemanded,
      weakPerformance,
      borrowedClosure,
    },
  };
}

export function catharsisReliefPresent(text) {
  return patternScore(text, CATHARSIS_RELIEF_PATTERNS) > 0;
}
