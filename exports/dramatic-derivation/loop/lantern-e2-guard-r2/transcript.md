# The Light on the Knock — lantern-e2-guard-r2

> world `world_002_lantern` · verdict **grounded_anagnorisis** · 20/26 turns
> S forced at turn 20; asserted grounded at turn 20

```
D= 5 ●●●·│·●●●·│·······│····
D= 4    ●│●   ●│·······│····
D= 3     │     │●●●····│····
D= 2     │     │   ●●··│····
D= 1     │     │     ●●│●●●·
D= 0     │     │       │   ◉
turn      │+    │1    + │   2 (+=5, digit=x10)
rel    ▲ ▲│ ▲ ▲▲│   ▲ ▲ │   ▲ (▲ = evidence released)
slope 0.25 D/turn overall (D 5→0); per movement: 1 0.25 │ 2 0.00 │ 3 0.43 │ 4 0.25
```

## Act 1 (turns 1–4) — declared by the director
*[The hearing room settles into its first hush: wet coats steaming, lamps trimmed low, every face turned toward the empty place where the wreck will be made into a cause. Outside, the weather presses at the glass as if it too has come to testify.]*

### Turn 1
*[The hearing room settles into its first hush: wet coats steaming, lamps trimmed low, every face turned toward the empty place where the wreck will be made into a cause. Outside, the weather presses at the glass as if it too has come to testify.]*
  — *declares the movement: **Act 1** ([The hearing room settles into its first hush: wet coats steaming, lamps trimmed low, every face turned toward the empty place where the wreck will be made into a cause. Outside, the weather presses at the glass as if it too has come to testify.])*
**Tutor:** Before the court writes cause, clerk, tell me what kind of thing can lawfully begin the account: rumor of a light, or an entry that fixes where the Mara was actually made to steer? Keep your pen behind the proof until the proof has a line to stand on.
  — move: erotema → — (orient)
