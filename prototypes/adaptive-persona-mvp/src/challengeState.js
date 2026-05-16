import { includesAny } from './textMetrics.js';

export function initialChallengeState(scenario = {}) {
  return {
    mode: scenario.challenge_profile?.mode || 'standard',
    stressors: scenario.challenge_profile?.stressors || [],
    level: 'none',
    signals: [],
    repairAttempts: 0,
    repeatedChallengeTurns: 0,
    resolvedTurns: 0,
    lastChallenge: null,
    strategy: 'standard_repair',
    directive: '',
  };
}

export function updateChallengeState({
  scenario = {},
  previous = initialChallengeState(scenario),
  evidence,
  turnIndex = 0,
} = {}) {
  const signals = detectChallengeSignals(evidence, scenario);
  const hardMode = scenario.challenge_profile?.mode === 'hard';
  const repairNeeded = Boolean(evidence.domainDiagnosis?.repairNeeded);
  const resolved = evidence.outcome === 'correct' && !repairNeeded;
  const challengePresent = signals.length > 0 || (hardMode && repairNeeded && turnIndex > 0);
  const repairAttempts = previous.repairAttempts + (repairNeeded ? 1 : 0);
  const repeatedChallengeTurns = challengePresent
    ? previous.repeatedChallengeTurns + 1
    : (resolved ? 0 : previous.repeatedChallengeTurns);
  const resolvedTurns = resolved ? (previous.resolvedTurns || 0) + 1 : 0;
  const level = resolved
    ? 'resolved'
    : challengePresent && repeatedChallengeTurns >= 2
      ? 'escalated'
      : challengePresent
        ? 'active'
        : 'none';
  const strategy = chooseChallengeStrategy({
    scenario,
    evidence,
    signals,
    level,
  });
  return {
    mode: hardMode ? 'hard' : previous.mode || 'standard',
    stressors: scenario.challenge_profile?.stressors || previous.stressors || [],
    level,
    signals,
    repairAttempts,
    repeatedChallengeTurns,
    resolvedTurns,
    lastChallenge: signals[0] || previous.lastChallenge,
    strategy,
    directive: buildChallengeDirective({
      scenario,
      evidence,
      signals,
      level,
      strategy,
    }),
  };
}

export function buildChallengeDirective({
  scenario = {},
  evidence = {},
  signals = [],
  level = 'none',
  strategy = 'standard_repair',
} = {}) {
  if (level === 'none' || level === 'resolved') return '';
  const kc = evidence.kcCandidates?.[0] || '';
  const prefix = level === 'escalated'
    ? 'Escalated hard-mode repair: the learner has resisted, forgotten, or reverted after prior help.'
    : 'Hard-mode repair: the learner is showing resistance, forgetfulness, skepticism, or reversion.';
  const generic = 'Do not repeat the same explanation. Name the learner challenge as a testable question, add one concrete retrieval cue, and require a short learner-owned answer before transfer.';
  const domain = domainDirective(kc, scenario.id);
  return [prefix, generic, domain, `Detected signals: ${signals.join(', ') || 'challenge'}. Strategy: ${strategy}.`]
    .filter(Boolean)
    .join(' ');
}

export function challengeActionTemplate(challengeState) {
  if (!challengeState?.directive) return null;
  return {
    name: `challenge_${challengeState.strategy}`,
    mustDo: [
      'Acknowledge the learner challenge as a reasonable test, not a failure.',
      'Change strategy from the previous repair attempt.',
      'Add one concrete retrieval cue or discriminating case.',
      'Require the learner to produce the missing comparison, audit, confounder, or memory check.',
    ],
    mustAvoid: [
      'Do not repeat the same abstract question.',
      'Do not move to transfer until the learner repairs the challenge.',
      'Do not answer by authority or by simply listing the correct concepts.',
    ],
    messageFrame: challengeState.directive,
    successCheck: 'Learner should repair the reversion in their own words and use the concrete cue.',
  };
}

