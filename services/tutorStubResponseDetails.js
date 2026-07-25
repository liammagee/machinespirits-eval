export function tutorStubDisplayDiagnosticLabel(value) {
  return String(value || '')
    .replace(/[_-]+/gu, ' ')
    .trim();
}

export function tutorStubPlainList(values = []) {
  const visible = [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
  if (visible.length <= 1) return visible[0] || '';
  if (visible.length === 2) return `${visible[0]} and ${visible[1]}`;
  return `${visible.slice(0, -1).join(', ')}, and ${visible.at(-1)}`;
}

export function tutorStubPlainResponseCheckArea(value) {
  const labels = {
    leak: 'protecting unreleased answers or evidence',
    human_scaffold: 'not repeating an already answered question',
    question_support: 'asking only from information already available',
    dramatic_release: 'bringing the new clue into the scene clearly',
    actorial_realization: 'making the selected character and teaching style visible',
    response_composition: 'responding to the learner before developing the scene',
    repetition: 'avoiding repeated wording or questions',
    dialogue_closure: 'ending the conversation clearly',
  };
  return labels[value] || tutorStubDisplayDiagnosticLabel(value);
}

export function tutorStubPlainSettingName(value) {
  const labels = {
    tutorModelRef: 'tutor model',
    classifierModelRef: 'learner interpretation model',
    learnerRecordModelRef: 'learner reasoning model',
    autoLearnerModelRef: 'learner voice model',
    allModelsOverrideRef: 'one model for all roles',
    learner_interpretation_model: 'learner interpretation model',
    learner_reasoning_model: 'learner reasoning model',
    learner_voice_model: 'learner voice model',
    engagementStanceTemperature: 'teaching-style range',
    dagFactDropoutRate: 'evidence-memory dropout',
    releaseSpeed: 'clue release speed',
    clue_release_speed: 'clue release speed',
    trainingReuseEnabled: 'training reuse',
    training_reuse: 'training reuse',
    registerPolicy: 'teaching approach',
    registerOverlays: 'turn/conversation overrides',
    registerOverlayThreshold: 'override sensitivity',
  };
  return labels[value] || tutorStubDisplayDiagnosticLabel(value);
}

export function tutorStubResponseCheckTriggerAreas(turn) {
  const accounting = turn?.tutorGuardAccounting || null;
  const triggers = (accounting?.repairsApplied || []).flatMap((repair) => repair.triggeredBy || []);
  return [...new Set(triggers.map((trigger) => tutorStubPlainResponseCheckArea(trigger.guard)).filter(Boolean))];
}

export function tutorStubPlainResponseCheckSummary(turn) {
  if (!turn?.tutorResponseRepaired) return null;
  const areas = tutorStubResponseCheckTriggerAreas(turn);
  const reason = areas.length ? ` for ${tutorStubPlainList(areas)}` : '';
  return turn.tutorDeterministicFallback
    ? `The first two drafts needed revision${reason}, so a safe fallback was shown instead.`
    : `The first draft needed revision${reason}. It was rewritten and rechecked before display.`;
}

export function tutorStubResponseMetadataLine(meta) {
  const usage = meta.usage || {};
  const total = Number(usage.totalTokens ?? (usage.inputTokens || 0) + (usage.outputTokens || 0));
  const tokens =
    meta.tokenUsageAvailable === false
      ? 'tokens unavailable'
      : `${Number.isFinite(total) ? total.toLocaleString('en-US') : 0} tokens`;
  const cost = usage.cost ? `, $${Number(usage.cost).toFixed(6)}` : '';
  const effort = meta.effort || meta.reasoningEffort ? `, effort ${meta.effort || meta.reasoningEffort}` : '';
  const guard = meta.deterministicFallback ? ', safe fallback used' : meta.repaired ? ', response revised' : '';
  const stream = meta.guardedStreamReplay ? ', checked before display' : meta.streamed ? ', streamed' : '';
  const cache = meta.speculativeCacheHit ? ', prefetched response' : '';
  const releasePacing = meta.releasePacing || null;
  const pace = releasePacing
    ? `, clue pace ${releasePacing.direction === 'accelerate' ? 'faster ' : releasePacing.direction === 'decelerate' ? 'slower ' : ''}${releasePacing.effectiveSpeed}x${releasePacing.releasedNow?.length ? `; ${releasePacing.releasedNow.length} new clue${releasePacing.releasedNow.length === 1 ? '' : 's'}` : ''}`
    : '';
  const selection = meta.registerSelection || null;
  const stance = selection?.engagement_stance || selection?.selected_register || null;
  const action = selection?.action_family || selection?.response_configuration?.action_family || null;
  const character =
    selection?.actorial_part_label ||
    selection?.response_configuration?.actorial_part_label ||
    selection?.actorial_part ||
    selection?.response_configuration?.actorial_part ||
    null;
  const performance =
    selection?.actorial_performance?.label || selection?.response_configuration?.actorial_performance?.label || null;
  const randomPerformance = selection?.random_performance?.enabled ? ', random performance' : '';
  const lightAdaptation = selection?.light_adaptation?.triggered ? ', light shift' : '';
  const directedPerformance = [
    selection?.performance_directives?.register?.applied ? 'style directed' : null,
    selection?.performance_directives?.character?.applied ? 'character directed' : null,
  ]
    .filter(Boolean)
    .map((part) => `, ${part}`)
    .join('');
  const register = [
    stance ? `style ${tutorStubDisplayDiagnosticLabel(stance)}` : null,
    action ? `move ${tutorStubDisplayDiagnosticLabel(action)}` : null,
    character ? `character ${tutorStubDisplayDiagnosticLabel(character)}` : null,
    performance ? `performance ${tutorStubDisplayDiagnosticLabel(performance)}` : null,
  ]
    .filter(Boolean)
    .map((part) => `, ${part}`)
    .join('');
  const tutor = meta.tutorRef ? `, tutor ${meta.tutorRef}` : '';
  return `${meta.provider}/${meta.model}, ${meta.latencyMs || 0}ms, ${tokens}${cost}${effort}${register}${randomPerformance}${lightAdaptation}${directedPerformance}${pace}${guard}${stream}${cache}${tutor}`;
}
