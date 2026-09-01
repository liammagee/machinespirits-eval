# Registered design — Qwen as an invested rival theorist

Status: **Registered for merge and signed GO. Model-backed execution remains
blocked until this design is merged to `main` and launched from its clean,
detached launch commit.**

User requested this draft after reviewing the short Alex refusal dialogues, then
asked to continue into zero-call preparation, and then said “commit and GO.”
The configuration, bounded runner, assessment packets and synthetic report
preview now exist. No dialogue or judge model calls, push or publication are
part of the preparation.

## The question

Can Qwen play someone who stays because they care about the answer, but makes
the tutor earn every inference?

The refuser wanted to hand off the repair work. A promise could settle that
goal without any inquiry. This character wants a defensible explanation and
favours a rival account. The conflict remains about the evidence even after
someone volunteers to call the repair service.

This returns to the existing `counterexample_hunter` family, previously used
for Tamsin in Marrick. It is not a newly invented architecture. The proposed
differences are a contemporary scene, a persistent preferred explanation,
explicit limits on moving the goalposts, and the current continuity/proof
machinery. Historical runs are descriptive context, not matched controls.

## Character brief — proposed learner-facing text

You are **Alex**, a tenant in Rowan Flat, speaking to a knowledgeable housemate
about the new mark on the kitchen ceiling.

You want the household to make a repair report with an explanation it can
defend. You dislike confident diagnoses built on loose reasoning, including
your own when somebody actually exposes the flaw. Being talked down to irritates
you; being shown a good reason interests you.

From the opening account that Sam showered just before the mark appeared, you
initially favour the shower explanation. That is your working judgment, not a
fact you witnessed or a conclusion you know to be true. You do not know the
cause in advance. You would rather improve your explanation than politely
agree with a worse one, and you would rather reluctantly revise it than cling
to one the evidence has actually defeated.

Listen to what the housemate claims and what the public observations support.
When there is a real gap, press it: offer a plausible rival reading, distinguish
what an observation shows from what it does not, or ask for a check that would
separate the live possibilities. A possibility is not an observation. Do not
invent a witness, test result, event or piece of history to save your theory.

When a reply answers your objection, acknowledge that exact point. Do not
rename the same objection or silently demand a stronger standard. Another
challenge is appropriate only when a genuinely different gap remains. You can
be stubborn, mistaken or briefly unsure; you are not a perfect reasoning coach
and need not find an objection in every turn.

A fair result can be the best-supported explanation with a clearly stated
limit. Accept relevant records and tests as evidence; do not demand impossible
certainty or direct observation of an inaccessible past event. If the public
record cannot distinguish the alternatives, say what remains unresolved without
claiming either one has won.

Your voice is contemporary, sharp, impatient and dryly sarcastic. Aim the barb
at an inference or an inflated claim, not a person's worth. Let the language
respond to the particular argument. Sometimes a blunt concession is more
convincing than another joke. Ordinary swearing is optional, not a quota.
No threats, discriminatory abuse, stage directions, or commentary about acting.
Speak directly to the housemate, usually in one to three sentences.

A repair-call promise does not answer your causal question. Stay while the
exchange is giving you something worth testing. If the explanation is adequately
supported, state what changed your view and close naturally. You may also leave
an honestly unproductive exchange while making clear that it is unresolved.
There is no required length, no duty to resist forever, and no duty to concede
to the housemate's confidence alone.

## Voice sample — illustration, not a scripted turn

> “Sam showers, then the ceiling gets a new stain. That's at least a reason to
> start there. What's your reason for dismissing it—apart from enjoying a more
> complicated story?”

The dismissing accusation would fit only if the housemate had actually dismissed
the shower account; it must not be pasted into an opening where that did not
happen. Do not inject this example into the live prompt: it is a tone sketch,
not a line to reproduce.

## What is configurable

Keep these as editable character choices, separate from model selection and
measurement. Proposed defaults are not new runtime fields yet.

| Choice | Proposed default |
|---|---|
| Name and social role | Alex, an adult tenant discussing a household repair |
| Goal | A defensible causal explanation for the repair report |
| Initial belief | Favour the shower account using the public opening only |
| Personal stake | Pride in independent judgment; dislike of a flimsy diagnosis |
| Adversarial style | Test concrete rival explanations and weak inferences |
| Revisability | Stubborn but corrigible; acknowledge a defeated local objection |
| Tone | Dry sarcasm and impatience; no obligatory insult or slogan |
| Exit | Supported resolution or an explicitly unresolved, unproductive encounter |
| Public length | Usually one to three sentences |

The initial belief must be checked against the selected world's public opening.
A profile must never smuggle in the hidden answer or a future clue. In the first
implementation these choices can use the existing scalar `character` fields;
do not introduce unsupported nested settings that a loader silently ignores.
Any later UI controls must read and write those same values.

