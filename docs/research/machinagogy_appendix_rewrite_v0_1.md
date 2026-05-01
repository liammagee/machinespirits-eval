# Rewrite package for the Machinagogy appendix

**Working title:** *From Recognition to Calibration: Mechanism Tracing in Recognition-Oriented AI Tutoring*  
**Prepared for:** Liam Magee  
**Purpose:** A first-pass rewrite package for the Claude-generated appendix/paper, designed to be handed to a future Claude or ChatGPT agent for further drafting, pruning, citation repair, and integration with the human-authored article.  
**Status:** Draft scaffold plus substantial prose. It is not yet a finished submission manuscript: references, table numbers, run IDs, and exact effect-size denominators should be checked against the current repository before final rendering.

---

## 0. Source basis and editorial stance

This rewrite is based on the current repository source rather than on the combined PDF alone. The key source anchors are:

- `docs/research/build-appendix.sh`: identifies `docs/research/paper-full-2.0.md` as the source used to build the appendix PDF and wrap it under the appendix title.
- `docs/research/paper-full-2.0.md`: current full mechanism paper source, versioned as a later April 2026 source, with a substantially updated mechanism framing.
- `docs/research/paper-short-2.0.md`: a much cleaner condensed version that is useful as the structural model for a rewrite.
- `config/tutor-agents.yaml`: current experimental-cell and pedagogical-orientation taxonomy, especially the recognition / matched-pedagogical / matched-behaviorist family framing.
- `prompts/tutor-ego-matched-pedagogical.md` and `prompts/tutor-ego-matched-behaviorist.md`: the most important prompt controls for reframing the active ingredient.
- `config/provable-discourse.yaml` and `config/paper-manifest.json`: claim-provenance and evaluation-count scaffolding.
- `TODO.md`: later experiment status, especially human-learner validation, domain expansion, Writing Pad ablation, capability-threshold results, and longitudinal findings.

The current appendix has become more interesting and more credible since the earlier combined PDF version, but also more sprawling. My rewrite keeps the best of the new caution while imposing a cleaner hierarchy:

1. **Main claim first:** the intervention changes tutor output quality in synthetic, LLM-judged settings.
2. **Mechanism claim second:** the strongest supported mechanism is prompt-level calibration, with architecture-level error correction acting as a partially substitutable second mechanism.
3. **Theoretical claim third:** Hegelian recognition remains valuable, but as the explicit philosophical grammar for a broader intersubjective-pedagogy orientation rather than as a uniquely load-bearing vocabulary.
4. **Null results are assets:** adaptive responsiveness, Writing Pad necessity, bidirectional cognitive prosthesis, and several architectural elaborations should be treated as boundary-defining findings, not embarrassment.
5. **Human outcomes remain unproven:** the paper should repeatedly distinguish “LLM-judged tutor-output quality” from “human learning.”

---

## 1. Recommended new paper shape

### Proposed title

**From Recognition to Calibration: Mechanism Tracing in Recognition-Oriented AI Tutoring**

Alternative title if you want to preserve the existing motif:

**Geist in the Tutor: Calibration, Error Correction, and the Limits of Recognition-Oriented AI Pedagogy**

### Proposed abstract

A companion pilot study found that recognition-enhanced prompts and multiagent architecture improve AI tutor-output quality in a synthetic evaluation setting. This paper asks what mechanisms produce those effects. We test three candidate mechanisms derived from recognition theory and multiagent critique architectures: **calibration**, where a prompt-level orientation narrows the distribution of tutor responses and raises the quality floor; **error correction**, where a separate superego critic catches failures in the tutor ego's draft; and **adaptive responsiveness**, where tutor quality improves across turns in response to learner-specific signals.

Across a 2 × 2 factorial crossing recognition-oriented prompting with tutor architecture, using three generation models and three independent LLM judges, two mechanisms are supported and one is not. Recognition-oriented prompting produces a large, replicated tutor-quality advantage and narrows within-response dimension variance, suggesting a calibration mechanism that operates from the first turn and does not require a superego. The superego architecture improves baseline tutor outputs, but its marginal contribution shrinks under recognition because recognition pre-empts many of the failures the superego would otherwise catch. This substitution pattern is stable across models, though weaker models retain more residual benefit from architectural error correction. By contrast, adaptive responsiveness is not supported in the primary multi-turn analysis: recognition raises the level of tutor quality but does not reliably change within-dialogue slopes.

