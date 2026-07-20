# Program-2 Phase 5 — live committee pilot, results memo

Date: 2026-07-20. Prereg + frozen numbers:
`PROGRAM-2-PHASE5-LIVE-PILOT-PREREGISTRATION.md` §9. Manifest:
`config/adaptive-tutor-evidence/program-2-phase5-live-pilot.manifest.json`.
This memo carries the interpretation; the prereg carries the record.

## What was run

24 live dialogues on world_005_marrick (Step 4 operational spec, pinned
claim-run runtime 91b8a50e + Phase 5 machinery c4364dc0): 12 committee
(at detector-fired warrant moments, the local tuned mini writes the
question, sonnet composes the turn around it verbatim, a deterministic
battery decides, failures fall back to the mini's reply), 12 silent
control (frontier alone, detector logging). 24/24 sealed, zero attrition,
6 same-seed retries (all auto-learner budget overflows in long dialogues,
both arms). Cost: one evening of Max-plan + codex quota, mini free/local.

## The three frozen endpoints

| Endpoint | Committee | Control | Verdict |
|---|---|---|---|
| E1 live warrant compliance | 0.200 (15/75) | 0.160 (13/81) | FAIL — diff +0.040, CI [−0.054, +0.133] |
| E2 coverage@16 | 0.611 | 0.625 | intermediate — diff −0.014, CI [−0.083, +0.056] |
| E3 seam detection | 0.500 accuracy (n=36), continuity 3.75 = 3.75 | | PARITY (bar ≤ 0.65) |

Safety guardrail PASS (0.58 = 0.58); leaks arm-symmetric; density PASS.

## What the pilot actually established

1. **The architecture deploys.** The protected-span committee ran 75 live
   moments across 12 dialogues with zero committee-attributable failures,
   invisible seams (detection exactly at chance), identical safety, and no
   coverage tax at the point estimate. The §6.19 enforcement trade
   (compliance bought at ≈−0.13 coverage) is NOT reproduced by span-level
   form-ownership. This is the durable positive.

2. **The trained form transfers; a plumbing gap spends it.** Component
   decomposition: the committee's delivered turns carry the trained
   warrant-cue form at +0.165 over control — the fine-tune's signature,
   live. But fallback-delivered mini replies (the one text path the
   battery does not check) carry a second question often enough to cost
   −0.218 on question discipline, and the frozen rule is a conjunction.
   Net: +0.040, not significant. The fallback-trim counterfactual
   (exploratory) puts the fixed system at 0.347 vs 0.160 — eleven moments
   rescued by extending the same battery to the fallback text.

3. **The frontier was better than the instrument showed.** The
   world-lexicon sensitivity rescore (exploratory, mechanically derived
   list, frozen mid-run): control 0.469 vs committee 0.320. Sonnet's
   natural questioning anchors claims to scene-named evidence (the graver's
   signature, the die-flaw, the notch) at a rate the six-word rule cannot
   see. The committee's frozen-rule edge is specifically the trained
   six-word FORM — the letter of the audit, not a superiority in
   evidence-anchored questioning. Training on audit exhaust taught the
   audit's letter; the composed live loop reveals the difference between
   that letter and the move's spirit.

## Boundary notes

Single family (sonnet-5), single world, n=12/arm, exploratory tier; the
offline references (0.448/0.276) were generated on the archived moment
distribution and a weaker battery — stated throughout as references, not
bars. The 2026-07-17 main-stack guard hardening is incompatible with this
pilot's configuration (three early dead-ends, zero sealed — Amendment 1);
any successor run must re-pin or reconcile.

## Post-pilot menu (none licensed under this prereg; cheapest first)

1. Fallback battery extension (trim-to-first-question or local best-of-n at
   the mini): counterfactual +0.147 on E1, three-line change.
2. Cue-robust detector v2 (frozen six ∪ world lexicon) with claim-run
   recalibration — instrument work, changes what "compliance" means.
3. Iterated exhaust (DAgger-style): collect the committee's own live
   moments, audit-label, retrain — the distribution-shift fix.
4. KTO runs (still licensed and unspent from Phase 2, Lambda required).
