export const TUTOR_STUB_CLI_REQUEST_PATH =
  'machinespirits.tutor-stub.cli-request-path.v1';

function definedOptions(entries) {
  return Object.fromEntries(
    Object.entries(entries).filter(([, value]) => value !== undefined && value !== null),
  );
}

export function buildTutorStubCliBridgeRequest({
  resolved,
  systemPrompt,
  userPrompt,
  role,
  messageHistory,
  effort,
  onEvent,
  signal,
  outputSchema,
  timeoutMs,
  maxStdoutBytes,
  maxStderrBytes,
} = {}) {
  if (!resolved?.provider || !resolved?.model) {
    throw new Error('tutor-stub CLI request requires a resolved provider and model');
  }
  if (!String(role || '').trim()) {
    throw new Error('tutor-stub CLI request requires a role');
  }
  return {
    schema: TUTOR_STUB_CLI_REQUEST_PATH,
    agentConfig: { provider: resolved.provider, model: resolved.model },
    systemPrompt,
    userPrompt,
    role,
    options: definedOptions({
      messageHistory,
      effort,
      onEvent,
      signal,
      outputSchema,
      timeoutMs,
      maxStdoutBytes,
      maxStderrBytes,
    }),
  };
}

export async function dispatchTutorStubCliBridgeRequest(callAIWithCliBridge, input) {
  if (typeof callAIWithCliBridge !== 'function') {
    throw new Error('tutor-stub CLI request requires a bridge caller');
  }
  const request = buildTutorStubCliBridgeRequest(input);
  return await callAIWithCliBridge(
    request.agentConfig,
    request.systemPrompt,
    request.userPrompt,
    request.role,
    request.options,
  );
}
