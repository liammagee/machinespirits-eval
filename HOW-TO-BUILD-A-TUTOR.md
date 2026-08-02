# How to build a tutor — provisional build guide

**Status: PROVISIONAL** (started 2026-07-31, mid-investigation). Several
claims below rest on single dialogues and two controls still in flight (the
no-book attribution control; the same-family learner fold). Findings land in
`docs/research/paper-full-2.0.md` (§6.23 line) when the arc closes; this
document is the working synthesis and must not be cited past the paper.
Evidence pointers: `workplan/items/adaptation-planted-stress-bench.md`,
`workplan/items/misconception-world-outcome-gate.md`,
`docs/tutor-stub-guard-catalog.md`, runs under `exports/tutor-stub-outcome/`.

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

## Open items before this hardens

1. Same-family fold: the sonnet/sonnet run hung mid-dialogue and was
   killed (attrition); re-run pending.
2. Guard family 3 per-type read-through — partially superseded by the v6
   shadow column; the read-through still owes the strict column an answer.
3. Everything texture-level here is n=1–5; nothing goes in the paper past
   its stated limits (the paper's §6.24 carries the gated claims through
   v3.0.245).
4. The demand move: open cold only. Repeat demands wager live 5/6; a
   first demand has never drawn the move in any configuration. Routing
   (opus-in-seat at first demands) is the remaining lever.
5. Voice discontinuity under routing — unmeasured; blocks any router
   build.
6. Corruption bench: truncation loop closed; termswap bounded (semantic
   swapping is not deterministic-cheap); a full corrupted-turn arm would
   need non-release corruption turns.
7. The release/switch turn collision (one dialogue's grievance moment):
   unpriced beyond n=1; a scheduler rule (pressure beats release, or
   release defers a turn) is a small build if it recurs.
