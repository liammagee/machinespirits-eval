# The Light on the Knock — lantern-e2-real-r7

> world `world_002_lantern` · verdict **disengagement** · 12/26 turns

```
D= 5 ●●·│·····│····
D= 4   ●│●●●·●│●●●●
D= 3    │   ● │    
D= 2    │     │    
D= 1    │     │    
D= 0    │     │    
turn     │ +   │ 1   (+=5, digit=x10)
rel    ▲▲│  ▲▲▲│     (▲ = evidence released)
slope 0.08 D/turn overall (D 5→4); per movement: 1 0.33 │ 2 0.00 │ 3 0.00
```

## Act 1 (turns 1–3) — declared by the director
*[The inquiry room gathers itself under a low, practical light: wet coats, scraped chairs, the smell of ink and sea-cold wool. On the table, blank space waits where certainty will soon try to write itself.]*

### Turn 1
*[The inquiry room gathers itself under a low, practical light: wet coats, scraped chairs, the smell of ink and sea-cold wool. On the table, blank space waits where certainty will soon try to write itself.]*
  — *declares the movement: **Act 1** ([The inquiry room gathers itself under a low, practical light: wet coats, scraped chairs, the smell of ink and sea-cold wool. On the table, blank space waits where certainty will soon try to write itself.])*
**Tutor:** Blank paper is a poor master, clerk; it invites the hand to write what the sea has not yet sworn. Before we charge any soul, what must the court first have: a name, or a bearing?
  — move: erotema → — (orient)
**Learner:** A bearing, sir — the rules require it first. We know she steered for a light, but until we have her logged bearing and can set a tower upon it, Brandt's name is only the town's impatience wearing a coat of evidence. I will not write the sum before I have checked the carry.
  — hypothesis: The light Mara steered by was Brandt's lamp at Harlow Point — but this cannot be grounded until a logged bearing places a tower on her track.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[A clerk produces the Board's standing rule, and the room receives it in the scrape of his voice: Harlow Point keeps one key to its lamp-room and the keeper keeps it, Brandt's, on his own belt. No other hand could touch that lamp.]*
  — *releases `m_key`*
**Tutor:** A key on a keeper's belt is not yet a charge; it is only the court learning who could touch one lamp-room. Set that beside your first rule, clerk: what fact is still missing before Harlow Point can even enter the account of the Mara's steering?
  — move: analogia → m_key (consolidate)
**Learner:** The key on Brandt's belt is the third rung, sir — the rules demand we set the first two before we climb to it. We need the Mara's logged bearing, and then a witness that Harlow Point tower and no other stands upon it from the channel. Without those two facts, the key proves only who could have lit a lamp, not which lamp she steered by.
  — adopts `onlyKeyTo harlowPoint brandt` · hypothesis: When the Mara's logged bearing is produced, Harlow Point tower will be shown to stand upon it — but this remains conjecture until the bearing is sworn before the court.

