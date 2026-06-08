# A19 Generalization And Systemization Plan

Date: 2026-06-08.
Status: protocol planning plus offline infrastructure; no new empirical claim.

## Boundary

A19 remains downstream of the canonical Paper 2.0 evidence boundary. The current
work does not claim human learning, deployed adaptive tutoring, model-weight
learning, a main-harness effect, a pooled A19 rate, a paid-panel result, or a
sidecar/atlas empirical result not already present in `paper-full-2.0.md`.

The problem exposed by the v0.3-v0.5 loops is not a lack of iteration. It is an
evidence-unit problem. Recursive-full S0 often self-solves, and many repairs that
look theoretically non-transfer collapse under blind extraction into
`transfer_control` because the public action is still a learner application,
choice, or check before closure.

The original teaching-drama plan points to the next systemization layer:
public-state drama ontology, critic specialization, applicability and
anti-conditions, model-stratified policies, and adjudication that can support
human/LLM double-coding on the same artifacts.

## Track 1: Non-Collapsing Repair Families

Goal: design a repair family whose public obligations are not merely a hidden
variant of transfer-control.

Failure pattern to avoid:

- diagnostic options collapsed when choosing a diagnostic lane looked like a
  pre-closure task check;
- preserve-struggle collapsed when learner-owned action looked like a transfer
  gate;
- instructional-contract repair improved the situation but still produced only
  one stable local card, with later siblings mixed through S0 self-solve or S1
  transfer-control collapse.

Candidate repair families:

| candidate | distinctive public act | why it should not collapse into transfer-control |
| --- | --- | --- |
| `addressed_claim_withdrawal` | Tutor withdraws a misaddressed claim and restates the learner's actual claim as the object. | The repair is tutor-side retraction/re-addressing before any learner application. |
| `moral_disclosure_standing_repair` | Tutor repairs the learner's standing and disclosure boundary after moral flattening. | The repair is status/boundary restoration, not a content rule or fresh case. |
| `public_commitment_contradiction_repair` | Tutor cites conflicting public commitments and retracts/ranks one. | The repair is public commitment accounting; no learner test is needed for the repair to be visible. |

v0.6 result: `addressed_claim_withdrawal` / `claim_address_repair` was
pre-registered and materialized, but the real attempt-1 replay stopped before
S0/S1 with `revise_again`: `recursive_dyadic_update = 0.65 < 0.7`. This is an
elicitation failure, not evidence against held-out transfer.

v0.7 result: `public_commitment_contradiction` /
`commitment_ledger_repair` produced a real attempt-1 survivor and one admitted
axiom. Held-out screens produced one `policy_headroom` card
(`public_commitment_contradiction_a`) but with target-granularity risk, plus two
recursive-full S0 ceiling cards. This is a useful diagnostic result but still
below the bar for Paper 2.0, atlas, sidecar, stability, or paid/human-panel
claims.

Loop:

1. Pre-register one candidate repair type with public obligations, excludes, and
   distinction from `transfer_control`.
2. Add exactly one family with at least three held-out siblings.
3. Materialize fixtures and run `npm run a19:validate`.
4. Run attempt-1 failure elicitation only after the obligations freeze.
5. Admit exactly one bounded axiom only if attempt-1 survives.
6. Run S0-first held-out screens; stop before S1 when S0 is already target.
7. Run S1 only when recursive-full S0 leaves headroom.
8. Run k=2 stability for every local `policy_headroom` card.
9. Stop unless at least two held-out siblings are stability-confirmed without
   target-granularity risk.

Distinct results:

- `stable_non_transfer_headroom`: at least two recursive-full held-out siblings
  are stability-confirmed and S1 is extracted as the registered non-transfer
  repair.
- `transfer_control_collapse`: S1 repeatedly reaches only `transfer_control`.
- `s0_ceiling`: S0 repeatedly reaches the target without policy memory.
- `policy_failure`: S1 cannot apply the registered repair.

