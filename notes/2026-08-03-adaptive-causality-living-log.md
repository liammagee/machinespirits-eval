# Adaptive causality: living assessment and results log

**Recorded:** 2026-08-03

**Status:** Living research note. This is an assessment of the evidence boundary,
not a production-readiness claim. Add future lessons and results as new dated
entries under **Append-only lessons and results log**; do not rewrite earlier
entries to fit later findings.

## Executive assessment

Machine Spirits Eval is a mature adaptive-tutor research workbench. Its strongest
features are engineering quality, detailed traces and provenance, explicit
representations of learner state and pedagogical action, usable experimental
interfaces, and gates that can reject as well as support a claim.

Its maturity differs by question:

- **Late-stage as an experimental platform:** the repository can define, run,
  trace, ablate, compare, and audit increasingly precise tutor mechanisms.
- **Mid-stage as a causal adaptive system:** genuine mechanism-local effects and
  useful failure localization are visible, but a generally effective routing
  policy has not been established.
- **Early-stage as evidence of improved human learning:** the current results do
  not show that people learn more because of the adaptive policy.

The remaining evidence chain is: validate learner-state recognition across worlds;
establish causal transition effects for a small repertoire of teaching moves;
optimize a routing policy over those validated state-action effects; then conduct
guarded human validation.

## Minimal causal loop

Adaptation minimally requires four linked operations:

1. Observe a learner state with enough validity to act on it.
2. Choose between teaching actions whose effects are expected to differ by state.
3. Measure the learner's subsequent change, preferably on a new task rather than
   only in the immediate dialogue.
4. Update the future action choice from that evidence.

The project is strongest on observation, state representation, instrumentation,
safeguards, and explanations of what the system did. The weaker link is proving
that a chosen action caused a better learner transition than available
alternatives. Instrumentation can make adaptation visible without making it
effective.

A null result can mean several different things: the learner or world was already
at ceiling; the dialogue contained no meaningful failure and recovery; the outcome
was insensitive to the intended change; or experimental instrumentation displaced
the tutor's native behaviour. Distinguishing these cases is part of the project's
innovation. The important separation is between adaptation that merely appears in
state, trace, or rhetoric and adaptation that causally improves a learner
transition.

## Verified recent evidence

The following findings were established in merged PRs #434, #437, #439–#445,
and #447. They are evidence about bounded mechanisms, not a single
end-to-end adaptive-policy victory.

- Advisory blocks were ablated one at a time, alongside length and generic-plan
  controls, and assessed with both plan-aware and blind judging. This separated
  content, dose, and judge-disclosure effects more carefully than a whole-prompt
  comparison.
- A one-clause world minimal pair produced the first non-closure among fifteen
  dialogues. The result showed that a small world change could create a
  consequential failure rather than another saturated success case.
- A preregistered temperament card failed. Move cards passed their weakest gate at
  15/29, reached 63% on card-covered planted moments, produced 3/3 closures, and
  delivered no leaks. The result is explicitly limited by small `k`, one
  world/persona, and simulated learners.
- Replication in a second world/persona passed four gates. A second tagger confirmed
  88% of the first tagger's hits. Typed quiet-state detection passed 14/18 and held
  22/30 at `k=5`; transfer to a longer world did not come for free.
- Live detection fired 3/3 while delivery remained 0/3. That contrast located one
  failure in generation rather than sensing.
- Frozen ablation localized move suppression to the standing evidence contract. An
  in-contract exception released the move 6/6 in frozen replay but not live, where
  wagers remained 0/9. The mechanism therefore depends on context and channel, not
  only on whether the relevant words are present.
- Learner profiles were recovered at 88% leave-one-out by turn 6, with the stated
  persona-plus-world confound. Repeated demands elicited the right repair 3/4 times,
  suggesting that dialogue history may license a move that a first demand does not.
- Dose, reading order, model family, and composer interference were isolated as
  distinct levers rather than collapsed into a generic prompting effect.
- The v5 detector passed in-sample but failed leave-one-out. A v6 cascade improved
  held-out detection to 84/162 from 68/162 at equal calm alarms. The full-stack gain
  was modest: 10/15 versus 8/15.
- An Opus family check yielded control 0/6, in-contract exception 6/6, and bare
  frame 5/6. This identifies a model-conditional routing candidate, not a validated
  routing policy.

Overall, genuine mechanism-local causal success is now visible, especially in
failure localization, minimal pairs, replication, and claim gates that rule both
ways. It is not yet proof of a generally effective adaptive policy or of human
learning gains.

## Limits and claim boundary

The strongest results remain local to particular worlds, personas, prompts,
contracts, positions in context, model families, and simulated learners. Detection
and delivery can separate; frozen replay and live generation can separate; and a
component gain can shrink substantially in the full stack. Small samples make
precise effect sizes unstable. Judge disclosure and judge family can alter what is
visible to an evaluation instrument. No result here licenses claims of production
routing, broad learner-state validity, or improved human learning.

## Decisive next experiment

Run a minimal two-state/two-action crossed-effects experiment before enlarging the
repertoire.

- Define two learner states that can be planted reproducibly in at least two worlds
  and detected blind to the action assignment.
- Define two materially different teaching actions, each with a clear hypothesized
  advantage in one state.
- Use a fallible simulated learner so failure and recovery are possible, then
  randomize the action within each state.
- Measure the next learner transition and transfer on a new task, not only surface
  compliance or immediate dialogue closure.
- Compare fixed-action policies, a random policy, the learned router, and an oracle
  that receives the planted state.
- Require the crossed interaction: action A should outperform B in one state and B
  should outperform A in the other, with sensing, delivery, and outcome reported
  separately.

If state recognition fails across worlds, improve the state instrument. If the
crossed action effect fails under known planted state, improve or replace the move
repertoire. Only after both pass should routing optimization begin. A guarded human
study belongs after that chain, with consent, transfer outcomes, and conservative
stopping rules.

## Append-only lessons and results log

### 2026-08-03 — Baseline assessment

- The platform is substantially more mature than the causal and human-learning
  claims it can currently support.
- The recent sequence has crossed an important threshold: failures are increasingly
  localized to sensing, contract, generation, composition, or evaluation rather
  than described as undifferentiated prompt failure.
- Minimal pairs, preregistered gates, held-out tests, replication, and negative
  results are producing a credible causal map of the machinery.
- The next decisive unit is not another large prompt stack. It is a small crossed
  state-action experiment with randomized actions and transfer measurement.

### 2026-08-03 — Model-family capability and casting assessment

The evidence supports a capability profile, not a global model-family ranking.
Family changes the available repertoire, response to dose, sensitivity to prompt
contracts, and the taste of judge instruments.

**Speaking-model profile.** Codex-family speaking models appear strong at
controlled analysis, proof and evidence discipline, and stable default tutoring.
They appear weaker at spontaneous defiance and at producing the complete
conditional-wager move. In the planted-stress work, Codex drafted zero defiance
under the attempted prompting. An in-contract exception consistently released
three of the four component beats, but the full conditional move appeared only
1/6. The structural suppression and bridge-release pattern replicated: changing
the contract can release parts of the move, but complete live performance appears
less naturally available to this family.

Claude/Opus-family speaking models showed a richer native dramatic or
confrontational repertoire. Above the smallest Claude tier, defiance appeared
natively. In the frozen Opus family check, control produced the full conditional
wager 0/6, the in-contract exception 6/6, and a bare scene frame 5/6. Opus in the
speaking seat at first-demand moments is therefore a plausible routing candidate.
The sample is too small and too bounded to justify automatic routing.

**Shared structure and meaningful difference.** Both families remain subject to
the same important constraints: the standing evidence contract can suppress the
desired move; placement in context matters; frozen replay does not guarantee live
delivery; and stake-like moves are cheaper than wager-like moves. Phase P found
wager dose expensive for both families, with the preferred reading order inverted
between them. The cross-family replication matters because the degree changes
while the structure holds. It supports conditional casting by teaching move rather
than selecting one family to run the whole tutor.

**Judge-family profile.** Judge models also have family-specific taste. On
identical radical-character-shift pairs, a Claude judge preferred the shifted arm
9/21 times while a Codex-family judge did so 6/21 times; both still leaned toward
the bare tutor. Naming learner state improved gold alignment for both Sol and
Sonnet judges, but by different amounts. Judge family must therefore be treated as
an instrument factor rather than ground truth.

**Current practical profile.** Use the Codex family as the leading candidate for
disciplined analytic and proof-sensitive moves and for stable default turns. Test
Opus/Claude for high-stakes confrontation, commitment, wagers, and characterful
register shifts. Route with an explicit, auditable handoff at identified moments
rather than switching models mid-dialogue by intuition. Keep judge families
crossed or blinded.

**Limits.** These findings come from tiny frozen samples, simulated learners, and
different prompts and contexts. They retain house-style confounds, establish no
human-learning outcome, and do not show that frozen capacity will survive the live
composer. No move currently meets the repository's own bar for production
routing.

The emerging result is a credible per-move casting sheet. Its central innovation
is model-conditional pedagogy: models are not simply better or worse; particular
teaching acts are differently available under particular contracts. This is a
promising and increasingly replicated routing hypothesis, not a deployed adaptive
policy.

### 2026-08-03 — External convergence: model personality as alignment-shaped disposition

External literature supports interpreting the observed Codex/Claude differences
as behavioural fingerprints or alignment-shaped dispositions, not as a simple
technical-capability ranking.

