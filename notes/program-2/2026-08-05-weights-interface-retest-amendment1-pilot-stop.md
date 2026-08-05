# Program 2 weights x interface retest - Amendment 1 pilot stop

Date: 2026-08-05

Status: stopped by the preregistered live futility gate; incomplete and
under-informative; no treatment estimate

## Frozen launch

The user authorized only the certified eight-job Amendment 1 excluded pilot,
including the named Claude Code Sonnet 5 and Codex GPT-5.6 Terra destinations
and the synthetic private payload scope. The 48-dialogue cohort remained
unauthorized throughout.

- source commit: `aede8d3516e5f7d7e564fc702bf5c19e7f7beb86`
- plan: `exports/program2-weights-interface-retest-pilot-a1/launch-plan.json`
- certificate: `exports/program2-weights-interface-retest-pilot-a1/launch-certificate.json`
- launch state: `exports/program2-weights-interface-retest-pilot-a1/launch-state.json`
- zero-model analysis:
  `exports/program2-weights-interface-retest-pilot-a1/partial-analysis.json`

Both local committee models passed preflight. Two jobs sealed on their first
attempt, six were never launched, and no row was marked attrition. The launcher
stopped at `2026-08-05T03:49:49.279Z` immediately after the second sealed row.

## Sealed evidence

| condition | scheduled opportunities | public compliance | coverage at turn 23 | hard safety | eventual closure |
|---|---:|---:|---:|---|---|
| `untuned_v1` | 1 | 0/1 | 1.000 | pass, zero leaks | turn 25 |
| `trained_v1` | 1 | 0/1 | 0.667 | pass, zero leaks | turn 25 |

Each scheduled turn produced one committee moment at turn 15. In both rows the
mini output contained a cue, v1 selected it, the composer accepted it, and the
cue-blind enforcement ledger recorded no fallback. The later public-response
pipeline nevertheless made both opportunities noncompliant:

- `untuned_v1` retained one question, released no premise, and passed the
  guards, but the final public question did not satisfy the frozen warrant-cue
  recognizer;
- `trained_v1` retained one recognized warrant question and released no
  premise, but the accepted composition did not survive the response guards;
  the final turn used deterministic fallback after a repetition finding.

The Amendment therefore fixed the vacuous-opportunity fault but did not produce
a compliant public treatment in either sealed row.

The frozen futility failure came from the trained row's primary horizon. Its
last premise, `p_holder`, entered the tutor response at turn 23. The learner
integrated it at turn 24 and reached grounded closure at turn 25. Its fixed
turn-23 uptake remained `4/6 = 0.667`, below the registered `0.800` floor.
Later success cannot rescue a failed fixed-horizon gate.

## Decision boundary

The pilot has no complete four-condition block and cannot estimate trained
minus untuned weights, v1 versus v2 interface, or their interaction. The two
rows must not be pooled with either earlier stopped pilot, resumed, or promoted
to a treatment reading. The confirmatory cohort is prohibited.

This closes the weights-by-interface retest as a killed endpoint: two
prospective pilots have now failed their apparatus gates before a treatment
estimate was licensed. Any further Program 2 attempt would be a new experiment
with a new card, preregistration, source, seeds, certificate, and authorization;
it is not Amendment 2 to this run.
