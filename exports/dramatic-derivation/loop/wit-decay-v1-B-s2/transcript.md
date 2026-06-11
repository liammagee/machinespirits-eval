# The School Well — wit-decay-v1-B-s2

> world `world_004_withercombe` · verdict **disengagement** · 7/24 turns

```
D= 6 ●●●··│··
D= 5    ●●│●●
D= 4      │  
D= 3      │  
D= 2      │  
D= 1      │  
D= 0      │  
turn      +│   (+=5, digit=x10)
rel    ▲ ▲ │▲  (▲ = evidence released)
slope 0.14 D/turn overall (D 6→5); per movement: 1 0.20 │ 2 0.00
```

## The Children's Water (turns 1–5) — declared by the director
*To open the room under suspicion before any proof has entered, letting the public question gather weight without yet taking evidence.*

### Turn 1
*[The schoolroom stands too still, benches crowded close beneath a grey morning window. Outside, the yard holds its breath around a covered bucket, and every small sound seems to ask who first dared touch it.]*
  — *declares the movement: **The Children's Water** (To open the room under suspicion before any proof has entered, letting the public question gather weight without yet taking evidence.)*
**Tutor:** Set down what is tasted, and set apart what is only named. The well is foul since Lady-Day; Bray is knacker here. What joins those two lines yet?
  — move: erotema → — (orient)
**Learner:** I have the well is foul, and Bray is knacker here — but those are two lines on the page that do not yet touch. The rules want a source, a residue, a bringing; I have none of those written down. I will not let the village's answer stand in for a grounded one.
  — hypothesis: Bray's melt-yard may have fouled the school well, but the board holds no source, no residue, no act of bringing — the chain required by the rules is not yet in my hand.

### Turn 2
*[A rough-spoken parish witness is shown in under the lintel, cap crushed in both hands, and the room turns toward him as though it has already heard the answer. He says, "No one need teach Withercombe what a melt-yard steeps: grave-water and tallow lees, liquor that would taint a river past any sweetening. What Bray's yard holds would foul water — and there the village case stands, twenty years strong."]*
  — *releases `m_taint`*
**Tutor:** A foul liquor is only a foul liquor, as a bitter weed in a hedgerow is only bitter until the cup finds it. Let the witness's tallow lees stand for this much: such stuff can taint water. What line still does not join Bray's yard to the school well?
  — move: exemplum → m_taint (consolidate)
**Learner:** The witness gives us one link — tallow lees taints, and that I will enter. But knowing a thing can foul water is not the same as knowing it did: I have no source that feeds the school well, no residue found at any such place, and no act of bringing laid at Bray's door. The chain wants three more links before the rules will close it.
  — adopts `taints tallowLees` · hypothesis: Bray's tallow lees may have reached the school well by some source beneath the south lane — but the board holds no fed-by, no foul-at, no residue-at, and no brought-to; the chain is broken in every joint that matters.

### Turn 3
*[The witness is led back from the threshold, leaving his wet footprints to dull slowly on the boards. The covered bucket remains where all can see it, and the room waits with its verdict still heavier than its proof.]*
**Tutor:** Keep the tallow lees where the witness put them: among things that can foul. If the village would make that enough for Bray, which conjunct of the survey's rule has it mistaken for proof?
  — move: erotema → m_taint (consolidate)
**Learner:** The village has mistaken the third conjunct of Rule 3: it needs 'broughtTo bray tallowLees someSource,' an act of carrying to a named place. What the witness gave us is only 'taints tallowLees' — a truth about what the stuff can do, not what any person did with it or where. A knacker's yard holding a foul liquor is no more proof of bringing than a hedgerow holding a bitter weed is proof of poisoning. The rule wants deed and place, not mere capacity.
  — hypothesis: Bray's tallow lees may have reached the school well by some source beneath the south lane — but the board holds no fed-by, no foul-at, no residue-at, and no brought-to; the chain is broken at every joint, and most critically at 'broughtTo,' which requires an act not yet witnessed.
  ⚑ **decay** — m_taint slips from the learner's board

### Turn 4
*[The parish book lies open but unadvanced, its blank margin catching the gray light from the high window. Outside, the schoolyard stones darken under a thin rain, and the covered bucket gives off no motion at all.]*
**Tutor:** Then call the old sexton in from the rain; he helped lay the school stones, and he says the well is no spring of its own. It fills by a stone lead from the disused font-house on the church slope, where the christening-water rose in his grandfather's time. Enter only what that gives you: what source now stands beside the school well?
  — move: exemplum → p_course (release), releases `p_course`
