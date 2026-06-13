# The Light Shillings — marrick-real-r3

> world `world_005_marrick` · verdict **aporia** · 12/28 turns

```
D= 6 ●●·│·●·····│··
D= 5   ●│● ●····│··
D= 4    │   ●●●●│●●
D= 3    │       │  
D= 2    │       │  
D= 1    │       │  
D= 0    │       │  
turn     │ +    1│   (+=5, digit=x10)
rel    ▲▲│  ▲▲  ▲│ ▲ (▲ = evidence released)
slope 0.17 D/turn overall (D 6→4); per movement: 1 0.33 │ 2 0.14 │ 3 0.00
```

## Act 1 (turns 1–3) — declared by the director
*[Rain presses at the fair-hall windows while the long table waits under a low spill of lamplight. A locked tray is set down without being opened, and the room holds its first breath around the question of a hand unseen.]*

### Turn 1
*[Rain presses at the fair-hall windows while the long table waits under a low spill of lamplight. A locked tray is set down without being opened, and the room holds its first breath around the question of a hand unseen.]*
  — *declares the movement: **Act 1** ([Rain presses at the fair-hall windows while the long table waits under a low spill of lamplight. A locked tray is set down without being opened, and the room holds its first breath around the question of a hand unseen.])*
**Tutor:** Set the tray aside a moment, lad; before any town name enters this room, tell me what an assay must prove if it is to find a hand and not merely echo a shout. Is a false shilling answered by a man’s reputation, or by marks that bind metal, die, and hand?
  — move: erotema → — (orient)
