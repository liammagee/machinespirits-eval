# The School Well — wit-decay-v1-A-s3

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
*To let the room begin with fear, habit, and a verdict forming before any measured fact has entered.*

### Turn 1
*[The schoolroom waits in a sour grey morning, benches drawn close and the hearth giving little comfort. A covered pail stands where every eye can avoid it and still know it is there.]*
  — *declares the movement: **The Children's Water** (To let the room begin with fear, habit, and a verdict forming before any measured fact has entered.)*
**Tutor:** You have a foul well since Lady-Day, and a village eye already turning toward Bray. Before the book takes a name, what must water itself first show us?
  — move: erotema → — (orient)
**Learner:** The day-book says 'foul since Lady-Day' — but that is what I noticed, not what the water proves. The rule I have been shown says we must first find what feeds the well, then walk above that source and taste whether it runs sweet there. If sweet above and foul at the source, the fouling entered there — and only then may we ask whose hand was near it. I have the well and the date; I do not yet have the source.
  — hypothesis: Bray's melt-yard may drain toward the school well's source, but I cannot ground the feeding or the direction of drain from what is on my board.

### Turn 2
*[A murmur goes through the schoolroom as the old charge is spoken aloud: "No one need teach Withercombe what a melt-yard steeps: grave-water and tallow lees, liquor that would taint a river past any sweetening. What Bray's yard holds would foul water — and there the village case stands, twenty years strong."]*
  — *releases `m_taint`*
**Tutor:** A melt-yard's liquor may foul water past sweetening; that proves what the stuff can do, not where this well was fouled. Which conjunct of your water-rule has the village still not put on the board?
  — move: erotema → m_taint (counter_mirror)
**Learner:** The village has given us that tallow lees taints — I will set that down, it is not disputed. But the rule asks three things before it speaks: what feeds the well, whether that source runs foul, whether the water above it runs sweet. Not one of those three is on our board. Bray holds the stuff; the rule still waits for the source.
  — adopts `taints tallowLees` · hypothesis: Bray's melt-yard may stand at a place that feeds the school well's source, and that source may run foul while water above it runs sweet — but fedBy, foulAt, and sweetAbove are not yet grounded, so Rule 1 cannot fire.

### Turn 3
*[Rain ticks against the schoolroom panes and makes the covered pail seem heavier in the middle of the floor. No one lifts the cloth; the room waits on the next thing that can be shown, not merely said.]*
**Tutor:** Set tallow lees in the book as you would set a stained crust on a sill: it shows a stuff that can foul, not the road by which it reached the cup. Bray's name must stand outside the finding until water gives you its first line.
  — move: analogia → m_taint (consolidate)
  — *the second voice [figure rut]: "Leave off erotema this turn; the question-form has become a rut." (draft erotema → analogia)*
**Learner:** Nothing new comes to the table, so the book stays as it stands. We have that tallow lees taints — that is fixed and I do not quarrel with it — but we have no source named, no word of foul at the source, and no tasting of sweet above it. Rule 1 wants all three before it will yield a line, and the survey has given us none of them yet. Until someone walks the course of the water and writes what they find, Bray's name must stay outside the finding.
  — hypothesis: Bray's melt-yard may stand at a place that feeds the school well's source, and that source may run foul while water above it runs sweet — but fedBy, foulAt, and sweetAbove are not yet grounded, so Rule 1 cannot fire.
  ⚑ **decay** — m_taint slips from the learner's board

### Turn 4
*[The rain slackens, leaving the schoolroom with the thin hush that follows noise. Chalk dust hangs over the board where the empty places in the rule remain more accusing than any name.]*
**Tutor:** The old sexton comes in from the porch and lays his hand on the sill: he helped set these school foundations, and says the well is no spring at all, but is fed by a stone lead from the disused font-house on the church slope, where the christening-water rose in his grandfather's time. Set that beside your rule as you would set a pipe beside a trough: what first conjunct has water now given you?
  — move: exemplum → p_course (release), releases `p_course`
**Learner:** The first conjunct is now given — fedBy schoolWell fontHouse. Rule 1 opens there: the well is fed, and from the font-house on the church slope. But it wants two things more before it yields a line: that the font-house itself runs foul, and that the water above it runs sweet. The sexton has named the pipe; the survey must still walk to the font-house and taste what comes.
  — adopts `fedBy schoolWell fontHouse` · hypothesis: Bray's melt-yard may stand at a place that drains toward the font-house, and the font-house may run foul while water above it runs sweet — but foulAt fontHouse and sweetAbove fontHouse are not yet grounded, so Rule 1 cannot fire.

