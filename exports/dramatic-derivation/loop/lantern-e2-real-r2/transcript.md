# The Light on the Knock — lantern-e2-real-r2

> world `world_002_lantern` · verdict **grounded_anagnorisis** · 20/26 turns
> S forced at turn 20; asserted grounded at turn 20

```
D= 5 ●●··│●●···│·······│····
D= 4   ●●│  ●●·│·······│····
D= 3     │    ●│●●●····│····
D= 2     │     │   ●●··│····
D= 1     │     │     ●●│●●●·
D= 0     │     │       │   ◉
turn      │+    │1    + │   2 (+=5, digit=x10)
rel    ▲▲ │ ▲ ▲▲│   ▲ ▲ │   ▲ (▲ = evidence released)
slope 0.25 D/turn overall (D 5→0); per movement: 1 0.25 │ 2 0.20 │ 3 0.29 │ 4 0.25
```

## Act 1 (turns 1–4) — declared by the director
*[The inquiry room gathers itself under a hard morning light; wet coats steam at the rail, and the empty witness chair waits as if already accused. Outside the windows, the sea keeps striking the stones.]*

### Turn 1
*[The inquiry room gathers itself under a hard morning light; wet coats steam at the rail, and the empty witness chair waits as if already accused. Outside the windows, the sea keeps striking the stones.]*
  — *declares the movement: **Act 1** ([The inquiry room gathers itself under a hard morning light; wet coats steam at the rail, and the empty witness chair waits as if already accused. Outside the windows, the sea keeps striking the stones.])*
**Tutor:** Clerk, before a name can enter this room, what must the court first fix: the vessel's line, the lamp on that line, or the hand at the lamp? Keep the order, or the sea will sign the account for us.
  — move: erotema → — (orient)
**Learner:** The order must hold, or we hang a man on hearsay: vessel's line comes first — the logged bearing, fixed in her own record. Then the lamp on that line, meaning which tower stands there and whether it burned that night. Only then the hand at the lamp — who held the key, who was present, who therefore lit it. I have the wreck and I have Brandt's name on Harlow Point, but without the bearing I cannot yet walk the chain.
  — hypothesis: The light mara steered by was the lamp at Harlow Point, Brandt's tower — but this is the town's verdict, not the court's; I cannot ground it until the logged bearing and tower position are in evidence.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[The clerk produces the Board's standing rule and the keeper is made to stand where every eye can see his belt. Harlow Point keeps one key to its lamp-room and the keeper keeps it: Brandt's, on his own belt, by the Board's standing rule. No other hand could touch that lamp.]*
  — *releases `m_key`*
**Tutor:** Set Brandt's belt beside the rule as you would a seal beside a signature: it proves control of Harlow Point's lamp-room, not the Mara's road. Which conjunct has the court gained, and which first ground is still missing before that key can accuse anyone?
  — move: analogia → m_key (consolidate)
**Learner:** We have gained the first conjunct of Rule 3 — onlyKeyTo harlowPoint brandt, sole custody of the lamp-room. But the bearing is still the missing ground: without loggedBearingOf and towerOnBearing, I cannot write steeredToward, and without that, neither lamp nor key can accuse anyone. The key proves Brandt masters that room; it does not yet put the Mara's road through Harlow Point. I will hold it ready and wait for the bearing.
  — adopts `onlyKeyTo harlowPoint brandt` · hypothesis: The light mara steered by was the lamp at Harlow Point, Brandt's tower — but this is the town's verdict, not the court's; I cannot ground it until the logged bearing and tower position are in evidence.

### Turn 3
*[The room holds its breath around the keeper's belt and the paper on the clerk's table. Rain ticks at the panes while the unanswered course of the brig lies like a blank space in the record.]*
**Tutor:** Then lay the mate's bearing-book open: it came ashore dry in its oilskin, and from the mid-channel buoy the Mara held sou'-sou'-west a half west for the last hour entire, on a steady fixed light, pricked, timed, and initialed. Treat that bearing as you would a ledger line: what has it fixed for the court, and what has it not yet named?
  — move: analogia → p_bearing (release), releases `p_bearing`
