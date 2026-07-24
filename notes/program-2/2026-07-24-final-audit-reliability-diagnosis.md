# Program 2 common final-audit reliability diagnosis

Date: 2026-07-24
Authority: `PROGRAM-2-FINAL-AUDIT-RELIABILITY-GATE-AMENDMENT-1.md`
Replay config: `config/tutor-stub-final-audit-reliability-gate.json`
Replay artifact: `exports/program2-final-audit-reliability-gate/replay-classification.json`

## Zero-model result

The fixed-hash replay reproduced all four archived terminal failures with no
model calls. All four are `fallback_construction_defect`; none is classified as
a true unsafe-draft limit or audit/input mismatch.

| Case | Common construction failure | Existing public-safe alternative |
|---|---|---|
| R1 | the fallback quotes the learner's unsupported Edony-as-striker conclusion | retain the separate charcoal-book / weir-forge clause |
| R2 | a ledger-style `I enter:` preface prevents bounded-focus recovery, so generic uptake survives | strip the preface and retain the substantive charcoal-signature clause |
| R3 | the uptake is safe, but the declarative handoff reconstructs the full unsupported conclusion | retain the separate worn-burin / Edony ownership clause |
| R4 | the chosen uptake clause crosses the due clue's duplicate-delivery threshold | retain the learner's separate broken-R / square-notch clause |

The existing leak and clue-delivery-multiplicity audits accept each diagnostic
alternative. `response_configuration:axis_not_visible` is report-only under the
frozen strict disposition and is not the terminal cause in R1, R3, or R4.

## Licensed repair target

The common bounded-focus constructor should consider every substantive clause,
not only the first clause or ledger preface. Both uptake and declarative handoff
selection should reject candidates that fail the already-active public leak or
due-clue multiplicity checks. The final audits, their dispositions, the
committee seam, treatment flags, prompts, weights, v1/v2 extraction, and
cue-blind resolver remain unchanged.

## Repair result

The implemented repair passes all four fixed-hash cases through the unchanged
common final-audit bundle. It makes three shared changes only:

1. bounded learner-focus recovery strips ledger-style prefaces and considers
   every substantive clause before shortening a clause;
2. uptake and declarative handoff candidates are screened by the already-live
   leak and due-clue multiplicity audits; and
3. dramatic-release and configured-continuation fallbacks receive that same
   public-state candidate guard from the common runtime.

No audit disposition, treatment seam, prompt, weight, v1/v2 extraction rule,
committee decision, cue-blind rule, retry limit, or model-call count changed.
The replay result is 4/4 reproduced, 4/4 classified, and 4/4 repaired with zero
model calls.

Focused regression tests, `npm run derivation:quality`, the prompt/world audit
tests, lint, and workplan checks pass. The full hermetic suite was run both in
the restricted runner and with loopback permission. The restricted run had 27
network-bind failures and 96 consequent cancellations. The permitted run
isolated two unrelated pre-existing failures:

- `tests/tutorStubLastSettings.test.js:139` expects the human committee status
  object without the already-live `spanInterface: v1` field; and
- `tests/tutorStubRoleHistory.test.js:220` assumes its synthetic long history
  will cross a prompt-budget threshold, but the current fixture does not.

Neither file nor the underlying settings/history seams is changed by this
repair. They are recorded rather than folded into the preregistered reliability
slice.
