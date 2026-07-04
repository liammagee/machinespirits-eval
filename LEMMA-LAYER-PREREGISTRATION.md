# Lemma Layer — Pre-registration

**Status:** DRAFT 2026-07-04 (operator instructed the pre-registration after Gate 0). **Freezes at the commit that launches the paid contrast.** Between draft and freeze, in order: (1) implementation landed and gated, (2) analysis design entry + matrix specs written, (3) zero-paid mock validation of the full pipeline, (4) the pre-registered world-slot probe. Any design/endpoint/analysis change past the freeze commit is forbidden.
**Line:** `workplan/items/proof-lemma-layer.md`. Gate 0 (free depth audit, `exports/dramatic-derivation/lemma-layer/gate0-depth-audit.md`): 7/19 worlds RICH; the hethel family is width-1 linear — the trusted binding pair splits, so the second world slot is filled by pre-registered procedure (below), not by choice after seeing data.
**Operator articulation being tested (2026-07-04):** maintain a **separate proof structure at a higher level than the per-turn one** — lemma-grain sub-goals with their own dependency DAG, kept live like the premise-grain state. The outer loop then operates on a formal object (the lemma frontier), not prose: "where are we" = frontier state; "change course" = re-pick the frontier path. Plan as data structure, not plan as prose.

## Question

Does a **live, binding, lemma-grain proof structure** — auto-derived from the world's authored proof, cleared criterially against the learner's own grounded assertions, and wired into release eligibility and scene exits — improve dialogue outcomes over the same binding stack without it, at fixed turn budget, on a strong-model stack?

## Position in the design space (why this is not a third strategy overlay)

| Axis | Closed commitment line | Closed stock-take | **Lemma layer (this test)** |
|---|---|---|---|
| Outer state | Prose commitments | Prose orientation | **Formal object** (lemma DAG + frontier) |
| Judgment channel | LLM conformance audit | LLM situation appraisal | **Deterministic clearance** (chainer against the learner's grounded set) |
| Decision at scene boundary | Keep/adjust plan (free text) | Course correction (free text) | **Pick active lemma from frontier** (one enum field — churn structurally impossible) |
| What it changes | Tutor conduct | Tutor orientation | **The task representation the engine enforces** (release eligibility, scene exits) |

Precedents for: every surviving mechanism in the arc was criterial/deterministic (pacing guard, hidden-guard verdicts, ledger bookkeeping); the one confirmed lift was scheduling discipline (§6.13.11–13); the cross-model result showed weak egos answer open reflection with churn — a formal object closes that channel. Precedent against (the trap this design must dodge): the stall-watcher null — a *derivable* lemma map shown as information should be redundant on a strong model. Hence the layer **binds**; and arm B below tests the redundancy prediction directly. This is the "stepping back from the engine" route the closed outer-loop line's consequences clause reserved for operator decision; the operator has taken it.

## Mechanism spec (to be implemented and gated BEFORE freeze; opt-in `--lemma-layer`)

1. **Derivation (no authoring, no authoring bias):** the lemma DAG is computed from the world's authored `proof_paths[0]` via the engine's own chainer — nodes = intermediate derived facts of S's proof (exactly Gate 0's objects), edges = derived-fact dependency. Marrick: {blankFrom, castBlankFor, dieCutWith, cutDieFor} with the alpha/beta interleave.
2. **Live state, criterial:** a lemma is grounded ⟺ its fact is derivable (chainer) from the learner's currently grounded assertions. Recomputed per turn from the public record; never an LLM estimate. Under decay a lemma can UN-ground and the frontier moves backward — regression handled natively by the object, no appraisal call needed.
3. **Frontier + the formal outer decision:** frontier = ungrounded lemmas whose lemma-parents are all grounded. At each scene opening the tutor's opening call selects the scene's **active lemma** from the frontier (one enum field; the engine validates membership and falls back to the unique frontier element when |frontier| = 1).
4. **Binding (the load-bearing delta):** proof-path premise releases are restricted to the active lemma's support set (its ungrounded base premises) — composed by intersection with the pacing guard and release-authority. Mirror (`m_*`) and `background` releases are exempt (they feed no proof; the temptation dramaturgy is untouched). Out-of-support proof releases require a **licensed departure**: a tagged one-line justification, logged and counted; silent departures are engine-blocked.
5. **Prompt signal:** a compact lemma-map section (nodes, grounded state, frontier, active lemma) in the tutor prompt. **Learner mirror (symmetry):** the learner prompt gets the same map computed from the learner's OWN grounded assertions only — never the tutor's view of them.
6. **Display-only mode:** map + frontier in prompts, no binding, no scene-exit wiring — arm B and the fingerprint gate.
7. **Gates (extend the derivation gate suite; all must pass before freeze):** proof fingerprints byte-identical off vs display-only; under binding only release ORDER may differ (closure validity, leak discipline, t_min floor unchanged); frontier/clearance computation deterministic and replay-stable; every out-of-support release carries a departure tag; mock runs exercise ≥1 frontier choice, ≥1 licensed departure, ≥1 decay-regression re-grounding.

## Precondition W — the second world slot (pre-registered procedure; hethel is structurally ineligible)

