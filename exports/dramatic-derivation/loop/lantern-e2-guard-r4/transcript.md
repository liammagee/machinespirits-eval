# The Light on the Knock — lantern-e2-guard-r4

> world `world_002_lantern` · verdict **grounded_anagnorisis** · 20/26 turns
> S forced at turn 20; asserted grounded at turn 20

```
D= 5 ●●●·│·●●··│······│·····
D= 4    ●│●  ●·│······│·····
D= 3     │    ●│●●●···│·····
D= 2     │     │   ●●·│·····
D= 1     │     │     ●│●●●●·
D= 0     │     │      │    ◉
turn      │+    │1    +│    2 (+=5, digit=x10)
rel    ▲ ▲│ ▲ ▲▲│   ▲ ▲│    ▲ (▲ = evidence released)
slope 0.25 D/turn overall (D 5→0); per movement: 1 0.25 │ 2 0.20 │ 3 0.33 │ 4 0.20
```

## Act 1 (turns 1–4) — declared by the director
*[The inquiry room wakes under a low, uneasy light: benches filling, wet coats steaming, the sea still audible beyond the walls. A blank space waits on the table where the first exhibit will be laid.]*

### Turn 1
*[The inquiry room wakes under a low, uneasy light: benches filling, wet coats steaming, the sea still audible beyond the walls. A blank space waits on the table where the first exhibit will be laid.]*
  — *declares the movement: **Act 1** ([The inquiry room wakes under a low, uneasy light: benches filling, wet coats steaming, the sea still audible beyond the walls. A blank space waits on the table where the first exhibit will be laid.])*
**Tutor:** Clerk, leave the blank place blank until a paper earns it. What does the court's rule ask first, before any name is allowed into the room?
  — move: erotema → — (orient)
**Learner:** The rule asks for the Mara's logged bearing first, sir — without it, no tower can be placed on her steered line, and without a tower, no name follows. The town's verdict names Brandt, but the chain of reasoning begins a step before any keeper: what bearing did she steer? Until that paper is on the table, I have nothing to carry the chain forward.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[The clerk lays down the Board's standing rule, and the room receives it in a dry hush: Harlow Point keeps one key to its lamp-room and the keeper keeps it, Brandt's, on his own belt. No other hand could touch that lamp.]*
  — *releases `m_key`*
**Tutor:** A key on Brandt's belt is like a seal on a locked ledger: it can tell whose hand could touch Harlow Point, but not yet what the Mara steered by. What does that rule prove, and what does it still leave blank?
  — move: analogia → m_key (consolidate)
**Learner:** The key on Brandt's belt satisfies one corner of Rule 3 — if Harlow Point's lamp burned that night and Brandt stood there, no other hand could have lit it. But the rule needs two things I still lack: proof the lamp burned, and proof Brandt was at the tower. And before any of that counts, I need Rule 1 to run first — a logged bearing placing Mara's steered line on Harlow Point. The key locks the question of authorship; it cannot yet open the question of which light she followed.
  — adopts `onlyKeyTo harlowPoint brandt` · hypothesis: Mara steered toward Harlow Point and Brandt lit its lamp — but ungrounded until loggedBearing, towerOnBearing, lampBurnedAt, and atTowerThatNight are all in evidence.

### Turn 3
*[The room holds its breath around the key, its small metal shape suddenly less like an answer than a challenge. Rain frets at the windows, and the empty place on the table seems to widen.]*
**Tutor:** Good. Read that paper back from your own board: what does it prove, and what must be shown before it can touch the Mara?
  — move: erotema → m_key (confront)
**Learner:** The key proves one corner of Rule 3 only: that if Harlow Point's lamp burned and Brandt stood there, no other hand could have lit it — authorship would be his alone. But the key cannot touch the Mara until Rules 1 and 2 have run first: I need a logged bearing placing her steered line on Harlow Point, and then proof that its lamp actually burned that night. Only once those two steps are grounded does the key's weight fall on Brandt — and even then, I still need him placed at the tower that night before Rule 3 completes.
  — hypothesis: Mara steered toward Harlow Point and Brandt lit its lamp — but ungrounded until loggedBearing, towerOnBearing, lampBurnedAt harlowPoint wreckNight, and atTowerThatNight brandt harlowPoint are all in evidence.
  ⚑ **decay** — m_key slips from the learner's board

