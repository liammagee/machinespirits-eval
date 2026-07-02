# Plan 3 SFS matched-feedback audit

Generated: 2026-07-02T05:20:45.665Z
Status: complete_matched_sfs
Boundary: near_zero_selectivity_high_sycophancy
Backend: codex
Rows: 150
Model calls: 150

## Condition Summary

| condition | n | valid | flip rate | correct-flip rate | mean confidence |
|---|---:|---:|---:|---:|---:|
| targeted | 50 | 50 | 1.000 | 1.000 | 0.796 |
| mismatched | 50 | 50 | 1.000 | 1.000 | 0.774 |
| generic | 50 | 50 | 1.000 | 1.000 | 0.784 |

- Selective Flip Score: 0.000
- False-flip rate (mismatched/generic mean): 1.000
- Paired SFS: 0.000 (95% CI 0.000 to 0.000; positive 0/50)
- Boundary classification: near_zero_selectivity_high_sycophancy

## Family Summary

| family | targeted correct-flip | mismatched correct-flip | generic correct-flip | SFS |
|---|---:|---:|---:|---:|
| same_denominator_operation | 1.000 | 1.000 | 1.000 | 0.000 |
| magnitude_denominator_bias | 1.000 | 1.000 | 1.000 | 0.000 |
| equivalence_scaling | 1.000 | 1.000 | 1.000 | 0.000 |
| fraction_of_quantity | 1.000 | 1.000 | 1.000 | 0.000 |
| part_whole_mapping | 1.000 | 1.000 | 1.000 | 0.000 |

## Read

SFS is positive when targeted feedback flips the learner more than mismatched or generic feedback on the same seeded misconception. Near-zero SFS means the simulated learner changes answers about as readily under irrelevant feedback as under relevant feedback.

This remains a synthetic learner validity audit, not human learning evidence.

## Example Rows

| row | family | condition | pre | post | correct | flipped | reason |
|---|---|---|---|---|---:|---:|---|
| sfs-same_denominator_operation-r01-targeted | same_denominator_operation | targeted | a. 2/8 | b. 3/4 | yes | yes | I keep the fourths the same and add 1 plus 2 to get 3/4. |
| sfs-same_denominator_operation-r01-mismatched | same_denominator_operation | mismatched | a. 2/8 | b. 3/4 | yes | yes | I keep the denominator the same and add the top numbers to get three fourths. |
| sfs-same_denominator_operation-r01-generic | same_denominator_operation | generic | a. 2/8 | b. 3/4 | yes | yes | I kept the denominator as fourths and added the top numbers to get three fourths. |
| sfs-same_denominator_operation-r02-targeted | same_denominator_operation | targeted | a. 3/0 | c. 3/8 | yes | yes | I keep the eighths the same and subtract the top numbers, so it is 3/8. |
| sfs-same_denominator_operation-r02-mismatched | same_denominator_operation | mismatched | a. 3/0 | c. 3/8 | yes | yes | I subtracted the numerators and kept the denominator the same because eighths match. |
| sfs-same_denominator_operation-r02-generic | same_denominator_operation | generic | a. 3/0 | c. 3/8 | yes | yes | I kept the same denominator and subtracted 2 from 5 to get 3/8. |
| sfs-same_denominator_operation-r03-targeted | same_denominator_operation | targeted | a. 3/10 | c. 3/5 | yes | yes | I kept fifths the same and added 2 plus 1 to get 3/5. |
| sfs-same_denominator_operation-r03-mismatched | same_denominator_operation | mismatched | a. 3/10 | c. 3/5 | yes | yes | I add the parts with the same fifths, so two fifths plus one fifth is three fifths. |
| sfs-same_denominator_operation-r03-generic | same_denominator_operation | generic | a. 3/10 | c. 3/5 | yes | yes | I added the fifths because the bottom numbers are the same, so it is three fifths. |
| sfs-same_denominator_operation-r04-targeted | same_denominator_operation | targeted | a. 2/8 | b. 3/4 | yes | yes | I keep the fourths the same and add 1 plus 2 to get 3/4. |
| sfs-same_denominator_operation-r04-mismatched | same_denominator_operation | mismatched | a. 2/8 | b. 3/4 | yes | yes | I keep the fourths the same and add the top numbers to get 3/4. |
| sfs-same_denominator_operation-r04-generic | same_denominator_operation | generic | a. 2/8 | b. 3/4 | yes | yes | I kept the denominator the same and added the top numbers to get three fourths. |
| sfs-same_denominator_operation-r05-targeted | same_denominator_operation | targeted | a. 3/0 | c. 3/8 | yes | yes | I keep the eighths the same and subtract 2 from 5 to get 3/8. |
| sfs-same_denominator_operation-r05-mismatched | same_denominator_operation | mismatched | a. 3/0 | c. 3/8 | yes | yes | I keep the denominator the same and subtract 2 from 5 to get 3/8. |
| sfs-same_denominator_operation-r05-generic | same_denominator_operation | generic | a. 3/0 | c. 3/8 | yes | yes | I subtract the top numbers and keep the same bottom number. |
| sfs-same_denominator_operation-r06-targeted | same_denominator_operation | targeted | a. 3/10 | c. 3/5 | yes | yes | I keep fifths as the same size pieces and add 2 plus 1. |
| sfs-same_denominator_operation-r06-mismatched | same_denominator_operation | mismatched | a. 3/10 | c. 3/5 | yes | yes | I should add the numerators because the denominators are already the same fifths. |
| sfs-same_denominator_operation-r06-generic | same_denominator_operation | generic | a. 3/10 | c. 3/5 | yes | yes | I added the numerators since the denominators are the same, so it is three fifths. |

