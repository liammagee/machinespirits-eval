# Cast Layer Paired Transcript Comparison

Packet: `exports/dramatic-derivation/cast-layer-paired-transcript-comparison/pairwise`
Scores: `exports/dramatic-derivation/cast-layer-paired-transcript-comparison/pairwise/scores-opus-cli-max.json`
Judge: `claude/opus/max`

## Pair Results

| Pair | A | B | Preferred | Strength | A mean | B mean | Formalism leak |
| --- | --- | --- | --- | --- | ---: | ---: | --- |
| s0_vs_s1 | S1 static cast | S0 no cast | S1 static cast | moderate | 4.17 | 3.67 | A:false B:true |
| s0_vs_s2 | S0 no cast | S2 cast + reinvention | S2 cast + reinvention | moderate | 3.67 | 4.33 | A:true B:false |
| s1_vs_s2 | S2 cast + reinvention | S1 static cast | S1 static cast | moderate | 3.50 | 4.00 | A:false B:false |

## Arm Summary

| Arm | Appearances | Wins | Losses | No preference | Mean score |
| --- | ---: | ---: | ---: | ---: | ---: |
| S1 static cast | 2 | 2 | 0 | 0 | 4.08 |
| S0 no cast | 2 | 0 | 2 | 0 | 3.67 |
| S2 cast + reinvention | 2 | 1 | 1 | 0 | 3.92 |

## Interpretation Boundary

This is a blinded transcript-quality comparison, not a proof-control validation. Mechanism evidence still requires proof reliability plus improved uptake, turn count, or impasse prevention without negative transfer.

