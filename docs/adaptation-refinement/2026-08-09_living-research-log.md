# Living Research Log

**Date:** 9 August 2026  
**Session:** Adaptation as Normative Revision  
**Status:** Working research record

## Summary

Today's discussion marked an important shift in emphasis.

Rather than asking *how can we make the tutor adapt?*, the project increasingly asks:

> **How can adaptation itself become an explicit computational object that can be inspected, evaluated, and improved?**

This appears to be the next stage of the project.

## Observation 1 — Refinement, not reinvention

The project already contains extensive work on adaptive triggering, evaluation, learner-state modelling, policy/governance, pedagogical ontologies, adaptive moods, negative registers, and evaluation rubrics.

Future work therefore needs to begin by distinguishing itself from prior approaches rather than rediscovering them.

**Working principle:** novelty now comes from careful refinement, instrumentation, and synthesis rather than simply adding another adaptation mechanism.

## Observation 2 — Negative registers as stress tests

Negative registers such as sarcasm, irony, and challenge are not the research object in themselves.

They are useful because they are conspicuous interventions: they make a shift in tutor stance easy for a human evaluator or another model to detect.

The deeper research object is the adaptive process that licenses such an intervention.

**Hypothesis:** negative registers are best understood as stress tests for whether the tutor can identify a conversational problem, determine that ordinary repair is failing, and make a warranted shift in pedagogical stance.

## Observation 3 — Normative and descriptive trajectories

A central distinction emerged between:

- **Normative dialogue:** the trajectory the lesson expects or licenses.
- **Descriptive dialogue:** the trajectory that actually occurs.

Adaptation may be better understood as responding to divergence between these trajectories rather than reacting directly to surface learner behaviour.

The learner repeating themselves, giving one-word answers, resisting an explanation, or failing to show uptake are not merely behavioural labels. They can be treated as evidence that the actual interaction is diverging from an expected conversational trajectory.

## Observation 4 — Existing Lesson DAG as normative spine

The existing Lesson DAG already provides a normative conceptual structure: conceptual progression, clue ordering, dependencies, and expected lesson movement.

The immediate architectural question is whether this DAG can be given richer semantics rather than replaced.

### Required audit

Before new implementation:

- identify what the DAG currently represents;
- identify the semantics carried by nodes and edges;
- distinguish explicitly represented semantics from semantics left to the frontier model;
- determine whether the new proposal is an extension, reinterpretation, or genuinely separate computational object.

## Observation 5 — Pedagogical figures and registers

Pedagogical figures appear to sit at a more abstract level than linguistic register.

A tentative hierarchy is:

```text
Pedagogical problem
        ↓
Pedagogical figure
        ↓
Register / linguistic device
        ↓
Utterance
```

A pedagogical figure captures an interactional orientation or organized sequence of moves used to solve a pedagogical problem.

Register is one way in which that figure becomes linguistically visible.

Possible registers or devices include humour, irony, sarcasm, directness, metaphor, analogy, challenge, and reassurance.

This distinction should be checked against the ontology and terminology introduced in recent PRs, especially PR 617.

## Observation 6 — Commitments, warrants, and entitlements

Robert Brandom's vocabulary of **commitments**, **warrants**, and **entitlements** may provide useful formal language for the layer that is currently missing.

The problem is not simply to classify learner state.

It is to represent what conversational moves are currently licensed, what prior commitments support them, and what new evidence would warrant revision.

This makes the proposed layer normative rather than merely descriptive.

## Observation 7 — Model revision rather than hidden state

Prior attempts at explicit learner-state modelling have often failed to outperform strong frontier-model behaviour.

A potentially sharper object of instrumentation is therefore not hidden learner state but **commitment revision**.

Important questions become:

- What is the tutor committed to doing now?
- What evidence supports that commitment?
- What conversational developments undermine it?
- What alternative move becomes licensed?
- When does a register or figure change become warranted?

## Observation 8 — A shadow interpretation of dialogue

The conversation suggested maintaining an explicit computational interpretation that shadows the natural-language dialogue.

This should not become a duplicate conversation or an elaborate simulated mental state.

Instead, it would selectively represent information needed for adaptation:

```text
Dialogue
   ↓
Interpretation
   ├── commitments
   ├── warrants / entitlements
   ├── expected trajectory
   ├── observed trajectory
   ├── divergence
   └── current pedagogical figure
```

This representation should be inspectable, revisable, and evaluable.

It may ultimately be implemented by enriching existing graph semantics rather than creating a wholly separate graph.

## Observation 9 — Divergence is multidimensional

Divergence should probably not be reduced to a single scalar.

It should be both:

- **quantified:** how substantial or persistent is the divergence?
- **qualified:** what kind of divergence is occurring?

Candidate axes include:

- conceptual progression;
- evidence of learner uptake;
- interactional rhythm;
- engagement;
- persistence/repetition;
- pacing;
- epistemic confidence;
- lesson-plan alignment.

These categories should be mapped against existing rubrics and ontologies before new categories are introduced.

## Observation 10 — Adaptation as repair

Pedagogical figures may be better understood as **repair policies** than as tone choices.

A tentative loop is:

```text
Expected trajectory
        ↓
Observed trajectory
        ↓
Divergence diagnosis
        ↓
Is revision warranted?
        ↓
Pedagogical figure / repair policy
        ↓
Register / realization
        ↓
Learner response
        ↓
Updated trajectory
```

The important intervention point is therefore not "the learner is difficult → use sarcasm."

It is closer to:

> "The current pedagogical commitment is failing to produce the expected interactional movement; sufficient evidence now warrants a revision of stance."

## Observation 11 — Frontier-model baseline remains the central challenge

Frontier models already perform substantial implicit adaptation.

They track conversational history, infer intentions, vary explanations, and anticipate likely future turns without explicit instrumentation.

The project therefore needs to show what explicit machinery adds.

Possible contributions include making adaptation:

- inspectable;
- controllable;
- reproducible;
- falsifiable;
- attributable to explicit evidence;
- comparable across models;
- evaluable at decision points rather than only at whole-dialogue level.

The claim need not initially be "explicit adaptation always outperforms the frontier model."

A more defensible claim may be that explicit instrumentation creates experimentally tractable adaptive behaviour whose triggering, warrants, and effects can be measured.

## Observation 12 — Debug at the level of the theory

Prompt-level debugging is insufficient for this phase of the project.

A useful debugging view should expose parallel tracks through a dialogue:

```text
Turn
Expected lesson state
Observed dialogue event
Commitments
Divergence
Current pedagogical figure
Revision event
Register
Outcome
```

The debugger should answer:

> **Why did the tutor believe a change was warranted here?**

If the instrumentation cannot answer that question, too much of the adaptation remains implicit.

## Open Questions

1. How much of this proposal is already represented in the current DAG and recent ontology work?
2. Can divergence be classified reliably rather than merely scored?
3. Which dimensions of normative conversational flow can be specified without making the dialogue mechanically rigid?
4. Can pedagogical figures function as repair policies?
5. How should commitments, warrants, and entitlements be represented computationally?
6. Should the interpretation structure be a second graph, an extension of the existing DAG, or a smaller event/trace structure?
7. Can explicit instrumentation produce measurable differences from base frontier-model behaviour?
8. Which evaluation tasks should target the diagnosis, warrant, policy choice, realization, and downstream effect separately?
9. How should productive divergence be distinguished from divergence that should trigger repair?
10. What does PR 617 already solve in relation to this proposal?

## Immediate Next Step

Conduct a **semantic audit of the existing DAG implementation and recent adaptive ontology work before writing new mechanisms**.

The audit should determine:

1. current node and edge semantics;
2. existing representations of expected progression;
3. existing representations of observed progression;
4. current trigger/evaluation instrumentation;
5. where pedagogical figures and registers enter the pipeline;
6. what PR 617 adds;
7. which parts of the proposed normative/descriptive framework are genuinely absent.

## Session Anchor

> **Do not ask only what the tutor should say next. Ask what the conversation should be becoming next, what evidence shows that it is or is not becoming that, and what revision is warranted when the trajectories diverge.**

## Progress Update — 10 August 2026

The immediate semantic-audit step is complete. The existing world/DAG remains
the normative conceptual spine; the learner board and turn audits supply the
descriptive trace; `action_family` is the operational commitment/figure level;
and `engagement_stance` remains the downstream register level. The missing
layer was not another learner model but an explicit, evidence-bearing warrant
decision between those existing objects.

That layer now exists in shadow and live forms. Shared rules classify
decision-time divergence, a repair-policy map recommends family and stance, and
the live gate can be disabled, observed without behaviour change, or activated.
Completed-turn outcomes are carried forward to the next decision so the trace
can answer why a change was or was not warranted without using future evidence.

The Phase-5 n=5 paired pilot has completed valid execution and downstream
analysis. It establishes that explicit instrumentation can execute, record its
evidence, and produce attributable override events. It does not yet isolate a
downstream quality or learning effect: the behaviourally inert observe arm also
moved against baseline, exposing residual frontier-model draw variance despite
paired session seeds. The fresh blinded decision corpus awaits two independent
annotations, false-positive behaviour needs review, and the pilot's downstream
signals are not yet a basis for n=10 scale-up or human-learning inference.

Still open from the original log are richer authored expected-uptake semantics,
independent evaluation of figure choice and linguistic realization, a theory-
level replay UI, and validation beyond automated learner profiles.

## Progress Update — 10 August 2026, annotation and stop decision

The 18-case decision sample now has two independent blind reads. Fifteen hard-
consensus cases yielded precision 0, recall 0, and accuracy 0.600 for the live
gate's decision rule. Four false positives treated defensible evidence staging
as accumulated failure; two false negatives let the engaged-analytic mask hide
a strategy that had exhausted its usefulness.

