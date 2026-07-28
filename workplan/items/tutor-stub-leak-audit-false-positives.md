---
id: tutor-stub-leak-audit-false-positives
title: Leak audits fire on hedges and stage directions — every recorded A/B leak was a false alarm
status: review
type: infra
priority: P1
owner: claude
source: manual
created: 2026-07-29
updated: 2026-07-29
verification: "A unit test asserts the conclusion check treats `X, not Y` as
  withholding, the way it already treats `does not` and `not yet`; a unit test
  asserts `I trace the winter-to-thaw entry with my finger` raises no evidence
  correspondence; replaying the nine recorded leak turns through the A/B bench
  reads zero leaks; the seven turns that never leaked still read zero."
claim_status: scope-bound
depends_on:
  - tutor-instrumentation-ab-harness
tags:
  - tutor-stub
  - instrument
  - frozen-replay
---

The instrumentation A/B says the per-turn performance contract is the only piece
that moves the headline number: 5.04 broken rules a turn for the bare tutor,
1.67 for the contract, and 4.4–5.3 for every other single piece, which is the
bare tutor's own band. The one thing that cut against the contract was leaks.
Only the contract ever leaked, and it leaked at two places every time it was
replayed there — Greyfen turn 3 six times out of six, Nocturne turn 9 three
times out of three. The reading on offer was that the contract buys some of its
win by talking, and that the talking overshoots at predictable moments.

All nine are false alarms, from two separate bugs.

**The conclusion check reads a denial as a claim.** `explicitlyWithholdsConclusion`
in `services/tutorStubConclusionAssertion.js` skips a sentence carrying
`does not`, `cannot`, `not yet`, `no proof`, `remains unproved`. It has no rule
for the bare contrastive. All six Greyfen flags are the same shape:

> The quarantine record and swab support G17 inside Larkin, **not the conclusion
> that** Larkin ruined Corvat.

The model states the limit and the checker scores it as crossing the limit.

**The evidence check reads a stage direction as a correspondence claim.** The
correspondence pattern in `services/tutorStubEvidenceAssertion.js` looks for
`trace … to` within 55 characters, to catch one exhibit being traced to another.
All three Nocturne flags are:

> I trace the winter-to-thaw entry with my finger.

It matches `trace the winter-to` — the `to` in the middle of the hyphenated
compound. Delete that one word and the same sentence passes. The same pattern
flagged `I open the Larkin log and mark the match, while the contamination
source remains unproved` on the bare noun *match*, with *remains unproved*
sitting in the sentence unread.

Both are shallow surface bugs, but the direction of the error matters: the
checks fire on hedging and on physical business, and the contract is the only
version of the tutor that writes enough to have either. So the instrument
penalised exactly the version it should have rewarded, and did it reproducibly
enough to look like a finding.

Worth fixing carefully rather than quickly. Widening the withhold list is how
these checks stop catching real leaks; the conclusion check already carries
thirteen hand-tuned patterns, several of them world-specific. The new rule
wanted is narrow — a contrast where the answer term sits on the rejected side of
`not` — not another loose alternation.

Fixed 2026-07-29, both narrowly.

The conclusion check now drops the rejected half of a contrast before it reads
the sentence. "A, not B" asserts A and denies B, so conclusion words that only
appear in B are a stated limit. The rejected span ends at the next semicolon, so
a later independent clause is still read on its own. This is a rule about
sentence shape rather than a fourteenth pattern in the withhold list, which is
the part that keeps it from widening. `do not` and `don't` were also missing
from that list beside `does not` and `did not`, and are now there.

The evidence check no longer accepts a `to` that sits inside a hyphenated
compound as the `to` of "ties X to Y", and no longer treats a determined "the
match" as a claim that two exhibits correspond, unless its two sides are named
("a match between X and Y"). The tutor can now mark the match as stage business.

Checked by re-grading all 442 recorded replies across every A/B run to date with
the new checks, which needs no model calls. All 11 recorded leaks clear; none of
the other 431 replies gained one. Unit tests carry the nine sentences plus the
assertions that must still fire: "Larkin ruined Corvat, not Devlin", "The
residue traces to the weir-forge crucible", "I mark a match between this alloy
and the crucible leavings". 1697 of 1699 tutor-stub tests pass; the two failures
are older and unrelated, one of them only because this worktree is not named
`machinespirits-eval`.

Carried in the same working tree, still uncommitted: a change to
`services/tutorStubFirstDraftContract.js` that quotes the committed public
evidence into the prompt when no new evidence is due, so the two writable slots
name a licence the model can read instead of pointing at an unrendered record.
It passes its own tests and it visibly improves the Nocturne reply — the tutor
now says the record dates the paper, not that the music was written at Cassia.
Its effect on the leak count is unmeasured, because the ruler was broken when it
was measured. Re-run it once these checks are fixed. It may turn out there was
nothing to fix.
