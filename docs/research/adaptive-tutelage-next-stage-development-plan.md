# Follow-up Plan for Next Stages of Development, updated for paper v3.0.152

**Project:** *Geist in the Machine* / adaptive tutelage mechanisms  
**Updated:** 2026-06-13  
**Purpose:** Convert the updated manuscript findings into a staged research-and-development roadmap.  
**Guiding claim:** Adaptive LLM tutoring should be developed as **auditable conduct governance over a stateful pedagogical task**, not as unsupported inference about the learner's inner state.

---

## 0. What changed since the previous plan

The previous plan treated Marrick/world-005 as the immediate next test. The updated manuscript reports that test as complete. This changes the roadmap.

### 0.1 Marrick is now a completed boundary result

The forked AND-join world decoupled visible uptake from latent proof distance. Results:

| Arm | Result | Interpretation |
|---|---:|---|
| Baseline | 0/5 grounded | The world is hard under the p4 conduct stack. |
| Visible/page-only guard | 0/5 grounded | Visible uptake is not sufficient when page and proof decouple. |
| Hidden proof-state guard | 5/5 grounded | Depth-aware pacing sees the open branch and holds to the join. |

The visible guard was not merely inert. It regularized the failure into a consistent tempo-starved death one turn before the join. The lesson is therefore not "visible guards are useless." It is:

> Visible guards are geometry-conditional projections. They work when visible uptake faithfully tracks latent proof progress; they fail when a world lets a learner look locally seated while a hidden branch remains open.

### 0.2 The adaptation-elaboration path is mostly closed

Several recent arcs converge negatively:

- richer learner profiles do not outperform lean state;
- bilateral ToM elaboration adds no measurable within-family discrimination;
- evidence-bound hypothesis tracking creates useful audit traces but does not improve the pedagogical outcome channel;
- learned policy selection fails the offline kill gate;
- concealed-interior modeling fails because the logged "hidden" LLM deliberation is not a privileged latent variable;
- adaptation-vs-compliance is not reliably annotatable at revision-event granularity.

The resulting development rule is:

> Do not keep adding interior state. Add checkable structure at the point of action.

### 0.3 A7 longitudinal adds a new, bounded hypothesis

Across eight sessions with persistent Writing Pad state, recognition arcs rise while base arcs degrade. The cleanest reading is ego pre-alignment with superego principles, not increased conflict volume. The result is promising but small-N and caveated by midstream bug fixes and run-order issues.

Roadmap implication: add a clean longitudinal validation stream, but do not treat A7 as a settled human-learning or durable-adaptation result.

### 0.4 Id-director/charisma becomes a separate branch

The id-director family shows a real performative-register axis:

- c104 is strongest on v2.2/recognition-quality;
- c105 is strongest on charisma;
- c107 is a promising generalist at lower N;
- scenario effects dominate the large persona-shift lift;
- learner uptake of charisma is unmeasured because the corpus is mostly scripted-learner/tutor-only.

Roadmap implication: charisma is worth a separate uptake study, but it should not be fused into the main adaptive-tutoring mechanism claim.

### 0.5 The central next artifact is now a dynamic guard compiler

The strongest next engineering target is:

```text
WorldSpec -> GuardSpec -> RuntimeMonitor + AuditSuite
```

The guard generator should compile auditable, inspectable guard specifications from formal world structure. It should not let a live LLM invent new guard logic online.

---

## 1. Updated priority map

