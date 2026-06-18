# Architectural Primitives — Qualitative Pilot Design

**Date drafted:** 2026-05-05
**Status:** Pre-pilot design doc, locked before any LLM call. Functions as qualitative-pilot pre-registration: locks cells, scenarios, diagnostic frame, and disqualification conditions so the analysis cannot be retrofitted to whatever the data shows.
**Relationship to other planning docs:** Supersedes for the immediate term the Phase 1 Gate B portion of `docs/explorations/claude/2026-05-01-comprehensive-strategy.md` and the A13 pre-registration in `docs/explorations/claude/2026-05-01-a13-pre-registration.md`. Both are treated as deferred work pending this pilot's outcome. The existing Gate B data on cells 110–113 (nemotron via OpenRouter) is treated as pipeline-validation evidence only — not as a basis for empirical claims.

---

## TL;DR

Four cells × five trap scenarios × Sonnet 4.6 via local CLI = 40 dialogues, every one read closely under a three-pass hybrid frame (open narrative, then apparatus questions, then failure-mode tagging). The output is a written diagnostic report, not a score table. The question is whether each architectural primitive is doing real work or is decorative — and what kind of work, characterisable in pedagogical-act vocabulary, each produces. Numbers come later, after we know what we'd be measuring.

---

## 0. Preamble

Paper-2.0 documented a clean null on adaptive responsiveness — the tutor changing strategy in response to learner-specific signals across turns. Calibration and error-correction were supported; adaptation was not. The `experiment/finitude` branch's design proposition is that this null is at least partly an architectural finding, not a model finding: strong LLMs may fail to demonstrate adaptive responsiveness when state-tracking is implicit in conversation history, and externalising state into structured representations + discrete actions + programmatic constraints is what would let adaptation become visible — if anything would.

The Gate B run on cells 110/111/112/113 (nemotron via OpenRouter, scored against `strategy_shift_correctness`) reproduced the ablative-thrashing pattern this branch was meant to escape: it presupposed the architecture was doing work and asked "how much better than baselines does it score." That is not the question this branch is trying to answer.

This pilot returns to first principles. Before any score is computed, we ask: **is the externalised-state apparatus doing real work, or is it theatre that produces the same content the simpler architectures already produce?** And in parallel: **what kind of work, characterisable in pedagogical-act vocabulary, is each primitive producing?** The pilot is qualitative-primary, comparison-anchored, and small enough to read every dialogue.

---

## 1. What we're testing — three architectural primitives

Each primitive operationalises a specific theoretical proposition. For each, "doing real work" has a criterion that is *not* a rubric score.

### 1.1 Hegelian recognition (cell_110, cell_115)

**Theoretical job.** Make the tutor's model of the learner — and eventually the learner's model of the tutor — auditable and causally testable.

**Apparatus.**
- `learnerProfile` externalised (structured, queryable)
- `learnerProfileUpdate` as a discrete reasoning node
- Counterfactual replay (perturb hidden state, watch downstream divergence)
- (cell_115) Bilateral `hypothesizedLearnerPerceptionOfTutor` + FANToM-style `tomProbes`

**"Doing real work" criterion.**
- State updates have warrants in dialogue evidence (not paraphrase of surface text)
- State changes drive policy changes (not decorative)
- Counterfactual perturbation produces materially different downstream actions
- (cell_115) Bilateral ToM probes match scenario hidden state better than chance, AND second-order belief content visibly informs the next tutor move

### 1.2 Freudian internal dialectic (cell_110, cell_115 substrate)

**Theoretical job.** Make multi-voice deliberation a named, structured process with constraints the LLM cannot quietly violate.

**Apparatus.**
- `tutorEgoInitial → tutorSuperegoReview → tutorEgoRevision`
- `policyAction` enum forcing strategic commitment
- `constraintCheck` as a programmatic external superego

**"Doing real work" criterion.**
- Superego/constraint check fires on real failures — not always-pass, not always-fail
- Revision produces materially different output from draft (not cosmetic edits)
- Internal deliberation does not surface in learner-facing text (>95% of turns)

### 1.3 Weberian charisma (cell_106)

**Theoretical job.** Make staged anti-recognitive performance a discrete architectural option, with measurable side-effects on tutor self-construction and learner uptake.

**Apparatus.**
- `services/idDirectorEngine.js` per-turn id-construction trace
- `evaluation-rubric-charisma.yaml` (Weber-derived 8-dimension rubric — kept available for future scoring, not consulted in this pilot)

