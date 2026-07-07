# The Light Shillings — marrick-real-r1

> world `world_005_marrick` · verdict **disengagement** · 21/28 turns

```
D= 6 ●●●│··●···│·······│·····
D= 5    │●● ●··│·······│·····
D= 4    │    ●●│·······│·····
D= 3    │      │●●●●···│·····
D= 2    │      │    ●●·│·····
D= 1    │      │      ●│●●●●●
D= 0    │      │       │     
turn     │ +    │1    + │   2  (+=5, digit=x10)
rel    ▲ │▲ ▲▲  │▲ ▲ ▲ ▲│      (▲ = evidence released)
slope 0.24 D/turn overall (D 6→1); per movement: 1 0.00 │ 2 0.33 │ 3 0.43 │ 4 0.00
```

## Act 1 (turns 1–3) — declared by the director
*[Rain works at the shutters, and the room smells of wet wool, lamp smoke, and coins recently handled by too many anxious hands. A long table waits under candlelight, bare but for space enough to receive whatever the town is ready to swear.]*

### Turn 1
*[Rain works at the shutters, and the room smells of wet wool, lamp smoke, and coins recently handled by too many anxious hands. A long table waits under candlelight, bare but for space enough to receive whatever the town is ready to swear.]*
  — *declares the movement: **Act 1** ([Rain works at the shutters, and the room smells of wet wool, lamp smoke, and coins recently handled by too many anxious hands. A long table waits under candlelight, bare but for space enough to receive whatever the town is ready to swear.])*
**Tutor:** Set the town's cry at the far end of the table and the rules at this end. Before any name is weighed, apprentice, what must a struck false shilling prove besides that men are angry?
  — move: erotema → — (orient)
**Learner:** Before a name, master, a coin must name itself: its alloy must answer to one crucible, its die-flaw to one graving-tool, and both must meet in one hand. The town's anger proves nothing the touchstone has not also proved.
  — hypothesis: The town names Verrell, but his recorded crime is clipping — and this shilling was struck, not clipped; his tools and habits may not match the coin's own testimony.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[A town officer is shown in with a wet ledger under his arm, and the room leans toward the seal. He reads: "The town has its founder ready: Verrell alone draws the mint-yard crucible, licensed to no one else since the old assay-master's day. Whatever metal is cast in Marrick, the town says, is cast by Verrell's hand."]*
  — *releases `m_caster`*
**Tutor:** Good; let the town's ledger stand where it is, with its seal unbroken. If Verrell draws the mint-yard crucible, which rule-conjunct has that ledger actually filled for these shillings, and which mark on the coins is still not before us?
  — move: erotema → m_caster (counter_mirror)
**Learner:** The ledger fills one conjunct of Rule 2 — that Verrell alone casts at the mint crucible — but the coin's alloy has not yet been matched to that crucible's leavings, so the blank-chain cannot close. And the die-flaw, which Rules 3 and 4 require, has not been named at all: we have no flaw, no graving-tool, no sole holder. One half of Rule 2 is grounded; the rest of the table is bare.
  — adopts `soleCasterAt mintCrucible verrell` · hypothesis: If the false shilling's alloy answers to the mint-yard crucible's leavings, the blank-chain closes to Verrell — but until the touchstone and assay-fire speak, that remains conjecture; and the die side is wholly unwitnessed.

