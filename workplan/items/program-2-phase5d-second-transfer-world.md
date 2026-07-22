---
id: program-2-phase5d-second-transfer-world
title: "Program-2 Phase 5e: second transfer world (letter-hostile probe)"
status: triaged
type: experiment
priority: P2
owner: unassigned
source: manual
created: 2026-07-22
updated: 2026-07-22
verification: "The Phase 5b/5c-validated committee (program2-sft-instruct-v2, fallback policy v2, span/battery byte-unchanged), moved unchanged to a THIRD world selected for minimum native frozen-six density (letter-hostile), clears E1e (pooled warrant_skip compliance diff vs the new world's own fresh controls, dialogue-cluster bootstrap 95% CI > 0) under the frozen guardrails (coverage −0.05, safety −0.10, density ≥ 15, seam ≤ 0.65) with the costume-leak metric reported both arms."
claim_status: exploratory
links:
  paper: §6.21, §7.12
  notes:
    - PROGRAM-2-PHASE5C-CROSS-WORLD-TRANSFER-PREREGISTRATION.md
    - PROGRAM-2-PHASE5B-FALLBACK-BATTERY-PREREGISTRATION.md
    - config/adaptive-tutor-evidence/program-2-phase5c.manifest.json
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

Cost: one evening of Max-plan sonnet + codex terra quota; local mini
free; NO Lambda, NO training. Both outcomes land in the paper.
