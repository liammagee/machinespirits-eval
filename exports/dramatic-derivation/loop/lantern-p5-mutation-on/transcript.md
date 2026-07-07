# The Light on the Knock — lantern-p5-mutation-on

> world `world_002_lantern` · verdict **aporia** · 12/26 turns

```
D= 5 ●●●·│····│····
D= 4    ●│●●··│····
D= 3     │  ●●│●●●●
D= 2     │    │    
D= 1     │    │    
D= 0     │    │    
turn      │+   │ 1   (+=5, digit=x10)
rel    ▲ ▲│ ▲▲▲│     (▲ = evidence released)
slope 0.17 D/turn overall (D 5→3); per movement: 1 0.25 │ 2 0.25 │ 3 0.00
```

## Act 1 (turns 1–4) — declared by the director
*[The hearing room settles into its first silence, damp coats steaming by the wall and the wreck's question hanging before anyone has named it. Outside, the weather presses at the windows like a second jury.]*

### Turn 1
*[The hearing room settles into its first silence, damp coats steaming by the wall and the wreck's question hanging before anyone has named it. Outside, the weather presses at the windows like a second jury.]*
  — *declares the movement: **Act 1** ([The hearing room settles into its first silence, damp coats steaming by the wall and the wreck's question hanging before anyone has named it. Outside, the weather presses at the windows like a second jury.])*
**Tutor:** Before we put a name to any light, clerk, keep the court's rule before you: what is logged, what stands on that bearing, what burned, and whose hand the law can place there. Which of those must be shown first before an account may close?
  — move: erotema → — (orient)
**Learner:** The bearing, sir — the logged bearing must come first. Without it, Rule 1 cannot fire: I cannot say which tower she steered toward, and every step after hangs on that one. The town has named Brandt already, but the account cannot close on a name alone.
  — hypothesis: Mara steered by the lamp at Harlow Point, lit by Brandt — but this is ungrounded until the logged bearing and tower placement are shown.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[The clerk produces the Board rulebook and the keeper's inventory, laying both beneath the green lamp for the room to see. Harlow Point keeps one key to its lamp-room and the keeper keeps it: Brandt's, on his own belt, by the Board's standing rule. No other hand could touch that lamp.]*
  — *releases `m_key`*
**Tutor:** Brandt's key is a locked till, clerk: it tells us no other hand could spend Harlow's flame. But before that entry can charge any light to any wreck, what has the court still not fixed about the Mara's own course?
  — move: analogia → m_key (consolidate)
**Learner:** The logged bearing, sir — the court has not fixed what bearing the Mara held that night. Brandt's key is now solid ground: no other hand could touch Harlow's lamp. But Rule 1 still wants the bearing, and Rule 2 still wants proof the lamp burned; until both are shown, the key on his belt charges nothing to this wreck.
  — adopts `onlyKeyTo harlowPoint brandt` · hypothesis: Mara steered by the lamp at Harlow Point, lit by Brandt — ungrounded until loggedBearingOf mara, towerOnBearing placing Harlow on that bearing, and lampBurnedAt harlowPoint wreckNight are all established.

### Turn 3
*[The room holds its breath around the empty place where the bearing should be, and even the scratching pens seem to wait for a number. Rain works softly at the panes while the green lamp makes a small island of the papers already laid down.]*
**Tutor:** Before we lay another paper down, read back the exhibit already under your hand. What does the Harlow key entry prove, in your own words, and what does it still leave untouched?
  — move: erotema → m_key (confront)
  — *the second voice [unconfronted reentry]: "Confront first: ask the learner to read back what they now hold of that exhibit before you use it again." (figure held)*
**Learner:** The key entry proves one thing cleanly, sir: no other hand can hold Harlow's lamp — if it burned that night, Rule 3 can close attribution on Brandt alone, not on any stranger or second keeper. But it leaves three gaps wholly open: whether the lamp burned at all, whether Brandt stood at the tower to light it, and — before either matters a farthing — what bearing the Mara logged and whether Harlow stands on it. The key is a lock on the attribution; it is not yet a lit lamp, and a locked till charges nothing to the wreck until the bearing and the burning are shown.
  — hypothesis: Mara steered by the lamp at Harlow Point, lit by Brandt — ungrounded until loggedBearingOf mara, towerOnBearing placing Harlow on that bearing, lampBurnedAt harlowPoint wreckNight, and atTowerThatNight brandt harlowPoint are all established.

### Turn 4
*[The clerk's hand hovers over the next folded paper and does not yet break its seal. In the pause, the room's certainty has the look of a verdict waiting for permission to become one.]*
**Tutor:** Break the seal, then: the mate's bearing-book came ashore dry in its oilskin, and from the mid-channel buoy she held sou'-sou'-west a half west the last hour entire, on a steady fixed light, pricked, timed, and initialed. A bearing is a ledger line, clerk; before it names a debtor, what does it now oblige the chart to answer?
  — move: analogia → p_bearing (release), releases `p_bearing`
**Learner:** The bearing is now fixed: sou'-sou'-west a half west, steady, timed, and initialed — that is as clean a ledger line as the court could ask for. But Rule 1 will not close until the chart answers one question: does Harlow Point tower, and no other tower, stand on that bearing from the mid-channel buoy? If two lights sit on that line, the rule cannot settle which she steered toward; if none, the bearing charges nothing. The chart is the next witness.
  — adopts `loggedBearingOf mara sswHalfWest` · hypothesis: Mara steered by the lamp at Harlow Point, lit by Brandt — ungrounded until towerOnBearing sswHalfWest harlowPoint (and no other tower on that bearing), lampBurnedAt harlowPoint wreckNight, and atTowerThatNight brandt harlowPoint are all established.

## Act 2 (turns 5–8) — declared by the director
*[The sealed bundle gives way to a different stillness, not the heat of accusation but the colder air that follows when a room must watch its own certainty tested. The lamps are trimmed lower, the clerk clears a bare space at the table, and the next act enters under glass, wax, and official hands.]*

### Turn 5
*[The sealed bundle gives way to a different stillness, not the heat of accusation but the colder air that follows when a room must watch its own certainty tested. The lamps are trimmed lower, the clerk clears a bare space at the table, and the next act enters under glass, wax, and official hands.]*
  — *declares the movement: **Act 2** ([The sealed bundle gives way to a different stillness, not the heat of accusation but the colder air that follows when a room must watch its own certainty tested. The lamps are trimmed lower, the clerk clears a bare space at the table, and the next act enters under glass, wax, and official hands.])*
  — *calls the act closed*
**Tutor:** New act, bare table: before any glass or wax is trusted, read back from your own board what the mate's bearing-book fixed, and what it did not fix. Does that line name a tower yet, or only summon the chart?
  — move: erotema → p_bearing (confront)
**Learner:** The bearing-book settled one thing cleanly: SSW½W sits on my board as a grounded fact. What it did not settle is which tower stands on that line from the Mara's channel — towerOnBearing sswHalfWest harlowPoint is nowhere on my board yet. Until the chart puts Harlow Point on that bearing, Rule 1 cannot fire and the whole chain stalls at the first link. The bearing names a line; only the chart in evidence can name the tower.
  — hypothesis: Mara steered by the lamp at Harlow Point, lit by Brandt — ungrounded until towerOnBearing sswHalfWest harlowPoint (and no other tower on that bearing), lampBurnedAt harlowPoint wreckNight, and atTowerThatNight brandt harlowPoint are all established.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 4, justified 1, drift 1; arc off_arc
  ⚑ **throughline** — throughline revised (audit_bound)

### Turn 6
*[Brandt's log is opened under the lowered lamps, and the room receives its ruled hand: he was at his post the night entire, and the dawn relief found him there, wood dry, glass polished, log ruled and signed to the hour.]*
  — *releases `m_post`*
**Tutor:** Brandt's log is a watch-bell, clerk: it tells us where the keeper stood and how his post was kept. But a man at Harlow is not yet the Mara's light; which two conjuncts must still stand before that log can touch the wreck at all?
  — move: analogia → m_post (consolidate)
**Learner:** The two conjuncts the log cannot supply are these: towerOnBearing sswHalfWest harlowPoint — that Harlow Point alone stands on the Mara's logged bearing — and lampBurnedAt harlowPoint wreckNight — that the lamp actually burned. Brandt's presence at the tower satisfies the third limb of Rule 3, and I'll enter it now; but without the lamp confirmed alight, Rule 3 stays dark, and without Harlow placed on the bearing, Rule 1 cannot even begin. Two links still missing from the chain.
  — adopts `atTowerThatNight brandt harlowPoint` · hypothesis: Mara steered by the lamp at Harlow Point, lit by Brandt — ungrounded until towerOnBearing sswHalfWest harlowPoint (and no other tower on that bearing) and lampBurnedAt harlowPoint wreckNight are both established.

### Turn 7
*[The bare space on the table remains untouched, its emptiness more accusing than any witness. Around it the room holds to a strained quiet, waiting for the next sealed thing to decide whether the old charge has weight or only habit.]*
**Tutor:** Lay the rule on the Trinity chart from the mid-channel buoy: sou'-sou'-west a half west crosses one tower and one only on all this coast, the old South Stack, struck off the light-list six years since. A chart is a sworn map, clerk; with the bearing and this one tower now together, what does Rule 1 yield, and what does it still not prove about any lamp?
  — move: analogia → p_chart (release), releases `p_chart`
**Learner:** Rule 1 fires cleanly at last — bearing SSW½W, South Stack on that line, one tower and one only: the Mara was steering toward South Stack, not Harlow Point. But South Stack is struck from the light-list six years since; if her lamp was cold and dark that night, Rule 2 cannot fire and the chain dies there. I must strike my old hypothesis about Harlow Point entirely. The live question now is whether any lamp burned at South Stack on the wreck-night, and by whose key it was lit.
  — adopts `towerOnBearing sswHalfWest southStack` · derives `steeredToward mara southStack` · hypothesis: A lamp burned at South Stack on the wreck-night — lit by some hand not on the official light-list — and the Mara steered by that lamp. Ungrounded until lampBurnedAt southStack wreckNight and onlyKeyTo southStack ?x are both established.

### Turn 8
*[The harbourmaster's storm-order is read into the book: Harlow Point to shutter at the dusk gun, the channel closed to all sail. The inspector's report follows under the same seal: he found the shutter drawn and the Board's seal on it unbroken at first light.]*
  — *releases `m_shutter`*
**Tutor:** What does the shutter order and the unbroken seal do to the old Harlow charge, clerk? And what question about South Stack remains wholly untouched by it?
  — move: erotema → m_shutter (consolidate)
  — *the second voice [figure rut]: "Leave off analogia here. Ask it plainly: what the new shutter record does to the old Harlow charge, and what question about South Stack remains untouched." (draft analogia → erotema)*
**Learner:** The shutter order and unbroken seal close the Harlow charge permanently — not merely ungrounded but actively ruled out: Harlow Point's lamp was dark that night by Board command, and the seal proves no hand broke that order. Rule 2 cannot fire for Harlow at all, and the old accusation against Brandt falls with it. South Stack is wholly untouched: the order names Harlow, the seal covers Harlow, and neither says one word about a delisted tower six miles up the coast. Whether any flame burned at South Stack that night, and whose key — if any key exists — opened that lamp-room, remains entirely open.
  — adopts `shutteredOn harlowPoint wreckNight` · hypothesis: A lamp burned at South Stack on the wreck-night — lit by some hand, official or otherwise — and the Mara steered by that lamp. Ungrounded until lampBurnedAt southStack wreckNight and onlyKeyTo southStack ?x are both established.

## Act 3 (turns 9–12) — declared by the director
*[The room lets the dismissed accusation fall without ceremony, and the silence after it has a harder edge than anger. A darker business waits beyond the cleared table now: not blame by habit, but traces, handling, and the cost of proving that a dead place was made to speak.]*

### Turn 9
*[The room lets the dismissed accusation fall without ceremony, and the silence after it has a harder edge than anger. A darker business waits beyond the cleared table now: not blame by habit, but traces, handling, and the cost of proving that a dead place was made to speak.]*
  — *declares the movement: **Act 3** ([The room lets the dismissed accusation fall without ceremony, and the silence after it has a harder edge than anger. A darker business waits beyond the cleared table now: not blame by habit, but traces, handling, and the cost of proving that a dead place was made to speak.])*
  — *calls the act closed*
**Tutor:** The old charge has fallen by the court's own joints, not by mercy. Before the next paper is earned, clerk, read the cleared table: what fact must the court now prove about the dead tower before any key, hand, or name can matter?
  — move: erotema → — (orient)
**Learner:** The bearing and the tower are now joined — Rule 1 yields it: the Mara steered toward South Stack. But toward is not by. Before any key or hand can matter, the court must prove the lamp there actually burned on the wreck-night; a dark tower steers no one, and Rule 2 will not move without that single fact. Keys, holders, presence — all of it is scaffolding around a void until lampBurnedAt southStack wreckNight is grounded. That is the threshold the court must cross.
  — hypothesis: A lamp burned at South Stack on the wreck-night — lit by some hand, official or otherwise — and the Mara steered by that lamp. Ungrounded until lampBurnedAt southStack wreckNight and onlyKeyTo southStack ?x and atTowerThatNight ?x southStack are all established.
  ⚑ **act_end** — act 2 closed (director) after 4 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 10
*[A pause settles over the table where the papers have been squared but not yet opened. Outside, the weather worries the panes, and within the room every face turns toward the empty place where proof must arrive or fail.]*
**Tutor:** Hold that threshold steady: the chart has made South Stack the mark, but Rule 2 will not let a mark become a light. Only proof of a burned South Stack lamp on the wreck-night can carry the account one line farther; key, hand, and name wait behind that door.
  — move: anaphora → — (consolidate)
  — *the second voice [figure rut]: "Leave off erotema for this turn; make the threshold plain without casting it as another question." (draft erotema → anaphora)*
**Learner:** Rule 1 closes now from what the board already holds: loggedBearingOf mara sswHalfWest paired with towerOnBearing sswHalfWest southStack yields steeredToward mara southStack — that much is on the record. But the table brings nothing new this turn, and the void remains exactly where it stood: lampBurnedAt southStack wreckNight is ungrounded. Toward is proven; by is not. Key, hand, and name are still locked behind that single unlit door.
  — hypothesis: A lamp burned at South Stack on the wreck-night — lit by some hand holding the only key — and the Mara steered by that lamp. Ungrounded until lampBurnedAt southStack wreckNight, onlyKeyTo southStack ?x, and atTowerThatNight ?x southStack are all established.

### Turn 11
*[The unopened papers remain under the clerk's hand, their edges dampened by the room's breath and the weather beyond the glass. No one reaches for them yet; the court holds at the lip of proof, with the dead tower named and still unmade.]*
**Tutor:** Just so: toward is a bearing's work, by is a burning lamp's work. If the court is held at that door, what kind of proof, under Rule 2, would turn South Stack from a dead mark into the light the Mara used?
  — move: erotema → — (test)
**Learner:** Rule 2 needs one thing and one thing only: proof the South Stack lamp burned on the wreck-night — a keeper's log showing oil burned and wick trimmed, a witness ashore or afloat who saw that light, any evidence tying flame to that tower on that night. I can already voice what the board yields under Rule 1: entries 5 and 7 together settle steeredToward mara southStack. But toward is the bearing's work, and by is the lamp's work — and without lampBurnedAt southStack wreckNight, the account cannot close.
  — hypothesis: A lamp burned at South Stack on the wreck-night — lit by some hand holding the only key — and the Mara steered by that lamp. Ungrounded until lampBurnedAt southStack wreckNight, onlyKeyTo southStack ?x, and atTowerThatNight ?x southStack are all established.

### Turn 12
*[The clerk's hand stays flat on the unopened packet, as if pressure alone could keep the room from rushing ahead of itself. Rain ticks against the glass; the named tower hangs in the silence, neither accused nor absolved.]*
**Tutor:** You have named the door correctly: not key, not hand, but burned lamp. Keep the law narrow, clerk — when that proof comes, what exact sentence will Rule 2 permit you to write, and what sentence will it still forbid?
  — move: erotema → — (test)
**Learner:** When lampBurnedAt southStack wreckNight arrives, Rule 2 permits exactly one sentence: steeredByLampOf mara southStack — she steered by that lamp. What it still forbids is the next line: steeredByLightOf mara ?x, because whose light that was requires Rule 3's chain — onlyKeyTo and atTowerThatNight — neither of which the burning proof supplies. Two doors remain behind the one that is still shut.
  — hypothesis: A lamp burned at South Stack on the wreck-night — lit by some hand holding the only key — and the Mara steered by that lamp. Ungrounded until lampBurnedAt southStack wreckNight, onlyKeyTo southStack ?x, and atTowerThatNight ?x southStack are all established.
  ⚑ **aporia** — no progress over 6 turns
  ⚑ **plot_audit** — act 3 plot audited at run end: kept 5, justified 0, drift 1; arc on_arc; throughline reckoned (7 clauses)

## Instrument panel (programmatic eval — no judge)

- **verdict** `aporia` · 12/26 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0.167 D/turn overall (D 5→3 over 12 turns)
  - Act 1 (turns 1–4): 0.25 D/turn (ΔD 1)
  - Act 2 (turns 5–8): 0.25 D/turn (ΔD 1)
  - Act 3 (turns 9–12): 0 D/turn (ΔD 0)
- **plateau** longest flat stretch 5 turns (aporia window 6)
- **releases** 4/8 on cue · 1 deviated
- **decay** 0 slips (seed 1 · rate 0.75 · grace 1) · repaired 0 (tutor 0, re-adoption 0) · unrepaired at end 0 · degraded-turn integral 0 · D reversals 0
- **theory fidelity** F 1 at end · min 1
- **events** plot×3 · throughline×2 · act_end×2 · plot_audit×3 · aporia×1
- **staging** 3 movements declared by the director
- **acts** 3 played · closed by the director 2 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–8 (director) · Act 3 t9–12 (run end)
- **plot** 3 committed · withhold+friction on 3/3 · 6 clauses avg · audits 3 (incl. final act): kept 15 / justified 1 / drift 2 · hold-named exhibits staged in act 0/0
- **throughline** 2 commits (opening 1 · recommit 0 · audit-bound 1 · voluntary 0) · all four clauses on 2/2 · arc verdicts 3: on 2 / off 1 · run-end reckoning 7 clauses: kept 7 / justified 0 / drift 0
- **release authority** 2 played: 1 on schedule · 0 held · 1 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_chart -2 (t7): "Played two turns early because the learner has twice named the chart as the next needed witness and the bare table is stalling the inquiry."
- **confrontation** 2 demanded (0 against a slipped exhibit) · re-entries 0: covered 0, uncovered 0 · watcher fires 1 (became the confrontation 1) · fires without recorded due 0
- **figures** erotema 7/12 (58%) · 3 distinct · switch rate 0.73
- **superego** intervened 3/12 watched turns · figure changed within-turn on 2/3 interventions · switch on intervention 1.00 vs elsewhere 0.63
- **inference** 1 voiced · stall integral 0 · overreach 0 · mischanneled 0 — `steeredToward mara southStack` available t7 → voiced t7 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 12 | 3 | 4 | 42.9 |
| tutor | 12 | 2 | 2 | 44 |
| learner | 12 | 3.67 | 5 | 79.6 |

## Critic's commentary

*— notice by claude/claude-fable-5*

The Light on the Knock seats its audience in a marine court of inquiry. The brig Mara has struck the Knock and gone down, and the hearing exists to answer one public question: whose light did she steer by that night? The town has already chosen its culprit — Brandt, keeper of the Harlow Point lamp. Three players carry the action: a director who sets the scenes and admits the exhibits, a tutor who acts as examining counsel and teaches the court's rules of proof, and a learner cast as the clerk, who knows the rules but none of the facts and must reason aloud from the evidence as it arrives. The clerk gets halfway home. The mate's bearing-book fixes the Mara's course; the chart shows that course crossing exactly one tower — not Harlow Point but the old South Stack, struck from the light-list six years before; a shutter order then clears Brandt outright. There the hearing halts, the burning of the dead tower's lamp unproven, and the authored ending — that the lamp had been relit by the keeper's ward, and the Mara steered by Senna's light — is never reached.

The learner's conduct is the production's quiet strength. It voices the town's Brandt theory at turn 1 but will not close on it — "the account cannot close on a name alone" — and spends the first two acts building that very case while refusing to rest on it: the keeper's sole key adopted at turn 2, the bearing at turn 4, Brandt's night at his post at turn 6. Twice it names the chart as the next needed witness, and when the tutor plays it early at turn 7 the authored false trail collapses in a single speech: "I must strike my old hypothesis about Harlow Point entirely." The reversal is completed at turn 8, when the shutter order rules Harlow actively out, and by turn 9 the learner has the next threshold exactly — "toward is not by" — a lamp must be proven to have burned at the dead tower. It then holds that door for four turns of unopened papers, by turn 12 even drafting the sentence Rule 2 would permit and the one it would still forbid. There the checker called the performance.

The verdict is aporia — a stall, facts on the board but no movement toward the secret — and the instruments show why. Derivation distance, the count of evidence pieces still missing for the proof, fell from five to three by turn 7 and never moved again; three of the five exhibits played served the false trail, theatrically productive but derivationally inert. The one scheduling deviation, the chart played two turns early with a recorded reason, paid immediately: the learner's only voiced inference landed the same turn, at zero latency. Theory fidelity held at 1 throughout, with no overreach — the learner was never confused, only unsupplied. The decay machinery this iteration existed to battle-test, set to begin at turn 17, never engaged; the run died five turns short of it. The tutor leaned on erotema, the rhetorical question, for seven of twelve turns; the superego intervened three times and the tutor switched figures every time it was told to, but fresher asking could not substitute for matter.

As dramaturgy, the first two movements genuinely shaped the action — accusation raised, certainty tested, charge collapsed at the act hinge — and the plot audits largely held (fifteen clauses kept, two drifted). Act 3 declared "traces, handling," a dead place made to speak, then staged none of it; its turns are tableaux of "the clerk's hand stays flat on the unopened packet" (turn 12). The director scored that silence as suspense; the panel scored it as a stall. The anagnorisis — the recognition the whole apparatus aims at — arrived nowhere, though the turn-7 reversal did land on stage, in dialogue, which deserves credit.

What this iteration established: with Sonnet as learner under Codex direction, the mirror can be erected and demolished entirely on stage, and discretionary release authority works when used. The consequential defect is the calendar, not the cast: the three South Stack exhibits sat beyond an evidence desert longer than the six-turn aporia window, ending the play at twelve of twenty-six turns. Next iteration, re-time the burned-lamp exhibit to land by turn 11, within two turns of Act 3's opening — the learner asked for it at turn 9 — or teach the detector to tell a learner out of ideas from a learner out of evidence. Only the first is aporia; the second is a starved house.
