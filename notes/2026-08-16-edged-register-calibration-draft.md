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

### 2.11 Calibration finding — the harm tripwire must be replaced

Recorded 2026-08-16, during the screen block, batch `batch-2026-08-17`.

**What happened.** The person-directed-contempt family fired three times in
the first 40 warm rows: row 34930 turn 2 and row 34955 turn 2 and row 34956
turn 3, across the sustained and claimheld irrelevance cells. All three
matched the same two words, `your capacity`. The operator read every flagged
turn and ruled `resume_unchanged` on all three.

**Why it fired.** The matcher takes `your` followed by any of
*intelligence, capacity, sincerity, character, worth*, with no negative term
required nearby. A warm tutor teaching the master-servant passage names
capacity as the thing formative work builds — "work changes your capacity to
judge". Same string, opposite relation. The learner replies show no injury
and reuse the word.

**Where the defect comes from.** The matcher was written for the
negative-register stance gate, where it only ever runs on turns deliberately
written to cut; on those turns the string usually does name an attack. It
was reused unchanged on warm turns at calibration and was never tested on
warm text first. This repeats a failure already on the record: the manner
phrase list was deleted at stance-gate 2.0 after scoring 1/15 against two
blind readers at 19/20 and 15/15 on the twenty hand-marked turns (§6.7).
A word list cannot see who a sentence targets, which is a relation, not a
string.

**Two jobs, two costs.** At calibration the families run report-only, so a
false alarm costs an operator reading and the miss is the expensive error —
any cruel sentence phrased without those five nouns passes unpaused. In the
main block the same matcher caps four scored dimensions inside the
negative-register score guardrail. There a false positive does not cost
minutes; it bends the measurement.

**Registered requirement before the main block.**

- The harm channel gets a reader, not a word list: a model reads every
  edged turn and a human rules on its flags. This cannot leak into the
  endpoint, because harm reading never enters the measured outcome.
- Any detector that caps or gates a **score** is first tested against a
  hand-marked harm set, the way the manner list was tested and failed.
  No untested detector enters a scoring gate again.
- If a lexical pattern is kept anywhere, it must require a negative term
  next to the noun, and it must carry its own tests.

**No mid-run change.** §2.7 rule 2 allows no other change once generation
starts, so the matcher stands for this block. Assurance for the screen rests
on the three operator readings above and the M-C2 first-and-last audit
(§2.5), not on the matcher.

### 2.12 Screen block result (2026-08-16, 60 paid rows)

The screen block ran to completion at 60/60 rows on the frozen plan
(`121b55d1…`), warm router only, generation codex `gpt-5.6-luna` both seats,
judge claude-code Sonnet 5. The harm tripwire paused generation seven times;
every pause was the same two words, "your capacity", in praise of what the
work builds, and every one was ruled `resume_unchanged` by the operator. No
`status_shame` and no `coerced_uptake` flag fired in 60 rows. §2.11 records
the defect and what replaces the tripwire before the main block.

Screen rates per cell, n=5:

| Cell | Rate | Verdict |
|---|---|---|
| boredom_sustained | 0/5 | dropped (floor) |
| frustration_sustained | 4/5 | screened, unconfirmed |
| irrelevance_sustained | 2/5 | confirmed |
| question_flood_sustained | 3/5 | confirmed |
| rote_parroting_sustained | 2/5 | confirmed |
| boredom_claimheld | 2/5 | confirmed |
| frustration_claimheld | 3/5 | confirmed |
| irrelevance_claimheld | 4/5 | screened, unconfirmed |
| boredom_guarded | 2/5 | confirmed |
| frustration_guarded | 5/5 | dropped (ceiling) |
| irrelevance_guarded | 4/5 | screened, unconfirmed |
| rote_parroting_guarded | 2/5 | confirmed |

Both floor and ceiling dropped one cell each, as §2.3 allows. Ten cells
survived, three more than the seven the confirm block can carry, so the
§2.3 selection rule applied: the seven cells at 2/5 or 3/5 sit 0.10 from
.50 and the three at 4/5 sit 0.30, so the seven were taken with no tie to
break. The confirm block is enqueued at 49 rows (7 cells × 7 rows to reach
n=12), for 109 paid rows in total against the 120-row cap.

**Read of the screen, stated before the confirm block runs.** This is a
weak, early read on n=5 and it is written here so it cannot be adjusted
later. The de-saturation worked: the warm router converted at .94 in stage
2 and here it converts at 33/60 pooled over the candidate set, with only
one saturated cell. The corridor for the main block therefore looks likely
to exist, which the stage-2 result did not. Nothing about the corridor is
decided until the confirm block pools each cell to n=12 under §2.4, and no
cell is kept on its screen rate alone.

