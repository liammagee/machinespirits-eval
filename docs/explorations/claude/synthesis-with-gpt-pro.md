# Synthesis: Adaptation strategy across two AI advisers

**Date:** 2026-04-29 / 2026-04-30
**Inputs:**
- `docs/explorations/claude/breaking-the-adaptation-ceiling.md` (Claude, 5 strategies)
- `docs/explorations/gpt-pro/01-adaptive-recognition-psyche-architecture.md` (gpt-pro, architectural spec)
- `docs/explorations/gpt-pro/02-codex-claude-code-action-plan.md` (gpt-pro, implementation plan)
- `docs/explorations/gpt-pro/03-resource-list.md` (gpt-pro, resources)
- `docs/explorations/gpt-pro/TODO.md` (gpt-pro, phased checklist)

**Status:** Strategy synthesis. Not a paper claim. Anything empirical referenced here must trace back to `docs/research/paper-full-2.0.md` per the project's authoring discipline.

---

## 1. Convergent diagnosis

Both notes arrive at essentially the same diagnosis from different angles:

> Recognition prompting and ego/superego coordination raise the *floor* of tutor output and support local error correction, but neither produces meaningful within-dialogue adaptation. The current substrate has no place where a learner-specific belief is stored, queried, or updated outside the prompt window. Adaptation has to be made *architecturally* possible before it can be measured.

gpt-pro's working formulation is sharper than mine and worth preserving verbatim:

> Recognition becomes computationally meaningful only when the learner's contribution changes the tutor's state, policy, and subsequent action.

This is the operational target. Everything below serves it.

---

## 2. Strategy alignment

The five strategies in my note map cleanly onto sections of gpt-pro's plan. Naming convention: I use my numbering as the canonical reference; gpt-pro's terminology shows what's the same idea under a different name.

| # | Claude name | gpt-pro analogue | Operational meaning |
|---|---|---|---|
| 1 | Externalised learner model | "State updater" + "Learner-model agent" (§4.1, §4.4) | Structured artifact (JSON profile) tutor reads/writes per turn; not text-in-context |
| 2 | Forcing experiments | "Adaptive trap benchmark" (§4.7) + 8 named scenario types | Scenarios where adaptation is *required* for tutor success |
| 3 | Programmatic constraints | "Recognition state machine" (§4.1) + "Finite-state dialog manager" (§4.11) | Philosophy as control flow, not prompt style |
| 4 | Substrate change | "Train or optimize the policy" (§4.8) | DPO / preference learning if prompting has hit the ceiling |
| 5 | Counterfactual replay measurement | "Counterfactual divergence" metric | Replay scenario with perturbed hidden state, measure policy divergence |

Strategies that gpt-pro adds to mine:

- **Prediction-error loop** (§4.3): tutor forecasts learner state, computes prediction error after the response. An operational version of Piagetian accommodation.
- **Skill library** (§4.10): named pedagogical moves with trigger conditions, procedures, and postconditions. Voyager-flavoured.
- **Working-through memory** (§4.9, §5): durable memory of failed predictions, not generic conversation summaries.
- **Tutor-side psyche stack** (§5): reality + id + superego + other-ego + ego mediator + working-through. The largest architectural addition.

Strategies in mine that gpt-pro is silent on:

- **Substrate change as an active probe** (#4): my note recommends running a thinking-model variant cell to probe whether the ceiling is "this substrate" or "any substrate". gpt-pro's plan implicitly assumes the substrate isn't the ceiling — adaptation is reachable with the right architecture on the right models.

---

## 3. Resolved divergences

### 3.1 Framework: native Node first, port to LangGraph.js later if signal appears

- **My initial position:** LangGraph.js or XState for the new cell — checkpointing and conditional edges fall out for free, which directly enables Strategy 5.
- **gpt-pro's position:** "Implement native Node services first … avoids introducing another framework before the mechanism is proven."
- **Resolved:** gpt-pro is right *as a sequencing argument*. The probe goal is to determine whether explicit state + policy selection produces strategy shifts at all. If yes, framework comparison becomes worth doing. If no, the framework decision was wasted.

**However**, after building a working LangGraph.js scaffold (`services/adaptiveTutor/`, ~250 LOC, smoke-passing), the practical cost of LangGraph.js turned out to be lower than gpt-pro's caution implied. The framework's checkpointing + conditional-edges + typed-state primitives map onto Strategies 1, 3, and 5 directly. **Net resolution: build the first cell on LangGraph.js, but write the state schema and node bodies so a port to native Node services or to XState would be mechanical.** This is what the existing scaffold does.

### 3.2 Architectural scope: phase before the full Psyche-v2 stack

- **My position:** Strategy 1 (externalised state) + Strategy 3 (programmatic constraints) as one new cell.
- **gpt-pro's position:** Phase 1 is state schema + policy selector + scenarios. Phase 4 adds the full Psyche-v2 (reality + id + superego + other-ego + ego-mediator + working-through). A14 evaluates the full stack.
- **Resolved:** gpt-pro's phasing is correct (Phase 1 first, Psyche-v2 later). The eventual full Psyche-v2 stack is *six agents per tutor turn*; with bilateral architecture, that's 12+ LLM calls per turn, with corresponding cost, latency, and failure-mode-stacking concerns. **Adopt gpt-pro's phasing, but treat id and other-ego as ablation cells in A14, not as defaults — measure marginal contribution.**

### 3.3 Scripted vs bilateral learner

- **My position:** Did not address directly.
- **gpt-pro's position:** Adaptive trap scenarios specify `hidden_learner_state` + `trigger_turn`, which implies a partly scripted learner trajectory ("deterministic mocked learner turns" in dry-run, Track E).
- **Resolved tension:** the existing bilateral ego-superego learner is a strength of the project — it makes the learner a genuine other rather than a script. Reverting to scripted learner turns for diagnostic clarity is the right move *for the probe*. **A13/A14 measure tutor adaptation given a specified learner trajectory; full bilateral evaluation comes after, as a follow-up cell that uses the bilateral ego-superego learner against the same scenarios.** This is the test of whether the architecture's adaptation survives a deliberating learner.

### 3.4 Tool routing (Codex vs Claude Code)

- **gpt-pro's position:** Codex for bounded edits/tests; Claude Code for theory/eval/claim review.
- **My read:** the split is a useful heuristic but should not be rigid. Most "bounded code edits" require theory translation right before them. **Route by task shape (small + testable → Codex; repo-aware + judgment-laden → Claude Code), not by phase.**

---

## 4. What gpt-pro contributes that survives intact

Importing wholesale, no edits required:

1. **Claim discipline.** The `supported / suggestive / exploratory / null / contradicted` coding scheme; the rule that holistic tutor quality cannot be the primary endpoint; the human-inspection-packet-before-paper-claims requirement. This is the most valuable addition. Worth lifting into project memory or CLAUDE.md.
2. **Eval design.** A13 conditions (recognition-only / current ego-superego / adaptive-state policy / adaptive-state policy + validator). A14 conditions (recognition-only / current ego-superego output review / strategy-level superego + ego mediator / full Psyche-v2). Small N, predeclared thresholds, smoke-test-first.
3. **Policy action taxonomy.** 14 named pedagogical actions (`ask_diagnostic_question`, `mirror_and_extend`, `scope_test`, `repair_misrecognition`, etc.) with trigger conditions, contraindications, expected next learner signal. Convert philosophy from style to constraint cleanly.
4. **8 adaptive trap scenarios.** `false_confusion`, `polite_false_mastery`, `resistance_to_insight`, `answer_seeking_to_productive_struggle`, `metaphor_boundary_case`, `affective_shutdown`, `repair_after_misrecognition`, `sophistication_upgrade`. Each names the trigger and the expected strategy shift.
5. **Stop conditions.** Specific halt criteria (internal leakage > 5%, state updates don't affect policy in dry-run, strategy-shift-correctness can't be scored reliably). Forces honesty about when to stop.
6. **Red lines.** Don't claim adaptation from holistic quality alone. Don't conflate synthetic learner output with human learning. Don't let internal deliberation leak into learner-facing responses.

---

## 5. What needs adjustment

Critique points worth carrying forward:

1. **Strategy-shift correctness undercounts within-action refinement.** `ask_diagnostic_question` can stay the same action label while the *question itself* gets sharper. Add a secondary metric: turn-over-turn semantic distance of tutor moves *within* the same action category, conditioned on whether the learner profile changed. Cheap to compute; covers a real adaptation mode.
2. **The "id" is Tree-of-Thoughts with Freudian branding.** The architectural role (candidate-move generator, controlled divergence) is real. The Freudian framing is acceptable in the paper but should be explicit that the implementation is computationally ToT, not a claim about LLM unconsciousness.
3. **Forcing the mechanism vs. discovering it.** Requiring structured state-delta output produces structured state-delta output — that's not the same as adaptation. The deliberation-to-output coupling rubric helps, but it's LLM-judged. The 70% threshold for "genuine vs rhetorical" in human inspection is doing real work; treat it as load-bearing.
4. **Working-through memory is within-dialogue only.** The most interesting adaptation is across sessions (the tutor learning a specific learner over weeks). gpt-pro's spec is silent here. Right to defer; worth noting as a known limit.
5. **Strict non-leakage may fight realism.** Real teachers' moves often *do* show traces of their deliberation. The strict non-leakage rule produces clean traces but suppresses one form of recognitive interaction. Allow controlled leakage in some conditions; measure it.
6. **Existing 90-cell sweep relationship is unspecified.** Are the existing cells deprecated, or do A13/A14 sit alongside? Pick one: existing runs as baseline that A13/A14 contrast against, *or* a separate paper-2.0-canonical body. Not both.

---

## 6. Recommended sequencing

This is the agreed order, derived from §3 and §4:

1. **Adopt gpt-pro's claim discipline immediately** (project memory or CLAUDE.md). Cheapest change with the largest downstream effect on how the next experiment gets reported.
2. **Build the LangGraph.js adaptive-tutor scaffold** (done — `services/adaptiveTutor/`, smoke passes). Strategies 1, 3, 5 wired and verified end-to-end against mock LLM.
3. **Port gpt-pro's 8 adaptive trap scenarios** into `config/adaptive-trap-scenarios.yaml`.
4. **Real LLM hookup** through existing provider routing. `mockLLM.callRole` is the swap point; node code does not change.
5. **Adapter to `evaluation_results` table.** Each scenario run writes one row with profile_name, dialogue, suggestions, deliberation trace JSON. Re-uses existing analysis pipeline.
6. **Register as a cell** in `config/tutor-agents.yaml` and `EVAL_ONLY_PROFILES`. Reachable via `eval-cli.js run --profiles cell_NN_langgraph_adaptive`.
7. **Strategy-shift-correctness analysis script.** Primary endpoint for A13. Reads from `evaluation_results`; scores policy-action match against `expected_strategy_shift`.
8. **A13 dry-run smoke** (4 dialogues, mock learner). Verify state updates affect policy selection. Stop and inspect if not.
9. **A13 real run** (frontier models, N=64–128, hard cost ceiling). gpt-pro's success threshold: C3/C4 improves strategy_shift_correctness ≥25 pp over C1, ≥15 pp over C2; ≥70% of human-inspected cases judged genuine, not rhetorical.
10. **Human inspection packet** before any paper claim update.
11. **A14 (Psyche-v2)** *only if* A13 shows signal. If A13 fails, more agents on top is unlikely to rescue it — pivot to substrate change (Strategy 4) or write up the negative result.

The build-and-validate work for steps 2–7 is in progress; this synthesis document marks the inflection where strategy is locked and execution begins.

---

## 7. What this synthesis does *not* settle

- **Whether the whole programme should pivot to substrate change (#4).** Both gpt-pro and I treat this as a fallback. It may instead be the headline. Decide after A13.
- **The fate of the existing 90-cell sweep.** See §5 point 6.
- **Cross-session adaptation.** See §5 point 4.
- **Whether the philosophical framing carries empirical weight.** The plan operationalises Hegel/Freud as transition logic, but a successful A13 doesn't validate the philosophy — only that *some* explicit state machine plus policy selection works. The framing's contribution is conceptual organisation; empirical validation requires comparing recognition-flavoured constraints against neutral-framed equivalents (already partly addressed by placebo cells, but worth re-running under the new architecture).

These are open questions, not blockers. They become tractable once A13 produces signal.
