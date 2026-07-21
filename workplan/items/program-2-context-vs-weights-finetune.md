---
id: program-2-context-vs-weights-finetune
title: "Program-2: context-versus-weights fine-tune (form-carrier hypothesis)"
status: active
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-07-18
updated: 2026-07-21
verification: "A LoRA-tuned small open model (4-8B), trained on the apparatus's own sealed audit-labeled turns (SFT on audit-passing originals; KTO on unpaired audit labels only if SFT misses), clears pre-registered pass bars on held-out warrant_skip trigger moments graded by the frozen step4-frozen-2026-07-14.v1 deterministic check plus guards and leak audit, AND is non-inferior in a blinded quality review against matched audit-passing originals. Floor (untuned base) measured before thresholds freeze; one SFT + one conditional KTO run licensed; no-tune-and-retry from the Phase 2 freeze."
claim_status: exploratory
links:
  paper: §7.12, §6.18, §6.19
  notes:
    - PROGRAM-2-FINETUNE-PLAN.md
    - PLAN_4_0/2026-07-17-continue-or-fold.md
    - POINT-OF-ACTION-COACHING-PREREGISTRATION.md
  items:
    - tutor-stub-side-coaching-gate
tags:
  - tutor-stub
  - fine-tune
  - insight-action-gap
  - form-carrier
milestone: adaptive-tutor-evidence-v1
branch: main
---

Test the one hypothesis the closed adaptation programme cannot answer from
existing evidence (paper §7.12): whether the insight-action gap is a
context-versus-weights boundary. Every prior intervention held weights fixed
and moved words; the signature (content present in context, never realized;
realized only under enforcement, at cost) is what a parametric gap predicts.
Train a small open model on the apparatus's own sealed labels (2,076 audited
Step 4 turns; 645 trigger moments; 1,096 audit-passing drafts; 980 failed
drafts as unpaired negatives) and grade with the audits that produced the
labels — zero-call, deterministic, no new judge.

Design guards carried from the fold: DPO on natural repair pairs is
prohibited (the repair side reads worse, §6.18 −0.60 — training toward it
reproduces the documented style regression); KTO on unpaired labels instead.
Blinded quality check gates against template collapse. Phases 0-1 (extraction
+ floor) are free and sanctioned by the plan; training starts only after the
Phase 2 prereg freeze and an explicit user go.

2026-07-18 Claude: Plan drafted and committed (PROGRAM-2-FINETUNE-PLAN.md)
after the user approved developing a fine-tune plan with cloud compute
available. Data availability verified against the archives: the sealed
turn_complete records store the actual speaking-tutor system prompts, so
training examples reconstruct the identical interface the large models faced.
Provider layer already supports OpenAI-compatible base_url for the eventual
live phase (scripts/tutor-stub.js:3021). Awaiting Phase 0-1 execution, then
the Phase 2 freeze gate.

2026-07-18 Claude: PHASE 0 COMPLETE, both gates PASS (user go: "do Phase 0").
Extractor scripts/program2-extract-dataset.mjs walks the sealed Step 4
archive fail-closed (provenance SHA enforced per trace) and emits v1 datasets
to ~/.machinespirits-data/program-2/datasets/v1/: taskA-sft 141 rows
(compliant + original-accepted + leak-clean; the 40 compliant-via-repair
turns are excluded from SFT and retained in eval), general-sft 1,096, kto
2,076 (1,096 true / 980 false), eval-moments 645 (with sealed-trace pointers
for the offline graders), splits.json (seed 20260718, 64/8/8 dialogues
stratified family x profile). Counts reconcile EXACTLY with plan §4 and the
independent Step 4 analysis tallies; leak-filter loss 0%. Training inputs use
original-role model_call requests only (repair-role prompts excluded — they
carry repair instructions). Register/headroom tarballs deferred to a v2
dataset if Phase 3 wants a larger general pool. Manifest:
config/adaptive-tutor-evidence/program-2-dataset-v1.manifest.json; report:
notes/program-2/2026-07-18-phase0-extraction.md. Next: Phase 1 floor
(offline grader + untuned base), then the Phase 2 freeze.