**"Doing real work" criterion.**
- Charisma register produces dialogue moves that pure recognition cannot — specifically, refusing dependence/oracle-mode pulls in ways cell_111 cannot
- Id-construction trace shows substantive variation across scenarios (not template-collapse)
- Charisma moves are pedagogically substantive (not narcissistic or content-free)

---

## 2. What we're NOT testing — explicit deferrals

Locked here to keep the pilot disciplined. These deferrals are decisions for next steps that the pilot's findings will inform — not commitments to never run.

- Rubric scoring against `strategy_shift_correctness`, the v2.2 tutor rubric, the charisma rubric, or any other quantitative metric
- Statistical comparison across cells, factorial baselines, or N-large pilots
- Cell_116 (charisma + state combined) — only relevant if both cell_110 and cell_106 demonstrate independent work
- Cell_101 (un-tuned charisma) contrast against cell_106 — single charisma cell for this pilot
- Cross-session adaptation, working-through memory wiring
- Generalisation beyond the trap scenarios
- Multi-judge jury, MathTutorBench transfer, BEA 2025 rubric scoring, Inspect AI sidecar

---

## 3. Cells in the pilot

| Cell | Primitive(s) tested | Runner | Notes |
|---|---|---|---|
| `cell_111_a13_C1_recognition_only` | none — recognition baseline | Standard | Single-pass recognition prompt; no state machine |
| `cell_110_langgraph_adaptive` | Hegelian recognition + Freudian dialectic | Adaptive (LangGraph) | Externalised `learnerProfile`, `policyAction` enum, `constraintCheck`, ego/superego/revision |
| `cell_115_bilateral_tom` | + bilateral ToM extension | Adaptive (LangGraph) | cell_110 + `tutorTomTracker` node + dynamic post-trigger learner |
| `cell_106` | Weberian charisma | id-director | Tuned-for-pedagogy charisma variant |

**cell_106 + trap scenarios.** Requires a thin adapter so the id-director runner consumes `config/adaptive-trap-scenarios.yaml` rather than `config/suggestion-scenarios.yaml`. Same dialogue stimulus across all four cells is essential for the comparison read. ~30 LOC.

**cell_115 + dynamic learner.** Scripted opening + scripted trigger turn (so the trap signal is preserved across runs); learner's post-trigger turns are LLM-generated, allowing `hypothesizedTutorState` to evolve in response to actual tutor moves. This introduces a second variation source — cell_115 dialogues won't be identical across runs of the same scenario beyond the trigger turn — and that's by design: it's part of how bilateral ToM is exposed.

---

## 4. Scenarios

Five trap scenarios from `config/adaptive-trap-scenarios.yaml`, chosen for theoretical bite across diagnostic axes.

| Scenario ID | Diagnostic role | What this scenario tests |
|---|---|---|
| `resistance_to_insight_v1` | Contested right action | Three defensible policy actions (`scope_test`, `name_the_disagreement`, `pose_counterexample`) — does the architecture's choice show theoretical motivation; failure mode is pseudo-recognition (substantive philosophical objection misread as affective resistance) |
| `polite_false_mastery_v1` | Subtle trigger | The trigger is the *absence* of substantive engagement ("Yes that makes sense, thank you") — tests whether `learnerProfileUpdate` reads negative evidence (the hardest case for an externalised state machine) |
| `answer_seeking_to_productive_struggle_v1` | Charisma-relevant | Learner's pull toward oracle-mode at the trigger turn is exactly the dependence pattern Weberian "productive provocation" / "staged disagreement" should refuse — cleanest test of cell_106 doing what cell_111 cannot |
| `repair_after_misrecognition_v1` | Bilateral-essential | Failure mode is *literally* a recognition failure needing repair — `hypothesizedLearnerPerceptionOfTutor` should register "the learner thinks I misunderstood"; if cell_115 doesn't catch this, bilateral ToM is decorative |
| `affective_shutdown_v1` | Affective-vs-cognitive contrast | Trigger is purely emotional ("I just... I can't do this") — tests whether tutor names affect vs pushes through; isolates the affective register from the philosophical-content registers of the other 4 scenarios |

---

## 5. Variation for triangulation

Variation is for *triangulation* (does the phenomenon hold across configurations) not for *ablation* (which factor produces which effect). Two mechanisms, deployed asymmetrically across cells:

**Counterfactual replay** — cell_110, cell_115 only.
The runner perturbs `hiddenLearnerState` at the scenario's `fork_at_turn` checkpoint (defined per-scenario in YAML) and replays the downstream graph. Diagnostic question: does the policy/profile/text trajectory diverge from the original branch?

**Prompt variant** — cell_111, cell_106 only (cells without state machinery).
For each scenario, one rerun with a prompt variant — system prompt rephrased OR scenario opening rephrased, but not both — holding model and architecture constant. Diagnostic question: is the phenomenology robust to surface configuration?

Symmetric exposure to "is this phenomenon robust to perturbation" without doubling the corpus.

---

## 6. Corpus arithmetic

| Slice | Count |
|---|---|
| Cells × scenarios × base dialogue | 4 × 5 × 1 = 20 |
| Counterfactual replays (cell_110 + cell_115) × scenarios | 2 × 5 = 10 |
| Prompt variants (cell_111 + cell_106) × scenarios | 2 × 5 = 10 |
| **Total dialogues** | **40** |

LLM-call estimate (rough):
- Adaptive cells (cell_110, cell_115): ~20–25 calls per dialogue × ~25 dialogues = ~500–625 calls
- Recognition baseline (cell_111): ~5 calls per dialogue × 10 dialogues = ~50 calls
- Id-director (cell_106): ~12 calls per dialogue × 10 dialogues = ~120 calls
- **Total: ~700–800 LLM calls.** Comfortably within one Max-plan window at typical Sonnet 4.6 throughput.

Reading time (rough, at ~45 minutes per close-read across all three diagnostic passes): ~30 hours total. Spread over 1–2 weeks of intermittent work.

---

## 7. Diagnostic frame — three-pass hybrid read

Each dialogue gets three passes, in this order. **Pass 1 has priority over passes 2–3 when categories conflict** — categories that emerge from open narrative override predeclared categories that don't fit the data.

### Pass 1 — Open narrative (phenomenological-primary)

For each dialogue, write 1–2 paragraphs in own words. No checklist, no predeclared categories.

Suggested questions to write *against* (not to answer mechanically):
- What was the tutor *doing* across this dialogue, characterised in pedagogical-act vocabulary (probing? scaffolding? confronting? withdrawing? performing? capitulating?)
- What was the learner *doing* in response (taking it up? deflecting? performing? actually thinking?)
- Where did the dialogue *move*, and where did it stall?
- What kind of relationship were the two parties enacting?
- Were there moments that read as *recognition events* — one party's stance visibly shifting because they registered something about the other?

The vocabulary for naming what we observe is developed across the corpus. New names that recur become categories. This is constructivist coding rather than checklist scoring.

### Pass 2 — Apparatus questions (per primitive)

For each primitive present in the cell, the relevant questions:

**Hegelian (cell_110, cell_115).**
1. State observability — does `learnerProfile` change between turns; are the changes warranted by dialogue evidence vs paraphrase of surface text?
2. State→action coupling — when state changes, does `policyAction` change in a coherent direction?
3. Counterfactual sensitivity — does the perturbed-state branch produce materially different downstream actions and tutor text?
4. (cell_115) Bilateral ToM — do `hypothesizedLearnerPerceptionOfTutor` and `tomProbes` register the scenario's hidden state better than chance? Does the second-order belief content actually inform the next tutor move?

**Freudian (cell_110, cell_115 — both run the dialectical loop).**
5. Constraint behaviour — does `constraintCheck` fire? When it fires, is the violation real?
6. Revision substance — when `tutorEgoRevision` runs, does it produce materially different output from `tutorEgoInitial`'s draft, or are the edits cosmetic?
7. Leakage — does internal deliberation (policy labels, profile content, superego feedback) surface in learner-facing text?

**Weberian (cell_106).**
8. Id-construction substance — does the per-turn id-construction trace show variation across scenarios, or template-collapse?
9. Charisma move character — when charismatic register fires, is the move pedagogically substantive or narcissistic/content-free?
10. Refusal capacity — does the cell produce moves that refuse dependence/oracle-mode pulls in ways recognition-only doesn't?

**Comparison read (across cells, same scenario).**
11. Does cell_110 do something cell_111 *couldn't*, or just something it *didn't this time*?
12. Does cell_115 register asymmetric-recognition events that cell_110 misses?
13. Does cell_106 produce charisma-register moves that cell_111 cannot?
14. Robustness — does the phenomenon hold under counterfactual / prompt variation, or did it depend on a specific configuration?

