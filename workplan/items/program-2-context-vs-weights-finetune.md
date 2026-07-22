---
id: program-2-context-vs-weights-finetune
title: "Program-2: context-versus-weights fine-tune (form-carrier hypothesis)"
status: active
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-07-18
updated: 2026-07-22
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

2026-07-22 Claude: CUE-ATTRITION DECOMPOSITION + DECISION RECORD
(notes/program-2/2026-07-22-cue-attrition-observation.md; sealed 5b/5c
archives read-only). The 92%→38%→54% mini→span→delivered cue attrition
decomposes over the 17 achievable cue-failing 5b moments: 9 shipped text
that is NOT the committee-approved envelope (the clue-staging surface
replaces it after the battery runs; 7 of the 9 approved texts carried the
cue) and 8 are composed turns that never had the word (no cue check on
the composed path). Decisions on record: the six-word v1 instrument STAYS
(user, 2026-07-22); fix order when a rider is licensed = delivered-text
guard → mini-side span resampling → composed cue check only if needed;
run shape = small 5b-style prereg rider on the next planned run. The 5c
gate is RESOLVED in favor of the rider (E1c PASS + zero costume leak =
the form transfers; 5c's coverage-guardrail point-estimate FAIL travels
as the open cost question). Nothing licensed yet — rider prereg drafts on
user go.

2026-07-22 Claude (later): RIDER PREREG DRAFTED on user go —
PROGRAM-2-PHASE5D-DELIVERY-INTEGRITY-PREREGISTRATION.md (Status DRAFT,
NOT frozen; freezes on explicit go with SHA/seed pins). Pre-freeze census
reframed the leak upward: 47/83 5b committee moments (56.6%) ship text ≠
the approved envelope (all 34 due-release + 13 clue-staged; approved text
ships on only 36/83), same rate on 5c (34/61) but nearly cost-free there
(gazette staging language carries the lexicon) — Marrick cost is
lexicon-specific. Design: committee-v3 = v2 + spanCue.v1 (resample mini
until the question sentence carries a cue) + deliveryGuard.v1 (clue-staged
turns only: swap the staged final question for the protected span;
premise-release turns untouched); 12+6 on marrick, pooling rule over 18
archived controls; E1d primary + M1/M2 mechanism bars + mandatory seam
re-check; prediction ≈0.55 registered as descriptive reference. Note
addendum §8 records the census.

2026-07-22 Claude (freeze): PHASE 5D FROZEN on user go ("freeze it") —
seed 20260722; lineage 91b8a50e + machinery e9b01bdd; design/endpoints/
bars/pooling/reading grammar locked. Remaining are launch gates, not
freeze gates: implement spanCue.v1 + deliveryGuard.v1 on the pinned
lineage (SHA recorded at launch), zero-paid smoke incl. a dry staged-turn
swap, 5c-style sha-pinned human-gated launch sequence. No paid call
before all three.

2026-07-22 Claude (machinery): PHASE 5D MACHINERY LANDED + SMOKE PASS —
spanCue.v1 + deliveryGuard.v1 + the '5d' plan/launch table implemented on
the pinned lineage (branch claude/program-2-phase5d-machinery, 6423de2f,
pushed; policies default OFF so the 5/5b/5c replication paths are
byte-unchanged). Zero-paid smoke 10/10
(scripts/run-program2-phase5d-smoke.js): plan gate (18 jobs, committee-v3
flags on committee arms only), dry committee moment on the real 5b staged
texture with the swap re-audited COMPLIANT by the frozen detector, full
skip taxonomy, live mini probe (greedy 6.1s / sampled 0.5s). Prereg §8
launch gates 1-2 ticked with the SHA; the one remaining gate is the
sha-pinned human-gated launch sequence (fast-forward ms-phase5-pinned to
6423de2f, zero-model gate, preflight, probes).

2026-07-22 Claude (RESULTS): PHASE 5D RUN COMPLETE — E1d + both
mechanisms PASS. 18/18 sealed on marrick (seed 20260722, launch pin
27aae3b7 after Amendments 1-2: CLI sonnet-5 alias, parseArgs whitelist),
zero attrition, 2 same-seed retries. E1d PASS: committee-v3 42/88
(0.477) vs pooled control 22/162 (0.136), +0.341 CI [0.223, 0.457] —
up from 5b's 0.386/+0.236; 76% of the live due-release ceiling (55/88)
vs 5b's 65%. M1 (guard-eligible delivered cue) 13/15 = 0.867 ≥ 0.75
PASS; M2 (span cue) 74/85 = 0.871 ≥ 0.85 PASS (5b 0.37). Coverage PASS
(0.625 vs 0.632, no tax). Safety FAIL 0.50 vs 0.63 — same marrick turn-9
release-schedule leak, arm-symmetric (5/7 committee + 2/2 control at
turn 9), exonerated per 5b/5c. Guard ledger: 15 applied swaps, 33
premise-release skips, 37 shipped-as-approved. Prereg §9 results +
manifest program-2-phase5d.manifest.json + analyzer
analyze-program2-live-pilot-5d.mjs + archive
~/.machinespirits-data/program-2/phase5d-live. REMAINING: mandatory seam
re-check (separate PAID harness, prereg §4) — not yet run; and the paper
§6.21 fold once seam lands.

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

