# Edged-register outcome study — critical review + calibration-stage registration

**DRAFT FOR HUMAN REVIEW.** This note licenses no paid call. Nothing here is
registered, armed, or run. A GO note comes later and separately.

**Operator rulings (2026-08-16, recorded from chat):** the four Part-1
amendments are **approved** — the A-versus-B contrast is registered at the
first edge moment per dialogue (§1.2); the two-pass content/manner split
applies to arms A **and** B (§1.2); main-block powering uses the upper 80%
bound of the pooled kept-cell rate (§1.3 G1, §2.4); the edge-eligibility
screen is a registered keep condition (§2.5 M-C1). Calibration runs
**four parallel lanes** (screen ≈ 90 min, confirm ≈ 70 min attended, plus
the between-block review; lane width to be confirmed by the usual rate
probe in the GO note). Stack pinned in §2.9. Stage 0 build (no paid
calls) is authorized and under way.

**Date:** 16 August 2026. **Basis:**
`notes/2026-08-15-edged-register-outcome-study-design.md`,
`workplan/items/edged-register-outcome-study.md`,
`workplan/items/adaptive-register-switching.md`, and the Stage-2 mechanism
code (`services/tutorStubEdgeTimingPolicy.js`,
`services/adaptiveRegisterSwitchingStage2.js`,
`scripts/run-adaptive-register-switching-stage2.js`,
`services/adaptiveRegisterSwitching.js`,
`scripts/report-charisma-desire-breakthrough-matrix.js`).

---

## Part 1 — critical review of the design

### 1.1 What the design gets right

- The diagnosis of the Stage-2 null is correct and specific. The study
  powered a .50-versus-.85 contrast (the frozen power table in
  `services/adaptiveRegisterSwitching.js` shows 35/arm gives .8522 exactly
  for that pair), and the warm control then converted at .943 (33/35). The
  endpoint sat at the ceiling; the study measured almost nothing. Fixing the
  baseline before re-asking is the right order.
- Dropping the pinned-sarcastic arm is justified. Stage 2 already priced the
  all-day costume (30/35, worst of three), and the new yoked arm addresses
  timing-versus-manner more directly.
- The staging discipline (fail-closed report, per-register gates, provenance
  checks, GO note per paid stage, no Stage-3 mode in the runner) matches what
  made Stage 2 auditable. Keep all of it.

### 1.2 Does yoked-warm truly price manner at matched timing?

Only partly, and the design note overstates it. Two problems, one
conceptual and one mechanical.

**Conceptual — the yoke drifts after the first swap.** The learner is a live
LLM agent. In arm A the learner hears an edged reply at the first edge
moment; in arm B it hears a warm reply. From that turn on the transcripts
diverge, so the router in B is detecting moments in a *different
conversation*. "The same router detects the same moments" is true only at
the first edge moment of each dialogue. After that the yoke is policy-level
(same selection rule, warm delivery), not moment-level (same moments,
different delivery).

*Recommendation:* register the A-versus-B contrast at the **first edge
moment per dialogue** — conversion at the fold after that moment — where
timing and history are genuinely matched. Whole-dialogue A-versus-B stays
descriptive. The design note's wording should change to "same policy, warm
delivery" for the whole-dialogue reading.

**Mechanical — the fixed payload does not exist yet.** The note says the
warm swap keeps "the same mandated argumentative payload". In the current
id-director engine the content move and the manner are generated jointly:
the register enters the id envelope and the ego writes one reply. There is
no separate payload object that can be held fixed while manner varies.
Stage 0 must build a two-pass seam (content plan first, register rendering
second) or a constrained regeneration. Two consequences:

1. This is the largest build risk in the design. Without it, B differs from
   A in both manner and content, and A-versus-B prices nothing cleanly.
2. If the two-pass split applies only to arm B, then A and B differ in
   architecture, not just manner. The split must apply to **both** A and B
   — which means arm A is no longer the Stage-1/2 router verbatim, and the
   design note should say so. Arm C (router-warm, the licensing contrast)
   can stay single-pass, since A-versus-C is a deployment contrast, not a
   decomposition.

### 1.3 Gaps and confounds

