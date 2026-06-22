# M0 — Baseline-Validation Runbook (Plan 2.1 §1.3 prerequisite)

**Purpose.** Convert the current Plan 2.0 result — which is **mock-mode** and has
**predominantly inconclusive** outcomes — into a *real-generation* baseline that is
provenance-clean and independently judged, **before** any Plan 2.1 mechanism is tuned.
Per the plan (§1.3, milestone M0/E0), nothing downstream should start until this passes,
otherwise later gains may be compensating for an unmeasured real-generation regression.

**Frozen reference (do not modify these cells/profiles).**

| Suite | Baseline | Treatment | scenario_source | n |
|---|---|---|---|---|
| Cross-suite | `cell_136_plan2_closed_loop_crosssuite` | `cell_150_plan2_quality_repeat_contextual_crosssuite` | `config/cross-suite-trap-scenarios.yaml` | 6 |
| Paired | `cell_151_plan2_pair_specificity_closed_loop` | `cell_152_plan2_pair_specificity_repeat_contextual` | `config/adaptive-generalization-counterfactual-scenarios.yaml` | 8 |

All four: `runner: adaptive`, `architecture: state_policy_closed_loop`, `provider: claude-code`
(Max-plan subscription bridge — **quota-bound, attended, pausable; no OpenRouter key**).

**Reference targets to reproduce (mock-mode numbers):** cross-suite strict shift 6/6,
paired 8/8, pair specificity 3/3 with zero false-positive divergence; Sonnet composite
quality +4.8 (cross) / +3.0 (paired). M0 asks: *do these survive real generation?*

---

## Part A — the attended session (real-generation re-run + judge + provenance)

### A1. Pre-flight in mock, against a throwaway DB (free, no prod-DB pollution)
> Note: `eval-cli run` on adaptive cells writes the prod DB even in mock mode, so isolate it.

```bash
TMP=$(mktemp -d)
EVAL_DB_PATH="$TMP/m0.db" EVAL_LOGS_DIR="$TMP/logs" ADAPTIVE_TUTOR_LLM=mock \
  node scripts/eval-cli.js run \
  --profiles cell_136_plan2_closed_loop_crosssuite,cell_150_plan2_quality_repeat_contextual_crosssuite,cell_151_plan2_pair_specificity_closed_loop,cell_152_plan2_pair_specificity_repeat_contextual \
  --runs 1
```
Confirms all four cells dispatch, persist a row each, and finalize (`status=completed`).
**Hardening just landed** (commit `9cc30ecc`/`d05044c9`): a malformed/dangling world-spec
now degrades to a logged per-scenario skip instead of aborting the run — so a half-finished
real run can no longer strand `evaluation_runs` at `status=running`.

### A2. Real-generation runs — SEQUENTIAL, EXPENSIVE-FIRST (paid, attended)
**Do not run concurrently.** Baseline↔treatment is a between-arm contrast sharing one
Max-plan quota window; concurrent draining biases the contrast via differential attrition.
Run treatment (heavier) first, then its baseline. One cell per command → 4 clean runIds.

```bash
# --- cross-suite (treatment first) ---
ADAPTIVE_TUTOR_LLM=real node scripts/eval-cli.js run \
  --profiles cell_150_plan2_quality_repeat_contextual_crosssuite --runs 1 --max-cost 8
#   -> note CROSS_TREAT_RUN
ADAPTIVE_TUTOR_LLM=real node scripts/eval-cli.js run \
  --profiles cell_136_plan2_closed_loop_crosssuite --runs 1 --max-cost 8
#   -> note CROSS_BASE_RUN

# --- paired (treatment first) ---
ADAPTIVE_TUTOR_LLM=real node scripts/eval-cli.js run \
  --profiles cell_152_plan2_pair_specificity_repeat_contextual --runs 1 --max-cost 8
#   -> note PAIR_TREAT_RUN
ADAPTIVE_TUTOR_LLM=real node scripts/eval-cli.js run \
  --profiles cell_151_plan2_pair_specificity_closed_loop --runs 1 --max-cost 8
#   -> note PAIR_BASE_RUN
```
- Start with `--runs 1`; bump to `--runs 3` for the final once one pass looks clean.
- `--max-cost` is a soft guard for `claude-code` (subscription, not metered USD) — the real
  ceiling is **you, attended**. Checkpoint between the four runs; inspect each runId before
  the next. No `--checkpoint-every` exists for this runner, so checkpointing is manual.
- Cost order-of-magnitude: each cell ≈ n scenarios × ~4 rounds × (tutor ego/superego + learner),
  roughly doubled on scenarios carrying a counterfactual block. Expect a few hundred
  claude-code calls per cell.