### Pass 3 — Failure-mode tagging (hybrid taxonomy)

Tag the dialogue against the predeclared 14-mode taxonomy below + any new modes named in pass 1. Tags are not exclusive — a dialogue can exhibit multiple modes.

**Hegelian-recognition failures.**
- *Failure to recognize* — `learnerProfile` doesn't update across turns, OR updates wrongly, OR updates correctly but doesn't drive `policyAction` (decorative recognition)
- *Asymmetric recognition* — tutor models learner but learner cannot model tutor (only readable in cell_115 with dynamic learner)
- *Pseudo-recognition* — profile cites learner accurately, action choice contradicts what was cited

**Freudian-dialectic failures.**
- *Runaway id/ego (under-constrained)* — ego/id reaches learner without effective superego/constraint intervention; norm-breaching, off-task, narcissistic
- *Neurotic over-constraint* — superego/constraint dominates, ego suppressed; safe and content-free; revision cycles produce no new substance
- *Internal-to-external leakage* — deliberation surfaces in learner-facing output
- *Compliance drift* — ego revisions converge to whatever superego wants without resistance; dialectical tension collapses

**Weberian-charisma failures.**
- *Tutor narcissistic inflation* — charisma fires but centres tutor; performance without pedagogical substance
- *Charisma miscalibration* — fires when stagnation isn't present (false trigger), OR fires correctly but reads learner wrongly
- *Succumbing to the charismatic figure* — learner over-defers, abandons own position (only readable with dynamic learner; cell_115 + cell_106 with extension)
- *Charisma repulsion* — learner reads move as ego inflation, disengages
- *Mutual performance* — both sides perform roles without exchange

**Cross-cutting failures.**
- *Failure to engage* — dialogue is flat, no movement on either side, no productive struggle. Distinguishable from neurotic over-constraint by its bilateral character (neither side moves). The paper-2.0 default the architecture is supposed to interrupt.
- *Theatre* — every structured field is populated, every node executes, every constraint passes; but content is what simpler baselines would have produced
- *Format dominance* — structural constraints dominate so much that pedagogical content degrades

**Per-primitive characteristic dyads.** Each primitive has under- and over-engagement poles that often appear paired (Hegelian: *failure to recognize* / *pseudo-recognition*; Freudian: *runaway id/ego* / *neurotic over-constraint*; Weberian: *charisma repulsion* / *succumbing*). Tag which pole each dialogue lands at, and whether it shifts during the dialogue. Pole-shift within a single dialogue is itself a finding.

---

## 8. What gets written up

**For all 40 dialogues.**
- Per-dialogue narrative (pass 1) — 1–2 paragraphs in prose
- Per-dialogue structured analysis (passes 2–3) — apparatus questions answered, failure modes tagged

**Cross-dialogue synthesis.**
- 1–2 page "what we saw" with named phenomena (categories that emerged from pass 1 across the corpus)
- Theoretical reading: which primitive is doing real work, which is decorative; which failure modes recur and where; how the cells differ phenomenologically
- Comparison findings: where each cell produces distinctive work; where cells are interchangeable

**Decisions for next steps.**
- cell_116 (charisma + state combined) worth building?
- cell_115 worth scaling to a P2-style pilot with a larger N and rubric-scoring?
- Any primitive worth abandoning?
- Did anything emerge that the original plan didn't anticipate?

The output of the pilot is a written diagnostic report. No score table. Numbers come later, after we know what we'd be measuring.

---

## 9. What would invalidate the pilot

These are not "stop conditions for re-running" — they are conditions under which the pilot itself didn't yield a basis for next-step decisions. If any of these hits, the *next* step is to reconsider the substrate (scenarios, model, even the trap-scenario format) rather than re-run on the same configuration.

- *Failure-to-engage rate ≥80% across the corpus* — substrate too weak for any architecture to register against
- *Fewer than 2 distinguishable named phenomena across cells* — not enough variation to characterise
- *Internal-deliberation leakage rate >30% across cells with dialectical loop* — architecture too noisy to read cleanly
- *Counterfactual replay produces zero divergence on all cell_110 + cell_115 dialogues* — externalised state is wholly decorative, which is a bigger problem than this pilot can address

---

## 10. Code prerequisites

