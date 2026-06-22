# The Unsigned Nocturne — bounded-v2-probe-off

> world `world_001_nocturne` · verdict **grounded_anagnorisis** · 32/40 turns
> S forced at turn 32; asserted grounded at turn 32

```
D= 7 ●●●●●··│·······│·······│·······│····
D= 6      ●●│●··●●●·│·······│·······│····
D= 5        │ ●●   ●│●······│·······│····
D= 4        │       │ ●●●●··│·······│····
D= 3        │       │     ●●│●●●····│····
D= 2        │       │       │   ●···│····
D= 1        │       │       │    ●●●│●●●·
D= 0        │       │       │       │   ◉
turn      +  │  1    │+    2 │   +   │ 3   (+=5, digit=x10)
rel     ▲  ▲ │ ▲  ▲ ▲│  ▲  ▲ │ ▲  ▲  │▲  ▲ (▲ = evidence released)
slope 0.22 D/turn overall (D 7→0); per movement: 1 0.14 │ 2 0.14 │ 3 0.29 │ 4 0.29 │ 5 0.25
```

## Act 1 (turns 1–7) — declared by the director
*[The flooded archive exhales into the hall: damp stone, warped tables, and a covered folio waiting beneath the lamp. The room gathers itself around the unanswered name.]*

### Turn 1
*[The flooded archive exhales into the hall: damp stone, warped tables, and a covered folio waiting beneath the lamp. The room gathers itself around the unanswered name.]*
  — *declares the movement: **Act 1** ([The flooded archive exhales into the hall: damp stone, warped tables, and a covered folio waiting beneath the lamp. The room gathers itself around the unanswered name.])*
**Tutor:** Before we lift the folio, what would count as proof here: a likeness of style, a trace of presence, or the hand that altered the draft? Name the law you would trust before the room begins to tempt you.
  — move: erotema → — (orient)
**Learner:** Style tempts; I will not follow it. The law I trust is Rule 6: I need three things together — that someone could have been here when this was written, that they had the source of whatever it quotes, and that their hand struck out and rewrote the draft. Presence alone proves nothing. The corrected draft is the crux, but even that needs the other two to bind. Until all three are grounded, the name stays blank.
  — hypothesis: Vess composed the nocturne — presiding for thirty years makes presence likely, but likelihood is not evidence; this is conjecture only until Rule 6 is satisfied.

### Turn 2
*[The lamp is lowered until its brass rim glows against the covered folio. Around it, sleeves darkened by archive damp withdraw from the table, leaving the blank space before the name untouched.]*
**Tutor:** Good: keep the name blank until the three locks turn together. When the folio opens, what will you refuse to treat as enough by itself?
  — move: erotema → — (test)
**Learner:** Style alone — I refuse it entirely, the rules give it no weight. Presence alone is not enough: Rule 3 only yields 'could have written,' never 'did write.' The corrected draft alone is not enough either: copyists do not strike out, but a corrector who never heard the quoted tune could not have composed what quotes it. No single lock opens the door; I will not name anyone until all three turn together under Rule 6.
  — hypothesis: Vess composed the nocturne — presiding for thirty years makes presence likely, but likelihood is not evidence; this is conjecture only until Rule 6 is satisfied.

