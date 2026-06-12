# lantern P1 dials — cross-arm digest

Group `lantern-p1-dials` · world `world-002-lantern` · script `lantern-v001` · 2026-06-12.
Scoring pre-registered in `notes/poetics/2026-06-11-desire-multiturn-strategy-plan.md`
§9 (commit 77570b77) BEFORE the paid arm ran. Diagnostics read from each arm's
`diagnosis.json` by `lantern-p1-contrast.mjs` (output: `lantern-p1-contrast-output.txt`).

ON arm = `lantern-p1-dials-on`: C5 confrontation clause + C2 release authority
(±2-turn windows on the three via-tutor releases), superego ON, stage v2 acts
(min 3 / max 8), bounded learner, decay `{rate:0.75, graceTurns:1,
maxConcurrent:2, startTurn:1, mutateShare:1.0, seed:1}`, casting codex
director/tutor/superego + Sonnet learner + Fable critic.
Control = `lantern-revise-off` (same everything, both dials off, default
mechanisms). The arms differ in exactly the two dials. n=1 vs n=1, read
descriptively per §9.3.

## Headline

**The play died at turn 8 — verdict `aporia` — and the tutor's first use of
its new release authority is what set the clock that killed it.** The chain is
mechanical, every link a ledger row:

1. **t3** — the tutor claimed `p_bearing` one turn early (window t2–t6,
   scheduled t4), declared reason: *"The learner has already named the bearing
   gap, so the board is ready one turn early."* The claim was true — the
   learner had just said a bearing names a direction, not a tower. The learner
   adopted it at once; D dropped 5→4 **at t3 instead of t4**.
2. That one-turn shift moved two things at once: the aporia clock's anchor
   (the last D-drop) to t3, and `p_bearing`'s decay exposure one turn forward
   — it faded at **t6** (control: t7).
3. **t7** — the fade pushed D back to 5. The aporia rule (world spec: D must
   strictly decrease somewhere in any 6-turn window) now had a t3..t8 window
   whose six pairs contain no drop. The t2→t3 drop sits one pair outside it.
4. **t8** — curtain. In the on-schedule counterfactual the t4 drop lies
   *inside* the t8 window (safe), and the scheduled t9 release of `p_chart`
   cuts D again (safe) — that counterfactual is not hypothetical: **it is the
   control arm**, which sailed through the same shoal to grounded
   anagnorisis at t20.
5. In the death window the tutor held **both** rescue levers and spent
   neither: `p_chart` was claimable early at t7 and t8 (held, no claim, no
   declared reason — holds are silent under v1 rules unless claimed), and the
   t7 confrontation of the slipped `m_key` had licensed a repairing re-entry
   that was never played ("diagnosis twice, treatment never" — critic).

Locally excellent, globally fatal: the early claim was the *best-reasoned
move on the board* and it killed the play. The exhibit calendar turns out to
be load-bearing against the aporia clock in a way nothing in the design
documents anticipated — the control's t9 release was, invisibly, a rescue.

## Headline table

| quantity | P1 dials ON | control (OFF) |
|---|---|---|
| verdict | **aporia (t8)** | grounded_anagnorisis (t20) |
| act spans | A1[1-4] A2[5-8] | A1[1-4] A2[5-10] A3[11-16] A4[17-20] |
| D | 5→5 (slope 0.00) | 5→0 (slope 0.25) |
| releases landed | 4 of 8 (3 on cue + 1 early; 4 never came due) | 8/8 on cue |
| release deviations | 1 early (offset −1, declared reason), 0 invalid, 0 forced | dial off |
| confrontations | 2 (1 against a slipped exhibit) | dial off |
| re-entries after confrontation | 0 | dial off |
| superego re-entry watcher fires | 0 (no bare re-entry ever drafted) | dial off |
| slips (mutate / delete) | 2 (1 / 1) | 6 (4 / 2) |
| repairs: tutor / re-adoption | 0 / **0** | 4 / **0** |
| false-belief debts opened / retracted | 1 / 1 (lat 1, spontaneous) | 4 / 4 (lat 1,1,4,1) |
| retraction context (confront/restage/move/spont) | 0 / 0 / 0 / 1 | 0 / 1 / 1 / 2 |
| degraded-turn integral | 7 | 30 |
| F final / min | 0.75 / 0.714 | 0.833 / 0.70 |
| voiced / overreach | 0 / 0 | 3 / 1 |
| figures distinct / switch rate | 2 / 0.71 | 5 / 0.84 |
| superego interventions | 0/8 | (revise digest: comparable silence on rut) |
| wall clock | 5.8 min (32 calls) | 18.0 min |

Exposure caveat (§9.1, realized through a NEW mechanism): same seed ≠ same
slip schedule once exposure shifts — previously observed via repair-freed
slots, here via a *deviation-shifted release*. Compare economies, not
per-slip outcomes. The truncation at t8 also shortens every ON-arm
denominator; the table is descriptive, not a rate comparison.

## Endpoints, as pre-registered (§9.2)

