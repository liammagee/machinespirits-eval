# Program 2 weights x interface factorial - Amendment 2

Status: **FROZEN 2026-07-26 BEFORE AMENDMENT 2 PAID CALLS.**

This amendment licenses one checkpoint-bound resume after the Amendment 1
recovery launcher stopped on an unclassified Claude CLI process exit. It does
not license replacement jobs, a third attempt, treatment changes, or mutation
of the original cohort.

Parent records:

- `PROGRAM-2-WEIGHTS-INTERFACE-FACTORIAL-PREREGISTRATION.md`
- `PROGRAM-2-WEIGHTS-INTERFACE-FACTORIAL-AMENDMENT-1.md`
- Amendment 1 implementation SHA
  `b4ea054622c9fb7118f929debb4dc1a426f64ad6`
- original frozen output root `exports/program2-weights-interface-factorial`
- Amendment 1 recovery root
  `exports/program2-weights-interface-factorial-recovery-a1`
- halted recovery launch-plan SHA-256
  `fd2d239e3f440056ac872db973333987b18ffdb9424caa7a0a78460f708e78d4`
- halted recovery launch-state SHA-256
  `9800be9c07fa3d2cd6d385686ac5620ea33c29c8221dad86cc119dac1cf72c9b`

## 1. Frozen checkpoint

At the Amendment 1 stop:

- `p2wi-35-affective_resistant-trained_v1-r3` is sealed on logical attempt 2;
- its sealed trace is
  `2026-07-25T13-21-40-189Z.jsonl`, SHA-256
  `f98f7efe74a82415e36897a88c2153bd81c3c920bee7aefc9c340ef9cfca0927`;
- `p2wi-36-affective_resistant-trained_v2-r3` has exactly one counted failure;
- that attempt reached turn 14 and ended with
  `CLI_PROVIDER_EXIT_FAILED: claude CLI exited with code 1`;
- its failed trace is `2026-07-25T13-42-07-407Z.jsonl`, SHA-256
  `036c1d5096ff996afd189710f27e71231fc08dc042bf4402aff514cc888e59f8`;
- jobs 37-48 have not been opened in the Amendment 1 recovery root; and
- the original root remains unchanged and authoritative for its sealed jobs.

The failed turn-14 draft repair is an infrastructure failure, not a semantic
outcome. Sonnet completed the first composer call in that turn; the CLI exited
only on the subsequent bounded repair call. The bridge retained the exit code
but discarded the provider stderr text, so no narrower historical subtype can
be established after the fact.

## 2. Permitted repair

Before the resume, implementation changes are limited to:

1. classifying Claude CLI stderr into safe, bounded failure categories while
   never persisting raw stderr;
2. persisting only safe exit metadata: provider, error code, failure category,
   numeric exit code, and stdout/stderr byte counts;
3. treating an otherwise unclassified `CLI_PROVIDER_EXIT_FAILED` as a
   retryable provider-transport failure under the existing three-consecutive-
   failure circuit breaker;
4. retaining provider policy, usage/capacity, and authentication failures as
   immediate global stops; and
5. adding an explicit halted-checkpoint resume authorization bound to the exact
   launch-state SHA-256, exact job id, and its one-attempt failed state.

No prompt, world, learner profile, tutor policy, committee detector, mini-model
weight, v1/v2 interface, cue-blind fallback, model assignment, seed, horizon,
stopping rule, treatment command, or semantic instrument may change.

## 3. Resume authorization

After tests and an excluded paid Sonnet smoke pass at a clean committed SHA,
the launcher may clear the halted marker only when all of these match:

- checkpoint SHA-256
  `9800be9c07fa3d2cd6d385686ac5620ea33c29c8221dad86cc119dac1cf72c9b`;
- halted job id
  `p2wi-36-affective_resistant-trained_v2-r3`;
- job status `failed`, logical attempts `1`, no finalized attrition; and
- failure kind `child_process` with the recorded Amendment 1 abort reason.

The authorization must be appended to launch-state history before a model call.
The historical failed attempt remains counted. Its unclassified CLI exit also
starts the consecutive provider-transport counter at one.

Execution then resumes as follows:

1. job 35 is skipped as sealed;
2. job 36 runs logical attempt 2 only;
3. jobs 37-48 retain their original two-attempt limits;
4. job 36 becomes finalized attrition if attempt 2 fails;
5. no replacement or third-attempt job may be created; and
6. the launcher stops on any provider policy/capacity/authentication failure or
   on three consecutive provider-transport failures, counting the historical
   job-36 exit until a job seals successfully.

## 4. Reading rule

The Amendment 1 authoritative-trace rule remains unchanged. The combined
provenance/cue-blind audit must cover the original root and the recovery root
before semantic judging. Any estimate remains labeled
**Amendments 1-2 infrastructure-recovered**.

If the exact checkpoint gate, excluded Sonnet smoke, command-equivalence gate,
or combined provenance audit fails, the cohort remains
`incomplete_or_under_informative`.
