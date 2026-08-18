# 109 — GO: smoke C, guarded pole

Date: 2026-08-15
Workplan item: guarded-learner-outcome-study
Follows: relay 108 (build report and request)
Status: **GO.** Committed before the run starts.

## 1. The approval

Relay 108 §3 put the request to the user. The reply, verbatim and complete:

> Approved

That is the whole of it. It covers the one rung relay 108 asked for and
nothing else: **smoke C, one gated dialogue, bound at 30 calls**. It does
not reach the defensive pilot, the main block, or any later run. Each of
those needs its own note and its own word.

## 2. What runs

Copied from relay 108 §3, which copied it from the smoke B run plan
(`../ms-adaptation-refinement/.tutor-stub-auto-eval/bad-learner-smoke-B-s519-2026-08-13/run-plan.json`).
Three changes from smoke B and nothing else: the guard flag, a fresh seed,
a fresh run directory.

```bash
TUTOR_STUB_GUARDED_LEARNER_MOVES=1 node scripts/run-tutor-stub-auto-eval.js \
  --runs 1 \
  --run-seed 550 \
  --turns 8 \
  --policies dynamic \
  --warrant-gate active \
  --model codex.gpt-5.6-luna \
  --analysis-model codex.gpt-5.6-luna \
  --auto-learner-model codex.gpt-5.6-luna \
  --auto-learner-profile-id overconfident \
  --model-call-budget 30 \
  --world docs/adaptation-refinement/outcome-study-a1/worlds/world_102_marigold_archive_box.yaml \
  --dag-mode strict_dag \
  --loop-mode strict \
  --cli-effort medium \
  --max-tokens 4096 \
  --history-turns 4 \
  --learner-analysis-prompt-profile handbook_v1 \
  --trace-dir .tutor-stub-auto-eval/guarded-learner-smoke-C-s550-2026-08-15
```

Run from the worktree `../ms-guarded-learner` on branch
`build/guarded-learner-v3.3` at commit `7a434de3`.

## 3. Seed check, re-run at GO time

Seed **550**, checked by machine again just before this note was written,
not carried over from yesterday's reading. The steering decomposition's own
freshness audit (`auditSteeringDecompositionSeedFreshness`, zero model
calls) over the window 545–555, across all three worktree run directories,
`/private/tmp` and the private archive — 7,001 metadata files inspected:

- burned: 545, 546, 548, 549
- fresh: 547, **550**, 551, 552, 553, 554, 555

The dry-run scratch directory from relay 108 was deleted, so it left no
trace to burn the seed. Confirmed: `.tutor-stub-auto-eval/` holds no smoke
C directory at GO time.

## 4. What it is for

Two things the tests cannot show, because both need a real dialogue:

1. the three new defensive speech acts fire on model-written learner
   speech, not just on hand-built spans;
2. the sensor arms at the defensive pole — straight defended over-claim
   turns produce the basis `sustained_defended_overclaim` on
   `challenge_resistance`, where smoke B produced `low_agency_deferral` on
   five of eight turns.

It also gives the first live reading of the guard's fire rate. Smoke B says
the unguarded persona held 8 turns of 8, so a rate near zero is expected
and would show the guard is insurance, not rescue.

## 5. Stop rules

- Any delivered challenge is a design event to report, not a fault. The
  dialogue goes on.
- A technical failure quarantines and gets reported.
- A substantive failure is terminal: stop and report. **Never patch a live
  run.**
- The budget is 30 calls. It is not raised mid-run.

## 6. Pooling

**Diagnostic only. Smoke C is never pooled** with the defensive pilot, the
main block, or any sealed corpus. It reads as a build check on live speech
and nothing more.

## 7. After

Registration for the defensive pilot, written from what smoke C shows: N,
the count of straight defended over-claim turns that arms the sensor on
live speech; the burned seed list re-enumerated at that time; the pilot
size; and the stop rules for dead instruments. It carries no main-block
predictions, and it amends nothing sealed.

Artifacts get copied to the private archive (`npm run archive:runs`) once
the run ends. `exports/` and `.tutor-stub-auto-eval/` are not in git.

NEVER push this branch.
