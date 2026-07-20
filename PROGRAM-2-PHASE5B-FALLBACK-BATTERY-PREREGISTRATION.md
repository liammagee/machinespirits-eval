# Program-2 Phase 5b — fallback-battery confirm run pre-registration

Status: FROZEN at commit time on branch `claude/program-2-phase5-live-pilot`
(2026-07-20), on the user's go ("Let's proceed with other remedies") after
the Phase 5 close-out. Parent: `PROGRAM-2-PHASE5-LIVE-PILOT-PREREGISTRATION.md`
(§9 results; remedy 1 of the post-pilot menu). Exploratory tier. The
instrument is UNCHANGED by user decision (2026-07-20): the frozen v1
compliance rule (six-word cue) remains the only scoring rule; the
world-lexicon rescore may be reported descriptively but licenses nothing.

## 1. Question

Phase 5 located the committee's loss precisely: fallback-delivered mini
replies are the one text path never checked, and 24/75 moments shipped
with a second question (E1 components: cue +0.165, one-question −0.218).
The trim counterfactual scored 0.347 vs control 0.160. Does extending the
same fail-closed battery to the fallback path produce a live E1 pass?

## 2. Change under test (fallback policy v2; everything else identical)

At a committee moment, when the composed turn fails the battery (or no
span exists), the delivered fallback is resolved as follows instead of
shipping the greedy mini reply unchecked:

1. If the greedy mini reply passes the **fallback battery** — exactly one
   question mark AND the frozen six-word cue present in the turn — ship it
   (`fallback_resolution: selected_greedy`).
2. Otherwise resample the mini at temperature 0.35 (the Phase 2 sampled
   pin), up to 2 attempts; ship the first sample passing the battery
   (`selected_sampled_1|2`).
3. Otherwise edit the greedy reply: keep the question sentence containing
   a cue word if one exists, else the first question; delete the other
   question sentences; ship (`trimmed`). If the greedy reply has ≤1
   question, ship unchanged (`unchanged`).

Composed-path semantics, span extraction, the composition block, the
composed-turn battery, and the silent_control arm are byte-unchanged. The
`program2_committee_moment` event additionally records `fallbackPolicy`,
`fallbackResolution`, and resample count. Runtime: the Amendment-1 pinned
worktree (91b8a50e lineage), new machinery cherry-picked.

## 3. Design (18 dialogues)

12 committee-v2 (2 profiles × 6 repeats) + 6 fresh silent_control (2 × 3),
interleaved by seeded shuffle, plan/stub seed **20260720**; all other
operational parameters verbatim from the Phase 5 spec. Runner gate/launch
discipline identical (zero-model gate, sha-pinned launch, sealed-trace
resume, one same-seed retry, 3-consecutive-failure abort).

**Control pooling rule (frozen).** Primary control = the 6 fresh controls
POOLED with Phase 5's 12 sealed controls (n=18), licensed only if the
stationarity check passes: |fresh pooled warrant rate − Phase 5 control
pooled rate| ≤ 0.10. If it fails, the contrast runs against the 6 fresh
controls alone and says so.

## 4. Endpoints (dialogue-cluster bootstrap, 5,000 draws, seed 20260720,
stratified by profile, two-sample)

- **E1b (primary):** pooled warrant_skip compliance (frozen v1 audit),
  committee-v2 − control. **PASS = 95% CI > 0.**
- **Guardrails:** coverage@16 committee-v2 ≥ control − 0.05; hard-safety
  ≥ control − 0.10; leaks reported; density ≥ 15 warrant opportunities in
  the committee-v2 arm.
- **Seam re-check:** the E3 harness re-run over committee-v2 dialogues
  (realized-n clause), frozen bar ≤ 0.65 — the trim path alters delivered
  texture, so parity must be re-demonstrated, not assumed.
- **Descriptive:** fallbackResolution distribution; per-component rates;
  the Phase 5 committee arm as a historical reference.

## 5. Reading grammar

| Result | Licensed reading |
|---|---|
| E1b PASS + guardrails + seam parity | The Phase 5 loss was the unchecked fallback path: with the battery closed over every delivered text, span-level form-ownership beats the frontier live at no coverage cost (exploratory, single family/world). |
| E1b FAIL with committee-v2 ≈ 0.35 | Counterfactual honest but control non-stationary or variance-bound — report, no retry. |
| E1b FAIL with committee-v2 ≈ 0.20 | The trim counterfactual was closed-loop-invalid (delivered-text changes moved the learner); strengthens the iterated-exhaust argument; no retry. |
| Seam detection > 0.65 | Trim texture visible; verbatim windows reported. |

