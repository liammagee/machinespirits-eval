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
