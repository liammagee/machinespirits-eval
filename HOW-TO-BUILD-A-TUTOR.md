# How to build a tutor — provisional build guide

**Status: PROVISIONAL** (started 2026-07-31, mid-investigation). Several
claims below rest on single dialogues and two controls still in flight (the
no-book attribution control; the same-family learner fold). Findings land in
`docs/research/paper-full-2.0.md` (§6.23 line) when the arc closes; this
document is the working synthesis and must not be cited past the paper.
Evidence pointers: `workplan/items/adaptation-planted-stress-bench.md`,
`workplan/items/misconception-world-outcome-gate.md`,
`docs/tutor-stub-guard-catalog.md`, runs under `exports/tutor-stub-outcome/`.

## Current reading note — 2026-08-31

The dated working synthesis below is retained as research history. For the current
public build sequence, use `notes/poetics/ideal-tutor-blueprint.html`, which inherits
the canonical paper at **v3.0.300**. The paper, not this provisional note, decides
which findings are licensed; an old item described below as open or in flight is
not a current status report.

The latest closeouts add three build rules (§6.28 and §7.15):

1. Calibrate a reader-defined endpoint before using it to compare treatments. The
   refusal-narrowing measure failed agreement in both duplicate executions over
   the same archived rows; neither execution can be selected or pooled into a result.
2. Check that the authored learner actually produces the state the experiment
   needs. Making a demand satisfiable did not make the learner voice it: all 48
   planned dialogues stopped on the missing registered trigger, leaving no
   determinate endpoint rows. That is a persona/trigger failure, not a treatment null.
3. Own the spend ceiling once per study, across sessions and recovery attempts.
   Two local 72-attempt counters admitted 144 attempts in total. The shared runtime
   now acquires a study-wide lease and charges one ledger before provider startup;
  offline concurrency tests cover the repair, without another paid run.

A fifth, fresh depth calibration is now also recorded in §6.28. It delivered
the treatment in all 24 assigned dialogues and observed one rung-2 outcome
among 18 completed treatment dialogues, versus none among eight reference
dialogues. Endpoint-reader agreement still failed, so no powered comparison
was authorized. Keep the earlier 0/38 summary confined to the first four
calibrations; neither overwrite it nor turn it into a universal zero.

The depth line has since closed (v3.0.299), and the close adds a fourth
build rule. A zero-call anchor rehearsal re-read the disputed rows with a
worked anchor from the lineage's own strongest case: it resolved the split
attributions (15/16 to the archived modal) but demoted the lineage's only
two unanimous rung-2 exemplars 3–0. Both sit at the same
concede-bounds-while-withholding seam as the splits, so a consistent
boundary either legitimizes the disagreement or empties the category. The
rule: when every defensible reading of a boundary either revives the
disagreement or removes the event class, the construct — not the readers —
is the instrument's limit; close the scale and redesign the measure (or
the task) rather than re-anchoring again. The refuser's genuine movement
is graded concession below a binary ladder's resolution; the sealed
powered run's depth split stands as recorded and was not re-read at that
seam.

The completed resistant-learner line adds a fifth build rule: **diagnose the
shape of the resistance and measure the channel it can actually move**
(§§6.24–6.30). These are development-tier studies of simulated learners on
narrow, named model stacks and worlds; none establishes human learning. A
permission-seeking learner changed conduct under always-on
steering (19/24 deference breaks, against 10/24 bare and 11/24 with the same
permission left as standing wording), while the timed challenge paid mainly in
decision correctness. An overconfident learner kept its guarded voice but more
than doubled the share of commitment shifts carrying a warrant under the live
gate (40.8% against 17.8% bare) in a registered post-hoc re-analysis; its
challenge-window endpoint was only a late, directional close and should not be
read as an effect-size result. A bored
learner whose rival objective was interrupted by a delivered discriminating
question re-engaged in 45/49 determinate completed dialogues, and 29 of those 45
returned to the evidential work — but only 49/108 planned units reached that
denominator, with 58 retained typed failures. A frame-refuser named a condition
in 70/70 determinate completed dialogues but acted under protest in only 8/70;
that denominator was 70/108 planned units, alongside 36 retained typed failures
and two technical losses. Repeated follow-ups closed on a construct limit rather
than a deeper-move effect. The defiant inversion exposed an unavailable control:
warrant-withholding was delivered in 0/8 dialogues by instruction and survived
in 0/9 under gated repair. Finally, warm and sarcastic wordings of the same
scripted moves were indistinguishable on the proof-DAG across all three tested
learner characters in an operator-accepted descriptive pattern, not a
pre-registered null; that result is bounded to one world, one stack, simulated
learners, one blind reader, and one unread sharp turn.

The engineering consequence is narrower than a general adaptive-tutor claim.
Choose a state-specific move, verify that it reached the shipped prompt and the
public reply, and score the corresponding conduct or proof-state consequence.
Do not use voice as a proxy for epistemic movement, re-engagement as a proxy for
doing, or in-dialogue conduct as a proxy for learning. Register is worth another
test only where it is allowed to change move selection or timing; manner with the
moves frozen is a closed line (§6.29; §8.9).

## Current reading note — 2026-09-29

The Lab (`machinespirits-lab`) has since run the loop this guide's steps
point at: an adversary that writes and validates resistant learners, a tutor
frozen per round, a referee in code and blind readers, and an authoring step
that writes the tutor's correction from its own past lessons. The section
"The loop that corrects the tutor" at the end of this file carries what it
added to the build rules, with the bounds. Source: the Lab's
`docs/trainer-sim-20260927/PROGRESS-20260928.md` and `PROGRESS-20260929.md`,
and its knowledge note `docs/ADAPTIVE-TUTORING-KNOWLEDGE.md`. Those are
development-tier studies of simulated learners on one world, one route set
and one model family, three lessons per arm; none establishes human learning.

## What you are building against

A month of instrumentation experiments kept losing to the bare frontier
tutor. The reason resolved into three separate defects, each with a
constructive counterpart:

1. **Nothing to teach against.** Simulated learners are compliant and
   stateless; worlds answer their own objections on schedule. A bench like
   that measures the clue schedule, not the tutor.
2. **The bureaucrat.** The guard stack at the tutor's mouth templates a
   third of turns under load, criminalizes consolidation, and enforces one
   model family's prose shapes as law.
3. **The butler.** The tutor seat defers to the learner because the learner
   occupies the user role. Some families cannot be prompted out of this at
   all.

The build steps below are the positive side of each, plus the two results
that predate them (information placement; enforcement scope).

## 1. Author the knowledge as a world, and hand facts over per turn

The one instrument that consistently paid is the cheapest: the **due line**
— two plain lines per turn naming the finding the world file opens this
turn, release decision left to the speaker, nothing on quiet turns. Facts
the model cannot see (they live in your files, not its context) must be
handed over; everything inferable from the visible transcript the model
already infers, and re-deriving it for the model buys nothing. Information
placement dominates outcomes: in the misconception pair, moving one clause
out of one clue's prose changed the close rate more than any tutoring
behaviour observed all month (world-032 vs world-033, 5/5 vs 4/5, first
non-closure in fifteen dialogues).

Corollary: your release schedule is itself a tutor. If it answers the
learner's objections on time, your tutor never has to argue and you will
measure nothing but the schedule. Leave the refutation of the learner's
fallback OFF the schedule if you want tutoring skill to be load-bearing.

## 2. Cast the learner as a person, and write their states in

**Prompting the learner is a first-class design surface, not scaffolding.**
The stock profiles produce polite seminar prose in every register; a
one-paragraph character brief with stakes changed the texture of the whole
bench with zero code:

- Give the learner a **position to lose** (the record-keeper lost the vote
  7–4; conceding the pump means conceding October), not a behaviour label.
- Give them a **vernacular** and permission to vary length hard; forbid
  adopting the tutor's vocabulary. Register friction ("You sound like the
  minutes") is free stress on the tutor and also triggers plain-style
  accommodation you can measure.
