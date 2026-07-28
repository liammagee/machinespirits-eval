import { projectTutorStubGuardedSpans } from './tutorStubGuardSpanProjection.js';

function jsonClone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

export function projectTutorStubGuardAttemptEnvelope({
  kind,
  attempt,
  response,
  audits = null,
  issues = [],
  repairedSpans = [],
}) {
  const text = String(response?.text || '');
  const recoveryMetadata = response?.recoveryStrategy || response?.recoveryBatch || null;
  const generation = {
    callId: response?.guardCallId || null,
    role: response?.guardRole || null,
    latencyMs: Number(response?.latencyMs || 0),
    usage: response?.usage ? jsonClone(response.usage) : null,
    tokenUsageAvailable: response?.tokenUsageAvailable ?? null,
    ...(recoveryMetadata
      ? {
          candidateKind: response.recoveryCandidateKind || kind,
          ...recoveryMetadata,
        }
      : {}),
  };
  return {
    kind,
    attempt,
    provider: response?.provider || null,
    model: response?.model || null,
    deliveryConfiguration: jsonClone(response?.deliveryResponseConfiguration || null),
    configurationTransition: jsonClone(response?.responseConfigurationTransition || null),
    candidate: {
      start: 0,
      end: text.length,
      text,
      offsetEncoding: 'utf16_code_units',
    },
    audits,
    auditOk: audits?.deliveryOk ?? audits?.ok ?? null,
    generation,
    guardedSpans: audits ? projectTutorStubGuardedSpans(text, issues) : [],
    repairedSpans,
  };
}