**G1 — winner's curse in corridor selection.** Corridor cells are picked
from small-n estimates, so selection noise regresses: cells picked for the
corridor will drift back toward their true rates in the main block, and
some true rates sit above .70. At n=12 with a keep-rule of 4–8 successes,
a true-.80 cell is still kept about 20% of the time (about 32% at n=10
with 3–7). *Mitigation:* size calibration cells at n=12, and power the
main block on the upper 80% confidence bound of the pooled kept-cell rate,
not the observed mean. Part 2 registers both.

**G2 — endpoint validity off-distribution.** The conversion endpoint is a
deterministic lexical classifier
(`scripts/report-charisma-desire-breakthrough-matrix.js`: pattern counts,
a 70-point threshold, a still-resistant check). It was tuned on the
existing probe personas. Harder personas may express uptake in ways the
patterns miss, or lean on the classifier's declared-target rescue. The
prior confirmatory-grid verdict of `instrument_invalid` is a standing
warning about reusing instruments off-distribution. *Mitigation:* a
registered zero-cost endpoint audit on calibration transcripts before
freeze (Part 2, §2.5).

**G3 — protected-affect suppression can null arm A by construction.** The
edge-timing policy (`services/tutorStubEdgeTimingPolicy.js`) suppresses
edged choices on shame, anxiety, overwhelm, and vulnerability language.
A persona hardened in the affective direction may trip this on most turns,
so the adaptive arm would choose warm almost always and A ≈ C by
mechanism, guaranteeing a null. The calibration must measure, per cell,
how often an edged choice would even be eligible — computable offline
from warm transcripts, since the detector is deterministic on learner
text. Cells with low eligibility get excluded (Part 2, §2.5). This check
costs nothing and protects the whole main-block budget.

**G4 — persona provenance.** The design note names "the affective-resistant
profile" as a candidate. That profile lives in the tutor-stub harness
(`ravensmark-affective-resistant-v18`), a different world from the
id-director charisma scenarios. Porting it means authoring a new persona
in `config/charisma-recognition-desire-scenarios.yaml`, in the style of
the existing `_claimed` variants — a sibling by design intent, not the
tested artifact. The note should not imply cross-harness identity.

**G5 — harm-channel pause needs a frozen resume rule.** "Any flagged slice
pauses the run for human review" is right, but without a pre-registered
resume rule a mid-run pause becomes a mid-run design decision.
*Mitigation:* register the resume options in advance (resume unchanged /
kill the cell / kill the study), the same way the Stage-2 timeout
classification was handled by explicit operator ruling.

**G6 — stratification of the primary test.** The main block runs on kept
cells. Allocation is balanced (same cells, same repeats per arm), so a
pooled Fisher test is nearly clean, but the registration should say
explicitly: balanced cell-by-arm allocation, pooled exact test as primary,
per-cell rates reported descriptively. No post-hoc cell selection.

### 1.4 Power, seen plainly

The code's own power table is the right guide. At a corridor baseline near
.50: a +.35 effect needs 35/arm (Stage 2's optimism), +.25 needs 65/arm,
+.20 needs 105/arm, +.15 needs 185/arm. Stage 2's real lesson is that .35
was a hope, not an estimate. If the registration powers on another hope,
the study repeats the mistake at three times the price (three arms).

Two recommendations:

- Register a **minimum effect of interest** and power for it. The last
  defensible prior signal (the invalid-instrument bootstrap) was ±.167;
  a +.20 target at 105/arm is the smallest option that respects it. Three
  arms at 105 is 315 rows — at the observed Stage-2 pace (~5.8 min/row,
  595m for 103 rows) that is roughly 30 hours of attended generation plus
  serial scoring. This must be priced before anyone writes a GO note.
- If the budget will not carry three full arms, **subsample arm B** (the
  yoke), not arm A or C. The A-versus-B secondary is registered at the
  first edge moment anyway (§1.2), which needs fewer rows per unit of
  information than the whole-dialogue primary; B at half rows (with the
  cell balance kept) is the registered fallback.

---

## Part 2 — calibration-stage registration (DRAFT)

**Status: DRAFT FOR HUMAN REVIEW — licenses no paid call.** The calibration
runs only after its own committed GO note plus explicit human approval.

### 2.1 Aim and non-aims

Find persona-scenario cells where the **warm router** converts at 30–70%
on the post-resistance fold, so the main block has room to measure. The
calibration estimates baselines; it makes no claim about edged registers,
and its rows never pool into any later analysis. Selection-only.

### 2.2 Candidate cells and how they are picked

A cell is one authored persona variant crossed with one target-signal
scenario in `config/charisma-recognition-desire-scenarios.yaml`.

**Persona variants (authored at Stage 0, new scenario IDs, inheriting the
`resistance_breakthrough_base` anchor the way the `_claimed` family
does):**

- **P1 — sustained-resistance.** The dynamic-learner instruction requires
  resistance to be voiced and held for at least two learner turns before
  any uptake is permitted; uptake after that is left free.
- **P2 — claim-persistent.** Extends the `_claimed` family: the learner
  asserts one negatable claim about the material and re-asserts it once
  after the first tutor response before any movement is allowed.
- **P3 — affect-adjacent resistant.** A fresh authoring in the direction
  of the tutor-stub affective-resistant profile, written for this harness.
  Constraint: the resistance text must avoid the protected-affect lexicon
  (shame, anxiety, overwhelm, humiliation), or the cell will fail the
  eligibility screen in §2.5 by construction. If it cannot be written
  without that lexicon, P3 is dropped and the reason recorded.

**Scenarios:** the five frozen target signals (boredom, frustration,
irrelevance, question flood, rote parroting).

**Candidate set:** 3 × 5 = 15 possible cells, capped at **12** before any
paid call by an authoring review that drops the three weakest
persona-signal fits (for example, P2 on question-flood, where a persistent
claim and a flood of questions fight each other). The dropped three and
the reasons are recorded in the registration.

**Word-choice rule carried over from the `_claimed` authoring note:** the
hardening text must not smuggle in another signal's lexicon (`formula`,
`repeat`, `parrot`, `memorize`, the irrelevance phrasings), so a cell stays
a probe of its declared signal.

