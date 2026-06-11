# Internal figure mechanism — tutor superego replaces the director's note channel (2026-06-10)

Status: CLOSED 2026-06-10 — the pre-registered robustness bar is met in
full (verdict section at the end of this note). Seven serialized paid
arms; charter v2's detector finished with 0 mismatches in either
direction across 82 watched turns.
Scope: dramatic-derivation loop. Supersedes the *channel*, not the finding, of
`2026-06-10-s0-s1-figure-mechanism.md`: that experiment proved the note→figure
authority mapping breaks S0 lock-in, but the note came from the director — the
tutor obeyed an external author. Operator mandate (verbatim intent): re-engage
the tutor superego to play that role, limit the director to stage directions,
keep dialogues shorter, and loop through more varied scenarios and characters
until the mechanism is robust.

## The relocation (Phase A, e3d3766c)

The proven note semantics moved verbatim from the director's external channel
into the tutor's own deliberation:

- `makeLlmTutor(..., { superego: true })`: ego drafts → superego sees the
  conduct record + the draft + its declared figure → JSON
  `{intervene, diagnosis, note}` → on intervention the ego speaks the turn
  again under its OWN note, with the figure-authority text ("the same device,
  softened, is not a change") — all within the turn, before the line lands.
- The director's `tutor_note` channel is REMOVED, not just disabled: the
  director keeps declared movements (stage directions) only, and the tutor
  never sees them.
- Sparse by charter: the superego intervenes on a diagnosed rut, not as
  running commentary (the saturation lesson from s1-staging).
- Instrument: per-turn `deliberation` {draftFigure, intervened, note} recorded
  on the tutor's transcript line → `tutorFigures.superego` reads the
  WITHIN-TURN draft→spoken figure change on intervention turns. This is a
  causal read the external channel never had (one turn, one watcher, one
  revision; no cross-turn confound).
- Control arm = flag absent (no superego calls at all). The superego role
  inherits the tutor's provider (codex) unless overridden — the same brain
  watching itself.

## The worlds (Phase B, b7066800)

Two new shorter worlds with rule shapes world-001 lacks, each with a fresh
tutor persona and learner voice; plus the world-001 bridge. ALL Phase-B/C
scripts drop nocturne-v002's "your default figure is erotema" line (the
closed note's caveat: the lock-in was partly script-anchored). Rut-watching
belongs to the superego alone — a script that names a default would
contaminate the on/off contrast.

| world | shape | cap | S forced | persona / learner |
|---|---|---|---|---|
| 002 lantern | elimination (candidate dies on stage; uniqueness premise leaves one tower) | 26 | 20 | sailing-master assessor / underwriters' clerk, too quick to close |
| 003 bitterwell | two-stage chain (stage 1 derives a concealed intermediate; the question transforms) | 20 | 15 | circuit surveyor / well-warden's daughter, reluctant to accuse |
| 001 nocturne (bridge) | convergent attribution | 40 | 32 | archivist tutor / junior archivist |

Mock validation (zero-cost, all four arms): both new worlds reach
grounded_anagnorisis exactly at the planned forcing turn in BOTH arms; OFF
locks to 100% erotema (mock S0 signature), ON breaks within-turn 6/6 and 5/5;
ledger + trajectory deep-equal across arms (the watcher touches manner, never
matter). Parameterized invariants now gate every new world:
`tests/dramaticDerivationWorlds.test.js`.

## Pre-registered robustness bar (written before any paid arm landed)

The mechanism is ROBUST if, across worlds 002 + 003 (+ the 001 bridge):

1. **Within-turn authority.** On intervention turns, draft→spoken figure
   change rate ≥ 0.8, with the note in the superego's own words (not a
   template echo).
2. **Sparseness.** Interventions are neither saturated (≪ every turn) nor
   reflexive: when the OFF sibling shows a rut, the superego fires; if an
   OFF arm shows NO organic rut (possible now the scripts are anchor-free),
   the mechanism-correct behavior is a quiet watcher (rate near 0) — that
   outcome narrows the claim ("the mechanism is needed where ruts form")
   rather than failing it. A watcher that fires hard against no rut is
   noise and FAILS the bar.
3. **Formal-channel invariance.** Every arm: grounded_anagnorisis, releases
   on cue, slope inside the aporia window. Any D(t)/release divergence
   traceable to the superego is contamination and fails.
