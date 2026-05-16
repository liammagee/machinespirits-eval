export function conditionFeatures(condition) {
  const value = String(condition || '');
  const reflexive = value.startsWith('controller_reflexive');
  const controller = value === 'controller_codex' || reflexive;
  return {
    controller,
    reflexive,
    static: value === 'static_codex',
    challengeState: !hasAny(value, ['no_challenge', 'no_challenge_state']),
    outcomeGate: !hasAny(value, ['no_outcome_gate', 'ungated']),
    superego: !hasAny(value, ['ego_only', 'no_superego']),
    memory: !hasAny(value, ['no_memory', 'memoryless']),
  };
}

function hasAny(value, tokens) {
  return tokens.some((token) => value.includes(token));
}
