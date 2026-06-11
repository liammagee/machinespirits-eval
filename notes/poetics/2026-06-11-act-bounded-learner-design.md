# Stage v2: acts, the bounded learner, the curated theory, and the reconstructing tutor

**Date:** 2026-06-11 · **Status:** design captured (this note); build pending; sanctioned
probe = ONE run per arm (adapt ON / adapt OFF), mock-first before either paid run
**Mandate (operator, same exchange):** four refinements — (1) "more than [one] turn per
act … the director only terminates an act when it evaluates a certain amount of 'work' is
done — either dialogical progress, or a sense of stalling … to intervene with strategic
stage directions after so many turns"; (2) "the learner does not have access to the full
dialogue, only (a) their own logical theory and (b) the part of the dialogue involved in
the current act"; (3) "the learner must be able to revise their logical theory after each
turn — when a new fact is told to them by the tutor, or can be inferred from the context";
(4) "their theory is never transferred directly to the tutor. Rather the tutor (both ego
and superego roles) construct that theory based on what the learner knows. They must
therefore try to infer what has been forgotten and supplement it." Test: "can adaptive
measures help the learner 'recall' (add back missing axioms) or 'revise' (changing
mistaken axioms) — over and above the default tutor mechanisms? … proceed with just one
of each (with and without the attempt to adapt)."

