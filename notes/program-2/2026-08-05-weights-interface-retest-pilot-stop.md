# Program 2 weights × interface retest: excluded-pilot stop

- Date: 2026-08-05
- Workplan item: `program-2-weights-interface-retest`
- Source commit: `c495232728efb95e671df241432306d88876f4bd`
- Disposition: stopped by the frozen pilot gate; incomplete and under-informative

## Launch boundary

The user authorized the preregistered eight-dialogue excluded pilot only. The
launch certificate passed against the clean source commit above. Its hard caps
were eight jobs, two attempts per job, 5,120 provider calls, and 20,971,520
reserved output tokens. The 48-dialogue cohort remained unauthorized and was
not launched.

The ignored evidence bundle is rooted at
`exports/program2-weights-interface-retest-pilot/`. Its binding artifacts are:

- `launch-plan.json`: SHA-256
  `331172523a7b799c10960ff7ab94d4c205b945659cf9f0f8a7f3e7bdd85b32bb`
- `launch-certificate.json`: SHA-256
  `335687570e05c07b4e20fab61eace22044973cbd497aa37f6585a3ce4d87d3ef`
- `launch-state.json`: SHA-256
  `1748ae7e56e36d92eb6b652f3c463f5b92a293e9678a100543468827d9da089e`
- `partial-analysis.json`: SHA-256
  `9eeb7a56e208ab8ec8e5e65764d9be4b2dcb54ff02b4ee091c0cd2105938de27`

## What ran

The runner sealed two of eight planned jobs before stopping:

1. `p2wi-retest-pilot-01-affective_resistant-untuned_v1-r1` took two
   attempts. The first attempt failed closed at turn 16 on
   `leak:private_die_conclusion`; the successful retry reached 23 turns,
   preserved answer secrecy, and had 0.833 learner proof-path coverage at the
   frozen turn-22 horizon. The sealed trace SHA-256 is
   `23d381404dd53de94993951c492aabc1a34b7639b02af00f38f3a2d4982e6e38`.
2. `p2wi-retest-pilot-02-affective_resistant-trained_v1-r1` sealed on its
   first attempt after 24 turns, preserved answer secrecy, and had 0.667
   learner proof-path coverage at turn 22. Its trace SHA-256 is
   `ab2cbf5382592691592ac12ca3d716c281b278206db51085b3fb64f74135ddee`.

The frozen live gate then aborted with:

> futility stop: p2wi-retest-pilot-02-affective_resistant-trained_v1-r1:
> coverage 0.667 is below 0.800

Six jobs remained pending. No third job, semantic judging, treatment estimate,
or cohort launch followed. The partial analyzer therefore reports
`incomplete_or_under_informative`, semantic status `gated`, and a null primary
estimate.

## Apparatus findings

### 1. The fixed horizon conflated release with learner uptake

The static certificate correctly established that all authored evidence could
be public by tutor turn 22. In the stopped trained-v1 dialogue, `p_holder` was
released and delivered at turn 22, but the turn-22 learner state necessarily
preceded the learner's opportunity to integrate that just-delivered clue. The
learner did integrate it at turn 23, when proof-path coverage rose from 0.667 to
1.000, and stated the final conclusion at turn 24.

This is a measurement-boundary error, not evidence that the dialogue was
incapable of completion. A replacement design must keep public availability at
turn 22 separate from learner integration. Exact zero-model resummary
subsequently showed both sealed successful traces at coverage 1.000 with
complete hard-safety evidence at turn 23. Amendment 1 therefore keeps a release
gate at turn 22 and fixes learner uptake at turn 23.

### 2. Neither sealed job exposed the weights × interface treatment

Both sealed jobs recorded zero eligible committee opportunities and zero
committee moments. Thus the cue-blind enforcement gate passed vacuously and the
two jobs cannot say anything about trained versus untuned weights or v1 versus
v2 extraction.

The traces show two independent opportunity losses:

- At trained-v1 turn 15, `stagnant_repeat` and `warrant_skip` co-fired, and the
  frozen detector assigned the higher-priority `stagnant_repeat` trigger.
- At trained-v1 turns 19–21, `warrant_skip` was assigned, then suppressed by
  the active handoff eligibility contract with
  `question_forbidden_by_handoff_contract`. The successful untuned-v1 retry
  also produced warrant candidates without an eligible committee moment.

Changing detector priority alone would therefore not repair the apparatus. A
replacement needs a common, retest-only warrant-opportunity protocol that also
passes the live handoff contract, plus a non-vacuous gate requiring actual
committee exposure in every required pilot cell/profile block. Global runtime
defaults must remain unchanged.

## Evidence boundary and next decision

This stopped pilot validates the certificate binding, retry/fail-closed path,
trace integrity, answer-secrecy controls, and live futility stop. It does not
validate treatment exposure, estimate a treatment effect, revive Program 2 as
an empirical claim, or license the 48-dialogue cohort.

Before any replacement external run, Amendment 1 must freeze:

1. separate public-release and learner-uptake horizons;
2. a handoff-compatible warrant-opportunity protocol shared by all four cells;
3. a minimum non-zero exposure gate that cannot pass vacuously;
4. new source, plan, local-smoke, and certificate bindings; and
5. fresh user authorization for the new external pilot.
