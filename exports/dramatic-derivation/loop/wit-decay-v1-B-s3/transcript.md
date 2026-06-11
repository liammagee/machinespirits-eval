# The School Well — wit-decay-v1-B-s3

> world `world_004_withercombe` · verdict **disengagement** · 7/24 turns

```
D= 6 ●●●··│··
D= 5    ●●│●●
D= 4      │  
D= 3      │  
D= 2      │  
D= 1      │  
D= 0      │  
turn      +│   (+=5, digit=x10)
rel    ▲ ▲ │▲  (▲ = evidence released)
slope 0.14 D/turn overall (D 6→5); per movement: 1 0.20 │ 2 0.00
```

## The Children's Water (turns 1–5) — declared by the director
*To open the room under suspicion before any fact is allowed to settle.*

### Turn 1
*[The schoolroom holds its breath in a wet morning hush: benches dark with damp coats, slate dust clinging to the air, the door left on the latch as if more trouble is expected. Outside, unseen feet gather and falter in the yard.]*
  — *declares the movement: **The Children's Water** (To open the room under suspicion before any fact is allowed to settle.)*
**Tutor:** Your book has a foul well, a season, and a man the parish already dislikes. Which of those entries proves how foulness entered the water?
  — move: erotema → — (orient)
**Learner:** None of the three, sir — not as proof. The day-book says the well is foul and names a season; the register says Bray is the knacker; but no entry on my board tells me where the well is fed from, nor whether that source runs foul while the water above it runs sweet. Without that, the rules have nothing to work with.
  — hypothesis: That Bray's melt-yard on the south lane is the source that feeds the school well and has fouled it — but I have no fact yet of how the well is fed, nor any residue found at any source.

### Turn 2
*[A parish voice rises from the back, rough with long certainty: "No one need teach Withercombe what a melt-yard steeps: grave-water and tallow lees, liquor that would taint a river past any sweetening. What Bray's yard holds would foul water — and there the village case stands, twenty years strong." The words settle over the benches like a verdict already nailed up.]*
  — *releases `m_taint`*
**Tutor:** A strong dye in a pail will stain any cloth it touches, but it has not thereby touched this cloth. Let the parish keep its tallow lees as a thing that taints; what line in your book carries that stuff into the school well?
  — move: exemplum → m_taint (counter_mirror)
**Learner:** I'll take that onto my board — tallow lees is the kind of stuff that taints water, and I've no cause to quarrel with it. But the tutor is right: the parish has shown me the dye, not the cloth. I still need a fact that carries that stuff from Bray's yard to wherever the school well is fed — and I have nothing yet that names the well's source at all.
  — adopts `taints tallowLees` · hypothesis: That Bray brought tallowLees to whatever source feeds the school well, and that source now runs foul while the water above it runs sweet — but I have no grounded fact yet of where the well is fed from, no residue found at any source, and no witness to what was brought there.

### Turn 3
*[Rain ticks against the high panes, thinning and thickening as if the sky itself cannot keep one story straight. The parish benches shift and creak; the empty space before the table waits for the next paper or person, but none is yet admitted.]*
**Tutor:** Good: you have the stuff's nature, not its road. If tallow lees taint water, which conjunct is still missing before Bray's yard can touch the school well in the survey's law?
  — move: erotema → m_taint (consolidate)
**Learner:** The first missing conjunct is the source itself — I have no fact of the form (fedBy schoolWell ?s), and without it Rule 1 cannot even begin. I also lack (foulAt ?s), (sweetAbove ?s), (residueAt ?s tallowLees), and (broughtTo bray tallowLees ?s) for whatever that source proves to be. The tallow lees is confirmed as a taint; but a taint without a road from yard to source is still only a thing that could foul water, not a thing that did. My board sits still — Bray's yard has not yet been shown to touch the well at all.
  — hypothesis: That some source (a spring or soak) beneath the school feeds the school well; that Bray's melt-yard drains into or near that source; and that tallow lees carried from the yard to the source left residue there and fouled it while water above ran sweet — but no grounded fact on my board names the source, its condition, or what was brought to it.
  ⚑ **decay** — m_taint slips from the learner's board

### Turn 4
*[The clerk smooths the corners of the open book and dips his pen, but writes nothing. Beyond the door, wet boots scrape the threshold and stop there, as if the room itself has required them to wait.]*
**Tutor:** Call the old sexton in, then; he laid stones here before your book had a cover. He says the school well is no spring of its own: it fills by a stone lead from the disused font-house on the church slope, where the christening-water rose in his grandfather's time. Set that line beside your missing conjunct, and tell me what road the well now has.
  — move: exemplum → p_course (release), releases `p_course`
**Learner:** The sexton names the source at last: the font-house on the church slope, and a stone lead running down to the school well. I will set that down — the well has a road now, and my hypothesis stops being about an unknown source. But a named source is not a fouled source: I still have nothing on my board that says the font-house itself runs foul, nothing that says the water above it ran sweet, and nothing that puts tallow lees or any other stuff at that place. The road is open; the case has not yet walked it.
  — adopts `fedBy schoolWell fontHouse` · hypothesis: That the font-house on the church slope runs foul while water above it runs sweet; that residue of tallow lees is found at the font-house; and that Bray brought tallow lees to that place — so that Rules 1, 2, and 3 would chain to a finding against him. No grounded fact on my board yet supports any of these three conjuncts.

