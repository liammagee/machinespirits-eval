# A13 pre-registration — adaptive cell, Gate B real-LLM run

**Date locked:** 2026-05-01
**Commit at lock time:** `bfbcfe8` (branch `experiment/langgraph-adaptive`)
**Earliest run-start date:** 2026-05-03 (≥48 hours after lock; visible in `git log` against this file)
**Status:** Predeclared. Anything decided after the run that contradicts this document must be flagged in the §"Deviations log" below — not silently absorbed into the analysis.

This document locks the question, conditions, primary endpoint, thresholds, stop conditions, budget, and analysis plan for the A13 real-LLM run *before* the run executes. It exists so the analysis cannot be retrofitted: claims after the run are evaluated against what's written here, not against post-hoc rationalisations.

Upstream sources (do not duplicate; cite section):

- Strategy and phasing — `docs/explorations/claude/comprehensive-strategy.md` §"Phase 1"
- Roadmap context — `docs/explorations/claude/consolidated-plan.md` §3, §4
- Synthesis and threshold derivation — `docs/explorations/claude/synthesis-with-gpt-pro.md` §6 step 9, §4 point 5
- Mechanism scaffold — `docs/explorations/gpt-pro/01-adaptive-recognition-psyche-architecture.md` §4.1, §4.7

---

## 1. Question

> Does externalising the learner state and constraining tutor moves through a programmatic policy selector produce within-dialogue *strategy shift* on adaptive trap scenarios — over and above (a) recognition prompting alone and (b) the project's current ego/superego architecture?

This is a probe, not a confirmation. The hypotheses below are predeclared with directionality; the test is whether the cell-as-built clears the predeclared deltas, not whether some new architecture turns out to "work."

---

## 2. Hypotheses

**H1 — primary.** On the 8 adaptive trap scenarios, conditions C3 and C4 produce a higher rate of correct strategy shift at trigger turn + 1 than:
- C3 ≥ C1 by ≥25 percentage points (recognition-prompt-only baseline)
- C3 ≥ C2 by ≥15 percentage points (current ego/superego baseline)
- C4 ≥ C3 by ≥0 (validator does not regress; non-inferiority rather than superiority)

**H2 — secondary, conditional.** On scenarios with a `counterfactual` block, C3 and C4 produce *divergent* policy traces between the original and counterfactual branches more often than C2 (where the cell has no place to store the perturbed hidden state, so divergence should be near-zero by construction).

**H0 (null).** The current substrate cannot produce contingent strategy shift through this architectural lever; if H1 fails the result is a meaningful negative finding (per `synthesis-with-gpt-pro.md` §7 and `consolidated-plan.md` §3 Gate C).

---

## 3. Design

| Code | Profile name | Runner | Architecture | Builds on |
|---|---|---|---|---|
| C1 | `cell_111_a13_C1_recognition_only` | `standard` | Single-agent tutor, recognition prompt, no externalised state | (new) |
| C2 | `cell_112_a13_C2_egosuperego` | `standard` | Current ego + superego, recognition prompt, no externalised state | (new) |
| C3 | `cell_110_langgraph_adaptive` | `adaptive` | Externalised learner state + policy selector + recognition generator | shipped on commit `3e483d0` |
| C4 | `cell_113_a13_C4_validator` | `adaptive` | C3 + validator node between superego review and constraint check | (new — extends C3) |

C1 and C2 consume the trap-scenario YAML through a thin scenario adapter that collapses the openings into single-prompt or message-mode openings (`runner: standard`). C3 and C4 consume it directly through the adaptive runner. All four conditions are evaluated against the *same* 8 scenario IDs at the *same* lock-time YAML version (see §4).

**Sample size.** `--runs 3` per cell × 4 cells × 8 scenarios = **96 dialogues** total. Counterfactual branches are persisted alongside originals; on scenarios that carry a `counterfactual` block (all 8 in this version) C3/C4 emit one extra branch per dialogue, so the realised LLM-call count is roughly 1.5× this for those cells.

**N=3 is intentionally underpowered for between-cell statistical comparison.** The adjudicated decision (`comprehensive-strategy.md` §"Adjudicated decisions (2026-05-01)" item 2) is: run N=3 first under the $50 ceiling; if the directional signal is present but underpowered (effect-direction matches H1, p > 0.05 on a 96-dialogue sample), commit to a follow-up N=8 run with a higher ceiling under a separate pre-registration. Do not pool N=3 + N=8 into a single analysis — that's exactly the kind of garden-of-forking-paths move pre-registration exists to forbid.

**Replication independence.** Each scenario × cell × replication uses an independent thread ID; LangGraph checkpointer state does not leak across replications.

---

## 4. Scenarios

Locked to `config/adaptive-trap-scenarios.yaml` at commit `bfbcfe8` (8 scenarios, no `_v2` versions in scope). Scenario IDs:

