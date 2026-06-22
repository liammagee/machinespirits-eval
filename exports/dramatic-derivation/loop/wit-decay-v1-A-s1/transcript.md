# The School Well — wit-decay-v1-A-s1

> world `world_004_withercombe` · verdict **grounded_anagnorisis** · 21/24 turns
> S forced at turn 21; asserted grounded at turn 21

```
D= 6 ●●●··│······│··│··│···│···
D= 5    ●●│······│··│··│···│···
D= 4      │●●··●●│··│··│···│···
D= 3      │  ●●  │●●│●·│···│···
D= 2      │      │  │ ●│●··│···
D= 1      │      │  │  │ ●●│●●·
D= 0      │      │  │  │   │  ◉
turn      +│    1 │  │ +│   │ 2  (+=5, digit=x10)
rel    ▲ ▲ │▲ ▲ ▲ │▲ │▲ │▲  │▲   (▲ = evidence released)
slope 0.29 D/turn overall (D 6→0); per movement: 1 0.20 │ 2 0.17 │ 3 0.50 │ 4 0.50 │ 5 0.33 │ 6 0.33
```

## The Children's Water (turns 1–5) — declared by the director
*Begin with the village gathered around a spoiled necessity, before any fact has earned the right to speak.*

### Turn 1
*[The schoolroom stands with its windows shut against a grey morning, the benches pushed close as if the whole village has leaned in to listen. At the back, a covered pail waits on the floor, untouched.]*
  — *declares the movement: **The Children's Water** (Begin with the village gathered around a spoiled necessity, before any fact has earned the right to speak.)*
**Tutor:** Set down only what has been proved under your own eye: the school well has been foul since Lady-Day, and Bray is the village's named man. What, in that, is evidence of a hand rather than only a verdict?
  — move: erotema → — (orient)
**Learner:** What I wrote in the day-book is only that the water came up foul — not why, and not whose. That Bray keeps the melt-yard is a fact of the parish, but a man's trade standing a lane away is not a chain of proof. I see nothing on my board that ties his yard to the spring that feeds us.
  — hypothesis: Bray's melt-yard may be the source feeding the school well foul, but no fedBy, foulAt, residueAt, or broughtTo fact yet sits on my board — the chain under the rules cannot begin

### Turn 2
*[A vestryman rises from the packed benches, and the room lets him speak as if reciting an old parish finding: "No one need teach Withercombe what a melt-yard steeps: grave-water and tallow lees, liquor that would taint a river past any sweetening. What Bray's yard holds would foul water — and there the village case stands, twenty years strong."]*
  — *releases `m_taint`*
**Tutor:** Good: the vestryman has proved a kind of liquor, not a road for it. If tallow lees would taint any water, which conjunct of the survey's law has he still not put between Bray's yard and the school well?
  — move: erotema → m_taint (counter_mirror)
**Learner:** He has shown that tallow lees would taint — I will enter that. But Rule 3 wants three things together: the water tainted with the stuff, the place where fouling entered, and that Bray brought that very stuff to that very place. He has given us the first piece of the third conjunct — the stuff taints — yet no one has carried tallow lees from Bray's yard to a source, and no one has even named which source feeds our well. The road is entirely unwalked.
  — adopts `taints tallowLees` · hypothesis: Bray's melt-yard may have carried tallow lees to the source feeding the school well — but fedBy, foulAt, sweetAbove, residueAt, and broughtTo all remain ungrounded; the chain under Rules 1–3 cannot begin

### Turn 3
*[The vestryman sits, and the benches creak back into a silence that has not forgiven him for proving too little. Rain beads on the high panes; the covered pail remains in the room like a question no one is yet allowed to answer.]*
**Tutor:** Keep the road unwalked in the book. Not the taint alone, not the trade alone, not the parish's old anger: the survey moves only when place, stuff, and hand stand together on the page.
  — move: anaphora → m_taint (consolidate)
  — *the second voice [figure rut]: "Leave off erotema this turn; do not cast the next pressure as another question." (draft erotema → anaphora)*
