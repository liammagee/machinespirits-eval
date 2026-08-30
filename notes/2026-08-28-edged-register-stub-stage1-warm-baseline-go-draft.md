# Edged-register stub replication — Stage 1 warm baseline GO note

**SIGNED. The operator gave GO in session on 2026-08-27 and the launch
was approved in the same message. This note licenses Stage 1 only.**

Workplan item: `edged-register-stub-dag-replication`.
Design (registration): `notes/2026-08-28-edged-register-stub-dag-replication-design.md`.

## What Stage 1 is

A warm-only calibration block. It measures the warm-arm baseline the
power calculation needs — coverage mean and spread, closure rate,
cap-death rate, mean turns per persona — on the pinned stack. It tests
no hypothesis. Its rows are calibration only and are **never pooled
into Stage 2** (the arms must be concurrent; that was the parent
study's limit 1).

It is also the first live pass through the new machinery: the
`fixed_warm` policy (launch-time and turn-time fail-closed pins,
commits `7c3bce13` and `6e0b54ac` in the study worktree), the fidelity
read pass, and the trajectory second pass all run on real transcripts
here before Stage 2 depends on them.

## Launch command

Copied from the runner's own `--print-plan` output (2026-08-28, plan
resolved to 48 rows, world_005_marrick, strict_dag, all three seats
codex.gpt-5.6-luna, register palette warm,sarcastic, run seed
20260711). The launch command is the same invocation without
`--print-plan`:

```bash
node scripts/run-tutor-stub-qa-matrix.js \
  --policies fixed_warm \
  --profiles bored,affective_resistant,proof_skipper,diligent \
  --runs 12 \
  --turns until-grounded --safety-turns 40 \
  --register-palette warm,sarcastic
```

Before launching, the operator re-runs it with `--print-plan` and
checks the header still says: 48 expected rows, policies
`fixed_warm` only, world `world_005_marrick`, DAG mode `strict_dag`,
palette `warm,sarcastic`, and `codex.gpt-5.6-luna` in all three model
seats. Never nemotron/kimi in any seat. The launch shell must not
export `TUTOR_STUB_LIGHT_ADAPTATION`: a fixed-register arm now refuses
to start with light adaptation on, so a leftover export crashes the
launch at boot instead of silently unpinning turns.

## Spend ceilings

- Generation: 4 personas × 12 runs = **48 dialogues**, each capped by
  the runner's own `--model-call-budget 120`. Hard generation ceiling:
  **5,760 model calls** (48 × 120), enforced per dialogue by the
  runner. Realistic cost is far lower: dialogues end at grounding, and
  the design's estimate is roughly 6 calls per turn across the three
  seats.
- Fidelity read (after generation): one Sonnet 5 read per tutor turn.
  Ceiling at the safety cap: **1,920 reads** (48 × 40); expected well
  under, since grounded dialogues end early. The pass is cached and
  resumable in pieces with `--limit`, so it can be stopped and
  restarted at any point at no repeated cost.
- No other paid call is part of Stage 1.

Attended and pausable, per the standing rule for long runs. No
resampling after a failure — a failed row counts against reliability
and is not replaced.

## After the run (in order)

1. Trajectory second pass (pure computation, no model calls):

   ```bash
   node scripts/analyze-tutor-stub-trajectories.js <qa-root> --out <qa-root>/trajectories.md
   ```

2. Fidelity read pass (paid, Sonnet 5, ceiling above). Stage 1 has no
   sharp arm, so every read is the warm-arm leak check — report-only —
   and the pass doubles as the end-to-end test of the instrument
   before Stage 2:

   ```bash
   node scripts/read-stub-fixed-register-fidelity.js <qa-root> --out <qa-root>/fidelity.md
   ```

3. Archive (run artifacts are not backed up by git):

   ```bash
   npm run archive:runs
   ```

`<qa-root>` is the `.tutor-stub-auto-eval/qa-matrix-<timestamp>`
directory the launch prints.

## Registered rules that bind Stage 1 (from the design note)

- Cell-drop rule, fixed before any row exists: drop a persona cell
  whose warm closure is 0/12, or whose coverage spread is zero. A high
  warm baseline is not a drop reason — the hypothesis runs downward.
- Stage-1 rows never pool into Stage 2.
- Any confirmed harm flag from the fidelity pass goes to the operator,
  who rules on it.
- Indeterminate means stop: an incomplete fidelity read, an
  unexplained crash, or a result the registered rules do not cover
  stops the stage; nothing is resampled or patched around.

## What this note does NOT license

- Stage 2 (the main block) — that takes its own GO note, sized from
  this stage's measurements.
- Any change to the design note's registered rules.
- Any re-read of `batch-main-2` or promotion of the headroom run's
  numbers.

## Provenance (recorded, not enforced)

At drafting time the study worktree
(`worktree-edged-register-stub-replication`) is at commit `6e0b54ac`
with a clean tree; the build commits are `b488327a` (design note),
`7c3bce13` (fixed-register policies), `6e0b54ac` (fidelity pass). At
launch the operator records the then-current commit and whether the
tree is dirty. This is a record, not a gate: this approval covers the
**study** — question, design, measurement rules, spend ceiling — and
fixing a code defect does not void it. No approval here binds to a
SHA or a digest.

---

Operator sign-off:

Signed: Liam Magee (GO given in session)
Date: 2026-08-27
