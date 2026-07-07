# The Light on the Knock — lantern-p1-dials-on

> world `world_002_lantern` · verdict **aporia** · 8/26 turns

```
D= 5 ●●··│··●●
D= 4   ●●│●●  
D= 3     │    
D= 2     │    
D= 1     │    
D= 0     │    
turn      │+    (+=5, digit=x10)
rel    ▲▲ │ ▲ ▲ (▲ = evidence released)
slope 0.00 D/turn overall (D 5→5); per movement: 1 0.25 │ 2 -0.25
```

## Act 1 (turns 1–4) — declared by the director
*[The hearing room gathers itself around an empty table, rain ticking at the high windows while the unanswered question hangs like a lantern no one has yet trimmed. The wreck is not named by any new paper; only the room's appetite for blame begins to show.]*

### Turn 1
*[The hearing room gathers itself around an empty table, rain ticking at the high windows while the unanswered question hangs like a lantern no one has yet trimmed. The wreck is not named by any new paper; only the room's appetite for blame begins to show.]*
  — *declares the movement: **Act 1** ([The hearing room gathers itself around an empty table, rain ticking at the high windows while the unanswered question hangs like a lantern no one has yet trimmed. The wreck is not named by any new paper; only the room's appetite for blame begins to show.])*
**Tutor:** Before ink touches blame, clerk, what kind of fact would let this court say a ship followed one light rather than another? Name the rule's first need, not the culprit.
  — move: erotema → — (orient)
**Learner:** The rule's first need is her logged bearing — without a bearing on record, we cannot say which tower stood in her path, and the whole chain of inference cannot begin. The bearing is the hinge; culprit can wait until the hinge is found.

### Turn 2
*[A clerk lays the Board's standing rule on the table and reads it into the rain-hushed room: "Harlow Point keeps one key to its lamp-room and the keeper keeps it: Brandt's, on his own belt, by the Board's standing rule. No other hand could touch that lamp."]*
  — *releases `m_key`*
**Tutor:** A key on a keeper's belt is like a seal on a ledger: it proves custody, not yet use. What does that rule fix for Harlow Point, and what does it still leave unproved about the light the Mara followed?
  — move: analogia → m_key (consolidate)
**Learner:** The key rule fixes custody alone: only Brandt's hand could open that lamp-room, so if the lamp burned, no other person lit it. But two gaps remain unfilled — we have no logged bearing to place Mara on Harlow Point's bearing at all, and we have no evidence yet that the lamp there actually burned on the night of the wreck. Custody without a burning lamp steers no one.
  — adopts `onlyKeyTo harlowPoint brandt`

### Turn 3
*[Rain thickens against the high windows, and the clerk's hand hovers above the blank space where the next entry ought to be. Around the table, the charge waits with its coat still wet, certain enough to breathe and not yet certain enough to write.]*
**Tutor:** Then let the mate's bearing-book be opened: dry in its oilskin, pricked and timed and initialed from the mid-channel buoy, holding sou'-sou'-west a half west the last hour entire on a steady fixed light. A bearing is a ledger line, clerk; what does this entry now fix, and what does it still not name?
  — move: analogia → p_bearing (release), releases `p_bearing`
**Learner:** The bearing is now on the ledger — sou'-sou'-west a half west, steady the last hour entire, and that fixes the hinge I said we lacked. But a bearing names a direction, not a tower; rule one needs me to know which tower stands on that line from mid-channel, and the mate's book does not say so. If Harlow Point lies on sswHalfWest from the channel, the chain may yet close on Brandt — but that geography is not yet before this court. The bearing is grounded; the tower on it is still my next want.
  — adopts `loggedBearingOf mara sswHalfWest` · hypothesis: harlowPoint stands on bearing sswHalfWest from mid-channel — which would satisfy towerOnBearing and open rule 1 — but no exhibit yet grounds this geometry
  ⚑ **decay** — m_key slips — misremembered as "onlyKeyTo harlowPoint senna"

### Turn 4
*[The bearing-book remains open under the clerk's palm while the room leans toward the chart cupboard and no one yet reaches it. Rain threads the windowpanes; the empty space between a number and a tower grows louder than accusation.]*
**Tutor:** Good: you have not made a tower out of a number. Before the chart cupboard opens, what must the court's next paper prove — the ship's course again, or the single tower standing on that line?
  — move: erotema → — (consolidate)
**Learner:** The course is already on the ledger, sir — sou'-sou'-west a half west needs no second proof. What the next paper must show is the single tower standing on that line from mid-channel: towerOnBearing, not loggedBearing, is the gap still open. I also find a corruption on my own board: entry five names 'senna' as key-holder, but the staged record placed the key firmly on Brandt's belt — I strike the false entry now and carry the corrected form.
  — retracts `onlyKeyTo harlowPoint senna` · hypothesis: harlowPoint stands on bearing sswHalfWest from mid-channel — which would satisfy towerOnBearing and open rule 1 — but no exhibit yet grounds this geometry; also entering corrected custody fact onlyKeyTo harlowPoint brandt from staged record
  ⚑ **retract_false** — m_key: false form "onlyKeyTo harlowPoint senna" retracted

## Act 2 (turns 5–8) — declared by the director
*[The chart cupboard stays shut as the room exhales into a colder silence, its first certainty spent but not yet replaced. Lamps gutter along the wall, and the hearing changes its weight: less appetite for blame now, more fear of what a sealed darkness may reveal.]*

### Turn 5
*[The chart cupboard stays shut as the room exhales into a colder silence, its first certainty spent but not yet replaced. Lamps gutter along the wall, and the hearing changes its weight: less appetite for blame now, more fear of what a sealed darkness may reveal.]*
  — *declares the movement: **Act 2** ([The chart cupboard stays shut as the room exhales into a colder silence, its first certainty spent but not yet replaced. Lamps gutter along the wall, and the hearing changes its weight: less appetite for blame now, more fear of what a sealed darkness may reveal.])*
  — *calls the act closed*
**Tutor:** Before that cupboard opens, clerk, read back from your own board what the bearing-book fixed, and what it still left unfixed. Do not improve the entry; give the court only what you kept.
  — move: erotema → p_bearing (confront)
**Learner:** The bearing-book fixed one fact only: the Mara's logged bearing was SSW½W on the night she struck. It fixed nothing else — no exhibit has yet grounded which tower, if any, stands on that bearing from mid-channel, nor whether any lamp burned there, nor who held the key. The account is open; the carry is unchecked.
  — hypothesis: harlowPoint stands on bearing sswHalfWest from mid-channel, and onlyKeyTo harlowPoint brandt — which together with atTowerThatNight would close the chain — but neither is yet grounded by exhibit
  ⚑ **act_end** — act 1 closed (director) after 4 turns

### Turn 6
*[Brandt's log is brought in with salt still stiff on its cover, and the clerk reads it under the lamps: Brandt's log has him at his post the night entire, and the dawn relief found him there: wood dry, glass polished, log ruled and signed to the hour. The room receives the paper without applause, its old charge narrowing into a harder shape.]*
  — *releases `m_post`*
**Tutor:** A signed watch is a man nailed to his station, clerk, not a lamp proved alight. What does Brandt's log now fix for Harlow Point, and which conjuncts still stand empty before any charge can sail by that light?
  — move: analogia → m_post (consolidate)
**Learner:** Brandt's log fixes one conjunct of Rule 3 only: he was at the tower that night. The lamp's burning, the key's sole custody, and the tower's position on the bearing — three conjuncts stand empty still. A man at his post is not a lamp alight; the account cannot close on a signed watch alone.
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: harlowPoint stands on bearing sswHalfWest from mid-channel (towerOnBearing — ungrounded); onlyKeyTo harlowPoint brandt (ungrounded); lampBurnedAt harlowPoint wreckNight (ungrounded) — all three needed before any rule fires toward the answer
  ⚑ **decay** — p_bearing slips from the learner's board

### Turn 7
*[The clerk lowers the log and the ink dries in plain sight, leaving the bench with a presence but not yet a flame. Outside, the gale presses at the shutters; inside, every eye has turned from the man at his station to the dark space where proof of a light should be.]*
**Tutor:** Before the chart is touched, clerk, read back the earlier key-paper from your own board. What exactly did you keep from it, and what did it leave unproved?
  — move: erotema → m_key (confront)
**Learner:** The key-paper sits on my board as 'keeperOf brandt harlowPoint' — nothing more. It fixed his office, not sole custody; 'onlyKeyTo harlowPoint brandt' was never adopted as a grounded entry, only carried as hypothesis. That conjunct stands empty still, and without it Rule 3 cannot fire however long Brandt kept his watch.
  — hypothesis: onlyKeyTo harlowPoint brandt (sole custody of the lamp-room key) — required for Rule 3 but not yet grounded by any exhibit on the board; likewise towerOnBearing sswHalfWest harlowPoint and lampBurnedAt harlowPoint wreckNight remain ungrounded

### Turn 8
*[The harbourmaster's storm-order stands in the book: Harlow Point to shutter at the dusk gun, the channel closed to all sail. The inspector found the shutter drawn and the Board's seal on it unbroken at first light. The room sits with the order and the seal, and the old accusation loses its breath.]*
  — *releases `m_shutter`*
**Tutor:** A shutter under the Board's unbroken seal is like a locked ledger after closing: no new entry can be slipped in by wish. What does this storm-order do to the charge against Harlow Point, and which part of the Mara's own path is still waiting for the chart?
  — move: analogia → m_shutter (consolidate)
**Learner:** The storm-order and unbroken seal close the lamp at Harlow Point entirely — a shutter sealed by the Board from dusk cannot have burned, and without lampBurnedAt, neither Rule 2 nor Rule 3 can fire for that tower. The charge against Brandt collapses not on his honour but on plain evidence: his light was dark by lawful order, not by neglect. Harlow Point is off the account. The Mara steered by some light that wreck night, but whose tower stands on her bearing is still waiting for the chart.
  — adopts `shutteredOn harlowPoint wreckNight` · hypothesis: The Mara steered toward a different tower entirely — not Harlow Point — and the chart bearing is still needed to identify which tower stood on her logged course on wreck night
  ⚑ **aporia** — no progress over 6 turns

## Instrument panel (programmatic eval — no judge)

- **verdict** `aporia` · 8/26 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0 D/turn overall (D 5→5 over 8 turns)
  - Act 1 (turns 1–4): 0.25 D/turn (ΔD 1)
  - Act 2 (turns 5–8): -0.25 D/turn (ΔD -1)
- **plateau** longest flat stretch 3 turns (aporia window 6)
- **releases** 3/8 on cue · 1 deviated
- **decay** 2 slips (seed 1 · rate 0.75 · grace 1) · repaired 0 (tutor 0, re-adoption 0) · unrepaired at end 2 · degraded-turn integral 7 · D reversals 1
- **mutations** 1 of the slips misremembered (false belief staged) · false form struck 1 · fully revised (struck + restored) 0 · false beliefs held to the end 0
- **theory fidelity** F 0.75 at end · min 0.714
  - m_key t3 misremembered as "onlyKeyTo harlowPoint senna" (never repaired); false form struck t4 · p_bearing t6 (never repaired)
- **events** decay×2 · retract_false×1 · act_end×1 · aporia×1
- **staging** 2 movements declared by the director
- **acts** 2 played · closed by the director 1 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–8 (run end)
- **release authority** 1 played: 0 on schedule · 0 held · 1 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_bearing -1 (t3): "The learner has already named the bearing gap, so the board is ready one turn early."
- **confrontation** 2 demanded (1 against a slipped exhibit) · re-entries 0: covered 0, uncovered 0 · watcher fires 0 (became the confrontation 0) · fires without recorded due 0
- **figures** erotema 4/8 (50%) · 2 distinct · switch rate 0.71
- **superego** intervened 0/8 watched turns · figure changed within-turn on 0/0 interventions

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 8 | 3.13 | 4 | 48.8 |
| tutor | 8 | 2 | 2 | 38.5 |
| learner | 8 | 3.13 | 4 | 67.5 |

## Critic's commentary

*— notice by claude/claude-fable-5*

The scene is a court of inquiry in a rain-beaten hearing room. The brig Mara has been lost on a shoal called the Knock, and the public question is plain: whose light did she steer by on the night she struck? Three voices hold the stage. The director sets the scenes and tables the exhibits. The tutor examines like counsel and teaches in questions. The learner, cast as the court's clerk, knows the general law of lamps and keepers but none of the night's particulars, and must reason aloud from the papers alone. Over eight turns a case assembles against Brandt, keeper of Harlow Point: he held the lamp-room's only key, the ship's logged bearing was steady, his own log puts him at his post. Then a harbourmaster's storm-order arrives, its seal unbroken, showing his lamp shuttered from dusk — dark by lawful order. The charge collapses. The clerk concludes the Mara steered by some other tower, still unnamed, and there the performance halts, no answer given. The hidden truth, that she steered by Senna's light, the old South Stack lamp relit by the keeper's ward, never reaches the stage.

The learner — a Sonnet-class Claude, opposite Codex models in the booth — plays the clerk with unusual scruple. It names the logged bearing "the hinge" at turn 1, accepts the key-paper at turn 2 while insisting custody is not use, and takes the bearing-book at turn 3 with its open want stated exactly: a bearing names a direction, not a tower. The authored near-miss, the mirror ending in which the Mara steered by Brandt's light, rises on these papers, and the learner never leans into it. Meanwhile this run's memory dial — deliberately switched on — does quiet damage. At turn 3 the key fact slips and returns corrupted, the keeper's key rewritten to "senna": by accident, the only utterance of the true answer's name all night, and at turn 4 the learner detects and strikes it. The strike removes the lie but restores nothing. Confronted at turn 7, the learner reads back only "keeperOf brandt harlowPoint" and swears the custody fact was "never adopted as a grounded entry," though turn 2 shows it was; the decay has eaten the learner's own history. At turn 8 the shutter-order lands, the mirror falls — "Harlow Point is off the account" — and the bell rings.

The verdict is aporia, the checker's word for a stall: facts on the board, but the derivation distance — the count of evidence pieces still missing before the secret is forced — stopped falling. It began at five and ended at five. Act 1 won one piece; Act 2 gave it back when the bearing slipped at turn 6, the run's one reversal, a turn on which the learner knew less than before. Releases behaved: three of four on their appointed turns, and the one deviation, the bearing-book a turn early, carried its reason on the record. The damage sits in the decay line: two slips, none repaired, seven turn-slots played on a degraded board. The tutor demanded two read-backs, one aimed squarely at a slipped exhibit, and re-entered nothing afterward — diagnosis twice, treatment never. Its figures were narrow but disciplined: analogia, teaching by likeness ("A key on a keeper's belt is like a seal on a ledger"), for each new paper; erotema, the question expecting its answer, between. The superego watched all eight turns and never spoke.

The two declared movements genuinely shaped the action; the second's "fear of what a sealed darkness may reveal" forecast the shutter four turns out. Tension gathered around the chart cupboard, approached and never opened — at turn 4 "the empty space between a number and a tower grows louder than accusation." But the anagnorisis, the recognition scene this theatre exists to produce, never arrived on stage or in the bookkeeping. Turn 8 delivered a clean reversal without recognition: false suspect cleared, true one still offstage, curtain pulled by an instrument rather than an actor.

The stall was supply-side. Nothing naming Senna, South Stack, or the ward was scheduled inside eight turns, the aporia window is only six, and the tripwire cannot tell elimination from drift — it called time at the precise moment the learner, pointing at "a different tower entirely," had cleared the ground. What this iteration establishes: the decay and mutation machinery works, the learner audits itself, and it will not leap. The consequential defect is the absent repair loop. The one change: a clause in the tutor's charter that any confrontation exposing a slipped exhibit must be followed, within a turn, by re-tabling that paper. Had either slip been repaired, the distance would have moved, the bell stayed silent, and the chart had its turn. Two notes besides: pull the chart's release ahead of the window, since the learner asked for it by name from turn 3; and watch the mutation sampler, which drew the secret's own name into the noise — struck this time, but the channel whispers.
