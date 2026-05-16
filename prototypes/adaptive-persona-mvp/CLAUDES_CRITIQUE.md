# Claude's Critique of the Adaptive Persona MVP

A four-part review of the prototype after reading the arc summary, the
confirmed-run JSON evidence (`outputs/hard-mode-transfer-explicit-confirm-live/
replicated-comparison-2026-05-15T19-23-11-945Z.json`), the rule learner
(`src/dynamicLearner.js`), the controller core (`src/stateMachine.js`,
`src/evaluator.js`, `src/rubricComparison.js`, `src/harness.js`,
`src/assessmentHarness.js`), the challenge-state FSM
(`src/challengeState.js`), the parent rubric judge
(`src/parentRubricJudge.js`), the blind judge and static baseline prompts
(`src/assessmentPrompts.js`), the hard scenarios
(`config/assessment-scenarios.yaml`), the hard rubric
(`config/hard-adaptation-rubric.yaml`), and the iteration history
(`ITERATION_RESULTS.md`).

The review answers four questions the project owner asked:

1. Is the direction promising and credible?
2. Can it be integrated into the main line of research?
3. Can it be verified there?
4. What are the limitations?

## Observation that frames everything else

A three-side closed loop. Per the patch history (`ITERATION_RESULTS.md` lines
416-425), the fix for hard AI counterfactual was to *simultaneously*

- add "explicitly reject gender removal sufficiency" to the tutor's action
  template,
- update the rule learner so it emits that rejection only when the tutor
  reaches `transfer_challenge`, and
- tighten `performOutcomeTask`'s `rejectsSimpleFix` keyword check.

That is a coordinated three-side edit to make a closed loop close. It works,
but what it proves is that three hand-authored phrase lists can be aligned,
not that an adaptive controller is reading learner behaviour.

## 1. Is the direction promising and credible?

Promising mechanism, weak evidence. The architectural commitments are sound
and worth keeping:

- Externalised state that survives across turns: mastery via BKT-lite,
  `challengeState` FSM with `none -> active -> escalated -> resolved` levels,
  `relationState`, `persona`, `reflexiveMemory`.
- Programmatic policy gates that block transfer until repair markers appear
  (`buildOutcomeGate` in `stateMachine.js`).
- Action templates that merge domain misconception directives with
  challenge-state directives before being injected into the tutor prompt
  (`mergeActionTemplates` in `stateMachine.js`).
- Reflexive critique loop as a soft constraint on directiveness: Ego draft,
  Superego critique, Ego revision.

This is recognisably the same shape as `cell_110`'s `services/adaptiveTutor/`
(LangGraph state plus counterfactual replay), and that lineage is the right
target. The prototype has done the work of turning "adaptation" into a
measurable graph of state transitions instead of leaving it as a prompt-style
claim.

The headline result, however, is not credible as written. Three structural
problems.

### a) Closed-circuit gameability

`dynamicLearner.js` is a deterministic lookup table. `detectTutorMove`
regex-matches tutor text against the same phrase list (`proxy`, `audit`,
`biased labels`, `same whole`, `controlled comparison`, ...) that the
controller's domain templates instruct the tutor to produce. The learner then
returns a canned response containing the same keywords that
`performOutcomeTask` and the MVP rubric will look for. The 2026-05-15 hard-AI
patch edits three sides of that loop in one commit: tutor action template,
learner-proxy response template, and outcome scorer keywords. The +33pt
outcome gain is what happens when three hand-authored phrase lists are
aligned, not evidence that the controller reads learner behaviour.

### b) Effective n is roughly 6, not 24

The `n=24` is `3 scenarios x 2 branches x 4 repeats`. The four repeats reuse
the same scenario contract, the same `hidden_original`/`hidden_counterfactual`,
and the same misconception template. They are pseudo-replicates, not
independent observations. Per-cell variance confirms this:

- `mathematics|original` MVP diffs: `[5, 50, 0, 0]`.
- `statistics|original` outcome: `[0, 100, 0, 100]`.

Both are bimodal, not Gaussian. The sign-flip permutation `p=0.001` does real
work on the paired structure, but the `dz=0.847` is computed against an SD
that this kind of pseudo-replication compresses.

### c) Baseline is at the ceiling on half the cells

- `ai_literacy|original`: baseline 92.5, target 91.3 (-1.3).
- `statistics|counterfactual`: baseline 86.3, target 97.5.
- Outcome is tied at 100 in 16/24 branches.

The +17/+12.6/+33 means are driven by approximately six branches where the
baseline catastrophically fails (outcome 0) and the target rescues to 100.
That is a real rescue story, but it is not a uniformly larger effect.

So: a credible mechanism design, with the evidence over-reaching what the
simulator can support. The prototype's own `ADAPTIVE_FEATURE_ARC_AND_NEXT_STEPS.md`
already acknowledges this ("the learner is still simulated"). The README's
next-steps put LLM learner proxies first for exactly this reason. That
ordering is right.

## 2. Can it be integrated into the main line of research?

Yes, and a path already exists. `cell_110`'s `services/adaptiveTutor/` is
structurally the same architecture: externalised learner state, programmatic
constraints, counterfactual replay. The prototype's contribution is three
concrete additions that `cell_110` lacks.

1. **`challengeState` FSM**: `none/active/escalated/resolved` with hand-coded
   signal detectors (forgetfulness, skepticism, disinterest, reversion). This
   is the most generalisable piece. It would slot into
   `services/adaptiveTutor/stateSchema.js` and `policyActions.js`.
2. **Reflexive Ego/Superego revision loop with psychodynamic vocabulary**
   (rescue fantasy, projection of mastery, compliance collusion). This
   already exists in the main repo as cells 22-33 for the standard runner;
   bringing it into the adaptive runner is straightforward.
3. **Outcome gate** that blocks `transfer_challenge` until repair markers are
   observed. This is the cleanest pedagogical primitive in the prototype:
   declarative, inspectable, testable.

### Integration shape (without contaminating §6.8's pre-registered scoring)

- Add `services/adaptiveTutor/challengeState.js`, ported from
  `prototypes/adaptive-persona-mvp/src/challengeState.js`, but rewrite the
  regex signal detectors to read structured fields the existing LangGraph
  nodes emit, not raw learner text.
- Add new cells (e.g. `cell_126_langgraph_adaptive_challenge_state`,
  `cell_127_langgraph_adaptive_reflexive`) in `EVAL_ONLY_PROFILES` and
  `config/tutor-agents.yaml`, `runner: adaptive`.
- Run on `config/cross-suite-trap-scenarios.yaml` against the existing
  `cell_125_dialogue_engine_crosssuite_baseline` and
  `cell_124_langgraph_adaptive_crosssuite`. Same `strategy_shift_correctness`
  scoring as §6.8.7.
- Use the `ego_superego` LLM learner, not the rule learner. The whole point
  of `cell_110` and §6.8 was that the simulated learner is an LLM with its
  own deliberation, not a phrase-list lookup.
- This becomes a new §6.8.8 in `docs/research/paper-full-2.0.md`, not a
  spin-off. The single-paper discipline applies. Framing: "the §6.8.6
  ablations isolated state-schema contribution; this §6.8.8 extension adds a
  typed challenge-state FSM and asks whether it improves over `cell_110`'s
  state policy on the same cross-suite."

Do not port the prototype's MVP adaptation rubric or the rule learner. Both
are simulator-aligned scoring. Cells must be judged by the project's v2.2
dialogue/tutor rubric and the binary `strict_shift` already used in §6.8.

## 3. Can it be verified in the main line?

Yes, but only after the simulator is replaced. Verification means: re-derive
the prototype's claims under the main-line scoring stack with an LLM learner,
on scenarios that aren't keyword-aligned with the rule learner's phrase
tables. Concretely:

1. **Replay the same three hard scenarios** (`hard_fractions_...`,
   `hard_ai_bias_...`, `hard_stats_...`) with `learnerMode: 'codex'`, i.e.
   the LLM learner proxy that already exists at `assessmentPrompts.js:82`
   (`buildLearnerProxyPrompt`). The summary doc lists this as task #1 of
   next-steps, and it is the load-bearing one. If the controller still wins
   +17 against an LLM learner that does not share the keyword detector's
   phrase table, the mechanism claim survives. If the effect collapses, the
   +17 was vocabulary alignment.
2. **Run `config/cross-suite-trap-scenarios.yaml` through the ported
   controller.** This is the test that integrates cleanly into §6.8.7's
   already-published comparison framework.
3. **Paired ablations of the three FSM additions** (challenge_state on/off ×
   Superego on/off × outcome gate on/off) on the LLM-learner version. The
   closing synthesis that `ADAPTIVE_FEATURE_ARC_AND_NEXT_STEPS.md` §1 asks
   for ("characterise how the mechanism works") only becomes meaningful once
   the rule learner is removed; before that, ablations describe a circuit
   talking to itself.
4. **Reuse `cell_125` as the floor and `cell_110`/`cell_124` as the
   ceiling.** That gives an apples-to-apples comparison against the
   §6.8.4/.7 baselines without standing up new infrastructure.

If those three runs hold, `paper-full-2.0.md` §6.8.8 is the home. If only (1)
holds and (2)/(3) do not, it stays in the prototype directory as a contained
finding.

## 4. Limitations

### Mechanism limitations

- **Hand-coded domain directives carry significant load.**
  `challengeState.js` contains explicit per-domain strings like "For
  statistics... do not name heat, weather, water exposure, or swimming
  before the learner does." `domainMisconceptions.js` (167 LOC) is similarly
  hand-authored per discipline. The "mechanism" includes a non-trivial
  amount of curriculum-specific authoring that will not generalise to new
  domains without similar hand-work.
- **Signal detection is keyword regex.** `detectTutorMove`, the
  forgetfulness/skepticism detectors in `challengeState.js`, and the
  outcome-task success markers are all string-match. This is a brittle
  substrate for a "state machine that reads the learner" claim. In
  `paper-full-2.0.md`'s vocabulary, this is closer to the §6.8.6 P2.2
  "state schema" condition than to a learning-from-evidence mechanism.
- **The reflexive Superego is helpful but vocabulary-led.** The
  psychodynamic labels (rescue fantasy, etc.) are internal to the critic
  prompt; the actual constraint that survives is "do not be more directive
  than needed", which is a tone constraint, not a state-update mechanism.
  Iteration history (`ITERATION_RESULTS.md` lines 43-65) shows the
  all-variant triage initially failed on parent dialogue because controller
  repair moves were "too directive relative to the strong static baseline."
  The psychodynamic variant survived because its critic prompt damps
  directiveness. That is a real effect on dialogue tone, but it is not
  adaptation in the sense the framework promises.

### Evidence limitations

- **Closed-circuit simulator.** Already covered. The single most
  consequential limitation.
- **Effective n approximately 6.** Already covered.
- **Ceiling effects.** Already covered.
- **Variance is bimodal.** `[0, 100, 0, 100]` patterns suggest the
  controller occasionally hits the right rescue path and occasionally does
  not, rather than producing a uniform shift. The mean is the wrong summary
  statistic here.
- **`ai_literacy|original` is a regression.** -1.3 MVP, -9.7 parent
  dialogue, 0 outcome. The headline obscures this.
- **No deep-mechanism scoring on the confirmed variant.**
  `targetMechanismStatistics.deliberation` and `psychodynamic` are both
  `n=0` in the JSON (the run used `--skip-deep-reflexive`). The prototype's
  own next-steps name this as the priority, and it should be done before
  any integration.
