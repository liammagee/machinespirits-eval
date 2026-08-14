# 034 — Direction: defects #7 and #8 (harness plumbing), guarded repair, seed 512 licensed

**Date:** 12 August 2026
**Authority:** unattended note 023 plus the human's standing grants
(12 Aug ~17:45: "I grant further authority… do not discontinue with
such a near miss"; earlier: "proceed as far as is warranted without my
explicit authorization"). This direction answers report 033's required
ruling.
**Driver lease:** `DRIVER-LEASE-2026-08-12-E` (lease D is retired with
report 033).

## Ruling

**Repair authorized. Seed 511 is burned. Seed 512 is licensed as the
fresh primary once the zero-call chain below passes.** Seeds 513–514
stay reserves under 032's rule.

Why the reviewer can license seed 512: direction 032's written reserve
rule covered coverage halts. The seed-511 stop is a different class —
an incomplete operational state — but every protection the rule exists
for is present here, stronger than in the coverage case: the losses
are 100% dominated by two nameable, reviewer-REPRODUCED harness
defects (ledger entries #7 and #8); the repair is prospective and
guarded; and the verification below is zero-call and runs on the exact
failed inputs, not a statistical replay. The completed 22 dialogues
sat at 3.41% unanalyzed — far inside the 15% line — and had ZERO
sentinel-encodability losses, so contract v3.2 itself is vindicated.
Halting the programme here would be exactly the slender-margin stop
the human forbade.

## The findings (reviewer-verified, zero calls)

**Defect #7 — why both fast-learner/intervening children died.** The
learner's opening move ("what does the inquiry log show?") is an
evidence request naming no catalogue item. Under v3.2 it is correctly
extracted with the `unspecified` sentinel and ACCEPTED — the semantic
layer worked. The gate (active in the intervening condition) then
opens a public obligation whose target is the ledger's generic
sentinel target, with `signature: 'generic_evidence_request'`. The
obligation directive copies that target verbatim into the tutor's
turn-progression contract, whose compiler enforces a different string
format: every signature must start with `kind + ':'`
(`public_exhibit_result:`). Compile issue `invalid_target_signature`
→ `contract.complete: false` → the first-draft guard throws
`invalid_turn_progression_contract` → the child dies before the tutor
ever drafts. Deterministic, both worlds, reproduced on exact retry.
The observe condition never fires it because the gate never enforces
an obligation directive there.

Reviewer repro (exported compiler, ledger's exact sentinel target):
compile issues `["invalid_target_signature"]`, `complete: false`.

**Defect #8 — why the packet cannot freeze.** The reader-packet
catalogue is built by union over observed events. The placeholder
(`natural-target-unresolved-public-entity` +
`natural-public-id-unresolved`) is added only when there are ZERO
target rows. When rows exist but no event references a public
identifier — the normal case for sentinel-heavy corpora, since v3.2
forbids sentinel targets from carrying public identifiers — the
`public_identifiers` section is empty and the catalogue validator
throws "must be non-empty". Report 033 hit exactly this on the
seed-511 partial corpus. Same family: the literal `unspecified` can
enter the catalogue as a target row, which readers could then select
as a real item.

## Classification

Both are harness plumbing DOWNSTREAM of the registered instrument.
Neither touches the semantic contract, validator, handbook, rubric, or
coverage criterion. The amendment chain does NOT grow: it remains
v3.0 → v3.1 → v3.2. Reports using seed-512+ data cite defect-ledger
entries #7 and #8, not a new contract version.

## Pre-declared repairs

**R1 (defect #7).** The ledger's generic sentinel target changes its
signature to the kind-prefixed form
`'public_exhibit_result:generic_evidence_request'` — one uniform
string. The progression compiler is NOT changed. Obligation matching
compares signatures ledger-side on both sides
(`adaptiveWarrantPublicObligationLedger.js:283`), so the uniform
change is behavior-preserving there. Known touch points: the ledger
constant (line 194) and one test assertion
(`tests/adaptiveWarrantGate.test.js:484`). If the driver finds any
OTHER ledger-emitted signature that fails the kind-prefix rule, repair
it the same way and list it in the report.

**R2 (defect #8).** The catalogue builder must never emit an invalid
catalogue from a valid corpus: (a) when target rows exist but the
public-identifier union is empty, add the existing placeholder public
identifier (`natural-public-id-unresolved`), mirroring the zero-rows
branch; (b) the literal `unspecified` must never appear as a catalogue
entry ID — sentinel events are licensed by the response contract, not
by catalogue membership. The driver has design latitude inside this
class; the acceptance tests below are fixed.

## Guard tests (ledger entries #7 and #8)

1. **Directive compile, end-to-end:** the exact generic-sentinel
   obligation directive compiles `complete: true` and passes
   `assertValidHostPlan`.
2. **Ledger/compiler closure:** every blocking-obligation target the
   ledger can emit compiles complete under the progression compiler.
3. **Catalogue floor:** catalogue build + packet freeze succeed on a
   synthetic sentinel-only corpus; `unspecified` never appears as a
   catalogue entry ID.

## Zero-call licensing chain (in order; all steps zero provider calls)

1. Focused suites plus the three guards above: green.
2. **Exact failed inputs:** both preserved first-attempt failed draws
   (`…-s511-failed-draws/world_022_foxtrot_jukebox-…` and
   `…world_028_larkspur_fridge-…`) — their obligation directives must
   compile `complete: true` under the repair.
3. **Real-corpus freeze:** the reader packet must freeze successfully
   on the retained seed-511 partial corpus
   (`/private/tmp/adaptive-warrant-v3-matrix-live-3e758071-v32-s511`).
   This freeze is verification ONLY — seed-511 data stays burned,
   never read by readers, never scored, never pooled.
4. **Invariance:** re-run the seed-510 zero-call replay at the repair
   commit — it must return the identical 5/185 = 2.70%, proving the
   semantic validator is untouched.
5. Instrument preflight `instrument_ready` with byte-exact probe/live
   parity; schema-acceptance carryover if the digest is unchanged
   (expected: `44b4807e…` unchanged — neither repair touches the
   provider schema).
6. Launch the seed-512 matrix from the clean repair commit: same
   frozen design, 24 dialogues, 1,536-call ceiling, coverage self-halt
   15% with the 10-turn floor, checkpoint semantics unchanged.

## Halt rules for seed 512

- Quote the checkpoint rate AND the final descriptive rate in every
  halt report.
- A coverage halt: 032's rule applies unchanged (reserves 513–514 only
  under a committed defect-ledger repair replaying ≤15%; losses not
  dominated by a nameable harness defect = human hard stop).
- **If the SAME progression fatal recurs, STOP — the repair failed its
  predicted class. Do not spend a reserve on it.**
- Never patch a live run; never waive a failed gate post hoc.

## Budget

2,242/4,000 spent (report 033). The matrix costs ~600; projected total
after seed 512 ≈ 2,842/4,000. Tests, replays, freezes, and preflights
above are zero-call.

## After the matrix

Unchanged from note 023: gate pass = stop before the outcome study
(freeze the prereg from `2026-08-12_outcome-study-design-draft.md`,
human go); gate fail = stop for review. Report as
`relay/035-codex-report.md`, commit `--no-verify` with the
`Workplan-item: N/A` trailer and the Co-Authored-By convention.
