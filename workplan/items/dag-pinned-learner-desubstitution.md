---
id: dag-pinned-learner-desubstitution
title: DAG-pinned resistant learner and the de-substitution test
status: done
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-07-03
updated: 2026-07-05
verification: Stage 0 no-paid gate (interior schema, drift gate extending resistanceSignalGate, deterministic yield checker, tests, hermetic dry-run) passes; Stage 1 instrument-validation probe meets frozen thresholds (selectivity ≥0.8, false-yield ≤0.1) before Stage 2; the 3-arm × 5-subtype matrix runs only after both gates with recorded go decisions; H-D/H-O verdicts applied exactly as frozen in the plan note §4. CLOSED 2026-07-05 — confirmatory C-series (notes/2026-07-04-desubstitution-confirmatory-prereg.md) ran the 3-arm × 5-scenario × 8-repeat matrix (120 rows, eval-2026-07-04-0d59e4c8) at 2x the generating n; H-Dc and H-Oc both DISSOLVED under clean guards (no exhaustion freeze, no grounding floor).
claim_status: settled
links:
  notes:
    - notes/2026-07-03-dag-pinned-learner-desubstitution-plan.md
tags:
  - learner-side
  - belief-desire-dag
  - drift-gate
  - de-substitution
  - composition
  - evaluation
branch: worktree-blueprint-composition
---

Test whether §7.11's substitution reading is conditioned on a
non-discriminating learner, per
`notes/2026-07-03-dag-pinned-learner-desubstitution-plan.md` (frozen
pre-registration). The instrument: a learner pinned to a formal interior
(micro belief-DAG with one blocking element + declared desire set) whose
resistance is criterial — it may yield only when the tutor actually
addresses the blocking element (deterministic DAG check, the DAG-SFS
precedent) — held in character by a criterial learner-superego drift gate
(rejection + corrective regeneration; extends resistanceSignalGate). The
matrix: fixed-strategy floor (cell 186 variant) vs multi-strategy backbone
(cell 193 variant) vs kernel (cell 199 variant) across the five resistance
subtypes; primary outcome is deterministic grounding rate
(architecture-independent, no judge in the decision path); the existing
§6.14 corpus is the legacy-learner control at zero new spend.

Acceptance:

- Learner interior and yield rule are machine-checkable; the drift gate is
  criterial (reject + regenerate), turn-indexed, with exhaustion recorded
  as instrument failure, never tutor evidence.
- The embedded sycophancy probe (targeted vs mismatched vs generic
  scripted tutor turns) passes its frozen thresholds before any
  de-substitution interpretation (H-V precondition).
- H-D and H-O verdicts follow the frozen thresholds (real ≥5/20 gap,
  dissolved ≤2/20, 3-4 unresolved-STOP) with the interpretation map in the
  note §4 — either direction is a §7.11 result.
- Circularity of the engagement filters is bounded and disclosed as
  written in note §6; no paid stage runs without its own recorded go.

2026-07-03 Claude: Pre-registration frozen and committed. Nothing built;
Stage 0 awaits a go decision.

2026-07-03 Claude: Stage 0 COMPLETE (user go; full log in note §7). Built:
five `desub_resistance_*` scenarios with formal interiors (17 unique DSB-*
tokens), `services/learnerInteriorGate.js` (content condition, drift-gate
verdicts, correction injection, deterministic grounding checker, frozen
Stage-1 classifier prompt), runner wiring (character sheet + cumulative
content condition + drift-gate retry loop + grounding trace; exhaustion =
instrument_failure, message never replaced),
`scripts/run-desubstitution-probe.js` (--check green: targeted 5/5,
mismatched 0/5, generic 0/5, cross 0/20; --live hard-gated on Stage 1 go),
`scripts/report-desubstitution-stage0.js` (--check PASSED). Verification:
64/64 focused tests, validate-config 0 errors, lint/prettier clean.
Recorded §3.1 deviation: no new cells — arms reuse 186/193/199; pinning is
scenario+gate-driven, keeping config hashes clean against the legacy §6.14
control corpus. Stage 1 (paid instrument validation) awaits go.

