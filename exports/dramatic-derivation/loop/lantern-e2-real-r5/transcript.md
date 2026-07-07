# The Light on the Knock — lantern-e2-real-r5

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
*[The room settles under a hard, practical silence; damp coats steam by the wall, and the empty place at the table seems already accused. Outside, the gale worries the shutters while the clerk lays a clean sheet before the court.]*

### Turn 1
*[The room settles under a hard, practical silence; damp coats steam by the wall, and the empty place at the table seems already accused. Outside, the gale worries the shutters while the clerk lays a clean sheet before the court.]*
  — *declares the movement: **Act 1** ([The room settles under a hard, practical silence; damp coats steam by the wall, and the empty place at the table seems already accused. Outside, the gale worries the shutters while the clerk lays a clean sheet before the court.])*
**Tutor:** Set the clean sheet by rule, not by rumor. Before any lamp is named, what must the court first have in hand to know what a wrecked ship was steering toward?
  — move: erotema → — (orient)
**Learner:** Before any lamp is named, the court must have the Mara's logged bearing on the wreck night — Rule 1 turns on that number alone. Then it wants to know which tower, and which tower only, stands on that bearing from her channel. Without the bearing, 'she steered for a light' is the town's gossip, not a finding.
  — hypothesis: The Mara may have steered toward Harlow Point tower, where Brandt kept — but no bearing is yet in evidence to ground it.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[The clerk reads from the Board rulebook, and the room receives it without ornament: "Harlow Point keeps one key to its lamp-room and the keeper keeps it: Brandt's, on his own belt, by the Board's standing rule. No other hand could touch that lamp."]*
  — *releases `m_key`*
**Tutor:** A key is not a verdict; it is only the lock's signature. Set Brandt's key beside the rulebook, clerk, and tell the court what it proves about Harlow Point, and what it still cannot prove about the Mara's course.
  — move: analogia → m_key (consolidate)
**Learner:** The key tells us one hand alone could touch that lamp — Brandt's, by the Board's own rule. That primes Rule 3 nicely, but Rule 3 needs two companions yet: proof the lamp burned on the wreck night, and proof Brandt stood at the tower to light it. And before any of that can bind, Rule 1 still wants the Mara's logged bearing — without it, no tower is named and the chain never starts.
  — adopts `onlyKeyTo harlowPoint brandt` · hypothesis: The Mara may have steered toward Harlow Point — Brandt keeps it and holds its only key — but the logged bearing, the lamp's burning, and Brandt's presence at the tower on the wreck night are all still wanting.

### Turn 3
*[The key lies beside the rulebook, small and hard under the court's lamps, while the clerk's clean sheet remains mostly blank. Rain taps at the panes, and no one in the room yet has a number to set against the accusation.]*
**Tutor:** Then open the mate's bearing-book: dry in its oilskin, pricked and timed, initialed for the last hour entire. From the mid-channel buoy the Mara held sou'-sou'-west a half west, on a steady fixed light. What does that entry give the court, and what does it still leave unchosen?
  — move: exemplum → p_bearing (release), releases `p_bearing`
**Learner:** The bearing-book hands the court its first number: sou'-sou'-west a half west, steady, from the mid-channel buoy — and that is Rule 1's left-hand term, now entered and grounded. What the rule still wants is the right-hand term: which tower, and which tower only, stands on SSW½W from that buoy. Harlow Point is the town's answer, but the town's answer is not the court's finding. Name the tower on that bearing, and the chain can begin to run.
  — adopts `loggedBearingOf mara sswHalfWest` · hypothesis: Harlow Point tower may stand on SSW½W from the mid-channel buoy — which would satisfy Rule 1's second condition and name the tower the Mara steered toward — but no exhibit yet places any tower on that bearing.
  ⚑ **decay** — m_key slips from the learner's board

