# The Green Room: Coached Tutor Training, Rehearsal, and the Prompt Book

**Status:** **greenlit 2026-07-11** (owner decisions recorded in §0.1); pre-registration draft — no code yet.
**Branch:** `claude/tutor-coaching-memory-system-vvvrl8`.
**Companions:** `MEMORY-ARCHITECTURE.md` + `MEMORY-MECHANISMS.md` (what memory already exists and what it returned), `LEARNED-ADAPTATION-PLAN.md` (the kill-gate discipline this plan inherits), `DRAMATIC-RECOGNITION-PLAN.md` (the theatrical register it extends), `ADAPTIVE-TUTOR-CAST-LAYER-PLAN.md` (character *within* a drama; this plan is character *across* dramas).
**Workplan card:** `workplan/items/a22-green-room-coached-tutor-training.md`.

---

## 0. One-sentence shift

The poetics arc taught the evaluator to watch the play; this arc builds the **green room behind the stage** — after every performance (human or simulated learner), a stronger model sits with the tutor for a **notes session**, and what survives that conversation is engraved into a durable, versioned, per-profile **prompt book** (`MEMORY.md`) that future performances open with; **rehearsal loops** against mock learners and **mid-performance side-coaching** complete the training apparatus, so that a tutor profile becomes something that *develops* — and documents its own development — rather than something that is merely configured.

## 0.1 P0 decisions (owner, 2026-07-11)

Recorded verbatim-in-substance from the greenlight exchange; two terms carry an interpretation flag (⚑) because their referent lives in an unpushed local worktree and must be reconciled at P1.