Later controls sharpen the interpretation. A matched-specificity constructivist prompt grounded in Vygotsky, Piaget, Kapur, Chi, VanLehn, and Graesser reproduces the recognition effect without Hegelian vocabulary, while a matched-specificity behaviorist prompt performs substantially worse than the generic baseline. The active ingredient is therefore best described as an **intersubjective-pedagogy orientation**: a stance that treats the learner's interpretation as the material of instruction, asks diagnostic questions, preserves productive struggle, and repairs misalignment. Hegelian recognition remains theoretically useful because it names this orientation explicitly, but the observed mechanism does not depend on Hegelian terminology.

The paper contributes a process-tracing method for AI-agent evaluation: every ego-superego exchange is logged, revisions are compared, critique categories are analyzed, and major claims are linked to machine-checkable evidence. The findings are limited to synthetic learners and LLM judges. Whether calibrated recognition-oriented tutor output improves human learning remains the central next empirical question.

---

## 2. Proposed rewritten paper

# From Recognition to Calibration: Mechanism Tracing in Recognition-Oriented AI Tutoring

## 1. Introduction

AI tutors often reproduce a transmission model of education. The learner appears as a deficit to be diagnosed, the tutor appears as the holder of content, and success is measured by whether the correct content moves from one to the other. This model is serviceable for many narrow tasks, but it is pedagogically thin. It makes little room for the learner's interpretation, resistance, metaphor, confusion, or half-formed insight to shape the teaching act itself.

This paper examines a different design orientation. Rather than asking an AI tutor merely to deliver information, we ask whether a tutor can be prompted and architected to treat the learner's contribution as the material through which teaching must proceed. The theoretical entry point is Hegelian recognition: the learner should not be treated as a passive object but as an active subject whose understanding, even when wrong, has pedagogical reality. Yet the empirical question is deliberately narrower than the philosophical language might suggest. We do not test whether a machine can recognize a learner in Hegel's full sense. We test whether design heuristics drawn from recognition theory measurably change AI tutor behavior.

The companion pilot study established that recognition-enhanced prompting produces large improvements in synthetic tutor-output evaluations. But the pilot left open a harder question: **why does the intervention work?** Does recognition prompting improve quality because it induces a richer relational stance? Because it adds more instructions? Because it causes the tutor to ask more questions? Because the multiagent architecture catches errors? Or because LLM judges simply prefer the vocabulary of recognition?

This paper moves from effect detection to mechanism tracing. It evaluates three candidate mechanisms:

1. **Calibration:** recognition-oriented prompts constrain the tutor's response space, narrowing variance and raising the floor of tutor quality.
2. **Error correction:** an internal superego critic catches defects in the tutor ego's draft and induces substantive revision.
3. **Adaptive responsiveness:** recognition improves the tutor's ability to adapt across turns to the learner's particular signals.

The results support the first two mechanisms and reject the third as a general mechanism. Recognition works primarily as prompt-level calibration. The superego works as architectural error correction, especially under baseline prompting, but its value declines when recognition has already pre-empted the failures it would otherwise catch. The tutor becomes better from the first turn; it does not reliably become better faster over the dialogue.

This distinction matters. If recognition works by adaptive responsiveness, then the important design problem is long-horizon memory, learner modeling, and turn-by-turn sensitivity. If recognition works by calibration, then the important design problem is prompt orientation: the tutor must enter the interaction already disposed to treat the learner's contribution as consequential. If architecture works by error correction rather than by generating deeper internal drama, then the superego is less a Freudian depth structure than a practical quality filter.

A further result refines the theoretical claim. Later matched-specificity controls show that recognition's effect is reproduced by prompts grounded in constructivist learning-sciences traditions such as Vygotsky's zone of proximal development, Piagetian disequilibrium, Kapur's productive failure, Chi's ICAP framework, VanLehn's step-level scaffolding, and Graesser's affective tutoring. By contrast, a matched-specificity behaviorist / explicit-instruction prompt performs substantially worse than the generic baseline. The active ingredient is therefore not the word “recognition,” nor specifically Hegelian vocabulary. It is a broader intersubjective-pedagogy orientation, of which Hegelian recognition is the clearest philosophical articulation.

This paper's second contribution is methodological. Because the system is multiagent, its internal critique and revision process is observable. Each ego draft, superego critique, ego revision, and final tutor message can be logged and compared. This makes possible a form of process tracing for AI-agent systems: not simply asking whether the output improved, but following the chain from prompt orientation to internal critique to revision to judged output. The same logic is extended to the paper itself through a provable-discourse framework that connects major claims to data, code paths, run IDs, and validation rules.

