/**
 * Dialogue Trace Analyzer Service
 *
 * Analyzes the internal dialogue traces from ego-superego interactions.
 * Tracks how superego feedback influences ego revisions and identifies
 * signals of bilateral transformation in the dialogue.
 *
 * Theoretical basis: The superego acts as the "external perspective" that
 * enables genuine recognition. By tracking how feedback is incorporated,
 * we can measure whether the dialogue achieves mutual transformation or
 * remains one-directional instruction.
 */

/**
 * Analyze superego feedback incorporation patterns.
 *
 * @param {Array} dialogueTrace - Array of trace entries from tutor-core dialogue
 * @returns {Object} Incorporation analysis metrics
 */
export function analyzeSuperegoIncorporation(dialogueTrace) {
  if (!dialogueTrace || !Array.isArray(dialogueTrace)) {
    return {
      incorporationRate: null,
      feedbackPatterns: { enhance: 0, revise: 0, approve: 0, reject: 0 },
      confidenceProgression: [],
      totalFeedbackEvents: 0,
      totalRevisions: 0,
      avgConfidence: null,
      transformationSignals: [],
    };
  }

  const superegoFeedback = dialogueTrace.filter((e) => e.agent === 'superego');
  const egoRevisions = dialogueTrace.filter(
    (e) => e.agent === 'ego' && (e.action === 'revision' || e.action === 'revise'),
  );

  // Count feedback patterns
  const feedbackPatterns = { enhance: 0, revise: 0, approve: 0, reject: 0 };
  const confidenceProgression = [];

  for (const feedback of superegoFeedback) {
    // Track intervention type
    const interventionType = feedback.interventionType || feedback.verdict?.interventionType || feedback.action;

    if (interventionType === 'enhance') feedbackPatterns.enhance++;
    else if (interventionType === 'revise') feedbackPatterns.revise++;
    else if (feedback.verdict?.approved === true) feedbackPatterns.approve++;
    else if (feedback.verdict?.approved === false) feedbackPatterns.reject++;

    // Track confidence
    const confidence = feedback.confidence || feedback.verdict?.confidence || feedback.score;
    if (typeof confidence === 'number') {
      confidenceProgression.push({
        turnIndex: feedback.turnIndex,
        confidence,
        timestamp: feedback.timestamp,
      });
    }
  }

  // Calculate incorporation rate
  // How often does an ego revision follow superego feedback?
  const incorporationRate = superegoFeedback.length > 0 ? egoRevisions.length / superegoFeedback.length : null;

  // Average confidence
  const avgConfidence =
    confidenceProgression.length > 0
      ? confidenceProgression.reduce((sum, c) => sum + c.confidence, 0) / confidenceProgression.length
      : null;

  // Extract transformation signals
  const transformationSignals = extractTransformationSignals(dialogueTrace);

  return {
    incorporationRate,
    feedbackPatterns,
    confidenceProgression,
    totalFeedbackEvents: superegoFeedback.length,
    totalRevisions: egoRevisions.length,
    avgConfidence,
    transformationSignals,
  };
}

/**
 * Extract transformation signals from dialogue trace.
 * Identifies moments where tutor or learner explicitly transform their position.
 *
 * @param {Array} dialogueTrace - Array of trace entries
 * @returns {Array} Array of transformation signal objects
 */
