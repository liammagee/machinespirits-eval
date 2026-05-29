# EDRA M3 surgery spec — from the design fan-out

Date: 2026-05-28
Provenance: read-only design fan-out (Workflow `wf_87e7057b-54b`, 13 agents, 6
dimensions each adversarially verified, 1 synthesis). This note is the durable
artifact; the raw run is in the session task output. Code claims below were
spot-checked against the live source (anchors cited inline).

## The reframe (this overturns the "saturation" premise)

The adaptation-recognition loop's `organic_recognition` failure is **not** critic
gullibility, and **not** a fundamental "critics won't attribute causation" wall.
It is substantially a **scorer/analyzer brittleness bug across two code paths**,
plus an author-family artifact, plus a structurally-leaky anchor (D42).

1. **Origin is derived, never voted.** `scripts/lib/recognitionOrigin.js:63`:
   `completeEndingShape = recon>=75 && learnerActionScore>=75 && tutorMechanismScore>=75`;
   `peripeteia_induced` requires it (`:113`), else `organic` (`:138`). recon and
   actional axes clear 75; the **single binding constraint is `tutorMechanismScore>=75`.**
2. **That axis is clamped below 75 by brittle lexicons.** Critic-side
   `hasPeripeteiaMechanismShift` (`scripts/score-poetics-phase2.js:331-348`) is a
   hardcoded stock-taking+device regex; "Tiles float. The diagram does not."
   matches nothing → `stock=0` → mechanism clamp 4→3. The cross-family critics
   (deepseek/qwen) **quoted the identical, textbook peripeteia evidence** and still
   derived `organic`. Only the **author-family critic (Sonnet, same family as the
   Opus generator) cleared the gate** → `peripeteia_induced` collapses to ~0/3
   without it. So the 1/4 origin vote is an author-family artifact riding on an
   over-conjunctive gate.
3. **The same brittleness lives in a second path.** The tutor-adaptation analyzer
   aliases both signals to one var (`scripts/analyze-poetics-tutor-adaptation.js:843-844`:
   `tutor_strategy_reversal` and `tutor_adaptive_mechanism` both = `tutorStrategyReversal`),
   and `MECHANISM_SHIFT_PATTERNS`/`novelMechanismHits` returns `[]` for tile→marker
   → `mechanismDepth=0` → `publicMechanism=false` **even when the public route change
   is in the transcript and the superego self-logs "Public device check: PASS".**
   This is the `private_only_adaptation` "failure" — partly a measurement lie.