| Priority | Workstream | Status after v3.0.152 | Main output |
|---:|---|---|---|
| P0 | Claim hygiene and paper tightening | Immediate | Short manuscript patch list |
| P1 | Dynamic guard compiler | New central target | WorldSpec -> GuardSpec compiler and audit suite |
| P2 | Cross-world guard-isolation matrix | Upgraded from old P1 | Failure-mode table across linear, forked, distractor, and decay worlds |
| P3 | Visible-proxy validation protocol | New after Marrick | Hidden-reference vs visible-projection agreement report |
| P4 | Human validation of process taxonomy | Still needed | Human-coded superego taxonomy and revision validity report |
| P5 | Evaluation stack hardening | Still needed | Human/LLM/mechanical judge calibration report |
| P6 | Longitudinal pre-alignment study | New after A7 | Clean repeated-session test with fixed pad/consolidation path |
| P7 | Critic-source ladder | Still useful, lower priority than guards | Error-correction externality study |
| P8 | Charisma uptake branch | New, separate | Learner-receptivity instrument and id-director uptake study |
| P9 | Human learner pilot | Still the learning bridge | Pre/post/delayed human learning study |
| P10 | Minimal reproducible testbed | Still essential | Public dramatic-derivation conduct benchmark |

---

## 2. P0: Claim hygiene and manuscript tightening

### Goal

Make sure the paper's prose now matches the updated evidence, especially after the Marrick, adaptation-null, and id-director additions.

### Immediate edits

1. **Soften the opening passive-learner claim.** Classic ITS and learning sciences are not simply passive-transfer paradigms. Target generic answer-delivery LLM tutoring instead.
2. **Qualify Hegelian descent language.** Use "intersubjective / constructivist / dialogic pedagogical orientation" for the family. Reserve stronger Hegelian genealogy for Dewey, Vygotsky, Honneth, and explicitly recognition-theoretic education work.
3. **Replace any lingering "conditional emergence" wording for adaptive responsiveness.** The main result is a clean null. A7 is across-session and exploratory/directional; it is not within-dialogue recognition-modulated adaptation.
4. **Keep id-director as architectural extension.** It is not part of the three-mechanism core. It shows a separate performative-register axis and a Pareto frontier.
5. **Add runtime-enforcement literature to related work.** The dramatic-derivation guards should be positioned alongside LLM-agent runtime monitors and shields, not only ITS.
6. **State the Marrick boundary in the abstract/conclusion if space allows.** The paper now has both sides of the hidden-vs-visible boundary: lantern positive, Marrick negative.

### Runtime-enforcement references to add

Use these as adjacent literature for Section 2 or a short new subsection after proof tutors:

- AgentSpec: runtime enforcement for LLM agents via structured triggers, predicates, and enforcement mechanisms.
- ShieldAgent: trajectory-level policy compliance for LLM agents using verifiable safety-policy reasoning.
- AGrail: adaptive safety-check generation and optimization for agent guardrails.
- Aegis: synthesis of lightweight, permissive runtime shields for neural policies.
- ProbGuard: proactive runtime monitoring for long-horizon LLM-agent safety.
- Microsoft Agent Governance Toolkit: engineering signal that deterministic runtime governance for agents is becoming practical infrastructure.

Suggested paragraph:

> The dramatic-derivation guards also connect to a newer runtime-enforcement literature for LLM agents. AgentSpec specifies agent constraints as triggers, predicates, and enforcement mechanisms; ShieldAgent verifies action trajectories against explicit policies; AGrail explores adaptive safety-check generation; and runtime-shield synthesis work such as Aegis treats intervention policies as synthesized, permissive monitors. Our guards differ in domain and objective: they enforce pedagogical release, repair, and pacing constraints over a proof-world trajectory rather than security constraints over tool actions. The shared point is methodological: reliable agent conduct is obtained not by richer exhortation alone but by checkable runtime structure.

---

## 3. P1: Dynamic guard compiler

### Research question

Can guard logic be generated from formal world structure in a way that is conservative, auditable, non-leaky, and cross-world reusable?

### Target architecture

```text
WorldSpec
  -> WorldIR
  -> GuardSpec
  -> RuntimeMonitor
  -> AuditSuite
```

Do not use:

```text
Dialogue so far -> LLM invents guard code online
```

The live LLM can help name failure classes, propose candidate visible features, or summarize audit reports. It should not author executable guard logic on the critical path.

### Difficulty estimate

