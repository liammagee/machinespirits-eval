# Invested-rival learner replication v1

Status: registered on `main`; signed launch note committed; launch pending

## Question

Does the frozen active-progression scaffold improve resistant-learner
performance relative to the original invested-rival prompt across multiple
new worlds and across Luna, normal Qwen and abliterated Qwen?

This is a prospective replication of
`invested-rival-learner-iteration-v1`. The earlier development and held-out
dialogues are not pooled into the replication.

## Design

The study is a 3 × 2 × 3 blocked comparison:

- learner route: Luna, normal Qwen, abliterated Qwen;
- learner mechanism: original invested-rival prompt or the frozen
  active-progression addition; and
- world: Larkspur Studio, Riverside Clinic, Tideway Makerspace.

There are **18 new dialogues** and nine matched mechanism pairs. Each pair
shares its learner route, world, character, public proof schedule, Sol tutor,
temperature, seed, turn limit and assessment instruments. Only the presence of
the frozen scaffold differs. Execution is blocked by learner route so each
local Qwen checkpoint is loaded once; baseline/progression order alternates by
world and is fixed before launch.

The three worlds are:

1. `world_028_larkspur_fridge`: the learner initially blames Dario for a
   missing lunchbox;
2. `world_029_riverside_clinic`: the learner initially blames Mara for a
   cancelled appointment; and
3. `world_031_tideway_makerspace`: the learner initially blames Jules for a
   twisted model bridge.

None was used to develop or test the active-progression scaffold in the prior
study.

## Frozen mechanism contrast

The baseline receives the original invested-rival learner prompt plus the same
world-specific character brief as its paired scaffold arm. The scaffold arm
adds the exact active-progression system and turn instructions from
`invested-rival-learner-iteration-v1`; they are not retuned for these worlds or
models.

The adapter substitutes the actual character name for the historical `Alex`
placeholder before either condition is formed. This repairs role naming
symmetrically and is not an experimental factor.

## Routes and stopping

- Tutor: `codex.gpt-5.6-sol`, medium effort, direct, no superego.
- Luna learner: `codex.gpt-5.6-luna`, medium effort, direct, no superego.
- Normal Qwen: `mlx-community/Qwen3.8-27B-4bit`, direct local route.
- Abliterated Qwen: `Qwen3.8-27B-Uncensored-MLX/4-bit`, direct local route.
- Judge: `claude-code.claude-opus-5`, maximum effort.
- Generation seed: 17; temperature: 0.6; maximum: eight exchanges.

Natural grounded closure may shorten a dialogue. A learner exit is preserved.
No valid dialogue or assessment is regenerated or selected among alternatives.
An invalid candidate, route drift, private-evidence leak, substantive failure
or semantic indeterminacy stops the study. A response-free Opus transport
failure may be retried within the registered reserve; all attempts remain in
the ledger.

## Measurement

Each dialogue receives the same four logical Opus assessments used in the
pilot: tutor v2.2, learner v2.2, dialogue v2.2 and extended acting quality. The
acting assessment is transported as summary and per-turn packets, for five
physical packets per dialogue and 90 planned packets total.

The primary endpoint is the matched-pair change in the **resistant-learner
performance composite**, the mean of:

- semantic nonrepetition or surprise; and
- character adherence.

The supportive encounter composite is the mean of overall transcript quality
and successful pedagogy. Semantic adjudication is primary; lexical difference
is auxiliary. Unsupported evidence assertions are counted from the per-turn
quality assessment.

The mechanism replication gate passes only if all of the following hold:

1. the mean primary matched-pair improvement is at least +0.5 on the 1–5 scale;
2. at least six of nine pairs are non-negative and at least five are positive;
3. at least two of the three learner routes have a positive mean primary
   difference;
4. no scaffold dialogue is semantically indeterminate; and
5. no scaffold learner turn makes an unsupported evidence assertion.

The stronger main-text paper gate also requires a supportive encounter mean
improvement of at least +0.25, at least one positive primary pair in every
world, and no world-level mean primary decline. Failing that gate leaves the
result suitable only for an exploratory methods appendix or a negative result.
Thresholds will not be changed after launch.

## Attempt ceiling

The hard ceiling is **396 total attempts**:

- 288 maximum generation attempts: 18 dialogues × eight learner and eight Sol
  calls;
- 90 planned Opus assessment packets; and
- 18 response-free Opus retry attempts.

The shared paid-study contract stops before attempt 397, uses a create-once
private destination, records an append-only ledger and seals either completion
or the first non-recoverable failure.

## Claim boundary

The confirmatory contrast is scaffold versus baseline within matched
model/world blocks. The study may support a bounded claim about this simulated
learner mechanism across these three worlds and routes. It cannot establish a
general model ranking, a causal effect of abliteration, human learning,
human-learner validity or deployment readiness. Model-level means and speed
remain descriptive because the Luna and Qwen routes differ.

## Step log

- 2026-09-02 — User requested the replication and asked that its steps be
  tracked in this Markdown note.
- 2026-09-02 — Design fixed at 18 dialogues, nine matched mechanism pairs,
  three unseen worlds, three learner routes, one frozen scaffold, independent
  Opus assessment and a 396-attempt ceiling. Model activity inactive; 0/396
  attempts used.
- 2026-09-02 — Zero-call preflight passed. The 38-world derivation-quality
  audit passed; all 18 learner requests and 24 tutor release-boundary requests
  passed prompt and privilege audits; 90 assessment packets assembled; 79
  focused tests passed; and the workplan validated 590/590 items. No provider
  was contacted and the create-once preview contains six swimlanes for each of
  the three worlds.
- 2026-09-02 — Pre-launch review caught a mismatch between the replication's
  30 assessment packets per world and the shared scorer's 18-packet batch
  limit. The runner now submits two fixed 15-packet batches per world—baseline
  and scaffold—without changing the study, rubrics, prompts, models or total
  ceiling. The full 79-test selection and a fresh 18-dialogue/90-packet dry run
  passed after the correction. Model activity remains inactive; 0/396 attempts
  used.
- 2026-09-02 — PR #938 passed all required CI checks and was merged to `main`
  at launch commit `7e502650e0966c048ac7add924bab9b7c235a0dd`. The user's
  direct replication instruction and explicit merge approval were recorded in
  the signed GO note. Model activity remains inactive; 0/396 attempts used.
