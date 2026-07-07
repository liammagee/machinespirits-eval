# Ego-Superego History Context Note

Date: 2026-06-20 19:01
Status: design question to revisit

## Current Implementation

The ego-superego deliberation is tracked in held-out traces. Each public tutor or learner turn can carry an `internalDeliberation` array with:

- ego initial draft
- superego critique
- ego adjudication
- model, usage, latency, and provenance metadata where available

That hidden deliberation is useful for audit, scoring, debugging, and post-hoc analysis. It is not rendered into the public transcript.

However, future prompt context does not currently replay the full prior ego-superego dialogue. The next tutor or learner call receives the recent external tutor-learner dialogue, currently the last six public turns, plus writing-pad summaries and current director/adaptation/world context. Within a single turn, the ego sees its own draft and the superego critique during adjudication; across turns, the hidden internal conversation is mostly persisted rather than actively reintroduced.

## Open Question

We should revisit whether this is too shallow for genuine bilateral learning.

If tutor and learner are meant to learn not only from the exterior public other, but also from their own evolving internal other, then the full ego-superego history may need to become part of the state that each agent can use over time. The tutor ego might learn from repeated superego critiques. The learner ego might learn from its superego's recurring objections. Each side might also need a model of the other side's public ego across time, not only the last six spoken turns.

Put differently: the present design tracks the internal drama, but it does not fully operationalize it as memory.

## Possible Direction

A future context mode could distinguish:

1. Public exterior dialogue memory: what tutor and learner said to each other.
2. Self-internal deliberation memory: what this side's ego and superego have repeatedly debated.
3. Other-side inferred public stance: what this side can infer about the other from public speech only.
4. Held-out analytic trace: full hidden deliberation, kept for audit and not directly exposed across agents.

The difficult boundary is that one side should not receive the other side's hidden deliberation as prompt context, because that would collapse the public relation and leak concealed interiors. But a side may reasonably receive a compact memory of its own prior internal debate, and may build only public-safe inferences about the other's stance.

## Risks

- Prompt bloat: replaying full deliberation will expand already-large drama prompts.
- Leakage: hidden labels, director policy, answer keys, or the other side's private deliberation could accidentally surface.
- Self-justification loops: agents may overfit to their own prior private rationales rather than the learner/tutor's public movement.
- False depth: adding private history may look like learning while merely increasing continuity of self-talk.

## Minimal Test To Consider

Add an experimental context mode that includes a compact, public-safe self-deliberation ledger:

- recurring ego habit
- recurring superego objection
- last adjudication decision
- unresolved self-critique
- public behavior that changed as a result

Keep this ledger side-local. Do not expose learner hidden deliberation to tutor or tutor hidden deliberation to learner. Compare against the current last-six-public-turn mode on AF1 and AF11 with fixed seed, routing, scorer, and quality checks.
