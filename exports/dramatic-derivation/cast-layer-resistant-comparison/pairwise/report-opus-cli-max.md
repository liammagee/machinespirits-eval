# Cast Layer Paired Transcript Comparison

Packet: `exports/dramatic-derivation/cast-layer-resistant-comparison/pairwise`
Scores: `exports/dramatic-derivation/cast-layer-resistant-comparison/pairwise/scores-opus-cli-max.json`
Judge: `claude/opus/max`

## Pair Results

| Pair | A | B | Preferred | Strength | A mean | B mean | Formalism leak |
| --- | --- | --- | --- | --- | ---: | ---: | --- |
| s0_vs_s1 | S1 static cast | S0 no cast | S0 no cast | slight | 4.17 | 4.33 | A:false B:false |
| s0_vs_s2 | S0 no cast | S2 cast + reinvention | S0 no cast | slight | 4.67 | 4.33 | A:false B:false |
| s1_vs_s2 | S2 cast + reinvention | S1 static cast | S1 static cast | moderate | 3.83 | 4.33 | A:true B:false |

## Arm Summary

| Arm | Appearances | Wins | Losses | No preference | Mean score |
| --- | ---: | ---: | ---: | ---: | ---: |
| S1 static cast | 2 | 1 | 1 | 0 | 4.25 |
| S0 no cast | 2 | 2 | 0 | 0 | 4.50 |
| S2 cast + reinvention | 2 | 0 | 2 | 0 | 4.08 |

## Interpretation Boundary

This is a blinded transcript-quality comparison, not a proof-control validation. Mechanism evidence still requires proof reliability plus improved uptake, turn count, or impasse prevention without negative transfer.

