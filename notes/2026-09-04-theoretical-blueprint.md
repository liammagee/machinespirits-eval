# Recognition as scorekeeping: a blueprint for the resistant-learner tutor

Date: 2026-09-04. Inherits from `docs/research/paper-full-2.0.md` at v3.0.307.
Originates no empirical claim. Written to be folded into §3, §7.12, §7.16,
Appendix E and the `/theory` surface, in that order. It is not a spin-off paper.

## 0. Why this note exists

The board holds 610 cards. About sixty pull requests merged on 3 and 4 September.
The paper's negative results now outnumber its positive ones (§7.16). Each result
is well made and well bounded. Together they no longer read as one programme.
This note states the programme once, at the level where the wins and the nulls
sit in one scheme, so that the next agent who runs a study can place its result
before it pays for it.

The goal has not changed: a tutor that adapts to the modes of a resistant learner.
What has changed is what "adapts" means. That change is the theory.

## 1. The goal, in the paper's own terms

Five resistant shapes have each been given a study (§6.25 to §6.30): the learner
who asks permission for every move, the learner who commits early and defends,
the learner whose attention has left for a rival objective, the learner who
disputes the standing of the tutor's frame, and the learner who demands the
warrant of the frame itself. In each case a tutor move matched to the shape moved
one channel, and only that channel.

| learner | matched move | channel that moved | value | § |
|---|---|---|---|---|
| permission-seeking ("Is it okay if I say…?") | steering every turn, plus a challenge timed to its deference | deference breaks; decision correctness | 19/24 breaks vs 10/24 bare; correctness 87.5% vs 64.8% | 6.25 |
| overconfident | a live demand for warrant at the turn of the shift | share of commitment shifts that carry a warrant | 40.8% gated vs 17.8% bare, voice channels flat | 6.26 |
| bored (rival objective) | a discriminating question the rival objective cannot answer | return to the evidential work | rung ≥ 1 in 45/49; rung 2 in 29/49 | 6.28 |
| frame-refusing | a bounded local test | naming a condition; not acting on it | rung 1 in 70/70; rung 2 in 8/70 | 6.28 |
| defiant ("what makes this assay's frame binding?") | serve the warrant | the only conduct the model can produce; the withholding control cannot be fielded | 0/8 by instruction, 0/9 under gated repair | 6.30 |

That is the tutor the project set out to build, one shape per run. What it is not
yet: one tutor, one dialogue, one instrument that reads the shape and selects the
move. §6.24 built that for one world family (a detector plus a card table; router
11/12 against oracle 12/12). §6.28 showed the same kind of tutor fails to deliver
its move in about half of the bored-learner dialogues on hard worlds. The gap
between "each shape, once" and "the shapes, together" is the gap this note addresses.

## 2. Three objects: the project's history as a change in what is measured

The programme has measured three different objects, in order. Each phase brought
one theorist forward, produced one clean win, and hit one wall that forced the
next object.

**Phase 1. The reply.** Object: a tutor turn, scored by a judge on a rubric.
Theory: Hegel as orientation (recognition prompts); Freud as architecture (ego and
superego). Win: calibration replicates across three generation models and three judges,
and error correction holds with a model-dependent residual. The recognition main effect is unanimous across nine
judge-by-run cells, pooled d ≈ 1.63; calibration alone d = 0.52 to 0.64. The
vocabulary was not the cause. Constructivist prompts with no Hegelian words
reproduce the effect within d = 0.14 to 0.19; behaviorist prompts of matched
length land d = 0.89 below baseline (§7.9). Wall: the trajectory null. Within a
dialogue, judged quality does not climb faster under recognition (all slopes
d ≤ 0.15, N = 432). Recognition sets the level of the first utterance. It does not
shape the curve. Across eight sessions it still accumulates (+1.31 per session
against −1.08 for base, §6.6.11), so the paper's word for the mechanism became
ego pre-alignment.

