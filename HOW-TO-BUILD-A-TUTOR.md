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
every judge's table** (v3.0: 76 vs 22–75 for every stance variant), and
within the variants the ordering tracks fallback rate, not authority. The
two claude judges broadly agree (no visible intra-family self-preference).
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

## Open items before this hardens

1. ~~No-book control~~ — landed; §3's attribution updated (native capacity,
   relief as lever, book as register).
2. Same-family fold: the sonnet/sonnet run hung mid-dialogue and was killed
   (attrition); re-run pending.
3. ~~codex agentic siblings~~ — landed: butler-grade, plus the tool-reflex
   attrition.
4. ~~Shadow-policy three-arm manner test~~ — landed; see "The four steps
   to contingency".
5. ~~The stress schedule awaits the user's edit~~ — ratified by chat
   adjudication (dual-family gold); the bench is built and its first
   head-to-head is in flight.
6. Guard family 3 per-type read-through (uptake/handoff make right and
   wrong calls; only gold splits them) — partially superseded by the v6
   shadow column; the read-through still owes the strict column an answer.
7. Everything texture-level here is n=1; nothing in §3–§3b goes in the
   paper without replication.