A small rule repair fit all 15 hard primary cases, but that corpus was already
burned. A corrected zero-overlap 18-case holdout was therefore frozen and read
by two replacement annotators. On 16 hard-consensus cases the candidate again
had precision 0 and recall 0 (accuracy 0.813). Its changes were reverted. The
failed generalization matters more than the retrospective fit.

The holdout changes the architectural diagnosis. The missing object is not
only a warrant threshold; it is an action-family contract that says what uptake
the move expects and when the family has succeeded, failed, or expired. A
challenge can succeed without immediate DAG growth and should then terminate.
Conversely, a learner can remain analytically competent while a specific
request for missing evidence goes unanswered and should then force repair.

The n=10 comparison was not launched. Paired observe-minus-off learner-record
growth (+0.6 low-agency, +0.4 diligent, +0.8 affective-resistant) was as large
as or larger than active-minus-off (0.0, -0.2, +0.2), so the present paired-
seed design does not isolate an intervention effect from model-draw variance.
The next empirical loop must validate typed uptake/termination contracts first,
then use frozen-prefix counterfactual replay or explicit replicated draws.

The evidence boundary remains strict: this is internal automated-learner
calibration, not a validated repair policy, a paper result, or evidence of
human learning.

## Progress Update — 10 August 2026, typed-contract validation gate

The successor implementation now gives all 13 catalogue action families a
typed contract: expected learner response, deadline, success transition,
defeat transition, expiry transition, and (where appropriate) a required exit.
The same contract registry runs in the live gate and offline replayer. The
study harness and scorer were extended before new data were generated, with a
frozen gate covering decision accuracy, successor choice, diligent-control
false positives, and live/offline parity.

The fresh validation run completed nine dialogues (off/observe/active across
three automated learner profiles), 72/72 turns, and 72/72 learner-analysis
calls with zero fallbacks. The frozen 18-case corpus has SHA-256
`8ad4e43d8619894cba5793d0e09406dd60ab332d43c38310badbae8454938117`
and verified zero overlap with both earlier 18-case corpora. Two new isolated
readers labelled it before the private key was opened.

The predeclared gate failed. Raw agreement was 0.778; 14 hard-consensus cases
split evenly between seven positives and seven negatives, with four uncertain.
The gate recorded TP=2, TN=5, FP=2, FN=5: precision 0.500, recall 0.286, and
accuracy 0.500. Four successor-family consensuses were available and none
matched the policy (transition accuracy 0). The diligent false-positive rate
was 1/4 = 0.250. Live/offline agreement was 41/42 = 0.976 rather than the
required 1.00.

The new corpus identifies three architectural defects:

1. **Planning is not obligation debt.** Selecting or restating the first
   appropriate public test was sometimes treated as a repeated unanswered
   request, producing both false positives.
2. **Public obligations outlive an action-family instance.** The two clearest
   `answer_accountably` consensuses concerned a requested result that remained
   unanswered across an intervening tutor move; the per-family tracker forgot
   or misread that obligation.
3. **Inquiry completion is a typed outcome.** Several late positive decisions
   said the evidence-bounded conclusion was complete and the tutor should
   `close_inquiry`; the current contracts continued staging instead.

The parity miss was separately traced to offline replay not priming its request
lifecycle with learner turn 1, while the live runtime already had an initial
family in force. That mechanical defect has a regression-tested fix, but the
frozen score remains 0.976; it is not retroactively rewritten.

The downstream comparison therefore remains stopped. The next normative
object is a public-obligation ledger with speech-act typing (proposal versus
request), satisfaction and carry-forward rules independent of family changes,
plus an inquiry-completion contract grounded in exhausted public evidence.
Those objects need another newly generated blind decision study before frozen-
prefix replay or replicated-draw outcome work is licensed.

This remains internal automated-learner calibration, not a validated repair
policy, a paper result, or evidence of human learning.

## Progress Update — 10 August 2026, context correction and successor mechanism

A source-trace audit changed one part of the typed-contract interpretation.
The two readers who selected `close_inquiry` for cases 007 and 011 were not
shown the authored release schedule. The blind packet ended at an eight-turn
sample and exposed no due/future-evidence counts, so both readers inferred that
the available sequence was complete.

It was not. At case 007's turn-8 decision, `p_crucible` was due and only three
of nine releases had committed before the decision. At case 011's turn-7
decision, nothing was due that instant, but `p_crucible` was licensed for turn
8 and six releases remained. Both learner-DAG assessments were unentailed and
unasserted, with best-path coverage 0.167 and a
`release_or_pacing_gap`. Those frozen rows remain in the historical 0/4
successor score, but they are not valid inquiry-completion or
`close_inquiry` gold. No terminal rule may be tuned to reproduce them, and the
end of an evaluation sample must never be treated as the end of an inquiry.

The public-obligation diagnosis survives. One consensus-positive row directly
asked what result the touchstone showed. Another asked for the balance and ring
result, received an unrelated verdict question, answered it, and still had not
received the requested result one turn later. This is a cross-family public
debt, not merely failed expected uptake inside one action contract.

That distinction is now implemented. A precision-first public speech-act layer
separates a tutor-directed result request from a learner proposing a test,
asking what criterion would count, or asking the tutor to choose the next step.
Only the result request creates a tutor-owned obligation. The persistent ledger
records its public target, creation and reminder turns, response deadline,
delivery audit, and lifecycle through open, overdue/reactivated, accountable
deferral, satisfaction, withdrawal, or transfer. It survives action-family
changes. A generic question does not discharge it; a valid deferral must name
the unavailable target and a concrete public next condition.

In active mode this becomes an executable response contract, not a hint. The
answer or accountable deferral owns the uptake, precedes an unrelated due
source, and cannot be replaced by another question. Both structured and live-
text progression audits check the target and delivery outcome; a due clue may
follow only after the obligation has been handled.

Inquiry completion is now a separate typed object that projects existing
learner-DAG, dialogue-closure, and authored-release semantics. Normal closure
requires the learner to have grounded and asserted the final answer and the
authored release scope to be known and exhausted. An
explicitly authored bounded scope may license a supported proof-limit outcome,
but release exhaustion alone, `dueNow=[]`, sample position, or safety cap never
does. Unresolved obligations, unsupported assertions, active dropped facts, and
unintegrated released evidence block closure. A successful completion emits a
`terminal_transition` to `close_inquiry`; it is not redescribed as repair
failure.

The bounded proof-limit branch is an explicit decision-time planner seam, not
an inference from the present world schema. It is now carried through live
selection, the canonical decision snapshot, and resume replay, but no current
dramatic world or world scaffold authors such a terminal contract. Production
worlds therefore supply `null` and use ordinary strict grounded-and-asserted
closure. World-level bounded-scope authorship and its deterministic projector
remain prospective.

In active mode the typed object is also a hard safety boundary over the older
DAG-only closure machinery. A premature `close_inquiry` candidate is replaced
with a safe nonterminal family, and a legacy mandatory/available closure frame
is constrained back to open while typed blockers remain. Observe mode logs the
same counterfactual assessment but changes neither selection nor lifecycle.

The decision surface now distinguishes two comparisons. A
`commitment_transition_warranted` means the licensed family differs from the
prior delivered family. A `current_candidate_override_required` means it also
differs from what the base selector has already proposed for the present turn.
Active mode overrides only the latter. This lets the ordinary selector satisfy
a normative transition without creating a fake intervention and lets an
already-held `answer_accountably` family receive a concrete obligation
directive without a fake family switch.

Live, resumed, and offline paths now share the same reducers. The live gate
assesses after learner turn N and before tutor turn N, so evidence delivered on
N is still due at that decision. Completed turns persist the actual delivered
family, tutor text, released public evidence, ledger, completion state, and
turn outcome. Resume rebuilds state from those public committed records; the
offline shadow uses the same speech-act, ledger, completion, contract, and
warrant functions. Current v4 traces compare the complete typed decision rather
than only the warrant boolean.

Each v4 decision also freezes its canonical pre-gate input and SHA-256 digest.
This joins the learner text/classification, learner DAG, prior delivered and
current proposed families, release availability, closure frame, ledger state
before the learner act, prior outcome, and closure-blocker inputs at one
inspectable boundary for resume and replay.

The active gate-selected response configuration is also frozen before optional
point-of-action, typed-action, and conversational-completion policies run.
Final authority restores that complete bundle—not only its family name—so a
displaced policy cannot leave stale actorial part, performance, support, task,
or selection-reason fields in the realized draft. A displaced typed action is
cancelled before delivery, its scaffold lifecycle is rolled back, and that
disposition survives resume. A displaced point-of-action intervention is
cancelled before tutor output and ignored by prompt, release, handoff,
committee, and compliance consumers; benchmark export records the response
configuration actually delivered while retaining cancellation provenance.
Speculative learner branches, failed analysis,
diagnostic rollback, session reset, and public tutor-text rewrites likewise do
not commit or reuse a stale warrant reducer.

## Progress Update — 10 August 2026, all-turn mechanism-validation preregistration

The next study is deliberately not a larger baseline/outcome comparison. It is
a context-complete mechanism test across two transfer worlds:
`world_022_foxtrot_jukebox` and `world_028_larkspur_fridge`. It crosses those
with six simulated learner profiles—`diligent`, `low_agency`,
`answer_seeking`, `counterexample_hunter`, `goalpost_shifter`, and
`fast_learner`—and two conditions, observe and active. One fresh seed per cell
from master seed 401 and a fixed eight-turn horizon produce 24 dialogues and
192 decisions.

All eight decisions from every observe dialogue enter the blind corpus: 96
cases, with no prediction balancing or sample selection. The packet now
freezes the public opening text, situation/question, opening evidence, and
requirements in every case. It also includes public-safe counts for authored
releases, releases committed before the decision, evidence due now, future and
remaining licensed evidence, and scope exhaustion. It never exposes the secret
or future evidence identities/content.
Two isolated readers label speech act, obligation source/lifecycle, inquiry
state, prior-commitment transition, current-candidate override, warrant basis,
and successor family. Active decisions stay outside annotation and provide
matched intervention execution plus a second exact structured-parity
denominator.

