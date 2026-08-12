# V3 semantic-reader presence-grain gate — confirmation-run registration

**Date registered:** 13 August 2026, before any confirmation call.
**Authority:** the human's ruling of 12/13 August, relayed by the
second session and quoted verbatim: "register the coarse gate and buy
the confirmation run." This selects ruling 051's option 3 in its
narrow form: a prospective re-registration of the reader gate at a
coarser grain, then one fresh confirmation run.
**Reviewer:** this document was written and committed before the
confirmation collection was prepared. The r49 run (186 responses,
scored FAIL at the fine grain in ruling 051) is used here as a design
pilot only. It is never scored under this gate and never pooled with
the confirmation run.

## 1. Scope: scoring layer only

The collection instrument is UNCHANGED from the r49 registration. The
reader handbook, one-case packets, one-case partition, response
schema, transport, caps, and provenance gate carry over byte for byte:

- frozen 93-case corpus `52bc3ae4…` (93 retained / 2 dropped / 3
  logged match relationships — the drop log carries forward);
- extraction schema
  `e5af8f2b6877e7e427ddae77bf7ed58bf0b6d129082885a838905cad5bce820d`;
- provider response schema `44b4807e…`;
- one-case response schema `f944b9b8…` (10,930 bytes; response cap
  14,000);
- one-case packet `237c0784…` (packet cap 42,000);
- semantic preparer SHA
  `9b545f368da469d0271613751d6da6f11bb4ae1fc57fa63d39a66733ce83177c`;
- reader digest
  `6cb95fd8032f4c43c9fdc1e45808680365d5a0d3eb2dda5ef085e4d97e10145f`.

The preflight for the confirmation run checks digest identity on all
of the above instead of a fresh equivalence proof. Any mismatch is a
hard stop.

Readers: two independent `codex.gpt-5.6-luna` readers (A and B),
bridge-echo attestation basis, stateless atomic calls. The readers
MAY run in parallel (two wide): the CLI bridge was checked earlier
tonight to be atomic per call with no cross-call state.

## 2. The gating identity (presence grain)

For each case (sample id) in each reader's response:

- **Result-request presence** = the case's `events` array holds at
  least one event whose `speech_act` is
  `tutor_directed_public_result_request`.
- **Proposed-test presence** = at least one event whose `speech_act`
  is `learner_proposed_test`.
- **Ambiguity flag** = the case's `genuinely_ambiguous` boolean.

A case is a **consensus case** when the two readers agree on all
three: the ambiguity flag, result-request presence, and proposed-test
presence.

Presence is read straight from the validated response file. The
assembly materializer (catalogue-action binding) is NOT run for
gating: a response whose events fail catalogue binding still scores
at the presence grain. Catalogue-binding failure counts are reported
(see §4).

Fail-closed rule: a response file that is missing, fails JSON-schema
validation, or is inadmissible under the unchanged provenance gate
scores every case it covers as NON-consensus. No re-runs beyond the
registered protocol's existing per-call retry rules.

## 3. Registered floors (all must hold; one attempt)

| Check | Floor | Pilot (r49, design only) |
|---|---:|---:|
| Result-request presence agreement | ≥ 0.80 | 85/93 = 0.914 |
| Proposed-test presence agreement | ≥ 0.80 | 91/93 = 0.978 |
| Ambiguity-flag agreement | ≥ 0.90 | 93/93 = 1.000 |
| Presence-grain consensus cases | ≥ 72/93 | 83/93 = 0.892 |
| Consensus non-ambiguous result-request cases | ≥ 4 | 18 |
| Consensus non-ambiguous proposed-test cases | ≥ 4 | 8 |

Pilot presence-grain figures were computed twice, fully independently
(this session and the second session), and matched to the digit.
Binomial sanity check on the consensus floor: at the pilot rate
(0.892, n = 93) the floor of 72 sits about 3.5 standard deviations
below the point estimate.

**One attempt.** The confirmation run is the only attempt under this
registration. A FAIL on any floor ends the semantic-reader layer:
ruling 051's option 1 then applies (the outcome study proceeds on the
layers that passed, with the layer cut disclosed). No threshold may
move after any confirmation data exist. No second re-registration.

## 4. Reported, not gating

These are computed on the confirmation run and reported in the run
report and the paper, with no floors:

- Strict canonical event identity (the failed fine grain; pilot
  24/93) — including the diff profile (targets/actions/speech
  acts/counts).
- Target-object-set agreement under BOTH pinned extractions, which
  differ and must never be conflated: (a) the unordered set of
  `target` slot ids across the case's events (pilot 63/93); (b) the
  unordered set of catalogue-action target bindings via
  `requested_or_proposed_action` (pilot 75/93).
- Catalogue-binding validity failure count per reader.

## 5. What a PASS licenses

A PASS certifies natural two-reader convergence at the presence grain
only: whether the learner asked the tutor for a result, whether the
learner proposed a test, and whether the case is genuinely ambiguous.
It does NOT rehabilitate the fine-grain encoding, which failed at
24/93 in ruling 051; every downstream use and every paper claim is
scoped to presence-level semantics, and the fine-grain FAIL is
reported alongside.

## 6. Budget and provenance

- Planned calls: 93 × 2 = 186, recorded in the confirmation
  collection manifest before any call.
- Running total at registration: 3,337/8,000 (report-031 convention:
  every `model_call_budget_reserved` event is one attempt). Planned
  end state 3,523/8,000.
- The ceiling in force is the 8,000 the human set directly in the
  reviewer session. A relayed renewal ("I authorize 8,000 calls
  again") is on record via the second session but is NOT relied on;
  the run fits under the direct ceiling with 4,477 to spare.
- Nothing from r47 (quarantined) or r49 (fine-grain FAIL; design
  pilot here) is admitted or pooled. Seed 515 stays unspent; the
  corpus stays the frozen seed-514 matrix, so no new seed is drawn.
- Never patch a live run; never waive a failed gate post hoc; the two
  dropped cases stay excluded forever; NEVER push the branch.
