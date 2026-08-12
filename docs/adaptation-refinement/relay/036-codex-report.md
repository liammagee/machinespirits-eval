# 036 — Codex report: fallback repairs committed; seed 513 preflight hard-stop

**Date:** 12 August 2026

**Driver lease:** `DRIVER-LEASE-2026-08-12-F`

**Authority:** direction 035, unattended note 023, and the human's standing grants

## Ruling

**HARD STOP for the human. Do not retry or resume seed 513. Seed 514 remains
the last reserve and was not spent.**

Repairs R1 and R2, the defect #9/#10 guards, and the retained-corpus closure
were implemented and committed at
`37385273401e72ee884a762e323c5651fd15ff7f`. The prescribed zero-call
licensing chain passed in order, and the seed-513 live command was issued from
that exact clean detached commit.

The live runner then failed its mandatory local preflight before starting a
child or making a model call. The existing test
`active obligation ownership survives a simultaneous writable-entry recovery
path` failed because the target-aware fallback emitted:

> The first-log-entry-log entry is not public yet...

where the test requires a fallback beginning `The log entry is not public
yet`. The launch exited nonzero after the focused/integrity preflight reported
200/201 passing. Under direction 035, this is a seed-513 failure of a new kind:
there was no repair, retry, resume, alternate command, or seed substitution.

No study row exists. No child started: **0 complete, 0 killed, 0 incomplete,
24 unstarted**. Consequently the two required coverage rates are both quoted
as undefined zero-denominator rates:

- **checkpoint coverage rate:** **N/A (0/0)** — no ten-turn-floor checkpoint
  was reached;
- **final descriptive coverage rate:** **N/A (0/0)** — no learner-analysis
  turn was produced.

Seed 513 is treated as burned for relay purposes even though the failure
preceded paid execution. Human authority is required for any repair or use of
seed 514.

## Repairs delivered at the clean commit

R1 made terminal obligation fallback text target-aware, added a concrete next
condition, removed every duplicate instance before restoring one owned first
sentence, and made generic-uptake/tactic-visibility issues advisory on the
terminal fallback path. Leak, provenance, source-alignment, obligation
resolution, and repetition vetoes were retained.

R2 leaves the five special value branches unchanged and scores every unlisted
value type, including `other` and `record_text`, through the target-scoped
answer-bearing relation rather than the literal type token.

Defect #9 guards cover a generic-target deferral passing the terminal check and
duplicate fallback ownership. Defect #10 guards cover `other`, `record_text`,
and a future unlisted type without admitting the identifier token as evidence.

The new closure traversed all learner turns in 22 sealed seed-511 dialogues
(176 turns), both preserved failed draws (3 reached turns), and the seed-512
dead children (6 reached turns). It found six reachable obligation
occurrences, compiled each directive, applied deliberately duplicated
deterministic fallback text, and recorded six passing final-response checks
with zero calls. Corpus trace digests were:

- seed-511 sealed: `0c29cea3c9c9637d631d43f76fab521535ccaaeb934c8641b12167fc2f4bb494`;
- seed-511 failed draws: `11fd96dffffea95459242d7378081b7b00231d32bd9bbec1fa616bf82c56485b`;
- seed-512 dead children: `91b44e1d6ade4e956ada731af313febdbc7f5e38517703d2e78ee61210ab5161`.

One limitation is now material. The retained corpora exposed only the unique
signature `public_exhibit_result:generic_evidence_request`. The closure rows
also record `progressionOk: false` for learner-uptake style issues while their
terminal disposition is passing because those issues are advisory. Thus the
green closure did not exercise the composite writable-entry target that failed
the launcher's broader preflight, and its treatment of that progression-class
issue is narrower than direction 035's statement that progression checks
remain blocking. This is disclosed for the human's next repair decision; it
was not changed after the failure.

## Zero-call licensing chain

1. Focused suites and guards: **263/263 passed** across six suites.
2. Fallback-pass closure: `fallback_pass_closure_green`, six of six reachable
   obligation occurrences passed the terminal disposition, zero provider
   calls. Closure digest:
   `a8871c2ff11ed6cf3fb787539f1638d393d432dc060e27a4f3c960f31cb12ffe`.
3. Seed-510 replay: identical **5/185 discarded = 2.70%**, with 180 predicted
   survivors, below the frozen 15% line, zero provider calls. Its 24 input
   traces have combined digest
   `bf140754c83f96fa6c9f40741b9b308330eb9c16d89cbe4a9ca958e760b1c7b0`.