2026-07-03 Claude: Stage 1 run (user go; full log in note §7). Probe 30/30
rows: **FAIL** — selectivity 0.10 (vs ≥0.8) with false-yield 0.00, attempt
median 1, exhaustion 0. Sycophancy fully repaired; failure localized to the
grounding checker's token-citation requirement (learner yields appropriately
but does not name the DSB token; the one grounded row does). Canary skipped
and Stage 2 locked per pre-registration stop discipline. Next requires a
fresh go: character-sheet citation amendment + re-probe.

2026-07-03 Claude: Stage 1 PASSED after four iterations (full log in note
§7). Three surface-scoring failures (token citation, citation instruction,
paraphrase matching — selectivity stuck at 0.10 with false-yield 0.00
throughout) resolved by reframing the single-turn probe outcome as
release-engagement: probe 1.00 selectivity / 0.00 false-yield / median 1 /
0 exhaustion. Canary eval-2026-07-03-414f945f 6/6 clean: drift-gate +
grounding traces on every row, zero instrument_failure. Strict grounding
deferred to Stage 2 multi-turn outcome (§3.4 refinement); blocking tokens
verified tutor-visible. Stage 2 (3 arms × 5 subtypes × 4 repeats = 60 rows)
awaits its own recorded go.

2026-07-04 Claude: Stage 2 matrix COMPLETE (`eval-2026-07-03-a3cfbe14`,
60/60 rows; parallelism-3 deviation recorded). **Both H-D and H-O verdicts
FROZEN_INSTRUMENT_FAILURE**: drift-gate exhaustion hit 23/60 rows (38%),
tripping the frozen >20% guard in 13/15 cells; release floor absolute
(0/60 tutor token-releases; grounding 1/37 usable). No §7.11 update in
either direction — the de-substitution question remains OPEN, bounded by
instrument capacity: the drift gate holds character for one turn (Stage 1
probe 1.00/0.00) but exhausts across full dialogues, and tutors never find
the DSB key unprompted. Candidate repairs recorded in note §7 (attempt
ceiling + turn-decaying contract; tutor-visible key salience; sonnet-class
classifier), each needing a fresh go. PAPER FLAG: a later paper pass may
add the instrument-scaling finding (per-turn characterological gating does
not compound to dialogue-scale character) as a §8.1/§6.14-adjacent
limitation note.

2026-07-04 Claude: Iteration 1 Phase B: mini-probe PASS (1.00/0.00/1/0) and
canary exhaustion 0/3 (decayed contract works), but the release gate FAILED
0/3 — tutors paraphrase the withheld premise; they never quote DSB tokens or
canonical phrases even with the key visible in their instructor sheet.
Matrix not launched. Next fresh go: tutor-side citation instruction and/or
semantic release classifier (note §7).

2026-07-04 Claude: Stage 2 iteration 2 COMPLETE (`eval-2026-07-04-c689cf3a`,
60/60; note §7). Instrument HEALTHY: exhaustion 3.3% (vs 38% iter 0),
semantic release fires 8/58, grounding floor broken (6 rows). Frozen
verdicts: **H-D UNRESOLVED_STOP at gap 4** (193-arm grounded 4/20, 186-arm
0/20; bar was ≥5) — hard stop, no further repeats without a new prereg;
**H-O FROZEN** (kernel exhaustion >20% in boredom + rote cells). §7.11
unchanged. Directional lead recorded: all 6 groundings came from router
arms, fixed-strategy floor 0/20. Any confirmatory follow-up needs a fresh
pre-registration (higher n, kernel exhaustion repair).

2026-07-04 Claude: Confirmatory pre-registration FROZEN
(`notes/2026-07-04-desubstitution-confirmatory-prereg.md`, committed before
build) and Stage C0 COMPLETE. Design: fresh 186-vs-193 contrast at 40
rows/arm (iteration-2 rows never pooled); frozen thresholds gap ≥7/40 REAL /
≤3/40 dissolved / 4-6 UNRESOLVED-FINAL (no third bite); cell_199 rides as
optional H-Oc only. Instrument v2.1: drift_gate_max_attempts 4→5 uniform;
decay.warm_after_turn 2→1 for boredom + rote-parroting interiors;
LEARNER_INTERIOR_GATE_VERSION="2.1"; all else unchanged. C0 verification:
gate tests 11/11, probe --check PASSED (5/5, 0/5, 0/5, 0/20 cross), stage-0
check PASSED, validate-config 0 errors, lint/prettier clean. C1 paid canary
(6 rows, exhaustion ≤1/6 + release ≥1 gates) awaits its own recorded go.

