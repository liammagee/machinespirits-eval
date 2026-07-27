---
id: program-2-phase5d-second-transfer-world
title: "Program-2 Phase 5e: second transfer world (letter-hostile probe)"
status: active
type: experiment
priority: P2
owner: codex
source: manual
created: 2026-07-22
updated: 2026-07-27
branch: codex/program-2-phase5e-r2-replication
verification: "R2 first clears a certified four-dialogue exact-pipeline pilot (one row per profile x arm, 11-check cohort-bound provenance, all-row coverage/safety and projected eligible-opportunity gates), then the 18-dialogue apparatus-corrected cohort clears E1e (handoff-eligible warrant_skip compliance diff vs fresh Skyway controls, profile-stratified dialogue-bootstrap 95% CI > 0) under the frozen coverage, safety, density, attrition, and seam guardrails. R1 remains a separate negative delivery-stack observation and is never pooled."
claim_status: exploratory
links:
  paper: §6.21, §7.12
  notes:
    - PROGRAM-2-PHASE5C-CROSS-WORLD-TRANSFER-PREREGISTRATION.md
    - PROGRAM-2-PHASE5B-FALLBACK-BATTERY-PREREGISTRATION.md
    - PROGRAM-2-PHASE5E-SECOND-TRANSFER-PREREGISTRATION.md
    - notes/program-2/2026-07-26-phase5e-world-selection.md
    - notes/program-2/2026-07-26-phase5e-world-selection-amendment1.md
    - notes/program-2/2026-07-26-phase5e-analyzer-validation.md
    - notes/program-2/2026-07-26-phase5e-presentation-amendment.md
    - notes/program-2/2026-07-27-phase5e-r2-replication-freeze.md
    - notes/program-2/2026-07-27-phase5e-r2-pilot-amendment1.md
    - notes/program-2/2026-07-27-phase5e-r2-pilot-amendment2.md
    - config/adaptive-tutor-evidence/program-2-phase5c.manifest.json
    - config/adaptive-tutor-evidence/program-2-phase5e-world-selection.json
    - config/adaptive-tutor-evidence/program-2-phase5e-world-selection-amendment1.json
    - config/adaptive-tutor-evidence/program-2-phase5e-r2-gates.json
    - config/adaptive-tutor-evidence/program-2-phase5e-r2-pilot-gates.json
  items:
    - program-2-context-vs-weights-finetune
tags:
  - tutor-stub
  - fine-tune
  - move-library
  - cross-world-transfer
milestone: adaptive-tutor-evidence-v1
---

