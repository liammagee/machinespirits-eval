# Dramatic Recognition: A Poetics-Level Evaluation of AI Tutoring

**Status:** design / pre-registration draft. New arc sanctioned 2026-05-19.
**Lands as:** a new numbered § of `docs/research/paper-full-2.0.md` (single-paper discipline — no spin-off).
**Supersedes the framing of:** `docs/critique/dialogical-felicity-experimental-design.md` and its `-response.md`. The felicity design was the right instinct (transcript-as-evidence, not interiority) but kept an effect-estimation grammar; this arc replaces that grammar with a typological/poetic one.
**Relation to the closed arcs:** *orthogonal* to the six adaptation nulls (§6.7 / §6.8.8 / §6.9.7 / §6.9.8 / §6.10). Those measured a latent variable (did the tutor read a hidden learner state). This measures a property of the artifact (does the transcript instantiate tragic form). It is **not** a re-proposal of Plan 2.0 / concealment-inference; it is a different object.

---

## 0. Thesis

Stop trying to measure learning as a hidden state in the learner (synthetic *or* human — we never have access to either). Treat the tutoring dialogue as a **drama**, and the evaluation framework as a **literary critic**. The warrant that drama bears on pedagogy is not ours to prove — it is the inheritance of the *Poetics*: well-formed tragedy effects **catharsis**, a clarification in the *audience* through sympathetic identification. So the locus of "learning" is the spectator-critic, not the learner-character. The empirical question becomes whether the drama-machine apparatus (ego/superego, Hegelian recognition, Weberian charisma) can produce a dialogue in which a blinded critic identifies **genuine peripeteia and anagnorisis** — real reversal-and-recognition — as against flat, regurgitative exposition.

## 1. The pivot

| | Closed adaptation arc | This arc |
|---|---|---|
| Object | latent learner state / tutor's adaptive read of it | dramatic form of the transcript |
| Criterion | "did the tutor adapt to the learner's failure?" | "does this drama instantiate tragic form (peripeteia + anagnorisis)?" |
| Epistemics | effect-estimation (has a *null*) | typological classification (no null — every dialogue lands *somewhere*: tragedy / melodrama / farce / inert exposition) |
| Learning located in | the learner (inaccessible) | the audience-critic, via catharsis (the 25-century warrant) |
| Synthetic-vs-human worry | a knot we tied ourselves in | **dissolved** — interiority is inaccessible for humans too; the fictive frame makes it irrelevant |

"Tragedy" here is **formal**, not thematic: peripeteia (reversal), anagnorisis (recognition), unity of action, hamartia — *not* catastrophe / the hero's fall. The high pole is "earned dramatic recognition," the low pole is "competent inert exposition."

## 2. Why this is clean of the six nulls

The nulls all shared one shape: they re-encoded what a strong base already infers in-context, then failed to find separable signal. That critique only bites against a *latent-variable effect* claim. A claim about the *form of an artifact* is not defeated by "the base already does recognition in-context" — a critic does not discount *Oedipus* because Sophocles already knew how to write. Provenance is irrelevant to whether the artifact exhibits the form. The arc is built to *test* whether anything exceeds fluent regurgitation, not to assume it.

## 3. Research question

> Can the drama-machine apparatus produce tutoring dialogues in which a blinded critic-evaluator reliably identifies genuine peripeteia and anagnorisis, at a rate above a flat baseline, where "genuine" is guarded against fluent simulation of recognition-vocabulary?

**Skeptic's null pole (must be returnable by the instrument):** "LLMs write monotonal, regurgitative scripts — no real reversal, therefore no catharsis, therefore no teaching in the cathartic sense." A good instrument must be *able* to return this, and probably will for most dialogue. That is the disconfirmation channel.

## 4. The hard problem

Distinguish **genuine recognition** from a **fluent simulation of recognition-vocabulary**. A model that writes "Aha — I now realize I was avoiding the concept!" has produced the *words* of anagnorisis at high probability. Detecting recognition-vocabulary is not detecting recognition. The entire apparatus below exists to beat this one trap.

## 5. Apparatus

### 5.1 Structural signature of genuine peripeteia: *surprising yet inevitable*

Aristotle's best recognition arises "contrary to expectation, yet on account of what came before." This is measurable without interiority, using the adaptive runner's existing **counterfactual replay** (`services/adaptiveTutor/`, already on `main`):

