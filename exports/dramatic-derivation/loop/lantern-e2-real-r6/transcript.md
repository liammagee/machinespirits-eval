# The Light on the Knock — lantern-e2-real-r6

> world `world_002_lantern` · verdict **disengagement** · 12/26 turns

```
D= 5 ●●··│●···│····
D= 4   ●●│ ●··│····
D= 3     │  ●●│●●●●
D= 2     │    │    
D= 1     │    │    
D= 0     │    │    
turn      │+   │ 1   (+=5, digit=x10)
rel    ▲▲ │ ▲▲▲│     (▲ = evidence released)
slope 0.17 D/turn overall (D 5→3); per movement: 1 0.25 │ 2 0.25 │ 3 0.00
```

## Act 1 (turns 1–4) — declared by the director
*[The hearing room settles under a low, wet hush; ink, wool, and salt seem to share the same cold air. A blank space waits on the table where the first account of the wreck will be laid.]*

### Turn 1
*[The hearing room settles under a low, wet hush; ink, wool, and salt seem to share the same cold air. A blank space waits on the table where the first account of the wreck will be laid.]*
  — *declares the movement: **Act 1** ([The hearing room settles under a low, wet hush; ink, wool, and salt seem to share the same cold air. A blank space waits on the table where the first account of the wreck will be laid.])*
**Tutor:** Before a sum is cast, clerk, tell me the court's rule for a wreck like this: do we begin with the loudest accusation, or with the first paper that fixes where the ship was made to look? Keep your ink dry until a bearing, a tower, and a burning lamp have each earned their line.
  — move: erotema → — (orient)
**Learner:** The rule is plain, sir: accusation spends no ink until three things are in evidence — the bearing she steered, the tower that stood on it, and the lamp that burned there that night. We have only that she steered for a light; we do not yet know which bearing, which tower, nor whether any lamp was burning. Brandt's name is loud in the room, but his lamp at Harlow Point earns no line on my board until a bearing ties the Mara to that tower. I keep my ink dry.
  — hypothesis: The light Mara steered by may have been the lamp at Harlow Point (keeper: Brandt), but no bearing or tower placement is yet in evidence to ground this.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[The clerk produces the Board's standing rule and reads it into the wet hush: Harlow Point keeps one key to its lamp-room and the keeper keeps it: Brandt's, on his own belt. No other hand could touch that lamp.]*
  — *releases `m_key`*
**Tutor:** A single key is like a single signature on a bill: it can tell whose hand could touch Harlow's lamp, but not whether the Mara ever looked there. Put Brandt's belt on the board, clerk, and then mark the blank beside it: what first conjunct is still missing before Harlow Point can earn a line?
  — move: analogia → m_key (consolidate)
**Learner:** Brandt's belt holds Harlow's only key — that earns its line on the board. But the chain still wants its first link: without the Mara's logged bearing, I cannot place her eyes on any tower at all, let alone Harlow Point. The key proves who alone could touch that lamp; it proves nothing yet of where the Mara looked. I board the key and mark the bearing as the standing gap.
  — adopts `onlyKeyTo harlowPoint brandt` · hypothesis: The light Mara steered by may have been the lamp at Harlow Point (keeper: Brandt), but no logged bearing and no confirmation of lampBurnedAt harlowPoint wreckNight are yet in evidence to ground this.

### Turn 3
*[Rain ticks against the hearing-room glass while the clerk leaves the open ledger untouched, its ruled lines waiting under the lamp. The room holds its certainty a moment longer, but the empty space beside it grows more visible.]*
**Tutor:** The mate's bearing-book is laid open, dry from its oilskin: from the mid-channel buoy the Mara held sou'-sou'-west a half west for the last hour entire, on a steady fixed light, pricked, timed, and initialed. A bearing is no verdict, clerk; it is the ruled column where verdicts must begin. What does that paper now fix, and what does it still leave blank?
  — move: analogia → p_bearing (release), releases `p_bearing`