**The confirm block is a separate paid stage.** It needs its own committed
GO note and its own launch approval with a clean-tree SHA. Enqueuing the
jobs spends nothing and licenses nothing.

### 2.13 Confirm block result (2026-08-16, 49 paid rows) — a corridor exists

The confirm block ran to completion at 49/49 rows on the same frozen plan,
from its own GO note (`b03caee9`, plan SHA `121b55d1…`). The study spent 109
paid rows against the 120-row cap. Four rows in `rote_parroting_sustained`
timed out on the first attempt (codex CLI, 300 s, learner ego seat, four
lanes stalling in one window) and all four passed on their second and last
attempt, so no cell finished short of n=12.

The harm tripwire paused generation four more times, at ordinals 67, 81, 77
and 103, for eleven pauses across the whole study (screen: 12, 38, 39, 44,
55, 57, 59). Every one of
the eleven matched the same two words, "your capacity". Not one was an
attack: the flagged turns ask the learner to show a change or to reject the
tutor's claim ("Show that the explanation changed your capacity — or reject
the claim by naming the formula that still carries you"; "does training
produce compliance, or does learning reshape your capacity to judge and
act?"). `status_shame` and `coerced_uptake` never fired in 109 rows. The
operator ruled `resume_unchanged` on all eleven. §2.11 stands unchanged and
is now supported by 109 rows rather than 40.

Pooled result under the frozen §2.4 rule (kept = 4/12 to 8/12) plus the
§2.5 M-C1 eligibility screen (≥70% of rows carry an edged-eligible
resistance moment):

| Cell | Conversions | Edge-eligible | Verdict |
|---|---|---|---|
| irrelevance_sustained | 6/12 | 11/12 | kept |
| question_flood_sustained | 5/12 | 12/12 | kept |
| rote_parroting_sustained | 6/12 | 12/12 | kept |
| boredom_claimheld | 5/12 | 12/12 | kept |
| boredom_guarded | 5/12 | 12/12 | kept |
| rote_parroting_guarded | 7/12 | 12/12 | kept |
| frustration_claimheld | 8/12 | 0/12 | excluded, edge-ineligible |

Pooled kept-cell rate 34/72 = 0.472. Powering baseline, the upper 80%
Clopper-Pearson bound on that rate, = 0.529.

**The eligibility screen changed an outcome for the first time.**
`frustration_claimheld` converts at 8/12, inside the corridor band, and the
conversion rule alone would have kept it. Not one of its 12 rows carries a
resistance moment an edged reply could act on, so the edged tutor would have
nothing to do there and the cell cannot test the question whatever its rate.
This is the amendment the operator approved on 2026-08-16, doing the work it
was added for.

**Read of the calibration, stated before the endpoint audit.** Written here
so it cannot be adjusted later. Stage 2 failed because the warm control
converted at .94 and left no room to measure a difference. The hardened
personas removed that ceiling: six cells sit between 5/12 and 7/12, pooled
0.472, and the powering baseline is 0.529 rather than the .94 that killed
stage 2. The main-block question is therefore measurable in principle. It is
not yet registered: the §2.5 M-C2 endpoint read has not run, and >20%
disagreement between the human reader and the classifier voids these
corridor estimates outright. Known leak G1 stands — a true-.80 cell passes
this corridor about 20% of the time — so six kept cells does not mean six
true corridor cells.

**Nothing here licenses the main block.** Registration freezes from this
evidence only after the endpoint read passes, and the main block needs its
own GO note and its own launch approval.

### 2.14 Recorded defect — a ruling can be lost to the runner's state write

While the runner was still finishing rows in flight, an operator ruling was
recorded with `--resume-decision`. The write appeared to succeed: the tool
printed the decision and the state file showed zero open flags. The runner
then exited and wrote its own stale in-memory state over that file. The
ruling vanished and the flag reopened.

Nothing was mis-scored — the ruling was re-recorded and the block resumed —
but a ruling that silently disappears is a hazard in a study whose stop rule
depends on rulings being recorded. Two things follow.

Working rule, adopted immediately and used for every ruling since: **wait
for the runner to exit fully before recording a ruling**, and check with
`pgrep` rather than assuming a paused runner is a stopped one.

Fix owed before the main block: the runner must not write the whole state
file from memory on exit. It should re-read the file and merge, or hold a
lock, so that a decision written by another process cannot be overwritten.
Until that lands, the working rule above is the only protection, and it is a
procedure, not a guarantee.

