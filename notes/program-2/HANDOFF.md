# Program-2 cross-thread handoff

Convention: append-only. The planning/theory thread adds dated items; the
executing thread integrates them and flips `status:` to `done` (with the
integrating commit SHA). Neither thread edits files the other has uncommitted
work in — this file is the channel. Check `git status` before touching
`PROGRAM-2-FINETUNE-PLAN.md` or `scripts/program2-*`.

---

## H1 (2026-07-18) — Base/instruct two-arm design

status: done (integrated 89cdad81, 2026-07-18: plan §5 variants block, §7 per-variant floors/request shapes, §8 Phase 1 row, §9 cross-variant grammar, revision log)
rationale: `notes/program-2/2026-07-18-dispositional-executive.md` §8
(user-directed: "update the prereg to include the base/instruct arms")

The plan currently trains one instruct model. Revise to a two-arm design —
the instruct variant AND its base sibling of the same family (per the
in-flight model check: Qwen3.5-9B-Instruct and Qwen3.5-9B-Base), identical
LoRA data in both arms. This converts the iron-cage question (is the
alignment layer what resists the discipline?) into a controlled contrast:
base and instruct siblings share architecture and pretraining and differ only
in the preference layer.

Paste-ready revisions to `PROGRAM-2-FINETUNE-PLAN.md` (integrate around the
uncommitted model-selection edit already in the working tree; add a dated
revision log at file end):

**§5 Models and method — add:**

> **Variants (revision 2026-07-18): two arms per selected family.** Train the
> identical LoRA data into (a) the instruct variant and (b) its base sibling.
> Training order differs by construction: instruct → SFT, then conditional
> KTO; base → SFT first (for the base variant, our SFT *is* its instruction
> formation — an ego formed entirely from the corrected-practice corpus),
> then conditional KTO. Licensing updated accordingly: one SFT + one
> conditional KTO run **per variant** (≤4 frozen runs total; budget
> unchanged, still < US$50 at ≤9B LoRA scale).

**§7 Evaluation — add:**

> **Per-variant floors and request shapes (revision 2026-07-18).** The
> instruct variant takes the reconstructed request natively (system prompt +
> messages under its chat template). The base variant has no chat template:
> the same request is flattened to a transcript-style completion prompt, and
> that flattening template is itself frozen at Phase 2 — it is part of the
> instrument. Phase 1 measures each variant's untuned floor under its own
> shape (the base floor will likely be low and strange; that is a datum —
> everything SFT adds is visible against it). The blinded-quality gate
> applies per variant (predicted base-arm pathology: thin ego — executes the
> discipline, speaks poorly).

**§8 Phases — amend Phase 1 row:** floor covers both variants, each under its
own request shape.

**§9 Decision grammar — add the iron-cage readout (cross-variant rows; the
existing rows apply within each variant):**

> | Cross-variant result | Licensed reading |
> |---|---|
> | Discipline trains into base but not instruct | Alignment-layer localization: the incumbent dispositional norm (preference tuning) is the binding constraint — the "iron cage" is real and has an address |
> | Trains into both comparably | The incumbent attractors were never the binding constraint; the discipline was reachable at adapter scale regardless |
> | Fails in both | The gap is deeper than adapter-scale weight change — the earned version of the glum reading; escalation beyond LoRA requires a new document |

---

## H2 (2026-07-18) — Phase 5 trajectory-coherence prediction

status: done (integrated 89cdad81, 2026-07-18: plan §8 Phase 5 row addendum)
rationale: `notes/program-2/2026-07-18-dispositional-executive.md` §7 point 4

Add to the plan's Phase 5 (live integration) description:

> Phase 5 additionally separates two hypotheses the Step 4 data cannot: the
> compiled-enforcement arm paid ~0.13 proof-DAG coverage at turn 16
> (§6.18-addendum). If that cost is a property of the warrant move itself, it
> survives training; if it is a property of coerced authorship (the model
> conditioning on turns it did not produce), it vanishes when the move is
> trained. Either answer is informative; a vanishing cost dissolves the main
> liability of the enforcement path.

---

## H3 (2026-07-18) — Expressiveness checks: the seam variant + guard-trip proxy

