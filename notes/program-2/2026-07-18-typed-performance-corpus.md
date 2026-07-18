# Program-2 — typed-performance SFT corpus v1 (2026-07-18)

Engineering-tier dataset build, outside the paper's claim set. Zero model
calls; every pair is a recorded, audit-accepted performance from the merged
preconscious record. Extractor:
`scripts/program2-extract-typed-performance-corpus.mjs`; tracked manifest:
`config/adaptive-tutor-evidence/program-2-corpus-v1.manifest.json`; dataset
files land in `exports/program2-corpus/` (untracked per the exports/
convention — machine-local, mirroring the Step 0.3 packaging rule).

## Sources → pairs (per-source counts)

| Source | Pairs | Train | Held-out | Prompt tokens | Completion tokens |
|---|---:|---:|---:|---:|---:|
| Step 4 claim-run accepted originals (world_005_marrick) | 1,096 | 1,096 | 0 | 6,468,822 | 94,004 |
| V17 character-generalization passing repertoire | 15 | 12 | 3 | 100,216 | 1,124 |
| V52 accepted Tallow compiled-entry draws | 2 | 2 | 0 | 4,516 | 172 |
| V53 accepted Tallow working-confirmation draws | 3¹ | 3 | 0 | 6,774 | 255 |
| Campaign-fixture compiled-entry originals (nocturne) | 3 | 3 | 0 | 5,289 | 234 |
| **Total SFT pairs** | **1,119** | **1,116** | **3** | 6,585,617 | 95,789 |

¹ V53's home cell accepted 4/4 draws; two were byte-identical (prompt and
candidate), so one deduplicates. Reported, not silent.

Auxiliary (not SFT pairs): `aux-register-frames.jsonl` — 4,697 raw
register→outcome frames from the two register-confirmatory runs
(terra + sonnet5), pairing turn-t `responseConfiguration` + classification
with turn-t+1 `previousRegisterEfficacy` via `registerTurn`. Raw recorded
fields only; no scoring weights re-derived. (The historical 8,990-observation
priors sweep covered additional roots; this set is deliberately restricted to
the two sealed confirmatory runs.)

## Split — by world, exactly mirroring V53's transfer matrix

- **Held-out worlds** (zero training rows, asserted): `world_009_ravensmark`,
  `world_026_skyway_bakery`, `world_022_foxtrot_jukebox`.
- **Train**: everything else — `world_025_tallow_street` (Tallow family),
  `world_005_marrick`, `world_008_sealhouse`, `world_010_hethel_resistant`,
  `world_016_ai_syllabus_af1`, `world_001_nocturne`.
- The extractor asserts the V53 artifact realizes this exact matrix (home
  cell 4/4 accepted, the three transfer cells 0/1) before writing anything.
- Consequence with teeth: V17's `foxtrot_false_memory` accepted turns (3) go
  to `sft-heldout.jsonl`, not train.
- `heldout-eval-contexts.jsonl` carries V53's three transfer-cell **exact
  recorded requests** plus the saved rejected drafts and their failure
  clusters (`not_for_training: true`) — the Task B eval side, reconstructed
  from the sealed record.

## Pair format

`{prompt, completion}` plus the verbatim recorded `request`
(systemPrompt/messages), world, persona, family, turn/draw ids, typed-contract
metadata where the source carries it (firstDraftContract schema, selected
performance, response-configuration axes, obligation ids), and a provenance
pointer. `prompt` is a flat rendering of the exact recorded request
(`prompt_profile: recorded_request_*`); fixture rows are rendered from the
frozen bundle (`fixture_bundle_render_v1`). Token totals use the house
estimator `utf16-code-units-div-4-ceiling-v1`.

## Acceptance and hygiene rules

1. **Original channel only.** `guarded_original_accepted` turns (Step 4, V17),
   `joint_performance_original_composition` draws with `audit.ok` (V52/V53),
   `original_candidate` fixture entries. Repair/recovery/fallback texts are
   excluded everywhere — the plan prohibits training toward the documented
   repair-style regression.
2. **Leak-clean.** Original and delivered leak audits must not be false
   (0 rows dropped — generation-time guards already enforced this).
3. **Fail-closed provenance.** Step 4: per-trace git SHA prefix `91b8a50e` +
   archive launch-plan SHA must equal the tracked
   `exports/tutor-stub-step4-claim-runs/launch-plan.json`. V17: per-cell
   `run-seal.json` inventory SHA over the sealed trace + uniform checkout SHA
   `b02e3fac…`. V52/V53: `working-screen-result.json` SHA-256 must equal the
   values frozen in the dated status notes.
4. **Dedup** by (prompt, completion) hash across the whole corpus (1 drop).
5. Determinism verified: rerun is byte-identical; split purity asserted
   (0 held-out-world rows in train); no completion appears inside its own
   prompt.

## Design notes

- Step 4 / V17 prompts are the **full recorded interface** (apparatus sections
  included), V52/V53 prompts are the compact no-source speaking prompt — the
  `prompt_profile` field marks the difference so training runs can filter or
  stratify. This preserves the plan's identical-interface principle rather
  than inventing a new serializer.
- V52/V53 completion channel: those requests ask for a structured JSON
  first-draft; the accepted `candidate` stored in the sealed turn artifact is
  the **deterministically composed public text** from that JSON
  (`joint_performance_original_composition` — the raw JSON is not in the
  artifact). The 5 rows are exact (request → accepted delivered turn) pairs,
  but a run training on them as-is teaches composed-text output against a
  JSON-shaped instruction tail; filter by `prompt_profile` or strip the
  transport tail if that mismatch matters to the training objective.
- The held-out side is deliberately thin on positives (3 V17 foxtrot pairs):
  Ravensmark and Skyway have **no accepted first drafts anywhere in the
  record** — that is the V53 wall itself. Held-out evaluation therefore runs
  on the eval-context requests against the frozen deterministic auditors, not
  on reference completions.
- 42 of 45 fixture candidates are rejected originals or repair-channel texts
  and are excluded by rule; the 2 single-specimen regression fixtures
  (known-miss / auditor-evolution pins) are skipped by schema.

## Next

Show sample pairs, then nothing trains on this until the Phase 2 prereg
freeze and an explicit go (plan §8). If Task B training is licensed, the
train side supports SFT with loss on completion tokens only; the register
frames are an optional conditioning aid, not part of the pair set.