Predecessors: `2026-06-10-unreliable-learner-design.md` (decay condition),
`2026-06-11-unreliable-learner-results.md` + paper §6.13.7 (the visibility contrast:
told 0.860 vs conduct 0.368, all blind repairs incidental — detection, not response, is
the deficit). This design is the operator's answer to §6.13.7's open question: instead of
handing the tutor the ledger (told) or hoping unstructured conduct-reading works (it
didn't), give the tutor an explicit *reconstruction job* — and change the stage so the
learner's conduct carries more signal.

---

## 1. The four refinements, against the current machinery

### 1.1 Acts with director-judged termination

**Now:** the director is consulted every turn and may declare/replace a *movement*
(diagnostic dramaturgy); since §6.13.4 it has no note channel to the tutor.
**v2:** the act becomes a first-class unit. The director is still consulted each turn but
returns a minimal act verdict — `{act: 'continue'}` or `{act: 'end', direction}` — ending
an act only when it judges the act's *work* done: dialogical progress achieved (premises
grounded, D moved) or the act stalling (no movement in k turns). On `end` it issues one
**strategic stage direction** that opens the next act (shown to the tutor as the new
act's brief — strategy, not per-turn puppetry). Guards: `minActTurns`/`maxActTurns`
harness-enforced so a director that never ends (or always ends) an act cannot degenerate
the run. Release mechanics are untouched (the director's release authority and the
on-cue adherence check stay exactly as they are — the frozen formal channel survives v2
unchanged).

This *reduces* director speech (strategic interventions at boundaries, not per-turn
movements) while keeping its evaluative presence — the §6.13.3 lesson (advisory per-turn
steering is noise) baked into the role's shape.

### 1.2 The bounded learner

**Now:** the learner sees the full dialogue every turn — which is exactly what produced
§6.13.7's *stale residue*: slipped facts survived in the prose context, so the learner
kept citing what its board had lost, masking decay from the blind tutor and giving
itself a free self-repair path (re-derivation from old prose was legitimate but cheap).
**v2:** the learner's context is (a) its own logical theory (the store, §1.3) and (b) the
current act's dialogue only. Prior acts are gone from view; the theory is the only thing
that crosses an act boundary. Two consequences, both load-bearing for the test:

- The theory becomes the learner's *actual memory* — if a fact is neither in the store
  nor re-stated in the current act, the learner has no access to it at all.
- Decay becomes *more conduct-visible*, not less: a bounded learner that lost an axiom
  stops mentioning it entirely, asks for what it should already know, or builds visibly
  gappy chains. The v2 stage is simultaneously a harder support problem (no residue
  self-repair) and a more readable learner (no residue mask). §6.13.7's conduct-arm null
  does not automatically transfer here — that is part of what the probe asks.

### 1.3 The curated theory (learner revises after each turn)

**Now:** the learner already has `adopt`/`retract`/`derive` output channels onto a
harness-owned grounded board; decay marks entries invalid silently.
**v2:** the same board, reframed as the learner's **theory store** and explicitly
learner-curated each turn: add what the tutor just told it or what it can now infer
(existing adopt channel), drop or **revise** what it believes mistaken (retract +
re-adopt of the corrected form; ledgered as a `revise` event when the harness sees a
retract/adopt pair touching the same predicate). Harness keeps ground truth: every edit
is ledgered, decay still operates on the store directly, and grounding validity stays
harness-computed (an entry counts toward forcing only if it matches released/background
fact — the learner cannot promote itself).

**New decay mode — corruption (for "revise"):** v1 decay only *deletes*. To give
"changing mistaken axioms" something real to operate on, the decay draw gains a
`mutateShare` parameter: a slip either removes the entry (recall target) or **mutates**
it in place (argument swap to a plausible same-type constant — a *mistaken axiom* the
learner now believes). Harness-implemented, seeded, never roleplayed — the same costume
rule as v1. Soundness is free: a mutated entry no longer matches any released fact, so
grounding validation already excludes it from forcing; formally a mutation is a deletion
plus a false belief in the store. The learner can only get the true fact back via tutor
re-statement or re-derivation inside the current act — and must additionally *notice and
retract* the false version.

### 1.4 The reconstructing tutor (theory never transferred)

**Now:** arm-told carried the SLIPPED block; arm-conduct suppressed it but the tutor view
still carried the learner's grounded board itself.
**v2 (both arms):** the learner's store is **never** shown to tutor ego or superego —
no SLIPPED block, no abox dump. What they see: the dialogue (full, on the tutor side)
plus the release ledger (what *has been staged*, which is the tutor's own knowledge).
The structural conduct condition of §6.13.7, now total.

- **Adapt-OFF arm (default mechanisms):** current tutor script + charter-v2 superego,
  prompts unchanged apart from the (arm-shared) act/visibility plumbing.
- **Adapt-ON arm:** ego and superego jointly maintain an explicit **reconstructed
  theory** — each turn they output their model of what the learner currently holds
  (`believedHeld`, `believedMissing`, `believedMistaken`), persisted per-turn to the
  diagnosis like the id-construction trace; the charter adds the *supplement mandate*:
  when the reconstruction infers a gap or a mistake, the turn's move should re-stage or
  correct it (targetPremise as in v1 repairs).

  The reconstruction is *checkable*: the harness can score it each turn against the true
  store (precision/recall of the believed-missing set against actually-missing). That
  per-turn ToM-accuracy curve is arm-internal color; the *cross-arm* endpoints below
  never read it (architecture-independent scoring, per the closed-loop rails).

## 2. The test, and what one pair can and cannot say

**Question:** do adaptive measures (explicit reconstruction + supplement mandate) improve
the learner's **recall** (deleted axioms restored to the store) and **revision**
(mutated axioms corrected) over the default tutor — when nobody is told what slipped?

**Endpoints (mechanical, harness-ledgered, identical across arms):**
- per-slip recall rate (deleted → restored, by channel: tutor re-stage vs learner
  re-derivation), latency;
- per-mutation revision rate (mutated → corrected, requiring the false form retracted);
- theory fidelity F(t): Jaccard between the store and the ideal no-decay store, per
  turn (a curve, like D(t));
- the v1 selection signature on tutor repairs (non-lastRelease, proof-path target);
- the standing formal layer: releases on cue, D(t), grounded-anagnorisis verdict.

**Scope discipline:** one paid run per arm (same world, same seed, same decay schedule)
is a **mechanics probe and existence test**, not an effect estimate — it can show the v2
machinery runs end-to-end, that the ledger separates recall from revision cleanly, and
whether the adaptive arm's reconstruction is even approximately accurate; it cannot
support a rate comparison (n=1, and §6.13.7's seed-invariance means one seed is one
draw). Any claim language stays at "the probe ran / the mechanism is legible." Scaling
to a registered contrast (seeds × worlds, a prereg with anchors like v1's) is a separate
sanction. Prior: the arc's ToM-redundancy results lean null for reconstruction-as-
mechanism, but §6.13.7 showed the ledger is genuinely non-inferable under v1 conditions —
the bounded learner moves the signal boundary, so the outcome is genuinely open.

**Probe config (proposed):** world-001 nocturne (the long leash gave v1 its richest
repair texture; withercombe's window-6 stall clock killed blind runs at t7 before any
mechanism could show), script nocturne-v002, superego on (charter v2 + arm-ON additions),
decay `{rate 0.75, graceTurns 1, maxConcurrent 2, startTurn 1, mutateShare 0.33, seed 1}`,
acts `{minActTurns 3, maxActTurns 8}`, casting as unreliable-v1 (codex
director/tutor/superego, Sonnet learner, Fable critic).

## 3. Build plan (seam level)

1. **engine.js** — act state (`actIndex`, `actStartTurn`, per-act transcript slice);
   director verdict schema `{act, direction?, release?}` + min/max guards; learner view
   builder switches to (store + current-act dialogue); `revise` detection in the
   adopt/retract ledger; corruption draw gains `mutateShare` (mutation = in-place
   argument swap, ledgered `{type:'decay', mode:'mutate', falseForm}`); fidelity F(t)
   computed per turn; diagnosis gains `acts[]`, `theoryLedger`, `corruption.mode` fields.
2. **llmRoles.js** — director prompt: act-verdict contract; learner prompt: bounded
   context + theory-curation contract (explicit: "your theory is your only memory across
   acts"); tutor/superego prompts: arm-ON reconstruction block + supplement mandate
   (arm-OFF: unchanged).
3. **mockRoles.js + tests** — deterministic act endings, a scripted mutation, a scripted
   revise; regression: v1 decay runs byte-identical with `mutateShare 0` and acts off
   (off-state invariance, as v1 did for the pre-decay engine).
4. **CLI** — `--acts '<json>'`, decay key `mutateShare`, `--reconstruct` (arm dial);
   group `bounded-v2-probe`.
5. Mock rehearsal both arms → paid pair, serialized, attended.

## 4. Open questions deferred (not blocking the probe)

- Does the superego need a criterial jurisdiction over the reconstruction (charter-v4
  style: "reconstruction stale ⇒ fire") or is the mandate enough? Probe first.
- Whether act boundaries should also bound the *tutor's* context (currently: no — only
  the learner is bounded; the asymmetry is the point: the tutor is the memory the
  learner lacks).
- Mutation realism (argument swap vs predicate swap vs strength downgrade) — one mode
  (argument swap) for the probe.
- Whether F(t) belongs in the paper's instrument set or stays probe-internal.