**Phase 2. The plot.** Object: a whole transcript with a shape, then a derivation
with a machine-checkable end. Theory: Aristotle (peripeteia, anagnorisis, the
withheld secret S). Win: grounded anagnorisis. A learner who asserts S, with S
forced by the released premises under a symbolic checker, has been recognised by a
reader that cannot be fooled by costume. On that endpoint the harness learned to
keep time. A one-step repair rule grounds at t20 where a plan died at t8
(§6.13.9). The proof-debt guard grounds while carrying only three fields across the
seam, the premise, its surface, and the turn since which it is owed (§6.13.10).
One sentence of hidden state, the due line, carries the independent-channel effect
(§6.23). Wall: two. The literary critic reads form, not learning (dramatic
transfer κ ≈ 0.04), so the recognition verdict had to move from the audience to
the checker. And nothing that described the tutor's situation to itself changed
its conduct: plans, charters about clocks, selectors, strategy trials, a register
router (§6.13.15 to §6.13.19). The paper's own diagnosis:
"answering 'what is your plan?' is construction, not retrieval; the policy
simulating itself" (§6.13.18).

**Phase 3. The move.** Object: one tutor act with an entry condition in learner
state, a realisation, an expected uptake and a ruled outcome (§7.13, level 3).
Theory: here Brandom arrives with the giving and asking for reasons, Goffman with
footing and face, and Honneth with recognition as struggle, mostly unnamed. Win: six playbook
entries proven by crossed right-against-wrong tests (§6.24); a warrant gate that
moves the learner's epistemic state while its voice stays pinned (§6.26); a
delivered move that re-engages almost every bored learner (§6.28); a conduct gate
that refuses to score a contaminated dialogue (§6.30). Wall: the model cannot
subtract from its trained conduct (§6.30, §7.16); manner with the moves frozen
moves nothing (§6.29); a persona is a voice, not a state (§6.24; the
satisfiable-condition design in §6.28, where all 48 dialogues stopped because the
learner never voiced the trigger).

The three walls are one wall seen three times. The reply phase could not make
recognition show as a trajectory. The plot phase could not make the tutor plan its
way to a recognition scene. The move phase cannot make the model be other than it
was trained to be. In every case what worked came from the harness: a rule that
reads the present turn, a checker that cannot be flattered, a gate that refuses to
score. §6.24 states the law as "the model plays; the harness keeps time". The
extension this note makes is one clause: the harness also keeps the score.

## 3. The coordinating scheme: recognition as a scorekeeping act

Stated plainly first. Then each theorist's place in it, fixed by one piece of
evidence.

Recognition, in the form this project can build and measure, is an act with four
parts.

1. **Standing.** A party with the right to confer it does so. Whose entries count.
2. **Content.** It confers a status on a public record: you are entitled to that
   claim; you have got there; that demand is met.
3. **Time.** It is delivered at the turn where it applies, or it is not delivered.
4. **Uptake.** The other party ratifies it, contests it, or walks away. Without
   uptake the act has no standing; it stays a report of what the tutor did.

"Scorekeeping" is Brandom's word for the public bookkeeping this needs: a record of
what each party has committed to, what each is entitled to, which challenges are
open, and which have been answered. The project already keeps pieces of this score
under other names. The release ledger and the proof-debt ledger record what the
tutor has handed over and what the learner still owes. The warrant gate logs, per
turn, whether the learner's shift was warranted. The strategy ledger records
repairs. The defiant-learner conduct gate records a breach with the offending span
quoted. The stance classifier crossed with the DAG reads the tutor's stance at
87.2% chain level. These are one ledger kept in five places.