| Generalization target | Difficulty | Current verdict |
|---|---:|---|
| Reuse hand-written guard templates across same-schema worlds | 3/10 | Refactor-level work. |
| Compile hidden proof-state guards from proof DAG and schedule | 5-6/10 | Feasible and now highest priority. |
| Compile visible/page-only guards | 7-8/10 | Research problem because proxy validity is world-dependent. |
| Online dynamic guard invention during a run | 8-9/10 | Unsafe except for certified parameter selection. |
| Open-domain human tutoring without formal task state | 9/10 | Requires domain modeling, not only guard code. |

### WorldIR schema

Normalize each dramatic-derivation world into a shared intermediate representation:

```yaml
world_id: string
entities: []
facts: []
inference_rules: []
secret_target: predicate
proof_graph:
  nodes: []
  edges: []
  joins: []
minimal_proofs: []
release_exhibits: []
release_calendar: []
stall_rule: {}
decay_model: {}
corruption_model: {}
learner_visible_state: {}
tutor_visible_state: {}
harness_hidden_state: {}
```

### Generated GuardSpec

The compiler should emit inspectable JSON/YAML, not opaque code. Example:

```yaml
guards:
  hidden_pacing:
    objective: avoid_tempo_starvation
    inputs: [proof_distance, decay_stall, release_ledger]
    actions: [hold, release, ask_diagnostic]
    non_leak: true

  proof_debt:
    trigger:
      released: true
      proof_critical: true
      absent_or_corrupted: true
      restore_lowers_D: true
    expose_to_tutor: [premiseId, surface, sinceTurn]
    forbid: [raw_board, corruption_ledger, proof_path, secret, D_arithmetic]
    actions: [restore_before_new_work]

  visible_projection:
    candidate: true
    features:
      - turns_since_release
      - learner_echo_of_current_exhibit
      - hedging_or_gap_markers
      - branch_coverage_surface_markers
      - unresolved_join_language
    validation:
      compare_to_hidden_reference: true
      fail_closed_to_hidden: true
```

### Compiler modules

1. **Proof-criticality analyzer**
   - marks each exhibit as proof-critical, branch-local, join-blocking, distractor, or optional;
   - computes whether restoration would lower proof distance;
   - maps minimal proof paths and alternative paths.

2. **Corridor mapper**
   - computes earliest safe, latest useful, and fatal-early release regions;
   - flags where the licensed calendar is wider than the safe corridor;
   - emits safe/unsafe release cells for replay.

3. **Branch/join analyzer**
   - detects AND-joins and branch-coverage requirements;
   - computes when local uptake can falsely imply global readiness;
   - marks worlds where visible projection is likely unsafe.

4. **Guard policy compiler**
   - emits hidden pacing, proof-debt, decay hygiene, repetition watcher, and finale-discretion rules;
   - keeps policies template-based and parameterized by WorldIR.

5. **Visible-proxy compiler**
   - generates a candidate projection from transcript-visible features;
   - compares candidate decisions against the hidden guard on replay/simulation;
   - marks projection as certified, uncertified, or unavailable.

6. **Audit generator**
   - creates import-fence tests, prompt non-leak tests, positive controls, detector-split tests, and hidden-vs-visible agreement tests.

### Non-leak requirements

Every generated guard must pass:

- no proof-distance arithmetic in tutor-visible text;
- secret predicate never supplied to tutor;
- raw learner board never supplied to tutor;
- proof path never supplied to tutor;
- corruption ledger never supplied to tutor;
- restore view limited to already released premise id, surface, and since-turn;
- positive control proving the harness ledger contains the hidden arithmetic that the tutor did not see.

### Runtime behavior

At runtime, the monitor should be allowed to:

- hold a release;
- license a release;
- license a restore;
- ask for a diagnostic if visible and hidden signals disagree;
- escalate from visible projection to hidden guard when projection confidence is below threshold;
- log every decision with inputs, allowed view, action, and non-leak proof.