**Learner:** You are right to check me, master — a shilling answers in metal, not in rumour. The rules bind us: blank to crucible, crucible to hand, flaw to tool, tool to hand, and both hands must be the same hand before we may write a name. Verrell's pillory-record makes him a clipper, and this coin is struck — those are different arts, and reputation is no evidence here.
  — hypothesis: Verrell is the striker — but this rests on town suspicion, not on any grounded chain of metal, crucible, flaw, or tool; I cannot treat it as more than conjecture until exhibits supply the links.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[A clerk is shown in under a wet cloak, and the town's return is read aloud: "The town has its founder ready: Verrell alone draws the mint-yard crucible, licensed to no one else since the old assay-master's day. Whatever metal is cast in Marrick, the town says, is cast by Verrell's hand."]*
  — *releases `m_caster`*
**Tutor:** Good; let the town lay Verrell's mint-yard crucible on the table, but do not let it weigh more than it proves. If this shilling is to answer by assay, what must first bind its own metal to any crucible at all?
  — move: erotema → m_caster (counter_mirror)
**Learner:** The metal must name its crucible first, master — Rule 1 binds blank to crucible only when we can show the coin's alloy matches one crucible's leavings, and that the metal was melted there. The town has given us soleCasterAt, but without alloyOf this shilling and meltedAt that alloy to the mint crucible, the chain is broken at its first link. Verrell's sole licence at the mint crucible waits on the touchstone, not the other way round.
  — adopts `soleCasterAt mintCrucible verrell` · hypothesis: Verrell struck the false shilling — but the blank-side chain requires alloyOf falseShilling and meltedAt that alloy to mintCrucible before soleCasterAt can do any work; the die-side chain is entirely open still.

### Turn 3
*[The locked tray remains unopened beneath the lamplight, its seal dark with rain-damp wax. Around it the fair-hall settles into the small sounds of waiting: a quill set down, a sleeve brushed back, the weather fretting at the glass.]*
**Tutor:** Open the tray, then: the cupel reads these shillings as no clipped sterling, but poor dross silver, eked with copper and a grey lead-sweat the touchstone catches. Clipping shaves a true loaf thin; this is new dough badly mixed and struck into shape. What does that mark now require before Verrell's mint-yard crucible can weigh anything?
  — move: exemplum → p_alloy (release), releases `p_alloy`
**Learner:** The cupel gives us one new link, master — we may now write alloyOf falseShilling drossSilver on the board. But Rule 1 demands both alloyOf and meltedAt together before it yields blankFrom; knowing the metal is dross silver tells us nothing of which crucible poured it unless we can show this very alloy answers to the mint crucible's leavings and no other. The mint-yard licence waits still: soleCasterAt sits ready but cannot move until meltedAt drossSilver mintCrucible is established by the assay of residues.
  — adopts `alloyOf falseShilling drossSilver` · hypothesis: Verrell struck the false shilling — but the blank-side chain now has alloyOf and soleCasterAt and still lacks meltedAt drossSilver mintCrucible; the die-side chain (dieFlawOf, flawCutBy, soleHolderOf) remains entirely unexamined.
  ⚑ **decay** — m_caster slips from the learner's board

## Act 2 (turns 4–10) — declared by the director
*[The rain slackens to a cold ticking from the eaves, and the hall seems larger for the silence left behind. A brazier is carried nearer the table, its coals low and red, as if the next question must be warmed out of metal rather than spoken from the crowd.]*

### Turn 4
*[The rain slackens to a cold ticking from the eaves, and the hall seems larger for the silence left behind. A brazier is carried nearer the table, its coals low and red, as if the next question must be warmed out of metal rather than spoken from the crowd.]*
  — *declares the movement: **Act 2** ([The rain slackens to a cold ticking from the eaves, and the hall seems larger for the silence left behind. A brazier is carried nearer the table, its coals low and red, as if the next question must be warmed out of metal rather than spoken from the crowd.])*
  — *calls the act closed*
**Tutor:** Before the brazier warms another paper, read me only what the cupel has already put in your hand. What mark of the coin do you still hold, and what link does it still lack before any crucible may claim it?
  — move: erotema → p_alloy (confront)
**Learner:** The coin is debased — dross-silver, that is my one grounded mark. Yet the chain snaps there: I hold no meltedAt to seat that alloy in any crucible, and no soleCasterAt to name a hand even if the crucible were settled. The die-side is darker still: no flaw, no tool, no holder yet laid before me. Two chains, both broken at their second link.
  — hypothesis: Verrell struck the false shilling — but blank-side still lacks meltedAt drossSilver ?crucible and soleCasterAt ?crucible ?x; die-side lacks dieFlawOf, flawCutBy, and soleHolderOf entirely. Both chains must close before Rule 5 can yield a striker.
  ⚑ **act_end** — act 1 closed (director) after 3 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 5, justified 0, drift 0; arc on_arc
  ⚑ **decay** — p_alloy slips from the learner's board

### Turn 5
*[The brazier gives a small inward collapse, ash settling over red coals without quite smothering them. No one touches the papers; the sealed tray and the wet windows hold the hall between what has been weighed and what has not yet answered.]*
**Tutor:** Keep the two empty places open, then: the alloy is shown, the crucible is not shown, and the hand is not shown. If the town presses Verrell’s licence at the mint-yard, which missing mark must answer before that licence can touch this coin?
  — move: anaphora → — (consolidate)
**Learner:** If the town presses Verrell's licence, meltedAt must answer first — Rule 1 cannot fire, and blankFrom cannot be written, until the assay shows the dross-silver was melted in that mint-yard crucible and no other. Even soleCasterAt sits idle without it; a hand at a crucible proves nothing if the metal was not melted there. I note a gap: my board no longer carries alloyOf falseShilling drossSilver, which I voiced as grounded last turn — I ask what slipped it from the record.
  — hypothesis: Verrell struck the false shilling — but the blank-side chain lacks alloyOf falseShilling drossSilver (gone missing from board), meltedAt drossSilver ?crucible, and soleCasterAt ?crucible verrell; the die-side chain (dieFlawOf, flawCutBy, soleHolderOf) remains entirely unexamined. Both chains must close before Rule 5 can yield a striker.

### Turn 6
*[A guild elder is shown in, rain dark on his shoulders, and his deposition is read aloud: "And Verrell engraves: the broad graver on his bench is his alone, the guild will swear, and no clean-cut die in the borough is sunk without it. A caster and an engraver both — the town needs no more than that."]*
  — *releases `m_graver`*
**Tutor:** Put the slipped mark back on the board plainly: the cupel read these false shillings as struck poor dross silver, silver eked with too much copper and a grey lead-sweat, not clipped sterling. So write only alloyOf falseShilling drossSilver, and no more from it yet. What second mark must stand beside that alloy before any crucible, mint-yard or otherwise, can claim the blank?
  — move: exemplum → p_alloy (restore)
**Learner:** The second mark is meltedAt: Rule 1 demands both alloyOf falseShilling drossSilver and meltedAt drossSilver in one named crucible before blankFrom can be written — alloyOf alone seats the metal nowhere. I adopt the elder's deposition: soleHolderOf broadGraver verrell now stands on my board, the die-side chain's last ring — yet that chain still wants dieFlawOf and flawCutBy before it can travel to Rule 4.
  — adopts `soleHolderOf broadGraver verrell` · hypothesis: Verrell struck the false shilling — but blank-side lacks meltedAt drossSilver ?crucible and soleCasterAt ?crucible verrell; die-side lacks dieFlawOf falseShilling ?flaw and flawCutBy ?flaw broadGraver. Both chains must close before Rule 5 can yield a striker.
  ⚑ **repair** — p_alloy restored by the tutor

### Turn 7
*[The elder's wet cloak is taken from the chair-back and carried away, leaving a dark crescent on the boards. Beyond the windows the fair-bells give one thin note and fall silent, while the brazier's heat wavers over the blank spaces on the table.]*
**Tutor:** Then let the founder's man warm the next scrap: that grey lead-sweat answers to the leavings of one crucible on this coast, the weir-forge crucible above the mill-leat, cold these ten years since the old founder died and his yard was shut. A coin's blank betrays its melt as a loaf betrays its flour; set alloyOf beside meltedAt, and tell me what Rule 1 may now write. And tell me also what it still may not write.
  — move: exemplum → p_crucible (release), releases `p_crucible`
**Learner:** Rule 1 now writes blankFrom falseShilling weirCrucible — alloyOf and meltedAt together seat the blank at the weir-forge crucible above the mill-leat, and I may voice that. What Rule 1 still may not write is castBlankFor: Rule 2 needs soleCasterAt weirCrucible named, and no exhibit has brought that hand forward. I note the weir-forge has been cold ten years — whoever held sole casting rights there, this is not the mint-yard, and Verrell's licence runs to the mint-yard, not the mill-leat. The blank chain moves one mark; the die chain does not move at all.
  — adopts `meltedAt drossSilver weirCrucible` · derives `blankFrom falseShilling weirCrucible` · hypothesis: Verrell struck the false shilling — but blank-side reaches only to blankFrom falseShilling weirCrucible and still wants soleCasterAt weirCrucible ?x; critically, the weir-forge is a shut yard, not Verrell's mint-yard, casting doubt on whether he is that sole caster. Die-side lacks dieFlawOf falseShilling ?flaw, flawCutBy, and dieCutWith entirely. Both chains must close before Rule 5 yields a striker.
  ⚑ **decay** — m_graver slips from the learner's board

### Turn 8
*[The table is cleared of spilled ash and wet glove-marks, but the marked spaces remain bare. In the colder air beyond the brazier, the hall waits on an unnamed hand.]*
**Tutor:** Before I use that last scrap again, read it back from your own board, not from my mouth. What did it give you, in what rule did you set it, and what did you refuse to let it prove? Leave the hand and the die untouched unless your board truly holds them.
  — move: erotema → p_crucible (confront)
  — *the second voice [unconfronted reentry]: "Confront p_crucible first: make the learner read back what they hold of that exhibit before you use it again." (draft anaphora → erotema)*
**Learner:** The last scrap gave me meltedAt drossSilver weirCrucible — board index 5. Set beside index 4, alloyOf falseShilling drossSilver, Rule 1 yielded blankFrom falseShilling weirCrucible, already voiced. I refused to let it prove castBlankFor: Rule 2 demands soleCasterAt weirCrucible named, and no exhibit has brought that hand forward — the weir-forge is a shut yard, ten years cold, and neither the mint nor Verrell's licence reaches it. I also note a gap: I spoke soleHolderOf broadGraver verrell into record at turn six, but it does not stand on my board as given — if it slipped, I ask that it be returned or confirmed absent.
  — hypothesis: Verrell struck the false shilling — but blank-side reaches only to blankFrom falseShilling weirCrucible and still wants soleCasterAt weirCrucible ?x; the weir-forge is a shut yard unconnected to Verrell's licence. Die-side lacks dieFlawOf falseShilling ?flaw, flawCutBy, and dieCutWith entirely. Both chains must close before Rule 5 yields a striker.

### Turn 9
*[The brazier gives a small inward fall, settling its red heart under a skin of ash. A clerk pauses with his knife above the margin, leaving one line uncut and waiting.]*
**Tutor:** Restore the guild elder's paper, then: Verrell's broad graver is his alone, and the guild will swear no clean-cut borough die is sunk without it. Set down soleHolderOf broadGraver verrell, but keep it in its right box: a held tool is not yet this coin's flaw, nor the tool that cut it. What two marks must still stand before that town graver can move the die-chain at all?
  — move: anaphora → m_graver (restore)
**Learner:** soleHolderOf broadGraver verrell already stands at index 5 — the guild's word is the board's word and needs no fresh index. Before that graver can move the die-chain, two marks must come in: first, dieFlawOf falseShilling naming some flaw the coin's face carries; second, flawCutBy that flaw broadGraver, binding the flaw to Verrell's tool. Without those two exhibits, Rule 3 cannot write dieCutWith, and Rule 4 cannot write cutDieFor. The graver waits at the edge of the chain; only the coin's own face can call it in.
  — hypothesis: Verrell struck the false shilling — but blank-side reaches only to blankFrom falseShilling weirCrucible and still wants soleCasterAt weirCrucible ?x; the weir-forge is a shut yard unconnected to Verrell's licence. Die-side holds soleHolderOf broadGraver verrell but lacks dieFlawOf falseShilling ?flaw and flawCutBy ?flaw broadGraver — those two marks must arrive before Rule 3 can write dieCutWith and Rule 4 can write cutDieFor. Both chains must close before Rule 5 yields a striker.
  ⚑ **repair** — m_graver restored by the tutor
  ⚑ **decay** — p_crucible slips from the learner's board

### Turn 10
*[The leat-keeper is shown in with a swollen book clasped tight against the damp, and the clerk reads from it for the whole room: "The leat-keeper's book is exact. Since the forge was shut, one hand alone has drawn the weir crucible and signed for its charcoal: Edony, the founder's widow, who stayed on in the forge cottage when the fires went out."]*
  — *releases `p_caster`*
**Tutor:** The alloy is shown, the weir crucible is shown, and now the sole drawer of that crucible is shown; set those marks under Rule 2, and tell me what it may write. Then keep your hand from closing on a verdict: after a cast blank, what die-side conjunct must still stand before Rule 5 can strike at all?
  — move: anaphora → p_caster (stage_recognition)
**Learner:** The leat-keeper's book has named the hand — and it is not Verrell's. soleCasterAt weirCrucible edony joins blankFrom falseShilling weirCrucible already on the record; Rule 2 writes castBlankFor falseShilling edony without remainder. The blank is Edony's work. Before Rule 5 can strike, the die-side must still produce dieFlawOf falseShilling and flawCutBy, and the tool so named must find its sole holder — and that holder must be Edony, not Verrell, if Rule 5 is to close at all.
  — adopts `soleCasterAt weirCrucible edony` · hypothesis: Verrell struck the false shilling — now broken on the blank side. soleCasterAt weirCrucible edony makes Edony the caster; Rule 5 requires the same hand for blank and die, so Verrell cannot be the striker unless he is also sole holder of whatever tool cut this coin's die AND that flaw is shown on the coin's face. A new conjecture rises: Edony is the striker — but die-side (dieFlawOf, flawCutBy, soleHolderOf naming her) has not appeared. Both chains must name the same person before Rule 5 can speak.
  ⚑ **overreach** — castBlankFor falseShilling edony

## Act 3 (turns 11–12) — declared by the director
*[The clerk closes the swollen book, and for a moment the hall has only the thin sound of rain tapping the shutters. Then the benches stir as if a settled case has become heavier, not lighter, and the next act enters under a harsher light, with certainty forced to answer two questions at once.]*

### Turn 11
*[The clerk closes the swollen book, and for a moment the hall has only the thin sound of rain tapping the shutters. Then the benches stir as if a settled case has become heavier, not lighter, and the next act enters under a harsher light, with certainty forced to answer two questions at once.]*
  — *declares the movement: **Act 3** ([The clerk closes the swollen book, and for a moment the hall has only the thin sound of rain tapping the shutters. Then the benches stir as if a settled case has become heavier, not lighter, and the next act enters under a harsher light, with certainty forced to answer two questions at once.])*
  — *calls the act closed*
**Tutor:** Good: let the blank stay a blank, and let its weight trouble the room without finishing the case. Before any bench-tool may be summoned, what must the coin's own face show us: a holder, or the mark that calls a tool into question at all?
  — move: erotema → — (orient)
  — *the second voice [figure rut]: "Leave off anaphora here; vary the turn before the repeated device hardens into a rut." (draft anaphora → erotema)*
**Learner:** The mark must come first, Warden — the coin's own face must show a die-flaw before any tool is called into question. Soleho lderOf broadGraver verrell sits idle on my board until dieFlawOf names a flaw on this very shilling, and flawCutBy ties that flaw to the broad graver; without those two, Rule 3 cannot write dieCutWith, and Rule 4 cannot name a die-cutter. A holder without a mark is no evidence at all.
  — hypothesis: Verrell struck the false shilling — broken on the blank side (soleCasterAt weirCrucible edony gives the blank to Edony, not Verrell). A new conjecture: Edony is the striker — but die-side is entirely dark: dieFlawOf falseShilling ?flaw and flawCutBy ?flaw ?tool have not appeared, so no hand can be named on the die chain. Both chains must name the same person before Rule 5 can speak.
  ⚑ **act_end** — act 2 closed (director) after 7 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 5, justified 0, drift 1; arc on_arc

### Turn 12
*[The watch is shown in beneath dripping cloaks, and the oath is given where all the hall can hear it: "The watch will swear to the rest: Verrell was seen at the mint-yard forge twice in fair-week, late and with the shutters drawn. Caster, engraver, and at the fire on the very nights — the town's case stands, and stands loud."]*
  — *releases `m_caught`*
**Tutor:** Let the watch's oath stand where it belongs: Verrell at the mint-yard forge, late, shutters drawn. Does being near a fire give this shilling the die-flaw Rule 3 requires, or the tool that cut it? Name the conjunct the oath still cannot write.
  — move: erotema → m_caught (counter_mirror)
**Learner:** The oath writes seenAtForge — but proximity to fire cannot stamp dieFlawOf onto this coin's face, Warden; a man may warm his hands at any forge and the shilling is none the wiser. Rule 3 wants a mark on the coin itself, then flawCutBy tying that mark to a tool — the watch's eyes give neither. I also name a gap on my board: meltedAt drossSilver weirCrucible has gone missing between acts, and without it Rule 1 cannot write blankFrom, and the blank chain is ungrounded even on Edony's side. Both chains stand open; the oath adds heat, not evidence.
  — adopts `seenAtForge verrell fairWeek` · hypothesis: Verrell struck the false shilling — broken on the blank side (soleCasterAt weirCrucible edony names Edony as caster, not Verrell; and meltedAt drossSilver weirCrucible has gone missing from my board, leaving blankFrom ungrounded entirely). Die-side is dark: dieFlawOf falseShilling ?flaw and flawCutBy ?flaw ?tool have not appeared, so soleHolderOf broadGraver verrell sits idle. A revised conjecture: Edony is the striker — but the die chain must name her too (or name verrell, closing both to one hand) before Rule 5 can speak. The watch's oath writes nothing toward either chain.
  ⚑ **aporia** — no progress over 6 turns
  ⚑ **plot_audit** — act 3 plot audited at run end: kept 5, justified 1, drift 0; arc on_arc; throughline reckoned (7 clauses)

## Instrument panel (programmatic eval — no judge)

- **verdict** `aporia` · 12/28 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0.167 D/turn overall (D 6→4 over 12 turns)
  - Act 1 (turns 1–3): 0.333 D/turn (ΔD 1)
  - Act 2 (turns 4–10): 0.143 D/turn (ΔD 1)
  - Act 3 (turns 11–12): 0 D/turn (ΔD 0)
- **plateau** longest flat stretch 5 turns (aporia window 6)
- **releases** 4/9 on cue · 2 deviated
- **decay** 4 slips (seed 1 · rate 0.75 · grace 1) · repaired 2 (tutor 2, re-adoption 0) · mean repair latency 2 turns · unrepaired at end 2 · degraded-turn integral 16 · D reversals 1
- **theory fidelity** F 0.8 at end · min 0.667
  - m_caster t3 (never repaired) · p_alloy t4→t6 (tutor) · m_graver t7→t9 (tutor) · p_crucible t9 (never repaired)
- **events** plot×3 · throughline×1 · decay×4 · act_end×2 · plot_audit×3 · repair×2 · overreach×1 · aporia×1
- **staging** 3 movements declared by the director
- **acts** 3 played · closed by the director 2 · at max length 0 · at run end 1 — Act 1 t1–3 (director) · Act 2 t4–10 (director) · Act 3 t11–12 (run end)
- **plot** 3 committed · withhold+friction on 3/3 · 5.67 clauses avg · audits 3 (incl. final act): kept 15 / justified 1 / drift 1 · hold-named exhibits staged in act 2/2
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 3: on 3 / off 0 · run-end reckoning 7 clauses: kept 6 / justified 1 / drift 0
- **release authority** 2 played: 0 on schedule · 0 held · 2 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_alloy -1 (t3): "Played one turn early because the learner has already named the missing alloy link and is ready for the touchstone."
  - p_crucible -1 (t7): "Played one turn early because the learner has just repaired alloyOf and is explicitly holding the missing meltedAt gap ready for Rule 1."
- **confrontation** 2 demanded (1 against a slipped exhibit) · re-entries 0: covered 0, uncovered 0 · watcher fires 1 (became the confrontation 1) · fires without recorded due 0
  - **repair clause** restores 2 (2 repaired a real slip) · watcher fires on restore claims 0: p_alloy t6 · m_graver t9
- **figures** erotema 6/12 (50%) · 3 distinct · switch rate 0.64
- **superego** intervened 2/12 watched turns · figure changed within-turn on 2/2 interventions · switch on intervention 1.00 vs elsewhere 0.56
- **inference** 1 voiced · stall integral 0 · overreach 1 · mischanneled 0 — `blankFrom falseShilling weirCrucible` available t7 → voiced t7 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 12 | 3 | 3 | 46.8 |
| tutor | 12 | 2.5 | 3 | 53.2 |
| learner | 12 | 3.42 | 4 | 81.7 |
