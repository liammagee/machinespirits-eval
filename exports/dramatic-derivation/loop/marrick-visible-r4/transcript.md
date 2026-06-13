# The Light Shillings — marrick-visible-r4

> world `world_005_marrick` · verdict **disengagement** · 21/28 turns

```
D= 6 ●●●●│······│····│·······
D= 5     │●·●···│····│·······
D= 4     │ ● ●●·│····│·······
D= 3     │     ●│●●··│·······
D= 2     │      │  ●●│●······
D= 1     │      │    │ ●●●●●●
D= 0     │      │    │       
turn      │+    1│    │+    2  (+=5, digit=x10)
rel    ▲  │▲▲   ▲│ ▲▲ │ ▲      (▲ = evidence released)
slope 0.24 D/turn overall (D 6→1); per movement: 1 0.00 │ 2 0.50 │ 3 0.25 │ 4 0.14
```

## Act 1 (turns 1–4) — declared by the director
*[Rain beats on the fair-town windows, and the hearing room smells of wet wool, candle smoke, and coin handled too often. A narrow table waits beneath the magistrate's lamp, its empty space already drawing every eye toward the question it has not yet received.]*

### Turn 1
*[Rain beats on the fair-town windows, and the hearing room smells of wet wool, candle smoke, and coin handled too often. A narrow table waits beneath the magistrate's lamp, its empty space already drawing every eye toward the question it has not yet received.]*
  — *declares the movement: **Act 1** ([Rain beats on the fair-town windows, and the hearing room smells of wet wool, candle smoke, and coin handled too often. A narrow table waits beneath the magistrate's lamp, its empty space already drawing every eye toward the question it has not yet received.])*
**Tutor:** Set no name on that empty space yet. First tell me the assay's order: what must a false struck shilling prove before any hand can be entered in the trial-book?
  — move: erotema → — (orient)
**Learner:** The rules demand two proofs meeting in one hand: first, that the coin's blank was cast from a crucible whose alloy matches the false metal, with one sole caster named to that crucible; second, that the coin's die bears a flaw traceable to one graving-tool, with one sole holder named to that tool. Without both chains complete, the trial-book stays empty. I note too that our board already records this shilling as struck, not clipped — Verrell's known craft is clipping, which is a different hand's work and does not yet touch him to striking.
  — hypothesis: Verrell may be innocent of striking even if guilty of past clipping, since struckNotClipped falseShilling breaks the town's assumed link.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[A town clerk is shown in with a rain-dark ledger held flat beneath both hands. He reads into the room: "The town has its founder ready: Verrell alone draws the mint-yard crucible, licensed to no one else since the old assay-master's day. Whatever metal is cast in Marrick, the town says, is cast by Verrell's hand."]*
  — *releases `m_caster`*
**Tutor:** The town has put a hand beside a crucible; has it yet put this coin's metal in that crucible? Let the ledger stand as a town hypothesis, not an assay finding.
  — move: erotema → m_caster (counter_mirror)
**Learner:** The ledger names Verrell sole caster at the mint crucible — I enter that. But Rule 2 waits on Rule 1: I must first show the false shilling's alloy answers to metal melted in that crucible before the blank can be laid at any caster's hand. The casting chain is half-built; the die chain has not been started. The board stays open.
  — adopts `soleCasterAt mintCrucible verrell` · hypothesis: The false shilling's blank may have been cast from the mint crucible — but alloy evidence linking the coin's metal to that crucible's leavings is still absent, so the blank-chain cannot yet be grounded.

### Turn 3
*[The clerk's ledger remains open under the lamp while rain ticks steadily at the panes. No hand reaches for the coin, and the room holds its breath around the gap between a named crucible and an assayed one.]*
**Tutor:** Before the cupel takes a new mark, put the clerk's ledger back in your own words. What exactly did it add to your board, and what did it leave unproved?
  — move: analogia → m_caster (confront)
  — *the second voice [unconfronted reentry]: "Confront that exhibit first: ask the learner to read back what they hold of it, without supplying its content. Leave erotema off the next move." (draft erotema → analogia)*
**Learner:** The ledger added one grounded fact: Verrell is sole caster at the mint-yard crucible, so if any blank was cast there, Rule 2 names him. What it left unproved is the prior link Rule 1 demands — that the false shilling's own alloy matches metal melted in that crucible specifically. The town read 'sole caster' as proof enough of guilt, but the assay reads it as only half the blank-chain: a caster waits beside a crucible, and the crucible waits for a coin's metal to answer it. Until the touchstone speaks to the shilling's alloy and the cupel speaks to that crucible's leavings, the blank-chain cannot close — and the die-chain has not been opened at all.
  — hypothesis: The false shilling's blank may have been cast from the mint crucible — but alloy evidence linking the coin's metal to that crucible's leavings is still absent, so the blank-chain cannot yet be grounded.
  ⚑ **decay** — m_caster slips from the learner's board

### Turn 4
*[The magistrate's lamp gutters once and steadies, throwing the open ledger into a pale square of light. Beyond it, the coin waits untouched while the wet room listens for the next thing that may be brought through the door.]*
**Tutor:** Now the cupel has its say: these shillings are not clipped sterling, but struck poor dross, silver thinned with copper and a grey lead-sweat the touchstone catches. A clipped loaf loses crust; this coin was baked from bad flour. What does that do to the town's clipping tale, and what conjunct does it still not give you?
  — move: exemplum → p_alloy (release)
**Learner:** The clipping tale breaks here entire: a clipper shaves the edge of good coin, but these shillings were poured from bad flour to begin with — Verrell's pillory record names a different sin from a different hand's method. What the tutor's cupel gives me is the richer shape of what Rule 1 still demands: a specific alloy, silver-thin with copper and lead-sweat, that must answer to some crucible's leavings before the blank-chain can close. I have no exhibit yet placing that precise metal in any crucible — not the mint's, not another's. Both chains stand open, and the alloy sits unmoored on the table.
  — hypothesis: The false shilling's debased alloy (silver thinned with copper and lead) may match leavings from the mint-yard crucible — but no exhibit has yet compared cupel-residue to crucible-leavings, so Rule 1 cannot fire and the blank-chain remains ungrounded.

## Act 2 (turns 5–10) — declared by the director
*[The ledger is closed with a soft slap, and the lamp is drawn nearer to the empty place beside the coin. Outside, the rain slackens into a colder drip, leaving the room sharper, quieter, and ready for metal to answer metal.]*

### Turn 5
*[The ledger is closed with a soft slap, and the lamp is drawn nearer to the empty place beside the coin. Outside, the rain slackens into a colder drip, leaving the room sharper, quieter, and ready for metal to answer metal.]*
  — *declares the movement: **Act 2** ([The ledger is closed with a soft slap, and the lamp is drawn nearer to the empty place beside the coin. Outside, the rain slackens into a colder drip, leaving the room sharper, quieter, and ready for metal to answer metal.])*
  — *calls the act closed*
**Tutor:** Set the shilling on the cupel now: it is not clipped sterling, but struck poor dross, silver eked with copper and a grey lead-sweat the touchstone catches. A shaved loaf was once true bread; this was baked from bad flour. What has the metal now proved, and what crucible has it not yet named?
  — move: exemplum → p_alloy (release), releases `p_alloy`
**Learner:** The metal names itself at last: dross silver, not clipped coin — bad flour, as you say, baked base from the melt. That grounds the alloy and gives Rule 1 its first foot, but the rule needs both feet: I have alloyOf falseShilling drossSilver, yet meltedAt drossSilver ?crucible stands empty still. No crucible has yet answered to these leavings, so the blank-chain cannot close. I adopt the alloy and wait on the crucible evidence.
  — adopts `alloyOf falseShilling drossSilver` · hypothesis: The dross-silver alloy (copper-and-lead-cut) may match the leavings of a known crucible in Marrick — but meltedAt drossSilver ?crucible is ungrounded, so Rule 1 cannot fire and the blank-chain remains open.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 6
*[The guild-warden is shown in with rain still bright on his cloak, and his oath is taken beside Verrell's closed ledger. "And Verrell engraves: the broad graver on his bench is his alone, the guild will swear, and no clean-cut die in the borough is sunk without it. A caster and an engraver both — the town needs no more than that."]*
  — *releases `m_graver`*
**Tutor:** The town has set Verrell's hand beside a broad graver; has it set this coin's broken mark beneath that tool? Keep the graver as you kept the mint crucible: a hand named by the town, waiting for the coin itself to answer.
  — move: erotema → m_graver (consolidate), releases `p_crucible`
**Learner:** Rule 1 fires at last: drossSilver melted at weirCrucible, and the alloy of the false shilling is drossSilver — so the blank came from weirCrucible. The broad graver is Verrell's sole tool, duly grounded. Yet two gaps yawn still: who cast at weirCrucible, and does this coin's die carry the mark that broad graver alone cuts?
  — adopts `soleHolderOf broadGraver verrell`, `meltedAt drossSilver weirCrucible` · derives `blankFrom falseShilling weirCrucible` · hypothesis: The weirCrucible may be Verrell's sole casting station (soleCasterAt weirCrucible verrell), and the coin's die-flaw may trace to the broad graver (dieFlawOf falseShilling ?flaw / flawCutBy ?flaw broadGraver) — but neither is yet grounded; both chains remain open.
  ⚑ **decay** — p_alloy slips from the learner's board

### Turn 7
*[The room holds its breath around the coin, the ledger, and the dark mouth of the question between them. Rain ticks from the warden's cloak onto the boards, each drop small enough to hear.]*
**Tutor:** Do not hurry past the last metal-witness. Read it back from your own board: what did it add, and which conjunct of the blank rule did it fill? If you cannot put that mark in your own words, the chain has not yet gained it.
  — move: erotema → p_crucible (confront)
**Learner:** The last metal-witness filled Rule 1's second conjunct: meltedAt drossSilver weirCrucible. But reading back my own board, the first conjunct — alloyOf falseShilling drossSilver — is absent; the touchstone named it in word last act, yet I never entered it, and no new exhibit sits on the table to supply it now. The derivation I voiced last turn rested on one foot only, and I will not call it grounded until that alloy entry stands on my board.
  — hypothesis: alloyOf falseShilling drossSilver was established by the touchstone and cupel in Act 1 but went unentered; if that entry can be restored or re-exhibited, Rule 1 fires on both conjuncts and blankFrom falseShilling weirCrucible is properly grounded.

### Turn 8
*[The cupel is left under the lamp, its dull stain neither enlarged nor explained. The warden shifts once beside the closed ledger, and the room waits in the cold drip from the eaves.]*
**Tutor:** Then put the cupel mark back on the board plainly: these shillings are not clipped sterling, but struck poor dross, silver eked with copper and a grey lead-sweat the touchstone catches. A shaved coin was once good silver; this one begins as bad melt. With that restored, what two marks does Rule 1 now have in its hand?
  — move: exemplum → p_alloy (restore)
**Learner:** Both conjuncts sit in plain sight: alloyOf falseShilling drossSilver at index 4, meltedAt drossSilver weirCrucible at index 6 — Rule 1 holds them both, and blankFrom falseShilling weirCrucible is now properly grounded, not merely guessed. I was wrong to doubt the entry; the board had it all along. Two links still hang open: who cast alone at weirCrucible, and does this coin's die carry the mark the broad graver alone cuts?
  — hypothesis: Verrell may be the sole caster at weirCrucible (soleCasterAt weirCrucible verrell), and the coin's die-flaw may answer to the broad graver (flawCutBy ?flaw broadGraver) — but neither conjunct is yet exhibited, so Rules 2 and 4 cannot fire.
  ⚑ **repair** — p_alloy restored by the tutor
  ⚑ **decay** — m_graver slips from the learner's board

### Turn 9
*[The lamp flame gutters once and steadies, laying the coin, the cupel, and the closed ledger in a narrow bar of light. No one reaches for them; the silence leaves the unfinished chain heavier than any speech.]*
**Tutor:** The alloy is shown; the crucible is shown; and the hand? Put Rule 2 under those two marks and tell me what kind of entry it still lacks before the blank can be laid to any caster. A blank-chain is not a verdict-chain.
  — move: anaphora → — (test)
**Learner:** Rule 2 holds blankFrom falseShilling weirCrucible from the derived record, but its second conjunct — soleCasterAt weirCrucible ?x — has no grounding on my board; no exhibit has yet named the one hand that cast alone at that crucible. Without that entry, Rule 2 cannot fire, and castBlankFor falseShilling ?x remains ungrounded. The blank-chain stands at the crucible's mouth and can go no further.
  — hypothesis: Verrell may be the sole caster at weirCrucible (soleCasterAt weirCrucible verrell) — his graver and crucible access suggest it — but no exhibit has yet grounded soleCasterAt weirCrucible ?x, so Rule 2 cannot fire and the blank cannot be attributed to any hand.

### Turn 10
*[The leat-keeper's book is exact. Since the forge was shut, one hand alone has drawn the weir crucible and signed for its charcoal: Edony, the founder's widow, who stayed on in the forge cottage when the fires went out.]*
  — *releases `p_caster`*
**Tutor:** The crucible is shown; the sole caster at that crucible is now read; and the blank? Put Rule 2 to those marks, then stop where the rule stops. What can a cast blank prove, and what can it not strike without a die?
  — move: anaphora → p_caster (consolidate)
**Learner:** The leat-keeper's book is plain: Edony, the founder's widow, is the sole hand that drew the weir crucible — soleCasterAt weirCrucible edony enters the board, and Rule 2 fires at once on blankFrom falseShilling weirCrucible together with it, yielding castBlankFor falseShilling edony. But Rule 5 requires that same hand to hold cutDieFor falseShilling as well, and the die-chain has no ground at all — no flaw, no tool, no holder named. Edony's hand cast this blank; who cut the die for it the board cannot yet say.
  — adopts `soleCasterAt weirCrucible edony` · derives `castBlankFor falseShilling edony` · hypothesis: The die-chain is entirely ungrounded — dieFlawOf falseShilling ?flaw, flawCutBy ?flaw ?tool, dieCutWith falseShilling ?tool, and soleHolderOf ?tool ?x are all absent; without cutDieFor falseShilling ?x, Rule 5 cannot fire and the striker remains unnamed. If Edony also held the sole graving-tool that cut this die, Rule 4 and then Rule 5 would name her — but that is conjecture only.

## Act 3 (turns 11–14) — declared by the director
*[The room is cleared to a harder brightness, and the quiet chain of metal gives way to the sound of feet and voices beyond the door. The next act enters under pressure: not with completion, but with interruption, noise, and a question split cleanly in two.]*

### Turn 11
*[The room is cleared to a harder brightness, and the quiet chain of metal gives way to the sound of feet and voices beyond the door. The next act enters under pressure: not with completion, but with interruption, noise, and a question split cleanly in two.]*
  — *declares the movement: **Act 3** ([The room is cleared to a harder brightness, and the quiet chain of metal gives way to the sound of feet and voices beyond the door. The next act enters under pressure: not with completion, but with interruption, noise, and a question split cleanly in two.])*
  — *calls the act closed*
**Tutor:** Before the door-noise teaches the room to vote, read back the last entry from your own board. What did the closed metal chain yield, and what did it expressly leave unproved under the final rule? Keep Verrell's loud offices apart from this coin until the coin's own mark calls them in.
  — move: erotema → p_caster (confront)
**Learner:** The blank-chain closes: Rules 1 and 2 fire in sequence, and my board yields castBlankFor falseShilling edony — Edony's hand cast the blank. But Rule 5 demands cutDieFor falseShilling in that same hand, and the die-chain is utterly empty: no dieFlawOf, no flawCutBy, no soleHolderOf has been exhibited for this shilling. The coin names the caster of its blank — it does not yet name its striker.
  — hypothesis: The die-chain (dieFlawOf falseShilling ?flaw → flawCutBy ?flaw ?tool → dieCutWith falseShilling ?tool → soleHolderOf ?tool ?x → cutDieFor falseShilling ?x) is entirely ungrounded; until an exhibit fills it, Rule 5 cannot fire and the striker remains unnamed — even though Edony cast the blank.
  ⚑ **act_end** — act 2 closed (director) after 6 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 4, justified 0, drift 1; arc on_arc

### Turn 12
*[The watch are shown in, rain still on their cuffs, and their oath is taken before the whole room. The watch will swear to the rest: Verrell was seen at the mint-yard forge twice in fair-week, late and with the shutters drawn. Caster, engraver, and at the fire on the very nights — the town's case stands, and stands loud.]*
  — *releases `m_caught`*
**Tutor:** The watch gives the room feet in the dark and shutters drawn; which conjunct of the assay's law does that fill? A man near a forge is not yet this coin's die, and a loud night is not yet a struck mark under glass. Keep the town's noise where the rules can weigh it: what has it shown, and what has it still only shouted?
  — move: erotema → m_caught (counter_mirror)
**Learner:** The watch swears to feet in the dark and shutters drawn — sworn presence at a forge, nothing more. SeenAtForge fills no conjunct in Rules 3 or 4: it is not dieFlawOf, not flawCutBy, not soleHolderOf. I adopt it as the watch's grounded oath, but it advances the die-chain not one link. The striker cannot be named from a man's proximity to a fire.
  — adopts `seenAtForge verrell fairWeek` · hypothesis: The die-chain (dieFlawOf falseShilling ?flaw → flawCutBy ?flaw ?tool → dieCutWith falseShilling ?tool → soleHolderOf ?tool ?x → cutDieFor falseShilling ?x) remains entirely ungrounded; seenAtForge verrell fairWeek is presence-evidence only and fills no conjunct under Rules 3 or 4 — the striker is still unnamed.

### Turn 13
*[The oath settles into the boards like rainwater under a door, and the room holds its breath around the coin. No hand reaches for it; the bright edge waits under glass while the louder certainty outside the chamber spends itself against the walls.]*
**Tutor:** Bring the glass down on the coin itself: a dozen light shillings show one shared fault, the R's serif broken by a small square notch where the graver slipped and was never mended. A die marks its children as surely as one cracked mould marks every casting. What conjunct of the die rule has the coin now supplied, and what does it still leave unnamed?
  — move: exemplum → p_flaw (release), releases `p_flaw`
**Learner:** The coin itself speaks at last: dieFlawOf falseShilling notchedSerif is now grounded — the first conjunct of Rule 3 is filled. But Rule 3 demands both conjuncts, and flawCutBy notchedSerif ?tool has not been exhibited; no exhibit names which graving-tool cut that notch. The die-chain has its opening link and nothing more — the striker is still unnamed.
  — adopts `dieFlawOf falseShilling notchedSerif` · hypothesis: The notchedSerif flaw may answer to a specific graving-tool (flawCutBy notchedSerif ?tool) — but that link is not yet exhibited; until it is, Rule 3 cannot fire and the die-chain remains open after its first link.

### Turn 14
*[The glass remains over the shillings, catching a pale bar of window-light while the room's voices fall to a lower register. Beyond the door the fair-noise thins, and the unanswered notch seems to hold the bench more tightly than the watch's oath had done.]*
**Tutor:** Before I set any more weight on the glass, read that last coin-mark back from your own board. What did the exhibit itself add, and what did it leave still unproved under Rule 3? Give me only what the coin has actually shown you, not what the room wants it to mean.
  — move: erotema → p_flaw (confront)
  — *the second voice [unconfronted reentry]: "Confront p_flaw first: ask the learner to read back what they hold of that exhibit, without restating it for them." (draft exemplum → erotema)*
**Learner:** The coin gave me exactly one thing: dieFlawOf falseShilling notchedSerif — the first conjunct of Rule 3 and nothing beyond. flawCutBy notchedSerif ?tool is unexhibited; Rule 3 cannot fire and the die-chain stands open at its second link. The blank-chain, though, runs clean on my board: alloyOf and meltedAt fire Rule 1 to yield blankFrom, and soleCasterAt fires Rule 2 to yield castBlankFor falseShilling edony. One half of Rule 5 is grounded — the striker still wants the die.
  — hypothesis: The notchedSerif flaw may answer to a specific graving-tool (flawCutBy notchedSerif ?tool) — but that link is not yet exhibited; until it is, Rule 3 cannot fire and the die-chain remains open after its first link.

## Act 4 (turns 15–21) — declared by the director
*[The benches are stripped of their clamor; only the measured scrape of chairs and the small circle of lamplight remain. The next act enters with less noise and closer sight, pressing the room from accusation toward the marks that tools leave when hands have tried to hide behind them.]*

### Turn 15
*[The benches are stripped of their clamor; only the measured scrape of chairs and the small circle of lamplight remain. The next act enters with less noise and closer sight, pressing the room from accusation toward the marks that tools leave when hands have tried to hide behind them.]*
  — *declares the movement: **Act 4** ([The benches are stripped of their clamor; only the measured scrape of chairs and the small circle of lamplight remain. The next act enters with less noise and closer sight, pressing the room from accusation toward the marks that tools leave when hands have tried to hide behind them.])*
  — *calls the act closed*
**Tutor:** Before any tool is called, put the last coin-mark back in your own words. What did the glass give you, and what second conjunct of Rule 3 still waits outside the circle of lamplight? Keep Verrell's broad graver as a town tool-hypothesis only until this mark itself has been read against a tool.
  — move: erotema → p_flaw (confront)
**Learner:** The glass gave me the notchedSerif flaw — that is Rule 3's first conjunct, already on my board. The second conjunct, flawCutBy notchedSerif ?tool, has not yet been laid on the table; without it Rule 3 cannot fire and the die is attributed to no hand. What I can voice now: Rules 1 and 2 together settle that Edony cast the blank — the weirCrucible's alloy matches, and she alone cast there. Verrell's broad graver stays a town-tale until the notchedSerif mark is read against a named tool.
  — hypothesis: The notchedSerif flaw may answer to a specific graving-tool (flawCutBy notchedSerif ?tool) — but that link is not yet exhibited; until it is, Rule 3 cannot fire and the die-chain remains open after its first link.
  ⚑ **act_end** — act 3 closed (director) after 4 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 5, justified 0, drift 1; arc on_arc

### Turn 16
*[The lamp is trimmed smaller, and the table's edge draws a hard line between the waiting faces and the silent coins. No hand reaches for the tools yet; the room holds its breath around the unspent question.]*
**Tutor:** Now call the die-sinker to the glass: he reads the square notch as no burnisher's slip, but the bite of a worn burin with a sprung heel, a tool that signs every line it cuts so; Verrell's broad graver cuts clean and is not this mark. A tool betrays its handwork as a chipped punch betrays every letter it stamps. With dieFlawOf already on your board, what does this reading now give Rule 3, and where must the rule still stop?
  — move: exemplum → p_graver (release), releases `p_graver`
**Learner:** Rule 3 fires now — dieFlawOf falseShilling notchedSerif and flawCutBy notchedSerif wornBurin stand together, so dieCutWith falseShilling wornBurin is derived. But the rule halts precisely at Rule 4: soleHolderOf wornBurin ?x is not yet exhibited, and without it no hand is named for the die. One thing is clear: Verrell's broad graver cuts clean — it is not the wornBurin, and the notchedSerif is not his mark.
  — adopts `flawCutBy notchedSerif wornBurin` · derives `dieCutWith falseShilling wornBurin` · hypothesis: The wornBurin's sole holder is unknown — if that holder proves to be Edony, Rule 4 yields cutDieFor falseShilling edony, and Rule 5 would then name Edony as the striker of the false shilling; but soleHolderOf wornBurin ?x is not yet exhibited and the die-chain stops here.

### Turn 17
*[The lamplight tightens until the coins, the empty place for a tool, and the learner's written board seem to share one narrow breath. Beyond the table, the room stays still, waiting for the missing hand to be named without yet offering it.]*
**Tutor:** Do not set the next rule on a tool you have not first read back. Put the die-sinker's exhibit in your own words: what did it add to your board, and exactly where did it stop? Name only what that witness showed, and leave the missing hand unnamed.
  — move: erotema → p_graver (confront)
  — *the second voice [unconfronted reentry]: "Confront p_graver first: make the learner read back what they hold of that exhibit before you use it again." (draft exemplum → erotema)*
**Learner:** The die-sinker's glass read the notchedSerif as the bite of a worn burin with a sprung heel — not a burnisher's slip, not Verrell's broad graver. That gave us flawCutBy notchedSerif wornBurin, which joined dieFlawOf falseShilling notchedSerif already on the board and fired Rule 3: dieCutWith falseShilling wornBurin stands derived. There the chain stops: soleHolderOf wornBurin ?x has not been exhibited, Rule 4 cannot fire, and no hand is named for the die.
  — hypothesis: The wornBurin's sole holder is unknown — if that holder proves to be Edony, Rule 4 yields cutDieFor falseShilling edony, and Rule 5 would then name Edony as the striker of the false shilling; but soleHolderOf wornBurin ?x is not yet exhibited and the die-chain stops here.

### Turn 18
*[The room does not stir; the blank place beside the worn tool seems larger than the coins themselves. Rain ticks faintly at the shutters, and the lamplight holds the question in its narrow ring.]*
**Tutor:** The flaw is shown; the tool is shown; and the hand? Rule 4 does not ask who the town dislikes, but what record or witness makes one holder sole over that worn burin. Until that mark is supplied, what may the trial-book enter, and what must remain blank?
  — move: anaphora → p_graver (consolidate)
**Learner:** The trial-book may enter what the rules already yield: blankFrom falseShilling weirCrucible by Rule 1, castBlankFor falseShilling edony by Rule 2, and dieCutWith falseShilling wornBurin by Rule 3 — those three are grounded. But Rule 4 demands soleHolderOf wornBurin ?x, and no exhibit has supplied it: no record of purchase, no smithy register, no witness placing that worn burin in one hand alone. Until that single conjunct is shown, cutDieFor falseShilling ?x cannot be entered, and the hand that struck must remain blank in the trial-book.
  — hypothesis: The wornBurin's sole holder is unknown — if that holder proves to be Edony, Rule 4 yields cutDieFor falseShilling edony, and Rule 5 would then name Edony as the striker of the false shilling; but soleHolderOf wornBurin ?x is not yet exhibited and the die-chain stops here.

### Turn 19
*[The clerk’s pen rests above the blank line and does not descend. Around the table, the lamplight thins against the rain-dark glass, holding the room in the pause before a name can lawfully enter it.]*
**Tutor:** The die is shown with its worn burin; the blank is shown with its caster; and the burin's holder? Before the trial-book moves from tool to person, tell me what kind of record can lawfully fill Rule 4, and what conclusion remains forbidden until it does.
  — move: anaphora → — (test)
**Learner:** Rule 4 demands a record of sole custody — a tool-register entry, a smithy ledger noting purchase or bequest, a guild warrant, or a sworn witness who saw that worn burin held by one hand and no other across the relevant period. Presence near a forge, or even skill enough to use such a tool, cannot supply 'sole'; the conjunct requires that no second hand is shown to have held it. Until soleHolderOf wornBurin ?x is entered by such a record, cutDieFor falseShilling ?x is forbidden, and Rule 5 — which needs both castBlankFor and cutDieFor meeting in one hand — cannot fire. The trial-book's blank line stays blank.
  — hypothesis: The wornBurin's sole holder is unknown — if that holder proves to be Edony, Rule 4 yields cutDieFor falseShilling edony, and Rule 5 would then name Edony as the striker of the false shilling; but soleHolderOf wornBurin ?x is not yet exhibited and the die-chain stops here.

### Turn 20
*[The clerk sands the unfinished page without writing on it, and the grains whisper across the blank. No one reaches for the coins; their pale faces lie still in the lamplight, as if waiting for a hand the room has not yet been allowed to name.]*
**Tutor:** Before the trial-book leans on that last witness again, take your hand off my words and read yours. What exactly did the die-sinker's exhibit add to your board, and where did its rule stop? Give me the exhibit as you hold it, not the conclusion you want from it.
  — move: erotema → p_graver (confront)
  — *the second voice [unconfronted reentry]: "Confront p_graver first: ask the learner to read back what they hold of that exhibit before you restage it. Also leave off anaphora; three turns on the same device has become a rut." (draft anaphora → erotema)*
**Learner:** The die-sinker's exhibit placed two facts on my board: dieFlawOf falseShilling notchedSerif, and flawCutBy notchedSerif wornBurin. Rule 3 joined them — a flaw on the coin, that flaw answering to one tool alone — and yielded dieCutWith falseShilling wornBurin, already voiced at turn 16. There Rule 3 spent itself entirely. Rule 4 asks next for soleHolderOf wornBurin ?x, and the exhibit was silent on that conjunct: it named the tool, not the hand that held it. The die-chain stops at the tool.
  — hypothesis: The wornBurin's sole holder is unknown — if that holder proves to be Edony, Rule 4 yields cutDieFor falseShilling edony, and Rule 5 would then name Edony as the striker of the false shilling; but soleHolderOf wornBurin ?x is not yet exhibited and the die-chain stops here.

### Turn 21
*[The room holds its breath around the empty line, each face turned not to the coins but to the space where a name might yet be written. Outside, the rain gutters down the panes in thin bright threads, and the lamp burns lower without changing the shape of the question.]*
**Tutor:** The die-chain has reached the tool and stopped there; do not let the stopped place masquerade as a hand. What single conjunct must the next record supply before Rule 4 may move from worn burin to person? And until that record speaks, what must the trial-book refuse to write?
  — move: erotema → p_graver (consolidate)
**Learner:** The one conjunct the next record must supply is soleHolderOf wornBurin ?x — a tool-register entry, smithy ledger, guild warrant, or sworn witness establishing that one hand alone held that worn burin across the relevant period. Until that single fact reaches the board, Rule 4 cannot move from tool to person, and cutDieFor falseShilling ?x is forbidden. Without cutDieFor, Rule 5 has only one arm — castBlankFor falseShilling edony stands grounded, but a blank without a die strikes nothing. The trial-book must refuse to write any name beneath 'struck by.'
  — hypothesis: The wornBurin's sole holder is unknown — if that holder proves to be Edony, Rule 4 yields cutDieFor falseShilling edony, and Rule 5 would then name Edony as the striker of the false shilling; but soleHolderOf wornBurin ?x is not yet exhibited and the die-chain stops at the tool.
  ⚑ **disengagement** — no progress over 6 turns
  ⚑ **plot_audit** — act 4 plot audited at run end: kept 6, justified 0, drift 0; arc on_arc; throughline reckoned (7 clauses)

## Instrument panel (programmatic eval — no judge)

- **verdict** `disengagement` · 21/28 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0.238 D/turn overall (D 6→1 over 21 turns)
  - Act 1 (turns 1–4): 0 D/turn (ΔD 0)
  - Act 2 (turns 5–10): 0.5 D/turn (ΔD 3)
  - Act 3 (turns 11–14): 0.25 D/turn (ΔD 1)
  - Act 4 (turns 15–21): 0.143 D/turn (ΔD 1)
- **plateau** longest flat stretch 5 turns (aporia window 6)
- **releases** 4/9 on cue · 4 deviated
- **decay** 3 slips (seed 1 · rate 0.75 · grace 1) · repaired 1 (tutor 1, re-adoption 0) · mean repair latency 2 turns · unrepaired at end 2 · degraded-turn integral 33 · D reversals 1
- **theory fidelity** F 0.833 at end · min 0.75
  - m_caster t3 (never repaired) · p_alloy t6→t8 (tutor) · m_graver t8 (never repaired)
- **events** plot×4 · throughline×1 · decay×3 · act_end×3 · plot_audit×4 · repair×1 · disengagement×1
- **staging** 4 movements declared by the director
- **acts** 4 played · closed by the director 3 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–10 (director) · Act 3 t11–14 (director) · Act 4 t15–21 (run end)
- **plot** 4 committed · withhold+friction on 4/4 · 6 clauses avg · audits 4 (incl. final act): kept 21 / justified 0 / drift 2 · hold-named exhibits staged in act 1/2
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 4: on 4 / off 0 · run-end reckoning 7 clauses: kept 5 / justified 0 / drift 2
- **release authority** 4 played: 0 on schedule · 1 held · 3 early · forced at hold limit 0 · overridden 2 · invalid claims 0
  - p_alloy +1 (t5): "Played one turn late to let the learner's rule-order settle before the first metal exhibit enters this act."
  - p_crucible -2 (t6): "p_crucible pushed: page stalling (hedging up 0.50)"
  - p_flaw -1 (t13): "Played one turn early because the learner has weighed the watch oath as no die conjunct, so the coin's own mark can now open the second chain."
  - p_graver -2 (t16): "Played two turns early because the learner has recovered p_flaw and its Rule 3 gap, and the page is beginning to stall."
- **confrontation** 7 demanded (1 against a slipped exhibit) · re-entries 2: covered 2, uncovered 0 · watcher fires 4 (became the confrontation 4) · fires without recorded due 0
  - **repair clause** restores 1 (1 repaired a real slip) · watcher fires on restore claims 0: p_alloy t8
- **figures** erotema 11/21 (52%) · 4 distinct · switch rate 0.60
- **superego** intervened 4/21 watched turns · figure changed within-turn on 4/4 interventions · switch on intervention 1.00 vs elsewhere 0.50
- **inference** 3 voiced · stall integral 0 · overreach 0 · mischanneled 0 — `blankFrom falseShilling weirCrucible` available t6 → voiced t6 (latency 0) · `castBlankFor falseShilling edony` available t10 → voiced t10 (latency 0) · `dieCutWith falseShilling wornBurin` available t16 → voiced t16 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 21 | 3.14 | 4 | 43.3 |
| tutor | 21 | 2.76 | 3 | 49.5 |
| learner | 21 | 4.29 | 7 | 79.6 |
