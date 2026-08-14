# 091a — Reviewer ruling: reader-launcher resume repair

**Date:** 13 August 2026. Rules on driver report 091 (`7fc23740`).
Authority: 052a (technical failure: quarantine, disclose, re-take),
083d (standing resume authority), 088/088a, 090a.

## Ruling: TECHNICAL. Launcher defect, zero reader calls.

The reviewer confirmed the driver's diagnosis in the code, zero-call:

- The outcome launcher passes `--resume` to both child reader
  commands whenever the parent resumes
  (`scripts/run-adaptive-warrant-outcome-pilot.js`, the two
  `...(resume ? ['--resume'] : [])` spreads in `runReaderProcesses`'
  call site).
- Each child then reads its own run checkpoint before it writes one
  (`run-adaptive-warrant-semantic-readers.js` line 283;
  `run-adaptive-warrant-decision-readers.js` line 189). The reader
  output directories are fresh, so no checkpoint exists and both
  children exit before the first call.
- Child stderr was lost because `spawnLogged` (line 574) only writes
  a log when a `logPath` is supplied, and the reader spawns supply
  none.

The children have never run, so a FRESH child start is the correct
behavior here — the parent's resume state and the children's resume
state are independent. This is a run-management transport defect in
the launcher, not a change to the frozen instrument.

## Repair site: the PARENT only

The parent launcher is pinned by no digest: its hash appears in no
manifest pin, no freeze artifact, and not in `FINGERPRINT_FILES`.
Repairing either child runner would move
`decision_channel.digests.reader_runner_sha256` or the semantic
runner fingerprint. So the repair touches only
`scripts/run-adaptive-warrant-outcome-pilot.js`.

## Tasks for the driver

1. In the reader dispatch, pass `--resume` to a child only when that
   child's own checkpoint file exists:
   - semantic child: `presence-readers/semantic-reader-run.json`
     under the run root;
   - decision child: `decision-readers/decision-reader-run.json`
     under the run root.
   When the file is absent, pass no `--resume`; the child starts
   fresh on its empty directory, which is the normal fresh path.
2. Retain child output: thread a `logPath` for each child through
   `runReaderProcesses` into `spawnLogged`. Put the log files in the
   run ROOT (for example `presence-readers-launcher.log` and
   `decision-readers-launcher.log`), NEVER inside the child output
   directories — the children refuse non-empty directories.
3. Touch no digest, no cap, no child runner, no service, no manifest
   pin. The frozen-reader bindings guard must still pass all seven
   checks unchanged.
4. Tests: extend `tests/adaptiveWarrantOutcomePilot.test.js` to cover
   both branches — a resumed parent with fresh reader directories
   passes no `--resume` to the children; a resumed parent with an
   existing child checkpoint passes `--resume` to that child. Run the
   full suite and ESLint.
5. Commit with the usual no-hooks command and trailers.
6. Resume with the GO-note command plus `--resume`. The two zero-call
   artifacts (`semantic-brittleness-preflight.json`,
   `semantic-schema-acceptance-carryover.json`) will refuse as
   commit-stale after your commit: regenerate them in place with the
   repository scripts, zero calls, and disclose, as before.
7. Self-quarantine authority (extends 090a): if a resume refuses on a
   non-empty reader-output or packet-output directory whose content
   holds ZERO reader response files, you may move it, preserved, to a
   sibling quarantine name, record the move, and retry. A directory
   holding ANY reader response file is paid — it is never moved;
   stop and report instead.
8. Watch to completion and report — the number is **092**. Report
   the exact per-channel call counts, the counter, and the observed
   endpoint values. Interpretation stays reserved to the reviewer.

NEVER push. Never touch paid artifacts. A substantive fail stays
terminal.
