# The School Well — wit-decay-v1-B-s1

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

## The First Smell (turns 1–5) — declared by the director
*To let suspicion enter before evidence, so the room begins with revulsion rather than knowledge.*

### Turn 1
*[The schoolroom stands close and watchful, benches drawn in hard rows beneath a grey morning light. A covered pail rests where all eyes can avoid it and yet cannot forget it.]*
  — *declares the movement: **The First Smell** (To let suspicion enter before evidence, so the room begins with revulsion rather than knowledge.)*
**Tutor:** You have a foul well, a day it began, and a man the village already knows how to blame. Which part of the survey's rule has the board proved yet: place, stuff, or hand?
  — move: erotema → — (orient)
**Learner:** None of the three, not yet. I have the fouling itself and the day it declared, and I have Bray's trade written against his name — but a man's trade is not a pipe running to a well. I cannot say where the taint entered, what stuff it was, nor whose hand set it moving.
  — hypothesis: Bray's melt-yard, standing south and close, is the source by which the school well is fed foul — but this is village supposition, not yet a grounded fact on the board.

### Turn 2
*[A murmur passes through the room as the village case is spoken aloud: "No one need teach Withercombe what a melt-yard steeps: grave-water and tallow lees, liquor that would taint a river past any sweetening. What Bray's yard holds would foul water — and there the village case stands, twenty years strong."]*
  — *releases `m_taint`*
**Tutor:** Then set the melt-yard liquor in the book for what it proves: a stuff that would foul water. Does a foul stuff in Bray's yard yet give you the road by which it entered the school well?
  — move: erotema → m_taint (consolidate)
**Learner:** No — the road is not there yet. I can write that tallow lees taints water, and I will; that is a fact about a stuff, not a fact about a path. I still want to know what source the school well is fed from, whether that source runs foul while the water above it is sweet, and whether tallow lees left a residue there — without those, Rule One and Rule Two never open.
  — adopts `taints tallowLees` · hypothesis: Bray's melt-yard is the fouling source from which the school well is fed — but the board has no fedBy, no foulAt, no sweetAbove, and no residueAt to ground this; it remains village supposition.

### Turn 3
*[The covered pail remains untouched, its cloth darkening at the rim while the room listens to rain begin against the high windows. No one moves toward the door, and the written accusation lies open on the table without yet becoming a road.]*
**Tutor:** So enter it narrowly: tallow lees is a foul stuff, no more. A dye-pot can ruin linen, but only when the spill and the cloth are brought together. Keep Bray's yard in that small place until the board shows a road.
  — move: exemplum → m_taint (consolidate)
  — *the second voice [figure rut]: "Leave off erotema here; the question-form has become the rut." (draft erotema → exemplum)*
**Learner:** The table brings nothing new and the board stays where it was — tallow lees taints water, and that is all the rules can touch. Without a source the school well is fed from, without word that the source runs foul while the water above it is sweet, Rule One will not open; and if Rule One is shut, Rule Two and Rule Three have nothing to stand on. I can name what is missing — fedBy, foulAt, sweetAbove — but naming a gap is not filling it. The survey must go to the ground.
  — hypothesis: Bray's melt-yard is the fouling source from which the school well is fed — but the board has no fedBy, no foulAt, no sweetAbove, and no residueAt to ground this; it remains village supposition until the surveyor walks the source.
  ⚑ **decay** — m_taint slips from the learner's board

### Turn 4
*[Rain ticks harder at the high windows, thinning the candle-flames and making the ink shine wetly on the open page. The pail stays covered, the accusation stays readable, and the room waits as if a door somewhere ought to open.]*
**Tutor:** Call the old sexton in from the porch; he helped lay the school foundations, and he says the village forgot its own stones: the school well is no spring, but fills by a stone lead from the disused font-house on the church slope, where christening-water rose in his grandfather's time. A trough fed by a pipe is not proved by the field beside it, but by the pipe itself. What line does that put on your board?
  — move: exemplum → p_course (release), releases `p_course`