**Learner:** The bearing-book fixes one ruled column at last: the Mara held sou'-sou'-west a half west, steady, for a full hour on a fixed light. But the paper still leaves the next column blank — it names the bearing, not the tower that stands on it from mid-channel. Harlow Point may stand on that line, or another tower may; until a witness or a chart places a tower on sswHalfWest, the chain cannot close. I adopt the bearing and mark tower-on-bearing as the new standing gap.
  — adopts `loggedBearingOf mara sswHalfWest` · hypothesis: The tower on bearing sswHalfWest from mid-channel may be Harlow Point — which would ground steeredToward mara harlowPoint — but no exhibit yet places any tower on that bearing.
  ⚑ **decay** — m_key slips from the learner's board

### Turn 4
*[The ledger remains open beneath the hearing-room lamp, its inked bearing lying beside the harder, older certainty the room came in carrying. Outside, rain thickens on the panes, and no one yet moves to close the book.]*
**Tutor:** So the ink has moved one column and no farther. If the bearing is fixed but no tower is yet laid upon it, what name in this room is still only a shout from the benches, not a finding from the book?
  — move: erotema → — (consolidate)
**Learner:** Brandt's name is the room's verdict, not the book's — the benches shouted it before the first witness stood. The book has fixed one ruled line: bearing sswHalfWest, steady, on a fixed light. But no chart and no witness has yet placed any tower on that bearing from mid-channel, so rule one cannot fire, and Brandt stays a hypothesis, not a finding.
  — hypothesis: The tower on bearing sswHalfWest from mid-channel may be Harlow Point — which would ground steeredToward mara harlowPoint — but no exhibit yet places any tower on that bearing.
  ⚑ **decay** — p_bearing slips from the learner's board

## Act 2 (turns 5–8) — declared by the director
*[The clerk closes no book, but the room’s first certainty has lost its easy voice; chairs creak, wet coats settle, and the charge hangs without the comfort it had at opening. A colder patience enters the hearing, as though the next witness will be received in a room less willing to mistake noise for proof.]*

### Turn 5
*[The clerk closes no book, but the room’s first certainty has lost its easy voice; chairs creak, wet coats settle, and the charge hangs without the comfort it had at opening. A colder patience enters the hearing, as though the next witness will be received in a room less willing to mistake noise for proof.]*
  — *declares the movement: **Act 2** ([The clerk closes no book, but the room’s first certainty has lost its easy voice; chairs creak, wet coats settle, and the charge hangs without the comfort it had at opening. A colder patience enters the hearing, as though the next witness will be received in a room less willing to mistake noise for proof.])*
  — *calls the act closed*
**Tutor:** Before the next witness chills the room further, read me your board without borrowing from the benches. What does the first paper fix, and what column beside it is still empty?
  — move: erotema → p_bearing (confront)
**Learner:** The first paper fixes only this: the Mara wrecked on the Knock bar — that column is full and uncontested. Beside it, every column the rules require stands empty: no logged bearing, no tower placed on a bearing, no lamp confirmed burning, no key-holder named, no one placed at any tower that night. Entry three tells me she steered for a light, and entry two gives me Brandt at Harlow Point — but steeredForLight without a bearing is not steeredToward, and keeperOf without a burning lamp and a key is not litLampOf. The chain cannot move one link forward on what I presently hold.
  — hypothesis: The tower on the bearing Mara steered may be Harlow Point — which would ground steeredToward mara harlowPoint — but no exhibit yet places any tower on that bearing, and no logged bearing is on my board.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 6
*[Brandt's log is produced, and the room receives it line by ruled line: Brandt's log has him at his post the night entire, and the dawn relief found him there: wood dry, glass polished, log ruled and signed to the hour.]*
  — *releases `m_post`*
**Tutor:** Bring that first paper back onto the table, clerk: the mate's bearing-book came ashore dry in its oilskin, and from the mid-channel buoy the Mara held sou'-sou'-west a half west for the last hour entire, on a steady fixed light, pricked, timed, and initialed. Treat it as a ruled column, not a verdict. What does that column now fix, and what column still waits beside it?
  — move: exemplum → p_bearing (restore)
