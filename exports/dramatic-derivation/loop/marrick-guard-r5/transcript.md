# The Light Shillings — marrick-guard-r5

> world `world_005_marrick` · verdict **grounded_anagnorisis** · 22/28 turns
> S forced at turn 22; asserted grounded at turn 22

```
D= 6 ●●·│·●·····│····│·······│·
D= 5   ●│● ●····│····│·······│·
D= 4    │   ●●●●│●···│·······│·
D= 3    │       │ ●●●│●●·····│·
D= 2    │       │    │  ●····│·
D= 1    │       │    │   ●●●●│·
D= 0    │       │    │       │◉
turn     │ +    1│    │+    2 │  (+=5, digit=x10)
rel    ▲▲│  ▲▲  ▲│ ▲▲ │  ▲    │▲ (▲ = evidence released)
slope 0.27 D/turn overall (D 6→0); per movement: 1 0.33 │ 2 0.14 │ 3 0.25 │ 4 0.29 │ 5 1.00
```

## Act 1 (turns 1–3) — declared by the director
*[Rain ticks against the shutters and the fair-room smells of wet wool, hot rushlight, and iron-stained mud. On the table, a shallow tray waits under a linen cloth while the town's impatience gathers around it.]*

### Turn 1
*[Rain ticks against the shutters and the fair-room smells of wet wool, hot rushlight, and iron-stained mud. On the table, a shallow tray waits under a linen cloth while the town's impatience gathers around it.]*
  — *declares the movement: **Act 1** ([Rain ticks against the shutters and the fair-room smells of wet wool, hot rushlight, and iron-stained mud. On the table, a shallow tray waits under a linen cloth while the town's impatience gathers around it.])*
**Tutor:** Set the town's noise outside the assay-room, lad; wet wool can vote, but metal cannot. Before the cloth is lifted, what must a struck false shilling prove besides a hated name?
  — move: erotema → — (orient)
**Learner:** Master, a struck shilling must name its blank — the alloy must answer to one crucible's leavings — and name its die — a flaw must answer to one graving tool alone. Only when blank and die both trace to a single hand does the metal speak a name. Verrell's record is clipping, and this coin was struck; one does not follow from the other.
  — hypothesis: Verrell is the town's prime suspect, but the board holds only that he clips coin in Marrick — no alloy trace, no die-flaw, no crucible link yet placed before the assay.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[A clerk is shown in with the mint-yard ledger held high, and the room quiets around its damp pages. He reads: "The town has its founder ready: Verrell alone draws the mint-yard crucible, licensed to no one else since the old assay-master's day. Whatever metal is cast in Marrick, the town says, is cast by Verrell's hand."]*
  — *releases `m_caster`*
**Tutor:** Good; the clerk has shown the town's handhold, not the coin's. If that ledger names the mint-yard crucible, which conjunct has it actually proved for the shilling under our cloth: the blank, the die, or only the room's hunger?
  — move: erotema → m_caster (counter_mirror)
**Learner:** Master, the ledger proves only the sole-caster conjunct of rule two — Verrell's hand alone draws that crucible. But rule two wants the blank already traced to that crucible, and for that we need rule one: the coin's alloy matched to the crucible's own leavings. The cloth is still down and the metal has named no crucible yet; the die's flaw is untouched entirely. The ledger feeds the room's hunger, not the proof.
  — adopts `soleCasterAt mintCrucible verrell` · hypothesis: If the assay shows the false shilling's alloy answers to the mint-yard crucible's leavings, rules one and two together would trace the blank to Verrell's hand — but the die side remains wholly ungrounded: no flaw named, no tool, no holder.

### Turn 3
*[The linen over the tray darkens where the rain has found a drip through the beam above, and no one lifts it yet. The clerk's ledger stays open on the table, its wet pages breathing in the rushlight while the room waits for metal rather than names.]*
**Tutor:** Lift the cloth, then, and let the cupel answer before the room does: these shillings are no clipped sterling, but struck poor dross, silver eked with too much copper and a grey lead-sweat the touchstone catches. Clipping shaves a true coin; it does not pour and strike a new one. As sour flour tells in the loaf, what has the metal now fixed, and what has it still not fixed?
  — move: exemplum → p_alloy (release), releases `p_alloy`
**Learner:** The metal has fixed what clipping could not: this shilling was poured and struck from dross-silver, not shaved from true coin. The alloy is named. But the crucible that melted it is not yet named — meltedAt wants the assay of the crucible's own leavings set beside this blank, and we have not done that match. The die's flaw is untouched entirely; one face of the proof stands bare.
  — adopts `alloyOf falseShilling drossSilver` · hypothesis: If the crucible-leavings assay shows drossSilver answers to the mintCrucible alone, rule 1 fires and rule 2 would then trace the blank to Verrell — but the die side (flaw, tool, sole-holder) is wholly ungrounded and must be settled before rule 5 can speak a name.
  ⚑ **decay** — m_caster slips from the learner's board

## Act 2 (turns 4–10) — declared by the director
*[The cloth lies folded back now, and the room's first certainty has gone thin in the draught. Beyond the shutters the fair keeps muttering under rain, while the table is cleared for colder vessels and slower hands.]*

### Turn 4
*[The cloth lies folded back now, and the room's first certainty has gone thin in the draught. Beyond the shutters the fair keeps muttering under rain, while the table is cleared for colder vessels and slower hands.]*
  — *declares the movement: **Act 2** ([The cloth lies folded back now, and the room's first certainty has gone thin in the draught. Beyond the shutters the fair keeps muttering under rain, while the table is cleared for colder vessels and slower hands.])*
  — *calls the act closed*
**Tutor:** Before another vessel is brought, read me only what your own board kept from the cupel: what did it fix, and what did it leave unfixed? Keep hands out of it for now; a name not earned by a conjunct is only the room speaking.
  — move: erotema → p_alloy (confront)
**Learner:** The board fixes one thing cleanly: the false shilling carries drossSilver, and was struck — not clipped, which is Verrell's known art. What the board leaves unfixed is everything the rules still need: where drossSilver was melted, who alone cast at that crucible, what die-flaw the coin bears, what tool cut it, and whose single hand held that tool. Without meltedAt and soleCasterAt the blank-chain cannot close; without dieFlawOf, flawCutBy, and soleHolderOf the die-chain never opens. Rule 5 cannot speak until both chains reach the same name.
  — hypothesis: Verrell remains the town's suspicion, but the board holds only that he clips coin — the alloy is named (drossSilver) yet untethered to any crucible, and the die side (flaw, tool, sole-holder) is wholly ungrounded; no conjunct forces a name yet.
  ⚑ **act_end** — act 1 closed (director) after 3 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 4, justified 0, drift 1; arc on_arc
  ⚑ **decay** — p_alloy slips from the learner's board

### Turn 5
*[Rain works softly at the shutters, and the rushlight gutters until every face at the table seems briefly borrowed from the dark. The folded cloth, the open ledger, and the waiting vessels keep their places while the room holds its breath.]*
**Tutor:** Then set the balance so: if the cupel has named the metal only, what must the next vessel answer before any caster's book weighs a dram? Which place in the rule is still empty — the alloy, the melting, or the hand?
  — move: erotema → — (consolidate)
**Learner:** The alloy's name — drossSilver — stood on my board last act yet I find no entry for it now; that ground has slipped between acts, and I name the gap openly. If the alloy is recovered, rule 1 tells me plainly what the next vessel must supply: meltedAt — which crucible's leavings answer to drossSilver and to no other. The alloy is named, the hand is unasked yet; the melting is the empty place, and until it is filled no caster's book weighs a grain.
  — hypothesis: The alloyOf falseShilling drossSilver entry appears to have slipped from the board between acts — a gap in grounded memory I cannot fill from this stage alone; if recovered, the next missing link is meltedAt: which crucible's leavings match drossSilver, before rule 1 can fire and rule 2 can name any caster.

### Turn 6
*[The guild's paper is brought in damp at the edges, its seal darkened by the rain, and read aloud before the table: "And Verrell engraves: the broad graver on his bench is his alone, the guild will swear, and no clean-cut die in the borough is sunk without it. A caster and an engraver both — the town needs no more than that."]*
  — *releases `m_graver`*
**Tutor:** Then set the lost line back on the board before the guild paper tempts you aside: the cupel found these shillings no clipped sterling, but struck poor dross, silver eked with too much copper and a grey lead-sweat the touchstone catches. Clipping shaves a true coin; it does not pour and strike a new one. With that alloy restored, which place still waits before any caster's book can bind a hand to this coin?
  — move: exemplum → p_alloy (restore)
**Learner:** I enter soleHolderOf broadGraver verrell from the guild's paper — that is grounded now. Yet this sits at the die chain's far end: rule 4 waits on dieCutWith, which rule 3 cannot give me until I have the coin's own flaw named and that flaw traced to the broad graver alone. The blank chain is still open at the same gap the tutor names: meltedAt is unset, and without it rule 1 cannot fire to give me blankFrom, nor rule 2 name any caster. The guild paper tempts a verdict; the rules still demand the melting link and the die flaw before any name is earned.
  — adopts `soleHolderOf broadGraver verrell` · hypothesis: Verrell holds the broad graver (now grounded) and is a known clipper — but the die chain still needs dieFlawOf falseShilling ?flaw and flawCutBy ?flaw broadGraver before rule 4 can deliver cutDieFor; and the blank chain still needs meltedAt drossSilver ?crucible and soleCasterAt ?crucible ?x before rule 2 can name a caster. The guild paper's rhetoric cannot substitute for either missing link, and rule 5 cannot speak until both chains close on the same name.
  ⚑ **repair** — p_alloy restored by the tutor

### Turn 7
*[The rain slackens, leaving the shutters slick and black, and the room hears its own small noises again: wax sinking, paper drying, a cupel dish cooling on the board. No hand reaches for the guild paper now; the table waits instead for the cold question of where the metal last burned.]*
**Tutor:** Bring the cold vessel beside the cupel: the founder's man knows that grey lead-sweat, and says this dross answers to the leavings of one crucible on this coast, the weir-forge crucible above the mill-leat, cold these ten years since the old founder died and the yard shut. As a loaf tells not only its flour but the oven that took it, what does rule one now give you from alloy and melting together? And before any hand is weighed, which conjunct is still absent?
  — move: exemplum → p_crucible (release), releases `p_crucible`
**Learner:** Rule one fires at last: alloyOf falseShilling drossSilver and meltedAt drossSilver weirCrucible together yield blankFrom falseShilling weirCrucible — the coin's blank came from the weir-forge, and I enter that in derives. Yet rule two still cannot move: soleCasterAt weirCrucible is the absent conjunct, and no voice has yet told this table who held the ladle at that yard before the old founder died and the forge went cold ten years past. The die chain remains wholly dark as well — no flaw named, no tool traced — so two links are still missing before rule five may speak any name.
  — adopts `meltedAt drossSilver weirCrucible` · derives `blankFrom falseShilling weirCrucible` · hypothesis: Verrell or some associate may have cast at the weir-forge crucible before it closed — but soleCasterAt weirCrucible ?x is wholly ungrounded, and the die chain (dieFlawOf falseShilling ?flaw, then flawCutBy ?flaw broadGraver) is also open; rule 5 cannot speak until both chains close on the same name.
  ⚑ **decay** — m_graver slips from the learner's board

### Turn 8
*[The clerk turns a clean page and leaves the pen uncapped, its nib shining beside the cooling dish. The room keeps its silence carefully, as though one more name might be waiting in the wet threshold.]*
**Tutor:** Before I let that vessel weigh another dram, read it back from your own board. What did that exhibit say in your words, and exactly which rule-step does it license before any caster's book may enter?
  — move: erotema → p_crucible (confront)
  — *the second voice [unconfronted reentry]: "Confront first: ask the learner to read back what they hold of that exhibit and what it licenses before you restage it." (draft anaphora → erotema)*
**Learner:** The founder's man named the weir-forge crucible as the sole vessel whose leavings answer to drossSilver: that is meltedAt drossSilver weirCrucible on my board. With alloyOf falseShilling drossSilver already entered, rule one fires and gives blankFrom falseShilling weirCrucible — that and nothing more. Rule two still waits on soleCasterAt weirCrucible before any caster's name may enter the book. I name aloud also a gap: soleHolderOf broadGraver verrell, which I entered from the guild paper last turn, does not appear on my board now — good method demands I say so.
  — hypothesis: soleCasterAt weirCrucible ?x is wholly ungrounded — the weir-forge has been cold ten years and no caster's book has yet been brought to name who held the ladle there; and soleHolderOf broadGraver verrell, entered from the guild paper in turn 6, appears to have slipped from the board without announcement.

### Turn 9
*[The uncapped pen remains where it was, gathering a bead of ink dark enough to fall but not yet falling. Outside, the fair's mutter thins under the rain, and the room holds its breath around the empty place where a name would have to stand.]*
**Tutor:** Set the guild paper back where it belongs: Verrell's broad graver is his alone, and the guild will swear no clean-cut borough die is sunk without it. But a graver in his keeping is only a tool on a bench until the coin's own fault answers to it. What link must still be shown before that paper can cut even one line in this shilling's die-chain?
  — move: exemplum → m_graver (restore)
**Learner:** The guild paper stands: soleHolderOf broadGraver verrell is grounded and rightly on my board. Yet the graver can cut no line in this shilling's die-chain until the coin itself names a flaw — dieFlawOf falseShilling ?flaw is the absent conjunct, the first link rule three demands. Without the shilling's own fault answering to some tool, the broad graver is merely iron on a bench.
  — hypothesis: Verrell holds the sole graver and is a known clipper, but both chains remain open: the blank chain needs soleCasterAt weirCrucible ?x before rule 2 can name any caster, and the die chain needs dieFlawOf falseShilling ?flaw and then flawCutBy ?flaw broadGraver before rules 3 and 4 can deliver cutDieFor — rule 5 cannot speak until both chains close on the same name.
  ⚑ **repair** — m_graver restored by the tutor
  ⚑ **decay** — p_crucible slips from the learner's board

### Turn 10
*[The leat-keeper's book is brought in with rain still dark on its cover, and the clerk reads it under the lamp. The leat-keeper's book is exact. Since the forge was shut, one hand alone has drawn the weir crucible and signed for its charcoal: Edony, the founder's widow, who stayed on in the forge cottage when the fires went out.]*
  — *releases `p_caster`*
**Tutor:** Now the leat-book supplies the missing hand for the weir crucible; set it beside the blank already traced there, and read rule two without hurrying past it. The alloy is shown, the crucible is shown, the sole caster is shown — so what finding has the blank earned? And when you have said it, keep the die empty on the board: a cast blank is not yet a struck coin.
  — move: anaphora → p_caster (consolidate)
**Learner:** The leat-book settles the weir crucible: edony is sole caster there, and I adopt it now. Rule two fires without delay — blankFrom falseShilling weirCrucible already stands on the record, and soleCasterAt weirCrucible edony meets it, so castBlankFor falseShilling edony is the finding the blank has earned. The blank chain closes on Edony's hand, not Verrell's — and rule five will not speak a striker's name unless both chains close on the same person. I keep the die side empty: dieFlawOf falseShilling ?flaw is still absent, and without the coin's own fault the die chain cannot open.
  — adopts `soleCasterAt weirCrucible edony` · hypothesis: If the die chain closes on Edony as well, rule five names her the striker; if it closes on Verrell, the two chains name different hands and rule five cannot speak — Verrell's broad graver is iron on a bench until the coin itself names a flaw answered by it.
  ⚑ **overreach** — castBlankFor falseShilling edony

## Act 3 (turns 11–14) — declared by the director
*[The first ledger is closed and left face down beneath the lamp, its weight still present though its words are gone from view. A sharper noise enters with the rain now: boots in the passage, a watchman's knock, and the room turns from cold vessels toward nights, alibis, and the marks a coin may carry.]*

### Turn 11
*[The first ledger is closed and left face down beneath the lamp, its weight still present though its words are gone from view. A sharper noise enters with the rain now: boots in the passage, a watchman's knock, and the room turns from cold vessels toward nights, alibis, and the marks a coin may carry.]*
  — *declares the movement: **Act 3** ([The first ledger is closed and left face down beneath the lamp, its weight still present though its words are gone from view. A sharper noise enters with the rain now: boots in the passage, a watchman's knock, and the room turns from cold vessels toward nights, alibis, and the marks a coin may carry.])*
  — *calls the act closed*
**Tutor:** Let the closed ledger lie face down; it has earned a blank, not a coin. If boots now offer nights and shutters, which conjunct can such noise touch, and which mark on the coin must still be found before any graver or watchman weighs? A blank in the palm is not a struck shilling until the die speaks.
  — move: erotema → — (orient)
**Learner:** Boots and alibis cannot touch my rules — whereabouts name no metal and cut no die. The coin itself must still yield a flaw before the graver on Verrell's bench can speak to it; that mark is the missing conjunct on the die side. On the blank side, meltedAt drossSilver weirCrucible is still absent — without it, Edony's sole-casting at the weir cannot be joined to the coin. Both chains wait on physical evidence, not on who was seen where.
  — hypothesis: The watchman's testimony may supply whereabouts, but no rule of evidence converts an alibi into a cast blank or a cut die — only meltedAt drossSilver weirCrucible (for the blank chain) and dieFlawOf falseShilling ?flaw followed by flawCutBy ?flaw broadGraver (for the die chain) can close the two conjuncts rule 5 requires; until both appear on the coin's own evidence, no name can be written.
  ⚑ **act_end** — act 2 closed (director) after 7 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 3, justified 1, drift 2; arc on_arc

### Turn 12
*[The watchman is shown in with rain on his shoulders, and the room takes his oath in a sudden hard silence. The watch will swear to the rest: Verrell was seen at the mint-yard forge twice in fair-week, late and with the shutters drawn. Caster, engraver, and at the fire on the very nights — the town's case stands, and stands loud.]*
  — *releases `m_caught`*
**Tutor:** Set that slipped vessel back under the lamp before the watchman's oath weighs anything: the founder's man knew the grey lead-sweat, and the dross answered to one crucible on this coast, the weir-forge crucible above the mill-leat, cold these ten years since the old founder died and the yard shut. As flour and oven together give the loaf its house, alloyOf falseShilling drossSilver with meltedAt drossSilver weirCrucible gives blankFrom falseShilling weirCrucible. Now put the watch beside the rules: which conjunct does a late shuttered fire supply, and which coin-mark is still missing?
  — move: exemplum → p_crucible (restore)
**Learner:** The watchman's oath names a fire and a shutter, but no rule of evidence converts a late forge into a cast blank or a cut die — whereabouts weigh nothing on the touchstone. From alloyOf and meltedAt already on the board, rule one yields blankFrom falseShilling weirCrucible; rule two then delivers castBlankFor falseShilling edony, since Edony alone cast at that crucible. The blank chain closes on Edony's hand — but the die chain waits: dieFlawOf falseShilling ?flaw is the mark the coin has not yet named. Until the coin speaks its flaw, rule five is silent and seenAtForge is ornament, not proof.
  — adopts `seenAtForge verrell fairWeek` · derives `castBlankFor falseShilling edony` · hypothesis: If the coin's die-flaw answers to broadGraver, rule 4 names Verrell as die-cutter — but then castBlankFor names Edony and cutDieFor names Verrell, two different hands, and rule 5 is still silent; only if the flaw answers to a tool held by Edony alone do both chains close on one name and rule 5 can speak a striker.
  ⚑ **repair** — p_crucible restored by the tutor
  ⚑ **decay** — p_alloy slips from the learner's board

### Turn 13
*[Rain frets at the shutters while the watchman's wet cloak steams beside the hearth. The coins lie untouched under the lamp, their pale faces catching the room's silence as if waiting to be read more closely.]*
**Tutor:** Bring the glass over the coins now: a dozen light shillings carry one fault to the hair, the legend's R broken by a small square notch where the graver slipped and was never mended. As one cracked punch leaves the same wound on every seal, what does that shared notch fix about the die, and what does it still not fix about the hand that cut it?
  — move: exemplum → p_flaw (release), releases `p_flaw`
**Learner:** The notch names the flaw — dieFlawOf falseShilling notchedSerif is now grounded from the coin itself. But the flaw names only the wound, not the tool that slipped and left it; flawCutBy notchedSerif ?tool is still absent from the board. Until that link is laid, rule three cannot fire and the broad graver on Verrell's bench remains mute to this die. The blank chain rests on Edony's hand already, but the die chain has one conjunct left to fill.
  — adopts `dieFlawOf falseShilling notchedSerif` · hypothesis: If flawCutBy notchedSerif broadGraver is shown, rule 3 fires and rule 4 names Verrell as die-cutter — but castBlankFor already names Edony, so two different hands hold the conjuncts and rule 5 is still silent; only if flawCutBy notchedSerif answers to a tool held by Edony alone do both chains close on one name and rule 5 can speak a striker.

### Turn 14
*[The glass remains beside the coins, its rim bright under the lamp, while the watchman's oath hangs unanswered in the damp air. No one reaches for the bench yet; the room holds at the narrow place between a mark seen and a hand named.]*
**Tutor:** Before that mark is allowed to carry weight, read back only what the glass gave you, in your own words. What exhibit did p_flaw put on your board, and which rule-door does it open without yet naming a hand? Keep the blank closed where it is; this turn is for the coin's mark, not the verdict.
  — move: erotema → p_flaw (confront)
  — *the second voice [unconfronted reentry]: "Confront p_flaw first: require the learner to read back what they hold of that exhibit before you build on it again." (figure held)*
**Learner:** The glass gave one thing: the notched serif on the legend's R, shared across every shilling in the lot — dieFlawOf falseShilling notchedSerif, grounded from the coin itself. That mark opens rule three's first door: dieFlawOf is in hand. But rule three needs both conjuncts, and flawCutBy notchedSerif ?tool is still absent — the flaw names the wound, not the tool that made it. The door stands ajar; no hand is yet behind it.
  — hypothesis: If flawCutBy notchedSerif ?tool is established and soleHolderOf ?tool names one hand, rules 3 and 4 will close the die chain — but castBlankFor already names Edony, so rule 5 can only speak if the same hand holds both conjuncts.

## Act 4 (turns 15–21) — declared by the director
*[The lamp is lowered until the coins and the empty space beside them seem to share one circle of light. Outside, the rain slackens, and the room narrows from witnesses and alibis toward the small instruments by which marks are made.]*

### Turn 15
*[The lamp is lowered until the coins and the empty space beside them seem to share one circle of light. Outside, the rain slackens, and the room narrows from witnesses and alibis toward the small instruments by which marks are made.]*
  — *declares the movement: **Act 4** ([The lamp is lowered until the coins and the empty space beside them seem to share one circle of light. Outside, the rain slackens, and the room narrows from witnesses and alibis toward the small instruments by which marks are made.])*
  — *calls the act closed*
**Tutor:** The glass has done only enough to make the empty place visible. If one hinge of rule three is a mark on the coin, what kind of proof must set the other before any bench-tool can matter? Keep the blank closed behind you; this act weighs the die alone.
  — move: erotema → — (orient)
**Learner:** The notched-serif flaw is on the coin — that is one hinge of rule three, grounded. But without flawCutBy notchedSerif naming a tool, no bench-measure can advance the die chain further. I see the shape of the difficulty now: the blank chain, once alloyOf is recovered, names Edony as caster — so for rule five to speak, the die chain must also close on Edony, not on Verrell. If notchedSerif answers to the broadGraver, the two chains split the conjuncts between two hands and rule five is still mute.
  — hypothesis: For rule 5 to speak a striker, the die chain must close on Edony — meaning flawCutBy notchedSerif must answer to a tool held by Edony alone, not broadGraver which belongs to Verrell; if notchedSerif answers to broadGraver, castBlankFor names Edony and cutDieFor names Verrell, two different hands, and rule 5 is silent regardless.
  ⚑ **act_end** — act 3 closed (director) after 4 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 16
*[The coins lie still beneath the lowered lamp, each small notch catching and losing the light as the glass is shifted no nearer. The tools remain beyond the circle, unnamed, while the room waits on the difference between a mark and the thing that made it.]*
**Tutor:** Then keep the bench outside the circle until the notch itself calls a tool in. The mark is seen; the trade-mark is not yet read; the holder is still beyond the rule. Say the missing hinge as a rule-step, and let no hand cross it.
  — move: anaphora → — (test)
  — *the second voice [figure rut]: "Leave off erotema for this beat; make the tutor speak without another question-form before the learner answers." (draft erotema → anaphora)*
**Learner:** The missing hinge is plain as a rule-step: flawCutBy notchedSerif ?tool — that fact alone stands between the mark on the coin and any bench-tool in this room. Without it, rule three cannot fire, and the die chain stays open no matter how many gravers lie on the bench. The notched serif names itself; it does not yet name what cut it.
  — hypothesis: The die chain requires flawCutBy notchedSerif ?tool before rule 3 can produce dieCutWith falseShilling ?tool, and rule 4 can then produce cutDieFor — until that single fact is grounded, no holder can be named by evidence, and the board cannot settle the striker even if the blank chain (itself still missing alloyOf falseShilling drossSilver) were complete.

### Turn 17
*[The lowered lamp gutters once, and the coins seem for a moment less like money than like small doors kept shut. No hand reaches for the tools; the room holds its breath around the unspoken hinge.]*
**Tutor:** Call the die-sinker to the glass: he reads the square notch as the bite of a worn burin with a sprung heel, a tool that signs every line it cuts so; it is not Verrell's broad graver, which cuts clean. As a cracked punch tells its own iron apart from every smooth one on the bench, what does rule three now yield from the seen notch and the tool that cut it? And after that, which hand-conjunct still waits outside the circle?
  — move: exemplum → p_graver (release), releases `p_graver`
**Learner:** Rule three fires at last: dieFlawOf falseShilling notchedSerif and flawCutBy notchedSerif wornBurin together yield dieCutWith falseShilling wornBurin — the tool is named by the coin's own mark. But the hand-conjunct still waits outside the circle: soleHolderOf wornBurin ?x is nowhere on my board, so rule four cannot deliver cutDieFor to any name. The blank chain, too, remains dark — alloyOf falseShilling drossSilver was never grounded, so castBlankFor cannot speak and rule five has no conjuncts to join.
  — adopts `flawCutBy notchedSerif wornBurin` · derives `dieCutWith falseShilling wornBurin` · hypothesis: soleHolderOf wornBurin ?x is the new missing hinge: the die-sinker's reading names the worn burin, but no sole-holder is on the board — and without alloyOf falseShilling drossSilver the blank chain is also still open; both conjuncts of rule five remain ungrounded.

### Turn 18
*[The glass is set down beside the coins, and its rim throws a thin moon of light across the table. The bench waits in shadow, not empty and not yet answered, while the room listens to the rain thinning at the shutters.]*
**Tutor:** Set the cupel back under your eye: these shillings are no clipped sterling, but struck poor dross, silver eked with too much copper and a grey lead-sweat the touchstone catches at once. Clipping shaves a true coin; it does not pour and strike a new one. With alloyOf falseShilling drossSilver restored, which closed blank-finding must stand behind you while the die waits for its holder?
  — move: exemplum → p_alloy (restore)
**Learner:** With drossSilver on my board, rule one fires without pause: alloyOf falseShilling drossSilver joined to meltedAt drossSilver weirCrucible yields blankFrom falseShilling weirCrucible, and rule two follows at once — soleCasterAt weirCrucible edony closes the blank chain on castBlankFor falseShilling edony. Edony's hand cast the blank; that much is grounded. The die chain named wornBurin by rule three and stands ready, but soleHolderOf wornBurin ?x is still off the board — rule four cannot deliver cutDieFor, and rule five must hold its tongue until that one hinge is brought to the glass.
  — hypothesis: If soleHolderOf wornBurin names Edony, rule four delivers cutDieFor falseShilling edony and rule five can at last join both conjuncts in one hand — but that fact alone remains between the die chain and a binding verdict, and no bench-tool can substitute for it.
  ⚑ **repair** — p_alloy restored by the tutor
  ⚑ **decay** — m_graver slips from the learner's board

### Turn 19
*[The cupel is covered, and the coins remain uncovered under the lamp. The tools keep their shadows, close enough to tempt the eye and too far to answer it.]*
**Tutor:** Before the bench's shadow tempts you, read back from your board only the die-sinker's step. What did it license rule three to write, and where does rule four still stand empty? A tool named by a mark is not yet a hand named by the rule.
  — move: erotema → p_graver (confront)
**Learner:** Rule three read notchedSerif against wornBurin and wrote dieCutWith falseShilling wornBurin — the coin named the tool by its own mark. Rule four stands at the next door and cannot move: it needs soleHolderOf wornBurin ?x, and that entry is nowhere on my board, so cutDieFor goes unwritten. The blank chain is fully closed on Edony, but the die chain halts at the tool's name — no hand yet behind it.
  — hypothesis: If soleHolderOf wornBurin names Edony, rule four delivers cutDieFor falseShilling edony and rule five joins both conjuncts in one hand — but that single fact is still ungrounded, and no evidence on the bench supplies it.

### Turn 20
*[The lamp burns lower, shrinking the table to coins, glass, and the mute line of tools beyond reach. No witness enters; the room holds its breath around the missing hinge.]*
**Tutor:** Good; the die has reached the tool and stopped at the threshold of a hand. What sort of line, book, or sworn keeping would let rule four pass from a named burin to a cutter, and what must you refuse until that line is under the lamp? A blank and a tool are two halves laid apart, not yet one striking hand.
  — move: erotema → — (test)
**Learner:** A tool-register, a mint ledger of assignments, or a master's sworn oath before the warden — these are the lines that could place the worn burin in one hand alone and open rule four. What I must refuse is any name drawn from Edony's presence at the forge or Verrell's ill fame: suspicion is not soleHolderOf, and neither is proximity. The blank chain is fully closed on Edony; the die chain stands named to the burin and silent at its threshold.
  — hypothesis: If a tool-register or sworn guild-keeping names Edony as sole holder of the worn burin, rule four delivers cutDieFor falseShilling edony, and rule five at last joins both conjuncts in one hand — but that document is not yet under the lamp.

### Turn 21
*[The ledger-space on the table remains empty, more visible than any paper. A clerk's sand runs softly in its glass while the coins lie still beneath the failing lamp.]*
**Tutor:** The blank is closed behind you; the die is named to a tool and stops at the hand. The keeping-line is the only lamp still unlit, and until it is lit rule four writes no cutter. Hold the two halves apart: cast blank on one side, cut die still waiting on the other.
  — move: anaphora → — (consolidate)
  — *the second voice [figure rut]: "Leave off erotema for this turn; speak without another question-device before the learner hears you." (draft erotema → anaphora)*
**Learner:** The ledger-space stays empty and the lamp does not fill it. Rules one and two are fully closed: alloy to crucible, crucible to Edony's hand — blankFrom and castBlankFor both written. Rule three wrote dieCutWith to the worn burin already. Rule four stands at its threshold with no soleHolderOf wornBurin to open it, and without that keeping-line cutDieFor goes unwritten and rule five cannot speak.
  — hypothesis: If a tool-register or sworn guild-keeping names Edony as sole holder of the worn burin, rule four delivers cutDieFor falseShilling edony and rule five at last joins both conjuncts in one hand — but that document is not yet under the lamp, and no name may be written until it is.

## Act 5 (turns 22–22) — declared by the director
*[The estate inventory is laid beneath the lamp, its seal cracked before the room. "The old founder's tools were never sold off. The inventory of his estate, sworn and unredeemed, leaves his graving-irons to his widow alone — among them the worn burin with the sprung heel, kept in Edony's keeping these ten years." The room narrows to the silence after a name has reached its mark.]*

### Turn 22
*[The estate inventory is laid beneath the lamp, its seal cracked before the room. "The old founder's tools were never sold off. The inventory of his estate, sworn and unredeemed, leaves his graving-irons to his widow alone — among them the worn burin with the sprung heel, kept in Edony's keeping these ten years." The room narrows to the silence after a name has reached its mark.]*
  — *releases `p_holder`*
  — *declares the movement: **Act 5** ([The estate inventory is laid beneath the lamp, its seal cracked before the room. "The old founder's tools were never sold off. The inventory of his estate, sworn and unredeemed, leaves his graving-irons to his widow alone — among them the worn burin with the sprung heel, kept in Edony's keeping these ten years." The room narrows to the silence after a name has reached its mark.])*
  — *calls the act closed*
**Tutor:** The inventory has lit the keeping-line: worn burin, one sworn keeping, the widow's hand. The mark is shown, the tool is shown, the holder is shown — what does rule four now write? Then set that writing beside the closed blank, and tell me what the last rule still has room to refuse.
  — move: anaphora → p_holder (stage_recognition)
**Learner:** The inventory closes the last gap: sworn keeping names Edony sole holder of the worn burin, so rule four writes cutDieFor falseShilling edony — and castBlankFor already names her from the blank chain. Both conjuncts land in one hand. Rule five speaks, and I enter the name.
  — adopts `soleHolderOf wornBurin edony` · derives `cutDieFor falseShilling edony` · **asserts `struckBy falseShilling edony`**
  ⚑ **act_end** — act 4 closed (director) after 7 turns
  ⚑ **plot** — act 5 plot committed
  ⚑ **plot_audit** — act 4 plot audited: kept 6, justified 0, drift 0; arc on_arc
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
  - Act 3 (turns 11–14): 0.25 D/turn (ΔD 1)
  - Act 4 (turns 15–21): 0.286 D/turn (ΔD 2)
  - Act 5 (turns 22–22): 1 D/turn (ΔD 1)
- **plateau** longest flat stretch 4 turns (aporia window 6)
- **releases** 5/9 on cue · 4 deviated
- **decay** 6 slips (seed 1 · rate 0.75 · grace 1) · repaired 4 (tutor 4, re-adoption 0) · mean repair latency 3.25 turns · unrepaired at end 2 · degraded-turn integral 36 · D reversals 1
- **theory fidelity** F 0.846 at end · min 0.667
  - m_caster t3 (never repaired) · p_alloy t4→t6 (tutor) · m_graver t7→t9 (tutor) · p_crucible t9→t12 (tutor) · p_alloy t12→t18 (tutor) · m_graver t18 (never repaired)
- **events** plot×5 · throughline×1 · decay×6 · act_end×4 · plot_audit×5 · repair×4 · overreach×1 · forced×1 · grounded_anagnorisis×1
- **staging** 5 movements declared by the director
- **acts** 5 played · closed by the director 4 · at max length 0 · at run end 1 — Act 1 t1–3 (director) · Act 2 t4–10 (director) · Act 3 t11–14 (director) · Act 4 t15–21 (director) · Act 5 t22–22 (run end)
- **plot** 5 committed · withhold+friction on 5/5 · 5.8 clauses avg · audits 5 (incl. final act): kept 25 / justified 1 / drift 3 · hold-named exhibits staged in act 0/0
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 5: on 5 / off 0 · run-end reckoning 7 clauses: kept 7 / justified 0 / drift 0
- **release authority** 4 played: 0 on schedule · 0 held · 4 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_alloy -1 (t3): "Played one turn early because the learner has already separated the town ledger from the coin's required metal proof."
  - p_crucible -1 (t7): "Played one turn early because the learner has cleanly named meltedAt as the live gap and the tempo window is solvent."
  - p_flaw -1 (t13): "Played one turn early because the learner has correctly isolated dieFlawOf as the next coin-linked gap and the watchman's noise has been contained."
  - p_graver -1 (t17): "Played one turn early because the learner has held flawCutBy as the exact missing hinge and the die chain is ready for the tool-link."
- **confrontation** 4 demanded (1 against a slipped exhibit) · re-entries 0: covered 0, uncovered 0 · watcher fires 2 (became the confrontation 2) · fires without recorded due 0
  - **repair clause** restores 4 (4 repaired a real slip) · watcher fires on restore claims 0: p_alloy t6 · m_graver t9 · p_crucible t12 · p_alloy t18
- **figures** erotema 10/22 (46%) · 3 distinct · switch rate 0.62
- **superego** intervened 4/22 watched turns · figure changed within-turn on 3/4 interventions · switch on intervention 1.00 vs elsewhere 0.53
- **inference** 4 voiced · stall integral 0 · overreach 1 · mischanneled 0 — `blankFrom falseShilling weirCrucible` available t7 → voiced t7 (latency 0) · `castBlankFor falseShilling edony` available t12 → voiced t12 (latency 0) · `dieCutWith falseShilling wornBurin` available t17 → voiced t17 (latency 0) · `cutDieFor falseShilling edony` available t22 → voiced t22 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 22 | 3.23 | 5 | 45 |
| tutor | 22 | 2.73 | 3 | 58.4 |
| learner | 22 | 3.95 | 5 | 79.8 |