The freeze binds the protocol, all relevant source and handbook hashes, all 96
cases, the private key, thresholds, complete cell/turn coverage, and zero
fingerprint overlap with earlier corpora. Source coverage includes the
recursive static local-import closure of the study, replay, auto-eval, and
actual tutor-stub child entrypoints; child run seals bind the tutor-stub
closure too. This replaces the earlier hand-maintained policy-source shortlist,
which could omit a newly active integration module. Any post-freeze code,
handbook, projection, protocol, or threshold change burns the study.

Execution validity now extends beyond reducer parity. The study summarizes a
delivery-application audit for every decision. Persisted raw pre/post selector
snapshots let the verifier recompute hashes and field deltas, bind selected
family/stance/digest, and require deep equality with the shared pure gate patch;
observe and active-hold are structurally inert. Persisted pre-final and frozen
pre-optional selections let it recompute displacement fields, bind enforcement
schema/decision/source/compatibility, and verify both frozen and restored
digests.

The selected configuration then passes through the shared deterministic
speaking builder, including any tactic fallback. Final delivery is either that
exact speaking configuration or the exact shared simplified-recovery output
from an enumerated ladder source. Transition objects and nested structures are
compared exactly, with speaking and recovery counts separate. The action family,
obligation directive, and enforcement provenance cannot change. Obligation
compilation preserves the complete target and acceptable outcomes; final public
text must answer every required component or name the target as unavailable,
give a concrete next condition, and end without a question. A selector,
recovery, compilation, or delivery wiring failure therefore cannot be hidden
by perfect live/replay agreement.

The old aggregate gates remain, and the new mechanism gate additionally
requires at least 75% complete typed consensus; sufficient positive, negative,
successor, request/proposal, obligation-persistence/resolution, and
complete/incomplete inquiry cases; request/proposal macro-F1 >= 0.80;
obligation-lifecycle accuracy >= 0.80; proposed-test false-obligation rate <=
0.10; inquiry-completion precision >= 0.90 and recall >= 0.75; zero unsafe
closures; and zero typed live/replay mismatches with non-zero observe and active
denominators. Missing support fails inconclusively rather than passing by
vacuity.

Only a full pass can license a separately frozen, variance-controlled outcome
study. It would still be automated two-world/six-profile mechanism evidence,
not proof of improved learning, an optimal repair policy, or a human-learner
effect.

## Progress Update — 10 August 2026, end-to-end delivery proof hardening

The mechanism boundary is now independently replayable from selector input to
public tutor text. Selector evidence includes raw pre/post source snapshots as
well as hashes. Live selection and the study scorer use the same pure gate
patch, so observe and active-hold require exact inertia and active application
cannot carry undeclared source mutations.

Final authority now records both the pre-final selection and the frozen
pre-optional selection. The scorer recomputes the displaced response and
selection fields, binds the decision and enforcement records at both levels,
rejects the legacy family-only patch, and verifies the frozen digest plus
compatibility provenance. A restoration boolean alone no longer passes.

The delivery chain now distinguishes three explicit states: selected response
configuration, deterministic speaking configuration, and final delivered
configuration. The shared performance-obligation builder owns any speaking
tactic fallback. The shared simplified-recovery builder owns every accepted
plain/composition/question/source/self-correction/deterministic recovery
configuration. Exact nested equality rejects forged role, evidence, budget, or
performance payloads; speaking transitions and recoveries are reported
separately.

Public-obligation compilation also preserves the ledger target's signature,
subject terms, and required components without aliasing. The shared live audit
now rejects a composite result response that answers one component while merely
naming another, while retaining target-specific accountable deferral as a
separate valid outcome.

These changes strengthen execution validity; they do not validate the policy.
The next empirical step remains the predeclared 24-dialogue mechanism run,
followed by two independent annotations of all 96 observe decisions and the
frozen scorer. No model-backed run was launched in this update.

## Progress Update — 10 August 2026, digest-bound live authorization

The mechanism-study launch boundary no longer relies on the boolean
`--launch-approved` flag alone. Every dry run now writes a
`launch-authorization-request.json` whose canonical approval digest binds the
two-world/six-profile/two-condition matrix, seeds and horizon, all three model
roles and their named destinations, the declared unpublished private prompt
payload scope, all excluded-corpus hashes, and the complete recursive source-
provenance hash.

A live mechanism invocation must supply both the boolean acknowledgement and a
completed authorization artifact. Before it creates a live plan or starts any
model subprocess, the runner recomputes the contract and requires exact digest,
destination-list, and payload-scope-hash equality plus a named approver and
valid approval time. Output-root identity and the dry/live flag are the only
differences intentionally excluded from the digest, so a matching dry plan can
be promoted without allowing a reroute or source mutation. An accepted copy
and its validation audit are persisted beside the live plan.

The acceptance boundary is now commit-exact as well as content-exact. An
approvable request must come from a clean committed worktree and bind the exact
40-character `HEAD` SHA plus the recursive source-closure hash. Live validation
recomputes both before plan creation and fails closed on dirt, an invalid or
different commit, or closure drift. A commit or amend after dry-run inspection
therefore burns that authorization and requires a replacement dry run and
digest.

The predeclared route is `codex.gpt-5.6-luna` for the speaking tutor, combined
learner analysis, and automated learner, with **OpenAI Codex CLI
(ChatGPT-account route)** as the sole external destination. The authorized
unpublished payload comprises repository-authored role prompts, the fictional
public world/question/rules/staged evidence and dialogue, current public
candidate text, bounded response-configuration instructions, public-only
learner-DAG/record state, behavior-only simulated-learner briefs, and bounded
candidate or repair text used by response auditing. It excludes concealed
answers, future evidence identities/content, private proof paths or planner-
only identifiers, annotation keys/responses, simulated-learner measurement
targets, repository source and Git state, credentials as prompt content,
complete technical traces, scoring artifacts, and human-subject data. The
excluded artifacts remain local; no OpenRouter, Anthropic, or direct OpenAI API
route is licensed by this approval.

This is execution governance, not mechanism evidence. Static preflight remains
green, and no model-backed dialogue was launched in this update.

## Progress Update — 10 August 2026, launch-integrity and blind-measurement hardening

The launch boundary is now finite and supply-chain specific. Every mechanism
dialogue runs under the automated-eval lab with a 64-call admission cap; retries
consume the same budget, so the full 24-dialogue matrix cannot reserve more
than 1,536 calls. Budget exhaustion emits an explicit trace and seals an
incomplete child rather than allowing another reservation.

The child environment is reconstructed from a narrow contract. Inherited
tutor seams, Node preload/search-path hooks, dotenv overrides, and OpenAI/Codex
API-route variables are removed, while the committed assignment-free
`config/adaptive-warrant-study.env` prevents a checkout `.env` from restoring
them. Local, zero-model probes now fingerprint both the invoked Codex wrapper
and its delegated native executable before and after checking the version and
ChatGPT-account login. An API/custom-base route or wrapper/native mutation
fails before any research prompt is submitted.

Authorization is strict rather than JSON-shaped-by-convention. The artifact
has an exact field set and typed lowercase Git/SHA-256 values, binds source and
child-policy closures separately, names the exact study execution digest, and
uses canonical UTC time. Validation recomputes the request contract and the
live job array; job order and every critical world/profile/gate/seed/horizon/
effort/token/history/budget/temperature flag remain digest-bound. Each result
is recollected from a sealed child plan/event/artifact chain. Resume rechecks
the immutable plan and authorization and can reuse only exact complete/dry
children. The later annotation freeze binds this execution-evidence manifest.

The outgoing-payload declaration and its executable check are now aligned.
Repository-authored role prompts and output schemas, public world/fact/premise
surfaces, bounded configuration instructions, public learner state, behavior-
only learner briefs, and recovery issue classes/public packets are declared.
Secrets, future evidence, private proof sources, rejected drafts, annotation
material, measurement targets, credentials, repository/Git contents, human-
subject data, traces, and scores are excluded. A fake-provider capture across
tutor, analyzer, simulated-learner, and recovery calls checks representative
canaries. It found a real boundary defect: the generic learner-analysis rubric
still contained a Marrick-specific example naming Edony and the weir-forge
crucible. That example is now domain-neutral, and the capture regression is
green.

The 96-case blind packet is also harder to infer or contaminate. Paired corpus
and key rows receive a deterministic global hash shuffle and opaque 96-bit IDs
instead of sequential cell-ordered case numbers. V3 reader envelopes reject
unknown fields and wrong scalar/array types before unblinding. The scorer now
requires exact unresolved-obligation source turns, gold-safe closure and
successor denominators, and separate 0.75 accuracy gates for commitment
transition, current-candidate override, and primary warrant basis. A single
prompt-audit recovery invalidates execution rather than disappearing into an
aggregate.

These are integrity and measurement changes, not mechanism results. They burn
any earlier dry-run digest. No model-backed mechanism dialogue was launched in
this update; the next external step remains a new clean-commit dry rehearsal,
explicit approval of that exact digest/payload/destination, and only then the
24-dialogue run.

## Progress Update — 10 August 2026, first authorized mechanism run and corrective checkpoint

The digest-authorized study ran all 24 planned dialogues from clean detached
commit `21f3497666b393840e8aca3e4128d8ac1861cfc0`. Its historical result is
`incomplete` and the mechanism gate did not pass. Twenty children supplied
valid evidence; four were sealed `evidence_invalid`. Across the valid children,
all 160 tutor decisions had combined learner analysis and exact structured
live/replay parity (160/160, zero mismatches). Delivery application nevertheless
reported 152 mismatched decisions and 173 issues. The run and its 96-case
annotation freeze are burned for calibration; they cannot be repaired or
retroactively promoted into passing evidence.

