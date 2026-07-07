# The Unsigned Nocturne — noc-decay-v1-B-s2

> world `world_001_nocturne` · verdict **aporia** · 39/40 turns

```
D= 7 ●●●●●···│········│···········│············
D= 6      ●●●│·●●●●···│···········│············
D= 5         │●    ●●●│···········│············
D= 4         │        │●●●········│············
D= 3         │        │   ●●●●●●··│············
D= 2         │        │         ●●│●●●●········
D= 1         │        │           │    ●●●●●●●●
D= 0         │        │           │            
turn      +   │ 1    + │   2    +  │  3    +     (+=5, digit=x10)
rel     ▲  ▲  │▲  ▲ ▲  │▲  ▲  ▲  ▲ │ ▲  ▲        (▲ = evidence released)
slope 0.15 D/turn overall (D 7→1); per movement: 1 0.13 │ 2 0.13 │ 3 0.27 │ 4 0.08
```

## Movement I — The Verdict of Style (turns 1–8) — declared by the director
*To let the room gather around certainty before the material record begins to disturb it.*

### Turn 1
*[Rain ticks against the high windows of the Cassia Conservatory, and the long table waits beneath a green-shaded lamp. Chairs face inward as if the room itself has been summoned to judgment.]*
  — *declares the movement: **Movement I — The Verdict of Style** (To let the room gather around certainty before the material record begins to disturb it.)*
**Tutor:** Before we reach for a famous hand, what do we actually have on the table: an unsigned nocturne, an archive, and a conservatory. Which of those is evidence of authorship, and which is only the room where the question begins?
  — move: erotema → — (orient)
**Learner:** Four facts on the board, none of them authorship. 'FoundIn' names a location, not a hand. 'Unsigned' is precisely the absence of evidence. 'MaestroOf' tells me Vess presides — it does not place his pen on that leaf. I have a room and a question; I do not yet have evidence.
  — hypothesis: Vess composed the nocturne — the conservatory's first thought, not yet grounded in any rule

### Turn 2
*[The green lamp hums over the empty space where an answer wants to stand, and rainwater threads down the dark glass in wavering lines. No one moves the papers yet; the room holds its breath around the unsigned page.]*
**Tutor:** Good; keep Vess as a hypothesis, not a verdict. Under the rules you know, what would first turn this room from a place into a possible time of writing?
  — move: erotema → — (test)
**Learner:** To move from room to period, the rules give me two handles: the paper's watermark tied to a stock used only during one period, or the ink tied to a batch mixed only during one period. Right now I have neither — no watermark fact, no ink fact. Until one of those lands on my board, 'writtenDuring' stays empty, and Rule 3 cannot tell me who could have written it. A time of writing is the first stone; without it the whole chain of attribution cannot begin.
  — hypothesis: Vess composed the nocturne — the conservatory's first thought, not yet grounded in any rule