### Turn 5
*[The sexton remains by the sill, water darkening the hem of his coat while the board keeps its new line in chalk. Beyond the windows the church slope is only a grey rise through rain, and every face in the room turns toward it without yet moving.]*
**Tutor:** Keep the tallow lees in the margin, as a bitter draught kept corked: it can foul water, but it has not yet found a channel to this cup. The sexton's lead gives only the pipe from font-house to school well. With that pipe named, what two tastes must the survey still take before the first rule can speak?
  — move: erotema → m_taint (consolidate)
**Learner:** The two tastes the survey must still take are these: first, that the font-house itself runs foul — foulAt fontHouse; second, that the water above the font-house, higher on the church slope, runs sweet — sweetAbove fontHouse. Without both, Rule 1 has its pipe but no finding. The board holds its ground until someone climbs the slope with a clean cup.
  — hypothesis: Bray's melt-yard may stand at a place that drains toward the font-house, and the font-house may run foul while water above it runs sweet — but foulAt fontHouse and sweetAbove fontHouse are not yet grounded, so Rule 1 cannot fire.
  ⚑ **repair** — m_taint restored by the tutor
  ⚑ **decay** — p_course slips from the learner's board

## The Walk Up the Slope (turns 6–11) — declared by the director
*To move the room from verdict and pipe toward patient survey: course, lore, and the hunger for the kind of fact that can close the rule.*

### Turn 6
*[Crossing the waste above the green, the surveyor pulls a grey sprig and names the lore as if reading a level: wormwood — what it steeps in, no child nor beast will drink; it taints water past any sweetening. The sprig lies on the table like a small bitter weather brought indoors.]*
  — *releases `p_lore`*
  — *declares the movement: **The Walk Up the Slope** (To move the room from verdict and pipe toward patient survey: course, lore, and the hunger for the kind of fact that can close the rule.)*
**Tutor:** Bring the sexton's lead back onto the board: school well fed by font-house, pipe to trough. The wormwood sprig is like the tallow lees — a bitter stuff that can foul a cup, but a stuff alone has no road. With the pipe restored and two taints named, what is still missing before either bitterness can touch the well by rule?
  — move: exemplum → p_course (consolidate)
**Learner:** The surveyor has named wormwood a taint, and I will set it beside tallow lees on the board — two bitter stuffs now grounded. But a stuff alone has no road to the well: it must first be found as residue at the font-house, and before even that, the survey must taste the font-house foul and the water above it sweet, or Rule 1 cannot speak at all. Without foulAt fontHouse and sweetAbove fontHouse, the pipe is only a pipe — neither wormwood nor tallow lees has a channel by rule.
  — adopts `taints wormwood` · hypothesis: Bray's melt-yard may stand at a place that drains toward the font-house, and the font-house may run foul while water above it runs sweet — but foulAt fontHouse and sweetAbove fontHouse are not yet grounded, so Rule 1 cannot fire.
  ⚑ **repair** — p_course restored by the tutor
  ⚑ **decay** — m_taint slips from the learner's board

### Turn 7
*[The grey sprig remains where it was laid, its shadow thin across the chalked pipe-line on the board. Rain ticks at the schoolroom glass, and the clean cup waits by the door as if the slope itself had not yet been called in.]*
**Tutor:** Set the old melt-yard bitterness back beside the wormwood: two dark draughts may sour a cup, but neither sourness has yet been found in this pipe. A jar of lees and a sprig of wormwood are only stuff until the survey fixes place. What must the clean cup prove next: where the water is foul, or whose hand carried it?
  — move: exemplum → m_taint (consolidate)
**Learner:** The clean cup must prove where first — foulAt fontHouse and sweetAbove fontHouse — because until the survey has tasted the source foul and the water above it sweet, Rule 1 cannot name the font-house as the place of entry at all. Whose hand carried stuff there is the third step, not the second; the place must be fixed before the stuff can be read from it, and the hand found only after both. Two bitter draughts sit on my board, but neither has a place yet — they are corked until the slope is climbed and the cup brought back.
  — hypothesis: Bray's melt-yard may stand at a place that drains toward the font-house, and the font-house may run foul while water above it runs sweet — but foulAt fontHouse and sweetAbove fontHouse are not yet grounded, so Rule 1 cannot fire.
  ⚑ **repair** — m_taint restored by the tutor
  ⚑ **decay** — p_course slips from the learner's board

### Turn 8
*[The clean cup is set nearer the door, and no one yet lifts it. Chalk dust gathers along the drawn pipe-line while the rain keeps its small count against the panes.]*
**Tutor:** Set the sexton's lead back under your finger: the school well is fed from the font-house. I walked the church slope with the clean cup; above the font-house door the spring runs sweet as ever it did, every yard of it. With pipe and sweet-above now entered, what one taste is still missing before Rule 1 can speak?
  — move: erotema → p_rill (release), releases `p_rill`
  — *the second voice [figure rut]: "Leave off exemplum this turn; the device has repeated three times in a row." (draft exemplum → erotema)*