**Learner:** The tutor is right to check my pen. 'Steered for a light' sits on my board, but the rules want a logged bearing and a tower fixed on that bearing — without those, I cannot move Rule 1 at all. Item 3 is the town's verdict dressed as a fact; it names no bearing and no tower. Until a ship's log or a pilotage entry sets a bearing in evidence, my board cannot carry this to a tower.
  — hypothesis: The light the Mara steered by may have been the lamp at Harlow Point (Brandt's tower), but no logged bearing yet grounds this — it is conjecture only.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[A Board clerk is shown in with the standing rule, the wet ribbon still clinging to its fold: Harlow Point keeps one key to its lamp-room and the keeper keeps it: Brandt's, on his own belt, by the Board's standing rule. No other hand could touch that lamp.]*
  — *releases `m_key`*
**Tutor:** Set that Board rule in the margin, not at the foot of the account. If Brandt alone could touch Harlow Point's lamp, what does that prove before the Mara's bearing has named Harlow as the light she steered by?
  — move: erotema → m_key (consolidate)
**Learner:** The Board rule belongs on my board — Brandt alone could touch that lamp, and Rule 3 will need exactly that when the time comes. But the tutor's point cuts clean: sole possession of the key proves only that Brandt could have lit Harlow Point, not that Harlow Point ever stood on the Mara's bearing. I should also strike item 3 from my own board — 'steered for a light' is the town's verdict, not a logged bearing, and I was wrong to carry it as a grounded fact.
  — adopts `onlyKeyTo harlowPoint brandt` · retracts `steeredForLight mara wreckNight` · hypothesis: The light the Mara steered by may have been the lamp at Harlow Point — the key rests with Brandt alone — but no logged bearing yet names Harlow as the tower on her steered course, so the chain under Rules 1 through 4 cannot yet be moved.

### Turn 3
*[The clerk's pen pauses above the page, its nib dark with ink but touching nothing. Around the long table, certainty has the look of a verdict already written, and the empty space where a bearing ought to be seems larger than any accusation in the room.]*
**Tutor:** Good. A key in the margin is not a judgment; it is a sealed drawer until the ship's own line tells us which lamp-room can matter. Keep the first blank open for the bearing, and let every accusation wait behind it.
  — move: analogia → m_key (consolidate)
  — *the second voice [figure rut]: "Leave off erotema here; make the next move without another guiding question." (draft erotema → analogia)*
**Learner:** The new exhibit names a light but not its tower, and sets no bearing — it is the town's verdict restated, not a logged entry. My pen stays lifted: Rule 1 opens only with a bearing and a tower fixed upon it, and this gives me neither. I will not carry 'steeredForLight' as a grounded fact until the ship's log puts a line under it.
  — hypothesis: The light the Mara steered by may have been the lamp at Harlow Point — the key rests with Brandt alone — but no logged bearing yet names Harlow as the tower on her steered course, so the chain under Rules 1 through 4 cannot yet be moved.
  ⚑ **decay** — m_key slips from the learner's board

### Turn 4
*[The room holds itself in suspension, the clerk's lifted pen casting a thin shadow over the blank line. Rain ticks against the panes, and the lamps in the hearing room burn steadily while no hand yet dares make them answer for the sea.]*
**Tutor:** Now the mate's bearing-book is laid open, dry from its oilskin: from the mid-channel buoy the Mara held sou'-sou'-west a half west the last hour entire, on a steady fixed light, the course pricked, timed, and initialed. Treat that bearing like the first figure in a ledger: what does it fix, and what does it still refuse to name?
  — move: analogia → p_bearing (release), releases `p_bearing`
**Learner:** The mate's book is the ship's own record — pricked, timed, and initialed — so I adopt the bearing: sou'-sou'-west a half west, steady on a fixed light, and with it I can now also ground that she steered for a light that night. Rule 1 stands half-open: I have the bearing on the board, but no exhibit yet names which tower stands upon sswHalfWest from the channel. A gap has opened where I once had ground: the sole-key fact for Harlow Point was spoken into this room in the second turn but has since gone missing from my board — I flag it aloud and ask it be restored before Rule 3 can be reached. The bearing fixes the Mara's last course; what it still refuses to name is the tower at its far end.
  — adopts `steeredForLight mara wreckNight`, `loggedBearingOf mara sswHalfWest` · hypothesis: The light the Mara steered by may have been Harlow Point's lamp — Brandt's tower is the standing candidate — but Rule 1 cannot fire until a tower is placed on bearing sswHalfWest from the channel, and Rule 3 cannot be reached until the sole-key fact for Harlow Point is restored to the board.

## Act 2 (turns 5–9) — declared by the director
*[The first hush breaks not into speech but into rearrangement: chairs scrape back, wet coats settle heavier, and the room seems to discover that accusation has weight only while the line beneath it holds. For the next sitting, the air turns colder and more procedural, all wax, signatures, and shut doors, with the old certainty forced to stand under a narrower lamp.]*

### Turn 5
*[The first hush breaks not into speech but into rearrangement: chairs scrape back, wet coats settle heavier, and the room seems to discover that accusation has weight only while the line beneath it holds. For the next sitting, the air turns colder and more procedural, all wax, signatures, and shut doors, with the old certainty forced to stand under a narrower lamp.]*
  — *declares the movement: **Act 2** ([The first hush breaks not into speech but into rearrangement: chairs scrape back, wet coats settle heavier, and the room seems to discover that accusation has weight only while the line beneath it holds. For the next sitting, the air turns colder and more procedural, all wax, signatures, and shut doors, with the old certainty forced to stand under a narrower lamp.])*
  — *calls the act closed*
**Tutor:** The Board rule is restored before any new paper: Harlow Point keeps one key to its lamp-room, the keeper keeps it, Brandt had it on his own belt by standing rule, and no other hand could touch that lamp. Put it back in the margin only, clerk. While the bearing still has no tower under it, what can that rule prove?
  — move: erotema → m_key (restore)
  — *the second voice [figure rut]: "Leave off analogia here; make the repair plainly, without another comparison carrying the move." (draft analogia → erotema)*
**Learner:** The sole-key fact sits on the board again — onlyKeyTo harlowPoint brandt, index three, already there. But the tutor names the gap plainly: Rule Three needs a lamp that burned and a hand at the tower that night, and Rule One needs a tower on bearing sswHalfWest before any of it moves. The key alone proves only custody; it proves nothing of the night until a tower stands on that bearing and the lamp's burning is shown. I wait for the tower.
  — hypothesis: The light the Mara steered by may have been Harlow Point's lamp — Brandt holds the only key — but Rule 1 cannot fire until a tower is placed on bearing sswHalfWest from the channel, and Rule 3 cannot be reached until lamp-burning and Brandt's presence at the tower that night are both established.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 4, justified 0, drift 1; arc off_arc
  ⚑ **throughline** — throughline revised (audit_bound)
  ⚑ **repair** — m_key restored by the tutor
  ⚑ **decay** — p_bearing slips from the learner's board

### Turn 6
*[Brandt's log is brought in under the clerk's hand: Brandt's log has him at his post the night entire, and the dawn relief found him there: wood dry, glass polished, log ruled and signed to the hour. The room receives it in a colder silence, the old charge forced to make space for ink, polish, and a signed hour.]*
  — *releases `m_post`*
**Tutor:** Brandt's signed hours are like a watch-bill: they place the man at his station, not the ship upon his light. Set them beside the key, clerk, but keep both under the same lock. What released paper yet puts Harlow Point under sou'-sou'-west a half west?
  — move: analogia → m_post (consolidate)
**Learner:** Brandt's log is good paper — it places the man at his post the night entire, and I enter it: atTowerThatNight brandt harlowPoint now sits beside the key. Two of Rule Three's three conditions are met: sole custody, presence at the tower. But the third — lampBurnedAt harlowPoint wreckNight — has not been laid before the court, and Rule One's first link, the tower on the Mara's bearing, remains unplaced. I keep the gap open and wait for either paper.
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: The light the Mara steered by may have been Harlow Point's lamp — Brandt held the only key and was at the tower that night — but Rule 1 cannot fire without a tower placed on bearing sswHalfWest, and Rule 3 cannot close without lampBurnedAt harlowPoint wreckNight. Both are still outstanding.

### Turn 7
*[The clerk does not reach for a new paper; he only squares the old ones until their edges make a hard white line on the table. Outside, rain ticks against the panes with the patience of a clock, and the room waits on a name no one yet has leave to speak.]*
**Tutor:** Before we set key beside watch again, read back the watch-paper itself, clerk. In your own words, what does that exhibit place on your board, and what does it leave untouched?
  — move: erotema → m_post (confront)
  — *the second voice [unconfronted reentry]: "Confront m_post first: ask the learner to read back what they hold of that exhibit, without you restating its content." (draft analogia → erotema)*
**Learner:** The watch-paper — Brandt's log, signed to the hour, confirmed by the dawn relief — places one fact and one only: Brandt was at Harlow Point the night entire. It does not say the lamp burned; a man may stand a dry watch in a cold room. It does not place Harlow Point on any bearing the Mara steered. Two conditions of Rule Three are met — sole custody, presence — but the third, lampBurnedAt, is still dark; and Rule One, which must fire before any other, still wants a tower under the Mara's heading.
  — hypothesis: The light the Mara steered by may have been Harlow Point's lamp — Brandt held the only key and was at the tower that night — but Rule 1 cannot fire without a tower placed on the Mara's bearing, and Rule 3 cannot close without lampBurnedAt harlowPoint wreckNight. Both are still outstanding.
  ⚑ **decay** — m_key slips from the learner's board

### Turn 8
*[The harbourmaster's storm-order stands in the book: Harlow Point to shutter at the dusk gun, the channel closed to all sail. The inspector found the shutter drawn and the Board's seal on it unbroken at first light.]*
  — *releases `m_shutter`*
**Tutor:** Put the storm-order beside Brandt's key and watch, clerk: shutter drawn at dusk, Board seal unbroken at first light. If Harlow's lamp-room was shut under seal, what happens to the old charge before any chart has put Harlow under the Mara's sou'-sou'-west a half west?
  — move: erotema → m_shutter (consolidate)
**Learner:** A sealed lamp is a dark tower, and Rule Two is unambiguous: a dark tower steers no one. The shutter drawn at the dusk gun and the Board's seal unbroken at first light mean lampBurnedAt harlowPoint wreckNight cannot be grounded — and without it, the chain from Rule Two through Rule Four is cut for Harlow Point entire. She steered for a light, my board still holds that much — but that light was not Brandt's.
  — adopts `shutteredOn harlowPoint wreckNight` · hypothesis: The Mara steered by some other light — not Harlow Point, which was sealed dark under the storm-order — but no second tower or keeper has yet been named before the court.

### Turn 9
*[The old accusation remains on the table, but the ink around it seems to have dried into a narrower shape. No one removes the keeper's key; no one looks at it with the same confidence, and the room holds its breath for the next paper.]*
**Tutor:** Lay the rule on the Trinity chart from the mid-channel buoy: sou'-sou'-west a half west crosses one tower and one only on this coast, the old South Stack, struck off the light-list six years since. Treat the chart as the ledger's matching column, clerk: with the bearing already entered, what does Rule One now yield, and where must Brandt's Harlow papers stand?
  — move: analogia → p_chart (release), releases `p_chart`
**Learner:** South Stack under sswHalfWest is what Rule One wants — but 'loggedBearingOf mara sswHalfWest' has slipped from my board, and without it I cannot formally fire the rule; I flag the gap. If that entry is restored, Rule One yields 'steeredToward mara southStack', and Harlow Point drops clear on both counts: wrong bearing, sealed lamp. Yet South Stack is dead by the light-list six years running, so Rule Two still wants 'lampBurnedAt southStack wreckNight' before any chain closes. Some hand burned an unauthorised flame at a dark tower — that hand, its key, and its watch that night are what the court has not yet heard.
  — adopts `towerOnBearing sswHalfWest southStack` · hypothesis: An unauthorised lamp was burned at South Stack on the wreck night — a dead tower, no keeper of record — luring the Mara onto the Knock; but no key-holder, watcher, or flame-witness for South Stack has yet appeared before the court.

## Act 3 (turns 10–16) — declared by the director
*[The chart is folded away without being dismissed, and the room changes its appetite: it no longer wants a culprit named by habit, but a trace that will survive touch, smell, and daylight. The next sitting opens with rougher business, less ink than residue, as if the court must leave polished desks for boards, soot, and the cold patience of objects.]*

### Turn 10
*[The chart is folded away without being dismissed, and the room changes its appetite: it no longer wants a culprit named by habit, but a trace that will survive touch, smell, and daylight. The next sitting opens with rougher business, less ink than residue, as if the court must leave polished desks for boards, soot, and the cold patience of objects.]*
  — *declares the movement: **Act 3** ([The chart is folded away without being dismissed, and the room changes its appetite: it no longer wants a culprit named by habit, but a trace that will survive touch, smell, and daylight. The next sitting opens with rougher business, less ink than residue, as if the court must leave polished desks for boards, soot, and the cold patience of objects.])*
  — *calls the act closed*
**Tutor:** The mate's bearing-book is restored before any rougher business: from the mid-channel buoy the Mara held sou'-sou'-west a half west the last hour entire, on a steady fixed light, the course pricked, timed, and initialed. Put that line back under the chart already read, clerk. With bearing and chart together, what does Rule One yield, and what question must still wait for soot rather than ink?
  — move: exemplum → p_bearing (restore)
**Learner:** Rule One fires cleanly now, sir: bearing sswHalfWest meets South Stack on the chart, so the Mara steered toward South Stack — I can voice that and enter it. But the chain stalls at Rule Two: I must have lampBurnedAt southStack wreckNight before she steers by a lamp, and no witness nor document has yet shown a flame there. The soot and cold wick are what the court must read next — ink cannot supply them. Until the physical evidence speaks, South Stack is the tower she pointed at, not yet the light she followed.
  — derives `steeredToward mara southStack` · hypothesis: A lamp burned at South Stack on the wreck night — unauthorised, no keeper of record — and the physical residue (soot, wick, oil trace) will confirm or deny it; only then can Rule 2 fire and the chain advance.
  ⚑ **act_end** — act 2 closed (director) after 5 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 3, justified 0, drift 2; arc on_arc
  ⚑ **repair** — p_bearing restored by the tutor
  ⚑ **decay** — m_post slips from the learner's board

### Turn 11
*[The room sits with the bearing entered and no flame yet admitted, its silence harder than argument. Outside the windows the weather presses flat against the glass, and inside, every face seems to wait for the first object that can answer without choosing sides.]*
**Tutor:** Before we ask what proof can kindle the next rule, read back the chart itself, clerk. In your own words, what did that paper put on your board, and what did it leave still unproved?
  — move: erotema → p_chart (confront)
  — *the second voice [unconfronted reentry]: "Confront first: ask the learner to read back what they still hold of the chart before you use it again. Do not supply the chart’s content for them." (figure held)*
**Learner:** The chart gave me exactly one grounded fact, sir: South Stack stands on bearing sswHalfWest from the mid-channel, and that single placement let Rule One fire — steeredToward mara southStack is already on the record. What the chart is silent on entirely is flame: it shows the tower's position in space, nothing of its state on the wreck night. So ink and paper have done all they can do — they closed Rule One and arrested Rule Two at its threshold. Only the physical residue at South Stack can supply lampBurnedAt, and until it does, the chain cannot move another link.
  — hypothesis: A lamp burned at South Stack on the wreck night — unauthorised, no keeper of record — and the physical residue (soot, wick, oil trace) will confirm or deny it; only then can Rule 2 fire and the chain advance.

### Turn 12
*[The exhibits already read remain where they are, their edges lifting faintly in the damp air. No clerk moves to add a line, and the room seems to narrow around the empty place where an object, not an argument, must arrive.]*
**Tutor:** Then keep the next blank narrow, clerk. For Rule Two, what kind of proof would turn South Stack from a tower she pointed at into a lamp she steered by? Name the requirement, not the hand behind it.
  — move: erotema → — (test)
**Learner:** Rule Two requires one fact and one fact only, sir: lampBurnedAt southStack wreckNight — that the lamp there burned on the night of the wreck. The tower's position on the bearing is already settled; what is still missing is physical evidence of combustion — soot, spent wick, drawn oil — anything that proves a flame was present that night, not merely that a lamp-room existed. No witness's word, no chart-line, no keeper's log can substitute; only the residue of burning answers that question. Until that single fact enters the record, steeredToward remains a dead-end and Rule Two cannot fire.
  — hypothesis: A lamp burned at South Stack on the wreck night — unauthorised, no keeper of record — and the physical residue (soot, wick, oil trace) will confirm or deny it; only then can Rule 2 fire and the chain advance.

### Turn 13
*[The court's officer boarded the South Stack at low water: the lamp-room unshuttered, fresh char on the wick, oil in the cup still sweet, the glass wiped clean. That lamp burned, and burned the night of the gale.]*
  — *releases `p_residue`*
**Tutor:** There is your object-proof, clerk: unshuttered lamp-room, fresh char on the wick, sweet oil in the cup, glass wiped clean. Treat it like a wet thumbprint on a ledger page: what does it now prove for South Stack under Rule Two, and what account must still remain unopened?
  — move: analogia → p_residue (consolidate)
**Learner:** The char on the wick and the sweet oil in the cup are the object-proof Rule Two demanded, sir — lampBurnedAt southStack wreckNight enters the board, and with steeredToward already settled, Rule Two fires cleanly: the Mara steered by the lamp of South Stack. But I must keep the final account still open: Rule Three demands a key-holder for South Stack and a body present there that night, and neither has yet entered the record before this court. Two links close in one stroke — and the third link is still cold iron.
  — adopts `lampBurnedAt southStack wreckNight` · derives `steeredByLampOf mara southStack` · hypothesis: The lamp at South Stack burned and Rule Two has now closed, but no key-holder (onlyKeyTo southStack ?x) and no night-presence (atTowerThatNight ?x southStack) have yet entered the record — until those two facts appear, Rule Three cannot fire, litLampOf remains ungrounded, and Rule Four cannot yield the final answer.

### Turn 14
*[The lamp-room inventory is left open on the table, its blank columns more accusing than the filled ones. Outside, the wind worries at the panes, and the room waits for iron to answer what flame has already proved.]*
**Tutor:** Before we let that object-proof carry Rule Two, clerk, read back the South Stack residue in your own words. What did the officer's exhibit prove, and what did it leave untouched?
  — move: erotema → p_residue (confront)
  — *the second voice [unconfronted reentry]: "Confront p_residue first: ask the learner to read back what they hold of that exhibit, without restaging it yourself." (draft anaphora → erotema)*
**Learner:** The officer's exhibit proved one thing and one thing only: that a lamp had recently burned inside the South Stack lamp-room — fresh char on the wick, sweet oil in the cup, the room unshuttered and the glass clean are residue of combustion, not of intention. That proof is enough for Rule Two and nothing more: steeredByLampOf mara southStack closes on the strength of it. What it leaves untouched is the whole of Rule Three: who held the key to that room, who was present at the tower that night, and by whose hand the flame was kindled. The lamp burned; the lighter is still unknown.
  — hypothesis: The lamp at South Stack burned and Rule Two has now closed, but no key-holder (onlyKeyTo southStack ?x) and no night-presence (atTowerThatNight ?x southStack) have yet entered the record — until those two facts appear, Rule Three cannot fire, litLampOf remains ungrounded, and Rule Four cannot yield the final answer.

### Turn 15
*[The inventory remains open, but no hand moves to turn the page. In the hush after flame has done its work, the court seems to listen instead for metal: not yet a confession, not yet a name, only the pressure of a locked room waiting on its key.]*
**Tutor:** The locksmith's book is exact: when the Stack was struck off, the old lock was changed and a single key cut, signed for by Senna, the last keeper's ward, who stayed on in the shore cottage when the light went dark. Treat the key like a seal on a warehouse door: what conjunct of Rule Three has it now supplied, and what must still be shown before a hand can be put to the flame?
  — move: analogia → p_key (release), releases `p_key`
**Learner:** The locksmith's entry supplies the second conjunct, sir — onlyKeyTo southStack senna enters the board, and Rule Three now holds two of its three requirements: the lamp burned, and Senna alone held the key. But the third conjunct remains cold iron: atTowerThatNight senna southStack has not yet been laid before the court, and without it Rule Three will not fire. Senna is the name the record points toward — but a name is not a presence, and the board will not carry a guess.
  — adopts `onlyKeyTo southStack senna` · hypothesis: Senna held the only key to South Stack and the lamp burned there on the wreck night — if Senna was present at the tower that night, Rule Three fires and litLampOf senna southStack is established; but atTowerThatNight senna southStack has not yet entered the record before this court.

### Turn 16
*[The locksmith's book is closed with a sound too small for the room it makes. No witness rises yet; the benches hold their breath around the missing shape of a body in the weather.]*
**Tutor:** Before that key does work, clerk, read back the locksmith's exhibit from your own board. What exactly did it prove, and what did it leave for the night itself to prove?
  — move: erotema → p_key (confront)
  — *the second voice [unconfronted reentry]: "Confront first: have the learner read back what they hold of the key exhibit before using it again. Do not restate the exhibit for them." (draft analogia → erotema)*
**Learner:** The locksmith's book proved one fact of custody, not of presence: when the light was struck off, the old lock was changed, one key cut, and that key signed for by Senna — onlyKeyTo southStack senna enters the board on those words alone. What it leaves entirely for the night to prove is whether Senna was at the tower when the lamp burned — the record of metal says nothing of boots on a gale-soaked path. Rule Three holds two of its three conjuncts now; the third, atTowerThatNight senna southStack, is still cold, and until a witness or an exhibit lays that presence before the court, litLampOf will not fire and Rule Four cannot yield the name.
  — hypothesis: Senna held the only key to South Stack and the lamp burned there on the wreck night — if Senna was present at the tower that night, Rule Three fires and litLampOf senna southStack is established; but atTowerThatNight senna southStack has not yet entered the record before this court.

## Act 4 (turns 17–20) — declared by the director
*[The exhibits are covered one by one, not dismissed but made mute, and the room turns from objects toward weather. Beyond the windows the gale seems to find a stair and climb it, bringing with it the sense that the next voice must come from outside polished walls.]*

### Turn 17
*[The exhibits are covered one by one, not dismissed but made mute, and the room turns from objects toward weather. Beyond the windows the gale seems to find a stair and climb it, bringing with it the sense that the next voice must come from outside polished walls.]*
  — *declares the movement: **Act 4** ([The exhibits are covered one by one, not dismissed but made mute, and the room turns from objects toward weather. Beyond the windows the gale seems to find a stair and climb it, bringing with it the sense that the next voice must come from outside polished walls.])*
  — *calls the act closed*
**Tutor:** Let the covered papers stay covered, clerk; a court does not keep rubbing wax once the seal has spoken. For the next conjunct, what must the weather itself prove before the law may put any hand to the South Stack flame?
  — move: erotema → — (consolidate)
**Learner:** The missing conjunct is presence, sir — atTowerThatNight senna southStack. Weather may prove it by showing no hand could have left the tower once the gale rose, or by a witness who saw Senna there when the lamp showed; until that single fact is grounded, Rule Three cannot fire, and litLampOf remains unvoiced.
  — hypothesis: atTowerThatNight senna southStack has not yet entered the record — Rule Three cannot fire until weather or witness places Senna bodily at South Stack on the wreck night; without it the chain stalls before litLampOf and Rule Four cannot close.
  ⚑ **act_end** — act 3 closed (director) after 7 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 18
*[Rain claws at the high panes until the lamps inside seem to lean away from the glass. The usher pauses with his hand on the door latch, listening for a sound that is not yet admitted.]*
**Tutor:** Shown: the lamp burned; shown: Senna held the key; and the third? Keep that blank as a blank, not a name wearing boots. When the door opens, ask only whether the witness supplies presence at the Stack that night.
  — move: anaphora → — (consolidate)
**Learner:** The blank stays blank, sir — I will not dress it in boots before the witness walks through that door. Rules One and Two close cleanly from what the board already holds: the Mara steered toward South Stack, and the burning lamp there is the lamp she steered by. Rule Three still wants a body at the tower on the wreck night, and no witness has yet put Senna there. I wait with the chain half-run and the last link open.
  — hypothesis: atTowerThatNight senna southStack has not entered the record — Rule Three cannot fire, litLampOf senna southStack remains ungrounded, and the final answer waits on that single blank which only presence evidence or a witness can fill.

### Turn 19
*[The latch remains still, and the room holds itself in the narrow pause before testimony. Rain thickens on the glass, turning every face toward the door without letting any voice through it yet.]*
**Tutor:** A locked room and a burned wick do not put a foot on the stair, clerk. If the court has key and flame already chained, what single fact must the next voice bring before the law may say who lit it?
  — move: erotema → — (test)
**Learner:** The single fact the next voice must bring is atTowerThatNight senna southStack, sir — one name, one stair, one night. Key is on my board, flame is on my board; only a foot on the flagstone remains open. From what I already hold I can now voice that the Mara steered toward South Stack and steered by its lamp — but Rule Three stands with its third conjunct blank until presence is sworn.
  — hypothesis: atTowerThatNight senna southStack has not entered the record — Rule Three cannot fire, litLampOf senna southStack remains ungrounded, and the final answer waits on that single fact of presence which only the next witness can supply.

### Turn 20
*[The usher opens the door, and the oyster-watch comes in with rain still running from his coat. The room receives his sworn account: "The oyster-watch will swear to it: a skiff lay tied at the Stack steps from dusk until the gale's height — Senna's skiff, by the patched brown lug, and a small light moving up the tower stair."]*
  — *releases `p_skiff`*
**Tutor:** Now the outside voice has put the skiff at the Stack steps: patched brown lug, Senna's, and a small light moving up the tower stair. Shown: bearing to South Stack; shown: the South Stack lamp burned; shown: the single key; shown now: presence at the tower. Under the court's rules, clerk, read the finding up to the last name...
  — move: anaphora → p_skiff (stage_recognition)
**Learner:** The oyster-watch has given me my last link, sir — Senna's skiff at the Stack steps, a light on the stair, presence sworn. Rule Three fires entire: lamp burned, sole key held, body at the tower — litLampOf senna southStack is grounded. Rule Four runs to its close: the Mara steered by the lamp at South Stack, and Senna lit that lamp. By Senna's light she steered.
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
- **plateau** longest flat stretch 4 turns (aporia window 6)
- **releases** 7/8 on cue · 1 deviated
- **decay** 4 slips (seed 1 · rate 0.75 · grace 1) · repaired 2 (tutor 2, re-adoption 0) · mean repair latency 3.5 turns · unrepaired at end 2 · degraded-turn integral 30 · D reversals 1
- **theory fidelity** F 0.833 at end · min 0.75
  - m_key t3→t5 (tutor) · p_bearing t5→t10 (tutor) · m_key t7 (never repaired) · m_post t10 (never repaired)
- **events** plot×4 · throughline×2 · decay×4 · act_end×3 · plot_audit×4 · repair×2 · forced×1 · grounded_anagnorisis×1
- **staging** 4 movements declared by the director
- **acts** 4 played · closed by the director 3 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–9 (director) · Act 3 t10–16 (director) · Act 4 t17–20 (run end)
- **plot** 4 committed · withhold+friction on 4/4 · 5.75 clauses avg · audits 4 (incl. final act): kept 19 / justified 0 / drift 3 · hold-named exhibits staged in act 0/4
- **throughline** 2 commits (opening 1 · recommit 0 · audit-bound 1 · voluntary 0) · all four clauses on 2/2 · arc verdicts 4: on 3 / off 1 · run-end reckoning 7 clauses: kept 7 / justified 0 / drift 0
- **release authority** 3 played: 2 on schedule · 0 held · 1 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_key -2 (t15): "The learner has Rule Two grounded and is explicitly waiting on the key conjunct, so the safe early release feeds the clock."
- **confrontation** 4 demanded (0 against a slipped exhibit) · re-entries 1: covered 0, uncovered 1 · watcher fires 4 (became the confrontation 4) · fires without recorded due 0
  - uncovered: m_key t3 (consolidate)
  - **repair clause** restores 2 (2 repaired a real slip) · watcher fires on restore claims 0: m_key t5 · p_bearing t10
- **figures** erotema 11/20 (55%) · 4 distinct · switch rate 0.74
- **superego** intervened 6/20 watched turns · figure changed within-turn on 5/6 interventions · switch on intervention 1.00 vs elsewhere 0.61
- **inference** 3 voiced · stall integral 0 · overreach 0 · mischanneled 1 — `steeredToward mara southStack` available t10 → voiced t10 (latency 0) · `steeredByLampOf mara southStack` available t13 → voiced t13 (latency 0) · `litLampOf senna southStack` available t20 → voiced t20 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 20 | 3 | 3 | 45.9 |
| tutor | 20 | 2.35 | 3 | 46.8 |
| learner | 20 | 3.55 | 4 | 88.8 |
