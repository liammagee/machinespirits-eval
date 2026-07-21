# Program-2 terra cross-family composer probe — results

Date: 2026-07-21. Tier: offline exploratory (no prereg bar, no H-W claim;
nothing here folds to the paper without its own pass). Branch:
`claude/program-2-terra-composer-probe`. Machinery:
`scripts/program2-coupling-probe.mjs --composer codex.gpt-5.6-terra` (the
Phase 4 probe, family-parameterized; default byte-preserved) +
`scripts/program2-terra-probe-analyze.mjs`. Artifacts (new files; pinned
Phase 4 artifacts untouched):
`~/.machinespirits-data/program-2/floor/coupling-probe-terra-delivered.jsonl`,
`coupling-probe-terra-graded.json`, `terra-probe-comparison.json`.

## What ran

The Phase 4 offline coupling probe repeated with the composer swapped from
`claude-code.claude-sonnet-5` to `codex.gpt-5.6-terra`: same archived 58
held-out warrant moments, same mini replies (tuned instruct greedy, from
the sealed Phase 4 artifact), same probe-identical span extraction, same
containment-only battery, same frozen grader. 58/58 rows, zero transport
errors, ~58 terra CLI calls. Pipeline fidelity was validated at zero cost
before launch: mini-solo regrade 0.414, sonnet delivered regrade 0.293,
fail-closed union 0.448 with 2 rescued — all byte-exact against
`program-2-phase4-results.manifest.json`.

## Headline: the audited outcome is family-invariant

| Construction | sonnet (Phase 4 ref) | terra (this probe) |
|---|---|---|
| Delivered file grade ("composed-alone") | 0.293 (17/58) | 0.293 (17/58) |
| Fail-closed union vs mini (0.414) | 0.448 (26/58), 2 rescued | 0.448 (26/58), 2 rescued |
| v1-battery rescore (containment + one question) | 0.293 | 0.293 |
| Containment: composed / span_lost / no_span | 51 / 3 / 4 | 53 / 1 / 4 |
| Composed-row component failures (1q / cue / premise / guards) | 13 / 22 / 12 / 9 | 14 / 22 / 11 / 11 |

Per-moment verdict agreement: **56/58**, with one moment flipping each way
(t007 terra-only compliant, t010 sonnet-only compliant) — the identical
headline rates are moment-level agreement, not a counting coincidence.
Terra held the span verbatim slightly better (1 loss vs 3); composed-row
guard failures ran slightly higher (11 vs 9). Both differences are noise
at this n.

## Decomposition: the outcome is span-determined

Two mechanical findings explain the family-invariance:

1. **Neither composer added a question.** Every `exactly_one_question`
   failure among composed rows (13 sonnet, 14 terra) is fully explained by
   the span itself carrying 2–3 questions (span question histogram over
   the 54 span-bearing moments: 39 one-question, 14 two-question, 1
   three-question). Composer-added question failures: **0 in both
   families.**
2. **The composed-alone penalty is dropped cue sentences, not composer
   misbehavior.** Span extraction keeps only question sentences. 25 of 54
   spans carry no frozen-cue word, and in 20 of those the mini's full
   reply had the cue elsewhere — in a statement sentence the extraction
   drops. Composed cue failures are 22 in **both** families (mini solo:
   6); each composer incidentally restored a cue in exactly 3 of the 25
   cue-free-span cases. The mini keeps its own cue sentence, which is why
   mini solo (0.414) out-grades composed-alone (0.293) in both families.

