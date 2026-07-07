---
id: character-development-capacity
title: Character-development capacity (learner + tutor) — instrument + run
status: done
type: experiment
priority: P2
owner: codex
source: manual
created: 2026-06-27
updated: 2026-07-01
branch: worktree-character-development
claim_status: scope-bound
verification: "2026-07-01 closeout: characterArc test 5/5; world-018 plotLint PASS and Oedipus screen scoped out of accepted evidence; lint/format pass; paper manifest, atlas, provable-discourse, integrity, and workplan validators have 0 failures; Appendix E.7 claim passes against tracked evidence manifest."
links:
  paper: docs/research/paper-full-2.0.md#e7-character-desire-the-script-outline-as-a-source-of-desire
  notes:
    - CHARACTER-DESIRE.md
  evidence: config/character-development/evidence-manifest-2026-06-28.md
tags:
  - character-desire
  - dramatic-derivation
  - rubric
  - poetics
---

Goal: establish the system's **capacity for character development** for both
bearers (learner and tutor), report on it, and plan deficits. Builds on the
merged character-desire leg (Appendix E.7–E.8; `characterDesire.js`,
`BELIEF-DESIRE-DAG.md`, `CHARACTER-DESIRE.md`). Lands as a new sub-§ extending
Appendix E.7 — single-paper discipline, no spin-off.

Frame (load-bearing): this measures the **dramaturgical form** of character
development legible to a transcript-only critic — never real interior change
(Appendix E.1).

Build:

- [x] **Wire the time-varying character dynamics into the live engine** (closes
      `CHARACTER-DESIRE.md` §8's one open item). A `characterArc` learner layer,
      computed engine-side (needs the secret for proof distance), passed across
      the `learnerView` redaction boundary as public-safe levels + a stance line
      only. Mirrors the `learnerDrift` layer. `--character-arc` flag on the loop
      runner. Tests `tests/dramaticDerivationCharacterArc.test.js` (5, incl. leak
      guard); 33/33 derivation tests green; mock loop runs clean arc on+off.
- [x] **Character-development rubric** (`evaluation-rubric-character-development.yaml`):
      7 dims, whole-transcript, symmetric tutor+learner (L1 desire re-binding,
      L2/T2 disposition arc, L3 self-recognition, T1 model re-binding, T3
      recognition conferral, B1 reversal integrity). Anti-simulation guards per
      dimension. Validated: weights sum 1.000 (learner 0.4 / tutor 0.4 / bilateral 0.2).
- [x] **Phase-0 construct-validity gate** (`scripts/score-character-development.js --gate`,
      exemplars in `config/character-development-gate/`): **PASS** (sonnet critic) —
      earned 71–81 / bare **0** / flat **0**; perfect separation, margin 76.3,
      anti-simulation max(bare) < min(earned). The instrument is not fooled by
      transformation-vocabulary. (`exports/character-development/gate-sonnet.json`)
- [x] **Author + screen a run-grade "character world"**: `world-018-edmund.yaml`
      authored (bell-founding AND-join, mutual reversal, both bearers develop) —
      `plotLint` PASS (S forced t13 ≥ floor 10; mirror never entailed). The paid
      S-underivability (Oedipus) screen is scoped out of this accepted evidence
      package because `world-018` was set aside and the run-grade `world-005-marrick`
      fallback carried the pilot; no additional paid generation is required here.
- [x] **Small attended A/B run** (characterArc on/off on marrick ×2 reps, flash gen,
      sonnet critic): all 4 grounded. **arc_on 25.0 < arc_off 35.6 (Δ−10.6)** —
      the mechanism HURTS, concentrated in its target dims (L1 3v4, L2 2v3); no
      gullibility flags; no literal parroting (0/22). (`exports/character-development/pilot-scores-sonnet.json`)
- [x] **Tutor-side (D3)**: tested via a stake-framed tutor script (`marrick-stakes-v001.md`)
      vs the static-sage baseline. Tutor arc does NOT reliably surface — T2 floored at 1.0
      across 4 episodes. Diagnosis: the no-leak craft discipline crowds out an interior
      stance arc; a tutor arc would need to live in CONDUCT, not framing. (world-018 set
      aside: AND-join secret too mechanism-generic, fails the Oedipus screen.)
- [x] **Learner-side (D1, D2)**: D2 — per-turn `characterArc` injection HURTS → drop it.
      D1 self-recognition floored → **RESOLVED structurally**: the mirror as the learner's
      OWN committed verdict (`--learner-voice` personal stake + self-recog script) lifts L3
      in BOTH judges (final firm-up: Sonnet 1.0→3.0, GPT 1.5→4.5; aggregate GPT
      elicitation-only stayed 2.5→2.5); elicitation alone does not carry the effect.
- [x] **D4 de-confound**: n=4, two judges (Sonnet+GPT), both pass the Phase-0 gate; L3 effect
      direction-robust; overall magnitude judge-sensitive; zero gullibility flags.
- [x] **Capacity report**: ignored/local `exports/character-development/CAPACITY-REPORT.md`
      generated (supersedes PILOT-REPORT.md) and hash-listed in the tracked evidence
      manifest. Paper sub-§ of Appendix E.7 = the narrow judge-robust claim; flash-only
      + one-world limits stand.
- [x] **Paper closeout**: Appendix E.7 now carries only the scoped pilot claim
      (self-recognition unlocks when the mirror is the learner's own prior public
      commitment; no §6 body number, no human-learning claim, no robust magnitude
      claim). Paper bumped to v3.0.176 with Appendix F entry. Evidence package
      boundary tracked in `config/character-development/evidence-manifest-2026-06-28.md`;
      v3.0.184 clarifies that this tracked manifest is the durable evidence pointer.
- [x] **Claim registry**: `paper2.appendix_e.character_development_self_commitment_pilot`
      added to `config/provable-discourse-mechanisms.yaml`. Current audit resolves
      `data/evaluations.db` to the populated shared DB and verifies the Appendix E.7
      claim as evidence-matched against the tracked manifest.

Constraint (2026-06-27): OpenRouter balance ≈ **$9.20** remaining — caps the
pilot; surfaced to the user before spend (`budget_tracker_gap`).

Anti-circularity spine: blind transcript-only critic (G1); structural
ground-truth cross-check (G2); on/off ablation (G3); Phase-0 gate (G4).

Review notes (2026-06-28, Codex): targeted character-arc test passed (5/5);
`world-018-edmund.yaml` plot lint passed; `npm run format:check` and `npm run lint`
passed after formatting `scripts/score-character-development.js`. Remaining review
risk is paper-claim scope/audit, not generation spend.

Closeout notes (2026-07-01, Codex): no further paid generation required. The accepted
claim is scope-bound to Appendix E.7 and passes provable-discourse against
`config/character-development/evidence-manifest-2026-06-28.md`; the raw ignored
`exports/character-development/` bundle is not assumed present in every checkout.
