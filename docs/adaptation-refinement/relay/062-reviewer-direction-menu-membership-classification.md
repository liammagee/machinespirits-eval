# 062 — Reviewer direction: apply ruling 060b to the menu (zero-call send-back)

**Lease:** `DRIVER-LEASE-2026-08-13-N`, continued. Report to
`063-codex-report.md`. Authority: ruling 060b, report 061, the
second session's three-layer review (bytes PASS, 060a coverage
PASS, 060b membership SEND-BACK). Zero model calls; the HOLD
stands.

This is the one anticipated send-back: your menu commits raced
ruling 060b (`98d596a3`). Three items, nothing else.

## 1. Remove the ruled-out entry

Remove `opening.instructional_meta`. Ruling 060b application 1:
the learner-wording classifier sets that plane, upstream of the
gate.

## 2. Classify every entry; the trace decides the contested ones

Add to the enumeration rule a per-string classification: switching
variable, whether the gate's decision path (gate verdict, repair
policy, register selection) can reach that variable, and the
verdict. Trace, do not assume. The contested entries the second
session named:

- the seven writable-entry strings (five uptake, two opening) —
  switch on the learner's writable-entry request;
- the responsive-repair uptake string and the
  question-boundary/bounded-choice/clarification handoff strings —
  switch on question-support state fields;
- the learner-move and accelerated-credit uptake strings — switch
  on learner-state fields;
- the default opening response — fallback of the above.

If the gate's decision path cannot reach the switch, the entry
comes OUT (it renders identically in the bare condition); list
each removal with its trace. If a trace is uncertain, keep the
entry and record the doubt. The part, tactic, stance, action, and
support cue families switch on the policy's own selections and
stay in — the classification still says so per string.

## 3. Drop the empty-quote entry

Remove `tactic.support.0`. Amendment 1 covers instruction strings;
an empty render injects no words, so it is not a menu entry.
Record in the enumeration rule that support level zero renders
nothing, so the null branch stays documented.

## Then

Rerun the drift-guard fixtures, the focused suite, the widened
suite from direction 058 §5, and ESLint on touched files. Repin
the manifest (menu SHAs change; source SHA table must still equal
report 056 exactly). Commit with `--no-verify` and trailer
`Workplan-item: N/A`, write report 063 with the new entry count,
the classification table, the removal list with traces, and the
unchanged planned-call arithmetic (594; 3,523 + 594 = 4,117 of
11,337). Commit, end. Zero model calls; NEVER push the branch. If
any check fails, stop, report, commit, end.
