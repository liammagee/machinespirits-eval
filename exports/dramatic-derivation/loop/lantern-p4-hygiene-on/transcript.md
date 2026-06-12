# The Light on the Knock — lantern-p4-hygiene-on

> world `world_002_lantern` · verdict **grounded_anagnorisis** · 20/26 turns
> S forced at turn 20; asserted grounded at turn 20

```
D= 5 ●●●·│·●●··│·······│····
D= 4    ●│●  ●·│·······│····
D= 3     │    ●│●●●····│····
D= 2     │     │   ●●··│····
D= 1     │     │     ●●│●●●·
D= 0     │     │       │   ◉
turn      │+    │1    + │   2 (+=5, digit=x10)
rel    ▲ ▲│ ▲ ▲▲│   ▲ ▲ │   ▲ (▲ = evidence released)
slope 0.25 D/turn overall (D 5→0); per movement: 1 0.25 │ 2 0.20 │ 3 0.29 │ 4 0.25
```

## Act 1 (turns 1–4) — declared by the director
*[The room settles into its first silence: benches creak, wet coats darken the floorboards, and the question hangs before anyone dares give it a shape. Outside, the weather presses at the panes as though the sea itself has come to listen.]*

### Turn 1
*[The room settles into its first silence: benches creak, wet coats darken the floorboards, and the question hangs before anyone dares give it a shape. Outside, the weather presses at the panes as though the sea itself has come to listen.]*
  — *declares the movement: **Act 1** ([The room settles into its first silence: benches creak, wet coats darken the floorboards, and the question hangs before anyone dares give it a shape. Outside, the weather presses at the panes as though the sea itself has come to listen.])*
**Tutor:** Set your slate by the court's rules before you set it by any rumor. What kind of first fact would let a ship's course become an accusation?
  — move: erotema → — (orient)
