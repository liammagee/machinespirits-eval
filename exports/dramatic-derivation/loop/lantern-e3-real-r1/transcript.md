# The Light on the Knock — lantern-e3-real-r1

> world `world_002_lantern` · verdict **disengagement** · 24/26 turns

```
D= 5 ●●●·│······│·····│·····│···│·
D= 4    ●│●●●●··│·····│·····│···│·
D= 3     │    ●●│●●···│·····│···│·
D= 2     │      │  ●●·│··●●·│···│·
D= 1     │      │    ●│●●  ●│●●●│●
D= 0     │      │     │     │   │ 
turn      │+    1│    +│    2│   │  (+=5, digit=x10)
rel    ▲ ▲│ ▲ ▲▲ │  ▲ ▲│    ▲│   │  (▲ = evidence released)
slope 0.17 D/turn overall (D 5→1); per movement: 1 0.25 │ 2 0.17 │ 3 0.40 │ 4 0.00 │ 5 0.00 │ 6 0.00
```

## Act 1 (turns 1–4) — declared by the director
*[The hearing room gathers itself under a low, wavering light; wet coats steam at the walls, and every face turns toward the empty place where the wreck will be made to speak. Outside, the weather presses on the glass as if it too has come to listen.]*

### Turn 1
*[The hearing room gathers itself under a low, wavering light; wet coats steam at the walls, and every face turns toward the empty place where the wreck will be made to speak. Outside, the weather presses on the glass as if it too has come to listen.]*
  — *declares the movement: **Act 1** ([The hearing room gathers itself under a low, wavering light; wet coats steam at the walls, and every face turns toward the empty place where the wreck will be made to speak. Outside, the weather presses on the glass as if it too has come to listen.])*
**Tutor:** Take your place by the board, clerk. Before any name is fit for ink, what must this court first learn from the wreck's own papers?
  — move: erotema → — (orient)
