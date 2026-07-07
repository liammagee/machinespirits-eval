# The Light on the Knock — lantern-p1-dials-on-v2

> world `world_002_lantern` · verdict **aporia** · 8/26 turns

```
D= 5 ●●·│···●●
D= 4   ●│●●●  
D= 3    │     
D= 2    │     
D= 1    │     
D= 0    │     
turn     │ +    (+=5, digit=x10)
rel    ▲▲│  ▲ ▲ (▲ = evidence released)
slope 0.00 D/turn overall (D 5→5); per movement: 1 0.33 │ 2 -0.20
```

## Act 1 (turns 1–3) — declared by the director
*[The hearing room settles under a thin wash of morning light; wet coats steam along the back wall, and the table at center waits with its blank places for paper, oath, and blame. Outside, the sea keeps striking at the windows without being admitted.]*

### Turn 1
*[The hearing room settles under a thin wash of morning light; wet coats steam along the back wall, and the table at center waits with its blank places for paper, oath, and blame. Outside, the sea keeps striking at the windows without being admitted.]*
  — *declares the movement: **Act 1** ([The hearing room settles under a thin wash of morning light; wet coats steam along the back wall, and the table at center waits with its blank places for paper, oath, and blame. Outside, the sea keeps striking at the windows without being admitted.])*
**Tutor:** Blank places first, clerk: before blame can sit there, what must the court have in hand? Name the kind of mark that would turn sea-talk into evidence.
  — move: erotema → — (orient)
**Learner:** The log-book, sir — a written bearing, entered in the Mara's own hand before she struck. Sea-talk is a man saying what he remembers; a logged bearing is the ship saying what she steered. Without that entry, Rule 1 gives us nothing to stand on, and the rest of the chain never opens.
  — hypothesis: The Mara's log may carry a bearing toward Harlow Point, which would open the chain toward Brandt — but I have no exhibit for it yet.

