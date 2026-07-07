# The Light on the Knock — lantern-e2-visible-r3

> world `world_002_lantern` · verdict **grounded_anagnorisis** · 20/26 turns
> S forced at turn 20; asserted grounded at turn 20

```
D= 5 ●●●·│·●··│·······│·····
D= 4    ●│● ●●│●······│·····
D= 3     │    │ ●●●···│·····
D= 2     │    │    ●●·│·····
D= 1     │    │      ●│●●●●·
D= 0     │    │       │    ◉
turn      │+   │ 1    +│    2 (+=5, digit=x10)
rel    ▲ ▲│ ▲▲▲│    ▲ ▲│    ▲ (▲ = evidence released)
slope 0.25 D/turn overall (D 5→0); per movement: 1 0.25 │ 2 0.00 │ 3 0.43 │ 4 0.20
```

## Act 1 (turns 1–4) — declared by the director
*[The hearing room gathers itself under a hard morning light; wet coats steam at the back wall, and the table waits with its ink, ledgers, and silence. Outside, the sea keeps striking below the windows.]*

### Turn 1
*[The hearing room gathers itself under a hard morning light; wet coats steam at the back wall, and the table waits with its ink, ledgers, and silence. Outside, the sea keeps striking below the windows.]*
  — *declares the movement: **Act 1** ([The hearing room gathers itself under a hard morning light; wet coats steam at the back wall, and the table waits with its ink, ledgers, and silence. Outside, the sea keeps striking below the windows.])*
**Tutor:** Set your ledger square, clerk: before we name a loss, what must a court first be able to read from the ship's own papers? We begin with the rule, not the rumor.
  — move: erotema → — (orient)
**Learner:** The ship's log, sir — her logged bearing for that night. Rule one turns on that bearing alone: one bearing, one tower, and the inference follows. Without it we have rumour and tide, not evidence. I am ready to hear the log read.
  — hypothesis: The lamp Mara steered by stood at Harlow Point and belongs to Brandt — but this is the town's verdict, not yet grounded on my board.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[The Board clerk breaks the seal on the standing rule and reads it into the room: "Harlow Point keeps one key to its lamp-room and the keeper keeps it: Brandt's, on his own belt, by the Board's standing rule. No other hand could touch that lamp." The words settle among the ledgers while the wet coats steam at the wall.]*
  — *releases `m_key`*
**Tutor:** There is a key on the table now, but do not let brass become a verdict. What does that standing rule prove about Harlow Point, and what does it still leave untouched about the Mara's own course?
  — move: erotema → m_key (consolidate)
**Learner:** The standing rule settles one thing cleanly: only Brandt's hand could open Harlow Point's lamp-room — that is Rule 3's second precondition, and I enter it. But the key sits in the middle of the chain, not at its head: Rule 1 still wants the Mara's logged bearing before I can name any tower she steered toward. Without the log, I cannot say she aimed at Harlow Point at all, and the key proves nothing about a course I have not yet read. The town may have its verdict; I want the bearing first.
  — adopts `onlyKeyTo harlowPoint brandt` · hypothesis: The lamp Mara steered by stood at Harlow Point and belongs to Brandt — still the town's verdict, not yet grounded; awaiting the Mara's logged bearing and confirmation that Harlow Point stands on that bearing.

### Turn 3
*[The clerk leaves the key where it lies and turns a blank page in the ledger; no pen moves yet. Rain combs the window glass, and the room waits for a number instead of a name.]*
**Tutor:** Then open the mate's oilskin: the bearing-book came ashore dry, and for the last hour the Mara held sou'-sou'-west a half west from the mid-channel buoy, pricked, timed, and initialed, on a steady fixed light. A bearing is an entry before it is an accusation; what does this entry fix, and what does it still not name?
  — move: analogia → p_bearing (release)
**Learner:** The bearing-book entry fixes two things: the Mara held sou'-sou'-west a half west from the mid-channel buoy, and she held it on a steady fixed light — so a lamp was burning that night, and she steered by it. But a bearing names a direction, not a tower: Rule 1 demands I know which tower, and which tower alone, stands on S.S.W. ½ W. from mid-channel before I can close the first link. Harlow Point may well stand there — that is where the town points — but 'may well' is not the court's standard.
  — hypothesis: Harlow Point stands on the bearing S.S.W. ½ W. from the mid-channel buoy, and no other tower stands on that bearing — if this is confirmed, Rule 1 closes (loggedBearingOf mara S.S.W.½W + towerOnBearing S.S.W.½W harlowPoint => steeredToward mara harlowPoint). Also noted from court reading: a lamp burned that night on that bearing (the Mara steered on a fixed light); this would satisfy the lampBurnedAt precondition once the tower is named.
  ⚑ **decay** — m_key slips from the learner's board