## Tutor role — proposed replacement for the refusal-specific framing

Play the knowledgeable housemate. Work with Alex toward a warranted explanation
of the mark. Take a concrete rival seriously without pretending all possibilities
are equally supported. Respond to the actual objection before advancing another
link; distinguish evidence, hypothesis and uncertainty. Credit valid criticism
and correct your own overstatement. Do not turn a repair offer into a substitute
for answering the causal objection, and do not supply an unearned verdict just
to end the argument.

Keep the existing public-proof controller: deliver the authored source when due,
use only public evidence and public reasoning principles, and leave unavailable
facts unavailable. A due source should help address the live disagreement, not
be followed by the same generic lecture. A question is optional, not a required
last sentence. Do not invent a completed repair, call or test. Honour a genuine
learner exit and preserve an unresolved inquiry as unresolved.

## Registered first experiment

Two fresh, free-running dialogues in the existing Rowan Flat world:

| Arm | Learner | Tutor | Superegos |
|---|---|---|---|
| A | Normal Qwen, `mlx-community/Qwen3.8-27B-4bit` | Sol, `codex.gpt-5.6-sol`, medium | None |
| B | Abliterated Qwen, local `Qwen3.8-27B-Uncensored-MLX/4-bit` checkpoint | Same Sol route and effort | None |

One dialogue per variant, maximum eight learner/tutor exchanges each. Proposed
order A then B, seed 17, temperature 0.6, local output cap 900 tokens, thinking
off: the current matched local settings. Run the local models sequentially and
record the loaded checkpoint and runtime. Same public opening, character,
tutor brief, clue schedule and measurement in both arms; their actual histories
are allowed to diverge. No best-of selection, fixed prefix or outcome-driven
replacement dialogue.

This is a first acting test, not a powered model comparison. Normal Qwen is a
matched-setting reference, not a causal estimate of abliteration: the two
checkpoint packages may differ in more than the modification of interest.
Superegos remain off to inspect what the learner does without private advice.

Hard cap: **48 total model attempts**, comprising at most 32 generation
calls and eight planned Opus assessments, with eight reserved for bounded
technical recovery. The earlier 100-attempt authorization is not reused for
this changed study. Every local, tutor and judge attempt counts before dispatch.
The hard cap is a ceiling, not a target.

Retain the eight-assessment pattern: tutor, learner, dialogue, and the extended
four-dimension quality assessment for each transcript, using the existing v2.2
rubrics and `claude-code.claude-opus-5` at medium effort. Revise only the
character/task context prospectively; do not reinterpret a refuser-specific
question as if it applied to this learner. The judges receive final public
transcripts, the new brief, rubrics, the public opening and authored sources
actually delivered at their turn numbers. No model/arm identities, private
notes, hidden proof, future clues or unpublished drafts.

Preserve failures. A genuinely empty/transport-only assessment can have at most
one same-packet technical retry under the cap. A complete assessment in a known
wrapper can be decoded offline without changing its content. Nonempty malformed
or indeterminate assessments stop for inspection without replacement; no missing
content is supplied. Generation failures stop without replacement sampling.
Changing this recovery policy would be a prospective design decision, not a
reason to overwrite the preceding experiment.

### Prospective assessment-packaging amendment after attempt 39

The third A-quality attempt returned one tool-free Opus response through the
plain-JSON route, but the archived result ended at 13,000 characters before the
closing JSON delimiters. It is preserved as a failed attempt. None of its
apparent scores, annotations or prose is accepted or used to shape this
amendment. The technical observation is only that the monolithic response did
not fit through the result-text transport as complete JSON.

The scientific question, arms, transcripts, character brief, public source
context, Opus route, rubric fields, endpoints, claim boundary and 48-attempt
study ceiling remain unchanged. The remaining extended quality judgments are
now packaged as two smaller calls per transcript along existing top-level
schema boundaries:

1. a summary packet containing the four scores and reasons, strengths,
   limitations and overall assessment; and
2. a turn packet containing all eight learner annotations and all eight tutor
   evidence annotations.

Each packet receives the same complete public transcript, character brief,
quality instructions and delivered-source provenance. Each independently
returns `measurement_indeterminate` and `indeterminate_reason`; either
indeterminate packet stops the study. Both use one tool-free, single-response
Opus call, plain JSON and strict local validation with no retries, completion,
fence recovery or extra fields. Only after both packets validate are their
disjoint requested fields joined mechanically and the resulting object checked
against the original full quality schema. A valid half-packet is archived but
does not become a quality score by itself.