The audit separated those failures into four mechanisms:

- 150 selector-configuration digest mismatches, plus three active frozen-bundle
  digest mismatches, came from adding legacy compatibility metadata after the
  selector audit had hashed the configuration. Selection now finalizes that
  metadata before constructing its application proof.
- Nineteen action-family visibility failures mixed two real active-delivery
  recognizer misses with 17 checks on observe or active-hold decisions. The
  latter decisions own structural inertia, not the baseline selector's public
  realization. The scorer now requires family visibility only when an active
  warranted revision owns the family. The two owned misses are covered by
  bounded recognizer additions for `close the incident record` and the precise
  contrast `supports X, not Y`. The one associated stance miss is covered by
  the same precise-contrast rule.
- Three active children exhausted their public-response guard because
  declarative learner reasoning containing embedded `does not show`, and one
  criterion question using `can`, were misclassified as tutor-directed result
  requests. Auxiliary result questions are now sentence-anchored and `can` is
  admitted in the criterion-question form. Regression cases use the exact
  failed learner utterances.
- One otherwise eight-turn child could not produce its auto-eval summary or
  valid seal because recursive final-authority evidence made its JSONL trace
  886,077,425 bytes and the reader tried to materialize the whole file as one
  JavaScript string. Prior-turn outcomes now retain a digest-bound projection
  of the delivered configuration with the nested final-authority audit omitted;
  the complete current-turn proof remains in the committed turn. The auto-eval
  reader now scans JSONL incrementally and discards unneeded event bodies once
  their type is known.

The automated-only run's training-reuse status of `not_applicable`, despite a
requested setting of `on`, is intentional governance rather than a study
failure. That control applies only to human or hybrid authorship; automated
model dialogue has `humanInputExpected: false` and is outside its scope.

Focused mechanism/delivery regression tests pass 109/109. The derivation-world
quality audit passes all 35 worlds, and the prompt/world boundary suite passes
22/22. These checks establish implementation consistency only. Before another
model-backed study, the corrections require a new clean committed checkpoint,
new dry rehearsal and authorization digest, and a fresh 24-dialogue run. Only
that new run may generate a new 96-case blind packet for two independent
annotations and the frozen scorer.

## Progress Update — 10 August 2026, second authorized mechanism run and obligation-delivery repair

The second digest-authorized matrix ran all 24 dialogues from clean detached
commit `cf1336f03a46b92080921c4722e964090193646e`, under approval digest
`4b1fb03b54ad51206f495909f7b636650dacaa909be4612f54a141f53bb307d4`.
Its historical result is also `incomplete` and its generated annotation packet
is burned. Nineteen children supplied valid eight-turn evidence; five active-
gate children were sealed incomplete and recollected as `evidence_invalid`.
All 12 observe children were valid. Across the 152 valid turns, combined
learner analysis covered 152/152 decisions and structured live/replay parity
was 152/152 with zero mismatches. Delivery application improved from the first
run's 152 mismatches and 173 issues to five mismatches and ten issues, but a
mechanism study requires every child and delivery application to validate.

All five child failures were the same fail-closed public-obligation delivery
path, not a provider, route, quota, prompt-audit, secret-leak, or missing-seal
failure. Three linked defects were exposed:

- result-request targets were sometimes built from the learner's whole turn,
  so an earlier bounded claim or later rationale became part of the named debt;
- the criterion form `what evidence can put ...` was treated as a request that
  the tutor supply a completed result; and
- terminal recovery could preserve a non-answering generated uptake, place the
  deterministic accountable deferral only after an authored source, and then
  reject it because obligation ownership requires answer or deferral before
  that source.

The correction now isolates the last directed result-request clause, removes
incidental request-language from target identity, recognizes `put/place` as a
criterion construction, and forces an active obligation's deterministic
deferral into the pre-source uptake slot. The terminal handoff detects a debt
already resolved in uptake and uses a non-duplicative declarative continuation;
the deferral names a compact typed public target instead of echoing the
learner's full question. Exact regressions cover all five observed learner
forms and an active-gate dramatic fallback with a due authored source. The
expanded focused preflight passes 160/160. The complete hermetic suite passes
8,427/8,427 root tests and 137/137 tutor-core tests; derivation quality passes
35/35 worlds, the prompt/world integrity slice passes 22/22, and workplan
validation passes 490/490.

These repairs do not retroactively validate either failed run or establish
decision quality. The next admissible sequence is another clean committed
checkpoint, dry rehearsal, approval of its new exact digest, a fresh complete
24-dialogue run, then two independent annotations of that run's newly frozen
96 observe decisions and the unchanged scorer.

## Progress Update — 10 August 2026, third authorized run and deferral-lifecycle repair

The third authorized matrix used clean detached commit
`b3cb1d19a619557752c063feb3669aa1563f59d9` and approval digest
`eee15ccd11eee4913a24d038c96da86e9e68b79fb458b2aa7b4eb1130239b7a5`.
It collected every planned row, but remained `incomplete`: 22 children were
valid and two active children were sealed `evidence_invalid`. Across 176 valid
turns, learner analysis was complete and structured live/replay parity was
176/176 with zero mismatches. Delivery application reported 11 mismatched
decisions and 19 issues. The execution and its annotation packet are burned;
no annotation or outcome comparison is licensed from them.

The two sealed failures separated cleanly. Larkspur treated a learner's request
for the next copyable `WF-11` line as a request that the tutor produce a new
public evidence result; the same path exposed `wf-` and an empty target token.
Foxtrot constructed the right accountable deferral for a requested log entry,
but a writable-entry recovery path placed it after an unrelated authored
source, outside the obligation-owned opening. The guard rejected that public
ordering rather than releasing invalid evidence.

The 11 delivery mismatches revealed a lifecycle defect behind most later
public-obligation pressure. A valid deferral was set to expire on the very next
turn, so unrelated subsequent turns reactivated stale debt even when the
learner had not renewed it and no matching evidence had become public. The
ledger now preserves `deferred` as nonblocking until one of those two public
events occurs: a matching release can satisfy it, and an explicit reminder can
reactivate it.

The correction also separates copy-editing/wording requests from result
requests, normalizes alphanumeric target identifiers, prevents writable-entry
fallback substitution while public debt owns the turn, and applies a final
composition check that moves the already-audited deferral to the first host
sentence before any authored source. The live progression audit reads that
literal boundary rather than depending on semantic uptake segmentation. An
exact child-process fixture now reproduces the combined log-entry/writable-
entry collision without a model call, while the structured replay fixture
checks that deferred debt stays nonblocking with exact live/offline parity.

No-model verification is green: the digest-bound mechanism preflight passes
163/163 tests, derivation quality passes 35/35 worlds, prompt/world integrity
passes 22/22, the full hermetic suite passes 8,430/8,430 root plus 137/137
tutor-core tests, and both workplan checks pass 490/490 items.

These corrections burn the third digest. The next admissible boundary remains
a clean committed checkpoint, a new dry request, and explicit approval of its
new digest before a fourth run. Annotation begins only after 24/24 valid
children, 192/192 analysis calls, exact structured parity, and zero delivery-
application mismatch.

## Progress Update — 10 August 2026, fourth authorized run and terminal-delivery repair

The fourth authorized matrix ran from clean detached commit
`f0d67e02bea393cf1b28e74bef4036ffdc88c5f3` under approval digest
`3eaac28e565b5bdcd5db48d1d2a078fffc7395051e52091322e69b3aa8d2dea3`.
For the first time, all 24 children supplied valid sealed eight-turn evidence:
192/192 combined learner-analysis calls completed without prompt/audit failure,
and structured live/replay parity was exact for 192/192 decisions with zero
mismatches. The study nevertheless stopped as `invalid_delivery_application`:
six decisions had eight delivery issues. Its generated packet is burned and
must not be annotated for passage.

Five of the six mismatched decisions were audit-boundary false negatives. Two
licensed Larkspur closures said `incident log can now close` or `incident
record is now closed`, outside the closure recognizer's previous grammar. Two
Foxtrot obligation recoveries delivered the exact public-only deferral but the
family recognizer did not admit that wording; their three-sentence host surface
also exceeded the plain-stance average by a fraction. One Foxtrot next-step
turn included a long authored source quotation in the development segment, so
the fixed source was incorrectly charged against the host action's 110-word
budget.

The remaining decision was a real lifecycle inconsistency. A fast Foxtrot
learner reached strict grounded-and-asserted closure after all licensed
evidence was exhausted, while one historical obligation remained `deferred`
and nonblocking. The completion projector nevertheless used the ledger's
inclusive `open_count`, vetoed the selector's `close_inquiry`, and required
`stage_next_step`; the delivered tutor correctly closed. The correction now
counts only actionable `open`, `overdue`, or `reactivated` obligation rows for
closure while retaining deferred rows for reminder/release bookkeeping.

Delivery audits now measure action-family visibility on the action-owned
uptake or development segment and apply the existing authored-source exclusion
before computing that segment's metrics. The recognizers admit the two saved
closure forms and the exact accountable-deferral construction. The repeated
deterministic deferral handoff is shortened to a declarative next-release line,
while the first sentence continues to name the concrete availability
condition.

Exact regressions cover the six saved public surfaces and the deferred-ledger
terminal transition. No-model verification passes 164/164 mechanism tests,
35/35 derivation worlds, 22/22 prompt/world checks, and the full hermetic suite
of 8,435/8,435 root plus 137/137 tutor-core tests. These corrections do not
retroactively validate the fourth run or establish mechanism decision quality.
A fifth execution requires a new clean committed checkpoint, dry rehearsal,
and explicit approval of its new digest. Only a fresh 24/24 run with exact
192/192 parity and zero delivery mismatch may release its 96 observe decisions
to the two independent annotators and frozen scorer.

## Progress Update — 11 August 2026, fifth run and explicit divergence measurement

