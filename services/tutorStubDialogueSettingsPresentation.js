function dialogueSettingsPresentationColors(colors = {}) {
  return {
    cyan: colors.cyan || '',
    dim: colors.dim || '',
    reset: colors.reset || '',
  };
}

function modelRoleMode(role, classifierCombined) {
  if (role.combinedOwner) return 'active; also performs learner interpretation';
  if (role.active) return 'active';
  if (role.role === 'classifier' && classifierCombined) return 'inactive; combined into reasoning tracker';
  return 'inactive in this mode';
}

function styleRangeStatus(temperatureSelection = {}) {
  if (temperatureSelection.applied) return `active for ${temperatureSelection.scopeLabel}`;
  if (temperatureSelection.scope === 'saved_but_not_used_by_policy') return 'saved but not used by this approach';
  return 'bypassed on axes controlled by /random, /register, or /character';
}

function randomPerformanceStatus(randomPerformance = {}) {
  if (!randomPerformance.enabled) return 'off';
  const axes = Array.isArray(randomPerformance.axes) ? randomPerformance.axes : [];
  return axes.length ? `on — ${axes.join(' and ')} ignore assessment` : 'on — armed; both axes explicitly directed';
}

export function projectTutorStubDialogueSettingsLines({ settings = {}, trainingReuseLines = [], colors = {} } = {}) {
  const C = dialogueSettingsPresentationColors(colors);
  const modelRoles = Array.isArray(settings.modelRoles) ? settings.modelRoles : [];
  const teaching = settings.teaching || {};
  const lines = [
    `${C.cyan}settings >${C.reset}`,
    `${C.dim}  one model for all roles: ${settings.allRolesOverrideRef || 'off — roles selected separately'}${C.reset}`,
  ];

  for (const role of modelRoles) {
    lines.push(
      `${C.dim}  ${role.label.toLowerCase()}: ${role.modelRef} → ${role.resolved.provider}/${role.resolved.model}; ${modelRoleMode(
        role,
        settings.classifierCombined,
      )}${C.reset}`,
    );
  }

  lines.push(
    `${C.dim}  tutor effort: ${settings.tutorEffort || 'provider default'}${C.reset}`,
    `${C.dim}  appearance: ${settings.appearance.themeLabel} theme; ${settings.appearance.requestedMotion} motion (${settings.appearance.motion} here); change with /theme or /motion${C.reset}`,
    `${C.dim}  learned committee: ${
      settings.committee.enabled
        ? `on — ${settings.committee.miniModel} supplies warrant-gap questions; fallback ${settings.committee.fallbackPolicy}`
        : 'off — frontier-only responses'
    }; change with /committee${C.reset}`,
    `${C.dim}  conversation memory: tutor and learner replay all ${settings.publicMessageCount} public messages with speaker-relative user/assistant roles${C.reset}`,
    `${C.dim}  teaching approach: ${teaching.policyLabel} (${teaching.policyStackId}); turn/conversation overrides ${teaching.overlays?.join(', ') || 'off'}; sensitivity ${teaching.overlayThreshold}${C.reset}`,
    `${C.dim}  teaching-style range: ${teaching.styleRange} — lower concentrates the strongest style and part; higher mixes in more alternatives${C.reset}`,
    `${C.dim}  style range is ${styleRangeStatus(teaching.temperatureSelection)}${C.reset}`,
    `${C.dim}  random performance: ${randomPerformanceStatus(teaching.randomPerformance)}; session only; /random toggles${C.reset}`,
    `${C.dim}  light adaptation: ${
      teaching.lightAdaptation.enabled
        ? `on — after ${teaching.lightAdaptation.threshold} consecutive confusion/frustration turns, seeded-random style and character replace the prior pair when possible`
        : 'off'
    }; remembered setting; /settings light or /light changes it${C.reset}`,
    `${C.dim}  directed performance: style ${teaching.directedPerformance.register || 'auto'}; character ${teaching.directedPerformance.character || 'auto'}; session only; /register and /character${C.reset}`,
    `${C.dim}  evidence-memory dropout: ${settings.dropout.rate} (${settings.dropout.rate > 0 ? 'on' : 'off'}); currently forgotten ${settings.dropout.activeCount}; understood items tracked ${settings.dropout.adoptedCount}${C.reset}`,
    `${C.dim}  clue release speed: ${settings.releasePacing.baseSpeed}x base; ${settings.releasePacing.effectiveSpeed}x now (${settings.releasePacing.direction}); adapts to explicit learner requests${C.reset}`,
    `${C.dim}  reuse these settings next time: ${settings.rememberedSettings.enabled ? 'yes' : 'no'}; ${settings.rememberedSettings.status}${C.reset}`,
    ...trainingReuseLines,
    `${C.dim}  advanced overrides: /settings policy add state|field · remove state|field · clear · threshold 0.7${C.reset}`,
    `${C.dim}  use /settings models, /settings models all <ref>, /settings model, /settings temp 1.0, /settings dropout 0.15, /settings light on|off, /settings training-reuse on|off, /settings release-speed 1.5, /settings theme nocturne, /settings motion subtle, or /settings forget${C.reset}\n`,
  );

  return Object.freeze(lines);
}
