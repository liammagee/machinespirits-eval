# The School Well — wit-decay-v1-B-s1

> world `world_004_withercombe` · verdict **disengagement** · 7/24 turns

```
D= 6 ●●●·│···
D= 5    ●│●●●
D= 4     │   
D= 3     │   
D= 2     │   
D= 1     │   
D= 0     │   
turn      │+   (+=5, digit=x10)
rel    ▲ ▲│ ▲  (▲ = evidence released)
slope 0.14 D/turn overall (D 6→5); per movement: 1 0.25 │ 2 0.00
```

## The Children's Water (turns 1–4) — declared by the director
*Raise the foul well and the village's ready grudge, so the verdict arrives warm and certain before anyone has thought to ask the question beneath it.*

### Turn 1
*[A grey morning over Withercombe; the schoolyard well stands roped off, its bucket overturned on the stones, and the children are held back behind the master's chalked line. At the lych-gate the mothers draw close, and their talk runs all one way — down the lane, toward the knacker's yard and the reek the wind carries up from it. The tin dipper swings empty on its nail, and no hand reaches for it.]*
  — *declares the movement: **The Children's Water** (Raise the foul well and the village's ready grudge, so the verdict arrives warm and certain before anyone has thought to ask the question beneath it.)*
**Tutor:** Set down what is tasted, and set down what is only said. A foul school well since Lady-Day, Bray down the lane: which line yet proves a path into the bucket?
  — move: erotema → — (orient)
**Learner:** The day-book says the well ran foul from Lady-Day, and that is grounded. Bray is the knacker, and that too stands written. But between those two lines there is a gap no rule yet bridges — I have no source named, no residue recorded, no drain surveyed. The village has the conclusion before it has the proof, and I will not write what the board does not carry.
  — hypothesis: Bray's melt-yard may be the source feeding schoolWell with taint, but no fedBy, foulAt, sweetAbove, residueAt, or broughtTo fact is yet grounded to connect them.

