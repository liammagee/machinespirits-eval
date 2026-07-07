# The Light on the Knock — lantern-e2-real-r8

> world `world_002_lantern` · verdict **disengagement** · 12/26 turns

```
D= 5 ●●··│●●··│····
D= 4   ●●│  ●●│●●●●
D= 3     │    │    
D= 2     │    │    
D= 1     │    │    
D= 0     │    │    
turn      │+   │ 1   (+=5, digit=x10)
rel    ▲▲ │ ▲▲▲│     (▲ = evidence released)
slope 0.08 D/turn overall (D 5→4); per movement: 1 0.25 │ 2 0.00 │ 3 0.00
```

## Act 1 (turns 1–4) — declared by the director
*[The hearing room settles under a hard white morning, benches close-packed and damp coats steaming at the walls. On the table, the empty space where exhibits will lie seems already to accuse someone.]*

### Turn 1
*[The hearing room settles under a hard white morning, benches close-packed and damp coats steaming at the walls. On the table, the empty space where exhibits will lie seems already to accuse someone.]*
  — *declares the movement: **Act 1** ([The hearing room settles under a hard white morning, benches close-packed and damp coats steaming at the walls. On the table, the empty space where exhibits will lie seems already to accuse someone.])*
**Tutor:** Keep your ink dry, clerk: an empty table proves nothing, and a crowded one proves nothing until the rule has had its hands on it. What must the court first fix before it can say any ship steered by any light?
  — move: erotema → — (orient)
