# 008 — Codex report: token-D supplement pass and decision-reader boundary

**Date:** 12 August 2026

**Driver lease:** `DRIVER-LEASE-2026-08-12-D`

**Frozen instrument commit:** `225a7b073eb0521df05481bc7d54b6a451afc1ef`

**Branch at report:** `adaptation-refinement`

**Status:** record-entry one-shot passed; decision readers completed; stopped
before the representative matrix

## Source and execution checks

The token-C supplement freeze was reused only after its bindings verified from
the clean detached worktree
`/private/tmp/ms-adaptation-refinement-225a7b07`:

- freeze manifest:
  `/private/tmp/adaptive-warrant-v3-record-entry-supplement-006-225a7b07/diagnostic-freeze-manifest.json`
  (`dfed99b10c41f036fa5ed892c74e0b93dd425a744211cee9c839921cab083b7d`);
- exact source commit `225a7b073eb0521df05481bc7d54b6a451afc1ef`,
  clean provenance status, and the unchanged frozen handbook hash
  `53b3bff6f9f3c9ee6df92113439c596407f7045624868ec1f85ca116aab5aa6c`;
- blinded corpus hash
  `eeb70692cfd5d9bd7c968899fe664de775ceb70fbb89ccdd43a65dc770dffb01`,
  with eight cases and eight record-entry opportunities;
- zero overlap with all eight hash-bound excluded diagnostic and smoke
  corpora;
- reader collection manifest hash
  `140e203b740a7d33ac601402c0a7f6a5964134c60be066e7a77dba9faf20366a`;
- approval digest
  `d3cce2f5409984277c0bd6f69f2261456307ba9f880f75e06db40b2a90704988`,
  binding two Luna calls through the OpenAI Codex CLI ChatGPT-account route.

The three token-C local CLI attempts remained artifact-free and transmitted
zero provider calls, as ruled in relay 007. Before token-D transmission, the
required derivation quality check passed 35/35 worlds and the focused
prompt/world audit passed 22/22 tests. The already-recorded freeze validation
remains 8,502/8,502 root tests and 137/137 tutor-core tests; no redundant full
suite was run for this report-only checkpoint.

## Supplement reader run and assembly

The bound run is
`/private/tmp/adaptive-warrant-v3-record-entry-supplement-006-225a7b07/semantic-reader-run-token-d/semantic-reader-run.json`
(`b8299c2002678128230605fb26ed575cb483bab38255665df6fe1039e0733e81`).
Both calls completed within the exact two-call ceiling, returned
`gpt-5.6-luna` through provider `codex`, and recorded zero prohibited tool
events. Their response hashes are:

- reader A:
  `c66080c7ec93acabf8a1ae1f35a5e7c00df663115a487499b1838ddb71aadff4`;
- reader B:
  `120e977d8d0b0c9049c049e0435b01b8e5185390ce6c0b48005f8384d7b631af`.

Both eight-case assemblies validated using only the declared literal-span and
event-order derivation. The assembled hashes are
`87e6b0ccaf401edfa711b0f244301336c9a4a4a87768dd94f8f59061c94cd7e3`
for reader A and
`6cdd9ba3e3a978da1170cb7f433a5ee843953e9d6061fa0477a4656391952c7b`
for reader B.

## Direction 006 one-shot result: PASS

The support artifact is
`/private/tmp/adaptive-warrant-v3-record-entry-supplement-006-225a7b07/semantic-support-token-d.json`
(`ceeaaa75597afa42931a8f861a58286ff0f6f0e4005fb3251fbb2126276cfa69`).
The generic five-cell scorer necessarily reports `insufficient_support` for
cells the record-entry-only supplement was not designed to contain. Applying
direction 006's preregistered cell-specific rule gives the controlling result:

| Measure | Observed | Required | Result |
| --- | ---: | ---: | --- |
| Hard-consensus record-entry cases | 5 | 2 | **PASS** |
| All hard-consensus cases | 5/8 | — | diagnostic observation |
| Raw event-structure agreement | 0.625 | — | diagnostic observation |