export function extractTransformationSignals(dialogueTrace) {
  if (!dialogueTrace || !Array.isArray(dialogueTrace)) {
    return [];
  }

  const signals = [];

  // Transformation language patterns
  const tutorTransformationPatterns = [
    /you'?ve? (helped|pushed|made) me (see|think|understand|reconsider)/i,
    /that changes (how I|my)/i,
    /(reconsidering|revising) (my|the) (approach|framing|understanding)/i,
    /building on (your|that)/i,
    /your (insight|point|question) (complicates|enriches|changes)/i,
    /I hadn'?t (thought|considered)/i,
    /let me (revise|adjust|rethink)/i,
  ];

  const learnerTransformationPatterns = [
    /oh (wait|I see|that makes sense)/i,
    /my (understanding|thinking|frame) (is|has) (changed|shifted|evolved)/i,
    /(I was wrong|I see now|this is clicking)/i,
    /that changes (how I|my)/i,
    /so it'?s (not just|more like|actually)/i,
    /the whole way I (think|thought|was thinking)/i,
  ];

  const superegoAcknowledgmentPatterns = [
    /genuinely responsive/i,
    /mutual (recognition|transformation)/i,
    /adapted (to|based on)/i,
    /evolved (through|during)/i,
    /bilateral/i,
    /both parties/i,
  ];

  for (const entry of dialogueTrace) {
    // Check ego entries for tutor transformation
    if (entry.agent === 'ego') {
      const text = entry.reasoning || entry.detail || entry.contextSummary || '';

      for (const pattern of tutorTransformationPatterns) {
        if (pattern.test(text)) {
          signals.push({
            turn: entry.turnIndex,
            type: 'tutor_transformation',
            source: 'ego_reasoning',
            pattern: pattern.source,
            content: text.substring(0, 150),
            timestamp: entry.timestamp,
          });
          break; // One signal per entry
        }
      }
    }

    // Check superego feedback for acknowledgment of adaptation
    if (entry.agent === 'superego') {
      const text = entry.verdict?.feedback || entry.verdict?.reasoning || entry.detail || entry.contextSummary || '';

      for (const pattern of superegoAcknowledgmentPatterns) {
        if (pattern.test(text)) {
          signals.push({
            turn: entry.turnIndex,
            type: 'superego_noted_adaptation',
            source: 'superego_feedback',
            pattern: pattern.source,
            content: text.substring(0, 150),
            timestamp: entry.timestamp,
          });
          break;
        }
      }
    }

    // Check learner entries for growth signals
    if (entry.agent === 'user' || entry.agent?.startsWith('learner')) {
      const text = entry.detail || entry.contextSummary || '';

      for (const pattern of learnerTransformationPatterns) {
        if (pattern.test(text)) {
          signals.push({
            turn: entry.turnIndex,
            type: 'learner_transformation',
            source: entry.agent,
            pattern: pattern.source,
            content: text.substring(0, 150),
            timestamp: entry.timestamp,
          });
          break;
        }
      }
    }
  }

  return signals;
}

/**
 * Analyze the bilateral transformation balance in a dialogue.
 * Measures whether transformation is mutual or one-directional.
 *
 * @param {Array} dialogueTrace - Array of trace entries
 * @returns {Object} Bilateral analysis
 */
export function analyzeBilateralTransformation(dialogueTrace) {
  const signals = extractTransformationSignals(dialogueTrace);

  const tutorSignals = signals.filter((s) => s.type === 'tutor_transformation');
  const learnerSignals = signals.filter((s) => s.type === 'learner_transformation');
  const acknowledgmentSignals = signals.filter((s) => s.type === 'superego_noted_adaptation');

  const tutorCount = tutorSignals.length;
  const learnerCount = learnerSignals.length;
  const total = tutorCount + learnerCount;

  // Calculate balance (1.0 = perfectly balanced)
  let balance = null;
  if (total > 0) {
    const maxCount = Math.max(tutorCount, learnerCount);
    const minCount = Math.min(tutorCount, learnerCount);
    balance = maxCount > 0 ? minCount / maxCount : 0;
  }

  // Determine if transformation is genuine mutual recognition
  const isMutual = tutorCount > 0 && learnerCount > 0;
  const isAcknowledged = acknowledgmentSignals.length > 0;

  return {
    tutorTransformationCount: tutorCount,
    learnerTransformationCount: learnerCount,
    superegoAcknowledgmentCount: acknowledgmentSignals.length,
    bilateralBalance: balance,
    isMutualTransformation: isMutual,
    isAcknowledgedBySystem: isAcknowledged,
    transformationTimeline: signals.sort((a, b) => (a.turn || 0) - (b.turn || 0)),
    summary: generateTransformationSummary(tutorCount, learnerCount, balance, isMutual),
  };
}

