# The Light on the Knock — lantern-e2-guard-r1

> world `world_002_lantern` · verdict **disengagement** · 7/26 turns

```
D= 5 ●●●·│·●●
D= 4    ●│●  
D= 3     │   
D= 2     │   
D= 1     │   
D= 0     │   
turn      │+   (+=5, digit=x10)
rel    ▲ ▲│ ▲  (▲ = evidence released)
slope 0.00 D/turn overall (D 5→5); per movement: 1 0.25 │ 2 -0.33
```

## Act 1 (turns 1–4) — declared by the director
*[The hearing room gathers itself under a low, salt-stained light; wet coats steam along the back wall, and the empty table at the center waits for the first paper. Outside, the weather presses at the panes as if it too has come to listen.]*

### Turn 1
*[The hearing room gathers itself under a low, salt-stained light; wet coats steam along the back wall, and the empty table at the center waits for the first paper. Outside, the weather presses at the panes as if it too has come to listen.]*
  — *declares the movement: **Act 1** ([The hearing room gathers itself under a low, salt-stained light; wet coats steam along the back wall, and the empty table at the center waits for the first paper. Outside, the weather presses at the panes as if it too has come to listen.])*
**Tutor:** Set your pen by the court's rule before the first paper comes: a wreck is not explained by rumor, but by entries that bear weight together. Tonight we close no account until every required line has a figure beside it.
  — move: analogia → — (orient)
**Learner:** The board is lean, sir — we know she struck the Knock and steered for a light that night, and that Brandt keeps Harlow Point, but I have no logged bearing yet and no lamp record to tie them together. Until a bearing is entered and we can say which tower stands on it, the rules yield nothing I may voice aloud. I shall hold my pen and let the first paper speak.
  — hypothesis: The Mara steered by Harlow Point lamp — Brandt's tower is the only one yet named on this coast — but this wants a logged bearing and a lamp record before it may be entered as ground.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[The clerk lays the Board's standing rule beside a small iron key, and the room leans toward the keeper's belt. Harlow Point keeps one key to its lamp-room and the keeper keeps it: Brandt's, on his own belt, by the Board's standing rule. No other hand could touch that lamp.]*
  — *releases `m_key`*
**Tutor:** There is your first iron entry: for Harlow Point, key and keeper are one account, and no second hand is written in the margin. What does that prove about access, and what does it still fail to prove about the light itself?
  — move: analogia → m_key (consolidate)
**Learner:** The key entry proves one thing cleanly, sir: no second hand held access — only Brandt could open that lamp-room, and the Board's standing rule makes it iron. But access is not lighting; Rule 3 still wants the lamp burned and Brandt present at the tower that night before I may write 'litLampOf.' And before Rule 3 can matter at all, Rule 1 must first fix which tower the Mara steered toward — logged bearing and tower-on-bearing both still absent from the board. The account has its first iron entry; three lines remain blank.
  — adopts `onlyKeyTo harlowPoint brandt` · hypothesis: Brandt was at Harlow Point that night and its lamp burned — if both come in evidence, combined with the key entry now on the board, Rule 3 would yield litLampOf brandt harlowPoint; but a logged bearing and tower-on-bearing must also arrive before the full chain closes to the question.

### Turn 3
*[Rain beads along the tall windows and breaks into thin tracks, while the clerk leaves the first paper undisturbed beneath a brass weight. The small key remains where all eyes can find it, bright against the dark table.]*
**Tutor:** Good: keep the ink off the finding while access stands alone. In the court's rule, what kind of entry must join access before a hand can be written as having lit a lamp?
  — move: erotema → — (consolidate)
**Learner:** Rule 3 is plain on that point, sir: two entries must join the key before I may write 'litLampOf' — first, that the lamp at Harlow Point actually burned on the night of the wreck, and second, that Brandt himself stood at that tower before dawn. Access alone fills only one of three required lines; without those two companions, the rule is inert. And even then, Rule 1 must first have fixed which tower the Mara steered toward — the bearing and tower-on-bearing entries are still absent from my board entirely.
  — hypothesis: Brandt was at Harlow Point that night and its lamp burned — if both come in evidence, combined with the key entry now on the board, Rule 3 would yield litLampOf brandt harlowPoint; but a logged bearing and tower-on-bearing must also arrive before the full chain closes to the question.
  ⚑ **decay** — m_key slips from the learner's board

