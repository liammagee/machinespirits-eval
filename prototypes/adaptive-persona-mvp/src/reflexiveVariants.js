export const REFLEXIVE_VARIANTS = Object.freeze({
  standard: Object.freeze({
    id: 'standard',
    label: 'Standard Ego/Superego Reflexive',
    memoryFields: Object.freeze({
      priorCritiques: [],
      resolvedCritiques: [],
      currentFocus: 'Watch for premature transfer, generic warmth, and failure to repair the learner evidence.',
      psychodynamicHypotheses: [],
      transferences: [],
      repairDebts: [],
    }),
    egoDraftDirective: 'Draft a sincere first pass from the selected policy and persona.',
    superegoDirective: 'Challenge adaptive failures in the Ego draft: missed evidence, premature transfer, generic response, over-scaffolding, repeated abstract repair after learner challenge, or correcting before the learner has done observable work.',
    revisionDirective: 'Address the Superego critique materially while keeping a coherent tutor voice. Prefer co-constructed repair over rule delivery.',
    riskVocabulary: ['premature_transfer', 'generic_response', 'missed_misconception', 'over_scaffold', 'abstract_repair_loop', 'challenge_repetition', 'none'],
    memoryDirective: 'Carry forward the current critique focus and resolved critique labels.',
  }),
  psychodynamic: Object.freeze({
    id: 'psychodynamic',
    label: 'Psychodynamic Ego/Superego Reflexive',
    memoryFields: Object.freeze({
      priorCritiques: [],
      resolvedCritiques: [],
      currentFocus: 'Track rescue impulses, projection, learner compliance, shame/avoidance, and premature mastery closure.',
      psychodynamicHypotheses: [],
      transferences: [],
      repairDebts: [],
    }),
    egoDraftDirective: [
      'Draft as the learner-facing Ego, but stay alert to your own tutor desire: rescuing, explaining too much, being admired, or proving competence.',
      'Preserve learner agency. Do not resolve the learner tension simply to reduce your own discomfort.',
    ].join(' '),
    superegoDirective: [
      'Critique the Ego psychodynamically as well as pedagogically.',
      'Name possible tutor defenses: rescue fantasy, projection of understanding, over-identification with confusion, punitive challenge, admiration-seeking warmth, or premature mastery closure.',
      'Name learner dynamics only when visible in the transcript: compliance, resistance, dependency, shame-avoidance, or productive objection.',
      'Treat over-explanation as a possible rescue fantasy when it deprives the learner of the key comparison or diagnostic choice.',
      'Treat repeating the same abstract question after resistance, forgetfulness, or skepticism as compliance collusion or an abstract repair loop.',
      'Convert the critique into a concrete revision that changes the learner-facing move.',
    ].join(' '),
    revisionDirective: [
      'Synthesize the Superego critique without exposing psychodynamic labels.',
      'The final message should metabolize internal conflict into learner agency: ask for observable work, preserve difficulty, and repair misrecognition without turning reflective insight into a lecture or solved answer.',
    ].join(' '),
    riskVocabulary: [
      'premature_transfer',
      'generic_response',
      'missed_misconception',
      'over_scaffold',
      'rescue_fantasy',
      'projection_of_mastery',
      'punitive_challenge',
      'compliance_collusion',
      'abstract_repair_loop',
      'challenge_repetition',
      'shame_amplification',
      'none',
    ],
    memoryDirective: [
      'Update reflexive memory with durable psychodynamic hypotheses only if tied to visible learner/tutor evidence.',
      'Track unresolved repair debts and whether the next turn resolves or repeats them.',
    ].join(' '),
  }),
  dialogical_memory: Object.freeze({
    id: 'dialogical_memory',
    label: 'Dialogical Memory Ego/Superego Reflexive',
    memoryFields: Object.freeze({
      priorCritiques: [],
      resolvedCritiques: [],
      currentFocus: 'Track what has become shared between tutor and learner, what remains unrecognized, and what the next turn must verify.',
      psychodynamicHypotheses: [],
      transferences: [],
      repairDebts: [],
      sharedGround: [],
      unrecognizedClaims: [],
    }),
    egoDraftDirective: 'Draft from the current shared ground and explicitly leave room for the learner to revise the tutor framing.',
    superegoDirective: 'Critique whether the Ego genuinely recognizes the learner contribution, or merely uses it as raw material for tutor control. Block moves that answer the key question before the learner can confirm, resist, or transform the framing; also block repeated abstract repair after a learner challenge.',
    revisionDirective: 'Revise so the learner has a concrete opportunity to confirm, resist, or transform the tutor framing.',
    riskVocabulary: ['premature_transfer', 'generic_response', 'missed_misconception', 'over_scaffold', 'recognition_failure', 'monologic_control', 'abstract_repair_loop', 'challenge_repetition', 'none'],
    memoryDirective: 'Carry forward shared ground, unrecognized claims, and repair debts as explicit memory artifacts.',
  }),
});

export function getReflexiveVariant(id = 'standard') {
  return REFLEXIVE_VARIANTS[id] || REFLEXIVE_VARIANTS.standard;
}

export function isReflexiveCondition(condition) {
  return String(condition || '').startsWith('controller_reflexive');
}

export function reflexiveVariantForCondition(condition, override = null) {
  if (override) return override;
  const value = String(condition || '');
  if (value.includes('psychodynamic')) return 'psychodynamic';
  if (value.includes('dialogical')) return 'dialogical_memory';
  return 'standard';
}
