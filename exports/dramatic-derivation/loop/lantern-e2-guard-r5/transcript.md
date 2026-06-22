# The Light on the Knock — lantern-e2-guard-r5

> world `world_002_lantern` · verdict **grounded_anagnorisis** · 20/26 turns
> S forced at turn 20; asserted grounded at turn 20

```
D= 5 ●●●·│·●···│·······│····
D= 4    ●│● ●●●│·······│····
D= 3     │     │●●●····│····
D= 2     │     │   ●●··│····
D= 1     │     │     ●●│●●●·
D= 0     │     │       │   ◉
turn      │+    │1    + │   2 (+=5, digit=x10)
rel    ▲ ▲│ ▲ ▲▲│   ▲ ▲ │   ▲ (▲ = evidence released)
slope 0.25 D/turn overall (D 5→0); per movement: 1 0.25 │ 2 0.00 │ 3 0.43 │ 4 0.25
```

## Act 1 (turns 1–4) — declared by the director
*[The hearing room gathers itself under a hard, salt-stained light; papers lie squared, chairs scrape, and every face turns toward the empty place where an answer ought to stand. Outside, the weather presses at the windows without yet giving up its story.]*

### Turn 1
*[The hearing room gathers itself under a hard, salt-stained light; papers lie squared, chairs scrape, and every face turns toward the empty place where an answer ought to stand. Outside, the weather presses at the windows without yet giving up its story.]*
  — *declares the movement: **Act 1** ([The hearing room gathers itself under a hard, salt-stained light; papers lie squared, chairs scrape, and every face turns toward the empty place where an answer ought to stand. Outside, the weather presses at the windows without yet giving up its story.])*
**Tutor:** Before any account is closed, clerk, name the rule of this room: do we begin with the weather's rumor, or with a paper the court can hold? Keep your pencil on the margin until the first proved line earns ink.
  — move: erotema → — (orient)
