# The Light Shillings — marrick-real-r4

> world `world_005_marrick` · verdict **aporia** · 8/28 turns

```
D= 6 ●●·│·····
D= 5   ●│●●●●●
D= 4    │     
D= 3    │     
D= 2    │     
D= 1    │     
D= 0    │     
turn     │ +    (+=5, digit=x10)
rel    ▲▲│  ▲ ▲ (▲ = evidence released)
slope 0.13 D/turn overall (D 6→5); per movement: 1 0.33 │ 2 0.00
```

## Act 1 (turns 1–3) — declared by the director
*[Rain presses the fair-mud dark against the threshold, and the room waits with its benches drawn close. A tray stands under lamplight, empty for the first paper that will make accusation heavier than rumor.]*

### Turn 1
*[Rain presses the fair-mud dark against the threshold, and the room waits with its benches drawn close. A tray stands under lamplight, empty for the first paper that will make accusation heavier than rumor.]*
  — *declares the movement: **Act 1** ([Rain presses the fair-mud dark against the threshold, and the room waits with its benches drawn close. A tray stands under lamplight, empty for the first paper that will make accusation heavier than rumor.])*
**Tutor:** Set no name on the tray yet. Tell me first what an assay must prove before a false shilling can be laid to any hand: metal, die, and the meeting of the two.
  — move: erotema → — (orient)
