import {
  getActionFamilyDefinitions,
  getAudienceRegisterDefinitions,
  getEngagementStanceDefinition,
  getLexicalAccessibilityDefinitions,
  getSceneImmersionDefinitions,
} from './engagementRegisterRegistry.js';

const RESPONSE_CONFIGURATION_SCHEMA = 'machinespirits.tutor-stub.response-configuration.v1';
const RESPONSE_CONFIGURATION_AUDIT_SCHEMA = 'machinespirits.tutor-stub.response-configuration-audit.v1';

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

export function selectTutorStubActionFamily({ classification, tutorLearnerDag, comprehension } = {}) {
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
} = {}) {
  const action = selectTutorStubActionFamily({ classification, tutorLearnerDag, comprehension });
  const audience = selectTutorStubAudienceRegister({ learnerText, classification, tutorLearnerDag, comprehension });
  const lexical = selectTutorStubLexicalAccessibility({ classification, tutorLearnerDag, comprehension });
  const scene = selectTutorStubSceneImmersion({ classification, comprehension, world });
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
    unresolved_terms: unresolvedTerms,
    learner_advance: learnerAdvance ? structuredClone(learnerAdvance) : null,
    engagement_stance_distribution: Array.isArray(stanceDistribution) ? structuredClone(stanceDistribution) : null,
    engagement_stance_vector: stanceVector && typeof stanceVector === 'object' ? structuredClone(stanceVector) : null,
    engagement_stance_temperature: Number.isFinite(Number(temperature)) ? Number(temperature) : null,
    temperature_scope: 'engagement_stance_only',
    selection_reasons: {
      action_family: action.reason,
      audience_register: audience.reason,
      lexical_accessibility: lexical.reason,
      scene_immersion: scene.reason,
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
    `Unresolved terms: ${unresolved}.`,
    configuration.learner_advance?.accelerated
      ? `Learner pace: accelerating. Credit all ${configuration.learner_advance.supportedMoveCount} warranted learner-owned proof moves already made; do not ask for any of them again. Test or extend only the next unresolved edge.`
      : 'Learner pace: steady unless the public turn itself warrants otherwise.',
    'These are independent axes. Perform the action family; do not infer the action from the engagement stance.',
    'Temperature applies only to the engagement-stance distribution. Do not blur the audience, lexical, action, or scene contracts.',
    'Make every selected axis visible in the wording while never naming this configuration or its machinery.',
    '[End tutor-only response configuration]',
  ].join('\n');
}

function responseSentences(text) {
  const sentences = oneLine(text)
    .split(/(?<=[.!?])\s+/u)
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

export function auditTutorStubResponseConfiguration({ text = '', configuration, world = null } = {}) {
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
  const axes = {
    engagement_stance: {
      selected: configuration.engagement_stance,
      visible: stanceVisible(configuration.engagement_stance, text, metrics),
    },
    action_family: {
      selected: configuration.action_family,
      visible: actionVisible(configuration.action_family, text, metrics, unresolvedTerms),
    },
    audience_register: { selected: configuration.audience_register, visible: audiencePass },
    lexical_accessibility: { selected: configuration.lexical_accessibility, visible: lexicalPass },
    scene_immersion: { selected: configuration.scene_immersion, visible: scenePass },
  };
  const visibleAxes = Object.values(axes).filter((axis) => axis.visible).length;
  const configurationSignature = [
    configuration.engagement_stance,
    configuration.action_family,
    configuration.audience_register,
    configuration.lexical_accessibility,
    configuration.scene_immersion,
  ].join('|');
  return {
    schema: RESPONSE_CONFIGURATION_AUDIT_SCHEMA,
    configuration_signature: configurationSignature,
    visible_signature: visibleSignature(metrics),
    axes,
    metrics,
    visible_axis_count: visibleAxes,
    axis_count: Object.keys(axes).length,
    realization_rate: Number((visibleAxes / Object.keys(axes).length).toFixed(3)),
    transcript_visible: visibleAxes >= 4 && !metrics.fourthWallBreak,
    limitations:
      'Deterministic surface audit: it checks legible textual cues and constraints, not whether a human reader experiences the intended stance.',
  };
}

export function summarizeTutorStubResponseConfigurationAudits(audits = []) {
  const rows = audits.filter(Boolean);
  const axes = ['engagement_stance', 'action_family', 'audience_register', 'lexical_accessibility', 'scene_immersion'];
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
