# Program-2 Phase 5d — delivery-integrity rider pre-registration

Status: **DRAFT (2026-07-22) — NOT FROZEN.** Drafted on the user's go
(2026-07-22) from the decision record
`notes/program-2/2026-07-22-cue-attrition-observation.md` (+ same-day
census addendum). Freezes only on an explicit user go at commit time;
seed, machinery SHA, and prompt hashes are pinned then. Parents:
`PROGRAM-2-PHASE5B-FALLBACK-BATTERY-PREREGISTRATION.md` §8,
`PROGRAM-2-PHASE5C-CROSS-WORLD-TRANSFER-PREREGISTRATION.md` §9.
Exploratory tier. The instrument is UNCHANGED: the frozen v1 six-word
rule stays by user decision (2026-07-22); the world-lexicon rescore
remains descriptive and licenses nothing.

## 1. Question

5b closed the fallback path; the residual loss sits one step later, at
delivery. Census over the sealed 5b traces: at 47 of the 83 committee
moments (56.6%) the shipped turn is not the committee-approved text —
the release/staging surface authors those turns (all 34 due-release
turns plus 13 clue-staging turns), so the committee's form-control
reaches only the 36/83 moments whose approved text ships. Of the 17
achievable misses, 9 sit on the staged path (7 with a cue-bearing
approved text discarded) and 8 on the composed path (span carried no
cue; the composed battery does not check one). Do two delivery fixes —
span-level form-ownership extended over the clue-staged path, and a
protected span that itself carries the cue — produce ≈0.55 live
compliance on Marrick (from 0.386) at no coverage, safety, or seam
cost?

## 2. Changes under test (committee-v3 = v2 + spanCue.v1 + deliveryGuard.v1; everything else identical)

