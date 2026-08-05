---
id: tutor-fallible-learner-closure-prereg
title: "Pre-registration: restore variance to legitimate closure with a learner that can fail"
status: done
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-07-30
updated: 2026-08-06
verification: "Phase A runs bare-tutor only and is exploratory. Before the
  first paid Phase B call: the in-band cells and their profiles are frozen in
  a dated log entry here, and a 5-dialogue contract smoke on one in-band cell
  shows zero aborted dialogues. The run itself is attended and checkpointed."
claim_status: methods
depends_on:
  - tutor-contract-outcome-prereg
tags:
  - tutor-stub
  - prereg
  - outcome
  - learner
---

Registered before the first paid call. Phase A is exploratory by design and
says so below; Phase B amendments after its freeze must be logged here with
dates; amendments after Phase B starts are not permitted — a changed design
is a new card.

**Question.** When the learner can fail, does the per-turn performance
contract change how often the learner reaches the case's conclusion
legitimately?

**Why this card exists.** The parent card's pilot found the endpoint
saturated: with the diligent learner, the bare tutor closed 19 of 19 finished
dialogues once each world ran to its authored length. Closure was a fact
about the world because the learner never failed. This card puts failure
back, from the learner side. The distinction with the cap re-pick the parent
refused is registered here as the design's spine: shortening a world's clock
would have tuned the endpoint's own measure on observed data, but the learner
is part of the population under study, is held identical across tutor
versions, and the band is judged on bare closure exactly as the parent gate
judged it. The clocks stay authored throughout.

**The learner knob already exists.** The free-dialogue runner carries sixteen
learner profiles (`scripts/tutor-stub-learner-profile-contracts.js`); the
pilots used `diligent`. The candidates for a fallible learner are the
profiles whose failure a tutor can address in dialogue: `memory_limited`
(loses premises — the tutor can re-anchor), `false_memory` (imports facts the
record never released — the tutor can confront), `premature_closure` (settles
early — the tutor can hold open), and `low_agency` (waits — the tutor can
elicit). Excluded on principle: profiles whose failure is refusal or noise
rather than something tutoring reaches. The seeded-decay machinery of the
unreliable-learner line (`UNRELIABLE-LEARNER-PREREG.md`) is the mechanical
twin of `memory_limited`, but it is wired into the dramatic-derivation
episode engine, not this runner; prompt profiles are the knob this runner
already has, and the difference is noted rather than hidden.

**Phase A — calibration, exploratory, bare tutor only.** For each candidate
profile, 5 bare dialogues per world on the two short worlds first (Rowan
Flat, Greyfen; about 8 minutes a dialogue), extending a profile to Tallow and
Nocturne only if it leaves the ceiling on the short worlds. A cell is a world
and profile pair; a cell is *usable* where bare closure lands in the 20–80%
band. Everything else from the parent carries unchanged: authored caps,
per-world budgets, the closure matcher, the crash rule (a dialogue the
harness kills is excluded and named), and the offline recompute as the
audit. Phase A data are calibration only and never enter the contrast.
Expected cost: 40 dialogues before extensions, roughly six hours.

**Phase A gate.** At least two usable cells, on at least two different
worlds. Fewer, and this card closes with the finding that this learner
population cannot fail believably on these worlds — logged, not spun.

**Phase B — the registered contrast.** On the frozen usable cells: bare,
contract-only, and the fixed empty plan (the length-and-shape control), n =
12 dialogues per version per cell. Same speaking model for all three (codex
`gpt-5.6-terra`, medium effort), same learner configuration within a cell,
learner blind to version. Primary endpoint: legitimate closure — the learner
states the conclusion and the voiced public premises entail it, both checked
against the world's proof-DAG. Verdict: difference in closure proportion,
contract vs bare, pooled over cells, two-sided exact test, α = 0.05. The
empty plan is a control, not a comparison of record. If quota forces a cut,
drop cells, never n per cell, and log the cut here.

**Secondary endpoints (reported, never promoted).** Turns to closure;
learner-voiced share of the winning proof path; spoiled-case rate; closure
lag behind the world's first derivable turn; blind whole-dialogue preference
by a model family that wrote neither side, refusals reported.

**Pre-committed readings.** Contract raises closure: the contract earns an
outcome-level pedagogy claim, scoped to this stack and these failure modes.
No difference: the stronger null — the contract stays compliance machinery
even where the learner gives it room to help, and the pedagogy claim is
withdrawn for this stack rather than deferred. Contract lowers closure: it
leaves the default stack. All three branches are actions, not
interpretations.

**Reuse note.** The calibrated usable cells are a platform: any later
mechanism contrast on them needs its own card, not an amendment here.

**Limits, stated now.** One stack; simulated failure modes are authored
personas, not measured human difficulties; criterial endpoints; no claim
about human learning; a null is stack-bounded until replicated on another
model. Nothing enters the paper before Phase B completes and survives this
card's own verdict rule.

## Log

**2026-08-05 — Phase A started.** Plan as registered, no amendments: 4
candidate profiles (memory_limited, false_memory, premature_closure,
low_agency) × 2 short worlds (world_030_rowan_flat, world_023_greyfen_lab)
× 5 bare dialogues, `run-contract-outcome-pilot.js --blocks none`, parent
defaults carried unchanged (codex gpt-5.6-terra both seats, medium effort,
authored caps, offline recompute as audit). Outputs under
`exports/tutor-stub-outcome/fallible-phaseA/<profile>--<world>/`. Attended,
one to two cells at a time, resumable per cell.