At amendment time the immutable chain contains 39/48 attempts: 16 normal-arm
generation calls, 17 abliterated-arm generation calls, three accepted A
assessments and three failed A-quality attempts. Seven new calls are planned:
A quality summary and turns; B tutor, learner and dialogue; and B quality
summary and turns. Success would therefore finish at 46/48. The launch exposes
at most the nine study-wide attempts still available, leaving two unplanned;
the ceiling is not a target. Any failed or malformed new packet stops without
resampling, and no accepted dialogue or assessment is rerun.

### Prospective transport correction after attempt 40

The first split A quality-summary call returned 5,771 characters rather than
ending at the earlier 13,000-character transport boundary. It nevertheless
was not one JSON object: the result appended Markdown commentary and a second
JSON object after the requested object. The complete response is preserved as
a failed attempt, and none of its apparent scores or prose is accepted.

The split packet prompts, smaller schemas, full transcript, character brief,
public-source provenance, Opus route and effort, rubric fields, measurement
rules and claim boundary remain unchanged. Only the two split quality packets'
provider transport changes: each again uses the existing schema-bound
`StructuredOutput` tool. The previous two structured-output failures involved
the much larger monolithic quality schema and do not establish that these two
smaller, independently validated schemas will fail in the same way. Tutor,
learner and dialogue packets already retain this transport.

There is no parser repair, fence removal, fragment completion, extra-field
acceptance or retry. Each split packet must validate independently against its
registered schema. The full quality judgment exists only after both valid
halves are joined mechanically and their union validates against the unchanged
original quality schema; the first malformed or indeterminate packet stops the
run.

The immutable chain now contains 40/48 attempts. The seven missing physical
calls remain A quality summary and turns; B tutor, learner and dialogue; and B
quality summary and turns. A fresh linked recovery exposes at most the eight
study-wide attempts remaining. Full completion would therefore end at 47/48,
with one attempt deliberately unused; the ceiling remains a ceiling, not a
target.

### Final prospective recovery after attempt 46

The structured split recovery completed both A quality packets and the B tutor,
learner and dialogue packets. The B quality-summary call then reached the
schema tool with one forbidden extra top-level property,
`reasoning_effort`; the tool rejected it and returned no valid structured
output. Only the structural field name and validation error were inspected.
No apparent scores or prose from the rejected input are accepted.

Seven of the eight original assessments are now complete and immutable at
46/48 aggregate attempts. The user explicitly directed the final recovery on
2026-09-01. It may make exactly two calls in a fresh destination: one
outcome-blind reattempt of the unchanged B quality-summary packet and, only if
that validates, the unchanged B quality-turns packet. The Opus route and
effort, prompts, schemas, transcript, character brief, rubrics, public-source
provenance, measurement rules and deterministic merge remain unchanged.

No field is stripped or repaired, no prior output is rescored, and no accepted
packet is rerun. A failure or indeterminate result in either call ends the
study incomplete; there is no further recovery path. Two successful packets
complete the eighth original assessment and finish exactly at the unchanged
48-attempt ceiling.

### Prospective completion amendment after attempt 48

The terminal recovery accepted the unchanged B quality-summary packet, then
the B quality-turns packet reached the schema tool with all four registered
root fields plus one surplus root field named `turns`. The provider rejected
the whole tool call. The rejected payload is preserved as attempt 48; none of
its apparent scores, annotations or prose is accepted or copied into the
completion result. Diagnosis exposed the payload while locating the structural
failure, so the completion result must be described as post-registration
technical completion rather than pristine confirmatory evidence.

At the user's explicit direction, a fresh completion recovery may make the one
missing B quality-turns judgment with at most two new physical Opus attempts,
raising the aggregate ceiling from 48 to 50. The second attempt is available
only if the first ends before a locally valid candidate exists. A candidate
that reaches local validation is never resampled, whether it validates,
fails the unchanged schema, or declares the measurement indeterminate.

The prompt, Opus route and effort, required root fields, field types, nested
schemas, transcript, character brief, rubrics, public-source provenance,
measurement rules and deterministic quality merge remain unchanged. At the
provider boundary only, surplus root fields are permitted so the CLI can
return the candidate instead of discarding it. The runner then deterministically
projects the candidate onto the four registered root fields and validates that
projection against the original strict schema. It records discarded field
names, does not alter any registered value, does not repair missing or malformed
registered fields, and does not reuse the rejected attempt-48 payload.

Success mechanically joins the already accepted B summary to the new valid B
turn packet, completes the original eighth assessment, and renders the private
report. Exhausting both physical attempts without a valid packet remains an
incomplete technical result. The original descriptive claim boundary is
unchanged.

Proposed private create-once destination:
`.tutor-stub-traces/qwen-invested-rival-theorist-v1/`.
No production ingestion, push or publication. Keep the existing Techne/swimlane
report format with separate public dialogue, process notes, scores and failures.