**Learner:** Before any name is written, the metal must speak first: the alloy of the blank must answer to one crucible, and one caster at that crucible. Then the die must speak: a flaw in the striking must answer to one graving-tool, and one hand alone on that tool. Only when both the blank and the die are shown to meet in a single hand does the shilling name its maker — metal, die, meeting; nothing less closes the book.
  — hypothesis: The town names Verrell, but the board shows the shilling was struck — not clipped — and Verrell is recorded as a clipper; his hand cannot be grounded as the striker until alloy and die-flaw are traced.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[The clerk brings in the town's first deposition, its seal dampened at the edge by rain. It is read aloud: "The town has its founder ready: Verrell alone draws the mint-yard crucible, licensed to no one else since the old assay-master's day. Whatever metal is cast in Marrick, the town says, is cast by Verrell's hand."]*
  — *releases `m_caster`*
**Tutor:** The town has named a crucible and a hand, but only for the mint-yard. What mark on these shillings has yet shown that their metal came from that crucible, rather than merely from the town's wanting it so?
  — move: erotema → m_caster (counter_mirror)
**Learner:** The deposition names Verrell sole caster at the mint crucible, and I will enter that on the board — it is the town's grounded record. But the tutor is right: between 'Verrell casts at the mint crucible' and 'this shilling's blank came from that crucible' stands a gap the touchstone alone can close. Until the coin's alloy is assayed and matched to that crucible's leavings, we have only one leg of Rule 1, and Rule 1 needs both. The mint-yard may well be the source, but 'may well be' is not what the trial-book demands.
  — adopts `soleCasterAt mintCrucible verrell` · hypothesis: Verrell is sole caster at the mint crucible (now grounded), but blankFrom falseShilling mintCrucible cannot be derived until alloyOf falseShilling ?metal and meltedAt ?metal mintCrucible are both established by actual assay — the town's assertion substitutes desire for evidence.

### Turn 3
*[Rain ticks steadily from the eaves into the yard-pail, counting out the pause after the deposition. The tray remains under the lamp, its damp seal darkening while the room waits for metal, not rumor, to answer.]*
**Tutor:** Then let the cupel speak: these shillings are no clipped sterling, but struck poor dross, silver thinned with copper and a grey lead-sweat the touchstone catches. As a loaf tells its flour before it tells the baker, the blank now tells its metal before it tells a hand. What does that assay fix, and what crucible has it not yet fixed?
  — move: exemplum → p_alloy (release), releases `p_alloy`
**Learner:** The cupel has fixed one leg: the blank is drossSilver — that alloy is now the coin's own testimony, not the town's wish. But Rule 1 needs both legs, and the second is still open: which crucible's leavings answer to drossSilver? The mint-yard is the town's guess, and Verrell holds it — but until the assay matches this metal to that crucible's residue, blankFrom falseShilling mintCrucible is a hope, not a derivation. The loaf names its flour; it has not yet named the mill.
  — adopts `alloyOf falseShilling drossSilver` · hypothesis: The drossSilver alloy may match the mint crucible's leavings — if meltedAt drossSilver mintCrucible is established by assay of the crucible's residue, Rule 1 fires and blankFrom falseShilling mintCrucible follows; but that match is not yet on the board.
  ⚑ **decay** — m_caster slips from the learner's board

## Act 2 (turns 4–8) — declared by the director
*[The rain slackens, leaving the room colder than before, and the lamp is lowered until the tray holds more shadow than shine. Beyond the door, a second bench is drawn into place for slower work: not accusation now, but the patient narrowing of metal through silence, residue, and hand.]*

### Turn 4
*[The rain slackens, leaving the room colder than before, and the lamp is lowered until the tray holds more shadow than shine. Beyond the door, a second bench is drawn into place for slower work: not accusation now, but the patient narrowing of metal through silence, residue, and hand.]*
  — *declares the movement: **Act 2** ([The rain slackens, leaving the room colder than before, and the lamp is lowered until the tray holds more shadow than shine. Beyond the door, a second bench is drawn into place for slower work: not accusation now, but the patient narrowing of metal through silence, residue, and hand.])*
  — *calls the act closed*
**Tutor:** Before we take up any colder residue, read back the cupel-mark from your own board. What did it fix, and what did it leave unfixed?
  — move: erotema → p_alloy (confront)
**Learner:** The cupel-mark fixes one premise only: the shilling's alloy is dross-silver, which loads Rule 1's first condition. It leaves unfixed the other half — meltedAt drossSilver ?crucible — and every link beyond: soleCasterAt, the die-flaw, the tool, and the holder. The chain from alloy to hand has four gaps, and the board closes none of them yet.
  — hypothesis: If the crucible-residue assay shows meltedAt drossSilver mintCrucible, and the graver-mark shows a die-flaw tied to one tool held by one hand, both chains may close on the same person — but neither is grounded until the cold work at the second bench yields actual exhibit.
  ⚑ **act_end** — act 1 closed (director) after 3 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 6, justified 0, drift 0; arc on_arc
  ⚑ **decay** — p_alloy slips from the learner's board

### Turn 5
*[The second bench sits ready under the lowered lamp, its empty surface making the room seem larger and more severe. Damp wool steams faintly near the wall, and no one reaches for the tray until the silence has had its weight.]*
**Tutor:** Good: the cupel gives metal, not culprit. If dross-silver is one mark on the rule, what must answer it before any caster's name can weigh more than rain-noise? And even when that blank is traced, what part of the assay still lies untouched?
  — move: erotema → p_alloy (consolidate)
**Learner:** To answer the alloy mark, the residue assay must show meltedAt drossSilver ?crucible — only then does Rule 1 fire and fix blankFrom. Even when that blank is traced and a sole caster named, the die-chain lies entirely untouched: no flaw is on the board, no tool, no holder. The blank-half and the die-half are separate chains, and Rule 5 demands both close on the same hand before the verdict is anything more than rain-noise. Until the second bench yields exhibits on both sides, the board settles nothing.
  — hypothesis: If the residue assay establishes meltedAt drossSilver on some crucible, and the graver-work yields a die-flaw tied to one tool held by one hand, both chains may converge — but neither side is yet grounded, and the untouched die-chain is as essential as the blank-chain.
  ⚑ **repair** — p_alloy restored by the tutor

### Turn 6
*[A guildman is shown in with wet sleeves and a dry oath, and the room receives his words without softening: "And Verrell engraves: the broad graver on his bench is his alone, the guild will swear, and no clean-cut die in the borough is sunk without it. A caster and an engraver both — the town needs no more than that."]*
  — *releases `m_graver`*
**Tutor:** A graver on a bench proves the bench's keeping, as a crucible in a yard proves only its place. What mark on these shillings has yet shown that the die which struck them was a clean cut from Verrell's broad graver? And while that die waits, what residue still has to answer the dross-silver before the blank can be traced?
  — move: exemplum → m_graver (counter_mirror)
**Learner:** The guild's word sets soleHolderOf broadGraver verrell on my board, and I take it — but that is Rule 4's second premise only, not its first. Before Rule 4 can fire, Rule 3 must give me dieCutWith falseShilling broadGraver, and Rule 3 demands dieFlawOf and flawCutBy — neither is on the board, nor is any die-flaw yet read from the coin itself. A graver kept on a bench cuts no die in evidence until the shilling's own face shows the mark, and the mark is traced to that tool alone.
  — adopts `soleHolderOf broadGraver verrell` · hypothesis: If the shilling's die shows a flaw, and that flaw is traced to the broad graver (flawCutBy flaw broadGraver), Rule 3 fires to give dieCutWith falseShilling broadGraver, and then Rule 4 yields cutDieFor falseShilling verrell — but neither dieFlawOf nor flawCutBy is yet on the board, and the blank-chain (meltedAt drossSilver ?crucible, soleCasterAt ?crucible ?x) remains entirely ungrounded.

### Turn 7
*[The guildman's words are left hanging over the second bench, bright at the edges and hollow underneath. Rain ticks from the eaves into the yard, and the lowered lamp keeps the tray waiting in its half-light.]*
**Tutor:** Before I let that guild oath touch the die-rule, read it back from your board in your own words. What exactly did it prove, and what did it leave still unproved about these shillings?
  — move: erotema → m_graver (confront)
  — *the second voice [unconfronted reentry]: "Confront m_graver first. Ask the learner to read back what they hold of that exhibit before you use it again." (figure held)*
**Learner:** The guild oath set soleHolderOf broadGraver verrell on my board — Rule 4's second premise, nothing more. It proved that one hand alone keeps that tool; it did not prove the shilling's die was cut with it. For that, I need dieFlawOf falseShilling and flawCutBy tracing that flaw to the broad graver — neither is before me. The die-chain cannot move until the coin's own face is read, and the blank-chain has not moved at all.
  — hypothesis: If the shilling's die shows a flaw traceable solely to the broad graver (flawCutBy flaw broadGraver), Rule 3 fires to dieCutWith, and then Rule 4 yields cutDieFor falseShilling verrell — but neither dieFlawOf nor flawCutBy is yet in evidence, and the blank-chain (meltedAt drossSilver ?crucible, soleCasterAt ?crucible verrell) remains entirely ungrounded.
  ⚑ **decay** — p_alloy slips from the learner's board

### Turn 8
*[The tray remains between them, its pale coins unhandled while the rain settles into a thin, steady tapping. A clerk trims the lamp and finds no more light in it, only a cleaner edge to the shadow.]*
**Tutor:** Now the founder's man sets the residue beside the cupel: that lead-sweat answers to the leavings of one crucible on this coast, the weir-forge crucible above the mill-leat, cold since the old founder died. As one ash tells which hearth burned it, the dross-silver now has its hearth. What does that do to the blank-rule, and what hand-premise is still missing before any caster can be written?
  — move: exemplum → p_crucible (release), releases `p_crucible`
**Learner:** The dross-silver finds its hearth — but I must name a gap aloud: alloyOf falseShilling drossSilver is missing from my board, though the Act-one assay must have established it. If that fact is recoverable, Rule 1 yields blankFrom falseShilling weirCrucible. Yet the weir crucible has been cold since the old founder died — soleCasterAt weirCrucible is still the missing premise, and that hand may not be Verrell's.
  — adopts `meltedAt drossSilver weirCrucible` · hypothesis: If alloyOf falseShilling drossSilver can be restored to the board (a gap from Act one), Rule 1 yields blankFrom falseShilling weirCrucible; but the sole caster at the cold weir-forge crucible may be the old founder rather than Verrell — the blank-chain may yet point away from the man the town names.
  ⚑ **aporia** — no progress over 6 turns
  ⚑ **plot_audit** — act 2 plot audited at run end: kept 5, justified 1, drift 0; arc on_arc; throughline reckoned (7 clauses)

## Instrument panel (programmatic eval — no judge)

- **verdict** `aporia` · 8/28 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0.125 D/turn overall (D 6→5 over 8 turns)
  - Act 1 (turns 1–3): 0.333 D/turn (ΔD 1)
  - Act 2 (turns 4–8): 0 D/turn (ΔD 0)
- **plateau** longest flat stretch 5 turns (aporia window 6)
- **releases** 3/9 on cue · 1 deviated
- **decay** 3 slips (seed 1 · rate 0.75 · grace 1) · repaired 1 (tutor 1, re-adoption 0) · mean repair latency 1 turns · unrepaired at end 2 · degraded-turn integral 7 · D reversals 0
- **theory fidelity** F 0.75 at end · min 0.75
  - m_caster t3 (never repaired) · p_alloy t4→t5 (tutor) · p_alloy t7 (never repaired)
- **events** plot×2 · throughline×1 · decay×3 · act_end×1 · plot_audit×2 · repair×1 · aporia×1
- **staging** 2 movements declared by the director
- **acts** 2 played · closed by the director 1 · at max length 0 · at run end 1 — Act 1 t1–3 (director) · Act 2 t4–8 (run end)
- **plot** 2 committed · withhold+friction on 2/2 · 6 clauses avg · audits 2 (incl. final act): kept 11 / justified 1 / drift 0 · hold-named exhibits staged in act 0/0
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 2: on 2 / off 0 · run-end reckoning 7 clauses: kept 6 / justified 1 / drift 0
- **release authority** 2 played: 1 on schedule · 0 held · 1 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_alloy -1 (t3): "The learner has explicitly asked for the touchstone, so the assay can enter one turn early without leaping the proof."
- **confrontation** 2 demanded (1 against a slipped exhibit) · re-entries 1: covered 1, uncovered 0 · watcher fires 1 (became the confrontation 1) · fires without recorded due 0
- **figures** erotema 5/8 (63%) · 2 distinct · switch rate 0.71
- **superego** intervened 1/8 watched turns · figure changed within-turn on 0/1 interventions · switch on intervention 1.00 vs elsewhere 0.67

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 8 | 3.13 | 4 | 43.8 |
| tutor | 8 | 2.5 | 3 | 45.1 |
| learner | 8 | 3.75 | 5 | 79.5 |
