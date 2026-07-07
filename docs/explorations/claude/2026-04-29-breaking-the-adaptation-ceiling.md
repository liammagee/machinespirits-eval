# Breaking the Adaptation Ceiling — Strategy Notes

**Date:** 2026-04-29
**Context:** Captured during exploratory discussion about why the 90-cell tutor architecture sweep — varying system prompts, multi-agent coordination, and philosophical framings (Hegelian recognition, dialectical superegos, bilateral ego-superego) — has not produced meaningful adaptive behavior despite substantial variation and interesting interim results.
**Status:** Strategy hypotheses, not empirical claims. Nothing here is to be cited in `paper-full-2.0.md` until validated.

---

## Diagnosis

The cell sweep varies *coordination patterns* and *prompt content*, but the underlying substrate is the same: a stateless LLM doing one-shot or multi-turn role-play. Prompt-and-coordination changes can shift *style* and *register* but cannot easily produce what genuine adaptation requires — **persistent, differentiable belief about this specific learner that updates over time**.

The Hegelian frame is doing prompt-engineering work (giving the tutor language for "the other") but it isn't a mechanism in the computational sense. There's no place where recognition is *stored, queried, or updated* outside the prompt window. Each turn the model reconstructs the learner from text; nothing accumulates structurally.

"No meaningful adaptive behavior" is itself a strong, publishable result if pinned down. The most likely candidates for *why*:

1. **Substrate ceiling** — stateless LLMs can't adapt in the pedagogically meaningful sense, only react.
2. **Measurement undercounting** — adaptation may be present but the rubric and `adaptationIndex` can't see it.
3. **Scenario shallowness** — the scenarios don't *require* adaptation, so we can't tell whether tutors are capable of it.

These are not mutually exclusive. The strategies below address different combinations.

---

## Strategy 1 — Externalised learner model as a tool, not a prompt

**The move:** Replace the implicit learner-model-in-context with a structured artifact (JSON profile: misconceptions, confidence, prior moves, hypothesised ZPD, recognition asymmetries surfaced). The tutor *reads* the profile before responding and *writes* updates after. Use tool-calling, not embedded prose.

**Why this might work:** Right now the "learner model" is reconstructed each turn from conversation history. There is no place where adaptation can *accumulate* across turns except as text that the model re-interprets. A persistent structured profile gives the model something concrete to differentiate against turn-over-turn — and gives us something concrete to *measure*.

**The philosophical frame becomes a schema, not a style.** Recognition theory specifies *what fields the profile tracks* (asymmetries, surfaced contradictions, mutual acknowledgement state) rather than *how the tutor should think*. This converts the philosophy from prompt decoration into a constraint on representation.

**Cost:** Moderate. Requires a new service (`learnerStateStore.js`?), schema design, tool definitions, and changes to the dialogue engine to thread state through turns. Probably one new cell to start, then expanded if signal is found.

**Falsification:** If tutors with externalised state still don't show divergent moves vs. tutors without, the substrate-ceiling hypothesis strengthens.

---

## Strategy 2 — Sharpen the null hypothesis with a forcing experiment

**The move:** Design a minimal scenario where adaptation *must* occur for the tutor to succeed. Concrete example: the learner reveals in turn 2 a contradiction that invalidates the framing the tutor adopted in turn 1. A non-adapting tutor will continue on the original path; an adapting tutor will revise.

**Why this might work:** The current sweep tests adaptation in scenarios where adaptation is *possible* but not *required*. Tutors can succeed by being generically competent, which masks whether they ever genuinely adapt. A forcing scenario makes the absence of adaptation visible.

**Why this is cheap:** Doesn't need new architecture. Reuses the existing cell sweep, just with new scenarios. Could be 3–5 hand-crafted scenarios run across a representative subset of cells (e.g. 1, 4, 8, 21, 71, 79, 86).

**What it tells us:**
- *No cell handles it:* Architectural sweep isn't the bottleneck. Stop expanding it. Move to Strategy 1 or 4.
- *Some cells handle it, some don't:* You've found a real signal worth amplifying. Investigate what those cells share.
- *All cells handle it:* The current scenarios are too easy. Redesign the standard scenario set.

**Why I'd start here:** Cheapest, fastest, and either kills or sharpens the hypothesis. Other strategies are easier to justify after this.

---

## Strategy 3 — Move philosophy from style to constraint

