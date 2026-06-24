# D3 Independent Endpoint and No-Cost Fixture

Date: 2026-06-24
Branch: `codex/d2-d6-followups`
Status: plain-language companion to `notes/d3-heavy-bridge-followup-gate.md`.

## Bottom Line

"First design the independent endpoint and a no-cost fixture" means:

Before spending money on another D3 bridge experiment, decide how we will know
it actually worked, using a measure that is not the same thing the system is
trying to optimize. Then prove the new machinery can run in a cheap mock setup.

In plain terms: do not pay for a bigger run until we have a fair scoreboard and
a dry run.

## Why This Matters

D3 is about the insight-action gap. The tutor may "understand" something inside
its reflection, but the important question is whether that insight changes the
actual teaching move the learner sees.

Bridge 3 selected candidate outputs by coupling cosine. Coupling cosine is a
similarity score: it asks whether the final teaching move lines up semantically
with the internal reflection. That is useful, but it is not enough.

If we choose outputs by coupling cosine and then declare success because coupling
cosine improved, we may only be proving that search can optimize the search
metric. That is the Goodhart problem: when a measure becomes the target, it can
stop being a trustworthy measure of the real goal.

## Independent Endpoint

An independent endpoint is the real success test, chosen before the run, that is
not identical to the selection metric.

For D3, good independent endpoints could be:

- tutor quality under the normal v2.2 rubric;
- learner quality;
- dialogue quality;
- end-of-question rate if the bridge is meant to change learner-facing action;
- a blind qualitative judgment where the judge does not know which arm produced
  the response;
- a mechanical check that the response changed the practical teaching move, not
  just the wording.

The key rule is simple: if the bridge selects outputs using coupling cosine, the
primary verdict cannot be coupling cosine alone.

## No-Cost Fixture

A no-cost fixture is a small mock test that proves the proposed architecture is
wired correctly before any paid model calls.

For D3, a fixture should show things like:

- the reflector can produce a useful internal state;
- the actor receives that state;
- the actor changes the teaching move because of it;
- the actor does not merely paraphrase the reflector;
- the scoring/export path records the contrast cleanly;
- the stop rule fires if the architecture produces reflection text but no
  learner-facing action change.

This fixture does not prove the research claim. It only proves the experiment is
worth paying for.

## What Would Make D3 Ready To Run

D3 becomes ready for a paid Bridge 3b/4/5 run only when a new item records:

- which bridge is being tested;
- the frozen independent endpoint;
- the old selection metric, if any;
- the pass/fail threshold;
- the no-cost fixture result;
- the budget;
- the stop rule.

Without those pieces, a bigger D3 run would mostly test whether we can spend more
money to improve the metric we already optimized.

## What This Means For Now

D3 is closed on this branch. It is not disproven forever, but it is not ready for
more paid work.

The next D3 step is design, not execution: build the fair scoreboard first, then
run a mock fixture, then decide whether a paid run is justified.
