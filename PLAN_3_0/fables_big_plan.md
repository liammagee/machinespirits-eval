# Plan 3.0: Fables Big Plan

## TL;DR

The repo has essentially finished answering which mechanisms make a tutor better,
and which mechanisms are attractive but not worth rebuilding. What it has not
done is validate the architecture on human learners, compose the strongest
pieces into a single deployable reference tutor, replicate the one positive
conduct-governance line beyond its narrow formal setting, or build the
production layer around real curriculum, session persistence, cost ceilings, and
recovery from failures.

The remaining risk is concentrated in two questions the paper already names:
whether the results survive contact with human learners, and whether criterial
governance works outside fixed-destination formal tasks.

## Core Insight

The empirical lesson of the codebase inverts the usual adaptive-tutoring
roadmap. Most things called "adaptivity" in tutoring systems - learner modeling,
theory-of-mind modules, memory pads, profiling, and richer hidden state - appear
to be either already present in strong model context use or actively harmful when
made explicit. The buildable surplus is elsewhere:

1. Orientation: the recognition/intersubjective prompt is the reliable
   floor-lifter.
2. Governance: checkable criterial triggers beat advisory adaptive language.
3. Continuity: cross-session ego pre-alignment is the live longer-horizon
   adaptation channel.

So Plan 3.0 should not chase another mechanism by default. It should compose,
validate, and operationalize what the earlier work has already isolated.

## 1. What Is Already Settled

Build on these.

The intersubjective-pedagogy prompt is the workhorse: paper-full-2.0.md reports
the judge-pooled floor-lift around d ~= 1.63 across the model/judge panel, with
prompt-level effects that do not require a separate superego on capable models.
The relevant lesson is orientation, not Hegelian vocabulary as such: the
paper's constructivist controls replicate the benefit within a small band, while
the behaviorist-matched prompt falls below baseline.

The superego critic remains useful for weaker models, where it adds large
absolute gains, but it substitutes rather than stacks cleanly under recognition
on stronger models. The deployment recipe should therefore be capability-forked:
use a single-agent recognition tutor on a strong model; keep the critic for
weak or cheap models that need the repair layer.

For adaptation proper, the bounded positive evidence is in conduct governance:
rut-watching, typed state/action contracts, pacing guards, and yoked contingency
tests where state-contingent plans carry outcome-relevant information. This is
adaptation as constrained action under checkable conditions, not as free-form
learner modeling.

The longer-horizon positive channel is ego pre-alignment: repeated sessions with
a shared learner identity improve what the tutor proposes first next time. That
is the live adaptation bet now that within-session adaptive responsiveness has
become a well-powered null.

Do not rebuild these.

The repo already has strong negative evidence against within-session adaptive
responsiveness as the flagship claim, episodic memory pads, explicit learner
profiling prostheses, richer ToM/state-schema modules, mandated empathy markers,
text-only persuasion/conformity classifiers, aha-moment detectors, and
prompt-plus-critic stacking on capable models. Treat these as skip-list items
unless a future plan has a very specific reason to reopen one.

## 2. Research Still Needed

Ranked by dependency weight:

1. Human learners (A1). This is the P0 blocker. Every central result remains
   simulated-learner evidence. The pilot infrastructure is real - session store,
   routes, participant UI, item-bank loader, counterbalancing, scoring, and
   ingest into the standard evaluation pipeline - but the gates are
   non-engineering: IRB clearance, real consent text, and real test items. The
   current fractions bank is explicitly placeholder content and not for data
   collection.

2. Boundary-plan E2. The E2 runbook is complete and sanctioned: k=5 replications
   of the frozen lantern-p4 recipe under the Codex harness, with the kill rule
   defined as <= 1/5 grounded outcomes. This gates E3-E5. Until it runs, the
   strongest conduct-governance evidence remains narrow: one formal world, fixed
   destination, mechanical verdicts, and n=1 per arm.

3. Governance beyond formal rails. The open question is whether the same
   criterial-guard idea works for ordinary tutoring, where success criteria are
   fuzzy, learner progress is partial, and there is no proof-checker-style
   endpoint. That is the bridge from "conduct governance works in this fable" to
   "conduct governance can tutor."

4. Ego pre-alignment scale-up (A7 Phase 2). Because within-session adaptation is
   not the live channel, cross-session first-response improvement deserves a
   larger, controlled run with model and content variation.

5. Human expert coding and judge validity. The prepared human coding packet for
   the superego/taxonomy work still matters because the whole measurement stack
   depends on whether humans agree that the coded categories and AI ratings track
   real pedagogical distinctions.