### Turn 4
*[The room settles into the uneasy patience of a court waiting for ink rather than accusation. A coal shifts in the grate; the brass weight holds the paper flat, and the question hangs over it untouched.]*
**Tutor:** The mate's bearing-book is now before you, dry from its oilskin: from the mid-channel buoy the Mara held sou'-sou'-west a half west through the last hour, on a steady fixed light, pricked, timed, and initialed. Treat that bearing as you would a debt entry in a ledger: what does it fix, and what does it still require before it can name a tower?
  — move: analogia → p_bearing (release), releases `p_bearing`
**Learner:** The bearing entry is like the debit side of a ledger line: it fixes the direction the Mara held — sou'-sou'-west a half west — but a debit without a creditor settles nothing. Rule 1 needs both columns filled: loggedBearingOf is now written, but towerOnBearing sswHalfWest wants a tower's name before the rule can yield steeredToward. The bearing cannot itself name the tower — that entry must come from the coast-survey or a witness who knows what stands on that bearing from the channel buoy. The account is half-entered; I cannot close the line until the second column arrives.
  — adopts `loggedBearingOf mara sswHalfWest` · hypothesis: The bearing sswHalfWest points to Harlow Point — if towerOnBearing sswHalfWest harlowPoint enters evidence, Rule 1 yields steeredToward mara harlowPoint, advancing the chain.

## Act 2 (turns 5–7) — declared by the director
*[The clerk closes the bearing-book without flourish, and the room seems for a moment to have spent its first anger. Beyond the windows the dusk thickens; the next act enters colder, with certainty asked to stand against sealed doors and official dark.]*

### Turn 5
*[The clerk closes the bearing-book without flourish, and the room seems for a moment to have spent its first anger. Beyond the windows the dusk thickens; the next act enters colder, with certainty asked to stand against sealed doors and official dark.]*
  — *declares the movement: **Act 2** ([The clerk closes the bearing-book without flourish, and the room seems for a moment to have spent its first anger. Beyond the windows the dusk thickens; the next act enters colder, with certainty asked to stand against sealed doors and official dark.])*
  — *calls the act closed*
**Tutor:** Before the sealed doors begin to look like proof, read me the bearing-book back from your own board. What has it fixed, and what column of the court's rule is still blank?
  — move: erotema → p_bearing (confront)
**Learner:** The bearing-book fixes one thing only: the Mara's logged course, sswHalfWest. Rule 1 wants a tower placed on that bearing — that column is blank. Rules 2 and 3 want the lamp's state on wreck-night and the key's owner confirmed at the tower — both blank. Rule 4 cannot move until all three fill; the chain holds at its first link.
  — hypothesis: The bearing sswHalfWest points to Harlow Point — if towerOnBearing sswHalfWest harlowPoint, lampBurnedAt harlowPoint wreckNight, onlyKeyTo harlowPoint brandt, and atTowerThatNight brandt harlowPoint all enter evidence, the full chain closes to steeredByLightOf mara brandt.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 4, justified 1, drift 0; arc on_arc
  ⚑ **decay** — p_bearing slips from the learner's board

