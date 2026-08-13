# 097a — GO note: launch the outcome main block

**Date:** 13 August 2026. **Authority:** registration 096
(`bc90b548`) as amended by 096a (`30227122`, seeds 524–535); human
GO, verbatim "GO" (13 Aug, in-session); build report 098
(`b8e4bd63`), reviewer-checked zero-call: child runner byte-pinned
at `c0a20130…`, manifest seeds 524–535, decision channel only,
launch held by default, paid path refused without this note.

## Command

From the worktree root:

```bash
node scripts/run-adaptive-warrant-outcome-main-block.js --accept-charges
```

## Bounds

- 72 dialogues (24 per condition), worlds 101/102, seeds 524–535,
  8 turns, generation cap 2,160 calls (30 per dialogue).
- Decision readers: 1,152 planned, absolute attempt ceiling 1,200.
- Approximate total 3,200; absolute cap 3,360. Counter opens
  **5,274 / 19,337**; even at the cap it stays under 8,700.
- Resumption from technical failures is authorized (083d, 052a):
  quarantine, disclose, re-take within the allowance. A substantive
  fail is terminal — stop and report, never patch a live run.
- No presence channel. No pooling with the 18 pilot dialogues in
  any confirmatory table.

## After the run

Assemble, run the full-contract acceptance audit over all 1,152
responses, score, and write **report 099**: assembly status against
the 576-case freeze, per-channel attempted/completed/failed, counter
arithmetic from the child checkpoints, and the observed values for
M1–M6 plus the report-only M7/M8 (labeled "not reader-validated").
Interpretation stays reserved to the reviewer. Archive the run dir
per the standing archive rule after sealing. NEVER push the branch.