## 6. Amendment 1 (2026-07-20, 1 of 18 dialogues sealed)

**Prompt-model surfaces gain the speaking surface's duplicate-line
recovery.** Two of the first three launch attempts died at turns 19–26 on
`tutor_stub_learner_analysis: duplicate_instruction_lines` — endgame
dialogue naturally repeats the verdict sentence ("The verdict is licensed:
Edony struck the false shillings…") across prompt sections, and the
pinned runtime's `callPromptModel` audit treated the repeat as fatal while
the speaking surface (`invokeTutorAttempt`) already deduplicates and
proceeds. The patch mirrors that existing recovery onto prompt-model
surfaces (dedup, re-audit, recovery trace event; unrecoverable failures
still throw). Arm-independent (observed on committee and control attempts
alike) and comparability-neutral: sealed dialogues by construction never
hit the fatal, so no sealed content — including Phase 5's pooled controls,
which never encountered this failure — is affected; the patch only
converts late-dialogue deaths into recovered turns. The one sealed 5b
dialogue is retained; the launch resumes with sealed-trace skip.

## 7. Cost bound and scope

≈ ≤ 700 sonnet CLI calls + ≤ 1,000 terra calls + local mini (resamples
free). One retry per dialogue; checkpointed; resumable. Out of scope:
any instrument change, KTO, retraining, codex-family arms.

## 8. Results (2026-07-20 — run complete, 18/18 sealed, zero attrition)

Runtime per Amendment 1 (machinery db53ab14, dedup-recovery patch
fed34fd0, applied at 1 sealed dialogue); 2 retries (both the known
auto-learner budget overflow). Stationarity check PASS (fresh controls
within 0.10 of the Phase 5 controls) — pooled control licensed, n=18
dialogues. Manifest:
`config/adaptive-tutor-evidence/program-2-phase5b.manifest.json`; traces
archived at `~/.machinespirits-data/program-2/phase5b-live`.

**E1b — PASS.** Committee-v2 32/83 (0.386) vs pooled control 18/120
(0.150); diff +0.236, 95% CI [0.128, 0.354]. §5 row 1 applies: the Phase
5 loss was the unchecked fallback path — with the battery closed over
every delivered text, span-level form-ownership beats the frontier live.
Component decomposition confirms surgical action: exactly_one_question
0.720 → 0.976 (now above the frontier's own 0.938) with warrant_cue
(0.560 → 0.542), no_new_premise (0.587 → 0.590), and guards (0.960 →
0.988) unmoved. Fallback ledger: 19 resample rescues, 8 cue-preserving
trims, 4 greedy passes, 1 unchanged. The live rate matches Phase 4's
offline composite (0.448) to within the arms' CI at ~55% of the
structural ceiling.

**Coverage — PASS.** 0.611 vs 0.639, within the −0.05 margin; the
enforcement-scale tax remains absent under the stronger committee.

**Safety guardrail — FAIL, with exonerating anatomy.** Hard-safety 0.42
vs 0.61 (needs ≥ 0.51). Every committee failure is a single leak at turn
9; controls carry the identical turn-9 signature (4/12 Phase 5 controls,
2/6 fresh), it predates the committee (present in both runs and all
arms), and 4 of 5 leaky committee turns are frontier-authored. Read as a
world/release-schedule property (the turn-9 due premise's staging trips
the leak audit stochastically) amplified by 1–2 dialogues of arm noise —
reported as the frozen rule requires, with this anatomy attached. A
successor run wanting a clean guardrail should fix the turn-9 staging,
not the committee.

**Seam — PARITY.** 24/40 = 0.600 ≤ 0.65 (full 20+20 battery); continuity
3.45 (committee) vs 3.75 (all-frontier) — trimmed fallbacks are slightly
more visible than composed turns but under the bar.

**Exploratory footnote.** Under the world-lexicon rescore the committee's
relative position also improves (the v2 battery selects cue-bearing
replies), but the frozen-instrument decision of 2026-07-20 stands; no v2
numbers are licensed readings.