It should not:

- rewrite guard predicates online;
- reveal proof distance or proof paths;
- let the tutor infer the secret from guard explanations;
- treat visible-proxy failure as a tuning problem without a topology analysis.

### Deliverables

- `guard-compiler-spec.md`
- `world-ir-schema.yaml`
- `guard-spec-schema.yaml`
- `guard-compiler-report-world-002-lantern.md`
- `guard-compiler-report-world-005-marrick.md`
- `guard-non-leak-audit.md`

---

## 4. P2: Cross-world guard-isolation matrix

### Research question

Which guard removes which failure class, and what residual failure does it expose?

### Why this matters now

Marrick shows that hidden pacing and visible pacing can diverge sharply. The next stage should stop asking whether "a guard" helps and instead ask which guard has which signature across which world geometry.

### Worlds to include

| World shape | Purpose |
|---|---|
| Linear chain | Reproduce lantern: visible uptake aligned with proof distance. |
| Forked AND-join | Reproduce Marrick: visible uptake decoupled from global proof distance. |
| Distractor-heavy graph | Tests same-surface decoys and false restores. |
| Early-met constants | Exercises the staged-pool positive side not yet observed. |
| Late-decay world | Exercises decay hygiene and proof-debt timing. |
| Multi-join graph | Tests whether branch/join analyzer scales beyond one fork. |

### Arms

| Arm | Description | Main mechanism |
|---|---|---|
| Baseline | No guard | Natural conduct prior |
| Hidden pacing only | Proof-state release pacing | Scheduling discipline with hidden reference |
| Visible pacing only | Page-state release pacing | Public proxy discipline |
| Proof-debt only | Restore released critical premises without pacing | Common-ground/proof-state repair |
| Hidden pacing + proof-debt | Strong current stack | Scheduling + repair |
| Visible pacing + proof-debt | Deployable-ish public stack | Public scheduling + repair |
| Visible with hidden escalation | Visible first, hidden if projection uncertified | Hybrid safety |
| Placebo reminder | Extra attention with no proof-state content | Controls for added friction |
| Random legal delay | Holds randomly inside legal window | Tests whether slowness alone helps |

### Failure taxonomy

Track at least:

- grounded;
- tempo-starved / early-pull death;
- decay-seating death;
- wrong-branch overfocus;
- premature join;
- visible-uptake false positive;
- false restore;
- late-finale compression;
- learner disengagement unrelated to proof state;
- guard leak / invalid run.

### Primary analysis

Use detector-split tables by world and arm. Success-rate estimates are secondary at small k. The primary claim is failure-mode relocation.

### Decision rules

| Pattern | Interpretation | Next action |
|---|---|---|
| Hidden succeeds, visible fails | Visible proxy unavailable or uncertified for that geometry. | Compile hidden guard or add branch-aware visible evidence. |
| Hidden and visible both succeed | Page carries enough signal. | Certify visible projection for that geometry. |
| Hidden fails | Guard compiler missing world constraint. | Inspect corridor and branch/join analyzer. |
| Proof-debt only helps | Repair more important than pacing in that world. | Add debt-first policy variant. |
| Placebo helps | Friction/tempo is a confound. | Add stronger placebo and random-delay controls. |

---

## 5. P3: Visible-proxy validation protocol

### Research question

When can a visible/page-only guard replace a hidden proof-state guard?

### Core rule

A visible guard should be certified only when replay shows high agreement with the hidden reference on the relevant world distribution. Marrick shows why: a visible guard can intervene often and still be wrong because the page feature it acts on is not faithful to the hidden topology.

### Validation stages

1. **Hidden reference compilation**
   - compile hidden pacing/proof-debt guard from WorldIR;
   - treat this as the reference policy.

2. **Visible feature proposal**
   - generate candidate features from transcript-accessible signals;
   - include topology-aware public signals where available, such as branch labels explicitly named by the learner.

