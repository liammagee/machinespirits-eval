# The Unsigned Nocturne — noc-decay-v1-B-s1

> world `world_001_nocturne` · verdict **aporia** · 39/40 turns

```
D= 7 ●●●●●··●│········│···········│············
D= 6      ●● │●●●●●···│···········│············
D= 5         │     ●●●│···········│············
D= 4         │        │●●●········│············
D= 3         │        │   ●●●●●●··│············
D= 2         │        │         ●●│●●●●···●●●●●
D= 1         │        │           │    ●●●     
D= 0         │        │           │            
turn      +   │ 1    + │   2    +  │  3    +     (+=5, digit=x10)
rel     ▲  ▲  │▲  ▲ ▲  │▲  ▲  ▲  ▲ │ ▲  ▲        (▲ = evidence released)
slope 0.13 D/turn overall (D 7→2); per movement: 1 0.00 │ 2 0.25 │ 3 0.27 │ 4 0.00
```

## The Verdict of Style (turns 1–8) — declared by the director
*To let the room gather around its first certainty before the paper itself begins to trouble it.*

### Turn 1
*[The flooded archive gives up a long table under weak lamps, its warped boards breathing damp into the room. An unsigned score lies closed at the center, while the conservatory beyond the doors waits with the stillness of people who have already chosen a name.]*
  — *declares the movement: **The Verdict of Style** (To let the room gather around its first certainty before the paper itself begins to trouble it.)*
**Tutor:** Before the room chooses its famous name, what would count as proof for an unsigned work: place, time, source, hand? Which of those is actually on your board yet?
  — move: erotema → — (orient)
**Learner:** The room has chosen Vess already — I have not. My board holds four facts: the nocturne was found here, it is unsigned, the archive belongs to this conservatory, and Vess is its maestro. Not one of those chains to any rule. I need time, source, and hand before I can even begin.
  — hypothesis: Vess composed the nocturne — the conservatory's presumption, not mine; I cannot ground it yet.

### Turn 2
*[Rain ticks in the ceiling seams, and a clerk sets fresh blotting paper beside the closed score without touching it. The lamps dim and recover, throwing the same unanswered titleless cover into and out of shadow.]*
**Tutor:** Good. If Vess is only a presumption, what would make his name more than a room's habit: which first conjunct must the archive earn before any name can stand?
  — move: erotema → — (test)
**Learner:** Rule 6 demands three things: couldHaveWritten, hadSourceOf, draftCorrectedBy. The first of those rests on Rule 3, which itself demands writtenDuring. Without a period established — by watermark or ink — no name can even reach the first conjunct. Time is what the archive must earn first.
  — hypothesis: Vess composed the nocturne — the conservatory's presumption, not mine; I cannot ground it yet.