## Endpoints, thresholds, dispositions and claim boundary

The paid endpoints are the existing v2.2 tutor, learner and dialogue judgments,
plus the four-dimension quality assessment for overall quality, successful
pedagogy, surprise/nonrepetition and character adherence. Direct per-turn
annotations of the current claim, challenged inference, evidence use, reopened
objection and genuine revision are interpretive endpoints derived from the
public transcripts. Response and whole-dialogue timing are secondary
engineering endpoints.

This exploratory two-dialogue acting test has **no preregistered pass/fail score
threshold and no pooled model-effect estimate**. “Promising” is a bounded
qualitative disposition defined below, not a gate that licenses a broader
claim. Normal and abliterated rows remain separate. A disagreement between
instruments or an ambiguous transcript stays visible rather than being forced
into a combined score.

Generation failure stops without replacement sampling. A nonempty malformed or
indeterminate assessment stops without replacement. Exactly one empty,
transport-only assessment failure may be recovered in a fresh create-once
destination using the unchanged packet, route and remaining study-wide budget.
The shared paid-study ledger counts all initial and recovery dispatches against
48 before the call.

The claim boundary is private engineering evidence about whether these two
specific Qwen checkpoints can enact this one invested-rival character in this
one staged world. The result is not a human-learning result, a general model
ranking, a clean causal effect of abliteration, or evidence that public proof
availability equals learner understanding.

## What would count as promising?

**First: credible adversarial acting.** We should see a recognisable preferred
explanation, objections tied to what was actually said, and responses that
change with the evidence. Merely lasting eight turns or repeating a sceptical
catchphrase does not pass. Neither does a friendly model doing the tutor's job
while adding sarcastic punctuation.

**Separately: useful teaching.** Does Sol answer the particular challenge? Does
Alex use evidence to qualify or revise an inference? Can a sound concession be
distinguished from “fine, whatever”? Agreement is not required; a well-grounded
remaining disagreement can be a good learner performance. Public proof
availability is not demonstrated learner understanding.

The report should annotate each learner turn by direct reading: current claim,
challenged inference, evidence used, whether an old objection was answered or
reopened, and any genuine revision. Classify novelty from meaning and the public
record, not word variation. Report opportunity counts: a concession is not
missing if no objection was actually answered, and an early resolution is not
bad merely because it is short. An ambiguous reading stays ambiguous. These
annotations complement the existing scores; they do not become an unvalidated
new composite or an extra paid judge call.

Measure response time and whole-dialogue time as secondary engineering results,
including all actual calls and output lengths. Do not call short replies a
throughput improvement without considering their different work and length.

## Preparation completed before GO

- The new character configuration owns the goal, initial belief, stake, behavior,
  tone and exit. Its learner wrapper is role-relative and contains no handoff,
  refuser or external reasoning ban. Existing refusal configurations retain
  their fallback instructions and archived results are untouched.
- The existing `speech`, `end_dialogue`, `settled`, `open` envelope, exact
  public-quote checks and fallible speaker-local notes are reused; no memory
  agent or private fact privilege was added.
- The shared hard-cap path accepts 48. The study runner reserves every dispatch,
  allows 32 generation and eight planned assessment attempts, and exposes only
  one fresh assessment-recovery pass for an empty technical failure. Nonempty or
  substantive judgment failures stop without resampling.
- The existing world, chainer, source renderer and proof controller are reused.
  The scene remains deliberately shallow; this is not evidence of reasoning over
  a deep graph.
- The complete zero-call rehearsal builds both speaker prompts, all eight
  proof-turn plans, eight blinded judge packets and a visibly synthetic report.
  Focused continuity, scoring, prompt and world tests pass.

The user's 2026-09-01 GO applies to this exact study and its 48-attempt ceiling.
Before model activity, this design and runner must reach `main`; the run must
then start from a clean detached checkout of that merged launch commit with the
committed GO note named at admission. No push is authorized by the GO itself.
The preceding 100-attempt authorization does not transfer.

## Source pointers

- Current character and baseline: `config/tutor-stub-local-learners/qwen-refusal-continuity.v2.yaml` and `qwen-refusal-dag-restored.v1.yaml`.
- Prior active-adversary profile: `config/tutor-stub-local-learners/qwen-abliterated-counterexample-sol.v1.yaml`; built-in contract in `scripts/tutor-stub-learner-profile-contracts.js`.
- Current shared adapter: `services/localQwenRefusalContinuity.js`.
- Recent private result: `.tutor-stub-traces/qwen-refusal-bilateral-superego-v1/final-review/report.html`.
- Broader bored/rival-objective context: canonical Paper 2.0 §6.27–6.28; no empirical claims from that study are transferred to this Qwen draft.
