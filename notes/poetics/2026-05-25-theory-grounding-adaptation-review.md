# Theory Grounding Review For Tutor Adaptation

Date: 2026-05-25

Status: reflective design note, no new data and no code changes. This note is
meant to sit beside the active poetics generation/evaluation work without
interfering with current batch artifacts.

## Prompt For The Review

The current adaptation branch has become technically precise: tutor uptake,
low-organic controls, baseline leakage, no-cue arms, sidecar rows, and critic
separation. That precision is useful, but it risks making the core object look
like an engineering nuisance instead of a dialogical and dramaturgical event.

The theoretical question is sharper:

> Are we measuring a pedagogical drama of aporia, reversal, recognition, and
> answerability, or are we repeatedly tuning expensive generation/evaluation
> cycles around proxy terms that have drifted away from the theory?

## Current Theory Is Present, But Not Yet Governing Enough

The framework already contains real theoretical scaffolding:

- `config/poetics-calibration/pedagogical-approaches.yaml` names Socratic
  elenchus, Vygotsky, Montessori, Brecht, Hegelian recognition, Dewey, and
  Freire as director-facing repertoires.
- `config/poetics-calibration/dialogue-approaches.yaml` names Aristotelian
  reversal/anagnorisis, Shakespearean scene-turns, Brechtian interruption,
  Bakhtinian polyphony, workshop clinic, courtroom evidence pressure, and other
  public forms.
- `config/poetics-calibration/PHASE2-DESIGN.md` correctly refuses to claim
  hidden learner states. It defines recognition as a textual relation: a later
  learner turn re-reads earlier turns with quotable warrant.
- `config/poetics-calibration/PHASE2-PRODUCTION-NEXT.md` already says the
  dramatic-theory inheritance is structural rather than ornamental.

The gap is not absence of theory. The gap is that the daily operating language
has shifted toward measurement shorthand. "Tutor uptake" is a useful audit
column, but it is not the phenomenon. "Low-organic control" is a useful negative
case, but it is not a pedagogical concept. "Baseline leakage" is useful QA
language, but it hides the more important fact: some scenes produce unsponsored
aporia before the branch intervention begins.

## A Theory-First Construct Ladder

The branch should treat the following sequence as the conceptual spine:

1. **Ordinary continuity.** The dialogue proceeds by naming, practicing,
   sorting, or applying. There is no crisis in the learner's first frame. This
   is what the current shorthand calls a clean low-organic control.

2. **Aporia.** The learner's available frame stalls. This can appear as
   confusion, contradiction, false closure, embarrassment, resistance, or an
   object/task that will not behave under the learner's rule. Pedagogically,
   this is not a failure state; it is the charged pause before reorganization.
   Dramaturgically, it is the suspense or stasis before reversal.

3. **Peripeteia.** The situation turns. What looked like the route forward
   becomes part of the problem. In tutoring, this need not be theatrical. A
   table header, contour line, graph axis, force arrow, rubric phrase, or
   institutional rule can reverse the learner's first use of it.

4. **Anagnorisis / recognition.** A later learner turn re-reads the earlier
   utterance or action. The crucial sign is not "I get it"; it is a changed
   relation to the prior frame. The transcript now makes the old line mean
   something it did not mean before.

5. **Dialogical answerability.** The tutor does not merely witness the learner's
   recognition. The tutor becomes answerable to it: changes the task, evidence
   standard, object, role, register, scaffold, or constraint because the learner
   has changed the shared situation. This is what "tutor uptake" is trying to
   measure, but "answerability" keeps the concept dialogical.

This ladder should govern design before paid generation begins. The measures
should be audit traces of this ladder, not substitutes for it.

## Translation Table

| Current shorthand | Better conceptual name | What it should mean |
|---|---|---|
| `low-organic control` | ordinary-continuity scene | A scene where the initial frame can continue without an inherent reversal. |
| `baseline leakage` | unsponsored aporia / unlicensed reversal | The negative arm contains its own aporia or re-reading before the intended intervention. |
| `no-cue skip` | failed continuity contrast | The control is not scoreable as a negative case because it already performed the treatment. |
| `learner self-reframe` | anagnorisis / recognitive re-reading | The learner makes their earlier utterance newly readable. |
| `peripeteia-only` | tutor-sponsored aporia route | The tutor's internal route change creates or uses aporia before learner anagnorisis. |
| `tutor uptake` | dialogical answerability | The tutor changes because the learner's re-reading has changed the shared object. |
| `trap` | false recognition costume | The dialogue declares insight without textual recontextualization. |

