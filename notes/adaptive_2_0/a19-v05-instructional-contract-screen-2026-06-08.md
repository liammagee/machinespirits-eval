# A19 v0.5 Instructional-Contract Screen

Date: 2026-06-08.
Status: local deterministic/CLI-gated A19 loop resolution; no new empirical
transfer claim.

## Boundary

This note records simulated teacher-as-learner replay artifacts only. It does
not claim human learning, deployed adaptive tutoring, model-weight learning, a
main-harness effect, paid panel evidence, a pooled A19 rate, or a sidecar claim
independent of Paper 2.0.

The canonical A18 evidence boundary remains `docs/research/paper-full-2.0.md`
section 7.9: bounded simulated counterfactual replay, currently 10/14 held-out
siblings across seven frozen-protocol-admitted families. A19 remains a
framework/protocol extension over that evidence, not a new source of empirical
claims unless canonical paper prose is updated first.

## Protocol Change

Protocol v0.5 added `instructional_contract_repair` as a non-transfer repair
type for cases where the learner challenges the tutor-learner working agreement
rather than the object-level task. A target repair must publicly:

- acknowledge the tutor's contribution to the contract drift;
- pause the object-level content gate;
- offer the learner a choice of repair path before resuming content work.

The key distinction from `transfer_control` is the public learner action: the
learner chooses how the interaction should be repaired before content work
resumes, rather than applying a revised academic rule or check to prove closure.

## Attempt-1 And Axiom

- Family: `instructional_contract_drift`.
- Repair type: `instructional_contract_repair`.
- S0 stratum: `recursive_full_no_policy_memory`.
- Attempt-1 report:
  `notes/adaptive_2_0/2026-06-07-a19-attempt1-real-gate-report-instructional-contract.md`.
- Admitted axiom:
  `exports/a19/axioms/instructional-contract-drift/axiom.json`.
- Axiom id:
  `a19_instructional_contract_drift_renegotiate_working_agreement_before_content_001`.

The first attempt-1 materialization failed the recursive gate after producing a
generic content test. The tightened attempt-1 seed removed any current draft
sentence and foregrounded the learner's complaint about the tutor shifting the
interaction rule. That retry survived the local gate and admitted exactly one
bounded axiom.

## Held-Out Results

| sibling | local result | stability result | interpretation |
| --- | --- | --- | --- |
| `instructional_contract_drift_a` | S0=`target`; stopped before S1 | not run | ceiling / S0 self-solve |
| `instructional_contract_drift_b` | S0=`neither`; S1=`target`; `policy_headroom` | 2/2 headroom | stable local candidate |
| `instructional_contract_drift_c` | S0=`neither`; S1=`target`; `policy_headroom` | 1/2 headroom; S0 target 1/2 | mixed unstable |
| `instructional_contract_drift_d` | S0=`neither`; S1=`target`; `policy_headroom` | 1/2 headroom; S1 target 1/2 | mixed unstable |

Primary stability artifacts:

- `exports/a19/stability/instructional-contract-drift-v05/a19-stability-summary.md`
- `exports/a19/stability/instructional-contract-drift-c-v05/a19-stability-summary.md`
- `exports/a19/stability/instructional-contract-drift-d-v05/a19-stability-summary.md`

The `b` stability screen is the strongest local v0.5 result: S0 stayed
non-target on both seeds and S1 reached `instructional_contract_repair` on both
seeds. The later siblings did not reproduce this cleanly. `c` mixed because one
S0 replicate self-solved the instructional-contract repair. `d` mixed because
one S1 replicate collapsed back to `transfer_control`.

## Resolution

The v0.5 instructional-contract branch improves on the earlier diagnostic and
preserve-struggle branches by producing one stable local headroom card under
recursive-full S0. It still does not satisfy the two-held-out-card stability
threshold needed for paid-panel, Paper 2.0, atlas, or sidecar escalation.

The unattended A19 loop therefore resolves as a protocol/evaluation result, not
as a new empirical claim: the framework can now express a theoretically distinct
non-transfer repair type and detect one stable local example, but the family is
not stable enough to project beyond local simulated replay. Further work should
not add opportunistic near-neighbor cards as claims evidence. The next lawful
unit is either a freshly preregistered repair family with obligations that are
not near `transfer_control`, or a higher-reliability adjudication path after a
future family reaches at least two stable held-out cards.

## Claims Not Licensed

- human learning;
- deployed adaptive tutor behavior;
- model-weight learning;
- main-harness rate effect;
- pooled A19 transfer rate;
- paid blind panel result;
- human expert double-coding result;
- sidecar or atlas empirical claim not already present in Paper 2.0.
