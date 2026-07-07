# The Light Shillings — marrick-visible-r1

> world `world_005_marrick` · verdict **disengagement** · 21/28 turns

```
D= 6 ●●●●│··●●··│···│·····│···
D= 5     │●●  ●·│···│·····│···
D= 4     │     ·│···│·····│···
D= 3     │     ●│●··│·····│···
D= 2     │      │ ●●│●●···│···
D= 1     │      │   │  ●●●│●●●
D= 0     │      │   │     │   
turn      │+    1│   │ +   │ 2  (+=5, digit=x10)
rel    ▲  │▲▲  ▲▲│ ▲ │  ▲  │    (▲ = evidence released)
slope 0.24 D/turn overall (D 6→1); per movement: 1 0.00 │ 2 0.50 │ 3 0.33 │ 4 0.20 │ 5 0.00
```

## Act 1 (turns 1–4) — declared by the director
*[Rain presses at the shuttered room while the fair's mud dries in black seams along the floorboards. A covered tray waits on the table, and every face in the room seems already to have chosen a hand before any proof is named.]*

### Turn 1
*[Rain presses at the shuttered room while the fair's mud dries in black seams along the floorboards. A covered tray waits on the table, and every face in the room seems already to have chosen a hand before any proof is named.]*
  — *declares the movement: **Act 1** ([Rain presses at the shuttered room while the fair's mud dries in black seams along the floorboards. A covered tray waits on the table, and every face in the room seems already to have chosen a hand before any proof is named.])*
**Tutor:** Set the tray aside a moment; the room has chosen before the metal has spoken. What must an assay prove before any hand may be entered in the book?
  — move: erotema → — (orient)
**Learner:** The assay must first show the blank's alloy answers to one crucible alone, and the die-flaw to one graving-tool alone — then it must show both crucible and tool were worked by the same hand. The town cries Verrell, but my board already tells me this shilling was struck, not clipped; those are separate arts, and a clipper's record does not make him a striker.
  — hypothesis: Verrell's history as a clipper does not establish him as the striker of false coin — clipping shaves existing coin, striking casts and dies new metal; the board holds no chain yet linking him to either blank or die for this shilling.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[A clerk steps from the wet passage with the mint-yard book held open, its pages bowed from the damp. The entry is read into the room: "The town has its founder ready: Verrell alone draws the mint-yard crucible, licensed to no one else since the old assay-master's day. Whatever metal is cast in Marrick, the town says, is cast by Verrell's hand."]*
  — *releases `m_caster`*
**Tutor:** The mint-yard book gives the town a hand for a crucible; it does not yet give the coin that crucible. Which mark must stand between that book and the shilling before the entry can bear weight?
  — move: erotema → m_caster (counter_mirror)
**Learner:** The missing mark is the alloy test: the shilling's metal must be shown to answer to the mint crucible's leavings — without alloyOf and meltedAt firing Rule 1, the book gives me a caster but not yet a blank. I adopt the mint-yard entry, for it grounds one foot of Rule 2, but Rule 2 cannot move until the touchstone names the shilling's alloy and the crucible residue confirms where that alloy was melted. The book alone is a hand without a coin in it.
  — adopts `soleCasterAt mintCrucible verrell` · hypothesis: Verrell may be the caster if the shilling's alloy is shown to answer to the mint crucible's leavings — but the alloy test has not yet been put before the room, so blankFrom falseShilling mintCrucible remains ungrounded.

### Turn 3
*[The covered tray remains untouched while rainwater threads from the clerk's cloak and gathers beneath his chair. The room listens to the small sounds of metal settling under cloth, each face held between the name already spoken and the proof not yet shown.]*
**Tutor:** First the coin's metal; then the metal's own hearth; then, only then, any book of hands. Keep the book closed at the edge of the board until the touchstone gives it something to touch.
  — move: anaphora → — (consolidate)
  — *the second voice [figure rut]: "Leave off erotema here; turn the move into a different pressure before the question-form hardens into habit." (draft erotema → anaphora)*
**Learner:** The tray stays closed and the board stays where it is. Rule 1 wants alloyOf and meltedAt — neither the cloth nor the room's verdict can supply them. Until the touchstone is drawn across this shilling and the crucible leavings are weighed against it, the mint-yard book is a hand reaching for a coin that has not yet named its own metal.
  — hypothesis: Verrell may be the caster if and only if the shilling's alloy is shown to answer to the mint crucible's leavings — blankFrom falseShilling mintCrucible remains ungrounded until the touchstone and crucible residue are brought before the room.
  ⚑ **decay** — m_caster slips from the learner's board

### Turn 4
*[The cloth over the tray darkens where the damp air has found it, and the room holds its breath around the thing not yet uncovered. Outside, wheels grind through the fair-mud and pass on, leaving the question heavier than before.]*
**Tutor:** Now the cloth lifts: the cupel gives no clipped sterling, but a struck poor dross, silver eked with copper and a grey lead-sweat the touchstone catches. A shaved loaf has its crust missing; this loaf was baked of another flour. What does struck-from-dross do to the town's clipping tale before any crucible is named?
  — move: exemplum → p_alloy (release)
**Learner:** The dross-and-lead alloy unmakes the clipping tale entirely — a clipper trims good silver at the edge, but this shilling was born bad, cast from a debased melt before any die ever touched it. Verrell's pillory-record is for clipping, which is a different hand at a different work; that crime tells me nothing yet about who held the crucible that smelted this dross or the graver that cut its die. The town's case rests on clipperOf, but the coin names a different craft.
  — hypothesis: Verrell's clipper history doubly fails this coin: the crime is striking from debased metal, not clipping good silver, so his known offence does not transfer; and even were he suspected as a striker, no alloyOf or meltedAt fact has yet been formally shown, and no dieFlawOf or flawCutBy fact has entered the room — the board holds no chain through Rules 1–5 to any hand.

## Act 2 (turns 5–10) — declared by the director
*[The tray is covered again, but the room no longer rests easy around it; rain ticks in the silence where the town's first answer had stood. The next chamber waits colder, with ledgers, ash, and metal asked to remember what mouths will not.]*

### Turn 5
*[The tray is covered again, but the room no longer rests easy around it; rain ticks in the silence where the town's first answer had stood. The next chamber waits colder, with ledgers, ash, and metal asked to remember what mouths will not.]*
  — *declares the movement: **Act 2** ([The tray is covered again, but the room no longer rests easy around it; rain ticks in the silence where the town's first answer had stood. The next chamber waits colder, with ledgers, ash, and metal asked to remember what mouths will not.])*
  — *calls the act closed*
**Tutor:** Now the cupel speaks again for this chamber: these shillings are no clipped sterling, but struck poor dross, silver eked with copper and a grey lead-sweat the touchstone catches. A shaved loaf has lost crust; this loaf was mixed from bad flour. What does that fix, and what must still be matched before any book of hands can touch the coin?
  — move: exemplum → p_alloy (release), releases `p_alloy`
**Learner:** The alloy names the flour at last — drossSilver, not clipped good metal, so Rule 1 stands primed: but it needs meltedAt to fire, and no crucible has yet been matched to this same dross. That fixes the first link of the blank-chain and nothing else; the die-flaw chain has not opened at all. Both chains must close and meet in one hand before Rule 5 yields a name. I adopt the alloy and hold my pen.
  — adopts `alloyOf falseShilling drossSilver` · hypothesis: Verrell may be the caster if drossSilver is shown to answer to the leavings of his crucible alone (meltedAt drossSilver verrellCrucible and soleCasterAt verrellCrucible verrell) — but neither fact has been exhibited; and the die chain remains entirely unbegun, with no dieFlawOf, flawCutBy, or soleHolderOf before the room.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 3, justified 1, drift 0; arc on_arc

### Turn 6
*[A guildman is shown in, rain on his sleeves, and lays his oath beside the bench inventory: "And Verrell engraves: the broad graver on his bench is his alone, the guild will swear, and no clean-cut die in the borough is sunk without it. A caster and an engraver both — the town needs no more than that."]*
  — *releases `m_graver`*
**Tutor:** The guildman's oath gives the town a held tool, not yet a wounded coin. If Verrell's broad graver is to matter here, what must the shilling itself show before the bench can enter the proof?
  — move: erotema → m_graver (counter_mirror)
  — *the second voice [figure rut]: "Leave off exemplum here; turn the bench oath by another device before the learner hears it." (draft exemplum → erotema)*
**Learner:** The broad graver is now in Verrell's hand alone — soleHolderOf is grounded — but Rule 4 cannot fire until Rule 3 has primed it: the shilling must first show a die-flaw, and that flaw must be sworn to answer to this very graver. Without dieFlawOf and flawCutBy, the bench sits idle. The coin's own face must name its wound before the tool can enter the proof.
  — adopts `soleHolderOf broadGraver verrell` · hypothesis: The die-chain may close if the shilling is shown to bear a flaw traceable to the broad graver (dieFlawOf falseShilling someFlaw and flawCutBy someFlaw broadGraver needed); the blank-chain may close if drossSilver answers to Verrell's crucible alone (meltedAt drossSilver verrellCrucible and soleCasterAt verrellCrucible verrell needed) — neither set of facts has been exhibited, and no chain through Rules 1–5 yet reaches any hand.
  ⚑ **decay** — p_alloy slips from the learner's board

### Turn 7
*[The guildman remains under the lintel, his oath drying into the room while the covered tray gives back no answer. Rain beads along the sill; every eye waits on metal, not mouths.]*
**Tutor:** Before another paper comes in, read the guildman's oath back from your own board. What exactly does it give the town, and what does it still fail to bind to this shilling?
  — move: erotema → m_graver (confront)
**Learner:** The oath gives the town one grounded fact: soleHolderOf broadGraver verrell — the tool sits in one hand alone and no other may claim it. What it cannot give is the coin's own testimony: Rule 3 needs dieFlawOf and flawCutBy to fire before Rule 4 can carry Verrell's name any further. The shilling has shown its base alloy, but its face has not yet named a flaw, and no sworn witness has matched any wound on that face to this broad graver. The tool stands ready at the door of the chain; only the coin can open it.
  — hypothesis: The die-chain may close if the shilling is shown to bear a flaw traceable to the broad graver (dieFlawOf falseShilling someFlaw and flawCutBy someFlaw broadGraver needed); the blank-chain may close if drossSilver answers to Verrell's crucible alone (meltedAt drossSilver verrellCrucible and soleCasterAt verrellCrucible verrell needed) — neither set of facts has been exhibited, and no chain through Rules 1–5 yet reaches any hand.

### Turn 8
*[The room settles around the unspeaking tray; a clerk turns a dry page and finds no voice in it. Beyond the shutters the rain keeps count, while the covered metal waits for the next hand to uncover it.]*
**Tutor:** The founder's man sets the ash beside the cupel: that grey lead-sweat answers to one leavings only, the weir-forge crucible above the mill-leat, cold since the old founder died. The mint-yard book was a hand without this metal; now the metal has named a hearth. What does Rule 1 yield, and what must still be shown before any hand may claim the blank?
  — move: exemplum → p_crucible (release)
**Learner:** Rule 1, once alloyOf and meltedAt are formally sworn, yields blankFrom falseShilling weirForgeCrucible — the metal has named its hearth, and that hearth is not Verrell's. The mint-yard book's silence is the more telling fact: his crucible did not cast this alloy, so the blank chain cannot reach him through that forge. Rule 2 still needs soleCasterAt weirForgeCrucible — and the old founder's death leaves that post unnamed before the room. The die chain remains wholly unbegun, and both chains must converge in one hand before Rule 5 may settle the question.
  — hypothesis: If alloyOf falseShilling drossAlloy and meltedAt drossAlloy weirForgeCrucible are formally exhibited, Rule 1 yields blankFrom falseShilling weirForgeCrucible — pointing the blank chain to the old founder's forge, not Verrell's mint-yard crucible. Verrell appears cleared of the blank chain; to convict him Rule 5 would require both chains to close in his hand, meaning the die chain would need to do all the remaining work — and it has not yet been begun. The old founder (deceased) may be the sole caster at the weir-forge crucible, but soleCasterAt weirForgeCrucible is not yet sworn, and a dead man cannot hold a die.

### Turn 9
*[The ash pan is left beside the covered tray, and the room grows thinner around both of them. A draught worries the candle flames; no one reaches for the cloth.]*
**Tutor:** The founder's man brings ash to the cupel: that grey lead-sweat answers to one leavings only, the weir-forge crucible above the mill-leat, cold since the old founder died. A coin's blank betrays its melt as a loaf betrays its flour; if this dross has named that hearth, what does Rule 1 now enter? And before any hand can claim the blank, what one book of use is still missing?
  — move: exemplum → p_crucible (release), releases `p_crucible`
**Learner:** Rule 1 stands ready but cannot fire: meltedAt drossSilver weirCrucible is now on the board, yet the chain needs alloyOf falseShilling drossSilver — the formal assay record certifying that this shilling's own metal is that very dross — before the hearth may claim the blank. The ash has named the forge; the coin must still name the ash. That sworn assay book is the one empty page between the cupel and the conclusion.
  — adopts `meltedAt drossSilver weirCrucible` · hypothesis: Rule 1 will yield blankFrom falseShilling weirCrucible once alloyOf falseShilling drossSilver is formally sworn — that assay record is the one missing exhibit before the blank chain can point to the weir-forge hearth; and even then, soleCasterAt weirCrucible must be established before Rule 2 can name any hand.

### Turn 10
*[The leat-keeper's book is exact. Since the forge was shut, one hand alone has drawn the weir crucible and signed for its charcoal: Edony, the founder's widow, who stayed on in the forge cottage when the fires went out.]*
  — *releases `p_caster`*
**Tutor:** The assay book is not empty: the cupel has already entered these shillings as struck poor dross, silver eked with copper and grey lead-sweat, not clipped sterling. With that line restored beside the weir-crucible ash, what does Rule 1 now enter? Then read the leat-keeper's book against that blank, and tell me what kind of finding it forces, not yet what verdict it tempts.
  — move: anaphora → p_alloy (restore)
**Learner:** Rule 1 now fires: alloyOf and meltedAt together yield blankFrom falseShilling weirCrucible — the blank has named its hearth. Rule 2 follows at once: the leat-keeper's sole-caster entry makes Edony the one hand that drew that crucible, so castBlankFor falseShilling edony is grounded. What the two books force together is a finding, not yet a verdict: the blank chain closes in Edony's hand, and the hand it closes in is not Verrell's. The die chain remains wholly unbegun, and Rule 5 cannot speak until both chains converge.
  — adopts `soleCasterAt weirCrucible edony` · derives `blankFrom falseShilling weirCrucible`, `castBlankFor falseShilling edony` · hypothesis: If the die chain closes in Edony's hand — dieFlawOf falseShilling someFlaw, flawCutBy someFlaw someTool, and soleHolderOf someTool edony all exhibited — Rule 5 would yield struckBy falseShilling edony; but no flaw fact has entered the room, and Verrell alone holds the broad graver on the current board, leaving the die chain's end entirely open.
  ⚑ **repair** — p_alloy restored by the tutor
  ⚑ **decay** — m_graver slips from the learner's board

## Act 3 (turns 11–13) — declared by the director
*[The covered tray is carried out, and the silence it leaves behind feels less settled than before. The next room opens with harder light, quicker footsteps, and a pressure that makes every partial answer prove whether it can stand without the rest.]*

### Turn 11
*[The covered tray is carried out, and the silence it leaves behind feels less settled than before. The next room opens with harder light, quicker footsteps, and a pressure that makes every partial answer prove whether it can stand without the rest.]*
  — *declares the movement: **Act 3** ([The covered tray is carried out, and the silence it leaves behind feels less settled than before. The next room opens with harder light, quicker footsteps, and a pressure that makes every partial answer prove whether it can stand without the rest.])*
  — *calls the act closed*
**Tutor:** Hold the first closing as half a proof, not a verdict. A blank without a die is only prepared metal; what must the coin's face show before the last rule can even begin to speak?
  — move: erotema → — (consolidate)
**Learner:** The blank chain closes now — Rules 1 and 2 together name Edony as the one who cast this shilling's blank. But the die has not yet spoken: Rule 3 needs the coin's face to show a flaw before any chain through tool and hand can begin. Without dieFlawOf before the room, there is no cutDieFor to bring to Rule 5, and half a chain is no verdict.
  — hypothesis: The die chain will close in Edony's hand only if the shilling's face shows a flaw traceable to a graving-tool Edony alone held — dieFlawOf, flawCutBy, and soleHolderOf must all be exhibited before Rule 5 can name the striker; until then, castBlankFor falseShilling edony is half a proof, not a verdict.
  ⚑ **act_end** — act 2 closed (director) after 6 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 12
*[The watch will swear to the rest: Verrell was seen at the mint-yard forge twice in fair-week, late and with the shutters drawn. Caster, engraver, and at the fire on the very nights — the town's case stands, and stands loud.]*
  — *releases `m_caught`*
**Tutor:** The watch gives the town a late fire and shuttered windows; it still gives no mark on this coin. Which conjunct does that noise add to the assay's law: the weir blank already cast, or the die-flaw still unseen? Let the loud case stand outside the rule until it can name a mark the rule can use.
  — move: erotema → m_caught (counter_mirror), releases `p_flaw`
**Learner:** The coin's face has spoken at last — notchedSerif is marked on the shilling, and Rule 3 may now begin. But the door stands open without its key: flawCutBy notchedSerif must name a tool before dieCutWith can follow. The watch's fire and shutters are noise the rule cannot consume. Two chains now run: one closed to Edony's hand for the blank, one arrested mid-step waiting on the graving-tool.
  — adopts `dieFlawOf falseShilling notchedSerif` · hypothesis: The die chain will close — and Rule 5 may then name the striker — only if flawCutBy notchedSerif exhibits a tool, and soleHolderOf that tool names one hand; until those two facts enter the room, no verdict is reachable under the rules.

### Turn 13
*[The room holds on the coin's face under a narrow pane of light, while the louder testimonies seem to press at the door without entering. No hand reaches for them; the table waits for the one mark that can bear the next weight.]*
**Tutor:** Read the coin's face back from your own board before any tool is called. Not the town's fire, not the bench oath, not the hand you suspect — only what the face has given, and what it has not yet given.
  — move: anaphora → p_flaw (confront)
  — *the second voice [figure rut]: "Leave off erotema here; make the learner read back the held exhibit without casting it as another question." (draft erotema → anaphora)*
**Learner:** The coin's face gives notchedSerif — that is all it has given, and it sits on my board without its twin: flawCutBy notchedSerif names no tool yet, so Rule 3 cannot fire. The blank chain, though, is closed: drossSilver answers to weirCrucible, and Edony alone cast there, so Rules 1 and 2 together name Edony as the hand that cast this blank. The watch's sight of Verrell at the forge in fair-week is noise the rules cannot consume — no predicate receives it. The die chain waits on flawCutBy notchedSerif before a single further step can follow.
  — hypothesis: The die chain will close — and Rule 5 may name the striker — only if flawCutBy notchedSerif is exhibited naming a tool, and soleHolderOf that tool then names one hand alone; until both facts enter the room, the verdict is unreachable.

## Act 4 (turns 14–18) — declared by the director
*[The narrow pane of light shifts off the coin and onto the empty space beside it, as if the table itself has made room for a second witness. The room tightens into a quieter pressure now, less clamorous and more exacting, where only a thing that fits the mark may be allowed to speak.]*

### Turn 14
*[The narrow pane of light shifts off the coin and onto the empty space beside it, as if the table itself has made room for a second witness. The room tightens into a quieter pressure now, less clamorous and more exacting, where only a thing that fits the mark may be allowed to speak.]*
  — *declares the movement: **Act 4** ([The narrow pane of light shifts off the coin and onto the empty space beside it, as if the table itself has made room for a second witness. The room tightens into a quieter pressure now, less clamorous and more exacting, where only a thing that fits the mark may be allowed to speak.])*
  — *calls the act closed*
**Tutor:** Before a second witness may speak, read the mark on the coin's face from your own board. What did the face itself give, and what kind of testimony is still missing before any tool may enter Rule 3?
  — move: erotema → p_flaw (confront)
**Learner:** The face gave the notched serif — dieFlawOf falseShilling notchedSerif is already grounded on my board. What Rule 3 still wants is flawCutBy notchedSerif naming the tool that cut that flaw; without it, no tool may enter the chain and the die cannot be attributed. Meanwhile the blank chain is fully closed: alloyOf, meltedAt, and soleCasterAt together yield castBlankFor falseShilling edony under Rules 1 and 2, which I can now voice — but half a proof is not a verdict.
  — hypothesis: The die chain will close — and Rule 5 may name the striker — only if flawCutBy notchedSerif is exhibited naming a tool, and soleHolderOf that tool then names one hand alone; until both facts enter the room, the verdict is unreachable.
  ⚑ **act_end** — act 3 closed (director) after 3 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 15
*[The table remains bare in the cleared space, its wood darkened by the damp air from the fair outside. The coin lies just beyond the light, near enough to accuse and too silent to finish the accusation.]*
**Tutor:** Good: the face has given a wound, not yet a cutter. The mark is shown, the kind of testimony needed is named, and the hand? Keep that last word outside the book until Rule 3 has a tool to carry it.
  — move: anaphora → — (consolidate)
**Learner:** No new exhibit enters the space, but the blank chain will not wait: Rules 1 and 2 close it now — blankFrom falseShilling weirCrucible, and from that, castBlankFor falseShilling edony. I voice those and enter them in derives. The die chain still wants flawCutBy notchedSerif before any tool may speak, and I keep my hand off the verdict book.
  — hypothesis: The die chain will close — and Rule 5 may name the striker — only if flawCutBy notchedSerif is exhibited naming a tool, and soleHolderOf that tool then names one hand alone; until both facts enter the room, the verdict is unreachable.

### Turn 16
*[Rain ticks softly against the shutter, and the room seems to listen to the small silence around the coin. The verdict book remains closed, its clasp catching a thin edge of light without opening.]*
**Tutor:** The die-sinker sets his glass to the broken R: that square notch is no burnisher slip and no broad graver from Verrell's bench, but the bite of a worn burin with a sprung heel, a tool that signs each line it cuts. A flaw betrays its cutter as a cupel betrays its melt. With the notched serif and that tool now together, what does Rule 3 enter, and what is still missing before any hand may be named for the die?
  — move: exemplum → p_graver (release), releases `p_graver`
**Learner:** Rule 3 now closes: dieFlawOf falseShilling notchedSerif and flawCutBy notchedSerif wornBurin together yield dieCutWith falseShilling wornBurin — I enter that in derives alongside blankFrom and castBlankFor, which the blank chain has long since earned. What the die chain still wants is soleHolderOf wornBurin: one hand sworn as its sole holder before Rule 4 may yield cutDieFor falseShilling, and Rule 5 may name the striker.
  — adopts `flawCutBy notchedSerif wornBurin` · derives `dieCutWith falseShilling wornBurin` · hypothesis: The die chain will close — and Rule 5 may name the striker — only if soleHolderOf wornBurin is exhibited naming one hand alone; until that fact enters the room, cutDieFor falseShilling remains ungrounded and the verdict is unreachable.

### Turn 17
*[The glass is set down beside the coin, and for a moment nothing in the room moves except the rainlight trembling on its rim. The empty space beside the exhibit remains open, exact and expectant, as though the table will not suffer a name until the proper hand has entered with it.]*
**Tutor:** Before we build on the last witness, read that witness back from your own board. What did it give Rule 3, and what did it still leave outside Rule 4? No hand yet; only the paper as you hold it.
  — move: erotema → p_graver (confront)
  — *the second voice [unconfronted reentry]: "Confront p_graver first: ask the learner to read back what they hold of that exhibit before you restage it. Do not consolidate it until that read-back stands." (draft anaphora → erotema)*
**Learner:** Rule 3 took two sworn facts already on the board — dieFlawOf falseShilling notchedSerif and flawCutBy notchedSerif wornBurin — and closed into dieCutWith falseShilling wornBurin, which is on the record from last turn. Rule 4 waits for exactly one more fact not yet exhibited: soleHolderOf wornBurin naming a single hand; without it, cutDieFor falseShilling cannot be written, and the hand column of the verdict book remains blank.
  — hypothesis: The die chain will close — and Rule 5 may name the striker — only if soleHolderOf wornBurin is exhibited naming one hand alone; until that fact enters the room, cutDieFor falseShilling remains ungrounded and the verdict is unreachable.

### Turn 18
*[The room holds its breath around the blank column in the verdict book. Rain gathers along the sill and falls in slow drops, each one marking the silence where a hand has not yet been entered.]*
**Tutor:** The notch has now carried the die as far as a tool, and no farther. The face is shown, the worn burin is shown, and the hand? Tell me what kind of entry Rule 4 still waits for before the die can belong to anyone.
  — move: anaphora → p_graver (consolidate)
**Learner:** Rule 4 waits for a soleHolderOf entry — a sworn record naming one hand, and one hand only, as the keeper of that worn burin. The entry may come as testimony, a tool-register, or a sealed account of sale or loan; what matters is its exclusivity: if two hands can be shown to have held the burin, the rule cannot fire. Until soleHolderOf wornBurin stands on the board with a single name beside it, dieCutWith is proven and cutDieFor is not.
  — hypothesis: The die chain will close — and Rule 5 may name the striker — only if soleHolderOf wornBurin is exhibited naming one hand alone; until that fact enters the room, cutDieFor falseShilling remains ungrounded and the verdict is unreachable.

## Act 5 (turns 19–21) — declared by the director
*[The chamber sheds its patience without raising its voice. The coin, the glass, and the blank column lie in a hard triangle of lamplight, and the next movement in the room must answer to all three or be refused.]*

### Turn 19
*[The chamber sheds its patience without raising its voice. The coin, the glass, and the blank column lie in a hard triangle of lamplight, and the next movement in the room must answer to all three or be refused.]*
  — *declares the movement: **Act 5** ([The chamber sheds its patience without raising its voice. The coin, the glass, and the blank column lie in a hard triangle of lamplight, and the next movement in the room must answer to all three or be refused.])*
  — *calls the act closed*
**Tutor:** The glass has spoken once; before the empty hand-column takes anything, read that witness back from your own board. What did the last witness give the die-chain, and what did it leave still unentered? No name for the striker yet; only the link you can actually write.
  — move: erotema → p_graver (confront)
**Learner:** The glass gave us flawCutBy notchedSerif wornBurin — Rule 3 closes at once: dieCutWith falseShilling wornBurin. The blank-chain was already shut by Edony at the weir crucible, so castBlankFor falseShilling edony stands. But the hand-column for the burin is still empty — soleHolderOf wornBurin has never been sworn, and without it Rule 4 yields nothing. Two chains are built to their last link; only that one sworn name parts them from the striker.
  — hypothesis: The die chain will close — and Rule 5 may name the striker — only if soleHolderOf wornBurin is exhibited naming one hand alone; until that fact enters the room, cutDieFor falseShilling remains ungrounded and the verdict is unreachable.
  ⚑ **act_end** — act 4 closed (director) after 5 turns
  ⚑ **plot** — act 5 plot committed
  ⚑ **plot_audit** — act 4 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 20
*[The lamplight narrows until the untouched hand-column seems brighter than the writing around it. Outside, the rain slackens, and the room waits on the small sound of paper that has not yet been opened.]*
**Tutor:** The die has reached the tool and stops there; do not let the blank column borrow a hand from hunger. The blank is cast, the die is cut with a tool, and the holder? What single sworn entry must fill that gap before Rule 4 may write even cutDieFor?
  — move: anaphora → — (test)
**Learner:** The rules name the gap precisely: soleHolderOf wornBurin — one sworn name, one only. Without it Rule 4 cannot write cutDieFor, and Rule 5 cannot close. I can derive three links from what is already grounded, but the hand-column waits on that single missing oath.
  — hypothesis: The die chain will close — and Rule 5 may name the striker — only if soleHolderOf wornBurin is exhibited naming one hand alone; until that fact enters the room, cutDieFor falseShilling remains ungrounded and the verdict is unreachable.

### Turn 21
*[The sealed papers remain untouched, their edges whitening under the pressure of the clerk's thumb. No one speaks over the rain's last tapping at the shutters, and the empty place on the board keeps its shape.]*
**Tutor:** The tool has gone as far as a tool can go, and the empty hand-column must not be filled by impatience. If Rule 4 were written as an assay entry, what predicate must appear on the left before any hand can appear on the right? Keep the striker's name out of it; name only the missing shape of proof.
  — move: erotema → — (test)
**Learner:** Rule 4's left side demands two entries: dieCutWith ?coin ?tool, and soleHolderOf ?tool ?x. The first my board already yields — Rule 3 closes at once from entries 7 and 8, writing dieCutWith falseShilling wornBurin. The missing predicate shape is soleHolderOf wornBurin — one sworn name for the sole hand that held that tool. Without that entry on the left, Rule 4 writes nothing on the right.
  — hypothesis: The die chain will close — and Rule 5 may name the striker — only if soleHolderOf wornBurin is exhibited naming one hand alone; until that fact enters the room, cutDieFor falseShilling remains ungrounded and the verdict is unreachable.
  ⚑ **disengagement** — no progress over 6 turns
  ⚑ **plot_audit** — act 5 plot audited at run end: kept 6, justified 0, drift 0; arc on_arc; throughline reckoned (7 clauses)

## Instrument panel (programmatic eval — no judge)

- **verdict** `disengagement` · 21/28 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0.238 D/turn overall (D 6→1 over 21 turns)
  - Act 1 (turns 1–4): 0 D/turn (ΔD 0)
  - Act 2 (turns 5–10): 0.5 D/turn (ΔD 3)
  - Act 3 (turns 11–13): 0.333 D/turn (ΔD 1)
  - Act 4 (turns 14–18): 0.2 D/turn (ΔD 1)
  - Act 5 (turns 19–21): 0 D/turn (ΔD 0)
- **plateau** longest flat stretch 5 turns (aporia window 6)
- **releases** 4/9 on cue · 4 deviated
- **decay** 3 slips (seed 1 · rate 0.75 · grace 1) · repaired 1 (tutor 1, re-adoption 0) · mean repair latency 4 turns · unrepaired at end 2 · degraded-turn integral 33 · D reversals 1
- **theory fidelity** F 0.75 at end · min 0.714
  - m_caster t3 (never repaired) · p_alloy t6→t10 (tutor) · m_graver t10 (never repaired)
- **events** plot×5 · throughline×1 · decay×3 · act_end×4 · plot_audit×5 · repair×1 · disengagement×1
- **staging** 5 movements declared by the director
- **acts** 5 played · closed by the director 4 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–10 (director) · Act 3 t11–13 (director) · Act 4 t14–18 (director) · Act 5 t19–21 (run end)
- **plot** 5 committed · withhold+friction on 5/5 · 5.8 clauses avg · audits 5 (incl. final act): kept 27 / justified 1 / drift 0 · hold-named exhibits staged in act 0/1
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 5: on 5 / off 0 · run-end reckoning 7 clauses: kept 6 / justified 0 / drift 1
- **release authority** 4 played: 0 on schedule · 2 held · 2 early · forced at hold limit 0 · overridden 3 · invalid claims 0
  - p_alloy +1 (t5): "Act 2 opens one turn after the scheduled assay beat; the page is stalling, so the metal must be put back on the board before ledgers can matter."
  - p_crucible +1 (t9): "Held one turn to let the guildman's oath be read back; the page is now stalling and the metal chain needs its hearth."
  - p_flaw -2 (t12): "p_flaw pushed: page stalling (lines shortening -29.0)"
  - p_graver -2 (t16): "Played two turns early because the learner has named the missing tool-match and the page is stalling without the second-chain witness."
- **confrontation** 5 demanded (0 against a slipped exhibit) · re-entries 1: covered 1, uncovered 0 · watcher fires 1 (became the confrontation 1) · fires without recorded due 0
  - **repair clause** restores 1 (1 repaired a real slip) · watcher fires on restore claims 0: p_alloy t10
- **figures** erotema 10/21 (48%) · 3 distinct · switch rate 0.75
- **superego** intervened 4/21 watched turns · figure changed within-turn on 4/4 interventions · switch on intervention 1.00 vs elsewhere 0.69
- **inference** 3 voiced · stall integral 0 · overreach 0 · mischanneled 0 — `blankFrom falseShilling weirCrucible` available t10 → voiced t10 (latency 0) · `castBlankFor falseShilling edony` available t10 → voiced t10 (latency 0) · `dieCutWith falseShilling wornBurin` available t16 → voiced t16 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 21 | 3.05 | 4 | 41.7 |
| tutor | 21 | 2.62 | 3 | 48.1 |
| learner | 21 | 3.43 | 8 | 74.2 |
