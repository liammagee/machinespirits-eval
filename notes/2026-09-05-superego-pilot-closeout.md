# Superego pilot closeout: human validation deferred

The user accepted closing the completed exploratory model-rated pilot and
stopping expansion while independent human readers are unavailable. Generation,
automated assessment and private archival are complete. The registered human
primary endpoint remains unobserved; this is not completion of the original
broader causal experiment or evidence of human validation.

The detailed scientific closeout is retained privately to preserve the possibility
of later blinded human review. In liammagee/machinespirits-eval-private, branch
codex/superego-automated-quality-archive, closeout commit
`4d1aad0d155491c29c0512259830855a85b808b7`, see:

- exports/superego-pilot-closeout-2026-09-05/scientific-closeout.md
- exports/superego-pilot-closeout-2026-09-05/summary.json
- exports/superego-pilot-closeout-2026-09-05/summarize.mjs

The report covers all four arms, paired quality contrasts over 12 draft units in
six contexts, the one-point planning target, separate accuracy scores, individual
variation, measurement limitations, and the decision to stop expansion. Its offline
arithmetic is reproduced from the saved model ratings and checked against the
existing report. Scores remain outside this public note and the human form.

## Disposition

- Generation: complete, 60/60 jobs, 48/48 public outputs, no failures or retries.
- Automated assessment: complete, 48/48 determinate ratings through Codex CLI;
  49/52 attempts including one preserved pre-turn configuration failure.
- Human comparison: deferred, zero ratings. The existing card moves from review
  to dropped because this work is not being pursued while readers are unavailable.
  Its original human acceptance criteria remain unmet; this status is not a
  negative scientific finding or a claim that model ratings replace people.
- Expansion: no further generation, automated judging or larger replication
  scheduled. No new calls, GO note, design amendment or runtime change is needed.
- Infrastructure review: remains separately triaged under its existing card;
  neither completed nor a blocker for this closeout.

Quality and accuracy are descriptive judgments from one model. Directive
fulfillment, material strategy change, exact-word uptake, learner responses and
transfer remain unmeasured here. The report makes no efficacy, equivalence,
no-effect, learning, psychological-theory or cross-model-general claim. The
resource decision is post-results and does not invent a registered stop threshold.

## Preserved path to later validation

The sealed generation, model ratings, all prior failures and historical results
remain unchanged. The [generation record](2026-09-05-superego-human-generation-results.md)
and [CLI assessment record](2026-09-05-superego-automated-quality-results.md)
retain their original operational handoffs. This closeout supersedes their pending
human handoff for current work; historical workflow-status files are not rewritten.
The [design](superego-contemporary-pilot-design.md) and measurement rules are unchanged.

If independent readers become available, explicitly reopen the deferred human
comparison and give each only the original sealed form. They must not have seen
model scores, arm mappings or each other's ratings. The existing --human-report
with --model-ratings performs the comparison offline on the same response IDs;
no generation or model rerun is necessary. Human disagreement remains
measurement_indeterminate in the exact-consensus lane, and neither averaging nor
the model resolves it. Record later human findings separately from this closeout.

Workplan: [human comparison](../workplan/items/superego-human-quality-comparison.md)
and [infrastructure review](../workplan/items/paid-study-infrastructure-review.md).

Verification: all three closeout files are byte-identical to their private archive
copies. Running the archived summarize.mjs against the archived assessment
reproduces summary.json exactly. The 628-item workplan source check, targeted
Markdown formatting and diff checks pass. This is a documentation-only closeout;
no historical artifact, design, runner, paper, package or workflow file is changed.
