# 015 — Codex report: acceptance ping passed; fresh-seed matrix blocked by frozen seed

**Date:** 12 August 2026

**Driver lease:** `DRIVER-LEASE-2026-08-12-D`

**Direction commit:** `2daf55298e411c34a57c64b29f0ff484de7c7a03`

**Clean execution source:** `575801bc92d9c6c31afcd49690f88014c32da224`

**Status:** acceptance ping passed; representative matrix not launched; waiting
for a prospective seed/provenance ruling

## Pre-call verification

The run used the clean detached worktree
`/private/tmp/ms-adaptation-refinement-575801bc`. The branch checkout's
pre-existing deleted bytecode and untracked `.agents/skills` directories were
left untouched.

The required pre-run checks passed from the exact execution source:

- derivation-world quality: 35/35;
- focused prompt/world suite: 22/22;
- route: `codex-cli 0.147.0`, logged in using ChatGPT;
- frozen preflight SHA-256:
  `904decbbf8f91be98d42516e07f043070cd551798af002e69586a894e780cf7f`;
- frozen acceptance packet SHA-256:
  `b5e2078d05b63eae4a86fcbcaf3287796bc71e98044e9427f405021ef2d2f62d`;
- response-schema SHA-256:
  `cee65bd05c9d374e6803bd79caf2f6d47e605c247e3b8e8b38cd2b95f6700b43`;
- authorization-request SHA-256:
  `99ac30a3fabd8213ff547f60e9e5a84c6cc3aa210447980cc4ccb2869e822314`;
- approval digest:
  `c28df586a105cf1c846fe4f065a43328a9494a91215aa67ef8fdfb02a79f93cc`.

## Acceptance ping: PASS

The exact one-call ping authorized by relay 014 completed once and passed:

- result:
  `/private/tmp/adaptive-warrant-v3-live-seat-repair-ping-run-575801bc-rerun1/schema-acceptance-result.json`;
- result SHA-256:
  `29cab3eebd57039abc2b9ce3ab56db7ed084bb6120913ec6cfb5782da669b368`;
- response SHA-256:
  `85ba9b96abc49090eb50e2213d7199118247b9e9d43ce7ca2909357dfccf9015`;
- attempted/completed calls: 1/1;
- returned provider/model: `codex` / `gpt-5.6-luna`;
- prohibited tool events: 0;
- strict result status: `passed`.

The synthetic ping case remains permanently excluded from research evidence.
There was no provider rejection and no retry.

## Matrix launch blocker

Relay 014 requires a **new seed** while preserving the frozen design. The
failed, burned `36d2e63f` matrix used master seed `503`. The frozen V3 design
still declares master seed `503`, and the exact clean runner at `575801bc`
hard-rejects every other seed before creating a study root. A zero-call probe
with the next integer seed produced the raw prerequisite rejection:

```text
[warrant-study] error: --mechanism-validation requires the predeclared master seed 503
```

Launching seed `503` would not satisfy relay 014's new-seed instruction.
Changing the design or executable to admit a replacement seed would create a
new source commit and invalidate the exact-source preflight and acceptance-ping
binding just exercised. Concealing such a change or relabeling `503` as new
would violate the freeze and provenance rules.

This is classified as a **prospective protocol/provenance prerequisite
conflict**, not a provider, transport, semantic, consensus, or operational
failure. It produced no matrix artifact and disclosed no research data.

## Calls and boundary

| Activity | Calls |
| --- | ---: |
| Permanently excluded acceptance ping | 1 |
| Representative matrix | 0 |
| Natural semantic readers | 0 |
| Natural decision readers | 0 |
| **Total transmitted at this boundary** | **1** |

No matrix dialogue, reader, gate, or outcome-study call was launched. The
failed `36d2e63f` corpus remains preserved, unscored, excluded, and unpooled.

## Required ruling before restart

The next direction needs to prospectively name the replacement master seed and
choose how its source closure is made valid. The provenance-preserving path is
to amend the declared seed and runner together in a new clean commit, rerun the
zero-call preflight, and authorize one new source-bound acceptance ping before
freezing and launching the replacement matrix. Reusing the existing ping would
instead require an explicit prospective change to the ping lineage contract;
that is not inferred here.
