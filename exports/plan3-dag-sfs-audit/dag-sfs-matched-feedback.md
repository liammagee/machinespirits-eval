# Plan 3 DAG-SFS proof-grounded audit

Generated: 2026-07-02T05:57:12.896Z
Status: complete_dag_sfs
Boundary: proof_selective_harness_signal
Backend: codex
Rows: 120
Model calls: 120

## Condition Summary

| condition | n | valid | proof-grounded | correctly withheld | unsupported conclusion | target-edge used | mean confidence |
|---|---:|---:|---:|---:|---:|---:|---:|
| targeted | 30 | 30 | 1.000 | 0.000 | 0.000 | 1.000 | 1.000 |
| mismatched | 30 | 30 | 0.000 | 1.000 | 0.000 | 0.000 | 0.932 |
| generic | 30 | 30 | 0.000 | 1.000 | 0.000 | 0.000 | 0.997 |
| nonsense | 30 | 30 | 0.000 | 1.000 | 0.000 | 0.000 | 0.933 |

- DAG-SFS selective proof score: 1.000
- False-grounded rate (negative-condition mean): 0.000
- Paired DAG-SFS: 1.000 (95% CI 1.000 to 1.000; positive 30/30)
- Boundary classification: proof_selective_harness_signal

## Case Summary

| case | targeted proof-grounded | negative false-grounded | DAG-SFS |
|---|---:|---:|---:|
| gate_aven_stamp_noro | 1.000 | 0.000 | 1.000 |
| archive_luma_seal_vecc | 1.000 | 0.000 | 1.000 |
| garden_siva_key_renn | 1.000 | 0.000 | 1.000 |
| lab_nemi_phase_tor | 1.000 | 0.000 | 1.000 |
| route_orra_badge_senn | 1.000 | 0.000 | 1.000 |
| clinic_pavo_clearance_mek | 1.000 | 0.000 | 1.000 |

## Read

DAG-SFS is positive when targeted feedback releases the withheld proof edge and produces proof-grounded recovery more often than wrong-edge, generic, or nonsense feedback. Rows count only when the learner cites the exact target edge ID, so final-answer guessing is not enough.

This remains a synthetic learner harness audit, not human learning evidence.

## Example Rows

| row | case | condition | status | proof-grounded | used edges | claim |
|---|---|---|---|---:|---|---|
| dag-sfs-gate_aven_stamp_noro-r01-targeted | gate_aven_stamp_noro | targeted | proved | yes | E1, E2, E3, T1 | mira may pass gate aven. |
| dag-sfs-gate_aven_stamp_noro-r01-mismatched | gate_aven_stamp_noro | mismatched | still_missing | no | E1, E2 | mira may pass gate aven is still not proved because no public edge establishes mira has stamp noro. |
| dag-sfs-gate_aven_stamp_noro-r01-generic | gate_aven_stamp_noro | generic | still_missing | no | E1, E2 | The public ledger supports that mira has bridge fenn, but it still does not prove mira may pass gate aven. |
| dag-sfs-gate_aven_stamp_noro-r01-nonsense | gate_aven_stamp_noro | nonsense | still_missing | no | E1, E2 | mira may pass gate aven is still not proved because no public edge establishes mira has stamp noro. |
| dag-sfs-gate_aven_stamp_noro-r02-targeted | gate_aven_stamp_noro | targeted | proved | yes | E1, E2, T1, E3 | mira may pass gate aven. |
| dag-sfs-gate_aven_stamp_noro-r02-mismatched | gate_aven_stamp_noro | mismatched | still_missing | no | E1, E2 | The public ledger still does not prove that mira may pass gate aven. |
| dag-sfs-gate_aven_stamp_noro-r02-generic | gate_aven_stamp_noro | generic | still_missing | no | E1, E2 | The public ledger supports that mira has bridge fenn, but it still does not support that mira may pass gate aven. |
| dag-sfs-gate_aven_stamp_noro-r02-nonsense | gate_aven_stamp_noro | nonsense | still_missing | no | E1, E2 | mira may pass gate aven is not proved because no public edge establishes that mira has stamp noro. |
| dag-sfs-gate_aven_stamp_noro-r03-targeted | gate_aven_stamp_noro | targeted | proved | yes | E1, E2, T1, E3 | mira may pass gate aven. |
| dag-sfs-gate_aven_stamp_noro-r03-mismatched | gate_aven_stamp_noro | mismatched | still_missing | no | E1, E2 | mira may pass gate aven is still not proved because no public edge establishes mira has stamp noro. |
| dag-sfs-gate_aven_stamp_noro-r03-generic | gate_aven_stamp_noro | generic | still_missing | no | E1, E2 | The public ledger supports that mira has bridge fenn, but it still does not support that mira may pass gate aven. |
| dag-sfs-gate_aven_stamp_noro-r03-nonsense | gate_aven_stamp_noro | nonsense | still_missing | no | E1, E2 | mira may pass gate aven is still not proved because no public edge establishes mira has stamp noro. |
| dag-sfs-gate_aven_stamp_noro-r04-targeted | gate_aven_stamp_noro | targeted | proved | yes | E1, E2, T1, E3 | mira may pass gate aven. |
| dag-sfs-gate_aven_stamp_noro-r04-mismatched | gate_aven_stamp_noro | mismatched | still_missing | no | E1, E2 | mira may pass gate aven is still not proved because the public ledger does not establish that mira has stamp noro. |
| dag-sfs-gate_aven_stamp_noro-r04-generic | gate_aven_stamp_noro | generic | still_missing | no | E1, E2 | The public ledger supports that mira has bridge fenn, but it still does not prove that mira may pass gate aven. |
| dag-sfs-gate_aven_stamp_noro-r04-nonsense | gate_aven_stamp_noro | nonsense | still_missing | no | E1, E2 | mira may pass gate aven is still not proved because no public edge establishes that mira has stamp noro. |
| dag-sfs-gate_aven_stamp_noro-r05-targeted | gate_aven_stamp_noro | targeted | proved | yes | E1, E2, T1, E3 | mira may pass gate aven. |
| dag-sfs-gate_aven_stamp_noro-r05-mismatched | gate_aven_stamp_noro | mismatched | still_missing | no | E1, E2 | The public ledger still does not establish that mira may pass gate aven. |
| dag-sfs-gate_aven_stamp_noro-r05-generic | gate_aven_stamp_noro | generic | still_missing | no | E1, E2 | The public ledger supports that mira has bridge fenn, but it still does not prove that mira may pass gate aven. |
| dag-sfs-gate_aven_stamp_noro-r05-nonsense | gate_aven_stamp_noro | nonsense | still_missing | no | E1, E2 | mira may pass gate aven is still not proved because no public edge establishes mira has stamp noro. |
| dag-sfs-archive_luma_seal_vecc-r01-targeted | archive_luma_seal_vecc | targeted | proved | yes | E1, E2, T1 | luma belongs in shelf vecc. |
| dag-sfs-archive_luma_seal_vecc-r01-mismatched | archive_luma_seal_vecc | mismatched | still_missing | no | E1, E2, E3, M1 | The public ledger still does not prove that luma belongs in shelf vecc. |
| dag-sfs-archive_luma_seal_vecc-r01-generic | archive_luma_seal_vecc | generic | still_missing | no | E1, E2, E3 | The public ledger still does not prove that luma belongs in shelf vecc. |
| dag-sfs-archive_luma_seal_vecc-r01-nonsense | archive_luma_seal_vecc | nonsense | still_missing | no | E1, E2, E3 | The target cannot be proved because no public edge establishes that luma has seal vecc. |
