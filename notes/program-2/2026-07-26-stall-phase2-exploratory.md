# Program-2 stall Phase 2 exploratory attempt

Status: `NO_GO_SOURCE_CORPUS`.

This attempt was explicitly run below the frozen 100-example corpus floor after
PR #256 merged. It measures whether Phase 2 can be made operational, but it
does not override the failed gate or license training.

## Dataset result

The 101 raw `stagnant_repeat` moments contain 49 strict historical audit
passes. Applying the existing Program-2 SFT rule—an accepted original tutor
draft, the original-role request, and a leak-clean target—leaves only seven
source examples. The frozen dialogue split places six in train, none in dev,
and one in held-out. This is not a viable fine-tuning dataset.

The attempt also exposes the audit boundary. Fifty moments have a due premise,
so a fresh candidate can be scored deterministically by checking that it
delivers the premise, passes the response guards, and asks exactly one
question. The other 51 require deciding whether prose really enacted a new
action family; that semantic label is not observable from text by the frozen
deterministic machinery and was not invented after the fact.

## Local descriptive floor

The same-lineage untuned instruct q8 and the existing warrant specialist were
run locally on the four dev and five held-out text-auditable moments, with
greedy and sampled decoding. There were no endpoint errors.

| Model | Greedy dev | Greedy held-out | Sampled dev | Sampled held-out |
| --- | ---: | ---: | ---: | ---: |
| Untuned instruct | 2/4 | 0/5 | 1/4 | 2/5 |
| Warrant specialist | 2/4 | 1/5 | 0/4 | 2/5 |

All candidates delivered the due premise. Failures were driven by the response
guards, with occasional one-question failures from the warrant specialist.
The cells are too small and mixed to support a cross-move effect claim.

## Decision

Phase 3 does not open. The immediate constraint is now stronger than the raw
49/100 floor: the accepted-original SFT corpus has six train examples and no
development examples. Future sealed runs may grow both counts, and the same
extractor can be rerun. Replacing the accepted-original rule with repaired
deliveries, or adding a semantic judge for no-due reanchors, would be a new
research design rather than continuation of this frozen one.

The generated artifacts are preserved under
`~/.machinespirits-data/program-2/datasets/stall-phase2-exploratory-v1/`.
Tracked hashes and serving pins are in
`config/adaptive-tutor-evidence/program-2-stall-phase2-exploratory.manifest.json`.
