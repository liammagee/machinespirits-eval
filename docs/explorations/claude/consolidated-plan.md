# Consolidated adaptive-tutor roadmap

**Date:** 2026-04-30
**Status:** Execution roadmap. Locks priorities now that Phase 1 (the LangGraph adaptive cell) is shipped. Defers Phase 4 (Psyche-v2) and Strategy 4 (substrate change) behind A13 results.
**Inputs:**
- `breaking-the-adaptation-ceiling.md` — Claude, 5 strategies (S1–S5)
- `gpt-pro/01-adaptive-recognition-psyche-architecture.md` — gpt-pro, architectural spec
- `gpt-pro/02-codex-claude-code-action-plan.md` — gpt-pro, implementation plan (Tracks A–J)
- `gpt-pro/TODO.md` — gpt-pro, 10 phases of work
- `synthesis-with-gpt-pro.md` — strategy lock (Phase 1 scope; executed)

**Relationship to prior docs.** The synthesis settled *which* strategies to build first and how to resolve divergences between the two notes. This document is what comes next: a sequenced, gated execution plan covering what's shipped, what's still in scope from both source notes, and what gates each remaining decision.

**Relationship to `paper-full-2.0.md`.** Nothing in this document is an empirical claim. Per the project's authoring discipline, any result the work below produces must land in `paper-full-2.0.md` first before propagating to spin-offs.

---

## 1. What's shipped on `experiment/langgraph-adaptive`

Eight commits, all green smoke, end-to-end through `eval-cli`:

| Commit | Subject | Maps to |
|---|---|---|
| `9ed2cc1` | LangGraph adaptive scaffold + cross-AI synthesis | Claude S1/S3/S5 + gpt-pro Phase 1 (skeleton) |
| `338606e` | Real LLM backend behind `ADAPTIVE_TUTOR_LLM=real` flag | gpt-pro Phase 1 (LLM hookup) + Track F (frontier-model runner) |
| `c150e01` | Persist scenario runs to `evaluation_results` | gpt-pro Phase 3 (dry-run infra) + Track E |
| `3e483d0` | Register `cell_110_langgraph_adaptive` | gpt-pro Phase 1 (registration) |
| `56d478c` | Port all 8 adaptive trap scenarios | gpt-pro Phase 2 + Track C |
| `6086ad7` | `scripts/analyze-strategy-shift.js` (A13 primary endpoint) | gpt-pro Phase 5 (3 of ~7 metrics) + Track G (subset) |
| `f315519` | Unblock eval-cli module load against tutor-core 0.5.0 | (regression fix — prerequisite for end-to-end) |

**Operational state.** `node scripts/eval-cli.js run --profiles cell_110_langgraph_adaptive --runs 1 --dry-run` runs end-to-end. The mock-baseline numbers from the smoke are: **25% strategy-shift correctness, 12.5% counterfactual divergence, 75% within-action refinement** — these are the bars real-LLM A13 has to clear convincingly to count as evidence the cell adapts.

---

## 2. Cross-source coverage map

