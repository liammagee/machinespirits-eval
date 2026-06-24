# D2 Cross-Application Role-Reframed Gate

Date: 2026-06-24
Branch: `codex/d2-d6-followups`
Status: third D2-D6 slice; reconstructed gate because the original Path 2 note is missing in this checkout.

## Source status

The workplan and `TODO.md` both point to
`notes/design-d2-path2-cross-application.md`, dated 2026-04-25. That file is not
present in this checkout. This note reconstructs the actionable gate from the
surviving sources:

- `TODO.md` D2 Path 2,
- `workplan/items/d2-cross-application-role-reframed-study.md`,
- Paper 2.0's cross-application adjacency discussion,
- the D5 scoring gate, and
- the D6 orientation-family matrix.

This is not a claim update and not an implementation spec. It is the threshold a
real D2 implementation must clear before prompt authoring, paid generation, or
judging starts.

## Decision

D2 remains separate-study scope unless a fresh implementation item is opened.
For this D2-D6 branch, the actionable result is a no-paid gate:

> True cross-application transfer requires role-reframed prompts and role-fit
> scoring. Do not run it by merely changing tutoring content.

Path 1 already showed adjacency: recognition helped when the system was still a
tutor coaching peer-support skills. Path 2 is harder. The model must perform a
different role directly.

## Core applications

The core D2 study should keep the three applications named in TODO:

| Application | Relation shape | What changes from Paper 2.0 |
|---|---|---|
| Peer support listener | Symmetric, high reciprocity | The model is the listener, not a tutor coaching a listener. |
| Customer service agent | Service-asymmetric, transactional | The model handles a user problem without turning the exchange into a lesson. |
| Code reviewer | Expert-asymmetric, collaborative critique | The model reviews code and preserves author agency without adopting a tutor frame. |

Therapeutic listener is excluded by default. It may be added only under a
separate item with explicit safety scaffolding, IRB path, refusal-and-refer
behavior, deployment-isolation checks, participant-pool isolation, and
pre-registered halt criteria. Do not include it in the core D2 gate.

## Axes that must stay separate

D2 has two independent axes:

1. Application role.
   - Peer support, customer service, code review.
   - This is the external-validity axis.

2. Pedagogical orientation family.
   - Intersubjective/recognition-family versus transmission/default-family.
   - This is the theoretical mechanism axis.

Changing the role does not create a new orientation family. A role-reframed
customer-service prompt can still be written in an intersubjective orientation
or a transmission orientation. The study must keep those labels explicit.

## Required prompt/content/rubric work

Before any run:

1. Prompt files.
   - Two prompts per core application: one intersubjective/recognition-family
     prompt and one transmission/default-family prompt.
   - Prompts must be role-native. They should not say "tutor" unless the role is
     actually tutoring.

2. Content packages.
   - Peer support Path 1 material may be used as background only; direct
     listener scenarios need a new role-reframed package.
   - Customer service and code review need new packages.
   - Therapy package remains conditional and excluded by default.

3. Scoring rubric.
   - Do not force the tutor v2.2 rubric onto non-tutor roles by default.
   - Choose and freeze one of: a role-neutral quality rubric, separate
     application rubrics with a common composite, or a methods-sidecar scoring
     design.
   - If v2.2 is retained for a tutor-like subset, report it separately from
     role-native scores.

4. Cell IDs.
   - The TODO plan's cells 98-105 are stale in this checkout. Those IDs are now
     occupied by D3/id-director cells.
   - Any implementation must allocate fresh cell IDs from the current
     `config/tutor-agents.yaml` and register them in `EVAL_ONLY_PROFILES`.

5. Judge plan.
   - Three-judge scoring is required for any cross-application claim.
   - Report per-judge and pooled effects.
   - Cross-link the mediator analysis to D1 only if the same-response / same-run
     matching logic is available for the new role-native outputs.

## Preregistered pass/fail gate

Retain the surviving TODO threshold:

- Pass: effect size `d >= 1.0` on at least two of the three core applications.
- Fail/scope-bound: fewer than two core applications clear `d >= 1.0`.
- Therapy, if ever run, is not part of the core pass threshold unless a new
  preregistration explicitly changes that before data exists.

The threshold should be computed on the frozen primary rubric chosen before the
run, not whichever channel looks strongest afterward.

## Stop condition for D2

D2 is resolved for this branch when the branch records:

- the original Path 2 note is missing here,
- the core application set,
- therapy excluded by default,
- role and orientation as separate axes,
- stale cell IDs must not be reused,
- rubric strategy must be frozen before runs, and
- the pass threshold remains `d >= 1.0` on two of three core applications.

That condition is met by this note. The next item in the D2-D6 order is D4:
decide whether the disposition-gradient SEL replication can be reanalysed or
cleanly gated without new paid data.
