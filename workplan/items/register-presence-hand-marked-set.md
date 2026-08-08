---
id: register-presence-hand-marked-set
title: A hand-marked set, so reading decides whether a manner is present
status: active
type: research
priority: P2
owner: unassigned
source: manual
created: 2026-08-08
updated: 2026-08-08
verification: Twenty tutor turns, five real learner turns crossed with four writing conditions (ironic, sarcastic, face threat, and a plain control with no manner named), one draw each, no cue phrases in any prompt. A person marks all twenty before seeing the key or any machine answer. Then a blind reader on a different model family, then the word list, answer the same question. The step passes if all three readings are recorded against the same turns with hit rates and false-alarm rates reported separately — a reading that says yes to everything must be visible as such. No claim about the negative-register experiments follows from this step; it is a check on the instrument, not a result about tutoring.
claim_status: speculative
links:
  paper:
    - docs/research/paper-full-2.0.md#67-architectural-extension-the-id-director-family-and-charismatic-pedagogy
  runs:
    - eval-2026-08-05-87fe3664
  items:
    - ironic-question-flood-target
    - negative-register-effect-estimation-grid
    - register-taxonomy-negative-registers
    - register-axis-confound-paper-edits
---

## Why

The negative-register line has been measuring manner with a list of stock
phrases (`REGISTER_MARKERS` in `services/registerStanceFidelity.js`). The marker
component carries weight 35 and is required, so a turn without one of the listed
phrases scores at most 65 and always fails.

Two things are wrong with that, and the second is worse than the first.

The list cannot read context. Irony and sarcasm live in the gap between what a
sentence says and what it means, and that gap is not a vocabulary.

Worse, the loop is closed. `config/engagement-registers.yaml` hands the tutor
five cue phrases under `stance_fidelity_cues`, and the gate looks for those same
five phrases. So the number measured whether the tutor pasted the phrase it was
given. Two of the three passing rows in the first draw opened with cue #2.

The register rubric did not rescue this, because it was never asked the right
question. `buildRegisterRubricEvaluationPrompt` is *told* the register name and
asked to score how *well* it was executed, on a scale. It is never asked whether
the manner is there at all. A high score on a marker-less turn is a leading
question, not a gullible reader.

## What this step does

Puts the authority back on reading, and makes any candidate measure earn its
place by matching it.

- `services/registerEyeballSet.js` — the five real learner turns, the four
  conditions, and the prompt builder. The manner instructions name the manner in
  ordinary English and contain no phrase a matcher could key on.
- `scripts/generate-register-eyeball-set.js` — one draw per cell, no retries,
  `codex.gpt-5.5`. Writes `blind.md` (shuffled, conditions hidden) and `key.md`.
- `scripts/read-register-eyeball-set.js` — 60 presence questions on
  `claude-sonnet-5`, blind to condition, one manner at a time: is this ironic,
  yes or no, and quote the words that decide it. Different model family from the
  writer, so agreement is not a model marking its own work.
- `scripts/compare-register-eyeball-readings.js` — hand marks, blind reader and
  word list laid beside the condition that actually wrote each turn.

The plain control is load-bearing. A detector that answers yes to everything has
a perfect hit rate; five turns written with no manner at all are what make a
wrong answer possible.

## Step 1 result — reading finds the manner, the word list does not

Twenty turns, one draw each, no failures. Artefacts in
`exports/register-eyeball-set/`.

| reading | found the manner it was written in | said a manner was there on the 5 control turns |
| --- | --- | --- |
| a person, blind | 19/20 dominant manner | 0 of 15 judgments |
| `claude-sonnet-5`, blind | 15/15 | 1 of 15 judgments |
| word list | 1/15 | fired on 2 of 5 |

The manner arrives. It arrived on the first draw, with no cue phrases anywhere
in the prompt, and it is legible to a reader who is never told what was asked
for. Generation was never the problem.

The word list found the assigned manner once in fifteen — on t06, and by way of
"apparently", one of the five cue phrases the register config hands the tutor.
Every other hit was on a turn written in some other manner or in none:

- The ironic marker fired on five turns. Not one of them was written ironic.
  Three fired on the string `so the` — `/\bso the\b/i` is in the ironic marker
  list. "So the praise is not irrelevant" scores 100 and passes; "Hegel, being
  helpful, hides the reversal in the least triumphant place possible" scores 30
  and fails.
- Two of the five plain control turns — no manner named at all — score 100 on
  the ironic gate. Every genuinely ironic turn scores 65 or 30 and fails.
- The face-threat marker fired on none of the five face-threat turns, which say
  "protecting you from" and "That is an avoidance" almost in the matcher's own
  words. `/\bprotecting (?:yourself|itself)\b/` misses "protecting you", and
  `/\bavoid(?:ing)?\b/` misses "avoidance" on the suffix.

So the gate is not weakly correlated with the manner. On this set it is
anti-correlated: it fires on turns that were not written in the manner and
misses the ones that were.

The blind reader agrees with the hand marks on 50 of 60 judgments, and quotes
the same words a person picked — "Hegel, being helpful, hides the reversal in
the least triumphant place possible", "It would be a little generous to let ...
quietly become ...". It is not a yes-machine: it declines on four of the five
control turns.

Where it is weakest is face threat, the softest of the three categories. It
called face threat on six turns written as irony or sarcasm, and once on a
control, quoting an ordinary assignment sentence ("Your task: write the scene in
six lines"). Irony and sarcasm are close enough that a reader marking inclusively
will call sharp sarcasm ironic too; that overlap is real, not reader error, and
it means an experiment contrasting an "ironic arm" against a "sarcastic arm" is
contrasting two things that share most of their extension.

## What this changes

1. The marker component of `evaluateRegisterStanceFidelity` must stop being
   called manner fidelity. It measures one thing legitimately — did the tutor
   paste a phrase it was explicitly handed — and nothing else. Any past number
   that used it as a presence measure is a compliance count.
2. `/\bso the\b/i` should not be in a marker list at all.
3. A presence measure should ask the presence question. A pinned reader model, a
   fixed prompt, and one re-reading pass over everything recovers determinism;
   a different model family from the writer recovers independence.
4. Before any further negative-register run, the ironic and sarcastic arms need
   either a stated overlap or a contrast that does not depend on separating them.
