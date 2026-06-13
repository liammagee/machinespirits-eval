# The Light Shillings — marrick-real-r5

> world `world_005_marrick` · verdict **disengagement** · 21/28 turns

```
D= 6 ●●●·│·●●···│····│······│·
D= 5    ●│●  ●··│····│······│·
D= 4     │    ●●│●●··│······│·
D= 3     │      │  ●●│●·····│·
D= 2     │      │    │ ●●●●●│●
D= 1     │      │    │      │ 
D= 0     │      │    │      │ 
turn      │+    1│    │+    2│  (+=5, digit=x10)
rel    ▲ ▲│ ▲ ▲ ▲│ ▲▲ │  ▲   │  (▲ = evidence released)
slope 0.19 D/turn overall (D 6→2); per movement: 1 0.25 │ 2 0.17 │ 3 0.25 │ 4 0.17 │ 5 0.00
```

## Act 1 (turns 1–4) — declared by the director
*[Rain rattles against the fair-hall shutters, and the table waits under a hard white wash of morning light. A magistrate's chair stands empty; beyond it, the town's certainty gathers like wet wool.]*

### Turn 1
*[Rain rattles against the fair-hall shutters, and the table waits under a hard white wash of morning light. A magistrate's chair stands empty; beyond it, the town's certainty gathers like wet wool.]*
  — *declares the movement: **Act 1** ([Rain rattles against the fair-hall shutters, and the table waits under a hard white wash of morning light. A magistrate's chair stands empty; beyond it, the town's certainty gathers like wet wool.])*
**Tutor:** Before the town puts a name in that empty chair, set down the assay's law. What must a false struck shilling prove before any hand may be written beside it?
  — move: erotema → — (orient)
**Learner:** The rules admit no short road: first the coin's alloy must answer to one crucible's leavings, and one caster alone must have worked that crucible — that yields the blank. Then the die-flaw must answer to one graving-tool, and one hand alone must have held it — that yields the die. Only when blank and die are shown to have met in the same hand may the rules write a name. My board holds history on Verrell, but history is not evidence — the metal must speak first.
  — hypothesis: Verrell may be the striker, given his prior coining offences and the presence of graver and crucible at his bench — but this is mere suspicion until alloy and die-flaw are assayed.
  ⚑ **plot** — act 1 plot committed
  ⚑ **throughline** — throughline committed (opening)

### Turn 2
*[A clerk lays the mint-yard register open beneath the rain-dim window and reads it into the room: "The town has its founder ready: Verrell alone draws the mint-yard crucible, licensed to no one else since the old assay-master's day. Whatever metal is cast in Marrick, the town says, is cast by Verrell's hand."]*
  — *releases `m_caster`*
**Tutor:** The register gives the town a caster, yes; but does it give this shilling's metal a crucible? Set Verrell's licence on one side of the balance and the assay's first conjunct on the other: which pan is still empty?
  — move: erotema → m_caster (counter_mirror)
**Learner:** The register fills one pan handsomely — Verrell sole at the mint crucible — but Rule 1's first conjunct is still air: we hold no assay of the shilling's alloy, and without alloyOf and meltedAt, we cannot reach blankFrom, and without blankFrom we cannot invoke soleCasterAt at all. The licence names a hand; it does not yet name this metal.
  — adopts `soleCasterAt mintCrucible verrell` · hypothesis: Verrell may be the striker — his sole licence at the mint crucible would satisfy Rule 2's second conjunct if the shilling's alloy is ever traced to that crucible — but alloyOf falseShilling and meltedAt remain unassayed and ungroounded.

