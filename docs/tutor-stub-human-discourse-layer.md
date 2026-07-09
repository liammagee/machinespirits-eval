# Tutor Stub Human Discourse Layer

Status: phase 2 implementation note for a breaking tutor-stub change.
Date: 2026-07-09

Current implementation status: phases 1-6 are implemented in the tutor-stub
surface. Tutor-stub runs accept `--dag-mode`; `strict_dag` remains the
audit-only baseline, while `human_scaffold` and
`defeasible_human_scaffold` actively add per-turn human-scaffold prompt context.
Completed turns record `humanDiscourseFrame`, `scaffoldState`, `sideArc`,
`proofDebt`, and `warrantPremiseAudit` records. Auto-eval summaries, HTML
reports, transition-training examples, and SQL ingest preserve the same
human-discourse metadata. Later work should refine the extractor and scoring
rubrics with empirical human traces; it should not remove the strict DAG audit.

## Summary

The tutor-stub proof DAG gives us an auditable chain of reasoning: every final
claim can be checked against public evidence, rules, and a release schedule. That
property should stay. But human discourse does not normally require every warrant
to be stated before moving on. Learners often make reasonable common-sense leaps,
ask clarification questions about language or setting, or need a short side arc
before returning to the proof.

This package separates the proof DAG from the human-facing teaching path:

- the DAG remains the hidden audit layer;
- a forward scaffold tells the tutor how a human should experience the case;
- proof debt tracks skipped warrants that may need later repair;
- side arcs let the tutor answer clarification or accessibility needs without
  losing the main case thread.

The goal is not to weaken proof discipline. The goal is to stop turning every
proof edge into a riddle.

## Why this is a breaking change

Existing Marrick-style runs treat the authored proof path as the main measure of
progress. That is useful for synthetic learner evals, but it overfits to a
learner that is willing to emit exact public claims on demand. Human learners
will often compress:

- "The dross matches the weir crucible" may be enough to accept "the blank
  points away from Verrell's mint crucible" for now.
- "The notched serif matches the worn burin" may be enough to accept "the die
  points away from Verrell's graver" for now.
- The exact intermediate warrant can be reopened only if later reasoning goes
  astray.

That changes what "progress" means. A run can advance in the human scaffold
without closing every strict proof premise immediately. Old strict-DAG metrics
remain valid as a baseline, but they should not be mixed naively with the new
human-scaffold metrics.

## Architecture

### 1. Strict audit DAG

The strict DAG stays responsible for:

- public evidence release discipline;
- leak prevention;
- final answer validity;
- exact missing-premise accounting;
- replayable, reportable proof coverage.

This is the research control and the final arbiter of whether the case is truly
grounded.

### 2. Human scaffold

The scaffold is a forward, learner-facing path derived from the world, not a
replacement for the DAG. It should expose ordinary instructional structure:

- current branch: for Marrick, "metal/blank" or "die/tool";
- local question: "whose blank?" or "whose die?";
- warrant frame: "if this mark uniquely matches that source, what does it
  license?";
- join reminder: "one branch is not enough; the same hand must satisfy both";
- current act intent from the world's dramaturgy where available.

The tutor may use this scaffold in plain language, while never revealing hidden
names or private proof notation.

### 3. Proof debt

Proof debt is a controlled record of accepted compression.

An allowed leap is not counted as a strict proof closure. It is marked as
provisional:

- `debt_id`: stable id for the skipped warrant or branch summary;
- `source_turn`: learner turn that made the compressed move;
- `scope`: local branch, join, language clarification, or final assertion;
- `status`: open, repaired, discharged, or harmful;
- `trigger`: contradiction, unsupported assertion, learner confusion, final
  assertion, or evaluator audit.

The tutor can continue while debt is open, but must reopen it when the learner
misuses it or when final closure depends on it.

### 4. Side arcs

Side arcs are non-proof detours that preserve human usability. They are not
failures and should not be mistaken for DAG stagnation.

Initial side-arc types:

- `language_clarification`: archaic vocabulary, setting, object names, roles;
- `task_clarification`: what the learner is being asked to do;
- `orientation`: who is who, what has been seen, what question is live;
- `affective_repair`: frustration, feeling lost, resistance to the story form;
- `method_question`: why evidence works this way, what counts as a warrant;
- `meta_request`: learner asks for a hint, recap, or example.

Each side arc needs a return contract:

- answer the side need briefly;
- connect it to the current branch or local question;
- ask for one next public evidence move.

Example:

