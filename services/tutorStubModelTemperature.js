export function usesFixedTutorStubModelTemperature(resolved) {
  return resolved.provider === 'openai' && /^gpt-5(?:[.-]|$)/u.test(resolved.model);
}

export function effectiveTutorStubModelTemperature(resolved, requestedTemperature) {
  return usesFixedTutorStubModelTemperature(resolved) ? 1 : requestedTemperature;
}
