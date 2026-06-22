# The Light Shillings — marrick-visible-r2

> world `world_005_marrick` · verdict **disengagement** · 21/28 turns

```
D= 6 ●●●●│······│····│·····│··
D= 5     │●●●···│····│·····│··
D= 4     │   ●●·│····│·····│··
D= 3     │     ●│●···│·····│··
D= 2     │      │ ●●●│●····│··
D= 1     │      │    │ ●●●●│●●
D= 0     │      │    │     │  
turn      │+    1│    │+    │2  (+=5, digit=x10)
rel    ▲  │▲▲▲  ▲│ ▲  │ ▲   │   (▲ = evidence released)
slope 0.24 D/turn overall (D 6→1); per movement: 1 0.00 │ 2 0.50 │ 3 0.25 │ 4 0.20 │ 5 0.00
```

## Act 1 (turns 1–4) — declared by the director
*[Rain rattles on the shutters while the fair’s mud darkens the threshold, and the room gathers itself around a bare table where no exhibit yet lies. Outside, voices pass and fall away, leaving only the public question hanging in the damp air.]*

### Turn 1
*[Rain rattles on the shutters while the fair’s mud darkens the threshold, and the room gathers itself around a bare table where no exhibit yet lies. Outside, voices pass and fall away, leaving only the public question hanging in the damp air.]*
  — *declares the movement: **Act 1** ([Rain rattles on the shutters while the fair’s mud darkens the threshold, and the room gathers itself around a bare table where no exhibit yet lies. Outside, voices pass and fall away, leaving only the public question hanging in the damp air.])*
**Tutor:** Before any cupel speaks, apprentice, set the law on the table: what must a struck false shilling prove before it may name a hand? A town may shout a verdict; an assay asks for marks, and then for the joining of marks.
  — move: erotema → — (orient)
**Learner:** The law asks two chains, Warden, each complete in itself: the blank's alloy must answer to one crucible and one caster, and the die's flaw must answer to one tool and one holder — only when both chains end at the same name does the shilling name its striker. The town names Verrell; the cupel does not yet.
  — hypothesis: Verrell struck the false shillings — the town's suspicion is loud — but no mark on the metal yet grounds it; both chains (blank and die) remain unwalked.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[A clerk is shown in with the town's first deposition, and the wet seal leaves a dark ring on the table: "The town has its founder ready: Verrell alone draws the mint-yard crucible, licensed to no one else since the old assay-master's day. Whatever metal is cast in Marrick, the town says, is cast by Verrell's hand."]*
  — *releases `m_caster`*
**Tutor:** So the town gives you a crucible and a man, but mark the word it has smuggled in: mint-yard. If these shillings are to obey the assay's law, what must be shown before Verrell's licensed fire can matter at all?
  — move: erotema → m_caster (consolidate)
**Learner:** The tutor marks it well — 'mint-yard' is the smuggled word. Even granting Verrell as sole caster there, the blank's chain still needs its first link: the false shilling's own alloy must be shown to answer to that crucible's leavings before the crucible's name can touch this coin at all. One fact about a man at a furnace is half a chain; we need the metal to speak first.
  — adopts `soleCasterAt mintCrucible verrell` · hypothesis: The false shilling's alloy may answer to the mint-yard crucible's leavings — but no assay of the metal yet lies before us, so the blank's chain cannot begin.