The findings remain limited. The learners are synthetic. The judges are LLMs. The outcomes are tutor-output scores, not human learning gains. The contribution is therefore not a claim that recognition-oriented AI tutoring improves education in the wild. It is a more modest but useful claim: in a controlled synthetic setting, an intersubjective-pedagogy orientation produces traceable, replicated changes in tutor-output quality, and those changes operate primarily through calibration and error correction.

## 2. From recognition theory to design heuristic

Recognition theory begins from a relational premise: the self is not formed in isolation but through encounters with others who can acknowledge or misrecognize it. In Hegel's master-slave dialectic, asymmetrical recognition fails because the master's self-certainty depends on acknowledgment from someone not treated as a fully valid subject. Modern recognition theory extends this insight into social, political, and educational domains: misrecognition is not merely a private insult but a structural failure in how persons are constituted by social relations.

Pedagogy is one of the clearest sites where this matters. A learner who is treated merely as a container for missing knowledge may receive correct information, but the instruction does not necessarily engage the learner's own activity of sense-making. A learner who is recognized as a thinking subject is not simply affirmed. Their contribution is taken seriously enough to be questioned, extended, resisted, or transformed. Recognition in teaching is therefore not praise; it is the disciplined act of letting the learner's actual understanding shape what happens next.

This distinction is especially important for AI tutors. LLMs are prone to plausible helpfulness: they acknowledge, encourage, and redirect, often without letting the user's contribution alter the underlying pedagogical plan. A learner says something interesting; the tutor says “great point”; then it resumes its own explanation. This is not genuine pedagogical uptake. It is a rhetorical simulation of responsiveness.

The recognition prompt attempts to interrupt that pattern. It instructs the tutor to treat the learner's interpretation, resistance, and confusion as pedagogical data. The tutor should ask diagnostic questions, preserve productive struggle, and repair misalignment when it has failed to engage the learner's point. In operational terms, recognition becomes a design heuristic for tutor behavior: do not merely answer; engage the learner's current sense-making.

The Freudian architecture supplies a second design heuristic. In the ego-superego configuration, the tutor ego drafts a response, then an internal critic evaluates it before delivery. The critic is not a second tutor offering content. It is a quality-control agent that asks whether the draft is too generic, too directive, too flattering, too dismissive, or too quick to resolve the learner's struggle. The ego then revises.

The architecture is psychoanalytic only in a limited, functional sense. It does not require a claim that the AI has an unconscious, a conscience, or an inner life. It uses psychoanalytic vocabulary as a design metaphor for separating generation from critique. That separation makes the system inspectable: the researcher can observe not only what the tutor says, but what kind of failure the system thought it was correcting.

The central theoretical move of the rewrite should be to keep this distinction explicit:

- **Hegelian recognition** supplies the conceptual language for why learner uptake matters.
- **Constructivist and dialogic pedagogy** supply cognate operational forms of the same orientation.
- **Ego-superego architecture** supplies an inspectable error-correction loop.
- **The empirical paper tests output behavior**, not machine consciousness or human learning.

## 3. System and evaluation design

The evaluation crosses two main design factors: prompt orientation and tutor architecture.

The prompt factor compares baseline tutoring with recognition-oriented tutoring. Later controls extend this comparison to matched-specificity constructivist and behaviorist prompts. The architecture factor compares a single-agent tutor with a multiagent tutor in which the ego drafts and the superego critiques before final output. The resulting design allows the mechanisms to be separated: single-agent recognition tests calibration without live critique; multiagent baseline tests error correction without recognition; multiagent recognition tests whether the two mechanisms add, substitute, or interact.

The mechanism study uses three generation models selected to span a capability range and three independent LLM judges. This matters because both tutor generation and tutor evaluation are model-sensitive. A mechanism that appears under one generator or one judge may be a model artifact. The paper should therefore report effect directions by judge and generator wherever possible, not merely pooled magnitudes.

Each dialogue produces process traces. A trace includes the learner context, ego draft, superego critique where applicable, ego revision, final tutor response, and judge scores. These traces permit three kinds of analysis:

1. **Distributional analysis:** Does recognition narrow dimension variance and raise weak dimensions?
2. **Revision analysis:** What does the superego criticize, and how much does the ego revise after critique?
3. **Trajectory analysis:** Do tutor scores improve more steeply across turns under recognition or multiagent architecture?

The rubric should be described as a corrected and literature-informed instrument rather than as an original ground truth. The earlier rubric was iteratively generated and useful but too entangled with the LLM's own implicit model of good tutoring. The revised rubric draws on existing tutoring, dialogic teaching, and learning-sciences frameworks. Even so, its scores remain LLM-judge scores. The paper should therefore use phrases such as “judge-rated tutor-output quality” rather than simply “tutor quality,” except where readability requires shorthand.

