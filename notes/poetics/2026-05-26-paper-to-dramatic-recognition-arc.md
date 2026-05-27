# From Paper 2.0 To Dramatic Recognition: Arc To Date

Date: 2026-05-26

Status: synthesis note. This does not introduce a new paper claim by itself. It
summarizes the shift from `docs/research/paper-full-2.0.md` v3.0.104 to the
current dramatic-recognition sidecar work.

## Starting Point: The Last Paper Version

The last full paper version had a clean three-mechanism structure:

1. **Calibration**: recognition-oriented prompts improve tutor production by
   narrowing and lifting the tutor output distribution.
2. **Error correction**: the ego--superego architecture improves tutor output
   when there is enough residual error for the superego to catch.
3. **Adaptive responsiveness**: recognition or architecture should modulate how
   the tutor changes across turns.

The paper's key result was deliberately asymmetrical. Calibration and error
correction survived as supported general mechanisms. Adaptive responsiveness did
not. In the primary multi-turn analysis, no experimental factor reliably
modulated within-dialogue trajectories. The exploratory 10-turn disengagement
effect then failed preregistered replication across additional models and
judges. The paper therefore resolved to:

> two supported general mechanisms and one clean null.

That null was important. It prevented the paper from over-claiming that a
recognition prompt or a superego architecture automatically produces an adaptive
tutor. The apparatus could observe tutor production and internal revision, but
it had not yet shown a robust interaction-level control loop.

## What The Null Left Open

The null did not show that adaptation is impossible. It showed that the paper's
operationalization of adaptation was too broad for the phenomenon we now care
about.

The paper tested adaptation as a general trajectory effect across ordinary
3--5-turn dialogues. That is methodologically clean, but it treats dialogue as a
score sequence. It can miss the specifically dramatic and pedagogical event we
are now trying to isolate: the moment when the learner reaches aporia, the
tutor becomes answerable to that impasse, and the dialogue turns through a new
device, test, role, or interpretation.

The new work therefore reframes adaptive responsiveness from:

> Do recognition and architecture improve average turn-by-turn slopes?

to:

> Can a tutor detect or receive a learner's aporia, change its public teaching
> mechanism, and produce an observable learner re-reading or new action?

That is a narrower and more dialogical claim. It is closer to the pedagogical
and dramaturgical vocabulary that motivated the work in the first place:
aporia, peripeteia, anagnorisis, recognition, productive struggle, and
answerability.

## Shift In Unit Of Analysis

The main paper's unit of analysis was the scored evaluation row: tutor outputs,
judge scores, process traces, model factors, and trajectory slopes.

The sidecar's unit of analysis is the staged dialogue. It asks whether the
public transcript has a recognizable dramatic form:

- a learner impasse rather than ordinary uncertainty;
- a tutor move that changes the task, evidence, role, or test;
- a learner public performance of the new device;
- a re-reading of the earlier difficulty;
- a distinction between real recognition and pseudo-cathartic closure.

This shift matters because tutor adaptation is not just different wording on a
later turn. It is a change in pedagogical mechanism made answerable to a
specific learner difficulty.

## Tooling Arc

The branch has moved from one-off generation toward a real laboratory apparatus
for this narrower mechanism.

Current sidecar capabilities include:

- paired dramatic generation with tutor, learner, and director roles;
- full ego/superego traces retained separately from public transcripts;
- public-script projections for blind critic scoring;
- multiple critic families, now organized around a four-critic consensus rule;
- structural critics for branch validity and cue leakage;
- browser review queues for disagreement and adaptation failures;
- branch-local tutor-adaptation diagnostics;
- actional-breakthrough and ending-shape diagnostics;
- scenario role annotations for clean anchors, organic-boundary probes, quality
  boundary cases, and peripeteia targets.

This apparatus is itself a major output of the arc. It is the bridge between
the paper's mechanism-evaluation system and a future mechanical adaptive tutor.

## Empirical Arc

The clearest result remains the public recognitive-reframe mechanism. When the
learner is publicly given or induced into a recognitive reframe, the transcript
reliably takes recognitive form under stricter critic rules, provided quality
gates pass.

The control side has become much cleaner over time. Early dramatic scenarios
leaked organic reversal: some `no cue` or routine arms already contained enough
aporia and learner re-reading to look recognitive. That forced the project to
develop low-organic controls, prefix baselines, routine arms, quality gates, and
scenario-role tags.

The clean-control lesson evolved in stages:

- D35 is not a clean negative; it is an organic-reversal boundary case.
- D36 is a pseudo-catharsis target, useful because apparent learner relief can
  be false.