2026-07-05 Claude: **C2 confirmatory matrix scored — arc CLOSED.** Run
`eval-2026-07-04-0d59e4c8`, 120/120 successful rows (3 arms × 5
`desub_resistance_*` scenarios × 8 repeats), scored judge-free via
`scripts/report-desubstitution-stage2.js --confirmatory` (minimal
extension: a `--confirmatory` flag swaps in the frozen C-series thresholds
— one-sided for H-Dc, symmetric for H-Oc per prereg §2 — while the
pre-existing default invocation is unchanged, verified by re-running it
against the archived iteration-2 run and diffing against the already-
committed export). Full tables: `exports/desubstitution-confirmatory-
matrix.{md,json}`; full result + interpretation: `notes/2026-07-04-
desubstitution-confirmatory-prereg.md` (2026-07-05 dated section).
Instrument v2.1 healthy: exhaustion 1/120 = 0.83% (vs iteration 0's 38% and
iteration 2's 3.3%), zero of 15 arm×subtype cells trip the >20% guard,
grounding floor false. **Both frozen verdicts: H-Dc DISSOLVED** (gap 0:
193_multi 4/40 vs 186_fixed 4/40) **and H-Oc DISSOLVED** (gap 0: 199_kernel
4/40 vs 193_multi 4/40, flat) — all three architecturally distinct tutors
ground this criterially resistant, DAG-pinned learner at an identical 10%
rate. The iteration-2 apparent router lead (gap 4, one row short of real)
did not replicate at 2× sample under the repaired instrument; it reads as
small-sample noise. Per the pre-registration's frozen consequence mapping,
this **strengthens** (does not qualify) the §7.11 substitution reading: de-
substitution is not confirmed even against a learner engineered to yield
only on genuine content release. Bounded to the single Codex-only stack,
simulated learner, and these five subtypes — no human-learner claim. No
further runs are authorized or needed on H-D/H-O with this instrument;
the confirmatory C-series is complete.

PAPER FLAG: the verdict is DISSOLVED, not REAL, so §7.11 does **not** need
the "against non-discriminating learners" scope condition the
pre-registration reserved for a REAL outcome. Instead, a future paper pass
MAY cite this confirmatory result as additional support for the existing
substitution claim — an architecture-independence result that now survives
a genuinely resistant, criterially-gated learner at 2× the generating
sample — as an evidential strengthening note, not a new claim requiring a
new §. No paper edit made under this arc's runs.

2026-07-05 Claude: **PAPER FLAG resolved.** Folded the confirmatory result
into `docs/research/paper-full-2.0.md` §7.11 as a closing three-paragraph
block (evidential strengthening note, exactly as the flag prescribed — no
new §, no non-discriminating-learner scope condition, since the verdict
was DISSOLVED not REAL): the SFS=0.000 motivation (§8.1 cross-reference),
the DAG-pinned learner + criterial drift gate (false-yield 0.00
throughout), the instrument's exhaustion trajectory (38% →
`eval-2026-07-03-a3cfbe14` → 3.3% `eval-2026-07-04-c689cf3a` → 0.83%
`eval-2026-07-04-0d59e4c8`), the confirmatory matrix's clean DISSOLVED
verdicts on both H-Dc and H-Oc (gap 0, 4/40 every arm), and the generating
iteration-2 lead's failed replication at 2× sample. A methods clause
cross-references §8.1: per-turn characterological gating does not compound
to dialogue scale without a turn-decaying contract. Paper version
3.0.205 → **3.0.206**; matching Appendix F entry added; no sections
renumbered. All three cited run IDs spot-checked directly against
`data/evaluations.db` (row counts match exactly: 60, 60, 120). Validation
clean: `validate-paper-manifest.js` (60 pass/0 warn/0 fail),
`paper:integrity-audit` (17 pass/12 pre-existing warn/0 fail),
`atlas:validate` (0 errors/0 warnings). PR #97.