status: done (integrated 15657c73, 2026-07-18: plan §7 seam-review block + frozen-bars list + revision log)
rationale: user-flagged ("the step (5) draft not being expressive enough");
the seam is where the committee thesis is tested — §6.18 found apt/checkable/
attributable don't co-occur in one stream; the architecture bets they co-occur
in a system, and the joint between organs is where that bet can fail.

The existing blinded-quality gate covers per-turn flatness only. Add to the
plan's §7 (and carry into the Phase 2 freeze):

> **Seam review (revision 2026-07-18).** The per-turn blinded review is
> structurally blind to register drops at the organ boundary. Add a seam
> variant: blinded judges see three-turn windows (frontier turn, candidate
> turn, frontier turn) where the candidate is either the frontier original or
> the mini generation, and answer (a) was any turn spoken by a different
> tutor, (b) a continuity rating. Seam-detection at chance = expressiveness
> parity at dialogue grain. Report alongside: the mini's deterministic
> guard-trip rate (dramatic-release + response-composition audits demand
> in-scene texture, so trips price flatness for free) against the frontier's
> own baseline (~47% of frontier turns needed repair/fallback in Step 4).
>
> Escalation ladder if the seam check fails, ordered by least concession:
> (1) larger mini; (2) dataset v2 folding register-archive turns into
> general-SFT so the pool carries voice, not just the move; (3) span-gating
> (frontier writes the turn; mini rewrites only the warrant-demand
> sentences — seam shrinks from turn to sentence). Standing order rule
> regardless: the mini writes last in its spans, never the reverse (repair
> regression, §6.18).

---

## H4 (2026-07-18) — Protected-span polish: frontier composes around the mini's demand sentence

status: pending
rationale: user-proposed refinement ("the frontier model gets to update that
draft — polish it, without compromising its initial stance"). Supersedes
H3's escalation-ladder placement of span-gating; H3's seam review remains but
applies to whichever coupling mode is live.

The repair-regression rule ("mini writes last, never the reverse") refines
on inspection. The measured regression damaged **voice** — uncheckable, so it
shipped blind. Frontier-polish-after-mini risks **form/stance** — largely
checkable, deterministically, per emission. Refined rule: *fluency may write
last only inside a cage that form owns.* Design, using in-stack parts:

> **Coupling mode 3 — protected-span composition (revision 2026-07-18).**
> At a trigger turn the mini produces the load-bearing sentence(s) — the
> warrant demand itself — not a full turn. The frontier composes the turn
> around that span verbatim (the inverse of V53's compiled-entry, whose
> embedding mechanism passed its home cell; what failed there was
> hand-compilation across worlds, here replaced by the trained mini). The
> composed turn re-runs the full deterministic battery fail-closed: protected
> span verbatim, exactly one question, warrant cue, premise lexicons, guards.
> Any trip → deliver the mini's own unpolished turn (the polish can only
> improve on a floor it cannot lower). Residual stance risk is pragmatic
> cancellation by the incumbent (hedging/apologizing/paraphrase-supplying
> around an intact span — form checks are necessary, not sufficient):
> mitigate with the de-substitution arc's semantic-release classifier
> (premise-smuggling) plus a small judge-based demand-intact criterion,
> flagged as judge-based. The polish instruction itself is episodic advice to
> the incumbent — best-effort only; the checks are load-bearing.
>
> Hygiene: polish is Phase 5 production architecture only. Phase 4's offline
> H-W verdict grades RAW mini output. Cost: one extra frontier call on
> trigger turns (~31% in the trap population).
>
> Comparative anatomy of the three coupling modes, for the Phase 5 choice:
> routing = mini's structure, mini's voice (seam risk); span-gating =
> frontier's structure, demand grafted on; protected-span polish = the move
> as the turn's spine, frontier as its voice — the demand organizes the turn,
> which for a trigger turn is arguably the correct anatomy, not a compromise.

---

## Context for the executing thread

- Theory note (rationale for both items, plus the two-superego reframe and
  the character-not-preconscious correction):
  `notes/program-2/2026-07-18-dispositional-executive.md` (§§1–8).
- This thread deliberately did NOT touch `PROGRAM-2-FINETUNE-PLAN.md` — it
  holds your uncommitted model-selection revision — nor
  `scripts/program2-floor-grader.mjs`.
- The Phase 2 prereg freeze must carry: per-variant request shapes (frozen
  flattening template), per-variant training order and licensing, per-variant
  floors, and the cross-variant decision grammar above.