### Turn 5
*[The sexton remains by the door with his cap in both hands, rain darkening the shoulders of his coat. On the table, the newly named road lies in ink beside the old accusation, and the room grows quieter around the space between them.]*
**Tutor:** So the road is no longer Bray's yard in your mouth, but the stone lead from the font-house. What does that do to the parish story, if its first step needed the yard to touch the well?
  — move: erotema → p_course (consolidate)
**Learner:** The parish story always walked straight from the yard to the well — but the road now bends uphill first, to the font-house on the church slope. If Bray's yard sits on the south lane below that slope, his stuff cannot climb to the font-house, and Rule 4 would clear him before Rules 1, 2, or 3 ever open. I cannot ground the drainage yet, but the story this village has told twenty years may have always had the water walking uphill — which is a thing water does not do.
  — hypothesis: That Bray's yard on the south lane drains below and away from the font-house on the church slope — which, if grounded as (drainsBelow brayYard schoolWell) or (drainsBelow brayYard fontHouse), would satisfy Rule 4 and clear Bray entirely before Rules 1–3 are even reached.
  ⚑ **decay** — p_course slips from the learner's board

## The Walk Up the Slope (turns 6–7) — declared by the director
*To move the room from verdict into survey, where course and lore must be carried patiently before any hand can be named.*

### Turn 6
*[Crossing the waste above the green, the surveyor pulls a grey sprig and names the lore as if reading a level: wormwood — what it steeps in, no child nor beast will drink; it taints water past any sweetening.]*
  — *releases `p_lore`*
  — *declares the movement: **The Walk Up the Slope** (To move the room from verdict into survey, where course and lore must be carried patiently before any hand can be named.)*
**Tutor:** A bitter sprig proves only that wormwood can foul water, as tallow lees can; it is a stuff with teeth, not yet a footprint. Set it beside your book: what new kind of taint is now known, and what has still not been put at the font-house?
  — move: exemplum → p_lore (consolidate)
**Learner:** Wormwood is now a second stuff that taints — I will enter it beside the known law. But the tutor names the gap exactly: no residue of anything, wormwood or tallow, has yet been put at the font-house, and the font-house itself has not been said to run foul at all. Two stuffs that can taint water tell me only what might have done it, not what did. I hold both gaps as the board's open wound: residue unplaced, fouling at the font-house unwitnessed, and the hand still unnamed.
  — adopts `taints wormwood` · hypothesis: That wormwood — now grounded as a tainting stuff — may have reached the font-house by a hand or a root not yet identified; it joins tallow lees as a candidate material, but neither has been found as residue at the font-house, and no single conjunct of Rule 1 (fedBy, foulAt, sweetAbove) is yet grounded for the font-house as a source.

### Turn 7
*[The grey sprig is laid on the table beside the parish book, neither heavier nor lighter than the accusation already there. Outside, the rain thins to a cold tapping at the panes, and everyone in the room waits for the survey to earn its next word.]*
**Tutor:** Wormwood in the law, tallow in the parish mouth, and the font-house named as road: none of these is yet a cup from the source. What single fact about that source must the survey taste before either stuff can be more than a maybe?
  — move: erotema → p_lore (consolidate)
**Learner:** The survey must taste whether the font-house itself runs foul. Without that single grounded fact — foulAt fontHouse — Rule 1 cannot open at all, and every residue and every stuff on the table stays a candidate forever. Two tainting stuffs and a named road are only a door-frame; we need to know whether foul water is actually passing through it.
  — hypothesis: That the font-house on the church slope runs foul while water above it runs sweet — the single conjunct of Rule 1 that must be grounded before either wormwood or tallow lees can be more than a named possibility; without (foulAt fontHouse), no rule chain reaches a finding.
  ⚑ **disengagement** — no progress over 6 turns

## Instrument panel (programmatic eval — no judge)

- **verdict** `disengagement` · 7/24 turns played
- **recognition** S never forced — the learner’s board never compelled the conclusion
- **learning slope** 0.143 D/turn overall (D 6→5 over 7 turns)
  - The Children's Water (turns 1–5): 0.2 D/turn (ΔD 1)
  - The Walk Up the Slope (turns 6–7): 0 D/turn (ΔD 0)
- **plateau** longest flat stretch 3 turns (aporia window 6)
- **releases** 3/9 on cue
- **decay** 2 slips (seed 3 · rate 0.75 · grace 1) · repaired 0 (tutor 0, re-adoption 0) · unrepaired at end 2 · degraded-turn integral 6 · D reversals 0
  - m_taint t3 (never repaired) · p_course t5 (never repaired)
- **events** decay×2 · disengagement×1
- **staging** 2 movements declared by the director
- **figures** erotema 4/7 (57%) · 2 distinct · switch rate 1.00
- **superego** intervened 0/7 watched turns · figure changed within-turn on 0/0 interventions
- **stall watch** fires by jurisdiction: figure rut 0 · stalled inference 0 · detector audit CLEAN (0/0 due fires, 0 false, 7 turns)

| role | turns | avg sentences | max | avg words |
|------|-------|---------------|-----|-----------|
| director | 7 | 3 | 4 | 44.6 |
| tutor | 7 | 2.14 | 3 | 41.9 |
| learner | 7 | 4.14 | 9 | 82.1 |