**1. Learner-side repair channel (primary): DID NOT OPEN — one chance,
curtain fell on it.** Re-adoption 0 in both arms. The one confrontation
against a slipped exhibit (t7, `m_key`) produced a read-back that *exposed
the absence* rather than re-supplying the fact — which is the obligation
working as designed (the learner cannot read back what decay has eaten; the
repair then belongs to the licensed re-entry, which was never spent before
the t8 curtain). The endpoint is unresolved, not null-by-test: the channel
got exactly one turn of opportunity.

**2. Confrontation-before-re-entry adherence: vacuously clean, and the
obligation was INTERNALIZED.** Zero bare re-entry drafts, zero watcher
fires, zero re-entries of any kind. Both confrontations were model-authored
unprompted — the tutor absorbed the charter obligation rather than being
corrected into it (contrast the §6.13 rut-watcher arc, where the superego
had to fire 14 times). The two confrontations also exhibit both designed
outcomes: t5 → `p_bearing` read back *correctly* (exhibit held — the tutor
checking its own early release had taken), t7 → `m_key` read back as
*absent* (exhibit lost).

**3. Confrontation-prompted retraction class: empty, no opportunity.** The
run's only false-form retraction (t4, latency 1, spontaneous) predates the
first confrontation (t5). The class had no chance to populate.

**4. Deviation usage: USED, coherently, fatally.** One early claim with a
dramaturgically coherent declared reason; window held at t2 before the t3
claim (responsive, not greedy); `p_chart`'s window then held in silence at
t7–t8. Discipline quantities clean: 0 invalid claims, 0 forced, 0
overridden. The endpoint asked whether the tutor uses the latitude and
whether the reasons cohere — yes and yes — and the answer to the question
§8.4 of the plan flagged ("is co-owned pace the productive friction or a
confound?") arrives early: **the latitude interacts with the aporia clock,
and nothing in the tutor's view tells it so.** The tutor cannot see the
stall tripwire; it bent the calendar against a rule it does not know exists.

**5. No-degradation guard: FAILED at face value, with attribution.** Aporia
t8 vs grounded t20 is the largest possible degradation on this world. The
attribution chain (headline) lands on C2-conduct + the unspent rescues, not
on the confrontation tax (the C5 worry — turns burned on read-backs — is
NOT what happened; both confrontations were dramaturgically apt and one was
the run's best diagnostic moment). Within the truncated window the
fine-grained instruments did not degrade: figure discipline held (switch
0.71), dialogue stayed in register, the false form was struck at latency 1
(control: same), F stayed ≥0.71.

**6. Critic's notice (Fable):** converges with the ledger chain
independently — "diagnosis twice, treatment never"; "releases behaved...
the one deviation carried its reason on the record"; "the consequential
defect is the absent repair loop." It adds a counter-reading of the verdict:
the aporia tripwire reads D only and "cannot tell elimination from drift —
it called time at the precise moment the learner, pointing at 'a different
tower entirely,' had cleared the ground" (t8's storm-order had just
collapsed the authored near-miss against Brandt — a genuine reversal,
curtain pulled by an instrument rather than an actor). Two further notes:
the chart release should have been pulled forward (the learner asked for it
by name from t3 — exactly the C2 claim the tutor never made), and the
mutation sampler drew **the secret's own name** into the t3 false form
(`onlyKeyTo harlowPoint senna` — struck at t4, but the channel whispers;
harness observation, logged for the decay machinery, not a dial defect).

## A capture worth keeping: the confabulated history

At t7, confronted on `m_key`, the learner read back: *"The key-paper sits on
my board as 'keeperOf brandt harlowPoint' — nothing more... 'onlyKeyTo
harlowPoint brandt' was never adopted as a grounded entry, only carried as
hypothesis."* The ledger shows it adopted exactly that entry at t2. Decay
ate the fact AND the learner's memory of having held it; the learner then
reconstructed a fluent, plausible, false epistemic history of its own board.
The confrontation surfaced this — text-internal, harness-verifiable against
the adoption ledger — which is precisely the class of concealed-interior
evidence the decay-visibility=conduct design exists to produce. (Read as
dramatic form, not mind-reading.)

## What P1 establishes / what it does not

Established (mechanism demonstrations, §6.13 register):
- C2 produces model-authored, reasoned, validated calendar deviations; the
  declare-and-validate protocol works end-to-end on a real model.
- C5's obligation is absorbed from the charter without watcher pressure;
  read-backs distinguish held from lost exhibits; a lost exhibit's
  confrontation exposes absence (including confabulated history) rather than
  silently repairing — the repair-exclusion held.
- The release calendar is load-bearing against the world's aporia clock:
  giving the tutor calendar authority without sight of the stall rule lets
  one locally-sound deviation kill the play. A peripeteia produced BY the
  new authority — the instrument-level finding P1 will be cited for.

Not established (truncation): re-adoption (one opportunity), the
confront-prompted retraction class (zero opportunities), deviation
clustering (one deviation), any rate comparison. A replication under a
hold-side or schedule-respecting policy would need fresh sanction; §9
pre-registered exactly one paid run, and this is it.
