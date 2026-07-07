# Learner Object Outcome Report

Generated: 2026-06-18T00:49:04.120Z

## Boundary

- Post-run analysis only.
- Does not change proof control, learner behavior, release policy, or assertion gates.
- `--ownership-transfer-gate` remains experimental and off by default.

## Counts

| Outcome | Count |
| --- | ---: |
| proof_and_ownership_grounded | 2 |
| proof_grounded_ownership_partial | 1 |
| proof_failed | 0 |
| not_instrumented | 1 |
| total | 4 |

## Runs

| Ref | Verdict | Turns | Final D | Forced | Asserted | Gap | Outcome | Final ownership | Missing | Durability | Leak audit |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| world015-transferdetector-fresh-s2-ownership-r1 | grounded_anagnorisis | 21 | 0 | 20 | 21 | 1 | proof_and_ownership_grounded | transformed | none | durable_transformation | ok |
| world015-transferdetector-fresh-s2-transfer-r1 | grounded_anagnorisis | 21 | 0 | 20 | 21 | 1 | proof_and_ownership_grounded | transformed | none | durable_transformation | ok |
| world015-transfergate-detector-mock-from-t20 | grounded_anagnorisis | 20 | 0 | 20 | 20 | 0 | proof_grounded_ownership_partial | partial_ownership | near_transfer | not_transformed | ok |
| world015-transfergate-detector-replay-from-t23 | grounded_anagnorisis | 22 | 0 | 20 | 22 | 2 | not_instrumented | n/a | n/a | n/a | n/a |

## Interpretation

Use this report to separate proof reliability from learner-object ownership. A grounded proof with partial ownership is not a runtime failure by itself, but it marks a weaker pedagogical endpoint than `proof_and_ownership_grounded`.