2026-07-21 Claude: PHASE 5C (cross-world transfer probe) EXECUTED — E1c
PASS. Prereg frozen at 4bb1253f
(PROGRAM-2-PHASE5C-CROSS-WORLD-TRANSFER-PREREGISTRATION.md), machinery on
the pinned runtime at e9b01bdd; the 5b-validated artifact
(program2-sft-instruct-v2, fallback policy v2, no KTO) moved UNCHANGED to
world_027_gazette_recall — max costume distance among structurally
comparable siblings (zero derived-lexicon overlap; 022/026/028 floor
worlds rejected as density gambles). 17/18 sealed (9 committee-v2 + 8
fresh controls, no pooling with Marrick controls), 1 attrition (p5c-14,
deterministic auto-learner budget overflow both same-seed attempts —
first attrition in the program), 1 recovered retry, no abort; smoke GO
pre-launch. VERDICTS: E1c 0.508 vs 0.306, diff +0.202, CI [0.072, 0.338]
— the specialist beats the frontier on a world it never saw, above its
own home-world rate (0.386); costume leak ZERO over all 61 delivered
committee units (control base 4x generic "fair"; home-world saturation
reference 31.8/1k words) — the trained warrant move is a form, not a
costume; seam PARITY (0.515, 13+20 windows realized-n); safety PASS
(0.89 vs 0.88 — no turn-9 analogue, confirming 5b's anatomy as a Marrick
world property); coverage guardrail FAIL by point estimate (−0.061 vs
−0.05 margin, miss 0.011, CI [−0.197, +0.053] spans zero at n=9) —
caveat carried on the §6 row-1 reading, not excused. LICENSED READING:
move-library concept live (train once, validate per world, retrain only
on failure), coverage-caveated, exploratory tier (single family, one
transfer world). Manifest program-2-phase5c.manifest.json; archive
~/.machinespirits-data/program-2/phase5c-live (adapters store untouched);
prereg §9 addendum. Paper fold pending (own fold, per the §6.21 pattern).

2026-07-22 Claude: STANDING DECISIONS RECORDED (thread close-out).
(1) Live terra half-flip: stays SKIPPED (user decisions 2026-07-21 and
2026-07-22) — the composer-dependence question is answered offline
(§6.22); a live flip would only widen the already-scoped single-family
claim. (2) Span-extraction v2 live adoption: SHELVED, no dedicated run —
KTO came back byte-identical (no new artifact needs a live validation to
piggyback on) and the arc is closing; v2 stays offline-validated in
§6.22 with the live machinery untouched (verified: pinned worktree
program2CommitteeEngine.js still v1). Reopen condition: the next real
deployment or fresh curriculum adopts v2 live as a 5b-shaped
single-change run first (sonnet, pooled controls under the stationarity
check, ~12 committee dialogues), family chosen freely afterward.
Estimated cost if ever run: live terra flip ≈1,250–1,450 terra calls +
~40 sonnet (2×6 + smoke + retry headroom); v2-on-sonnet ≈ half that with
control reuse. Companion doc card committee-architecture-offshoot-doc
CLOSED (both follow-ups incorporated).