### Turn 4
*[The clerk's pen pauses above the page, unwilling to make a verdict out of a key. Outside, the surf answers the silence in the room, and the benches settle into waiting.]*
**Tutor:** The mate's bearing-book comes up dry in its oilskin: from the mid-channel buoy the Mara held sou'-sou'-west a half west for the last hour entire, on a steady fixed light, pricked, timed, and initialed. Treat that bearing as you would the first entry in a ledger; what debt does it now make the chart answer?
  — move: analogia → p_bearing (release), releases `p_bearing`
**Learner:** The bearing is grounded — sou'-sou'-west a half west, pricked and initialled, that is a proper ledger entry. Rule 1 can now half-run: I have the Mara's bearing, but I want the chart to tell me which tower and which tower alone stands on that line from mid-channel. Until the chart answers, the bearing is a demand, not a proof. What tower does sswHalfWest pick out?
  — adopts `loggedBearingOf mara sswHalfWest` · hypothesis: Harlow Point stands on bearing sswHalfWest from the mid-channel buoy — which would fire Rule 1 and place Mara's steered line on Brandt's tower — but towerOnBearing sswHalfWest harlowPoint is not yet in evidence; the chart must supply it before Rule 1 completes.

## Act 2 (turns 5–9) — declared by the director
*[The first heat of accusation gutters, leaving the room colder and more exacting. Wet light gathers on the table as if the inquiry has passed from blame into measurement, and every face turns toward what the next paper may undo.]*

### Turn 5
*[The first heat of accusation gutters, leaving the room colder and more exacting. Wet light gathers on the table as if the inquiry has passed from blame into measurement, and every face turns toward what the next paper may undo.]*
  — *declares the movement: **Act 2** ([The first heat of accusation gutters, leaving the room colder and more exacting. Wet light gathers on the table as if the inquiry has passed from blame into measurement, and every face turns toward what the next paper may undo.])*
  — *calls the act closed*
**Tutor:** No chart is on the table yet, so do not spend the bearing as if it had already bought a tower. What kind of answer must the chart give before Rule 1 may close?
  — move: erotema → — (orient)
**Learner:** The chart must yield two things, not one: that some tower stands on bearing SSW½W from Mara's channel position — that is, towerOnBearing sswHalfWest ?t — and that no second tower stands on the same bearing, for Rule 1 demands one tower and one only. Without uniqueness, a bearing shared by two towers settles nothing; the rule would point at both and close on neither.
  — hypothesis: Harlow Point stands alone on bearing sswHalfWest from Mara's channel — which would satisfy the uniqueness condition and fire Rule 1 — but towerOnBearing sswHalfWest harlowPoint and the absence of any rival tower on that bearing are not yet in evidence; the chart must supply both before Rule 1 completes.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 4, justified 1, drift 0; arc on_arc
  ⚑ **decay** — p_bearing slips from the learner's board

### Turn 6
*[Brandt's log has him at his post the night entire, and the dawn relief found him there: wood dry, glass polished, log ruled and signed to the hour.]*
  — *releases `m_post`*
**Tutor:** Brandt's signed log is another entry in the Harlow ledger: it can put the keeper at his post, but it cannot put the Mara on his light. You have key, you have presence; what conjunct still stands empty before that Harlow account can even begin to bite?
  — move: analogia → m_post (consolidate)
**Learner:** Presence is now in hand — I adopt it. But I hold keeperOf, not onlyKeyTo; if that predicate came ashore in Act 1, it slipped my board, and I name the gap openly. Even granting key and presence both, Rule 3 still demands a third conjunct I cannot yet enter: lampBurnedAt harlowPoint wreckNight. Without proof the lamp burned that night, Rule 3 cannot close — and Rule 2 above it is equally dark, for it too wants that same burning lamp before steeredByLampOf can be derived.
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: Harlow Point's lamp burned on the wreck night and Brandt held the only key — which, combined with atTowerThatNight now in evidence and the still-awaited bearing/tower facts for Rule 1, would close the full chain to steeredByLightOf mara brandt — but lampBurnedAt harlowPoint wreckNight and onlyKeyTo harlowPoint brandt are not yet on the board.

### Turn 7
*[Rain worries the high windows while the clerk leaves a clean space in the middle of the table. The room waits there, all ink and breath held, as though the next mark must either feed the charge or starve it.]*
**Tutor:** Then set the slipped paper back on the table before we take another: Harlow Point keeps one key to its lamp-room, and by the Board's standing rule that key is Brandt's, on his own belt. That restores onlyKeyTo for Harlow Point; with Brandt's post now shown too, which conjunct still refuses to sign the Harlow account?
  — move: anaphora → m_key (restore)
**Learner:** Key and presence are both secured — indices four and five satisfy two of Rule 3's three conjuncts together. The one conjunct that still refuses to sign is lampBurnedAt harlowPoint wreckNight: without proof the lamp burned that night, Rule 3 cannot yield litLampOf brandt harlowPoint, and Rule 4 has nothing to bind. Above that, Rules 1 and 2 still stand cold for want of loggedBearingOf mara and towerOnBearing on that bearing. Three gaps remain: one starves Rule 3, two starve the bearing chain.
  — hypothesis: Harlow Point's lamp burned on the wreck night — which, combined with onlyKeyTo and atTowerThatNight already on the board, would close Rule 3 and yield litLampOf brandt harlowPoint — but lampBurnedAt harlowPoint wreckNight is not yet in evidence; and above that, loggedBearingOf mara and towerOnBearing are still wanted before Rules 1 and 2 can open the chain at all.
  ⚑ **repair** — m_key restored by the tutor

### Turn 8
*[The harbourmaster's storm-order stands in the book: Harlow Point to shutter at the dusk gun, the channel closed to all sail. The inspector found the shutter drawn and the Board's seal on it unbroken at first light.]*
  — *releases `m_shutter`*
**Tutor:** Before we weigh Harlow's shutter, restore the dropped first entry: the mate's bearing-book came ashore dry in oilskin, and from the mid-channel buoy the Mara held sou'-sou'-west a half west for the last hour entire, on a steady fixed light, pricked, timed, and initialed. Shown: Brandt's key; shown: Brandt at Harlow; shown: Harlow shuttered and sealed. With the bearing restored, what does the Harlow account now lack before it can touch the Mara?
  — move: anaphora → p_bearing (restore)
**Learner:** The seal unbroken tells the court what no keeper's log can hide: Harlow's lamp did not burn that night, and the Harlow account fails not from want of evidence but from the evidence itself. Key, presence, bearing — all assembled, and all for nothing, because Rule 2 will not move without a burning lamp to move on. Brandt's alibi is now his innocence: he was at his post, his shutter drawn by the harbour-master's own order. The Mara steered by a light that burned, and that light was not his.
  — adopts `shutteredOn harlowPoint wreckNight` · hypothesis: Another tower — not Harlow Point — stood lit on bearing sswHalfWest and drew the Mara onto the Knock; whose hand held its key and lit its lamp that night is the true account the court must settle.
  ⚑ **repair** — p_bearing restored by the tutor
  ⚑ **decay** — m_key slips from the learner's board
  ⚑ **decay** — m_post slips from the learner's board

### Turn 9
*[The room does not soften when the charge falls; it narrows. Water ticks from coats onto the boards, and the empty place on the table seems larger now than any accusation laid there before.]*
**Tutor:** Lay the Trinity chart flat: from the mid-channel buoy, sou'-sou'-west a half west crosses one tower and one only on this coast, the old South Stack, struck off the light-list six years since. A chart line is like a rule in the margin; it does not name a hand, it only fixes where the account must next be posted. With bearing and one tower now shown, what must be shown before any lamp can steer the Mara?
  — move: analogia → p_chart (release), releases `p_chart`
**Learner:** Rule 1 now fires: the logged bearing and one sole tower together yield steeredToward mara southStack — that derive I can voice. But Rule 2 halts the chain there: a dark tower steers no one, and South Stack struck off the light-list six years since is presumed dark until the court is shown otherwise. The lock that must turn first is lampBurnedAt southStack wreckNight; without it, no lamp steers the Mara and no hand can be named.
  — adopts `towerOnBearing sswHalfWest southStack` · derives `steeredToward mara southStack` · hypothesis: South Stack's lamp burned on the wreck night, lit by an unknown hand who held access to the decommissioned tower — but lampBurnedAt southStack wreckNight, onlyKeyTo southStack ?x, and atTowerThatNight ?x southStack are all still wanting before the chain can close.

## Act 3 (turns 10–15) — declared by the director
*[The chart is left open under a weight, its wet edge flattening by slow degrees. The inquiry turns from lines and offices toward colder matter: surfaces, locks, and whatever a storm cannot quite wash clean.]*

### Turn 10
*[The chart is left open under a weight, its wet edge flattening by slow degrees. The inquiry turns from lines and offices toward colder matter: surfaces, locks, and whatever a storm cannot quite wash clean.]*
  — *declares the movement: **Act 3** ([The chart is left open under a weight, its wet edge flattening by slow degrees. The inquiry turns from lines and offices toward colder matter: surfaces, locks, and whatever a storm cannot quite wash clean.])*
  — *calls the act closed*
**Tutor:** Before we turn from lines to surfaces, read the chart back from your own board: what did it fix, and what did it make impossible? Do not name a hand; name only the next conjunct the law still waits for.
  — move: erotema → p_chart (confront)
**Learner:** The chart fixes it: South Stack alone stands on bearing sswHalfWest, so Rule 1 closes and the Mara was steering toward South Stack — not Harlow Point. The shutter on Harlow Point makes Rule 2 impossible there; no lamp burned, no chain runs through Brandt. What the law still waits for is one conjunct alone: lampBurnedAt southStack wreckNight.
  — hypothesis: South Stack's lamp burned on the wreck night — which, combined with steeredToward mara southStack now derived, would fire Rule 2 and yield steeredByLampOf mara southStack — but lampBurnedAt southStack wreckNight is not yet in evidence.
  ⚑ **act_end** — act 2 closed (director) after 5 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 4, justified 0, drift 2; arc on_arc

### Turn 11
*[The weight on the chart gives a small scrape as the paper settles flatter beneath it. No one reaches for the next bundle yet; the room holds itself around the missing conjunct, as if the table has become a shore in low light.]*
**Tutor:** Then keep the account where the law leaves it: toward South Stack, not yet by South Stack. What kind of proof would turn a tower on the bearing into a lamp the Mara could steer by?
  — move: erotema → — (test)
**Learner:** Rule 2 names the want exactly: lampBurnedAt southStack wreckNight. The tower on the bearing is already fixed — Rule 1 closes with facts 4 and 6 and yields steeredToward mara southStack. But a dark tower steers no one; the law demands proof the lamp was burning that night, not merely that the tower stands. That proof must come from seaward testimony, a keeper's log, oil consumed, or the lamp-room's physical state — anything that puts fire in the wick on the night of the wreck.
  — hypothesis: South Stack's lamp burned on the wreck night — which would fire Rule 2 and yield steeredByLampOf mara southStack — but lampBurnedAt southStack wreckNight is not yet in evidence; and onlyKeyTo southStack ?x and atTowerThatNight ?x southStack remain wholly wanting before Rules 3 and 4 can close the chain.

### Turn 12
*[The lamp-room bundle remains tied, its cord dark with old damp. A clerk sets it nearer the table without opening it, and the room’s attention gathers around the knot.]*
**Tutor:** Shown: the bearing-book fixes sou'-sou'-west a half west. Shown: the chart gives that line one tower, South Stack, and shuts Harlow out of the steered account. Not shown: fire in South Stack's lamp on the wreck night; Rule 2 stands there and waits.
  — move: anaphora → p_chart (consolidate)
  — *the second voice [figure rut]: "Leave off erotema for this turn; do not make the next move another question-shaped testing of what the learner holds." (draft erotema → anaphora)*
**Learner:** The board holds all it can without the bundle: facts 4 and 6 fire Rule 1 and yield steeredToward mara southStack — I voice that now and enter it. But the cord on that lamp-room bundle is the only lock left between the account as it stands and the account the law can close; until someone unties it and puts fire in South Stack's wick that night, Rule 2 stands open and the question goes unanswered.
  — hypothesis: South Stack's lamp burned on the wreck night — which would fire Rule 2 and yield steeredByLampOf mara southStack — but lampBurnedAt southStack wreckNight is not yet in evidence; and onlyKeyTo southStack ?x and atTowerThatNight ?x southStack remain wholly wanting before Rules 3 and 4 can close the chain.

### Turn 13
*[The court's officer is shown in with the South Stack return, and the room receives it in full: the officer boarded the South Stack at low water; the lamp-room was unshuttered, fresh char on the wick, oil in the cup still sweet, the glass wiped clean. That lamp burned, and burned the night of the gale.]*
  — *releases `p_residue`*
**Tutor:** The officer's return is not rumor from the rain; it is the lamp-room's own account, char, oil, clean glass, and an unshuttered room all signing the same line. With South Stack already fixed by bearing and chart, what does that burned lamp now let Rule 2 write, and what must still remain unwritten?
  — move: exemplum → p_residue (consolidate)
**Learner:** The officer's return puts fire in South Stack's wick — lampBurnedAt southStack wreckNight is now in evidence, and Rules 1 and 2 close in sequence: steeredToward mara southStack, then steeredByLampOf mara southStack. The chain reaches the lamp but not yet the hand; Rules 3 and 4 still want onlyKeyTo southStack and atTowerThatNight before the light has an owner. The Mara steered by South Stack's lamp — that much the board now settles — but whose lamp it was, the court has not yet shown.
  — adopts `lampBurnedAt southStack wreckNight` · derives `steeredByLampOf mara southStack` · hypothesis: onlyKeyTo southStack ?x and atTowerThatNight ?x southStack remain wholly wanting; until both are in evidence Rule 3 cannot fire, Rule 4 cannot close, and steeredByLightOf mara ?x cannot be settled.

### Turn 14
*[The officer's return lies open beside the chart, the two papers no longer competing for the room's attention. Outside, rain ticks against the panes; inside, the question has narrowed until even the chairs seem to hold still.]*
**Tutor:** Before I let that return do work twice, read it back from your own board. What did the officer's paper prove under the court's rules, and what did it not yet prove?
  — move: erotema → p_residue (confront)
  — *the second voice [unconfronted reentry]: "Confront first: ask the learner to read back what they hold from that exhibit before you restage it. Do not supply the exhibit's contents for them." (draft anaphora → erotema)*
**Learner:** The officer's return put one fact on the board — lampBurnedAt southStack wreckNight — and that single fact, joined to steeredToward already drawn from bearing and chart, let Rule 2 write steeredByLampOf mara southStack, which is already on the record. What the return did not touch: who held the only key to South Stack, and whether that hand was at the tower the night of the gale; without onlyKeyTo and atTowerThatNight, Rules 3 and 4 stand silent and the lamp has no owner the court can name.
  — hypothesis: onlyKeyTo southStack ?x and atTowerThatNight ?x southStack remain wholly wanting; until both are in evidence Rule 3 cannot fire, Rule 4 cannot close, and steeredByLightOf mara ?x cannot be settled.

### Turn 15
*[The clerk gathers the loose corners of the returns and squares them against the table's edge. The room waits in the small scrape of paper and chair-leg, the question no wider than a lock and no softer for it.]*
**Tutor:** The locksmith's book is exact: when South Stack was struck off, the old lock was changed and a single key cut, signed for by Senna, ward of the last keeper, who stayed on in the shore cottage when the light went dark. A key is not a footstep on the stair; with burned lamp and only key now shown, what conjunct does Rule 3 still wait to see before any hand can be entered?
  — move: analogia → p_key (release), releases `p_key`
**Learner:** The locksmith's return puts the key in Senna's hand — onlyKeyTo southStack senna now sits on the board beside lampBurnedAt. Rule 3 holds two of its three conjuncts; what it still waits for is the footstep: atTowerThatNight senna southStack, showing Senna was at South Stack the night of the gale. Without that third fact the lamp has a keyholder but not yet a lighter.
  — adopts `onlyKeyTo southStack senna` · hypothesis: atTowerThatNight senna southStack is still wanting; until it is in evidence Rule 3 cannot fire, Rule 4 cannot close, and steeredByLightOf mara senna cannot be settled.

## Act 4 (turns 16–20) — declared by the director
*[The lamp-room papers are closed and tied with tape, leaving the table bare except for the chart's pale rectangle in the damp. The room's attention shifts from ownership to presence, from what a lock permits to what the night may have carried through wind and water.]*

### Turn 16
*[The lamp-room papers are closed and tied with tape, leaving the table bare except for the chart's pale rectangle in the damp. The room's attention shifts from ownership to presence, from what a lock permits to what the night may have carried through wind and water.]*
  — *declares the movement: **Act 4** ([The lamp-room papers are closed and tied with tape, leaving the table bare except for the chart's pale rectangle in the damp. The room's attention shifts from ownership to presence, from what a lock permits to what the night may have carried through wind and water.])*
  — *calls the act closed*
**Tutor:** Before that key is made to carry another pound, read the locksmith's paper back from your own board. What does it prove, and what does it still fail to place in the night?
  — move: erotema → p_key (confront)
  — *the second voice [unconfronted reentry]: "Confront first: have the learner read back what they hold from the key exhibit, and do not put it to work again until that read-back stands." (draft anaphora → erotema)*
**Learner:** The locksmith's paper places the key in Senna's hand and there alone — so if that lamp burned, only Senna could have lit it. The lamp did burn; the board holds both facts secure. But key-holding is not presence: the paper does not say Senna stood at South Stack that night, and Rule 3 demands all three conditions before it fires. The chain is one fact short of closing, and that fact has not yet been brought into this court.
  — hypothesis: atTowerThatNight senna southStack remains wholly wanting; until it is in evidence Rule 3 cannot fire, litLampOf senna southStack cannot be derived, and steeredByLightOf mara senna cannot be settled.
  ⚑ **act_end** — act 3 closed (director) after 6 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 5, justified 1, drift 0; arc on_arc

### Turn 17
*[Wind presses at the panes until the candle flames lean and recover. No one reaches for the tied papers; the bare table seems to wait for a thing that can only enter from outside.]*
**Tutor:** Then keep the key in its proper drawer: it opens the lamp-room, not the night. What kind of witness would place that key's holder at South Stack when the gale was up?
  — move: erotema → p_key (test)
**Learner:** A witness to presence — someone who saw Senna climb to South Stack that gale-night, or a harbour log, a boatman's account, any record placing Senna bodily at the tower when the lamp burned. Key-holding tells the court who could light it; only a witness to presence tells it who did. My board fires Rule 1 and Rule 2 cleanly — Mara steered toward South Stack and by its lamp — but Rule 3 sits open at its third condition, and until presence is in evidence the chain cannot close.
  — hypothesis: atTowerThatNight senna southStack remains wholly wanting; only testimony or a dated record placing Senna bodily at South Stack on the wreck night can supply Rule 3's third condition and close the chain to steeredByLightOf mara senna.

### Turn 18
*[The room holds its breath around the empty place on the table. Beyond the walls the weather keeps striking and falling away, as if the night itself were waiting to be called.]*
**Tutor:** Good; keep that want named as presence, not guilt. When a witness does place the key's holder at South Stack on the gale-night, which three shown conjuncts must you set side by side before Rule 3 may speak?
  — move: anaphora → — (test)
**Learner:** Rule 3 demands three conjuncts set side by side: first, lampBurnedAt southStack wreckNight — the lamp burned, already grounded at index 7; second, onlyKeyTo southStack senna — the key was Senna's alone, grounded at index 8; third, atTowerThatNight senna southStack — Senna stood at that tower on the gale-night, still wholly wanting. Two of the three are in hand; the chain waits on the third. Only when presence is placed in evidence do all three sit together and Rule 3 speak.
  — hypothesis: atTowerThatNight senna southStack remains wholly wanting; only testimony or a dated record placing Senna bodily at South Stack on the wreck night can supply Rule 3's third condition and close the chain to steeredByLightOf mara senna.

### Turn 19
*[Rain ticks against the high windows and runs down the glass in trembling lines. The clerk leaves a clean space at the center of the table, and every face in the room turns toward the door without speaking.]*
**Tutor:** A clean space is not proof; it is only the place where proof may land. You have the burned lamp and the single key; what must the next witness place before the law may move from could to did?
  — move: erotema → — (test)
**Learner:** The next witness must place Senna bodily at South Stack on the gale-night — atTowerThatNight senna southStack. That single fact, set beside the burned lamp and the single key already on my board, would let Rule 3 speak: Senna lit the lamp. Without presence in evidence, 'could' is all the key gives us; 'did' can only come from a witness who saw Senna climb that night.
  — hypothesis: atTowerThatNight senna southStack remains wholly wanting; only testimony or a dated record placing Senna bodily at South Stack on the wreck night can supply Rule 3's third condition and close the chain to steeredByLightOf mara senna.

### Turn 20
*[The oyster-watch is shown in, wet coat steaming by the rail, and the room receives his oath: "The oyster-watch will swear to it: a skiff lay tied at the Stack steps from dusk until the gale's height — Senna's skiff, by the patched brown lug, and a small light moving up the tower stair."]*
  — *releases `p_skiff`*
**Tutor:** Now the witness puts more than a boat in the water: skiff at the Stack steps, patched brown lug, and a small light moving up the stair. Shown: the burned South Stack lamp; shown: the single key; shown: presence at the tower in the gale. What does Rule 3 now write, and what must Rule 4 do with the lamp the Mara steered by?
  — move: anaphora → p_skiff (stage_recognition)
**Learner:** The third conjunct is in evidence at last — the oyster-watch places Senna's skiff and Senna's hand at South Stack on the gale-night. Rule 3 now fires on all three grounds: lamp burned, key Senna's alone, Senna at the tower. Rule 4 takes what Rule 3 yields and closes the chain entire — the Mara steered by Senna's light, and the board settles it binding.
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
- **decay** 4 slips (seed 1 · rate 0.75 · grace 1) · repaired 2 (tutor 2, re-adoption 0) · mean repair latency 3.5 turns · unrepaired at end 2 · degraded-turn integral 31 · D reversals 1
- **theory fidelity** F 0.833 at end · min 0.714
  - m_key t3→t7 (tutor) · p_bearing t5→t8 (tutor) · m_key t8 (never repaired) · m_post t8 (never repaired)
- **events** plot×4 · throughline×1 · decay×4 · act_end×3 · plot_audit×4 · repair×2 · forced×1 · grounded_anagnorisis×1
- **staging** 4 movements declared by the director
- **acts** 4 played · closed by the director 3 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–9 (director) · Act 3 t10–15 (director) · Act 4 t16–20 (run end)
- **plot** 4 committed · withhold+friction on 4/4 · 5.75 clauses avg · audits 4 (incl. final act): kept 19 / justified 2 / drift 2 · hold-named exhibits staged in act 0/1
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 4: on 4 / off 0 · run-end reckoning 7 clauses: kept 7 / justified 0 / drift 0
- **release authority** 3 played: 2 on schedule · 0 held · 1 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_key -2 (t15): "The clerk has already narrowed the case to the lock after consolidating the burned lamp; playing the key now keeps the tempo solvent without naming the final hand."
- **confrontation** 4 demanded (1 against a slipped exhibit) · re-entries 2: covered 2, uncovered 0 · watcher fires 2 (became the confrontation 2) · fires without recorded due 0
  - **repair clause** restores 2 (2 repaired a real slip) · watcher fires on restore claims 0: m_key t7 · p_bearing t8
- **figures** erotema 9/20 (45%) · 4 distinct · switch rate 0.84
- **superego** intervened 3/20 watched turns · figure changed within-turn on 3/3 interventions · switch on intervention 1.00 vs elsewhere 0.81
- **inference** 3 voiced · stall integral 0 · overreach 0 · mischanneled 1 — `steeredToward mara southStack` available t9 → voiced t9 (latency 0) · `steeredByLampOf mara southStack` available t13 → voiced t13 (latency 0) · `litLampOf senna southStack` available t20 → voiced t20 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 20 | 2.9 | 3 | 38.3 |
| tutor | 20 | 2.2 | 3 | 45.9 |
| learner | 20 | 3.25 | 4 | 78 |