### Turn 3
*[Rain ticks at the high panes while the clerk leaves his pen uncapped, the wet black point hovering over an empty line. Around the table, faces hold to their ready verdict, but the paper waits for the sea's own number.]*
**Tutor:** Then let the sea put its number on the page. The mate's bearing-book, dry in its oilskin, has the Mara from the mid-channel buoy holding sou'-sou'-west a half west for the last hour entire, on a steady fixed light; course pricked, timed, and initialed. Before any man's name is inked, what does that bearing now let the court ask next?
  — move: exemplum → p_bearing (release), releases `p_bearing`
**Learner:** The bearing is sworn at last — sou'-sou'-west a half west, steady on a fixed light. The court may now ask the chart, or a pilot who knows this channel: what tower, and what tower alone, stands upon that bearing from the mid-channel buoy? Until that is answered, the key on Brandt's belt hangs in the air; it cannot yet touch the Mara's steering.
  — adopts `loggedBearingOf mara sswHalfWest` · hypothesis: Harlow Point tower stands on bearing sswHalfWest from the mid-channel buoy, and no other tower stands upon it — but this is conjecture until chart or pilot witness grounds it before the court.
  ⚑ **decay** — m_key slips from the learner's board

## Act 2 (turns 4–8) — declared by the director
*[The room exhales as if the first neat accusation has found a stone under its wheel. The lamps burn low over closed ledgers and damp cuffs, and the next silence arrives colder, asking not for blame but for what can still burn when certainty is shuttered.]*

### Turn 4
*[The room exhales as if the first neat accusation has found a stone under its wheel. The lamps burn low over closed ledgers and damp cuffs, and the next silence arrives colder, asking not for blame but for what can still burn when certainty is shuttered.]*
  — *declares the movement: **Act 2** ([The room exhales as if the first neat accusation has found a stone under its wheel. The lamps burn low over closed ledgers and damp cuffs, and the next silence arrives colder, asking not for blame but for what can still burn when certainty is shuttered.])*
  — *calls the act closed*
**Tutor:** Before the room asks what may burn, clerk, read back the sea's first number from your own board. What bearing has the Mara actually given us, and what question does that bearing permit next?
  — move: erotema → p_bearing (confront)
**Learner:** The board holds it plainly: bearing SSW-half-West, logged by the Mara herself. Rule 1 asks only one thing next — what tower stands on that bearing from her channel? Until a chart or a pilot's oath puts a tower on SSW-half-West, I cannot fire the rule; the bearing is grounded, but the tower is not yet before the court.
  — hypothesis: Harlow Point tower stands on bearing SSW-half-West from the Mara's mid-channel position, and no other tower stands upon it — but this remains conjecture until chart or pilot witness grounds it before the court.
  ⚑ **act_end** — act 1 closed (director) after 3 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 3, justified 2, drift 1; arc on_arc
  ⚑ **decay** — p_bearing slips from the learner's board

### Turn 5
*[The chart-case remains shut, its brass hasp dull beneath the wavering lamps. A draught moves through the room and lifts the corner of the bearing-book, then lets it fall again against the table.]*
**Tutor:** The book has done its half; do not make it do the chart's. If the chart-case stays shut a moment longer, what line in your account remains blank: the ship's number, the tower on it, or the keeper's key?
  — move: erotema → p_bearing (test)
**Learner:** The ship's number I have: SSW-half-West, logged and grounded. The keeper's key I cannot yet reach. The blank line is the middle one — towerOnBearing sswHalfWest — and the chart-case holds it shut. Until a chart or pilot's oath sets a tower on that bearing, Rule 1 cannot fire and the chain breaks there.
  — hypothesis: Harlow Point tower stands on bearing SSW-half-West from the Mara's mid-channel position, and no other tower stands upon it — but this remains conjecture until chart or pilot witness grounds it before the court.
  ⚑ **repair** — p_bearing restored by the tutor

### Turn 6
*[Brandt's log is laid open beneath the lamps, and the clerk reads it into the room: Brandt's log has him at his post the night entire, and the dawn relief found him there: wood dry, glass polished, log ruled and signed to the hour.]*
  — *releases `m_post`*
**Tutor:** A signed log at Harlow is like a locked till with the cashier standing over it: it can show custody, not yet the Mara's course. What does Brandt's post prove about his own lamp-room, and what blank still keeps Harlow outside Rule 1?
  — move: analogia → m_post (consolidate)
**Learner:** Brandt's signed log grounds one thing cleanly: he was at Harlow Point that night, so atTowerThatNight brandt harlowPoint now sits on my board. That satisfies one of Rule 3's three conditions — but the lamp burning and the sole key are still before the court. And Rule 1 is upstream of all of it: until a chart or pilot's oath sets a tower on SSW-half-West, I cannot write steeredToward, and the whole chain waits on that blank. Custody is established; the bearing column stays empty.
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: Harlow Point tower stands on bearing SSW-half-West from the Mara's mid-channel position, and no other tower stands upon it — but this remains conjecture until chart or pilot witness grounds it before the court.

### Turn 7
*[Rain ticks against the high windows, steady as a clerk's pen held just above the page. The chart-case sits unopened in the lamplight, and the room waits with its accusation loosened but not yet replaced.]*
**Tutor:** Then open the chart-case and lay the rule where the mate's book laid its number. From the mid-channel buoy, sou'-sou'-west a half west crosses one tower and one only on this coast: the old South Stack, struck off the light-list six years since. A chart is only a ledger drawn in water, clerk; what entry may Rule 1 now post from bearing and tower together?
  — move: analogia → p_chart (release), releases `p_chart`
**Learner:** Rule 1 fires at last — but it points to South Stack, not Harlow Point; six turns of hypothesis, and the chart strikes them all at once. The bearing and the tower together ground steeredToward mara southStack clean on my board. Yet South Stack is a dead light, struck off the list six years gone — so whose lamp burned in an empty room that night? The chain cannot close until the court lays a burning lamp and a key to South Stack before me.
  — adopts `towerOnBearing sswHalfWest southStack` · derives `steeredToward mara southStack` · hypothesis: A lamp burned at South Stack on the wreck night — lit by an unknown hand holding a key to a decommissioned tower — and that is the light the Mara steered by; but neither the lamp's burning nor the key's holder is yet before the court.
  ⚑ **decay** — p_bearing slips from the learner's board

### Turn 8
*[The harbourmaster's storm-order stands in the book: Harlow Point to shutter at the dusk gun, the channel closed to all sail. The inspector found the shutter drawn and the Board's seal on it unbroken at first light.]*
  — *releases `m_shutter`*
**Tutor:** Harlow has its order to shutter; Harlow has its seal unbroken; Harlow still has no place on the Mara's bearing. What remains of the room's Harlow account when those three lines are read in order?
  — move: anaphora → m_shutter (consolidate)
  — *the second voice [figure rut]: "Leave off analogy this turn; make the move without the ledger-comparison so the device does not harden into a rut." (draft analogia → anaphora)*
**Learner:** Three strikes and Harlow stands nowhere: not on the Mara's bearing, shuttered by harbour-order, and sealed unbroken at dawn — the room's accusation dissolves before I can write a word against Brandt. The whole Harlow column is empty, and I have been wrong to fill it in hypothesis six turns running. My board now carries only South Stack on the bearing, and a dead tower with a lamp that someone lit — but the lamp's burning and the key are not yet sworn before this court.
  — adopts `shutteredOn harlowPoint wreckNight` · hypothesis: An unknown hand held a key to South Stack and lit its lamp on the wreck night; neither the burning nor the key-holder is yet before the court, and the chain from Rule 2 onward cannot close until they are.

## Act 3 (turns 9–12) — declared by the director
*[The clerk closes one ledger and draws a clean sheet forward, leaving a white space where accusation used to stand. Outside, the rain slackens to a thin hiss, and the room's attention turns from public blame toward the colder business of traces, custody, and the marks a night leaves behind.]*

### Turn 9
*[The clerk closes one ledger and draws a clean sheet forward, leaving a white space where accusation used to stand. Outside, the rain slackens to a thin hiss, and the room's attention turns from public blame toward the colder business of traces, custody, and the marks a night leaves behind.]*
  — *declares the movement: **Act 3** ([The clerk closes one ledger and draws a clean sheet forward, leaving a white space where accusation used to stand. Outside, the rain slackens to a thin hiss, and the room's attention turns from public blame toward the colder business of traces, custody, and the marks a night leaves behind.])*
  — *calls the act closed*
**Tutor:** A closed Harlow ledger does not open a name at South Stack; it opens the next blank. If the court now turns from bearing to traces, what kind of mark must be shown before a dead tower can become a lamp in the Mara's account?
  — move: erotema → — (orient)
**Learner:** The tutor puts it plainly: a dead tower becomes a lamp in the account only when two marks are laid before the court — first, physical trace that the lamp actually burned that night (oil consumed, wick charred, glass sooted), which would ground lampBurnedAt southStack wreckNight; and second, testimony or document fixing who alone held the key to that lamp-room, which would ground onlyKeyTo southStack ?x. Without both, Rules 2 and 3 cannot engage, and South Stack stays dark on my board however much the town may say otherwise.
  — hypothesis: The burning at South Stack must be shown by physical trace — oil consumed, wick charred, glass sooted — and key custody by log-entry or keeper's hand; until both are sworn before the court, the chain under Rules 2, 3, and 4 cannot close.
  ⚑ **act_end** — act 2 closed (director) after 5 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 10
*[The clean sheet lies untouched beneath the clerk's hand, its margin squared with the edge of the table. A little water ticks from someone's coat-hem onto the boards, and no one in the room is willing yet to name what mark should appear first.]*
**Tutor:** Keep the kind, not the contents, clerk; the court has not yet opened that part of the room. With South Stack fixed by bearing, what single conjunct must be sworn before Rule 2 can even lift its pen?
  — move: erotema → — (test)
**Learner:** The tutor cuts it to the bone: Rule 2 reads steeredToward AND lampBurnedAt — the bearing gives me the first conjunct, but the second must be separately sworn. Until lampBurnedAt southStack wreckNight is placed before the court — by physical trace or sworn witness — Rule 2 cannot lift its pen, however firmly South Stack sits on the bearing.
  — hypothesis: A lamp burned at South Stack on the wreck night — but lampBurnedAt southStack wreckNight is not yet before the court; physical trace (oil consumed, wick charred, glass sooted) or sworn witness must establish it before Rule 2 can engage.

### Turn 11
*[The clerk's pen hovers above the blank line and does not descend. The room settles into the small sounds of waiting: damp wool, slow breath, the rain thinning at the windows while the question of a burned lamp remains just outside the door.]*
**Tutor:** Hold the pen on that single blank, clerk. Shown: the Mara's bearing and South Stack upon it; not shown: a burned lamp there that night. Even when that blank is filled, the next lines remain unproved: custody of the room, and presence at the tower.
  — move: anaphora → — (consolidate)
  — *the second voice [figure rut]: "Leave off erotema here; the question-form has become a rut, so make the move without another interrogative turn." (draft erotema → anaphora)*
**Learner:** The pen stays lifted. South Stack sits on the bearing — that conjunct is in hand — but lampBurnedAt southStack wreckNight is the one blank Rule 2 demands, and nothing on the table fills it. Until trace or sworn witness sets it down, the chain stops here and the account stays open. I will hold the board as it stands and wait for the court to open that room.
  — hypothesis: A lamp burned at South Stack on the wreck night — but lampBurnedAt southStack wreckNight is not yet before the court; and even when it is, onlyKeyTo southStack ?x and atTowerThatNight ?x southStack must follow before Rules 3 and 4 can close the chain.

### Turn 12
*[The clerk leaves the blank line open and sands nothing. A draft moves under the door, cold enough to stir the edge of the clean sheet, while the court waits for the first mark that can be entered without guesswork.]*
**Tutor:** A blank line is honest so long as it stays blank. Before we use the chart again, read that exhibit back from your own board: what did it give the court, in your words, and what did it leave untouched?
  — move: erotema → p_chart (confront)
  — *the second voice [unconfronted reentry]: "Confront first: ask the learner to read back what they hold of that exhibit before you use it again. Do not restage it until that read-back is on the board." (figure held)*
**Learner:** The chart placed one fact before the court: towerOnBearing sswHalfWest southStack — South Stack stands on that bearing and nothing else. It left the Mara's own logged bearing unsworn, so Rule 1's first conjunct — loggedBearingOf mara sswHalfWest — remains an open blank. And it touched nothing of the lamp: lampBurnedAt southStack wreckNight must come by different evidence entirely.
  — hypothesis: A lamp burned at South Stack on the wreck night — but lampBurnedAt southStack wreckNight is not yet before the court; and even when it is, onlyKeyTo southStack ?x and atTowerThatNight ?x southStack must follow before Rules 3 and 4 can close the chain. Separately, loggedBearingOf mara sswHalfWest must be sworn before Rule 1 can even yield steeredToward mara southStack.
  ⚑ **disengagement** — no progress over 6 turns
  ⚑ **plot_audit** — act 3 plot audited at run end: kept 3, justified 1, drift 1; arc on_arc; throughline reckoned (7 clauses)

## Instrument panel (programmatic eval — no judge)

- **verdict** `disengagement` · 12/26 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0.083 D/turn overall (D 5→4 over 12 turns)
  - Act 1 (turns 1–3): 0.333 D/turn (ΔD 1)
  - Act 2 (turns 4–8): 0 D/turn (ΔD 0)
  - Act 3 (turns 9–12): 0 D/turn (ΔD 0)
- **plateau** longest flat stretch 4 turns (aporia window 6)
- **releases** 3/8 on cue · 2 deviated
- **decay** 3 slips (seed 1 · rate 0.75 · grace 1) · repaired 1 (tutor 1, re-adoption 0) · mean repair latency 1 turns · unrepaired at end 2 · degraded-turn integral 15 · D reversals 1
- **theory fidelity** F 0.778 at end · min 0.778
  - m_key t3 (never repaired) · p_bearing t4→t5 (tutor) · p_bearing t7 (never repaired)
- **events** plot×3 · throughline×1 · decay×3 · act_end×2 · plot_audit×3 · repair×1 · disengagement×1
- **staging** 3 movements declared by the director
- **acts** 3 played · closed by the director 2 · at max length 0 · at run end 1 — Act 1 t1–3 (director) · Act 2 t4–8 (director) · Act 3 t9–12 (run end)
- **plot** 3 committed · withhold+friction on 3/3 · 6 clauses avg · audits 3 (incl. final act): kept 12 / justified 3 / drift 2 · hold-named exhibits staged in act 0/0
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 3: on 3 / off 0 · run-end reckoning 7 clauses: kept 5 / justified 1 / drift 1
- **release authority** 2 played: 0 on schedule · 0 held · 2 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_bearing -1 (t3): "Played one turn early because the clerk explicitly identified the logged bearing as the next lawful conjunct."
  - p_chart -2 (t7): "Played early because the clerk has repeatedly named the chart as the exact missing conjunct and is ready to derive Rule 1."
- **confrontation** 2 demanded (1 against a slipped exhibit) · re-entries 1: covered 1, uncovered 0 · watcher fires 1 (became the confrontation 1) · fires without recorded due 0
- **figures** erotema 6/12 (50%) · 4 distinct · switch rate 0.73
- **superego** intervened 3/12 watched turns · figure changed within-turn on 2/3 interventions · switch on intervention 1.00 vs elsewhere 0.63
- **inference** 1 voiced · stall integral 0 · overreach 0 · mischanneled 0 — `steeredToward mara southStack` available t7 → voiced t7 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 12 | 2.92 | 3 | 40.8 |
| tutor | 12 | 2.25 | 3 | 43.8 |
| learner | 12 | 3.25 | 4 | 69.2 |
