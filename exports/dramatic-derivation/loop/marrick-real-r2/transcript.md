# The Light Shillings — marrick-real-r2

> world `world_005_marrick` · verdict **disengagement** · 21/28 turns

```
D= 6 ●●··│●·····│···│······│··
D= 5   ●●│ ●····│···│······│··
D= 4     │  ●●●·│···│······│··
D= 3     │     ●│●●·│······│··
D= 2     │      │  ●│●●····│··
D= 1     │      │   │  ●●●●│●●
D= 0     │      │   │      │  
turn      │+    1│   │ +    │2  (+=5, digit=x10)
rel    ▲▲ │ ▲▲  ▲│ ▲▲│  ▲   │   (▲ = evidence released)
slope 0.24 D/turn overall (D 6→1); per movement: 1 0.25 │ 2 0.33 │ 3 0.33 │ 4 0.17 │ 5 0.00
```

## Act 1 (turns 1–4) — declared by the director
*[Rain frets at the shutters while the hearing room settles into its first silence. On the table, a covered tray waits beneath a stained cloth, and every face turns toward the question before any mouth has shaped it.]*

### Turn 1
*[Rain frets at the shutters while the hearing room settles into its first silence. On the table, a covered tray waits beneath a stained cloth, and every face turns toward the question before any mouth has shaped it.]*
  — *declares the movement: **Act 1** ([Rain frets at the shutters while the hearing room settles into its first silence. On the table, a covered tray waits beneath a stained cloth, and every face turns toward the question before any mouth has shaped it.])*
**Tutor:** Before the cloth lifts, apprentice, name the assay's first debt: do we prove a town's hunger for a culprit, or do we prove each mark by its proper test? Keep the rule beside the coin; no hand enters the book until metal and die have both earned it.
  — move: erotema → — (orient)
**Learner:** The assay's first debt is to the metal, tutor — not to the town's verdict. I note already that the shilling was struck, not clipped, so Verrell's clipping record earns him nothing in this book yet. Until we have alloy, crucible, and die-flaw before us, the coin names no hand.
  — hypothesis: Verrell struck the false shillings — grounded in his known tools and history, but unearned until alloy and die evidence speak.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[The clerk lifts the stained cloth and sets down the first town paper, its seal softened by damp. It is read aloud: "The town has its founder ready: Verrell alone draws the mint-yard crucible, licensed to no one else since the old assay-master's day. Whatever metal is cast in Marrick, the town says, is cast by Verrell's hand."]*
  — *releases `m_caster`*
**Tutor:** The town paper names a hand at the mint-yard crucible; tell me, apprentice, has this coin yet named that crucible? If the paper gives a caster but the metal has not answered, which conjunct is still only noise in the room?
  — move: erotema → m_caster (counter_mirror)
**Learner:** The paper gives us one conjunct only — soleCasterAt mintCrucible verrell — but the coin has not yet answered alloy or melt-source, so blankFrom falseShilling mintCrucible is still missing. Rule 2 cannot fire without it. The caster stands named at his crucible; the crucible does not yet stand connected to this shilling.
  — adopts `soleCasterAt mintCrucible verrell` · hypothesis: Verrell struck the false shillings — still ungrounded until alloy and melt-source evidence connect this coin to the mint crucible, and die-flaw evidence connects it to a tool in his hand.

### Turn 3
*[The room holds around the named crucible without moving toward it. Rainwater threads down the window lead, and the covered tray sits bare now, its damp cloth folded beside the town paper like a second silence.]*
**Tutor:** Set the shilling in the cupel, then: it does not behave as clipped sterling, but as a struck piece of poor dross, silver eked with copper and a grey lead-sweat the touchstone catches. A shaved loaf tells you it was once whole bread; this coin is new dough badly mixed. What does struck-from-dross fix that clipped-from-sterling never could?
  — move: exemplum → p_alloy (release), releases `p_alloy`
