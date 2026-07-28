function jsonClone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

export function replayTutorStubLearnerDagFromTurns(
  state,
  turns,
  { applyLearnerRecordUpdate, learnerPublicEvidenceState } = {},
) {
  if (!state.learnerDag?.enabled || !state.world) return { replayed: 0, skipped: 0 };
  let replayed = 0;
  let skipped = 0;
  for (const turn of turns) {
    const accepted = turn?.tutorLearnerDagUpdate?.accepted;
    if (accepted) {
      const tutorTurn = Number(turn.turn) || replayed + 1;
      const result = applyLearnerRecordUpdate({
        update: {
          adopt: accepted.adopt || [],
          retract: accepted.retract || [],
          derive: accepted.derive || [],
          hypothesis: accepted.hypothesis || null,
          assert_answer: accepted.assertAnswer || null,
          human_discourse: accepted.humanDiscourse || null,
        },
        state,
        tutorTurn,
        learnerText: turn.learner || '',
        dropoutReplay: turn?.dagFactDropout || turn?.tutorLearnerDagUpdate?.dagFactDropout || { legacyNoDropout: true },
        ...learnerPublicEvidenceState(state, tutorTurn),
      });
      state.learnerDag.lastModel = result.model;
      replayed += 1;
      continue;
    }
    if (turn?.tutorLearnerDagModel) {
      state.learnerDag.lastModel = jsonClone(turn.tutorLearnerDagModel);
      skipped += 1;
    }
  }
  return { replayed, skipped };
}
