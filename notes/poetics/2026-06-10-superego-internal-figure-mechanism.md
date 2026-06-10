# Internal figure mechanism — tutor superego replaces the director's note channel (2026-06-10)

Status: OPEN — Phase C running log (serialized paid arms land below as they
complete).
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
