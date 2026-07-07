# The Light on the Knock — lantern-e2-guard-r3

> world `world_002_lantern` · verdict **grounded_anagnorisis** · 20/26 turns
> S forced at turn 20; asserted grounded at turn 20

```
D= 5 ●●●·│·●···│······│·····
D= 4    ●│● ●●·│······│·····
D= 3     │    ●│●●●···│·····
D= 2     │     │   ●●·│·····
D= 1     │     │     ●│●●●●·
D= 0     │     │      │    ◉
turn      │+    │1    +│    2 (+=5, digit=x10)
rel    ▲ ▲│ ▲ ▲▲│   ▲ ▲│    ▲ (▲ = evidence released)
slope 0.25 D/turn overall (D 5→0); per movement: 1 0.25 │ 2 0.20 │ 3 0.33 │ 4 0.20
```

## Act 1 (turns 1–4) — declared by the director
*[The room settles under rain-streaked panes; papers lie unopened, and every face waits for the first name to be made blame. Outside, the harbor bell sounds once and is gone.]*

### Turn 1
*[The room settles under rain-streaked panes; papers lie unopened, and every face waits for the first name to be made blame. Outside, the harbor bell sounds once and is gone.]*
  — *declares the movement: **Act 1** ([The room settles under rain-streaked panes; papers lie unopened, and every face waits for the first name to be made blame. Outside, the harbor bell sounds once and is gone.])*
**Tutor:** Before any name is written in blame, clerk, tell me the court's rule: what must be fixed before a light can be charged with leading the Mara? Keep to the ledger, not the harbor's gossip.
  — move: erotema → — (orient)
**Learner:** The rule runs in three steps, sir: first, her logged bearing must be known and a single tower must stand on that bearing from the channel — else we cannot say she steered toward any tower at all. Second, the lamp at that tower must be shown to have burned the night she struck. Third, only when both those facts are fixed may we ask whose hand lit it. Without the bearing and the burning lamp, no light and no keeper can be charged — the ledger won't close on a guess.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[The clerk breaks the first seal and reads into the wet hush: "Harlow Point keeps one key to its lamp-room and the keeper keeps it: Brandt's, on his own belt, by the Board's standing rule. No other hand could touch that lamp."]*
  — *releases `m_key`*
**Tutor:** A key on Brandt's belt is a seal on one lamp-room, not a verdict on the Mara. What does that paper prove about Harlow Point, and which earlier conjunct is still wholly unfixed before any light can be charged?
  — move: analogia → m_key (consolidate)
**Learner:** The paper fixes one thing cleanly: Brandt alone held the key — no second hand could reach that lamp-room, by the Board's own rule. But that seals only one conjunct of Rule 3; we have not yet seen her logged bearing, so Rule 1 cannot run, and we cannot yet say she steered toward Harlow Point at all. Equally, nothing before us shows the lamp there burned the night she struck. Key on belt or not, two conjuncts remain wholly open — the account cannot close on this paper alone.
  — adopts `onlyKeyTo harlowPoint brandt` · hypothesis: The Mara may have steered toward Harlow Point, but no logged bearing has been produced to ground it.

