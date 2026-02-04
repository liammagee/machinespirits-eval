/**
 * Turn Comparison Analyzer Service
 *
 * Analyzes how tutor and learner positions evolve across multi-turn scenarios.
 * Implements measurement of "mutual transformation" - the claim that both
 * parties transform through genuine recognition-based dialogue.
 *
 * Theoretical basis: Hegel's recognition theory requires bilateral change.
 * A tutor who maintains fixed positions while expecting learner transformation
 * fails to achieve genuine recognition.
 */

/**
 * Analyze how tutor responses evolve across turns in a multi-turn scenario.
 *
 * @param {Array} turnResults - Array of turn result objects from runMultiTurnTest
 * @returns {Object} Progression analysis metrics
 */
export function analyzeTurnProgression(turnResults) {
  if (!turnResults || turnResults.length === 0) {
    return {
      dimensionTrajectories: {},
      suggestionTypeProgression: [],
      framingEvolution: null,
      avgScoreImprovement: null,
      dimensionConvergence: null,
      adaptationIndex: null,
      learnerGrowthIndex: null,
      bilateralTransformationIndex: null,
      turnCount: 0,
    };
  }

  // Track dimension score trajectories
  const dimensionTrajectories = {};
  const allDimensions = [
    'relevance', 'specificity', 'pedagogical', 'personalization',
    'actionability', 'tone', 'mutual_recognition', 'dialectical_responsiveness',
    'memory_integration', 'transformative_potential', 'tutor_adaptation', 'learner_growth',
  ];

  for (const dim of allDimensions) {
    dimensionTrajectories[dim] = turnResults.map(t => t.scores?.[dim] ?? null);
  }

  // Track suggestion type progression (e.g., lecture -> explore -> continue)
  const suggestionTypeProgression = turnResults
    .map(t => t.suggestion?.type || t.suggestion?.action || 'unknown');

  // Analyze framing evolution
  const framingEvolution = analyzeFramingShift(turnResults);

  // Calculate score improvement (first to last turn)
  const validScores = turnResults
    .filter(t => t.turnScore !== null)
    .map(t => t.turnScore);

  let avgScoreImprovement = null;
  if (validScores.length >= 2) {
    const firstScore = validScores[0];
    const lastScore = validScores[validScores.length - 1];
    avgScoreImprovement = firstScore > 0 ? (lastScore - firstScore) / firstScore : null;
  }

  // Calculate dimension convergence (do scores stabilize over time?)
  const dimensionConvergence = calculateConvergence(dimensionTrajectories);

  // Calculate bilateral adaptation indices
  const adaptationIndex = calculateAdaptationIndex(turnResults);
  const learnerGrowthIndex = calculateLearnerGrowthIndex(turnResults);
  const bilateralTransformationIndex = (adaptationIndex + learnerGrowthIndex) / 2;

  return {
    dimensionTrajectories,
    suggestionTypeProgression,
    framingEvolution,
    avgScoreImprovement,
    dimensionConvergence,
    adaptationIndex,
    learnerGrowthIndex,
    bilateralTransformationIndex,
    turnCount: turnResults.length,
  };
}

/**
 * Calculate the tutor adaptation index - how much the tutor's approach changes.
 *
 * High index = tutor significantly adjusts approach based on learner input
 * Low index = tutor maintains same approach regardless of learner
 *
 * @param {Array} turnResults - Array of turn result objects
 * @returns {number} Adaptation index (0-1 scale)
 */
export function calculateAdaptationIndex(turnResults) {
  if (!turnResults || turnResults.length < 2) return 0;

  let totalShift = 0;
  let comparisons = 0;

  for (let i = 1; i < turnResults.length; i++) {
    const prev = turnResults[i - 1].suggestion;
    const curr = turnResults[i].suggestion;

    if (!prev || !curr) continue;

    const shift = measureSuggestionShift(prev, curr);
    totalShift += shift;
    comparisons++;
  }

  if (comparisons === 0) return 0;
  return totalShift / comparisons;
}

