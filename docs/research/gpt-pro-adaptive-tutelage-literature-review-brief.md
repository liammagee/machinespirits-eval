# GPT Pro Literature Review Brief: Adaptive Tutelage Mechanisms

**Companion file:** `docs/research/paper-full-2.0.md`
**Prepared:** 2026-06-13
**Status:** Review packet, not a new empirical source of truth.

This brief is intended to be reviewed alongside the canonical manuscript,
`paper-full-2.0.md`. Its purpose is to help GPT Pro compare the project results with
existing literature in AI tutoring, intelligent tutoring systems, multi-agent LLM
architectures, self-correction, process tracing, and educational theory.

The canonical paper remains the source of truth for empirical claims. If this brief
and the paper disagree, use the paper. If a claim here is not traceable to the paper
or the listed artifacts, treat it as a question for review, not as a result.

---

## 1. Review Task for GPT Pro

Please review `paper-full-2.0.md` and this brief as a package.

Primary task:

> Compare the reported adaptive-tutelage mechanisms with the existing literature.
> Identify the closest antecedents, the strongest novelty claims, the overclaim risks,
> missing citations, and the additional experiments needed before these results can be
> positioned as a general theory of adaptive tutoring or as evidence of human learning.

Recommended output:

1. **Literature map:** Which existing literatures already contain close analogues?
2. **Novelty assessment:** What is genuinely new here, if anything?
3. **Claim audit:** Which project claims are well supported, directional, premature, or
   too broadly phrased?
4. **Citation audit:** Which papers, traditions, or terms should be added to the
   related-work section?
5. **Theory translation:** How should the project describe its contribution in language
   familiar to ITS, learning sciences, process-tracing, and LLM-agent audiences?
6. **Next-study design:** What would be required to move from formal derivation results
   to claims about actual learning?

---

## 2. Core Takeaway to Test Against the Literature

Compared with asking a single LLM tutor to teach, the research points toward a
stateful pedagogical control loop:

- define a target inference or proof state;
- track what has actually been released, seated, lost, or corrupted;
- pace evidence so the learner is neither starved nor prematurely led;
- repair dropped proof-critical material before advancing;
- separate tutor generation from tutor governance;
- log the mechanism traces so failures can be classified by kind, not only by final
  score.

The current strongest interpretation is not that the tutor "understands the learner's
mind." It is that adaptive tutoring can be engineered as **disciplined conduct over a
stateful task representation**: release, wait, repair, and advance only when the
available evidence can carry the next step.

This should be compared carefully with older ITS concepts such as model tracing,
knowledge tracing, step-level scaffolding, mastery gating, constraint-based tutoring,
Socratic tutoring, hint sequencing, productive failure, and AutoTutor-style dialogue
management. A likely literature-sensitive framing is:

> The project reimplements some classic ITS commitments inside an LLM-agent setting,
> but adds a traceable multi-agent and guard-based apparatus for testing which control
> mechanisms actually change formal derivation outcomes.

That framing may be more defensible than claiming an entirely new kind of adaptive
tutoring.

---

## 3. What Is Established in the Main Paper

### 3.1 Paper 2.0 mechanism story

The main paper's broad mechanism result is already larger than the dramatic-derivation
arc:

- Recognition-oriented or intersubjective-pedagogy prompts improve tutor output
  quality mainly through **calibration**.
- Ego-superego architecture supplies **error correction**, with model-dependent
  residual value.
- Recognition-modulated **adaptive responsiveness** is not supported as a general
  mechanism: the primary trajectory analysis is null, and the A12 replication retires
  the earlier exploratory boundary-condition effect.
- A10/A10b reframes the active ingredient from specifically Hegelian vocabulary to the
  broader **intersubjective-pedagogy orientation** shared with constructivist and
  relational pedagogical traditions.

These claims are in `paper-full-2.0.md`, especially Sections 1, 3, 6.1-6.4, 7.9-7.10,
and 8.

### 3.2 Dramatic-derivation arc

Section 6.13 asks a narrower question: can a tutor govern its own conduct in a formal
derivation setting where a secret conclusion is derivable only after staged evidence?

The staged derivation apparatus supplies:

- a formal world with a proof DAG and a secret conclusion;
- a release calendar for premise exhibits;
- a checker that knows when the learner's board forces the conclusion;
- decay/corruption channels that can remove or distort already released material;
- transcript-level artifacts that let failures be audited.

The important result is not just "some runs grounded." It is that specific guard
mechanisms moved specific failure classes:

- unguarded runs often died by **early-pull tempo starvation**;
- pacing guards removed that early-pull failure mode;
- proof-debt repair converted a later **decay-starved** arm to grounded recognition;
- visible/page-only pacing matched hidden proof-state pacing on the lantern world,
  indicating that the pacing lift came from scheduling discipline, not necessarily
  hidden state.

These results are formal derivation outcomes, not human learning outcomes.

---

## 4. Evidence Ledger

Use this ledger to check every claim back to a source artifact.

| Claim area | Current evidence | Source |
|---|---|---|
| Main recognition / calibration / error-correction claims | Multi-run, multi-judge results in Paper 2.0 | `docs/research/paper-full-2.0.md` Sections 6.1-6.4 |
| Adaptive responsiveness as recognition-modulated mechanism | Primary null plus A12 failed replication | `docs/research/paper-full-2.0.md` Sections 6.3 and 6.3.8 |
| Intersubjective-pedagogy family framing | A10/A10b and later response-level mechanism analysis | `docs/research/paper-full-2.0.md` Sections 7.9-7.10 |
| Dramatic derivation as formal conduct-governance apparatus | Staged derivation world, proof checker, release calendar, decay and repair mechanisms | `docs/research/paper-full-2.0.md` Section 6.13 |
| Corridor narrower than release license | Pure-computation corridor map; lantern corridor 32% at same-turn adoption | `exports/dramatic-derivation/boundary/corridor-map-world-002-lantern.md`; Paper Section 6.13.10 |
| Tutor deviations are early, anti-aligned with safe corridor | Conduct miner over archived real arms | `exports/dramatic-derivation/boundary/conduct-parameters.md`; Paper Section 6.13.10 |
| E2 hidden pacing guard | 4/5 grounded, directional only; zero early pulls; one decay-seating death | `exports/dramatic-derivation/boundary-e2/detector-split-report.md`; Paper Section 6.13.10 |
| E5 proof-debt guard | One paid arm converted E3 decay-starved failure to grounded t20; no second paid arm | `ADAPTIVE-TUTOR-BOUNDARY-PLAN.md`; `exports/dramatic-derivation/loop/lantern-e5-proof-debt-real-r1/`; Paper Section 6.13.10 |
| Visible/page-only pacing guard | 5/5 grounded; visible guard matched hidden guard; hidden-signal account rejected for lantern pacing | `exports/dramatic-derivation/boundary-v-fan/detector-split-report.md`; Paper Section 6.13.11 |
| Guard x failure-mode shift | Unguarded 4 grounded / 6 early-pull; hidden pacing 4 grounded / 1 decay-seating; visible 5 grounded / 0 early-pull / 0 decay-seating | `exports/dramatic-derivation/boundary-v-fan/detector-split-report.md`; Paper Section 6.13.11 |
| Marrick / world-005 generalization | World instantiated and pre-registered; corridor 30.4% at lambda 0; full baseline/H/V fan not complete in the committed record | `config/drama-derivation/world-005-marrick.yaml`; `ADAPTIVE-TUTOR-GENERALIZATION-PLAN.md`; `exports/dramatic-derivation/boundary-marrick/corridor-map-world-005-marrick.md` |
| Human learning | Not established; human learner pilot infrastructure exists, but human-learning validation remains pending | Paper Section 8.1; project pilot infrastructure |

---

## 5. Claims That Need Literature Stress-Testing

### 5.1 "Adaptive tutelage" versus classic ITS

The current project language emphasizes adaptive tutelage, conduct governance,
proof-state hygiene, and stateful pedagogical control. GPT Pro should compare those
terms with established ITS vocabulary:

- model tracing;
- knowledge tracing;
- constraint-based modeling;
- mastery learning and gating;
- step-level scaffolding;
- hint sequencing and feedback timing;
- Socratic tutoring;
- cognitive tutors;
- productive struggle / productive failure.

Review question:

> Is the project rediscovering known ITS control principles in LLM-agent form, or does
> it add a new mechanism-level evaluation method that older ITS work did not have?

Likely bounded answer:

> The control principles have strong antecedents; the novelty is the combination of
> LLM-agent tutoring, explicit ego/superego generation, formal derivation worlds,
> guard-level ablations, transcript artifacts, and failure-mode process tracing.

### 5.2 Pacing guard as scaffolding discipline

The visible pacing result says the model did not need hidden proof-state to pace the
lantern chain. A page-only proxy worked because visible uptake tracked latent proof
distance in that world.

Compare with:

- Vygotsky's zone of proximal development;
- VanLehn's step-level scaffolding;
- AutoTutor work on responding to confusion;
- ICAP and engagement-based learning theories;
- productive failure and the timing of assistance.

