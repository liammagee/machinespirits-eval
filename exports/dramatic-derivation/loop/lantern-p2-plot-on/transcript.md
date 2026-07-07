# The Light on the Knock — lantern-p2-plot-on

> world `world_002_lantern` · verdict **aporia** · 8/26 turns

```
D= 5 ●●··│····
D= 4   ●●│●●●●
D= 3     │    
D= 2     │    
D= 1     │    
D= 0     │    
turn      │+    (+=5, digit=x10)
rel    ▲▲ │ ▲▲▲ (▲ = evidence released)
slope 0.13 D/turn overall (D 5→4); per movement: 1 0.25 │ 2 0.00
```

## Act 1 (turns 1–4) — declared by the director
*[The hearing room gathers itself around a blank table: wet coats, shuttered windows, and the low scrape of chairs as the question waits to be made public. Outside, weather presses against the glass without yet offering testimony.]*

### Turn 1
*[The hearing room gathers itself around a blank table: wet coats, shuttered windows, and the low scrape of chairs as the question waits to be made public. Outside, weather presses against the glass without yet offering testimony.]*
  — *declares the movement: **Act 1** ([The hearing room gathers itself around a blank table: wet coats, shuttered windows, and the low scrape of chairs as the question waits to be made public. Outside, weather presses against the glass without yet offering testimony.])*
**Tutor:** Clerk, before any book is opened, say the court's question cleanly: not what the town thinks, but what proof would have to fix. What must be shown before any hand can be charged with the Mara's light?
  — move: erotema → — (orient)
**Learner:** The question, plainly put: the Mara steered for a light — we know that much — but whose light? To charge any hand, I must first fix which tower she bore upon by her logged bearing, then show the lamp at that tower burned that night, and finally show who held the only key and stood at the tower to light it. Until all four links close, the town's verdict is noise, not proof.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[The clerk produces the Board's standing rule, and the room receives it in the dry scrape of paper: Harlow Point keeps one key to its lamp-room and the keeper keeps it: Brandt's, on his own belt, by the Board's standing rule. No other hand could touch that lamp.]*
  — *releases `m_key`*
**Tutor:** A key on Brandt's belt is like a seal on a ledger: it can close Harlow's lamp-room, but it cannot put the Mara's bow toward Harlow. What conjunct does that paper actually satisfy, and what first ground is still absent from the board?
  — move: analogia → m_key (consolidate)
**Learner:** The paper settles one conjunct of Rule Three — onlyKeyTo harlowPoint brandt — and I am glad to enter it. But the tutor is right to press: the key closes the lamp-room question, not the bearing question. Before Brandt can be charged, I must first know what bearing the Mara logged, and whether Harlow Point alone stood on that bearing — Rule One's ground is still entirely absent from my board.
  — adopts `onlyKeyTo harlowPoint brandt` · hypothesis: The Mara steered toward Harlow Point — but this cannot be grounded until a logged bearing and a tower-on-bearing fact are entered.

### Turn 3
*[The room settles around the distinction just made: a key on the table, an empty place beside it where a number ought to be. Rain ticks at the shutters while the clerk waits with the next bundle unopened.]*
**Tutor:** Then open the mate's bearing-book: dry in its oilskin, pricked and timed, initialed to the last hour entire from the mid-channel buoy. It gives sou'-sou'-west a half west, steady on a fixed light. Clerk, as a ledger entry fixes a debt but not yet the debtor, what does this bearing fix, and what does it still leave unproved?
  — move: analogia → p_bearing (release), releases `p_bearing`
**Learner:** The bearing-book fills Rule One's first slot: I can enter loggedBearingOf mara sswHalfWest and it will hold. But a bearing without a tower is a compass-point without a landmark — the book tells me where the Mara's bow pointed, not what stood there. Rule One still wants its second conjunct: which tower, and which tower alone, stands on sswHalfWest from her channel? Until the chart or a pilot's testimony gives me towerOnBearing sswHalfWest, no name can move from hypothesis to ground.
  — adopts `loggedBearingOf mara sswHalfWest` · hypothesis: Harlow Point stands on bearing sswHalfWest from the Mara's channel — but no chart or witness has yet fixed it, so towerOnBearing sswHalfWest harlowPoint remains ungrounded.
  ⚑ **decay** — m_key slips — misremembered as "onlyKeyTo harlowPoint senna"