### A3. Mechanical strict-shift scoring (architecture-independent — the clean channel)
```bash
node scripts/analyze-strategy-shift.js --run-id $CROSS_TREAT_RUN,$CROSS_BASE_RUN \
  --judge-model claude-code/sonnet --out exports/m0-crosssuite-strict-shift.json
node scripts/analyze-strategy-shift.js --run-id $PAIR_TREAT_RUN,$PAIR_BASE_RUN \
  --judge-model claude-code/sonnet --out exports/m0-paired-strict-shift.json
```
Pass = strict shift reproduces the frozen 6/6 and 8/8 (or the plan's M0 gate), with paired
pair-specificity intact and zero false-positive divergence.

### A4. Quality scoring — primary + independent held-out judge
```bash
# primary judge
node scripts/grade-adaptive-dialogue.js \
  --run-id $CROSS_TREAT_RUN,$CROSS_BASE_RUN,$PAIR_TREAT_RUN,$PAIR_BASE_RUN \
  --model claude-code/sonnet
# independent judge (re-grade same dialogues)
node scripts/grade-adaptive-dialogue.js \
  --run-id $CROSS_TREAT_RUN,$CROSS_BASE_RUN,$PAIR_TREAT_RUN,$PAIR_BASE_RUN \
  --model openrouter.gpt
```
Compare the two judges' composite deltas (treatment − baseline) per suite; the +4.8/+3.0
gain should survive real generation under *both* judges.
> Tooling note: `analyze-judge-reliability.js` pairs on rubric *suggestions* content, which
> adaptive grades don't carry. The two-judge composite comparison here is a small per-dialogue
> join, not that script — confirm/adapt the comparison before relying on it.

### A5. Provenance + hash integrity
```bash
npm run provenance:validate
npm run audit:message-chain
# config/dialogue/prompt hash homogeneity per run (no config_hash drift):
sqlite3 data/evaluations.db \
 "SELECT run_id, COUNT(DISTINCT config_hash), COUNT(DISTINCT prompt_content_hash) \
  FROM evaluation_results WHERE run_id IN \
  ('$CROSS_TREAT_RUN','$CROSS_BASE_RUN','$PAIR_TREAT_RUN','$PAIR_BASE_RUN') GROUP BY run_id;"
```
Each run must show a single `config_hash` / `prompt_content_hash` (counts = 1). Confirm all
scoring is rubric-version homogeneous before any cross-run comparison.

### A6. Decision
Tabulate real-gen strict-shift + composite-quality vs the frozen mock numbers. If they hold,
M0's reproduce-the-positive gate is met. If they regress, **stop** — the mock result was
the artifact, and that finding reroutes the whole program.

---

## Part B — the three §1.3 ablations (now all registered and ready)

These isolate *which* mechanism is load-bearing. All three are now run-ready (prep landed).

1. **Context-realization-off — FREE, already exists.** The baseline arm (`136`/`151`,
   `closed_loop`) *is* contextual-realization-off; the treatment (`150`/`152`,
   `repeat_contextual`) adds it. The A2 baseline runs already supply this ablation.
2. **Outcome-closure-off — REGISTERED (`cell_155` cross / `cell_156` paired).** Settled the
   toggle: closure is `policy.mode`, not architecture — `closed_loop` runs the intervention
   ledger/closure; `contract_gate` keeps gate + repair but is **not** in
   `LEDGER_ADAPTATION_MODES`. So these cells = the frozen treatment with `mode: contract_gate`
   (everything held, closure off). Verified in mock: `mode: contract_gate`, no closure ledger.
3. **State-scramble — BUILT (`cell_157` cross / `cell_158` paired).** Added
   `policy.state_scramble` → `scrambleLearnerStateBelief()` deterministically permutes the
   belief (reassigns probability mass to the wrong hypothesis ids, rotates axis values) right
   after estimation, so the whole pipeline sees a state that no longer matches the learner.
   The belief stays schema-valid (entropy preserved). Placebo unit tests in
   `tests/adaptation-policy.test.js`; verified in mock (`state_scramble: true` in trace). This
   is the strongest of the three — it tests *state validity*, not just realization.

**Run the ablations paired against the frozen treatments** (same sequential, attended rules
as A2 — each is a contrast against its treatment, so run treatment-then-ablation in one window):
```bash
# closure-off vs treatment (cross + paired)
ADAPTIVE_TUTOR_LLM=real node scripts/eval-cli.js run --profiles cell_155_plan2_closureoff_crosssuite --runs 1 --max-cost 8
ADAPTIVE_TUTOR_LLM=real node scripts/eval-cli.js run --profiles cell_156_plan2_closureoff_paired   --runs 1 --max-cost 8
# state-scramble placebo vs treatment (cross + paired) — strict shift should COLLAPSE here
ADAPTIVE_TUTOR_LLM=real node scripts/eval-cli.js run --profiles cell_157_plan2_statescramble_crosssuite --runs 1 --max-cost 8
ADAPTIVE_TUTOR_LLM=real node scripts/eval-cli.js run --profiles cell_158_plan2_statescramble_paired     --runs 1 --max-cost 8
```
Score each with `analyze-strategy-shift.js` (combine `--run-id <treatment>,<ablation>`) and
`grade-adaptive-dialogue.js`. **Expected reads:** closure-off ≈ treatment on strict shift
(closure should affect outcome *records*, not strategy targeting); state-scramble strict shift
should **drop sharply** — if it doesn't, the policy isn't keying on state (the key finding).

---

## Exit gate (M0 pass) — all of:
- [ ] Frozen positive reproduced under real generation (strict shift + pair specificity).
- [ ] Composite-quality gain survives under both primary and independent judge.
- [ ] Provenance clean; single config/prompt hash per run; rubric-version homogeneous.
- [ ] All three ablations interpreted (context-off free; closure-off `155`/`156`; scramble `157`/`158`).
- [ ] No milestone promoted on a judge-score improvement alone (plan §20).

**Scope of "one attended session" = Part A + the four ablation runs (all now registered).**
Run them after A6 confirms the baseline holds, in the same sequential/expensive-first window.
