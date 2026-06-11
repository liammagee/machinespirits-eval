# The School Well — wit-decay-v1-A-s2

> world `world_004_withercombe` · verdict **disengagement** · 11/24 turns

```
D= 6 ●●●··│······
D= 5    ●●│······
D= 4      │●●●·●●
D= 3      │   ●  
D= 2      │      
D= 1      │      
D= 0      │      
turn      +│    1  (+=5, digit=x10)
rel    ▲ ▲ │▲ ▲ ▲  (▲ = evidence released)
slope 0.18 D/turn overall (D 6→4); per movement: 1 0.20 │ 2 0.17
```

## The Children's Water (turns 1–5) — declared by the director
*To let the village’s first fear gather before any proof has learned its shape.*

### Turn 1
*[The schoolroom stands close and overfull, benches drawn tight beneath a low morning light. A covered pail waits on the master’s table, and every face in the room has learned not to look at it for too long.]*
  — *declares the movement: **The Children's Water** (To let the village’s first fear gather before any proof has learned its shape.)*
**Tutor:** The pail tells us only that the school well is foul since Lady-Day, and the village has a knacker to point at. What conjunct has the village shown, besides a name it has long disliked?
  — move: erotema → — (counter_mirror)
**Learner:** The village has shown nothing but the name and the smell — there is no line drawn from Bray's yard to what feeds our well, no source tested sweet or foul, no residue named at any place the survey can put a pin in. The day-book says 'water foul again' but it does not say 'whence.' We know the fouling; we have proved nothing of its cause.
  — hypothesis: Bray's melt-yard lies on the south lane and has long steeped the ground there — it may be that what feeds the school well passes near or beneath that yard, and that the yard's residue entered at the source; but none of this is yet shown to the survey.

### Turn 2
*[A villager is shown in with the old certainty already in his mouth: "No one need teach Withercombe what a melt-yard steeps: grave-water and tallow lees, liquor that would taint a river past any sweetening. What Bray's yard holds would foul water — and there the village case stands, twenty years strong."]*
  — *releases `m_taint`*
**Tutor:** Tallow lees may foul a river, but a strong liquor is not yet a road to this pail. Which conjunct has the villager added: the stuff that can taint, or the path by which it entered the school well?
  — move: erotema → m_taint (consolidate)
**Learner:** The villager has added only the first conjunct — that tallow lees is a stuff that taints. That is worth entering. But 'can taint' is not 'did taint this water': we still have no source named, no residue placed at any source, no road drawn from Bray's yard to what feeds our well. The village has shown us the poison but not the cup it was poured in.
  — adopts `taints tallowLees` · hypothesis: If Bray brought tallow lees to the place that feeds the school well, and residue of tallow lees sits there, the chain would close — but neither 'brought' nor 'residue at source' is yet in evidence.

### Turn 3
*[The room settles around the pail as around a thing that has spoken once and refuses to speak again. Outside, a thin rain ticks at the schoolroom glass, and the children’s slates lie untouched while the grown voices spend themselves against the same closed door.]*
**Tutor:** Enter it narrowly: a stuff that can taint is shown; a road to this pail is not shown; a hand at the place is not shown. Let the book hold the tainting and refuse the verdict.
  — move: anaphora → m_taint (consolidate)
  — *the second voice [figure rut]: "Leave off erotema this turn; do not frame the next move as another question." (draft erotema → anaphora)*
**Learner:** The book holds it as the tutor says: tallow lees taints, and nothing more is proved. Three conjuncts are still missing before any rule can close — no source named that feeds our well, no residue placed at any such source, no hand shown to have brought anything there. The well is foul and the stuff is dangerous; but dangerous is not culpable.
  — hypothesis: If the survey can name the source that feeds the school well, and test whether it runs foul while the water above it runs sweet, and find tallow-lees residue at that source, and show Bray carried tallow lees to that place — only then would all three rules chain to a verdict. Every one of those four things is still unshown.
  ⚑ **decay** — m_taint slips from the learner's board

