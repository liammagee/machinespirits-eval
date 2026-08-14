# Design: edged-register outcome study (Stage 3 question, fresh registration)

**Date:** 15 August 2026. **Status:** DESIGN for human review — nothing here
is registered or authorized; no paid call is licensed by this note.
**Basis:** the adaptive-register-switching arc
(`workplan/items/adaptive-register-switching.md`, runs
`eval-2026-08-09-b09e5a10` Stage 1, `eval-2026-08-09-53421919` Stage 2),
paper §6.7/§8.9 (negative-register measurement story, judge rule),
`exports/register-confirmatory-evidence/final/` (field selector closed).

## 1. The question

Does letting the router pick an edged register (ironic, sarcastic) at
resistance moments improve learner outcomes over a warm-only router — asked
on learners the warm router does not already convert?

## 2. Why Stage 2 could not answer it

Stage 2 was well built and complete (105/105, fail-closed report, no
errors) and returned `NO_PRIMARY_EVIDENCE`: conversion 29/35 adaptive,
33/35 router-warm, 30/35 pinned-sarcastic (Fisher p=.2595). The design
powered a .50-versus-.85 contrast, but the warm control converted at .94 —
the endpoint sat at the ceiling, so the study measured almost nothing.
The mechanism result stands (the router switches at the right moments,
18 switches, edged on 10/13 resistance turns and 0/7 uptake turns); the
outcome question is simply still open, and it stays open until the
baseline comes off the ceiling.

Two prior signals shape hypotheses only, no more: the confirmatory-grid
interaction bootstrap read negative registers as helping the diligent
profile (+0.167, supported) and hurting the affective-resistant profile
(−0.167, supported), under an overall `instrument_invalid` verdict. Treat
as direction to probe, never as evidence.

## 3. Design

**Arms (three, same worlds, same scenarios, same seeds per row):**

- **A — adaptive-edged.** The Stage-1/2 router, free to choose ironic or
  sarcastic on resistance. `face_threat` stays out of the menu (standing
  simulated-only rule).
- **B — yoked-warm.** The same router runs and detects the same moments,
  but at each moment where it chose an edged register the delivery is
  swapped to the warm register with the same mandated argumentative
  payload. This holds timing and content fixed and varies manner alone —
  the same decomposition move that separated steering from the timed
  challenge in the warrant study.
- **C — router-warm.** The plain warm menu, no yoke. The deployment
  contrast.

A-versus-B prices the edge itself; A-versus-C is the licensing question.
Pinned-sarcastic is dropped: Stage 2 already showed the all-day costume
converts least, and the yoked arm answers the timing-versus-manner
question more directly.

**De-saturating the baseline.** A calibration stage runs the warm router
only, across candidate resistant personas (including the
affective-resistant profile and harder authored variants) and scenarios,
and keeps only persona-scenario cells whose warm conversion lands in a
30–70% corridor. The main block runs only on kept cells. Kill condition:
if no cell lands in the corridor, the study stops with a registered
no-corridor verdict and no main block.

**Endpoints.**

- Primary: post-resistance conversion on the corridor cells,
  adaptive-edged versus router-warm, exact test, powered from the
  calibration rates at registration time.
- Secondary (registered): conversion adaptive-edged versus yoked-warm;
  evidence-uptake within two turns of each switched moment (did the
  learner do the asked public check), coded from the transcript.
- Gates, not endpoints: each edged row counts as evidence for its
  register only if its stance-fidelity gate passes; the manner-presence
  reader runs on every edged turn.
- Harm channel, report-only with a stop rule: the deterministic
  guardrail for person-directed contempt, status-shame threats, and
  coerced uptake runs on every edged slice; any flagged slice pauses the
  run for human review before another dialogue starts.

**Judging.** Sonnet-class judge from the first row (the §8.9 standing
rule); register rubrics unchanged so readings pool with the earlier arcs.

**Stack.** Newest CLI-served models: codex `gpt-5.6-luna` or claude-code
Sonnet 5. Never nemotron/kimi.

## 4. Staging and gates

1. **Stage 0 — build, no paid calls.** The yoked-warm seam (persisted
   assignment, source, replaced router choice, resistance phase — the
   same trace fields the Stage-2 audit fixed), the calibration harness,
   the corridor selector, tests. New cells get fresh IDs checked against
   `config/tutor-agents.yaml` at build time (204/205 are taken).
2. **Stage 1 — calibration pilot (paid).** Warm router only, small n per
   candidate cell, sized in the registration. Kill condition above.
3. **Stage 2 — registration freeze.** Predictions written only from
   calibration evidence (the relay-096 lesson), plan SHA frozen, powering
   computed on the observed corridor rates.
4. **Stage 3 — main block (paid).** Frozen grid, three arms, fail-closed
   report gating on every registered measure, decision keyed to the
   primary contrast only.

Every paid stage needs its own committed GO note plus explicit human
approval; seeds are enumerated against the burned ledger at GO time and
copied, not composed; `npm run archive:runs` after every paid run.

## 5. Claim boundary

Simulated learners throughout; no human-learning claim; no claim that
sarcasm is safe or human-facing. Results land in the negative-register
arc of `docs/research/paper-full-2.0.md` (§6.7's thread), never in a
spin-off first.
