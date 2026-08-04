---
id: tutor-instrumentation-showcase
title: Instrumentation showcase — two free-running dialogues, bare vs
  instrumented, run to close
status: done
type: infra
priority: P2
owner: claude
source: manual
created: 2026-07-26
updated: 2026-08-04
verification: "`npm run tutor:stub:showcase -- --print-plan` emits a finite
  zero-call plan whose arms hold learner parity in every preset; a paid run
  writes report.json, report.md, and a turn-aligned two-column transcripts.html;
  each arm's resolution verdict comes from the stub's own closure lifecycle, and
  guard coverage is read from the stub's `tutor_response_guard_accounting` rows
  rather than from the audit records the turn carries either way; each scoring
  pass (`npm run tutor:stub:showcase:rubric`, `npm run
  tutor:stub:showcase:pr-benchmark`) writes its own artifact beside report.json
  and re-renders transcripts.html, so a run scored by both instruments, by one,
  or by neither shows the scores it actually has and names the axes nobody
  asked; `--rubric-version 3.0` writes `rubric-v3.0.json` beside the v2.2
  artifact rather than over it, with the page rendering the two versions as
  separate labelled blocks that are never averaged; and a page carrying two
  scored versions also carries the instrument-contrast panel — spread,
  within-version dimension redundancy, turn-by-turn divergence, a per-dimension
  radar, and the whole-transcript instrument it declines to run — alongside a
  jump menu whose every entry resolves to a section the page rendered and a type
  control that scales the whole document from one root font size."
claim_status: methods
depends_on:
  - tutor-instrumentation-ab-harness
links:
  notes:
    - docs/tutor-instrumentation-showcase.md
  items:
    - tutor-instrumentation-ab-harness
tags:
  - tutor-stub
  - instrument
  - demo
branch: worktree-showcase-readability-and-rubric-contrast
---

The frozen A/B answers what a given advisory block buys on one recorded turn.
It cannot produce a conversation that ends: the frozen learner utterances were
written in reply to the recorded tutor, so no arm is ever talked to a
conclusion. Showing the system to anyone outside the project needs transcripts
that resolve.

This item builds the second instrument. Each arm spawns its own
`scripts/tutor-stub.js` child with `--auto-learner`, runs to its own close on a
short contemporary world, and both are rendered side by side with a benchmark
panel: turns, calls, seconds per turn, tokens, guard coverage, guard failures,
first-draft repairs, and whether the dialogue resolved.

Design decisions worth keeping:

- **Learner parity is the free-running analogue of the A/B's guard pinning.**
  Nothing can be frozen here, so the plan freezes everything *except* a declared
  tutor-side flag set. `assertTutorStubShowcaseLearnerParity` strips those flags
  from each arm's child argv, normalises the per-arm trace directory, and
  requires a byte-identical residue per (scenario, model) cell. Without it a
  "bare" arm could quietly get an easier learner and the demo would be showing
  the learner. A flag outside the declared set is rejected at config load.
- **The baseline has to be `--passthrough`.** The first version built it by
  dropping flags (`--no-classifier --no-memory-summary`, no `--dag`) and that arm
  was not bare: the guard suite, first-draft recovery and the closure lifecycle
  all run unconditionally in `scripts/tutor-stub.js`. On a real Riverside
  dialogue that "bare" arm made 4 calls per turn, had 5 drafts sent back, and
  closed on `strict_learner_dag_grounded_and_asserted`. `--passthrough` is the
  only mode that actually bypasses them. Driving it with `--auto-learner` took
  unblocking three independent layers — the stub's arg-forcing block, the
  `passthrough_isolation` capability rule, and `learnerSuggestionEnabled`
  doubling as the learner-model gate. The first of the three failed silently:
  the child dropped into the interactive REPL, hit EOF, and exited 0 having done
  nothing, which the harness recorded as a 0-turn dialogue rather than an error.
- **The last resort has to be unrejectable.** The first free-running runs died
  mid-turn on `guard_exhausted_without_public_delivery` in both worlds: every
  candidate rejected, the deterministic fallback included, so the tutor reached
  a turn with nothing it was permitted to say. Both were blocked on dramatic
  *form* (`opaque_clue_release`, `missing_exhibit_action`) — properties of the
  authored clue text, which fixed harness wrapper text cannot supply. The
  terminal-fallback accommodation in `services/tutorStubGuardDisposition.js` now
  covers dramatic form alongside conversational integrity and optional actorial
  realization, keyed on the shadow column already reading advisory so that
  `live_source_action_alignment_v1` and the two public-state `dramatic_release`
  types stay fatal there. Evidence, clue-transaction and closure boundaries are
  unchanged: a fallback that leaks still kills the dialogue, as it should.