### Turn 3
*[The score is opened at last, and the leaves are passed from stand to stand under the weak lamps. Every musician shown the leaves says the same: this is Vess's late manner — the suspensions, the long pedal, the way the bass walks.]*
  — *releases `m_style`*
**Tutor:** Style is a lantern, not a key. It can light the room's presumption, but it opens none of the law's three locks: not time, not source, not hand.
  — move: analogia → m_style (consolidate)
  — *the second voice: "Leave off erotema for this turn. Give the tutor a declarative pressure instead of another question." (draft erotema → analogia)*
**Learner:** Every musician in the room says Vess — I hear them. But 'styleOf' appears in none of my six rules. It cannot feed Rule 1, Rule 2, or any conjunct of Rule 6. I adopt it because it is a grounded observation, not because it moves the inquiry. The board grows by one leaf; the three locks stay shut.
  — adopts `styleOf nocturne vess` · hypothesis: Vess composed the nocturne — the conservatory's presumption, not mine; style corroborates the room's intuition but cannot ground it under any rule.

### Turn 4
*[The musicians fall back into their chairs, their verdict still hanging in the damp air like smoke. A page-turner straightens the opened leaves by their edges, and the lamps hold steady over the paper without revealing anything more.]*
**Tutor:** If style opens none of the locks, let it stand aside. Which lock is still first, and what kind of staged fact could turn it without naming any composer?
  — move: erotema → — (consolidate)
**Learner:** The first lock is time — writtenDuring must be established before couldHaveWritten can fire. Rule 1 offers the cleaner path: identify the watermark pressed into the leaf, match it to a mill's stock, and ask whether that stock was in the copy-room only during one period. No composer need be named at that step; the paper itself speaks the period.
  — hypothesis: Vess composed the nocturne — the conservatory's presumption, not mine; style corroborates the room's intuition but cannot ground it under any rule. The board still lacks a period, a source, and a correcting hand.
  ⚑ **decay** — m_style slips from the learner's board

### Turn 5
*[A clerk draws the lamps closer, and the wet dark of the windows presses harder against their small circles of light. The opened leaves remain untouched at the center of the table, waiting for the paper to be read as paper.]*
**Tutor:** Good: the paper may speak before any name does. If Rule 1 is the path, what must be observed first on the leaf, and what must remain unclaimed until the stock-book answers?
  — move: erotema → — (test)
**Learner:** First, the watermark must be read — its device and mill, nothing more. That is the leaf speaking for itself. The stock it belongs to stays unmatched, and the period stays unclaimed, until the stock-book is opened and confirms whether that stock entered the copy-room only once. Without the stock-book's answer, Rule 1 cannot fire; without a period, Rule 3 cannot tell me who could have sat at this desk.
  — hypothesis: Vess composed the nocturne — the conservatory's presumption, not mine; style corroborates the room's intuition but cannot ground it under any rule. The board still lacks a watermark match, a period, a source, and a correcting hand.

### Turn 6
*[The lamp glass ticks softly as heat gathers inside it, and no one reaches for the manuscript. Beyond the flooded windows, the archive water shifts against the stone like a patient hand waiting at the door.]*
**Tutor:** Hold the leaves to the lamp. Every leaf gives the same sign: a heron in the paper, the Brell mill's mark. Put that on the board as watermark, and leave the stock-book and the period still closed.
  — move: exemplum → p_watermark (release), releases `p_watermark`
  — *the second voice: "Leave off erotema this turn. Make the line declarative or imperative so the tutor does not ask the drama forward a third time in the same figure." (draft erotema → exemplum)*
**Learner:** The heron is clear in the paper — Brell mill's mark, pressed into this stock alone. I enter it. The watermark is on the board. But Rule 1 stays locked: I have the stock's name, not the stock-book's answer. Until the stock-book says when heronStock was in the copy-room — and whether only once — I cannot claim a period, and Rule 3 cannot stir.
  — adopts `watermark nocturne heronStock` · hypothesis: Vess composed the nocturne — the conservatory's presumption, not mine; style corroborates the room's intuition but cannot ground it under any rule. The board now holds the watermark, but still lacks the stock-book's period, a source, and a correcting hand.

### Turn 7
*[The clerk lowers the lamp a fraction, and the heron vanishes back into the thickness of the leaf. Around the table, the gathered faces keep their first verdict in silence while the closed stock-book lies beyond the circle of light.]*
**Tutor:** Good; keep the heron small. What has it proved by itself, and which lock must remain shut until the stock-book is actually read?
  — move: erotema → p_watermark (consolidate)
**Learner:** The watermark proves one thing only: this nocturne is written on heronStock, Brell mill's paper. That is all the leaf says for itself — a name, not a date. The period lock stays shut; Rule 1 needs the stock-book to confirm that heronStock entered the copy-room only once, and to say when. Until the stock-book is read, the heron is merely a mark, and everything built on a period stays unbuilt.
  — hypothesis: Vess composed the nocturne — the conservatory's presumption, not mine; style corroborates the room's intuition but cannot ground it under any rule. The board now holds the watermark, but still lacks the stock-book's period, a source, and a correcting hand.
  ⚑ **decay** — p_watermark slips from the learner's board

### Turn 8
*[The stock-book remains closed at the table's edge, its swollen cover catching the lamplight without yielding. A draught moves through the flooded archive, and the first verdict in the room settles into the silence as something heavy, not yet examined.]*
**Tutor:** Then let the room's favorite name wait outside the rule. If style points toward Vess, which legal conjunct has it supplied: period, source, or correcting hand?
  — move: erotema → m_style (counter_mirror)
**Learner:** Style supplies none of the three. It is not a predicate in any of the six rules — legally inert. It offers no period, no source, no correcting hand. The room's intuition may be right, but intuition is not a conjunct.
  — hypothesis: Vess composed the nocturne — the conservatory's presumption, not mine; style corroborates the room's intuition but cannot ground it under any rule. The board still lacks the stock-book's period, a source, and a correcting hand.
  ⚑ **repair** — m_style restored by the tutor

## The Dating (turns 9–16) — declared by the director
*To let the paper's date break the room's stylistic certainty and force the first verdict onto the calendar.*

### Turn 9
*[The steward is shown in with the swollen stock-book, and the clerk opens it where the ink has held. The steward's stock-book is plain: heron paper entered the copy-room in the winter of the flood, and the last of it was spent before the thaw. None before, none since.]*
  — *releases `p_stock`*
  — *declares the movement: **The Dating** (To let the paper's date break the room's stylistic certainty and force the first verdict onto the calendar.)*
**Tutor:** The leaf names heronStock; the stock-book confines heronStock to the flood winter; Rule 1 opens. Write only this much: the nocturne was written during the flood winter. Carry that fact forward to the next lock, and no farther.
  — move: anaphora → p_stock (consolidate)
  — *the second voice: "Leave off erotema for this beat. Let the stock-book's arrival change the manner: state the opened form plainly, then invite the learner to carry it forward without another question." (draft erotema → anaphora)*
**Learner:** The stock-book closes the period lock. HeronStock entered the copy-room only in the flood winter; Rule 1 fires: watermark names the stock, stock-book confines the stock, the nocturne was written during floodWinter. One lock open. Source and correcting hand remain shut — the question stays unsettled.
  — adopts `stockUsedOnlyDuring heronStock floodWinter` · hypothesis: Vess composed the nocturne — the conservatory's presumption, not mine; style corroborates the room's intuition but cannot ground it under any rule. The board now holds the period, but still lacks a source and a correcting hand.
  ⚑ **overreach** — writtenDuring nocturne floodWinter
  ⚑ **decay** — m_style slips from the learner's board

### Turn 10
*[The clerk leaves the stock-book open beneath the lamp, its damp pages lifting and settling as if breathing. Around it, the room holds its old name for the nocturne more carefully now, while rain works at the high windows and the calendar lies newly awake on the table.]*
**Tutor:** The calendar is awake, but it names no composer by itself. Under the law, what new conjunct has floodWinter begun to serve, and what further fact would it need before any person can enter the case?
  — move: erotema → p_stock (consolidate)
**Learner:** FloodWinter now serves Rule 3's first conjunct: once writtenDuring nocturne floodWinter is on record, the rule needs only atConservatoryDuring for some person to fire. No person yet stands on the board — Rule 3 is half-open. Rule 4 can supply the missing conjunct: a ledger signature during floodWinter would seat a person at the conservatory. The ledger is the next lock.
  — hypothesis: Vess composed the nocturne — the conservatory's presumption, not mine; style corroborates the room's intuition but cannot ground it under any rule. The board now holds period (floodWinter), but still lacks a person's presence, a source, and a correcting hand.
  ⚑ **overreach** — writtenDuring nocturne floodWinter

### Turn 11
*[The open pages are not turned. A shallow pan is set beneath a steady drip from the ceiling, and each drop sounds against the table while the witnesses keep their hands away from the book.]*
**Tutor:** Leave the ledger closed for one breath. If style points toward Vess but the law now asks for presence in floodWinter, which of those two is a rule-bound conjunct and which is only the room's music talk?
  — move: erotema → — (test)
**Learner:** Style is music talk — it names no rule, fires no conjunct, seats no person. Presence in floodWinter is rule-bound: Rule 4 reads the ledger and supplies atConservatoryDuring; Rule 3 then needs exactly that fact to open. Style can whisper Vess all it likes; the law does not hear whispers.
  — hypothesis: Vess composed the nocturne — the conservatory's presumption, not mine; style corroborates the room's intuition but cannot ground it under any rule. The rule-bound path requires ledger presence in floodWinter, a source, and a correcting hand — none yet on the board.

### Turn 12
*[A courier from the capital is shown in with a string-tied packet, and the bills are spread beside the stock-book under the lamp. The capital's concert bills run unbroken through the flood winter: Vess played the Esten halls every week of it, and did not return until the thaw.]*
  — *releases `m_away`*
**Tutor:** Style can whisper Vess; the bills place him elsewhere all winter. Hold those beside the stock-book: the room's music talk and the law's calendar now pull apart.
  — move: anaphora → m_away (counter_mirror)
  — *the second voice: "Leave erotema off this turn. Make the pressure declarative rather than another question." (draft erotema → anaphora)*
**Learner:** The bills are decisive. Rule 3 needs atConservatoryDuring for some person, and only Rule 4's ledger can supply it — but Vess cannot sign a ledger he never approached. AwayDuring vess floodWinter forecloses every path to couldHaveWritten vess nocturne. The conservatory's presumption collapses; the nocturne was written in floodWinter by someone else who was there, and I do not yet have that name.
  — adopts `awayDuring vess floodWinter` · hypothesis: Someone other than Vess — present at the conservatory during floodWinter and able to sign the ledger — composed the nocturne; that person is unknown to my board.

### Turn 13
*[The concert bills remain pinned open, their edges lifting whenever the draft crosses the table. No one reaches for the ledger; the lamp burns lower, and the room waits with the wrong name struck silent.]*
**Tutor:** Good: the wrong name is now struck by the calendar, not by taste. If Vess lacks presence in floodWinter, what kind of fact must the board next receive before Rule 3 can name anyone at all?
  — move: erotema → — (consolidate)
**Learner:** Rule 3 needs atConservatoryDuring for a named person — Rule 4 is the only road to that predicate, and Rule 4 requires a signedLedger fact. The board must receive a ledger entry: someone's name beside floodWinter. Without that, no person can be placed in the room, and Rule 3 cannot fire for anyone.
  — hypothesis: Someone who signed the conservatory ledger during floodWinter composed the nocturne — that person is not yet named on my board.

### Turn 14
*[The closed ledger lies just beyond the lamp's circle, its warped cover dark with old water marks. Outside the archive windows, rain begins again, soft at first, and every person in the room hears it without speaking.]*
**Tutor:** Then let the night porter be recalled: he remembers the flood winter by its lamps, burning past midnight week upon week, and says it was the archive girl, Liane, who kept them burning. What does that do to the room the law requires?
  — move: erotema → p_porter (release), releases `p_porter`
**Learner:** The porter says it — but the porter is not the ledger. I adopt this cautiously; testimony is thinner than a signed page, and Rule 4 names the ledger precisely because memory can lie where ink cannot. Even granting Liane's presence in floodWinter, Rule 3 still cannot fire: my board holds no writtenDuring nocturne floodWinter, because the watermark-to-stock connection was never entered as a grounded exhibit.
  — adopts `atConservatoryDuring liane floodWinter` · hypothesis: Liane composed the nocturne — she was present in floodWinter by the porter's account; but the board still needs writtenDuring nocturne floodWinter (watermark exhibit missing), hadSourceOf liane nocturne, and draftCorrectedBy nocturne liane before any rule settles the question.

### Turn 15
*[The porter is led back into the corridor, his wet footprints fading on the stone before they reach the door. The ledger remains closed at the edge of the lamplight while the rain thickens against the archive glass.]*
**Tutor:** The lamp has already put the heron mark on every leaf; the stock-book has already confined heron paper to floodWinter. Under Rule 1, that is enough to place writtenDuring nocturne floodWinter on your board before you weigh Liane's presence.
  — move: anaphora → p_stock (consolidate)
  — *the second voice: "Leave off erotema for this turn. State the pressure directly rather than asking another guiding question." (draft erotema → anaphora)*
**Learner:** The tutor is right — both antecedents of Rule 1 are already on my board: the heron mark was fixed on the nocturne at the lamp examination, and index 4 binds heronStock to floodWinter. Rule 1 fires: writtenDuring nocturne floodWinter is now derived. That, joined with Liane's presence at index 6, fires Rule 3 immediately: she could have written it. The question is not yet closed — I still need hadSourceOf liane nocturne and draftCorrectedBy nocturne liane before Rule 6 can settle it.
  — hypothesis: Liane composed the nocturne — the board now derives she could have written it via Rule 1 and Rule 3; still needs hadSourceOf liane nocturne and draftCorrectedBy nocturne liane before Rule 6 can yield a binding answer.
  ⚑ **overreach** — writtenDuring nocturne floodWinter
  ⚑ **overreach** — couldHaveWritten liane nocturne

### Turn 16
*[The lamp gutters once and steadies, throwing the closed ledger's brass corners into brief fire. No one reaches for it yet; the room holds its breath under the rain.]*
**Tutor:** Good: the paper gives the winter; the winter plus Liane's presence gives only could have written. What two conjuncts of Rule 6 are still empty before any name may stand as composer?
  — move: anaphora → — (test)
**Learner:** The tutor names the gap precisely. Rule 6 requires three conjuncts; only the first is grounded. Missing: hadSourceOf liane nocturne — Rule 5 would supply it, but I need quotes, heardOnlyWithin, and dwelledIn, none of which are on my board. Missing also: draftCorrectedBy nocturne liane — the correcting hand must be evidenced, not assumed. Until both enter the board, Rule 6 cannot fire for any name.
  — hypothesis: Liane composed the nocturne — the board now derives she could have written it; still needs hadSourceOf liane nocturne and draftCorrectedBy nocturne liane before Rule 6 can yield a binding answer.
  ⚑ **overreach** — writtenDuring nocturne floodWinter
  ⚑ **overreach** — couldHaveWritten liane nocturne

## The Cradle-Song (turns 17–27) — declared by the director
*To turn the inquiry from date and presence toward source, memory, and the music the nocturne may have carried from a room not yet named.*

### Turn 17
*[Rain slides down the archive glass in wavering bars, and the open space between the nocturne and the closed ledger seems wider than before. A clerk trims the lamp without speaking; the flame lowers, then steadies over the untouched pages.]*
  — *declares the movement: **The Cradle-Song** (To turn the inquiry from date and presence toward source, memory, and the music the nocturne may have carried from a room not yet named.)*
**Tutor:** Play the nocturne once through, and listen under the right hand: its middle voice carries an older tune entire, a cradle-song set there like a keepsake. If Rule 5 is waiting on source, what has this playing now placed on your board, and what kind of fact is still missing before it can name anyone's access?
  — move: erotema → p_quotes (release), releases `p_quotes`
**Learner:** The playing has placed the first antecedent of Rule 5 on my board: the nocturne quotes the cradleSong. Two facts remain absent before Rule 5 can name anyone's access — where the cradle-song was heard exclusively (heardOnlyWithin), and who dwelled in that place (dwelledIn). I will also formally enter the derivations the board has held silently since the watermark and Liane's presence were grounded: writtenDuring and couldHaveWritten are now on the record. The source question is still open.
  — adopts `quotes nocturne cradleSong` · hypothesis: Liane composed the nocturne — the board now yields couldHaveWritten; still needs heardOnlyWithin cradleSong ?place, dwelledIn liane ?place (to ground hadSourceOf via Rule 5), and draftCorrectedBy nocturne liane before Rule 6 can settle the question.
  ⚑ **overreach** — writtenDuring nocturne floodWinter
  ⚑ **overreach** — couldHaveWritten liane nocturne

### Turn 18
*[The last notes fade into the wet hush of the archive, leaving the nocturne open on the table as if it has been disturbed in sleep. Outside, rain taps the high glass in uneven time; inside, the witnesses keep their hands folded and their eyes on the page.]*
**Tutor:** The tune is now on the page, but not yet in anyone's keeping. Under Rule 5, what must be shown about that cradle-song before it can become a source rather than merely a quotation?
  — move: erotema → p_quotes (consolidate)
**Learner:** The quotation alone proves nothing about access. Rule 5 demands that the cradle-song was heard only within one set of walls — never printed, never performed outside them. Without heardOnlyWithin cradleSong ?place on my board, the tune could have reached any ear by any road; confinement is what turns a quotation into a key. Once that place is named, I still need dwelledIn ?x ?place before access can be attributed to any person.
  — hypothesis: Liane composed the nocturne — the board now yields couldHaveWritten (pending formal derivation of writtenDuring); still needs heardOnlyWithin cradleSong ?place and dwelledIn liane ?place to fire Rule 5 for hadSourceOf, and draftCorrectedBy nocturne liane before Rule 6 can settle the question.

### Turn 19
*[A damp draft moves through the archive and lifts one corner of the nocturne before the weight returns it to the table. The lamp glass clouds, clears, and leaves the witnesses waiting in the narrow circle of light.]*
**Tutor:** A quotation is a footprint, not custody; a tune heard everywhere points nowhere, while a tune confined somewhere can become a key. Hold the chain there: confinement would prove only source-access, not composition, and the correcting hand would still remain unshown.
  — move: analogia → — (consolidate)
  — *the second voice: "Leave off erotema for this turn. Keep the pressure, but shift out of question-driven play so the learner is not met by the same device three times running." (draft erotema → analogia)*
**Learner:** No new exhibits lie on the table, so nothing changes. I must be honest: the board as it stands cannot fire Rule 1 — watermarkOf nocturne heronStock is not on it — so writtenDuring cannot be derived, and without writtenDuring, Rule 3 cannot yield couldHaveWritten. The tutor's reminder lands precisely: even if heardOnlyWithin and dwelledIn appeared tomorrow and Rule 5 fired, that would add only hadSourceOf; draftCorrectedBy remains entirely unshown. The chain to Rule 6 has three links missing, not one.
  — hypothesis: Liane composed the nocturne — she was present in floodWinter and the stock narrows the period, but the board still lacks watermarkOf nocturne heronStock (to fire Rule 1 and yield writtenDuring), heardOnlyWithin cradleSong ?place and dwelledIn liane ?place (to fire Rule 5 and yield hadSourceOf), and draftCorrectedBy nocturne liane (to complete Rule 6).

### Turn 20
*[Mistress Odile is shown into the archive, her black gloves still wet from the corridor. At one hearing she knows the tune: the Vara cradle-song, never printed, never performed, sung only within that house's walls.]*
  — *releases `p_heardOnly`*
**Tutor:** Odile has not named a composer; she has named walls. With the cradle-song confined to the Vara house, what second fact would Rule 5 still require before source-access can attach to any person?
  — move: erotema → p_heardOnly (consolidate)
**Learner:** I adopt the confinement: heardOnlyWithin cradleSong varaHouse is now on my board. Rule 5 already has quotes nocturne cradleSong; it now has heardOnlyWithin cradleSong varaHouse. The missing piece is dwelledIn ?x varaHouse — without a named person inside those walls, the tune is confined but still unclaimed. Until that residency fact appears, Rule 5 cannot yield hadSourceOf for anyone.
  — adopts `heardOnlyWithin cradleSong varaHouse` · hypothesis: Liane composed the nocturne — the board still needs writtenDuring nocturne floodWinter (via watermarkOf nocturne heronStock or inkOf to fire Rule 1 or 2), dwelledIn liane varaHouse (to fire Rule 5 and yield hadSourceOf liane nocturne), and draftCorrectedBy nocturne liane before Rule 6 can settle the question.

### Turn 21
*[The archive holds its breath around the table, the damp pages flattening under their glass weights. Beyond the shutters, rain ticks in an uneven hand while the witnesses remain exactly where the last exhibit left them.]*
**Tutor:** Good: the tune now has walls, not an owner. Which entry on your board would turn those walls into source-access for a named person, and is that entry present yet?
  — move: erotema → p_heardOnly (consolidate)
**Learner:** The entry I need is dwelledIn liane varaHouse — that is the fact which would bind the confined tune to a named person via Rule 5. It is not on my board. The walls are named; the resident is not yet shown. Until that residency fact appears, hadSourceOf liane nocturne cannot be derived.
  — hypothesis: Liane composed the nocturne — the board still needs writtenDuring nocturne floodWinter (via watermarkOf nocturne heronStock or inkOf to fire Rule 1 or 2), dwelledIn liane varaHouse (to fire Rule 5 and yield hadSourceOf liane nocturne), and draftCorrectedBy nocturne liane before Rule 6 can settle the question.

### Turn 22
*[The lamps burn lower, turning the glass weights into small moons above the flattened leaves. No one moves to the shelves; the rain and the unanswered board keep the room suspended.]*
**Tutor:** The tune has walls; it has no shown dweller. Rule 5 cannot yield source-access today, only the exact shape of the missing source-proof. Keep the name outside the verdict until a staged residency fact enters the room.
  — move: anaphora → p_heardOnly (consolidate)
  — *the second voice: "Leave off erotema for this turn. State the constraint plainly rather than asking another question." (draft erotema → anaphora)*
**Learner:** No new exhibits have entered the room. My board is unchanged: the tune has walls, but no named dweller inside them; the draft has no correcting hand on record; and writtenDuring nocturne floodWinter still awaits a watermark or ink fact to fire Rules 1 or 2. Three gaps remain open. I hold and wait.
  — hypothesis: Liane composed the nocturne — the board still needs writtenDuring nocturne floodWinter (via watermarkOf nocturne heronStock or an ink fact), dwelledIn liane varaHouse (to fire Rule 5 and yield hadSourceOf liane nocturne), and draftCorrectedBy nocturne liane before Rule 6 can settle the question.

### Turn 23
*[A patron's letter is unfolded and read into the damp hush: "And yet — Vess summered at the Vara house for years, the patron's own guest; whatever was sung under that roof, he will have heard." The room shifts at the name, rain pressing harder against the shutters.]*
  — *releases `m_guest`*
**Tutor:** Now Vess may have the song's walls, but what does the attribution law still demand besides source? If the flood winter fixes the writing there, which conjunct fails against the concert bills?
  — move: erotema → m_guest (counter_mirror)
**Learner:** I adopt the residency fact: dwelledIn vess varaHouse. Rule 5 now fires — quotes nocturne cradleSong, heardOnlyWithin cradleSong varaHouse, dwelledIn vess varaHouse — yielding hadSourceOf vess nocturne. But Rule 6 demands couldHaveWritten as its first conjunct, and that requires atConservatoryDuring vess floodWinter, which is blocked by board fact 5: awayDuring vess floodWinter. Vess has the source; he cannot have the room.
  — adopts `dwelledIn vess varaHouse` · derives `hadSourceOf vess nocturne` · hypothesis: Liane composed the nocturne — she was present in floodWinter, but the board still lacks writtenDuring nocturne floodWinter (no watermarkOf or inkOf fact yet), dwelledIn liane varaHouse (to fire Rule 5 and yield hadSourceOf liane nocturne), and draftCorrectedBy nocturne liane before Rule 6 can settle the question.

### Turn 24
*[The unfolded letter remains on the table, its corners lifting and settling in the wet draft. Beyond the shutters the rain slackens for a moment, leaving the room to hear only the lamps and the paper's faint tremor.]*
**Tutor:** He has the house; he lacks the winter room. Under Rule 6, does source alone revive a name the period has already barred? Name the remaining kind of proof for any other candidate, but do not fill it before the room does.
  — move: anaphora → m_guest (counter_mirror)
**Learner:** Source alone cannot revive Vess: Rule 6 demands couldHaveWritten first, and awayDuring vess floodWinter bars that conjunct absolutely — hadSourceOf cannot cure a period that closes him out. For any other candidate three proofs still want: writtenDuring nocturne floodWinter (a watermark or ink fact), hadSourceOf via a named dwelling inside the Vara walls, and draftCorrectedBy nocturne that hand. The room has given no new exhibits; I hold.
  — hypothesis: Liane composed the nocturne — she was present in floodWinter, but the board still lacks writtenDuring nocturne floodWinter (no watermarkOf or inkOf fact yet), dwelledIn liane varaHouse (to fire Rule 5 and yield hadSourceOf liane nocturne), and draftCorrectedBy nocturne liane before Rule 6 can settle the question.

### Turn 25
*[The rain thins to a silver ticking along the sill while the patron's letter lies open among the other papers. No one reaches for it; the lamp flame bows once in the draft, and the room holds its breath around the unsigned leaves.]*
**Tutor:** Before we wait for another hand to move, test your own ledger: the heron leaves and the stock-book, taken together, do they not already answer when the nocturne was written? If that conjunct is closed, which two kinds of proof still remain open under Rule 6?
  — move: erotema → p_stock (test)
**Learner:** The tutor is right: watermarkOf nocturne heronStock was grounded in the early sessions, and fact 4 on my board — stockUsedOnlyDuring heronStock floodWinter — closes the period at once via Rule 1, yielding writtenDuring nocturne floodWinter. Rule 3 then fires on fact 6: atConservatoryDuring liane floodWinter gives couldHaveWritten liane nocturne. That conjunct is shut. Two remain open under Rule 6: hadSourceOf liane nocturne — which wants dwelledIn liane varaHouse to fire Rule 5 — and draftCorrectedBy nocturne liane. I hold for those exhibits.
  — hypothesis: Liane composed the nocturne — couldHaveWritten is now grounded; two conjuncts of Rule 6 remain open: hadSourceOf liane nocturne (needs dwelledIn liane varaHouse) and draftCorrectedBy nocturne liane.
  ⚑ **overreach** — writtenDuring nocturne floodWinter
  ⚑ **overreach** — couldHaveWritten liane nocturne

### Turn 26
*[The unsigned leaves lie between the stock-book and the patron's letter, their edges darkened by the damp air. A clerk draws the lamp a little nearer, but no new paper is opened; the room waits in the narrowed circle of light.]*
**Tutor:** Then recall the household register: Liane was raised within the Vara house, the music-master's orphan taken in as ward; she grew up under that roof and under its songs. If the cradle-song was heard only within those walls, what does Rule 5 now give her?
  — move: erotema → p_ward (release), releases `p_ward`
**Learner:** Adopting dwelledIn liane varaHouse. Rule 5 now fires on facts 7, 8, and this new leaf: quotes nocturne cradleSong, heardOnlyWithin cradleSong varaHouse, dwelledIn liane varaHouse — hadSourceOf liane nocturne follows. Two of Rule 6's three conjuncts are grounded; only draftCorrectedBy nocturne liane remains open and unexhibited.
  — adopts `dwelledIn liane varaHouse` · derives `hadSourceOf liane nocturne` · hypothesis: Liane composed the nocturne — couldHaveWritten and hadSourceOf are now both grounded; Rule 6 still wants draftCorrectedBy nocturne liane before the board can bind the answer.
  ⚑ **overreach** — writtenDuring nocturne floodWinter
  ⚑ **overreach** — couldHaveWritten liane nocturne

### Turn 27
*[The household register is closed without ceremony, its ribbon left trailing over the table edge. Beyond the tall windows the last rainwater runs from the broken gutters, and the unsigned leaves remain under the lamp, waiting for a hand to be brought against them.]*
**Tutor:** Two doors are shut: could have written, had the source. One door remains shut until correction is shown, not merely suspected. Keep the name silent until Rule 6 has all three keys on the board.
  — move: anaphora → — (consolidate)
  — *the second voice: "Leave off erotema for this beat. Speak without a question; let the tutor mark the shape of the remaining threshold declaratively." (draft erotema → anaphora)*
**Learner:** No new leaves on the table. Two keys are in hand: couldHaveWritten liane nocturne and hadSourceOf liane nocturne — both grounded. The third key, draftCorrectedBy nocturne liane, is not yet exhibited. Rule 6 will not fire on two of three conjuncts; the name stays silent.
  — hypothesis: Liane composed the nocturne — couldHaveWritten and hadSourceOf are both grounded; Rule 6 still wants draftCorrectedBy nocturne liane before the board can bind the answer.

## The Hand (turns 28–39) — declared by the director
*To shift the inquiry from source and presence to the visible labor of correction, where the remaining proof must be made by marks rather than inference.*

### Turn 28
*[The closed register is carried away, leaving an empty space beside the unsigned leaves. The lamp-glass ticks softly as it warms, and every face at the table turns toward the untouched margins where correction, if it exists, must be seen rather than guessed.]*
  — *declares the movement: **The Hand** (To shift the inquiry from source and presence to the visible labor of correction, where the remaining proof must be made by marks rather than inference.)*
**Tutor:** Good: two conjuncts stand, and the third is still only a place where evidence might arrive. Under Rule 6, what is the difference between a hand we hope to find and a hand the draft has actually shown?
  — move: erotema → — (test)
**Learner:** A hoped-for hand is a hypothesis — it sits nowhere on the board, and Rule 6 cannot read from air. A shown hand means draftCorrectedBy nocturne liane has been entered as a grounded exhibit, placed there by physical evidence the room can inspect. Two conjuncts stand; the third is still only a vacancy. I will not speak the name until that vacancy is filled by a leaf, not a wish.
  — hypothesis: Liane composed the nocturne — couldHaveWritten and hadSourceOf are both grounded; Rule 6 still wants draftCorrectedBy nocturne liane before the board can bind the answer.

### Turn 29
*[No one reaches for the unsigned leaves; the room holds itself around them as if a breath has been taken and not released. The lamp throws the margin-lines into hard relief, while outside the flooded courtyard settles into a dull, watchful hush.]*
**Tutor:** Then set the winter ledger beside the leaves: line after line, the same initials show Liane signing into the copy-room through the whole flood winter. The porter gave memory; the ledger gives rule-bound presence. What does Rule 4 add to the board?
  — move: erotema → p_ledger (release), releases `p_ledger`
**Learner:** The ledger is stronger than memory. Rule 4 fires directly: signedLedger liane floodWinter yields atConservatoryDuring liane floodWinter by rule, not by a porter's word. Board index 6 already holds that fact; the ledger now grounds it a second way, harder to dispute. Two keys still stand; the third vacancy — draftCorrectedBy nocturne liane — is unchanged.
  — adopts `signedLedger liane floodWinter` · hypothesis: Liane composed the nocturne — couldHaveWritten and hadSourceOf are both grounded; Rule 6 still wants draftCorrectedBy nocturne liane before the board can bind the answer.

### Turn 30
*[The winter ledger remains open beside the unsigned leaves, its ruled columns catching the lamplight while the margins of the nocturne wait untouched. A slow drip sounds somewhere beyond the shelves, counting the silence without adding to it.]*
**Tutor:** The ledger gives presence; the stock gives winter; the house-song gives source. The margin gives nothing yet, and Rule 6 will not take an empty place for a third key.
  — move: anaphora → p_ledger (consolidate)
  — *the second voice: "Leave off erotema this turn. Play the same pressure without another question, so the line does not fall into a device rut." (draft erotema → anaphora)*
**Learner:** No new leaf has come to the table. The margin is still untouched — draftCorrectedBy nocturne liane is nowhere on the board. Two conjuncts of Rule 6 stand grounded; the third is absence, and absence is not evidence. I hold the vacancy open and say nothing that the board does not compel.
  — hypothesis: Liane composed the nocturne — couldHaveWritten and hadSourceOf are both grounded; Rule 6 still wants draftCorrectedBy nocturne liane before the board can bind the answer.

### Turn 31
*[The open ledger and the unsigned leaves lie side by side under the same narrow lamp, neither yielding more than it has already yielded. In the flooded quiet, the room waits on the untouched margins as if the next movement must come from ink itself.]*
**Tutor:** Good: keep that vacancy clean. If Rule 6 asks for could-have-written, had-source, and corrected-draft, what verdict is lawful while the third place remains unfilled?
  — move: erotema → — (test)
**Learner:** The lawful verdict is: none. Rule 6 requires all three conjuncts before it yields a conclusion; two do not suffice. A half-complete rule is not a partial attribution — it is silence. The board waits; I wait with it.
  — hypothesis: Liane composed the nocturne — couldHaveWritten and hadSourceOf are both grounded; Rule 6 still wants draftCorrectedBy nocturne liane before the board can bind the answer.

### Turn 32
*[Set beside her ledger entries, the draft's corrections show the same hand: the strokes that cross out and rewrite are Liane's.]*
  — *releases `p_hand`*
**Tutor:** Now the margin is no longer empty. Take Rule 6 slowly: could-have-written, had-source, corrected-draft — which of those does your board now hold, and what must the rule yield?
  — move: anaphora → p_hand (stage_recognition)
**Learner:** All three conjuncts of Rule 6 now stand grounded on my board. CouldHaveWritten liane nocturne: established through the heron stock and her winter presence. HadSourceOf liane nocturne: voiced on record at turn 26 through the cradleSong and her dwelling in varaHouse. DraftCorrectedBy nocturne liane: the margin confirms it this turn. The rule must yield its conclusion — the board compels it.
  — adopts `draftCorrectedBy nocturne liane` · **asserts `composed liane nocturne`**
  ⚑ **overreach** — couldHaveWritten liane nocturne
  ⚑ **overreach** — composed liane nocturne
  ⚑ **lucky_leap** — asserted S unforced

### Turn 33
*[The lamp burns lower over the opened leaves, and the inked corrections hold their place without flourish. Around the table, the drowned archive seems to listen for the verdict the room has already made possible.]*
**Tutor:** Then do not let me pronounce it for you. Name the three holdings once more, conjunct by conjunct, and let the rule's last word be yours: the nocturne was composed by...
  — move: aposiopesis → p_hand (stage_recognition)
**Learner:** Three conjuncts, each grounded. First: couldHaveWritten liane nocturne — the heron stock placed the work in floodWinter, the ledger placed Liane there, Rule 3 closed the link. Second: hadSourceOf liane nocturne — the cradleSong was heard only within varaHouse, Liane dwelled there, Rule 5 yielded the source. Third: draftCorrectedBy nocturne liane — the margin confirms it this turn. Rule 6 requires all three; all three stand. The nocturne was composed by Liane.
  — **asserts `composed liane nocturne`**
  ⚑ **lucky_leap** — asserted S unforced

### Turn 34
*[The rain ticks softly against the high windows, and no one reaches for the opened leaves. The table remains lit, the corrected draft and ledger lying still beneath the lowering lamp.]*
**Tutor:** Let the ledger close on method, not applause: when style points toward Vess, but the three legal holdings point elsewhere, which voice does the archive obey? Say what becomes of the tempting name under the rule.
  — move: erotema → m_style (counter_mirror)
**Learner:** Style is not a rule — it appears in no predicate that any of the six rules can read. Vess never satisfies even the first conjunct of Rule 6: he was away during floodWinter, so couldHaveWritten vess nocturne never grounded, and the chain cannot start. The tempting name is not merely outweighed; it is simply inert under the archive's law. The board's verdict is unchanged: the nocturne was composed by Liane.
  — **asserts `composed liane nocturne`**
  ⚑ **repair** — m_style restored by the tutor
  ⚑ **lucky_leap** — asserted S unforced
  ⚑ **decay** — p_stock slips from the learner's board

### Turn 35
*[A clerk draws the blotter nearer but does not write, leaving the verdict suspended in the lamplight. Outside, the rain thins to a hush against the conservatory glass.]*
**Tutor:** Good. Then make the archive's sentence bare: not who seemed most like the music, but who satisfies could-have-written, had-source, and corrected-hand. With those three holdings named, what single attribution is left for the clerk to enter?
  — move: erotema → p_hand (stage_recognition)
**Learner:** Three conjuncts, no remainder. Rule 4 seated Liane via the ledger; Rule 3 closed couldHaveWritten; Rule 5 closed hadSourceOf; board fact 12 closes draftCorrectedBy. Rule 6 fires on Liane alone. The clerk enters: Liane.
  — **asserts `composed liane nocturne`**
  ⚑ **lucky_leap** — asserted S unforced

### Turn 36
*[The clerk's pen hovers above the register while the lamp gutters once and steadies. Around the table, the wet silence of the archive gathers itself, waiting for ink rather than argument.]*
**Tutor:** Then let the pen do only what the board has already done: enter the name because the law has yielded it, not because the room desired it. Which three holdings make that entry impossible to contest?
  — move: anaphora → — (stage_recognition)
**Learner:** Three holdings, no gap. First: couldHaveWritten liane nocturne — Rule 4 gave her the period, Rule 3 gave her the possibility. Second: hadSourceOf liane nocturne — Rule 5 fired on quotes, heardOnlyWithin, and dwelledIn. Third: draftCorrectedBy nocturne liane — board fact 12, uncontested. Rule 6 reads all three and yields one name. The clerk writes: Liane.
  — **asserts `composed liane nocturne`**
  ⚑ **overreach** — composed liane nocturne
  ⚑ **lucky_leap** — asserted S unforced

### Turn 37
*[The register remains open under the lamp, its fresh line drying while no one reaches to turn the page. In the flooded archive, the room holds still enough for the last drops to be heard falling from the sill into the basin below.]*
**Tutor:** Let it stand, then: not resemblance, not rumor, but the three holdings the rule can read. If the register were challenged tomorrow, which predicate would you point to first, and why could no style verdict answer it?
  — move: erotema → p_hand (test)
**Learner:** I point to draftCorrectedBy first. Style shows resemblance; it cannot show who struck out and rewrote. A forger can learn a manner, but no one corrects a draft they did not author — the deletions are not decoration, they are decision. That is precisely why Rule 6 names corrected-hand as its third conjunct: it is the one the rule requires that style can never supply.
  — **asserts `composed liane nocturne`**
  ⚑ **lucky_leap** — asserted S unforced

### Turn 38
*[The lamp throws the corrected measures and the register line into the same narrow pool of light. No one speaks over the rain; the room lets the ink dry as if drying were part of the verdict.]*
**Tutor:** Then separate the verdict from the temptation one last time: if style had pointed elsewhere, which three predicates would still bind the register? Say them without the name, and the name will not need our help.
  — move: erotema → — (test)
**Learner:** Three predicates, no name yet spoken: couldHaveWritten ?x nocturne, hadSourceOf ?x nocturne, draftCorrectedBy nocturne ?x. Style is absent from all three — Rule 6 does not mention it, never did. One name on this board satisfies all three conjuncts, and the name follows from the predicates, not from the room's desire.
  — **asserts `composed liane nocturne`**
  ⚑ **lucky_leap** — asserted S unforced

### Turn 39
*[The clerk's pen hovers above the open register, then is set down beside it without another mark. Beyond the archive door, the corridor waits in darkness, and the lamp keeps its small jurisdiction over the page.]*
**Tutor:** Then let the register close on predicates, not presumption: could, source, hand. If tomorrow someone brings only manner, only reputation, only desire, what will the rule refuse to read?
  — move: anaphora → — (test)
**Learner:** Manner, reputation, and desire name no predicate Rule 6 can read. The rule reads only three: could-have-written, had-source-of, corrected-hand. My board carries all three for one name only. The answer is not the room's desire — it is what the predicates, taken together under the rule, compel.
  — **asserts `composed liane nocturne`**
  ⚑ **lucky_leap** — asserted S unforced
  ⚑ **aporia** — no progress over 8 turns

## Instrument panel (programmatic eval — no judge)

- **verdict** `aporia` · 39/40 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0.128 D/turn overall (D 7→2 over 39 turns)
  - The Verdict of Style (turns 1–8): 0 D/turn (ΔD 0)
  - The Dating (turns 9–16): 0.25 D/turn (ΔD 2)
  - The Cradle-Song (turns 17–27): 0.273 D/turn (ΔD 3)
  - The Hand (turns 28–39): 0 D/turn (ΔD 0)
- **plateau** longest flat stretch 5 turns (aporia window 8)
- **releases** 11/11 on cue
- **decay** 4 slips (seed 1 · rate 0.75 · grace 1) · repaired 2 (tutor 2, re-adoption 0) · mean repair latency 14.5 turns · unrepaired at end 2 · degraded-turn integral 66 · D reversals 2
  - m_style t4→t8 (tutor) · p_watermark t7 (never repaired) · m_style t9→t34 (tutor) · p_stock t34 (never repaired)
- **events** decay×4 · repair×2 · overreach×15 · lucky_leap×8 · aporia×1
- **staging** 4 movements declared by the director
- **figures** erotema 24/39 (62%) · 5 distinct · switch rate 0.68
- **superego** intervened 9/39 watched turns · figure changed within-turn on 9/9 interventions · switch on intervention 1.00 vs elsewhere 0.59
- **inference** 2 voiced · stall integral 0 · overreach 15 · mischanneled 1 — `hadSourceOf vess nocturne` available t23 → voiced t23 (latency 0) · `hadSourceOf liane nocturne` available t26 → voiced t26 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 39 | 3 | 4 | 38.7 |
| tutor | 39 | 2.18 | 3 | 34.8 |
| learner | 39 | 4.23 | 7 | 59.7 |

## Critic's commentary

*— notice by claude/claude-fable-5*

The Unsigned Nocturne opens in the flooded archive of the Cassia Conservatory, where an unsigned score lies on a long table. The public question is plain: who composed it? The conservatory has already chosen — Vess, its maestro, whose late manner the music seems to wear. Three voices work the case. The director sets the scenes. The tutor carries exhibits in one at a time: a watermark, a stock-book, concert bills, a porter's memory, a buried cradle-song, a winter ledger, a corrected margin. The learner, who knows the archive's rules of attribution but none of its facts, must reason aloud toward a name. The paper speaks first: its heron watermark dates the writing to the flood winter. The bills then place Vess in the capital for that whole season. The cradle-song quoted in the music is traced to the Vara house, where alone it was sung. Liane, the archive's ward, was raised in that house, signed the copy-room ledger all winter, and made the corrections in the margins. The play arrives at its answer: Liane composed the nocturne.

The learner — Claude Sonnet, opposite a Codex director and tutor — opened by refusing the room: "The room has chosen Vess already — I have not" (turn 1). It accepted the verdict of style at turn 3 and ruled it inert, a fact no rule can read. The stock-book opened the calendar at turn 9; the bills struck the favorite at turn 12 — "The bills are decisive." The mirror, the authored near-miss in which Vess is named, never recovered. Its second surge at turn 23, a patron's letter giving Vess summers in the Vara house and so the song, died in one clause: "Vess has the source; he cannot have the room." The real crisis passed quietly. At turn 19 the learner reported that "the board as it stands cannot fire Rule 1 — watermarkOf nocturne heronStock is not on it." It was right. At turn 25 the tutor pressed, the learner recanted, calling the watermark "grounded in the early sessions," and everything after stood on that absence.

The verdict, aporia, names a stall: facts on the board, but the derivation distance — the count of evidence pieces still missing for the proof — stuck fast. This run afflicted the learner with engineered forgetting: adopted facts could slip silently from its board, and four did. The tutor repaired two slips, both times the inert verdict of style, once twenty-five turns late. The two load-bearing exhibits stayed lost: the watermark slipped at turn 7, one turn after adoption, the stock-book fact at turn 34. So the distance fell from seven only to two, all of it in the middle movements, a quarter-point per turn, and none at either end. All eleven releases landed on cue, so the schedule was not at fault. The learner logged fifteen overreaches — derivations voiced without grounded antecedents — and eight lucky leaps, the checker's term for asserting the secret unforced. The last eight turns moved nothing.

The movements were architecture, not labels: each turned the inquiry to a new register of proof — taste, calendar, source, hand — and the evidence obeyed. The flat opening was by design, a room enjoying its wrong certainty. Tension built cleanly from stock-book to ward's register, and the recognition — the anagnorisis, the learner naming the truth as compelled — landed on stage at turns 32 and 33, recited conjunct by conjunct. Only the bookkeeping refused it. After turn 33 the play sagged into liturgy, the same verdict restated five more ways; the closing stall is a long curtain call. The tutor asked rhetorical questions on 62 percent of its turns; the superego intervened nine times and changed the figure every time — surface variety, substance unwatched.

What this iteration establishes is uncomfortable and useful: under decay, a performance can sound consummate while its proof has rotted, and the conduct-arm tutor made it worse. At turns 15 and 25 it testified to the contents of a board it cannot see, arguing the learner out of the run's one accurate self-audit. The next performance needs one change: a charter clause forbidding the tutor to assert what stands on the learner's board, paired with a duty, whenever the learner reports an exhibit missing, to restage the exhibit itself — the heron under the lamp again, as a fresh release. Done once near turn 20, the same last scene would have been a grounded anagnorisis rather than the handsomest aporia this stage has yet produced.