The fifth authorized matrix ran from clean detached commit
`a1316a07e91dfa3bc3a1fc8438aaf213953188b2` under digest
`fe8ff714aba05d30cc67759abbba78366c7dc76c497981f23ed4d6f1b7cca792`.
All 24 children were valid, all 192 learner-analysis calls completed, and all
192 structured live/replay comparisons agreed. The run used 611 recorded model
calls. Two of 192 delivery checks still failed, so status remained
`invalid_delivery_application` and the packet is burned.

The two failures were finite audit misses, not displaced decisions: exact
authored source prose was charged against a deterministic host's plain stance,
and a clearly bounded “final record ... close it” form was outside the closure
grammar. The prospective corrections exclude exact source spans from all
host-owned realization measurements and admit the same-sentence record-
antecedent pronoun form while retaining an open-record negative control.

Before a sixth freeze, the instrument itself has been brought up to the design
claim. A single deterministic live/offline projection now records conceptual,
interactional, engagement, pacing, epistemic, and strategy-exhaustion state on
every decision, including aligned and productive rows, quantitative magnitude
and persistence, public evidence, and repair-warrant status. The blind V4
protocol asks two readers to judge all six dimensions separately from the
private predictions and scores per-dimension interpretation macro-F1,
magnitude, persistence, joint accuracy, consensus, and non-aligned support.
This closes a representational confound; it does not yet validate any of the
six detectors.

The last pre-freeze semantic check found and removed an annotation confound:
the scorer and handbook still counted an accountable `deferred` obligation as
closure-blocking even though the live completion projector correctly retained
it as nonblocking public history. All four surfaces now use the same rule:
`open`, `overdue`, and `reactivated` block closure; `deferred` remains recorded
until its condition, reminder, release, satisfaction, withdrawal, or transfer.
The exact mechanism preflight is 167/167, derivation worlds 35/35,
prompt/world checks 22/22, root 8,444/8,444, tutor-core 137/137, and workplan
validation 490/490. The next evidential act is therefore the sixth clean-commit
execution, not another instrument repair.

## Progress Update — 11 August 2026, sixth run and two remaining instrument confounds

The sixth authorized matrix ran from clean detached commit
`853ad817b224723d69c48c24f58281b79a79f8cb` under digest
`bcfdb4383bda20c30a820bbd2ac7c904bb44307cc7e269f1ee71183c71799507`.
It used 584 recorded model calls. Twenty-two of 24 children were valid, with
176 learner-analysis calls and 176/176 exact structured live/replay parity.
Two invalid children and five delivery-audit misses kept the status
`incomplete`, so the packet and its provisional annotation corpus are burned.

The two invalid children share one false-debt mechanism. A learner asking
“Could you record that ...?” or “Do you want me to record that ...?” was
requesting an entry for an already public finding, but the public-speech-act
instrument read the modal question as a request for a missing tutor result.
That invented an obligation and sent deterministic recovery down an impossible deferral path.
The prospective correction gives these bounded modal inversions an explicit
non-obligation learner-record act while preserving questions about what a
record reveals as tutor-directed result requests.

The five valid-row misses did not reveal action displacement. All four family
fields agreed. Four terminal turns used the natural declarative form “the
record closes” here, at, on, or with the finding, outside the finite closure
grammar. One accountable uptake explicitly identified the missing dated link,
outside the finite answer recognizer. Exact saved-surface tests now admit these
forms, reject “the record closes in on ...”, and reject an unrelated missing
costume detail.

This is another prospective instrument repair, not favorable evidence. A new
clean seventh execution is required. Only a 24/24, 192/192, zero-mismatch
packet can be frozen for the independent six-dimensional V4 annotations that
test the normative/descriptive divergence model itself.

The prospective seventh-run checkpoint is fully green without model calls:
lint; 35/35 derivation worlds; focused mechanism/integrity and response/
progression suites; 34/34 prompt/world boundary tests; 8,444/8,444 hermetic
root tests; 137/137 tutor-core tests; and 490/490 source workplan validation.
The next evidential act is the clean commit, digest-bound rehearsal, and fresh
execution.

## Progress Update — 11 August 2026, seventh run, first complete V4 read, and instrument split

The seventh matrix from clean commit
`22142b7b897365695c929dfa1a0e47cb71f27512` is the first fully valid mechanism
execution: 24/24 sealed dialogues, 192/192 learner-analysis calls, exact
192/192 structured parity, zero delivery mismatch, and 599 model calls. Two
independent Luna readers then annotated all 96 frozen observe decisions within
the 24-call authorization.

The semantic result failed. Raw agreement was 0.698 and only 67 cases had hard
decision consensus. Precision 0.773 passed, but recall 0.567, accuracy 0.731,
transition accuracy 0.545, and mechanism exact-consensus rate 0.323 failed.
Request/proposal macro-F1 was 0.143. Pacing alone passed all of its divergence
support and accuracy gates. Conceptual and epistemic lacked non-aligned
support; interactional, engagement, and strategy exhaustion had support but
failed one or more consensus or interpretation gates. The packet contained no
hard-consensus obligation persistence or resolution and only two complete
inquiries.

The result changes the programme diagnosis. Runtime integration, replay, and
delivery are no longer the immediate blockers. The live question is now the
semantic validity and support of the normative/descriptive detectors. The
burned-corpus audit found bounded speech-act misses, an over-strict conceptual
flatness rule, and an interactional rule that counted newly opened current-
turn debt as already persistent. Prospective exact tests cover those changes;
retrospective improvements remain diagnostic only.

The annotation process itself also became evidence. Wrong-ID batch responses,
blank dimension notes, and internally inconsistent basis/family pairs required
repartitioning and disclosed normalization. Future collection now uses exact
sample-ID maps, minimum evidence-note length, and a fail-closed assembler that
permits only two predeclared family canonicalizations and audits each edit.

Finally, natural prevalence and rare-state support are now separated by
design. A fresh all-turn natural corpus will estimate ordinary prevalence and
false-positive behavior. A distinct authored challenge corpus, bound to a
private support plan, will guarantee speech-act, lifecycle, completion, and
non-aligned examples for all six axes. They share a calibration handbook but
are never pooled. The next evidential boundary is to author and freeze that
pair, verify it without model calls, and request new payload-specific reader
authorization. No outcome or learning comparison is yet licensed.

## Progress Update — 11 August 2026, reviewer correction to the validation boundary

Review found two stale historical claims and one inferential error. The v0
corpora no longer regress perfectly under the typed mechanism: the current
scores are 5/6 on the 23 July trace, 2/5 on the 24 July trace, and 2/4 on the
held-out-borderline trace. `gold-annotations-first-corpus.md` now records those
values and dates the typed mechanism's supersession of the v0/v0.1 rules to 11
August 2026; the earlier 11/11 and 4/4 values remain explicitly historical
calibration results.

The authored targeted challenge is also now strictly diagnostic. Its 24 cases
and private coverage map may probe speech acts, obligation lifecycle,
completion, and all six divergence axes, and its labels may motivate a bounded
repair. It is explicitly gate-ineligible: its enriched cases cannot supply a
denominator, accuracy, prevalence, or false-positive result to the mechanism
gate, and any repair it motivates burns it relative to the repaired code.

The pass/fail sampling frame is predeclared before any diagnostic labels are
read. After the last repair, generate the existing two-world, six-profile,
observe/active matrix with one new eight-turn dialogue per cell and master seed
401. Annotate every decision from all twelve observe dialogues—96 cases with no
balancing or post-hoc selection—and apply the unchanged
`ADAPTIVE_WARRANT_DECISION_GATE` thresholds to that representative corpus
alone. Missing rare-state support is an inconclusive failure; targeted cases
cannot fill it. No downstream outcome run is licensed.

## Progress Update — 11 August 2026, diagnostic reader freeze burned at the envelope boundary

The 24-case targeted challenge was frozen from clean commit
`4b5f321eaaf6343627a760a2d8d329161d1af23f` and authorized under digest
`04709440caed8cdb871791b57f808adcd0d698652d25b338e70eff4635eb37c0`
for two Luna readers, six planned calls, and an eight-call ceiling. The
authorization remained correctly diagnostic-only and excluded the private
key, support plan, predictions, traces, and either reader's responses from the
other reader.

Collection stopped before unblinding or scoring. Reader A batch 1 returned the
declared six-field batch envelope. Batches 2 and 3 instead added final-V4
identity fields because the embedded handbook described the assembled V4
artifact while the packet template described the per-call batch artifact. The
fail-closed assembler rejected the extra fields. A structured-output retry
removed the extra fields but still selected the handbook's V4 schema literal,
confirming that this was an instruction/envelope conflict rather than a JSON
formatting accident. Three paired exploratory structured-schema rounds—six API
requests—were rejected before inference and do not count as annotation calls.
Four genuine Luna calls were used; four authorized calls remain unused. No
Reader B call was made, the private key was not read, no consensus or accuracy
score was computed, and the freeze is burned as an annotation instrument.

The prospective repair makes the batch envelope singular and executable.
Every prepared packet now embeds a packet-specific JSON schema that locks the
batch schema literal, reader, batch, study, corpus hash, exact opaque sample
IDs, case fields, and all six dimension fields. The identical schema is emitted
for the CLI, hash-bound in the collection manifest and authorization request,
and drift-checked before assembly. Packet instructions state explicitly that
the handbook's V4 identity belongs only to the assembled reader artifact. No
reader content is hand-edited and the assembler's two predeclared family
canonicalizations are unchanged.

No-model verification passes the 42-test focused builder/baseline suite, lint,
8,452/8,452 hermetic root tests, 137/137 tutor-core tests, and 490/490 workplan
validation.

