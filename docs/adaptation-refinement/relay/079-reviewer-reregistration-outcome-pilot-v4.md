# 079 — Re-registration: outcome pilot v4 (deference warrant basis)

**Date:** 13 August 2026. **Human authority, verbatim:** "approve
option 1, prepare the re-registration" (13 Aug, in-session), on the
options put in note 077. Budget authority: amendment 052c (ceiling
19,337). Design evidence: the second session's design note
`docs/adaptation-refinement/2026-08-13_pilot-retake-design-note.md`
(corrected at `757625c1`), smokes A (26 calls) and B (29 calls),
and the quarantined v3 corpus (diagnostic reads only).

## Scope decision: guarded bad learner EXCLUDED

The human asked whether to fold in the guarded bad learner (design
note §3). Reviewer recommendation, adopted: **leave it out.** One
design change per registration; the concession guard is unbuilt; and
smoke B showed the defensive pole needs its own declared stance
events first, else defiant evidence-demands read as deference. The
bad learner is its own future block (one world, one seed, gated
only) with its own registration. The known directed-result blind
spot is RECORDED as a limitation of this pilot's sensor and deferred
with it; the pilot's learner population is passive, where the broad
rule discriminated correctly on all six hand-coded v3 dialogues.

## Registered design changes (v4 vs v3)

1. **Deference sensor (implemented, `46bfbdd9`).** A turn is
   deferential when its stored semantic events contain any
   permission-seeking act — record-entry request, selection request,
   or directed-result request — at any validation status, uncertain
   included. Applied identically in all three conditions at decision
   time and in the shadow pass.
2. **Sustained deference becomes a warrant basis (NEW, to build).**
   Three deferential turns in a row arm the gate with its own basis
   string (`sustained_deference:<n>_turns`), consulted at the same
   precedence position the policy comment already describes. This
   changes what the gate does, not just what it sees.
3. **Analysis-coverage repair (implemented, `48bf2e97`).** Up to two
   fresh analyzer retries per turn on the four named failure classes;
   a child with any unanalyzed turn cannot seal complete; launcher
   quarantines a coverage miss at seal time. Freeze rule stays the
   exact 144-case count, with this recovery path declared.
4. **Decision-time signals in all conditions (NEW, to build).** Bare
   and standing-permission turns carry the same learner-signal block
   gated turns carry, so no scorer depends on a shadow stamp.

## Registered predictions

- (P1) In gated dialogues whose learner never self-breaks, the gate
  arms on sustained deference and at least one challenge-family turn
  is delivered. From the v3 stored events, arming lands at t6, t3,
  t5, t5 for the four never-breaker patterns.
- (P2) In gated dialogues whose learner self-breaks early (v3
  dialogues 2 and 11 patterns), the trigger never arms.
- (R1, risk, report-only) Challenges delivered to learners making
  steady record progress are counted and tabled — the registered
  risk is that the trigger interrupts polite, productive learners.

## Unchanged

18 dialogues (6 per condition), seeds 515–517, two frozen worlds,
144 cases, 2+2 fresh readers per case, consensus-only analyses,
30-call cap, 1,116-call plan shape, instrument freeze
`annotation-freeze-manifest-r52-presence-confirmation.json` (SHA
`6a64b31f…`). v1–v3 artifacts stay quarantined. The 72-dialogue main
block stays unauthorized.

## Budget

Ceiling **19,337** (052c). Counter at drafting: 4,122 plus the
running Sol diagnostic re-take (~90). `counter_before` is pinned
from the settled value when the Sol dirs seal; all `11337` ceiling
literals re-pin to `19337`.

## Process

Direction 080 orders the build (zero calls). Then: reviewer
zero-call verification, one second-session final-gate review, fresh
GO note (080a), v4 launch on a fresh out dir. Report file: 081.
