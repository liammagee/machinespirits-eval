# Program 2 weights x interface factorial - Amendment 1

Status: **FROZEN 2026-07-25 BEFORE RECOVERY CALLS.**

This amendment licenses a bounded infrastructure-recovery cohort for the
systemically interrupted tail of the 48-dialogue weights x interface
factorial. It does not overwrite, relabel, or delete any original attempt.

Parent preregistration:

- `PROGRAM-2-WEIGHTS-INTERFACE-FACTORIAL-PREREGISTRATION.md`
- original implementation SHA
  `399834f79f7f042ec116d1e8bb18484d6df91068`
- original output root `exports/program2-weights-interface-factorial`
- frozen original launch-plan SHA-256
  `bbb88b5813fdb40181ee66a33c7d9d5baad5334827c81746b6c1d5660aeeee57`
- frozen original launch-state SHA-256
  `0df359bd2e5672cc7422ef4c33838325cdcf975bb55959793b691d7a276219d5`

## 1. Incident boundary

The first persistent CLI-policy failure occurred in original job 35 attempt 2
at 2026-07-25T09:05:45Z. Jobs 36-48 then encountered the same
`codex CLI response rejected by the no-tools policy` failure. A launchd
`KeepAlive` loop repeatedly restarted the supervisor after each correctly
aborted launcher process, reset the supervisor's process-level retry counter,
and advanced across the remaining queue.

The original cohort is retained as 32 sealed dialogues and 16 finalized
attritions. Jobs 10 and 15 are pre-incident deterministic final-audit
attritions and are not eligible for recovery. Original failed and interrupted
traces are never pooled with sealed outcomes.

## 2. Fixed recovery set

The recovery set is the complete contiguous incident tail, selected solely by
the first persistent infrastructure-failure boundary and before semantic
judging:

`p2wi-35` through `p2wi-48`, inclusive (14 jobs).

The exact full job IDs are:

1. `p2wi-35-affective_resistant-trained_v1-r3`
2. `p2wi-36-affective_resistant-trained_v2-r3`
3. `p2wi-37-affective_resistant-trained_v2-r1`
4. `p2wi-38-affective_resistant-trained_v2-r6`
5. `p2wi-39-affective_resistant-trained_v1-r5`
6. `p2wi-40-affective_resistant-trained_v2-r4`
7. `p2wi-41-affective_resistant-untuned_v2-r2`
8. `p2wi-42-affective_resistant-trained_v2-r5`
9. `p2wi-43-affective_resistant-untuned_v1-r5`
10. `p2wi-44-affective_resistant-trained_v2-r2`
11. `p2wi-45-affective_resistant-trained_v1-r2`
12. `p2wi-46-proof_skipper-trained_v2-r4`
13. `p2wi-47-proof_skipper-trained_v2-r5`
14. `p2wi-48-proof_skipper-untuned_v1-r3`

No other job may be regenerated. In particular, the two pre-incident
deterministic attritions remain attrition.

## 3. Permitted repair

Before recovery launch, the implementation may change only:

- safe persistence of CLI-policy audit metadata: error code, provider,
  allowlisted event-type counts, allowlisted item-type counts, prohibited
  event count and safe type labels, and invalid-JSONL count;
- launcher classification of `CLI_PROVIDER_POLICY_VIOLATION` as a common
  provider-policy failure with a global circuit breaker;
- launcher selection of a fixed ordinal range from the unchanged deterministic
  48-job plan;
- supervisor lifecycle behavior needed to prevent an external restart loop
  from bypassing the launcher's abort; and
- analyzers/auditors needed to combine original and recovery roots under the
  authoritative-trace rule below.

The repair may not change prompts, learner profiles, world, tutor policy,
committee detector, trained or untuned mini weights, v1/v2 span extraction,
cue-blind fallback, model assignments, seeds, turn horizon, stopping rules,
retry limit, semantic instrument, or treatment command flags.

## 4. Ordered recovery gates

1. Stop and unload the runaway launchd service.
2. Preserve the original plan, state, traces, and hashes unchanged.
3. Add regression tests proving safe policy-audit persistence, failure
   classification, ordinal selection, and global abort behavior.
4. Run the repository's required zero-model quality and prompt/world gates.
5. Run one excluded paid CLI-policy smoke. It must either pass with a strict
   zero-prohibited-event audit or expose the exact safe rejection subtype. It
   may not be analyzed as an experimental observation.
6. Commit the amendment and repair at a clean 40-character SHA.
7. Generate the normal deterministic 48-job plan in the fresh recovery root
   `exports/program2-weights-interface-factorial-recovery-a1`, but authorize
   execution only for ordinals 35-48.
8. Verify that every selected recovery command is byte-identical to the
   corresponding original command after normalizing only output-root paths and
   implementation-SHA provenance.
9. Run the selected jobs serially, with at most two logical attempts per job,
   no replacement jobs, and a global stop after the first non-retryable policy
   failure or three consecutive retryable provider failures.
10. Run the frozen provenance/cue-blind audit on both roots before semantic
    judging.

## 5. Authoritative-trace and reading rule

For each of the original 48 planned job IDs:

- use the original sealed trace when one exists;
- otherwise, only for jobs 35-48, use one sealed Amendment 1 recovery trace;
- never use failed, interrupted, superseded, or partially written traces; and
- retain original jobs 10 and 15 as attrition.

The combined completion gate is evaluated on that 48-job authoritative set.
If all 14 recovery jobs seal, the expected cell completion is:

- `untuned_v2`: 12/12;
- `trained_v2`: 12/12;
- `untuned_v1`: 11/12; and
- `trained_v1`: 11/12.

Passing the original completion, matched-block, opportunity, attrition-balance,
provenance, safety, coverage, cue-blind, and trace-integrity gates licenses the
frozen semantic judging sequence. Any resulting estimate must be labeled
**Amendment 1 infrastructure-recovered**, not an untouched original-cohort
estimate.

If a recovery job fails, a treatment command drifts, an original artifact is
mutated, the policy subtype remains unobservable, or any combined gate fails,
the result remains `incomplete_or_under_informative`. No further replacement
or selective recovery is licensed by this amendment.
