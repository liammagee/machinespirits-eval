# The Committee Architecture as an Adaptation Mechanism

**Status.** Design and synthesis document, subordinate to the main paper
(`paper-full-2.0.md`, v3.0.224). It introduces **no original empirical
claims**: every number below traces to a cited section of the main paper
(§6.18–§6.22, §7.11–§7.12), and design facts trace to the Program-2
pre-registrations at the repository root
(`PROGRAM-2-PHASE5-LIVE-PILOT-PREREGISTRATION.md`,
`PROGRAM-2-PHASE5B-FALLBACK-BATTERY-PREREGISTRATION.md`, and their
parents). Basis note:
`notes/program-2/2026-07-21-adaptation-architecture-offshoot.md`. Where a
design decision or plan is described that has not run, it is labeled as
such. Nothing here upgrades any claim tier: the evidence base is
exploratory and development-tier throughout (§6.20–§6.21), and this
document inherits those limits wholesale.

**One-paragraph summary.** The Program-2 committee is a small assembly:
a frozen deterministic detector watches the dialogue for a named learner
state; when it fires, a small fine-tuned specialist writes the
load-bearing sentence; a frontier model composes the visible turn around
that sentence verbatim; a deterministic battery checks the result before
delivery; and any failure falls closed to the specialist's own reply.
Across four pre-registered runs and two offline probes (§6.20–§6.22)
this assembly went from an offline gain that vanished live, to a live
pass, to an unchanged-artifact transfer pass on a second world — the
live flip achieved by changing neither model nor prompt, only by
extending the battery over the one delivered text path it did not yet
cover — and its composer seat measured family-invariant. The generalization this document
develops: in this architecture, adaptation is a property of the routing
and the checks, not of any single model, and the reliable way to improve
it is to find the surface the checker does not reach and extend the
check.

---

## 1. Why a committee: weights versus harness

The adaptation programme that precedes Program-2 closed on a consolidated
negative (§7.12): every intervention that *delivered information* to the
tutor — standing advice in the prompt, curated coaching, advice at the
exact moment of action — failed to change behaviour, while the one
intervention that *enforced* behaviour changed it by taking the behaviour
away from the model, at a measured price (the compiled-constraint arm
moved macro compliance by +0.452 and +0.420 across the two tutor
families, and paid roughly 0.13 of proof-DAG coverage at the fixed
horizon; §6.18 addendum). The programme's summary law: instructions
converge on what the model already does, and only new signal accumulates
(§7.11).

Program-2 asked the one question that record could not answer: whether
the gap is a context-versus-weights boundary — whether a model *trained*
on the apparatus's own audit-labeled moments does what a model *told*
about them would not (§6.20). The answer was partial and instructive.
Training the warrant move into a 9B instruct model moved the trained
component strongly (warrant-cue failures fell 19→6 on held-out moments)
and the overall rate by +0.103 against its floor (0.414 vs 0.310), under
the frozen bar of 0.460: real parametric traction, short of the bar
(§6.20). Every subsequent gain came from the harness around that frozen
artifact — selection between drafts, resampling, trimming, and the
placement of checks (§6.21). The weights supplied a capability the
frontier lacked at these moments; the harness made it deliverable.

The two conditional KTO runs have since been spent, and the outcome is
recorded in the paper: behaviorally inert — held-out generations
byte-identical to SFT in both arms, every gate landing exactly where SFT
left it (§6.20 status note; §6.21 status note). Their design role was:
SFT trained on the audit-passing half of the extraction; KTO was the
complementary move using the audit-failing drafts as unpaired negatives —
pushing the specialist's *first* drafts toward deliverable form so that
the harness's rescues become a second line rather than the working
mechanism. The recorded result is that the unpaired audit labels supply
almost no gradient the SFT policies do not already fit (§6.20): the
weights story ends at SFT, the Phase-2 training ledger is fully spent,
and the Phase-4 SFT artifact is the programme's final trained
specialist. Everything after SFT — the live pass, the cross-world
transfer, the extraction fix — is harness.

## 2. Adaptation is a system property: routing, not a smarter model

The programme's null results share one shape: they told a frontier model
things it could already infer. Theory-of-mind layers, externalised state
machines, and coaching all re-described the visible page (§7.12; the
sensor closure of §6.19 removed the complementary hope that better
*observation* was the missing piece — on that apparatus nothing was
concealed). The committee departs from that pattern by not trying to
make any model smarter. It distributes the work:

- **The adaptive organ is the detector.** A frozen deterministic trigger
  (the warrant-skip rule of the §6.18-addendum apparatus) decides *when*
  the committee convenes. Behaviour varies with the learner because this
  routing is learner-conditional: a learner who skips proof obligations
  trips the trigger and gets a committee-governed turn; a learner who
  does not gets the frontier model unmodified. In the live runs this
  conditionality is visible as opportunity counts per arm (75 and 81
  warrant opportunities in the pilot; §6.21).
- **The reliable organ is the specialist plus its checks.** The tuned
  mini carries the trained form (the cue component transferred live at
  +0.165 over control; §6.21); the battery guarantees the delivered turn
  keeps it.
- **The fluent organ is the frontier model.** Composition and every
  untriggered turn stay with it, which is why the seam stayed at or
  under the frozen detection bar in both live runs (0.500, then 0.600,
  bar ≤ 0.65; §6.21).

On this reading, "the tutor adapts to the learner" decomposes into
"deterministic triggers fire on learner-conditional evidence, and
routing changes who writes what." Widening adaptation means widening the
trigger vocabulary — more named moves, each with its own dumb check —
not deepening any model. That is also why the architecture's failures
are legible: each organ fails in its own way, and the component
decomposition of §6.21 could locate a live loss to a single path.

## 3. The architecture, with the frozen mechanics

The mechanics below are the ones the live runs actually froze (§6.21;
operational detail in the Phase 5/5b pre-registrations §2).

```
learner turn arrives
        |
        v
  detector: frozen deterministic trigger rules
        |                               |
        | trigger fired                 | no trigger
        v                               v
  specialist (tuned 9B instruct   frontier model writes the
  mini, greedy, frozen serving    turn as usual
  pin) writes a full reply
        |
        v
  span extraction: the reply's question sentence(s),
  probe-identical rule
        |
        v
  composition: frontier receives its normal speaking
  prompt plus a block requiring the span verbatim as the
  turn's only question, no new case facts, scene voice
        |
        v
  battery (fail-closed, pre-delivery):
    non-empty composed text
    AND span contained verbatim (whitespace-normalized)
    AND exactly one question mark in the turn
        |                               |
        | pass                          | fail
        v                               v
  deliver the composed turn       fallback chain (v2, Phase 5b):
                                    1. greedy mini reply, if it passes
                                       [exactly one question AND cue]
                                    2. else resample the mini up to
                                       twice (temperature 0.35), ship
                                       the first passing sample
                                    3. else trim the greedy reply to a
                                       single cue-preserving question
        |
        v
  standard delivery guards and repair machinery,
  identical in every arm
```

Five design properties carry the weight:

1. **The specialist owns the load-bearing span, not the turn.** The
   frontier writes everything else. This is what kept the seam invisible
   (detection at chance in the pilot; §6.21) while still delivering the
   trained form.
2. **Verbatim containment is checked, not trusted.** The composed turn
   must contain the span exactly; composed-alone graded below the mini
   solo (0.293 vs 0.414, §6.20), and §6.22's decomposition located that
   penalty in the harness's own span extraction (dropped cue sentences;
   zero composer-added questions in either family) — the checks, not the
   instruction, carry the design, and the checks also caught the
   harness's own defect.
3. **The battery is deterministic and runs before delivery.** No judge
   model, no drift, no post-hoc scoring: the same class of check that
   produced the training labels gates the live turn.
4. **Failure falls closed to the specialist.** The system is never worse
   than the mini's own reply by construction (§6.20), and after Phase 5b
   the fallback itself is checked and repaired (resample, then trim)
   rather than shipped raw (§6.21).
5. **Everything downstream is arm-identical.** Delivery guards and
   repair machinery do not know the committee exists, which is what
   makes the arms comparable and the seam measurable.

The version that failed live (Phase 5) differed from the version that
passed (Phase 5b) in exactly one box of the diagram: the fallback chain.
In Phase 5 a battery failure shipped the greedy mini reply unchecked;
in Phase 5b the same fail-closed logic was extended over that path
(§6.21).

## 4. The evidence at a glance

All verdicts and numbers below are stated in the cited paper sections;
this table only arranges them.