- **Withhold-the-reversal (forward surprise):** give a separate model the dialogue up to the turn *before* the putative reversal; sample K natural continuations. If the actual reversal is semantically far from that cloud of expected continuations, it was genuinely surprising. Operationalised at the level of the *continuation* (embedding distance from the sampled cloud, or a critic rating "how expected was this next turn, 1–5") — **not** over a discrete move taxonomy (see §5.2).
- **Retrospective coherence (inevitability):** show a critic the *whole* arc; ask whether the reversal makes the prior moves cohere.

| | coherent (retrospect) | incoherent |
|---|---|---|
| **surprising** (forward) | **genuine peripeteia** ✅ | non-sequitur |
| **unsurprising** | flat competent exposition (the regurgitation pole) | noise |

Recognition-*vocabulary* without structural rupture lands in *unsurprising × coherent* — which is exactly how this discriminates the genuine article from the simulation.

### 5.2 Situation anchoring — *not* a discrete move grammar

**Caveat (2026-05-19):** there is probably no clean, specifiable discrete "move grammar" for tutoring dialogue, and trying to build one would repeat the hand-coded-state-machine anti-pattern that has already failed in this project (the FSM that re-derived "learner is confused" added no signal). So the surprise measure (§5.1) stays in the *continuous/semantic* register — distance from a cloud of sampled continuations — and does **not** depend on enumerating a move taxonomy.

What A17 *does* anchor is the *dramatic situation*, and two mappings survive without any grammar:

- **hamartia = misconception.** A17's `misconception_family` (e.g. fractions "add-both") is the tragic flaw that drives the plot.
- **recognition-as-unlock.** A17 unlocks on behavioral correctness (k correct answers). The drama frame unlocks on **anagnorisis** — the learner *naming their own flaw* ("I keep demanding a formula because I don't trust the metaphor"). In tragedy the telos is recognition-achieved, not problem-solved.

### 5.3 Instrument: a Poetics rubric, sibling to the charisma rubric

Template already exists: `config/evaluation-rubric-charisma.yaml` (Weber, v1.0) lives *alongside* v2.2 in its own DB columns, cross-correlatable, independent of the pedagogy rubric. A `config/evaluation-rubric-poetics.yaml` (peripeteia, anagnorisis, unity of action, hamartia-integration, cathartic closure) follows the same pattern. It does **not** inherit §7.9's adaptation baggage — it is not an adaptation construct. Blinded critic via the existing `assess-transcripts.js --blinded` harness; **generator ≠ critic model** (closed-loop-eval-tells discipline).

### 5.4 Calibration anchor — the credibility gate (this is "step 0")

