# Program-2 Phase 5 — live committee pilot pre-registration

Status: FROZEN at commit time on branch `claude/program-2-phase5-live-pilot`
(2026-07-20). Paid dialogues run only after this document is committed; the
runner refuses a paid launch on a dirty checkout or a SHA other than the one
approved. Exploratory tier: no H-W claim is at stake; results land as a
§6.20 addendum. Parent documents: `PROGRAM-2-FINETUNE-PLAN.md` (§8 coupling
mode 3, H4/H5), `PROGRAM-2-PHASE2-PREREGISTRATION.md` (§7 seam bar, §10
Amendment 1 + results), `POINT-OF-ACTION-COACHING-PREREGISTRATION.md`
(operational spec inherited verbatim).

## 1. Question

Does the offline fail-closed committee gain (composite 0.448 vs frontier
composed-alone 0.293, tuned mini solo 0.414 — Phase 4 §10) survive **live**
coupling; what does it cost in proof-DAG coverage (the §6.19 enforcement-tax
question, H2); and is the seam visible at the frozen H5 bar?

## 2. Design (24 dialogues; 2 arms × 2 profiles × 6 repeats)

Operational spec inherited verbatim from the Step 4 gate
(`scripts/run-step4-point-of-action-gate.js` STEP4_POINT_OF_ACTION_SPEC):
world_005_marrick, register policy `bland`, `strict_dag`, supporting seams
(classifier + learner-record + automated learner) on `codex.gpt-5.6-terra`,
profiles `proof_skipper` + `affective_resistant`, `--auto-turns
until-grounded` with safety 40, primary horizon 16, trigger window [3, 24],
detector `step4-frozen-2026-07-14.v1`, register temperature 0.15, maxTokens
4096, historyTurns 4. Tutor family both arms: `claude-code.sonnet-5`
(single-family pilot; the codex-family committee is out of scope). Plan
shuffle (seeded Fisher-Yates over the 2×2×6 matrix) and stub `--run-seed`:
20260718. Runner `scripts/run-program2-live-pilot.js` → root
`exports/program2-live-pilot/` (launch-plan.json + traces/<jobId>/), Step
4-style zero-model gate then `--launch-approved --expected-sha`.

**Arm `silent_control`** — the frozen detector runs and logs every
assignment; nothing is ever injected (no standing book, no coaching, no
committee). The frontier tutors naturally. This is the "frontier alone with
moments observed" baseline.

**Arm `committee`** — identical, except at turns where the detector fires
`warrant_skip`, the first draft is produced by the committee chain:

1. **Mini**: `program2-sft-instruct-v2` (the Phase 4 verified-merge SFT
   instruct artifact, q8_0 same-lineage GGUF) via local ollama **native**
   `/api/chat`, `think:false`, greedy (temperature 0), `num_ctx` 16384,
   `num_predict` 4096, 600 s request timeout — the frozen Phase 2 serving
   pin. Its request is the frontier-identical speaking request plus the
   frozen side-coach warrant block (detector `TARGET_TEXT.warrant_skip`,
   sha-pinned in the module) appended as its activation instruction —
   matching the training/eval interface, where compliant source turns
   carried arm-injected coaching.
2. **Protected span**: the mini reply's question sentence(s), extracted with
   the probe-identical rule (`/[^.!?\n]+\?/gu`, trimmed, > 8 chars, joined).
3. **Composition**: the frontier receives its normal speaking prompt plus
   the probe-identical composition block (include the span verbatim as the
   turn's only question; no other question; no new case facts; scene voice),
   through the standard prompt/privilege audits.
4. **Battery (fail-closed, pre-delivery)**: non-empty composed text AND
   verbatim span containment after whitespace normalization AND exactly one
   question mark in the composed turn. Any failure → the mini's own reply is
   the draft. (The offline probe's battery was containment-only; the
   one-question check is added here, frozen before launch — offline 0.448 is
   therefore a reference generated under the weaker battery.) Mini
   unavailable or empty → the normal frontier draft, recorded as
   `frontier_mini_unavailable`.
5. The chosen draft then flows through the stub's **standard delivery
   guards and repair machinery, identical to control**. No mechanical
   premise suppression in either arm (the compiled-constraint channel stays
   off); due releases remain possible on committee turns.

`stagnant_repeat` firings receive no intervention in either arm (logged
only). Every committee moment logs mini text, span, composed text, battery
verdicts, chosen source, and latencies to the sealed trace
(`program2_committee_moment` events) alongside the standard
`model_call` / compliance events.

## 3. Endpoints (all inference: dialogue-cluster bootstrap, 5,000 draws,
seed 20260718, stratified by profile, two-sample across arms)

- **E1 — live compliance (primary).** Pooled `warrant_skip`
  point-of-action compliance rate (frozen audit: exactly one question +
  warrant cue + no new premise + guards passed, judged on the **delivered**
  turn), committee − silent_control. **PASS = 95% CI > 0.**