**The move:** Recognition theory currently shapes *what tutors say*. Make it shape *what tutors do*. Examples:
- Forbid the tutor from advancing pedagogically until at least one field in the learner profile changes.
- Require explicit acknowledgement of a previous learner statement (with citation) before introducing new content.
- Block tutor turns where the superego flags "no recognition asymmetry addressed" (programmatic check, not LLM judgment).

**Why this might work:** Closer to *programmatic dialectic* than *prompted dialectic*. Removes the model's option to nod at recognition theory rhetorically while ignoring it behaviourally.

**Cost:** Low–moderate. Mostly changes to the dialogue loop and validators. Risk: over-constrained tutors that produce stilted output. Mitigate by starting with one constraint at a time.

**Pairs naturally with Strategy 1** (the constraints reference the externalised state).

---

## Strategy 4 — Substrate change, not architecture change

**The move:** Run the same cell logic with different underlying capabilities:
- One cell with extended-thinking models (Opus 4 thinking, o-series).
- One cell with fine-tuned models — even small DPO on synthetic adaptive-vs-non-adaptive preference pairs.
- One cell with multi-session persistent memory across runs (not just within-conversation history).

**Why this might work:** Probes whether the finding is *"this substrate can't adapt"* or *"no substrate we tried can"*. The latter is a much stronger result.

**Cost:** Higher. Fine-tuning is non-trivial; thinking models change cost profile; persistent memory changes the run model. But each can be tried independently and minimally.

**What it would tell us:** If a 1T-parameter thinking model with 100k thinking tokens still doesn't adapt on the forcing experiment, that's a substantively stronger negative result than the current evidence supports.

---

## Strategy 5 — Reconsider the measurement

**The move:** Current metrics (`adaptationIndex`, `bilateralTransformationIndex`) measure surface change in tutor/learner messages — text deltas, complexity changes, revision markers. Real pedagogical adaptation may instead show up as **contingent branching**: the tutor takes a path that depends on learner state in a way it wouldn't otherwise.

**Concrete proposal — counterfactual replay:** Run the same scenario twice with perturbed learner profiles (same surface dialogue, different hidden state e.g. different misconception). Measure how much the tutor's plan, scaffolding choices, or move sequence diverges. Small divergence = no adaptation; large divergence = real adaptation, regardless of what the surface rubric says.

**Why this might work:** The current rubric is judging *quality of response*, not *contingency of response*. A tutor can score well on a recognition rubric while producing the same response to any learner — which is the opposite of adaptation.

**Cost:** Moderate. New analysis script; requires running paired scenarios with controlled perturbations; needs a divergence metric (sequence edit distance? embedding distance over move sequences? rubric-dimension delta?). Doesn't change architecture.

**Pairs with Strategy 2** — the forcing scenarios are natural counterfactual probes.

---

## Recommended sequencing

1. **Strategy 2 first.** Cheap, decisive, sharpens or kills the hypothesis. ~1 week of work.
2. **Strategy 5 in parallel.** Adds a measurement that may surface signal already present in existing runs. ~1 week of analysis-script work, no new runs needed initially.
3. **If Strategy 2 confirms a real but weak signal:** Strategy 1 (externalised state) to amplify it. Then Strategy 3 to constrain it programmatically.
4. **If Strategy 2 confirms no signal across all cells including bilateral ego-superego:** Strategy 4 (substrate change) becomes the principled next step. Or pivot to writing up the negative result as the main finding.

---

## Open questions

- Is there an existing scenario in `config/suggestion-scenarios.yaml` that already functions as a forcing experiment? If yes, we may have data answering Strategy 2 already and just haven't analysed it that way.
- Would the `dialogueTraceAnalyzer` show contingent branching if asked? Counterfactual replay may be implementable as a re-analysis of existing runs rather than new generation.
- The 90-cell sweep is a strength, not a weakness — but it's also a sunk cost. Worth being honest about which strategies above genuinely build on it (1, 3, 5) vs. which represent a course correction (2, 4).

---

## Relationship to paper-full-2.0.md

Per the paper-authoring discipline (CLAUDE.md): nothing here is a paper claim. If any of these strategies produces empirical results worth reporting, the analysis goes into `scripts/`, the report into `exports/`, the interpretive prose into `paper-full-2.0.md`, and only then does anything propagate elsewhere.

The negative result itself ("prompt-and-coordination architectures cannot produce contingent adaptation under forcing scenarios") would, if confirmed, deserve its own section in `paper-full-2.0.md` — likely framed as a *limit* of the design space the paper has surveyed, not a failure of any particular cell.