**2026-08-05 — Phase A complete; FREEZE.** All 8 cells ran (5 bare
dialogues each, zero crashes, offline recompute as audit; artifacts under
`exports/tutor-stub-outcome/fallible-phaseA/`). Corrected closure:

| profile | rowan_flat | greyfen_lab |
|---|---|---|
| memory_limited | 5/5 above | 5/5 above |
| false_memory | **4/5 in band** | 5/5 above |
| premature_closure | 5/5 above (3 engine misses corrected) | 5/5 above |
| low_agency | **1/5 in band** | **2/5 in band** |

Gate passed: three usable cells on two worlds. **Frozen Phase B cells:**
`false_memory × world_030_rowan_flat`, `low_agency × world_030_rowan_flat`,
`low_agency × world_023_greyfen_lab`. No long-world extension: the gate is
met on the short worlds and extension is the card's rescue path, not a
requirement. Two notes for the record: the premature_closure engine-miss
pattern (live matcher under-counts that profile's phrasings; recompute
governs) and the profile-by-world locality (each failure mode bites on one
world). Implementation step before Phase B starts, per the registered
design: the empty-plan control block exists in the A/B replay arms only
(`services/tutorStubAbArms.js` GENERIC_PLAN) and must be wired into the
live runner as a gated block before the first Phase B call; the contract
smoke gates as registered.

**2026-08-05 — contract smoke PASSED; empty-plan control built.** The
registered smoke (5 contract-arm dialogues on low_agency ×
world_023_greyfen_lab): zero aborted dialogues, all clean exits, and every
turn's trace stamp shows exactly `first_draft_contract` enabled with the
other blocks omitted (`exports/tutor-stub-outcome/fallible-phaseB-smoke/`).
The third registered version now exists live: the fixed empty plan ships
via `--blocks empty_plan` (request-only; PR #495, merged), with a
one-dialogue delivery check running before Phase B opens. Phase B cells,
order and arms as frozen above; n = 12 per version per cell; versions run
sequenced within a cell (they feed the contrast and share the quota
window).

**2026-08-05 — Phase B cell 1 complete (low_agency × greyfen_lab).**
Corrected closure by the offline audit: bare 6/9 (67%, 3 aborts — codex
tool-reflex kills, excluded and named per the crash rule; the runner
treats aborts as spent by design), contract 10/11 (91%, 1 abort), empty
plan 5/12 (42%, 0 aborts). Empty-plan delivery check preceding the cell:
1 dialogue, stamp `empty_plan` only, plan text shipped verbatim on all
turns. Descriptive only; the verdict pools all three cells.

**2026-08-05 — Phase B cell 2 complete (false_memory × rowan_flat).**
Corrected closure: bare 8/9 (89%, 3 aborts), contract 9/10 (90%, 2
aborts), empty plan 9/11 (82%, 1 abort; two engine misses corrected).
The cell was frozen at the band edge (80% calibration) and its Phase B
bare sample drifted above it — recorded, not re-gated; the pooled test
carries it. All aborts remain codex tool-reflex kills, named per the
crash rule.

**2026-08-06 — Phase B complete; VERDICT: the null branch.** Cell 3
(low_agency × rowan_flat): bare 6/11 (55%, 1 abort), contract 3/12 (25%,
0 aborts), empty plan 6/11 (55%, 1 abort). Pooled primary over the three
frozen cells: contract 22/33 (67%) vs bare 20/29 (69%), difference −2.3
points, two-sided Fisher exact p = 1.000. Pre-committed reading applies:
**no difference — the stronger null.** The contract stays compliance
machinery even where the learner gives it room to help; the outcome-level
pedagogy claim is WITHDRAWN for this stack (codex gpt-5.6-terra, these
authored failure modes), not deferred. The empty plan pooled 20/34 (59%),
a control, not a comparison of record.

Descriptive residue for any future card (not licensed by this design):
the cell-level swing is large and opposite-signed — contract +24 points
on low_agency × greyfen, +1 at the false_memory ceiling, −30 on
low_agency × rowan — the outcome channel showing the same per-world
locality the conduct benches kept measuring. A contrast keyed to that
interaction needs its own pre-registration on fresh cells.

Accounting: 9 blocks × 12 dialogues attempted; 14 aborts total, every
one a codex tool-reflex kill under the bridge's no-tools policy,
excluded and named per the crash rule; denominators are completed
dialogues throughout; all closure numbers are the offline recompute's.
Artifacts under `exports/tutor-stub-outcome/fallible-phaseB/`. Next:
fold the result into the paper's §6.23 line with the stated scope
limits; the calibrated cells remain a platform (reuse note above).

**2026-08-06 — CLOSED.** Result folded into paper §6.23 (v3.0.265,
commit 19946f9e) with the stated scope limits; validators clean
(provable-discourse 144/0 after repairing the moved two-file-storage
evidence pointer; manifest ALL PASSED). The three calibrated cells
remain a platform per the reuse note — any later contrast needs its
own card.