1. `false_confusion_v1` — expected shift `scope_test`
2. `polite_false_mastery_v1` — expected shift `ask_diagnostic_question`
3. `resistance_to_insight_v1` — expected shift `scope_test`
4. `answer_seeking_to_productive_struggle_v1` — expected shift `withhold_answer`
5. `metaphor_boundary_case_v1` — expected shift `name_the_disagreement`
6. `affective_shutdown_v1` — expected shift `acknowledge_and_redirect`
7. `repair_after_misrecognition_v1` — expected shift `repair_misrecognition`
8. `sophistication_upgrade_v1` — expected shift `mirror_and_extend`

Policy-action labels are drawn from `services/adaptiveTutor/policyActions.js` at the same commit (14-action enum, frozen). Any scenario added or modified after this lock requires a separate pre-registration.

---

## 5. Primary endpoint

**`strategy_shift_correctness`** — fraction of (cell, scenario, replication) triples where the policy action emitted by the tutor at turn `trigger_turn + 1` equals the scenario's `expected_strategy_shift`.

Computed by `scripts/analyze-strategy-shift.js`, aggregated by `profile_name` (cell) and `scenario_type`. Operational definition is the function `analyzeBranch(...)` at that file's commit `6086ad7` — no judgment, no LLM, no rubric. Pure label match against the predeclared `expected_strategy_shift`.

**Decision rule.**

| Outcome | Pass / fail |
|---|---|
| C3 − C1 ≥ +25 pp **and** C3 − C2 ≥ +15 pp **and** C4 − C3 ≥ 0 | **Pass.** Proceed to Gate D (Phase 2 pilots). |
| Direction matches but at least one delta is below threshold (suggestive) | **Inconclusive.** Trigger N=8 follow-up under separate pre-reg before any paper claim. |
| Direction wrong (C3 ≤ C1 or C3 ≤ C2) **or** primary metric unscoreable for ≥1 cell | **Fail.** Proceed to Gate C (substrate probe / negative-result write-up). |

Mid-run rubric tweaks, scenario exclusions, or sample-size top-ups before this rule fires are forbidden — they convert pre-registration into post-hoc justification.

---

## 6. Secondary endpoints

These do not gate Gate B; they inform what to investigate if H1 lands suggestive or negative.

| Metric | Source | Predeclared interpretation |
|---|---|---|
| `counterfactual_divergence` | `analyze-strategy-shift.js` | C3/C4 should diverge ≥30% on scenarios with counterfactual blocks; C2 expected near 0 (no externalised state to perturb) |
| `within_action_refinement_rate` | `analyze-strategy-shift.js` (Jaccard < 0.6 within same action) | Captures the "same action label, sharper question" mode flagged in `synthesis-with-gpt-pro.md` §5 critique #1 |
| `internal_leakage_rate` | manual inspection at human-inspection packet time | Stop condition; see §8 |
| Cost per dialogue | `evaluation_runs.metadata.maxCostUsd` + tracker summary | Reported but not gated |

The "≥70% of human-inspected cases judged genuine, not rhetorical" criterion from `synthesis-with-gpt-pro.md` §6 step 9 applies as a *secondary* gate before any paper claim — it does not gate the Gate B numerical pass/fail above. If H1 passes numerically but human inspection shows <70% genuine shifts, the Gate B pass is downgraded to "numerically passing, qualitatively inconclusive" and a Phase 2 pilot pre-registration must address the rhetorical-shift distinction before any paper claim.

---

## 7. Stop conditions (runtime halts)

These halt the run mid-flight. The first three are encoded in code; the fourth is procedural.