Second point on the transfer curve, aimed at the one live objection 5c
left standing. 5c's world (gazette-recall) is *letter-friendly*: newsroom
English natively speaks the frozen six-word cue rule ("record" above
all), lifting BOTH arms' compliance floors (control 0.306 there vs
0.150–0.160 on Marrick). The committee's edge held on top, but a skeptic
can ask whether the specialist wins only on worlds that already talk like
the audit. Phase 5e picks the *letter-hostile* sibling — minimum native
frozen-six density — so the mini must BRING the cue-bearing form rather
than find the vocabulary lying around. Pass = second zero-retraining
validation, on hostile ground (move-library concept strengthens from
concept toward practice). Fail = the component + costume-leak anatomy
separates vocabulary-miss (cue never appears) from form erosion (question
discipline slips) — either locates the library's boundary and triggers
the retrain-on-failure branch (failed world's exhaust joins the pool).

Artifact under test is frozen with no ambiguity left: the KTO close-out
(2026-07-21, card program-2-context-vs-weights-finetune) found both KTO
runs byte-identical to SFT at the serving pin, so `program2-sft-instruct-v2`
IS the final offline artifact. span-v2 exists offline (§6.22) but 5d pins
span extraction + both batteries byte-unchanged from 5b/5c — one change
at a time; the only moved variable is the world.

## Runbook (step-by-step; paid steps gated on the committed prereg)

**0. Preconditions (free).**
- Create a fresh isolated experiment worktree from then-current `main` and
  confirm that it contains the post-PR-150 Program-2 runtime reconciliation.
  The archived Phase 5 runtime is provenance only: do not resurrect
  `../ms-phase5-pinned` as an execution line. Freeze the fresh worktree's exact
  SHA before any paid call. This card deliberately reuses the Phase 5b/5c
  committee-v2 + fallback-v2 design; committee-v3 is out of scope unless a
  separate preregistration changes the causal question.
- `claude auth status` — the CLI logged itself out between 5b and 5c;
  probe BEFORE building anything. `codex` probe too at step 6.
- Confirm ollama serves `program2-sft-instruct-v2`
  (`curl -s localhost:11434/api/tags`).

**1. World selection measurement (free; numbers go in the prereg).**
- Candidates = non-period siblings not yet used: 022 foxtrot-jukebox
  (4 premises/2 rules), 023 greyfen-lab (5/4), 024 emberwick-forum (5/4),
  025 tallow-street (6/6), 026 skyway-bakery (5/5), 028 larkspur-fridge
  (4/2). All have zero derived-lexicon overlap with Marrick (measured
  2026-07-21).
- Letter-hostility metric, mechanical: count frozen-six word-boundary
  matches (evidence|item|test|record|fact|rule, + 's/es suffixes) in the
  full world-YAML prose (stage, glosses, premise text) per 1k words, via
  a 10-line node script against the fresh experiment worktree's
  `config/drama-derivation/*.yaml`. Rank ascending. NOTE greyfen-lab is
  likely disqualified ("test" is native lab vocabulary — measure, don't
  assume); gazette scored high on "record", which is the confound this
  probe removes.
- Structure floor: prefer ≥ 5 rules (tallow-street 6/6 is the strongest
  remaining). If the letter-hostility winner is a floor world (2–4
  rules), the prereg must either accept the density gamble EXPLICITLY
  (with a raised n) or take the best letter-hostile world above the
  floor. Freeze the trade-off in the prereg's world-selection section
  with all measured numbers.

**2. Write + freeze the prereg (free).**
`PROGRAM-2-PHASE5E-SECOND-TRANSFER-PREREGISTRATION.md`, modeled §-for-§
on 5c's: §1 question (letter-hostility), §2 artifact (same clause, KTO
moot per close-out), §3 world selection (measured table), §4 design —
10 committee-v2 (2 profiles × 5) + 8 fresh controls (2 × 4), plan/stub
seed = launch date YYYYMMDD, NO pooling with any prior controls
(5/5b/5c all excluded — different worlds), same paid-smoke clause
(`--auto-turns 8`, separate smoke root, GO = ≥1 committee moment with
non-empty mini + ≥1 extractable span + zero serving errors), §5
endpoints — E1e frozen v1 audit CI > 0 (dialogue-cluster bootstrap,
5,000 draws, seed = plan seed, profile-stratified); coverage ≥ control
− 0.05; safety ≥ control − 0.10; density ≥ 15 committee opportunities
with proof_skipper contributing; seam harness verbatim ≤ 0.65
(realized-n clause); costume-leak metric IDENTICAL to 5c (Marrick
lexicon − new-world lexicon − frozen six; committee mini-authored
delivered text vs control-arm base rate; 31.8/1k home saturation and
5c's 0.0/1k as references); NEW descriptive: native frozen-six density
in control-arm delivered turns (the letter-friendliness measure, so
5c-vs-5d floors are comparable); §6 reading grammar (pass/fail rows as
above; density-fail row = descriptive only); §7 attrition verbatim from
5c (one same-seed retry, second failure = attrition, 3-consecutive
abort); §8 cost ≈ ≤700 sonnet + ≤1,000 terra + 40 seam calls, no
Lambda, no training, out-of-scope list (any artifact change, span-v2,
pooling, additional worlds).

**3. Machinery (free).**
- Runner: add `PHASE5E_SPEC` (world, seed, 5+4/4+4 repeats, fallback
  'v2') + `buildPhase5eLivePilotPlan` + `validatePhase5eLivePilotPlan` +
  a `'5e'` row in main()'s planTable — the world is already
  parameterized in `commandForJob`, so this is the 5c block copied with new
  constants. Root `exports/program2-live-pilot-5e`.
- Analyzer: copy `scripts/analyze-program2-live-pilot-5c.mjs` → `-5e.mjs`;
  change BOOT_SEED (= plan seed), TRANSFER_WORLD default, schema string;
  add the native frozen-six density count. Validate by pointing it at
  the sealed 5c root (extraction paths must reproduce 5c's committee
  31/61 and component rates; CI differs — seed differs — that is
  expected and says so in the validation note).
- Zero-model gate the experiment checkout:
  `node scripts/run-program2-live-pilot.js --dry-run --plan 5e` — expect 18
  jobs, world flag on every
  command, fallback v2 on committee only. Regression: rebuild 5/5b/5c
  plans with the same `--output-dir`, planSha256 must be byte-identical
  pre/post change.

**4. Freeze commit (before ANY paid call).**
Commit prereg + runner + analyzer in the fresh experiment worktree and record
that exact HEAD — it is the launch gate. Do not port the change to the archived
Phase 5 runtime. Recheck the worktree branch immediately before committing.

**5. Paid gate sequence (in order; abort on any failure).**
- ollama preflight (again — the launcher also runs it).
- Free mini warm-up: one native `/api/chat` call, `think:false`, temp 0,
  a two-message prompt in the NEW world's register with the side-coach
  warrant block appended; expect exactly-one-question span, ~7–15 s
  (also loads the model into RAM so dialogue 1 avoids a cold start).
- One-call quota probes via the experiment worktree's
  `services/cliProviderBridge.js`: claude-code/claude-sonnet-5 and
  codex/gpt-5.6-terra, "Reply OK".
- Paid smoke: the first committee job's command with `--auto-turns 8`,
  `--eval-job-id smoke-01`, `--trace-dir
  exports/program2-live-pilot-5e-smoke/traces/smoke-01`; verify GO
  criteria from the trace (parse `program2_committee_moment` events).
  Smoke fail → abort, report; serving fixes only.

**6. Launch (attended).**
`node scripts/run-program2-live-pilot.js --plan 5e --launch-approved
--expected-sha <experiment HEAD>` in the fresh experiment worktree, backgrounded
with a monitor on `^\[phase5\]` log lines (progress N/18, `attempt N
failed`, abort, `launch pass complete`). HANDOFF begin note when
dialogues start. Known failure signature: `Prompt audit failed for
tutor_stub_auto_learner: character_budget_exceeded` — the auto-learner
budget overflow; the runner retries same-seed once (5c: 1 recovered, 1
attrition). Push notifications at failures and completion. Sealed-trace
resume on relaunch.

**7. Close-out.**
- Analyzer `--json`; seam review from the MAIN repo:
  `node scripts/program2-seam-review.mjs --pilot-root
  <experiment-worktree>/exports/program2-live-pilot-5e --live --json ...`
  (40 reviewer calls).
- Archive `cp -R` the export root + smoke to
  `~/.machinespirits-data/program-2/phase5e-live/`.
- Manifest `config/adaptive-tutor-evidence/program-2-phase5e.manifest.json`
  WITH per-artifact sha256+bytes blocks (the 5c claim audit caught the
  missing hashes — sibling convention is mandatory).
- Results addendum §9 in the prereg; HANDOFF seal note (next free H
  number — check for collisions, H7 happened); log entry on THIS card +
  the parent card; `node scripts/workplan.js render && node
  scripts/workplan.js validate`; commit + push.
- Paper fold as its own commit (§6.21 fourth movement or §6.21
  addendum), version bump + revision entry, three validators, then the
  paper-claim-auditor agent on the diff before pushing.

2026-07-22 Codex: Migrated this unstarted probe from the now-completed Phase 5d
name to Phase 5e and removed the retired pinned-runtime instructions. The
stable card ID is retained for board links; the title, endpoint, artifacts, and
runbook now identify Phase 5e. Any launch starts from a fresh current-main
worktree and requires a new explicit authorization gate.

2026-07-26 Codex: Activated after explicit operator confirmation in a fresh
current-main worktree. The free world-selection measurement chose
`world_026_skyway_bakery` at 2.24 frozen-six matches/1k words: Emberwick was
lower at 0.00 but missed the frozen five-rule structure floor. This activation
licenses preregistration, runner/analyzer code, and zero-model validation only;
all quota probes, paid smoke, live launch, and seam review remain closed.

2026-07-26 Codex: Completed the free implementation slice. Added the frozen
Phase 5e preregistration; the `--plan 5e` 18-job runner plan; regression hashes
proving Phase 5/5b/5c plans are byte-identical; and the Phase 5e analyzer with
native frozen-six density over fresh-control delivered turns. The analyzer
reproduced sealed 5c extraction counts (31/61 committee, 15/49 control and all
component rates; its CI differs only because the preregistered seed changed).
The zero-model gate passed with 18 jobs, seed 20260726, Skyway on every command,
fallback v2 on committee only, and zero model calls. This is prelaunch
machinery, not a Phase 5e empirical result; every paid gate remains closed.

2026-07-26 Codex: The authorized eight-turn smoke passed, but the live launch
aborted at the configured three-consecutive-failure gate before any dialogue
sealed (0/18): the first control failed twice and the first committee unit
failed once. All three attempts reached Skyway's turn-9 `p_warm` launch-log
release and hit the same deterministic dramatic-release rejection
(`opaque_clue_release`, `missing_exhibit_action`). This is a technical abort,
not an empirical result; the unsealed traces are diagnostic and excluded. A
pre-result Amendment 1 changes only that release's presentation metadata to an
in-scene loftmistress reading, adds an exact zero-model fallback regression,
and preserves refreshed world-selection evidence separately. All design,
artifact, surface, proof, timing, and endpoint invariants remain frozen. A
restart must use `exports/program2-live-pilot-5e-r1/`, a new commit pin, and
fresh explicit paid authorization.

2026-07-27 Codex: R1 ultimately sealed 18/18 at launch SHA `470889d5` with
three recovered retries and no attrition. The frozen endpoint failed:
committee 5/62 (0.0806) versus fresh control 3/31 (0.0968), difference
−0.0161, bootstrap 95% CI [−0.0879, 0.0607]. Coverage, comparative safety,
density, and costume-leak guardrails passed; seam review was not run. A merged
closure re-score subsequently found that 16/18 could have closed at median
turn 10, saving 459/720 turns. The Phase 5e analyzer's post-hoc handoff anatomy
also locates all 20/20 questionless committee opportunities at turns where the
final handoff contract forbade a question. R1 is therefore retained as a
negative result for that exact delivery stack, not pooled as a clean transfer
estimate.

2026-07-27 Codex: Began the operator-selected option 2: a clean,
apparatus-corrected R2 replication on current main. The prospective amendment
pins the historical v1 evidence-use classifier explicitly, keeps the model and
artifact stack fixed, uses merged conclusion recognition, and intersects
detector candidates with the final handoff's question admissibility for both
committee and control. Added separate `5e-pilot` (4 jobs) and `5e` R2 (18 jobs)
certificate plans, frozen cohort gates, and a zero-model 11-check pilot-bundle
path with per-trace SHA-256 binding. No R2 paid call is authorized or has run.

R1 cost: one attended Max-plan sonnet + codex terra cohort; local mini free;
no Lambda and no training. R2 free preparation adds no model calls. Any R2
pilot, cohort, or seam cost remains separately gated.

2026-07-27 Codex: The first authorized R2 pilot launch stopped before provider
preflight because launch mode overwrote its own certificate-bound
`launch-plan.json` with runtime metadata, producing a deterministic hash
mismatch. No pilot model call ran. Launch runtime metadata now writes to
`launch-attempt.json`; the prepared plan remains byte-stable through certificate
validation, with regression coverage for both missing and invalid evidence.

2026-07-27 Codex: The subsequent certified R2 pilot sealed 1/4 dialogues and
then stopped under its frozen futility rule after the `proof_skipper`
silent-control job failed both permitted attempts. This is an apparatus-
feasibility failure with no treatment-effect estimate. Frozen replay analysis
located three delivery defects: a questionless assertion-gap completion loop,
a generic mandatory-closure fallback that discarded the learner's correct
public finding, and a Codex transport/schema policy violation with no known
tool event. Prospective pilot Amendment 1 repairs only those seams, pins exact
zero-model replays, retains fail-closed handling for known tool events, and
requires a new clean commit, export root, and certificate before one replacement
four-dialogue pilot. The 18-dialogue cohort remains closed.

2026-07-27 Codex: Replacement pilot A1 at SHA `69de4132` sealed its first two
jobs, then stopped under the frozen futility rule when the proof-skipper
control reached only 0.75 coverage. Both providers and transports were
healthy; exact trace replay instead found a missed natural-language
`p_soleLift` adoption, repeated grounded causal answers that were not resolved
to the authored answer constant, and due-release turns incorrectly counted as
no-new-premise warrant opportunities. Prospective Amendment 2 adds explicit
world-authored recognition clauses with public/entailed-state guards and
symmetrically suppresses due-release warrant candidates in committee and
control. Zero-model replay now reaches full coverage and grounded assertion;
all paid calls remain closed pending a fresh commit, certificate, and explicit
authorization.