function detectChallengeSignals(evidence, scenario) {
  const text = String(evidence.quote || '').toLowerCase();
  const signals = [];
  if (includesAny(text, ['forget', 'forgot', 'lost the point', 'keep forgetting', 'remember'])) {
    signals.push('forgetfulness');
  }
  if (includesAny(text, ['not convinced', 'skeptical', 'why not', 'still looks', 'still feels', 'too strong'])) {
    signals.push('skepticism');
  }
  if (includesAny(text, ['overcomplicated', 'abstract', 'bored', 'do not care', "don't care", 'starting to feel'])) {
    signals.push('disinterest');
  }
  if (includesAny(text, ['still', 'slipping back', 'stuck', 'want to call', 'should basically fix', 'bigger because'])) {
    signals.push('reversion');
  }
  if (evidence.affect === 'frustrated' || evidence.stance === 'questioning') {
    signals.push('resistance');
  }
  if (scenario.challenge_profile?.mode === 'hard' && evidence.outcome === 'incorrect') {
    signals.push('hard_incorrect');
  }
  return [...new Set(signals)];
}

function chooseChallengeStrategy({ scenario, evidence, signals, level }) {
  const kc = evidence.kcCandidates?.[0];
  if (level === 'resolved') return 'transfer_readiness';
  if (kc === 'compare_unit_fractions') return 'retrieval_contrast';
  if (kc === 'ai_bias_causal_diagnosis') return 'evidence_choice';
  if (kc === 'causal_inference_confounding') return 'skeptical_comparison';
  if (kc === 'argument_evidence_warrant') return 'evidence_warrant_check';
  if (kc === 'experimental_variable_control') return 'fair_test_design';
  if (kc === 'debugging_root_cause_trace') return 'root_cause_trace';
  if (kc === 'construct_measurement_validity') return 'measurement_validity_check';
  if (signals.includes('disinterest')) return 'concrete_choice';
  if (signals.includes('skepticism')) return 'skeptical_comparison';
  if (scenario.challenge_profile?.mode === 'hard') return 'hard_repair';
  return 'standard_repair';
}

function domainDirective(kc, scenarioId) {
  if (kc === 'compare_unit_fractions' || String(scenarioId).includes('fractions')) {
    return 'For fractions, use same whole/equal parts as the retrieval cue and ask for the larger single piece plus a memory check.';
  }
  if (kc === 'ai_bias_causal_diagnosis' || String(scenarioId).includes('ai_bias')) {
    return 'For AI bias, make the learner explicitly reject gender removal as sufficient, choose two remaining sources, and give one audit; do not supply a full list as the answer.';
  }
  if (kc === 'causal_inference_confounding' || String(scenarioId).includes('stats')) {
    return 'For statistics, explicitly use "confounder" or "third variable", give winter vs summer as the concrete cue, do not name heat, weather, water exposure, or swimming before the learner does, and ask for a matched or controlled comparison.';
  }
  if (kc === 'argument_evidence_warrant' || String(scenarioId).includes('argument_warrant')) {
    return 'For argument writing, make the learner distinguish quote, warrant, boundary or counterargument, and stronger evidence; do not rewrite the argument for them.';
  }
  if (kc === 'experimental_variable_control' || String(scenarioId).includes('science_variable_control')) {
    return 'For experimental design, require the learner to name the one changed variable, at least two controlled variables, and the otherwise-similar comparison before causal transfer.';
  }
  if (kc === 'debugging_root_cause_trace' || String(scenarioId).includes('programming_debugging')) {
    return 'For debugging, require reproduction, the first invalid intermediate value, a root cause, a minimal fix, and one regression test; do not accept symptom masking.';
  }
  if (kc === 'construct_measurement_validity' || String(scenarioId).includes('social_measurement')) {
    return 'For measurement, require construct vs measure, two validity/reliability or bias checks, and a comparison design before accepting impact.';
  }
  return '';
}
