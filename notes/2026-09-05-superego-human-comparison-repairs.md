# Repairs toward a human teaching-quality comparison

The next scientific deliverable is a blinded human comparison of the four fixed
arms. The [design amendment](superego-contemporary-pilot-design.md) keeps 12 draft
units across six contexts and makes that comparison possible without automated
semantic judging. This report distinguishes technical repairs from prospective
changes to the study.

## What the saved failure establishes

The sixth response in the closed cohort contains 1,702 consecutive trailing
U+3000 ideographic spaces. The model reported 2,048 output tokens, zero thinking
tokens and `max_tokens`; the public JSON string was unfinished. This explains
the observed cutoff, but not the underlying provider cause. There is no evidence
that a larger limit would have produced a useful completion. No paid probe was
used to investigate it and no historical response was repaired or relabeled.

## Technical repairs

- Human quality can now be reported from two reader files alone. Semantic
  references and model judgments no longer have to exist before viewing the
  primary human comparison. Individual scores, exact-consensus disagreements,
  full-unit bounds and coverage remain separate.
- Readers receive a local form containing only public output and context,
  neutral IDs, scoring anchors and evidence references. They can save progress
  and download the existing human-rating format. The form does not call any
  network service, assign scores, include the treatment key, or expose another
  reader's ratings. The final report is written as ordinary Markdown and JSON.
  Entering an ID after starting preserves that reader's work; changing readers
  clears the displayed ratings, covered by an offline event-handler regression.
- Reader files identify the exact blinded public packet. Files from a different
  cohort or different public text are rejected even when neutral IDs coincide.
  This data identity check is unrelated to approvals or source-file hashes.
- A response-body read failure preserves received bytes and safe diagnostics.
  It cannot be mistaken for a response-free error eligible for automatic
  replacement. Existing response-free transport recovery remains bounded.
- Progress and ETA count the jobs in the current stage. Heartbeats alone do not
  advance the last-material-progress timestamp. Seals distinguish accepted,
  unavailable and terminal jobs instead of counting every retained result as
  successful generation. Human handoffs explicitly require human action.
- New policy flags reject unsupported combinations. The historical JSON and
  stop-on-invalid behavior remain covered by independent regressions.

## Prospective scientific choices

The next cohort requests plain public tutor text, retains structured critiques,
and keeps the same output-token limit. This removes an unnecessary public-output
wrapper; it does not establish that JSON formatting caused the observed failure.

An unusable output occupies its fixed slot and is not regenerated. Only its
dependent jobs are skipped. Other prespecified jobs continue; missing slots
remain in all denominators and uncertainty bounds. This replaces the old
whole-run stopping rule only prospectively. No donor, unit or favorable output
is substituted. Two human readers assess quality and accuracy; directive
fulfillment, material change, lexical uptake, automated agreement and learner
or transfer outcomes remain separate, deferred questions.

The new cohort is limited to 60 generation calls plus six technical replacements,
66 attempts and $4.646400. The closed cohort's six attempts and $0.422400
reservations remain intact. Combined maxima are 72 attempts and $5.068800,
within the original contemporary programme ceiling. No new GO note or launch
was manufactured during this work.

## Verification and limitations

All 47 focused tests pass across the historical and prospective runner, shared
launch contract, durable budget and launcher inventory. They exercise the public CLI and shared admission/budget helpers,
including truncated whitespace, dependency loss, missing-only recovery, partial
response retention, blinding, two-reader completeness and disagreement bounds.
Synthetic inputs are marked as fixtures and are not empirical study data.
The production zero-call plan contains 12 draft units, 60 generation jobs,
48 human presentation slots and the exact $4.646400 worst-case reservation.

All 19 original artifact files were compared byte-for-byte with the private
archive and remain unchanged. No provider calls, semantic labels, human ratings
or empirical quality claims were produced during the repair phase.

The local-file URL policy prevented a live browser preview. The inline script
passes JavaScript parsing and output-isolation checks, and the exported rating
format passes the complete offline report path. Visual browser behavior remains
unverified. A clearly marked synthetic preview is available at
`exports/superego-human-review-preview/review.html`; it is not a real packet.

The first scientific decision after data collection is whether the per-reader
quality contrasts, coverage and disagreement justify a larger test. A merged
repair, accepted JSON or successful provider response is not that evidence.
