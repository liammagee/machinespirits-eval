# 017b — Supplement to 017: runner-side guards (build with the fix)

**Date:** 12 August 2026

Whatever the flag diagnosis shows, the repair commit must also add two
runtime guards to the matrix runner, generalizing 017's manual rule:

1. **First-call gate.** The runner verifies its own first completed
   learner-analysis call. If it records the no-signal marker, the runner
   aborts the run at once (before the next dialogue starts), reporting
   the failure code. A run must not proceed past its first blind turn.
2. **Coverage self-halt.** The runner tracks the running unanalyzed rate
   and halts itself at the next dialogue boundary if the rate reaches
   10% with at least 10 analysis turns observed. The halt writes a
   typed status (`coverage_halt`) into the run manifest so the freeze
   checker refuses the corpus without human interpretation being needed.

Both guards are design-level constants of the runner, covered by the
zero-call preflight (assert both are present and wired), with focused
tests: one simulated no-signal first call, one simulated rate breach.

Sharing rule restated from 017: the acceptance-ping harness and the live
analysis seat must build their provider requests through one shared
function. A ping that exercises a private copy of the request path
proves nothing about the run.
