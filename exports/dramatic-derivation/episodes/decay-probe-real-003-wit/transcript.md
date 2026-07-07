# The School Well — decay-probe-real-003-wit

> world `world_004_withercombe` · verdict **cap_reached** · 15/24 turns

```
D= 6 ●●●··│······│··│··
D= 5    ●●│······│··│··
D= 4      │●●····│··│··
D= 3      │  ●●●●│··│●●
D= 2      │      │●●│  
D= 1      │      │  │  
D= 0      │      │  │  
turn      +│    1 │  │ + (+=5, digit=x10)
rel    ▲ ▲ │▲ ▲ ▲ │▲ │▲  (▲ = evidence released)
slope 0.20 D/turn overall (D 6→3); per movement: 1 0.20 │ 2 0.33 │ 3 0.50 │ 4 -0.50
```

## The First Smell (turns 1–5) — declared by the director
*To let suspicion gather before any proof enters, making the room feel the foulness before it understands it.*

### Turn 1
*[The schoolroom stands close and listening; a pail sits under the high window, untouched, while rain ticks faintly at the sill. The benches hold their breath as though the room itself has heard the question and will not yet answer.]*
  — *declares the movement: **The First Smell** (To let suspicion gather before any proof enters, making the room feel the foulness before it understands it.)*
**Tutor:** Set the day-book open, but do not let it judge. What have we proved so far: a foul school well since Lady-Day, or Bray's hand in it?
  — move: erotema → — (orient)
**Learner:** The day-book says the well ran foul from Lady-Day, and the parish knows Bray keeps a melt-yard on the south lane — but knowing and proving are not the same lesson, are they. We have no source named, no residue measured, no path of water drawn. The board holds three facts and they do not yet touch one another under any rule I was given.
  — hypothesis: Bray's melt-yard may be the source that feeds the school well foul, but no exhibit yet grounds a drainage path, a residue, or a bringing of taint to any named source.

