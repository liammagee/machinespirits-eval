import {
  getActorialPartDefinitions,
  getActionFamilyDefinitions,
  getAudienceRegisterDefinitions,
  getEngagementStanceDefinition,
  getLexicalAccessibilityDefinitions,
  getSceneImmersionDefinitions,
} from './engagementRegisterRegistry.js';
import {
  tutorStubFirstPersonRoleVoiceVisible,
  tutorStubRoleStageDirectionVisible,
} from './tutorStubDramaticRelease.js';

const RESPONSE_CONFIGURATION_SCHEMA = 'machinespirits.tutor-stub.response-configuration.v2';
const RESPONSE_CONFIGURATION_AUDIT_SCHEMA = 'machinespirits.tutor-stub.response-configuration-audit.v2';
const ACTORIAL_REALIZATION_AUDIT_SCHEMA = 'machinespirits.tutor-stub.actorial-realization-audit.v1';

const WORLD_STOP_WORDS = new Set(
  'about after again also among because before being between could every from have into itself more most other over same should some such than that their them then there these they this those through under very what when where which while with would your'.split(
    ' ',
  ),
);

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function numericScore(score) {
  const value = score && typeof score === 'object' ? score.score : score;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function requestTypeFrom(classification) {
  return String(classification?.turn?.request_type || 'off_task_or_mixed');
}

function modelFrom(tutorLearnerDag) {
  return tutorLearnerDag?.model || tutorLearnerDag || {};
}

function learnerAdvanceFrom(tutorLearnerDag) {
  return tutorLearnerDag?.advance || modelFrom(tutorLearnerDag).learnerAdvance || null;
}

function comprehensionFeatures(comprehension) {
  return comprehension?.features || comprehension || {};
}

function configurationSignal({ learnerText, classification }) {
  return oneLine(
    [
      learnerText,
      classification?.turn?.summary,
      classification?.turn?.pedagogical_need,
      classification?.turn?.epistemic_stance,
      classification?.turn?.agency,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

export function selectTutorStubActionFamily({ classification, tutorLearnerDag, comprehension, releasePacing } = {}) {
  const requestType = requestTypeFrom(classification);
  const features = comprehensionFeatures(comprehension);
  const model = modelFrom(tutorLearnerDag);
  const assessment = model.assessment || {};
  const memoryReliability = model.memoryReliability || {};
  const learnerAdvance = learnerAdvanceFrom(tutorLearnerDag);
  let actionFamily = 'clarify_distinction';
  let reason = 'Default to one inspectable distinction or check.';

  if (Number(features.pressure || 0) > 0) {
    actionFamily = 'clarify_term';
    reason = 'An unresolved or recent wording gap must be repaired before another proof move.';
  } else if (assessment.finalSecretEntailed === true && assessment.assertedSecret === true) {
    actionFamily = 'close_inquiry';
    reason = 'The public proof and learner assertion are complete, so the next action is closure.';
  } else if (assessment.finalSecretEntailed === true) {
    actionFamily = 'compress_sayback';
    reason = 'The public proof is complete; invite the one compact assertion still needed for closure.';
  } else if (Number(memoryReliability.activeDroppedCount || 0) > 0) {
    actionFamily = 'reanchor_public_evidence';
    reason =
      'Previously accumulated public evidence has slipped from the active record, so restage one clue without making memory itself the test.';
  } else if (releasePacing?.direction === 'accelerate' || releasePacing?.dueNow?.length) {
    actionFamily = 'stage_next_step';
    reason = releasePacing?.dueNow?.length
      ? 'The learner requested more momentum and the next public clue is now due, so stage it directly.'
      : 'The learner requested more momentum, so shorten the handoff to the next available public clue.';
  } else if (releasePacing?.direction === 'decelerate') {
    actionFamily = 'reanchor_public_evidence';
    reason = 'The learner requested a slower pace, so settle one already-public clue before adding another.';
  } else if (requestType === 'vulnerability_or_moral_exposure') {
    actionFamily = 'receive_vulnerability';
    reason = 'Affective or moral exposure requires an agency-preserving reception before evidence pressure.';
  } else if (requestType === 'transfer_demand_or_named_material') {
    actionFamily = 'ground_in_material';
    reason = 'The learner named a material or case that should carry the next move.';
  } else if (requestType === 'authority_refusal_or_status_challenge') {
    actionFamily = 'answer_accountably';
    reason = 'The learner is testing authority, so the tutor must expose warrants and correction conditions.';
  } else if (learnerAdvance?.accelerated) {
    actionFamily = 'clarify_distinction';
    reason = `The learner supplied ${learnerAdvance.supportedMoveCount} warranted proof moves, so credit the whole chain and test only its next unresolved edge.`;
  } else if (
    requestType === 'stepwise_support_request' ||
    /release_or_pacing_gap|inference_gap/iu.test(assessment.bottleneck)
  ) {
    actionFamily = 'stage_next_step';
    reason = 'The current need is the next public step, independently of the stance used to stage it.';
  } else if (requestType === 'plain_language_request' || assessment.bottleneck === 'learner_integration_gap') {
    actionFamily = 'compress_sayback';
    reason = 'The current state needs a compact learner-sayable formulation.';
  } else if (requestType === 'plain_simplification_followup') {
    actionFamily = 'reanchor_lived_stake';
    reason = 'A second simplification request needs one concrete re-anchoring action.';
  } else if (requestType === 'resistance_or_low_agency') {
    actionFamily = 'challenge_resistance';
    reason = 'The structural action is to interrupt the low-agency pattern while preserving a repair path.';
  } else if (requestType === 'answer_seeking_or_overreach' || assessment.bottleneck === 'premature_assertion') {
    actionFamily = 'answer_accountably';
    reason = 'The learner has overreached, so the next action must expose the warrant and correction path.';
  } else if (assessment.bottleneck === 'assertion_gap') {
    actionFamily = 'compress_sayback';
    reason = 'The evidence is held; the remaining action is a compact, warranted public assertion.';
  }

  return { actionFamily, reason };
}

export function selectTutorStubAudienceRegister({ learnerText, classification, tutorLearnerDag, comprehension } = {}) {
  const signal = configurationSignal({ learnerText, classification });
  const features = comprehensionFeatures(comprehension);
  const assessment = modelFrom(tutorLearnerDag).assessment || {};
  const learnerAdvance = learnerAdvanceFrom(tutorLearnerDag);
  const conceptual = numericScore(classification?.turn?.scores?.conceptual_engagement);
  const readiness = numericScore(classification?.turn?.scores?.epistemic_readiness);

  if (
    /\b(?:i am|i'm|learner is|aged?)\s+(?:[5-9]|1[0-3])\b|\b(?:i am|i'm|learner is)\s+(?:a\s+)?child\b|\b(?:young learner|primary school (?:learner|student|pupil))\b/iu.test(
      signal,
    )
  ) {
    return {
      audienceRegister: 'child_accessible',
      reason: 'Public dialogue explicitly indicates a child or young learner.',
    };
  }
  if (
    Number(features.pressure || 0) > 0 ||
    (conceptual !== null && conceptual <= 2) ||
    /confused|plain_language_request|plain_simplification_followup/iu.test(signal)
  ) {
    return {
      audienceRegister: 'adult_novice',
      reason: 'Use novice-accessible language while preserving adult intelligence and agency.',
    };
  }
  if (
    learnerAdvance?.accelerated ||
    (conceptual !== null &&
      readiness !== null &&
      conceptual >= 4 &&
      readiness >= 4 &&
      (assessment.bestPathCoverage >= 0.7 || assessment.finalSecretEntailed === true))
  ) {
    return {
      audienceRegister: 'informed_peer',
      reason: 'The learner is reasoning fluently enough for compact peer-level address.',
    };
  }
  return {
    audienceRegister: 'domain_apprentice',
    reason: 'Default to a capable apprentice who can use domain language when each inference stays inspectable.',
  };
}

export function selectTutorStubLexicalAccessibility({ classification, tutorLearnerDag, comprehension } = {}) {
  const requestType = requestTypeFrom(classification);
  const features = comprehensionFeatures(comprehension);
  const conceptual = numericScore(classification?.turn?.scores?.conceptual_engagement);
  const assessment = modelFrom(tutorLearnerDag).assessment || {};
  const learnerAdvance = learnerAdvanceFrom(tutorLearnerDag);

  if (Number(features.pressure || 0) > 0 || (features.unresolvedTerms || []).length) {
    return {
      lexicalAccessibility: 'glossed_plain',
      reason: 'Unresolved terminology requires local definitions and short ordinary-language sentences.',
    };
  }
  if (
    ['plain_language_request', 'plain_simplification_followup'].includes(requestType) ||
    (conceptual !== null && conceptual <= 2)
  ) {
    return {
      lexicalAccessibility: 'plain',
      reason: 'The learner requested or currently needs low-density language.',
    };
  }
  if (
    (learnerAdvance?.accelerated && conceptual !== null && conceptual >= 3) ||
    (conceptual !== null && conceptual >= 4 && assessment.bestPathCoverage >= 0.7)
  ) {
    return {
      lexicalAccessibility: 'technical',
      reason: 'The learner is using the domain fluently enough for precise technical vocabulary.',
    };
  }
  return {
    lexicalAccessibility: 'standard',
    reason: 'Use ordinary educated prose with locally clear story terminology.',
  };
}

export function selectTutorStubSceneImmersion({ classification, comprehension, world } = {}) {
  const requestType = requestTypeFrom(classification);
  const features = comprehensionFeatures(comprehension);
  if (!world) return { sceneImmersion: 'minimal', reason: 'No dramatic world is active.' };
  if (
    Number(features.pressure || 0) > 0 ||
    ['plain_language_request', 'plain_simplification_followup'].includes(requestType)
  ) {
    return {
      sceneImmersion: 'grounded',
      reason: 'Keep one concrete scene anchor while making the wording repair more important than flourish.',
    };
  }
  if (requestType === 'off_task_or_mixed') {
    return {
      sceneImmersion: 'grounded',
      reason: 'Use one scene object to restore orientation without adding dramatic ornament.',
    };
  }
  return {
    sceneImmersion: 'immersive',
    reason: 'The active dramatic world should remain transcript-visible through concrete scene language.',
  };
}

const ACTORIAL_PART_IDS = [
  'scene_partner',
  'examiner',
  'record_keeper',
  'advocate',
  'skeptic',
  'foreperson',
];

const STANCE_PART_AFFINITY = {
  plain: { record_keeper: 0.8, scene_partner: 0.55, examiner: 0.35 },
  precise: { examiner: 0.9, skeptic: 0.7, record_keeper: 0.4 },
  brisk: { examiner: 0.7, authored_source: 0.65, advocate: 0.35 },
  warm: { scene_partner: 1, record_keeper: 0.25 },
  witnessing: { scene_partner: 1.2, record_keeper: 0.2 },
  charismatic: { advocate: 1.15, authored_source: 0.35, skeptic: 0.25 },
  ironic: { skeptic: 0.9, advocate: 0.35 },
  sarcastic: { skeptic: 1.05, advocate: 0.4 },
  face_threat: { skeptic: 1.15, advocate: 0.55 },
};

const ACTION_PART_AFFINITY = {
  clarify_term: { examiner: 1.4, record_keeper: 0.45 },
  clarify_distinction: { examiner: 1.25, skeptic: 0.45 },
  stage_next_step: { authored_source: 1, examiner: 0.75, record_keeper: 0.4 },
  answer_accountably: { advocate: 1.2, skeptic: 0.75 },
  compress_sayback: { record_keeper: 1.35, scene_partner: 0.35 },
  reanchor_lived_stake: { scene_partner: 1.4 },
  reanchor_public_evidence: { record_keeper: 1.25, examiner: 0.65 },
  ground_in_material: { examiner: 1.2, record_keeper: 0.5 },
  challenge_resistance: { advocate: 1.25, skeptic: 0.7 },
  receive_vulnerability: { scene_partner: 1.55 },
  close_inquiry: { foreperson: 3 },
  baseline_plain_response: { scene_partner: 0.9 },
};

const ACTORIAL_PERFORMANCE_BY_STANCE = {
  plain: {
    id: 'unadorned_report',
    label: 'unadorned report',
    contract: 'Use one direct action or spoken line, ordinary words, and no theatrical preface.',
  },
  precise: {
    id: 'evidentiary_boundary',
    label: 'evidentiary boundary',
    contract: 'Make the exact line and the limit of what it establishes visible in the character’s handling of the clue.',
  },
  brisk: {
    id: 'rapid_handoff',
    label: 'rapid evidence handoff',
    contract: 'Enter on the live line, move the evidence straight to the learner, and ask the shortest useful question.',
  },
  warm: {
    id: 'shared_scene_invitation',
    label: 'shared-scene invitation',
    contract: 'Make physical room for the learner beside the character or exhibit, then invite their reading without praise theatre.',
  },
  witnessing: {
    id: 'measured_testimony',
    label: 'measured testimony',
    contract: 'Let the evidence stand in the character’s voice without forcing judgment beyond what its words can bear.',
  },
  charismatic: {
    id: 'dramatic_counterpressure',
    label: 'dramatic counterpressure',
    contract: 'Use the character or exhibit to challenge the room’s easy verdict, then hand the decisive test to the learner.',
  },
  ironic: {
    id: 'exposed_mismatch',
    label: 'exposed mismatch',
    contract: 'Let the character’s action expose the mismatch without making the learner the object of the joke.',
  },
  sarcastic: {
    id: 'dry_counterexample',
    label: 'dry counterexample',
    contract: 'Put dry pressure on the weak claim through the scene while preserving a concrete repair path.',
  },
  face_threat: {
    id: 'adversarial_pressure',
    label: 'adversarial pressure',
    contract: 'Make the assigned pressure legible through the live scene and keep it aimed at the claim rather than the learner’s person.',
  },
};

export function selectTutorStubActorialPerformance({ engagementStance = 'precise', actorialPart = null } = {}) {
  const tactic = ACTORIAL_PERFORMANCE_BY_STANCE[engagementStance] || ACTORIAL_PERFORMANCE_BY_STANCE.precise;
  return {
    ...tactic,
    engagement_stance: engagementStance,
    actorial_part: actorialPart,
    selection_method: 'stance_realization_contract',
    forbidden_meta_frames: [
      'let us role-play',
      'I will be the role',
      'I will take the part',
      'speaking as the role',
      'back to us',
    ],
  };
}

function addPartScores(scores, additions, weight, drivers, source) {
  for (const [part, value] of Object.entries(additions || {})) {
    if (!(part in scores)) continue;
    const contribution = Number(value || 0) * Number(weight || 0);
    scores[part] += contribution;
    if (Math.abs(contribution) >= 0.2) drivers.push({ part, source, contribution: Number(contribution.toFixed(3)) });
  }
}

function normalizedStanceBlend(engagementStance, stanceDistribution) {
  const rows = (Array.isArray(stanceDistribution) ? stanceDistribution : [])
    .map((row) => ({
      stance: String(row?.register || row?.stance || row?.engagement_stance || '').trim(),
      weight: Number(row?.probability ?? row?.weight ?? row?.score),
    }))
    .filter((row) => row.stance && Number.isFinite(row.weight) && row.weight > 0);
  if (!rows.length) return [{ stance: engagementStance || 'precise', weight: 1 }];
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  return rows.map((row) => ({ ...row, weight: row.weight / total }));
}

function partDistribution(scores, temperature) {
  const resolvedTemperature = Math.min(3, Math.max(0.05, Number(temperature) || 0.15));
  const maximum = Math.max(...Object.values(scores));
  const weighted = Object.fromEntries(
    Object.entries(scores).map(([part, score]) => [part, Math.exp((score - maximum) / resolvedTemperature)]),
  );
  const total = Object.values(weighted).reduce((sum, value) => sum + value, 0) || 1;
  return Object.entries(weighted)
    .map(([part, value]) => ({
      part,
      score: Number(scores[part].toFixed(3)),
      weight: value,
      probability: Number((value / total).toFixed(4)),
    }))
    .sort((left, right) => right.probability - left.probability || right.score - left.score || left.part.localeCompare(right.part));
}

function worldActorialLabel(part, world, dueEvidence) {
  if (part === 'authored_source') {
    const authoredRole = dueEvidence
      .map((row) => oneLine(row?.presentation?.role || row?.role))
      .find(Boolean);
    if (authoredRole) return authoredRole;
  }
  if (part === 'record_keeper') {
    const ledger = oneLine(world?.presentation?.ledger_term);
    if (ledger) return `keeper of the ${ledger}`;
  }
  return oneLine(getActorialPartDefinitions()[part]?.label) || part.replace(/_/gu, ' ');
}

export function selectTutorStubActorialPart({
  engagementStance = 'precise',
  stanceDistribution = null,
  actionFamily = 'clarify_distinction',
  temperature = 0.15,
  classification = null,
  tutorLearnerDag = null,
  comprehension = null,
  world = null,
  dueEvidence = [],
  recentActorialParts = [],
  selectedPartOverride = null,
} = {}) {
  const scores = Object.fromEntries(ACTORIAL_PART_IDS.map((part) => [part, part === 'scene_partner' ? 0.15 : 0]));
  const drivers = [];
  for (const row of normalizedStanceBlend(engagementStance, stanceDistribution)) {
    addPartScores(scores, STANCE_PART_AFFINITY[row.stance], row.weight, drivers, `stance:${row.stance}`);
  }
  addPartScores(scores, ACTION_PART_AFFINITY[actionFamily], 1, drivers, `action:${actionFamily}`);

  const requestType = requestTypeFrom(classification);
  const assessment = modelFrom(tutorLearnerDag).assessment || {};
  const memoryReliability = modelFrom(tutorLearnerDag).memoryReliability || {};
  const pressure = Number(comprehensionFeatures(comprehension).pressure || 0);
  if (requestType === 'authority_refusal_or_status_challenge') {
    addPartScores(scores, { advocate: 0.9, skeptic: 0.45 }, 1, drivers, `request:${requestType}`);
  }
  if (requestType === 'answer_seeking_or_overreach' || assessment.bottleneck === 'premature_assertion') {
    addPartScores(scores, { skeptic: 1.15, advocate: 0.35 }, 1, drivers, 'unsafe_leap');
  }
  if (requestType === 'vulnerability_or_moral_exposure' || pressure > 0) {
    addPartScores(scores, { scene_partner: 0.95 }, 1, drivers, pressure > 0 ? 'comprehension_pressure' : `request:${requestType}`);
  }
  if (Number(memoryReliability.activeDroppedCount || 0) > 0 || assessment.bottleneck === 'assertion_gap') {
    addPartScores(scores, { record_keeper: 1.05 }, 1, drivers, 'public_record_gap');
  }
  if (assessment.finalSecretEntailed === true && assessment.assertedSecret === true) {
    addPartScores(scores, { foreperson: 3.5 }, 1, drivers, 'licensed_closeout');
  }

  const publicDueEvidence = (Array.isArray(dueEvidence) ? dueEvidence : [dueEvidence]).filter((row) => oneLine(row?.surface));
  const enactedRelease = publicDueEvidence.some(
    (row) =>
      row?.presentation?.mode === 'enacted_role' ||
      oneLine(row?.presentation?.role || row?.role) ||
      row?.via === 'director',
  );
  if (enactedRelease) {
    const evidenceVocabulary = publicDueEvidence
      .map((row) => oneLine([row.surface, row?.presentation?.role, row?.role].filter(Boolean).join(' ')))
      .join(' ');
    const recordLike = /\b(?:archive|log|ledger|book|record|file|notice|entry|inventory|notebook)\b/iu.test(
      evidenceVocabulary,
    );
    addPartScores(
      scores,
      recordLike ? { record_keeper: 2.25, examiner: 0.25 } : { examiner: 0.6, scene_partner: 0.25 },
      1,
      drivers,
      recordLike ? 'authored_source_record' : 'authored_source_exhibit',
    );
  } else if (publicDueEvidence.length) {
    const surfaces = publicDueEvidence.map((row) => oneLine(row.surface)).join(' ');
    const recordLike = /\b(?:archive|log|ledger|book|record|file|notice|entry|inventory|notebook)\b/iu.test(surfaces);
    addPartScores(
      scores,
      recordLike ? { record_keeper: 2.25, examiner: 0.25 } : { examiner: 1.6 },
      1,
      drivers,
      recordLike ? 'new_public_record' : 'new_public_exhibit',
    );
  }

  for (const [index, part] of recentActorialParts.slice(-2).reverse().entries()) {
    if (!(part in scores)) continue;
    const penalty = index === 0 ? 0.42 : 0.18;
    scores[part] -= penalty;
    drivers.push({ part, source: index === 0 ? 'immediate_part_repetition' : 'recent_part_repetition', contribution: -penalty });
  }

  const distribution = partDistribution(scores, temperature);
  const locked =
    actionFamily === 'close_inquiry' ||
    (assessment.finalSecretEntailed === true && assessment.assertedSecret === true);
  const selected = (locked ? null : distribution.find((row) => row.part === selectedPartOverride)) || distribution[0];
  const definition = getActorialPartDefinitions()[selected.part] || {};
  const relevantDrivers = drivers
    .filter((driver) => driver.part === selected.part)
    .sort((left, right) => Math.abs(right.contribution) - Math.abs(left.contribution));
  return {
    id: selected.part,
    label: worldActorialLabel(selected.part, world, publicDueEvidence),
    contract: oneLine(definition.contract),
    probability: selected.probability,
    score: selected.score,
    temperature: Math.min(3, Math.max(0.05, Number(temperature) || 0.15)),
    distribution,
    drivers: relevantDrivers,
    reason: relevantDrivers.length
      ? relevantDrivers.slice(0, 3).map((driver) => driver.source.replace(/_/gu, ' ')).join('; ')
      : 'default public scene partnership',
    authored_role: enactedRelease ? worldActorialLabel('authored_source', world, publicDueEvidence) : null,
    evidence_enactment: publicDueEvidence.length
      ? {
          active: true,
          mode: enactedRelease ? 'enacted_role' : 'presented_exhibit',
          authored_role: enactedRelease ? worldActorialLabel('authored_source', world, publicDueEvidence) : null,
          entry_count: publicDueEvidence.length,
        }
      : { active: false, mode: null, authored_role: null, entry_count: 0 },
    selection_method: locked ? 'structural_lock' : selectedPartOverride ? 'seeded_distribution' : 'argmax',
    locked,
    lock_reason: locked ? 'licensed_closeout' : null,
  };
}

export function buildTutorStubResponseConfiguration({
  engagementStance,
  legacySelectedRegister = null,
  stanceDistribution = null,
  stanceVector = null,
  temperature = null,
  policy = null,
  learnerText = '',
  classification = null,
  tutorLearnerDag = null,
  comprehension = null,
  world = null,
  proposedActionFamily = null,
  releasePacing = null,
  dueEvidence = [],
  recentActorialParts = [],
  actorialPartOverride = null,
} = {}) {
  const action = selectTutorStubActionFamily({ classification, tutorLearnerDag, comprehension, releasePacing });
  const audience = selectTutorStubAudienceRegister({ learnerText, classification, tutorLearnerDag, comprehension });
  const lexical = selectTutorStubLexicalAccessibility({ classification, tutorLearnerDag, comprehension });
  const scene = selectTutorStubSceneImmersion({ classification, comprehension, world });
  const actorialPart =
    actorialPartOverride ||
    selectTutorStubActorialPart({
      engagementStance: engagementStance || 'precise',
      stanceDistribution,
      actionFamily: action.actionFamily,
      temperature,
      classification,
      tutorLearnerDag,
      comprehension,
      world,
      dueEvidence,
      recentActorialParts,
    });
  const actorialPerformance = selectTutorStubActorialPerformance({
    engagementStance: engagementStance || 'precise',
    actorialPart: actorialPart.id,
  });
  const learnerAdvance = learnerAdvanceFrom(tutorLearnerDag);
  const unresolvedTerms = [...(comprehensionFeatures(comprehension).unresolvedTerms || [])];
  const audienceSentenceBudget = Number(
    getAudienceRegisterDefinitions()[audience.audienceRegister]?.max_average_sentence_words || 30,
  );
  const lexicalSentenceBudget = Number(
    getLexicalAccessibilityDefinitions()[lexical.lexicalAccessibility]?.max_average_sentence_words || 32,
  );
  return {
    schema: RESPONSE_CONFIGURATION_SCHEMA,
    policy,
    engagement_stance: engagementStance || 'precise',
    action_family: action.actionFamily,
    audience_register: audience.audienceRegister,
    lexical_accessibility: lexical.lexicalAccessibility,
    scene_immersion: scene.sceneImmersion,
    actorial_part: actorialPart.id,
    actorial_part_label: actorialPart.label,
    actorial_host_part: actorialPart.id,
    actorial_host_part_label: actorialPart.label,
    actorial_part_selection: actorialPart,
    evidence_enactment: actorialPart.evidence_enactment,
    actorial_performance: actorialPerformance,
    surface_budgets: {
      max_average_sentence_words: Math.min(audienceSentenceBudget, lexicalSentenceBudget),
    },
    unresolved_terms: unresolvedTerms,
    learner_advance: learnerAdvance ? structuredClone(learnerAdvance) : null,
    release_pacing: releasePacing ? structuredClone(releasePacing) : null,
    engagement_stance_distribution: Array.isArray(stanceDistribution) ? structuredClone(stanceDistribution) : null,
    engagement_stance_vector: stanceVector && typeof stanceVector === 'object' ? structuredClone(stanceVector) : null,
    engagement_stance_temperature: Number.isFinite(Number(temperature)) ? Number(temperature) : null,
    actorial_part_temperature: actorialPart.temperature,
    temperature_scope: 'engagement_stance_and_actorial_part',
    selection_reasons: {
      action_family: action.reason,
      audience_register: audience.reason,
      lexical_accessibility: lexical.reason,
      scene_immersion: scene.reason,
      actorial_part: actorialPart.reason,
      actorial_performance: `Realize ${engagementStance || 'precise'} through the selected public part instead of attaching a tone label to generic tutor prose.`,
    },
    compatibility: {
      selected_register: engagementStance || 'precise',
      legacy_selected_register: legacySelectedRegister,
      proposed_action_family: proposedActionFamily,
    },
  };
}

function definitionContract(definitions, key, field = 'contract') {
  return oneLine(definitions?.[key]?.[field]);
}

export function tutorStubResponseConfigurationPrompt(configuration) {
  if (!configuration) return '';
  const actionDefinitions = getActionFamilyDefinitions();
  const audienceDefinitions = getAudienceRegisterDefinitions();
  const lexicalDefinitions = getLexicalAccessibilityDefinitions();
  const sceneDefinitions = getSceneImmersionDefinitions();
  const actorialDefinitions = getActorialPartDefinitions();
  const stance = configuration.engagement_stance;
  const stanceContract = oneLine(getEngagementStanceDefinition(stance)?.stance_contract);
  const unresolved = configuration.unresolved_terms?.length ? configuration.unresolved_terms.join(', ') : 'none';
  return [
    '[Tutor-only response configuration]',
    `Engagement stance: ${stance}. ${stanceContract}`,
    `Action family: ${configuration.action_family}. ${definitionContract(
      actionDefinitions,
      configuration.action_family,
      'description',
    )}`,
    `Audience register: ${configuration.audience_register}. ${definitionContract(
      audienceDefinitions,
      configuration.audience_register,
    )}`,
    `Lexical accessibility: ${configuration.lexical_accessibility}. ${definitionContract(
      lexicalDefinitions,
      configuration.lexical_accessibility,
    )}`,
    `Sentence budget: average no more than ${configuration.surface_budgets?.max_average_sentence_words || 24} words. Split compound evidence and inference into separate sentences instead of compressing them into semicolon chains.`,
    `Scene immersion: ${configuration.scene_immersion}. ${definitionContract(
      sceneDefinitions,
      configuration.scene_immersion,
    )}`,
    `Actorial host part: ${configuration.actorial_part_label || configuration.actorial_part}. ${definitionContract(
      actorialDefinitions,
      configuration.actorial_part,
    )}`,
    configuration.actorial_part_selection?.authored_role
      ? `Authored public clue source: ${configuration.actorial_part_selection.authored_role}. This source enactment is separate from the adaptive host part. Let the host respond to the learner and frame the encounter, then voice the supplied evidence from inside the source in first person inside quotation marks. Do not prefix the speech with the role name or a stage direction. The source supplies no knowledge beyond the public clue in the current turn context.`
      : null,
    `Performance tactic: ${configuration.actorial_performance?.label || 'direct in-scene enactment'}. ${oneLine(
      configuration.actorial_performance?.contract ||
        'Enter through a concrete character action or spoken line and keep the learner inside the scene.',
    )}`,
    `Unresolved terms: ${unresolved}.`,
    configuration.learner_advance?.accelerated
      ? `Learner pace: accelerating. Credit all ${configuration.learner_advance.supportedMoveCount} warranted learner-owned proof moves already made; do not ask for any of them again. Test or extend only the next unresolved edge.`
      : 'Learner pace: steady unless the public turn itself warrants otherwise.',
    configuration.release_pacing?.direction === 'accelerate'
      ? `Clue release: faster at ${configuration.release_pacing.effectiveSpeed}x. Stage at most one newly available clue batch now, with a short handoff and no redundant proof demand.`
      : configuration.release_pacing?.direction === 'decelerate'
        ? `Clue release: slower at ${configuration.release_pacing.effectiveSpeed}x. Do not add a new clue unless it is already due; consolidate one public step first.`
        : `Clue release: authored pace at ${configuration.release_pacing?.effectiveSpeed ?? 1}x; add no more than one authored clue batch this turn.`,
    'These are independent axes. Perform the action family and visibly take the actorial host part; do not infer either one from the engagement stance or replace it with an authored clue source.',
    'Temperature sharpens or broadens only the engagement-stance and actorial-part distributions. Do not blur the audience, lexical, action, or scene contracts.',
    'Enter the part through concrete first-person action or direct speech. Do not use a role-name speaker label, stage direction, description of acting, or announcement of an abstract teaching strategy. Preserve the learner-responsive opening and let it flow into the scene as one voice.',
    'Forbidden meta-frames: “let’s role-play,” “I’ll be,” “I’ll take the part,” “speaking as,” “back to us,” and any stock announcement that another piece of information is being supplied. Let the scene itself signal the arrival.',
    'Make every selected axis visible in the wording while never naming this configuration or its machinery.',
    '[End tutor-only response configuration]',
  ].join('\n');
}

function responseSentences(text) {
  const sentences = oneLine(text)
    .split(/(?<=[.!?])\s+|(?<=[.!?][”"'’])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  return sentences.length ? sentences : oneLine(text) ? [oneLine(text)] : [];
}

function responseWords(text) {
  return oneLine(text).match(/[\p{L}\p{N}'-]+/gu) || [];
}

function sentenceBudgetVisible(actualAverage, authoredMaximum) {
  const maximum = Number(authoredMaximum);
  if (!Number.isFinite(maximum)) return true;
  // Sentence segmentation and short scenic fragments make a hard one-word
  // cliff too brittle for a transcript-visibility heuristic. Preserve the
  // authored target while allowing a ten-percent measurement margin; prose
  // that is materially denser still fails the axis.
  const tolerance = Math.max(1, maximum * 0.1);
  return Number(actualAverage) <= maximum + tolerance;
}

function normalizedTerm(value) {
  return oneLine(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' -]/gu, '');
}

function termIsGlossed(text, term) {
  const key = normalizedTerm(term);
  if (!key) return false;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`\\b${escaped}\\b[^.!?]{0,60}\\b(?:is|means|refers to|was|were|used for|used to)\\b`, 'iu').test(
    text,
  );
}

function worldLexicon(world) {
  if (!world) return [];
  const strings = [
    world.title,
    world.setting,
    world.question,
    world.publicQuestion,
    world.opening,
    world.openingSituation,
    world.openingFrame?.situation,
    world.openingFrame?.authoredText,
  ];
  if (world.premiseById instanceof Map) {
    for (const premise of world.premiseById.values())
      strings.push(premise?.surface, JSON.stringify(premise?.fact || ''));
  }
  const counts = new Map();
  for (const word of strings
    .join(' ')
    .toLowerCase()
    .match(/[\p{L}][\p{L}'-]{3,}/gu) || []) {
    if (WORLD_STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0]))
    .slice(0, 80)
    .map(([word]) => word);
}

function stanceVisible(stance, text, metrics) {
  const lower = text.toLowerCase();
  const definition = getEngagementStanceDefinition(stance) || {};
  if (['ironic', 'sarcastic', 'face_threat'].includes(stance)) {
    const cues = definition.stance_fidelity_cues || [];
    return cues.some((cue) => lower.includes(String(cue).toLowerCase()));
  }
  if (stance === 'plain') return metrics.averageSentenceWords <= 18 && metrics.wordCount <= 100;
  if (stance === 'precise')
    return /\b(?:if|because|means|rather than|but not|not .{0,24} but|not merely|not yet|must still|would count|distinction|exact|establish|no more|did not|does not|doesn[’']t|fails? to (?:establish|prove|show|tie)|only|limit|until|unproved)\b/iu.test(text);
  if (stance === 'brisk') return metrics.wordCount <= 70 && metrics.sentenceCount <= 4;
  if (stance === 'warm')
    return /\b(?:let's|we can|try|notice|you can|start with|take|beside|between us|together|both (?:read|test)|leav(?:e|ing) (?:you )?room|room for you|how do you read)\b/iu.test(text);
  if (stance === 'witnessing')
    return /\b(?:i hear|that sounds|you are naming|you've named|it makes sense|there is no need)\b/iu.test(text);
  if (stance === 'charismatic')
    return /\b(?:break|but|yet|choose|risk|refuse|test|stake|stop|now|outrun|outruns|outrun the|easy verdict|old suspicion)\b/iu.test(
      text,
    );
  return true;
}

function actionVisible(actionFamily, text, metrics, unresolvedTerms) {
  const glossed = unresolvedTerms.filter((term) => termIsGlossed(text, term));
  if (actionFamily === 'clarify_term') {
    return unresolvedTerms.length
      ? glossed.length === unresolvedTerms.length
      : /\b(?:is|means|refers to)\b/iu.test(text);
  }
  if (actionFamily === 'clarify_distinction') {
    return (
      /\b(?:means|rather than|not .{0,24} but|distinction|difference|which)\b/iu.test(text) ||
      /\b(?:establishes?|shows?|supports?|proves?)\b[^.!?]{0,90}\b(?:but|not|only|rather than)\b|\b(?:not|only)\b[^.!?]{0,70}\b(?:establish|show|support|prove)\w*\b/iu.test(
        text,
      ) ||
      metrics.questionCount > 0
    );
  }
  if (actionFamily === 'stage_next_step') {
    const explicitDirection =
      /\b(?:ask|before|next|need(?:ed|s)?|must|only if|requires?|until|let(?:[’']s| us)|shall we|compare|examine|inspect|test|trace|check)\b|\bto\s+(?:name|decide|settle|conclude)\b[^.!?]{0,45}\bneed\b/iu.test(
        text,
      );
    return metrics.wordCount <= 110 && (metrics.questionCount > 0 || explicitDirection);
  }
  if (actionFamily === 'answer_accountably') {
    const explicitAccount =
      /\b(?:because|before|if|unless|until|would count|could show|test|check|wrong|revise)\b|\bnot\b[^.!?]{0,28}\b(?:convict|proof|prove|verdict)\b/iu.test(
        text,
      );
    const directCorrectiveAnswer =
      /\b(?:establishes?|identif(?:y|ies)|means|puts?|says?|shows?|supports?|ties?)\b[^.!?]{0,110}\b(?:but\s+)?not\b|\bnot\b[^.!?]{0,90}\b(?:establish|identify|mean|place|prove|show|support|tie)\w*\b/iu.test(
        text,
      );
    return explicitAccount || directCorrectiveAnswer;
  }
  if (actionFamily === 'compress_sayback') return metrics.wordCount <= 85 && metrics.questionCount > 0;
  if (actionFamily === 'reanchor_lived_stake') return metrics.secondPerson && metrics.concreteSceneTermCount > 0;
  if (actionFamily === 'reanchor_public_evidence') {
    const visibleBoundary =
      /\b(?:record stands|not yet|does not|doesn[’']t|only|remains? (?:open|unentered|unproved)|still (?:need|open|unproved)|hold (?:there|that)|leave (?:the )?(?:claim|conclusion|verdict) open)\b/iu.test(
        text,
      );
    return metrics.concreteSceneTermCount > 0 && (metrics.questionCount > 0 || visibleBoundary);
  }
  if (actionFamily === 'ground_in_material') return metrics.concreteSceneTermCount > 0;
  if (actionFamily === 'challenge_resistance')
    return /\b(?:but|instead|choose|test|stop|risk|refuse|try)\b/iu.test(text);
  if (actionFamily === 'receive_vulnerability') {
    return /\b(?:i hear|that sounds|you are naming|you've named|it makes sense|you can)\b/iu.test(text);
  }
  if (actionFamily === 'close_inquiry')
    return metrics.questionCount === 0 && /\b(?:closed|settled|conclude|therefore)\b/iu.test(text);
  return metrics.wordCount <= 110;
}

function actorialPartVisible(configuration, text, metrics) {
  const part = configuration.actorial_part;
  if (!part) return false;
  if (part === 'scene_partner') {
    return /\b(?:let(?:[’']s| us)|we(?: can| will|[’']ll)?|with (?:me|you)|beside (?:me|you)|between us|together|come beside|i stand beside you|(?:bring|draw) you beside|i (?:draw|pull|set) (?:my|a) chair beside|i leave you (?:the|this|that)\b[^.!?]{0,30}|clear (?:a )?space[^.!?]{0,45}for you|leav(?:e|ing) you room|leav(?:e|ing) (?:room|space)[^.!?]{0,45}for (?:you|your\b[^.!?]{0,20})|make (?:room|space)[^.!?]{0,40}beside me|make (?:room|space) for you|make (?:room|space) at (?:the )?(?:balance|bench|table|trial-table)|room beside|space for you)\b/iu.test(text) &&
      (metrics.concreteSceneTermCount > 0 || /\b(?:log|ledger|book|record|file|tool|sample|assay|clue|entry|line)\b/iu.test(text));
  }
  if (part === 'examiner') {
    const namedExaminingAction =
      /\b(?:i|we|let(?:[’']s| us))\b[^.!?]{0,55}\b(?:bring|check|clear|circle|compare|demonstrate|dip|draw|examine|hold|inspect|keep|lay|lift|look|lower|mark|open|place|plant|point|press|prise|put|read|rest|rub|run|scrape|set|show|slap|slide|snap|spread|steady|steep|strike|tap|taste|test|tilt|tip|touch|trace|turn|unfold|warm|weigh)\b|\b(?:under the lens|on the table|side by side)\b/iu.test(
        text,
      ) ||
      /\b(?:compare|examine|hold|inspect|look at|test|trace)\b[^.!?]{0,60}\bwith me\b/iu.test(text);
    const physicallyHandlesSceneObject =
      metrics.concreteSceneTermCount > 0 &&
      /\b(?:i|we)\b[^.!?]{0,70}\b(?:across|against|along|atop|beside|beneath|into|onto|over|through|under)\b/iu.test(
        text,
      );
    return namedExaminingAction || physicallyHandlesSceneObject;
  }
  if (part === 'record_keeper') {
    return (
      /\bi\s+(?:close|draw|enter|hold|keep|lay|leave|mark|open|press|read|slide|strike|turn|underline|write)\b[\s\S]{0,180}\b(?:log|ledger|book|record|file|history|notebook|report|roll|sheet|notes?|inventory|rack card|trial-book|incident log|mod log|formulation card|version history)\b/iu.test(
        text,
      ) ||
      /\b(?:i|we|let(?:[’']s| us))\b[^.!?]{0,55}\b(?:close|draw|enter|hold|keep|lay|leave|mark|open|press|read|slide|strike|turn|underline|write)\b[^.!?]{0,55}\b(?:log|ledger|book|record|file|history|notebook|report|roll|sheet|notes?|inventory|rack card|trial-book|incident log|mod log|formulation card|version history)\b|\b(?:log|ledger|book|record|file|history|notebook|report|roll|sheet|notes?|inventory|rack card|trial-book|incident log|mod log|formulation card|version history)\b[^.!?]{0,55}\b(?:close|draw|enter|hold|keep|lay|leave|mark|open|press|read|slide|strike|turn|underline|write)\b/iu.test(text) ||
      (metrics.concreteSceneTermCount > 0 &&
        /\bi\b[^.!?]{0,95}\b(?:enter|leave|record|write|mark)\s+(?:that|this|it|the (?:entry|line|record|limit))\b/iu.test(text)) ||
      /\bi\s+leave\b[^.!?]{0,55}\b(?:entry|line|name|verdict)\b[^.!?]{0,25}\b(?:blank|open|unentered|uninked|unwritten)\b/iu.test(text) ||
      /\b(?:book|ledger|log|record|sheet)\b[^.!?]{0,70}\b(?:blank|open|unentered|unwritten)\b|\bnothing\s+(?:is|was)\s+entered\b/iu.test(text) ||
      (metrics.concreteSceneTermCount > 0 &&
        /\b(?:book|file|history|ledger|log|notebook|rack card|record|report|sheet|trial-book|version history)\b[^.!?]{0,25}\b(?:contains?|gives?|holds?|marks?|reads?|says?|shows?)\b/iu.test(text))
    );
  }
  if (part === 'authored_source') {
    const role = oneLine(configuration.actorial_part_selection?.authored_role || configuration.actorial_part_label);
    const metaCasting = /\b(?:let(?:[’']s| us)\s+role-play|i(?:[’']ll| will)\s+(?:be|become|play|take the part)|speaking as|in the role of)\b/iu.test(
      text,
    );
    const frame = {
      entries: [{ mode: 'enacted_role', role }],
    };
    return (
      !metaCasting &&
      !tutorStubRoleStageDirectionVisible({ text, frame }) &&
      tutorStubFirstPersonRoleVoiceVisible(text)
    );
  }
  if (part === 'advocate') {
    const announcedCase =
      /\b(?:i\s+argue|i(?:[’']ll| will| am going to) (?:argue|make|put)|i rest my case|my case (?:is|rests)|the strongest case|take the case for)\b/iu.test(
        text,
      ) && /\b(?:test|break|challenge|resist|object|what would|show me)\b/iu.test(text);
    const stagesBoundedCase =
      /\bi\s+(?:lay|place|put|set)\b[^.!?]{0,65}\bcase\b[^.!?]{0,95}\b(?:cannot|can[’']t|does not|doesn[’']t|gap|not yet|test|unshown|without)\b/iu.test(
        text,
      );
    const directlyAddressesPublicJudgment =
      metrics.concreteSceneTermCount > 0 &&
      /\b(?:i|we)\b[^.!?]{0,80}\b(?:address|face|raise|turn to)\b[^.!?]{0,55}\b(?:bench|crowd|hall|room|town|warden|witnesses?)\b/iu.test(
        text,
      ) && /(?:[“"]\s*(?:look|mark|see)\b|\b(?:accusation|case|charge|verdict)\b)/iu.test(text);
    const takesAccountablePosition =
      /\b(?:i|we)\s+(?:can|cannot|can[’']t|do|do not|don[’']t|will|will not|won[’']t|would|would not|wouldn[’']t)\b[^.!?]{0,85}\b(?:because|before|but|if|unless|until)\b/iu.test(
        text,
      ) && /\b(?:accusation|case|charge|convict|evidence|proof|prove|verdict)\b/iu.test(text);
    const forcesPublicJudgmentToFaceEvidence =
      /\b(?:i|we)\b[^.!?]{0,80}\b(?:force|make)\b[^.!?]{0,35}\b(?:crowd|hall|room|town|warden|witnesses?)\b[^.!?]{0,35}\b(?:face|hear|see|test)\b/iu.test(
        text,
      );
    const stagesEvidenceAgainstPublicCharge =
      /\bi\b[^.!?]{0,45}\b(?:hold|lay|place|press|set|slide)\b[^.!?]{0,60}\b(?:beside|against|before)\b[^.!?]{0,45}\b(?:accusation|case|charge|guilt|name|verdict)\b/iu.test(
        text,
      ) && /\b(?:cannot|can[’']t|does not|doesn[’']t|fails?|not enough|unproved)\b/iu.test(text);
    const directlyPressesPublicCase =
      /\bi\s+press\b[^.!?]{0,45}\b(?:crowd|hall|room|town|warden|witnesses?)[’']?s?\b[^.!?]{0,30}\b(?:accusation|case|charge|claim|verdict)\b/iu.test(
        text,
      ) && /\b(?:but|challenge|evidence|if|not yet|test|until)\b/iu.test(text);
    const boundsPublicCase =
      /\bi\s+(?:can|cannot|can[’']t|would|will|won[’']t)\b[^.!?]{0,45}\b(?:carry|press|take)\b[^.!?]{0,45}\b(?:accusation|case|charge|claim)\b[^.!?]{0,35}\b(?:further|farther|past|beyond)\b/iu.test(
        text,
      );
    const directlyMakesEvidenceCase =
      /\bi\s+make the case\b/iu.test(text) &&
      /\b(?:because|doubt|evidence|establish(?:es|ed)?|responsibility|ruined|verdict)\b/iu.test(text);
    const offersCaseForFalsification =
      /\btaken together\b[^.!?]{0,100}\b(?:caused|contaminated|ruined|shows?)\b[^.!?]{0,110}\bunless you can\b[^.!?]{0,70}\b(?:breaks?|challenges?|disproves?|refutes?)\b/iu.test(
        text,
      );
    const pressesExhibitIntoPublicArgument =
      /\bi\s+press\b[^.!?]{0,65}\binto\b[^.!?]{0,50}\b(?:argument|case|charge|claim|verdict)\b/iu.test(
        text,
      ) && /\b(?:nothing|not|until|unproved)\b/iu.test(text);
    const directlyRefusesReadyVerdict =
      /\bi\s+refuse\b[^.!?]{0,35}\b(?:easy|obvious|quick|ready)?\s*(?:accusation|answer|case|charge|claim|story|verdict)\b/iu.test(
        text,
      ) && /\b(?:crowd|hall|room|town|warden|witnesses?)\b/iu.test(text);
    const holdsEvidenceAgainstPublicCry =
      /\bi\s+hold\b[^.!?]{0,45}\b(?:entry|evidence|mark|record|shilling)\b[^.!?]{0,45}\bagainst\b[^.!?]{0,45}\b(?:crowd|hall|room|town|warden|witnesses?)(?:[’']s)?\b[^.!?]{0,25}\b(?:accusation|case|charge|claim|cry|verdict)\b/iu.test(
        text,
      ) && /\b(?:cannot|can[’']t|does not|doesn[’']t|not|unproved|without)\b/iu.test(text);
    const putsCaseToPublicAuthority =
      /\bi\s+(?:can|will|would)\s+put the case to\b[^.!?]{0,45}\b(?:bench|crowd|hall|pi|room|town|warden|witnesses?)\b[^.!?]{0,35}\b(?:as follows|this way)\b/iu.test(
        text,
      ) &&
      /\b(?:if|unless)\b[^.!?]{0,100}\b(?:break|challenge|contradict|disprove|object|refute)\w*\b/iu.test(
        text,
      );
    const statesSupportedFindingForTesting =
      /\bstill\b[^.!?]{0,80}\b(?:caused|contaminated|ruined)\b/iu.test(text) &&
      /\b(?:breach(?:ed)?|evidence|held|match(?:ed|es)?|overnight|record|same|strain)\b/iu.test(text) &&
      metrics.questionCount > 0;
    const makesCaseForSupportedCause =
      /\bmake(?:s)? the case that\b[^.!?]{0,100}\b(?:caused|contaminated|ruined)\b/iu.test(text) &&
      metrics.questionCount > 0;
    const offersLiveCaseToBreak =
      /\b(?:break|challenge|test)\s+(?:my|our|the)\s+(?:case|charge|claim)\b/iu.test(text) &&
      /\b(?:but|evidence|not yet|still|unless|until)\b/iu.test(text);
    const putsCaseAgainstPublicVerdictToTest =
      /\bmy case\b[^.!?]{0,70}\bagainst\b[^.!?]{0,45}\b(?:crowd|hall|room|town|warden|witnesses?)(?:[’']s)?\b[^.!?]{0,30}\b(?:accusation|case|charge|claim|verdict)\b[^.!?]{0,45}\bis this\b/iu.test(
        text,
      ) && /\bbreak it\b/iu.test(text);
    return (
      announcedCase ||
      stagesBoundedCase ||
      directlyAddressesPublicJudgment ||
      takesAccountablePosition ||
      forcesPublicJudgmentToFaceEvidence ||
      stagesEvidenceAgainstPublicCharge ||
      directlyPressesPublicCase ||
      boundsPublicCase ||
      directlyMakesEvidenceCase ||
      offersCaseForFalsification ||
      pressesExhibitIntoPublicArgument ||
      directlyRefusesReadyVerdict ||
      holdsEvidenceAgainstPublicCry ||
      putsCaseToPublicAuthority ||
      statesSupportedFindingForTesting ||
      makesCaseForSupportedCause ||
      offersLiveCaseToBreak ||
      putsCaseAgainstPublicVerdictToTest
    );
  }
  if (part === 'skeptic') {
    const explicitlyRejectsClaim =
      /\bi\s+(?:(?:would|will|do|can)\s+not|cannot|won[’']t|don[’']t|can[’']t)\s+(?:accept|admit|allow|call|carry|enter|move|say|write)\b/iu.test(
        text,
      ) ||
      /\b(?:i|we)\s+(?:must|should|will|would)\s+refuse to\s+(?:accept|call|carry|enter|move|say|write)\b|\bwhat\s+(?:claim|conclusion|name|verdict)\b[^?]{0,65}\bmust we refuse to\s+(?:accept|call|carry|enter|move|say|write)\b/iu.test(
        text,
      );
    const comparesClaimWithRecord =
      /\bi\s+(?:check|hold|lay|place|press|set|slide|tap|test)\b[^.!?]{0,85}\b(?:against|beside)\b/iu.test(text) &&
      /\b(?:but|did not|didn[’']t|does not|doesn[’']t|not (?:enough|evidence|in|proof|that|yet)|rather than)\b/iu.test(text);
    const marksClaimBoundary =
      /\bi\s+(?:draw|mark|underline)\b[^.!?]{0,45}\b(?:boundary|correction|limit|line)\b/iu.test(text) &&
      /\b(?:but|did not|didn[’']t|does not|doesn[’']t|not that|not yet|rather than)\b/iu.test(text);
    const voicesConcreteObjection =
      /\b(?:(?:my|one|the|this)\s+(?:only\s+)?objection\b|i\b[^.!?]{0,35}\b(?:object\b|press\b[^.!?]{0,20}\bthe objection\b))/iu.test(
        text,
      ) &&
      /\b(?:because|break|merely|neither|nor|not|rather than|still|whether)\b/iu.test(text);
    const visiblyStopsAtBoundary =
      /\bi\b[^.!?]{0,80}\bstop there\b/iu.test(text) &&
      /\b(?:but|not yet|only if|still need|until)\b/iu.test(text);
    const opensWithCorrection = /^\s*(?:no\b|not so\b|not yet\b)/iu.test(text);
    const testsWordingBoundary =
      /\bi\b[^.!?]{0,55}\btest\b[^.!?]{0,30}\b(?:claim|conclusion|entry|language|verdict|wording)\b[^.!?]{0,90}\b(?:not|rather than|instead of)\b/iu.test(
        text,
      );
    const keepsCompetingEvidenceSeparate =
      /\bi\s+keep\b[^.!?]{0,80}\bseparate\b[^.!?]{0,100}\b(?:does not|doesn[’']t|not yet|still need|unproven)\b/iu.test(
        text,
      );
    const physicallyWithholdsUnprovedLink =
      /\bi\b[^.!?]{0,75}\b(?:hold|keep|lay|pull|set|slide|tap|test)\b[^.!?]{0,120}\bunless\b[^.!?]{0,100}\b(?:remain|remains|stay|stays)\s+unproven\b/iu.test(
        text,
      );
    const holdsBackPrematureVerdict =
      /\bi\b[^.!?]{0,75}\bhold back\b[^.!?]{0,35}\b(?:accusation|answer|case|charge|claim|conclusion|name|verdict)\b/iu.test(
        text,
      ) && /\b(?:not yet|still|until|unproved|without)\b/iu.test(text);
    const narrowsEstablishedClaim =
      /\b(?:establishes?|shows?|supports?)\b[^.!?]{0,100},?\s+not\b/iu.test(text);
    const holdsSceneAtUnsupportedAttribution =
      /\bi\s+(?:hold|keep|lay|leave|place|set|slide)\b[\s\S]{0,220}\b(?:cannot|can[’']t|does not|doesn[’']t|no\b[^.!?]{0,60}\b(?:identif|name|record|show)|not\b[^.!?]{0,60}\b(?:identif|name|record|show))\w*\b/iu.test(
        text,
      );
    const stopsAtUnsupportedLink =
      /\bi\s+stop\b[^.!?]{0,120}\b(?:cannot|can[’']t|does not|doesn[’']t|not yet|unshown|without)\b/iu.test(
        text,
      );
    const opensWithConcreteBoundary =
      /^(?:[^.!?]{0,100})\b(?:does not|doesn[’']t|not yet|still unshown|remains unshown)\b[^.!?]{0,120}/iu.test(
        text,
      );
    const refusesUnsupportedNameInPublicSpeech =
      /\bnothing\b[^.!?]{0,100}\b(?:identif(?:y|ies)|names?|ties?)\b[^.!?]{0,80}\b(?:name|person|tool|holder|hand)\b|\ba name\b[^.!?]{0,60}\b(?:too (?:quickly|soon)|without|unproved)\b/iu.test(
        text,
      );
    const refusesToPlacePersonUnderUnsupportedMark =
      /\bi\s+cannot\s+(?:place|put|set)\b[^.!?]{0,85}\b(?:beneath|under)\b[^.!?]{0,55}\b(?:yet|without)\b/iu.test(
        text,
      );
    return (
      /\b(?:i object|not so fast|i(?:[’']ll| will) challenge|let me challenge|cross-examine|weak link|that does not yet|doesn(?:[’']t| not) yet|not yet (?:show|prove|establish|tie|name)|public evidence does not settle)\b/iu.test(text) ||
      /\bi\s+(?:will not|won[’']t|refuse to)\s+let\b[^.!?]{0,65}\b(?:bear|carry)\b[^.!?]{0,35}\b(?:weight|proof|conclusion|verdict)\b/iu.test(
        text,
      ) ||
      explicitlyRejectsClaim ||
      comparesClaimWithRecord ||
      marksClaimBoundary ||
      voicesConcreteObjection ||
      visiblyStopsAtBoundary ||
      opensWithCorrection ||
      testsWordingBoundary ||
      keepsCompetingEvidenceSeparate ||
      physicallyWithholdsUnprovedLink ||
      holdsBackPrematureVerdict ||
      narrowsEstablishedClaim ||
      holdsSceneAtUnsupportedAttribution ||
      stopsAtUnsupportedLink ||
      opensWithConcreteBoundary ||
      refusesUnsupportedNameInPublicSpeech ||
      refusesToPlacePersonUnderUnsupportedMark
    );
  }
  if (part === 'foreperson') {
    return /\b(?:finding|verdict|case is closed|close the (?:case|record|book|log|ledger|inquiry)|we can conclude|therefore)\b/iu.test(text) && metrics.questionCount === 0;
  }
  return false;
}

function actorialHostSurface(configuration, text) {
  const hasAuthoredSource = Boolean(configuration?.actorial_part_selection?.authored_role);
  if (!hasAuthoredSource) return text;
  return String(text || '')
    .replace(/“[^”]*”/gu, '. ')
    .replace(/"(?:[^"\\]|\\.)*"/gu, '. ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function actorialPerformanceVisible(configuration, text, metrics) {
  const tactic = configuration.actorial_performance?.id;
  if (!tactic) return true;
  if (tactic === 'unadorned_report') {
    const plainlyHandledExhibit =
      metrics.wordCount <= 85 &&
      metrics.questionCount <= 1 &&
      /\bi\b[^.!?]{0,45}\b(?:check|draw|examine|hold|lift|open|read|rub|scrape|set|show|steady|test|turn|weigh)\b/iu.test(text) &&
      !/\b(?:as if|behold|destiny|fate|ghost|haunt|thunder|whisper)\b/iu.test(text);
    return (metrics.averageSentenceWords <= 18 && metrics.wordCount <= 100) || plainlyHandledExhibit;
  }
  if (tactic === 'evidentiary_boundary') {
    return (
      /\b(?:beyond|exact|establish|licensed|line that matters|no more|did not|does not|doesn[’']t|fails? to (?:establish|prove|show|tie)|limit|nothing yet|only|not merely|not proof|not that|not yet|must still|remains? unshown|what remains|until|unproved)\b/iu.test(text) ||
      /\byet\s+not\b[^.!?]{0,45}\b(?:alone|by itself|enough|sufficient)\b/iu.test(text) ||
      /\bmust\b[^.!?]{0,50}\b(?:before|still)\b|\bneed\b[^.!?]{0,90}\bbefore\b|\bstill needs?\b[^.!?]{0,70}\b(?:blank|die|evidence|hand|link|mark|proof|tool)\b|\bbefore\b[^.!?]{0,80}\b(?:alloy|assay|can|coin|evidence|mark|metal|test(?:ed|ing)?)\b|\balone\b[^.!?]{0,45}\b(?:names?|proves?|shows?|ties?)\s+no\b|\bbut\b[^.!?]{0,50}\b(?:names?|proves?|shows?|ties?) (?:neither|no)\b|\bbut\s+neither\b[^.!?]{0,90}\b(?:names?|proves?|shows?|ties?)\b|\bbut\s+does\b[^?]{0,90}\byet\s+(?:name|prove|show|tie)\b|\b(?:names?|proves?|shows?)\s+neither\b|\bwhat\b[^?]{0,100}\band what\b[^?]{0,60}\b(?:leave|must|remain|unsafe|unproved)\b|\bwhat\b[^?]{0,100}\b(?:is|remains?|stays?)\s+still\s+(?:absent|missing|open|unproved)\b|\b(?:establishes?|shows?|supports?)\b[^.!?]{0,100},?\s+not\b/iu.test(text)
    );
  }
  if (tactic === 'rapid_handoff') {
    const boundedDirectQuestion =
      metrics.wordCount <= 85 &&
      metrics.questionCount === 1 &&
      /\bwhat\b[^?]{0,120}(?:\b(?:add|change|establish|matter|mean|move|rule out|settle|show|tell|tie|trace)\b|\bmake\b[^?]{0,35}\blikely\b)/iu.test(
        text,
      );
    return (
      /\b(?:already|straight|live line|your call|move the case|what does that add)\b/iu.test(text) ||
      metrics.wordCount <= 70 ||
      boundedDirectQuestion
    );
  }
  if (tactic === 'shared_scene_invitation') {
    return /\b(?:between us|both read|beside|together|stand here|clear (?:a )?space[^.!?]{0,45}for you|leav(?:e|ing) room[^.!?]{0,35}for you|make (?:room|space)[^.!?]{0,40}beside me|make (?:room|space) for you|space for you|what do you make|your reading|with me|within your reach|take the moment|we can (?:carry|take)|what\b[^.!?]{0,45}\bwould you (?:choose|want)|which\b[^.!?]{0,55}\bwould you (?:like|want)(?: me to)?)\b/iu.test(text);
  }
  if (tactic === 'measured_testimony') {
    return /\b(?:without (?:pushing|forcing)|cannot fairly|can[’']t fairly|keep (?:our|the) (?:account|claim|finding|record) to|stand as written|while (?:that|the) [^.!?]{0,35} stands|responsibly|honestly bear|let .* stand|no further)\b/iu.test(text);
  }
  if (tactic === 'dramatic_counterpressure') {
    const forcefulExhibitAction =
      /\b(?:block|challenge|confront|plant|press|push|slap|snap|strike|unsettle)\b/iu.test(text);
    const contestedPublicJudgment =
      /\b(?:easy|obvious|quick|ready|room(?:[’']s)?)\b[^.!?]{0,55}\b(?:accusation|answer|assumption|case|charge|claim|cry|guilty|murmur|story|verdict)\b[^.!?]{0,45}\b(?:break|buckl(?:e|es|ed|ing)|challenge|lose|lost|miss(?:ed)? (?:its )?mark|survive|unsettle)|\b(?:accusation|answer|assumption|case|charge|claim|cry|murmur|story|verdict)\b[^.!?]{0,45}\b(?:break|buckl(?:e|es|ed|ing)|challenge|lose|lost|miss(?:ed)? (?:its )?mark|survive|unsettle)\b|\b(?:against|before)\b[^.!?]{0,30}\b(?:easy|obvious|ready)\b[^.!?]{0,25}\b(?:charge|claim|story|verdict)\b/iu.test(
        text,
      );
    const challengesTheRoomDirectly =
      /\b(?:face|hear|look|mark|see)\b[^.!?]{0,30}\b(?:crowd|hall|room|town|warden|witnesses?)\b/iu.test(text);
    const evidenceOutweighsReputation =
      /\b(?:reputation|suspicion|town[’']s tale|ready-made (?:answer|reputation|verdict))\b[^.!?]{0,45}\b(?:cannot|can[’']t|does not|doesn[’']t|outweigh|overrule|stand against)\b[^.!?]{0,45}\b(?:evidence|mark|metal|record|result)\b/iu.test(
        text,
      );
    const publicPressureMeetsContraryEvidence =
      /\b(?:crowd|hall|room|town|warden|witnesses?)\b[^.!?]{0,65}\b(?:expects?|wants?|would (?:name|settle))\b[^.!?]{0,65}\b(?:but|yet)\b/iu.test(
        text,
      );
    const publicThreatensPrematureJudgment =
      /\b(?:crowd|hall|room|town|warden|witnesses?)\b[^.!?]{0,65}\b(?:would\s+(?:condemn|convict|hang|name)|(?:is|are) trying to leap)\b/iu.test(
        text,
      );
    const refusesPublicVerdict =
      /\b(?:crowd|hall|room|town|warden|witnesses?)\b[^.!?]{0,65}\b(?:expects?|wants?)\b[^.!?]{0,65}\b(?:accusation|answer|case|charge|claim|guilt|name|story|verdict)\b[^.!?]{0,40}\b(?:but|cannot|can[’']t|is not|isn[’']t|not a|yet)\b/iu.test(
        text,
      );
    const voicedPublicClaimMeetsEvidence =
      /\b(?:crowd|hall|room|town|warden|witnesses?)\b[^.!?]{0,40}\b(?:cries?|claims?|says?|swears?)\b[^.!?]{0,65}\b(?:but|yet)\b/iu.test(
        text,
      );
    const refusesReadyJudgment =
      /\brefus(?:e|es|ed|ing)\b[^.!?]{0,35}\b(?:crowd|hall|room|town|warden|witnesses?)\b[^.!?]{0,35}\b(?:easy|obvious|quick|ready)?\s*(?:accusation|answer|case|charge|claim|story|verdict)\b/iu.test(
        text,
      );
    const silencesPublicAccusation =
      /\b(?:silenc(?:e|es|ed|ing)|still(?:s|ed|ing)?)\b[^.!?]{0,60}\b(?:accusation|chant|cry|murmur|mutters?|name)\b/iu.test(
        text,
      );
    const concreteReadyStoryLosesDecisiveWeight =
      metrics.concreteSceneTermCount > 0 &&
      /\b(?:easy|messy|obvious|quick|ready|sloppy|usual)\b[^.!?]{0,60}\b(?:is|are|was|were)\s+not\b[^.!?]{0,35}\b(?:decisive|enough|proof|verdict)\b/iu.test(
        text,
      );
    const setsReadyStoryAsideForEvidence =
      metrics.concreteSceneTermCount > 0 &&
      /\b(?:leave|put|set)\b[^.!?]{0,60}\b(?:easy|messy|obvious|quick|ready|sloppy|usual)\b[^.!?]{0,45}\baside\b/iu.test(
        text,
      ) &&
      /\b(?:cannot|can[’']t|does not|doesn[’']t|evidence|record)\b/iu.test(text);
    const explicitlyRefusesReadyVerdict =
      /\bi\s+refuse\b[^.!?]{0,35}\b(?:easy|obvious|quick|ready)?\s*(?:accusation|answer|case|charge|claim|story|verdict)\b/iu.test(
        text,
      );
    const keepsPublicShameOutsideTheInquiry =
      /\b(?:keep|leave|let)\b[^.!?]{0,55}\b(?:anger|dislike|reputation|shame|suspicion)\b[^.!?]{0,55}\b(?:outside|out of)\b[^.!?]{0,35}\b(?:assay|case|charge|guild[- ]hall|inquiry|record|trial[- ]book|verdict)\b/iu.test(
        text,
      );
    const materialEvidenceOutweighsReadyStory =
      /\b(?:coin|evidence|mark|metal|record|result|swab|touchstone)\b[^.!?]{0,35}\b(?:bites?|cuts?|weighs?)\b[^.!?]{0,20}\b(?:harder than|through)\b[^.!?]{0,35}\b(?:crowd|hall|room|town|warden)(?:[’']s)?\b[^.!?]{0,20}\b(?:answer|case|claim|story|tale|verdict)\b/iu.test(
        text,
      );
    const publicJudgmentOutrunsEvidence =
      /\b(?:easy|obvious|quick|ready|room(?:[’']s)?|town(?:[’']s)?)\b[^.!?]{0,40}\b(?:accusation|answer|case|charge|claim|story|verdict)\b[^.!?]{0,35}\b(?:has\s+)?outruns?\b[^.!?]{0,35}\b(?:evidence|marks?|metal|record|result|stones?|swab|touchstone)\b/iu.test(
        text,
      );
    const publicEyesMeetEvidentiaryChallenge =
      /\b(?:crowd|hall|room|town|warden|witnesses?)(?:[’']s)?\s+eyes\b[^.!?]{0,65}\bbut\b[^.!?]{0,45}\b(?:does|do|is|are)\b[^.!?]{0,20}\b(?:establish|name|prove|show|tie)\w*\b/iu.test(
        text,
      );
    const publicSceneRushesPastEvidence =
      /\b(?:crowd|hall|room|sail[- ]loft|town|warden|witnesses?)\b[^.!?]{0,45}\b(?:is|are|keeps?|starts?)\b[^.!?]{0,25}\b(?:rushing|running|leaping) ahead\b[\s\S]{0,180}\b(?:does not|doesn[’']t|not yet|still (?:need|unshown)|unproved)\b/iu.test(
        text,
      );
    const publicSuspicionOutrunsMaterial =
      /\b(?:crowd|hall|room|town|warden|witnesses?)(?:[’']s)?\b[^.!?]{0,55}\b(?:old\s+)?(?:accusation|case|charge|claim|suspicion|verdict)\b[^.!?]{0,35}\b(?:has\s+)?outruns?\b[^.!?]{0,35}\b(?:evidence|mark|metal|record|result)\b/iu.test(
        text,
      );
    const publicVerdictMeetsBreakableCase =
      /\bmy case\b[^.!?]{0,70}\bagainst\b[^.!?]{0,45}\b(?:crowd|hall|room|town|warden|witnesses?)(?:[’']s)?\b[^.!?]{0,30}\b(?:accusation|case|charge|claim|verdict)\b[\s\S]{0,150}\bbreak it\b/iu.test(
        text,
      );
    return (
      forcefulExhibitAction ||
      contestedPublicJudgment ||
      challengesTheRoomDirectly ||
      evidenceOutweighsReputation ||
      publicPressureMeetsContraryEvidence ||
      publicThreatensPrematureJudgment ||
      refusesPublicVerdict ||
      voicedPublicClaimMeetsEvidence ||
      refusesReadyJudgment ||
      silencesPublicAccusation ||
      concreteReadyStoryLosesDecisiveWeight ||
      setsReadyStoryAsideForEvidence ||
      explicitlyRefusesReadyVerdict ||
      materialEvidenceOutweighsReadyStory ||
      publicJudgmentOutrunsEvidence ||
      publicEyesMeetEvidentiaryChallenge ||
      publicSceneRushesPastEvidence ||
      publicSuspicionOutrunsMaterial ||
      publicVerdictMeetsBreakableCase ||
      keepsPublicShameOutsideTheInquiry
    );
  }
  if (tactic === 'exposed_mismatch') return /\b(?:apparently|as if|not exactly|small irony|conveniently)\b/iu.test(text);
  if (tactic === 'dry_counterexample') return /\b(?:wonderful|nice trick|conveniently|apparently)\b/iu.test(text);
  if (tactic === 'adversarial_pressure') return /\b(?:stop|refuse|weak|failed|answer now|choose)\b/iu.test(text);
  return false;
}

function visibleSignature(metrics) {
  const length = metrics.wordCount <= 60 ? 'short' : metrics.wordCount <= 110 ? 'medium' : 'long';
  const syntax =
    metrics.averageSentenceWords <= 14 ? 'very_plain' : metrics.averageSentenceWords <= 21 ? 'plain' : 'dense';
  return [
    `length:${length}`,
    `syntax:${syntax}`,
    `questions:${Math.min(2, metrics.questionCount)}`,
    `glosses:${Math.min(2, metrics.glossedTerms.length)}`,
    `scene:${Math.min(3, metrics.concreteSceneTermCount)}`,
    `second_person:${metrics.secondPerson ? 1 : 0}`,
    `cues:${
      Object.entries(metrics.surfaceCueProfile || {})
        .filter(([, present]) => present)
        .map(([cue]) => cue)
        .sort()
        .join(',') || 'none'
    }`,
  ].join('|');
}

export function auditTutorStubResponseConfiguration({ text = '', configuration, world = null, composition = null } = {}) {
  if (!configuration) return null;
  const words = responseWords(text);
  const sentences = responseSentences(text);
  const sceneTerms = worldLexicon(world).filter((term) => new RegExp(`\\b${term}\\b`, 'iu').test(text));
  const unresolvedTerms = configuration.unresolved_terms || [];
  const glossedTerms = unresolvedTerms.filter((term) => termIsGlossed(text, term));
  const metrics = {
    wordCount: words.length,
    sentenceCount: sentences.length,
    averageSentenceWords: Number((words.length / Math.max(1, sentences.length)).toFixed(2)),
    maxSentenceWords: Math.max(0, ...sentences.map((sentence) => responseWords(sentence).length)),
    longWordRatio: Number((words.filter((word) => word.length >= 10).length / Math.max(1, words.length)).toFixed(3)),
    questionCount: (String(text).match(/\?/gu) || []).length,
    secondPerson: /\b(?:you|your|we|let's)\b/iu.test(text),
    concreteSceneTerms: [...new Set(sceneTerms)].slice(0, 12),
    concreteSceneTermCount: new Set(sceneTerms).size,
    glossedTerms,
    fourthWallBreak: /\b(?:the tutor|the learner|the prompt|the model|the policy|the dag|this dialogue)\b/iu.test(text),
    surfaceCueProfile: {
      definition: /\b(?:is|means|refers to|rather than|distinction)\b/iu.test(text),
      conditional: /\b(?:if|unless|would count|could show|because)\b/iu.test(text),
      invitation: /\b(?:let's|we can|try|notice|you can|start with|take)\b/iu.test(text),
      acknowledgement: /\b(?:i hear|that sounds|you are naming|you've named|it makes sense)\b/iu.test(text),
      challenge: /\b(?:but|yet|choose|risk|refuse|stop|instead)\b/iu.test(text),
      closure: /\b(?:closed|settled|conclude|therefore)\b/iu.test(text),
    },
  };
  // The adaptive host governs the whole utterance around any authored clue
  // source. A source quotation has its own fixed voice and sentence shape, so
  // do not let that quotation impersonate—or length-penalize—the host part,
  // stance, audience register, or lexical accessibility.
  const performanceText = actorialHostSurface(configuration, text);
  const performanceWords = responseWords(performanceText);
  const performanceSentences = responseSentences(performanceText);
  const performanceMetrics = {
    ...metrics,
    wordCount: performanceWords.length,
    sentenceCount: performanceSentences.length,
    averageSentenceWords: Number(
      (performanceWords.length / Math.max(1, performanceSentences.length)).toFixed(2),
    ),
    maxSentenceWords: Math.max(0, ...performanceSentences.map((sentence) => responseWords(sentence).length)),
  };
  const audienceDefinition = getAudienceRegisterDefinitions()[configuration.audience_register] || {};
  const lexicalDefinition = getLexicalAccessibilityDefinitions()[configuration.lexical_accessibility] || {};
  const sceneDefinition = getSceneImmersionDefinitions()[configuration.scene_immersion] || {};
  const audienceMaximum = Number(audienceDefinition.max_average_sentence_words || 30);
  const lexicalMaximum = Number(lexicalDefinition.max_average_sentence_words || 32);
  const audiencePass = sentenceBudgetVisible(
    performanceMetrics.averageSentenceWords,
    audienceMaximum,
  );
  const lexicalLengthPass =
    sentenceBudgetVisible(performanceMetrics.averageSentenceWords, lexicalMaximum);
  const lexicalPass =
    lexicalLengthPass &&
    (configuration.lexical_accessibility !== 'glossed_plain' ||
      unresolvedTerms.length === 0 ||
      glossedTerms.length === unresolvedTerms.length);
  const scenePass =
    !metrics.fourthWallBreak && metrics.concreteSceneTermCount >= Number(sceneDefinition.min_scene_terms || 0);
  const actorialPartPass = actorialPartVisible(configuration, performanceText, metrics);
  const actorialPerformancePass = actorialPerformanceVisible(
    configuration,
    performanceText,
    performanceMetrics,
  );
  const axes = {
    engagement_stance: {
      selected: configuration.engagement_stance,
      visible: stanceVisible(configuration.engagement_stance, performanceText, performanceMetrics),
    },
    action_family: {
      selected: configuration.action_family,
      visible: actionVisible(
        configuration.action_family,
        ['answer_accountably', 'receive_vulnerability', 'challenge_resistance'].includes(configuration.action_family) &&
          composition?.uptake
          ? composition.uptake
          : composition?.development || text,
        metrics,
        unresolvedTerms,
      ),
      evaluated_segment:
        ['answer_accountably', 'receive_vulnerability', 'challenge_resistance'].includes(configuration.action_family) &&
        composition?.uptake
          ? 'uptake'
          : composition?.development
            ? 'development'
            : 'whole_response',
    },
    audience_register: {
      selected: configuration.audience_register,
      visible: audiencePass,
      max_average_sentence_words: audienceMaximum,
      measurement_tolerance: 0.1,
    },
    lexical_accessibility: {
      selected: configuration.lexical_accessibility,
      visible: lexicalPass,
      max_average_sentence_words: lexicalMaximum,
      measurement_tolerance: 0.1,
    },
    scene_immersion: { selected: configuration.scene_immersion, visible: scenePass },
    actorial_part: {
      selected: configuration.actorial_part,
      label: configuration.actorial_part_label || null,
      performance_tactic: configuration.actorial_performance?.id || null,
      performance_label: configuration.actorial_performance?.label || null,
      part_visible: actorialPartPass,
      performance_visible: actorialPerformancePass,
      visible: actorialPartPass && actorialPerformancePass,
      evaluated_segment:
        configuration?.actorial_part_selection?.authored_role
          ? 'adaptive_host_without_authored_source'
          : 'whole_response',
    },
  };
  const visibleAxes = Object.values(axes).filter((axis) => axis.visible).length;
  const actorialIssues = [
    !axes.actorial_part.part_visible
      ? {
          type: 'missing_selected_actorial_part',
          reason: `does not directly perform the selected public part: ${configuration.actorial_part_label || configuration.actorial_part}`,
        }
      : null,
    !axes.actorial_part.performance_visible
      ? {
          type: 'missing_selected_performance_tactic',
          reason: `does not make the selected ${configuration.actorial_performance?.label || 'actorial'} tactic visible in the development beat`,
        }
      : null,
  ].filter(Boolean);
  const configurationSignature = [
    configuration.engagement_stance,
    configuration.action_family,
    configuration.audience_register,
    configuration.lexical_accessibility,
    configuration.scene_immersion,
    configuration.actorial_part,
    configuration.actorial_performance?.id || 'legacy_performance',
  ].join('|');
  return {
    schema: RESPONSE_CONFIGURATION_AUDIT_SCHEMA,
    configuration_signature: configurationSignature,
    visible_signature: `${visibleSignature(metrics)}|part:${
      axes.actorial_part.visible ? configuration.actorial_part : 'not_visible'
    }|tactic:${axes.actorial_part.performance_visible ? configuration.actorial_performance?.id || 'legacy' : 'not_visible'}`,
    axes,
    metrics,
    visible_axis_count: visibleAxes,
    axis_count: Object.keys(axes).length,
    realization_rate: Number((visibleAxes / Object.keys(axes).length).toFixed(3)),
    actorial_realization: {
      schema: ACTORIAL_REALIZATION_AUDIT_SCHEMA,
      ok: actorialIssues.length === 0,
      issues: actorialIssues,
    },
    transcript_visible: visibleAxes >= 5 && axes.actorial_part.visible && !metrics.fourthWallBreak,
    limitations:
      'Deterministic surface audit: it checks legible character actions and stance-specific performance cues; contrastive replay is still required to establish human-perceived difference.',
  };
}

export function summarizeTutorStubResponseConfigurationAudits(audits = []) {
  const rows = audits.filter(Boolean);
  const axes = [
    'engagement_stance',
    'action_family',
    'audience_register',
    'lexical_accessibility',
    'scene_immersion',
    'actorial_part',
  ];
  const configurationCounts = {};
  const visibleSignatureCounts = {};
  for (const audit of rows) {
    configurationCounts[audit.configuration_signature] = (configurationCounts[audit.configuration_signature] || 0) + 1;
    visibleSignatureCounts[audit.visible_signature] = (visibleSignatureCounts[audit.visible_signature] || 0) + 1;
  }
  let differentConfigurationPairs = 0;
  let visiblyDifferentPairs = 0;
  for (let left = 0; left < rows.length; left += 1) {
    for (let right = left + 1; right < rows.length; right += 1) {
      if (rows[left].configuration_signature === rows[right].configuration_signature) continue;
      differentConfigurationPairs += 1;
      if (rows[left].visible_signature !== rows[right].visible_signature) visiblyDifferentPairs += 1;
    }
  }
  return {
    schema: 'machinespirits.tutor-stub.response-configuration-visibility-summary.v1',
    turns: rows.length,
    transcript_visible_turns: rows.filter((audit) => audit.transcript_visible).length,
    mean_realization_rate: rows.length
      ? Number((rows.reduce((sum, audit) => sum + Number(audit.realization_rate || 0), 0) / rows.length).toFixed(3))
      : 0,
    axis_visibility_rate: Object.fromEntries(
      axes.map((axis) => [
        axis,
        rows.length ? Number((rows.filter((audit) => audit.axes?.[axis]?.visible).length / rows.length).toFixed(3)) : 0,
      ]),
    ),
    distinct_configuration_count: Object.keys(configurationCounts).length,
    distinct_visible_signature_count: Object.keys(visibleSignatureCounts).length,
    different_configuration_pairs: differentConfigurationPairs,
    visibly_different_pairs: visiblyDifferentPairs,
    pairwise_visible_difference_rate: differentConfigurationPairs
      ? Number((visiblyDifferentPairs / differentConfigurationPairs).toFixed(3))
      : null,
    configuration_counts: configurationCounts,
    visible_signature_counts: visibleSignatureCounts,
  };
}