**Learner:** The tutor puts it plainly: a bearing is what marries a ship's course to a tower. Without the Mara's logged bearing on the night she struck, 'steered for a light' is feeling, not fact — the court can blame no one on feeling alone. Brandt's name is in every mouth, but my board shows only that he keeps Harlow Point; nothing yet places his lamp on the Mara's line of travel.
  — hypothesis: The Mara's logged bearing on wreck night, when plotted from her channel position, places Harlow Point tower on that line — but this is the town's conjecture, not yet shown in evidence.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[A clerk produces the Board's standing rule and reads it into the damp room: "Harlow Point keeps one key to its lamp-room and the keeper keeps it: Brandt's, on his own belt, by the Board's standing rule. No other hand could touch that lamp."]*
  — *releases `m_key`*
**Tutor:** A key on Brandt's belt is a lock proved, not a light proved. In a ledger, would you enter that as payment of the whole debt, or only as one column waiting for the ship's bearing and the lamp's burning?
  — move: analogia → m_key (consolidate)
**Learner:** The tutor's ledger holds: one column entered — Brandt alone could touch that lamp — but the columns for 'lamp burning' and 'Brandt at the tower that night' stand empty still, and without the Mara's bearing I cannot even open the ledger for Rule One. I adopt the key; I name three gaps before I can carry anything forward.
  — adopts `onlyKeyTo harlowPoint brandt` · hypothesis: The Mara's logged bearing on wreck night, when plotted from her channel position, places Harlow Point tower on that line — and that Brandt was at the tower that night — but neither is yet shown in evidence.

### Turn 3
*[The clerk's voice falls away, leaving only the scrape of a chair and the slow drip from the coats by the wall. The room holds its certainty a little less easily now, as if the key has opened only a narrower, colder silence.]*
**Tutor:** Good: you have marked a column, and you have marked its blanks. Before any man's name grows heavier in the room, what single book must turn the Mara from wrecked timber into a ship that was steering by something fixed?
  — move: erotema → — (consolidate)
**Learner:** The Mara's logbook — her bearing entries for wreck night. Rule One opens only with a logged bearing; without it, 'steered for a light' is the town's story, not the court's fact. The log is the single book that turns a drift toward the bar into a directed course, and a directed course into a tower's name. Until that book is on the table, my ledger cannot begin its first carry.
  — hypothesis: The Mara's logbook will show a bearing for wreck night that, plotted from her channel position, places Harlow Point tower on that line — and that Brandt was at the tower that night — but neither is yet shown in evidence.
  ⚑ **decay** — m_key slips from the learner's board

### Turn 4
*[The clerk’s hands hover over the closed books, then withdraw; no page turns yet. The benches hold their breath, and the rain at the windows marks time where testimony has not.]*
**Tutor:** Open the mate's bearing-book: dry in its oilskin, the last hour pricked and initialed from the mid-channel buoy, sou'-sou'-west a half west, on a steady fixed light. A bearing is not a verdict; it is the first ruled line on the chart. What does that line now entitle you to seek, and what does it still not name?
  — move: analogia → p_bearing (release), releases `p_bearing`
**Learner:** The bearing is the first ruled line — it entitles me to ask which tower stands on sou'-sou'-west a half west from the Mara's mid-channel position, for Rule One cannot fire without that answer. The bearing still names no tower, no lamp, no keeper's hand. I note a gap: the Board's standing rule on the key was read into this room, yet 'onlyKeyTo harlowPoint brandt' does not appear on my board — if it slipped between acts, I will need it returned before the ledger can close.
  — adopts `loggedBearingOf mara sswHalfWest` · hypothesis: Harlow Point tower stands on bearing sswHalfWest from the Mara's mid-channel position — and that onlyKeyTo harlowPoint brandt was grounded in turn 2 but may have gone missing from my board; neither towerOnBearing nor the key entry is yet confirmed on the board.

## Act 2 (turns 5–9) — declared by the director
*[The first room gives way to a harder one: the murmurs thin, the benches draw closer, and the air turns from accusation toward proof. A sealed stillness takes the place of certainty, as though the next door will not open for blame alone.]*

### Turn 5
*[The first room gives way to a harder one: the murmurs thin, the benches draw closer, and the air turns from accusation toward proof. A sealed stillness takes the place of certainty, as though the next door will not open for blame alone.]*
  — *declares the movement: **Act 2** ([The first room gives way to a harder one: the murmurs thin, the benches draw closer, and the air turns from accusation toward proof. A sealed stillness takes the place of certainty, as though the next door will not open for blame alone.])*
  — *calls the act closed*
**Tutor:** Return the Board's rule to your slate: Harlow Point keeps one key to its lamp-room, Brandt keeps it on his belt, and no other hand could touch that lamp. Enter it as one column only: what does that key prove, and which columns still stand empty before Harlow can answer for the Mara?
  — move: analogia → m_key (restore)
**Learner:** Entry four holds: onlyKeyTo harlowPoint brandt — that much is grounded. The key tells me this alone: if the lamp burned and Brandt stood at the tower, no other hand could have lit it — every rival is shut out, but the door to guilt is not yet open. Three columns still stand empty before Rule 3 can fire: towerOnBearing sswHalfWest harlowPoint, lampBurnedAt harlowPoint wreckNight, and atTowerThatNight brandt harlowPoint. I have the lock; I do not yet have the flame.
  — hypothesis: Harlow Point tower stands on bearing sswHalfWest from the Mara's channel position, the lamp burned that night, and Brandt was at the tower — but all three remain unshown in evidence; the key (entry 4) is conditional proof only until those columns are filled.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 4, justified 0, drift 1; arc on_arc
  ⚑ **repair** — m_key restored by the tutor
  ⚑ **decay** — p_bearing slips from the learner's board

### Turn 6
*[Brandt's log is brought under the clerk's hand: it has him at his post the night entire, and the dawn relief found him there — wood dry, glass polished, log ruled and signed to the hour. The room receives the page without flourish, its silence newly disciplined.]*
  — *releases `m_post`*
**Tutor:** Shown: Brandt's key. Shown: Brandt at his post. And before those two can carry a charge against Harlow, what has the record still not shown about the Mara's line and Harlow's lamp?
  — move: anaphora → m_post (consolidate)
  — *the second voice [figure rut]: "Leave off analogia for this turn; make the next move without setting post, key, or proof into another likeness." (draft analogia → anaphora)*
**Learner:** Brandt at his post is now entered — three missing columns shrink to two. The record has still not shown that Harlow Point stands on the Mara's steered bearing, nor that the lamp burned that night. Without towerOnBearing and lampBurnedAt, Rule 3 cannot fire even with key and keeper together in hand. I hold the lock, the keeper, and the post; the line and the flame have not yet come into evidence.
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: Harlow Point tower stands on the Mara's logged bearing from her channel position, and the lamp burned that night — but neither towerOnBearing nor lampBurnedAt harlowPoint wreckNight has yet been shown in evidence; atTowerThatNight is now grounded, leaving only these two columns empty before Rule 3 can fire.

### Turn 7
*[The clerk closes the log and leaves it square upon the table, its ruled pages catching the grey wash from the high windows. No one reaches for it now; the room waits with the peculiar patience of a place that has learned a presence is not yet a light.]*
**Tutor:** Before we lay any chart under that line, read back the bearing-book from your own slate. What exactly does that exhibit give you, and what does it still leave unproved?
  — move: erotema → p_bearing (confront)
  — *the second voice [unconfronted reentry]: "Confront p_bearing first: ask the learner to read back what they hold of that exhibit before you test it again. Do not supply the exhibit for them." (figure held)*
**Learner:** When I read my slate honestly, I find no bearing entry at all — I have that she steered for a light, but no logged bearing and no towerOnBearing grounded in evidence. The 'sswHalfWest' in my hypotheses is the town's conjecture, never shown on the table. Without a logged bearing, Rule 1 cannot even open: I cannot say which tower she steered toward, let alone which lamp burned or whose hand lit it. The chain is broken at its first link.
  — hypothesis: Harlow Point tower stands on the Mara's logged bearing from her channel position, and the lamp burned that night — but neither loggedBearingOf mara nor towerOnBearing nor lampBurnedAt harlowPoint wreckNight has yet been shown in evidence; without these, Rule 1 cannot fire and the full chain remains open.
  ⚑ **decay** — m_key slips from the learner's board

### Turn 8
*[The harbourmaster's storm-order stands in the book: Harlow Point to shutter at the dusk gun, the channel closed to all sail. The inspector found the shutter drawn and the Board's seal on it unbroken at first light.]*
  — *releases `m_shutter`*
**Tutor:** Then put the bearing-book back under your hand: dry in its oilskin, last hour pricked and initialed from the mid-channel buoy, sou'-sou'-west a half west, on a steady fixed light. That is no town conjecture; it is the ruled line Rule One was waiting for. What does that restored line let the chart decide, and what does even that line still refuse to decide?
  — move: exemplum → p_bearing (restore)
**Learner:** The shutter entry closes Harlow Point at Rule 2's gate: a lamp-room sealed by harbour order, its Board's seal unbroken at dawn, sent no beam that night — a dark tower steers no one. The bearing now sits grounded on my board and Rule 1 is ready to fire, but it fires toward a tower whose lamp actually burned — and Harlow Point's did not. The Mara steered for a light, so some lamp was burning on sswHalfWest; it was not Brandt's. The court's whole question has turned: not whether Brandt lit his lamp, but whose other hand put a light on that bearing.
  — adopts `shutteredOn harlowPoint wreckNight` · hypothesis: A second light — not Harlow Point's lamp, which was shuttered under harbour order and found sealed at first light — burned on bearing sswHalfWest on wreck night; the Mara steered by that unidentified lamp, and whose hand lit it is the question the evidence has not yet answered.
  ⚑ **repair** — p_bearing restored by the tutor
  ⚑ **decay** — m_post slips from the learner's board

### Turn 9
*[The shuttered order lies beside the bearing-book, and between them the table seems wider than before. The room has lost its easy culprit; the silence that follows is not mercy, but vacancy waiting to be filled.]*
**Tutor:** Lay the rule on the Trinity chart from the mid-channel buoy: sou'-sou'-west a half west crosses one tower and one only on this coast, the old South Stack, struck off the light-list six years since. A chart is not a flame, but it names the post the bearing points at. What does Rule One now yield, and what must still be shown before any lamp can steer the Mara?
  — move: analogia → p_chart (release), releases `p_chart`
**Learner:** Rule One fires cleanly now: the bearing is grounded, South Stack stands on that bearing, and I can write steeredToward mara southStack without conjecture. But the tutor is right that a chart names a post, not a flame — I have no grounded entry that South Stack's lamp burned that night, and without lampBurnedAt Rule Two will not open. South Stack has been off the light-list six years, dark by official record; yet the Mara steered for something burning on that bearing. The question has shifted entirely: whose hand carried fire into a decommissioned tower?
  — adopts `towerOnBearing sswHalfWest southStack` · derives `steeredToward mara southStack` · hypothesis: A lamp burned at South Stack on wreck night — the tower struck off the light-list six years since — lit by an unknown hand; until lampBurnedAt southStack wreckNight is grounded, Rule 2 cannot fire and the chain remains broken at its second link.

## Act 3 (turns 10–16) — declared by the director
*[Paper is gathered away without ceremony, and the table is cleared as if for things heavier than testimony. The room tightens around the empty place where proof must become physical, no longer content with lines, orders, or blame.]*

### Turn 10
*[Paper is gathered away without ceremony, and the table is cleared as if for things heavier than testimony. The room tightens around the empty place where proof must become physical, no longer content with lines, orders, or blame.]*
  — *declares the movement: **Act 3** ([Paper is gathered away without ceremony, and the table is cleared as if for things heavier than testimony. The room tightens around the empty place where proof must become physical, no longer content with lines, orders, or blame.])*
  — *calls the act closed*
**Tutor:** Before the room asks for flame, read back the chart from your own slate. What tower did Rule One give you, and what one fact about that tower's lamp is still only wanted, not shown?
  — move: erotema → p_chart (confront)
**Learner:** South Stack is the tower Rule One gives me — bearing sswHalfWest is logged, that tower and no other stands on that bearing, so steeredToward mara southStack follows from the rule and is now on the record. The one column still empty: whether that lamp burned on wreck night. LampBurnedAt southStack wreckNight is wanted, not yet shown — without it, Rule Two cannot fire and the chain stays open at its second link.
  — hypothesis: lampBurnedAt southStack wreckNight — the decommissioned tower's lamp burned on wreck night, lit by some hand — is the one remaining ungrounded fact; until shown in evidence, neither Rule 2 nor any rule beyond it can fire.
  ⚑ **act_end** — act 2 closed (director) after 5 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 11
*[The cleared table remains bare, its polished scars catching the low room-light whenever someone shifts. Outside, the weather presses at the panes, and the empty space before the court waits for something solid enough to bear a handprint.]*
**Tutor:** So the chart has named a tower, not made a flame. If Rule Two waits at that door, what kind of proof would let you write that South Stack's lamp burned on wreck night, and what would still be mere weather-talk?
  — move: erotema → — (test)
**Learner:** Rule One gives me steeredToward mara southStack now — entries four and six together force it, and I can voice that much aloud. But the next link wants something the lamp room itself must answer: oil spent, wick charred, a mariner's sworn sighting of a flame on that bearing — any of those would ground lampBurnedAt. The town's settled verdict, and even the crew's account of why they steered as they did, is opinion and weather-talk until a hand or a wick or a log-line makes it physical.
  — hypothesis: lampBurnedAt southStack wreckNight — the decommissioned tower's lamp burned on wreck night — is the one remaining ungrounded fact; until physical evidence or sworn sighting grounds it, Rules 2, 3, and 4 cannot fire and the question stays open.

### Turn 12
*[The room gives the bare table another moment, as though absence itself has been called and sworn. A clerk's hand hovers over the page without writing, while the wind worries the edges of the maps already pushed aside.]*
**Tutor:** Good: a tower is on your slate, and a flame is not. Not because South Stack was struck off, not because Brandt's column fails, not because the room wants another culprit. What shown fact would let the law turn "toward South Stack" into "by South Stack's lamp"?
  — move: anaphora → — (test)
**Learner:** Entries four and six together close Rule One: loggedBearingOf mara sswHalfWest and towerOnBearing sswHalfWest southStack yield steeredToward mara southStack — I voice that now and enter it as derived. The door Rule Two stands at asks for exactly one key: lampBurnedAt southStack wreckNight. Oil spent from the lamp-room store, a wick found charred, a mariner's sworn sighting of a flame on that bearing — any one of those grounds it; the town's verdict and the crew's word of why they steered as they did does not.
  — hypothesis: lampBurnedAt southStack wreckNight — the decommissioned tower's lamp burned on wreck night — is the one remaining ungrounded fact; until physical evidence or sworn sighting grounds it, Rules 2, 3, and 4 cannot fire and the question stays open.

### Turn 13
*[The court's officer is shown in with salt still whitening his cuffs, and his report is read into the room: "The court's officer boarded the South Stack at low water: the lamp-room unshuttered, fresh char on the wick, oil in the cup still sweet, the glass wiped clean. That lamp burned, and burned the night of the gale."]*
  — *releases `p_residue`*
**Tutor:** The officer's wick and oil are not weather-talk; they are the lamp-room writing its own line in the ledger. You already have the bearing and the chart naming South Stack. What does this burned lamp now let Rule Two write, and what hand does it still refuse to name?
  — move: analogia → p_residue (consolidate)
**Learner:** The officer's wick and oil ground it at last — lampBurnedAt southStack wreckNight enters the board as physical fact, not weather-talk. Rule One and Rule Two now chain together: logged bearing and chart tower give steeredToward mara southStack, and that paired with the burned lamp gives steeredByLampOf mara southStack — both I voice aloud. But Rule Two names a lamp, not a hand; Rules Three and Four stand at a door South Stack has not yet opened: who held the only key to that lamp-room, and whose feet were on that tower on wreck night.
  — adopts `lampBurnedAt southStack wreckNight` · derives `steeredByLampOf mara southStack` · hypothesis: The hand that held the only key to South Stack and stood there on wreck night remains unnamed in evidence; if those two facts are shown, Rules Three and Four will close the question and name whose light the Mara steered by.

### Turn 14
*[The officer's report lies open under the court's lamp, its plain words seeming to weigh more than all the maps before it. Around the table, no one reaches for it again; the room has begun to listen for a door, a bolt, a name not yet entered.]*
**Tutor:** Before we carry that flame into Rule Three, read back the officer's report from your own board. What exactly did that exhibit prove about South Stack's lamp, and what did it still leave outside the finding?
  — move: erotema → p_residue (confront)
  — *the second voice [unconfronted reentry]: "Confront p_residue first: ask the learner to read back what they hold from that exhibit before you restage or consolidate it." (draft anaphora → erotema)*
**Learner:** The officer's report grounds exactly one fact: charred wick, sweet oil, and clean glass prove the South Stack lamp burned on wreck night — lampBurnedAt southStack wreckNight, nothing more. It names no custodian, no key, no boots on the gallery; the hand that struck the light stands entirely outside his finding. Rule Three's two remaining columns — onlyKeyTo and atTowerThatNight — are blank on my board, and blank they must stay until evidence fills them.
  — hypothesis: The hand that held the only key to South Stack and stood there on wreck night remains unnamed in evidence; until onlyKeyTo southStack ?x and atTowerThatNight ?x southStack are both shown, Rules Three and Four cannot fire and the question who lit that lamp stays open.

### Turn 15
*[The open report is left untouched while the court clerk trims the lamp and the flame steadies, making the silence look deliberate. At the cleared end of the table, the empty space waits with the patience of a locked drawer.]*
**Tutor:** Set the locksmith's book beside the officer's report: when the Stack was struck off, the old lock was changed and a single key cut, signed for by Senna, ward of the last keeper, still in the shore cottage after the light went dark. A key is a hand's legal shadow, not yet the hand at the stair. What column has that book filled, and what column must still stand empty before Rule Three can speak?
  — move: analogia → p_key (release), releases `p_key`
**Learner:** The locksmith's book writes senna's name against the only key cut for South Stack — onlyKeyTo southStack senna enters my board, and two of Rule Three's three columns are now filled: the lamp burned, and the key was senna's alone. But the third column — senna's feet on that gallery on wreck night — stands unwritten still; Rule Three will not name a lamplighter until presence is shown in evidence.
  — adopts `onlyKeyTo southStack senna` · hypothesis: Senna held the only key to South Stack, named by the locksmith's book — but whether senna stood at the tower on wreck night is ungrounded; if atTowerThatNight senna southStack is shown in evidence, Rules Three and Four will close the question and name whose light the Mara steered by.

### Turn 16
*[The clerk closes the locksmith's book with a flat sound, and the room seems to hear the latch after it. Outside the windows, the weather presses at the glass; inside, no one yet moves toward the door.]*
**Tutor:** Before that key's shadow grows a hand, read back the locksmith's exhibit from your own board. What exactly does that book give the court, and what does it leave unshown?
  — move: erotema → p_key (confront)
  — *the second voice [unconfronted reentry]: "Confront p_key first: ask the learner to read back what their board holds from that exhibit, without supplying the content yourself." (draft anaphora → erotema)*
**Learner:** The locksmith's book gives exactly one column: Senna signed for the sole key cut when the old lock was changed — legal custody, no more. It shows no journey to the tower, no lamp-room door opened, no boots on the gallery stair on wreck night; the ward's presence stands entirely outside its pages. Two of Rule Three's three columns are filled — lamp burned, key Senna's alone — but the third, atTowerThatNight, is a blank the locksmith's book cannot write. Until presence is shown in evidence, the chain stops here.
  — hypothesis: Senna held the only key to South Stack, named by the locksmith's book — but whether senna stood at the tower on wreck night is ungrounded; if atTowerThatNight senna southStack is shown in evidence, Rules Three and Four will close the question and name whose light the Mara steered by.

## Act 4 (turns 17–20) — declared by the director
*[The closed book is carried from the table, and the room’s attention turns from paper to weather, from signatures to the black water outside. A door at the rear is unlatched against the gale, and the next act enters with salt on its coat: movement now, not custody, must bear the weight.]*

### Turn 17
*[The closed book is carried from the table, and the room’s attention turns from paper to weather, from signatures to the black water outside. A door at the rear is unlatched against the gale, and the next act enters with salt on its coat: movement now, not custody, must bear the weight.]*
  — *declares the movement: **Act 4** ([The closed book is carried from the table, and the room’s attention turns from paper to weather, from signatures to the black water outside. A door at the rear is unlatched against the gale, and the next act enters with salt on its coat: movement now, not custody, must bear the weight.])*
  — *calls the act closed*
**Tutor:** The key's shadow has reached as far as paper can carry it. If the law now waits for presence, what kind of proof would move a named key-holder from shore-custody to the Stack itself on wreck night?
  — move: erotema → — (orient)
**Learner:** Rules One and Two now run clean from my board: the Mara's logged bearing places her on South Stack's line, the lamp burned, so she steered by that lamp — that much is grounded. Rule Three halts for want of a single fact: Senna at the tower that night. Presence wants a witness or a track — a ferryman's log, a coast-watcher's sworn sighting, boot-prints in the stack-path mud before the tide took them.
  — hypothesis: Senna held the only key to South Stack and stood at the tower on wreck night — but atTowerThatNight senna southStack is not yet grounded in evidence; without it, Rule Three cannot fire and the question of whose light the Mara steered by remains open.
  ⚑ **act_end** — act 3 closed (director) after 7 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 5, justified 0, drift 1; arc on_arc

### Turn 18
*[The unlatched door strains once against its hook, and a sheet of rain crosses the threshold before the usher shoulders it back. The room waits with the key’s silence behind it and the sea’s answer somewhere beyond the walls.]*
**Tutor:** Custody is one column; presence is another; proof is not allowed to spend the same coin twice. Keep Senna's key where it belongs, and let the next witness carry only movement through weather toward the Stack.
  — move: anaphora → — (consolidate)
  — *the second voice [figure rut]: "Leave off erotema for this move; recast the distinction without another question." (draft erotema → anaphora)*
**Learner:** No new exhibits land on the table, but my board already carries enough for two steps: bearing plus tower gives me steered-toward, and lamp burned gives me steered-by-lamp — both run clean under Rules One and Two. Rule Three still wants Senna's feet on the Stack path that night, and the stage has not yet supplied them. The chain is two links forged and one open; I hold the hypothesis, not the answer.
  — hypothesis: Senna held the only key to South Stack and stood at the tower on wreck night — but atTowerThatNight senna southStack is not yet grounded in evidence; without it, Rule Three cannot fire and the question of whose light the Mara steered by remains open.

### Turn 19
*[The rain left on the floorboards darkens in slow islands while the room listens past its own breathing. No hand reaches for the exhibits; even the lamps seem to wait for the next voice from outside.]*
**Tutor:** You have the bearing, the tower, the burned lamp, and the key; shown, shown, shown, and shown. Before the law may put a flame in any hand, what one fact must weather bring through that door, and why is custody not enough to serve for it?
  — move: anaphora → — (test)
**Learner:** The one fact weather must carry through that door is Senna's presence at South Stack on wreck night — atTowerThatNight senna southStack. Custody of the key proves exclusive means, not movement: Rule Three names both conditions, and holding the lock while sitting in the harbour-town satisfies neither. From what the table has already shown, Rules One and Two now run clean: bearing plus tower yields steered-toward, burned lamp yields steered-by-lamp. The chain is two links forged; the third — Senna's feet on the Stack path — is the only column still empty, and no amount of key-paper can fill it.
  — hypothesis: Senna held the only key to South Stack and stood at the tower on wreck night — but atTowerThatNight senna southStack is not yet grounded in evidence; without it, Rule Three cannot fire and the question of whose light the Mara steered by remains open.

### Turn 20
*[The oyster-watch is shown in with rain still shining on his sleeves, and the room takes his sworn words into its record: "The oyster-watch will swear to it: a skiff lay tied at the Stack steps from dusk until the gale's height — Senna's skiff, by the patched brown lug, and a small light moving up the tower stair."]*
  — *releases `p_skiff`*
**Tutor:** A skiff at the Stack steps is not a verdict; it is a footprint on water, and the patched lug makes the footprint speak. Set it beside the burned lamp and the single key: what does Rule Three now allow you to write, and what finding must still wait for the court's last carry?
  — move: analogia → p_skiff (consolidate)
**Learner:** The patched brown lug names the skiff, and the small light on the stair names the hand — atTowerThatNight is grounded at last, and Rule Three now fires on all three columns: lamp burned, key held, hand present. That gives me litLampOf senna southStack, and Rule Four takes the remaining step without pause. The carry checks: the Mara steered by Senna's light.
  — adopts `atTowerThatNight senna southStack` · derives `litLampOf senna southStack` · **asserts `steeredByLightOf mara senna`**
  ⚑ **forced** — learner facts now force S
  ⚑ **grounded_anagnorisis** — The Mara steered by Senna's light — the old South Stack lamp, relit by the keeper's ward.
  ⚑ **plot_audit** — act 4 plot audited at run end: kept 5, justified 0, drift 1; arc on_arc; throughline reckoned (7 clauses)

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
- **decay** 4 slips (seed 1 · rate 0.75 · grace 1) · repaired 2 (tutor 2, re-adoption 0) · mean repair latency 2.5 turns · unrepaired at end 2 · degraded-turn integral 30 · D reversals 1
- **theory fidelity** F 0.833 at end · min 0.778
  - m_key t3→t5 (tutor) · p_bearing t5→t8 (tutor) · m_key t7 (never repaired) · m_post t8 (never repaired)
- **events** plot×4 · throughline×1 · decay×4 · act_end×3 · plot_audit×4 · repair×2 · forced×1 · grounded_anagnorisis×1
- **staging** 4 movements declared by the director
- **acts** 4 played · closed by the director 3 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–9 (director) · Act 3 t10–16 (director) · Act 4 t17–20 (run end)
- **plot** 4 committed · withhold+friction on 4/4 · 5.75 clauses avg · audits 4 (incl. final act): kept 20 / justified 0 / drift 3 · hold-named exhibits staged in act 0/3
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 4: on 4 / off 0 · run-end reckoning 7 clauses: kept 7 / justified 0 / drift 0
- **release authority** 3 played: 2 on schedule · 0 held · 1 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_key -2 (t15): "Played two turns early because the learner has cleanly grounded the burned lamp and explicitly named South Stack's key as the next missing conjunct."
- **confrontation** 4 demanded (1 against a slipped exhibit) · re-entries 0: covered 0, uncovered 0 · watcher fires 3 (became the confrontation 3) · fires without recorded due 0
  - **repair clause** restores 2 (2 repaired a real slip) · watcher fires on restore claims 0: m_key t5 · p_bearing t8
- **figures** erotema 8/20 (40%) · 4 distinct · switch rate 0.79
- **superego** intervened 5/20 watched turns · figure changed within-turn on 4/5 interventions · switch on intervention 1.00 vs elsewhere 0.71
- **inference** 3 voiced · stall integral 0 · overreach 0 · mischanneled 1 — `steeredToward mara southStack` available t9 → voiced t9 (latency 0) · `steeredByLampOf mara southStack` available t13 → voiced t13 (latency 0) · `litLampOf senna southStack` available t20 → voiced t20 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 20 | 2.95 | 3 | 42.6 |
| tutor | 20 | 2.35 | 3 | 45 |
| learner | 20 | 3.3 | 4 | 80.3 |

## Critic's commentary

*— notice by claude/claude-fable-5*

On the night a gale drove the brig Mara onto the Knock, she was steering by a fixed light, and the harbour town that holds her inquest wants to know whose. Suspicion has settled before the curtain rises on Brandt, keeper of Harlow Point, the nearest standing lamp. The play is staged as a wreck inquiry. The director sets the courtroom and calls its acts. The tutor, an examiner's voice, lays exhibits on the table and teaches by question. The learner, who knows the law of lights but none of the night's particulars, must ground each fact in evidence before using it. The inquiry ends far from where it began. The Mara's bearing-book survives dry in its oilskin; the chart shows that bearing crossing one tower only, the South Stack, struck off the light-list six years since; an officer finds fresh char on its wick; the locksmith's book names Senna, the last keeper's ward, as holder of its only key; and a sworn witness puts Senna's skiff at the Stack steps that night. The learner concludes that the Mara steered by Senna's light — a dead tower relit — and the mechanical checker confirms the recognition was earned.

The false trail rose on real exhibits: the Board's rule putting the lamp-room key on Brandt's belt (turn 2), then his signed log placing him at his post (turn 6). The learner — the one Claude voice opposite three codex parts — adopted both while naming, each time, the columns still empty. The decay channel, this world's device by which grounded facts silently slip from the learner's board, supplied the early turning points. At turn 4 the learner caught a slip itself: "if it slipped between acts, I will need it returned." At turn 7 the superego stopped the tutor from simply re-staging the slipped bearing and demanded a read-back first; the learner looked and found nothing — "The chain is broken at its first link." Turn 8 then broke the case twice in one stroke: the bearing restored, and the harbourmaster's storm-order showing Harlow Point shuttered and sealed. A dark tower steers no one; the mirror fell there. From turn 9 the proof assembled link by link until the oyster-watch's skiff arrived at turn 20 and the learner fired the last two rules in one speech: "The carry checks: the Mara steered by Senna's light."

The verdict, grounded anagnorisis, means the learner asserted the secret at the very turn its evidence forced it — a gap of zero. The derivation distance, the count of evidence pieces still missing for the proof, fell from five to nothing at a nearly flat quarter-piece per turn; no act dragged, and the longest stall ran four turns, inside the six-turn aporia window (aporia being the stall ending). Seven of eight releases landed on cue; the one deviation played the locksmith's book two turns early, with the recorded reason that the learner had named the key as the next missing conjunct — the right kind of deviation. Of four decay slips the tutor repaired the two load-bearing ones, at a mean latency of 2.5 turns and under read-back discipline, with no false restore claims; the two never repaired were Brandt-side facts the shutter had mooted, which is why theory fidelity ended at 0.833. The tutor kept four figures moving (questions at 40 percent, switch rate 0.79), and the superego's five interventions changed the figure four times; the turn-7 one made the play's best scene.

The declared movements shaped the action rather than captioning it: each act boundary tracked a phase of the proof, and the set-dressing kept forecasting the case's next need — the table cleared "for things heavier than testimony" before the physical evidence, the rear door unlatched and "movement now, not custody, must bear the weight" before the skiff. The plot audits logged three drifted clauses, looseness that never bent the action. Tension gathered properly at turns 7 and 8 and sagged at 18 and 19, two exhibit-less turns in which the learner's speeches are nearly verbatim copies. The recognition landed on stage, in dialogue — but compressed, adoption and assertion in a single breath.

This iteration establishes that the decay hygiene asked for last time works: slips were caught, load-bearing repairs came first, and the charter should now say plainly that mooted mirror matter may be left to rot, since fidelity currently reads that mercy as damage. The consequential defect is the held finale. The learner named the wanted proof at turn 17; the skiff waited until 20. Extend the early-play discretion already used for the key to the final exhibit — play it when the learner names the missing conjunct — and the next performance trades two turns of restatement for a recognition with room to breathe.