1. **Cost ceiling exceeded.** `--max-cost 50` (USD). The budget tracker (`services/adaptiveTutor/budgetTracker.js`, commit `aa2b64f`) aborts before issuing a call that would exceed the ceiling. Halt code: `BUDGET_EXCEEDED`. Run status persisted as `halted_budget`.
2. **Internal leakage > 5% of dialogues** in any condition, where leakage = tutor message contains the policy-action label, internal deliberation markers, or explicit reference to the structured profile. Sampled at the human-inspection packet stage. If detected mid-run via casual inspection, halt and revise prompts before continuing.
3. **Primary metric unscoreable for ≥1 cell.** If `analyze-strategy-shift.js` returns null/`--` for `strategy_shift_correctness` on more than one cell (typically because the LLM emitted out-of-enum policy labels that don't match `POLICY_ACTIONS`), halt and revise the prompt scaffolding rather than papering it over with a permissive scoring rule.
4. **Mock-state-update sanity broken.** Re-running `node scripts/run-adaptive-cell-smoke.js` against the lock-time commit must still pass. If it stops passing mid-run, the run is invalid — halt, fix, and start over.

---

## 8. Budget

- **Hard ceiling:** $50 USD across all 4 cells × 96 dialogues × counterfactual branches. Enforced by `--max-cost 50`.
- **Why $50 is plausible.** Mid-tier model (claude-sonnet-4.6) at ~$0.003/1k input + ~$0.015/1k output. Per-call rough estimate (4-role graph × ~2k input + ~1k output per call): ~$0.020. ~6–8 LLM calls per turn × 4 turns × 96 dialogues × 1.5 (counterfactual factor) ≈ 4,608 calls × $0.020 ≈ $92. The N=3 ceiling is intentionally tight; if the realised cost approaches the ceiling, the budget tracker halts cleanly and the run is reported as `halted_budget` rather than continuing to a partial result.
- **What happens if the ceiling halts before completion.** Halt is not failure. The persisted partial run is reported with its actual N, cells covered, and the halt reason. A second run under a higher ceiling requires a separate pre-registration (it is a new study, not a continuation).

---

## 9. Models

Single tutor-side generator per cell, locked at run-start time. Default: `anthropic/claude-sonnet-4.6` via OpenRouter (the `sonnet` alias in `config/providers.yaml`). All 4 cells use the same generator alias to isolate architecture as the active variable.

The judge for the primary endpoint is **mechanical, not an LLM**: `analyze-strategy-shift.js` does string equality between emitted `policyAction` and predeclared `expected_strategy_shift`. There is no LLM judge involved in the primary pass/fail decision.

If model availability changes between this lock and run-start, the substituted model alias must be recorded in the §"Deviations log" with a one-line justification — but is otherwise allowed (substitutions inside the same cost class do not require a new pre-registration).

---

## 10. Run command (exact)

The Gate B run is the four-cell command from `comprehensive-strategy.md` §"Verification (per phase)":

```bash
ADAPTIVE_TUTOR_LLM=real \
ADAPTIVE_TUTOR_MODEL=sonnet \
node scripts/eval-cli.js run \
  --profiles cell_110_langgraph_adaptive,cell_111_a13_C1_recognition_only,cell_112_a13_C2_egosuperego,cell_113_a13_C4_validator \
  --runs 3 --max-cost 50 \
  --description "A13 Gate B — see docs/explorations/claude/a13-pre-registration.md"
```

The `--description` value embeds a pointer to this file; it is persisted in `evaluation_runs.metadata` so any later analysis script can verify the run was bound to this pre-reg.

Before the full run, two mandatory smoke checks (also from `comprehensive-strategy.md` §"Verification"):

1. Mock smoke across all 4 cells (`--dry-run`) — must produce 32 persisted rows, no errors.
2. Cost-ceiling regression (`--max-cost 0.01`) — must abort cleanly before the second LLM call. This is a non-negotiable check on the budget tracker; if it doesn't trip, the budget guard is broken and the real run must not start.

---

## 11. Analysis plan

Run, in order, only after the full Gate B run completes (or halts):

1. `node scripts/analyze-strategy-shift.js --run-id <runId> --out exports/a13-strategy-shift.json`
   — produces the four-cell × eight-scenario matrix that drives the §5 decision rule.
2. `node scripts/browse-transcripts.js` — read every dialogue (96 + counterfactual branches). Yes, all of them. The "≥70% genuine" check requires the author to actually look.
3. Apply the §5 decision rule. Record the outcome in this document under §"Deviations log".
4. *Only if pass:* draft the Phase 2 pilot P2 pre-registration (`p2-bilateral-tom-pre-registration.md`). Do not begin Phase 2 implementation work until that doc exists and commits.

What this analysis plan deliberately does not include: bootstrap CIs, p-values, effect sizes. N=3 doesn't earn them. The decision rule is a directional one against predeclared deltas; statistical inference is reserved for the (conditional) follow-up N=8 run.

---

## 12. Anti-discretion rules

These are the moves pre-registration explicitly forbids. Any of them, performed after the run, invalidate the Gate B result and require a fresh pre-registration before any paper claim.

1. **No threshold revision after seeing data.** The +25 pp / +15 pp / 0 pp deltas are fixed.
2. **No scenario exclusion after seeing data.** All 8 scenarios stay in the analysis. If a scenario's signal is unscoreable, that's a stop condition (§7 #3), not grounds for dropping it.
3. **No model substitution after seeing data.** Generator model is locked at run-start (§9).
4. **No re-running until signal appears.** A failed Gate B is reported as failed. Re-running under a different pre-reg is allowed; silent re-runs feeding into the same claim are not.
5. **No condition reframing after seeing data.** C3 vs C1, C3 vs C2, C4 vs C3 — these are the comparisons. New comparisons (e.g., "C4 vs (C2 + counterfactual subset)") require a fresh pre-reg.
6. **No primary-endpoint substitution.** `strategy_shift_correctness` is the primary. Secondary metrics from §6 may inform interpretation but cannot be promoted to primary post-hoc.

If any of these are violated for genuinely good reasons (e.g., a bug in the analyzer that overcounts), the violation is documented in §"Deviations log" and a follow-up run under a fresh pre-reg is required before any paper claim built on the original run.

---

## Deviations log

Empty at lock time. Append below as run proceeds.

```
[YYYY-MM-DDTHH:MM±ZZZZ] (deviation type — short title)
What changed: ...
Justification: ...
Effect on analysis: ...
```
