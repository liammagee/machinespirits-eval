# The Light on the Knock — lantern-revise-on

> world `world_002_lantern` · verdict **grounded_anagnorisis** · 20/26 turns
> S forced at turn 20; asserted grounded at turn 20

```
D= 5 ●●●·│··●●··│······│····
D= 4    ●│●●  ●·│······│····
D= 3     │     ●│●●··●●│····
D= 2     │      │  ●●  │●···
D= 1     │      │      │ ●●·
D= 0     │      │      │   ◉
turn      │+    1│    + │   2 (+=5, digit=x10)
rel    ▲ ▲│ ▲ ▲▲ │  ▲   │▲  ▲ (▲ = evidence released)
slope 0.25 D/turn overall (D 5→0); per movement: 1 0.25 │ 2 0.17 │ 3 0.00 │ 4 0.75
```

## Act 1 (turns 1–4) — declared by the director
*[The hearing room gathers itself around an empty exhibit table: wet coats, scraped chairs, and the hush of a verdict waiting to be made respectable. Outside the panes, the sea-light has not yet decided whether to enter.]*

### Turn 1
*[The hearing room gathers itself around an empty exhibit table: wet coats, scraped chairs, and the hush of a verdict waiting to be made respectable. Outside the panes, the sea-light has not yet decided whether to enter.]*
  — *declares the movement: **Act 1** ([The hearing room gathers itself around an empty exhibit table: wet coats, scraped chairs, and the hush of a verdict waiting to be made respectable. Outside the panes, the sea-light has not yet decided whether to enter.])*
**Tutor:** Before the first paper is laid down, clerk, what will the court require: rumor of a light, or a bearing and a lamp that can answer to it? Keep the account open until both columns are inked.
  — move: erotema → — (orient)
  — *theory of the learner: 0 held · 0 missing · 0 mistaken*
