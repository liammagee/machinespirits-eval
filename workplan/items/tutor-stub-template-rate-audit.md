---
id: tutor-stub-template-rate-audit
title: Stamp every cited tutor-stub run with its measured template rate
status: active
type: infra
priority: P2
owner: claude
source: manual
created: 2026-08-06
updated: 2026-08-07
verification: >-
  A table, checked into the guard catalog doc, listing every tutor-stub run
  cited in paper-full-2.0.md with its template rate and model-as-written rate
  measured from its own traces by the census/replay script. Paper §s that read
  tutor prose off a guarded run carry the rate beside the claim. The paper
  edit itself waits for guard-validity-study to conclude so the whole account
  lands in one pass.
claim_status: methods
links:
  code:
    - scripts/census-guard-template-rate.js
    - scripts/replay-guard-fallback-delivery.js
    - docs/tutor-stub-guard-catalog.md
  items:
    - guard-regime-fallback-census-at-scale
    - guard-validity-study
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

## What step 3 now has to say

The table is in the guard catalog. The paper pass still waits on the validity
study, and it now carries one more instruction than when this card was filed:
every template rate cited must name its policy, and no two rates measured
under different policies may be set against each other. That rule applies to
§6.24's own numbers, which mix a strict-policy probe with runs measured
elsewhere.

## Log

- 2026-08-06 — filed. Deterministic and unpaid; only its paper pass waits on
  the study.
- 2026-08-07 — steps 1 and 2 done; census script landed. The headline is a
  correction to how these rates were being read: the template rate is set by
  the guard policy, not the tutor family. Table in the guard catalog. Paper
  pass still gated on `guard-validity-study`.