The three disagreements were all classified as reader-B errors and zero as
both-defensible contract ambiguities. In each case reader B added `material`
and `identified_material` to the requested value/component sets although the
frozen handbook permits request categories only when their category surfaces
are literally named in that event span. Reader A followed the private key's
closed identity. No contract, schema, threshold, or corpus was changed.

The one-shot therefore certifies the record-entry cell. Together with the four
cells certified by the original 24-case diagnostic, the five-cell semantic
support layer is certified for diagnostic readiness. Nothing from this
supplement is pooled into prevalence, natural performance, or outcomes.

## Decision readers on the original frozen corpus

Following the authorized PASS path, a separate blinded decision collection
was prepared against the original 24-case corpus hash
`9eec0174af26564d44fc6dfbb4f95179f281b7163540ad28c3667a0011c87df5`.
Its collection manifest is
`/private/tmp/adaptive-warrant-v3-semantic-diagnostic-225a7b07/decision-reader-collection-token-d/annotation-collection-manifest.json`
(`be9a37bad5341088c575fcd580c74c57ac65d69557b99b587a590171084cd9bc`),
and its authorization request hash is
`00907737f4f9089a4be58f55d499272f780a58744fc7f6a4ede83f8082165509`
with approval digest
`ec8bc65ef1f6da9dbbd6aa8011e81d2b69738e5c46097b0ecfbbe347cf1f1463`.

The run artifact is
`/private/tmp/adaptive-warrant-v3-semantic-diagnostic-225a7b07/decision-reader-run-token-d/decision-reader-run.json`
(`6ceaacce17960e532a1923c2c37a7de780ed0c2eecd459b5a5e528b6c208d8ef`).
All six planned calls completed under the eight-call ceiling, all returned
Luna through the declared route, and all recorded zero prohibited tool events.
Both 24-case assemblies validated with zero normalization edits:

- reader A:
  `/private/tmp/adaptive-warrant-v3-semantic-diagnostic-225a7b07/decision-assembled-token-d/reader-a.json`
  (`22099979f4198d77ff7375c1c0666757caa7f00d516fb5ce522210920e2314fa`);
- reader B:
  `/private/tmp/adaptive-warrant-v3-semantic-diagnostic-225a7b07/decision-assembled-token-d/reader-b.json`
  (`1d5b8e48c21a3062618e5f97d00f5e304aa1c795c1e57b4a54e233cc5a07387a`).

Deterministic agreement scoring found:

| Decision-reader measure | Observed | Design reference | Reading |
| --- | ---: | ---: | --- |
| Binary warrant agreement | 20/24 = 0.833 | at least 0.80 | clears raw-agreement floor |
| Binary consensus support | 12 positive, 8 negative | at least 2 positive, 6 negative | sufficient |
| Full typed-mechanism consensus | 16/24 = 0.667 | at least 0.75 | below floor |

The four binary disagreements comprise one `none` versus
`public_obligation` basis and three `none` versus
`register_or_accumulated_trouble` bases. The latter three are the
tutor-selection/low-agency family. The targeted corpus has no frozen mechanism
prediction key and is explicitly diagnostic-only, so precision, recall, and
accuracy are not evaluable and these figures are not a V3 performance-gate
result. They do show that binary legibility is above its floor while complete
typed decision consensus is not yet above the natural-study floor.

## Boundary, calls, and next control point

Token D spent eight provider calls in total: two supplement semantic-reader
calls and six decision-reader calls. The token-C predecessor spent zero
transmitted calls. No model-call retry was required in either token-D run.

The representative matrix was **not launched**. This report stops at that
boundary, as explicitly required by the human instruction governing this
turn. The targeted diagnostic and supplement remain non-gate evidence; a
representative natural corpus is still required to measure extraction and
decision performance. The below-floor typed decision consensus should be
reviewed before treating a later matrix launch as having satisfied every
decision-reader prerequisite.
