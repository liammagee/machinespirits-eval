---
id: guarded-learner-outcome-study
title: Extend the warrant gate to the guarded (defensive) learner
status: active
type: experiment
priority: P2
owner: claude
source: manual
created: 2026-08-15
updated: 2026-08-15
verification: A pilot under its own registration (bare / gated / standing
  arms, guarded persona) reports the registered endpoints — evidence
  production within two turns of a delivered challenge, decision
  correctness, report-only stance table — and a main block runs only if the
  pilot gate passes. Each paid stage needs its own committed GO note plus
  explicit human approval.
claim_status: future
depends_on:
  - adaptive-warrant-outcome-study
links:
  notes:
    - docs/adaptation-refinement/2026-08-15_guarded-learner-extension-plan.md
    - docs/adaptation-refinement/2026-08-13_guarded-bad-learner-draft.md
    - docs/adaptation-refinement/relay/106-human-ruling-guarded-pole-basis-and-contract-v3.3.md
    - docs/adaptation-refinement/relay/107-build-note-v3.3-contract-and-guarded-sensor.md
    - docs/adaptation-refinement/relay/108-build-report-guarded-pole-complete-smoke-c-request.md
    - docs/adaptation-refinement/relay/109-go-smoke-c-guarded-pole.md
    - docs/adaptation-refinement/relay/110-draft-registration-guarded-pilot.md
  paper: §6.25
tags:
  - warrant-gate
  - adaptive
  - outcome
---

The warrant arc closed on the passive pole (§6.25): the always-on steering
line carried the deference-break change, the timed challenge family paid
~12 points of decision correctness, and the standing wording alone
delivered zero challenges. This card carries the same gate to the opposite
pole — a learner who over-claims and defends instead of deferring.

Plan (see the linked extension plan): amend the semantic event contract to
v3.2 with three defensive events (over-claim assertion, evidence dismissal,
evidence demand), thread a learner-profile argument through the sealed
warrant runners instead of forking them, add the typed move menu plus
concession guard, and arm the sensor on consecutive defended over-claim
turns. The passive endpoints do not transfer: the primary conduct endpoint
becomes evidence production within two turns of a delivered challenge,
with decision correctness unchanged and the stance table report-only in
the pilot. Predictions get written from pilot evidence only.

**Build complete, 15 August (relay 108).** All four items landed on
`build/guarded-learner-v3.3` in `../ms-guarded-learner`, zero paid calls:
contract v3.3 with the three defensive acts and the preference rule
(`124294c1`), `--learner-profile` on the three sealed runners
(`b7a52752`), and the typed move menu plus concession guard
(`b79c413a`). Hermetic suite 8,719 pass; the only 3 failures are
derivation byte contracts that fail on the branch base too. All four
sealed A1 pins and both reader-script pins re-hash byte-identical.

**Smoke C PASSED, 15 August (GO note relay 109, approval quoted).**
Seed 550, 8 turns, sealed, inside the 30-call budget, archived to the
private repo. The sensor armed at three consecutive defended over-claim
turns (N = 3) and the gate delivered a challenge at turns 3 and 5; after
each, the learner's bounded evidence move closed the contract and the
gate returned to staging. The concession guard fired 0 of 8 turns.
Finding: the evidence-demand act stayed dark — demand-like turns were
read as the older proposed-test act (neutral direction, not the smoke B
deferral failure).

**Pilot registration DRAFTED (relay 110), awaiting human review.**
18 dialogues (3 arms x 2 worlds x 3 seeds), guarded persona, ~1,116
calls; primary endpoint is evidence production within two turns of a
delivered challenge; stop rules cover the dark instrument, the harmful
deferral mislabel (terminal), and persona collapse. Seeds get pinned in
the GO note. The pilot still needs registration approval plus its own
GO note before any paid call.

Both rulings landed on 15 August (relay 106): defended over-claiming is
its own warrant basis, criterion (c) keeps its §6.25 reading, and the
contract amendment (numbered v3.3 — v3.2 was already live from relay
032) is approved. Build work may start: contract amendment plus focused
tests, runner parameterization, the move menu and concession guard,
then smoke C on a fresh seed with mock readers. No paid call inherits
the closed warrant campaign's authorization; the pilot needs its own
registration and GO note.
