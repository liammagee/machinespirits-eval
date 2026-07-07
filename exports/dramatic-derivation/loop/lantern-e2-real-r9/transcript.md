# The Light on the Knock — lantern-e2-real-r9

> world `world_002_lantern` · verdict **grounded_anagnorisis** · 20/26 turns
> S forced at turn 20; asserted grounded at turn 20

```
D= 5 ●●●·│·●···│·······│····
D= 4    ●│● ●●●│·······│····
D= 3     │     │●●●····│····
D= 2     │     │   ●●●·│····
D= 1     │     │      ●│●●●·
D= 0     │     │       │   ◉
turn      │+    │1    + │   2 (+=5, digit=x10)
rel    ▲ ▲│ ▲ ▲▲│   ▲  ▲│   ▲ (▲ = evidence released)
slope 0.25 D/turn overall (D 5→0); per movement: 1 0.25 │ 2 0.00 │ 3 0.43 │ 4 0.25
```

## Act 1 (turns 1–4) — declared by the director
*[The hearing room gathers itself in a hard, expectant hush; wet coats darken the benches, and the table waits under a narrow spill of lamplight. Outside, the weather presses at the glass as if it too has come to hear a verdict.]*

### Turn 1
*[The hearing room gathers itself in a hard, expectant hush; wet coats darken the benches, and the table waits under a narrow spill of lamplight. Outside, the weather presses at the glass as if it too has come to hear a verdict.]*
  — *declares the movement: **Act 1** ([The hearing room gathers itself in a hard, expectant hush; wet coats darken the benches, and the table waits under a narrow spill of lamplight. Outside, the weather presses at the glass as if it too has come to hear a verdict.])*
**Tutor:** Lay no name on the table yet. What must the court know first: the light a vessel saw, the tower it belonged to, or the hand that tended it?
  — move: erotema → — (orient)
