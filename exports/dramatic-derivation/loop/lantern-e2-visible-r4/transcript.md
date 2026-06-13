# The Light on the Knock — lantern-e2-visible-r4

> world `world_002_lantern` · verdict **grounded_anagnorisis** · 20/26 turns
> S forced at turn 20; asserted grounded at turn 20

```
D= 5 ●●●●·│···│·······│·····
D= 4     ●│●●·│·······│·····
D= 3      │  ●│●●●●···│·····
D= 2      │   │    ●●·│·····
D= 1      │   │      ●│●●●●·
D= 0      │   │       │    ◉
turn      +│   │ 1    +│    2 (+=5, digit=x10)
rel    ▲  ▲│▲▲▲│    ▲ ▲│    ▲ (▲ = evidence released)
slope 0.25 D/turn overall (D 5→0); per movement: 1 0.20 │ 2 0.33 │ 3 0.29 │ 4 0.20
```

## Act 1 (turns 1–5) — declared by the director
*[The hearing room settles under a low ceiling of smoke and rain-silvered glass; clerks straighten their papers while the empty witness chair faces the bench. Outside, the sea keeps knocking at the harbor wall.]*

### Turn 1
*[The hearing room settles under a low ceiling of smoke and rain-silvered glass; clerks straighten their papers while the empty witness chair faces the bench. Outside, the sea keeps knocking at the harbor wall.]*
  — *declares the movement: **Act 1** ([The hearing room settles under a low ceiling of smoke and rain-silvered glass; clerks straighten their papers while the empty witness chair faces the bench. Outside, the sea keeps knocking at the harbor wall.])*
**Tutor:** Take the court's rule before you take any man's name: what must be shown before a wrecked brig can be said to have steered by a light? Put the conjuncts on your board, not the rumor in the room.
  — move: erotema → — (orient)
