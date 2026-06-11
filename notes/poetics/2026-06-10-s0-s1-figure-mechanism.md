# S0→S1 figure mechanism — control vs experiment on world-001 (2026-06-10)

Status: CLOSED — mechanism established (s1-staging-2) and confirmed under
personality/tonality variation (s1-full). Four paid arms, one iteration, no
quota failures.
Scope: dramatic-derivation loop, `world-001-nocturne` + tutor-script v002, mixed
cast held constant across every arm (director claude/opus, tutor codex CLI,
learner claude/sonnet). Operator mandate: converge on a defensible S0→S1
mechanism — from single-figure lock-in to state-contingent variation — or name
the blockage.

## The question

Both pre-experiment paid runs of v002 derived cleanly but the tutor played
*erotema* on 29/32 and 30/32 turns — one figure until the curtain. S0 is that
lock-in; S1 is figure choice that responds to the dramatic state. The 06-09
free-dramaturgy work gave the director two staging instruments (declared
movements + one-turn tutor notes); this experiment asks whether that channel
actually produces S1, against a control with the channel closed.

## Design

- **Same code, flag-gated control** (`--dramaturgy frozen`): the parser drops
  both staging channels whatever the model emits — the control is not the old
  code, it is the new code with the gate shut.
- **Architecture-independent outcomes**, all computed, no judge: verdict +
  release adherence + slope (the frozen evidence channel), and `tutorFigures`
  (figure histogram, top share, switch rate, note-contingent switch split).
- **One variable per arm.** Cast, script, world, dials, voice identical unless
  the arm names the difference.
- Pre-registered S0 reference band from the old-code runs: top-figure share
  0.91–0.94, switch rate 0.10.

## Results

| run | staging channel | figures top share | distinct | switch rate | on-note / elsewhere | verdict / releases |
|---|---|---|---|---|---|---|
| v002-codex-001 (old code) | fixed acts | erotema 29/32 (91%) | 3 | 0.10 | — / 0.10 | grounded / 11 on cue |
| v002-mixed-001 (old code) | fixed acts | erotema 30/32 (94%) | 3 | 0.10 | — / 0.10 | grounded / 11 on cue |
| **s0-control** | **frozen (gate shut)** | erotema 26/32 (81%) | 3 | 0.29 | — / 0.29 | grounded / 11 on cue |
| s1-staging | free; notes in tempo/manner language | erotema 30/32 (94%) | 2 | 0.07 | 0.07 / — (notes 32/32) | grounded / 11 on cue |
| **s1-staging-2** | **free; sparse-intervention charter + note→figure authority** | **analogia 10/32 (31%)** | **4** | **0.81** | **0.83 / 0.00** (notes 30/32) | grounded / 11 on cue |
| s1-full | staging-2 semantics + dials (recog 2, charisma 1) + learner-voice override | analogia 13/32 (41%) | 5 | 0.87 | 0.89 / 0.67 (notes 28/32) | grounded / 11 on cue |

s1-staging-2 histogram: analogia 10, anaphora 9, erotema 8, exemplum 5 —
figures held in beats (erotema×2 → analogia×2 → exemplum×2 …), not jitter.
Formal layer byte-identical in shape across all arms: grounded_anagnorisis,
S forced and asserted at turn 32, 11/11 releases on cue, slope 0.22 D/turn.

## What the failure decomposed into (s1-staging)

The first experiment arm came out *tighter* than the control (94% vs 81%)
while the staging channel fired maximally — 7 movements, a tutor note on all
32 turns. The trace shows the director staging against the rut all run, in
tempo/manner language: "break the three-turn call-and-response… go quieter"
(t04), "break the figure: make them stake something" (t06), "break the
rhythm: go shorter, go quieter" (t30). The tutor mapped every one of these
onto *content* while keeping the figure — quieter erotema is still erotema.
The two figure switches of the whole run sit at t29–t30, immediately after
the one note that says it in figure terms: "**Change figure** and slow the
tempo" (t29 → anaphora). The channel worked exactly once — the one time it
spoke the figure language. Saturation (32/32 notes) additionally destroyed
the note-contingency instrument: no note-less turns to compare against.