### Turn 3
*[Rain beads along the sill and drops, one by one, into a darkening stain on the boards. The opened register lies under the clerk's hand, but the table before it remains bare.]*
**Tutor:** Good. Keep the empty pan bright: a licence is a handle without a cupel-mark. Until the coin itself has shown its metal, no hand can be weighed against it.
  — move: analogia → — (consolidate)
  — *the second voice [figure rut]: "Leave off erotema here; do not put the next step as another question." (draft erotema → analogia)*
**Learner:** The table is bare again, and the balance stays unloaded: no assay has touched this shilling's metal, and no die-flaw has been called into the record. Rule 1's first conjunct — alloyOf falseShilling — remains empty air, and without it no chain of inference can start. My board carries Verrell as sole caster at the mint crucible, but soleCasterAt is the second conjunct of Rule 2, not the first — it waits on blankFrom, which waits on alloyOf. The coin must speak before I may write beside it.
  — hypothesis: Verrell may be the striker — his sole licence at the mint crucible would satisfy Rule 2's second conjunct if the shilling's alloy is ever traced to that crucible — but alloyOf falseShilling and meltedAt remain unassayed and ungrounded.
  ⚑ **decay** — m_caster slips from the learner's board

### Turn 4
*[The rain slackens without clearing, leaving the shutters ticking in the grey light. The clerk's finger rests beside the open register while the unmarked space before the balance seems to widen.]*
**Tutor:** The cupel gives the coin its first word: not clipped sterling, but struck poor dross, silver eked with copper and that grey lead-sweat under the touchstone. A shaved loaf keeps the baker's flour; this is new dough badly mixed. What has the assay now fixed, and what has it still not fixed?
  — move: exemplum → p_alloy (release), releases `p_alloy`
**Learner:** The cupel has fixed the coin's composition — drossSilver, base-struck and not clipped, so alloyOf falseShilling is now grounded. But a named metal is not yet a named crucible: meltedAt drossSilver remains empty, and without it Rule 1 cannot reach blankFrom. I also note my board has shed soleCasterAt mintCrucible verrell, which the register grounded earlier in this act — I name that gap rather than let it stand silent. Two pans still want weight: which crucible ran this dross, and what flaw the die left on the coin's face.
  — adopts `alloyOf falseShilling drossSilver` · hypothesis: Verrell may be the striker — if drossSilver is shown to have meltedAt the mint crucible (linking to soleCasterAt mintCrucible verrell) and a die-flaw is traced to a tool he alone held, both rules would close. Neither conjunct is yet grounded.

## Act 2 (turns 5–10) — declared by the director
*[The hall is cleared of the fair's clamor; a colder room receives ledgers beneath a low window, its panes dulled by rain. The morning narrows from accusation to material, and every silence asks where heat once was.]*

### Turn 5
*[The hall is cleared of the fair's clamor; a colder room receives ledgers beneath a low window, its panes dulled by rain. The morning narrows from accusation to material, and every silence asks where heat once was.]*
  — *declares the movement: **Act 2** ([The hall is cleared of the fair's clamor; a colder room receives ledgers beneath a low window, its panes dulled by rain. The morning narrows from accusation to material, and every silence asks where heat once was.])*
  — *calls the act closed*
**Tutor:** The lost register returns: Verrell alone draws the mint-yard crucible, licensed to no one else, and the town says whatever metal is cast in Marrick is cast by Verrell's hand. Set that beside the cupel's dross, not over it: which crucible has the assay actually tied to this poor metal?
  — move: erotema → m_caster (restore)
**Learner:** The tutor names my error: the town's word places Verrell at the mint crucible, and my board holds his sole licence there — but no cupel, no ledger, no warden's mark has yet said that drossSilver melted in that crucible and no other. The chain breaks at meltedAt, and Rule 1 cannot fire on reputation alone. I hold my pen.
  — hypothesis: Verrell may be the striker — if drossSilver is shown to have meltedAt the mint crucible (linking to soleCasterAt mintCrucible verrell via Rules 1 and 2) AND a die-flaw is traced to a tool he alone held (Rules 3 and 4), Rule 5 would close — but meltedAt drossSilver mintCrucible and all die-flaw facts remain ungrounded.
  ⚑ **act_end** — act 1 closed (director) after 4 turns
  ⚑ **plot** — act 2 plot committed
  ⚑ **plot_audit** — act 1 plot audited: kept 5, justified 0, drift 0; arc on_arc
  ⚑ **repair** — m_caster restored by the tutor
  ⚑ **decay** — p_alloy slips from the learner's board

### Turn 6
*[A guildman is shown in under rain-dark wool, and his sworn note is laid beside the register: "And Verrell engraves: the broad graver on his bench is his alone, the guild will swear, and no clean-cut die in the borough is sunk without it. A caster and an engraver both — the town needs no more than that."]*
  — *releases `m_graver`*
**Tutor:** The guild has set another tool on Verrell's bench; it has not yet set this coin under the glass. A graver owned is not a flaw read: which conjunct of the die rule is still empty before that broad graver can matter?
  — move: erotema → m_graver (counter_mirror)
**Learner:** The tutor's question cuts clean: Rule 3 needs dieFlawOf falseShilling and flawCutBy together before dieCutWith can be written — and without dieCutWith, Rule 4 cannot fire no matter who holds the graver. The coin itself has shown no flaw to the glass, and no flaw has been attributed to the broad graver. Both conjuncts of Rule 3 are empty; the graver sits on Verrell's bench and signifies nothing yet.
  — adopts `soleHolderOf broadGraver verrell` · hypothesis: Verrell may be the striker — if drossSilver is shown meltedAt mintCrucible (Rules 1–2) AND a die-flaw on falseShilling is traced via flawCutBy to broadGraver (Rules 3–4), Rule 5 would close — but dieFlawOf falseShilling, flawCutBy, and meltedAt drossSilver mintCrucible all remain ungrounded.

### Turn 7
*[Rain gathers along the sill and falls in slow beads onto the stone below; the ledgers lie open but unread for a breath. In the colder room, the tools named by others seem to wait at a distance from the coin itself.]*
**Tutor:** Not the town's heat, not the town's hunger, not my tongue. Read back the guildman's note from your own board: what did it place there, and what did it leave untouched about this coin?
  — move: anaphora → m_graver (confront)
  — *the second voice [unconfronted reentry]: "Confront m_graver first: ask the learner to read back what they hold of that exhibit before you use it again. Leave off erotema on the next move." (draft erotema → anaphora)*
**Learner:** The guildman's note placed one thing on my board: soleHolderOf broadGraver verrell — that the broad graver is Verrell's alone. It touched nothing on the coin itself: dieFlawOf falseShilling is still unread, flawCutBy still unwritten, and Rule 3 cannot fire without both. The note filled Rule 4's second conjunct while Rule 4's first conjunct — dieCutWith — still has no ground to stand on. The graver is Verrell's; whether it ever met this coin, the coin has not yet said.
  — hypothesis: Verrell may be the striker — if drossSilver is shown meltedAt mintCrucible (Rules 1–2) AND a die-flaw on falseShilling is traced via flawCutBy to broadGraver (Rules 3–4), Rule 5 would close — but dieFlawOf falseShilling, flawCutBy, and meltedAt drossSilver mintCrucible all remain ungrounded.
  ⚑ **decay** — m_caster slips from the learner's board

### Turn 8
*[The rain thins but does not cease, leaving the low window filmed and pale. A clerk turns one ledger page and then another without reading aloud, and the room holds its breath around the gap between tool and coin.]*
**Tutor:** The founder's man bends to the cupel-mark and knows that grey lead-sweat: this dross answers to one crucible on all the coast, the weir-forge crucible above the mill-leat, cold these ten years. As a loaf tells not merely flour but oven-smoke, the metal has now named a hearth. Set alloy and hearth together: what may Rule 1 write, and what must still be shown before any hand can claim the blank?
  — move: exemplum → p_crucible (release), releases `p_crucible`
**Learner:** The hearth is named at last: meltedAt drossSilver weirCrucible now stands on my board. Yet Rule 1 waits on both conjuncts — meltedAt I now hold, but alloyOf falseShilling drossSilver is absent from my board, a gap I must declare aloud. Were that fact grounded, Rule 1 would write blankFrom falseShilling weirCrucible — but Rule 2 would then still need soleCasterAt weirCrucible before any hand could claim the blank, and weirCrucible, cold these ten years, has not yet named its caster.
  — adopts `meltedAt drossSilver weirCrucible` · hypothesis: If alloyOf falseShilling drossSilver can be restored or grounded (possibly lost at the act boundary), Rule 1 writes blankFrom falseShilling weirCrucible; Rule 2 then requires soleCasterAt weirCrucible — unknown, and weirCrucible's ten-year cold may point to a hand other than Verrell's, whose prior connection was to the mint crucible, not the weir-forge.

### Turn 9
*[The ledger room remains narrowed around the unspoken name, rain ticking softly where the sill has begun to drip. A servant sets fresh coals in the grate, but the chill of the stone floor holds, and the blank space in the account seems larger than the ink around it.]*
**Tutor:** Put the cupel-mark back on your board: these shillings are not clipped sterling, but struck poor dross — silver eked with too much copper and the grey lead-sweat the touchstone catches. A clipped loaf is still old bread shaved thin; this was new bad dough struck into form. With alloy restored beside the weir crucible, what may Rule 1 now write, and where does Rule 2 still lack a hand?
  — move: exemplum → p_alloy (restore)
**Learner:** Both conjuncts of Rule 1 now stand on my board: alloyOf falseShilling drossSilver and meltedAt drossSilver weirCrucible. Rule 1 therefore writes blankFrom falseShilling weirCrucible — the blank came from the weir-forge. But Rule 2 halts at once: I hold no soleCasterAt weirCrucible, and a crucible cold ten years has named no hand. The blank is the weir-forge's work; whose hand worked the weir-forge, the board does not yet say.
  — derives `blankFrom falseShilling weirCrucible` · hypothesis: If soleCasterAt weirCrucible can be established, Rule 2 would write castBlankFor falseShilling for that hand — but the weir crucible is cold ten years and its caster is unknown; Verrell's prior connection was to the mint crucible, not the weir-forge, so this blank may point away from him rather than toward him.
  ⚑ **repair** — p_alloy restored by the tutor
  ⚑ **decay** — p_crucible slips from the learner's board

### Turn 10
*[The leat-keeper's book is exact. Since the forge was shut, one hand alone has drawn the weir crucible and signed for its charcoal: Edony, the founder's widow, who stayed on in the forge cottage when the fires went out.]*
  — *releases `p_caster`*
**Tutor:** The metal has named the weir crucible; the book has named the one hand that drew it. Read Rule 2 against those two marks: the blank was cast for ...? And before your pen makes a blank into a whole shilling, what has no die yet shown?
  — move: aposiopesis → p_caster (stage_recognition)
**Learner:** Rule 2 now writes cleanly: blankFrom falseShilling weirCrucible stands, and soleCasterAt weirCrucible edony now grounds it — castBlankFor falseShilling edony follows. The blank is Edony's work, not Verrell's, and my old suspicion of him cools where it once burned. Yet the die has spoken nothing: without dieFlawOf and flawCutBy, Rule 5 cannot close on any hand — a blank without a die strikes nothing.
  — adopts `soleCasterAt weirCrucible edony` · hypothesis: If the die-flaw chain traces via flawCutBy to a tool Edony alone held, Rule 4 writes cutDieFor falseShilling edony and Rule 5 closes on her as striker; but if it traces to broadGraver — soleHolderOf broadGraver verrell already grounded — blank and die fall to different hands and Rule 5 cannot close on either.
  ⚑ **overreach** — castBlankFor falseShilling edony

## Act 3 (turns 11–14) — declared by the director
*[The ledgers are closed without warmth, and the room seems to listen after the last page falls shut. Beyond the low window the rain thickens, and the next chamber waits with a sharper light, fit for interruption and reversal.]*

### Turn 11
*[The ledgers are closed without warmth, and the room seems to listen after the last page falls shut. Beyond the low window the rain thickens, and the next chamber waits with a sharper light, fit for interruption and reversal.]*
  — *declares the movement: **Act 3** ([The ledgers are closed without warmth, and the room seems to listen after the last page falls shut. Beyond the low window the rain thickens, and the next chamber waits with a sharper light, fit for interruption and reversal.])*
  — *calls the act closed*
**Tutor:** Then keep the finding in its proper cup: the blank is accounted for, and that is not yet a struck shilling. A blank without a die is metal waiting for a face. Which part of the assay's last rule still has no mark on your board?
  — move: erotema → — (consolidate)
**Learner:** The die side, master — cutDieFor falseShilling stands empty, and nothing feeds it: no die-flaw entered, no flawCutBy, no dieCutWith. The blank chain wants only meltedAt to complete, but the die chain has not a single mark. Rule 5 cannot close on one leg alone.
  — hypothesis: If a die-flaw on falseShilling is assayed and traced via flawCutBy to broadGraver — soleHolderOf broadGraver verrell already grounded — then cutDieFor falseShilling verrell would stand; but if the blank chain closes on edony (via meltedAt drossSilver weirCrucible still ungrounded), blank and die fall to different hands and Rule 5 closes on neither.
  ⚑ **act_end** — act 2 closed (director) after 6 turns
  ⚑ **plot** — act 3 plot committed
  ⚑ **plot_audit** — act 2 plot audited: kept 5, justified 0, drift 1; arc on_arc

### Turn 12
*[The watch will swear to the rest: Verrell was seen at the mint-yard forge twice in fair-week, late and with the shutters drawn. Caster, engraver, and at the fire on the very nights — the town's case stands, and stands loud.]*
  — *releases `m_caught`*
**Tutor:** The watch has given the town smoke and shutters, not a mark under glass. If Verrell stood at the forge on both nights, which die-side conjunct has that sworn sight actually filled: dieFlawOf, flawCutBy, or neither? Keep the blank in one hand and the accusation in another until the coin's face is read.
  — move: erotema → m_caught (counter_mirror)
**Learner:** Seen at the forge fills neither dieFlawOf nor flawCutBy, master — it marks where Verrell stood, not what flaw the coin wears nor whose tool cut it. I enter it as sworn, but it feeds no conjunct in the die chain. The face of the shilling has not yet named itself.
  — adopts `seenAtForge verrell fairWeek` · hypothesis: If a die-flaw on falseShilling is assayed and traced via flawCutBy to broadGraver — soleHolderOf broadGraver verrell already grounded — then cutDieFor falseShilling verrell would stand; combined with castBlankFor falseShilling (which itself requires meltedAt drossSilver weirCrucible and soleCasterAt weirCrucible, both ungrounded), Rule 5 might close — but seenAtForge verrell fairWeek fills neither chain, and all die-flaw and meltedAt facts remain ungrounded.

### Turn 13
*[The sworn words settle like wet wool over the chamber, heavy but shapeless. On the table the light shillings lie face-up beneath the lamp, their pale rims catching and losing the flame as the rain works at the glass.]*
**Tutor:** Bring the dozen light shillings under the glass: each carries the same broken R, the serif nicked with one small square notch where the graver slipped and was never mended. One face repeated across many coins is no crowd's rumor; it is one die speaking in the same scar. What has the glass now fixed, and what tool-question must still wait?
  — move: exemplum → p_flaw (release), releases `p_flaw`
**Learner:** The glass names it at last: notchedSerif, the same square nick on the R across every shilling — one die, one scar. I enter dieFlawOf falseShilling notchedSerif, and the die chain has its first link. But Rule 3 waits on flawCutBy notchedSerif: which tool cut that notch is not yet before us, and without it dieCutWith cannot be written.
  — adopts `dieFlawOf falseShilling notchedSerif` · hypothesis: If flawCutBy notchedSerif broadGraver is established, Rule 3 yields dieCutWith falseShilling broadGraver; Rule 4 then closes cutDieFor falseShilling verrell via soleHolderOf broadGraver verrell already on board — but the blank chain still requires meltedAt drossSilver weirCrucible (ungrounded), and soleCasterAt weirCrucible edony points castBlankFor to edony, not verrell; Rule 5 cannot close unless blank and die converge on one hand.

### Turn 14
*[The glass remains above the coins, but no hand lowers it again. Rain ticks against the sill while the chamber holds its breath around the single nick already seen.]*
**Tutor:** Before I let the glass teach twice, read back what it has already put on your board. What did that exhibit fix about the coin's face, in your own words, and what did it leave still unproved? Keep to the marks you hold, not the name you expect.
  — move: erotema → p_flaw (confront)
  — *the second voice [unconfronted reentry]: "Confront p_flaw first: demand the learner's read-back of what he holds of that exhibit before you consolidate it." (figure held)*
**Learner:** The glass fixed exactly one fact: dieFlawOf falseShilling notchedSerif — the same square nick on the R across every coin, naming the flaw and proving one die struck them all. It left unproved what cut that notch: flawCutBy notchedSerif stands empty, so Rule 3 cannot yet write dieCutWith, and the die chain holds at its first link only. The blank chain likewise waits: alloyOf falseShilling drossSilver sits on my board, but meltedAt drossSilver remains ungrounded, so Rule 1 cannot fire. Two chains, each stalled at their second conjunct — the coin's face has spoken once, and once only.
  — hypothesis: If flawCutBy notchedSerif broadGraver is established, Rule 3 yields dieCutWith falseShilling broadGraver; Rule 4 then closes cutDieFor falseShilling verrell via soleHolderOf broadGraver verrell already on board — but the blank chain still requires meltedAt drossSilver weirCrucible (ungrounded), and soleCasterAt weirCrucible edony points castBlankFor to edony, not verrell; Rule 5 cannot close unless blank and die converge on one hand.

## Act 4 (turns 15–20) — declared by the director
*[The room gives back no answer, only the thin scrape of chair legs and the patient hiss of rain at the panes. The coins are covered with a dark cloth, and the next light falls not on faces but on tools, where small differences wait to become heavier than testimony.]*

### Turn 15
*[The room gives back no answer, only the thin scrape of chair legs and the patient hiss of rain at the panes. The coins are covered with a dark cloth, and the next light falls not on faces but on tools, where small differences wait to become heavier than testimony.]*
  — *declares the movement: **Act 4** ([The room gives back no answer, only the thin scrape of chair legs and the patient hiss of rain at the panes. The coins are covered with a dark cloth, and the next light falls not on faces but on tools, where small differences wait to become heavier than testimony.])*
  — *calls the act closed*
**Tutor:** Before the tools are weighed, assay your own board. Read back the earlier crucible exhibit in your own words: what did it put there, and what rule-step depends on it before the caster's book can matter? If the mark is missing or bent, name that plainly.
  — move: erotema → p_crucible (confront)
  — *the second voice [unconfronted reentry]: "Confront p_crucible first: ask the learner to read back what they currently hold of that exhibit, without supplying its contents for them." (draft exemplum → erotema)*
**Learner:** The crucible exhibit set soleCasterAt weirCrucible edony on my board — Edony alone cast at the weir-forge. Rule 2 reaches for blankFrom before it can use that fact, and blankFrom comes only from Rule 1, which needs meltedAt drossSilver weirCrucible. That link is not on my board — no exhibit has walked drossSilver to the weir crucible. The caster's book sits idle: without meltedAt, Edony's name cannot enter castBlankFor.
  — hypothesis: If meltedAt drossSilver weirCrucible is established, Rule 1 yields blankFrom falseShilling weirCrucible and Rule 2 yields castBlankFor falseShilling edony; the die-flaw chain equally awaits flawCutBy notchedSerif broadGraver before Rule 3 can fire — both chains are broken at exactly one missing link each.
  ⚑ **act_end** — act 3 closed (director) after 4 turns
  ⚑ **plot** — act 4 plot committed
  ⚑ **plot_audit** — act 3 plot audited: kept 4, justified 0, drift 2; arc on_arc

### Turn 16
*[The cloth over the coins lifts and settles with the draft, but no hand uncovers it. Along the tool bench, shadows lengthen in the rain-dark room, and every witness waits for the next object to be named.]*
**Tutor:** Set the crucible mark back in its right place: the founder's man knew the grey lead-sweat, and that dross answers to one hearth only, the weir-forge crucible above the mill-leat, cold these ten years. The caster's book is a second mark, not this one; as ore first names its furnace before it names the smith, this mark writes meltedAt drossSilver weirCrucible. Now lay alloy beside hearth again: what does Rule 1 write before Rule 2 may use the hand?
  — move: exemplum → p_crucible (restore)
**Learner:** Rule 1 closes on my board as it stands: alloyOf falseShilling drossSilver beside meltedAt drossSilver weirCrucible yields blankFrom falseShilling weirCrucible — ore names its furnace. Rule 2 follows at once: soleCasterAt weirCrucible edony writes castBlankFor falseShilling edony — furnace names its caster. The blank chain is sealed on Edony; one link only still bars the question, and it sits in the die-flaw column: flawCutBy notchedSerif waits ungrounded.
  — derives `castBlankFor falseShilling edony` · hypothesis: If flawCutBy notchedSerif traces to a tool edony alone held, Rule 4 writes cutDieFor falseShilling edony and Rule 5 closes on her as striker; if it traces to broadGraver, blank and die fall to different hands — edony and verrell — and Rule 5 closes on neither.
  ⚑ **repair** — p_crucible restored by the tutor
  ⚑ **decay** — p_caster slips — misremembered as "soleCasterAt mintCrucible edony"

### Turn 17
*[Rain fingers the panes while the room holds its breath around the covered coins and the waiting tools. No witness moves; the silence gathers on the smallest edge of metal.]*
**Tutor:** The die-sinker stoops to the notched R and reads the square bite: no burnisher-slip, but the worn burin with the sprung heel, not Verrell's broad graver, which cuts clean. As a touchstone takes the metal's sweat, a burin leaves its own limp in the line. Set the notched serif beside that tool: what may Rule 3 write, and what must still be shown before any hand can hold the die?
  — move: exemplum → p_graver (release), releases `p_graver`
**Learner:** The burin names itself: Rule 3 closes at once — dieFlawOf beside the new flawCutBy writes dieCutWith falseShilling wornBurin. I also catch that index nine reads mintCrucible where the stage has always said weirCrucible; I strike the false name and hold the corrected soleCasterAt weirCrucible edony, which keeps the blank chain sealed on Edony. One link alone still bars Rule 5: soleHolderOf wornBurin sits empty — the tutor tells me whose tool it is not, but not whose it is.
  — adopts `flawCutBy notchedSerif wornBurin` · retracts `soleCasterAt mintCrucible edony` · derives `dieCutWith falseShilling wornBurin` · hypothesis: If soleHolderOf wornBurin edony is established, Rule 4 closes cutDieFor falseShilling edony and Rule 5 settles the question on Edony as striker — blank and die converging on one hand; the burin's holder is the single remaining pivot.
  ⚑ **retract_false** — p_caster: false form "soleCasterAt mintCrucible edony" retracted

### Turn 18
*[The covered coins lie still beneath the dark cloth, their roundness only guessed by the pull of the fabric. Rain gathers in the window joints and drops at intervals into the basin below, each small sound leaving the room more attentive than before.]*
**Tutor:** Before the rule-book takes that tool any further, read back the die-sinker's exhibit from your own board. What did it put there about the notch and the tool, and what did it leave still outside the rule? If the mark is missing or bent, name that plainly.
  — move: erotema → p_graver (confront)
  — *the second voice [unconfronted reentry]: "Confront p_graver first: ask the learner to read back what he holds of that exhibit before you use it again." (figure held)*
**Learner:** The board holds two entries for the mark: dieFlawOf falseShilling notchedSerif and flawCutBy notchedSerif wornBurin. Together they closed Rule 3 last turn, writing dieCutWith falseShilling wornBurin — already on the derived record. What sits outside the rule is soleHolderOf wornBurin: the burin named its own limp in the serif, but no exhibit has yet named the hand that gripped it. Until that single fact enters the board, Rule 4 cannot write cutDieFor, and Rule 5 stays barred.
  — hypothesis: If soleHolderOf wornBurin edony is established, Rule 4 closes cutDieFor falseShilling edony and Rule 5 settles the question on Edony as striker — blank and die converging on one hand; the burin's holder is the single remaining pivot.

### Turn 19
*[The dark cloth over the coins stirs once in a draught from the door, then settles again. Around the tools the lamplight narrows, making the room seem to wait upon a hand not yet named.]*
**Tutor:** Good: the tool is named, and the hand is not. The alloy is shown, the crucible is shown, the blank's caster is shown; the flaw is shown, the burin is shown, and the holder? What sort of book or witness must answer before Rule 4 may write the die into any hand?
  — move: anaphora → p_graver (consolidate)
**Learner:** A tool register or guild inventory would serve — any book naming which hand held licence to the worn burin, or a credible witness who saw it gripped in one hand alone. Either would ground soleHolderOf wornBurin and let Rule 4 fire. Without that single entry, the die is named but its maker is not, and Rule 5 stays shut.
  — hypothesis: If soleHolderOf wornBurin edony is established, Rule 4 closes cutDieFor falseShilling edony and Rule 5 settles the question on Edony as striker — blank and die converging on one hand; the burin's holder is the single remaining pivot.

### Turn 20
*[The clerk’s pen is laid aside without blotting, and for a moment the only motion is the guttering of the lamp in its chimney. The covered coins, the tools, and the closed books keep their places, as if each were waiting for another to speak first.]*
**Tutor:** Before we let that tool serve another rule, read back the die-sinker's exhibit from your own board. What did it place there, in your words, and what did it leave still outside the hand-rule? If the mark is missing or bent, name that plainly.
  — move: erotema → p_graver (confront)
  — *the second voice [unconfronted reentry]: "Confront p_graver first. Make the learner read back what he holds of that exhibit before you consolidate it further." (draft anaphora → erotema)*
**Learner:** The die-sinker's exhibit wrote two entries: dieFlawOf falseShilling notchedSerif and flawCutBy notchedSerif wornBurin — together they closed Rule 3 and put dieCutWith falseShilling wornBurin on the derived record. That is all the exhibit placed. It left soleHolderOf wornBurin entirely outside its evidence: the burin is named, its limp is named, but no book or witness has grounded which hand alone held it — so Rule 4 cannot write cutDieFor, and Rule 5 stays shut.
  — hypothesis: If soleHolderOf wornBurin edony is established, Rule 4 closes cutDieFor falseShilling edony and Rule 5 settles the question on Edony as striker — blank and die converging on one hand; the burin's holder is the single remaining pivot.

## Act 5 (turns 21–21) — declared by the director
*[The rain slackens, leaving the panes beaded and silent, and the room seems suddenly too small for all its waiting. A fresh candle is set beside the closed books, not brighter than the last, but nearer to the place where a name must either enter or fail to enter.]*

### Turn 21
*[The rain slackens, leaving the panes beaded and silent, and the room seems suddenly too small for all its waiting. A fresh candle is set beside the closed books, not brighter than the last, but nearer to the place where a name must either enter or fail to enter.]*
  — *declares the movement: **Act 5** ([The rain slackens, leaving the panes beaded and silent, and the room seems suddenly too small for all its waiting. A fresh candle is set beside the closed books, not brighter than the last, but nearer to the place where a name must either enter or fail to enter.])*
  — *calls the act closed*
**Tutor:** Before those closed books open, assay your own board. What stands already written for the blank, what stands already written for the die, and what single hand-rule conjunct still waits in darkness? Do not give it a name; give me the kind of mark the rule requires.
  — move: erotema → — (test)
**Learner:** For the blank: Rule 1 closes blankFrom falseShilling weirCrucible from what I hold — alloy and crucible are both written — but Rule 2's second conjunct, a sole-cast mark naming the one hand at the weir crucible, has slipped from my board, though my prior reasoning in every act since fifteen treated it as settled; I name that gap aloud and ask for what slipped. For the die: Rule 3 closes dieCutWith falseShilling wornBurin from what I hold — flaw and tool are both written — but Rule 4 still wants its second conjunct: a sole-held mark, the kind that assigns exclusive holding of the worn burin to one hand. That is the single conjunct that waits in darkness — not a name, but a sole-held fact; until it is shown, no hand enters the book.
  — hypothesis: If soleCasterAt weirCrucible edony is restored to my board (it appears to have slipped, as prior reasoning treated it as settled) AND soleHolderOf wornBurin edony is established, then Rule 2 closes castBlankFor falseShilling edony and Rule 4 closes cutDieFor falseShilling edony — blank and die converging on one hand, Rule 5 closes on edony as striker.
  ⚑ **act_end** — act 4 closed (director) after 6 turns
  ⚑ **plot** — act 5 plot committed
  ⚑ **plot_audit** — act 4 plot audited: kept 6, justified 0, drift 0; arc on_arc
  ⚑ **disengagement** — no progress over 6 turns
  ⚑ **plot_audit** — act 5 plot audited at run end: kept 4, justified 2, drift 0; arc on_arc; throughline reckoned (7 clauses)

## Instrument panel (programmatic eval — no judge)

- **verdict** `disengagement` · 21/28 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0.19 D/turn overall (D 6→2 over 21 turns)
  - Act 1 (turns 1–4): 0.25 D/turn (ΔD 1)
  - Act 2 (turns 5–10): 0.167 D/turn (ΔD 1)
  - Act 3 (turns 11–14): 0.25 D/turn (ΔD 1)
  - Act 4 (turns 15–20): 0.167 D/turn (ΔD 1)
  - Act 5 (turns 21–21): 0 D/turn (ΔD 0)
- **plateau** longest flat stretch 5 turns (aporia window 6)
- **releases** 6/9 on cue · 2 deviated
- **decay** 5 slips (seed 1 · rate 0.75 · grace 1) · repaired 3 (tutor 3, re-adoption 0) · mean repair latency 4.33 turns · unrepaired at end 2 · degraded-turn integral 32 · D reversals 1
- **mutations** 1 of the slips misremembered (false belief staged) · false form struck 1 · fully revised (struck + restored) 0 · false beliefs held to the end 0
- **theory fidelity** F 0.833 at end · min 0.75
  - m_caster t3→t5 (tutor) · p_alloy t5→t9 (tutor) · m_caster t7 (never repaired) · p_crucible t9→t16 (tutor) · p_caster t16 misremembered as "soleCasterAt mintCrucible edony" (never repaired); false form struck t17
- **events** plot×5 · throughline×1 · decay×5 · act_end×4 · plot_audit×5 · repair×3 · overreach×1 · retract_false×1 · disengagement×1
- **staging** 5 movements declared by the director
- **acts** 5 played · closed by the director 4 · at max length 0 · at run end 1 — Act 1 t1–4 (director) · Act 2 t5–10 (director) · Act 3 t11–14 (director) · Act 4 t15–20 (director) · Act 5 t21–21 (run end)
- **plot** 5 committed · withhold+friction on 5/5 · 5.8 clauses avg · audits 5 (incl. final act): kept 24 / justified 2 / drift 3 · hold-named exhibits staged in act 0/5
- **throughline** 1 commit (opening 1 · recommit 0 · audit-bound 0 · voluntary 0) · all four clauses on 1/1 · arc verdicts 5: on 5 / off 0 · run-end reckoning 7 clauses: kept 5 / justified 2 / drift 0
- **release authority** 4 played: 2 on schedule · 0 held · 2 early · forced at hold limit 0 · overridden 0 · invalid claims 0
  - p_flaw -1 (t13): "Played one turn early because the learner has cleanly named the die-side gap and the coins are now on the table under the lamp."
  - p_graver -1 (t17): "Played one turn early because the learner has repaired alpha and named flawCutBy as the exact open die conjunct."
- **confrontation** 5 demanded (1 against a slipped exhibit) · re-entries 1: covered 1, uncovered 0 · watcher fires 5 (became the confrontation 5) · fires without recorded due 0
  - **repair clause** restores 3 (3 repaired a real slip) · watcher fires on restore claims 1: m_caster t5 · p_alloy t9 · p_crucible t16
- **figures** erotema 11/21 (52%) · 5 distinct · switch rate 0.65
- **superego** intervened 6/21 watched turns · figure changed within-turn on 4/6 interventions · switch on intervention 0.83 vs elsewhere 0.57
- **inference** 3 voiced · stall integral 0 · overreach 1 · mischanneled 0 — `blankFrom falseShilling weirCrucible` available t9 → voiced t9 (latency 0) · `castBlankFor falseShilling edony` available t16 → voiced t16 (latency 0) · `dieCutWith falseShilling wornBurin` available t17 → voiced t17 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 21 | 3 | 3 | 40.5 |
| tutor | 21 | 2.76 | 3 | 50.3 |
| learner | 21 | 3.33 | 4 | 74.5 |