6. Model-boundary mapping. The just-closed role-isolation work narrows the GLM
   boundary to dynamic-learner completion and target drift rather than tutor/id
   register production. That is useful, but it is not a full model-stack
   robustness claim. Plan 3.0 still needs an explicit capability map across
   tutor, learner, critic, and judge roles.

7. Closing screen of the synthetic mechanism space (added 2026-07-02; full
   analysis in `dynamic-adaptation-litreview.md`). A 44-candidate sweep of the
   2024-2026 literature found no genuinely new within-session adaptation
   mechanism; the field's strongest results run through this repo's three
   positives, and the one deployed within-session adaptive A/B in the
   literature is a null against a strong static prompt. The sweep licensed a
   $0 offline audit batch over existing logs — answer-leak rate,
   help-ladder compliance, mastery-gate counterfactual replay, learner
   fidelity/flip-selectivity metrics, and IRT ability placement of the learner
   personas (this last rides the A1 item authoring) — plus two bounded paid
   closing probes. Those paid probes are now complete: outcome-selected
   best-of-K returned a null on the validated held-out posttest endpoint, so
   the episode-level RL/outcome-reward selector path is closed for the
   synthetic program; the ESS learner 2x2 put a number on the simulated-learner
   objection, showing modest roleplay over-crediting and no recognition lift
   under a harness-owned constrained endpoint. Everything else the sweep
   surfaced is either covered by an existing null, foldable into sanctioned
   work (A7 Phase 2, A1 item bank), or human-phase by construction.

## 3. Engineering Still Needed

The eval harness is strong. The product shell around it is not.

1. Real teachable content. The pilot points at fractions, but the current item
   bank is placeholder-only and the existing trap/poetics materials are research
   probes rather than validated instructional units. Plan 3.0 needs one real
   domain package with lessons, examples, checks for understanding, remediation,
   and posttest alignment.

2. Composite reference tutor. No single cell is the blueprint. Assemble one
   profile from the validated pieces: strong-model single-agent recognition by
   default, model-matched light scaffolding when needed, criterial conduct
   guards, the task-session mastery scaffold, front-loaded first turn quality,
   and only the critic layers that the chosen model actually needs.

3. Session lifecycle. The live flow still needs durable pause/resume state,
   restart recovery, network/429 recovery, and a clean separation between
   research logs and participant-facing session state. Cross-session learner
   memory exists in design surfaces, but it is not yet a product path.

4. Cost control and economics. The evaluation architecture is observability
   heavy. Deployment needs hard per-student ceilings, automatic pause/fallback
   behavior, cost dashboards, and measured break-even points for the strong
   single-agent path versus weaker model plus critic.

5. Participant operations. The pilot needs real consent UX, identity isolation,
   admin visibility, safe data export, and deployment hardening before non-local
   use. The research server should not simply become the participant server.
   Add cheap behavioral logging to the pilot instrumentation while it is being
   hardened (compose-time per turn, attempt/hint events, optional audio with
   consent): the only adaptation channels the 2026 sweep found that pass the
   new-signal test by construction are non-text and human-only, and logging
   preserves them for post-hoc analysis without building any mechanism now.

6. Operational basics. Add progress dashboards, concurrent-learner load tests,
   accessibility review, packaged deployment, and failure-path tests for the
   routes a student will actually hit.

## 4. Suggested Order Of Attack

1. Run E2 first. It is sanctioned, bounded, cheap relative to its information
   value, and decides whether the conduct-governance line continues or stops.

2. In parallel, unblock A1's non-engineering gates: IRB, consent text, and real
   fractions items. The infrastructure is waiting on these rather than on a new
   mechanism. While IRB and item authoring proceed, run the litreview's $0
   audit batch and carry the two completed paid probes into the pilot go-memo:
   the outcome-selected null closes the last plausible synthetic selector
   upgrade, and the ESS result bounds synthetic-learner over-crediting. Use the
   Tutor CoPilot RCT effect sizes (+4pp topic mastery overall, +9pp for
   students of lower-rated tutors) as the prior for the pilot power analysis,
   and treat productive failure (d~=0.36 on exactly the pretest/posttest
   instrument the pilot has) as the best-evidenced candidate arm design.

3. Compose the reference tutor and wire it into the pilot/admin surface with
   session persistence and hard cost ceilings. This converts the blueprint from
   a research conclusion into something a learner can actually use.

4. Author one production-grade fractions curriculum package and align it to the
   pilot item bank.

5. Run the human expert coding packet to shore up taxonomy and judge validity.

6. Scale ego pre-alignment and model-boundary tests after the human path and
   reference tutor have stopped being hypothetical.

The one-sentence version: the research program has done its job; it knows what
to include, what to skip, and why. Plan 3.0 should turn that into a human trial,
a composed tutor, one replication gate, and a real curriculum.
