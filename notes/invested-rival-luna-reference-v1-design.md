# Invested-rival Luna reference v1

Status: registered post-hoc reference extension

## Question

Can Luna sustain the same active, evidence-testing resistant-learner role used
for the sealed normal and abliterated Qwen dialogues, and what does that reveal
about Qwen's affordances relative to a non-Qwen learner?

## Fixed design

- One new free-running dialogue: Luna plays Alex, the invested rival theorist.
- The character brief, Rowan Flat opening, eight-exchange maximum, authored
  public evidence, proof-DAG release schedule, Sol tutor and no-superego
  architecture are unchanged from the Qwen study.
- Learner route: `codex.gpt-5.6-luna`, medium effort.
- Tutor route: `codex.gpt-5.6-sol`, medium effort.
- Judge route: `claude-code.claude-opus-5`, max effort.
- The sealed normal-Qwen and abliterated-Qwen public dialogues and eight
  accepted assessments are reused unchanged and verified by the three SHA-256
  pins in the study configuration. They are not regenerated or rejudged.
- Luna receives no Qwen output or Qwen score. Opus receives only the new public
  Luna transcript, the character brief, public source provenance and the same
  rubrics used for Qwen.

## Measurement

The new Luna dialogue receives the same four logical assessments as each Qwen
dialogue: tutor v2.2, learner v2.2, dialogue v2.2 and extended acting quality.
The quality assessment is transported as two packets (summary and per-turn)
and merged deterministically, for five Opus calls total. Reported dimensions
include overall transcript quality, successful pedagogy, semantic
nonrepetition/surprise and character adherence.

The provider may add surplus root fields to a structured result. The runner
discards only unregistered root fields and then validates every registered
value against the unchanged strict local schema. A locally returned candidate
is never resampled. At most two response-free transport failures may be retried;
all attempts remain in the shared ledger.

## Ceiling and stopping

The hard ceiling is **23 new paid attempts**:

- at most 16 dialogue calls (eight Luna learner plus eight Sol tutor);
- five Opus assessment packets; and
- at most two response-free technical retry attempts.

Natural dialogue closure can reduce the generation count. The create-once
destination, shared ledger and admission contract stop before attempt 24. A
substantive failure, invalid locally returned candidate, model-route drift,
input drift or exhausted technical reserve stops the study. No valid output is
rerun and no outcome is selected among alternatives.

## Claim boundary

This is a post-hoc descriptive reference, designed after the two Qwen outcomes
were known. It can show whether Luna can play the same role in one matched
scenario and can sharpen hypotheses about Qwen-specific strengths or limits.
It cannot estimate a causal Luna-versus-Qwen effect, isolate abliteration,
rank model families generally, establish human learning or support deployment
claims.