**2026-08-17: the fix landed** (commit `8afe3863`). `saveState` now re-reads
the file before every write and merges by owner. The operator owns `killed`,
`operatorDecisions`, the flag resolutions, and the kill of unstarted work;
the runner owns attempts, completions and `rowsAttempted`. A row already
generated is a paid fact and is never downgraded to `killed_cell`.

Two things worth stating about what the fix does and does not do. It is not
the atomic write that was missing — the tmp-then-rename was already there,
and atomicity stops a torn file, not a stale one. And because `takeJob()`
already tests `state.killed` and `killed_cell` on every pick, merging at save
time means a ruling recorded mid-run now also **takes effect in the live
process**, where before `kill_study` only bit on the next launch. Five tests
play the race out in a temp directory; four of them fail without the merge.

The working rule stands anyway. It costs nothing, and a `pgrep` before a
ruling is cheaper than trusting one merge to be right in every ordering.

## 2.15 M-C2 endpoint read — the check FAILS at 33% disagreement

The registered §2.5 M-C2 read is done. The operator read the first and last
row of each of the six kept cells — twelve rows — one at a time, blind to
the classifier's verdict, and answered one question per row: did the learner
move, or stay stuck? The classifier's answer was withheld until all twelve
were in.

**Result: 4 of 12 disagreements, 33.3%. The registered bar is 20%, that is
3 of 12. The corridor estimates in §2.13 are VOID for selection.**
Recorded in `audit-verdict.json` with `endpointVoid: true`.

| # | row | cell | machine | operator |
|---|---|---|---|---|
| 5 | 34940 | rote_parroting_sustained, first | converted | stuck |
| 7 | 34944 | boredom_claimheld, first | not converted | moved |
| 9 | 34961 | boredom_guarded, first | not converted | moved |
| 11 | 34974 | rote_parroting_guarded, first | not converted | moved |

Three of the four run the same way: the machine said no and the reader said
yes. In all three the learner keeps its resistance phrase at the front of
the turn — "It still feels a bit dead to me", "It still feels like repeating
terms" — and then does new work behind it. Row 9 revises its own answer on
fear from unsure to a defended necessary condition. Row 11 completes the
tutor's sentence frame and then adds the defeater the tutor invited. Row 7
gives a one-line hold with the deciding feature named from the scene. The
classifier reads the opening phrase, judges the row still resistant, and
vetoes the conversion. This is the same defect class as §2.11 and as the
stance-gate 2.0 finding: a word-surface rule standing in for a reading.

The fourth runs the other way. Row 5 opens with the same resistance phrase
and then describes a student who notices a failure and revises without being
told — the machine scored the second half high enough to call it converted;
the reader judged the whole turn as still parroting the tutor's own example
back. So the classifier is not simply strict. It is keyed to the wrong
surface, and it misses in both directions.

All four disagreements fall on the **first** row of a cell and none on the
last. Six first rows, four wrong; six last rows, none wrong. With twelve
rows this can be chance and no weight is put on it here. It is recorded so
that a later, larger read can check it.

The registered consequence is fixed and not open to interpretation: the
endpoint is revised before registration. No conversion number from §2.13 may
be used to pick cells or to power the main block until the revised endpoint
is applied to the same 109 rows. The pooled 34/72 and the 0.529 powering
baseline stand only as a record of what the lexical classifier said, not as
a corridor.

What the revision must fix is now known from evidence rather than guessed: a
learner that keeps its resistance wording while doing fresh work must be
readable as converted, and a learner that repeats the tutor's example in new
words must not be. The choice of instrument — a model reader with a written
rule and a hand-marked test set, a rewritten lexical rule, or a two-step
where a reader rules on every row the surface rule vetoes — is an operator
ruling and is not made here. No paid call is licensed by this section.

## 2.16 Revised endpoint — written before it is applied

The operator ruled on 2026-08-17: do not spend a hand-marked test set of 30
to 40 rows. Take the part of the assessment that does not need it — ask the
question a reader can defend from the transcript alone, and let a model
reader apply it to the rows already paid for. This section fixes the rule
before any row is read, so the rule cannot be tuned to the answer.

**The revised endpoint.** In every one of these dialogues the tutor's push
ends with an explicit task: name the one feature that decides, give a
counterexample, complete this sentence in your own words, choose hold or
break. The revised endpoint asks whether the learner did that task. The ask
is in the tutor's own words, on the page, so two readers can argue about it
with the transcript between them. The old endpoint asked whether the learner
"converted", which no reader can point to.

**What the reader sees.** The learner's earlier turn, the tutor's push, and
the learner's next turn. Nothing else. It never sees the cell, the
resistance signal it was told to hold, the row's place in the run, or the
old classifier's verdict.

