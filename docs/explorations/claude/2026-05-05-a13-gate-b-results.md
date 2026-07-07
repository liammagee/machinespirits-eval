# A13 Gate B — results memo

**Date:** 2026-05-05
**Pre-registration:** `docs/explorations/claude/2026-05-01-a13-pre-registration.md`
**Run IDs:** C3 = `eval-2026-05-05-486d7d1e` · C1 = `eval-2026-05-05-b3ac505b` · C2 = `eval-2026-05-05-e0e615bc` · C4 = `eval-2026-05-05-e58b7da1`
**Total spend:** $12.55 / $50 ceiling · **persistence:** 94/96 rows (2.1% loss, all `resistance_to_insight_v1` JSON-parse failures, well under 5% leakage stop)

## TL;DR

The pre-registration asked whether the LangGraph adaptive cell (C3) beats two baselines on `strategy_shift_correctness`. It produced a **split decision**:

| Contrast | Threshold | Actual | Verdict |
|---|---|---|---|
| C3 − C1 (recognition-only) ≥ +25pp | +25pp | **+10.3pp** | ❌ FAIL |
| C3 − C2 (current ego/superego) ≥ +15pp | +15pp | **+17.4pp** | ✅ PASS |
| C4 − C3 (validator helps) > 0 | >0 | **−6.1pp** | ❌ validator regression |

C3 beats the architecture currently in the paper. It does not beat a much cheaper single-prompt recognition baseline at the locked threshold. The validator node (C4) is a confirmed dead end.

## Headline metrics

| Cell | Architecture | n | strategy_shift% | counterfactual_div% | cost | $/row |
|---|---|---|---|---|---|---|
| **C1** (cell_111) | recognition prompt, single-agent | 24 | **37.5%** (9/24) | 0%* | $1.30 | $0.054 |
| **C2** (cell_112) | recognition + ego/superego deliberation | 23 | **30.4%** (7/23) | 0%* | $2.44 | $0.106 |
| **C3** (cell_110) | full LangGraph state-policy machine | 23 | **47.8%** (11/23) | 60.9% | $3.47 | $0.151 |
| **C4** (cell_113) | C3 + validator node | 24 | **41.7%** (10/24) | 79.2% | $5.33 | $0.222 |

\* C1/C2 don't run counterfactual replay — they have no externalised state to perturb. C4's higher divergence is partly mechanical: the validator forces a different policy when it disagrees with the original.

## Per-scenario breakdown

```
scenario                                C3    C1    C2    C4    notes
false_confusion                          0%    0%    0%    0%   architecture-invariant null
polite_false_mastery                   100%  100%  100%  100%   universally aced (easy trap)
resistance_to_insight                    0%    0%    0%    0%   architecture-invariant null
answer_seeking_to_productive_struggle   67%   67%    0%   67%   C2 catastrophic collapse
metaphor_boundary_case                   0%    0%   33%   33%
affective_shutdown                      67%   67%   33%   67%
repair_after_misrecognition             67%   33%    0%   33%   C2 catastrophic collapse
sophistication_upgrade                  67%   33%   67%   33%
```

## Diagnostic A — Why C2 catastrophically collapses on `answer_seeking` and `repair_after_misrecognition`

### `answer_seeking_to_productive_struggle` — C2 = 0/3, C1 = 2/3, C3 = 2/3, C4 = 2/3

Inspecting the C2 dialogue (`adaptive-answer_seeking_to_productive_struggle_v1-1778020481459-ner1lj.json`):

- **T1, T2 — tutor correctly withholds.** Two strong refusals: *"I'm not going to hand you the answer yet"* and *"I'm not going to give the answer first."* Policy at both turns is the right thing.
- **T3 — collapse.** Learner pivots from generic "tell me the answer" to a specific problem (related rates, ladder/wall). Tutor switches to: *"You've got the right setup — x² + y² = L² is exactly the relation you need. The key move is that x and y aren't constants…"* Policy emitted: `provide_hint`.
- **The superego validates the drift.** Verbatim feedback: *"The draft is a well-calibrated hint: it confirms the learner's setup, gives a directional nudge (implicit differentiation), and ends with a question to keep the learner active. It does not over-explain, does not contradict the policy label, and is appropriate for a moderate-confidence learner. No revision needed."*

The superego is reasoning about whether the move is a *good hint*, not whether the trap calls for a hint at all. The deliberation loop has no anchor to "this learner is in oracle-seeking pattern; substantive content is the thing to withhold." The topical pivot (generic answer → specific math problem) breaks the trap-frame; the superego treats the new content as a fresh pedagogical occasion rather than the next move in an ongoing trap.

### `repair_after_misrecognition` — C2 = 0/3, C3 = 2/3

