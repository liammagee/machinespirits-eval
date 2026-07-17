# The Preconscious Arc: Stock-Take and the Case for the Final Stretch

Date: 2026-07-13
Branch: `preconscious`, after the adaptive-tutor evidence merge (`c7a55986`) and PRs #121–#126.
Method: five parallel subsystem readers over PLAN_4_0, the tutor-stub cluster, the adaptive-state/kernel cluster, the root plan corpus, and the paper — plus direct reads of every dated PLAN_4_0 note. Successor to `PLAN_4_0/2026-07-10-preconscious-adaptation-review.md`; that review's findings are treated as settled and are not re-derived here.
Claim status: synthesis and proposal only. No new empirical claims — every number below traces to a committed artifact, a sealed run report, or a paper section, cited in place.

---

## 0. TLDR

The 2026-07-10 review found this branch at "instrument built, instrument audited, instrument found wanting in specific fixable ways." Three days later the position is materially different, in both directions:

**Better:** the four blockers were fixed and the repaired instrument immediately produced the arc's first real result — a policy × learner-profile interaction (rank crossings at fixed horizons) that **replicates in structure across two model families**, with a pre-declared success signature it matches. The learner population now genuinely discriminates (v3 contracts pass their gates on both stacks). The Green Room arc ran a pre-registered gate to a clean verdict and landed in the paper as §6.16 within a day. Provenance went from ad-hoc to sealed-lineage. This is a functioning laboratory now, not a pile of scripts.

**Worse — or rather, clearer:** the two mechanisms the branch was built to promote both hit walls of the familiar shape. The learner-state sensor, tested on the cleanest channel this project has ever constructed (deterministic, zero-call, kernel ground truth), came back *worse than no-state* — the richer the representation, the worse the prediction. And coached durable memory (the prompt book) failed its uptake gate at 18% against a 60% bar. Every internalizing mechanism — give the tutor a model, a field, a memory, a note — has now nulled on this branch, exactly as the paper's §7.11 law predicts.

**The verdict this document argues:** the "properly adaptive tutor" is neither an impossible dream nor the thing we have been building. It is realizable, but only in the sense the accumulated positives actually license — adaptivity as a property of the *loop* (checkable triggers, harness-owned signal, action-shaped delivery at the point of action, fitted per model), not of the tutor's interior. The dream as originally conceived — an inner model of the learner that drives generally better teaching — has been closed so many independent times, on both the old substrate and this new one, that continuing to fund it would be self-deception. The reframed goal is three to five decisive runs away, each already designed or nearly so, and it ends in a single capstone experiment that would convert the program's design law into its first composed positive.

---

## 1. Where things stand

### 1.1 What the branch has built (and what state it is in)

Two coupled workstreams plus a third that arrived mid-arc:

**The preconscious tutor stub** (`scripts/tutor-stub.js`, ~14.5k lines) — a standalone CLI tutor on the dramatic-derivation detective worlds. "Preconscious" names the pre-response stance-selection layer: each learner turn is LLM-classified, a tutor-side learner proof-DAG is deterministically maintained, and one of 11 register policies picks the tutor's stance *before* the tutor model writes the reply. Around it: the auto-eval harness (`scripts/run-tutor-stub-auto-eval.js`), the QA matrix with suites including `headroom` (`scripts/run-tutor-stub-qa-matrix.js`, now with `--interleave-policies` and `--pressure-turns`), v3 learner-profile contracts with a discrimination gate (`docs/tutor-stub-learner-profile-robustness.md`), the ABM persona panel, SQL ingest, the human discourse layer (scaffold, proof debt, side arcs, warrant stocktake — phases 1–6 built, `docs/tutor-stub-human-discourse-layer.md`), and the register-policy pipeline extracted verbatim into a testable service (`services/tutorStubRegisterPolicy.js` + composition + seeded sampler, PR #123).