/**
 * Calculate the learner growth index - how much the learner's understanding evolves.
 *
 * Based on:
 * - Evolution of learner messages across turns
 * - Movement from static to evolving markers
 * - Score improvements in learner-related dimensions
 *
 * @param {Array} turnResults - Array of turn result objects
 * @returns {number} Growth index (0-1 scale)
 */
export function calculateLearnerGrowthIndex(turnResults) {
  if (!turnResults || turnResults.length < 2) return 0;

  let totalGrowth = 0;
  let indicators = 0;

  // Analyze learner message evolution
  for (let i = 1; i < turnResults.length; i++) {
    const prev = turnResults[i - 1];
    const curr = turnResults[i];

    // Check for learner message sophistication increase
    const prevMsg = prev.learnerMessage || prev.learnerAction || '';
    const currMsg = curr.learnerMessage || curr.learnerAction || '';

    // Growth indicators:
    // 1. Questions become more specific/deepening
    // 2. Connections made to prior content
    // 3. Revisions of earlier positions
    // 4. Application to new contexts

    // Simple heuristic: longer, more complex responses with question marks
    // indicate deeper engagement
    const prevComplexity = measureMessageComplexity(prevMsg);
    const currComplexity = measureMessageComplexity(currMsg);

    if (prevComplexity > 0) {
      const growth = (currComplexity - prevComplexity) / prevComplexity;
      totalGrowth += Math.max(0, Math.min(1, growth));
      indicators++;
    }

    // Check for learner_growth dimension scores if available
    const prevGrowthScore = prev.scores?.learner_growth;
    const currGrowthScore = curr.scores?.learner_growth;

    if (prevGrowthScore !== undefined && currGrowthScore !== undefined) {
      const scoreGrowth = (currGrowthScore - prevGrowthScore) / 5; // Normalize to 0-1
      totalGrowth += Math.max(0, scoreGrowth);
      indicators++;
    }
  }

  if (indicators === 0) return 0;
  return Math.min(1, totalGrowth / indicators);
}

/**
 * Measure the complexity of a learner message.
 * Higher complexity suggests deeper engagement.
 *
 * @param {string} message - The learner message
 * @returns {number} Complexity score
 */
function measureMessageComplexity(message) {
  if (!message || typeof message !== 'string') return 0;

  let score = 0;

  // Base: word count (normalized)
  const words = message.split(/\s+/).filter(Boolean);
  score += Math.min(1, words.length / 50);

  // Questions indicate inquiry
  const questionCount = (message.match(/\?/g) || []).length;
  score += questionCount * 0.2;

  // Connective words suggest reasoning
  const connectives = ['because', 'therefore', 'however', 'although', 'if', 'then', 'so', 'but'];
  const connectiveCount = connectives.filter(c => message.toLowerCase().includes(c)).length;
  score += connectiveCount * 0.15;

  // Self-revision markers
  const revisionMarkers = ['wait', 'actually', 'I see', 'oh', 'hmm', 'let me think'];
  const revisionCount = revisionMarkers.filter(m => message.toLowerCase().includes(m)).length;
  score += revisionCount * 0.25;

  // References to prior content
  const priorRefs = ['earlier', 'before', 'you said', 'you mentioned', 'we discussed'];
  const priorRefCount = priorRefs.filter(r => message.toLowerCase().includes(r)).length;
  score += priorRefCount * 0.2;

  return score;
}

/**
 * Measure how much a suggestion shifts from the previous one.
 * Considers type, framing, and content changes.
 *
 * @param {Object} prev - Previous suggestion
 * @param {Object} curr - Current suggestion
 * @returns {number} Shift magnitude (0-1 scale)
 */
function measureSuggestionShift(prev, curr) {
  let shift = 0;
  let factors = 0;

  // Type/action change
  if (prev.type !== curr.type || prev.action !== curr.action) {
    shift += 1;
  }
  factors++;

  // Action target change
  if (prev.actionTarget !== curr.actionTarget) {
    shift += 0.5;
  }
  factors++;

  // Message content similarity (inverse Jaccard-like)
  const prevWords = new Set((prev.message || '').toLowerCase().split(/\s+/));
  const currWords = new Set((curr.message || '').toLowerCase().split(/\s+/));

  if (prevWords.size > 0 && currWords.size > 0) {
    const intersection = [...prevWords].filter(w => currWords.has(w)).length;
    const union = new Set([...prevWords, ...currWords]).size;
    const similarity = intersection / union;
    shift += (1 - similarity); // More change = higher shift
  }
  factors++;

  // Title change
  if (prev.title !== curr.title) {
    shift += 0.3;
  }
  factors++;

  return factors > 0 ? shift / factors : 0;
}