- **Guard coverage comes from `tutor_response_guard_accounting`, not from the
  audit records.** The turn record carries an audit object whether or not the
  guard ran, so counting records measures "did the turn happen". An early version
  did exactly that and reported identical 56/56 coverage on both arms — a
  parser artifact, not a result. Coverage now reads
  `accounting.guards.*` booleans; `auditsFailed` (merit) stays a separate column.
- **Accepted, repaired and fallback are three columns.** A
  `guarded_deterministic_fallback` means the draft was rejected and a canned line
  went out — a cost of the guard stack. Summing it into repairs would let a loss
  read as a win.
- **Resolution is the stub's own verdict**, read off
  `dialogueClosure.lifecycle.completedAtTurn`, not off the transcript text — the
  same mechanism asked of both arms. It is tri-state: `--passthrough` bypasses
  the closure lifecycle, so such an arm reports `null` (no verdict, `n/a` in the
  table) rather than `false`, and `closureMeasurable` is the denominator.
  `stopReason` records why an unresolved dialogue stopped, and `budgetBinding`
  prevents a truncated dialogue being read as a finished one.
- **First-draft repair is the architectural moment.**
  `turnRecord.tutorResponseRepaired: true` marks a draft that failed its guards
  and was regenerated before the learner saw it. Machine-recorded, so the demo
  shows measured behaviour rather than a characterisation of it.
- **Turn-aligned columns, not swimlanes.** Free-running arms share no learner
  spine, so the A/B's renderer does not apply. Each arm gets a full-height
  column and the columns align by turn index; a cell past the end of a shorter
  dialogue says so rather than shifting rows out of alignment.
- **The first showcase run resolved nothing, for two reasons that had nothing to
  do with the harness.** Both instrumented dialogues ran to the turn cap with
  `assertedSecret: false` and bottleneck `assertion_gap`. The learner had in fact
  reached the concealed conclusion and voiced it through the DAG's `derive`
  channel, which the assessment did not record at all, so the gap read the same
  as never having got there. Separately, both
  arms kept selecting `stage_next_step` after the release schedule was spent,
  sending the composer after a clue that no longer exists — and in Campus FAQ the
  culprit was not the action-family selector (which chose `compress_sayback`
  correctly on turn 9) but `applyTutorStubConversationalCompletionSelection`
  overwriting it with an instruction to introduce new public evidence. Both are
  fixed on `main`: the snapshot now records
  `voicedSecretDerivation` and the assessment reports `secretStatedVia`, and
  `tutorStubReleaseScheduleExhausted` redirects both override sites to
  `compress_sayback`.
- **The voiced channel reports, it does not close.** The first version of that
  fix folded a voiced derivation into `assertedSecret`. Meanwhile `main` landed
  `services/dramaticDerivation/answerSurface.js` — a text-to-constant bridge
  repairing the same symptom at its root, since the matcher had been treating an
  apostrophe as a word boundary and so could not see an answer the learner had
  claimed. The two fixes collided on merge: `main`'s tests pin that a learner who
  derives the concealed fact and then names the mirror suspect has made a wrong
  assertion, which folding the channels would erase. `assertedSecret` is now the
  assertion slot alone, `answerSurface` owns recognising a claimed answer, and
  `voicedSecretDerivation` / `secretStatedVia` sit beside them — which is what
  makes "reached it and never claimed it" distinguishable from "never reached
  it", the ambiguity `main`'s own commit message names.

- **The baseline is evaluated but not gated (`--observe-audits`).** Passthrough
  fused evaluation with enforcement: bypassing the guard suite bypassed the
  audits with it, so the bare arm recorded nothing and could not be scored on
  the same gate as the instrumented arm. The flag splits them. On each bare
  turn, after the draft is final, the stub runs the two audits that need no
  per-turn contract — leak and repetition — and writes them to the turn record.
  They run in `runPassthroughTurn` after `callTutor` has returned, so nothing
  can reach the repair loop, and `buildTutorStubObservedAudits` throws if the
  response carries `repaired`, `deterministicFallback` or a guard-accounting
  row. The other five audits score a draft against a contract the bare arm never
  builds; they are written as `null` and reported as unavailable, never as
  passed. Calls, request surface, bypass list and guard coverage are unchanged.