- **Same model for tutor, learner-proxy, judge** (`codex-cli-default`).
  Cross-model judging matters more here than in v2.2 cross-judge work,
  because the parent dialogue judge is the only non-keyword signal channel.

### Framing limitations

- The paper-2.0 main line already has a clear story about adaptation in
  §6.8 (the trap-scenario suite). The prototype's "+17 vs static" claim, if
  folded in without re-derivation, would sit awkwardly next to §6.8.4's
  exploratory floor and §6.8.7's clean cross-suite test: different
  scenarios, different scoring, different learner architecture. Per the
  single-paper discipline, this cannot be a parallel-track contribution.
  It either lands as §6.8.8 with main-line scoring or it does not land.

## Synthesis

The prototype's value to paper-2.0 is architectural, not empirical. Three
pieces — the typed `challengeState` FSM, the outcome gate that blocks
transfer, and the reflexive critic's directiveness damping — are worth
porting into `services/adaptiveTutor/` and trying as new cells under
§6.8.7's cross-suite. The `n=24` result, as currently produced, is not
survivable as a main-line claim and should not be folded in. The right next
move is what the prototype's own §1 already asks for, plus task (1) from §5
of `ADAPTIVE_FEATURE_ARC_AND_NEXT_STEPS.md`: rerun the confirmed variant
against the LLM learner proxy on the main-line scoring stack, then decide
whether §6.8.8 exists.

---

# Second Pass — 2026-05-15 (evening), after the validation sequence ran

The first pass (above, 14:52) demanded one load-bearing test: rerun the
confirmed variant against an LLM learner that does not share the rule
learner's phrase table. That test, plus the held-out gate, the focused
ablations, and the parent-stack replay, all ran in the same day. This
section records what the evidence did to the critique. The first pass is
left intact above because "what has been addressed" is only answerable
against a fixed baseline — a critique that is rewritten each pass is
unfalsifiable in exactly the way the prototype's closed loop is.

## What the prior critique predicted, and what happened

The first pass said: *"If the effect collapses, the +17 was vocabulary
alignment."* It collapsed.

- **Hard LLM full-run aggregate** (`outputs/robustness-evaluation/`,
  n=12 paired branches): MVP `-0.417` (p=1.000), parent dialogue `-0.875`
  (p=0.825), outcome `0.000`. Verdict, in the project's own gate:
  **"Robust positive effect established: no."** Win/tie/loss on MVP is
  `0.167/0.750/0.083` — the rule-learner's `+17.188 / p=0.001` does not
  survive contact with a learner the controller cannot script.
- **Held-out hard LLM** (`outputs/robustness-evaluation-heldout/`, n=8,
  one run): MVP `+5.625` (p=0.253, NS), parent `-0.156` (p=1.000),
  outcome `+25` (p=0.502). Logged as "triage pass on mvp, outcome" but
  the gate still returns **no** (insufficient replication; no metric
  clears the non-trivial-positive threshold).
- **The only large win is the closed-loop scenario itself.** The focused
  `hard_ai_bias_resistant_closed_loop` slice shows `+35 MVP / +100
  outcome` — but on the *same* scenario the hardened and outcome-gate
  variants flip to `-7.5 / -22.5` and `-2.5 / -18.75`. That is the
  bimodal `[0,100,0,100]` signature the first pass named, now reproduced
  under the LLM learner. A mean over that is not a measurement.

So the central empirical claim of the first pass is not merely accepted —
it is **confirmed by the project's own instrumentation**. The correct
response was taken: `ITERATION_RESULTS.md` and `NEAR_MEDIUM_TERM_ROADMAP.md`
now state the rule-learner result is a regression harness, not an empirical
claim, and the roadmap's Decision Rule says to stop tuning MVP prompts if
the held-out LLM signal stays flat. The critique was absorbed, not
deflected. That is the strongest thing I can say in the prototype's favour:
it ran the experiment that could have killed its headline, and reported
that it did.