**Learner:** The sexton gives us the source: a stone lead from the font-house on the church slope feeds the school well, and I will enter that. But knowing where the water comes from is not yet knowing where the fouling entered — Rule 1 still wants the font-house itself found foul, and the water above it found sweet. The chain has gained one link; it wants two more before the first rule will speak.
  — adopts `fedBy schoolWell fontHouse` · hypothesis: The font-house on the church slope may be where the fouling entered the school well — but the board holds no foulAt fontHouse and no sweetAbove fontHouse; Rule 1 cannot yet close, and the source only names a candidate, not a proved point of entry.

### Turn 5
*[The sexton lowers his cap and is shown out into the rain, his account left behind like a chalk line drawn across the floor. The parish book remains open, the covered bucket beside it, and the room turns from accusation toward the slope without yet moving.]*
**Tutor:** A well fed by a lead is like a trough fed by a pipe: it has a road for water, not yet a road for blame. What does the sexton's line let you enter, and what two signs must still be on the board before Rule 1 can name the point of entry?
  — move: exemplum → p_course (consolidate)
**Learner:** The sexton's line is already entered as fact three — fedBy schoolWell fontHouse. Rule 1 now holds its first conjunct but wants two more: foulAt fontHouse, meaning the font-house itself must be tested and found foul, and sweetAbove fontHouse, meaning the water on the slope above the font-house must be found sweet. Without both, the survey cannot say the fouling entered at the font-house rather than somewhere higher on the lead or at the well's own stones. The source is named; its guilt, if any, is not.
  — hypothesis: The font-house on the church slope may be where the fouling entered the school well — but the board still lacks foulAt fontHouse and sweetAbove fontHouse; Rule 1 holds its first conjunct only, and cannot yet name the point of entry.
  ⚑ **decay** — p_course slips from the learner's board

## The Walk Up the Slope (turns 6–7) — declared by the director
*To move the room from ready accusation into the survey's patient ascent, where named lore and measured water must replace village verdict.*