- **Rubric scoring is a separate, later pass** (`scripts/score-showcase-rubric.js`,
  `npm run tutor:stub:showcase:rubric`). It sends only the public transcript to
  the judge — the proof DAG, release plan, scaffold and guard verdicts are all
  withheld, so the instrumented arm is never scored on its own internal
  artefacts. Two caveats belong with any number it produces: v2.2 scores a
  single turn and penalises a proper close on `elicitation_quality` and
  `productive_difficulty`, and the arms have different transcripts.
- **The PR-benchmark rubric transfers in part, and the part is stated**
  (`scripts/score-showcase-pr-benchmark.js`,
  `npm run tutor:stub:showcase:pr-benchmark`).
  `config/tutor-pr-benchmark-rubric.yaml` is a different instrument from v2.2,
  not a newer one, and it names its own unit: a frozen candidate against a case
  criterion and a set of authored turn obligations. A free-running showcase turn
  has none of the three. Four axes are questions about those contracts —
  `overall_delivery` (acceptance against a criterion), `evidence_discipline`
  (release timing, which lives in the private schedule the bare arm never
  builds), `actorial_part` and `performance_tactic` (authored contracts) — and
  are **reported as unavailable, never as passed**: four axes clearing on every
  turn would read as a clean sheet when nobody asked. `safety` and
  `learner_uptake` transfer whole; `handoff` is asked with its two
  contract-dependent fail clauses void and the judge told to answer `pass` if
  that is its only concern, with the split carried into the artefact rather than
  applied silently. `showcasePrBenchmarkAxes` requires an explicit transfer
  decision for every axis in the YAML, so an axis added upstream fails loudly.
  The composite is named `transferableVerdict`, not `overall_delivery`, so a
  showcase label cannot be read against a benchmark-lane one. `safety`'s machine
  channel is included because it is the symmetric one: `tutorLeakAudit` runs on
  both arms under `--observe-audits`, and it is reported beside the judge label
  rather than merged into it.
- **Both scoring passes are shown on the transcript page**
  (`services/tutorStubShowcaseScoreOverlay.js`). Scoring post-dates rendering, so
  the renderer takes an *optional* overlay built from whichever artefacts sit
  beside `report.json`, an unscored run renders exactly the page it always did,
  and each scoring script re-renders on its way out. Scores land at three grains:
  score columns in the benchmark table, per-scenario scores in each arm's column
  head, and per-turn chips with the judge's reasoning behind a disclosure.
  Nothing averages across the two instruments — different scales, different
  units, different questions — and the composite keeps the name
  `transferableVerdict`. The three absences stay distinct on the page (*not
  asked* / *not scored* / *failed*), because a blank cell lets all three read as
  a pass. Per-arm aggregates are derived from the turn rows rather than read off
  the artefact's own `summary`, so the page and the markdown report cannot
  disagree, and the same accessor serves the whole-run and per-scenario grains.
- **The per-scenario grain caught a pooling artifact in the first scored run.**
  Pooled, the arms read `bare 54.4 → 22.5` against `instrumented 42.5 → 42.5`,
  which invites "the instrumented arm holds steady". Split by scenario it is two
  opposite trajectories averaging flat: Campus FAQ instrumented climbs
  23.7 → 67.5 while bare falls 41.3 → 16.3; Riverside Clinic has both falling,
  instrumented hardest (61.3 → 17.5). At two scored turns per arm per scenario
  neither pattern is evidence — the point is that the pooled number concealed the
  split.

- **A rubric version is a filename, not a mode.** `--rubric-version <v>` points
  `evalConfigLoader`'s existing override at `config/rubrics/v<v>/evaluation-rubric.yaml`
  and every consumer follows, because `loadRubric` is the single door the
  dimension list, the judge prompt and the weighted aggregate all pass through.
  The judge *model* is the deliberate exception: `--judge` still wins, so v3.0's
  own `fallback: openrouter.nemotron` can never quietly answer for a sonnet-class
  judge. The artifact is named for the rubric that produced it, and the overlay
  carries `tutorV30` as a slot of its own rather than generalising `tutorV22`
  into a version-agnostic one — a shared slot would render whichever version was
  scored last under a single unlabelled heading, which is exactly the mixing
  v3.0's own header forbids. The page states that the two blocks are not
  comparable, and gives the reason: v3.0 is 1–10 pedagogical quality plus 1–5
  content accuracy, each normalised on its own declared scale, with a turn whose
  content accuracy is `n/a` renormalising onto the single remaining dimension —
  so even two v3.0 turns can rest on different effective compositions. `n/a` and
  `—` stay distinct in the markdown table for the same reason.