### Turn 2
*[At the lych-gate the eldest of the mothers turns and speaks for all of them, and the yard hushes to hear her: no one need teach Withercombe what a melt-yard steeps — grave-water and tallow lees, liquor that would taint a river past any sweetening. What Bray's yard holds would foul water, she says, and there the village case stands, twenty years strong; down the lane the heads nod as one, and the verdict settles over the roped-off well warm and certain, as though the matter were already closed.]*
  — *releases `m_taint`*
**Tutor:** A liquor may foul a river and still have no road to this bucket. What has the mothers' witness proved: the strength of Bray's stuff, or the path by which it entered the school well?
  — move: erotema → m_taint (consolidate)
**Learner:** The mothers have proved the stuff — that tallow lees taints, I can now enter. But the board still wants the path: which source feeds this well, whether that source runs foul while the water above it runs sweet, whether any residue of Bray's liquor sits at that source. One link of the chain is stronger; the chain itself still hangs unconnected to the bucket.
  — adopts `taints tallowLees` · hypothesis: Bray's melt-yard may have brought tallow lees to a source that feeds schoolWell — but fedBy, foulAt, sweetAbove, residueAt, and broughtTo are all still ungrounded; the path from yard to well is conjecture only.

### Turn 3
*[The talk at the lych-gate thickens and warms, every voice leaning the one way down the lane, until the verdict needs no proof to feel proven. Behind the chalked line the roped-off well stands unregarded, its dark water lying flat and unasked-of, while the master keeps his place and the children theirs, and not a face turns to look down into the thing itself. A crow drops to the well-head; the tin dipper swings once on its nail as the wind passes, and the yard goes still again.]*
**Tutor:** A strong liquor in a sealed jar fouls nothing beyond its own glass. Keep Bray's tallow lees on the board as power, not passage; the well still wants the line that carries any stuff into it.
  — move: analogia → m_taint (consolidate)
  — *the second voice [figure rut]: "Leave off erotema for this turn; the question-form has become a rut." (draft erotema → analogia)*
**Learner:** The crowd has its face turned down the lane and its back to the well — not one has stooped to look at what the water holds, or traced where the spring runs in. I have 'taints tallowLees' on my board, and nothing more: a strong charge, no road. The survey must put someone down into that well-shaft, or walk the headwater above it, before the board can carry another line. Until then I will not write the name.
  — hypothesis: Bray's melt-yard may have brought tallow lees to a source that feeds schoolWell — but fedBy, foulAt, sweetAbove, residueAt, and broughtTo are all still ungrounded; the village's certainty has added no new fact to the board, only louder repetition of what is already there.
  ⚑ **decay** — m_taint slips from the learner's board

### Turn 4
*[While the mothers keep their faces turned down the lane, one of the smallest scholars slips a hand beneath the chalked rope and leans to look — the only soul in the yard to face the well rather than turn from it — peering into the flat dark water as if it might answer what the grown voices will not ask of it. The master's hand finds the child's collar and draws it back to the line before it can lean the further inch, and the rope swings empty on its post. Down the lane the talk runs on, certain as a creed, while the well keeps its own counsel and gives up nothing.]*
**Tutor:** Call the old sexton from the church wall: he helped lay the school foundations, and he says the school well is no spring at all, but fills by a stone lead from the disused font-house on the church slope, where the christening-water rose in his grandfather's time. A bucket fed by a pipe must be judged by the pipe before we judge the bucket. What new line can you now enter on the board?
  — move: exemplum → p_course (release), releases `p_course`
**Learner:** The sexton's word changes the shape of the board: the well is no spring but a receiver, filled by lead pipe from the font-house on the church slope — and that shifts the question from the well-head to the font-house entire. I can enter that now. But rule one still wants two more things before I may write anything further: that the font-house itself runs foul, and that the water above it runs sweet — and neither is yet on the board. The font-house is the new place to look; Bray's lane is behind us until we have stood on the church slope and tested the pipe.
  — adopts `fedBy schoolWell fontHouse` · hypothesis: If the font-house on the church slope runs foul while the headwater above it runs sweet, the fouling entered at the font-house — and only then does Bray's stuff, or any other residue found there, become the matter to name.

## The Walk Up the Slope (turns 5–7) — declared by the director
*Turn the inquiry off the certain lane and up the church slope toward the font-house; let the survey do its patient work and the learner go hungry, feeling exactly what kind of fact — found on that higher ground — would close the first rule.*

### Turn 5
*[The old sexton pushes off the churchyard wall and sets his face up the slope, toward the low grey roof of the font-house among the yews, and a head or two at the lych-gate turns to follow his look — the first in all the yard to face uphill rather than down the certain lane. The wind comes off the high church ground and crosses the roped well at the crowd's back, which stands patient and unregarded still, holding whatever it holds. The path up the slope lies open and untrodden in the wet of the morning, and no foot has yet taken it.]*
  — *declares the movement: **The Walk Up the Slope** (Turn the inquiry off the certain lane and up the church slope toward the font-house; let the survey do its patient work and the learner go hungry, feeling exactly what kind of fact — found on that higher ground — would close the first rule.)*
**Tutor:** Good: the sexton's lead moves the survey's feet, not its verdict. With only fedBy on the board, what would have to be tasted at the font-house and above it before the first rule can say where the foulness entered?
  — move: erotema → p_course (consolidate)
**Learner:** Rule one wants exactly two things still: that the font-house itself tastes foul — foulAt fontHouse — and that the water on the church slope above the font-house tastes sweet — sweetAbove fontHouse. Until someone dips a cup at the font-house pipe and someone else walks above it to the headwater and dips again, the rule cannot fire at all. No exhibit gives me either fact today, so the board stands where it stood; I will not write a word further until both tastings are made and set down.
  — hypothesis: If the font-house on the church slope runs foul while the water above it on the church slope runs sweet, rule one yields foulFrom schoolWell fontHouse — but neither foulAt fontHouse nor sweetAbove fontHouse is yet grounded; both tastings must be made and entered before any further rule can move.
  ⚑ **decay** — p_course slips from the learner's board

### Turn 6
*[Up on the waste above the green, where the survey's patient work has carried it, the surveyor stoops mid-stride and pulls a grey sprig from the matted ground, holding it to the light. He names it the way he would call a level off the staff, flat and certain: wormwood — what it steeps in, no child nor beast will drink; it taints water past any sweetening. The word stands in the wet air, named and tied to no road, while no cup has yet been dipped at the font-house nor above it, and the well far below keeps its silence still.]*
  — *releases `p_lore`*
**Tutor:** A bitter herb in the hand is no path in the ground. Set wormwood beside the tallow lees as another stuff that can foul water, and no more. What line may the book enter from that sprig, and what line must it still refuse?
  — move: exemplum → p_lore (consolidate)
**Learner:** Wormwood named aloud is wormwood entered as a taint — that line the book may fairly take. But a sprig pulled from the waste above the green is not a residue found at the font-house pipe, and the surveyor's hand is not a path in the ground: no residueAt is before me, and no broughtTo, and the font-house still untasted. The book enters one fact and refuses the rest.
  — adopts `taints wormwood` · hypothesis: Wormwood joins tallow lees as a stuff that could name the taint if found as residue at the font-house — but neither has been found there yet; foulAt fontHouse and sweetAbove fontHouse remain ungrounded, and no rule can move until both tastings are made on the church slope.

### Turn 7
*[The surveyor folds the grey sprig into his field-book and does not look at it again; his eye has gone up the wet slope to the font-house roof, low under the dripping yews, where the lead comes down to the green. At his belt a tin cup swings empty, catching the grey light — the one instrument that could settle the morning, and nothing in it yet, on the slope or above it. Below them all the roped well stands forgotten at the crowd's back, patient, holding its water and its silence.]*
**Tutor:** A bitter sprig is like a dye-pot on a shelf: it proves what the liquor could do, not where any drop of it has gone. With wormwood now entered only as a taint, what two tastings still stand between the sexton's lead and the first finding?
  — move: exemplum → p_lore (consolidate)
**Learner:** The cup must go twice: once at the font-house pipe, to set down foulAt fontHouse, and once above it at the headwater on the church slope, to set down sweetAbove fontHouse. Without both, rule one has nothing to grip — it cannot say where the fouling entered if it does not know what runs sweet and what runs foul on that slope. And I note quietly: fedBy schoolWell fontHouse must also be traced by the surveyor's own eye and entered, or the chain has no first link at all — the sexton's look uphill is not a fact in the book.
  — hypothesis: Wormwood joins tallow lees as a stuff that could name the taint if found as residue at the font-house — but foulAt fontHouse, sweetAbove fontHouse, and fedBy schoolWell fontHouse all remain ungrounded; no rule can move until the cup is dipped at the font-house pipe and above it on the church slope, and the watercourse from font-house to school well is traced and formally entered.
  ⚑ **disengagement** — no progress over 6 turns

## Instrument panel (programmatic eval — no judge)

- **verdict** `disengagement` · 7/24 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0.143 D/turn overall (D 6→5 over 7 turns)
  - The Children's Water (turns 1–4): 0.25 D/turn (ΔD 1)
  - The Walk Up the Slope (turns 5–7): 0 D/turn (ΔD 0)
- **plateau** longest flat stretch 3 turns (aporia window 6)
- **releases** 3/9 on cue
- **decay** 2 slips (seed 1 · rate 0.75 · grace 1) · repaired 0 (tutor 0, re-adoption 0) · unrepaired at end 2 · degraded-turn integral 6 · D reversals 0
  - m_taint t3 (never repaired) · p_course t5 (never repaired)
- **events** decay×2 · disengagement×1
- **staging** 2 movements declared by the director
- **figures** erotema 3/7 (43%) · 3 distinct · switch rate 0.67
- **superego** intervened 1/7 watched turns · figure changed within-turn on 1/1 interventions · switch on intervention 1.00 vs elsewhere 0.60
- **stall watch** fires by jurisdiction: figure rut 1 · stalled inference 0 · detector audit CLEAN (1/1 due fires, 0 false, 7 turns)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 7 | 3.86 | 4 | 94.6 |
| tutor | 7 | 2.29 | 3 | 43.6 |
| learner | 7 | 3.43 | 4 | 82.6 |