### Turn 3
*[The clerk's paper is left to wrinkle in the damp while the shutters beat once more under the rain. No new exhibit is brought forward; the room waits on the bare place beside the deposition, where the metal itself has not yet answered.]*
**Tutor:** Good. Keep the town's paper folded under that word, and let the order of the assay stand plain: first the coin's own metal, then the furnace it answers, then the hand licensed to that furnace. A licensed hand is not yet the coin's hand; it waits outside the chain until the cupel gives the first mark.
  — move: anaphora → m_caster (consolidate)
  — *the second voice [figure rut]: "Leave off erotema for this turn; make the cupel's needed mark stand without another question." (draft erotema → anaphora)*
**Learner:** The room waits, and rightly so — no new mark has come to table. The town's deposition names a crucible and a hand, but the law asks the metal first; I cannot walk either chain without it. My board holds what it holds; both chains remain unwalked, and the verdict stays unwritten.
  — hypothesis: Both chains remain unwalked: the blank's chain needs the coin's alloy assayed against a crucible's leavings before soleCasterAt mintCrucible verrell can matter; the die's chain needs a flaw identified and traced to a tool and its holder — neither chain has its first link from the metal itself.
  ⚑ **decay** — m_caster slips from the learner's board

### Turn 4
*[Rain keeps the room close, and the clerk turns the folded deposition once with a damp thumb before leaving it where it lies. The bare table holds its silence, with the question still heavier than the town’s answer.]*
**Tutor:** Here is the cupel's first answer: these shillings are not clipped sterling, but struck poor dross — silver eked with too much copper, and a grey lead-sweat the touchstone catches at once. Clipping shaves a true coin; it does not strike a new one. What place does that give the town's mint-yard paper now: proof, or only a claim waiting for this metal's furnace?
  — move: exemplum → p_alloy (release)
**Learner:** The cupel names a debased alloy — silver cut with copper and a lead-sweat the touchstone catches — but the mint-yard paper is still only a claim: Rule 1 asks that this very alloy answer to one crucible's leavings, and that pairing has not yet been laid before us. Worse for the town's paper: Verrell's pillory-record is for clipping, which shaves a true coin — a craft wholly apart from casting new dross and striking it false. The metal has spoken its quality; it has not yet named the furnace that melted it.
  — hypothesis: The false shilling's alloy is debased — silver with excess copper and lead-sweat — per the tutor's report of the cupel's answer (spoken, not yet a formal exhibit). Even once formally exhibited, Rule 1 requires alloyOf matched to meltedAt for a specific crucible's leavings before the blank chain begins; the mint-yard license alone does not supply that match. Verrell's prior record is for clipping (shaving true coin), not striking — categorically different from casting and striking new debased coin; his history does not chain him to this crime's method. Both chains remain unwalked: blank chain needs alloy→crucible match as formal exhibit; die chain needs a flaw identified and traced to a tool and its sole holder.

## Act 2 (turns 5–10) — declared by the director
*[The rain slackens into a cold dripping from the eaves, and the room seems larger for the silence it leaves behind. A servant clears the table’s edge for heavier things, while the town’s easy answer is left damp, folded, and no longer enough.]*

### Turn 5
*[The rain slackens into a cold dripping from the eaves, and the room seems larger for the silence it leaves behind. A servant clears the table’s edge for heavier things, while the town’s easy answer is left damp, folded, and no longer enough.]*
  — *declares the movement: **Act 2** ([The rain slackens into a cold dripping from the eaves, and the room seems larger for the silence it leaves behind. A servant clears the table’s edge for heavier things, while the town’s easy answer is left damp, folded, and no longer enough.])*
  — *calls the act closed*
**Tutor:** Set the cupel back in the cleared space: these shillings are not clipped sterling, but struck poor dross, silver thinned with copper and a grey lead-sweat the touchstone catches. A clipped loaf has lost crust; this is dough mixed badly and baked anew. What does that mark prove now, and what does it still leave unfound?
  — move: exemplum → p_alloy (release), releases `p_alloy`
**Learner:** The alloy mark sets the blank chain's first link: alloyOf falseShilling drossSilver now stands. But Rule 1 demands meltedAt as well — dross-silver must answer to one crucible's leavings before blankFrom can be written. The die's chain has not a single link yet. And Verrell's record is for clipping true coin, not for casting new dross — a different hand's work entirely.
  — adopts `alloyOf falseShilling drossSilver` · hypothesis: The blank chain's first link is now grounded (alloyOf falseShilling drossSilver), but cannot proceed without meltedAt drossSilver matched to a specific crucible; the die chain has no exhibits at all; Verrell's clipper history is categorically mismatched to this new-striking crime, and neither chain yet names any hand.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 6
*[A guildman is shown in with his cap in his hands, and the clerk reads the town’s next paper aloud: “And Verrell engraves: the broad graver on his bench is his alone, the guild will swear, and no clean-cut die in the borough is sunk without it. A caster and an engraver both — the town needs no more than that.”]*
  — *releases `m_graver`*
**Tutor:** The town has now laid a graver beside its crucible, and both are Verrell's in the town's mouth. But under the die-rule, does ownership of a broad graver touch this shilling until the coin itself has shown a flaw, and that flaw has answered to that tool? What conjunct is still only shouted, not assayed?
  — move: erotema → m_graver (counter_mirror)
**Learner:** The graver's ownership is now grounded — soleHolderOf broadGraver verrell stands on my board. But Rule 4 cannot fire without Rule 3 before it, and Rule 3 demands that this shilling first show a die-flaw, and that flaw be traced to the broad graver by exhibit — not by the guild's word alone. The town has handed me the chain's last link before its first.
  — adopts `soleHolderOf broadGraver verrell` · hypothesis: The die chain now holds its terminal link — soleHolderOf broadGraver verrell — but still wants both dieFlawOf falseShilling and flawCutBy that flaw to broadGraver before Rules 3 and 4 can fire. The blank chain still wants meltedAt drossSilver matched to a crucible, and soleCasterAt that crucible to any hand. Neither chain is walkable; the question remains unsettled.
  ⚑ **decay** — p_alloy slips from the learner's board

### Turn 7
*[The clerk lets the guild paper lie open, its corners slowly lifting in the damp air. Somewhere beyond the shutters, the fair-bells sound thin and uncertain, and no one in the room reaches yet for the next bundle.]*
**Tutor:** Before I let that guild paper do any more work, read it back from your own board. What did it actually give you, and what under the die-rule did it leave still unproved?
  — move: erotema → m_graver (confront), releases `p_crucible`
  — *the second voice [unconfronted reentry]: "Confront m_graver first: make the learner read back what they hold of that exhibit before you use it again. Do not restage or consolidate it until that read-back is heard." (figure held)*
**Learner:** The guild paper gave my board one fact alone: soleHolderOf broadGraver verrell — the die chain's terminal link, held without its first two links, dieFlawOf and flawCutBy, which remain entirely wanting from the metal itself. The new exhibit meltedAt drossSilver weirCrucible would advance the blank chain through Rule 1 — but alloyOf falseShilling drossSilver, which I once called grounded, has gone missing from my board; I must name that gap and ask for it to be recovered before blankFrom can be written. Neither chain yet walks to its end.
  — adopts `meltedAt drossSilver weirCrucible` · hypothesis: If alloyOf falseShilling drossSilver is recovered to the board, then meltedAt drossSilver weirCrucible now in hand lets Rule 1 yield blankFrom falseShilling weirCrucible — the blank chain's second link; Rule 2 would then need soleCasterAt weirCrucible to close it. The die chain still wants both dieFlawOf falseShilling and flawCutBy that flaw to broadGraver before soleHolderOf broadGraver verrell can do any work at all.

### Turn 8
*[The open papers stir in the cold room, but no new hand crosses the threshold. The clerk waits with his finger on the next sealed packet, and the silence presses the table harder than any accusation.]*
**Tutor:** Then recover the cupel before any chain is walked: these shillings are not clipped sterling, but struck poor dross, silver eked with too much copper and a grey lead-sweat the touchstone catches. Clipping shaves a true coin; this metal was mixed for a new false one. Set that mark beside the furnace you just named, and tell me what Rule 1 may now write, and what it still cannot write about a hand.
  — move: exemplum → p_alloy (restore)
**Learner:** The cupel's verdict is already written on my board — alloyOf falseShilling drossSilver stands at index 4, and meltedAt drossSilver weirCrucible at index 6. Rule 1 therefore writes blankFrom falseShilling weirCrucible: the coin's blank was cast from the Weir crucible. But Rule 1 names only a furnace, never a hand; to reach a hand, Rule 2 demands soleCasterAt weirCrucible, and that sole caster has not yet appeared in any exhibit. The die chain is still without its first two links — dieFlawOf and flawCutBy — so neither chain yet closes on any person.
  — derives `blankFrom falseShilling weirCrucible` · hypothesis: If soleCasterAt weirCrucible can be established by exhibit, and if the shilling shows a die-flaw traceable to the broad graver by exhibit, then both chains may close on the same hand — but both conjuncts are still entirely wanting from the metal's own testimony.
  ⚑ **repair** — p_alloy restored by the tutor
  ⚑ **decay** — m_graver slips from the learner's board

### Turn 9
*[The clerk draws the next packet nearer but does not break its seal. Water ticks from the lintel into a basin by the door, and each drop leaves the room waiting on a hand not yet named.]*
**Tutor:** Good: the metal is shown, the furnace is shown, and the hand? Rule 1 has carried you only to a blank from a place; what kind of mark must Rule 2 have before any name may enter the book? And even then, what second chain must stay open before a struck shilling can accuse anyone?
  — move: anaphora → — (consolidate)
**Learner:** Rule 2 demands one mark alone: soleCasterAt weirCrucible — the proof that one hand, and no other, cast at that furnace; without it, the blank chain halts at the crucible and no name may enter the book. And even when that mark appears and castBlankFor is written, Rule 5 still requires cutDieFor to name the same hand — so the die chain, which wants both dieFlawOf and flawCutBy before Rules 3 and 4 may fire, must also walk to its end and meet the blank chain in the same person before any shilling can accuse anyone.
  — hypothesis: Both chains remain unwalked to a name: the blank chain holds blankFrom falseShilling weirCrucible but lacks soleCasterAt weirCrucible; the die chain has no exhibits at all — dieFlawOf and flawCutBy are entirely wanting. Until both chains close on the same hand under Rules 2 and 4, Rule 5 cannot write struckBy and the book stays empty.

### Turn 10
*[The seal breaks, and the leat-keeper's book is laid open under the clerk's hand: "The leat-keeper's book is exact. Since the forge was shut, one hand alone has drawn the weir crucible and signed for its charcoal: Edony, the founder's widow, who stayed on in the forge cottage when the fires went out."]*
  — *releases `p_caster`*
**Tutor:** The metal is shown, the weir crucible is shown, and now the hand at that crucible is shown. Read Rule 2 against those marks: what may the trial-book write about the blank, and why is that still not the struck shilling's verdict? A blank without a die is only metal waiting for the second proof.
  — move: anaphora → p_caster (consolidate)
**Learner:** The leat-keeper's book is the missing link: soleCasterAt weirCrucible edony, joined to blankFrom falseShilling weirCrucible already voiced, lets Rule 2 write castBlankFor falseShilling edony — the blank chain now names a hand, and it is not Verrell's. Yet a blank without a die is only waiting metal: the die chain holds nothing at all — no flaw identified, no tool, no holder shown — and Rule 5 cannot fire on one chain alone.
  — adopts `soleCasterAt weirCrucible edony` · derives `castBlankFor falseShilling edony` · hypothesis: The blank chain now closes on Edony, the founder's widow — not Verrell; if the die chain's evidence also names Edony (dieFlawOf, flawCutBy, soleHolderOf all walking to her hand), Rule 5 would write struckBy falseShilling edony, but not one link of the die chain yet appears before the assay.

## Act 3 (turns 11–14) — declared by the director
*[The clerk closes the heavy book, and its cover falls with a sound too final for an unfinished charge. Beyond the windows the fair-bells start again, thin and cracked in the wet air, and the room turns from metal to mark, from weight to shape.]*

### Turn 11
*[The clerk closes the heavy book, and its cover falls with a sound too final for an unfinished charge. Beyond the windows the fair-bells start again, thin and cracked in the wet air, and the room turns from metal to mark, from weight to shape.]*
  — *declares the movement: **Act 3** ([The clerk closes the heavy book, and its cover falls with a sound too final for an unfinished charge. Beyond the windows the fair-bells start again, thin and cracked in the wet air, and the room turns from metal to mark, from weight to shape.])*
  — *calls the act closed*
**Tutor:** Do not let the book's clap stand for the entry. If the blank has reached a hand, what mark must now be read before the shilling itself can speak: the metal's furnace again, or the fault the die leaves on every strike? A blank proves casting; the mark must prove cutting.
  — move: erotema → — (orient)
**Learner:** The tutor reads the gap exactly: the blank chain closes on Edony's hand at the Weir crucible, and I may now voice that derived ground aloud. But the shilling has not yet named its die — no flaw is on the record, no tool, no holder; Rules 3 and 4 stand entirely unfed, and without cutDieFor, Rule 5 cannot write the verdict. The book stays open until the die-mark speaks.
  — hypothesis: If the die chain's evidence — dieFlawOf, flawCutBy, soleHolderOf — also closes on Edony, Rule 5 would write struckBy falseShilling edony; but not one link of that chain yet appears before the assay.
  ⚑ **act_end** — act 2 closed (director) after 6 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 12
*[The watch is shown in wet-shouldered and solemn, and the room receives the sworn rest: "Verrell was seen at the mint-yard forge twice in fair-week, late and with the shutters drawn. Caster, engraver, and at the fire on the very nights — the town's case stands, and stands loud."]*
  — *releases `m_caught`*
**Tutor:** So the town has given you Verrell at the mint-yard fire, late and shuttered, with its caster and graver already in his shadow. But tell me: which conjunct does that sighting add to the assay's law, and which does it still leave untouched on the coin itself? A man near a furnace is not yet a flaw under glass.
  — move: erotema → m_caught (counter_mirror), releases `p_flaw`
**Learner:** The shilling names its flaw at last — notchedSerif is on the record, and the die chain has its first link under Rule 3. But the sighting of Verrell at the forge feeds no rule I hold: nearness to a shuttered fire is not flawCutBy, and a sworn presence is not a tool in a hand. The blank chain closes on Edony by Rules 1 and 2 together, and I may voice those derivations aloud now. The die chain still wants both flawCutBy notchedSerif and soleHolderOf before any verdict can be written.
  — adopts `dieFlawOf falseShilling notchedSerif` · hypothesis: If flawCutBy notchedSerif traces to a tool whose sole holder is Edony, Rule 5 writes struckBy falseShilling edony; if its sole holder is Verrell, the two chains name different hands and Rule 5 cannot fire for either — the shilling would have no single striker the assay could name.

### Turn 13
*[Rain frets at the panes while the coin lies under its glass, small and pale as a thing withholding speech. The room holds itself between the loud charge just heard and the finer mark still waiting to be made legible.]*
**Tutor:** Set Verrell's fire aside. Read the coin under glass back from your own board: the mark it gave, then the missing conjunct Rule 3 still waits on before any graver may enter. No tool outruns the coin; no holder outruns the tool.
  — move: anaphora → p_flaw (confront)
  — *the second voice [figure rut]: "Leave off erotema for this turn; make the confrontation of p_flaw without another question-form device." (draft erotema → anaphora)*
**Learner:** The blank chain walks cleanly under Rules 1 and 2: drossSilver answered to weirCrucible, and weirCrucible's sole caster was Edony — blankFrom and castBlankFor both derive and I voice them now. The die chain has its opening mark — notchedSerif is on the board — but Rule 3 sits idle without flawCutBy notchedSerif to name the tool. seenAtForge is the town's voice, not the coin's; nearness to a forge is not flawCutBy, and I will not adopt it in the tool's place. The book stays open: castBlankFor edony stands grounded, and the verdict waits on the flaw's tool and its holder.
  — hypothesis: If flawCutBy notchedSerif traces to a tool whose sole holder is Edony, Rule 5 writes struckBy falseShilling edony; if to Verrell, the two chains name different hands and Rule 5 cannot fire — no verdict can be written for either.

### Turn 14
*[The lamp is trimmed lower, and the coin's pale rim wavers in the glass as if the room itself cannot keep it still. No one reaches for the book; the silence narrows instead around the mark already seen and the hand not yet named.]*
**Tutor:** The glass has given only the fault, not yet the tool: a mark is a door, not the room beyond it. If the notched serif is the coin's first word in the die-chain, what exact conjunct must answer it before any bench, graver, or holder may be heard? Keep the blank's hand written, but do not let it strike without this second proof.
  — move: erotema → p_flaw (consolidate)
**Learner:** Rule 3 holds one door open: dieFlawOf falseShilling notchedSerif is on the board, but the conjunct it still waits on is flawCutBy notchedSerif naming a tool — without that, no bench or graver may be heard. The blank chain I can close now under Rules 1 and 2, and I voice both steps: drossSilver answered to weirCrucible, and weirCrucible's sole caster was Edony. seenAtForge is the watch's word, not the coin's — nearness to a shuttered forge is not flawCutBy, and I will not write it in the tool's place.
  — hypothesis: If flawCutBy notchedSerif traces to a tool whose sole holder is Edony, Rule 5 writes struckBy falseShilling edony; if to Verrell, the two chains name different hands and Rule 5 cannot fire — no verdict can be written for either.

## Act 4 (turns 15–19) — declared by the director
*[The clerk draws the green cloth over the coin-glass, and the room seems darker for the small light it hides. Outside, the rain slackens to a cold ticking from the eaves, and the next silence comes harder, narrower, waiting for tool and hand to be made answerable.]*

### Turn 15
*[The clerk draws the green cloth over the coin-glass, and the room seems darker for the small light it hides. Outside, the rain slackens to a cold ticking from the eaves, and the next silence comes harder, narrower, waiting for tool and hand to be made answerable.]*
  — *declares the movement: **Act 4** ([The clerk draws the green cloth over the coin-glass, and the room seems darker for the small light it hides. Outside, the rain slackens to a cold ticking from the eaves, and the next silence comes harder, narrower, waiting for tool and hand to be made answerable.])*
  — *calls the act closed*
**Tutor:** Before the cloth lifts, read back the last mark from your own board: what did the coin itself give you, and what does Rule 3 still require before any tool may be admitted? Do not bring me a bench, a holder, or a name; bring me the coin's mark and the missing conjunct.
  — move: erotema → p_flaw (confront)
**Learner:** The coin gave me one mark only: dieFlawOf falseShilling notchedSerif — the notched serif, read from the face itself. Rule 3 wants two conjuncts; I hold the first. The missing conjunct is flawCutBy notchedSerif, naming the one tool that cuts that precise flaw — until the table supplies it, no tool, no bench, no hand may be written in the die chain.
  — hypothesis: If flawCutBy notchedSerif traces to a tool whose sole holder is Edony, Rule 5 writes struckBy falseShilling edony; if to Verrell, the two chains name different hands and Rule 5 cannot fire — no verdict can be written for either.
  ⚑ **act_end** — act 3 closed (director) after 4 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 16
*[The cloth remains over the glass, its edge dark with damp from the clerk's sleeve. The room waits without moving, the hidden coin making a small absence at the center of the table.]*
**Tutor:** Then lift the cloth and call the die-sinker to the glass: he reads the notched serif as the bite of a worn burin with a sprung heel, a tool that signs each line with that square fault; it is not Verrell's broad graver, which cuts clean. A crack in a touchstone tells one stone from another; so this notch must tell tool from tool. Set that beside the coin's mark and say what Rule 3 may now write, and what hand it still cannot name.
  — move: exemplum → p_graver (release), releases `p_graver`
**Learner:** Rule 3 fires at last: the coin gives dieFlawOf falseShilling notchedSerif, and the sinker gives flawCutBy notchedSerif wornBurin — therefore dieCutWith falseShilling wornBurin. The sinker names that burin distinct from Verrell's broad graver, which cuts clean; the tool itself already clears the town's man from the die chain. Yet Rule 4 still wants soleHolderOf wornBurin before any hand may be written — the die chain stops at the tool, and the blank chain closes on Edony alone.
  — adopts `flawCutBy notchedSerif wornBurin` · derives `dieCutWith falseShilling wornBurin` · hypothesis: The blank chain closes on Edony; if soleHolderOf wornBurin is also Edony, Rule 5 writes struckBy falseShilling edony. If the worn burin belongs to another hand, the two chains split and Rule 5 cannot fire for any party — no verdict may be written until the burin's sole holder is brought before the glass.

### Turn 17
*[The covered glass is left untouched, and the damp green cloth lies like a sealed lid over the table's center. A coal shifts in the grate; no one in the room mistakes the small sound for an answer.]*
**Tutor:** Before that tool does another ounce of work, read back the die-sinker's exhibit from your own board. What did it give you, in your words, and what did Rule 3 write from it? Leave the holder and the verdict outside the room until you have shown me that mark held straight.
  — move: erotema → p_graver (confront)
  — *the second voice [unconfronted reentry]: "Confront p_graver first: make the learner read back what they hold of that exhibit before you use it again." (draft anaphora → erotema)*
**Learner:** The coin's own mark is index 7: dieFlawOf falseShilling notchedSerif, read from the face. The die-sinker's exhibit is index 8: flawCutBy notchedSerif wornBurin — that worn burin with the sprung heel signs each line with the notched serif, and no other tool answers to it. Rule 3 fires on those two conjuncts together: dieCutWith falseShilling wornBurin, already voiced at turn 16. The die chain rests there; Rule 4 still wants soleHolderOf wornBurin before any hand may be written.
  — hypothesis: If soleHolderOf wornBurin is Edony, Rule 4 writes cutDieFor falseShilling edony, and Rule 5 then writes struckBy falseShilling edony — the blank and die chains converging on one hand. If the burin belongs to another hand, the two chains split and Rule 5 cannot fire for any party.

### Turn 18
*[The die-sinker's paper is folded once and left beside the veiled coin, its crease sharp under the clerk's thumb. The rain has thinned to a beadwork ticking along the sill, and every face in the room turns toward the empty place where a keeper's name has not yet been set down.]*
**Tutor:** The flaw is shown, the tool is shown, and the hand? Rule 3 has cut the die no farther than the worn burin; what exact mark must Rule 4 have before that burin may be put into anyone's keeping? Do not spend the blank's hand here: the die must find its own holder before the two chains can meet.
  — move: anaphora → p_graver (consolidate)
**Learner:** Rule 4 wants exactly one mark before the burin passes into any keeping: soleHolderOf wornBurin ?x — a grounded exhibit naming the one hand that alone held that worn burin with the sprung heel. Without it, dieCutWith falseShilling wornBurin sits at the die chain's end but cannot yield cutDieFor. The blank chain closes on Edony by its own evidence, and I must not borrow her name to fill the die chain's gap — that would be writing the verdict before the metal has spoken its last word.
  — hypothesis: If soleHolderOf wornBurin is Edony, Rule 4 writes cutDieFor falseShilling edony, and Rule 5 then writes struckBy falseShilling edony — the blank and die chains converging on one hand. If the burin belongs to another hand, the two chains split and Rule 5 cannot fire for any party.

### Turn 19
*[The clerk's pen hovers above the margin and does not descend. Beyond the shutters, the last drops strike at longer intervals, making the silence between them broad enough for a name and still empty of one.]*
**Tutor:** Then let the pen hover where the law leaves it. The flaw is shown, the tool is shown, and the keeper? Name the shape of the missing entry only: what must the estate-book prove before Rule 4 may write the die as any hand's work?
  — move: anaphora → — (test)
**Learner:** The estate-book must prove exactly this: soleHolderOf wornBurin ?x — one name written against that tool and no other, exclusive custody and no joint keeping. A record that two hands shared the burin, or that its keeper is unknown, leaves Rule 4 without its second conjunct and the die chain stalled at dieCutWith falseShilling wornBurin. One name, one hand, sole holder — that is the shape of what the pen still waits for.
  — hypothesis: If soleHolderOf wornBurin is Edony, Rule 4 writes cutDieFor falseShilling edony, and Rule 5 then writes struckBy falseShilling edony — the blank and die chains converging on one hand. If the burin belongs to another hand, the two chains split and Rule 5 cannot fire for any party.

## Act 5 (turns 20–21) — declared by the director
*[The clerk lowers the pen at last without writing, and the dry point rests against the margin like a stopped needle. The room takes on the stillness before a seal is broken: not wider, but closer, with every breath waiting on custody rather than suspicion.]*

### Turn 20
*[The clerk lowers the pen at last without writing, and the dry point rests against the margin like a stopped needle. The room takes on the stillness before a seal is broken: not wider, but closer, with every breath waiting on custody rather than suspicion.]*
  — *declares the movement: **Act 5** ([The clerk lowers the pen at last without writing, and the dry point rests against the margin like a stopped needle. The room takes on the stillness before a seal is broken: not wider, but closer, with every breath waiting on custody rather than suspicion.])*
  — *calls the act closed*
**Tutor:** You have carried the die no farther than a tool, and you have named the custody-shaped gap. Before the seal breaks, what must stay written beside that gap so the next book cannot become a verdict too soon? A keeper may close the die-chain; it does not strike the coin until the other chain meets it.
  — move: erotema → — (orient)
**Learner:** What must stay written is this: the die chain reaches only as far as the burin — dieCutWith falseShilling wornBurin — and halts there until soleHolderOf wornBurin is brought before the glass. A keeper who held the tool in custody is not the hand that cut the die unless sole custody is shown by exhibit, not by suspicion. And even then, Rule 5 will not write a verdict unless that same hand holds castBlankFor falseShilling as well — both chains must converge on one name, or the book stays empty. The gap I name aloud: soleHolderOf wornBurin, unknown; the blank chain closes on Edony, and the die chain must meet her there, or meet no one at all.
  — hypothesis: If soleHolderOf wornBurin is Edony, Rule 4 writes cutDieFor falseShilling edony, and Rule 5 then writes struckBy falseShilling edony — the blank and die chains converging on one hand. If the burin belongs to another hand, the two chains split and Rule 5 cannot fire for any party.
  ⚑ **act_end** — act 4 closed (director) after 5 turns
  ⚑ **plot** — act 5 plot committed
  ⚑ **plot_audit** — act 4 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 21
*[The sealed book remains just beyond the lamp's full reach, its cord casting a thin shadow across the table. No one touches it; the room holds its breath around the unwritten line.]*
**Tutor:** The seal is still unbroken, so keep the pen above the line and not on it. If the next book gives custody, what must you derive first from tool and holder before the assay may even look toward the final joining? And when that die-chain closes, what other finished chain must be brought back beside it before any struck-by entry can be written?
  — move: erotema → — (test)
**Learner:** Three links already derive from the board without any new exhibit: the blank chain closes on Edony via Rules 1 and 2, and Rule 3 carries the die chain to dieCutWith falseShilling wornBurin — but there it halts. When custody gives soleHolderOf wornBurin, Rule 4 must fire next — tool plus sole-holder yields cutDieFor — and that is the only step still wanting before the joining can be attempted. Only then may Rule 5 set castBlankFor falseShilling edony beside cutDieFor falseShilling ?x and ask whether both names are one. The blank chain is already finished and on the record; the die chain needs one more link before the seal may break.
  — hypothesis: If soleHolderOf wornBurin is Edony, Rule 4 writes cutDieFor falseShilling edony, and Rule 5 then writes struckBy falseShilling edony — the blank and die chains converging on one hand. If the burin belongs to another hand, the two chains split and Rule 5 cannot fire for any party.
  ⚑ **disengagement** — no progress over 6 turns
  ⚑ **plot_audit** — act 5 plot audited at run end: kept 5, justified 1, drift 0; arc on_arc; throughline reckoned (7 clauses)

## Instrument panel (programmatic eval — no judge)

- **verdict** `disengagement` · 21/28 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0.238 D/turn overall (D 6→1 over 21 turns)
  - Act 1 (turns 1–4): 0 D/turn (ΔD 0)
  - Act 2 (turns 5–10): 0.5 D/turn (ΔD 3)
  - Act 3 (turns 11–14): 0.25 D/turn (ΔD 1)
  - Act 4 (turns 15–19): 0.2 D/turn (ΔD 1)
  - Act 5 (turns 20–21): 0 D/turn (ΔD 0)
- **plateau** longest flat stretch 5 turns (aporia window 6)
- **releases** 4/9 on cue · 4 deviated
- **decay** 3 slips (seed 1 · rate 0.75 · grace 1) · repaired 1 (tutor 1, re-adoption 0) · mean repair latency 2 turns · unrepaired at end 2 · degraded-turn integral 33 · D reversals 0
- **theory fidelity** F 0.75 at end · min 0.727
  - m_caster t3 (never repaired) · p_alloy t6→t8 (tutor) · m_graver t8 (never repaired)
- **events** plot×5 · throughline×1 · decay×3 · act_end×4 · plot_audit×5 · repair×1 · disengagement×1
- **staging** 5 movements declared by the director
- **acts** 5 played · closed by the director 4 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–10 (director) · Act 3 t11–14 (director) · Act 4 t15–19 (director) · Act 5 t20–21 (run end)
- **plot** 5 committed · withhold+friction on 5/5 · 6 clauses avg · audits 5 (incl. final act): kept 29 / justified 1 / drift 0 · hold-named exhibits staged in act 1/2
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 5: on 5 / off 0 · run-end reckoning 7 clauses: kept 5 / justified 0 / drift 2
- **release authority** 4 played: 0 on schedule · 1 held · 3 early · forced at hold limit 0 · overridden 3 · invalid claims 0
  - p_alloy +1 (t5): "Held one turn so the act opens with the metal itself, not the town's folded answer."
  - p_crucible -1 (t7): "p_crucible pushed: page stalling (lines shortening -36.0)"
  - p_flaw -2 (t12): "p_flaw pushed: page stalling (lines shortening -25.5)"
  - p_graver -2 (t16): "Played two turns early because the learner has named Rule 3's missing flawCutBy exactly and the page has gone four turns without a release."
- **confrontation** 4 demanded (0 against a slipped exhibit) · re-entries 3: covered 2, uncovered 1 · watcher fires 2 (became the confrontation 2) · fires without recorded due 0
  - uncovered: m_caster t3 (consolidate)
  - **repair clause** restores 1 (1 repaired a real slip) · watcher fires on restore claims 0: p_alloy t8
- **figures** erotema 11/21 (52%) · 3 distinct · switch rate 0.60
- **superego** intervened 4/21 watched turns · figure changed within-turn on 3/4 interventions · switch on intervention 0.75 vs elsewhere 0.56
- **inference** 3 voiced · stall integral 0 · overreach 0 · mischanneled 0 — `blankFrom falseShilling weirCrucible` available t8 → voiced t8 (latency 0) · `castBlankFor falseShilling edony` available t10 → voiced t10 (latency 0) · `dieCutWith falseShilling wornBurin` available t16 → voiced t16 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 21 | 3 | 3 | 43.2 |
| tutor | 21 | 2.81 | 3 | 55 |
| learner | 21 | 3.33 | 5 | 81.4 |