- **v3.0 needed no scoring-engine change, which is the finding of the review.**
  The two places a mixed-scale rubric would most plausibly break were already
  handled in `services/rubricScoring.js`: each dimension normalises against
  `dimension.scale || rubric.scale || {min:1,max:5}` before weighting, and
  `calculateWeightedRubricScore` skips `not_applicable` entries and divides by
  the accumulated weight. The fallback chain is what makes this additive rather
  than a migration — a v2.2 dimension with no `scale` of its own takes the
  historical path and computes the identical number, so there is no version
  branch anywhere in the engine.

- **"Not comparable" was the right caveat and the wrong stopping point.** The
  v3.0 panel said the two versions must not be pooled and left the reader with
  the question they actually have next — whether the newer instrument is better.
  `services/tutorStubShowcaseRubricContrast.js` answers it from this run's own
  rows: composite spread and distinct-verdict count per version, the correlation
  between every pair of a version's own dimensions, and the turn-by-turn
  divergence between versions. On the current run the reading is that v3.0 is a
  defensible simplification rather than a sharper instrument — wider spread
  (sd 24.0 vs 20.7) but *fewer* distinct verdicts across the same 8 turns (6 vs
  7), which is the same ordering stretched over a longer scale. v3.0's design
  premise does hold up: v2.2's mean |r| across its 28 dimension pairs is 0.713,
  with `pedagogical_craft ~ elicitation_quality` at 0.970. Every figure carries
  the small-n warning, and at n = 8 with p = 8 the correlation matrix is
  rank-deficient by construction, so the panel prints that before the numbers.
- **The radar reports shape, never area.** A radar's enclosed area changes when
  the dimensions are reordered, so `services/tutorStubShowcaseRadar.js` is
  wrapped in prose forbidding the "bigger shape = better tutor" reading, and the
  chart earns its place on the other thing: it made visible that 4 of v2.2's 8
  dimensions land on the *same* mean for both arms, so whatever composite gap
  exists is carried by a minority of what is averaged into it. Each axis
  normalises on its own declared range (v3.0 mixes 1–10 with 1–5), the rubric
  floor plots at the centre rather than a fifth of the way out, an unscored
  dimension cuts a corner instead of spiking to the centre, and below three axes
  the chart is refused in favour of bars plus a stated reason — two axes enclose
  no area and the line they draw is pure axis-order artefact.
- **The whole-transcript instrument exists and is deliberately not run.**
  Everything on this page is scored one turn at a time, so whether a dialogue
  holds together as a whole is out of reach of any rubric here.
  `config/evaluation-rubric-poetics.yaml` is that instrument, and it failed its
  transfer gate to tutor–learner transcripts at weighted κ ≈ 0.04 against a
  pre-registered bar of 0.60. Wiring it in anyway would add a number without
  adding a measurement; the page names the file, states the failure, and stops.
- **Magnification is the reading mode, so the page is built for it.** One
  `--sc-scale` variable drives `html { font-size }`, and every length on the page
  is a rem, so the type control grows type, padding, gutters and the chart
  together instead of reflowing prose inside fixed furniture. The three-step
  control is the visible half; the load-bearing half is the collapse breakpoint,
  moved 960px → 1180px, because browser zoom shrinks the CSS viewport and two
  480px columns of transcript are side by side without being readable. Tables
  scroll in their own box so the body never scrolls sideways, and a collapsed
  column re-states which arm it belongs to — stacked, the column heads that
  carried that are gone.
- **The jump menu is generated from what rendered, not from a fixed list.** A
  menu entry pointing at a section an unscored run never emitted would be a
  broken link on exactly the pages most likely to be sent to someone outside the
  project; a test walks every `href` and requires the id to exist in the same
  document.

Standing limitation, stated in the config, the service header, `report.md`, and
on the rendered page: **this is not a controlled comparison.** Each arm has its
own learner answering its own tutor, so the transcripts diverge after the first
exchange and no difference between them is attributable to instrumentation
alone. The frozen A/B stays the causal instrument; the two are meant to be read
together. Nothing here is an empirical claim about learning, human or
simulated, and none of it belongs in the paper as one.

Cost is expressed in calls and wall clock, not dollars — tokens are recorded but
the CLI bridges are subscription-quota and report `cost: 0`. The per-arm cost
table in `docs/tutor-instrumentation-showcase.md` is filled from a real showcase
run with the run stamp beside it; the first attempt filled it from a single-turn
probe and was wrong in both the coverage row and the shape of the baseline.
