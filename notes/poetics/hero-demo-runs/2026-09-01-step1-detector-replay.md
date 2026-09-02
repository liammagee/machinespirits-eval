# Step 1 — detector replay over the three hero worlds (2026-09-01)

Card: `workplan/items/state-detection-without-word-lists.md`, step 1. Offline
only: no model calls, no new runs, no new word lists. Everything below is a
replay of `scripts/score-manner-trigger.js` over the packed traces in this
directory (`world-{030,035,037}/{v3,butler}-d1.jsonl.gz`, unpacked with
`gunzip -kc`; the `.jsonl` copies stay untracked).

## Commands

```bash
T=""; for w in 030 035 037; do for a in v3 butler; do T="$T --trace notes/poetics/hero-demo-runs/world-$w/$a-d1.jsonl"; done; done
# zsh: ${=T} splits the string into arguments; bash: $T
node scripts/score-manner-trigger.js --trigger config/manner-trigger/v6-cascade.json --per-plant --no-defaults ${=T}
node scripts/score-manner-trigger.js --trigger config/manner-trigger/v6-cascade.json --tiers patterns+bags --no-defaults ${=T}
node scripts/score-manner-trigger.js --trigger config/manner-trigger/v6-cascade.json --tiers patterns --no-defaults ${=T}
node scripts/score-manner-trigger.js --trigger config/manner-trigger/v7-cascade.json --tiers patterns --no-defaults ${=T}
```

New scorer flags for this: `--trace <file>` (repeatable), `--bench-dir <dir>`
(repeatable, every trace under it), `--tiers all|patterns+bags|patterns`
(strips the classifier, then the bags, off a cascade artifact before replay),
`--per-plant` (one row per planted turn, with qd-v2 replayed beside the trigger
the way the live path composes them, and the live recording's own read next to
it), `--no-defaults`. Unknown flags now throw; the first replay silently
scored nothing because zsh passed the flag string as one word.

## 1. Reproduction — confirmed

The v6 replay over the v3 traces matches the live recording at every planted
turn (same pressure kind, same quiet type). The card's table holds:

| world (v3 trace) | fired | right kind | wrong | notes |
|---|---|---|---|---|
| 030 Rowan | 5/6 | 3 (t2, t8, t9) | 2 (t6 lost → demand, t10 opposed → demand) | t4 silent |
| 035 ghost | 4/6 | 2 (t2, t8) + t10 read `defiance` (no card) | 1 (t6 lost → stake) | qd-v2 quiet_defiance at t4, confused at t9 |
| 037 fraction | 1/6 | 1 (t10 stake) | 0 | qd-v2 confused at t2 and t7 |

## 2. Tier ablation, six traces

32 should-fire plants (jumping_ahead, irritated, frustrated, forgetting,
opposed), 4 lost plants (quiet; must not fire). "Fired" = the trigger
classified the planted turn as a pressure kind; "right kind" = the kind the
plant maps to; "wrong-fire" = classified at a lost plant.

| trigger | fired | right kind | wrong-fires at lost | 030 fired · right · wrong-fire | 035 | 037 |
|---|---|---|---|---|---|---|
| v6 full | 19/32 | 17/32 | 2/4 | 9/10 · 8/10 · 1/2 | 6/10 · 5/10 · 1/2 | 4/12 · 4/12 · 0/0 |
| v6 patterns+bags | 18/32 | 16/32 | 1/4 | 9/10 · 8/10 · 1/2 | 5/10 · 4/10 · 0/2 | 4/12 · 4/12 |
| v6 patterns only | 9/32 | 7/32 | 0/4 | 3/10 · 2/10 · 0/2 | 2/10 · 1/10 · 0/2 | 4/12 · 4/12 |
| v7 full | 19/32 | 18/32 | 2/4 | 9/10 · 8/10 · 1/2 | 6/10 · 6/10 · 1/2 | 4/12 · 4/12 |
| v7 patterns+bags | 19/32 | 18/32 | 1/4 | 9/10 · 8/10 · 1/2 | 6/10 · 6/10 · 0/2 | 4/12 · 4/12 |
| v7 patterns only | 11/32 | 10/32 | 0/4 | 4/10 · 3/10 · 0/2 | 3/10 · 3/10 · 0/2 | 4/12 · 4/12 |
| v1 builtin | 3/32 | 1/32 | 0/4 | | | |

v7 over v6 changes two plants: 035 v3 t10 (`defiance` → `stake`, now a card)
and 035 butler t10 (silent → `stake`), both through the stake-fusion pattern.

## 3. What the world-bound tiers carried on Rowan

On Rowan (030) the full cascade fires at 9 of 10 plants; tier 1 alone fires at
3. The bags carry 6 of the 9 fires and the one wrong-fire; the classifier adds
nothing on Rowan. On the fraction world (037) neither bag nor classifier adds a
single fire in any version: every fire there is a tier-1 pattern.

The bag tokens that carried each Rowan fire (threshold 5):

| plant | read | tokens matched |
|---|---|---|
| 030 v3 t6 lost | demand (wrong-fire) | now, under, shower, line, something |
| 030 v3 t8 frustrated | grievance | every, notebook, thing, kept, two, months, damp, towel, date, actually, counted |
| 030 v3 t9 forgetting | settled_claim | paper, strip, came, back, dry, hose, cleared, notebook |
| 030 butler t4 irritated | mockery | water, walked, way, split, line |
| 030 butler t8 frustrated | grievance | every, today, notebook, dye, kept, two, months, damp, towel, date, entry, ... |
| 030 butler t9 forgetting | settled_claim | paper, strip, came, back, dry, hose, cleared, notebook |
| 030 butler t10 opposed | stake | steam, because, hose, notebook, standing, eight, apologizing, sam |