Review question:

> Is "scheduling discipline" simply a restatement of well-timed scaffolding, or does the
> formal release-calendar / proof-DAG apparatus add a useful measurement contribution?

### 5.3 Proof-debt repair as model tracing or constraint repair

The proof-debt guard detects when an already released, proof-critical premise has
decayed, then exposes only the released exhibit id/surface so the tutor can restore it.

Compare with:

- model-tracing tutors that maintain an ideal solution path;
- theorem-proving or proof-tutor systems that check proof state;
- constraint-based tutors that detect missing or violated constraints;
- dialogue systems that repair common ground.

Review question:

> Should "proof-debt guard" be translated into established ITS language such as
> model-state repair, common-ground repair, or constraint repair?

Important caveat:

> The E5 result is a single stacked arm. It shows that adding proof-debt repair on top of
> the E3 pacing guard converted one decay-starved failure. It does not isolate
> proof-debt guard alone.

### 5.4 Multi-agent ego/superego architecture

The broader paper studies tutor ego/superego architecture as a way to introduce
externalized critique into tutor generation.

Compare with:

- self-correction literature showing intrinsic self-correction can degrade without
  external feedback;
- Reflexion and verbal self-feedback systems;
- Constitutional AI and critique-revision loops;
- multi-agent debate, role specialization, and reviewer/writer architectures;
- educational multi-agent tutoring frameworks.

Review question:

> Does the tutor superego function as meaningfully external feedback, or is it best
> understood as a structured self-critique prompt? What evidence would distinguish those?

### 5.5 Process tracing for LLM systems

The paper claims a methodological contribution: adapting process tracing to AI systems
by building systems whose internal agent exchanges are logged and whose mechanisms can
be classified.

Compare with:

- Bennett and Checkel / Beach and Pedersen process tracing;
- causal mediation analysis in NLP;
- mechanistic interpretability;
- agent-level trace analysis in LLM systems;
- LLM-as-judge evaluation and its reliability limits.

Review question:

> Is this "process tracing" in a defensible social-science sense, or should the paper
> use a narrower term such as engineered trace analysis, agent-level mechanism tracing,
> or causal-process logging?

### 5.6 Recognition theory and intersubjective pedagogy

The paper now argues that the active ingredient is not Hegelian vocabulary specifically
but a broader intersubjective-pedagogy orientation. GPT Pro should compare this with:

- recognition theory in education;
- Freirean dialogical pedagogy;
- Buber, Noddings, Honneth, and relational pedagogy;
- constructivism and sociocultural learning theory;
- transmission/behaviorist traditions as contrast cases.

Review question:

> Is "intersubjective-pedagogy orientation" the right umbrella term, or does existing
> learning-sciences vocabulary provide a better name?

---

## 6. Claim Boundaries to Preserve

The review should preserve these boundaries unless it finds strong reason to change
them.

### Established or strongly supported

- Recognition-oriented / intersubjective-pedagogy prompts improve judged tutor output
  quality in the studied apparatus.
- Calibration and error correction are the two supported general mechanisms in Paper
  2.0.
- Recognition-modulated adaptive responsiveness is not supported as a general
  mechanism in the main paper.
- In lantern-style formal derivation, release timing matters: early release can starve
  the proof path despite being locally responsive.
- Guarded pacing changes the failure-mode profile by removing early-pull deaths in the
  lantern world.
- Visible/page-only pacing matched hidden proof-state pacing on the lantern world.

### Directional, bounded, or underpowered

- The E2 hidden pacing guard result is directional: 4/5 grounded, but confidence
  intervals remain wide and Fisher against the frozen 4/10 baseline is not definitive.
- Failure-mode shift is more stable than success-rate estimation at current sample
  sizes.
- The proof-debt result is one stacked arm, not a guard-alone isolation.
- Marrick/world-005 is calibrated and registered, but the full generalization fan is
  ongoing and should not yet be treated as a completed result.

### Not established

- That these mechanisms improve human learning.
- That the learner's actual mental state is read.
- That the guard stack generalizes across domains, proof shapes, models, learners, or
  human classrooms.
- That visible pacing will suffice when visible uptake and latent proof distance come
  apart.
- That the LLM-as-judge rubric captures long-term learning, transfer, or durable
  understanding.

---

## 7. Current Ongoing Work

The next live generalization target is `world-005-marrick`, a branching AND-join proof
world designed to decouple visible uptake from latent proof distance. The plan registers
three k=5 fans:

- baseline: `marrick-real-r1` through `marrick-real-r5`;
- hidden pacing guard: `marrick-guard-r1` through `marrick-guard-r5`;
- visible pacing guard: `marrick-visible-r1` through `marrick-visible-r5`.

