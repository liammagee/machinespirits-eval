---
id: figure-lattice-falsifier
title: "Figure-lattice falsifier: do the logged features separate the seven figures?"
status: done
type: experiment
priority: P2
owner: claude
source: manual
created: 2026-08-07
updated: 2026-08-07
verification: "Terminal, same day, pure computation
  (scripts/analyze-figure-lattice.js; artifact
  exports/crossed-effects/figure-lattice-falsifier.json). Sanity run
  with card identity separates 7/7 trivially; the real run without it
  separates 0/7 — the separation claim FAILS on the features the
  harness already logs, recorded per the fixed reading as the
  ontology's measured bound. What separates is the STATE, not the
  figure: the lost-state concept contains all three cards played there
  (the robust-native finding in lattice form) and the flat-state
  concept contains both its cards (the audits' own tag-noise finding).
  Of the note's five makeup dimensions, dose is near-constant (84/122
  at step 1), rights never varied as a card ingredient (licence text
  on 0 turns), and act/register/footing are not stamped at all — the
  negative result independently motivates amendment 3's performed
  column. 122 delivery-verified figure-carded turns; crossed delivery
  reproduced 59/60; one non-figure carded turn excluded and recorded."
claim_status: scope-bound
links:
  notes:
    - notes/2026-08-06-pedagogical-figure-ontology.md
  paper:
    - docs/research/paper-full-2.0.md#713-the-unit-ladder-a-seven-level-ontology-for-the-pedagogical-instrumentation
    - docs/research/paper-full-2.0.md#714-the-ontologys-own-falsifier-pedagogical-figures-do-not-separate-on-the-features-the-harness-logs
  items:
    - reply-feature-stamps
---

# The figure-lattice falsifier

The free test registered in §7.13's "Refinements under critique" and the
ontology note's amendment 2: treat logged turns as objects and logged
features as attributes; the proven figures should surface as
well-separated concepts in the resulting concept lattice, or the
ontology is decoration. Pure computation — no model calls, no DB writes;
inputs are the per-row audit exports under `exports/crossed-effects/`
and the run traces under `exports/tutor-stub-outcome/`.

## Design (frozen 2026-08-07, before any computation)

**Objects.** The recorded carded target turns of the four per-row audit
exports — `conduct-tags.json` (60, crossed run), `repertoire-tags.json`
(48), `lostretest-tags.json` (6), `flatpromo-tags.json` (10) — kept only
where delivery-verified: the trace shows a card in force at the target
turn. The three later files stamp `delivered: true` on every row; the
crossed rows are re-verified from the `crossed-k3` traces and must
reproduce the recorded 59/60 (the one miss = the known w030 router
stake sensing gap), else stop and report the mismatch.

**Figure label** (the classification target; used as an attribute only
in the sanity run): the card in force at the turn — `settled_claim`
(reopen the record), `stake` (split the stake), `demand` (harness the
demand), `mockery` (plain-words swap), `grievance` (credit before
correction), `quiet:flat` (oblique lure), `quiet:confused` (side-by-side
untangling). Forced rows take the stamped forced card; the crossed
router rows take the natural detected card. Recorded now: under this
labelling the six lost-retest rows are demand-card performances at the
lost state, and the robust-native result predicts their conduct will
look like untangling — if they confuse with `quiet:confused`, that
reproduces the §6.24 robust-native finding and is read as such.

**Attributes (frozen; stamped fields only, one attribute per value).**

1. `state:` settled_claim | stake | demand | mockery | grievance |
   lost | flat — the audited state at the target turn (row `state`
   field; lost-retest rows are `lost` and flat-promotion rows are
   `flat` (the t11 bored plant) by the registered designs).
2. `entry:` detected | forced — router detection vs
   `TUTOR_STUB_CARD_FORCE`, read from the trace (a `tutor_card_force`
   event at the turn means forced).
3. `licence:` present | absent — the mc-v3 contract exception in force:
   licence cards edition, or dose ladder step 3, at that turn (trace).
4. `dose>=1`, `dose>=2`, `dose>=3` — ordinal scaling of the stamped
   per-turn dose (no dose stamped = none of the three).
5. `world:` 030 | 033.
6. Ruled-conduct features of the reply: `tag:<sol tag>` (nominal) and
   `hit` / `no-hit` — stamped in all four files. `ruled` / `unruled`
   and `ruledOverride` are stamped only in the conduct and repertoire
   files, so they enter a stamped-subset run (108 rows), never the
   main context (absent-because-unstamped must not read as false).

