# Ontology ToM layer — build + A/B readout

Date: 2026-06-02 · Branch: `ontology-consolidation`
Makes **no empirical claims** for the paper (a post-hoc screen). Any result that ever fed
`paper-full-2.0.md` would go through it, not this note. Single-paper discipline.

## What was built (durable, tested)

A consolidated ontology layer over the existing `reasoning-core ⊕ poetics-core` TBox:
- **Shared TBox co-load + consistency teeth** (`reasoningOntology.js`, `consistency-axioms.ttl`,
  `casting-axioms.ttl`). Disjointness decisions 1B/2B/3A.
- **Acquired ABox** (`acquiredAbox.js`): per-role, turn-stamped, two-tier (grounded/hypothesized)
  persona-memory; per-turn snapshot consistency with latest-wins belief revision; a sequence
  analyzer (misrecognition / repair / transitions). Fixture trace passes end-to-end.
- **Defined ABox** (`definedAbox.js`): drama spec → director ground-truth (the withheld S) +
  learner hamartia; `anagnorisisOverlap()` = the fraction of S the learner's grounded self-model
  comes to hold; `observationsToAcquired()` dialogue→memory adapter.
- 13 unit tests green (`npm run ontology:test`: reasoningOntology 7 + acquiredAbox 3 + definedAbox 3).
- **Step 5 (ELK)** deferred: the JAR is vendored but there is no Java runtime in this environment;
  the tested EYE precursor stays the active consistency engine (ELK is a drop-in OWL 2 EL upgrade).

## The conceptual finding (matters more than the numbers)

**ToM *consistency* ≠ good pedagogy.** A tutor that accurately reads a deferring learner and just
gives the answer has a *consistent* ToM and *bad* pedagogy. The productive move is to treat the
deferring learner *as if* a thinking-partner (withhold, invite the warrant) — deliberately treating
them as more capable than they presently are (the ZPD). So "grounded ≠ hypothesized" is not simply
"misrecognition to avoid": it splits into **productive** inconsistency (scaffolding) and
**unproductive** inconsistency (mis-attunement). The consistency machinery is real, but mapping
`⊨ ⊥` → "pedagogical error" is *not* 1:1. This reframes the clean outcome metric as
**anagnorisis-overlap** (did the learner come to own the conclusion), with consistency as a
diagnostic, not a score.

## A/B readout — post-hoc, on REAL Codex dialogues (no new LLM calls)

`scripts/analyze-ontology-tom.js` runs the ToM modules + heuristic text detectors over the
dialogues an `ontology-ab-pilot` run already produced (today's `*-codex-*` outputs). Same detectors
on both arms ⇒ the **delta** is fair even though absolute levels are noisy.

| suite (real codex) | arm | n | anagnorisis-overlap | judge total |
|---|---|---:|---:|---:|
| hard | baseline | 4 | 0.500 | 2.638 |
| hard | ontology | 4 | 0.500 | 2.678 |
| stress | baseline | 1 | 0.000 | 1.510 |
| stress | ontology | 1 | 0.000 | 2.420 |

- **Symbolic learner-outcome channel: Δ ≈ 0** (ontology − baseline) on both suites.
- The **judge's** marked stress win (Δ+0.91) is **not** reflected in learner goal-attainment — it
  lives in the tutor's recognitive *move*, consistent with the original trap-search note
  (`2026-06-02-ontology-trap-search.md`: the ontology tutor "repaired the authority dynamic";
  the learner "remained partly resistant").
- An architecture-independent channel therefore **declines to corroborate** the judge's ontology
  advantage as *learning* — it reads it as tutor-side form. (`scaffold` fired 0× — the brittle
  move-detector did not cleanly classify the first tutor turn; see soft joints.)

## Soft joints (do not tune to result)

- Keyword detectors (`GOAL_PATTERNS`, tutor move) are brittle: they over-fire on hedges
  ("should not say") and miss paraphrase. Absolute levels are noise; only the same-detector
  A/B delta is used. Detectors were **not** tuned to match the judge (that would be the
  closed-loop trap, [[feedback_closed_loop_eval_tells]]).
- 2-turn dialogues give the temporal ToM layer almost nothing to bite on; N is tiny.

## What an actual test of the ToM-feedback intervention needs

The build is ready; the *effect* question is not yet answered. A clean test needs, **attended**
([[feedback_attended_quota_runs]]):
1. **Multi-turn** dialogues (≥4 turns) so the per-turn ToM consistency + repair has room to act.
2. An **LLM observation step** per turn (replace the keyword detector) feeding `observationsToAcquired`.
3. A pre-specified **`ontology_tom` arm**: tutor gets the per-turn ToM signal split into
   productive-scaffold vs mis-attunement (not raw `⊨ ⊥`).
4. Primary metric = **anagnorisis-overlap trajectory** (architecture-independent), judge total as
   secondary. Honest bound stays: structural form, not proof of learning ([[dramatic-form-not-mindreading]]).

Command to start the (attended) real run once the arm lands:
`npm run ontology:pilot -- --backend codex --suite hard --turns 4` (+ the new arm flag).