**Stage-0 build record (2026-08-16).** The twelve cells are authored in
`config/charisma-recognition-desire-scenarios.yaml` as
`charisma_desire_resistance_breakthrough_<signal>_{sustained|claimheld|guarded}`,
marked `edged_register_calibration: true`, reusing the controlled
`resistant_<signal>_probe` personas. The three drops from the 15-cell
cross, per the authoring review: P2×question_flood (a held claim and a
flood of questions fight each other), P2×rote_parroting (a negatable rote
claim either uses the banned lexicon or collapses into the frustration
claim), P3×question_flood (the guarded register is self-referential; the
flood needs rapid outward questions, and the mix classifies as
frustration). P3 was writable without the protected-affect lexicon, so it
stays.

**Endpoint definition detail (frozen with this note).** P1 and P2 cells
declare `resistance_hold_turns: 2`. The conversion classifier in
`scripts/report-charisma-desire-breakthrough-matrix.js` reads the outcome
at `resistanceTurn + resistance_hold_turns` — the first learner turn where
uptake is permitted — instead of the fixed next turn. The default of 1
leaves every existing scenario's read unchanged. Without this offset the
held cells would score 0% by construction, because the classifier would
grade the turn the scenario forbids from converting. Guarded (P3) cells
keep the base two-turn shape and the unchanged read.

### 2.3 Sample size and blocks

Two blocks, warm router only (arm-C configuration, normal menu, no edged
registers anywhere in the menu):

- **Block 1 — screen.** n=5 rows per candidate cell (12 cells, 60 rows).
  Drop any cell at 0/5 or 5/5. This screen keeps a true-.50 cell with
  probability .94 and already removes the worst saturated cells cheaply.
- **Block 2 — confirm.** Surviving cells are topped up to **n=12** total.
  If more than 7 cells survive the screen, the 7 whose screen rates sit
  closest to .50 are confirmed (ties broken toward the harder persona,
  P1 < P2 < P3 in authored order); the rest are recorded as
  screened-but-unconfirmed. Confirm block worst case: 7 × 7 = 49 rows.

Worst-case paid generation: **109 rows**, hard cap **120 rows**.

### 2.4 Corridor decision rule (frozen)

A confirmed cell is **kept** if its pooled conversions over n=12 lie in
**4/12 to 8/12** (observed .33–.67, implementing the design note's 30–70%
corridor at this n). Screen and confirm rows pool for this estimate — same
arm, same frozen config. No other rule, no exceptions, no re-running a
near-miss cell.

Known leak (G1): a true-.80 cell passes this rule about 20% of the time.
The main-block powering therefore uses the **upper 80% Clopper-Pearson
bound** of the pooled kept-cell rate as its baseline, not the point
estimate.

### 2.5 Additional registered calibration measures

Both zero-cost, both computed from calibration transcripts before freeze:

