---
id: register-taxonomy-negative-registers
title: Implement register taxonomy and negative-register evaluation
status: active
type: experiment
priority: P1
owner: codex
source: manual
created: 2026-07-02
updated: 2026-07-02
verification: Registry/rubric/cell/reporter tests pass, cells 196-198 validate, no-paid stage-0 checks pass, and paid smoke/full run IDs are recorded with register-specific results.
claim_status: planned
links:
  notes:
    - notes/2026-07-02-register-taxonomy-and-negative-registers-plan.md
tags:
  - registers
  - id-director
  - charisma
  - negative-registers
  - evaluation
branch: codex/register-taxonomy-negative-registers
---

Implement the six-step plan from the register taxonomy note: make tutor registers first-class registry objects, add a generic register-score channel, author an irony/sarcasm rubric, add arm-assigned ironic and sarcastic challenge cells, extend the local reporter, and run the no-paid checks before deciding whether the 15-row smoke and larger evaluation are warranted.

Acceptance:

- Existing engagement-router decisions remain bit-identical for the current positive registers.
- Negative registers are not organically router-selectable; they are available only as experiment-assigned arms.
- Register-specific scoring persists in a generic channel rather than cloning charisma-specific DB columns.
- Cells 196, 197, and 198 are registered in `config/tutor-agents.yaml` and `EVAL_ONLY_PROFILES`.
- The breakthrough reporter can compare charismatic, ironic, sarcastic, and simulated-only face-threat arms on the same gated resistance slices.
- Paid runs, if performed, are recorded here with run IDs and the bounded claim they support.

2026-07-02 Codex: Started implementation on `codex/register-taxonomy-negative-registers` from the committed design note.

2026-07-02 Codex: Implementation and no-paid checks are complete: registry/router extraction, generic register-score channel, irony/sarcasm rubric, cells 196-197, reporter support, config validation, and focused/full tests pass. Paid smoke was attempted twice: `eval-2026-07-02-80877f67` failed before API calls because the fresh worktree lacked `.env`; `eval-2026-07-02-6c4ea942` reached provider calls after copying `.env` but hung on the first cell-193 row after repeated empty-content/length retries and was marked failed with zero result rows. No full evaluation was run because the 15-row smoke did not produce usable evidence.

2026-07-02 Codex: Ran a successful Codex-provider smoke after the OpenRouter stack proved unsuitable for this worktree: one-row canary `eval-2026-07-02-5d9fd269` passed, then 15-row smoke `eval-2026-07-02-cfed3b13` passed generation gates 15/15 with `codex.gpt-5.5` overrides. Tutor-only v2.2 scoring succeeded 15/15 (mean tutor score 90.8; recognition_quality all-turn means: charismatic 4.67, ironic 4.60, sarcastic 4.53; last-turn means: 5.00, 4.80, 4.80). Generic register-rubric scoring succeeded 24/24 with `openrouter.gpt-mini`. Breakthrough matrix report at `exports/charisma-desire-breakthrough-matrix-summary.md` found route/gate hits 15/15, positive local outcomes 15/15, and mean register scores: charismatic 46.3, ironic 57.3, sarcastic 71.8. Did not scale to a full evaluation because the smoke did not show the pre-registered negative-register recognition-cost/depressed-uptake pattern; it looks like a gullibility/instrument issue to inspect before paying for more rows, and the question-flood commitment-probe gate remains pending.

2026-07-02 Codex: Follow-up from smoke interpretation: split the negative-register family into Socratic irony (`ironic_challenge`), dry sarcastic edge (`sarcastic_challenge`), and a simulated-only face-threat stress arm (`face_threat_challenge`, cell 198). Rubric v1.1 adds uptake freedom and post-turn face repair so a correct learner answer no longer hides coerced compliance or social narrowing. Reporter now surfaces register recognition, uptake freedom, and face-repair dimensions beside the overall register score.

2026-07-02 Codex: Paid four-arm smoke `eval-2026-07-02-e511f92c` completed generation 20/20 with `codex.gpt-5.5` tutor and learner overrides across cells 193, 196, 197, and 198 on the five controlled resistance-breakthrough scenarios. Tutor-only v2.2 guardrail scoring succeeded 20/20 with mean 90.3; arm means were router_boredom_stake 90.8, ironic_challenge 90.5, sarcastic_challenge 91.4, and face_threat_challenge 88.5. Last-turn recognition_quality means were 4.8, 5.0, 5.0, and 4.4 respectively. Generic register-rubric scoring succeeded 34/34 with `openrouter.gpt-mini`; slice-weighted means were router_boredom_stake 46.3, ironic_challenge 48.0, sarcastic_challenge 48.0, and face_threat_challenge 52.0, with social dimensions for face_threat_challenge at recognition_cost 3.1, uptake_freedom 4.1, and post_turn_face_repair 2.3. The regenerated matrix report found 11/20 candidate breakthroughs and 18/20 positive local outcomes; its row-weighted arm means were router_boredom_stake 46.3, ironic_challenge 48.0, sarcastic_challenge 48.0, and face_threat_challenge 54.4. Bounded interpretation: negative registers remain pedagogically viable in the transcripts and v2.2 guardrail, but face-threat shows measurable recognition/face-repair cost and should remain simulated-only; do not scale a full paid run until the register rubric's compressed score band and the residual question-flood commitment gate are tightened.
