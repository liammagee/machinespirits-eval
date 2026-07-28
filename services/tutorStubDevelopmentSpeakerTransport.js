import { isCliProvider } from './cliProviderBridge.js';
import { resolveModel } from './evalConfigLoader.js';

export const TUTOR_STUB_DEVELOPMENT_SPEAKER_TRANSPORT_SCHEMA =
  'machinespirits.tutor-stub.development-speaker-transport.v1';

export function tutorStubProviderSupportsTokenStreaming(resolved, { isCli = isCliProvider } = {}) {
  return Boolean(resolved?.provider && !isCli(resolved.provider));
}

export function tutorStubProviderSupportsEventStreaming(resolved) {
  return resolved?.provider === 'codex';
}

export function renderTutorStubStreamLabel(role, colors = {}) {
  if (role === 'tutor_stub_tutor') return `${colors.brightMagenta}${colors.bold}tutor >${colors.reset} `;
  if (role === 'tutor_stub_learner_analysis') return `${colors.cyan}learner analysis stream >${colors.reset} `;
  if (role === 'tutor_stub_learner_record') return `${colors.cyan}learner DAG stream >${colors.reset} `;
  if (role === 'tutor_stub_learner_classifier') return `${colors.cyan}learner classifier stream >${colors.reset} `;
  return `${colors.cyan}${role} >${colors.reset} `;
}

export function resolveTutorStubDevelopmentDirectModel({
  modelRef = '',
  developmentSeed = '',
  resolve = resolveModel,
  isCli = isCliProvider,
} = {}) {
  const ref = String(modelRef || '').trim();
  if (!ref) return null;
  if (!String(developmentSeed || '').trim()) {
    throw new Error('--development-direct-model requires an explicit non-held-out --development-seed');
  }
  const resolved = resolve(ref);
  if (isCli(resolved?.provider)) {
    throw new Error('--development-direct-model must resolve to a non-CLI provider');
  }
  if (resolved?.isConfigured !== true) {
    throw new Error(`--development-direct-model ${ref} is unavailable: provider credentials are not configured`);
  }
  return {
    schema: TUTOR_STUB_DEVELOPMENT_SPEAKER_TRANSPORT_SCHEMA,
    kind: 'direct_provider_development_non_equivalent',
    requestedModelRef: ref,
    provider: resolved.provider,
    model: resolved.model,
    acceptanceEligible: false,
    consumesHeldOutOrAcceptanceSeed: false,
    equivalentToCodexCliTransport: false,
  };
}