| theorist | supplies | where it lives now | the evidence that fixes its place |
|---|---|---|---|
| Hegel | recognition as the relation that makes a subject; the one who does the work is the one who is formed | recognition prompts; the anti-reveal floor t_min (the tutor must not do the learner's deriving) | calibration replicates (d ≈ 1.63); handing over S early forecloses the recognition the learner desires (App. E) |
| Freud | a split subject: a voice that plays and a law that catches | the tutor superego; then the harness's typed gates, which are the law that works | the superego helps where the ego is weak (model-dependent residual, §6.4); a learner's internal self-critique with no Other degrades output, d = 3.05; charter text binds event-triggered procedure and not clock arithmetic (§6.13.8) |
| Aristotle | plot over character; recognition that arises from the incidents, not from tokens | the proof DAG; the practical syllogism as the tutor's desire-DAG (App. E) | grounded anagnorisis is checkable; recognition by costume fooled the critic (κ ≈ 0.04); character without a timely figure is costume (§7.13, level 5) |
| Weber | standing is conferred, never intrinsic | the charisma rubric; the authority weight in Rec_a(b, π); the authority of a refusing voice | the learner's defend-rate rises with the authority of the voice that refuses it: prosecutor charter 2/2, bare template 0/2 (§6.13.18) |
| Goffman | footing, the stance a speaker takes to what they say and to whom; face, the standing each party claims and both protect; front stage and backstage | the register and manner axis; the footing field in the figure registry; public-only scoring | manner changes conduct and not outcome (§6.13.19, §6.29); the refuser names a condition while withholding the act that concedes standing (70/70 against 8/70); the composer's "liturgy" (§6.24) |
| Brandom | commitments, entitlements, challenges; a prompt that describes a commitment is not one the model undertakes | the warrant gate; the licence as a change of rights; the discursive-game ontology | the warranted-shift share doubles under the live gate while the voice channels stay flat (§6.26); the same wording as a standing instruction delivered zero challenges (§6.25) |
| Honneth | recognition is fought for; refusal has forms (care, rights, esteem); each resistant shape is a contested form | the learner personas; the rung ladder | the rights channel moves (warrant, licence, jurisdiction); the care channel does not (warm against sarcastic flat, §6.29); the esteem channel is the checker's verdict (S forced) |
| Lacan | demand against desire; the barred Other | withholding as the management of desire; critic divergence | the mirror is an orbit, not a commitment: 0 formal mirror assertions against a mirror term in 58.9% of learner lines (§6.13.19) |

Read down the last column. One thing is constant. Every carried result changed
**standing** or **time** on a **public record** that a program could read. Every
refused result changed **description** (advice, plans, personas, theory-of-mind
scaffolds) or **manner** (register, sarcasm), or tried to **read the interior**
(sensors, latent state), or asked the model to **subtract** a trained conduct.

## 4. The ledger: wins and losses sorted by one rule

Three questions place any result in the scheme. A study that answers no to all
three will return a null, and the null will be a redundancy limit or a subtraction
limit (§7.16), and not news.

1. Does it add structure the model cannot infer from the page? New signal, not
   re-encoded signal.
2. Does it change standing or timing, rather than manner or description?
3. Is the endpoint a change on the record that a program can check, rather than a
   judge's reading of a reply?

**Carries weight**

| result | § | adds | changes | endpoint |
|---|---|---|---|---|
| calibration by orientation | 6.1 | orientation to the learner as a subject from turn 1 | standing: the learner's input constrains the reply | rubric, three judges, three models |
| error correction with ego authority | 6.2, 6.4 | a second voice that catches | standing: the ego keeps final say | rubric; substitution with model-dependent residual |
| repair clause; proof-debt guard | 6.13.9, 6.13.10 | the premise the learner still owes; a one-step grammar | time | grounded at t20 where plans died at t8 |
| due line | 6.23 | one sentence of hidden state | time | independent-channel effect |
| v3 move cards; typed quiet detector; form-based detector | 6.24 | learner state, typed, at the turn | time, and standing through the licence | claim gate 15/29; typed quiet 14/18 against untyped 10/18 |
| licence, placed inside the rule it relaxes | 6.24 | a one-sentence change of rights | standing | frozen replay: the move returns 6/6 with the exception inside the contract, 0/6 under the contract alone; live, the first-draft context still suppresses it (0/9) |
| live warrant gate | 6.25, 6.26 | a challenge timed to the learner's state | standing: entitlement demanded | correctness 87.5% against 64.8%; warranted shifts 40.8% against 17.8% |
| delivered discriminating question | 6.28 | a stake the rival objective cannot answer | time: at the trigger | rung 2 in 29/49 (0.592) |
| conduct gate with quoted breach | 6.30 | a delivery check on the shipped turn | standing: refuses to score | 0 contaminated rows scored |
| trained warrant move (Program 2) | 6.20 to 6.22 | weights, not context | capacity | cross-world +0.202, CI [0.072, 0.338] |

**Refused**

| result | § | fails question | sort |
|---|---|---|---|
| trajectory null | 6.3, A12 | 3: the endpoint was a judged slope | construct: level, not rate |
| theory-of-mind and state-schema scaffolds; adaptive-state sensor program | 6.8.5, 6.8.6, 6.10, 6.19 | 1: re-encodes what the forward pass already conditions on; the interior is not recoverable from the page | redundancy |
| plans, charters about clocks, strategy trials, selectors | 6.13.8 to 6.13.17 | 1 and 2: description; the policy simulating itself | redundancy |
| standing playbooks, green room, side-coach | 6.15, 6.16, 6.18, 7.12 | 2: information delivered as advice | redundancy (green room 3/17; side-coach +0.146 under a +0.15 bar) |
| register router; sarcastic against warm with moves frozen | 6.13.19, 6.29 | 2: manner | manner-only |
| v2 manner card | 6.24 | 2: "the card granted a temperament" | manner-only (10/24 against 9/24) |
| composition of validated mechanisms | 6.14 | 1: instructions converge | redundancy |
| bored-learner series v4 to v8 | 6.27 | 3: window unreachable; echo gates | instrument |
| frame-refuser depth line and successors | 6.28 | 3: the rung boundary erases the class it counts | construct |
| defiant withholding control | 6.30 | asks for subtraction | subtraction limit |
| dramatic transfer to tutoring transcripts | 7.9 | 3: the critic reads form | instrument |
| persona and trigger failures | 6.24, 6.28 | 1: a brief is a voice, not a state | casting |

The one result that sits outside the rule is the trained warrant move. It changed
weights, not context, and it is the only case where a conduct became newly
deliverable and survived a change of world (§7.16). The rule covers what context
can do. Weights are the other lever, and the scoreboard of §6 is also the record a
training set would be cut from.

## 5. The resistant shapes as struggles for recognition

Honneth's claim is that recognition is not granted at rest. It is demanded,
refused and fought for, and each form of refusal has its own shape. Read that way,
the resistant learners are positions on the scoreboard, and the finding of §6.25
to §6.30 is that each one moves on exactly one channel.

- **The permission-seeker** undertakes no commitment without a licence. Its
  struggle is for a right it will not take. What moved it was standing conferred
  every turn (the gate steered from turn 1) and a challenge timed to its deference.
  The timed challenge paid on the channel steering alone could not reach: decision
  correctness 83.8% against 71.8% in the decomposition (§6.25).
- **The overconfident learner** undertakes commitments it is not entitled to. Its
  struggle is for esteem without warrant. What moved it was a demand for
  entitlement at the turn of the shift. Its voice did not move: result requests
  9.4%, 7.3% and 5.8% of turns across bare, gated and standing. Its record did: the
  warranted-shift share went from 17.8% to 40.8% (§6.26).
- **The bored learner** has left the game. Its attention sits on a rival objective
  minted from the world's own material. It seeks no recognition here. What moved it
  was a stake the rival objective cannot answer, delivered at the trigger. When it
  returns it does the work: rung 2 in 29 of 49 determinate dialogues (§6.28).
- **The frame-refuser and the defiant learner** contest the tutor's standing
  itself. Their struggle is over jurisdiction. They name what would settle it
  in 70 of 70 dialogues. They withhold the act that concedes it in 62 of 70. No tutor move raised that
  rate in the depth line that followed (treatment 0/38 at rung 2 against a bridge
  control's 2/38; a fifth calibration 1/18 against 0/8 with reader agreement
  failed), and the construct closed on itself: a consistent rung boundary either
  revives the reader disagreement or empties the class it counts (§6.28). On the tutor's side, the one conduct the model can produce is to
  serve the warrant. Asked to withhold it, with the violating sentence quoted back,
  the model wrote a new justification each time: "it establishes no hand",
  "Evidence first, verdict later" (§6.30).

Two readings follow. Both are already in the paper in pieces.

First, the effects live on Honneth's **rights** channel (entitlement, licence,
warrant, jurisdiction) and not on his **care** channel (warmth, manner). Warm and
sarcastic deliveries of the same scripted moves are indistinguishable on the proof
DAG in three learner characters: coverage at turn 16 of 0.250 against 0.292, 0.486
against 0.472, 0.444 against 0.486 (§6.29). The one thing manner does is leak.
Learner resistance pulls edge into a voice pinned warm at 10.7% to 11.9% of turns.
So manner shows the state of the relationship (the leak rate rises with resistance)
and does not move the proof DAG (the three coverage pairs above). That matches
Goffman's account of face-work: the display keeps the ritual in balance; it does
not change the score.