## Track 2: Adjudication Infrastructure

Goal: prepare the multi-critic/human layer without pretending we have panel
evidence now.

Infrastructure now:

- `config/teaching-drama-axioms/a19-adjudication-panel.yaml` defines coder
  visibility, dimensions, response schema, and agreement discipline.
- `scripts/build-a19-adjudication-packet.js` creates a blinded coder packet with
  neutral arm labels and a private answer key.
- The packet builder reports alias hits in visible public transcripts instead of
  suppressing them. A hit is a cue-risk audit field, not an automatic edit.

Loop:

1. Build a coder packet from an existing S0/S1 pair.
2. Verify that target aliases, decoy aliases, arm provenance, and policy-memory
   condition appear only in the private key, except for unavoidable transcript
   text audited as visible alias hits.
3. When coders are available, collect independent JSON files against the same
   packet.
4. Merge raw coder files without overwriting individual judgments.
5. Report agreement on the same artifact, not similar artifacts.

Distinct results:

- `infrastructure_ready`: packets validate and can be handed to LLM or human
  coders later.
- `packet_leak`: coder-visible metadata leaks aliases or arm provenance.
- `agreement_ready`: at least two independent coder files exist for the same
  packet.

## Track 3: Alternate S0 / Tutor-Learner Conditions

Goal: diagnose whether A19 memory helps less reflective tutors without weakening
the claim standard for Paper 2.0, atlas, or sidecar prose.

The recursive-full S0 is the right strong baseline for claims, but it is often
too capable to reveal mechanism headroom. We should therefore use weaker or
stratified conditions for triage, then require recursive-full confirmation
before claims.

Candidate conditions:

| condition | use | claim status |
| --- | --- | --- |
| `weak_single_pass_no_policy_memory` | no recursive tutor-learning gate; cheap mechanism diagnosis | protocol-screen-only |
| `decoy_continuation_no_revision` | debug target/decoy aliases and obvious leakage | fixture/debug only |
| `model_stratified_recursive_full` | compare weak/mid/strong generators separately | local only if each tier is reported |
| `critic_ablation_no_policy_memory` | isolate whether S0 self-solve comes from the recursive checker | mechanism diagnosis only |

Loop:

1. Run weak/debug S0 first only as a screen.
2. Promote only non-artifact, non-ceiling candidates to recursive-full S0.
3. Run S1 and stability only after recursive-full S0 headroom.
4. Report weak-S0 results as mechanism diagnostics, never as empirical transfer
   claims.
5. Track model tier and domain scope on every promoted family.

Distinct results:

- `weak_only_effect`: policy memory helps a weak S0 but fails recursive-full
  confirmation.
- `recursive_full_headroom`: weak screen promotes to a recursive-full candidate.
- `model_tier_specific`: the effect appears only in a declared generator tier.
- `no_condition_headroom`: all conditions self-solve or fail.

## Shared Loop Driver

The loop configuration is
`config/teaching-drama-axioms/a19-generalization-loops.yaml`.

Current observed-result artifacts:

- v0.6 attempt-1 report:
  `notes/adaptive_2_0/a19-attempt1-real-gate-report-addressed-claim.md`
- v0.7 attempt-1 report:
  `notes/adaptive_2_0/a19-attempt1-real-gate-report-public-commitment.md`
- v0.7 held-out screen:
  `notes/adaptive_2_0/a19-v07-public-commitment-screen-2026-06-08.md`
- v0.7 ambiguous adjudication packet:
  `exports/a19/adjudication-packets/public-commitment-contradiction-a.packet.json`

Offline status command:

```bash
node scripts/run-a19-generalization-loop.js --out exports/a19/reports/generalization-loop.md
```

This command does not generate, judge, retrieve, train, or update Paper 2.0. It
reports the next lawful action for each track and stops where the current result
requires protocol changes, stability confirmation, paid/human adjudication, or
canonical paper prose.
