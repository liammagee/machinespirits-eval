# Adaptive learner-state and tutor-move review packet

This is the zero-call preparation layer for
`adaptive-causality-human-state-move-validation`. It freezes a small two-world
packet before either human coder starts. The packet checks whether the public
learner state and the tutor move visible in the next reply are recognizable to
independent readers. It does not test learning or transfer.

## Frozen sample

The builder reads the sealed SHA-256-pinned `conduct-tags.json` and
`repertoire-tags.json` artifacts reported by the completed crossed-effects and
repertoire workplan cards. It selects one case from every learner-state × world
× matched/mismatched assignment stratum using the registered seed. The result
is 24 cases covering six states in both Rowan Flat and Alder Row Redoubt.

The lost-thread cases are retained because “handled natively despite the
assignment” is an important mechanism boundary. The later flat/bored promotion
is excluded because its evidence is one-world and lives in a separate artifact;
it should not be made to look like part of this two-world crossed packet.

## What coders receive

Give each coder only:

- `config/adaptive-causality-validation/state-move-v1.packet.json`;
- `config/adaptive-causality-validation/state-move-v1.codebook.md`; and
- that coder's own `state-move-v1.coder-a.json` or
  `state-move-v1.coder-b.json` template.

Do not provide the spec, hash manifest, other coder's file, source traces, or
`tests/fixtures/adaptive-state-move-v1.machine-key.json` before both completed
submissions are frozen. The public packet contains only neutral case IDs, the
learner turn, and the tutor reply. It excludes world, turn, arm, assignment,
automated labels and rulings, and downstream outcomes. The two templates use
different deterministic case orders.

Coders label what is visible. They choose one learner state and every clearly
realized tutor move. They never infer the assigned move. Multiple tutor-move
labels are allowed because a reply can visibly combine devices. Explicit
uncertainty remains indeterminate.

## Deterministic checks

Where the sealed local source artifacts are available, reproduce every frozen
artifact byte-for-byte:

```bash
node scripts/adaptive-causality-state-move-review.js check \
  --source-dir /path/to/sealed/crossed-effects
```

A clean clone without the ignored source exports can still verify the committed
packet, codebook, templates, and separate key against the frozen hash manifest:

```bash
node scripts/adaptive-causality-state-move-review.js frozen-check
```

`write` is a create-once authoring operation. It refuses to overwrite any
existing frozen artifact.

After both independent coder files are complete and frozen, compare them without
editing either input:

```bash
node scripts/adaptive-causality-state-move-review.js compare \
  --submission /path/to/coder-a-complete.json \
  --submission /path/to/coder-b-complete.json \
  --out /path/to/state-move-review-report.json
```

The comparison fails closed on missing cases, duplicate coder IDs, a packet-hash
mismatch, incomplete independence attestations, or invalid labels. Its report
keeps coder uncertainty and coder disagreement indeterminate. Only determinate
consensus is compared with the hidden planted state, assigned move, gold move,
source arm, and automated conduct ruling. It reports construct confusion,
treatment fidelity, and automated-versus-human ruling agreement overall and by
arm.

## Claim boundary

Agreement can support a narrow construct-validity claim about these public
states and visible tutor moves in these two sealed worlds. Disagreement narrows
that claim; it does not authorize post-hoc relabelling. Neither the machine key
nor human agreement establishes durable learning, transfer, human-learner
benefit, or generalization to new worlds.