4. **D42 controls structurally leak.** D42's prefix (directional arrow error + a
   rotatable diagram) makes Socratic contradiction the *only* move, so the `none`/
   `routine` controls produce reorientation language ("Arrow's the push, then — not
   the path") and earn 2/4 recognition with no peripeteia cue. Scenario content,
   not generator fault.

**Consequence:** more generation cannot fix this (the drama is already a textbook
peripeteia). The fix is analyzer/scorer surgery + an anchor swap. This is the
architecture surgery the termination rule called for.

## Pre-registered decisions (freeze before the next run)

**D1 — `no_origin_ambiguity` is DEMOTED from hard gate to a reported secondary
diagnostic.** Justification (verified per-critic): `peripeteia_induced` never
exceeded 2/4 (typically 1/4) across i01–i03 while recognition reached 3–4/4, and
it is author-family-dependent (≈0/3 without Sonnet). It is critic-unreachable as a
3/4 cross-family consensus. We **report** `origin_ambiguity_rate` as the spec's
causal-overclaim guard; we do **not** let it gate. The loop currently over-weights
it into a hard pass-gate (`run-poetics-adaptation-loop.js:455`); demoting it
re-aligns with the spec's own primary metric (`recognitive_closure_3of4`). Amend
`positive_claim_requires_no_origin_ambiguity` in the sidecar § with this written
rationale + the per-critic numbers, **before** the next run, so it is a documented
finding and not a quiet relaxation. **Necessary but far from sufficient:** removing
the origin gate alone unblocks **zero** items.

**D2 — M3 analyzer/measurement hardening lands BEFORE B0 is locked.** B0's numbers
are only as honest as the analyzer that computes them; with the `publicMechanism`
alias bug and the coverage attrition (below), a B0 locked now would enshrine a
mis-measurement as the denominator.

**D3 — the positive claim is carried by a corrected paired increment, NOT the
original framing.** (My first paired-increment proposal was *rejected* by the
adversarial layer — it dropped `public_habit_break`, differenced against controls
with zero valid critics, and relabelled ambiguity as cleanliness.) Corrected gate:

- **Matched pair** = two items sharing `paired_continuation.shared_prefix_hash`
  (prefix_through tutor_turn_2), one control (`none`/`routine`), one treatment
  (`edra_policy`/`peripeteia_only`). Shared prefix holds organic recognition constant.
- **Pair is valid only if** BOTH arms have ≥4 critics after retries AND no
  `quality_warning`/`scorer_error` (`scoreCoverageOk`). This kills the contaminated
  evidence (e.g. i01/i03 D50 differenced against 0-valid-critic controls; i03 D42
  with both controls leaking).
- **Control gate (HARD, unchanged):** any validly-scored control that leaks →
  scenario **INVALIDATED**, not failed-on-treatment.
- **Public + actional gates (HARD, unchanged):** `publicHabitBreak`/`devicePerformed`
  true, `actionalVotes >= cut`. **Not dropped.**
- `lift(d) = closure(peri) − control_closure(d) ∈ {−1,0,+1}`; positive claim
  requires `lift==+1` AND all hard gates. `origin_ambiguity_rate` reported alongside.
- Aggregate `recognitive_closure_lift` recomputed **from `item_gates.jsonl`**, Wilson
  interval, loop pass = `requiredPasses` (2) scenarios with a positive claim.

**Honest current verdict (why this is pre-registered, not reverse-engineered):**
applying this exact gate to existing i01–i03, **at most ONE scenario qualifies per
iteration** (i03 D50: peri 4/4, controls 0/0, +4, no leak) — and even it fails the
actional gate (act=2<3). With `requiredPasses=2`, **the loop has not passed; the
current result is a null/weak-positive, to be reported as such.** The metric is
labelled "differential recognizability of dramatic peripeteia vs matched
continuation" — a text-form measurement, immune to the author-family confound (both
arms share author+critics), making **no** learning/adaptive-responsiveness claim.

## M3 fixes (build in sequencing order; each ships a golden + control-negative fixture)

**FIX 3 — quality-gate/scorer TEXT PARITY** (`generate-pedagogical-dramas.js`).
`renderTranscript` strips stage directions into a local copy and never writes back,
so `qualityWarningsFor` inspects pre-strip text and false-flags
`possible_internal_process_leak` (a "Superego" mention inside a stripped ★Insight
block) + `possibly_truncated_learner_turn` — dropping clean transcripts. Build
`publicTurns` once via `stripStageDirections(neutralize(t.text))` and feed it to
BOTH `renderTranscript` and `qualityWarningsFor`. Refinement: run `isTruncated` on
public **speech before** `quotePublicSpeech` wraps a closing quote, else genuine
mid-thought clips (i02 D53 "…once the tile spins, or —") get silenced. This is why
D53 never scores.