**The field-theory runtime** (`services/dramaticDerivation/fieldPlanner.js`, `pedagogicalScripts.js`) — phases 1–5 of `PLAN_4_0/FIELD_THEORY_IMPLEMENTATION_PLAN.md` implemented: field objects, per-turn frames, scripts as objects, deterministic candidate-move projection, opt-in advisory/enforce planning, and the repaired `--field-report-context` placebo. Its evaluation gate is split: **Phase 6A** (non-acts feasibility, four arms, sealed canary→k5→k10 lineage, `scripts/run-derivation-phase6-gate.js` + `PLAN_4_0/PHASE_6_EVIDENCE_GATE_PLAN.md`) is implemented and **unrun in real mode**; **Phase 6B** (the true production comparison against hidden+proofDebt) is **blocked** — the planner reads learner-store state that acts mode redacts, so it cannot even enter the production configuration until an acts-safe reconstructed-state adapter exists.

**The adaptive-state benchmark** (merged in `c7a55986`) — a sensor-validity instrument: synthetic learner *kernels* with programmatic ground-truth latent state (`durableStateKernel`: ownership/confidence/engagement/misconception; `dropoutReadoptionKernel`: loss probability, readoption propensity, dropout snapshot — `services/adaptiveTutor/learnerKernels/`), projected through real worlds (marrick, hethel, ravensmark) by `worldAdapter.js`, observed through a channel that evolved v2.1 → v2.2 → v2.3 as each LLM-mediated version failed its own identifiability gates, ending in the fully deterministic zero-call **exact channel** (`PLAN_4_0/2026-07-12-adaptive-state-exact-channel-protocol-v2.3.md`). Policy-side scaffolding that would consume a validated sensor (`difficultyAwareBelief.js`, `scaffoldLifecycle.js`, `adaptationContract.js`) is built and unexercised.

