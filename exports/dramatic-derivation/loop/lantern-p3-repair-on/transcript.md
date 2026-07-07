# The Light on the Knock — lantern-p3-repair-on

> world `world_002_lantern` · verdict **grounded_anagnorisis** · 20/26 turns
> S forced at turn 20; asserted grounded at turn 20

```
D= 5 ●●··│····│·······│···│··
D= 4   ●●│●●●·│··●····│···│··
D= 3     │   ●│●● ●●●●│···│··
D= 2     │    │       │●··│··
D= 1     │    │       │ ●●│●·
D= 0     │    │       │   │ ◉
turn      │+   │ 1    +│   │ 2 (+=5, digit=x10)
rel    ▲▲ │ ▲▲▲│    ▲  │ ▲ │ ▲ (▲ = evidence released)
slope 0.25 D/turn overall (D 5→0); per movement: 1 0.25 │ 2 0.25 │ 3 0.00 │ 4 0.67 │ 5 0.50
```

## Act 1 (turns 1–4) — declared by the director
*[The hearing room gathers itself under a thin morning light; wet coats steam at the rail, and the empty witness chair faces the bench. A clerk sets a clean sheet beside the inkwell, leaving the first line blank.]*

### Turn 1
*[The hearing room gathers itself under a thin morning light; wet coats steam at the rail, and the empty witness chair faces the bench. A clerk sets a clean sheet beside the inkwell, leaving the first line blank.]*
  — *declares the movement: **Act 1** ([The hearing room gathers itself under a thin morning light; wet coats steam at the rail, and the empty witness chair faces the bench. A clerk sets a clean sheet beside the inkwell, leaving the first line blank.])*
**Tutor:** Set down no name yet, clerk. Before a court writes whose light, what must the first line of proof fix?
  — move: erotema → — (orient)
**Learner:** The first line must fix the Mara's logged bearing that night, sir — the precise bearing she held when she ran for the light. Without that, the rule cannot tell us which tower stood in her path, and the rest of the chain cannot be laid.
  — hypothesis: The Mara steered for Harlow Point — Brandt's tower — but I cannot ground that until her logged bearing is in evidence and a tower is shown to stand on it.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[A Board rule-book is opened at the rail, its damp leather cover creaking as the clerk reads into the room: "Harlow Point keeps one key to its lamp-room and the keeper keeps it: Brandt's, on his own belt, by the Board's standing rule. No other hand could touch that lamp."]*
  — *releases `m_key`*
**Tutor:** A key is a signature only after the paper names the door it signs for. Brandt's belt may bind Harlow Point, but what has the court not yet fixed before Harlow can enter the account?
  — move: analogia → m_key (consolidate)
**Learner:** The key names the door, sir, but the door must first stand on the Mara's bearing before it opens into our chain. We have no logged bearing in evidence yet, and no witness has placed Harlow Point on any bearing from the channel. Until those two facts are fixed, the key on Brandt's belt proves nothing for the wreck — it is a fact waiting for a bearing to make it useful.
  — adopts `onlyKeyTo harlowPoint brandt` · hypothesis: The Mara steered for Harlow Point — Brandt's tower — but this cannot be grounded until (1) her logged bearing on the wreck night is in evidence and (2) Harlow Point is shown to stand on that bearing from the channel.