**FIX 4 — scorer retry + coverage decoupling** (`score-poetics-calibration.js`,
`score-poetics-phase2.js`, `run-poetics-adaptation-loop.js`). `callModel` has no
retry; one DeepSeek "No content"/JSON-parse fail sets `scoreErrors>=1` AND drops
`totalCritics<4`, and the loop gates ALL substantive votes behind `totalCritics>=minCritics`
— so a 3/3-**unanimous** recognition item is discarded (i02 D42, i03 D53). Add
bounded retry+backoff on transient classes only; re-attempt errored critics within
the iteration; **decouple** `scorer_error` (transient) from `insufficient_scores`
(true shortfall); compute `score_coverage_rate` and gate after retries on EDRA's
0.95 / 0.02. Retry-to-4 is primary; the 3-of-4 fallback fires only if a critic stays
unrecoverable AND coverage<0.95. Probe DeepSeek reliability (N~20) before B0; if its
empty/truncated rate is structural, swap the critic **before** locking B0.

**FIX 1 — de-brittle + de-alias the public-mechanism detector**
(`analyze-poetics-tutor-adaptation.js`). SPLIT lines 843-844: keep
`tutor_strategy_reversal` = lexical/explicit signal; make `tutor_adaptive_mechanism`
= public-route-change signal (new var). In the disjunction at `:806-813` add a
disjunct that fires WITHOUT `mechanismDepth>=1`:
`strongPressure && postTutor && strategyShift && instrumented?.declaredRouteChange && postOverlap>=0.1`.
Verified on D42/i01 artifacts (postOverlap=0.478, strategyShift/strongPressure/
declaredRouteChange all true) → flips D42 **and** D50 peripeteia from
`private_only_adaptation`→pass, score cap ~49→~67, D53 unchanged, and **all 6 control
items stay false** (controls lack strategyShift+declaredRouteChange) → control
leakage stays 0.00. **Drop** the origin-finding's "widen `tutorTextAfterPivot`"
path — verified no-op (`score-poetics-phase2.js:107` `parseTurns` already folds
bracketed stage business into the preceding tutor turn). Fixtures: D42 golden;
routine/none control-negative; **instrumented-but-no-public-shift negative**
(strategyShift=FALSE → expect `tutor_adaptive_mechanism===false`, pinning that a
private self-report alone can't satisfy the gate).

**FIX 2 — harden the SECOND lexicon** (same file, `MECHANISM_SHIFT_PATTERNS`/
`novelMechanismHits` ~468-517, 612-614). Scenario-bound regex returns `[]` for
tile→marker, driving `mechanismDepth=0` independently of the critic-side gate.
Replace the hardcoded stock-taking regex with a representation/device-substitution
test catching medium swaps. Harden this AND the critic-side
`hasPeripeteiaMechanismShift` — or the loop stays red. Record `strategyFor`'s
broad-keyword fragility as a known limitation.

**FIX 5 — emit `item_gates.jsonl`** (does not exist yet; spec-planned). One
`ItemGateResult` row per item with the full spec schema + `shared_prefix_hash` +
arm + dramaId + critic-level retry/outcome. Substrate exists (`shared_prefix_hash`
e.g. `428d64c6731dc39a` for D42:T18 is in the deliberation JSON; `loadGateItems`
at loop `:329-408` already joins vote rows). The paired-increment aggregator
recomputes exactly from this JSONL — pure re-aggregation, no new scoring/generation.

## Anchor-set change (lands in M1, before B0 lock)

Demote **D42** from clean anchor to a named **calibration/boundary** case (probes
critic over-attribution to topic-forced reorientation). It fails the clean-anchor
screen by construction and empirically (i03 none 2/4 + routine 2/4 both leak).
Primary clean set = **D50 + D53 + one screened third**. Do **NOT** promote D44 first
— its `learner_start_state` plants the same opening directional misconception on a
directional artifact and will leak identically. **Screen the D54–D57 static-label
bank** (D57 fraction-labels, D55 parameter-line closest to D50/D53); each must clear
a 2-repeat control-leak screen with ≥4 critics before entering the denominator.
Avoid D51 (boundary_stress) / D52 (revise-before-use). **Clean-anchor screen
criterion (load-bearing):** the prefix task is static label-placement on an artifact
that does **not** contradict any single correct placement (no directional/orientation
error staged during labeling). Fix D42's YAML `evaluation_role`
`clean_low_organic_anchor`→ a calibration role.

## Sequencing

1. **M3a** (FIX 3 + FIX 4): text-parity + scorer retry/coverage first — they restore
   coverage that currently strips 5/9, 4/9, 1/9 items per iteration. (= adjustment D2.)
2. **M3b** (FIX 1 + FIX 2): de-alias + the no-`mechanismDepth` public-route disjunct;
   harden both lexicons; ship golden + control-negative + no-public-shift fixtures;
   re-run analyzer on i01–i03, confirm control leakage stays 0.00.
3. **M3c** (FIX 5): emit `item_gates.jsonl`; build the paired-increment aggregator;
   wire `origin_ambiguity_rate` as secondary (remove from the hard gate at loop `:455`).
4. **M1 (B0 lock)** — only after M3a–c: apply D42 demotion + screened third anchor;
   run+lock `B0_current_sidecar` on D50/D53/+1; report the honest null/weak-positive.
5. **M4** (policy compiler) — EventReader→PolicySelector (7 signalTypes, replacing the
   hardcoded `reversal_trigger_type:'misfit'` at generator `:2146`)→DeviceLibrary→
   MoveContract→TutorCompiler→ClosureCritic, memory off; A/B vs B0 on `strict_shift`
   + `public_habit_break` without control leakage.
6. **M5** closure-bridge repair (action-to-re-reading lift).
7. **M6 device library — DEFERRED.** Un-defer gate (all three): M3 publicMechanism
   fix validated on the D42 golden; M4 PolicySelector exists; M4 A/B shows lift without
   control leak (B0 must first clear its own control leak). Reconcile device-file
   location (spec `skills/pedagogical_devices/*.yaml` vs generator-read
   `config/poetics-calibration/`) explicitly.

## Risks

- **Small denominator.** Clean valid pairs are thin (~1 qualifying scenario/iter on
  existing data); requiredPasses=2, n=3 → wide Wilson interval. Pre-register the
  interval; if it stays null, **report the null in the sidecar §** — do not add
  scenarios post-hoc to manufacture a pass.
- **Origin demotion could read as goalpost-moving.** Mitigate by writing the rationale
  (critic-unreachable, organic-dominant, author-family-dependent) + per-critic numbers
  into the sidecar § **before** the next run.
- **FIX 1 leans on `strategyShift`** (broad-keyword `strategyFor`, can miss/spuriously
  fire). The no-public-shift negative fixture guards the worst case.
- **FIX 3 truncation refinement is load-bearing both ways** (too aggressive silences
  real clips i02 D53; too lax keeps false flags i01 D53). Validate both cases.
- **B0 honesty depends on FIX 4 recovering DeepSeek.** If its failure rate is
  structural not transient, swap the critic BEFORE B0 (perturbs the baseline either way
  — do it first).
- **Stay inside "recognizable dramatic FORM."** Every metric is a text-form judgment;
  any prose reading the increment as "detected adaptive responsiveness"/"real learning"
  re-opens the closed 5× null + the κ=0.044 transfer fail. Label it "differential
  recognizability of dramatic peripeteia vs matched continuation" everywhere.
- **Single-paper discipline.** The sidecar § in `docs/research/paper-full-2.0.md` owns
  every number (anchor demotion, origin demotion, the honest verdict) with a version
  bump; the EDRA-spec HTML must not become a second source of empirical claims.

## Caveat on this note's provenance

The fan-out's *code* claims spot-checked here (recognitionOrigin.js:63/113/138,
analyze-poetics-tutor-adaptation.js:806/843-844, score-poetics-phase2.js:331) are
verified. Some *line numbers* in the raw workflow output (especially spec-HTML
citations) were flagged unreliable by the verifiers — re-confirm each anchor at
implementation time. The honest-null verdict and the two pre-registered decisions
are the load-bearing outputs; treat the fix details as a strong draft to verify, not
gospel.