Before pointing the instrument at a single LLM transcript, **calibrate it on known material**: canonical recognition scenes (Oedipus's recognition; a Platonic elenchus turning at aporia) vs. flat expository dialogue (textbook Q&A). If the blinded instrument cannot rank-order *known* tragic-vs-flat dialogue, it is not ready to judge anything. This is the literary-critic analog of A17's held-out validation — there it validates learning-vs-memorization; here it validates genuine-vs-simulated recognition. **Thermometer calibrated on ice and steam before measuring the patient.**

## 6. Falsifiability / kill criteria (pre-registered)

- **Instrument gate (Phase 0):** blinded critic must separate known-tragic from known-flat with a pre-set margin. **If it fails → report that the instrument fails → the skeptic stands → that is the finding.** No downstream phases.
- **Anti-simulation gate (Phase 1):** the surprise×coherence quadrant must place known genuine-recognition scenes in *surprising×coherent* and recognition-vocabulary-without-rupture in *unsurprising×coherent*. If it cannot, the structural measure is not earning its keep.
- **Comparative gate (Phase 3):** drama-machine conditions must produce genuine-recognition above flat baseline, **surviving shuffled-turn collapse** (a recognition scene with moves reordered must score near-zero). If the score does not collapse under shuffle, the rubric measures polish, not form.
- **Honesty constraint:** "no null" must not become "no possible disconfirmation." The gates above are the disconfirmation channel; if they are removed or softened mid-arc, the result is closed-loop self-flattery (the adaptive-persona failure mode).

## 7. Phasing

- **Phase 0 — instrument + calibration.** Build the Poetics rubric + blinded critic; calibrate on a known-tragic / known-flat corpus. *Token-light* (critic-only, small fixed corpus). **No A17 dependency.** This is the gate.
- **Phase 1 — move grammar + surprise measure.** Define recognition/reversal *moves* (extends A17 speech-acts); implement withhold-the-reversal (counterfactual replay) + retrospective coherence; validate the quadrant on the calibration corpus.
- **Phase 2 — first patient = A17 transcripts.** Point the validated instrument at lock-puzzle dialogues; map hamartia=misconception, recognition-as-unlock. Needs A17 merged/available + generation tokens.
- **Phase 3 — comparative claim + controls.** Drama-machine conditions vs flat baseline on rate-of-tragic-form; shuffled-turn + form-destruction controls; blinding throughout.
- **Landing.** New § in `paper-full-2.0.md` (positive *or* negative), with the Poetics rubric version-tagged under `config/rubrics/`.

## 8. Engineering map (repo hooks)

- Counterfactual replay / move sampling: `services/adaptiveTutor/` (on `main` — independent of A17).
- Move vocabulary: A17 `services/adaptiveTutor/lockPuzzleMoves.js`, `policyActions.js`; `config/lock-puzzle-scenarios.yaml` (`misconception_family`).
- Rubric template: `config/evaluation-rubric-charisma.yaml` → new `config/evaluation-rubric-poetics.yaml`, versioned under `config/rubrics/`.
- Blinded critic harness: `scripts/assess-transcripts.js --blinded`; `blinded_qualitative_assessment` column; classificatory precedent in `scripts/code-impasse-strategies.js`.
- New DB columns (mirror charisma pattern): `tutor_poetics_scores`, `tutor_poetics_overall_score`, `tutor_poetics_rubric_version`, `poetics_critic_model`.

## 9. Branch + token context

- A17 *evaluation* is paused (token issue). Phase 0 does **not** need A17 transcripts or generation tokens, so the pause does not block starting this arc.
- Recommended: commit A17 WIP on `experiment/speech-act-lock-prototype` (don't strand it during the pause); start this arc on a **new branch off `main`** (`experiment/dramatic-recognition`). Phase 0's instrument is independent of A17 code, and the counterfactual-replay engine it needs is already on `main`. A17's lock-specific move grammar is only required at Phase 2, by which point A17 should be merged.

## 10. Single-paper landing

All results, the rubric, and the construct-validity controls land inside `docs/research/paper-full-2.0.md` (new §). No spin-off paper. The Poetics rubric is a *new instrument* — frozen + version-tagged before any scoring, never applied retroactively to historical rows (cross-version contamination).

## 11. Open decisions

1. **Sequencing — DECIDED 2026-05-19: Phase 0 first** (validate the *detector* on known material). It is the credibility gate and is token-light (fits the A17 token pause). A discrete "move grammar" is judged *unlikely to be cleanly specifiable* and is dropped as a prerequisite — the surprise measure operates in the semantic/continuation register instead (§5.1/§5.2).
2. **"Tragedy" scope confirmed formal** (peripeteia/anagnorisis), not thematic (catastrophe). Rubric is a typology of dramatic form with tragedy as the high pole.
3. **Calibration corpus composition — LARGELY DECIDED 2026-05-19.** Target ~12 normalised transcripts: **5 genuine-recognition** (high pole), **5 flat-exposition foils** (low pole), **2 simulation-trap** items (recognition-vocabulary without rupture, included in Phase 0 to harden the gate). High pole: *Meno* slave-boy (primary — a real teaching dialogue), *Oedipus* recognition (Aristotle's own peripeteia+anagnorisis example), *Euthyphro* aporetic close (recognition-of-ignorance; tests cathartic closure via fitting incompletion), *Theaetetus* definition-collapse, and a 5th = **Euripides** (*Iphigenia among the Taurians* recognition) **for now**. Flat pole: textbook Q&A ×2, catechism, FAQ/interview, procedural how-to. Simulation-trap items may be **constructed-and-clearly-labelled** where public-domain sourcing is thin (others sourced from public-domain translations — Jowett, Jebb, etc.). All items normalised into one neutral transcript schema (strip proper names + stage directions, relabel speakers) to blind the critic and to match the eventual LLM-transcript format.
   **Pre-registered gate:** perfect rank separation (every high item > every flat item; chance ≈0.4% at 5×5) AND mean(high)−mean(flat) ≥ 30 on the 0–100 scale; trap items must land ≤ mean(flat) (the `surprise_and_inevitability` guard works).
   **Note to revisit (user, 2026-05-19):** re-review the 5th high-pole slot against **Shakespeare and other cases** later. The deeper point the user raised: picking Euripides over Shakespeare does *not* dodge the thematic-vs-formal confound — **Euripides is "sad" too.** Thematic catastrophe is a cross-source property; the rubric scores *formal* tragedy (peripeteia/anagnorisis), so it is the **blinding + normalisation, not the source choice,** that must keep thematic sadness from leaking into the score. Build in an explicit thematic-control check (e.g. a "sad-but-flat" item, or confirm trap/flat items can carry affect without scoring high) when assembling the corpus.
