---
id: hermetic-drop-test-force-exit
title: Drop --test-force-exit from the hermetic root phase
status: review
type: maintenance
priority: P1
owner: claude
source: review
created: 2026-07-26
updated: 2026-07-26
verification: >-
  The root suite completes on its own without the flag in 65 seconds over 495
  files, emitting a complete TAP tail and 6947 tests where the forced-exit run on
  the same commit reported 6940; the new exact-file check names the only two
  files that did not report, both of them import failures from this worktree's
  symlinked node_modules; seven new tests in tests/hermeticTestRunner.test.js
  cover natural teardown reporting every case and every file, a stalled run being
  ended and naming the file that never reported, the absent-report case, the
  timing reporter under both the Node 22 and Node 20 event shapes, and the stall
  message when nothing reported at all; the runner exits 0 on a real Node 20
  child with the exact-file check on; the pre-existing forced-exit test still
  passes behind --force-exit; lint, formatting, and workplan validation pass.
branch: claude/hermetic-drop-force-exit
depends_on:
  - hermetic-tap-summary-on-forced-exit
links:
  prs: []
  notes: []
  items:
    - hermetic-tap-summary-on-forced-exit
    - make-inhoused-tests-and-coverage-first-class
tags:
  - testing
  - ci
  - hermetic
---

## Problem

`--test-force-exit` makes the root test child call `process.exit()` when it
believes the run is over. Two defects follow from that, both recorded in
`hermetic-tap-summary-on-forced-exit` and neither fixed there.

The first is a lost tail: `process.exit()` does not flush a pipe, so under load
the `1..N` plan line and `# tests N` counters are never written. PR #264 worked
around it by writing a second TAP stream to a file and reading whichever channel
survived.

The second is worse and had no mitigation at all. A forced exit can end the run
before its last files are recorded, and the truncated result is internally
consistent: plan line, counters, and `ok` lines all agree at whatever count the
run reached. The integration test added in #264 asserted its fixture's full 60
cases on its first CI run and got 54, on both Node 20 and 22. Nothing caught it,
because `validatePhaseSummary` applies its exact-file check only when
`summary.files` is present and the TAP parser never set that field. A green
hermetic run was therefore not evidence that every selected file ran.

## The recorded fix was wrong

`hermetic-tap-summary-on-forced-exit` proposed dropping the flag but keeping
control of when the child dies: wait for the TAP file to show a complete tail,
then kill the child. That does not work, and the probe that was supposed to
confirm it refuted it instead.

When a test file leaks a handle, the tail is not sitting in a buffer behind the
leak. Node's runner never emits it. A fixture with a leaked `setInterval`
produced 60 `ok` lines and then nothing — no plan line, no counters — three
times out of three at a 20-second timeout, with the file stuck at 6087 bytes.
There is nothing to wait for, so the wait can only ever time out.

## What changed

The flag is gone from the default path. `parseRunnerArgs` and
`buildRootTestArgs` both default `forceExit` to false, `--force-exit` opts back
in, and `--no-force-exit` still parses so the standing handle-audit commands
keep working unchanged.

Three things had to come with it.

**A stall bound.** Without the flag a single leaked handle keeps the runner alive
forever, so the parent ends the wait itself: no output at all for five minutes,
`SIGTERM`, then `SIGKILL` after a five-second grace. The bound is total silence
across every file running concurrently, not per file. The longest single test in
this suite takes about 28 seconds locally, next 10.4, 10.1, 10.0, 8.5, so five
minutes of nothing is a run that has stopped progressing rather than one that has
gone quiet. A stalled run resolves with its own flag rather than a signal,
because the runner treats a signalled child as an interruption and re-raises the
signal on itself.

**A per-file account.** TAP cannot supply one: with multiple files Node hoists
every case to the top level, and a file name appears only when the file fails to
load. The account comes instead from the timing reporter, which now writes its
JSONL line as each file finishes rather than only accumulating and yielding at
end-of-stream. Node emits a file-scoped `test:summary` when a file is done and
nothing at all for a file whose subprocess never exits, so the set of selected
files with no line in that report is exactly the set holding the runner open.
The end-of-stream flush could not have said this, because a stalled run never
reaches the end of its stream.

That per-file `test:summary` is a Node 22 event, which CI found the hard way:
both Node 20 shards failed with every file in the shard reported missing, on a
run where nothing had failed. So the reporter streams where Node lets it and
flushes whatever is left when the stream ends. On Node 20 the whole account
arrives at the end, which is exact for a run that finishes and empty for one
that stalls; the stall message says so rather than implying the runner did not
look. Verified directly on both runtimes with a two-file fixture: the
summary-only reporter writes two lines on 22 and none on 20, and the flushing
one writes both lines on both.

**The exact-file check, extended to the root phase.** `readRootTapSummary` now
attaches `files` from that report, which is what turns on the check the Vitest
phase has always had. Selected paths are normalised to repo-relative form so the
two lists are comparable when files are passed explicitly. A caller who asks for
`--force-exit` is asking for an account that cannot be trusted and is exempted
from the check.

## Evidence

Same worktree, same commit, root suite both ways:

| | files | tests | wall clock |
|---|---|---|---|
| `--test-force-exit` | 495 | 6940 | 58.6s |
| natural teardown | 495 | 6947 | 65.1s |

The suite has no handle debt to fix first: it terminates on its own. Natural
teardown found seven cases the forced exit did not, and the tail arrived
complete.

The exact-file check then did its job on its first real run, naming
`tests/dramaticDerivationProxyDagMemory.test.js` and
`tests/tutorStubCodexRemoteBridge.test.js` as never having reported. Both are
import failures in this worktree, whose symlinked `node_modules` lacks
`rdf-validate-shacl` and `@modelcontextprotocol/sdk`; both are declared
dependencies and present in CI. That case is worth naming because a file that
fails to load emits no file summary and so reads identically to a file that
hung, which is why the runner now points at the import error in the TAP output
above rather than leaving "manifest drift" as the whole explanation.

## What this trades

The old failure mode was a truncated run reported as green. The new one is a
hang. It is bounded at five minutes and it ends with the culprit named, which is
strictly better than silence, but a leaked handle now costs wall clock where it
used to cost accuracy. If a file starts leaking, the message says which one and
`--force-exit` remains as an escape hatch.

## Log

- 2026-07-26 — Opened to finish what #264 left, and to correct the fix that item
  recorded. The "wait for the tail, then kill" design cannot work: a leaked
  handle means the tail is never produced, not that it is late. Verified on the
  full suite; the four failures are the same environmental pair as #264 (two
  missing packages, two assertions on the worktree's directory name).
- 2026-07-26 — First CI run failed both Node 20 shards and passed both Node 22
  shards: the per-file `test:summary` the reporter had been keyed to is a Node
  22 event, so on 20 the report was empty and the new exact-file check read that
  as every file missing. Fixed by flushing any unreported file at end of stream.
  Checked against a downloaded Node 20.19.0 rather than inferred: the old
  reporter writes 0 lines there and 2 on 22 for the same fixture, the new one
  writes 2 on both, and the full runner exits 0 under a Node 20 parent and child
  with the exact-file check active.
