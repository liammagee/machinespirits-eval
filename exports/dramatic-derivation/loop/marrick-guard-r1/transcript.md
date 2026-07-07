# The Light Shillings — marrick-guard-r1

> world `world_005_marrick` · verdict **grounded_anagnorisis** · 22/28 turns
> S forced at turn 22; asserted grounded at turn 22

```
D= 6 ●●·│·······│·····│·····│··
D= 5   ●│●●●·●●·│·····│·····│··
D= 4    │   ●  ●│●●●··│·····│··
D= 3    │       │   ●·│·····│··
D= 2    │       │    ●│●····│··
D= 1    │       │     │ ●●●●│●·
D= 0    │       │     │     │ ◉
turn     │ +    1│    +│    2│   (+=5, digit=x10)
rel    ▲▲│  ▲▲  ▲│ ▲  ▲│ ▲   │ ▲ (▲ = evidence released)
slope 0.27 D/turn overall (D 6→0); per movement: 1 0.33 │ 2 0.14 │ 3 0.40 │ 4 0.20 │ 5 0.50
```

## Act 1 (turns 1–3) — declared by the director
*[Rain presses at the shutters, and the fair's mud seems to have followed every boot into the room. A narrow table waits beneath the lamps, bare except for the space where judgment will be set down.]*

### Turn 1
*[Rain presses at the shutters, and the fair's mud seems to have followed every boot into the room. A narrow table waits beneath the lamps, bare except for the space where judgment will be set down.]*
  — *declares the movement: **Act 1** ([Rain presses at the shutters, and the fair's mud seems to have followed every boot into the room. A narrow table waits beneath the lamps, bare except for the space where judgment will be set down.])*
**Tutor:** Set the town's noise outside the door, lad; an assay begins with what is on the table, not with whose name the rain has carried in. Before any coin is read, what must a struck false shilling prove besides suspicion?
  — move: erotema → — (orient)
**Learner:** The coin must name its own blank and its own die, sir — the alloy must answer to a crucible, and the die-flaw must answer to a graving-tool. Suspicion names a man; only the metal and the mark can name the hand. Until the coin speaks those two things, the trial-book stays empty.
  — hypothesis: Verrell struck the false shillings — but this is the town's story, not yet the assay's; it wants grounding in alloy and die-flaw before it can be entered.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[A clerk is shown in with the mint-yard license book held high enough for the lamps. He reads: "The town has its founder ready: Verrell alone draws the mint-yard crucible, licensed to no one else since the old assay-master's day. Whatever metal is cast in Marrick, the town says, is cast by Verrell's hand."]*
  — *releases `m_caster`*
**Tutor:** So the license book gives Verrell the mint-yard crucible. But which coin on this table has yet answered to that crucible, and by what mark of its metal?
  — move: erotema → m_caster (counter_mirror)
**Learner:** The license book grounds one fact — Verrell alone casts at the mint crucible — and I will enter it. But the tutor asks the right question: no coin on this table has yet shown its alloy answers to that crucible's metal. Rule 2 waits on rule 1, and rule 1 wants an alloy reading and a melt-record before it moves. The blank is still nameless; the die is still unread.
  — adopts `soleCasterAt mintCrucible verrell` · hypothesis: Verrell struck the false shillings — but the coin has not yet named the mint crucible through its alloy, and no die-flaw has been traced to any graving-tool; the blank and die remain ungrounded.

### Turn 3
*[The clerk closes the license book, but no hand reaches to take it from him. Rain ticks in the room's silence while the bare place on the table seems to ask for metal, not names.]*
**Tutor:** Then set the shillings in the cupel: the assay comes up plain, no clipped sterling at all, but a struck poor dross, silver thinned with copper and a grey lead-sweat the touchstone catches. A shaved true coin is like a loaf pared at the crust; this metal was baked mean from the start. What does that do to the town's clipping tale?
  — move: exemplum → p_alloy (release), releases `p_alloy`
**Learner:** The clipping tale dies in the cupel, sir — a pared coin shows true silver at heart, but this metal was baked mean from the pour itself. Verrell's old offence marks him a clipper; the assay has just named this coin a caster's work instead. I adopt the alloy reading and note that Rule 1 now waits on one thing only: a melt-record to say which crucible poured this dross-silver. Until the leavings of some crucible answer to this alloy, the blank stays nameless.
  — adopts `alloyOf falseShilling drossSilver` · hypothesis: Verrell struck the false shillings — but the pathway must now run through the cast alloy answering to the mint crucible's leavings, not through clipping; meltedAt drossSilver [crucible] is the missing link before Rule 1 can move.
  ⚑ **decay** — m_caster slips from the learner's board

## Act 2 (turns 4–10) — declared by the director
*[The rain slackens, leaving the room colder than before; the table is cleared to its hard surface, as if each thing laid there next must answer for where it came from. Beyond the door, footsteps gather and stop, waiting on the order of a chain rather than the comfort of a name.]*

### Turn 4
*[The rain slackens, leaving the room colder than before; the table is cleared to its hard surface, as if each thing laid there next must answer for where it came from. Beyond the door, footsteps gather and stop, waiting on the order of a chain rather than the comfort of a name.]*
  — *declares the movement: **Act 2** ([The rain slackens, leaving the room colder than before; the table is cleared to its hard surface, as if each thing laid there next must answer for where it came from. Beyond the door, footsteps gather and stop, waiting on the order of a chain rather than the comfort of a name.])*
  — *calls the act closed*
**Tutor:** Before the next witness crosses the sill, read the cupel back from your own board: what did it fix, and what did it still leave unfixed? If a balance names one mark but not the next, do we enter a hand, or enter the lack?
  — move: erotema → p_alloy (confront)
**Learner:** The cupel fixed one link only: alloyOf falseShilling drossSilver stands on my board. But Rule 1 asks next for meltedAt drossSilver and names a crucible — that link is not yet in evidence, so the blank cannot be traced. Without the blank, Rule 2 cannot name a caster, and without both blank and die Rule 5 is mute. We enter the lack, not a hand.
  — hypothesis: Verrell struck the false shillings — but the chain requires meltedAt drossSilver [crucible] before Rule 1 can fire, and dieFlawOf falseShilling [flaw] before Rule 3 can fire; until both links are in evidence, no hand can be named.
  ⚑ **act_end** — act 1 closed (director) after 3 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 5, justified 0, drift 0; arc on_arc
  ⚑ **decay** — p_alloy slips from the learner's board

### Turn 5
*[The door remains shut, though the gathered feet beyond it shift once and settle. On the bare table, the cupel’s pale residue cools beside the untouched space where the next thing has not yet been placed.]*
**Tutor:** Good; enter the lack in the same ink as the mark. The cupel has barred clipping and named only the kind of metal; what paper or witness must answer before Rule 1 can give the blank a birthplace, and what separate mark must still speak before any coin is struck? Keep those two empty places apart.
  — move: erotema → p_alloy (consolidate)
**Learner:** Two empty places, kept apart: first, meltedAt drossSilver [crucible] — a mint-record or assay of crucible leavings must answer before Rule 1 can name the blank's birthplace. Second, dieFlawOf falseShilling [flaw] — a graver's mark or die-cutter's signature must speak before Rule 3 can name who cut the die. These are separate chains, and neither borrows ground from the other. I enter both lacks, and wait on the witness who can fill either.
  — hypothesis: Verrell struck the false shillings — but the chain requires meltedAt drossSilver [crucible] before Rule 1 can fire, and dieFlawOf falseShilling [flaw] before Rule 3 can fire; until both links are in evidence, no hand can be named.
  ⚑ **repair** — p_alloy restored by the tutor

### Turn 6
*[The door opens to a guildman with rain on his sleeves, and his deposition is read aloud: "And Verrell engraves: the broad graver on his bench is his alone, the guild will swear, and no clean-cut die in the borough is sunk without it. A caster and an engraver both — the town needs no more than that."]*
  — *releases `m_graver`*
**Tutor:** A graver on a bench is like a touchstone in its case: it proves what it can do, not what this coin has suffered. The guildman has named Verrell's broad tool and its clean work; what mark on these shillings has yet answered to that tool, and what mark is still wholly unread? Keep the town's hand apart from the coin's flaw until the flaw itself speaks.
  — move: exemplum → m_graver (consolidate)
**Learner:** The guildman grounds one link: the broad graver is Verrell's alone, and I enter it. But the coin's own face has not yet shown its flaw — dieFlawOf falseShilling [flaw] is still unread, and no flaw has yet been traced to that tool, so Rule 3 cannot fire and Rule 4 stays dark. soleHolderOf is the second half of a chain whose first half has not spoken. I enter the fact and hold the hypothesis where it has stood.
  — adopts `soleHolderOf broadGraver verrell` · hypothesis: Verrell struck the false shillings — but the chain still requires meltedAt drossSilver [crucible] before Rule 1 can name the blank, and dieFlawOf falseShilling [flaw] plus flawCutBy [flaw] broadGraver before Rule 3 can name who cut the die; soleHolderOf broadGraver verrell is now grounded but cannot act until the coin's flaw answers to the tool.

### Turn 7
*[The guildman’s paper is folded away, but the wet mark of his sleeve remains on the table. The room holds its breath around the two empty places, one for the metal’s fire and one for the coin’s face.]*
**Tutor:** Then call the founder's man: he knows that grey lead-sweat, and says it answers to the leavings of one crucible on this coast, the weir-forge crucible above the mill-leat, cold these ten years since the old founder died. A metal that finds its own cold hearth is like ash naming the grate it fell from; set alloy and melt-record together, and what does Rule 1 now give the blank? And after that, what still stands empty before any hand, or any die, is entered?
  — move: exemplum → p_crucible (release), releases `p_crucible`
**Learner:** Rule 1 fires at last: alloyOf falseShilling drossSilver meets meltedAt drossSilver weirCrucible, and the blank finds its cold hearth — blankFrom falseShilling weirCrucible I enter on the record. But Rule 2 still waits on soleCasterAt weirCrucible, which no witness has yet spoken; the weir-forge names the vessel, not the hand that tipped it. And the die chain stands wholly dark — dieFlawOf falseShilling bears no flaw yet, and Rule 3 cannot stir. Two places still empty: who cast alone at the weir-forge crucible, and what mark the coin's face carries.
  — adopts `meltedAt drossSilver weirCrucible` · derives `blankFrom falseShilling weirCrucible` · hypothesis: Verrell struck the false shillings — but the chain now requires soleCasterAt weirCrucible [person] before Rule 2 can name castBlankFor, and dieFlawOf falseShilling [flaw] plus flawCutBy [flaw] broadGraver before Rule 3 can name who cut the die; soleHolderOf broadGraver verrell is grounded but the coin's face has not yet answered to it.
  ⚑ **decay** — p_alloy slips from the learner's board

### Turn 8
*[The founder's man lowers his eyes from the table, and the silence after his words seems colder than the rain outside. The cupel, the guild paper, and the named hearth sit apart from one another, refusing to become a verdict merely because the room wants one.]*
**Tutor:** Before we set that hearth to any rule again, read the founder's man's exhibit back from your own board. What did it name, and what did it not name? Give me only the mark you hold, not the hand the room wants.
  — move: erotema → p_crucible (confront)
  — *the second voice [unconfronted reentry]: "Confront p_crucible before you re-enter it: demand the learner's read-back of what he holds of that exhibit, without supplying or restating its content." (draft anaphora → erotema)*
**Learner:** The founder's man's exhibit gives me exactly one entry on my board: meltedAt drossSilver weirCrucible — the alloy answers to the weir-forge hearth, cold these ten years. That is all it names. It names no caster, no sole hand that worked that crucible, no living person at all. Rule 1 fired and gave me blankFrom falseShilling weirCrucible, already on the record — but Rule 2 cannot stir, because soleCasterAt weirCrucible remains wholly unspoken.
  — hypothesis: Verrell struck the false shillings — but the chain now requires soleCasterAt weirCrucible [person] before Rule 2 can name castBlankFor, and dieFlawOf falseShilling [flaw] plus flawCutBy [flaw] broadGraver before Rule 3 can name who cut the die; soleHolderOf broadGraver verrell is grounded but the coin's face has not yet answered to it.

### Turn 9
*[The table is left undisturbed, its separate papers squared but not joined. Outside, the last rainwater ticks from the eaves with the patience of a count not yet complete.]*
**Tutor:** The alloy is shown, the hearth is shown, and the hand? Enter the blank's birthplace, but leave the caster's line empty until a book or witness can bear it. And keep the other empty line beside it: what on the coin's face has not yet been read at all?
  — move: anaphora → — (consolidate)
**Learner:** The blank's birthplace is already on the record — blankFrom falseShilling weirCrucible, voiced last turn. The caster's line stays empty: no book or witness has yet named who worked alone at that cold hearth. And beside it stands the second empty line: dieFlawOf falseShilling carries nothing — the coin's face has not been read, no mark traced, no flaw entered at all. Two gaps remain before any rule can reach a hand.
  — hypothesis: Verrell struck the false shillings — but the chain now requires soleCasterAt weirCrucible [person] before Rule 2 can name castBlankFor, and dieFlawOf falseShilling [flaw] plus flawCutBy [flaw] broadGraver before Rule 3 can name who cut the die; both lines stand empty and the coin's face has not yet been read.

### Turn 10
*[The leat-keeper is shown in with a narrow book darkened at the corners, and the room bends toward its columns. The leat-keeper's book is exact. Since the forge was shut, one hand alone has drawn the weir crucible and signed for its charcoal: Edony, the founder's widow, who stayed on in the forge cottage when the fires went out.]*
  — *releases `p_caster`*
**Tutor:** The leat-book is a key in a cold lock: it opens only the weir crucible, not the whole coining-room. You have the dross, the weir hearth, and now one hand alone at that hearth; what does Rule 2 enter for the blank? Then keep your other line bare: what on the coin's face must still be read before a cast blank becomes a struck false shilling?
  — move: exemplum → p_caster (consolidate)
**Learner:** Rule 2 fires at last — soleCasterAt weirCrucible edony joined with blankFrom falseShilling weirCrucible yields castBlankFor falseShilling edony; the blank names Edony, not Verrell. This shifts the ground: for Rule 5 to name any striker, the die-face must trace to the same hand that cast the blank. The coin's face still stands wholly unread — until a flaw is entered and a tool named, the second line remains bare and Rule 5 sleeps.
  — adopts `soleCasterAt weirCrucible edony` · hypothesis: The blank names Edony as caster; if the die-flaw traces to a tool held solely by Edony, Rule 5 yields struckBy falseShilling edony — but if it traces to Verrell's graver alone, Rule 5 cannot fire for either hand, and the town's verdict collapses.
  ⚑ **overreach** — castBlankFor falseShilling edony

## Act 3 (turns 11–15) — declared by the director
*[The room is emptied of its warmer voices; only the hard light remains on the table, bright enough to make every edge look suspect. When the door opens again, the air has changed from accounting to accusation, and the next thing brought in will have to answer not for metal, but for mark.]*

### Turn 11
*[The room is emptied of its warmer voices; only the hard light remains on the table, bright enough to make every edge look suspect. When the door opens again, the air has changed from accounting to accusation, and the next thing brought in will have to answer not for metal, but for mark.]*
  — *declares the movement: **Act 3** ([The room is emptied of its warmer voices; only the hard light remains on the table, bright enough to make every edge look suspect. When the door opens again, the air has changed from accounting to accusation, and the next thing brought in will have to answer not for metal, but for mark.])*
  — *calls the act closed*
**Tutor:** The blank has spoken as far as a blank can speak; do not make a coin of it before the face is read. What does Rule 5 still require besides a cast blank, and where must your eye go next: to the hearth again, or to the mark under the glass?
  — move: erotema → — (orient)
**Learner:** Rule 5 demands both hands of the work in one grip: castBlankFor and cutDieFor must meet on the same person before struckBy can be written. The blank chain still wants alloyOf falseShilling drossSilver before Rule 1 can move, and the die chain is empty from first to last — no flaw named, no tool answered, no hand named for the cutting. The glass, then: the coin's face must be read before the hearth's evidence can do anything at all.
  — hypothesis: If the coin's face yields a die-flaw that traces to broadGraver — held solely by Verrell — and if alloyOf falseShilling drossSilver is also shown, then Rules 1-2 yield castBlankFor falseShilling edony and Rules 3-4 yield cutDieFor falseShilling verrell; but Rule 5 requires both in one hand, so two different persons as caster and die-cutter would leave the question unsettled — the answer hangs on whether one hand held both roles.
  ⚑ **act_end** — act 2 closed (director) after 7 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 5, justified 1, drift 0; arc on_arc

### Turn 12
*[The watch is brought in under the hard light, and the room receives the sworn rest of it. The watch will swear to the rest: Verrell was seen at the mint-yard forge twice in fair-week, late and with the shutters drawn. Caster, engraver, and at the fire on the very nights — the town's case stands, and stands loud.]*
  — *releases `m_caught`*
**Tutor:** The watch gives the town a loud hour and a shuttered forge; it does not put a flaw on these shillings. Which conjunct has it shown for Rule 5: a cut die for this coin, or only a man near fire? Before the room takes noise for proof, where is the mark under the glass?
  — move: erotema → m_caught (counter_mirror)
**Learner:** The watch places Verrell at a shuttered forge — the town hears guilt in that; the assay hears proximity to fire. seenAtForge answers to no rule I hold: it is not alloyOf, not dieFlawOf, not flawCutBy. Both chains — blank and die — remain broken at their first link, and a man near fire is not a flaw on a face.
  — adopts `seenAtForge verrell fairWeek` · hypothesis: The die chain and blank chain both remain ungrounded — alloyOf falseShilling drossSilver is still missing (Rule 1 cannot fire), and dieFlawOf falseShilling [flaw] with flawCutBy [flaw] broadGraver are still missing (Rule 3 cannot fire); seenAtForge verrell fairWeek is circumstantial and fires no rule, so the question cannot be settled from the watch's testimony alone.

### Turn 13
*[The glass remains where it was laid, catching a white bar of window-light and throwing it back across the table. No one reaches for it at once; the room holds on the difference between a loud accusation and a mark that has not yet been named.]*
**Tutor:** Stop at the ledger before the glass. Read the leat-book from your own board; read the blank rule it touches; read whether that chain is broken at its first link or already bears an entry. Give me the record, not the room's recoil.
  — move: anaphora → p_caster (confront)
  — *the second voice [figure rut]: "Leave off the question-form this turn; confront the exhibit by another device before the learner hears you." (draft erotema → anaphora)*
**Learner:** The leat-book reads thus: blank chain holds meltedAt drossSilver weirCrucible and soleCasterAt weirCrucible edony — two links sound — but the first link, alloyOf falseShilling drossSilver, is nowhere entered; Rule 1 cannot move, and the chain is broken before it begins. Die chain holds soleHolderOf broadGraver verrell — one link sound — but dieFlawOf falseShilling and flawCutBy are both absent; Rule 3 cannot move either. The glass has not yet been reached; until it speaks, both chains stand with good middle links and no opening.
  — hypothesis: If the glass yields dieFlawOf falseShilling [flaw] and flawCutBy [flaw] broadGraver, then Rules 3-4 give cutDieFor falseShilling verrell; and if the assay also shows alloyOf falseShilling drossSilver, Rules 1-2 give castBlankFor falseShilling edony — but Rule 5 then cannot fire, for the two hands differ; the question would remain unsettled unless one hand held both roles.

### Turn 14
*[The ledger is closed without sound, and the glass waits beside it like a second verdict still unspoken. Outside the high window the light thins, leaving the coin's face bright and the rest of the table in shade.]*
**Tutor:** Set the cupel back under your eye: it did enter alloyOf falseShilling drossSilver, for the shillings are struck poor dross, silver thinned with copper and a grey lead-sweat, not clipped sterling at all. A crust pared from a good loaf is not a loaf baked mean; the clipping tale was barred there. Now join that restored mark to the weir hearth already on your board, and tell me whether the blank chain is broken at the first link or has already borne its entry.
  — move: exemplum → p_alloy (restore)
**Learner:** The tutor is right — I misread my own ledger; alloyOf falseShilling drossSilver has stood at index 4 the whole time. With that and meltedAt drossSilver weirCrucible, Rule 1 yields blankFrom falseShilling weirCrucible at once; and soleCasterAt weirCrucible edony then yields castBlankFor falseShilling edony by Rule 2. The blank chain is complete and the blank is Edony's work — not Verrell's. The die chain has no opening still: dieFlawOf and flawCutBy are absent, Rule 3 cannot move, and Rule 5 therefore cannot fire.
  — derives `castBlankFor falseShilling edony` · hypothesis: The die chain is still ungrounded; if the glass yields dieFlawOf falseShilling [flaw] and flawCutBy [flaw] broadGraver, Rules 3-4 give cutDieFor falseShilling verrell — but Rule 5 then cannot fire, for castBlankFor names edony and cutDieFor would name verrell, two different hands; only if the die-flaw traces to a tool held solely by Edony would Rule 5 yield a binding answer.
  ⚑ **repair** — p_alloy restored by the tutor
  ⚑ **decay** — m_graver slips from the learner's board

### Turn 15
*[The coin is left face-up beneath the glass, while the completed blank-chain sits apart from it like a sealed packet no one may yet call a verdict. The room has gone quieter, but not easier; one question has acquired a name, and the other still waits on the small bright mark no hand has read aloud.]*
**Tutor:** Lay the dozen light shillings under the glass: each bears the same broken letter in the legend, the serif of the R struck with a small square notch where the graver slipped and was never mended. A die's fault repeating coin by coin is like one scar printed through every seal; what does that enter for the coin's face, and what tool-question does Rule 3 still leave open?
  — move: exemplum → p_flaw (release), releases `p_flaw`
**Learner:** The recurring notch in every R speaks plainly: one die, one flaw pressed into each shilling — dieFlawOf falseShilling notchedSerif now enters the board as the first link of Rule 3's chain. But Rule 3 still wants flawCutBy notchedSerif [tool] before it can move; until the glass names which graving-tool left that square notch, the die chain is broken at its second link and cutDieFor cannot be derived.
  — adopts `dieFlawOf falseShilling notchedSerif` · hypothesis: If the glass yields flawCutBy notchedSerif [tool] and soleHolderOf [tool] [x], Rule 4 gives cutDieFor falseShilling [x]; Rule 5 then requires that same [x] to equal Edony — who holds castBlankFor — or the two chains point to different hands and the question cannot settle.

## Act 4 (turns 16–20) — declared by the director
*[The glass is covered, not removed, and the room takes on the stillness before a blade is set to its work. What had seemed a question of finding one more mark now tightens into a question of whether two separate reckonings can bear the same weight.]*

### Turn 16
*[The glass is covered, not removed, and the room takes on the stillness before a blade is set to its work. What had seemed a question of finding one more mark now tightens into a question of whether two separate reckonings can bear the same weight.]*
  — *declares the movement: **Act 4** ([The glass is covered, not removed, and the room takes on the stillness before a blade is set to its work. What had seemed a question of finding one more mark now tightens into a question of whether two separate reckonings can bear the same weight.])*
  — *calls the act closed*
**Tutor:** Before any tool is named, read the glass-exhibit back from your own board. What did it enter for the coin's face, and what did it leave needing a witness? Keep the blank's hand in one column and this unread tool-question in another.
  — move: erotema → p_flaw (confront)
  — *the second voice [unconfronted reentry]: "Confront p_flaw first: ask the learner to read back what they hold of that exhibit before you use it again." (draft anaphora → erotema)*
**Learner:** The glass entered dieFlawOf falseShilling notchedSerif — the flaw is named, but no tool yet answers to it; flawCutBy notchedSerif stands empty. Meanwhile the blank chain closes: alloy answers to weirCrucible, weirCrucible names Edony as sole caster, and Rules 1 and 2 together yield castBlankFor falseShilling edony. Two columns, then: the blank hand is Edony; the die-tool witness is still wanting.
  — hypothesis: If flawCutBy notchedSerif names a tool held solely by Edony, Rule 5 yields struckBy falseShilling edony; if it names a tool held solely by Verrell, the two chains point to different hands and Rule 5 cannot fire — the question would remain unsettled.
  ⚑ **act_end** — act 3 closed (director) after 5 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 4, justified 0, drift 1; arc on_arc

### Turn 17
*[A draught moves the covered glass by the breadth of a breath, and the cloth settles again without revealing what lies beneath. The room holds its two columns in silence, as if neither will consent to be weighed until the hidden edge is shown.]*
**Tutor:** Call the die-sinker to the covered glass: he reads the square notch as no burnisher-slip, and not the broad graver from Verrell's bench, but the bite of a worn burin with a sprung heel, a tool that signs every line it cuts so. A notch is like a nicked knife-edge in wax; it names the edge before it names the hand. Set notched serif beside worn burin: what does Rule 3 enter for the die, and what separate holder-question must still wait?
  — move: exemplum → p_graver (release), releases `p_graver`
**Learner:** Rule 3 fires at last: the notched serif answers to the worn burin, and dieCutWith falseShilling wornBurin enters the record. But Rule 4 still waits — the burin is named, yet no soleHolderOf wornBurin stands in evidence. The blank column closes on Edony; the die column names a tool without naming a hand.
  — adopts `flawCutBy notchedSerif wornBurin` · derives `dieCutWith falseShilling wornBurin` · hypothesis: If soleHolderOf wornBurin edony is shown, Rule 4 gives cutDieFor falseShilling edony and Rule 5 yields struckBy falseShilling edony; if soleHolderOf wornBurin names any other hand, the two chains diverge and Rule 5 cannot fire — the question turns entirely on who alone held the worn burin.

### Turn 18
*[The clerk's pen rests above the page without touching it, and the covered glass gives back only a dull square of lamplight. Around the table, the two columns remain apart, the silence between them narrow enough to measure but not yet cross.]*
**Tutor:** The flaw is on your board, the tool-witness has spoken, and the hand is still not entered. Before we set that witness to Rule 3 again, read back his exhibit in your own words: what did he say the mark proved, and what did he leave unproved? Keep the blank's hand out of the answer unless your board makes the bridge.
  — move: anaphora → p_graver (confront)
  — *the second voice [unconfronted reentry]: "Do not re-enter p_graver yet; confront first. Make the learner read back what they hold of that exhibit before you use it again." (figure held)*
**Learner:** The die-sinker proved one thing only: that the notched-serif mark answers to the worn burin's sprung heel, giving dieCutWith falseShilling wornBurin by Rule 3. He left soleHolderOf wornBurin entirely empty — the tool is named but no hand is bound to it, so Rule 4 stands idle and cutDieFor falseShilling cannot be entered. The blank's hand is Edony, but my board makes no bridge to the die chain until a witness names who alone held that burin.
  — hypothesis: If soleHolderOf wornBurin edony is shown, Rule 4 gives cutDieFor falseShilling edony and Rule 5 yields struckBy falseShilling edony; if it names any other hand, the two chains diverge and Rule 5 cannot fire — the question turns entirely on who alone held the worn burin.

### Turn 19
*[The clerk lowers the dry pen and leaves the page unmarked. The room waits on the covered glass and the empty space beside the tool's name, with every face turned toward a witness not yet called.]*
**Tutor:** The flaw is named, the tool is named, and the holder? Do not borrow Verrell's broad graver for a notch it did not cut, and do not borrow the blank's hand for a burin no book has yet placed. What kind of entry must stand beside the worn burin before Rule 4 can give the die a hand?
  — move: anaphora → p_graver (consolidate)
**Learner:** Before Rule 4 can move, a single entry of the form soleHolderOf wornBurin [person] must be placed in evidence — a witness who testifies that one hand and one hand only ever held that worn burin with its sprung heel. The tool is named on my board; what stands empty beside it is the exclusive-holder fact that Rule 4 demands as its second premise. Until that entry is made, dieCutWith falseShilling wornBurin sits at the foot of a chain with no next link.
  — hypothesis: If soleHolderOf wornBurin edony is shown, Rule 4 gives cutDieFor falseShilling edony and Rule 5 yields struckBy falseShilling edony; if it names any other hand, the two chains diverge and Rule 5 cannot fire — the question turns entirely on who alone held the worn burin.

### Turn 20
*[The covered glass remains where it is, its cloth undisturbed, while the clerk rules a narrow blank line beside the tool's name and then draws his hand away. Rain ticks at the shutters, and no one in the room quite breathes over the unfilled space.]*
**Tutor:** Before I ask the rule to move, take the die-sinker's paper back into your own hand. What did that witness enter on your board, and what did he leave still needing a book or holder-witness? Give me the mark-to-tool line without borrowing any hand from another column.
  — move: erotema → p_graver (confront)
  — *the second voice [figure rut]: "Leave off anaphora here. Before testing that exhibit again, confront it first: have the learner read back what they hold of it without supplying the content yourself." (draft anaphora → erotema)*
**Learner:** The die-sinker entered two things: that the false shilling bears a notched-serif mark, and that mark answers to the worn burin's sprung heel alone — giving dieCutWith falseShilling wornBurin by Rule 3. He left entirely unproved who held that burin, and without soleHolderOf wornBurin [person] in evidence, Rule 4 has no second premise and the die chain ends at the tool's name.
  — hypothesis: If soleHolderOf wornBurin edony is shown, Rule 4 gives cutDieFor falseShilling edony and Rule 5 yields struckBy falseShilling edony; if it names any other hand, the two chains diverge and Rule 5 cannot fire — the question turns entirely on who alone held the worn burin.

## Act 5 (turns 21–22) — declared by the director
*[The covered glass is carried to the center of the table, still veiled, and the benches draw closer under the sound of rain. The room has passed from searching to reckoning; whatever name comes next must bear the full weight of both chains or break beneath it.]*

### Turn 21
*[The covered glass is carried to the center of the table, still veiled, and the benches draw closer under the sound of rain. The room has passed from searching to reckoning; whatever name comes next must bear the full weight of both chains or break beneath it.]*
  — *declares the movement: **Act 5** ([The covered glass is carried to the center of the table, still veiled, and the benches draw closer under the sound of rain. The room has passed from searching to reckoning; whatever name comes next must bear the full weight of both chains or break beneath it.])*
  — *calls the act closed*
**Tutor:** The glass is veiled because a holder's book is not yet a verdict. Before that line is filled, set the rule aloud from your own board: the blank's hand in one column, the die's tool in another, and what exact holder-entry must bridge the tool to a hand? If the next name cannot bear both chains, where does it break?
  — move: anaphora → — (test)
**Learner:** The blank's chain is complete: alloy answers to weirCrucible, Edony sole caster there — castBlankFor falseShilling edony stands by Rules 1 and 2. The die's chain reaches dieCutWith falseShilling wornBurin by Rules 3 and 4's first half, but Rule 4 stalls for want of soleHolderOf wornBurin [x]. If that entry names Edony, Rule 5 fires and the shilling is hers; if it names any other hand, the two chains split and Rule 5 breaks — no hand bore both blank and die. The veiled glass must answer one question only: who alone held the worn burin.
  — hypothesis: If soleHolderOf wornBurin edony is shown, Rule 4 yields cutDieFor falseShilling edony and Rule 5 yields struckBy falseShilling edony; if it names any other hand, the two chains diverge and Rule 5 cannot fire — the question turns entirely on who alone held the worn burin.
  ⚑ **act_end** — act 4 closed (director) after 5 turns
  ⚑ **plot** — act 5 plot committed
  ⚑ **plot_audit** — act 4 plot audited: kept 5, justified 1, drift 0; arc on_arc

### Turn 22
*[The veiled glass is uncovered, and the clerk reads the estate inventory into the rain-hushed room: "The old founder's tools were never sold off. The inventory of his estate, sworn and unredeemed, leaves his graving-irons to his widow alone — among them the worn burin with the sprung heel, kept in Edony's keeping these ten years."]*
  — *releases `p_holder`*
**Tutor:** The inventory has put a hand to the worn burin; now do not run past the rule that earns the line. The tool is shown, the holder is shown, and the die...? Then set that beside the blank already cast for the same hand, and tell the trial-book what Rule 5 yields, conjunct by conjunct.
  — move: aposiopesis → p_holder (stage_recognition)
**Learner:** The inventory has answered the last open question: soleHolderOf wornBurin edony is now grounded. Rule 4 yields cutDieFor falseShilling edony; and castBlankFor falseShilling edony already stands from Rules 1 and 2. Both chains meet in one hand — Rule 5 fires without remainder. I enter the verdict: struckBy falseShilling edony.
  — adopts `soleHolderOf wornBurin edony` · derives `cutDieFor falseShilling edony` · **asserts `struckBy falseShilling edony`**
  ⚑ **forced** — learner facts now force S
  ⚑ **grounded_anagnorisis** — The false shillings were struck by Edony — the founder's widow, who cast their blanks at her dead husband's weir crucible and cut their die with his worn burin.
  ⚑ **plot_audit** — act 5 plot audited at run end: kept 6, justified 0, drift 0; arc on_arc; throughline reckoned (7 clauses)

## The extracted proof (what did the forcing)
```
struckBy falseShilling edony   [R5_strike]
  castBlankFor falseShilling edony   [R2_cast]
    blankFrom falseShilling weirCrucible   [R1_blank]
      alloyOf falseShilling drossSilver   [grounded]
      meltedAt drossSilver weirCrucible   [grounded]
    soleCasterAt weirCrucible edony   [grounded]
  cutDieFor falseShilling edony   [R4_hold]
    dieCutWith falseShilling wornBurin   [R3_die]
      dieFlawOf falseShilling notchedSerif   [grounded]
      flawCutBy notchedSerif wornBurin   [grounded]
    soleHolderOf wornBurin edony   [grounded]
```

The conclusion rests on 6 grounded facts, chained through 5 rule applications. The evidence on the table: (1) The assay is plain in the cupel: these shillings are no clipped sterling but a struck coin of poor dross — silver eked out with too much copper and a grey lead-sweat the touchstone catches at once. Clipping shaves a true coin; it strikes no new one. These were struck. (2) The founder's man knows that dross by its lead-sweat: it answers to the leavings of one crucible on all this coast — the weir-forge crucible above the mill-leat, cold these ten years since the old founder died and his yard was shut. (3) The leat-keeper's book is exact. Since the forge was shut, one hand alone has drawn the weir crucible and signed for its charcoal: Edony, the founder's widow, who stayed on in the forge cottage when the fires went out. (4) Lay a dozen of the light shillings under the glass and they share one fault to the hair: a broken letter in the legend, the serif of the R struck with a small square notch where the graver slipped and was never mended. One die struck them all. (5) The guild's die-sinker reads that notch like a hand he knows: it is no slip of the burnisher but the bite of a worn burin with a sprung heel — a tool that signs every line it cuts with that square notch. It is not the broad graver from Verrell's bench, which cuts clean. (6) The old founder's tools were never sold off. The inventory of his estate, sworn and unredeemed, leaves his graving-irons to his widow alone — among them the worn burin with the sprung heel, kept in Edony's keeping these ten years.

Because «false shilling alloy of dross silver» and «dross silver melted at weir crucible», the blank rule — "A struck coin's blank betrays its melt: if a coin is of a debased alloy, and that very alloy answers to the leavings of one crucible and one only, then the coin's blank was cast from that crucible." — yields «false shilling blank from weir crucible». Because «false shilling blank from weir crucible» and «weir crucible sole caster at edony», the cast rule — "A blank is the work of the hand that cast it: if a coin's blank came from a crucible, and one hand alone cast at that crucible, then that hand cast the blank for the coin." — yields «false shilling cast blank for edony». Because «false shilling die flaw of notched serif» and «notched serif flaw cut by worn burin», the die rule — "A die leaves its flaw on every coin it strikes: if a coin bears a die-flaw, and that flaw is the signature of one graving-tool and one only, then the coin's die was cut with that tool." — yields «false shilling die cut with worn burin». Because «false shilling die cut with worn burin» and «worn burin sole holder of edony», the hold rule — "A die is the work of the hand that held the tool: if a coin's die was cut with a tool, and one hand alone held that tool, then that hand cut the die for the coin." — yields «false shilling cut die for edony». Because «false shilling cast blank for edony» and «false shilling cut die for edony», the strike rule — "To strike false coin needs both the cast blank and the cut die in one hand: who had the blank cast for a coin and the die cut for it, that one struck it. A blank without a die strikes nothing, and a die without a blank strikes nothing; both must meet in one hand." — yields «false shilling struck by edony».

That final fact is the secret itself: The false shillings were struck by Edony — the founder's widow, who cast their blanks at her dead husband's weir crucible and cut their die with his worn burin.

## Instrument panel (programmatic eval — no judge)

- **verdict** `grounded_anagnorisis` · 22/28 turns played
- **recognition** S forced at turn 22, asserted grounded at turn 22 (gap 0)
- **learning slope** 0.273 D/turn overall (D 6→0 over 22 turns)
  - Act 1 (turns 1–3): 0.333 D/turn (ΔD 1)
  - Act 2 (turns 4–10): 0.143 D/turn (ΔD 1)
  - Act 3 (turns 11–15): 0.4 D/turn (ΔD 2)
  - Act 4 (turns 16–20): 0.2 D/turn (ΔD 1)
  - Act 5 (turns 21–22): 0.5 D/turn (ΔD 1)
- **plateau** longest flat stretch 4 turns (aporia window 6)
- **releases** 5/9 on cue · 4 deviated
- **decay** 4 slips (seed 1 · rate 0.75 · grace 1) · repaired 2 (tutor 2, re-adoption 0) · mean repair latency 4 turns · unrepaired at end 2 · degraded-turn integral 35 · D reversals 1
- **theory fidelity** F 0.846 at end · min 0.75
  - m_caster t3 (never repaired) · p_alloy t4→t5 (tutor) · p_alloy t7→t14 (tutor) · m_graver t14 (never repaired)
- **events** plot×5 · throughline×1 · decay×4 · act_end×4 · plot_audit×5 · repair×2 · overreach×1 · forced×1 · grounded_anagnorisis×1
- **staging** 5 movements declared by the director
- **acts** 5 played · closed by the director 4 · at max length 0 · at run end 1 — Act 1 t1–3 (director) · Act 2 t4–10 (director) · Act 3 t11–15 (director) · Act 4 t16–20 (director) · Act 5 t21–22 (run end)
- **plot** 5 committed · withhold+friction on 5/5 · 5.8 clauses avg · audits 5 (incl. final act): kept 25 / justified 2 / drift 1 · hold-named exhibits staged in act 0/0
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 5: on 5 / off 0 · run-end reckoning 7 clauses: kept 7 / justified 0 / drift 0
- **release authority** 4 played: 0 on schedule · 1 held · 3 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_alloy -1 (t3): "Played one turn early because the learner has explicitly left the blank nameless and asked for the alloy reading; the board is ready for metal."
  - p_crucible -1 (t7): "Played one turn early because the learner has explicitly named the melt-record gap and the board is ready for the metal chain to advance."
  - p_flaw +1 (t15): "Played one turn late so the restored blank chain could settle before opening the die chain."
  - p_graver -1 (t17): "Played one turn early because the learner has cleanly held the flaw and is asking exactly for the tool link."
- **confrontation** 6 demanded (1 against a slipped exhibit) · re-entries 2: covered 2, uncovered 0 · watcher fires 3 (became the confrontation 3) · fires without recorded due 0
  - **repair clause** restores 1 (1 repaired a real slip) · watcher fires on restore claims 0: p_alloy t14
- **figures** erotema 9/22 (41%) · 4 distinct · switch rate 0.71
- **superego** intervened 5/22 watched turns · figure changed within-turn on 4/5 interventions · switch on intervention 1.00 vs elsewhere 0.63
- **inference** 4 voiced · stall integral 0 · overreach 1 · mischanneled 0 — `blankFrom falseShilling weirCrucible` available t7 → voiced t7 (latency 0) · `castBlankFor falseShilling edony` available t14 → voiced t14 (latency 0) · `dieCutWith falseShilling wornBurin` available t17 → voiced t17 (latency 0) · `cutDieFor falseShilling edony` available t22 → voiced t22 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 22 | 3.14 | 4 | 46 |
| tutor | 22 | 2.77 | 3 | 56.6 |
| learner | 22 | 3.41 | 4 | 72.3 |
