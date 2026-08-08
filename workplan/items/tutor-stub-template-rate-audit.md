---
id: tutor-stub-template-rate-audit
title: Stamp every cited tutor-stub run with its measured template rate
status: done
type: infra
priority: P2
owner: codex
source: manual
created: 2026-08-06
updated: 2026-08-08
branch: codex/paper-guard-template-rate-pass
verification: >-
  A table, checked into the guard catalog doc, lists every recoverable cited
  tutor-stub run with its template rate and model-as-written rate measured from
  its own traces by the census/replay script. Paper sections that read tutor
  prose off a guarded run carry the rate, `boundaryPolicy`, and catalog version
  beside the claim; unrecoverable or unstamped observations are explicit, and
  no comparison pools different regimes. Paper 2.0 v3.0.276 records the
  completed pass after `guard-validity-study` concluded.
claim_status: methods
links:
  code:
    - scripts/census-guard-template-rate.js
    - scripts/replay-guard-fallback-delivery.js
    - docs/tutor-stub-guard-catalog.md
    - docs/research/paper-full-2.0.md
  items:
    - guard-regime-fallback-census-at-scale
    - guard-validity-study
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/576
tags:
  - tutor-stub
  - guards
  - paper
---

## Why

The guard ladder exists only in the tutor-stub apparatus, so most of the paper
is untouched. Within that apparatus, outcome-channel results are insensitive
to who wrote the prose; but any § that reads tutor prose — the
instrumentation showcase, the move-library transfer deltas, the derivation-arc
adaptation readings — was reading a mix of model text and template, in
unknown proportion per run. The proportion is measurable after the fact from
each run's traces, for free.

Positive effects found through dilution are more likely understated than
false; the stamp turns that from an argument into a number per run.

## How

1. Enumerate tutor-stub runs cited in `docs/research/paper-full-2.0.md`
   (grep export paths and run IDs; the pre-registration docs at repo root
   name the rest).
2. Run the census over each run's trace directory. Older traces predate the
   current accounting record; where the record is absent, count fallback
   events directly and say which counter was used.
3. Table into the guard catalog doc; one-line rate citations into the
   affected §s — after the validity study concludes, as one paper pass with
   its own changelog entry.

## What the census found: the rate is set by the policy, not the tutor

Steps 1 and 2 ran on 2026-08-07. `scripts/census-guard-template-rate.js` reads
any run's traces and reports turns, template rate, model-as-written rate and
pass rate by candidate kind, stamped with the counter it used and the guard
policy the run was decided under. It reproduces the Phase-B census exactly
(1,156 turns, 62%, 10%), which is its acceptance test.

Across the 24 runs on this machine with traces, the rates sort by policy and
not by tutor: 19 shadow-advisory runs at 7% template and 67% model-as-written,
5 strict runs at 62% and 9%, with no overlap between the groups. The split had
looked like a tutor-family effect, because the shadow runs are the
claude-seated ones and the strict runs the codex-seated ones. It is not.

Holding the policy fixed by re-scoring every recorded first draft under both
columns of the catalog — exact, no re-run, since both dispositions are stored
on every finding:

| tutor | drafts | pass, strict | pass, shadow |
|---|---|---|---|
| claude-opus-5 | 77 | 1% | 73% |
| claude-sonnet-5 | 1640 | 3% | 67% |
| codex gpt-5.6-terra | 1659 | 8% | 61% |

The policy moves the pass rate by a large factor; the tutor moves it by a few
points, and under strict the codex tutor passes more often than either claude
model. Only first drafts can be re-scored this way: a run that shipped at
attempt 0 never generated the rewrite a stricter policy would have demanded,
so a counterfactual template rate is not recoverable and was not computed.

§6.24's boundary observation survives in direction — under strict, sonnet
drafts are vetoed on 97% of turns against codex's 92%, matching the
cross-family probe's 20/25 against 14/23 — but not in size. On first drafts at
a fixed policy the family gap is a few points, not the order of magnitude the
unstamped run rates implied.

Two gaps to record rather than paper over. The 2026-07-31 probe runs behind
that §6.24 sentence are not on this machine and could not be stamped;
`exports/` is untracked, so artifacts differ per checkout. And the greenroom
run of 2026-07-12 predates the catalog — 314 turns, 6% template, 89%
model-as-written, but on leak checks alone, so the counter stamps it
`pre-catalog` and it pools with neither group.

