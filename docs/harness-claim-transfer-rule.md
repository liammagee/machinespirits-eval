# Claim-transfer rule for the two tutor harnesses

**Date stated:** 16 August 2026.
**Card:** `tutor-stub-cell-reconciliation`.

## The rule

A claim born in one tutor harness does not hold in the other by
default. The cell world and the tutor-stub world use different scores
of record. A claim can pass between them through one of two doors.

- **Re-scoring.** Re-run the finding under the other world's score of
  record. In the cell world, this means LLM judges under the versioned
  rubric. In the stub world, this means deterministic readers,
  predeclared gates, or blind human readers.
- **Caveat.** Quote the claim with a clear limit. Name its home world and
  its score channel. Make no stronger claim about the new world.

## The precedent

The edge-timing register overlay is the precedent. It began in the
cell-side switching study. Tutor-stub then took it in as a frozen,
opt-in timing map. The stub text says that the overlay is not the
default and makes no learning-benefit claim. See the “Resistance-timed
edge” section of `docs/tutor-stub-cli.md`.

This is the caveat door. The timing map moved. The cell-side score did
not become a stub-world result.

## Where it binds

The paper (`docs/research/paper-full-2.0.md`) may quote a claim across
the two worlds only after re-scoring or with the stated caveat.

A workplan card that moves a finding across the two worlds must name
the door it used. If it used a caveat, the card must name the home world
and score channel.

## What it does not do

This rule does not merge the harnesses. It does not rank their score
channels. It does not make one score a substitute for the other. It
does not allow or call for a code change.