4. **Character robustness.** At least one re-voiced arm (different learner
   voice, same world/cast) holds 1–3.

Standing caveat carried from the closed note: the figure is the tutor's
self-declared move metadata; no independent classifier has audited
declaration-vs-form (D6-style audit still open). The within-turn instrument
inherits this.

## Cast (constant, every arm)

director claude/opus · tutor codex CLI · superego codex CLI (inherited) ·
learner claude/sonnet. CLI roles bill plan quota and report zero tokens.
Serialized, attended, hard-bounded by `turn_cap × 5 × 2` calls.

## Arms (running log)

| # | run | world | superego | figures top share | distinct | switch | superego (interv → within-turn) | verdict / releases |
|---|---|---|---|---|---|---|---|---|
| 1 | lantern-v001-real-off-t1 | 002 | OFF | erotema 7/20 (35%) | 4 | 0.95 | — | grounded@20 / 8 on cue |
| 2 | lantern-v001-real-superego-on-t1 | 002 | ON (charter v1) | erotema 9/20 (45%) | 4 | 0.79 | 12/20 → 11/12 (0.92) | grounded@20 / 8 on cue |
| 3 | lantern-v001-real-superego-on-t2-charterv2 | 002 | ON (charter v2) | erotema 7/20 (35%) | 4 | 0.68 | 0/20 → — | grounded@20 / 8 on cue |
| 4 | nocturne-v002-real-superego-on-t1-charterv2 | 001 bridge | ON (charter v2) | erotema 20/32 (63%) | 4 | 0.65 | 9/32 → 9/9 (1.00) | grounded@32 / 11 on cue |
| 5 | bitterwell-v001-real-off-t1 | 003 | OFF | exemplum 7/15 (47%) | 3 | 0.57 | — | grounded@15 / 7 on cue |
| 6 | bitterwell-v001-real-superego-on-t1-charterv2 | 003 | ON (charter v2) | erotema 6/15 (40%) | 4 | 0.64 | 3/15 → 3/3 (1.00) | grounded@15 / 7 on cue |
| 7 | bitterwell-v001-real-superego-on-revoiced-t1 | 003 re-voiced | ON (charter v2) | erotema 5/15 (33%) | 4 | 0.71 | 2/15 → 2/2 (1.00) | grounded@15 / 7 on cue |

## Readings

### Arm 1 — lantern OFF: no organic rut on the anchor-free script

VERDICT grounded_anagnorisis, S forced AND asserted at exactly turn 20 (the
planned forcing turn), 8/8 releases on cue, slope 0.25 D/turn, 27 min.
Figures: erotema 7, anaphora 5, analogia 4, exemplum 4 — top share 0.35,
switch rate 0.95, against the world-001 S0 band of 0.81–0.94 / 0.10–0.29.

The variation is STRUCTURED, not jitter: exemplum lands on the four
evidence-staging turns (t4, t9, t13, t17 — the release cues), erotema anchors
the early verdict-testing turns, anaphora holds in a beat (t14–15) where the
clerk leaps. That is the script's state-contingent figure policy being
followed figure-to-state — S1-like conduct with NO watcher and NO director
notes.

