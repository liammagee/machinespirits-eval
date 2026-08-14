# V3 instrument audit — four-lens parallel review

**Date:** 12 August 2026
**Audited state:** commit `fcd944f01c3ff68a54cafcadc659533620bd1c66` (with the
working tree one commit ahead at `d3f99c2a` and carrying the uncommitted
tagged-union refactor; drift noted per finding where it matters).
**Method:** four independent read-only auditors, one per layer — provider
transport, contract internal consistency, cold-reader legibility, harness
hygiene. No model calls. No files changed.
**Status of the decision rules in §B:** reviewer-proposed defaults. Codex may
adjust any of them with a prospectively documented reason; what it may not do
is leave the ambiguity open.

Reading order: the triage below is the work plan; the per-lens sections carry
the detail and the file:line references.

---

## Triage

### A. Launch blockers — fix before the next smoke (would burn calls)

- **A1. String-length keywords still in the schemas.** `minLength`/`maxLength`
  survive on `evidence_span.text` and `note` in the reader schema, and
  `minLength` plus a root `$schema` keyword and typeless `enum`s in the
  decision-reader schema. Same provider rule as the union keyword that burned
  the last smoke. Worse, the new keyword allowlist was written from the
  schema, not the provider spec, so it blesses exactly these keywords and the
  preflight passes while the provider rejects. Enforce bounds in the
  assembler; write the allowlist from the provider's documented list only.
  (Transport #1, #2, #8, #9, #10.)
- **A2. The preflight audits a different schema than the launch sends.** It
  validates a synthetic one-sample rebuild; production ships eight-sample
  batch files. Everything that scales with batch size — property count,
  bytes, enum totals — is unchecked. The acceptance ping and smoke are also
  1- and 3-sample. Audit the actual shipped batch schema files, and build the
  ping schema at production batch size. Also: the recorded response-schema
  size limit is never enforced at prepare time, and the reader launch sends
  the schema with no validation call of its own. (Transport #3, #4, #5, #7.)
- **A3. Nesting depth is 9 of the provider's 10.** No change needed; add a
  depth assertion to the totality audit so the next wrapper fails at
  preflight. (Transport #6.)
- **A4. Preflight work directory is still a fixed name.** Only relocated —
  the constant subdirectory name plus no cleanup on success guarantees the
  collision recurs. Unique per run (mkdtemp with commit prefix) or remove in
  a finally block. Also: a failed preflight exits 0, and the artifact is
  written before it is validated. (Harness #1, #2, #3, #4.)

### B. Consensus killers — fix before the diagnostic freeze (would fail
### support with perfect readers)

- **B1. Gold and predictions are validated under different contracts.** The
  runtime validator never enforces the per-act field contracts (a
  tutor-selection event with no target, a stall carrying an action, a joint
  executor all pass at runtime and fail on the gold side), so the deference
  boolean is silently false on legal inputs and scoring joins the two
  regimes. Import the act-contract table into the runtime validator.
  (Contract #2, #3.)
- **B2. Event-order asymmetry scores correct models zero.** Reader events are
  sorted by span start; runtime prediction events keep model order; scoring
  pairs by index. Sort both. (Contract #10.)
- **B3. The value-set rule — nominated next death.** "Requested or produced"
  never defines "produced", and the gold key applies opposite conventions to
  parallel acts. Proposed rule: value/component sets are non-empty only for
  request-mode acts, and only for values literally named in the span; all
  proposal/question/analysis/withdrawal/transfer acts get empty sets.
  (Legibility #1.)
- **B4. Compound-clause whitelist scope.** The three enumerated compound
  patterns read as either a closed list or as examples; result request plus
  analytic clause — the commonest real compound — is unlisted. Proposed
  rule: the licence is general, not enumerated. (Legibility #2.)
- **B5. Executor trichotomy has no default.** Tutor/joint/unspecified is
  positively defined only for direct address, and the gold key itself
  encodes two indistinguishable imperatives differently. Proposed rule:
  tutor whenever the act is a request and the tutor is the only other party;
  joint only on explicit first-person-plural; unspecified only on explicit
  impersonal/passive. Re-author the two gold cases to one convention.
  (Legibility #3.)
- **B6. Death four survives in withdrawal and transfer-to-learner.** Both
  auditors found it independently: the target-policy enumeration covers 13
  of 15 acts and skips exactly the two remaining catalog-or-none acts.
  Extend the analytic-contribution target sentence to both verbatim.
  (Legibility #6 = Contract #7.)
- **B7. Twin acts distinguishable only by the discriminator.** Repair
  request vs wording request have byte-identical contracts;
  transfer-to-learner is a typed subset of proposed test; stall, complaints,
  low-agency, other, and analytic all share the null/null shape; and
  low-agency-deferral is missing from the precedence table entirely. Give
  each colliding pair a written criterion or merge; add the missing tier.
  (Contract #4, #5, #6.)
- **B8. The design doc's own multiplicity example is unproducible.** §2.6's
  one-clause dual-event example contradicts the handbook's one-event-per-
  clause rule three times over and would be rejected as overlapping spans.
  Replace with a two-clause example; delete the unqualified coexistence
  sentence. (Contract #8.)
- **B9. Remaining legibility rules to write** (each one line, ranked by
  expected frequency in natural dialogue): cross-turn anaphora window
  (the required-target contract currently forces one reader into abstention);
  first-person need-statements as requests; confirmation saybacks;
  multi-target coordination in one clause; rhetorical/self-answered
  questions; conditional and negated requests; action-object specificity
  tie-break; span-uniqueness vs shortest-span conflict (currently a
  whole-batch crash in the assembler — should be a case-level rejection);
  polite-permission suffix vs politeness-is-not-an-event; reported speech.
  Proposed one-line rules for all ten are in the legibility section.
  (Legibility #4, #5, #7–#14.)
- **B10. The abstention flag doubles every ambiguity.** Hard consensus dies
  if either reader abstains, so each unclosed field is two failure modes.
  At the declared 0.8 agreement over 24 cases, fewer than five divergent
  cases are affordable against roughly eight open coin flips before the B
  fixes. After the B fixes, consider whether abstention should also carry a
  typed reason so abstain-vs-encode disagreements are diagnosable.

### C. Integrity hardening — fix before the representative matrix (standing
### invariant violations that won't burn tomorrow's run)

- **C1. Fingerprint coverage.** The instrument fingerprint omits every
  launch runner, the smoke corpus builder, and the preflight script itself;
  the model id on the wire is hardcoded at call sites and absent from all
  digests; the working tree currently fingerprints an untracked file, which
  will throw at any clean checkout. (Harness #5, #6, #7; Transport #11.)
- **C2. Decision-reader path lacks source-commit binding end-to-end** — the
  exact omission the semantic path fixed once. Manifest, authorization
  bindings, and freeze check all need the commit field. (Harness #8.)
- **C3. Burn discipline is convention, not machine.** Failure records don't
  say which sample ids were exposed or whether the packet left the machine;
  the diagnostic's excluded-corpora list is operator-supplied with no
  checked-in registry (the baseline study already has the right pattern to
  copy). (Harness #9, #10.)
- **C4. Reruns re-spend completed calls; assembler accepts unverified
  responses.** No cross-run call ledger keyed to (commit, corpus, batch); the
  assembler never checks the run artifact's completeness or response hashes,
  so a partial or hand-authored response assembles cleanly. Model
  attestation is recorded but never enforced. Budget slack outside the smoke
  is legal but unjustified. (Harness #11, #12, #13, #14.)
- **C5. The design doc's canonical example fails the real validator.** The
  §2.1 envelope is rejected because the publicity check requires catalog ids
  to be literal substrings of public text while the contract mandates opaque
  slugs. Resolve ids to display labels before the publicity check, and make
  the §2.1 example a test fixture. (Contract #1.)
- **C6. The live extraction seat's schemas still admit null** — the totality
  mandate was applied to the reader schema only; the runtime local and
  provider schemas keep nullable target/action fields and are never run
  through the totality audit. (Contract #9.)
- **C7. Uncertainty-reason limit breaks its own cap post-augmentation, and
  the validator-added reason is missing from the design doc's closed list.**
  (Contract #11.)
- **C8. Semantic prepare path lacks the packet/schema-file equality assert
  the decision path has.** (Transport #12.)

### Consequences for the diagnostic

The B fixes change the contract, so the current gold key must be re-authored
under the settled conventions (B3 and B5 change specific gold cases), and the
next diagnostic corpus is fresh regardless — which was already required.

### Verified clean (do not re-fix)

The union swap to a tagged discriminator is correct and complete. Every
property required, closed objects everywhere, no nullables in the reader
schema, single non-recursive definition reference, root object, enum and
property counts far under limits, bridge serialization byte-faithful. Offsets
(death 1) and prose equality (death 2) are genuinely closed; the speaker
branch of death 3 is closed and doubly enforced. Compiler consumes typed
fields only, precedence total, ties resolved. Free text absent from identity,
joins, and gates except the predeclared span-overlap check. Size budget
matches the design doc on all eight values. No retries, atomic writes,
conservative call accounting, clean-worktree gates on every entry point, the
two-call smoke cap harness-enforced, and nothing in the family touches the
production database.

---

## Full findings by lens

The four auditor reports follow in compressed form with their file:line
references. Line numbers are against `fcd944f0` unless marked working-tree.

### Transport lens

1. `services/adaptiveWarrantSemanticAnnotation.js:191,313` — string bound
   keywords, unsupported in strict structured outputs. Enforce in assembler.
2. Same file `:199-212` + preflight `:436-440` — allowlist blesses the
   unsupported keywords; self-fulfilling check.
3. Preflight `:382-395` — audits a 1-sample rebuild, never the shipped
   8-sample batch schema files. Audit the real files; delete the rebuild.
4. Acceptance ping builds a 1-sample schema; smoke 3-sample. Build the ping
   at production batch size with synthetic sample ids.
5. `prepare-…-semantic-annotations.js:217,229-230` — schema bytes recorded,
   never enforced at prepare time. Add the throw beside the packet check.
6. Nesting depth 9/10. Add a max-10 assertion to the totality audit.
7. `run-…-semantic-readers.js:255` — schema sent with no validation; sha
   check proves consistency, not acceptability. Audit before first call.
8. `prepare-adaptive-warrant-annotation-batches.js:149,222` — decision path
   `minLength`; no keyword audit at all on that pipeline.
9. Same file `:239` — root `$schema` keyword; semantic builder correctly
   omits it.
10. Same file `:284-288` — five bare `enum` properties with no `type`.
11. Working tree only — `services/adaptiveWarrantSemanticPreflight.js:21`
    fingerprints the untracked acceptance-ping script; ENOENT at any clean
    checkout until committed.
12. Semantic prepare lacks the deep-equality packet/schema assert the
    decision path has at `:665,797`.

Clean: no other unsupported keywords; required/closed derivation cannot
drift; no nullables; single `$defs` ref; root object; enum/property budgets
fine; bridge (`services/cliProviderBridge.js:429-440,887,925`) passes the
schema byte-faithfully to the codex CLI; the claude-CLI argv path is
unreachable from this instrument.

### Contract lens

1. Design §2.1 example rejected by the real validator — publicity substring
   check (`services/adaptiveWarrantSemanticEvents.js:225`) vs opaque slugs.
2. Runtime validator never imports the act-contract table; four illegal
   event shapes accepted at runtime, rejected on gold.
3. Deference boolean false on legal inputs (consequence of 2) — the §2.6
   promise does not hold at runtime.
4. `low_agency_deferral` missing from the precedence table
   (`build-…-diagnostic.js:626`).
5. Three precedence tiers bundle typed-identical acts (repair vs wording;
   the six-way null/null family) with no written separator.
6. `transfer_to_learner` is a typed subset of `learner_proposed_test`,
   never defined in the handbook.
7. Withdrawal + transfer-to-learner: catalog-or-none with no choice rule —
   death-4 class. (= Legibility 6.)
8. §2.6 one-clause dual-event example unproducible under the handbook and
   the span-overlap validator.
9. Live extraction schemas (`services/tutorStubPublicLearnerAnalysis.js:
   401,417,424,620,631,632`) still nullable; totality audit never run on
   them.
10. Gold events sorted by span start; prediction events kept in model
    order; scoring pairs by index (`…SemanticAnnotation.js:846-865,
    937-939`). Sort in the runtime validator.
11. `ambiguous_multiplicity` appended after the reason-count check
    (`…SemanticEvents.js:267,324`) and missing from §2.5's closed list.
12. At `fcd944f0` only: type-discriminated `oneOf` union — fixed by the
    uncommitted tagged-union change; land it.

Clean: catalog satisfiability audit is real and passes (all 15 acts get
worked examples through the production validator); the tutor-selection
target death is genuinely repaired; compiler purity and precedence totality
hold; free text stays out of identity; size budget matches on all eight
values; envelope-level absence conventions defined.

### Legibility lens (each: ambiguity → proposed decision rule)

1. Value/component sets, "requested or produced" — sets non-empty only for
   request-mode acts, values literally named in the span; all others empty.
2. Compound whitelist scope — the licence is general: any clause stating an
   inference or evidential limit that is not the grammatical complement of
   another event's clause is its own analytic contribution.
3. Executor default — tutor when the act is a request and the tutor is the
   only other party; joint only on explicit we/let's; unspecified only on
   explicit impersonal/passive.
4. Cross-turn anaphora — "current public text" = current turn plus the
   provided transcript; resolve to the most recent catalog entity; abstain
   only on an equal-recency tie.
5. First-person need-statements ("I'd still need the public log") — a
   declarative need whose object is a public record is a result request
   with executor tutor; without a public-record object, analytic.
6. Withdrawal/transfer target — extend the analytic-contribution rule
   verbatim to both acts.
7. Confirmation saybacks — analytic contribution when the content is
   already public; result request only when it is not.
8. Multi-target coordination — one event per catalog target with minimal
   non-overlapping identifier spans, waiving the complete-clause rule for
   coordinated targets only.
9. Rhetorical/self-answered questions — a question answered by the speaker
   in the same turn yields no event; annotate the answer clause.
10. Conditionals/negation — antecedents are never events; a negated or
    deferred request is a withdrawal only when a matching prior request
    exists, else no event.
11. Action-object specificity — choose the most specific catalog action
    object whose label content words all appear in the span; lexicographic
    tie-break. (Invisible in the 24-case corpus only by accident of the
    smoke catalog.)
12. Span uniqueness vs shortest — extend leftward by whole tokens until
    unique; if impossible, abstain. Separately: make the assembler's
    non-unique-span throw a case-level rejection, not a batch crash
    (`prepare-…:399-403`).
13. Polite-permission suffix — politeness is a modifier; a clause with its
    own imperative or performative verb is always an act.
14. Reported speech — a third-party-attributed act is analytic; only a
    matrix-clause first-person commitment is a proposed test.

Closed traps verified: offsets, prose equality, the speaker branch of the
actor fix, multi-value single-event rule, event index alignment, mechanical
fields, the named tutor-selection target (when non-anaphoric).

### Harness lens

1. Preflight work dir still a fixed name under the output parent
   (`run-…-brittleness-preflight.js:261`); collision class unfixed.
2. Work dir never removed on success — the next run at the same parent is
   guaranteed to refuse.
3. Failed preflight exits 0 (`:540-541`).
4. Artifact written before validation (`:517-518`) — a crash leaves a
   passed-status file on disk.
5. Fingerprint omits all launch runners and the preflight script itself.
6. Wire model id hardcoded at call sites, absent from digests
   (`run-…-readers.js:262`, decision `:190`).
7. Smoke corpus builder not fingerprinted though the preflight asserts
   over it.
8. Decision path: no source-commit binding in manifest, authorization, or
   freeze check (`prepare-…-annotation-batches.js:529-598`).
9. Failure records lack sample ids and a transmitted/not-transmitted
   exposure field.
10. No checked-in burned-corpora registry for the V3 family; copy the
    baseline study's required-exclusion pattern.
11. No cross-run call ledger — a rerun after a partial failure re-spends
    completed calls, including doubling the two-call smoke.
12. Assembler accepts any response directory — no run-status check, no
    response-hash match; partial and hand-authored responses assemble.
13. Model attestation recorded, never enforced.
14. Outside the smoke, maximum calls may exceed planned with no recorded
    reason.

Clean: env/DB discipline fully clean; no other fixed temp paths; no
retries; conservative pre-call accounting; fail-closed non-empty checks on
all output dirs; atomic writes in runners; thorough artifact-drift checks
on the semantic path; clean-worktree and 40-hex commit gates everywhere; the
smoke call cap harness-enforced; no stdout-parsing callers.
