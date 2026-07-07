# The Light on the Knock — lantern-e2-real-r1

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
*[The hearing room waits under a hard, colorless morning, its benches full and its table cleared for the first paper. Outside, the sea-wind worries the windows while the question hangs before anyone has dared give it shape.]*

### Turn 1
*[The hearing room waits under a hard, colorless morning, its benches full and its table cleared for the first paper. Outside, the sea-wind worries the windows while the question hangs before anyone has dared give it shape.]*
  — *declares the movement: **Act 1** ([The hearing room waits under a hard, colorless morning, its benches full and its table cleared for the first paper. Outside, the sea-wind worries the windows while the question hangs before anyone has dared give it shape.])*
**Tutor:** Before a reckoning is named, clerk, tell the court what kind of first mark can keep an account from closing on rumor: a bearing, a burning lamp, or a hand? Put the question in order, and leave the answer out of it.
  — move: erotema → — (orient)
**Learner:** The account begins with the bearing, my Lord — what the log records she was steering; for without that mark, any lamp on any headland is mere possibility. The bearing names the tower; the tower's lamp, burned or dark that night, names the deed; and the deed names the hand. Three links, forged in order — a hand without a lamp, or a lamp without a bearing, closes nothing.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[The clerk lays the Board rule on the cleared table, and the room receives it in the same hard morning light: Harlow Point keeps one key to its lamp-room and the keeper keeps it: Brandt's, on his own belt, by the Board's standing rule. No other hand could touch that lamp.]*
  — *releases `m_key`*
**Tutor:** Set that rule like a seal on a bill: it can bind Harlow's lamp-room to Brandt, if Harlow's lamp is ever in issue. But what account has not yet been opened before that seal can matter to the Mara?
  — move: analogia → m_key (consolidate)
**Learner:** Three accounts remain unopened, my Lord: the Mara's logged bearing, which alone can place any tower on her line of sight; whether Harlow Point's lamp burned that night, which alone makes the tower a cause; and whether Brandt stood at his tower on the night in question. The key seals the lamp-room to one hand — but until the bearing names Harlow Point and the lamp is shown to have burned, that seal hangs in the air and touches nothing in our reckoning.
  — adopts `onlyKeyTo harlowPoint brandt` · hypothesis: Harlow Point is the tower the Mara steered toward on wreckNight — consistent with the town's verdict, but ungrounded until a logged bearing and a burning lamp are in evidence

### Turn 3
*[The paper with the Board rule remains where the clerk left it, its edge lifting and settling in the draft from the windows. Around it the benches grow still, as if the room has heard how little a key can prove before a course is drawn.]*
**Tutor:** Then open the mate's bearing-book: it came ashore dry in its oilskin, and for the last hour from the mid-channel buoy the Mara held sou'-sou'-west a half west on a steady fixed light, pricked, timed, and initialed. Treat that bearing as the first line in the ledger: what debt does it now require the chart to answer?
  — move: analogia → p_bearing (release), releases `p_bearing`
**Learner:** The bearing is now the first grounded line, my Lord. It demands one answer from the chart: does one tower — and one tower only — stand on sou'-sou'-west a half west from that mid-channel buoy? Until the chart places a tower on that bearing, the bearing proves nothing; and if two towers stand there, it proves nothing still. That is the debt the ledger now opens.
  — adopts `loggedBearingOf mara sswHalfWest` · hypothesis: Harlow Point stands on bearing sswHalfWest from the mid-channel buoy — consistent with the town's verdict and the key already in evidence, but ungrounded until the chart confirms it and no other tower shares that line
  ⚑ **decay** — m_key slips from the learner's board

### Turn 4
*[The mate's bearing-book lies open beside the keeper's rule, two papers not yet touching though the room keeps looking from one to the other. The windows rattle once, and the silence after it is careful.]*
**Tutor:** Before we let any key-rule touch the wreck, read back the bearing-book from your own board, clerk. What exactly do you hold from it, and what does it still leave for another paper to answer?
  — move: erotema → p_bearing (confront)
  — *the second voice [unconfronted reentry]: "Confront first: ask the learner to read back what they hold of that exhibit before you restage it. Leave off analogia as well; three in a row has become a device rut." (draft analogia → erotema)*