### Turn 4
*[The clerk lets the bearing-book remain open where the mate's hand has fixed the number, and the room leans toward it as though a name might rise from the ink. The shutters knock once in the wind; no one reaches for the chart yet.]*
**Tutor:** Before we set any chart beneath it, read back the bearing-book from your own board. What exactly does that exhibit give the court, and what does it leave the court still unable to name?
  — move: erotema → p_bearing (confront)
  — *the second voice [unconfronted reentry]: "Confront first: ask the learner to read back what they hold from that exhibit before you make it carry another step." (figure held)*
**Learner:** The bearing-book gives the court exactly one thing: that the Mara held SSW½W, steady, from mid-channel buoy — Rule 1's first condition, grounded and initialed. What it cannot give is the tower: 'towerOnBearing sswHalfWest ?t' stays blank until a chart or a surveyor's record fills it. The bearing names a line across the water; only a chart can say what stands at the line's end.
  — hypothesis: Harlow Point tower may stand on SSW½W from the mid-channel buoy — which would satisfy Rule 1's second condition and name the tower the Mara steered toward — but no exhibit yet places any tower on that bearing.
  ⚑ **decay** — p_bearing slips from the learner's board

## Act 2 (turns 5–8) — declared by the director
*[The court’s first certainty has spent its force, leaving a colder kind of attention in its place. The room draws inward around procedure: seals, hours, and official hands, while the gale outside makes every shuttered surface sound like a withheld answer.]*

### Turn 5
*[The court’s first certainty has spent its force, leaving a colder kind of attention in its place. The room draws inward around procedure: seals, hours, and official hands, while the gale outside makes every shuttered surface sound like a withheld answer.]*
  — *declares the movement: **Act 2** ([The court’s first certainty has spent its force, leaving a colder kind of attention in its place. The room draws inward around procedure: seals, hours, and official hands, while the gale outside makes every shuttered surface sound like a withheld answer.])*
  — *calls the act closed*
**Tutor:** Procedure is a compass only when each point is entered in its own column. Custody may answer who could touch a lamp, hours may answer who stood where, but what still cannot name a tower until the chart is laid under the bearing?
  — move: anaphora → — (orient)
**Learner:** The tutor names the gap exactly: bearing and tower must be matched before Rule 1 yields anything at all. I have the ship's wreck and the court's inquiry, but no logged bearing is yet in evidence, and no chart has placed any tower on any bearing from the channel. The board is patient; I must be too.
  — hypothesis: Harlow Point tower may stand on the Mara's logged bearing from mid-channel — which would satisfy Rule 1's second condition and name the tower she steered toward — but neither the logged bearing nor any chart placing a tower on that bearing has yet been entered in evidence.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 5, justified 0, drift 1; arc on_arc

### Turn 6
*[Brandt's log is brought up from the keeper's desk and read under the clerk's finger: Brandt's log has him at his post the night entire, and the dawn relief found him there: wood dry, glass polished, log ruled and signed to the hour. The room receives it without warmth, as if procedure has opened one door only to show another locked behind it.]*
  — *releases `m_post`*
**Tutor:** Leave Brandt's hours unopened for one beat; your board has dropped the prior paper. The mate's bearing-book came ashore dry in its oilskin: from the mid-channel buoy the Mara held sou'-sou'-west a half west for the last hour entire, on a steady fixed light, course pricked, timed, and initialed. Put that line back under Rule 1: what does it fix before Brandt's log can matter?
  — move: exemplum → p_bearing (restore)
**Learner:** Brandt's log now grounds his presence at the tower that night — Rule 3 wants that, along with the lamp burning and the only key in his hand. But Rule 1 still sits idle: the bearing is on the board, yet no chart or testimony has yet set Harlow Point upon SSW½W from the channel, and without that tower placed on that bearing, I cannot name what the Mara steered toward. I adopt Brandt's presence; the chain holds until the tower is pinned to the bearing.
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: Harlow Point tower stands on SSW½W from the mid-channel buoy — which would satisfy Rule 1's second condition and yield steeredToward mara harlowPoint — but no exhibit yet places any tower on that bearing from the channel.
  ⚑ **repair** — p_bearing restored by the tutor

### Turn 7
*[The clerk leaves the chart table bare a moment longer, its brass weights waiting at the corners. Outside, the wind presses the windows until the panes tremble, and every face in the room turns toward the empty space where a line on paper ought to be.]*
**Tutor:** Lay the rule on the Trinity chart from the mid-channel buoy: sou'-sou'-west a half west crosses one tower and one only on this coast, the old South Stack, struck off the light-list six years since. A chart is not an accusation; it is the coast giving the bearing its noun. Under Rule 1, what may the court now say the Mara steered toward, and what may it still not say about any lamp?
  — move: analogia → p_chart (release), releases `p_chart`
**Learner:** The chart names the tower — and it is South Stack, not Harlow Point: decommissioned six years, struck off the list, and standing dark by law. Rule 1 now yields steeredToward mara southStack, but Rule 2 waits on a lamp that had no right to burn. Brandt's hours at Harlow Point are true, and I keep them, but they stand on a different road entirely now.
  — adopts `towerOnBearing sswHalfWest southStack` · derives `steeredToward mara southStack` · hypothesis: A lamp burned at South Stack on the wreck night without authority — unauthorized, unregistered — and the hand that held its key and stood there that night is the one the underwriters want; but neither the burning nor the key-holder is yet before the court.
  ⚑ **decay** — m_post slips from the learner's board

### Turn 8
*[The harbourmaster's storm-order stands in the book: Harlow Point to shutter at the dusk gun, the channel closed to all sail. The inspector found the shutter drawn and the Board's seal on it unbroken at first light.]*
  — *releases `m_shutter`*
**Tutor:** A shutter with the Board's seal unbroken is an account closed before the wreck is entered. What does that close at Harlow Point, and why can it not reopen the chart's finding about South Stack?
  — move: analogia → m_shutter (consolidate)
**Learner:** The sealed shutter closes Harlow Point entirely: no lamp burned there that night, and Rule 2 finds nothing to feed on — Brandt's hours at a dark tower neither advance nor impeach any chain. The chart's finding is a matter of geometry: South Stack sits on SSW½W from the channel because that is where the coast put it, and no harbourmaster's order can shift a tower's position on a bearing. The question has narrowed to one decommissioned tower, dark by law — whether a lamp burned there without authority, and whose hand struck it.
  — adopts `shutteredOn harlowPoint wreckNight` · hypothesis: A lamp burned at South Stack on the wreck night without authority — the tower struck from the light-list six years since — and whoever held its key and stood there that night is the hand the underwriters want; but neither the burning nor the key-holder is yet before the court.

## Act 3 (turns 9–12) — declared by the director
*[The room has learned to distrust official daylight; now it waits for what surfaces can remember. Papers give way to objects, and the gale seems to carry the smell of closed places opened under oath.]*

### Turn 9
*[The room has learned to distrust official daylight; now it waits for what surfaces can remember. Papers give way to objects, and the gale seems to carry the smell of closed places opened under oath.]*
  — *declares the movement: **Act 3** ([The room has learned to distrust official daylight; now it waits for what surfaces can remember. Papers give way to objects, and the gale seems to carry the smell of closed places opened under oath.])*
  — *calls the act closed*
**Tutor:** Objects answer only the question the rule has made ready. Before the officer brings us any surface from the tower, what single conjunct now waits between a tower steered toward and a lamp steered by?
  — move: erotema → — (orient)
**Learner:** Rule 1 already closes on my board: South Stack stands on SSW½W, the Mara logged SSW½W — steeredToward mara southStack follows. The one conjunct Rule 2 still wants is lampBurnedAt southStack wreckNight. Harlow Point was shuttered, so it cannot supply that fact; only South Stack can. The officers must bring us something — a surface, a wick, a sealed room — that shows whether that dark tower burned.
  — hypothesis: A lamp burned at South Stack on the wreck night — unauthorized, struck from the light-list — and whoever held its key and stood there that night is the hand the underwriters want; but lampBurnedAt southStack wreckNight is not yet before the court.
  ⚑ **act_end** — act 2 closed (director) after 4 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 10
*[The officer pauses at the threshold with salt drying white on his coat, and the clerk clears a space on the table without yet setting anything down. Outside, the gale presses at the panes as if the coast itself were waiting to be cross-examined.]*
**Tutor:** Keep the columns apart before the officer sets a thing down. Shown, if it is shown, that South Stack burned; shown, if it is later shown, who alone could touch it; shown, if it is later shown, who stood there in the gale. Which column can the next surface answer, and which must remain blank?
  — move: anaphora → — (test)
**Learner:** The surface the officer carries can answer only the first column: lampBurnedAt southStack wreckNight — char on the wick, oil drawn down, soot on the glass will settle it. The second column, onlyKeyTo southStack, wants a register or a keeper's testimony, not a physical surface. The third, atTowerThatNight, wants a living witness who placed a hand there in the gale — neither of those waits in the officer's coat. My board already closes Rule 1: loggedBearingOf mara sswHalfWest and towerOnBearing sswHalfWest southStack together yield steeredToward mara southStack, and I enter it.
  — hypothesis: A lamp burned at South Stack on the wreck night — unauthorized, struck from the light-list — and whoever held its key and stood there that night is the hand the underwriters want; but lampBurnedAt southStack wreckNight, onlyKeyTo southStack ?x, and atTowerThatNight ?x southStack are none of them yet before the court.

### Turn 11
*[The cleared table remains bare a moment longer, its polished edge catching the lamps in thin, uneasy lines. The officer stands with one hand closed around nothing shown, while the room listens to the weather spend itself against the walls.]*
**Tutor:** Good: the law has not asked yet for a face, only for a burning. If the officer's surface answers that column, what finding would Rule 2 permit at South Stack, and what two columns would still stand empty before any hand can be named?
  — move: anaphora → — (test)
**Learner:** If the officer's surface shows drawn oil and char, Rule 2 closes at once: steeredToward mara southStack already stands on my board from Rule 1, and lampBurnedAt southStack wreckNight would complete it — yielding steeredByLampOf mara southStack. But the court still wants a hand, not a lamp, and two columns stand bare before any hand can be named: onlyKeyTo southStack, which wants a register or a keeper's authority, and atTowerThatNight, which wants a living witness in the gale. Until both fill, Rule 3 cannot fire, and the underwriters' account stays open.
  — hypothesis: A lamp burned at South Stack on the wreck night — unauthorized, struck from the light-list — and whoever held its key and stood there that night is the hand the underwriters want; but lampBurnedAt southStack wreckNight, onlyKeyTo southStack ?x, and atTowerThatNight ?x southStack are none of them yet before the court.

### Turn 12
*[The officer's closed hand does not open; instead the clerk straightens the empty exhibit labels and leaves one space conspicuously unfilled. The room settles into the narrow silence between a question properly formed and the object that may answer it.]*
**Tutor:** Then let the empty label do its work. If no surface is yet before the court, what is the strongest finding your board already permits, and where exactly must the next proof enter before Rule 2 can move?
  — move: erotema → — (test)
**Learner:** The board already closes Rule 1 — loggedBearingOf mara sswHalfWest and towerOnBearing sswHalfWest southStack together yield steeredToward mara southStack, and I enter it now. That is the strongest finding the court yet permits: she was steering toward South Stack, not Harlow Point. Rule 2 stands at the threshold with one column full; the missing entry is lampBurnedAt southStack wreckNight — char, drawn oil, soot — physical proof the lamp was alive that night, and nothing else will move it.
  — hypothesis: A lamp burned at South Stack on the wreck night — unauthorized, struck from the light-list — and whoever held its key and stood there that night is the hand the underwriters want; but lampBurnedAt southStack wreckNight, onlyKeyTo southStack ?x, and atTowerThatNight ?x southStack are none of them yet before the court.
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
- **plot** 3 committed · withhold+friction on 3/3 · 6 clauses avg · audits 3 (incl. final act): kept 17 / justified 0 / drift 1 · hold-named exhibits staged in act 0/0
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 3: on 3 / off 0 · run-end reckoning 7 clauses: kept 7 / justified 0 / drift 0
- **release authority** 2 played: 0 on schedule · 0 held · 2 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_bearing -1 (t3): "The clerk has already named the missing bearing, so the exhibit can land one turn early without outrunning the board."
  - p_chart -2 (t7): "Played early because the clerk has repeatedly named the chart as the exact missing conjunct for Rule 1."
- **confrontation** 1 demanded (1 against a slipped exhibit) · re-entries 0: covered 0, uncovered 0 · watcher fires 1 (became the confrontation 1) · fires without recorded due 0
  - **repair clause** restores 1 (1 repaired a real slip) · watcher fires on restore claims 0: p_bearing t6
- **figures** erotema 4/12 (33%) · 4 distinct · switch rate 0.82
- **superego** intervened 1/12 watched turns · figure changed within-turn on 0/1 interventions · switch on intervention 1.00 vs elsewhere 0.80
- **inference** 1 voiced · stall integral 0 · overreach 0 · mischanneled 0 — `steeredToward mara southStack` available t7 → voiced t7 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 12 | 3 | 3 | 42.9 |
| tutor | 12 | 2.33 | 3 | 45 |
| learner | 12 | 3.33 | 4 | 75.7 |
