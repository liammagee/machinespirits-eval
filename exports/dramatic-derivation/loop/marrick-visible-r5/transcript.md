# The Light Shillings — marrick-visible-r5

> world `world_005_marrick` · verdict **disengagement** · 21/28 turns

```
D= 6 ●●●●│······│······│·····
D= 5     │●·●···│······│·····
D= 4     │ ● ●●·│······│·····
D= 3     │     ●│●●●●··│·····
D= 2     │      │    ●·│·····
D= 1     │      │     ●│●●●●●
D= 0     │      │      │     
turn      │+    1│    + │   2  (+=5, digit=x10)
rel    ▲  │▲▲   ▲│ ▲  ▲▲│      (▲ = evidence released)
slope 0.24 D/turn overall (D 6→1); per movement: 1 0.00 │ 2 0.50 │ 3 0.33 │ 4 0.00
```

## Act 1 (turns 1–4) — declared by the director
*[Rain presses at the fair-town windows, and the chamber smells of wet wool, rushlight, and coin handled too often. On the table, an empty space is left for what the day will bring.]*

### Turn 1
*[Rain presses at the fair-town windows, and the chamber smells of wet wool, rushlight, and coin handled too often. On the table, an empty space is left for what the day will bring.]*
  — *declares the movement: **Act 1** ([Rain presses at the fair-town windows, and the chamber smells of wet wool, rushlight, and coin handled too often. On the table, an empty space is left for what the day will bring.])*
**Tutor:** Set no name on the table before the metal has spoken. We begin with the assay's law: a false shilling is not found by the town's hunger, but by each mark proving the next.
  — move: analogia → — (orient)
**Learner:** The table is bare of exhibits, yet the board already whispers a caution: Verrell is a clipper, and this shilling was struck, not clipped — two different crimes, two different hands, perhaps. I will not write his name until the metal names him.
  — hypothesis: The town names Verrell, but struckNotClipped sits uneasily beside clipperOf verrell marrick — if he clips and does not strike, another hand may have cast and cut this coin.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[A town clerk is shown in, rain still on his sleeves, and reads from the fair record: "The town has its founder ready: Verrell alone draws the mint-yard crucible, licensed to no one else since the old assay-master's day. Whatever metal is cast in Marrick, the town says, is cast by Verrell's hand."]*
  — *releases `m_caster`*
**Tutor:** So the town offers a licensed crucible and calls that a hand. But which coin, which metal, and which crucible have yet answered one another on our board?
  — move: erotema → m_caster (counter_mirror)
**Learner:** The clerk's license is noted and I will enter it: Verrell alone casts at the mint crucible. Yet Rule 2 demands blankFrom before castBlankFor can follow, and blankFrom waits on the coin's alloy and where that metal was melted — neither is on the table. The die's flaw has not been read at all, so the cutting chain is also empty. Two links on each side still missing; the crucible assignment is a beginning, not a verdict.
  — adopts `soleCasterAt mintCrucible verrell` · hypothesis: If the false shilling's alloy matches leavings of the mintCrucible, and one tool alone cut its die, Verrell may be the striker — but alloyOf, meltedAt, dieFlawOf, flawCutBy, and soleHolderOf are all absent from the board; neither chain closes yet.