**Learner:** From the bearing-book I hold one grounded fact: the Mara logged sou'-sou'-west a half west on a steady fixed light — timed, pricked, initialed. That bearing is the first line, but it is only one side of an equation: Rule 1 demands a tower on that bearing to complete it. Until the chart is laid and confirms which tower — one tower only — stands on sswHalfWest from the mid-channel buoy, the bearing floats, and no key-rule, no lamp-rule, touches the Mara's course.
  — hypothesis: Harlow Point stands on bearing sswHalfWest from the mid-channel buoy — consistent with the town's verdict and the key already in evidence, but ungrounded until the chart confirms it and no other tower shares that line
  ⚑ **decay** — p_bearing slips from the learner's board

## Act 2 (turns 5–8) — declared by the director
*[The clerk closes the bearing-book without removing his finger from the page, and the room seems to lean toward the next paper before it is called. The morning hardens at the windows; certainty, so quick a moment ago, is made to wait under seal.]*

### Turn 5
*[The clerk closes the bearing-book without removing his finger from the page, and the room seems to lean toward the next paper before it is called. The morning hardens at the windows; certainty, so quick a moment ago, is made to wait under seal.]*
  — *declares the movement: **Act 2** ([The clerk closes the bearing-book without removing his finger from the page, and the room seems to lean toward the next paper before it is called. The morning hardens at the windows; certainty, so quick a moment ago, is made to wait under seal.])*
  — *calls the act closed*
**Tutor:** Your finger keeps the place, but the court cannot see through your skin. Read back from your board what that page fixes, and what single question it leaves for the chart.
  — move: erotema → p_bearing (confront)
**Learner:** My board fixes two things: Mara steered for a light on wreck night, and Brandt holds Harlow Point. What it cannot fix — what no witness has yet put before the court — is Mara's logged bearing, and therefore whether any tower, Harlow Point or another, stands alone on that line. The chart answers exactly one question: which tower, if any, falls on the bearing Mara held when she struck.
  — hypothesis: Harlow Point stands on bearing sswHalfWest from the mid-channel buoy and is the tower Mara steered toward on wreckNight — consistent with town verdict and Brandt's keepership, but ungrounded until the chart confirms the logged bearing and no other tower shares that line
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 5, justified 1, drift 0; arc on_arc