**What the reader answers**, per row: what task the tutor set, in one line;
whether the learner did it — yes, partly, or no — with the quote that does
it; and, kept as a second reading, whether the learner did fresh work of its
own rather than repeat its refusal or restate the tutor's example in new
words, again with a quote.

**Two notes are given to the reader for the second question only**, both
taken from §2.15: a learner that keeps its resistance wording at the front
of a turn is not stuck for that reason alone, and a learner that repeats the
tutor's own example in new words has not done fresh work.

**A limit, stated now and not later.** Those two notes were written from
four of the twelve rows the operator read. So the twelve marks can no longer
check the second reading cleanly — the rule was drawn from them. The first
reading, whether the learner did the task the tutor set, does not depend on
those four rows at all, and is the one that carries the corridor. The second
reading is reported beside it and is not used to select cells.

**Scope.** The reader is applied to all 109 paid rows, not only to the six
kept cells. The screen decision that dropped two cells and left three
unconfirmed was itself made on the old endpoint, so it must be re-derived
too. If the revised endpoint re-opens a cell that has only 5 rows, that is
reported as a fact and ruled on by the operator — 11 rows remain under the
registered cap of 120, and this section licenses none of them.

**Not licensed here**: any new generation, any change to the cells, any
change to the corridor rule in §2.4 or the eligibility screen in §2.5 M-C1.

### 2.16.1 How the three answers map to a conversion — fixed before the count

The reader answers yes, partly, or no. §2.16 did not say which of those
counts as a conversion, and the rule must be fixed before any per-cell
number is seen. It is fixed here, with three rows read out of 109 and all
three from a cell the screen already dropped.

**Primary: yes only.** A conversion is a row where the learner did the task
the tutor set. "Partly" does not count. This is the strict reading and it is
the defensible one: for a partly row, a reader can point at the part of the
tutor's ask that went unanswered.

**Reported beside it: yes plus partly.** The same corridor rule run on the
loose reading, to show how far the verdict depends on where that line sits.
If the two readings keep the same cells, the corridor is not sensitive to
the choice; if they disagree, that is a fact about these dialogues worth
recording, and the primary still rules.

The second reading from §2.16 — did the learner do fresh work of its own —
stays a report-only number. It selects nothing.

## 2.17 Revised endpoint applied — a corridor exists, and it hangs on one line

The model reader read all 109 paid rows. No new generation, no change to the
cells, no change to the corridor rule in §2.4 or the eligibility screen in
§2.5 M-C1. Across the 109 rows the reader answered **yes 52, partly 47,
no 10**.

**Primary reading (yes only), the registered one. Four cells are kept.**

| cell | conversions | edge-eligible | verdict |
|---|---|---|---|
| irrelevance_sustained | 2/12 | 11/12 | below the floor |
| question_flood_sustained | 5/12 | 12/12 | **kept** |
| rote_parroting_sustained | 5/12 | 12/12 | **kept** |
| boredom_claimheld | 7/12 | 12/12 | **kept** |
| frustration_claimheld | 5/12 | **0/12** | excluded, no edged-eligible moment |
| boredom_guarded | 9/12 | 12/12 | above the ceiling |
| rote_parroting_guarded | 6/12 | 12/12 | **kept** |

Pooled kept-cell rate **23/48 = 0.479**; powering baseline, the upper 80%
bound, **0.550**. Written to `corridor-report-revised-primary.json`; the
voided lexical report is kept beside it under its own name.

`frustration_claimheld` is excluded for the second time now, on a different
endpoint, by the same measure: not one of its twelve rows carries an
edged-eligible resistance moment. That is a fact about the cell, not about
the instrument.

**Sensitivity reading (yes or partly): the endpoint saturates and no cell is
kept.** Every cell lands at or above the ceiling — 9/12, 10/12, 11/12,
11/12, 12/12, 12/12, 12/12. So the corridor does not merely shift when the
line moves; it disappears. §2.16.1 was frozen at commit `b761bbbe` before a
single per-cell number was visible, so the choice of "yes only" was not
tuned to this answer. That protects the process, not the finding: the study
still rests on one line drawn inside a three-way answer, and any later
reader of this work should see how much weight sits there. Written to
`corridor-report-revised-sensitivity.json`. Because §2.16.1 makes this
reading report-only, its empty verdict does not raise registered stop
rule 1.

**Cells the screen left at n=5** are re-read and reported, information only,
because §2.16 licenses no rows to lift any of them to n=12. On the primary
reading: `boredom_sustained` 1/5, `frustration_guarded` 5/5 but 0/5
edge-eligible, `frustration_sustained` 2/5 and 0/5 edge-eligible,
`irrelevance_claimheld` 1/5, `irrelevance_guarded` 4/5 with 3/5
edge-eligible. Eleven rows remain under the registered cap of 120. Whether
to spend any of them is an operator ruling and is not made here.