**Learner:** The bearing is now fixed in evidence — sou'-sou'-west a half west, pricked, timed, and initialed by the mate: that is a ledger line I can trust. It gives me the first conjunct of Rule 1, but Rule 1 wants two: the bearing and which tower alone stands upon it from mid-channel. The road is drawn; the destination is not yet named in evidence. I need towerOnBearing before the key on Brandt's belt can mean anything to this account.
  — adopts `loggedBearingOf mara sswHalfWest` · hypothesis: Harlow Point stands on bearing sswHalfWest from the mid-channel buoy — but no exhibit has yet placed it there; the town's conviction is not the court's record.
  ⚑ **decay** — m_key slips from the learner's board

### Turn 4
*[The bearing-book remains open under the clerk's hand, its damp pages flattening in the room's stillness. The keeper's key glints once at his belt, no louder than the rain at the glass.]*
**Tutor:** Before we set any chart beside it, read back the bearing-book from your own board. What does that paper give the court, and where does its reach stop?
  — move: erotema → p_bearing (confront)
  — *the second voice [unconfronted reentry]: "Confront p_bearing first: ask the learner to read back what they hold of that exhibit before you restage it. Leave off analogia as well; this would be the third turn running." (draft analogia → erotema)*
**Learner:** The bearing-book gives the court one grounded fact: loggedBearingOf mara sswHalfWest — first conjunct of Rule 1, and its reach stops there. The road is drawn; Rule 1 still wants towerOnBearing before it can name a destination, and my board cannot supply that second conjunct yet. I also notice a gap has opened: onlyKeyTo harlowPoint brandt, which the belt-and-rule evidence secured in turn 2, does not appear on my board — that ground has slipped, and I must say so aloud before the next exhibit can build on it.
  — hypothesis: Harlow Point stands on bearing sswHalfWest from the mid-channel buoy — but no exhibit has yet placed it there; the town's conviction is not the court's record.
  ⚑ **decay** — p_bearing slips from the learner's board

## Act 2 (turns 5–9) — declared by the director
*[The clerk closes no book, but the room changes around the open page: accusation has lost its easy shape and become a measured silence. Beyond the windows the rain thickens, and the next witness waits unseen behind the door.]*

### Turn 5
*[The clerk closes no book, but the room changes around the open page: accusation has lost its easy shape and become a measured silence. Beyond the windows the rain thickens, and the next witness waits unseen behind the door.]*
  — *declares the movement: **Act 2** ([The clerk closes no book, but the room changes around the open page: accusation has lost its easy shape and become a measured silence. Beyond the windows the rain thickens, and the next witness waits unseen behind the door.])*
  — *calls the act closed*
**Tutor:** Put the Board's rule back on the table: Harlow Point keeps one key to its lamp-room, and Brandt the keeper keeps it on his own belt; no other hand could touch that lamp. Let that entry stand only where it belongs for now: control of Harlow Point's room, not the Mara's course.
  — move: exemplum → m_key (restore)
**Learner:** The key-entry stands where it belongs — control of the lamp-room, no further. The chain still wants three things the table has not yet given: the Mara's logged bearing, a tower standing on that bearing, and proof the lamp burned that night. Until those come in, Brandt's key is a sound fact in an incomplete chain.
  — hypothesis: Harlow Point stands on bearing sswHalfWest from the mid-channel buoy — but no exhibit has yet placed it there; the town's conviction is not the court's record.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 5, justified 0, drift 0; arc on_arc
  ⚑ **repair** — m_key restored by the tutor

### Turn 6
*[Brandt's log is brought in and set beside the bearing-book: it has him at his post the night entire, and the dawn relief found him there. Wood dry, glass polished, log ruled and signed to the hour.]*
  — *releases `m_post`*
**Tutor:** Now you have two Harlow entries, not a verdict: the key on Brandt's belt, and Brandt at his post through the gale. Shown: control of that room; shown: presence in that room; and the third thing that would make either touch the Mara?
  — move: anaphora → m_post (consolidate)
**Learner:** The third thing is proof the lamp burned — lampBurnedAt harlowPoint wreckNight. With that single entry, Rule 3 closes: key on his belt, Brandt at his post, lamp alight — he lit it. But I still need the logged bearing and Harlow Point standing on that bearing before steeredToward is grounded; two chains are waiting on the same missing link.
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: Harlow Point stands on bearing sswHalfWest from the mid-channel buoy — but no exhibit has yet placed it there; the town's conviction is not the court's record.

### Turn 7
*[The room holds its breath over the two open books, their pages weighted against the damp that creeps in at the sill. No one reaches for the verdict; the silence itself seems to ask what a presence proves when the flame is still unspoken.]*
**Tutor:** Then put the bearing-book back under your hand before any chart is laid beside it: the mate's book came ashore dry in its oilskin, and from the mid-channel buoy the Mara held sou'-sou'-west a half west for the last hour entire, on a steady fixed light, pricked, timed, and initialed. That fixes loggedBearingOf Mara sswHalfWest, and nothing more. Now keep the ledger clean: what second Rule 1 entry is still absent before any Harlow key or Harlow post can accuse?
  — move: analogia → p_bearing (restore)
**Learner:** The bearing is now grounded — sou'-sou'-west a half west, pricked and initialed. But Rule 1 wants two entries, not one: loggedBearingOf is in hand, yet towerOnBearing sswHalfWest harlowPoint is still missing from the table. Until a chart or a pilot's testimony sets Harlow Point on that bearing from the channel, the key on Brandt's belt and his presence at the post cannot reach the Mara.
  — hypothesis: Harlow Point stands on bearing sswHalfWest from the mid-channel buoy — but no exhibit has yet placed it there; the town's conviction is not the court's record.
  ⚑ **repair** — p_bearing restored by the tutor
  ⚑ **decay** — m_key slips from the learner's board
  ⚑ **decay** — m_post slips from the learner's board

### Turn 8
*[The harbourmaster's storm-order stands in the book: Harlow Point to shutter at the dusk gun, the channel closed to all sail. The inspector found the shutter drawn and the Board's seal on it unbroken at first light.]*
  — *releases `m_shutter`*
**Tutor:** Set the storm-order beside Brandt's key as you would a cancellation beside a charge: Harlow Point was ordered shuttered at dusk, and at first light the shutter stood drawn with the Board's seal unbroken. What does that do to the lamp-burning conjunct you just said would close Brandt's account?
  — move: analogia → m_shutter (consolidate)
**Learner:** The seal unbroken at first light kills the lamp-burning premise entire — a shuttered tower is a dark tower, and Rule 2 turns on the lamp, not the man. Brandt's key and his post now prove only that he obeyed the storm-order; neither touches the Mara. The bearing is logged and the channel was closed to sail — yet the Mara steered by a fixed light for a full hour. Whose light burned on that bearing while Harlow Point stood dark?
  — adopts `shutteredOn harlowPoint wreckNight` · hypothesis: If Harlow Point was shuttered and sealed dark, a different light burned on bearing sswHalfWest that wreck night — another tower, or a false light — whose keeper or author is not yet named in evidence; Brandt's account is cleared by the very order that leaves the Mara's true light unaccounted.

### Turn 9
*[The sealed shutter remains in the center of the room like a thing too plain to argue with. Rain ticks against the panes, and the chart case waits unopened on the clerk's table.]*
**Tutor:** Open the Trinity chart and lay the rule from the mid-channel buoy: sou'-sou'-west a half west crosses one tower and one only on this coast, the old South Stack, struck off the light-list six years since. The bearing-book gives the line; the chart names what stands on it. What does Rule 1 now yield, and what must still be shown before any light can answer for the Mara?
  — move: exemplum → p_chart (release), releases `p_chart`
  — *the second voice [figure rut]: "Leave off analogy here. Recast the move without the debt-and-counter-signature device before you speak." (draft analogia → exemplum)*
**Learner:** The rule lays true: bearing sswHalfWest from the channel strikes South Stack and South Stack alone — Rule 1 closes, and the Mara steered toward South Stack. But South Stack has been dark on the light-list these six years, so the court still wants lampBurnedAt southStack wreckNight before Rule 2 can move; a derelict tower on the right bearing is not yet a burning lamp. Who kept that key, and was anyone at South Stack that night?
  — adopts `towerOnBearing sswHalfWest southStack` · derives `steeredToward mara southStack` · hypothesis: South Stack was struck off the light-list six years since yet a fixed light burned on that bearing while the Mara ran to her death — someone lit that lamp without authority, but who held the key to a decommissioned tower and was present that night is wholly unshown.

## Act 3 (turns 10–16) — declared by the director
*[The chart is left open, but the room no longer looks at it; all faces turn instead toward the rain-black windows, where the coast itself seems to wait for inspection. The clerk sets out a clean sheet, and the inquiry passes from bearings and seals into the colder business of what a dark place may show when entered.]*

### Turn 10
*[The chart is left open, but the room no longer looks at it; all faces turn instead toward the rain-black windows, where the coast itself seems to wait for inspection. The clerk sets out a clean sheet, and the inquiry passes from bearings and seals into the colder business of what a dark place may show when entered.]*
  — *declares the movement: **Act 3** ([The chart is left open, but the room no longer looks at it; all faces turn instead toward the rain-black windows, where the coast itself seems to wait for inspection. The clerk sets out a clean sheet, and the inquiry passes from bearings and seals into the colder business of what a dark place may show when entered.])*
  — *calls the act closed*
**Tutor:** A dark tower is only stone until the court has seen more than its shape. Before any key or ward can matter, what kind of proof must inspection bring back from that place for Rule 2 to wake?
  — move: erotema → — (orient)
**Learner:** Rule 2 will not wake on stone alone — inspection must return with proof the lamp itself burned: oil spent in the font, a wick that has been trimmed and charred, warmth still in the lens, or tallow-smoke on the glass. Shape and position are already on my board; what is absent is the combustion itself. Until someone carries back from South Stack an exhibit that says the lamp was alight on wreck night, I have a tower on the bearing but no light in the tower. That single fact — lampBurnedAt southStack wreckNight — is the pin the whole chain hangs on.
  — hypothesis: South Stack's lamp burned on wreck night — oil spent, wick charred, lens warm — and someone with access to that decommissioned tower lit it; but no exhibit of physical inspection or key-holding has yet reached the board.
  ⚑ **act_end** — act 2 closed (director) after 5 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 11
*[The clerk's clean sheet remains blank beneath the dipping pen. Beyond the rain-black panes the room hears only weather, and every face waits for the door to open on what the coast has yielded.]*
**Tutor:** Good: the tower on the line is not yet a light in the tower. Until inspection gives the court burning, what verdict is still forbidden, no matter how tempting the key-and-hand questions become?
  — move: erotema → — (test)
**Learner:** Rule 1 now yields its step: bearing sswHalfWest is logged, South Stack stands on that bearing — the Mara steered toward South Stack, and I voice it. But the chain stops there, cold as stone. Until inspection carries back proof of combustion from that decommissioned tower — oil spent, wick charred, glass smoked — Rule 2 cannot wake, and every conclusion downstream of it is forbidden. I may not name whose light she steered by; that verdict waits on what the door opens to show.
  — hypothesis: South Stack's lamp burned on wreck night — oil spent, wick charred, lens warm — but no exhibit of physical inspection has yet reached the board; lampBurnedAt southStack wreckNight is the single missing pin.

### Turn 12
*[The door does not yet open. Rain ticks along the sill and runs in wavering lines down the glass, while the clerk's pen hovers above the clean sheet, waiting for testimony that has not entered.]*
**Tutor:** Keep the pen above the blank, clerk. Write only what the court already carries: the line has found South Stack; the flame has not entered the room. Write the tower, leave the burning unentered.
  — move: anaphora → — (consolidate)
  — *the second voice [figure rut]: "Leave off erotema for this turn; make the restraint plain without asking another question." (draft erotema → anaphora)*
**Learner:** Rule 1 has spoken and I enter it: bearing sswHalfWest is logged, South Stack stands upon it, the Mara steered toward South Stack. The chain halts there — cold stone, no flame. No exhibit has carried burning back from that decommissioned tower, and I will not write what the room has not shown. The pen stays above the blank until inspection opens that door.
  — hypothesis: South Stack's lamp burned on wreck night — oil spent, wick charred, lens warm — but no exhibit of physical inspection has yet reached the board; lampBurnedAt southStack wreckNight is the single missing pin before Rule 2 can wake.

### Turn 13
*[The court's officer is shown in at last, rain still dark on his coat, and his report is laid before the clerk: "The court's officer boarded the South Stack at low water: the lamp-room unshuttered, fresh char on the wick, oil in the cup still sweet, the glass wiped clean. That lamp burned, and burned the night of the gale."]*
  — *releases `p_residue`*
**Tutor:** Now the cold tower is no longer only stone: unshuttered room, fresh char, sweet oil, clean glass, and the officer says the South Stack lamp burned on the gale-night. Shown: the Mara steered toward South Stack; shown: South Stack's lamp burned; and the next conjunct before any hand may enter?
  — move: anaphora → p_residue (consolidate)
**Learner:** The officer's coat still drips, but his words are all I needed: char on the wick, oil sweet, glass wiped clean — South Stack burned on the gale-night. Rule 2 wakes at once: the Mara steered toward South Stack, and South Stack's lamp burned, so the Mara steered by South Stack's lamp — I enter both steps now. But the chain has one more link before the account can close: whose hand held the only key to that decommissioned lamp-room, and was it at the tower that night? Until key-holding and presence are shown, Rule 3 cannot fire, and I may not name whose light she steered by.
  — adopts `lampBurnedAt southStack wreckNight` · derives `steeredByLampOf mara southStack` · hypothesis: Someone held the only key to the decommissioned South Stack lamp-room and was present there on wreck night — but no exhibit has yet named that hand; until onlyKeyTo and atTowerThatNight are shown for southStack, Rule 3 cannot fire and the final answer cannot be given.

### Turn 14
*[The report lies open beneath the clerk's hand, its wet edge curling as the room absorbs what it has heard. No one reaches for the chart now; the silence gathers around the locked place and the absent name.]*
**Tutor:** Before we turn that report into a column in the account, read it back from your own board. What did the officer's South Stack inspection prove, and where does that proof stop before any hand can enter?
  — move: erotema → p_residue (confront)
  — *the second voice [unconfronted reentry]: "Confront p_residue before consolidating it: ask the clerk to read back what they hold of that exhibit, and do not supply its content. Also leave off anaphora now; it has become a rut." (draft anaphora → erotema)*
**Learner:** The officer's report does one thing only: it sets lampBurnedAt southStack wreckNight on the board, and that fact is already there. From the board as it stands, Rule 1 gives steeredToward mara southStack, and Rule 2 — already voiced — gives steeredByLampOf mara southStack. The chain stops cold at Rule 3: no exhibit has named who held the only key to that decommissioned lamp-room, and no witness has placed any hand at the tower on gale-night; without both, no person may enter the account.
  — hypothesis: Someone held the only key to the decommissioned South Stack lamp-room and was present there on wreck night — but no exhibit has yet named that hand; until onlyKeyTo and atTowerThatNight are shown for southStack, Rule 3 cannot fire and the final answer cannot be given.

### Turn 15
*[The clerk's pen hovers over the clean sheet, then rests without marking it. Outside, rain presses against the windows, and the room waits on the locked silence of a name not yet brought in.]*
**Tutor:** Then open the locksmith's book: when South Stack was struck off, the old lock was changed and a single key cut, signed for by Senna, ward of the Stack's last keeper, who stayed on in the shore cottage after the light went dark. Treat that signature as you would custody of a sealed till: it gives the court the key-holder, not the night. Which Rule 3 conjunct has entered, and which one still waits outside in the rain?
  — move: analogia → p_key (release), releases `p_key`
**Learner:** The locksmith's book enters the first name I have been waiting on: Senna held the only key when South Stack was struck off — onlyKeyTo is grounded. Two of Rule 3's three conjuncts are now in hand: the lamp burned, and one hand alone held the key. But the third still waits in the rain: no exhibit has yet placed Senna at the tower on the night of the gale, and without atTowerThatNight the rule cannot fire.
  — adopts `onlyKeyTo southStack senna` · hypothesis: Senna — ward of South Stack's last keeper, sole key-holder by the locksmith's record — was at the tower on wreck night and lit the lamp; but atTowerThatNight senna southStack is still unshown, and Rule 3 cannot fire until that conjunct enters.

### Turn 16
*[The locksmith's book remains open at the signature, its ink no darker for all the eyes upon it. Beyond the windows the rain keeps its own counsel, and the room holds between a key in daylight and a tower in the storm.]*
**Tutor:** Before that signature becomes a step in the chain, read the locksmith's book back from your own board. What does that exhibit give the court, and where does its reach stop before Rule 3 may close?
  — move: erotema → p_key (confront)
  — *the second voice [unconfronted reentry]: "Confront first: ask the learner to read back what they hold of p_key, without you supplying or reshaping its content." (draft anaphora → erotema)*
**Learner:** The locksmith's book gives the court one thing precisely: when South Stack was struck off, a single key was cut and Senna signed for it — onlyKeyTo southStack senna, no more and no less. It speaks to custody in daylight, not to presence in a gale. The lamp burned and the key was Senna's; those two conjuncts are in hand, but the book cannot carry Senna to the tower on wreck night, and without atTowerThatNight the rule stands mute.
  — hypothesis: Senna — ward of South Stack's last keeper, sole key-holder by the locksmith's record — was at the tower on wreck night and lit the lamp; but atTowerThatNight senna southStack is still unshown, and Rule 3 cannot fire until that conjunct enters.

## Act 4 (turns 17–20) — declared by the director
*[The open book is closed at last, not with decision but with the small sound of a door giving way to weather. The room shifts from documents to movement, from possession to presence, and the next act enters on the hard question of who crossed the storm rather than who could.]*

### Turn 17
*[The open book is closed at last, not with decision but with the small sound of a door giving way to weather. The room shifts from documents to movement, from possession to presence, and the next act enters on the hard question of who crossed the storm rather than who could.]*
  — *declares the movement: **Act 4** ([The open book is closed at last, not with decision but with the small sound of a door giving way to weather. The room shifts from documents to movement, from possession to presence, and the next act enters on the hard question of who crossed the storm rather than who could.])*
  — *calls the act closed*
**Tutor:** The book has given custody; the weather must now give presence. Shown: South Stack burned; shown: Senna held its only key; and the third conjunct the law still waits on?
  — move: anaphora → p_key (consolidate)
**Learner:** The third conjunct the law waits on is atTowerThatNight senna southStack — presence at the tower on the night itself. My board already closes Rules 1 and 2: the bearing places southStack, the lamp burned, so Mara steered by southStack's lamp. Rule 3 wants only that Senna stood there; Rule 4 will follow in a step.
  — hypothesis: Senna was at South Stack on wreck night — atTowerThatNight senna southStack — but no exhibit has yet placed her there; that single conjunct is all that separates the board from a binding answer.
  ⚑ **act_end** — act 3 closed (director) after 7 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 18
*[The room listens past its own breath, as if the gale has come indoors and taken a chair among them. The closed book lies square on the table, and every face turns from ink toward the wet threshold.]*
**Tutor:** Shown: the burned lamp. Shown: the single key. Not yet shown: the body in the storm — what sort of witness would turn custody into presence without letting custody pretend to be presence?
  — move: anaphora → — (test)
**Learner:** A body seen crossing the headland in the gale — a fisherman, a customs rider, anyone whose eyes placed Senna at the tower itself, not merely at the key. Custody says she could have gone; presence says she did go; only a witness outside herself can close that gap. My board now yields two steps under the rules: the bearing and the tower settle that Mara steered toward South Stack, and the burning lamp means she steered by its light. One conjunct still stands between me and the name: atTowerThatNight senna southStack.
  — hypothesis: Senna crossed the headland to South Stack on wreck night and lit the lamp — atTowerThatNight senna southStack — but no witness or physical evidence has yet placed her body at the tower; presence cannot be inferred from custody alone.

### Turn 19
*[Rain ticks along the sill in separate, counting drops, and the room holds itself still around the empty place where a witness would stand. No hand reaches for the papers; the question has moved beyond them.]*
**Tutor:** Custody is the key in a dry hand; presence is a wet footprint at the stair. With South Stack's lamp burned and Senna's key already entered, what single fact must the next witness put under oath before Rule 3 may speak?
  — move: analogia → — (test)
**Learner:** The single fact Rule 3 still waits on is this: that Senna stood at South Stack on wreck night itself — atTowerThatNight senna southStack. Custody gives her the key; the storm may have driven her there; but only a witness who saw her cross the headland, or her own sworn word, puts a wet footprint at the stair. My board already closes the first two steps: the bearing and the tower settle steeredToward, and the burning lamp yields steeredByLampOf — but I cannot name whose hand lit it until presence enters.
  — hypothesis: Senna crossed the headland to South Stack on wreck night and lit the lamp — atTowerThatNight senna southStack — but no witness or physical evidence has yet placed her body at the tower; presence cannot be inferred from custody alone.

### Turn 20
*[The oyster-watch is shown in with rain still dark on his coat, and the room receives his oath: "The oyster-watch will swear to it: a skiff lay tied at the Stack steps from dusk until the gale's height — Senna's skiff, by the patched brown lug, and a small light moving up the tower stair."]*
  — *releases `p_skiff`*
**Tutor:** Set the skiff at the Stack steps beside the key as you would a footprint beside a signed pass: one proves custody, the other begins to prove presence. The oyster-watch has put Senna's skiff there, by its patched brown lug, and a small light moving up the tower stair. With South Stack's burned lamp and Senna's single key already entered, what does Rule 3 now have, conjunct by conjunct?
  — move: analogia → p_skiff (consolidate)
**Learner:** The oyster-watch's oath puts the skiff at the Stack steps and a small light moving up the tower stair — that is presence, not merely custody. Rule 3 now holds all three conjuncts: lamp burned at South Stack, Senna's the only key, Senna at the tower that night. The chain closes without a gap: Rule 1 yields steeredToward, Rule 2 yields steeredByLampOf, Rule 3 yields litLampOf, and Rule 4 speaks the answer the account has waited for. By Senna's light the Mara steered — I may write that binding.
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

The conclusion rests on 5 grounded facts, chained through 4 rule applications. The evidence on the table: (1) The mate's bearing-book came ashore dry in its oilskin. From the mid-channel buoy she held sou'-sou'-west a half west the last hour entire, on a steady fixed light — the course is pricked, timed, and initialed. (2) Lay the rule on the Trinity chart from the mid-channel buoy: sou'-sou'-west a half west crosses one tower and one only on all this coast — the old South Stack, struck off the light-list six years since. (3) The pilot's deposition, taken wet and signed sober: through the rain, at the gale's height, a light burning where no light has stood these six years — on the South Stack. (4) The locksmith's book is exact. When the Stack was struck off, the old lock was changed and a single key cut, signed for by Senna, ward of the Stack's last keeper, who stayed on in the shore cottage when the light went dark. (5) The ferryman carried one passenger out before the gale closed the water, and one only: the keeper's ward, set down at the Stack landing with oil enough to be no errand of habit.

Because «mara logged bearing of ssw half west» and «ssw half west tower on bearing south stack», the bearing rule — "A ship steers by what stands on her steered bearing: if her logged bearing is known, and one tower and one only stands on that bearing from her channel, she was steering toward that tower." — yields «mara steered toward south stack». Because «mara steered toward south stack» and «south stack lamp burned at wreck night», the lamp rule — "A ship steering toward a tower whose lamp burned that night was steering by that lamp; a dark tower steers no one." — yields «mara steered by lamp of south stack». Because «south stack lamp burned at wreck night» and «south stack only key to senna» and «senna at tower that night south stack», the hand rule — "A lamp that burned was lit. If one hand alone held the key to a lamp-room, and that hand was at the tower that night, and the lamp burned, then that hand lit it — lamps do not light themselves." — yields «senna lit lamp of south stack». Because «mara steered by lamp of south stack» and «senna lit lamp of south stack», the light rule — "The light a ship steered by belongs to the hand that lit it: who lit the lamp a ship steered by, by that one's light she steered." — yields «mara steered by light of senna».

That final fact is the secret itself: The Mara steered by Senna's light — the old South Stack lamp, relit by the keeper's ward.

## Instrument panel (programmatic eval — no judge)

- **verdict** `grounded_anagnorisis` · 20/26 turns played
- **recognition** S forced at turn 20, asserted grounded at turn 20 (gap 0)
- **learning slope** 0.25 D/turn overall (D 5→0 over 20 turns)
  - Act 1 (turns 1–4): 0.25 D/turn (ΔD 1)
  - Act 2 (turns 5–9): 0.2 D/turn (ΔD 1)
  - Act 3 (turns 10–16): 0.286 D/turn (ΔD 2)
  - Act 4 (turns 17–20): 0.25 D/turn (ΔD 1)
- **plateau** longest flat stretch 4 turns (aporia window 6)
- **releases** 6/8 on cue · 2 deviated
- **decay** 4 slips (seed 1 · rate 0.75 · grace 1) · repaired 2 (tutor 2, re-adoption 0) · mean repair latency 2.5 turns · unrepaired at end 2 · degraded-turn integral 31 · D reversals 1
- **theory fidelity** F 0.833 at end · min 0.75
  - m_key t3→t5 (tutor) · p_bearing t4→t7 (tutor) · m_key t7 (never repaired) · m_post t7 (never repaired)
- **events** plot×4 · throughline×1 · decay×4 · act_end×3 · plot_audit×4 · repair×2 · forced×1 · grounded_anagnorisis×1
- **staging** 4 movements declared by the director
- **acts** 4 played · closed by the director 3 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–9 (director) · Act 3 t10–16 (director) · Act 4 t17–20 (run end)
- **plot** 4 committed · withhold+friction on 4/4 · 5.75 clauses avg · audits 4 (incl. final act): kept 23 / justified 0 / drift 0 · hold-named exhibits staged in act 0/2
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 4: on 4 / off 0 · run-end reckoning 7 clauses: kept 7 / justified 0 / drift 0
- **release authority** 3 played: 1 on schedule · 0 held · 2 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_bearing -1 (t3): "The clerk explicitly held the missing ground as the bearing, so the early release answers the board without advancing beyond it."
  - p_key -2 (t15): "Played two turns early because the clerk has cleanly held burning and is asking for the next legal conjunct."
- **confrontation** 3 demanded (1 against a slipped exhibit) · re-entries 1: covered 1, uncovered 0 · watcher fires 3 (became the confrontation 3) · fires without recorded due 0
  - **repair clause** restores 2 (2 repaired a real slip) · watcher fires on restore claims 0: m_key t5 · p_bearing t7
- **figures** analogia 7/20 (35%) · 4 distinct · switch rate 0.68
- **superego** intervened 5/20 watched turns · figure changed within-turn on 5/5 interventions · switch on intervention 1.00 vs elsewhere 0.57
- **inference** 3 voiced · stall integral 0 · overreach 0 · mischanneled 1 — `steeredToward mara southStack` available t9 → voiced t9 (latency 0) · `steeredByLampOf mara southStack` available t13 → voiced t13 (latency 0) · `litLampOf senna southStack` available t20 → voiced t20 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 20 | 3 | 4 | 41.3 |
| tutor | 20 | 2.3 | 3 | 47.3 |
| learner | 20 | 3.5 | 4 | 79.5 |
