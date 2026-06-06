# A18.30 Post-V2 Family Stop-Rule Synthesis

Date: 2026-06-06

Status: zero-API synthesis complete. Stop manual fresh-family replay loop for
now.

## Evidence Since The V2 Freeze

### A18.26: `diagonal_socket_priority`

Outcome:

- attempt 1 survived;
- policy fill succeeded;
- one held-out sibling passed locally;
- one held-out sibling failed;
- no panel.

Failure mode:

The selected relation was an inverse/completion relation:

> same position duplicates; opposite position completes.

The public setup made a simpler same-position rule too natural. On the failing
sibling, S1 drifted to the same-position reading and chose the wrong target.

Class:

`inverse_rule_instability`

### A18.29: `thread_source_priority`

Outcome:

- attempt 1 survived;
- policy fill succeeded;
- both held-out siblings failed;
- no panel.

Failure mode:

The selected relation was non-inverse and publicly usable:

> the round/source end touches the carrier.

But the visible nub/contact-shape cue was easy enough for S0 to use without
policy memory. Both S0 and S1 survived on both siblings.

Class:

`public_self_solving`

## Current Bottleneck

The bottleneck is not the v2 panel rule. The v2 panel rule is executable and
provenance-preserving.

The bottleneck is fixture construction. A useful family must sit in a narrow
window:

- selected repair is visible enough for S1 to apply after policy transfer;
- selected repair is not so visible that S0 naturally discovers it;
- the selected relation is stable enough that S1 does not drift to a simpler
  public interpretation;
- the public counterexample makes the old check fail, not merely less elegant;
- the correct target is not fighting multiple high-salience public cues unless
  the tutor first makes those cues misclassify.

A18.26 missed by being too unstable. A18.29 missed by being too public.

## Design Constraint

Do not author another free-form family until the fixture schema captures the
cue map that is currently only implicit:

- targets;
- public cues attached to each target;
- which cues favor S0;
- which cue/relation is selected by policy memory;
- why the selected cue is not an ordinary public inference;
- what public counterexample blocks the old cue;
- expected S0 wrong move;
- expected S1 correct move;
- marker aliases broad enough to catch natural wording without turning S0 into
  a false positive.

## Recommendation

The next move should be a zero-API structured preflight, not another local
replay:

1. Extend or sidecar the family fixtures with a `cue_map`.
2. Add a static risk reporter that classifies candidate families before replay:
   - `inverse_rule_instability_risk`;
   - `public_self_solving_risk`;
   - `target_salience_overload`;
   - `marker_too_narrow`;
   - `marker_too_broad`;
   - `counterexample_missing`.
3. Require a clean preflight before spending on attempt-1 replay.

This would turn the current higher-order learning into an explicit design
constraint instead of another manual intuition pass.

## Claim Boundary

A18 still has bounded positive evidence from the earlier selector and bead
families, plus a post-v2 sensitivity rationale. It does not yet support reliable
peripeteia-induced adaptation under a fresh post-v2 replication.