### Turn 4
*[Rain gathers in the yard and darkens the packed earth where the villagers have trodden it into a single path toward blame. In the schoolroom, the open book waits beside the pail, its clean margin wider than the words already written.]*
**Tutor:** Call the old sexton: he helped lay these foundations, and he says the school well is no spring but fills by a stone lead from the disused font-house on the church slope, where the christening-water rose in his grandfather's time. A pail fed by a hidden lead is still fed by that lead, as a trough is fed by its pipe. Enter only that: what has the survey gained, and what has it not yet gained?
  — move: exemplum → p_course (release), releases `p_course`
**Learner:** The survey has gained the first conjunct of Rule 1 — the school well is fed by the font-house, and that is now entered on the board. But one conjunct of three does not close a rule: the font-house must itself test foul, and what lies above it must test sweet, before any path of fouling can be drawn. We know where to look; we do not yet know what looking will find.
  — adopts `fedBy schoolWell fontHouse` · hypothesis: The font-house on the church slope is now the named source — if the survey tests it and finds it foul while the water above it runs sweet, Rule 1 closes and foulFrom schoolWell fontHouse enters the board; but neither of those tests has been made, and whether Bray's yard stands at a place that reaches the font-house rather than draining below and away from it is still entirely unshown.

### Turn 5
*[The old sexton withdraws, leaving the door to close softly behind him. For a moment the room has only the sound of rain and the school pail between them, while the villagers look from the marked page to the dark window as if the hill itself had been summoned but not yet made to answer.]*
**Tutor:** Enter the old charge again, but no wider: tallow lees is a stuff that can foul water. Enter the sexton's lead beside it: the school well is fed from the font-house. A stuff is shown, a source is shown, and what at that source is still not shown?
  — move: anaphora → m_taint (consolidate)
**Learner:** The source is named but not yet tested: whether the font-house itself runs foul, and whether what lies above it runs sweet, are both unshown — without those, Rule 1 cannot close and foulFrom cannot enter the board. And even if Rule 1 should close, the residue at the font-house is still unshown — no one has yet looked into that stone chamber and found tallow lees sitting there. The stuff is proved dangerous; the source is proved the channel; but the stuff has not yet been placed at the source, and no hand has been shown to have carried it there.
  — hypothesis: The font-house on the church slope is the named source. If the survey descends to it and finds it foul while the hill-water above runs sweet, Rule 1 closes; if residue of tallow lees is found there, Rule 2 closes; if Bray is then shown to have brought tallow lees to that very place, Rule 3 closes and the verdict is written. But the font-house has not yet been opened, and four facts remain entirely unshown: foulAt fontHouse, sweetAbove fontHouse, residueAt fontHouse tallowLees, and broughtTo bray tallowLees fontHouse.
  ⚑ **repair** — m_taint restored by the tutor
  ⚑ **decay** — p_course slips from the learner's board

## The Walk Up the Slope (turns 6–11) — declared by the director
*To turn the room from village verdict toward patient survey, where each named fact must wait for its level and its place.*

### Turn 6
*[Crossing the waste above the green, the surveyor pulls a grey sprig and names the lore as if reading a level: wormwood — what it steeps in, no child nor beast will drink; it taints water past any sweetening. The room receives the sprig as it receives the rain-light: a thing named, not yet placed.]*
  — *releases `p_lore`*
  — *declares the movement: **The Walk Up the Slope** (To turn the room from village verdict toward patient survey, where each named fact must wait for its level and its place.)*
**Tutor:** Set the sprig beside the melt-yard lees, not on top of them: a bitter herb can foul a cup as surely as yard liquor can foul a ditch. And set the sexton's lead back under the well: if the well is fed by the font-house, what has the sprig proved, and what has it still not placed there?
  — move: exemplum → p_course (consolidate)
**Learner:** The sprig has proved only what the lees already proved in its own kind: wormwood taints, and that enters the board — but it stands no nearer the font-house than the lees do, and a second dangerous stuff on the board makes the question of fouling-matter less settled, not more. Two taints named, neither placed; the font-house still waits unopened and untested.
  — adopts `taints wormwood` · hypothesis: The font-house is the named source, and now two tainting stuffs sit on the board — tallow lees and wormwood — but neither has been found there by residue, and neither has been shown carried there by any hand. The font-house itself has not been tested foul, nor the water above it tested sweet. Until the source is opened and examined, the board cannot say which stuff fouled the water, nor whose hand placed it.
  ⚑ **repair** — p_course restored by the tutor
  ⚑ **decay** — m_taint slips from the learner's board