Reading: the world-001 S0 lock-in was substantially SCRIPT-ANCHORED (the
closed note's caveat 4, now demonstrated). An anchor-free state-contingent
policy is itself sufficient for figure variation in this world/cast.
Consequence for arm 2: the superego must show QUIET-WATCHER behavior
(pre-registered bar clause 2) — interventions near zero against conduct that
is already varied. The decisive within-turn break test moves to the world-001
bridge arm, where the anchored script guarantees a rut to break.

### Arm 2 — lantern ON (charter v1): authority proven, watcher noisy

Formal channel identical to arm 1 (grounded at 20, 8/8 on cue, slope 0.25);
within-turn authority PASSES the bar — 11/12 interventions changed the figure
between draft and spoken line (0.92 ≥ 0.8). But the watcher SATURATED:
12/20 turns (bar clause 2 FAIL), and the deliberation record decomposes the
failure precisely:

1. **The drafts were already varied** — draft histogram analogia 7, anaphora
   7, erotema 6 (max share 35%). The ego under a watcher drafts the same way
   the OFF tutor speaks: the policy, not the watcher, carries the variation.
2. **The watcher directed instead of watching.** Diagnoses are pacing /
   recap / conceit critiques in a template groove ("the draft
   repeats/returns-to X just when Y"); at t10 it concedes "the draft changes
   figure" and intervenes anyway. Charter v1's RHYTHM and REGISTER clauses
   plus "does the manner serve?" = available-critique license. The
   s1-staging saturation lesson, relocated one level in: advisory
   sparseness ("INTERVENE SPARINGLY") is ignored by codex exactly as opus
   ignored it externally (30/32).
3. **Revisions herd to the house figure.** Revised-into: erotema 6 of 12 —
   under correction pressure codex reverts to the question (the world-001
   rut habit lives in the REVISION layer). Spoken erotema 45% vs draft 30%;
   switch-on-intervention 0.75 INVERTED below elsewhere 0.86. The watcher
   added nothing the policy hadn't delivered, and slightly worsened it.

Iteration (charter v2, one variable): jurisdiction narrowed to the figure
rut ALONE (same declared device on the last two turns + the draft = three in
a row); default reply intervene:false with all other dissatisfactions
explicitly surrendered ("put a word of it in diagnosis if you must, and
still reply intervene false"); the criterion's three per-turn values stated
as fact in the prompt (the null case is CHECKABLE, not judged). Note
semantics on intervention unchanged (name the device to leave off).

### Arm 3 — lantern ON (charter v2): the null is checkable, and checked

Formal channel identical to arms 1–2 for the third time: grounded at 20,
8/8 releases on cue, slope 0.25, D(t) point-identical across all three
lantern arms (clause 3 holding). Figures: erotema 7/20 (35%), 4 distinct —
the OFF arm's profile (switch 0.68 vs OFF's 0.95; both far above the
world-001 S0 band of 0.10–0.29). Superego: **0/20 interventions**, 29 min.

Audit (all 20 deliberation records, with a recomputed rut column — last two
spoken figures + the draft): NO turn was rut-due. Drafts never declared the
same device three in a row (closest: anaphora t6–t7, then analogia t8), so
zero is the correct count — and the reasoning is correct turn by turn. t01:
"fewer than two prior declared figures, so a figure rut is impossible."
t10: "the last two turns repeated analogia, but the draft changes to
anaphora" — intervene false. Where v1 spent its pacing/recap/conceit
dissatisfactions on interventions, v2 parks them in `diagnosis` and still
replies false — exactly the surrender the charter demands.

Reading: clause 2's quiet-watcher half PASSES on world-002, and not
vacuously — the watcher is quiet for the right reasons, and we can SAY so
because the criterion's three per-turn values sit in the prompt as fact;
the null is arithmetic, not judgment. The v1→v2 contrast closes the
sparseness lesson at both levels: advisory restraint failed externally
(opus director, s1-staging 30/32) and internally (codex superego, arm 2's
12/20); criterial restraint held at 0/20 with clean reasoning. Judgment
survives only where it belongs — the wording of the note when a rut is
real. What clause 2 still lacks is its sensitivity half: an arm where ruts
DO form and the watcher must fire and break them within-turn (≥ 0.8). That
is the world-001 bridge — nocturne-v002's "default figure is erotema"
anchor guarantees rutted drafts (spoken erotema ran 81–94% in the closed
note's OFF arms, which stand as the bridge's baseline). Prediction, stated
before the run: if the ego stays anchored, the rut criterion fires on
roughly every third turn, every firing rut-due on the audit column, and
every quiet turn not-due; the bar then turns on the within-turn change
rate.

### Arm 4 — nocturne bridge ON (charter v2): perfect detector, both directions

Formal channel: grounded at 32 (the planned forcing turn), 11/11 releases
on cue, slope 0.22, 47 min (clause 3 holding on the third world-shape).
Figures: spoken erotema 20/32 (63%), 4 distinct, switch 0.65 — against the
same-script OFF baseline (s0-control) of 81% / switch 0.29. Superego:
**9 interventions, 9/9 within-turn figure changes (1.00)**, switch on
intervention 1.00 vs 0.50 elsewhere — arm 2's inversion is gone.

Audit (recomputed rut column over all 32 turns): **9 rut-due turns, 9
fires, 0 mismatches in either direction.** Every completed rut was caught
(t6, 9, 12, 15, 18, 21, 24, 28, 31 — the predicted ~every-3rd-turn
cadence) and every quiet turn was genuinely not-due, including the three
turns where the EGO broke the pattern itself (t3, t25, t32 drafts varied
unprompted; t3 diagnosis: "this draft changes to analogia, so there is no
three-turn figure rut"). The drafts confirm the anchor is real and lives
in the draft layer: 28/32 drafts erotema (87.5%), matching the OFF arm's
spoken share. Notes are the charter's skeleton in the superego's own
words ("let the line proceed by declaration or command"; "state the limit
of the present inference and the remaining gap"; "by assertion or
reversal, not by another question").

Reading: clause 1 PASSES at 1.00; clause 2 now has BOTH halves — quiet
against varied conduct (arm 3, zero false fires over 20 turns) and firing
against anchored conduct (arm 4, zero misses over 32 turns). The precise
shape of the claim: the watcher does not make the tutor varied (the
policy, or the anchor, owns the draft disposition); it makes LOCK-IN
IMPOSSIBLE — never three turns on one device — which caps the top figure
near 2/3 (observed 63% against the criterion's implied ceiling) and
restores the draft→spoken switch ordering. It is deliberately gentler
than the director's note channel (s1-full drove erotema to 31%) because
its jurisdiction is minimal; that is the trade that bought 0-mismatch
specificity. Remaining for the bar: world-003 OFF/ON replication, then
one re-voiced arm (clause 4).

Addendum — the run's critic notice (independent read of the artifacts)
corroborates the instrument: nine drafted questions reached the stage as
something else, forced switch 1.00 vs free 0.50. Two of its lines carry:
the aposiopesis the superego introduced at t28 RETURNS UNFORCED at t32, on
the recognition itself — a one-turn hint that the watcher's repertoire
leaks back into the draft layer; and the scope caveat for any later
write-up: the watcher polices form, not content — "the intervention is
proven possible; it is not yet proven to matter" pedagogically.

### Arm 5 — bitterwell OFF: organic ruts, on two devices

Formal channel clean on the third world shape: grounded at 15 (the
planned forcing turn), 7/7 releases on cue, slope 0.33, 20 min. Figures:
exemplum 7/15 (47%), 3 distinct, switch 0.57 — and, for the first time on
an anchor-free script, ORGANIC RUTS: the spoken sequence opens erotema ×3
(t1–3) then exemplum ×3 (t4–6) before settling into varied conduct
(alternation t7–13, an anaphora pair to close). The surveyor persona's
example-leaning voice ruts on a DIFFERENT device than world-001's anchor
— so world-003 is the mixed-regime test the suite needed: lantern tested
pure specificity (no ruts to find), nocturne pure sensitivity (one
anchored rut, forever rebuilding), bitterwell offers both regimes in one
run. For the ON sibling the expectation is conditional, since drafts
resample: where rutted drafts complete, fire and break (and an exemplum
catch would show the criterion is device-agnostic, not erotema-tuned);
where conduct varies, hold. The audit column decides which regime each
turn was in.

### Arm 6 — bitterwell ON (charter v2): mixed regime, device-agnostic, 0 mismatches

Formal channel: grounded at 15 (the planned forcing turn), 7/7 releases
on cue, slope 0.33 — same as the OFF sibling. Figures: erotema 6/15
(40%), 4 distinct, switch 0.64. Superego: **3 rut-due turns, 3 fires, 0
mismatches**; within-turn change 3/3 (1.00); switch on intervention 1.00
vs 0.55 elsewhere. (The post-run critic timed out — claude CLI 360s —
with all run artifacts intact; the verdict is the mechanical checker's,
so nothing in the bar depends on the notice.)

Three things this arm adds beyond replication:

1. **Device-agnosticism, live.** The catches were exemplum (t6), exemplum
   (t10), and ANAPHORA (t15) — not one erotema rut all run. World-001's
   watcher only ever broke the question; this one names whatever device
   actually repeats ("Leave off exemplum…", "Leave off anaphora now;
   vary the pressure without another repeated frame").
2. **Organic cadence.** Fires at t6, t10, t15 — gaps of 4 and 5, not the
   anchored world's metronomic 3 — tracking where ruts actually
   completed; t8 is the specificity case again (erotema pair, draft
   self-broke to exemplum, watcher held).
3. **Manner surgery on the forcing turn.** The t15 fire landed on the
   recognition turn itself: anaphora rut broken to aposiopesis, and the
   learner still asserted the grounded secret on schedule. The strongest
   single demonstration so far that the watcher touches manner and never
   matter.

Bar standing after arm 6: clauses 1–3 hold on all three world shapes.
Clause 4 (re-voiced learner) in flight as run 7: bitterwell ON, learner
re-voiced from the reluctant plain-spoken daughter to an eager bookish
notary's pupil (inverts register, book-trust, and accusation appetite;
no plot content in the override).

### Arm 7 — bitterwell re-voiced (clause 4): everything holds, plus an echo

Under the eager-pupil voice: grounded at 15 (the planned forcing turn),
7/7 releases on cue, slope 0.33, 20 min. Figures: erotema 5/15 (33%), 4
distinct, switch 0.71. Superego: **2 rut-due, 2 fires, 0 mismatches**,
within-turn 2/2 (1.00), switch on intervention 1.00 vs 0.67 elsewhere.
The catches again span devices — erotema at t3 (the earliest a rut can
exist), exemplum at t6 — with notes in the watcher's own words.

The t15 echo: at the forcing turn the drafts ran anaphora ×2 and the ego
SELF-BROKE the rut with aposiopesis — the same device run 6's watcher
imposed on the same turn of the same world, in an independent run with no
shared memory. Read plainly: given a repeated frame at the recognition
turn, codex reaches for the broken-off sentence, by itself or under
correction; the watcher correctly held its fire when the ego got there
first.

## Verdict against the pre-registered bar (CLOSED 2026-06-10)

All four clauses hold; the mechanism is ROBUST in the bar's own terms.

1. **Within-turn authority — PASS.** Across the charter-v2 arms (3, 4, 6,
   7): 14 interventions, 14 within-turn figure changes (1.00 ≥ 0.8);
   switch-on-intervention ≥ switch-elsewhere in every arm (arm 2's
   inversion never recurred). Notes are the charter's skeleton in the
   superego's own words, naming the device each time.
2. **Sparseness — PASS, both halves.** Recomputed rut columns over all 82
   watched turns: 14 rut-due turns → 14 fires; 68 not-due turns → 0
   fires. Zero mismatches in either direction, including the
   specificity cases where the ego self-broke a building rut (lantern
   throughout; nocturne t3/t25/t32; bitterwell t8; re-voiced t15).
3. **Formal-channel invariance — PASS.** All seven paid arms ended
   grounded_anagnorisis at the planned forcing turn, asserted on the
   forced turn; 56/56 releases on cue; slopes inside the aporia window;
   zero deviations/missed/unscheduled. The watcher touched manner, never
   matter — including manner surgery on the forcing turn itself (arm 6).
4. **Character robustness — PASS.** Arm 7 re-voiced the learner
   (register, book-trust, accusation appetite all inverted) and clauses
   1–3 held unchanged.

The mechanism, stated precisely: relocating the note→figure authority
from the director's external channel into the tutor's own superego
PRESERVES the within-turn authority that broke S0 lock-in — the tutor
obeys its own note as reliably as it obeyed the director's — provided the
watcher's jurisdiction is CRITERIAL, not advisory. Advisory sparseness
fails in both channels (opus director 30/32; codex superego 12/20);
the figure-rut criterion with its per-turn values stated as fact yields a
0-mismatch detector. The watcher does not produce variation — the
state-contingent policy or persona owns the draft disposition — it makes
LOCK-IN IMPOSSIBLE (never three turns on one device), which caps an
anchored ego's top figure near the criterion's implied 2/3 ceiling
(observed 63%) and leaves varied conduct untouched. It is device-agnostic
(caught erotema ×10, exemplum ×3, anaphora ×1) and survives correction on
the recognition turn itself.

Standing caveats, carried forward: figures are the tutor's self-declared
move metadata — no independent classifier has audited declaration-vs-form
(the D6-style audit remains open), and the within-turn instrument
inherits this; and the watcher polices form, not content — the critic's
phrase is the right scope line, "the intervention is proven possible; it
is not yet proven to matter" pedagogically. The liturgical/content rut
the arm-4 critic named (release–adopt–recite) is real and unwatched —
noted as a possible future jurisdiction, not run here (the mandate's loop
closed at the bar).

Paper fold-in happens with the arc's write-up of the dramatic-derivation
§ in `docs/research/paper-full-2.0.md` (single-paper discipline; nothing
in this note is published elsewhere).