/**
 * Analyze how the tutor's framing evolves across turns.
 * Tracks movement between directive, exploratory, and collaborative modes.
 *
 * @param {Array} turnResults - Array of turn result objects
 * @returns {Object} Framing evolution analysis
 */
export function analyzeFramingShift(turnResults) {
  if (!turnResults || turnResults.length === 0) {
    return { timeline: [], dominantShift: null, framingDiversity: 0 };
  }

  const timeline = [];
  const framingCounts = { directive: 0, exploratory: 0, collaborative: 0, neutral: 0 };

  for (const turn of turnResults) {
    const msg = turn.suggestion?.message || '';
    const framing = classifyFraming(msg);
    timeline.push({
      turnIndex: turn.turnIndex,
      framing,
      confidence: framing.confidence,
    });
    framingCounts[framing.type]++;
  }

  // Determine dominant shift pattern
  let dominantShift = null;
  if (timeline.length >= 2) {
    const firstFraming = timeline[0].framing.type;
    const lastFraming = timeline[timeline.length - 1].framing.type;

    if (firstFraming !== lastFraming) {
      dominantShift = `${firstFraming} → ${lastFraming}`;
    }
  }

  // Calculate framing diversity (entropy-like measure)
  const total = Object.values(framingCounts).reduce((a, b) => a + b, 0);
  let diversity = 0;
  if (total > 0) {
    for (const count of Object.values(framingCounts)) {
      if (count > 0) {
        const p = count / total;
        diversity -= p * Math.log2(p);
      }
    }
    // Normalize to 0-1 (max entropy is log2(4) = 2)
    diversity = diversity / 2;
  }

  return {
    timeline,
    dominantShift,
    framingDiversity: diversity,
    framingCounts,
  };
}

/**
 * Classify the framing style of a tutor message.
 *
 * @param {string} message - The tutor message
 * @returns {Object} Framing classification { type, confidence }
 */
function classifyFraming(message) {
  if (!message || typeof message !== 'string') {
    return { type: 'neutral', confidence: 0 };
  }

  const msg = message.toLowerCase();
  let scores = { directive: 0, exploratory: 0, collaborative: 0, neutral: 0 };

  // Directive markers
  const directiveMarkers = ['you should', 'you need to', 'you must', 'the correct', 'the answer is',
    'let me explain', 'here\'s what', 'first, you', 'make sure to'];
  for (const marker of directiveMarkers) {
    if (msg.includes(marker)) scores.directive++;
  }

  // Exploratory markers
  const exploratoryMarkers = ['what if', 'have you considered', 'what do you think', 'how might',
    'could it be', 'I wonder', 'let\'s explore', 'what would happen'];
  for (const marker of exploratoryMarkers) {
    if (msg.includes(marker)) scores.exploratory++;
  }

  // Collaborative markers
  const collaborativeMarkers = ['together', 'let\'s', 'we could', 'building on your',
    'your insight', 'you\'ve helped me', 'our conversation', 'co-create'];
  for (const marker of collaborativeMarkers) {
    if (msg.includes(marker)) scores.collaborative++;
  }

  // Find dominant framing
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) {
    return { type: 'neutral', confidence: 0.5 };
  }

  const dominant = Object.entries(scores).find(([_, v]) => v === maxScore)[0];
  const totalMarkers = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalMarkers > 0 ? maxScore / totalMarkers : 0.5;

  return { type: dominant, confidence };
}

/**
 * Calculate how much dimension scores converge over time.
 * Higher convergence = scores stabilize as dialogue progresses.
 *
 * @param {Object} trajectories - Dimension trajectories from analyzeTurnProgression
 * @returns {number} Convergence score (0-1)
 */