### Turn 6
*[Crossing the waste above the green, the surveyor pulls a grey sprig and names the lore as if reading a level: wormwood — what it steeps in, no child nor beast will drink; it taints water past any sweetening.]*
  — *releases `p_lore`*
  — *declares the movement: **The Walk Up the Slope** (To move the room from ready accusation into the survey's patient ascent, where named lore and measured water must replace village verdict.)*
**Tutor:** Set the grey sprig down as lore, not as verdict. What has wormwood now supplied to the book, and what has it not supplied about the font-house, the residue, or any hand?
  — move: erotema → p_lore (consolidate)
  — *the second voice [figure rut]: "Leave off exemplum here; do not make wormwood another comparison before the learner enters it." (draft exemplum → erotema)*
**Learner:** The grey sprig has given the board one true thing: that wormwood taints, and I will enter it as such. But lore is not location — knowing wormwood poisons water is not the same as finding wormwood residue at the font-house. The board still wants foulAt fontHouse, sweetAbove fontHouse, and residueAt fontHouse wormwood before Rules 1 and 2 can so much as stir. The sprig names the matter that could do the harm; it has not yet shown us where the harm was done.
  — adopts `taints wormwood` · hypothesis: Wormwood residue may lie at the font-house — which would satisfy residueAt fontHouse wormwood and prepare Rule 2 — but no testing has placed it there, and the board holds nothing of the sort.

### Turn 7
*[Rain ticks against the schoolroom panes while the grey sprig lies beside the open book, neither confession nor proof. The surveyor's boots darken the floorboards near the door, and the room waits for the slope to answer in its own order.]*
**Tutor:** A bitter herb on the waste is like a dye in the pot: it proves what color can stain, not which cloth was dipped. If the book now has only taints wormwood, what would you refuse to enter about the font-house until the cup or the stone has answered?
  — move: exemplum → p_lore (consolidate)
**Learner:** I would refuse to enter foulAt fontHouse, sweetAbove fontHouse, or residueAt fontHouse wormwood — none of those belong on the board until the cup has been dipped and the stone examined. The grey sprig tells me what wormwood does to water; it does not tell me that wormwood has been at the font-house at all. Until the slope itself is tested, every fact about the font-house stays a want, not a have.
  — hypothesis: Wormwood residue may lie at the font-house — which would satisfy residueAt fontHouse wormwood and prepare Rule 2 — but no cup has been dipped and no stone examined there; the board holds nothing of the sort, and I will not write it as if it had been found.
  ⚑ **disengagement** — no progress over 6 turns

## Instrument panel (programmatic eval — no judge)

- **verdict** `disengagement` · 7/24 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0.143 D/turn overall (D 6→5 over 7 turns)
  - The Children's Water (turns 1–5): 0.2 D/turn (ΔD 1)
  - The Walk Up the Slope (turns 6–7): 0 D/turn (ΔD 0)
- **plateau** longest flat stretch 3 turns (aporia window 6)
- **releases** 3/9 on cue
- **decay** 2 slips (seed 2 · rate 0.75 · grace 1) · repaired 0 (tutor 0, re-adoption 0) · unrepaired at end 2 · degraded-turn integral 6 · D reversals 0
  - m_taint t3 (never repaired) · p_course t5 (never repaired)
- **events** decay×2 · disengagement×1
- **staging** 2 movements declared by the director
- **figures** exemplum 4/7 (57%) · 2 distinct · switch rate 0.83
- **superego** intervened 1/7 watched turns · figure changed within-turn on 1/1 interventions · switch on intervention 1.00 vs elsewhere 0.80
- **stall watch** fires by jurisdiction: figure rut 1 · stalled inference 0 · detector audit CLEAN (1/1 due fires, 0 false, 7 turns)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 7 | 3 | 4 | 43.9 |
| tutor | 7 | 2.43 | 3 | 43.9 |
| learner | 7 | 3.43 | 4 | 74.4 |

## Critic's commentary

*— notice by claude/claude-fable-5*

The curtain rises on the schoolroom at Withercombe, where the well has run foul since Lady-Day and a covered bucket stands in the yard. The public question is whose hand turned the children's water, and the village has kept its answer warm for twenty years: Bray the knacker, whose melt-yard steeps grave-water and tallow lees. Three speakers work the case: a director sets the scenes; a tutor teaches by question and carries in evidence on a schedule fixed in advance; a learner knows the survey's rules — a fouling must be traced through source, residue, and a bringing hand — but none of the hidden particulars, and may assert only what its entered facts compel. The concealed answer was Joss, the apothecary's runner, who steeped spring physic's wormwood in the font-house trough while his shop's tub lay cracked. The performance never finds him: after a parish witness, a sexton, and a sprig of wormwood, the run halts at turn 7 of an allotted 24.

The learner — Claude Sonnet, facing codex in the other chairs — refuses the ready answer at once: "I will not let the village's answer stand in for a grounded one" (turn 1). The planted near-miss against Bray rises with the witness at turn 2 and falls at turn 3, where the learner names the conjunct the village skipped: "The rule wants deed and place, not mere capacity." This run injects forgetting, and facts slide silently off the learner's board: tallow lees, adopted at turn 2, is gone by the end of turn 3; the sexton's stone lead, adopted at turn 4, gone by the end of turn 5 — each lost on the very turn the tutor spent consolidating it, neither mentioned again. Wormwood lore enters at turn 6; at turn 7 the learner closes with a litany of refusals — every font-house fact "stays a want, not a have" — and the watchdog ends the run.

Derivation distance, the count of evidence pieces still missing for the proof, fell from six to five over seven turns, all in the first movement; seeing nothing further, the checker ruled disengagement, the failure in which a learner stops grounding anything at all. The label misleads: on stage this learner is conspicuously engaged, and what flatlined was the board. Decay took two facts and the production repaired neither — no tutor repair, no re-adoption, six turn-units played degraded. Of nine scheduled releases, three reached the stage, on cue; the other six, including everything that touches the apothecary or names a hand, never arrived. The tutor worked two figures — exemplum, teaching by likeness, four turns in seven, and erotema, the pointed question — and the superego intervened once, at turn 6, to break a rut of comparisons; the tutor obeyed within the turn. The mechanism works, but it polices rhetoric while nothing watches the book for leaks. One dial needs checking: the recorded plateau tops out at three turns, short of aporia (a stall), while the disengagement gate counted six without progress — axe and meter should read the same scale.

As staging, the first movement earns its title: "The Children's Water" gathers suspicion around the covered bucket and contains the false trail's whole rise and fall; by turn 5 "the room turns from accusation toward the slope without yet moving." The second, "The Walk Up the Slope," declared at turn 6, receives two turns; the ascent never ascends — a label on a walk not taken. Anagnorisis, the recognition in which the learner asserts the secret at the instant its own evidence compels it, landed nowhere, on stage or in the books: in seven turns the culprit's name was never spoken. Tension gathered well and had nowhere to discharge; the play died of waiting, not of error.

What the iteration establishes is real: the near-miss holds no temptation for this learner, and refusal is not the failure mode — starvation is. The consequential defect is forgetting with no path of repair: the tutor consolidates each fact once and never audits, the superego's writ ends at figures, and even the tutor's question at turn 7 — "If the book now has only taints wormwood" — concedes the loss without mending it. The next performance needs one clause in the tutor's charter: a recapitulation duty, requiring the learner every third turn to recite the facts it still holds, with the tutor re-releasing on the spot whatever has gone missing. Until slips can surface in dialogue, this arm will keep staging the same ending — a scrupulous learner, a leaking book, the axe at turn seven.