3. **Replay agreement test**
   - compute hidden-vs-visible agreement on hold/release/restore decisions;
   - report false releases, false holds, false restores, and missed debts.

4. **Counterfactual stress test**
   - construct adversarial transcript states where local uptake is high but global branch coverage is incomplete;
   - require the visible guard to fail closed or declare uncertainty.

5. **Certification decision**
   - certified: visible projection agrees with hidden reference above threshold and no catastrophic false-release class appears;
   - uncertified: visible projection useful but unsafe alone;
   - unavailable: world geometry prevents faithful projection.

### Proposed thresholds for first pass

| Metric | Suggested threshold |
|---|---:|
| Hold/release agreement with hidden guard | >= 0.90 |
| Catastrophic false-release rate | 0 in registered stress set |
| False-restore rate | 0 in registered stress set |
| Non-leak tests | 100% pass |
| Detector-split improvement over baseline | Directionally positive, but not sufficient alone |

### Manuscript payoff

This turns the hidden-vs-visible story into a general method:

> Visible adaptivity is not assumed; it is certified as a projection of hidden task state when the world makes that projection faithful.

---

## 6. P4: Human validation of superego and revision taxonomies

### Research question

Do human expert coders agree with the LLM-generated critique taxonomy and revision labels?

### Why it remains necessary

The process-level story still depends on LLM-classified critiques and revisions. The inter-LLM kappa baseline is useful, but human validation is needed before strong process-tracing claims.

### Procedure

1. Use deterministic stratified sampling across critique categories, conditions, models, and outcomes.
2. Blind human coders to condition, model, and LLM label.
3. Code:
   - critique category;
   - revision type: substantive, partial, cosmetic, harmful, resistance;
   - whether the critique is pedagogically valid;
   - whether the revision actually addresses the critique.
4. Compute human-human kappa, human-LLM kappa, LLM-LLM kappa, per-category F1, and confusion matrices.
5. Collapse or retire unstable categories.

### Updated caution after Section 6.12

The attempted persuasion/conformity/instability distinction is not reliably annotatable under the attempted setup. Do not force this distinction into the main taxonomy unless a redesigned codebook clears a reliability gate.

### Acceptance rules

| Result | Action |
|---|---|
| Human-human kappa >= 0.60 | Keep taxonomy with category caveats. |
| Human-human kappa < 0.60 | Collapse categories or use coarser labels. |
| Human-LLM much lower than LLM-LLM | Treat automated classifier as provisional only. |
| Specific category F1 < 0.60 | Retire or merge category. |

---

## 7. P5: Evaluation stack hardening

### Research question

Which claims survive when LLM judges, human judges, mechanical checkers, and simulated learners disagree?

### Evidence stack

| Evidence type | Use | Limitation |
|---|---|---|
| Mechanical checker | Formal grounding, release legality, proof debt | Formal worlds only |
| LLM judges | Scalable tutor-quality comparisons | Bias, calibration drift, recursive evaluation |
| Human expert judges | Pedagogical quality and taxonomy validity | Cost, lower N |
| Human learners | Learning, transfer, retention | Requires IRB/design overhead |
| Simulated learners | Controlled stress probes | Authenticity limits |

### Immediate tasks

1. Freeze a gold transcript set across conditions, worlds, and quality bands.
2. Human-score the same transcripts with the v2.2 rubric and a coarser holistic rubric.
3. Estimate LLM-human agreement by dimension.
4. Test position bias using randomized pairwise order.
5. Test verbosity sensitivity with length-normalized variants.
6. Report within-judge effects separately from absolute calibration.

### Updated emphasis

The paper's strongest formal claims do not depend on LLM judges because they are checker/detector based. The tutor-quality and process-taxonomy claims do depend on judges. Keep these evidentiary channels separate.

---

## 8. P6: Clean longitudinal pre-alignment study

### Research question

Does recognition produce durable cross-session improvement through ego pre-alignment with superego principles?