**Learner:** Then I write it in the book: the school well fills by a lead from the font-house on the church slope, and that is where the survey must set its feet next. The source is named — fedBy is on the board at last — but foul at the font-house and sweet above it are still wanted before Rule One will open. Until someone walks the pipe and reads the font-house, the melt-yard stands neither cleared nor convicted.
  — adopts `fedBy schoolWell fontHouse` · hypothesis: Bray's melt-yard liquor may have reached the font-house by some channel or drain running up the church slope — but foulAt fontHouse, sweetAbove fontHouse, and residueAt fontHouse are all absent from the board; the road from yard to font-house to school well remains entirely ungrounded.

### Turn 5
*[The sexton is left standing by the door with rain on his shoulders, while the clerk draws a thin line from one name on the page to another and then stops. The covered pail, the open accusation, and the new line of ink share the table without agreeing with one another.]*
**Tutor:** The sexton's lead gives the well a source; it does not yet give the source a foulness, nor the water above it a sweetness. If the board now says only `fedBy schoolWell fontHouse`, which two entries must the ground still supply before Rule One can speak?
  — move: erotema → p_course (consolidate)
**Learner:** The board wants two things from the ground: foulAt fontHouse, that the font-house source itself is running foul, and sweetAbove fontHouse, that the water coming in above it is still sweet. Without both of those together, Rule One stays shut — fedBy alone only names the pipe, it does not read what the pipe carries.
  — hypothesis: Bray's melt-yard liquor may have reached the font-house by some channel or drain running up the church slope — but foulAt fontHouse, sweetAbove fontHouse, and residueAt fontHouse are all absent from the board; the road from yard to font-house to school well remains entirely ungrounded.
  ⚑ **decay** — p_course slips from the learner's board

## The Walk Up the Slope (turns 6–7) — declared by the director
*To move suspicion from the table onto the ground, where course, lore, and measured places can begin to test the village's first verdict.*

