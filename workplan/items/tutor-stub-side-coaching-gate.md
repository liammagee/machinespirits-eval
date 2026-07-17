---
id: tutor-stub-side-coaching-gate
title: "Point-of-action coaching gate: compiled constraints + side-coaching (final-stretch Step 4)"
status: done
type: experiment
priority: P1
owner: codex
source: manual
created: 2026-07-13
updated: 2026-07-18
verification: "The frozen successor pre-registration runs standing_book, trigger-yoked placebo, side_coach, and compiled_constraint on proof_skipper and affective_resistant at n=5 per cell on two speaking-tutor families while learner/classifier/record seams stay fixed. A zero-call 68-trace audit selects two deterministic triggers (warrant_skip and stagnant_repeat), freezes opportunity minimums, and rejects affective-risk/re-gloss candidates. Side coaching or compilation must beat triggered placebo on equally weighted trigger compliance by >=0.15 with a positive dialogue-clustered 95% interval, improve both trigger types, clear coverage/safety non-inferiority, and produce zero leaks. No model calls occur until explicit launch approval."
claim_status: settled
depends_on:
  - adaptive-eval-immutable-provenance
links:
  paper: §6.16, §6.17
  notes:
    - POINT-OF-ACTION-COACHING-PREREGISTRATION.md
    - PRECONSCIOUS-FINAL-STRETCH-PLAN.md
    - PLAN_4_0/2026-07-13-preconscious-arc-stocktake-and-final-stretch.md
    - GREEN-ROOM-PLAN.md
    - notes/2026-07-12-greenroom-gate1-diagnosis.md
  exports:
    - exports/tutor-stub-step4-trigger-audit/trigger-density.md
    - exports/tutor-stub-step4-dry-run/zero-model-dry-run.json
    - config/adaptive-tutor-evidence/tutor-stub-step4-zero-model-dry-run.manifest.json
    - exports/tutor-stub-step4-claim-runs/compliance-analysis.json
    - exports/tutor-stub-step4-claim-runs/launch-plan.json
  items:
    - a22-green-room-coached-tutor-training
tags:
  - tutor-stub
  - green-room
  - side-coaching
  - insight-action-gap
  - pre-registration
milestone: adaptive-tutor-evidence-v1
branch: preconscious
---

Attack the bottleneck the Green Room Gate 1 diagnosis localized: written
insight does not become enacted policy because situation-recognition fails at
performance time. Move recognition out of the actor — mechanical detectors do
the noticing (compiled constraints), or the coach delivers the note at the
moment its trigger fires (side-coaching). This is where the program's whole
positive family converges: checkable trigger, point-of-action delivery,
action-shaped format, new situational signal.

2026-07-13 Claude: Card created at final-stretch sanction
(PRECONSCIOUS-FINAL-STRETCH-PLAN.md Step 4). This is a successor
pre-registration, not a Gate 1 retry: the placebo arm (ii) reproduces the
failed standing-text channel as the control, and the treatment arms change the
delivery channel (per-turn, trigger-fired) and the grain (mechanical predicate,
not conditional prose). Note on the reserved cell label: GREEN-ROOM-PLAN.md
reserved "cell 206" for side-coaching, but no cell_206 exists in
config/tutor-agents.yaml, and the Green Room arc itself ran on the tutor-stub
substrate without a registered cell — allocate an ID (grep tutor-agents.yaml
first, per the cell-ID discipline) only if the design turns out to need the
cell registry at all. Launch requires: Step 0 provenance gate (done
2026-07-13), the frozen dated prereg doc, and an explicit go (attended, ~1-2
quota days). Sequencing per plan §10: after Step 2; outranks Phase 6A when
budget-bound.

2026-07-14 Codex: Remains triaged as the next scientific gate, not yet frozen
or authorized for model calls. Before activation, replace the current
no-coaching/standing-text comparison with claim-bearing `standing_book`,
trigger-yoked `triggered_placebo`, action-shaped `side_coach`, and
`compiled_constraint` arms; audit trigger density from existing traces; and
hold automated learner, classifier, and learner-record seams fixed while only
the speaking tutor family varies. Exact compliance, non-inferiority, safety,
and family-interaction rules still require a fresh preregistration.

2026-07-14 Codex: Activated after the zero-call instrument audit and frozen
successor pre-registration. The audit verifies 68 trace hashes and retains two
assigned triggers: 484 warrant-skip opportunities (31% baseline compliance)
and 204 stagnant-repeat opportunities (28% baseline compliance); deterministic
12-event samples were valid for both. Affective-risk and re-gloss triggers are
rejected. The four claim-bearing arms are now `standing_book`,
`triggered_placebo`, `side_coach`, and `compiled_constraint`; supporting seams
are fixed while only the speaking tutor varies. This card is ready for build
and launch only after a separate explicit go; this update made zero model calls.