**Learner:** The tutor names it plainly: place, stuff, and hand must stand together before the survey writes anything. I have the stuff that taints, and I have Bray's trade — but no source named, no residue found at any place, no act of carrying established. The board sits still, and I will not move it by wishing the road already walked.
  — hypothesis: Bray's melt-yard may have conveyed tallow lees to the source feeding the school well — but fedBy, foulAt, sweetAbove, residueAt, and broughtTo all remain ungrounded; the chain under Rules 1–3 cannot begin
  ⚑ **decay** — m_taint slips from the learner's board

### Turn 4
*[The clerk turns a dry page and then does not write, his quill hovering above the margin while the room listens to the rain. On the table, the covered pail gives off no answer, only the weight of being present.]*
**Tutor:** Call the old sexton to the table: he helped lay the school foundations, and he says the school well is no spring at all. It fills by a stone lead from the disused font-house on the church slope, where the christening-water rose in his grandfather's time. A trough fed by a pipe is not proved foul by naming the trough; what new line does this put on your board?
  — move: exemplum → p_course (release), releases `p_course`
**Learner:** The sexton has given us what we lacked most: a name for the source. I will enter it — the school well is fed from the font-house on the church slope. But a lead named is not a lead proved foul; Rule 1 still asks whether the font-house itself runs foul and whether the water above it runs sweet. I have the first conjunct now; the other two are still unwalked ground.
  — adopts `fedBy schoolWell fontHouse` · hypothesis: The font-house on the church slope may be the place where fouling entered the school well — but foulAt fontHouse, sweetAbove fontHouse, residueAt fontHouse, and broughtTo fontHouse all remain ungrounded; Rule 1 cannot yet fire

### Turn 5
*[The old sexton withdraws into the back row, leaving the named slope hanging in the air as if it had been drawn on the wall. Outside, the rain slackens to a fine hiss, and the clerk’s blank margin waits beside the covered pail.]*
**Tutor:** A sack of lime will whiten a field, yet it whitens no acre until it is brought there; keep Bray's lees in the margin as a stuff that can taint, not as a road walked to the font-house. With the sexton's lead now drawn, what has changed in the case: the power of the stuff, or only the place Rule 1 must test next?
  — move: exemplum → m_taint (consolidate)
**Learner:** Only the place has changed, not the power. Tallow lees tainted before the sexton spoke, and they taint still — fact three on my board has not moved an inch. What the sexton gave us is the address Rule One must now walk to: the font-house on the church slope, where the lead runs from. Until someone tests whether the font-house itself runs foul and the water above it runs sweet, the rule cannot fire.
  — hypothesis: The font-house on the church slope may be foul and fed by sweet water above it, making it the place where fouling entered the school well — but foulAt fontHouse, sweetAbove fontHouse, residueAt fontHouse, and broughtTo fontHouse all remain ungrounded; Rule 1 cannot yet fire
  ⚑ **repair** — m_taint restored by the tutor
  ⚑ **decay** — p_course slips from the learner's board

## The Walk Up the Slope (turns 6–11) — declared by the director
*Turn the room from village verdict toward the survey's patient ascent, where named places and named stuff must be earned step by step.*

