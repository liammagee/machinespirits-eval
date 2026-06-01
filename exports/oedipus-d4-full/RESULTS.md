# D_OED4 (deep secret) — full three-arm result (9 repeats)

Scenario: `config/poetics-calibration/oedipus-pilot-v2.yaml` D_OED4 ("the cohort that
changed underneath them"). Generator: api / anthropic/claude-sonnet-4.6 (OpenRouter).
Three arms (none / socratic / reveal) from a byte-identical prefix; plain withhold
(no `OEDIPUS_ADVERSARIAL_CONTROL`). Omniscient panel: gpt, deepseek-v4-pro, qwen3.7-max,
gemini-3.5-flash; 3-of-4 consensus; discovery = discovered ∧ by_reasoning ∧ ¬tutor_revealed.
Gate (`scripts/qa-oedipus-arms.js`) run with the fixed judge (commit `e10e2e2`).

This file records the per-run verdicts as scored at run time (the critic is non-deterministic;
these are the actual draws behind the §7.9 claim, NOT a re-score). Source scoring tasks:
run1-3 critic = `bs79phayk`, gate (fixed) = `bglg55s23`; run4-6 = `bxzr4sn7d`; run7-9 = `bo9e5xsp7`.

| run | gate: none tutor | critic: socratic disc | critic: none disc (leak?) | verdict |
|-----|------------------|-----------------------|---------------------------|---------|
| run1 | withheld (4/4) | yes (4/4) | no | **positive** (lift 1) |
| run2 | metered/split (2w/2m) | yes (4/4) | no | **positive** (lift 1) |
| run3 | metered (3/4) | no (1/4) | **YES** | invalid_control_leak |
| run4 | withheld (4/4) | yes (3/4) | no | **positive** (lift 1) |
| run5 | withheld (4/4) | yes (4/4) | no | **positive** (lift 1) |
| run6 | metered (3/4) | no (0/4) | no | null (socratic flop) |
| run7 | withheld (3/4) | yes (4/4) | no | **positive** (lift 1) |
| run8 | withheld (4/4) | yes (4/4) | no | **positive** (lift 1) |
| run9 | metered (3/4) | yes (4/4) | no | **positive** (lift 1) |

## Aggregate

- **Socratic discovery: 7/9** (run1,2,4,5,7,8,9) — by reasoning, no bald reveal.
- **Control clean by outcome: 8/9** — `none` learner reached S unaided only in run3.
- **Failures:** 1 control-leak (run3), 1 socratic flop (run6).
- **discovery_lift = 1.0** on every valid pair (Wilson95 [0.21, 1.0] per pair).

## Honest texture (also in §7.9)

- Clean by **outcome**, not pristine by **intent**: the strict gate flags the `none` *tutor*
  still edging toward the records in 4/9 runs (run2,3,6,9), but only run3's learner actually
  reached S. The control is clean where it counts (learner outcome), leaky-by-tendency on
  tutor behaviour.
- The gate carries a robust judge bias — a tutor that only asks *leading questions* is read as
  "withholding," not "metering," no matter the prompt wording (the socratic arm reads
  `withheld` even when the transcript walks the full chain). So the gate's socratic/reveal
  labels are unreliable; the lift rests on the learner-**outcome** critic, not the gate.
- D_OED4 **fails** the static depth/underivability screen at rank-1 (the cohort-drift category
  is the obvious diagnosis-by-elimination). Run anyway on the argument that the static screen's
  prober is a free investigator while the `none` learner is a committed persona; vindicated
  empirically by the 8/9 clean-by-outcome control.
- Pilot: 9 runs, one scenario, one backend. Dramatic *form*, not learning (§6.10 bound).

## Pre-check (none-only, deep secret, before the full run)

`exports/oedipus-d4-none/run{1,2,3}`: tutor withheld 3/3 (gate), learner did not reach S 3/3
(critic) — the first clean-by-outcome control, which motivated the full three-arm run here.