The next evidential sequence is a clean commit of this repair, a fresh
diagnostic freeze and manifest inspection, and a new bounded payload-specific
authorization. Only after two no-repair reader assemblies may the diagnostic
key be read. Any resulting detector repair burns that diagnostic relative to
the repaired code; the later representative 96-case natural frame remains the
sole pass/fail gate. No downstream outcome run is licensed.

## Progress Update — 11 August 2026, second diagnostic freeze exposes semantic response constraints

The next clean challenge freeze from commit
`a903737693182e815c268675c2e669f23a7159bc` was authorized under digest
`0a6af90c6ea68a747f4655e6ac9580094055a267d6a7d5e8c60547fbaadf9d11`.
The packet-specific schemas solved the prior envelope problem: all three Reader
A calls returned the exact reader, batch, study, corpus, opaque IDs, six-field
batch envelope, and batch schema literal.

The fail-closed semantic validator then exposed two remaining response-contract
gaps. Five rows marked an obligation `satisfied` but retained its source turn in
`open_obligation_source_turns`; that array is reserved for unresolved debt.
Six positive-warrant rows invented family names such as `immediate_repair` or
`repair_immediate` even though those are basis descriptions rather than
declared action families. All three Reader A batches therefore required a
retry. Retrying three batches and still collecting Reader B's three batches
would require nine model calls, beyond the eight-call ceiling. Collection
stopped at 3/8 calls. Reader B was not run, the key was not read, no labels were
edited, and no diagnostic score was computed. This freeze is burned.

Prospectively, the packet now supplies the corpus's exact declared action-family
list and the output schema constrains `recommended_action_family` to that enum.
Both schema descriptions and packet instructions state the obligation/source
invariant: `none`, `satisfied`, and `withdrawn_or_transferred` require an empty
source array; `open`, `overdue`, and `deferred` require at least one unresolved
source. Focused builder/baseline tests pass 42/42 and lint is clean. A new clean
freeze and payload-specific authorization are required before any further
reader call. Full verification also passes 8,452/8,452 hermetic root tests,
137/137 tutor-core tests, and 490/490 workplan items. No downstream outcome run
is licensed.

## Progress Update — 11 August 2026, completed diagnostic isolates lifecycle and layer-separation repairs

The third 24-case targeted-challenge freeze from clean commit
`8af328eafc9ca7151f6d31ef2ef376af6cb44bb6` completed both independent Luna
reads under digest
`70482c873533e027a0ba5b0e59b673a29e2c213b2b48a3bdbfa5229ae5a8bd20`.
Six of eight authorized calls were used, both 24-case responses assembled with
zero normalization edits, and no reader saw the private key or the other
reader's responses. Raw warrant agreement was 0.875. On 21 hard-consensus
decisions the detector produced TP=20, FN=1, precision 1.000, recall 0.952,
and accuracy 0.952. Request/proposal macro-F1, transition accuracy, completion
precision/recall, candidate override, primary basis, and closure safety all
scored 1.000 or zero violations as applicable. These are diagnostic values,
not gate passage.

The diagnostic localized two detector defects. Every repeated unresolved
request was represented only by its creation turn, producing 0/8 exact
obligation-persistence matches even though both readers retained creation and
reminder turns. The architecture also derived commitment transition from any
recommended-family difference, so response-level public-obligation fulfilment
was misreported as a persistent pedagogical switch. Prospectively, ledger rows
retain every unresolved creation/reminder turn, and commitment transition is
now restricted to pedagogical or terminal transitions; public-obligation
fulfilment and candidate-safety vetoes remain current-response corrections.

The same read exposed remaining measurement ambiguity rather than a safe
detector target. Readers sometimes used `productive` as a synonym for a good
or agentive move even when conceptual and engagement norms were met, duplicated
contract defeat onto the interactional axis inconsistently, disagreed over
whether recently satisfied debt should be `none` or `satisfied`, and one row
used a positive basis despite a live contract and no transition or override.
The prospective handbook and packet contract now define dimension-specific
alignment, resolved-state persistence, response-level versus commitment-level
change, and admissible public evidence for action-contract, completion, and
obligation bases. The polite preface “May I ask…” is no longer classified as
low agency; authored conceptual challenges now use an unambiguous substantive
choice deferral.

The generic representative-study scorer also rejected the targeted manifest,
forcing a one-off composite score. A dedicated challenge scorer now validates
both blind artifacts and independent identities before private-key access,
binds the authorization and freeze artifacts, and emits an explicit
`not_applicable` pass/fail result. Any new challenge freeze is burned relative
to these repairs. The next evidential step is one final diagnostic read from a
clean checkpoint to establish that the repaired instrument and localized
detectors are coherent, followed by the predeclared fresh 96-case
`natural_prevalence` frame. Only that representative frame can pass the
mechanism gate. No downstream outcome run is licensed.

## Progress Update — 11 August 2026, final diagnostic finds one missing typed basis

The fresh 24-case diagnostic from clean commit
`7f743988268b7f3baf15c8db249c423a331278a8` completed two isolated Luna reads
in the six planned calls under authorization digest
`7f66a68aa825b0e57ee10e38962c06ceb6f88fd4c418a00135a77b9bf8cc9f53`.
Both readers supplied 24/24 cases with distinct identities. Reader B required
no normalization; Reader A triggered three predeclared `none`-basis family
canonicalizations, each recorded in the normalization audit. The dedicated
scorer validated both blind artifacts and authorization bindings before
opening the private key and correctly emitted `pass_fail_gate=not_applicable`.

On 23 hard-consensus cases the binary detector produced TP=19, TN=4, no false
positives or false negatives, and precision, recall, and accuracy of 1.000.
Raw reader agreement was 0.958. Request/proposal macro-F1, obligation
persistence, inquiry-completion precision/recall, transition-family accuracy,
candidate override, and binary decision accuracy were all 1.000. Commitment-
transition accuracy was 0.952 and primary-basis accuracy 0.957. All six
divergence interpretations met 0.808–1.000 macro-F1; joint accuracies ranged
from 0.905 to 1.000. These remain diagnostic values and cannot pass the gate.

The remaining basis error was an instrument confound. The live mechanism has a
typed `candidate_safety_override` for a proposed `close_inquiry` action while
whole-inquiry state is still open, but the reader vocabulary offered no
candidate-safety basis. The scorer consequently collapsed
`inquiry_incomplete_candidate:*` into `inquiry_completion`, contradicting the
same row's predicted `incomplete` state, while readers improvised trouble or
no-basis labels. Prospectively, `candidate_safety` is now a separate primary
basis in the corpus, packets, schemas, validation, and scorer. The handbook
also gives an explicit resolved-lifecycle example: a request answered on tutor
turn 1 remains `satisfied` at learner turn 2 with no open source turns rather
than resetting to `none`.

This vocabulary change burns the completed diagnostic relative to the repaired
instrument. One final clean freeze and independent read must verify the
measurement repair. If it is coherent, the next inferential step is the
already-declared fresh 96-case natural-prevalence corpus under unchanged gate
thresholds. No downstream outcome run is licensed.

## Progress Update — 11 August 2026, reader-backed support is now explicit

The next diagnostic from clean commit
`6a5074df74bb0e7be6f954f6ab988ad21d64655d` used the full eight-call ceiling
under digest
`b9e0b60a4121b3233103984b5a6800386a054a06caff1f42077e714eb50d8db9`.
Reader B assembled directly. Reader A twice selected `action_contract` where
the public contract declared no transition; both responses were rejected
without editing. The final higher-effort retry assembled, leaving two complete
24-case readers and zero normalization edits.

The repaired typed fields were coherent. Raw warrant agreement was 0.958; 23
hard consensuses yielded TP=19, TN=4, no false positives or negatives, and
precision/recall/accuracy of 1.000. Request/proposal macro-F1, obligation
lifecycle and persistence, inquiry completion, candidate override, and primary
basis were 1.000. Commitment-transition accuracy was 0.957 and exact successor
accuracy 0.900. Every divergence interpretation was correct on its hard-
consensus denominator; component/joint accuracies ranged from 0.909 to 1.000.
The scorer again emitted `pass_fail_gate=not_applicable`.

The run also showed that authored support is not reader-backed support. The
private design contained six resolved obligations and two non-aligned cases per
axis, but hard consensus supplied only four resolutions, zero conceptual
non-aligned cases, and one strategy-exhaustion case. The dedicated scorer had
reported these counts without declaring the shortfall. Prospectively it now
emits a separate `diagnostic_support` result against every frozen minimum while
remaining structurally incapable of producing gate passage.

The challenge is strengthened without changing gate thresholds: all eight
proposal cases now contain a resolved obligation, three simple cases carry a
defeated strategy contract, and three persistence cases use an explicit
comprehension-repair signal rather than an ambiguous low-agency proxy for
conceptual failure. Explicit comprehension repair now counts as conceptual
stall when the learner record remains flat. The packet also states directly
that contract defeat or expiry governs strategy-exhaustion coding. Finally,
response-level obligation and candidate-safety policies identify themselves as
such internally rather than carrying contradictory pedagogical-transition
metadata.

These prospective changes burn the `6a5074df` diagnostic. The next clean read
must achieve reader-backed diagnostic support; only then should the fresh
representative 96-case natural frame be generated. No downstream outcome run
is licensed.

## Progress Update — 11 August 2026, obligation-reader boundary localized

The clean `6706305255e5f71b904b5ed7c16b7001833818a7` diagnostic used six of eight
authorized Luna calls under digest
`f40ea3b375b9baf29373ad068e80c0e10b3ae800fb2bdc64eca735afa15b7f4a`.
Both readers assembled 24/24 cases with zero normalization edits. Binary
warrant agreement, precision, recall, and accuracy were all 1.000. Every
divergence axis met reader-backed support; interpretation and joint accuracy
were 0.917–1.000 except pacing macro-F1 at 0.651.