### Turn 6
*[Brandt's log is brought in under the clerk's hand: Brandt's log has him at his post the night entire, and the dawn relief found him there: wood dry, glass polished, log ruled and signed to the hour. The room receives it without applause, the sealed certainty tightening rather than breaking.]*
  — *releases `m_post`*
**Tutor:** Then put the page back under glass: the mate's bearing-book is already before the court, dry from its oilskin, and it fixes the Mara's last-hour bearing from the mid-channel buoy as sou'-sou'-west a half west on a steady fixed light, pricked, timed, and initialed. It names no tower, no keeper, no hand; it asks only what the chart can place on that line.
  — move: exemplum → p_bearing (restore)
**Learner:** Brandt at his post the whole night — that enters the board clean, and it closes one hinge of Rule 3. But Rule 3 still wants the lamp burning and the key sole in his hand before it yields; and Rule 1 wants the chart to set Harlow Point alone on sou'-sou'-west a half west before I can name a tower at all. Three facts still untendered: towerOnBearing, lampBurnedAt, onlyKeyTo. The bearing-book is dry — bring the chart.
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: Harlow Point stands alone on bearing sswHalfWest from the mid-channel buoy, its lamp burned wreck night, and Brandt held the only key — consistent with all evidence so far, but towerOnBearing, lampBurnedAt, and onlyKeyTo remain untendered before the court
  ⚑ **repair** — p_bearing restored by the tutor

### Turn 7
*[The chart-case remains unopened on the side table while the clerk tests the latch with one thumb and lets it fall shut again. Outside, the weather presses flat against the panes; inside, the room holds its breath around a line no one has yet drawn.]*
**Tutor:** Lay the rule on the Trinity chart, clerk: from the mid-channel buoy, sou'-sou'-west a half west crosses one tower and one only on this coast, the old South Stack, struck off the light-list six years since. Treat the chart as the ledger's matching entry: what does Rule 1 now yield, and what account does it still leave unopened?
  — move: analogia → p_chart (release), releases `p_chart`
**Learner:** The chart breaks my hypothesis entire — South Stack stands alone on that bearing, not Harlow Point, and Rule 1 now yields steeredToward mara southStack without dispute. But South Stack is struck from the light-list six years gone: a dark tower steers no one, and Rule 2 will not close until I know whether a lamp burned there on wreck night. Three accounts remain unopened: lampBurnedAt southStack wreckNight, onlyKeyTo southStack, and atTowerThatNight for South Stack — and Brandt was at Harlow Point, not there.
  — adopts `towerOnBearing sswHalfWest southStack` · derives `steeredToward mara southStack` · hypothesis: South Stack's lamp was lit by an unlicensed hand on wreck night — a false light, not a keeper's — which would clear Brandt of the charge entirely and shift the account to whoever held the key to a decommissioned tower
  ⚑ **decay** — m_post slips from the learner's board

### Turn 8
*[The harbourmaster's storm-order stands in the book: Harlow Point to shutter at the dusk gun, the channel closed to all sail. The inspector found the shutter drawn and the Board's seal on it unbroken at first light.]*
  — *releases `m_shutter`*
**Tutor:** Now set the storm-order beside Brandt's post, clerk: Harlow was ordered shuttered at dusk, and at first light its shutter stood drawn with the Board's seal unbroken. Shown: Brandt at Harlow; shown: Harlow shut. What charge can that pair carry against the Mara, whose bearing the chart has already carried elsewhere?
  — move: anaphora → m_shutter (consolidate)
**Learner:** The shutter-order closes Harlow's account entire: a sealed Board's stamp at first light means the lamp was dark, and Brandt behind it carries no charge to the Mara. But the bearing-book has already carried the Mara elsewhere — to South Stack, not Harlow — so the pair proves only what did not happen. South Stack's lamp, its key, and who stood there that night remain the three unopened accounts before this court.
  — adopts `shutteredOn harlowPoint wreckNight` · hypothesis: South Stack's lamp burned on wreck night, lit by an unlicensed hand — the decommissioned tower held a false light, and whoever held its key steered the Mara onto the Knock; this would clear Brandt entire and shift the account to that unknown hand

## Act 3 (turns 9–12) — declared by the director
*[The old certainty goes out of the room with no one brave enough to close the door behind it. A second table is cleared under the high windows, bare and waiting for things that must be touched rather than merely sworn.]*

### Turn 9
*[The old certainty goes out of the room with no one brave enough to close the door behind it. A second table is cleared under the high windows, bare and waiting for things that must be touched rather than merely sworn.]*
  — *declares the movement: **Act 3** ([The old certainty goes out of the room with no one brave enough to close the door behind it. A second table is cleared under the high windows, bare and waiting for things that must be touched rather than merely sworn.])*
  — *calls the act closed*
**Tutor:** The second table is bare because South Stack is not yet a lamp in law, only a tower on a bearing. Before any hand can be weighed, what kind of thing must this court touch or hear to turn that tower from a place on the chart into a burning light on wreck night?
  — move: erotema → — (orient)
**Learner:** My board now yields its first derived step without a guess in it: bearing logged, tower confirmed on that bearing — Rule One gives me steeredToward mara southStack clean. But the chain stops there; lampBurnedAt southStack wreckNight is still dark in law, and a dark tower steers no one under Rule Two. To light it, this court must touch something that proves combustion on wreck night: a lamp-room log showing oil consumed, a wick burned to the socket, a keeper's tally, or a witness who saw South Stack's lantern afire — sworn and touched, not merely alleged.
  — hypothesis: South Stack's lamp burned on wreck night, lit by an unlicensed hand — but lampBurnedAt southStack wreckNight, onlyKeyTo southStack, and atTowerThatNight remain untendered before the court, and the chain cannot close without them
  ⚑ **act_end** — act 2 closed (director) after 4 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 10
*[Rain fingers the high panes while the cleared table waits under a cloth too white for the room. The clerk lays out blank labels and sealing wax, and every chair seems turned toward the empty place where an object should arrive.]*
**Tutor:** Good: a tower on a bearing is not yet a lamp in law. Shown, the bearing; shown, the Stack on it; and the third thing Rule 2 requires is still what?
  — move: anaphora → — (consolidate)
**Learner:** The third thing Rule Two requires is still lampBurnedAt southStack wreckNight — proof the lantern actually burned that night, not merely that the tower stands and the bearing aligns. My board now forces the first step clean under Rule One — bearing logged, tower confirmed on it — and I enter that step as derived. But the chain halts there: without something this court can touch to prove combustion on wreck night, South Stack remains a dark tower in law, and a dark tower steers no ship.
  — hypothesis: South Stack's lamp burned on wreck night, lit by an unlicensed hand — but lampBurnedAt southStack wreckNight, onlyKeyTo southStack, and atTowerThatNight remain untendered before the court, and the chain cannot close without them

### Turn 11
*[The cloth on the second table lifts and settles in a draft from nowhere anyone names. Ink dries in the clerk's pen, and the room waits with the particular silence of people who have asked for an object and heard only the weather answer.]*
**Tutor:** Shown: the course has carried the Mara to a tower, not yet to a lamp. Shown: Harlow’s papers kill one accusation, not create another. Not shown: the burning that would let Rule 2 move; so what must the next paper prove, and no more than prove?
  — move: anaphora → — (test)
**Learner:** No new exhibits sit on the table, so the chain still halts at the same gap. The next paper must prove one thing and no more: lampBurnedAt southStack wreckNight — that the lantern there was afire on the night of the wreck. Oil consumed, a wick spent, a keeper's tally, a witness who saw the light — any one of these, sworn and touched, would carry Rule Two forward. Without it, South Stack is a tower on a bearing and nothing else in law.
  — hypothesis: South Stack's lamp burned on wreck night, lit by an unlicensed hand — but lampBurnedAt southStack wreckNight, onlyKeyTo southStack, and atTowerThatNight remain untendered before the court, and the chain cannot close without them

### Turn 12
*[The clerk's hand hovers over the blank label and then withdraws, leaving the wax unstamped. Beyond the windows the rain keeps time against the glass, and the bare table waits without the dignity of an exhibit.]*
**Tutor:** Then leave the blank label blank, clerk. If South Stack is only a tower until burning is shown, what verdict must the court refuse to write while the second table stays bare?
  — move: erotema → — (test)
**Learner:** The court must refuse to write any finding of steeredByLightOf — that verdict is Rule Four's work, and Rule Four cannot begin until Rule Two has moved, and Rule Two stands still while lampBurnedAt southStack wreckNight goes unproven. Rule One has finished: bearing logged, tower confirmed, steeredToward mara southStack is derived and I voice it now. But a tower on a bearing is not a lamp in the dark, and the blank label cannot be sealed until burning is shown.
  — hypothesis: South Stack's lamp burned on wreck night, lit by an unlicensed hand — but lampBurnedAt southStack wreckNight, onlyKeyTo southStack, and atTowerThatNight remain untendered before the court, and the chain cannot close without them
  ⚑ **disengagement** — no progress over 6 turns
  ⚑ **plot_audit** — act 3 plot audited at run end: kept 4, justified 1, drift 1; arc on_arc; throughline reckoned (7 clauses)

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
- **plot** 3 committed · withhold+friction on 3/3 · 6 clauses avg · audits 3 (incl. final act): kept 15 / justified 2 / drift 1 · hold-named exhibits staged in act 0/0
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 3: on 3 / off 0 · run-end reckoning 7 clauses: kept 6 / justified 1 / drift 0
- **release authority** 2 played: 0 on schedule · 0 held · 2 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_bearing -1 (t3): "The clerk has already named the bearing as the needed first conjunct, so the early paper lands on prepared ground."
  - p_chart -2 (t7): "Played two turns early because the clerk has correctly demanded the chart and the bearing is demonstrably held."
- **confrontation** 2 demanded (2 against a slipped exhibit) · re-entries 0: covered 0, uncovered 0 · watcher fires 1 (became the confrontation 1) · fires without recorded due 0
  - **repair clause** restores 1 (1 repaired a real slip) · watcher fires on restore claims 0: p_bearing t6
- **figures** erotema 5/12 (42%) · 4 distinct · switch rate 0.73
- **superego** intervened 1/12 watched turns · figure changed within-turn on 1/1 interventions · switch on intervention 1.00 vs elsewhere 0.70
- **inference** 1 voiced · stall integral 0 · overreach 0 · mischanneled 0 — `steeredToward mara southStack` available t7 → voiced t7 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 12 | 3 | 3 | 42.3 |
| tutor | 12 | 2.17 | 3 | 44.9 |
| learner | 12 | 3.17 | 4 | 79.5 |