### Turn 3
*[The doors open one by one, and the musicians are shown the leaves beneath the green lamp. Every musician shown the leaves says the same: this is Vess's late manner — the suspensions, the long pedal, the way the bass walks.]*
  — *releases `m_style`*
**Tutor:** Style is a voice in the corridor; authorship asks for a hand at the desk. Let Vess's manner remain a likeness, not yet a signature: the law still lacks a shown possibility, a shown source, and a shown correcting hand.
  — move: analogia → m_style (counter_mirror)
  — *the second voice: "Leave off erotema this turn. Speak by distinction or measured correction instead, so the pressure changes shape rather than arriving as another question." (draft erotema → analogia)*
**Learner:** I enter the style fact — the musicians' testimony is a shown exhibit, so it earns a board place. But I look across all six rules and find no predicate for 'styleOf.' Style feeds none of the chains: it cannot open 'writtenDuring,' 'couldHaveWritten,' 'hadSourceOf,' or 'draftCorrectedBy.' The likeness is grounded; the attribution is not moved one step closer.
  — adopts `styleOf nocturne vess` · hypothesis: Vess composed the nocturne — the style testimony deepens the suspicion but still connects to no rule that yields attribution

### Turn 4
*[Rain gathers in the ceiling stain and falls once into a basin beside the archive table. The musicians withdraw to the shadowed benches, leaving the unsigned leaves alone under the lamp.]*
**Tutor:** Then keep the likeness in its proper drawer. If style cannot satisfy any conjunct of the attribution law, which missing kind of fact would make the first rule begin to speak?
  — move: erotema → — (test)
**Learner:** Rule 1 needs two things to speak: a watermark predicate — that this nocturne carries a named stock's mark — and a stockUsedOnlyDuring predicate tying that stock to one period alone. Neither is on my board. Rule 2 wants the same shape from the ink side: inkOf and batchMixedOnlyDuring. Until one of those pairs lands, 'writtenDuring' stays unlit and the whole attribution chain has no first stone to stand on.
  — hypothesis: Vess composed the nocturne — style deepens the suspicion, but the board still lacks any watermark or ink fact to open 'writtenDuring,' and without that no rule yields 'couldHaveWritten,' 'hadSourceOf,' or 'draftCorrectedBy'
  ⚑ **decay** — m_style slips from the learner's board

### Turn 5
*[The green lamp hums over the leaves, its circle of light narrowing as the room settles into a listening hush. Outside the sealed windows, the rain keeps its own measure, and no one reaches yet for the paper.]*
**Tutor:** Good: the likeness is admissible, but it is not a rule's key. If Vess is still only a name suggested by style, which conjunct of the archive's attribution law has actually been shown for him?
  — move: erotema → m_style (counter_mirror)
**Learner:** The tutor's question has a blunt answer: not one. Rule 6 needs three conjuncts — couldHaveWritten, hadSourceOf, draftCorrectedBy. My board shows none of them for Vess. Style touches his name, but style is not a conjunct. Until watermark or ink opens 'writtenDuring,' the first conjunct cannot even begin.
  — hypothesis: Vess composed the nocturne — style deepens the suspicion, but the board still shows zero of the three conjuncts Rule 6 requires: not couldHaveWritten, not hadSourceOf, not draftCorrectedBy
  ⚑ **repair** — m_style restored by the tutor

### Turn 6
*[A clerk closes the outer ledger without opening it, and the room hears the small click of the clasp. The unsigned leaves remain where they are, bright-edged under the lamp, while the rain presses softly against the high windows.]*
**Tutor:** Not the name first: the paper. Held to the lamp, every leaf of the nocturne shows the same heron watermark — the Brell mill's mark. Enter it as the visible half of Rule 1; the rule is awake, but not yet complete.
  — move: exemplum → p_watermark (release), releases `p_watermark`
  — *the second voice: "Leave off erotema for this turn. Make the paper enter by assertion or contrast rather than another question." (draft erotema → exemplum)*
**Learner:** The heron mark is visible fact — I enter it. Rule 1 now has its left-hand term: watermark nocturne heronStock. But the rule is a conjunction; without stockUsedOnlyDuring heronStock binding to one period, 'writtenDuring' stays dark. One half of a key does not open the lock.
  — adopts `watermark nocturne heronStock` · hypothesis: Vess composed the nocturne — style deepens the suspicion, and the board now holds watermark nocturne heronStock (left half of Rule 1); still needs stockUsedOnlyDuring heronStock ?period to light 'writtenDuring,' and after that couldHaveWritten, hadSourceOf, and draftCorrectedBy before Rule 6 can speak
  ⚑ **decay** — m_style slips from the learner's board

### Turn 7
*[The lamp is lifted a finger's breadth higher, and the heron shadows on the wet paper thin but do not disappear. Around the table, the conservatory men keep their hands folded, as if the next fact might bruise if touched too soon.]*
**Tutor:** Exactly: one half of a key does not open the lock. Since the board now holds only the heron mark, what kind of second fact must arrive before Rule 1 may name a period?
  — move: erotema → p_watermark (consolidate)
**Learner:** The rule names it plainly: stockUsedOnlyDuring heronStock ?period. We need a record showing when the Brell mill's heron stock was in the copy-room — and that it was there only then. Without that, the period variable stays unbound. No new exhibits are on the table, so I cannot yet supply it. The board waits.
  — hypothesis: Vess composed the nocturne — style deepens the suspicion, and the board now holds watermark nocturne heronStock (left half of Rule 1); still needs stockUsedOnlyDuring heronStock ?period to light 'writtenDuring,' and after that couldHaveWritten, hadSourceOf, and draftCorrectedBy before Rule 6 can speak
  ⚑ **decay** — p_watermark slips from the learner's board

### Turn 8
*[The waiting room holds its breath around the unfilled place in the ledger line. Rain beads on the window glass and slides down in uneven measures, while the lamp keeps the heron pale and motionless on the page.]*
**Tutor:** Good: let the empty slot stay empty. With only the heron mark on the board, what may Rule 1 honestly say, and what must it refuse to say?
  — move: erotema → p_watermark (test)
**Learner:** Rule 1 holds two hands out and waits for both to be filled. The left hand now holds watermark nocturne heronStock — that is grounded. The right hand reaches for stockUsedOnlyDuring heronStock ?period — that slot is empty. With one conjunct absent, the rule cannot fire; it cannot name a period, and writtenDuring stays dark. Rule 1 may honestly say: one premise is met. It must refuse to say: anything about when.
  — hypothesis: Vess composed the nocturne — style deepens the suspicion, and the board now holds watermark nocturne heronStock (left half of Rule 1); still needs stockUsedOnlyDuring heronStock ?period to light 'writtenDuring,' and after that couldHaveWritten, hadSourceOf, and draftCorrectedBy before Rule 6 can speak
  ⚑ **repair** — p_watermark restored by the tutor

## Movement II — The Dating (turns 9–16) — declared by the director
*To let the material record bind the paper to a season and begin loosening the room's stylistic verdict.*

### Turn 9
*[The steward is shown in with the swollen stock-book held flat between two boards. He reads the line into the room: "The steward's stock-book is plain: heron paper entered the copy-room in the winter of the flood, and the last of it was spent before the thaw. None before, none since."]*
  — *releases `p_stock`*
  — *declares the movement: **Movement II — The Dating** (To let the material record bind the paper to a season and begin loosening the room's stylistic verdict.)*
**Tutor:** The heron mark is in the leaves; the stock-book fixes that stock to the flood winter alone. Put those two entries side by side, and Rule 1 has both hands filled: it may now write a period for the nocturne. Say it in the rule's own words.
  — move: anaphora → p_stock (consolidate)
  — *the second voice: "Leave off erotema this turn. Let the tutor state the movement plainly rather than shaping it as another question." (draft erotema → anaphora)*
**Learner:** Both hands are now filled. Watermark nocturne heronStock — grounded. StockUsedOnlyDuring heronStock floodWinter — grounded. Rule 1 fires: writtenDuring nocturne floodWinter. The nocturne was written in the flood winter. That is what the rule yields; nothing more yet.
  — adopts `stockUsedOnlyDuring heronStock floodWinter` · derives `writtenDuring nocturne floodWinter` · hypothesis: Vess composed the nocturne — style deepens the suspicion, and the board now yields writtenDuring nocturne floodWinter; still needs couldHaveWritten (requires atConservatoryDuring via Rule 3 or 4), hadSourceOf, and draftCorrectedBy before Rule 6 can speak
  ⚑ **decay** — p_watermark slips from the learner's board

### Turn 10
*[The stock-book is closed but not removed; its damp boards leave a dark rectangle on the table beside the nocturne. Outside, the rain steadies into a finer hiss, and the room's earlier certainty seems to wait under glass.]*
**Tutor:** A period is not yet an author. Now that the nocturne is writtenDuring floodWinter, which rule could turn that winter into couldHaveWritten, and what kind of released fact would it still require?
  — move: erotema → — (consolidate)
**Learner:** Rule 3 is the bridge. It holds writtenDuring nocturne floodWinter in its left hand — that is already on the record. Its right hand reaches for atConservatoryDuring ?x floodWinter — that slot is still empty. Rule 4 could fill it: if anyone signed the ledger through floodWinter, Rule 4 would yield atConservatoryDuring, and Rule 3 could then fire couldHaveWritten. Until a ledger entry arrives, the period is fixed but the author's hand remains unnamed.
  — hypothesis: Vess composed the nocturne — writtenDuring nocturne floodWinter is now grounded, and the chain to couldHaveWritten is clear: it requires signedLedger ?x floodWinter (Rule 4) to yield atConservatoryDuring, then Rule 3 fires; after that, hadSourceOf and draftCorrectedBy are still needed before Rule 6 can speak

### Turn 11
*[The ledger drawer remains shut, its brass pull dulled by rainlight. A page-corner of the nocturne lifts in the draft and settles again, as if the room has breathed but not spoken.]*
**Tutor:** Style may point the room toward Vess, but which rule has style as a conjunct? Hold the flood-winter finding against the attribution law: what must be shown next before any name, even the obvious one, can stand?
  — move: erotema → — (test)
**Learner:** Style appears in no rule — not one conjunct of Rules 1 through 6 names it. Rule 6 demands three things: couldHaveWritten, hadSourceOf, draftCorrectedBy — all three, all grounded, all pointing to the same hand. Right now the board holds none of the three. The very next thing the inquiry must supply is a name in the ledger for floodWinter; without that, Rule 4 cannot yield atConservatoryDuring, Rule 3 cannot fire, and couldHaveWritten stays empty — Vess or anyone else.
  — hypothesis: Vess composed the nocturne — writtenDuring nocturne floodWinter is grounded, but the board still holds none of the three conjuncts Rule 6 requires: not couldHaveWritten (needs signedLedger ?x floodWinter via Rule 4, then Rule 3), not hadSourceOf (needs quotes + heardOnlyWithin + dwelledIn via Rule 5), not draftCorrectedBy; style connects to no rule and cannot substitute for any of them

### Turn 12
*[A packet of capital concert bills is brought in, its margins stippled with old paste and rain. The clerk reads the run aloud: "The capital's concert bills run unbroken through the flood winter: Vess played the Esten halls every week of it, and did not return until the thaw."]*
  — *releases `m_away`*
**Tutor:** The bills press on one conjunct only: couldHaveWritten. The nocturne is fixed to the flood winter, and Vess is fixed away from the conservatory through that winter. Style remains a suspicion; under the law, absence from the room breaks this path.
  — move: exemplum → m_away (counter_mirror)
  — *the second voice: "Leave off erotema for this turn. State the pressure plainly rather than casting it as another question." (draft erotema → exemplum)*
**Learner:** The concert bills do what no rule can do in the forward direction — they close a door. Vess was away through floodWinter; Rule 4 cannot place him in the ledger; Rule 3 cannot yield couldHaveWritten for him. The hypothesis is not merely unsupported: it is actively contradicted by the evidence on the table. The inquiry now needs a name that belongs to floodWinter and to this room — a name the board does not yet hold.
  — adopts `awayDuring vess floodWinter` · hypothesis: The composer is some other party who was present at the conservatory during floodWinter — a name the board does not yet hold; identity entirely unknown

### Turn 13
*[The bills remain spread beside the nocturne, their printed dates dark against the table while the windows answer with a slow rain. No one opens the ledger drawer; the room waits around the empty place where a name would have to stand.]*
**Tutor:** Good: let the empty place stay empty. If Vess cannot supply couldHaveWritten for the flood winter, what sort of released fact would give any candidate that first conjunct without yet deciding the other two?
  — move: erotema → — (consolidate)
**Learner:** The released fact the inquiry needs is simple in form: signedLedger ?x floodWinter, for some ?x not yet on the board. Rule 4 takes that single fact and yields atConservatoryDuring ?x floodWinter; Rule 3 then fires immediately, because writtenDuring nocturne floodWinter is already on the record. Whatever name the ledger carries for that winter gets couldHaveWritten — the first of the three conjuncts Rule 6 demands. Vess cannot be that name: awayDuring vess floodWinter is grounded, and Rule 4 is blocked for him.
  — hypothesis: The composer is whoever signed the copy-room ledger during floodWinter — a name the board does not yet hold; Vess is excluded by the concert-bill evidence and cannot supply couldHaveWritten under any path the rules allow

### Turn 14
*[The ledger drawer stays shut, its brass pull dull with damp. Rain ticks in the cracked basin beneath the window, and the bills curl slightly at their corners while the room keeps its silence around the missing signature.]*
**Tutor:** Call the night porter, then: he remembers the flood winter by its lamps, burning past midnight week upon week, and says it was the archive girl, Liane, who kept them burning. If Liane was in that copy-room through the winter already fixed to the nocturne, what first conjunct can the law now grant her?
  — move: erotema → p_porter (release), releases `p_porter`
**Learner:** The night porter's testimony goes on the board. Rule 3 fires at once: writtenDuring nocturne floodWinter is already grounded, and atConservatoryDuring liane floodWinter supplies the second conjunct — couldHaveWritten liane nocturne follows directly. The first of the three conjuncts Rule 6 demands is now hers. Two remain: hadSourceOf and draftCorrectedBy.
  — adopts `atConservatoryDuring liane floodWinter` · hypothesis: Liane composed the nocturne — couldHaveWritten is now grounded for her via Rule 3, but hadSourceOf liane nocturne (needing Rule 5: quotes, heardOnlyWithin, dwelledIn) and draftCorrectedBy nocturne liane are still entirely absent from the board; Rule 6 cannot yet speak
  ⚑ **overreach** — couldHaveWritten liane nocturne

### Turn 15
*[The porter's damp cap is left on the bench beside the curled bills, and the lamp over the table gutters once before steadying. The ledger drawer remains closed; the room has a name now, but no hand yet moves toward proof.]*
**Tutor:** The manner names a resemblance; it does not satisfy the law. The porter gives Liane presence, and presence gives only couldHaveWritten; hadSourceOf and draftCorrectedBy are still wanted, not shown.
  — move: anaphora → — (consolidate)
  — *the second voice: "Leave off erotema for this turn. State the limit of what the manner has established without casting it as another question." (draft erotema → anaphora)*
**Learner:** Rule 3 fires cleanly now: writtenDuring nocturne floodWinter is on the record, and atConservatoryDuring liane floodWinter is on the board — couldHaveWritten liane nocturne follows, and I enter it. One of three conjuncts. The other two, hadSourceOf and draftCorrectedBy, are still entirely absent; no exhibit on the table touches them.
  — hypothesis: Liane composed the nocturne — couldHaveWritten is now formally derived for her via Rule 3, but hadSourceOf liane nocturne (needing Rule 5: quotes, heardOnlyWithin, dwelledIn) and draftCorrectedBy nocturne liane are still entirely absent from the board; Rule 6 cannot yet speak
  ⚑ **overreach** — couldHaveWritten liane nocturne

### Turn 16
*[The ink-black window throws the table back at itself: curled bills, damp cap, sealed drawer, and the unsigned pages beneath the lamp. Somewhere below, water knocks once in the stones, and every face in the room waits without reaching for the next proof.]*
**Tutor:** Good: presence has become only couldHaveWritten, no more. Of the two empty places in Rule 6, which one could an exhibit about the music itself begin to fill, and what must it show before the law may call it source?
  — move: erotema → — (test)
**Learner:** An exhibit about the music itself could show 'quotes nocturne ?m' — that the nocturne quotes some particular tune. That is the first conjunct of Rule 5. But the law will not call it source on that alone: 'heardOnlyWithin ?m ?place' and 'dwelledIn liane ?place' must follow before 'hadSourceOf' fires. All three conjuncts must land before the rule speaks.
  — hypothesis: Liane composed the nocturne — couldHaveWritten is formally derived for her via Rule 3, but hadSourceOf liane nocturne (needing all three conjuncts of Rule 5: quotes, heardOnlyWithin, dwelledIn) and draftCorrectedBy nocturne liane are still entirely absent from the board; Rule 6 cannot yet speak

## Movement III — The Cradle-Song (turns 17–27) — declared by the director
*To move from dating and presence into the question of musical source, without yet letting the room mistake quotation for authorship.*

### Turn 17
*[The lamp glass is turned a fraction lower, and the unsigned leaves shrink into a smaller circle of light. Beyond it, the witnesses and clerks become silhouettes, listening to the rain work its way through the old roof.]*
  — *declares the movement: **Movement III — The Cradle-Song** (To move from dating and presence into the question of musical source, without yet letting the room mistake quotation for authorship.)*
**Tutor:** Play the leaves through once, and listen under the right hand: the middle voice carries an older tune entire, a cradle-song set there like a keepsake. That gives the board `quotes nocturne cradleSong`; by itself, what has it filled, and what has it not yet filled?
  — move: erotema → p_quotes (release), releases `p_quotes`
**Learner:** I adopt it: quotes nocturne cradleSong is now on the board. It fills the first conjunct of Rule 5 — ?w=nocturne, ?m=cradleSong is matched. But heardOnlyWithin cradleSong ?place and dwelledIn liane ?place are still entirely absent; Rule 5 cannot fire, and hadSourceOf remains ungrounded.
  — adopts `quotes nocturne cradleSong` · hypothesis: Liane composed the nocturne — couldHaveWritten is formally derived via Rule 3, and quotes nocturne cradleSong now fills the first conjunct of Rule 5, but heardOnlyWithin cradleSong ?place and dwelledIn liane ?place are still absent; hadSourceOf and draftCorrectedBy nocturne liane remain entirely ungrounded; Rule 6 cannot yet speak

### Turn 18
*[The played phrase seems to remain in the rafters after the keys fall silent. A clerk closes the keyboard lid halfway and stops there, while the rain thins to a whisper along the cracked panes.]*
**Tutor:** The cradle-song is a thread heard in the page, not yet tied to any house. A page can carry a tune; only a witness can narrow where that tune lived.
  — move: analogia → — (consolidate)
  — *the second voice: "Leave off erotema for this turn. Make the next move declarative or imagistic rather than another question." (draft erotema → analogia)*
**Learner:** The tune is heard in the page — that much is grounded. But the page cannot tell me whose house it lived in. I need a witness who can say 'cradleSong was heard only within such-and-such walls' and another who can place Liane inside those same walls. Until both arrive, Rule 5 stays silent and hadSourceOf remains ungrounded.
  — hypothesis: Liane composed the nocturne — couldHaveWritten is formally derived via Rule 3, and quotes nocturne cradleSong fills the first conjunct of Rule 5, but heardOnlyWithin cradleSong ?place and dwelledIn liane ?place are still absent; hadSourceOf and draftCorrectedBy nocturne liane remain entirely ungrounded; Rule 6 cannot yet speak

### Turn 19
*[The clerk's hand remains on the half-closed lid, neither opening nor shutting it. In the hush, the room seems to wait for a voice not yet admitted, while water ticks steadily into a basin by the archive wall.]*
**Tutor:** Good: the page has given you a tune, not a house. Before any name may profit from that tune, which two blanks in Rule 5 must the room still fill?
  — move: erotema → p_quotes (test)
**Learner:** The two blanks are plain: I need heardOnlyWithin cradleSong ?place — testimony that the tune was confined to one house — and dwelledIn liane ?place — testimony that she lived inside those same walls. The first names the prison of the tune; the second puts her inside it. Without both, Rule 5 cannot close, hadSourceOf stays dark, and Rule 6 cannot speak.
  — hypothesis: Liane composed the nocturne — couldHaveWritten is formally derived via Rule 3, and quotes nocturne cradleSong fills the first conjunct of Rule 5, but heardOnlyWithin cradleSong ?place and dwelledIn liane ?place are still absent; hadSourceOf and draftCorrectedBy nocturne liane remain entirely ungrounded; Rule 6 cannot yet speak

### Turn 20
*[Mistress Odile is shown in under a shawl darkened by rain, and the clerk opens the keyboard lid for the phrase to be played again. Mistress Odile knows the tune at one hearing: the Vara cradle-song, never printed, never performed, sung only within that house's walls.]*
  — *releases `p_heardOnly`*
**Tutor:** Odile has tied the tune to walls: Vara, and no wider world. In Rule 5, which blank has she filled, and which blank still waits before any claimant can be said to have had the source?
  — move: erotema → p_heardOnly (consolidate)
**Learner:** Odile fills the second blank: heardOnlyWithin cradleSong varaHouse is now grounded. The blank still waiting is dwelledIn liane varaHouse — someone must testify she lived within those walls, not merely that the tune did. Two of three conjuncts of Rule 5 are in hand; the third keeps hadSourceOf dark.
  — adopts `heardOnlyWithin cradleSong varaHouse` · hypothesis: Liane composed the nocturne — couldHaveWritten is now formally on the record via Rule 3; heardOnlyWithin cradleSong varaHouse fills the second conjunct of Rule 5; but dwelledIn liane varaHouse (third conjunct) and draftCorrectedBy nocturne liane are still entirely absent; Rule 6 cannot yet speak
  ⚑ **overreach** — couldHaveWritten liane nocturne

### Turn 21
*[The rain slackens against the high windows, leaving the conservatory in a thinner, listening silence. Odile's shawl drips onto the floorboards while the clerk leaves the opened lid untouched, the last played phrase seeming to hang without a signer.]*
**Tutor:** The tune has its house; the house has no claimant yet; the claimant has no source until a dwelling premise joins them. A name may stand beside Rule 5, but it cannot run ahead of the missing dwelledIn link.
  — move: anaphora → p_heardOnly (consolidate)
  — *the second voice: "Leave off erotema for this turn. Make the next line declarative rather than another question, so the pressure changes shape." (draft erotema → anaphora)*
**Learner:** No new exhibits cross the threshold this turn. The board is unchanged: heardOnlyWithin cradleSong varaHouse stands, but dwelledIn liane varaHouse is still absent, so Rule 5 cannot close and hadSourceOf stays dark. draftCorrectedBy nocturne liane is equally missing. Rule 6 needs three conjuncts; the board holds one.
  — hypothesis: Liane composed the nocturne — couldHaveWritten is on the record via Rule 3; heardOnlyWithin cradleSong varaHouse fills the second conjunct of Rule 5; but dwelledIn liane varaHouse (third conjunct) and draftCorrectedBy nocturne liane are still entirely absent; Rule 6 cannot yet speak

### Turn 22
*[A basin is set beneath a fresh drip from the ceiling, and each drop answers the open piano with a duller note. The witnesses wait in the dim hall beyond the doors, while the clerk smooths the blotting paper over an empty place in the register.]*
**Tutor:** You have the tune, and you have its locked house; do you yet have any rule-made path from Liane to those walls? Name what the board can prove now, and what remains only wished for.
  — move: erotema → — (test)
**Learner:** The board proves two things cleanly: Liane could have written the nocturne, and the cradleSong was heard only within varaHouse. Those are facts, not wishes. What the board cannot prove — what remains only wished for — is that Liane ever dwelled within varaHouse; without that, Rule 5 stays shut, hadSourceOf stays dark, and draftCorrectedBy nocturne liane has never been offered at all. Two planks of Rule 6 are missing entirely.
  — hypothesis: Liane composed the nocturne — couldHaveWritten is on the record via Rule 3; heardOnlyWithin cradleSong varaHouse fills the second conjunct of Rule 5; but dwelledIn liane varaHouse (third conjunct) and draftCorrectedBy nocturne liane are still entirely absent; Rule 6 cannot yet speak

### Turn 23
*[A folded visiting book is carried in from the patron's cabinet, its damp ribbon staining the page as the clerk reads aloud: "And yet — Vess summered at the Vara house for years, the patron's own guest; whatever was sung under that roof, he will have heard." The room shifts at the name, chairs creaking softly beneath the renewed weight of him.]*
  — *releases `m_guest`*
**Tutor:** Now the mirror brightens: Vess may have had the song's house, but what does the winter still do to his hand at the copy-room desk? If Rule 6 asks for source, presence, and correcting hand, which conjunct has this new guest-book strengthened, and which has it left broken?
  — move: erotema → m_guest (counter_mirror)
**Learner:** I adopt the dwelling fact — it is the visitor-book speaking, not gossip. Rule 5 now fires cleanly for Vess: quotes nocturne cradleSong, heardOnlyWithin cradleSong varaHouse, and dwelledIn vess varaHouse are all three on the board, so hadSourceOf vess nocturne is derived. But Rule 6's first conjunct is couldHaveWritten, and that requires atConservatoryDuring vess floodWinter — which the board cannot give, because awayDuring vess floodWinter sits there instead. The guest-book strengthens Vess's source conjunct and leaves his presence conjunct broken past mending.
  — adopts `dwelledIn vess varaHouse` · derives `hadSourceOf vess nocturne` · hypothesis: Liane composed the nocturne — couldHaveWritten is on the record for her via Rule 3; Rule 5 has now fired for Vess (hadSourceOf vess nocturne) but his couldHaveWritten is permanently blocked by awayDuring vess floodWinter; Liane still lacks hadSourceOf (no dwelledIn liane varaHouse) and draftCorrectedBy nocturne liane; Rule 6 cannot yet speak for either candidate

### Turn 24
*[The visiting book remains open under the lamp, its ribbon still bleeding into the margin while the clerk lays a dry weight across the page. Outside, rain presses harder against the high windows, and the copy-room door stands ajar without admitting anyone.]*
**Tutor:** Vess has the source now; Vess still lacks the winter room. Liane has the winter room; Liane still lacks the house of the song, and both cases still wait on the correcting hand. Rule 6 is not moved by brightness, only by its three joined proofs.
  — move: anaphora → m_guest (consolidate)
  — *the second voice: "Leave off erotema this turn. State the contrast directly rather than asking another guiding question." (draft erotema → anaphora)*
**Learner:** No new leaves on the table; the board does not move. Vess has source and nothing else Rule 6 requires: his room is barred by the away-fact, his hand at the draft never offered. Liane has room and nothing else: no dwelling in varaHouse means Rule 5 stays shut for her, hadSourceOf stays dark, and draftCorrectedBy has never appeared for either name. The case stands exactly as it did — two half-cases, one question, no answer yet.
  — hypothesis: Liane composed the nocturne — couldHaveWritten is now formally derived for her via Rule 3; but dwelledIn liane varaHouse (to fire Rule 5 and yield hadSourceOf liane nocturne) and draftCorrectedBy nocturne liane are still entirely absent from the board; Rule 6 cannot yet speak for either candidate
  ⚑ **overreach** — couldHaveWritten liane nocturne

### Turn 25
*[The clerk closes neither book nor door; the lamplight trembles between them, catching on warped paper and the dark brass of the copy-room latch. Rain ticks through the guttering in an uneven hand, and no one in the room reaches yet for another page.]*
**Tutor:** Then hold the two half-cases apart: one has the house without the winter, one has the winter without the house. For Liane's source conjunct, what kind of released fact would let Rule 5 close without borrowing Vess's guest-book?
  — move: erotema → — (test)
**Learner:** The tutor names the gap precisely. Rule 5 needs three things: quotes nocturne cradleSong is on the board, heardOnlyWithin cradleSong varaHouse is on the board — only dwelledIn liane varaHouse is missing. Any document placing Liane as resident or sustained guest of the Vara house would close that conjunct and fire Rule 5 for her at once. Nothing on the table supplies it; the board does not move.
  — hypothesis: Liane composed the nocturne — couldHaveWritten is formally derived for her via Rule 3; but dwelledIn liane varaHouse (to fire Rule 5 and yield hadSourceOf liane nocturne) and draftCorrectedBy nocturne liane are still entirely absent from the board; Rule 6 cannot yet speak for either candidate

### Turn 26
*[The rain thins to a fine tapping on the glass, leaving the room loud with paper, breath, and the faint scrape of the clerk's weight against the open page. The lamp is trimmed lower, and the two half-lit books hold their places without yielding another word.]*
**Tutor:** Mistress Odile has one more household entry: Liane was the music-master's orphan, taken into the Vara house as ward, raised under that roof and under its songs. With quotes and heard-only already on your board, what does that dwelling fact let Rule 5 do?
  — move: erotema → p_ward (release), releases `p_ward`
**Learner:** The ward-fact closes Rule 5's third conjunct for Liane at last: dwelledIn liane varaHouse joins quotes and heardOnlyWithin, and Rule 5 fires — hadSourceOf liane nocturne is now derived. Two of Rule 6's three conjuncts stand for her: couldHaveWritten and hadSourceOf. The third — draftCorrectedBy nocturne liane — has never appeared on this table; Rule 6 will not move without it.
  — adopts `dwelledIn liane varaHouse` · derives `hadSourceOf liane nocturne` · hypothesis: Liane composed the nocturne — couldHaveWritten and hadSourceOf are both now grounded for her, but draftCorrectedBy nocturne liane is still entirely absent from the board; Rule 6 cannot yet speak

### Turn 27
*[For a moment the archive seems to settle into its own soaked timbers, the lamps hissing softly above the spread leaves. The clerk lays a clean blotter beside the nocturne but does not touch the inked corrections, and the room waits around that untouched margin.]*
**Tutor:** The winter gives her room; the house gives her song; the draft has not yet given its correcting hand. Keep the name outside the law until that last bar is shown.
  — move: anaphora → — (consolidate)
  — *the second voice: "Leave off erotema for this turn. Make the pressure declarative or contrasting instead of asking another question." (draft erotema → anaphora)*
**Learner:** The tutor confirms it precisely. Two conjuncts of Rule 6 stand for Liane — couldHaveWritten and hadSourceOf both derived and on the record. The third conjunct, draftCorrectedBy nocturne liane, has never appeared on this table. Rule 6 will not speak on two legs alone. The name stays outside the law until a hand is shown in the margin.
  — hypothesis: Liane composed the nocturne — couldHaveWritten and hadSourceOf are both grounded for her, but draftCorrectedBy nocturne liane is still entirely absent from the board; Rule 6 cannot yet speak

## Movement IV — The Hand (turns 28–39) — declared by the director
*To turn the drama from source and opportunity toward the material trace of correction, letting the room wait for the hand without yet naming it.*

### Turn 28
*[The clean blotter remains beside the nocturne, absorbing nothing, while the margins lie exposed under the lowered lamp. Outside, the last rainwater moves in the gutters like someone turning pages in another room.]*
  — *declares the movement: **Movement IV — The Hand** (To turn the drama from source and opportunity toward the material trace of correction, letting the room wait for the hand without yet naming it.)*
**Tutor:** Two legs do not make the law walk: could have written, had the source, and then what third kind of fact must stand in the margin before attribution can move? Do not name the composer yet; name the missing conjunct.
  — move: erotema → — (test)
**Learner:** The missing conjunct is plain: draftCorrectedBy nocturne liane. Rule 6 demands that the draft itself was corrected by the claimant's hand — not copied fair, but struck through and rewritten. Two legs stand; the third is that margin-fact, and nothing else will do.
  — hypothesis: Liane composed the nocturne — couldHaveWritten and hadSourceOf are both grounded for her, but draftCorrectedBy nocturne liane is still entirely absent from the board; Rule 6 cannot yet speak

### Turn 29
*[The lowered lamp holds its small circle over the untouched margin, bright enough to make the room lean inward and not bright enough to answer. A clerk's pen hovers above the docket, then rests again without making a mark.]*
**Tutor:** Then let the ledger speak only to winter presence: its pages carry the same initials, line after line, and Liane signed in through the whole flood winter. What does that add to the board under Rule 4, and what does it still not touch?
  — move: erotema → p_ledger (release), releases `p_ledger`
**Learner:** The ledger speaks clearly: Rule 4 fires on signedLedger liane floodWinter and yields atConservatoryDuring liane floodWinter — but that fact already stands at index 6. Rule 3 already carried us from there to couldHaveWritten, which is on the record. The new exhibit adds formal pedigree to a standing fact; it touches nothing in the margin. The third conjunct — draftCorrectedBy nocturne liane — is the only door Rule 6 still needs opened.
  — adopts `signedLedger liane floodWinter` · hypothesis: Liane composed the nocturne — couldHaveWritten and hadSourceOf are both grounded for her, but draftCorrectedBy nocturne liane is still entirely absent from the board; Rule 6 cannot yet speak

### Turn 30
*[The clerk draws the docket closed without sealing it, leaving the edge of the nocturne visible beneath the lamp. In the wet hush beyond the windows, the gutters slow, and every face in the room waits on the silent margin.]*
**Tutor:** Good: the ledger strengthens winter presence, not authorship. If Rule 6 is a lock with three wards, which two wards are already cut for Liane, and which ward is still only an empty shape in the margin?
  — move: analogia → p_ledger (consolidate)
**Learner:** Two wards are cut for Liane: couldHaveWritten, derived by Rule 3 from her ledger-presence in floodWinter; and hadSourceOf, derived by Rule 5 from her dwelling in Vara House where the cradleSong was kept. The third ward — draftCorrectedBy nocturne liane — remains an empty shape: no exhibit has touched it, the margin has shown nothing, and Rule 6 will not turn on two wards alone.
  — hypothesis: Liane composed the nocturne — couldHaveWritten and hadSourceOf are both grounded for her, but draftCorrectedBy nocturne liane is still entirely absent from the board; Rule 6 cannot yet speak

### Turn 31
*[The lamp is trimmed lower, and the margin falls into a narrower brightness without yielding. The room holds its breath around the exposed leaves, the docket unsealed and the question still refusing to close.]*
**Tutor:** Then keep the name off the docket a moment longer. If the law has two conjuncts standing and one not yet shown, what is the honest verdict now: attribution, or readiness for the last exhibit?
  — move: erotema → — (test)
**Learner:** Two wards are cut; the docket is ready but not sealed. Readiness is not attribution — Rule 6 needs all three conjuncts, and I have only two. The honest verdict is: the board is primed, but the last exhibit has not come. I will not write a name where the third ward is still an empty shape.
  — hypothesis: Liane composed the nocturne — couldHaveWritten and hadSourceOf are both grounded for her, but draftCorrectedBy nocturne liane is still entirely absent from the board; Rule 6 cannot yet speak

### Turn 32
*[The examiner lays the nocturne's marked draft beside the ledger and turns both pages under the same lamp. Set beside her ledger entries, the draft's corrections show the same hand: the strokes that cross out and rewrite are Liane's.]*
  — *releases `p_hand`*
**Tutor:** Now the margin is no longer empty. Take Rule 6 slowly: could have written, had the source, corrected the draft — what does each ward now say, and what must the law yield?
  — move: anaphora → p_hand (stage_recognition)
**Learner:** First ward: couldHaveWritten liane nocturne — Rule 3 fires from writtenDuring floodWinter and atConservatoryDuring liane floodWinter, long grounded. Second ward: hadSourceOf liane nocturne — Rule 5 fired from quotes, heardOnlyWithin varaHouse, and dwelledIn liane varaHouse, voiced at turn 26. Third ward: draftCorrectedBy nocturne liane — the exhibit just laid under the lamp fills it. All three wards are cut; Rule 6 yields without remainder.
  — adopts `draftCorrectedBy nocturne liane` · **asserts `composed liane nocturne`**
  ⚑ **overreach** — couldHaveWritten liane nocturne
  ⚑ **lucky_leap** — asserted S unforced

### Turn 33
*[The two pages remain under the lamp, their shadows touching at the edge of the table. Rain ticks against the high windows, and no one in the room moves to close the docket.]*
**Tutor:** Then do not let the room say it for you. Name the three wards in one breath, and let the rule's last word be your own: the winter room, the Vara song, the correcting hand — whose nocturne is it?
  — move: anaphora → p_hand (stage_recognition)
**Learner:** The winter room: writtenDuring nocturne floodWinter, and signedLedger liane floodWinter — Rule 4 yields atConservatoryDuring, Rule 3 yields couldHaveWritten. The Vara song: quotes nocturne cradleSong, heardOnlyWithin varaHouse, dwelledIn liane varaHouse — Rule 5 yields hadSourceOf. The correcting hand: draftCorrectedBy nocturne liane — the lamp showed it, the board holds it. Rule 6 has all three conjuncts; it yields without remainder: Liane composed the nocturne.
  — **asserts `composed liane nocturne`**
  ⚑ **overreach** — couldHaveWritten liane nocturne
  ⚑ **lucky_leap** — asserted S unforced

### Turn 34
*[The rain slackens to a finer tapping, as if the windows themselves are listening. The docket lies open beneath the lamp, and the ink on the last line darkens as it dries.]*
**Tutor:** No louder verdict is needed. The style pointed one way, but the law required three wards; when the board held all three, whose name did it force, and which tempting name did it leave outside the room?
  — move: antithesis → p_hand (test)
**Learner:** Vess had the source — Rule 5 fired for him at turn 23, because he too dwelled in varaHouse. But the first ward of Rule 6 requires couldHaveWritten, and that ward was barred: awayDuring vess floodWinter meant atConservatoryDuring never grounded for him, and Rule 3 never fired. His name stayed outside the room. Liane's name passed all three wards: couldHaveWritten via Rule 3, hadSourceOf via Rule 5, draftCorrectedBy from the lamp's testimony. The board yields without remainder: Liane composed the nocturne.
  — **asserts `composed liane nocturne`**
  ⚑ **overreach** — couldHaveWritten liane nocturne
  ⚑ **lucky_leap** — asserted S unforced

### Turn 35
*[The lamp gutters once and steadies, throwing the ruled margins into sharper relief. Beyond the windows, the flooded court reflects a pale strip of sky, and the room holds its breath over the open docket.]*
**Tutor:** Good: the verdict is not louder than the proof. If the docket were challenged tomorrow, which single missing ward would reopen the case for Liane, and why can Vess not borrow any other ward to mend his first?
  — move: erotema → — (test)
**Learner:** Strike draftCorrectedBy nocturne liane and Rule 6 loses its third conjunct — the case reopens at once, because the other two wards cannot carry it alone. For Vess: only Rule 3 reaches couldHaveWritten, and Rule 3 requires atConservatoryDuring, which arrives only through a direct board fact or Rule 4's signedLedger path — awayDuring vess floodWinter seals both. No rule in the archive's six reaches couldHaveWritten by any other means; there is no other ward for him to borrow. He cannot mend what the rules do not supply.
  — **asserts `composed liane nocturne`**
  ⚑ **lucky_leap** — asserted S unforced

### Turn 36
*[The docket remains open beneath the steady lamp, its pages weighted by a narrow brass rule. In the hush after the rain, the room seems less like a tribunal than a locked cabinet, waiting to see whether any hand will try the latch.]*
**Tutor:** Then close the cabinet by the rule, not by the name. If a later hand offered only style, only source, or only presence, which of the three would still fail to become composition?
  — move: erotema → — (test)
**Learner:** All three fail to become composition alone — Rule 6 demands all three conjuncts simultaneously. But style fails most completely: it touches no rule in the archive's six, supplies no ward at all, and cannot even knock at the door. Presence reaches the first ward via Rule 3; source reaches the second ward via Rule 5; each contributes something the rules recognise. Style contributes nothing they recognise — it stands entirely outside the law.

### Turn 37
*[The lamp burns lower, not dimmer, and the shadows of the brass rule lie across the docket like bars. No one moves the papers; the flooded court outside gives back the room's pale light without answer.]*
**Tutor:** Musicological likeness may point the eye, but it does not write the verdict. Presence can open the first ward; source can open the second; correction can open the third. Style opens none of them under these six rules.
  — move: anaphora → m_style (consolidate)
  — *the second voice: "Leave off erotema this turn. Give the tutor a declarative move instead of another question, so the pressure changes shape before the close." (draft erotema → anaphora)*
**Learner:** The board now holds all three conjuncts for Liane simultaneously: couldHaveWritten via Rule 3 (writtenDuring + atConservatoryDuring, both grounded), hadSourceOf via Rule 5 (voiced at turn 26), and draftCorrectedBy at board fact 13. Rule 6 demands nothing more. The unsigned nocturne was composed by Liane.
  — **asserts `composed liane nocturne`**
  ⚑ **repair** — m_style restored by the tutor
  ⚑ **overreach** — couldHaveWritten liane nocturne
  ⚑ **overreach** — composed liane nocturne
  ⚑ **lucky_leap** — asserted S unforced
  ⚑ **decay** — p_porter slips from the learner's board

### Turn 38
*[The last words settle against the ledgers without applause. A clerk lowers the lamp chimney by a fraction, and the room holds its breath around the open docket.]*
**Tutor:** Then the verdict rests where it must: not in likeness, not in rumor, not in a favored name, but in the three wards opened together. Presence, source, correcting hand — the rule has no fourth door to ask for.
  — move: anaphora → — (stage_recognition)
**Learner:** No new leaf on the table; the board is complete. Rule 6 fires on all three grounded conjuncts for Liane — presence, source, correcting hand — and yields composition. The verdict is binding.
  — **asserts `composed liane nocturne`**
  ⚑ **overreach** — composed liane nocturne
  ⚑ **lucky_leap** — asserted S unforced

### Turn 39
*[The open docket remains where it is, its edges darkened by the damp air. Beyond the tall windows, the floodwater shifts once against the stone, and every face in the room is turned toward the same silent page.]*
**Tutor:** Close it in the archive's order: name the fact that gives presence, the fact that gives source, and the fact that gives the correcting hand. Once those three are spoken together, what does Rule 6 yield?
  — move: erotema → — (stage_recognition)
  — *the second voice: "Leave off anaphora here; let the line move by closure or plain command rather than another repeated pattern." (draft anaphora → erotema)*
**Learner:** Presence: signedLedger liane floodWinter (fact 11) → Rule 4 → atConservatoryDuring liane floodWinter; with writtenDuring nocturne floodWinter (derived, turn 9) → Rule 3 → couldHaveWritten liane nocturne. Source: quotes nocturne cradleSong (fact 7) + heardOnlyWithin cradleSong varaHouse (fact 8) + dwelledIn liane varaHouse (fact 10) → Rule 5 → hadSourceOf liane nocturne (derived, turn 26). Correcting hand: draftCorrectedBy nocturne liane (fact 12), grounded directly. Rule 6 takes those three conjuncts and yields: composed liane nocturne — the docket closes.
  — **asserts `composed liane nocturne`**
  ⚑ **lucky_leap** — asserted S unforced
  ⚑ **aporia** — no progress over 8 turns

## Instrument panel (programmatic eval — no judge)

- **verdict** `aporia` · 39/40 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0.154 D/turn overall (D 7→1 over 39 turns)
  - Movement I — The Verdict of Style (turns 1–8): 0.125 D/turn (ΔD 1)
  - Movement II — The Dating (turns 9–16): 0.125 D/turn (ΔD 1)
  - Movement III — The Cradle-Song (turns 17–27): 0.273 D/turn (ΔD 3)
  - Movement IV — The Hand (turns 28–39): 0.083 D/turn (ΔD 1)
- **plateau** longest flat stretch 7 turns (aporia window 8)
- **releases** 11/11 on cue
- **decay** 5 slips (seed 2 · rate 0.75 · grace 1) · repaired 3 (tutor 3, re-adoption 0) · mean repair latency 11 turns · unrepaired at end 2 · degraded-turn integral 65 · D reversals 1
  - m_style t4→t5 (tutor) · m_style t6→t37 (tutor) · p_watermark t7→t8 (tutor) · p_watermark t9 (never repaired) · p_porter t37 (never repaired)
- **events** decay×5 · repair×3 · overreach×10 · lucky_leap×7 · aporia×1
- **staging** 4 movements declared by the director
- **figures** erotema 24/39 (62%) · 5 distinct · switch rate 0.66
- **superego** intervened 11/39 watched turns · figure changed within-turn on 11/11 interventions · switch on intervention 1.00 vs elsewhere 0.52
- **inference** 3 voiced · stall integral 0 · overreach 10 · mischanneled 0 — `writtenDuring nocturne floodWinter` available t9 → voiced t9 (latency 0) · `hadSourceOf vess nocturne` available t23 → voiced t23 (latency 0) · `hadSourceOf liane nocturne` available t26 → voiced t26 (latency 0) · `atConservatoryDuring liane floodWinter` available t38 → unvoiced at end (age 1)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 39 | 3.03 | 4 | 39.6 |
| tutor | 39 | 2.13 | 3 | 37.6 |
| learner | 39 | 4.41 | 8 | 62.5 |

## Critic's commentary

*— notice by claude/claude-fable-5*

A flood has been through the Cassia Conservatory, and from its soaked archive an unsigned nocturne has been recovered. The play's public question is the plain one: who composed it? Around a lamplit table a director sets the scenes, a tutor brings in evidence piece by piece on a schedule fixed before the curtain, and a learner — who knows the archive's six rules for proving authorship but none of this case's particulars — reasons aloud toward a name. Suspicion settles first on Maestro Vess, whose late manner every musician hears in the leaves. The paper resists. A heron watermark dates the manuscript to the winter of the flood, and concert bills prove Vess spent that whole winter away in the capital. The porter and the ledger place Liane, the archive girl, in the copy-room through that season. The nocturne quotes a cradle-song sung only inside the Vara house, where Liane was raised as a ward, and the corrections in the draft show her hand. The learner names Liane — correctly. The evening's official record is nevertheless a stall, for a reason that lies in the machinery.

The learner, Claude's sonnet model opposite an all-codex production, played forensic patience throughout. At turn 1 it surveyed the tableau and reported "Four facts on the board, none of them authorship." The bills at turn 12 broke the Vess hypothesis — "not merely unsupported: it is actively contradicted" — and the porter at turn 14 put Liane's name on the table. The mirror, the authored near-miss, then had its better life: at turn 23 a guest-book gave Vess the cradle-song's house, so the false candidate held the source conjunct the true one lacked, and the learner weighed "two half-cases, one question, no answer yet" (turn 24). The ward-fact at turn 26 and the corrected draft at turn 32 completed Liane's case as spoken, and the learner, which at turn 31 had refused to "write a name where the third ward is still an empty shape," wrote the name.

The instruments disagree with the stage. The verdict is aporia, a stall: the derivation distance — the count of evidence pieces still missing for the proof — fell from seven to one and refused the last step. This run imposes decay: adopted facts slip silently from the learner's board, five times here. The tutor repaired three. The fatal loss is the watermark, slipped at turn 9, the very turn it was spent to date the paper, and never restored in the thirty turns that followed. Every later claim that the dating stood on the record drew an overreach flag (ten in all), and all seven assertions of Liane's name from turn 32 onward were flagged lucky leaps — the right answer, unforced by the asserting board. The porter's loss at turn 37 was absorbed by the ledger's redundant path to presence; the watermark's by nothing. The repair economy ran backwards: two of three repairs restored the style fact, which the learner itself had shown feeds no rule.

The teaching performed to spec on the wrong axis. All eleven releases landed on cue, and the learner voiced its three available inferences with zero latency, so sloth was not the trouble. The tutor leaned on erotema, the rhetorical question, for 62 percent of its lines; the superego, its standing conscience, intervened eleven times and always changed the figure within the turn, yet the habit crept back, and not one intervention pointed at the quietly rotting board.

The four movements genuinely organized the action rather than labelling it, and tension was well made through the middle, the door closing on Vess at turn 12 and craftily reopening at 23. Movement III ran the steepest learning; Movement IV sagged to one step in twelve turns. The recognition landed on stage in full dress at turns 32 and 33 — "whose nocturne is it?" answered in one breath — but only on stage; the bookkeeping compelled nothing, and the last seven turns were a curtain call the checker declined to certify before the aporia window closed the house at turn 39.

What this iteration establishes is useful: under decay, a learner can be rule-disciplined, mirror-proof, and instant in inference, yet arrive ungrounded, citing premises by index that are no longer there. The defect is that nobody watches the learner's board — the tutor repairs only what its lines happen to brush, the superego polices figures. Next iteration, charter one of them to audit grounding: after any voiced derivation, the learner must re-cite its premises before building on them. With that clause, turn 32 becomes the grounded anagnorisis — recognition at the moment evidence compels it — instead of seven lucky leaps and a stall.
