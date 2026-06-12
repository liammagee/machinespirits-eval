# The Light on the Knock — lantern-e2-real-r4

> world `world_002_lantern` · verdict **grounded_anagnorisis** · 20/26 turns
> S forced at turn 20; asserted grounded at turn 20

```
D= 5 ●●●·│·●···│·······│····
D= 4    ●│● ●●·│·······│····
D= 3     │    ●│●●●····│····
D= 2     │     │   ●●··│····
D= 1     │     │     ●●│●●●·
D= 0     │     │       │   ◉
turn      │+    │1    + │   2 (+=5, digit=x10)
rel    ▲ ▲│ ▲ ▲▲│   ▲ ▲ │   ▲ (▲ = evidence released)
slope 0.25 D/turn overall (D 5→0); per movement: 1 0.25 │ 2 0.20 │ 3 0.29 │ 4 0.25
```

## Act 1 (turns 1–4) — declared by the director
*[The hearing room settles under a hard white morning, its benches close-packed and its table cleared for accusation. Outside the windows, the sea-light flashes and withdraws, leaving the question hanging in the room like damp salt.]*

### Turn 1
*[The hearing room settles under a hard white morning, its benches close-packed and its table cleared for accusation. Outside the windows, the sea-light flashes and withdraws, leaving the question hanging in the room like damp salt.]*
  — *declares the movement: **Act 1** ([The hearing room settles under a hard white morning, its benches close-packed and its table cleared for accusation. Outside the windows, the sea-light flashes and withdraws, leaving the question hanging in the room like damp salt.])*
**Tutor:** Set down no name yet, clerk. What must this court prove before any light can be charged with the Mara?
  — move: erotema → — (orient)
**Learner:** Before any keeper answers for a light, sir, the chain must hold at every link: first, the Mara's logged bearing that night — without it, Rule 1 cannot place her toward any tower at all. Second, one tower and one only must stand on that bearing from her channel. Third, the lamp at that tower must be shown to have burned — a cold wick steers no one, by Rule 2. Only when all three are on the record can the court ask whose hand lit it.
  — hypothesis: Brandt's lamp at Harlow Point is the one the town suspects, but I have no logged bearing, no tower-on-bearing fact, and no lamp-burned fact yet — the chain is open at every link.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[A Board clerk produces the standing rule and reads it into the room: "Harlow Point keeps one key to its lamp-room and the keeper keeps it: Brandt's, on his own belt, by the Board's standing rule. No other hand could touch that lamp."]*
  — *releases `m_key`*
**Tutor:** A key in a keeper's belt is like a signature on one door, not a course pricked on the sea. What does Brandt's key prove about Harlow Point, and what does it leave wholly unproved about the Mara's bearing?
  — move: analogia → m_key (consolidate)
**Learner:** Brandt's key fixes one link deep in Rule 3 — if the lamp burned and he was at the tower, no other hand could have lit it. But the key is silent on every earlier link: I still have no logged bearing for the Mara, no proof any tower stands on that bearing, and no evidence the lamp at Harlow Point burned at all that night. The key readies an answer to 'who lit it,' while the court has not yet shown there was a light to steer by.
  — adopts `onlyKeyTo harlowPoint brandt` · hypothesis: Harlow Point's lamp is the one the town suspects guided the Mara, but the chain wants three more facts: loggedBearingOf mara wreckNight, towerOnBearing <that bearing> harlowPoint, and lampBurnedAt harlowPoint wreckNight — none yet on the record.