"A burin is a small engraving tool. For the case, the only thing that matters is
which tool left this notch. So the live question is: does the notch point to
Verrell's clean graver, or to some other tool?"

### 5. Warrant framing

Warrant framing is the bridge between side arcs and proof debt. It gives the
learner the shape of a valid move without forcing exact predicate-by-predicate
recitation.

Useful frames:

- source frame: "this mark points to this source";
- uniqueness frame: "if only one source fits, that source carries the claim";
- contrast frame: "reputation is not evidence for this coin";
- branch frame: "we have a blank finding, not yet a die finding";
- join frame: "the same hand must satisfy both findings."

The tutor should prefer these frames before asking the learner to make a leap.

### 6. Warrant and premise stocktake

The assessment layer needs a separate stocktake for the material that ordinary
dialogue compresses:

- explicit warrants: claims the learner actually voiced as public inferences;
- implied warrants: warrants the learner appears to rely on without saying;
- missing warrants: warrants the tutor should reopen before final closure;
- explicit public premises: evidence already grounded in the learner record;
- implied public premises: public facts treated as accepted but not voiced;
- suppressed or private premises: possible hidden support that must not count as
  learner-grounded proof;
- common-sense bridges: harmless compression that can stand unless misused;
- illicit hidden premises: hidden names, facts, or final-answer material that
  leaked into the reasoning.

This is not the same as proof debt, but it feeds proof debt. A suppressed or
implied premise becomes debt only when later reasoning depends on it or when the
learner's use of it becomes unstable.

## Marrick as the first target

The current Marrick world already contains the right human-facing structure in
its `dramaturgy.acts`:

1. the town's ready Verrell verdict;
2. the metal/blank branch;
3. the die/tool branch;
4. the same-hand join.

The implementation should project this into the tutor turn context, so the tutor
knows whether it is helping the learner read evidence, frame a warrant, repair a
leap, answer a side question, or return to the main proof.

## Runtime implications

Add a new mode rather than changing strict DAG behavior silently:

- `strict_dag`: current semantics, proof-path coverage is primary;
- `human_scaffold`: forward scaffold plus proof debt, strict DAG still audits;
- `defeasible_human_scaffold`: human scaffold with explicit provisional closure
  and repair triggers.

The implementation can start with one CLI flag, but reports and traces should
record the exact mode.

## Trace and report implications

The transcript format should preserve:

- scaffold branch and local question per turn;
- side-arc type and return target;
- proof debt opened, repaired, discharged, or harmful;
- warrant/premise stocktake: explicit warrants, implied warrants, explicit
  public premises, implied premises, suppressed/private premises, and
  common-sense bridges;
- strict DAG coverage;
- scaffold coverage;
- final closure status: strict, defeasible-only, or ungrounded.

Reports label the active DAG discourse mode and carry turn-level scaffold
metadata into transcript notes and training examples. They should rank
human-scaffold runs separately from strict-DAG runs and show when apparent speed
came from harmless compression versus unresolved debt.

## Evaluation implications

Old Marrick evals are still useful as the strict proof-discipline baseline.
They should not be treated as directly comparable to human-scaffold runs without
labelling the mode.

The new QA comparison should include:

- strict baseline;
- human scaffold without proof debt;
- human scaffold with proof debt;
- side-arc stress profiles: language confusion, task confusion, premature leap,
  and clarification-heavy learner.

Success criteria should include:

- fewer unnecessary turn repetitions;
- no increase in final unsupported assertions;
- side arcs return to the main case within one or two tutor turns;
- proof debt is repaired when later reasoning depends on it;
- reports make strict proof coverage and scaffold progress visibly distinct.

## Implementation phases

1. Done: add schema and trace fields for scaffold state, side arcs, and proof
   debt.
2. Done: add warrant/premise stocktake fields for explicit, implied,
   suppressed, and common-sense material.
3. Done: project `dramaturgy.acts` plus release schedule into a human scaffold
   context.
4. Done: add prompt instructions for warrant framing, allowed leaps, and
   side-arc return contracts.
5. Done: update learner-record extraction to distinguish strict proof adoption
   from provisional scaffold acceptance.
6. Done: update auto-eval reports and SQL ingest to preserve scaffold/debt
   metrics and label DAG discourse mode.
7. Current verification: targeted tests plus a single Marrick mixed/human
   scaffold smoke before broader QA.

## Non-goals

- Do not remove the strict DAG.
- Do not count hidden final answers as acceptable leaps.
- Do not collapse leak discipline into "human friendliness."
- Do not treat synthetic learner success as human-learning evidence.
- Do not compare new and old evals without mode labels.