**The Green Room** (`GREEN-ROOM-PLAN.md`, PR #121) — coach/notes/prompt-book apparatus, `--prompt-book-context` injection, Gates 0–1 executed with committed evidence (`exports/greenroom-gate1-2026-07-12/`).

Plus the provenance kernel that now underlies all of it: write-once plans, append-only events, sealed runs, parent/child seal chains, packaging and restore, fail-closed verification (`scripts/package-adaptive-run.js`, `scripts/verify-experiment-run.js`, `services/__tests__/experimentRunArtifacts.test.js` — workplan card `adaptive-eval-immutable-provenance`, done).

### 1.2 The evidence ledger

Ordered from most to least established. "Synthetic" throughout: simulated learners, no human-learning claim anywhere.

**Established (replicated or mechanically checked):**

1. **Register choice has outcome consequences, profile-dependently.** The hostile `negative` floor beat bland on both cognitive-failure profiles (+0.094/+0.096) and then grounded 0/3 on `affective_resistant` (worst delta −0.309). First outcome-channel separation on this substrate (headroom contrast, 60/60 rows, `PLAN_4_0/2026-07-10-phase6-gate-explainer-and-headroom-result.md`).
2. **The v3 learner population discriminates.** Pooled trace cosine 0.737 on terra (gate ≤0.85), and the best separation measured on any stack on Sonnet 5 (pooled 0.565); `affective_resistant` and `false_memory` pass full contract gates there. Contract recurrence floors are model-sensitive (proof_skipper misses its floor on Sonnet). The population is now a real instrument, and it caught its own earlier degeneracy (0.986 near-clones) — that catch remains one of the arc's most defensible products.
3. **The interaction structure replicates across two model families** (exploratory n=3 per cell, but the *structure* is a two-model result): policy rankings cross by profile at every fixed horizon; **bland leads the compliant `diligent` profile on both models**; some variation arm leads each stress profile at t16 on both models; and by until-grounded endpoint everything converges (the endpoint null was a catch-up artifact). `PLAN_4_0/2026-07-10-headroom-fixed-horizon-interactions.md`.
4. **The sensor negative.** On the exact channel — deterministic rendering, byte-exact fact atoms, zero model calls, kernel ground truth, sealed lineage — the canonical pilot stopped: lean DAG *worse* than no-state on both co-primary targets (log-loss deltas −0.5212 / −0.5013; Brier −0.0485 / −0.0674), DAG-trajectory and field-trajectory worse still, improvement in only one of three worlds and under neither held-out generator. Decision `do_not_run_canonical_s2`, `validated_winner: null`, policy optimization blocked. Meanwhile the S0 oracle checks confirm the latent signal *is there* — the kernels' hidden state predicts next events when read directly. The public-state representations fail to carry what the oracle carries. (`protocol-v2.3.md`, execution outcome + pilot outcome sections.)
5. **Coached durable memory does not change behaviour.** Green Room Gate 0 passed (craft-grade notes, owner-scored 5/5; the book curated *down*, v6 = 534/1800 tokens); Gate 1 failed at 3/17 scoreable notes improved (18% vs the 60% bar; placebo 0/2). Landed as paper §6.16. Diagnosis ranked: wrong channel (static system-prompt block vs per-turn advisories and the stance layer that never reads the book), wrong grain (notes are micro-programs requiring in-flight self-monitoring), trained priors beat standing instructions (`notes/2026-07-12-greenroom-gate1-diagnosis.md`).

**Exploratory (real but under-powered or single-condition):**

6. **Which arm wins is model-dependent.** Terra's best stress arm is `dynamic` (in-context register choice); Sonnet's are `field` and `negative`. `dynamic` does not transfer at all — worst policy on Sonnet by a wide margin (endpoint closure 0.083 vs bland 0.667; mean outcome 0.582 vs 0.830). The hand-coded `field` policy is the only arm never behind bland on terra *and* leading two stress profiles on Sonnet. Endpoint outcome still favors bland outright on Sonnet.
7. **Contingency without consequence.** The adaptive arms demonstrably condition register on state (field NMI ≈ 0.29–0.33), but all 20 policy × profile mean reward proxies are negative; every aggregate reads `consequence = not_established` (`PLAN_4_0/2026-07-11-adaptive-tutor-state-of-evidence.html`).
8. **Pressure-probe recovery instrument calibrated** (turn-6 face_threat probe fired in 20/20 cells; `dynamical_system` alone shows positive post-probe mastery movement at n=3 — calibration, not finding).

**Null / closed on this branch:**

9. The QA composite "adaptive wins" was a scoring artifact (0.14 diversity weight; fixed, regression-pinned). The register-router pre-registration: NOT CONFIRMED. The conduct-policy promotion family (A20/A21, selector v0–v4, ownership, didactic): closed valid negatives, hidden+proofDebt remains production, with "progress starvation" recorded as the concrete harm mode of diagnostic overlays without an opportunity-cost budget (`adaptive_tutor_closeout_with_harm_criteria.md`).

**Built and unrun / stalled:**

10. **Phase 6A**: sealed canary → k5 → k10 lineage machinery complete; no paid row exists (the historical Terra 60/60 is protocol-orphaned and non-promotable). ~60 dialogues, an attended quota day.
11. **The register confirmatory at n≥5** with v3 contracts, interleaving, and the probe: designed in the fixed-horizon note, pre-registerable today, unrun.
12. **UNRELIABLE-LEARNER-PREREG**: registered 2026-06-11, G2 gate satisfied, both paid runs superseded/stopped mid-flight, no verdict recorded. Notable because it is the follow-up to the *one load-bearing positive channel in the entire program* (§6.13.7's harness-owned unreliable-learner state, +0.49 per-slip repair).

### 1.3 The paper position

Paper v3.0.212 contains exactly one preconscious-arc result: §6.16 (Green Room, a null). The stub, register policies, the fixed-horizon interaction, the sensor negative, field theory, and Phase 6 do not exist in the paper yet. The relevant synthesis sections are already waiting for them: §7.11 states the program's design law ("instructions converge; only new signal accumulates"), and §7.9 scopes what adaptation nulls can and cannot mean. The short paper and slides stop at the §6.3 null and have absorbed none of the generative arc.

### 1.4 Provenance and infra

The sealed-lineage kernel is real and tested; the remaining debt is concentrated and known: the stub's engagement-stance draw still uses raw `Math.random()` (the seeded sampler covers policy draws only); the decisive tutor-stub artifacts live gitignored on one machine (`.tutor-stub-auto-eval/`), connecting to the standing consolidate-logs task; and the arc has already eaten one full provenance scare (every 2026-07-10 run before 12:56Z silently executed on `gpt-5.6-terra` instead of the requested `codex.gpt-5.5` — a child flag-forwarding bug, since fixed). The state-of-evidence audit grades tell the story compactly: architecture A−, instrumentation B+, run provenance D+, policy selection C, learner-state validity D, human efficacy untested.

---

## 2. The diagnosis: why every pathway yields increments

Reading this branch against the paper's full arc (§6.3 through §6.16), the incrementalism is not bad luck and not under-powering. The same five traps keep firing, and naming them precisely is what makes the final stretch designable.

### 2.1 The re-encoding trap

Mechanisms that hand the tutor a restatement of what the transcript already shows do nothing, at best. The paper counts five convergent in-paper negatives on the mechanism/signal axes (§6.7, §6.8.8, §6.9.7, §6.9.8, §6.10) plus the ToM-redundancy line (§6.8.5, §6.8.6, §6.10, §6.13.6), synthesized in §7.11. This branch added the sharpest instance yet: on a channel with *zero* language noise and *known* latent ground truth, DAG/trajectory/field representations predict next events worse than ignoring state altogether — while the oracle proves the signal exists. The re-encoding is not merely redundant; at this data size it is actively noise. The field planner's hand-coded constants ("mastery = held ? 1 : grounded ? 0.85 …") are the same class, one level up.

### 2.2 The endpoint trap

Until-grounded designs let slow policies catch up, and release-schedule floors saturate every arm at ceiling; both manufacture nulls. The frontier matrix (84 trajectories, everything grounded, bland "wins" on turn count) and the original headroom endpoint null both dissolved under fixed-horizon reanalysis. This is the branch-native reincarnation of the paper's level/rate confusion (§6.3): measure at the wrong time-scale and adaptation is invisible in both directions. The fix is now standard equipment: fixed horizons (t8/t12/t16), trajectory AUC, binding caps, engineered headroom.

### 2.3 The standing-prose trap

Text placed in the prompt changes what the model *says about* its conduct, not its conduct. A16's cumulative superego rewrites (d = −0.167), advisory conduct instruction (§6.13.3), and now the prompt book (18% vs 60%) — three independent instruments, one result. The Gate-1 diagnosis localizes it: the bottleneck is situation-*recognition at performance time*, not knowledge. The one in-repo architecture that reliably moves register-level behaviour — the id-director — replaces the whole persona per turn rather than amending it; and the paper's positive family (below) never delivers signal as standing prose.

### 2.4 The portability trap

Policies are fits, not truths. The winning stress arm flips between model families; `dynamic` — the "obvious" in-context solution — is terra's best and Sonnet's catastrophe; contract recurrence floors are model-sensitive; even the sensor's failure cell was realizer-specific (ravensmark × derive × Codex). Any claim of the form "this adaptation mechanism works" is implicitly indexed by model, and the program has repeatedly paid for forgetting the index. The flip side: the QA matrix, contracts, and priors fitter mean this project can *measure* a model's adaptation profile in a day — the instrument is model-portable even though the policies are not.

### 2.5 The self-scoring trap

The mechanism under test keeps ending up inside the score: the diversity weight that manufactured "field beats bland"; projectionAlignment marking a turn "directionally matched" if *any* of five quantities improved; the mock decay smoke where the enforce arm "won" by force-releasing (the adversarial-superego lesson: an override channel can force outcomes without any model of the learner). The branch has been unusually good at catching these — outcome-only scoring is now regression-pinned, the placebo arm is flag-distinct, gates are sealed — but the trap is permanent and each new metric needs the same audit.

### 2.6 What has ever worked — the positive family

Against those five traps, line up every positive the program has produced, paper-wide:

- **Criterial within-turn triggers** beat advisory instruction (§6.13.3–.5): a *checkable* condition with authority at the point of generation.
- **The pacing guard** grounds 5/5 where baseline fails — and its lift is *scheduling discipline*, not latent proof-state (§6.13.11).
- **The unreliable-learner channel** (+0.49 per-slip repair, §6.13.7): the harness *tells* the tutor something true it cannot infer — the program's only load-bearing explicit channel, i.e. genuinely new signal.
- **Format beats content** (§6.15): the same state that *loses* when disclosed raw (5.00 vs blind 6.75) *wins* when delivered as an action-shaped projection. Signal must arrive decision-ready.
- **Bounded policy-memory transfer** (A18.37, 10/14 held-out): memory helps exactly where a structural decoy is identifiable — a checkable situation again.
- **Composition is sub-additive for instructions** but a small kernel matches the full stack (§6.14) — instructions converge; and §7.11 predicts what should *not* converge: independent signals.
- On this branch: **register variation has real profile-contingent effects** (the actuator is live), and **the population instrument discriminates**.

One shape: **new signal, checkable trigger, action-shaped format, point-of-action delivery, fitted per model.** Every element has an independent positive precedent. No failed mechanism has all five properties; no successful one lacks more than one.

---

## 3. Impossible dream or realizable goal?

The question deserves a precise answer, and precision requires splitting "properly adaptive tutor" into the three things it has meant in this program.

### 3.1 Sense A: the inner-model tutor — dissolved, not impossible

The original dream: the tutor maintains a model of the learner (state vector, belief, field, persona, memory) and consults it to teach better in general. The program has now closed this from more directions than any other question it has asked: the five §6.9/§6.10 convergent negatives (policy-form axis *and* signal axis, both killed offline); the state-richness reversal (§6.8.6); four ToM-redundancy instruments; the A20/A21 conduct-policy closure ("we have built strong regulation, not adaptation"); the fitted and retrieval policy kill gates; Adaptation Plan 2.0's Stage 0 (inferring the concealed interior from the manifest transcript: R² below zero); and now this branch's exact-channel sensor pilot, where even with deterministic observation and programmatic ground truth, state representations subtract value. Logically none of this proves impossibility — the pilot's own scope note is careful, and the head/data-size confound is real and named. But a research program is not a logic exercise: at some point the accumulated evidence sets the prior, and the prior here says the next inner-model variant will null too. The rational move is to stop paying for variants and treat Sense A as *dissolved* — not "shown impossible" but shown to be the wrong decomposition of the problem.

### 3.2 Sense B: the adaptive loop — realizable, partially realized

Read the positive family again as a specification rather than a list of survivors. It describes a tutor that:

1. plays on a substrate whose endpoints are **mechanical** (grounded anagnorisis, coverage, release discipline) — built, this branch;
2. receives **harness-owned or interaction-surfaced signal** it cannot infer (the unreliable-learner channel; commitments on the public board; a fired probe) — one load-bearing positive exists, its decay-pressure follow-up is stalled mid-prereg;
3. is steered by **compiled, checkable triggers** at the point of action (criterial boundary; pacing guard; the stub already computes the trigger quantities — field velocity, DAG velocity, stagnation composite) — built, untested as a coaching channel;
4. gets its signal in **action-shaped format** (§6.15's brief) — law established, unapplied to the stub;
5. holds its **register floor fitted per model** (the cross-model contrast is the fitting instrument) — instrument built, confirmatory unrun;
6. and is evaluated at **fixed horizons on a discriminating population** with sealed provenance — built, this branch.

Nothing on that list is speculative. Every element is either already demonstrated somewhere in the program or built and awaiting one run. That is what "realizable" means concretely: the remaining distance is measured in pre-registered runs, not in missing ideas. Section 4 counts them: one zero-call study, three paid gates, one capstone.

It is worth saying plainly why this still deserves the name *adaptive*. The loop senses (triggers over surfaced state), selects contingently (register/conduct conditioned on the trigger), and its effects show up on an outcome channel it does not control, differentially by learner kind — which is the pre-declared definition the discrimination note froze before the data came in. What it refuses is the *locus* the dream assumed: none of the adaptive competence lives in a private model of the learner. It lives in the loop between the learner, the shared record, and a strong generator.

### 3.3 Sense C: the tutor that knows a person — out of scope, not closed

The full humanist dream — a tutor that knows *this* learner across weeks, reads moods, remembers growth — is not adjudicable on this substrate at all. Simulated learners are authored; their interiors are our own artifacts; longitudinal signal on this stack was already ruled unanswerable (the Line A closure: threading amplifies echo faster than memory). The two doors that remain are named in the paper and should stay named rather than smuggled into the arc: **human learners** (the A1 pilot machinery is engineering-complete and IRB-gated; the v2.3 protocol already specifies the parity bridge a live pilot would need) and **weight-level learning** (§7.9's bracketed residue — the only mechanism class that could in principle produce a per-turn rate, out of scope for a prompt-architecture study by construction). Sense C is the horizon, not the stretch.

### 3.4 The reframe the arc's own name was pointing at

There is a reading of "preconscious" on which this branch has been right all along, and it is worth making explicit because it dissolves the "as far removed as ever" feeling.

In the topographic model, the preconscious is not a homunculus that knows the subject — it is the layer where latent contents become *retrievable*: available to be spoken. The analytic method that goes with it never consists of the analyst privately computing a better model of the patient; it consists of arranging the *setting* — the frame, the timing, the well-placed intervention — so that what is latent surfaces into the shared record, where ordinary competence can work on it. Technique, not metapsychology.

Map that onto the evidence. Every internalizing mechanism (give the tutor a model/field/note) has nulled; every success externalizes — the public fact board, the harness-owned slip channel, the committed verdict (the character-development arc's structural mirror), the action-shaped brief, the criterial trigger that fires in the open. The two theory papers in this directory (`Towards_a_Field_Theory…`, `Dynamic_Learner_Fields…`) are not wrong so much as mis-assigned: the coupled fields are real, but their computational home is not tutor-internal estimation — it is the shared apparatus of the interaction: the board, the ledger, the schedule, the trigger machinery. The discourse field, FTAPI's "central novelty," which "neither learner nor tutor owns," is exactly the thing this project has been building all along without granting it the title: the harness.

And one more inversion, supplied by the branch's own instruments. The discrimination note observed in passing that *"learner discrimination is interactional. Some tutor policies reveal the difference between learners, while others make their traces converge."* The sensor benchmark, meanwhile, holds the tutor's action schedule **fixed by design** (six frozen actions, identical for every representation — necessary for comparability, fatal for informativeness). Put those together: **the sensor is a policy.** The program has been testing *passive* reading of a learner whose state only becomes visible under the right *moves*. No instrument in the entire program — old substrate or new — has ever tested active sensing: choosing the move partly for what it reveals. That is not another ablation; it is the one mechanism class the convergent negatives have never touched, and the kernel testbed can evaluate it for zero model spend.

So: not an impossible dream. A mis-specified one, now correctly specified — with one genuinely new lever left to pull and a composition wager to settle.

---

## 4. The final stretch: a decision-ordered program

Ordering principle: zero-call before paid; each step's outcome changes the value of the next; every paid run pre-registered, sealed-lineage, attended and checkpointed (quota-window discipline); explicit kill criteria throughout. This is a *stretch*, not a sweep — six steps, of which only three or four spend money, converging on one capstone.

### Step 0 — Close the provenance gap (days, free)

Finish what the sealed-lineage kernel started, because every later step inherits it: (a) seed the remaining `Math.random()` draw in the stub's engagement-stance path through `tutorStubPolicySampler`; (b) stamp commit + config hash into every tutor-stub run header (the QA-plan-overwrite and terra-flag incidents were both survivable only by luck); (c) `package-adaptive-run` the decisive artifacts (`headroom-contrast-n3-live`, `headroom-sonnet5-pressure-n3-live`, the sealed sensor runs) into the tracked evidence area or the private archive repo — the arc's empirical record currently rests on one working tree.

### Step 1 — The kernel testbed: decomposition audit + active sensing (a week, zero model calls)

Two zero-call studies on the exact-channel dataset and kernels, under a fresh prospective contract (v2.4) as the protocol demands:

**1a. The sanctioned P0 decomposition audit.** Quantify target predictability from action/task sequence alone, feature dimensionality and regularization effects, world-specific encoding, per-kernel failure modes. This settles whether the sensor negative is "state features carry nothing" or "144 transitions cannot support 30 features" — which changes everything downstream.

**1b. The value-of-information study (the new lever).** The kernels are programmatic: for any public history, the posterior over latent kernel state under each candidate tutor action is *computable*. Freeze a contract that asks: (i) how much does each of the six action families reduce posterior entropy over the latent state, per world × kernel? (ii) does an information-optimal action schedule — probing allowed — make a lean representation beat no-state where the fixed schedule could not? (iii) is there an information/pedagogy trade-off (do revealing moves cost progress), and is it profile-dependent?

Kill criteria, frozen in advance: if even oracle-guided probing cannot separate the kernels through the public channel, the sensor program **closes on this substrate** with a boundary-grade negative (the public record under-determines the latent state under *any* policy — a clean, publishable characterization of the concealment boundary). If probing works, active sensing graduates to a paid test and becomes the design input for the Phase 6B reconstructed-state adapter. Either outcome is a section, not a shrug.

### Step 2 — The register confirmatory (the one mintable claim; ~2 attended days)

The fixed-horizon note already specifies it; freeze and run it: **primary endpoint = coverage at learner turn 16, policy × profile interaction**, v3 contracts, `{bland, field, negative}` × four profiles × n=5 × both model families (terra + Sonnet), deterministic interleaving, the turn-6 pressure probe in every arm, outcome-only scoring, sealed lineage. Retire `dynamic` from claim-bearing arms — its non-transfer is already a two-model result and it costs a fifth of the budget; keep it, if at all, as a documented negative comparator on one stack. Pre-commit the interpretation: bland leading `diligent` is part of the predicted interaction signature, not a failure; the claim under test is the crossing, not "adaptive beats bland everywhere."

This either mints the program's first replicated, adequately-powered adaptation positive — *profile-contingent mid-dialogue gains from register selection, at a claimable n, on two model families, on a mechanical endpoint that escapes the §7.9 slope-proxy critique* — or it closes the register-policy line with the strongest instrument the arc has. Both outcomes land in the paper. This is the single highest-value paid run available.

### Step 3 — Phase 6A as a kill test, conditional and cheap-first (1 attended day, only if wanted)

Run the sealed lineage exactly as designed — excluded route canary, then k=5 — and stop there for a decision before k=10. Frame it for what it now is: with the sensor null, 6A is an **actuator test under privileged sensing** (the non-acts planner reads true board state). If, even reading the truth, deterministic move-planning cannot clear the material-improvement bar against baseline *and* report-only, then Phase 6B is moot forever and the field planner retires alongside its theory docs — with the useful residue that the field *reporting* machinery survives as instrumentation. If k=5 clears, complete k=10 for the narrow promotable claim. Do not run 6A before Step 2; if budget forces a choice, Step 2 wins outright (its claim is broader and its instrument newer).

### Step 4 — The point-of-action coaching test (side-coaching + compiled constraints; new prereg, ~1–2 attended days)

The Green Room diagnosis handed the program its most precise remaining question: the failure is the last inch between written insight and enacted policy, and the bottleneck is situation-recognition at performance time. Attack it exactly where the positive family says to: **move recognition out of the actor.** Four arms on the stressed profiles: (i) no coaching; (ii) the failed channel as placebo — the same notes as a standing book; (iii) **compiled constraints** — the note's trigger condition implemented mechanically over quantities the stub already computes ("after two re-glosses, force a hold" as a register-policy constraint); (iv) **side-coaching** (the plan's reserved cell-206 concept) — the note delivered mid-performance at the moment its trigger fires, action-shaped per §6.15, with the detector doing the recognition and the tutor only complying. Compliance denominators dense by design (constrain coaching to high-frequency predicates).

This is where the whole program's positive family converges — criterial trigger, point-of-action delivery, action-shaped format, new (situational) signal — so it carries the clearest theory-stakes of any single run: if (iv) fails while its trigger demonstrably fires, the insight-action gap is generation-intrinsic on this model class, which is a first-class boundary result. If it works, the loop has its coaching channel.

### Step 5 — Finish what is already registered (days, cheap)

Complete `UNRELIABLE-LEARNER-PREREG` per its amendments (arms superseded mid-flight; G2 already satisfied; no verdict recorded). It tests whether the program's one load-bearing explicit channel stays load-bearing under fact-decay pressure. A registered experiment with passed gates and no verdict is exactly the kind of loose end that later reads as motivated stopping — close it in either direction.

### Step 6 — The capstone: the assembled-tutor gate (the composition wager)

After Steps 1–5 resolve, compose **only validated elements** into one configuration: the small instruction kernel (§6.14), criterial guards where their geometry matches (§6.13.11–.13's cartography), the harness-owned slip channel (§6.13.7, as Step 5 leaves it), the per-model register floor (as Step 2 leaves it), point-of-action coaching (as Step 4 leaves it) — and pre-register the wager the whole paper has been building toward: **signal-composition is not sub-additive.** §6.14 showed instructions converge; §7.11 predicts independent signals should accumulate. Run assembled-vs-bland on the stressed population, fixed horizon, n≥5, both families, sealed. 

This is the breakthrough-shaped experiment, and it is falsifiable in both directions: if the assembled tutor beats strong-bland where the components individually did, the program ends with a composed, mechanism-understood, two-model adaptive tutor — the realizable dream, delivered. If composition sub-adds even for signals, the §7.11 law needs an amendment the field should hear about. Either way the arc *ends*, on evidence.

### What NOT to do (the foreclosed list, so the stretch stays a stretch)

No new register-policy variants before Step 2 reads out; no representation-ladder rungs before the Step-1a audit; no v2.2 reruns or Ravensmark prompt-tuning; no prompt-book retry (successors must change channel or grain, per the no-tune-and-retry rule); no LLM-read "model the interior" variants (closed offline, twice); no fitted/retrieval state→action policies (closed, five-way convergent); no new worlds except as a specific step requires; no Phase 6B work before Step 1b says the reconstructed-state adapter has something to reconstruct *from*.

### Budget shape

Steps 0–1: free. Step 2: ~120 dialogues across two families. Step 3 (conditional): ~24 then ~36 more. Step 4: ~60–80. Step 5: small. Step 6: ~80–120. Total on the order of five to seven attended quota days spread over the steps' natural sequencing — comparable to what the branch has already spent on exploration, but every run claim-bearing.

---

## 5. What lands in the paper

Single-paper discipline; nothing here proposes a spin-off. The natural landing:

- **A new §6.17** (title on the pattern of the existing arc: "The Preconscious Layer: Register Policies, the State Sensor, and Adaptation as Loop Property") carrying: the instrument (stub, v3 population, fixed-horizon methodology), the replicated interaction structure + model-dependence result, the sensor negative on the exact channel, and — as Steps 2/4/6 read out — the confirmatory results. The Green Room §6.16 already anchors the section sequence.
- **§7.11 gains its corollary**: not just "only new signal accumulates" but *signal must be action-shaped and delivered at the point of action, and selection layers are model-indexed* — each clause now multiply evidenced.
- **§7.9 gains a sentence**: the fixed-horizon mechanical endpoint is the first in-claim-set instrument that measures adaptation outside the slope-proxy regime, in both directions (it found the crossing the slope missed, and it still finds no unconditional adaptive win).
- Workplan: `tutor-stub-multiworld-policy-replication` unblocks as Step 2; `tutor-stub-learner-state-validity` absorbs Step 1; `field-planner-phase6-gate` becomes Step 3 with its conditional framing; a fresh card for Step 4 (side-coaching successor, referencing the Green Room closeout); `tutor-stub-transition-reward-model` stays blocked pending Step 1.

---

## 6. Bottom line

The feeling of being "as far removed as ever" is the feeling of watching the sixth or seventh beautiful mechanism die on a clean instrument. It is accurate about the mechanisms and wrong about the distance. What this branch actually did — while the mechanisms were dying — was finish the laboratory: a discriminating learner population, mechanical endpoints at the right time-scale, cross-model harnesses at every seam, sealed provenance, and a stack of pre-declared success signatures. Against that laboratory, the first genuinely replicated structure has already shown up (the crossings), the genuinely new lever is identified and free to test (active sensing on the kernels), the sharpest diagnosis in the program is one experiment from resolution (point-of-action coaching), and the whole thing converges on a capstone wager that would either deliver the adaptive tutor in its defensible form or amend the program's own law informatively.

The dream as first dreamed — the tutor with the learner inside it — is over, and the evidence deserves the credit for ending it. The goal as the evidence has re-specified it — the adaptive loop, assembled from validated parts, proven where it matters (stressed learners, fixed horizons, two model families) — is not just realizable; it is about five pre-registered runs away, and the first two cost nothing.