Two corrections fell out of running the census with the project's own issue
extractor rather than a hand-walk of the audits object. The recorded
family table for Phase B was missing three families, one of them large:
`response_configuration` 587 findings against first drafts (second only to
live turn progression), `leak` 68, `release_delivery` 20. And 12–14% of first
drafts across every tutor carry a finding in one of the three safety
categories, which stay hard under the shadow policy too — so the flip under
consideration does not touch them, and about one first draft in eight will
keep being stopped whatever is decided.

## The §7.14 corpora, stamped 2026-08-08

The three tutor-stub runs behind §7.14's figure reader were generated after
the census and were not in it. Stamped now:

| run | turns | template | model as written |
|---|---|---|---|
| figure-fresh-shadow (training) | 62 | 39% | 45% |
| figure-clean-test (held-out) | 63 | 35% | 49% |
| figure-transfer-tideway (second world) | 63 | 38% | 52% |

All three ran under the shadow policy, where every other stored run sits at
4–11%. So the spread the census called small has a top end worth naming, and
these three runs are all of it.

Ruled out as the cause: the catalog version (the training corpus is v6 like
the low runs, the other two v7, and all three land together), forcing a card
as a fact about a turn (inside these runs the forced turns are no worse than
the rest, and the direction flips between corpora), and forcing a card as a
fact about a dialogue (elsewhere, dialogues with a forced card land where
dialogues without one land).

What does sort the runs is how often a card is forced, counted per turn. The
figure corpora force five cards into eight or nine turns, about 53%; the next
densest stored run forces 22% and sits at 7% template. `--sweep` on the census
script prints that table for any parent directory of runs. Two limits: nothing
stored falls between 22% and 53%, so the shape between them is unknown, and
the three dense runs are the only three from this launcher, so density is not
separated from everything else they share.

This changes nothing in §7.14's primary result, which reads first drafts —
written by the model whatever the guard does with them afterwards. It supplies
the missing number for the secondary: §7.14 twice calls the shipped-text arm
handicapped, and the handicap is that 35–38% of turns shipped the template.

## Step 3: paper qualification

The table is in the guard catalog and the validity study has concluded. Paper
2.0 v3.0.276 applies the resulting discipline in one pass: §6.24 separates its
single-dialogue relief ladder from the cross-run policy census, replaces the
apparent family-sized gap with the fixed-policy first-draft comparison, and
marks two older observations unstamped and unpooled. §7.14 records the three
figure-corpus rates but does not conflate their catalog versions: the v6
training and v7 held-out streams remain comparable only on the primary
pre-disposition drafts. The shipped reader excludes every template turn and is
therefore described as a guard-selected survivor analysis, including the lost
grievance class, rather than as a mixed-authorship stream. The primary
first-draft reader result is unchanged.

## Log

- 2026-08-06 — filed. Deterministic and unpaid; only its paper pass waits on
  the study.
- 2026-08-07 — steps 1 and 2 done; census script landed. The headline is a
  correction to how these rates were being read: the template rate is set by
  the guard policy, not the tutor family. Table in the guard catalog. Paper
  pass still gated on `guard-validity-study`.
- 2026-08-08 — the three §7.14 figure corpora stamped, having been generated
  after the census ran. They are the top of the shadow range at 35–39% against
  4–11% everywhere else, and the one measured thing that sorts the runs is how
  often a card is forced per turn. Census script gained `--sweep` so the
  cross-run table reproduces. Table in the guard catalog. Paper pass still
  gated on `guard-validity-study`; when it runs, §7.14's shipped-text arm now
  has a number for the handicap it already names twice.
- 2026-08-08 — guard-validity gate closed and paper pass completed as Paper
  2.0 v3.0.276. §6.24 now distinguishes policy effects from tutor-family
  effects; §7.14 records all three source-run rates and the 108-pair validity
  bound. Source validation and independent claim audit are the remaining
  review gates.
- 2026-08-08 — first independent claim audit correctly rejected two readings:
  the shipped reader drops templates rather than reading a mixed stream, and
  the v6 training corpus cannot be pooled with the v7 held-outs on delivery
  disposition. Paper and completion text corrected to selection/censoring,
  catalog-version, lost-class, and unstamped-run language; re-audit required.
- 2026-08-08 — independent re-audit passed the corrected empirical claims with
  no drift or untraceable result. Manifest validation passes 60/60, discourse
  tests 69/69, source-only workplan validation 460/460, and formatting/diff
  checks pass. The broad discourse audit retains three pre-existing
  evaluation-store source-fingerprint failures also present on `main`.
- 2026-08-08 — Closed after PR #576 merged as `42627134`; the corrected paper
  qualification, catalog stamps, and independent re-audit are present on
  `main`.