### Why add this

A7 Phase 2 suggests recognition arcs can improve over repeated sessions while base arcs degrade. But the study was small and affected by bugs/restarts. It should be rerun cleanly before any strong longitudinal claim.

### Design

| Feature | Recommendation |
|---|---|
| Sessions | 8-12 ordered sessions per learner identity |
| Conditions | Base vs recognition, with and without Writing Pad |
| Learners | Simulated first, then human pilot if stable |
| Models | At least two generation models |
| Judges | At least two independent judges plus mechanical/text proxies |
| Primary outcome | Per-session tutor-quality slope and delayed learner-performance proxy |
| Secondary outcomes | Pad-message overlap, cross-session references, learner continuity, token cost |

### Required fixes before rerun

- Verify recognition orchestrator integration.
- Verify Writing Pad consolidation under local timezone and UTC.
- Freeze run-order handling.
- Pre-register how failed/resumed sessions are handled.
- Do not use moment-count as the primary recognition proxy.

### Decision rules

| Pattern | Interpretation |
|---|---|
| Recognition slope positive, base slope negative | Supports pre-alignment across sessions. |
| Both positive | Longitudinal practice or memory helps independently of recognition. |
| Recognition improves tutor but not learner | Keep tutor-production boundary. |
| Human learners show retention/transfer gains | Begin cautious human-learning claim. |

---

## 9. P7: Critic-source ladder

### Research question

Is the superego genuinely external error correction, or structured self-critique?

### Design

| Arm | Critic source | What it tests |
|---|---|---|
| No critic | Single-agent baseline | No correction |
| Same-prompt self-critique | Ego reviews itself | Intrinsic self-correction |
| Same-model separate superego | Current architecture | Separate-context critique |
| Different-model critic | Independent model prior | Externality by model family |
| Mechanical/domain oracle | Checker or answer key | Reliable external feedback |
| Human/expert critic sample | Gold-standard critique | Human ceiling |
| Random plausible critique | Critique-shaped friction | Placebo revision effort |

### Outcomes

- initial output quality;
- final output quality;
- critique validity;
- revision magnitude;
- harmful revision rate;
- failure classes caught/missed;
- cost per point of improvement.

### Updated role in roadmap

This remains useful, but it is now lower priority than dynamic guards because the guard work has produced clearer mechanism-level movement than the critic-source question.

---

## 10. P8: Charisma uptake branch

### Research question

Does id-director charisma produce learner uptake, or only judge-visible tutor performance?

### Why this is separate

Weberian charisma is conferred by the other. The current id-director corpus mostly measures tutor performance under scripted/unified learners and lacks learner interiority or a receptivity index. That means the charisma mechanism is only half-instrumented.

### Required new instrument

Build a learner-side receptivity/legitimacy-conferral rubric with dimensions such as:

- uptake of tutor's invitation;
- willingness to grant authority;
- self-positioning in relation to the tutor's call;
- resistance or deflation;
- reflective transformation;
- suspicion of performance/manipulation.

### Study arms

| Arm | Purpose |
|---|---|
| c101 baseline id-director | Substrate baseline |
| c104 classifier + recognition | Best v2.2 cell |
| c105 charisma-tuned | Best charisma cell |
| c107 witness exemplars | Generalist cell |
| fixed-prompt recognition tutor | Non-id comparison |
| human-authored tutor sample | Human reference if available |

### Scenario design

Oversample the condition where c104's lift appeared:

- morally ambiguous vulnerability disclosures;
- sympathetic vulnerability disclosures;
- skeptical pushback;
- open invitation;
- learner resistance to charisma.

### Decision rules

| Pattern | Interpretation |
|---|---|
| Tutor charisma rises but learner receptivity does not | Charisma is performed, not conferred. |
| c105 wins tutor charisma but c104 wins learner uptake | Recognition moderates charismatic authority. |
| c107 generalizes best | Exemplars supply useful register without overfitting. |
| Human raters reject charismatic moves as manipulative | Add ethical constraint before further deployment. |

