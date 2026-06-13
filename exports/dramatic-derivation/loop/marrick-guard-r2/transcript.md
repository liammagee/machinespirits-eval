# The Light Shillings — marrick-guard-r2

> world `world_005_marrick` · verdict **grounded_anagnorisis** · 22/28 turns
> S forced at turn 22; asserted grounded at turn 22

```
D= 6 ●●·│·●●····│····│·······│·
D= 5   ●│●  ●●··│····│·······│·
D= 4    │     ●·│····│·······│·
D= 3    │      ●│●●··│·······│·
D= 2    │       │  ●●│●●·····│·
D= 1    │       │    │  ●●●●●│·
D= 0    │       │    │       │◉
turn     │ +    1│    │+    2 │  (+=5, digit=x10)
rel    ▲▲│  ▲▲  ▲│ ▲▲ │  ▲    │▲ (▲ = evidence released)
slope 0.27 D/turn overall (D 6→0); per movement: 1 0.33 │ 2 0.29 │ 3 0.25 │ 4 0.14 │ 5 1.00
```

## Act 1 (turns 1–3) — declared by the director
*[Rain rattles against the Marrick hall windows while the room gathers around a table left bare for testimony. Beyond the doors, the fair's noise thins into mutters, and the question of the light shillings hangs like damp wool in the air.]*

### Turn 1
*[Rain rattles against the Marrick hall windows while the room gathers around a table left bare for testimony. Beyond the doors, the fair's noise thins into mutters, and the question of the light shillings hangs like damp wool in the air.]*
  — *declares the movement: **Act 1** ([Rain rattles against the Marrick hall windows while the room gathers around a table left bare for testimony. Beyond the doors, the fair's noise thins into mutters, and the question of the light shillings hangs like damp wool in the air.])*
**Tutor:** Set the town's wanting outside the door for now, lad. Before a name can enter this book, what must the coin itself be made to testify: metal, die, or hand?
  — move: erotema → — (orient)
**Learner:** Metal first, master — the alloy names the crucible, and the crucible names the caster of the blank. Then the die-flaw names the graving-tool, and the tool names who cut the die. Only when both paths meet in one hand may I write the striker's name. Until metal and die have each spoken, no name belongs in this book.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[A town clerk is shown in with a rain-spotted paper and reads it before the bare table: "The town has its founder ready: Verrell alone draws the mint-yard crucible, licensed to no one else since the old assay-master's day. Whatever metal is cast in Marrick, the town says, is cast by Verrell's hand."]*
  — *releases `m_caster`*
**Tutor:** Good: the town has named a crucible and a hand, but the coin has not yet named its metal. What mark from the shillings themselves would put them in Verrell's mint-yard crucible, rather than only in the town clerk's mouth?
  — move: erotema → m_caster (counter_mirror)
**Learner:** The clerk names Verrell sole caster, and I enter that on the board — but the shilling's alloy has not yet named the crucible it came from. Rule one demands the coin's own metal answer to a specific crucible's leavings before any blank can be placed there. Without a touchstone reading of this coin's alloy, the mint crucible appears in the record only as the town's voice, not the metal's. What test names the alloy first, master — the touchstone, or the acid-needle?
  — adopts `soleCasterAt mintCrucible verrell` · hypothesis: The false shillings' alloy may match the leavings of the mint crucible — which would ground blankFrom falseShilling mintCrucible — but this awaits the coin's own testimony under assay.

### Turn 3
*[The rain slackens to a fine ticking on the high panes, and the clerk's paper lies drying at the table's edge. No new witness enters; the room waits on the coin itself, while the fair outside stirs and falls quiet again.]*
**Tutor:** The cupel has had its say: these light shillings are not clipped sterling, but struck poor dross, silver eked with copper and a grey lead-sweat the touchstone catches. Clipping shaves a true coin; it does not strike a new one. Now, what has the metal proved, and what has it not yet proved about a crucible?
  — move: exemplum → p_alloy (release), releases `p_alloy`
**Learner:** The metal has spoken its nature — dross silver, struck not clipped, which we already held. Now Rule One wants one thing more: that this very dross answers to the leavings of a named crucible. The alloy is in the record, master, but meltedAt drossSilver mintCrucible has not yet been shown — the assay of crucible residue must come next before the blank can be placed anywhere.
  — adopts `alloyOf falseShilling drossSilver` · hypothesis: The drossSilver alloy of the false shilling may match the residue leavings of the mint crucible — which would establish meltedAt drossSilver mintCrucible and thereby ground blankFrom falseShilling mintCrucible under Rule 1 — but no crucible-residue comparison has yet been performed.
  ⚑ **decay** — m_caster slips from the learner's board

## Act 2 (turns 4–10) — declared by the director
*[The bare table is wiped clean, yet the room feels more crowded than before. A brazier is brought nearer against the wet cold, and its dull heat turns every waiting face toward the next question in the chain.]*

### Turn 4
*[The bare table is wiped clean, yet the room feels more crowded than before. A brazier is brought nearer against the wet cold, and its dull heat turns every waiting face toward the next question in the chain.]*
  — *declares the movement: **Act 2** ([The bare table is wiped clean, yet the room feels more crowded than before. A brazier is brought nearer against the wet cold, and its dull heat turns every waiting face toward the next question in the chain.])*
  — *calls the act closed*
**Tutor:** Before we set any leavings beside the coin, read back only what the cupel has already put on your board. What kind of proof has it given, and what gap still keeps any crucible from being entered in the book?
  — move: erotema → p_alloy (confront)
**Learner:** The cupel has named the metal — drossSilver — and nothing more; that is all the coin has yet spoken. To enter any crucible in the book I need a meltedAt fact: that drossSilver answers to the leavings of some one crucible. No residue comparison has been laid before us, so the gap between the alloy and any crucible stays open. Until that comparison is made and entered, Rule 1 cannot fire.
  — hypothesis: The drossSilver alloy of the false shilling may match the residue leavings of some specific crucible — which would establish meltedAt drossSilver [thatCrucible] and thereby ground blankFrom falseShilling [thatCrucible] under Rule 1 — but no crucible-residue comparison has yet been performed or exhibited.
  ⚑ **act_end** — act 1 closed (director) after 3 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 4, justified 1, drift 0; arc on_arc
  ⚑ **decay** — p_alloy slips from the learner's board

### Turn 5
*[The brazier gives a low pop, and a servant turns the cupel dish so its dull stain catches what little light remains. Beyond the shuttered room the fair sounds thin and far away, as if the town itself were holding its breath.]*
**Tutor:** Then keep the clerk's paper at the margin, where hearsay belongs until metal answers it. If Rule One has alloy in one scale and no residue match in the other, what exactly can the town's named caster weigh for us yet?
  — move: erotema → — (test)
**Learner:** The town's named caster weighs nothing on either scale yet. Verrell enters my board only as a clipper, and the coin before us is struck — not clipped — so his known hand speaks to a different offense entirely. Even were he established as a caster at some crucible, Rule 2 still needs blankFrom first, and blankFrom must wait on meltedAt, which waits on a residue comparison no exhibit has yet supplied. Until the leavings are laid beside the alloy, Verrell is the town's suspicion only — no chain of rules reaches him.
  — hypothesis: The drossSilver alloy of the false shilling may match the residue leavings of some specific crucible — which would establish meltedAt drossSilver [thatCrucible] and thereby ground blankFrom falseShilling [thatCrucible] under Rule 1 — but no crucible-residue comparison has yet been performed or exhibited.

### Turn 6
*[A guildman is shown in with a bench-list damp at the edges, and the clerk reads it into the room: "And Verrell engraves: the broad graver on his bench is his alone, the guild will swear, and no clean-cut die in the borough is sunk without it. A caster and an engraver both — the town needs no more than that."]*
  — *releases `m_graver`*
**Tutor:** The bench-list proves Verrell has a broad graver; it proves the town can name an engraver; it does not prove this coin's die has borne that tool's mark. Keep it beside the cupel: a loud second half of the town's case, not yet the coin's own flaw.
  — move: anaphora → m_graver (counter_mirror)
  — *the second voice [figure rut]: "Leave off erotema for this turn. Break the question pattern and make the move in another figure before speaking." (draft erotema → anaphora)*
**Learner:** The bench-list is guild oath — I adopt soleHolderOf broadGraver verrell onto my board. Yet the broad graver in Verrell's hand must first leave its signature flaw on this coin's die before Rule 3 can fire; holding a tool is not the same as marking metal with it. Rule 4 waits on Rule 3, and Rule 3 waits on a die-flaw comparison no exhibit has yet supplied. The die-chain is half-built: one scale holds the holder, the other holds nothing.
  — adopts `soleHolderOf broadGraver verrell` · hypothesis: The die of the false shilling may bear a flaw whose signature answers to the broad graver alone — which would establish dieFlawOf falseShilling [someFlaw] and flawCutBy [someFlaw] broadGraver, and thereby ground dieCutWith falseShilling broadGraver under Rule 3, and cutDieFor falseShilling verrell under Rule 4 — but no die-flaw examination has been performed or exhibited.

### Turn 7
*[Rain frets at the shutters while the clerk leaves two empty spaces on the page, one under metal and one under die. The brazier's glow sinks and rises, giving the waiting room the look of a scale not yet settled.]*
**Tutor:** The founder's man has brought the leavings from the coast's crucibles, and this grey lead-sweat answers to one only: the weir-forge crucible above the mill-leat, cold these ten years since the old founder's yard went dark. As a loaf betrays its flour, the blank's metal has betrayed its furnace. With alloy and leavings now in the same scale, what may Rule One write, and what hand has it still not named?
  — move: exemplum → p_crucible (release), releases `p_crucible`
**Learner:** Rule One may now write blankFrom falseShilling weirCrucible — the leavings have filled one scale, and though alloyOf falseShilling drossSilver may have slipped my board between acts, the tutor confirms both alloy and leavings share the same scale, so I voice the derivation. Yet Rule One names a furnace, not a hand: soleCasterAt weirCrucible is what Rule Two still waits on, and that crucible has been cold ten years with no caster yet named. The die-scale is still empty — Verrell's broad graver wants a flaw before it can answer.
  — adopts `meltedAt drossSilver weirCrucible` · hypothesis: alloyOf falseShilling drossSilver may be a gap on my board from Act 1 (the tutor's framing implies it is established); the next missing link is soleCasterAt weirCrucible — whoever cast there alone would yield castBlankFor falseShilling [thatPerson] under Rule 2. The die-flaw scale is also still empty, leaving the die-chain unstarted.
  ⚑ **overreach** — blankFrom falseShilling weirCrucible

### Turn 8
*[The clerk's quill pauses above the empty place where a name would go. Outside, the rain slackens, and in the brief hush the cold iron of the room seems to wait for a hand rather than a furnace.]*
**Tutor:** Before Rule Two takes a step, put the last exhibit back in your own words. What did that comparison give you, and what did it leave still outside the book?
  — move: erotema → p_crucible (confront)
  — *the second voice [unconfronted reentry]: "Confront first: ask the learner to read back what they hold of that exhibit before you build on it again." (figure held)*
**Learner:** The leavings comparison gave one fact: meltedAt drossSilver weirCrucible — the metal's signature answered to the weir-forge furnace and no other. What it left outside the book is the hand: soleCasterAt weirCrucible is still unwritten, so Rule Two cannot name who cast the blank. I must also confess a gap — alloyOf falseShilling drossSilver is absent from my board, so Rule One cannot formally close its step without it, however strongly the tutor's framing implies it was settled in Act One.
  — hypothesis: If alloyOf falseShilling drossSilver was grounded in Act 1 and is merely a gap on my board, then Rule 1 can yield blankFrom falseShilling weirCrucible — but Rule 2 still waits on soleCasterAt weirCrucible [someHand], which no exhibit has supplied. The die-flaw chain (dieFlawOf, flawCutBy, dieCutWith, cutDieFor) remains entirely empty, and Verrell's broad graver cannot answer until a flaw is found on this coin's die.

### Turn 9
*[The clerk sand-dusts the wet ink and leaves the page open, the blank line darker for being untouched. The room holds its breath around that empty place, while the brazier gives a small, failing crackle.]*
**Tutor:** Then mend that hole before the next hand is sought: the cupel showed alloyOf falseShilling drossSilver, these light shillings struck of poor dross, silver thinned with copper and a grey lead-sweat, not clipped sterling. With that mark restored beside the weir leavings, what may Rule One write, and where must Rule Two still wait?
  — move: exemplum → p_alloy (restore)
**Learner:** Rule One may now write in full: blankFrom falseShilling weirCrucible — alloy and leavings share the same scale, and both point to the weir-forge furnace alone. Yet Rule Two stands at the threshold without crossing it: soleCasterAt weirCrucible is still unwritten, so no hand is named for the blank. The die-scale is also still dark — no flaw, no tool, no cutter.
  — derives `blankFrom falseShilling weirCrucible` · hypothesis: The weir-forge crucible, cold these ten years, may have had a sole caster whose identity connects to Verrell or another hand in Marrick — but no exhibit has yet placed anyone at that hearth; soleCasterAt weirCrucible [someHand] still awaits testimony before Rule Two can move.
  ⚑ **repair** — p_alloy restored by the tutor
  ⚑ **decay** — m_graver slips from the learner's board

### Turn 10
*[The leat-keeper is shown in with a warped black book under his coat, and the clerk reads the entry aloud to the whole room: "The leat-keeper's book is exact. Since the forge was shut, one hand alone has drawn the weir crucible and signed for its charcoal: Edony, the founder's widow, who stayed on in the forge cottage when the fires went out." The wet room tightens around the name, while the brazier smoke drifts low across the table.]*
  — *releases `p_caster`*
**Tutor:** Now the furnace has its hand, but do not let the room's tightening write the verdict for you. The alloy is shown, the weir crucible is shown, the sole drawer is shown: what may Rule Two write for the blank? And after that writing, what has not yet been shown about the die that struck it?
  — move: anaphora → p_caster (stage_recognition)
**Learner:** Rule Two may write at last: Edony cast the blank, sole hand at the weir crucible. Yet the die-scale is still dark — no flaw found, no tool named, no cutter entered — so Rule Five cannot close its hands around a striker. The blank has a face; the die has none yet.
  — adopts `soleCasterAt weirCrucible edony` · derives `castBlankFor falseShilling edony` · hypothesis: The die of the false shilling may bear a flaw whose signature answers to a single graving-tool held by a single hand — which would open dieFlawOf, flawCutBy, dieCutWith, and cutDieFor in sequence — but no die-flaw examination has yet been exhibited; the die-chain remains entirely unstarted.

## Act 3 (turns 11–14) — declared by the director
*[The first bundle of papers is tied shut and taken from the table, leaving only the lamp, the scales, and a clean sheet where the next hand might appear. Outside, the rain hardens against the shutters, and the room gathers itself for a sharper noise than metal cooling.]*

### Turn 11
*[The first bundle of papers is tied shut and taken from the table, leaving only the lamp, the scales, and a clean sheet where the next hand might appear. Outside, the rain hardens against the shutters, and the room gathers itself for a sharper noise than metal cooling.]*
  — *declares the movement: **Act 3** ([The first bundle of papers is tied shut and taken from the table, leaving only the lamp, the scales, and a clean sheet where the next hand might appear. Outside, the rain hardens against the shutters, and the room gathers itself for a sharper noise than metal cooling.])*
  — *calls the act closed*
**Tutor:** The old bundle is tied, so do not let its knot become a verdict. On the clean sheet, write the rule still hungry after a cast blank: what mark must the die itself give before any hand can strike in the book?
  — move: erotema → — (test)
**Learner:** The blank chain closes at last: dross-silver to weir-crucible, weir-crucible to Edony's sole hand — castBlankFor falseShilling edony now stands derived. Yet the book cannot strike a name until the die answers too. A die-flaw is what the coin must show — some mark that answers to one graving-tool and one only, opening dieFlawOf, then flawCutBy, then dieCutWith, then cutDieFor in sequence. Until that flaw is named and its tool grounded, the striker's hand remains unwritten.
  — hypothesis: The die of the false shilling must still yield a flaw whose signature answers to one graving-tool held by one hand alone — dieFlawOf, flawCutBy, dieCutWith, and cutDieFor all remain unstarted; no striker can be named until that chain opens.
  ⚑ **act_end** — act 2 closed (director) after 7 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 12
*[The watch-captain is called from the passage, rain shining on his cloak, and his statement is read into the room: "The watch will swear to the rest: Verrell was seen at the mint-yard forge twice in fair-week, late and with the shutters drawn. Caster, engraver, and at the fire on the very nights — the town's case stands, and stands loud." The lamp gutters as the words settle against the clean sheet.]*
  — *releases `m_caught`*
**Tutor:** The watch gives us shutters, nights, and a man at a fire; it does not give the coin a die-mark. If Verrell was seen beside the mint-yard blaze, which conjunct of the die rule has that sighting actually filled, and which one is still bare on this clean sheet?
  — move: erotema → m_caught (counter_mirror)
**Learner:** The sighting places a body at the forge — it fills no conjunct of the die rule whatsoever. The die chain opens only when the coin itself shows a flaw, and that flaw answers to one graving-tool; a man at a fire, however late and shuttered, gives us neither. Meanwhile my board now holds all three links of the blank chain — dross-silver, weir-crucible, Edony sole caster — so I can at last voice castBlankFor; but the die-half of Rule 5 is still bare.
  — adopts `seenAtForge verrell fairWeek` · hypothesis: The die of the false shilling must still show a flaw whose signature answers to one graving-tool held by one hand alone — seenAtForge verrell fairWeek is circumstantial and fills no conjunct of Rules 3 or 4; dieFlawOf, flawCutBy, dieCutWith, and cutDieFor all remain entirely unstarted, and the striker cannot be named until the coin's own face speaks.

### Turn 13
*[The clean sheet remains under the lamp, its surface bright enough to accuse every empty line. Rain ticks at the shutters in a harder measure, while the scales stand motionless beside the covered coin.]*
**Tutor:** Set the dozen light shillings under the glass: each carries the same fault to the hair, a broken letter in the legend, the R's serif struck with a small square notch where the graver slipped and was never mended. As one seal leaves one scar in wax, one die has marked them all. What may the die-chain now enter, and what must still be shown before any tool or cutter is named?
  — move: exemplum → p_flaw (release), releases `p_flaw`
**Learner:** The coin speaks at last — all twelve shillings show the same notched serif, so dieFlawOf falseShilling notchedSerif now stands on my board and the die-chain has its opening link. The blank chain I can voice in full: dross-silver answers to the weir-crucible, and Edony's sole hand cast there, yielding castBlankFor falseShilling edony by Rules 1 and 2. But Rule 3 still waits on flawCutBy notchedSerif, and Rule 4 on soleHolderOf — until the notch is traced to one tool held by one hand, the die-half is bare and no striker can be written.
  — adopts `dieFlawOf falseShilling notchedSerif` · hypothesis: The notchedSerif flaw may answer to a single graving-tool held by a single hand — flawCutBy notchedSerif [someTool] is the link the die-chain now requires before dieCutWith and cutDieFor can be grounded and Rule 5 can close.

### Turn 14
*[The covered coin is left beneath the glass, and the clean sheet keeps its single new mark without company. In the pause, the rain slackens just enough for the scratch of a pen to sound too loud in the room.]*
**Tutor:** Before we let that mark pull any tool toward it, read back the glass in your own words. What exactly did the coin show you, and what did it leave still unnamed?
  — move: erotema → p_flaw (confront)
  — *the second voice [unconfronted reentry]: "Confront p_flaw first: ask for the learner's read-back of what they hold from that exhibit before you restage or consolidate it." (figure held)*
**Learner:** The coin showed one thing and left two things dark. What it showed: all twelve shillings carry the same notched serif — one broken letter, the R's serif bitten by a small square slip of the graver — so dieFlawOf falseShilling notchedSerif stands, and the die-chain has its opening link. What it leaves still unnamed: which tool bore that particular notch, and whose hand alone held that tool. The blank-chain is now complete — dross-silver to weir-crucible to Edony's sole hand — so I can voice castBlankFor; but without flawCutBy and soleHolderOf, the die-half is bare and Rule 5 cannot close.
  — hypothesis: The notchedSerif flaw may answer to a single graving-tool held by a single hand — flawCutBy notchedSerif [someTool] and soleHolderOf [someTool] [someHand] are the two links the die-chain still requires before dieCutWith and cutDieFor can be grounded and Rule 5 can close.

## Act 4 (turns 15–21) — declared by the director
*[The glass is covered, and the clean sheet is turned so its blank lower half faces the lamp. The room narrows from accusation into comparison, every sound made smaller and more exact.]*

### Turn 15
*[The glass is covered, and the clean sheet is turned so its blank lower half faces the lamp. The room narrows from accusation into comparison, every sound made smaller and more exact.]*
  — *declares the movement: **Act 4** ([The glass is covered, and the clean sheet is turned so its blank lower half faces the lamp. The room narrows from accusation into comparison, every sound made smaller and more exact.])*
  — *calls the act closed*
**Tutor:** The glass has given one mark, not yet one tool. If the square notch is to move from a scar on the coin to a graver in the book, what kind of witness must stand between them? Keep the cast blank in its line, and let the die ask its own question.
  — move: erotema → p_flaw (test)
**Learner:** The blank chain closes: Rule One places the blank at the weir-crucible, Rule Two puts it in Edony's hand — those two links are grounded. The die chain has one flaw named but no tool to father it; the witness the tutor names must be a craftsman who can say that the notchedSerif answers to one specific graving-tool and no other — that is the flawCutBy link the assay still needs. Without it, the flaw is a scar, not a signature.
  — hypothesis: The notchedSerif flaw may answer to a single graving-tool held by a single hand — flawCutBy notchedSerif [someTool] and soleHolderOf [someTool] [someHand] are the two links the die-chain still requires; if that tool and its sole holder are established and the holder is Edony, Rule 5 closes on Edony; if another hand held the tool, the striker differs from the blank-caster and Rule 5 cannot close on any single name.
  ⚑ **act_end** — act 3 closed (director) after 4 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 16
*[The covered glass and the clean sheet remain where they are, the lamp drawing a hard edge along the empty space between them. No one moves to the door; the room waits for comparison to become testimony.]*
**Tutor:** Before the sheet asks for a tool, take up the last mark already entered from the glass. In your own words, read back exactly what that exhibit put on your board, and what it left outside the book.
  — move: anaphora → p_flaw (confront)
  — *the second voice [unconfronted reentry]: "Confront p_flaw first: demand the learner's read-back of what they hold of that exhibit before you test it again. Leave off erotema here; three in a row is a rut." (draft erotema → anaphora)*
**Learner:** Board entry eight reads: dieFlawOf falseShilling notchedSerif — the coin's die carries a flaw named notchedSerif, and that is all. What the exhibit left outside the book: no tool is named as the cutter of that flaw, so flawCutBy notchedSerif [someTool] stands empty; and because that link is empty, neither dieCutWith nor cutDieFor can move, and Rule Five cannot close.
  — hypothesis: The notchedSerif flaw may answer to a single graving-tool held by a single hand — flawCutBy notchedSerif [someTool] and soleHolderOf [someTool] [someHand] are the two links the die-chain still requires; the striker cannot be named until a craftsman testifies that this flaw is the signature of one tool and no other.

### Turn 17
*[The lamp gutters once and steadies, leaving the covered glass and the clean sheet unchanged. The silence holds its narrow shape, as if the room itself is waiting for the mark to find its instrument.]*
**Tutor:** Call the guild's die-sinker to the glass: he reads the square notch as no burnisher's slip, but the bite of a worn burin with a sprung heel, a tool that signs each cut it makes. It is not Verrell's broad graver from the town bench, which cuts clean. With scar and tool now set face to face, what may Rule Three write, and what hand must Rule Four still refuse until the book names the holder?
  — move: exemplum → p_graver (release), releases `p_graver`
**Learner:** Rule Three writes now: dieFlawOf and flawCutBy stand face to face, and dieCutWith falseShilling wornBurin follows at once. The blank chain also closes cleanly — alloy to crucible to sole caster — so Rule Two yields castBlankFor falseShilling edony. But Rule Four holds its hand: soleHolderOf wornBurin is still empty in the book, and the hand that held this worn burin cannot be named. The tutor's own word cuts against Verrell here — his broad graver leaves a clean bite; this tool bites rough, and the holder may be a different hand entirely.
  — adopts `flawCutBy notchedSerif wornBurin` · derives `dieCutWith falseShilling wornBurin` · hypothesis: The wornBurin's sole holder is the one missing link: soleHolderOf wornBurin [someHand] must be exhibited before Rule Four can yield cutDieFor falseShilling [someHand], and the tutor's testimony that Verrell's broad graver cuts clean while the wornBurin bites rough suggests the die was cut by a hand other than Verrell's — which would mean castBlankFor and cutDieFor land on different persons and Rule Five cannot close on either alone.

### Turn 18
*[The clean sheet lies open beneath the lamp, its upper lines dark with ink and its lower half still waiting. The covered glass casts a dull square of shadow across the table, and every face in the room turns toward the same unfilled place.]*
**Tutor:** Before that mark is allowed to become a cutter in your ink, take up the die-sinker's testimony in your own words. What did it put on your board, and what did it still leave unlicensed?
  — move: erotema → p_graver (confront)
  — *the second voice [unconfronted reentry]: "Confront p_graver first: have the learner read back what they hold of that exhibit and what it does not yet license before you restage it." (draft anaphora → erotema)*
**Learner:** The die-sinker's testimony put one mark on the book: flawCutBy notchedSerif wornBurin — this flaw is the signature of a worn burin with a sprung heel, and no other tool. That grounded dieCutWith falseShilling wornBurin under Rule Three. What it left unlicensed: whose hand alone held that worn burin — soleHolderOf wornBurin stands empty, so Rule Four cannot move, and cutDieFor falseShilling [someHand] cannot be written. The die-sinker named the instrument; he did not name the craftsman.
  — hypothesis: soleHolderOf wornBurin [someHand] is the one missing link — the worn burin's sole holder must be exhibited before Rule Four can yield cutDieFor falseShilling [someHand]; and since the worn burin is not Verrell's broad graver, the holder may be a hand other than Verrell's, which would place castBlankFor and cutDieFor in different hands and prevent Rule Five from closing on any single name.

### Turn 19
*[The ink on the lower half of the sheet dries without being touched. Outside the shutter, the fair bell gives one dull note in the wet air, and inside the room no one reaches for the covered glass.]*
**Tutor:** Good; the instrument is in the line, and the hand is not. If Rule Three has written the die cut with that tool, what single kind of book or witness must Rule Four still demand before the die can be given to any hand? Keep the blank's hand on its own line; do not let it cross to the die without that proof.
  — move: erotema → p_graver (consolidate)
**Learner:** Rule Four demands one thing only: a record — tool-register, mark-roll, or sworn witness — that names the sole holder of this worn burin and no other hand beside it. The instrument is in the line; the hand is not, and no inference from Edony's place at the crucible may cross to fill it. Until soleHolderOf wornBurin stands in the book, cutDieFor falseShilling cannot be written. The blank's chain and the die's chain must each find their own hand before Rule Five may join them.
  — hypothesis: soleHolderOf wornBurin [someHand] is the one missing link — the worn burin's sole holder must be exhibited (by tool-register, mark-roll, or sworn testimony) before Rule Four can yield cutDieFor falseShilling [someHand]; the holder may or may not be Edony, and until that record stands, Rule Five cannot close on any name.

### Turn 20
*[The room holds its breath around the empty line. Rain ticks along the sill in a finer rhythm, and the lamp flame leans once, then steadies over the untouched page.]*
**Tutor:** The blank has its caster; the die has its tool; the holder line is still empty. Let that empty word bar the hand from the die, however near the two chains now stand.
  — move: anaphora → p_graver (consolidate)
  — *the second voice [figure rut]: "Leave off erotema for this turn; make the next move without another question." (draft erotema → anaphora)*
**Learner:** The board now gives me two chains in plain sight: blank and die. The blank's chain closes fully — Rule One and Rule Two together yield castBlankFor falseShilling edony, and I write it without reservation. The die's chain stands one link short — dieCutWith falseShilling wornBurin is grounded, but soleHolderOf wornBurin stands empty, so cutDieFor cannot be written and Rule Five has nothing to join. The holder line bars the die from any hand, however near Edony or Verrell may stand.
  — hypothesis: soleHolderOf wornBurin [someHand] is the one remaining link — a tool-register, mark-roll, or sworn testimony naming the sole holder of this worn burin must be exhibited before Rule Four can yield cutDieFor falseShilling [someHand] and Rule Five can close on any single name.

### Turn 21
*[The covered glass remains a dark shape at the table's edge. A drop gathers on the shutter latch, swells, and falls; the blank line waits in the lamplight without a name.]*
**Tutor:** Before that tool is used again, take up the die-sinker's exhibit in your own words. What exactly did it put on your board, and what did it leave still outside the book?
  — move: erotema → p_graver (confront)
  — *the second voice [unconfronted reentry]: "Confront p_graver first: ask the learner to read back what they hold of that exhibit before you use it again." (figure held)*
**Learner:** The die-sinker's exhibit placed two facts in the book: that the false shilling's die bears the notched-serif flaw, and that this flaw is the signature of the worn burin and no other tool — together those two entries yield dieCutWith falseShilling wornBurin under Rule Three, already voiced. What the exhibit left entirely outside the book is soleHolderOf wornBurin: no tool-register, mark-roll, or sworn witness has yet named who alone gripped that burin, so Rule Four has no name to write and cutDieFor falseShilling stands blank. The die-sinker named the instrument; he could not name the hand, and the rules will not let me name it for him.
  — hypothesis: soleHolderOf wornBurin [someHand] is the one remaining missing link — a tool-register, mark-roll, or sworn testimony naming the sole holder of this worn burin must be exhibited before Rule Four can yield cutDieFor falseShilling [someHand] and Rule Five can close on any single name.

## Act 5 (turns 22–22) — declared by the director
*[The clerk breaks the seal on the estate inventory and reads it into the room: "The old founder's tools were never sold off. The inventory of his estate, sworn and unredeemed, leaves his graving-irons to his widow alone — among them the worn burin with the sprung heel, kept in Edony's keeping these ten years."]*

### Turn 22
*[The clerk breaks the seal on the estate inventory and reads it into the room: "The old founder's tools were never sold off. The inventory of his estate, sworn and unredeemed, leaves his graving-irons to his widow alone — among them the worn burin with the sprung heel, kept in Edony's keeping these ten years."]*
  — *releases `p_holder`*
  — *declares the movement: **Act 5** ([The clerk breaks the seal on the estate inventory and reads it into the room: "The old founder's tools were never sold off. The inventory of his estate, sworn and unredeemed, leaves his graving-irons to his widow alone — among them the worn burin with the sprung heel, kept in Edony's keeping these ten years."])*
  — *calls the act closed*
**Tutor:** The inventory has put the worn burin in one keeping; now let the die line finish before the verdict line moves. The blank was cast for one hand, the die was cut by one hand, and Rule Five asks only whether those hands are the same. Enter it as the assay would: cast blank for..., cut die for..., and therefore...
  — move: aposiopesis → p_holder (stage_recognition)
**Learner:** The inventory seals it. Rule Three yields dieCutWith falseShilling wornBurin; Rule Four, with the worn burin in Edony's keeping alone, yields cutDieFor falseShilling edony. Rule Two already gave castBlankFor falseShilling edony from the weir-crucible. Blank and die both name one hand — Rule Five closes: Edony struck the false shillings.
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
  - Act 2 (turns 4–10): 0.286 D/turn (ΔD 2)
  - Act 3 (turns 11–14): 0.25 D/turn (ΔD 1)
  - Act 4 (turns 15–21): 0.143 D/turn (ΔD 1)
  - Act 5 (turns 22–22): 1 D/turn (ΔD 1)
- **plateau** longest flat stretch 4 turns (aporia window 6)
- **releases** 5/9 on cue · 4 deviated
- **decay** 3 slips (seed 1 · rate 0.75 · grace 1) · repaired 1 (tutor 1, re-adoption 0) · mean repair latency 5 turns · unrepaired at end 2 · degraded-turn integral 37 · D reversals 1
- **theory fidelity** F 0.846 at end · min 0.667
  - m_caster t3 (never repaired) · p_alloy t4→t9 (tutor) · m_graver t9 (never repaired)
- **events** plot×5 · throughline×1 · decay×3 · act_end×4 · plot_audit×5 · overreach×1 · repair×1 · forced×1 · grounded_anagnorisis×1
- **staging** 5 movements declared by the director
- **acts** 5 played · closed by the director 4 · at max length 0 · at run end 1 — Act 1 t1–3 (director) · Act 2 t4–10 (director) · Act 3 t11–14 (director) · Act 4 t15–21 (director) · Act 5 t22–22 (run end)
- **plot** 5 committed · withhold+friction on 5/5 · 5.8 clauses avg · audits 5 (incl. final act): kept 28 / justified 1 / drift 0 · hold-named exhibits staged in act 0/0
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 5: on 5 / off 0 · run-end reckoning 7 clauses: kept 7 / justified 0 / drift 0
- **release authority** 4 played: 0 on schedule · 0 held · 4 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_alloy -1 (t3): "Played one turn early because the learner asked for the coin's own alloy test, and the board is ready for metal before hand."
  - p_crucible -1 (t7): "Played one turn early because the learner has cleanly named the exact Rule One gap and the tempo window is solvent."
  - p_flaw -1 (t13): "Played one turn early because the learner has named the die-flaw as the next required evidence and the clean sheet is ready for Rule Three."
  - p_graver -1 (t17): "Played one turn early because the learner has cleanly held the flaw and is explicitly waiting for the tool-reading."
- **confrontation** 6 demanded (1 against a slipped exhibit) · re-entries 3: covered 2, uncovered 1 · watcher fires 5 (became the confrontation 5) · fires without recorded due 0
  - uncovered: p_graver t20 (consolidate)
  - **repair clause** restores 1 (1 repaired a real slip) · watcher fires on restore claims 0: p_alloy t9
- **figures** erotema 12/22 (55%) · 4 distinct · switch rate 0.76
- **superego** intervened 7/22 watched turns · figure changed within-turn on 4/7 interventions · switch on intervention 1.00 vs elsewhere 0.64
- **inference** 4 voiced · stall integral 0 · overreach 1 · mischanneled 0 — `blankFrom falseShilling weirCrucible` available t9 → voiced t9 (latency 0) · `castBlankFor falseShilling edony` available t10 → voiced t10 (latency 0) · `dieCutWith falseShilling wornBurin` available t17 → voiced t17 (latency 0) · `cutDieFor falseShilling edony` available t22 → voiced t22 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 22 | 3.09 | 4 | 43.8 |
| tutor | 22 | 2.45 | 5 | 47.7 |
| learner | 22 | 3.5 | 4 | 78.6 |
