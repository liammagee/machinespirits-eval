# Program-2 — typed-performance SFT corpus (2026-07-18; **v2 current**)

Engineering-tier dataset build, outside the paper's claim set. Zero model
calls; every pair is a recorded, audit-accepted performance from the merged
preconscious record. Extractor:
`scripts/program2-extract-typed-performance-corpus.mjs`; tracked manifest:
`config/adaptive-tutor-evidence/program-2-corpus-v2.manifest.json` (v1
manifest retained beside it as the record of the superseded build). Dataset
files land in `exports/program2-corpus/` (untracked per the exports/
convention — machine-local, mirroring the Step 0.3 packaging rule).

## v1 → v2 changelog (same day, pre-training revisions)

1. **Primary format is now a compact typed-slot render** (the V53 screen's
   shape): one-voice header, world/persona conditioning (world title +
   public question from the in-repo world YAMLs), public dialogue history,
   evidence window, selected axes, and an UPTAKE/PERFORMANCE/HANDOFF turn
   plan. Slot values come from each turn's own recorded typed records —
   `classification.turn` (learner move), `responseConfiguration` (six axes),
   `dramaticRelease.frame.entries` (newly due public surfaces, `via: tutor`),
   `pointOfAction.assigned_trigger` (Task A moments), and for fixtures the
   frozen `firstDraftContract` fields. Nothing is re-derived from the
   completion. The v1 full-recorded-request rendering ships as a secondary
   variant file pair. V52/V53 rows keep their native recorded compact
   requests in both files (they already are the target format).
2. **Originals-only filter made explicit and audited** (it was already
   enforced in v1): completions are accepted ORIGINAL turns only; excluded
   post-repair/fallback delivered turns are now counted per source per guard
   outcome (table below).
3. **Leakage audit added**: all TRAIN prompts and completions in both
   formats are scanned for held-out world names and world-specific
   vocabulary. **Result: 0 hits across 61 terms.**
4. Report and manifest now carry pairs + token totals per source per format
   per split.
5. `TRAINER-NOTES.md` ships with the corpus: completion-only loss
   (prompt-masked SFT) is REQUIRED.

## Counts — pairs and token totals (per source, per format, train vs held-out)

Tokenizer: `utf16-code-units-div-4-ceiling-v1` (house estimator). Pairs are
identical across formats (same completions, same split); only prompts differ.

| Source | Pairs | Train | Held-out | Compact prompt tok (train / held-out) | Full-apparatus prompt tok (train / held-out) | Completion tok (train / held-out) |
|---|---:|---:|---:|---|---|---|
| Step 4 accepted originals (marrick) | 1,096 | 1,096 | 0 | 2,792,228 / 0 | 6,468,822 / 0 | 94,004 / 0 |
| V17 character-generalization repertoire | 15 | 12 | 3 | 15,348 / 2,695 | 80,961 / 19,255 | 898 / 226 |
| V52 accepted Tallow compiled-entry draws | 2 | 2 | 0 | 4,516 / 0 | (native compact) | 172 / 0 |
| V53 accepted Tallow working-confirmation draws | 3¹ | 3 | 0 | 6,774 / 0 | (native compact) | 255 / 0 |
| Campaign-fixture compiled-entry originals (nocturne) | 3 | 3 | 0 | 4,073 / 0 | (fixture render) | 234 / 0 |
| **Total** | **1,119** | **1,116** | **3** | **2,822,939 / 2,695** | **6,565,146 / 19,255** | **95,563 / 226** |

¹ V53's home cell accepted 4/4 draws; two were byte-identical, one
deduplicates (reported in counters, both formats).

Compact train-prompt profile: mean ≈ 2.5k tokens, median ≈ 2.6k; the tail
(max ≈ 5.2k) is long marrick public histories, preserved exactly rather than
truncated. The compact re-render cuts step4 prompt mass 6.47M → 2.79M tokens
(−57%) while keeping every slot value recorded.

## Originals-only filter — excluded delivered turns per source

Per the blind-review finding (§6.18: repaired deliveries read WORSE than the
rejected originals), no post-repair or fallback delivered text enters any
completion. Excluded counts:

| Source | Excluded (by recorded outcome) |
|---|---|
| Step 4 | 284 `guarded_model_repair_accepted`, 696 `guarded_deterministic_fallback` |
| V17 | 16 `guarded_policy_repair_accepted`, 2 `guarded_actorial_part_repair_accepted`, 2 `guarded_deterministic_fallback`, 1 `guarded_question_support_repair_accepted` |
| V52 | 0 |
| V53 | 3 rejected originals (the transfer cells — retained as held-out eval contexts, never as pairs) |
| Campaign fixtures | 14 rejected originals, 27 repair/recovery/fallback-channel candidates, 1 original rejected by the current auditor |