## 4. Mechanism 1: calibration

Calibration is the strongest supported mechanism. Recognition-oriented prompting improves tutor output by constraining the range of possible responses. It does not merely produce occasional excellent turns; it raises the floor. Weak dimensions improve most, already-strong dimensions move less, and the tutor's score profile becomes more even.

The crucial evidence is that calibration appears without the superego. If a single-agent recognition tutor shows the same floor-lifting and variance-narrowing pattern as a multiagent recognition tutor, then the mechanism cannot depend on internal critique. It must operate at the prompt level. Recognition changes the tutor's starting disposition.

Behaviorally, this appears as a shift from prescription to inquiry. Baseline tutors often diagnose and direct: “review this lecture,” “revisit that concept,” “try this activity.” Recognition-oriented tutors more often ask what the learner means, name the conceptual move the learner is making, and suggest a next step that follows from the learner's own contribution. In mediation terms, question-asking explains a substantial part of the first-turn recognition effect, but it should not be treated as the whole mechanism. Questions are a surface marker of a deeper stance: the tutor is making room for the learner's interpretation to matter.

The rewrite should emphasize that calibration is not simply “more warmth” or “more words.” The matched-control evidence weakens the prompt-length explanation. Generic elaboration can help weak models, harm stronger models, or fail to reproduce recognition. What matters is not density alone but the orientation of the prompt: whether it constrains the tutor to work from the learner's own sense-making.

**Recommended claim wording:**

> Recognition-oriented prompting operates primarily as calibration. It narrows the response distribution, raises weak dimensions, and changes the first-turn stance of the tutor. The effect is present without a superego, flat across turns, and replicated across judges and generators. It should therefore be treated as a prompt-level mechanism rather than as an emergent dialogue property.

## 5. Mechanism 2: error correction

The superego architecture also works, but not in the way the original theoretical framing most strongly suggested. It does not reliably add a second, deeper layer of dialogical development on top of recognition. Instead, it catches failures in baseline outputs that recognition prompting often prevents in advance.

This produces a substitution pattern. Under baseline conditions, the superego has useful work to do. It can flag vague scaffolding, insufficient learner uptake, overdirection, affective neglect, or content drift. The ego then revises, often substantially. Under recognition, many of these failures are less frequent in the ego's first draft. The superego approves more often, critiques less deeply, and has less marginal value. The product is better, but the internal drama is thinner.

This is not a failure of the architecture. It is evidence for the division of labor between the two mechanisms. Calibration prevents predictable failures. Error correction catches remaining failures. When calibration succeeds, error correction becomes less visible.

The architecture's residual value is model-dependent. Stronger models can often implement the recognition prompt well enough that the superego adds little under recognition. Weaker models may still benefit from critique because they leave more errors after calibration. This suggests a practical design rule: do not assume multiagent architecture is always worth the cost. Use it where the base generator leaves enough correctable error headroom.

The rewrite should also make clear what the superego does not do. It does not prove the Freudian model as a psychological model of AI. It does not produce robust adaptive responsiveness across turns. It does not rescue every weak ego model. And later bidirectional-profiling / cognitive-prosthesis tests indicate that some architectural elaborations can be neutral or harmful.

**Recommended claim wording:**

> The superego functions as architectural error correction. Its value is largest when the ego's initial output contains correctable failures. Recognition reduces those failures in advance, so the two mechanisms partially substitute rather than simply add. Multiagent tutoring should therefore be treated as a targeted quality-control intervention, not as a general guarantee of richer dialogue.

## 6. Mechanism 3: adaptive responsiveness

Adaptive responsiveness was the most theoretically attractive mechanism but is not supported as a general finding. Recognition theory naturally suggests a temporal story: the tutor recognizes the learner, the learner responds, the tutor adapts, and the dialogue becomes increasingly attuned. The data do not support this as a robust mechanism in the current synthetic setting.

The primary multi-turn analysis shows that recognition raises tutor-output levels but does not reliably change within-dialogue slopes. Baseline and recognition tutors both adapt to learner signals, but they do so at similar rates. Recognition starts higher; it does not reliably climb faster.

An exploratory 10-turn disengagement result initially suggested a possible boundary condition, but later replication failed across additional models and judges. This should be reported as a useful negative result. The rewrite should avoid burying it in a caveat, because it helps prevent overclaiming. The mechanism model becomes stronger when the null is explicit: recognition is a first-turn / prompt-orientation effect plus error-correction interaction, not a demonstrated within-dialogue learning dynamic.

**Recommended claim wording:**