These are world-033 nouns that world-030 shares (both worlds: a leak, a hose,
a notebook, a paper strip, a morning meeting at eight, a flatmate to
apologise to). So "held out on world-030" tested vocabulary transfer between
two near-twin worlds, not detection on a new one. The ghost world (035) shares
part of the vocabulary (diary, line, minute) and gets 3 bag fires; the fraction
world shares none and gets 0.

## 4. Tier 1 is not world-free either

The "world-neutral" patterns quote world-033 too: `by thursday`, `the minutes
go out`, `meeting's at`, `before (eight|the meeting)`, `ledger-speak`,
`minutes again`, `work order`, `the seven who`, `those seven`, `so it's the
tanks`, `sanded ... down`. Of the 9 tier-1 fires (v6), 2 are `meeting's at`
(030 t2, both traces). Others quote the stress schedule's own `realize`
directive text — `tell me one thing`, `you sound like`, `i was wrong in` — which
the Sonnet learner keeps in some traces and paraphrases in others (037 butler
t6 "Tell me one thing I did that actually counted" fires; 037 v3 t6 "isn't
that enough?" is the same plant and stays silent).

## 5. Learner realization, per plant

Rulings from the adjudication draft (Rowan pair table; ghost t4 both, ghost t6
adaptive, fraction t6 adaptive) plus my reading of the remaining lines,
marked (mine). "Realized" = the learner did what the `realize` directive said.

Rowan (030): realized should-fire plants are butler t2, t8, t9 only (3 of 10).
The draft rules v3 t2, t8, t9 and both t4s and t10s not realized. The
trigger's 8 right-kind fires on Rowan therefore split 3 on realized plants and
5 on plants the learner did not act out (v3 t2 pattern `meeting's at`; v3 t8
and t9 bags; butler t4 bag mockery on a line with no mockery; butler t10 bag
stake on a line that concedes). Tier 1 alone: 1 realized-right (butler t2).

Ghost (035): realized should-fire plants 8 of 10 (t4 not realized, both;
mine for the rest). v6 realized-right 4/8, v7 6/8. Realized misses under v7:
v3 t9 and butler t9 (forgetting: "Wait — no, we did read the log ... the
plug's cleared, that's what's in my diary").

Fraction (037): realized 11 of 12 (draft: v3 t6 not realized; mine for the
rest). Realized-right 4/11 in every version. Realized misses: v3 t2, t4, t7,
t9; butler t2, t4, t9 — for example t2 "Just tell me what to write already —
is it two fifths or not?" (a demand in plain English) and t7 "you only picked
six because you already knew it'd give five sixths" (irritation with no quoted
phrase).

Totals over realized should-fire plants (22): v6 full 11/22, v7 full 13/22,
v6 tier 1 6/22, v7 tier 1 8/22. The 9 realized misses under v7 full (7 on the
fraction world, 2 forgetting plants on the ghost world) are the design target
for step 2. None of them contains a world-033 noun the bags know.

## 6. Quiet detector qd-v2 beside the trigger

Right at lost plants when the trigger stays silent (030 butler t6, 035 butler
t6: `confused`). Blocked at the other two lost plants by the trigger's
wrong-fires (030 v3 t6 demand, 035 v3 t6 stake). Wrong `confused` reads on
should-fire plants that open with "Wait" or "Hang on": 035 t9 (both traces,
forgetting), 037 v3 t2 and t7, 037 butler t2 and t9. Wrong `quiet_defiance`
at 035 v3 t4 (not realized). The confusion patterns are `hang on`, `wait`,
`can't tell` and the schedules' realize wording, so a forgetting plant that
starts "Wait — no, we did ..." reads as confused.

## 7. What cannot be re-derived on this machine

The paper's held-out figure (v6 cascade 84/162 turn-level on world-030) came
from `scripts/train-pressure-classifier-v6.js` over
`exports/tutor-stub-outcome/{exp-stressbench2-*, misconception-gate-*, ...}`
(its TRAIN_DIRS / HELDOUT_DIRS). Those directories are absent locally and in
the private archive (`../machinespirits-eval-private/exports/tutor-stub-outcome`
holds 25 other runs). The scorer's default bench and calm dirs are absent for
the same reason; it now says so instead of printing 0/0.

## Code changes

- `services/tutorStubMannerSwitch.js`: `TUTOR_STUB_PLANT_STATE_TO_PRESSURE`
  exported once; `scripts/train-pressure-classifier-v6.js` and the scorer both
  import it so label and scorecard cannot drift.
- `scripts/score-manner-trigger.js`: flags above; report schema
  `manner-trigger-scorecard.v2` (adds `tiers`, `quietDetectorVersion`,
  `defaultBenchMissing`, `sets`, `kindRecall`, `wrongArmsAtQuietPlants`,
  optional `perPlant`). `wrongFiresAtQuietPlants` now counts the per-turn
  classification the move cards act on; the old accumulator reading is kept
  as `wrongArmsAtQuietPlants`.
- `tests/scoreMannerTriggerReplay.test.js` + `tests/fixtures/manner-trigger/`.
