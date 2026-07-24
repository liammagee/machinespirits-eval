# Tutor-stub latency and discourse-plane diagnostic

**Recorded:** 2026-07-24

**Status:** Diagnostic note for later design and implementation work; not a benchmark or a claim that the current implementation is unchanged.

**Source run:** `.tutor-stub-traces/2026-07-24T00-52-14-383Z.jsonl`, turn 2 (`2026-07-24T00-52-14-383Z:t002`)

**Learner input:** “can we simplify the language a bit? I'm not following”

## Executive synthesis

The poor delivered response and the long wait had the same underlying cause.
The Luna learner-analysis call and both Luna tutor drafts understood that the
learner was asking for a simpler explanation. Deterministic downstream
contracts lost that instructional-metalanguage classification, rejected two
reasonable drafts, and finally generated an object-level proof fallback. The
system therefore spent about 21 seconds on two tutor drafts and then displayed
neither of them.

This makes discourse-plane preservation both a correctness fix and the largest
safe latency opportunity observed in this turn. Avoiding a falsely triggered
recovery would have saved about 9.68 seconds and 12,600 tokens here without
removing safety checks.

## Observed latency

The terminal's `21,092ms` reported only the two speaking-tutor attempts. It did
not include the learner-analysis call, so the foreground wait was about 30.45
seconds.

| Stage | Time | Share | Tokens | Outcome |
|---|---:|---:|---:|---|
| Combined learner analysis | 9.30s | 30.5% | 11,650 | Used |
| First tutor draft | 11.41s | 37.5% | 12,509 | Rejected |
| Recovery tutor draft | 9.68s | 31.8% | 12,600 | Rejected |
| Local audits and deterministic fallback | about 0.06s | 0.2% | — | Fallback displayed |
| **Foreground total** | **about 30.45s** | **100%** | **36,759** | |

Mixed mode had also performed roughly 43.7 seconds of background learner and
tutor prefetch before this foreground turn. The human typed something different
from the suggested learner answer, producing an `answer_changed` cache miss and
discarding the prefetched tutor response. This did not add 43.7 seconds to the
foreground wait, but it was wasted computation for this interaction.

Local checking was not the latency bottleneck. The expensive path was three
fresh external-model calls, two of which produced text that was never shown.

## Safe optimization candidates

### 1. Prevent false recovery calls

Make a correctly classified instructional repair request authoritative through
response configuration, progression, auditing, and fallback. In this example,
accepting a suitable first draft would have avoided the 9.68-second recovery
call. This is the strongest candidate because it improves both latency and
dialogue quality while preserving the guard architecture.

Adoption gate: run the tutor quality and guard suites plus real transcript
smokes covering object-level, instructional-meta, and mixed turns. The change
must not allow genuine proof-progression errors through merely because a turn
contains clarification language.

### 2. Benchmark lower reasoning effort

Compare `--cli-effort low` / `TUTOR_STUB_CLI_EFFORT=low` with the current effort
on a frozen transcript set. Deterministic checks remain active, but this is not
automatically safe: measure first-draft acceptance, fallback rate, pedagogy, and
latency rather than assuming lower effort is equivalent.

### 3. Benchmark model routing by role

This run used Luna for all roles. Compare it with Terra for all roles and,
separately, route only combined learner analysis to a faster calibrated model.
The latter owns 9.3 seconds of this foreground turn and can be changed without
necessarily changing the speaking tutor.

Useful live comparisons:

```text
/settings models all codex.gpt-5.6-terra
/settings models reasoning codex.gpt-5.6-terra
```

Treat these as experiments, not established speedups. Record accuracy of the
discourse classification and conservative learner-record update as well as
wall-clock time.

### 4. Compact repeated prompt material

The three foreground calls carried roughly 11.3K–12.2K input tokens each.
Earlier work found meaningful learner-analysis gains from prompt compaction,
but those measurements came from an older checkout and need refreshing. Remove
duplicated instructions or irrelevant registries only where parser-consumed
fields and public-safety boundaries remain unchanged.

### 5. Reconsider full speculative tutor prefetch

Keep the mixed learner suggestion, but consider delaying the tutor-response
prefetch until the human accepts or closely matches that suggestion. This would
avoid expensive discarded tutor calls for custom human replies, at the cost of
losing near-instant replies when the suggestion is accepted. A confidence or
historical acceptance threshold may be preferable to always-on or always-off
prefetch.