Consequence worth flagging for the record (not edited anywhere in this
pass): §6.20's interpretive clause "the frontier re-added extra questions
even under explicit instruction" is not supported by this decomposition of
the same archived delivered file — the extra questions were span-borne
(the mini's own multi-question replies), and what the frontier failed to
do was restore the *dropped cue*. The clause's companion claim ("the
checks, not the instruction, carry the design") stands. The number (0.293)
is unaffected; the mechanism attribution deserves an erratum-track note on
the Phase 4 prereg amendment wording, alongside the already-flagged
§6.19-mislabel erratum.

## The lever this exposes (design note, not a run)

Composed rows failing **only** the cue: 13 per family. A cue-preserving
span extraction v2 — prefer the cue-bearing question sentence, or carry
the mini's cue-bearing statement sentence into the protected span — is the
single highest-value offline fix, symmetric across families, and is the
span-side analogue of the 5b fallback battery's cue-preserving trim
(which already prefers "the question sentence containing a cue word").
Union-level headroom is bounded above by those 13 moments per family.

## Reading for the family-flip question

Offline, the committee's composer seat is **fungible between sonnet and
terra at the audited letter**: the deterministic protocol (verbatim span +
fail-closed battery) pins the outcome to the span's content, and both
frontier families obey the composition contract to near-identical effect
(terra marginally better at verbatim containment). This is a measured
two-family instance of the committee-architecture design claim that the
frontier member is a commodity. What the offline probe cannot see — and
what a live half-flip (terra tutoring, seams unchanged) would measure — is
the dialogue-dynamics side: terra's untriggered-turn tutoring, the
learner's response to terra texture, trigger density under a terra tutor,
and terra's own control-arm warrant floor (the 0.276 live reference is
sonnet-family). Composition discipline is no longer on that unknown list.

## Bounds

Offline single-turn regeneration at archived moments (no live dynamics);
n=58 moments, one world, one mini artifact; letter-not-spirit throughout
(the frozen six-word cue rule; the world-lexicon caveat of §6.21's
exploratory rescore applies unchanged); exploratory tier — descriptive
numbers only. The two flipped moments and the small guard-failure delta
are unexamined beyond counting. Terra calls used the same isolated CLI
bridge and `effort: low` as the sonnet probe.

---

## Addendum (same day): span-extraction v2 — the lever converts

`--span-mode v2` (cue-preserving extraction, default v1 byte-preserved;
regression check: recomputed v1 spans match all 54 archived rows) selects
one question sentence (cue-preferring) and carries the mini's cue-bearing
statement when no question has a cue. Zero-cost precheck hit its targets
exactly: 54/54 single-question spans, cue coverage 29/54 → 49/54, 20
statements carried. Both families re-composed under v2 (~55 calls each;
artifacts `coupling-probe-v2span-{sonnet,terra}-{delivered.jsonl,graded.json}`,
comparison `terra-probe-v2span-comparison.json`).

| | v1 sonnet | v1 terra | v2 sonnet | v2 terra |
|---|---|---|---|---|
| Delivered grade | 0.293 | 0.293 | 0.586 | 0.603 |
| Fail-closed union vs mini 0.414 | 0.448 (2 rescued) | 0.448 (2 rescued) | 0.586 (10 rescued) | 0.603 (11 rescued) |
| Containment: composed / lost | 51 / 3 | 53 / 1 | 53 / 1 | 54 / 0 |
| Composed one-question failures | 13 (all span-borne) | 14 (all span-borne) | 3 (composer-added) | 0 |
| Composed cue failures | 22 | 22 | 4 | 5 |
| Share of achievable ceiling (0.759) | 59% | 59% | 77% | 79% |

Readings. (1) The lever converts in full: delivered compliance doubles in
both families and the composite rises from 59% to 77–79% of the
structural ceiling; residual failure mass sits on premise timing (~11–12)
and guards (~10–11), surfaces extraction never touches. The delivered
turns now out-grade the mini solo (0.586/0.603 vs 0.414) — under v1 they
never did. (2) Family-invariance holds under v2: 55/58 per-moment
agreement, one net moment apart. (3) One asymmetry appears once span
noise is gone: sonnet added a second question in 3/53 composed turns
(span had exactly one; turn had two); terra in 0/54. The §6.20 clause
("the frontier re-added extra questions") is therefore unsupported for
the v1 file it described, but a small, sonnet-specific added-question
rate is real under the v2 instruction — the erratum note should carry
both halves. (4) Terra under v2 is the cleanest configuration measured:
zero span losses, zero added questions.

Status: offline exploratory throughout; nothing folds to the paper
without its own pass; the live machinery (pinned worktree) is untouched —
adopting v2 extraction live is a separate, unlicensed decision.
