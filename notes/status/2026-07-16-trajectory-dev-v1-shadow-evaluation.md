# Trajectory development v1 shadow evaluation

Status: implemented as a permanently non-held-out, model-free development surface.

## What it contains

`config/tutor-stub-trajectory-dev-v1.json` preserves public evidence from the six saved blind-review pairs, the V21 turn-4/turn-7 calibration pair, and four sequence episodes: Ravensmark V18, Greyfen V19, Tallow V20 turns 1-5, and Nocturne V22 turns 1-8. It also includes two optional synthetic fast/slow pace prompts. Those prompts are explicitly unobserved and unscored; they do not contain or consume model seeds.

The assembler records the source path and SHA-256 digest for every saved artifact. It extracts public learner/tutor messages and normalized delivery/audit fields, not private prompts or planning state.

## What the shadow report measures

Hard integrity remains its own section: private or unsupported evidence, source-perspective drift, duplicate or missing clue delivery, unanswerable questions, and continuation after terminal closure. Sequence quality is reported separately: learner uptake, respond-then-develop structure, clue pace, public continuity, generic naturalness/boilerplate proxies, part and stance adaptation, and closure latency.

The saved corpus currently contains 29 observed turns and 16 due clue releases. All 16 releases are present; one previously recorded Tallow duplicate-clue failure is retained. The structural proxies find learner uptake and respond-then-develop on all 29 turns, with part changes on 56% and stance changes on 68% of eligible turn boundaries. These are descriptive diagnostics, not success gates.

The saved blind ratings also preserve the result that all six rejected originals were preferred to their delivered repairs (mean delivered-minus-original rating: -0.6). This is a development warning about recovery quality, not an independent preference study.

## Claim boundary

This surface does not change runtime delivery gates, retroactively relabel V18-V22, establish held-out generalization, or authorize policy changes. The continuity and naturalness measures are deliberately generic proxies, not semantic judgments. Exact part/tactic realization remains shadow evidence. Any runtime-policy change should follow an independent blinded human review of newly frozen candidates.

## Commands

Validate the tracked corpus without writing reports:

```bash
npm run tutor:stub:trajectory-shadow -- --check
```

Build the model-free JSON and Markdown reports:

```bash
npm run tutor:stub:trajectory-shadow
```

Reassemble the corpus from the saved public artifacts only when their provenance is intentionally being refreshed:

```bash
node scripts/assemble-tutor-stub-trajectory-dev-corpus.js \
  --blind-dir /path/to/tutor-stub-first-draft-blind-review \
  --artifact-root /path/to/.tutor-stub-auto-eval \
  --out config/tutor-stub-trajectory-dev-v1.json
```