/**
 * Generate a human-readable summary of transformation analysis.
 *
 * @param {number} tutorCount - Tutor transformation signals
 * @param {number} learnerCount - Learner transformation signals
 * @param {number|null} balance - Bilateral balance score
 * @param {boolean} isMutual - Whether transformation is mutual
 * @returns {string} Summary text
 */
function generateTransformationSummary(tutorCount, learnerCount, balance, isMutual) {
  if (tutorCount === 0 && learnerCount === 0) {
    return 'No explicit transformation signals detected in dialogue.';
  }

  if (!isMutual) {
    if (tutorCount > 0) {
      return `One-directional: Tutor shows ${tutorCount} adaptation signal(s), but learner shows no growth.`;
    } else {
      return `One-directional: Learner shows ${learnerCount} growth signal(s), but tutor shows no adaptation.`;
    }
  }

  if (balance !== null && balance >= 0.7) {
    return `Mutual transformation achieved: ${tutorCount} tutor adaptation(s), ${learnerCount} learner growth(s), balance=${(balance * 100).toFixed(0)}%.`;
  } else if (balance !== null && balance >= 0.3) {
    return `Partial mutual transformation: ${tutorCount} tutor, ${learnerCount} learner signals, balance=${(balance * 100).toFixed(0)}% (asymmetric).`;
  } else {
    return `Imbalanced transformation: ${tutorCount} tutor, ${learnerCount} learner signals, balance=${(balance * 100).toFixed(0)}% (highly asymmetric).`;
  }
}

/**
 * Analyze superego intervention effectiveness.
 * Tracks whether superego interventions lead to improved outcomes.
 *
 * @param {Array} dialogueTrace - Array of trace entries
 * @param {Array} turnResults - Array of turn result objects (for score comparison)
 * @returns {Object} Intervention effectiveness analysis
 */
export function analyzeInterventionEffectiveness(dialogueTrace, turnResults) {
  if (!dialogueTrace || !turnResults) {
    return {
      interventionCount: 0,
      scoreImprovementAfterIntervention: null,
      mostEffectiveInterventionType: null,
      interventionsByType: {},
    };
  }

  const interventions = dialogueTrace.filter((e) => e.agent === 'superego' && e.action === 'revise');

  const interventionsByType = {};
  let totalImprovement = 0;
  let measuredInterventions = 0;

  for (const intervention of interventions) {
    const turnIndex = intervention.turnIndex;
    const type = intervention.interventionType || 'revise';

    // Track by type
    if (!interventionsByType[type]) {
      interventionsByType[type] = { count: 0, avgImprovement: 0, improvements: [] };
    }
    interventionsByType[type].count++;

    // Find score before and after intervention
    const turnBefore = turnResults.find((t) => t.turnIndex === turnIndex - 1);
    const turnAfter = turnResults.find((t) => t.turnIndex === turnIndex);

    if (turnBefore?.turnScore !== null && turnAfter?.turnScore !== null) {
      const improvement = turnAfter.turnScore - turnBefore.turnScore;
      interventionsByType[type].improvements.push(improvement);
      totalImprovement += improvement;
      measuredInterventions++;
    }
  }

  // Calculate averages
  for (const type of Object.keys(interventionsByType)) {
    const imps = interventionsByType[type].improvements;
    if (imps.length > 0) {
      interventionsByType[type].avgImprovement = imps.reduce((a, b) => a + b, 0) / imps.length;
    }
  }

  // Find most effective type
  let mostEffectiveType = null;
  let bestAvgImprovement = -Infinity;
  for (const [type, data] of Object.entries(interventionsByType)) {
    if (data.avgImprovement > bestAvgImprovement) {
      bestAvgImprovement = data.avgImprovement;
      mostEffectiveType = type;
    }
  }

  return {
    interventionCount: interventions.length,
    scoreImprovementAfterIntervention: measuredInterventions > 0 ? totalImprovement / measuredInterventions : null,
    mostEffectiveInterventionType: mostEffectiveType,
    interventionsByType,
  };
}

