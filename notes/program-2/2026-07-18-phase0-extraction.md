# Program-2 Phase 0 — extraction report (2026-07-18)

Plan: `PROGRAM-2-FINETUNE-PLAN.md` §8 phase 0. Zero model calls; all content
from sealed events in the checksum-verified Step 4 archive
(`~/.machinespirits-data/step4-claim-runs-2026-07/`, all 80 traces provenance-
stamped `91b8a50e@step4-frozen-isolated`, enforced fail-closed by the
extractor).

## Both phase gates PASS

- **Counts vs plan §4 estimates**: exact, not merely within 20% — 80
  dialogues, 2,076 audited tutor turns, 645 trigger moments, 1,096 accepted
  originals, 980 failed originals, 0 turns missing an original-role model
  call.
- **Leak-filter loss**: 0% (0 positives dropped — every accepted original was
  already leak-clean, as the generation-time guards enforce).

## Datasets (v1) — `~/.machinespirits-data/program-2/datasets/v1/`

| File | Rows | Content |
|---|---|---|
| `taskA-sft.jsonl` | 141 | compliant trigger turns whose ORIGINAL draft was accepted + leak-clean (request → delivered text) |
| `general-sft.jsonl` | 1,096 | all audit-accepted leak-clean original drafts |
| `kto.jsonl` | 2,076 | unpaired labels: 1,096 true / 980 false (failed originals with guard outcome) |
| `eval-moments.jsonl` | 645 | every trigger moment, any historical outcome, with exact request + sealed-trace pointer for the Phase 1/4 graders |
| `splits.json` | 80 | deterministic dialogue-level split, seed 20260718, stratified family × profile |

SHA-256s and full counters: tracked manifest
`config/adaptive-tutor-evidence/program-2-dataset-v1.manifest.json`.

## Design notes recorded at extraction

1. **Original-role requests only.** Training inputs come from the turn's
   `tutor_stub_tutor` model_call (first attempt), never from repair-role
   calls — repair prompts contain repair instructions and would contaminate
   the input distribution. The `nonOriginalDeliveryCompliantTaskA` counter
   (40) is the arithmetic complement: 181 historically compliant trigger
   turns − 40 whose compliant delivery came via repair/fallback = 141 clean
   Task A pairs. Those 40 remain in `eval-moments.jsonl` (evaluation needs
   the moment, not the historical delivery).
2. **Splits**: 64/8/8 dialogues (train/dev/heldout) → Task A moments
   518/66/61; heldout dialogues contribute *all* their turns to eval only.
   Family and profile ride every row for the secondary family-transfer read.
3. **Supplementary sources deferred**: the register-confirmatory and headroom
   tarballs (plan §4) are not in v1 — Task A data exists only in Step 4, and
   the 1,096-positive general pool is already adequate for LoRA SFT. If
   Phase 3 wants a larger general pool, the extractor takes additional roots;
   schema compatibility to be verified then, reported, and the dataset
   version bumped to v2 (new manifest, new hashes).
4. Datasets are machine-local (they contain world content and answer terms);
   the repo tracks only the extractor, this note, and the hash manifest —
   the Step 0.3 packaging convention.

## Next

Phase 1 (floor): untuned base model (+best-effort prompting) measured on dev
+ heldout eval moments, greedy and one sampled config, with the offline
grader built from the frozen detector components. Then the Phase 2 prereg
freeze (thresholds set only after the floor is known); training only after
that freeze and an explicit go.
