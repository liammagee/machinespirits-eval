---
id: hermetic-tap-summary-on-forced-exit
title: Read the hermetic root verdict from a channel that survives forced exit
status: done
type: maintenance
priority: P1
owner: claude
source: review
created: 2026-07-26
updated: 2026-07-26
verification: >-
  A backpressured-pipe reproduction fails on stdout three times out of three and
  succeeds on the file channel three times out of three; eight new tests in
  tests/hermeticTestRunner.test.js cover the completeness marker, the per-channel
  error text, the argument shape, both read paths, and a real forced-exit child;
  the full hermetic suite reads its verdict through the new file channel over 494
  files and 6926 tests, with the only four failures traced to this worktree's
  symlinked node_modules and its directory name; lint, formatting, and workplan
  validation pass.
branch: claude/hermetic-tap-summary
depends_on:
  - optimize-hermetic-test-suite
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/264
  notes: []
  items:
    - optimize-hermetic-test-suite
    - hermetic-drop-test-force-exit
tags:
  - testing
  - ci
  - hermetic
---

## Problem

The first CI run on PR #259 failed all four root test shards with
`root Node test output omitted the TAP test summary`, thrown at
`scripts/hermetic-test-contract.js:173`. The failing shard's log held 1508 `ok`
lines, zero `not ok` lines, and no stack trace — a completely green run reported
as a hard failure. `main` was green at the time, and an unchanged rerun passed
all ten checks, so the run was never in question; the reading of it was.

The runner reads the phase verdict out of the child's piped stdout.
`--test-force-exit` makes the child call `process.exit()`, and Node does not
flush a pipe on exit, so whatever sits in the stdout buffer is discarded. Under
a loaded runner the trailing `1..N` plan line and `# tests N` counters are
therefore never written at all. The parent's existing drain machinery cannot
help: it waits patiently for bytes the child never sent.

Sharding did not cause this. It raised the load on a single runner enough to
make an existing race visible.

## What changed

The root phase now writes a second TAP stream to a file
(`root-node-test-output.tap`) beside the piped one, and the verdict is read
from the file. The piped stream is unchanged and remains the live CI log, and
it stays as a fallback so a caller that builds phases without a `tapPath` still
works.

`nodeTapOutputIsComplete` checks for the `1..N` plan line and the `# tests N`
counter separately. Node emits the plan line only once a run has finished, so
it is a tail marker independent of the counters, and a stream truncated between
the two now fails loudly instead of reporting a plausible-looking undercount.
When neither channel carries a complete tail, the error names both with their
byte counts, because "the summary is missing" and "the tests failed" are
otherwise indistinguishable from the message.

## Evidence

Reproduced by spawning `node --test --test-force-exit` and reading its stdout
slowly (4 KB every 25 ms), which is what a loaded runner does:

- Before: stdout truncated at 37 of 400 `ok` lines with no plan line and no
  counters, three times out of three. This is the exact CI symptom.
- After: the file channel carried a complete, internally consistent tail three
  times out of three — plan line, counters, and `ok` line count all agreeing,
  with no gaps in the numbering — and the verdict read cleanly each time.

The real pipeline then read its verdict through the file channel across the full
suite: 494 files, 6926 tests. Four tests failed, none of them code. Two are file
loads that need packages absent from this worktree's symlinked `node_modules`
(`@modelcontextprotocol/sdk`, `rdf-validate-shacl`). The other two assert
`Repository metrics: machinespirits-eval`, which `scripts/repository-metrics.js`
builds from `path.basename(root)`; this worktree is called `ms-hermetic-tap`. CI
checks out into a directory named for the repository, so both pass there.

## Two channels, not a safe one

A file destination is not immune to `process.exit()`, and CI refuted two
successively weaker claims about it. First, that the file is always complete:
Node 20 lost the tail on the file in a child that starts and exits inside a
quarter of a second. Then, that the file is at least never the poorer of the
two: Node 20 produced a run where the pipe carried the tail and the file did
not.

The two channels fail under different conditions. The pipe loses the tail when
the parent reads slowly, which is the flake this change exists for. The file
loses it when the child exits almost immediately, which the real root phase —
minutes of output rather than milliseconds — has not done across eight shard
jobs on both Node versions.

So the change does not buy a safe channel. It buys two independent ones and a
reader that takes whichever survived, and the stdout fallback in
`readRootTapSummary` is load-bearing rather than a courtesy to callers that
build phases without a `tapPath`. The integration test asserts the union: it
fails only when both channels lose the tail at once.

The durable fix is to stop racing the reporter at all — run the root phase
without `--test-force-exit`. That removes both this race and the short run
below, because nothing cuts the run off. It changes how every root phase
terminates, which is why it is not folded in here; it was done separately in
`hermetic-drop-test-force-exit`.

Correction: this section first proposed waiting for the TAP file to show a
complete tail and only then killing the child. That cannot work. A file with a
leaked handle never produces a tail at all — no plan line, no counters — so
there is nothing to wait for and the wait can only time out. The follow-up item
records the probe and the design that replaced it.

## A second defect, observed and not fixed here

A forced exit can also end the run short, not just lose its output, and the
short run is invisible from the tail: the plan line, the counters, and the `ok`
lines all agree with each other at whatever count the run reached.

Under the artificial backpressure the reported count varied between runs (400,
396, 394), with the `ok` lines numbered `1..394` and no gaps — the last cases
simply never appeared. That could be dismissed as an artefact of a reader far
slower than any real runner. It is not. The forced-exit integration test in this
change asserted its fixture's full 60 cases on its first CI run and got 54, on
GitHub's runners, on both Node 20 and 22. The assertion was loosened to internal
consistency, because a short run is a different defect from a lost tail and this
change does not address it.

Nothing currently catches it. `validatePhaseSummary` only enforces its
exact-file check when `summary.files` is present, and `parseNodeTapSummary` does
not populate that field, so the root phase has no per-file execution check at
all. The consequence is that a green hermetic run is not by itself evidence that
every selected file ran.

Follow-up, deliberately not folded in and since closed by
`hermetic-drop-test-force-exit`: the flag was dropped, the per-file account came
from the timing reporter rather than from TAP (TAP hoists cases to the top level
and names no files), and the exact-file check now covers the root phase.

## Log

- 2026-07-26 — Opened after the flake on PR #259 and fixed in a separate
  worktree at the user's direction, so the residual-C tutor-stub work stayed
  unentangled from it. Eight new tests in `tests/hermeticTestRunner.test.js`;
  the last of them spawns a real forced-exit child and asserts the file channel
  carries the tail. That test clears `NODE_TEST_CONTEXT` from the child's
  environment, because the test is itself inside `node --test` and the
  recursion marker otherwise makes the spawned runner decline to run any files.
- 2026-07-26 — Merged as #264 and closed. The two-channel read stays as the
  fallback it was built to be, but the race it works around is gone:
  `hermetic-drop-test-force-exit` removed the flag, so nothing cuts the run off
  and the tail is produced normally. The second defect recorded here — a forced
  exit ending the run short, invisibly — was measured in CI once that item
  landed: the last forced-exit run of main reported 3943 tests on one Node
  version and 3898 on the other for the identical shard. It is the same defect
  this item observed and declined to fix.