The world has been instantiated and corridor-mapped:

- survival corridor: 30.4% at lambda 0 and lambda 1;
- 22.4% at lambda 2;
- shape: two independent subchains that must converge through an AND-join.

As of this report, the completed paper claim is the lantern visible-guard result in
Section 6.13.11. The Marrick fan should be treated as ongoing until all registered arms
land and the detector-split report is regenerated.

---

## 8. Suggested GPT Pro Review Questions

Use these as explicit prompts during review.

1. **Closest precedent:** Which prior ITS systems already implement something equivalent
   to release pacing, proof-state repair, or stateful learner modeling?
2. **Terminology:** Is "adaptive tutelage" useful, or should the paper align with
   "adaptive instructional systems," "intelligent tutoring systems," "model tracing,"
   or another established term?
3. **Mechanism novelty:** Is the novelty in the mechanism, or in the evaluation
   apparatus that makes the mechanism testable in LLM tutoring?
4. **Theoretical placement:** Does the recognition/intersubjective-pedagogy framing add
   explanatory value beyond constructivist or relational pedagogy?
5. **Methodological validity:** Does the process-tracing analogy hold, given that the
   agent deliberations are generated text rather than human cognitive records?
6. **Metric risk:** Which conclusions depend too heavily on LLM-as-judge scoring?
7. **Formal-world risk:** Which conclusions are artifacts of proof-DAG worlds rather
   than tutoring generally?
8. **Missing literature:** Which literatures should be added before publication?
9. **Human pilot bridge:** What design would connect the formal mechanism results to
   human learning without overclaiming?
10. **Framing recommendation:** What is the strongest cautious claim the paper can make?

---

## 9. Strongest Cautious Claim

A defensible claim for external review is:

> In a formal derivation tutoring apparatus, single-agent LLM tutoring is improved not
> simply by asking the model to be a better tutor, but by adding stateful conduct
> controls: evidence pacing, proof-state repair, and auditable failure classification.
> On the lantern world, both hidden proof-state and page-only pacing guards eliminate
> early-pull failures, and a proof-debt guard repairs a later decay-starvation failure.
> These results support adaptive tutelage as a guardable control problem over a
> stateful pedagogical task, while leaving human learning, cross-world generality, and
> long-term transfer as open work.

This is intentionally narrower than:

> The system has solved adaptive tutoring.

or:

> The tutor reads the learner's mind.

Those broader claims are not supported.

---

## 10. What to Attach for Review

Attach or provide paths to:

- `docs/research/paper-full-2.0.md`
- `ADAPTIVE-TUTOR-BOUNDARY-PLAN.md`
- `ADAPTIVE-TUTOR-GENERALIZATION-PLAN.md`
- `exports/dramatic-derivation/boundary/corridor-map-world-002-lantern.md`
- `exports/dramatic-derivation/boundary/conduct-parameters.md`
- `exports/dramatic-derivation/boundary-v-fan/detector-split-report.md`
- `exports/dramatic-derivation/boundary-marrick/corridor-map-world-005-marrick.md`
- selected run folders under `exports/dramatic-derivation/loop/`, especially:
  - `lantern-e2-guard-r1` through `lantern-e2-guard-r5`;
  - `lantern-e2-visible-r1` through `lantern-e2-visible-r5`;
  - `lantern-e5-proof-debt-real-r1`.

For literature checking, also inspect:

- `docs/research/references.bib`
- `docs/pedagogical-taxonomy.md`
- `exports/a10-prompt-density-control.md`
- `exports/a10b-orientation-family.md`
- `notes/d1-paper-integration.md`

---

## 11. Do-Not-Overclaim Checklist

Before accepting any suggested literature comparison, check:

- Does it preserve the formal-vs-human-learning boundary?
- Does it distinguish the main Paper 2.0 tutor-quality results from the later
  dramatic-derivation results?
- Does it avoid treating a stacked-arm result as a guard-alone isolation?
- Does it avoid treating k=5 fans as converged rate estimates?
- Does it state that visible pacing has only been shown sufficient on the lantern world?
- Does it mark Marrick/world-005 as ongoing until the full fan lands?
- Does it distinguish tutor conduct governance from learner mental-state inference?
- Does it identify older ITS antecedents rather than presenting classic scaffolding
  principles as new?

If a proposed external comparison passes those tests, it is likely safe to fold into
the paper as framing or related-work discussion. If it introduces a new empirical claim,
add it to `paper-full-2.0.md` first or leave it out.
