---
id: proof-lemma-layer
title: Lemma layer — a maintained higher-level proof structure (plan as data structure, not prose)
status: active
type: research
priority: P2
owner: unassigned
source: manual
created: 2026-07-04
updated: 2026-07-04
branch: worktree-strategy-ledger-followups
verification: "Gate 0 (free depth audit) recorded below. Line advances only by operator decision: design doc + own pre-registration before any engine code or paid run."
claim_status: exploratory
links:
  notes: exports/dramatic-derivation/lemma-layer/gate0-depth-audit.md
  items:
    - cross-model-plan-mode-interaction
    - plan-mode-stocktake
tags:
  - adaptive-tutor
  - derivation
  - outer-loop
  - proof-structure
  - lemma-layer
---

Operator articulation (2026-07-04, after the cross-model close): maintain a
SEPARATE proof structure at a higher level than the per-turn one — lemma-grain
sub-goals with their own dependency DAG, kept live like the premise-grain
state (a lemma is grounded when its sub-goal is derivable from the learner's
grounded set). The outer loop then operates on a formal object (the lemma
frontier) instead of prose: "where are we" = frontier state, "change course" =
re-pick the frontier path. Motivated by the arc's post-mortem: every surviving
mechanism was criterial/deterministic; every dead one was free-text judgment;
the one confirmed lift (pacing) was scheduling discipline; the flash result
showed weak egos answer open reflection with churn — a formal object makes
churn impossible. Redundancy risk (stall-watcher precedent): a derivable lemma
map shown as information will null on strong models — the layer must BIND
(lemma membership gates release eligibility, lemma clearance gates scene
exit), with a formal licensed-departure valve. Symmetry: learner side = mirror
lemma map computed from the learner's OWN grounded assertions, never a tutor
estimate. This is a task-representation change (stepping back from the
engine), not a third strategy-overlay variant — the closed outer-loop line's
consequences clause reserves exactly this route for operator decision.

**2026-07-04 Claude — GATE 0 (free depth audit): PASS with a pair-design
twist.** `scripts/audit-world-lemma-depth.js` (reuses the engine's chainer;
lemma candidates = intermediate derived facts on the authored proof path;
richness = # of valid grounding orders). Validated by hand on marrick
(4 intermediates, width 2, linExt 6, 1 AND-join — the authored alpha/beta
interleave). Catalog: 7/19 RICH (nocturne 8 orderings + width 3 + 4 authored
proof paths = richest; marrick/fengate/sealhouse/edmund 6; lantern +
ai-syllabus 3), 12 NONE. VERDICT: engine feature, not a world-authoring
project — the structure already exists. THE TWIST: the trusted
binding-conditions pair splits — marrick is RICH but the ENTIRE hethel family
(006, 010-015) is a pure linear chain (width 1, linExt 1, depth 5): a lemma
layer has literally nothing to decide there. Any lemma-layer contrast must
swap the hethel slot: either a cheap resistance probe (H0-style) on an
existing RICH world (fengate/sealhouse/edmund untested for resistance) or a
resistant variant of one (the hethel→hethel-resistant recipe). Multi-path
worlds (nocturne/lantern/bitterwell, 4 paths each) add path CHOICE as a
second, coarser frontier decision — bitterwell has path choice with zero
within-path order freedom (4 paths, linExt 1). NEXT (operator gate): design
doc + pre-registration; no engine code before that.

**2026-07-04 Claude — PRE-REGISTRATION DRAFTED per operator instruction**
(`LEMMA-LAYER-PREREGISTRATION.md`, doubles as the design doc; freezes at the
commit that launches the paid contrast). Mechanism pinned: lemma DAG
auto-derived from the authored proof path (chainer-exact, no authoring bias);
clearance criterial against the learner's own grounded set (regresses
natively under decay); scene-opening frontier choice = one enum field;
BINDING = active-lemma support gates proof releases (mirror/background
exempt) with tagged licensed departures; learner mirror from the learner's
own groundings. THREE arms — baseline / lemma-display / lemma-bound — so the
stall-watcher redundancy prediction (display ≈ baseline) is tested inside the
design; promotion rides on bound-vs-baseline only (T* primary, direction both
worlds + U ≤ 42 at 12/12 + guardrails incl. 0 untagged departures). World
slot W by pre-registered probe procedure: fengate → sealhouse → edmund, 3
baseline runs each (seeds 83/89/97), first to show headroom fills it;
all-fail → back to operator as an authoring decision. Contrast seeds
59/61/67/71/73/79 (verified disjoint from all prior matrices). 36 runs,
codex, blocks sequential at concurrency 3. REMAINING before freeze, in
order: implement + gate, analysis design entry + specs, zero-paid
validation, probe — then the freeze commit launches the contrast.

