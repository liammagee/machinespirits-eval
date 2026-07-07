# Dramatic derivation, phase 1: world-001 + the first closed staging loop

2026-06-09 · branch `claude/dramatic-derivation` · plan: `notes/2026-06-09-dramatic-derivation-plan.md` §3

## What now exists

**World-001, "The Unsigned Nocturne"** (`config/drama-derivation/world-001-nocturne.yaml`).
Archival attribution chamber mystery: an unsigned nocturne surfaces in a flooded
conservatory archive; the room is sure it is Maestro Vess's; the secret S is
`composed(liane, nocturne)` — a contingent particular who does not exist outside
the premises. 6 public rules, 13 concealed premises, 4 authored proof paths
(2 dating routes × 2 presence routes; the ink route is authored but unscheduled —
tutor freedom for later phases), a properly tempting mirror (Vess holds the style
verdict and the source via the same R3 the heroine uses; he fails only presence
and hand), 11 releases over turns 3–32, turn cap 40, t_min 28, aporia window 8.

**Both leak screens pass.**
- plotLint (exact, chainer): no release prefix entails S before t_min; S first
  derivable exactly at the planned recognition turn 32; mirror never entailed;
  all 4 paths covered. `npm run derivation:lint`.
- Guessability (the Oedipus S-underivability screen on K_L): GPT could not
  recover Liane from the curtain-rise context; top candidate Vess at p=0.28,
  judged under-determined. `npm run derivation:screen`. K_L spec is written
  next to the artifact so the screened context is auditable
  (`exports/dramatic-derivation/screens/`).

**The staging-loop harness** (`npm run derivation:loop`).
LLM role bridges behind a mock/real seam (`services/dramaticDerivation/
{llmClient,llmRoles}.js`, `DERIVATION_LLM`, default mock, default real target
openrouter/gemini-flash). Three disciplines:
1. releases are harness-enforced — the schedule decides what/when/who; the
   model only writes the prose that carries the evidence on stage;
2. the learner factory takes no world — built from K_L fields only; it adopts
   exhibits by index and answers by binding the question pattern, so nothing
   the harness didn't release can enter the success channel;
3. mock and real share one code path (the mock answers from bridge-computed
   hints through the same JSON parse), so a zero-cost run exercises every line
   a paid run executes.

Programmatic diagnosis (`diagnose.js`): taxonomy events, D(t), forced-vs-asserted
timing, release adherence vs the frozen plot, per-role dialogue discipline; plus
a readable act-by-act transcript with the extracted proof tree. Tests:
`tests/dramaticDerivationPhase1.test.js` (7) — lint + pacing, K_L purity,
prompt-layer concealment (a concealed token never reaches the learner before
its release turn; unscheduled-premise tokens never at all), bridge-driven mock
drama clean, index-mapped adoption. Full hermetic suite 3409 pass.

## The first closed loop (the actual phase-1 result)

All on gemini-3-flash-preview, all roles, ~160 s and ~$0.15 per run, hard-bounded
by the turn cap. Artifacts under `exports/dramatic-derivation/loop/`.

| iteration | verdict | forced → asserted | events beyond success |
|---|---|---|---|
| v001 mock | grounded_anagnorisis | 32 → 32 | none (plumbing check) |
| v001 real | grounded_anagnorisis | 32 → 32 | **lucky_leap ×3 (turns 29–31)** |
| v002 real | grounded_anagnorisis | 32 → 32 | none |

**v001 diagnosis.** The leaps were tutor-induced. With no release cue at turn 28,
the tutor *described the content of p_hand* — "the ledger shows the same jagged
strokes and heavy crossings as the manuscript… the hand that corrected the
draft" — four turns before the director stages that comparison; p_ward was
shadowed the same way at turn 24. The learner converted said into shown ("the
tutor has shown that the hand in the ledger is the hand that corrected the
draft") and asserted Liane three turns running. The formal channel held: p_hand
was never adoptable early, so the checker scored every early assertion
`unforced`. The prose channel leaked; the checker caught the consequence.

**v002 revision** (script only — world, director, harness frozen): an
"evidence not yet staged does not exist" rule (a leak can wear a question
mark), "name the lack, never the filling" pacing, and leap handling that sends
an ungrounded assertion back to the still-missing conjunct. Result: zero
leaps; the tutor in the same window now says "do not leap across the gap
before you have measured it" / "until the Dean speaks, you have only the law
and two sets of marks," and the learner articulates the discipline itself
("until that comparison is made and grounded, the gate remains closed").
Recognition lands at 32, asserted the same turn, grounded, with the full
7-premise proof tree extracted.

The drama reads as drama: the act-II peripeteia (concert bills) kills the
style verdict by the presence rule; act III ends with the learner holding
exactly the authored dialectic — "the second key is turned for him, but the
first key — presence — remains locked against him."

## What this does and does not establish

Established: the phase-1 generative claim in one instance — with plot and
checker frozen, a checker-forced grounded anagnorisis is reachable, and
*staging quality is a scriptable variable* (one targeted script rule moved
lucky_leap 3→0 between otherwise-identical runs). The two-channel design did
its job: harness-enforced releases made the formal channel leak-proof while
the taxonomy read the prose leak's consequence off the board state.

Not established: robustness (n=1 per script; no seeds/variation), behavior of
stronger or weaker learner models (flash's gullibility at v001 is one model's
disposition), any cross-world generality, and nothing about real learning —
the instrument classifies dramatic form on the board state, as always.

## Next

- A small repetition set on v002 (3–5 runs) before treating leap-free as a
  property rather than an instance; then a learner-model swap (does a stronger
  learner leap *more* — better at completing the tutor's hints — or less?).
- Phase-2 (per plan): unfreeze the director; let the schedule become policy.
- Paper landing: ≈§6.13 of `docs/research/paper-full-2.0.md` once there is a
  repetition set worth citing; nothing in the paper yet.