4. Semantic preflight: **42/42 passed**, `instrument_ready`, zero model calls.
   Probe/live prompt bytes matched at
   `e6e35c267d837cc18435d784eb6835074dbc6ea7e56788b40ebc29179caebe84`.
   Extraction-schema digest was
   `e5af8f2b6877e7e427ddae77bf7ed58bf0b6d129082885a838905cad5bce820d`;
   reader-schema digest was
   `51107d43429bae0f22888530412f8282289f3f6460c19c5d9cfe8a00ea87941d`.
5. Provider-schema acceptance carried over with zero new calls because the
   response schema remained byte-identical at
   `44b4807e25f0620e2677ed49031dec558daa6f0aeec0f20a97b85ec2c6cb6bc1`.
6. The dry matrix sealed 24/24 dry jobs and bound seed 513, 24 dialogues, the
   1,536-call cap, source closure, destination, payload scope, and child policy.
   Approval digest:
   `f22085f3da19bfe99759ef2e6814fe9f5de23bc7b9b31d9fecc83bf5533b4736`.
7. The live launcher accepted that authorization and passed 35-world quality
   plus 22/22 prompt/world tests, then failed the second local suite at
   200/201. This stage used zero model calls and the runner exited before job
   creation.

## Seed-512 exact call recount and running total

Using the report-031 convention, seed 512 contributed **298 attempts**, not
only the reviewer's 293 completed calls:

| Role | Reserved/attempted | Completed | Errors | In flight at kill |
|---|---:|---:|---:|---:|
| Automated learner | 95 | 95 | 0 | 0 |
| Learner analysis | 95 | 93 | 0 | 2 |
| Speaking tutor | 93 | 90 | 2 | 1 |
| Opening | 7 | 7 | 0 | 0 |
| Tutor recovery | 8 | 8 | 0 | 0 |
| **Total** | **298** | **293** | **2** | **3** |

The exact unattended total before seed 513 was therefore **2,540/4,000**:
2,242 through report 033 plus 298 seed-512 attempts. Seed 513 added **0
attempts, 0 completed calls, and 0 errors**, so the running total remains
**2,540/4,000**. Seed 514 added zero.

Requested training reuse was `on`; effective training reuse for the intended
automated-only route was `off` / `not_applicable`. No prompt payload reached a
provider during the failed seed-513 launch.

## Principal artifact digests

| Artifact | SHA-256 |
|---|---|
| Focused suites and guards TAP | `ebbe40dbd422d5554e5e665ba4edc90220c98865f5716a030ae6f98712eb6979` |
| Fallback-pass closure JSON | `8f2c4a91e8c65a44a74baa5e9a74f055a92a719612dc4d14dbf0a09194bea654` |
| Seed-510 replay JSON | `e11b10a66f4fb0671063f2a1f0a3720075ea4918463bb23ee430239608cbcb0c` |
| Semantic preflight JSON | `67aa4787625b50bde9a58fc8777f409784fcb73dec77bf12cb4e43e26dedd4c5` |
| Schema-acceptance carryover JSON | `cd26910ae4c72a2ee9729ea3e4e7c415fd5510dc194b4874528c23df4f2aeb9c` |
| Dry study plan | `1ef1c494e11fd918c883f4895c65c75669b719b3694c31298aa092dd5eab3dc0` |
| Dry study results | `bd580d7f3b58e624486ed03d5179803882de4df25e9d4e53780ceb057bcece23` |
| Dry launch request | `41b7e7901827af85c37080532973f3496d4ebba5eef93963e38a592a541065b3` |
| Approved authorization | `a61bb65e3f0661cf6050d5c1188505adb07a0a6f13e68791920f2b57ba12f4f9` |
| Live study plan | `eb8824ddeb3033632b4c7a9cc4fcd2baa058a28e69874f0d62bd67f0e52cdb4d` |
| Live launch request | `9be2198de8452caee7d9e97382d2e140c61193075fecc988a402fe5fcd945631` |
| Live accepted authorization | `fed9d4eb3d890f1168431c94ad6e9905c344381e1a488e5c2b60cf51e7c2fa31` |

The retained live root is
`/private/tmp/adaptive-warrant-v3-matrix-live-37385273-r35-s513`. It contains
only the plan and authorization records; there are no job results or study
results because the preflight failed before execution.

## Required next authority

The human must decide whether to authorize a prospective repair of composite
target rendering and a stricter fallback closure, and whether that repair may
spend seed 514. Direction 035 gives neither authority after a seed-513 failure.
