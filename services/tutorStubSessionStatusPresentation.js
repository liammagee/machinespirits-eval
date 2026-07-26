function presentationColors(colors = {}) {
  return {
    bold: colors.bold || '',
    brightCyan: colors.brightCyan || '',
    dim: colors.dim || '',
    reset: colors.reset || '',
  };
}

export function projectTutorStubSessionStatusLines({ status = {}, colors = {} } = {}) {
  const C = presentationColors(colors);
  if (status.surface === 'passthrough') {
    return Object.freeze([
      `${C.brightCyan}${C.bold}session status >${C.reset} passthrough · turn ${status.turn}`,
      `${C.dim}  speaker model: ${status.model.ref} → ${status.model.provider}/${status.model.model}${C.reset}`,
      `${C.dim}  setup: ${status.setup}; public messages replayed next turn: ${status.publicMessageCount}${C.reset}`,
      `${C.dim}  appearance: ${status.appearance.themeLabel} · ${status.appearance.motion} motion · ${status.appearance.colorMode}${C.reset}`,
      `${C.dim}  voice: ${status.voice?.enabled ? 'on' : 'off'} · ${status.voice?.model} · ${status.voice?.voice} · /voice${C.reset}`,
      `${C.dim}  one speaker call per turn · classifier, DAG, register, response checks, releases, feedback, and summaries off${C.reset}\n`,
    ]);
  }

  const modelRouting = status.modelRouting.allRolesOverrideRef
    ? `one model for all roles (${status.modelRouting.allRolesOverrideRef})`
    : `interpretation ${status.modelRouting.classifierRef} · reasoning ${status.modelRouting.reasoningRef} · learner voice ${status.modelRouting.learnerRef}`;
  const committee = status.committee?.enabled
    ? `on · ${status.committee.miniModel} · warrant-gap trigger · fallback ${status.committee.fallbackPolicy}`
    : 'off · frontier-only responses';
  const randomPerformanceAxes = status.randomPerformance?.axes || [];
  const randomPerformance = status.randomPerformance?.enabled
    ? randomPerformanceAxes.length
      ? `on — assessment-independent ${randomPerformanceAxes.join(' + ')}`
      : 'on — armed; both axes explicitly directed'
    : 'off';
  const lightAdaptation = status.lightAdaptation?.enabled
    ? `on — seeded style + character shift after ${status.lightAdaptation.threshold} consecutive confused/frustrated turns`
    : 'off';
  const directorRequest = status.directorRequest
    ? `${status.directorRequest.text} · from tutor turn ${status.directorRequest.effectiveFromTurn}`
    : 'none';
  const autoHandoff = status.autoHandoff.pending
    ? `queued after tutor turn ${status.autoHandoff.pending.afterTurn} · ${
        status.autoHandoff.pending.requestedTurns === null
          ? 'until grounded'
          : `${status.autoHandoff.pending.requestedTurns} turn${status.autoHandoff.pending.requestedTurns === 1 ? '' : 's'}`
      }`
    : status.autoHandoff.running
      ? 'running'
      : 'none';
  const tuningCanary = status.tuning.canaryVersion ? ` · canary v${status.tuning.canaryVersion}` : '';
  const selectedMotion =
    status.appearance.requestedMotion === status.appearance.motion
      ? ''
      : ` (${status.appearance.requestedMotion} selected)`;

  return Object.freeze([
    `${C.brightCyan}${C.bold}session status >${C.reset} ${status.modeLabel} · turn ${status.turn}`,
    `${C.dim}  learner: ${status.learner.id} — ${status.learner.name}; suggested reply ${status.learner.suggestion}${C.reset}`,
    `${C.dim}  tutor: ${status.tutor.ref} · model ${status.model.ref} → ${status.model.provider}/${status.model.model}${C.reset}`,
    `${C.dim}  model routing: ${modelRouting}${C.reset}`,
    `${C.dim}  learned committee: ${committee} · /committee${C.reset}`,
    `${C.dim}  voice: ${status.voice?.enabled ? 'on' : 'off'} · ${status.voice?.model} · ${status.voice?.voice} · separate renderer; /voice${C.reset}`,
    `${C.dim}  teaching approach: ${status.teaching.approachLabel} (${status.teaching.policyId}); style range ${status.teaching.styleRange}; evidence-memory dropout ${status.teaching.dropoutRate}; clue pace ${status.teaching.baseSpeed}x base / ${status.teaching.effectiveSpeed}x now${C.reset}`,
    `${C.dim}  random performance: ${randomPerformance} · /random${C.reset}`,
    `${C.dim}  light adaptation: ${lightAdaptation} · /light${C.reset}`,
    `${C.dim}  directed performance: style ${status.directedPerformance.register || 'auto'} · character ${status.directedPerformance.character || 'auto'} · /register · /character${C.reset}`,
    `${C.dim}  director request: ${directorRequest} · /meta · /director${C.reset}`,
    `${C.dim}  conversation: ${status.conversation.closureLabel}; private coaching: ${status.conversation.coachPending} waiting, ${status.conversation.coachUsed} used${C.reset}`,
    `${C.dim}  auto handoff: ${autoHandoff} · /auto${C.reset}`,
    `${C.dim}  tutor ratings: ${status.turnFeedback?.enabled ? `on · ${status.turnFeedback.label}` : 'off'} · optional and private${C.reset}`,
    `${C.dim}  response details: ${status.responseDetails?.enabled ? 'on · model plus foreground timing shown before tutor speech' : 'off'} · /details${C.reset}`,
    `${C.dim}  tuning: ${status.tuning.mode || 'off'} · stable v${status.tuning.stableVersion}${tuningCanary} · ${status.tuning.sessionCandidateCount} session candidates${C.reset}`,
    `${C.dim}  appearance: ${status.appearance.themeLabel} · ${status.appearance.motion} motion${selectedMotion} · ${status.appearance.colorMode}${C.reset}`,
    `${C.dim}  explanations: ${status.explanatoryDebug?.enabled ? `on (${status.explanatoryDebug.format === 'technical' ? 'technical details' : 'plain'})` : 'off'} · commands remain live while models work · /analysis · /transcript · /help${C.reset}\n`,
  ]);
}
