# The Light on the Knock — lantern-e2-visible-r5

> world `world_002_lantern` · verdict **grounded_anagnorisis** · 20/26 turns
> S forced at turn 20; asserted grounded at turn 20

```
D= 5 ●●●·│·●··│······│······
D= 4    ●│● ··│●●····│······
D= 3     │  ●●│  ●●··│······
D= 2     │    │    ●●│······
D= 1     │    │      │●●●●●·
D= 0     │    │      │     ◉
turn      │+   │ 1    │+    2 (+=5, digit=x10)
rel    ▲ ▲│ ▲▲▲│    ▲ │▲    ▲ (▲ = evidence released)
slope 0.25 D/turn overall (D 5→0); per movement: 1 0.25 │ 2 0.25 │ 3 0.17 │ 4 0.33
```

## Act 1 (turns 1–4) — declared by the director
*[The inquiry room settles under a hard, practical hush: wet coats, ink, and the weight of a wreck not yet named aloud. Outside the windows, the sea-light fails into evening while every face in the room turns toward the empty chair set for testimony.]*

### Turn 1
*[The inquiry room settles under a hard, practical hush: wet coats, ink, and the weight of a wreck not yet named aloud. Outside the windows, the sea-light fails into evening while every face in the room turns toward the empty chair set for testimony.]*
  — *declares the movement: **Act 1** ([The inquiry room settles under a hard, practical hush: wet coats, ink, and the weight of a wreck not yet named aloud. Outside the windows, the sea-light fails into evening while every face in the room turns toward the empty chair set for testimony.])*
**Tutor:** Before any witness wets the Bible, clerk, set the rule in your hand. What must the court have before it may say a ship steered by any light at all?
  — move: erotema → — (orient)