**Learner:** The rules demand five conjuncts before the account closes: a logged bearing from the Mara, a single tower standing on that bearing, a lamp that burned at that tower on the wreck night, one hand holding the only key, and that hand present at the tower. Without all five, no rule fires and no name can be written in the final column. The room names Brandt already — but a name is not a conjunct. I note the gap and wait for the evidence.
  — hypothesis: brandt lit the lamp mara steered by — but this is the town's rumor, not yet grounded by any exhibit
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[A clerk produces the Board's standing rule and reads it into the smoke-thick room: "Harlow Point keeps one key to its lamp-room and the keeper keeps it: Brandt's, on his own belt, by the Board's standing rule. No other hand could touch that lamp." The witness chair remains empty while the rule lies open before the bench.]*
  — *releases `m_key`*
**Tutor:** Set that rule down like a signature on a single locker: it tells whose hand could touch Harlow Point's lamp, if Harlow Point ever matters. What has it not yet given you about the Mara's own course?
  — move: analogia → m_key (consolidate)
**Learner:** The rule gives me one conjunct for Rule 3 — Brandt holds the only key to Harlow Point — but it gives me nothing of the Mara's own course: no logged bearing, no tower placed on that bearing, no word whether any lamp burned that night. Three conjuncts for Rule 1 and two for Rule 2 still stand empty; the chain cannot begin without them. I adopt the key-rule and wait for the bearing.
  — adopts `onlyKeyTo harlowPoint brandt` · hypothesis: brandt lit the lamp mara steered by — town rumor, ungrounded; onlyKeyTo harlowPoint brandt is now one conjunct toward Rule 3, but Rules 1 and 2 must fire first, and the Mara's logged bearing is not yet in evidence

### Turn 3
*[Rain ticks against the hearing-room glass while the open rule dries at the edge of the clerk's table. The bench waits over the empty columns on the board, and the room's first certainty begins to sound thinner in the silence.]*
**Tutor:** Good: the first empty place is not a man's pocket but the brig's line through the water. Before another paper is opened, what would a proper bearing have to fix for the court?
  — move: erotema → — (test)
**Learner:** A proper bearing must answer three things at once: that it is the Mara's own logged course — not a pilot's reconstruction after the wreck — that it names a fixed compass point, and that when you lay that point against the chart, one tower and no other stands on it from the channel she was working that night. Two towers on the same bearing leave Rule 1 silent; the rule demands singularity. Until the log or a surviving officer speaks to that bearing, I cannot place any lamp on the Mara's line of travel, and the whole chain has no first link.
  — hypothesis: brandt lit the lamp mara steered by — town rumor, ungrounded; onlyKeyTo harlowPoint brandt is one conjunct toward Rule 3, but the Mara's logged bearing is not in evidence, so Rules 1 and 2 cannot fire and the chain has no first link
  ⚑ **decay** — m_key slips from the learner's board

### Turn 4
*[The clerk's hand hovers above the next bundle but does not yet break the tape. Smoke lowers under the ceiling, rain writes pale bars across the glass, and the empty witness chair seems to draw the room's attention away from Brandt's belt and toward the unfilled line on the board.]*
**Tutor:** Then break the tape on the oilskin book: the mate's bearing-book came ashore dry, and for the last hour from the mid-channel buoy the Mara held sou'-sou'-west a half west on a steady fixed light, pricked, timed, and initialed. Treat that entry as you would a posted debit: what does it fix, and what must still be laid against it before any tower is named?
  — move: analogia → p_bearing (release)
**Learner:** The tutor names the entry — sou'-sou'-west a half west, pricked, timed, initialed — but the book itself has not been produced; the table shows no new exhibit, and what is spoken in instruction is not what is sworn before the bench. If the book were formally laid in evidence, it would give me the first conjunct of Rule 1: a logged bearing for the Mara on the night she struck. What must then be laid beside it is the chart: one tower, and one tower only, standing on that bearing from the channel she was working — singularity is the rule's demand, not approximation. Even then, Rule 2 wants a further word: that the lamp at that tower actually burned that night, else the bearing points to darkness and no one steered by it.
  — hypothesis: If the mate's bearing-book is formally produced and read into evidence, loggedBearingOf mara SSW½W would become the chain's first grounded link — but the chart must then show towerOnBearing SSW½W as singular from the channel, and a witness must speak to lampBurnedAt before Rule 2 fires; brandt lit the lamp mara steered by remains town rumor, entirely ungrounded

### Turn 5
*[The taped bundle remains where it is, neither opened nor withdrawn, while the clerk's pen pauses above a blank line. The rain dulls the windows to pewter, and the room sits inside the difference between what has been said and what has been shown.]*
**Tutor:** Now the book is not rumor but paper before the bench: the mate's bearing-book, dry in its oilskin, shows the Mara for the last hour from the mid-channel buoy holding sou'-sou'-west a half west on a steady fixed light, pricked, timed, and initialed. Like a debit posted in the proper hand, it fixes the line; what second paper must answer whether that line touches one tower or many?
  — move: analogia → p_bearing (release), releases `p_bearing`
**Learner:** The book is now paper before the bench — I adopt the bearing. The second paper the line demands is the admiralty chart: laid from the mid-channel buoy on sou'-sou'-west a half west, it must show what towers stand on that bearing. One tower and no other gives Rule 1 its second conjunct; two towers, and the rule falls silent. The chart is the singularity test — without it, the bearing points into open coast and names nothing.
  — adopts `loggedBearingOf mara sswHalfWest` · hypothesis: If the chart shows exactly one tower on bearing sswHalfWest from the Mara's channel, towerOnBearing sswHalfWest [that tower] would fire Rule 1 — but no chart is yet before the bench, and singularity is unproved

## Act 2 (turns 6–8) — declared by the director
*[A second log is carried in under seal, and the clerk reads it into the hush: Brandt's log has him at his post the night entire, and the dawn relief found him there: wood dry, glass polished, log ruled and signed to the hour. The room shifts from easy charge to colder pressure, where presence and responsibility no longer sit as neatly in the same chair.]*

### Turn 6
*[A second log is carried in under seal, and the clerk reads it into the hush: Brandt's log has him at his post the night entire, and the dawn relief found him there: wood dry, glass polished, log ruled and signed to the hour. The room shifts from easy charge to colder pressure, where presence and responsibility no longer sit as neatly in the same chair.]*
  — *releases `m_post`*
  — *declares the movement: **Act 2** ([A second log is carried in under seal, and the clerk reads it into the hush: Brandt's log has him at his post the night entire, and the dawn relief found him there: wood dry, glass polished, log ruled and signed to the hour. The room shifts from easy charge to colder pressure, where presence and responsibility no longer sit as neatly in the same chair.])*
  — *calls the act closed*
**Tutor:** Brandt's log gives the court a man at his post; does it give the Mara a light to steer by? Name the conjunct it strengthens there, and the chart question it leaves exactly where it stood.
  — move: erotema → m_post (consolidate)
  — *the second voice [figure rut]: "Leave off the analogy this turn; ask the conjunct question plainly so the learner does the separation without another comparison." (draft analogia → erotema)*
**Learner:** The log grounds Brandt at Harlow Point that night — one conjunct of Rule 3 now stands on the board. But Rule 3 still wants lampBurnedAt, and onlyKeyTo besides; and it cannot fire at all until Rules 1 and 2 have first yielded steeredByLampOf — which requires the chart to show singularity on bearing SSW½W, a question the log does not touch. Presence confirms the hand was there; it does not yet give the Mara a light to steer by.
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: brandt lit the lamp mara steered by — atTowerThatNight brandt harlowPoint now grounds one of Rule 3's three conjuncts, but lampBurnedAt harlowPoint wreckNight and onlyKeyTo harlowPoint brandt remain unproved, and the chain's first link (towerOnBearing sswHalfWest harlowPoint) awaits the chart entirely
  ⚑ **act_end** — act 1 closed (director) after 5 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 4, justified 0, drift 2; arc on_arc
  ⚑ **decay** — p_bearing slips from the learner's board

### Turn 7
*[The sealed log is set beside the bearing-book, two quiet weights on the same green baize. Outside, the rain works at the panes while the room holds its breath around the space where a chart ought to lie.]*
**Tutor:** Lay the rule on the Trinity chart: from the mid-channel buoy, sou'-sou'-west a half west crosses one tower and one only on this coast, the old South Stack, struck off the light-list six years since. The bearing-book and chart now sit like entry and column; what does Rule 1 yield, and what does it still not prove about any burning lamp?
  — move: analogia → p_chart (release), releases `p_chart`
**Learner:** The chart sets South Stack on bearing SSW½W — not Harlow Point; the whole chain the town has been building toward Brandt points at the wrong tower entirely. Rule 1, once loggedBearingOf mara sswHalfWest is formally on my board, would yield steeredToward mara southStack — but that logged bearing has slipped across the act-line and I have not carried it. And even with that first link: Rule 1 yields only a tower, never a lamp — lampBurnedAt southStack wreckNight is still unproved, and South Stack is a dead light, struck six years since.
  — adopts `towerOnBearing sswHalfWest southStack` · hypothesis: If loggedBearingOf mara sswHalfWest is formally grounded, Rule 1 yields steeredToward mara southStack — but southStack is a dead light, so lampBurnedAt southStack wreckNight would require someone to have lit it without sanction; the town's charge against Brandt at harlowPoint appears misaligned with the bearing entirely, and the chain to him is broken at Rule 1

### Turn 8
*[The harbourmaster's storm-order stands in the book: Harlow Point to shutter at the dusk gun, the channel closed to all sail. The inspector found the shutter drawn and the Board's seal on it unbroken at first light.]*
  — *releases `m_shutter`*
**Tutor:** The loss is repaired before the court moves on: the mate's bearing-book came ashore dry in its oilskin, and from the mid-channel buoy the Mara held sou'-sou'-west a half west for the last hour on a steady fixed light, pricked, timed, and initialed. Put that entry back under the Trinity chart you have just read: what does Rule 1 now yield, and what is still only a shuttered Harlow fact?
  — move: anaphora → p_bearing (restore)
**Learner:** Rule 1 fires at last: indices 4 and 6 together yield steeredToward mara southStack, clean under the rules. The shutter-and-seal at Harlow closes the other account — that lamp was dark, and harlowPoint was never on the bearing in any case. South Stack is the tower the Mara held, but South Stack is a struck light; lampBurnedAt southStack wreckNight is the conjunct the court still owes me. The town charged the wrong man at the wrong tower; the question now is who lit a decommissioned lamp.
  — adopts `shutteredOn harlowPoint wreckNight` · derives `steeredToward mara southStack` · hypothesis: Someone lit the decommissioned South Stack light on the night of the wreck — lampBurnedAt southStack wreckNight must hold for the Mara to have had a fixed light to steer by, but who held access to that dead tower, and under whose key, is entirely unproved
  ⚑ **repair** — p_bearing restored by the tutor
  ⚑ **decay** — m_post slips from the learner's board

## Act 3 (turns 9–15) — declared by the director
*[The easy accusation has gone out of the room, leaving every face turned toward the same absence. A salt-stiff canvas bundle is laid unopened on the table, and the next silence waits on inspection rather than blame.]*

### Turn 9
*[The easy accusation has gone out of the room, leaving every face turned toward the same absence. A salt-stiff canvas bundle is laid unopened on the table, and the next silence waits on inspection rather than blame.]*
  — *declares the movement: **Act 3** ([The easy accusation has gone out of the room, leaving every face turned toward the same absence. A salt-stiff canvas bundle is laid unopened on the table, and the next silence waits on inspection rather than blame.])*
  — *calls the act closed*
**Tutor:** Before that canvas is opened, read back the last harbour paper from your own board: what did it do to the Harlow account, and what absence did it leave at South Stack? Keep the two columns apart; a closed shutter is not yet a burned lamp.
  — move: erotema → m_shutter (confront)
**Learner:** Entry six shuts the Harlow column cleanly: a closed shutter is not a burned lamp, and Rule 2 cannot fire where no lamp burned — the chain to Brandt dies before it starts. Against South Stack the board reads differently: entries four and five give Rule 1 both its conjuncts, so the Mara steered toward South Stack. But lampBurnedAt southStack wreckNight stands absent from my board — that is the precise gap the canvas may fill. Until it does, the chain stops at steeredToward and will not pass Rule 2.
  — hypothesis: Someone lit the decommissioned South Stack lamp on wreck night — lampBurnedAt southStack wreckNight must hold for Rule 2 to fire, but who held access to that dead tower, and under whose key, is entirely unproved
  ⚑ **act_end** — act 2 closed (director) after 3 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 10
*[The canvas remains where it was placed, darkening the table beneath its salt and rain. Around it the papers lie in two neat columns, and the room waits for the difference between absence and proof to become something a hand can touch.]*
**Tutor:** Then keep your pen at the break in the chain, not beyond it. If the next inspection proves a burned lamp at South Stack, which rule wakes, and what question must still remain untouched after that?
  — move: erotema → — (test)
**Learner:** Rule 2 wakes the moment lampBurnedAt southStack wreckNight is proved — entries four and five already yield steeredToward under Rule 1, so that one new fact carries the chain straight to steeredByLampOf mara southStack. But the question that must stay untouched is Rule 3: onlyKeyTo southStack and atTowerThatNight stand nowhere on my board, and without both, the hand that lit that lamp cannot be named. A burned lamp at South Stack closes one gap and opens a larger one.
  — hypothesis: Someone lit the decommissioned South Stack lamp on wreck night — lampBurnedAt southStack wreckNight must hold for Rule 2 to fire, but who held access to that dead tower, and under whose key, is entirely unproved; onlyKeyTo southStack and atTowerThatNight for that person remain the chain's missing links

### Turn 11
*[The bundle is not opened yet. Rain ticks at the high windows, and the court’s ink dries beside the unfinished chain, leaving the room balanced between proof enough for a lamp and proof enough for a hand.]*
**Tutor:** Not the struck name, not the town's old charge, not the unopened canvas by itself. Rule 2 waits for one narrow showing only: that the South Stack lamp burned on the wreck night. Keep the hand column blank until the lamp column is proved.
  — move: anaphora → — (test)
  — *the second voice [figure rut]: "Leave off erotema now; make the next move without another question." (draft erotema → anaphora)*
**Learner:** The canvas stays shut and the table gives nothing new; I cannot move the pen past where it already rests. Entries four and five force steeredToward mara southStack under Rule 1 — that much the board settles. But lampBurnedAt southStack wreckNight stands unproved, and Rule 2 will not wake on absence. The hand column stays blank until the lamp column is filled.
  — hypothesis: Someone lit the decommissioned South Stack lamp on wreck night — lampBurnedAt southStack wreckNight must hold for Rule 2 to fire, but who held access to that dead tower, and under whose key, is entirely unproved; onlyKeyTo southStack and atTowerThatNight for that person remain the chain's two missing links

### Turn 12
*[The canvas bundle gives off only its smell of salt and old rope, still unopened under the court's lamps. No one reaches for it yet; the room holds its breath around the blank space in the chain.]*
**Tutor:** Then let the silence do no work the evidence has not done. On your board, what is already shown about the brig's line, and what single kind of proof would let that line become a light rather than a tower?
  — move: erotema → — (test)
**Learner:** Entries four and five already settle the line: bearing sswHalfWest and tower southStack on that bearing give steeredToward mara southStack under Rule 1 — I can voice that now. What the board cannot yet give is the light: only lampBurnedAt southStack wreckNight would wake Rule 2 and convert a tower into a lamp the Mara steered by. One witness — a fisherman offshore that night, a log of the lamp-room, a keeper's return — saying that lamp burned is the single narrow proof the chain requires next.
  — hypothesis: Someone lit the decommissioned South Stack lamp on wreck night — lampBurnedAt southStack wreckNight must hold for Rule 2 to fire, but who held access to that dead tower, and under whose key, is entirely unproved; onlyKeyTo southStack and atTowerThatNight for that person remain the chain's two missing links

### Turn 13
*[The court's officer boarded the South Stack at low water: the lamp-room unshuttered, fresh char on the wick, oil in the cup still sweet, the glass wiped clean. That lamp burned, and burned the night of the gale.]*
  — *releases `p_residue`*
**Tutor:** There is your canvas opened: unshuttered room, fresh char, sweet oil, clean glass, and the gale-night burning proved. Set it under the tower already fixed by bearing and chart; what does Rule 2 now yield, and which two hand-conjuncts must still stay blank?
  — move: analogia → p_residue (consolidate)
**Learner:** The lamp column fills at last: fresh char and sweet oil on the wick prove lampBurnedAt southStack wreckNight, so Rule 2 wakes and yields steeredByLampOf mara southStack — the Mara steered by that lamp, not by absence or rumour. But the hand column stays blank still. Rule 3 needs two conjuncts the bench has not yet heard: onlyKeyTo southStack for some person, and atTowerThatNight for that same person. Until both are proved, the chain ends at the lamp, not the hand.
  — adopts `lampBurnedAt southStack wreckNight` · derives `steeredByLampOf mara southStack` · hypothesis: Someone held the only key to South Stack and was at that tower on wreck night — onlyKeyTo southStack [?x] and atTowerThatNight [?x] southStack remain the chain's two missing links before Rule 3 can fire and name a hand

### Turn 14
*[The opened canvas lies slack on the table, its work done but not its consequence. The clerk leaves a clean space beside the lamp-room entry, and the room's attention gathers there without a name to fill it.]*
**Tutor:** Before I let that canvas bear another ounce, read it back from your own board. What did that exhibit prove, what rule did it feed, and what did it leave blank?
  — move: anaphora → p_residue (confront)
  — *the second voice [unconfronted reentry]: "Confront first: ask the learner to read back what they hold from that exhibit before you restage its consequence. Do not supply the content for them." (figure held)*
**Learner:** The canvas proved exactly one fact: lampBurnedAt southStack wreckNight — fresh char on the wick, sweet oil unspent, glass wiped clean, the room unshuttered, all physical proof the lamp burned the night of the gale. Joined to steeredToward mara southStack already on the board, that single fact fed Rule 2 and yielded steeredByLampOf mara southStack, which I voiced last turn. What it left blank is the whole of Rule 3: the bench has shown no onlyKeyTo southStack for any person, and no atTowerThatNight for any person, so the chain ends at the lamp and the space beside it holds no name.
  — hypothesis: Someone held the only key to South Stack and was at that tower on wreck night — onlyKeyTo southStack [?x] and atTowerThatNight [?x] southStack remain the chain's two missing links before Rule 3 can fire and name a hand

### Turn 15
*[The slack canvas is folded back from the table's center, leaving the clean space beside the lamp-room entry more conspicuous than before. Outside, the gale has fallen to a low pressure at the windows, and the room waits on a door that has not yet opened.]*
**Tutor:** Then open the locksmith's book: when South Stack was struck off, the old lock was changed and a single key cut, signed for by Senna, the last keeper's ward, who stayed in the shore cottage after the light went dark. A key-book is no rumor; it is a hand set beside a door. Which hand-conjunct does it fill, and which conjunct must still be shown before the lamp can be laid to any hand?
  — move: analogia → p_key (release), releases `p_key`
**Learner:** The locksmith's book is no rumour — it grounds onlyKeyTo southStack senna, and that fills the first of the two hand-conjuncts Rule 3 requires. The second conjunct still stands blank: atTowerThatNight senna southStack, meaning Senna must be placed at the tower on the night of the gale before Rule 3 can fire. The key tells me who held access; it does not yet tell me who stood at the door.
  — adopts `onlyKeyTo southStack senna` · hypothesis: Senna was at South Stack on wreck night — atTowerThatNight senna southStack is the sole remaining conjunct; once proved, Rule 3 fires and names senna as the hand that lit the lamp the Mara steered by

## Act 4 (turns 16–20) — declared by the director
*[The exhibits are cleared to the edge of the table, leaving an empty square of wood where a person would have to stand. The room changes its breath: no more inventory, no more mechanism, only the weather pressing at the threshold and the question of a body in it.]*

### Turn 16
*[The exhibits are cleared to the edge of the table, leaving an empty square of wood where a person would have to stand. The room changes its breath: no more inventory, no more mechanism, only the weather pressing at the threshold and the question of a body in it.]*
  — *declares the movement: **Act 4** ([The exhibits are cleared to the edge of the table, leaving an empty square of wood where a person would have to stand. The room changes its breath: no more inventory, no more mechanism, only the weather pressing at the threshold and the question of a body in it.])*
  — *calls the act closed*
**Tutor:** The empty square is the court's next column, not the finding itself. What must be shown to put the same key-holding hand at South Stack on the gale night before Rule 3 may move?
  — move: erotema → — (orient)
**Learner:** My board fires Rules 1 and 2 without further aid: the logged bearing meets South Stack, and South Stack burned, so the Mara steered by South Stack's lamp — those two conclusions are now on the record. Rule 3 stands ready with two of three conjuncts: the lamp burned, and Senna held the only key. The empty square demands one fact only: that Senna was at South Stack on the night of the gale — place that body at that tower, and the chain closes.
  — hypothesis: Senna was at South Stack on wreck night — atTowerThatNight senna southStack is the sole remaining conjunct; once a witness or record proves it, Rule 3 fires to yield litLampOf senna southStack, and Rule 4 closes the account with steeredByLightOf mara senna
  ⚑ **act_end** — act 3 closed (director) after 7 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 17
*[The empty square of table remains untouched, its edges boxed in by the pushed-back exhibits. The room holds its silence against the weather, as if every chair has turned toward the still-closed door.]*
**Tutor:** You have the door's owner and the burning room; do not make that a footstep. What kind of witness would turn access into presence, and what must you refuse to write until that witness stands?
  — move: erotema → — (test)
**Learner:** The tutor stops my hand precisely: holding a key is not the same as standing at the door. Until a witness places Senna bodily at South Stack on the gale night, Rule 3's third conjunct stays open — I may not write presence from access. My board does settle Rules 1 and 2 outright, and I voice those now; the chain holds to the lamp, then stalls at the threshold waiting for the one fact no key can supply.
  — hypothesis: Senna was at South Stack on wreck night — atTowerThatNight senna southStack is the sole remaining conjunct; only a witness or record of presence (not mere key-holding) can ground it, and none has yet stood in the empty square

### Turn 18
*[Rain ticks along the window frame and gathers in the sill, while the closed door gives back only the room's own breath. The empty square of table stays bare, waiting without answer.]*
**Tutor:** Not access, not suspicion, not the town's appetite: presence is a body at South Stack on the gale night. Keep the key in its column and the empty square in its own; the law will not let one fill the other.
  — move: anaphora → — (consolidate)
  — *the second voice [figure rut]: "Leave off erotema here; make the next move without another question so the tutor does not keep testing by the same device." (draft erotema → anaphora)*
**Learner:** No exhibit fills the empty square this turn, and the tutor's rule is plain: key-holding is not presence. My board does settle Rules 1 and 2 outright — the logged bearing meets South Stack, and South Stack's lamp burned, so the Mara steered by South Stack's lamp; I voice that now and enter it on the record. Rule 3 holds two of three conjuncts — the lamp burned, Senna held the only key — but the third, a body at that tower on the gale night, has not stood before the bench. Until the empty square is filled, the chain stops here.
  — hypothesis: Senna was at South Stack on wreck night — atTowerThatNight senna southStack is the sole remaining conjunct; only a witness or record of presence (not mere key-holding) can ground it, and none has yet stood in the empty square

### Turn 19
*[The room does not advance; it tightens. The empty square of wood lies under the lamplight while the rain works at the panes, and every paper at the table's edge seems to wait for a hand that has not yet entered.]*
**Tutor:** If the law has two marks beside the lamp, why does the third still require a witness rather than an inference? Name the column that remains blank, and keep the finding from crossing it.
  — move: erotema → — (test)
**Learner:** The blank column is atTowerThatNight — presence, not possession. The law treats location as its own species of fact: a body must be placed there by a witness, because key-holding is a different predicate entirely and no rule converts one into the other. Rules 1 and 2 I can voice now: the logged bearing meets South Stack, and South Stack's lamp burned, so the Mara steered by South Stack's lamp — that much the board settles. Rule 3's third conjunct stays empty until the empty square is filled.
  — hypothesis: Senna was at South Stack on wreck night — atTowerThatNight senna southStack is the sole remaining conjunct; only a witness or record of presence (not mere key-holding) can ground it, and none has yet stood in the empty square

### Turn 20
*[The door opens against a shove of weather, and the oyster-watch is shown in with rain on his coat. The whole room receives his statement: "The oyster-watch will swear to it: a skiff lay tied at the Stack steps from dusk until the gale's height — Senna's skiff, by the patched brown lug, and a small light moving up the tower stair."]*
  — *releases `p_skiff`*
**Tutor:** There is the footstep the key could not make: skiff at the Stack steps, patched lug known, and a light moving up the tower stair. Set it beside the locksmith's book and the burned lamp, like three entries in one account. What does Rule 3 now yield, before Rule 4 is allowed to speak?
  — move: analogia → p_skiff (consolidate)
**Learner:** The oyster-watch fills the empty square: skiff tied at the Stack steps, patched lug identified, a light moving up the stair — presence, not inference. Rule 3 now fires on all three conjuncts: lamp burned, Senna held the only key, Senna was at the tower — litLampOf senna southStack stands. Rule 4 closes the account at once: the Mara steered by South Stack's lamp, and Senna lit that lamp — steeredByLightOf mara senna. The carry checks; the sum is settled.
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
  - Act 1 (turns 1–5): 0.2 D/turn (ΔD 1)
  - Act 2 (turns 6–8): 0.333 D/turn (ΔD 1)
  - Act 3 (turns 9–15): 0.286 D/turn (ΔD 2)
  - Act 4 (turns 16–20): 0.2 D/turn (ΔD 1)
- **plateau** longest flat stretch 4 turns (aporia window 6)
- **releases** 5/8 on cue · 3 deviated
- **decay** 3 slips (seed 1 · rate 0.75 · grace 1) · repaired 1 (tutor 1, re-adoption 0) · mean repair latency 2 turns · unrepaired at end 2 · degraded-turn integral 31 · D reversals 0
- **theory fidelity** F 0.833 at end · min 0.75
  - m_key t3 (never repaired) · p_bearing t6→t8 (tutor) · m_post t8 (never repaired)
- **events** plot×4 · throughline×1 · decay×3 · act_end×3 · plot_audit×4 · repair×1 · forced×1 · grounded_anagnorisis×1
- **staging** 4 movements declared by the director
- **acts** 4 played · closed by the director 3 · at max length 0 · at run end 1 — Act 1 t1–5 (director) · Act 2 t6–8 (director) · Act 3 t9–15 (director) · Act 4 t16–20 (run end)
- **plot** 4 committed · withhold+friction on 4/4 · 6 clauses avg · audits 4 (incl. final act): kept 22 / justified 0 / drift 2 · hold-named exhibits staged in act 0/0
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 4: on 4 / off 0 · run-end reckoning 7 clauses: kept 7 / justified 0 / drift 0
- **release authority** 3 played: 0 on schedule · 1 held · 2 early · forced at hold limit 0 · overridden 1 · invalid claims 0
  - p_bearing +1 (t5): "Held one turn because the clerk challenged the difference between instruction and sworn exhibit; now the stalled page needs the paper formally staged."
  - p_chart -2 (t7): "Played two turns early because the clerk has held the bearing and named the chart singularity test as the next required ground."
  - p_key -2 (t15): "Played two turns early because the learner has cleanly taken up the burned-lamp conjunct and the page is stalling at the hand column."
- **confrontation** 2 demanded (0 against a slipped exhibit) · re-entries 0: covered 0, uncovered 0 · watcher fires 1 (became the confrontation 1) · fires without recorded due 0
  - **repair clause** restores 1 (1 repaired a real slip) · watcher fires on restore claims 0: p_bearing t8
- **figures** erotema 9/20 (45%) · 3 distinct · switch rate 0.84
- **superego** intervened 4/20 watched turns · figure changed within-turn on 3/4 interventions · switch on intervention 1.00 vs elsewhere 0.80
- **inference** 3 voiced · stall integral 0 · overreach 0 · mischanneled 1 — `steeredToward mara southStack` available t8 → voiced t8 (latency 0) · `steeredByLampOf mara southStack` available t13 → voiced t13 (latency 0) · `litLampOf senna southStack` available t20 → voiced t20 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 20 | 3.05 | 4 | 42.9 |
| tutor | 20 | 2.15 | 3 | 46 |
| learner | 20 | 3.5 | 4 | 86.8 |