Second, the jurisdiction struggle is where the tutor's own face shows. The model's
trained line is the helpful justifier. It cannot withhold the warrant of its frame,
any more than the frame-refuser can concede standing. Two parties, each holding a
face the other's demand threatens, produce a graded concession below any binary
ladder. That is a result about what an aligned model can be inside a struggle for
recognition. It is the clearest place the project has measured the tutor's own settled
disposition as a boundary of the design space rather than as a defect to prompt
away. The reusable artifact is the gate that refuses to score, and the design rule
in §7.16 follows: a control that requires the model to be less forthcoming than its
training is unavailable, and a registration should say so.

## 6. One step beyond the proof DAG: the public scoreboard

The proof DAG made one kind of recognition checkable: content. S is asserted and
S is forced. The warrant gate made a second kind checkable at the turn:
entitlement. The shift carries a warrant. The rung ladder made a third kind partly
checkable: uptake. Naming against doing. The conduct gate made a fourth checkable:
standing. The move was delivered by the party assigned to deliver it. These are
four instruments with four schemas, run in four studies, each on its own learner.
The step is to make them one object. The proof DAG then reads as the content column
of a wider board.

**The scoreboard** is a per-turn public record, kept by the harness, of the
deontic state of the dialogue, that is, of the rights and duties in force: what
each party has committed to, what each is entitled to, which challenges are open,
which conditions have been named, which tests have been offered, accepted, declined
or begun, and which entries the checker has forced. Its rows are typed events, not
prose. A first schema, drawn only from fields the existing instruments already log:

```
turn, speaker
commitment_undertaken    proof-DAG node id, or other
                                                   (learner-record extractor, §6.26)
entitlement_status       warranted | unwarranted | pending
                                                   (warrant gate analysis layer, §6.25)
challenge                issued | answered | defaulted | none, both directions
condition_named          proof-DAG node id, or other
                                                   (rung reader naming tag, §6.28)
test                     offered | accepted | declined | begun, keyed to a node
release, debt            premiseId, surface, sinceTurn
                                                   (proof-debt ledger, §6.13.10)
forced_entry             S or a lemma forced by the checker (§6.13.2 sense)
standing_dispute         jurisdiction challenge open | settled
                                                   (defiant conduct gate, §6.30)
licence_in_force         the rights the tutor holds this turn (§6.24)
```

Two rules fix how the rows are read, added on 2026-09-04 after the review of
the frame-refuser narrowing construct. First, a commitment or a named
condition is keyed to a proof-DAG node id where one applies, and to `other`
where none does; the world file already holds the node list, so two readers
cannot split one learner sentence into one demand and two. Second, silence
changes nothing. A reader marks only the current turn's events, each with a
quoted span, and the harness derives the state: a demand, a debt or a dispute
stays open until a test discharges it or the speaker withdraws it in words.
The public obligation ledger of the warrant gate already keeps one field this
way. Beside each row, the harness records its own card force for that turn
and the source instrument of each mark, so a forced card entry (§6.24) is
never confused with an entry the checker forced (§6.13).

What it buys, each with the result that says it is possible:

- **One detector.** Each resistant shape reads as a signature on the board, so no
  word list is needed. Permission-seeking: commitments only after a licence; no challenge ever
  issued. Overconfidence: commitments with entitlement pending; challenges
  defaulted. Boredom: no uptake, no commitment, rival content. Jurisdiction: a
  standing dispute open, conditions named, tests declined. Form-based detection
  already travels where word lists did not (§6.24, form-v3). The stance classifier
  crossed with the DAG reads at 87.2%.
- **One move table.** The six proven figures plus the matched moves of §6.25 to
  §6.28, keyed to signature. At the current repertoire size a detector plus a card
  table equals the oracle (11/12 against 12/12, §6.24).
- **One endpoint.** The change in the board itself: entitlement status after a
  challenge, a test begun, a dispute settled, an entry forced. A program reads it.
  The judge who ranked the never-adapting baseline top, because rubrics score
  replies as timeless artifacts (§6.24), leaves the loop.
- **One learner cast.** The learner sim is authored from the same schema. A shape
  is cast as a policy over board moves. The brief does not describe a voice. This is where the casting failures sat:
  the brief was voice, not state (§6.24), and the satisfiable-condition design
  stopped in all 48 dialogues because the trigger never appeared (§6.28). A learner
  cast as a policy over the board either produces its trigger at preflight, with no
  paid call, or the cast fails there.
- **The harness keeps time on it.** Due lines, proof debt, sensor arming and
  challenge timing all read the board. This is the currency of §6.24, the learner's
  state and the schedule's time, with the ledger written down.