**Learner:** The rules want three things in hand before 'steered by a light' is settled, sir: first, the Mara's logged bearing that night; second, a tower — and one tower only — standing on that bearing from her channel; third, that the lamp in that tower burned. Strip any one of those three, and the rule gives us nothing to stand on.
  — hypothesis: The tower on Mara's steered bearing is Harlow Point, Brandt's station — but no bearing and no lamp-evidence is yet before the court to ground it.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[The clerk produces the Board's standing rule and reads it into the room: Harlow Point keeps one key to its lamp-room and the keeper keeps it: Brandt's, on his own belt, by the Board's standing rule. No other hand could touch that lamp.]*
  — *releases `m_key`*
**Tutor:** Good; put that Board rule on the left side of the slate, not the right. What does it prove about Harlow Point, and what does it still fail to prove about the Mara's own course?
  — move: erotema → m_key (consolidate)
**Learner:** The key-rule settles one corner of Rule 3, sir — if the lamp burned and Brandt stood at his tower that night, then Brandt lit it, no other hand being possible. But the rule is silent on the Mara's bearing; it cannot tell us whether Harlow Point even lay on her course. We have the key; we still want the bearing and the burning before the chain closes.
  — adopts `onlyKeyTo harlowPoint brandt` · hypothesis: The tower on Mara's steered bearing is Harlow Point — but loggedBearingOf mara and lampBurnedAt harlowPoint wreckNight are both still absent from the board.

### Turn 3
*[The slate remains divided beneath the clerk's chalk, one side heavier with certainty than proof. Rain ticks against the panes while the empty witness chair waits, and the room feels the gap where the ship's own course should be.]*
**Tutor:** Before another paper crosses the table, clerk, read back the Board rule already laid before you. In your own words, what does that exhibit put on the slate, and what does it leave untouched?
  — move: erotema → m_key (confront)
  — *the second voice [unconfronted reentry]: "Confront before you use the key exhibit again: make the clerk read back what they actually hold of it, then restage only after that." (draft analogia → erotema)*
**Learner:** The Board rule puts one fact only on my slate, sir: that Brandt alone held the key to Harlow Point's lamp-room — no other hand could reach that lamp. That closes the key-corner of Rule 3, and nothing more. It leaves untouched the Mara's bearing, whether Harlow Point stood on it, whether the lamp burned, and whether Brandt was at his tower at all on the night she struck.
  — hypothesis: The tower on Mara's steered bearing is Harlow Point — but loggedBearingOf mara, towerOnBearing bearing harlowPoint, lampBurnedAt harlowPoint wreckNight, and atTowerThatNight brandt harlowPoint are all still absent from the board.
  ⚑ **decay** — m_key slips from the learner's board

### Turn 4
*[The clerk lowers the chalk and leaves the divided slate exposed, its blank spaces more accusing than its marks. A damp silence gathers around the witness chair while the room waits for the sea to speak through some harder record.]*
**Tutor:** Here is the mate's bearing-book, dry from its oilskin: from the mid-channel buoy the Mara held sou'-sou'-west a half west for the last hour entire, on a steady fixed light, pricked, timed, and initialed. A bearing is not a rumor, clerk; it is the ship's own line of account. What debt does that entry now lay on the next chart?
  — move: analogia → p_bearing (release), releases `p_bearing`
**Learner:** The bearing-book lays a real debt on the next chart, sir: sou'-sou'-west a half west is now on my slate, logged and initialed — the Mara's own line of account. Rule 1 closes its left hand around it at once, but the right hand still hangs open: I want the tower that stood on that bearing from mid-channel, and nothing before this court has yet named one. A course without a mark is a half-sum; I cannot carry it forward until the chart or a coastal witness sets a tower on sswHalfWest.
  — adopts `loggedBearingOf mara sswHalfWest` · hypothesis: The tower standing on sswHalfWest from the mid-channel buoy is Harlow Point — but no chart, survey, or witness has yet placed it on that bearing before this court.

## Act 2 (turns 5–8) — declared by the director
*[The bearing-book lies open beside the key, two hard things that do not yet touch. The room holds its breath around the gap between metal and ink, while beyond the windows the weather presses black against the glass.]*

### Turn 5
*[The bearing-book lies open beside the key, two hard things that do not yet touch. The room holds its breath around the gap between metal and ink, while beyond the windows the weather presses black against the glass.]*
  — *declares the movement: **Act 2** ([The bearing-book lies open beside the key, two hard things that do not yet touch. The room holds its breath around the gap between metal and ink, while beyond the windows the weather presses black against the glass.])*
  — *calls the act closed*
**Tutor:** The bearing-book is open, clerk, but I will not carry its line for you. Read back from your own board what that entry fixes, and name the exact gap it leaves before Rule 1 may bite.
  — move: erotema → p_bearing (confront)
**Learner:** The bearing-entry fixes the first conjunct of Rule 1 entire — I have loggedBearingOf mara sswHalfWest grounded on my board. What it leaves bare is the second conjunct: towerOnBearing sswHalfWest ?t — no chart, no survey, no witness has yet placed any tower on that bearing before this court. Until that fact is entered, Rule 1 cannot fire, and I cannot name what the Mara steered toward.
  — hypothesis: The tower standing on sswHalfWest from Mara's channel position is Harlow Point — but no chart, survey, or witness has yet placed it on that bearing before this court.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 6, justified 0, drift 0; arc on_arc
  ⚑ **decay** — p_bearing slips from the learner's board

### Turn 6
*[Brandt's log is brought in under the clerk's hand, and the whole room receives its ruled account: Brandt's log has him at his post the night entire, and the dawn relief found him there: wood dry, glass polished, log ruled and signed to the hour.]*
  — *releases `m_post`*
**Tutor:** Brandt's ruled log moors him at Harlow Point for the night, clerk; it does not tow the Mara onto Harlow's bearing. Put it beside the key and tell me: which rule has grown stronger, and which rule still waits on the chart?
  — move: analogia → m_post (consolidate)
**Learner:** Rule 3 has grown stronger, sir — Brandt's log plants atTowerThatNight beside keeperOf; once onlyKeyTo harlowPoint brandt and lampBurnedAt harlowPoint wreckNight are entered, that rule may fire. Rule 1 still waits on the chart — towerOnBearing sswHalfWest harlowPoint has never been placed before this court by survey or witness. But I must confess a gap: my board no longer shows loggedBearingOf mara sswHalfWest, which I spoke as grounded in the last act — has it slipped, or was I premature to enter it?
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: The tower on Mara's steered bearing is Harlow Point — but towerOnBearing sswHalfWest harlowPoint has not been placed by chart, survey, or witness, and loggedBearingOf mara sswHalfWest has vanished from my board.

### Turn 7
*[The clerk's pen hovers above the slate, making no mark. In the close air the open books seem heavier than their paper, and the room waits for the missing line to be either restored or struck away.]*
**Tutor:** Then restore the line before any new paper is spent: the mate's bearing-book came ashore dry in its oilskin, and from the mid-channel buoy the Mara held sou'-sou'-west a half west for the last hour entire, on a steady fixed light, pricked, timed, and initialed. Put only that much back on the slate, clerk. What does it fix, and what does it still leave for the chart to prove?
  — move: exemplum → p_bearing (restore), releases `p_chart`
**Learner:** The bearing is restored — loggedBearingOf mara sswHalfWest stands confirmed from the mate's pricked book. But the chart has just struck my six-turn hypothesis entire: the tower on sswHalfWest is South Stack, not Harlow Point. Rule 1 fires at last, and I name steeredToward mara southStack. What the court still wants is whether South Stack's lamp burned that night, and whose hand held its key.
  — adopts `towerOnBearing sswHalfWest southStack` · derives `steeredToward mara southStack` · hypothesis: The lamp at South Stack burned on wreckNight, and a keeper holding its sole key was present there — but neither lampBurnedAt southStack wreckNight, nor onlyKeyTo southStack ?x, nor atTowerThatNight ?x southStack is yet before the court.
  ⚑ **repair** — p_bearing restored by the tutor

### Turn 8
*[The harbourmaster's storm-order stands in the book: Harlow Point to shutter at the dusk gun, the channel closed to all sail. The inspector found the shutter drawn and the Board's seal on it unbroken at first light.]*
  — *releases `m_shutter`*
**Tutor:** Now let the storm-order do only its own work, clerk: if Harlow Point was shuttered at dusk and the seal stood unbroken at first light, what happens to the room's old comfort that Brandt's lamp guided the Mara? And what does that still not prove about South Stack?
  — move: erotema → m_shutter (consolidate)
**Learner:** The shutter-order does what the log alone could not: it extinguishes Harlow Point entirely — dark from the dusk gun, sealed at first light, that lamp burned for no one. The room's old comfort is gone; Rule 2 cannot fire for Harlow Point, and Brandt's vigil, however faithful, guided nothing. Yet the shutter is mute on South Stack — it does not tell us that tower's lamp burned, nor who held its key that night. Rules 2 and 3 still wait on South Stack's evidence before this court can close.
  — adopts `shutteredOn harlowPoint wreckNight` · hypothesis: The lamp at South Stack burned on wreckNight, and a keeper holding its sole key was present there — but neither lampBurnedAt southStack wreckNight, nor onlyKeyTo southStack ?x, nor atTowerThatNight ?x southStack is yet before the court.
  ⚑ **decay** — p_bearing slips from the learner's board

## Act 3 (turns 9–14) — declared by the director
*[The room changes its weight: accusation has gone out of it, and inquiry enters with colder hands. Papers are gathered from the table's edge, making space for things that can be touched, smelled, and sworn over.]*

### Turn 9
*[The room changes its weight: accusation has gone out of it, and inquiry enters with colder hands. Papers are gathered from the table's edge, making space for things that can be touched, smelled, and sworn over.]*
  — *declares the movement: **Act 3** ([The room changes its weight: accusation has gone out of it, and inquiry enters with colder hands. Papers are gathered from the table's edge, making space for things that can be touched, smelled, and sworn over.])*
  — *calls the act closed*
**Tutor:** Before we touch wick or glass, clerk, read the storm-order back from your own board. What does that paper do to Harlow Point, and what does it leave the court still unable to say about South Stack?
  — move: erotema → m_shutter (confront)
**Learner:** The storm-order shuttered Harlow Point on wreck night — no lamp burned there, so Rule 2 cannot fire even if Mara steered toward it; Brandt is cleared not by innocence but by darkness. For South Stack, the court still cannot say: that Mara's logged bearing was SSW-½-W, that the lamp there burned, who held the key, or whether that keeper stood the tower that night — four gaps, all open.
  — hypothesis: South Stack is the tower Mara steered toward and its lamp burned on wreck night — but loggedBearingOf mara sswHalfWest, lampBurnedAt southStack wreckNight, onlyKeyTo southStack ?x, and atTowerThatNight ?x southStack are all still absent from the board.
  ⚑ **act_end** — act 2 closed (director) after 4 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 5, justified 1, drift 0; arc on_arc

### Turn 10
*[A gust presses at the panes and makes the lamps in the room lean, then right themselves. The cleared table waits under the clerk's hand, bare enough now that the next object set upon it will seem heavier than paper.]*
**Tutor:** Not wick, not glass, not hand yet: first the chart. Read that exhibit back from your own board, clerk, in your own words. Say what it did to the bearing under Rule 1, without borrowing a word from me.
  — move: anaphora → p_chart (confront)
  — *the second voice [figure rut]: "Leave off erotema here; confront the chart by another device before asking another question." (draft erotema → anaphora)*
**Learner:** The chart placed South Stack on bearing SSW-½-W — that grounds towerOnBearing sswHalfWest southStack, which is Rule 1's second condition, the tower leg. But Rule 1 needs both legs: towerOnBearing and loggedBearingOf mara sswHalfWest together — and the logged bearing is nowhere on my board, lost or never yet produced before this court. One leg will not carry the rule; steeredToward mara southStack remains unvoiced until the Mara's own log supplies the other.
  — hypothesis: South Stack is the tower Mara steered toward and its lamp burned on wreck night — but loggedBearingOf mara sswHalfWest, lampBurnedAt southStack wreckNight, onlyKeyTo southStack ?x, and atTowerThatNight ?x southStack are all still absent from the board.

### Turn 11
*[The chart remains open on the table, its inked line drawing every eye without answering the room. Outside, the wind drops for a moment, and in the hush the absence in the record seems louder than testimony.]*
**Tutor:** Restore the ship's own account, then: the mate's bearing-book came ashore dry in its oilskin, and from the mid-channel buoy the Mara held sou'-sou'-west a half west for the last hour entire, on a steady fixed light, pricked, timed, and initialed. Lay that entry beside the chart, clerk. What does Rule 1 now yield, and what is still only hunger for the next witness?
  — move: analogia → p_bearing (restore)
**Learner:** Both legs stand grounded at last: the bearing-book gives loggedBearingOf mara sswHalfWest and the chart gives towerOnBearing sswHalfWest southStack — Rule 1 fires clean, and steeredToward mara southStack enters the record. What hunger remains: whether South Stack's lamp burned on wreck night, for without lampBurnedAt southStack wreckNight Rule 2 cannot move, and the chain stops here before it touches any keeper's hand.
  — hypothesis: South Stack's lamp burned on wreck night, and the keeper holding its sole key was present there — but lampBurnedAt southStack wreckNight, onlyKeyTo southStack ?x, and atTowerThatNight ?x southStack remain absent from the board.
  ⚑ **repair** — p_bearing restored by the tutor
  ⚑ **decay** — m_post slips from the learner's board

### Turn 12
*[The bearing-book and the chart lie side by side, and the room gives them the silence owed to things that have begun to agree. No hand reaches for the lamp-parts yet; the space between course and flame remains open on the table.]*
**Tutor:** Then keep the chain cold, clerk: toward South Stack is not yet by South Stack. What kind of proof must touch the table before Rule 2 may carry the Mara from a tower on the bearing to a lamp that guided her?
  — move: erotema → — (consolidate)
**Learner:** Rule 2 needs one thing only: lampBurnedAt southStack wreckNight — proof, direct or circumstantial, that South Stack's lamp was alight on the night the Mara struck. A keeper's log entry, a passing vessel's sworn account, or physical evidence of oil consumed that night would each serve; hearsay of 'a light on the coast' will not. steeredToward mara southStack the board now yields clean under Rule 1, and I voice it — but Rule 2 stands cold until the flame itself is put in evidence.
  — hypothesis: South Stack's lamp burned on wreck night, and a keeper holding its sole key was present there — but lampBurnedAt southStack wreckNight, onlyKeyTo southStack ?x, and atTowerThatNight ?x southStack remain absent from the board.

### Turn 13
*[The court's officer boarded the South Stack at low water: the lamp-room unshuttered, fresh char on the wick, oil in the cup still sweet, the glass wiped clean. That lamp burned, and burned the night of the gale.]*
  — *releases `p_residue`*
**Tutor:** There is your flame, clerk: char, sweet oil, clean glass, and an unshuttered room are a lamp-room's own deposition. What does that now do to Rule 2, once laid beside the bearing-book and chart? And what remains untouched before any hand may be named?
  — move: exemplum → p_residue (consolidate)
**Learner:** The lamp-room's own condition is deposition enough: char, sweet oil, clean glass, unshuttered — Rule 2 fires at once. steeredToward mara southStack already stood on my board, and lampBurnedAt southStack wreckNight now joins it; steeredByLampOf mara southStack follows clean and I voice it. But the chain halts here — Rule 3 requires onlyKeyTo southStack and atTowerThatNight before any hand can be named, and neither is yet before this court.
  — adopts `lampBurnedAt southStack wreckNight` · derives `steeredByLampOf mara southStack` · hypothesis: The keeper who held the sole key to South Stack's lamp-room was present there on wreck night — but neither onlyKeyTo southStack ?x nor atTowerThatNight ?x southStack is yet before the court.

### Turn 14
*[The lamp-parts remain on the table under a hard white cloth of daylight, and the room does not yet know where to place its eyes. Outside, the weather worries at the windows as if the gale has left an echo behind.]*
**Tutor:** Before the law climbs from lamp to hand, clerk, read back the last exhibit from your own board. What did that officer's evidence put before the court, in your words, and which rule does it feed?
  — move: erotema → p_residue (confront)
  — *the second voice [unconfronted reentry]: "Confront first: ask the clerk what they hold from that exhibit before you use it again, and do not supply the substance for them." (draft anaphora → erotema)*
**Learner:** The officer's own inspection is the lamp-room's deposition: char on the wick, oil still sweet, glass wiped clean, room unshuttered — those physical facts together put lampBurnedAt southStack wreckNight on my board and feed Rule 2 directly. Rule 2 takes it alongside steeredToward mara southStack, already grounded under Rule 1 from indices 4 and 5, and yields steeredByLampOf mara southStack — voiced last turn and firm on the record. The chain now stands at Rule 3's threshold: onlyKeyTo southStack and atTowerThatNight are both still absent, and without them no hand may be named.
  — hypothesis: The keeper who held the sole key to South Stack's lamp-room was present there on wreck night — but neither onlyKeyTo southStack ?x nor atTowerThatNight ?x southStack is yet before the court.

## Act 4 (turns 15–20) — declared by the director
*[The table is cleared to its bare grain, and the room takes on the strained quiet of men waiting for a door to open. The inquiry moves from objects to footsteps: wind at the casements, salt drying on boots, and every chair turned toward the place where a witness would stand.]*

### Turn 15
*[The table is cleared to its bare grain, and the room takes on the strained quiet of men waiting for a door to open. The inquiry moves from objects to footsteps: wind at the casements, salt drying on boots, and every chair turned toward the place where a witness would stand.]*
  — *declares the movement: **Act 4** ([The table is cleared to its bare grain, and the room takes on the strained quiet of men waiting for a door to open. The inquiry moves from objects to footsteps: wind at the casements, salt drying on boots, and every chair turned toward the place where a witness would stand.])*
  — *calls the act closed*
**Tutor:** The locksmith's book is exact, clerk: when the Stack was struck off, the old lock was changed and a single key cut, signed for by Senna, ward of the Stack's last keeper, who stayed on in the shore cottage when the light went dark. A key is not yet a footstep, and a name on a receipt is not yet a hand on a flame. What conjunct has this book supplied, and what conjunct does Rule 3 still wait for?
  — move: exemplum → p_key (release), releases `p_key`
**Learner:** The locksmith's book supplies the middle term: onlyKeyTo southStack senna. Rule 3 now has two of its three conjuncts — the lamp burned, and Senna held the only key. What it still waits for is the footstep: atTowerThatNight senna southStack. I can voice the first two links of the chain, but the third holds the door shut until a witness places Senna at the tower that night.
  — adopts `onlyKeyTo southStack senna` · hypothesis: Senna was at South Stack on wreck night — atTowerThatNight senna southStack is the sole remaining conjunct Rule 3 requires before litLampOf senna southStack can be voiced.
  ⚑ **act_end** — act 3 closed (director) after 6 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 16
*[The witness-place remains empty, but the room has altered around it: ink dries in the clerk's book, damp coats steam faintly by the wall, and the bare table seems to wait for a bootmark rather than another object. No one reaches for the lamp-parts now.]*
**Tutor:** Before we set that book beside any footstep, clerk, read the locksmith's exhibit back from your own board. In your own words only: what did that paper put before the court, and what did it leave unproved?
  — move: erotema → p_key (confront)
  — *the second voice [unconfronted reentry]: "Confront p_key first: make the clerk read back what they hold of that exhibit before you use it again." (draft anaphora → erotema)*
**Learner:** The locksmith's book put one thing before the court: onlyKeyTo southStack senna — when the Stack's light was struck off, the lock was changed and a single key cut, signed for by Senna. What it did not put before the court was any footstep: a name on a receipt proves only custody of the key, not presence at the tower. My board now yields two steps under the rules — Mara steered toward South Stack by Rule 1, and by Rule 2 she steered by its lamp — but Rule 3 holds the door shut until a witness places Senna at the Stack on wreck night.
  — hypothesis: Senna was at South Stack on wreck night — atTowerThatNight senna southStack is the sole remaining conjunct Rule 3 requires before litLampOf senna southStack can be voiced.

### Turn 17
*[The witness-place holds its emptiness under the lamps, and the room listens to the weather worry the shutters. The clerk's pen hovers above a clean line, while the bare table waits without receiving anything new.]*
**Tutor:** Keep the receipt from growing legs, clerk. If the key opens the door but does not put its holder through it, what exact fact must a witness now swear before Rule 3 may move from lamp and key to hand?
  — move: erotema → p_key (test)
**Learner:** A witness must swear exactly this: atTowerThatNight senna southStack — that Senna's feet crossed the Stack's threshold on wreck night. The key proves custody; only a footstep proves presence. Until that single conjunct is sworn, Rule 3 cannot move from lamp and key to hand, and the chain stops two links short of a name.
  — hypothesis: Senna was at South Stack on wreck night — atTowerThatNight senna southStack is the sole remaining conjunct Rule 3 requires before litLampOf senna southStack can be voiced.

### Turn 18
*[The gale presses its shoulder against the panes, and the witness-place stands lit but unfilled. Around the cleared table, the room holds itself at the edge of speech, with every face turned toward the door and no paper laid down.]*
**Tutor:** A burned lamp is shown; a single key is shown; a footstep is not shown. Hold the finding at that threshold, clerk, with the last conjunct blank until a witness fills it under oath.
  — move: anaphora → — (consolidate)
  — *the second voice [figure rut]: "Leave off erotema here; do not ask another question in the same device. Turn the missing step by another means or hold the line without making the clerk answer yet." (draft erotema → anaphora)*
**Learner:** The tutor's instruction is clear, and the board holds no new ground. Rules 1 and 2 are already earned — I may voice them now as derived: Mara steered toward South Stack, and by its burning lamp. But Rule 3 wants a footstep, and the room has given none; the chain holds at two links until a witness swears the third conjunct under oath.
  — hypothesis: Senna was at South Stack on wreck night — atTowerThatNight senna southStack is the sole remaining conjunct Rule 3 requires before litLampOf senna southStack can be voiced.

### Turn 19
*[The room does not advance; it tightens. A wet silence gathers at the threshold, and the clerk leaves the last line open beneath the waiting lamps.]*
**Tutor:** Then keep the ink from outrunning the witness, clerk. Shown, shown, and the third? Until that footstep is sworn, what finding must the court refuse to write?
  — move: anaphora → — (test)
**Learner:** The court must refuse to write litLampOf senna southStack — and every line that follows it. Two links are forged: Mara steered toward South Stack, and by its burning lamp. The third conjunct — a footstep sworn under oath — is absent, and without it Rule 3 cannot move, Rule 4 cannot speak, and the account cannot close.
  — hypothesis: Senna was at South Stack on wreck night — atTowerThatNight senna southStack is the sole remaining conjunct Rule 3 requires before litLampOf senna southStack can be voiced.

### Turn 20
*[The oyster-watch is shown in under dripping oilskins, and the room receives his oath: "The oyster-watch will swear to it: a skiff lay tied at the Stack steps from dusk until the gale's height — Senna's skiff, by the patched brown lug, and a small light moving up the tower stair."]*
  — *releases `p_skiff`*
**Tutor:** A skiff at the Stack steps is a wet footprint, clerk, not a rumor in the wind. Set that footprint beside the burned lamp and the single key: what does Rule 3 now yield? And once that finding stands, whose sentence does Rule 4 leave for the court to speak?
  — move: analogia → p_skiff (stage_recognition)
**Learner:** The oyster-watch has filled the blank — a footstep sworn under oath at last. Rule 3 now closes: lamp burned, sole key in Senna's hand, Senna at the Stack that night — litLampOf senna southStack stands. Rule 4 follows at once, and the account may be written. By Senna's light the Mara struck the Knock.
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
  - Act 2 (turns 5–8): 0.25 D/turn (ΔD 1)
  - Act 3 (turns 9–14): 0.167 D/turn (ΔD 1)
  - Act 4 (turns 15–20): 0.333 D/turn (ΔD 2)
- **plateau** longest flat stretch 4 turns (aporia window 6)
- **releases** 6/8 on cue · 2 deviated
- **decay** 4 slips (seed 1 · rate 0.75 · grace 1) · repaired 2 (tutor 2, re-adoption 0) · mean repair latency 2.5 turns · unrepaired at end 2 · degraded-turn integral 31 · D reversals 2
- **theory fidelity** F 0.833 at end · min 0.714
  - m_key t3 (never repaired) · p_bearing t5→t7 (tutor) · p_bearing t8→t11 (tutor) · m_post t11 (never repaired)
- **events** plot×4 · throughline×1 · decay×4 · act_end×3 · plot_audit×4 · repair×2 · forced×1 · grounded_anagnorisis×1
- **staging** 4 movements declared by the director
- **acts** 4 played · closed by the director 3 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–8 (director) · Act 3 t9–14 (director) · Act 4 t15–20 (run end)
- **plot** 4 committed · withhold+friction on 4/4 · 6 clauses avg · audits 4 (incl. final act): kept 23 / justified 1 / drift 0 · hold-named exhibits staged in act 1/3
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 4: on 4 / off 0 · run-end reckoning 7 clauses: kept 5 / justified 1 / drift 1
- **release authority** 3 played: 1 on schedule · 0 held · 2 early · forced at hold limit 0 · overridden 1 · invalid claims 0
  - p_chart -2 (t7): "p_chart pushed: page stalling (hedging up 1.00; lines shortening -6.5)"
  - p_key -2 (t15): "Played two turns early because the learner has cleanly named onlyKeyTo southStack as the next missing conjunct and has taken up the lamp-burning exhibit."
- **confrontation** 6 demanded (2 against a slipped exhibit) · re-entries 1: covered 1, uncovered 0 · watcher fires 3 (became the confrontation 3) · fires without recorded due 0
  - **repair clause** restores 2 (2 repaired a real slip) · watcher fires on restore claims 0: p_bearing t7 · p_bearing t11
- **figures** erotema 10/20 (50%) · 4 distinct · switch rate 0.74
- **superego** intervened 5/20 watched turns · figure changed within-turn on 5/5 interventions · switch on intervention 0.80 vs elsewhere 0.71
- **inference** 3 voiced · stall integral 0 · overreach 0 · mischanneled 1 — `steeredToward mara southStack` available t7 → voiced t7 (latency 0) · `steeredByLampOf mara southStack` available t13 → voiced t13 (latency 0) · `litLampOf senna southStack` available t20 → voiced t20 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 20 | 2.9 | 3 | 40.3 |
| tutor | 20 | 2.4 | 3 | 44.2 |
| learner | 20 | 3.1 | 4 | 72.5 |