1. **spanCue.v1 — span resampling.** At span extraction, if the mini's
   chosen question sentence contains no frozen cue word
   (`evidence|item|test|record|fact|rule`, the detector's regex), the
   mini is resampled (temperature 0.35, ≤2 attempts — the 5b pins) and
   the first reply whose question sentence carries a cue word supplies
   the span; otherwise proceed exactly as today and record
   `span_cue_miss`. Applies before composition and before the fallback
   battery, so it raises both paths (5b baselines: span cue-rate
   31/83 = 0.37; mini's own reply 76/83 = 0.92).
2. **deliveryGuard.v1 — staged-turn span ownership.** At a committee
   moment where the finalized turn text differs from the approved
   envelope AND the turn commits no premise release (releasedNow
   empty — clue staging only): replace the staged text's final question
   sentence with the protected span, verbatim, and ship. Premise-release
   turns (releasedNow non-empty) are never touched (recorded
   `guard_skipped_release`). The clue body is never edited; question
   count is preserved, not repaired (45/47 replaced 5b turns already
   carry exactly one question). If no span exists: unchanged, recorded.
3. Composed-path semantics, the v2 fallback battery, span extraction
   order, and the silent_control arm are byte-unchanged. The
   `program2_committee_moment` event additionally records `spanCue`
   (attempts, outcome) and `deliveryGuard` (eligible, applied, reason).

## 3. Design (18 dialogues, world-005-marrick)

12 committee-v3 (2 profiles × 6 repeats) + 6 fresh silent_control
(2 × 3), interleaved by seeded shuffle; plan/stub seed = freeze date.
Runtime: the pinned claim-run lineage (91b8a50e; machinery SHA pinned at
freeze), new machinery cherry-picked — same convention as 5b/5c. Runner
gate/launch discipline identical (zero-model gate, sha-pinned launch,
zero-paid smoke, sealed-trace resume, one same-seed retry,
3-consecutive-failure abort).

**Control pooling rule.** Primary control = the 6 fresh controls POOLED
with the 18 archived controls (Phase 5's 12 + 5b's 6), licensed iff
|fresh pooled warrant rate − archived pooled rate| ≤ 0.10; otherwise
fresh-only, and says so. Marrick is the venue because that is where the
headroom is (5c cue floors are world-lifted; its committee already sits
at ≈82% of its due-release ceiling).

## 4. Endpoints (dialogue-cluster bootstrap, 5,000 draws, seed = freeze date, profile-stratified)

- **E1d (primary):** pooled warrant_skip compliance (frozen v1 audit),
  committee-v3 − pooled control. **PASS = 95% CI > 0.**
- **M1 (mechanism — guard):** among realized guard-eligible moments
  (finalized ≠ approved, releasedNow empty), delivered cue-rate
  **≥ 0.75** (5b baseline 4/13). If fewer than 5 such moments realize,
  M1 is reported descriptively with no verdict.
- **M2 (mechanism — span):** span cue-rate **≥ 0.85** (5b baseline
  0.37); `span_cue_miss` count reported.
- **Registered reference (descriptive, cross-run, no bar):**
  committee-v3 rate against 5b's committee-v2 0.386 and against the
  decomposition-derived prediction ≈0.55 (≈0.9 of the 49/83 ≈ 0.59
  structural ceiling). Stated here so the prediction predates the data;
  cross-run comparisons license nothing.
- **Guardrails:** coverage@16 ≥ control − 0.05 (5c reopened the cost
  question; the CI is reported either way); hard-safety ≥ control −
  0.10 (the turn-9 release-schedule anatomy stands); density ≥ 15
  warrant opportunities in the committee arm; **seam re-check
  mandatory** — full 20+20 window battery, bar ≤ 0.65, since the guard
  changes staged-turn texture (mini-authored questions inside staged
  turns).

## 5. Reading grammar

| Result | Licensed reading |
| --- | --- |
| E1d PASS + M1 + M2 + guardrails + seam | Delivery completeness closed: the committee controls form on every non-release text path; the remaining gap is the rule and the release schedule, not the pipeline. Gain presented as delivery completeness, not pedagogy (the cue-less good-question control specimen stands). |
| E1d PASS, M1 FAIL | Compliance rose on the composed path alone; the staged path resists the swap (report which staging shapes blocked it). |
| M2 FAIL | The tune does not put the cue into question-shaped sentences under resampling — informative about what SFT installed; span fix insufficient without retraining. |
| Seam > 0.65 | The guard's texture is visible; verbatim windows reported; guard not carried forward without redesign. |
| Coverage FAIL | 5c's reopened cost question extends to v3; report CI and stop extending delivery machinery until costed. |

## 6. Cost bound and scope

≈ ≤ 700 sonnet CLI calls + ≤ 1,000 terra calls + local mini (resamples
free). One retry per dialogue; checkpointed; resumable. Out of scope:
any instrument change, KTO/retraining, other worlds, iterated exhaust,
and any edit to premise-release staging beyond the single
question-sentence swap on clue-staged turns.

## 7. Pre-freeze homework (done 2026-07-22, before this draft)

5c census (sealed traces, read-only): replacement occurs at the same
rate on world_027 (34/61 = 55.7%; 21 due-release + 13 clue-staged) but
is nearly cost-free there — 12 of 13 clue-staged achievable moments
compliant, because gazette staging language natively carries the
lexicon ("record" above all). The Marrick cost is lexicon-specific, not
mechanism-specific; the rider therefore targets Marrick, and the
guard's cross-world value is uniformity of form-control, not gazette
gain. 5b full census: 47/83 replaced (34 due + 13 clue-staged);
approved text ships on 36/83 (43%).

## 8. Freeze checklist (all pending — this section empties at freeze)

- [ ] User go to freeze; Status line flipped, this checklist resolved.
- [ ] Machinery SHA + seed (freeze date) + prompt hashes pinned in §2-§4.
- [ ] spanCue.v1 + deliveryGuard.v1 implemented on the pinned lineage;
      zero-paid smoke (plan gate, mini probe, one dry committee moment
      with a staged-turn swap) PASS.
- [ ] 5c-style launch sequence recorded (zero-model gate, preflight,
      probes) before any paid call.
