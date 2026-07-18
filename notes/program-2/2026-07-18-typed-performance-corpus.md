# Program-2 — typed-performance SFT corpus (2026-07-18; **v2 + faithfulness gate**)

Engineering-tier dataset build, outside the paper's claim set. Zero model
calls; every pair is a recorded, audit-accepted performance from the merged
preconscious record. Extractor:
`scripts/program2-extract-typed-performance-corpus.mjs`; tracked manifest:
`config/adaptive-tutor-evidence/program-2-corpus-v2.manifest.json` (v1
manifest retained beside it as the record of the superseded build). Dataset
files land in `exports/program2-corpus/` (untracked per the exports/
convention — machine-local, mirroring the Step 0.3 packaging rule).

## v1 → v2 changelog (same day, pre-training revisions)

1. **Primary format is a compact typed-slot render** (the V53 screen's
   shape): one-voice header, world/persona conditioning (world title +
   public question from the in-repo world YAMLs), public dialogue history,
   evidence window, selected axes, and an UPTAKE/PERFORMANCE/HANDOFF turn
   plan. Slot values come from each turn's own recorded typed records —
   `classification.turn`, `responseConfiguration`,
   `dramaticRelease.frame.entries` (newly due public surfaces),
   `pointOfAction.assigned_trigger`, and for fixtures the frozen
   `firstDraftContract` fields. Nothing is re-derived from the completion.
   The v1 full-recorded-request rendering ships as a secondary variant file
   pair; V52/V53 rows keep their native recorded compact requests.
2. **Originals-only filter, audited per source** (table below).
3. **Leakage audit**: 0 hits across 61 held-out-vocabulary terms.
4. Report and manifest carry pairs + token totals per source per format per
   split.
5. `TRAINER-NOTES.md` ships with the corpus: completion-only loss
   (prompt-masked SFT) is REQUIRED.
6. **Faithfulness gate** (this revision): every pair's completion replayed
   against its own derived slot contract with the frozen deterministic
   audits; matched hard-failures dropped; fixed-seed shuffle control; both
   rates in the manifest. The POINT OF ACTION trigger line is now rendered
   ONLY when the turn's recorded compliance verdict was true (215
   over-claiming lines suppressed relative to the pre-gate v2 render).

## Faithfulness gate — matched replay + shuffle control

**Instrument** (SHA-256s in the manifest): the frozen deterministic audits at
this repo state — `auditTutorStubResponseConfiguration` (terminal 6-axis
realization, the V-series "configuration realization" gate metric),
`auditTutorStubPointOfActionCompliance` (`step4-frozen-2026-07-14.v1`:
exactly-one-question + warrant cue + no new premise), dictated-sentence
exactness for V52/V53 host plans, fixture write-prefix. Shuffle control:
completion re-scored against a different pair's contract (seed 20260718,
permuted within source×kind buckets; completion-side turn facts never swap).

**Target check: MET.** Matched hard-pass excluding dictated pairs =
**0.9991** (≥0.95). One pair failed and was dropped
(`v17 sealhouse_slow` turn 4: selected actorial part/tactic not realized
under the terminal instrument — invented conditioning under the terminal
audit, even though the looser V17-era audit accepted it). Post-drop shipped
corpus is 100% hard-pass by construction. Dictated pairs (V52/V53), reported
separately: 5/5 matched, dictated-sentence recall 1.0.

| Binding channel | Matched | Shuffled | Reads |
|---|---:|---:|---|
| step4 trigger compliance (141 trigger-line pairs) | 1.000 | 0.376 | binds hard |
| step4 due-evidence delivery (mean, pairs with due surfaces) | 0.923 | 0.000 | binds hard |
| v17 actorial realization (15 part-selected pairs) | 0.933 | 0.533 | binds |
| v17 scene immersion visibility (cross-world shuffles) | 1.000 | 0.467 | binds |
| step4 action-family visibility | 0.744 | 0.651 | modest |
| step4 mean realization rate | 0.700 | 0.678 | flat — see below |

Calibration: trigger replay agreement with the recorded
`point_of_action_compliance` verdicts = 141/141. Replayed realization mean
0.703 vs recorded 0.801 over 1,111 turns — expected offset: the recorded
audits used the generation-time 5-axis schema; the replay uses the terminal
6-axis instrument (null actorial part scores not-visible, capping step4 at
5/6).

**Why the flat stance/register/lexical margins are NOT invented
conditioning**: only 7.4% of step4 shuffles land on an identical contract,
and restricting to genuinely differing contracts barely moves the rates —
those axis values (plain / domain_apprentice / standard / immersive) are
near-constant across the bland-policy step4 source, so no within-source
shuffle can discriminate on them. Matched faithfulness (0.9991) is what
rules out invention; binding is carried by the channels whose values vary
(trigger, due evidence, actorial part, world/scene). Recorded verbatim in
the manifest's `faithfulnessGate.interpretation`. Dictated/fixture shuffle
buckets are flagged degenerate (identical contracts within bucket).

## Counts — pairs and token totals (post-gate; per source, per format, train vs held-out)

Tokenizer: `utf16-code-units-div-4-ceiling-v1`. Pairs are identical across
formats; only prompts differ.