---

## 11. P9: Human learner pilot

### Research question

Do the mechanisms that improve tutor conduct and formal derivation outcomes improve human learning, retention, or transfer?

### Domain choice

Use a domain where task state is inspectable but learning is real:

- propositional logic proofs;
- algebra transformations;
- causal graph reasoning;
- introductory programming debugging;
- conceptual physics with misconception inventories.

Logic/proof tutoring remains the cleanest bridge because it connects the formal derivation apparatus to proof-tutor literature and mechanical checking.

### Arms

| Arm | Description | Mechanism |
|---|---|---|
| A | Standard single-agent LLM tutor | Baseline chatbot |
| B | Intersubjective prompt only | Calibration |
| C | Intersubjective prompt + superego | Calibration + error correction |
| D | Intersubjective prompt + hidden guard stack | Conduct governance |
| E | Intersubjective prompt + certified visible guard, if available | Public-proxy governance |
| F | Expert-authored scaffold / ITS if feasible | Non-LLM benchmark |
| G | Practice-only or reading control | Minimum control |

### Measures

- pretest;
- immediate posttest;
- delayed posttest;
- near transfer;
- far transfer;
- time on task;
- hint dependence;
- productive-struggle markers;
- learner affect and autonomy;
- proof explanation quality, not only final correctness.

### Primary outcome

Learning gain and delayed transfer. Tutor quality, satisfaction, and engagement are secondary.

### Stop/go rules

| Result | Action |
|---|---|
| Tutor-quality gain but no learning gain | Keep conduct-output framing; inspect over-helping. |
| Learning gain only with guard stack | Prioritize stateful conduct governance. |
| Prompt-only matches guard stack | Use cheaper calibration-first systems outside formal domains. |
| Hidden guard beats visible guard | Visible proxies need certification before human deployment. |
| High variance by prior knowledge | Add mastery gating or learner-stratified guards. |

---

## 12. P10: Minimal reproducible conduct testbed

### Goal

Make the apparatus publishable as a reusable benchmark rather than a one-off internal harness.

### Minimal package

- one linear proof world;
- one forked AND-join proof world;
- one distractor-heavy world if ready;
- world schema;
- guard schema;
- hidden pacing guard;
- visible projection guard;
- proof-debt guard;
- detector-split script;
- non-leak audit script;
- baseline and guarded transcripts;
- claim-ledger examples;
- reproduction commands for lantern and Marrick tables;
- non-claims document.

### External-facing framing

Use a name like:

- **LLM Tutor Conduct Testbed**
- **Dramatic Derivation Harness**
- **Pedagogical Guard Benchmark**

Avoid names implying solved adaptivity or human-learning proof.

---

## 13. Dynamic guard generation: implementation phases

### Phase 1: Static schema and replay

- define WorldIR;
- port lantern and Marrick into WorldIR;
- implement replay over archived arms;
- ensure detector-split reproducibility.

### Phase 2: Hidden guard compiler

- compile proof-criticality map;
- compile release corridors;
- compile branch/join constraints;
- compile proof-debt triggers;
- reproduce hand-written hidden guard results on lantern and Marrick.

### Phase 3: Visible projection compiler

- generate visible-feature candidates;
- replay against hidden reference;
- certify lantern-like geometries;
- mark Marrick-like geometries as visible-proxy unavailable unless a branch-aware visible feature passes.

### Phase 4: Runtime monitor

- enforce hold/release/restore decisions;
- log every guard decision;
- expose only licensed tutor-visible view;
- run import and prompt non-leak tests.

### Phase 5: Audit suite

- non-leak tests;
- positive controls;
- counterfactual replay;
- hidden-vs-visible agreement;
- false-release and false-restore stress tests;
- mutation testing of world specs;
- regression tests for rendering/provenance bugs.

### Phase 6: Cross-world evaluation