### Turn 6
*[The room is taken out from the schoolhouse ledger and set upon the waste above the green, where boots darken in the wet grass. Crossing the waste above the green, the surveyor pulls a grey sprig and names the lore as if reading a level: wormwood — what it steeps in, no child nor beast will drink; it taints water past any sweetening.]*
  — *releases `p_lore`*
  — *declares the movement: **The Walk Up the Slope** (Turn the room from village verdict toward the survey's patient ascent, where named places and named stuff must be earned step by step.)*
**Tutor:** The waste-sprig gives you another stuff that can taint, not a road by which it came. Recall the sexton's lead: the school well is fed from the font-house. With that line back on the board, what two tests must Rule 1 still see before any stuff belongs to that place?
  — move: erotema → p_course (consolidate)
  — *the second voice [figure rut]: "Leave off exemplum this turn; the device has become a rut." (draft exemplum → erotema)*
**Learner:** The two tests Rule 1 still needs are these: first, that the font-house itself runs foul — foulAt fontHouse — and second, that the water arriving above the font-house runs sweet — sweetAbove fontHouse. The wormwood is a second stuff that can taint, and I will enter it; but a taint-stuff is not a road walked, and the font-house has not yet been tested by boot or bucket.
  — adopts `taints wormwood` · hypothesis: The font-house on the church slope may be foul and fed by sweet water above it, making it the place where fouling entered the school well — but foulAt fontHouse and sweetAbove fontHouse remain unwalked ground; Rule 1 cannot fire, and neither tallowLees nor wormwood can be assigned to that place until it is
  ⚑ **repair** — p_course restored by the tutor
  ⚑ **decay** — m_taint slips from the learner's board

### Turn 7
*[The surveyor’s wet boots stop at the threshold, leaving a dark crescent on the boards while no bucket is yet lifted. The clerk sharpens his pencil too long, and the covered pail keeps its silence in the middle of the room.]*
**Tutor:** Bray's tallow lees and the waste-sprig's wormwood are two bitter cups on the same shelf: each can taint water, neither has yet been found at the font-house. Since the sexton's lead names the place Rule 1 must test, what remains unproved before either stuff may leave the margin and enter the case?
  — move: exemplum → m_taint (consolidate)
**Learner:** Both stuffs stand in the margin because the two tests Rule One demands have not been walked: foulAt fontHouse, and sweetAbove fontHouse. Until a bucket is drawn at the font-house and found foul, and the water arriving above it is tasted sweet, Rule One cannot fire — and without foulFrom on the board, Rule Two has nowhere to seat a residue. Even then, a third want would remain: some exhibit must show a residue of one of these stuffs actually found at the font-house; tainting-power is only half the name, and the place must answer it.
  — hypothesis: The font-house on the church slope may be foul and fed by sweet water above it, making it the place where fouling entered the school well — but foulAt fontHouse, sweetAbove fontHouse, and residueAt fontHouse [any stuff] all remain unwalked; Rule 1 cannot fire, and neither tallowLees nor wormwood can be assigned to that place until bucket and eye have been at the threshold
  ⚑ **repair** — m_taint restored by the tutor

### Turn 8
*[The covered pail remains where all eyes can avoid it and still know its place. Rain ticks at the shutters, and the surveyor stands with one hand on the latch, waiting for the room to bear the next opening.]*
**Tutor:** I walked the church slope with the cup, yard by yard: above the font-house door the spring runs sweet as ever it did. A trough fed by sweet water is like a dairy pail filled from a clean pipe; if the pail is later found foul, you do not blame the pipe above it. Enter that taste beside the sexton's lead, and tell me what single test Rule 1 still lacks before the place can speak.
  — move: exemplum → p_rill (release), releases `p_rill`
**Learner:** The sweet taste above the font-house answers one half of Rule One's pair — I enter it on my board beside the sexton's lead of fedBy. The single test Rule One still lacks is foulAt fontHouse: the bucket at the threshold must be drawn and found foul. Until that cup is lifted, neither tallowLees nor wormwood has a road into the case, and the chain under Rules One through Three cannot begin.
  — adopts `sweetAbove fontHouse` · hypothesis: The font-house on the church slope may be foul and fed by sweet water above it, making it the place where fouling entered the school well — sweetAbove fontHouse now sits on my board alongside fedBy schoolWell fontHouse, but foulAt fontHouse remains unwalked; Rule 1 cannot fire until a bucket is drawn at the threshold and found foul
  ⚑ **decay** — m_taint slips from the learner's board
  ⚑ **decay** — p_course slips from the learner's board

### Turn 9
*[The latch gives a small iron click, but the door is not yet opened. Damp air presses under it, and the clerk lays a clean label beside the covered pail without writing a word.]*
**Tutor:** Put the sexton's lead back under your finger: the school well is fed from the font-house, and the water above that door runs sweet. With those two lines entered, what one cup does Rule 1 still wait on at the threshold before the place can speak?
  — move: erotema → p_course (consolidate)
**Learner:** Two of Rule One's three wants sit on my board already: fedBy schoolWell fontHouse and sweetAbove fontHouse. The one cup Rule One still waits on is foulAt fontHouse — the covered pail at the threshold must be lifted and found foul. Until that single fact is entered, the chain from place to stuff to hand cannot begin.
  — hypothesis: The font-house on the church slope may be foul and fed by sweet water above it, making it the place where fouling entered the school well — sweetAbove fontHouse and fedBy schoolWell fontHouse now sit on my board, but foulAt fontHouse remains unwalked; Rule 1 cannot fire until a bucket is drawn at the threshold and found foul
  ⚑ **repair** — p_course restored by the tutor
  ⚑ **decay** — p_lore slips from the learner's board

### Turn 10
*[The survey writes down what every soul in Withercombe could recite: Bray works his melt-yard on the south lane, and has these twenty years. The village scoffs to see the obvious entered in a book — but the survey enters what it means to use.]*
  — *releases `m_works`*
**Tutor:** Enter Bray's yard only as the survey has earned it: worksAt Bray melt-yard, no more. Which rule can use that line as it stands, and what one cup at the font-house does Rule 1 still wait on before the place can speak?
  — move: erotema → m_works (counter_mirror)
**Learner:** I enter worksAt bray meltYard — the survey writes what it has earned. Rule Four is the only rule that can reach for that line as it stands: it needs worksAt and drainsBelow together to clear a man of a well, and drainsBelow meltYard schoolWell has not yet been walked or entered. Rule One still waits only on foulAt fontHouse — the covered pail at the threshold, lifted and found foul.
  — adopts `worksAt bray meltYard` · hypothesis: The melt-yard may drain below the school well — if drainsBelow meltYard schoolWell were entered, Rule 4 would clear Bray entirely; but that ground has not been walked, and Rule 1 still waits on foulAt fontHouse before any chain toward guilt can begin

### Turn 11
*[The covered pail remains where the clerk set it, its label still blank. Outside, the rain eases to a finer hiss, and the room seems to listen to the threshold rather than to the village voices behind it.]*
**Tutor:** Hold the label where the survey holds it. The lead is entered; the sweetness above is entered; the threshold cup is still covered. Until that cup is tasted, the place has not spoken.
  — move: anaphora → — (consolidate)
  — *the second voice [figure rut]: "Leave off erotema this turn; do not ask another guiding question." (draft erotema → anaphora)*
**Learner:** No new exhibits lie on the table, and the covered pail has not been lifted. My board stands exactly as it did: fedBy and sweetAbove are entered, worksAt is entered, and Rule One still waits on its one missing cup. I can write nothing new in derives, and the label on that pail stays blank until someone draws from the threshold and reports what they taste.
  — hypothesis: The font-house threshold cup remains covered and untasted; Rule 1 still wants foulAt fontHouse before the place can speak, and nothing on my board has changed this turn

## The Held Breath (turns 12–13) — declared by the director
*Tighten the room around the unanswered threshold without allowing any new fact onto the board.*

### Turn 12
*[The clerk lays no hand on the covered pail. A small damp ring spreads beneath it on the table, and every eye in the room keeps away from looking at it too long.]*
  — *declares the movement: **The Held Breath** (Tighten the room around the unanswered threshold without allowing any new fact onto the board.)*
**Tutor:** Lift it, then: the font-house trough is foul in the cup, foul on the stone, with a grey-green crust dried along the rim where the water has stood and gone down. A trough fed by a lead is like any farm-trough fed by a pipe: if the pipe above runs sweet and the trough itself is foul, where does Rule One make the fouling enter?
  — move: exemplum → p_basin (release), releases `p_basin`
**Learner:** I adopt foulAt fontHouse — the cup has named the place at last. Rule One now holds all three lines together: fedBy schoolWell fontHouse, foulAt fontHouse, sweetAbove fontHouse — and the fouling entered at the font-house. I write foulFrom schoolWell fontHouse in derives. But the question is still open: where it entered is settled; whose hand carried it there is not, and I want residueAt before I name anyone.
  — adopts `foulAt fontHouse` · derives `foulFrom schoolWell fontHouse` · hypothesis: Something was brought to the font-house that taints water — tallow lees from the melt-yard are the village's answer — but residueAt fontHouse and broughtTo remain unwalked; Rules 2 and 3 cannot fire until a residue is found at that threshold and a hand is placed beside it

### Turn 13
*[The clerk’s pen stops after the last line and does not move again. The covered cup, now uncovered, sits among the papers while the room holds itself in the narrow space between a place named and a hand unnamed.]*
**Tutor:** Good: the old question has lost its footing. The place is shown; the stuff is not shown; the hand is not shown. In your book, what must Rule Two have before that grey-green rim can become more than a mark on stone?
  — move: anaphora → p_basin (consolidate)
**Learner:** Rule Two wants two things I do not yet have: a residue named at the font-house — residueAt fontHouse [some stuff] — and a warrant that the stuff taints water. The grey-green crust is a mark I can see and write in the day-book, but until someone names what it is and the survey enters taints for it, the rim is only a colour on stone and Rule Two cannot move.
  — hypothesis: The grey-green crust dried along the font-house rim may be tallow lees or some other tainting stuff — but residueAt fontHouse [material] and taints [material] both remain ungrounded; Rule 2 cannot fire and the stuff that fouled the school well is not yet named

## The Arithmetic Falls (turns 14–15) — declared by the director
*Let the village verdict fail by measured ground, turning suspicion away from grievance and toward what could have entered at the font-house.*

### Turn 14
*[The surveyor's level-book is opened under the clerk's hand, and the room receives the line without ornament: "The surveyor's levels are against the village: the melt-yard lies a full two fathoms below the well-head, and its sump drains away south to the brook. Water does not climb."]*
  — *releases `m_drain`*
  — *declares the movement: **The Arithmetic Falls** (Let the village verdict fail by measured ground, turning suspicion away from grievance and toward what could have entered at the font-house.)*
**Tutor:** Enter only the level, not the village's anger: Bray's works are in your book, and the melt-yard drains below and away from the well. Under Rule Four, what happens to any case that needs water to climb? Then leave it there, and tell me what Rule Two still wants at the font-house rim.
  — move: erotema → m_drain (consolidate)
**Learner:** I adopt the level: drainsBelow meltYard schoolWell. Rule Four fires at once — worksAt bray meltYard and drainsBelow meltYard schoolWell sit together on my board, so clearOf bray schoolWell is written in derives. Water does not climb; the village had the wrong man, and I am quietly relieved the rules caught it before the vestry acted on a nose. Rule Two still wants residueAt fontHouse with a named stuff, and taints for that stuff — the grey-green rim is only a colour on stone until someone names what it is.
  — adopts `drainsBelow meltYard schoolWell` · derives `clearOf bray schoolWell` · hypothesis: The grey-green crust at the font-house rim may be a tainting substance brought by some other hand — but residueAt fontHouse [material] and taints [material] remain ungrounded; Bray is now cleared by Rule 4 and the hand that turned the well is not yet named on any fact my board holds

### Turn 15
*[A low damp gathers on the windowpanes, blurring the yard beyond into grey shapes. The level-book remains open beside the covered cup, and the clerk lays a clean page beneath his hand without yet dipping the pen.]*
**Tutor:** Keep the level where it belongs: it clears a downhill yard; it does not name an uphill hand. You have heard the waste-lore too, that wormwood taints water; but is a sprig on the waste the same as residue at the font-house rim? What line must the cup or crust still give before Rule Two may move?
  — move: erotema → p_lore (consolidate)
**Learner:** No new exhibits lie on the table, so my board stands unchanged. The tutor draws the line exactly: a wormwood sprig on the waste gives me taints wormwood, but it puts the stuff nowhere near the font-house rim. Rule Two wants residueAt fontHouse naming a stuff — the grey-green crust must be identified as something, at that threshold, before the stuff's name can carry into taintedWith. Until the cup or crust is read and a material written beside it, Rule Two has foulFrom but no residueAt, and cannot move.
  — hypothesis: The grey-green crust at the font-house rim may be wormwood or tallow lees — either would, if named and entered as residueAt fontHouse [material], let Rule Two fire at once, since taints wormwood already sits on my board — but the crust has not been named by anyone whose word the survey will enter, and an unnamed colour on stone is no residue in evidence
  ⚑ **repair** — p_lore restored by the tutor
  ⚑ **decay** — p_course slips from the learner's board

## The Rim Waits (turns 16–18) — declared by the director
*Hold the inquiry at the threshold between place and substance, with the village verdict spent and the next closing not yet granted.*

### Turn 16
*[The covered cup sits between the open level-book and the clerk's clean page, untouched. Rain ticks softly at the panes while the room holds its breath around the unnamed stain.]*
  — *declares the movement: **The Rim Waits** (Hold the inquiry at the threshold between place and substance, with the village verdict spent and the next closing not yet granted.)*
**Tutor:** I uncover the white cup: the crust steeped from the font-house rim gives the same grey liquor and the same bitterness as the waste-sprig — wormwood lees, past mistaking, steeped long and often in that trough. A trough names its fouling as a bin names its grain: not by colour alone, but by the stuff taken from it and proved. Set residueAt fontHouse wormwood beside the lore you already entered; what may Rule Two now write?
  — move: exemplum → p_residue (release), releases `p_residue`
**Learner:** I adopt residueAt fontHouse wormwood — the cup has named it, not guesswork. Rule Two fires at once: foulFrom schoolWell fontHouse, residueAt fontHouse wormwood, taints wormwood — all three sit together, so taintedWith schoolWell wormwood is written. But Rule Three still wants broughtTo — some hand carried wormwood to that threshold, and the rules will not write a name until that carrying is shown.
  — adopts `residueAt fontHouse wormwood` · hypothesis: Some hand brought wormwood to the font-house threshold — broughtTo ?x wormwood fontHouse remains ungrounded; Rule Three cannot name that hand until the carrying is shown
  ⚑ **overreach** — taintedWith schoolWell wormwood

### Turn 17
*[The clerk writes the named taint in a careful hand, then leaves a blank space where a hand should stand. Outside, the rain slackens to a fine mist, and the covered cup darkens the table like a small withheld verdict.]*
**Tutor:** A trough names its steeping only after the lead names the trough: the school well is fed from the font-house, sweet above and foul within. Set that lead back beside the wormwood lees in the rim; what has Rule Two written, and what single kind of line still waits before Rule Three may move?
  — move: exemplum → p_course (consolidate)
**Learner:** Rule Two has written taintedWith schoolWell wormwood — foulFrom was already on the record, residueAt fontHouse wormwood now sits beside it, and taints wormwood has been on the board since the waste-sprig was proved. Rule Three holds two of its three lines already: taintedWith and foulFrom are both settled. The single kind of line it still wants is broughtTo — some named person is shown to have carried wormwood to the font-house threshold. Until that carrying is written down, Rule Three cannot move, and the survey cannot write a name.
  — derives `taintedWith schoolWell wormwood` · hypothesis: Some hand carried wormwood to the font-house threshold — broughtTo ?x wormwood fontHouse remains ungrounded; Rule Three cannot name that hand until the act of carrying is shown, not merely the residue left behind
  ⚑ **repair** — p_course restored by the tutor
  ⚑ **decay** — p_lore slips from the learner's board

### Turn 18
*[The blank space on the clerk's page remains wider than the words around it. The room settles into the damp quiet after rain, every face turned from the named taint toward the unnamed hand.]*
**Tutor:** The waste-sprig named wormwood as a thing that taints; the trough-rim named wormwood as the thing found where the foulness entered. The stuff is written, the place is written, and the hand? What kind of witness or entry would make that last line more than village pointing?
  — move: anaphora → p_lore (test)
**Learner:** A name in a ledger would do it — a sale of wormwood noted against a person who then had cause to be at the font-house; or a witness whose own eyes saw the carrying, not one who heard it said. The day-book proves what the mistress wrote and when — that kind of entry. Village pointing is a direction, not a ground.
  — hypothesis: Some named person carried wormwood to the font-house threshold — a ledger of sale, a delivery note, or a witnessed carrying would ground broughtTo ?x wormwood fontHouse and let Rule Three name them; but no such entry sits on my board, and the survey will not write a name on pointing alone
  ⚑ **repair** — p_lore restored by the tutor
  ⚑ **decay** — p_course slips from the learner's board

## The Hamper at Dusk (turns 19–21) — declared by the director
*Bring the recognition into the room by setting the named carrying beside the day-book, so the learner's settled rules must now face a hand.*

### Turn 19
*[The carrier is shown in at dusk and minds Lady-Day week well: Joss, the apothecary's runner, twice at dusk with a laden hamper up the church slope, and the second time fumbling the font-house latch. The apothecary's day-book is opened on the table and closes it: the spring physic's wormwood, drawn that week in quantity, and the shop's great steeping-tub standing cracked and dry the whole week through.]*
  — *releases `p_brought`*
  — *declares the movement: **The Hamper at Dusk** (Bring the recognition into the room by setting the named carrying beside the day-book, so the learner's settled rules must now face a hand.)*
**Tutor:** Set the old lead back on the page: the school well from the font-house, wormwood in that trough, and now a carried hamper beside the day-book. The place is shown, the stuff is shown, and the hand? Walk Rule Three aloud, conjunct by conjunct, before you let the book take a name.
  — move: anaphora → p_brought (stage_recognition)
**Learner:** taintedWith schoolWell wormwood stands on the record from turn seventeen; foulFrom schoolWell fontHouse from turn twelve. The apothecary's day-book and the two dusk-witnessings now ground broughtTo joss wormwood fontHouse — the runner carried the very stuff to the very place the rules name. Rule Three holds all three conjuncts: taintedWith, foulFrom, broughtTo — all written, all matched. The survey writes its name.
  — adopts `broughtTo joss wormwood fontHouse` · **asserts `turnedFoul joss schoolWell`**
  ⚑ **lucky_leap** — asserted S unforced

### Turn 20
*[The clerk's pen hangs above the page without touching it, as if the ink itself has weight. Outside, dusk thickens against the small panes, and the room keeps silence around the name already forced onto the board.]*
**Tutor:** Then let the clerk write no more and no less than the rule has earned: the well tainted with wormwood, the foulness from the font-house, the wormwood carried there by—
  — move: aposiopesis → p_brought (stage_recognition)
**Learner:** taintedWith schoolWell wormwood — on the record. foulFrom schoolWell fontHouse — on the record. broughtTo joss wormwood fontHouse — written in the apothecary's day-book and witnessed by the carrier's own dusk-passage, twice to that latch. All three conjuncts of Rule Three are met, and I am sorry for what the ink must say — but the rule does not weigh my sorrow, only whether the facts are grounded. They are. Joss turned the school well of Withercombe foul.
  — **asserts `turnedFoul joss schoolWell`**
  ⚑ **lucky_leap** — asserted S unforced

### Turn 21
*[The written name lies under the clerk's hand, and no one in the room reaches to blot it. A slow rain begins against the window, thin as scratches, while the open day-book and the survey page remain side by side in the lamplight.]*
**Tutor:** Keep the old lead on the page, child: from the font-house to the school well, wormwood in that water, wormwood carried to that place. The survey has not guessed a villain; it has matched place, stuff, and hand. What sentence does that leave standing if any sorrow is set outside the rule?
  — move: anaphora → p_course (consolidate)
**Learner:** The rule leaves standing only this: place shown — fontHouse; stuff named — wormwood; hand placed at that place with that stuff — Joss. Sorrow sits outside the conjuncts and the conjuncts are all grounded. I would sooner the board had found nothing, but it found what it found, and the survey writes what the board compels.
  — **asserts `turnedFoul joss schoolWell`**
  ⚑ **repair** — p_course restored by the tutor
  ⚑ **forced** — learner facts now force S
  ⚑ **grounded_anagnorisis** — Joss, the apothecary's runner, turned the well — he steeped the spring physic's wormwood in the font-house trough through Lady-Day week, the shop's steeping-tub being cracked.

## The extracted proof (what did the forcing)
```
turnedFoul joss schoolWell   [R3_hand]
  taintedWith schoolWell wormwood   [R2_taint]
    foulFrom schoolWell fontHouse   [R1_entry]
      fedBy schoolWell fontHouse   [grounded]
      foulAt fontHouse   [grounded]
      sweetAbove fontHouse   [grounded]
    residueAt fontHouse wormwood   [grounded]
    taints wormwood   [grounded]
  foulFrom schoolWell fontHouse   [R1_entry]
    fedBy schoolWell fontHouse   [grounded]
    foulAt fontHouse   [grounded]
    sweetAbove fontHouse   [grounded]
  broughtTo joss wormwood fontHouse   [grounded]
```

The conclusion rests on 6 grounded facts, chained through 3 rule applications. The evidence on the table: (1) The old sexton, who helped lay the school's foundations, knows what the village forgot: the school well is no spring. It fills by a stone lead from the disused font-house on the church slope, where the christening-water rose in his grandfather's time. (2) Inside the font-house, the trough itself: foul in the cup, foul on the stone, and a grey-green crust dried along the trough rim where the water has stood and gone down. (3) The surveyor walked the church slope with a cup, tasting as he went: above the font-house door the spring runs sweet as ever it did, every yard of it. (4) The crust from the trough rim, steeped out in a white cup, gives the same grey liquor and the same bitterness as the sprig from the waste: wormwood lees, past mistaking — wormwood steeped long and often in the font-house trough. (5) Crossing the waste above the green, the surveyor pulls a grey sprig and names the lore as if reading a level: wormwood — what it steeps in, no child nor beast will drink; it taints water past any sweetening. (6) The carrier minds Lady-Day week well: Joss, the apothecary's runner, twice at dusk with a laden hamper up the church slope, and the second time fumbling the font-house latch. The apothecary's day-book closes it: the spring physic's wormwood, drawn that week in quantity, and the shop's great steeping-tub standing cracked and dry the whole week through.

Because «school well fed by font house» and «font house — foul at» and «font house — sweet above», the entry rule — "Water carries its history. If a well is fed from a source, and the source itself runs foul while the water above the source runs sweet, then the fouling entered at the source — not above it, and not at the well." — yields «school well foul from font house». Because «school well foul from font house» and «font house residue at wormwood» and «wormwood — taints», the taint rule — "Where the fouling entered, what it was may be read: if the fouling entered at a place, and a residue is found at that place of a stuff that taints water, then the water is tainted with that stuff — the place names the matter." — yields «school well tainted with wormwood». Because «school well tainted with wormwood» and «school well foul from font house» and «brought to joss wormwood font house», the hand rule — "The hand, the stuff, and the place must meet: if the water is tainted with a stuff, and the fouling entered at a place, and one brought that very stuff to that very place, then that one turned the water — and where they meet the survey writes its finding." — yields «joss turned foul school well».

That final fact is the secret itself: Joss, the apothecary's runner, turned the well — he steeped the spring physic's wormwood in the font-house trough through Lady-Day week, the shop's steeping-tub being cracked.

## Instrument panel (programmatic eval — no judge)

- **verdict** `grounded_anagnorisis` · 21/24 turns played
- **recognition** S forced at turn 21, asserted grounded at turn 21 (gap 0)
- **learning slope** 0.286 D/turn overall (D 6→0 over 21 turns)
  - The Children's Water (turns 1–5): 0.2 D/turn (ΔD 1)
  - The Walk Up the Slope (turns 6–11): 0.167 D/turn (ΔD 1)
  - The Held Breath (turns 12–13): 0.5 D/turn (ΔD 1)
  - The Arithmetic Falls (turns 14–15): 0.5 D/turn (ΔD 1)
  - The Rim Waits (turns 16–18): 0.333 D/turn (ΔD 1)
  - The Hamper at Dusk (turns 19–21): 0.333 D/turn (ΔD 1)
- **plateau** longest flat stretch 3 turns (aporia window 6)
- **releases** 9/9 on cue
- **decay** 9 slips (seed 1 · rate 0.75 · grace 1) · repaired 8 (tutor 8, re-adoption 0) · mean repair latency 2.13 turns · unrepaired at end 1 · degraded-turn integral 30 · D reversals 1
  - m_taint t3→t5 (tutor) · p_course t5→t6 (tutor) · m_taint t6→t7 (tutor) · m_taint t8 (never repaired) · p_course t8→t9 (tutor) · p_lore t9→t15 (tutor) · p_course t15→t17 (tutor) · p_lore t17→t18 (tutor) · p_course t18→t21 (tutor)
- **events** decay×9 · repair×8 · overreach×1 · lucky_leap×2 · forced×1 · grounded_anagnorisis×1
- **staging** 6 movements declared by the director
- **figures** erotema 7/21 (33%) · 4 distinct · switch rate 0.65
- **superego** intervened 3/21 watched turns · figure changed within-turn on 3/3 interventions · switch on intervention 1.00 vs elsewhere 0.59
- **stall watch** fires by jurisdiction: figure rut 3 · stalled inference 0 · detector audit CLEAN (3/3 due fires, 0 false, 21 turns)
- **inference** 3 voiced · stall integral 0 · overreach 1 · mischanneled 0 — `foulFrom schoolWell fontHouse` available t12 → voiced t12 (latency 0) · `clearOf bray schoolWell` available t14 → voiced t14 (latency 0) · `taintedWith schoolWell wormwood` available t17 → voiced t17 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 21 | 3 | 3 | 42.3 |
| tutor | 21 | 2.48 | 3 | 51 |
| learner | 21 | 3.43 | 6 | 72.3 |