2026-07-21 Claude: PROBES FOLDED INTO THE PAPER as new §6.22 (v3.0.224):
composer-seat family-invariance (v1: 0.293/0.448 identical both families,
56/58 agreement, zero composer-added questions), the extraction-dropped-cue
decomposition, span-v2 conversion (0.586/0.603, rescued 10/11, 77–79% of
the offline ceiling), and the bounded sonnet added-question asymmetry
(3/53 vs 0/54). §6.20's "re-added extra questions" attribution corrected
in place with a dated erratum appended to
PROGRAM-2-PHASE2-PREREGISTRATION.md; new manifest
program-2-terra-probe.manifest.json (8 artifact SHAs);
committee-architecture.md brought consistent (§3/§4 table incl. 5c row/
§10 5c-passed/§11 bounds; header v3.0.224). Also cherry-picked the ~55%
ceiling correction onto this branch as v3.0.223 (relabeled from the other
session's v3.0.222; 5c fold holds that number here). Validators:
paper-manifest 60/0/0, integrity-audit 17/12/0, provable-discourse
81/18/0.

2026-07-21 Claude: TERRA COMPOSER PROBE SEALED (offline exploratory, branch
claude/program-2-terra-composer-probe, ~58 terra calls). The composer seat
is family-invariant at the audited letter: terra delivered 0.293 /
fail-closed 0.448 / 2 rescued — byte-identical to the sonnet Phase 4
references, 56/58 per-moment agreement. Zero composer-added questions in
either family; the composed-alone penalty is span extraction dropping the
mini's cue-bearing statement sentences (cue failures 6→22 in both
families; 20 droppable; 3 restored each). Terra held containment slightly
better (1 span_lost vs 3). Flags: §6.20's "re-added extra questions"
clause erratum-track (mechanism attribution, number unaffected);
cue-preserving span-extraction v2 = highest-value offline lever (13
cue-only composed failures per family). Note:
notes/program-2/2026-07-21-terra-composer-probe.md; HANDOFF H9. Live
half-flip (terra tutoring) remains unlicensed/unrun — user decision
2026-07-21: skipped (composer-dependence was the concern; answered
offline). SAME DAY, v2 LEG SEALED (user go "go ahead with the extraction
fix"): cue-preserving span extraction (--span-mode v2, default v1
byte-preserved) converts the full lever in both families — delivered
0.293 → 0.586 (sonnet) / 0.603 (terra), fail-closed 0.448 → same,
rescued 2 → 10/11, 77–79% of the 0.759 achievable ceiling; residual =
premise/guards (extraction-independent); family-invariance holds (55/58
agreement); new asymmetry: sonnet adds a 2nd question in 3/53 v2 turns,
terra 0/54 (erratum nuance). Offline exploratory; live machinery
untouched; v2 live adoption = separate unlicensed decision.

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

2026-07-21 Claude: KTO EXECUTED AND CLOSED — both licensed runs spent,
verdict BEHAVIORALLY INERT. Training clean (H100, ~21 min/arm, loss flat
at 0.5); merges verified by the reconstructed script (the Phase 4 fix had
never been committed — stale copy produced one caught-and-deleted no-op;
fixed script now at a05fa3c9 with lora_B + probe-delta assertions).
Graded at the serving pin: 58/58 byte-identical generations to SFT on
BOTH arms; paired KTO-vs-SFT CI [0.000, 0.000]; every gate lands at the
SFT numbers (instruct 0.414 vs bar 0.460 P1 FAIL; base 0.103 = floor).
Reading: the frozen conditional recipe's weight motion is below the
quantized-serving threshold — the offline solo ceiling stands at SFT.
Licensed-run ledger fully spent (2 SFT + 2 KTO). Prereg closing addendum
1fda8f29. The program's positive line remains the live committee
(5b E1b PASS 0.386 vs 0.150; 5c cross-world PASS 0.508 vs 0.306, other
thread). Remaining unlicensed options: iterated exhaust (dataset ready),
instrument v2 (parked by user decision).

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

2026-07-21 Claude: §6.20–§6.22 HEADLINE NUMBERS REGISTERED AS
MACHINE-CHECKABLE CLAIMS (branch claude/program-2-terra-composer-probe).
An independent claim audit found none of the three validators
machine-checked any Program-2 paper content — the "~110 vs 162"
call-count drift survived all three and was caught only manually. Now:
35 claims + 2 family-invariance symmetry rules in new
config/provable-discourse-program2.yaml (epoch "2.0", imported by the
main spec), anchored to the five checked-in Program-2 manifests via a
new generic artifact_json evidence type in services/provableDiscourse.js
(dot-path + capture-pattern extraction; fingerprint carries the artifact
file's sha256, so any manifest change flags every claim on it as
stale-claim risk); the 34/83 + 49/83≈0.59 live-ceiling correction
anchors to the 5b prereg §8 annotation via code_path. The terra manifest
gained a derived callCounts block (bySource per paid leg recounted from
the sha256-pinned delivered files: 54+54+54 = 162) so the corrected
total is artifact-anchored. paper:integrity-audit now prints a
legacy-scope banner (Paper 2.0 claims → provable-discourse). Registered:
§6.20 0.414/0.310, 0.293, 0.448, 0.276, 14-of-58 + n=58, ceiling ≈0.76;
§6.21 P5 rates + +0.040 CI [−0.054,+0.133], 5b rates + +0.236 CI
[0.128,0.354] + due-release denominators, 5c rates + +0.202 CI
[0.072,0.338]; §6.22 v1 0.293/0.448 both families (symmetry-ruled), v2
0.586/0.603, composer calls 54×3 ≈ 160. Snapshot surgically baselined
(35 new entries only; the 18 pre-existing warns left visible for their
owners). 6 unit tests added (69/69 pass). Validators: provable-discourse
118/18/0 full, 136/0/0 smoke; paper-manifest + integrity-audit
unchanged.