**Learner:** The paper, sir — only the paper. The town's verdict is not evidence; it is weather of another kind. My board shows the Mara steered for a light, and Brandt keeps Harlow Point, but no exhibit yet names a bearing, a tower on that bearing, or a lamp that burned — so the rules yield nothing I may ink in.
  — hypothesis: Harlow Point tower may be what the Mara steered toward, given Brandt is its keeper and the town names him — but no logged bearing or lamp-evidence yet grounds this
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[A clerk produces the Board's standing rule and reads it into the room: "Harlow Point keeps one key to its lamp-room and the keeper keeps it: Brandt's, on his own belt, by the Board's standing rule. No other hand could touch that lamp." The words settle hard among the squared papers, and the empty place at the table seems to narrow.]*
  — *releases `m_key`*
**Tutor:** Treat that Board rule as a lock in a ledger: it can close Harlow Point's lamp-room to every hand but Brandt's, and no farther. What conjunct does it actually put on your board, and what charge still lacks ink?
  — move: analogia → m_key (consolidate)
**Learner:** The Board's rule turns one tumbler: Brandt alone holds the key, so no other hand could light that lamp-room. But Rule 3 wants two more conjuncts before I may write 'Brandt lit it' — the lamp must be shown burned that night, and Brandt must be shown at the tower. I have a lock half-sprung, no more.
  — adopts `onlyKeyTo harlowPoint brandt` · hypothesis: Harlow Point is the tower the Mara steered toward — Brandt is its keeper and the only keyholder — but no logged bearing, no tower-on-bearing, no lamp-burned, and no atTowerThatNight fact yet grounds any step of the chain

### Turn 3
*[The room holds after the learner's answer; ink dries in the clerk's margin while the unanswered spaces on the board seem larger than the words already written. A gust worries the windowpanes, and the squared papers wait for the next hand to disturb them.]*
**Tutor:** Good: keep that line penciled as a boundary, not a finding. If the room pressed you now to write Brandt's name in the account, would that be proved charge, or conjecture waiting on its next conjunct?
  — move: erotema → — (test)
**Learner:** Conjecture only, sir — three links of the chain are still dark. Rule 3 needs the lamp shown burned and Brandt shown at the tower that night; I have neither. And before Rule 3 can matter at all, Rules 1 and 2 must run: a logged bearing, a tower standing on it, a burning lamp. To write Brandt's name now would be to spend money I have not yet counted.
  — hypothesis: Harlow Point is the tower the Mara steered toward — Brandt is its keeper and sole keyholder — but the chain still wants: loggedBearingOf mara, towerOnBearing that bearing harlowPoint, lampBurnedAt harlowPoint wreckNight, and atTowerThatNight brandt harlowPoint
  ⚑ **decay** — m_key slips from the learner's board

### Turn 4
*[The clerk leaves a blank line where a name might have gone, and the room feels the restraint of it more sharply than an accusation. The weather leans against the glass; no paper is lifted, and no witness yet crosses the threshold.]*
**Tutor:** The mate's bearing-book is laid open: dry in its oilskin, it has the Mara from the mid-channel buoy holding sou'-sou'-west a half west for the last hour entire, on a steady fixed light, pricked, timed, and initialed. A bearing is like a debt entry, clerk: it fixes the line owed, not yet the creditor. What does this paper put on your board, and what still waits for the chart?
  — move: analogia → p_bearing (release), releases `p_bearing`
**Learner:** The bearing-book hands me the first column of the ledger: sou'-sou'-west a half west, held steady, on a fixed light — loggedBearingOf goes onto the board now. But Rule 1 wants a second entry before it will run: what tower stands on that bearing from mid-channel? The chart must name it; the bearing alone is the line of credit, not the creditor. Until I have towerOnBearing, Rule 1 sits with one conjunct only, and nothing derives.
  — adopts `loggedBearingOf mara sswHalfWest` · hypothesis: Harlow Point may stand on bearing sswHalfWest from mid-channel — Brandt is its keeper and sole keyholder — but towerOnBearing sswHalfWest harlowPoint is ungrounded until the chart is produced; the chain still wants that fact, then lampBurnedAt harlowPoint wreckNight, and atTowerThatNight brandt harlowPoint before Rule 3 can close

## Act 2 (turns 5–9) — declared by the director
*[The hearing room exhales around the bearing-book, its number seeming colder than any accusation spoken before it. The papers are gathered into a neater stack, and the next silence comes shuttered and narrow, as though the room must now look at what its certainty has left unlit.]*

### Turn 5
*[The hearing room exhales around the bearing-book, its number seeming colder than any accusation spoken before it. The papers are gathered into a neater stack, and the next silence comes shuttered and narrow, as though the room must now look at what its certainty has left unlit.]*
  — *declares the movement: **Act 2** ([The hearing room exhales around the bearing-book, its number seeming colder than any accusation spoken before it. The papers are gathered into a neater stack, and the next silence comes shuttered and narrow, as though the room must now look at what its certainty has left unlit.])*
  — *calls the act closed*
**Tutor:** Before the room narrows itself around any keeper, read back the bearing-book from your own board: what kind of thing did it prove, and what did it leave unproved? Keep the Harlow lock in its own drawer for the moment; a key does not name the tower a ship steered toward.
  — move: erotema → p_bearing (confront)
**Learner:** The bearing-book proved direction, not destination: it grounds loggedBearingOf mara sswHalfWest, but Rule 1 also wants towerOnBearing sswHalfWest for some tower — and no chart or survey has named one yet. Until a tower is placed on that bearing, the chain cannot start. The key stays in its own drawer; it answers a later rule, not this one.
  — hypothesis: Harlow Point may stand on bearing sswHalfWest from mid-channel — but towerOnBearing sswHalfWest harlowPoint remains ungrounded until chart or survey evidence names it; without that, Rule 1 cannot fire and the rest of the chain is suspended
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 4, justified 0, drift 1; arc off_arc
  ⚑ **throughline** — throughline revised (audit_bound)
  ⚑ **decay** — p_bearing slips from the learner's board

### Turn 6
*[Brandt's log is produced and read into the room: "Brandt's log has him at his post the night entire, and the dawn relief found him there: wood dry, glass polished, log ruled and signed to the hour." The certainty in the benches does not break, but it has to change its grip.]*
  — *releases `m_post`*
**Tutor:** Brandt's log is a watch-bill, not a wreck finding: it puts the keeper at Harlow Point for the night, and only there. Set it beside the Harlow key, clerk; which Rule 3 conjuncts now stand for that tower, and which conjunct has still not earned ink?
  — move: analogia → m_post (consolidate)
**Learner:** One conjunct of Rule 3 now stands for Harlow Point: Brandt was at the tower that night. But onlyKeyTo harlowPoint brandt has not yet been formally tendered — keeperOf is not onlyKeyTo — and lampBurnedAt harlowPoint wreckNight remains dark on my board entirely. I must also confess a gap: loggedBearingOf mara sswHalfWest, which I held last act from the bearing-book, seems to have slipped my board — I cannot find it now, and Rule 1 wants it.
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: Harlow Point may stand on bearing sswHalfWest from mid-channel, and Brandt may hold the only key — but towerOnBearing sswHalfWest harlowPoint, onlyKeyTo harlowPoint brandt, and lampBurnedAt harlowPoint wreckNight are all ungrounded; loggedBearingOf mara sswHalfWest has also slipped the board and must be recovered before Rule 1 can fire

### Turn 7
*[The clerk's pen hesitates above the page, leaving a small bead of ink to darken before it falls. Around the table, the old accusation has grown quieter, not kinder, and the room waits for the missing line to be found without being supplied.]*
**Tutor:** Then put the bearing-book back under your hand: dry in its oilskin, it has the Mara from the mid-channel buoy holding sou'-sou'-west a half west for the last hour entire, on a steady fixed light, pricked, timed, and initialed. That restores one line only: loggedBearingOf Mara, sou'-sou'-west a half west. Now keep it there, and do not let Harlow's key spend what the chart has not yet paid.
  — move: exemplum → p_bearing (restore)
**Learner:** The bearing is back under my hand — loggedBearingOf mara sswHalfWest, dry in the oilskin, not to be let slip again. But the chain still wants three links no exhibit has yet supplied: towerOnBearing sswHalfWest for some named tower, lampBurnedAt that tower on the wreck night, and onlyKeyTo it in some named hand. The board holds what it holds; it cannot spend what the chart has not paid.
  — hypothesis: Harlow Point may stand on bearing sswHalfWest from mid-channel — but towerOnBearing sswHalfWest harlowPoint is ungrounded until chart or survey evidence places it there; lampBurnedAt harlowPoint wreckNight is likewise ungrounded; and onlyKeyTo harlowPoint brandt has not been formally tendered — keeperOf is not onlyKeyTo. All three gaps must be filled before Rule 1, Rule 2, and Rule 3 can fire in sequence.
  ⚑ **repair** — p_bearing restored by the tutor

### Turn 8
*[The harbourmaster's storm-order stands in the book: "Harlow Point to shutter at the dusk gun, the channel closed to all sail." The inspector found the shutter drawn and the Board's seal on it unbroken at first light.]*
  — *releases `m_shutter`*
**Tutor:** The storm-order is a sealed hatch, clerk: Harlow Point was ordered shuttered at dusk, and the inspector found the shutter drawn with the Board's seal unbroken at first light. Set that beside Brandt's post and key, but keep it to Harlow. What does a sealed shutter do to any claim that the Mara steered by Harlow's lamp?
  — move: analogia → m_shutter (consolidate)
**Learner:** A sealed shutter with the Board's mark unbroken means Harlow's lamp was dark the night entire — lampBurnedAt harlowPoint wreckNight cannot be entered, and Rule 2 breaks the Harlow chain there, whatever the chart may yet say of bearings. The Mara steered for a fixed burning light — she struck the Knock on that bearing — so the lamp she followed belongs to some other hand and some other tower I have not yet found in evidence. I need to know what stands on sou'-sou'-west a half west from the mid-channel buoy besides Harlow Point.
  — adopts `shutteredOn harlowPoint wreckNight` · hypothesis: The Mara steered by a light NOT at Harlow Point — Harlow was sealed and dark by the Board's own order; the burning fixed light on bearing sswHalfWest belongs to some other tower or hand not yet named in evidence before this court
  ⚑ **decay** — p_bearing slips from the learner's board

### Turn 9
*[The sealed order is left open on the table, and the room seems to draw itself away from Harlow Point without yet finding anywhere else to stand. Rain ticks at the high windows while the chart-case remains closed, its brass catches dull under the lamps.]*
**Tutor:** Lay the rule on the Trinity chart from the mid-channel buoy: sou'-sou'-west a half west crosses one tower and one only on this coast, the old South Stack, struck off the light-list six years since. A chart is a witness to place, not yet to flame. With bearing-book and chart together, what does Rule 1 now yield, and where does Rule 2 still stop you?
  — move: analogia → p_chart (release), releases `p_chart`
**Learner:** The chart gives me what the bearing-book began: towerOnBearing sswHalfWest southStack, one tower, one crossing, entered. But loggedBearingOf mara sswHalfWest has slipped my board again — Rule 1 needs both facts in hand before it yields steeredToward, and the chart cannot carry what the bearing-book must supply; I name that gap aloud and ask it be restored. Even if the bearing-line were back, Rule 2 stops me at South Stack entire: lampBurnedAt southStack wreckNight is ungrounded, and a tower struck off the light-list six years since is not yet a burning lamp. Harlow's chain is equally dead there — the sealed shutter forecloses lampBurnedAt harlowPoint wreckNight by the Board's own mark.
  — adopts `towerOnBearing sswHalfWest southStack` · hypothesis: South Stack stands on bearing sswHalfWest (chart now grounds towerOnBearing); if loggedBearingOf mara sswHalfWest is restored to the board Rule 1 yields steeredToward mara southStack — but lampBurnedAt southStack wreckNight is wholly ungrounded (struck off the light-list six years since), and onlyKeyTo southStack is unnamed; the chain cannot close until both gaps are filled

## Act 3 (turns 10–16) — declared by the director
*[The room changes temperature without any window opening, the old accusation gone and a worse emptiness left in its place. A fresh bundle is brought to the clerk's elbow, tied in stained tape, and the next act begins with the smell of closed places about to be opened.]*

### Turn 10
*[The room changes temperature without any window opening, the old accusation gone and a worse emptiness left in its place. A fresh bundle is brought to the clerk's elbow, tied in stained tape, and the next act begins with the smell of closed places about to be opened.]*
  — *declares the movement: **Act 3** ([The room changes temperature without any window opening, the old accusation gone and a worse emptiness left in its place. A fresh bundle is brought to the clerk's elbow, tied in stained tape, and the next act begins with the smell of closed places about to be opened.])*
  — *calls the act closed*
**Tutor:** Then first restore the slipped line: the mate's bearing-book came ashore dry in its oilskin, and from the mid-channel buoy the Mara held sou'-sou'-west a half west the last hour entire, on a steady fixed light, pricked, timed, and initialed. Shown: logged bearing; shown already: the chart's one tower on that bearing. What does Rule 1 yield when those two shown things stand together?
  — move: anaphora → p_bearing (restore)
  — *the second voice [figure rut]: "Leave off analogia here; restore the bearing in a plainer device before asking Rule 1 to take it up again." (draft analogia → anaphora)*
**Learner:** Rule 1 fires at once, sir: loggedBearingOf mara sswHalfWest and towerOnBearing sswHalfWest southStack stand together on my board, and the rule yields steeredToward mara southStack — I enter it derived. The chain now wants lampBurnedAt southStack wreckNight before Rule 2 can carry us further. South Stack was struck off the light-list six years since, but struck off is not the same as dark — a lamp can burn without authority. Who tends South Stack, and does any witness speak to its lamp that night?
  — derives `steeredToward mara southStack` · hypothesis: South Stack's lamp may have burned on the wreck-night — struck from the official list is not proof of darkness; an unauthorised or private light could account for it — but lampBurnedAt southStack wreckNight, onlyKeyTo southStack ?x, and atTowerThatNight ?x southStack are all ungrounded; Rules 2, 3, and 4 cannot fire until at least lampBurnedAt is established
  ⚑ **act_end** — act 2 closed (director) after 5 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 5, justified 0, drift 1; arc on_arc
  ⚑ **repair** — p_bearing restored by the tutor
  ⚑ **decay** — m_post slips from the learner's board

### Turn 11
*[The stained tape remains uncut for a breath longer than comfort allows, and every eye in the room finds some other object to rest upon. Outside, the rain slackens, leaving the silence inside louder than the weather.]*
**Tutor:** Hold the question at the law's threshold, clerk: South Stack as place is now shown, but South Stack as burning lamp is not. What kind of paper or witness would let Rule 2 move from steeredToward Mara South Stack to steered by that lamp, without yet asking whose hand was near it?
  — move: erotema → — (test)
**Learner:** The rule wants lampBurnedAt southStack wreckNight, and nothing else — whose hand comes later. A deposition from any vessel that logged a fixed light on that bearing that night, or a shore-observer's sworn statement, or physical evidence of oil spent and wick charred found at South Stack after the wreck: any of those would ground it. A keeper's own log would serve too, but South Stack has no named keeper — so the likeliest paper is another ship's night-log, or a coastguard station's observation book. Until one such thing is tendered, lampBurnedAt is bare conjecture and Rule 2 cannot move.
  — hypothesis: lampBurnedAt southStack wreckNight — South Stack's lamp may have burned that night (an unauthorised or private light, or a passing vessel's log may show it), but no witness deposition, ship's log, or physical exhibit has yet grounded this; Rule 2 cannot fire until such evidence is tendered

### Turn 12
*[The clerk's knife rests beside the stained tape, unused, while the room waits on a threshold it cannot argue past. Damp coats steam faintly along the wall, and the empty place where an answer should be seems to gather weight.]*
**Tutor:** Then keep the account open at that exact blank. If Rule 1 has put the Mara toward South Stack, what single conjunct must the next paper prove before Rule 2 may speak at all?
  — move: erotema → — (test)
**Learner:** The account stands open at one line, sir: lampBurnedAt southStack wreckNight. Rule 1 has given us steeredToward mara southStack, and Rule 2 wants only that single conjunct beside it before it may speak. Without that one paper or sworn word — another vessel's night-log, a coastguard entry, a charred wick found — the chain is halted at the threshold and no further step is permitted.
  — hypothesis: lampBurnedAt southStack wreckNight — South Stack's lamp may have burned on the wreck-night (unauthorised, private, or simply unreported), but no deposition, ship's log, coastguard observation, or physical exhibit has yet grounded this; Rule 2 cannot fire until such evidence is tendered

### Turn 13
*[The stained tape is cut, and the court's officer is shown in with salt still dried white along his cuffs. He gives his report to the room: "The court's officer boarded the South Stack at low water: the lamp-room unshuttered, fresh char on the wick, oil in the cup still sweet, the glass wiped clean. That lamp burned, and burned the night of the gale."]*
  — *releases `p_residue`*
**Tutor:** The officer's report is lamp evidence, not hand evidence: unshuttered room, fresh char, sweet oil, clean glass, and a burned South Stack lamp on the gale night. Set it beside your derived line, Mara steered toward South Stack. What does Rule 2 now yield, and where must the account still refuse a name?
  — move: analogia → p_residue (consolidate)
**Learner:** Rule 2 now speaks: the Mara steered toward South Stack, that lamp burned on the gale night — the officer's charred wick and sweet oil ground it — and so she steered by South Stack's lamp. The account advances: steeredByLampOf mara southStack is entered on the record. But the chain halts precisely there: Rules 3 and 4 still want onlyKeyTo southStack for some hand, and atTowerThatNight that hand southStack, before any name may close the account. Whose key, and whose presence at that tower — the record is silent on both, and I will not write a name the evidence has not yet spelled.
  — adopts `lampBurnedAt southStack wreckNight` · derives `steeredByLampOf mara southStack` · hypothesis: Whoever held the only key to South Stack and stood at that tower on the wreck-night lit the lamp the Mara steered by — but onlyKeyTo southStack ?x and atTowerThatNight ?x southStack are wholly ungrounded; no name can enter until both conjuncts are tendered

### Turn 14
*[The officer's report lies open under the clerk's hand, its ink drying into the silence it has made. Around the table, every face turns from the lamp itself toward the locked question beyond it, and no one yet has leave to cross.]*
**Tutor:** Before we spend the officer's report another inch, read it back from your own board. What exactly did that exhibit prove for South Stack, and what did it leave still unproved about any hand?
  — move: erotema → p_residue (confront)
  — *the second voice [unconfronted reentry]: "Confront p_residue first: ask the learner to read back what they hold from that exhibit before you use it again." (draft anaphora → erotema)*
**Learner:** The officer's report proved one thing and one thing only: lampBurnedAt southStack wreckNight — the physical signs, unshuttered room, fresh char, sweet oil, clean glass, put that beyond dispute. It proved nothing about any hand: no one was named as keyholder, no one was placed at that tower on the gale-night. The board therefore holds steeredByLampOf mara southStack as derived, and halts precisely there — onlyKeyTo southStack and atTowerThatNight stand empty, and without both conjuncts Rule 3 cannot speak and Rule 4 has nothing to carry forward.
  — hypothesis: Whoever held the only key to South Stack and stood at that tower on the wreck-night lit the lamp the Mara steered by — but onlyKeyTo southStack ?x and atTowerThatNight ?x southStack are wholly ungrounded; no name can close the account until both conjuncts are tendered in evidence

### Turn 15
*[The court waits with the patience of a locked door. The clerk sets a clean space beside the officer's report, and the silence gathers there as if it expects another paper to occupy it.]*
**Tutor:** The locksmith's book is laid beside the officer's report: when the Stack was struck off, the old lock was changed and a single key cut, signed for by Senna, ward of the last keeper, who stayed on in the shore cottage after the light went dark. A key is a signature on access, not yet a footprint on the stair. With South Stack's lamp burned and its only key now named, what conjunct does Rule 3 still require before any hand may be written as having lit it?
  — move: analogia → p_key (release), releases `p_key`
**Learner:** The locksmith's entry settles the key: Senna held the only key to South Stack, and that goes onto the board. Rule 3 now holds two of its three conjuncts — lampBurnedAt southStack wreckNight and onlyKeyTo southStack senna — but the third, atTowerThatNight senna southStack, has not been tendered. A key in Senna's hand is not a footprint on the stair; without that last conjunct Rule 3 is silent, and no name may be written as having lit the lamp the Mara steered by.
  — adopts `onlyKeyTo southStack senna` · hypothesis: Senna held the only key to South Stack — Rule 3 now has two of three conjuncts (lampBurnedAt southStack wreckNight, onlyKeyTo southStack senna); the chain still wants atTowerThatNight senna southStack before litLampOf senna southStack can be entered, and no binding follows until that fact is tendered in evidence

### Turn 16
*[The papers already admitted seem to weigh more than the table beneath them. No one reaches for the door, and yet the whole room listens toward it.]*
**Tutor:** Before that key-entry is used again, clerk, read it back from your own board and not from my mouth. What exactly did the locksmith's paper prove, and what did it leave still outside the ink?
  — move: erotema → p_key (confront)
  — *the second voice [unconfronted reentry]: "Confront p_key first: ask the learner to read back exactly what they hold from that exhibit before you use it again." (draft anaphora → erotema)*
**Learner:** Board entry eight — onlyKeyTo southStack senna — rests on the locksmith's paper alone: when the old lock was changed after the Stack was struck off, a single key was cut and Senna, ward of the last keeper, signed for it. That is all the paper proved: it names the keyholder, not a footprint on any stair. What it left outside the ink is precisely atTowerThatNight senna southStack — no deposition, no log, no witness has yet placed Senna at the tower on the gale-night. Rule 3 still wants that third conjunct, and without it no hand may be written as having lit the lamp.
  — hypothesis: Senna held the only key to South Stack and may have climbed the stair on the wreck-night — but atTowerThatNight senna southStack is wholly ungrounded; no evidence has yet placed Senna at the tower that night, and Rule 3 cannot fire until that conjunct is tendered

## Act 4 (turns 17–20) — declared by the director
*[The locked book is closed, and its clasp sounds too small for the silence that follows. The room shifts from papers to thresholds: rain taps the panes, the door stands watched, and the next act begins with the pressure of the outside night coming in.]*

### Turn 17
*[The locked book is closed, and its clasp sounds too small for the silence that follows. The room shifts from papers to thresholds: rain taps the panes, the door stands watched, and the next act begins with the pressure of the outside night coming in.]*
  — *declares the movement: **Act 4** ([The locked book is closed, and its clasp sounds too small for the silence that follows. The room shifts from papers to thresholds: rain taps the panes, the door stands watched, and the next act begins with the pressure of the outside night coming in.])*
  — *calls the act closed*
**Tutor:** The clasp has closed on access, not on presence. From your own board, which Rule 3 conjunct is still outside the door, and what kind of witness could place it there without turning a key into a footprint?
  — move: erotema → — (orient)
**Learner:** The conjunct still outside the door is atTowerThatNight senna southStack — presence, not access. My board now yields Rule 1 and Rule 2 clean: the Mara steered toward South Stack, and the burning lamp there is what she steered by. An observation witness — someone who saw Senna on the cliff path, at the tower base, or through a window that night, no key in hand — could ground presence without re-proving custody of the key. Until such a witness steps forward, Rule 3 cannot fire and the account stays open.
  — hypothesis: atTowerThatNight senna southStack — Senna may have been at South Stack on the wreck-night (they hold the only key, and the lamp burned), but no observation witness, patrol log, or deposition has yet placed them there in evidence before this court; Rule 3 cannot fire until that conjunct is tendered
  ⚑ **act_end** — act 3 closed (director) after 7 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 4, justified 0, drift 2; arc off_arc
  ⚑ **throughline** — throughline revised (audit_bound)

### Turn 18
*[The rain keeps its own minutes against the glass, soft at first and then harder. In the room, the empty chair nearest the door remains turned a little outward, as if it has been waiting longer than anyone will admit.]*
**Tutor:** Keep the empty chair empty until a witness sits in it, clerk. Not the key-entry, not the burned lamp, but only the presence line can change when the outside night comes through that door. Until then, Rule 3 remains two shown conjuncts and one unshown threshold.
  — move: anaphora → — (consolidate)
  — *the second voice [figure rut]: "Leave off erotema for this turn; make the witness-threshold move without another question." (draft erotema → anaphora)*
**Learner:** No new exhibit crosses the threshold tonight; the empty chair holds its silence. Yet the rules have already earned two conclusions I have not yet formally entered: the Mara's logged bearing sswHalfWest, met by South Stack on that bearing, yields steeredToward — and the burning lamp there, met by that conclusion, yields steeredByLampOf. Both I enter on the record now. Rule 3 still waits on the one conjunct the night has not yet surrendered: Senna at the tower.
  — hypothesis: atTowerThatNight senna southStack — Senna may have been at South Stack on the wreck-night (they hold the only key, and the lamp burned), but no observation witness, patrol log, or deposition has yet placed them there in evidence before this court; Rule 3 cannot fire until that conjunct is tendered

### Turn 19
*[The room holds at the edge of speech: papers lie squared, the chair by the door still angled toward the weather. No one reaches for the latch, and the question hangs in the damp air with nowhere yet to settle.]*
**Tutor:** Two entries are inked, and the third is still weather outside the door. If a witness later placed the keyholder at South Stack that night, would Rule 3 yield a lit lamp at once, or must the court first pass each conjunct under its finger? Do not name the hand; name the order of proof.
  — move: erotema → — (test)
**Learner:** Rule 3 does not re-examine what the board already holds: two conjuncts stand grounded now, and the moment atTowerThatNight senna southStack is admitted, the rule fires at once — the court passes each conjunct under its finger only once, and what is grounded stays grounded. The missing fact completes a set, not a new sequence; presence is the last lock, and the key to it is a witness, not a key-ring.
  — hypothesis: atTowerThatNight senna southStack — Senna may have been at South Stack on the wreck-night (they hold the only key, and the lamp burned), but no observation witness, patrol log, or deposition has yet placed them there in evidence before this court; Rule 3 cannot fire until that conjunct is tendered

### Turn 20
*[The oyster-watch is shown in, salt still white on his cuffs, and the room receives his oath: "The oyster-watch will swear to it: a skiff lay tied at the Stack steps from dusk until the gale's height — Senna's skiff, by the patched brown lug, and a small light moving up the tower stair."]*
  — *releases `p_skiff`*
**Tutor:** The oyster-watch gives presence, not verdict: a skiff at the Stack steps, Senna's patched brown lug, and a small light moving up the tower stair. Shown burned lamp, shown only key, now shown presence — pass those three conjuncts under your finger, clerk. What does Rule 3 yield before Rule 4 is even opened?
  — move: anaphora → p_skiff (consolidate)
**Learner:** The three conjuncts stand together at last: lampBurnedAt southStack wreckNight, onlyKeyTo southStack senna, and now atTowerThatNight senna southStack sworn by a salt-cuffed witness — Rule 3 yields litLampOf senna southStack without pause. Rules 1 and 2 were already earned from the logged bearing and the burning lamp; Rule 4 takes steeredByLampOf and litLampOf and closes the chain entire. The carry checks, and the sum is Senna's.
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
  - Act 1 (turns 1–4): 0.25 D/turn (ΔD 1)
  - Act 2 (turns 5–9): 0 D/turn (ΔD 0)
  - Act 3 (turns 10–16): 0.429 D/turn (ΔD 3)
  - Act 4 (turns 17–20): 0.25 D/turn (ΔD 1)
- **plateau** longest flat stretch 4 turns (aporia window 6)
- **releases** 7/8 on cue · 1 deviated
- **decay** 4 slips (seed 1 · rate 0.75 · grace 1) · repaired 2 (tutor 2, re-adoption 0) · mean repair latency 2 turns · unrepaired at end 2 · degraded-turn integral 31 · D reversals 1
- **theory fidelity** F 0.833 at end · min 0.714
  - m_key t3 (never repaired) · p_bearing t5→t7 (tutor) · p_bearing t8→t10 (tutor) · m_post t10 (never repaired)
- **events** plot×4 · throughline×3 · decay×4 · act_end×3 · plot_audit×4 · repair×2 · forced×1 · grounded_anagnorisis×1
- **staging** 4 movements declared by the director
- **acts** 4 played · closed by the director 3 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–9 (director) · Act 3 t10–16 (director) · Act 4 t17–20 (run end)
- **plot** 4 committed · withhold+friction on 4/4 · 5.75 clauses avg · audits 4 (incl. final act): kept 18 / justified 0 / drift 4 · hold-named exhibits staged in act 0/3
- **throughline** 3 commits (opening 1 · recommit 0 · audit-bound 2 · voluntary 0) · all four clauses on 3/3 · arc verdicts 4: on 2 / off 2 · run-end reckoning 7 clauses: kept 7 / justified 0 / drift 0
- **release authority** 3 played: 2 on schedule · 0 held · 1 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_key -2 (t15): "Played two turns early because the learner has cleanly halted at the missing South Stack key and presence conjuncts, so the key can advance the law without reaching the final hand."
- **confrontation** 3 demanded (1 against a slipped exhibit) · re-entries 0: covered 0, uncovered 0 · watcher fires 2 (became the confrontation 2) · fires without recorded due 0
  - **repair clause** restores 2 (2 repaired a real slip) · watcher fires on restore claims 0: p_bearing t7 · p_bearing t10
- **figures** erotema 9/20 (45%) · 4 distinct · switch rate 0.84
- **superego** intervened 4/20 watched turns · figure changed within-turn on 4/4 interventions · switch on intervention 1.00 vs elsewhere 0.80
- **inference** 3 voiced · stall integral 0 · overreach 0 · mischanneled 0 — `steeredToward mara southStack` available t10 → voiced t10 (latency 0) · `steeredByLampOf mara southStack` available t13 → voiced t13 (latency 0) · `litLampOf senna southStack` available t20 → voiced t20 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 20 | 3.05 | 4 | 44.3 |
| tutor | 20 | 2.5 | 3 | 51.2 |
| learner | 20 | 3.4 | 4 | 80.3 |