The old terms can stay in code and database columns. The reports and design
notes should increasingly foreground the conceptual names.

## Risk Of Thrashing

The current cycle risks becoming unproductive when it does this:

1. generate a batch;
2. discover the negative case was not theoretically negative;
3. patch leakage detection;
4. add new arms;
5. repeat with more cost.

That cycle improves tooling, but it does not by itself deepen the theory. It can
also teach the generator to satisfy detectors instead of staging pedagogically
legible aporia and recognition.

The way out is not fewer measurements. It is a stronger pre-generation theory
gate.

## Proposed Pre-Generation Theory Gate

Before any scaled paid run, each candidate drama should pass a short design
screen:

1. **Aporia source.** What exactly can become unavailable to the learner:
   concept, rule, object use, social position, evidence standard, role, or
   affective stance?

2. **Dramatic function.** Is the scene ordinary continuity, sponsored aporia,
   boundary aporia, hard trap, or false-closure trap?

3. **Pedagogical lineage.** Which repertoire is actually doing the work:
   Socratic elenchus, Vygotskian scaffold/fade, Deweyan inquiry, Freirean
   problem-posing, Montessori object work, Brechtian interruption, Hegelian
   recognition, or another named tradition?

4. **Expected learner work.** What public act would count as recognition without
   inferring private learning?

5. **Expected tutor answerability.** If the learner re-reads their frame, what
   would it mean for the tutor to become answerable to that change?

6. **Anti-trap clause.** What would merely look like insight while leaving the
   earlier frame unreorganized?

7. **Negative-case clause.** Why should the ordinary-continuity arm remain
   ordinary? If the material itself naturally creates aporia, it is a boundary
   probe, not a clean negative control.

This would prevent some expensive cycles by catching concept-level failures
before critic scoring.

## What The Current Results Suggest Under This Lens

The strong current result is not "adaptation established." It is:

- explicit reframe cues reliably produce recognitive form;
- many low-organic attempts were not actually ordinary-continuity scenes;
- the sidecar correctly shows that learner anagnorisis and tutor answerability
  are separable;
- peripeteia mechanisms are present but not yet reliable as external recognitive
  form without learner reframe support.

That is useful, not disappointing. It says the theory is finding a real
distinction: a learner can undergo a textual recognition event while the tutor
does not yet become dialogically answerable to it.

## Concrete Next Moves

1. Rename report prose, not necessarily code columns. Keep `tutor_uptake` in the
   database if needed, but call the concept "dialogical answerability" in notes
   and summaries.

2. Treat D35/D39-style cases as boundary aporia, not failed controls. They are
   theoretically interesting because the object itself sponsors reversal.

3. Build the next scaled run from ordinary-continuity candidates first. D40/D42
   are closer to this shape than D35/D39. The newer D44-D46 candidates should be
   screened with the theory gate before being trusted as controls.

4. Add a small human/theory audit before another full critic panel. A single
   table with columns for aporia source, peripeteia mechanism, recognition act,
   answerability act, and trap risk may be more valuable than another immediate
   model-judge pass.

5. Do not chase "more tutor uptake" as a standalone target. Ask instead whether
   the tutor becomes answerable to the learner's new relation to the object. A
   tutor can quote the learner and still fail dialogically; another tutor can
   change the task without explicit quotation and succeed.

6. Keep the strict textual discipline. The theory should not license claims
   about actual inner learning. It should improve the design of public scenes
   whose form makes aporia, reversal, recognition, and answerability legible.

## Bottom Line

The framework is not merely thrashing, but it is at risk of doing so if the
technical labels become the primary object. The current machinery should be
reframed as instrumentation for a dialogical-dramaturgical construct:

> learning drama begins in aporia, turns through peripeteia, becomes legible as
> recognition/anagnorisis, and is completed only when the tutor becomes answerable
> to the learner's changed relation to the shared object.

That sentence should discipline the next generation plan more than any single
sidecar metric.