The new support audit correctly failed the diagnostic. Consensus supplied only
6/8 result requests, 3/8 exact persistence cases, and 5/6 resolutions. The
disagreements were localized: three reminders split only between `open` and
`overdue`; two engagement cases combined tutor selection with a direct result
request; and three answered requests split between persistent `satisfied` and
an incorrect reset to `none`. These are annotation-boundary confounds rather
than binary or primary-basis detector errors.

Prospectively, the handbook and packet now state the runtime lifecycle rule:
an unanswered, non-deferred request becomes overdue after the completed tutor
turn, and a reminder remains overdue. Direct result-request clauses outrank a
selection phrase in the same turn. The challenge preserves the engagement
signal without asking the tutor to choose the next investigation, and every
proposal row explicitly acknowledges the answered request. This burns the
`67063052` freeze. One newly frozen diagnostic must confirm support before the
representative natural frame; no downstream outcome run is licensed.

## Progress Update — 11 August 2026, compound decision-kind defect repaired

The clean `d0039481d4c69129da5230cc3296b7b1850c4d5b` diagnostic completed two
24-case readers in six of eight Luna calls under digest
`269682d5935cbc4966ef47246fb5f8cb3a49c019a169adb264df7245cbb5f190`.
Both readers assembled without normalization and agreed on every binary warrant;
precision, recall, and accuracy were 1.000. The obligation clarification worked:
result-request support rose to 8/8, exact persistence to 7/8, and resolution to
8/6. The diagnostic remained gate-ineligible and returned
`insufficient_support` because proposed tests were 6/8, pacing 1/2, and
epistemic 0/2.

Case inspection separated residual wording ambiguity from a real mechanism
error. Two “let's compare” moves were read as `other`; pacing requests split
between productive and stalled; unsupported premature closure split between
unsafe and stalled; and one non-result low-agency turn was incorrectly counted
as an obligation source. Those boundaries are now explicit, and the same
24-case design carries three engagement, four pacing, and four epistemic probes
for redundancy.

More importantly, three compound comprehension-repair/result-request cases had
an immediate-repair basis and `repair_explanation` policy but an outer
`public_obligation_fulfilment` decision kind. That response-level metadata
suppressed the held-family transition despite the higher-priority pedagogical
repair. Both readers consistently marked the transition. Prospectively,
decision-kind precedence now follows basis precedence: immediate repair remains
pedagogical, while the public-result obligation is an orthogonal response
directive. A focused regression test fixes that invariant. This burns the
`d0039481` freeze; one clean diagnostic remains before the representative frame.

## Progress Update — 11 August 2026, targeted instrument supported

The clean `068fb84223662d5eb322a4f7c13c2bb1be550c6f` diagnostic completed two
independent 24-case Luna readers in six of eight calls under digest
`9ef452221405fbb84539fe567649c22afbf7b12ccbac36cfba8fcac2a41fb99a`.
Both readers assembled 24/24 cases with zero normalization edits. The dedicated
scorer returned `diagnostic_support=supported` while retaining
`pass_fail_gate=not_applicable`.

Every frozen support minimum passed: result request 8/8, proposed test 8/8,
persistence 8/8, resolution 8/6, complete inquiry 8/8, incomplete inquiry
16/12, and non-aligned consensus of conceptual 5/2, interactional 8/2,
engagement 3/2, pacing 4/2, epistemic 4/2, and strategy exhaustion 3/2. Raw
binary agreement, precision, recall, accuracy, successor accuracy,
request/proposal macro-F1, lifecycle and persistence accuracy, inquiry
precision/recall, commitment transition, candidate override, primary basis,
and all six divergence interpretation accuracies were 1.000.

Divergence magnitude/joint accuracies ranged from 0.833 to 1.000 and all
exceeded the predeclared representative thresholds of 0.700 magnitude and
0.650 joint accuracy. Residual differences were bounded severity judgments,
not state or interpretation disagreements; no localized detector or instrument
defect remains. Targeted repair therefore stops here. The diagnostic cannot
establish passage or prevalence. The next step is the fresh predeclared 96-case
natural-prevalence frame; no downstream outcome run is yet licensed.

## Progress Update — 11 August 2026, representative transport cleared and delivery audit localized

The clean `a9541670dbafa6b01bd71f65c34a89c618b3ad83` representative matrix
completed all 24 eight-turn dialogues with valid seals. All 192 learner-analysis
calls completed and structured live/replay parity was 192/192 with zero
mismatches. The delayed retry protocol therefore cleared the transport
confound. The run used 611 model calls under authorization digest
`b5929b561ffbb1895bccf4e69b745ec6187a56390452bd5fb24423cc8ecaeab1`.

The matrix still failed closed as `invalid_delivery_application`: seven active
decisions across four dialogues carried nine issues. Every affected decision
retained the expected, selected, speaking, and delivered family. Five issues
mistook cue-free exact `plain` recovery for a missing stance; three let an
unrelated handoff warning override a resolved obligation sub-audit; and one
finite recognizer missed the literal terminal form “the incident is closed.”

The prospective correction narrows each ownership boundary. Exact recovery
configuration proves the intentional move to `plain`; obligation realization
is decided by its own resolved delivery object rather than the enclosing
progression boolean; and bounded incident-closure grammar includes explicit
open/not-closed negatives. Model-free replay clears eight of the nine stored
issues. The remaining immutable stored surface audit predates the corrected
closure recognizer, whose exact-text regression now passes. This diagnosis
does not rescue the packet. A new clean matrix must pass all 192 delivery
checks before the 96-case representative corpus can be frozen; no downstream
outcome run is licensed.

## Progress Update — 11 August 2026, exact-source and discourse ownership localized

The clean `2dce94acc6cf400ac674f168530652d29e33c1a7` matrix passed preflight and
sealed its first 18 reported children valid. The nineteenth child—active
Foxtrot fast learner—exhausted response recovery on turn three, and the matrix
was stopped immediately. The partial packet is burned.

The terminal fallback had actually delivered the exact authored SOURCE once
and accountably deferred the named public obligation. Two generic audits then
contradicted those typed facts. The evidence scanner failed to split after a
sentence-final closing quotation mark and attached the next host sentence to
the source correspondence. The dramatic-release audit demanded a return
question even though the progression contract explicitly prohibited questions
on this answer-owned turn. An imperative “examine a trace” was also being read
as a positive exhibit correspondence.

Prospectively, quotation-aware sentence boundaries isolate exact SOURCE spans,
imperative examination remains non-assertive, and the progression contract
governs whether dramatic release requires a question in both live and frozen
replay. These are bounded instrument repairs; the mechanism, sample, and gate
remain unchanged. A fresh 24/24 matrix is still required before the 96-case
reader stage, and no downstream outcome run is licensed.

## Progress Update — 11 August 2026, runtime cleared; reader projection burned

The clean `d7549b382d34b351bd90aaa0cbfe9303e1e54b9c` representative matrix
completed 24/24 valid dialogues, 192/192 learner analyses, 192/192 structured
live/replay comparisons, and 192/192 delivery-application comparisons with no
mismatches or issues. The exact 96-case observe corpus froze with zero overlap
against the three declared exclusions.

Both independent Luna readers completed their twelve eight-case batches. The
assembler stopped before opening the private key: both readers treated a
successful non-revising contract renewal as an `action_contract` warrant. The
public corpus correctly withheld the gate's typed transition, but the validator
incorrectly required that hidden result. A public-only audit found 73/192 such
labels, no lifecycle/inquiry/debt violations, and 15 declared `none -> hold`
canonicalizations. The packet is burned and was not scored.

Prospectively the gate transition stays private. Readers independently judge
the raw contract against public evidence, and the validator checks only that
an `action_contract` family is one of the contract's declared public successors;
a non-revising renewal is `none/hold` absent a higher basis. A fresh clean
matrix and fresh independent readers remain required under the unchanged gate.

## Progress Update — 11 August 2026, active delivery ownership enforced

The clean `ba8b1422607c50ae95eb958bd162cb7ee2c8da2c` replacement matrix again
completed 24/24 valid eight-turn dialogues and 192/192 structured live/replay
comparisons. It failed closed as `invalid_delivery_application` on three of
192 delivery checks. All three were active turn-eight terminal decisions: the
gate selected `close_inquiry`, and selected, speaking, and delivered
configurations agreed exactly, but the public response stated the supported
verdict without visibly closing the inquiry.

This is a real enforcement gap. The ordinary response-configuration policy
treated non-actorial visibility misses as advisory, so it could accept a text
that did not publicly realize the family owned by active warrant final
authority. Prospectively, that narrow case is a hard repair trigger under both
guard policies and even at terminal fallback. Ordinary selector-style
configuration misses remain advisory/report-only. The packet is burned; a
fresh clean matrix must demonstrate 192/192 visible delivery before readers.

## Progress Update — 11 August 2026, anaphoric obligation identity localized

The clean `1624e6b889b1a1d47379befbbb39a746e2a3d4b8` replacement attempt passed
preflight but stopped at its first sealed invalid child. Turn one correctly
created and accountably deferred the learner's request for the jukebox access
log. On turn two the learner explicitly renewed that request as “the matching
record when it is released.” The clause-local target extractor reduced this to
a new generic target instead of binding it to the still-active named debt, so
every otherwise valid deferral failed target coverage. The partial packet is
burned.

Prospectively, a generic request with an explicit referential cue may reactivate
an active obligation only when target-kind evidence and named surface overlap
select one unique candidate. Ties remain unresolved and cannot collapse
distinct debts. This preserves clause-local precision while making cross-turn
identity explicit and auditable. A fresh clean matrix remains required before
reader collection; no downstream outcome run is licensed.

## Progress Update — 11 August 2026, active fallback realization completed

The clean `1490d82a944fe21837fdd475bba0480f529bda5b` restart passed preflight and
the repaired anaphoric path live, but its first completed child stopped on turn
seven. Active final authority selected `challenge_resistance` after repeated
answer-seeking. The model draft, recovery, and deterministic fallback all
continued the evidence exercise without publicly interrupting the copying
pattern or returning choice to the learner. The hard delivery veto therefore
worked as designed. The partial packet is burned.

