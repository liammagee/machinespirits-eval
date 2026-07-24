# Program 2 weights × interface paid-smoke decision — HOLD

Date: 2026-07-24
Implementation SHA: `c32c5c0c89d2a419a64e6d7a0cd361b919202c1c`
Smoke root: `exports/program2-weights-interface-factorial-paid-smoke`
Status: **HOLD — do not launch the 48-dialogue cohort**

## Frozen sequence completed

The successor design was committed before implementation. The implementation
then passed the 48-job and excluded four-job zero-model gates, focused tests,
prompt/world quality checks, lint, and the read-only prelaunch provenance
audit. The separate local-only smoke passed all four treatment surfaces. The
paid smoke used one proof-skipper four-cell block and was excluded from every
endpoint.

## Paid-smoke outcome

The launcher completed with three sealed jobs and one finalized attrition:

| Cell | Terminal status | Attempts | Counted final-audit failures |
|---|---|---:|---|
| `untuned_v1` | sealed | 2 | `private_final_conclusion`; `axis_not_visible` |
| `untuned_v2` | sealed | 1 | none |
| `trained_v2` | finalized attrition | 2 | `generic_learner_uptake` / `learner_uptake_not_realized`; then `private_final_conclusion` / `axis_not_visible` |
| `trained_v1` | sealed | 2 | `duplicate_clue_delivery`; `axis_not_visible` |

The post-smoke provenance audit passed 11/11 checks. Across all attempt traces,
64/64 committee moments carried the successor enforcement ledger. There were
zero mini resamples. Composer rejection led to original-mini fallback 17
times; five further original-mini fallbacks came from `no_span`. The cue-blind
resolver never inspected the registered cue after extraction.

The failure therefore does not support blaming either mini weights or the
v1/v2 selector. It exposes an insufficiently reliable common downstream
delivery path: four counted deterministic final-audit failures across three of
the four cells, with one cell exhausting its retry. Because this was an
excluded one-block smoke, the cell distribution is diagnostic only and cannot
be interpreted as a treatment effect.

## Decision

Do not launch, judge, or analyze the 48-dialogue cohort. Do not relax an audit,
add replacement jobs, change thresholds, or tune against the smoke transcripts.
The semantic judge plumbing was dry-run successfully on the three sealed smoke
dialogues (three blinded dialogue packets, zero judge calls), but paid judging
would have no confirmatory use while the cohort is blocked.

## Required next sequence

1. Freeze a reliability-repair amendment before changing the shared delivery
   path. The target is the deterministic fallback/composer behavior, not the
   final audits.
2. Reproduce the four archived failure shapes with no-model replay fixtures and
   classify each as a true unsafe draft, a fallback-construction defect, or an
   audit/input mismatch.
3. Repair only common downstream construction where the archived public state
   proves a safe, audit-satisfying response exists. Do not change the treatment
   flags, mini prompts, v1/v2 extraction, cue-blind resolver, learner profiles,
   or judge instrument.
4. Commit the repair under a new clean SHA and rerun the same excluded
   four-cell smoke from a fresh root. Require 4/4 sealed, no attrition, 11/11
   provenance, no mini resamples, and at most one recovered retry before a new
   explicit cohort launch decision.