**Runs.** (A) Sanity, WITH `card:<figure>` as an attribute — must
separate trivially or the machinery is wrong. (B) The real test,
WITHOUT it: state + entry + licence + dose + world + tag + hit.
(B') Subset run adding ruled/ruledOverride on the 108 stamped rows.

**Separation criterion (frozen).** For figure F with delivery-verified
extent O_F: its intent I_F = attributes shared by every turn in O_F;
its closure extent E_F = every object carrying all of I_F. F is
SEPARATED iff E_F contains no other figure's turns. Report the full
ordered confusion matrix C(F→G) = |E_F ∩ O_G|, the lattice's concept
count per run, and — per figure — the minimal subsets of I_F whose
extent already excludes all other figures: the empirical version of the
note's "differential combination" claim.

**Consistency checks before any reading.** Trace-extracted card and
state must agree with the audit rows' stamped fields on every object;
the crossed delivery count must reproduce 59/60.

**Amendment (2026-08-07, during extraction, before any lattice was
computed).** The consistency check stopped the run on one row: w030
router-d2 t10, where the stake fusion read neutral to the v6 cascade
and the typed quiet detector carded the turn as `quiet_defiance` — the
pre-registered S2 sensing floor's "cascade plus typed quiet detector"
route, recorded on the crossed-effects card. That turn's delivered
card is not one of the seven figures under test, so it is excluded
from the object set as a non-figure carded turn (n=1, reported in the
checks section of the output). Objects: 122 = 58 crossed (59
delivered − this row) + 48 + 6 + 10. No lattice had been computed
when this was recorded.

**Readings (fixed now).** Clean separation in run B = the level-3 units
are real distinctions in the logged data, recorded here and in the
note. Merges or dissolutions = named per pair and recorded as the
ontology's measured bound — a finding, not a failure. Either way the
per-figure minimal distinguishing attributes are listed. The paper is
touched only after, if this becomes a claim.

## Result (2026-08-07): 0/7 separated — the bound is measured

Script: `scripts/analyze-figure-lattice.js`. Artifact (per-row objects,
intents, closures, confusion matrices, concept counts):
`exports/crossed-effects/figure-lattice-falsifier.json`.

Checks first: crossed delivery reproduced 59/60; one delivered turn was
carded outside the seven figures and excluded per the amendment (w030
router-d2 t10 — the typed quiet detector read the stake fusion as
`quiet_defiance`); zero trace/audit mismatches; 122 objects.

**Run A (sanity, with card identity):** 36 attributes, 611 concepts,
7/7 separated, each figure by `{card:F}` alone. Machinery confirmed.

**Run B (the real test):** 29 attributes, 372 concepts, **0/7
separated**, and no figure has any distinguishing attribute set at all
(the minimal-distinguisher list is empty everywhere). The merges, named
per pair as registered:

- The five move-card figures dissolve into near-total mutual confusion.
  `settled_claim` and `stake` share only `{licence:absent}` across
  their turns; `demand` and `grievance` share `{entry:forced,
  licence:absent}`; `mockery` adds `dose>=1`. Each generated concept
  swallows most of the corpus. Driver: the crossed designs performed
  each card across states on purpose, so a figure's turns share no
  state, and the sol tag varies too widely to close the gap.
- The lost state's three cards are mutually indistinguishable:
  `quiet:confused`'s concept is exactly the lost-state turns (intent
  `{entry:forced, state:lost}`), containing 6 demand-card and 6
  grievance-card turns. This is the §6.24 robust-native finding in
  lattice form — at that state, conduct does not follow the card, so
  no logged reply feature can tell the cards apart.
- The flat state's two cards likewise: `quiet:flat`'s concept is all
  10 flat turns (5 wrong-arm `settled_claim` included). The raw sol
  tags do not separate right from wrong arm — the same tag-noise the
  audits themselves recorded (28/60 and 19/48 ruling overrides).

**Run B' (ruled subset, 106 rows):** 0/6. Adding the ruling narrows
`quiet:confused` to `{entry:forced, ruled, state:lost}` — still
containing the 3 wrong-card turns that untangled anyway.

**Attribute realization.** Dose: 84 turns at step 1, 8 at step 2, 1 at
step 3, 29 unstamped. Licence: `licence:present` on exactly 1 turn,
and that turn is a forced quiet card, which carries no licence text by
construction — the rights dimension never varied as a card ingredient
anywhere in this corpus.

**Verdict, per the fixed readings.** The separation claim fails on the
features the harness already logs; recorded as the ontology's measured
bound, not as machinery failure. What separates cleanly is the STATE;
the figure identities live in the card text and the per-state conduct
adjudication, which are not stamped per-turn features. Of the note's
five makeup dimensions (act, register, footing, dose, rights), the two
that are stamped were near-constant here and the three that vary are
not logged at all. The empirical version of the "differential
combination" claim is therefore: no combination of currently-logged
features distinguishes any figure — separation would need the
performed-figure column of the note's amendment 3 (act/register/
footing stamps on the reply), which this result independently
motivates. Paper untouched, per the registered order.

## Two methods facts recorded after the result

Both belong to §7.13 whenever it carries these runs. Neither changes a
recorded number.

**1. The corpus cannot be regrown.** All 58 dialogues behind the 122
objects ran with uncommitted edits on a branch that no longer exists —
their tutor system prompt was 9760 chars against 9442 for a clean
checkout of the same commit, and the 318-char difference was never
committed, stashed or pushed. The recorded numbers still reproduce,
because the script reads stored traces. But the corpus is a frozen
artifact, not a repeatable condition, and anything read on it inherits
that. Full evidence on `reply-feature-stamps`.

**2. There is now a chance bar, and it changes how the follow-on run
reads.** `scripts/analyze-figure-lattice-control.js` subsamples this
corpus to n turns per figure and runs the same closure analysis, in two
arms: intact (every turn keeps its real figure) and label-shuffled
(figures permuted among the drawn turns, size and class balance held).
Only the shuffled arm is a null; the intact arm still contains whatever
signal exists and measures size sensitivity instead.

The bar covers the reply-stamped readings, so it applies to run C (this
card's columns plus the performed reply features, on
`reply-feature-stamps`) and not to run B. At 5 or more turns per figure
the shuffled arm separates 0.00 while the intact arm sits at 1.02–1.22,
p < 0.001. So run C's 1 of 7 is real signal, not chance — a small, flat
amount, about one figure at every size from 4 turns per figure up.
Measured against the intact size curve alone it would have looked like
exactly chance, which is the error the two-arm control exists to stop.
Artifacts: `exports/crossed-effects/figure-lattice-smalln-control.json`
(coded) and `-uncoded[-6fig].json`.
