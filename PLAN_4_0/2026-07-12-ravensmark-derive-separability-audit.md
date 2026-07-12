# Ravensmark derive separability audit

**Date:** 2026-07-12
**Scope:** zero-call audit of the learner-state v2.1 observability gate
**Source stop:** `adaptive-state-v2-observability-preflight-c0ccd5c9-v21`
**Claim status:** engineering/measurement repair only

## Decision

Treat Ravensmark rule `R1_scope` as **structural proof support**, not as a
separately observable public learner event. Keep the rule in symbolic closure,
but do not use its conclusion `materialSealAtIssue(gatePass,duskSeal)` as a
`derive` target. The next observable derive target becomes the relational fact
`pressedSealFor(gatePass,elian)`, which requires both the visible seal mark and
the public seal-holder registry.

This decision is implemented in the shared benchmark world adapter, so it
governs both the 24-cell preflight and the full S1 matrix. It is not a
preflight-only relabel and does not teach either model the hidden target.

## Why the previous target was not construct-valid enough

The failed cell asked the realizer/analyzer channel to distinguish:

- released premise: `sealMarkOf(gatePass,duskSeal)`;
- unary scope rule: `sealMarkOf → materialSealAtIssue`;
- intended learner event: `materialSealAtIssue(gatePass,duskSeal)`.

The authored premise already says that the dusk-seal impression is physically
on the pass. The public rule then names that same impression as the material
seal “at issue.” In ordinary language, the premise and conclusion can be
expressed as the same proposition: the dusk-seal is the operative impression.
The third preflight learner did exactly that, then added a conditional statement
about the holder. The analyzer treated the operative-seal clause as part of the
premise and the holder clause as unsupported.

That result does not prove the analyzer was correct or prove semantic
separability was the only cause. It does show that this target cannot cleanly
identify analyzer reliability: a reasonable parser can read it as either a new
scope inference or a restatement. Repeating the same prompt-level repair would
therefore tune to the benchmark wording rather than improve the construct.

## Construct rule

A rule may be declared `structural_support_rule_ids` only when it is:

1. unary: one antecedent and one consequent;
2. not an answer-producing rule for the public question; and
3. used as support by a later rule.

The adapter validates those conditions fail-closed. Conclusions produced by a
structural-support rule remain available to logical closure and downstream
rules, but they cannot be emitted as learner `derive` events. Their event slots
remain reserved so historical event identifiers are not silently reassigned.

For Ravensmark:

```text
sealMarkOf(gatePass,duskSeal)          structural support via R1_scope
sealHeldBy(duskSeal,elian)             second public premise
────────────────────────────────────────────────────────────────
pressedSealFor(gatePass,elian)         next observable derive event
signedBy(gatePass,elian)               later answer
```

The new derive target introduces both a person and a new action relation. It is
therefore observably distinct from either public premise while remaining
licensed only by public evidence and public rules.

## Rejected alternatives

- **Another analyzer or realizer prompt patch:** rejected after the same
  Ravensmark boundary survived an explicit concrete-derive and clause-wise
  recovery repair.
- **Expose the target fact or rule classification to the models:** rejected as
  target leakage.
- **Relabel the stopped row or lower 24/24:** rejected; all stopped rows remain
  immutable and non-reusable.
- **Delete or rewrite `R1_scope`:** unnecessary. The rule remains useful
  symbolic scaffolding and the authored world need not change.
- **Special-case Claude or the failed case ID:** rejected. Runtime code contains
  neither the run ID nor failed cell ID.

## Lineage consequence

The repair changes the benchmark configuration and the shared transition
kernel source. The prior S0 parent correctly becomes stale against the current
runner/policy/config hashes. A fresh zero-call S0 must pass and seal before any
new paid preflight. The third stopped preflight cannot authorize S1 under the
new contract.

The stopped S1 remains diagnostic history under its original S0; it does not
become a child of the replacement S0. The preflight runner therefore requires
both lineages when the config changed:

- the original sealed S0 that actually parented the stopped S1; and
- the fresh current S0 that parents the new preflight and any later S1.

It verifies the original S0 independently, requires the stopped S1 to name it,
requires the old and current canonical config hashes to differ, and binds both
S0 plan hashes plus the stopped-S1 plan hash into the new preflight plan. This
is lineage transport, not row reuse: no stopped S1 or preflight call is copied
into the new transaction.

## Exit gates

1. Freeze the exact third-run learner/analyzer record as a test-only fixture.
2. Prove that `R1_scope` stays in closure but cannot emit a learner event.
3. Prove that the shared preflight/S1 adapter targets
   `pressedSealFor(gatePass,elian)` instead.
4. Pass focused, adaptive-state, full-suite, static-contract, and lineage tests.
5. Commit and push from a clean tree.
6. Run and seal a fresh zero-call S0.
7. Only then run a fresh complete 24-cell/48-dispatch preflight with the same
   no-retry, no-repair, no-reroll, no-fallback, no-exclusion, and no-reuse
   contract.
8. Require exactly 24/24. A pass authorizes only a separately confirmed full S1;
   it is not a sensor-validity or tutoring result.

## Claim boundary

This audit repairs the observability test construct. It provides no evidence
that the DAG/field/trajectory sensor predicts learner state, no evidence that a
policy adapts successfully, and no efficacy, human-learning, deployment, or
Phase 6 result.

## Execution outcome

Exit-gate steps 1–7 were completed; step 8 stopped at its exact 24/24
requirement. Commit `2dd039c5` implemented the shared structural-support
contract and commit `985bd542` added the required dual-S0 lineage validation.
Fresh zero-call S0
`adaptive-state-v2-s0-structural-support-2dd039c5-v21` passed and sealed with 24
dialogues, 144 transitions, and no model calls.

The fresh paid run
`adaptive-state-v2-observability-preflight-985bd542-v21` then completed all 24
cases and 48 unique serial CLI dispatches. The exact gate stopped at 23/24.
Crucially, the original construct hypothesis was resolved:

- Claude voiced the new conclusion that Elian pressed the operative seal, and
  the analyzer recovered `derive`;
- Codex wrote only “The dusk-seal on the pass was held by Elian,” restating the
  released registry premise while its sidecar claimed `derive:inference_03`;
- the analyzer correctly returned `none` for that Codex text.

The failure therefore moved from an ambiguous unary scope transition to a
realizer-fidelity violation on a separable target. The audit repair is retained,
but it did not clear the 24/24 v2.1 gate. No further paid preflight or full S1 is
authorized. The next permitted work is a zero-call prospective review of
whether the experiment should retain exact single-draw realization or adopt a
new, preregistered repeated-draw reliability gate. The stopped v2.1 result may
not be relabeled or rescued by changing the threshold after observation.
