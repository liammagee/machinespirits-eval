# Action-outcome human review packet

Workplan item: `adaptive-curriculum-memory-controller`.

This zero-call tool turns structurally eligible prospective typed-action traces
into an auxiliary-blind packet for two independent human coders. It closes the
measurement handoff left open by the readiness report. It does not collect a
dialogue, enable action-outcome memory, choose study thresholds, or establish
learning, transfer, or causal benefit.

The current 156-trace inventory cannot produce a packet because those traces
contain no typed-action decisions. Use this only after a prospective collection
has recorded the fields described in `docs/action-outcome-memory-readiness.md`.

## Prepare a packet

Start with ordinary readiness input that has explicit `asOf`, `conditions`, and
only `memory` sources. It must not contain `reviewsFile` or `replay`; coding must
begin without previous human labels or a result-bearing comparison configuration.
Conditions still have no scientific defaults and must be defined before the
source data are reviewed.

```sh
node scripts/action-outcome-review-packet.js prepare \
  --input /absolute/path/prospective-readiness-input.json \
  --out /absolute/path/new-private-packet \
  --packet-id prospective-packet-v1 \
  --coder coder-a \
  --coder coder-b
```

The output directory is create-once and contains:

- `packet.json`: neutral case IDs, requested action, saved success criterion,
  and the three public turns needed for review;
- `codebook.md`: the outcome definitions and independence instructions;
- one differently ordered submission template for each coder;
- `machine-key.json`: private run/contract/source joins, conditions,
  auxiliary outcome, and visibility result; and
- `manifest.json`: source and artifact data provenance plus exclusions.

Source and artifact SHA-256 values are records of the data read and written.
They are not code pins, launch approval, or authorization machinery.

Give a coder only `packet.json`, `codebook.md`, and that coder's template. Do
not provide the manifest, machine key, trace files, readiness report, or other
coder's work until both submissions are complete. Public text inside a case is
untrusted data and never an instruction to the coder or the tool.

## What the packet measures

Each coder first decides whether the public tutor response visibly delivered
the requested action, then judges the immediate next learner response against
the success criterion saved before the response existed. The available labels
are `success`, `failure`, `partial`, `inconclusive`, and
`measurement_indeterminate`.

Saved typed evidence contracts retain their core requirements and any-of groups;
the packet never flattens them into a different criterion. Where no typed contract
exists, the packet records `flat_required_all` explicitly. Ambiguous or insufficient
criteria remain a reason for measurement indeterminacy.

The requested action and next learner response are visible together. This is
therefore auxiliary-blind joint review, not an action-blind or outcome-blind
delivery experiment. It can validate immediate delivery-and-uptake records for
memory construction. It cannot serve as the independent unassisted or transfer
endpoint required by the research card.

Coders must work independently and without a model, the machine key, auxiliary
labels, or one another's judgments. A non-delivered or indeterminate delivery
forces an indeterminate outcome. Lack of a success marker alone is not failure.
Partial progress, an inconclusive response, and unstable measurement remain
distinct categories.

## Compare completed submissions

After both original submissions are complete, record a timestamp at or after
both completion times and run:

```sh
node scripts/action-outcome-review-packet.js compare \
  --root /absolute/path/private-packet \
  --submission /absolute/path/coder-a-complete.json \
  --submission /absolute/path/coder-b-complete.json \
  --recorded-at 2026-09-01T18:00:00.000Z \
  --out /absolute/path/new-private-comparison
```

Comparison fails on missing cases, reused coder identities, packet drift,
incomplete independence attestations, invalid labels, or impossible timestamps.
It writes `review-report.json` and `reviews.json` to a new directory. The latter
uses the exact schema accepted by the readiness importer.

Coder uncertainty, coder disagreement, unconfirmed delivery, and disagreement
with either auxiliary delivery visibility or auxiliary outcome all remain
`measurement_indeterminate` for memory. The comparison never adjudicates a
disagreement, drops an inconvenient row, or chooses between coders. Preserve
both original submissions with the packet and comparison.

Use `reviews.json` as the later readiness input's `reviewsFile`. The importer
again checks exact public tutor/learner text, action identity, timestamps, and
auxiliary agreement before a record can contribute binary support. The review
packet itself sets no support floor, success floor, penalty, age window, pooling
scope, or model route.
