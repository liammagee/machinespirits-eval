/**
 * What a recorded outcome-pilot dialogue is: one that ran to a stop of its own,
 * one the harness killed, or one that left no readable trace.
 *
 * A dialogue whose child exits non-zero stopped for a reason of the harness's
 * making. In the 2026-07-30 re-pilot one died at turn 15 because the tutor's own
 * fallback text tripped the leak guard. Its trace parses and its closure reads
 * `grounded: false`, so counting it as a dialogue the tutor failed to close
 * would put a crash in the gate's denominator.
 *
 * The rule lives here because the runner and the offline recompute both decide
 * which dialogues count, and two copies of this would drift — which is the whole
 * mistake this exists to stop.
 *
 * Classified from the exit code rather than the status field, so rows written
 * before the distinction existed are read the same way.
 */
export function tutorStubOutcomeRowKind(row) {
  if (row?.status === 'error') return 'error';
  return row?.exitCode === 0 ? 'complete' : 'aborted';
}