- **M-C1 — edge-eligibility screen.** Run the frozen edge-timing detector
  (`detectTutorStubEdgeTimingSignal` with the adaptive menu as the
  counterfactual palette) over every kept cell's transcripts. A kept cell
  also needs **≥ 70% of rows with at least one edged-eligible resistance
  moment** (a resistance-phase turn with no protected-affect and no
  comprehension-repair suppression). Cells failing this are excluded with
  the reason logged — they cannot separate arm A from arm C.
- **M-C2 — endpoint audit.** Two transcripts per kept cell, drawn by fixed
  rule (first and last row by ordinal), read by a human against the
  classifier's verdict. If the reader disagrees with the binary outcome on
  more than 20% of audited rows, the endpoint is revised **before**
  registration and the calibration corridor estimates are void for
  selection — the corridor re-runs on remaining budget or the study stops.

### 2.6 Budget

Per row, from Stage-1/2 observation: ~9 tutor-seat calls (id, ego,
agency-return verifier across turns) plus ~9–12 dynamic-learner calls,
so **~20 model calls per row**, ~5.8 minutes serial.

- Screen: 60 rows ≈ 1,200 calls ≈ 6 hours attended.
- Confirm: ≤ 49 rows ≈ ≤ 980 calls ≈ ≤ 5 hours attended.
- **Total cap: 120 rows ≈ 2,400 calls**, run attended and resumable in
  blocks, per the standing attended-run discipline.

Conversion scoring costs nothing: the endpoint is the deterministic lexical
classifier, and a warm-only run has no edged turns, so no register rubric,
no manner reading, and no judge calls are needed at calibration. No tutor
v2.2 or learner rubric scoring runs at calibration.

### 2.7 Stop rules

1. **No-corridor kill.** If no cell is kept after §2.4 and §2.5, the study
   stops with a registered no-corridor verdict. No main block.
2. **Harm guardrail.** The person-directed-contempt / status-shame /
   coerced-uptake guardrail runs report-only on every row; any flag pauses
   generation before the next dialogue starts. Registered resume options,
   chosen by the human reviewer: resume unchanged, kill the cell, or kill
   the study. No other mid-run change is available.
3. **Budget cap.** At 120 generated rows, generation stops. Unrun cells are
   recorded as unmeasured; the corridor is decided on what exists.
4. **Attended-run rule.** Interrupted rows follow the standing resume
   discipline: single attended resume of the exact missing jobs, no
   `--force`, no widening, no model change; anything else needs an
   explicit operator ruling first.

### 2.8 What gets frozen before the main block

At registration freeze (design-note Stage 2), all of:

- the kept-cell list with pooled rates and both screen/confirm counts;
- the main-block baseline (upper 80% bound, §2.4) and the powering
  computed from it against the registered minimum effect of interest;
- the three arm configurations under **new cell IDs** (204/205/197 are
  taken; grep `config/tutor-agents.yaml` before assigning);
- the two-pass payload seam (content plan, register rendering) applied to
  arms A and B, with its tests;
- the endpoint code SHA and the audit outcome (M-C2);
- the A-versus-B secondary defined at the first edge moment (§1.2);
- seeds enumerated against the burned ledger at GO time and **copied, not
  composed**;
- the plan SHA over all of the above. The GO note is a separate, later,
  human-committed document.

`npm run archive:runs` after every paid block, and commit in the archive
repo.

### 2.9 Stack and judge

Calibration runs on the **same stack the main block will use** — corridor
rates are stack-specific, and a corridor measured on one stack licenses
nothing on another. **Operator ruling 2026-08-16:** generation on codex
`gpt-5.6-luna`; judge claude-code Sonnet 5. Pinned here and carried into
the registration. Never nemotron/kimi. Sonnet-class judge from the first
scored row in the main block (§8.9 standing rule); calibration itself
needs no judge (§2.6).

### 2.10 Constraints carried forward

- `face_threat` stays out of every register menu (simulated-only rule).
- Sarcasm is a manner device: each edged register is scored under its own
  stance-fidelity gate, and **stance counts are never differenced across
  gates or folds** — no cross-register cue contrast is computed, matching
  the Stage-2 reporter.
- Simulated learners throughout; no human-learning claim; no claim that
  sarcasm is safe or human-facing. Results land in the negative-register
  thread of `docs/research/paper-full-2.0.md`, never in a spin-off first.
