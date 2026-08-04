---
id: tutor-stub-fallback-register-and-uptake-guard
title: Tutor-stub fallback register and learner-uptake guard
status: review
type: maintenance
priority: P1
owner: claude
source: review
created: 2026-07-26
updated: 2026-08-04
verification: A contemporary-diction world speaks its own props in its own
  register while every period and undeclared world keeps byte-identical
  deterministic text; the learner-uptake guard admits a genuinely responsive
  uptake that shares no tokens with the accepted meaning; targeted and hermetic
  suites pass without model calls.
branch: claude/tutor-stub-uptake-guard
claim_status: scope-bound
links:
  code:
    - services/tutorStubSceneDiction.js
    - services/tutorStubDramaticRelease.js
    - services/tutorStubResponseComposition.js
    - services/tutorStubTurnProgressionContract.js
    - scripts/tutor-stub.js
    - tests/tutorStubSceneDiction.test.js
    - services/tutorStubConversationalCompletion.js
    - tests/tutorStubUptakeGuardLinkage.test.js
    - services/tutorStubSelfCorrectionDisclosure.js
    - services/tutorStubGuardDisposition.js
    - tests/tutorStubSelfCorrectionDisclosure.test.js
tags:
  - tutor-stub
  - presentation
  - guards
milestone: evaluation-infrastructure
---

A world-030 (domestic, contemporary) transcript published a tutor line in an
assay-guild register: "I examine the record… What changes now?" The line was
entirely deterministic. The model's own draft was plainer and closer to the
world's declared costume, but `live_turn_progression_v1` rejected it, the
recovery draft was rejected too, and the deterministic fallback shipped from
phrase banks authored against the period worlds.

Four defects sit behind that one line, addressed in sequence.

Out of scope:

- Changing any world's authored `presentation` block, register policy, or
  engagement stance.
- Altering evidence, clue-transaction, or leak guard dispositions, which stay
  hard everywhere.
- Running model-backed or paid evaluations.

Acceptance:

- Step 1 — the deterministic fallback reads `presentation.ledger_term` and
  `presentation.narrative_diction` from the world instead of relying on a
  hardcoded period-noun whitelist. A world declaring neither is unchanged.
- Step 2 — the dramatic-release host entrances, stance inflections, and the
  generic learner-uptake tails carry contemporary variants alongside the
  frozen period wording.
- Step 3 — a fallback that publishes while carrying a terminal-fallback
  conversational advisory offers the model one further attempt whose brief
  discloses the near-miss to the learner. The wording is not templated; the
  disclosure is guarded for non-fabrication against real prior attempts and
  for leak containment, and falls through to today's fallback when rejected.
- Step 4 — an accepted meaning that describes the learner's discourse act
  rather than their content never becomes the turn focus surface and never
  contributes required terms. Token overlap stays sufficient for uptake
  visibility; a responsive uptake that echoes the learner's own surface becomes
  a second sufficient route.

Log:

- 2026-07-26 — Diagnosed from
  `.tutor-stub-traces/2026-07-25T22-35-28-793Z-transcript.html` (world-030,
  `goalpost_shifter`, codex/gpt-5.6-sol). Corrected one earlier reading: the
  terminal fallback is re-audited and a hard failure still kills the turn. The
  accommodation is narrower — `services/tutorStubGuardDisposition.js` downgrades
  `conversational_integrity` findings to advisories on the terminal-fallback
  attempt only, with a written rationale. It is recorded, not silent, but it is
  invisible to the learner.
- 2026-07-26 — Steps 1 and 2 landed. New `services/tutorStubSceneDiction.js`
  resolves diction and declared props from `world.presentation` with
  default-preserving resolution: period unless a world declares a marker-free
  diction, so frozen worlds and every existing call site that omits `world` keep
  byte-identical text. World-030 now opens "I look at the repair notebook"; the
  marrick and undeclared cases still open "I examine the record". Targeted
  suites pass 181/181 plus 5/5 new; the wider tutor-stub sweep is 1307/1309 with
  the only failure `tutorStubCodexRemoteBridge.test.js`, which cannot import
  `@modelcontextprotocol/sdk` — declared in `package.json`, absent from
  `node_modules` in this checkout, and unrelated to these edits.