Candidate order fixed now, by Gate-0 richness then catalog order: **fengate → sealhouse → edmund** (all single-path, linExt 6; nocturne excluded from v1 — its 4 proof paths add path-choice, a second axis this design does not test). Probe per candidate: **3 baseline runs** (binding stack, no lemma layer, codex, probe seeds 83/89/97). Pass rule: ≥1 non-grounded verdict OR T\* spread ≥ 3 turns across the three (headroom evidence, the H0-gate pattern). First candidate to pass fills the slot; all probe runs disclosed in the addendum; probe runs never enter contrast data. If all three fail: the contrast does not run, and the line returns to the operator as a world-authoring decision (a resistant variant of a RICH world) — recorded as such, not silently escalated.

**Probe outcome (2026-07-04, pre-freeze): the procedure EXHAUSTED without filling the slot.** Fengate FAIL (3/3 grounded at exactly T\*=22, spread 0, seeds 83/89/97); sealhouse FAIL (3/3 grounded T\*=22 — byte-identical signature); edmund INELIGIBLE (no derivation tutor role-script exists — it was authored for the character-development arc; probing it would require new authoring, the very decision this procedure defers). Six runs, two worlds, six identical outcomes: the generalization-arc 28-cap worlds are uniformly schedule-generous under the decay grid that reliably breaks marrick. **The recorded consequence fires: the 36-run contrast does NOT run under this pre-registration.** The line returns to the operator as a world-authoring decision; the natural candidate is a resistant variant of marrick itself (the hethel→hethel-resistant recipe applied to the one world that is both RICH and decay-sensitive), which would require its own headroom probe and a fresh freeze. Implementation, gates, analysis design, and the zero-paid validation all stand and carry over unchanged.

## Arms (three; promotion rides on A-vs-C only)

| Arm | Label | Delta |
|---|---|---|
| A | `baseline` | binding stack only |
| B | `lemma-display` | + `--lemma-layer '{"display":true}'` (map as information; the stall-watcher redundancy prediction says ~null) |
| C | `lemma-bound` | + `--lemma-layer '{"bind":true}'` (map + frontier choice + release/scene binding) |

Binding base (identical, all arms): `--scene-mode --didactic-mode --register modern --release-authority --pacing-guard --decay '<per-repeat seeds>'`. Turn-watch superego OFF; strategy-ledger OFF (closed line — nothing stacks on it).

## Worlds, repeats, seeds, backend

`world-005-marrick` + world W. 6 repeats per arm per world, **triple-interleaved** (`baseline-rN`, `lemma-display-rN`, `lemma-bound-rN`), decay seeds **59, 61, 67, 71, 73, 79** shared within triples (fresh primes; disjoint from every prior matrix in the arc). 36 contrast runs, n = 12/arm pooled. Backend `DERIVATION_PROVIDER=codex` (the claim targets strong inner loops — the cross-model result put weak-model rescue out of scope), concurrency 3 within world blocks, blocks sequential with a checkpoint (the plan-mode execution pattern; interruptions resume via trimmed same-label specs; hang > 40 min → kill, one same-label retry, two failures exclude the triple and report).

## Endpoints and promotion bar

Per run: `T*` = `assertedGroundedTurn`, cap+1 imputed (marrick 29; W per its cap; the frozen extractor).

**Promotion bar (all three, on A-vs-C pooled 12v12):**

1. Direction consistent both worlds (mean T\* lower in C within each world's stratum);
2. Pooled one-sided Mann–Whitney U ≤ 42 (exact one-sided 0.05 at 12/12);
3. Guardrails clean in arm C: leaks 0; releases ≥ baseline − 0.5 per world; aporia-like ≤ baseline + 1 per world; guard overrides 0; **every out-of-support release licensed** (0 untagged); frontier-choice coverage ≥ 0.8 of scene openings with |frontier| > 1.

**Secondary (descriptive, no promotion weight):** grounded rate; B-vs-A (the redundancy prediction — B ≈ A is the *expected* result and strengthens the mechanism story; B > A flags signal-not-discipline and is reported as a caveat, not a claim); C-vs-B (binding net of information); departure rate and tags; frontier-regression events under decay; repair latency (the arc's cross-check — the closed lines traded it against outcomes).

## Outcomes and recorded consequences

- **Confirmed:** a representation-level outer structure works where both deliberation-level outer loops failed — §6.13 gains a new subsection (this is NOT a reopening of §6.13.16's closed line; it is the reserved step-back route), and scaling/mechanism-localization follow-ups may be pre-registered.
- **Not confirmed:** the lemma layer joins the outer-loop record as non-promotable at this bar; the RICH-world catalog and Gate-0 audit stand as reusable instruments; no authoring escalation, no fourth design cell without a fresh operator decision.
- No re-rolls, no endpoint swaps, no post-hoc arms (§5.12.6).

## Artifacts

Implementation in `services/dramaticDerivation/` (lemma module + engine wiring) gated by the extended gate suite; specs `config/drama-derivation/matrix-specs/lemma-{marrick,<W>}.yaml`; probe spec `lemma-probe-<candidate>.yaml`; runs `exports/dramatic-derivation/matrix/lemma-<world>/`; analysis via the frozen contrasts script gaining a `lemma` design entry (zero-paid validated pre-freeze); report `exports/dramatic-derivation/lemma-layer/lemma-contrast-report.{json,md}`.
