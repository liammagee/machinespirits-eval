# A19 v0.7 Public-Commitment Contradiction Screen

Status: distinct local result; no A19 transfer claim.

## Boundary

- This is bounded counterfactual replay with simulated tutor-as-learner, not
  human learning, deployed adaptation, or model-weight learning.
- The sidecar/atlas claim boundary still holds: no new claim lands in a
  sidecar or atlas module until canonical `docs/research/paper-full-2.0.md`
  prose licenses it.
- The decisive unit remains card-level S0/S1 evidence, not a family-level pooled
  rate.

## Attempt-1 Gate

`public_commitment_contradiction` passed the real attempt-1 gate:

- Report:
  `notes/adaptive_2_0/2026-06-07-a19-attempt1-real-gate-report-public-commitment.md`
- Replay bundle:
  `exports/a19/real-attempt1-v07/public-commitment-contradiction/`
- Result: `survivor = 1/1`
- Old warrant: `0.8`
- Resistance diagnosis: `0.9`
- Strategy revision accountability: `0.9`
- Recursive dyadic update: `0.9`
- Non-leakage: `1.0`

This licensed held-out S0/S1 contrast only, not a transfer claim.

## Held-Out Screen

| sibling | S0 result | S1 result | card verdict | interpretation |
| --- | --- | --- | --- | --- |
| `public_commitment_contradiction_a` | `neither` / `transfer_control` | `target` / `commitment_ledger_repair` | `policy_headroom` | Positive local contrast, but S1 target-obligation audit flags `target_granularity_risk` because transfer-control signal remains in the transcript. |
| `public_commitment_contradiction_b` | `target` / `commitment_ledger_repair` | not run | `ceiling` | Recursive-full S0 already performs the target repair. |
| `public_commitment_contradiction_c` | `target` / `commitment_ledger_repair` in paired adjudication | `target` / `commitment_ledger_repair` | `ceiling` | Recursive-full S0 reaches the target under paired extraction, despite an earlier single-arm extraction reading it as instructional-contract repair. |

## Artifacts

- Axiom:
  `exports/a19/axioms/public-commitment-contradiction/axiom.json`
- S0/S1 root:
  `exports/a19/real-s0s1-v07/public-commitment-contradiction/`
- A paired adjudication:
  `exports/a19/real-s0s1-v07/public-commitment-contradiction/public-commitment-contradiction-a/blind-adjudication.free-text.json`
- C paired adjudication:
  `exports/a19/real-s0s1-v07/public-commitment-contradiction/public-commitment-contradiction-c/blind-adjudication.free-text.json`
- Ambiguous A adjudication packet:
  `exports/a19/adjudication-packets/public-commitment-contradiction-a.packet.json`

## Result

v0.7 is useful but not sufficient. It produces one local policy-headroom card,
yet that card is not clean enough for stability escalation because the target
audit still flags granularity risk. The other two held-out siblings are
recursive-full S0 ceilings. The repair-family loop should therefore treat
`commitment_ledger_repair` as a partial diagnostic result rather than an A19
general framework result.

Next legitimate loop move: either run an adjudication-infrastructure pass on the
ambiguous A packet when independent coders are available, or preregister a fresh
repair family whose public obligation is less likely to be satisfied by
recursive-full S0.