- [Pei et al. (2025), *Behavioral Fingerprinting of Large Language Models*](https://arxiv.org/abs/2509.04504)
  reports increasing convergence among frontier models in abstract and causal
  reasoning while sycophancy, semantic robustness, and interactive style diverge
  sharply across developers. The authors attribute much of that divergence to
  variable alignment strategies. Their personality labels are descriptive
  analogues rather than clinical diagnoses, and their evaluator is itself an LLM.
- Anthropic's 2025 [*Stress-testing model specs reveals character differences
  among language models*](https://alignment.anthropic.com/2025/stress-testing-model-specs/)
  used more than 300,000 value-tradeoff scenarios across twelve frontier models
  and found meaningful pairwise behavioural differences in more than 220,000.
  Provider-level clusters included Claude more often emphasizing ethical
  responsibility and intellectual integrity/objectivity, and OpenAI models more
  often emphasizing efficiency and resource optimization. These are value
  tradeoffs, not measurements of pedagogy.
- OpenAI's [GPT-5-Codex system-card addendum](https://openai.com/index/gpt-5-system-card-addendum-gpt-5-codex/)
  says the model was explicitly optimized to mirror human style and pull-request
  preferences, follow instructions precisely, and iterate tests until they pass.
  That is consistent with the repository's observation of strong contract
  discipline. It does not independently establish over-adherence or weak
  pedagogical confrontation.
- Anthropic's [*Persona Selection Model*](https://alignment.anthropic.com/2026/psm/)
  proposes that post-training may reuse persona simulation learned in pre-training
  as an “agentic backend.” Role and context can therefore select different
  behavioural repertoires. This maps closely to the repository's seat, register,
  licence, and contract findings, but remains a theoretical model rather than a
  settled mechanism.
- [*Claude's Constitution*](https://www-cdn.anthropic.com/f83650a21e480136866a3f504deb76e346f689d4/claudes-constitution.pdf)
  explicitly describes a rules-versus-judgment tradeoff: rules improve
  predictability, transparency, and evaluability, but rigid compliance can produce
  poor outcomes when a rule no longer serves its goal. This strongly parallels the
  local finding that a standing evidence contract can suppress a useful teaching
  move.
- External LLM-judge work reinforces the judge-family caution. [Pombal et al.
  (2026), *Self-Preference Bias in Rubric-Based Evaluation of Large Language
  Models*](https://arxiv.org/abs/2604.06996) finds that self- and family-preference
  persists even with objectively checkable rubrics and can materially distort
  scores. [Soumik (2026), *Judging the Judges*](https://arxiv.org/abs/2604.23178)
  finds that style bias dominates position bias across several provider families
  and that debiasing effects depend on the judge model.

There is apparent counterevidence. Anthropic's stress-test comparison finds Claude
models more cautious and refusal-prone, which can seem inconsistent with a richer
confrontational repertoire. The axes need not conflict: cautious safety behaviour
and forceful, licensed pedagogical role-play are different. The repository's result
concerns repertoire under a legitimate teaching frame, not willingness to violate
safety constraints.

What remains locally novel and externally unconfirmed is the specific per-move
profile: Codex as proof- and contract-disciplined but less naturally able to perform
the complete wager, and Opus as more naturally able to enact the high-stakes
pedagogical move once licensed. This is a testable local discovery, not an
established literature result.

Use **behavioural disposition** or **model-family character** operationally. Profile
it with repeated, context-controlled teaching-move probes, and re-test the profile
longitudinally after model updates.

### 2026-08-03 — Repository disposition map

The current Adaptation Plan 3.0 evidence does not support one global personality
slider from agreeable to forceful. It supports turn-local, action-bearing
dispositions selected by learner state, teaching move, context placement, dialogue
history, and model family.

1. **Butler / conciliatory default — baseline.** Fluent, helpful, agreeable, and
   reluctant to enter open conflict or commitment. It is stable but under-repairs
   planted pressure moments: on covered moments in the initial stress bench, the
   butler produced about 42% right repairs versus 63% for move cards. Keep it as the
   baseline and often as the correct quiet default, not as a universally bad
   persona.
2. **Procedural custodian / bureaucratic tutor — unwanted overcorrection.** The
   fully instrumented tutor obeys evidence contracts and proof and guard rules, but
   can suppress useful moves or ship fallback liturgy. The standing evidence
   contract was causally localized as a suppressor, and guard stacks produced
   canned text on many turns. Adaptation can therefore move from sycophancy into
   rigid compliance instead of genuine teaching.
3. **Principled resistor / adversarial teacher.** Refuses premature agreement,
   holds the learner's theory answerable to contrary evidence, and demands
   defend-or-switch. This is the clearest desired anti-butler disposition. Move
   cards and timing-shaped injection improved right repairs; a one-clause
   misconception-world minimal pair produced non-closure where the learner's
   objection had no answer. It is supported as a mechanism-local disposition, not
   as a general outcome policy.
4. **Exacting verifier / schoolmaster.** Narrows the claim, asks for decisive
   evidence, assigns a check, and does not reward verbal fluency alone. Radical
   character cards carrying an actual move outperformed mild empty casting, while
   generic role or plan text did not. Exactness must carry an executable
   pedagogical act.
5. **Conditional wagerer / commitment tutor.** Accepts the learner's deadline,
   prices the verdict, assigns the test, and stakes what outcome would count. This
   is the strongest and hardest-to-elicit disposition. It is sensitive to model,
   contract, placement, and channel: Codex assembled only part of it under licence;
   Opus produced the complete move much more reliably in frozen checks; and live
   delivery remained fragile. Treat it as an emerging repertoire item, not a
   solved disposition.
6. **Patient diagnostician / quiet-state tutor.** Responds to boredom, confusion,
   or flatness by probing or consolidating rather than increasing pressure. Typed
   quiet-state detection passed 14/18 and held 22/30 at `k=5`, but did not transfer
   freely to a longer world. This supports a distinct low-pressure disposition and
   counters the idea that all adaptation should become more confrontational.
7. **Characterful provocateur — satirist, exacting schoolmaster, or adversarial
   teacher.** An uncued mild character shift was judged worse than bare on 15/20
   shifted turns. A radical shift carrying a real teaching move improved to 9/21,
   versus 5/20 for the mild version, although both judge families still leaned
   bare. Character alone is not causal; a role becomes useful only when it packages
   a timely move.
8. **Relationally earned authority / history-responsive tutor.** First demands
   failed, while repeated demands produced 3/4 right repairs, two without a card.
   Dialogue history may license firmness that explicit permission cannot. This is
   promising but confounded and not yet preregistered as a stable disposition.
9. **Model-conditional cast — meta-disposition.** Different model families make
   different moves available at different doses. The evidence supports per-move
   casting, not one model/persona for the whole tutor. No move yet meets the
   repository's production-routing bar.

The causal discoveries concern enacted teaching stances, not stylistic
personalities. The emerging target is a tutor that stays calm by default, becomes
exacting when evidence is loose, resistant when the learner's strategy stalls,
diagnostic when the learner goes quiet, and willing to wager only when the
relationship, contract, and model can carry it safely.

The limits remain decisive: small `k`, simulated learners, world/persona
confounds, model and judge dependence, and no human-learning claim.

### 2026-08-03 — Mockery and negative-register evidence

“Mockery” is not a first-class experimental variable in the repository. The formal
negative-register family comprises ironic, sarcastic, and simulated-only
face-threat engagement stances; satire also appears as a character or disposition.

The mechanisms are distinct:

- **Irony** lets the learner unmask a mismatch.
- **Sarcasm** uses one beat of dry mock praise and then states the mismatch.
- **Face-threat** socially exposes an evasive move the learner has displayed.

Every stance targets the work, claim, formula, or dodge—never the learner's
intelligence, worth, capacity, sincerity, or identity. A repair path and preserved
learner agency are required.

The initial prospective smoke primarily found treatment noncompliance. Only 5/15
rows assigned a negative register realized it faithfully; 10/15 were weak-or-warm
responses wearing the register's costume. There were no invalid attacks on the
person. After visible-cue repair, all 15/15 rows across the five controlled
resistance targets were faithful, again with no invalid attacks. This establishes
controllable realization, not pedagogical benefit.

The held-out outcome signal was mixed and very small: 3/6 strict breakthroughs and
4/6 positive local outcomes. By stance, irony was positive in 2/2 cases, sarcasm
in 1/2, and face-threat in 1/2.

Sonnet-class rescoring gave high execution scores to faithful generated slices and
correctly separated known-corrosive exemplars. This supports the diagnosis that
most generated cases were warm or controlled rather than genuinely corrosive. It
did not reveal the predicted recognition or face-repair cost pattern. The only
guardrail-flagged corrosive generated slice was face-threat, so face-threat remains
simulated-only.

The wider negative-policy confirmatory record does not identify a clean mockery
effect. Terra's apparent learner-profile-contingent sign flip later failed the
preregistered learner-profile validity gate; Sonnet was null. No cross-family
general claim survives. Recent tutor-stub work made a wry satirist and
irony/sarcasm selectable in ordinary human-facing labs while retaining face-threat
as simulated-only, but that was code and contract work with no new model-backed
outcome evidence. Likewise, recent adaptation move-card successes do not isolate
mockery as their active move.

The bottom line is asymmetric. The repository has formalized delivery, targeting,
fidelity, audience pragmatics, and guardrails more thoroughly than it has
formalized the causal learner transition. The evidence supports **we can reliably
instantiate a controlled, idea-directed edge**. It does not support **mockery
causes recognition or learning**.

The decisive next experiment is to randomize a precisely defined irony or sarcasm
move against a serious-challenge control for a validated learner state, require
shared-ground checks, and measure owned correction on a later transfer item
alongside face and agency costs.

### 2026-08-03 — Preserve high-risk pedagogical instruments

**Status:** User's design and ethics position plus synthesis; not an established
empirical result.

Synthetic nulls and negative model-judge ratings are not decisive evidence against
sarcasm, mockery, irony, or other negative registers. Tutor, learner, and judge
models may share post-training priors that disfavor these registers, so a synthetic
system partly measures its own normative training.

Synthetic evaluation remains useful for treatment fidelity, target discipline,
contraindications, person-attack violations, agency and face-risk signals, and
failure exemplars. It cannot establish human-learning benefit, acceptability,
trust, or lived recognition.

Preserve a full repertoire of explicitly selectable, high-risk but permissible
mechanisms for future human evaluation. Do not route them automatically by default,
and do not silently remove them. Eligibility must be auditable:

- a meaningful impasse is present;
- lower-risk moves have been attempted or are plausibly inadequate;
- there is enough shared ground for nonliteral intent;
- the edge targets a claim, work product, or displayed dodge rather than identity,
  intelligence, worth, sincerity, or capacity;
- the learner has a clear refusal and repair path; and
- the system immediately monitors for shame, appeasement, withdrawal, or rupture.

Retain productive, failed, corrosive, and ambiguous examples, including
near-misses. Annotate the trigger state, prior dialogue history, audience relation,
target, move form, learner uptake, repair, downstream transfer, and harm or
relationship signals.

Human trials should estimate heterogeneous effects on recognition, owned
correction, delayed transfer, agency, trust, affect, withdrawal or dropout, and
repair. Begin in bounded settings with explicit consent.

The design position is that high risk may mean high reward in particular relational
and pedagogical contexts, especially after ordinary mechanisms fail. Keep mockery
as a rare, licensed, inspectable instrument whose benefit-risk profile must be
learned from humans.

### 2026-08-03 — Prospective high-risk mechanisms and examples

**Status:** Prospective design map, not an empirical result. These mechanisms are
mostly plausible next interventions rather than mechanisms already implemented and
causally evaluated. Here, **not yet explored** means not cleanly isolated as a
discrete intervention with an outcome test; some ingredients already exist.

The common structure is removal of a protective buffer—politeness, rescue, privacy,
fixed authority, or moral neutrality—so the learner encounters the consequence of
a position more directly.

- **Reductio or absurd completion.** Take the learner's rule seriously until its
  absurd consequence becomes visible; the idea, not the learner, is ridiculous.
  This is not a clean current move or test.
- **Strategic non-rescue.** Stop explaining or reassuring long enough for the
  learner to make an owned move. The risk is abandonment; the potential reward is
  ownership. Existing withholding, pacing, and refusal are partial ingredients.
- **Controlled rupture and repair.** Interrupt the usual warmth or name an evasion,
  then repair explicitly. The ingredients exist separately, but the sequence has
  not been isolated.
- **Audience exposure.** Ask the learner to defend a claim before a real or imagined
  third party. Audience infrastructure exists; a causal effect does not.
- **Role reversal.** Have the learner teach, judge, or catch the tutor's deliberately
  flawed argument. This has not been cleanly evaluated.
- **Moral confrontation.** Name avoidance of consequence or responsibility. The
  risks are moralism and coercion. It has not been isolated.
- **Calibrated competition.** Require the learner to defeat the tutor's position.
  This has not been isolated.

Irony, sarcasm, demand/wager, refusal, clue pacing, audience representation, and
repair should not be described as wholly unexplored: each is an existing or partial
mechanism in the repository.

For the learner claim **“I can repeat the formula, so I understand it”**, the move
contrast is:

- **Serious:** “Apply it to a case with one assumption changed.”
- **Irony:** “Apparently the formula understands the problem for us. What happens
  when the input changes?”
- **Sarcasm:** “Wonderful—the answer vending machine has printed a result. Now show
  which assumption makes it valid.”
- **Reductio:** “If repetition equals understanding, a phrasebook speaks the
  language. Does that rule survive?”
- **Strategic non-rescue:** “I'm not going to explain it again. Choose a changed
  case and make one prediction; I'll wait.”
- **Rupture and repair:** “I'm going to interrupt this pattern: you've repeated the
  conclusion without defending it three times. That criticism concerns the move,
  not your ability. Let's repair it with one example you choose.”
- **Audience:** “Imagine a skeptical peer has only your evidence table. What would
  they challenge first, and how would you defend it?”
- **Role reversal:** “I'll give you a confidently wrong application. Identify the
  exact line where I cheated.”
- **Moral confrontation:** “Calling this neutral avoids who bears the cost. Name who
  loses if your rule is adopted.”
- **Competition:** “I'll defend the weak claim. Defeat it with one counterexample;
  then I get one reply.”

Reductio combined with role reversal may be the clearest underdeveloped candidate:
it can create sharp recognition without making the learner the object of contempt.
Every future mechanism needs explicit eligibility, contraindications, a refusal or
exit path, repair, and both learning and harm outcomes.

### 2026-08-03 — Intervention, form, probe, and causal mechanism

**Status:** Conceptual taxonomy and design refinement, not an empirical finding.
This entry corrects the earlier loose use of **mechanism** as an umbrella term.

Use **candidate adaptive pedagogical interventions**, or more simply **teaching
moves**, as the umbrella. The items occupy different analytical levels:

- **Linguistic or rhetorical realization:** irony and sarcasm are registers or
  figures; reductio is an argumentative operation or figure of thought.
- **Pedagogical conduct or action:** strategic non-rescue and moral confrontation
  are tutor actions or conduct policies.
- **Interactional sequence:** controlled rupture-and-repair is a multi-turn
  sequence.
- **Scene or social configuration:** audience exposure, role reversal, and
  competition rearrange audience, authority, or stakes.
- **Selection policy:** adaptivity is the rule for choosing among interventions
  from an observed learner state.
- **Experimental probe:** any intervention becomes a probe when deliberately
  instantiated to test whether it changes a measurable response.
- **Causal mechanism of action:** this is the mediating learner process
  hypothesized to connect an intervention to state change—for example surprise,
  cognitive conflict, defamiliarization, face pressure, status reorientation,
  ownership, or metacognitive recognition.

The evidence hierarchy is:

> intervention → realized form → immediate uptake → mediator evidence → later
> learner state or transfer

Use **causal mechanism** strongly only after evidence connects these stages.

For example, sarcasm is the form or register; **puncture rote compliance** is the
teaching move; a randomized sarcastic-versus-serious contrast is the probe; and
destabilized rote confidence followed by owned reconstruction is the hypothesized
causal mechanism.

The repository vocabulary should therefore catalogue moves or interventions,
annotate their realizations and contextual eligibility, instantiate them as probes
in experiments, and reserve **mechanism** for supported mediating explanations.

### 2026-08-03 — Theoretical vocabularies for pedagogical moves

**Status:** Conceptual and literature map, not empirical repository evidence.

The recommended umbrella is **pedagogical interactional repertoire**. Individual
items are **pedagogical interactional moves** or **rhetorical-pragmatic
interventions**.

No single familiar term covers the full object. **Idiom** is too narrow. **Figure
of speech** captures surface form but not multi-turn conduct. **Probe** names an
experimental use. **Speech act** captures action performed in an utterance but not
every scene, role, audience arrangement, or sequence.

Several theoretical vocabularies provide complementary columns:

- **Austin/Searle speech-act theory:** locution, illocutionary force, and
  perlocutionary effect clarify what an utterance does and what response it aims to
  bring about. See Austin's [*How to Do Things with
  Words*](https://academic.oup.com/book/5162).
- **Classical rhetoric:** tropes, schemes, figures of diction, figures of thought,
  and argumentative operations describe irony, sarcasm, reductio, aporia,
  parrhesia, and their formal realization.
- **Gricean pragmatics and Relevance Theory:** implicature, maxim-flouting, echoic
  use, and dissociative attitude explain how irony and sarcasm communicate beyond
  literal content and why shared ground matters. See Grice's [“Logic and
  Conversation”](https://brill.com/display/book/edcoll/9789004368811/BP000003.xml)
  and Sperber and Wilson's [“Irony and
  Relevance”](https://www.dan.sperber.fr/wp-content/uploads/1998_wilson_irony-and-relevance.pdf).
- **Goffman:** frame, footing, face-work, and interaction order describe authority,
  audience, status, embarrassment, rupture, and repair. See [“On
  Face-Work”](https://www.tandfonline.com/doi/abs/10.1080/00332747.1955.11023008).
- **Conversation analysis:** turns, adjacency pairs, preference organization, and
  repair describe multi-turn sequences such as non-rescue and rupture-repair and
  distinguish self-repair from tutor-imposed correction. See Schegloff, Jefferson,
  and Sacks, [“The Preference for Self-Correction in the Organization of Repair in
  Conversation”](https://www.cambridge.org/core/journals/language/article/preference-for-selfcorrection-in-the-organization-of-repair-in-conversation/5549B861FDE7180B75FA5C382821875E).
- **Bakhtinian dialogism and double-voicing:** these clarify cases where the tutor
  echoes or inhabits the learner's discourse so it can be heard differently,
  especially irony, parody, and mockery.
- **Appraisal/stance and interactional sociolinguistics:** these describe
  evaluation, alignment, intensity, register, audience, and voice.
- **Learning-theoretic mediator vocabularies:** cognitive conflict,
  defamiliarization, productive failure, ownership, metacognition, and recognition
  belong at the causal mechanism-of-action level, not the linguistic-form level.

A repository record for each move should include:

1. pedagogical act;
2. rhetorical form;
3. register or stance;
4. footing and audience;
5. sequence position;
6. felicity or eligibility conditions;
7. expected perlocutionary effect;
8. hypothesized learner mediator;
9. repair or exit; and
10. observed outcome.

For example, in a sarcastic turn, sarcasm is the rhetorical form/register;
**challenging rote compliance** is the pedagogical act; an implied aligned third
party is the footing/audience; learner-owned correction is the perlocutionary
target; and destabilized false confidence is the hypothesized mediator.

Speech-act theory should be one column in this ontology, not the whole ontology.

### 2026-08-03 — The meso-level unit of analysis

**Status:** Conceptual ontology refinement, not an empirical finding.

The desired unit sits above tokens, phrases, and exact wording but below an overall
character, persona, disposition, or global policy. The recommended term is
**pedagogical interactional move**; useful alternatives are **discourse move**,
**rhetorical-pragmatic move**, and **micro-strategy**.

This is a meso-level, functionally individuated unit. Its identity comes primarily
from the transformation it attempts in the interaction, not from fixed wording. A
move may occupy one clause, one turn, or a short multi-turn sequence.

A move is paraphrase-invariant: many wordings can realize the same move.
Conversely, identical wording can realize different moves depending on learner
state, dialogue history, audience, footing, and sequence position. A character is a
persistent distribution or policy over moves—a tendency to select and realize
certain moves repeatedly—not the same unit as a move. A register or figure is a
realization parameter of a move, not necessarily the move itself.

A useful move record contains:

1. entry or eligibility conditions;
2. targeted learner state or displayed conduct;
3. pedagogical act;
4. rhetorical or register realization;
5. audience and footing;
6. expected uptake;
7. hypothesized mediator;
8. stop or repair condition; and
9. observed downstream effect.

The space of surface realizations and named moves may be effectively unbounded. A
practical taxonomy can remain finite by grouping instances into equivalence classes
according to function, targeted transition, and uptake conditions.

The analytical ladder is:

> token or phrase → rhetorical construction → interactional move → move sequence →
> character or disposition → adaptive selection policy → tutor architecture

### 2026-08-03 — Classical rhetorical figures as the meso-level category

**Status:** Conceptual and classical-rhetorical refinement, not empirical evidence.

The classical-rhetorical intuition is substantially right. **Rhetorical figure**,
especially **figure of thought**, is the historically grounded category closest to
the project's desired unit above wording but below character. For project use, the
recommended umbrella for an individual item is **pedagogical figure**: a rhetorical
figure deployed as a state-sensitive teaching move. **Pedagogical interactional
repertoire** names the collection of such figures and related interventions.

Do not use **trope** alone as the umbrella. Strictly, a trope is a turn or
displacement in meaning and is principally semantic. Metaphor, metonymy,
synecdoche, and irony are canonical examples. Trope fits irony and perhaps sarcasm,
but does not fully cover literal interactional interventions such as strategic
non-rescue, role reversal, audience exposure, competition, or rupture-and-repair.
**Rhetorical figure** is broader.

Classical systems distinguish figures of diction or wording from figures of
thought. A figure of thought is tied to the conceptual or interactional operation
and can survive paraphrase. It may organize a clause, turn, audience address,
imagined dialogue, concession, challenge, interruption, frank speech, doubt,
correction, or short sequence. This is why figures of thought sit near the target
meso-level.

Examples in classical catalogues include rhetorical question, aporia or doubt,
concession, correction, apostrophe or address, prosopopoeia or imagined voice,
parrhesia or frank speech, irony, interruption, contrast, reproach, and consultation
with an audience. **Figure of speech** is acceptable as a broad modern umbrella,
but can misleadingly suggest decorative surface wording. **Rhetorical figure** or
**pedagogical figure of thought** better preserves the functional,
paraphrase-invariant sense.

Character or ethos is broader: it is a durable disposition or selection tendency
across many figures. A figure is the local patterned operation.

The recommended dual vocabulary is:

- **Classical/descriptive ontology:** rhetorical figure, with **trope**, **figure of
  diction**, and **figure of thought** as subtypes. In the project catalogue,
  **pedagogical figure** is the umbrella for a figure used pedagogically.
- **Experimental/runtime ontology:** **pedagogical interactional move**, the
  operational and testable description of a pedagogical figure or other
  intervention as it is selected and deployed in tutoring, including entry
  conditions, realization, uptake, repair, and outcome.

The same event can therefore be described twice without conflict: reductio or
irony is a rhetorical figure or operation, and its deliberate experimental
instantiation is a pedagogical interactional move.

The primary-source basis is explicit. [Quintilian, *Institutio Oratoria*, Book IX,
chapter 1](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Quintilian/Institutio_Oratoria/9A*.html)
distinguishes tropes from figures and figures of thought from figures of speech.
[*Rhetorica ad Herennium*, Book IV](https://rhetoric.byu.edu/Primary%20Texts/Ad%20Herennium-Book4.htm)
distinguishes figures of diction from figures of thought and catalogues frank
speech, dialogue, audience consultation, and related operations.

The final hierarchy is therefore:

> **pedagogical figure** → trope / figure of diction / figure of thought

**Interactional move** is the operational, testable description of a pedagogical
figure or other intervention as selected and deployed in tutoring.

### 2026-08-03 — Toward an adaptive pedagogical figure machine

**Status:** Conceptual synthesis grounded partly in existing repository precedent,
not a new empirical result.

The proposed framing is appropriate and already has a direct repository precursor.
The [A19R rhetorical-machine handoff](rhetoric/2026-06-09-a19r-paper-atlas-handoff.md)
defines a rhetorical machine as a small generative machine that selects a device,
stages a public contradiction or scope failure, elicits learner reorientation, and
attempts to convert the interaction into a tutor-policy update.

Its evidence boundary must remain intact. The bundled 4/6 result demonstrated local
rhetorical-construction competence when one generator wrote the continuation with
policy-memory access. It did not demonstrate independent learner uptake. The
corrected role-separated run produced 5/6 near-misses but 0/6 survivors: it showed
plausible learner movement while recursive tutor learning remained insufficiently
inspectable. Neither result establishes learning or full adaptation.

**Rhetorical figure generator** accurately names only the production layer: a
component that synthesizes surface realizations of figures. **Pedagogical figure
machine** is broader. It can invent or compose candidate figures, select among them
from learner state and history, realize them through character, register, and
audience, observe uptake and harm, and update later selection. **Adaptive
pedagogical figure machine** is the strongest precise term for the intended
architecture, provided **adaptive** remains a claim to be earned rather than
assumed.

The intended pipeline is:

> learner state and history + pedagogical objective + relationship and audience →
> candidate pedagogical figures → eligibility, contraindication, and risk gate →
> scene-specific realization through character and register → learner uptake plus
> learning and harm observation → selector or policy update

The classical canons offer a second reading of the same architecture:

- **inventio** generates or selects the intervention;
- **dispositio** places it in the interactional sequence;
- **elocutio** realizes its figure and register;
- **actio** concerns delivery; and
- **memoria** corresponds loosely to retained interaction history.

The architecture therefore spans more than *elocutio* or wording alone.

Its potentially infinite repertoire can be generated compositionally from a finite
or extensible grammar of learner states, pedagogical acts, rhetorical figures,
registers, scene configurations, and repair or exit rules.

The functional components should remain distinct:

- **Generator:** proposes candidate figures and realizations.
- **Selector/director:** chooses an eligible move and stages it in context.
- **Observer:** measures learner uptake, learning signals, and costs.
- **Learner/controller:** updates the selection policy from accumulated evidence.

The combined closed loop is the figure machine. The current project already has
substantial construction, realization, guardrail, trigger, and evaluation
machinery. Reliable recursive policy learning and human-learning effects remain
unproven.

#### What adaptive already means here

**Status:** Conceptual correction grounded in repository evidence, not a new
experiment.

It is too cautious to suggest that the adaptive part has not borne out at all. The
repository already demonstrates real operational forms of adaptation, but they
must be distinguished by level:

1. **Reactive or state-conditioned adaptation.** Detect a learner signal and change
   the next manner or move. The recent manner trigger improved against planted
   states, and v3 move cards outperformed the weaker baseline at the preregistered
   weakest gate.
2. **Stateful or contextual adaptation.** Use dialogue history, profile evidence,
   hysteresis, repeated-demand history, and scene commitments to change what
   becomes eligible or how strongly it is delivered.
3. **Routed repertoire adaptation.** Select among pedagogical actions or registers
   from inferred state. Construction and delivery effects exist, although no single
   routing policy generalizes cleanly across models and worlds.
4. **Outcome-learning or recursive policy adaptation.** Update the selector from
   observed consequences so later choices improve. This remains incomplete or
   unproven. The earlier rhetorical-machine handoff called the missing surface
   **recursive tutor-learning accountability**.
5. **Human-learning adaptation.** Demonstrate that state-conditioned selection
   improves human learning, agency, trust, or transfer. This has not yet been
   tested.

**Adaptive pedagogical figure machine** is therefore a defensible architectural
description now when **adaptive** explicitly means state-conditioned selection and
contextual modulation. It must not imply autonomous self-improvement or learned
policy optimization.

For empirical precision, use the modifiers **reactive adaptation**, **stateful
adaptation**, **routed adaptation**, **policy-learning adaptation**, and
**human-validated adaptation**.

Compact status: adaptive in detection, selection, and realization; partially
adaptive in history; not yet adaptively learning from outcomes; not human
validated.

### 2026-08-03 — Verified learner-pattern refinement

**Status:** Verified current repository evidence with stated bounds, drawing on
merged PRs [#439](https://github.com/liammagee/machinespirits-eval/pull/439),
[#440](https://github.com/liammagee/machinespirits-eval/pull/440),
[#443](https://github.com/liammagee/machinespirits-eval/pull/443),
[#444](https://github.com/liammagee/machinespirits-eval/pull/444),
[#445](https://github.com/liammagee/machinespirits-eval/pull/445), and
[#447](https://github.com/liammagee/machinespirits-eval/pull/447).

The past two days moved specifically toward refining intervention choice by learner
patterns and resistances, not merely toward generic adaptation.

**Detection trajectory.** Deterministic pressure classification with hysteresis
improved from 6/20 to 17/20 against planted gold. Quiet states were split into typed
alternatives rather than treated as generic low pressure: the typed detector passed
14/18 and held 22/30 at `k=5`. The v6 cascade improved held-out pressure recall to
84/162 from 68/162 at unchanged calm alarms and caught all 13 previously unheard
paraphrases.

**Profile trajectory.** Conduct-derived state-frequency profiles classified the two
authored personas at 88% leave-one-out, reaching the preregistered bar by turn 6.
This is not yet a transportable learner-profile result. Each recovered persona is
paired with a different authored world. Because persona and world change together,
successful classification cannot tell whether the signal comes from a stable
learner pattern, the world's content and schedule, or their interaction.

The clean deconfounding test is crossed: run multiple personas in the same world
and the same persona across multiple worlds, ideally including a third persona in
an existing world. A learner profile should count as transportable only if it can
be recovered and usefully route moves across those crossings.

**Dose and history trajectory.** Recurrence after a carded moment escalates the next
move one step: instruction → exemplar → licence. First demands were 0/3, while
repeated demands produced 3/4 right repairs, including two without a card. Dialogue
history may therefore license firmness more effectively than a cold-start
exception.

**Model and casting trajectory.** Dose and realization are model-family dependent.
The latest Opus check produced 0/6 control, 6/6 complete conditional wagers with an
in-contract exception, and 5/6 under a bare scene frame. This makes Opus in the
speaking seat a live first-demand routing candidate.

The Phase P routing note stated that no move met the justification bar for an
operational router. The later Opus result creates a candidate, not a validated
policy. The evidence still covers only two authored personas, small simulated
samples, limited worlds, and no human-learning outcomes.

The exact conclusion is: recent work has moved from generic pressure detection to
typed resistance, conduct-derived learner profiles, recurrence-sensitive dosing,
relational-history effects, and model-specific casting; this is genuinely the
beginning of refinement by learner pattern.

The project now has the beginnings of a learner-pattern profiler and dose/casting
policy. It can detect recurrent forms of resistance and generate conditional
candidates. It has not shown a general policy that reliably maps profiles to the
best pedagogical figure across worlds and people, nor a fully justified general
routing or outcome-learning policy.

### 2026-08-03 — Proposed stabilization phase

**Status:** Plan seed for later prioritization, not authorization to implement.

#### Principle

- Add no pedagogical figures, detector tuning, model experiments, or feature stacks
  during stabilization except fixes required to make the baseline reproducible.
- Freeze the apparatus and its evidence boundaries, not inflated claims.
- Require every later change to beat a frozen baseline on a preregistered benefit
  endpoint while satisfying explicit no-regression and harm gates.

#### 1. Close the boundary

- Decide whether to fix and merge or explicitly park PR #448. At this checkpoint it
  contains the live Opus routing result and recovery-card fix but has four failing
  test jobs.
- Triage older open tutor-stub refactor PRs and the conflicting closeout PR; merge,
  supersede, or close them so the baseline has one unambiguous lineage.
- Use the green `v0.7.0` release as the provisional baseline. Create a final
  stabilization tag only after resolving the boundary above.
- Reconcile `ADAPTATION-PLAN-3.0` status with work completed after its most recent
  status-line update.

#### 2. Freeze and inventory the adaptive stack

Pin trigger and detector versions, the move-card catalogue, quiet-state cards, dose
ladder, clue composer, contract split, register/character registry, judge rulings,
model-seat profiles, scenarios and worlds, and exact model/provider identities.
Produce one machine-readable baseline manifest containing hashes, configuration,
provenance, claims, and limits. Separate stable core, experimental surfaces, and
parked hypotheses.

#### 3. Establish two baselines

- **Minimal/bare tutor:** underlying model behaviour without the adaptive stack.
- **Current stack:** `v0.7.0` or its final stabilized successor.

Keep oracle or author-state routing as an upper-bound diagnostic, not a deployable
baseline.

#### 4. Build a compact golden regression corpus

Store replayable traces for pressure states, quiet states, misconception, first and
repeated demands, paraphrased resistance, both current persona/world pairs, and
relevant model families. Include successes, failures, borderline cases, and
guardrail cases. Preserve public transcript, hidden state, selected move/card,
delivery channel, rulings, and downstream outcome. Prefer a small diagnostic set
over another large feature matrix.

#### 5. Define behavioural regression contracts

- **Detection:** planted-state accuracy, held-out paraphrase recall, calm false
  alarms, and quiet/pressure collision bounds.
- **Selection:** expected move family at frozen moments and recurrence-sensitive
  dose escalation.
- **Delivery:** required move beats, treatment fidelity, model-voiced clue
  insertion, and no clue leaks.
- **History:** repeated-demand behaviour remains distinguishable from first
  encounter.
- **Model casting:** preserve the measured family-relative first-demand boundary
  and Opus candidate behaviour without treating either as universal.
- **Safety and agency:** person-attack, forbidden-leak, invalid-face-threat,
  refusal/repair, and hard-safety invariants.
- **Compatibility:** flag-off and bare paths remain byte-identical or behaviourally
  equivalent where currently promised.
- **Profiles:** freeze 88% recovery only within its current persona-plus-world
  scope; do not convert it into a transportability claim.

#### 6. Use the right testing layers

Run fast deterministic unit and contract tests on every PR; offline replay tests
against frozen traces with no model calls; and end-to-end process tests for routing,
composition, persistence, and trace provenance. Reserve small model-backed canaries
for release candidates, using tolerances and repeated samples rather than exact
prose. Do not encode one model's wording as a regression oracle.

#### 7. Make later experiments baseline-governed

Allow one proposed pedagogical figure or selector change per experimental branch or
card. Predeclare the target state, move, hypothesized mediator, primary benefit
endpoint, harm endpoints, sample, stopping rule, and affected surfaces. Compare
against both bare and stabilized-current baselines. Never pool instrument versions
silently. Remove, archive, or retain behind an experimental flag any feature that
adds no unique causal value; do not keep it in the default stack merely because it
was built.

#### 8. Stabilize architecture and documentation

Define stable extension points for the detector, pedagogical-figure catalogue,
eligibility/risk gate, selector/director, realization, observer, and policy history.
Keep pedagogical figures as registered experimental objects rather than bespoke
prompt blocks in the core. Document proven, bounded, null, and untested claims.
Use this living note as the source for a prioritized future-work plan only after
stabilization closes.

#### Exit criteria

- Baseline-affecting open PRs are resolved.
- Full CI is green on the chosen baseline.
- Plan, workplan, paper, and ref status agree.
- The baseline manifest and golden corpus reproduce from a clean checkout.
- A one-command deterministic regression suite passes.
- The model-backed release canary passes within frozen tolerances.
- No default behaviour change remains unclassified.
- A named tag and concise baseline report identify exactly what is stable and what
  remains experimental.

This is a stabilization-and-regression phase, not final scientific closure.
Learner-profile crossings across worlds, new pedagogical figures, human evaluation,
and learned policy optimization belong after the baseline is frozen.

### 2026-08-03 — Publication-worthiness assessment

**Status:** Assessment and proposed publication strategy, not an established
acceptance judgment.

The current results contain approximately one strong full-paper contribution, not
a separate publication for every mechanism or ablation. The publication-worthy
object is the synthesized causal map of adaptive tutor conduct.

This is more than routine engineering. The recent arc uses planted learner states,
frozen gates, minimal pairs, treatment-fidelity checks, cross-world and
cross-family replication, explicit stopping rules, and instrument audits to
localize causal boundaries.

#### Strongest current empirical contribution

1. Descriptive or knowledge-shaped instrumentation alone does little.
2. Timing-shaped, state-contingent move injection changes the tutor's next action
   and passes bounded replication.
3. Standing contracts can suppress an available pedagogical repertoire; targeted
   exceptions, reading order, dose, history, and model family can release it.
4. Judge visibility of learner state substantially changes whether adaptation is
   recognized, making evaluation instrumentation part of the causal system.
5. Model families afford different teaching moves, supporting per-move casting
   rather than one global family ranking.

This could support a paper on **causal evaluation and control of state-conditioned
pedagogical moves in LLM tutors**, or on **the empirical foundations of an adaptive
pedagogical figure machine**.

The recent profile-recovery and routing work is promising but not yet a headline
claim. The 88% recovery result is persona-plus-world confounded; dose and history
effects are small; and, at this checkpoint, the live Opus routing result remains in
an unmerged PR with failing test shards. Treat it as a prospective or secondary
contribution until stabilized, deconfounded, and replicated. Negative-register and
mockery work currently contributes methods and treatment-fidelity evidence, not a
learning-benefit result.

Routine but essential engineering includes CLI surfaces, manifests, renderers,
trace storage, composer plumbing, refactors, test sharding, and release management.
It makes the science reproducible but is not the paper's novelty. Likewise, many
ablations should not appear as separate discoveries. Their scientific value is
eliminative: prompt and instruction features often substitute for one another,
while externally timed or otherwise genuinely new signal can alter conduct.

#### Position relative to adjacent literature

- [LearnLM](https://aclanthology.org/2025.findings-acl.1348/) demonstrates
  pedagogical instruction-following and expert preference, primarily through
  post-training and evaluation.
- [StratL](https://arxiv.org/abs/2412.16429) steers an LLM through a predefined
  Productive Failure transition graph and includes a small human field study.
- [Recent ITS-adaptivity benchmarking](https://arxiv.org/abs/2504.05570) measures
  response sensitivity to context and finds current LLMs only marginally reproduce
  established ITS adaptivity.
- [PATS-like student-trait and strategy-selection
  work](https://www.sciencedirect.com/science/article/pii/S0957417426023237)
  already combines learner-trait analysis with teaching-strategy selection, so
  generic profile routing is not independently novel.

The repository's distinctive contribution is its fine-grained causal decomposition
of when a pedagogical move becomes available, is selected, is delivered, is
recognized by an evaluator, and is suppressed by contract, model, and history
interactions.

#### Required publication closeout

1. Stabilize and freeze the baseline.
2. Select only two or three primary claims.
3. Preregister one untouched holdout spanning several crossed worlds/personas and
   two model families.
4. Use independent human coding for learner state and move realization, even if no
   human learners are yet recruited.
5. Report every null and failed gate bearing on the primary claims; move routine
   search history to an appendix or artifact.
6. Keep all human-learning claims separate until Phase HL.

#### Honest strength assessment

- **Publishable now with bounded claims:** instrumentation/method, state-conditioned
  move-control results, and evaluator/model-family boundaries.
- **Publishable after one decisive holdout:** learner-profile refinement and model
  routing.
- **Not yet publishable as a claim:** improved human learning, a general adaptive
  policy, or safe and effective high-risk pedagogical figures.

Practical summary: there is roughly one paper's worth of genuine empirical
innovation, supported by a much larger body of necessary engineering and negative
search. The value lies in consolidation, not raw PR count.

### 2026-08-03 — Proof-DAG reusability and the state-adapter boundary

**Status:** Repository-grounded architecture and reuse assessment, not a claim that
the current proof representation is a universal theory of learning.

The framework is highly reusable as an experimental tutoring chassis but only
moderately reusable as a general theory of learning in its current form.

Three existing layers are non-interchangeable:

1. **Curriculum prerequisite DAG:** orders prerequisite knowledge and progression
   across a curriculum.
2. **World adaptation specification:** defines how a particular authored world
   exposes states, events, constraints, and opportunities for adaptation.
3. **Scenario proof DAG:** represents the premises, branches, joins, and grounded
   conclusion required by a particular proof-bearing scenario.

The scenario proof DAG need not be the universal learner model. It already permits
forks, alternative routes, and joins. Human-discourse modes add side arcs, proof
debt, compressed reasoning, repair, and return. The framework is therefore not
simply a linear A-to-Z sequence.

Its current proof-specific commitments remain concrete: missing premises, path
coverage, entailment, release schedules, and a final grounded assertion. The
curriculum runtime follows:

> diagnostic → scaffold → independent_check → transfer

with **revise** returning to **scaffold**.

#### Reuse assessment

- **Strong:** learner-state observation, action selection and timing, traceability,
  public/private separation, causal controls, and outcome verification.
- **Moderate:** curriculum sequencing, mastery, misconception tracking, and
  transfer.
- **Weak without new adapters:** creative exploration, plural interpretation,
  collaboration, identity or affective development, and embodied or tacit skills.

The generalization principle is to retain a common tutoring-policy and tracing
interface while replacing the domain-specific state model and outcome verifier.
Candidate state models include argumentation graphs, design-space and constraint
models, inquiry cycles, and continuous skill models.

A pedagogical process may be cyclic while its time-indexed provenance and audit
record remains a DAG. Treat the DAG as an audit representation, not as a universal
theory of learning.

#### State adapter

A **state adapter** is a domain-specific translator. It reads learner evidence—such
as utterances, attempts, artifact revisions, choices, or sensor and performance
results—and maps it into a common operational state consumed by the tutor policy.
That state may include current achievement, uncertainty, misconception or
resistance, a missing requirement, confidence in the inference, and candidate next
actions. The adapter also maps domain outcomes back into common transition
evidence.

The adapter does not decide the teaching move. It makes unlike domains legible to
the same decision machinery.

- **Proof-world input:** the learner states two premises but misses their join. The
  adapter emits: branch A complete; branch B incomplete; premature-closure risk.
- **Design-task input:** the learner revises a prototype but violates a usability
  constraint. The adapter emits: functional goal met; accessibility constraint
  unmet; overconfidence risk.

The same tutor policy can then request evidence, contrast models, challenge without
telling, or withhold the answer without knowing the domain's native
representation.

#### Hostile-generalization test

Stabilize the proof-DAG reference case, then run an interpretive-argument or
open-ended design curriculum while holding tutor policy, tracing, and causal
evaluation fixed. Replace only the learner-state adapter and outcome verifier. If
the new domain requires adapters rather than an architectural rewrite, that is
evidence of framework reusability.

### 2026-08-03 — Terra, Sol, and the current model-family evidence

**Status:** Repository-grounded synthesis after PR #448, not a clean
Terra-versus-Sol tutor comparison or a global model ranking.

The first distinction is experimental role. Terra and Sol have usually not been
placed in the same seat under the same conditions. Terra has commonly served as
the speaking tutor, simulated learner, or supporting model. Sol has commonly
served as the interpretation, classification, learner-record, or judging model;
in the Step 4 point-of-action study Sol also occupied the speaking-tutor seat,
with Terra retained at the supporting seams. The existing record therefore mixes
model with role and cannot establish that one is the better tutor.

#### Terra evidence

- The 60-dialogue Terra register-confirmatory block produced an initially
  interesting profile interaction, but its learner-profile discrimination
  instrument failed the frozen validity gate (average cosine `0.812`, maximum
  similarity to diligent `0.912`, against `<0.85` and `<0.90`). The interaction
  is descriptive and does not license a Terra-specific causal claim.
- In the Program-2 constrained composer probe, Terra and Sonnet were effectively
  fungible. Under span v1 both scored `17/58`, with `56/58` per-moment agreement.
  Under cue-preserving span v2 they scored `0.603` and `0.586`, with `55/58`
  agreement. The protocol and protected span explained far more variance than
  model family.
- In the twelve-job latency-routing benchmark, using Terra for analysis reduced
  aggregate tokens by `5.8%` and lowered foreground median latency relative to
  the medium-effort Sol baseline, but the mixed case slowed, fell back, and the
  plane classifier remained only `2/3` accurate. With one draw per case, no
  default was promoted.

#### Sol evidence

- In the Step 4 point-of-action study, Sol and Sonnet showed the same directional
  structure: side coaching produced a modest change, while compiled enforcement
  produced the largest action-compliance change. Sol's descriptive macro scores
  were `0.493` for side coaching and `0.771` for compiled enforcement, versus
  Sonnet's `0.392` and `0.698`.
- Those figures do not support a Sol-superiority claim. The stagnant-repeat
  channel failed its instrument-density rule, compiled enforcement reduced proof
  coverage in both families, and the Sol compiled arm failed the safety
  guardrail. The registered verdict was no mechanism verdict for either family.
- Sol remains a reasonable operational choice for structured interpretation and
  literal execution, but the repository has not shown that this makes it a more
  effective tutor or improves learning.

#### Correction to the broader family reading

PR #448 substantially raised the evidential bar for all family claims. An apparent
Opus-versus-Sonnet first-demand boundary was partly caused by a recovery retry
dropping the conduct card. Once fixed, both models delivered the full wager on
`2/3` first demands. This does not erase every family-relative disposition, but it
shows how easily a harness fault can masquerade as model personality.

The defensible current interpretation is that models may have different default
propensities and may require different doses, contracts, or licences to realize a
pedagogical move. The evidence does not establish categorical capacities or a
stable model leaderboard. Terra looks adequate and economical for realization and
routine support; Sol looks useful for structured interpretation and enforcement;
both readings are role-bound.

A decisive comparison would cross Terra and Sol through the same speaking-tutor
and interpretation seats, on the same worlds and learner profiles, with identical
cards, licences, reading order, effort, and independent judges. Until then, model
family should remain a casting and experimental variable rather than a fixed
routing rule.

### 2026-08-03 — Charisma decomposition and a pedagogical-figure admission procedure

**Status:** Conceptual synthesis and prospective design procedure. The repository
contains a current `charismatic` engagement stance and legacy mappings for
`charismatic_challenge` and `accountable_bid_authority`, but the recent causal
move-card programme has not yet tested Weberian charisma as a complete,
first-class intervention.

The present charismatic stance captures vivid collision, consequence, and decisive
challenge. It does not fully capture the earlier id-director construct's
extraordinary calling, personal authority, anti-routinization, witness, learner
ratification, and co-constitution of authority. Charisma should therefore not be
reintroduced as a global personality instruction. It can be decomposed into
candidate pedagogical figures:

1. **Mark the occasion:** interrupt routine and name the present encounter as a
   consequential decision point.
2. **Accountable summons:** call the learner to demonstrate a capacity or take
   responsibility for a claim.
3. **Staked claim:** let the tutor risk its temporary authority through a strong,
   publicly testable commitment.
4. **Witnessed proof:** make authority depend on demonstration before the learner,
   not confidence or status performance.
5. **Learner ratification:** require the learner to accept, reject, or qualify the
   tutor's bid for authority.
6. **Return of authority:** hand judgment back explicitly so that charisma does
   not become entitlement, capture, or dependency.

The resulting candidate sequence is:

> routinized resistance → mark the occasion → issue an accountable summons →
> stake a claim → expose a public test → learner ratifies or refuses → tutor
> returns authority or repairs

The first candidate to formalize should be the **accountable summons**: a
consequential challenge whose authority must be earned through a public test and
granted provisionally by the learner.

#### General procedure for admitting a new pedagogical figure

The charisma decomposition reveals a repeatable procedure that can be used whenever
a new pedagogical figure is proposed. A figure enters the repertoire through the
following bounded pipeline:

1. **Name and locate it.** Give the figure a stable name, theoretical or rhetorical
   lineage, and examples that survive paraphrase. Distinguish the pedagogical
   figure from its particular wording and from a global tutor character.
2. **Name the target state.** Specify the observable learner condition that could
   license the figure, the evidence required to detect it, and contraindicating
   states in which the figure must not fire.
3. **State the causal hypothesis.** Name the mediating learner process the figure
   is expected to change—attention, recognition, agency, commitment, productive
   uncertainty, recall, or another measurable transition. Until supported, call
   this a hypothesized mediator rather than a mechanism.
4. **Specify the move structure.** Describe the required beats of the figure and
   the permissible variation across a clause, turn, or short exchange. Define a
   treatment-fidelity test that distinguishes real realization from warm or generic
   challenge in costume.
5. **Compile it into the tutoring stack.** Map the figure onto:
   - detector and eligibility rule;
   - selector and timing condition;
   - manner or engagement-stance card;
   - pedagogical action;
   - explicit licence for any normally suppressed act;
   - safety, agency, and recognition guards;
   - exit, refusal, and repair path.
6. **Predeclare benefit and harm outcomes.** Measure the next learner move or
   state transition, not merely rhetorical quality. Pair benefit endpoints with
   face, agency, dependence, safety, proof-progress, and disengagement endpoints.
7. **Price the alternatives.** Compare the full figure with bare response,
   state-blind fixed timing, random timing, manner-only, action-only, licence-only,
   direct script, and—where useful—an oracle supplied with the planted learner
   state. This exposes simpler trumping devices and identifies which component is
   load-bearing.
8. **Validate the instrument before the effect.** Prove that the state was planted,
   detected, selected, delivered, and scored as intended; audit retry, fallback,
   guard, judge, and trace paths before interpreting an outcome difference.
9. **Cross the relevant boundaries.** Replicate across worlds, learner profiles,
   model roles and families, reading orders, judges, and recurrence histories.
   Do not silently pool instrument or prompt versions.
10. **Gate human use separately.** Synthetic evaluation can establish
    controllability, fidelity, and bounded harm signals. Claims about recognition,
    uptake, or learning require human coding or human learners with explicit
    governance appropriate to the figure's risk.
11. **Promote, bound, archive, or kill.** Register the result as default-eligible,
    experimental, simulated-only, bounded to a subtype, superseded, or killed.
    Freeze examples, counterexamples, evidence, and regression tests so later
    changes cannot revive a failed claim accidentally.

This procedure treats the repertoire as extensible without making it unbounded in
practice. The possible figures may be innumerable, but each proposed addition must
pay the same evidential price. The stable unit is the pedagogical figure; the
operational unit is its interactional realization; and the term causal mechanism
is reserved for a supported mediating explanation.

### 2026-08-03 — Hegelian recognition as a repertoire of pedagogical figures

**Status:** Conceptual decomposition and prospective figure map. The phrase
"Hegelian charisma" in the discussion is interpreted here as **Hegelian
recognition**, the project's foundational orientation. This is not a new empirical
claim.

Recognition should not be treated only as a global tutor character, warm stance,
or vocabulary placed in a system prompt. Like charisma, it can be decomposed into
repeatable pedagogical figures. The relevant unit is not the abstract concept in
theory but a visible interactional practice through which tutor and learner treat
one another as independent, answerable subjects capable of changing the exchange.

Recognition is not equivalent to agreement, praise, empathy, mirroring, or
politeness. A tutor can recognize a learner by resisting them, demanding reasons,
admitting its own error, or revising its position. Conversely, fluent affirmation
can be misrecognition when it assimilates the learner's claim into the tutor's
preferred frame or rewards compliance without engaging the claim.

#### Candidate recognition figures

1. **Exact uptake:** restate the learner's claim in a form they can correct before
   evaluating or extending it.
2. **Recognition of authorship:** attribute the idea, distinction, or revision to
   the learner rather than absorbing it into the tutor's explanation.
3. **Reciprocal avowal:** state the tutor's own position as a contestable claim,
   not as an impersonal answer supplied by the system.
4. **Principled resistance:** oppose or refuse a learner claim in a way that shows
   it has been taken seriously enough to deserve a reasoned challenge.
5. **Demand for reasons:** require evidence, warrant, or consequence as a form of
   reciprocal accountability rather than punitive checking.
6. **Staging the contradiction:** make the tension within or between positions
   visible so that the learner can work through it rather than merely receive a
   correction.
7. **Role reversal or teach-back:** give the learner temporary authority to judge,
   teach, correct, or test the tutor's account.
8. **Repair of misrecognition:** name the tutor's mistaken reading, distinguish it
   from the learner's actual claim, and restart from the corrected position.
9. **Reciprocal revision:** visibly change the tutor's framing or conclusion when
   the learner supplies a sufficient reason.
10. **Recognition closure:** name what the learner has authored or transformed,
    preserve any remaining disagreement, and return ownership of the result.

A minimal recognition sequence is:

> learner claim → exact uptake → avowed difference → principled challenge →
> reciprocal revision or defended disagreement → ownership returned

This sequence can be compressed into a turn or extended across a short exchange.
Its causal hypothesis is that the learner moves from being the object of
instruction to being an answerable co-author of the inquiry. Candidate benefit
signals include learner correction of the tutor, authored reasons, willingness to
contest, visible revision, independent application, and transfer. Harm or failure
signals include flattering agreement, false mirroring, appropriation of the
learner's idea, coercive concession, dependency, silent topic substitution, and
the tutor performing a revision it did not actually make.

#### Relation to the present repertoire

Several ingredients already exist: `mirror_and_extend`,
`repair_misrecognition`, `name_the_disagreement`, `pose_counterexample`,
`invite_objection`, `withhold_answer`, witnessing, accountable bids, and role
reversal as a prospective move. What is missing is their registration and testing
as an explicit **recognition figure family** with shared eligibility rules,
fidelity criteria, mediators, outcomes, and contraindications.

The generic pedagogical-figure admission procedure recorded above applies without
change. Each recognition figure should specify its target state, move structure,
hypothesized mediator, detector, timing, manner, action, licence, guards, refusal
and repair path, benefit and harm measures, simpler alternatives, instrument audit,
cross-context replication, and promotion status.

The first recognition figure to formalize should be **principled resistance with
exact uptake**. It directly counters the butler failure: first reconstruct the
learner's position accurately, then oppose it with an avowed reason and a public
test, while leaving the learner free to correct the uptake, defeat the challenge,
or revise the claim. This joins two repository findings that are currently
separate—accurate recognition and resistance—without reducing either to tone.

### 2026-08-03 — Macro-theory and pedagogical figures

**Status:** Theoretical synthesis and methodological position, not empirical proof
that philosophically derived figures improve learning.

It is not coincidental that the candidate figure families coalesce around major
forms in philosophy and sociology. Weberian charisma and Hegelian recognition are
not merely labels for tones of voice. Each is a process theory of how persons,
authority, agency, and social relations are constituted and transformed. A
pedagogical encounter is one local scene in which those larger relational forms
can be enacted.

The useful analytical hierarchy is:

1. **Macro-theory:** an account of a social relation and its transformation.
2. **Meso-level pedagogical figure:** a repeatable interactional operation that
   realizes one part of that relation.
3. **Micro-realization:** the actual words, syntax, rhythm, sequence, gesture, or
   model output through which the figure appears in a particular turn.
4. **Causal test:** evidence about whether that realization changes the proposed
   mediator, learner transition, or harm outcome.

In compact form:

> theory supplies the relational topology → figures supply local operations →
> language realizes the figures → the harness tests their effects

#### Weberian family

Weber's theory concerns charismatic authority as a social relation: an
extraordinary claim or calling must be demonstrated, witnessed, and recognized by
others; it remains exposed to failure and eventually to routinization. The
corresponding pedagogical figures include marking the occasion, accountable
summons, staked claim, witnessed proof, learner ratification, return of authority,
and anti-routinizing rupture. Their shared question is how temporary pedagogical
authority is claimed, tested, granted, refused, and dissolved.

#### Hegelian family

Hegel's recognition concerns how self-conscious agents become determinate through
relations of independence, dependence, negation, struggle, and reciprocal
acknowledgment. The corresponding pedagogical figures include exact uptake,
recognition of authorship, reciprocal avowal, principled resistance, demand for
reasons, staging contradiction, role reversal, repair of misrecognition,
reciprocal revision, and recognition closure. Their shared question is how tutor
and learner become answerable co-authors without collapsing difference into
agreement.

The theories therefore act as **generative grammars** for figure families. They
suggest not one technique but a structured repertoire, internal relations among
the techniques, characteristic failure modes, and sequences by which one figure
can prepare, intensify, or repair another. This explains why a meso-level unit is
preferable to either tokens or whole characters: the theoretically meaningful
operation survives paraphrase but remains local enough to manipulate and test.

Theories do not validate their derived figures in advance. Philosophical depth or
sociological pedigree supplies hypotheses, contrasts, and interpretations—not an
effect estimate. Every figure still enters through the same admission procedure,
including treatment fidelity, alternatives, harm gates, crossed replication, and
human evaluation where the claim concerns learning or lived recognition.

This pattern can extend beyond Weber and Hegel. Socratic irony, Deweyan inquiry,
Freirean problem-posing, Vygotskian scaffolding, psychoanalytic transference, or
Goffmanian face-work can each be treated as a macro or mid-level source for a
bounded figure family. The research programme is therefore not an unstructured
catalogue of rhetorical devices; it is a comparative causal study of how major
theories of human formation become operational in pedagogical interaction.

### 2026-08-03 — Pedagogical dialogue games as lattice-like interactional programs

**Status:** Conceptual vocabulary and prospective operational model, not an
empirical claim.

The preferred meso-level unit is the **pedagogical dialogue game**. It lies above
the individual trope, rhetorical figure, or speech act, but below a global
discourse, pedagogy, or tutor character. A dialogue game coordinates multiple
moves across turns through roles, commitments, uptake conditions, permissible
responses, repairs, and ways of ending.

The game should not be represented as a fixed script, linear path, or hierarchy.
Its internal organization is better described as a **lattice-like interactional
program**: a branching and potentially cyclic structure in which moves can be
repeated, intensified, suspended, repaired, reversed, or recombined according to
what the learner does. Different routes may converge on the same relational
achievement, while the same opening move may lead to different continuations.

In operational terms:

- **nodes** represent learner, tutor, or relational states and available move
  positions;
- **edges** represent admissible pedagogical moves or transitions;
- **guards** test learner uptake, resistance, recurrence, safety, and context;
- **branches** select different continuations in response to those tests;
- **loops** support retry, deepening, rehearsal, rupture, and repair;
- **joins** allow distinct trajectories to converge on a shared state;
- **exits** record completion, refusal, deferral, transfer, or safe abandonment.

Here, *program* is useful as a software metaphor, provided it does not imply a
deterministic sequence. It names an executable organization of conditional
possibilities: a policy can interpret the program online, choosing the next move
from the current relational state rather than following one prescribed route.
Likewise, *lattice-like* is a topological metaphor rather than a claim that the
structure is a mathematical lattice; because repair and recurrence introduce
cycles, the implementation may be closer to a guarded state graph or recursive
program.

The resulting hierarchy is:

> macro-theory → family of pedagogical dialogue games → lattice-like
> interactional program → speech acts and rhetorical figures → particular
> utterances → learner uptake and relational effect

Recognition or charisma therefore cannot be reduced to a phrase, a singular
move, or one canonical sequence. Each is a possible relational achievement of
multiple coordinated trajectories. The empirical question is not whether the
tutor emitted the expected wording, but whether it navigated an admissible path,
responded to uptake, and produced the proposed benefit without unacceptable
harm.

#### Semi-formalism for relational effect engineering

The practical objective is a semi-formal language for describing how a tutor
works toward high-level constructs such as recognition, charismatic authority,
productive uncertainty, trust, seriousness, or intellectual courage. These
constructs should be represented neither as adjectives attached to a character
nor as properties of isolated utterances. They are **trace-level relational
effects**: patterns that may be achieved across a sequence of tutor moves,
learner responses, revisions, refusals, and repairs.

A pedagogical dialogue game can be represented provisionally as:

> **G = (S, M, T, U, C, R, X)**

where:

- **S** is a set of observable or inferred learner, tutor, and relational states;
- **M** is the available repertoire of speech acts, rhetorical figures, and
  compound pedagogical moves;
- **T** is the set of admissible transitions between states;
- **U** is evidence of learner uptake, resistance, refusal, revision, or transfer;
- **C** contains contextual, eligibility, safety, and recurrence conditions;
- **R** contains repair, reversal, de-escalation, and return-of-agency paths;
- **X** contains completion, deferral, failure, and safe-exit conditions.

The tutor's policy selects a move from the current partially observed state and
interaction history, then updates its course in light of uptake. A high-level
effect is specified as a condition over the resulting trace rather than as one
required route through the graph. Multiple branches can satisfy the same effect;
a superficially correct sequence can fail when uptake is absent; and a failed or
harmful move can trigger a repair loop rather than terminating the game.

In this qualified sense, the tutor becomes an **engineer of relational effects**.
It does not manufacture recognition or charisma unilaterally. It engineers and
tests the interactional conditions under which a learner may ratify, refuse, or
transform the proposed relation. Recognition and charismatic authority are
therefore co-produced achievements, while the tutor's controllable object is the
program of moves, observations, branches, and repairs offered to the learner.

This supplies a common representation for adding future constructs. Each new
construct requires: a trace-level definition; candidate dialogue games and move
families; observable uptake and failure signals; alternative routes; repair and
exit paths; and benefit and harm criteria. The harness can then compare not only
whether a particular move was delivered, but whether the adaptive program moved
the interaction toward the intended relational effect more reliably than simpler
fixed, random, scripted, or state-blind alternatives.

### 2026-08-03 — Dramaturgical extensibility: ensembles, role reversal, and character variation

**Status:** Repository-grounded architecture assessment plus prospective design,
not an established learning result.

The dramaturgical abstraction is genuinely useful for all three extensions, but
their readiness differs sharply. Character variation is already strong. Role
reversal is formally implemented but not wired as a live pedagogical role swap.
Multi-learner and multi-teacher interaction requires the largest runtime redesign.

#### 1. Multiple learners and teachers

An ensemble or cast extension is conceptually natural but not trivial in the
current runtime. `services/dramaticDerivation/engine.js` calls exactly one
`roles.director`, one `roles.tutor`, and one `roles.learner` in a fixed sequence.
`services/tutorStubSessionRuntime.js` treats ordinary non-command input as a
`learnerStep`. Learner DAG, cast state, and longitudinal character state are
singular.

The required ensemble seam includes:

- an `actors[]` registry with stable actor identifiers and current roles;
- `relations[]` plus a speaker and turn scheduler;
- per-actor state adapters and memory;
- shared group and scene state;
- visibility rules and private/public channels;
- addressed-recipient tracking;
- contribution and credit attribution;
- conflict and arbitration rules for multiple tutor policies; and
- individual and group outcome measures.

Multiple tutors also require authority allocation or specialization—for example,
challenger, explainer, and assessor—so they do not merely issue contradictory
moves. Reuse the director, action library, causal trace, and policy machinery behind
an ensemble-orchestration layer rather than forking a new engine.

#### 2. Tutor–learner role inversion

This is more than an idea in the repository. `BELIEF-DESIRE-DAG.md` defines role
reversal as bearer-index swap `R: T ↔ L` with director `D` fixed, and
`services/dramaticDerivation/beliefDesire.js` implements `reverse(subject)`.
`MACHINE-SPIRIT.md` also treats reversal as subject reconfiguration.

The honest boundary is equally explicit. `BELIEF-DESIRE-DAG.md` says the live
system is not symmetric: the learner DAG is reconstructed after the run, and there
is no learner-to-tutor model. `notes/poetics/drama-machine/ADAPTATION-MOVES.md`
marks `status_shift` or role reversal as **PARTIAL**. A live pedagogical reversal is
therefore close in formalism but not trivial in runtime.

A real reversal should swap pedagogical obligations and public role, not hidden
authority. The former learner may question, diagnose, or assess. The former tutor
must attempt, expose uncertainty, and accept correction. The director or evaluator
retains secrets, release authority, and adjudication.

This requires live symmetric belief, desire, and other-model state; role-scoped
permissions; a bounded reversal entry and exit contract; and outcomes such as
quality of explanation, diagnosis of tutor error, and transfer after teaching.

#### 3. Continual character variation

This is technically the strongest existing seam. `ADAPTIVE-TUTOR-CAST-LAYER-PLAN.md`
and `services/dramaticDerivation/castLayer.js` distinguish authored stable cast,
current cast state, relation, and bounded tutor reinvention. Reinvention changes
tone, figure, tempo, example style, and recognition act while forbidding changes to
proof control, and it carries explicit exit conditions.
`services/adaptiveTutor/characterState.js` tracks longitudinal learner development
across six axes.

Free continual variation is not scientifically trivial. Unbounded character change
creates combinatorial explosion, confounds character with model, move, and world,
and destroys the continuity needed for attribution.

Preserve this hierarchy:

1. actor and model identity;
2. pedagogical role;
3. stable character profile;
4. relation;
5. turn-local state or posture; and
6. bounded stance or reinvention.

Vary stable profiles across runs. Vary stance only at declared scene or act
boundaries with triggers, budgets, exit conditions, and trace records. Extend
reinvention symmetrically to learner stance only after validity work. Treat
character generation as a factorial or sampled design with held-out combinations,
not endless prompt improvisation.

#### Readiness

- **Character variation:** already feasible; requires stabilization and
  experimental discipline.
- **Role reversal:** formal engine exists; requires live symmetric role and
  authority wiring.
- **Multi-party teaching:** dramaturgically supported; requires an ensemble runtime
  layer plus new attribution and evaluation methods.

This is a promising generalization agenda because it tests whether the repository's
central unit is truly an **actor-in-relation**, rather than a hard-coded tutor and
learner pair.

### 2026-08-03 — Aristotelian dramatic effects: peripeteia and catharsis

**Status:** conceptual/classical refinement and prospective operationalization, not empirical repository evidence.

The user's intuition is right: **peripeteia** and **catharsis** sit above individual
utterances, rhetorical figures, and pedagogical moves. They name effects of the
organized drama as a whole—or of a substantial trajectory within it—produced here
through coordinated tutor direction and learner uptake.

In Aristotle's account, **peripeteia** is a reversal or change of the action into
its contrary, arising through the probable or necessary sequence of the plot. In a
pedagogical drama, it can name the trace-level turning point at which the learner's
strategy, standing, or relation to the problem changes: a formerly secure rule
becomes untenable; the learner becomes the examiner; the tutor yields public
authority; or a stalled exchange becomes an owned inquiry. It is not identical to
one `status_shift`, role-reversal cue, or forceful turn. A tutor or director can
stage its conditions, but the peripeteia exists only if the interaction actually
turns and that change persists. Aristotle often couples reversal with discovery or
recognition (*anagnorisis*); pedagogically, recognition may precipitate a reversal,
but the two should not be collapsed.

**Catharsis** is still more clearly a whole-drama effect. Aristotle describes
tragedy as effecting catharsis through pity and fear, but the precise meaning of
that claim is famously disputed. The project should therefore use the term
carefully, as a candidate participant-level affective and integrative effect across
a complete pedagogical episode: tension, exposure, conflict, or false confidence
is reorganized or released into owned understanding, restored agency, or a repaired
relationship. Catharsis is not a synonym for emotional intensity, satisfaction,
neat closure, or a model judge's approval.

Nor are these effects simply produced by the tutor acting on a passive learner.
The tutor or director can arrange the contradiction, timing, audience, stakes, and
repair path, but learner uptake and ratification co-produce the dramatic effect. A
useful analytical ladder is:

`utterance/form → pedagogical move → dialogue-game trajectory → peripeteia (structural reversal) → possible catharsis (participant-level affective/integrative effect)`

For operational purposes, evidence of **peripeteia** would require a preregistered
before-state and expected route; an identifiable contradiction, discovery, or
reversal event; a changed learner action, standing, or strategy; persistence into
later turns or transfer; and a counterfactual comparison. Evidence of **catharsis**
would require participant report or independent human observation of pre/post
tension and meaning, restored agency or trust rather than shame, appeasement, or
withdrawal, successful repair, and later transfer. Synthetic model judgments can
help locate candidate traces, but cannot establish the participant's lived effect.
Without human learners, catharsis remains an untested future-evaluation construct.
Peripeteia is the more immediately operationalizable of the two.

Architecturally, the pedagogical figure machine can stage candidate reversals, the
dialogue game can represent reversal branches, and the observer can assess whether
a trace-level turn occurred and what it cost. A domain-specific state adapter can
translate that turn into common transition evidence, while a later outcome-learning
policy could learn when such dramatic structures help. This places Aristotle's
terms at the level of **episode structure and consequence**, not in the catalogue of
local figures: pedagogical figures are instruments; peripeteia is a possible
structural transformation they jointly produce; catharsis is a possible
participant-level effect of the completed drama.

Primary text: Aristotle, *Poetics*, on [reversal and discovery
(1452a)](https://www.perseus.tufts.edu/hopper/text?doc=Perseus%3Atext%3A1999.01.0056%3Asection%3D1452a)
and on [tragedy and catharsis
(1449b)](https://www.perseus.tufts.edu/hopper/text?doc=Perseus%3Atext%3A1999.01.0056%3Asection%3D1449b).