The same turn exposed a nonblocking audit defect: its exact terminal question
quoted a previously public two-sentence clue, and sentence segmentation kept
only the quotation tail. Prospectively, uptake-owned active families receive a
family-specific first sentence, every safely terminable active family has a
deterministic visibility regression, and an exact required question that is the
full response suffix remains the terminal surface even when it contains quoted
sentence punctuation. A new clean matrix is required before readers.

## Progress Update — 11 August 2026, representative runtime passed; reader contract-family schema tightened

The clean `2fa92e208d576d144b6036c29add62c8cf4eab34` representative matrix passed
all execution checks: 24/24 valid eight-turn dialogues, 192 learner-analysis
calls with zero errors, exact 192/192 structured live/replay parity, and exact
192/192 delivery application with zero issues. The resulting 96-case natural
frame froze with zero overlap against all three declared prior corpora.

Reader A then completed all twelve eight-case Luna calls under the bounded
24-call authorization. Assembly failed closed before private-key access: one of
eight reader-labelled `action_contract` cases selected `clarify_distinction`,
outside that case's raw public successor set of `answer_accountably` and
`ground_in_material`. Seven other contract cases respected their public
successors. These responses are burned and unscored; reader B was not launched.

The prospective instrument now derives a visible case-specific successor list
from the raw public contract and binds `action_contract` to that list in the
structured response schema. Non-contract bases retain the full family
vocabulary. This removes a response-envelope confound without exposing the
private gate transition or changing the frozen decision thresholds. A fresh
clean matrix and two fresh readers remain required before the representative
gate can be scored.

## Progress Update — 11 August 2026, release fallback now carries active family ownership

The clean `1dc24ee2bac47001f6d45511cad46079dcbb878b` restart passed every launch
preflight under digest
`4e59e6e3b101fb41e16d2f286a368f05e11fb18136cde09421d5db9115d08d93`.
Its first completed child failed closed on active turn three. The typed reducer
selected `challenge_resistance`, but the model draft, repair, and deterministic
presented-exhibit fallback merely answered the learner and released the due
badge-log source. The public uptake did not interrupt copying or return a
choice, so the active-delivery audit correctly rejected it. The parent was
stopped at once; the partial packet is burned and is not a mechanism result.

The cause was a composition seam: the configured continuation fallback used
the shared family-specific uptake realizer, while the dramatic-release
fallback accepted any otherwise preservable uptake. Prospectively both paths
use the same idempotent realizer before an authored source. The focused
regression reproduces the failed low-agency question and requires the released
response to make `challenge_resistance` visible in its uptake span. A new clean
matrix remains mandatory before annotation resumes.

## Progress Update — 11 August 2026, generic obligation targets retain exact identity

The clean `495859cbafde252bdd997ead257a19910f00d5d5` replacement matrix closed
24/24 valid child seals and all 192 planned turns. It failed the parent delivery
gate on one exact representation comparison. On active turn eight of the
Foxtrot fast-learner cell, the learner requested the next public record without
naming a more specific target. The gate directive correctly stored
`public_terms: []`. During first-draft compilation, the compiler copied the
derived surface-matching token `public` into `public_terms`; the final response
validly deferred the unavailable record, but the delivery comparator detected
that the compiled target no longer exactly matched final authority. The packet
is burned and was not exposed to readers.

The prospective repair preserves the directive target without enrichment.
Derived vocabulary remains in `progression_terms`, where it already drives
focus and delivery checks, while `public_terms` remains an identity field. A
model-free regression freezes the observed generic request and requires an
empty identity list alongside nonempty derived progression terms. A fresh clean
matrix remains required before annotation resumes.

## Progress Update — 11 August 2026, terminal fallback composition now has one owner

The clean `70b4b799882091e2d418b8733b42dd00e82745e6` restart completed 18 valid
children and 144 valid turns before the first child in the final wave failed
closed. On active turn six of the Foxtrot low-agency cell, final authority
selected `challenge_resistance`. The deterministic configured continuation
already began with the correct family-specific uptake, but the terminal
runtime prepended a generic uptake and duplicated the composition. The
responsive-family audit correctly scopes recognition to the first uptake
sentence, so it rejected the now-hidden selected family. The partial packet is
burned and is not a mechanism result.

This was a terminal composition seam rather than a reducer or phrase-realizer
failure. Prospectively, configured continuation, closure, instructional
repair, and dramatic-release fallbacks declare ownership of their complete
uptake-and-development composition and bypass the generic terminal composer.
Unowned scaffold and contextual fragments still receive exactly one external
uptake. A focused regression freezes both branches. A fresh clean matrix and
complete delivery gate remain mandatory before annotation resumes.

## Progress Update — 11 August 2026, first valid representative V4 gate scored

Clean commit `5ddf1d28a23f57bb48612314203aaab62c284363` finally cleared the full
execution and annotation transport chain: 24/24 valid eight-turn dialogues,
192 learner-analysis calls with zero errors, 192/192 structured live/replay
comparisons, 192/192 delivery-application comparisons, a frozen 96-case
observe-arm natural frame, and two complete independent Luna reads with no
normalization or content repair.

This is a valid failed representative result, not a burned instrument run.
Binary precision was 0.783 and accuracy 0.827, both above threshold; recall was
0.692 against 0.700 and raw reader agreement 0.781 against 0.800. Transition
accuracy was 0.250, hard mechanism consensus 0.563, request/proposal macro-F1
0.644, and obligation-lifecycle accuracy 0.762. The frame contained only one
reader-consensus persistence case, one resolution case, four complete-inquiry
cases, and zero epistemically non-aligned cases. Conceptual, interactional,
engagement, and strategy-exhaustion interpretation macro-F1 were respectively
0.682, 0.504, 0.439, and 0.506. Pacing passed throughout; magnitude,
persistence, and joint divergence scoring were generally strong. No downstream
outcome run was started.

The 21 binary reader disagreements and 13 detector errors localize two
prospective boundaries. Public action contracts listed alternative expected
responses without declaring the combinator or exposing their public instance
timing, making success and expiry underdetermined for readers. The speech-act
grammar also treated polite directives to perform a test as tutor-owned result
debt. Prospectively every contract declares `expected_response_match: any`,
blinded cases include public `started_turn` and `response_count`, and direct
check/inspect/compare/test/weigh instructions remain proposals unless they ask
what the test shows, reveals, records, or finds. The existing score is not
rewritten or rescored.

The next phase first verifies and ships these repairs. A fresh targeted corpus
may diagnose them but cannot pass the gate. Before any further reader labels,
the design must prospectively separate representative natural-prevalence
performance from rare-state adequacy so sparse natural support cannot be
silently supplemented with challenge cases. Only then may a new clean
representative matrix, corpus, and independent annotation pair be frozen. The
outcome comparison remains blocked until that declared gate passes.

## Progress Update — 11 August 2026, V2 sampling claims separated before new labels

The V1 failure exposed a design error in addition to mechanism errors: rare-
state challenge quotas had been embedded in the representative natural gate.
The 96-case natural census produced one persistence case, one resolution case,
four complete inquiries, and no epistemically non-aligned case. Requiring that
same unselected frame to contain the challenge minima silently treated it as a
stratified sample.

The prospective V2 gate fixes the estimand before any new annotations. The
natural-prevalence corpus remains the sole pass/fail corpus and retains the
declared performance thresholds. Its complete-inquiry minimum is two naturally
occurring cases. A divergence interpretation macro-F1 enters the gate only
when that dimension has at least two consensus non-aligned cases, and at least
five of six dimensions must meet that evaluability condition. Consensus,
magnitude, persistence, and joint accuracy remain required on every dimension.
Observed persistence and resolution counts are reported but no longer pretend
to be natural sampling quotas.

The separately authored challenge keeps the stronger diagnostic minima: eight
result requests, eight proposed tests, eight persistence cases, six resolution
cases, eight complete inquiries, twelve incomplete inquiries, and two non-
aligned cases on every divergence dimension. Those cases remain explicitly
gate-ineligible and cannot be pooled, weighted, or substituted into the
representative score. V2 therefore requires representative performance while
using the diagnostic only to expose rare-state defects. It does not rehabilitate
or rescore the failed V1 corpus.

The challenge projection now also exposes public contract `started_turn` and
`response_count`, matching the repaired natural instrument. Once this change
is committed from a clean checkpoint, the next bounded model act is a fresh
two-reader diagnostic under the standing digest-bound authorization policy.

## Progress Update — 11 August 2026, V2 diagnostic localizes one cross-axis confound

The diagnostic frozen at clean commit
`efc87a997d48ea6542e40a2cecf70e8d75a292df` consumed six of its eight
digest-bound Luna calls. Both independent readers returned all 24 cases and the
assembler made zero normalizations. Consensus accuracy was 1.000 for binary
warrant decisions, transitions, speech-act request/proposal distinctions,
obligation lifecycle, inquiry completion, commitment transitions, candidate
override, and primary warrant basis. Hard mechanism consensus was 0.958.

Support passed for result requests, proposed tests, persistence, resolution,
complete and incomplete inquiries, and five divergence axes. Engagement
non-alignment reached only one of the required two consensus cases. The two
disagreements were the deliberately compound slower/faster low-agency probes:
Reader A coded stalled engagement plus productive pacing, while Reader B
treated the useful pace request as productive on both axes. Both readers agreed
on stalled engagement for the otherwise identical low-agency probe without a
pace modifier.

This is a cross-axis reader instruction confound. Prospectively, pacing and
engagement are explicitly orthogonal: a pace request receives its pacing label,
while voluntary agency or repeated delegation independently determines
engagement. The current diagnostic remains gate-ineligible and is burned
relative to this clarification. No representative or outcome execution began.