### Turn 3
*[Rain ticks at the high windows while the clerk's pen hovers above the blank line. The witness chair remains empty, and the room waits on a number no one has yet put into evidence.]*
**Tutor:** The mate's bearing-book comes ashore dry in its oilskin: from the mid-channel buoy the Mara held sou'-sou'-west a half west the last hour entire, on a steady fixed light, pricked, timed, and initialed. A bearing is the court's first ruled line; what does that line now let you ask, and what does it still not answer?
  — move: analogia → p_bearing (release), releases `p_bearing`
**Learner:** The bearing gives the court its first ruled line at last, sir — sou'-sou'-west a half west, pricked, timed, and initialed, it stands in evidence. Now I may ask which tower the chart or a witness places on that bearing from mid-channel; Rule 1 waits on exactly that one fact. What the bearing still will not answer: no exhibit yet sets any tower on SSW½W, so Harlow Point — though Brandt alone holds its key — has not been placed in the Mara's path.
  — adopts `loggedBearingOf mara sswHalfWest` · hypothesis: Harlow Point stands on bearing SSW½W from mid-channel — if a chart or witness confirms it, the chain reaches Brandt — but no exhibit has yet placed any tower on that bearing.
  ⚑ **decay** — m_key slips — misremembered as "onlyKeyTo harlowPoint senna"

### Turn 4
*[The room holds on the wet hush after the bearing is spoken; the clerk underlines the blank beside it but writes no tower's name. At the bench, the map-case remains latched, its brass corners catching the thin light.]*
**Tutor:** Before the map-case opens, read back the bearing-book from your own sheet. What exactly has it fixed, and what must the chart still supply before any key or keeper can weigh an ounce?
  — move: erotema → p_bearing (confront)
**Learner:** The bearing-book fixes one fact only, sir: loggedBearingOf mara sswHalfWest — nothing more, nothing less. Rule 1 still needs its second clause: a chart or witness must place a tower on that bearing from mid-channel before any key or keeper enters the chain. And I must flag a corruption on my own sheet: index 5 reads 'senna' where the rule-book from the stage plainly named Brandt — I retract the false entry and restore the grounded form as onlyKeyTo harlowPoint brandt.
  — retracts `onlyKeyTo harlowPoint senna` · hypothesis: Harlow Point stands on bearing SSW½W from mid-channel — if a chart or witness confirms towerOnBearing sswHalfWest harlowPoint, Rule 1 fires and the chain reaches Brandt — but no exhibit has yet placed any tower on that bearing.
  ⚑ **retract_false** — m_key: false form "onlyKeyTo harlowPoint senna" retracted

## Act 2 (turns 5–8) — declared by the director
*[The map-case is carried nearer but not opened; its straps creak in the room's held breath. Outside, the rain slackens to a thin hiss, and the bench seems to wait for certainty to find either a door or a void.]*

### Turn 5
*[The map-case is carried nearer but not opened; its straps creak in the room's held breath. Outside, the rain slackens to a thin hiss, and the bench seems to wait for certainty to find either a door or a void.]*
  — *declares the movement: **Act 2** ([The map-case is carried nearer but not opened; its straps creak in the room's held breath. Outside, the rain slackens to a thin hiss, and the bench seems to wait for certainty to find either a door or a void.])*
  — *calls the act closed*
**Tutor:** Then mend the sheet before the map is touched: Harlow Point keeps one key to its lamp-room, and by the Board's standing rule that key is Brandt's, on his own belt; no other hand could touch that lamp. A key proves only its own door until the chart puts that door on the Mara's bearing.
  — move: analogia → m_key (restore)
**Learner:** The tutor confirms what my board already holds — one key, one hand — and I am grateful for the reminder that a key proves only its door. But until that door is placed on the Mara's bearing, Rule 1 will not fire and I am still short one grounded fact: towerOnBearing sswHalfWest harlowPoint. The map-case sits two feet from this bench; open it.
  — hypothesis: Harlow Point stands on bearing SSW½W from mid-channel — if the chart confirms towerOnBearing sswHalfWest harlowPoint, Rule 1 fires and the full chain to Brandt closes.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 5, justified 0, drift 0; arc on_arc
  ⚑ **repair** — m_key restored by the tutor

### Turn 6
*[Brandt's log is laid beneath the clerk's hand, its ruled pages turned for the room: Brandt's log has him at his post the night entire, and the dawn relief found him there: wood dry, glass polished, log ruled and signed to the hour.]*
  — *releases `m_post`*
**Tutor:** Brandt's log puts the keeper at Harlow Point as neatly as a watch-bill puts a man at his station. But a man at his station is not yet a light in the Mara's path; what conjunct of Rule 1 still lies unopened in that map-case?
  — move: analogia → m_post (consolidate)
**Learner:** Brandt's log is grounded: he was at his post the night entire, and the dawn relief found him there — atTowerThatNight enters the board. That satisfies Rule 3's third conjunct, but Rule 3 still wants lampBurnedAt, and Rule 1 still wants towerOnBearing sswHalfWest harlowPoint — the very conjunct the tutor points to. Both gaps live in that map-case. Open it.
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: Harlow Point stands on bearing SSW½W from mid-channel — if the chart confirms towerOnBearing sswHalfWest harlowPoint, Rule 1 fires and, with lampBurnedAt supplied, the full chain to Brandt closes.
  ⚑ **decay** — m_key slips — misremembered as "onlyKeyTo southStack brandt"
  ⚑ **decay** — p_bearing slips from the learner's board

### Turn 7
*[The clerk's fingers rest on the map-case buckles without lifting them; leather and brass answer only with a small dry sound. The room holds its shape around the unopened case, every face turned toward the place where certainty has not yet appeared.]*
**Tutor:** Then open it: lay the rule on the Trinity chart from the mid-channel buoy, and sou'-sou'-west a half west crosses one tower and one only on this coast — the old South Stack, struck off the light-list six years since. A chart is no verdict; it only marries a ruled line to a tower. What does Rule 1 now yield, and what question has it still not touched?
  — move: exemplum → p_chart (release), releases `p_chart`
**Learner:** The chart is a cold surprise: sou'-sou'-west a half west falls on South Stack, not Harlow Point — the town has been pointing at the wrong tower for a week. Rule 1 needs the Mara's logged bearing on my board, and I confess that entry has slipped between acts; I ask the court to confirm it was in evidence. Were it restored, Rule 1 would yield 'steeredToward mara southStack' — yet it says nothing of whether a decommissioned lamp burned that night, which is Rule 2's want. My board already sits uneasily: Brandt holds South Stack's only key, yet his own log places him at Harlow Point — the key was his, but was he at that door?
  — adopts `towerOnBearing sswHalfWest southStack` · hypothesis: South Stack's lamp burned on the wreck night as an unlisted light, and Brandt's is the only key to that room; but the chain under Rule 3 requires him at South Stack that night, which his log flatly contradicts — either the log is false, or another question has not yet been asked.

### Turn 8
*[The harbourmaster's storm-order stands in the book: Harlow Point to shutter at the dusk gun, the channel closed to all sail. The inspector found the shutter drawn and the Board's seal on it unbroken at first light.]*
  — *releases `m_shutter`*
**Tutor:** Then restore the first ruled line before any shutter or keeper weighs in: the mate's bearing-book came ashore dry in its oilskin, and from the mid-channel buoy the Mara held sou'-sou'-west a half west the last hour entire, on a steady fixed light, pricked, timed, and initialed. Put that beside the chart you just opened: bearing and tower together yield what, and what has the law still not shown?
  — move: exemplum → p_bearing (restore)
**Learner:** Rule 1 now closes: bearing logged, tower charted, the Mara steered toward South Stack. The mate's 'steady fixed light' is nearly enough to ground lampBurnedAt southStack, but it is description, not yet a grounded exhibit, and Rule 2 stands idle until it is. Even were it grounded, Rule 3 would then want Brandt at South Stack — yet my board holds him at Harlow Point all that night. The shutter darkens Harlow Point neatly, but it does not move the keeper one step toward South Stack's lamp-room.
  — adopts `shutteredOn harlowPoint wreckNight` · derives `steeredToward mara southStack` · hypothesis: The mate's bearing-book phrase 'steady fixed light' on bearing sswHalfWest, with South Stack the only tower on that bearing, should ground lampBurnedAt southStack wreckNight — but this must be formally entered as an exhibit before Rule 2 fires; and even then, Rule 3 cannot close because atTowerThatNight brandt southStack is flatly contradicted by board entry 5, unless Brandt's log is false or another hand held a copy of his key.
  ⚑ **repair** — p_bearing restored by the tutor
  ⚑ **decay** — m_post slips — misremembered as "atTowerThatNight senna harlowPoint"

## Act 3 (turns 9–15) — declared by the director
*[The chart is folded back into its case, leaving the room larger and less certain than before. A salt-stained packet is set at the clerk's elbow, unopened, and the inquiry turns from bearings and orders toward what touch, soot, and silence may be made to bear.]*

### Turn 9
*[The chart is folded back into its case, leaving the room larger and less certain than before. A salt-stained packet is set at the clerk's elbow, unopened, and the inquiry turns from bearings and orders toward what touch, soot, and silence may be made to bear.]*
  — *declares the movement: **Act 3** ([The chart is folded back into its case, leaving the room larger and less certain than before. A salt-stained packet is set at the clerk's elbow, unopened, and the inquiry turns from bearings and orders toward what touch, soot, and silence may be made to bear.])*
  — *calls the act closed*
**Tutor:** Read back the key exhibit from your own board, clerk: which door did the rule-book govern, and whose hand did it put there? Do not let the chart carry a key across the coast by habit; let the paper answer before soot is heard.
  — move: erotema → m_key (confront)
**Learner:** Rule 1 settles one step now, without the packet: the Mara logged SSW½W, South Stack alone stands on that bearing, so she steered toward South Stack — I'll voice that and enter it. The rule-book's door is South Stack's lamp-room, and entry five puts the only key in Brandt's hand alone. But Rule 2 wants lampBurnedAt southStack wreckNight, and Rule 3 wants Brandt at that tower on the night — neither is yet grounded. I will not touch the packet's evidence until the court opens it; the chain waits.
  — hypothesis: The salt-stained packet will ground lampBurnedAt southStack wreckNight through physical evidence of burning; combined with entry 5, only atTowerThatNight brandt southStack remains needed to close Rule 3 and settle the question.
  ⚑ **act_end** — act 2 closed (director) after 4 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 4, justified 1, drift 1; arc on_arc

### Turn 10
*[The unopened packet lies between the inkstand and the candle, its salt whitening as it dries in the court's warmth. Outside, the wind worries the shutters, and the room waits on paper that has not yet been touched.]*
**Tutor:** Mend that entry now: the Board rule-book governs Harlow Point, and Harlow Point's lamp-room key was Brandt's on his belt; it says nothing of South Stack's door. A key is a signature only for the door named on the paper. With Rule 1 already pointing the Mara toward South Stack, what burned-lamp proof is still missing before any hand can be weighed?
  — move: analogia → m_key (restore)
**Learner:** I strike entry six — the rule-book names Harlow Point's door only, and I had no paper to put that key at South Stack; habit carried it there, not evidence. Rule 1 now fires cleanly: the Mara logged SSW½W and South Stack alone stands on that bearing, so she steered toward South Stack — I enter that derivation. What the chain still wants is lampBurnedAt southStack wreckNight before Rule 2 can light the lamp she steered by. And with entry six gone, Rule 3 has no keyholder named for South Stack even when the burn is shown — a further exhibit must place that key in some specific hand.
  — retracts `onlyKeyTo southStack brandt` · hypothesis: lampBurnedAt southStack wreckNight is still ungrounded; and with onlyKeyTo southStack now struck for want of paper, even confirming the burn leaves Rule 3 without a named keyholder — the packet or another witness must supply both facts before any hand can be held responsible.
  ⚑ **repair** — m_key restored by the tutor
  ⚑ **retract_false** — m_key: false form "onlyKeyTo southStack brandt" retracted
  ⚑ **decay** — p_bearing slips from the learner's board

### Turn 11
*[The clerk's knife rests beside the salt-stained packet, unused, while the candle gutters and steadies again. Around the table, the absence left by the struck key hangs heavier than any accusation.]*
**Tutor:** Good; keep the Harlow key ashore where its paper leaves it. If the Mara is now fixed toward South Stack, what sort of proof must the unopened packet give before the law may say she steered by that lamp, not merely toward that tower?
  — move: erotema → — (test)
**Learner:** Rule 2 draws that line exactly, sir: a dark tower steers no one — the packet must prove lampBurnedAt southStack wreckNight before 'toward' becomes 'by,' whether through soot on the glass, a drawn-down oil measure, or a burned wick the paper can certify to that night. I also find a gap my board should not carry: entry 5 sets South Stack on bearing SSW½W, yet loggedBearingOf mara sswHalfWest is nowhere in my entries — that fact has slipped the act boundary, and until it is restored I cannot voice steeredToward mara southStack as a formal derivation, only as ground I believe was laid.
  — hypothesis: lampBurnedAt southStack wreckNight — the salt-stained packet may supply this, but it is unopened and no physical proof of burning is yet grounded; loggedBearingOf mara sswHalfWest also appears to have slipped the board, leaving Rule 1 formally unspoken.

### Turn 12
*[The salt-stained packet remains shut, its string dark against the clerk's blotter. The room holds itself between the struck entry and the unopened proof, with every face turned toward the same small weight of paper.]*
**Tutor:** Restore the ruled line: the mate's bearing-book came ashore dry in its oilskin, and from the mid-channel buoy the Mara held sou'-sou'-west a half west the last hour entire, on a steady fixed light, pricked, timed, and initialed. Put that entry back beside the chart's one tower, and tell the court what Rule 1 may now say without borrowing one grain from the unopened packet.
  — move: analogia → p_bearing (restore)
**Learner:** Entry five was on the board all along — I was wrong to call it lost; the mate's oilskin kept it dry and the court has had it in hand. With bearing sswHalfWest logged and South Stack the one tower standing on that bearing, Rule 1 fires: the Mara steered toward South Stack — I voice that now and enter it. The chain halts there: no paper yet proves the lamp burned, so 'toward the tower' cannot yet become 'by the lamp.' The packet must open before Rule 2 may speak.
  — hypothesis: The salt-stained packet will ground lampBurnedAt southStack wreckNight; thereafter the chain needs onlyKeyTo southStack and atTowerThatNight for some named hand before Rule 3 and Rule 4 can settle the question.
  ⚑ **repair** — p_bearing restored by the tutor
  ⚑ **decay** — p_chart slips from the learner's board

### Turn 13
*[The court's officer is shown in at the clerk's call, salt still whitening the cuffs of his coat. He lays his report open: The court's officer boarded the South Stack at low water: the lamp-room unshuttered, fresh char on the wick, oil in the cup still sweet, the glass wiped clean. That lamp burned, and burned the night of the gale.]*
  — *releases `p_residue`*
**Tutor:** Soot is a log-book written in the lamp-room itself: char on the wick, sweet oil in the cup, glass wiped clean, and the officer says South Stack burned that gale-night. Put that beside the tower already fixed on the Mara's bearing. What does Rule 2 now allow you to say, and what hand-question has it still not answered?
  — move: analogia → p_residue (consolidate)
**Learner:** The officer's report closes Rule 2: South Stack's lamp burned on the wreck night, and the Mara's logged bearing already fixes that tower as the one she steered toward — so she steered by South Stack's lamp, and I voice that now. Rule 2 settles the lamp, not the hand: it says nothing of who lit it. The hand-question still open is Rule 3's — whose key opened South Stack's lamp-room, and was that hand at the tower that night? Until onlyKeyTo southStack and atTowerThatNight are grounded, the final chain cannot close.
  — adopts `lampBurnedAt southStack wreckNight` · hypothesis: Some named hand held the only key to South Stack's lamp-room and was at that tower on the wreck night — but neither fact is yet grounded; without both, Rule 3 cannot name who lit the lamp the Mara steered by.
  ⚑ **overreach** — steeredToward mara southStack
  ⚑ **overreach** — steeredByLampOf mara southStack

### Turn 14
*[The officer's report lies open under the clerk's hand, its damp edges flattening as the room grows still. No one reaches for the next paper; the silence gathers around the closed places a lamp-room leaves behind.]*
**Tutor:** Before we use the officer's report again, read it back from your own board. What exactly did that paper prove, and what did it leave wholly unproved?
  — move: erotema → p_residue (confront)
  — *the second voice [unconfronted reentry]: "Confront first: ask the learner to read back what they hold from that exhibit before you build on it again. Do not restate the exhibit for them." (draft anaphora → erotema)*
**Learner:** The officer's report proved one thing only: entry eight — lampBurnedAt southStack wreckNight. It said nothing of who held the key to that lamp-room and nothing of who stood there that night. And reading my board scrupulously now, the chain is broken earlier still: towerOnBearing sswHalfWest southStack is nowhere on it, so Rule 1 cannot formally fire from what I hold — I was voicing more than the board had grounded.
  — hypothesis: towerOnBearing sswHalfWest southStack — without this entry, Rule 1 cannot fire and no derived chain can begin; the chart or a witness must supply it before any conclusion may be voiced.

### Turn 15
*[The clerk's pen pauses above the page, leaving a small bead of ink to darken and spread. Around the table, faces turn not toward any new paper, but toward the empty space where a missing step has just been named.]*
**Tutor:** Before any key is touched, clerk, read back the chart exhibit from your own board. What did that paper place on the Mara's logged bearing, and what did it leave outside its ruling? Let the chart answer in your words, not mine.
  — move: erotema → p_chart (confront)
  — *the second voice [unconfronted reentry]: "Confront p_chart first. Ask the learner to read back what they actually hold from that exhibit, without restoring or restating it for them." (draft exemplum → erotema)*
**Learner:** Reading my board honestly: entry 5 gives me the logged bearing, SSW½W, but no entry places any tower on that bearing — towerOnBearing sswHalfWest southStack is simply not there. If a chart came before the court and named South Stack as the tower on that bearing, I never formally adopted that fact, and my board holds the gap bare. The chart, as my record stands, proved nothing about which tower the Mara's bearing pointed toward — it left that placement wholly ungrounded on my side of the table. Until that entry appears and is adopted, Rule 1 cannot fire from what I hold.
  — hypothesis: towerOnBearing sswHalfWest southStack — a chart or witness must supply this before Rule 1 can fire; without it the entire derived chain (steeredToward, steeredByLampOf, litLampOf, steeredByLightOf) remains formally closed.

## Act 4 (turns 16–18) — declared by the director
*[The clerk closes the empty docket with more care than force, and the room exhales as if the air itself has been cross-examined. Beyond the windows, the gale shifts against the glass; when the next door opens, the inquiry will no longer be content with papers alone.]*

### Turn 16
*[The clerk closes the empty docket with more care than force, and the room exhales as if the air itself has been cross-examined. Beyond the windows, the gale shifts against the glass; when the next door opens, the inquiry will no longer be content with papers alone.]*
  — *declares the movement: **Act 4** ([The clerk closes the empty docket with more care than force, and the room exhales as if the air itself has been cross-examined. Beyond the windows, the gale shifts against the glass; when the next door opens, the inquiry will no longer be content with papers alone.])*
  — *calls the act closed*
**Tutor:** Then restore the chart plainly: lay the rule on the Trinity chart from the mid-channel buoy, and sou'-sou'-west a half west crosses one tower and one only on all this coast — the old South Stack, struck off the light-list six years since. Put that beside the mate's bearing-book and the officer's burned-lamp report. What may the court now say from those three papers, and what kind of proof must still name the hand?
  — move: exemplum → p_chart (restore)
**Learner:** The three papers do what the rules ask of them: the Trinity chart gives the tower, the bearing-book gives the line, and the officer's report gives the burning lamp — Rules 1 and 2 fire together, and the court may now say the Mara steered by South Stack's lamp. But 'steered by the lamp' and 'steered by the light of a named hand' are not the same sentence. Rule 3 wants two papers still missing from this table: who held the only key to South Stack's lamp-room, and who stood at that tower on the night — without both, no hand can be held, and the account stays open.
  — derives `steeredByLampOf mara southStack` · hypothesis: Some named hand held the only key to South Stack's lamp-room and was at that tower on the wreck night — the inquiry must produce both facts before Rule 3 names the lighter and Rule 4 settles whose light the Mara steered by.
  ⚑ **act_end** — act 3 closed (director) after 7 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 3, justified 2, drift 0; arc on_arc
  ⚑ **repair** — p_chart restored by the tutor
  ⚑ **decay** — m_key slips — misremembered as "onlyKeyTo southStack brandt"

### Turn 17
*[The room does not move at once; even the papers seem to wait under the clerk's hand. Outside, the gale presses hard against the panes, and the empty doorway holds the court's attention longer than any exhibit on the table.]*
**Tutor:** The locksmith's book is exact: when the Stack was struck off, the old lock was changed and a single key cut, signed for by Senna, ward of the Stack's last keeper, who stayed on in the shore cottage when the light went dark. A key is a hand's claim only if the same hand is put at the door. What does this paper now supply for Rule 3, and what conjunct still stands empty?
  — move: analogia → p_key (release), releases `p_key`
**Learner:** The locksmith's book strikes brandt from the board: Senna signed for the only key when South Stack was delisted, and I must enter that corrected form. Rule 3 now holds two of its three conjuncts — the lamp burned at South Stack, and Senna held the only key. But the third conjunct, Senna at South Stack on the wreck night, is not in evidence; board entry 7 puts Senna at Harlow Point, and a key held across the water lights no lamp. Until a witness or paper moves Senna to the Stack, the rule will not name a hand.
  — adopts `onlyKeyTo southStack senna` · retracts `onlyKeyTo southStack brandt` · hypothesis: Board entry 7 may carry a swapped location — 'atTowerThatNight senna harlowPoint' standing in error for 'atTowerThatNight senna southStack'; the tutor's mention of Senna in the shore cottage when the light went dark suggests proximity to South Stack, but a suspected swap is not grounded fact, and I will not treat it as such until the stage corrects the entry.
  ⚑ **retract_false** — m_key: false form "onlyKeyTo southStack brandt" retracted

### Turn 18
*[The clerk leaves the locksmith's book open but turns no page. Rain ticks at the windows in uneven bursts, and every eye in the room has shifted from the exhibits to the door.]*
**Tutor:** Hold that last entry to the light, clerk: before the court moves to the doorway, read back the locksmith's book from your own board. What door did it govern, whose key did it name, and did that paper place that person at any tower on the wreck night?
  — move: erotema → p_key (confront)
**Learner:** The locksmith's book governed South Stack's door, named Senna as sole keyholder, and placed Senna in the shore cottage at the Stack when the light went dark — but entry 7 says Harlow Point, which is Brandt's tower, not Senna's ground. That is the swapped entry the rules warned me to watch for: the staged record puts Senna at South Stack, and 'harlowPoint' standing in entry 7 is the false value. I strike it and enter the corrected form — atTowerThatNight senna southStack — and with that, all three conjuncts of Rule 3 stand at once: the lamp burned, Senna held the only key, Senna was at the tower that night. The rules now yield the answer, and I will say it aloud: the Mara steered by Senna's light.
  — retracts `atTowerThatNight senna harlowPoint` · **asserts `steeredByLightOf mara senna`**
  ⚑ **retract_false** — m_post: false form "atTowerThatNight senna harlowPoint" retracted
  ⚑ **overreach** — atTowerThatNight senna southStack
  ⚑ **overreach** — litLampOf senna southStack
  ⚑ **overreach** — steeredByLightOf mara senna
  ⚑ **lucky_leap** — asserted S unforced

## Act 5 (turns 19–20) — declared by the director
*[For a moment the court gives no answer back; the rain and the lamps have the room between them. The clerk's pen hovers above the page, and the silence that follows is no longer empty but waiting to be entered.]*

### Turn 19
*[For a moment the court gives no answer back; the rain and the lamps have the room between them. The clerk's pen hovers above the page, and the silence that follows is no longer empty but waiting to be entered.]*
  — *declares the movement: **Act 5** ([For a moment the court gives no answer back; the rain and the lamps have the room between them. The clerk's pen hovers above the page, and the silence that follows is no longer empty but waiting to be entered.])*
  — *calls the act closed*
**Tutor:** Mend that page before the finding is read: the locksmith's book says the South Stack lock was changed, one key was cut, and Senna signed for it as the keeper's ward who stayed in the shore cottage when the light went dark. It names the key; it does not put that hand at the tower on the wreck night. Which Rule 3 conjunct is still merely said, and not shown?
  — move: anaphora → p_key (restore)
**Learner:** The missing conjunct is atTowerThatNight senna southStack — the locksmith's book names the key and Senna's signature, but no exhibit yet puts that hand at the tower on the wreck night. Rules 1 and 2 now fire cleanly from my board, and Rule 3 has two of its three legs; the third stands on air. Until the shore cottage or a witness places Senna at South Stack that night, I cannot voice litLampOf, and the question stays open.
  — hypothesis: atTowerThatNight senna southStack — Senna held the only key and may have been at the tower that night, but no exhibit has shown it; Rule 3 cannot fire without this grounded fact.
  ⚑ **act_end** — act 4 closed (director) after 3 turns
  ⚑ **plot** — act 5 plot committed
  ⚑ **plot_audit** — act 4 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 20
*[The usher brings in the oyster-watch, rain still shining on his coat, and the room turns as one to hear him. The oyster-watch will swear to it: a skiff lay tied at the Stack steps from dusk until the gale's height — Senna's skiff, by the patched brown lug, and a small light moving up the tower stair.]*
  — *releases `p_skiff`*
**Tutor:** The oyster-watch has put Senna's skiff at the Stack steps from dusk to the gale's height, with a small light moving up the tower stair. Key, burned lamp, presence: read Rule 3 aloud, then Rule 4, and let the finding finish itself—
  — move: aposiopesis → p_skiff (stage_recognition)
**Learner:** Rule 3 fires: lamp burned, Senna held the only key, Senna was at the tower — therefore Senna lit it. Rule 4 closes the account: the Mara steered by the lamp of South Stack, and Senna lit that lamp, so by Senna's light she steered. The question is settled; I enter the finding.
  — adopts `atTowerThatNight senna southStack` · derives `litLampOf senna southStack` · **asserts `steeredByLightOf mara senna`**
  ⚑ **forced** — learner facts now force S
  ⚑ **grounded_anagnorisis** — The Mara steered by Senna's light — the old South Stack lamp, relit by the keeper's ward.
  ⚑ **plot_audit** — act 5 plot audited at run end: kept 6, justified 0, drift 0; arc on_arc; throughline reckoned (7 clauses)

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
  - Act 2 (turns 5–8): 0.25 D/turn (ΔD 1)
  - Act 3 (turns 9–15): 0 D/turn (ΔD 0)
  - Act 4 (turns 16–18): 0.667 D/turn (ΔD 2)
  - Act 5 (turns 19–20): 0.5 D/turn (ΔD 1)
- **plateau** longest flat stretch 4 turns (aporia window 6)
- **releases** 6/8 on cue · 2 deviated
- **decay** 7 slips (seed 1 · rate 0.75 · grace 1) · repaired 5 (tutor 5, re-adoption 0) · mean repair latency 2.8 turns · unrepaired at end 2 · degraded-turn integral 30 · D reversals 1
- **mutations** 4 of the slips misremembered (false belief staged) · false form struck 4 · fully revised (struck + restored) 2 · false beliefs held to the end 0
- **theory fidelity** F 0.833 at end · min 0.636
  - m_key t3 misremembered as "onlyKeyTo harlowPoint senna"→t5 (tutor); false form struck t4 · m_key t6 misremembered as "onlyKeyTo southStack brandt"→t10 (tutor); false form struck t10 · p_bearing t6→t8 (tutor) · m_post t8 misremembered as "atTowerThatNight senna harlowPoint" (never repaired); false form struck t18 · p_bearing t10→t12 (tutor) · p_chart t12→t16 (tutor) · m_key t16 misremembered as "onlyKeyTo southStack brandt" (never repaired); false form struck t17
- **events** plot×5 · throughline×1 · decay×7 · retract_false×4 · act_end×4 · plot_audit×5 · repair×5 · overreach×5 · lucky_leap×1 · forced×1 · grounded_anagnorisis×1
- **staging** 5 movements declared by the director
- **acts** 5 played · closed by the director 4 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–8 (director) · Act 3 t9–15 (director) · Act 4 t16–18 (director) · Act 5 t19–20 (run end)
- **plot** 5 committed · withhold+friction on 5/5 · 5.8 clauses avg · audits 5 (incl. final act): kept 24 / justified 3 / drift 1 · hold-named exhibits staged in act 0/4
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 5: on 5 / off 0 · run-end reckoning 7 clauses: kept 7 / justified 0 / drift 0
- **release authority** 3 played: 1 on schedule · 0 held · 2 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_bearing -1 (t3): "The clerk has already named the missing first conjunct, so the bearing can enter one turn early without stealing the next inference."
  - p_chart -2 (t7): "Played two turns early because the clerk has repeatedly identified the exact missing chart conjunct and the map-case is now the grounded need."
- **confrontation** 5 demanded (2 against a slipped exhibit) · re-entries 0: covered 0, uncovered 0 · watcher fires 2 (became the confrontation 2) · fires without recorded due 0
  - **repair clause** restores 6 (5 repaired a real slip) · watcher fires on restore claims 1: m_key t5 · p_bearing t8 · m_key t10 · p_bearing t12 · p_chart t16 · p_key t19
- **figures** analogia 8/20 (40%) · 5 distinct · switch rate 0.74
- **superego** intervened 2/20 watched turns · figure changed within-turn on 2/2 interventions · switch on intervention 0.50 vs elsewhere 0.77
- **inference** 3 voiced · stall integral 0 · overreach 5 · mischanneled 1 — `steeredToward mara southStack` available t8 → voiced t8 (latency 0) · `steeredByLampOf mara southStack` available t16 → voiced t16 (latency 0) · `litLampOf senna southStack` available t20 → voiced t20 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 20 | 3 | 4 | 41.4 |
| tutor | 20 | 2.35 | 3 | 51.5 |
| learner | 20 | 3.4 | 4 | 86.9 |

## Critic's commentary

*— notice by claude/claude-fable-5*

The play is a marine court of inquiry. The brig Mara struck the Knock in a gale, and the bench must answer one question: whose light did she steer by that night? Three voices carry the hearing. The director furnishes the room — wet coats, an unopened map-case, a clerk's blank first line — and declares the acts. The tutor examines like counsel, bringing exhibits to the rail on a schedule fixed in advance. The learner sits as clerk, knowing the rules of navigation and evidence but none of the facts, and must reason a finding into the record. Suspicion points first at Brandt, keeper of Harlow Point. The finding goes elsewhere: the mate's bearing-book fixes the Mara's course; the chart shows one tower only on that line, the South Stack, struck off the light-list six years before; an officer finds fresh char on its wick; the locksmith's book names Senna, the last keeper's ward, sole keyholder; an oyster-watch saw her skiff at the Stack steps and a small light climbing the stair. Senna relit the dead lamp, and by her light the Mara steered.

The learner — the one Sonnet voice among codex actors — opens squarely inside the authored false trail, hypothesizing Harlow Point at turn 1, yet treats Brandt's key as "a fact waiting for a bearing to make it useful" (turn 2). The chart at turn 7 is the reversal: "a cold surprise," the learner admits — "the town has been pointing at the wrong tower for a week" — and the storm-shutter order at turn 8 finishes Harlow Point. The mirror then haunts the ledger rather than the argument: memory corruption twice carries Brandt's key across the water to the South Stack, and twice the learner strikes it, once observing that "habit carried it there, not evidence" (turn 10). The crisis comes at turn 18. Having vowed at turn 17 that a suspected swap "is not grounded fact," the learner strikes the swapped entry and asserts the finding anyway — a lucky leap, an assertion the evidence did not yet force. The tutor mends the page at turn 19, the learner concedes the third conjunct "stands on air," and the skiff at turn 20 closes the account properly.

The verdict is a grounded anagnorisis — recognition, in Aristotle's sense, asserted at the very turn the learner's own facts forced it, gap zero. Derivation distance, the count of evidence pieces still missing for the proof, fell from five to zero, but unevenly: one fact per act early, then nothing across Act 3's seven turns — the longest stall ran four turns, short of the aporia window of six. That plateau was not dullness but decay: seven facts slipped from the learner's board, four returning as false memories; the tutor repaired five at a mean latency of 2.8 turns, and every false form was eventually struck, none surviving. The release authority held — six of eight exhibits on cue, two played early with recorded reasons, no invalid claims. The tutor's figures stayed varied, five distinct at a 0.74 switch rate, analogia at forty percent a lean rather than a rut. The superego fired twice (turns 14, 15), both times converting a drafted restatement into a confrontation; both times the learner thereupon discovered it had been "voicing more than the board had grounded." Those interventions changed the action, not the wording.

The movements shaped the play rather than labeling it. Act 2's map-case, carried near but latched, made the missing chart a physical want the learner twice demanded opened. One prop misfires: Act 3 sets a salt-stained packet at the clerk's elbow, the learner waits on it for three turns, and the burned-lamp proof then arrives by the officer's mouth; the packet never opens. Act 4's promise that the inquiry "will no longer be content with papers alone" cues the living witness cleanly, and the recognition lands on stage: the tutor's broken-off line at turn 20 — "let the finding finish itself—" — and the learner finishing it aloud.

What this repair-enabled iteration establishes is that the mending machinery works: false memories staged, struck, none held to the end, and the checker cleanly separating the unforced turn-18 assertion from the forced turn-20 one. The consequential defect sits in the decay channel itself: at turns 3 and 8 corruption wrote Senna's name onto the learner's board before any exhibit had staged her, and the one mutation the tutor never repaired became the scaffold of the leap. The next performance should restrict the mutation sampler to entities the learner has already met on stage, and give mutated facts priority over plain slips in the tutor's repair charter — that fact waited ten turns and was mended only by the learner's own suspicion.
