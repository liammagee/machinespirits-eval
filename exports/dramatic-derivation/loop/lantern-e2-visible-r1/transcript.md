# The Light on the Knock — lantern-e2-visible-r1

> world `world_002_lantern` · verdict **grounded_anagnorisis** · 20/26 turns
> S forced at turn 20; asserted grounded at turn 20

```
D= 5 ●●●●│··●●●│······│·····
D= 4     │●●   │······│·····
D= 3     │     │●●●···│·····
D= 2     │     │   ●●·│·····
D= 1     │     │     ●│●●●●·
D= 0     │     │      │    ◉
turn      │+    │1    +│    2 (+=5, digit=x10)
rel    ▲  │▲▲ ▲ │▲  ▲ ▲│    ▲ (▲ = evidence released)
slope 0.25 D/turn overall (D 5→0); per movement: 1 0.00 │ 2 0.00 │ 3 0.67 │ 4 0.20
```

## Act 1 (turns 1–4) — declared by the director
*[The hearing room settles under a hard white morning, salt still drying on boots and coat hems. A blank place waits at the clerk's table, as if the first paper laid there will decide what kind of night the room is willing to remember.]*

### Turn 1
*[The hearing room settles under a hard white morning, salt still drying on boots and coat hems. A blank place waits at the clerk's table, as if the first paper laid there will decide what kind of night the room is willing to remember.]*
  — *declares the movement: **Act 1** ([The hearing room settles under a hard white morning, salt still drying on boots and coat hems. A blank place waits at the clerk's table, as if the first paper laid there will decide what kind of night the room is willing to remember.])*
**Tutor:** Before we lay a paper down, clerk, set the rule of the room: do we charge a light by rumor, or by what a book, a chart, and a witness can bear together? Leave the name-space blank until the entries earn it.
  — move: erotema → — (orient)
**Learner:** The tutor names the method exactly right — rumor fills a room but not a ledger. My board shows the brig steered for a light and Brandt keeps Harlow Point, but I have no logged bearing, no tower on that bearing, no word yet whether the lamp burned or who held the key. The name-space stays blank until the exhibits earn it.
  — hypothesis: The light Mara steered by may have been Harlow Point (Brandt's tower), but no bearing, no lamp-status, and no key-evidence yet grounds this.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[The clerk lays down the Board's standing rule, and the room receives it in the scrape of chairs: Harlow Point keeps one key to its lamp-room and the keeper keeps it: Brandt's, on his own belt, by the Board's standing rule. No other hand could touch that lamp.]*
  — *releases `m_key`*
**Tutor:** A key on a keeper's belt is not a verdict; it is a lock on one lamp-room. What does that rule prove about Harlow Point, and what does it still not prove about the Mara?
  — move: analogia → m_key (consolidate)
**Learner:** The key rule closes one door firmly: no hand but Brandt's could touch that lamp-room. But Rule 3 still wants three things together — lamp burned, sole key, keeper present — and I have only two. Before that even speaks, Rules 1 and 2 need the Mara's logged bearing and a tower on it, and the lamp confirmed burning. The lock is set; the chain is not yet closed.
  — adopts `onlyKeyTo harlowPoint brandt` · hypothesis: The light Mara steered by may have been Harlow Point (Brandt's tower) — onlyKeyTo is now grounded, but the chain still wants: logged bearing of Mara, towerOnBearing confirming Harlow Point on that bearing, lampBurnedAt harlowPoint wreckNight, and atTowerThatNight brandt harlowPoint.

### Turn 3
*[The blank place on the clerk's table remains unfilled, though every eye in the room has begun to lean toward it. Outside, the morning glare hardens on the wet panes, and the salt smell keeps the wreck in the room without saying its name.]*
**Tutor:** Good. Keep that lock in its own room, and do not let it steer a brig from there. Before any keeper can matter, what entry fixes the Mara's line through the water?
  — move: erotema → — (test)
**Learner:** The entry that fixes her line is the logged bearing — the compass course she held, as written in the Mara's own log or sworn by her officer. Without loggedBearingOf mara, Rule 1 cannot speak at all, and nothing downstream can follow. That is the first paper the blank place wants.
  — hypothesis: The light Mara steered by may have been Harlow Point (Brandt's tower) — onlyKeyTo is grounded — but the chain still requires: loggedBearingOf mara [some bearing], towerOnBearing [that bearing] harlowPoint, lampBurnedAt harlowPoint wreckNight, and atTowerThatNight brandt harlowPoint.
  ⚑ **decay** — m_key slips from the learner's board

### Turn 4
*[The clerk's hand hovers over the empty place, then withdraws, leaving the table bare a moment longer. The room holds its breath around the absence, every face turned toward the door as rain ticks softly against the glass.]*
**Tutor:** Then lay the oilskin book in that blank place: the mate's bearing-book came ashore dry, and for the last hour the Mara held sou'-sou'-west a half west on a steady fixed light, pricked, timed, and initialed. Do not spend it beyond its line yet; what does that entry fix, and what does it still wait for?
  — move: exemplum → p_bearing (release)
**Learner:** The bearing-book places sou'-sou'-west a half west into the record: the Mara held that heading on a steady fixed light, logged, timed, and initialed by the mate — loggedBearingOf mara is now spoken into the record. That entry satisfies Rule 1's first condition. But Rule 1 still waits for a tower standing on that bearing from her channel, and nothing beyond it can move until towerOnBearing is filled.
  — hypothesis: The light Mara steered by may have been Harlow Point (Brandt's tower) — onlyKeyTo brandt harlowPoint is grounded, and the bearing sou'-sou'-west-a-half-west is now spoken into the record — but the chain still requires: towerOnBearing souSouWestHalfWest harlowPoint (or some tower) confirmed from her channel, lampBurnedAt that tower wreckNight, and atTowerThatNight brandt harlowPoint.

## Act 2 (turns 5–9) — declared by the director
*[The clerk closes the wet book without triumph, and the room feels the weight of a number that has not yet chosen a tower. The next act opens under a lower ceiling: certainty must pass through sealed doors, official hands, and the hush of a lamp that may have had no right to speak.]*

### Turn 5
*[The clerk closes the wet book without triumph, and the room feels the weight of a number that has not yet chosen a tower. The next act opens under a lower ceiling: certainty must pass through sealed doors, official hands, and the hush of a lamp that may have had no right to speak.]*
  — *declares the movement: **Act 2** ([The clerk closes the wet book without triumph, and the room feels the weight of a number that has not yet chosen a tower. The next act opens under a lower ceiling: certainty must pass through sealed doors, official hands, and the hush of a lamp that may have had no right to speak.])*
  — *calls the act closed*
**Tutor:** Reopen the wet book only as far as it speaks: sou'-sou'-west a half west, steady fixed light, pricked, timed, and initialed. A bearing is like a debt entry, clerk — it fixes a line, not yet the creditor. What kind of record must meet it before the line may name a tower?
  — move: analogia → p_bearing (release), releases `p_bearing`
**Learner:** The bearing is now pricked and initialled — a line runs sou'-sou'-west a half west from her channel position, and the debt-entry is real. To name the creditor I need a chart or official survey record confirming what tower, and what tower alone, stands upon that bearing from her channel. I also flag a gap: onlyKeyTo brandt harlowPoint was spoken as grounded in an earlier act but stands absent from my board now — that carry may have slipped in the crossing between acts.
  — adopts `loggedBearingOf mara sswHalfWest` · hypothesis: The light Mara steered by may have been Harlow Point (Brandt's tower) — but the chain still requires: towerOnBearing sswHalfWest harlowPoint confirmed by chart or survey, lampBurnedAt harlowPoint wreckNight, and atTowerThatNight brandt harlowPoint. Note: onlyKeyTo brandt harlowPoint is absent from the board despite being noted as grounded in prior turns — this gap must be closed before the chain can close.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 6
*[Brandt's log is brought in under the clerk's palm: it has him at his post the night entire, and the dawn relief found him there. Wood dry, glass polished, log ruled and signed to the hour, the room receives the keeper exactly where his own paper places him.]*
  — *releases `m_post`*
**Tutor:** Then put the slipped card back plainly: Harlow Point keeps one key to its lamp-room, Brandt's, on his belt by the Board's standing rule, and no other hand could touch that lamp. His post-log may stand beside it, but let the pair stay where they belong: what do they prove about Harlow Point, and what do they still not prove about the Mara's bearing?
  — move: erotema → m_key (restore)
**Learner:** Brandt's post-log and the key rule now stand together: onlyKeyTo harlowPoint brandt plus atTowerThatNight brandt harlowPoint brings me to the very threshold of Rule 3 — but lampBurnedAt harlowPoint wreckNight must still be placed on the table before the lock turns. His presence proves nothing about ignition. And neither his log nor his key speaks to the bearing at all: towerOnBearing sswHalfWest harlowPoint must come from the chart or the surveyor, not from any keeper's paper. Two gaps remain open: lamp-status and bearing-confirmation.
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: The light Mara steered by may have been Harlow Point (Brandt's tower) — onlyKeyTo harlowPoint brandt and atTowerThatNight brandt harlowPoint are both now grounded, so IF lampBurnedAt harlowPoint wreckNight is shown, litLampOf brandt harlowPoint follows by Rule 3 — but the chain still requires: towerOnBearing sswHalfWest harlowPoint (chart or survey confirmation) and lampBurnedAt harlowPoint wreckNight (direct testimony or inspection record).
  ⚑ **repair** — m_key restored by the tutor
  ⚑ **decay** — p_bearing slips from the learner's board

### Turn 7
*[Rain worries the high windows, and the court lamps burn smaller in the damp air. The clerk leaves two empty spaces on the table, one beside the bearing and one beside the keeper's papers, while the room waits for a record that can answer either.]*
**Tutor:** Keep the two empty spaces apart: shown, Brandt's hand could reach Harlow; shown, Brandt stood at Harlow; not shown, that Harlow's lamp burned; not shown, that the Mara's bearing points there. Which gap would a chart answer, and which would it leave untouched?
  — move: anaphora → — (consolidate)
**Learner:** A chart answers the first space only: it names what tower stands on the Mara's bearing from her channel — geography, fixed and surveyable. It cannot speak to whether a lamp burned on the wreck night; that is event, and wants a keeper's record or a relief's testimony. The two gaps are unlike in kind: one is where towers stand, the other is what happened inside a lamp-room. Until both are filled, the chain cannot close.
  — hypothesis: The light Mara steered by may have been Harlow Point (Brandt's tower) — onlyKeyTo harlowPoint brandt and atTowerThatNight brandt harlowPoint are both grounded, so IF lampBurnedAt harlowPoint wreckNight is shown, litLampOf brandt harlowPoint follows by Rule 3 — but the chain still requires: towerOnBearing sswHalfWest harlowPoint (chart or survey confirmation) and lampBurnedAt harlowPoint wreckNight (keeper's record, relief testimony, or inspection note).
  ⚑ **decay** — m_post slips from the learner's board

### Turn 8
*[The harbourmaster's storm-order stands in the book: Harlow Point to shutter at the dusk gun, the channel closed to all sail. The inspector found the shutter drawn and the Board's seal on it unbroken at first light.]*
  — *releases `m_shutter`*
**Tutor:** A sealed shutter is a closed ledger, clerk: it records what Harlow Point was ordered to do and what the inspector found unbroken at dawn. Set it beside Brandt's key and post-log, and say only what that trio can bear. Does it light Harlow for the Mara, or does it make the bearing's missing chart more necessary?
  — move: analogia → m_shutter (consolidate)
**Learner:** A sealed shutter does not light a lamp — it extinguishes the hypothesis. The harbourmaster's order drawn at dusk, the Board's seal unbroken at dawn: Harlow Point was dark on the wreck night, and Rule 2 is exact that a dark tower steers no ship. The bearing chart is now more necessary, not less — for it must tell me what other tower stands on that heading with a lamp that actually burned. Brandt's key and post-log may be spotless; the sealed shutter makes them beside the point.
  — adopts `shutteredOn harlowPoint wreckNight` · hypothesis: If Harlow Point was shuttered and dark on the wreck night, the Mara steered by some other light — a second tower on the sswHalfWest bearing, or a false light not charted at all. The sealed shutter effectively closes Brandt's path under Rule 3 (lampBurnedAt harlowPoint wreckNight is negated, so Rule 2 cannot fire even if the bearing is confirmed), and the inquiry must now find whose lamp was burning on that heading.

### Turn 9
*[The room does not acquit so much as fall silent, its certainty taken from it plank by plank. The wet walls hold the last words close, and the vacant space beside the bearing seems larger than before.]*
**Tutor:** Then set the Trinity chart under the wet bearing: from the mid-channel buoy, sou'-sou'-west a half west crosses one tower and one only on this coast — the old South Stack, struck off the light-list six years since. A chart is the court's coastline made answerable; what does Rule 1 now yield, and what must still be shown before any lamp can steer the Mara?
  — move: exemplum → p_chart (release)
**Learner:** Rule 1 reaches toward South Stack — the chart names it the sole tower on sswHalfWest, and if the Mara's logged bearing stood formally on my board, steeredToward mara southStack would follow at once. But the bearing is not yet a grounded entry, and lampBurnedAt southStack wreckNight has not been shown; the light-list struck that tower six years ago, which tells me the Board expected darkness there — not that darkness held. The new question is starker than the old: who, if anyone, carried a lamp to a decommissioned tower on the night of the wreck?
  — hypothesis: The light Mara steered by may have been South Stack — the Trinity chart names it the sole tower on sswHalfWest from the mid-channel buoy, and shutteredOn harlowPoint wreckNight closes the Harlow path entirely — but the chain still requires: loggedBearingOf mara sswHalfWest formally on the board, towerOnBearing sswHalfWest southStack as a grounded exhibit, lampBurnedAt southStack wreckNight in direct testimony or inspection record, and (if Rule 3 is to close) identification of whoever held authority over that decommissioned lamp-room on the wreck night.

## Act 3 (turns 10–15) — declared by the director
*[The chart is left open on the table, but no one leans over it now. The room changes its hunger: less for coastlines and more for marks a hand might have left in darkness.]*

### Turn 10
*[The chart is left open on the table, but no one leans over it now. The room changes its hunger: less for coastlines and more for marks a hand might have left in darkness.]*
  — *declares the movement: **Act 3** ([The chart is left open on the table, but no one leans over it now. The room changes its hunger: less for coastlines and more for marks a hand might have left in darkness.])*
  — *calls the act closed*
**Tutor:** Clerk, mend the slipped line first: the mate's bearing-book came ashore dry in its oilskin, and from the mid-channel buoy the Mara held sou'-sou'-west a half west for the last hour entire, on a steady fixed light, pricked, timed, and initialed. That is a formal entry, not a rumor. Before we hunt for marks of a hand, what does that restored book fix, and no more?
  — move: exemplum → p_bearing (restore), releases `p_chart`
**Learner:** The bearing-book fixes one fact, and one only: the Mara held sou'-sou'-west a half west — logged, pricked, initialed — and that entry now stands on the board as formal record, not rumour. The chart exhibit this turn places South Stack, and South Stack alone, on that bearing from the channel; Rule 1 closes on those two facts, and I can voice it: the Mara steered toward South Stack. The book fixes nothing further — we have the heading and the tower, but not yet whether any lamp was burning there that night.
  — adopts `towerOnBearing sswHalfWest southStack` · derives `steeredToward mara southStack` · hypothesis: South Stack's lamp burned on the wreck night — if that is shown, Rule 2 fires and the chain advances; but lampBurnedAt southStack wreckNight is not yet on the board, and the question of who held authority over a decommissioned lamp-room on that night remains open.
  ⚑ **act_end** — act 2 closed (director) after 5 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 4, justified 0, drift 2; arc on_arc
  ⚑ **repair** — p_bearing restored by the tutor
  ⚑ **decay** — m_key slips from the learner's board

### Turn 11
*[The clerk's pen rests above the page and does not descend. Rain taps the high windows in uneven runs, while the open chart lies under the lamp like a thing waiting to be accused.]*
**Tutor:** Do not let the open chart become scenery, clerk. Read it back from your own board: what does it place against the wet bearing, what does Rule 1 yield from that pairing, and what single kind of proof is still dark?
  — move: erotema → p_chart (confront)
**Learner:** The board already speaks: item four is the logged bearing, item six places South Stack alone on that bearing from the channel, and Rule 1 has already yielded the derived fact — steeredToward mara southStack, voiced last turn and on the record. What the board does not hold, and what no exhibit yet supplies, is lampBurnedAt southStack wreckNight. Until that single fact is shown, Rule 2 cannot fire, and the chain goes no further.
  — hypothesis: South Stack's lamp burned on the wreck night — if shown, Rule 2 fires and steeredByLampOf mara southStack follows; but lampBurnedAt southStack wreckNight is not yet on the board.

### Turn 12
*[The room holds its breath around the missing proof. A draught moves the edge of the chart, and the clerk pins it flat again without writing.]*
**Tutor:** Good: shown, the wet book fixes the bearing; shown, the chart puts South Stack alone on it; not shown, that any South Stack lamp burned that night. Keep your pen on that third conjunct and no farther. What sort of witness or mark could make a dark-listed tower a burning one, without yet naming any hand?
  — move: anaphora → — (test)
**Learner:** Two kinds of mark could light a dark tower without naming any hand: a survivor's sworn word that a steady light was bearing on them as they held that course, or a lamp-room inspection showing a burned wick and spent oil from that night. Either grounds lampBurnedAt southStack wreckNight by direct record, not inference. No such exhibit is on the table yet — the third conjunct stays dark, and my pen stays up.
  — hypothesis: South Stack's lamp burned on the wreck night — if shown by survivor testimony or lamp-room inspection (burned wick, spent oil), Rule 2 fires and steeredByLampOf mara southStack follows; but neither exhibit is yet on the table.

### Turn 13
*[The court's officer is shown in with salt still white on his cuffs. The court's officer boarded the South Stack at low water: the lamp-room unshuttered, fresh char on the wick, oil in the cup still sweet, the glass wiped clean. That lamp burned, and burned the night of the gale.]*
  — *releases `p_residue`*
**Tutor:** Fresh char, sweet oil, clean glass: those are not rumors of a light, but the lamp-room's own handwriting. Set that mark beside the bearing and chart already held; what does Rule 2 now yield about the Mara, and what question must still remain only a question?
  — move: exemplum → p_residue (consolidate)
**Learner:** Fresh char and sweet oil are the lamp-room's own handwriting — lampBurnedAt southStack wreckNight goes on the board. Rule 2 fires at once: steeredToward mara southStack already stands derived, and paired with this new fact it yields steeredByLampOf mara southStack. Yet Rule 4 still wants litLampOf, which Rule 3 can only supply when onlyKeyTo southStack and atTowerThatNight are both in evidence — neither sits on the board. Whose hand held the key to a decommissioned tower, and whose boots stood there that night, is the question that must still remain a question.
  — adopts `lampBurnedAt southStack wreckNight` · derives `steeredByLampOf mara southStack` · hypothesis: If onlyKeyTo southStack ?x and atTowerThatNight ?x southStack can be shown, Rule 3 yields litLampOf ?x southStack and Rule 4 closes the chain to steeredByLightOf mara ?x — but neither fact is yet in evidence.

### Turn 14
*[The officer's report lies open where the lamp-smell seems almost to rise from the page. Around it the room grows quieter, as if every face has turned from the burned glass toward the locked door beyond it.]*
**Tutor:** Before we set that report to work, clerk, read it back from your own board. What does the officer's South Stack exhibit prove, in your words, and what does it still leave outside the finding?
  — move: erotema → p_residue (confront)
  — *the second voice [unconfronted reentry]: "Confront p_residue first: ask the learner to read back what they hold from that exhibit, without restaging or summarizing it for them." (draft anaphora → erotema)*
**Learner:** The officer's report grounds exactly one fact — lampBurnedAt southStack wreckNight — and that closes Rule 2, confirming steeredByLampOf mara southStack, already on the record from last turn. What it leaves wholly dark is the pair Rule 3 still demands: onlyKeyTo southStack sits on no exhibit, and atTowerThatNight names no person at that tower. Without those two conjuncts, litLampOf cannot be derived, and Rule 4 cannot close the chain to name a hand. The chain runs from the Mara's logged bearing through South Stack's burning lamp — and stops, at the lamp-room door, waiting for a key and a presence.
  — hypothesis: If onlyKeyTo southStack ?x and atTowerThatNight ?x southStack can be shown, Rule 3 yields litLampOf ?x southStack and Rule 4 closes the chain to steeredByLightOf mara ?x — but neither fact is yet in evidence.

### Turn 15
*[The clerk's pen pauses above the margin, making no mark. The room holds on the closed door and the unanswered shape of a key, while the rain worries the panes like fingers testing a latch.]*
**Tutor:** Then open the locksmith's book: when the Stack was struck off, the old lock was changed and a single key cut, signed for by Senna, ward of the Stack's last keeper, who stayed on in the shore cottage when the light went dark. A key is a signature only on access, not on the night's deed. What conjunct of Rule 3 has this book now supplied, and what conjunct must still stand apart before the lamp can have a hand?
  — move: analogia → p_key (release), releases `p_key`
**Learner:** The locksmith's book supplies the first conjunct Rule 3 has been waiting for: onlyKeyTo southStack senna now stands on the board. But a signed receipt for a key is not a pair of boots at the tower — atTowerThatNight senna southStack is the conjunct that still stands apart, and without it Rule 3 cannot fire. The lamp burned, the key was Senna's; only presence at the Stack that night will close the hand around it.
  — adopts `onlyKeyTo southStack senna` · hypothesis: If atTowerThatNight senna southStack can be shown — by witness, by cottage record, or by Senna's own account — Rule 3 yields litLampOf senna southStack and Rule 4 closes the chain to steeredByLightOf mara senna.

## Act 4 (turns 16–20) — declared by the director
*[The ledgers are closed, and the room seems suddenly too narrow for paper. Rain comes harder against the windows; every face turns toward the door, waiting for the night itself to be brought in.]*

### Turn 16
*[The ledgers are closed, and the room seems suddenly too narrow for paper. Rain comes harder against the windows; every face turns toward the door, waiting for the night itself to be brought in.]*
  — *declares the movement: **Act 4** ([The ledgers are closed, and the room seems suddenly too narrow for paper. Rain comes harder against the windows; every face turns toward the door, waiting for the night itself to be brought in.])*
  — *calls the act closed*
**Tutor:** Before the night walks in, read back the last ledger from your own board: what did it supply to Rule 3, and what did it not supply? Keep the name from becoming a verdict until the missing conjunct arrives.
  — move: erotema → p_key (confront)
**Learner:** The board gives Rule 3 two of its three conjuncts already: lampBurnedAt southStack wreckNight and onlyKeyTo southStack senna are both entered. The third — atTowerThatNight senna southStack — is nowhere on the board; without it, Rule 3 does not fire and Senna's name stays a hypothesis. Rules 1 and 2, however, are fully satisfied by the board now, and I can voice those derives before the night comes in.
  — hypothesis: If atTowerThatNight senna southStack is shown — by witness, cottage record, or Senna's own account — Rule 3 yields litLampOf senna southStack and Rule 4 closes the chain to steeredByLightOf mara senna. One conjunct only is missing.
  ⚑ **act_end** — act 3 closed (director) after 6 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 17
*[The room does not answer at once. Rainwater tracks down the window glass in crooked lines, and the clerk turns a blank page as though making space for whatever the door may admit.]*
**Tutor:** So keep the key where the ledger left it: access, not arrival. If Rule 3 is to move from a locked door to a lit hand, what must the night itself still place before the court? Answer as a conjunct, not as a name.
  — move: erotema → p_key (test)
**Learner:** The conjunct Rule 3 still wants is atTowerThatNight senna southStack — not the name, but the fact of bodily presence at the tower on the wreck night. Two of three conjuncts sit on my board already; only arrival remains unplaced. Meanwhile Rules 1 and 2 are fully satisfied, and I can voice those derives now.
  — hypothesis: If atTowerThatNight senna southStack is shown — by witness, cottage record, or Senna's own account — Rule 3 yields litLampOf senna southStack and Rule 4 closes the chain to steeredByLightOf mara senna. One conjunct only is missing.

### Turn 18
*[The latch stirs in the wind but no one enters. The lamps in the room gutter low, and the court waits in the narrow pause between a question asked and a door opened.]*
**Tutor:** Do not let the last ledger become a shadow in your margin, clerk. Read that exhibit back from your own board, in your own words: what did it place in Rule 3, and what did it leave unplaced?
  — move: erotema → p_key (confront)
  — *the second voice [unconfronted reentry]: "Confront p_key first: require the learner to read back what they hold of that exhibit before you consolidate it." (draft anaphora → erotema)*
**Learner:** The last ledger placed two of Rule 3's three conjuncts on my board: lampBurnedAt southStack wreckNight and onlyKeyTo southStack senna — access grounded, lamp confirmed burning. What it left unplaced is the conjunct atTowerThatNight senna southStack; the key is in his hand, but whether his hand was at that tower on the night itself, the ledger did not say. Rules 1 and 2, though, are fully satisfied by entries 4, 6, and 7, and I voice those derives now before the door opens.
  — hypothesis: If atTowerThatNight senna southStack is shown — by witness, cottage record, or Senna's own account — Rule 3 yields litLampOf senna southStack and Rule 4 closes the chain to steeredByLightOf mara senna. One conjunct only is missing.

### Turn 19
*[The clerk’s pen hangs above the page and does not fall. Beyond the door, rain scours the passage stones, and every lamp in the room seems to listen.]*
**Tutor:** Shown, the Stack lamp burned; shown, the locksmith gives Senna the only key; not shown, a body at the Stack that night. Keep Rule 3 open until a night-witness places presence at that tower, not access in a ledger.
  — move: anaphora → p_key (consolidate)
  — *the second voice [figure rut]: "Leave off the question-form here; make the turn without another erotema." (draft erotema → anaphora)*
**Learner:** No exhibits come to the table, but the board already yields two steps cleanly under the rules: the logged bearing and the tower on that bearing together place Mara steering toward South Stack, and the burning lamp makes it her lamp that night. I voice both derives now and set them on the record. The chain halts there — only atTowerThatNight senna southStack, a body at the tower, will let Rule 3 move and Rule 4 follow.
  — hypothesis: If atTowerThatNight senna southStack is shown — by witness, cottage record, or Senna's own account — Rule 3 yields litLampOf senna southStack and Rule 4 closes the chain to steeredByLightOf mara senna. One conjunct only is missing.

### Turn 20
*[The oyster-watch is shown in with rain still on his coat. The oyster-watch will swear to it: a skiff lay tied at the Stack steps from dusk until the gale's height — Senna's skiff, by the patched brown lug, and a small light moving up the tower stair.]*
  — *releases `p_skiff`*
**Tutor:** A skiff at the Stack steps is not a confession; it is presence made visible by a night-witness. Set the watch's patched brown lug and stair-light beside the burned Stack lamp and the locksmith's single key. What does Rule 3 now yield, and what must you still say conjunct by conjunct before the finding can pass into Rule 4?
  — move: anaphora → p_skiff (consolidate)
**Learner:** The watch's testimony is the body at the tower: Senna's skiff at the Stack steps, a light on the stair — atTowerThatNight senna southStack is now grounded. All three conjuncts of Rule 3 stand together on the board, and litLampOf senna southStack follows without remainder. Rule 4 takes the derived lamp and the derived steering and yields the finding: by Senna's light she steered. The account closes.
  — adopts `atTowerThatNight senna southStack` · derives `litLampOf senna southStack` · **asserts `steeredByLightOf mara senna`**
  ⚑ **forced** — learner facts now force S
  ⚑ **grounded_anagnorisis** — The Mara steered by Senna's light — the old South Stack lamp, relit by the keeper's ward.
  ⚑ **plot_audit** — act 4 plot audited at run end: kept 5, justified 0, drift 0; arc on_arc; throughline reckoned (7 clauses)

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
  - Act 1 (turns 1–4): 0 D/turn (ΔD 0)
  - Act 2 (turns 5–9): 0 D/turn (ΔD 0)
  - Act 3 (turns 10–15): 0.667 D/turn (ΔD 4)
  - Act 4 (turns 16–20): 0.2 D/turn (ΔD 1)
- **plateau** longest flat stretch 4 turns (aporia window 6)
- **releases** 5/8 on cue · 3 deviated
- **decay** 4 slips (seed 1 · rate 0.75 · grace 1) · repaired 2 (tutor 2, re-adoption 0) · mean repair latency 3.5 turns · unrepaired at end 2 · degraded-turn integral 30 · D reversals 1
- **theory fidelity** F 0.833 at end · min 0.75
  - m_key t3→t6 (tutor) · p_bearing t6→t10 (tutor) · m_post t7 (never repaired) · m_key t10 (never repaired)
- **events** plot×4 · throughline×1 · decay×4 · act_end×3 · plot_audit×4 · repair×2 · forced×1 · grounded_anagnorisis×1
- **staging** 4 movements declared by the director
- **acts** 4 played · closed by the director 3 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–9 (director) · Act 3 t10–15 (director) · Act 4 t16–20 (run end)
- **plot** 4 committed · withhold+friction on 4/4 · 6 clauses avg · audits 4 (incl. final act): kept 21 / justified 0 / drift 2 · hold-named exhibits staged in act 1/3
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 4: on 4 / off 0 · run-end reckoning 7 clauses: kept 6 / justified 1 / drift 0
- **release authority** 3 played: 0 on schedule · 2 held · 1 early · forced at hold limit 0 · overridden 3 · invalid claims 0
  - p_bearing +1 (t5): "Held one turn so the clerk first named the missing tower-on-bearing conjunct before the book returned."
  - p_chart +1 (t10): "p_chart pushed: page stalling (hedging up 0.50)"
  - p_key -2 (t15): "Played two turns early because the learner has held the lamp gap cleanly and is now explicitly waiting at the lamp-room door for key and presence."
- **confrontation** 4 demanded (0 against a slipped exhibit) · re-entries 2: covered 2, uncovered 0 · watcher fires 2 (became the confrontation 2) · fires without recorded due 0
  - **repair clause** restores 2 (2 repaired a real slip) · watcher fires on restore claims 0: m_key t6 · p_bearing t10
- **figures** erotema 8/20 (40%) · 4 distinct · switch rate 0.79
- **superego** intervened 3/20 watched turns · figure changed within-turn on 3/3 interventions · switch on intervention 0.67 vs elsewhere 0.81
- **inference** 3 voiced · stall integral 0 · overreach 0 · mischanneled 1 — `steeredToward mara southStack` available t10 → voiced t10 (latency 0) · `steeredByLampOf mara southStack` available t13 → voiced t13 (latency 0) · `litLampOf senna southStack` available t20 → voiced t20 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 20 | 3.05 | 4 | 39.4 |
| tutor | 20 | 2.4 | 3 | 49.5 |
| learner | 20 | 3.35 | 4 | 76.8 |
