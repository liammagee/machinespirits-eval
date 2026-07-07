# Derivation Rubric Suite Opus CLI Max Catch-Up

Generated: 2026-06-17T21:48:23.303Z

## Coverage

- Suites scored: 5
- Transcript rows: 17
- Public rubric judgments: 85
- Judge: claude CLI alias `opus`, effort `max`
- Rubrics: tutor_v22, tutor_holistic, learner_v22, dialogue_quality, poetics
- Rubric-level errors: 0

## Arm Summary

| Arm | N | Proof pass | Mean | Tutor v2.2 | Tutor holistic | Learner v2.2 | Dialogue | Poetics | Formalism leaks |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| S2 reinvention | 4 | 4/4 | 82.88 | 83.48 | 80.33 | 85.63 | 84.65 | 80.3 | 0 |
| S2 reinvention persist | 1 | 1/1 | 81.74 | 75 | 85 | 80 | 90 | 78.7 | 0 |
| S1 static cast | 4 | 4/4 | 81.31 | 82.53 | 76.9 | 84.38 | 81.22 | 81.53 | 0 |
| S0 baseline/hidden | 6 | 4/6 | 77.14 | 80.87 | 74.18 | 74.82 | 78.73 | 77.1 | 0 |
| S1 discursive | 2 | 1/2 | 72.03 | 81.9 | 66.3 | 70.65 | 71.25 | 70.05 | 0 |

## Per Transcript

| Suite | Label | Arm | Proof | Mean | Tutor v2.2 | Tutor holistic | Learner v2.2 | Dialogue | Poetics | Leaks |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| base_hethel | cast-layer-pairwise-hethel-real-s0-no-cast-r1 | S0 baseline/hidden | pass | 71.28 | 78.8 | 57.5 | 71.3 | 77.5 | 71.3 | 0 |
| base_hethel | cast-layer-pairwise-hethel-real-s1-static-cast-r1 | S1 static cast | pass | 76.74 | 85 | 75 | 82.5 | 77.5 | 63.7 | 0 |
| base_hethel | cast-layer-pairwise-hethel-real-s2-reinvention-r1 | S2 reinvention | pass | 76.76 | 78.8 | 66.3 | 82.5 | 81.2 | 75 | 0 |
| resistant_hethel | cast-layer-pairwise-hethel-resistant-real-s0-no-cast-r1 | S0 baseline/hidden | pass | 88.76 | 88.8 | 85 | 87.5 | 90 | 92.5 | 0 |
| resistant_hethel | cast-layer-pairwise-hethel-resistant-real-s1-static-cast-r1 | S1 static cast | pass | 82.48 | 80 | 85 | 82.5 | 81.2 | 83.7 | 0 |
| resistant_hethel | cast-layer-pairwise-hethel-resistant-real-s2-reinvention-r1 | S2 reinvention | pass | 86 | 87.5 | 85 | 87.5 | 90 | 80 | 0 |
| dogmatic_hethel | cast-layer-pairwise-hethel-dogmatic-real-s0-no-cast-r1 | S0 baseline/hidden | pass | 88.5 | 87.5 | 85 | 87.5 | 90 | 92.5 | 0 |
| dogmatic_hethel | cast-layer-pairwise-hethel-dogmatic-real-s1-static-cast-r1 | S1 static cast | pass | 77.76 | 73.8 | 66.3 | 85 | 81.2 | 82.5 | 0 |
| dogmatic_hethel | cast-layer-pairwise-hethel-dogmatic-real-s2-reinvention-r1 | S2 reinvention | pass | 86.24 | 88.8 | 85 | 87.5 | 86.2 | 83.7 | 0 |
| dogmatic_hethel | cast-layer-pairwise-hethel-dogmatic-real-s2-reinvention-persist-r1 | S2 reinvention persist | pass | 81.74 | 75 | 85 | 80 | 90 | 78.7 | 0 |
| complex_resistant | cast-layer-complex-resistant-real-s0-learner-drift-r1 | S0 baseline/hidden | pass | 82.76 | 88.8 | 85 | 80 | 81.2 | 78.8 | 0 |
| complex_resistant | cast-layer-complex-resistant-real-s1-static-cast-learner-drift-r1 | S1 static cast | pass | 88.26 | 91.3 | 81.3 | 87.5 | 85 | 96.2 | 0 |
| complex_resistant | cast-layer-complex-resistant-real-s2-reinvention-learner-drift-r1 | S2 reinvention | pass | 82.5 | 78.8 | 85 | 85 | 81.2 | 82.5 | 0 |
| discursive_matrix | discursive-runtime-matrix-hethel-s0-hidden-r1 | S0 baseline/hidden | fail | 67.76 | 65 | 66.3 | 63.8 | 73.7 | 70 | 0 |
| discursive_matrix | discursive-runtime-matrix-hethel-s1-discursive-r1 | S1 discursive | pass | 73.28 | 85 | 66.3 | 75 | 73.8 | 66.3 | 0 |
| discursive_matrix | discursive-runtime-matrix-ravensmark-s0-hidden-r1 | S0 baseline/hidden | fail | 63.78 | 76.3 | 66.3 | 58.8 | 60 | 57.5 | 0 |
| discursive_matrix | discursive-runtime-matrix-ravensmark-s1-discursive-r1 | S1 discursive | fail | 70.78 | 78.8 | 66.3 | 66.3 | 68.7 | 73.8 | 0 |

## Interpretation Boundary

These rubric-suite scores are transcript-quality judgments, not proof-control validation. The proof gate remains primary. Treat arm means as reader-quality evidence only after checking proof pass/fail, release adherence, and formalism leakage.

## Source Reports

- exports/dramatic-derivation/cast-layer-paired-transcript-comparison/rubric-suite-opus-cli-max/report.md
- exports/dramatic-derivation/cast-layer-resistant-comparison/rubric-suite-opus-cli-max/report.md
- exports/dramatic-derivation/cast-layer-dogmatic-comparison/rubric-suite-opus-cli-max/report.md
- exports/dramatic-derivation/cast-layer-complex-resistant-comparison/rubric-suite-opus-cli-max/report.md
- exports/dramatic-derivation/discursive-pairwise-transcript-eval/rubric-suite-opus-cli-max/report.md