- run k-fans across world family;
- use detector-split tables as primary outputs;
- publish guard-support matrix.

---

## 14. Updated decision tree

```text
Start
 |
 |-- Tighten paper claims
 |     |
 |     |-- Runtime-enforcement literature added
 |     |-- Passive-learner and Hegelian-genealogy risks softened
 |
 |-- Build dynamic guard compiler
 |     |
 |     |-- Hidden compiler reproduces lantern/Marrick -> proceed
 |     |-- Hidden compiler fails -> fix WorldIR/corridor/branch analyzer
 |
 |-- Validate visible projection
 |     |
 |     |-- Agrees with hidden on world -> certify visible guard for that geometry
 |     |-- Disagrees catastrophically -> mark visible unavailable; use hidden/hybrid
 |
 |-- Run cross-world guard-isolation matrix
 |     |
 |     |-- Failure classes move predictably -> strengthen mechanism claim
 |     |-- Guards improve only aggregate rates -> revise taxonomy/instrument
 |     |-- Placebo/random delay explains gains -> rethink pacing mechanism
 |
 |-- Human-validate taxonomy and judges
 |     |
 |     |-- Reliable -> keep process claims
 |     |-- Unreliable -> collapse taxonomy and re-run analysis
 |
 |-- Human learner pilot
       |
       |-- Learning and transfer improve -> cautious human-learning extension
       |-- Tutor conduct improves only -> maintain output/conduct boundary
```

---

## 15. Near-term checklist

1. Patch manuscript wording around passive-transfer rhetoric, Hegelian descent, and adaptive-responsiveness null.
2. Add a runtime-enforcement paragraph to related work.
3. Freeze the dynamic guard compiler design document.
4. Implement WorldIR for lantern and Marrick.
5. Compile hidden guards from WorldIR and reproduce existing hand-written results.
6. Implement visible-proxy replay against hidden reference.
7. Mark Marrick visible projection as failed/unavailable under unchanged page-only features.
8. Design at least one branch-aware visible candidate and test it only as a candidate projection.
9. Build non-leak audit generation into every GuardSpec.
10. Register the cross-world guard-isolation matrix before new paid/backend runs.
11. Send human taxonomy packet to coders.
12. Create the gold transcript set for judge validation.
13. Draft clean A7 longitudinal rerun protocol.
14. Create charisma uptake rubric, but keep it separate from the main mechanism paper.
15. Extract minimal conduct testbed package.

---

## 16. Strongest next-stage claim if P1-P5 succeed

> We show that adaptive LLM tutoring can be compiled into auditable conduct controls over formal task state. Classic ITS supplies the instructional principles; runtime-enforcement and shield-synthesis work supplies adjacent agent-governance vocabulary; our contribution is a pedagogical mechanism harness that compiles and audits release, repair, and pacing guards, then tests which failure classes they move. Visible transcript proxies can be certified where they faithfully project hidden task state, but Marrick shows they are not universal. Human learning remains a separate validation target.

---

## 17. External literature checked for this update

- AgentSpec: Customizable Runtime Enforcement for Safe and Reliable LLM Agents. arXiv:2503.18666.
- ShieldAgent: Shielding Agents via Verifiable Safety Policy Reasoning. arXiv:2503.22738.
- AGrail: A Lifelong Agent Guardrail with Effective and Adaptive Safety Detection. ACL 2025.
- Aegis: Synthesizing Efficient and Permissive Programmatic Runtime Shields for Neural Policies. arXiv:2410.05641.
- ProbGuard: Probabilistic Runtime Monitoring for LLM Agent Safety. arXiv:2508.00500.
- Microsoft Agent Governance Toolkit, 2026 runtime security governance for agents.
- LeanTutor: Towards a Verified AI Mathematical Proof Tutor.
- TutorGym: A Testbed for Evaluating AI Agents as Tutors and Students.
- Bastani et al., Generative AI without Guardrails Can Harm Learning, PNAS 2025.