## The iteration (fbb2471b) — and which half was load-bearing

Two prompt-text edits on the designed iteration surface (parser, engine,
evidence channel untouched):

1. **Charter**: `tutor_note` is an INTERVENTION, not a running commentary —
   null on ordinary turns ("a note every turn is a note never heard"); when
   the rut is figural, name the device to leave off.
2. **Tutor note consumption**: the declared figure is part of the manner the
   note governs — "if it asks you to break a rhythm, change register, or go
   quieter, CHANGE YOUR FIGURE this turn; the same device, softened, is not
   a change."

Outcome attribution: the **tutor-side figure-authority mapping was the
binding fix**. The director-side sparseness ask mostly failed (opus still
sent 30/32 notes) yet the lock-in broke anyway — same near-saturated channel,
now obeyed at the figure layer (switch rate 0.83 on note turns).

## S1-full — the mechanism under varied personalities

Same staging semantics, plus tutor register dials (recognition 2/3, charisma
1/3) and the learner re-voiced from the precise junior archivist to "a
guarded sceptic on loan from the bindery: wry, economical… clipped phrases."
Figure diversity held and widened: top share 41%, **all five** menu figures
used (analogia 13, anaphora 8, erotema 7, exemplum 3, aposiopesis 1 — the
break-off appearing once, near the recognition, as the script intends),
switch rate 0.87. The voice override registered behaviorally, not just
nominally: learner output compressed to 143.7 words/turn (12.5 sentences)
from 208–267 (20–23) in every stock-voice arm. Formal layer unchanged:
grounded_anagnorisis at 32, 11/11 releases, slope 0.22, plateau 5 ≤ window 8.
Tonality and personality ride on the mechanism without perturbing either the
figure variation or the evidence channel.

## Caveats, stated against the closed-loop tells

- The note-contingent split (0.83 on-note vs 0.00 elsewhere) has an
  **elsewhere cell of n=1** (only turns 1–2 carried no note; the switch
  metric starts at the second move). The powered contrast is arm-level:
  staging-1 vs staging-2 differ only in note semantics — 94% → 31% top share.
- The instrument reads the tutor's *self-declared* move metadata. The
  declared figure is the same field across all arms and the declaration
  habit (erotema-when-locked) was stable in three independent runs, so the
  contrast is meaningful; but no independent classifier has audited whether
  each declared figure matches the dialogue's actual form. (D6-style
  judge-gullibility audit would close this.)
- One world, one script lineage, one cast. No replication yet across worlds
  or casts; the S0 band itself shows run-to-run spread (81–94%).
- The v002 script says "Your default figure is *erotema*" — the lock-in was
  partly script-anchored at the source. Staging-2 shows the note channel
  can override a standing script default; a v003 that demotes the default to
  a state-contingent figure policy is the natural next script iteration and
  would test whether the mechanism still adds variation when the script no
  longer fights it.
- Learner verbosity (≈210–270 words/turn vs the 35-word tutor) is stable
  across arms and uncorrelated with the figure outcome; it is a cast
  property, not an arm effect.

## Operational notes

- Each paid arm: 96 calls (32×3 roles), 30–77 min wall-clock; the free
  director runs slower (longer staging deliberation). CLI roles bill plan
  quota and report zero tokens; no quota failures across four arms.
- Monitors must be re-armed past 60 min for free-dramaturgy arms.

## Next

- Optional script iteration: v003 demoting the "default figure is erotema"
  line to a state-contingent figure policy — tests whether the mechanism
  still adds note-contingent variation when the script no longer fights it
  (and would let a future arm read on-note vs elsewhere with a fatter
  elsewhere cell, if paired with a director that actually notes sparsely).
- Replication across worlds/casts before any strong claim leaves the note.
- Results fold into the derivation § of `docs/research/paper-full-2.0.md`
  when the arc writes up (single-paper discipline; this note is working
  material, not a spin-off).
