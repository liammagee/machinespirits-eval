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

## 6. Cost bound and scope

≈ ≤ 700 sonnet CLI calls + ≤ 1,000 terra calls + local mini (resamples
free). One retry per dialogue; checkpointed; resumable. Out of scope:
any instrument change, KTO, retraining, codex-family arms.
