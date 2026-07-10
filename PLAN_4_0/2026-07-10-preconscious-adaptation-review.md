# Review: `preconscious` vs `main` — progress toward genuine adaptation

Date: 2026-07-10
Branch: `preconscious` (41 commits ahead of `main`, ~27k insertions across 59 files, plus uncommitted QA-matrix/profile-suite hygiene work)
Method: five parallel subsystem readers plus an adversarial verifier that re-checked every load-bearing number from the artifact JSON directly (closed-loop-tells standard). Full per-subsystem outputs archived in the session scratchpad (`review-{fieldRt,stub,registers,evidence,qa,skeptic}.json`).

## TLDR

The branch has built an impressive amount of adaptation *machinery* — but on the architecture-independent outcome channel it has produced **zero evidence of adaptive gain so far**, and the review found **four concrete blockers** that make such evidence impossible to produce with the harness as it stands. The most valuable thing the branch has actually established is negative-space instrument knowledge: the simulated learners were near-clones, the headline "field beats bland" delta is a scoring artifact, and the Phase 6 placebo arm cannot currently do its job. All fixable, and the scaffolding underneath is sound.

## What the branch built

Two coupled workstreams:

**1. The preconscious tutor stub** (`scripts/tutor-stub.js`, ~9k lines). A deliberately standalone CLI tutor on the dramatic-derivation detective worlds — no server, no DB, no cell registry. "Preconscious" names the pre-response stance-selection layer: each learner turn is LLM-classified, a tutor-side learner proof-DAG is extracted and deterministically closed, and one of 11 register policies picks the tutor's stance before the tutor model writes the reply. The policies span controls (bland, random, negative floor), hand-coded control laws (state, field, trajectory, dynamical_system), the stack's **first fitted component** (empirical priors from 8,990 logged register-outcome observations via `scripts/build-tutor-stub-register-priors.js`), and continuous register blends. Around this sits a large harness: auto-learner with until-grounded stopping, QA matrix, profile contracts, ABM panel, SQL ingest of per-turn frames, and a human discourse layer (phases 1–6 built).

**2. The field-theory runtime** (PLAN_4_0 → `services/dramaticDerivation/fieldPlanner.js`, `pedagogicalScripts.js`). Learner/tutor/discourse/joint "fields" computed per turn, a deterministic candidate-move projection layer with advisory and enforce modes, and a pre-registration-style Phase 6 evidence gate (`PLAN_4_0/PHASE_6_EVIDENCE_GATE_PLAN.md`) with a frozen-manifest runner.

## What the evidence actually shows

**The QA matrix headline is a scoring artifact.** The July 9 matrix (6 profiles × 7 policies × 3 runs = 126 rows, real codex.gpt-5.5) shows every outcome channel tied at ceiling: 126/126 grounded, reliability = 1, closure = 1, mean turns flat at 24.0–25.3 for every policy *including bland*. The advertised "field +0.122 vs bland" is arithmetically the registerDiversity term of the composite score: it carries 0.14 weight (`scripts/analyze-tutor-stub-auto-evals.js:449`), bland's diversity is zero by definition, and 0.14 × 0.866 = 0.121 ≈ the whole gap. The verifier confirmed this in both matrices, and noted the hostile negative floor (sarcasm/face-threat only) also "beats" bland by +0.07 the same way. The score rewards being the mechanism under test.

> Aside: this is the purest form of the closed-loop tell found in the codebase so far — the confound is not in the model or the judge, it is a single weight in a composite score. That makes it unusually easy to fix (report outcome axes separately) and unusually dangerous to leave, because every future QA report will re-manufacture an "adaptive wins" delta automatically.

**The Phase 6 gate has not been run — and one of its arms is broken.** What exists: a dry run (0 executed rows), two mock plumbing smokes, and exactly **one real-model row** (marrick, enforce arm only, grounded at 23 turns, 9/9 releases, 0 safety failures — no baseline arm to compare against). The plan text's own "Phase 6 remains unrun" is accurate. The mock decay smoke's only separation (enforce 1/4 grounded vs 0/4 everywhere else) is release-forcing under an engineered decay with a deterministic mock learner — the same pattern as the adversarial-superego result, where the override channel, not learner-modeling, is load-bearing. Worse, the verifier found a latent gate-integrity bug: **the `field_report_only` placebo arm is byte-identical to baseline** — both have empty flags in `scripts/run-derivation-phase6-gate.js` (ARM_REGISTRY), the interaction field is computed unconditionally in the engine, and the mock placebo transcripts diff clean against baseline. Decision rule 2 ("improvement not reproduced by report-only") would pass vacuously. The plan's description "field reporting enabled" is false of the code.

**The fields re-encode; they don't measure.** Every learner-field dimension is a hand-picked constant keyed on board flags (mastery = held ? 1 : grounded ? 0.85 : released ? 0.25 : 0.05); tutor "rapport" runs off a 9-word positive-cue regex; discourse dims are word and question-mark counts. Zero fitted parameters, zero LLM inference in estimation, and a due scheduled release hard-overrides any field score. This is precisely the hand-coded-state-machine class the project's prior "what actually makes an agent adaptive" finding ranked below plain in-context adaptation — no new signal about the learner enters the loop. The `projectionAlignment` metric also self-grades: it marks a turn "directionally_matched" if *any* of five formal quantities improved, regardless of which move was chosen, so the reported 0.39–0.57 movement rates are roughly the base rate of productive learner turns.

