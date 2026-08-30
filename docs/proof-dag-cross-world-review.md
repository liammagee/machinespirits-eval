# Cross-world proof-DAG review packet

This is the zero-call preparation layer for
`adaptive-proof-dag-cross-world-validation`. It asks two independent people to
check whether the authored evidence and release timing mean what the runtime
says they mean. It does not evaluate tutor quality or learning.

## What the four labels mean

- **Available premise:** evidence that has entered the public scene by this
  turn. Later evidence does not count.
- **Enabled rule:** an authored inference whose required facts are all public,
  either directly or through another enabled rule.
- **Licensed conclusion:** a candidate the public evidence and enabled rules
  actually support now.
- **Forbidden shortcut:** a tempting candidate whose proof is still missing a
  required public fact or rule connection.

The six-case packet crosses three deliberately different domains: Rowan Flat's
household leak, the Campus FAQ Machine's AI problem-formulation exercise, and
the Unsigned Nocturne's archival attribution. Each world contributes one
partial prefix and one first-licensed prefix. That is authoring diversity, not
evidence that the semantics are valid; the independent review supplies the
missing validity check.

## Artifact boundary

Give each reviewer only:

- `config/proof-dag-validation/cross-world-v1.packet.json`; and
- a separate copy of
  `config/proof-dag-validation/cross-world-v1.submission-template.json`.

Do not provide `tests/fixtures/proof-dag-cross-world-v1.machine-key.json` until
both submissions are complete and frozen. The packet has neutral candidate
labels and excludes tutor output, learner output, downstream outcomes, and the
machine rulings. Reviewers should work independently and use no transcript or
result artifact.

## Deterministic checks

Rebuild the packet in memory and compare it byte-for-byte with the frozen
artifacts:

```bash
node scripts/proof-dag-cross-world-review.js check
```

The command prints the packet SHA-256 for an assignment record. `write` is an
authoring operation for a prospective new packet version; it is not part of
review and must not overwrite completed reviewer inputs.

After both reviewers return their independent copies, compare them without
editing either source file:

```bash
node scripts/proof-dag-cross-world-review.js compare \
  --reviewer /path/to/reviewer-a.json \
  --reviewer /path/to/reviewer-b.json \
  --out /path/to/cross-world-review-report.json
```

The comparison validates full case coverage and ID ranges first. Exact human
agreement is then compared with the separate machine key. Any explicit
uncertainty or reviewer disagreement remains `indeterminate`; it is never
collapsed into a negative judgment.

## Claim boundary

The machine key proves only what the present Horn-rule implementation derives
from the encoded prefix. Human agreement can support the narrower claim that
the authored ordinary-language semantics and release timing match those
encoded rulings across this packet. Neither result establishes tutor efficacy,
generalization beyond these worlds, or human learning.
