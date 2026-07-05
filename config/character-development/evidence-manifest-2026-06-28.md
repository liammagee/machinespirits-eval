# Character-development evidence manifest

Date: 2026-06-28
Branch: worktree-character-development
Base commit: 696c2ee73b11f9703f07fbc883ff65b55a231871

This manifest packages the character-development closeout while keeping the
repo's normal artifact boundary: generated transcripts, score JSON, and raw run
payloads stay under ignored `exports/`, while the source, scorer, rubric, tests,
paper prose, and this manifest are tracked.

## Scope

Intentional source/config/test changes:

- `scripts/run-derivation-loop.js`
- `services/dramaticDerivation/characterDesire.js`
- `services/dramaticDerivation/engine.js`
- `services/dramaticDerivation/index.js`
- `services/dramaticDerivation/llmRoles.js`
- `config/character-development-gate/exemplars.yaml`
- `config/drama-derivation/tutor-scripts/marrick-selfrecog-v001.md`
- `config/drama-derivation/tutor-scripts/marrick-stakes-v001.md`
- `config/drama-derivation/world-018-edmund.yaml`
- `config/evaluation-rubric-character-development.yaml`
- `scripts/score-character-development.js`
- `tests/dramaticDerivationCharacterArc.test.js`
- `workplan/items/character-development-capacity.md`

Local evidence package:

- Path: `exports/character-development/`
- Files: 75
- Bytes: 12,584,140
- Status: ignored by `.gitignore`, retained locally; hashes below support
  reconstruction/checking without force-adding the raw bundle.

Out of scope for this package:

- `.codex/config.toml` local shell/agent environment settings.
- `.agents/skills/ms-theory-synthesis/` local mirrored skill material.
- `.claude/settings.local.json`, `data/evaluations.db`, `tutor-core/data/`,
  `tutor-core/logs/`, and other ignored local runtime state.

## Claim summary

These are scoped pilot claims for Appendix E only. They are not Paper 2.0 body
claims, not `evaluation_results` rows, and not human-learning evidence.

- Instrument gate: the character-development rubric passed the Phase-0
  construct-validity gate under both Sonnet and GPT critics. Earned exemplars
  scored 71-81, bare transformation-talk exemplars scored 0-5, and flat
  exemplars scored 0; `max(bare) < min(earned)` held for both judges.
- Mechanism negative: per-turn `characterArc` stance injection did not improve
  character development in the marrick pilot; under the Sonnet critic, `arc_on`
  scored lower than `arc_off` (25.0 vs 35.6 overall).
- Tutor-side negative: a stake-framed tutor script did not make a tutor
  disposition arc legible; T2 remained floored at 1.0 across four tutor-side
  pilot episodes.
- Learner-side positive: in the final firm-up contrast on `world-005-marrick`
  (Gemini Flash generation; two elicitation-only episodes and two
  personal-commitment episodes, scored by Sonnet and GPT), self-recognition
  became legible only when the false mirror was the learner's own prior public
  commitment. In this final slice, L3 moved from 1.0 to 3.0 under Sonnet and
  from 1.5 to 4.5 under GPT. In the aggregate capacity table, elicitation alone
  did not move GPT L3 (2.5 -> 2.5) and only weakly moved Sonnet L3.
- Guardrail: the defensible paper claim is the L3-specific directional contrast
  above. Absolute overall magnitude is judge-sensitive and should not be cited
  as a robust effect size.

## Primary evidence hashes

```text
5d1e705b38a4b7c22c4d99c5706a13c30464d2b2e75756b1d77a9a41b855651f  exports/character-development/CAPACITY-REPORT.md
1aeb2cd0baab459037b4b7d8ccfadb296fb5f15bfe825da615ad82d429350071  exports/character-development/PILOT-REPORT.md
984efb7270e4453a6f21a89720107ad9d2e4f3ae20f926cac17ed950877bae24  exports/character-development/crossjudge-gpt.json
f2078e791a34f86707889e9042e26a523f0b865b4162445804ddcb799f0d1259  exports/character-development/firmup-gpt.json
e04a95f1c562e3512d0f5d08ceb10e4cbc2d54b8ec67af33ed9efd7e09736af9  exports/character-development/firmup-sonnet.json
68f3a9b3f8ff465e37148fcfab8ca836ec58700247ceaad31423559feecb36bf  exports/character-development/gate-gpt.json
40733aab2e90239ba7ddd71f894582d67070d3914be757518808aedf0aa66e4f  exports/character-development/gate-sonnet.json
8bc0ed7707e50c30edfd8a515107f9329f7f7f80308691ab0cefc85905130e2e  exports/character-development/pilot-scores-sonnet.json
db5b3fb2da23040a99086c0487fa94e51fd7767fc7c06941a176e4c177116214  exports/character-development/selfcommit-scores.json
b57b0dde049180945266b06bac83cdceb9972a53c949d9accd651bd0c8828b53  exports/character-development/selfrecog-scores.json
16d2e79416a19dbf03abc52beb32fe3367a6708fe5ce067ca9ae30aa1762b191  exports/character-development/tutor-pilot-scores.json
```

## Local raw run directories

These directories contain ignored `diagnosis.json`, `live.json`, `result.json`,
and `transcript.md` files for the pilot episodes:

- `exports/character-development/pilot/marrick-arcoff-r1/`
- `exports/character-development/pilot/marrick-arcoff-r2/`
- `exports/character-development/pilot/marrick-arcon-r1/`
- `exports/character-development/pilot/marrick-arcon-r2/`
- `exports/character-development/tutor-pilot/marrick-selfcommit-r1/`
- `exports/character-development/tutor-pilot/marrick-selfcommit-r2/`
- `exports/character-development/tutor-pilot/marrick-selfcommit-r3/`
- `exports/character-development/tutor-pilot/marrick-selfcommit-r4/`
- `exports/character-development/tutor-pilot/marrick-selfrecog-r1/`
- `exports/character-development/tutor-pilot/marrick-selfrecog-r2/`
- `exports/character-development/tutor-pilot/marrick-selfrecog-r3/`
- `exports/character-development/tutor-pilot/marrick-selfrecog-r4/`
- `exports/character-development/tutor-pilot/marrick-tutorbase-r1/`
- `exports/character-development/tutor-pilot/marrick-tutorbase-r2/`
- `exports/character-development/tutor-pilot/marrick-tutorstake-r1/`
- `exports/character-development/tutor-pilot/marrick-tutorstake-r2/`
