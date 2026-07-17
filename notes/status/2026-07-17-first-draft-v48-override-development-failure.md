# V48 owner-bound override diagnostics: one pass, one morphology false negative

Date: 2026-07-17  
Status: failed non-held-out, non-equivalent staged development screen  
Campaign: `first-draft-diagnostic-screens-v28`  
Frozen HEAD: `addea66fa369438c7d7691e6a5b438c3d4e32d6b`

V48 remains failed development evidence. The first fresh Tallow/answer-seeking
original passed every automatic gate, which admitted the predeclared second
draw. The second was safe and causally sound but was rejected by the typed
pressure-target recognizer. The final historical result is 1/2 originals, zero
safety failures, and zero repairs, rewrites, fallbacks, transport
normalizations, semantic corrections, or adjudicator calls.

## Draws

| Draw | Automatic | Configuration | Latency | Input (cached / uncached) | Output / reasoning |
|---|---|---:|---:|---:|---:|
| `20263800` | pass | 1.000 | 6,822 ms | 10,710 (6,400 / 4,310) | 93 / 0 |
| `20263801` | fail | 0.833 | 14,086 ms | 12,729 (6,400 / 6,329) | 538 / 442 |

Both calls used an authored estimate of 2,296 tokens. Mean provider-observed
input was 11,719.5 tokens; mean inferred runtime residual was 9,423.5 tokens.
The estimate uses `utf16-code-units-div-4-ceiling-v1`, and the residual is
inferred rather than directly observed.

Draw 1 passed the complete typed operation. Draw 2 said:

> My case is this: I set stocktake-dark depot chargers against Tallow Street brownout claims.

It passed every typed subrequirement except `pressure_target_visible`. The
recognizer admitted singular `claim` but not its ordinary plural `claims`.
This was a morphology false negative, not another generation miss. A
subsequent model-free audit-recognition repair normalizes typed pressure-target
tokens, passes `claim` and `claims`, rejects `claimant`, and preserves all
delivery and safety requirements. It does not rewrite V48's result.

## Independent qualitative review

Two blinded reviewers independently passed all four slots of both draws. Each
reviewer found that causal assertions preserved the depot chargers, negative
production relation, and Tallow Street brownout; neither output reversed the
evidence; and each action-only handoff retained the stocktake-dark condition
and Tallow Street/18:40 outcome. The qualitative result is 4/4 passing ratings
across two completed draws.

## Change separation

- Speaking prompt: unchanged from V47.
- Recovery: unchanged and not invoked.
- Audit recognition before V48: owner-bound entry referent plus exact
  response-owned causal tuple.
- Audit recognition after V48: typed pressure-target morphology only.
- Safety and delivery gates: unchanged.

V48 therefore provides one fresh generated automatic pass and a second fresh
candidate that passes after a principled model-free recognition correction.
It does not yet satisfy the requirement for two consecutive fresh originals
to pass the frozen automatic gates at generation time.

## Provenance

- Config SHA-256: `95deaab75ca0fbfca34a9fd9a4f4895cd4d283319ade3adede1b4ad0b63a79ed`
- Campaign validation SHA-256: `d920366c725264c6e3a4489e269ad776c68e214129b3624641ebf77fc84ef033`
- Preflight execution SHA-256: `9a0bfc1a1fe15d49dc198ae3cc707c50bdebacc1c1e80b87f7edd755d3d8cbb5`
- Preflight certificate key: `2b28b6bc0dda9cff9421d2155f74f447cee2589b15957607b35cb25896b18bb8`
- Preflight certificate SHA-256: `78c75fa58880e21b6e07713ac235da168b763bbf81b6a263df1f305d5b8ac061`
- Draw 1 report SHA-256: `0a739bdd8d0a33c82887097fd3db61d3bdc4ccf0ae9752435cb4ea7907ffe74e`
- Draw 2 report SHA-256: `0e35cfc36fa76587dcdeb5fefd590a757ceeef3f68914170c46a1793b836f0fe`
- Working result SHA-256: `e7c433f5e430d5d0e9b62b2cbca3f3f78194213ca51ddd546879901b5d404a76`

Seeds `20263800` and `20263801` are consumed and retired. Any further
development calls require a freshly predeclared version and unused seeds.
