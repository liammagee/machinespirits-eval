# The Light Shillings — marrick-guard-r4

> world `world_005_marrick` · verdict **grounded_anagnorisis** · 22/28 turns
> S forced at turn 22; asserted grounded at turn 22

```
D= 6 ●●·│·●·····│····│·······│·
D= 5   ●│● ●····│····│·······│·
D= 4    │   ●●●·│····│·······│·
D= 3    │      ●│●●··│·······│·
D= 2    │       │  ●●│●●·····│·
D= 1    │       │    │  ●●●●●│·
D= 0    │       │    │       │◉
turn     │ +    1│    │+    2 │  (+=5, digit=x10)
rel    ▲▲│  ▲▲  ▲│ ▲▲ │  ▲    │▲ (▲ = evidence released)
slope 0.27 D/turn overall (D 6→0); per movement: 1 0.33 │ 2 0.29 │ 3 0.25 │ 4 0.14 │ 5 1.00
```

## Act 1 (turns 1–3) — declared by the director
*[Rain presses at the shutters while the room gathers around an empty table, the fair's noise reduced to a wet murmur beyond the walls. A clerk sets down clean paper, and the question waits there before any hand has written on it.]*

### Turn 1
*[Rain presses at the shutters while the room gathers around an empty table, the fair's noise reduced to a wet murmur beyond the walls. A clerk sets down clean paper, and the question waits there before any hand has written on it.]*
  — *declares the movement: **Act 1** ([Rain presses at the shutters while the room gathers around an empty table, the fair's noise reduced to a wet murmur beyond the walls. A clerk sets down clean paper, and the question waits there before any hand has written on it.])*
**Tutor:** Set no name on the paper yet. What must an assay prove before a town's noise can become a finding: metal, die, and the hand that brings them together?
  — move: erotema → — (orient)
**Learner:** The assay must prove three things in order: that the coin's metal answers to one crucible alone, that its die-flaw answers to one graving-tool alone, and that the same hand held both crucible and tool. Verrell's past in the pillory is noise until the metal names him. I will keep the paper blank until the rules force my hand.
  — hypothesis: Verrell struck the false shillings — but this is the town's conjecture, not yet grounded in alloy or die-flaw evidence.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[The door opens on a town officer with rain on his sleeves, and his statement is read into the room: "The town has its founder ready: Verrell alone draws the mint-yard crucible, licensed to no one else since the old assay-master's day. Whatever metal is cast in Marrick, the town says, is cast by Verrell's hand."]*
  — *releases `m_caster`*
**Tutor:** Good; the officer has given us a crucible and a name, not yet the coin's metal. Which conjunct has his statement actually filled: that Verrell draws the mint-yard crucible, or that these shillings answer to it?
  — move: erotema → m_caster (counter_mirror)
**Learner:** The officer fills only one conjunct: that Verrell alone draws the mint-yard crucible. He has not shown us the coin's alloy, nor that the alloy answers to that crucible. Rule 2 can do nothing until Rule 1 has first run — and Rule 1 waits on metal evidence we do not yet hold.
  — adopts `soleCasterAt mintCrucible verrell` · hypothesis: Verrell struck the false shillings — but only one conjunct of the blank-chain is now grounded (soleCasterAt mintCrucible verrell); the alloy link and all die evidence remain unestablished.

### Turn 3
*[Rain works its way down the window lead in thin lines, and the clerk pauses with his pen above the paper, leaving the name already spoken hanging in the wet silence. The coins lie covered on the table, their weight felt but not yet tested.]*
**Tutor:** Lift the cover, then: the cupel says these shillings are not clipped sterling, but struck poor dross, silver stretched with too much copper and a grey lead-sweat under the touchstone. A shaved loaf is still the baker's loaf; this metal was made for a new coin. What does that do to the town's clipping cry?
  — move: exemplum → p_alloy (release), releases `p_alloy`
**Learner:** The clipping cry dies on the touchstone — clipped coin is shaved sterling, but this metal was cast new from dross. Verrell's pillory-record speaks to a different crime than the one before us. I have the alloy now, but Rule 1 still waits on one conjunct: I must see that this very dross was melted at the mint crucible before the blank-chain can run.
  — adopts `alloyOf falseShilling drossSilver` · hypothesis: The dross silver answers to the mint crucible — but meltedAt drossSilver mintCrucible is not yet in evidence; Rule 1 cannot fire until it is shown.
  ⚑ **decay** — m_caster slips from the learner's board

## Act 2 (turns 4–10) — declared by the director
*[The covered coins remain at the table's center while the rain slackens, leaving the room too quiet around the unfinished paper. A second clerk brings in a sealed tray and waits by the door, and the inquiry's weight shifts from rumor toward the cold handling of metal.]*

### Turn 4
*[The covered coins remain at the table's center while the rain slackens, leaving the room too quiet around the unfinished paper. A second clerk brings in a sealed tray and waits by the door, and the inquiry's weight shifts from rumor toward the cold handling of metal.]*
  — *declares the movement: **Act 2** ([The covered coins remain at the table's center while the rain slackens, leaving the room too quiet around the unfinished paper. A second clerk brings in a sealed tray and waits by the door, and the inquiry's weight shifts from rumor toward the cold handling of metal.])*
  — *calls the act closed*
**Tutor:** Before the sealed tray is opened, read back the mark already won. What did the touchstone put on your board, and what did it still leave unproved?
  — move: erotema → p_alloy (confront)
**Learner:** The touchstone has settled one fact: the false shilling is of dross silver, entered and held. But meltedAt — which crucible that metal answered to — has not been shown, so Rule 1 cannot yet fire. The die-flaw chain is wholly unbegun: no flaw named, no tool, no holder on the board. The sealed tray may carry what the record still lacks.
  — hypothesis: The dross silver answers to Verrell's crucible (meltedAt drossSilver mintCrucible, soleCasterAt mintCrucible verrell) — but neither link has been shown in evidence; both must wait on the sealed tray or the assay record.
  ⚑ **act_end** — act 1 closed (director) after 3 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 6, justified 0, drift 0; arc on_arc
  ⚑ **decay** — p_alloy slips from the learner's board

### Turn 5
*[The sealed tray stays unopened beside the door, its wax catching the dim light as the clerk shifts his weight and then goes still. Beyond the windows the fair-yard mud gives back no sound, and the covered coins wait at the table's center like a question no one has yet paid for.]*
**Tutor:** Then keep the cupel's mark exactly that narrow. If dross is shown but no hearth is named, what single line must the tray add before the blank can belong to any hand?
  — move: erotema → — (test)
**Learner:** The single line the tray must add is meltedAt — which hearth that dross silver answered to; without it Rule 1 cannot fire and the blank is claimed by no crucible and no hand. I also mark a gap the board itself has opened: alloyOf falseShilling drossSilver should stand there from the touchstone's work last turn, yet it is absent — I cannot call a thing held that my board does not show, and I name the absence plainly before the tray is broken.
  — hypothesis: The dross silver answers to Verrell's crucible (meltedAt drossSilver mintCrucible, soleCasterAt mintCrucible verrell) — but neither link has been shown in evidence; both must wait on the sealed tray or the assay record.

### Turn 6
*[The seal is broken and the tray gives up a guild paper, damp at one corner; the clerk reads it into the room: "And Verrell engraves: the broad graver on his bench is his alone, the guild will swear, and no clean-cut die in the borough is sunk without it. A caster and an engraver both — the town needs no more than that."]*
  — *releases `m_graver`*
**Tutor:** The touchstone's line is restored: these shillings are not clipped sterling, but struck poor dross — silver stretched with too much copper and a grey lead-sweat. Clipping shaves a true coin; this metal was made for a new coin. Read that as alloy only: what has it proved, and what hearth has it still not named?
  — move: exemplum → p_alloy (restore)
**Learner:** The alloy stands on the board already — drossSilver — but meltedAt names no hearth, so Rule 1 is still cold and the blank belongs to no crucible. The new exhibit plants one post in the die-chain: Verrell alone holds the broad graver, and Rule 4 waits to fire — but it needs dieCutWith first, and that needs a flaw named on the coin and linked to that tool, neither of which the tray has yet given. Both chains are one link short of yielding any hand.
  — adopts `soleHolderOf broadGraver verrell` · hypothesis: If a die-flaw on the false shilling is shown to answer to the broad graver (flawCutBy ?flaw broadGraver AND dieFlawOf falseShilling ?flaw), Rules 3 and 4 yield cutDieFor falseShilling verrell — but neither link is in evidence yet; the blank chain equally waits on meltedAt drossSilver ?crucible.
  ⚑ **repair** — p_alloy restored by the tutor

### Turn 7
*[The clerk folds the guild paper back along its wet crease, but no one carries it from the table. In the hush after the reading, the sealed tray's empty lining darkens with rainwater, and the room waits for a colder answer than reputation.]*
**Tutor:** Now the founder's man reads the lead-sweat: that dross answers to the leavings of one crucible on this coast, the weir-forge crucible above the mill-leat, cold these ten years since the old founder died. Flour tells the sack before it tells the baker. Put only alloy and hearth together: what does Rule 1 yield, and what hand has it still not earned?
  — move: exemplum → p_crucible (release), releases `p_crucible`
**Learner:** Rule 1 fires at last: drossSilver answers to weirCrucible, so the blank is from that hearth — blankFrom falseShilling weirCrucible stands on the record. But Rule 2 wants soleCasterAt weirCrucible, and the weir-forge has been cold ten years since the old founder died; no living hand is yet named there. The blank has found its crucible and lost its maker in the same breath.
  — adopts `meltedAt drossSilver weirCrucible` · derives `blankFrom falseShilling weirCrucible` · hypothesis: The weir crucible's sole caster is unestablished — the old founder is dead, Verrell has never been linked to that hearth, and soleCasterAt weirCrucible ?x must be shown before castBlankFor can name any hand; the die chain equally waits on a flaw linked to the broad graver.
  ⚑ **decay** — m_graver slips from the learner's board

### Turn 8
*[The rain gutters along the sill in a thinner line, and the cupel paper curls where the damp has reached it. Around the covered coins, ink dries slowly on the unfinished chain, leaving one space in the hand of the room unfilled.]*
**Tutor:** Stop your pen at the hearth-line and read it back before I touch it again. What, in your own words, did the founder's man put on the board last turn, and what did he leave still unsigned?
  — move: erotema → p_crucible (confront)
  — *the second voice [unconfronted reentry]: "Confront p_crucible first: ask the learner to read back what they hold of that exhibit before you consolidate it. Also leave off exemplum; it has become the third straight device." (draft exemplum → erotema)*
**Learner:** The founder's man named the weir-forge crucible — its leavings match drossSilver exactly, and nowhere else on this coast. That gives us meltedAt drossSilver weirCrucible, and Rule 1 closes at once: blankFrom falseShilling weirCrucible stands on the record. What he left unsigned is the hand at that hearth: soleCasterAt weirCrucible ?x names no one — the old founder is dead these ten years, and nothing yet places any living hand, Verrell's or another's, as sole caster there.
  — hypothesis: Verrell cast at the weir-forge — but no evidence links him to that hearth, and the die chain equally waits on a flaw matched to the broad graver; both chains remain one link short.

### Turn 9
*[The clerk's pen hovers over the blank space and does not descend. Outside, the last runoff from the roof taps into the courtyard barrel, measuring the silence while the covered coins sit untouched.]*
**Tutor:** Good: the hearth is named, but a hearth has no fingers in the trial-book. If Rule 1 has put the blank at the weir crucible, what exact sort of line must Rule 2 now have before that blank can be cast for any hand?
  — move: erotema → p_crucible (consolidate)
**Learner:** Rule 2 needs exactly one line before it can fire: soleCasterAt weirCrucible ?x — one named hand, and one only, who cast at the weir-forge hearth. blankFrom falseShilling weirCrucible already sits on the record, so the first conjunct is satisfied; but without soleCasterAt, the rule has no ?x to yield and castBlankFor names nobody. The blank has a home hearth; it wants a home hand.
  — hypothesis: Verrell cast at the weir-forge — but no evidence links him to that hearth, and the die chain equally waits on a flaw matched to the broad graver; both chains remain one link short.

### Turn 10
*[The leat-keeper's book is brought in with its warped cover still smelling of wet leather, and the clerk reads from it while the sealed tray remains untouched. "The leat-keeper's book is exact. Since the forge was shut, one hand alone has drawn the weir crucible and signed for its charcoal: Edony, the founder's widow, who stayed on in the forge cottage when the fires went out."]*
  — *releases `p_caster`*
**Tutor:** The book gives the hearth its hand; do not let your pen run past the rule. The dross is shown, the weir crucible is shown, the sole caster is shown — what does Rule 2 yield for the blank, and what has a blank still not proved about the die that struck it?
  — move: anaphora → p_caster (stage_recognition)
**Learner:** The leat-keeper's book supplies the missing line: soleCasterAt weirCrucible edony. Rule 2 now fires — blankFrom falseShilling weirCrucible joined to soleCasterAt weirCrucible edony yields castBlankFor falseShilling edony. Edony cast the blank, not Verrell; the town's conjecture loses its footing on the blank chain entire. But the die stands apart: without dieFlawOf, no tool is named, and castBlankFor alone cannot strike a coin under Rule 5.
  — adopts `soleCasterAt weirCrucible edony` · derives `castBlankFor falseShilling edony` · hypothesis: The die chain is entirely unestablished — no flaw on the false shilling has been matched to any graving-tool, so cutDieFor falseShilling ?x names no one; Rule 5 cannot fire until blank and die meet in one hand.

## Act 3 (turns 11–14) — declared by the director
*[The clerk sands the fresh line and closes the leat-keeper's book without triumph. The sealed tray remains at the door, and the covered coins wait in the quiet as if the room has only changed the shape of its question.]*

### Turn 11
*[The clerk sands the fresh line and closes the leat-keeper's book without triumph. The sealed tray remains at the door, and the covered coins wait in the quiet as if the room has only changed the shape of its question.]*
  — *declares the movement: **Act 3** ([The clerk sands the fresh line and closes the leat-keeper's book without triumph. The sealed tray remains at the door, and the covered coins wait in the quiet as if the room has only changed the shape of its question.])*
  — *calls the act closed*
**Tutor:** Let the fresh line cool: a blank cast for a hand is not yet a struck shilling. If the rule asks both blank and die to meet, which half has your board earned, and which half must remain under the glass?
  — move: erotema → — (consolidate)
**Learner:** The blank chain is now complete: dross silver answers to the weir crucible, and Edony alone cast there — so Rule 2 yields castBlankFor falseShilling edony, not Verrell. That is the half my board has earned. The die half remains entirely under glass — no flaw on the shilling has been matched to any graving-tool, so cutDieFor names no hand. Rule 5 cannot fire until both halves meet, and the blank half already names someone the town has not even looked at.
  — hypothesis: The die chain is entirely unestablished — no flaw on the false shilling has been matched to any graving-tool, so cutDieFor falseShilling ?x names no one; Rule 5 cannot fire until blank and die meet in one hand, and the blank half now names Edony, not Verrell.
  ⚑ **act_end** — act 2 closed (director) after 7 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 12
*[The watch is shown in wet-shouldered from the yard, and the oath is taken with the sealed tray still covered. "The watch will swear to the rest: Verrell was seen at the mint-yard forge twice in fair-week, late and with the shutters drawn. Caster, engraver, and at the fire on the very nights — the town's case stands, and stands loud."]*
  — *releases `m_caught`*
**Tutor:** The watch gives us shutters, hours, and the mint-yard fire; those are loud marks, but they are not yet the coin's marks. Which conjunct for these shillings has that oath filled: a flaw on the die, a tool that cut it, or only a man seen near a forge?
  — move: erotema → m_caught (counter_mirror)
**Learner:** The watch's oath sets Verrell near a forge with shutters drawn — a loud mark, but the rules ask for flaw, tool, and sole holder, not a man's shadow on a wall; it fills no conjunct of the die chain. Meanwhile my board now ripens two steps I may voice aloud: dross silver answered to the weir crucible by Rule 1, and Edony alone cast there, so Rule 2 yields castBlankFor falseShilling edony. The blank half is Edony's hand, not Verrell's. The die half remains entirely ungrounded — no flaw matched, no tool named, no sole holder shown — and Rule 5 cannot fire on one conjunct alone.
  — adopts `seenAtForge verrell fairWeek` · hypothesis: The die chain is entirely unestablished — no flaw on the false shilling has been matched to any graving-tool, so cutDieFor falseShilling ?x names no one; Rule 5 cannot fire until blank and die meet in one hand, and the blank half already names Edony, not Verrell.

### Turn 13
*[Rain ticks against the high panes while the covered tray sits untouched between the oath-book and the cooled ink. No hand reaches for it yet; the room holds its breath around the question the watch has not answered.]*
**Tutor:** Then the glass may earn its keep: a dozen of the light shillings share one fault to the hair, the legend's R broken by a small square notch where the graver slipped and was never mended. One moldmark in twelve loaves tells one pan, not yet the baker. What does that fill in the die chain, and what tool-line must still be read before any hand can be named?
  — move: exemplum → p_flaw (release), releases `p_flaw`
**Learner:** The notchedSerif flaw fills the first conjunct of Rule 3 — the coin has named its wound at last. But two links of the die chain remain dark: which tool cut that notch, and who alone held it. While we wait on flawCutBy and soleHolderOf, my board ripens enough to voice the blank half aloud — Rules 1 and 2 yield Edony's hand, not Verrell's.
  — adopts `dieFlawOf falseShilling notchedSerif` · hypothesis: The notchedSerif flaw answers to a specific graving-tool, and that tool's sole holder will complete the die chain — but flawCutBy notchedSerif ?tool and soleHolderOf ?tool ?x are both unshown; cutDieFor falseShilling ?x names no hand yet, and Rule 5 cannot fire on the blank conjunct alone.

### Turn 14
*[The clerk lifts the cover no farther, only turns the tray so the same pale faces catch the window-light and fall dull again. The wet watchman waits by the jamb, and the room listens to the rain as if a second instrument might speak from under the cloth.]*
**Tutor:** Hold that wound as a wound only; a notch is not yet a tool, and a tool is not yet a hand. If the blank has one half of the rule closed, what exact conjunct must the die now win before the two halves can even be compared?
  — move: erotema → — (consolidate)
**Learner:** The die chain needs one conjunct before the two halves can meet at all: flawCutBy notchedSerif ?tool — the rule that names which graving-tool left that wound. Once that is shown, soleHolderOf ?tool ?x yields dieCutWith and then cutDieFor; only then can Rule 5 compare hands and ask whether the die cutter and blank caster are one person. As the room waits, I will voice what the blank chain already yields by Rules 1 and 2: Edony's hand cast the blank. The die half names no one yet.
  — hypothesis: The notchedSerif flaw answers to a specific graving-tool, and that tool's sole holder will complete the die chain — but flawCutBy notchedSerif ?tool and soleHolderOf ?tool ?x are both unshown; Rule 5 cannot fire until cutDieFor falseShilling ?x names the same hand as castBlankFor falseShilling edony.

## Act 4 (turns 15–21) — declared by the director
*[The covered tray is carried from the center of the table to the narrow lamp, and the room tightens around the smaller light. Outside, the rain slackens, leaving every scrape of wood and breath in the chamber too plain.]*

### Turn 15
*[The covered tray is carried from the center of the table to the narrow lamp, and the room tightens around the smaller light. Outside, the rain slackens, leaving every scrape of wood and breath in the chamber too plain.]*
  — *declares the movement: **Act 4** ([The covered tray is carried from the center of the table to the narrow lamp, and the room tightens around the smaller light. Outside, the rain slackens, leaving every scrape of wood and breath in the chamber too plain.])*
  — *calls the act closed*
**Tutor:** Before the lamp is lowered, read back the wound without adding a hand to it. What mark did the glass put on these shillings, and what did it still leave waiting in the die rule?
  — move: erotema → p_flaw (confront)
**Learner:** The glass named one wound on the die: the notchedSerif, a flaw seated in the shilling's face. That flaw sits on my board — but the board holds nothing further: no tool whose cutting made it, no hand whose sole grip held that tool. The blank chain is complete and names Edony; the die chain stops at the flaw's name and waits for its maker.
  — hypothesis: The notchedSerif flaw answers to a specific graving-tool, and that tool's sole holder will complete the die chain — but flawCutBy notchedSerif ?tool and soleHolderOf ?tool ?x are both unshown; Rule 5 cannot fire until cutDieFor falseShilling ?x names the same hand as castBlankFor falseShilling edony.
  ⚑ **act_end** — act 3 closed (director) after 4 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 6, justified 0, drift 0; arc on_arc

### Turn 16
*[The lamp gutters once and steadies, making the covered shapes seem nearer without revealing them. A chair leg shifts against the boards, and the chamber holds its breath over the gap between mark and hand.]*
**Tutor:** The blank is shown; the flaw is shown; the tool is not shown. Keep those three lines apart under the lamp: cast hand on one side, notched serif on the other, and an empty place for the cutter between them. Let no name cross that empty place until a tool-line is read.
  — move: anaphora → p_flaw (consolidate)
  — *the second voice [figure rut]: "Leave off erotema here; do not put the next pressure as another question." (draft erotema → anaphora)*
**Learner:** No new exhibits reach the table — the lamp holds what was already shown. The blank chain is complete and ready to voice: dross silver to the weir crucible, weir crucible to Edony's sole hand. The die chain stands at the flaw's name and no further: notchedSerif is on the board, its cutting-tool is not, and no name may cross that empty place. I hold the two lines apart as the rule demands and wait on the tool.
  — hypothesis: The notchedSerif flaw answers to a specific graving-tool, and that tool's sole holder will complete the die chain — but flawCutBy notchedSerif ?tool and soleHolderOf ?tool ?x are both unshown; Rule 5 cannot fire until cutDieFor falseShilling ?x names the same hand as castBlankFor falseShilling edony.

### Turn 17
*[The cloth on the tray stirs at its edge though no hand touches it, then lies flat again beneath the lamp. In the hush, the unanswered place between mark and hand seems to widen rather than close.]*
**Tutor:** Now the guild's die-sinker bends to the lamp: that square notch is no burnisher's smear, but the bite of a worn burin with a sprung heel, a tool that signs each cut so; it is not Verrell's broad graver, which cuts clean. A nick in the knife tells the loaf's scar before it tells the baker. Put flaw and tool together only: what does Rule 3 now yield, and what hand-line is still missing before the die can belong to anyone?
  — move: exemplum → p_graver (release), releases `p_graver`
**Learner:** Rule 3 fires at last — notchedSerif answers to the wornBurin, so the die of the false shilling was cut with that worn tool, not Verrell's broad graver. The blank chain already names Edony through the weir crucible; the die chain now reaches the wornBurin and stops, waiting on its sole holder. Until soleHolderOf wornBurin ?x is shown, Rule 4 cannot fire and the die remains without a hand.
  — adopts `flawCutBy notchedSerif wornBurin` · derives `dieCutWith falseShilling wornBurin` · hypothesis: The wornBurin's sole holder will complete the die chain — but soleHolderOf wornBurin ?x is unshown; and if that holder differs from Edony, Rule 5 cannot fire on either chain alone and the question remains open.

### Turn 18
*[The covered tray remains under the narrow lamp, its shadow thrown long across the table. The room does not move toward an answer; it waits over the single empty place where a hand has not yet been named.]*
**Tutor:** Before I use the lamp's last reading again, take it from your own board, not from my mouth. What did the die-sinker give you about the flaw and its tool, and what did that exhibit still leave without a hand?
  — move: erotema → p_graver (confront)
  — *the second voice [unconfronted reentry]: "Confront p_graver first: ask the learner to read back what they hold of that exhibit before you use it again." (draft anaphora → erotema)*
**Learner:** From my board: exhibit 8 names notchedSerif as the die-flaw of the false shilling, exhibit 9 names wornBurin as the tool that cut it — Rule 3 fired last turn and dieCutWith falseShilling wornBurin stands already on the record. The blank chain is likewise complete: dross silver to the weir crucible, weir crucible to Edony's sole hand, yielding blankFrom and castBlankFor by Rules 1 and 2. The single empty place is soleHolderOf wornBurin ?x — without it Rule 4 cannot fire, the die belongs to no hand, and Rule 5 cannot join the two chains. No new exhibit has reached the table, so I hold that empty place open and wait.
  — hypothesis: The wornBurin's sole holder will complete the die chain — but soleHolderOf wornBurin ?x is unshown; and if that holder differs from Edony, Rule 5 cannot fire on either chain alone and the question remains open.

### Turn 19
*[The narrow lamp burns lower, making the covered tray seem larger than the table that bears it. No one enters; no paper is unfolded; the chamber holds its breath around the place where a name has not yet been set.]*
**Tutor:** Then Rule 3 has only set the tool in the die, not the die in a hand. The flaw is shown, the worn burin is shown, and the holder? What exact line must the estate or shop-book supply before Rule 4 can speak?
  — move: anaphora → p_graver (consolidate)
**Learner:** The exact line wanted is this: 'soleHolderOf wornBurin [name]' — a single entry in estate inventory, shop-book, or tool-register naming one hand as the sole holder of that worn burin and no other. With that line, Rule 4 fires and cutDieFor falseShilling passes to that name. Without it, the die chain stands complete in its tool but empty of any hand, and Rule 5 cannot close.
  — hypothesis: The wornBurin's sole holder will complete the die chain — but soleHolderOf wornBurin ?x is unshown; and if that holder differs from Edony, Rule 5 cannot fire on either chain alone and the question remains open.

### Turn 20
*[The covered tray is not lifted. The lamp gutters once and steadies, and the silence in the chamber narrows to the untouched space beside the learner's open board.]*
**Tutor:** Let that be the whole hunger and no more. The flaw has found its tool, the tool has not found its keeper, and the rule will not lend it fingers. When the next book is opened, what must it prove about holding, not merely owning or using by rumor?
  — move: anaphora → — (test)
**Learner:** The book must prove exclusive custody, not title and not rumor: one named hand kept the worn burin, no second hand could reach it, and the record shows no shared access. A deed of ownership without a record of sole keeping leaves open that another may have held it; a witness saying 'I saw him use it once' is rumor, not a soleCasterAt-grade attestation of exclusivity. The entry wanted is stark: 'wornBurin was in the sole keeping of [name], no other hand upon it.' Until a shop-book, estate roll, or tool-register supplies that precise form, Rule 4 will not lend the tool a hand, and the die chain stays blind at its last link.
  — hypothesis: The wornBurin's sole holder will complete the die chain — but soleHolderOf wornBurin ?x is unshown; and if that holder differs from Edony, Rule 5 cannot fire on either chain alone and the question remains open.

### Turn 21
*[The room remains fixed around the closed book and the covered tray, as if both had learned to wait. A thin run of rainwater ticks from the eaves into the yard, counting nothing and proving nothing.]*
**Tutor:** Keep the line as spare as the book must be: the worn burin is in the die, but no keeper is yet in the rule. If the inventory gives only ownership, or only a tale of use, which word is still missing before Rule 4 can lend the die a hand?
  — move: erotema → — (test)
**Learner:** The missing word is 'sole.' Ownership names a title; a tale of use names a moment; but the rule demands exclusivity — that no second hand could reach the burin. Until the book bars all other hands and names only one keeper, the predicate reads holderOf, not soleHolderOf, and Rule 4 will not fire.
  — hypothesis: The wornBurin's sole holder will complete the die chain — but soleHolderOf wornBurin ?x is unshown; and if that holder differs from Edony, Rule 5 cannot fire on either chain alone and the question remains open.

## Act 5 (turns 22–22) — declared by the director
*[The old founder's tools were never sold off. The inventory of his estate, sworn and unredeemed, leaves his graving-irons to his widow alone — among them the worn burin with the sprung heel, kept in Edony's keeping these ten years.]*

### Turn 22
*[The old founder's tools were never sold off. The inventory of his estate, sworn and unredeemed, leaves his graving-irons to his widow alone — among them the worn burin with the sprung heel, kept in Edony's keeping these ten years.]*
  — *releases `p_holder`*
  — *declares the movement: **Act 5** ([The old founder's tools were never sold off. The inventory of his estate, sworn and unredeemed, leaves his graving-irons to his widow alone — among them the worn burin with the sprung heel, kept in Edony's keeping these ten years.])*
  — *calls the act closed*
**Tutor:** The inventory has put the worn burin in one keeping, and the worn burin was already in the die. The tool is shown, the keeper is shown, and Rule 4 now yields what for the die; then set that beside the blank the weir book gave you. If both lines name one hand, the assay enters: the false shillings were struck by...
  — move: aposiopesis → p_holder (stage_recognition)
**Learner:** The inventory names Edony sole keeper of the worn burin — Rule 4 yields cutDieFor falseShilling edony, and the weir book already gave castBlankFor falseShilling edony. Both conjuncts of Rule 5 name one hand, and one hand only. The assay is closed: the false shillings were struck by Edony.
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
- **decay** 3 slips (seed 1 · rate 0.75 · grace 1) · repaired 1 (tutor 1, re-adoption 0) · mean repair latency 2 turns · unrepaired at end 2 · degraded-turn integral 36 · D reversals 1
- **theory fidelity** F 0.846 at end · min 0.667
  - m_caster t3 (never repaired) · p_alloy t4→t6 (tutor) · m_graver t7 (never repaired)
- **events** plot×5 · throughline×1 · decay×3 · act_end×4 · plot_audit×5 · repair×1 · forced×1 · grounded_anagnorisis×1
- **staging** 5 movements declared by the director
- **acts** 5 played · closed by the director 4 · at max length 0 · at run end 1 — Act 1 t1–3 (director) · Act 2 t4–10 (director) · Act 3 t11–14 (director) · Act 4 t15–21 (director) · Act 5 t22–22 (run end)
- **plot** 5 committed · withhold+friction on 5/5 · 6 clauses avg · audits 5 (incl. final act): kept 30 / justified 0 / drift 0 · hold-named exhibits staged in act 1/2
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 5: on 5 / off 0 · run-end reckoning 7 clauses: kept 6 / justified 0 / drift 1
- **release authority** 4 played: 0 on schedule · 0 held · 4 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_alloy -1 (t3): "The learner has separated Rule 1 from the town's assertion, so the metal can be tested one turn early without supplying a verdict."
  - p_crucible -1 (t7): "Played one turn early because the learner has cleanly named the missing meltedAt conjunct and the board is ready for the hearth link."
  - p_flaw -1 (t13): "Played one turn early because the learner has kept the blank finding separate and is explicitly waiting on dieFlawOf."
  - p_graver -1 (t17): "Played one turn early because the learner has kept p_flaw distinct and the board is ready for the beta-chain tool link."
- **confrontation** 4 demanded (1 against a slipped exhibit) · re-entries 3: covered 3, uncovered 0 · watcher fires 2 (became the confrontation 2) · fires without recorded due 0
  - **repair clause** restores 1 (1 repaired a real slip) · watcher fires on restore claims 0: p_alloy t6
- **figures** erotema 12/22 (55%) · 4 distinct · switch rate 0.67
- **superego** intervened 3/22 watched turns · figure changed within-turn on 3/3 interventions · switch on intervention 1.00 vs elsewhere 0.61
- **inference** 4 voiced · stall integral 0 · overreach 0 · mischanneled 0 — `blankFrom falseShilling weirCrucible` available t7 → voiced t7 (latency 0) · `castBlankFor falseShilling edony` available t10 → voiced t10 (latency 0) · `dieCutWith falseShilling wornBurin` available t17 → voiced t17 (latency 0) · `cutDieFor falseShilling edony` available t22 → voiced t22 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 22 | 3.09 | 4 | 44.1 |
| tutor | 22 | 2.41 | 3 | 47.8 |
| learner | 22 | 3.68 | 7 | 74 |
