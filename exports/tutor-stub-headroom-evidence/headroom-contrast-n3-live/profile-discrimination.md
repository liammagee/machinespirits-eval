# Tutor Stub Profile Discrimination

Generated: 2026-07-10T11:14:53.817Z

## Summary

- Compacted traces: 60
- Profiles: 4
- Turns: 1820
- Pooled average pairwise cosine: 0.836
- Pooled max pairwise cosine: 0.963
- Pooled max similarity to diligent: 0.963
- Matched-policy macro average cosine: 0.783
- Matched-policy max similarity to control: 0.979
- Primary gate: fail (contract_conditioned)
- Pooled diagnostic: fail (average <= 0.85; max-to-control <= 0.9)

## Profiles

| Profile | Traces | Turns | Final coverage | Missing | Conceptual | Epistemic | Signature targets | Failure rate | Failure observed by deadline | Top evidence | Top stance | Top agency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| affective_resistant | 15 | 484 | 0.956 | 0.267 | 3.502 | 4.029 | 0.722 | 0.538 | 3/3 | none 135, omits_warrant 119 | grounded 311, reflective 81 | attempting 220, steering 193 |
| diligent | 15 | 403 | 1 | 0 | 3.902 | 4.178 | 0.571 | n/a | n/a | links_evidence_to_rule 116, omits_warrant 106 | grounded 341, exploratory 38 | attempting 224, steering 131 |
| false_memory | 15 | 471 | 1 | 0 | 3.111 | 2.904 | 0.588 | 0.58 | 11/15 | distorts_public_evidence 273, overleaps_evidence 65 | overconfident 147, confused 124 | attempting 356, self_correcting 97 |
| proof_skipper | 15 | 462 | 0.944 | 0.333 | 3.164 | 3.454 | 0.688 | 0.628 | 13/15 | omits_warrant 211, overleaps_evidence 66 | grounded 268, exploratory 96 | attempting 307, complying 81 |

## Contract-Conditioned Gates

| Profile | Probe policies | Max cosine to control | Target | Signature pass rate | Failure recurrence | Result |
| --- | --- | ---: | ---: | ---: | --- | --- |
| affective_resistant | negative | 0.651 | <= 0.88 | 0.722 | 0.538 (target 0.5) | pass |
| false_memory | bland, dynamic, dynamical_system, field, negative | 0.782 | <= 0.9 | 0.588 | 0.58 (target 0.5) | fail |
| proof_skipper | bland, dynamic, dynamical_system, field, negative | 0.931 | <= 0.9 | 0.688 | 0.628 (target 0.45) | fail |

## Matched Policy Diagnostics

| Policy | Profiles | Average cosine | Max to control |
| --- | ---: | ---: | ---: |
| bland | 4 | 0.706 | 0.707 |
| dynamic | 4 | 0.841 | 0.979 |
| dynamical_system | 4 | 0.87 | 0.977 |
| field | 4 | 0.866 | 0.963 |
| negative | 4 | 0.633 | 0.823 |

## Closest Pairs

| Pair | Cosine |
| --- | ---: |
| affective_resistant vs diligent | 0.963 |
| affective_resistant vs proof_skipper | 0.884 |
| diligent vs proof_skipper | 0.878 |
| false_memory vs proof_skipper | 0.873 |
| affective_resistant vs false_memory | 0.713 |
| diligent vs false_memory | 0.704 |

## Most Separated Pairs

| Pair | Cosine |
| --- | ---: |
| diligent vs false_memory | 0.704 |
| affective_resistant vs false_memory | 0.713 |
| false_memory vs proof_skipper | 0.873 |
| diligent vs proof_skipper | 0.878 |
| affective_resistant vs proof_skipper | 0.884 |
| affective_resistant vs diligent | 0.963 |

