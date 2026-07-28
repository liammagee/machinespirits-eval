export function abortTutorStubTurnAttempt(message = 'learner turn attempt was superseded') {
  const error = new Error(message);
  error.name = 'AbortError';
  error.code = 'TUTOR_STUB_TURN_SUPERSEDED';
  return error;
}

export function assertTutorStubTurnAttemptCurrent({ signal = null, isCurrent = null } = {}) {
  if (signal?.aborted || (typeof isCurrent === 'function' && !isCurrent())) {
    throw abortTutorStubTurnAttempt();
  }
}