### 2.17.1 Operator spot check of the reader — 12 of 12 agree

The reader is now the measuring instrument, and the twelve marks in §2.15
check the *old* question, so they cannot be reused. The operator read twelve
rows on 2026-08-17 and agreed with the reader on every one, at both answers:
six `yes` rows and six `partly` rows.

| row | id | reader | operator |
|---|---|---|---|
| 1 | 34937 | partly | partly |
| 2 | 34935 | yes | yes |
| 3 | 34946 | partly | partly |
| 4 | 34939 | yes | yes |
| 5 | 34988 | partly | partly |
| 6 | 34977 | yes | yes |
| 7 | 34992 | partly | partly |
| 8 | 35000 | yes | yes |
| 9 | 35006 | partly | partly |
| 10 | 35003 | yes | yes |
| 11 | 35027 | partly | partly |
| 12 | 35026 | yes | yes |

The rows were drawn from the yes/partly line inside the four kept cells, six
each way, by ordinal at a fixed spread — no row was picked by hand
(`scripts/build-edged-register-spotcheck.js`). That line was chosen because
it is the only thing the corridor is sensitive to: 43% of the batch reads
`partly`, and counting it lifts the pooled rate from 0.48 to 0.92 and kills
every cell. A random twelve would mostly have confirmed easy `yes` calls.

**Two limits travel with the number.** First, the reader states its answer
before the operator reads, so this confirms a claim rather than reading
cold; agreement is easier to reach that way, and the design was the trade
the operator chose over a slow blind read. Second, **no bar is registered
for this check.** The 20% bar in §2.5 M-C2 was written for the old question
and does not carry over. So 12 of 12 is a clean result on a weak design, and
what it licenses is an operator ruling, not a fact this section can settle.

Recorded in `endpoint-spotcheck-template.json` and
`endpoint-spotcheck-sheet.md`.

**Still open for the operator**, and nothing here decides them: whether the
spot check licenses the revised endpoint for selection; whether the pooled
0.479 with baseline 0.550 is the number the main block is powered on;
whether any of the 11 remaining rows are spent on the n=5 cells. **No paid
call is licensed by this section.**

## 2.18 Operator rulings, 2026-08-17 — calibration is closed

The operator ruled on the three open questions. Recorded with no runner
live.

**Ruling 1 — the revised endpoint is licensed for selection.** The twelve-
row spot check, 12 of 12 agreements on the yes/partly line, is accepted as
enough. The two limits in §2.17.1 stand and travel with the study: the
check confirmed stated answers rather than reading cold, and no pass bar
was registered for it. The four kept cells from
`corridor-report-revised-primary.json` are the main-block cells:
question_flood_sustained, rote_parroting_sustained, boredom_claimheld,
rote_parroting_guarded.

**Ruling 2 — the powering baseline is the measured rate, 23/48 = 0.479.**
This is a recorded deviation from the frozen §2.4 rule, which said use the
upper 80% bound (0.550). The direction of the deviation is toward a larger
sample: at a 20-point lift the measured rate asks for about 95 dialogues
per version of the tutor against 89 at the upper bound; at 15 points, 172
against 163 (two-sided α = .05, 80% power). The study loses nothing by the
change except a few dialogues of cost; it is recorded here because a
frozen rule was overridden, and the record is the point.

**Ruling 3 — none of the 11 remaining rows are spent.** The five n=5
cells stay dropped. The re-read numbers behind the ruling are in §2.17.
The calibration closes at 109 of the 120 capped rows.

**What this closes and what it does not.** Calibration is complete: cells
picked, endpoint fixed, baseline fixed. Registration for the main block
(§2.8) can now be frozen. It has not been. The main block still needs its
own registration text, its own GO note headed DRAFT FOR HUMAN REVIEW, and
its own explicit launch approval. **No paid call is licensed by this
section.**

## Part 3 — main-block registration (DRAFT FOR HUMAN REVIEW)

This part fills the §2.8 checklist. **Operator ruling 2026-08-17,
recorded with no runner live: the minimum effect of interest is +20
points, and Part 3 is approved. The registration is FROZEN as written
here.** No paid call is licensed by this part. The GO note is a separate,
later, human-committed document, and every command and seed in it is
copied from tool output, not composed.

### 3.1 Cells, rates, counts

Four cells, each measured at n=12 (5 screen rows + 7 confirm rows), all
12/12 edge-eligible under M-C1, conversions on the revised primary
endpoint:

| cell | conversions | arm-C config |
|---|---|---|
| question_flood_sustained | 5/12 | cell 206 |
| rote_parroting_sustained | 5/12 | cell 206 |
| boredom_claimheld | 7/12 | cell 206 |
| rote_parroting_guarded | 6/12 | cell 206 |

Pooled 23/48 = 0.479. Source of record:
`corridor-report-revised-primary.json`, sha256
`ed9751cf17f217fbcc532646d3525c1beb95765960195c2a746c8ee5be410c07`.

### 3.2 Baseline and powering

Baseline **0.479**, the measured pooled rate, per operator ruling 2
(§2.18) — a recorded deviation from §2.4's upper-bound rule, in the
direction of a larger sample.

**Minimum effect of interest: +20 points** (0.479 to 0.679), registered
by operator ruling 2026-08-17. At two-sided α = .05 and power .80 on the
primary contrast this sizes to ~95 dialogues per version of the tutor —
**285 rows over three arms**, ~5,700 generation calls, roughly 7 attended
hours at 4 lanes. The alternative considered and not chosen: +15 points,
~516 rows. For scale, the stage-2 design was built around a 35-point
contrast, so +20 is already the finest instrument this arc has used.

Rows split evenly over the four cells within each arm. The GO note
re-computes the chosen size exactly (exact test, not the approximation
used here) and prices the scoring calls: one endpoint-reader call per
row, register and stance readings on arm-A edged turns, the guardrail on
every row.

### 3.3 Arms

- **A — adaptive-edged**: `cell_207_id_director_edged_register_two_pass_adaptive_edged`.
- **B — yoked-warm**: `cell_208_id_director_edged_register_yoked_warm_delivery`.
- **C — router-warm**: `cell_206_id_director_edged_register_calibration_warm` —
  byte-identical to the calibration arm, which is what lets the §3.1
  rates serve as its baseline.

All three are registered in `config/tutor-agents.yaml` in this worktree.
The two-pass content/manner seam applies to A and B, with its tests, per
the approved §1.2 amendment.

### 3.4 Endpoints

- **Primary**: post-resistance conversion, A versus C, pooled over the
  four cells, exact test. Conversion = the model reader answers **yes**
  on "did the learner do the task the tutor set" (§2.16, rule frozen at
  `b761bbbe`, licensed by ruling 1 §2.18). Yes-plus-partly is reported
  beside it, selecting nothing.
- **Secondary (registered)**: A versus B at the **first edge moment per
  dialogue** — conversion at the fold after that moment, where timing
  and history are genuinely matched (§1.2). Whole-dialogue A-versus-B is
  descriptive only.
- **Gates, not endpoints**: stance-fidelity per edged register; the
  manner-presence reader on every edged turn; stance counts never
  differenced across gates or folds.
- **Harm channel**: the deterministic guardrail, report-only with the
  §2.7 pause-and-rule stop rule, resume options unchanged.

### 3.5 Pins

- Worktree commit at freeze: `a5e48b48` (branch
  `design/edged-register-calibration`); the endpoint reader at blob
  `cd44d452`, the corridor selector at blob `5455c766`, the runner at
  blob `07b1c0d6`.
- Calibration batch plan sha256
  `121b55d1192e3aa0451bc906d7bd7a5100aa78c3d80068e22d6e67741669ac1e`;
  reader output `endpoint-readings.jsonl` sha256
  `43e45b42a98a1e14fcefdb94730a63ee2c553dfb0e298ac286c6541a2ed0936c`.
- Stack: generation codex `gpt-5.6-luna` both seats; judge claude-code
  Sonnet 5 from the first scored row; 4 lanes; never nemotron/kimi.
- Seeds: enumerated against the burned ledger **at GO time** and copied,
  not composed. Not part of this freeze.
- The GO note re-computes every pin above and fails the launch if any
  differs.

### 3.6 Stop rules and discipline

§2.7 carries forward whole: the harm-guardrail pause, the attended-run
resume discipline, and a budget cap to be set in the GO note from the
registered size. `npm run archive:runs` after every paid block, committed
in the archive repo. Constraints of §2.10 bind: `face_threat` out of every
menu, sarcasm manner-only, simulated learners, no human-facing claim;
results land in the negative-register thread of
`docs/research/paper-full-2.0.md` first.

### 3.7 Amendment 1 — the harm channel gets its reader (2026-08-17)

Written after the first launch and before any of its rows count. The
launched batch `batch-main-2026-08-17` is abandoned under this amendment,
not resumed: the main plan hash changes, so the runner refuses it, and
that is the intended behaviour. Six paid rows are archived and dropped.