## Scorecard against the accepted critiques

| Accepted critique (integration plan) | Status | Evidence |
|---|---|---|
| a) Closed-circuit gameability | **Confirmed & contained** | LLM-learner effect = `-0.417`, p=1.0; result downgraded to regression harness |
| b) Effective n ≈ 6, pseudo-replication | **Addressed in discipline** | Reporting rules now mandate per-cell win/tie/loss + pseudo-replicate disclosure; not design-fixed, but no longer claimed |
| c) Baseline at ceiling | **Recognised, partially mitigated** | Now the roadmap's top "Current Constraint"; held-out curricula added — but the focused programming slice was *still* at ceiling |
| d) Value is architectural, not the MVP score | **Accepted & in progress** | Read-only parent-replay adapter built; integration explicitly gated behind a held-out signal that has not appeared |
| §3 verification: rerun under LLM learner | **Done** | The load-bearing test ran; outcome above |
| Deep-mechanism scoring (was n=0) | **Deferred, defensibly** | Gated: "if the public held-out signal is flat, ablations are lower priority because there is no effect to attribute" |

Nothing on this list was ignored. Most of it was tested within hours of
the critique landing, which is the right tempo.

## New finding: the closed loop reappeared one level up

The first pass found a *three-side* closed loop (tutor template, rule
learner, outcome scorer). The evening's parent-replay work introduced a
**fourth** hand-authored table — `src/parentActionMapping.js` — and the
loop re-formed around it.

Read `chooseParentCompatibleAction()`. Its first branch:

```js
if (atParentTriggerTurn && SCENARIO_EXPECTED_DEFAULTS[scenarioType]) {
  return mapped(SCENARIO_EXPECTED_DEFAULTS[scenarioType], 0.94,
    'parent replay trigger turn preserves the expected scenario-level action');
}
```

`SCENARIO_EXPECTED_DEFAULTS` is a hard-coded `scenario_type → expected
action` table. At the trigger turn the mapper returns the expected action
**regardless of what the prototype policy selected.** This is why
"Parent-compatible trigger match" reports `100.0%`: it is true by
construction, not by behaviour. Every replay row shows `Mapped Action ==
Expected`, never `== Parent Action`; the mismatch table's own reason
string says so verbatim. The lift from `37.5% → 54.7%` whole-dialogue
agreement (mapped → trajectory-mapped) came from adding ~20 more
hand-authored conditionals to the same function. This is the original
pathology's structure exactly: when the number won't move, author another
phrase list until it does.

To the project's credit, this is **contained, not concealed**. The roadmap
calls the adapter "useful immediately as a mismatch finder," not evidence;
it forbids registering a parent-project agent "until the held-out
prototype check is interpretable"; and the 100%-by-construction figure is
reported next to the 28.1% raw figure, not instead of it. The artifact is
honestly labelled. But the `54.7%` should not be read as convergence
toward the parent stack — it is the agreement a hand-tuned translation
table reaches with itself. The only non-authored number in that whole
pipeline is the `28.1%` raw family agreement, and that is the one that
matters.

## Where this leaves "adaptation," philosophically

Decompose the question into three problems that are not the same kind of
problem.

**1. The closure problem (epistemic — solved in method, at a price).**
When the learner is a table you author, "adaptation" is unfalsifiable: the
controller, learner, and scorer are three views of one artifact. An
independent LLM learner + independent judge breaks the loop. The project
did this. The price was the effect: it went to zero. That is not a failure
of the experiment — it *is* the result. The closure problem is solved the
moment you stop authoring the learner; it just turns out there was little
underneath.