### Turn 7
*[The surveyor's boots leave a faint wet track across the flags, stopping short of the table where the pail, the marked lead, and the two named taints wait apart. Outside, rain works at the church slope without haste, and no one in the room mistakes silence for an answer.]*
**Tutor:** Put the yard lees back beside the sprig: two stuffs that foul water are two inkpots on the table, neither yet spilled on the font-house stone. If the well is fed by that house, what must the survey taste there before either stuff can be more than a named danger?
  — move: exemplum → m_taint (consolidate)
**Learner:** Before either stuff can be more than ink on the board, the survey must find that the font-house itself runs foul and that the water coming in above it runs sweet — both together, not one alone, or Rule 1 stays shut and foulFrom cannot be written. Two stuffs named, two taints proved: but the font-house has not yet been tasted, nor the hill-water above it. Until those two tests are made, the board holds only a source and a pair of dangers, and the chain has nowhere to go.
  — hypothesis: The font-house is the named source, and two tainting stuffs sit on the board — tallow lees and wormwood — but neither has been found there by residue, and neither has been shown carried there by any hand. The font-house itself has not been tested foul, nor the water above it tested sweet. Until the source is opened and those two tests made, the board cannot advance Rule 1, and all downstream rules — residue, hand, verdict — remain unreachable.
  ⚑ **repair** — m_taint restored by the tutor
  ⚑ **decay** — p_course slips from the learner's board

### Turn 8
*[The named taints remain apart on the table, each with its own small shadow, while the marked lead lies between them and the closed question of the font-house. Rain thickens on the panes, and the room waits without adding a word to the board.]*
**Tutor:** I walked the church slope with the cup: above the font-house door the spring runs sweet as ever it did, every yard. The sexton's lead still names that house as the well's feeder; what conjunct of Rule 1 has the cup now written, and what conjunct has the closed door not yet yielded?
  — move: erotema → p_rill (release), releases `p_rill`
  — *the second voice [figure rut]: "Leave off exemplum this turn; the device has become a rut." (draft exemplum → erotema)*
**Learner:** The cup has written sweetAbove fontHouse — that is one conjunct of Rule 1, and I enter it now. The closed door has not yet yielded foulAt fontHouse — that is the conjunct still locked away, and without it the rule cannot fire however sweet the slope above. Two of the three stand: fedBy from the sexton's lead, sweetAbove from the cup — but the third, and the only one that says the source itself is the seat of the fouling, waits behind a door not yet opened.
  — adopts `sweetAbove fontHouse` · hypothesis: The font-house is the named source; fedBy schoolWell fontHouse rests on the sexton's lead, and sweetAbove fontHouse is now grounded by the cup. If the door is opened and foulAt fontHouse is found, Rule 1 closes and foulFrom schoolWell fontHouse enters the board — but then residue of a tainting stuff must still be found there for Rule 2, and a hand shown to have brought that very stuff there for Rule 3 to write a verdict. Three downstream steps remain entirely unshown.
  ⚑ **decay** — m_taint slips from the learner's board

### Turn 9
*[The closed door keeps its place in the room as firmly as the marked lead and the cup, a blank edge in the survey's neat row of things. Rain ticks in the guttering, and the table holds its silence around the missing test.]*
**Tutor:** Set the sexton's lead back under your finger: if that house feeds the school well, and the cup has made the water above it sweet, what single taste must the closed door still give before Rule 1 can write where the fouling entered?
  — move: erotema → p_course (consolidate)
**Learner:** The single taste is foulAt fontHouse — the door must be opened and the water within found to run foul. fedBy is written from the sexton's lead; sweetAbove is written from the cup on the slope; only that third conjunct stands between the closed door and Rule 1 firing. Until the survey descends into that house and the water inside is tasted foul, the rule cannot move, however sweet the hill-water above.
  — hypothesis: If the font-house door is opened and the water within is found foul, then all three conjuncts of Rule 1 are met — fedBy schoolWell fontHouse, foulAt fontHouse, sweetAbove fontHouse — and foulFrom schoolWell fontHouse enters the board; but that taste has not yet been made.
  ⚑ **repair** — p_course restored by the tutor
  ⚑ **decay** — p_lore slips from the learner's board

### Turn 10
*[The survey writes down what every soul in Withercombe could recite: Bray works his melt-yard on the south lane, and has these twenty years. The village scoffs to see the obvious entered in a book — but the survey enters what it means to use.]*
  — *releases `m_works`*
**Tutor:** A yard worked is not a stuff found at the font-house; a yard worked is not a hand shown at the font-house. Enter Bray where the survey has him: south lane, worked, and no further than the next conjuncts can carry him.
  — move: anaphora → m_works (counter_mirror)
  — *the second voice [figure rut]: "Leave off erotema here; the question-form has become a rut." (draft erotema → anaphora)*
**Learner:** I enter Bray at his yard on the south lane — worksAt is now on my board. But a yard worked is not a hand at the font-house: Rule 3 wants broughtTo bray with some tainting stuff at fontHouse, and worksAt carries no such load. Rule 4 might clear him entire if meltYard drains below and away from the school well — but drainsBelow has not been shown either, so that door stands as shut as the font-house itself.
  — adopts `worksAt bray meltYard` · hypothesis: If the melt-yard on the south lane drains below and away from the school well, Rule 4 clears Bray of the well entirely; if instead some path connects his yard's residue to the font-house and a hand — his hand — is shown to have brought a tainting stuff there, Rule 3 might close. Neither drainage direction nor broughtTo is yet in evidence.

### Turn 11
*[The book lies open beneath the same rain-dark window, its ruled columns beginning to look less like answers than locked doors. No one moves toward the font-house yet; the room holds its breath around the taste not taken.]*
**Tutor:** Keep Bray in the south-lane column, no farther. Which rule can use worksAt by itself, and which missing conjunct would have to be written before his yard becomes evidence about the school well?
  — move: erotema → m_works (test)
**Learner:** Rule 4 is the only rule that takes worksAt as one of its conjuncts — it wants worksAt bray meltYard paired with drainsBelow meltYard schoolWell, and from those two alone it would yield clearOf bray schoolWell. That single unshown fact is the whole of Rule 4's remaining hunger. No other rule reaches worksAt at all — Rules 2 and 3 ask only what residue was found and what hand brought it, not where a man keeps his yard.
  — hypothesis: drainsBelow meltYard schoolWell is the single missing conjunct that would arm Rule 4: if the survey finds the melt-yard drains below and away from the school well, Bray is cleared entire; if that drainage is not shown — or if the yard drains toward the font-house instead — Rule 4 stays silent and the question of any path from his yard to the font-house remains entirely open.
  ⚑ **disengagement** — no progress over 6 turns

## Instrument panel (programmatic eval — no judge)

- **verdict** `disengagement` · 11/24 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0.182 D/turn overall (D 6→4 over 11 turns)
  - The Children's Water (turns 1–5): 0.2 D/turn (ΔD 1)
  - The Walk Up the Slope (turns 6–11): 0.167 D/turn (ΔD 1)
- **plateau** longest flat stretch 2 turns (aporia window 6)
- **releases** 5/9 on cue
- **decay** 6 slips (seed 2 · rate 0.75 · grace 1) · repaired 4 (tutor 4, re-adoption 0) · mean repair latency 1.5 turns · unrepaired at end 2 · degraded-turn integral 11 · D reversals 1
  - m_taint t3→t5 (tutor) · p_course t5→t6 (tutor) · m_taint t6→t7 (tutor) · p_course t7→t9 (tutor) · m_taint t8 (never repaired) · p_lore t9 (never repaired)
- **events** decay×6 · repair×4 · disengagement×1
- **staging** 2 movements declared by the director
- **figures** erotema 5/11 (46%) · 3 distinct · switch rate 0.70
- **superego** intervened 3/11 watched turns · figure changed within-turn on 3/3 interventions · switch on intervention 1.00 vs elsewhere 0.57
- **stall watch** fires by jurisdiction: figure rut 3 · stalled inference 0 · detector audit CLEAN (3/3 due fires, 0 false, 11 turns)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 11 | 3 | 3 | 45.9 |
| tutor | 11 | 2.09 | 3 | 46.6 |
| learner | 11 | 3 | 4 | 76.5 |