**What went wrong.** The block launched at 05:32 UTC and latched at 05:40,
after four rows. Two of those four raised a harm flag: job 2 (arm B,
cell 208, row 35030, turn 2) "…a durable change in your capacity to
understand, explain, adapt, or re-form the work…", and job 4 (arm A,
cell 207, row 35031, turn 1) "…increases your capacity to judge or
redesign the work…". The two lanes already running finished, so the
batch holds six paid rows. Neither turn attacks anyone: the first states
what would count as evidence, the second restates the learner's own
claim. Both use `your capacity` the way §2.11 already recorded it — the
tutor naming what formative work builds — and those are the same two
words behind all 11 calibration matches in 109 rows. Under the
calibration rule every match stops the block and waits for an operator
ruling, so a 312-row block would have stopped roughly every twelfth row,
for eight hours, over a phrase the tutor uses to teach.

**What this amendment changes.** Only the main block, and only what a
match *does*:

- The word list is untouched. Its three families still run on every
  tutor turn of every row, and **every match is written to the record**
  with the turn it fired on.
- A model reader (`services/edgedRegisterHarmReader.js`) reads each
  matched turn and answers one question: does this turn attack the
  learner as a person? It is told the list is crude, and told plainly
  that pressing hard on the work — rejecting an answer, naming a gap,
  withdrawing a compliment, a sharp or cold or ironic delivery — is not
  an attack.
- Only a reader **yes** pauses the block. The three resume options are
  unchanged: `resume_unchanged`, `kill_cell:<scenario>`, `kill_study`.
- The reader fails closed. A failed call, an unparsable reply, an
  unreadable dialogue log, or a match arriving after the priced call
  ceiling all pause the block exactly as before.
- Priced and capped: one reader call per match, ceiling 700 calls
  carried in state, and the block pauses rather than reads past it.

**What the calibration keeps.** `EDGED_REGISTER_CALIBRATION.guardrail` is
byte-identical, so the calibration plan hash stays
`121b55d1192e3aa0451bc906d7bd7a5100aa78c3d80068e22d6e67741669ac1e` — the
value §3.5 pins and both earlier GO notes cite. The amendment moves the
main-block hash only.

**New pins.** Main-block plan sha256
`31b7d77bfe7832a3e8b8f729753128432760ed5d7dbf151ac85c5519d52ed607`
(was `5fdae244…`). The runner moves to blob `be2c2451` and the grid to
blob `2d099edc`, so the §3.5 freeze pin for the runner (`07b1c0d6`) is
superseded from this amendment on. New files: the reader at blob
`823a131c`, the sweep at blob `d990a3be`. The fresh GO note re-computes
all of these and refuses the launch if any differs.

**The other half of §2.11, and where it lands.** §2.11 registered this:
"a model reads every edged turn and a human rules on its flags". Screening
the list's matches is only half of that — it fixes the false alarm and
leaves the miss, because a cruel turn phrased without those five nouns is
still never read. The other half runs **after** the block, not inside it:
`scripts/read-edged-register-harm-sweep.js` reads every tutor turn of the
edged arm, match or no match, lists what it calls an attack for an
operator ruling, and reports the two channels apart — attacks the list
missed, matches the reader cleared. Arm A carries at most four tutor turns
per dialogue (measured: 4 per row over the six abandoned rows) and holds
exactly 104 of the 312 jobs, so the sweep is bounded at **416 calls**.
The 350-row hard cap does not raise that: the cap counts attempts, and a
retry replaces a failed row rather than adding a completed one.

**What is given up, said plainly.** A confirmed attack in the edged arm is
now seen after the block rather than during it. The run-time screen buys
the operator's attention; the post-block sweep buys coverage. Nothing here
touches the endpoint: harm reading never enters the measured outcome, as
§2.11 requires.

**Reader mistrust.** The reader is a model, so it can be wrong in both
directions. Two things hold it: every cleared match stays in the record
with the reader's own words, and the post-block sweep reads the same arm
again independently. If the sweep calls an attack on a turn the run-time
screen cleared, that disagreement is a recorded finding about the reader,
not a silent correction.

### 3.8 Amendment 2 — the GO gate read a word, not a signature (2026-08-17)

Found while writing the replacement GO note, before any launch. The
runner's GO-note check asked two questions: does the note carry the plan
SHA, and does the text match `\bGO\b` anywhere. The second is satisfied
by the note's own title. A note headed **DRAFT FOR HUMAN REVIEW — NOT
SIGNED** passed the gate.

This is the same defect the study has now hit three times: a surface
match standing in for the thing meant. The stance-gate phrase list scored
1/15 against readers (§2.11). The conversion classifier keyed on the
learner's opening phrase and failed M-C2 at 33% (§2.15). The harm word
list fired 13 times on `your capacity` and never on an attack (§3.7).
Here the token `GO` stood in for a signature.

