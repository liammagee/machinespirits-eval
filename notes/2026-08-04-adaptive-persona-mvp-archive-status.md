# Adaptive Persona MVP Archive Status

Date: 2026-08-04

## Status

`adaptive-persona-mvp` is a preserved historical prototype, not an active
integration branch or a source of current empirical claims. Its authoritative
record is the annotated Git tag:

```text
archive/adaptive-persona-mvp
```

The tag is present on the GitHub remote. It preserves the prototype code,
tests, prompts, configuration, design notes, critique, and retrospective. The
generated `outputs/` scratch artifacts were intentionally removed from Git and
are not part of the archive.

Retrieve the preserved tree without moving the current branch:

```bash
git checkout archive/adaptive-persona-mvp -- prototypes/adaptive-persona-mvp
```

Inspect the archive in a detached checkout:

```bash
git switch --detach archive/adaptive-persona-mvp
```

## Evidence Boundary

The prototype's positive closed-loop scores, including the reported `+17` MVP
effect, `established: yes`, and parent-replay percentage, are retracted as
empirical adaptation claims. They depended on a closed simulator/evaluator
circuit. The diagnostic trap suite with an LLM learner returned a null result.

The archive remains useful for architecture and methods: explicit challenge
state, transfer gating, policy traces, reflexive critique and memory, paired
counterfactuals, and transcript-level outcome checks. It does not establish
that those mechanisms improved an autonomous LLM tutor under an independent
learner evaluation.

The archived `INTEGRATION_STATUS_AND_PLAN.md` predates the final retraction and
must be read as historical planning, not current integration guidance. The tag
annotation, `ITERATION_RESULTS.md`, and `CLAUDES_CRITIQUE.md` carry the final
claim boundary.

## Supersession On Main

Do not port the prototype wholesale. Current `main` has superseded its useful
mechanisms with parent-native components under `services/adaptiveTutor/`,
including the adaptation contract, typed action policy, outcome observer,
intervention ledger, proof/release/ownership gates, and auditable traces.

`ADAPTATION-PLAN-3.0.md` and
`notes/2026-08-03-adaptive-causality-living-log.md` are the current account.
Their bounded conclusion is that the framework supports reactive, stateful,
and routed adaptation in simulated authored worlds. Recursive policy learning
from outcomes and human-learning effects remain unproven.

## Disposition

- Keep the archive tag immutable and remote-backed.
- Do not cite its closed-loop performance numbers as evidence.
- Reuse an archived mechanism only through a new parent-native implementation
  with current provenance, causal comparators, and held-out evaluation.
- Continue adaptation research through the current adaptive-causality program,
  not by reopening the archived prompt sweep.