### Turn 2
*[A murmur from the benches rises into the room's close air: "No one need teach Withercombe what a melt-yard steeps: grave-water and tallow lees, liquor that would taint a river past any sweetening. What Bray's yard holds would foul water — and there the village case stands, twenty years strong."]*
  — *releases `m_taint`*
**Tutor:** A cup may be poisoned by tallow lees, yet the cup is not accused until the lees are shown in it. What has the murmur added to your board: the power of the stuff to taint, or its road into the school well?
  — move: exemplum → m_taint (consolidate)
**Learner:** The murmur has given us one true thing: that tallow lees taints water — that I will enter on the board, for it stands on its own ground. But it has not given us tallow lees at any source, nor a source that feeds the school well, nor Bray's hand carrying anything anywhere. The power of the stuff to harm is proved; its road to our well is not.
  — adopts `taints tallowLees` · hypothesis: Bray's melt-yard steeps tallow lees and may have a drain or seepage path to a source feeding the school well — but no exhibit yet grounds fedBy, foulAt, sweetAbove, residueAt, worksAt, drainsBelow, or broughtTo for any named source or place.

### Turn 3
*[The room settles after the murmur, each bench-board creaking once and then keeping still. Outside, the rain slackens to a thin patter, and the open day-book lies under the tutor's hand without turning a page.]*
**Tutor:** A sharp liquor proves only what it can do, not where it has gone. If the book holds the foul well and the tainting stuff, which rule can fire, and which conjunct is still empty?
  — move: erotema → m_taint (test)
**Learner:** Rule Two is the one I reach for: it wants foulFrom, residueAt, and taints — and taints tallowLees is already sitting on the board. But foulFrom is itself the child of Rule One, which needs fedBy, foulAt, and sweetAbove, and all three of those slots are empty. The chain is stopped at its very first link, not in the middle of it.
  — hypothesis: If a surveyor were to find a named source feeding the school well, mark it foul while the water above it runs sweet, and find tallow-lees residue at that source, Rule One and Rule Two could both fire — but every conjunct of Rule One remains ungrounded, so the chain has no place to start.

### Turn 4
*[The tutor's chalk rests against the board without making a mark. A draught slips under the schoolroom door, lifts the corner of one loose paper, and lets it fall back where it was.]*
**Tutor:** Then call old Hobb the sexton from the back bench; he helped lay the school foundations, and says the well is no spring of its own. It fills by a stone lead from the disused font-house on the church slope, where the christening-water rose in his grandfather's time. A trough fed by a pipe is not judged until we know what stands at the pipe's head; what new conjunct has his memory put on your board?
  — move: exemplum → p_course (release), releases `p_course`
**Learner:** Hobb has given us the first link we needed — fedBy schoolWell fontHouse is now grounded on the sexton's own memory of the stone lead. Rule One can take that conjunct and hold it; but it still wants foulAt fontHouse and sweetAbove fontHouse before it yields anything. The chain has a named start-place at last; it is not yet a chain.
  — adopts `fedBy schoolWell fontHouse` · hypothesis: The font-house on the church slope is now named as the source feeding the school well; if the survey finds foulAt fontHouse and sweetAbove fontHouse, Rule One can fire and yield foulFrom schoolWell fontHouse — but both of those conjuncts remain wholly ungrounded.

### Turn 5
*[Old Hobb is led back to his bench, and the space he leaves seems colder than before. The chalked words already on the board stand plain in the dim schoolroom light, while the unfilled spaces around them draw every eye.]*
**Tutor:** A lead names the road, not the dirt in the road. If the school well is fed from the font-house, what has Hobb proved, and what two cups must still be brought before Rule One may speak?
  — move: exemplum → p_course (consolidate)
**Learner:** Hobb has proved only the road itself — fedBy schoolWell fontHouse is on the board, and nothing more. Rule One wants two cups still empty: foulAt fontHouse, which asks the survey to taste or test the water at the font-house head, and sweetAbove fontHouse, which asks that the water higher on the slope be found clean, so the fouling cannot have crept down from somewhere above. Until those two are filled, the font-house is only a named place on the stone lead, not yet a source of harm.
  — hypothesis: The font-house on the church slope is the named source feeding the school well; if the survey samples water at the font-house and finds it foul, and samples the water above the font-house on the church slope and finds it sweet, Rule One will yield foulFrom schoolWell fontHouse — but both foulAt fontHouse and sweetAbove fontHouse remain wholly ungrounded and must come from the survey's own observation, not from memory or report.

## The Walk Up the Slope (turns 6–11) — declared by the director
*To move the room from ready suspicion into the survey's patient climb, where named places and named substances begin to ask for measurements.*

### Turn 6
*[Crossing the waste above the green, the surveyor pulls a grey sprig and names the lore as if reading a level: wormwood — what it steeps in, no child nor beast will drink; it taints water past any sweetening. The sprig lies on his open palm while the party stands in the wind above Withercombe.]*
  — *releases `p_lore`*
  — *declares the movement: **The Walk Up the Slope** (To move the room from ready suspicion into the survey's patient climb, where named places and named substances begin to ask for measurements.)*
**Tutor:** One taint from the melt-yard, one taint from the waste; neither yet tells us where the school water took harm. Put wormwood on the board as another stuff that can foul water, and then say what Rule One still lacks before any stuff may matter.
  — move: anaphora → p_lore (consolidate)
  — *the second voice [figure rut]: "Leave off exemplum this turn; it has become a figure rut." (draft exemplum → anaphora)*
**Learner:** I enter wormwood beside tallow-lees as a second stuff that taints — the surveyor's palm has given us that much. But Rule One does not ask after stuff at all; it asks only foulAt fontHouse and sweetAbove fontHouse, and neither cup is yet filled. Until the survey's own eye and vessel settle those two, it does not matter whether the harm is wormwood or tallow-lees or any other thing — the stuff only enters with Rule Two, and Rule Two cannot speak until Rule One has spoken first.
  — adopts `taints wormwood` · hypothesis: The wormwood from the waste above the green, like tallow-lees from the melt-yard, is now a named tainting stuff — if residue of either were found at the font-house after Rule One fires, Rule Two could name the matter; but both remain without a grounded place to lodge until foulAt fontHouse and sweetAbove fontHouse are entered from the survey's direct observation.

### Turn 7
*[The wind presses at the schoolroom shutters, and a few flecks of dried mud fall from the surveyor's boots onto the floorboards. On the table the empty cups wait beside the chalk, their rims catching the grey light while no hand yet reaches for them.]*
**Tutor:** Good; the sprig gives the book a second possible matter, not a place. If two bitter things can taint water, what keeps either from becoming the finding before the font-house cups are filled?
  — move: erotema → p_lore (consolidate)
**Learner:** Neither stuff can become a finding because Rule Two demands foulFrom schoolWell fontHouse as its first conjunct — and that fact is not on the board. A tainting stuff named is not a tainting stuff placed; it only matters once it lodges at a source the well is already proved to draw from fouled. Both tallow-lees and wormwood float as possibilities, but a possibility is not a finding. The gate is Rule One, and its cups are still empty.
  — hypothesis: Either tallow-lees from Bray's melt-yard or wormwood from the waste above the green might prove to be the tainting matter found at the font-house — but neither can be named the finding until foulAt fontHouse and sweetAbove fontHouse are grounded by the survey's direct observation, allowing Rule One to yield foulFrom schoolWell fontHouse, which Rule Two then requires before any stuff on the board may speak.

### Turn 8
*[The schoolroom holds its breath around the untouched cups. Rain ticks faintly at the glass, and the surveyor's damp cloak darkens the chair-back while the chalk marks on the board wait without addition.]*
**Tutor:** I took the cup up the church slope myself: above the font-house door the spring runs sweet as ever it did, every yard of it. Enter that beside the stone lead, and tell me which cup Rule One still waits for.
  — move: exemplum → p_rill (release), releases `p_rill`
**Learner:** I enter sweetAbove fontHouse — the tutor's own cup on the church slope has given us that. Rule One now holds two of its three conjuncts: fedBy schoolWell fontHouse and sweetAbove fontHouse both stand grounded. The one cup still empty is foulAt fontHouse — until the survey's own vessel is dipped at the font-house door and found wanting, the rule cannot speak.
  — adopts `sweetAbove fontHouse` · hypothesis: If the survey's cup dipped at the font-house itself returns foul water, foulAt fontHouse will be grounded and Rule One will yield foulFrom schoolWell fontHouse — but that conjunct is still wholly ungrounded and must come from direct observation, not inference.

### Turn 9
*[The surveyor sets the cup back upon the table without filling it, and the room hears only the small wooden sound. Outside, the rain steadies on the sill while the chalked course of the water waits in its unfinished line.]*
**Tutor:** Two cups can make a boundary, but only one of yours is full. With the lead entered and the upper water sweet, what single fact must the font-house itself give before the survey may move from course to cause?
  — move: erotema → — (test)
**Learner:** The one fact still wanting is foulAt fontHouse — the survey's own cup dipped at the font-house door and returned foul. sweetAbove fontHouse is entered and fedBy schoolWell fontHouse has stood since turn four; those two conjuncts of Rule One are full. But Rule One will not speak unless all three cups are filled, and that third cup can only be filled by the survey's direct observation at the font-house itself — not by report, not by the school day-book, not by any nose. Until the cup comes back foul, the course stays unfinished and the cause cannot be named.
  — hypothesis: If the survey's cup dipped at the font-house itself returns foul water, foulAt fontHouse will be grounded and Rule One will yield foulFrom schoolWell fontHouse — but that conjunct is still wholly ungrounded and must come from direct observation, not inference.

### Turn 10
*[The survey writes down what every soul in Withercombe could recite: Bray works his melt-yard on the south lane, and has these twenty years. The village scoffs to see the obvious entered in a book — but the survey enters what it means to use.]*
  — *releases `m_works`*
**Tutor:** Entered is not proved: the book now gives only that Bray works at the melt-yard. Which conjunct on your rules does that fill for turning the school well foul, and which place-fact at the font-house is still missing before any source can be named?
  — move: erotema → m_works (consolidate)
**Learner:** worksAt bray meltYard fills the first conjunct of Rule Four — which is the clearOf rule, not the turnedFoul rule. For Rule Three to name Bray's hand, the board needs broughtTo bray [some matter] fontHouse, and a works-at is not a brought-to. The place-fact still missing before any source may be named is foulAt fontHouse — the survey's own cup dipped at the font-house door and returned foul. Until that third cup of Rule One is filled by direct observation, nothing downstream can speak.
  — adopts `worksAt bray meltYard` · hypothesis: worksAt bray meltYard is now grounded and fills one conjunct of Rule Four (clearOf) — but Rule Four would clear Bray if drainsBelow meltYard schoolWell were also entered; and Rule Three requires broughtTo bray [matter] fontHouse, which a works-at fact does not supply. foulAt fontHouse remains the single missing conjunct of Rule One; until it is grounded by the survey's direct sample at the font-house, the entire chain from Rule One through Rule Three is still silent.

### Turn 11
*[The ink dries beside the last entry while the cup remains untouched, its rim catching a thin grey light from the window. No one moves toward the door; the room waits on a measurement it has not yet earned.]*
**Tutor:** Set the rule in order: fed by the font-house, sweet above the font-house, and the font-house itself still unmeasured. Bray at his yard belongs to another rule until a level gives it work to do; no hand, no stuff, no verdict can enter before that cup is on the board.
  — move: anaphora → m_works (consolidate)
  — *the second voice [figure rut]: "Leave off erotema for this turn; do not cast the next move as another question." (draft erotema → anaphora)*
**Learner:** The board is unchanged and the cup still untouched. Two conjuncts of Rule One stand — fedBy schoolWell fontHouse and sweetAbove fontHouse — but the third, foulAt fontHouse, has no exhibit to fill it. Until the survey walks to the font-house door and returns its own sample foul, the course cannot close and no cause may be named.
  — hypothesis: foulAt fontHouse remains the single missing conjunct of Rule One; if the survey's direct sample at the font-house returns foul water and is entered on the board, Rule One will yield foulFrom schoolWell fontHouse and the chain through Rules Two and Three may then proceed — but every step downstream depends on that one ungrounded fact.

## The Cup at the Door (turns 12–13) — declared by the director
*To break the room from its long waiting and carry the survey's own cup the last distance to the font-house door — where the course climbed must at last close into cause, or stay open forever.*

### Turn 12
*[The surveyor caps the inkwell, sets the empty cup atop the closed book, and stands — and behind, the bench empties as the village reads the gesture and rises with it. Through the open door the lane shows pale and climbing; no foot has touched it yet, but the room has turned its whole body toward the font-house.]*
  — *declares the movement: **The Cup at the Door** (To break the room from its long waiting and carry the survey's own cup the last distance to the font-house door — where the course climbed must at last close into cause, or stay open forever.)*
**Tutor:** Inside the font-house, the trough gives its own witness: foul in the cup, foul on the stone, with a grey-green crust dried along the rim where the water has stood and gone down. A trough fed by a pipe does not foul the pipe above it; set that cup beside sweet-above and fed-by, and tell me what place the first rule now fixes.
  — move: exemplum → p_basin (release), releases `p_basin`
**Learner:** The cup returns foul, and now all three conjuncts of Rule One stand together on the board — fed by the font-house, sweet above it, foul at it. The rule fixes the place: the fouling entered the school well at the font-house, and nowhere else. But the board stops there: Rule Two still wants residueAt fontHouse with some named matter, and the grey-green crust the tutor names has not yet been entered as an exhibit.
  — adopts `foulAt fontHouse` · derives `foulFrom schoolWell fontHouse` · hypothesis: The grey-green crust on the font-house rim may prove to be tallow-lees or wormwood — if it is entered as residueAt fontHouse with a named tainting matter, Rule Two will name what tainted the well — but the crust has not yet been formally exhibited.
  ⚑ **decay** — m_taint slips from the learner's board
  ⚑ **decay** — p_course slips from the learner's board

### Turn 13
*[Inside the font-house the air holds close and stone-cold; the foul cup stands at the trough's edge, where the grey-green rim has dried to a tide-mark of its own slow going-down. The village crowds the doorway and comes no further, the threshold held like a caught breath — and the surveyor looks long at the rim, and does not yet put a hand to it.]*
**Tutor:** The sexton's lead is still the first line in the book: the school well is fed from the font-house. Put that lead beside sweet water above and foul water within; what question has the rule finished, and what kind of question is left at the trough rim?
  — move: exemplum → p_course (consolidate)
**Learner:** Rule One has finished the question of place — fedBy, sweetAbove, and foulAt all stand on the board, and the derived fact foulFrom schoolWell fontHouse is already on the record. What the trough rim holds is a different question entirely: not where, but what — what matter left that grey-green crust, and does it carry a name the board already knows as tainting? That is not a question the rules can answer from inside themselves; it is a question for a scraper and a nose, or an apothecary's test.
  — hypothesis: The grey-green crust dried at the font-house trough rim is the residue Rule Two requires — if the survey can formally exhibit it as residueAt fontHouse with a named tainting matter already on the board (such as wormwood), Rule Two will yield taintedWith schoolWell that matter; but the crust is still unexhibited and its identity unnamed.
  ⚑ **repair** — p_course restored by the tutor
  ⚑ **decay** — p_lore slips from the learner's board

## The Ground's Arithmetic (turns 14–15) — declared by the director
*To set the surveyor's levels against the ready grudge and let the village's verdict die of arithmetic, not mercy — so that no hand the slope clears can stand accused, and the inquiry is forced to turn from what ails the well toward what matter, and at the font-house, whose.*

### Turn 14
*[The surveyor sets the level to his eye and sights back down the long slope to the melt-yard below, then reads the figure to the open book: the yard lies a full two fathoms beneath the well-head, its sump draining away south to the brook. He chalks the finding flat across the slate — water does not climb — and at the door the village's certainty goes out of the room as quietly as the foul water went down the stone.]*
  — *releases `m_drain`*
  — *declares the movement: **The Ground's Arithmetic** (To set the surveyor's levels against the ready grudge and let the village's verdict die of arithmetic, not mercy — so that no hand the slope clears can stand accused, and the inquiry is forced to turn from what ails the well toward what matter, and at the font-house, whose.)*
**Tutor:** Set the level beside Bray's yard in your book: works-at is one line, drains-below is another. If water does not climb, what happens to the village's old path from yard to well?
  — move: erotema → m_drain (consolidate)
**Learner:** The level speaks plainly: worksAt bray meltYard stands on the board, and drainsBelow meltYard schoolWell now joins it — Rule Four fires, and the board writes clearOf bray schoolWell. The yard cannot have climbed two fathoms to the font-house; the village's certainty had the wrong direction in it. The crust on the trough rim is still the only thread left, and it points nowhere yet — but it no longer points at Bray.
  — adopts `drainsBelow meltYard schoolWell` · derives `clearOf bray schoolWell` · hypothesis: The grey-green crust dried at the font-house trough rim is the residue Rule Two requires — but with Bray now cleared by Rule Four, whoever brought tainting matter to the font-house is someone the village has not yet named; the crust's identity and the hand behind it remain wholly ungrounded.

### Turn 15
*[On the slate the chalked figure stands where the grudge used to stand, and no one at the door lifts a hand to wipe it off — the melt-yard talk has simply gone out of them, leaving a roomful of people who came to lay blame and find their hands empty. The surveyor folds the level and sets it against the wall; the cold comes up off the stone, and the light in the doorway has begun to lean toward the afternoon. Only the rim keeps its place through all of it — the grey-green tide-mark untouched, outlasting the whole village's certainty, and still the one thing in the room no one has yet asked to name.]*
**Tutor:** Let the chalked level lie; it has spent the village's path, not named the trough. What must be entered from that rim before Rule Two may speak of the stuff at all?
  — move: erotema → — (consolidate)
**Learner:** Rule Two wants two things from that rim, not one: residueAt fontHouse naming the matter, and taints naming that same matter as one that spoils water. The crust is still unexhibited and its identity unspoken — until both lines are entered from a scraper and a nose or an apothecary's word, Rule Two cannot open its mouth at all. The place is fixed; the matter is the blank.
  — hypothesis: The grey-green crust dried at the font-house trough rim is the residue Rule Two requires — but until the survey formally exhibits both residueAt fontHouse [named matter] and taints [that matter], Rule Two is silent; and with Bray now cleared by Rule Four, whoever brought that matter to the font-house is a hand the board has not yet named at all.

## Instrument panel (programmatic eval — no judge)

- **verdict** `cap_reached` · 15/24 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0.2 D/turn overall (D 6→3 over 15 turns)
  - The First Smell (turns 1–5): 0.2 D/turn (ΔD 1)
  - The Walk Up the Slope (turns 6–11): 0.333 D/turn (ΔD 2)
  - The Cup at the Door (turns 12–13): 0.5 D/turn (ΔD 1)
  - The Ground's Arithmetic (turns 14–15): -0.5 D/turn (ΔD -1)
- **plateau** longest flat stretch 3 turns (aporia window 6)
- **releases** 7/9 on cue
- **decay** 3 slips (seed 3 · rate 0.75 · grace 1) · repaired 1 (tutor 1, re-adoption 0) · mean repair latency 1 turns · unrepaired at end 2 · degraded-turn integral 6 · D reversals 1
  - m_taint t12 (never repaired) · p_course t12→t13 (tutor) · p_lore t13 (never repaired)
- **events** decay×3 · repair×1
- **staging** 4 movements declared by the director
- **figures** erotema 7/15 (47%) · 3 distinct · switch rate 0.71
- **superego** intervened 2/15 watched turns · figure changed within-turn on 2/2 interventions · switch on intervention 1.00 vs elsewhere 0.67
- **stall watch** fires by jurisdiction: figure rut 2 · stalled inference 0 · detector audit CLEAN (2/2 due fires, 0 false, 15 turns)
- **inference** 2 voiced · stall integral 0 · overreach 0 · mischanneled 0 — `foulFrom schoolWell fontHouse` available t12 → voiced t12 (latency 0) · `clearOf bray schoolWell` available t14 → voiced t14 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 15 | 3.07 | 4 | 51.7 |
| tutor | 15 | 2.07 | 3 | 42.9 |
| learner | 15 | 3.2 | 4 | 74.7 |
