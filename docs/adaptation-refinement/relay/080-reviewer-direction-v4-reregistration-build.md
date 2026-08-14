# 080 — Direction: build the v4 re-registration (zero calls)

**To the driver.** Authority: re-registration 079 (human-approved
option 1), amendment 052c (ceiling 19,337), verified repairs
`48bf2e97` (coverage) and `46bfbdd9` (deference sensor), both at
HEAD. **Zero paid model calls.** Report to
`081-codex-report.md`. Do not push the branch. Do not touch v1–v3
artifacts, the frozen instrument, or the strict analyzer
parser/prompt/schema.

## Task 1 — sustained deference as a warrant basis

In `services/adaptiveWarrantGateCore.js`, add one arming condition to
the revision-warrant block: when the current turn and the two turns
before it are all deferential under the committed sensor rule
(`46bfbdd9` semantics — any stored permission-seeking semantic event,
any validation status), the gate arms with basis string
`sustained_deference:3_turns`. Requirements:

- Consume the SAME per-turn deference signal the sensor already
  computes; do not re-derive it with new logic.
- Precedence: below the immediate-safety bases (repair request,
  blocking obligation, unsafe closure), above the accumulated-trouble
  basis, matching the policy comment's existing order. If the code
  comment and this line conflict, stop and report.
- The basis must flow through to the stored decision record and trace
  events exactly as existing bases do, so zero-call replay can see it.
- Applies in the gated condition only where the gate runs; bare and
  standing-permission conditions are untouched by this task.

## Task 2 — decision-time learner signals in all conditions

Bare and standing-permission turns must carry the same decision-time
learner-signal block gated turns carry (design note §2.4). Signals
are computed and stored identically in all three conditions; only the
gated condition ACTS on them. No scorer or corpus surface may depend
on a shadow-pass stamp.

## Task 3 — ceiling re-pin

Re-pin every manifest/guard ceiling literal from `11337` to `19337`
(amendment 052c, note 078). Grep the whole repo for `11337`; every
live literal changes, historical relay/docs text does not.

## Task 4 — counter re-pin (seal-gated, LAST)

`counter_before` re-pins from the settled value: **4,122** (after
smokes A+B) plus every `model_call_budget_reserved` event across the
three Sol re-take trace dirs
(`.tutor-stub-auto-eval/sol-smoke-0{1,2,3}-*-s515-2026-08-13`).
Perform this step ONLY when all three dirs exist and report sealed
status. If any is missing or still running when tasks 1–3 are done,
STOP, leave the counter literals as they are, and say so in the
report — the reviewer will direct the pin separately. Never pin a
moving number.

## Task 5 — tests

- Unit tests on the new basis: arms at exactly three consecutive
  deferential turns; two turns never arm; an intervening
  non-deferential turn resets the window; basis string exact;
  precedence vs accumulated-trouble verified.
- Zero-call replay test over the stored v3 decision inputs (the
  quarantined corpus is readable as diagnostic fixture data): assert
  the four never-breaker gated dialogues (04, 09, 13, 18) arm at
  turns 6, 3, 5, 5 and the two self-breakers (02, 11) never arm —
  registration predictions P1/P2 in 079.
- Condition-parity test for task 2: the stored learner-signal block
  is present and identical in shape across all three conditions on a
  fixture turn.
- Full `adaptiveWarrant*` suite + evidence suite + ESLint clean.

## Report (081)

List: files changed with line refs, test counts, the grep-`11337`
sweep result, the counter status (pinned value with the per-dir event
counts, or DEFERRED with the reason), and confirmation of zero paid
calls and no frozen-surface change.