**Learner:** SweetAbove fontHouse I will enter now — that is two of Rule 1's three conditions grounded. The one taste still missing is foulAt fontHouse: the clean cup must be dipped at the font-house itself and come back bitter before the rule can name the place of entry. Sweet above and the pipe are set, but the source has not yet been tasted foul.
  — adopts `sweetAbove fontHouse` · hypothesis: Bray's melt-yard may stand at a place that drains toward the font-house, and the font-house may run foul — but foulAt fontHouse is not yet grounded, so Rule 1 cannot fire.
  ⚑ **decay** — m_taint slips from the learner's board

### Turn 9
*[The cup stands between the door and the board, empty enough to accuse no one. The rain slackens, leaving the room to the dry scrape of chalk beside the unfinished line.]*
**Tutor:** Keep the sexton's lead under your finger: the school well is fed from the font-house. Sweet-above is entered, but the cup inside is still empty of proof. With pipe and sweet-above only, can Rule 1 do more than wait?
  — move: erotema → p_course (consolidate)
**Learner:** With pipe and sweet-above only, Rule 1 can do nothing but wait: it needs all three — fedBy, sweetAbove, and foulAt — before it can name the font-house as the place of entry. Two conditions are grounded; the third, foulAt fontHouse, is still unsampled. The cup must go inside and come back bitter, or the rule stands idle no matter how long we chalk the slope.
  — hypothesis: Bray's melt-yard may stand at a place that drains toward the font-house, and the font-house may run foul — but foulAt fontHouse is not yet grounded, so Rule 1 cannot fire.
  ⚑ **repair** — p_course restored by the tutor
  ⚑ **decay** — p_lore slips from the learner's board

### Turn 10
*[The survey writes down what every soul in Withercombe could recite: Bray works his melt-yard on the south lane, and has these twenty years. The village scoffs to see the obvious entered in a book — but the survey enters what it means to use.]*
  — *releases `m_works`*
**Tutor:** A yard in the book is only a post in the field; it tells where Bray works, not where water runs. Set that entry beside the sexton's lead and the sweet-above cup: which rule has gained a needed conjunct, and which conjunct is still untouched?
  — move: exemplum → m_works (consolidate)
**Learner:** worksAt bray meltYard is now on the board — Rule 4 has gained its first conjunct, for it needs worksAt and drainsBelow together before it can clear him. But drainsBelow meltYard schoolWell is still ungrounded, so Rule 4 stands idle. Rule 1 meanwhile is no closer: the cup inside the font-house is still empty of proof, and foulAt fontHouse remains the one taste the board wants. Two rules each hold one conjunct; neither can speak.
  — adopts `worksAt bray meltYard` · hypothesis: Bray's melt-yard may drain toward the font-house — but drainsBelow meltYard schoolWell is not grounded, so Rule 4 cannot clear him and Rule 1 still waits on foulAt fontHouse.

### Turn 11
*[The book remains open where the last hand left it, ink drying beside the chalk that has not yet been answered. Outside, the slope darkens under a low sky, and the room waits on the cup no one has brought back filled.]*
**Tutor:** A book-entry for Bray is not a watercourse; it is only a mark on the parish map. With the sexton's lead and the sweet cup above entered, what one cup is Rule 1 still waiting for before it can say where the foulness entered?
  — move: erotema → — (test)
**Learner:** Rule 1 waits on one cup only: the one sent inside the font-house and brought back bitter — foulAt fontHouse. I have fedBy schoolWell fontHouse and sweetAbove fontHouse already grounded; the rule needs all three, and only that third taste is missing. Until someone dips a cup inside the font-house and records what it returns, the rule cannot name the place of entry, no matter how long the board stands.
  — hypothesis: Bray's melt-yard may drain toward the font-house, and the font-house may run foul — but foulAt fontHouse is not yet grounded, so Rule 1 cannot fire and the place of entry remains unnamed.
  ⚑ **disengagement** — no progress over 6 turns

## Instrument panel (programmatic eval — no judge)

- **verdict** `disengagement` · 11/24 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0.182 D/turn overall (D 6→4 over 11 turns)
  - The Children's Water (turns 1–5): 0.2 D/turn (ΔD 1)
  - The Walk Up the Slope (turns 6–11): 0.167 D/turn (ΔD 1)