**Learner:** Struck-from-dross is the answer, tutor: a clipped coin borrows its alloy from the parent piece and names no crucible of its own, but a struck coin is new metal — its dross is the melt's own signature, traceable to whichever crucible mixed it. We have the alloy now on the board, but Rule 1 still waits on meltedAt to close; until we learn which crucible held this dross silver, the blank's origin is still conjecture.
  — adopts `alloyOf falseShilling drossSilver` · hypothesis: Verrell struck the false shillings — still ungrounded; need meltedAt drossSilver mintCrucible to fire Rule 1, then die-flaw and tool evidence to fire Rules 3–4 before Rule 5 can settle it.
  ⚑ **decay** — m_caster slips from the learner's board

### Turn 4
*[The assayer lets the spent cupel cool in its dish, and no one reaches for the shilling while the rain thickens against the shutters. The town paper remains open beside it, its named hand lying near the metal's silence without touching it.]*
**Tutor:** Hold there, apprentice: before we let the cupel carry another inch, read back only what you hold from that assay. What did it establish, in your own words, and what did it leave still unproved? Keep the town paper outside the answer until the mark itself has spoken.
  — move: erotema → p_alloy (confront)
  — *the second voice [unconfronted reentry]: "Confront p_alloy first: ask the learner to read back what they hold of that exhibit before you use it again." (figure held)*
**Learner:** The assay gave us two things and two things only: this coin is struck fresh from poor metal, not shaved from good — struckNotClipped — and its alloy is dross silver, copper-heavy with a lead sweat the touchstone caught. That is all the metal has spoken. What the assay has not given us is meltedAt: which crucible held this dross silver. Without that link, Rule 1 cannot close, blankFrom stays dark, and the chain to any hand stays broken.
  — hypothesis: Verrell struck the false shillings — still ungrounded; need meltedAt drossSilver [crucible] to fire Rule 1, then die-flaw and tool evidence to fire Rules 3–4 before Rule 5 can settle it.
  ⚑ **decay** — p_alloy slips from the learner's board

## Act 2 (turns 5–10) — declared by the director
*[The cupel's dull bowl is lifted away, leaving the table poorer and the question sharper. Beyond the shutters the rain slackens into a cold drip, and the room turns from the public verdict toward darker metal-work no one is yet ready to name.]*

### Turn 5
*[The cupel's dull bowl is lifted away, leaving the table poorer and the question sharper. Beyond the shutters the rain slackens into a cold drip, and the room turns from the public verdict toward darker metal-work no one is yet ready to name.]*
  — *declares the movement: **Act 2** ([The cupel's dull bowl is lifted away, leaving the table poorer and the question sharper. Beyond the shutters the rain slackens into a cold drip, and the room turns from the public verdict toward darker metal-work no one is yet ready to name.])*
  — *calls the act closed*
**Tutor:** Before the next paper is touched, apprentice, read back the cupel from your own board: what mark did it give the coin, and what link did it still refuse? If that mark is firm, we may ask where it was melted; if it has blurred, the chain breaks before the crucible.
  — move: erotema → p_alloy (confront)
**Learner:** The cupel's mark is firm on one count: the coin was struck, not clipped — board entry three holds good. But the alloy itself is nowhere on my board; without alloyOf falseShilling [metal] and meltedAt [metal] [crucible], Rule 1 cannot fire and the blank chain is broken before the crucible is even named. That is the link the cupel still refused to give.
  — hypothesis: Verrell struck the false shillings — still ungrounded; need alloyOf falseShilling [metal] and meltedAt [metal] [crucible] to fire Rule 1, then die-flaw and tool evidence to fire Rules 3–4, before Rule 5 can settle it.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 5, justified 1, drift 0; arc on_arc

### Turn 6
*[A guild paper is laid beside the cooled cupel: And Verrell engraves: the broad graver on his bench is his alone, the guild will swear, and no clean-cut die in the borough is sunk without it. A caster and an engraver both — the town needs no more than that.]*
  — *releases `m_graver`*
**Tutor:** Then restore the cupel exactly: these shillings are struck coin of poor dross, silver eked with too much copper and a grey lead-sweat the touchstone catches at once. Clipping shaves a true coin; it strikes no new blank. With alloyOf back on your board, what single link must the metal still give before any crucible can claim it?
  — move: exemplum → p_alloy (restore)
**Learner:** The metal's one missing link is meltedAt drossSilver [crucible] — without it Rule 1 cannot name a blank, and no crucible can claim this coin. The guild paper earns its place: soleHolderOf broadGraver verrell is grounded and the die chain's tail is now on my board. But two facts still stand between that graver and this die: a flaw on the coin's face, and the graver named as its cutter. The broad graver sits in his hand; whether it sank this particular die, the coin has not yet said.
  — adopts `soleHolderOf broadGraver verrell` · hypothesis: Verrell struck the false shillings — still ungrounded; need meltedAt drossSilver [crucible] and soleCasterAt [crucible] verrell to fire Rules 1–2, plus dieFlawOf falseShilling [flaw] and flawCutBy [flaw] broadGraver to fire Rules 3–4, before Rule 5 can settle it.
  ⚑ **repair** — p_alloy restored by the tutor

### Turn 7
*[The guild paper lies squared to the cupel, two accusations side by side but not yet joined. Rain ticks from the eaves into the yard, and the room waits on the next piece of metal to speak.]*
**Tutor:** The founder's man bends over the lead-sweat and knows the dross as a miller knows his flour: it answers to the leavings of one crucible on this coast, the weir-forge crucible above the mill-leat, cold these ten years since the old founder died. Put that beside your cupel mark. With alloyOf and meltedAt now both on the table, what does Rule 1 yield, and what does it still not name?
  — move: exemplum → p_crucible (release), releases `p_crucible`
**Learner:** Rule 1 fires at last: alloyOf and meltedAt together yield blankFrom falseShilling weirCrucible — the blank was cast from the weir-forge crucible above the mill-leat. But the chain halts there: without soleCasterAt weirCrucible, Rule 2 cannot name the hand that cast it. The die chain is equally short: no dieFlawOf entry on this coin, no flawCutBy to invoke Rule 3. Two links in two chains still want metal before Rule 5 can speak.
  — adopts `meltedAt drossSilver weirCrucible` · derives `blankFrom falseShilling weirCrucible` · hypothesis: Verrell struck the false shillings — still ungrounded; need soleCasterAt weirCrucible [x] to fire Rule 2, plus dieFlawOf falseShilling [flaw] and flawCutBy [flaw] broadGraver to fire Rules 3–4, before Rule 5 can settle it.
  ⚑ **decay** — m_graver slips from the learner's board

### Turn 8
*[The founder's man steps back from the table, leaving the named crucible hanging in the air like a cold bell. The rain thins to a hard mist against the shutters, and every face in the room turns from the metal toward the absent hand that must have tended it.]*
**Tutor:** Pause before we let that paper harden into my words. Read back, from your own board, what the founder's man established about the melt-source, and what it still left unproved. Keep it to the link itself: what did that exhibit give Rule 1, and where does the chain stop?
  — move: erotema → p_crucible (confront)
  — *the second voice [unconfronted reentry]: "Confront first: ask for the learner's read-back of what they hold from p_crucible before you use it again." (draft anaphora → erotema)*
**Learner:** Board items 4 and 5 together — alloyOf falseShilling drossSilver and meltedAt drossSilver weirCrucible — gave Rule 1 both its premises, and Rule 1 yielded blankFrom falseShilling weirCrucible, already on the record. The exhibit named the crucible; it named no hand. The chain stops at Rule 2: without soleCasterAt weirCrucible standing on the board, no caster can be named for this blank.
  — hypothesis: Verrell struck the false shillings — still ungrounded; need soleCasterAt weirCrucible [x] to fire Rule 2, plus dieFlawOf falseShilling [flaw] and flawCutBy [flaw] broadGraver to fire Rules 3–4, before Rule 5 can settle it.

### Turn 9
*[The table is left undisturbed, the cupel, papers, and named absence holding their places in a silence too orderly to be peace. Outside, the last rain runs from the roof in single drops, each one marking the room's refusal to mistake a place for a hand.]*
**Tutor:** Good: a place is not yet a hand. If the blank is now from the weir crucible, what kind of book or witness would make Rule 2 speak, and what must you refuse to borrow from the mint-yard paper?
  — move: erotema → p_crucible (test)
**Learner:** To make Rule 2 speak, I need a foundry ledger, a guild roll, or a witness who can name the sole hand that cast at the weir-forge crucible — not that the crucible exists, but that one person alone worked it. What I must refuse to borrow from the mint-yard paper is any inference that Verrell's presence there, or his crucible there, puts his hand at the weir forge: those are two different places, and the weir crucible has been cold ten years. A living caster at a living mint does not become the caster of a cold crucible by reputation alone.
  — hypothesis: Verrell struck the false shillings — still ungrounded; need soleCasterAt weirCrucible [x] to fire Rule 2, plus dieFlawOf falseShilling [flaw] and flawCutBy [flaw] [tool] and soleHolderOf [tool] [x] to fire Rules 3–4, before Rule 5 can settle it.

### Turn 10
*[The leat-keeper's book is brought in, its pages spotted from the wet sleeve that carried it. The leat-keeper's book is exact. Since the forge was shut, one hand alone has drawn the weir crucible and signed for its charcoal: Edony, the founder's widow, who stayed on in the forge cottage when the fires went out.]*
  — *releases `p_caster`*
**Tutor:** The alloy is shown, the weir crucible is shown, and now the book names one hand at that crucible: what must Rule 2 enter for the blank? Say it from your board, then stop where the rule stops. A cast blank is not yet a struck coin; what does the last rule still require before any verdict can stand?
  — move: anaphora → p_caster (consolidate)
**Learner:** Rule 2 now speaks: blankFrom falseShilling weirCrucible and soleCasterAt weirCrucible edony yield castBlankFor falseShilling edony — the blank is Edony's work, not Verrell's. The board points a different hand than the town supposed. But Rule 5 demands blank and die meet in one hand, and the die chain is still dark: dieFlawOf, flawCutBy, soleHolderOf — none yet established. Until the die names its own caster, half a rule is no verdict.
  — adopts `soleCasterAt weirCrucible edony` · derives `castBlankFor falseShilling edony` · hypothesis: Edony may have struck the false shillings — the blank is hers — but this is ungrounded until dieFlawOf falseShilling [flaw], flawCutBy [flaw] [tool], and soleHolderOf [tool] edony are established and Rule 5 can fire.

## Act 3 (turns 11–13) — declared by the director
*[The room is cleared to its barest shape: wet coats on pegs, a low fire, and the table waiting under a sharper light. From beyond the door comes the murmur of a crowd rehearsing its certainty, and the next act opens under that pressure.]*

### Turn 11
*[The room is cleared to its barest shape: wet coats on pegs, a low fire, and the table waiting under a sharper light. From beyond the door comes the murmur of a crowd rehearsing its certainty, and the next act opens under that pressure.]*
  — *declares the movement: **Act 3** ([The room is cleared to its barest shape: wet coats on pegs, a low fire, and the table waiting under a sharper light. From beyond the door comes the murmur of a crowd rehearsing its certainty, and the next act opens under that pressure.])*
  — *calls the act closed*
**Tutor:** The crowd has a name ready; your board has a cast blank and an unfinished die. What does the last rule require besides that blank before a struck shilling can bear any hand? Answer with the missing kind of proof, not with a person.
  — move: erotema → — (test)
**Learner:** A cut die — Rule 5 demands both the cast blank and the cut die meet in one hand; without dieFlawOf, flawCutBy, and soleHolderOf, Rules 3 and 4 cannot yield cutDieFor, and Rule 5 stays silent. My board now derives the blank chain through to edony, but the die chain is still open air.
  — hypothesis: Edony may have struck the false shillings — the blank is hers by Rules 1–2 — but this is ungrounded until dieFlawOf falseShilling [flaw], flawCutBy [flaw] [tool], and soleHolderOf [tool] edony are all shown and Rule 5 can fire.
  ⚑ **act_end** — act 2 closed (director) after 6 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 12
*[The watch is shown in under oath, rain still bright on the brim of his hat. The watch will swear to the rest: Verrell was seen at the mint-yard forge twice in fair-week, late and with the shutters drawn. Caster, engraver, and at the fire on the very nights — the town's case stands, and stands loud.]*
  — *releases `m_caught`*
**Tutor:** The watch gives firelight and shutters, not a die's mark. If Verrell stood at the mint-yard forge twice, which conjunct of Rule 5 has that oath actually supplied, and which die-proof is still absent from your board? Let the crowd be loud; the rule is quieter and harder.
  — move: erotema → m_caught (counter_mirror)
**Learner:** Presence at the forge is not a die's mark. The watch gives seenAtForge — no predicate in Rules 3 or 4 accepts it, so cutDieFor stays empty. Worse for the crowd: my blank chain already names edony through soleCasterAt, not Verrell; the watch's oath touches neither conjunct of Rule 5 in Verrell's favour.
  — adopts `seenAtForge verrell fairWeek` · hypothesis: Edony may have struck the false shillings — the blank is hers by Rules 1–2 — but this is ungrounded until dieFlawOf falseShilling [flaw], flawCutBy [flaw] [tool], and soleHolderOf [tool] edony are all shown and Rule 5 can fire.

### Turn 13
*[The watch's oath settles into the room and leaves the table no fuller than before. Outside, the crowd-noise rises and breaks against the shut door, while the sharper light holds on the untouched place where a die should be.]*
**Tutor:** Then bring the shillings under the glass: a dozen light pieces share one fault to the hair, the R in the legend broken by a small square notch where one graver slipped and the die was never mended. As one cracked mould marks every casting it pours, one flawed die marks every face it strikes. What has this opened in the die chain, and what has it still not named?
  — move: exemplum → p_flaw (release), releases `p_flaw`
**Learner:** The notchedSerif opens the first link of the die chain — dieFlawOf is now on my board, and Rule 3 stands ready. But it demands flawCutBy notchedSerif [tool] before it can yield dieCutWith, and until a graver is named and soleHolderOf follows, Rule 4 stays dark and Rule 5 cannot fire. The die chain has its flaw and wants its tool and hand.
  — adopts `dieFlawOf falseShilling notchedSerif` · hypothesis: Edony may have struck the false shillings — blank is hers by Rules 1–2 — but the die chain still wants flawCutBy notchedSerif [tool] and soleHolderOf [tool] edony before Rule 5 can fire.

## Act 4 (turns 14–19) — declared by the director
*[The room changes: the crowd falls back to a mutter, and the lamp is lowered until every face has to lean toward the table. The next act begins slower and closer, with certainty made to answer to the small marks it has ignored.]*

### Turn 14
*[The room changes: the crowd falls back to a mutter, and the lamp is lowered until every face has to lean toward the table. The next act begins slower and closer, with certainty made to answer to the small marks it has ignored.]*
  — *declares the movement: **Act 4** ([The room changes: the crowd falls back to a mutter, and the lamp is lowered until every face has to lean toward the table. The next act begins slower and closer, with certainty made to answer to the small marks it has ignored.])*
  — *calls the act closed*
**Tutor:** The lamp is lower now, apprentice, so do not let the last mark become my wording. Read back from your own board what the glass gave the die chain, and name the next kind of proof it still lacks. Which part is mark, and which part is still hunger?
  — move: erotema → p_flaw (confront)
**Learner:** The glass gave one mark to the die chain: notchedSerif, a flaw in the coin's face — that is the mark. The hunger is two links still missing: which tool cut that notch, and whose hand alone held it. The blank chain I can close — dross-silver, Weir crucible, Edony's hand — but the die chain stands open at both joints. Until flawCutBy notchedSerif names a tool and soleHolderOf names its holder, Rule 5 has nothing to join.
  — hypothesis: Edony may have struck the false shillings — blank is hers by Rules 1–2 — but the die chain still wants flawCutBy notchedSerif [tool] and soleHolderOf [tool] edony before Rule 5 can fire.
  ⚑ **act_end** — act 3 closed (director) after 3 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 15
*[The lamp gutters once and steadies, throwing the coins into a thin white line across the table. No one reaches for them; the room waits on the next small mark to be made answerable.]*
**Tutor:** You have a mark, not yet a tool; let the lamp teach patience. What proof would turn the fault on the face into a die cut with one instrument, and what must stay outside the answer until the mark itself has named it?
  — move: erotema → — (test)
**Learner:** To turn the mark into a chain: I need flawCutBy notchedSerif [tool] — a physical comparison between the coin's notch and graving tools, showing one instrument and no other leaves that exact cut. What must stay outside the answer is any name: no hand may be named until the tool is named first, and no tool until the mark itself, laid against iron, has said it. The flaw is on my board; the forge bench is not yet on the table.
  — hypothesis: Edony may have struck the false shillings — blank is hers by Rules 1–2 — but the die chain still wants flawCutBy notchedSerif [tool] and soleHolderOf [tool] edony before Rule 5 can fire.

### Turn 16
*[The rain presses softly at the shutters, and the lowered lamp leaves the bench beyond the coins in shadow. A clerk turns a blank page and waits, pen lifted, while the room keeps its breath close.]*
**Tutor:** Call the guild's die-sinker to the lamp: he reads the square notch as the bite of a worn burin with a sprung heel, not the clean cut of Verrell's broad graver. A tool signs a line as surely as a cupel signs a melt. With notchedSerif and wornBurin now matched, what does Rule 3 yield, and what kind of proof must still wait before Rule 4 can name a hand?
  — move: exemplum → p_graver (release), releases `p_graver`
**Learner:** Rule 3 now yields: the die for the false shilling was cut with the worn burin — dieCutWith falseShilling wornBurin. But Rule 4 still waits on one link: soleHolderOf wornBurin must name a hand before it can fire. The blank chain closes at Edony; the die chain reaches the tool but not yet the holder. Show me who alone carried that worn burin, and the two chains can be laid side by side under Rule 5.
  — adopts `flawCutBy notchedSerif wornBurin` · derives `dieCutWith falseShilling wornBurin` · hypothesis: Edony may have struck the false shillings — blank is hers by Rules 1–2, and the die chain now names wornBurin via Rule 3 — but Rule 4 still wants soleHolderOf wornBurin [x] before Rule 5 can fire.

### Turn 17
*[The clerk's pen remains lifted above the blank page, its nib dark with ink but unstirred. Around the table the witnesses shift in their coats, and the coins lie quiet under the lowered lamp.]*
**Tutor:** Before we build another inch on the die-sinker's word, read back that exhibit from your own board. What did it establish about the flaw and the instrument, and what did it still leave short of a hand? Keep the holder outside the answer until your board has earned one.
  — move: erotema → p_graver (confront)
  — *the second voice [unconfronted reentry]: "Confront p_graver first: ask the learner to read back what they hold of that exhibit before you build on it again." (figure held)*
**Learner:** The die-sinker's word gave me two things: the flaw on the face is notchedSerif, and that flaw answers to the wornBurin alone — flawCutBy notchedSerif wornBurin. Joined to what the coin itself showed, Rule 3 fired and I voiced dieCutWith falseShilling wornBurin. What it left entirely short is the holder: no soleHolderOf wornBurin stands on my board, so Rule 4 cannot move, and without Rule 4 no hand is named for the die — and without a named hand for both blank and die, Rule 5 stays silent.
  — hypothesis: Edony may have struck the false shillings — blank is hers by Rules 1–2, and the die chain names wornBurin via Rule 3 — but Rule 4 still wants soleHolderOf wornBurin [x] before Rule 5 can fire.

### Turn 18
*[The lamp gutters once, then steadies, leaving the coins bright and every hand around them dim. No witness steps forward; the room holds itself at the edge of a name not yet permitted.]*
**Tutor:** The flaw is shown, the worn burin is shown, and the hand? Do not let Verrell's broad graver borrow a notch it did not cut. What single line of proof would let Rule 4 move from instrument to keeper?
  — move: anaphora → p_graver (consolidate)
**Learner:** The one line that lets Rule 4 move is this: soleHolderOf wornBurin [x] — one name, sole keeper of that worn burin, no other. Without it the instrument is matched to the flaw but anchored to no hand, and the die chain stalls there. I will not slide Verrell's broad graver into the worn burin's place; those are two tools, and the coin's face said notchedSerif, not the broad graver's mark. Until a witness names the sole keeper of the worn burin, Rule 4 is silent and Rule 5 cannot fire.
  — hypothesis: Edony may have struck the false shillings — blank is hers by Rules 1–2, and the die chain names wornBurin via Rule 3 — but Rule 4 still wants soleHolderOf wornBurin [x] before Rule 5 can fire.

### Turn 19
*[The clerk lowers the wet nib at last, but writes nothing; a black bead gathers and trembles over the margin. Outside, the fair-bells are muffled by rain, and inside the table seems to wait for a single object to be named.]*
**Tutor:** The flaw is shown, the tool is shown, and the holder is still a blank line. If Rule 4 is the next cupel, what exactly must be dropped into it before the die can bear a hand? Answer with the proof's shape, not the name it may later carry.
  — move: anaphora → — (test)
**Learner:** The cupel wants one fact and one only: soleHolderOf wornBurin [x] — a single name standing as sole keeper of that worn burin, no other hand upon it. With dieCutWith falseShilling wornBurin already on the record, Rule 4's left slot is filled; only the right slot is empty. Drop a sole-holder into it and Rule 4 fires, cutDieFor falseShilling [x] is voiced, and Rule 5 can then test whether that same hand holds castBlankFor falseShilling as well.
  — hypothesis: Edony may have struck the false shillings — blank is hers by Rules 1–2, and the die chain names wornBurin via Rule 3 — but Rule 4 still wants soleHolderOf wornBurin [x] before Rule 5 can fire.

## Act 5 (turns 20–21) — declared by the director
*[The clerk sands the untouched page and closes the box with a small, dry click. The next act opens under a harder quiet: fewer voices, less shelter, and only the kept shape of the proof left standing between hesitation and a name.]*

### Turn 20
*[The clerk sands the untouched page and closes the box with a small, dry click. The next act opens under a harder quiet: fewer voices, less shelter, and only the kept shape of the proof left standing between hesitation and a name.]*
  — *declares the movement: **Act 5** ([The clerk sands the untouched page and closes the box with a small, dry click. The next act opens under a harder quiet: fewer voices, less shelter, and only the kept shape of the proof left standing between hesitation and a name.])*
  — *calls the act closed*
**Tutor:** The page is clean, so write only the kept shape, not the town's wish. What has your board already earned in the die chain, and what one proof must enter before the die can bear a hand? Keep the last rule shut until the same hand stands on both sides of it.
  — move: erotema → — (orient)
**Learner:** The blank chain is closed: Rules 1 and 2 yield castBlankFor falseShilling edony. The die chain is half-closed: Rule 3 yields dieCutWith falseShilling wornBurin. One fact alone stands between me and a binding name — soleHolderOf wornBurin — and until it enters, Rule 4 stays shut and Rule 5 cannot fire. I will not write the name until the wornBurin's holder is shown.
  — hypothesis: Edony struck the false shillings — blank is hers by Rules 1–2, die chain reaches wornBurin by Rule 3 — but Rule 4 still wants soleHolderOf wornBurin [x] before Rule 5 can fire and the name can be bound.
  ⚑ **act_end** — act 4 closed (director) after 6 turns
  ⚑ **plot** — act 5 plot committed
  ⚑ **plot_audit** — act 4 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 21
*[Rain works softly at the shutters while the clean page lies open under the clerk's hand. No witness is called; the room holds its breath around the unnamed space where the proof must fall.]*
**Tutor:** Then keep the pen above the page, not on it. If the worn burin has cut the die but no keeper has yet been entered, what would be smuggled if you wrote a striking hand now? Name the two gates still in order: Rule 4 first, then the last rule only if the same hand stands on both sides.
  — move: erotema → — (test)
**Learner:** Gate one: Rule 4 wants soleHolderOf wornBurin — without it, no hand is named on the die side, and cutDieFor stays empty. Gate two: Rule 5 will fire only if that same hand already holds castBlankFor on the blank side — both sides must name one hand or the last rule stays shut. No exhibit has entered; I keep the pen above the page.
  — hypothesis: Edony struck the false shillings — blank is hers by Rules 1–2, and the die chain names wornBurin by Rule 3 — but Rule 4 still wants soleHolderOf wornBurin [x] before Rule 5 can fire and the name can be bound.
  ⚑ **disengagement** — no progress over 6 turns
  ⚑ **plot_audit** — act 5 plot audited at run end: kept 5, justified 1, drift 0; arc on_arc; throughline reckoned (7 clauses)

## Instrument panel (programmatic eval — no judge)

- **verdict** `disengagement` · 21/28 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0.238 D/turn overall (D 6→1 over 21 turns)
  - Act 1 (turns 1–4): 0.25 D/turn (ΔD 1)
  - Act 2 (turns 5–10): 0.333 D/turn (ΔD 2)
  - Act 3 (turns 11–13): 0.333 D/turn (ΔD 1)
  - Act 4 (turns 14–19): 0.167 D/turn (ΔD 1)
  - Act 5 (turns 20–21): 0 D/turn (ΔD 0)
- **plateau** longest flat stretch 5 turns (aporia window 6)
- **releases** 4/9 on cue · 4 deviated
- **decay** 3 slips (seed 1 · rate 0.75 · grace 1) · repaired 1 (tutor 1, re-adoption 0) · mean repair latency 2 turns · unrepaired at end 2 · degraded-turn integral 34 · D reversals 1
- **theory fidelity** F 0.833 at end · min 0.667
  - m_caster t3 (never repaired) · p_alloy t4→t6 (tutor) · m_graver t7 (never repaired)
- **events** plot×5 · throughline×1 · decay×3 · act_end×4 · plot_audit×5 · repair×1 · disengagement×1
- **staging** 5 movements declared by the director
- **acts** 5 played · closed by the director 4 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–10 (director) · Act 3 t11–13 (director) · Act 4 t14–19 (director) · Act 5 t20–21 (run end)
- **plot** 5 committed · withhold+friction on 5/5 · 6 clauses avg · audits 5 (incl. final act): kept 28 / justified 2 / drift 0 · hold-named exhibits staged in act 2/5
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 5: on 5 / off 0 · run-end reckoning 7 clauses: kept 5 / justified 0 / drift 2
- **release authority** 4 played: 0 on schedule · 0 held · 4 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_alloy -1 (t3): "Played one turn early because the learner has cleanly isolated the missing metal conjunct and the board is ready for the first mark."
  - p_crucible -1 (t7): "Played one turn early because the learner has accurately named meltedAt as the metal chain's missing link and the board is ready for Rule 1."
  - p_flaw -1 (t13): "Played one turn early because the learner has explicitly kept the die chain open and the untouched die-place is now the live gap."
  - p_graver -2 (t16): "Played two turns early because the learner has explicitly asked for the tool-comparison proof and the die chain is ready to advance."
- **confrontation** 5 demanded (2 against a slipped exhibit) · re-entries 2: covered 2, uncovered 0 · watcher fires 3 (became the confrontation 3) · fires without recorded due 0
  - **repair clause** restores 1 (1 repaired a real slip) · watcher fires on restore claims 0: p_alloy t6
- **figures** erotema 13/21 (62%) · 3 distinct · switch rate 0.60
- **superego** intervened 3/21 watched turns · figure changed within-turn on 1/3 interventions · switch on intervention 1.00 vs elsewhere 0.53
- **inference** 3 voiced · stall integral 0 · overreach 0 · mischanneled 0 — `blankFrom falseShilling weirCrucible` available t7 → voiced t7 (latency 0) · `castBlankFor falseShilling edony` available t10 → voiced t10 (latency 0) · `dieCutWith falseShilling wornBurin` available t16 → voiced t16 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 21 | 3.14 | 4 | 42.4 |
| tutor | 21 | 2.76 | 3 | 52 |
| learner | 21 | 3.29 | 4 | 71.6 |
