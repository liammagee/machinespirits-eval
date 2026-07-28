export function tutorStubTypedActionDecisionFromTurn(turn) {
  const candidates = [
    turn?.typedActionDecision,
    turn?.typed_action_decision,
    turn?.registerSelection?.typed_action_decision,
  ];
  return candidates.find((candidate) => candidate && typeof candidate === 'object' && candidate.contract_id) || null;
}