> Adaptive responsiveness remains descriptively present but experimentally unmodulated. Tutors in all conditions respond somewhat to learner signals, but recognition does not reliably steepen the trajectory of improvement. The current evidence supports level-setting calibration, not emergent within-dialogue adaptation.

## 7. Tutor-learner asymmetry

The tutor-learner asymmetry is not a side issue; it follows from the mechanism model. Calibration changes what the tutor produces. Error correction changes what the tutor outputs. Neither directly changes what the learner is capable of receiving, understanding, or doing, especially when the learner is synthetic and the dialogue is short.

On stronger generation models, recognition produces large tutor-side effects and small learner-side effects. This does not mean the tutor effect is fake. It means the supported mechanisms operate on tutor production. The learner's behavior is governed by its own prompt, architecture, and model constraints.

The weaker-model result is important because it complicates this pattern. When baseline tutor output is poor enough, recognition can improve learner-side engagement because the learner finally has something usable to respond to. In this sense, learner effects may appear only below a tutor-quality threshold. If baseline tutoring is already adequate, learner simulations may show little additional gain. If baseline tutoring collapses, recognition can rescue the interaction enough for learner engagement to improve.

This should be framed as a hypothesis for human validation, not as a conclusion about human learning.

**Recommended claim wording:**

> The tutor-learner asymmetry is a structural implication of the supported mechanisms. Calibration and error correction act on tutor production. Learner-side effects require a further reception pathway, which appears only weakly in strong-model synthetic settings and more clearly when weak baseline tutor output otherwise deprives the learner of usable material.

## 8. Orientation-family control: what “recognition” really names

The most important later revision is the matched-specificity orientation-family result. It changes the theoretical center of gravity.

The original framing risks suggesting that Hegelian recognition vocabulary itself is responsible for the effect. The newer controls show otherwise. A prompt grounded in constructivist and learning-sciences traditions can reproduce the recognition effect while avoiding Hegelian vocabulary. A behaviorist prompt, also detailed and theory-rich, performs substantially worse than the generic baseline. This rules out a simple “more theory,” “more specificity,” or “more named scholars” explanation.

The active ingredient is better described as an intersubjective-pedagogy orientation. This family includes recognition theory, Vygotskian scaffolding, Piagetian disequilibrium, productive failure, dialogic teaching, and related frameworks in which the learner is treated as an active interpreter. These traditions differ in vocabulary and philosophical ancestry, but they share a practical stance: teaching must proceed through the learner's current understanding, not around it.

The rewrite should be careful not to make this sound like a demotion of Hegel. Recognition theory remains valuable because it names the relational stakes most explicitly. The empirical result says that Hegelian vocabulary is not necessary for the output effect. It does not say recognition theory is irrelevant. Rather, it indicates that recognition theory is one explicit philosophical articulation of a broader orientation that its pedagogical descendants carry in more operational language.

The lexicon analysis strengthens this interpretation. If Hegelian vocabulary is present in recognition outputs but absent from matched-pedagogical outputs, while both score similarly, then Hegelian terms are markers of the prompt family rather than mediators of the effect. Likewise, constructivist vocabulary alone is not the whole mediator. The mechanism likely lives at the level of discourse structure: questions over assertions, learner uptake before prescription, repair of misalignment, and preservation of productive struggle.

**Recommended claim wording:**

> Recognition theory is best understood as the explicit philosophical grammar of an intersubjective-pedagogy orientation. The empirical mechanism does not require Hegelian vocabulary. It requires a tutor stance in which learner interpretation is treated as instructionally consequential.

## 9. Apparatus as method

The evaluation apparatus should remain a major contribution, but it needs a cleaner placement. In the current appendix, method, audit infrastructure, reflexive AI scholarship, and experiment results sometimes compete for the main thread. The rewrite should give the apparatus one focused section and move implementation detail to supplements.

The core methodological point is strong: multiagent systems make internal process observable. If the ego drafts, the superego critiques, and the ego revises, the researcher can inspect what changed and why. This allows mechanism claims to be tested inside the case, not merely inferred from across-condition score differences.

The provable-discourse framework extends the same principle to the paper. Claims are not just written; they are registered, linked to data, and checked for staleness or contradiction. This is especially important because the project itself was produced through AI-assisted research. A paper partly written by an AI system needs an infrastructure that treats claims as inspectable outputs rather than prose to be trusted.

The rewrite should frame this as **vibe plus validation**, not as a replacement for ordinary research discipline. The human-authored article already moves in this direction. The appendix can reinforce it: fast AI-assisted exploration is useful, but only when followed by adversarial checking, provenance, bug audits, versioned rubrics, rejudging, and human validation where the construct requires it.