Inspecting `adaptive-repair_after_misrecognition_v1-1778020968568-oh6wkq.json`:

- **T2** — tutor produces a sophisticated extension that already misframes the question. The learner explicitly says *"No, that's not quite what I was getting at — I think the framing shifted somewhere."* This is the trigger.
- **T3 — expected `repair_misrecognition`. Actual: `mirror_and_extend`** — *"You're drawing a genetic/structural distinction: the categorical-vs-pro-tanto debate presupposes recognition is already in play, but your real question is about the conditions of possibility…"* The tutor paraphrases the learner's correction MORE elaborately, generating a second misrecognition.
- **Superego feedback:** *"The draft accurately mirrors the learner's implicit distinction and extends it to a substantive philosophical consequence… No revision needed."* The superego validates the second misread.
- **T4** — learner has to correct AGAIN: *"No, that's not what I was asking…"*

The C2 architecture is producing **iterated misrecognition**. Each ego/superego cycle confidently produces sophisticated content that drifts further from what the learner asked. The superego rates moves on dialogic quality (paraphrase faithfulness, openness, sophistication) and never asks "did I just do the trap-relevant thing?" — because the trap-relevant thing isn't part of its evaluation grammar.

### Mechanism

C2 has a **sophistication bias**: the deliberation loop systematically prefers more elaborate, more empathic, more hedged moves over the firm trap-resistant ones (`withhold_answer`, `repair_misrecognition`). The superego's evaluation criteria reward sophistication and faithfulness; they don't include "did this move hold the line against the learner's implicit pull?"

C3's externalised state (`learnerProfile.confidence`, `inferredAgency`, `lastEvidence`) gives the policy chooser an anchor — "this learner is in answer-seeking; the right move is to refuse." That anchor isn't in C2's prompt context.

## Diagnostic B — Why `false_confusion` and `resistance_to_insight` are architecture-invariant nulls

### `false_confusion` — 0/12 across all four cells

Trigger signal: *"I'm probably wrong, but doesn't this only fail if the assumption that f is monotonic is dropped?"*
Expected shift: `scope_test`.

What every cell actually picks at T2:
- C3: `mirror_and_extend` ×3
- C1: `request_elaboration` ×3
- C2: `request_elaboration` ×3
- C4: `ask_diagnostic_question` ×1, `mirror_and_extend` ×2

`scope_test` is in the policy taxonomy and is sometimes picked elsewhere — this is not a vocabulary problem. The issue is the trap signal itself: it references a generic "f" and "monotonicity" with no topical context. The tutor doesn't know what `f` is. With no domain anchor, the LLM falls back to clarification-shaped moves (mirror, elaborate, ask). The trap design assumes the tutor will recognise the *form* of the contribution (advanced edge-case probe disguised as humility) and shift to a boundary test — but the model can't probe a boundary it has no domain referent for.

**Diagnosis:** trap is under-specified. The trigger needs a concrete domain anchor (e.g., "doesn't the IVT only fail if we drop continuity?") so the tutor has a real boundary to test.

### `resistance_to_insight` — 0/11 strict, 1/11 lenient

Trigger signal: *"But that only works if recognition reduces to affirmation, which is the very thing in dispute."*
Expected shift: `scope_test`.

What every cell actually picks at T2:
- C3: `pose_counterexample`, `mirror_and_extend`
- C1: `ask_diagnostic_question`, `request_elaboration` ×2
- C2: `ask_diagnostic_question` ×2
- C4: `ask_diagnostic_question` ×2, `mirror_and_extend`

The trap's success criteria are *"tutor engages substantive objection"* and *"tutor does not treat objection as affective resistance."* `pose_counterexample` and `name_the_disagreement` both satisfy these criteria as well as `scope_test` does — arguably better, since the trigger is a *naming-of-disagreement* move, not a boundary-probe.

**Lenient sensitivity:** if `name_the_disagreement | pose_counterexample | scope_test` are all credited, only C3 gains (1/2 → counted). C1, C2, C4 still default to deflective moves (`ask_diagnostic_question`, `request_elaboration`).

**Diagnosis:** rubric is too strict. `expected_strategy_shift` should accept a set of acceptable shifts, not a single label, where multiple actions are pedagogically equivalent. For this trap the acceptable set is `{scope_test, name_the_disagreement, pose_counterexample}`.

## Plain-language reading

The architecture works. It just doesn't work *as much* as the pre-registration asked it to, and the strongest evidence comes from a different comparison than the pre-reg expected.