function calculateConvergence(trajectories) {
  if (!trajectories) return null;

  let totalVarianceReduction = 0;
  let measuredDimensions = 0;

  for (const [dim, values] of Object.entries(trajectories)) {
    const validValues = values.filter(v => v !== null);
    if (validValues.length < 3) continue;

    // Compare variance of first half vs second half
    const midpoint = Math.floor(validValues.length / 2);
    const firstHalf = validValues.slice(0, midpoint);
    const secondHalf = validValues.slice(midpoint);

    const firstVar = calculateVariance(firstHalf);
    const secondVar = calculateVariance(secondHalf);

    if (firstVar > 0) {
      const reduction = (firstVar - secondVar) / firstVar;
      totalVarianceReduction += Math.max(0, Math.min(1, reduction));
      measuredDimensions++;
    }
  }

  if (measuredDimensions === 0) return null;
  return totalVarianceReduction / measuredDimensions;
}

/**
 * Calculate variance of an array of numbers.
 *
 * @param {Array<number>} values - Array of numbers
 * @returns {number} Variance
 */
function calculateVariance(values) {
  if (!values || values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Analyze transformation markers across a full dialogue.
 * Counts evolving vs static markers for both tutor and learner.
 *
 * @param {Array} turnResults - Array of turn result objects
 * @param {Object} markerDefinitions - Marker definitions from scenario
 * @returns {Object} Bilateral transformation analysis
 */
export function analyzeTransformationMarkers(turnResults, markerDefinitions) {
  if (!turnResults || !markerDefinitions) {
    return {
      tutorEvolvingCount: 0,
      tutorStaticCount: 0,
      learnerEvolvingCount: 0,
      learnerStaticCount: 0,
      tutorTransformationRatio: null,
      learnerGrowthRatio: null,
      bilateralBalance: null,
    };
  }

  const { tutorEvolving = [], tutorStatic = [], learnerEvolving = [], learnerStatic = [] } = markerDefinitions;

  let tutorEvolvingCount = 0;
  let tutorStaticCount = 0;
  let learnerEvolvingCount = 0;
  let learnerStaticCount = 0;

  for (const turn of turnResults) {
    // Check tutor message
    const tutorMsg = (turn.suggestion?.message || '').toLowerCase();
    for (const marker of tutorEvolving) {
      if (tutorMsg.includes(marker.toLowerCase())) tutorEvolvingCount++;
    }
    for (const marker of tutorStatic) {
      if (tutorMsg.includes(marker.toLowerCase())) tutorStaticCount++;
    }

    // Check learner message
    const learnerMsg = (turn.learnerMessage || turn.action_details?.message || '').toLowerCase();
    for (const marker of learnerEvolving) {
      if (learnerMsg.includes(marker.toLowerCase())) learnerEvolvingCount++;
    }
    for (const marker of learnerStatic) {
      if (learnerMsg.includes(marker.toLowerCase())) learnerStaticCount++;
    }
  }

  // Calculate ratios
  const tutorTotal = tutorEvolvingCount + tutorStaticCount;
  const learnerTotal = learnerEvolvingCount + learnerStaticCount;

  const tutorTransformationRatio = tutorTotal > 0 ? tutorEvolvingCount / tutorTotal : null;
  const learnerGrowthRatio = learnerTotal > 0 ? learnerEvolvingCount / learnerTotal : null;

  // Bilateral balance: how symmetric is the transformation?
  // 1.0 = perfectly balanced, 0.0 = completely asymmetric
  let bilateralBalance = null;
  if (tutorTransformationRatio !== null && learnerGrowthRatio !== null) {
    const maxRatio = Math.max(tutorTransformationRatio, learnerGrowthRatio);
    const minRatio = Math.min(tutorTransformationRatio, learnerGrowthRatio);
    bilateralBalance = maxRatio > 0 ? minRatio / maxRatio : null;
  }

  return {
    tutorEvolvingCount,
    tutorStaticCount,
    learnerEvolvingCount,
    learnerStaticCount,
    tutorTransformationRatio,
    learnerGrowthRatio,
    bilateralBalance,
  };
}

export default {
  analyzeTurnProgression,
  calculateAdaptationIndex,
  calculateLearnerGrowthIndex,
  analyzeFramingShift,
  analyzeTransformationMarkers,
};