**Recommended claim wording:**

> The apparatus is not merely support infrastructure. It is the methodological answer to the risks of AI-assisted research. The same error-correction logic tested in the tutor architecture is applied to the paper's own claims: generate, critique, revise, validate, and keep the evidence chain inspectable.

## 10. Limitations

The limitations section should be shorter, harsher, and more prominently connected to claims.

### 10.1 Synthetic learners

The most important limitation is that no human learner has yet learned from these tutors in the reported mechanism experiments. Synthetic learners are useful for controlled mechanism tracing because they are reproducible and cheap, but they cannot establish educational effectiveness. They may underreact, overreact, or react in ways that reflect the same LLM priors used by the tutor and judge.

### 10.2 LLM judges

The evaluation depends on LLM judges. Cross-judge replication improves confidence in effect direction, but it does not create human ground truth. LLM judges may share preferences for certain discourse styles, especially explicit scaffolding, question-asking, warmth, and dialogic phrasing. Human expert coding and human learner studies remain necessary.

### 10.3 Prompt density and prompt content

Matched controls reduce but do not eliminate the density confound. Recognition, constructivist, and behaviorist prompts differ not only in orientation but also in language, examples, constraints, and task decomposition. The orientation-family result is stronger than the original recognition-vs-base comparison, but it remains a prompt-level intervention, not a pure philosophical isolation.

### 10.4 Model transience

All model-specific claims are temporary. Model APIs change, judge behavior shifts, and capability tiers move. The paper should report exact model versions and dates wherever possible, and the strongest claims should be phrased as findings within the tested capability range.

### 10.5 Process-trace validity

Superego critique categories and revision-quality labels are themselves partly machine-coded. This is acceptable for exploratory mechanism work but requires human coding for publication-grade construct validity. The human-coding codebook and sampling scripts are therefore not ancillary; they are part of the next validation step.

### 10.6 Human learning outcomes

The central educational question remains unanswered: do recognition-calibrated tutors improve learning, transfer, persistence, self-efficacy, or conceptual change for human learners? The existing pilot infrastructure appears to make this tractable, but until those data exist, the paper should avoid saying “improves learning” except when clearly referring to synthetic proxies.

## 11. Conclusion

Recognition-oriented AI tutoring works in the present evaluation, but not quite for the reasons the original theory most temptingly suggested. The strongest mechanism is not emergent mutual recognition unfolding across a dialogue. It is prompt-level calibration: the tutor begins from a better stance. The second mechanism is not deep psychic interiority. It is architectural error correction: a critic catches failures that the generator did not avoid. These mechanisms interact through substitution. When recognition has already calibrated the ego, the superego has less to correct.

The finding does not reduce recognition theory to prompt engineering. It clarifies what recognition contributes as a design language. Recognition names a pedagogical orientation in which the learner's interpretation is treated as real material for instruction. Later controls show that this orientation can be operationalized through Hegelian recognition vocabulary or through cognate constructivist learning-sciences vocabulary. What fails is not theory but the attempt to identify the active ingredient with one vocabulary alone.

The methodological lesson is equally important. AI-assisted research can move quickly enough to generate plausible results before the researcher has fully understood the apparatus producing them. The answer is not to abandon such exploration but to surround it with traceability, adversarial checking, replicated judging, bug audits, human coding, and eventually human learner validation. In this respect, the appendix's apparatus becomes part of its argument: reliable AI research requires building a superego for the research process itself.

---

## 3. What to move out of the main paper

The current appendix should become a tighter paper plus supplements. The main paper should keep only results that support the central mechanism model.

### Keep in the main text

- Recognition / intersubjective-pedagogy framing.
- Three candidate mechanisms.
- Core 2 × 2 mechanism design.
- Three generation models and three judges.
- Calibration result.
- Error-correction / substitution result.
- Adaptive-responsiveness null.
- Tutor-learner asymmetry.
- Orientation-family control.
- Apparatus-as-method summary.
- Short limitations and next steps.

### Move to supplements

- Full cell registry and run IDs.
- Full prompt texts.
- Rubric derivation details.
- Claim-ledger adapter taxonomy.
- Full critique-category taxonomy and examples.
- Revision-distance tables.
- All per-judge/per-model tables.
- Domain expansion results.
- Writing Pad ablation.
- Capability-threshold / prosthesis failures.
- Longitudinal Writing Pad experiments.
- Id-director / charisma rubric experiments.
- Human-coding packet details.
- Reproduction commands.

### Possibly remove from this paper entirely

