# D3 Heavy Bridge Follow-up Gate

Date: 2026-06-24
Branch: `codex/d2-d6-followups`
Status: fifth D2-D6 slice; future-work gate for expensive bridge paths.

## Source status

The D3 workplan card points to `notes/design-d3-architectural-bridges.md`, but
that file is not present in this checkout. The surviving source of truth is the
closed D3 block in `TODO.md`, plus the registered cell metadata in
`config/tutor-agents.yaml`.

This note does not reopen D3. It records what would have to be true before a
future heavy bridge run is worth paying for.

## Current evidence

D3's settled result is:

| Bridge | Mechanism | Verdict |
|---|---|---|
| Bridge 0, cell 97 | Explicit prompt directive to act on reflection | Structural/null, d about +0.07 |
| Bridge 1, cell 98 | Two-pass reflection fed back as input | Structural/null, d about -0.21 in the final table |
| Bridge 2, cell 99 | Coupling-targeted superego | Structural/null, d about -0.22 in the final table |
| Bridge 3, cell 100 | Best-of-N, K=3, selected on coupling cosine | Suggestive but not bridgeable, d about +0.41 |

The practical reading is not "bridges are impossible." It is narrower and more
useful: lightweight prompt/orchestration fixes do not move the channel, while
expensive search moves the semantic-coupling metric only weakly and does not
improve the orthogonal pragmatic-act channel.

## Decision

Do not run Bridge 3b/4/5 inside this arc. They remain future work unless a new
item freezes an independent acceptance gate before any paid generation.

The core guardrail is:

> A search procedure selected on coupling cosine cannot be judged only by
> coupling cosine.

Bridge 3 already matched the selection metric to the verdict metric and still
landed below the bridgeable threshold. Increasing K may improve that metric, but
without an independent endpoint it mostly tests search over the scoring surface.

## Future gates

### Bridge 3b: K sweep

Allowed only if the primary endpoint is independent of the selection criterion.

Minimum gate:

- K values fixed before data, for example K=5 and K=10, with K=20 only if budget
  is approved separately.
- Selection metric remains coupling cosine or is frozen before the run.
- Primary endpoint must include an independent channel: EoQ%, v2.2 tutor quality,
  learner-side quality, dialogue quality, or a pre-registered blind qualitative
  criterion.
- Pass requires both:
  - semantic coupling reaches the old bridgeable threshold (`d >= 0.5`), and
  - at least one independent endpoint improves without degradation on the others.
- If coupling rises but independent endpoints stay flat, the result is Goodhart,
  not a bridge.

### Bridge 4: reflector/actor split

Allowed only if the architecture change is tested in a no-cost/mock fixture
first. The fixture must demonstrate that the actor can receive a reflector's
state without merely paraphrasing it. A paid run needs:

- same scenarios and baseline as the previous D3 bridge runs,
- a matched cell 40 control,
- frozen independent endpoint as above, and
- a stop rule if the fixture shows reflection text but no action change.

### Bridge 5: outcome-conditioned generation

Allowed only if the outcome signal is trustworthy before training or selection.
This is the highest Goodhart risk because it starts to look like a reward loop.
Before any paid run:

- define the outcome channel outside the generation architecture,
- prove the outcome channel is not a lexical shortcut,
- keep train/selection and evaluation channels separate, and
- reject the run if the signal is only readable by the same metric being
  optimized.

## Stop condition for D3

D3 is resolved for this branch when it records:

- the linked architectural-bridges design note is absent here,
- Bridges 0-2 are closed as lightweight/null,
- Bridge 3 is suggestive but not bridgeable at K=3,
- future search/split/outcome-conditioned work requires an independent endpoint,
  and
- no paid bridge escalation is justified in this arc.

That condition is met by this note.