2026-07-18 Claude: PHASE 1 COMPLETE — gate passes (floors measured, report
written: notes/program-2/2026-07-18-phase1-floors.md). Grader
(scripts/program2-floor-grader.mjs) composes frozen machinery only; fidelity
by replaying all 645 sealed moments: 99.83% verdict agreement warrant_skip,
100% stagnant_repeat, residual divergence confined to guards_passed and
conservative. Four floors, 120 moments x greedy+sampled each, zero endpoint
errors; held-out greedy: qwen3.5:9b-instruct 0.362, qwen3.5:4b 0.241,
qwen3:8b (prev gen) 0.121, qwen3.5-9b-base (flattened shape, q8 GGUF via
ollama after MLX serving proved ~8.8min/gen) 0.103. Readings: one model
generation tripled the floor (latest-versions rule measured); scale anatomy
flip (4B misses the cue like the frontier, 9B breaks question discipline);
base << instruct at floor — the alignment layer CARRIES the warrant move
pre-training (H1's contest sharpened); thin-ego pathology visible pre-train
(base guardOk ~0.5). Tuning-stack entrypoint verified (mlx-lm 0.31.3 LoRA
loads and parses); the 10-example local training smoke was DROPPED after it
crashed the workstation (MLX training stacked on resident ollama models
exceeded 36GB RAM) — stack-proof deferred to the Phase 3 training
environment itself (cloud GPU, already user-approved), where it must be
demonstrated regardless and proves the environment that actually trains.
Manifest:
config/adaptive-tutor-evidence/program-2-floors-v1.manifest.json. Next: the
Phase 2 prereg freeze (thresholds vs these floors; freeze flattening
template + serving pin) — user gate.

2026-07-18 Claude: PHASE 2 FROZEN on the user's go ("commit the prereg").
PROGRAM-2-PHASE2-PREREGISTRATION.md pins: HF revisions (instruct c2022362,
base 68c46c4b), training-data SHAs (865/865/1,676 rows; base re-exported as
prompt/completion so BOTH arms train completion-only loss), the flattening
template promoted to program2-base-flatten.v1 (unchanged from the
floor-producing draft), frozen training scripts
(scripts/program2-train-{sft,kto}.py: LoRA r=32 alpha=64 all-linear, lr
1e-4, 2 epochs, bf16, seed 20260718; KTO conditional, lr 5e-6, from-SFT
adapter), <=4 licensed runs, per-arm serving pins matching each floor
(instruct Q4_K_M chat shape; base q8_0 flattened shape), primary gates
P1-P4 (floor+0.15 -> instruct >=0.512 / base >=0.253; paired-moment
bootstrap 5,000 draws seed 20260718 CI>0; absolute >=0.30; leak
non-inferiority +0.10), blinded-quality gate (20 pairs, sonnet-class
isolated reviewer, fail at >=2/3 dispreferred), seam bar frozen for the H5
bake-off (detection <=0.65 at n=40), decision grammar incl. the iron-cage
table and the base-reaches-0.362 descriptive line. Out of scope: Task B,
bake-off execution, live Phase 5, dataset v2. Next: user's go to execute on
Lambda per the runbook.

2026-07-21 Claude: PHASES 5 + 5B FOLDED INTO THE PAPER as new §6.21
(v3.0.221, commit 71b063d8 on branch claude/program-2-adaptation-offshoot):
Phase 5 E1 FAIL (+0.040, CI [−0.054, +0.133]) with the component anatomy
(cue +0.165 / one-question −0.218) and the unchecked-fallback diagnosis;
Phase 5b battery extension (greedy check → two resamples → cue-preserving
trim) E1b PASS (0.386 vs 0.150, CI [0.128, 0.354]; exactly_one_question
0.720→0.976, other components unmoved); coverage no-tax and seam parity in
both runs (0.500 then 0.600, bar ≤ 0.65); the 5b safety-guardrail formal
FAIL with the turn-9 release-schedule anatomy; the world-lexicon rescore
labeled exploratory (frozen six-word instrument stands, decision
2026-07-20); runtime pin + both amendments recorded as instrument
provenance. §7.12's successor parenthetical extended; §6.18/§6.19/§6.20
Phase-4 content untouched; KTO + 5c NOT folded (in flight, own folds when
sealed). Validators: paper-manifest 60/0/0, integrity-audit 17/12/0,
provable-discourse 81/18/0 (pass/warn/fail). Companion subordinate doc:
docs/research/committee-architecture.md (card
committee-architecture-offshoot-doc).

2026-07-20 Claude: PHASE 5B (remedy 1) EXECUTED — E1b PASS. 18/18 sealed
(12 committee-v2 + 6 fresh controls, pooling licensed), zero attrition.
Committee-v2 0.386 vs pooled control 0.150, diff +0.236, CI
[0.128, 0.354] — the frozen bar cleared decisively; live rate matches the
offline composite (0.448 reference). Mechanism surgical:
exactly_one_question 0.720→0.976, all other components unmoved; fallback
ledger 19 resamples + 8 trims + 4 greedy + 1 unchanged. Coverage PASS (no
tax); seam PARITY (0.600 ≤ 0.65); safety guardrail formally FAILS
(0.42 vs 0.61) with exonerating anatomy — universal turn-9
release-schedule leak, all arms both runs, 4/5 committee failures on
frontier-authored turns. Amendment 1 mid-run (prompt-model dedup
recovery, fed34fd0) after endgame verdict echoes killed 2 early attempts.
Prereg §8 + manifest program-2-phase5b.manifest.json + archive
~/.machinespirits-data/program-2/phase5b-live. Licensed reading: the
Phase 5 loss WAS the unchecked fallback path; with the battery closed
over every delivered text, span-level form-ownership beats the frontier
live at no coverage cost (exploratory, single family/world). Remaining
menu: KTO (licensed, turnkey), iterated exhaust (dataset ready, needs
prereg), instrument v2 (parked by user decision).

2026-07-20 Claude: PHASE 5 EXECUTED AND CLOSED — 24/24 sealed, zero
attrition, verdicts in prereg §9 + memo
notes/program-2/2026-07-20-phase5-live-pilot-results.md + manifest
program-2-phase5-live-pilot.manifest.json. E1 FAIL (+0.040, CI
[−0.054,+0.133] — offline composite gain does not survive live coupling);
E2 intermediate (−0.014, no tax signal — the §6.19 enforcement trade NOT
reproduced by span ownership); E3 PARITY (seam detection 0.500 = chance,
continuity identical). Mechanism located: trained cue form transfers
(+0.165) but the unchecked fallback path leaks second questions (−0.218);
fallback-trim counterfactual 0.347 vs 0.160 (+11 moments). World-lexicon
sensitivity (exploratory): control 0.469 vs committee 0.320 — the frontier
was better at evidence-anchored questioning than the six-word instrument
showed; the tune taught the audit's letter. Main-stack launch aborted
first (2026-07-17 guard hardening dead-ends this config — Amendment 1);
executed on pinned claim-run runtime 91b8a50e + c4364dc0. Post-pilot menu
(unlicensed): fallback battery extension, cue-robust detector v2, iterated
exhaust, the still-licensed KTO runs.

2026-07-20 Claude: PHASE 5 FROZEN + MACHINERY LANDED (user go: "Do the live
pilot"), commit d10d6a9e. PROGRAM-2-PHASE5-LIVE-PILOT-PREREGISTRATION.md
pins the live committee pilot: committee vs silent_control (2 arms x 2
profiles x 6 repeats = 24 dialogues, sonnet-family, Step 4 operational spec
verbatim, seed 20260718); endpoints E1 live warrant compliance (CI>0), E2
coverage@16 tax vs the frozen -0.05/-0.10 margins, E3 seam at the frozen
<=0.65 bar; density precondition >=15 warrant opps/arm. Machinery: additive
Phase 5 arms beside the byte-unchanged Step 4 registry; fail-closed
committee first draft in the speaking call (local mini on the Phase 2
serving pin -> question span -> frontier composition -> containment +
one-question battery -> mini fallback; standard delivery guards identical
across arms); runner with zero-model gate + sha-pinned launch +
sealed-trace resume; frozen analyzer. Smoked zero-paid: 24-job plan gate
PASS, local mini produces the trained move (7s), sonnet + terra CLI probes
alive. Related-work sweep salvaged in-loop after the workflow's synthesis
agent died on a spend limit: notes/program-2/2026-07-20-related-work-sweep.md
(23 verified claims; span-granular composition and verified-exhaust
distillation precedented as categories — the fail-closed protected-span
conjunction, failure-anatomy seam placement, and the base-vs-instruct
conduct decomposition have no found precedent). Launch is human-gated:
node scripts/run-program2-live-pilot.js --launch-approved --expected-sha
d10d6a9efd0b9d3516c3acd6f6f528333754f56e.

2026-07-19 Claude: PHASE 4 EXECUTED — SFT verdicts + coupling probe. Training
(Lambda H100, both SFT runs, ~$8) clean; evaluation survived four instrument
faults, each caught by a check before any wrong number was accepted (partial
scp; MTP layer dropped by conversion -> loader refusal; SILENT NO-OP MERGES
from wrong model class, exposed by 95% byte-identical base outputs and fixed
with a verified-weight-delta merge; instruct floor re-measured same-lineage
after ~5pt GGUF build noise was isolated). FROZEN VERDICTS (same-lineage
held-out greedy, n=58): instruct 0.414 vs floor 0.310 (+0.103, CI
[-0.017,+0.224], bar 0.460) — FAILS P1/P2, passes P3/P4: partial parametric
traction; warrant-cue failures 19->6 (dev 22->3) with conduct intact. Base
0.103 vs 0.103 flat — cue trained (43->9) but guards collapsed (0.52->0.19
guardOk) and leaks worsened past tolerance (P4 FAIL): thin-ego pathology as
predicted. IRON-CAGE READING INVERTED: the cue trains into both variants;
the incumbent alignment layer is the scaffold that lets it integrate, not
the obstacle. Amendment 1 licensed the offline protected-span coupling
probe without a solo pass (measured complementarity): composed-alone 0.293
(frontier re-adds extra questions even under instruction — checks
load-bearing, as H4 predicted), FAIL-CLOSED SYSTEM 0.448 (+0.034 over mini
solo, 2 rescued moments), still under the 0.460 bar. Structural note for
the writeup: 14/58 moments carry a due premise release, making compliance
impossible-by-construction under the frozen released==0 component — the
achievable ceiling is ~0.76, so tuned solo = 55% and the composite = 59% of
achievable. Both KTO runs remain licensed and unspent (Lambda unavailable
~24h at probe time). Artifacts: floor/tuned/composed JSONs + probe script
scripts/program2-coupling-probe.mjs + grader --grade-file mode +
verified-merge script scripts/program2-merge-adapter.py.