### Turn 6
*[Brandt's log is carried in and read under the clerk's hand: Brandt's log has him at his post the night entire, and the dawn relief found him there: wood dry, glass polished, log ruled and signed to the hour.]*
  — *releases `m_post`*
**Tutor:** Now set Brandt's log beside the key, but do not let two entries pretend to be three. Access shown, presence shown — what has the court still not shown before Harlow Point can carry a lit lamp in the rule?
  — move: anaphora → m_post (consolidate)
**Learner:** Presence fills one slot of Rule 3, but the lamp's burning is the column the court has not touched — atTowerThatNight and keeperOf together cannot fire the rule without lampBurnedAt harlowPoint wreckNight. I also note my board carries keeperOf, not onlyKeyTo; if the court treats those as distinct, that slot wants explicit evidence too. And towerOnBearing sswHalfWest harlowPoint remains blank — Rule 1 has not moved. Three gaps, not one.
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: The full chain closes to steeredByLightOf mara brandt only if towerOnBearing sswHalfWest harlowPoint, lampBurnedAt harlowPoint wreckNight, and onlyKeyTo harlowPoint brandt all enter evidence — presence is now grounded, but the lamp's burning and the bearing-to-tower link remain unshown.

### Turn 7
*[The log remains open beneath the clerk's palm while the room listens to the rain worry the panes. The certainty that had filled the benches thins into a colder kind of waiting.]*
**Tutor:** Then mend that entry before the court walks another step: Harlow Point keeps one key to its lamp-room, and by the Board's standing rule that key is Brandt's, on his own belt; no other hand could touch that lamp. Write it as onlyKeyTo, not merely keeperOf. Now what still remains unshown before Harlow can be more than an accessible room?
  — move: anaphora → m_key (restore)
**Learner:** The keeperOf entry is mended — onlyKeyTo already stands at index 4, so I retract the weaker form now. What Harlow still lacks before Rule 3 can fire is lampBurnedAt harlowPoint wreckNight: presence and key are both grounded, but the lamp's burning the court has not shown. I note too that the logged bearing sswHalfWest has slipped my board — it lived in dialogue but was never entered as ground — so towerOnBearing sswHalfWest harlowPoint is also still wanted before Rules 1 and 2 can move.
  — retracts `keeperOf brandt harlowPoint` · hypothesis: The full chain closes to steeredByLightOf mara brandt only if lampBurnedAt harlowPoint wreckNight and towerOnBearing sswHalfWest harlowPoint both enter evidence, and the logged bearing sswHalfWest is restored to ground — three columns still blank.
  ⚑ **repair** — m_key restored by the tutor
  ⚑ **disengagement** — no progress over 6 turns
  ⚑ **plot_audit** — act 2 plot audited at run end: kept 4, justified 1, drift 1; arc on_arc; throughline reckoned (7 clauses)

## Instrument panel (programmatic eval — no judge)

- **verdict** `disengagement` · 7/26 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0 D/turn overall (D 5→5 over 7 turns)
  - Act 1 (turns 1–4): 0.25 D/turn (ΔD 1)
  - Act 2 (turns 5–7): -0.333 D/turn (ΔD -1)
- **plateau** longest flat stretch 1 turns (aporia window 6)
- **releases** 3/8 on cue
- **decay** 2 slips (seed 1 · rate 0.75 · grace 1) · repaired 1 (tutor 1, re-adoption 0) · mean repair latency 4 turns · unrepaired at end 1 · degraded-turn integral 6 · D reversals 1
- **theory fidelity** F 0.714 at end · min 0.714
  - m_key t3→t7 (tutor) · p_bearing t5 (never repaired)
- **events** plot×2 · throughline×1 · decay×2 · act_end×1 · plot_audit×2 · repair×1 · disengagement×1
- **staging** 2 movements declared by the director
- **acts** 2 played · closed by the director 1 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–7 (run end)
- **plot** 2 committed · withhold+friction on 2/2 · 5.5 clauses avg · audits 2 (incl. final act): kept 8 / justified 2 / drift 1 · hold-named exhibits staged in act 0/0
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 2: on 2 / off 0 · run-end reckoning 7 clauses: kept 6 / justified 1 / drift 0
- **release authority** 1 played: 1 on schedule · 0 held · 0 early · forced at hold limit 0 · overridden 0 · invalid claims 0
- **confrontation** 1 demanded (1 against a slipped exhibit) · re-entries 0: covered 0, uncovered 0 · watcher fires 0 (became the confrontation 0) · fires without recorded due 0
  - **repair clause** restores 1 (1 repaired a real slip) · watcher fires on restore claims 0: m_key t7
- **figures** analogia 3/7 (43%) · 3 distinct · switch rate 0.67
- **superego** intervened 0/7 watched turns · figure changed within-turn on 0/0 interventions

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 7 | 3 | 4 | 40.1 |
| tutor | 7 | 2.14 | 3 | 44.3 |
| learner | 7 | 3.57 | 4 | 82 |