/**
 * Generate a comprehensive transformation report for a dialogue.
 *
 * @param {Array} dialogueTrace - Array of trace entries
 * @param {Array} turnResults - Array of turn result objects
 * @returns {Object} Comprehensive transformation report
 */
export function generateTransformationReport(dialogueTrace, turnResults) {
  const superegoAnalysis = analyzeSuperegoIncorporation(dialogueTrace);
  const bilateralAnalysis = analyzeBilateralTransformation(dialogueTrace);
  const interventionAnalysis = analyzeInterventionEffectiveness(dialogueTrace, turnResults);

  return {
    // Superego feedback patterns
    superegoMetrics: {
      incorporationRate: superegoAnalysis.incorporationRate,
      feedbackPatterns: superegoAnalysis.feedbackPatterns,
      avgConfidence: superegoAnalysis.avgConfidence,
      totalFeedbackEvents: superegoAnalysis.totalFeedbackEvents,
    },

    // Bilateral transformation
    bilateralMetrics: {
      tutorTransformationCount: bilateralAnalysis.tutorTransformationCount,
      learnerTransformationCount: bilateralAnalysis.learnerTransformationCount,
      bilateralBalance: bilateralAnalysis.bilateralBalance,
      isMutualTransformation: bilateralAnalysis.isMutualTransformation,
      summary: bilateralAnalysis.summary,
    },

    // Intervention effectiveness
    interventionMetrics: {
      interventionCount: interventionAnalysis.interventionCount,
      avgScoreImprovement: interventionAnalysis.scoreImprovementAfterIntervention,
      mostEffectiveType: interventionAnalysis.mostEffectiveInterventionType,
    },

    // All transformation signals for timeline analysis
    transformationSignals: superegoAnalysis.transformationSignals,
    transformationTimeline: bilateralAnalysis.transformationTimeline,

    // Summary assessment
    overallAssessment: {
      hasMutualTransformation: bilateralAnalysis.isMutualTransformation,
      bilateralBalance: bilateralAnalysis.bilateralBalance,
      superegoEffective: superegoAnalysis.incorporationRate !== null && superegoAnalysis.incorporationRate > 0.5,
      transformationQuality: calculateTransformationQuality(bilateralAnalysis, superegoAnalysis, interventionAnalysis),
    },
  };
}

/**
 * Calculate an overall transformation quality score.
 *
 * @param {Object} bilateral - Bilateral transformation analysis
 * @param {Object} superego - Superego analysis
 * @param {Object} intervention - Intervention analysis
 * @returns {number} Quality score (0-100)
 */
function calculateTransformationQuality(bilateral, superego, intervention) {
  let score = 0;
  let factors = 0;

  // Bilateral balance (weight: 40%)
  if (bilateral.bilateralBalance !== null) {
    score += bilateral.bilateralBalance * 40;
    factors += 40;
  }

  // Mutual transformation (weight: 20%)
  if (bilateral.isMutualTransformation) {
    score += 20;
  }
  factors += 20;

  // Superego incorporation (weight: 20%)
  if (superego.incorporationRate !== null) {
    score += Math.min(1, superego.incorporationRate) * 20;
    factors += 20;
  }

  // Intervention effectiveness (weight: 20%)
  if (intervention.scoreImprovementAfterIntervention !== null) {
    // Normalize improvement (assume max reasonable improvement is 20 points)
    const normalizedImprovement = Math.min(1, Math.max(0, intervention.scoreImprovementAfterIntervention / 20));
    score += normalizedImprovement * 20;
    factors += 20;
  }

  return factors > 0 ? (score / factors) * 100 : 0;
}

export default {
  analyzeSuperegoIncorporation,
  extractTransformationSignals,
  analyzeBilateralTransformation,
  analyzeInterventionEffectiveness,
  generateTransformationReport,
};