**The learner population had nothing to adapt to.** The branch's own discrimination audit found the 6 core profiles behaviorally near-identical — average pairwise cosine 0.986 against a ≤0.85 gate (fail). This retroactively voids every "robust across observed learners" read: there was one learner wearing six names. The contract sharpening then passed marginally at n=8 (0.848), but **failed to replicate at n=60 the same day (0.912)** — and the uncommitted `docs/tutor-stub-learner-profile-robustness.md` narrative currently ends at the pass, omitting the later failure. Since that doc is still in the working tree, add the n=60 result before commit. The discrimination check itself is also a manipulation check rather than learner realism: profile prompts embed the exact classifier-label distributions the gate then measures.

**The one outcome-channel signal doesn't survive scrutiny.** In until-grounded runs, adaptive policies grounded faster than bland (28.3 vs 48.7 mean turns, n=3). But the hostile negative policy also beat bland (38.3 pooled; 33.3 vs 52.7 on the skeptical profile at n=12), and field *lost reliability* on skeptical (9/12 grounded vs bland's 12/12). The defensible residue is "any register variation changes the simulated learner's pace," not "adaptive selection helps." The fitted priors, meanwhile, are empirically inert: corrections of 0.064–0.173 logits against ±1.5 affinity terms, with empirical_dynamical_system indistinguishable from the unfitted policy in both matrices.

## What genuinely holds

- **Gate scaffolding is real and good.** Frozen manifests with git SHA before any model call, idempotent resume, exit-2 on safety failure, and — crucially — a mechanical, architecture-independent primary endpoint (grounded anagnorisis via entailment over the public board). When the gate runs, the loop closes on the right channel. No gate redefinition or semantic rerolls were found anywhere.
- **The instrument caught its own degeneracy.** The discrimination gate detected the near-clone learners and the failures were documented rather than hidden. That finding is worth keeping regardless of where the arc goes.
- **Ontology v2** genuinely decouples register from learner signal — the precondition for register policy to be a free variable rather than an echo.
- **Substrate for the first learned component exists**: per-turn frames in SQL, the priors fitter, and the triaged transition/reward-model card. That card — not the hand-coded field planner — is where a real learned-adaptation claim could eventually be tested.
- **Self-scoping throughout**: the code and docs repeatedly caveat themselves ("Heuristic local association only," "not a paper-grade learning effect," "mock runs validate plumbing only"), and the human discourse layer explicitly refuses to treat synthetic success as human evidence.

## What must change before evidence is possible

1. **Fix the placebo arm** — `field_report_only` must actually inject the field report differentially, or rule 2 can never bind.
2. **Separate outcome from diversity in the QA score** — report outcome axes on their own; the composite as-is will keep fabricating adaptive wins.
3. **Create headroom** — at the world-005 release-schedule floor with 100% grounding everywhere, no policy difference *can* show. Decay conditions, the sharpened resistant profiles (never yet run against the policy suite for outcomes), or tighter caps.
4. **Then run the actual gate** — four arms × k≥5 real-mode, with a real baseline arm, and break the codex.gpt-5.5 monoculture (one model currently plays tutor, learner, classifier, and record-extractor).

Housekeeping: the entire empirical record (`exports/`, `.tutor-stub-auto-eval/`) is gitignored and machine-local, so provenance currently rests on one working tree (connects to the standing consolidate-logs task). Also, the two `phase6-*.md` replay reports in exports are the *prior* conduct-policy arc from main (June 16), not this branch's evidence.

## Bottom line

Measured against the project's own bar — new signal, closed on an independent channel — this branch is at the "instrument built, instrument audited, instrument found wanting in specific fixable ways" stage. That is real progress of the unglamorous kind, and the audit findings (clone learners, diversity confound, degenerate placebo) are themselves the branch's most defensible results to date. The adaptation claim itself remains entirely open.

## Implementation status (2026-07-10, same day)

Blockers 1–3 were implemented immediately after this review:

1. **Placebo arm fixed.** New `--field-report-context` mode threads the
   coupled-field summary into the tutor context with no planner authority:
   `buildFieldReportContext` in `services/dramaticDerivation/fieldPlanner.js`,
   engine option `fieldReportContext` (per-turn rows in
   `result.fieldReportContext` with non-leak audits), `FIELD REPORT` prompt
   block in `llmRoles.js`, flags in `run-derivation-loop.js` /
   `run-derivation-episode.js`. The gate's `field_report_only` arm now passes
   the flag (`run-derivation-phase6-gate.js`), report-context audit failures
   count as safety failures, and tests pin the arm as flag-distinct from
   baseline. Verified end-to-end with a mock gate smoke
   (`phase6-placebo-arm-fix-mock-smoke`): 22 report rows, audits pass,
   baseline unchanged. Both plan docs updated to match the code, including the
   real-mode seed-scope caveat.
2. **QA score separated.** `analyze-tutor-stub-auto-evals.js` now computes an
   outcome-only score (reliability, closure, coverage, turn efficiency, leak
   discipline); ALL policy rankings, robustness verdicts, and baseline deltas
   run on it. Register diversity is a separate labeled process column; the
   legacy composite survives only as an explicitly-named process score. A
   regression test pins the confound: tied outcomes + diversity gap must give
   delta 0.
3. **Headroom suite added.** `--suite headroom` in the QA matrix pairs the
   discriminable sentinel profiles with bland/negative controls plus
   representative adaptive arms under a binding `--safety-turns 40` cap
   (defaults auto-resolve; explicit overrides win and emit warnings). This is
   the arena for the first real outcome contrast.
4. **Gate run — not launched.** The real four-arm k≥5 Phase 6 gate and the
   headroom contrast are paid, attended runs; the machinery is ready and the
   commands are documented (`docs/tutor-stub-learner-profile-robustness.md`,
   `PHASE_6_EVIDENCE_GATE_PLAN.md`), pending a go.

The robustness doc's n=60 omission had already been fixed in the working tree
by the concurrent contract-v2 work before this implementation pass reached it.