| Claude strategy | gpt-pro phase / track | Shipped on this branch? |
|---|---|---|
| S1 — Externalised learner model | Phase 1 (state schema, updater, validator) | ✅ Yes (in `services/adaptiveTutor/graph.js`) |
| S2 — Forcing experiments | Phase 2 (8 adaptive trap scenarios) + Track C | ✅ Yes |
| S3 — Programmatic constraints | Phase 1 (policy taxonomy + selector) + Track B | ✅ Partial — taxonomy + policy node exist; the **separate `config/adaptive-policy-actions.yaml` with full per-action metadata** (description / trigger_conditions / contraindications / expected_next_learner_signal / example_tutor_move) is not yet built |
| S4 — Substrate change (thinking models, DPO, multi-session memory) | gpt-pro §4.8 (train or optimise the policy) | ❌ Not started |
| S5 — Counterfactual replay | Track G (`counterfactual_divergence` metric) | ✅ Yes (in `analyze-strategy-shift.js`) |
| (synthesis §5 critique #1) — within-action refinement | (added in synthesis) | ✅ Yes (in `analyze-strategy-shift.js`) |

| gpt-pro phase | Status |
|---|---|
| Phase 0 — Guardrails | ⚠️ Partial — branch exists; cost ceiling and human-inspection-before-claims discipline are documented but not enforced |
| Phase 1 — Core adaptive state and policy | ✅ Functional; missing the polished `adaptive-policy-actions.yaml` (Track B's full spec) |
| Phase 2 — Adaptive trap scenarios | ✅ All 8 ported; missing `failure_mode` and `success_criteria` fields per Track C spec; no scenario validation script |
| Phase 3 — Dry-run infrastructure | ✅ Mock backend works; smoke writes to tmp; no `scripts/run-adaptive-dry.js` writing to `exports/adaptive-dry/` |
| Phase 4 — Psyche-v2 deliberation | ❌ Not started — gated on A13 result (per synthesis §6 step 11) |
| Phase 5 — Analysis scripts | ⚠️ Partial — 3 of 7 A13 metrics shipped; A14 metrics (deliberation coupling, id diversity, leakage rate, etc.) blocked on Phase 4 |
| Phase 6 — Human inspection + paper delta | ❌ Not started |
| Phase 7 — Claude Code workflow (slash commands, subagents, hooks) | ❌ Not started |
| Phase 8 — A13 small eval | ⚠️ Mock smoke passed; real-LLM run not yet executed; conditions C1/C2/C4 not yet built |
| Phase 9 — A14 Psyche-v2 small eval | ❌ Blocked on Phase 4 |
| Phase 10 — Stop conditions | Documented in synthesis §6 / TODO.md; not encoded as runtime checks |

---

## 3. Decision-gated sequencing

The remaining work is gated, not parallel. Each gate produces a result that determines whether the next phase is worth building.

### Gate A — A13 dry-run (mock)
**Status:** ✅ Passed. 8 scenarios, 0 errors, all three metrics computed.

### Gate B — A13 real-LLM run
**Why this is the next gate.** The mock smoke proves the *plumbing* — that state updates flow into policy selection, that traces persist, that the analyzer joins traces with rows. It does not prove the *cell adapts*. Only frontier-model runs against the trap scenarios test that.

**Prerequisites (small, real work):**
1. Decide model alias (GPT 5.5 / Claude 4.7-class) and confirm pricing immediately before run.
2. Encode a hard cost ceiling — `--max-cost` flag plus pre-call estimation that aborts before the first call if the run exceeds budget. Currently the `ADAPTIVE_TUTOR_LLM=real` path has no cost guard.
3. Re-introduce the polished `config/adaptive-policy-actions.yaml` (Track B): the inline taxonomy in `services/adaptiveTutor/policyActions.js` works for the runner but doesn't give the LLM the trigger-condition / contraindication / expected-next-signal cues that gpt-pro's spec called for. Without those cues real-LLM policy selection is more brittle than it should be.
4. Add the missing scenario fields (`failure_mode`, `success_criteria`) to `config/adaptive-trap-scenarios.yaml` so the analyzer can score `repair_success` and `delayed_task_success` (currently absent).
5. Build out A13 conditions C1, C2, C4. The cell as shipped is C3-equivalent (adaptive state + policy selector + recognition generator). C1 (recognition prompt only), C2 (current ego/superego), and C4 (C3 + validator/superego) all need explicit cell IDs and short descriptions, even if some of them re-use existing factorial cells with `runner: standard`.

**Success threshold (from gpt-pro §8 / synthesis §6 step 9):**
- C3 or C4 improves `strategy_shift_correctness` by ≥25 pp over C1 and ≥15 pp over C2.
- C4 does not reduce `uptake_score` or `content_accuracy` relative to C3.
- ≥70% of human-inspected cases judged genuine strategy shift (not rhetorical reframing).

**If A13 succeeds → Gate D.** **If A13 fails → Gate C.**

### Gate C — A13 negative: pivot or write up
The synthesis is explicit (§6 step 11): "If A13 fails, more agents on top is unlikely to rescue it — pivot to substrate change (Strategy 4) or write up the negative result."

**Substrate-change probe** would be a new track entirely: a parallel cell using extended-thinking models (Opus 4 thinking, o-series) on the same trap scenarios, to test whether the ceiling is "this substrate" or "any substrate." This is **gpt-pro is silent on it** (synthesis §2 closing) — it's a Claude-side strategy that gpt-pro implicitly ruled out by assuming adaptation is reachable with the right architecture. Worth keeping on the table because if the cell+architecture work fails, the next-strongest result is a substrate-vs-architecture comparison.

**Negative result write-up.** Per the synthesis §7, "the negative result itself ('prompt-and-coordination architectures cannot produce contingent adaptation under forcing scenarios') would, if confirmed, deserve its own section in `paper-full-2.0.md` — likely framed as a *limit* of the design space the paper has surveyed, not a failure of any particular cell."

### Gate D — A13 positive: build A14 Psyche-v2
Per synthesis §3.2 ("Adopt gpt-pro's phasing, but treat id and other-ego as ablation cells in A14, not as defaults — measure marginal contribution") and gpt-pro §5–8, A14 builds the full Psyche-v2 stack: realityAgent / idAgent / superegoAgent / otherEgoAgent / egoMediator / responseGenerator / workingThroughMemory / runPsycheDeliberation. This is **6 agents per tutor turn → 12+ LLM calls per turn with bilateral architecture** — cost, latency, and failure-mode-stacking concerns. The synthesis's marginal-contribution framing is what keeps the experiment small enough to falsify.

A14 conditions (gpt-pro §8):
- C1: recognition-only
- C2: current ego/superego output review
- C3: strategy-level superego + ego mediator
- C4: id + strategy-level superego + other-ego + ego mediator (full stack)

A14 success threshold: C4 improves strategy-shift correctness over C2 by ≥15 pp; coupling rubric mean ≥3.0/4.0; internal leakage rate ≤5%; content accuracy not worse than C2.

---

## 4. Remaining work, prioritised

**Order is gate-driven; do P0 in service of Gate B; pause at Gate D until A13 produces results.**

### P0 — Prerequisites for A13 real-LLM run (Gate B)
1. **Cost ceiling** — `--max-cost <USD>` flag on `eval-cli run` for adaptive cells. Pre-call estimator that aborts before any model call if run exceeds budget. *Files:* `services/adaptiveTutor/index.js`, `scripts/eval-cli.js`. *Effort: small.*
2. **Pre-registration document** — short markdown in `docs/explorations/claude/a13-pre-registration.md` locking question, conditions, scenarios, primary/secondary endpoints, success thresholds, stop conditions, and budget. Required by Phase 0 of TODO.md and by the synthesis §6 step 1 ("claim discipline first"). *Effort: small.*
3. **Polished policy-action taxonomy** — `config/adaptive-policy-actions.yaml` with description / trigger_conditions / contraindications / expected_next_learner_signal / example_tutor_move per action. Wire `services/adaptiveTutor/policyActions.js` to load from YAML. The LLM gets richer cues; the inline policy taxonomy stays as a fallback. *Files:* new YAML, `policyActions.js`, `realLLM.js` prompt. *Effort: small–moderate.*
4. **Scenario completeness** — add `failure_mode` and `success_criteria` to each scenario in `config/adaptive-trap-scenarios.yaml` so the missing analyzer metrics become scorable. *Effort: small.*
5. **A13 condition cells** — register `cell_111_a13_C1_recognition_only`, `cell_112_a13_C2_egosuperego`, `cell_113_a13_C4_validator` (C3 = the existing cell_110). C1/C2 likely re-use existing factorial cells with `runner: standard` against the trap scenarios; C4 needs a small validator node added to the LangGraph graph. *Files:* `config/tutor-agents.yaml`, possibly `services/adaptiveTutor/graph.js`. *Effort: moderate.*

### P1 — A13 expanded analysis (immediately after Gate B run lands)
1. **Trigger detection** metric — did the tutor's state update at the trigger turn correctly identify the learner signal? Compare `updated_hypothesis` against `expected_state_update` (string match or LLM-judged). *File:* `analyze-strategy-shift.js` or new `analyze-trigger-detection.js`.
2. **State-update accuracy** — same idea, finer-grained on the state delta object.
3. **Uptake score** — does the tutor's final response substantively use the learner's contribution? LLM-judged 0–4.
4. **Repair success** — for repair scenarios, did the tutor explicitly name the mismatch?
5. **Delayed task success** — for scenarios with microtasks, did the learner complete or improve?
6. **Human-inspection packet** — `scripts/export-adaptive-human-packet.js` (Track I / Phase 6). Required before any paper-claim update per synthesis §4 point 1 and TODO.md Phase 6.

### P2 — Conditional on Gate D (A13 succeeds)
1. **Phase 4 — Psyche-v2 deliberation.** Full architecture: `services/adaptiveTutor/psyche/{schemas,realityAgent,idAgent,superegoAgent,otherEgoAgent,egoMediator,responseGenerator,workingThroughMemory,runPsycheDeliberation}.js`. Strict non-leakage rule. Each agent has a specific failure mode it targets (table in gpt-pro §5.1).
2. **Phase 5 (A14 metrics).** `analyze-psyche-deliberation.js` with deliberation_to_output_coupling, id_candidate_diversity, superego_grounding_rate, ego_rejection_rate_of_weak_critique, other_ego_prediction_accuracy, internal_leakage_rate.
3. **A14 small eval** — 4 conditions × 8 scenarios × 2 runs × 2 generator models, frontier judges, predeclared thresholds.
4. **Paper delta report** — `scripts/generate-adaptive-paper-delta.js` integrating A13 + A14 against `paper-full-2.0.md` claims.

### P3 — Conditional on Gate C (A13 fails)
1. **Substrate probe cell** — same trap scenarios, same analyzer, but cell uses extended-thinking models / o-series / fine-tuned variant. Tests whether the ceiling is substrate vs. architecture.
2. **Negative-result paper section** — incorporate into `paper-full-2.0.md` as a limit of the design space, not a per-cell failure.

### P4 — Workflow polish (any time, low priority)
- Slash commands `/adaptive-plan`, `/adaptive-implement`, `/adaptive-eval-review`, `/adaptive-paper-delta` (gpt-pro Track 5).
- Subagents `adaptive-architect`, `eval-minimalist`, `claim-superego` (gpt-pro Track 6).
- `adaptive-guard.sh` hook to prevent accidental edits to legacy paper-reproduction files (gpt-pro Track 7).

---

## 5. What this plan deliberately does *not* settle

These remain open after this plan, and become tractable later:

- **Cross-session adaptation.** Working-through memory is within-dialogue only in both Claude S1 and gpt-pro Phase 4. Adaptation across sessions (same learner, weeks apart) is the more interesting form and currently has no scaffolding. Note as a known limit; revisit after A14.
- **Existing 90-cell sweep relationship.** Are A13/A14 contrast points against the existing factorial body, or a separate paper-2.0-canonical body? Pick one before claim-time. Synthesis §5 point 6 flagged this; still unresolved.
- **Whether the philosophical framing carries empirical weight.** A successful A13/A14 doesn't validate Hegel or Freud — only that *some* explicit state machine plus policy selection works. The framing's contribution is conceptual organisation; empirical validation requires comparing recognition-flavoured constraints against neutral-framed equivalents (synthesis §7). Doable as a small follow-up cell.
- **Strict non-leakage may fight realism.** Real teachers' deliberation does sometimes show in their utterances. Synthesis §5 point 5. Allow a controlled-leakage condition in A14 and measure it.

---

## 6. How to use this document

- Update §1 each time a commit lands by adding a row.
- Move items between P0/P1/P2/P3/P4 as gates close.
- When Gate B (A13 real-LLM run) produces results, append a §3.5 with the actual numbers, then mark the A13 gate as A→B→C-or-D and proceed accordingly.
- This document is a planning artifact, not a paper claim. Empirical results land in `paper-full-2.0.md` first; this document only references them.