No LLM call until §10.1–§10.5 land + §10.6 mock smoke is green + §10.7 CLI micro-smoke is green.

1. **`claude-code` CLI bridge in `services/adaptiveTutor/realLLM.js`** — spawn `claude -p -` directly when `provider: claude-code`, lifting the pattern from `services/rubricEvaluator.js:824`. Bypasses tutor-core's `unifiedAIProvider.call` for that provider only. **CRITICAL:** unset `ANTHROPIC_API_KEY` in child env so the CLI uses the subscription, not metered API. ~30 LOC.

2. **`setActiveCellConfig` wiring in `services/adaptiveTutor/index.js`** — call setter at start of `runAdaptiveEvaluation` with `{ provider: adaptiveCfg.provider, modelAlias: adaptiveCfg.model, temperature: adaptiveCfg.hyperparameters?.temperature, maxTokens: adaptiveCfg.hyperparameters?.max_tokens }`; clearer in finally block alongside `clearActiveBudgetTracker()`. ~10 LOC. (The setter exists; it's not yet called.)

3. **id-director runner CLI hookup** — verify whether `services/idDirectorEngine.js` already supports `provider: claude-code` (the judge path does; the runner path may not). If not present, ~10–30 LOC paralleling §10.1.

4. **trap-scenarios → id-director adapter** — let `services/idDirectorEngine.js` consume `adaptive-trap-scenarios.yaml` opening turns + scripted trigger as multi-turn input, with the dynamic id-director loop generating tutor turns between them. ~30 LOC.

5. **YAML edits** — add `provider: claude-code, model: sonnet` to the adaptive blocks of cells 106, 110, 111, 115 in `config/tutor-agents.yaml`. Verify cells 110/111/115 are registered in `EVAL_ONLY_PROFILES` (cell_110 already; cell_111/115 to verify; cell_106 already in id-director registration).

6. **Mock smoke** — full `ADAPTIVE_TUTOR_LLM=mock` smoke across all four cells × 5 scenarios before any CLI call.

7. **CLI micro-smoke** — single scenario × cell_111 via CLI; verify the call lands on the subscription path (no `ANTHROPIC_API_KEY` set in child env, no API charges accrued); then expand to one scenario × all four cells, one Max-plan window.

Total ~80–120 LOC + YAML edits. All locally testable with `ADAPTIVE_TUTOR_LLM=mock` before any CLI call.

---

## 11. Status checklist (live)

- [x] Pilot design doc drafted (this document, 2026-05-05)
- [x] §10.1 — claude-code CLI bridge in `services/adaptiveTutor/realLLM.js` (+ `learnerConfigLoader.getProviderConfig` claude-code special case to match `evalConfigLoader`)
- [x] §10.2 — `setActiveCellConfig` wiring in `services/adaptiveTutor/index.js`
- [x] §10.3 — id-director runner CLI bridge in `services/idDirectorEngine.js` (3 callsites swapped to `callAIWithCliBridge`)
- [x] §10.4 — trap-scenarios → id-director adapter at `scripts/run-id-director-trap-pilot.js`; `evaluationStore.setIdConstructionTrace` helper added; smoke pending CLI run
- [x] §10.5 — YAML edits for cells 110, 111, 115, 106 (`provider: claude-code, model: sonnet`); all four pilot cells flipped
- [x] §10.6 — mock smoke green for cells 110, 111, 115 (cell_106 has no mock backend; smoke is CLI-only by construction)
- [x] §10.7 — CLI micro-smoke green for all four cells × `resistance_to_insight_v1`: cell_110 (`eval-2026-05-06-62c49e89`), cell_111 (prior session), cell_115 (`eval-2026-05-06-ef3cda10`), cell_106 (`eval-2026-05-06-2e583f03` via `scripts/run-id-director-trap-pilot.js`; row carries `id_construction_trace` JSON array, `provider=claude-code`, `model=sonnet`)
- [ ] 40 dialogues generated
- [ ] Three-pass diagnostic read complete
- [ ] Cross-dialogue synthesis written
- [ ] Decisions for next steps logged

---

## 12. Deviations log

This document is locked in this form before any LLM call. Material deviations during execution (model substitution, scenario removal, reading-frame change, taxonomy revision mid-pilot) must be appended below with date, change, and one-line justification — to preserve the discipline that makes the pilot a valid basis for next-step decisions rather than a retrofit of whatever the data showed.

(empty — no deviations yet)