- 2026-07-26 — Step 4 landed, and the diagnosis is sharper than the one written
  above. The guard was not too strict; it was pointed at the wrong text.
  `conversationalCompletion.acceptedMeaning` carries two different kinds of
  sentence — a classifier paraphrase of what the learner said, and a
  generous-inference description of what the learner did ("The learner gives a
  short answer whose referent and scope are supplied by the immediately
  preceding public question"). The contract took the second as the turn focus
  surface, so the recorded world-030 turn demanded the tutor speak "referent",
  "scope" and "preceding" back to a learner who had said "check for sources of
  water". No natural uptake could pass. `acceptedMeaningKind` is now stamped at
  the point of resolution, act descriptions are excluded from the focus surface
  and from required terms, and the previously unreachable
  `RESPONSIVE_UPTAKE_PATTERN` route is revived as a second sufficient route for
  a responsive uptake that echoes the learner's own words. Replaying the two
  recorded rejections through the changed guard: both now pass, both by term
  overlap alone, on focus terms `["check","sourc","water"]`. Seven new tests in
  `tests/tutorStubUptakeGuardLinkage.test.js`; five fail on the pre-change code
  and two pass on both, pinning that the loosening did not open the gate
  generally. Tutor-stub sweep 2114/2115, same single pre-existing MCP-SDK
  import failure. An earlier line in this item asked for stem-tolerant
  matching; that is redundant — `normalizeToken` already stems.
- 2026-07-26 — Step 3 landed. A new rung sits between the source-voice repair
  and the deterministic fallback. It opens on exactly one condition: every hard
  finding on the current draft is one the terminal fallback would downgrade to a
  conversational advisory. The predicate reads that from
  `classifyTutorStubGuardIssue` rather than restating the catalog, so the rung
  and the accommodation can never drift apart. Requiring *all* hard findings to
  be waivable keeps a draft that also crossed an evidence boundary out of scope
  — there the fallback is replacing something the tutor should not have said,
  not absorbing an unanswered question.
  The brief tells the model what it drafted, why that does not answer the
  learner, and that the learner is present for the change of course; it states
  that saying so is permitted and that answering well while saying nothing is
  equally acceptable. No phrase is supplied. A test asserts the brief itself
  contains no marker the detector recognises, so the outcome label cannot be
  measuring the prompt.
  Two failures the normal chain cannot see are guarded. A disclosure may not
  quote a discarded line the tutor never drafted, and may not name the private
  apparatus whose vocabulary the brief just handed it. Both are hard in both
  dispositions and on the terminal fallback, for free: the disclosure audit
  carries no catalog rule, and unregistered issues fail closed.
  Two corrections came out of probing rather than unit tests. The
  non-fabrication check first read every quoted span as a claim about the
  discarded draft, but quotation marks in this harness carry the learner's own
  words, Write entries and released evidence; only a quote inside the correcting
  sentence is now checked. And a self-correction placed first was being scored
  as the turn's uptake, so both uptake guards rejected the very move the rung
  invites — `auditTutorStubResponseComposition` now peels a leading
  self-correction preface and points the guards at the sentence that follows,
  and only when that opening does not already answer the learner on its own.
  End-to-end on the `--world none` path, where both drafts fail live progression
  and nothing else: the rung fires, and a disclosed turn ships as
  `guarded_self_correction_disclosed` with the preface excluded from the uptake
  and live progression clean. A rejected disclosure falls through to the
  byte-identical fallback the ladder always produced. Cost note: in the target
  population this is one extra model call per fallback turn, which matters on
  paid runs. Tutor-stub sweep 2114/2115 plus 14 new disclosure tests and a new
  composition test, with the same pre-existing MCP-SDK import failure.
- 2026-07-26 — Paid confirmation run on the motivating world. World-030 with
  `--dag`, tutor and classifier and automated learner all on codex/gpt-5.6-sol,
  `goalpost_shifter`, 8 turns, 25 model calls; trace
  `.tutor-stub-traces/confirm-world030/2026-07-26T01-11-37-775Z.jsonl`.
  The motivating line is gone: `I examine the record` occurs 124 times in the
  original trace and 0 times here, replaced by `I look at the repair notebook`
  (74) built from the world's declared `ledger_term`. Turn outcomes were
  fallback, accepted, fallback, accepted, accepted, fallback, plain recovery,
  accepted — 4 of 8 first drafts accepted, 3 safe fallbacks, no final check
  failures.
  Step 3 fired on a real model for the first time. On turn 6 both drafts failed
  only on waivable conversational findings, the rung opened, and the model took
  the option the brief also offers: it wrote a clean answer and did not disclose
  (`disclosed: false`, no disclosure issues), then lost turn focus and fell
  through to the byte-identical fallback. Both the open condition and the
  fall-through are now observed outside fixtures; a live *disclosed* turn is
  still only fixture-proven.
  Step 3's population is smaller than the original diagnosis suggested, because
  step 4 removed the bug that generated most waivable conversational findings.
  Turns 1 and 3 fell back on a leak and a source-alignment finding, which the
  rung is designed not to touch.
  Three residual period-diction sources remain, none of them in the two files
  steps 1-2 touched, and none of them present in the original trace — this run
  had register selection off (it needs `--tutor-learner-dag`, which the original
  session had and this one omitted), so host-part resolution differed and
  reached branches the original never did. They are not regressions, but they
  are diction-blind: `configuredFallbackObject` in
  `services/tutorStubResponseComposition.js` still matches a hardcoded noun
  whitelist rather than reading `presentation.ledger_term`, so it yields
  "notebook" where the world says "repair notebook"; `configuredFallbackHost` in
  the same file is a fixed phrase table whose `examiner` entry publishes "I set
  the notebook under examination"; and `sourceReportingLead` in
  `services/tutorStubDueSourceRenderer.js` hands the model "I read from the
  record", which it then echoes into its own prose. Threading diction into the
  first two is small; the third is called positionally from six sites, several
  via bare `.map(renderTutorStubDueSource)`, so it needs a signature that a map
  index cannot occupy.
- 2026-07-26 — Residuals A and B closed; C (the due-source lead) is deliberately
  left open. `configuredFallbackObject` now consults the world's own declared
  props before either period whitelist, and `configuredFallbackHost` /
  `configuredFallbackPerformance` take the resolved diction and carry a
  plainspoken variant beside eight of the nine host entries and two of the
  performance lines. The prop matcher that step 1 wrote inside
  `tutorStubDramaticRelease.js` moved to `tutorStubSceneDiction.js` as
  `tutorStubNamedSceneProp` / `tutorStubDeclaredSceneObject` and is now shared,
  so the two fallback banks cannot drift on which nouns a world owns.
  Two orderings are deliberate and both were chosen by measurement. A declared
  prop has to be named in the scene's own prose rather than taken on declaration
  alone: taking it on declaration alone moved 203 of 224 measured lines and
  re-nouned every frozen world. And the exhibit whitelist keeps its precedence
  for the parts written to hold up physical evidence, or marrick's examiner
  reaches for the trial-book instead of the coin under assay.
  Measured across all 32 authored worlds × 7 host parts, 14 worlds change. The
  12 contemporary worlds change prop and register together — world-030's
  examiner goes from "I set the notebook under examination and mark the claim's
  limit" to "I put the repair notebook in front of us and mark where the claim
  stops holding". Two period worlds change prop only, with the staging
  untouched: sealhouse and ravensmark say "custody roll" and "warrant book"
  where they said "public record". That is a narrow exception to the
  byte-identity line in this item's acceptance, and it is the point of the
  change rather than a side effect — those are the worlds' own period nouns
  replacing an abstract generic. The other 18 worlds and the no-world default
  are byte-identical.
  Five new tests in `tests/tutorStubSceneDiction.test.js` (11 in the file, all
  passing) pin the frozen default, the exhibit precedence, the record slot
  refusing a declared exhibit, and the contemporary path. Full suite 7042/7044;
  both failures are this worktree's symlinked `node_modules` missing
  `@modelcontextprotocol/sdk` and `rdf-validate-shacl`, unrelated to the edit.
- 2026-07-26 — Residual C closed; the item's three residuals are now all closed.
  `sourceReportingLead` in `services/tutorStubDueSourceRenderer.js` is
  diction-aware, so a world that declares a contemporary costume opens a due
  source with "Here's what I'm reading" rather than "I read from the record".
  The signature obstacle recorded above was dissolved rather than solved. Three
  of the six call sites reach the renderer through a bare
  `.map(renderTutorStubDueSource)`, where a third positional argument collides
  with the array index. Instead of changing any signature, the world's resolved
  costume is stamped onto each entry once at the single producer,
  `buildTutorStubDramaticReleaseFrame`, exactly as that builder already hangs
  `action_referents` on the entry. Zero call sites change. An entry that never
  passed through the builder — a recorded frozen-replay bundle, a hand-built
  fixture — carries no stamp and reads as period, so default-preservation needs
  no migration and no version gate. The stamp helper is
  `tutorStubSceneStamp` in `services/tutorStubSceneDiction.js`.
  Measured across all 32 authored worlds by rendering every authored
  `presentation.role` twice, once stamped with its own world and once unstamped
  (the unstamped render is exactly what the old world-blind code produced):
  10 of 32 roles change, all of them in worlds 027-031, all contemporary, all
  in the `record_reading` branch. No period world moves. The other five branches
  are reachable but no authored world currently exercises them.
  Two document-naming designs were tried and rejected on evidence. Substituting
  the world's declared `ledger_term` into the reading lead never fired on any of
  the 32 roles, because the roles name the actual document instead ("the visitor
  badge log", "the lift notice", "the cure sheet"). Extracting the document from
  the role text fired, but produced "I read from the doubled pilcrow" for
  world-027's `revision-log analyst showing the doubled pilcrow`, and more
  decisively it makes the tutor say the same noun twice in one breath, because
  the host entrance immediately before the lead already names it: "I open the
  visitor ledger beside you. 'I read from the visitor ledger: ...'". The generic
  "the record" was doing that work, and the contemporary variant does it with a
  pronoun instead. The change is register-only.
  One constraint was found the hard way and is now pinned by a test. The lead is
  not decorative: `quotedRoleSpeech` in `services/tutorStubDramaticRelease.js`
  counts a quotation as role speech only when it contains i/my/our/we, and the
  authored surface it introduces usually contains none, so the lead is what
  makes the guard see an enacted role at all. A first draft used "Here's what it
  says", which has no pronoun; the whole quote was discarded and the turn failed
  with `dramatic_release:missing_in_scene_enactment`. Every variant now carries
  a pronoun, and a test renders all six branches under both registers and
  asserts both the pronoun and `tutorStubFirstPersonRoleVoiceVisible` on the
  rendered text, so the class of break cannot recur silently.
  Four new tests in `tests/tutorStubDueSourceRenderer.test.js` (10 in the file,
  all passing) pin the unstamped period default across all six branches, the
  period and contemporary stamps through the real frame builder, the authored
  surface surviving byte-for-byte in both registers, and the pronoun contract.
  Full suite 6842/6844; both failures are this worktree's symlinked
  `node_modules` missing `@modelcontextprotocol/sdk` and `rdf-validate-shacl`,
  unrelated to the edit.
- 2026-07-27 — A fourth residual, found by re-reading the confirmation trace
  rather than by any test. Residuals A-C were *register* defects: the right prop
  named in the wrong century's voice. This one is a *content* defect. Roughly a
  quarter of `deterministicTutorStubLearnerUptake`'s branches were authored for
  the marrick coin-assay worlds and name that furniture outright — crucible,
  touchstone, trial-book, shilling, graver. Every one of them keyed on the
  learner's wording alone. So a learner in a contemporary flat who writes "the
  water mark on the ceiling" or "check the metal" satisfies a branch written
  about a die-flaw on a coin, and the tutor answers by importing an exhibit the
  scene never contained. The register machinery cannot catch this, because the
  sentence is not in the wrong register — it is about the wrong world.
  The fix adds one orthogonal condition. `ASSAY_SCENE_PATTERN` is matched against
  the *world's* own text, never the learner's, and gates 24 branches plus one
  candidate inside a mixed branch and the `publicObject` echo whitelist. It is
  default-open (`!world || ...`), so the many fixtures that pass only
  `learnerText` keep every branch reachable, while both production call sites in
  `scripts/tutor-stub.js` pass `world` and are therefore gated.
  Two things were learned the hard way. The pattern must be applied to
  punctuation-normalised text: `\bmarrick\b` does not match inside
  `world_005_marrick`, because `_` is a word character and offers no boundary, so
  the first draft silently closed the assay branches in the assay worlds and
  broke seven marrick tests. And a fuzz sweep found one leak the branch audit had
  missed, in the `publicObject` noun-echo whitelist, which was offering "coin"
  back to any learner who said it.
  Verified by fuzzing rather than by reading: 35 coin-flavoured learner lines
  across request types and discourse moves, run against all 32 authored worlds.
  Assay vocabulary now reaches exactly `world-005-marrick`,
  `world-019-marrick-resistant` and `world-020-marrick-confront`, 25 distinct
  replies each, and no other world; world-030 goes from 25 to 0. One new test in
  `tests/tutorStubResponseComposition.test.js` pins all three directions — no
  assay wording in a contemporary world, assay wording still present in a
  marrick world so the bank cannot be deleted to pass, and the no-world caller
  unchanged. Composition suite 118/118.
  Paid re-run of the motivating world on post-fix code: world-030,
  codex/gpt-5.6-sol throughout, `goalpost_shifter`, 8 turns, `--run-seed 1`;
  trace `.tutor-stub-traces/confirm-world030-postfix/`. Zero coin or assay
  vocabulary in the transcript, and the reporting lead reads "Here's what I'm
  reading" where the pre-fix trace read "I read from the record". Outcome
  ("inquiry remains open") and strict proof progress (0%) are unchanged in both
  runs. Two other counters moved, and they should not be read as effects of this
  change: these are two single samples from a non-deterministic model, and only
  the register and vocabulary differences are attributable.
  One leak is left open deliberately and is a different defect.
  `configuredFallbackObject` concatenates `learnerText` ahead of the world's own
  prose and then takes the first whitelist hit anywhere in that string, so it
  echoes an assay noun back out of the learner's own line rather than importing
  one. The sharpest case is metaphor read as exhibit: "the touchstone for me is
  whether the water travelled" returns "I put the touchstone in front of us". The
  register there is already correct, so this is an object-selection defect, not a
  costume one, and it wants its own fix.
- 2026-07-27 — That leak measured and closed. It is far wider than the single
  sighting suggested, and the sighting was the smaller half of it.
  `configuredFallbackObject` matched both whitelists against the learner's line
  and the scene concatenated, first hit anywhere, so any whitelist noun the
  learner uttered became the object the tutor then held up. Six of the entries
  are ordinary English verbs, so "can you report what you found", "let me log
  that thought", "register my objection", "can we file that away" and "we should
  balance the two accounts" each hand the tutor a prop; metaphor supplies the
  rest. Measured across 32 worlds x 11 host parts x 17 learner lines, the learner
  chose the object in 3,622 of 5,984 cases, and in 3,539 of those the noun
  appears nowhere in the world — not in its prose, not among its declared props.
  All 32 worlds are reachable, so this is not a marrick-adjacent defect.
  The channel cannot simply be cut. With the learner's line removed entirely, 18
  of the 32 worlds fall back to the abstract "public record": they declare no
  props and their prose names no whitelist noun. So the learner keeps the choice
  and the scene supplies a second condition — ownership. A noun the world
  declares returns in the world's own full wording (a learner in the lantern
  world saying "log" now gets "inquiry log", not the bare fragment); a noun the
  scene's prose names returns as the learner said it; anything else falls back to
  the scene's own first object. Written as a match on the learner's text gated on
  ownership, rather than a match on the concatenation filtered afterwards, the
  no-learner case reduces to `scene.match(pattern)` textually, so every world's
  unprompted wording is byte-identical by construction rather than by
  measurement.
  Verified by dumping all 6,336 cases under both revisions and diffing: 3,682
  change, 0 of the 352 blank-learner cases change, learner-introduced absent
  objects go from 3,539 to 0, the 83 cases where the learner picks among objects
  the world does have are all preserved, and no case that previously named a
  present object now names an absent one.
  One existing test failed on the first pass and turned out to be the defect
  testing itself. Its fixture learner says "what conclusion we should record" — a
  verb — and its assertion reads `press the (?:record|minute-book)`, so the
  author had already seen both were possible and written the alternation
  permissively. The world it models, world-025-tallow-street, names its
  minute-book in prose but never declares it, and `minute-book` was missing from
  the record whitelist, so that world could only ever reach its own noun by a
  learner accidentally saying "record". Adding the noun moves world-025's 11
  parts from "public record" to "minute-book", moves no other world, and the test
  passes on the branch it preferred.
  Four new tests in `tests/tutorStubResponseComposition.test.js`; three fail on
  the pre-change code, and the fourth passes on both by design, pinning that the
  tightening did not close the legitimate route by which a learner selects among
  the scene's own objects. Composition suite 122/122, adjacent scene-diction /
  due-source / response-guard suites 35/35, wider tutor-stub sweep 1,176/1,178
  with both failures pre-existing on clean main.
  A gap is left open and is an authoring matter rather than a code one: 18 of the
  32 worlds declare no public object at all, so they now say "public record"
  whatever the learner says. That absence is what the leak was covering for.
- 2026-08-04 — Moved to review as step 1 of the five-card safety/closure
  sequence (the sequence is written out in
  `guard-ladder-ships-canned-text-on-most-turns`). Every step and residual above
  is landed, tested without model calls, and confirmed on a paid world-030
  re-run. The one gap left open — worlds whose declared object was unreachable —
  was re-carded to `drama-world-public-object-reachability`, and that card
  closed on 2026-08-04. Nothing remains here.