2026-07-14 Codex: Implemented the frozen detector events and all four runtime
arms, including per-turn provenance and compliance components. Deterministic
fixtures cover positive, negative, co-fire priority, closure, glossary,
release, and no-release cases; the trigger-yoked placebo is target-free and
token-count matched. The archived zero-model gate passes with 0 model calls and
an exactly balanced, seed-interleaved 80-dialogue plan. All classifier,
learner-record, and automated-learner seams are fixed to Terra in both
speaking-tutor blocks. The paid launcher fails closed unless it receives both
`--launch-approved` and an exact clean commit SHA. Paid status remains locked
pending explicit user approval. The frozen implementation commit is
`092cf6723ec5ddcda735b59f1c53728f4f00248e`; the dry plan SHA-256 is
`93bd2933d6124a2ee285e9747824cee5e2eba21c0b59ccf6dc8ac8d602156df0`.

2026-07-17 Claude: PAID LAUNCH APPROVED by the user as the fold's one bounded
discharge (PLAN_4_0/2026-07-17-continue-or-fold.md §6.2). First launch from
clean SHA c038e254 in an isolated worktree FAILED on dialogue 1/80: "Fatal:
Tutor deterministic fallback failed final audit:
response_composition:verbatim_learner_echo" — the same fallback path behind
four of the normalized failing-baseline tests, now shown to be a live runtime
regression, not fixture drift. The regression is being root-caused and fixed
(fallback composer, not the echo audit); relaunch follows from the fixed clean
SHA. The frozen design (arms, triggers, gates, plan) is untouched — the fix
must be verified out-of-scope for the prereg before relaunch.

2026-07-17 Claude: Echo-regression fixed (composer-side learnerEchoGuard,
audit unweakened; suite 6746/0 at 052206b9). A second at-HEAD regression
(handoff_loses_turn_focus) postdated the freeze, so the run gate returned to
the frozen implementation commit 092cf672. Mid-run the user held the launch
for the CLAUDE.md ambient-context leak (safe-mode-v1): the claude CLI loaded
~16k tokens of repo context into every Sonnet-family call. Fix hand-backported
onto 092cf672 as branch `step4-frozen-isolated` @ 91b8a50e (isolation args +
temp cwd + CLAUDE_CLI_CONTEXT_ISOLATION stamp; freeze-era tests 15/15;
mock-spawn probe verified flags/cwd/stamp). Seven pre-isolation dialogues
quarantined unanalyzed
(exports/tutor-stub-step4-claim-runs/quarantine-preisolation/ in the step4
worktree); their cells re-ran from scratch. Codex path was always isolated.

2026-07-18 Claude: GATE DISCHARGED — census 80/80 sealed, zero exclusions,
after three scheduling passes (initial + two capped retries; census-based
idempotent resume replaying the plan's byte-identical frozen commands; crash
causes all technical: CLI 180s timeouts raised to 360s via env, path-dependent
audit trips, one learner-prompt budget overflow, codex capacity/cache errors).
Provenance verified fail-closed: all 80 traces stamp git 91b8a50e @
step4-frozen-isolated; detector step4-frozen-2026-07-14.v1 on every event;
stamped arm == plan arm; opportunities == verdicts; zero window violations.
FROZEN VERDICT: **instrument failure on the stagnant_repeat channel — no
mechanism verdict for either treatment arm in either family** (T1 density 7/8
blocks under the pre-declared floor of 12: placebo 8 sonnet / 4 sol; the
treatment arms suppress their own trigger's precondition — compiled saw 2/1
T1 opportunities; denominator endogeneity recorded as the design lesson).
Descriptive, non-claim: side_coach lands under the +0.15 bar in both families
(+0.146/+0.142, CIs straddle zero) — the insight-action gap persists at
point-of-action delivery; compiled_constraint moves macro compliance
+0.452/+0.420 (sonnet CI excludes zero) and realizes answer_accountably on
all 180 compiled warrant-turns with zero smuggled premises, but misses the
surface warrant_cue on most non-compliant turns and pays ~0.13 coverage@16 vs
placebo (coverage guardrail would fail; sol safety would fail; zero-leak bar
fails in every arm including controls). Anomaly: side-coached sonnet was the
safest cell (hard-safety 0.90 vs 0.30; 1 leak vs 10). Results:
POINT-OF-ACTION-COACHING-PREREGISTRATION.md §11 (execution ledger), paper
§6.18 addendum (v3.0.216), analyzer scripts/analyze-step4-compliance.mjs
(reproduces the committed JSON byte-identically), artifacts
exports/tutor-stub-step4-claim-runs/{compliance-analysis,launch-plan}.json.
Raw traces machine-local in the ms-preconscious-step4 worktree pending
archive-repo consolidation. No successor run licensed under this prereg; the
preconscious fold is complete.
