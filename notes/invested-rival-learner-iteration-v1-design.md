# Invested-rival learner iteration v1

Status: ready for launch

## Question

Can a small, behavior-only progression scaffold make a direct learner model
play an invested rival as a changing person rather than a repetitive evidence
auditor, and does the frozen scaffold transfer from Luna development to normal
and abliterated Qwen on a held-out contemporary inquiry?

## Two-stage design

### Stage 1: Luna-only development

Two Luna dialogues use the Rowan Flat leak world, Sol as tutor, no superego,
and the same eight-exchange maximum.

1. `D1` adds explicit working-belief continuity: Alex must begin by backing the
   shower account, state a consequence that would follow, and keep or revise a
   live position as public evidence changes.
2. `D2` keeps that scaffold and adds active move progression: a turn should
   defend with a prediction, offer a rival causal reading, draw a
   discriminating consequence, concede or revise, or synthesize and close. It
   should not repeat the same move on adjacent turns without materially new
   evidence, and it should not merely ask for the next record.

Both mechanisms are fixed before launch. `D2` is the mechanism carried into
Stage 2 regardless of which development dialogue scores better. Stage 1 is
engineering development, not confirmatory evidence and not a model
comparison.

### Stage 2: frozen held-out comparison

The `D2` scaffold is applied without alteration to one new dialogue each from:

- Luna (`codex.gpt-5.6-luna`, medium effort);
- normal Qwen (`mlx-community/Qwen3.8-27B-4bit`); and
- abliterated Qwen (`Qwen3.8-27B-Uncensored-MLX/4-bit`).

All three receive the same held-out group-document inquiry, character brief,
public proof schedule and Sol tutor (`codex.gpt-5.6-sol`, medium effort). There
is no learner or tutor superego. Histories may diverge naturally and no valid
output is regenerated or selected among alternatives.

The held-out scene is `world_034_groupwork_flag`. It is not used during Luna
development. Casey, the group lead, initially backs the claim that Jae inserted
the flagged paragraph and has a social stake in not retracting that accusation
without a concrete reason.

## Prompt and evidence boundary

The learner receives only the public dialogue, a behavior-only character
brief, its own short continuity note, and the progression scaffold. It receives
no score, threshold, future clue, hidden answer, proof path, model comparison,
development transcript, or other arm's output. The scaffold elicits a live
hypothesis and different kinds of evidential moves; it does not script the
learner's words or require disagreement, concession, or eight turns.

The deterministic public-proof controller remains the only owner of authored
scene evidence. Sol receives only evidence due on that turn and the public
inference it can support. Practical agreement is not treated as understanding.

## Measurement

Every one of the five dialogues receives the same four logical Opus 5
assessments: tutor v2.2, learner v2.2, dialogue v2.2 and extended acting
quality. Acting quality is transported as separate summary and per-turn
packets, so each dialogue uses five physical assessment packets.

The report keeps overall transcript quality, successful pedagogy, semantic
nonrepetition or surprise, and character adherence separate. Semantic
adjudication is primary. Lexical difference is auxiliary and a differently
worded repetition still counts as repetition. An indeterminate semantic
assessment stops the study rather than being replaced.

## Ceiling and stopping

The hard ceiling is **110 paid attempts**:

- at most 80 dialogue calls: five dialogues times eight learner and eight Sol
  tutor calls;
- 25 Opus assessment packets: five per dialogue; and
- at most five retries for response-free Opus transport failures.

Natural dialogue closure can reduce the generation count. The create-once
destination, shared run ledger and admission contract stop before attempt 111.
A substantive failure, a locally returned invalid candidate, route drift,
input drift or exhausted retry reserve stops the study. A response-free Opus
failure may be retried within the reserve; every attempt is preserved. No valid
dialogue or assessment is rerun.

## Decision and claim boundary

The practical decision is whether the frozen progression scaffold produces a
recognizable initial commitment, evidence-sensitive movement, fewer semantic
repetitions and sustained character on the held-out scene. The single held-out
dialogue per model is bounded engineering evidence. It can reveal affordances
and failure modes worth pursuing; it cannot estimate a general model-family or
abliteration effect, establish human learning, or support deployment claims.