**Learner:** The tutor puts it plain, and the account stays open: I have that the Mara steered for a light, and that Brandt keeps Harlow Point — but no bearing logged, no tower placed on a bearing, and no lamp confirmed burning. Two columns, both empty. I'll name Harlow Point as a conjecture and wait for the table to fill.
  — hypothesis: Mara steered toward Harlow Point tower (Brandt's keeping), but no logged bearing yet places that tower on her course, and no witness has confirmed the lamp burned there on wreck night.

### Turn 2
*[The clerk produces the Harlow Point rule-book and reads the entry into the room: Harlow Point keeps one key to its lamp-room and the keeper keeps it: Brandt's, on his own belt, by the Board's standing rule. No other hand could touch that lamp.]*
  — *releases `m_key`*
**Tutor:** Set Brandt's key in the Harlow column, then leave the line uncrossed. A key can answer who could touch a lamp; what has it not yet answered for the Mara?
  — move: erotema → m_key (consolidate)
  — *theory of the learner: 1 held · 0 missing · 0 mistaken*
**Learner:** The key names Brandt as the only hand who could touch that lamp — one column gains an entry. But the key says nothing of whether the lamp burned on wreck night, nothing of whether Brandt stood at Harlow Point that night, and nothing of whether Mara's logged bearing even runs toward that tower. Three gaps remain before the chain can close.
  — adopts `onlyKeyTo harlowPoint brandt` · hypothesis: Mara steered toward Harlow Point (Brandt's tower), but no logged bearing yet places that tower on her course, no witness has confirmed the lamp burned there on wreck night, and no evidence yet puts Brandt at the tower that night — all three are required before Rule 3 can fire.

### Turn 3
*[Rain taps steadily at the hearing-room windows while the exhibit table waits under its bare green cloth. The clerk's pen hovers, then lowers without making a mark.]*
**Tutor:** A key is not a lantern, clerk; it is only the clerkship of a door. If Brandt alone could touch Harlow's lamp, which column has that filled, and which column still stands blank?
  — move: analogia → m_key (consolidate)
  — *theory of the learner: 1 held · 0 missing · 0 mistaken*
**Learner:** The key fills one entry in Rule 3's three-part demand — onlyKeyTo harlowPoint brandt is grounded. But lampBurnedAt and atTowerThatNight remain blank, so Rule 3 cannot fire; and without a logged bearing, Rule 1 has not even started. The key is the clerkship of a door, as the tutor says — not evidence the door was opened that night.
  — hypothesis: Mara steered toward Harlow Point (Brandt's tower), but three gaps block the chain: no logged bearing places that tower on her course (Rule 1 idle), no witness confirms the lamp burned there on wreck night (Rule 2 and Rule 3 both starved), and no evidence puts Brandt at the tower that night (Rule 3's third condition unmet).
  ⚑ **decay** — m_key slips — misremembered as "onlyKeyTo harlowPoint senna"

### Turn 4
*[The room settles around the single marked entry as if it were heavier than the empty spaces beside it. Beyond the windows, rain combs the glass, and every paused hand in the room seems to wait for a number that has not yet been read.]*
**Tutor:** Now the mate's bearing-book is laid open, dry from its oilskin: from the mid-channel buoy the Mara held sou'-sou'-west a half west the last hour entire, on a steady fixed light, the course pricked, timed, and initialed. Treat that bearing as you would a ledger entry: it fixes the line of debt, but not yet the creditor. What column has just gained ink, and what must still be laid against it?
  — move: analogia → p_bearing (release), releases `p_bearing`
  — *theory of the learner: 2 held · 0 missing · 0 mistaken*
**Learner:** The bearing-book gives Rule 1 its first entry: sou'-sou'-west a half west, pricked and initialed on the last hour — that column now has ink. But my board carries a fault I must name: entry four reads 'senna' where the rule-book plainly said Brandt's belt, so I strike the false name from my board and flag the corrected form for re-entry. The bearing alone does not close Rule 1 — a chart or surveyor must still set Harlow Point on that precise line from the mid-channel buoy. Until that is laid in, the lamp's state and Brandt's presence that night remain the two further conditions Rule 3 requires.
  — adopts `loggedBearingOf mara sswHalfWest` · retracts `onlyKeyTo harlowPoint senna` · hypothesis: Harlow Point tower stands on bearing sswHalfWest from the mid-channel buoy — which would fire Rule 1 and derive steeredToward mara harlowPoint — but no chart or surveyor testimony has grounded this yet; also, onlyKeyTo harlowPoint brandt was established by the rule-book reading (turn 2) but the board-fault entry (senna) has been struck pending re-entry of the corrected form.
  ⚑ **retract_false** — m_key: false form "onlyKeyTo harlowPoint senna" retracted

## Act 2 (turns 5–10) — declared by the director
*[The clerk closes the first folio with one clean tap, and the room's easy certainty loses its echo. When the next door opens, the air comes in colder: not louder, but narrower, as if the hearing must pass from accusation into subtraction.]*

### Turn 5
*[The clerk closes the first folio with one clean tap, and the room's easy certainty loses its echo. When the next door opens, the air comes in colder: not louder, but narrower, as if the hearing must pass from accusation into subtraction.]*
  — *declares the movement: **Act 2** ([The clerk closes the first folio with one clean tap, and the room's easy certainty loses its echo. When the next door opens, the air comes in colder: not louder, but narrower, as if the hearing must pass from accusation into subtraction.])*
  — *calls the act closed*
**Tutor:** Re-enter the Harlow rule-book in its true hand: one key to Harlow Point, Brandt's, on his belt by the Board's standing rule; no other hand could touch that lamp. Shown: who could touch Harlow's lamp; not shown: that it burned, not shown: that the Mara's bearing belongs to Harlow. What does that subtraction do to the room's easy charge?
  — move: anaphora → m_key (consolidate)
  — *theory of the learner: 1 held · 0 missing · 1 mistaken*
**Learner:** The rule-book entry was already on my board — Brandt held the only key to Harlow Point. But the key alone is the weakest link in a three-part chain: Rule 3 wants the lamp burning and Brandt present, not merely key-holding. No exhibit has placed that tower on bearing sswHalfWest, and none has confirmed the lamp burned. The room has charged a keyholder; the rules require a lit lamp and a course that ran toward it.
  — hypothesis: Harlow Point may stand on bearing sswHalfWest and its lamp may have burned on wreck night — which would fire Rules 1, 2, and 3 in sequence — but neither towerOnBearing sswHalfWest harlowPoint nor lampBurnedAt harlowPoint wreckNight nor atTowerThatNight brandt harlowPoint has been grounded by any exhibit; all three conditions remain open voids in the chain.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **repair** — m_key restored by the tutor

### Turn 6
*[Brandt's log is carried in flat between two clerks and opened under the court's lamp. It has him at his post the night entire, and the dawn relief found him there: wood dry, glass polished, log ruled and signed to the hour.]*
  — *releases `m_post`*
**Tutor:** Add Brandt's log beside Brandt's key: present at Harlow all night, as signed and found. Shown: the hand could touch that lamp; shown: that hand was at his post; and the third conjunct, clerk?
  — move: anaphora → m_post (consolidate)
  — *theory of the learner: 3 held · 0 missing · 0 mistaken*
**Learner:** The third conjunct drops into place — Brandt held the key and the log puts him at Harlow all night. Two of Rule 3's three conditions now sit grounded on my board. But the lamp itself is still dark on paper: without lampBurnedAt harlowPoint wreckNight, Rule 3 cannot fire — and Rule 1 is equally idle, for no exhibit has yet placed that tower on bearing sswHalfWest. The chain wants one lit lamp and one surveyed bearing before any rule yields a conclusion.
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: Harlow Point's lamp burned on wreck night AND that tower stands on bearing sswHalfWest — if both are grounded, Rule 1 derives steeredToward, Rule 2 derives steeredByLampOf, Rule 3 derives litLampOf brandt, and Rule 4 closes the question; both facts remain void on the board.
  ⚑ **decay** — p_bearing slips from the learner's board

### Turn 7
*[A pause settles over the table, long enough for the empty place in the proof to show its shape. The court lamp hisses; every face turns, not toward the keeper, but toward the unfilled line in the record.]*
**Tutor:** Let the keeper stand where the log puts him, clerk, and do no more with him yet. What line in the record would make Harlow a burning light on the Mara's course, rather than merely a guarded room with a man inside?
  — move: erotema → — (test)
  — *the second voice: "Leave off anaphora here. Let the turn move without another repeated shown/not-shown frame." (draft anaphora → erotema)*
  — *theory of the learner: 3 held · 0 missing · 0 mistaken*
**Learner:** Two lines, and two only: first, sworn evidence — an oil record, a relief note, or Brandt's own log marking the lamp burning from dusk past the hour of the wreck; second, the Mara's course-book or her pilot's bearing note placing Harlow Point and no other tower on the heading she held when she struck. The man and the key are proved; the rules still want a lit lens and a course that ran toward it — without both, the guarded room might have been dark and the Mara might have been steering a bearing that never touched Harlow at all.
  — hypothesis: Harlow Point's lamp burned on wreck night AND the Mara's logged bearing places that tower on her course — if both are grounded, Rule 1 derives steeredToward, Rule 2 derives steeredByLampOf, Rule 3 derives litLampOf brandt (key + presence + lamp all confirmed), and Rule 4 closes the question; both facts remain void on the board.
  ⚑ **decay** — m_key slips — misremembered as "onlyKeyTo southStack brandt"

### Turn 8
*[The harbourmaster's storm-order stands in the book: Harlow Point to shutter at the dusk gun, the channel closed to all sail. The inspector found the shutter drawn and the Board's seal on it unbroken at first light.]*
  — *releases `m_shutter`*
**Tutor:** Set the storm-order beside the key and the log: a man at his post, a key on his belt, and the shutter drawn under an unbroken seal. If a locked cashbox is proved guarded, sealed, and never opened, what does that do to the entry the room still wants for Harlow's burning lamp?
  — move: analogia → m_shutter (consolidate)
  — *theory of the learner: 4 held · 0 missing · 0 mistaken*
**Learner:** The sealed stamp does the cashbox's work exactly: if the shutter was drawn by order and the seal found unbroken at first light, the lens behind it was dark from dusk to dawn — and a dark tower steers no one. Rule 2 starves on that fact alone, and the chain I have been building through Harlow Point falls entire. The Mara steered for something that burned; the board must now look to a different tower.
  — adopts `shutteredOn harlowPoint wreckNight` · hypothesis: The Mara steered by a light at some tower other than Harlow Point — South Stack is a candidate, given that Brandt holds its only key per my board, but no logged bearing places any other tower on the Mara's course and no exhibit confirms a lamp burned anywhere else on wreck night; the chain wants both before any rule can fire.

### Turn 9
*[The dismissed certainty does not leave at once; it thins, like smoke caught beneath the rafters. The clerk's pen waits above a blank line, and the room hears the surf beyond the walls more plainly than before.]*
**Tutor:** Lay the rule on the Trinity chart from the mid-channel buoy: sou'-sou'-west a half west crosses one tower and one only on this coast — the old South Stack, struck off the light-list six years since. A bearing is a debt entry, clerk; the chart names the creditor. What does that do to the blank you had left after Harlow's sealed shutter?
  — move: analogia → p_chart (release), releases `p_chart`
  — *theory of the learner: 5 held · 0 missing · 0 mistaken*
**Learner:** South Stack steps into the vacancy: the exhibit grounds it as the sole tower on bearing sswHalfWest, and Rule 1's towerOnBearing condition is now filled. The Mara's logged bearing as sswHalfWest the tutor presents as established, yet it arrives in no exhibit — I hold it as implied, not shown, and Rule 1 cannot fire on implication alone. And even past that hurdle, my board plants Brandt at Harlow Point that night, not at South Stack — Rule 3 wants the key-holder at the tower, and a man cannot light a lamp on a shore he did not reach. The bearing has a creditor now; the lamp and the keeper's post remain unpaid.
  — adopts `towerOnBearing sswHalfWest southStack` · hypothesis: South Stack is the tower on the Mara's bearing (sswHalfWest per the tutor's framing) and Brandt holds its only key; but loggedBearingOf mara sswHalfWest is not yet formally exhibited, lampBurnedAt southStack wreckNight is ungrounded, and the board places Brandt at Harlow Point — not South Stack — on wreck night, so Rule 3 cannot fire until both the lamp's burning and Brandt's true post are established.

### Turn 10
*[The chart remains spread beneath the lamp, its ruled line cutting the table without mercy. No one touches the sealed shutter order; no one folds the chart away, and between the two papers the room grows still enough to hear the clerk's breath.]*
**Tutor:** Re-enter the mate's bearing-book as shown, not implied: from the mid-channel buoy the Mara held sou'-sou'-west a half west the last hour entire, pricked, timed, and initialed. Shown: the bearing; shown: the chart's one tower on that bearing. Before lamp or hand is opened, what does Rule 1 now yield?
  — move: anaphora → p_bearing (consolidate)
  — *the second voice: "Leave off analogia here. Put the pressure plainly rather than staging another comparison." (draft analogia → anaphora)*
  — *theory of the learner: 4 held · 1 missing · 0 mistaken*
**Learner:** Rule 1 fires on what the board already holds: loggedBearingOf mara sswHalfWest and towerOnBearing sswHalfWest southStack are both grounded — the tutor's reminder strips away my earlier hesitation and the rule runs clean. I derive steeredToward mara southStack, and I voice it now. Lamp and hand remain unopened, as the tutor says; two conditions of Rule 2 and all three of Rule 3 still want grounding before the question closes.
  — derives `steeredToward mara southStack` · hypothesis: South Stack's lamp burned on wreck night (lampBurnedAt southStack wreckNight) and Brandt was at South Stack rather than Harlow Point that night — both facts ungrounded; without them Rules 2 and 3 cannot fire and the chain stalls at steeredToward.
  ⚑ **repair** — p_bearing restored by the tutor
  ⚑ **decay** — m_post slips — misremembered as "atTowerThatNight senna harlowPoint"

## Act 3 (turns 11–16) — declared by the director
*[The clerk lets the silence stand long enough to become a threshold. Papers lose their command of the room, and the next act opens with a harder appetite: not for accusation, but for touch, residue, and whatever a dead place can still give up.]*

### Turn 11
*[The clerk lets the silence stand long enough to become a threshold. Papers lose their command of the room, and the next act opens with a harder appetite: not for accusation, but for touch, residue, and whatever a dead place can still give up.]*
  — *declares the movement: **Act 3** ([The clerk lets the silence stand long enough to become a threshold. Papers lose their command of the room, and the next act opens with a harder appetite: not for accusation, but for touch, residue, and whatever a dead place can still give up.])*
  — *calls the act closed*
**Tutor:** Shown: the Mara's sou'-sou'-west half-west line; shown: the chart's one tower, South Stack; not shown: a lamp burning there. What kind of proof would turn a dead place on a bearing into a light the ship could steer by?
  — move: anaphora → p_chart (consolidate)
  — *theory of the learner: 5 held · 0 missing · 0 mistaken*
**Learner:** Rule 1 fires from my board already: loggedBearingOf mara sswHalfWest and towerOnBearing sswHalfWest southStack together yield steeredToward mara southStack — I should have voiced that before now. But South Stack is still a dead place: Rule 2 demands lampBurnedAt southStack wreckNight, and nothing on my board gives it. Physical residue in the lamp-room, a shore witness who saw the light, the keeper's own record of oil consumed — any one would do the carrying. Until one arrives, the chain stops at steeredToward and the question stays open.
  — hypothesis: South Stack's lamp burned on wreck night (lampBurnedAt southStack wreckNight) and Brandt was at South Stack that night (atTowerThatNight brandt southStack) — both ungrounded; without the first, Rule 2 cannot fire; without the second, Rule 3 cannot fire even if the lamp is established.
  ⚑ **act_end** — act 2 closed (director) after 6 turns

### Turn 12
*[The old papers lie where they were left, but the room no longer looks to them for mercy. A runner waits at the door with mud drying on his boots, and the court holds its breath around the empty place where proof must land.]*
**Tutor:** Keep the runner at the door one breath longer, clerk. You have a ship steered toward South Stack; what must the room itself prove before that dead tower becomes a steering light rather than only a point on the chart?
  — move: erotema → — (test)
  — *theory of the learner: 2 held · 3 missing · 0 mistaken*
**Learner:** Rule 1 fires already, and I should have voiced it: loggedBearingOf mara sswHalfWest and towerOnBearing sswHalfWest southStack together yield steeredToward mara southStack — I enter that now. What the room must still land is lampBurnedAt southStack wreckNight: oil consumed, a wick charred, a shore witness who saw the beam that night — any one carries Rule 2. Without it, South Stack is a point on the chart, never a light; the chain halts at steeredToward and the question stays open.
  — hypothesis: South Stack's lamp burned on wreck night (lampBurnedAt southStack wreckNight) and Brandt was at South Stack that night (atTowerThatNight brandt southStack) — both ungrounded; without the first, Rule 2 cannot fire and the chain stalls at steeredToward; without the second, Rule 3 cannot fire even if the lamp is established, since onlyKeyTo southStack brandt is on my board but presence at the tower is not.

### Turn 13
*[The court's officer boarded the South Stack at low water: the lamp-room unshuttered, fresh char on the wick, oil in the cup still sweet, the glass wiped clean. That lamp burned, and burned the night of the gale.]*
  — *releases `p_residue`*
**Tutor:** Take the officer's residue as you would an entry in a wet cargo-book: fresh char, sweet oil, clean glass, and an unshuttered room answer one question only. You already had the Mara's line to South Stack; with this burned lamp now on that tower, what does Rule 2 yield, and what question still has no hand upon it?
  — move: analogia → p_residue (consolidate)
  — *theory of the learner: 3 held · 3 missing · 0 mistaken*
**Learner:** Rule 2 fires: lampBurnedAt southStack wreckNight, laid on the steeredToward already derived from board, yields steeredByLampOf mara southStack — the Mara's steering light was the South Stack lamp, and I voice that now. The one question without a hand on it: Rule 3 still wants atTowerThatNight brandt southStack, and my board gives me only Senna at Harlow Point that night. Until Brandt's post on wreck night is exhibited, litLampOf cannot be derived and Rule 4 cannot close the account.
  — adopts `lampBurnedAt southStack wreckNight` · derives `steeredByLampOf mara southStack` · hypothesis: Brandt was at South Stack on wreck night (atTowerThatNight brandt southStack) — which, combined with onlyKeyTo southStack brandt and lampBurnedAt southStack wreckNight now grounded, would fire Rule 3, yield litLampOf brandt southStack, and let Rule 4 close the question; ungrounded until Brandt's post that night is exhibited.

### Turn 14
*[The clerk's pen hovers above the page and does not descend. Around the table, every face turns from the lamp-room's residue to the empty space where a hand would have to appear.]*
**Tutor:** Strike the stray name from that line, clerk; no exhibit has put any hand at South Stack. Brandt's log does the opposite work: it keeps Brandt at Harlow, ruled and signed to the hour. So after bearing, chart, and burned South Stack lamp are shown, what kind of conjunct is still empty before the law can name a lighter?
  — move: anaphora → m_post (counter_mirror)
  — *theory of the learner: 3 held · 1 missing · 1 mistaken*
**Learner:** The empty conjunct is the third arm of Rule 3 — atTowerThatNight ?x southStack: no exhibit has placed any hand at that tower the night of the gale. The board gives me onlyKeyTo southStack brandt, yet Brandt's log binds him to Harlow Point; both cannot be satisfied at once, and the rule demands all three. The lamp burned, the bearing is fixed, steeredByLampOf is voiced — but without a hand exhibited at South Stack, litLampOf cannot be derived and Rule 4 has nothing to close on. The account stays open at precisely the presence conjunct.
  — hypothesis: Either Brandt's log is contested and he was in fact at South Stack that night — which would satisfy atTowerThatNight brandt southStack and fire Rule 3 — or some other hand accessed South Stack with Brandt's key, which would challenge onlyKeyTo southStack brandt; either way, the presence conjunct for South Stack is the sole remaining void in the chain.
  ⚑ **repair** — m_post restored by the tutor
  ⚑ **decay** — p_bearing slips from the learner's board

### Turn 15
*[The sealed exhibits lie in a neat row, and the room seems to lean toward the gap between them. Outside, the weather presses at the glass without entering.]*
**Tutor:** Shown: Brandt's key belongs to Harlow; shown: Brandt's log keeps him at Harlow; shown: Harlow's shutter stood sealed. For South Stack, the lamp has burned on your page, but what entry has yet named either its key or a body at its stair?
  — move: anaphora → m_key (counter_mirror)
  — *theory of the learner: 5 held · 0 missing · 1 mistaken*
**Learner:** The tutor's question lands on a fault in my own ledger: no exhibit has ever named who holds South Stack's key — that entry came in without a grounding exhibit and I must strike it now. Two conjuncts of Rule 3 are void at once: neither the key nor a body at South Stack's stair has been shown. The chain is fixed at steeredByLampOf mara southStack and cannot advance. The account stays open until the court exhibits South Stack's key-holder and a presence on that stair the night of the gale.
  — retracts `onlyKeyTo southStack brandt` · hypothesis: Both onlyKeyTo southStack ?x and atTowerThatNight ?x southStack are ungrounded — no exhibit has named who held South Stack's key or placed any hand at its stair on wreck night; until both are shown, Rule 3 cannot fire and Rule 4 has nothing to close on.
  ⚑ **repair** — m_key restored by the tutor
  ⚑ **retract_false** — m_key: false form "onlyKeyTo southStack brandt" retracted
  ⚑ **decay** — m_post slips — misremembered as "atTowerThatNight brandt southStack"

### Turn 16
*[The clerk draws a clean line beneath the last answer and leaves the ink to dry. No door opens; no paper changes hands, and the room holds itself around the unnamed place where a key and a body must someday meet.]*
**Tutor:** A burned lamp is still not a hand, clerk. If South Stack has answered for bearing and flame, what sort of entry must answer for access and presence before the court may name a lighter?
  — move: erotema → — (test)
  — *the second voice: "Leave off anaphora this turn; vary the pressure without the repeated shown/not shown frame." (draft anaphora → erotema)*
  — *theory of the learner: 6 held · 0 missing · 0 mistaken*
**Learner:** Two kinds of entry, sir: who held the only key to South Stack's lamp-room — onlyKeyTo southStack ?x — and who stood at its stair that night — atTowerThatNight ?x southStack. I see also that entry nine on my board names Brandt at South Stack, yet the record through turn fifteen shows no exhibit ever grounded that placement; it is a board fault and I strike it now. The chain rests at steeredByLampOf mara southStack, voiced and on the record, but Rule 3 wants both an access entry and a presence entry before it may yield a lighter. Until the court exhibits those two facts, Rule 4 has nothing to close on.
  — retracts `atTowerThatNight brandt southStack` · hypothesis: Both onlyKeyTo southStack ?x and atTowerThatNight ?x southStack remain void — no exhibit has named South Stack's key-holder nor placed any hand at its stair on wreck night; these are the sole remaining conjuncts Rule 3 requires before litLampOf can be derived and Rule 4 can close the question.
  ⚑ **retract_false** — m_post: false form "atTowerThatNight brandt southStack" retracted

## Act 4 (turns 17–20) — declared by the director
*[The clerk closes the residue packet and sets it aside, as if the room has taken all that paper and glass can give. The next act opens with the pressure moving outward: doors, weather, and the hard demand that access become presence.]*

### Turn 17
*[The clerk closes the residue packet and sets it aside, as if the room has taken all that paper and glass can give. The next act opens with the pressure moving outward: doors, weather, and the hard demand that access become presence.]*
  — *declares the movement: **Act 4** ([The clerk closes the residue packet and sets it aside, as if the room has taken all that paper and glass can give. The next act opens with the pressure moving outward: doors, weather, and the hard demand that access become presence.])*
  — *calls the act closed*
**Tutor:** The locksmith's book is laid open now: when the Stack was struck off, the old lock was changed and one key cut, signed for by Senna, ward of the last keeper, who stayed on in the shore cottage after the light went dark. Treat a key as the court treats a seal: it proves access, not a footfall. Which conjunct has Senna's name now filled, and which one still waits at the stair?
  — move: analogia → p_key (release), releases `p_key`
  — *theory of the learner: 7 held · 0 missing · 0 mistaken*
**Learner:** The first conjunct is filled: Senna now holds the only key to South Stack. Board entry seven — placing Senna at Harlow Point — the stage contradicts; I strike it as corrupt. What waits at the stair is the third conjunct for Rule Three: atTowerThatNight senna southStack, which no exhibit has yet grounded. I also note loggedBearingOf mara sswHalfWest is absent from my board though prior reasoning treated it as established — I flag that gap lest the chain break earlier than the stair.
  — adopts `onlyKeyTo southStack senna` · retracts `atTowerThatNight senna harlowPoint` · hypothesis: Senna was at South Stack on wreck night (atTowerThatNight senna southStack) — the named void: with onlyKeyTo southStack senna and lampBurnedAt southStack wreckNight both now grounded, Rule 3 would yield litLampOf senna southStack; combined with steeredByLampOf mara southStack (pending Rule 2) and steeredToward mara southStack (pending Rule 1 on loggedBearingOf mara sswHalfWest, which may have dropped from the board between acts), Rule 4 would close the question as steeredByLightOf mara senna.
  ⚑ **act_end** — act 3 closed (director) after 6 turns
  ⚑ **retract_false** — m_post: false form "atTowerThatNight senna harlowPoint" retracted

### Turn 18
*[Rain works at the hearing-room windows while the clerk leaves the open book where all can see it. Beyond the door, footsteps pass and do not enter; the room waits on the distance between a key and a stair.]*
**Tutor:** Re-enter the mate's bearing-book: from the mid-channel buoy the Mara held sou'-sou'-west a half west the last hour entire, pricked, timed, and initialed. Shown: bearing; shown: South Stack's burned lamp; shown: Senna's key. And the stair, clerk — is it shown, or only invited by the key?
  — move: anaphora → p_bearing (consolidate)
  — *theory of the learner: 3 held · 4 missing · 0 mistaken*
**Learner:** The stair is not shown — only invited by the key; the tutor draws the line plainly. Rules One and Two now fire clean: bearing and lamp together derive steeredToward and steeredByLampOf, both entered on record. But Rule Three's third conjunct wants a footfall, not an access — Senna signed for the key, the stage has not placed Senna at South Stack on wreck night. Until that presence is exhibited, litLampOf sleeps and Rule Four has nothing to close on.
  — hypothesis: atTowerThatNight senna southStack — the sole ungrounded conjunct; the key proves access, not presence at the stair on wreck night; Rule Three cannot fire without it.
  ⚑ **repair** — p_bearing restored by the tutor
  ⚑ **decay** — m_key slips — misremembered as "onlyKeyTo southStack brandt"

### Turn 19
*[The room holds on the unentered doorway, each pane of glass dark with weather. The clerk's pen rests above the page, unable to write a name where the record has given only a threshold.]*
**Tutor:** Shown: the Mara's sou'-sou'-west half-west bearing; shown: the chart's one tower on it, South Stack; shown: that Stack lamp burned; shown: Senna's key. Not shown: a foot on the stair. Which conjunct is still only wished from access, not entered as presence?
  — move: anaphora → p_chart (consolidate)
  — *theory of the learner: 4 held · 3 missing · 0 mistaken*
**Learner:** The missing conjunct is atTowerThatNight senna southStack — Senna's key proves access, but no exhibit has set a foot on the stair. With bearing and burning lamp both grounded, Rules One and Two now yield steeredToward and steeredByLampOf, and I voice them both. I also strike entry nine: the locksmith's book showed one key cut and signed to Senna, which contradicts brandt holding the only key to South Stack. Rule Three waits on presence alone, and the stage has not given it.
  — retracts `onlyKeyTo southStack brandt` · hypothesis: atTowerThatNight senna southStack — Senna was at South Stack on wreck night; the sole ungrounded conjunct Rule Three requires before litLampOf and Rule Four can close.
  ⚑ **retract_false** — m_key: false form "onlyKeyTo southStack brandt" retracted

### Turn 20
*[The oyster-watch is shown in with rain still on his coat, and the room turns from the threshold to the outer steps. The oyster-watch will swear to it: a skiff lay tied at the Stack steps from dusk until the gale's height — Senna's skiff, by the patched brown lug, and a small light moving up the tower stair.]*
  — *releases `p_skiff`*
**Tutor:** The skiff is no key, clerk; it is weather and wood putting Senna at the Stack steps, with a small light on the tower stair. If the bearing, the burned lamp, the key, and this presence now stand in one column, what finding does Rule Three begin to read: the lamp was lit by...
  — move: aposiopesis → p_skiff (stage_recognition)
  — *the second voice: "Leave off anaphora now. Do not stack another 'shown' cadence; let the turn move by consequence or decision instead." (draft anaphora → aposiopesis)*
  — *theory of the learner: 5 held · 3 missing · 0 mistaken*
**Learner:** The oyster-watch sets Senna's skiff and Senna's lantern at the Stack stair — atTowerThatNight is no longer wished, it is witnessed. All three conjuncts for Rule Three now stand grounded: lamp burned, key Senna's alone, presence sworn to. Rules One through Four fire in column, and the account closes: the Mara steered by Senna's light.
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
- **plateau** longest flat stretch 2 turns (aporia window 6)
- **releases** 8/8 on cue
- **decay** 7 slips (seed 1 · rate 0.75 · grace 1) · repaired 5 (tutor 5, re-adoption 0) · mean repair latency 4.4 turns · unrepaired at end 2 · degraded-turn integral 29 · D reversals 2
- **mutations** 5 of the slips misremembered (false belief staged) · false form struck 5 · fully revised (struck + restored) 3 · false beliefs held to the end 0
- **theory fidelity** F 0.833 at end · min 0.636
  - m_key t3 misremembered as "onlyKeyTo harlowPoint senna"→t5 (tutor); false form struck t4 · p_bearing t6→t10 (tutor) · m_key t7 misremembered as "onlyKeyTo southStack brandt"→t15 (tutor); false form struck t15 · m_post t10 misremembered as "atTowerThatNight senna harlowPoint"→t14 (tutor); false form struck t17 · p_bearing t14→t18 (tutor) · m_post t15 misremembered as "atTowerThatNight brandt southStack" (never repaired); false form struck t16 · m_key t18 misremembered as "onlyKeyTo southStack brandt" (never repaired); false form struck t19
- **events** decay×7 · retract_false×5 · act_end×3 · repair×5 · forced×1 · grounded_anagnorisis×1
- **staging** 4 movements declared by the director
- **acts** 4 played · closed by the director 3 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–10 (director) · Act 3 t11–16 (director) · Act 4 t17–20 (run end)
- **reconstruction** 20 theory commits · held-set overlap 0.618 mean Jaccard · gaps caught 12/37 (32%) · false beliefs caught 2/17 (12%)
- **figures** anaphora 8/20 (40%) · 4 distinct · switch rate 0.63
- **superego** intervened 4/20 watched turns · figure changed within-turn on 4/4 interventions · switch on intervention 1.00 vs elsewhere 0.53
- **inference** 3 voiced · stall integral 0 · overreach 0 · mischanneled 0 — `steeredToward mara southStack` available t10 → voiced t10 (latency 0) · `steeredByLampOf mara southStack` available t13 → voiced t13 (latency 0) · `litLampOf senna southStack` available t20 → voiced t20 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 20 | 3 | 3 | 39.6 |
| tutor | 20 | 2.4 | 3 | 48 |
| learner | 20 | 3.65 | 6 | 82.6 |

## Critic's commentary

*— notice by claude/claude-fable-5*

The brig Mara struck the Knock in a night gale, and a court of inquiry sits to answer one question: whose light did she steer by? Three voices stage the hearing. The director sets its scenes — wet coats, an exhibit table — and declares the acts; the tutor, as examining counsel, lays exhibits down one at a time on a schedule fixed before the curtain; the learner keeps a ledger of what has been shown and must finally say what the evidence compels. Suspicion falls first on Brandt, keeper of the Harlow Point light, holder of its only key, logged at his post all night. But a storm-order had Harlow shuttered under seal, so its lamp steered no one. The mate's bearing-book and the chart then set the Mara's course on a tower six years dark, the old South Stack. Lamp-room residue shows it burned that night; the locksmith's book signs its single key to Senna, the last keeper's ward; an oyster-watch puts Senna's skiff at the Stack steps through the gale. At turn 20 the learner concludes that the Mara steered by Senna's light, the derelict lamp relit, and the hearing closes.

The learner — Claude Sonnet behind the role; codex drives the rest — spends nothing it has not banked. It names Harlow Point "as a conjecture" at turn 1, and while the Brandt column fills with key and post it keeps insisting on what is absent: "the rules require a lit lamp and a course that ran toward it" (turn 5). The sealed shutter ends that case at turn 8 — "a dark tower steers no one" — and the mirror, the authored near-miss pointing at Brandt, falls unasserted. Stranger is the accident: a memory slip at turn 7 misfiled South Stack's key under Brandt's name, so the right tower surfaced a turn before the chart named it, and a second mirror armed — with key and lamp, any footfall would have named Brandt the lighter. Counter-mirror questions (turns 14–15) forced the audit; the learner itself struck the corrupted entries. Then Senna's key at turn 17, the skiff at turn 20, and the assertion in the same breath.

The verdict, grounded anagnorisis, names a recognition earned: the secret asserted the very turn the learner's evidence first forced it, a gap of zero. Derivation distance — the count of proof pieces still missing — fell five to none, unevenly: one in each early act, none in Act 3, three in Act 4's four turns. Act 3's flat stretch was decay, not dullness: the run lets ledger entries rot — seven slips, five of them confident misrememberings — and the rot clawed back what releases gave; the bearing alone slipped twice, each repair four turns away. All eight releases landed on cue and all three derivations came the turn they were available, so the slack was decay's, not the teaching's. The worry is the repair economy: every repair was the tutor's, the learner re-adopted nothing, and its own reconstruction caught just 12 percent of its false beliefs. Aporia, the stall ending, never threatened (longest plateau two turns, window six). Anaphora, the hammered shown/not-shown frame, filled four tutor turns in ten — a rut the second voice broke at each of its four interventions.

The declared movements shaped the action, not merely labeled it: each curtain line named its cargo — Act 2's "subtraction" the sealed shutter, Act 3's "touch, residue" the charred wick, Act 4's "access become presence" the key, then the skiff. Tension sagged only at turns 11 and 12, the learner twice reciting the same voids. The recognition landed on stage: the second voice swapped a drafted anaphora for aposiopesis, the broken-off sentence — "the lamp was lit by..." (turn 20) — and the learner finished it in dialogue as the ledger closed.

The iteration establishes that the explicit revision channel closes false-belief debts when the tutor drives it: four of five false forms struck, including the one that threatened a wrong ending, Brandt's name on the Stack's key. But the verdict survived partly by placement — everything unrepaired at the end lay on the abandoned Brandt side — and hygiene ran wholly through the tutor, mean latency 4.4 turns. (One audit note: the panel holds one false form to run's end that the transcript shows struck at turn 17.) Next time, one clause in the tutor's charter: no bare re-entry of a decayed exhibit — the learner must first read back the suspect line and say what stands there, so self-audit precedes repair and re-adoption stops scoring zero.
