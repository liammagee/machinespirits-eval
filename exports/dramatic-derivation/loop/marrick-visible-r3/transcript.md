# The Light Shillings — marrick-visible-r3

> world `world_005_marrick` · verdict **disengagement** · 21/28 turns

```
D= 6 ●●●●│······│·····│······
D= 5     │●·●●●·│·····│······
D= 4     │ ●   ●│●····│······
D= 3     │      │ ●●··│······
D= 2     │      │   ●●│······
D= 1     │      │     │●●●●●●
D= 0     │      │     │      
turn      │+    1│    +│    2  (+=5, digit=x10)
rel    ▲  │▲▲   ▲│ ▲ ▲ │▲      (▲ = evidence released)
slope 0.24 D/turn overall (D 6→1); per movement: 1 0.00 │ 2 0.33 │ 3 0.40 │ 4 0.17
```

## Act 1 (turns 1–4) — declared by the director
*[Rain hammers the shutters while the hearing room gathers itself around an empty table and a locked strongbox. Beyond the door, the fair's noise comes broken and wet, as if the town has already chosen its answer.]*

### Turn 1
*[Rain hammers the shutters while the hearing room gathers itself around an empty table and a locked strongbox. Beyond the door, the fair's noise comes broken and wet, as if the town has already chosen its answer.]*
  — *declares the movement: **Act 1** ([Rain hammers the shutters while the hearing room gathers itself around an empty table and a locked strongbox. Beyond the door, the fair's noise comes broken and wet, as if the town has already chosen its answer.])*
**Tutor:** Set the town's noise outside the assay-room, lad. Before any name enters this book, what must a struck false shilling prove: only a hated man, or the metal, the die, and the hand that brings them together?
  — move: erotema → — (orient)
**Learner:** The metal must speak first, master — alloy to crucible, crucible to caster's hand; then the die-flaw to the graving-tool, tool to the cutter's hand; and only when both hands are the same hand does the rule yield a striker. A hated man is not evidence; the balance and the touch-needle are.
  — hypothesis: Verrell is the likely suspect by town repute, but his history is clipping — and the shilling was struck, not clipped; no metal, crucible, die-flaw, or tool yet entered on the board.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[The clerk lifts a wet paper from the strongbox and reads it into the room: "The town has its founder ready: Verrell alone draws the mint-yard crucible, licensed to no one else since the old assay-master's day. Whatever metal is cast in Marrick, the town says, is cast by Verrell's hand."]*
  — *releases `m_caster`*
**Tutor:** So the town offers a licensed crucible and calls that a hand on these shillings. Which mark has it shown us yet: the metal of the coins answering to that crucible, or only Verrell's right to draw it?
  — move: erotema → m_caster (counter_mirror)
**Learner:** The town gives us one link only, master: Verrell sole at the crucible. But the rule demands we first show the false shilling's alloy answers to that crucible's melt — without the assay of the metal itself, the license is a title, not a chain. And we have no die-flaw entered at all; half the proof is not yet on the table.
  — adopts `soleCasterAt mintCrucible verrell` · hypothesis: Verrell's sole license at mintCrucible is the first link in the blank-casting chain, but alloyOf falseShilling and meltedAt remain absent — as does all die-flaw evidence; no conclusion follows yet.

### Turn 3
*[The rain slackens just enough for the fair-bells to sound through the shutters, thin and uncertain. On the empty table, the clerk sets out a clean cloth and waits with ink drying on the last entry.]*
**Tutor:** Before cupel, before balance, before any new paper: read back the wet paper already entered. In your own words, what does it claim, and what does it still fail to bind to these shillings?
  — move: anaphora → m_caster (confront)
  — *the second voice [unconfronted reentry]: "Confront m_caster first: ask the learner to read back what they hold of that exhibit before you use it again. Leave erotema off this turn." (draft erotema → anaphora)*
**Learner:** The wet paper claims Verrell holds the sole license on the mint-yard crucible — so fact 4 stands: soleCasterAt mintCrucible verrell. But it binds nothing to these shillings: it never says the false coins' alloy answers to that crucible's melt, so blankFrom stays ungrounded, and the caster's chain snaps at its first link. Worse, the paper says nothing of any die-flaw or graving-tool — the cutter's chain has not even a first link. Two facts the town has not yet put before us: what the metal of this shilling is, and whether any flaw on its face names a tool.
  — hypothesis: Verrell may prove to be both caster and die-cutter, but the assay of the shilling's alloy and identification of its die-flaw are both absent; without them, the rules yield nothing toward struckBy.
  ⚑ **decay** — m_caster slips from the learner's board

### Turn 4
*[The clerk closes the wet paper and lays a blank docket beside it, its seal unstamped. Rain gathers again at the shutters, and the strongbox waits unopened under the room's listening silence.]*
**Tutor:** Then let the cupel answer the first lack. The assay is plain: these shillings are not clipped sterling, but struck poor dross, silver eked with too much copper and a grey lead-sweat the touchstone catches at once; clipping shaves a true coin, lad, but this metal was made for a new blow. A loaf betrays its flour before it names the baker — what does struck-from-dross fix that the town's license did not?
  — move: exemplum → p_alloy (release)
**Learner:** Struck-from-dross names the alloy — that is Rule 1's first foot: alloyOf falseShilling [this dross-metal]. The license gave us only Rule 2's condition: who stands at the crucible. The chain still wants the middle step: that this same dross-metal answers to the leavings of Verrell's crucible and no other — meltedAt. Without an assay of the crucible's waste to match this grey lead-sweat, we know what the coin is made of but not where that metal was cast.
  — hypothesis: The shilling's alloy is a debased dross (copper-heavy, lead-sweated silver); if the leavings of Verrell's mintCrucible match this specific alloy (meltedAt), Rule 1 fires and blankFrom follows — but meltedAt is still absent from the table, and all die-flaw evidence remains absent; the board cannot yet yield struckBy.

## Act 2 (turns 5–10) — declared by the director
*[The clerk clears the table to bare wood, leaving the strongbox shut and the wet light pooled beneath the shutters. The room settles into a colder patience; the noise of accusation thins, and the next pressure gathers around origins rather than names.]*

### Turn 5
*[The clerk clears the table to bare wood, leaving the strongbox shut and the wet light pooled beneath the shutters. The room settles into a colder patience; the noise of accusation thins, and the next pressure gathers around origins rather than names.]*
  — *declares the movement: **Act 2** ([The clerk clears the table to bare wood, leaving the strongbox shut and the wet light pooled beneath the shutters. The room settles into a colder patience; the noise of accusation thins, and the next pressure gathers around origins rather than names.])*
  — *calls the act closed*
**Tutor:** Set the strongbox aside and keep the cupel before you. Its mark is the first origin: these shillings are struck poor dross, not clipped sterling; the metal names a making, but not yet a hearth. What origin must answer that lead-sweat before any caster's hand can enter the rule?
  — move: exemplum → p_alloy (release), releases `p_alloy`
**Learner:** The shilling has named its metal at last: dross-silver, base and lead-sweated. But Rule 1 demands both halves — alloyOf is now on my board, yet meltedAt drossSilver ?crucible is still absent; the metal floats without a hearth. Until the assay matches this specific dross to the leavings of one crucible and one only, no caster's hand may enter. The alloy has spoken; the hearth must answer next.
  — adopts `alloyOf falseShilling drossSilver` · hypothesis: The dross-silver alloy of the false shilling may match the leavings of a specific crucible (meltedAt drossSilver ?crucible); if so, Rule 1 fires and blankFrom follows — but meltedAt remains absent, and all die-flaw evidence is still missing; struckBy cannot yet be settled.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 5, justified 0, drift 0; arc on_arc

### Turn 6
*[A guildman is shown in, rain silvering his shoulders, and the clerk sets down his sworn note before the cupel: "And Verrell engraves: the broad graver on his bench is his alone, the guild will swear, and no clean-cut die in the borough is sunk without it. A caster and an engraver both — the town needs no more than that."]*
  — *releases `m_graver`*
**Tutor:** Now the town adds a graver to its crucible and calls two titles a proof. What has the guildman actually bound to these shillings: a flaw on their faces answering to Verrell's broad graver, or only Verrell's right hand at a clean bench? Keep the cupel beside it: the metal still wants its hearth, and the die still wants its mark.
  — move: erotema → m_graver (counter_mirror), releases `p_crucible`
**Learner:** The hearth answers at last: drossSilver melted at weirCrucible, and Rule 1 fires — blankFrom falseShilling weirCrucible is now grounded on my board. But the guildman has named Verrell sole holder of the broad graver, not shown its mark on these coins' faces; dieFlawOf and flawCutBy are both absent. And weirCrucible still wants a soleCasterAt before Rule 2 can name any hand. Two chains, two gaps — the hearth is found, but neither blank nor die is yet cast to Verrell's hand.
  — adopts `soleHolderOf broadGraver verrell`, `meltedAt drossSilver weirCrucible` · derives `blankFrom falseShilling weirCrucible` · hypothesis: Verrell may prove soleCasterAt weirCrucible and the false shilling's die-flaw may answer to the broadGraver via some flawCutBy link — but soleCasterAt weirCrucible, dieFlawOf falseShilling, and flawCutBy are all absent; neither castBlankFor nor cutDieFor can yet be derived, and struckBy remains unsettled.
  ⚑ **decay** — p_alloy slips from the learner's board

### Turn 7
*[Rain ticks steadily against the shutters, and the cupel’s small stain darkens as the room waits on the next hand to be named. The strongbox remains closed; the clerk’s pen hovers above a blank line, unwilling to make accusation do the work of proof.]*
**Tutor:** Good: a hearth is now claimed on your board, but a hearth is not yet a hand. If Rule 1 has carried you from metal to blank-from, what exact conjunct must Rule 2 still receive before any name enters the caster line?
  — move: erotema → — (test)
**Learner:** Rule 2 wants soleCasterAt weirCrucible ?x — the one name bound to that hearth as sole caster. The blank is now traced to weirCrucible, but the crucible has not yet named its caster; the hearth is found, the hand is not. No new exhibits lie on the table, so that conjunct remains empty and Rule 2 cannot fire. Until soleCasterAt weirCrucible enters the board, no caster's name may follow from the blank.
  — hypothesis: Verrell may prove soleCasterAt weirCrucible — his twice-pilloried history and bench at the mint-yard suggest it — but soleCasterAt weirCrucible is still absent from the table; castBlankFor cannot be derived, and the die-flaw chain (dieFlawOf, flawCutBy) is likewise empty; struckBy remains unsettled.

### Turn 8
*[The room holds its breath under the rain, the closed strongbox squatting like a second hearth gone cold. The clerk sands nothing, seals nothing, and the bare wood between the cupel and the waiting line seems wider than before.]*
**Tutor:** Set the town's papers aside and put your finger on the crucible paper alone. Read what it bound; read what it did not bind; read where the caster's line still waits. No name yet — only the marks your own board can bear.
  — move: anaphora → p_crucible (confront)
  — *the second voice [figure rut]: "Leave off erotema for this turn; confront the crucible paper without casting it as another question." (draft erotema → anaphora)*
**Learner:** The crucible paper binds drossSilver to weirCrucible — and that, with the shilling's alloy, settled blankFrom on the record. What it did not bind is any caster's name: soleCasterAt weirCrucible stands nowhere on my board, and Rule 2 cannot fire without it. The broad graver is Verrell's alone, but the die-chain still wants dieFlawOf and flawCutBy before that sole-holdership speaks to these coins. Both chains are open; the caster's line waits on a name the crucible paper never gave.
  — hypothesis: soleCasterAt weirCrucible ?x remains absent — the crucible paper named the hearth and the metal, not the hand; until that conjunct arrives, castBlankFor cannot be derived; the die-flaw chain (dieFlawOf falseShilling, flawCutBy) is likewise empty; struckBy is unsettled by the board as it stands.

### Turn 9
*[The rain slackens without clearing, leaving the shutters silvered and the room listening to its own restraint. The clerk keeps the blank line open, and no hand moves to fill it.]*
**Tutor:** The alloy is shown, the hearth is shown, and so the blank may be traced; but the caster's hand is not yet written. What does that give you under Rule 1, and what exact word must the book still lack before Rule 2 may move? Let the chain close only as far as the marks permit.
  — move: anaphora → p_crucible (consolidate)
**Learner:** Rule 1 has already carried me as far as it may: blankFrom falseShilling weirCrucible stands on the record, drawn from alloyOf and meltedAt together. Rule 2 now holds that conclusion in one hand and waits on a single absent word for the other — soleCasterAt weirCrucible ?x. No exhibit has named any caster to that hearth, so the conjunct is empty and no hand may follow from the blank. The chain closes at the crucible; it cannot reach a name.
  — hypothesis: soleCasterAt weirCrucible ?x remains absent — no exhibit has named who cast at that hearth; until it arrives, castBlankFor cannot be derived and struckBy is unsettled; the die-flaw chain (dieFlawOf falseShilling, flawCutBy) is likewise empty.

### Turn 10
*[The clerk opens the leat-keeper's book and reads it into the cold room: "The leat-keeper's book is exact. Since the forge was shut, one hand alone has drawn the weir crucible and signed for its charcoal: Edony, the founder's widow, who stayed on in the forge cottage when the fires went out."]*
  — *releases `p_caster`*
**Tutor:** The leat-book has set a hand beside the weir crucible; a blank takes its witness from the hearth as a cupel takes its witness from the stain. Read Rule 2 against your board, and close the blank only as far as the rule permits. Then keep the die uncovered: what mark has not yet been shown before a struck shilling can be laid to any hand?
  — move: exemplum → p_caster (stage_recognition)
  — *the second voice [figure rut]: "Leave off anaphora here. Change the sentence-shape before speaking so the recognition does not arrive in the same cadence for a third turn." (draft anaphora → exemplum)*
**Learner:** The leat-book sets Edony's hand beside the weir crucible alone — soleCasterAt now fills what the blank-chain lacked, and Rule 2 fires: castBlankFor falseShilling edony stands on the record. But the die-flaw chain is still open; no exhibit has shown dieFlawOf the false shilling, nor flawCutBy linking any flaw to any tool. Without cutDieFor, Rule 5 cannot speak and struckBy waits still.
  — adopts `soleCasterAt weirCrucible edony` · hypothesis: Edony is confirmed as sole caster at the weir crucible and castBlankFor now settles on her — but the die-flaw chain (dieFlawOf falseShilling, flawCutBy ?flaw ?tool) is still absent; if the flaw answers to Verrell's broadGraver, no single hand holds both blank and die and struckBy cannot follow; if the flaw answers to a tool Edony alone held, she may prove the striker.
  ⚑ **overreach** — castBlankFor falseShilling edony

## Act 3 (turns 11–15) — declared by the director
*[The clerk closes the book and leaves the table bare again, as if one chain laid down has made the room more uneasy rather than less. Beyond the shutters the fair's clamor returns in broken gusts, and the next act opens with a sharper noise pressing against the cold patience of the record.]*

### Turn 11
*[The clerk closes the book and leaves the table bare again, as if one chain laid down has made the room more uneasy rather than less. Beyond the shutters the fair's clamor returns in broken gusts, and the next act opens with a sharper noise pressing against the cold patience of the record.]*
  — *declares the movement: **Act 3** ([The clerk closes the book and leaves the table bare again, as if one chain laid down has made the room more uneasy rather than less. Beyond the shutters the fair's clamor returns in broken gusts, and the next act opens with a sharper noise pressing against the cold patience of the record.])*
  — *calls the act closed*
**Tutor:** The book has closed, but I will not write the verdict where only the blank has spoken. Read back the last caster line from your own board: what did it let Rule 2 yield, and what did it still leave untouched on the face of the coin?
  — move: erotema → p_caster (confront)
**Learner:** Rule 2, with soleCasterAt weirCrucible edony now grounded, stands ready to yield castBlankFor falseShilling edony — but only if blankFrom is already in hand, and blankFrom itself needs alloyOf falseShilling drossSilver, which I cannot find on my board though my own reckonings named it as early as turn four. That absence is a gap I must declare aloud: the alloy was identified in evidence before this act but has not survived onto the board. What Rule 2 leaves untouched is the whole face of the coin: dieFlawOf falseShilling, flawCutBy, dieCutWith, cutDieFor — none of these stand anywhere on the board. Without the die chain, even a restored blank-side derivation cannot settle struckBy.
  — hypothesis: alloyOf falseShilling drossSilver was established in evidence before Act 3 (hypotheses at turns 4–5 named the dross alloy as if grounded) but appears absent from the board now — a likely gap caused by the act boundary; if restored, Rule 1 yields blankFrom falseShilling weirCrucible, and Rule 2 then yields castBlankFor falseShilling edony; the die-flaw chain (dieFlawOf falseShilling, flawCutBy ?flaw ?tool, dieCutWith, cutDieFor) is entirely absent and must arrive before struckBy can be settled under Rule 5.
  ⚑ **act_end** — act 2 closed (director) after 6 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 5, justified 1, drift 0; arc on_arc

### Turn 12
*[The watch is shown in under dripping cloaks, and the room tightens as their oath is read aloud: "The watch will swear to the rest: Verrell was seen at the mint-yard forge twice in fair-week, late and with the shutters drawn. Caster, engraver, and at the fire on the very nights — the town's case stands, and stands loud."]*
  — *releases `m_caught`*
**Tutor:** First mend the hole you named: the cupel showed these shillings are no clipped sterling, but struck poor dross, silver eked with too much copper and a grey lead-sweat the touchstone catches at once. Clipping shaves a true coin; this metal was made for a new blow. Now set the watch's noise beside that restored mark: what does being seen at a forge add to alloy, hearth, caster, flaw, and tool?
  — move: exemplum → p_alloy (restore)
**Learner:** The alloy being dross-silver restores Rule 1 at once: blankFrom falseShilling weirCrucible, and Rule 2 follows immediately — castBlankFor falseShilling edony, for no other hand cast at that hearth. The watch's oath adds nothing the rules can touch: being seen at a forge is not casting, not graving, and no rule names mere presence. What seenAtForge truly reveals is a danger in the reasoning: if the die-flaw answers to Verrell's broadGraver, cutDieFor names Verrell while castBlankFor names Edony — two hands, not one, and Rule 5 yields nothing for either. The board cannot settle struckBy until dieFlawOf and flawCutBy arrive and point both chains to the same hand.
  — adopts `seenAtForge verrell fairWeek` · derives `castBlankFor falseShilling edony` · hypothesis: If dieFlawOf falseShilling names a flaw that flawCutBy links to broadGraver, then cutDieFor points to Verrell — but castBlankFor already points to Edony; Rule 5 requires both chains in one hand, so struckBy remains unsettled unless the die chain also resolves to Edony via some tool she alone held.
  ⚑ **repair** — p_alloy restored by the tutor
  ⚑ **decay** — m_graver slips from the learner's board

### Turn 13
*[Rain ticks along the shutter seams, and the clerk's dry table seems larger for having nothing on it. The watchmen wait by the door with their caps in their hands while the room holds its breath around the unanswered face of the coin.]*
**Tutor:** Before we let any bench-title touch the coin's face, read back the guildman's paper from your own board. What did that exhibit claim, and what did it not yet bind to these shillings? Give me the mark it left empty, not the town's noise around it.
  — move: erotema → m_graver (confront)
  — *the second voice [unconfronted reentry]: "Confront first: ask the learner to read back what they hold of that exhibit, without restaging or summarizing it for them." (figure held)*
**Learner:** The guildman's paper named the hearth — weirCrucible — and the metal it held — drossSilver — and the hand licensed to cast there: Edony, sole caster. It completed the blank chain entire. But the mark it left empty is the face of the coin: no dieFlawOf, no flawCutBy, no tool, no cutter — the die side has not a single link from any paper yet produced.
  — hypothesis: The die-face chain — dieFlawOf falseShilling, flawCutBy ?flaw ?tool, dieCutWith, cutDieFor — has no entry on the board at all; until a flaw is named and bound to a sole tool-holder, Rule 5 cannot fire for any hand, including Edony's.

### Turn 14
*[The rain slackens, leaving the shutters dark and wet while the untouched coins lie under the lamp. No hand reaches for them yet; the room waits on the face of each shilling as if the metal itself has gone silent.]*
**Tutor:** Before any new mark is laid under the glass, put your hand back on the guildman's paper. In your own words only: what did that exhibit claim, and what did it still fail to bind to these shillings? Read the empty place it left in Rule 3, not the town's verdict around it.
  — move: erotema → m_graver (confront), releases `p_flaw`
  — *the second voice [unconfronted reentry]: "Confront m_graver first: make the learner read back what they hold of that exhibit, without restaging its content yet." (draft anaphora → erotema)*
**Learner:** The guildman's paper named alloy, crucible, and sole caster — the blank chain entire — but left dieFlawOf falseShilling wholly blank; without a named flaw on the coin's face, Rule 3 has nothing to open on. The new exhibit now supplies that first link: the shilling bears notchedSerif. But Rule 3 still needs flawCutBy notchedSerif to name a tool, and Rule 4 needs a sole holder before cutDieFor can follow — the die chain is open at last, yet not yet closed.
  — adopts `dieFlawOf falseShilling notchedSerif` · hypothesis: If flawCutBy notchedSerif answers to a tool whose sole holder is Edony, then cutDieFor names Edony and Rule 5 can fire — but flawCutBy notchedSerif and soleHolderOf that tool are both still absent from the board.

### Turn 15
*[The lamp gutters once and steadies, throwing the same pale rims of coinlight across the bare table. Outside, the fair noise thins to wheels in wet ruts, while inside no one breaks the pause around the unanswered cut in the silver.]*
**Tutor:** Before that paper hardens crooked, take it back into your own hands. What did the guildman's paper claim, and what did it still fail to bind to these shillings? Read only what your board holds of it, and leave the town's verdict outside the line.
  — move: erotema → m_graver (confront)
  — *the second voice [unconfronted reentry]: "Confront m_graver first: demand the learner's read-back of what they hold of that exhibit before you restage it." (draft anaphora → erotema)*
**Learner:** The guildman's paper named weirCrucible as the hearth, drossSilver as its metal, and Edony as sole caster there — those three facts close the blank chain entire under Rules 1 and 2. What it left empty is every mark on the die face: it named no flaw on the coin's field, bound no flaw to any tool, and licensed no hand as sole holder of a graver. Entry 8 on my board — dieFlawOf falseShilling notchedSerif — came from a later exhibit, not the guildman's paper at all. So the guildman's paper is complete on blanks and silent on dies.
  — hypothesis: If flawCutBy notchedSerif answers to a tool whose sole holder is Edony, then cutDieFor names Edony and Rule 5 can fire — but flawCutBy notchedSerif and soleHolderOf that tool are both still absent from the board.

## Act 4 (turns 16–21) — declared by the director
*[The last answer settles like ash on the table, leaving the coins bright and accusing under the lamp. The room narrows around the unanswered cut, and the next act opens with the patience of metal giving way to the pressure of tools and keeping hands.]*

### Turn 16
*[The last answer settles like ash on the table, leaving the coins bright and accusing under the lamp. The room narrows around the unanswered cut, and the next act opens with the patience of metal giving way to the pressure of tools and keeping hands.]*
  — *declares the movement: **Act 4** ([The last answer settles like ash on the table, leaving the coins bright and accusing under the lamp. The room narrows around the unanswered cut, and the next act opens with the patience of metal giving way to the pressure of tools and keeping hands.])*
  — *calls the act closed*
**Tutor:** Then let the die-sinker read the notch under the glass: it is no burnisher's slip, but the bite of a worn burin with a sprung heel, a tool that signs its cuts with that square notch; Verrell's broad graver cuts clean. A flaw is a tool's accent in the metal, lad — what does Rule 3 now yield, and what hand-question must still wait beyond it?
  — move: exemplum → p_graver (release), releases `p_graver`
**Learner:** Rule 3 fires at last: dieFlawOf names notchedSerif, flawCutBy names wornBurin, so dieCutWith falseShilling wornBurin follows — and the tutor's own words tell us Verrell's broad graver cuts clean, not with a sprung heel. The blank chain already runs to Edony; if the worn burin is hers alone, Rule 4 gives cutDieFor to her as well and Rule 5 settles the question in her hand. But soleHolderOf wornBurin is still absent from the board — that conjunct alone keeps the verdict open.
  — adopts `flawCutBy notchedSerif wornBurin` · derives `dieCutWith falseShilling wornBurin` · hypothesis: The worn burin is not Verrell's (his broad graver cuts clean, not with a sprung heel); if soleHolderOf wornBurin resolves to Edony, then cutDieFor names Edony, castBlankFor already names Edony, and Rule 5 yields struckBy falseShilling edony — but soleHolderOf wornBurin is not yet on the board.
  ⚑ **act_end** — act 3 closed (director) after 5 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 17
*[The table remains cleared except for the waiting coins, their pale faces turned upward beneath the glass. Rain works softly at the shutters, and the room holds its breath around the unnamed keeping hand.]*
**Tutor:** Before we let that last tool-mark do any further work, take the die-sinker's paper back into your own hands. What did it claim in your words, and what did it leave still unwritten before Rule 4 can move? Read the exhibit back from your board, not from my prompting.
  — move: erotema → p_graver (confront)
  — *the second voice [unconfronted reentry]: "Confront p_graver first: have the learner read back only what their board holds of that exhibit before you use it again." (draft anaphora → erotema)*
**Learner:** The die-sinker's paper set two facts now grounded on the board: dieFlawOf falseShilling notchedSerif, and flawCutBy notchedSerif wornBurin — together they fired Rule 3 and gave us dieCutWith falseShilling wornBurin, already voiced. But the paper named the tool's mark, not the tool's keeper: soleHolderOf wornBurin stands unwritten, and without it Rule 4 cannot yield cutDieFor for any hand. That single absent conjunct is all that keeps the verdict from closing.
  — hypothesis: soleHolderOf wornBurin is the sole missing conjunct; if it resolves to Edony, Rule 4 yields cutDieFor falseShilling edony, and with castBlankFor falseShilling edony already on the record, Rule 5 settles struckBy falseShilling edony.

### Turn 18
*[The lamp gutters once and steadies, throwing the coin-glass into a small ring of fire. No paper enters; no witness is called, and the silence presses on the place where a keeping hand has not yet been named.]*
**Tutor:** The flaw is shown, the worn burin is shown, and the keeping hand is not. Let Rule 3 stand only where it stands: die cut with a tool; then tell me what Rule 4 still lacks before any cutter's hand, and what Rule 5 must therefore still refuse.
  — move: anaphora → p_graver (consolidate)
**Learner:** Rule 3 stands where it stands: dieCutWith falseShilling wornBurin, and no further. Rule 4 wants two conjuncts — dieCutWith gives the tool, but soleHolderOf wornBurin is absent; without the keeping hand, cutDieFor yields nothing. Rule 5 then must refuse: castBlankFor already names Edony, but the rule demands both chains in one hand — and cutDieFor names no hand at all until the burin's keeper is shown.
  — hypothesis: soleHolderOf wornBurin edony — if this arrives, cutDieFor names Edony and Rule 5 yields struckBy falseShilling edony; but the keeping hand is not yet on the table.

### Turn 19
*[The coins lie untouched beneath the glass while the rain thins to a dry ticking at the sill. In the lamplight, the empty space beside the die-sinker's paper seems larger than the paper itself.]*
**Tutor:** Before that exhibit is made to bear another ounce, take the die-sinker's paper back into your own hands. In your words only, what did it claim, and what did it leave still unwritten before Rule 4 may move? Read the paper from your board, not from my tongue.
  — move: erotema → p_graver (confront)
  — *the second voice [unconfronted reentry]: "Confront first: have the learner read back what they hold of that exhibit before you make it do further work." (draft anaphora → erotema)*
**Learner:** The die-sinker's paper grounded two facts and no more: dieFlawOf falseShilling notchedSerif, and flawCutBy notchedSerif wornBurin — together they fired Rule 3 and yielded dieCutWith falseShilling wornBurin, already voiced. What the paper left unwritten is soleHolderOf wornBurin: it named the tool's mark but not the hand that kept the tool. Rule 4 wants both conjuncts — dieCutWith is present, soleHolderOf is absent — and until the keeper is named, cutDieFor yields nothing and Rule 5 must refuse.
  — hypothesis: soleHolderOf wornBurin edony — if this arrives, cutDieFor names Edony and Rule 5 yields struckBy falseShilling edony; the keeping hand is still not on the table.

### Turn 20
*[The room holds its breath around the unfilled line on the board. Outside, the last water slips from the eaves, and the lamp makes the waiting instruments throw long, thin shadows across the table.]*
**Tutor:** The notch has named its tool, and the tool has not yet named its keeper. If the die was cut with the worn burin, what single keeping-mark must the estate or bench still give before Rule 4 may write a cutter's hand? Let Rule 5 wait outside the door until that word stands on your board.
  — move: anaphora → p_graver (consolidate)
**Learner:** The single keeping-mark still wanted is soleHolderOf wornBurin: estate or bench must show that one hand and no other kept the worn burin. Rule 4 holds dieCutWith falseShilling wornBurin already — the tool is named; only its sole keeper is absent. Until that one conjunct stands on the board, Rule 4 writes nothing and Rule 5 stays outside the door.
  — hypothesis: soleHolderOf wornBurin edony — if bench or estate names Edony as the burin's sole keeper, Rule 4 yields cutDieFor falseShilling edony, and with castBlankFor falseShilling edony already grounded, Rule 5 settles struckBy falseShilling edony.

### Turn 21
*[The empty place beside the tool's mark remains unfilled, stark as a missing signature. The lamp gutters once, and every face in the room seems to wait for a hand not yet brought through the door.]*
**Tutor:** Before the tool-mark is asked to carry another step, take the die-sinker's paper back from your own board. In your words only, what did that exhibit claim, and what did it leave unwritten before Rule 4 may move? Give me no verdict yet; give me the paper as you hold it.
  — move: erotema → p_graver (confront)
  — *the second voice [unconfronted reentry]: "Confront p_graver first: have the learner read back what they hold of that exhibit from their own board before you stage it again." (draft anaphora → erotema)*
**Learner:** The die-sinker's paper grounded exactly two facts: dieFlawOf falseShilling notchedSerif, and flawCutBy notchedSerif wornBurin — no more, no fewer. Together under Rule 3 those two conjuncts yield dieCutWith falseShilling wornBurin, already voiced. What the paper left unwritten is soleHolderOf wornBurin: it named the tool's signature flaw but never named the hand that kept the tool. Rule 4 holds dieCutWith in one hand and finds the other hand — soleHolderOf — still empty.
  — hypothesis: soleHolderOf wornBurin edony — if bench or estate names Edony as the burin's sole keeper, Rule 4 yields cutDieFor falseShilling edony, and with castBlankFor falseShilling edony now formally voiced, Rule 5 settles struckBy falseShilling edony.
  ⚑ **disengagement** — no progress over 6 turns
  ⚑ **plot_audit** — act 4 plot audited at run end: kept 6, justified 0, drift 0; arc on_arc; throughline reckoned (7 clauses)

## Instrument panel (programmatic eval — no judge)

- **verdict** `disengagement` · 21/28 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0.238 D/turn overall (D 6→1 over 21 turns)
  - Act 1 (turns 1–4): 0 D/turn (ΔD 0)
  - Act 2 (turns 5–10): 0.333 D/turn (ΔD 2)
  - Act 3 (turns 11–15): 0.4 D/turn (ΔD 2)
  - Act 4 (turns 16–21): 0.167 D/turn (ΔD 1)
- **plateau** longest flat stretch 5 turns (aporia window 6)
- **releases** 5/9 on cue · 3 deviated
- **decay** 3 slips (seed 1 · rate 0.75 · grace 1) · repaired 1 (tutor 1, re-adoption 0) · mean repair latency 6 turns · unrepaired at end 2 · degraded-turn integral 33 · D reversals 1
- **theory fidelity** F 0.833 at end · min 0.75
  - m_caster t3 (never repaired) · p_alloy t6→t12 (tutor) · m_graver t12 (never repaired)
- **events** plot×4 · throughline×1 · decay×3 · act_end×3 · plot_audit×4 · overreach×1 · repair×1 · disengagement×1
- **staging** 4 movements declared by the director
- **acts** 4 played · closed by the director 3 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–10 (director) · Act 3 t11–15 (director) · Act 4 t16–21 (run end)
- **plot** 4 committed · withhold+friction on 4/4 · 5.75 clauses avg · audits 4 (incl. final act): kept 22 / justified 1 / drift 0 · hold-named exhibits staged in act 0/0
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 4: on 4 / off 0 · run-end reckoning 7 clauses: kept 6 / justified 0 / drift 1
- **release authority** 4 played: 1 on schedule · 1 held · 2 early · forced at hold limit 0 · overridden 3 · invalid claims 0
  - p_alloy +1 (t5): "Held one turn so the learner could first name the missing metal-match; now the act needs the assay mark restored under the new table."
  - p_crucible -2 (t6): "p_crucible pushed: page stalling (hedging up 0.50)"
  - p_graver -2 (t16): "Played two turns early because the learner has separated the notched serif from the guild paper and the page is narrowing around the tool-chain."
- **confrontation** 9 demanded (4 against a slipped exhibit) · re-entries 3: covered 3, uncovered 0 · watcher fires 7 (became the confrontation 7) · fires without recorded due 0
  - **repair clause** restores 1 (1 repaired a real slip) · watcher fires on restore claims 2: p_alloy t12
- **figures** erotema 11/21 (52%) · 3 distinct · switch rate 0.70
- **superego** intervened 9/21 watched turns · figure changed within-turn on 8/9 interventions · switch on intervention 0.78 vs elsewhere 0.64
- **inference** 3 voiced · stall integral 0 · overreach 1 · mischanneled 0 — `blankFrom falseShilling weirCrucible` available t6 → voiced t6 (latency 0) · `castBlankFor falseShilling edony` available t12 → voiced t12 (latency 0) · `dieCutWith falseShilling wornBurin` available t16 → voiced t16 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 21 | 3 | 3 | 42 |
| tutor | 21 | 2.67 | 3 | 51.4 |
| learner | 21 | 3.62 | 5 | 77.7 |