### Turn 3
*[The clerk's pen pauses above the page while the room listens to the windows rattle in their frames. On the cleared table, the produced rule lies flat and accusing, but the sea beyond it gives no answer.]*
**Tutor:** Good. Then keep your pen at the first blank. What paper would move this from a room's accusation to a ship's course?
  — move: erotema → — (test)
**Learner:** The ship's log, sir — or her chart with the bearing pricked on it. If the Mara's officer entered a compass bearing before she struck, that single line of ink is the first brick the rules need: without loggedBearingOf, Rule 1 cannot place her toward any tower at all. After the log, a coastal survey to show what stands on that bearing from the Knock channel — one tower or several. Those two papers together would carry us to the lamp question.
  — hypothesis: Harlow Point's lamp is the one the town suspects guided the Mara, but the chain wants three more facts: loggedBearingOf mara wreckNight, towerOnBearing <that bearing> harlowPoint, and lampBurnedAt harlowPoint wreckNight — none yet on the record. The ship's log or chart is the first paper that could open the chain.
  ⚑ **decay** — m_key slips from the learner's board

### Turn 4
*[The hearing room holds its breath around the empty place where the next paper should lie. Rain ticks against the glass, and the clerk turns a clean page without yet writing a word.]*
**Tutor:** Now the mate's bearing-book comes ashore dry in its oilskin: from the mid-channel buoy the Mara held sou'-sou'-west a half west the last hour entire, on a steady fixed light, course pricked, timed, and initialed. Treat that line like the first debit in a ledger, clerk: what does it fix, and what does it still not name?
  — move: exemplum → p_bearing (release), releases `p_bearing`
**Learner:** The bearing-book lays the first debit on my ledger: the Mara held sou'-sou'-west a half west, steady, for a full hour — loggedBearingOf is now grounded. Rule 1 has its first condition but still wants its second: what tower, if any, stands on that bearing from the mid-channel buoy? The bearing names a course, not a lantern; until a coastal survey or chart places a tower on sswHalfWest, the rule cannot fire. I also mark a gap — the standing order's key-rule (onlyKeyTo brandt harlowPoint) was read into the room last turn but does not appear on my board; I shall flag it and hope the record restores it.
  — adopts `loggedBearingOf mara sswHalfWest` · hypothesis: Harlow Point stands on bearing sswHalfWest from the Knock channel, which would satisfy towerOnBearing and fire Rule 1 — but that fact is not yet on the record. The chain also still wants lampBurnedAt harlowPoint wreckNight, and the onlyKeyTo brandt harlowPoint entry (read from the standing rule, turn 2) appears missing from my board and must be recovered.

## Act 2 (turns 5–9) — declared by the director
*[The morning hardens at the windows, and the benches grow quieter around the single line now fixed in the clerk's book. The table is cleared again, not for certainty but for the first pressure against it, as if the room itself must learn to doubt the shape of its accusation.]*

### Turn 5
*[The morning hardens at the windows, and the benches grow quieter around the single line now fixed in the clerk's book. The table is cleared again, not for certainty but for the first pressure against it, as if the room itself must learn to doubt the shape of its accusation.]*
  — *declares the movement: **Act 2** ([The morning hardens at the windows, and the benches grow quieter around the single line now fixed in the clerk's book. The table is cleared again, not for certainty but for the first pressure against it, as if the room itself must learn to doubt the shape of its accusation.])*
  — *calls the act closed*
**Tutor:** Then restore the missing line before we lay any new paper: Harlow Point keeps one key to its lamp-room, and the keeper keeps it, Brandt's, on his own belt, by the Board's standing rule. No other hand could touch that lamp. Put that back as a lock on Harlow's door, not yet as a light on the Mara's sea.
  — move: analogia → m_key (restore)
**Learner:** The tutor's reminder confirms index 4 stands correctly — onlyKeyTo harlowPoint brandt is locked on the board by the Board's own rule. But the chain still wants three links: towerOnBearing sswHalfWest harlowPoint, lampBurnedAt harlowPoint wreckNight, and atTowerThatNight brandt harlowPoint — none yet on the record. The door is bolted; I cannot yet say the lamp was burning behind it.
  — hypothesis: Harlow Point stands on bearing sswHalfWest from the Knock channel — which would satisfy towerOnBearing sswHalfWest harlowPoint and fire Rule 1 — but this fact is not yet on the record. The chain also still wants lampBurnedAt harlowPoint wreckNight and atTowerThatNight brandt harlowPoint before Rules 2 and 3 can fire.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 5, justified 0, drift 1; arc on_arc
  ⚑ **repair** — m_key restored by the tutor
  ⚑ **decay** — p_bearing slips from the learner's board

### Turn 6
*[Brandt's log is laid beside the bearing-book, its ruled hand carrying him through the night entire at his post. At dawn, the relief is shown in: wood dry, glass polished, log ruled and signed to the hour.]*
  — *releases `m_post`*
**Tutor:** Shown: Brandt's hand was at Harlow through the night. Shown: Brandt's key fits Harlow's lamp-room alone. Before the account closes on him, what is still unshown between the Mara's logged bearing and any burning lamp?
  — move: anaphora → m_post (consolidate)
**Learner:** Brandt's log puts him at Harlow through the night — that link drops onto the board. But the chain still hangs open at three joints: the Mara's logged bearing is not yet in evidence, no witness has placed Harlow Point on that bearing, and no exhibit yet shows the lamp at Harlow burned at all that night. Two of Rule 3's three premises are now satisfied; the lamp itself remains dark on the record.
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: Harlow Point stands on bearing sswHalfWest from the Knock channel — satisfying towerOnBearing sswHalfWest harlowPoint and firing Rule 1 — but this fact is not yet on the record. The chain also still wants loggedBearingOf mara wreckNight and lampBurnedAt harlowPoint wreckNight before Rules 1 and 2 can fire and the account can close.

### Turn 7
*[The clerk pauses with his pen above the page, and for a moment the room hears only rain ticking against the high panes. The bearing-book and the log lie side by side under the same gray light, close enough to seem an answer and still refusing to touch.]*
**Tutor:** Strike that blank through, clerk: the mate's bearing-book is already before you, dry from its oilskin. From the mid-channel buoy the Mara held sou'-sou'-west a half west the last hour entire, on a steady fixed light, course pricked, timed, and initialed. Put that line back on the board, and tell me only what kind of proof it still waits beside.
  — move: exemplum → p_bearing (restore)
**Learner:** The bearing is already on my board at index five — the mate's book was entered last turn. What the logged course still waits beside is this: first, a chart or pilot's testimony placing Harlow Point and no other tower on bearing sou'-sou'-west a half west from the channel; second, some record — oil consumed, keeper's entry, or witness — showing the lamp behind that door actually burned the night Mara struck. Without those two papers, the bearing is a heading into fog.
  — hypothesis: Harlow Point stands alone on bearing sswHalfWest from the Knock channel (towerOnBearing sswHalfWest harlowPoint) and its lamp burned that night (lampBurnedAt harlowPoint wreckNight) — both still unshown; if either comes in, the chain is one link from closing.
  ⚑ **repair** — p_bearing restored by the tutor
  ⚑ **decay** — m_key slips from the learner's board
  ⚑ **decay** — m_post slips from the learner's board

### Turn 8
*[The harbourmaster's storm-order stands in the book: Harlow Point to shutter at the dusk gun, the channel closed to all sail. The inspector found the shutter drawn and the Board's seal on it unbroken at first light.]*
  — *releases `m_shutter`*
**Tutor:** The shutter-order is not a rumor in the benches; it is a sealed door in the Board's own book. If Harlow Point was shuttered at dusk and the seal stood whole at first light, what happens to the charge that the Mara steered by Harlow's lamp?
  — move: erotema → m_shutter (consolidate)
**Learner:** The shutter-order and the unbroken seal are the Board's own hand — Harlow's lamp was sealed dark at the dusk gun and the seal stood whole at first light; no record opens it between. Rule 2 demands the lamp burned; a shuttered tower is a dark tower, and a dark tower steers no one. I adopt the shutter fact onto my board: the charge against Brandt falls here, not for want of a bearing, but for want of a flame. The board must now ask what fixed light did burn on bearing sou'-sou'-west a half west the night Mara struck.
  — adopts `shutteredOn harlowPoint wreckNight` · hypothesis: Some light other than Harlow's burned on bearing sswHalfWest that night and guided Mara to the Knock — Harlow was shuttered and dark, so Rule 2 cannot fire for Brandt's tower, and the responsible hand is as yet unshown on the record.

### Turn 9
*[The sealed shutter remains on the table without being touched, its wax catching the thin morning light. Around it the room has the uneasy stillness of people who have lost an accusation and not yet found a question large enough to replace it.]*
**Tutor:** Lay the rule on the Trinity chart from the mid-channel buoy: sou'-sou'-west a half west crosses one tower and one only on all this coast, the old South Stack, struck off the light-list six years since. A chart is not a lantern; it fixes where the Mara's bearing points, and leaves the court still asking whether that tower burned. What, then, becomes of Harlow Point in your account?
  — move: analogia → p_chart (release), releases `p_chart`
**Learner:** South Stack on bearing sswHalfWest — Rule 1 fires, and Mara steered toward South Stack, not Harlow Point; Brandt's tower is cleared twice over, once by the chart and once by the sealed shutter. But the chain still hangs open at Rule 2: I need lampBurnedAt southStack wreckNight before steeredByLampOf can be written. South Stack is six years off the light-list — if something burned there that night, no lawful keeper put it there.
  — adopts `towerOnBearing sswHalfWest southStack` · derives `steeredToward mara southStack` · hypothesis: South Stack, struck off the light-list six years since, nevertheless showed a light the night Mara struck — some unauthorised hand held a lamp to a dark tower, and that hand is not yet before the court.

## Act 3 (turns 10–16) — declared by the director
*[The room is left with its accusation emptied and its question sharpened, and the benches seem to lean toward the place where proof must next become touchable. The clerk turns to a fresh page; the air changes from argument to inspection, from names spoken aloud to marks that may have survived the night.]*

### Turn 10
*[The room is left with its accusation emptied and its question sharpened, and the benches seem to lean toward the place where proof must next become touchable. The clerk turns to a fresh page; the air changes from argument to inspection, from names spoken aloud to marks that may have survived the night.]*
  — *declares the movement: **Act 3** ([The room is left with its accusation emptied and its question sharpened, and the benches seem to lean toward the place where proof must next become touchable. The clerk turns to a fresh page; the air changes from argument to inspection, from names spoken aloud to marks that may have survived the night.])*
  — *calls the act closed*
**Tutor:** Your last account emptied the first accusation and left one place for inspection. Before any hand can enter the finding, what must the court make touchable about that tower's lamp: not who tended it, but whether it burned?
  — move: erotema → — (orient)
**Learner:** The bearing and the tower are both on my board, and Rule 1 fires from them now: Mara steered toward South Stack. But Rule 2 wants one thing more — whether that lamp at South Stack actually burned the night she struck. Without that touchable fact, the chain stalls here and no hand can be named.
  — hypothesis: South Stack's lamp burned on the wreck night — lit by some unauthorised hand, since the tower is struck from the light-list — but lampBurnedAt southStack wreckNight is not yet on the record; it must be made touchable before Rule 2 can fire.
  ⚑ **act_end** — act 2 closed (director) after 5 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 11
*[The fresh page waits under the clerk's hand, its blankness more accusing than any name yet spoken. Outside the windows the weather presses close, and the court seems to listen for proof that has not yet entered.]*
**Tutor:** Then keep the fresh page narrowed to the lamp, not the hand. What kind of mark or witness would turn South Stack from the tower on the bearing into a lamp that burned that night? Until that conjunct is shown, what may the court still not write?
  — move: erotema → — (test)
**Learner:** Rule 1 fires from what I already hold — bearing sswHalfWest logged, South Stack alone on that bearing — so I can voice it now: Mara steered toward South Stack. But Rule 2 stops cold without lampBurnedAt southStack wreckNight, and that fact wants something touchable: a mariner's account of a light seen on that bearing, or a shore-watcher's note, or oil and ash at the tower itself. Until the court puts one of those in evidence, it may not write that she steered by any lamp — only that she pointed toward a dark and decommissioned tower.
  — hypothesis: lampBurnedAt southStack wreckNight — must be made touchable by witness testimony (light seen from sea or shore) or physical inspection of the tower (oil consumed, wick burned); without it Rule 2 cannot fire.

### Turn 12
*[The clerk does not yet write; the pen rests above the fresh page as if the page itself has become a threshold. In the gallery, the benches settle into a strained quiet, waiting for the first object or voice that can cross from supposition into touch.]*
**Tutor:** Keep two columns on the page, clerk: the lamp, and the hand. Proof that South Stack burned would move Rule 2 from tower to lamp; it would not yet write who lit it, for key and presence are separate entries still unpaid.
  — move: analogia → — (consolidate)
  — *the second voice [figure rut]: "Leave off erotema for this turn. State the next separation directly instead of asking it." (draft erotema → analogia)*
**Learner:** The board holds both conjuncts for Rule 1 — bearing sswHalfWest logged, South Stack alone on that bearing — so I voice it now as settled: Mara steered toward South Stack. But the page stays blank on the two remaining columns: lamp and hand. No exhibit has come in to touch either, and a decommissioned tower whose lamp is unproven lit cannot yet answer the question.
  — hypothesis: lampBurnedAt southStack wreckNight remains unshown — and beyond it, onlyKeyTo southStack ?x and atTowerThatNight ?x southStack are both blank; the hand column cannot even be opened until the lamp column is paid.

### Turn 13
*[The court's officer is shown in with salt still dried on his coat from the low-water crossing. He reports the South Stack lamp-room unshuttered, fresh char on the wick, oil in the cup still sweet, the glass wiped clean: that lamp burned, and burned the night of the gale.]*
  — *releases `p_residue`*
**Tutor:** The officer's marks are not a name; they are a flame made touchable. Fresh char, sweet oil, clean glass, and an unshuttered room go in the lamp column. What does that do to Rule 2, and what column must still remain blank?
  — move: analogia → p_residue (consolidate)
**Learner:** The officer's findings pay the lamp column at last — char and oil and clean glass are things the court can touch, and lampBurnedAt southStack wreckNight goes on the board. Rule 2 now fires: Mara steered by South Stack's lamp. But the hand column stands untouched — onlyKeyTo southStack and atTowerThatNight are both still blank, and Rule 3 will not stir without them.
  — adopts `lampBurnedAt southStack wreckNight` · derives `steeredByLampOf mara southStack` · hypothesis: onlyKeyTo southStack ?x and atTowerThatNight ?x southStack are both unshown; Rule 3 cannot fire and the hand column — who lit that lamp — remains blank until key and presence are both put in evidence.

### Turn 14
*[The officer's report lies open beside the untouched hand column, and the room seems to feel the difference between a lamp proved and a hand named. The clerk draws no line between them; the silence holds there, narrow and exact.]*
**Tutor:** Not from my mouth, not from the benches, not from memory: read the officer's exhibit back from your own page, clerk. What does that paper prove, and what column does it still leave untouched?
  — move: anaphora → p_residue (confront)
  — *the second voice [unconfronted reentry]: "Confront first: ask the learner to read back what they hold of that exhibit before you use it again. Do not supply the read-back for them." (figure held)*
**Learner:** The officer's paper proves one thing only: that lamp burned — char, oil, glass, and open room, all touchable, all on my board as entry seven. Rule 2 is paid; Mara steered by South Stack's lamp is on the record. But the hand column the tutor names stands exactly as it did before the officer entered: onlyKeyTo and atTowerThatNight are both blank, and the officer's salt coat writes nothing there.
  — hypothesis: onlyKeyTo southStack ?x and atTowerThatNight ?x southStack are both unshown; Rule 3 cannot fire and the hand column — who lit that lamp — remains blank until key and presence are both put in evidence.

### Turn 15
*[The officer's paper is not removed; it is only weighted flat against the draught, its corners lifting and settling as the gale presses the windows. Across the table the blank space beside it waits, neither accused nor answered.]*
**Tutor:** The locksmith's book is exact: when the Stack was struck off, the old lock was changed and a single key cut, signed for by Senna, ward of the Stack's last keeper, who stayed on in the shore cottage when the light went dark. Set that entry in the hand column as a key, not yet as a hand at the lamp. What conjunct does Rule 3 still wait for before any finding can move from key to lighting?
  — move: exemplum → p_key (release), releases `p_key`
**Learner:** The locksmith's book pays the key entry: onlyKeyTo southStack senna goes on the board, and Rule 3 now holds two of its three conjuncts — lamp burned, single key cut, named holder. But the third conjunct will not write itself: Rule 3 waits for atTowerThatNight senna southStack before the hand column can move from key to lighting. Possession is not presence.
  — adopts `onlyKeyTo southStack senna` · hypothesis: atTowerThatNight senna southStack is the sole missing conjunct; once Senna's presence at the tower that night is shown, Rule 3 fires — litLampOf senna southStack follows, then steeredByLightOf mara senna under Rule 4 — but that fact is not yet before the court.

### Turn 16
*[The locksmith's book is closed without ceremony, and the sound of its cover seems too final for what it has not proved. Beyond the panes the gale worries at the court-house lights, while the blank line for presence remains open on the clerk's page.]*
**Tutor:** Before we lean on the locksmith's book, read it back from your own page, clerk. What exactly does that exhibit put in the hand column, and what does it leave still unshown?
  — move: erotema → p_key (confront)
  — *the second voice [unconfronted reentry]: "Confront the key exhibit first: make the learner read back what they hold of it from their own board before you restage or consolidate it." (draft anaphora → erotema)*
**Learner:** The locksmith's book puts one entry on my board: onlyKeyTo southStack senna — the old lock changed when the Stack was struck off, a single key cut, Senna's name on the receipt. That is a document of transfer, not of movement; it says who holds the key, nothing of where that hand was on the wreck night. Rule 3 now holds two of its three conjuncts — lamp burned, single key named — but the third, atTowerThatNight senna southStack, the book does not touch. The hand column stands as it did before the locksmith entered: key is not presence, and Rule 3 will not fire on two conjuncts alone.
  — hypothesis: atTowerThatNight senna southStack is the sole missing conjunct — the locksmith's book gives key but not presence; once Senna's whereabouts on the wreck night are shown, Rule 3 fires and litLampOf senna southStack follows, then steeredByLightOf mara senna under Rule 4.

## Act 4 (turns 17–20) — declared by the director
*[The clerk leaves the last blank line unfilled and sets a clean sheet beside it, as if the room must now stop reading ledgers and begin listening for movement in the storm. The benches settle into a harder silence; the next act enters by weather, distance, and the question of who could be placed where the record still refuses to place them.]*

### Turn 17
*[The clerk leaves the last blank line unfilled and sets a clean sheet beside it, as if the room must now stop reading ledgers and begin listening for movement in the storm. The benches settle into a harder silence; the next act enters by weather, distance, and the question of who could be placed where the record still refuses to place them.]*
  — *declares the movement: **Act 4** ([The clerk leaves the last blank line unfilled and sets a clean sheet beside it, as if the room must now stop reading ledgers and begin listening for movement in the storm. The benches settle into a harder silence; the next act enters by weather, distance, and the question of who could be placed where the record still refuses to place them.])*
  — *calls the act closed*
**Tutor:** The clean sheet is not for a name; it is for movement. With burned lamp and single key already in separate columns, what kind of proof would place that key's hand at the Stack that night without yet asking what the hand did?
  — move: erotema → — (orient)
**Learner:** Presence proof, your Honours — not documentary but locative: a witness who saw Senna at the Stack that night, a travel record placing them on the road thither, a ferryman's log, or Senna's own testimony. The key column is closed; the lamp column is closed; only the body-in-place column remains open. Meanwhile the board already yields two derived steps — Rules 1 and 2 fire cleanly — and the chain hangs on that single gap.
  — hypothesis: atTowerThatNight senna southStack is the sole open conjunct; the proof that could close it is locative — a witness, a travel record, or admission placing Senna at South Stack on the wreck night — not the key instrument already in evidence.
  ⚑ **act_end** — act 3 closed (director) after 7 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 18
*[The clean sheet remains bare while rain ticks against the high windows and the court listens to the weather as though it might answer. No one reaches for another ledger; the room has narrowed to the empty space between possession and presence.]*
**Tutor:** Shown: South Stack's lamp burned. Shown: the single key stood with Senna. Before Rule 3 may speak, what must the record place at the tower that night, and why is that different from motive or suspicion?
  — move: anaphora → — (consolidate)
**Learner:** Rule 3 wants atTowerThatNight senna southStack — the body at the tower, not the key in the pocket. Possession proves opportunity; it does not prove presence: a keeper miles inland still holds his key. Motive and means are not the court's standard; only a locative fact — witness, travel record, admission — can supply that third conjunct. Rules 1 and 2 now fire cleanly on what is grounded; the chain arrests precisely there.
  — hypothesis: atTowerThatNight senna southStack is the sole open conjunct; the proof that could close it is locative — a witness, travel record, ferryman's log, or admission placing Senna at South Stack on the wreck night — not the key instrument already in evidence.

### Turn 19
*[The court holds in the long pause after the word presence, the rain making a faint second transcript on the glass. The clean sheet waits under the clerk's hand, and every face in the room seems turned not toward the papers but toward the door.]*
**Tutor:** Not motive, not means, not the key lying still in a pocket: the law wants a body placed at the Stack. If the next witness speaks only of feeling or quarrel, where does Rule 3 still leave your pen?
  — move: anaphora → — (test)
**Learner:** Rule 3 leaves my pen lifted, your Honours — feeling and quarrel are colour, not coordinates. Without atTowerThatNight senna southStack on the record, litLampOf cannot be written, and Rule 4 has nothing to carry. Two steps derive cleanly from what the board now holds; the chain arrests precisely at that third conjunct, and there it must wait.
  — hypothesis: atTowerThatNight senna southStack is the sole open conjunct; the proof that could close it is locative — a witness, travel record, ferryman's log, or admission placing Senna at South Stack on the wreck night — not the key instrument already in evidence.

### Turn 20
*[The door opens under a shove of wet air, and the oyster-watch is shown in with his cap crushed in both hands. The oyster-watch will swear to it: a skiff lay tied at the Stack steps from dusk until the gale's height — Senna's skiff, by the patched brown lug, and a small light moving up the tower stair.]*
  — *releases `p_skiff`*
**Tutor:** A skiff at the Stack steps is not a confession; it is a footprint left at the door. With the lamp column and key column already paid, what does this witness now place in the presence column, and which rule is the first allowed to move?
  — move: analogia → p_skiff (consolidate)
  — *the second voice [figure rut]: "Leave off anaphora here; make the next move without the repeated 'Shown' frame." (draft anaphora → analogia)*
**Learner:** The presence column is paid, your Honours — skiff at the steps, light on the stair. Rule 3 fires: lamp burned, key held, hand placed; litLampOf senna southStack is written. Rule 4 carries it to the final line: steeredByLightOf mara senna. The chain is closed; the account balances.
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
- **releases** 7/8 on cue · 1 deviated
- **decay** 4 slips (seed 1 · rate 0.75 · grace 1) · repaired 2 (tutor 2, re-adoption 0) · mean repair latency 2 turns · unrepaired at end 2 · degraded-turn integral 30 · D reversals 1
- **theory fidelity** F 0.833 at end · min 0.75
  - m_key t3→t5 (tutor) · p_bearing t5→t7 (tutor) · m_key t7 (never repaired) · m_post t7 (never repaired)
- **events** plot×4 · throughline×1 · decay×4 · act_end×3 · plot_audit×4 · repair×2 · forced×1 · grounded_anagnorisis×1
- **staging** 4 movements declared by the director
- **acts** 4 played · closed by the director 3 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–9 (director) · Act 3 t10–16 (director) · Act 4 t17–20 (run end)
- **plot** 4 committed · withhold+friction on 4/4 · 6 clauses avg · audits 4 (incl. final act): kept 23 / justified 0 / drift 1 · hold-named exhibits staged in act 0/2
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 4: on 4 / off 0 · run-end reckoning 7 clauses: kept 7 / justified 0 / drift 0
- **release authority** 3 played: 2 on schedule · 0 held · 1 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_key -2 (t15): "The clerk has cleanly separated burned lamp from hand, so the key can enter early without closing the account."
- **confrontation** 2 demanded (0 against a slipped exhibit) · re-entries 0: covered 0, uncovered 0 · watcher fires 2 (became the confrontation 2) · fires without recorded due 0
  - **repair clause** restores 2 (2 repaired a real slip) · watcher fires on restore claims 0: m_key t5 · p_bearing t7
- **figures** erotema 7/20 (35%) · 4 distinct · switch rate 0.79
- **superego** intervened 4/20 watched turns · figure changed within-turn on 3/4 interventions · switch on intervention 1.00 vs elsewhere 0.73
- **inference** 3 voiced · stall integral 0 · overreach 0 · mischanneled 1 — `steeredToward mara southStack` available t9 → voiced t9 (latency 0) · `steeredByLampOf mara southStack` available t13 → voiced t13 (latency 0) · `litLampOf senna southStack` available t20 → voiced t20 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 20 | 3 | 3 | 44 |
| tutor | 20 | 2.45 | 3 | 44.1 |
| learner | 20 | 3.35 | 4 | 76.6 |