- **E2 — coverage tax (H2).** Mean proof-DAG coverage@16 difference,
  committee − silent_control. Readings: **no enforcement-scale tax** if the
  CI lower bound > −0.05 (Step 4's frozen coverage margin);
  **enforcement-scale tax** if the point estimate ≤ −0.10; otherwise
  intermediate, reported descriptively.
- **E3 — seam (H5-live).** The Phase 2 §7 bar verbatim, applied live: 40
  three-turn windows — 20 containing exactly one committee-delivered turn
  (source `composed` or any `fallback_*`; `frontier_mini_unavailable`
  excluded), 20 committee-arm windows containing none — single sonnet-class
  isolated reviewer answers whether any turn was spoken by a different tutor
  (chance 0.5) plus a 1–5 continuity rating (descriptive). **Parity =
  detection accuracy ≤ 0.65.** Window sampling seed 20260718; if fewer than
  20 committee windows exist, use all and report realized n.
- **Guardrails.** Hard-safety pass rate: committee ≥ control − 0.10 (Step
  4's frozen safety margin). Leak counts and per-arm trigger densities
  reported (moment counts are endogenous to arm — stated, not corrected).

**Density precondition**: ≥ 15 pooled `warrant_skip` opportunities per arm
(Step 4's 25-per-20-dialogues rate scaled to 12), with the `proof_skipper`
channel contributing; otherwise no verdicts — descriptive report only.

## 4. Attrition and abort

A dialogue aborted by transport failure is re-run once with identical seeds;
a second failure is attrition (excluded from all endpoints, reported). Three
consecutive transport failures abort the launch (quota window presumed dead)
→ checkpoint + notify; the runner resumes by skipping sealed traces.

## 5. References (calibration, not bars)

Offline: composite 0.448, mini solo 0.414, composed-alone 0.293, bar 0.460,
structural ceiling 14/58 due-release moments (impossible-by-construction
under the frozen `released == 0` component — present in both live arms
equally). Archived Step 4 sonnet-family live arm compliances: §6.18–§6.20.

## 6. Cost bound and scope

≈ ≤ 1,000 sonnet CLI calls (tutor turns + one composition call per committee
moment) + ≈ ≤ 1,300 terra CLI calls (supporting seams) + local mini
(free). Checkpoint after every dialogue; resumable. Out of scope: KTO arms,
codex-family committee, base-arm committee, dataset v2, any tuning, any
re-run beyond §4's single retry.

## 7. Amendment 1 (2026-07-20, before any sealed pilot data)

**Execution runtime re-pinned.** The launch at branch head b7a619dc
(main-derived stack) aborted after three consecutive dialogue attempts
dead-ended at turns 2–3 on `live_turn_progression_v1` guard failures
(`handoff_loses_turn_focus`, `learner_uptake_not_realized`) that even the
stub's deterministic fallback could not clear. Zero dialogues sealed — no
data is discarded by this amendment. Root cause: that guard hardening
landed 2026-07-17 (the V32–V34 diagnostic arc), postdating the Step 4
detector freeze (2026-07-14), the claim runs, and the Phase 0 training
extraction — every reference number in §5 and the training corpus itself
were produced on the pre-hardening runtime. The claim runs themselves
executed on the frozen Step-4 runtime branch at 91b8a50e (sealed
run-header provenance stamps). Execution therefore moves to a worktree at
91b8a50e with the Phase 5 machinery cherry-picked on top (worktree branch
`claude/program-2-phase5-pinned-runtime`), with two adaptations to the
pinned runtime's internals, neither touching frozen semantics: (1) the
composer call is a direct isolated CLI-bridge request with the composition
block folded into the speaking prompt — exactly the offline probe's
measured request shape — rather than routing through the pinned
prompt-audit path; (2) response envelopes match the pinned pipeline's
shape. Arms, n, endpoints, bars, seeds, battery, and fallback semantics
are unchanged. This pin restores the stack match with §5's references and
the training corpus; the aborted main-stack attempt is retained at
`exports/program2-live-pilot-aborted-20260720-mainstack/`.

## 8. Decision grammar

| Result | Licensed reading |
|---|---|
| E1 PASS + E2 no-tax + E3 parity | Live committee viable: fail-closed compliance gain without enforcement-scale coverage cost at seam parity (exploratory, single family, n=12/arm). |
| E1 PASS + E2 tax | The committee buys live compliance at the enforcement price — H2 answered "it pays the tax"; form-ownership does not escape the coverage trade on this stack. |
| E1 FAIL | The offline composite gain does not survive live coupling; suspects (checks–dynamics interplay, activation-instruction shift, repair interference) named descriptively; no retry under this prereg. |
| E3 detection > 0.65 | Seam visible: committee texture detectable; verbatim window examples reported regardless of E1/E2. |