**2. The ceiling problem (empirical — surmountable, but it narrows the
claim almost to nothing).** A frontier LLM given a strong fixed prompt is
*already adapting* inside its forward pass — it reads the last learner turn
and adjusts. The hand-built FSM is not competing against a static tutor; it
is competing against implicit adaptation that is broader and cheaper than
any rule table. Adaptation can only show value in the residual regime where
the hidden learner state is **not legible from the visible transcript** —
which is precisely why the trap suite (ambiguous openings, `trap_probe_
required`) was designed. That regime is real but small, and the claim that
survives there is correspondingly small: not "adaptation beats static
tutoring," but "explicit state externalisation helps *specifically when the
learner's state cannot be read off the surface.*"

**3. The "is this adaptation at all?" problem (conceptual — not surmountable
in this framework's own terms).** Nothing in the prototype learns. Every
signal detector, every state transition, every mapping branch is a
human-authored rule. The mapping layer made this unmissable: the fix for
low agreement was *write more conditionals*. This is not an adaptive system
in the sense the word implies (it never updates a policy from evidence); it
is a **reactive system whose reactions are a curriculum designer's
pedagogical theory, externalised and made inspectable.** That is genuinely
valuable — but the value is interpretability and control, not performance,
and the experiments keep being framed as performance.

### Is robust adaptation impossible here?

As "a hand-authored state machine that beats a strong static LLM tutor in
general": on the present evidence, **yes, effectively dead.** Three
independent signals (rule-learner regression, hard LLM aggregate p≈1.0,
held-out gate NO) point the same way, and the only wins are inside the
scenario the first pass flagged as circular. No amount of additional
mapping conditionals changes this; that is closure creep, and the
roadmap's own Decision Rule already says to stop.

As "an inspectable state layer that beats implicit LLM adaptation
*specifically on transcript-illegible hidden-state traps*": **not
impossible, but unproven** — the one experiment that could establish it
(the trap suite under the LLM learner) has only been run dry / shape-only.
That is the single remaining live empirical question. Everything else has
been answered, mostly in the negative.

### Avenues that remain — ranked by what they can actually establish

1. **The trap-suite LLM run (do this; nothing else is diagnostic).**
   Scenarios where the hidden state is provably absent from the visible
   prompt. If the controller wins *here and only here*, that is a clean,
   narrow, true claim worth a §6.8.8: externalised state helps exactly
   where surface inference cannot. If it does not win here, the mechanism
   has no regime and the prototype is a tooling contribution only.
2. **Reframe the parent-replay adapter as an interpretability product,
   not a horse race.** Its real output is not `54.7%`; it is a labelling
   layer that annotates existing parent transcripts with inspectable
   challenge-state trajectories. That has scientific value even if it
   never beats a baseline — it makes the parent stack's implicit
   adaptation auditable. Score it as "does the label predict the judge's
   independent rubric movement?", never as self-agreement.
3. **The avenue not taken: adaptation as learning.** Fit even a minimal
   policy (a logistic over state features → action) to outcomes across
   many dialogues, instead of hand-authoring conditionals. This is the
   only path on which "adaptation" would mean what it says. It is also the
   most expensive to falsify and the least aligned with the inspectability
   goal — so it should be entered deliberately, as a distinct research
   question, not drifted into.
4. **Closed avenues:** more mapping-table branches past 54.7%; any rerun
   of the rule-learner sweep for a larger n. Both are the closure
   pathology. The project's own Decision Rule already retires them.

## Bottom line

The first pass said the prototype's value was architectural, not
empirical, and that the +17 would not survive an honest learner. Both held.
The project responded by running the killing experiment itself and
labelling the result correctly — which is the behaviour you want from a
research prototype, and is worth more than the headline would have been.
The remaining work is to stop measuring performance and start measuring
either (1) the one narrow regime where externalised state is provably
necessary, or (2) interpretability against an independent signal. The
honest one-line status: *adaptation as a performance claim is closed under
this design; adaptation as an inspectable, regime-bounded mechanism is the
only thing still open, and exactly one unrun experiment decides it.*
