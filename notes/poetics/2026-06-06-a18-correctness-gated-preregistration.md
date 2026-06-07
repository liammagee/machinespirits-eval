# A18.16 Correctness-Gated Fresh-Family Pre-Registration

Date: 2026-06-06

Status: protocol frozen before fresh-family replication. No generation, replay,
critic, or panel calls were run.

## Purpose

A18.15 established a bounded cross-family positive: two artificial local
relation families now have contrastive support for simulated counterfactual
policy transfer. The remaining caveat is methodological. The bead family passed
only after A18.13 added a policy-correctness gate in response to an observed
failure mode: S0 could be a raw local survivor while applying the wrong target
or a different plausible repair.

A18.16 freezes that correction before the next family is generated. This turns
the next test into a fresh-family replication under a known protocol rather than
another post-hoc repair.

## Frozen Artifact

Protocol:

`config/recursive-tutor-learning/a18-correctness-gated-protocol.yaml`

Validator:

```bash
npm run poetics:recursive-tutor-protocol -- \
  --config config/recursive-tutor-learning/underdetermined-transfer-families.yaml
```

The validator is zero-API. It checks fixture structure only:

- the family has multiple plausible public repairs;
- the selected repair is registered in `transfer_design`;
- held-out siblings have `policy_correctness` metadata before generation;
- the selected repair is present among each held-out sibling's plausible public
  repairs;
- the registered selected repair, target, target aliases, repair markers, and
  incorrect targets are all present.

## Frozen Local Gate

Fresh-family local candidates must be produced under the A18.8/A18.9 hardened
conditions:

- `fresh_s1: true`
- `inner_max_chars: 0`
- `rewrite_mode: bounded_continuation`
- `bounded_max_added_lines: 6`
- `policy_contrast_gate: true`
- `min_policy_distinctiveness: 0.12`
- panel policy `headroom`

The local candidate rule is:

- effective local verdict = `policy_memory_local_advantage`
- policy contrast verdict = `policy_distinct`
- S1 is a local survivor
- S1 applies the registered selected repair to the registered target
- S0 does not apply the registered selected repair to the registered target

This is the important A18.13 correction. Raw local survival is no longer enough.

## Frozen Contrast Panel

The panel remains the A18.10/A18.14 blind contrast design:

- critics: Qwen 3.7 Max, Gemini 3.5 Flash, DeepSeek V4 Pro, Claude Sonnet 4.6,
  Codex
- `min_critics: 5`
- threshold: majority, therefore 3 of 5 transfer votes
- high ordinary-public-inference risk blocks a critic vote
- medium ordinary-public-inference risk is reported as a caveat

A critic transfer vote requires all of:

- selected-policy side = hidden S1 side
- learner-resistance-addressed side = hidden S1 side or both
- winner = hidden S1 side
- origin class = `policy_transfer_like`
- differential policy use >= 4
- ordinary-public-inference risk is not high

## Claim Rule

A fresh family passing this protocol would strengthen A18 from:

> two artificial families show bounded counterfactual policy-transfer support

to:

> the correctness-gated protocol replicated on a fresh artificial family.

That still would not by itself be human learning, deployed tutoring, model-weight
learning, or a main-harness rate effect. It would, however, remove the main
A18.14 caveat: the decisive correctness gate would no longer be post-hoc.

## Next Move

A18.17 should generate or author a fresh third artificial local-relation family,
validate it against the frozen protocol before generation, then run only the
local S0-hard screen. No panel should run unless at least two held-out siblings
become local candidates under the frozen gate.