- D37 is theoretically valuable but quality-sensitive.
- D42 and D45 became the first clean low-organic anchors in the low-organic
  pass.
- Fresh candidates D47--D49 mostly showed how hard clean anchors are to design:
  D48 was promising but needed revision, while D47/D49 were not clean controls.
- D50 then emerged as a clean new mechanism anchor beside D42.
- D52 failed because routine and none leaked no-cue self-reframe.
- D53 is now the cleanest negative anchor in the mechanism-first replication.
  D42 and D50 remain useful mechanism anchors, but they are medium-risk boundary
  probes when the denominator must be maximally strict.

The four-critic rule also changed the epistemology. Qwen and DeepSeek are useful
permissive boundary critics; Gemini and Sonnet often discipline over-reading.
Under the current rule, 3/4 recognition votes is claimable, 2/4 is boundary, and
0--1/4 is negative.

## Adaptation And Peripeteia

Tutor-private peripeteia moved through three phases.

First, the low-organic and D42/D45 local smokes showed why the claim was not yet
ready. The sidecar could detect branch-local pressure and private route change,
but the public habit-break was missing or inconsistent, and external critics
did not agree that `peripeteia-only` produced recognitive form.

Second, the mechanism-first pass fixed a real implementation problem. Earlier
peripeteia branches often carried a peripeteia contract in the private
director/tutor context without an actual post-prefix learner pressure event. The
new branch injects a concrete reversal-pressure cue after the shared prefix, so
the tutor has to answer a present-task misfit, hesitation, resistance,
pseudo-catharsis, or breakdown.

Third, the D42/D50/D53 clean-anchor replication strengthened the mechanism-level
adaptation claim. In `phase2-clean-anchor-paired-adaptation-replication-v1`,
routine and none had 0/6 deterministic sidecar adaptation, while
`peripeteia-only` had 6/6. Every peripeteia item was branch-valid, consumed the
learner reversal event, declared a private route, and produced a public
mechanism.

The apparatus can now:

- route earlier pseudo-catharsis or reversal pressure into the tutor branch;
- inspect whether the tutor's private route changes;
- detect whether a public habit-break or mechanism shift appears;
- score whether the learner performs the new device or re-reads the earlier
  difficulty.

The important claim boundary has therefore shifted. The central adaptation
result is not robust recognitive self-reframe. It is mechanism/actional tutor
adaptation: learner pressure enters the tutor ego/superego loop, the tutor
abandons the old route, and the public response gives the learner a new
gate/device. Recognitive closure remains downstream, partial, and
critic-sensitive.

The newer ending-shape work is the most promising refinement. It tightens the
desired public ending: after the tutor's adaptive device, the learner must
visibly perform that device and earn a short reorientation of the prior
difficulty. On D42 alone, this produced clean negative arms and a much stronger
adaptive arm. In the broader six-scenario stratified smoke, the adaptive arm
improved action, mechanism, and ending-shape measures, but the negative side was
not clean. The right interpretation is therefore conservative:

> ending-shape constraints can make recognitive drama visible, but the
> stratified run is not yet clean causal evidence that peripeteia caused it.

## Conceptual Shift

The old paper asked whether recognition theory explained three broad mechanisms
in an AI tutoring architecture. It found two and retired the third as a general
effect.

The current branch does not simply reverse that conclusion. It makes the null
more precise.

The old adaptive-responsiveness mechanism failed as a diffuse trajectory claim.
The new work has found a narrower mechanism-level target inside that broad null:
not average slope modulation, but answerable response to a particular learner
impasse.

That gives the project a better theoretical ladder:

1. **Ordinary continuity**: the tutor continues competently.
2. **Aporia**: the learner's difficulty becomes visible as a block.
3. **Peripeteia**: the tutoring situation turns; the old way of proceeding no
   longer works.
4. **Anagnorisis / recognition**: the learner re-reads the earlier difficulty
   or performs a new relation to it.
5. **Tutor answerability**: the tutor's next move is visibly governed by the
   learner's impasse rather than by a generic script.

The technical terms still matter, but they should be subordinate to this
ladder. `Low-organic control` means the scene does not already contain its own
unsponsored aporia. `Baseline leakage` means the negative arm has already
licensed reversal. `Tutor uptake` means answerability. `Public habit-break`
means the tutor's mechanism visibly changes, not merely that its private trace
mentions change.

## Where We Are Now

The current state is not: we have built the mechanical adaptive tutor. It is:

> we have built a sidecar laboratory that can generate, inspect, score, and
> debug the dramatic mechanism that a mechanical adaptive tutor would need.

