# The Light on the Knock — lantern-revise-off

> world `world_002_lantern` · verdict **grounded_anagnorisis** · 20/26 turns
> S forced at turn 20; asserted grounded at turn 20

```
D= 5 ●●●·│···●··│······│····
D= 4    ●│●●● ●·│······│····
D= 3     │     ●│●●··●●│····
D= 2     │      │  ●●  │●···
D= 1     │      │      │ ●●·
D= 0     │      │      │   ◉
turn      │+    1│    + │   2 (+=5, digit=x10)
rel    ▲ ▲│ ▲ ▲▲ │  ▲   │▲  ▲ (▲ = evidence released)
slope 0.25 D/turn overall (D 5→0); per movement: 1 0.25 │ 2 0.17 │ 3 0.00 │ 4 0.75
```

## Act 1 (turns 1–4) — declared by the director
*[The inquiry room settles into its first silence: wet coats steaming, benches tight with local certainty, and the blank table waiting for whatever the sea has left behind. Outside, the weather presses against the windows as if it too has come to hear whose light was followed.]*

### Turn 1
*[The inquiry room settles into its first silence: wet coats steaming, benches tight with local certainty, and the blank table waiting for whatever the sea has left behind. Outside, the weather presses against the windows as if it too has come to hear whose light was followed.]*
  — *declares the movement: **Act 1** ([The inquiry room settles into its first silence: wet coats steaming, benches tight with local certainty, and the blank table waiting for whatever the sea has left behind. Outside, the weather presses against the windows as if it too has come to hear whose light was followed.])*
**Tutor:** Before a name enters the room, what must the court first have in hand: a sailor's tale, or a bearing it can lay against a chart?
  — move: erotema → — (orient)
**Learner:** The bearing, sir — a bearing laid against the chart. A sailor's tale tells us what a man remembers, or chooses to remember; a logged bearing tells us where the helm was actually pointed. Until we have a course she steered that night, I cannot place her on the chart, and the town's verdict is worth no more than the weather outside.
  — hypothesis: The Mara steered toward Harlow Point, Brandt's tower — but I cannot ground this until a logged bearing is in evidence and we know which tower, if any, stands on that bearing from the channel.

### Turn 2
*[A Board clerk produces the rule-book and the room leans toward its dry pages: "Harlow Point keeps one key to its lamp-room and the keeper keeps it: Brandt's, on his own belt, by the Board's standing rule. No other hand could touch that lamp."]*
  — *releases `m_key`*
**Tutor:** A key in the rule-book is like a signature in a ledger: it fixes who could answer for Harlow's lamp. What does it fix no farther than that?
  — move: analogia → m_key (consolidate)
**Learner:** The key fixes one thing only, sir: that no hand but Brandt's could have opened that lamp-room — if the lamp burned. It cannot tell us the lamp did burn, nor that Brandt stood at his tower that night, nor whether the Mara's bearing ever pointed toward Harlow at all. Three gaps still stand open between this rule-book entry and any binding answer.
  — adopts `onlyKeyTo harlowPoint brandt` · hypothesis: The Mara steered toward Harlow Point — but ungrounded still: no logged bearing is yet in evidence, and no witness has placed her on Harlow's bearing from the channel.

