# Resistance action/register programme state — 2026-08-23

This note is the prospective no-repeat handoff for the warm versus non-warm
confirmation arc. Historical run artifacts remain immutable and retain their
original incomplete/no-verdict dispositions.

## Evidence already complete — do not repeat

- The V8 held-out semantic validation already covered 120 fresh cases,
  including frozen misses, strong negatives, and unseen paraphrases. Both its
  manipulation and primary reports passed their registered gates. Collapsing
  `plain` and `neither` to the coarser `non-warm` class does not require another
  semantic-validation corpus.
- The prospective binary sample-size target is 89 determinate outcomes per arm.
  At the historical Sol–Sonnet joint coverage of 113/120, allocate 100 fresh
  dialogues per arm (200 total, 50 balanced blocks). This gives about 0.973
  probability that both arms retain at least 89 determinate outcomes. The
  predeclared two-sided Fisher exact test has power 0.9017 at 89 per arm for
  planning rates 0.10 versus 0.30.
- GPT-5.5 is excluded. Generation uses Luna; independent semantic judgment uses
  Sol and Sonnet.
- V1–V10 confirmation units, the 12 calibration dialogues, and the 60-case
  manipulation-validation corpus are excluded from reuse and pooling.
- Previously passing CI and execution preflights are not to be rerun unless one
  of their exact input closures changes.

## Technical smoke A

- Purpose: engineering-only, excluded from confirmation and from all treatment
  claims; no arm outcome analysis.
- Launch source: `f9c0bd508d4a3e3bcde6fe4cdd8ff28a8a9beecd`, clean detached checkout.
- Shape: four fresh dialogues, two warm and two non-warm/plain realizations;
  Luna generation; Sol and Sonnet semantic judging; parallelism 4.
- Destination:
  `.tutor-stub-auto-eval/warm-nonwarm-technical-smoke-2026-08-23-a`
- Operational result: 40 model-attempt reservations of a 384 ceiling; one unit
  completed and three stopped as `measurement_indeterminate`; no transport
  failure occurred.
- Plan SHA-256:
  `83ddfdb4f77bbf0de645cb16ff6d085a0de7fb660d7a2ca8a309351550c360dc`
- Result SHA-256:
  `c0c921375e4414076f8f0c2e1ea5699008f1d0dd1e253d80994bebb4d7a0c606`
- Outcome-blind diagnostic: all 8/8 Sol–Sonnet judgment pairs agreed on the
  binary final label. Two false-indeterminates came from Sonnet supplying an
  unnecessary evidence quote beside a semantic `no`; one came from disagreement
  on a subordinate jurisdiction axis while both judges returned the same binary
  final label.

Smoke A therefore passed model routing, Claude JSON transport, parallel launch,
trace capture, and binary semantic agreement, while correctly preventing the
full 200-dialogue launch from inheriting an over-strict historical wrapper.

## Prospective execution rule

Before another smoke or the confirmation:

1. deterministically normalize an evidence slot to `null` when that same
   judge's semantic field is `no`; never change a semantic field or label;
2. make the registered binary Sol–Sonnet final-label agreement authoritative;
   component disagreement is diagnostic only and cannot veto an agreed binary
   label;
3. retain schema, exact-source, provenance, model-route, confidence, and
   independence validation;
4. automatically recover only response-free transport failures or genuinely
   missing calls within the same unit and ceiling; preserve valid work;
5. never retry, repair, replace, or select a unit because semantic judgment is
   low-confidence or genuinely disagrees on the binary label;
6. append each run's launch commit, design path, destination, calls, failures,
   and disposition here or in the shared append-only run ledger;
7. skip a completed check when its exact recorded input/evidence closure is
   unchanged.

The next paid action is one fresh balanced four-dialogue technical smoke under
the prospective binary wrapper. Only after it passes should the wholly fresh
200-dialogue confirmation launch.
