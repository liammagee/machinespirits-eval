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
  'authored_source',
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
    (row) => row?.presentation?.mode === 'enacted_role' || oneLine(row?.presentation?.role || row?.role),
  );
  if (enactedRelease) {
    addPartScores(scores, { authored_source: 4.5 }, 1, drivers, 'authored_public_clue_role');
  } else if (publicDueEvidence.length) {
    const surfaces = publicDueEvidence.map((row) => oneLine(row.surface)).join(' ');
    const recordLike = /\b(?:archive|log|ledger|book|record|file|notice|entry|inventory|notebook)\b/iu.test(surfaces);
    addPartScores(
      scores,
      recordLike ? { record_keeper: 1.8, examiner: 0.45 } : { examiner: 1.6 },
      1,
      drivers,
      recordLike ? 'new_public_record' : 'new_public_exhibit',
    );
  } else {
    scores.authored_source -= 1.5;
  }

  for (const [index, part] of recentActorialParts.slice(-2).reverse().entries()) {
    if (!(part in scores)) continue;
    const penalty = index === 0 ? 0.42 : 0.18;
    scores[part] -= penalty;
    drivers.push({ part, source: index === 0 ? 'immediate_part_repetition' : 'recent_part_repetition', contribution: -penalty });
  }

  const distribution = partDistribution(scores, temperature);
  const locked =
    enactedRelease ||
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
    authored_role: selected.part === 'authored_source' ? worldActorialLabel(selected.part, world, publicDueEvidence) : null,
    selection_method: locked ? 'structural_lock' : selectedPartOverride ? 'seeded_distribution' : 'argmax',
    locked,
    lock_reason: enactedRelease ? 'authored_public_clue_role' : locked ? 'licensed_closeout' : null,
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
    actorial_part_selection: actorialPart,
    actorial_performance: actorialPerformance,
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
    `Scene immersion: ${configuration.scene_immersion}. ${definitionContract(
      sceneDefinitions,
      configuration.scene_immersion,
    )}`,
    `Actorial part: ${configuration.actorial_part_label || configuration.actorial_part}. ${definitionContract(
      actorialDefinitions,
      configuration.actorial_part,
    )}`,
    configuration.actorial_part_selection?.authored_role
      ? `Authored public clue role: ${configuration.actorial_part_selection.authored_role}. Take this exact part for the clue and speak its evidence from inside the role in first person inside quotation marks. Do not prefix the speech with the role name or a stage direction. The part supplies no knowledge beyond the public clue in the current turn context.`
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
    'These are independent axes. Perform the action family and visibly take the actorial part; do not infer either one from the engagement stance.',
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
    return /\b(?:if|because|means|rather than|not .{0,24} but|would count|distinction)\b/iu.test(text);
  if (stance === 'brisk') return metrics.wordCount <= 70 && metrics.sentenceCount <= 4;
  if (stance === 'warm') return /\b(?:let's|we can|try|notice|you can|start with|take)\b/iu.test(text);
  if (stance === 'witnessing')
    return /\b(?:i hear|that sounds|you are naming|you've named|it makes sense|there is no need)\b/iu.test(text);
  if (stance === 'charismatic') return /\b(?:but|yet|choose|risk|refuse|test|stake|stop|now)\b/iu.test(text);
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
      /\b(?:means|rather than|not .{0,24} but|distinction|difference|which)\b/iu.test(text) || metrics.questionCount > 0
    );
  }
  if (actionFamily === 'stage_next_step') return metrics.questionCount > 0 && metrics.wordCount <= 110;
  if (actionFamily === 'answer_accountably') {
    return /\b(?:because|if|unless|would count|could show|test|check|wrong|revise)\b/iu.test(text);
  }
  if (actionFamily === 'compress_sayback') return metrics.wordCount <= 85 && metrics.questionCount > 0;
  if (actionFamily === 'reanchor_lived_stake') return metrics.secondPerson && metrics.concreteSceneTermCount > 0;
  if (actionFamily === 'reanchor_public_evidence') {
    return metrics.concreteSceneTermCount > 0 && metrics.questionCount > 0;
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
    return /\b(?:let(?:[’']s| us)|we(?: can| will|[’']ll)?|with you|beside you|together)\b/iu.test(text) && metrics.concreteSceneTermCount > 0;
  }
  if (part === 'examiner') {
    return /\b(?:i|we|let(?:[’']s| us))\b[^.!?]{0,55}\b(?:inspect|examine|compare|test|weigh|hold|turn|set|place|put|open|read|show|trace|point)\b|\b(?:under the lens|on the table|side by side)\b/iu.test(text);
  }
  if (part === 'record_keeper') {
    return /\b(?:i|we|let(?:[’']s| us))\b[^.!?]{0,55}\b(?:open|read|write|mark|enter|turn|close|strike)\b[^.!?]{0,55}\b(?:log|ledger|book|record|file|roll|notes?|inventory|trial-book|incident log|mod log|formulation card)\b|\b(?:log|ledger|book|record|file|roll|notes?|inventory|trial-book|incident log|mod log|formulation card)\b[^.!?]{0,55}\b(?:open|read|write|mark|enter|turn|close|strike)\b/iu.test(text);
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
    return /\b(?:i(?:[’']ll| will| am going to) (?:argue|make|put)|my case is|the strongest case|take the case for)\b/iu.test(text) && /\b(?:test|break|challenge|resist|object|what would|show me)\b/iu.test(text);
  }
  if (part === 'skeptic') {
    return /\b(?:i object|not so fast|i(?:[’']ll| will) challenge|let me challenge|cross-examine|weak link|that does not yet|doesn(?:[’']t| not) yet)\b/iu.test(text);
  }
  if (part === 'foreperson') {
    return /\b(?:finding|verdict|case is closed|close the (?:case|record|book|log|ledger|inquiry)|we can conclude|therefore)\b/iu.test(text) && metrics.questionCount === 0;
  }
  return false;
}

function actorialPerformanceVisible(configuration, text, metrics) {
  const tactic = configuration.actorial_performance?.id;
  if (!tactic) return true;
  if (tactic === 'unadorned_report') return metrics.averageSentenceWords <= 18 && metrics.wordCount <= 100;
  if (tactic === 'evidentiary_boundary') {
    return /\b(?:exact|establish|licensed|line that matters|no more|does not|doesn[’']t|limit|only)\b/iu.test(text);
  }
  if (tactic === 'rapid_handoff') {
    return /\b(?:already|straight|live line|your call|move the case|what does that add)\b/iu.test(text) || metrics.wordCount <= 70;
  }
  if (tactic === 'shared_scene_invitation') {
    return /\b(?:between us|both read|beside|together|what do you make|your reading|with me)\b/iu.test(text);
  }
  if (tactic === 'measured_testimony') {
    return /\b(?:without (?:pushing|forcing)|stand as written|responsibly|honestly bear|let .* stand|no further)\b/iu.test(text);
  }
  if (tactic === 'dramatic_counterpressure') {
    const forcefulExhibitAction =
      /\b(?:block|challenge|confront|plant|press|push|slap|snap|strike|unsettle)\b/iu.test(text);
    const contestedPublicJudgment =
      /\b(?:easy|obvious|quick|ready|room(?:[’']s)?)\b[^.!?]{0,55}\b(?:answer|assumption|case|claim|guilty|story|verdict)\b|\b(?:answer|assumption|case|claim|story|verdict)\b[^.!?]{0,35}\b(?:break|challenge|survive|unsettle)\b/iu.test(
        text,
      );
    return forcefulExhibitAction || contestedPublicJudgment;
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
  const audienceDefinition = getAudienceRegisterDefinitions()[configuration.audience_register] || {};
  const lexicalDefinition = getLexicalAccessibilityDefinitions()[configuration.lexical_accessibility] || {};
  const sceneDefinition = getSceneImmersionDefinitions()[configuration.scene_immersion] || {};
  const audiencePass = metrics.averageSentenceWords <= Number(audienceDefinition.max_average_sentence_words || 30);
  const lexicalLengthPass = metrics.averageSentenceWords <= Number(lexicalDefinition.max_average_sentence_words || 32);
  const lexicalPass =
    lexicalLengthPass &&
    (configuration.lexical_accessibility !== 'glossed_plain' ||
      unresolvedTerms.length === 0 ||
      glossedTerms.length === unresolvedTerms.length);
  const scenePass =
    !metrics.fourthWallBreak && metrics.concreteSceneTermCount >= Number(sceneDefinition.min_scene_terms || 0);
  const performanceText = composition?.development || text;
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
  const actorialPartPass = actorialPartVisible(configuration, performanceText, metrics);
  const actorialPerformancePass = actorialPerformanceVisible(
    configuration,
    performanceText,
    performanceMetrics,
  );
  const axes = {
    engagement_stance: {
      selected: configuration.engagement_stance,
      visible: stanceVisible(configuration.engagement_stance, text, metrics),
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
    audience_register: { selected: configuration.audience_register, visible: audiencePass },
    lexical_accessibility: { selected: configuration.lexical_accessibility, visible: lexicalPass },
    scene_immersion: { selected: configuration.scene_immersion, visible: scenePass },
    actorial_part: {
      selected: configuration.actorial_part,
      label: configuration.actorial_part_label || null,
      performance_tactic: configuration.actorial_performance?.id || null,
      performance_label: configuration.actorial_performance?.label || null,
      part_visible: actorialPartPass,
      performance_visible: actorialPerformancePass,
      visible: actorialPartPass && actorialPerformancePass,
      evaluated_segment: composition?.development ? 'development' : 'whole_response',
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