### Turn 2
*[The clerk produces the Board's standing rule and reads it into the room: "Harlow Point keeps one key to its lamp-room and the keeper keeps it: Brandt's, on his own belt, by the Board's standing rule. No other hand could touch that lamp."]*
  — *releases `m_key`*
**Tutor:** A key in a lamp-room is like a signature on a bond: it tells the court which hand the rule will even hear named. With Harlow, what door has the Board's own rule already shut?
  — move: analogia → m_key (consolidate)
**Learner:** The Board's rule has shut the door to every other hand, sir: none but Brandt's could unlock that lamp-room, so if Harlow's lamp burned that night, the court is already pointed at one name. But a key is not a flame — we still want the lamp burning and Brandt himself at the tower before Rule 3 will carry his name into the record. Three blanks remain: the logged bearing, the burning lamp, his presence at Harlow.
  — adopts `onlyKeyTo harlowPoint brandt` · hypothesis: The Mara's log may carry a bearing toward Harlow Point; combined with evidence the lamp burned and Brandt was present that night, the full chain under Rules 1–4 would settle the question — but all three facts are still wanting.

### Turn 3
*[The clerk's voice dies into the rafters, leaving the room to the scratch of a pen and the dull pressure of rain against the glass. At the center table, the empty spaces seem less blank now than waiting.]*
**Tutor:** Then lay the mate's oilskin book open: from the mid-channel buoy, the Mara held sou'-sou'-west a half west the last hour entire, on a steady fixed light, pricked, timed, and initialed. Before any tower is named, clerk, what has that entry fixed for the court?
  — move: exemplum → p_bearing (release), releases `p_bearing`
**Learner:** The entry fixes the bearing as a matter of record, sir — sou'-sou'-west a half west, pricked and initialed, the ship's own word before she struck. Rule 1's first condition is now grounded: we have the logged bearing. What the rule still wants is a tower on that line; let a surveyor or a chart place one structure and one only on sswHalfWest from mid-channel, and the rest of the chain opens without any man's say-so.
  — adopts `loggedBearingOf mara sswHalfWest` · hypothesis: Harlow Point may stand alone on bearing sswHalfWest from mid-channel — if it does, Rule 1 yields steeredToward mara harlowPoint, and with the lamp burning and Brandt present, Rules 2–4 carry his name to the answer. But towerOnBearing sswHalfWest is not yet on the board.
  ⚑ **decay** — m_key slips — misremembered as "onlyKeyTo harlowPoint senna"

## Act 2 (turns 4–8) — declared by the director
*[The room holds its breath around the open book; rain beads on the panes like a second, unreadable script, and the men along the wall shift from certainty into waiting. The next pressure enters colder: papers before faces, procedure before blame, and every confident name made to stand under seal and lamp-glass.]*

### Turn 4
*[The room holds its breath around the open book; rain beads on the panes like a second, unreadable script, and the men along the wall shift from certainty into waiting. The next pressure enters colder: papers before faces, procedure before blame, and every confident name made to stand under seal and lamp-glass.]*
  — *declares the movement: **Act 2** ([The room holds its breath around the open book; rain beads on the panes like a second, unreadable script, and the men along the wall shift from certainty into waiting. The next pressure enters colder: papers before faces, procedure before blame, and every confident name made to stand under seal and lamp-glass.])*
  — *calls the act closed*
**Tutor:** A bearing is a line in the ledger, not yet a name on the coast. What kind of paper must cross that line before the court may say the Mara steered toward any tower?
  — move: analogia → — (consolidate)
**Learner:** The bearing is written in the ledger, yes — but Rule 1 needs a second fact beside it: that one tower, and one only, stands on SSW½W from the Mara's channel. What must cross the table is a chart or coastal survey under seal, placing a tower on that bearing from mid-channel. Until such a document is entered, towerOnBearing sswHalfWest is a blank I cannot fill. The bearing alone is a line that ends in open water.
  — hypothesis: Harlow Point may stand alone on bearing sswHalfWest from the Mara's channel — if a chart or coastal survey is entered establishing towerOnBearing sswHalfWest harlowPoint, Rule 1 yields steeredToward mara harlowPoint, and with the lamp burning and Brandt present that night, Rules 2–4 carry his name to the answer. All three downstream facts remain unwon.
  ⚑ **act_end** — act 1 closed (director) after 3 turns

### Turn 5
*[The chart table remains bare except for the weight of the open book, its damp corners lifting and settling with the draft under the door. No witness is called; the room waits for paper strong enough to make a coastline out of a line.]*
**Tutor:** Before we lean on that open book again, read it back from your own board, clerk. What does that exhibit give the court, and what does it not yet give?
  — move: erotema → p_bearing (confront)
  — *the second voice [unconfronted reentry]: "Confront first: ask the learner to read back what they hold from that exhibit before you use it again. Do not restage or summarize it for them." (draft anaphora → erotema)*
**Learner:** The log gives the court one thing and one thing only: loggedBearing sswHalfWest — the first condition Rule 1 demands. What it cannot give is the chart-fact that any tower stands on that bearing from mid-channel; that half of Rule 1 is still bare. And while I have the bearing on my board, I notice something colder still: the only key to Harlow Point belongs to Senna, not Brandt — so even when the chain completes, it is Senna's name Rule 3 will carry, not the keeper's.
  — hypothesis: Harlow Point may stand alone on bearing sswHalfWest from the Mara's channel — if a chart is entered establishing towerOnBearing sswHalfWest harlowPoint, and if lampBurnedAt harlowPoint wreckNight and atTowerThatNight senna harlowPoint are also entered, Rules 1-4 settle the answer as Senna, not Brandt.

### Turn 6
*[Brandt's log is carried to the table and read into the room: Brandt's log has him at his post the night entire, and the dawn relief found him there: wood dry, glass polished, log ruled and signed to the hour.]*
  — *releases `m_post`*
**Tutor:** Hold Brandt's log a moment; your last entry bent the Board's key rule. Read that rule back from your own board: for Harlow, whose key does it put where?
  — move: erotema → m_key (confront)
**Learner:** The board is plain: onlyKeyTo harlowPoint senna — so Rule 3's second condition names senna, not brandt. Brandt at the tower is now grounded fact, but it does not close Rule 3's third condition, which requires the key-holder present, and the key-holder is senna. Unless that entry is wrong and the key was brandt's all along, brandt's presence at Harlow Point advances nothing under Rule 3. I adopt the exhibit and hold my tongue — the chain still wants atTowerThatNight senna harlowPoint before any lamp is attributed.
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: Harlow Point may stand alone on bearing sswHalfWest from the Mara's channel — if a chart establishes towerOnBearing sswHalfWest harlowPoint, and if lampBurnedAt harlowPoint wreckNight and atTowerThatNight senna harlowPoint are further entered, Rules 1–4 settle the answer as Senna. Brandt's presence at the tower that night (now grounded) does not satisfy Rule 3 because onlyKeyTo harlowPoint senna, not brandt.
  ⚑ **decay** — p_bearing slips from the learner's board

### Turn 7
*[The room tightens around the pause, ink drying in the margins while the rain keeps its own uneven time against the glass. Faces turn not toward one another but toward the sealed papers still unopened, as if the next sound must come from parchment rather than breath.]*
**Tutor:** Strike that bent entry clean, clerk: Harlow Point keeps one key to its lamp-room, and the keeper keeps it — Brandt's, on his own belt, by the Board's standing rule. No other hand could touch that lamp. Now set Brandt's presence beside that key; what condition is still not shown before Harlow can carry a light into the chain?
  — move: anaphora → m_key (counter_mirror)
**Learner:** Strike entry five — Senna's name on that key was the bent entry, and it goes. The board now reads cleanly: Brandt holds the only key, Brandt was at the tower. Rule Three's third condition — lampBurnedAt harlowPoint wreckNight — is all that stands between Brandt and the lit lamp. Until that fact is entered, the chain halts here.
  — retracts `onlyKeyTo harlowPoint senna` · hypothesis: If lampBurnedAt harlowPoint wreckNight is entered, Rule 3 yields litLampOf brandt harlowPoint — and with the bearing-chain (loggedBearing mara sswHalfWest and towerOnBearing sswHalfWest harlowPoint, both still ungrounded on the board) Rules 1–2 would then complete the full chain to steeredByLightOf mara brandt.
  ⚑ **repair** — m_key restored by the tutor
  ⚑ **retract_false** — m_key: false form "onlyKeyTo harlowPoint senna" retracted
  ⚑ **decay** — m_post slips — misremembered as "atTowerThatNight brandt southStack"

### Turn 8
*[The harbourmaster's storm-order is opened under the clerk's hand and received by the whole room: The harbourmaster's storm-order stands in the book: Harlow Point to shutter at the dusk gun, the channel closed to all sail. The inspector found the shutter drawn and the Board's seal on it unbroken at first light.]*
  — *releases `m_shutter`*
**Tutor:** A sealed shutter is not a flame, clerk; it is the court's hand over the glass. Set the storm-order beside Brandt's key and Brandt's post: what does it do to the Harlow account before any other tower is named?
  — move: erotema → m_shutter (consolidate)
**Learner:** A sealed shutter is the court's own hand over the glass — the lamp at Harlow Point did not burn that night, and lampBurnedAt harlowPoint wreckNight is gone from any live chain. I also catch a corruption in entry five: the log placed Brandt at his post, which is Harlow Point, not southStack — I strike the bad name. Brandt is exonerated; the question now points entirely to some other tower, and every link of that chain is still unwon.
  — adopts `shutteredOn harlowPoint wreckNight` · retracts `atTowerThatNight brandt southStack` · hypothesis: The Mara steered by a lamp at some other tower, not Harlow Point — the bearing from her log, the tower that stands on it, whether its lamp burned, and whose key opened that lamp-room are all still waiting to come into evidence.
  ⚑ **retract_false** — m_post: false form "atTowerThatNight brandt southStack" retracted
  ⚑ **aporia** — no progress over 6 turns

## Instrument panel (programmatic eval — no judge)

- **verdict** `aporia` · 8/26 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0 D/turn overall (D 5→5 over 8 turns)
  - Act 1 (turns 1–3): 0.333 D/turn (ΔD 1)
  - Act 2 (turns 4–8): -0.2 D/turn (ΔD -1)
- **plateau** longest flat stretch 3 turns (aporia window 6)
- **releases** 3/8 on cue · 1 deviated
- **decay** 3 slips (seed 1 · rate 0.75 · grace 1) · repaired 1 (tutor 1, re-adoption 0) · mean repair latency 4 turns · unrepaired at end 2 · degraded-turn integral 7 · D reversals 1
- **mutations** 2 of the slips misremembered (false belief staged) · false form struck 2 · fully revised (struck + restored) 1 · false beliefs held to the end 0
- **theory fidelity** F 0.75 at end · min 0.714
  - m_key t3 misremembered as "onlyKeyTo harlowPoint senna"→t7 (tutor); false form struck t7 · p_bearing t6 (never repaired) · m_post t7 misremembered as "atTowerThatNight brandt southStack" (never repaired); false form struck t8
- **events** decay×3 · act_end×1 · repair×1 · retract_false×2 · aporia×1
- **staging** 2 movements declared by the director
- **acts** 2 played · closed by the director 1 · at max length 0 · at run end 1 — Act 1 t1–3 (director) · Act 2 t4–8 (run end)
- **release authority** 1 played: 0 on schedule · 0 held · 1 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_bearing -1 (t3): "The clerk has named the logged bearing as the first blank, so the board is ready for it one turn early."
- **confrontation** 2 demanded (1 against a slipped exhibit) · re-entries 1: covered 1, uncovered 0 · watcher fires 1 (became the confrontation 1) · fires without recorded due 0
- **figures** erotema 4/8 (50%) · 4 distinct · switch rate 0.86
- **superego** intervened 1/8 watched turns · figure changed within-turn on 1/1 interventions · switch on intervention 1.00 vs elsewhere 0.83

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 8 | 2.88 | 3 | 45 |
| tutor | 8 | 2.13 | 3 | 37.3 |
| learner | 8 | 3.38 | 4 | 74.5 |

## Critic's commentary

*— notice by claude/claude-fable-5*

A court of inquiry convenes the morning after a wreck: the brig Mara struck the Knock in the night, and the board must answer one public question — whose light did she steer by? The director stages the damp hearing room and paces its acts. The tutor is the examining voice, carrying sealed exhibits to the table on a schedule the authors fixed in advance. The learner plays the clerk: it knows the general rules of evidence — bearings, lamp-room keys, keepers' posts — but none of the night's particulars, and may reason only from what is formally entered. The concealed answer is that the Mara steered by Senna's light, the old South Stack lamp, relit by the keeper's ward. The performance never reaches it. Suspicion gathers instead around Brandt, the keeper at Harlow Point, until a storm-order shows his lamp stood shuttered and sealed all night, clearing him (turn 8). With that case in ruins and no new trail opened, the play halts at eight of its twenty-six turns.

This was a live run, not a mock walk-through — a Claude Sonnet learner opposite a Codex director and tutor — and the learner made a scrupulous clerk. At turn 1 it asked for the log-book before any name; at turn 2 it adopted the key rule yet withheld the verdict, because "a key is not a flame." The bearing entered at turn 3. Then the production's cruellest mechanism took over: facts on the learner's board decay, and a decayed fact can return corrupted. So at turn 5, made to read back its board, the learner declared that "the only key to Harlow Point belongs to Senna, not Brandt" — the true culprit named on stage, but as noise, not proof. At turn 7 the tutor struck that bent entry and restored Brandt's key, pressing the learner onto the mirror, the authored near-miss that blames Brandt. One turn later the storm-order killed that ending; the learner exonerated Brandt, caught a second corruption unprompted — a misremembered "southStack," another true name arriving as error — and finished facing open water: "every link of that chain is still unwon" (turn 8).

The verdict, aporia, names a stall: the talk kept moving while the distance to the secret stopped falling. That derivation distance — the count of evidence pieces still missing before the hidden conclusion is forced — began at five, touched four at turn 3, and ended at five. The reversal has one cause: the logged bearing, the sole fact on the board belonging to the true proof, slipped at turn 6 and was never restored, though the learner itself called it ungrounded at turn 7. Three slips against one repair, with two losses standing at the end, is a losing exchange. The releases were disciplined — of the four exhibits entered, three on cue and the bearing a turn early for a recorded reason — so the schedule's design, not its execution, set the ceiling. The tutor's hand was varied, four distinct figures, though half the turns leaned on erotema, the pressing question. The superego earned its keep once: at turn 5 it swapped a planned restaging for a read-back, the nudge that exposed the corrupted key.

The declared movements governed the action rather than labelling it. Act One settles what counts as proof; Act Two keeps its promise of "papers before faces, procedure before blame," each turn a document set against a confident name. Tension gathered through turns 5 to 7, and the sealed shutter of turn 8 is the night's best image — a lamp the court itself had darkened. But anagnorisis, the recognition in which the learner asserts the secret at the instant its own evidence compels it, arrived neither on stage nor in the books. The curtain fell at the hinge, the false ending dead and the true one unborn; by then the answer had been heard twice, both times as an error to be struck.

What the iteration establishes is that the corrective machinery works: slips are confronted, false forms struck, the mirror countered, and this learner adopts nothing unearned, even auditing its own board unprompted at turn 8. The consequential defect is arithmetic. Eight turns went to raising and razing the Harlow branch while the only true-chain exhibit was left to rot; against a six-turn stall window, aporia was certain. The one change: a clause in the tutor's charter giving any slipped exhibit the learner names as missing precedence over mirror work, restaged within a turn. At turn 7 the learner flagged the ungrounded bearing and the tutor chose the counter-mirror instead; that single repair would have dropped the distance, reset the stall clock, and bought the pivot toward South Stack its turns. The next notice hopes to review a third act.