### Non-equivalent shortcuts

Turning off response details or optional feedback improves presentation but
does not reduce model latency. Disabling the classifier or using passthrough is
faster, but removes adaptive or safety machinery and is therefore not an
equivalent tutor configuration.

## Object language versus instructional metalanguage

The learner's sentence was about the tutor's explanation, not about the proof
being taught:

| Plane | Meaning in this exchange |
|---|---|
| Object language | Claims about the FAQ-tool proof, clues, baseline implementation, and evidence |
| Instructional metalanguage | A request to change the wording, pace, or explanation used in the dialogue |

The delivered fallback treated “simplify the language” as though it were a
proposition to enter and test inside the proof. That is effectively a
use/mention or discourse-plane type error.

This trace does **not** support attributing that error primarily to Luna:

- Learner analysis classified the message as
  `plain_simplification_followup`, `repair_request`, and a wording-only side
  arc with no DAG progress.
- The first Luna tutor draft began: “You want plainer words; ‘first
  implementation baseline’ means the simplest starting version we should
  build.”
- The recovery draft also answered the request in broadly appropriate plain
  language.
- Deterministic audits rejected both drafts, after which the generic fallback
  turned the raw learner request into a clue-like proof object.

Model choice may affect how elegantly a target phrase is identified or
rewritten, but changing the model would mostly mask the architectural defect
seen here.

## Where the type information was lost

1. The learner-analysis layer detected a clarification side arc correctly, but
   its classification was not authoritative downstream.
2. Confusion slowed the pacing and response configuration selected
   `reanchor_public_evidence`. Pacing changed the semantic purpose of the turn
   instead of only changing delivery.
3. The progression compiler copied the raw request into proof-focus fields.
4. A lexical uptake audit did not recognise “You want plainer words” as valid
   uptake of “simplify the language.”
5. The generic fallback knew how to continue an object-level proof scene but
   did not have a dedicated instructional-repair realization.
6. The contracts conflicted: one check required a bounded choice while another
   forbade a question. The first response failed for omitting the choice; the
   recovery supplied one and then failed the no-question constraint.

Relevant implementation seams are:

- `services/tutorStubResponseConfiguration.js`
- `services/tutorStubTurnProgressionContract.js`
- `services/tutorStubResponseComposition.js`
- the learner-analysis normalization and state-observation path in
  `scripts/tutor-stub.js`

## Proposed first-class contract

Carry discourse type explicitly rather than reconstructing it lexically at
each downstream stage:

```text
discourse_plane: object | instructional_meta | mixed
meta_target: latest_tutor_turn | named_term | pace | explanation
proof_effect: none | candidate | accepted
```

For `instructional_meta`:

- freeze proof/DAG progress for the repair turn;
- answer the repair request before returning to the investigation;
- let pace and register change sentence length, vocabulary, and examples, but
  never change `repair_explanation` into `reanchor_public_evidence`;
- derive question permissions from the repair contract once, so bounded-choice
  and no-question requirements cannot coexist;
- audit semantic uptake using the classified intent and target, not only word
  overlap;
- use an instructional-repair fallback, potentially reusing the same rewrite
  machinery as `/translate basic`.

For `mixed`, separate the meta repair from any object-level claim and assign a
proof effect only to the latter.

A suitable response for the observed turn would have been:

> Absolutely. By “first implementation baseline,” I mean the simplest useful
> version we could build first. The chat wording tells us how students would
> talk to it, but not yet what the system should do or decide.

## Return-to-work checklist

When this analysis is promoted into implementation work, first capture it as a
workplan item, then:

1. Freeze the source turn as a regression fixture containing both rejected
   drafts, audit results, and the delivered fallback.
2. Add object, instructional-meta, and mixed discourse-plane fixtures.
3. Specify invariants for proof-state freezing, pacing, question permission,
   and fallback selection.
4. Implement the smallest end-to-end type-preserving path rather than a
   prompt-only hint.
5. Measure first-draft acceptance, recovery/fallback rate, foreground latency,
   token use, and pedagogical quality on the same frozen set.
6. Evaluate reasoning effort, role-model routing, prompt compaction, and
   prefetch policy independently so their effects remain attributable.