**2026-07-04 Claude — world-slot probe, candidate 1 (fengate): FAIL.** 3/3
baseline runs grounded at exactly T\*=22 (seeds 83/89/97, spread 0, all 9
releases played, one interruption resumed label-exactly). Fengate is
schedule-solvable AND decay-robust under the binding stack — three different
decay schedules produced byte-similar outcomes — so the primary endpoint
would have no variance there. Per the pre-registered order the probe moves
to candidate 2 (sealhouse, same seeds/rule). Side-note for the catalog:
fengate's decay-robustness contrasts with marrick/hethel-resistant, where
the same decay grid produces failures — release-schedule slack, not world
depth, seems to set decay sensitivity.

**2026-07-04 Claude — world-slot probe, candidate 2 (sealhouse): FAIL,
byte-identical signature.** 3/3 grounded at exactly T\*=22 (seeds 83/89/97,
spread 0; one interruption, r2 resumed label-exactly). Two candidates, six
runs, six identical outcomes — the generalization-arc 28-cap worlds are
uniformly schedule-generous under the decay grid that reliably breaks
marrick. Proceeding to candidate 3 (edmund, cap 18 / t_min 10 — the one
genuinely different geometry). If edmund also fails, the frozen consequence
fires: no contrast; the line returns to the operator as a world-authoring
decision (resistant variant of a RICH world).

**2026-07-04 Claude — world-slot probe EXHAUSTED; the frozen consequence
fires.** Candidate 3 (edmund) is INELIGIBLE: no derivation tutor role-script
exists (world authored for the character-development arc; all three arms died
at import in 0.2s). With fengate and sealhouse both failed on identical
T\*=22 signatures, the pre-registered procedure ends without filling slot W —
so the 36-run contrast does NOT run under this pre-registration. What the
probes taught: headroom under this decay grid comes from schedule slack, not
proof depth — marrick is the only world that is both RICH (lemma-orderable)
and decay-sensitive. NEXT (operator decision, pre-registered consequence):
world authoring — the natural move is a marrick-resistant variant
(hethel→hethel-resistant recipe on marrick's width-2 geometry), then its own
headroom probe, then a fresh freeze. All implementation/gates/analysis/
zero-paid work stands and carries over.

**2026-07-04 Claude — world-019-marrick-resistant AUTHORED + screen PASS
(decisive).** The 006→010 recipe on marrick: only the public learner framing
changed (verdict pre-entered in the trial-book margin; correction = threat to
standing; reluctant concession); proof geometry/schedule/tokens/script
byte-identical; lemma audit RICH identical to marrick; all 6 catalog
invariants pass. Headroom screen (seeds 83/89/97, rule pre-stated in the
spec): 3 verdicts in 3 runs — disengagement t18 / UNSTAGED_RECOGNITION t28
(forced, never asserted — the resistant signature) / grounded T*=23. Variance
+ not-a-floor both met. The lemma contrast pair is now marrick +
marrick-resistant; remaining before the paid 36-run contrast: update the
prereg's worlds section + write lemma-marrick-resistant.yaml spec, fresh
FREEZE commit = launch (operator gate).