| Run | What it tested | Headline verdict | Key numbers | Where |
|---|---|---|---|---|
| Phase 4 (offline) | Does the warrant move train into small-model weights, and does the alignment layer help or hinder? | Partial parametric traction; no frozen gate passed; iron-cage reading inverted | Instruct 0.414 vs floor 0.310 (+0.103, CI [−0.017, +0.224], bar 0.460); cue failures 19→6; base sibling flat at 0.103 with conduct collapsed (guard-pass 0.52→0.19) | §6.20 |
| Phase 4 coupling probe (offline, pre-registered amendment) | Is the mini–frontier complementarity exploitable? | Fail-closed composition beats both members | Composed-alone 0.293; fail-closed system 0.448; frontier live reference at the same moments 0.276 | §6.20 |
| Phase 5 (live, 24 dialogues) | Does the offline gain survive live coupling, and at what coverage/seam cost? | E1 FAIL; loss located to the one unchecked text path | +0.040, CI [−0.054, +0.133]; cue component +0.165, one-question −0.218; 24/75 moments shipped `fallback_multi_question`; coverage −0.014 (no tax signal); seam 0.500 (bar ≤ 0.65); safety identical (0.58 = 0.58) | §6.21 |
| Phase 5b (live, 18 dialogues) | Is the unchecked fallback the loss? Same battery, extended over that path | E1b PASS; the moved component is exactly the targeted one | 0.386 vs 0.150, +0.236, CI [0.128, 0.354]; one-question 0.720→0.976 (frontier's own rate 0.938); other components unmoved; coverage within margin (0.611 vs 0.639); seam 0.600 ≤ 0.65; safety guardrail formal FAIL (0.42 vs 0.61) with turn-9 release-schedule anatomy present in all arms of both runs | §6.21 |
| Phase 5c (live, 18 dialogues, transfer world) | Does the validated system transfer across costume, unchanged? | E1c PASS (coverage-caveated); costume leak zero | 0.508 vs 0.306, +0.202, CI [0.072, 0.338], above the home-world rate; costume-leak 0 across all 61 committee units; seam 0.515 ≤ 0.65; safety 0.89 vs 0.88 (no turn-9 analogue); coverage@16 formal FAIL by point estimate (−0.061 vs −0.05, CI spans zero at n=9) | §6.21 |
| Offline follow-up probes (post-hoc, no prereg) | Is the composer seat family-bound, and what does composition lose? | Family-invariant; the composed-alone penalty was the harness's own extraction; the v2 fix converts it fully | v1: delivered 0.293 and fail-closed 0.448 identical in both families, 56/58 same verdicts, zero composer-added questions; v2 (cue-preserving extraction): 0.586 sonnet / 0.603 terra, rescued 2 → 10/11, 77–79% of the offline achievable ceiling | §6.22 |

Two features of this record matter for the design argument. First, the
between-run difference is *pure harness*: same weights, same prompts,
same world, same detector — only the fallback policy changed, and only
the component that policy targets moved (§6.21). Second, the costs the
architecture was expected to pay did not appear: no enforcement-scale
coverage tax in either home-world run (against the ~0.13 reference of the
§6.18-addendum compiled arm), and no visible seam at the frozen bar
(§6.21). The one formal guardrail failure (Phase 5b hard-safety) carries
an anatomy pointing at the world's turn-9 release staging rather than at
the committee — the identical signature appears in the control arms of
both runs, and 4 of the 5 leaky committee turns were frontier-authored
(§6.21).

## 5. The design law: the leak is where the checker is not

Phase 5's contribution was not the null; it was the localization. The
trained form arrived live (+0.165 on the cue component) and the verdict
still failed, because a conjunction rule loses to its weakest conjunct
and the weakest conjunct (−0.218 on question discipline) sat on the one
delivered-text path with no check on it (§6.21). Phase 5b then behaved
like a controlled test of the localization: extend the same battery over
that path, and that component alone moves — 0.720 → 0.976, ending above
the frontier's own rate — flipping the verdict (§6.21).

Stated as a working law for this class of system: **residual failures
concentrate on whatever delivered-text surface lacks a check, and the
highest-value iteration is to find that surface and extend the battery
over it.** The law has a destructive twin in the earlier record: §6.18's
first-draft series found that model-owned text could not hold checkable
form, and §7.11 states the general substitution. What the live pair adds
is the constructive direction — harness-owned checks govern system
behaviour so tightly that moving a check moves the verdict, with
everything else frozen.

Three practical corollaries the record already illustrates:

- **Audit the components, not just the endpoint.** The pilot's
  endpoint (+0.040, not significant) was uninformative alone; the
  component decomposition made the next move obvious and cheap (§6.21).
- **Treat every delivery path as a first-class surface.** The fallback
  path was an afterthought — the "safe" branch — and that is exactly
  where the loss pooled (§6.21).
- **Checks are cheaper than models.** The fix that flipped the verdict
  involved no training, no new model, and no prompt change (§6.21).

## 6. Discipline as the enabling condition: the iron cage inverted, twice

Weber's iron cage — discipline as the enemy of spontaneity — is the
background worry for any architecture this rule-bound. The record
inverts it at both scales.

**Below, in the weights.** The two-arm Phase 4 design trained the same
data into an instruct model and its base sibling. The skill trained into
both (the cue moved in both arms); what differed was everything around
it: the base arm's conduct collapsed (guard-pass 0.52→0.19, leaks past
tolerance) while the instruct arm integrated the new move with conduct
broadly intact. The incumbent alignment layer is not the obstacle to the
new norm; it is the scaffold that lets the norm integrate (§6.20).