### Turn 3
*[The officer's ledger remains open, its damp pages lifting at the corners as the candles gutter. Outside, the rain thickens, and every coin on the table seems to wait for a test not yet begun.]*
**Tutor:** Then let the cupel speak before the town's seal. Its bead says these shillings are no clipped sterling, but struck poor dross: silver eked with too much copper, and a grey lead-sweat under the touchstone. Clipping shaves a true coin; it does not make this metal into a new struck face.
  — move: exemplum → p_alloy (release)
  — *the second voice [figure rut]: "Leave off erotema for this turn; make the next move without another question-shape." (draft erotema → exemplum)*
**Learner:** The cupel's bead confirms what the board already holds: struck dross, not shaved sterling. The alloy now has a face — copper-heavy silver with a lead-sweat — but the bead has not named which crucible's leavings this metal answers to, so Rule 1 cannot close and Rule 2 cannot follow it. The die-flaw chain is still dark entirely. Two conjuncts of Rule 5 remain ungrounded; no hand can be named yet.
  — hypothesis: The alloy's character — copper-heavy silver with lead present — may match the mint-yard crucible's leavings when the assay-fire is formally compared; if so, the blank-chain closes to Verrell under Rules 1 and 2. But the die-flaw side remains wholly unwitnessed, and Rule 5 demands both chains in one hand before any binding verdict.
  ⚑ **decay** — m_caster slips from the learner's board

## Act 2 (turns 4–9) — declared by the director
*[The ledger is closed without being dismissed, and the tested coins are left in the candlelight where their pale faces cannot settle the room. Beyond the shutters the rain slackens into a colder tapping, and the table seems to narrow toward patient questions of metal, fire, and custody.]*

### Turn 4
*[The ledger is closed without being dismissed, and the tested coins are left in the candlelight where their pale faces cannot settle the room. Beyond the shutters the rain slackens into a colder tapping, and the table seems to narrow toward patient questions of metal, fire, and custody.]*
  — *declares the movement: **Act 2** ([The ledger is closed without being dismissed, and the tested coins are left in the candlelight where their pale faces cannot settle the room. Beyond the shutters the rain slackens into a colder tapping, and the table seems to narrow toward patient questions of metal, fire, and custody.])*
  — *calls the act closed*
**Tutor:** Bring the tested shilling closer: its pale face is not shaved sterling but struck poor dross, silver thinned with copper and a grey lead-sweat the touchstone catches. A loaf tells its flour before it tells the baker; what has this metal now told, and what has it still not named?
  — move: exemplum → p_alloy (release), releases `p_alloy`
**Learner:** The metal has named its flour at last — dross-silver, copper and lead bleeding through the touchstone's streak. But the coin has named its alloy, not its crucible; until some ledger or leavings show which crucible melted this very dross, Rule 1 cannot fire and the blank-chain stays open. The die side has not spoken at all.
  — adopts `alloyOf falseShilling drossSilver` · hypothesis: The alloy drossSilver may answer to the mint-yard crucible's leavings when the assay-fire is formally compared; if meltedAt drossSilver is established for any crucible, Rule 1 closes and the blank-chain advances — but that step is still conjecture until the crucible-record speaks. The die-flaw chain remains entirely unwitnessed.
  ⚑ **act_end** — act 1 closed (director) after 3 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 5, justified 0, drift 1; arc on_arc

### Turn 5
*[The cupel cools to a dull eye beside the tested shilling, and no hand reaches for either. The room holds its breath in the small cold after rain, while wax runs down the candles and the unanswered metal waits under the same light.]*
**Tutor:** Before I set that bead beside any ledger again, read it back from your own board. What did the cupel establish, and what did it leave untouched?
  — move: erotema → p_alloy (confront)
  — *the second voice [unconfronted reentry]: "Confront p_alloy first: ask the learner to read back what they hold of that exhibit before you test it again." (figure held)*
**Learner:** The cupel settled the alloy — dross-silver, fact four on my board, and that is all it settled. It named the flour, as the tutor says, but not the mill: meltedAt still has no crucible attached, so Rule 1 cannot fire and the blank-chain stays open at its first link. The die face has been neither examined nor entered; Rules 3 and 4 are unwitnessed entirely. My board holds four grounded facts and no derived conclusions — the question is not yet settled.
  — hypothesis: The alloy drossSilver may answer to the mint-yard crucible's leavings when the crucible-record is produced; if meltedAt drossSilver is established for one crucible only, Rule 1 closes and the blank-chain advances — but that step is still conjecture. The die-flaw chain remains entirely unwitnessed.
  ⚑ **decay** — p_alloy slips from the learner's board

### Turn 6
*[A guildman is shown in with rain still shining on his sleeves, and the bench-tools are named before the room. "And Verrell engraves: the broad graver on his bench is his alone, the guild will swear, and no clean-cut die in the borough is sunk without it. A caster and an engraver both — the town needs no more than that."]*
  — *releases `m_graver`*
**Tutor:** Let the guild's oath stand beside the town's crucible ledger, not upon the coin. If Verrell's broad graver is his alone, what coin-mark has it yet been made to answer, and which rule still waits for the die to speak before the hand can be named?
  — move: erotema → m_graver (counter_mirror)
**Learner:** The guild's oath grounds the second leg of Rule 4 — soleHolderOf broadGraver verrell is now on my board — but the first leg still wants the die to speak: without dieFlawOf on this shilling and flawCutBy that flaw to the broad graver, Rules 3 and 4 cannot fire and cutDieFor stays unvoiced. The town gives me the tool-holder; the coin must yet give me the flaw.
  — adopts `soleHolderOf broadGraver verrell` · hypothesis: If the false shilling's die bears a flaw traceable to the broad graver, Rules 3 and 4 would yield cutDieFor falseShilling verrell; combined with the blank-chain once the crucible-record speaks, Rule 5 could then settle the verdict — but both chains remain open at their first links.

### Turn 7
*[The guildman’s oath is allowed to settle like damp wool in the chamber, heavy but not warm. The tested shilling lies between tool and cupel, and the candles make two small lights of it without choosing either one.]*
**Tutor:** Then set the bead beside the founder's leavings, not the town's seal: the lead-sweat answers to one crucible on this coast, the weir-forge crucible above the mill-leat, cold these ten years since the old founder died. A coin's blank, like a loaf's flour, first tells where its stuff was made. Which rule-link has the metal now filled, and what hand has it still not named?
  — move: exemplum → p_crucible (release), releases `p_crucible`
**Learner:** The weir-crucible entry I adopt — meltedAt drossSilver weirCrucible now stands on my board. But I must speak a gap: alloyOf falseShilling drossSilver, which the cupel settled and which the learner once called fact four, has gone missing from my board between the acts — without it, Rule 1 cannot fire and the blank-chain stays broken at its first link. And even were that entry restored, Rule 2 still wants soleCasterAt weirCrucible, which no voice has yet named — the old founder is dead and the forge cold ten years, but no hand has been sworn to that ladle. The die-chain remains wholly unwitnessed: no flaw on this shilling has been shown, and the broad graver has not yet been made to answer any coin-mark.
  — adopts `meltedAt drossSilver weirCrucible` · hypothesis: The weir-forge crucible produced the drossSilver blank — if alloyOf falseShilling drossSilver is restored and soleCasterAt weirCrucible is established, the blank-chain advances under Rules 1 and 2; but the sole caster of a cold forge dead ten years may not be Verrell, and the die-chain is still entirely unwitnessed. Both chains must close in one hand before Rule 5 can speak.

### Turn 8
*[The chamber holds its breath around the unspent question, the rain thinning to a fine scratch at the shutters. A clerk turns an empty page and waits with his pen raised, while the pale coin and the dark tools remain apart on the table.]*
**Tutor:** Then write the cupel's line back before any further hand is weighed: these shillings are no clipped sterling, but struck poor dross, silver eked with too much copper and a grey lead-sweat the touchstone catches. Clipping shaves a true coin; it does not cast and strike this new pale face. With that line restored, what may stand again beside the weir-crucible entry, and what hand is still absent from the rule?
  — move: exemplum → p_alloy (restore)
**Learner:** The cupel's line stands restored — alloyOf falseShilling drossSilver is on my board, and beside it meltedAt drossSilver weirCrucible; Rule 1 now fires and I can voice blankFrom falseShilling weirCrucible. But Rule 2 still waits: soleCasterAt weirCrucible names no hand — the old founder is ten years dead, and no living caster has been sworn to that cold ladle. The die-chain has not spoken at all.
  — derives `blankFrom falseShilling weirCrucible` · hypothesis: The weir-forge crucible was last worked by the old founder, now dead; if no other hand has since cast there, and if any living person can be shown to have used it after his death, that person may be the sole caster — but no name has yet been sworn to that ladle, and Verrell has not been placed at the weir-forge at all.
  ⚑ **repair** — p_alloy restored by the tutor
  ⚑ **decay** — m_graver slips from the learner's board

### Turn 9
*[The restored line is left drying in the clerk’s book, its ink dark against the page while the shilling cools in the candlewash. No hand is called from the doorway; the room waits on the gap as if it were a witness not yet willing to cross the threshold.]*
**Tutor:** Before we move that link again, read back the crucible exhibit from your own board. What exactly did it establish, and what did it leave still unproved?
  — move: erotema → p_crucible (confront)
  — *the second voice [unconfronted reentry]: "Confront p_crucible first: ask the learner to read back what they hold of that exhibit before you test it again." (figure held)*
**Learner:** The crucible exhibit — meltedAt drossSilver weirCrucible — establishes only where that metal was smelted; joined to alloyOf falseShilling drossSilver it fires Rule 1 and yields blankFrom falseShilling weirCrucible, already on the record. What it leaves open is the entire second link: soleCasterAt weirCrucible names no hand, so Rule 2 cannot fire and castBlankFor falseShilling remains ungrounded. The weir-forge is ten years cold and its old founder dead — who, if anyone, last held that ladle is the testimony the board still wants. Until a sole caster is sworn, the blank-chain stalls at the crucible's rim, and the die-chain has not spoken at all.
  — hypothesis: The weir-forge crucible was last worked by the old founder before his death; if no other hand has since cast there, the forge may have been cold and unusable — meaning the blank was cast before the founder died, and the true question is who acquired that blank afterward and married it to a die.

## Act 3 (turns 10–16) — declared by the director
*[The leat-keeper's book is brought in damp at the corners and opened under the clerk's hand. The leat-keeper's book is exact. Since the forge was shut, one hand alone has drawn the weir crucible and signed for its charcoal: Edony, the founder's widow, who stayed on in the forge cottage when the fires went out. The room tightens around the name, and the next silence comes sharper, as if one closed chain has made the remaining darkness louder.]*

### Turn 10
*[The leat-keeper's book is brought in damp at the corners and opened under the clerk's hand. The leat-keeper's book is exact. Since the forge was shut, one hand alone has drawn the weir crucible and signed for its charcoal: Edony, the founder's widow, who stayed on in the forge cottage when the fires went out. The room tightens around the name, and the next silence comes sharper, as if one closed chain has made the remaining darkness louder.]*
  — *releases `p_caster`*
  — *declares the movement: **Act 3** ([The leat-keeper's book is brought in damp at the corners and opened under the clerk's hand. The leat-keeper's book is exact. Since the forge was shut, one hand alone has drawn the weir crucible and signed for its charcoal: Edony, the founder's widow, who stayed on in the forge cottage when the fires went out. The room tightens around the name, and the next silence comes sharper, as if one closed chain has made the remaining darkness louder.])*
  — *calls the act closed*
**Tutor:** The alloy is shown; the weir crucible is shown; the leat-book now names the sole hand that drew it. Let Rule 2 do only its own work: what finding about the blank follows, and what must still be cut before any coin can be struck?
  — move: anaphora → p_caster (stage_recognition)
**Learner:** Rule 2 fires cleanly: sole caster at the weir crucible is Edony, so the blank for this shilling was cast by her hand. The blank-chain is now closed — to Edony, not Verrell. But the die-chain has not been opened at all; no flaw, no tool, no holder has been sworn. Both chains must meet in one hand before Rule 5 can speak.
  — adopts `soleCasterAt weirCrucible edony` · derives `castBlankFor falseShilling edony` · hypothesis: The blank-chain now closes to Edony under Rules 1 and 2; if Edony also held the tool that cut the die, Rule 5 could settle the verdict — but the die-chain is wholly unwitnessed: no flaw, no tool, and no sole holder have yet been sworn before this assay.
  ⚑ **act_end** — act 2 closed (director) after 6 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 5, justified 1, drift 0; arc on_arc

### Turn 11
*[The named page is closed but not taken away, its damp corners curling in the warmth. Across the table the false shilling lies face-up, and the room holds itself between the metal already answered and the mark no one has yet made speak.]*
**Tutor:** Before we let that page pull the whole room after it, read the leat-book back from your own board. What did that exhibit establish under the casting rule, and what did it leave outside its authority?
  — move: erotema → p_caster (confront)
  — *the second voice [unconfronted reentry]: "Confront first: ask the learner to read back what they hold of that exhibit before you move it again." (figure held)*
**Learner:** The leat-book established one thing under the casting rule: Edony alone drew the weir crucible, which — joined to alloyOf and meltedAt already on the board — fires Rules 1 and 2 and closes the blank-chain to her hand. What it left entirely outside its authority is the die-chain: no flaw has been read on the coin's face, no graving-tool named, no holder sworn. The blank-chain is finished; the die-chain has not yet opened its first link, and Rule 5 demands both.
  — hypothesis: The blank-chain closes to Edony under Rules 1 and 2; if Edony also held the sole graving-tool that cut the false shilling's die, Rule 5 could settle the verdict — but the die-chain is wholly unwitnessed: no flaw read, no tool named, no sole holder sworn.

### Turn 12
*[A watchman is shown in, rain still shining on his coat, and the room turns from the closed book to his oath. The watch will swear to the rest: Verrell was seen at the mint-yard forge twice in fair-week, late and with the shutters drawn. Caster, engraver, and at the fire on the very nights — the town's case stands, and stands loud.]*
  — *releases `m_caught`*
**Tutor:** Let the watchman's oath stand loud, but not larger than its words: Verrell was seen at the mint-yard forge. Which rule-conjunct does being near that fire fill for these shillings, and where is the cut die still unshown?
  — move: erotema → m_caught (counter_mirror)
**Learner:** The watchman's oath places Verrell at the mint-yard forge — not at the weir crucible, where the blank was cast, and not before the coin's face with its die still unread. Presence near a fire fills none of the three conjuncts the die-chain needs: no flaw has been read on the shilling, no graving-tool named, no sole holder sworn. The blank-chain is closed to Edony; the die-chain has not opened its first link. Loud is not the same as sufficient.
  — adopts `seenAtForge verrell fairWeek` · hypothesis: Verrell's presence at the mint-yard forge in fair-week is consistent with having cut a die there, but consistency is not evidence under the rules: no dieFlawOf has been read on the coin's face, no flawCutBy any tool established, no soleHolderOf any graver sworn — the die-chain cannot open on circumstance alone, and Rule 5 demands both chains in one hand.

### Turn 13
*[The watchman's wet coat drips steadily by the door, each drop marking the space after his oath. No one reaches for the shilling yet; its pale face waits under the lamplight while the room's loud certainty thins into scrutiny.]*
**Tutor:** Set the watchman's oath aside and bring the faces under the glass. A dozen light shillings share one fault to the hair: the R in the legend is broken by a small square notch where the graver slipped and was never mended. One die, then; the blank has its casting, and now the face begins its own testimony.
  — move: exemplum → p_flaw (release)
  — *the second voice [figure rut]: "Leave off erotema here; do not make the next move another question-driven turn." (draft erotema → exemplum)*
**Learner:** The notched R is the die's own mark — one flaw, one tool, one hand, if the chain holds. But the glass showing a flaw is not yet an exhibit sworn before this assay; no dieFlawOf sits on my board, and Rules 3 and 4 cannot open on description alone. I note the testimony and wait for it to be formally tendered — the die-chain's first link must be entered before I can carry it forward. The blank-chain closes to Edony; the die-chain has spoken its first syllable, and that syllable is not yet evidence.
  — hypothesis: The broken R with its square notch is the die's own signature; when formally exhibited as dieFlawOf falseShilling notchedR, it will open the die-chain under Rule 3 — but description from the glass is not yet a sworn exhibit, and without flawCutBy and soleHolderOf established, Rule 5 remains suspended. If the notch traces to one graving-tool, and one hand alone held that tool, the chain can close.

### Turn 14
*[The shilling remains under the glass, its pale rim catching and losing the lamplight as the clerk waits with an unwritten line. The room has gone quieter than accusation, held between the closed casting chain and the face of the coin not yet entered.]*
**Tutor:** Then let the clerk enter what the glass has shown: these light shillings bear one die-flaw, the broken R with its small square notch, repeated to the hair. A die, like a seal, betrays itself by the same wound wherever it bites. What has Rule 3 now received, and what has it not yet received about the tool?
  — move: exemplum → p_flaw (release), releases `p_flaw`
**Learner:** Rule 3 has received its first conjunct at last — dieFlawOf falseShilling notchedSerif is now sworn evidence, not mere description from the glass. But Rule 3 demands both conjuncts before it fires: I have the flaw, yet flawCutBy notchedSerif ?tool has not been entered — no specific graving-tool's slip has been named as the maker of that notch. The die-chain has opened its first link; the second is still unsworn.
  — adopts `dieFlawOf falseShilling notchedSerif` · hypothesis: The notched-serif flaw may trace to Verrell's broad graver found on his bench — if flawCutBy notchedSerif verreллGraver and soleHolderOf that tool verrell are sworn, Rules 3 and 4 close the die-chain to Verrell; but then castBlankFor closes to Edony, not Verrell, and Rule 5 cannot unite both chains in one hand unless Edony and Verrell are somehow the same person or acted jointly — which no rule here covers.

### Turn 15
*[The clerk sands the fresh line and leaves the page open, the black grains dulling around the named flaw. Beyond the shutters the fair-noise has fallen away, and the coin under the glass seems smaller for how much now waits upon its damaged letter.]*
**Tutor:** Before we let the glass carry the die-chain onward, read that exhibit back from your own board. What exactly has the coin's face established, and what has it left still unproved?
  — move: erotema → p_flaw (confront)
  — *the second voice [unconfronted reentry]: "Confront first: ask the learner to read back what stands on their board for that exhibit, without restaging it or adding its next link." (figure held)*
**Learner:** My board holds one sworn fact about the coin's face: dieFlawOf falseShilling notchedSerif — the broken R is entered as evidence. Rule 3's first conjunct is satisfied, but its second — flawCutBy notchedSerif, naming which graving-tool left that particular slip — has not been tendered before this assay. Without it, dieCutWith cannot be derived, soleHolderOf cannot be applied, and Rule 4 stays sealed. The face has named its wound; it has not yet named the hand that made it.
  — hypothesis: Even when flawCutBy and soleHolderOf are eventually sworn and the die-chain closes, the hand it names must be Edony — not Verrell — for Rule 5 to unite both chains in one verdict; if the die-chain closes to Verrell while the blank-chain holds for Edony, no rule in this assay joins them, and struckBy falseShilling cannot be settled against either alone.

### Turn 16
*[The open page lies between lamp and glass, its newest line drying while no hand reaches to turn it. In the close air the damaged letter seems to wait without speaking, and the room keeps its breath for the tool not yet named.]*
**Tutor:** Call the guild's die-sinker to the glass: that square notch is no burnisher's slip, but the bite of a worn burin with a sprung heel, a tool that signs every line it cuts so; it is not Verrell's broad graver, which cuts clean. A wound in a seal names the edge that made it before it names the clerk who held the handle. With the flaw and the tool now before you, what may Rule 3 yield, and what does Rule 4 still lack?
  — move: exemplum → p_graver (release), releases `p_graver`
**Learner:** Rule 3 fires at last: both conjuncts are now sworn, and dieCutWith falseShilling wornBurin is a derived fact I may enter on the record. The die-sinker's word also clears a false path — the sprung heel of this worn burin is not Verrell's broad graver, which the guild attests cuts clean. Yet Rule 4 still wants its second conjunct: soleHolderOf wornBurin has not been tendered before this assay, and cutDieFor remains unresolved. If that sole holder proves to be Edony, both chains at last meet in one hand.
  — adopts `flawCutBy notchedSerif wornBurin` · derives `dieCutWith falseShilling wornBurin` · hypothesis: If soleHolderOf wornBurin edony is sworn, Rule 4 yields cutDieFor falseShilling edony; combined with castBlankFor falseShilling edony already on the record, Rule 5 would settle struckBy falseShilling edony — both chains closing in Edony's hand, and Verrell, whose broad graver cuts clean, standing clear of the die entirely.

## Act 4 (turns 17–21) — declared by the director
*[The glass is covered, and for a moment the court sees only the dull cloth where the damaged face had been. The next act opens under a lower lamp and a harder patience: not louder accusation, but custody, inheritance, and the last small object waiting to be claimed.]*

### Turn 17
*[The glass is covered, and for a moment the court sees only the dull cloth where the damaged face had been. The next act opens under a lower lamp and a harder patience: not louder accusation, but custody, inheritance, and the last small object waiting to be claimed.]*
  — *declares the movement: **Act 4** ([The glass is covered, and for a moment the court sees only the dull cloth where the damaged face had been. The next act opens under a lower lamp and a harder patience: not louder accusation, but custody, inheritance, and the last small object waiting to be claimed.])*
  — *calls the act closed*
**Tutor:** You have named an edge; do not let a guessed keeper do the handle's work. Before Rule 4 may speak, what kind of custody must be entered for that burin, and after that, what must still meet the cast blank before the assay can write its last line?
  — move: erotema → — (test)
**Learner:** Rule 4 demands sole custody: soleHolderOf wornBurin must be sworn to one hand, and one only — not mere possession, but sole holding, so no second hand could have graved with it. Once that entry is grounded, dieCutWith falseShilling wornBurin — which the board already yields under Rule 3 — carries through Rule 4 to cutDieFor falseShilling that hand. Then Rule 5 asks one thing only: does that hand match the one castBlankFor names — which is Edony — and if it does, the last line writes itself.
  — hypothesis: If soleHolderOf wornBurin edony is sworn, Rule 4 yields cutDieFor falseShilling edony; Rule 5 then unites both chains in Edony's hand and settles struckBy falseShilling edony — but that sole-custody entry has not yet been exhibited before this assay.
  ⚑ **act_end** — act 3 closed (director) after 7 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 5, justified 0, drift 1; arc on_arc

### Turn 18
*[The covered glass remains on the table while the lower lamp gutters and steadies. No witness is called; the clerk only sands the last dry line and leaves a blank space beneath it.]*
**Tutor:** Good: keep guessed custody outside the cupel. On your board, which line is already derived for the die, and which single custody line must a book or witness enter before Rule 4 may yield anything further?
  — move: erotema → — (test)
**Learner:** The die already yields one step under Rule 3: facts 8 and 9 together give dieCutWith falseShilling wornBurin — that line is grounded now. What Rule 4 still waits on is a single entry: soleHolderOf wornBurin sworn to one name and one only, by book or sworn witness. Until that custody line is exhibited, the die-chain halts at the tool and will not name a hand.
  — hypothesis: If soleHolderOf wornBurin edony is sworn, Rule 4 yields cutDieFor falseShilling edony; Rule 5 then unites both chains in Edony's hand and settles struckBy falseShilling edony — but that sole-custody entry has not yet been exhibited before this assay.

### Turn 19
*[The room holds its breath around the covered glass. The clerk's pen waits above the blank space, and the lower lamp makes the table's edge look sharper than before.]*
**Tutor:** The edge is shown; the keeper is not shown; Rule 4 still waits at the handle. A guessed name cannot carry a die any more than a blank can strike itself. Hold the worn burin at the table's edge until a book or witness gives it sole custody.
  — move: anaphora → — (consolidate)
  — *the second voice [figure rut]: "Leave off erotema for this turn; make the custody pause without another question." (draft erotema → anaphora)*
**Learner:** Three steps are already grounded and I voice them now: blank-chain runs to Edony under Rules 1 and 2, and the die finds its tool under Rule 3. The worn burin sits at the table's edge, unowned — soleHolderOf wornBurin is the one line the assay still lacks, and without it Rule 4 will not move and Rule 5 cannot write. I hold the pen and wait for a book or witness to name that keeper.
  — hypothesis: If soleHolderOf wornBurin edony is sworn, Rule 4 yields cutDieFor falseShilling edony; Rule 5 then unites both chains in Edony's hand and settles struckBy falseShilling edony — but that sole-custody entry has not yet been exhibited before this assay.

### Turn 20
*[The blank space under the clerk's last line remains untouched. Rain ticks at the shutter, and every face in the room turns once toward the closed door, then back to the covered glass.]*
**Tutor:** Keep the pen above the blank, not upon it. The die is cut with a worn burin; what line of custody would turn that tool into a hand under Rule 4, and what must you refuse to write until that line is shown?
  — move: erotema → — (test)
**Learner:** Rule 4 turns the worn burin into a hand the moment soleHolderOf wornBurin is sworn to one name and one only — that single custody line is the assay's missing link. Until book or witness exhibits it, cutDieFor falseShilling and struckBy falseShilling are lines I must refuse to write. I voice now what the board already settles: blank runs to weirCrucible under Rule 1, thence to Edony's hand under Rule 2, and the die finds its tool under Rule 3. The pen waits above the blank; it will not move until custody speaks.
  — hypothesis: If soleHolderOf wornBurin edony is sworn, Rule 4 yields cutDieFor falseShilling edony; Rule 5 then unites both chains in Edony's hand and settles struckBy falseShilling edony — but that sole-custody entry has not yet been exhibited before this assay.

### Turn 21
*[The closed door does not open. The clerk lowers his pen without marking the page, and the covered glass gathers the lamplight like a question no one has yet earned the right to answer.]*
**Tutor:** Then let the closed door be part of the assay, not a failure of it. If no book has yet named the burin's keeper, which line must remain unwritten though the blank and the tool both stand before you?
  — move: erotema → — (test)
**Learner:** The line that must remain unwritten is cutDieFor falseShilling — Rule 4 will not move without soleHolderOf wornBurin, and without cutDieFor, Rule 5 is mute. Three links are grounded and I voice them now: blank runs to weirCrucible under Rule 1, thence to Edony's hand under Rule 2, and the die finds its tool in the worn burin under Rule 3. The fourth link — whose hand alone held that burin — is the one the closed door has not yet given us, and the pen must not move until it does.
  — hypothesis: If soleHolderOf wornBurin edony is sworn, Rule 4 yields cutDieFor falseShilling edony; Rule 5 then unites both chains in Edony's hand and settles struckBy falseShilling edony — but that sole-custody entry has not yet been exhibited before this assay.
  ⚑ **disengagement** — no progress over 6 turns
  ⚑ **plot_audit** — act 4 plot audited at run end: kept 5, justified 1, drift 0; arc on_arc; throughline reckoned (7 clauses)

## Instrument panel (programmatic eval — no judge)

- **verdict** `disengagement` · 21/28 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0.238 D/turn overall (D 6→1 over 21 turns)
  - Act 1 (turns 1–3): 0 D/turn (ΔD 0)
  - Act 2 (turns 4–9): 0.333 D/turn (ΔD 2)
  - Act 3 (turns 10–16): 0.429 D/turn (ΔD 3)
  - Act 4 (turns 17–21): 0 D/turn (ΔD 0)
- **plateau** longest flat stretch 5 turns (aporia window 6)
- **releases** 6/9 on cue · 2 deviated
- **decay** 3 slips (seed 1 · rate 0.75 · grace 1) · repaired 1 (tutor 1, re-adoption 0) · mean repair latency 3 turns · unrepaired at end 2 · degraded-turn integral 34 · D reversals 1
- **theory fidelity** F 0.833 at end · min 0.714
  - m_caster t3 (never repaired) · p_alloy t5→t8 (tutor) · m_graver t8 (never repaired)
- **events** plot×4 · throughline×1 · decay×3 · act_end×3 · plot_audit×4 · repair×1 · disengagement×1
- **staging** 4 movements declared by the director
- **acts** 4 played · closed by the director 3 · at max length 0 · at run end 1 — Act 1 t1–3 (director) · Act 2 t4–9 (director) · Act 3 t10–16 (director) · Act 4 t17–21 (run end)
- **plot** 4 committed · withhold+friction on 4/4 · 6 clauses avg · audits 4 (incl. final act): kept 20 / justified 2 / drift 2 · hold-named exhibits staged in act 1/2
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 4: on 4 / off 0 · run-end reckoning 7 clauses: kept 4 / justified 2 / drift 1
- **release authority** 4 played: 2 on schedule · 0 held · 2 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_crucible -1 (t7): "Played one turn early because the learner has already named the exact missing metal-chain match and the board is ready for it."
  - p_graver -2 (t16): "Played two turns early because the learner has cleanly held p_flaw and is ready to open the die chain before the closed blank hardens into a verdict."
- **confrontation** 4 demanded (1 against a slipped exhibit) · re-entries 0: covered 0, uncovered 0 · watcher fires 4 (became the confrontation 4) · fires without recorded due 0
  - **repair clause** restores 1 (1 repaired a real slip) · watcher fires on restore claims 0: p_alloy t8
- **figures** erotema 12/21 (57%) · 3 distinct · switch rate 0.60
- **superego** intervened 7/21 watched turns · figure changed within-turn on 3/7 interventions · switch on intervention 1.00 vs elsewhere 0.39
- **inference** 3 voiced · stall integral 0 · overreach 0 · mischanneled 0 — `blankFrom falseShilling weirCrucible` available t8 → voiced t8 (latency 0) · `castBlankFor falseShilling edony` available t10 → voiced t10 (latency 0) · `dieCutWith falseShilling wornBurin` available t16 → voiced t16 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 21 | 3.24 | 5 | 45.2 |
| tutor | 21 | 2.33 | 3 | 46.5 |
| learner | 21 | 3.43 | 4 | 79 |
