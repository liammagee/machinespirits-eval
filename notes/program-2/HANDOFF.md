# Program-2 cross-thread handoff

Convention: append-only. The planning/theory thread adds dated items; the
executing thread integrates them and flips `status:` to `done` (with the
integrating commit SHA). Neither thread edits files the other has uncommitted
work in — this file is the channel. Check `git status` before touching
`PROGRAM-2-FINETUNE-PLAN.md` or `scripts/program2-*`.

---

## H1 (2026-07-18) — Base/instruct two-arm design

status: pending
rationale: `notes/program-2/2026-07-18-dispositional-executive.md` §8
(user-directed: "update the prereg to include the base/instruct arms")

The plan currently trains one instruct model. Revise to a two-arm design —
the instruct variant AND its base sibling of the same family (per the
in-flight model check: Qwen3.5-9B-Instruct and Qwen3.5-9B-Base), identical
LoRA data in both arms. This converts the iron-cage question (is the
alignment layer what resists the discipline?) into a controlled contrast:
base and instruct siblings share architecture and pretraining and differ only
in the preference layer.

Paste-ready revisions to `PROGRAM-2-FINETUNE-PLAN.md` (integrate around the
uncommitted model-selection edit already in the working tree; add a dated
revision log at file end):

**§5 Models and method — add:**

> **Variants (revision 2026-07-18): two arms per selected family.** Train the
> identical LoRA data into (a) the instruct variant and (b) its base sibling.
> Training order differs by construction: instruct → SFT, then conditional
> KTO; base → SFT first (for the base variant, our SFT *is* its instruction
> formation — an ego formed entirely from the corrected-practice corpus),
> then conditional KTO. Licensing updated accordingly: one SFT + one
> conditional KTO run **per variant** (≤4 frozen runs total; budget
> unchanged, still < US$50 at ≤9B LoRA scale).

**§7 Evaluation — add:**

> **Per-variant floors and request shapes (revision 2026-07-18).** The
> instruct variant takes the reconstructed request natively (system prompt +
> messages under its chat template). The base variant has no chat template:
> the same request is flattened to a transcript-style completion prompt, and
> that flattening template is itself frozen at Phase 2 — it is part of the
> instrument. Phase 1 measures each variant's untuned floor under its own
> shape (the base floor will likely be low and strange; that is a datum —
> everything SFT adds is visible against it). The blinded-quality gate
> applies per variant (predicted base-arm pathology: thin ego — executes the
> discipline, speaks poorly).

**§8 Phases — amend Phase 1 row:** floor covers both variants, each under its
own request shape.

**§9 Decision grammar — add the iron-cage readout (cross-variant rows; the
existing rows apply within each variant):**

> | Cross-variant result | Licensed reading |
> |---|---|
> | Discipline trains into base but not instruct | Alignment-layer localization: the incumbent dispositional norm (preference tuning) is the binding constraint — the "iron cage" is real and has an address |
> | Trains into both comparably | The incumbent attractors were never the binding constraint; the discipline was reachable at adapter scale regardless |
> | Fails in both | The gap is deeper than adapter-scale weight change — the earned version of the glum reading; escalation beyond LoRA requires a new document |

---

## H2 (2026-07-18) — Phase 5 trajectory-coherence prediction

status: pending
rationale: `notes/program-2/2026-07-18-dispositional-executive.md` §7 point 4

Add to the plan's Phase 5 (live integration) description:

> Phase 5 additionally separates two hypotheses the Step 4 data cannot: the
> compiled-enforcement arm paid ~0.13 proof-DAG coverage at turn 16
> (§6.18-addendum). If that cost is a property of the warrant move itself, it
> survives training; if it is a property of coerced authorship (the model
> conditioning on turns it did not produce), it vanishes when the move is
> trained. Either answer is informative; a vanishing cost dissolves the main
> liability of the enforcement path.

---

## Context for the executing thread

- Theory note (rationale for both items, plus the two-superego reframe and
  the character-not-preconscious correction):
  `notes/program-2/2026-07-18-dispositional-executive.md` (§§1–8).
- This thread deliberately did NOT touch `PROGRAM-2-FINETUNE-PLAN.md` — it
  holds your uncommitted model-selection revision — nor
  `scripts/program2-floor-grader.mjs`.
- The Phase 2 prereg freeze must carry: per-variant request shapes (frozen
  flattening template), per-variant training order and licensing, per-variant
  floors, and the cross-variant decision grammar above.