**Learner:** The bearing column is now ruled and full: sou'-sou'-west a half west, pricked from the mid-channel buoy, timed and initialed — that I hold. And Brandt's log fills the attendance column: he was at Harlow Point the night entire, dawn relief found him there. But the column between bearing and tower still stands empty: no exhibit yet places any tower — Harlow Point or otherwise — on that bearing from mid-channel. Without towerOnBearing sswHalfWest harlowPoint, Rule 1 will not fire, and steeredToward cannot be entered.
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: The tower on bearing sswHalfWest from the mid-channel buoy may be Harlow Point — which would ground steeredToward mara harlowPoint and open the full chain — but no exhibit yet places any tower on that bearing.
  ⚑ **repair** — p_bearing restored by the tutor

### Turn 7
*[The room holds itself in the pause after the log, the benches quieter now than when they first crowded in. Rain ticks at the high panes; the clerk's hand rests above the next folded paper without yet breaking its string.]*
**Tutor:** Lay the Trinity chart under the rule: from the mid-channel buoy, sou'-sou'-west a half west crosses one tower and one only on this coast — the old South Stack, struck off the light-list six years since. A chart is like a ledger's cross-footing: it does not name a culprit, it proves which column the bearing enters. What does that do to your tower gap, and what question still stands before any lamp can steer a ship?
  — move: analogia → p_chart (release), releases `p_chart`
**Learner:** The chart fills my tower gap — but it fills it for South Stack, not Harlow Point, and South Stack has been off the light-list six years. Rule 1 now fires: the Mara steered toward South Stack. But the column that still waits is lampBurnedAt southStack wreckNight — and if that dark tower showed a burning lamp, the question of whose key and whose hand shifts entirely away from Brandt, who was logged fast at Harlow Point the night entire.
  — adopts `towerOnBearing sswHalfWest southStack` · derives `steeredToward mara southStack` · hypothesis: If a lamp burned at South Stack on the wreck night, the hand that lit it was not Brandt — logged at Harlow Point entire — but some other key-holder yet unnamed; neither the burning nor the key is yet in evidence.
  ⚑ **decay** — m_post slips from the learner's board

### Turn 8
*[The harbourmaster's storm-order is opened in the book before the room: Harlow Point to shutter at the dusk gun, the channel closed to all sail. The inspector's return is laid beside it: the shutter drawn and the Board's seal on it unbroken at first light.]*
  — *releases `m_shutter`*
**Tutor:** A shutter under seal is not a rumor answered with another rumor; it is a locked column in the account. If Harlow Point was ordered dark and found sealed at first light, what happens to the bench's old charge before you ever ask whether South Stack burned?
  — move: erotema → m_shutter (consolidate)
**Learner:** The shutter under seal clears the bench's old ledger before pen ever touches it: Harlow Point was ordered dark, found sealed at first light — that lamp could steer no one. And the bearing-book already ruled it out regardless, for the Mara's bearing runs to South Stack, not Harlow Point. Two columns against the old charge; neither carries a mark for Brandt. The open question is South Stack alone: did that off-list tower burn on the wreck night, and whose hand held its key?
  — adopts `shutteredOn harlowPoint wreckNight` · hypothesis: If a lamp burned at South Stack on the wreck night — a tower six years off the light-list — some unauthorized hand must have lit it; neither the key-holder nor the burning is yet in evidence.

## Act 3 (turns 9–12) — declared by the director
*[The papers are gathered without triumph, and the room feels larger for the charge that has fallen out of it. Beyond the windows the weather presses close; the hearing turns from tidy ledgers toward things that must be touched, opened, and seen.]*

### Turn 9
*[The papers are gathered without triumph, and the room feels larger for the charge that has fallen out of it. Beyond the windows the weather presses close; the hearing turns from tidy ledgers toward things that must be touched, opened, and seen.]*
  — *declares the movement: **Act 3** ([The papers are gathered without triumph, and the room feels larger for the charge that has fallen out of it. Beyond the windows the weather presses close; the hearing turns from tidy ledgers toward things that must be touched, opened, and seen.])*
  — *calls the act closed*
**Tutor:** The room has done one honest thing: it has let a charge fall without needing a substitute too soon. Before we leave paper for iron and glass, read the board as a rule would read it: which tower has the bearing brought under the Mara's eye, and what kind of proof must be touched before that tower's lamp can enter the account?
  — move: erotema → — (orient)
**Learner:** Rule one already works from what is on my board: bearing sswHalfWest, tower southStack on that bearing — the Mara was steered toward South Stack, and I voice that now. Harlow Point is shuttered and irrelevant to the chain; the bearing has moved the inquiry entirely to South Stack. But the chain stalls at the next gate: I cannot enter lampBurnedAt southStack wreckNight from paper — the wick, the oil-reservoir, the lens must be opened and read in person. Until a hand has touched that lamp-room and reported what it found, Rule two cannot fire and the account stays open.
  — hypothesis: A lamp may have burned at South Stack on the wreck night — South Stack being six years off the light-list makes any burning unauthorized — but neither lampBurnedAt southStack wreckNight nor any key-holder is yet in evidence; physical inspection of the tower is needed before the chain can proceed.
  ⚑ **act_end** — act 2 closed (director) after 4 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 10
*[The room waits on the scrape of boots and the closing of distant doors, its papers left in their neat, insufficient piles. Rain darkens the window glass, and the empty space where the next exhibit will lie seems to draw every eye.]*
**Tutor:** Good; keep the account divided cleanly: Harlow fallen, South Stack fixed by the bearing, the lamp still unproved. Bearing shown, tower shown, burning not yet shown. While that third column is empty, no hand earns a name in the record.
  — move: anaphora → — (consolidate)
  — *the second voice [figure rut]: "Leave off erotema here; do not make the next move another governing question." (draft erotema → anaphora)*
**Learner:** No new exhibits reach the table, so the board stands unchanged and I hold nothing I did not hold before. Rule one, however, fires cleanly from what I carry: bearing sswHalfWest is logged, South Stack stands on that bearing — I voice steeredToward mara southStack and enter it formally on the record. The chain stalls precisely at Rule two's gate: lampBurnedAt southStack wreckNight is the one fact that must come from a hand that has opened the lamp-room, and paper cannot supply it.
  — hypothesis: A lamp may have burned at South Stack on the wreck night — but neither lampBurnedAt southStack wreckNight nor any key-holder for that tower is yet in evidence; physical inspection of the lamp-room is needed before the chain can proceed to Rules two, three, and four.

### Turn 11
*[The clerk turns a blank page and leaves the pen across it, as if the room itself has come to the edge of what paper can bear. Outside, the rain keeps its own counsel against the glass.]*
**Tutor:** Then keep the blank page honest, clerk. If the bearing has brought the Mara under South Stack's eye, what would the court have to touch or see before that dark-listed tower may be counted as a burning lamp?
  — move: erotema → — (test)
**Learner:** The court must open the lamp-room itself: a charred wick or a depleted oil-reservoir speaks to burning; an untouched wick and a full reservoir speaks to darkness. No chart, no ledger, no testimony at second hand can supply that reading — only an inspector who has lifted the lens-cover and set his hand to the reservoir. Rule one fires cleanly from what my board already holds, and I voice it now: loggedBearingOf mara sswHalfWest and towerOnBearing sswHalfWest southStack together yield steeredToward mara southStack. But Rule two will not open until the lamp-room evidence reaches this table.
  — hypothesis: A lamp may have burned at South Stack on the wreck night — but lampBurnedAt southStack wreckNight can only be established by physical inspection of the lamp-room (wick condition, oil level, lens); neither that fact nor any key-holder for South Stack is yet in evidence, and both are required before Rules two, three, and four can run.

### Turn 12
*[The room holds its breath around the unopened blank, the old papers lying flat and useless under the clerk's hand. A gust worries the panes, and every face turns for a sound from the passage that has not yet come.]*
**Tutor:** A court may stare at a blank until it mistakes hunger for proof; do not let it. Bearing shown, tower shown, burning not yet shown. What single mark, if the lamp-room gives it, would open Rule Two and no farther?
  — move: anaphora → — (test)
**Learner:** One mark only: a charred wick, or oil drawn down in the reservoir — either tells the court lampBurnedAt southStack wreckNight. That single fact, joined to steeredToward mara southStack which Rule One already yields from my board, fires Rule Two and delivers steeredByLampOf mara southStack. There the chain stalls again: onlyKeyTo and atTowerThatNight for South Stack are still blank, and Rule Three will not open until both arrive.
  — hypothesis: A charred wick or depleted oil-reservoir in South Stack's lamp-room would give lampBurnedAt southStack wreckNight — the one fact that opens Rule Two; but onlyKeyTo southStack and atTowerThatNight for that tower remain entirely ungrounded, so Rules Three and Four cannot yet run even if Rule Two opens.
  ⚑ **disengagement** — no progress over 6 turns
  ⚑ **plot_audit** — act 3 plot audited at run end: kept 6, justified 0, drift 0; arc on_arc; throughline reckoned (7 clauses)

## Instrument panel (programmatic eval — no judge)

- **verdict** `disengagement` · 12/26 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0.167 D/turn overall (D 5→3 over 12 turns)
  - Act 1 (turns 1–4): 0.25 D/turn (ΔD 1)
  - Act 2 (turns 5–8): 0.25 D/turn (ΔD 1)
  - Act 3 (turns 9–12): 0 D/turn (ΔD 0)
- **plateau** longest flat stretch 5 turns (aporia window 6)
- **releases** 3/8 on cue · 2 deviated
- **decay** 3 slips (seed 1 · rate 0.75 · grace 1) · repaired 1 (tutor 1, re-adoption 0) · mean repair latency 2 turns · unrepaired at end 2 · degraded-turn integral 16 · D reversals 1
- **theory fidelity** F 0.778 at end · min 0.667
  - m_key t3 (never repaired) · p_bearing t4→t6 (tutor) · m_post t7 (never repaired)
- **events** plot×3 · throughline×1 · decay×3 · act_end×2 · plot_audit×3 · repair×1 · disengagement×1
- **staging** 3 movements declared by the director
- **acts** 3 played · closed by the director 2 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–8 (director) · Act 3 t9–12 (run end)
- **plot** 3 committed · withhold+friction on 3/3 · 6 clauses avg · audits 3 (incl. final act): kept 18 / justified 0 / drift 0 · hold-named exhibits staged in act 0/0
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 3: on 3 / off 0 · run-end reckoning 7 clauses: kept 7 / justified 0 / drift 0
- **release authority** 2 played: 0 on schedule · 0 held · 2 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_bearing -1 (t3): "The clerk has already named the bearing as the standing gap, so the paper can enter one turn early to keep the account moving."
  - p_chart -2 (t7): "The clerk has twice named tower-on-bearing as the active gap and is ready for the chart before its scheduled cue."
- **confrontation** 1 demanded (1 against a slipped exhibit) · re-entries 0: covered 0, uncovered 0 · watcher fires 0 (became the confrontation 0) · fires without recorded due 0
  - **repair clause** restores 1 (1 repaired a real slip) · watcher fires on restore claims 0: p_bearing t6
- **figures** erotema 6/12 (50%) · 4 distinct · switch rate 0.73
- **superego** intervened 1/12 watched turns · figure changed within-turn on 1/1 interventions · switch on intervention 1.00 vs elsewhere 0.70
- **inference** 1 voiced · stall integral 0 · overreach 0 · mischanneled 0 — `steeredToward mara southStack` available t7 → voiced t7 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 12 | 2.92 | 3 | 41.1 |
| tutor | 12 | 2.42 | 3 | 51.3 |
| learner | 12 | 3.67 | 4 | 84.1 |