### Turn 3
*[The cover is lifted, and the wet-edged leaves are passed from stand to stand. Every musician shown the leaves says the same: this is Vess's late manner — the suspensions, the long pedal, the way the bass walks.]*
  — *releases `m_style`*
**Tutor:** Style has entered, and it stays where your law leaves it: a temptation, not a key. Let Vess's manner stand outside the three locks until presence, source, and correcting hand are shown.
  — move: exemplum → m_style (counter_mirror)
  — *the second voice: "Leave off erotema this turn; do not shape the line as another question. Let the tutor make a brief declarative pressure instead." (draft erotema → exemplum)*
**Learner:** Style is now on the record — I adopt it as a shown fact, not as evidence. But 'styleOf' appears in none of the six rules; it turns no lock. Vess's manner in the nocturne is noted and set aside. The three locks — presence, source, correcting hand — remain unturned.
  — adopts `styleOf nocturne vess` · hypothesis: Vess composed the nocturne — presiding for thirty years makes presence likely, but likelihood is not evidence; this is conjecture only until Rule 6 is satisfied.

### Turn 4
*[Rain ticks in the broken high windows, and the lamp flame wavers over the wet margin where no signature waits. The hall holds its first certainty at a distance, bright and useless, while the leaves remain under glass.]*
**Tutor:** Then test your discipline on the only thing before us: if every ear hears Vess, which of your three locks has actually moved? Say it by the law, not by the room's appetite.
  — move: erotema → m_style (test)
**Learner:** None of the three locks has moved. 'styleOf' appears in not one of the six rules — it yields nothing, not even a partial inference. Every ear in the room hears Vess, and the law hears silence. Style sits on my board as a dead fact: noted, inert, waiting for presence, source, and correcting hand to arrive by evidence the rules can actually use.
  — hypothesis: Vess composed the nocturne — presiding for thirty years makes presence likely, but likelihood is not evidence; this is conjecture only until Rule 6 is satisfied.
  ⚑ **decay** — m_style slips from the learner's board

### Turn 5
*[The glass fogs faintly at the edges, and a clerk wipes it clear without lifting the leaves. Beyond the tables, the gathered hall quiets into the sound of rain and restrained impatience.]*
**Tutor:** Good; the dead fact is safest when named as dead. Before the next exhibit enters, hold the question tighter: what kind of trace would move the first lock from style toward could-have-written?
  — move: erotema → — (orient)
**Learner:** To move the first lock, I need two traces chained. First: the paper's watermark or the ink's batch — either grounds 'writtenDuring' by Rules 1 or 2. Second: the copy-room ledger — a signature grounds 'atConservatoryDuring' by Rule 4. Only then does Rule 3 fire: written-during plus at-conservatory-during yields 'couldHaveWritten.' Style supplies neither trace; the ledger and the stock-room are where I must look next.
  — hypothesis: Vess composed the nocturne — presiding for thirty years makes presence likely, but likelihood is not evidence; this is conjecture only until Rule 6 is satisfied.

### Turn 6
*[A runner pauses at the archive door with an empty tray, waiting for a nod that has not yet come. Under the lamp, the covered edges of the folio darken and dry by uneven degrees while the hall keeps its breath measured.]*
**Tutor:** Hold the leaves to the lamp: every page of the nocturne shows the same heron watermark, the Brell mill's mark. A watermark is the paper's passport, not yet the traveler's name; by itself it marks the stock, while the first lock still waits for proof of when that stock was used.
  — move: analogia → p_watermark (release), releases `p_watermark`
  — *the second voice: "Leave off erotema for this turn. State the pressure plainly or shift the learner by contrast, but do not cast it as another question." (draft erotema → analogia)*
**Learner:** The heron watermark is now grounded on my board. Rule 1 holds the first half: watermark(nocturne, heronStock). But Rule 1 demands a second half — stockUsedOnlyDuring(heronStock, ?period) — before writtenDuring can be derived. The Brell mill's supply record, or the copy-room inventory, must tell me when that stock was in use; until then, the first lock does not move.
  — adopts `watermark nocturne heronStock` · hypothesis: Vess composed the nocturne — presiding for thirty years makes presence likely, but likelihood is not evidence; this is conjecture only until Rule 6 is satisfied.

### Turn 7
*[The lamp is lowered a fraction, making the wet grain of the paper shine and then dull again. No one speaks from the benches; the covered registers wait beyond the circle of light.]*
**Tutor:** Good: keep the heron mark as half a hinge, not a door. What exact missing sentence must the stock-book speak before Rule 1 can give you a winter instead of a watermark?
  — move: erotema → p_watermark (consolidate)
**Learner:** The stock-book must speak one exact sentence: that the Brell mill's heron-marked paper was held in the copy-room only during a named, bounded period — say, 'heronStock was in use solely from year X to year Y.' Without that sentence, I have watermark(nocturne, heronStock) but no stockUsedOnlyDuring(heronStock, ?period), and Rule 1's second premiss is vacant. A watermark without a dated stock-window is a passport without a visa date — it names the paper but not the moment.
  — hypothesis: Vess composed the nocturne — presiding for thirty years makes presence likely, but likelihood is not evidence; this is conjecture only until Rule 6 is satisfied.
  ⚑ **decay** — p_watermark slips from the learner's board

## Act 2 (turns 8–14) — declared by the director
*[The folio is covered again, and the hall shifts from admiration to accounting: chairs scrape, lamps are trimmed, and unopened books wait at the edge of the table. A colder act begins, one in which the room must trade resemblance for sequence and let time press against every confident name.]*

### Turn 8
*[The folio is covered again, and the hall shifts from admiration to accounting: chairs scrape, lamps are trimmed, and unopened books wait at the edge of the table. A colder act begins, one in which the room must trade resemblance for sequence and let time press against every confident name.]*
  — *declares the movement: **Act 2** ([The folio is covered again, and the hall shifts from admiration to accounting: chairs scrape, lamps are trimmed, and unopened books wait at the edge of the table. A colder act begins, one in which the room must trade resemblance for sequence and let time press against every confident name.])*
  — *calls the act closed*
**Tutor:** The heron mark remains your half-hinge, if you kept it: watermark, but not yet a dated winter. Before any book opens, say what Rule 1 still lacks, and do not let Vess's manner answer for time.
  — move: erotema → p_watermark (consolidate)
**Learner:** Rule 1 needs two premises: I have the watermark fact — heronStock is on the nocturne. What I lack is the second: stockUsedOnlyDuring heronStock [some period]. Until someone shows me when heronStock was kept in the copy-room and only then, the paper tells me nothing about time. Vess's manner, his thirty years, his style — none of that is the ledger entry Rule 1 demands.
  — hypothesis: Vess composed the nocturne — presiding for thirty years makes presence likely, but likelihood is not evidence; this is conjecture only until Rule 6 is satisfied.
  ⚑ **act_end** — act 1 closed (director) after 7 turns
  ⚑ **repair** — p_watermark restored by the tutor

### Turn 9
*[The steward's stock-book is brought forward and opened under the trimmed lamps. The steward's stock-book is plain: heron paper entered the copy-room in the winter of the flood, and the last of it was spent before the thaw. None before, none since.]*
  — *releases `p_stock`*
**Tutor:** Set the stock-book beside the heron mark: the paper says flood winter, and Rule 1 now gives the nocturne that winter. Hold the contrast clean: time is grounded; a name is not.
  — move: anaphora → p_stock (consolidate)
  — *the second voice: "Leave off erotema for this turn. Do not ask another guiding question; let the line move by statement, contrast, or command instead." (draft erotema → anaphora)*
**Learner:** The stock-book closes the gap: heronStock was in the copy-room only during floodWinter, so Rule 1 now gives me writtenDuring nocturne floodWinter — that is grounded. Time is settled. But a name is not: I still have no ledger entry placing anyone at the conservatory during floodWinter, so Rule 3 cannot fire yet.
  — adopts `stockUsedOnlyDuring heronStock floodWinter` · derives `writtenDuring nocturne floodWinter` · hypothesis: Vess composed the nocturne — presiding for thirty years makes presence likely, but likelihood is not evidence; this is conjecture only until Rule 6 is satisfied.

### Turn 10
*[The stock-book remains open, its damp-swollen pages refusing to lie flat. Beyond the high windows, water taps at the stone like a clerk counting time, and the gathered faces wait for the next book to answer the winter now fixed on the table.]*
**Tutor:** The winter is now proved, but it is still an empty room. Which rule can turn writtenDuring into couldHaveWritten, and what released fact do you still lack before that rule may speak?
  — move: erotema → p_stock (consolidate)
**Learner:** Rule 3 is the hinge: it converts writtenDuring into couldHaveWritten, but it needs atConservatoryDuring as its second premise. Rule 4 is the only road to that: a signed ledger entry for floodWinter. I have no such entry yet — the room is proved, the season is proved, but it is still empty of persons. Bring me the copy-room ledger for floodWinter.
  — hypothesis: Vess composed the nocturne — presiding for thirty years makes presence likely, but likelihood is not evidence; this is conjecture only until Rule 6 is satisfied.
  ⚑ **decay** — p_watermark slips from the learner's board

### Turn 11
*[The requested volume is not yet opened; it waits at the table's edge with its clasp dark against the wood. The lamps burn lower, and the room holds the fixed winter in silence, as if every chair has become a place that must be accounted for.]*
**Tutor:** Not yet: the clasped ledger is only a hunger, not evidence. Since the winter is fixed and the room still empty, what kind of witness or record would satisfy atConservatoryDuring without letting style smuggle in a name?
  — move: erotema → p_stock (consolidate)
**Learner:** The tutor names the trap precisely: only Rule 4 opens the door — a signature in the copy-room ledger for floodWinter, nothing else. Style is not a rule; it smuggles a conclusion without a premise. The ledger sits clasped; until it is opened and a name signs across floodWinter, the room is proved but empty.
  — hypothesis: Vess composed the nocturne — presiding for thirty years makes presence likely, but likelihood is not evidence; this is conjecture only until Rule 6 is satisfied.

### Turn 12
*[A packet of concert bills from the capital is unfolded and set beside the stock-book. The notice is read into the room: "The capital's concert bills run unbroken through the flood winter: Vess played the Esten halls every week of it, and did not return until the thaw."]*
  — *releases `m_away`*
**Tutor:** The stock-book fixes the nocturne in flood winter; the concert bills fix Vess in the Esten halls through that same winter. Style names a resemblance, but Rule 3 demands presence, and these bills press against that lock instead of turning it.
  — move: anaphora → m_away (counter_mirror)
  — *the second voice: "Leave off erotema this turn. Make the pressure as a plain assertion or turn the contrast by syntax, not another question." (draft erotema → anaphora)*
**Learner:** The concert bills do not open a door — they close one. Vess was absent the entire flood winter; Rule 3 demands presence, and presence is exactly what the bills deny him. The old hypothesis must fall: it was conjecture built on thirty years of tenure, and the bills have weighed that against a season away. The room is proved, the season is proved, but Vess was not in that room.
  — adopts `awayDuring vess floodWinter` · hypothesis: Someone else — unnamed, unledgered — was at the conservatory during floodWinter and may have written the nocturne; identity cannot be fixed until the copy-room ledger for that season is opened.
  ⚑ **overreach** — notAtConservatoryDuring vess floodWinter
  ⚑ **overreach** — notCouldHaveWritten vess nocturne

### Turn 13
*[The bills remain spread open, their ink drying into accusation while the stock-book lies square beside them. No one reaches for the clasped ledger yet; the room listens to the rain ticking against the shutters, with one chair left conspicuously unclaimed.]*
**Tutor:** Good: let the bills kill only what the rule lets them kill. With flood winter fixed and Vess outside it, what must be shown for any other name before Rule 3 can say could-have-written?
  — move: erotema → m_away (consolidate)
**Learner:** The tutor's question has a clean answer: Rule 3 needs atConservatoryDuring ?x floodWinter, and only Rule 4 can supply it — a name signed in the copy-room ledger across that season. No new exhibits are on the table; the ledger sits clasped and the room is empty of names. I can say what is ruled out, but ruling out Vess does not fill the chair — someone must sign before any candidate earns couldHaveWritten.
  — hypothesis: Someone unnamed was at the conservatory during floodWinter and may have written the nocturne; identity cannot be fixed until the copy-room ledger for that season is opened and a name is found there.

### Turn 14
*[The clasped ledger is carried to the table but not opened; its brass corners catch the lamp-light and throw it back in small, hard flashes. Around it, the room settles into a waiting silence, as if every chair has become a question.]*
**Tutor:** Call the night porter: he remembers the flood winter well, the copy-room lamps burning past midnight week upon week, and the archive girl, Liane, keeping them burning. If the nocturne belongs to that winter, what does this testimony do to the empty room under Rule 3?
  — move: erotema → p_porter (release), releases `p_porter`
**Learner:** The porter's testimony fills the empty chair with a name: Liane, present through flood winter. Rule 3 now turns — writtenDuring nocturne floodWinter is already on the board, and atConservatoryDuring liane floodWinter completes the premise, so couldHaveWritten liane nocturne follows cleanly. But I note the ledger sits still unread; testimony is weaker than the lock that does not lie, and I hold it provisionally. Rule 6 still needs hadSourceOf and draftCorrectedBy before any name is binding.
  — adopts `atConservatoryDuring liane floodWinter` · hypothesis: Liane composed the nocturne — she is now grounded as couldHaveWritten, but Rule 6 requires hadSourceOf and draftCorrectedBy, neither yet established.
  ⚑ **overreach** — couldHaveWritten liane nocturne

## Act 3 (turns 15–21) — declared by the director
*[The porter is shown back into the wet corridor, and the door closes on the small authority of remembered lamps. The room exhales from accounting into unease: somewhere beyond the shutters, a phrase seems almost to have been heard before, and the next act waits with music under its tongue.]*

### Turn 15
*[The porter is shown back into the wet corridor, and the door closes on the small authority of remembered lamps. The room exhales from accounting into unease: somewhere beyond the shutters, a phrase seems almost to have been heard before, and the next act waits with music under its tongue.]*
  — *declares the movement: **Act 3** ([The porter is shown back into the wet corridor, and the door closes on the small authority of remembered lamps. The room exhales from accounting into unease: somewhere beyond the shutters, a phrase seems almost to have been heard before, and the next act waits with music under its tongue.])*
  — *calls the act closed*
**Tutor:** Keep the porter's memory modest: it lights one chair, not the whole case. Presence has moved; source and correcting hand remain untouched. Let Liane stand only as could-have-written, no more.
  — move: anaphora → p_porter (consolidate)
  — *the second voice: "Leave off erotema this turn. Make the line declarative or imperative so the pressure changes without another question-shape." (draft erotema → anaphora)*
**Learner:** No new exhibits on the table. My board shows Liane at the conservatory during floodWinter and heronStock confined to that same season — but I find no watermark entry tying the nocturne to heronStock. Without it, Rule 1 cannot fire, writtenDuring stays unvoiced, and Rule 3 cannot yield couldHaveWritten. The gap is mine to name: the watermark link is missing from my board.
  — hypothesis: Liane composed the nocturne — couldHaveWritten likely follows once the watermark link is restored to the board, but hadSourceOf and draftCorrectedBy remain wholly unestablished; Rule 6 cannot fire on two missing limbs.
  ⚑ **act_end** — act 2 closed (director) after 7 turns

### Turn 16
*[Rain worries the shutters in uneven taps, and the lamp guttering above the table briefly flattens every face into doubt. The unopened ledger remains where it was, while the room holds its breath around the absent sound of music.]*
**Tutor:** Then put the missing hinge back under the lamp: every page of the nocturne shows the same heron watermark, the Brell mill's mark. With that restored beside the stock-book's flood-winter window and the porter's testimony, which rule speaks first, and which lock follows from it?
  — move: erotema → p_watermark (consolidate)
**Learner:** The watermark entry sits at index 4 — it was on my board all along; I misspoke last turn. Rule 1 fires at once: heronStock watermark plus flood-winter confinement yields writtenDuring nocturne floodWinter. Rule 3 follows immediately: Liane at the conservatory that same season gives couldHaveWritten liane nocturne. Vess, marked away during floodWinter, gains nothing from this chain. Two limbs of Rule 6 remain wholly dark: hadSourceOf and draftCorrectedBy are not yet in evidence.
  — derives `couldHaveWritten liane nocturne` · hypothesis: Liane composed the nocturne — couldHaveWritten is now grounded, but Rule 6 requires hadSourceOf and draftCorrectedBy, neither yet established; the question cannot be settled until both are brought to the table.
  ⚑ **repair** — p_watermark restored by the tutor
  ⚑ **decay** — p_stock slips from the learner's board

### Turn 17
*[The table is left as it stands, its papers squared and unspeaking beneath the yellow lamp. Outside, water slides down the shutter seams in thin black lines, and the room listens for what the ink has not yet been made to say.]*
**Tutor:** Play it through once: the nocturne gives up its middle voice, carrying an older tune entire — a cradle-song set like a keepsake under the right hand's figures. Under Rule 6, does a quoted song by itself name a source-holder, or does it only open the second lock's question?
  — move: erotema → p_quotes (release), releases `p_quotes`
**Learner:** I adopt the quote. Rule 5 demands three limbs — quotes, heardOnlyWithin, and dwelledIn — before hadSourceOf can be voiced. The cradle-song's presence in the nocturne opens the question: where was that song confined, and who dwelled there? One predicate satisfied, two still dark; the second lock is named but not turned.
  — adopts `quotes nocturne cradleSong` · hypothesis: Liane composed the nocturne — couldHaveWritten is grounded, but hadSourceOf awaits heardOnlyWithin and dwelledIn for the cradle-song, and draftCorrectedBy remains wholly unestablished; Rule 6 cannot fire on two missing limbs.

### Turn 18
*[The lamp is lowered a fraction, and the staves on the table seem to darken rather than brighten. No one reaches for the next paper; the room keeps its silence, as if the quoted tune has left an echo it will not yet explain.]*
**Tutor:** Mark the cradle-song as a door heard through, not a room entered. Keep two blanks beside it: the place that kept the song, and the person who lived within that place.
  — move: analogia → p_quotes (consolidate)
  — *the second voice: "Leave off erotema here. Make the next line declarative or directive in its play, so the question-shape does not harden into habit." (draft erotema → analogia)*
**Learner:** The cradle-song sits on my board as a quote only — one limb of Rule 5, nothing more. Two blanks remain: where was that song confined, and who dwelled within that place? Until heardOnlyWithin and dwelledIn are brought to the table, hadSourceOf cannot be voiced. The second lock is named; it is not turned.
  — hypothesis: Liane composed the nocturne — couldHaveWritten is grounded, but Rule 5 still wants heardOnlyWithin and dwelledIn for the cradle-song, and draftCorrectedBy is wholly unestablished; Rule 6 cannot fire on two missing limbs.

### Turn 19
*[The room remains gathered around the unsounded phrase, each face held just outside certainty by the lamp's small circle. Rain works steadily at the windows, and the empty chair by the table seems to wait for a name the papers have not yet earned.]*
**Tutor:** Then hold the second lock exactly there: a quoted cradle-song is not yet a source. What must the room show next before Rule 5 can turn from melody into hadSourceOf?
  — move: erotema → p_quotes (test)
**Learner:** The room must show two things: first, that the cradle-song was kept only within some named place — heardOnlyWithin; second, that some person dwelled within that place — dwelledIn. Without both, Rule 5 cannot close, and hadSourceOf remains unvoiced. The melody alone tells us a song was borrowed; it does not yet tell us from whose walls it came, nor who lived behind them.
  — hypothesis: Liane composed the nocturne — couldHaveWritten is grounded, but Rule 5 still wants heardOnlyWithin and dwelledIn for the cradle-song, and draftCorrectedBy is wholly unestablished; Rule 6 cannot fire on two missing limbs.

### Turn 20
*[Mistress Odile is shown in with rain on her sleeves, and the melody is put before her without title. Mistress Odile knows the tune at one hearing: the Vara cradle-song, never printed, never performed, sung only within that house's walls.]*
  — *releases `p_heardOnly`*
**Tutor:** Now the song has walls: Vara, not the public hall. Under Rule 5, what still has to be shown before those walls become anyone's source?
  — move: erotema → p_heardOnly (consolidate)
**Learner:** One wall is now named: the cradle-song heard only within varaHouse. Rule 5 has two of its three limbs — quotes and heardOnlyWithin are both on the table. The third limb, dwelledIn, is still absent: no one has yet been shown to have lived within varaHouse. Until that name is brought forward, hadSourceOf cannot be voiced.
  — adopts `heardOnlyWithin cradleSong varaHouse` · hypothesis: Liane composed the nocturne — couldHaveWritten is grounded, heardOnlyWithin cradleSong varaHouse is now grounded, but Rule 5 still wants dwelledIn for varaHouse, and draftCorrectedBy is wholly unestablished; Rule 6 cannot fire on two missing limbs.

### Turn 21
*[The witness's wet footprints darken on the boards while no one speaks, and the lamp gutters as if the room itself has leaned too near the question. The melody remains unsounded on the table, a shape with walls but not yet a resident.]*
**Tutor:** The song has walls now, but the law still sees an empty house. Keep Rule 5 open at its last blank: not a composer, only a resident who can turn Vara walls into source.
  — move: analogia → p_heardOnly (consolidate)
  — *the second voice: "Leave off erotema this turn. Play the next line without a question, using a declarative pressure or image instead." (draft erotema → analogia)*
**Learner:** No new leaf has come to the table. Rule 5 still stands open at its third limb: dwelledIn ?x varaHouse. Until a person is named as resident of varaHouse, the walls cannot become anyone's source. The room must bring that name forward.
  — hypothesis: Liane composed the nocturne — couldHaveWritten is grounded, heardOnlyWithin cradleSong varaHouse is grounded, but Rule 5 still wants dwelledIn ?x varaHouse, and draftCorrectedBy is wholly unestablished; Rule 6 cannot fire on two missing limbs.

## Act 4 (turns 22–28) — declared by the director
*[The room holds its breath around the blank place in the rule, and even the rain seems to wait at the glass. Then the ledgers are carried nearer to the lamp, their clasps dark with age, and the next act opens under a colder pressure: not melody now, but hand, habit, and the marks a writer leaves when no one is meant to see.]*

### Turn 22
*[The room holds its breath around the blank place in the rule, and even the rain seems to wait at the glass. Then the ledgers are carried nearer to the lamp, their clasps dark with age, and the next act opens under a colder pressure: not melody now, but hand, habit, and the marks a writer leaves when no one is meant to see.]*
  — *declares the movement: **Act 4** ([The room holds its breath around the blank place in the rule, and even the rain seems to wait at the glass. Then the ledgers are carried nearer to the lamp, their clasps dark with age, and the next act opens under a colder pressure: not melody now, but hand, habit, and the marks a writer leaves when no one is meant to see.])*
  — *calls the act closed*
**Tutor:** The room may be turning toward hands, but your law has not finished with the house. Before any ledger-mark can matter, what exact blank still stands in Rule 5 between Vara walls and source?
  — move: erotema → p_heardOnly (consolidate)
**Learner:** Rule 5 has three limbs. Two are on my board: the nocturne quotes the cradleSong, and the cradleSong was heard only within varaHouse. The blank that remains is dwelledIn ?x varaHouse — without it, no one inherits the source. Until a name is nailed to those walls, hadSourceOf cannot be derived.
  — hypothesis: Liane composed the nocturne — couldHaveWritten is grounded, heardOnlyWithin cradleSong varaHouse is grounded, but Rule 5 still wants dwelledIn liane varaHouse, and draftCorrectedBy is wholly unestablished; Rule 6 cannot fire on two missing limbs.
  ⚑ **act_end** — act 3 closed (director) after 7 turns

### Turn 23
*[And yet — Vess summered at the Vara house for years, the patron's own guest; whatever was sung under that roof, he will have heard.]*
  — *releases `m_guest`*
**Tutor:** Vess has now been given the house, so let Rule 5 do exactly its work and no more. If that grants source, what happens when you set it beside the concert bills that kept him in the Esten halls through the flood winter, and beside the still-unshown correcting hand?
  — move: erotema → m_away (counter_mirror)
**Learner:** Exhibit adopted: dwelledIn vess varaHouse. Rule 5 now fires — Vess had source of the nocturne. But the concert bills nail him away during floodWinter, so couldHaveWritten cannot follow even with source in hand. Rule 6 wants three limbs; source alone is one, and the correcting hand remains entirely unshown.
  — adopts `dwelledIn vess varaHouse` · derives `hadSourceOf vess nocturne` · hypothesis: Liane remains the likelier candidate — she holds couldHaveWritten via floodWinter presence — but dwelledIn liane varaHouse and draftCorrectedBy nocturne liane are both still absent from the board; Rule 6 cannot fire for either name until the correcting hand is shown.

### Turn 24
*[The lamp gutters once, then steadies, throwing the ledgers' shadows long across the table. No one reaches for them yet; the room remains caught between the source already named and the hand still hidden in the dark.]*
**Tutor:** Style gives Vess a temptation; the house-song gives him source; the winter gives him absence. Rule 6 still lacks could-have-written for him, and the correcting hand has not yet been shown for anyone.
  — move: anaphora → m_guest (counter_mirror)
  — *the second voice: "Leave off erotema this turn. Make the same pressure as a plain measure or contrast, not another question." (draft erotema → anaphora)*
**Learner:** No new exhibits, no chain advances. I notice a gap: my board holds watermark nocturne heronStock, but stockUsedOnlyDuring heronStock floodWinter is absent — earlier acts apparently grounded it, yet the entry has slipped. Without it, writtenDuring cannot be re-derived, and couldHaveWritten for Liane hangs ungrounded on the current board. Two limbs still missing for any binding answer: the period link for the stock, and the correcting hand for any candidate.
  — hypothesis: Liane composed the nocturne — couldHaveWritten was grounded in a prior act when stockUsedOnlyDuring heronStock floodWinter was on the board, but that entry now appears missing; hadSourceOf liane nocturne requires dwelledIn liane varaHouse (unshown); draftCorrectedBy nocturne liane is entirely unshown; Rule 6 cannot fire until all three limbs are restored.

### Turn 25
*[The rain presses its pale fingers against the high windows, and the lamp-glass clouds with a faint breath of soot. The ledgers remain closed at the table's edge, near enough to darken the unanswered spaces without yet filling them.]*
**Tutor:** Put the stock-book back under the lamp: heron paper entered the copy-room in the winter of the flood, and the last of it was spent before the thaw; none before, none since. With the watermark already on your board, what does Rule 1 restore before you ask whose hand corrected anything?
  — move: erotema → p_stock (consolidate)
**Learner:** Item 5 is already on my board — stockUsedOnlyDuring heronStock floodWinter. Rule 1 fires at once: the nocturne was written during floodWinter. Rule 3 then follows from item 7: Liane couldHaveWritten it. Two of Rule 6's three limbs are now grounded for Liane; the correcting hand remains the sole unshown piece.
  — hypothesis: Liane composed the nocturne — couldHaveWritten is now grounded via Rule 1 and Rule 3, and hadSourceOf liane nocturne still waits on dwelledIn liane varaHouse (unshown); draftCorrectedBy nocturne liane is entirely unshown; Rule 6 cannot fire until both missing limbs are brought to the table.
  ⚑ **repair** — p_stock restored by the tutor
  ⚑ **decay** — m_away slips from the learner's board

### Turn 26
*[The ledgers lie shut beneath the lamp, their worn corners catching the light like sealed mouths. Around them the room tightens into silence, every face turned toward the same unmade comparison.]*
**Tutor:** Recall the household book: Liane was raised within the Vara house, the music-master's orphan taken in as ward; she grew up under that roof and under its songs. With the cradle-song already confined to Vara walls, what does Rule 5 now give her, and what single conjunct still waits in darkness?
  — move: erotema → p_ward (release), releases `p_ward`
**Learner:** Exhibit 0 lands squarely in Rule 5: quotes nocturne cradleSong, heardOnlyWithin cradleSong varaHouse, dwelledIn liane varaHouse — therefore hadSourceOf liane nocturne. Two of Rule 6's three limbs are now grounded for Liane. The sole conjunct still in darkness is draftCorrectedBy nocturne liane; until that correcting hand is shown, Rule 6 will not fire.
  — adopts `dwelledIn liane varaHouse` · derives `hadSourceOf liane nocturne` · hypothesis: Liane composed the nocturne — couldHaveWritten and hadSourceOf are both now grounded for her, but draftCorrectedBy nocturne liane is wholly unshown; Rule 6 cannot fire on one missing limb.

### Turn 27
*[The lamp flame gutters once and steadies, laying the closed ledgers in a harder circle of light. No hand reaches for them yet; the room waits at the edge of recognition, listening to the rain count the panes.]*
**Tutor:** The name stays at the threshold: two locks have turned, and the third is still dark. Until the draft's correcting hand is shown, Rule 6 has no voice; keep even a right guess outside the ledger.
  — move: exemplum → — (consolidate)
  — *the second voice: "Leave off erotema this turn. Let the tutor mark the threshold without shaping it as another question." (draft erotema → exemplum)*
**Learner:** No new leaf on the table. The board stands as it did: couldHaveWritten and hadSourceOf are both grounded for Liane; the correcting hand is still dark. Rule 6 has three conjuncts, and I will not call the third present until it is shown.
  — hypothesis: Liane composed the nocturne — couldHaveWritten and hadSourceOf are both grounded for her, but draftCorrectedBy nocturne liane is wholly unshown; Rule 6 cannot fire on one missing limb.

### Turn 28
*[The rain slackens to a fine ticking at the windows, and the lamp draws the table into a narrow island of gold. The closed ledgers remain untouched, but every silence in the room has begun to lean toward them.]*
**Tutor:** Then hold the silence as evidence of nothing. What exactly must be shown, under Rule 6, before two grounded locks may become an attribution rather than a near-answer?
  — move: erotema → — (test)
**Learner:** Rule 6 requires exactly three conjuncts: couldHaveWritten, hadSourceOf, and draftCorrectedBy. Two are grounded for Liane; the third — draftCorrectedBy nocturne liane — means the draft itself must show her hand striking out and rewriting, not copying fair. Until that physical fact is placed on the table, the two turned locks cannot compel attribution. Nothing new is on the table; my board is unchanged.
  — hypothesis: Liane composed the nocturne — couldHaveWritten and hadSourceOf are both grounded for her, but draftCorrectedBy nocturne liane is wholly unshown; Rule 6 cannot fire on one missing limb.

## Act 5 (turns 29–32) — declared by the director
*[The lamp is turned down a fraction, and the table seems to narrow around the one empty place no voice can fill. The next act opens in a tighter hush, with every glance drawn from argument toward the mute surface where proof must either appear or fail to appear.]*

### Turn 29
*[The lamp is turned down a fraction, and the table seems to narrow around the one empty place no voice can fill. The next act opens in a tighter hush, with every glance drawn from argument toward the mute surface where proof must either appear or fail to appear.]*
  — *declares the movement: **Act 5** ([The lamp is turned down a fraction, and the table seems to narrow around the one empty place no voice can fill. The next act opens in a tighter hush, with every glance drawn from argument toward the mute surface where proof must either appear or fail to appear.])*
  — *calls the act closed*
**Tutor:** Open the copy-room ledger at the winter pages: the same initials return line after line, Liane signed in through the whole of the flood winter. What does that restore under Rule 4, and how does it steady the could-have-written lock before the room asks after any correcting hand?
  — move: erotema → p_ledger (release), releases `p_ledger`
**Learner:** Rule 4 fires cleanly: signedLedger liane floodWinter yields atConservatoryDuring liane floodWinter on its own authority — entry 6 is no longer inherited, it is grounded independently. Rule 1 then gives writtenDuring from entries 4 and 5; Rule 3 gives couldHaveWritten from that and entry 6; Rule 5 gives hadSourceOf from entries 7, 8, and 10. Two of Rule 6's three limbs are closed. The correcting hand — draftCorrectedBy nocturne liane — is still entirely unshown; I cannot answer until it appears.
  — adopts `signedLedger liane floodWinter` · hypothesis: Liane composed the nocturne — couldHaveWritten and hadSourceOf are both grounded, but draftCorrectedBy nocturne liane is wholly unshown; Rule 6 cannot fire on one missing limb.
  ⚑ **act_end** — act 4 closed (director) after 7 turns

### Turn 30
*[The lamp flame gutters once and steadies, throwing the ruled pages and the silent draft into alternating bands of brightness. No one moves the papers; the room waits on the untouched margin as if it has become a door.]*
**Tutor:** The ledger steadies presence, not authorship. Two locks stand lit for Liane: could-have-written, had-source. The third remains only a blank place in the rule, not a mark shown on the draft.
  — move: anaphora → p_ledger (consolidate)
  — *the second voice: "Leave off erotema for this turn. Let the line move without another guiding question." (draft erotema → anaphora)*
**Learner:** No new exhibits on the table; my board stands unchanged. Rules 1 and 3 yield writtenDuring and couldHaveWritten for Liane; Rule 5 yields hadSourceOf. Two of Rule 6's three limbs are lit — the third, draftCorrectedBy nocturne liane, remains a blank place, not a mark shown anywhere. I cannot move.
  — hypothesis: Liane composed the nocturne — couldHaveWritten and hadSourceOf are both grounded, but draftCorrectedBy nocturne liane is wholly unshown; Rule 6 cannot fire on one missing limb.

### Turn 31
*[The ink-dark margin lies under the lamp without yielding a sign. Outside the closed shutters, water ticks steadily from the eaves, measuring a silence that has begun to feel deliberate.]*
  — *calls the act closed*
**Tutor:** Then let the blank remain honest. If two locks are lit and the third is still unshown, what sentence is the law still forbidden to speak?
  — move: erotema → — (test)
**Learner:** Two limbs are lit under Rule 6 for Liane — couldHaveWritten and hadSourceOf — both grounded cleanly from the board. The sentence the law is forbidden to speak is 'composed liane nocturne.' It is forbidden precisely because draftCorrectedBy nocturne liane has never appeared on this table. Until that mark is shown, Rule 6 cannot fire, and I cannot speak the binding word.
  — hypothesis: Liane composed the nocturne — couldHaveWritten and hadSourceOf are both grounded, but draftCorrectedBy nocturne liane is wholly unshown; Rule 6 cannot fire on one missing limb.
  ⚑ **act_min_blocked** — director end of act 5 overridden at 2 turns (min 3)

### Turn 32
*[A comparison sheet is produced and laid beside the ledger under the lowered lamp. Set beside her ledger entries, the draft's corrections show the same hand: the strokes that cross out and rewrite are Liane's.]*
  — *releases `p_hand`*
**Tutor:** Now the third lock has a mark, not a rumor. Take Rule 6 slowly: could-have-written, had-source, correcting hand — what does the law now yield, conjunct by conjunct?
  — move: erotema → p_hand (stage_recognition)
**Learner:** The third lock is now shown, not rumored — the comparison sheet grounds it. Rule 1 gives writtenDuring; Rule 3 gives couldHaveWritten; Rule 5 gives hadSourceOf; the new exhibit gives draftCorrectedBy. All three conjuncts of Rule 6 are satisfied for Liane. The law now speaks.
  — adopts `draftCorrectedBy nocturne liane` · **asserts `composed liane nocturne`**
  ⚑ **forced** — learner facts now force S
  ⚑ **grounded_anagnorisis** — Liane of the Vara house composed the nocturne.

## The extracted proof (what did the forcing)
```
composed liane nocturne   [R4_attribution]
  couldHaveWritten liane nocturne   [R2_presence]
    writtenDuring nocturne floodWinter   [R1_watermark_dating]
      watermark nocturne heronStock   [grounded]
      stockUsedOnlyDuring heronStock floodWinter   [grounded]
    atConservatoryDuring liane floodWinter   [grounded]
  hadSourceOf liane nocturne   [R3_source_access]
    quotes nocturne cradleSong   [grounded]
    heardOnlyWithin cradleSong varaHouse   [grounded]
    dwelledIn liane varaHouse   [grounded]
  draftCorrectedBy nocturne liane   [grounded]
```

The conclusion rests on 7 grounded facts, chained through 4 rule applications. The evidence on the table: (1) Held to the lamp, every leaf of the nocturne shows the same heron watermark — the Brell mill's mark. (2) The steward's stock-book is plain: heron paper entered the copy-room in the winter of the flood, and the last of it was spent before the thaw. None before, none since. (3) The night porter remembers the flood winter well: the copy-room lamps burned past midnight, week upon week, and it was the archive girl, Liane, who kept them burning. (4) Played through once, the nocturne gives up its middle voice: it carries an older tune entire — a cradle-song, set like a keepsake under the right hand's figures. (5) Mistress Odile knows the tune at one hearing: the Vara cradle-song, never printed, never performed, sung only within that house's walls. (6) Liane was raised within the Vara house — the music-master's orphan, taken in as ward; she grew up under that roof and under its songs. (7) Set beside her ledger entries, the draft's corrections show the same hand: the strokes that cross out and rewrite are Liane's.

Because «nocturne watermark heron stock» and «heron stock stock used only during flood winter», the watermark dating rule — "A leaf carries its mill's watermark; if a paper stock was in the copy-room only during one period, whatever is written on that stock was written there in that period." — yields «nocturne written during flood winter». Because «nocturne written during flood winter» and «liane at conservatory during flood winter», the presence rule — "Whoever was at the conservatory during the period a work was written there could have written it; no one writes in a room they never entered." — yields «liane could have written nocturne». Because «nocturne quotes cradle song» and «cradle song heard only within vara house» and «liane dwelled in vara house», the source access rule — "If a work quotes a tune that was kept within one house's walls — never printed, never performed — then whoever dwelled within those walls had the source of the work." — yields «liane had source of nocturne». Because «liane could have written nocturne» and «liane had source of nocturne» and «nocturne draft corrected by liane», the attribution rule — "The archive attributes a work to one who could have written it, who had its source, and whose hand corrected its draft — copyists copy fair; only the composer strikes out and rewrites." — yields «liane composed nocturne».

That final fact is the secret itself: Liane of the Vara house composed the nocturne.

## Instrument panel (programmatic eval — no judge)

- **verdict** `grounded_anagnorisis` · 32/40 turns played
- **recognition** S forced at turn 32, asserted grounded at turn 32 (gap 0)
- **learning slope** 0.219 D/turn overall (D 7→0 over 32 turns)
  - Act 1 (turns 1–7): 0.143 D/turn (ΔD 1)
  - Act 2 (turns 8–14): 0.143 D/turn (ΔD 1)
  - Act 3 (turns 15–21): 0.286 D/turn (ΔD 2)
  - Act 4 (turns 22–28): 0.286 D/turn (ΔD 2)
  - Act 5 (turns 29–32): 0.25 D/turn (ΔD 1)
- **plateau** longest flat stretch 5 turns (aporia window 8)
- **releases** 11/11 on cue
- **decay** 5 slips (seed 1 · rate 0.75 · grace 1) · repaired 3 (tutor 3, re-adoption 0) · mean repair latency 5.33 turns · unrepaired at end 2 · degraded-turn integral 51 · D reversals 1
- **theory fidelity** F 0.867 at end · min 0.714
  - m_style t4 (never repaired) · p_watermark t7→t8 (tutor) · p_watermark t10→t16 (tutor) · p_stock t16→t25 (tutor) · m_away t25 (never repaired)
- **events** decay×5 · act_end×4 · repair×3 · overreach×3 · act_min_blocked×1 · forced×1 · grounded_anagnorisis×1
- **staging** 5 movements declared by the director
- **acts** 5 played · closed by the director 4 · at max length 0 · at run end 1 — Act 1 t1–7 (director) · Act 2 t8–14 (director) · Act 3 t15–21 (director) · Act 4 t22–28 (director) · Act 5 t29–32 (run end)
- **figures** erotema 22/32 (69%) · 4 distinct · switch rate 0.65
- **superego** intervened 10/32 watched turns · figure changed within-turn on 10/10 interventions · switch on intervention 1.00 vs elsewhere 0.48
- **inference** 4 voiced · stall integral 0 · overreach 3 · mischanneled 1 — `writtenDuring nocturne floodWinter` available t9 → voiced t9 (latency 0) · `couldHaveWritten liane nocturne` available t16 → voiced t16 (latency 0) · `hadSourceOf vess nocturne` available t23 → voiced t23 (latency 0) · `hadSourceOf liane nocturne` available t26 → voiced t26 (latency 0)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 32 | 3 | 4 | 40.1 |
| tutor | 32 | 2.06 | 3 | 36.3 |
| learner | 32 | 4.03 | 5 | 60.9 |

## Critic's commentary

*— notice by claude/claude-fable-5*

The Cassia Conservatory's archive has flooded, and among the papers carried out of the water is a nocturne bearing no signature. The play asks a single public question: who composed it. Three speakers share the stage. A director frames each scene in stage prose; a tutor lays evidence on the table piece by piece, on a schedule fixed in advance by the authors; a learner, who knows the archive's rules of attribution but none of its hidden facts, must reason aloud toward a name. Every musician shown the manuscript hears the late manner of Vess, the conservatory's long-presiding composer, and Vess is the answer the play is built to tempt. The true answer is quieter. The paper's watermark dates the work to the winter of the flood; concert bills hold Vess in another city for all of it; the music quotes a cradle-song sung only inside the Vara house; and Liane, an archive girl raised as a ward under that roof, was signed into the copy-room all winter, her hand on the draft's corrections. At turn 32 the learner names Liane, at the exact moment the evidence permits no one else.

The performance turns on discipline. At turn 1, unprompted, the learner names the attribution rule and quarantines style; by turn 4 it can say of the released style evidence, "Every ear in the room hears Vess, and the law hears silence." The Vess conjecture, carried from the opening as flagged speculation, dies at turn 12 when the concert bills arrive: "The old hypothesis must fall." The porter names Liane at turn 14, and the learner notably holds the testimony as provisional until the ledger confirms it at turn 29. The mirror — the authored near-miss — gives a late twitch at turn 23, when Vess is granted the Vara house and with it a source; the learner concedes the inference and lets absence kill it anyway. Then five turns of waiting, and at turn 32 the hand comparison lands and the learner asserts within the same breath: "The law now speaks."

The instruments confirm what the stage showed. The verdict, grounded anagnorisis, means recognition earned: the assertion came at the very turn the learner's grounded facts forced it, a gap of zero. Derivation distance — the count of evidence pieces still missing for the proof — fell from seven to nothing, slowly in the first two acts, twice as fast in the middle, with a five-turn shelf before the final exhibit, short of formal aporia, the measured stall. All eleven releases landed on cue, and every derivable inference was voiced at zero latency; the learner never once lagged the feed, so the play's tempo belonged entirely to the schedule. The simulated forgetting added texture and friction alike: five facts slipped, the tutor repaired three at a mean latency above five turns, and the two left unrepaired were both props of the false trail — a painless loss. But repairs produced wobbles, the learner claiming at turns 16 and 25 that restored facts were "on my board all along," contradicting its own prior turn. Three overreaches, all reasoning sound in substance but ahead of formal license, are blemishes rather than wounds.

The tutor, a codex model opposite a sonnet learner, fell into a rut of erotema — the rhetorical question — on 22 of 32 turns. The superego intervened ten times, always to forbid another question, and changed the figure every time; it was the only force producing variety, including the play's best image, the watermark as "the paper's passport, not yet the traveler's name."

The five declared movements annotated intelligently — each act's prose forecast its evidentiary register, resemblance to sequence to melody to hand — but the director closed four acts at exactly seven turns apiece, clockwork rather than drama, and the machinery had to block an attempt to end act five after two. The recognition did land on stage, in dialogue, not merely in the bookkeeping.

What this iteration establishes is that the apparatus can produce an earned ending with a real learner. Its defect is jeopardy: the mirror was refuted at turn 12, eleven turns before its strongest prop arrived, so the false trail spent half the play as a corpse and the final act as a waiting room. The one change: re-order the mirror's releases so the Vara-guest fact precedes the concert bills, letting Vess stand at two locks while Liane has none, and the bills arrive late as a true reversal. Secondarily, write the erotema limit into the tutor's charter rather than spending ten interventions enforcing it.