### Turn 4
*[The opened bearing-book remains under the clerk's hand, its number now heavier than the key beside it. The room does not move toward a verdict; it waits on the blank wall where a chart might hang.]*
**Tutor:** Before we ask the wall for a chart, read back the bearing-book from your own board. What does that exhibit now let the court say, and what does it still leave wholly unproved?
  — move: erotema → p_bearing (confront)
  — *the second voice [unconfronted reentry]: "Confront first: ask the learner to read back what they presently hold from the bearing exhibit and what remains unproved. Do not re-stage it until that read-back stands." (figure held)*
**Learner:** The bearing-book gives Rule One its first conjunct — the Mara logged sswHalfWest, steady and witnessed — but Rule One is a two-legged rule, and the second leg, towerOnBearing, is still empty; no chart has been read into the record, so the bearing proves a heading, not a destination. I must also report a fault in my own board: entry five names senna as key-holder, but the director's paper in turn two said Brandt's belt — I retract the corrupted entry and note the gap until the corrected name may be re-entered from a proper exhibit.
  — retracts `onlyKeyTo harlowPoint senna` · hypothesis: Harlow Point stands on bearing sswHalfWest from the Mara's channel — but no chart or pilot has yet fixed it; towerOnBearing sswHalfWest harlowPoint remains ungrounded.
  ⚑ **retract_false** — m_key: false form "onlyKeyTo harlowPoint senna" retracted

## Act 2 (turns 5–8) — declared by the director
*[The clerk closes the bearing-book without clearing it from the table, and the room feels the charge lose its easy shape. A space opens at the wall; the next act enters colder, with certainty asked to stand in poorer light.]*

### Turn 5
*[The clerk closes the bearing-book without clearing it from the table, and the room feels the charge lose its easy shape. A space opens at the wall; the next act enters colder, with certainty asked to stand in poorer light.]*
  — *declares the movement: **Act 2** ([The clerk closes the bearing-book without clearing it from the table, and the room feels the charge lose its easy shape. A space opens at the wall; the next act enters colder, with certainty asked to stand in poorer light.])*
  — *calls the act closed*
**Tutor:** The bearing-book may stay closed if its entry stays on your board; the key-paper is less settled. Before the wall gets its chart, read back only this: what did the key exhibit prove, and what did it not prove?
  — move: erotema → m_key (confront)
**Learner:** The key-paper proved Brandt holds appointment as keeper of Harlow Point — keeperOf, not onlyKeyTo; a keeper may share a key with a deputy or relief. It did not prove sole possession of the lamp-room key, and without that, Rule 3 cannot fire even if the lamp burned and he was present. The bearing is still only my conjecture; no chart or pilot has fixed Harlow Point on sswHalfWest. Four facts on my board, and not one of the three premises of Rule 3 is yet grounded.
  — hypothesis: Harlow Point stands on bearing sswHalfWest from the Mara's channel — towerOnBearing sswHalfWest harlowPoint remains ungrounded; no chart or coastal witness has fixed it.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 5, justified 0, drift 1; arc on_arc

### Turn 6
*[Brandt's log is laid open under the clerk's finger, and the dawn relief is shown in with his cap still wet from the passage. Brandt's log has him at his post the night entire, and the dawn relief found him there: wood dry, glass polished, log ruled and signed to the hour.]*
  — *releases `m_post`*
**Tutor:** Correct the key entry now: Harlow Point keeps one lamp-room key, Brandt's on his belt by the Board's standing rule; no other hand could touch that lamp. Shown: Brandt could touch Harlow's lamp; shown: Brandt was at Harlow through the night. Not shown: that Harlow stood on the Mara's bearing, or that its light was the one she steered by.
  — move: anaphora → m_key (consolidate)
  — *the second voice [figure rut]: "Leave off erotema here; make the repair as a plain audit before asking another question." (draft erotema → anaphora)*
**Learner:** Two of Rule 3's three premises are now grounded: only Brandt's key, and Brandt at the tower that night. But without lampBurnedAt harlowPoint wreckNight, Rule 3 still cannot fire — and without towerOnBearing sswHalfWest harlowPoint, neither can Rule 1. Both gaps must close before the chain completes. I adopt his presence and wait for light and bearing.
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: Harlow Point stands on bearing sswHalfWest from the Mara's channel — towerOnBearing sswHalfWest harlowPoint remains ungrounded; no chart or coastal witness has fixed it.
  ⚑ **repair** — m_key restored by the tutor
  ⚑ **decay** — p_bearing slips from the learner's board

### Turn 7
*[Rain works at the courtroom windows, softening the harbor lamps beyond them into pale smears. The closed bearing-book and the open log lie side by side on the table, and the wall waits empty.]*
**Tutor:** Then let the wall speak: lay the Trinity chart from the mid-channel buoy, and run the rule on sou'-sou'-west a half west. It crosses one tower and one only on this coast: the old South Stack, struck off the light-list six years since. Clerk, what does Rule One now yield, and what still waits before any hand is charged?
  — move: exemplum → p_chart (release), releases `p_chart`
**Learner:** The chart puts South Stack — not Harlow Point — on bearing sswHalfWest; my old hypothesis is struck at last, and the whole case I was building toward Brandt falls with it. Rule One would yield steeredToward mara southStack, but I find no loggedBearingOf entry on my board — did that fact slip between acts, because the tutor runs the bearing as settled? And even if it holds and Rule One fires, South Stack is dark by the light-list: Rule Two requires lampBurnedAt, and a decommissioned tower lights no one honestly. No hand can be charged yet; the question has shifted to whose light burned on that bearing.
  — adopts `towerOnBearing sswHalfWest southStack` · hypothesis: Someone placed or lit an unauthorized light on bearing sswHalfWest on the wreck night — South Stack being dark for six years, no official lamp could account for what the Mara steered by; a false or unlicensed light must stand behind her course.
  ⚑ **decay** — m_key slips — misremembered as "onlyKeyTo southStack brandt"

### Turn 8
*[The harbourmaster's storm-order is produced from the book, and the inspector's seal report is read into the room. The harbourmaster's storm-order stands in the book: Harlow Point to shutter at the dusk gun, the channel closed to all sail. The inspector found the shutter drawn and the Board's seal on it unbroken at first light.]*
  — *releases `m_shutter`*
**Tutor:** Shown: Brandt at Harlow; shown: Harlow shuttered at dusk, seal unbroken at first light. What happens to the Brandt account when its tower is both off the Mara's bearing and closed against light?
  — move: anaphora → m_shutter (consolidate)
**Learner:** Harlow Point is doubly eliminated: wrong bearing, and shuttered besides — no lamp burned there that night, and Brandt's confirmed presence there only proves he did not light it. The South Stack chain still wants one link: did a lamp burn at that decommissioned tower on the wreck night? Brandt holds the only key to South Stack yet his body was at Harlow; if a light burned there, the hand behind it remains ungrounded on my board. I also note my board still carries no loggedBearingOf mara sswHalfWest — if that fact slipped between acts, I ask the court to restore it before Rule One can formally fire.
  — adopts `shutteredOn harlowPoint wreckNight` · hypothesis: An unauthorized light burned at South Stack on the wreck night — Brandt held the only key yet was confirmed at Harlow; either another hand set a false light there without a key, or the onlyKeyTo entry on my board wants correction.
  ⚑ **aporia** — no progress over 6 turns
  ⚑ **plot_audit** — act 2 plot audited at run end: kept 4, justified 0, drift 2; arc on_arc; throughline reckoned (7 clauses)

## Instrument panel (programmatic eval — no judge)

- **verdict** `aporia` · 8/26 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0.125 D/turn overall (D 5→4 over 8 turns)
  - Act 1 (turns 1–4): 0.25 D/turn (ΔD 1)
  - Act 2 (turns 5–8): 0 D/turn (ΔD 0)
- **plateau** longest flat stretch 5 turns (aporia window 6)
- **releases** 3/8 on cue · 2 deviated
- **decay** 3 slips (seed 1 · rate 0.75 · grace 1) · repaired 1 (tutor 1, re-adoption 0) · mean repair latency 3 turns · unrepaired at end 2 · degraded-turn integral 6 · D reversals 0
- **mutations** 2 of the slips misremembered (false belief staged) · false form struck 1 · fully revised (struck + restored) 1 · false beliefs held to the end 1
- **theory fidelity** F 0.7 at end · min 0.7
  - m_key t3 misremembered as "onlyKeyTo harlowPoint senna"→t6 (tutor); false form struck t4 · p_bearing t6 (never repaired) · m_key t7 misremembered as "onlyKeyTo southStack brandt" (never repaired); false belief held to the end
- **events** plot×2 · throughline×1 · decay×3 · retract_false×1 · act_end×1 · plot_audit×2 · repair×1 · aporia×1
- **staging** 2 movements declared by the director
- **acts** 2 played · closed by the director 1 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–8 (run end)
- **plot** 2 committed · withhold+friction on 2/2 · 6 clauses avg · audits 2 (incl. final act): kept 9 / justified 0 / drift 3 · hold-named exhibits staged in act 0/1
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 2: on 2 / off 0 · run-end reckoning 7 clauses: kept 5 / justified 0 / drift 2
- **release authority** 2 played: 0 on schedule · 0 held · 2 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_bearing -1 (t3): "Played one turn early because the clerk has named the missing first ground and the empty place on the board is exactly the bearing-book."
  - p_chart -2 (t7): "The learner has repaired the Harlow key and kept the bearing as a heading only, so the chart can answer the blank wall without skipping a conjunct."
- **confrontation** 2 demanded (1 against a slipped exhibit) · re-entries 1: covered 1, uncovered 0 · watcher fires 1 (became the confrontation 1) · fires without recorded due 0
- **figures** erotema 3/8 (38%) · 4 distinct · switch rate 0.71
- **superego** intervened 2/8 watched turns · figure changed within-turn on 1/2 interventions · switch on intervention 1.00 vs elsewhere 0.60

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 8 | 3.13 | 4 | 42.5 |
| tutor | 8 | 2.38 | 3 | 45.3 |
| learner | 8 | 3.5 | 4 | 85.3 |

## Critic's commentary

*— notice by claude/claude-fable-5*

The Light on the Knock is a wreck inquiry staged as a chamber play. The brig Mara struck the Knock, a shoal, while steering for a fixed light; the hearing must decide whose light it was. A director sets the scenes and calls the acts. A tutor, as examining counsel, teaches by question and carries in the exhibits on a schedule the authors fixed in advance. A learner, cast as the court's clerk, knows the rules of proof but none of the facts, and reasons aloud toward a verdict. Suspicion gathers on Brandt, keeper of Harlow Point, sole key-holder, at his post all night. Then a chart puts the Mara's bearing not on Harlow but on the old South Stack, six years off the light-list, and a storm-order shutters Harlow besides. The learner ends pointing at a dark tower, asking who could have lit it; there the play stalls, eight of twenty-six turns played, without verdict. The concealed answer never came: the Mara steered by Senna's light, the old South Stack lamp relit by the keeper's ward.

Claude (Sonnet) plays the learner opposite a Codex director, tutor, and watcher, and was the steadiest hand on stage. At turn 1 it laid out the four links any charge would need. At turn 2 it took the key-paper without letting it reach the helm: a key closes a lamp-room, not a course. The production also simulates forgetting: adopted facts can rot or come back corrupted. The first corruption misremembered the key as Senna's — the true name arriving as a clerical error — and the learner struck it itself: "I retract the corrupted entry" (turn 4). Turn 7 brought the chart and South Stack on the bearing: "the whole case I was building toward Brandt falls with it." By turn 8 Harlow stood twice eliminated, and the learner had noticed the logged bearing gone from its own board: "I ask the court to restore it before Rule One can formally fire." No one did.

The verdict is aporia, the checker's word for a stall: facts on the board, but the distance to the secret no longer falling. Derivation distance — the count of evidence pieces still missing for the proof — began at five, fell to four at the bearing-book in turn 3, and never moved again; after six flat turns the checker rang its bell. Some of that flatness is artifact, for the meter cannot see a false trail falling; some is loss. The bearing decayed off the board at turn 6, a turn before its partner the chart arrived, and Rule One's two halves never stood grounded together. Three slips in eight turns, two never repaired; one false memory — Brandt holding South Stack's only key — survived to warp the closing conjecture. The director's three exhibits landed on cue; the tutor played its two proof pieces early, rightly, for the chart was otherwise due after the run ended. The watcher spoke twice to effect: its read-back demand at turn 4 surfaced the corrupted key, and at turn 6 it broke the tutor's only rut, a run of rhetorical questions, into a plain repair.

The movements shaped the play rather than labeled it: the second act's "certainty asked to stand in poorer light" (turn 5) came true two turns later in the chart, the evening's one coup. The chart delivered reversal; anagnorisis — the recognition this theatre exists to produce — never followed, on stage or in the ledger. The final image is the cruelest: a clerk petitioning for a book lying closed, uncleared, on the table before everyone.

The iteration establishes that a real learner will keep the discipline the form asks for: narrow adoption, unprompted retraction, standing requests for what it lost. The decisive defect is a repair channel running one way: the tutor mended the slip it noticed and stayed deaf to the one the learner reported twice. The next performance needs one clause in the tutor's charter: when the learner names a slipped exhibit and asks for it back, the tutor's next turn re-stages it verbatim before any new matter. And the checker might count the striking of a mirror — the authored near-miss — as motion, so its bell does not ring during the play's best stretch.