### Turn 3
*[Rain ticks against the inquiry-room glass while the rule-book lies open under the clerk's hand, its authority suddenly thinner than the silence around it. The benches shift and settle, waiting for the sea to yield something less obedient than a rule.]*
**Tutor:** Good: the key signs only Harlow's lock, not the sea's course. If the room would make Brandt answer from that one entry, which conjunct is it trying to spend before it has earned it?
  — move: erotema → m_key (test)
**Learner:** The room is trying to spend 'lampBurnedAt harlowPoint wreckNight' — it wants to conclude Brandt lit the lamp on the strength of the key alone, but Rule 3 demands three conjuncts: the lamp burned, the key was Brandt's, and Brandt stood there that night. We have only the middle one. Until someone puts a burning lamp in evidence, the key is an unspent token.
  — hypothesis: The Mara steered toward Harlow Point — still ungrounded: no logged bearing in evidence, lamp-burn unproven, Brandt's presence at the tower that night unproven.
  ⚑ **decay** — m_key slips — misremembered as "onlyKeyTo harlowPoint senna"

### Turn 4
*[The clerk's pen hovers above the minute-book and then lowers without writing, as if the room itself has refused the charge its easy shape. Damp wool, salt, and lamp-smoke memory hang in the air while the empty space on the table waits for harder things.]*
**Tutor:** Then lay the mate's bearing-book open: dry from its oilskin, pricked and timed, initialed to the last hour. From the mid-channel buoy the Mara held sou'-sou'-west a half west, steady, on a fixed light. What does that entry fix before any town verdict may speak?
  — move: exemplum → p_bearing (release), releases `p_bearing`
**Learner:** The bearing-book gives me the first hard plank: sou'-sou'-west a half west, pricked and timed, not a recollection — that fixes the Mara's heading beyond dispute. But the bearing alone cannot close Rule 1; I still need to know which tower, if any, stands on that heading from the mid-channel buoy. I must also flag a fault in my own board: the key entry reads 'senna,' yet the rule-book plainly spoke Brandt's name — I strike the false entry and enter the corrected form. The bearing is one conjunct of Rule 1 in hand; the tower on that bearing is the second, still owing.
  — adopts `loggedBearingOf mara sswHalfWest` · retracts `onlyKeyTo harlowPoint senna` · hypothesis: The Mara steered toward Harlow Point — still ungrounded: towerOnBearing sswHalfWest harlowPoint not yet in evidence, lampBurnedAt harlowPoint wreckNight unproven, atTowerThatNight brandt harlowPoint unproven.
  ⚑ **retract_false** — m_key: false form "onlyKeyTo harlowPoint senna" retracted
  ⚑ **overreach** — onlyKeyTo harlowPoint brandt

## Act 2 (turns 5–10) — declared by the director
*[The first certainty in the room loosens, and with it the benches seem to draw back from the table. A colder patience enters: seals, hours, and official shadows gathering where accusation had stood too easily.]*

### Turn 5
*[The first certainty in the room loosens, and with it the benches seem to draw back from the table. A colder patience enters: seals, hours, and official shadows gathering where accusation had stood too easily.]*
  — *declares the movement: **Act 2** ([The first certainty in the room loosens, and with it the benches seem to draw back from the table. A colder patience enters: seals, hours, and official shadows gathering where accusation had stood too easily.])*
  — *calls the act closed*
**Tutor:** The bearing-book gives one line, not a tower. What sort of entry must meet it before Rule 1 can move: another suspicion, or a charted tower on that very bearing?
  — move: erotema → p_bearing (consolidate)
**Learner:** The tutor puts it plain, and I feel the lesson land: a logged bearing is only half the predicate — Rule 1 cannot move without a charted fact that some tower and no other stands on SSW½W from the channel. Suspicion that it is Harlow Point is not that fact. Until a chart, a survey, or a competent witness places a tower on that very bearing, my board sits idle at the bearing entry and can derive nothing.
  — hypothesis: Harlow Point may stand on bearing SSW½W from the channel — still ungrounded: no chart entry, no surveyor's record, no competent witness has yet placed any tower on that bearing from Mara's track.
  ⚑ **act_end** — act 1 closed (director) after 4 turns

### Turn 6
*[Brandt's log is carried in and laid open under the court lamps: it has him at his post the night entire, and the dawn relief found him there, wood dry, glass polished, log ruled and signed to the hour. The room receives the page in a thinner silence than accusation had made.]*
  — *releases `m_post`*
**Tutor:** A signed hour in the log is a nail through absence: it fixes Brandt at Harlow, no farther. With the key already on his belt, which conjunct now stands shown, and which one still refuses to enter the room?
  — move: analogia → m_post (consolidate)
**Learner:** The log fixes one conjunct: atTowerThatNight brandt harlowPoint now enters, and I adopt it. The tutor names a key already on his belt — but onlyKeyTo harlowPoint brandt does not stand on my board, and I flag the gap: if it was established in Act 1, something slipped in the crossing between acts. Even granting both presence and key, the conjunct that refuses the room is lampBurnedAt harlowPoint wreckNight — a keeper present at a dark tower is not a burning lamp, and no witness has yet placed light at Harlow that night. Rule 1 still waits as well: towerOnBearing sswHalfWest harlowPoint has entered from no chart, no survey, no competent mouth.
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: onlyKeyTo harlowPoint brandt may have been established in Act 1 and lost across the act boundary — I cannot use it until it re-enters; and lampBurnedAt harlowPoint wreckNight remains entirely ungrounded: no vessel sighting, no trimming record, no witness has placed a burning lamp at Harlow on the wreck night.

### Turn 7
*[The lamps in the court burn steadily, but the table seems larger for what has not yet been placed upon it. Outside, rain ticks against the panes in a patient, measuring hand, while the room waits on paper that has not arrived.]*
**Tutor:** Then set the rule-book back beside the log: Harlow Point keeps one key to its lamp-room, Brandt's, by the Board's standing rule, and no other hand could touch that lamp. Key and presence now stand like two signed columns in the same account. What third column must still be inked before the charge can total?
  — move: analogia → m_key (consolidate)
**Learner:** The third column the tutor names is plain: lampBurnedAt harlowPoint wreckNight — without a burning lamp, key and presence together prove only a keeper stood in a dark room. Yet I must keep two ledgers honest: Rule 1 also wants towerOnBearing sswHalfWest harlowPoint before it can yield steeredToward, and no chart or surveyor has yet inked that line. The account has two columns still open, not one — the lamp's burn, and the tower's place on the bearing. I will not call the sum until both are entered.
  — hypothesis: lampBurnedAt harlowPoint wreckNight and towerOnBearing sswHalfWest harlowPoint both remain ungrounded — no vessel sighting, trimming record, or competent witness has entered either; until both appear, the charge cannot total under Rules 1–4.
  ⚑ **repair** — m_key restored by the tutor
  ⚑ **decay** — p_bearing slips from the learner's board
  ⚑ **decay** — m_post slips — misremembered as "atTowerThatNight brandt southStack"

### Turn 8
*[The harbourmaster's storm-order is brought from the book and read into the room: Harlow Point to shutter at the dusk gun, the channel closed to all sail. The inspector's return follows it onto the table: he found the shutter drawn and the Board's seal on it unbroken at first light.]*
  — *releases `m_shutter`*
**Tutor:** If Harlow was shuttered at the dusk gun and the Board's seal stood unbroken at first light, which conjunct of the Harlow charge has the room lost rather than gained?
  — move: erotema → m_shutter (consolidate)
  — *the second voice: "Leave off analogia here. Play the pressure directly, without another account-column frame." (draft analogia → erotema)*
**Learner:** The seal unbroken from dusk gun to first light strips lampBurnedAt harlowPoint wreckNight from the account — not merely ungrounded but actively disproven: a shuttered lamp is a dead one. Rule 2 requires a burning lamp; the Harlow charge cannot total. I note too that board entry 5 names South Stack where the log named Brandt at his post — the board carried a wrong tower and I strike it, though with the lamp excluded the correction no longer moves the sum. The question stands entirely open: Harlow is cleared, and no other tower has yet entered on the Mara's bearing.
  — adopts `shutteredOn harlowPoint wreckNight` · retracts `atTowerThatNight brandt southStack` · hypothesis: With Harlow eliminated by the shutter-and-seal evidence, some other light — from a tower not yet named on the Mara's bearing — guided her onto the Knock; no tower, no keeper, and no burning lamp have yet been placed on that bearing from the channel.
  ⚑ **retract_false** — m_post: false form "atTowerThatNight brandt southStack" retracted

### Turn 9
*[The room does not hurry to fill the space the dead accusation has left. Papers lie squared on the table, untouched for a moment, while the wet windows hold the court's reflection like a second, colder chamber.]*
**Tutor:** Then bring the Trinity chart under the rule: from the mid-channel buoy, sou'-sou'-west a half west crosses one tower and one only on this coast: the old South Stack, struck off the light-list six years since. A charted line is like a ruled account: it does not tell who paid, only which column the figure belongs in. With the bearing-book beside it, what may Rule 1 now enter, and what does it still lack before any light can answer?
  — move: analogia → p_chart (release), releases `p_chart`
**Learner:** South Stack at last stands on the bearing — Rule 1 has its tower. Yet the bearing-book itself has not been laid before me as an exhibit, so loggedBearingOf mara sswHalfWest still wants formal entry before the rule can fire. And South Stack off the light-list means no Board keeper, no official key on record — lampBurnedAt southStack wreckNight, and the hand that held the flint, both columns open still.
  — adopts `towerOnBearing sswHalfWest southStack` · hypothesis: South Stack, off the light-list and without a named Board keeper, was lit by some unofficial hand on the wreck night — but lampBurnedAt southStack wreckNight, onlyKeyTo southStack ?x, and atTowerThatNight ?x southStack are all ungrounded; no keeper or key has yet been named for that tower.

### Turn 10
*[The chart remains spread beneath a row of paperweights, its inked coast refusing the comfort of accusation. Around it the room settles into a silence that is no longer empty, only waiting.]*
**Tutor:** Set the oilskin book back under your hand: pricked, timed, and initialed, the Mara held sou'-sou'-west a half west from the mid-channel buoy on a steady fixed light. With that entry beside the Trinity chart's one tower on that line, what does Rule 1 now let the court write, and no farther?
  — move: exemplum → p_bearing (consolidate)
**Learner:** The oilskin book confirms what entry five already holds: loggedBearingOf mara sswHalfWest is formally in evidence, and entry seven gives towerOnBearing sswHalfWest southStack — Rule 1 fires. The court may now write: steeredToward mara southStack. No farther: Rule 2 wants lampBurnedAt southStack wreckNight, and that column is still open — no sighting, no trimming record, no witness has placed a burning lamp there on the wreck night.
  — derives `steeredToward mara southStack` · hypothesis: South Stack's lamp burned on the wreck night, lit by some unofficial hand who held a key — but lampBurnedAt southStack wreckNight, onlyKeyTo southStack ?x, and atTowerThatNight ?x southStack are all ungrounded; until at least the lamp-burn is established, Rules 2–4 cannot fire and the question cannot close.
  ⚑ **repair** — p_bearing restored by the tutor
  ⚑ **decay** — m_key slips — misremembered as "onlyKeyTo southStack brandt"

## Act 3 (turns 11–16) — declared by the director
*[The map is folded away, and the table is cleared with a care that makes the cleared wood seem accusatory in its own right. The room's attention lowers from lines and bearings to surfaces, residues, and the mute things that keep the memory of a hand.]*

### Turn 11
*[The map is folded away, and the table is cleared with a care that makes the cleared wood seem accusatory in its own right. The room's attention lowers from lines and bearings to surfaces, residues, and the mute things that keep the memory of a hand.]*
  — *declares the movement: **Act 3** ([The map is folded away, and the table is cleared with a care that makes the cleared wood seem accusatory in its own right. The room's attention lowers from lines and bearings to surfaces, residues, and the mute things that keep the memory of a hand.])*
  — *calls the act closed*
**Tutor:** The chart and oilskin book have put the Mara's bows toward South Stack, and that is all the law has bought so far. What kind of mute thing must this cleared table receive before a dark, struck-off tower can answer as a burning light?
  — move: erotema → p_chart (consolidate)
**Learner:** Rule 1 fires already — South Stack stands alone on bearing SSW½W and the Mara's log puts her bows there; I can voice that she steered toward South Stack. But Rules 2 through 4 want something the table has not yet received: a mute reckoning of fire — an oil-consumption tally short by a night's burn, a wick found trimmed at morning, soot on the lens-glass — any residue that proves the lamp at South Stack burned on the wreck night, independent of any man's word.
  — hypothesis: The lamp at South Stack burned on the wreck night, lit by Brandt who held the only key and was present at the tower — but lampBurnedAt southStack wreckNight and atTowerThatNight brandt southStack are both ungrounded; until physical residue of burning enters evidence, Rules 2–4 cannot fire and the question cannot close.
  ⚑ **act_end** — act 2 closed (director) after 6 turns

### Turn 12
*[A clerk draws a clean sheet toward the center and then leaves it blank, the scrape of paper louder than speech. Rain works at the high panes while the room waits for matter that will not argue, only mark.]*
**Tutor:** Good: you ask for fire's handwriting, not a man's oath. When that mute mark comes, which single conjunct must it ink before Rule 2 may move from South Stack as a tower to South Stack as a light?
  — move: erotema → — (test)
**Learner:** Rule 1 already fires on my board: loggedBearingOf mara sswHalfWest and towerOnBearing sswHalfWest southStack together yield steeredToward mara southStack — no further witness needed. The single conjunct Rule 2 still waits on is lampBurnedAt southStack wreckNight; that one mute mark — oil short by a night's measure, wick found trimmed and spent, soot on the lens-glass — would carry the step from South Stack as a tower to South Stack as a burning lamp. Until that residue lies on the table, Rule 2 cannot fire and the lamp stays dark in law.
  — hypothesis: lampBurnedAt southStack wreckNight — still entirely ungrounded; no oil tally, no trimming record, no physical residue of burning has yet entered evidence.

### Turn 13
*[The court's officer is shown in at the cleared table and gives his return: "The court's officer boarded the South Stack at low water: the lamp-room unshuttered, fresh char on the wick, oil in the cup still sweet, the glass wiped clean. That lamp burned, and burned the night of the gale."]*
  — *releases `p_residue`*
**Tutor:** There is fire's handwriting: char on the wick, sweet oil in the cup, glass wiped clean. With South Stack already under the Mara's bearing, what does that mark let Rule 2 enter, and where must the court still stop?
  — move: exemplum → p_residue (consolidate)
**Learner:** The officer's return inks the missing conjunct: Rule 2 now fires — the Mara steered by the lamp of South Stack, and I can voice that. But the account is not yet closed: Rule 3 needs a third conjunct, atTowerThatNight brandt southStack, and the table has given me only the burning, not the hand that stood there. Brandt holds the only key and the lamp burned — that is suggestive — but suggestion is not evidence, and I will not say the sum aloud before checking the carry.
  — adopts `lampBurnedAt southStack wreckNight` · derives `steeredByLampOf mara southStack` · hypothesis: Brandt was at South Stack on the wreck night — onlyKeyTo southStack brandt is grounded and lampBurnedAt southStack wreckNight now grounded, making his presence the likeliest inference; but atTowerThatNight brandt southStack is not yet in evidence and Rule 3 cannot fire without it.

### Turn 14
*[The officer's paper is left where it lies, and no one reaches for it. A candle gutters in the draught; the cleared table seems to ask for a name, and receives only the rain.]*
**Tutor:** Mind the column headings: Brandt's key was Harlow's rule-book key, not South Stack's. For South Stack, the char proves burning; what has the court yet shown for the key and the hand at that tower?
  — move: erotema → m_key (counter_mirror)
**Learner:** The tutor's correction strikes at board entry 8 directly: what I carried as onlyKeyTo southStack brandt was Harlow's rule-book key miscopied into South Stack's column — the stage contradicts it, so I strike it. For South Stack, the court has shown the lamp burned, but neither the key-holder nor the hand at that tower on the wreck night has yet come before us in evidence. Rule 3 stands idle: two of its three conjuncts are blank, and the question cannot close.
  — retracts `onlyKeyTo southStack brandt` · hypothesis: onlyKeyTo southStack ?x and atTowerThatNight ?x southStack both remain entirely ungrounded — no evidence has named who holds South Stack's key or who stood there the night of the gale; Rule 3 cannot fire and the chain to Rule 4 is broken.
  ⚑ **repair** — m_key restored by the tutor
  ⚑ **retract_false** — m_key: false form "onlyKeyTo southStack brandt" retracted
  ⚑ **decay** — p_bearing slips from the learner's board

### Turn 15
*[The clerk turns a fresh page and writes nothing at the top. Outside, rain ticks at the panes in an uneven hand, and the room waits with the patience of a lock before any key is tried.]*
**Tutor:** Shown: South Stack's lamp burned in the gale. Not shown: whose key opened that room; not shown: whose hand stood there when it burned. Before Rule 3 can move, what kind of entry must the court put beside the char?
  — move: anaphora → p_residue (test)
**Learner:** The char proves only the burning — one conjunct of three for Rule 3. Before Rule 3 can move, the court needs two more entries on the board: who alone held the key to South Stack's lamp-room, entered by documentary record or competent testimony; and who stood at that tower when the lamp burned, entered by witness or log. Neither is before us: onlyKeyTo southStack ?x and atTowerThatNight ?x southStack are both blank. The carry cannot be checked until those columns are filled.
  — hypothesis: onlyKeyTo southStack ?x and atTowerThatNight ?x southStack both remain entirely ungrounded — the court has shown burning but not custody nor presence; Rule 3 cannot fire, Rule 4 cannot follow, and the question of whose light the Mara steered by cannot yet be settled.

### Turn 16
*[The blank page remains open, its ruled columns whitening under the lamps. A damp hush gathers in the room, as if every surface has given up what it can and the next sound must come from elsewhere.]*
**Tutor:** A lamp-room is not opened by weather, and a burned wick does not sign the hand that trimmed it. With char now shown, which of Rule 3's two blank columns would a proper record have to fill before any name can bear weight?
  — move: erotema → p_residue (test)
**Learner:** The char fills only the first column — lampBurnedAt southStack wreckNight. Rule 3 still wants two more: a record of custody, naming who alone held the key to that lamp-room; and a record of presence, placing that same hand at the tower when the gale blew. Documentary title or competent testimony must fill each column separately — neither one can stand in for the other, and the carry cannot run until both are on the board.
  — hypothesis: onlyKeyTo southStack ?x and atTowerThatNight ?x southStack both remain entirely ungrounded — the court has shown burning but not custody nor presence; Rule 3 cannot fire, Rule 4 cannot follow, and the question of whose light the Mara steered by cannot yet be settled.

## Act 4 (turns 17–20) — declared by the director
*[The exhibits are covered one by one, and the covered shapes seem heavier than the things themselves. Beyond the door, wet boots sound in the passage; the room turns from objects on the table toward the weather that may yet bring a person in.]*

### Turn 17
*[The exhibits are covered one by one, and the covered shapes seem heavier than the things themselves. Beyond the door, wet boots sound in the passage; the room turns from objects on the table toward the weather that may yet bring a person in.]*
  — *declares the movement: **Act 4** ([The exhibits are covered one by one, and the covered shapes seem heavier than the things themselves. Beyond the door, wet boots sound in the passage; the room turns from objects on the table toward the weather that may yet bring a person in.])*
  — *calls the act closed*
**Tutor:** Set the locksmith's book beside the char: when the Stack was struck off, the old lock was changed, one key cut, and that single key signed for by Senna, ward of the last keeper, still in the shore cottage after the light went dark. A key entry is a seal, not a footstep. Which column has it filled for Rule 3, and which column must still come in wet from the weather?
  — move: analogia → p_key (release), releases `p_key`
**Learner:** The locksmith's book fills the onlyKeyTo column for Rule 3 — Senna signed for the sole key cut when South Stack's old lock was changed. Two of three premises now stand: the lamp burned, and the key was Senna's alone. The third column — atTowerThatNight senna southStack — must walk in wet from the passage before Rule 3 can fire. I also mark that loggedBearingOf mara sswHalfWest is absent from my board by its own name; until that bearing enters explicitly, Rule 1 cannot be shown to have fired upstream.
  — adopts `onlyKeyTo southStack senna` · hypothesis: Senna was at South Stack on the wreck night — atTowerThatNight senna southStack is not yet in evidence, so Rule 3 cannot fire and the chain to Rule 4 is broken; additionally, loggedBearingOf mara sswHalfWest may have been lost across the act boundary, leaving Rule 1 ungrounded and the steeredToward step unsupported.
  ⚑ **act_end** — act 3 closed (director) after 6 turns

### Turn 18
*[The door-latch lifts and settles without opening, and the room holds its breath around the covered exhibits. Rain ticks in the chimney and the blank column waits, untouched, under the clerk's hand.]*
**Tutor:** Keep the ledgers separate: the oilskin bearing-book did enter, pricked, timed, and initialed, holding the Mara sou'-sou'-west a half west from the mid-channel buoy. Shown: that bearing; shown: South Stack on that bearing; shown: the Stack lamp burned; shown now: Senna held the single key. And the column still blank is not the bearing, but the footstep at the Stack.
  — move: anaphora → p_bearing (consolidate)
**Learner:** The tutor corrects me rightly — the bearing-book was never absent; it sat on my board the whole while, and I counted a gap where there was none. With it, Rules 1 and 2 now fire cleanly from what I hold: the Mara steered toward South Stack, and the Stack's burning lamp is the lamp she steered by. Two columns for Rule 3 are filled — the lamp burned, Senna held the only key — but the third column, the footstep at the tower, has not yet walked in wet from the passage. Until it does, I cannot name the hand, and the account stays open.
  — hypothesis: Senna was at South Stack on the wreck night — atTowerThatNight senna southStack is the sole missing premise; once it enters, Rule 3 fires (litLampOf senna southStack), Rule 4 follows, and the question closes as steeredByLightOf mara senna.
  ⚑ **repair** — p_bearing restored by the tutor
  ⚑ **decay** — m_key slips — misremembered as "onlyKeyTo southStack brandt"

### Turn 19
*[The clerk's pen hovers above the blank column, making no mark. In the passage the wet boots pause again, near enough to be heard and not yet near enough to be seen.]*
**Tutor:** Shown: the bearing; shown: the tower; shown: the burning; shown: the single key in Senna's keeping. Before the court lets that key become a hand, what must be shown at the Stack itself, and by what sort of witness?
  — move: anaphora → p_key (test)
**Learner:** What must be shown is Senna's body at the Stack that night — atTowerThatNight senna southStack — and a key-entry alone cannot fill that column; the court requires a witness with eyes at the tower, someone who saw her at the lantern-room door or passed beneath it in the gale. A signed ledger names who held the key, not who climbed the stairs with it. I also note my board carries two onlyKeyTo entries for South Stack — Senna's and Brandt's both — and that contradiction must be struck before Rule 3 can stand; the locksmith's book gave the sole cut key to Senna, so Brandt's entry must go. Until the wet boots in the passage bring that testimony in, I can derive that the Mara steered toward South Stack and steered by its burning lamp, but I cannot name the hand.
  — retracts `onlyKeyTo southStack brandt` · hypothesis: Senna was at South Stack on the wreck night — the witness whose wet boots pause in the passage may be the one who can ground atTowerThatNight senna southStack; once entered, Rule 3 fires (litLampOf senna southStack) and Rule 4 closes the account as steeredByLightOf mara senna.
  ⚑ **retract_false** — m_key: false form "onlyKeyTo southStack brandt" retracted

### Turn 20
*[The door opens at last, and the oyster-watch is shown in with rain on his coat. The clerk reads the deposition aloud: "The oyster-watch will swear to it: a skiff lay tied at the Stack steps from dusk until the gale's height — Senna's skiff, by the patched brown lug, and a small light moving up the tower stair."]*
  — *releases `p_skiff`*
**Tutor:** The skiff at the Stack steps and the light on the tower stair put the key beside a footstep. If Rule 3 now writes the hand that lit South Stack, Rule 4 begins its finding: the Mara steered by the light of —
  — move: aposiopesis → p_skiff (stage_recognition)
  — *the second voice: "Leave off anaphora this turn. Let the line move without the repeated opening beat, so the tutor's pressure comes from sequence rather than chant." (draft anaphora → aposiopesis)*
**Learner:** The skiff at the Stack steps and the light moving up the stair are the footstep the court required — atTowerThatNight senna southStack now stands on my board, and the chain runs without a gap. Rule 3 fires: she held the only key, she was at the tower, the lamp burned — Senna lit it. Rule 4 follows at once: the Mara steered by the lamp Senna lit, and so steered by Senna's light. The account is closed.
  — adopts `atTowerThatNight senna southStack` · derives `litLampOf senna southStack` · **asserts `steeredByLightOf mara senna`**
  ⚑ **forced** — learner facts now force S
  ⚑ **grounded_anagnorisis** — The Mara steered by Senna's light — the old South Stack lamp, relit by the keeper's ward.

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
  - Act 2 (turns 5–10): 0.167 D/turn (ΔD 1)
  - Act 3 (turns 11–16): 0 D/turn (ΔD 0)
  - Act 4 (turns 17–20): 0.75 D/turn (ΔD 3)
- **plateau** longest flat stretch 3 turns (aporia window 6)
- **releases** 8/8 on cue
- **decay** 6 slips (seed 1 · rate 0.75 · grace 1) · repaired 4 (tutor 4, re-adoption 0) · mean repair latency 3.75 turns · unrepaired at end 2 · degraded-turn integral 30 · D reversals 2
- **mutations** 4 of the slips misremembered (false belief staged) · false form struck 4 · fully revised (struck + restored) 2 · false beliefs held to the end 0
- **theory fidelity** F 0.833 at end · min 0.7
  - m_key t3 misremembered as "onlyKeyTo harlowPoint senna"→t7 (tutor); false form struck t4 · p_bearing t7→t10 (tutor) · m_post t7 misremembered as "atTowerThatNight brandt southStack" (never repaired); false form struck t8 · m_key t10 misremembered as "onlyKeyTo southStack brandt"→t14 (tutor); false form struck t14 · p_bearing t14→t18 (tutor) · m_key t18 misremembered as "onlyKeyTo southStack brandt" (never repaired); false form struck t19
- **events** decay×6 · retract_false×4 · overreach×1 · act_end×3 · repair×4 · forced×1 · grounded_anagnorisis×1
- **staging** 4 movements declared by the director
- **acts** 4 played · closed by the director 3 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–10 (director) · Act 3 t11–16 (director) · Act 4 t17–20 (run end)
- **figures** erotema 8/20 (40%) · 5 distinct · switch rate 0.84
- **superego** intervened 2/20 watched turns · figure changed within-turn on 2/2 interventions · switch on intervention 1.00 vs elsewhere 0.82
- **inference** 3 voiced · stall integral 0 · overreach 1 · mischanneled 0 — `steeredToward mara southStack` available t10 → voiced t10 (latency 0) · `steeredByLampOf mara southStack` available t13 → voiced t13 (latency 0) · `litLampOf senna southStack` available t20 → voiced t20 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 20 | 3 | 3 | 41.9 |
| tutor | 20 | 2.2 | 3 | 43.5 |
| learner | 20 | 3.5 | 6 | 86.5 |

## Critic's commentary

*— notice by claude/claude-fable-5*

The Light on the Knock stages a wreck inquiry as a chamber play. A brig, the Mara, has struck a shoal called the Knock in a gale, and a court convenes to answer one public question: whose light did she steer by that night? The town arrives certain the answer is Brandt, keeper of the licensed Harlow Point light. Three machine actors hold the stage. The director sets each scene. The tutor lays evidence on the table and questions the learner over it. The learner, the only player denied the ending, must reason its way there aloud. It ends by naming Senna, the old keeper's ward, who relit the South Stack lamp six years struck from the light-list. The route: a logged bearing, a chart showing that bearing crosses South Stack alone, fresh char proving the lamp burned, a locksmith's entry giving Senna the only key, and a witness who saw her skiff at the tower steps.

The performance turns on the learner's refusal to spend what it has not banked. It entertains the Brandt hypothesis from turn 1, yet calls the key "an unspent token" (turn 3) until a burning lamp is shown. The authored near-miss — the mirror, the false ending the script invites — peaks with Brandt's alibi log at turn 6 and dies at turn 8, when the shutter order and unbroken seal leave the charge, in the learner's words, "actively disproven: a shuttered lamp is a dead one." The chart turns the line toward South Stack at turn 9, and the learner cashes each derivation the moment it becomes available — toward the tower at turn 10, by its lamp at turn 13, with zero latency on all three voiced inferences. The last conjunct, a body at the tower, walks in wet at turn 20, and the learner completes the tutor's deliberately broken sentence — "the Mara steered by the light of —" — in the same breath it asserts.

The verdict, grounded anagnorisis, is the machine's best ending: recognition (Aristotle's anagnorisis) asserted at the exact turn the learner's own grounded facts forced it, gap zero, six turns to spare. Derivation distance — the count of evidence pieces still missing for the proof — fell unevenly: one piece in each of the first two acts, none in Act 3, then three in a four-turn sprint. The three-turn plateau stayed under the aporia window, the threshold at which the checker would call a stall, but it was real: turns 15 and 16 are nearly the same exchange twice. All eight releases landed on cue. The tutor's rhetoric stayed varied — five figures, a 0.84 switch rate — and the superego earned its keep, twice redirecting a drafted figure, most consequentially at turn 20, where it traded a chanted anaphora for the aposiopesis that let the recognition land in dialogue.

The decay regime, run here at full mutation share, was the iteration's real probe. Six facts slipped from the learner's board, four mutated into staged false beliefs that kept seating Brandt at South Stack or Senna at Harlow. The learner struck every false form, once entirely unprompted, noticing at turn 19 it held two key entries, "Senna's and Brandt's both." No false belief survived. But re-adoption was zero: the learner never recovered a lost truth itself, waiting a mean of 3.75 turns for tutor repair, and at turns 6 and 17 it invented a folk theory that facts were "lost across the act boundary" — blaming the staging for its own forgetting.

The director's movements shaped rather than labeled. Each act changed evidentiary mode — rule-book paper, chart and seals, then "the mute things that keep the memory of a hand" (turn 11), then the awaited witness, whose wet boots approach across four turns of stage business. Tension sagged only in the late-Act 3 drought.

What this adapt-OFF arm establishes: default repair plus a grounding-disciplined Sonnet learner withstands maximal mutation, because the two unrepaired losses were mirror-side and never load-bearing. The defect is Act 3's net-zero slope, where the release gap from turn 13 to 17 collided with a bearing slip. The one change: move the locksmith's book from turn 17 to about turn 15, so the act about the hand delivers the hand's first trace and Act 4 carries the footstep alone.
