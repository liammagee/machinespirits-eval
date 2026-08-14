# 093a — Reviewer amendment: resume provenance widening and counter

**Date:** 13 August 2026. Rules on driver report 093 (`fe1da3da`).
Amends ruling 092a. Authority: 052a, 083d (standing resume
authority), 088/088a (transport-constant and re-pin precedent),
091a, 092a.

## The driver's stop was correct — both findings stand

1. **Provenance contradiction confirmed in code by the reviewer,
   zero-call.** Both children require the collection's commit stamp,
   the freeze's commit stamp, and the current clean HEAD to be equal
   (semantic reader lines 114–129; decision reader lines 83–86), and
   the parent re-emits the freeze at HEAD on every resume. The relay
   protocol itself commits every ruling and report, so HEAD always
   moves between failure and resume. As written the guard forbids
   EVERY post-failure reader resume — it assumes a resume with no
   commits in between, which this protocol can never satisfy. That
   makes it a run-management transport defect in the same family as
   091a and 092a, and it gets a registered, disclosed widening — not
   a falsified commit stamp. The driver was right to refuse to
   manufacture one.
2. **Counter corrected to 4,966.** The child checkpoints are the
   authoritative attempt record: 152 presence + 121 decision = 273
   reader attempts, two of them without responses. The opening
   counter is 4,198 settled + 495 generation + 273 = **4,966 of
   19,337**. Ruling 092a's 272 and STATE's 4,965 are superseded.

## Amended repair (replaces 092a tasks 1–3; tasks 4–8 stand amended below)

1. **Parent: reuse the original emitted freeze on resume.** When the
   child checkpoints exist, the parent must NOT re-emit the freeze at
   HEAD. It loads the original emitted freeze file from the run root
   and checks its hash equals the freeze hash recorded in the parent
   checkpoint. The original freeze is the paid run's true record —
   nothing is falsified. Collection reuse stays as 092a task 1 wrote
   it (integrity-checked, no preparer call).
2. **Children: resume-only provenance widening.** In both child
   runners, when the resume flag is set: drop ONLY the requirement
   that the commit stamp equals current HEAD; keep the clean-worktree
   requirement and keep the absolute equality between freeze stamp,
   manifest stamp, and the checkpoint's recorded launch stamp; and
   append the current HEAD to a `resumed_at_commits` list in the
   child checkpoint, so every resume commit is on the record. The
   fresh-start path keeps the exact-HEAD check unchanged.
3. **Children: failed-attempt allowance** — unchanged from 092a task
   2 (named constant, 12, byte-symmetric).
4. **Authorized diff scope per child** (amends 092a task 3): exactly
   four elements — the allowance constant, the attempts comparison,
   the resume-only widening of the HEAD equality, and the
   resume-commit recording. Byte-symmetric between the two children
   where their code mirrors. Nothing else. Re-pin
   `decision_channel.digests.reader_runner_sha256` in the pilot
   manifest and record the full diff of BOTH children in the report
   as the equivalence proof. The semantic runner is not among the
   seven pinned checks; no other pin, cap, service, or preparer
   changes.
5. **Tests** (amends 092a task 4): add to the prior list — a resumed
   child accepts a launch stamp older than HEAD and records the
   resume commit; a fresh child still refuses a stale stamp; the
   reused freeze must match the parent checkpoint's recorded hash.
   Run the suites the same way as report 092 planned, plus ESLint.
6. Commit as usual; resume with the GO-note command plus `--resume`;
   regenerate the two commit-stale zero-call artifacts in place,
   disclosed. Expected remaining spend if nothing else fails: 137
   presence + 168 decision attempts, ending near 5,271 of 19,337.
   Reconcile the counter from the child checkpoints and show the
   arithmetic.
7. Watch to completion and report — the number is **094**. Report
   per-channel attempted/completed/failed, the counter, and the
   observed endpoint values. Interpretation stays reserved to the
   reviewer.

NEVER push. Never touch paid artifacts — responses, child
checkpoints, both packet collections, and the original emitted
freeze. A substantive fail stays terminal.
