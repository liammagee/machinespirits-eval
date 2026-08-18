---
id: warrant-quote-rule-letter-case
title: Let the frozen literal-quote rule ignore letter case
status: blocked
type: infra
priority: P2
owner: claude
source: manual
created: 2026-08-16
updated: 2026-08-16
verification: The relaxed rule reproduces every frozen run's accepted
  readings byte for byte, and the 12 refusals in the guarded main block
  that were letter case only now pass. Focused tests hold the uniqueness
  check and refuse a real misquote. No paid call.
claim_status: methods
blocked_by: The rule file is one of the 15 the guarded main block's
  instrument freeze pins by hash. Changing it while that run is open would
  break the run's own bindings, so the change lands after the block closes.
depends_on:
  - guarded-learner-outcome-study
links:
  notes:
    - docs/adaptation-refinement/guarded-main-block/reviewer-ruling-001-letter-case-quote.json
    - docs/adaptation-refinement/relay/DEFECT-LEDGER.md
tags:
  - warrant-gate
  - adaptive
  - instrument
---

The reader must quote the learner word for word. The frozen rule in
`services/adaptiveWarrantSemanticEvents.js` already folds curly quote marks
to straight ones before it compares, but it compares letter case exactly.
So a reader that quotes the learner correctly and writes the first letter
as a capital is judged a misquote.

That is not a real defect in the reading. Case cannot change which words
the quote holds, their order, or where they sit in the learner's message,
and the rule's own uniqueness check still applies afterwards. In the
guarded main block it cost 12 of the 30 refused reader attempts, every one
of them letter case only, and left one turn unread.

**The human ruled on 2026-08-16:** the case difference is a pass on the
condition, and later evaluations should carry the relaxation into the rule
itself.

**Blocked until the guarded main block closes.** That file is one of the
15 the instrument freeze pins by hash, so changing it while the run is open
would break the run's own bindings. For this run the relaxation is a
committed reviewer ruling applied by the parent
(`services/adaptiveWarrantTypographicQuoteRuling.js`), which leaves the
frozen rule untouched.

**The change, when it lands:** fold case in
`deriveAdaptiveWarrantSemanticEvidenceSpan` alongside the punctuation fold
that is already there, and return the learner's own bytes rather than the
reader's. Lift the normaliser from the ruling service so there is one
implementation, then retire the ruling service. Re-hash the instrument
fingerprints afterwards; any run that wants the relaxed rule needs a fresh
seal, and every frozen run keeps the old one.

**Guard against a silent change of meaning:** replay the accepted readings
of the frozen runs through the relaxed rule and require the same result on
every one. The relaxation may only turn refusals into passes; it may never
change a reading that already passed.