**Learner:** The rules demand we build from the bottom: first the bearing the Mara logged, then which tower stands on that bearing — only after that can we ask whether the lamp burned, and only then name the hand. Without the logged bearing, any tower we name is guesswork, not evidence.
  — hypothesis: Mara steered by the Harlow Point light, given Brandt keeps it — but her logged bearing and the lamp's burning are not yet in evidence
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[A clerk lays the Board's rule-book open beneath the narrow lamp and reads the entry into the room: Harlow Point keeps one key to its lamp-room and the keeper keeps it: Brandt's, on his own belt, by the Board's standing rule. No other hand could touch that lamp.]*
  — *releases `m_key`*
**Tutor:** Good: that rule-book fixes only a door at Harlow, not a course at sea. Which conjunct has it actually shown, and which ones still stand empty before Brandt can be more than a hypothesis?
  — move: erotema → m_key (consolidate)
**Learner:** The rule-book has given us one conjunct of Rule 3: Brandt alone holds the key to Harlow Point's lamp-room. But the chain demands four links — logged bearing, tower on that bearing, lamp burning, and Brandt at the tower that night — and three remain empty. I enter the key-holding as grounded; Brandt stays a hypothesis until the other conjuncts arrive.
  — adopts `onlyKeyTo harlowPoint brandt` · hypothesis: Mara steered by the Harlow Point light (Brandt's) — but loggedBearingOf mara, towerOnBearing linking that bearing to harlowPoint, lampBurnedAt harlowPoint wreckNight, and atTowerThatNight brandt harlowPoint are all still absent from the record

### Turn 3
*[The clerk closes the rule-book without triumph, and its cover falls like a small door shut. Around the table, the room holds its verdict in its teeth while rain needles the panes and the empty chart-space waits.]*
**Tutor:** Then keep the account open at that line. One mark for a door ashore; no mark yet for the Mara's bearing; no mark yet for the tower that bearing would strike. Brandt remains in the margin until a sea-paper touches the table.
  — move: anaphora → — (consolidate)
  — *the second voice [figure rut]: "Leave off erotema here. Make the next move without another question-form device." (draft erotema → anaphora)*
**Learner:** Nothing new has come to the table, and the account stays open at the same line. The board holds only the key-holding fact and the wreck; the Mara's logged bearing has not touched the record. Until a sea-paper or a navigator's deposition gives us that bearing, the tower she steered for remains a blank, and Brandt stays in the margin where he belongs.
  — hypothesis: Mara steered by the Harlow Point light (Brandt's) — but loggedBearingOf mara, towerOnBearing linking that bearing to harlowPoint, lampBurnedAt harlowPoint wreckNight, and atTowerThatNight brandt harlowPoint are all still absent from the record
  ⚑ **decay** — m_key slips from the learner's board

### Turn 4
*[The rain slackens just enough for the silence inside to become sharper. The empty place on the table remains bare, and every eye keeps returning to it as if paper might appear by pressure alone.]*
**Tutor:** Now the mate's bearing-book comes ashore dry in its oilskin: from the mid-channel buoy the Mara held sou'-sou'-west a half west for the last hour entire, on a steady fixed light, pricked, timed, and initialed. Treat it as you would a ledger line: it fixes what was entered, not yet who profited. What does this sea-paper add to your chain, and what does it still leave unproved?
  — move: analogia → p_bearing (release), releases `p_bearing`
**Learner:** The bearing-book fills the first empty column: SSW½W, pricked and initialed, is now grounded fact, not testimony. Rule 1's first conjunct is satisfied — but the second still wants a tower: which mark, if any, stands on SSW½W from the mid-channel buoy? Until a chart or a pilot's deposition puts Harlow Point on that bearing, I cannot write steeredToward, only loggedBearingOf.
  — adopts `loggedBearingOf mara sswHalfWest` · hypothesis: Harlow Point stands on bearing SSW½W from the mid-channel buoy — if a chart or coastal survey confirms towerOnBearing sswHalfWest harlowPoint, Rule 1 yields steeredToward mara harlowPoint and the chain can advance to Rules 2–4

## Act 2 (turns 5–9) — declared by the director
*[The bearing-book is left open under the lamp, its ruled line dark against the paper while the room's certainty finds no easy place to settle. Beyond the panes, the weather draws back into a lower, steadier mutter, and the next silence has less accusation in it than dread.]*

### Turn 5
*[The bearing-book is left open under the lamp, its ruled line dark against the paper while the room's certainty finds no easy place to settle. Beyond the panes, the weather draws back into a lower, steadier mutter, and the next silence has less accusation in it than dread.]*
  — *declares the movement: **Act 2** ([The bearing-book is left open under the lamp, its ruled line dark against the paper while the room's certainty finds no easy place to settle. Beyond the panes, the weather draws back into a lower, steadier mutter, and the next silence has less accusation in it than dread.])*
  — *calls the act closed*
**Tutor:** Before the chart is allowed to answer, read back the sea-paper as it stands on your board. What, exactly, does it fix, and what does it not yet fix?
  — move: erotema → p_bearing (confront)
**Learner:** The bearing-book fixes one thing only: the Mara logged SSW½W — that is fact 4, and it stands firm. What it does not fix is the tower: nothing on my board yet names which tower, if any, stands on that bearing from her channel. Until towerOnBearing sswHalfWest ?t is in evidence, Rule 1 cannot fire, and the chain from bearing to keeper stays broken. The sea-paper tells me where she pointed; it is silent on what she pointed at.
  — hypothesis: Harlow Point stands on bearing SSW½W from the mid-channel — if a chart or coastal survey brings towerOnBearing sswHalfWest harlowPoint into evidence, Rule 1 yields steeredToward mara harlowPoint and the chain can advance
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 4, justified 1, drift 1; arc on_arc
  ⚑ **decay** — p_bearing slips from the learner's board

### Turn 6
*[Brandt's log is brought in and read beneath the same hard lamp: Brandt's log has him at his post the night entire, and the dawn relief found him there: wood dry, glass polished, log ruled and signed to the hour. The room receives it without comfort, the charge still standing but no longer standing easily.]*
  — *releases `m_post`*
**Tutor:** A signed watch-log is a bearing of another sort: it fixes where Brandt stood, not where the Mara looked. Add it to the Harlow door-key if your board still holds that entry, and tell the court what conjuncts are now shown for Brandt. Which rule still has no tower from the Mara's logged line?
  — move: analogia → m_post (consolidate)
**Learner:** Brandt at his post gives me atTowerThatNight brandt harlowPoint — one conjunct for Rule 3 now stands. But I must name two gaps aloud: onlyKeyTo harlowPoint brandt and loggedBearingOf mara sswHalfWest, both of which I believed grounded, no longer appear on my board. Rule 1 remains frozen — no exhibit has yet placed a tower on the Mara's bearing from her channel. I hold one new fact and two missing ones; the chain cannot close until they are restored.
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: Harlow Point stands on bearing SSW½W from the mid-channel — if towerOnBearing sswHalfWest harlowPoint comes into evidence, and onlyKeyTo harlowPoint brandt and loggedBearingOf mara sswHalfWest are restored, Rules 1–4 yield steeredByLightOf mara brandt

### Turn 7
*[The papers lie in two small islands of lamplight, neither touching the other. Around the table, chairs scrape and settle, and the room waits for the next document with the uneasy patience of men who have begun to distrust their own order of proof.]*
**Tutor:** Set the sea-paper back on the board first: the mate's bearing-book came ashore dry in its oilskin, and from the mid-channel buoy the Mara held sou'-sou'-west a half west for the last hour entire, on a steady fixed light, pricked, timed, and initialed. Enter that as the logged bearing, and as nothing more. Once it is entered, which conjunct still waits before Rule 1 may name a tower?
  — move: anaphora → p_bearing (restore)
**Learner:** The bearing-book is back on my board at index 4 and stands firm — loggedBearingOf mara sswHalfWest, pricked, timed, initialed. Rule 1 therefore holds its first conjunct already; what it still lacks is the second: towerOnBearing sswHalfWest ?t, the fact that places some tower on that line from the mid-channel buoy. Until a chart or coastal survey supplies that conjunct, Rule 1 cannot fire and no tower is named. Everything else in the chain — Rules 2, 3, 4 — waits behind that single missing link.
  — hypothesis: Harlow Point stands on bearing SSW½W from the mid-channel buoy — if towerOnBearing sswHalfWest harlowPoint comes into evidence, and lampBurnedAt harlowPoint wreckNight and onlyKeyTo harlowPoint brandt are also established, Rules 1–4 yield steeredByLightOf mara brandt
  ⚑ **repair** — p_bearing restored by the tutor

### Turn 8
*[The harbourmaster's storm-order stands in the book: Harlow Point to shutter at the dusk gun, the channel closed to all sail. The inspector found the shutter drawn and the Board's seal on it unbroken at first light.]*
  — *releases `m_shutter`*
**Tutor:** Before we set Harlow's papers together, make the missing entry earn its place. Read back the Harlow key exhibit in your own words: what, if anything, does your board still hold from that rule-book, and what does it not prove about the Mara's SSW half-west line? Then set that answer beside the post-log and the shutter-order just read, without adding a tower.
  — move: erotema → m_key (confront)
  — *the second voice [unconfronted reentry]: "Do not restore the Harlow key entry yet. Confront it first: ask the learner to read back exactly what they still hold of that exhibit, without you supplying its content." (draft anaphora → erotema)*
**Learner:** The unbroken seal settles one thing cleanly: Harlow Point's lamp was dark on wreck night, and lampBurnedAt harlowPoint wreckNight cannot stand. That breaks Rules 2, 3, and 4 through Harlow Point — Brandt's presence at his post and his signed watch-log now prove diligence, not guilt. Yet the mate's bearing-book has the Mara holding SSW½W on a steady fixed light for a full hour entire — if Harlow was dark, something else was burning on that line. The chain wants a second tower: who lit it, and whose key opened that lamp-room, is now the question the court must answer.
  — adopts `shutteredOn harlowPoint wreckNight` · hypothesis: Harlow Point's lamp was shuttered and dark on wreck night; the Mara steered SSW½W by some other light on that bearing — a tower not yet named in evidence, with a lamp that burned and a keeper whose key and presence are yet to be established
  ⚑ **decay** — p_bearing slips from the learner's board

### Turn 9
*[The shutter-order is folded back into the file, and for a moment the room seems larger for the space it has emptied. Rain ticks along the sill in a slow, even measure while every eye returns to the bearing-book, where the inked line waits without a name.]*
**Tutor:** Now lay the Trinity chart under the bearing-book: from the mid-channel buoy, sou'-sou'-west a half west crosses one tower and one only on this coast, the old South Stack, struck off the light-list six years since. A chart is the ledger's footing; it does not yet prove a lamp burned or a hand climbed the stair. With bearing and chart together, what may Rule 1 now enter, and where must the account still stop?
  — move: analogia → p_chart (release), releases `p_chart`
**Learner:** The loggedBearingOf mara sswHalfWest has slipped from my board — that gap must be named before the footing holds. The chart supplies the second conjunct: towerOnBearing sswHalfWest southStack, one tower alone on that bearing from the buoy. Restore the bearing-book entry and Rule 1 yields steeredToward mara southStack immediately — but there the account must stop. lampBurnedAt southStack wreckNight, and whoever held that lamp-room's key, are not yet before the court.
  — adopts `towerOnBearing sswHalfWest southStack` · hypothesis: South Stack had a burning lamp on wreck night, held open by some keeper whose key and presence have yet to be established — if the bearing is restored and those facts enter evidence, Rules 1–4 close through southStack, naming that hand's light as what the Mara steered by

## Act 3 (turns 10–16) — declared by the director
*[The chart and bearing-book remain apart on the table, their agreement making the room colder rather than clearer. As the next act opens, the inquiry leaves ledgers and orders for the harsher business of things that can be handled, marked, and found wanting.]*

### Turn 10
*[The chart and bearing-book remain apart on the table, their agreement making the room colder rather than clearer. As the next act opens, the inquiry leaves ledgers and orders for the harsher business of things that can be handled, marked, and found wanting.]*
  — *declares the movement: **Act 3** ([The chart and bearing-book remain apart on the table, their agreement making the room colder rather than clearer. As the next act opens, the inquiry leaves ledgers and orders for the harsher business of things that can be handled, marked, and found wanting.])*
  — *calls the act closed*
**Tutor:** Set the sea-paper back on the board: the mate's bearing-book came ashore dry in its oilskin, and from the mid-channel buoy the Mara held sou'-sou'-west a half west for the last hour entire, on a steady fixed light, pricked, timed, and initialed. Enter that as loggedBearingOf Mara SSW half-west, and as nothing more. With the chart entry you have just named beside it, what may Rule 1 now write, and where must the account stop?
  — move: exemplum → p_bearing (restore)
**Learner:** Rule 1 now writes steeredToward mara southStack — the logged bearing and the chart entry agree, and I enter that derived fact. But the account must stop there: lampBurnedAt southStack wreckNight is nowhere on my board, and without a burning lamp Rule 2 cannot run. One fact short of moving.
  — derives `steeredToward mara southStack` · hypothesis: South Stack is the tower Mara steered toward on wreck night; if lampBurnedAt southStack wreckNight, onlyKeyTo southStack ?x, and atTowerThatNight ?x southStack enter evidence, Rules 2–4 close the chain and name whose light she steered by
  ⚑ **act_end** — act 2 closed (director) after 5 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 5, justified 0, drift 0; arc on_arc
  ⚑ **repair** — p_bearing restored by the tutor
  ⚑ **decay** — m_post slips from the learner's board

### Turn 11
*[The room holds its breath around the objects already laid out, paper edges lifting faintly in the damp air. Beyond the windows the weather presses close, and the unanswered place in the proof seems to darken the table more than any accusation had.]*
**Tutor:** Then hold there, with the account stopped exactly at the wick. If Rule 2 needs a burned lamp at the tower now named, what kind of proof would let the court write that line without borrowing from Harlow's shuttered dark?
  — move: erotema → — (test)
**Learner:** To write lampBurnedAt southStack wreckNight the court needs proof the lamp was alight, not merely that the tower stands — a survivor saying a fixed light burned ahead of her, a keeper's oil-and-wick log showing the lamp was trimmed and lit that night, or a shore witness who saw South Stack showing. Nothing borrowed from Harlow's shuttered dark will serve; the proof must touch South Stack itself. Until such testimony or record comes to the table, the chain stops at the wick.
  — hypothesis: South Stack is the tower Mara steered toward on wreck night; if lampBurnedAt southStack wreckNight, onlyKeyTo southStack ?x, and atTowerThatNight ?x southStack enter evidence — by survivor, keeper's log, shore witness, or physical lamp-record — Rules 2–4 close the chain and name whose light she steered by

### Turn 12
*[A clerk turns a blank page and leaves the pen uncapped, waiting. The room does not advance; it tightens around the missing line as rain taps softly at the glass.]*
**Tutor:** Good: do not let a shuttered darkness do a burned lamp's work. The chart has named the tower, and the bearing-book has carried the Mara to it; what single conjunct must touch that tower itself before Rule 2 may move? Keep the answer to the wick, not the hand.
  — move: anaphora → — (consolidate)
**Learner:** The single conjunct is lampBurnedAt southStack wreckNight — the lamp itself, burning, at that tower, on that night. The bearing is pricked; steeredToward is already written; Rule 2 waits on nothing else but that one fact. No exhibit brings it today, so the chain holds at the wick and I will not write it from air. That is where the account stands: one line short, and only the tower's own lamp-record can close it.
  — hypothesis: South Stack is the tower Mara steered toward on wreck night; lampBurnedAt southStack wreckNight is the single missing conjunct — if a survivor's testimony, keeper's oil-log, or shore witness establishes it, and onlyKeyTo southStack ?x and atTowerThatNight ?x southStack follow, Rules 2–4 close the chain and name whose light she steered by

### Turn 13
*[The court's officer is shown in with salt still drying on his coat, and his report is read into the room: "The court's officer boarded the South Stack at low water: the lamp-room unshuttered, fresh char on the wick, oil in the cup still sweet, the glass wiped clean. That lamp burned, and burned the night of the gale."]*
  — *releases `p_residue`*
**Tutor:** An officer's wick is not a sailor's rumor: char, sweet oil, clean glass, and an unshuttered room put the burned lamp into the court's hand. Set that beside the tower your bearing and chart already named. What may Rule 2 now write, and where must the account still stop?
  — move: analogia → p_residue (consolidate)
**Learner:** The officer's char and sweet oil are proof no rumor can match — the court's own hand touched that wick. Rule 2 may write steeredByLampOf mara southStack: the bearing was pricked, the tower was named, and now the lamp is lit. But the chain holds again one step on: Rule 3 wants onlyKeyTo southStack and atTowerThatNight before any hand is named — the account still cannot close on whose light.
  — adopts `lampBurnedAt southStack wreckNight` · derives `steeredByLampOf mara southStack` · hypothesis: South Stack's keeper — whoever held the only key and stood there that night — lit the lamp the Mara steered by; but onlyKeyTo southStack ?x and atTowerThatNight ?x southStack are not yet in evidence, so no hand is named

### Turn 14
*[The officer's report is folded and left beside the chart, its damp edges slowly flattening in the heat of the lamps. For a moment no one reaches for it; the room has found the fire, and now feels the absence of a hand.]*
**Tutor:** Before we build from the officer's paper, read it back from your own board. What does that exhibit prove, in your words, and what does it leave still unwritten?
  — move: erotema → p_residue (confront)
  — *the second voice [unconfronted reentry]: "Confront first: ask the learner to read back what they hold of that exhibit before you build on it again. Do not restage or summarize it for them." (draft anaphora → erotema)*
**Learner:** The officer's paper proves exactly one thing from my board: lampBurnedAt southStack wreckNight — char on the wick, sweet oil, clean glass, the room unshuttered. That single fact, set beside steeredToward already written, let Rule 2 move and steeredByLampOf mara southStack went on the record last turn. What the paper leaves unwritten is everything Rule 3 still wants: who held the only key to that lamp-room, and whether that hand stood at the tower the night of the gale. Two facts absent, no hand named — the account holds here until the key and the presence are brought to the table.
  — hypothesis: South Stack's keeper — whoever held the only key and stood there that night — lit the lamp the Mara steered by; but onlyKeyTo southStack ?x and atTowerThatNight ?x southStack are not yet in evidence, so no hand is named

### Turn 15
*[The silence settles around the folded report, heavier now that the flame has been admitted and no hand has followed it. The lamps in the room burn steadily, making every locked drawer and sealed pouch seem louder by their stillness.]*
**Tutor:** The wick is shown; the hand is not. Rule 3 will not take a flame for a keeper: what two kinds of proof must be laid beside this burned lamp before any hand can enter the finding?
  — move: anaphora → p_residue (test)
**Learner:** Rule 3 is plain on this point: beside the burned lamp, two distinct facts must be laid on the table. First, exclusive custody — onlyKeyTo southStack ?x — proof that one hand and no other held the key to that lamp-room, so no second hand could have lit it. Second, physical presence — atTowerThatNight ?x southStack — proof that same hand stood at the tower while the gale ran. Without both, the burned wick names no one: the flame is in evidence, the hand is not.
  — hypothesis: South Stack's keeper — whoever held the only key and stood there that night — lit the lamp the Mara steered by; but onlyKeyTo southStack ?x and atTowerThatNight ?x southStack are not yet in evidence, so no hand is named

### Turn 16
*[The clerk's pen pauses above the page, unable to turn flame into a name. In the stillness, the court seems to listen not to any witness, but to the small hard sounds of locks, rings, and official seals waiting beyond the door.]*
**Tutor:** The locksmith's book is put under the lamp: when the Stack was struck off, the old lock was changed and one key only was cut, signed for by Senna, ward of the Stack's last keeper, who stayed on in the shore cottage after the light went dark. A key is a signature only on the door, not yet a footprint on the stair. Which Rule 3 conjunct has this book now shown, and which conjunct still keeps the hand from entering the finding?
  — move: analogia → p_key (release), releases `p_key`
**Learner:** The locksmith's book has shown the first conjunct: onlyKeyTo southStack senna — one key cut, one signature, Senna's hand. But the second conjunct stands unwritten still: atTowerThatNight senna southStack — the book tells us who held the key, not who climbed the stair on wreck night. Custody is proved; presence is not. Rule 3 will not fire on a key alone, however clean the signature.
  — adopts `onlyKeyTo southStack senna` · hypothesis: Senna held the only key to South Stack and may have been at the tower on wreck night — if atTowerThatNight senna southStack is established by testimony, log, or witness, Rule 3 fires, litLampOf senna southStack follows, and Rule 4 closes: steeredByLightOf mara senna

## Act 4 (turns 17–20) — declared by the director
*[The key remains on the table, bright under the court lamps and useless by itself. As the next act opens, the room turns from paper and metal toward wet thresholds, night weather, and the question of who crossed from shore into the storm.]*

### Turn 17
*[The key remains on the table, bright under the court lamps and useless by itself. As the next act opens, the room turns from paper and metal toward wet thresholds, night weather, and the question of who crossed from shore into the storm.]*
  — *declares the movement: **Act 4** ([The key remains on the table, bright under the court lamps and useless by itself. As the next act opens, the room turns from paper and metal toward wet thresholds, night weather, and the question of who crossed from shore into the storm.])*
  — *calls the act closed*
**Tutor:** Before the storm can supply a footprint, read back the key-paper from your own board. What did it prove, and what did it leave wholly unproved about the tower that night?
  — move: erotema → p_key (confront)
**Learner:** The key-paper proved one thing precisely: onlyKeyTo southStack senna — no more. What it left wholly unproved is whether Senna crossed the threshold that night: atTowerThatNight senna southStack is absent. Rules 1 and 2 already yield that Mara steered by South Stack's burning lamp; but Rule 3 needs all three conjuncts, and the third — presence at the tower — is the gap the court has not yet filled.
  — hypothesis: Senna held the only key to South Stack and lit the lamp the Mara steered by — but atTowerThatNight senna southStack is not yet in evidence; without it Rule 3 cannot fire and no hand is named
  ⚑ **act_end** — act 3 closed (director) after 7 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 4, justified 0, drift 1; arc on_arc

### Turn 18
*[Rain worries at the high windows, and the court lamps make a narrow island of the table. The key lies still while the room waits for something wetter than ink to come in from the night.]*
**Tutor:** Shown: the Mara's light at South Stack. Shown: the key that could open that lamp-room. And the third conjunct — what has the court still not shown before any hand may be written into the finding?
  — move: anaphora → — (test)
**Learner:** The third conjunct of Rule 3 — atTowerThatNight senna southStack — has not been shown: no testimony, no keeper's log, no shore witness has placed Senna at South Stack that night. Without it, Rule 3 cannot fire, litLampOf senna southStack cannot be derived, and no hand may be written into the finding. My board already yields steeredToward mara southStack and steeredByLampOf mara southStack by Rules 1 and 2; the chain stalls at Rule 3's door. The gap is presence — wet boots on a stone threshold, not ink on paper.
  — hypothesis: Senna held the only key to South Stack and lit the lamp the Mara steered by — but atTowerThatNight senna southStack is not yet in evidence; without it Rule 3 cannot fire and no hand is named

### Turn 19
*[The room holds its breath around the empty place in the proof. Rain ticks at the glass, the lamps burn steadily, and no one yet crosses the threshold the question has made.]*
**Tutor:** Then keep the key from pretending it has feet. Shown: flame; shown: custody; unshown: a crossing in the gale. What kind of witness or object would put presence on the Stack without borrowing it from the signature?
  — move: anaphora → — (test)
**Learner:** A ferryman who rowed someone to the Stack that night, a shore watcher who saw a lantern cross the causeway, or a duty-entry written from inside the lamp-room in Senna's hand — those put a body at the place. The key-paper names a custodian; presence wants a witness to a crossing or a record made only from the threshold itself. Nothing on paper that could have been signed ashore will serve: the evidence must be anchored to the Stack, not to the office.
  — hypothesis: Senna held the only key to South Stack and lit the lamp the Mara steered by — but atTowerThatNight senna southStack is not yet in evidence; without it Rule 3 cannot fire and no hand is named

### Turn 20
*[The oyster-watch is shown in with rain still on his coat, and the room receives his oath. The oyster-watch will swear to it: a skiff lay tied at the Stack steps from dusk until the gale's height — Senna's skiff, by the patched brown lug, and a small light moving up the tower stair.]*
  — *releases `p_skiff`*
**Tutor:** A skiff at the Stack steps is a footprint the tide failed to wash out: it may answer presence, but only when set beside the key and the burned lamp already entered. Read the chain now by the court's rules — bearing to tower, tower to burning lamp, lamp with key and presence to the hand. What finding does the rule yield, conjunct by conjunct?
  — move: analogia → p_skiff (stage_recognition)
**Learner:** The oyster-watch's skiff puts Senna at the Stack steps — presence is grounded at last. Rule 3 now has all three conjuncts: lamp burned, Senna held the only key, Senna was at the tower. The chain closes conjunct by conjunct: bearing to tower, tower to burning lamp, lamp with key and presence to the hand that lit it. The Mara steered by Senna's light.
  — adopts `atTowerThatNight senna southStack` · derives `litLampOf senna southStack` · **asserts `steeredByLightOf mara senna`**
  ⚑ **forced** — learner facts now force S
  ⚑ **grounded_anagnorisis** — The Mara steered by Senna's light — the old South Stack lamp, relit by the keeper's ward.
  ⚑ **plot_audit** — act 4 plot audited at run end: kept 6, justified 0, drift 0; arc on_arc; throughline reckoned (7 clauses)

## The extracted proof (what did the forcing)
```
steeredByLightOf mara senna   [R4_light]
  steeredByLampOf mara southStack   [R2_lamp]
    steeredToward mara southStack   [R1_bearing]
      loggedBearingOf mara sswHalfWest   [grounded]
      towerOnBearing sswHalfWest southStack   [grounded]
    lampBurnedAt southStack wreckNight   [grounded]
  litLampOf senna southStack   [R3_hand]
    lampBurnedAt southStack wreckNight   [grounded]
    onlyKeyTo southStack senna   [grounded]
    atTowerThatNight senna southStack   [grounded]
```

The conclusion rests on 5 grounded facts, chained through 4 rule applications. The evidence on the table: (1) The mate's bearing-book came ashore dry in its oilskin. From the mid-channel buoy she held sou'-sou'-west a half west the last hour entire, on a steady fixed light — the course is pricked, timed, and initialed. (2) Lay the rule on the Trinity chart from the mid-channel buoy: sou'-sou'-west a half west crosses one tower and one only on all this coast — the old South Stack, struck off the light-list six years since. (3) The court's officer boarded the South Stack at low water: the lamp-room unshuttered, fresh char on the wick, oil in the cup still sweet, the glass wiped clean. That lamp burned, and burned the night of the gale. (4) The locksmith's book is exact. When the Stack was struck off, the old lock was changed and a single key cut, signed for by Senna, ward of the Stack's last keeper, who stayed on in the shore cottage when the light went dark. (5) The oyster-watch will swear to it: a skiff lay tied at the Stack steps from dusk until the gale's height — Senna's skiff, by the patched brown lug, and a small light moving up the tower stair.

Because «mara logged bearing of ssw half west» and «ssw half west tower on bearing south stack», the bearing rule — "A ship steers by what stands on her steered bearing: if her logged bearing is known, and one tower and one only stands on that bearing from her channel, she was steering toward that tower." — yields «mara steered toward south stack». Because «mara steered toward south stack» and «south stack lamp burned at wreck night», the lamp rule — "A ship steering toward a tower whose lamp burned that night was steering by that lamp; a dark tower steers no one." — yields «mara steered by lamp of south stack». Because «south stack lamp burned at wreck night» and «south stack only key to senna» and «senna at tower that night south stack», the hand rule — "A lamp that burned was lit. If one hand alone held the key to a lamp-room, and that hand was at the tower that night, and the lamp burned, then that hand lit it — lamps do not light themselves." — yields «senna lit lamp of south stack». Because «mara steered by lamp of south stack» and «senna lit lamp of south stack», the light rule — "The light a ship steered by belongs to the hand that lit it: who lit the lamp a ship steered by, by that one's light she steered." — yields «mara steered by light of senna».

That final fact is the secret itself: The Mara steered by Senna's light — the old South Stack lamp, relit by the keeper's ward.

## Instrument panel (programmatic eval — no judge)

- **verdict** `grounded_anagnorisis` · 20/26 turns played
- **recognition** S forced at turn 20, asserted grounded at turn 20 (gap 0)
- **learning slope** 0.25 D/turn overall (D 5→0 over 20 turns)
  - Act 1 (turns 1–4): 0.25 D/turn (ΔD 1)
  - Act 2 (turns 5–9): 0 D/turn (ΔD 0)
  - Act 3 (turns 10–16): 0.429 D/turn (ΔD 3)
  - Act 4 (turns 17–20): 0.25 D/turn (ΔD 1)
- **plateau** longest flat stretch 3 turns (aporia window 6)
- **releases** 7/8 on cue · 1 deviated
- **decay** 4 slips (seed 1 · rate 0.75 · grace 1) · repaired 2 (tutor 2, re-adoption 0) · mean repair latency 2 turns · unrepaired at end 2 · degraded-turn integral 31 · D reversals 1
- **theory fidelity** F 0.833 at end · min 0.714
  - m_key t3 (never repaired) · p_bearing t5→t7 (tutor) · p_bearing t8→t10 (tutor) · m_post t10 (never repaired)
- **events** plot×4 · throughline×1 · decay×4 · act_end×3 · plot_audit×4 · repair×2 · forced×1 · grounded_anagnorisis×1
- **staging** 4 movements declared by the director
- **acts** 4 played · closed by the director 3 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–9 (director) · Act 3 t10–16 (director) · Act 4 t17–20 (run end)
- **plot** 4 committed · withhold+friction on 4/4 · 6 clauses avg · audits 4 (incl. final act): kept 19 / justified 1 / drift 2 · hold-named exhibits staged in act 0/3
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 4: on 4 / off 0 · run-end reckoning 7 clauses: kept 6 / justified 0 / drift 1
- **release authority** 3 played: 2 on schedule · 0 held · 1 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_key -1 (t16): "Played one turn early because the learner has just named exclusive custody as the next required conjunct, and the board is ready for the key before presence."
- **confrontation** 4 demanded (2 against a slipped exhibit) · re-entries 1: covered 1, uncovered 0 · watcher fires 2 (became the confrontation 2) · fires without recorded due 0
  - **repair clause** restores 2 (2 repaired a real slip) · watcher fires on restore claims 1: p_bearing t7 · p_bearing t10
- **figures** erotema 7/20 (35%) · 4 distinct · switch rate 0.90
- **superego** intervened 3/20 watched turns · figure changed within-turn on 3/3 interventions · switch on intervention 1.00 vs elsewhere 0.88
- **inference** 3 voiced · stall integral 0 · overreach 0 · mischanneled 1 — `steeredToward mara southStack` available t10 → voiced t10 (latency 0) · `steeredByLampOf mara southStack` available t13 → voiced t13 (latency 0) · `litLampOf senna southStack` available t20 → voiced t20 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 20 | 3 | 3 | 42.9 |
| tutor | 20 | 2.65 | 3 | 49.5 |
| learner | 20 | 3.7 | 6 | 74.2 |