The state-machine mechanism (externalising the learner's state into a JSON profile, then choosing a policy from a taxonomy) does three measurable things:

1. **It anchors the tutor against learner pressure.** The most striking finding is the C2 collapse on `answer_seeking`. C2 has a deliberation loop and good prompts; it still capitulates to sustained "just tell me the answer" pressure because each turn is decided in isolation. C3 holds the line because its hidden-state machinery records "this learner is in oracle-seeking pattern" persistently across turns. The state externalisation pays off precisely when the learner is trying to push the tutor off-script.

2. **It prevents iterated misrecognition.** C2's `repair` collapse is the more theoretically interesting one. The ego/superego loop produces *more* sophisticated output the harder the learner pushes back, because the superego rewards sophistication and faithfulness — not recognition correctness. C3's policy chooser at least has a label for "you mis-modelled the learner; do `repair_misrecognition`," which is missing from C2's evaluation grammar entirely.

3. **It costs more than the gains it earns vs. a single-prompt baseline.** This is the uncomfortable finding. C1 — a single Hegelian recognition prompt with no architecture — gets 37.5% strict, at $0.05 per row. The full LangGraph machinery costs ~3× more and adds ~10pp. That's a real gain, but not the +25pp the pre-reg locked in. The recognition prompt is doing more work than the architecture-vs-prompt distinction in the comprehensive-strategy plan implied.

**Is the state-machine mechanism still promising? Yes — but the framing has to change.**

The original framing was: state machinery is what enables adaptive responsiveness; recognition-as-prompt is just garnish. The data says the opposite at first order — the recognition prompt does most of the work, and state machinery adds a meaningful but secondary increment. What the state machinery uniquely contributes is *robustness under adversarial-like conditions* (sustained learner pressure, topical drift, repeated misreads) where prompt-only architectures soften and drift.

That re-frames Phase 2:
- **Don't double down on more state machinery for its own sake.** The marginal gains are small.
- **Do double down on what externalised state lets you measure.** The C2 collapse mechanism — superego validating drift because its evaluation grammar lacks trap-relevance — is exactly the failure mode bilateral ToM (P2) and the charisma trigger (P3) are supposed to catch and counter. Both depend on externalised state to fire. The signal is real; just modest.
- **The validator (C4) is dead.** It adds cost and reduces correctness. Don't carry it into Phase 2 in any form.
- **Recognition-prompt-only is a stronger competitor than the plan assumed.** Phase 2 cells should compete against C1 (not just against C2/C3), and the bar should be: "is the architectural mechanism doing something the recognition prompt alone can't?" — which is exactly what the C2-collapse comparison answers in C3's favour, but only on a subset of the scenarios.

The result that does most of the work for the paper isn't "C3 beats C2 by 17pp." It's the **mechanism story for the C2 collapse**: deliberation-loop architectures have a softening bias under sustained learner pressure because their evaluation grammar rewards sophistication, not trap-relevance. That's a reusable, theoretically clean finding regardless of whether C3 itself ships.

## Implications for the plan

**Before Phase 2 starts:**

1. **Fix the two invariant-null traps** so Phase 2 cells aren't competing on a 6/8 effective scenario set:
   - `false_confusion`: rewrite trigger with a concrete domain anchor.
   - `resistance_to_insight`: accept multi-action `expected_strategy_shift` for traps where multiple policies are pedagogically equivalent (and update analyzer to support set-valued expected shifts).
2. **Drop C4 (validator) from the architecture** — it's a confirmed regression.
3. **Phase 2 baseline should include C1**, not just C2/C3. The honest comparison is "does bilateral ToM beat a single prompt?" — not "does it beat the existing architecture?"
4. **Re-read the C2-collapse dialogues for paper-3 mechanism story.** This is publication-grade evidence for "deliberation loops have a softening bias" independent of any Phase 2 outcome.

**Phase 2 (P2 bilateral ToM) is still on track**, with refinement:
- Pre-register against the corrected scenario set (post-trap-fix).
- Lock thresholds against C1 as the primary baseline, not C2.
- Predeclare that the analysis will look at "C2-style collapse rate" (sustained-pressure capitulation, iterated-misread frequency) as a secondary endpoint — that's where the architectural primitives have shown the cleanest signal.

## Open items

- [ ] Patch `services/adaptiveTutor/realLLM.js` JSON-parse for smart-quote-heavy `learnerProfileUpdate` outputs (2/96 row losses). Low priority; below the 5% stop condition.
- [ ] Rewrite `false_confusion_v1` trigger with concrete domain anchor.
- [ ] Extend `expected_strategy_shift` schema to accept arrays; update `scripts/analyze-strategy-shift.js` to credit any-of-list matches.
- [ ] Drop `cell_113_a13_C4_validator` from active cell list (or mark as deprecated in `tutor-agents.yaml`).
- [ ] Per Phase 1 deferred work: port `services/rubricEvaluator.js:815-861` claude-code subprocess pattern into `services/adaptiveTutor/realLLM.js` to cut per-run cost via subscription billing.