The id-director / charisma material is interesting but belongs in another paper or a late exploratory supplement. It changes the construct from tutoring quality to charisma / register / persona shaping. Including it in the main paper risks making the mechanism story look unfocused.

---

## 4. What the human-authored article proper should revise

The human-authored article should be updated in light of the newer appendix/source state. These are the main revisions I would make.

### 4.1 Update the article abstract

The article abstract should no longer summarize the appendix simply as showing “recognition-enhanced prompts produce large model-independent improvements” plus multiagent architecture. A better summary is:

> The companion paper finds that an intersubjective-pedagogy orientation, first operationalized through Hegelian recognition prompts, improves synthetic LLM-judged tutor-output quality primarily through prompt-level calibration. A multiagent ego-superego architecture contributes as an error-correction mechanism, especially under baseline prompting, but partially substitutes for rather than synergizes with recognition. The strongest newer control indicates that Hegelian vocabulary is not itself load-bearing: matched constructivist prompts reproduce the effect, while matched behaviorist prompts perform worse than the generic baseline.

### 4.2 Revise the “Hegel + Freud” empirical claim

The article currently has a strong conceptual symmetry: Hegel supplies the intersubjective mechanism, Freud supplies the intrasubjective mechanism. The newer results weaken this symmetry. The empirical revision should say:

- Hegelian recognition remains an excellent theoretical frame, but the active prompt effect generalizes to a broader intersubjective-pedagogy family.
- The Freudian superego frame remains useful architecturally, but empirically it behaves as quality-control/error-correction more than as deep psychic modulation.
- The two mechanisms do not form a clean additive synthesis. They partially substitute.

### 4.3 Replace “dialogical modulation” with “calibration” unless discussing theory

The article's language about dynamic relationality, dialogue, and modulation should be softened when referring to empirical findings. The appendix now supports:

- calibrated first-turn stance;
- floor-lifting;
- question-asking and learner-uptake markers;
- error correction;
- model-dependent residual architecture benefit.

It does **not** support robust within-dialogue adaptive responsiveness.

### 4.4 Treat “vibe scholarship” as “vibe + validation”

The article's strongest methodological contribution is not that AI enables fast solo scholarship. It is that AI enables fast hypothesis generation only when paired with validation machinery. The narrative should highlight the bugs, revisions, provenance apparatus, cross-judge checks, and human validation gap as the real lesson.

Suggested revision:

> The experiment began as vibe scholarship but became defensible only when it turned against its own vibe: claims were tied to run IDs, rubrics were rebuilt from literature, judges were multiplied, bugs were audited, and surprising effects were re-tested until several attractive mechanisms collapsed.

### 4.5 Update the article's account of later changes

The article should mention that important changes occurred after the original draft:

- adaptive responsiveness became a clean null rather than a supported third mechanism;
- matched-pedagogical controls reframed the active ingredient as intersubjective-pedagogy orientation;
- Writing Pad necessity was rejected;
- bidirectional profiling / cognitive prosthesis was not supported;
- domain expansion appears directionally strong but should remain secondary until matched-mode and human validation;
- longitudinal Writing Pad results complicate the “more recognition moments is better” hypothesis by suggesting pre-alignment can reduce internal conflict while improving scores.

### 4.6 Tighten “nonconscious recognition”

The speculative section on nonconscious recognition is worth keeping, but it should be more clearly separated from the empirical claims. The empirical paper does not show machine recognition in a philosophical sense. It shows that a machine can be instructed to produce outputs that human or LLM judges score as better aligned with recognition-like pedagogy. The human phenomenology of being recognized by AI is a different question and should be framed as such.

### 4.7 Re-check current-model and current-paper references

Because the article discusses specific model names, dates, and AI safety papers, the final version should verify all current references before submission. The repository's paper source is already using later model labels and judge labels than the PDF narrative, so the article should not freeze an older model chronology.

---

## 5. Handoff instructions for a future Claude or ChatGPT agent

Use this section as direct instructions if feeding the file to a future writing agent.

### Task

Rewrite the appendix paper into a concise, publication-facing Markdown manuscript of roughly 8,000-11,000 words, with supplements separated. Preserve empirical caution. Do not invent new results.

### Required source files to inspect first

1. `docs/research/paper-full-2.0.md`
2. `docs/research/paper-short-2.0.md`
3. `docs/research/build-appendix.sh`
4. `config/tutor-agents.yaml`
5. `config/provable-discourse.yaml`
6. `config/paper-manifest.json`
7. `prompts/tutor-ego-recognition.md`
8. `prompts/tutor-ego-matched-pedagogical.md`
9. `prompts/tutor-ego-matched-behaviorist.md`
10. Current exports for A10/A10b, A5, A6, A7, A12, and human-coding reliability if present.