| Source | Pairs | Train | Held-out | Compact prompt tok (train / held-out) | Full-apparatus prompt tok (train / held-out) | Completion tok (train / held-out) |
|---|---:|---:|---:|---|---|---|
| Step 4 accepted originals (marrick) | 1,096 | 1,096 | 0 | 2,781,300 / 0 | 6,468,822 / 0 | 94,004 / 0 |
| V17 character-generalization repertoire | 14¹ | 11 | 3 | 14,280 / 2,695 | 74,269 / 19,255 | 804 / 226 |
| V52 accepted Tallow compiled-entry draws | 2 | 2 | 0 | 4,516 / 0 | (native compact) | 172 / 0 |
| V53 accepted Tallow working-confirmation draws | 3² | 3 | 0 | 6,774 / 0 | (native compact) | 255 / 0 |
| Campaign-fixture compiled-entry originals (nocturne) | 3 | 3 | 0 | 4,073 / 0 | (fixture render) | 234 / 0 |
| **Total** | **1,118** | **1,115** | **3** | **2,810,943 / 2,695** | **6,558,454 / 19,255** | **95,469 / 226** |

¹ 15 accepted originals; 1 dropped by the faithfulness gate (above).
² 4/4 accepted draws; two byte-identical, one deduplicates (reported).

## Originals-only filter — excluded delivered turns per source

Per the blind-review finding (§6.18: repaired deliveries read WORSE than the
rejected originals), no post-repair or fallback delivered text enters any
completion:

| Source | Excluded (by recorded outcome) |
|---|---|
| Step 4 | 284 `guarded_model_repair_accepted`, 696 `guarded_deterministic_fallback` |
| V17 | 16 `guarded_policy_repair_accepted`, 2 `guarded_actorial_part_repair_accepted`, 2 `guarded_deterministic_fallback`, 1 `guarded_question_support_repair_accepted` |
| V52 | 0 |
| V53 | 3 rejected originals (transfer cells — retained as held-out eval contexts only) |
| Campaign fixtures | 14 rejected originals, 27 repair/recovery/fallback-channel candidates, 1 original rejected by the current auditor |

Repaired/fallback prior turns DO appear inside public histories on the
prompt side — that is what the learner actually saw; history is context,
never a training target (prompt tokens are masked, TRAINER-NOTES.md).

## Leakage audit — 0 hits (61 terms)

Core terms = held-out world-name tokens (`ravensmark`, `skyway`, `bakery`,
`foxtrot`, `jukebox`); auto terms = dictionary-stemmed invented particulars
from the held-out world YAMLs (`hessa`, `tibbin`, `brindlecliff`,
`pipersgullet`, `wipepulse`, …). Word-boundary scan over every TRAIN prompt
and completion in both formats. Dictionary provenance in the manifest.

## Split — by world, exactly mirroring V53's transfer matrix (unchanged)

Held-out (zero training rows, asserted): `world_009_ravensmark`,
`world_026_skyway_bakery`, `world_022_foxtrot_jukebox`; V17's foxtrot
repertoire is held-out. The extractor asserts the V53 artifact realizes the
matrix before writing. `heldout-eval-contexts.jsonl` carries the three
transfer-cell exact requests + saved rejected drafts
(`not_for_training: true`); held-out evaluation runs the frozen auditors
over these (Ravensmark/Skyway have no accepted first drafts anywhere in the
record — the V53 wall itself).

## Files

| File | Rows | Role |
|---|---:|---|
| `sft-train.compact.jsonl` / `sft-heldout.compact.jsonl` | 1,115 / 3 | PRIMARY typed-slot format |
| `sft-train.full-apparatus.jsonl` / `sft-heldout.full-apparatus.jsonl` | 1,115 / 3 | secondary variant (v1 rendering) |
| `heldout-eval-contexts.jsonl` | 3 | V53 transfer-cell requests + rejected drafts |
| `aux-register-frames.jsonl` | 4,697 | aux register→outcome frames (not SFT pairs) |
| `samples.json` | 5 | one compact pair per source |
| `TRAINER-NOTES.md` | — | completion-only loss REQUIRED + gate provenance |
| `extraction-report.json` | — | counts, exclusions, leakage, gate rates, SHA-256s |

Rows carry `{prompt, completion}`, the structured request, world, persona,
family, turn/draw ids, `trigger` + `trigger_line`, `completion_channel`,
typed-contract metadata, provenance pointers, and now
`faithfulness: {hard_pass, realization_rate, trigger_line}` per surviving
row.

## Hygiene (verified on the final build)

Fail-closed provenance unchanged (step4 SHA prefix + exports launch-plan
parity; V17 run-seal inventory + uniform checkout SHA; V52/V53 frozen
working-result SHAs). Deterministic: rerun byte-identical. Split purity: 0
held-out-world rows in either train file. No completion appears inside its
own prompt. V52/V53 completion channel remains `composed_public_text`
(filter by `prompt_profile` if the JSON-tail mismatch matters).

## Next

Nothing trains on this corpus before the Phase 2 prereg freeze and an
explicit go (plan §8). Training runs must follow TRAINER-NOTES.md:
prompt-masked SFT, compact files primary, full-apparatus for ablation only;
the matched/shuffled gate rates travel with any transfer result as its
conditioning-validity evidence.