**Above, in the harness.** The deterministic battery is what lets
fluency serve form live. With the battery closed over every delivered
text, the committee's compliance beat the frontier's while proof-DAG
coverage stayed within its frozen margin in both runs and the seam
stayed at or under the bar (§6.21) — the checks did not make the
dialogue detectably stilted, and they did not starve the syllabus. The
enforcement-scale tax that motivated the worry (~0.13 coverage, §6.18
addendum) belongs to *turn-level* enforcement; span-level ownership with
fail-closed checks did not reproduce it (§6.21).

Both inversions say the same thing at different scales: in this record,
discipline is not the price of responsiveness; it is the condition under
which responsiveness survives contact with the audit.

## 7. The exhaust loop

The committee's checks do double duty. At delivery time they gate turns;
at collection time they label them. Every live committee moment is
sealed with its full anatomy — the mini's text, the extracted span, the
composed turn, each battery verdict, the chosen source, and the
downstream compliance components (Phase 5 prereg §2) — so a completed
run is also a labeled dataset of the system's own deployment
distribution, failures included, with no human labeling and no judge
model to drift.

That closes a loop with the training side. Phase 4 trained on audit
exhaust from earlier sealed runs (§6.20); the live runs generate new
exhaust under the deployed policy — the distribution the specialist
actually faces, including the moments where it was rescued by resample
or trim (the Phase 5b ledger: 19 resample rescues, 8 trims, 4 greedy
passes, 1 unchanged; §6.21). Retraining on one's own deployment
distribution with expert-labeled corrections is the shape of DAgger
(dataset aggregation) from imitation learning; here the "expert" is the
deterministic battery, which is exactly what makes the loop safe to
iterate — the label source cannot drift, because it is frozen code. An
extraction pass over the sealed live runs already exists as machinery
(`scripts/program2-extract-live-moments.mjs`; inventory in the basis
note), and the checks themselves derive mechanically from the world
specification (the world-derived lexicon machinery of §6.21's
exploratory rescore came from the same source). The recipe, stated as
design: specification → checks → exhaust → specialist → deployment →
better exhaust. No step requires a human rater or a judged rubric.

This loop, not any single training run, is the adaptation engine of the
architecture. The models inside it are replaceable; the loop's assets —
the world specification, the check battery, and the accumulated labeled
exhaust — are the durable curriculum-specific capital.

## 8. A lifecycle: fine-tune per curriculum

The record now supports (as a design pattern, not a validated product
recipe) a per-curriculum lifecycle in six steps. Costs are quoted where
the paper measured them; budget bounds are quoted from the
pre-registrations that declared them.

1. **Author the curriculum machine-checkable.** The world file is the
   examiner: premises, release schedule, and evidence vocabulary are
   explicit, so audits derive from the specification rather than from
   judgment. (This is the property the whole Program-2 chain leaned on;
   §6.20–§6.21.)
2. **Name the must-not-fumble moves, one dumb check each.** A move is
   committee-eligible exactly when a deterministic check can recognize
   it (the warrant demand's check: one question, cue present, no new
   premise; §6.21). Moves that cannot be checked deterministically stay
   with the frontier model — the committee has nothing to offer them.
3. **Generate exhaust by running the curriculum under coaching.** The
   Phase 4 training set was harvested from sealed coached runs (865
   audit-passing turns; §6.20). The scale that produced it was an
   ordinary evening of subscription quota (basis note; the paper's
   claim is only the dataset size).
4. **Train the small aligned model.** One LoRA run on a rented H100 cost
   roughly US$8 (§6.20). Train the instruct sibling, always: the base
   sibling took the skill but shed the conduct (§6.20).
5. **Wire the committee and run one frozen-bar pilot.** The live
   template exists: compliance CI above zero, coverage within its
   margin, seam at or under 0.65, safety non-inferiority — with the
   battery covering *every* delivered path from day one (the Phase 5
   lesson; §6.21). The pre-registered call budgets for the two live runs
   were of order a thousand frontier calls each (Phase 5 prereg §6; 5b
   prereg §7).
6. **Leave the exhaust loop on.** Deployment keeps labeling its own
   moments (§7 above), so the specialist can be retrained on its
   deployment distribution when drift or a new failure surface appears.