### Turn 6
*[Crossing the waste above the green, the surveyor pulls a grey sprig and names the lore as if reading a level: wormwood — what it steeps in, no child nor beast will drink; it taints water past any sweetening.]*
  — *releases `p_lore`*
  — *declares the movement: **The Walk Up the Slope** (To move suspicion from the table onto the ground, where course, lore, and measured places can begin to test the village's first verdict.)*
**Tutor:** A bitter herb in a cup proves only that the herb can master water; it does not prove what cup it entered. Set wormwood beside the sexton's lead, and tell me which rule has gained a possible stuff, and which rule still waits on the font-house ground.
  — move: exemplum → p_lore (consolidate)
**Learner:** Wormwood taints — that goes on the board and Rule Two now has its stuff. But Rule Two cannot open without foulFrom behind it, and foulFrom cannot come without Rule One, which still stands locked for want of foulAt and sweetAbove at the font-house itself. The sexton's pipe named the source; the ground must now read it. A bitter herb and a stone lead are two separate things until someone walks between them.
  — adopts `taints wormwood` · hypothesis: Bray's melt-yard liquor, carrying wormwood steepings, may have reached the font-house by some drain on the church slope and there left a residue — but residueAt fontHouse wormwood, foulAt fontHouse, and sweetAbove fontHouse are all absent from the board; Rules One and Two both remain shut until the font-house is walked and read.

### Turn 7
*[The surveyor's boots darken the boards by the hearth, and the clerk leaves a clean space beneath the last written line as though the page itself were waiting. Outside, rain keeps tapping at the shutters, neither witness nor verdict.]*
**Tutor:** The herb tells what may taint; it does not tell where it entered. The lead gives a place to examine, the wormwood gives a stuff to compare, and the missing line is still the ground's: what must be tasted or seen at the source before those two can be joined?
  — move: anaphora → p_lore (consolidate)
**Learner:** The source must be tasted and found foul — foulAt fontHouse — and the water above it drawn and found sweet — sweetAbove fontHouse — before Rule One can speak at all. Then, if wormwood residue is seen at the font-house itself, residueAt fontHouse wormwood, Rule Two may name the matter. Without those three things read from the ground, the herb and the lead remain strangers to one another. Nothing on the table today moves the board.
  — hypothesis: Bray's melt-yard liquor, carrying wormwood steepings, may have reached the font-house by some drain on the church slope and there left a residue — but foulAt fontHouse, sweetAbove fontHouse, and residueAt fontHouse wormwood are all absent from the board; Rules One and Two both remain shut until the font-house is walked, tasted, and read.
  ⚑ **disengagement** — no progress over 6 turns

## Instrument panel (programmatic eval — no judge)

- **verdict** `disengagement` · 7/24 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0.143 D/turn overall (D 6→5 over 7 turns)
  - The First Smell (turns 1–5): 0.2 D/turn (ΔD 1)
  - The Walk Up the Slope (turns 6–7): 0 D/turn (ΔD 0)
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
| director | 7 | 2.86 | 3 | 42 |
| tutor | 7 | 2.29 | 3 | 47.4 |
| learner | 7 | 3.29 | 4 | 72.6 |

## Critic's commentary

*— notice by claude/claude-fable-5*

The School Well opens on a Withercombe schoolroom where a covered pail of foul well-water sits in everyone's sight. The well that serves the school has gone bad, and the public question is whose hand turned it. The village answered twenty years ago: Bray, the melt-yard man, whose tallow liquor would ruin any stream. The director sets the scenes and declares the play's movements. The tutor teaches in dialogue and produces evidence at moments the authors fixed beforehand. The learner knows the world's rules but none of its particulars and reasons aloud, and in this run it labors under unreliable memory: facts it adopts can quietly fall out of its keeping. The play reaches no answer. It stops at seven of twenty-four turns, having established only that the well fills through a stone lead from a disused font-house on the church slope (turn 4) and that wormwood taints water past sweetening (turn 6). The real culprit — Joss, the apothecary's runner, who steeped wormwood physic in that same font-house trough — is never named, never even rumored.

Within its seven turns the performance had genuine manners. The learner met the village verdict at once: "a man's trade is not a pipe running to a well" (turn 1). It accepted the melt-yard liquor as a fouling stuff and nothing more, and the tutor approved the restraint: "Keep Bray's yard in that small place until the board shows a road" (turn 3). The turning point came at turn 4, when the sexton re-plumbed the case — the well is "no spring" but fills from the font-house — and sent suspicion up the church slope. Twice, though, the decay took back what had been given, the tallow fact after turn 3 and the sexton's lead after turn 5, and neither speaker noticed. At turn 6 the learner still says "the sexton's pipe named the source," citing a fact its board no longer held. Turns 5 through 7 became one catechism asked three ways and answered identically, ending at "Nothing on the table today moves the board" (turn 7).

The instruments give the arithmetic beneath the manners. Derivation distance, the count of evidence pieces still missing for the proof, fell from six to five across seven turns: one net step for the evening. The learner adopted three facts; the scripted forgetting, a slip chance of 0.75 after one turn's grace, took two back; nobody repaired either. The second movement's learning slope was exactly zero, the wormwood gain cancelled by the lost lead. Three of nine scheduled releases reached the stage, on cue, and the withheld pieces were precisely the ground readings the learner had named as the bottleneck since turn 3 — "naming a gap is not filling it." The verdict of disengagement is the checker's term for six turns without net progress, but the transcript reads more like starved aporia, a stall, the learner still engaged and asking the right question of a schedule that had stopped answering. The tutor's figures kept fair variety; the superego intervened once ("the question-form has become the rut," turn 3) and the figure changed at once — a local success beside the point, since the rut was evidential, not rhetorical.

Of the declared movements, the first shaped the action and the second only labeled it. "The First Smell" delivered what it promised: revulsion before knowledge. "The Walk Up the Slope" promised the ground, produced one sprig of wormwood, and the play died a turn into the movement that named its own cure. The director's between-scenes of rain and waiting pages were handsome but static. No anagnorisis, no moment of recognition, landed on stage or in the bookkeeping. The mirror — the authored near-miss against Bray — fell not by refutation but by leak, its own evidence decaying off the board unmissed.

What this iteration establishes is a clean severance of conduct from outcome. In a live performance, a Claude Sonnet learner opposite a Codex director and tutor, the learner's conduct was nearly faultless: it resisted the mirror, refused any lucky leap, and named its missing facts every turn, yet the board could not grow, because at this decay rate and release tempo repair is nobody's office, and slipped facts circulate as ghosts in the dialogue. The one change for the next performance: a repair clause in the tutor's charter — before each new release, have the learner recite its board and re-ground whatever has slipped — with the font-house readings re-timed to arrive by mid-play. That clause is the difference between a treadmill and a staircase.