### Do not overclaim

- Do not say the system achieves Hegelian recognition.
- Do not say the system improves human learning unless human-learner data have been collected and analyzed.
- Do not say adaptive responsiveness is supported as a general mechanism.
- Do not say the Writing Pad is necessary for recognition.
- Do not say bidirectional profiling rescues weak models.
- Do not treat Hegelian vocabulary as the mediator of the effect.
- Do not collapse LLM-judge scores into human educational outcomes.

### Preferred claim hierarchy

1. Intersubjective-pedagogy prompts improve synthetic judge-rated tutor-output quality.
2. The primary mechanism is calibration: floor-lifting and variance narrowing.
3. The secondary mechanism is architecture-level error correction.
4. The two mechanisms partially substitute.
5. Adaptive responsiveness is not supported in the primary analysis.
6. Hegelian recognition is the explicit philosophical grammar of the effective orientation, not the unique operational vocabulary.
7. Human learning validation is the next decisive step.

### Style guidance

- Lead with what the paper actually tests before invoking Hegel or Freud.
- Use “recognition-oriented” or “intersubjective-pedagogy” when describing the operational prompt family.
- Use “Hegelian recognition” when discussing the theoretical source.
- Use “superego critic” as a design label, but avoid implying real psychic structure.
- Prefer “LLM-judged tutor-output quality” to “learning quality.”
- Keep tables few and high-value in the main text.
- Move run IDs and exact reproduction commands to supplements.

### Main-paper outline for the future agent

1. Abstract
2. Introduction: from information transfer to intersubjective-pedagogy orientation
3. Theoretical translation: recognition and superego as design heuristics
4. System and methods: 2 × 2 design, models, judges, rubric, process tracing
5. Results I: calibration
6. Results II: error correction and substitution
7. Results III: adaptive-responsiveness null
8. Results IV: orientation-family control
9. Apparatus as method: provable discourse and AI-assisted research validation
10. Limitations
11. Conclusion

### Supplement outline

- Supplement A: full experimental-cell registry
- Supplement B: prompts and prompt-length controls
- Supplement C: model/judge tables and reliability
- Supplement D: critique taxonomy and revision analysis
- Supplement E: claim-ledger / provable-discourse infrastructure
- Supplement F: negative and exploratory extensions
- Supplement G: human-validation materials
- Supplement H: reproduction instructions

---

## 6. Open questions to resolve before final submission

1. **Canonical N values:** reconcile N=432, N=453, and 1,296 scored rows in the main narrative. Define exactly what each denominator refers to: dialogues, scored rows, judge-expanded rows, or filtered analysis rows.
2. **Versioning:** decide whether the appendix paper should be called Paper 2.0, version 3.x, or simply the companion mechanism paper.
3. **A10/A10b placement:** decide whether the orientation-family result belongs in the main results or as a discussion-shaping control. My recommendation: keep it in the main text because it changes the interpretation of “recognition.”
4. **A6 domain expansion:** include as a brief generalizability note or supplement, not central mechanism evidence.
5. **A7 longitudinal results:** include only if the final paper wants to discuss memory / Writing Pad. Otherwise, place in future-work or supplement because it shifts the paper toward long-term state accumulation.
6. **Human coding:** if human-coding reliability data exist, include them. If not, state that the coding apparatus is ready but the validation is pending.
7. **Human learner pilot:** if pilot data exist by revision time, the paper changes substantially. If not, keep it as the decisive next step.
8. **Id-director / charisma:** move out unless a separate architectural-extension paper is intended.

---

## 7. One-paragraph executive rewrite for the article proper

The appendix should now be described less as a proof that Hegelian recognition and Freudian multiagent architecture improve AI tutoring, and more as a staged correction of that initial claim. Its strongest finding is that prompts drawn from recognition theory produce a robust calibration effect: they raise the floor of synthetic, LLM-judged tutor-output quality by making the tutor engage the learner's interpretation rather than merely prescribe content. The ego-superego architecture contributes as an error-correction loop, especially when baseline outputs contain correctable failures, but its contribution partly substitutes for recognition rather than adding a separate psychic depth. A further matched-control result reframes the active ingredient as an intersubjective-pedagogy orientation shared by Hegelian recognition and constructivist learning-sciences traditions, not as Hegelian vocabulary itself. The paper is therefore strongest when read not as a claim about machine recognition in the philosophical sense, but as a mechanism-tracing study of how theoretically informed prompt orientations and critique architectures alter AI tutor output under synthetic evaluation.