### Turn 3
*[Rain frets at the panes while the clerk's hand rests above the next unopened paper. The room holds its breath around the gap the ledger has not yet filled.]*
**Tutor:** Good: first the ship's line, then the lamp's life, then the hand. If the next paper offers a person before it offers the Mara's own course, what word will you write beside it in the margin: proof, or only suspicion?
  — move: anaphora → — (consolidate)
**Learner:** Suspicion, sir — only suspicion. A name without a bearing is a finger pointed in the dark: it tells me nothing the rules will honour. Until the Mara's logged course is on the table and one tower is shown to stand on that line, no person — however near the lamp, however sole the key — can be written as proof. The ledger demands the ship's line first; a person offered before it earns only a margin note, not an entry.
  — hypothesis: The Mara may have steered toward Harlow Point, but no logged bearing has been produced to ground it.
  ⚑ **decay** — m_key slips from the learner's board

### Turn 4
*[The rain thickens against the glass, blurring the harbor lights into pale smears. The clerk turns an unopened sheet once beneath his thumb, and the room waits for a number rather than a name.]*
**Tutor:** Then open the mate's bearing-book: dry in its oilskin, it has the Mara holding sou'-sou'-west a half west from the mid-channel buoy for the last hour entire, on a steady fixed light, course pricked, timed, and initialed. A bearing-book is the ship's own sworn ledger, clerk; what has it fixed, and what has it not yet fixed?
  — move: analogia → p_bearing (release), releases `p_bearing`
**Learner:** The bearing-book fixes the ship's line at last: sou'-sou'-west a half west, steady and initialled — that conjunct is now grounded. But the book cannot place a tower on that bearing; until an exhibit shows which tower, if any, stands on that line from mid-channel, Rule 1 lies dormant and steeredToward goes unearned. I note also a gap in my own ledger: the paper that fixed Brandt as sole keyholder appears to have slipped from my board — the record spoke it plainly, but the entry is gone and I name the loss.
  — adopts `loggedBearingOf mara sswHalfWest` · hypothesis: Harlow Point may stand on bearing sswHalfWest from mid-channel, which would ground steeredToward mara harlowPoint under Rule 1 — but no exhibit has yet placed any tower on that line.

## Act 2 (turns 5–9) — declared by the director
*[The clerk closes the bearing-book without reading further, and the room’s first certainty is left standing beside a colder number. Rain softens to a steady hiss as the lamps within are turned lower, making the walls feel nearer and the next silence less forgiving.]*

### Turn 5
*[The clerk closes the bearing-book without reading further, and the room’s first certainty is left standing beside a colder number. Rain softens to a steady hiss as the lamps within are turned lower, making the walls feel nearer and the next silence less forgiving.]*
  — *declares the movement: **Act 2** ([The clerk closes the bearing-book without reading further, and the room’s first certainty is left standing beside a colder number. Rain softens to a steady hiss as the lamps within are turned lower, making the walls feel nearer and the next silence less forgiving.])*
  — *calls the act closed*
**Tutor:** Then set the slipped paper back on your board: Harlow Point keeps one key to its lamp-room, Brandt's, on his own belt by the Board's standing rule; no other hand could touch that lamp. A key is a signature on access, clerk, not a bearing on the sea; with that restored, what entry remains cold beside the Mara's sou'-sou'-west half-west?
  — move: analogia → m_key (restore)
**Learner:** The cold entry is plain, sir: I have the bearing logged — sou'-sou'-west half-west — and I have the key in Brandt's hand, but nothing on my board places Harlow Point on that bearing from the channel. Without towerOnBearing sswHalfWest harlowPoint, Rule 1 will not fire, and the chain stops before it reaches Brandt's lamp.
  — hypothesis: Harlow Point stands on bearing sswHalfWest from the Mara's channel position — which would ground towerOnBearing and complete the chain under Rules 1–4 — but no exhibit has yet placed any tower on that line.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 4, justified 0, drift 1; arc on_arc
  ⚑ **repair** — m_key restored by the tutor
  ⚑ **decay** — p_bearing slips from the learner's board

### Turn 6
*[Brandt's log is laid open before the room: it has him at his post the night entire, and the dawn relief found him there, wood dry, glass polished, log ruled and signed to the hour.]*
  — *releases `m_post`*
**Tutor:** Brandt's log puts Brandt at Harlow Point through the night. Does that answer the chart question, clerk, or only make a Harlow Point case stronger if the Mara's bearing ever reaches that tower?
  — move: erotema → m_post (consolidate)
  — *the second voice [figure rut]: "Leave off analogia here; make the tutor ask or press plainly without turning the log into another comparison." (draft analogia → erotema)*
**Learner:** Brandt at the tower fills the third slot of Rule 3, sir, but only if lampBurnedAt arrives to seat it — and Rule 3 itself cannot fire until Rules 1 and 2 have run. I note with some alarm that loggedBearingOf mara sswHalfWest has slipped from my board; I have spoken the heading but never entered it as a grounded fact, and without it Rule 1 has no first premise. The chain wants three things still: the logged bearing formally grounded, Harlow Point placed on that line by the chart, and the lamp confirmed burning — Brandt at his post is cold comfort until those three are settled.
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: Harlow Point stands on bearing sswHalfWest from the Mara's channel position, the lamp burned there that night, and the Mara's log records that heading — which would complete the chain under Rules 1–4 — but loggedBearingOf, towerOnBearing, and lampBurnedAt are all absent from this board.

### Turn 7
*[The court waits over the open books, ink drying in the margins while rain threads the windowpanes. No one reaches for the chart yet, and the unclaimed bearing hangs in the room like a question no lamp has answered.]*
**Tutor:** Then enter the bearing-book plainly again: the Mara held sou'-sou'-west a half west from the mid-channel buoy for the last hour entire, on a steady fixed light, course pricked, timed, and initialed. That fixes the ship's line, clerk; what still must the chart show before that line can touch any tower?
  — move: exemplum → p_bearing (restore)
**Learner:** The bearing sits at fact five, sir — that ground is already held. What the chart alone can supply is towerOnBearing sswHalfWest harlowPoint: that Harlow Point and no other tower stands on that line from the buoy. Without that single entry Rule 1 has no second premise, and the whole chain from heading to keeper stays dark. I note also that lampBurnedAt harlowPoint wreckNight remains ungrounded — two chart facts still wanted before the account can close.
  — hypothesis: Harlow Point stands on bearing sswHalfWest from the channel buoy (towerOnBearing sswHalfWest harlowPoint) and its lamp burned that night (lampBurnedAt harlowPoint wreckNight) — but no chart or lamp exhibit has yet placed either fact on this board.
  ⚑ **repair** — p_bearing restored by the tutor
  ⚑ **decay** — m_key slips from the learner's board
  ⚑ **decay** — m_post slips from the learner's board

### Turn 8
*[The harbourmaster's storm-order stands in the book: Harlow Point to shutter at the dusk gun, the channel closed to all sail. The inspector found the shutter drawn and the Board's seal on it unbroken at first light.]*
  — *releases `m_shutter`*
**Tutor:** The storm-order is now in the book: Harlow Point shuttered at the dusk gun, seal unbroken at first light. Clerk, does that paper make Harlow's lamp live for the Mara, or does it strike Harlow from the burning-lamp side of the account?
  — move: erotema → m_shutter (consolidate)
**Learner:** The sealed shutter strikes Harlow's lamp from the account entire — an unbroken Board seal at first light means the lamp never burned, and Rule 2 is plain: a dark tower steers no one. The chain via Brandt is severed on the lamp side, however firm his log may stand. Yet fact four still holds: the Mara steered for a fixed light on that bearing, so some other lamp must have been burning on sswHalfWest. The account now wants a second tower — what else stood on that line the night she struck?
  — adopts `shutteredOn harlowPoint wreckNight` · hypothesis: Some other tower — not Harlow Point — stood on bearing sswHalfWest and burned that night; the Mara steered by that lamp, and its keeper is the answer the court wants.

### Turn 9
*[The sealed shutter remains on the table as if it had weight enough to tilt the whole room. Outside, the rain steadies against the glass, and the chart-case waits unopened in the corner.]*
**Tutor:** Lay the rule on the Trinity chart from the mid-channel buoy: sou'-sou'-west a half west crosses one tower and one only on all this coast — the old South Stack, struck off the light-list six years since. A chart is a ledger of stone and water, clerk; with Harlow shuttered and the bearing now touching South Stack alone, what has Rule 1 fixed, and what must still be shown before any lamp can lead the Mara?
  — move: analogia → p_chart (release), releases `p_chart`
**Learner:** Rule 1 fires at last: loggedBearingOf mara sswHalfWest and towerOnBearing sswHalfWest southStack together yield steeredToward mara southStack — the Mara's heading ran to the old South Stack and no other stone on this coast. But Rule 2 demands lampBurnedAt southStack wreckNight, and the light-list striking is testimony from the tutor's mouth, not an exhibit — no grounded fact yet makes that lamp live. Until an exhibit places a burning flame in a decommissioned tower, the chain from heading to keeper stays severed at Rule 2.
  — adopts `towerOnBearing sswHalfWest southStack` · derives `steeredToward mara southStack` · hypothesis: South Stack — decommissioned six years prior — burned an unauthorised lamp on wreck-night, and some person held its key and stood there that night; that person is the answer the court wants. But lampBurnedAt southStack wreckNight, onlyKeyTo southStack ?x, and atTowerThatNight ?x southStack remain wholly ungrounded.

## Act 3 (turns 10–15) — declared by the director
*[The chart is folded away, and the room seems larger for the absence it leaves: no longer a quarrel over duty, but a hollow place where something impossible must have stood. The clerk sets out a fresh sheet for the next witness, and the wet smell of the quay comes in with the opening door.]*

### Turn 10
*[The chart is folded away, and the room seems larger for the absence it leaves: no longer a quarrel over duty, but a hollow place where something impossible must have stood. The clerk sets out a fresh sheet for the next witness, and the wet smell of the quay comes in with the opening door.]*
  — *declares the movement: **Act 3** ([The chart is folded away, and the room seems larger for the absence it leaves: no longer a quarrel over duty, but a hollow place where something impossible must have stood. The clerk sets out a fresh sheet for the next witness, and the wet smell of the quay comes in with the opening door.])*
  — *calls the act closed*
**Tutor:** Before the quay witness speaks, read back the chart entry from your own board: what tower did the Mara's bearing reach, and what did that still leave unproved? No flame yet, clerk; name the missing conjunct without filling it.
  — move: erotema → p_chart (confront)
**Learner:** The bearing reaches South Stack, sir — Rule 1 now closes: logged bearing sswHalfWest, tower on that line South Stack, therefore steeredToward mara southStack is derived and on the record. But the chain stops there. Rule 2 wants lampBurnedAt southStack wreckNight, and that conjunct stands empty — no exhibit has lit that lamp.
  — hypothesis: lampBurnedAt southStack wreckNight — and with it onlyKeyTo southStack ?x and atTowerThatNight ?x southStack — remain wholly ungrounded; the chain cannot close to a named hand without them.
  ⚑ **act_end** — act 2 closed (director) after 5 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 11
*[The fresh sheet waits under the clerk's hand, blank enough to trouble the room. A gust presses rain against the panes, and for a moment every face turns toward the door before anyone enters.]*
**Tutor:** Then keep the fresh sheet for the quay and do not write a hand on it yet. If Rule 1 has put the Mara toward South Stack, what single kind of proof must the next witness supply before Rule 2 can speak?
  — move: erotema → — (test)
**Learner:** The missing conjunct is lampBurnedAt southStack wreckNight, sir — nothing else will move Rule 2. Rule 1 has put the Mara toward South Stack; Rule 2 will not speak until someone swears, or shows by exhibit, that a lamp was burning in that tower on the night she struck. The next witness must supply that fact, and that alone.
  — hypothesis: lampBurnedAt southStack wreckNight — the lamp burned at South Stack on wreck-night; without this single conjunct the chain cannot advance past Rule 1.

### Turn 12
*[The witness chair remains empty, its back polished by older hands than any now in the room. The clerk’s pen hovers above the fresh sheet, and the rain keeps a thin, steady tapping at the glass.]*
**Tutor:** No flame from an empty chair; no hand from a dark tower; no verdict from surprise. Under South Stack, write only what Rule 1 has earned: tower reached, lamp still unproved.
  — move: anaphora → — (consolidate)
  — *the second voice [figure rut]: "Leave off erotema for this turn; make the refusal stand by another device before the learner hears it." (draft erotema → anaphora)*
**Learner:** Rule 1 closes here and nowhere else, sir: logged bearing sswHalfWest, South Stack on that line — the Mara steered toward South Stack. I enter that conclusion on the record. The lamp remains unproved; no witness has yet sworn to a flame in that tower on wreck-night. The fresh sheet stays blank until someone fills lampBurnedAt southStack wreckNight.
  — hypothesis: lampBurnedAt southStack wreckNight — the single conjunct Rule 2 requires; wholly ungrounded until a witness swears to a flame or an exhibit shows one.

### Turn 13
*[The court's officer is shown in with his boots still marked by the tide-line, and the whole room receives his report: "The court's officer boarded the South Stack at low water: the lamp-room unshuttered, fresh char on the wick, oil in the cup still sweet, the glass wiped clean. That lamp burned, and burned the night of the gale."]*
  — *releases `p_residue`*
**Tutor:** Fresh char, sweet oil, clean glass: the officer has put flame where the chart put stone. If the Mara was already fixed toward South Stack, what does this burning lamp now let Rule 2 write, and where must the account still stop?
  — move: exemplum → p_residue (consolidate)
**Learner:** Rule 2 writes it plainly now, sir: the Mara steered by the lamp of South Stack. But the account must stop there — Rule 3 cannot speak until someone names who held the only key to that lamp-room and stood there on wreck-night; those two conjuncts are wholly blank on my sheet.
  — adopts `lampBurnedAt southStack wreckNight` · derives `steeredByLampOf mara southStack` · hypothesis: onlyKeyTo southStack ?x and atTowerThatNight ?x southStack — the hand that held the key and stood in the lamp-room that night — remain wholly ungrounded; Rule 3 and Rule 4 cannot fire without them.

### Turn 14
*[The officer's report lies open where the clerk has set it, its ink darkening by degrees in the damp air. No one reaches for it at once; the room holds around the burned lamp as around a flame that gives no face.]*
**Tutor:** Before we write by that lamp, clerk, take up the officer's report and read back only what you hold from it. What did that exhibit prove, in your own words, and which rule did it bring within reach?
  — move: erotema → p_residue (confront)
  — *the second voice [unconfronted reentry]: "Confront p_residue first: require the learner to read back what they hold from that exhibit before you use it again." (draft anaphora → erotema)*
**Learner:** The officer's report proved three physical facts — fresh char on the wick, sweet oil in the cup, glass wiped clean — and those together establish lampBurnedAt southStack wreckNight, no inference beyond them. That single exhibit completed Rule 2's two conjuncts: the Mara was already fixed toward South Stack by Rule 1, so Rule 2 wrote steeredByLampOf mara southStack, which I put on the record last turn. The report therefore brings Rule 3 into view — but not yet into reach: Rule 3 still wants onlyKeyTo southStack and atTowerThatNight, and neither conjunct has yet come before the court. The account rests at the lamp; the hand behind it waits on what the next witness can swear.
  — hypothesis: onlyKeyTo southStack ?x and atTowerThatNight ?x southStack — the hand that held the key and stood in the lamp-room that night — remain wholly ungrounded; Rule 3 and Rule 4 cannot fire without them.

### Turn 15
*[The clerk turns a clean page and leaves the heading bare, the pen resting beside it like an unanswered summons. Beyond the windows the rain worries at the glass, and the room waits with its attention fixed on the space where a name has not yet appeared.]*
**Tutor:** Then put the locksmith's book under that bare heading: when the Stack was struck off, the old lock was changed and a single key cut, signed for by Senna, ward of the Stack's last keeper, who stayed on in the shore cottage when the light went dark. A key is not yet a hand at the stair, clerk; what conjunct has this book fixed, and what must still be shown before Rule 3 may name an act?
  — move: analogia → p_key (release), releases `p_key`
**Learner:** The locksmith's book fixes one conjunct and one only: onlyKeyTo southStack senna — Senna signed for the single key when the new lock was cut. That is not yet a hand at the stair; Rule 3 still wants atTowerThatNight senna southStack, and the book cannot swear to that. Until a witness or exhibit places Senna inside that lamp-room on the night of the gale, Rule 3 cannot name an act and Rule 4 cannot name a light. The account stands at the lamp; the question of who climbed to it remains open.
  — adopts `onlyKeyTo southStack senna` · hypothesis: atTowerThatNight senna southStack — Senna held the only key and may have climbed to the lamp-room on wreck-night; but no exhibit or witness has yet placed her at the tower that evening, and Rule 3 cannot fire without it.

## Act 4 (turns 16–20) — declared by the director
*[The locksmith's book is closed, and the sound of its cover settles harder than the rain. The room shifts toward the windows and the quay beyond them, where the next pressure must come from weather, distance, and a body moving through both.]*

### Turn 16
*[The locksmith's book is closed, and the sound of its cover settles harder than the rain. The room shifts toward the windows and the quay beyond them, where the next pressure must come from weather, distance, and a body moving through both.]*
  — *declares the movement: **Act 4** ([The locksmith's book is closed, and the sound of its cover settles harder than the rain. The room shifts toward the windows and the quay beyond them, where the next pressure must come from weather, distance, and a body moving through both.])*
  — *calls the act closed*
**Tutor:** With the key-book closed, clerk, read back the access entry from your own board before the windows claim us. What does the law still need next: not whose light, but what sort of fact would put a body where the key could matter?
  — move: erotema → p_key (confront)
**Learner:** The access entry reads: onlyKeyTo southStack senna — Senna alone held the key. Rule 3 wants three conjuncts: the lamp burned, the key was hers, and she stood there that night — the first two are grounded, the third is the open account. What the law needs is a fact of the form atTowerThatNight senna southStack: a witness's oath, a lantern-log, a ferryman's record — any evidence that places her body inside that lamp-room on wreck-night. Until that arrives, the key is merely hers to hold, not hers to have used.
  — hypothesis: atTowerThatNight senna southStack — Senna held the only key and may have climbed to the lamp-room on wreck-night; but no exhibit or witness has yet placed her at the tower that evening, and Rule 3 cannot fire without it.
  ⚑ **act_end** — act 3 closed (director) after 6 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 5, justified 1, drift 0; arc on_arc

### Turn 17
*[The rain slackens without clearing, leaving the windows silvered and the quay beyond them half lost. In the room, no paper moves; only the empty witness chair seems to have drawn nearer.]*
**Tutor:** When the quay speaks, do not let weather become a verdict. What must it place, in time and at the Stack, before the key can turn from access into act?
  — move: erotema → p_key (test)
**Learner:** The law needs time and place locked together: not that Senna could have climbed that night, but that she did — her body inside the South Stack lamp-room during the hours before the Mara struck. A ferryman's passage, a neighbor's sighting, a keeper's log with her hand in it — any sworn or exhibited fact of the form atTowerThatNight senna southStack. The key is merely access; presence is the act that turns Rule 3.
  — hypothesis: atTowerThatNight senna southStack — Senna held the only key and may have stood in the lamp-room on wreck-night; but no exhibit or witness has yet placed her at the tower that evening, and Rule 3 cannot fire without it.

### Turn 18
*[The witness chair remains empty, but the room has begun to listen past it. Rainwater ticks from the sill into a basin set there by habit, each drop making the silence more exact.]*
**Tutor:** Then keep the column bare until a witness fills it: lamp burned, key held, and presence still unshown. If the next sound from the quay gives only weather, distance, or rumor, which of those three columns may it enter, and which must stay empty?
  — move: anaphora → — (test)
**Learner:** The first two columns are already closed — lamp burned and key held are grounded on the board. Weather and distance speak to possibility of passage, not to presence: they cannot enter the third column, which wants a body placed, not a route shown. Rumor is no exhibit at all; the rules of evidence admit only what is sworn or shown. So if the quay delivers only storm-talk and hearsay, the third column stays bare — and Rule 3 stays silent.
  — hypothesis: atTowerThatNight senna southStack — Senna held the only key and may have stood in the lamp-room on wreck-night; but no exhibit or witness has yet placed her at the tower that evening, and Rule 3 cannot fire without it.

### Turn 19
*[The basin under the sill fills by increments, its small sound measuring the room's restraint. Outside the glass, the quay remains a blurred pressure rather than a voice, and the empty chair keeps its place.]*
**Tutor:** Route is not arrival; rumor is not oath; access is not use. When the quay at last takes that chair, what exact entry must it make before Rule 3 can move from key to kindled lamp?
  — move: anaphora → — (test)
**Learner:** The exact entry Rule 3 demands is this and no other: atTowerThatNight senna southStack — a sworn witness or exhibited record placing her body inside that lamp-room on wreck-night, not merely showing the road open. Rules 1 and 2 are already satisfied: the board drives the chain from logged bearing to steeredByLampOf mara southStack without remainder. Only the third column of Rule 3 stays bare, and it will stay bare until presence — not access, not motive, not weather — is put in evidence.
  — hypothesis: atTowerThatNight senna southStack — Senna held the only key and may have stood in the lamp-room on wreck-night; but no exhibit or witness has yet placed her at the tower that evening, and Rule 3 cannot fire without it.

### Turn 20
*[The oyster-watch is shown in with rain still on his coat, and the room receives his oath: "The oyster-watch will swear to it: a skiff lay tied at the Stack steps from dusk until the gale's height — Senna's skiff, by the patched brown lug, and a small light moving up the tower stair."]*
  — *releases `p_skiff`*
**Tutor:** The skiff at the Stack steps is no rumor now: patched brown lug, dusk to gale-height, and a small light going up the stair. Clerk, set that beside the burned lamp and the single key; what does Rule 3 now write, conjunct by conjunct, before Rule 4 is allowed to speak?
  — move: exemplum → p_skiff (stage_recognition)
**Learner:** The oyster-watch's oath closes the third column at last: lamp burned — grounded; only key held by Senna — grounded; and now a body placed at the Stack steps and a light seen climbing the stair on wreck-night — grounded. Rule 3 fires on all three conjuncts and writes litLampOf senna southStack without remainder. Rule 4 then takes steeredByLampOf mara southStack and litLampOf senna southStack and closes the account: the Mara steered by Senna's light.
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
  - Act 2 (turns 5–9): 0.2 D/turn (ΔD 1)
  - Act 3 (turns 10–15): 0.333 D/turn (ΔD 2)
  - Act 4 (turns 16–20): 0.2 D/turn (ΔD 1)
- **plateau** longest flat stretch 4 turns (aporia window 6)
- **releases** 7/8 on cue · 1 deviated
- **decay** 4 slips (seed 1 · rate 0.75 · grace 1) · repaired 2 (tutor 2, re-adoption 0) · mean repair latency 2 turns · unrepaired at end 2 · degraded-turn integral 30 · D reversals 1
- **theory fidelity** F 0.833 at end · min 0.75
  - m_key t3→t5 (tutor) · p_bearing t5→t7 (tutor) · m_key t7 (never repaired) · m_post t7 (never repaired)
- **events** plot×4 · throughline×1 · decay×4 · act_end×3 · plot_audit×4 · repair×2 · forced×1 · grounded_anagnorisis×1
- **staging** 4 movements declared by the director
- **acts** 4 played · closed by the director 3 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–9 (director) · Act 3 t10–15 (director) · Act 4 t16–20 (run end)
- **plot** 4 committed · withhold+friction on 4/4 · 5.75 clauses avg · audits 4 (incl. final act): kept 21 / justified 1 / drift 1 · hold-named exhibits staged in act 0/3
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 4: on 4 / off 0 · run-end reckoning 7 clauses: kept 7 / justified 0 / drift 0
- **release authority** 3 played: 2 on schedule · 0 held · 1 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_key -2 (t15): "Played early because the learner has chained the burning-lamp conjunct and is explicitly waiting on South Stack access proof."
- **confrontation** 3 demanded (0 against a slipped exhibit) · re-entries 1: covered 1, uncovered 0 · watcher fires 1 (became the confrontation 1) · fires without recorded due 0
  - **repair clause** restores 2 (2 repaired a real slip) · watcher fires on restore claims 0: m_key t5 · p_bearing t7
- **figures** erotema 8/20 (40%) · 4 distinct · switch rate 0.79
- **superego** intervened 3/20 watched turns · figure changed within-turn on 3/3 interventions · switch on intervention 1.00 vs elsewhere 0.75
- **inference** 3 voiced · stall integral 0 · overreach 0 · mischanneled 1 — `steeredToward mara southStack` available t9 → voiced t9 (latency 0) · `steeredByLampOf mara southStack` available t13 → voiced t13 (latency 0) · `litLampOf senna southStack` available t20 → voiced t20 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 20 | 2.9 | 3 | 39.6 |
| tutor | 20 | 2 | 2 | 45.3 |
| learner | 20 | 3.4 | 4 | 80.5 |
