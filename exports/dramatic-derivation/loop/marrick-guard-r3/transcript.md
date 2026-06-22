# The Light Shillings — marrick-guard-r3

> world `world_005_marrick` · verdict **grounded_anagnorisis** · 22/28 turns
> S forced at turn 22; asserted grounded at turn 22

```
D= 6 ●●··│······│·····│·····│··
D= 5   ●●│●●·●●·│·····│·····│··
D= 4     │  ●  ●│●····│·····│··
D= 3     │      │ ●···│·····│··
D= 2     │      │  ●●●│●····│··
D= 1     │      │     │ ●●●●│●·
D= 0     │      │     │     │ ◉
turn      │+    1│    +│    2│   (+=5, digit=x10)
rel    ▲▲ │ ▲▲  ▲│ ▲▲  │ ▲   │ ▲ (▲ = evidence released)
slope 0.27 D/turn overall (D 6→0); per movement: 1 0.25 │ 2 0.17 │ 3 0.40 │ 4 0.20 │ 5 0.50
```

## Act 1 (turns 1–4) — declared by the director
*[Rain frets at the shutters while the room gathers itself around an empty table, its candlelight thin and uneven. Outside, the fair's noise has gone distant, leaving only the question to wait in the air.]*

### Turn 1
*[Rain frets at the shutters while the room gathers itself around an empty table, its candlelight thin and uneven. Outside, the fair's noise has gone distant, leaving only the question to wait in the air.]*
  — *declares the movement: **Act 1** ([Rain frets at the shutters while the room gathers itself around an empty table, its candlelight thin and uneven. Outside, the fair's noise has gone distant, leaving only the question to wait in the air.])*
**Tutor:** Set the loud verdict outside the door, lad; in this room a shilling answers only to rule and mark. Before we ask whose hand, what must a struck false coin prove besides a town's anger?
  — move: erotema → — (orient)
**Learner:** The coin must prove two things under rule, Master: its blank — an alloy that answers to one crucible and no other — and its die-flaw, a mark that names one graving-tool alone. Without both chains complete, no hand can be written in the trial-book, however loud the town shouts Verrell's name.
  — hypothesis: Verrell struck the false shillings — he has prior offences, a graver, and access to a crucible — but this is ungrounded until alloy and die-flaw evidence is brought to the table.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[A clerk is shown in with the town's deposition, its seal still damp from the rain. The town has its founder ready: Verrell alone draws the mint-yard crucible, licensed to no one else since the old assay-master's day. Whatever metal is cast in Marrick, the town says, is cast by Verrell's hand.]*
  — *releases `m_caster`*
**Tutor:** A license names a bench as a trade-mark names a shop; it does not yet name the metal in this shilling. Set Verrell's mint crucible on one side of the table: what mark must the coin itself show before that paper can weigh anything?
  — move: exemplum → m_caster (counter_mirror)
**Learner:** The license proves only who may cast at that crucible, Master — not that this shilling's blank came from it. Before the paper weighs anything, the coin must show its alloy answers to metal melted at the mint crucible: we need both the alloy mark on the shilling and a record that the matching metal was melted there. Without those two facts, the chain breaks at Rule 1 and Verrell's license hangs in the air.
  — adopts `soleCasterAt mintCrucible verrell` · hypothesis: Verrell struck the false shillings — he has prior offences, a graver, sole casting rights at the mint crucible, and access to a crucible — but this is ungrounded until alloyOf and meltedAt facts are brought to the table, and die-flaw evidence besides.

### Turn 3
*[The clerk withdraws, leaving the damp paper on the table where the candle gutters beside it. Rain ticks in the silence, and the room waits with the accusation present but not yet heavier than the coin itself.]*
**Tutor:** The cupel gives its first answer: these shillings are no clipped sterling, but struck poor dross, silver eked with too much copper and a grey lead-sweat the touchstone catches. Clipping shaves a true coin; it does not make this struck blank. What does struck-not-clipped do to the town's easy case?
  — move: exemplum → p_alloy (release), releases `p_alloy`
**Learner:** Struck-not-clipped severs the town's easiest rope, Master: a clipper's two pillory-turns prove a different craft, not this one. The dross-silver alloy is now on my board, but Rule 1 still demands where that metal was melted before the crucible can be named. Without meltedAt, the blank's origin stays open; without die-flaw and tool, the die's maker is nameless still. I keep the clipping record as a grounded truth, but it no longer pulls the verdict.
  — adopts `alloyOf falseShilling drossSilver` · hypothesis: Verrell struck the false shillings — he holds sole casting rights at the mint crucible and the shilling's alloy is now identified as drossSilver — but the chain requires meltedAt drossSilver mintCrucible to ground the blank, and dieFlawOf / flawCutBy / soleHolderOf facts to ground the die, before either limb of Rule 5 can close.
  ⚑ **decay** — m_caster slips from the learner's board

### Turn 4
*[The rain slackens to a fine hiss along the shutters, and the candle steadies over the coin and the damp deposition. No one enters; the room holds its breath around the gap the cupel has opened.]*
**Tutor:** You say you keep a clipping record; read that cupel-mark back to me from your board, exactly as you hold it. Did the assay give you a record of clipping, or did it open another craft entirely?
  — move: erotema → p_alloy (confront)
**Learner:** Master, I read it wrong: board entry 2 is 'clipperOf verrell marrick' — Verrell's prior record, not any mark on this coin. The cupel gave me 'struckNotClipped falseShilling,' which names striking as the craft that made this blank, a trade apart from clipping. A clipper's two pillory-turns speak to one skill; this shilling's blank required another. Verrell's prior record now cuts the other way — his named craft is not the craft that made this coin.
  — hypothesis: Verrell struck the false shillings — he holds sole casting rights at the mint crucible and a graver on his bench — but his known craft is clipping, not striking; the chain still requires meltedAt drossSilver mintCrucible and dieFlawOf / flawCutBy / soleHolderOf to close either limb of Rule 5, and his prior record no longer lends weight.
  ⚑ **decay** — p_alloy slips from the learner's board

## Act 2 (turns 5–10) — declared by the director
*[The rain thins, and the table is cleared to its colder objects: scale, coal-dust, sealed ledgers, and the coin under glass. The room narrows from public noise to metal, custody, and the chill patience of a chain not yet joined.]*

### Turn 5
*[The rain thins, and the table is cleared to its colder objects: scale, coal-dust, sealed ledgers, and the coin under glass. The room narrows from public noise to metal, custody, and the chill patience of a chain not yet joined.]*
  — *declares the movement: **Act 2** ([The rain thins, and the table is cleared to its colder objects: scale, coal-dust, sealed ledgers, and the coin under glass. The room narrows from public noise to metal, custody, and the chill patience of a chain not yet joined.])*
  — *calls the act closed*
**Tutor:** Then set the board straight before the scale moves: the cupel did not give a clipping record at all. It gave struck poor dross, silver thinned with copper and lead-sweat, a blank made for striking rather than a true coin shaved down. From that mark, what does Rule 1 still lack before any crucible may be written?
  — move: exemplum → p_alloy (restore)
**Learner:** Rule 1 holds alloyOf falseShilling drossSilver — one limb is in hand. But the second limb, meltedAt drossSilver <some crucible>, is nowhere on the table yet; without it, no crucible may be written for the blank. The alloy names a metal; only a leavings-match to a specific crucible names its source. Until that fact arrives, the blank's origin is open, and Verrell's crucible is still only a rumour in the room.
  — hypothesis: Verrell struck the false shillings — sole casting rights at the mint crucible and a graver on his bench — but the chain still requires meltedAt drossSilver <crucible> to name the blank's source, and dieFlawOf / flawCutBy / soleHolderOf to ground the die; neither limb of Rule 5 can close without those facts.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 5, justified 0, drift 0; arc on_arc
  ⚑ **repair** — p_alloy restored by the tutor

### Turn 6
*[A guild warden is shown in with bench-notes damp at the edges, and the town's case is read aloud: And Verrell engraves: the broad graver on his bench is his alone, the guild will swear, and no clean-cut die in the borough is sunk without it. A caster and an engraver both — the town needs no more than that.]*
  — *releases `m_graver`*
**Tutor:** Set the broad graver beside the mint crucible: both are town papers naming Verrell's bench, not yet marks read from this coin. If the guild swears the tool is his, what must the shilling itself show before that oath can enter Rule 3?
  — move: erotema → m_graver (consolidate)
**Learner:** The guild oath names the hand that held the tool — soleHolderOf, Rule 4's second limb. But Rule 3 opens on the coin itself: the shilling must bear a die-flaw of its own, and that flaw must be shown to have been cut by the broad graver specifically. Without dieFlawOf on the coin and flawCutBy linking that flaw to the broad graver, the oath waits at the door — Rule 3 has no first limb to receive it.
  — adopts `soleHolderOf broadGraver verrell` · hypothesis: Verrell struck the false shillings — sole casting rights at the mint crucible and sole holder of the broad graver — but the chain still requires meltedAt drossSilver <crucible> to name the blank's source, and dieFlawOf falseShilling <flaw> plus flawCutBy <flaw> broadGraver to ground the die; neither limb of Rule 5 can close without those facts from the coin itself.

### Turn 7
*[The clerk lays a dry cloth beneath the glass and says nothing; the coin catches the window's grey light, then loses it as the clouds close again. Around the table, the papers remain separate piles, each waiting for a mark that can bear its weight.]*
**Tutor:** Now the founder's man brings the leavings: that lead-sweat answers to one crucible on this coast, the weir-forge crucible above the mill-leat, cold these ten years since the old founder died. A coin's blank betrays its melt as a loaf betrays its flour; set dross-silver beside weir-crucible and read Rule 1. What may be written now, and what still may not?
  — move: exemplum → p_crucible (release), releases `p_crucible`
**Learner:** Rule 1 now closes: alloy answers to crucible, and I may write blankFrom falseShilling weirCrucible. But Rule 2 waits — soleCasterAt weirCrucible is nowhere on the table; the weir-forge is cold ten years and its caster unnamed. The die chain has no first limb either — no flaw has yet been read from the coin's face. Two gaps hold the chain open: who cast at the weir-forge, and what mark, if any, the shilling wears.
  — adopts `meltedAt drossSilver weirCrucible` · derives `blankFrom falseShilling weirCrucible` · hypothesis: Verrell struck the false shillings — sole holder of the broad graver — but the chain now requires soleCasterAt weirCrucible ?x to close the blank limb via Rule 2, and dieFlawOf falseShilling <flaw> plus flawCutBy <flaw> broadGraver to close the die limb via Rules 3–4; neither limb of Rule 5 can close without those facts.
  ⚑ **decay** — p_alloy slips from the learner's board

### Turn 8
*[The room holds its breath around the cold name of the forge; rainwater ticks from a cloak hem onto the boards, and the clerk's pen hovers without touching the page. The coin under glass remains between the two unfinished piles, bright enough to accuse and too mute to finish the accusation.]*
**Tutor:** Before the book builds one line on the last exhibit, read that exhibit back to me from your own board. What did it prove, and what did it leave unproved? Give me the rule-limbs, not the verdict.
  — move: erotema → p_crucible (confront)
  — *the second voice [unconfronted reentry]: "Confront p_crucible first: ask the learner to read back what they hold of that exhibit before you consolidate it." (draft anaphora → erotema)*
**Learner:** Board index 5 — meltedAt drossSilver weirCrucible — gave Rule 1 its second limb: alloy of coin answers to a metal, metal answers to crucible, so blankFrom falseShilling weirCrucible follows and is already on the record. What it left unproved: Rule 2's second limb — soleCasterAt weirCrucible remains empty, so castBlankFor cannot be written. The die chain has no foothold at all — dieFlawOf falseShilling is unread, so Rules 3 and 4 cannot open, and cutDieFor stays dark. Rule 5 therefore has neither limb to receive.
  — hypothesis: Verrell struck the false shillings — sole holder of the broad graver — but the chain now requires soleCasterAt weirCrucible ?x to close the blank limb via Rule 2, and dieFlawOf falseShilling <flaw> plus flawCutBy <flaw> broadGraver to close the die limb via Rules 3–4; neither limb of Rule 5 can close without those facts.

### Turn 9
*[The clerk sands the last wet line and shuts the ledger for a moment, leaving its ribbon between the pages. Beyond the shutter the fair noise has thinned to wheels in mud, while inside the coin and the cold forge-name sit apart under the same grey light.]*
**Tutor:** Good: the alloy is shown, the weir crucible is shown, and the caster is still an empty square. If the blank came from that cold cupel, what single custody-mark must the ledger give before Rule 2 may write a hand? Keep the die pile untouched; a cast blank is not yet a struck coin.
  — move: anaphora → p_crucible (consolidate)
**Learner:** The single mark the ledger needs is soleCasterAt weirCrucible — one name bound to that cold cupel as its sole caster. blankFrom falseShilling weirCrucible already sits on the record; Rule 2 holds its first limb and waits. Until a hand is named at the weir-forge, the blank chain cannot close and castBlankFor cannot be written. The die pile I leave untouched, as instructed.
  — hypothesis: Verrell struck the false shillings — sole holder of the broad graver — but the chain now requires soleCasterAt weirCrucible ?x to close the blank limb via Rule 2, and dieFlawOf falseShilling <flaw> plus flawCutBy <flaw> broadGraver to close the die limb via Rules 3–4; neither limb of Rule 5 can close without those facts.

### Turn 10
*[The leat-keeper is shown in with a narrow oilskin book, its pages warped but its entries clear, and the clerk reads it aloud for the whole room: "The leat-keeper's book is exact. Since the forge was shut, one hand alone has drawn the weir crucible and signed for its charcoal: Edony, the founder's widow, who stayed on in the forge cottage when the fires went out."]*
  — *releases `p_caster`*
**Tutor:** The leat-book sets one hand to the weir crucible as a seal sets one face to wax; now lay it beside blankFrom and read Rule 2 without borrowing a word from the crowd. What may the trial-book write about the blank, and what can it still not write about the coin? Leave the glass turned to its face: a blank, however proved, has not yet named the die that struck it.
  — move: exemplum → p_caster (stage_recognition)
**Learner:** Rule 2's two limbs are met: blankFrom falseShilling weirCrucible stands on the record, and the leat-book gives soleCasterAt weirCrucible edony — castBlankFor falseShilling edony is written. The blank chain closes to Edony's hand, not Verrell's; the old hypothesis frays at its root. The die chain has no foothold still — dieFlawOf falseShilling has never been read, so cutDieFor stays dark and Rule 5 cannot close.
  — adopts `soleCasterAt weirCrucible edony` · hypothesis: Edony struck the false shillings — the blank chain closes to her hand; Rule 5 would name her the striker if the die chain also closes to her via dieFlawOf falseShilling <flaw>, flawCutBy <flaw> <tool>, and soleHolderOf <tool> edony. The prior hypothesis pointing to Verrell cannot close Rule 5: castBlankFor now belongs to Edony, not him.
  ⚑ **overreach** — castBlankFor falseShilling edony

## Act 3 (turns 11–15) — declared by the director
*[The oilskin book is wrapped again and taken from the table, leaving an empty space where its weight had pressed the damp cloth flat. The coin remains under glass, its pale face catching a harder light as the room gathers itself for a question no ledger has yet answered.]*

### Turn 11
*[The oilskin book is wrapped again and taken from the table, leaving an empty space where its weight had pressed the damp cloth flat. The coin remains under glass, its pale face catching a harder light as the room gathers itself for a question no ledger has yet answered.]*
  — *declares the movement: **Act 3** ([The oilskin book is wrapped again and taken from the table, leaving an empty space where its weight had pressed the damp cloth flat. The coin remains under glass, its pale face catching a harder light as the room gathers itself for a question no ledger has yet answered.])*
  — *calls the act closed*
**Tutor:** The book is gone; do not let its weight become the verdict. Read back the blank finding from your own board, then name the one rule-limb still empty before any striking can be entered. What must the coin's face give that the ledger never could?
  — move: erotema → p_caster (confront)
**Learner:** My board has shed alloyOf falseShilling drossSilver between acts — the turn-three record named drossSilver as the shilling's alloy, yet the entry is gone; I ask it be restored. If it stands, Rules 1 and 2 close the blank chain to Edony's hand. The one limb still dark is the die: only the coin's own face can yield dieFlawOf, and no ledger ever cut a die.
  — hypothesis: alloyOf falseShilling drossSilver was grounded in Act 1 but has slipped from my board; if restored, Rules 1–2 yield blankFrom falseShilling weirCrucible then castBlankFor falseShilling edony — leaving only the die chain (dieFlawOf falseShilling <flaw>, flawCutBy <flaw> <tool>, soleHolderOf <tool> ?x) to close Rule 5 and settle the striker.
  ⚑ **act_end** — act 2 closed (director) after 6 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 12
*[The watch-captain is called from the back of the room, rain still bright on his cloak, and his oath is taken before the bench: "The watch will swear to the rest: Verrell was seen at the mint-yard forge twice in fair-week, late and with the shutters drawn. Caster, engraver, and at the fire on the very nights — the town's case stands, and stands loud."]*
  — *releases `m_caught`*
**Tutor:** Restore the missing cupel-mark first: these shillings are no clipped sterling, but struck poor dross, silver thinned with too much copper and a grey lead-sweat the touchstone catches. Clipping shaves a true coin; this mark names a blank made for striking. Set alloyOf falseShilling drossSilver back on your board, then let the watchman's loud oath wait until the coin's own face supplies the next rule-limb.
  — move: exemplum → p_alloy (restore)
**Learner:** The alloyOf entry stands on my board already; Rules 1 and 2 chain cleanly — alloy names drossSilver, melt names weirCrucible, sole-caster names Edony, and castBlankFor falseShilling edony is now derived. The watchman's oath is loud and feeds nothing: seenAtForge names where Verrell stood, not what flaw the coin's own face carries. I leave that exhibit on the table. The die limb is still dark — only dieFlawOf falseShilling <flaw> and flawCutBy <flaw> <tool> can open Rule 3, and no ledger, no cloak, and no oath has yet supplied them.
  — derives `castBlankFor falseShilling edony` · hypothesis: For Rule 5 to name a striker, the die chain must also close to Edony's hand — if dieFlawOf traces to broadGraver (sole-held by Verrell), then castBlankFor and cutDieFor land in different hands and Rule 5 cannot fire; only a tool held by Edony could unite both limbs in one hand.
  ⚑ **repair** — p_alloy restored by the tutor
  ⚑ **decay** — m_graver slips from the learner's board

### Turn 13
*[The watch-captain's oath is written down and left unsealed, its ink darkening slowly in the damp air. Under the glass, the coin lies face-up while the room holds its breath around the mark no one has yet read.]*
**Tutor:** Then bring the glass to the coin's face: a dozen light shillings share one fault to the hair, a broken R in the legend, its serif struck with a small square notch where the graver slipped and was never mended. As one cracked seal leaves one wound in every wax it touches, that shared notch says one die struck them all. Set dieFlawOf falseShilling notchedSerif on your board: what does Rule 3 have now, and what tool-mark must still be proved before any hand may enter?
  — move: exemplum → p_flaw (release), releases `p_flaw`
**Learner:** The notched serif enters my board — Rule 3 now holds its first limb. But one premise still wants grounding: flawCutBy notchedSerif must name the tool before Rule 3 can yield dieCutWith, and soleHolderOf that tool before Rule 4 can yield cutDieFor. The watchman's sight of Verrell at the forge stays off my board — no rule runs on where a man stood.
  — adopts `dieFlawOf falseShilling notchedSerif` · hypothesis: The notchedSerif flaw will trace to a specific tool via flawCutBy; if soleHolderOf that tool is Edony, Rule 5 closes to her hand; if it is Verrell, the two limbs split across different hands and Rule 5 cannot fire.

### Turn 14
*[The glass is not lifted; the coin remains pinned beneath it while the candle gutters and steadies. Rain ticks against the shutters, and the bench waits in the pause between a mark seen and a hand named.]*
**Tutor:** Before the rule builds on that mark, read the coin-face exhibit back from your own board. What did the glass give you, and what did it leave still unnamed? Give me the rule-limbs, not the hand.
  — move: erotema → p_flaw (confront)
  — *the second voice [unconfronted reentry]: "Confront p_flaw first: ask the learner to read back what they hold of that exhibit before you build on it again." (draft anaphora → erotema)*
**Learner:** The glass gave me one thing: dieFlawOf falseShilling notchedSerif — a broken R, its serif struck with one square notch, shared by every coin under examination. Rule 3 holds its left limb there and waits. What it still wants is flawCutBy notchedSerif naming the tool, and after that Rule 4 wants soleHolderOf that tool naming the hand. The watchman's oath fills neither socket — seenAtForge tells where a man stood, not which graver cut the notch.
  — hypothesis: The notchedSerif flaw will trace via flawCutBy to a specific tool; if soleHolderOf that tool is Edony, Rule 5 unites both limbs in her hand and the verdict is hers; if it is Verrell, the two limbs split across different hands and Rule 5 cannot fire.

### Turn 15
*[The room narrows to the coin, the glass, and the silence around the unfilled place in the rule. Outside, the rain slackens for a moment, leaving the shutters still and the waiting sharper.]*
**Tutor:** The notch is on the coin, not yet in any man's drawer. If Rule 3 holds dieFlawOf and still lacks flawCutBy, what must the next witness prove about that square bite before any bench-oath may weigh?
  — move: erotema → p_flaw (consolidate)
**Learner:** The next witness must prove flawCutBy notchedSerif naming one tool — show that this square bite is the sole signature of one graver, no other. Only then does Rule 3 yield dieCutWith, and only then can Rule 4 reach for the hand. Presence at a forge in fair week is where a man stood, not what iron cut the notch.
  — hypothesis: The notchedSerif flaw will trace via flawCutBy to a specific tool; if soleHolderOf that tool is Edony, Rule 5 unites both limbs in her hand and the verdict is hers; if it is Verrell, the two limbs split across different hands and Rule 5 cannot fire.

## Act 4 (turns 16–20) — declared by the director
*[The coin is covered, and the room loosens from its hard stare into a colder expectancy. A drawer somewhere beyond the chamber is heard to close, and the next act gathers around instruments, custody, and the narrowing cost of naming a hand.]*

### Turn 16
*[The coin is covered, and the room loosens from its hard stare into a colder expectancy. A drawer somewhere beyond the chamber is heard to close, and the next act gathers around instruments, custody, and the narrowing cost of naming a hand.]*
  — *declares the movement: **Act 4** ([The coin is covered, and the room loosens from its hard stare into a colder expectancy. A drawer somewhere beyond the chamber is heard to close, and the next act gathers around instruments, custody, and the narrowing cost of naming a hand.])*
  — *calls the act closed*
**Tutor:** The coin is covered, the drawer is shut, and the custody paper still waits outside the rule. Read the coin-face mark from your own board before any tool is named: what limb did it fill, and what limb does it leave empty?
  — move: anaphora → p_flaw (confront)
  — *the second voice [figure rut]: "Leave off erotema here; confront the coin-face read-back in another device before the drawer opens." (draft erotema → anaphora)*
**Learner:** The coin-face mark, dieFlawOf falseShilling notchedSerif, fills Rule 3's first premise — the flaw is named and on my board. Yet without flawCutBy notchedSerif ?tool, the chain cannot advance a single step further, and the die limb stands empty. The blank limb, by contrast, closes fully: alloyOf + meltedAt yield blankFrom, and soleCasterAt weirCrucible edony yields castBlankFor falseShilling edony. One limb is filled; the die limb wants only flawCutBy to open its chain.
  — hypothesis: The notchedSerif flaw will trace via flawCutBy to a specific tool; if soleHolderOf that tool is Edony, Rule 5 unites both limbs in her hand and the verdict is hers; if it is Verrell, the two limbs split across different hands and Rule 5 cannot fire.
  ⚑ **act_end** — act 3 closed (director) after 5 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 17
*[The covered coin lies between them like a stopped clock, its small weight seeming to darken the table. No paper is opened; no drawer is touched, and the chamber holds itself against the next name.]*
**Tutor:** Call the guild die-sinker to the glass: he reads that square notch as no burnisher's slip, but the bite of a worn burin with a sprung heel, a tool that signs each line it cuts so; it is not Verrell's broad graver, which cuts clean. As a cracked punch leaves its own corner in every struck seal, this notch names the iron before it names a hand. Set flawCutBy notchedSerif wornBurin beside your coin-face mark: what may Rule 3 write now, and what does Rule 4 still lack?
  — move: exemplum → p_graver (release), releases `p_graver`
**Learner:** Rule 3 fires at once: dieFlawOf falseShilling notchedSerif joined with flawCutBy notchedSerif wornBurin yields dieCutWith falseShilling wornBurin — I enter it on the derives. The blank limb already closes to Edony through Rules 1 and 2; the die limb now names wornBurin as the cutting tool. Rule 4 waits only for soleHolderOf wornBurin ?x — that single fact will either unite the two chains in one hand or leave them split. The die-sinker's word that it is not Verrell's broad graver is notable, but the rule will not close without a name on the burin.
  — adopts `flawCutBy notchedSerif wornBurin` · derives `dieCutWith falseShilling wornBurin` · hypothesis: The die chain now traces to wornBurin; soleHolderOf wornBurin ?x is the last missing fact needed to close Rule 4 and then Rule 5; the die-sinker's exclusion of Verrell's broad graver as the cutting tool makes Verrell an unlikely holder of the wornBurin, but no rule closes without a named sole-holder on the board.

### Turn 18
*[The lamp gutters once and steadies, throwing the covered coin, the closed drawer, and the waiting inkstand into one narrow line of shadow. No witness is called; the room seems to listen for the difference between a tool named and a hand named.]*
**Tutor:** Before Rule 4 takes even one step, read back the die-sinker's exhibit from your own board. What did that witness prove, and what did it leave unproved? Give me the rule-limbs, not the hand.
  — move: erotema → p_graver (confront)
  — *the second voice [unconfronted reentry]: "Confront first: make the learner read back what they hold of p_graver before you use it again. Do not restate the exhibit for them." (figure held)*
**Learner:** The die-sinker proved Rule 3's two premises: dieFlawOf falseShilling notchedSerif and flawCutBy notchedSerif wornBurin together yield dieCutWith falseShilling wornBurin — that limb is filled. He left Rule 4's second premise entirely open: soleHolderOf wornBurin ?x was never spoken, and without it Rule 4 cannot write cutDieFor falseShilling ?x. The exclusion of Verrell's broad graver names the tool but names no hand upon it — naming a tool is not naming its holder.
  — hypothesis: The die chain now traces to wornBurin; soleHolderOf wornBurin ?x is the last missing fact needed to close Rule 4 and then Rule 5; the die-sinker's exclusion of Verrell's broad graver as the cutting tool makes Verrell an unlikely holder of the wornBurin, but no rule closes without a named sole-holder on the board.

### Turn 19
*[The ink at the tutor's elbow dries to a dull skin while no one reaches for it. Beyond the door, a floorboard gives one careful creak and is still, leaving the covered coin and the unnamed hand to share the silence.]*
**Tutor:** The notch has named the iron, and the iron has not yet named its keeper. If dieCutWith falseShilling wornBurin now stands, what single custody-mark must Rule 4 receive before the die can be set in any hand? Keep the blank aside; a named tool is still not a striker.
  — move: erotema → p_graver (consolidate)
**Learner:** Rule 4 holds dieCutWith falseShilling wornBurin already on the record — its first limb is filled. The one custody-mark it still requires is soleHolderOf wornBurin ?x: a single attestation that one hand and no other held that worn burin. Without that entry no name can cross from tool to cutter, and the die chain ends at iron rather than flesh. That is the entire gap between a named instrument and a named hand.
  — hypothesis: The die chain now traces to wornBurin; soleHolderOf wornBurin ?x is the last missing fact needed to close Rule 4 and then Rule 5; the die-sinker's exclusion of Verrell's broad graver as the cutting tool makes Verrell an unlikely holder of the wornBurin, but no rule closes without a named sole-holder on the board.

### Turn 20
*[The covered coin remains where it lies, its shape just visible beneath the cloth as the room's breath shortens around it. A clerk sharpens a pen and then sets the knife down unused, leaving the question of custody hanging in the scrape's wake.]*
**Tutor:** Before we set any custody socket beside the tool, read the die-sinker's exhibit back from your own board. What did it put into Rule 3, and what did it leave outside Rule 4? Give me the limbs only, not the keeper.
  — move: erotema → p_graver (confront)
  — *the second voice [unconfronted reentry]: "Leave off erotema, and confront p_graver first: require the learner to read back what they hold of that exhibit before you test it again." (figure held)*
**Learner:** The die-sinker's exhibit fed both limbs of Rule 3: dieFlawOf falseShilling notchedSerif as the first, flawCutBy notchedSerif wornBurin as the second — together they yield dieCutWith falseShilling wornBurin, already voiced. Outside Rule 4 it left one limb entirely untouched: soleHolderOf wornBurin ?x was never spoken by any witness. Rule 4's first limb is filled by the derived fact; its second limb — sole custody of the iron — stands empty, and without it no name crosses from tool to cutter.
  — hypothesis: The die chain now traces to wornBurin; soleHolderOf wornBurin ?x is the last missing fact needed to close Rule 4 and then Rule 5; the die-sinker's exclusion of Verrell's broad graver as the cutting tool makes Verrell an unlikely holder of the wornBurin, but no rule closes without a named sole-holder on the board.

## Act 5 (turns 21–22) — declared by the director
*[The cloth over the coin is lifted and folded away, though no hand yet touches what it had covered. The chamber empties of its murmurs, and the next act begins under a narrower light, with every pause carrying the weight of a name not yet permitted to enter.]*

### Turn 21
*[The cloth over the coin is lifted and folded away, though no hand yet touches what it had covered. The chamber empties of its murmurs, and the next act begins under a narrower light, with every pause carrying the weight of a name not yet permitted to enter.]*
  — *declares the movement: **Act 5** ([The cloth over the coin is lifted and folded away, though no hand yet touches what it had covered. The chamber empties of its murmurs, and the next act begins under a narrower light, with every pause carrying the weight of a name not yet permitted to enter.])*
  — *calls the act closed*
**Tutor:** The cloth is lifted, but the hand is not yet in the book. From your own board, read back the last tool-witness in limbs only: Rule 3's intake, Rule 3's writing, Rule 4's empty custody socket. No keeper, no striker.
  — move: anaphora → p_graver (confront)
  — *the second voice [figure rut]: "Leave off erotema here; do not make the learner answer another question-shaped turn." (draft erotema → anaphora)*
**Learner:** The board yields three conclusions under the rules: blank from weirCrucible, cast by Edony's hand, and die cut with the wornBurin — but Rule 4's socket stays empty, no sole-holder named for that tool. I write what the rules will give me and leave the striker's line blank until the custody witness speaks.
  — hypothesis: soleHolderOf wornBurin is still unwitnessed; if that holder proves to be Edony, Rule 4 yields cutDieFor falseShilling edony and Rule 5 unites both limbs in her hand — but no fact on my board names that holder yet.
  ⚑ **act_end** — act 4 closed (director) after 5 turns
  ⚑ **plot** — act 5 plot committed
  ⚑ **plot_audit** — act 4 plot audited: kept 5, justified 0, drift 0; arc on_arc

### Turn 22
*[The old founder's tools were never sold off. The inventory of his estate, sworn and unredeemed, leaves his graving-irons to his widow alone — among them the worn burin with the sprung heel, kept in Edony's keeping these ten years.]*
  — *releases `p_holder`*
**Tutor:** The inventory has named the keeper of the worn burin; lay that custody mark beside dieCutWith falseShilling wornBurin and read Rule 4 before you touch Rule 5. The blank is shown, the die is shown, and the same hand? What may be written about the die now, and what must still be joined before the striker's line can take ink?
  — move: anaphora → p_holder (consolidate)
**Learner:** The inventory names Edony sole keeper of the worn burin — Rule 4's socket is filled at last. The die chain closes: dieCutWith falseShilling wornBurin, and soleHolderOf wornBurin edony, gives cutDieFor falseShilling edony. Both limbs of Rule 5 now land in one hand — the blank cast by Edony, the die cut by Edony. I write the striker's name: Edony.
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
  - Act 1 (turns 1–4): 0.25 D/turn (ΔD 1)
  - Act 2 (turns 5–10): 0.167 D/turn (ΔD 1)
  - Act 3 (turns 11–15): 0.4 D/turn (ΔD 2)
  - Act 4 (turns 16–20): 0.2 D/turn (ΔD 1)
  - Act 5 (turns 21–22): 0.5 D/turn (ΔD 1)
- **plateau** longest flat stretch 4 turns (aporia window 6)
- **releases** 5/9 on cue · 4 deviated
- **decay** 4 slips (seed 1 · rate 0.75 · grace 1) · repaired 2 (tutor 2, re-adoption 0) · mean repair latency 3 turns · unrepaired at end 2 · degraded-turn integral 35 · D reversals 1
- **theory fidelity** F 0.769 at end · min 0.727
  - m_caster t3 (never repaired) · p_alloy t4→t5 (tutor) · p_alloy t7→t12 (tutor) · m_graver t12 (never repaired)
- **events** plot×5 · throughline×1 · decay×4 · act_end×4 · plot_audit×5 · repair×2 · overreach×1 · forced×1 · grounded_anagnorisis×1
- **staging** 5 movements declared by the director
- **acts** 5 played · closed by the director 4 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–10 (director) · Act 3 t11–15 (director) · Act 4 t16–20 (director) · Act 5 t21–22 (run end)
- **plot** 5 committed · withhold+friction on 5/5 · 5.8 clauses avg · audits 5 (incl. final act): kept 28 / justified 0 / drift 0 · hold-named exhibits staged in act 1/4
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 5: on 5 / off 0 · run-end reckoning 7 clauses: kept 6 / justified 0 / drift 1
- **release authority** 4 played: 0 on schedule · 0 held · 4 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_alloy -1 (t3): "Played one turn early because the learner has already separated Verrell's license from the coin's own marks, so the assay can begin without contaminating the verdict."
  - p_crucible -1 (t7): "Played one turn early because the learner has named meltedAt as the exact missing Rule 1 conjunct and the board is ready."
  - p_flaw -1 (t13): "Played one turn early because the learner has explicitly named dieFlawOf as the next coin-face gap, and the watch oath is already quarantined as noise."
  - p_graver -1 (t17): "Played one turn early because the learner has steadied p_flaw and is explicitly holding the flawCutBy gap open."
- **confrontation** 8 demanded (1 against a slipped exhibit) · re-entries 3: covered 3, uncovered 0 · watcher fires 4 (became the confrontation 4) · fires without recorded due 0
  - **repair clause** restores 2 (2 repaired a real slip) · watcher fires on restore claims 0: p_alloy t5 · p_alloy t12
- **figures** erotema 10/22 (46%) · 3 distinct · switch rate 0.71
- **superego** intervened 6/22 watched turns · figure changed within-turn on 4/6 interventions · switch on intervention 0.83 vs elsewhere 0.67
- **inference** 4 voiced · stall integral 0 · overreach 1 · mischanneled 0 — `blankFrom falseShilling weirCrucible` available t7 → voiced t7 (latency 0) · `castBlankFor falseShilling edony` available t12 → voiced t12 (latency 0) · `dieCutWith falseShilling wornBurin` available t17 → voiced t17 (latency 0) · `cutDieFor falseShilling edony` available t22 → voiced t22 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 22 | 3.05 | 4 | 44.7 |
| tutor | 22 | 2.73 | 3 | 50.5 |
| learner | 22 | 3.73 | 5 | 71.7 |