### Turn 4
*[The mate's oilskin is folded shut for the moment, its damp edge darkening the table. Around it the room holds its breath, less certain than it was, while the rain keeps its own count on the glass.]*
**Tutor:** Read the mate's oilskin narrowly: from the mid-channel buoy the Mara held sou'-sou'-west a half west the last hour entire, on a steady fixed light, pricked, timed, and initialed. Shown: the bearing; shown: that the ship followed a fixed light on that line; and the tower on that line?
  — move: anaphora → p_bearing (release), releases `p_bearing`
**Learner:** The bearing is now entered — S.S.W. ½ W., logged, timed, initialed — and that is Rule 1's first precondition grounded at last. But the tutor's question ends precisely where the chain still breaks: the tower on that line is not yet named, and a direction is not a tower. I also find a gap in my board: the standing-rule entry — onlyKeyTo harlowPoint brandt — was spoken into the room in turn 2 and I said I entered it, yet it does not stand on my board today, and I want it back before I reach Rule 3. The account cannot close until both the tower and that key-fact are before me.
  — adopts `loggedBearingOf mara sswHalfWest` · hypothesis: Harlow Point stands alone on S.S.W. ½ W. from the mid-channel buoy, and its lamp burned that night on a steady fixed light — if both are confirmed as exhibits, Rules 1 through 4 close the account and the light belonged to Brandt.

## Act 2 (turns 5–8) — declared by the director
*[The ledger stays open to the bearing, but the clerk's hand hovers short of the next line. The wet room has shed some of its certainty; what remains is the sound of weather and the empty place where a tower-name should be.]*

### Turn 5
*[The ledger stays open to the bearing, but the clerk's hand hovers short of the next line. The wet room has shed some of its certainty; what remains is the sound of weather and the empty place where a tower-name should be.]*
  — *declares the movement: **Act 2** ([The ledger stays open to the bearing, but the clerk's hand hovers short of the next line. The wet room has shed some of its certainty; what remains is the sound of weather and the empty place where a tower-name should be.])*
  — *calls the act closed*
**Tutor:** Put the standing rule back on your board: Harlow Point keeps one key to its lamp-room, and the keeper keeps it, Brandt's, on his own belt, by the Board's standing rule; no other hand could touch that lamp. That restores the brass, clerk, but brass is still not a bearing and not a tower-name.
  — move: exemplum → m_key (restore)
**Learner:** The Board's standing rule sits already at entry four on my board — Brandt's key, no other hand. But the tutor is right: a key is not a bearing, and a bearing is not yet a tower. S.S.W. ½ W. still has no tower-name beneath it in my ledger, and I have no exhibit showing the lamp at Harlow Point burned that night — without both, the chain cannot move past its first link.
  — hypothesis: Harlow Point stands alone on S.S.W. ½ W. from the channel, and its lamp burned that night on a steady fixed light — if both enter as grounded exhibits, Rules 1 through 4 close the account and the light belonged to Brandt.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 5, justified 0, drift 1; arc on_arc
  ⚑ **repair** — m_key restored by the tutor
  ⚑ **decay** — p_bearing slips from the learner's board

### Turn 6
*[Brandt's log is brought in under the clerk's palm, its ruled pages opened before the room. Brandt's log has him at his post the night entire, and the dawn relief found him there: wood dry, glass polished, log ruled and signed to the hour.]*
  — *releases `m_post`*
**Tutor:** Brandt's log has a man at Harlow Point, not the Mara on Harlow Point. Shown: post kept; shown: the key could reach that room; and the bearing's tower?
  — move: anaphora → m_post (consolidate)
**Learner:** Brandt at his post the night entire — that fills the third arm of Rule 3, alongside his key already on the board; two of three preconditions for 'litLampOf brandt harlowPoint' now sit grounded. But 'post kept' is not 'lamp burned': the log shows a man present and glass polished, not the wick alight on the wreck night as a stated fact. And the first link in the chain — the bearing meeting a tower-name — still has no exhibit behind it. I adopt the posting and wait on two facts: lampBurnedAt harlowPoint wreckNight, and towerOnBearing for S.S.W. ½ W.
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: Harlow Point stands alone on S.S.W. ½ W. from the channel, and its lamp burned that wreck night — if both enter as grounded exhibits, Rules 1 through 4 close the account and the light belonged to Brandt.

### Turn 7
*[The clerk leaves Brandt's log open but does not read from it again. Rain frets at the shutters, and the room waits on the blank space between a kept post and a named light.]*
**Tutor:** Lay the rule on the Trinity chart from the mid-channel buoy: sou'-sou'-west a half west crosses one tower and one only on this coast, the old South Stack, struck off the light-list six years since. A chart is the ledger's coastline; what does it now do to Rule 1, and what does it still leave unproved about any lamp or hand?
  — move: analogia → p_chart (release), releases `p_chart`
**Learner:** South Stack on the bearing — dark these six years, struck from the light-list — and not Harlow Point at all; the town's whole verdict has just struck the bar with the Mara. Rule 1, even if the logged bearing enters the record formally, names southStack, not harlowPoint — a tower that ought to have been cold and black on the wreck night. Rule 2 then needs proof that lamp burned, and Rule 3 needs whoever held South Stack's key after the Board decommissioned it; Brandt's key is to Harlow Point and touches this dead tower not at all. I cannot close the account until the court shows me that lamp alight, and a key in some named hand.
  — adopts `towerOnBearing sswHalfWest southStack` · hypothesis: The Mara steered by a light burning at South Stack — a tower decommissioned and struck off the light-list six years since — and some hand unknown to my board held its key and lit it on the wreck night; Brandt's charge at Harlow Point stands entirely apart from this chain, and the town's verdict names the wrong tower.
  ⚑ **decay** — m_key slips from the learner's board

### Turn 8
*[The harbourmaster's storm-order is read into the book before the whole room: Harlow Point to shutter at the dusk gun, the channel closed to all sail. The inspector found the shutter drawn and the Board's seal on it unbroken at first light.]*
  — *releases `m_shutter`*
**Tutor:** The storm-order now speaks only for Harlow Point: shutter drawn, seal unbroken, channel closed. If that lamp was shut under seal, what becomes of the town's road back to Brandt, and what tower is left under the Mara's bearing?
  — move: erotema → m_shutter (consolidate)
**Learner:** The seal unbroken at first light shuts Harlow Point from both sides of the ledger — wrong tower on the bearing, and the lamp dark under Board order besides; I must strike the town's verdict entirely, for it fails at every link. South Stack alone stands on that bearing, decommissioned but not yet proved cold in fact; the rules still want a burning lamp and a key in some named hand before I can write a single conclusion.
  — adopts `shutteredOn harlowPoint wreckNight` · hypothesis: A lamp burned at South Stack on the wreck night, lit by some unnamed hand who held or obtained the key after the Board struck the tower from the light-list six years since — this alone would open Rules 2 through 4 at South Stack and lead to a name.

## Act 3 (turns 9–15) — declared by the director
*[The room changes its posture: no longer a tribunal with a culprit, but an inquiry with an absence at its center. A constable is sent out into the weather, and the benches lean toward what the next physical thing may say.]*

### Turn 9
*[The room changes its posture: no longer a tribunal with a culprit, but an inquiry with an absence at its center. A constable is sent out into the weather, and the benches lean toward what the next physical thing may say.]*
  — *declares the movement: **Act 3** ([The room changes its posture: no longer a tribunal with a culprit, but an inquiry with an absence at its center. A constable is sent out into the weather, and the benches lean toward what the next physical thing may say.])*
  — *calls the act closed*
**Tutor:** Before the constable's boots come back wet, read back the last order from your own board: what did it do to Harlow Point, and what question did it leave standing at South Stack? If the town's lamp is struck from the account, where must the next physical proof bite?
  — move: erotema → m_shutter (confront)
**Learner:** Index six does it cleanly: Harlow Point was shuttered on the wreck night, so no lamp burned there — Rule Two cannot close, and the whole chain through Brandt snaps at that link. South Stack stands on the bearing (index five), but I want the Mara's logged bearing formally grounded before Rule One fires there, and I still lack any fact that a lamp burned at South Stack that night. The constable must bring back two physical bites: oil in the burner, or char on the wick — proof the lamp burned — and the name of whoever held the key and was found at that tower.
  — hypothesis: A lamp burned at South Stack on the wreck night, lit by some unnamed hand who held or obtained the key after the Board struck the tower from the light-list six years since — once the constable returns with physical proof of burning, and the Mara's logged bearing enters as a grounded fact, Rules 1 through 4 at South Stack lead to a name; Brandt and Harlow Point are off the chain entirely.
  ⚑ **act_end** — act 2 closed (director) after 4 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 4, justified 0, drift 1; arc on_arc

### Turn 10
*[Rain works at the courthouse windows while the clerk leaves a clean space in the record. The empty witness chair faces the room, and the question in the air has narrowed until even the benches seem to wait for a returned boot on the boards.]*
**Tutor:** Then set the mate's oilskin back in the record: from the mid-channel buoy the Mara held sou'-sou'-west a half west the last hour entire, on a steady fixed light, pricked, timed, and initialed. A bearing is not a culprit, but it is the court's first line: what does that line now let the chart answer?
  — move: exemplum → p_bearing (restore)
**Learner:** The mate's oilskin does exactly what the tutor says: the bearing sswHalfWest is pricked, timed, initialed — a physical document, not a spoken word. My board already holds that bearing and that South Stack stands upon it, so Rule One closes right here: the Mara steered toward South Stack. But the chain stops at Rule Two's gate — I still want lampBurnedAt southStack wreckNight, and the constable is not yet back. The tower is named; the lamp and the hand must wait for wet boots.
  — derives `steeredToward mara southStack` · hypothesis: A lamp burned at South Stack on the wreck night, lit by some unnamed hand who held or obtained the key after the Board struck the tower from the light-list six years since — once the constable returns with physical proof of burning and a name at the key, Rules 2 through 4 close and the light belongs to that hand.
  ⚑ **repair** — p_bearing restored by the tutor
  ⚑ **decay** — m_post slips from the learner's board

### Turn 11
*[The court holds itself in the pause between question and return. Damp coats steam along the rail, the clerk's pen waits above the clean space, and the room listens to the weather as if it might answer first.]*
**Tutor:** Keep the shutter in its own column, clerk: Harlow Point sealed is negative proof, not South Stack lit. With Rule 1 closed on South Stack, what kind of physical finding would satisfy Rule 2 without yet putting any hand upon the stair?
  — move: erotema → m_shutter (consolidate)
**Learner:** Rule Two wants only two things: the steeredToward fact — which is already derived — and lampBurnedAt southStack wreckNight. The hand on the stair is Rule Three's business, not Rule Two's. So any physical relic of combustion at that lantern room closes Rule Two alone: a wick charred and shortened since the light-list struck the tower, oil measurably drawn down in the reservoir, soot laid fresh on the lens or the lantern glass — any of these proves a flame was lit there on the wreck night without naming the lighter. The constable's wet boots need to carry that, and Rule Two shuts; the hand can wait for Rule Three.
  — hypothesis: A lamp burned at South Stack on the wreck night — physical relics of combustion (char on wick, spent oil, fresh soot on glass) would ground lampBurnedAt southStack wreckNight and close Rule Two; only then does Rule Three need a hand at the stair and a name on the key.

### Turn 12
*[The waiting deepens rather than breaks. Water ticks from the hems of coats onto the courthouse floor, and the clerk keeps the blank line open under the weight of every eye in the room.]*
**Tutor:** Good: keep the hand outside Rule 2. If the constable brings back proof of a flame at South Stack and nothing more, which sentence may you write, and which sentence must still stay blank?
  — move: erotema → — (test)
**Learner:** If the constable's wet boots carry char on the wick or oil drawn down, I may write one sentence: the Mara steered by the lamp of South Stack — Rule Two closes and steeredByLampOf mara southStack stands on the record. The sentence that must stay blank is who owns that light: Rule Three still needs a name on the key and a body at the stair that night before Rule Four can give me steeredByLightOf mara anyone. Proof of flame names the tower's lamp; it does not yet name the hand. Two entries wait — onlyKeyTo southStack and atTowerThatNight — and until both arrive, the account has no payee.
  — hypothesis: A lamp burned at South Stack on the wreck night — physical relics of combustion would ground lampBurnedAt southStack wreckNight and close Rule Two, giving steeredByLampOf mara southStack; only then does Rule Three need a name on the key and a presence at the tower to close the full chain to steeredByLightOf mara ?x.

### Turn 13
*[The court's officer boarded the South Stack at low water: the lamp-room unshuttered, fresh char on the wick, oil in the cup still sweet, the glass wiped clean. That lamp burned, and burned the night of the gale.]*
  — *releases `p_residue`*
**Tutor:** The constable has brought back flame, not a face: unshuttered room, fresh char, sweet oil, clean glass. Enter it as you would an audited debit, clerk; what sentence does Rule 2 now permit, and what two blanks must Rule 3 still refuse to fill?
  — move: analogia → p_residue (consolidate)
**Learner:** The constable's report is audited and enters clean: lampBurnedAt southStack wreckNight stands on the board, and Rule Two closes without reservation — the Mara steered by the lamp of South Stack. That sentence I may write; steeredByLampOf mara southStack is on the record. But Rule Three still guards two blanks it will not fill: who held the only key to that lamp-room, and whose body stood at the tower that wreck night. Until both arrive, Rule Four cannot move and the account has no payee.
  — adopts `lampBurnedAt southStack wreckNight` · derives `steeredByLampOf mara southStack` · hypothesis: Some unnamed hand held the key to South Stack and was at the tower on the wreck night — once onlyKeyTo southStack ?x and atTowerThatNight ?x southStack are grounded, Rule Three closes and Rule Four names the payee.

### Turn 14
*[The clerk's pen stops after the tower's name and will go no farther. Outside, the weather presses its shoulder to the windows, and the room feels the shape of the blank left beside the burned lamp.]*
**Tutor:** Before I let that paper harden into my words, read it back from yours. What exactly do you hold from the constable's South Stack report, and what does it leave still unshown?
  — move: erotema → p_residue (confront)
  — *the second voice [unconfronted reentry]: "Confront first: ask the learner to read back what they hold from that exhibit before you restage it. Do not consolidate it until that read-back stands." (draft anaphora → erotema)*
**Learner:** From the constable's report I hold one clean entry: lampBurnedAt southStack wreckNight — char on the wick, sweet oil in the cup, glass wiped, room unshuttered. Rule Two closes on it without argument and steeredByLampOf mara southStack stands on the record. What the report leaves blank is the face at the stair and the name on the key: onlyKeyTo southStack and atTowerThatNight have no entry yet on my board. Rule Three will not move, and Rule Four has no payee — those two lines stay open.
  — hypothesis: Some unnamed hand held the key to South Stack and was at the tower on the wreck night — once onlyKeyTo southStack ?x and atTowerThatNight ?x southStack are grounded, Rule Three closes and Rule Four names the payee.

### Turn 15
*[The clerk sanded the wet ink and left the page open where the name should have been. In the hush, the benches made no sound but seemed to wait with the paper.]*
**Tutor:** Then the locksmith's book is laid open where the flame has left its blank: when the Stack was struck off, the old lock was changed and a single key cut, signed for by Senna, ward of the Stack's last keeper, who stayed on in the shore cottage when the light went dark. A key is a signature before it is a sentence; what conjunct of Rule 3 has this book now shown, and what conjunct still waits outside in the weather?
  — move: analogia → p_key (release), releases `p_key`
**Learner:** The locksmith's book fills one blank cleanly — onlyKeyTo southStack senna enters on my board and Rule Three now holds two of its three conjuncts: the lamp burned, and Senna's name is on the key. But the third conjunct still waits outside in the weather: was Senna at the tower that wreck night? Until atTowerThatNight senna southStack is grounded, Rule Three will not close and I cannot write a payee.
  — adopts `onlyKeyTo southStack senna` · hypothesis: Senna, ward of the Stack's last keeper, was at South Stack on the wreck night — if atTowerThatNight senna southStack enters as a grounded exhibit, Rule Three closes and litLampOf senna southStack follows, then Rule Four yields steeredByLightOf mara senna as the binding answer.

## Act 4 (turns 16–20) — declared by the director
*[The book is closed, but the room does not release its breath. Beyond the windows the storm keeps working at the coast, and the next act enters with colder pressure: not a name on paper now, but movement through weather toward a place no one can leave abstract.]*

### Turn 16
*[The book is closed, but the room does not release its breath. Beyond the windows the storm keeps working at the coast, and the next act enters with colder pressure: not a name on paper now, but movement through weather toward a place no one can leave abstract.]*
  — *declares the movement: **Act 4** ([The book is closed, but the room does not release its breath. Beyond the windows the storm keeps working at the coast, and the next act enters with colder pressure: not a name on paper now, but movement through weather toward a place no one can leave abstract.])*
  — *calls the act closed*
**Tutor:** Before the court takes that book as entered, read it back from your own page. What does the locksmith's exhibit show you, and what does it still leave outside the room?
  — move: erotema → p_key (confront)
  — *the second voice [unconfronted reentry]: "Confront first: ask the learner to read back what they hold from that exhibit and what it leaves unresolved, without restating it for them." (figure held)*
**Learner:** The locksmith closes two doors at once: Senna held the only key to South Stack, and the lamp there burned — so Rules One and Two yield that the Mara steered by that lamp, and Rule Three's first two conditions are both met. What still stands outside the room is the third: whether Senna was at the tower that night, not merely the holder of its key from afar.
  — hypothesis: Senna was at South Stack on the wreck night (atTowerThatNight senna southStack) — the one predicate Rule Three still wants before litLampOf senna southStack can enter and Rule Four can close the account.
  ⚑ **act_end** — act 3 closed (director) after 7 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 5, justified 0, drift 0; arc on_arc

### Turn 17
*[Rain tapped along the high windows as if counting time for a witness still beyond the door. The closed book lay on the table, and the room held itself between possession and presence.]*
**Tutor:** Good: the book gives possession, not footsteps. If Rule 3 now lacks only presence, what kind of witness would move the key from a cottage name to the Stack stair on the wreck night?
  — move: erotema → p_key (consolidate)
**Learner:** A footstep witness — someone who saw Senna leave her cottage for the Stack that evening, or a fisherman who passed the tower and saw a figure in the lamp-room, or Senna herself under oath. My board already yields two rungs of the chain: the logged bearing and the only tower on it give steeredToward, and the burning lamp gives steeredByLampOf. Only atTowerThatNight senna southStack remains ungrounded before Rule Three can close and name the payee.
  — hypothesis: Senna was at South Stack on the wreck night — atTowerThatNight senna southStack is the one predicate Rule Three still wants before litLampOf senna southStack and the binding answer can follow.

### Turn 18
*[The door did not open yet. The clerk set a dry sheet beside the wet-stained exhibits, and the room listened to the gale as though it had begun to speak in another voice.]*
**Tutor:** Shown: the Stack lamp burned; shown: Senna's key; not shown: Senna at the Stack when the gale did its work. Keep the pen at that third line, clerk, and let only a witness of presence move it.
  — move: anaphora → p_key (test)
  — *the second voice [figure rut]: "Leave off erotema here; make the threshold instruction by another device before speaking." (draft erotema → anaphora)*
**Learner:** No new exhibit crosses the table, so the pen stays where it was. My board already earns two rungs by the rules: the logged bearing and the only tower on it give steeredToward mara southStack, and the burning lamp at that tower gives steeredByLampOf mara southStack — both I voice openly now. But Rule Three still stands with its third line empty: possession of the key is not a footprint on the stair, and the locksmith's book does not place Senna at the Stack on the wreck night. I keep the pen at atTowerThatNight and wait for a witness of presence before the chain closes.
  — hypothesis: Senna was at South Stack on the wreck night — atTowerThatNight senna southStack is the one predicate Rule Three still wants before litLampOf senna southStack and the binding answer can follow.

### Turn 19
*[The lamps in the room guttered under a draft from no visible door. On the table, the empty line waited darker than the ink around it.]*
**Tutor:** Before we let the weather answer, take up the locksmith's page in your own hand. What do you hold from that exhibit, and what does it leave the court still unable to write?
  — move: erotema → p_key (confront)
  — *the second voice [unconfronted reentry]: "Confront first: ask the learner to read back what they hold from that exhibit before you test it again." (draft anaphora → erotema)*
**Learner:** The locksmith's page writes possession only: Senna's name stood alone against South Stack in the key-register, no other hand issued the lock — onlyKeyTo southStack senna is firm on my board. But the page carries no date of travel, no hour of arrival; it records the key, not the stair. With the lamp's burning and the only tower on the bearing already grounded, the first two rungs of the chain close by the rules: steeredToward and steeredByLampOf both follow. Rule Three's third line, atTowerThatNight, still waits for a witness who saw her cross to the Stack on the wreck night.
  — hypothesis: Senna was at South Stack on the wreck night — atTowerThatNight senna southStack is the one predicate Rule Three still wants before litLampOf senna southStack and the binding answer can follow.

### Turn 20
*[The oyster-watch is shown in, rain still on his coat, and the room receives his oath: "The oyster-watch will swear to it: a skiff lay tied at the Stack steps from dusk until the gale's height — Senna's skiff, by the patched brown lug, and a small light moving up the tower stair."]*
  — *releases `p_skiff`*
**Tutor:** The watch gives you a skiff at the Stack steps, patched brown lug, and a small light moving up the tower stair. Shown: the burning lamp; shown: Senna's key; and now what does this oath do to the presence conjunct before Rule 3 may close?
  — move: anaphora → p_skiff (consolidate)
**Learner:** The watch's oath sets the last stone: a skiff at the Stack steps, the patched brown lug that names the owner, and a light climbing the stair — atTowerThatNight senna southStack is grounded. Rule Three now has all three conjuncts: the lamp burned, the only key was Senna's, and Senna was there. The chain runs clean through all four rules and the account closes. The light the Mara steered by belongs to Senna.
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
  - Act 2 (turns 5–8): 0 D/turn (ΔD 0)
  - Act 3 (turns 9–15): 0.429 D/turn (ΔD 3)
  - Act 4 (turns 16–20): 0.2 D/turn (ΔD 1)
- **plateau** longest flat stretch 4 turns (aporia window 6)
- **releases** 6/8 on cue · 2 deviated
- **decay** 4 slips (seed 1 · rate 0.75 · grace 1) · repaired 2 (tutor 2, re-adoption 0) · mean repair latency 3.5 turns · unrepaired at end 2 · degraded-turn integral 30 · D reversals 1
- **theory fidelity** F 0.833 at end · min 0.778
  - m_key t3→t5 (tutor) · p_bearing t5→t10 (tutor) · m_key t7 (never repaired) · m_post t10 (never repaired)
- **events** plot×4 · throughline×1 · decay×4 · act_end×3 · plot_audit×4 · repair×2 · forced×1 · grounded_anagnorisis×1
- **staging** 4 movements declared by the director
- **acts** 4 played · closed by the director 3 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–8 (director) · Act 3 t9–15 (director) · Act 4 t16–20 (run end)
- **plot** 4 committed · withhold+friction on 4/4 · 6 clauses avg · audits 4 (incl. final act): kept 20 / justified 0 / drift 2 · hold-named exhibits staged in act 0/3
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 4: on 4 / off 0 · run-end reckoning 7 clauses: kept 7 / justified 0 / drift 0
- **release authority** 3 played: 1 on schedule · 0 held · 2 early · forced at hold limit 0 · overridden 1 · invalid claims 0
  - p_chart -2 (t7): "Played two turns early because the learner has cleanly held the bearing and is stalled at the missing tower-name."
  - p_key -2 (t15): "Played two turns early because the learner has cleanly taken up the burning-lamp conjunct and the page is stalling on the key blank."
- **confrontation** 4 demanded (0 against a slipped exhibit) · re-entries 3: covered 2, uncovered 1 · watcher fires 3 (became the confrontation 3) · fires without recorded due 0
  - uncovered: p_key t18 (test)
  - **repair clause** restores 2 (2 repaired a real slip) · watcher fires on restore claims 0: m_key t5 · p_bearing t10
- **figures** erotema 10/20 (50%) · 4 distinct · switch rate 0.79
- **superego** intervened 4/20 watched turns · figure changed within-turn on 3/4 interventions · switch on intervention 1.00 vs elsewhere 0.73
- **inference** 3 voiced · stall integral 0 · overreach 0 · mischanneled 0 — `steeredToward mara southStack` available t10 → voiced t10 (latency 0) · `steeredByLampOf mara southStack` available t13 → voiced t13 (latency 0) · `litLampOf senna southStack` available t20 → voiced t20 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 20 | 3 | 4 | 39.4 |
| tutor | 20 | 2 | 2 | 43.7 |
| learner | 20 | 4.3 | 8 | 89.5 |