Repaired/fallback prior turns DO appear inside public histories on the
prompt side — that is what the learner actually saw; history is context,
never a training target (see TRAINER-NOTES.md: prompt tokens are masked).

## Leakage audit — 0 hits

- **Terms** (61): core = held-out world-name tokens (`ravensmark`, `skyway`,
  `bakery`, `foxtrot`, `jukebox` — checked even though some are dictionary
  words), plus auto-extracted invented particulars: tokens in the
  Ravensmark/Skyway/Foxtrot world YAMLs appearing in no train-world YAML,
  no system dictionary (light stemming + irregular-verb set, so "answered"/
  "earlier"/"held" don't false-positive), no contractions, no
  dictionary-pair hyphen compounds. Surviving terms are real world
  particulars: `hessa`, `tibbin`, `corvin`, `brindlecliff`, `leadenhall`,
  `pipersgullet`, `wipepulse`, `sealpress`, `mixtape`, `gatepass`, smushed
  fact-token ids (`shutterboltedsincefrost`, …).
- **Scan**: word-boundary, case-insensitive, over every TRAIN prompt and
  completion in BOTH formats (interiors and exemplars included by
  construction — the whole prompt string is scanned).
- **Result: 0 hits.** Dictionary provenance (path + SHA-256) recorded in the
  manifest; term sample retained in the report.

## Split — by world, exactly mirroring V53's transfer matrix (unchanged)

Held-out (zero training rows, asserted): `world_009_ravensmark`,
`world_026_skyway_bakery`, `world_022_foxtrot_jukebox`. Train: tallow,
marrick, sealhouse, hethel-resistant, ai-syllabus, nocturne. V17's
`foxtrot_false_memory` accepted turns go to held-out. The extractor asserts
the V53 artifact realizes the matrix (home 4/4, transfer cells 0/1) before
writing. `heldout-eval-contexts.jsonl` carries the three transfer-cell exact
requests + saved rejected drafts (`not_for_training: true`) — held-out
evaluation runs the frozen deterministic auditors over these, since
Ravensmark/Skyway have no accepted first drafts anywhere in the record (the
V53 wall itself).

## Files

| File | Rows | Role |
|---|---:|---|
| `sft-train.compact.jsonl` / `sft-heldout.compact.jsonl` | 1,116 / 3 | PRIMARY typed-slot format |
| `sft-train.full-apparatus.jsonl` / `sft-heldout.full-apparatus.jsonl` | 1,116 / 3 | secondary variant (v1 rendering) |
| `heldout-eval-contexts.jsonl` | 3 | V53 transfer-cell requests + rejected drafts |
| `aux-register-frames.jsonl` | 4,697 | aux register→outcome frames (not SFT pairs) |
| `samples.json` | 5 | one compact pair per source |
| `TRAINER-NOTES.md` | — | completion-only loss REQUIRED + handling rules |
| `extraction-report.json` | — | counts, exclusions, leakage, SHA-256s |

Rows carry `{prompt, completion}` plus the structured request
(systemPrompt/messages), world, persona, family, turn/draw ids, trigger,
`completion_channel`, typed-contract metadata, and provenance pointers.
`prompt_profile` distinguishes `compact_typed_slot_render_v2` (re-rendered),
`recorded_request_compact_no_source_v1` (V52/V53 native),
`recorded_request_full_apparatus_v1` (variant), and
`fixture_bundle_render_v2`.

## Hygiene (verified on the final build)

Fail-closed provenance unchanged from v1 (step4 SHA prefix + exports
launch-plan parity; V17 run-seal inventory + uniform checkout SHA; V52/V53
frozen working-result SHAs). Deterministic: rerun byte-identical. Split
purity: 0 held-out-world rows in either train file. No completion appears
inside its own prompt. V52/V53 completion channel remains
`composed_public_text` (request tail asks for JSON; the sealed artifact
stores the deterministically composed public text — filter by
`prompt_profile` or strip the tail if the mismatch matters).

## Next

Nothing trains on this corpus before the Phase 2 prereg freeze and an
explicit go (plan §8). Training runs must follow TRAINER-NOTES.md:
prompt-masked SFT, loss on completion tokens only, compact files as primary,
full-apparatus files for ablation only.