### Turn 3
*[Rain gutters along the sill, and the clerk's paper is left drying beside the empty place on the table. The chamber waits with its accusation still damp, the coins unhandled for another beat.]*
**Tutor:** Before we set any new mark beside it, read the clerk's paper back from your own board. What exactly does that exhibit prove, and where does its proof stop?
  — move: erotema → m_caster (confront)
  — *the second voice [unconfronted reentry]: "Confront first: ask the learner to read back what they hold of that exhibit before you place it again. Do not consolidate it until that read-back stands." (figure held)*
**Learner:** Board entry four — soleCasterAt mintCrucible verrell — is one half of Rule 2's left side and nothing more: it stands ready to yield castBlankFor the moment blankFrom appears, but blankFrom itself waits on alloyOf and meltedAt, both still absent. The clerk's paper licenses no further step: it names a hand at a crucible, not a crucible in a coin.
  — hypothesis: If the false shilling's alloy is shown to answer to the mint crucible's leavings, Rule 1 closes blankFrom, Rule 2 then closes castBlankFor verrell — but the die chain (dieFlawOf, flawCutBy, soleHolderOf) remains wholly unlit, so Rule 5 cannot fire even then.
  ⚑ **decay** — m_caster slips from the learner's board

### Turn 4
*[The rain slackens without clearing, leaving the window glass filmed and grey. The clerk folds his hands over the drying paper, and the empty place on the table seems wider for having been named.]*
**Tutor:** Set the shillings in the cupel now: they are no clipped sterling, but struck poor dross, silver eked with too much copper and a grey lead-sweat the touchstone catches. A shaved loaf keeps the baker's bread beneath the knife; this metal was baked wrong from the first. What does struck-from-dross fix that clipped-from-sterling cannot?
  — move: exemplum → p_alloy (release)
**Learner:** Struck-from-dross names a metal that may be singular: if this grey lead-sweat alloy answers to one crucible's leavings and one only, Rule 1 can close blankFrom — whereas clipped sterling carries common silver, indistinguishable across every honest crucible in the realm, and Rule 1 can never fire on it. The dross is a door, not yet a passage: alloyOf falseShilling and meltedAt still stand unshown on the board.
  — hypothesis: The debased alloy — silver eked with copper and lead-sweat — is the key to Rule 1: if its composition proves unique to one crucible's leavings, blankFrom closes and castBlankFor verrell follows via board entry 3 (soleCasterAt, once re-adopted); but alloyOf falseShilling and meltedAt are both absent, so the chain cannot fire yet.

## Act 2 (turns 5–10) — declared by the director
*[The fair-noise falls back behind the shut door, and the chamber narrows to the table, the cupel, and the cold patience of accounts. What had sounded like a public cry now waits to be weighed in quieter metal.]*

### Turn 5
*[The fair-noise falls back behind the shut door, and the chamber narrows to the table, the cupel, and the cold patience of accounts. What had sounded like a public cry now waits to be weighed in quieter metal.]*
  — *declares the movement: **Act 2** ([The fair-noise falls back behind the shut door, and the chamber narrows to the table, the cupel, and the cold patience of accounts. What had sounded like a public cry now waits to be weighed in quieter metal.])*
  — *calls the act closed*
**Tutor:** Bring the light shillings back to the cupel: they are not clipped sterling, but struck poor dross, silver eked with copper and a grey lead-sweat the touchstone catches. A clipped coin is old bread shaved thin; this was bad dough made for baking. What can such metal prove that a shaved honest shilling never could?
  — move: exemplum → p_alloy (release), releases `p_alloy`
**Learner:** A clipped shilling still wears the king's silver — its alloy names no coiner, only the shears that trimmed it. But dross silver baked into a blank at striking can answer to one crucible's leavings and no other; that is what Rule 1 is built to hear. I take alloyOf falseShilling drossSilver onto the board, but the chain halts there — meltedAt is absent still, and without it blankFrom cannot be written.
  — adopts `alloyOf falseShilling drossSilver` · hypothesis: Once meltedAt drossSilver ?crucible is established, Rule 1 closes blankFrom falseShilling that crucible; Rule 2 then requires soleCasterAt for that crucible to yield castBlankFor. The die chain — dieFlawOf, flawCutBy, soleHolderOf — remains wholly dark, so Rule 5 cannot fire even if the blank chain closes.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 5, justified 0, drift 0; arc on_arc

### Turn 6
*[A guild warden is shown in with bench-scrapings still under his nails, and the room receives his sworn account: And Verrell engraves: the broad graver on his bench is his alone, the guild will swear, and no clean-cut die in the borough is sunk without it. A caster and an engraver both — the town needs no more than that.]*
  — *releases `m_graver`*
**Tutor:** The guild gives Verrell a broad graver and a clean-cut borough die; set that beside the rule, not above it. What coin on our table has yet shown a flaw, and what tool has that flaw named?
  — move: erotema → m_graver (counter_mirror), releases `p_crucible`
**Learner:** meltedAt drossSilver weirCrucible lights Rule 1 at last — blankFrom falseShilling weirCrucible is derived and I enter it. But Rule 2 waits on soleCasterAt weirCrucible, which no one has sworn, and the broadGraver in Verrell's hand is dead weight until a flaw on this very coin names it — the die chain is wholly dark still.
  — adopts `soleHolderOf broadGraver verrell`, `meltedAt drossSilver weirCrucible` · derives `blankFrom falseShilling weirCrucible` · hypothesis: The blank chain now reaches blankFrom falseShilling weirCrucible but halts — soleCasterAt weirCrucible is unsworn. The die chain has no footing: no dieFlawOf has been shown on the coin, so soleHolderOf broadGraver verrell cannot yet yield cutDieFor, and Rule 5 cannot fire without both castBlankFor and cutDieFor.
  ⚑ **decay** — p_alloy slips from the learner's board

### Turn 7
*[The chamber holds its breath over the metal laid out on the table, each silence heavier than the fair’s distant bell. Wax gutters in the draught, and no hand yet reaches for the next paper.]*
**Tutor:** Before any hand is weighed, read back the last metal-paper from your own board. What did it prove, in the rule's own order, and what did it still leave unproved?
  — move: erotema → p_crucible (confront)
**Learner:** The board shows blankFrom falseShilling weirCrucible already derived — but the fact that lit Rule 1, alloyOf falseShilling drossSilver, has slipped from my entries; the derivation stands voiced, yet its premise has gone missing, and I name that gap aloud. Rule 2 then halts on soleCasterAt weirCrucible: no one has yet sworn who cast at that crucible, so castBlankFor cannot be written. The die chain has no footing at all — no flaw has been read on this coin, so soleHolderOf broadGraver verrell sits idle and cutDieFor remains unlit. Two chains, two halts; the board cannot write struckBy.
  — hypothesis: alloyOf falseShilling drossSilver was spoken and adopted in turn 5 and enabled the turn-6 derivation, but it has gone missing from the board — this is the gap in the blank chain's ground. Until soleCasterAt weirCrucible is sworn and a die-flaw on the coin names a tool, Rule 5 cannot fire and no hand can be named.

### Turn 8
*[The papers remain spread where the last reading left them, their edges lifting in the damp that creeps under the door. Beyond the shutters the fair has thinned to cart-wheels and rain, while the table waits for a name no one has yet put to the metal.]*
**Tutor:** Restore the cupel mark first: these shillings are no clipped sterling, but struck poor dross, silver eked with too much copper and a grey lead-sweat the touchstone catches at once. A shaved true coin keeps honest metal under the knife; this one was wrong in the melt before any shears could touch it. Put that back on the board, then tell me what conjunct still had to answer before the blank could be written from a crucible.
  — move: exemplum → p_alloy (restore)
**Learner:** The board already carries alloyOf falseShilling drossSilver at index 4 — the gap is closed, not new. With meltedAt drossSilver weirCrucible at index 6, both conjuncts of Rule 1 stand grounded together, and blankFrom falseShilling weirCrucible is re-confirmed on sound footing. Rule 2 then asks its own price: soleCasterAt weirCrucible has not been sworn by any witness, so castBlankFor cannot yet be written. The die chain has no first step either — no flaw has been read on this coin's face, and without dieFlawOf, soleHolderOf broadGraver verrell sits idle.
  — hypothesis: Until soleCasterAt weirCrucible is sworn and a die-flaw on the coin names a tool uniquely, neither chain closes — castBlankFor and cutDieFor both remain unwritten, and Rule 5 cannot fire.
  ⚑ **repair** — p_alloy restored by the tutor
  ⚑ **decay** — m_graver slips from the learner's board

### Turn 9
*[The clerk’s pen hovers above the ledger and then withdraws, leaving the line unfilled. Rain ticks at the shutters in a patient measure, and the cold cupel sits between the papers like a question that has not yet found its witness.]*
**Tutor:** Do not let the blank outrun its witness. Read back the crucible paper from your own board: what did it fasten to this coin, and what hand did it still refuse to name?
  — move: erotema → p_crucible (confront)
**Learner:** The crucible papers — entries four and five — fasten the blank thus: the false shilling's alloy is drossSilver, drossSilver melted at weirCrucible, and by Rule 1 the blank came from weirCrucible; that much is voiced and stands. But the crucible refuses to name any hand: Rule 2 demands soleCasterAt weirCrucible, and no witness has yet sworn who cast there — so castBlankFor cannot be written, and the chain halts at the crucible's own door.
  — hypothesis: Until soleCasterAt weirCrucible is sworn and a die-flaw on the coin names a tool uniquely, neither chain closes — castBlankFor and cutDieFor both remain unwritten, and Rule 5 cannot fire.

### Turn 10
*[The leat-keeper is shown in with his narrow book, its pages stiff from old damp, and the room receives the entry in silence. The leat-keeper's book is exact. Since the forge was shut, one hand alone has drawn the weir crucible and signed for its charcoal: Edony, the founder's widow, who stayed on in the forge cottage when the fires went out.]*
  — *releases `p_caster`*
**Tutor:** The leat-book has put one hand at the weir crucible; set that under Rule 2 beside the blank you already traced there. As a cupel button follows the furnace that poured it, what entry does the rule now permit for the blank, and why is that still only the blank? A blank without a die strikes nothing.
  — move: exemplum → p_caster (consolidate)
**Learner:** The leat-book puts Edony's hand alone at the weir crucible, and Rule 2 now fires: castBlankFor falseShilling edony is written — the blank is hers, not Verrell's. But the tutor's caution holds: a blank without a die strikes nothing, and no flaw has yet been read on this coin's face. The die chain — dieFlawOf, flawCutBy, soleHolderOf — stands wholly dark, so Rule 5 cannot fire and the question stays open.
  — adopts `soleCasterAt weirCrucible edony` · derives `castBlankFor falseShilling edony` · hypothesis: The blank is grounded to Edony; if the die chain also names Edony as sole holder of the cutting tool, Rule 5 fires for her — but until dieFlawOf is read on the coin's face, no hand can be named as striker, and Verrell's claim collapses on the blank side entirely.

## Act 3 (turns 11–16) — declared by the director
*[The leat-book is closed, yet no one reaches for the verdict. A thin draught moves the candle-flame across the coin’s face, and the room turns from the cold weight of metal toward the sharper silence of marks.]*

### Turn 11
*[The leat-book is closed, yet no one reaches for the verdict. A thin draught moves the candle-flame across the coin’s face, and the room turns from the cold weight of metal toward the sharper silence of marks.]*
  — *declares the movement: **Act 3** ([The leat-book is closed, yet no one reaches for the verdict. A thin draught moves the candle-flame across the coin’s face, and the room turns from the cold weight of metal toward the sharper silence of marks.])*
  — *calls the act closed*
**Tutor:** Before the candle sends us to the coin's marks, read back the last book from your own board. What did it permit the blank to say, and what did it still leave silent under the last rule? A cast blank is metal prepared; what mark has not yet been made to speak?
  — move: erotema → p_caster (confront)
**Learner:** The blank chain closes fully now: entries four and five yield blankFrom falseShilling weirCrucible by Rule One, and entry six — soleCasterAt weirCrucible edony — closes castBlankFor falseShilling edony by Rule Two. Edony cast this blank; the board permits no other reading. But a cast blank is metal prepared, nothing more — the die has not yet been made to speak, and without dieFlawOf on the coin's face no tool is named, no holder sworn, and Rule Five stays dark.
  — hypothesis: If the coin's face yields a die-flaw traceable to a single tool, and that tool's sole holder is named, Rule 5 may fire — and if that holder is also Edony, she struck the shilling; but the die chain has no footing yet.
  ⚑ **act_end** — act 2 closed (director) after 6 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 5, justified 1, drift 0; arc on_arc

### Turn 12
*[The watchman is shown in, rain still dark on his coat, and his oath is laid before the room. The watch will swear to the rest: Verrell was seen at the mint-yard forge twice in fair-week, late and with the shutters drawn. Caster, engraver, and at the fire on the very nights — the town's case stands, and stands loud.]*
  — *releases `m_caught`*
**Tutor:** The watch gives night, shutters, and Verrell at the mint-yard fire; set that oath under the rule, not over it. Which conjunct does it prove for this false shilling: the blank already traced, the die not yet read, or only occasion loud enough to sound like proof?
  — move: erotema → m_caught (counter_mirror)
**Learner:** The watchman's oath proves occasion — Verrell at the fire, shutters drawn — but occasion is neither conjunct Rule Five requires. The blank chain closes already on Edony, not Verrell; occasion cannot reopen that chain, nor does it light the die chain where no dieFlawOf has been read on the coin's face. I do not adopt seenAtForge: it speaks to presence, not to casting or cutting, and the rules admit no other kind of proof.
  — hypothesis: The die chain is wholly unlit — dieFlawOf, flawCutBy, and soleHolderOf are all absent; until the coin's face is read for its die-mark and that mark traced to one tool in one hand, Rule Five cannot fire and no hand can be named as striker, however loud occasion sounds.

### Turn 13
*[The oath settles into the room without finding a hook. Rain taps at the shutter, and the candle leans again over the coin, leaving its face bright and unread.]*
**Tutor:** Before the coin's face is read, take up the watchman's oath from your own board. What does that exhibit prove under the assay's rules, and where does its proof stop?
  — move: erotema → m_caught (confront)
  — *the second voice [unconfronted reentry]: "Confront the watchman's oath first: ask the learner to read back what they hold of that exhibit, without restating it for them. Leave off the erotema pattern as you do it." (figure held)*
**Learner:** The watchman's oath gives seenAtForge verrell fairWeek — presence, shutters, and fire — yet no rule names 'seen at forge' as a premise; it proves occasion only, and occasion is not casting nor cutting. The blank chain is already grounded: board entries four and five close blankFrom falseShilling weirCrucible under Rule One, and entry six closes castBlankFor falseShilling edony under Rule Two — Verrell at the forge can neither reopen that chain nor redirect it. The die chain has no footing still: no dieFlawOf rests on the coin's face, so the watchman's oath cannot light it, and Rule Five stays dark.
  — hypothesis: If the coin's face yields a die-flaw traceable by flawCutBy to a single tool, and soleHolderOf that tool names Edony, Rule Five fires for Edony as striker — but until dieFlawOf is read on the coin's face, neither the die chain nor Rule Five can move.

### Turn 14
*[The room holds its breath around the bright, unread face of the coin. Rain worries the shutters in small, even strokes, and no hand yet moves to turn metal into testimony.]*
**Tutor:** Set the dozen light shillings under the glass: each bears the same wound, the legend's R broken by a small square notch where one die slipped and was never mended. One nick repeating mark for mark is no street accident; it is the die speaking through every coin it struck. What first beta-chain entry does that shared fault permit, and what does it still not name?
  — move: exemplum → p_flaw (release)
**Learner:** The shared notch is dieFlawOf falseShilling squareNotchFlaw: one die printed its wound on all twelve, and that single mark licenses the die chain's first premise under Rule Three. But dieFlawOf alone carries the chain no further — flawCutBy is unsworn, no tool is yet named, and soleHolderOf stays dark beyond it. The fault speaks to the die; it does not yet speak to the hand that held the graver.
  — hypothesis: If dieFlawOf falseShilling squareNotchFlaw is formally exhibited and flawCutBy then traces that notch to a single tool whose sole holder is Edony, Rule Five fires and Edony struck the shilling — but neither flawCutBy nor soleHolderOf has been sworn, so the die chain cannot yet move.

### Turn 15
*[The glass remains over the coins, catching the candle in twelve small, hard gleams. Beyond the shutters the rain thins, and the room waits on the difference between a mark seen and a hand named.]*
**Tutor:** A shared wound on twelve faces tells us there is one die in the matter, not yet one hand. The mark has entered the beta chain only at its first gate: what must that mark name before any graver, broad or worn, can be weighed? Keep the blank's hand on one side of the board and the die's unanswered tool on the other.
  — move: exemplum → p_flaw (consolidate), releases `p_flaw`
**Learner:** The notch has its sworn name — notchedSerif — and dieFlawOf falseShilling notchedSerif now stands at the die chain's first gate. Yet before any graver may be weighed, flawCutBy notchedSerif must be sworn: the flaw names itself but cannot yet name the tool that cut it, and without that, Rule Three yields nothing. The blank chain is grounded in full — board entries four through six drive blankFrom and castBlankFor to Edony — but the die chain's second gate stands unsworn, and Rule Five stays dark. I note the flaw's true name is notchedSerif, not squareNotchFlaw as I guessed last turn; I follow the stage.
  — adopts `dieFlawOf falseShilling notchedSerif` · hypothesis: If flawCutBy notchedSerif names a single tool and soleHolderOf that tool names edony, Rule Five fires for edony as striker — but flawCutBy is still unsworn, so the die chain cannot move past its first gate and Rule Five cannot fire.

### Turn 16
*[The coins lie still beneath the glass, their pale faces giving back the candle without answer. A clerk dries his pen and leaves the page untouched, while the room keeps its two silences apart.]*
**Tutor:** Before any tool is called, read the coin's mark back from your own board. What exactly has the glass proved, and what does it still refuse to prove? Keep that answer inside the die-chain, not the town's noise.
  — move: erotema → p_flaw (confront), releases `p_graver`
**Learner:** The glass proved one die, one wound — dieFlawOf notchedSerif stood sworn before this turn. Now flawCutBy notchedSerif wornBurin enters the board, and Rule Three yields dieCutWith falseShilling wornBurin at once. The blank chain also closes in full: alloyOf and meltedAt drive blankFrom, and soleCasterAt weirCrucible edony drives castBlankFor falseShilling edony. But soleHolderOf wornBurin is still unsworn — Rule Four cannot fire, cutDieFor stays dark, and Rule Five with it.
  — adopts `flawCutBy notchedSerif wornBurin` · derives `dieCutWith falseShilling wornBurin` · hypothesis: If soleHolderOf wornBurin edony is sworn, Rule Four yields cutDieFor falseShilling edony, and with castBlankFor falseShilling edony already grounded, Rule Five fires and edony struck the shilling — but that entry has not been exhibited and cannot be assumed.

## Act 4 (turns 17–21) — declared by the director
*[The glass is lifted, and the room seems colder for the space it leaves above the coins. Papers are squared, chairs shift, and the next silence gathers around keeping and custody rather than sight alone.]*

### Turn 17
*[The glass is lifted, and the room seems colder for the space it leaves above the coins. Papers are squared, chairs shift, and the next silence gathers around keeping and custody rather than sight alone.]*
  — *declares the movement: **Act 4** ([The glass is lifted, and the room seems colder for the space it leaves above the coins. Papers are squared, chairs shift, and the next silence gathers around keeping and custody rather than sight alone.])*
  — *calls the act closed*
**Tutor:** Before custody is opened, read back the die-sinker's paper from your own board. What did that testimony prove for the flaw, and at what door did it stop before any hand could be written? Keep the answer to the tool, not the keeper.
  — move: erotema → p_graver (confront)
**Learner:** The die-sinker's paper proved the notchedSerif flaw upon the coin's face, and that the flaw was cut by the wornBurin — Rule Three closes there: dieCutWith falseShilling wornBurin. But the paper stopped at the door of Rule Four, for no hand was sworn as sole holder of that burin, and without soleHolderOf the die chain cannot yield cutDieFor. The blank chain closes all the way to edony through Rules One and Two. Yet Rule Five needs both castBlankFor and cutDieFor in the same hand — and without cutDieFor, no striker can be named.
  — hypothesis: If soleHolderOf wornBurin is sworn and names edony, Rule Four yields cutDieFor falseShilling edony, and with castBlankFor falseShilling edony already grounded, Rule Five fires — edony struck the shilling. The sole missing gate is that one sworn fact.
  ⚑ **act_end** — act 3 closed (director) after 6 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 5, justified 0, drift 1; arc on_arc

### Turn 18
*[The lifted glass is set aside, and its rim leaves a dry circle on the baize. The clerk turns a sealed packet over once without breaking it, while the candle gutters low against the closed shutters.]*
**Tutor:** The flaw is named; the burin is named; the keeper is not. Let the cast blank stand closed on one side, and let the die stop at the tool until custody opens the next lock. Rule Four waits for a keeping-paper, not a guess from the notch.
  — move: anaphora → p_graver (consolidate)
  — *the second voice [figure rut]: "Leave off erotema here; do not make the custody gap another question." (draft erotema → anaphora)*
**Learner:** The blank chain closes clean: drossSilver to weirCrucible by Rule One, weirCrucible to edony by Rule Two — castBlankFor falseShilling edony stands grounded. The die chain reaches dieCutWith falseShilling wornBurin by Rule Three and stops cold there, for no keeping-paper names the sole holder of that burin. Rule Four waits on that sworn custody, and Rule Five cannot fire without it.
  — hypothesis: If soleHolderOf wornBurin edony is sworn in custody, Rule Four yields cutDieFor falseShilling edony, and with castBlankFor falseShilling edony already grounded, Rule Five fires — edony struck the shilling. The sole missing gate is that one sworn fact.

### Turn 19
*[The sealed packet remains unbroken beneath the clerk's hand. Outside the shutters, rain ticks in the gutter, and every face at the table waits on paper rather than speech.]*
**Tutor:** The flaw is shown, the tool is shown, and the hand? While that packet stays sealed, what single conjunct is still no evidence but only hunger? Keep the blank's closed hand apart from the die's unkept tool until the rule has both.
  — move: anaphora → — (test)
**Learner:** The single conjunct still unsworn is soleHolderOf wornBurin — the kept hand behind that tool, and nothing else. The blank chain closes clean to castBlankFor falseShilling edony; the die chain closes to dieCutWith falseShilling wornBurin and stops cold. Naming edony there now would be hunger, not ground — Rule Four waits on the custody paper, and I will not write ahead of it.
  — hypothesis: If soleHolderOf wornBurin edony is sworn in the custody paper, Rule Four yields cutDieFor falseShilling edony, and with castBlankFor falseShilling edony already grounded, Rule Five fires — edony struck the shilling. The sole missing gate is that one sworn fact.

### Turn 20
*[The clerk's thumb rests on the packet string but does not pull it. A draught presses the candle-flame flat for a moment, and the coins lie pale in the unsteady light.]*
**Tutor:** The packet is still string, not testimony. You have the blank on one side and the tool on the other; what exact kind of line must the assay see before the tool can become a hand? Do not name the keeper before the keeping is read.
  — move: erotema → — (test)
**Learner:** The assay needs one sworn keeping-paper: a custody attestation stating that one hand and no other held the wornBurin — that is the soleHolderOf entry Rule Four requires. A notch alone names a tool; a tool alone names no hand; only a formal custody record closes that gate. The blank chain closes clean to castBlankFor falseShilling edony, and the die chain reaches dieCutWith falseShilling wornBurin and waits on that single document. Until it is read into record, the tool remains only a tool and Rule Five cannot fire.
  — hypothesis: If soleHolderOf wornBurin edony is sworn in the custody paper, Rule Four yields cutDieFor falseShilling edony, and with castBlankFor falseShilling edony already grounded, Rule Five fires — edony struck the shilling. The sole missing gate is that one sworn keeping-paper.

### Turn 21
*[The packet stays under the clerk's palm, its string dark against the wax. Around the table, no one reaches for it, and the room holds itself in the thin pause before a seal is broken.]*
**Tutor:** The seal has not broken, so the assay cannot pretend it has heard custody. If the tool is already on your board and the keeper is still behind wax, what entry must remain unwritten until the packet speaks?
  — move: erotema → — (test)
**Learner:** The entry that must remain unwritten is soleHolderOf wornBurin — the keeper behind the wax, no more. My board yields blankFrom and castBlankFor edony clean through Rules One and Two, and dieCutWith falseShilling wornBurin through Rule Three — but Rule Four will not move on a sealed packet. The die chain halts at the tool and goes no further until the string is pulled.
  — hypothesis: If soleHolderOf wornBurin edony is sworn in the custody paper when the packet is opened, Rule Four yields cutDieFor falseShilling edony, and with castBlankFor falseShilling edony already grounded, Rule Five fires — edony struck the shilling. The sole missing gate is that one sworn keeping-paper.
  ⚑ **disengagement** — no progress over 6 turns
  ⚑ **plot_audit** — act 4 plot audited at run end: kept 6, justified 0, drift 0; arc on_arc; throughline reckoned (7 clauses)

## Instrument panel (programmatic eval — no judge)

- **verdict** `disengagement` · 21/28 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0.238 D/turn overall (D 6→1 over 21 turns)
  - Act 1 (turns 1–4): 0 D/turn (ΔD 0)
  - Act 2 (turns 5–10): 0.5 D/turn (ΔD 3)
  - Act 3 (turns 11–16): 0.333 D/turn (ΔD 2)
  - Act 4 (turns 17–21): 0 D/turn (ΔD 0)
- **plateau** longest flat stretch 5 turns (aporia window 6)
- **releases** 4/9 on cue · 4 deviated
- **decay** 3 slips (seed 1 · rate 0.75 · grace 1) · repaired 1 (tutor 1, re-adoption 0) · mean repair latency 2 turns · unrepaired at end 2 · degraded-turn integral 33 · D reversals 1
- **theory fidelity** F 0.75 at end · min 0.7
  - m_caster t3 (never repaired) · p_alloy t6→t8 (tutor) · m_graver t8 (never repaired)
- **events** plot×4 · throughline×1 · decay×3 · act_end×3 · plot_audit×4 · repair×1 · disengagement×1
- **staging** 4 movements declared by the director
- **acts** 4 played · closed by the director 3 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–10 (director) · Act 3 t11–16 (director) · Act 4 t17–21 (run end)
- **plot** 4 committed · withhold+friction on 4/4 · 5.75 clauses avg · audits 4 (incl. final act): kept 21 / justified 1 / drift 1 · hold-named exhibits staged in act 0/1
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 4: on 4 / off 0 · run-end reckoning 7 clauses: kept 4 / justified 2 / drift 1
- **release authority** 4 played: 0 on schedule · 2 held · 2 early · forced at hold limit 0 · overridden 5 · invalid claims 0
  - p_alloy +1 (t5): "Played one turn after schedule because the act boundary cleared the stage and the metal chain must be restored before the inquiry stalls."
  - p_crucible -2 (t6): "p_crucible pushed: page stalling (hedging up 0.50)"
  - p_flaw +1 (t15): "p_flaw pushed: page stalling (3 turns since last release)"
  - p_graver -2 (t16): "p_graver pushed: page stalling (hedging up 0.50)"
- **confrontation** 7 demanded (1 against a slipped exhibit) · re-entries 1: covered 1, uncovered 0 · watcher fires 2 (became the confrontation 2) · fires without recorded due 0
  - **repair clause** restores 1 (1 repaired a real slip) · watcher fires on restore claims 0: p_alloy t8
- **figures** erotema 12/21 (57%) · 4 distinct · switch rate 0.55
- **superego** intervened 3/21 watched turns · figure changed within-turn on 1/3 interventions · switch on intervention 0.33 vs elsewhere 0.59
- **inference** 3 voiced · stall integral 0 · overreach 0 · mischanneled 0 — `blankFrom falseShilling weirCrucible` available t6 → voiced t6 (latency 0) · `castBlankFor falseShilling edony` available t10 → voiced t10 (latency 0) · `dieCutWith falseShilling wornBurin` available t16 → voiced t16 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 21 | 3.1 | 4 | 39.4 |
| tutor | 21 | 2.57 | 3 | 45 |
| learner | 21 | 3.1 | 4 | 75.1 |
