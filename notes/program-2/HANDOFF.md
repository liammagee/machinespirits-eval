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

status: done (integrated e9a513a3, 2026-07-18: plan §8 coupling-modes block, §7 ladder supersession + refined order rule, revision log)
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

## H5 (2026-07-18) — Sequencing: offline coupling-mode bake-off before any live run

status: done (integrated e9a513a3, 2026-07-18: plan §8 staged-comparison block, revision log)
rationale: user ("at any rate we can compare all these variants") + the
ablation-creep rule applied to architectures.

All variants are commensurable by construction (same frozen graders). Keep
the comparison staged: (1) Phase 4 answers the gating question only — does
the disposition train (two arms, raw mini output). (2) Conditional on a
pass, compare the three coupling modes (routing / span-gating /
protected-span polish) OFFLINE on the same held-out moments — mini output
plus frontier composition where applicable, deterministic grading + H3 seam
review; a handful of frontier calls, no live dialogues. (3) Only the winning
mode goes to live Phase 5. Argument narrows, offline ranks, live spends on
one candidate.

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

---

## H6 (2026-07-21) — Phase 5c cross-world dialogues BEGIN

status: live (executing thread)

Phase 5c (cross-world transfer probe, prereg frozen at 4bb1253f) paid
dialogues begin 2026-07-21: 18 dialogues (10 committee-v2 + 8 fresh
silent controls) on world_027_gazette_recall, pinned runtime e9b01bdd
(91b8a50e lineage), plan/stub seed 20260721. Pre-launch gates all passed:
zero-model gate (18 jobs), ollama preflight (program2-sft-instruct-v2),
sonnet + terra one-call probes, and the §4 paid smoke (smoke-01 sealed:
4 committee moments, 2 composed + 2 sampled-rescue, coherent gazette-
costume spans, zero serving errors — GO). This run reads NOTHING in
~/.machinespirits-data/program-2/adapters/ (the KTO session owns it) and
uses no KTO artifact regardless of mid-run availability (prereg §2).
Seal note follows when 18/18 are sealed.

---

## H7 (2026-07-21) — Paper fold + adaptation-architecture offshoot branch

status: live (writing thread)

New branch `claude/program-2-adaptation-offshoot` (from
`claude/program-2-phase5-live-pilot`) carries the Phase 5/5b paper fold
into `docs/research/paper-full-2.0.md` plus a subordinate design document
(`docs/research/committee-architecture.md`) and the offshoot basis note
(`notes/program-2/2026-07-21-adaptation-architecture-offshoot.md`).
Scope: paper fold + subordinate doc ONLY — no runs, no model changes;
never touches `~/.machinespirits-data/program-2/adapters/`. KTO and 5c
are NOT folded (in flight; they get their own fold when sealed).

---

## H8 (2026-07-21) — Phase 5c dialogues SEALED

status: done (executing thread; results committed with this entry)

Phase 5c sealed 2026-07-21: 17/18 (9 committee-v2 + 8 fresh controls on
world_027_gazette_recall), 1 attrition (p5c-14, deterministic auto-learner
budget overflow both attempts — first attrition in the program), no abort.
E1c PASS: 0.508 vs 0.306, diff +0.202, CI [0.072, 0.338] — the
Marrick-trained artifact beats the frontier on a world it never saw,
unchanged. Costume leak ZERO over all 61 delivered committee units
(control base rate 4x generic "fair"). Seam PARITY (0.515); safety PASS
(0.89 vs 0.88 — no turn-9 analogue here, confirming 5b's anatomy as a
Marrick world property); coverage guardrail FAIL by point estimate
(−0.061 vs −0.05, CI spans zero) — caveat carried, not excused. Archive:
~/.machinespirits-data/program-2/phase5c-live; manifest
program-2-phase5c.manifest.json; addendum in the 5c prereg §9. The
adapters store was never read or written by this run.

---

## H9 (2026-07-21) — Terra cross-family composer probe (offline, exploratory)

status: live (executing thread)

New branch `claude/program-2-terra-composer-probe` (from the offshoot
branch head, post-5c-seal). Scope: the OFFLINE terra flip only — re-run
the Phase 4 coupling probe on the same archived 58 held-out moments with
the composer swapped to `codex.gpt-5.6-terra` (~58 terra CLI calls; no
dialogues, no seams, no ollama, no model changes; never touches
`~/.machinespirits-data/program-2/adapters/`). Machinery:
`program2-coupling-probe.mjs` gains `--composer` (default preserved:
byte-identical sonnet behavior), additive per-row span/rawComposed
fields, and append-mode resume; new deterministic comparator
`program2-terra-probe-analyze.mjs`. Pipeline fidelity validated at zero
cost before launch: mini-solo regrade 0.414, sonnet delivered regrade
0.293, fail-closed union 0.448 with 2 rescued — all byte-exact against
the phase4 manifest. Output:
`~/.machinespirits-data/program-2/floor/coupling-probe-terra-delivered.jsonl`
(new file; pinned Phase 4 artifacts untouched). Exploratory tier —
descriptive numbers only, no prereg bar, nothing folds to the paper
without its own pass. Results note follows.

H9 results (2026-07-21, same day — probe sealed): 58/58, zero errors.
Family-invariant at the audited letter: terra delivered 0.293 /
fail-closed 0.448 / 2 rescued — identical to the sonnet references, with
56/58 per-moment verdict agreement (one flip each way). Decomposition:
zero composer-added questions in EITHER family (all one-question failures
span-borne); the composed-alone penalty is span extraction dropping the
mini's cue-bearing statement sentences (cue failures 6 mini → 22 both
families; 20 droppable; each composer restored it in only 3). Terra held
verbatim containment slightly better (1 span_lost vs 3). Flags: §6.20's
"frontier re-added extra questions" clause is not supported by this
decomposition (erratum-track, with the §6.19-mislabel note); lever =
cue-preserving span extraction v2 (13 cue-only composed failures per
family). Note: notes/program-2/2026-07-21-terra-composer-probe.md.
Status → done. Composer seat measured fungible offline; a live half-flip
remains the open question and is NOT licensed by this probe.

H9 addendum (2026-07-21, later same day): span-extraction v2 leg SEALED
(~110 calls, both families). Cue-preserving extraction converts the full
lever: delivered 0.293 → 0.586 (sonnet) / 0.603 (terra); fail-closed
0.448 → same; rescued 2 → 10/11; 77–79% of the achievable ceiling; the
residual failures are premise/guards (extraction-independent).
Family-invariance holds (55/58 agreement). New asymmetry: sonnet adds a
second question in 3/53 v2 composed turns, terra 0/54 — the §6.20
"re-added extra questions" erratum needs both halves. Live machinery
untouched; v2 adoption live = separate decision. Details in the probe
note's addendum.