The strongest bounded claims are now:

- public recognitive reframe under clean controls;
- mechanism-level tutor adaptation under D42/D50/D53-style clean-anchor
  conditions;
- actional breakthrough as a separate learner outcome that should not be
  collapsed into recognitive self-reframe.

The strongest practical artifact is the mechanism-discovery apparatus. The
weakest still-important claim is robust recognitive closure downstream of
tutor-private peripeteia.

In practice, we are close to the end of the broad-generation phase. More
undirected generations are likely to produce more bulk than insight. The next
transition should be from generation to distillation:

- freeze the current claim boundary;
- preserve the clean-control and ending-shape lessons;
- extract a mechanism specification;
- define state, action, and outcome labels;
- keep curated exemplars and disagreement cases;
- remove raw transcript/deliberation/score bulk before merging back;
- promote only the durable mechanism into the main architecture or paper.

## Landing Update: 2026-05-27

The gated D42/D50/D53 adaptation-recognition loop has now been run as a bounded
termination test rather than an open-ended search. The most important result is
mixed but informative:

- one iteration passed all nine item gates;
- two further iterations failed;
- controls mostly held;
- branch-valid tutor adaptation remained visible;
- recognitive closure downstream of peripeteia did not repeat stably.

The completed loop is:

```text
phase2-adaptation-recognition-loop-20260527T105617Z
```

It ended at 1 pass out of 2 required. This is not a collapse of the mechanism.
It is a sharper localization of the remaining problem. The tutor can break
habit and introduce a fitted public device; the learner can perform the device;
but the final learner turn still sometimes reads as procedural success rather
than explicit re-reading of the prior difficulty.

After that result, the generator and structure critic were tightened. The
`peripeteia-only` branch now requires the final learner turn to perform the
device, name the old check or pressure, and state the replacement check. The
structure critic now rejects peripeteia arms that do not contain both an
old-check/pressure frame and a replacement-check frame. That means the next loop
will spend external critic calls only on scripts that already show the public
action-to-re-reading bridge.

The current landing claim is therefore:

> We have a working mechanism-discovery apparatus and one clean full-loop pass.
> We do not yet have repeat-stable proof that adaptation reliably produces
> recognition. The remaining engineering task is to make actional performance
> reliably become public reorientation.

The generated evidence policy is also settled. Raw transcripts, full traces,
scores, and per-run keys should not be committed. Completed runs should be
packaged with `npm run poetics:package-run`; ignored compressed archives live
under `artifacts/poetics-runs/`, while compact manifests are committed under
`config/poetics-calibration/runs/`. The archive payloads still need durable
storage outside Git before a worktree is deleted.

## What The Durable Output Should Be

The durable output is not just a prompt. It should be three linked artifacts.

First, a **mechanism specification**:

```text
learner state:
  ordinary uncertainty | aporia | pseudo-catharsis | resistance | actional trial

tutor action:
  continue | elicit | withhold | reframe | change device | demand performance

public outcome:
  flat | trap | actional breakthrough | recognition | pseudo-recognition

validity checks:
  no baseline leakage | branch-local pressure | public habit-break |
  learner performance | re-reading of prior difficulty
```

Second, a **state-action-outcome dataset** drawn from curated sidecar cases, not
the entire raw generation archive. This should include public transcripts, full
private traces, critic labels, human/theory labels where available, and
diagnostic fields.

Third, an **adaptive tutor control loop** that can be carried into the main
architecture:

```text
observe learner turn
-> classify learner state
-> choose tutor mechanism
-> generate tutor response
-> check for answerability and public mechanism visibility
-> observe learner action/re-reading
-> update state
```

Machine learning begins only when the curated cases start changing future
behavior: fine-tuning a classifier or policy, training a reward model, selecting
prompts through bandit-style feedback, or supervising a state detector. Until
then, the work is prompted architecture plus structured evaluation. That is not
a weakness; it is the necessary instrument-building stage.

## Paper Implication

If the paper is updated, the update should be conservative:

> Paper 2.0 found adaptive responsiveness null as a general trajectory
> mechanism. The dramatic-recognition sidecar refines that null by isolating a
> narrower mechanism: tutor answerability to learner aporia. Current evidence
> supports public recognitive reframe under clean controls and mechanism-level
> tutor adaptation under clean-anchor peripeteia pressure. It does not yet
> establish robust recognitive closure as the ordinary downstream result of that
> adaptation.

That framing preserves the integrity of the last paper while making clear why
the new branch matters. The arc is not a contradiction. It is a sharpening:

> from measuring whether tutors adapt on average, to specifying what adaptation
> would have to be.