1. **Greenlit**, priority P1; workplan card `a22-…` moves to `active`.
2. **Gate 0 is owner-reviewed.** The five sample notes sessions go to the owner for the pablum-or-craft judgment before P1 substrate work is considered validated.
3. **Single anchor, first wave** — no in-loop-superego second anchor. Owner note, recorded as a standing hypothesis: *the coach may itself be an alternative architecture for the superego* — i.e. the offstage, asynchronous, judge-tier coach as the replacement for (not a complement to) the in-loop critic. A later contrast (coach-trained ego with no superego vs classic ego+superego) is the natural test; not in the first wave.
4. **Models:** ~~coach = `codex.sol`, tutor/actor = `codex.luna`~~ — **re-pinned 2026-07-12 (owner): coach = `claude-code.claude-opus-4-8` (Opus 4.8), tutor/actor = `claude-code.claude-sonnet-5` (Sonnet 5)**, weak actor for the Gate-2/C3 arm = `claude-code.claude-haiku-4-5-20251001` (Haiku 4.5). Reason: the session environment where the work executes has no `codex` CLI, so the original pins were unrunnable there; the full model IDs (not floating aliases) were verified against the `claude` CLI on 2026-07-12 so manifests pin exact versions. The codex `sol`/`luna` pins remain the preferred restoration if the environment gains codex auth. C3's distillation arm becomes: coached-Haiku vs untrained-Haiku vs untrained-Sonnet ceiling. **Monoculture consequence:** coach, actor, and weak actor now share one lineage — so §0.2.2's cross-lineage requirement moves wholly to the judging channel: no positive C3/C4 claim without a non-Anthropic rejudge (the codex graded channel, owner-side).
5. **Coach-informed default, but tutor-driven.** The notes session is *not* automatic after every performance: the **tutor initiates** the consult, and the default trigger is **registry-variance failure** — *(⚑ resolved 2026-07-11 against the pushed `preconscious` branch)*: "registry-variance" is the stub's **register-policy layer** — the pre-response stance-selection over `services/engagementRegisterRegistry.js` (11 policies: bland/random/negative controls, state/field/trajectory/dynamical control laws, fitted empirical priors, continuous blends). The trigger is that this repertoire *fails*: the stub has been varying its register and the learner's board/field state still is not moving (no grounding progress, stalled movement across recent turns). The branch's own review supplies the honest floor for this trigger — its audit's defensible residue was "any register variation changes the simulated learner's pace," *not* "adaptive selection helps" — so the coach convenes exactly where the register repertoire's known capability ends. Coaching therefore concentrates on *stalled* performances, with evaluation visible to the coach when it convenes.
6. **Substrate pivot (the "important note").** The first wave binds to the **preconscious tutor-stub variant** — branch `preconscious`, pushed (41 commits ahead of main; `scripts/tutor-stub.js`, ~9k lines: standalone CLI tutor on the derivation detective worlds — no server, no DB, no cell registry; per-turn frames land in SQL ingest + trace JSONL). The green room's coach consumes those traces + transcripts; **MEMORY.md injects via the branch's own just-built precedent**: the `--field-report-context` pattern (`buildFieldReportContext` → a labelled context block in `llmRoles.js`, per-turn rows, non-leak audits, flag-distinct arms) — the prompt book enters as an analogous `--prompt-book-context` block with the same audit discipline, which also gives the placebo-book arm the same flag-distinctness guarantee the fixed Phase-6 placebo arm now has. **Folding into the general factorial architecture comes later** — cells 201–208 are *reserved but not registered* until the fold-in stage; first-wave conditions run as derivation-style run-groups (`marrick-greenroom-<condition>-rN`).
7. **Scenario split.** Default/train = the **Marrick family**: `world-005-marrick` (the AND-join world) as the default performance world, with `world-019-marrick-resistant` and `world-020-marrick-confront` available for rehearsal variety inside the family. **Hold-outs, sealed from coach and rehearsal from this date:** `world-018-edmund` — near transfer (explicitly authored as *marrick's AND-join geometry in a fresh domain*, so it separates "learned the craft" from "learned the world") — and `world-009-ravensmark` — far transfer (small, diagnostic, dead-predicate trap; authored as a held-out probe and kept that way). `world-004-withercombe` (diamond reconvergence) is the optional middle-distance third if the first two disagree.

## 0.2 Substrate-inherited constraints (from `PLAN_4_0/2026-07-10-preconscious-adaptation-review.md`)

The branch's own adversarial review binds the green room in four ways; ignoring any of them would reproduce a failure that review already caught:

1. **Run Gates 1–2 in the headroom arena.** The July-9 QA matrix hit ceiling on world-005 under the default release schedule (126/126 grounded, every policy tied — *no policy difference could show*). The branch added `--suite headroom` (discriminable sentinel profiles + bland/negative controls under a binding `--safety-turns 40` cap) precisely as "the arena for the first real outcome contrast." All green-room outcome comparisons (uptake deltas, coached-vs-untrained) run there; a coached book "winning" at the release-schedule floor would be the diversity-confound artifact all over again.
2. **No monoculture.** The review flagged codex.gpt-5.5 playing tutor, learner, classifier, and extractor at once. The green room splits coach (Opus 4.8) from actor (Sonnet 5) by tier — but after the 2026-07-12 re-pin (§0.1.4) all green-room roles share the Anthropic lineage, so the cross-lineage guarantee moves to the judging channel: pin the uptake-compliance classifier away from the coach model, never let the coach double as the outcome judge, and require a non-Anthropic rejudge (owner-side codex) before any positive C3/C4 claim.
3. **Outcome ≠ process scoring.** The review's purest closed-loop tell was a composite-score weight manufacturing "adaptive wins." Green-room claims C2–C4 report on **outcome-only channels** (grounding, turns-to-ground, note-compliance predicates); anything the coaching mechanism itself produces (notes issued, book edits, register diversity) is a labelled process column, never folded into a headline score.
4. **Provenance is not machine-local.** The stub's empirical record is currently gitignored and lives in one working tree. The green-room ledger, notes-session logs, and memory versions are committed (or bundle-archived per the evidence-discipline convention) from day one — the prompt book's whole point is a durable, inspectable training record.

Also inherited, positively: the Phase-6 gate scaffolding (frozen manifest with git SHA before any model call, idempotent resume, exit-2 on safety failure, mechanical architecture-independent endpoint) is the template for Gate 1–3 runners.

## 1. The proposal, in this repo's terms

The idea (verbatim intent, mapped):

| The idea says | In this repo that means |
|---|---|
| "Every transcript … analysed with a second more powerful model — the superego / acting coach / director" | A **coach engine**: a judge-tier model reads the dialogue log (`dialogueTrace` + `turnResults`, incl. internal deliberation) after the run. Deliberately **not** the in-loop superego: the superego critiques *within* a turn, synchronously, at ego-tier; the coach consolidates *across* performances, asynchronously, at judge-tier. Named **coach** throughout (never "director" — `idDirectorEngine.js` / cells 101+ already own that word). |
| "The analysis should be a secondary conversation" | A structured **notes session**: coach ⇄ actor dialogue (3–5 exchanges), not one-way transcript mining. The one-way version already ran and nulled (§2, rich-memory arc: haiku mechanically mined transcripts into memory). The conversational form is the untested variable — elicitation ("what were you attempting there?") before prescription. |
| "…updates a kind of individualized MEMORY.md. This then informs future runs" | The **prompt book**: `greenroom/profiles/<id>/MEMORY.md`, curated (not accumulated), token-budgeted, content-hashed, versioned in an append-only ledger. Injected into the ego system prompt through the *already-proven* `externalEgoExtension` → `systemPromptExtension` channel. |
| "run its own rehearsals with mock learners in loops … takes its own notes … consults the coach to review" | A **rehearsal runner**: unscored self-play driving `generateLearnerResponse()` standalone (it needs no runner), tutor writes a one-paragraph **actor's diary** entry per rehearsal, coach reviews diary + transcripts in batch every K loops. Rehearsals never write `evaluation_results`. |
| "It can also do this mid-performance" | **Side-coaching** (Spolin's term, literally): an optional per-turn interval where the coach whispers ≤1 short note into the next turn's `systemPromptExtension`. Ephemeral — never engraved into MEMORY.md during a scored run. |
| "Every part of the tutor can be compartmentalized — multiple tutor profiles, with different levels of training" | A **profile registry**: profile = (actor model, role/cell anchor, memory state). Profiles fork at any memory version, giving checkpointed training levels (`socratic_a@v0`, `@v6`, `@v12`) that are directly comparable cells. |
| "distinguish between the actor playing the part of the tutor and the tutor role itself" | **Two memory layers**: `MEMORY.md` (role — this character, this curriculum) and `ACTOR.md` (technique — transferable habits of the underlying model across roles). Stanislavski's split exactly: *work on the role* vs *work on oneself*. Operationally testable: does ACTOR-layer memory transfer to a new role? |
| "The curriculum is the loose script the tutor must interpret and adapt" | Already true — scenarios/curricula are canovacci (commedia dell'arte scaffolds), the learner is unscripted LLM improvisation. The green room does not change the script; it changes the player. |
| "Same eval harness as before" | Cells 201–208 in `config/tutor-agents.yaml` + `EVAL_ONLY_PROFILES`, scored under frozen rubric v2.2 (poetics rubric cross-correlated for free), standard judge + rejudge discipline. |

## 2. Review — the honest prior

This proposal walks into a graveyard, and the plan is only honest if it names the graves. The repo has repeatedly tested the shape *"give the tutor more state/structure/memory and quality will improve"*, on independent instruments, and it keeps returning null:

| Prior arc | Mechanism | Outcome |
|---|---|---|
| A5 (§6.6.9) | Writing Pad three-layer memory, in-loop (byte-identical pad on/off ablation, N=252) | pad is **not load-bearing** for quality; pad-off if anything +3.2 pts |
| A7 longitudinal (§6.6.11) | cross-run pad via shared `learnerId`, 8-session arcs | recognition arcs **do compound** (+1.31 pts/session vs base −1.08, d=0.70) — but attributed to prompt-level ego pre-alignment persisting, **not** to pad memory doing causal work; the primary moment-count proxy *reversed* |
| §6.7.4 / §6.8.8 / §6.9.7 (A14) | structured/evidence-bound state on a strong adaptive base | three convergent **negatives**; "mechanism-clean, pedagogically inert-to-negative" |
| Rich-memory arc (#3, 2026-06-25) | cross-session `learnerMemoryService` narrative injected via `externalEgoExtension`, mined one-way by a cheap model | **null** (baseline 77.1 vs rich 75.8; contrast −1.3, SE ~2.3) |
| A15 (§6.9.8) | nearest-neighbor retrieval over past (state, action, outcome) tuples | **null on the transfer-valid channel** (0.3125, *below* both baselines); the apparent direct-method win exposed as a base-rate exploit by three controls |
| A16 (cells 129–132, §6.3.10) | superego-authored ego-prompt rewrite, stateless (S0) vs cumulative (S1) | **cumulative did not beat stateless** — S1−S0 d=−0.167 against a pre-registered \|d\|≥0.27 bar; the only marginal elevation sat in the predicted-inert S0 arm |
| Recursive-tutor family (A18.6/.7, T24, A19; `poetics:recursive-tutor-*`, `poetics:harvest-replay-lessons`) | harvested replay lessons / filled policy-memory carried into held-out replays | ablations **negative on causal attribution** (the no-policy control also passed); terminal verdict "null-to-weak-positive on dramatic *form*, explicitly not a learning claim"; A19's two n=1 positives failed stability reruns 0/2 |
| A18.38 fine-tuning ladder | weight updates from teaching outcomes | **dropped, not greenlit** — signal too thin/conditional to distill into weights; the project stays weight-free |

And on the substrate side (`MEMORY-ARCHITECTURE.md`, `MEMORY-MECHANISMS.md`): every live in-run mechanism — Writing Pad (21), self-reflective evolution (40–45), quantitative disposition (46–47), erosion (48–49), other-ego profiling (54–59) — is **within-dialogue only**, holding only the latest turn's snapshot. Genuine cross-run persistence exists solely as three opt-in mechanisms, none default, and the cross-run *screens* run so far returned null (rich-memory) or non-attributable (A7).

**Against the graveyard stand two bounded in-repo positives, and they point at the same spot:**

- **A18.37 (§7.9):** same-model durable policy-memory *does* transfer to held-out sibling scenarios — a blind-detectable advantage on 10 of 14 cards across 7 families, with the misses explained by a predictive per-card headroom rule (ceiling, not failure). Thin, conditional, per-card — but real, and detected on a *behavioural blind channel*, not a rubric score.
- **§7.8 prompt optimisation:** a **stronger model authoring durable prompt guidance for a weaker actor works dramatically when authored natively for that actor** (Opus-class recommender hill-climbing Qwen-class target: +114% on target dims), while §7.8.3 shows the failure mode is *non-native transfer* — a prompt optimized on a stronger model and handed down helps a weaker actor only "safe but insufficient" (+17.2, still −22.8 short of native), and the reverse direction actively harms (−27.8).

Read together: durable authored guidance pays **when it is authored for the specific actor from that actor's own behaviour**, and its effects show up first on **behavioural channels** rather than rubric points. That is precisely the green-room configuration — and, confirmed by the sweep, **no experiment in the repo has yet had a stronger model author accumulated cross-session guidance from watching a weaker (or equal) actor's own transcripts**. §7.8's authorship was blind score-hill-climbing; A18.37's was same-model; the rich-memory arc's was cheap-model one-way mining into an uncurated store; A16's was same-tier, within-arc, uncurated rewrite.

**So why is this arc not the next thrash?** Because on inspection the proposal contains levers that are genuinely distinct from every grave above — and one of them has a positive prior:

1. **Capability asymmetry, authored natively.** Every prior memory/state arc used same-tier or *cheaper* models to author the carried state (haiku mined the rich-memory narratives; the tutor reflected on itself; the superego is ego-tier; A18.37's author was the tutor itself). The coach imports **judge-tier capability into the improvement loop** — and, per §7.8.3's lesson, authors **natively for the target actor from that actor's own transcripts**, not by handing down guidance optimized elsewhere. §7.8.1 (+114% on a weak actor, strong recommender) is the in-repo existence proof that strong-authors-for-weak-natively can be large; SEPO/OPRO-style external literature agrees (SEPO is triaged in the workplan, not implemented). The cleanest version of this lever is the **distillation arm** (C3, §6): can a coached weak actor close part of the gap to an uncoached strong actor?
2. **Dialogic elicitation + curation.** The rich-memory null was one-way mechanical mining into an *accumulating* store; A16's null was a same-tier superego *rewriting the prompt* within an arc, uncurated. The notes session is bidirectional (the actor accounts for its choices before the coach prescribes) and the prompt book is *curated under a token budget* (the coach must decide what to keep, evict, and distill). Whether conversation-plus-curation beats mining-and-rewriting is exactly the recognition thesis restated at the training level — which is why this arc belongs in *this* project rather than any prompt-optimization repo: **the coach⇄tutor relation instantiates the same recognition structure the project studies in tutor⇄learner.** The tutor gets a tutor. If recognition-theoretic dialogue does anything *anywhere*, the place it should be easiest to detect is where the downstream consumer is a model, not a simulated learner.
3. **The measurement object is new.** The prior arcs asked only "did scores go up?" This arc's primary claims (§6) are about **uptake** (do coached notes change next-performance behaviour — the direct attack on Finding 11's insight–action gap), **transfer** (the distillation gradient), and **biography** (a documented longitudinal record of a tutor's coached development — a typological/descriptive deliverable with no null, in the poetics tradition). The headline score-lift claim is deliberately ranked *last*, with the weakest prior, and the arc is designed to be worth its cost even when it nulls.
4. **The substrate is the contribution** (the §6.8.8 motif, embraced up front). No mechanism in the repo persists tutor-side state across dialogues *by default, as a first-class, provenance-hashed facility*. Profiles, versioned memory, and the training ledger are durable infrastructure for the human-pilot era (coaching on *human* transcripts is the payoff case the simulated nulls cannot touch — `MEMORY-ARCHITECTURE.md` §7 explicitly reserves it), independent of any score movement now.

**What would make this the seventh thrash:** running straight to the headline comparison at scale, tuning the coach prompt against judge scores until something moves, or letting "memory" regress to unbounded accumulation. The gates in §7 exist to make those moves impossible.

## 3. Non-goals

1. **No weight updates.** A18 stays dropped; everything here is in-context and weight-free.
2. **Not another within-dialogue reflection mechanism.** Cells 40–59 already cover that factor space; the green room composes with them rather than re-proposing them (a profile's anchor cell may or may not carry in-run mechanisms).
3. **Not a learner-state estimator.** The adaptation arcs' object (did the tutor read hidden learner state) is closed; the coach reads *transcripts*, and its notes are about the tutor's craft, not about latent learner variables.
4. **Not a new evaluator.** Rubric v2.2 + existing judges remain the instruments; the poetics rubric is cross-correlated, not modified. The coach is not a judge and its notes never enter scoring.
5. **Not autonomous self-improvement left running.** Every durable write goes through the ledger with provenance (source dialogue, coach session, before/after hash); scored runs assert frozen memory; a human can read the entire training history of any profile.
6. **Not a replacement for the Writing Pad.** The pad is an *experiential trace* (what happened, three Freudian layers, decay); the prompt book is *curated guidance* (what to do differently, editorially maintained). Different objects; the pad stays untouched.

## 4. Conceptual model — the theatrical apparatus

The vocabulary is load-bearing, not decorative; each term names a real theatre practice with a direct implementation:

| Term | Theatre | Here |
|---|---|---|
| **Actor** | the person who plays parts; carries *technique* across roles | the ego model + `ACTOR.md` (transferable technique layer) |
| **Role** | the character as written and developed | anchor cell config + prompts + `MEMORY.md` |
| **Performance** | a played run before an audience | a scored evaluation dialogue (`evaluation_results` row + dialogue log) |
| **Rehearsal** | unscored practice runs | self-play vs mock/cheap learners; never enters `evaluation_results` |
| **Notes session** | the director's post-run notes to the cast — a conversation, with the actor answering back | coach ⇄ actor structured dialogue after a performance |
| **Prompt book** | the stage manager's master copy, holding every cue | `MEMORY.md` — the pun is exact: it is literally the book of prompts |
| **Side-coaching** | (Spolin) the coach calls guidance *during* the improvisation without stopping it | per-turn interval note injected into the next tutor turn |
| **Green room** | where actors exist between performances | the profile registry + store: everything offstage |
| **Script / canovaccio** | the loose scenario the players improvise over | curriculum / scenario YAML — already how scenarios work |

Three theoretical anchors, each doing work:

- **Stanislavski.** *An Actor Prepares* / *Building a Character* split training into *work on oneself* (technique) and *work on the role* — exactly the `ACTOR.md` / `MEMORY.md` split, and it makes the split testable: technique should transfer to a new role, role-work should not. His "emotion memory" notebook is the prompt book's ancestor: experience curated into rehearsable form.
- **Diderot's paradox of the actor.** The actor who *is* the character cannot improve; craft requires the reflective distance of the actor *playing* the character. The notes session enforces this distance structurally: in it, the model speaks **as the actor about the role** ("the tutor kept stacking questions in turn 3") — a register shift from performance, and plausibly the mechanism by which reflection escapes Finding 11's insight–action gap (insight generated *in role, mid-flow* dissipates; insight generated *out of role, into a durable book* can be re-opened at the next performance).
- **Recognition, recursively.** The coach⇄tutor relation mirrors tutor⇄learner: the tutor is held as an autonomous subject (asked to account for itself, not overwritten), and internalization is measurable — a coached note is *internalized* when the behaviour persists in later performances **without** the note remaining in the book (post-eviction persistence, the Freudian superego-formation signature). The bilateral architecture becomes trilateral.

## 5. Apparatus

New module `services/greenroom/` (eval-side only — tutor-core is never touched; the one-way seam holds). Post-P0 note: the store, coach engine, rehearsal loop, and profile ops below are substrate-independent; only the two marked seams — memory *injection* and the *performance runner* hooks — differ between the first-wave tutor-stub substrate (§0.1.6) and the later factorial fold-in. §5.2/§5.5 describe the fold-in seams (kept as written, they're validated); the stub-side equivalents are pinned at P1 in the preconscious worktree.

### 5.1 Store

```
$GREENROOM_DIR/                        default: data/greenroom/, env-overridable
  profiles/<profile_id>/
    profile.yaml                       actor model, anchor cell, parent/fork info, created
    MEMORY.md                          the prompt book (role layer) — current distilled version
    ACTOR.md                           technique layer (optional, Phase 2+)
    ledger.jsonl                       append-only: every event {ts, type: create|note|patch|distill|freeze|fork,
                                       source: {runId, dialogueId, coachSessionId}, before_hash, after_hash}
    sessions/<n>-notes.json            full notes-session transcripts (coach/actor exchanges + structured output)
    rehearsals/<n>/                    rehearsal transcripts + diary entries
```

DB index (same `evaluations.db`, `pilotStore.js` pattern — own `CREATE TABLE IF NOT EXISTS` block, `greenroom_` prefix, idempotent-ALTER helper): `greenroom_profiles`, `greenroom_memory_versions` (version, content hash, path, token count), `greenroom_coach_sessions`, `greenroom_rehearsals`. Files are the source of truth; the DB indexes them for joins against `evaluation_results`.

**Desktop discipline:** `GREENROOM_DIR` joins the relocation list in `desktop/paths.js` *and* the hard-coded key arrays in `tests/desktopPaths.test.js` (both, or the packaged app crashes at boot / the guard misses it).

**Memory budget:** injected MEMORY.md ≤ 1,800 tokens (ratified 2026-07-11). Over budget → the coach performs a **distillation pass** (rewrites the book, ledger records the eviction). The ledger is unbounded; the book is not. This is the anti-accumulation guard the rich-memory arc lacked.

### 5.2 Injection + provenance

- **Channel:** the existing opt-in `externalEgoExtension` param (`services/evaluationRunner.js:3275`, prepended into `fullEgoExtension` at `:3805` → `systemPromptExtension` at `:3824`) — the exact seam the rich-memory arc validated. No new prompt plumbing inside tutor-core.
- **Pinning:** scored runs reference `--greenroom-profile <id>@<version>`; the runner resolves the snapshot, injects it, and records `tutor_profile_id`, `tutor_memory_version`, `tutor_memory_hash` on every row.
- **Hash chain:** `memoryHash` joins the `computeConfigHash` snapshot (`evaluationRunner.js:619`) — set **only when present**, so `JSON.stringify` drops the key for non-greenroom runs and every historical `config_hash` stays byte-stable. Memory drift then trips `evalSignature`'s existing `config_hash_drift` validator for free.
- **Freeze assertion:** any run that writes `evaluation_results` asserts the profile is in `frozen` mode; the green-room store refuses durable writes while a scored run holds the profile. Training happens only through the coach/rehearse commands, between scored runs. (This is the two-phase train/eval split that keeps run-independence intact — the factorial harness's core assumption.)

### 5.3 The coach engine (notes sessions)

`services/greenroom/coachEngine.js`. Sessions are **tutor-initiated** by default — convened when the registry-variance trigger fires (§0.1.5), plus per rehearsal batch; a `--every-performance` mode is kept for the training-arc conditions that need dense coaching. Each session:

1. **Assemble:** dialogue log via `evaluationStore.loadDialogueLog(dialogueId)` (public turns + `dialogueTrace` internal deliberation), current MEMORY.md, scenario metadata; judge scores included by default (**coach-informed** — the user's stated intent) with a `--blind` variant preserved as the Goodhart probe (§6.3).
2. **Coach opens** (judge-tier model): 2–3 observations, each **quoting transcript evidence**, plus one question to the actor.
3. **Actor responds** (the profile's ego model, prompted *as the actor discussing the role in the third person*): what it was attempting, where it felt the scene resist.
4. **Coach probes** once more, then issues ≤3 **bankable notes** — each a *checkable behavioural predicate* ("do not stack a second question before the learner has answered the first"), not a virtue ("be more Socratic") — plus a structured memory patch `{section, op: add|edit|remove, text, provenance}`.
5. **Store applies** the patch, bumps the version, appends the ledger; distills if over budget.

Fixed 3–5 exchanges, structured JSON tail, deterministic session log. Coach model default: judge-tier via the CLI bridge (`codex.gpt-5.5` or claude-code Sonnet/Opus-class) — **never nemotron/kimi** (standing directive). Bankable notes being *predicates* is what makes C2 (§6) measurable at all.

### 5.4 The rehearsal runner

`services/greenroom/rehearsalRunner.js`, CLI `eval-cli rehearse <profile> --scenarios <file> --loops N --coach-every K`:

- Each loop: full multi-turn self-play — tutor side through the profile's normal generation path, learner side via **standalone** `generateLearnerResponse()` (`services/learnerTutorInteractionEngine.js:2814`; pure options-in function, injectable `llmCall`), persona drawn from the existing five archetypes (incl. `adversarial_tester`).
- Learner cost knob mirrors the adaptive pattern: one dispatcher, `GREENROOM_LLM=mock|cheap|real` (`services/adaptiveTutor/llm.js:13` is the template) — mock for loop mechanics and tests, cheap real models for actual training.
- After each loop the tutor writes one **diary entry** (short structured self-note: what I tried / what resisted / what to try next). Every K loops the coach reads the batch (diary + transcripts) in a single notes session — batch coaching keeps judge-tier spend sublinear in rehearsal count.
- Rehearsal artifacts live under the profile dir; **nothing enters `evaluation_results`** (no contamination of any analysis query, no `training_phase` filtering needed downstream).
- Scenario source: the *train split only* (§6.4); optionally coach-perturbed variants ("same trap, colder learner") generated as explicit YAML, never touching the held-out set. The `drama-generator` persona/misframing knobs are reusable here.

### 5.5 Side-coaching (mid-performance)

Cell-level flag, off by default:

```yaml
greenroom:
  side_coaching: { enabled: true, cadence: on_turn | every_k, max_notes: 3 }
```

In the `runMultiTurnTest` turn loop (`evaluationRunner.js:3671`), after the learner turn: coach sees the dialogue-so-far, returns **one whisper ≤2 sentences**, which rides the next turn's `systemPromptExtension` and is trace-labelled `tutor_coach/interval_note` (symmetry doctrine: `learner_coach/*` is reserved for the future mirror). Ephemeral by construction — durable memory stays frozen mid-performance. Cost: +1 judge-tier call per whispered turn, bounded by `max_notes`. This isolates *live guidance* from *durable memory* as separate factors (cells 206 vs 204).

### 5.6 Profile operations (compartmentalization)

```
eval-cli greenroom create <id> --anchor cell_60_… --actor-model <m>
eval-cli greenroom fork <id>@<version> <new_id>          # training-level checkpoints
eval-cli greenroom freeze <id>                            # eval-ready, refuses writes
eval-cli greenroom show <id> [--biography]                # the actor's CV: performances,
                                                          # rehearsals, sessions, note taxonomy, uptake curve
eval-cli coach <runId> --profile <id> [--blind]           # post-hoc notes session on a scored run
eval-cli rehearse <profile> --scenarios <f> --loops N --coach-every K
```

A profile is the compartmentalization unit the idea asks for: {actor model} × {role anchor} × {memory state @ version}, all swappable. Forks at versions give "different levels of training" as first-class comparable objects. `--biography` renders the self-documentation the idea leads with: the training record *is* a deliverable (§6, C1).

### 5.7 DB additions

`evaluation_results` columns (via `migrateAddColumn`): `tutor_profile_id`, `tutor_memory_version`, `tutor_memory_hash`, `training_phase` (the profile's phase label at scoring time: `untrained|placebo|rehearsed|coached|coached_rehearsed|sidecoached`), `coach_model`. Plus the four `greenroom_*` tables (§5.1). CLAUDE.md's schema list gains one line pointing at the migrations as source of truth, per convention.

## 6. Measurement — four claims, ranked by prior

**C1 — Biography (typological; no null possible).** A coached profile produces a legible training record: ledger, notes taxonomy (what does a judge-tier coach *persistently* correct in a frontier tutor? — code the notes, `code-impasse-strategies.js` precedent), distillation history, uptake curves. Deliverable regardless of every other outcome; the poetics move (describe the artifact) applied to training.

**C2 — Uptake (process; the Finding 11 attack).** Bankable notes are checkable predicates, so uptake is measurable: compliance with note *n* in the K performances before vs after the session that issued it (cheap judge, per-note binary). `note_uptake_rate` extends `incorporation_rate`/`analyze-insight-action-gap.js`. A18.37 is the precedent that durable-guidance effects surface on **blind behavioural channels** before (or instead of) rubric points — C2 is deliberately that kind of channel. Secondary: **internalization** — compliance persisting after the note is evicted from the book. *Gate metric: if notes don't change behaviour, nothing downstream can work.*

**C3 — Transfer / distillation (the genuinely new lever; the one configuration with positive in-repo priors).** Weak actor (haiku/gemflash-class): (a) untrained, (b) self-rehearsed only, (c) coached by judge-tier coach *watching the weak actor's own performances*, vs (d) strong actor untrained as ceiling. Metric: fraction of the (d)−(a) gap closed by (c) on held-out scenarios. Priors: §7.8.1 says native strong-authored guidance can move a weak actor a lot; §7.8.3 says non-native hand-me-downs are insufficient — (c) is native by construction, which is the specific gap between those two results this arm occupies. This is where capability asymmetry either pays or dies.

**C4 — Headline lift (weakest prior; pre-registered, run once).** Coached (203–205) vs untrained/placebo (201–202) on **held-out** scenarios, v2.2 overall, standard judge + second-judge rejudge. The §6.9.7 motif predicts ~null on a strong actor; the pre-registration says so, and a null here is a *reportable boundary* (coaching changes behaviour (C2) without moving rubric quality — itself a Finding-11-shaped result at the training level), not a failed arc.

### 6.1 Conditions (first wave: run-groups; cells 201–208 reserved for the fold-in)

**P0 superseded the original anchor.** First wave runs on the dramatic-derivation tutor-stub substrate (§0.1.6) — conditions below execute as run-groups (`marrick-greenroom-<condition>-rN`), not factorial cells. The cell numbers 201–208 stay **reserved** for the fold-in stage, at which point they register in `EVAL_ONLY_PROFILES` + YAML with a `greenroom:` block and must clear `tests/factorial-design.test.js` naming rules (via `/ms-add-cell`). The condition structure is substrate-independent:

| Cell | Condition | Memory |
|---|---|---|
| 201 `…greenroom_recog_untrained` | T0 baseline (profile plumbing on) | disabled |
| 202 `…greenroom_recog_placebo_book` | T1 placebo | length-matched generic-pedagogy MEMORY.md (cells 15–18 discipline: separates *having a book* from *having your book*) |
| 203 `…greenroom_recog_rehearsed` | T2 self-training only | book written by rehearsal diaries, no coach |
| 204 `…greenroom_recog_coached` | T3 coach | book from notes sessions on train-split performances |
| 205 `…greenroom_recog_coached_rehearsed` | T4 full training | both channels |
| 206 `…greenroom_recog_sidecoached` | T5 live guidance | no book; interval whispers only |
| 207 `…greenroom_recog_coached_weak_actor` | T6 distillation (C3) | weak actor + coached book |
| 208 `…greenroom_recog_coached_blind` | T7 Goodhart probe | coach never sees judge scores |

### 6.2 Splits and curves

- **Train/held-out split** of the scenario suite pre-registered at P0; coach and rehearsals see only the train side. Cross-suite transfer (the §6.8.7 pattern) as the harder generalization test.
- **Learning curve:** freeze forks at k ∈ {0, 3, 6, 12} coached sessions; score each checkpoint on the held-out set → score-vs-k, plateau detection. The forks are the "different levels of training".
- **Same-scenario repetition** where sessions repeat across the arc, fixing the design flaw the rich-memory screen surfaced (scenario difficulty confounded its slope).

### 6.3 Goodhart guards

Coach-informed is the default (the idea explicitly wants evaluation in the loop) — so the guard is triangulation, not blinding: (i) cell 208 coach-blind contrast (does informed coaching beat blind, and does the gain survive…), (ii) second-judge rejudge on all headline runs (…a judge the coach never saw), (iii) held-out + cross-suite scenarios, (iv) C2 uptake measured on behaviour, not scores. If informed-coaching gains vanish under the second judge, that *is* the finding: the coach taught the test.

## 7. Kill criteria & gates (pre-registered, no tune-and-retry branch)

Numbers ratified by owner 2026-07-11:

- **Gate 0 — coach quality screen (near-free, before any substrate beyond a script).** Runner: `scripts/greenroom-gate0.js` (standalone, file-outputs only, frozen manifest with git SHA, `--dry-run` plumbing mode). 5 notes sessions (`claude-code.claude-opus-4-8` coach ⇄ `claude-code.claude-sonnet-5` actor — re-pinned, §0.1.4) against *existing transcripts from the substrate*; **owner-scored** against the checklist the runner emits. **Pass = ≥4/5 sessions produce at least one note that (a) quotes transcript evidence, (b) is a checkable behavioural predicate, (c) is non-generic.** Fail → stop or redesign once; a coach that emits pablum kills the arc at ~$5. Runbook: §7.1.
- **Gate 1 — uptake (C2), small-N, headroom arena (§0.2.1).** One profile, ~6 coached sessions; per-note compliance measured over the next performances against each note's pre-note baseline. **Pass = ≥60% of bankable notes show a compliance improvement**, with a **never-issued-notes placebo** (compliance scored against notes the coach never gave) as the base-rate check. Uptake indistinguishable from the placebo drift → stop; write the null (coaching does not move behaviour) as the closing paragraph.
- **Gate 2 — transfer (C3), headroom arena, k≥5 runs/arm** (Phase-6 gate convention). **Pass = coached-Haiku beats untrained-Haiku on outcome-only channels (grounding rate / turns-to-ground) AND closes ≥20% of the Haiku→Sonnet gap on the held-out worlds (edmund, ravensmark)** — models per the §0.1.4 re-pin; a non-Anthropic rejudge is required before a pass is claimed (§0.2.2). Coached book ≤ Haiku baseline → the capability-asymmetry lever is dead; C4 is cancelled (it cannot succeed if even the widest gap won't close) and the arc lands as C1+C2 (+ the null).
- **Gate 3 — headline (C4).** One pre-registered run, Ns and margins pinned *after* Gate 2 sizes the effect (that pre-registration is the one P0 item deliberately left open until then). Whatever it returns lands.

### 7.1 Gate 0 runbook (session or local)

```bash
# from any existing clone of the repo:
git fetch origin claude/tutor-coaching-memory-system-vvvrl8
git checkout claude/tutor-coaching-memory-system-vvvrl8   # or: gh pr checkout 121
npm install                                               # needs the repo deps once

# point at the stub's transcript/trace records (adjust to where yours live):
node scripts/greenroom-gate0.js \
  --transcripts ../machinespirits-eval-preconscious/.tutor-stub-auto-eval \
  --sessions 5 --seed 1
# outputs → exports/greenroom-gate0-<stamp>/: manifest.json (frozen, git SHA),
# session-N.{md,json}, gate0-review-checklist.md  ← score this, fill the verdict.
```

Prerequisites: an authenticated `claude` CLI (already present in the session environment; `codex` needed only if the original `sol`/`luna` pins are restored). Runner defaults are the re-pinned models, so no `--coach`/`--actor` flags needed. Transcripts can be any mix of `.json`/`.jsonl`/`.md`/`.txt` — the runner extracts speaker/text generically and truncates long records head+tail. `--dry-run` first if you want to eyeball the prompts for free.

Checkout *or* worktree — not both: git refuses to check the same branch out twice, so if a checkout already holds the branch (`fatal: '…' is already used by worktree at …`), just `git pull` there and run from it. For a separate worktree instead, first `git checkout main` in the holding checkout, or use a detached worktree: `git worktree add --detach ../machinespirits-eval-greenroom origin/claude/tutor-coaching-memory-system-vvvrl8` (pushing results from detached HEAD: `git push origin HEAD:claude/tutor-coaching-memory-system-vvvrl8`).

Budget shape (call-count, not dollars): Gate 0 ≈ 5 sessions; Gate 1 ≈ 6 sessions + ~10 scored dialogues; Gate 2 ≈ 2 training arcs + 4 cells × pilot-N; Gate 3 is the only full-width spend. Rehearsal learner-side runs mock/cheap throughout.

## 8. Phasing

- **P0 — pre-registration. DONE 2026-07-11** (§0.1 decisions; §0.2 substrate constraints; §7 numbers ratified; ⚑ flags resolved). The single deliberately-open item is Gate 3's own pre-registration, pinned after Gate 2 sizes the effect. Next: **Gate 0** (§7.1 — runnable in-session after the §0.1.4 re-pin; owner scores the checklist).
- **P1 — substrate.** `services/greenroom/` store + profile ops + injection + provenance columns + freeze assertion; `GREENROOM_DIR` desktop relocation (+ both tests); hermetic tests (versioning, hash stability, budget enforcement, freeze refusal, fork). Smoke: hand-written MEMORY.md injected, hash lands on the row, drift validator fires when the book changes.
- **P2 — coach.** `coachEngine` + `eval-cli coach` + Gate 0 on archived transcripts. Then Gate 1 (first trained profile, uptake measurement extending `analyze-insight-action-gap.js`).
- **P3 — rehearsal.** `rehearsalRunner` + diary + batch coaching + `GREENROOM_LLM` mock switch (hermetic loop test with mock learner). Cheap comparison: rehearsed-only book vs coached book on train scenarios.
- **P4 — side-coaching.** Interval hook in the turn loop + `tutor_coach/interval_note` trace label + cell 206. (Independent of P3; can land before it.)
- **P5 — the experiment.** Cells 201–208 registered; Gates 2→3; learning-curve forks; rejudge; analysis scripts (`analyze-note-uptake.js`, curve plots).
- **P6 — stretch, explicitly out of scope now.** Coaching on human-pilot transcripts (IRB-gated; the ingest pipeline already lands them as dialogue logs, so the coach consumes them unchanged); `learner_coach/*` symmetry; ACTOR.md cross-role transfer study; poetics-rubric interaction (does coaching change dramatic form?).

## 9. Engineering map (repo hooks)

| Hook | Where |
|---|---|
| Memory injection | `externalEgoExtension` → `evaluationRunner.js:3805` → `systemPromptExtension` `:3824` (validated by the rich-memory arc) |
| Turn loop (side-coaching insertion) | `runMultiTurnTest`, loop at `evaluationRunner.js:3671`; learner turn `:4490` |
| Coach transcript input | `evaluationStore.loadDialogueLog(dialogueId)` (`evaluationStore.js:3084`): `dialogueTrace[]` `{agent, action, turnIndex, contextSummary, detail, timestamp}` + `turnResults` |
| Standalone learner for rehearsal | `generateLearnerResponse(options)` `learnerTutorInteractionEngine.js:2814` (injectable `llmCall`, `personaId`) |
| Mock/real switch template | `services/adaptiveTutor/llm.js:13` (`ADAPTIVE_TUTOR_LLM`) → `GREENROOM_LLM` |
| Store pattern | `services/pilotStore.js` (same DB, prefixed tables, idempotent ALTER helper) |
| Provenance | `computeConfigHash` `evaluationRunner.js:619` (+`memoryHash`, set-only-when-present); `evalSignature.js:25` drift validation |
| Cell registration | `config/tutor-agents.yaml` + `EVAL_ONLY_PROFILES` `evaluationRunner.js:262` (next free: 201); naming gate `tests/factorial-design.test.js`; `/ms-add-cell` |
| CLI | switch at `scripts/eval-cli.js:1603` + `HELP_TEXT` `:316` |
| Desktop relocation | `desktop/paths.js` + `tests/desktopPaths.test.js` (hard-coded key arrays — add to both) |
| Coach/actor model routing | CLI bridge via `externalAIProvider` hook (already registered at module load, `evaluationRunner.js:43`) |

## 10. Risks & discipline

1. **Statefulness vs run-independence** (the deepest one): training makes runs history-dependent, which the factorial harness assumes away. Answer: strict two-phase train/freeze/eval, memory pinned by `@version` + hash on every row, freeze assertion in the runner. An `online_learning` cell (durable writes *during* scored runs) is explicitly deferred — it breaks row exchangeability and needs its own design.
2. **Goodhart** via coach-informed default → §6.3 triangulation; cell 208.
3. **Memory bloat / drift** → token budget + coach distillation + ledger (curation is a feature under test, not just hygiene).
4. **Naming collision** → "coach" everywhere in code/DB/trace; "director" stays with cells 101+; "green room" is unclaimed in the repo (checked).
5. **Seam** → all green-room code eval-side; injection through existing opt-in params; `tutor-core/**` untouched (re-extractability preserved).
6. **Symmetry doctrine** → coach labels namespaced `tutor_coach/*` with `learner_coach/*` reserved; if a learner coach ever lands, trace/scoring mirrors per CLAUDE.md.
7. **Cross-version contamination** → coaching may *consume* historical transcripts as training input, but no historical row is ever re-scored or re-labelled; new columns are NULL for all history.
8. **Cost creep** → judge-tier calls only in notes sessions (batched for rehearsals) and interval whispers (bounded by `max_notes`); learner side mock/cheap; gates order spend from ~free to full-width.

## 11. Landing

Single-paper discipline: results land as a new § of `docs/research/paper-full-2.0.md` (named anchor, not a bare number — post-poetics convention), whether positive or null. C1's biography artifacts (ledger excerpts, note taxonomy, uptake curves) are the section's figures. Spin-offs inherit. The workplan card (`a22-…`) tracks execution; this doc is amended in place with dated stamps, DRAMATIC-RECOGNITION-PLAN-style.

## 12. Open decisions

Items 1, 2, and the split were **DECIDED 2026-07-11 — see §0.1** (anchor → tutor-stub substrate on the Marrick family; hold-outs edmund + ravensmark; informed-default with tutor-driven registry-variance trigger); models were **re-pinned to the Claude stack 2026-07-12** (§0.1.4: Opus 4.8 coach / Sonnet 5 actor / Haiku 4.5 weak actor). Still open:

1. **ACTOR.md layer** — ship in P1 (two files, two hash columns) or defer to the transfer study? Default: defer; keep P1 minimal.
2. **Rehearsal scenario variants** — coach-authored perturbations vs fixed train-family only. Default: fixed family first (005/019/020); variants are a P5+ enrichment.
3. **Notes-session transcript privacy class** — sessions quote learner transcripts; when human-pilot data arrives these inherit pilot consent scope. Flag for the IRB packet now.
4. **Side-coaching latency budget** — a judge-tier call inside the turn loop is the one place this touches run latency; matters only at the sidecoached condition.
5. ~~⚑ reconciliations~~ **RESOLVED 2026-07-11** against the pushed `preconscious` branch: registry-variance = the register-policy layer over `engagementRegisterRegistry.js` (§0.1.5); injection = the `--field-report-context` pattern, mirrored as `--prompt-book-context` (§0.1.6). Substrate constraints inherited from the branch review recorded as §0.2.

---

*Review stance, summarized: the idea is sound and belongs in this project precisely because its untested levers — capability asymmetry, dialogic curation, uptake-not-just-scores, and training as a documented biography — are the ones the six adaptation nulls and two memory nulls never pulled. But it must be built gate-first, null-tolerant, and frozen-by-default, or it becomes the seventh thrash. The plan above is that shape.*