**Learner:** The court must first fix the logged bearing the Mara held that night — without it, Rule 1 cannot place any tower on her course. All else follows from that one entry in the log: bearing fixes tower, tower fixes lamp, lamp fixes hand. My board already holds that she steered for a light, but 'steered for a light' names no bearing and no tower. Until the bearing is in evidence, Brandt stays a name on my board and nothing more.
  — hypothesis: The Mara's logged bearing may place Harlow Point — Brandt's tower — on her course, but this is conjecture until the log or a witness establishes the bearing.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[The clerk produces the Board's standing rule, and the room receives it in a dry official voice: "Harlow Point keeps one key to its lamp-room and the keeper keeps it: Brandt's, on his own belt, by the Board's standing rule. No other hand could touch that lamp."]*
  — *releases `m_key`*
**Tutor:** Set that rule beside your steering rule, not over it: a key is like a signature on one lamp-room, and it signs only what that room could have done. Before Brandt's belt can matter to the Mara, what still must be fixed about the course she actually held?
  — move: analogia → m_key (consolidate)
**Learner:** I'll enter the key at once — it locks Harlow Point to one hand, and that hand to Brandt. But the key is only the last link: Rule 3 cannot fire until Rules 1 and 2 have placed the Mara at Harlow Point's lamp. What the table still wants is the logged bearing she held, and whether Harlow Point stands on it.
  — adopts `onlyKeyTo harlowPoint brandt` · hypothesis: The Mara's logged bearing may place Harlow Point on her course, but without that bearing in evidence the key on Brandt's belt cannot close the chain under any rule.

### Turn 3
*[Rain ticks against the hearing-room windows, and the benches settle into a waiting hush. The clerk's pen hovers over a blank line, the table holding its silence where the next exhibit has not yet arrived.]*
**Tutor:** Then take the mate's bearing-book, dry in its oilskin: from the mid-channel buoy the Mara held sou'-sou'-west a half west the last hour entire, on a steady fixed light, the course pricked, timed, and initialed. A bearing is a debt entry, clerk; before it names a debtor, what does Rule 1 require you to lay against it?
  — move: analogia → p_bearing (release), releases `p_bearing`
**Learner:** The bearing is entered — sou'-sou'-west a half west, steady, the whole last hour. But Rule 1 demands two entries, not one: a logged bearing, and a tower that stands on that bearing from her position. The bearing names a direction; I still need the chart or a witness to lay a tower against it. Until towerOnBearing sswHalfWest is on the table, Harlow Point stays conjecture and the chain cannot close.
  — adopts `loggedBearingOf mara sswHalfWest` · hypothesis: Harlow Point may stand on bearing sswHalfWest from the mid-channel buoy — if so, Rule 1 fires and the chain to Brandt closes — but this wants chart or survey evidence before I can enter it as fact.
  ⚑ **decay** — m_key slips from the learner's board

### Turn 4
*[The rain thins to a pale tapping, leaving the hearing room sharper for its quiet. The mate's book lies open under the lamps, its line of ink neither yielding a tower nor releasing the room from wanting one.]*
**Tutor:** Before we lay any paper against that line, read me the bearing-book from your own board. What, exactly, do you hold that exhibit fixes, and what does it leave unfixed?
  — move: erotema → p_bearing (confront)
  — *the second voice [unconfronted reentry]: "Confront p_bearing first: ask the learner to read back what they hold of that exhibit before you stage it again. Leave analogia off this turn." (draft analogia → erotema)*
**Learner:** The bearing-book fixes one thing exactly: the Mara held sou'-sou'-west a half west for the last hour — a direction, nothing more. It does not name a tower, and Rule 1 will not fire until I can lay a tower against that line from her position. I also notice my board has lost the key entry from the director's standing-rule — onlyKeyTo harlowPoint brandt — and I cannot close Rule 3 without it; I flag that gap now.
  — hypothesis: Harlow Point may stand on bearing sswHalfWest from the mid-channel buoy — if chart or survey evidence confirms this, Rule 1 fires and the chain to Brandt closes — but towerOnBearing is not yet on the table.
  ⚑ **decay** — p_bearing slips from the learner's board

## Act 2 (turns 5–8) — declared by the director
*[The clerk closes the bearing-book without flourish, and the room feels the weight of its own certainty begin to shift. Beyond the windows the morning light flattens, preparing a colder act: sealed doors, official marks, and the pressure of proof turning back upon the charge.]*

### Turn 5
*[The clerk closes the bearing-book without flourish, and the room feels the weight of its own certainty begin to shift. Beyond the windows the morning light flattens, preparing a colder act: sealed doors, official marks, and the pressure of proof turning back upon the charge.]*
  — *declares the movement: **Act 2** ([The clerk closes the bearing-book without flourish, and the room feels the weight of its own certainty begin to shift. Beyond the windows the morning light flattens, preparing a colder act: sealed doors, official marks, and the pressure of proof turning back upon the charge.])*
  — *calls the act closed*
**Tutor:** Enter the Board's standing rule again, exactly: Harlow Point keeps one key to its lamp-room, the keeper keeps it on his belt, and that keeper is Brandt; no other hand could touch that lamp. Treat it as a seal on one door only. What it seals is custody at Harlow Point, not the Mara's bearing, not her tower, and not the light she steered by.
  — move: analogia → m_key (restore)
**Learner:** The board holds custody — one key, one keeper — but the chain wants four more links before it closes: the Mara's logged bearing, that Harlow Point stands on that bearing, that the lamp there burned that night, and that Brandt was at the tower to light it. Not one of those four is yet in evidence. I will not let the key on Brandt's belt do the work of the chart, the log, and the watch-book together.
  — hypothesis: Harlow Point may stand on the Mara's logged bearing — if chart or survey evidence confirms towerOnBearing, and if lampBurnedAt and atTowerThatNight are then established, Rule 1 through Rule 4 close and the answer is Brandt — but none of those three facts are yet on the table.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 4, justified 0, drift 1; arc on_arc
  ⚑ **repair** — m_key restored by the tutor

### Turn 6
*[Brandt's log is produced under the clerk's hand, its ruled pages opened for the room: Brandt's log has him at his post the night entire, and the dawn relief found him there: wood dry, glass polished, log ruled and signed to the hour.]*
  — *releases `m_post`*
**Tutor:** That log, if credited, puts Brandt at Harlow Point through the night; it does not put the Mara on Harlow Point's bearing. Shown: custody of that lamp-room; shown: presence at that station; and the steering conjunct — shown, or still wanting? Read the gap before you read the man.
  — move: anaphora → m_post (consolidate)
**Learner:** Presence at the station is now grounded — Brandt at Harlow Point the night entire, log signed to the hour. That fills the third slot of Rule Three, alongside the key already on the board; but Rule Three still waits on the lamp's burning, and Rules One and Two wait on the Mara's bearing and the tower that stands on it. Two links still open: did the lamp burn, and does the chart put Harlow Point on the Mara's course?
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: If lampBurnedAt harlowPoint wreckNight is established, Rule 3 fires (onlyKeyTo + atTowerThatNight already grounded): litLampOf brandt harlowPoint follows. Then if loggedBearingOf mara and towerOnBearing harlowPoint are also shown, Rules 1–2 yield steeredByLampOf, and Rule 4 closes to steeredByLightOf mara brandt — but all three facts are still wanting.

### Turn 7
*[A thin rain begins to tick against the windows, and the clerk leaves the open log where all can see it. The room grows quieter around the untouched seals and the unanswered line on the chart.]*
**Tutor:** Lay the rule on the Trinity chart from the mid-channel buoy: sou'-sou'-west a half west crosses one tower and one only on this coast, the old South Stack, struck off the light-list six years since. A chart is the court's coastline under oath; if that line names South Stack, what becomes of Harlow Point as the tower in Rule 1?
  — move: exemplum → p_chart (release), releases `p_chart`
**Learner:** The chart overturns my standing conjecture entire: sou'-sou'-west a half west carries the rule to South Stack and South Stack alone — a tower dark and off the light-list these six years, not Harlow Point. If the Mara's bearing is confirmed as sswHalfWest, Rule One names South Stack, and every link I had building toward Brandt breaks at its first joint. Two wants remain before I can go further: the Mara's logged bearing must be formally in evidence, and if it does name that bearing, someone must have lit a lamp in a tower that had no business burning. Brandt's key and his night at Harlow Point may be evidence of nothing that matters here.
  — adopts `towerOnBearing sswHalfWest southStack` · hypothesis: If the Mara's logged bearing was sswHalfWest, the tower she steered toward was South Stack (off the light-list six years, not Harlow Point); the chain to Brandt via Rules 1–4 is broken at towerOnBearing, and the true question becomes who lit a lamp in a dead and unlisted tower that night.
  ⚑ **decay** — m_key slips from the learner's board

### Turn 8
*[The harbourmaster's storm-order is set before the court in its book: Harlow Point to shutter at the dusk gun, the channel closed to all sail. The inspector found the shutter drawn and the Board's seal on it unbroken at first light.]*
  — *releases `m_shutter`*
**Tutor:** Shown: Brandt's key at Harlow Point; shown: Brandt at Harlow Point; shown now: Harlow Point shuttered at dusk, seal unbroken at first light. If the lamp-room is sealed dark, what does that do to the charge you were building from custody and presence? Keep the bearing-line in view while you answer.
  — move: anaphora → m_shutter (consolidate)
**Learner:** The sealed shutter cuts the last thread to Brandt entire: no lamp burned at Harlow Point that night, so Rule Three cannot fire — his key and his long vigil prove nothing toward the Mara. The bearing-line ran to South Stack before this, and now Harlow Point is confirmed dark besides; that is two independent failures, not one. The true question has shifted to South Stack — a tower off the list, with no keeper on record, whose lamp someone must have lit if the Mara steered by it. I have no ground on any of those three wants for South Stack: no burning, no key, no presence.
  — adopts `shutteredOn harlowPoint wreckNight` · hypothesis: If the Mara steered by a lamp at South Stack (struck from the light-list six years since), some unknown hand held access to that tower, was present that night, and lit its lamp; but lampBurnedAt, onlyKeyTo, and atTowerThatNight for South Stack are all still wanting — and the Mara's logged bearing of sswHalfWest is not yet formally in evidence either.

## Act 3 (turns 9–12) — declared by the director
*[The dismissed charge leaves no triumph in the room, only a hollow place where certainty had stood. The next act opens under a closer air: boards, dust, and the court's appetite for physical traces, with every eye turned from accusation to proof of a hand.]*

### Turn 9
*[The dismissed charge leaves no triumph in the room, only a hollow place where certainty had stood. The next act opens under a closer air: boards, dust, and the court's appetite for physical traces, with every eye turned from accusation to proof of a hand.]*
  — *declares the movement: **Act 3** ([The dismissed charge leaves no triumph in the room, only a hollow place where certainty had stood. The next act opens under a closer air: boards, dust, and the court's appetite for physical traces, with every eye turned from accusation to proof of a hand.])*
  — *calls the act closed*
**Tutor:** The charge has fallen; do not let its fall become a finding. From your own board, before we touch dust or wick, what did the bearing-line leave standing, and what physical wants now stand between that tower and any hand?
  — move: erotema → p_chart (confront)
**Learner:** The bearing-line leaves South Stack standing as the only tower on sswHalfWest, and Harlow Point shuttered — dark, steering no one that night. Four physical wants remain before South Stack can close the chain: the Mara's logged bearing formally in evidence, a lamp burning at South Stack on wreck night, a key to its lamp-room, and a hand holding that key who stood there. Brandt held the key to Harlow Point, not to a decommissioned tower six years off the light-list — that thread is cut. The board wants dust, wick, and access records from the unlisted tower, not the listed one.
  — hypothesis: The Mara steered by a lamp lit at South Stack (struck from the light-list six years since); the hand that held access to that tower, was present that night, and lit its lamp is still unnamed and entirely ungrounded — lampBurnedAt, onlyKeyTo, and atTowerThatNight for South Stack all remain wanting.
  ⚑ **act_end** — act 2 closed (director) after 4 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 5, justified 1, drift 0; arc on_arc

### Turn 10
*[A clerk gathers the fallen papers of the old charge and leaves a bare space on the table where the next exhibit might lie. Outside the windows the weather presses close, and the room waits on the scrape of wood, metal, or glass rather than another accusation.]*
**Tutor:** If South Stack is where your board now leaves the inquiry, do not spend a thought on a hand yet. What physical trace would let the court say that lamp itself burned on wreck night?
  — move: erotema → — (test)
**Learner:** To say the lamp itself burned, the court wants physical traces from the lantern-room at South Stack: a charred or freshly-trimmed wick, oil drawn down from a full measure, soot on the lens-glass, or the remnant of a struck light. Any one of those, examined and sworn to by an officer of the court who visited the tower after the wreck, would ground lampBurnedAt southStack wreckNight. Without that inspection, steeredForLight alone cannot carry the fact — a vessel steering for a light is not proof the light was legitimate or even that it stood in a tower. The board waits on the lantern itself.
  — hypothesis: The Mara steered by a lamp lit at South Stack (struck from the light-list six years since); lampBurnedAt southStack wreckNight could be grounded by physical inspection of the lantern-room (wick, oil, soot), but no such exhibit is yet before the court — and until it is, the chain cannot advance past towerOnBearing sswHalfWest southStack.

### Turn 11
*[The room narrows around the empty place on the table, its silence no longer easy enough for accusation. A clerk trims nothing, touches nothing, and the waiting itself becomes a kind of pressure.]*
**Tutor:** Keep the lantern in the witness-box and the culprit outside it. A burn-trace would open only the tower-to-lamp rule. Key and presence remain separate locks, unopened.
  — move: analogia → — (consolidate)
  — *the second voice [figure rut]: "Leave off erotema for this turn; recast the move without another question." (draft erotema → analogia)*
**Learner:** Three locks, then — not one. A burn-trace opens the lamp rule only; key and presence are separate bolts, and the court must hear each turned in turn. My board holds nothing that touches key or presence at South Stack, so I cannot advance even if the lantern-room yields soot tonight. The chain stalls at towerOnBearing and will not move until all three exhibits are laid.
  — hypothesis: The Mara steered by a lamp lit at South Stack (struck from the light-list six years since); lampBurnedAt, onlyKeyTo, and atTowerThatNight for South Stack are three separate locks, each wanting its own exhibit — physical inspection for the first, access records for the second, and a witness or log placing a named hand at the tower for the third.

### Turn 12
*[The bench does not reach for a new paper; it lets the last word settle against the sealed gaps. Rain ticks at the panes, and the unlit exhibits seem to weigh more heavily for not yet being opened.]*
**Tutor:** Hold there, clerk: your last line has shifted the chart from the board to the empty table. Read back the chart exhibit from your own hand, and tell the court what Rule 1 already did or did not fix before we touch wick, key, or presence.
  — move: erotema → p_chart (confront)
**Learner:** The chart gave me one leg of Rule 1 only: towerOnBearing sswHalfWest southStack sits on my board at index 5. But Rule 1 demands loggedBearingOf mara sswHalfWest as well, and that fact is nowhere on my board — steeredForLight is not loggedBearingOf. So Rule 1 has not fired: the board cannot yet derive steeredToward mara southStack, and the chain stalls before we even reach wick or key. I spoke too freely about South Stack as destination — until the log or a navigator's witness grounds that bearing, it is hypothesis, not fact.
  — hypothesis: The Mara's logged bearing was sswHalfWest; if grounded by the ship's log or a navigator's sworn testimony, Rule 1 would yield steeredToward mara southStack and the chain could advance to lampBurnedAt, onlyKeyTo, and atTowerThatNight for South Stack.
  ⚑ **disengagement** — no progress over 6 turns
  ⚑ **plot_audit** — act 3 plot audited at run end: kept 5, justified 1, drift 0; arc on_arc; throughline reckoned (7 clauses)

## Instrument panel (programmatic eval — no judge)

- **verdict** `disengagement` · 12/26 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0.083 D/turn overall (D 5→4 over 12 turns)
  - Act 1 (turns 1–4): 0.25 D/turn (ΔD 1)
  - Act 2 (turns 5–8): 0 D/turn (ΔD 0)
  - Act 3 (turns 9–12): 0 D/turn (ΔD 0)
- **plateau** longest flat stretch 5 turns (aporia window 6)
- **releases** 3/8 on cue · 2 deviated
- **decay** 3 slips (seed 1 · rate 0.75 · grace 1) · repaired 1 (tutor 1, re-adoption 0) · mean repair latency 2 turns · unrepaired at end 2 · degraded-turn integral 15 · D reversals 1
- **theory fidelity** F 0.778 at end · min 0.778
  - m_key t3→t5 (tutor) · p_bearing t4 (never repaired) · m_key t7 (never repaired)
- **events** plot×3 · throughline×1 · decay×3 · act_end×2 · plot_audit×3 · repair×1 · disengagement×1
- **staging** 3 movements declared by the director
- **acts** 3 played · closed by the director 2 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–8 (director) · Act 3 t9–12 (run end)
- **plot** 3 committed · withhold+friction on 3/3 · 5.67 clauses avg · audits 3 (incl. final act): kept 14 / justified 2 / drift 1 · hold-named exhibits staged in act 0/2
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 3: on 3 / off 0 · run-end reckoning 7 clauses: kept 5 / justified 2 / drift 0
- **release authority** 2 played: 0 on schedule · 0 held · 2 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_bearing -1 (t3): "The clerk has twice identified the bearing as the missing first conjunct, so the paper is ripe one turn early."
  - p_chart -2 (t7): "The clerk is asking for the chart conjunct now, and playing it early prevents Harlow custody from hardening into the wrong tower."
- **confrontation** 3 demanded (1 against a slipped exhibit) · re-entries 0: covered 0, uncovered 0 · watcher fires 1 (became the confrontation 1) · fires without recorded due 0
  - **repair clause** restores 1 (1 repaired a real slip) · watcher fires on restore claims 0: m_key t5
- **figures** erotema 5/12 (42%) · 4 distinct · switch rate 0.82
- **superego** intervened 2/12 watched turns · figure changed within-turn on 2/2 interventions · switch on intervention 1.00 vs elsewhere 0.78

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 12 | 2.92 | 3 | 40.1 |
| tutor | 12 | 2.33 | 3 | 45.7 |
| learner | 12 | 3.67 | 4 | 86.4 |