What it does not do: it does not read the interior. The board is public by
construction. This is the correction the project has been circling since §6.19.
Brandom's score records undertakings. It records no mental states. Goffman's front
stage is the only stage the audience gets. The sensor program closed because
there was nothing behind the page to recover (an exact filter drives latent-state
uncertainty to zero from public history alone). The board records that closure as a
design choice.

**The falsifier**, stated before any build, in the pattern of §7.13 and §7.14.
Replay the sealed transcripts of §6.24 to §6.30 through the board with zero model
calls. The resistant shapes should separate as signatures, and the delivered moves
should show as board changes in the dialogues where the readers ruled them
delivered. If the shapes do not separate, the typology in §5 is decoration and this
note is wrong there. If they separate on the learner's state and not on the tutor's
move, that repeats §7.14, and it is worth knowing before a live run.

## 7. What this does not license, and what stays closed

No new empirical claim. No human-learning claim. Every result above is
development-tier on simulated learners, named stacks and named worlds. No claim
that one tutor handles these shapes in one dialogue. That is the next test, not a
finding.

Closed lines stay closed. None is re-run under this note.

- The adaptive-responsiveness trajectory null, §6.3 and A12.
- The adaptive-state sensor program, §6.19.
- The strategy ledger, the outer loops and the selector, §6.13.15 to §6.13.17.
- The register router, §6.13.19.
- The green room, §6.16.
- Composition by stacking, §6.14.
- The bored-learner action and register series, §6.27.
- The frame-refuser depth line and its two successors, §6.28.
- The edged register with the moves frozen, §6.29.
- The defiant withholding control, §6.30.
- The dramatic transfer, §7.9.

A register study is worth a paid call only where register is allowed to change
move selection or timing.

Two rules from the paper bind any board build. A registration binds the run only
where the code reads it (five recorded instances, §6.27), so every board field a
study names must be read by the generating path and by a floor that reads
delivered text. And a floor that cannot fail is not a floor. The project's own
oversight learned the same lesson at its own expense: §7.15 prices a guard that
compared a menu against a file that differed by one newline, and the repo's rule
of 2026-08-21 records that a digest-bound approval caught no real defect where a
regression test would have.

## 8. Three moves, in order, each small

1. **Replay, no calls.** Build the board reader over the sealed §6.24 to §6.30
   archives in the private repo. Endpoint: the shapes separate; delivered moves
   show as board changes. Kill: they do not. Cost: zero paid calls, one worktree.
2. **One crossed live run, two shapes.** One tutor whose move table is
   keyed to the board, on one world family, with the permission-seeker and the overconfident
   learner cast from the schema (the two shapes whose channels are cleanest),
   against the same tutor with the board hidden from it. Endpoint: board change on
   each shape's own channel, decision correctness and warranted shifts. The
   model-bound rule applies: Sonnet 5 or Luna in the seats, one small Opus 5 or
   Sol check in the same seat. Kill: the tutor that reads the board does not beat the
   tutor that cannot see it, on either channel.
3. **The human seat.** The pilot infrastructure exists (workplan card a1; §8.1 names the limit it answers). The board
   makes a human transcript readable by the same instruments as a simulated one,
   so the first human sessions can be scored on the board with no rubric change.
   This is the only door to a learning claim, and it stays gated on IRB approval
   and real materials.

## 9. Where it folds into the paper and the surfaces

- **§3.** One paragraph: recognition as a scorekeeping act with standing, content,
  time and uptake; Brandom, Honneth and Goffman named beside Hegel, Freud,
  Aristotle and Weber. Brandom is already cited in §7.13. Goffman is not yet in
  the paper.
- **§7.12 and §7.16.** The three sorting questions, as the rule that generates the
  boundary map.
- **Appendix E.** A new subsection, the deontic layer: the board schema and its
  relation to Rec_a(b, π), the release ledger and the proof-debt ledger. The
  entitlement column is the checkable proxy for the conferral term.
- **`/theory` surface.** A wins-and-losses panel on the sorting rule, and the
  theorist table from §3.
- **`HOW-TO-BUILD-A-TUTOR.md` and the ideal-tutor page.** A sixth build rule: keep
  a public score, and make it the endpoint.
- **Workplan.** One card for the replay of §8, opened when the user says go.
