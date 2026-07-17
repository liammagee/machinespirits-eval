# Tutor Stub Profile Discrimination

Generated: 2026-07-10T22:19:08.702Z

## Summary

- Compacted traces: 60
- Profiles: 4
- Turns: 2111
- Observed tutor models: claude-code.claude-sonnet-5 (60)
- Observed analysis models: claude-code.claude-sonnet-5 (60)
- Observed learner models: claude-code.claude-sonnet-5 (60)
- Pooled average pairwise cosine: 0.565
- Pooled max pairwise cosine: 0.867
- Pooled max similarity to diligent: 0.619
- Matched-policy macro average cosine: 0.551
- Matched-policy max similarity to control: 0.66
- Primary gate: fail (contract_conditioned)
- Pooled diagnostic: pass (average <= 0.85; max-to-control <= 0.9)

## Profiles

| Profile | Traces | Turns | Final coverage | Missing | Conceptual | Epistemic | Signature targets | Failure rate | Failure observed by deadline | Top evidence | Top stance | Top agency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| affective_resistant | 15 | 600 | 0.433 | 3.4 | 2.56 | 3.022 | 0.667 | 0.624 | 3/3 | none 409, cites_public_evidence 57 | resistant 411, exploratory 96 | steering 408, self_correcting 82 |
| diligent | 15 | 484 | 0.9 | 0.6 | 3.885 | 4.181 | 0.357 | n/a | n/a | links_evidence_to_rule 158, none 157 | grounded 228, exploratory 226 | self_correcting 234, steering 131 |
| false_memory | 15 | 526 | 0.789 | 1.267 | 2.832 | 2.779 | 0.588 | 0.593 | 15/15 | distorts_public_evidence 300, none 52 | overconfident 239, self_correcting 86 | self_correcting 220, attempting 206 |
| proof_skipper | 15 | 501 | 0.722 | 1.667 | 2.774 | 2.441 | 0.563 | 0.597 | 14/15 | overleaps_evidence 242, distorts_public_evidence 99 | overconfident 303, exploratory 71 | attempting 270, self_correcting 90 |

## Contract-Conditioned Gates

| Profile | Probe policies | Max cosine to control | Target | Signature pass rate | Failure recurrence | Result |
| --- | --- | ---: | ---: | ---: | --- | --- |
| affective_resistant | negative | 0.474 | <= 0.88 | 0.667 | 0.624 (target 0.5) | pass |
| false_memory | bland, dynamic, dynamical_system, field, negative | 0.646 | <= 0.9 | 0.588 | 0.593 (target 0.5) | pass |
| proof_skipper | bland, dynamic, dynamical_system, field, negative | 0.579 | <= 0.9 | 0.563 | 0.597 (target 0.6) | fail |

## Matched Policy Diagnostics

| Policy | Profiles | Average cosine | Max to control |
| --- | ---: | ---: | ---: |
| bland | 4 | 0.54 | 0.609 |
| dynamic | 4 | 0.521 | 0.599 |
| dynamical_system | 4 | 0.55 | 0.629 |
| field | 4 | 0.594 | 0.66 |
| negative | 4 | 0.552 | 0.646 |

## Closest Pairs

| Pair | Cosine |
| --- | ---: |
| false_memory vs proof_skipper | 0.867 |
| diligent vs false_memory | 0.619 |
| affective_resistant vs diligent | 0.538 |
| diligent vs proof_skipper | 0.529 |
| affective_resistant vs false_memory | 0.449 |
| affective_resistant vs proof_skipper | 0.386 |

## Most Separated Pairs

| Pair | Cosine |
| --- | ---: |
| affective_resistant vs proof_skipper | 0.386 |
| affective_resistant vs false_memory | 0.449 |
| diligent vs proof_skipper | 0.529 |
| affective_resistant vs diligent | 0.538 |
| diligent vs false_memory | 0.619 |
| false_memory vs proof_skipper | 0.867 |