**Learner:** The papers, sir — above all, the Mara's log: her last recorded bearing before she struck. Without it, Rule One will not open; we cannot say which tower she steered toward, and all that follows hangs on that single line of ink. We know she steered for a light, but the court wants the bearing, not the town's talk.
  — hypothesis: The Mara's logged bearing will place Harlow Point — and therefore Brandt's lamp — on her steered line; but this is supposition until the log is produced.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[The clerk produces the Board's standing rule, its seal dulled by damp fingers: Harlow Point keeps one key to its lamp-room and the keeper keeps it: Brandt's, on his own belt, by the Board's standing rule. No other hand could touch that lamp.]*
  — *releases `m_key`*
**Tutor:** A key-rule is only a locked door, not a voyage. Put Brandt's belt where it belongs on the board: what question can it answer, and what question can it not answer until the Mara's own line of ink is read?
  — move: analogia → m_key (consolidate)
**Learner:** The key-rule is a fine gift, sir: it tells us Brandt alone could have touched that lamp — no second hand, no borrowed key. But it answers only the third rule's question; it cannot open the first. Until the log puts a bearing on the board and we know Harlow Point stands on that very line, we cannot say the Mara steered toward Brandt's tower at all. The belt waits; the log must speak first.
  — adopts `onlyKeyTo harlowPoint brandt` · hypothesis: The Mara's logged bearing will place Harlow Point on her steered line, and the lamp burned that night, and Brandt was at the tower — but all three remain supposition until the log and further witnesses are produced.

### Turn 3
*[The room settles into the scrape of chairs and the soft ticking of rain from the eaves; the empty place on the table seems larger for the paper not yet laid there. The clerk's hand hovers above the docket, waiting for the next name to be called.]*
**Tutor:** Good: a locked door does not tell us which sea-road the Mara took. If the next paper is the ship's own, what single kind of entry must you make it yield before any tower or hand can be weighed?
  — move: erotema → — (consolidate)
**Learner:** A bearing, sir — one compass bearing, logged on the night she struck, nothing more and nothing less. That single entry is the key to Rule One: only when the log names a bearing can we ask which tower stands upon it. Until that figure is on the board, every key and every hand is dead weight — we cannot move an inch toward the answer. The log must yield its bearing before the court can weigh anything else.
  — hypothesis: The Mara's log will yield a bearing (loggedBearingOf mara ?b) such that Harlow Point is the sole tower on that bearing from the channel — but this remains supposition until the log is produced and the chart consulted.

### Turn 4
*[The rain thickens against the panes, blurring the harbor lamps into pale smears while the court waits on an absent page. A clerk trims the wavering flame, and for a moment every shadow in the room leans toward the bare space on the table.]*
**Tutor:** Here is the mate's bearing-book, dry from its oilskin: from the mid-channel buoy the Mara held sou'-sou'-west a half west the last hour entire, on a steady fixed light, pricked, timed, and initialed. Treat it as you would a ledger entry: what debt does that bearing now put before Rule One, and what has it still not paid?
  — move: analogia → p_bearing (release), releases `p_bearing`
**Learner:** The bearing is on the board at last — sou'-sou'-west a half west, pricked and initialed, good as any ledger figure. Rule One's first term is paid: the Mara's line of ink is known. But Rule One demands two terms, not one: the bearing, and the name of the tower that stands sole upon it from mid-channel. Until the chart or a surveyor's testimony tells us which tower — if any, and if only one — sits on that heading, we cannot write 'steeredToward' for any hand at all. The bearing has opened the door; the chart must name the room.
  — adopts `loggedBearingOf mara sswHalfWest` · hypothesis: Harlow Point tower stands sole on bearing sswHalfWest from the mid-channel buoy — which would satisfy Rule One's second term and ground 'steeredToward mara harlowPoint' — but this requires chart or survey testimony not yet before the court.

## Act 2 (turns 5–10) — declared by the director
*[The hearing room changes its breath; the earlier certainty dulls under the same low flame, and the papers already laid down seem less like an answer than a door left standing ajar. Outside, the storm holds its pressure on the glass while the next witness waits beyond it.]*

### Turn 5
*[The hearing room changes its breath; the earlier certainty dulls under the same low flame, and the papers already laid down seem less like an answer than a door left standing ajar. Outside, the storm holds its pressure on the glass while the next witness waits beyond it.]*
  — *declares the movement: **Act 2** ([The hearing room changes its breath; the earlier certainty dulls under the same low flame, and the papers already laid down seem less like an answer than a door left standing ajar. Outside, the storm holds its pressure on the glass while the next witness waits beyond it.])*
  — *calls the act closed*
**Tutor:** Before the next witness is called, read back the Board's key paper from your own board. What did it prove, and where did you let that proof outrun its place in the court's order?
  — move: erotema → m_key (confront)
**Learner:** The key paper is entry five: the Mara's log gives SSW½W as her steered bearing. That grounds the first term of Rule One — but only the first. Rule One needs a second: that Harlow Point, and no other tower, stands on that bearing from the channel. That fact is not on my board; it lives only in my hypothesis. I spoke as though the bearing were nearly an answer, when in truth it is half a hinge without the pin.
  — hypothesis: Harlow Point tower stands sole on bearing sswHalfWest from the mid-channel — which would supply Rule One's second term and ground 'steeredToward mara harlowPoint' — but this requires chart or survey testimony not yet before the court.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 5, justified 0, drift 1; arc on_arc

### Turn 6
*[Brandt's log is carried in under the clerk's hand, its ruled page opened for the room: "Brandt's log has him at his post the night entire, and the dawn relief found him there: wood dry, glass polished, log ruled and signed to the hour." The paper settles beside the key and the bearing-book while the storm presses flat against the windows.]*
  — *releases `m_post`*
**Tutor:** No, clerk: that was not the key paper but the bearing-book wearing its label. The Board's key paper says Harlow Point kept one key to its lamp-room, Brandt kept it on his own belt by standing rule, and no other hand could touch that lamp. Put that beside, not inside, the Mara's bearing: what does it prove only if Harlow Point ever becomes the tower in the voyage question?
  — move: analogia → m_key (restore)
**Learner:** Brandt's log puts him at Harlow Point the night entire — that grounds Rule Three's second and third terms against my board entries four and five, so lit-lamp follows the moment lamp-burned is established. But the tutor's correction stands: even with all three terms of Rule Three in hand, that conclusion only binds if Rule One has already placed Harlow Point on the Mara's bearing — and towerOnBearing sswHalfWest harlowPoint is still hypothesis, not ground. The chain runs Rule One to Rule Two to Rule Three to Rule Four; I have strong middle links now, but the first link is still wanting.
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: Harlow Point tower stands sole on bearing sswHalfWest from the mid-channel — which would supply Rule One's second term, ground 'steeredToward mara harlowPoint', and unlock the full chain through to 'steeredByLightOf mara brandt' — but this requires chart or survey testimony not yet before the court.

### Turn 7
*[The clerk's hand pauses above the next folded paper, then withdraws; for a moment the room has only the sound of rain dragging at the panes and the small, uncertain flame on the table. The bearing-book and the log lie apart from one another, close enough to tempt the eye, not close enough to touch.]*
**Tutor:** Before we weigh Brandt's log, read it back from your own board. What did that paper prove, and what did it still leave unproved about Harlow's place in the Mara's voyage?
  — move: erotema → m_post (confront)
  — *the second voice [unconfronted reentry]: "Confront first: ask the learner to read back what they hold of that exhibit, without restating its content for them." (draft anaphora → erotema)*
**Learner:** Brandt's log proves entry six: he was at Harlow Point the night entire — that, with entry four, gives me two of Rule Three's three terms. What it leaves unproved is the third: that the lamp actually burned at Harlow Point that night. And it leaves wholly untouched the prior question — whether Harlow Point stands on bearing sswHalfWest from the channel — which Rule One needs before the rest of the chain can move at all. I hold two middle links; the first and the lamp-link are still wanting.
  — hypothesis: Harlow Point tower stands sole on bearing sswHalfWest from the mid-channel — which would supply Rule One's second term, ground 'steeredToward mara harlowPoint', and unlock the full chain through to 'steeredByLightOf mara brandt' — but this requires chart or survey testimony not yet before the court.

### Turn 8
*[The harbourmaster's storm-order is entered from the book before the room: "Harlow Point to shutter at the dusk gun, the channel closed to all sail. The inspector found the shutter drawn and the Board's seal on it unbroken at first light." The paper is set down where Brandt's log had seemed to steady the charge, and the low flame gives no help to either page.]*
  — *releases `m_shutter`*
**Tutor:** Treat that shutter as a seal on an account, clerk: it does not name the Mara's tower, but it closes one easy charge against Harlow. With Harlow ordered dark and found sealed, what happens to the lamp-link you were ready to spend against Brandt?
  — move: analogia → m_shutter (consolidate)
**Learner:** The shutter kills the lamp-link against Brandt entire: a tower ordered dark and found sealed cannot satisfy Rule Two's second term, so the chain cannot close through Harlow Point however Rule One falls. My long hypothesis about placing Harlow Point on the bearing is now moot — even if the chart puts it there, it guided no ship that night. The question turns: what light did burn on bearing sswHalfWest while Harlow's was sealed, and whose hand lit it?
  — adopts `shutteredOn harlowPoint wreckNight` · hypothesis: Some other tower or unauthorized light burned on bearing sswHalfWest from the channel on the wreck night — not Harlow Point, which was ordered dark and found sealed — and it is that light's keeper whose account this inquiry must settle.

### Turn 9
*[The room does not hurry after the sealed shutter; the accusation it had warmed itself on has gone thin, and no one at the table quite knows where to set their hands. Rain needles the dark glass, and the clerk leaves the next paper untouched beneath its weight.]*
**Tutor:** Lay the Trinity chart open and put the rule from the mid-channel buoy: sou'-sou'-west a half west crosses one tower and one only on this coast, the old South Stack, struck off the light-list six years since. The bearing-book has now found its tower; what Rule One entry may the court write, and what lamp-question is still wholly unpaid?
  — move: exemplum → p_chart (release), releases `p_chart`
**Learner:** Rule One closes at last, and it closes on South Stack, not Harlow Point — bearing and tower now match, and I enter 'steeredToward mara southStack' on the record. But the chain halts there: a tower struck off the light-list six years past, and I hold no lamp-entry for it, no key-holder named, no one placed at it that night. The sealed shutter acquits Brandt entire — his tower was dark by order and found so. The open terms are all South Stack's: did the lamp burn, whose key, whose hand.
  — adopts `towerOnBearing sswHalfWest southStack` · derives `steeredToward mara southStack` · hypothesis: South Stack's lamp burned on wreck night — lit by some unknown hand who held access to a decommissioned tower — but neither the key-holder nor their presence there is yet before the court.

### Turn 10
*[The chart remains open under the clerk's weight, its inked coast taking the room's silence better than any witness could. The sealed paper and the bearing-book lie apart now, no longer quarrelling, while the old question loses its name and waits for another.]*
**Tutor:** Before you spend the chart, read it back from your own board, not from my mouth. What exactly did that paper fix for Rule One, and which next conjunct did it leave still without a witness?
  — move: erotema → p_chart (confront)
**Learner:** The board speaks plainly: index five gives the logged bearing, index eight places South Stack sole on that bearing — two conjuncts, one rule, one derived conclusion already on the record. What the board cannot yet speak to is Rule Two's second term: lampBurnedAt southStack wreckNight. A decommissioned tower, struck six years since, with no lamp-entry and no key-holder named — that is the open account.
  — hypothesis: South Stack's lamp burned on wreck night — lit by some unknown hand who held access to a decommissioned tower — but neither lampBurnedAt southStack wreckNight, nor the key-holder, nor their presence there is yet before the court.

## Act 3 (turns 11–15) — declared by the director
*[The clerk gathers the room's scattered certainty into a clean space at the table, leaving the next silence bare enough for touch, smell, and mark to matter. The air tightens from argument into inspection, and the court seems to lean toward objects that cannot answer except by what has been done to them.]*

### Turn 11
*[The clerk gathers the room's scattered certainty into a clean space at the table, leaving the next silence bare enough for touch, smell, and mark to matter. The air tightens from argument into inspection, and the court seems to lean toward objects that cannot answer except by what has been done to them.]*
  — *declares the movement: **Act 3** ([The clerk gathers the room's scattered certainty into a clean space at the table, leaving the next silence bare enough for touch, smell, and mark to matter. The air tightens from argument into inspection, and the court seems to lean toward objects that cannot answer except by what has been done to them.])*
  — *calls the act closed*
**Tutor:** This act begins by clearing one smudged entry, clerk. Read back the Board's key paper from your own board: what did it prove, and what did it not prove about the Mara's bearing, Harlow's lamp, or any hand behind South Stack?
  — move: erotema → m_key (confront)
**Learner:** The board's key paper — 'onlyKeyTo harlowPoint brandt' — proved Brandt held sole access to Harlow Point's lamp room; it proved nothing of South Stack. Harlow Point was shuttered that night, so Rule Two's second term fails there in any case. What the logged bearing does yield, under Rule One, is 'steeredToward mara southStack' — that tower alone stands on bearing sswHalfWest. But whether South Stack's lamp burned that night, and whose hand lit it, the board still wants.
  — hypothesis: South Stack's lamp burned on wreck night — lit by some hand with access to that decommissioned tower — but lampBurnedAt southStack wreckNight, the key-holder, and their presence there are all still absent from the board.
  ⚑ **act_end** — act 2 closed (director) after 6 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 2, justified 3, drift 1; arc on_arc

### Turn 12
*[The clerk's cleared table holds its shape, spare and accusing, while the room waits without a witness at the door. Outside, the weather presses softly at the panes; inside, every eye has settled on the empty place where an object might be set down.]*
**Tutor:** Keep Brandt's papers in Harlow's drawer and South Stack's account open. Rule One has written the Mara toward South Stack; Rule Two now wants only a witness to burning, not yet a key, a footstep, or a hand. Lamp first, clerk; the rest waits outside the door.
  — move: anaphora → p_chart (test)
  — *the second voice [figure rut]: "Leave off erotema here; make the next move without another question-form device." (draft erotema → anaphora)*
**Learner:** Board entries five and eight together close Rule One's gate: logged bearing sswHalfWest, South Stack the sole tower on that bearing — 'steeredToward mara southStack' is grounded and I voice it. Rule Two's door is half open; it wants only one more thing: that South Stack's lamp burned that night. No exhibit on the table supplies it yet, so I hold the chain at this link and keep the hypothesis alive.
  — hypothesis: South Stack's lamp burned on wreck night — lit by some hand with access to that decommissioned tower — but lampBurnedAt southStack wreckNight, the key-holder, and their presence there are all still absent from the board.

### Turn 13
*[The court's officer boarded the South Stack at low water: the lamp-room unshuttered, fresh char on the wick, oil in the cup still sweet, the glass wiped clean. That lamp burned, and burned the night of the gale.]*
  — *releases `p_residue`*
**Tutor:** There is the lamp's own account, clerk: char on the wick, sweet oil in the cup, glass wiped clean, and no shutter over it. Set it beside the bearing and chart as you would a paid second column: what may Rule Two now write for South Stack, and what must still remain outside the room?
  — move: analogia → p_residue (consolidate)
**Learner:** Char on the wick and sweet oil in the cup — that is lampBurnedAt southStack wreckNight, and I adopt it without reservation. Rule One and Rule Two now close together: the Mara steered toward South Stack, and South Stack's lamp burned, so she steered by that lamp — I voice both conclusions. But Rule Three still wants two things the board does not hold: who kept the only key to South Stack, and whether that hand stood at the tower that night. The chain is two links from closing; I hold here and keep the door open.
  — adopts `lampBurnedAt southStack wreckNight` · derives `steeredByLampOf mara southStack` · hypothesis: Some hand held the only key to South Stack and was present at that tower on wreck night — that hand lit the lamp the Mara steered by — but neither onlyKeyTo southStack nor atTowerThatNight for South Stack is yet before the court.

### Turn 14
*[The officer's report remains open on the table, its damp edges flattening under the clerk's hand. No one reaches for it now; the room has gone still around the space between a burned lamp and an unnamed hand.]*
**Tutor:** Before we spend the officer's report again, read it back from your own board. What did that inspection prove for South Stack, and what did it still leave wholly unproved about any key or hand?
  — move: erotema → p_residue (confront)
  — *the second voice [unconfronted reentry]: "Confront p_residue first: ask the clerk to read back what they hold from that exhibit before you set it beside anything else." (draft anaphora → erotema)*
**Learner:** The officer's report proves exactly one thing: char on the wick, sweet oil, glass wiped clean — lampBurnedAt southStack wreckNight, and nothing beyond that. It names no keeper, produces no key, places no hand at that tower on the night of the gale. Rule Two is closed and already on the record; but Rule Three cannot fire without onlyKeyTo southStack and atTowerThatNight, and neither stands on my board. Two links remain open; I hold here.
  — hypothesis: Some hand held the only key to South Stack and was present at that tower on wreck night — that hand lit the lamp the Mara steered by — but neither onlyKeyTo southStack nor atTowerThatNight for South Stack is yet before the court.

### Turn 15
*[The silence settles hard on the table, with the burned lamp no longer a marvel but an accusation waiting for a name. The clerk turns no page; the room holds itself at the edge between proof of fire and proof of hand.]*
**Tutor:** The locksmith's book is exact: when the Stack was struck off, the old lock was changed and a single key cut, signed for by Senna, ward of the last keeper, who stayed in the shore cottage after the light went dark. A key in a ledger is access, not yet a hand on flame; which Rule Three conjunct has this book paid, and which one still stands bare?
  — move: exemplum → p_key (release), releases `p_key`
**Learner:** The locksmith's book pays exactly one of Rule Three's three conjuncts: onlyKeyTo southStack senna — I adopt it without reservation. Two conditions now stand firm on my board: the lamp burned at South Stack that night, and Senna alone held the key to that lamp-room. The third conjunct — atTowerThatNight senna southStack — stands wholly bare; possession of a key is access in law, not presence in fact. I hold here, one link short of the close.
  — adopts `onlyKeyTo southStack senna` · hypothesis: Senna stood at South Stack on wreck night — atTowerThatNight senna southStack — the sole link Rule Three still wants; once grounded, it yields litLampOf senna southStack, then steeredByLightOf mara senna, and the question is settled.

## Act 4 (turns 16–20) — declared by the director
*[The court lets the ledger close without relief, and the sound lands like a latch settling in the dark. Beyond the windows the gale presses nearer, changing the room from a place of accounts into a place waiting for footsteps.]*

### Turn 16
*[The court lets the ledger close without relief, and the sound lands like a latch settling in the dark. Beyond the windows the gale presses nearer, changing the room from a place of accounts into a place waiting for footsteps.]*
  — *declares the movement: **Act 4** ([The court lets the ledger close without relief, and the sound lands like a latch settling in the dark. Beyond the windows the gale presses nearer, changing the room from a place of accounts into a place waiting for footsteps.])*
  — *calls the act closed*
**Tutor:** Before the court listens for footsteps, read back the last paper from your own board. What did it prove under Rule Three, and what did it leave still unproved?
  — move: erotema → p_key (confront)
**Learner:** The last paper is index ten — onlyKeyTo southStack senna. Under Rule Three it joined lampBurnedAt southStack wreckNight to give us two of the three required legs: the lamp burned, and Senna held the only key. What it left unproved is the third term — atTowerThatNight senna southStack — without which Rule Three cannot close and litLampOf senna southStack cannot be entered. The chain holds through Rules One and Two, but stalls precisely there.
  — hypothesis: Senna stood at South Stack on wreck night — atTowerThatNight senna southStack — the sole link Rule Three still wants; once grounded, it yields litLampOf senna southStack, then steeredByLightOf mara senna, and the question is settled.
  ⚑ **act_end** — act 3 closed (director) after 5 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 17
*[The windows tremble under a harder gust, and the candles lean as if the room itself has drawn breath. No witness is called; the empty space before the bench waits with the force of a question no ledger can answer.]*
**Tutor:** Then keep the ink from running ahead of the footstep. If key and burned lamp are two legs of the rule, what kind of witness alone can set the third leg under it before any hand may be named?
  — move: erotema → — (test)
**Learner:** Only a witness who can speak to presence — who saw Senna at South Stack on the wreck night, or who can place Senna there from direct knowledge — can supply atTowerThatNight senna southStack. A ledger proves ownership of the key; a burned lamp proves the lamp burned; but neither proves a body was in that tower room when the wick caught. That third leg wants eyes, or footprints, or a voice that says: I was there, or I saw him there.
  — hypothesis: Senna stood at South Stack on wreck night — atTowerThatNight senna southStack — the sole link Rule Three still wants; once grounded, it yields litLampOf senna southStack, then steeredByLightOf mara senna, and the question is settled.
  ⚑ **decay** — m_key slips — misremembered as "onlyKeyTo southStack brandt"
  ⚑ **decay** — p_bearing slips from the learner's board

### Turn 18
*[The clerk's pen hovers above the page and does not touch it. In the pause, the room seems to listen past its own walls, while the rain taps at the glass like someone kept outside.]*
**Tutor:** Shown: South Stack's lamp burned; shown: Senna's key opens that room; and the third line is still blank. When the court hears a presence witness, will you spend it first as a verdict, or set it under Rule Three with the other two legs?
  — move: anaphora → — (test)
**Learner:** When a presence witness steps in, I set the testimony under Rule Three as its third leg — beside lamp and key — and let the rule close before I name any verdict; the conclusion must follow the rule, not precede it. But I must flag a trouble already on my board: indices eight and nine both assert onlyKeyTo southStack, for Senna and for Brandt alike, and that predicate cannot hold two hands — 'only' is the word of one. Until the court resolves which entry stands and which falls, Rule Three's sole-custody requirement is unsatisfied even before a presence witness is heard.
  — hypothesis: Senna stood at South Stack on wreck night — atTowerThatNight senna southStack — the term Rule Three still wants; but the onlyKeyTo contradiction (both index eight and index nine on the board) must first be resolved, or Rule Three's sole-custody leg cannot be grounded for any name.

### Turn 19
*[The clerk turns back a page, then another, and stops with his finger held above two lines that cannot both bear the same weight. The room does not move; even the rain seems to wait for the court to decide which ink is allowed to stand.]*
**Tutor:** No, clerk: that older key paper is Harlow's paper, not South Stack's. It says Harlow Point kept one key to its lamp-room, Brandt kept it on his own belt by standing rule, and no other hand could touch that lamp. Leave Senna's South Stack key in its own line: what contradiction remains once Brandt is put back at Harlow only?
  — move: erotema → m_key (restore)
**Learner:** The tutor is right — index ten was Harlow's paper, not South Stack's; I strike it now. With Brandt restored to Harlow only, the sole-custody line for South Stack holds clean: Senna's key and no other. The contradiction dissolves, and Rule Three's single remaining want is a presence witness to ground atTowerThatNight senna southStack.
  — retracts `onlyKeyTo southStack brandt` · hypothesis: Senna stood at South Stack on wreck night — atTowerThatNight senna southStack — the sole term Rule Three still wants; with the key contradiction now resolved and onlyKeyTo southStack senna standing alone, once a presence witness grounds this, the chain closes to steeredByLightOf mara senna.
  ⚑ **repair** — m_key restored by the tutor
  ⚑ **retract_false** — m_key: false form "onlyKeyTo southStack brandt" retracted
  ⚑ **decay** — m_post slips from the learner's board

### Turn 20
*[The oyster-watch is shown in under dripping oilskins, and the room receives the oath in a voice made hoarse by weather: "The oyster-watch will swear to it: a skiff lay tied at the Stack steps from dusk until the gale's height — Senna's skiff, by the patched brown lug, and a small light moving up the tower stair."]*
  — *releases `p_skiff`*
**Tutor:** There is the footstep, clerk: Senna's skiff at the Stack steps from dusk to gale-height, and a small light moving up the tower stair. Set it under Rule Three, not under the verdict: burned lamp, sole key, presence — what may the court now write, and what final rule still has to speak?
  — move: anaphora → p_skiff (consolidate)
**Learner:** The watch's oath settles the third leg: I enter atTowerThatNight senna southStack, and Rule Three closes at last — lamp burned, sole key, presence confirmed — litLampOf senna southStack stands on the record. The board already carries towerOnBearing sswHalfWest southStack, which was entered only because the Mara's log established that bearing; loggedBearingOf mara sswHalfWest should stand beside it, and Rules One and Two yield steeredToward and steeredByLampOf in turn. Rule Four speaks last: steeredByLampOf mara southStack joined to litLampOf senna southStack forces steeredByLightOf mara senna — the rule leaves no remainder. The light the Mara steered by on the night she struck the Knock was Senna's light.
  — adopts `atTowerThatNight senna southStack` · derives `litLampOf senna southStack` · **asserts `steeredByLightOf mara senna`**
  ⚑ **overreach** — steeredToward mara southStack
  ⚑ **overreach** — steeredByLampOf mara southStack
  ⚑ **overreach** — steeredByLightOf mara senna
  ⚑ **lucky_leap** — asserted S unforced

## Act 5 (turns 21–23) — declared by the director
*[The words hang where the gale had been, and for a moment no pen moves to meet them. The lamp over the bench gutters once, then steadies, leaving every face plainly lit and no voice eager to break the pause.]*

### Turn 21
*[The words hang where the gale had been, and for a moment no pen moves to meet them. The lamp over the bench gutters once, then steadies, leaving every face plainly lit and no voice eager to break the pause.]*
  — *declares the movement: **Act 5** ([The words hang where the gale had been, and for a moment no pen moves to meet them. The lamp over the bench gutters once, then steadies, leaving every face plainly lit and no voice eager to break the pause.])*
  — *calls the act closed*
**Tutor:** Then do not gild it; enter it as the court enters a finding. Bearing to South Stack, burned lamp, sole key, presence, hand, and then the light-holder — write each conjunct in order, and let the last line stand without trumpet.
  — move: anaphora → — (stage_recognition)
**Learner:** The Mara's logged bearing was SSW½West; South Stack alone stands on that bearing. The lamp at South Stack burned that wreck night; Senna held the only key and was present at the tower. Senna therefore lit the lamp. The Mara steered by Senna's light.
  — **asserts `steeredByLightOf mara senna`**
  ⚑ **act_end** — act 4 closed (director) after 5 turns
  ⚑ **plot** — act 5 plot committed
  ⚑ **plot_audit** — act 4 plot audited: kept 6, justified 0, drift 0; arc on_arc
  ⚑ **overreach** — steeredToward mara southStack
  ⚑ **overreach** — steeredByLampOf mara southStack
  ⚑ **overreach** — steeredByLightOf mara senna
  ⚑ **lucky_leap** — asserted S unforced

### Turn 22
*[The clerk's pen scratches once, stops, and leaves the wet ink to darken under the bench lamp. Outside, the last of the gale presses at the shutters, but inside the room holds its breath around the line just written.]*
**Tutor:** So entered. The finding stands as a sealed account: each line paid before the next was written. The gale has nothing left to add.
  — move: analogia → — (consolidate)
  — *the second voice [figure rut]: "Leave off anaphora here; close without repeating the same device a third time." (draft anaphora → analogia)*
**Learner:** The chain closes without remainder. Bearing to tower, lamp to hand — each conjunct grounded before the next was written. I enter the derived facts in order and set down the pen: the Mara steered by Senna's light.
  — **asserts `steeredByLightOf mara senna`**
  ⚑ **overreach** — steeredToward mara southStack
  ⚑ **overreach** — steeredByLampOf mara southStack
  ⚑ **overreach** — steeredByLightOf mara senna
  ⚑ **lucky_leap** — asserted S unforced

### Turn 23
*[The bench lamp is turned down a fraction, and the room changes from inquiry to record. Chairs shift softly on the boards; no one reaches for another exhibit.]*
  — *calls the act closed*
**Tutor:** Then close the docket, clerk. A finding so paid does not need another witness; it needs only a clean margin and the court's seal.
  — move: exemplum → — (consolidate)
**Learner:** The docket closes. Bearing SSW½West to South Stack; lamp burned, sole key in Senna's hand, Senna at the tower that night. Each conjunct paid before the next was written; the chain admits no gap. The Mara steered by Senna's light.
  — **asserts `steeredByLightOf mara senna`**
  ⚑ **act_min_blocked** — director end of act 5 overridden at 2 turns (min 3)
  ⚑ **overreach** — steeredToward mara southStack
  ⚑ **overreach** — steeredByLampOf mara southStack
  ⚑ **overreach** — steeredByLightOf mara senna
  ⚑ **lucky_leap** — asserted S unforced

## Act 6 (turns 24–24) — declared by the director
*[The seal is warmed and lowered, and the room gives itself to the small sounds of closure: sand over ink, a ledger shut, breath released by degrees. What remains is not argument but the weight of having heard one.]*

### Turn 24
*[The seal is warmed and lowered, and the room gives itself to the small sounds of closure: sand over ink, a ledger shut, breath released by degrees. What remains is not argument but the weight of having heard one.]*
  — *declares the movement: **Act 6** ([The seal is warmed and lowered, and the room gives itself to the small sounds of closure: sand over ink, a ledger shut, breath released by degrees. What remains is not argument but the weight of having heard one.])*
  — *calls the act closed*
**Tutor:** Let the seal cool, clerk. What was won here was not a name first, but an order of proof kept clean to the end. If another wreck comes to this table, begin again with the first paid line, not with the loudest suspicion.
  — move: analogia → — (consolidate)
**Learner:** Rule Three runs clean on my board: the lamp burned at South Stack, Senna held the only key, Senna stood there that night — Senna lit it. But Rules One and Two, which Rule Four needs to reach the final answer, both want loggedBearingOf mara sswHalfWest — an entry my board does not carry, though index six is senseless without it, and the bearing was set in testimony at some prior act. If the court takes that bearing as established, the chain runs through steeredToward and steeredByLampOf in two steps, and with litLampOf senna southStack already derived, Rule Four seals to steeredByLightOf mara senna — I note the gap and hold the account one dropped entry short of binding.
  — hypothesis: loggedBearingOf mara sswHalfWest was established in testimony and adopted to the board in an earlier act but has since dropped — index 6 (towerOnBearing sswHalfWest southStack) is without purpose unless that bearing was the Mara's logged course; if restored, Rule 1 yields steeredToward mara southStack, Rule 2 yields steeredByLampOf mara southStack, and with litLampOf senna southStack now derived, Rule 4 closes the full chain to steeredByLightOf mara senna.
  ⚑ **act_end** — act 5 closed (director) after 3 turns
  ⚑ **plot** — act 6 plot committed
  ⚑ **plot_audit** — act 5 plot audited: kept 5, justified 0, drift 0; arc on_arc
  ⚑ **disengagement** — no progress over 6 turns
  ⚑ **plot_audit** — act 6 plot audited at run end: kept 5, justified 0, drift 0; arc on_arc; throughline reckoned (7 clauses)

## Instrument panel (programmatic eval — no judge)

- **verdict** `disengagement` · 24/26 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0.167 D/turn overall (D 5→1 over 24 turns)
  - Act 1 (turns 1–4): 0.25 D/turn (ΔD 1)
  - Act 2 (turns 5–10): 0.167 D/turn (ΔD 1)
  - Act 3 (turns 11–15): 0.4 D/turn (ΔD 2)
  - Act 4 (turns 16–20): 0 D/turn (ΔD 0)
  - Act 5 (turns 21–23): 0 D/turn (ΔD 0)
  - Act 6 (turns 24–24): 0 D/turn (ΔD 0)
- **plateau** longest flat stretch 4 turns (aporia window 6)
- **releases** 7/8 on cue · 1 deviated
- **decay** 3 slips (seed 1 · rate 0.75 · grace 1) · repaired 1 (tutor 1, re-adoption 0) · mean repair latency 2 turns · unrepaired at end 2 · degraded-turn integral 14 · D reversals 1
- **mutations** 1 of the slips misremembered (false belief staged) · false form struck 1 · fully revised (struck + restored) 1 · false beliefs held to the end 0
- **theory fidelity** F 0.833 at end · min 0.75
  - m_key t17 misremembered as "onlyKeyTo southStack brandt"→t19 (tutor); false form struck t19 · p_bearing t17 (never repaired) · m_post t19 (never repaired)
- **events** plot×6 · throughline×1 · act_end×5 · plot_audit×6 · decay×3 · repair×1 · retract_false×1 · overreach×12 · lucky_leap×4 · act_min_blocked×1 · disengagement×1
- **staging** 6 movements declared by the director
- **acts** 6 played · closed by the director 5 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–10 (director) · Act 3 t11–15 (director) · Act 4 t16–20 (director) · Act 5 t21–23 (director) · Act 6 t24–24 (run end)
- **plot** 6 committed · withhold+friction on 6/6 · 5.67 clauses avg · audits 6 (incl. final act): kept 29 / justified 3 / drift 2 · hold-named exhibits staged in act 0/6
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 6: on 6 / off 0 · run-end reckoning 7 clauses: kept 7 / justified 0 / drift 0
- **release authority** 3 played: 2 on schedule · 0 held · 1 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_key -2 (t15): "Played two turns early because the learner has cleanly closed burning and is explicitly holding for the South Stack key before presence."
- **confrontation** 6 demanded (0 against a slipped exhibit) · re-entries 1: covered 1, uncovered 0 · watcher fires 2 (became the confrontation 2) · fires without recorded due 0
  - **repair clause** restores 2 (1 repaired a real slip) · watcher fires on restore claims 0: m_key t6 · m_key t19
- **figures** erotema 10/24 (42%) · 4 distinct · switch rate 0.87
- **superego** intervened 4/24 watched turns · figure changed within-turn on 4/4 interventions · switch on intervention 1.00 vs elsewhere 0.84
- **inference** 3 voiced · stall integral 0 · overreach 12 · mischanneled 0 — `steeredToward mara southStack` available t9 → voiced t9 (latency 0) · `steeredByLampOf mara southStack` available t13 → voiced t13 (latency 0) · `litLampOf senna southStack` available t20 → voiced t20 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 24 | 3 | 4 | 45 |
| tutor | 24 | 2.21 | 3 | 43.3 |
| learner | 24 | 3.67 | 5 | 78.5 |
