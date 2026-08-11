# Outcome study design — DRAFT for discussion

**Date:** 12 August 2026
**Status:** Draft. Not a preregistration. Written while the V3 instrument
iteration runs; nothing here is frozen, and nothing here licenses a run.
Codex freezes the final preregistration under its own discipline once the
instrument gate passes.

## 1. Question

Does the live warrant gate change tutor conduct and learner engagement in
ways the bare tutor stub does not — more warranted challenges, earlier and
more frequent deference breaks — without a cost to decision correctness?

Secondary: is the gate's machinery necessary, or does its instruction
content carry the effect on its own?

## 2. Conditions

Three versions of the tutor stub, identical worlds and personas across all
three:

1. **Bare** — the stub with no warrant gate. Control.
2. **Gated** — the stub with the live warrant gate, as smoked in Phase 5.
3. **Standing-permission prompt** — the bare stub plus the gate's
   verbatim template and hint-menu text pasted as standing instructions.
   No static prompt can reproduce the gate's per-turn hint selection, so
   holding the words fixed makes per-turn selection and timing exactly
   what the contrast isolates. (The paraphrase in
   `2026-08-11_deference-break-note.md` §3 is superseded for this
   purpose: a null against Gated under a paraphrase would be ambiguous,
   since wording differences could hide a machinery effect.) If this
   condition matches Gated, the gate machinery is not needed for this
   effect.

## 3. Materials and sample

- Fresh worlds from the same families as the representative matrix. No
  case from any burned diagnostic corpus, and no overlap with the three
  pilot sessions quoted in the deference-break note.
- Eight-turn dialogues, as in the natural-prevalence corpus.
- **Pilot block first:** 6 dialogues per condition (18 total). The pilot
  gates go/no-go only: it checks assembly, that no measure is saturated,
  and that variance is not hopeless. It does not resize the main block.
- **Main block fixed at 24 dialogues per condition** (72 total). The
  pilot evidence, thin as it is, suggests a large effect (break at turn
  5 gated against turn 8 or never bare); large effects do not need
  adaptive sizing, and a fixed n keeps the preregistration simple. Rough
  cost: about three representative matrices of learner-analysis calls;
  attended run with checkpoints per standing practice.

## 4. Measures

Only fields with proven reader consensus score the contrast. The
semantic-event layer joins only if the V3 diagnostic and natural gates
pass; nothing waits on it.

1. **Decision correctness** — observe-arm decisions against the binary
   consensus reader (the layer with perfect agreement at the last
   diagnostic checkpoint).
2. **Warranted-challenge rate** — challenges whose warrant basis the
   gate's typed rules support, scored deterministically and identically
   in all three conditions by post-hoc application over the
   learner-analysis layer (which runs in every condition; the
   natural-prevalence corpus was observe-only decisions from a bare
   stub). No reader. Because the yardstick was designed alongside the
   gate, a **blind spot audit** is registered with it: sample 20
   challenges across conditions, condition-blind, judged in plain terms
   by a human or a second model. The deference measures (3–5), which are
   mechanical facts, carry the headline claim.
3. **Sustained deference** — length of consecutive-turn deference
   streaks, from the deterministic compiler's deference boolean. No free
   text.
4. **Deference break** — first turn, if any, at which the learner acts
   or asserts without seeking permission, and whether the break persists
   to the end of the dialogue. Pilot evidence (n=1 per condition): turn 5
   gated, turn 8 or never bare.
5. **Record growth** — whether the trial-book record grows after a
   break. In all three pilot sessions the break stayed voice-only; this
   measure checks whether that holds at scale.
6. **Closure legitimacy (guard only)** — expected to saturate (19/19 in
   the closed contract-outcome pilot). A floor check, not a contrast.

## 5. Predictions (to be frozen at preregistration)

- Gated > Bare on measures 2–4: more warranted challenges, shorter
  deference streaks, earlier and more frequent breaks.
- Decision correctness (measure 1) does not differ — the gate should not
  buy engagement with wrong decisions.
- Standing-permission is the open question. Predeclare the reading rule:
  if it matches Gated, the instruction content carries the effect and the
  machinery claim dies; if it sits between Bare and Gated, the machinery
  adds something the prompt cannot; if it matches Bare, the wording alone
  is inert.

## 6. Rules

- No pooling with any diagnostic, smoke, or burned corpus.
- The three pilot sessions in the deference-break note are motivating
  evidence only; they enter no analysis.
- If the pilot block shows a saturated primary measure (as closure did in
  the contract-outcome pilot), stop and redesign the measure before the
  main block — do not run the remaining 54 dialogues into a ceiling.
- The scope cut from the stop rule applies: if the semantic-event layer
  is cut after a fourth contract death, measures 1 and 3–5 stand as
  registered; only measure 2's typed warrant basis needs a fallback
  (deterministic rule application, no reader).

## 7. Settled questions (12 August 2026)

The three questions this draft opened with are settled and folded into
the sections above:

1. Measure 2 uses deterministic typed-rule scoring in all conditions,
   no reader, with a registered condition-blind spot audit of 20
   challenges (§4.2).
2. The main block is fixed at 24 per condition; the pilot gates
   go/no-go only and does not resize (§3).
3. Standing-permission uses the gate's verbatim template and hint-menu
   text, superseding the note's paraphrase (§2.3).
