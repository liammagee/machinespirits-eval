# DRAFT FOR HUMAN REVIEW — GO, edged-register main block

**This draft licenses no paid call.** It becomes a GO note only when the
operator signs it, commits it, and starts the launch command with
`--launch-approved` on a clean checkout. Registration: Part 3 of
`notes/2026-08-16-edged-register-calibration-draft.md`, frozen at commit
`4cd28242`.

Main-block plan SHA-256:
`5fdae244543c7e017be4901a95db47a46095df8553df0f394813c0bd90e9d31d`

## What I approve

The paid main block: three versions of the tutor over the four kept
cells. A = adaptive-edged (cell 207, two-pass), B = yoked warm delivery
(cell 208), C = router-warm (cell 206, byte-identical to the calibration
arm). Warm-only menus in B and C; `face_threat` stays out of every menu;
sarcasm is a manner device only (§2.10, §3.6).

Size, copied from the runner's `--dry-run-main` output (exact test, as
§3.2 requires — this supersedes the ~95/~285 approximation):

> exact-test size: 104 rows per arm (26 per cell), 312 rows over 3 arms,
> power 0.803487 at baseline 0.479167 vs 0.679167
> 312 main jobs, hard cap 350 rows

Jobs interleave so every consecutive dozen covers all twelve
arm-by-cell pairs. Generation only; zero judge calls at generation time.

## Budget cap and priced calls

- Generated rows: **312 planned, hard cap 350** (state-carried; the
  runner stops at the cap).
- Generation calls: about 6,240 planned (the registered basis of ~20
  calls per row, §3.2), at most about 7,000 at the cap.
- Endpoint reader (`scripts/read-edged-register-endpoint.js`, one call
  per row, §3.4): 312 planned, at most 350.
- Register and stance readings, arm A only: the kept cells script 3, 3,
  3, and 2 learner turns, so at most four tutor turns per dialogue; at
  two readings per turn the bound is about 830 calls over arm A's 104
  dialogues. Only edged turns are read, so the real count is lower.
- Harm guardrail: zero calls (deterministic), every row.
- About 8 attended hours at 4 lanes (the registered pace, scaled from
  285 to 312 rows). Arm A speaks edged registers, so expect the
  person-attack matcher to pause more often than in calibration; every
  pause waits for my ruling.

## Pins, re-computed 2026-08-17 (§3.5)

| Pin | Frozen | Now | |
|---|---|---|---|
| Endpoint reader blob | `cd44d452` | `cd44d452` | unchanged |
| Corridor selector blob | `5455c766` | `5455c766` | unchanged |
| Calibration plan sha256 | `121b55d1…` | `121b55d1…` | unchanged |
| `endpoint-readings.jsonl` sha256 | `43e45b42…0936c` | `43e45b42…0936c` | unchanged |
| Runner blob | `07b1c0d6` | `6d453777` | **changed — disclosed** |

The runner changed in commit `7df6ebf6` (zero-call build): it gained the
main-block mode this note launches — per-job profiles, the state-carried
cap, and the paid gates, with 20 new tests. The reader rule stays frozen
at `b761bbbe` (§2.16.1). My signature below accepts the amended runner;
every other pin is unchanged.

Stack, carried in the plan and shown in the copied commands below:
generation codex `gpt-5.6-luna` both seats, judge claude-code Sonnet 5,
4 lanes, never nemotron/kimi.

## Seeds and batch id

Burn set from the run search (113 runs in `evaluation_runs` with an
`edged-register-calibration` description) and the archive repo: one
burned batch id, `batch-2026-08-17`. Fresh batch id for this block:
**`batch-main-2026-08-18`**. No other seed enters the design.

## Commands (copied, not composed)

Per-arm generation commands the runner will issue, copied from
`exports/edged-register-calibration/plan-main-block.json`:

```
node scripts/eval-cli.js run --profiles cell_207_id_director_edged_register_two_pass_adaptive_edged --scenario charisma_desire_resistance_breakthrough_question_flood_sustained --runs 1 --parallelism 1 --skip-rubric --tutor-model codex.gpt-5.6-luna --learner-model codex.gpt-5.6-luna --description edged-register-calibration <batch-id> main job 1 charisma_desire_resistance_breakthrough_question_flood_sustained attempt 1
node scripts/eval-cli.js run --profiles cell_208_id_director_edged_register_yoked_warm_delivery --scenario charisma_desire_resistance_breakthrough_question_flood_sustained --runs 1 --parallelism 1 --skip-rubric --tutor-model codex.gpt-5.6-luna --learner-model codex.gpt-5.6-luna --description edged-register-calibration <batch-id> main job 2 charisma_desire_resistance_breakthrough_question_flood_sustained attempt 1
node scripts/eval-cli.js run --profiles cell_206_id_director_edged_register_calibration_warm --scenario charisma_desire_resistance_breakthrough_question_flood_sustained --runs 1 --parallelism 1 --skip-rubric --tutor-model codex.gpt-5.6-luna --learner-model codex.gpt-5.6-luna --description edged-register-calibration <batch-id> main job 3 charisma_desire_resistance_breakthrough_question_flood_sustained attempt 1
```

Launch, from the runner's usage line — run after this note is committed,
with `<sha>` = `git rev-parse HEAD` on the clean checkout:

```
node scripts/run-edged-register-calibration.js --main-block --batch-dir exports/edged-register-calibration/batch-main-2026-08-18 --go-note notes/2026-08-17-edged-register-main-block-go.md --launch-approved --expected-sha <sha>
```

Watch and rule, from the same usage line:

```
node scripts/run-edged-register-calibration.js --status --batch-dir exports/edged-register-calibration/batch-main-2026-08-18
node scripts/run-edged-register-calibration.js --resume-decision <resume_unchanged|kill_cell:<scenario>|kill_study> --batch-dir exports/edged-register-calibration/batch-main-2026-08-18
node scripts/run-edged-register-calibration.js --report --batch-dir exports/edged-register-calibration/batch-main-2026-08-18
```

After the block, before anything else:

```
node scripts/archive-run-artifacts.js exports/edged-register-calibration/batch-main-2026-08-18
```

then commit in the archive repo and add the run's line to its
`RUN-LEDGER.md`.

## Stop rules

§2.7 carries forward whole (§3.6): any harm flag pauses generation
before the next dialogue and waits for my ruling; the only options are
`resume_unchanged`, `kill_cell:<scenario>`, and `kill_study`. One
attended resume per job; more needs my ruling. No widening, no model
change, no mid-run edit of the plan. I record no ruling while the runner
is still running.

This note licenses generation and the priced scoring calls above.
Endpoint analysis — the A-versus-C exact test on the reader's yes, the
A-versus-B read at the first edge moment — comes after the block, on the
frozen rules, and needs no new approval; any call beyond the priced
bounds does.

GO

— Liam Magee, <date>
