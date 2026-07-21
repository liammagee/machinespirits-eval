# The committee architecture as an adaptation mechanism — offshoot basis
Date: 2026-07-21. Status: synthesis of session analysis following Phases
4/5/5b; no new claims — all numbers trace to the cited preregs/paper.
Provenance: PROGRAM-2-PHASE5-LIVE-PILOT-PREREGISTRATION.md §9,
PROGRAM-2-PHASE5B-FALLBACK-BATTERY-PREREGISTRATION.md §8, paper §6.18–§6.20,
manifests program-2-phase5-live-pilot / program-2-phase5b.

## 1. Weights vs harness, and what KTO adds
Every gain after the original fine-tune came from the harness around a
frozen model (selection, retry, trim). KTO is the complementary move: it
changes weights using the half of the data no training step touched — the
980 audit-failing turns — pushing first drafts toward deliverable so the
harness rescues (19 resamples + 8 trims in 5b) become belt-and-braces.
Licensed purpose: the last Phase-2 training shot; offline bar 0.460.

## 2. Adaptation is a system property: routing, not a smarter model
The program's nulls (ToM layers, state machines, coaching) all re-told the
frontier what it already inferred. The committee's adaptive organ is the
detector (learner-state triggers); the reliable organ is specialist+checks;
the fluent organ is the frontier. Behavior varies with the learner because
routing is learner-conditional — a proof-skipper gets a committee-governed
dialogue, a careful learner gets pure frontier. Widening adaptation =
widening the trigger vocabulary (moves × checks), not deepening any model.

## 3. Design law: the leak is where the checker isn't
Phase 5: offline gain vanished live; located to the single unchecked text
path (fallback). 5b: extending the same battery over that path moved
exactly one component (one-question 0.720→0.976) and the verdict flipped
(0.386 vs 0.150, CI [0.128, 0.354]). Residual failures concentrate in
whatever surface lacks a check; each iteration = find it, extend the check.

## 4. The exhaust loop is the adaptation engine
Deterministic checks label every live moment; labeled exhaust (incl.
failures) retrains the specialist on its own deployment distribution
(DAgger-shaped). No human labels, no drifting judge. Extractor exists
(scripts/program2-extract-live-moments.mjs; 75 moments, 15 SFT-eligible,
15/60 KTO). Checks derive mechanically from the world spec
(deriveWorldEvidenceLexicon) → recipe: spec → checks → exhaust →
specialist → deployment → better exhaust.

## 5. Iron cage inverted, twice
Below: alignment tuning was the integration scaffold (base arm collapsed).
Above: the deterministic battery is what lets fluency serve form live
(coverage never taxed; seam invisible at 0.600 ≤ 0.65). Discipline as the
enabling condition of responsiveness.

## 6. Fine-tune per curriculum: the lifecycle
(1) author the curriculum machine-checkable (the world file IS the
examiner); (2) name the must-not-fumble moves, one dumb check each —
checkable ⇒ committee-eligible, else stays with the frontier; (3) generate
exhaust by running the curriculum under coaching (~80 dialogues → ~2k
labeled turns, one evening of quota); (4) train the small aligned model
(~$8, 1h H100; instruct variant always); (5) wire committee + one
frozen-bar pilot (compliance CI>0, coverage flat, seam ≤0.65; ~$20, a
day); (6) leave the exhaust loop on. Curriculum artifact = world file +
check battery + adapter + validation certificate. Frontier = commodity.

## 7. The move library and validation-gated reuse
The warrant demand is Toulmin-general; index the library by MOVE not
curriculum. Reuse policy: validation always mandatory, training only on
failure — a new curriculum first runs library candidates through step (5)
alone; failure triggers steps (2)–(4). The instrument already transfers
(trigger labels + six-word cue + one-question + release checks are all
world-independent). Generalization ladder: one-world specialist → pooled
multi-world exhaust → held-out world validation.

## 8. The 5c transfer probe (designed, not yet run)
Unchanged 5b-validated mini on a sibling drama-derivation world;
committee-v2 vs fresh controls (no cross-world pooling); frozen audit
unchanged; new descriptive metric: costume leak (Marrick-only lexicon words
in delivered spans, via lexicon diff). Pass ⇒ library live; fail ⇒
anatomy separates form-not-transferred from costume-dragging ⇒ pooled
exhaust is the library recipe.

## 9. Bounds
Deterministically checkable properties only (letter, not spirit — the
six-word instrument undercounts the frontier's native questioning; check
choice = value choice). Distills existing capability into reliability;
does not create capability. Evidence: one move, one world, one family,
n=12/arm, exploratory tier. Multi-move crowding untested.
