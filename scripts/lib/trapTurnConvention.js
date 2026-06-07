// Shared turn-index contract for trap-scenario runners and scorers.
//
// `triggerTurn` names the learner turn index that emits the hidden trigger.
// Runners call learnerTurn immediately after tutor turn t with `turn = t`.
// Therefore a trigger at learner turn t is first answerable by tutor turn t+1,
// which is the policy decision scored by strict_shift.

export function learnerTurnIndexForTutorTurn(tutorTurn) {
  return tutorTurn;
}

export function scoredTutorTurnAfterTrigger(triggerTurn) {
  return triggerTurn + 1;
}

export function shiftWindowTutorTurns(triggerTurn, offsets = [1, 2, 3]) {
  return offsets.map((offset) => triggerTurn + offset);
}