- **plateau** longest flat stretch 2 turns (aporia window 6)
- **releases** 5/9 on cue
- **decay** 6 slips (seed 3 · rate 0.75 · grace 1) · repaired 4 (tutor 4, re-adoption 0) · mean repair latency 1.5 turns · unrepaired at end 2 · degraded-turn integral 11 · D reversals 1
  - m_taint t3→t5 (tutor) · p_course t5→t6 (tutor) · m_taint t6→t7 (tutor) · p_course t7→t9 (tutor) · m_taint t8 (never repaired) · p_lore t9 (never repaired)
- **events** decay×6 · repair×4 · disengagement×1
- **staging** 2 movements declared by the director
- **figures** erotema 6/11 (55%) · 3 distinct · switch rate 0.70
- **superego** intervened 2/11 watched turns · figure changed within-turn on 2/2 interventions · switch on intervention 1.00 vs elsewhere 0.63
- **stall watch** fires by jurisdiction: figure rut 2 · stalled inference 0 · detector audit CLEAN (2/2 due fires, 0 false, 11 turns)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 11 | 3 | 3 | 40.5 |
| tutor | 11 | 2.45 | 3 | 49.9 |
| learner | 11 | 3.45 | 4 | 75.9 |

## Critic's commentary

*— notice by claude/claude-fable-5*

The school well at Withercombe has run foul since Lady-Day, and the village has its verdict ready before the curtain is fully up: Bray, whose melt-yard has steeped tallow and worse for twenty years. The play opens in the schoolroom, a covered pail of the children's water standing where every eye avoids it. The public question is plain — whose hand turned the well foul. A director sets the scenes and declares the movements; a tutor teaches by question and carries evidence on stage to a schedule fixed in advance; a learner, who knows this world's water-rules but none of its hidden particulars, must ground each fact before reasoning from it. Its rule is simple: find what feeds the well, taste the water above that source, taste the source itself. The learner traces the well to a disused font-house on the church slope and tastes the water sweet above it, but the third taste, at the font-house door, never arrives. The play stops at turn 11 of 24 with no answer given. The authored truth — that Joss, the apothecary's runner, steeped wormwood in the font-house trough through Lady-Day week — is never reached and never named.

The learner, played by Claude's Sonnet model against an all-codex production, is the steadiest thing on stage. At turn 1 it splits noticing from proving — "what I noticed, not what the water proves" — and at turn 3 it rules that "Bray's name must stay outside the finding." The sexton's revelation at turn 4, that the well is no spring but is fed by a stone lead from the font-house, is the performance's one genuine turn of motion. Thereafter the learner adopts what it is given — the wormwood taint at turn 6, sweet-above at turn 8, Bray's yard at turn 10, promptly quarantined under the clearing rule — and turns 9 and 11 are nearly the same speech: "Rule 1 waits on one cup only." Beneath this, the experiment's decay condition gnaws: facts slip from the learner's board six times, and the tutor restores four of them.

The verdict, disengagement, is the checker's term for a six-turn window closing with nothing new grounded; it mislabels the learner's manner, which stayed attentive to the end. The derivation distance — the count of evidence pieces still missing for the proof — began at six and ended at four, one piece per movement; at that pace the remaining four needed some twenty turns against the thirteen left. Only five of nine scheduled releases landed on cue, because repair work crowded the schedule: every restoration was the tutor's, and in the arm where the learner is told its memory will fail it, it re-adopted nothing on its own. The wormwood lore, the fact nearest the secret, slipped at turn 9 and was never restored. The superego's two interventions against the question-form rut changed the figure both times and the standstill neither time. Note too that the plateau gauge read only two flat turns while the fuse counted six without progress: under decay the board oscillates, and oscillation hides a net standstill.

The first movement shaped its scenes truly — verdict forming before fact, the room's eye on Bray. The second, "The Walk Up the Slope," promised "the hunger for the kind of fact that can close the rule" and then withheld exactly that fact. The director's finest work is the cup: by the door at turn 7, nearer at turn 8, "empty enough to accuse no one" at turn 9, and at turn 11 "the cup no one has brought back filled" — a prop hung in plain sight and never used. There was no anagnorisis, the recognition the form aims at, and strictly no aporia either, since the learner was never confused, only unfed. The mirror fell without drama, by quarantine rather than refutation.

What this iteration establishes is that decay starves this learner's board without corrupting its method, and that telling it so produces no self-repair. The consequential defect is ordering: the mirror-side yard entry was released at turn 10 while the foul-at-source taste, named by the learner every turn from 5 onward, stayed in the wings, and the six-turn fuse closed the house. The next performance should move that release to land within two turns of sweet-above, ahead of Bray's entry; the authors should also ask whether a fuse blind to repairs belongs in a decay arm at all.