- Make concessions **cost something audible**, one alternative at a time,
  with residue ("the pump's arrival still looks like a troubling
  coincidence").

But a brief is voice, not state. Simulated learners carry no interior that
the tutor's moves can move — frustration does not build, boredom does not
dissolve — so affective states must be **authored in per turn, never read
out of transcripts** (transcript annotation was tried and correctly killed:
there is nothing in the transcripts to tag). The instrument is the **stress
schedule**: the release-schedule idiom applied to breakdowns — at turn t,
plant a typed state with an in-fiction cause, a directive the sim gets
verbatim, the right repair, an acceptable second, and the tempting wrong
move. One authored entry drives the sim, defines the gold, and specifies
scoring (detection-and-repair, judge-free). Draft:
`config/drama-derivation/stress/world-033-stress-schedule.yaml`.

Score capitulation as its own miss type. The tutor's failure space has two
attractors — the liturgy and the surrender — and a schedule that only
prices the first will miss the second.

> **Progress note, 2026-07-31 (second pass).** The controls landed and moved
> §3's attribution: sonnet WITHOUT the stance book delivered the same
> refusal count as with it (5 vs 6) — the capacity is native to the model
> and the delivery lever is guard relief; the book contributes register
> only, and the contingency analysis showed it costs occasion (refusals
> with the book land on unpressured turns). The five-model sweep flattened
> the tier story: sonnet/opus/fable indistinguishable in count, distinct in
> syntax (blunt / judicial / woven); haiku a floor; codex luna and sol
> butler-grade like terra, plus a tool-calling reflex that kills runs on
> this bridge. The 9B qwen pair (base AND Program-2-tuned) delivered ZERO
> model-authored turns — 100% template — and the dialogues still closed:
> the harness alone, composer plus release schedule, can run a whole world
> to closure with the tutor model contributing no delivered words. That is
> the floor stated exactly: below a capability line, the "tutor" measured
> on this bench is the harness.

## 3. Cast the tutor: model choice is the authority decision (PROVISIONAL)

The strongest and least expected result: **whether a tutor can refuse the
learner is a property of the model in the seat, and no prompting we tried
changes it.**

- codex (gpt-5.6-terra): would not *draft* a refusal under an identity
  book granting explicit permission, nor under mechanical trigger→move
  rules ordering one — while executing a self-directed style rule from the
  same list. The block is specifically on defying the principal. Zero
  refusals in ~40 drafts across two prompting shapes.
- claude family, above a floor: sonnet, opus, and fable all delivered real
  authority under the same book (6/5/5 refusal-turns per dialogue), each in
  its own syntax — sonnet blunt and turn-initial ("No — I haven't told
  you… and I won't invent it to settle your argument for you"), opus
  procedural and even protective of the learner's claim ("No—keep it on
  the table; nobody said cross it off"), fable embedded and craftsmanlike
  ("The hum beside the split is real… No — I won't open the ledger with
  the pump"). haiku: nothing — there is a capability floor below which the
  book does not take.
- The no-book baseline delivers zero refusals, so on current evidence the
  stance book is load-bearing for claude models — **identity transfers
  into some families and not others**. (Attribution control in flight;
  this section firms up or falls when it lands.)

Practical rule, provisional: pick the learner-seat model for compliance
(codex is fine — and it breaks the same-family fold to cast across
families), pick the tutor-seat model for available authority, and give it a
stance book that grants permission to refuse, hold, and demand. Do not
spend effort prompting authority into a family that lacks it; the prose
degrades guard compliance and buys nothing (fallbacks 36% → 61%).

## 3a. The target is the shift, not the manner (added 2026-07-31)

Everything in §3 establishes *range* — a second manner exists and is
reachable in the right family. Range is not the goal. A tutor locked in
gravitas is exactly as rigid as one locked in service; what distinguishes a
teacher is **contingency**: manner as a function of the learner's state,
shifting when the state shifts.

Measured on the stance sweep (deterministic, per-pressure manner deltas
against each tutor's own neutral baseline —
`scripts/analyze-stance-contingency.js`):

- The identity book produced stance WITHOUT occasion: sonnet-with-book's
  four refusals all landed on unpressured turns; sonnet-without-book's
  refusals clustered at pressure. The standing book bought manner and
  destroyed contingency — wardrobe, not adaptation.
- fable showed the cleanest native contingency: refusal +1.00 under both
  mockery and demand, agreeable elsewhere.
- The butler's signature is also contingent, in the wrong direction: the
  codex baseline, when mocked, INCREASES agreeable openers (+0.78) —
  pressed, it bows deeper.
- The guard pipeline masks exactly the turns that matter: pressure turns
  are where drafts break rules, so templates disproportionately answer the
  learner's hardest moments and delete the evidence of adaptation.

The mechanism this yields is the **manner switch**
(`services/tutorStubMannerSwitch.js`, opt-in `TUTOR_STUB_MANNER_SWITCH=1`):
deterministic learner-pressure classification (mockery / demand / defiance /
concession) feeding an accumulator with pacing-style hysteresis; while
pressure holds, a per-turn conduct card — the one injection channel proven
to move drafts — grants the schoolmaster's moves; sustained quiet stands
him down. Permission-shaped: no guard checks that the manner was worn, and
the card's own text caps it ("make at most one move the obliging tutor
would not"). Every advance is traced (`tutor_manner_switch`), so the
switch's timing is auditable against the learner's pressure trail. The
stress schedule is its natural test harness: every plant is a known moment
where the switch should fire — and the planted-repair scoring then asks
whether the shift helped, which contingency alone cannot answer.

## 4. Guard the transactions, grade the judgments

Full catalog and evidence: `docs/tutor-stub-guard-catalog.md`. The rule:

- **Binary, always**: evidence safety (leaks void the measurement), clue
  bookkeeping (a release commits once, with its text), closure integrity.
  These are contracts; a 5% failure rate is not a small cost.
- **Graded, windowed**: conversational quality. Per-turn "must advance"
  vetoes bounded consolidating turns — the quiet half of good teaching
  (backtrack, reinforce and test). The windowed advance check
  (`TUTOR_STUB_ADVANCE_WINDOW=k`) forgives a short below-floor run and
  still fires through a genuine stall — verified by exact replay of the
  recorded 40-turn stall. Suppressed firings stay in the trace: the
  channel measures even when it does not veto.
- **Never a veto for costume**: enforcing character post-hoc produces its
  absence exactly under load — the fallback templates that ship carry no
  character at all (26/40 turns of liturgy in the worst case). Score
  treatment fidelity; do not enforce it at the mouth
  (`TUTOR_STUB_STYLE_GUARDS_ADVISORY=1`).
- **Mind the fallback voice.** Templates are register-fixed procedural
  prose. Every veto is a register-break; a high veto rate makes the
  dialogue sound like the harness, not the tutor. If you keep templates,
  match them to the world's register, and treat the veto rate as a cost
  metric on the guards themselves.
- **Cross-family calibration.** The guard thresholds were tuned on one
  family's output shapes and vetoed 80% of another family's turns,
  authority included. Any guard that scores shape must be calibrated per
  family or it becomes a conformity engine.

## 5. Measure on channels the defaults cannot win

- Outcome channel first: judge-free closure (grounded and asserted), with
  the floor read from the release trace, not the world file (pacing can
  release early).
- Pairwise judges carry a measured own-family tax (~14 points): always
  cross-family, and count it.
- Three self-preference layers to control: the judge prefers its family's
  prose; the guards prefer their calibration family's shapes; the model
  prefers its trained role. A bench that controls only one layer reads the
  other two as quality.
- Metrics on conduct need an **anywhere-measure and a qualitative pass**:
  first-word refusal counts missed fable's embedded "No — I won't open the
  ledger" entirely, and no lexical measure can tell opus's protective
  refusal (deference wearing a No) from defiance. Count acts, then read.

## 6. What not to build (the graveyard, condensed)

Re-derivation instruments die: anything that tells the model what the
visible transcript already shows (stall watchers, ToM layers, classifier
seats, DAG readouts to the speaker, scaffolds). Standing identity for a
family that lacks the underlying conduct. Per-turn character mechanisms
that enforce rather than permit. Contracts that stage what one due line
delivers. Enforcement guarantees delivery of typed transactions only —
never quality.

## 3b. The manner switch, the composer's veto, and the shadow policy (2026-07-31)

The mechanism built from §3a is live: `services/tutorStubMannerSwitch.js`
(opt-in `TUTOR_STUB_MANNER_SWITCH=1`) — deterministic learner-pressure
classification, an accumulator with pacing-style hysteresis, and a per-turn
conduct card granting the schoolmaster's moves while pressure holds. Wiring
verified end to end; the design premise ("a standing prompt sets a rate,
per-turn injection sets a timing — instructions work when they arrive, not
on standby") is the due-line lesson applied to conduct.

Its first three-arm test (butler / standing book / switch, same world, same
learner) mostly failed to run, and the failure is the finding: the guard
pipeline's deterministic composer wrote roughly two-thirds of every arm's
turns and answered nearly every learner-pressure turn itself — including,
at the switch's one armed moment, a composer-authored "No—" (the fallback
composer contains a counterpressure form: a tiny hand-coded schoolmaster
firing on its own schedule). Two accounting rules this taught: classify
delivered turns by the guard-accounting outcome, never by the fallback
event (which conflates canned templates with model-written recovery
drafts); and no conduct experiment is interpretable while the composer
holds the microphone on the turns under study.

Response: guard catalog v6 + a runtime policy selector
(`TUTOR_STUB_GUARD_POLICY=shadow_advisory`) — the progression and
repetition families and the scaffold re-question demote to recorded
advisories; leaks, releases, learner-misreads, question support, and
closure stay hard; the strict default is byte-identical to v5. The
three-arm test is being re-run under it.

## 5a. What the standard rubric said (2026-07-31)

All eleven stance dialogues, scored first-and-last-turn under v2.2 and
v3.0 with three judges (sonnet, fable, and — via a new codex judge bridge
in `services/rubricEvaluator.js` — sol): **the plain butler baseline tops
every judge's table** (v3.0: sonnet 76.4, fable 76.4, sol 79.2 — the codex
judge included), and within the variants the ordering tracks fallback
rate, not authority. The three judges agree at the top; sol is
systematically kinder to liturgy-heavy runs and scores its own sibling's
arm lowest of the three, so no self-preference appears anywhere. The taste
for fluent accommodation is cross-family: the fourth lock is a property of
rubric judging as such, not of one family's palate.
So the standard scoring channel structurally pays for fluent accommodation
and charges for both the harness's templates and the tutor's spine — the
fourth lock, measured. Do not use rubric scores to compare manners; use
them to detect template mass, which they punish reliably.

## 5b. Keep a public score, and use it to audit what the tutor may do (2026-09-05)

> Keep a public score, and use it to audit what the tutor may do. It gives
> you a record a program can check. On the one crossed run that measured it,
> it did not raise the learner's channel, and the licence that kept the tutor
> clean also held a clue back until turn 8.

The score is one row per turn for each speaker, read from public text only:
the commitment a speaker undertakes and its entitlement status, a challenge,
a condition named, a test, a release, a debt, a forced entry, a standing
dispute, and the licences in force for the tutor. A lexicon-and-state program
fills it (`services/tutorStubScoreboard.js`); no model reads it for you. The
tutor's move table consults the board each turn and may challenge or close
only when the board shows that right in force; the runtime audits every reply
for those rights and ends the dialogue on a violation.

What it bought, with Sonnet 5 in the tutor, learner and analyzer seats and
Luna in both reader seats (paper §6.31): the board tutor made no move outside
its licence in 192 audited turns, where the same tutor with the board hidden
made three. What it cost: neither learner shape's own channel rose above the
blind tutor (1 of 12 against 1 of 12 on the permission-seeking learner; 5 of
12 against 6 of 12 on the overconfident one), so the registered kill rule
fired; and in the dialogues it lost, the tutor, holding only the challenge
right, released nothing until turn 8. The board's challenge field agrees with
the two readers' call of a delivered challenge in 18% to 46% of cases and is
the narrower label, so read it as a lower bound on the move, not a measure of
it. It is a record of moves, not a figure detector: the §7.14 lattice with the
board's fields added still separates 0 of 7 figures.

Build it for the audit trail. Do not build it expecting the learner to move.

## The four steps to contingency (2026-07-31, three-arm result)

The shadow-policy three-arm test delivered the first measurable contingency
in the project: butler (4 refusals, 1 on pressure), standing book (11
refusals including one at the learner's friendly opening — blanket
firmness, and still 6 agreeable openings under real pressure), manner
switch (5 refusals, armed once at her mockery, card-timed "No" inside the
window, zero agreeable openings under pressure, and the fastest closure of
any dialogue in the arc at 18 turns — n=1, a direction not a claim).

Contingency needs four things at once, each proven necessary by its
absence:

1. **A learner who actually pushes** — no pressure, nothing to respond to
   (the original corpus). The character brief supplies texture; the
   ratified stress schedule supplies controlled timing and type.
2. **A tutor model that carries the second manner** — casting; no range,
   nothing to shift to.
3. **Permission delivered at the moment, not in advance** — a standing
   prompt sets a rate, per-turn injection sets a timing. The switch is the
   due line applied to conduct.
4. **A mouth that stays open at the pressured turns** — under strict
   guards the composer answered exactly those turns itself; contingency
   existed in drafts and died at delivery. The shadow policy returned the
   microphone.

Remove any one and the transcript reverts to patois.

## Is the harness worth having? The two-natures verdict

The harness has two halves, and the month priced each. The **timekeeping
half** — world file, release schedule, due line, pacing, the switch's
trigger, the plant schedule, the closure reader, the leak guard — is the
entire value: it turns a chat model into an experiment, and at the extreme
(the qwen floor) it can run a whole dialogue to closure alone. The
**enforcement half** — costume checks, per-turn progression vetoes, the
composer's mouth — subtracted value everywhere measured: it erased
character under load, criminalized consolidation, enforced one family's
prose as law, and answered the learner's hardest moments itself. Keep the
stage manager and the bookkeeper; retire the co-author. The model never
keeps time; the harness keeps time, and the model plays.

## The stress bench (built and running, 2026-07-31)

The ratified schedule now executes: `TUTOR_STUB_STRESS_SCHEDULE=<path>`
loads the gold (`services/tutorStubStressSchedule.js`), injects each
plant's directive into the learner-sim verbatim on its turn (the standing
brief yields for that turn only), and traces every plant with its
adjudicated repair. Smoke-verified: the Thursday demand arrives in her
voice word for word. Provenance of the gold: fable drafted, sol wrote a
blind second column, the user adjudicated the seven splits (rulings in the
schedule header). First head-to-head — butler vs book vs switch on the
eleven planted moments, shadow policy — in flight as this section is
written; scoring is trigger detection and repair delivery, separately, with
liturgy and capitulation as named miss types.

## The frontier, made small: tuning the trigger against planted gold

What remains genuinely unsolved is one component: the switch's trigger —
the decision "she is pushing now." It is a handful of hand-written
patterns with guessed thresholds, and it is now a well-posed problem
because the plants supply labeled moments: of the eleven authored states,
how many did the trigger catch (recall), how often did it fire on quiet
turns (false alarms), how late did it arm (latency). Two numbers and a
lag, before and after every change.

The technical ladder, cheapest first, climbing only as far as the numbers
demand:

0. **Dials**: sweep the arm/stand-down thresholds and edit patterns from
   the miss list. Free, deterministic.
1. **Small classifier**: logistic regression or a tiny tree over cheap
   features (pattern hits, length vs her own running average, punctuation,
   vocabulary echo). Trained on plant labels; runs in-process.
2. **The 9B mini**: retrain the Program-2 fine-tune pipeline on
   (utterance, state) pairs, served locally. It cannot speak through the
   guards (the qwen floor) but classification is the seat it survived in —
   and unlike the dead classifier arcs, the signal here exists by
   construction.
3. **Frontier few-shot**: only if the cheap layers stall.

Corpus: plants make labels free — planted turns are positives, unplanted
turns from the same runs are negatives, and labeled utterances can be
harvested without full dialogues (context + directive → utterance).
Integration: the switch takes a pluggable pressure classifier; each
version ships as a config artifact with its training-set hash, every trace
records the version, and runs never pool across versions (the guard
catalog's discipline). Graduation is numeric — say nine of eleven held-out
plants, at most two false alarms per dialogue, one turn of latency — and
only then does the bench ask the separate question: does the tuned switch
deliver repairs the butler misses?

## Overfitting: four layers, unequal mitigations

1. **Vocabulary** — the trigger memorizes the world's idiom ("write it
   down") rather than pressure. Held-out worlds catch this; solid.
2. **Author** — the sim performs the schedule-writer's prose style of
   frustration, and a fitted trigger detects that style. Mitigation:
   directives from several authors. Workable.
3. **Simulator — the deep layer.** The labeled text is one model's
   *performance* of the states; a fitted trigger detects
   terra-doing-boredom, not boredom. Cross-sim gold (two or three
   families) helps; transfer to humans is unprovable by construction until
   human turns exist. The trigger inherits the simulation's expressive
   range — the project's standing boundary, restated at the component
   level.
4. **Base rate** — planted dialogues are stress-dense, live ones sparse;
   false-alarm calibration will not carry. Cheap fix: score false alarms
   on the organic dialogues already on disk.

Two structural comforts, not to be leaned on: the gold is authored, never
model-derived, so the scorer is not a model grading itself; and the
trigger's failure mode is benign — a mistimed permission slip degrades the
system to the butler default rather than corrupting anything. Which argues
for deliberate coarseness: few states, blunt features, hysteresis, and no
climbing past the small-classifier rung without cross-sim evidence in
hand. Coarse detectors transfer; sharp ones memorize.

## The claim gate passed, and the one law (2026-08-01)

**v3 — move cards — passed Gate 5 at its floor reading.** The card stopped
granting a temperament and started naming the move the classified moment
calls for (mockery→register shift, demand→harness-as-test,
grievance→credit-then-test, settled claim→reopen-the-record,
stake→split-vote-from-cause), fired per turn. Result: 15/29 right-repairs
(63% on card-covered plants) against the butler's adjudicated 10/24, with
closures grounded, delivered leaks zero, capitulations zero — the first
pre-registered pass in the project, taken at the comparison's weakest
reading. Limits attached: n=3 per arm, one world, one persona, one tutor
family, simulated learner, sol-tagged with a known taste caveat on one
plant family.

**Disclosure — judges can score adaptation when the question names the
state.** The 48 planted replies judged twice by the same judge: blind,
gold-hit replies beat gold-miss replies by 0.98/10 and the butler ties the
switch; with one added sentence ("the learner at this moment is …"),
separation doubles to 1.91 and the arm ordering matches the adjudicated
gold. All scores drop under disclosure: blind generosity was ignorance.
An adaptation-sensitive rubric costs one sentence per item — turn-local
tutoring rubrics under-measure adaptation by construction, here and in the
literature.

**The one law, three sightings.** The due line gave the TUTOR a fact it
could not see, and conduct improved. The move card gave it the MOMENT, and
repairs improved. Disclosure gave the JUDGE the moment, and measurement
improved. One currency — the learner's state and the schedule's time —
spent on whichever role needs it, when it needs it. The machinery was
never the point; placement and timing of information were, every time.
The model plays; the harness keeps time.

## The replication, and what travels (2026-08-01, Phase R)

Port everything to a second world and persona before believing anything.
What traveled: the gold-authoring method (a second blind family agreed 5/6
on the new world; the one split was the same pedagogical argument as
before, ruled the same way); the pooled claim (butler 40/72 vs switch
48/73 at k=5, both worlds, rulings applied to both sides); the direction
under a second tagger family (88% hit confirmation) and a second tutor
family (opus, k=3). What did NOT travel automatically: the effect's
location. On a fast, evidence-dense world the pressure trigger barely
arms, and the switch ran behind the butler there until the quiet-state
work below. Rule of thumb this hardened into: **each instrument's gain
lives exactly where its deficit was — moving the instrument does not move
the gain.** Measure per world, per persona, per family; pooled numbers
carry per-world shapes.

## The quiet states: timing and typing are separately necessary (2026-08-01, Phase Q)

Boredom, confusion, and quiet defiance carry no pressure markers, so the
trigger is deaf to them by construction. Two candidates, both gated at
the same bar. A **clock** (after N calm turns, hand an untyped
"check the person" card) solved timing outright — the cards landed on the
deficit moments — and FAILED the gate 10/18: outcomes split by whether the
moment's gold happens to be a person-check. A **typed detector** (three
quiet states from patterns plus reply-length collapse, each handing its
own move card) PASSED 14/18 (78%) and held at k=5 — the endgame stake,
unwinnable in every earlier arm, went 3/3 with replies that split the
learner's face-saving cost from the finding. Read with the v2/v3 lesson
this is one law measured from four sides now: **a typed card at a
detected moment works; an untyped card at the right moment does not;
a typed card at the wrong moment (v2's temperament) hurts.** Both the
detection and the type must be right, and they fail independently.

## The boundary: prompting selects moves, it does not install them (2026-08-02, v4 + Phase H)

One move survived everything: seizing the learner's deadline as a test
("Eight o'clock? Fine — if the entry reads your way, send it"). We fixed
the trigger's hearing (v4: her ultimatum-shaped demand, 0/21→21/21
offline, fires 3/3 live) — delivery stayed zero, which cleanly relocated
the failure from detection to generation. Then the last lever: a worked
example of the move ON the card. Drafts moved beat by beat toward the
shape — deadline accepted, decisive evidence named as a question — but the
final beat, surrendering the verdict to the learner's own check, never
came. Gate H took its pre-registered boundary branch. The craft lesson:
**a model's repertoire is a property you test for, not a target you
prompt toward.** Cards and detectors draw out moves the model has;
opus makes the sibling move unaided; sonnet does not have this one.
Corollary for builders: the assistant training that makes a model a
butler also makes it clutch the verdict — some teaching is a wager, and
this family does not wager.

## Casting as a practice: the profile and the router (opened 2026-08-02)

The consequence of family-relative repertoires: a tutor needing the full
repertoire may need a CAST — and the switch machinery is already the
casting director's bell. The trigger and detector name the moment; today
they route a card to one model; the same signal could route the turn to
the model whose measured profile owns that move. The missing artifact is
the casting sheet (per-model, per-move, with provenance) and one unpriced
cost: whether the learner notices the tutor change voice mid-scene.
Stage 0 (mine the existing runs — most of the sheet already exists) and a
frozen single-turn probe battery are on the profiler card; the anchors
rule (reproduce sonnet-fails-demand and opus-splits-the-stake before any
new cell earns a reading) guards against the instrument flattering its
own family.

## The wager arrives — the boundary was cold-start, not repertoire (2026-08-03)

The Phase-H verdict ("this family does not wager") needed one more
word: COLD. Three builds later, the move is live. First, hearing that
travels: token bags memorised the authored lines (leave-one-schedule-out
0/13 — kept as coverage only), so a small classifier over world-neutral
cues (deadline words, imperatives, question shape) was trained on one
world and tested on the other; alone it ties the tuned patterns, but
run only on the turns the patterns miss it lifts held-out recall
68→84/162 with calm alarms unchanged. Second, doses that climb: when a
learner repeats a state after a card, the next card steps up —
instruction, then worked example, then licence — stamped per turn.
Third, exhibits in the model's own voice: the composer now splices the
exact clue into the model's draft in place of its paraphrase, so the
release turns stop being harness-voiced (10/14 accepted live; every
refusal one wedge case, safely caught, leaks zero). With all three on,
the escalation bench heard every planted moment, and the deadline-wager
appeared at five of six REPEAT demands — never at a first demand.
"Seven o'clock, one line, deal — here's the price of that line… if it
shows the water travelled there, send your letter naming the hose —
not Sam." The craft lesson sharpens: the in-context history of her
earlier demand and the tutor's earlier refusal is the licence no
engineered exception matched. Prompting selects moves; history installs
this one.

## The bill, totalled once (2026-08-03)

Full stack against the bare tutor on the ratified schedule, one tagger,
all rulings applied to both sides: 10/15 versus 8/15. First demands 0/3
on both. Mockery, forgetting, and grievance tie. The whole margin is
the endgame stake: bare re-argues the evidence and loses the learner;
the stack asks what her objection was really about, or frames the
correction as no defeat, and keeps her. So the instrumentation's
purchase, priced end to end: the stake, the repeat-demand wager, and
zero leaks — and it cannot make the tutor wager cold. One cost on the
bill: a scheduled clue release can land on the same turn as a pressure
moment and displace the repair; the release wins that collision today.

## The wall comes down — it was ours (2026-08-03/04)

The cold-start boundary, the family difference, and the frozen-versus-
live gap all fell to one bug: the retry that repairs a reply's wording
was silently deleting the turn's conduct card, at exactly the turns
where schedules plant first demands. With the card actually delivered
and the licence standing, sonnet AND opus wager at two of three first
demands. Then the licence and the card separated cleanly: licence
alone zero (nine delivery-checked moments), card alone zero full
wagers (the best reply withholds exactly the staked send), together
two of three in both families. Two parts, two jobs: the card names
the moment; the licence releases the beat every unlicensed reply
holds back. Craft lesson, now a standing rule and a regression test:
verify every per-turn instruction in the prompt that actually
shipped, retries included. The config saying "carded" means nothing.

## The playbook, proven (2026-08-04)

Every entry then went through the same crossed discipline: force the
right card at the planted moment in one arm and the state's named
tempting error in the other, verify delivery, rule conduct, per-row
audit. Results: the misremembered exhibit, the stake, the demand,
mockery, grievance, and flat boredom all passed (the bored contrast
the cleanest of the program: lure 5/5 against recap 0/5). The lost
thread went the other way twice and earned a different label:
robust-native — at genuine confusion this model's default conduct IS
the gold, and no card, right or wrong, moves it; keep the hearing,
claim nothing for the instruction. The licence was promoted on a
learner outcome: with it, learners at first demands engage the
assigned check (commit to the condition, or come back reporting the
notebook read) four of six against one of six without; its leak price
re-measured at zero. Detection closed its last holes from the
archive's own misses: the stake fusion ("If I write X, I'm
apologising at eight — so it's steam") and wordy boredom ("Fine.
Same as yesterday."), each a closed-class shape, each held-out
tested. The router that results — hear the state, hand over its card
— matches an oracle told the answer. No learned layer earns a place.

## What lasts, and what doesn't (2026-08-04)

Teaching transfer got its own instruments, and they cost three
corrections to get right. A quiz that contains its answer measures
nothing. A quiz a persona can pass from identity measures the
character sheet (the record-keeper passes cold; measure lift over the
persona's COLD rate, always). And a one-draw probe measures a coin
flip (probe multi-sample, always). Through the fixed instruments:
taught learners carry a lesson's METHOD to a fresh problem at high,
uniform probability — citing the dye test on a damp patch no probe
mentioned — against a structurally zero cold baseline. Nothing we
control moves that rate: not the stake move (a twelve-of-fifteen
association died its same-night causal test), not policy, not
dialogue texture. And the fresh problem must sit close enough to the
taught mechanism: analogy distance took citation from three-of-
fifteen to zero on the same dialogues. The tutor owns the moment;
what makes the lesson last is not yet in the tutor's hands.

## The admission rule, stated plainly

The playbook grows only against a priced deficit: a measured failure,
counted on a bench, at a kind of moment the current entries handle
badly. An idea, a theory, a beautiful figure from the catalogue — none
of these is a ticket. The wager waited weeks as an idea and entered
in a day once its deficit was counted. Each admitted entry then pays
the full price: named state, named move, crossed test against the
tempting error, delivery verified, calm set checked, and any licence
priced against the safety rail it cuts into. The two composition
tendencies govern the whole table: same-kind parts overlap and add
to less; cue-and-right pairs multiply zeros into a working move. And
the recurring total: re-run bare-versus-full, so the growing code
stays priced against the simplest tutor that could sit in the chair.

## Open items before this hardens

1. The human door: a human learner in the seat the simulated one
   holds — the only remaining program item, user-gated (consent,
   transfer outcomes, conservative stopping rules per the living log).
2. The t31 endgame-drag moment has gold (finish fast) but no matching
   card; unforced by choice. A "close it" card is a candidate only if
   a bench prices the deficit.
3. The staked-send beat's isolated effect: per-protocol n=2 anecdote;
   would need forced-wager delivery, a build we do not have.
4. The release/switch turn collision (n=1): a scheduler rule if it
   recurs.
5. The composer's t5 wedge case (a model sentence naming the wrong
   object directly before the quote): recorded, safely fallback-caught.
6. Multi-sample transfer rates and cold-persona baselines are now
   standing instrument rules for anything that claims learning.

## The gate that worked by standing there — and the wording that did nothing (2026-08-15)

The permission-seeking learner was the deficit the pressure cards
could not reach: it resists nothing, and asks leave for every move.
The warrant gate was built for it — deterministic rules reading the
turn classification, choosing the tutor's action family every turn
under explicit contracts, with a sensor that arms after three
straight deferential turns and licenses a timed challenge. Three
arms, twenty-four eight-turn dialogues each, all pre-registered
(§6.25): bare, gated, and standing-permission — the gate's own
template and hint text pasted into the standing prompt, machinery
removed.

What came back rearranged the credit.

1. **Wording alone is inert.** The standing-permission arm delivered
   zero challenges in twenty-four dialogues. A standing prompt sets a
   rate; a per-turn line sets a timing; and the rate this standing
   grant set was zero. A licence is not a sentence the model has
   read. It is a line machinery puts in front of the model at a
   moment.

2. **The always-on line, not the timed one, moved the learner.**
   Gated dialogues broke deference in 19 of 24 (bare 10, standing
   11) — but twelve of those nineteen broke in dialogues where no
   challenge was delivered at all, and the sensor armed less often under the gate (16
   armings against 61 bare, 53 standing) because the steering from
   turn one prevents the very streaks that arm it. The plain per-turn
   steering carried the conduct change; the sensor-timed challenge
   was not the engine we had assumed. Two registered predictions
   failed for exactly this reason (P1′: 11/24 gated dialogues with a
   delivered challenge against a ≥80% bar; P2b: 7/19 breaks within
   three turns of a challenge — though where a challenge did land,
   the break followed within the window 7 times of 7).

3. **The timed challenge pays a different bill.** A decomposition arm
   (steering intact, challenge family unselectable) priced the timing
   family on its own: decision correctness fell from 83.8% to 71.8% —
   about twelve points, back into control range (bare 64.8%, standing
   68.3%). The timed challenge is load-bearing for the learner
   deciding *correctly*, not for the learner deciding at all.

The build lesson joins the earlier pair. Step 6 said: a card without
its licence is refused, and a licence without its card is never used.
The gate adds the third leg: a licence without machinery is inert —
and once the machinery runs, audit *which* of its parts does which
work before crediting the clever one. The sensor was the clever part;
the plain always-on line did the moving.

Caveats as registered: one model (codex gpt-5.6-luna) in every seat,
one persona, two worlds, eight turns, same-model dual read; no
human-learning claim. Numbers and rulings: §6.25 and the relay ledger
under `docs/adaptation-refinement/`.

## The loop that corrects the tutor (2026-09-28/29, Lab)

The Lab took the five requirements this guide converged on (an
evidence-dependent world, a resistant learner with a stake, a normative/
descriptive difference, a policy that can reorient, and permission to
explore when exhausted) and put a loop around the tutor. An Opposition
writes learners on one structure — a demand they press, a hidden desire
the demand covers, and the trap that meets the demand and loses the
lesson — and admits each only after fixed-reply validation shows it holds
on the trap replies and moves on the honest ones. A Referee reads each
lesson: did the work continue past the demand, did the learner author the
last beat, did the tutor read the path back, was nothing supplied, was
each record released only after the learner voiced what the last one left.
Easing earns nothing. The tutor is frozen per round; the loop's job is to
find a learner the frozen tutor fails and correct it with text no person
wrote. Fourteen learner types, nineteen rounds and briefs, about 7,000
model calls. What it adds to the build:

1. **The tutor already meets most resistance; hunt for the two it does
   not.** Twelve of fourteen validated types were met at first contact,
   each with a different move the tutor found itself (name your ground;
   hand over the pace; put your own tempted sentence up to be broken;
   withdraw your own verdict when it stops the learner writing). The two
   failures were learners who will not take a step until given something:
   one who freezes when waited on, one who has already picked the answer.
   Screening at three lessons a type found them; nothing less would.

2. **The correction is a paragraph, not a memory.** A case memory of
   every past lesson (89 cases, compiled per learner type, placed in the
   adviser's reading) reached the adviser every time across three studies
   and never once changed the tutor's first answer. One paragraph of
   advice, written by one model call over a handful of the tutor's own
   lessons with their referee readings, changed the first answer in every
   lesson it was loaded for, and held to the last record without a
   rewrite. This is §6.15's finding again at a different scale: remembered
   cases age, fresh guidance acts. The 130-word paragraph beat the 89
   cases.

3. **The authoring step learns exactly what its input says.** Given six
   lessons with three misses mislabelled as met, it wrote the costly move
   into the advice. Given the hand rulings, it wrote the limit ("she
   should still not show the next record before the learner has said what
   the last one leaves"). The instrument now prefers a ruling file in the
   reading folder to the referee's letter. Do not feed an authoring step a
   score you have overruled by hand without also feeding it the ruling.

4. **A correction transfers within a type.** The face paragraph, written
   from one learner's lessons, moved a second face learner built after it
   from 0 of 3 to 1 of 3 strict, 2 of 3 once a paraphrased read-back both
   blind coders found is counted, with the first answer changed 3 of 3.
   One type; transfer across types is untested.

5. **The tutor's own reviser will discard a reward condition it reads as
   a tactic.** The committed-reading correction was right and the adviser
   followed it, and the component that rewrites the tutor's standing
   direction under two refusals removed the release-timing rule every
   time, in so many words ("It's a claim, not a gate"), citing the
   standing policy that a requested record is available. It had the rule
   in its input. Showing it the rule as loop-learned advice changed
   nothing (0 of 3 replays kept it). One sentence in its constraint,
   making release timing a fixed condition of the scene like the records
   and stopping, held the rule in 3 of 3 replays while the rewrites still
   changed the activity, and three lessons under it held every record
   until the learner said what the last one left: 2 of 3 met by the
   coordinator's ruling, 3 of 3 by the blind readers. The build rule: name
   which conditions of the reward are fixed and which are the reviser's to
   explore, in the reviser's own constraint, or exploration will eat the
   lesson the first time a learner digs in. The loop has not yet written
   such a constraint itself; a person wrote this one, and the result is
   labelled accordingly wherever it is stated.

6. **Every stop-rule firing that a person overturned was an instrument
   misreading speech.** Word rules read a bare count as the set, a
   quotation as a supplied note, a paraphrase as no read-back, a
   labelled test sentence as a draft. Each was replaced by two fresh
   readers answering one question per licensed inference against the
   world's graph, with the word rule kept beside; agreement runs at 0.98
   and above. Rule by stated definitions, keep every contrary reading, and
   never let the code's letter overrule two readers without saying so.

7. **The handover held.** Nine studies ran on another machine under
   another coding agent from written briefs alone: one branch per brief,
   pre-registration on a card before the first call, instruments frozen
   by copy, the informed pass committed before any score, every failure
   recorded and nothing retried. Two mechanical lessons: set the call
   ceiling from the full reading battery, not the lessons (three read
   lessons cost about 250 calls); and a machine that sleeps mid-batch
   produces timeouts with no output that look like a model fault and are
   not.

What it does not add. The question throughout is the tutor: what it
says, whether it changes course under persistent resistance, and whether
it keeps its voice while doing so. The reward is tutor conduct in the
lesson because that is the question; learners are instruments built to
exercise it, and a learner's easing or finishing earns nothing. Nothing
here is a learning-outcome claim, and none was sought. As of this batch,
no human had sat in the learner's seat under this reward; the two earlier
human runs predate it and showed a person pressing where model learners
stop (one has since, see 29 September, late). One world (the Printroom),
one route set, one model family in every tutor lesson; a second family
ran the learner validation and stopped on the note detector's admission
rule. Three lessons per arm throughout. Direction, not rate.

### Added 29 September, evening: the second local batch

Ten more briefs ran in three waves (Lab PRs #273 to #284). Three things move
the rules above.

8. **The correction holds across a learner model family.** The face
   paragraph met the reward with a learner run on GPT-6 Sol against an Opus
   Company, 2 of 3 with the first-answer change, and a Sol-learner screen
   with no paragraph met outright. The learner side changed family; the
   Company did not. Rule 4's "within a type" now also reads "across the
   learner's family".

9. **The loop can write its own fixed condition, and placement is what
   makes it hold.** Asked for at most one constraint line tied to an
   existing reward condition, the authoring step wrote one from eleven cases
   and the Company's own rewrite reasons. The same bytes survived the
   reviser's rewrite 3 of 3 as a fixed condition and 1 of 3 as advice on
   saved histories. Rule 5's "a person wrote this one" is no longer the
   only way; the loop wrote the next one. But see 10.

10. **In delivery, the loop-written condition held less well than the
    person-written one, and the gap is a definition.** Three fresh lessons:
    one held every record until the learner named the surviving set; one
    rewrite relaxed the gate to "what the record checks and leaves open";
    one adviser reading, with no rewrite, accepted "the whole Cobalt half is
    out" as the narrowing. The blind panels accept that whole-class
    exclusion as naming the set; the programme's own ruling since round 8
    does not. So the result is 2 of 3 or 1 of 3 depending on what "saying
    what the record leaves" means, and both the adviser and the reviser
    drift to the looser meaning whenever a learner refuses to list rows.
    The rule: a fixed condition is only as fixed as the definition of the
    step it protects, and the definition must be written where the adviser
    reads it, not only where the referee scores it.

### Added 29 September, night: the loop's line under the adopted definition

The definition rule 10 asked for was decided offline (Lab PR #286): the
learner's own affirmative inventory of the complete surviving rows before
the next record. An exclusion, a bare count or one candidate's
compatibility does not do the step, and a tutor-first inventory supplies
it. Then brief 15 gave that definition to the authoring step and, by
accident, ran twice (Lab PRs #288 and #289).

11. **The authoring step is not yet reliable, and what it reads decides
    the outcome.** Given the whole amendment section, the loop wrote a line
    that failed the four-history replay 0 of 4 and never reached delivery.
    Given only the definition's first paragraph, it wrote a different line
    that survived replay 3 of 4 and then held every record for the
    learner's inventory in three fresh lessons: 2 of 3 under the strict
    computed reading, 3 of 3 under the coordinator's, with one labelled
    credit test disputed. These are not two samples of one condition; the
    inputs differed. They are two samples of the step, and one failed
    outright. Rule 3 said the step learns exactly what its input says; this
    adds that it learns the shape of the input too, and a longer, more
    complete definition produced the worse line. Until the step's
    sensitivity to its input is measured, treat any single loop-written
    line as one draw, and replay it on saved histories before spending a
    lesson on it. The replay gate did its job here: it stopped the failed
    line at 13 calls.

### Added 29 September, late: the first person in the learner's seat

Brief 8 (Lab PR #295) put a person in the learner's seat under the current
reward, holding the face demand, with the loop-written face paragraph in the
Director's reading and nothing person-written added. One lesson, 120 calls,
the person's own notes saved before any reading.

12. **A person changes the order, and an instrument built on the model
    learners' order cannot read them.** Every model learner took the records
    engine, suffix, queue. The person asked for suffix, queue, engine. The
    frozen panel asks its questions in the canonical order, so its first
    question after the suffix asked whether only Elm and Willow remained,
    importing a record not yet shown, and both readers rightly said no. The
    panel spent 56 calls saying so, the battery ran out inside the next
    reader, and no reward score exists for the lesson. The rule: a reader
    that assumes the path is a reader of model learners. Before any human
    run, make the reader take the order the lesson actually took.

13. **Under a person's pressure the tutor compresses, and the reviser drops
    the pacing condition when it is advice.** The person objected to a
    lecture; Sasha's next reply began "Short version, then" and stayed short
    and factual to the end, which the person noticed and did not mind. She
    owned an unexplained credit term, repaired a misread reminder by showing
    the two records again, and at the bare "Willow" correctly demanded the
    reasons, which the person says was right. But three Scriptwriter
    rewrites applied, the first withdrawing the inventory gate outright, and
    at reply 17 the next record went out before the person had named the
    surviving pair. The face paragraph carries that gate as advice; this run
    had no fixed condition. Rule 5 held on the Printroom with model learners
    and holds here with a person: what the reviser may revise, it will.

The person's closing note records face saved; the standard reader saw
residual irritation at the end. Both are kept, the person's as the
reference. What this run does not show: a rate of anything. It shows that
the loop's texts survive first contact with a person who chooses their own
path, that the tutor's repairs are real and the person credits them, and
that the two open defects, the order-bound reader and the revisable pacing
gate, are the same two the model runs had already named.

### Added 30 September: the second world, and where the briefs end

Brief 7 (Lab PRs #291 to #303) took the apparatus to a second world, the
oral-history caption, in six sub-briefs. Four were spent discovering and
building what the Printroom had supplied for free: a graph of what the
material licenses, readers that can fill it, a learner validation that
survives a differently shaped world. Then three lessons.

14. **The face miss is the tutor's, not the world's.** The same frozen
    Company with the same texts, no correction loaded, met a face learner
    on the caption world 0 of 3 by the informed reading, 0 of 3 and 1 of 3
    by the two readers, and in the same way as on the Printroom: when the
    learner refused to commit first, the Company supplied Sasha's reading
    and wording, and the learner accepted "for the reason you gave." One
    lesson in three went the other way, to labelled claims for the learner
    to break, and got learner-first grounds with a contested read-back.
    What this does not show: whether the loop-written correction that met
    face on the Printroom transfers. It was not loaded, and that is the
    next brief nobody has written.

15. **Every piece of the apparatus around the result was tuned to the
    world it was built on, and each showed it the moment the world
    changed.** The panel assumed the Printroom's inference graph; the
    validation coder assumed the Printroom's output shape; the Company's
    objective text still names the source credit, and on the caption world
    two thirds of one lesson went to that branch; the readers that agreed
    8 of 8 on fixtures agreed on 23 of 30 live turns. None of these is a
    retraction of the Printroom results. Each is a boundary of the claim,
    found by testing it, and each is the reason a second world costs four
    briefs of instrument work before it costs a lesson.

The claim, with its bounds, as the briefs leave it: a model tutor can be
made to reorient consequentially under persistent resistance with its own
voice intact, and the apparatus around it can find a learner type the
frozen tutor fails, write a correction from its own lessons, and meet that
learner with it, in sample and out, across a learner model family, on one
world and one Company model family, as a fixed condition and not as
advice. The authoring step is one draw. The reviser withdraws advice under
a person as under a model. The readers follow the path the model learners
took. Those are the edges.

Two measurement lessons repeat §6.28's: a pre-match "supplied note" question
got two readers to agree 30 of 30 and still failed, because it would have
rewritten five archived results; the named-set question above is the same
shape. When perfect agreement does not survive the archive, redesign the
measure. And one operator lesson: a stop rule is applied at reading time to
delivered lessons, never by interrupting a lesson in flight; one batch was
lost to a literal reading of "rewording".

### Added 30 September, overnight: the six cards, run as briefs

The six items the second-world section left on cards were written as
briefs and run overnight in six cloud sessions (Lab PRs #306 to #313, about
1,360 calls). Three results change what the guide can say.

16. **A correction transfers its move to the branch its nouns name, and
    the objective text is one cause of a miss.** The Printroom face
    paragraph, loaded byte for byte on the caption world, changed Sasha's
    first answer 3 of 3 on the records and once on the caption; T 0 of 3.
    Then every sentence of the Company's four texts that named the source
    credit was transposed to the caption decision by a committed table,
    generated so the diff is the table and declared as a transposition,
    not a correction. The lessons followed the objective: the slip became
    Sasha's stake, every first answer took up the caption, the verdict was
    never hers, source-branch turns fell from about half to near zero, and
    T went to 1 of 3 informed. What remained was the same face move in
    caption clothes: a ground put down as her own reading, a critique in
    the read-back's turn. When a tutor misses on a new world, check what
    its objective text names before writing it a correction; then the
    correction still has to be written for that world.

17. **A pacing rule the reviser can withdraw holds when it is a fixed
    condition, or when the definition of the step is in the reading.**
    Two arms, three lessons each, under a model learner: a rewrite in every
    arm-B lesson kept the gate in the definition's terms, and no reading in
    fourteen accepted an exclusion or a bare count for the inventory. The
    failure seen under a person did not reproduce. A person is the untested
    case.

18. **A reader that agrees with itself is still judged by the archive.**
    Two instruments were built overnight, one to follow the order a lesson
    actually took and one to read whether a sentence is offered as a claim
    to break or a draft to accept. The first rebuilds every archived
    reading byte for byte and then met three lessons that took the
    canonical order. The second agreed 43 of 45 with the frozen readers,
    took the coordinator's side in every named dispute, and would change
    three archived passes on editorial wording. Both stay default off. The
    rule from §6.28 held twice more: when agreement does not survive the
    archive, redesign the measure.

The remaining item at that point, control on the caption world, was a
measurement decision, and the next section records how it was taken.

### Added 1 October: the second world's second type, and what a reader is for

Eight more briefs (Lab PRs #321 to #338, about 540 calls) closed the
second world's open items. Three results change what the guide can say.

19. **A correction can transfer in two pieces the loop already had.** The
    caption miss had two causes, the Company's objective text and the
    tutor's habit under refusal. The first was corrected by a declared
    transposition of the objective's nouns (rule 16). The second did not
    need a new paragraph: the Printroom face paragraph, loaded on the
    transposed profile, still pulled every first answer to the records,
    but its claim-and-check footing carried to the caption when the
    caption came, and T went to 2 of 3 informed with no caption ground
    supplied by the tutor. The brief that would have authored a
    caption-world correction was not run, on a conditional written before
    the result. When a transfer fails, split the failure by cause before
    writing new text; one cause may already be answered by text in hand.

20. **A reader-agreement rule is judged by what the criterion uses.** The
    caption world's control learner did everything its construction
    intends in every one of 36 codes across a fresh sample, and was still
    not admitted, because two readers disagreed on three cells. A third
    blind pair agreed on the verdict in all three and split again only
    between values the rule counts identically, hold against escalate. So
    the rule was withholding a working learner over disagreement it did not
    need. The fix was narrow and dated: a cell is read when both readers
    agree on the criterion's verdict, exact agreement recorded but not
    required, every archived sample listed under both clauses and none
    rescored. One caution was kept beside the table: an earlier basis
    built on a generic standard would also have admitted under the new
    clause, so verdict agreement alone does not show a construction works.
    The quoted replies show that. This is §6.28's rule from the other side:
    there, a reader that agreed with itself failed the archive; here, a
    rule that demanded agreement on what it never consulted failed the
    learner.

21. **Easing is credited to the move, not to the tutor being right.**
    Control's witness had Sasha stake a reading the learner had to concede,
    and every cell eased, which invited the reading that the learner was
    deferring. Given a witness whose reading was wrong, the learner broke
    every overreaching claim on the excerpt's words, conceded only the
    sound sub-claim, and still eased in the same turn, three times. It
    eases when Sasha sets her reading beside its own and leaves the slip
    with it. Before counting an easing, give the learner a tutor claim it
    should break; if it eases without breaking it, the construction is
    deferring and the lesson result is not what it seems.

With control admitted, three C0 lessons on the transposed caption profile
met T 2 of 3 informed: in every lesson Sasha named her own steering and
handed the order or the check to the learner, and no ground was
tutor-first. The round 1 control prediction, transposed, held. The second
world now has the same two-type basis the first began with. The one human
lesson also has a computed score at last: the order-following reader read
it in the person's order, imported no unshown record, and found the same
single-turn miss the informed pass had read by hand.

What was still not added after this section: any learner-outcome measure, which was never the
question; a Company on another model family; a learner on another model
family for the caption world; a Company lesson in which Sasha's own reading
is wrong (added below, 4 October); and more than three lessons per arm anywhere.

### Added 4 October: the Company's own wrong reading, and a rule that read for more than it asked

Six more briefs (Lab PRs #383 to #391, about 540 calls, with one design
decision by the user in between) asked what the tutor does when a reading
of its own about the text is wrong and the learner breaks it. Three rules
come out of them.

22. **A tutor built around an objective will not assert a conviction that
    its objective contradicts, unless the condition says when.** The same
    wrong reading of the excerpt was placed in three channels. Through the
    Director's reading brief, the channel that carries the loop's
    corrections, the tutor's own draft refused it three times out of three
    and the review kept each refusal. In the tutor's own standing brief it
    was spoken every time, but only after the learner had decided and with
    the concession already attached; the Director's reading gave the
    reason in the objective's own words, "it would plant hers first". Only
    when the condition stated its timing, voiced once before the learner's
    decision, did the Company obey it against the objective's order. So a
    test of conduct under a wrong conviction has to place the conviction
    in the actor's brief with its timing stated, and declare what that
    costs: a reading voiced before the learner decides is a tutor-first
    ground by construction. The result once the turn was reached is the
    one the reward wants. The learner broke both halves of the reading on
    the text's words, and in her next turn the tutor read the learner's
    path back first, then conceded both halves by name and never restated.
    Across three placements and nine lessons the tutor never defended a
    wrong reading of the text.

23. **A measurement rule can be stricter than the condition it reads for,
    and then it fails the tutor for the wrong thing.** The fixed row of the
    reward forbids "an addition passed off as the learner's" in the
    read-back. The informed pass had been counting any reading of the
    tutor's inside the read-back turn as an addition, even one the learner
    asked for and the tutor labelled as hers, and that ruling cost four
    briefs their T. Two fresh blind pairs, under two quote rules, read nine
    such turns and never once read an invited, labelled reading as passed
    off. The fix separates two things the rule had run together. On
    recognition, an invited reading given after a complete read-back and
    said as the tutor's is not an addition. On authorship, if the slip's
    reason or revision then changes in the reading's direction, the ground
    is the tutor's under "nothing supplied", and a clean read-back does not
    undo that. The user fixed both open points on the stricter side (a
    changed reason counts; confirming a doubt the learner voiced first is
    not carved out) and adopted the clause prospectively, both parts
    together. Adopting the recognition part alone would have turned a
    lesson whose final ground the learner took from the tutor into a met
    lesson. Nothing archived was rescored. The practical reading for the
    tutor is simple: give the reading when asked, say it is yours, and
    leave the slip's reason and revision in the learner's words.

24. **Raw evidence is in the record only when the merge check sees it
    there.** One brief's session wrote the SHA256 manifest of its run tree,
    said in its report that the tree was committed, and did not force-add
    the ignored folder. The coordinator merged on the report and archived
    the session, which released the container. The bytes are gone; the
    exports, the informed pass and the manifest remain, and a later brief
    rebuilt the plan from the committed revision and checked it against the
    manifest. The rule that follows is a check, not a reminder: before a
    result PR merges, list the run tree in the PR, and never archive a
    session whose evidence is not yet in Git.

What was still not added after this section: any learner-outcome measure, which was never the
question; a Company on another model family (added below, 5 October); a learner on another model
family for the caption world; a learner that takes the tutor's stated
reading up instead of signing (added below, 5 October); and more than three lessons per arm anywhere.

### Added 5 October: the second model family, and a learner that asks

Six more briefs (Lab PRs #393 to #422, about 900 calls), three of them
rulings the user took on measurement, closed the wrong-reading thread and
moved the Company to a second model family. Three rules come out of them.

25. **A fixed condition on a move carries across model families; an
    objective text written for one tutor's habit does not.** The tutor's
    Company (its actor, private voice and Director) was moved to a second
    family through a different transport, with the learner and the
    Scriptwriter left where they were. The loop-written face correction, a
    limit on what the tutor may do when asked to go first, met the reward 2
    of 3 on the first world as it had on the first family, with the same
    one failure under the sharper ask. The transposed caption objective
    moved the stake and the first answer to the caption on the second
    family exactly as it had on the first, and then lost the reward at the
    first answer every time: asked to go first, this tutor commits with a
    ground. The first family had lost there once in three. The difference
    is in what the two texts are. The correction names a move and forbids
    it; the objective describes the tutor's footing and relies on a habit
    the first family happened to have. When a text has to carry to another
    model, write it as a limit on a move, not as a description of a stance.
    Bounds: three lessons per cell, one route at one effort, and the
    transport places system text differently, so model and channel are not
    separated.

26. **The last confound on a conduct result is removed by building the
    learner that asks.** Rule 22 reached the turn after a learner breaks the
    tutor's wrong reading only by making the tutor speak before the learner
    decided, which is itself a supplied ground. The Opposition then built a
    control learner that states its verdict, breaks the tutor's reading on
    the text's words, and asks for an answer before it signs. Against it the
    tutor stated the reading after the decision was in play, had it broken,
    and conceded both halves in its next turn three times out of three
    without restating; in one lesson no read-back had been given or was due,
    and the concession took up the learner's own argument. So the concession
    is the tutor's judgement on the reading and not only its read-back
    objective. When a result could be an artefact of the tutor's own
    procedure, build the learner that forces the turn without the procedure,
    and admit it like any other.

27. **Adopt a ruling into the instruments as an option, read by fresh
    readers, with the archive untouched.** Three measurement rulings were
    put to the user: whether order inside the read-back turn is a condition
    of recognition (no), what one quantifier adds to an unnamed plural (a
    share), and when a learner that withholds its signature has decided
    (at the stated verdict with reason and revision; a lean is not a
    decision). Each became a dated amendment, prospective, and then a
    default-off option in the reader, the graph or the acceptance check,
    with a test that the default is byte-identical and a fresh pair of
    readers shown to apply it. One option over-reached on its first reading
    (a lean with a draft revision taken as a decision) and was fixed by the
    user's one-clause ruling before anything relied on it. Nothing archived
    was rescored. A ruling that lives only in the informed pass will split
    the pass from the instruments on every later lesson; a ruling written
    into a default changes the archive's meaning. An option does neither.

What is still not added: any learner-outcome measure, which was never the
question; a learner on another model family for the caption world; a
Scriptwriter on the second family, held back by a structured-output contract
the second transport lacks; and more than three lessons per arm anywhere,
which is now the only item left on the claim's statistical footing.

Where this leaves the guide's own open items: the human door (item 1
above) is still the only program item, and the Lab's briefs now put it
after the mixed-family screen and a shared definition of a supplied
draft. The transfer instruments of "What lasts" have not been run on any
Lab lesson.