The curriculum artifact this produces is a bundle: the world file, the
check battery, the adapter weights, and the validation certificate (the
sealed pilot). The frontier model is deliberately a commodity in this
picture — it is rented fluency around owned, checkable moves.

## 9. The move library and validation-gated reuse

The warrant demand is not a fact about one detective world: asking for
the ground of an asserted claim is Toulmin-general. The library this
suggests is indexed by **move**, not by curriculum — each entry a
trigger rule, a check battery, and one or more trained adapters with
their validation certificates.

The reuse policy that keeps the library from outrunning its evidence:
**validation is always mandatory; training is only on failure.** A new
curriculum first runs the library's candidate adapter through step 5
alone (a frozen-bar pilot on the new world, no training). A pass puts
the existing adapter into service there; a fail triggers steps 2–4 for
that curriculum. The instrument side already transfers by construction —
the trigger labels, the cue rule, the one-question check, and the
release checks are world-independent code paths parameterized by each
world's specification (§6.21's machinery; the world-lexicon derivation
demonstrated the parameterization in its exploratory rescore).

The open question is whether the *weights* transfer: whether the trained
form is the move or the costume. The generalization ladder, stated as
design: one-world specialist (the trained state; its first per-world
validation passed without retraining — §10) → pooled multi-world
exhaust → held-out-world validation. Each rung is a pilot with the same
frozen shape.

## 10. The first transfer test: cross-world validation (Phase 5c — run and passed)

The first rung of that ladder has now run and sealed (§6.21): the
unchanged Phase-5b-validated mini — same artifact, same serving pin,
fallback policy v2, an explicit no-KTO clause — moved to a
maximum-costume-distance sibling world selected under a frozen rule,
against the new world's own fresh controls, with the frozen audit
unchanged and one new pre-registered descriptive metric, costume leak
(home-world lexicon words surfacing in mini-authored delivered text, via
the mechanical lexicon diff). The pass row applied, coverage-caveated:
compliance 0.508 vs 0.306 (+0.202, CI [0.072, 0.338]) — above the
committee's home-world rate — with the costume-leak metric reading zero
across all 61 delivered committee units, seam and safety within bars,
and the coverage guardrail formally failing by point estimate (−0.061
vs the −0.05 margin, interval spanning zero at n = 9), carried as a
caveat. The reuse policy of §9 is therefore live at exploratory tier:
the first validation of a new world cost no training at all (§6.21).

## 11. Bounds

Stated once, plainly, and inherited by every section above:

- **Deterministically checkable properties only.** The committee governs
  the letter of a move, not its spirit. The exploratory lexicon rescore
  of §6.21 is the standing reminder: under a relaxed, world-derived cue
  rule the *control* arm scored higher (0.469 vs 0.320) — the frontier's
  natural questioning outruns the frozen six-word instrument, and the
  committee's licensed edge is specifically the trained six-word form.
  Choosing the check is choosing what counts; check choice is a value
  choice, made visible here by having two rules to compare.
- **Distillation, not creation.** The pipeline moves existing capability
  into reliable, owned, checkable form. Nothing in the record shows it
  creating capability the frontier lacks in substance — it shows it
  winning on the audited form (§6.20–§6.21).
- **Evidence width.** One move (the warrant demand), one world in the
  live record, one tutor family, twelve committee dialogues per live
  run, exploratory tier under both pre-registrations, development-tier
  throughout (§6.21). The Phase 5b safety guardrail formally failed,
  with its anatomy pointing at the world's turn-9 release staging
  (§6.21) — a successor item for the world file, and a reminder that
  formal verdicts are reported as the frozen rules require, not as the
  anatomy might excuse.
- **Untested surfaces.** Multi-move crowding (several specialists
  contending for the same turn) remains unmeasured. KTO's contribution is
  now measured and null — held-out generations byte-identical to SFT at
  the frozen conditional recipe, both arms (§6.20 status note).
  Cross-family dependence is now measured on the composer seat only —
  family-invariant offline across two frontier families (§6.22) — while
  live family dynamics (a second family's own tutor floor, trigger
  density, learner response) remain unmeasured by explicit decision.
  Cross-world transfer passed its
  first test without retraining (§10 above; §6.21).
- **No human-learning claim.** Simulated learners throughout, inherited
  from the whole programme (§8.1 of the main paper names human
  validation as the binding external limitation).

---

*Document provenance: drafted 2026-07-21 on branch
`claude/program-2-adaptation-offshoot` alongside the §6.21 fold (paper
v3.0.221). Maintained under the paper-authoring discipline: any new
number must land in `paper-full-2.0.md` first and be cited here by
section.*