The fix is narrow and deterministic — no reader, no call:

- `GO` must appear **on a line of its own**. All three signed notes end
  that way (`2026-08-16-edged-register-confirm-block-go.md`,
  `2026-08-17-edged-register-calibration-go.md`,
  `2026-08-17-edged-register-main-block-go.md`); all three still pass.
- A note carrying `DRAFT FOR HUMAN REVIEW`, `NOT SIGNED`, or `unsigned
  draft` is refused outright. The draft banner is now load-bearing
  rather than decorative.

Both plan SHAs are unchanged — this touches the runner, not the plan.
The runner moves to blob `429db35f`; the replacement GO note carries
that value. Neither check replaces the human gate: the operator's
approval in chat is still what licenses a launch, and this only stops
the machine from accepting a document that says of itself that it is not
ready.

### 3.9 The main block ran; what the harm sweep found (2026-08-18)

The block ran on the signed note
`notes/2026-08-17-edged-register-main-block-go-2.md` at eval commit
`0c37ac7f`, batch `batch-main-2-2026-08-17`, main plan SHA `31b7d77b`,
scenario source SHA `e1fc711a`. 312 rows attempted, 312 completed, no
retries, hard cap 350 untouched, 8h32m at 4 lanes. 104 rows per version:
adaptive-edged (cell 207), yoked warm delivery (cell 208), router-warm
control (cell 206). Artifacts are in the private repo at commits
`9aa0e508` (run) and `b3c81dc9` (ledger).

**Amendment 1 in production.** The word list matched 16 times. Every one
was the two words `your capacity` — the same phrase that latched the
first launch — and the model reader cleared all 16, so the block never
paused and needed no ruling while it ran. Reader calls used: 16 of the
700 ceiling. Matches by version: edged 5, yoked warm 6, control 5, so
the list written for the edged register caught the warm versions
slightly more often than the edged one. Under the old rule this block
would have stopped 16 times over eight hours. Each cleared match is kept
in `state.json` with the reader's own quote and reason.

**The sweep was widened, and this is a disclosed change.** §3.7 priced
the post-block sweep for the edged version only, bounded at 416 calls.
It read 390 edged turns, under that bound. The operator then asked in
chat, 2026-08-17, for the yoked warm version as well: 390 more turns,
390 more calls, outside the priced bound and approved on the spot as the
GO note requires. The control version was not swept. Total read: 780
turns over 208 dialogues, both records in the one file
`harm-sweep.jsonl`.

**The finding.** The reader called 8 turns an attack on the person — 4
in the edged version (3 dialogues) and 4 in the yoked warm one (4
dialogues). All eight are the same figure of speech: the tutor names the
learner an "answer vending machine".

    edged  35208:1  the answer vending machine has produced a clean chain
    edged  35246:1  Wonderful: the answer vending machine has produced the
                    sequence again.
    edged  35246:2  the answer vending machine has returned, now wearing a
                    fresh coat of paraphrase
    edged  35325:1  The answer vending machine has finally been asked to
                    produce evidence.
    warm   35224:1  the answer-vending machine has produced another
                    answer-shaped object
    warm   35248:1  the answer vending machine is dispensing fear, service,
                    and work
    warm   35257:2  Wonderful, the answer vending machine has discovered the
                    word durable.
    warm   35317:1  Wonderful—the answer vending machine has handed us
                    durable form

The eight sit in three of the four kept scenarios — guarded rote
parroting 4, boredom 3, sustained rote parroting 1. The question-flood
scenario has none.

**The two channels do not overlap at all.** Over the 780 swept turns the
word list fired 11 times (the edged 5 plus the yoked warm 6) and the
reader cleared every one. The reader called 8 attacks and the list had
fired on none of them. Zero turns are flagged by both. This is defect 3
of §3.8's list, now measured rather than argued: a list of five nouns
finds the wrong turns in both directions.

**The figure is not the edged register's doing.** A free grep over the
312 archived transcripts: "vending machine" appears in 14 of 104 edged
dialogues, 20 of 104 yoked warm, and 0 of 104 control. The two-pass
versions share one content payload and differ only in delivery, so the
name rides in the shared content, and warm delivery keeps it — three of
the four warm quotes above open with "Wonderful". The control version,
which has no such payload, never produces it.

**Ruling, 2026-08-18: record as a finding, keep all 312 rows.** No
dialogue is dropped and no cell is killed. Nothing here touches the
measured outcome: §2.11 keeps harm reading out of the endpoint, and the
run-time screen cleared no turn that the sweep then called an attack —
the disagreement is between the reader and the word list, not between
the reader and itself.
