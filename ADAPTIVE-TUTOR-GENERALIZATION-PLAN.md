# Adaptive-Tutor Generalization Plan

*Drafted 2026-06-13. Builds on `ADAPTIVE-TUTOR-BOUNDARY-PLAN.md` (E0–E5) and the
E2 pacing-guard fan. Lands, if run, in §6.13 of `docs/research/paper-full-2.0.md` —
no spin-off paper, no new instrument.*

## What this is

The derivation arc produced one clean positive result and a good measuring
apparatus. This plan is about turning that into something that travels — at the
margins, under stated limits — rather than running the next variant on the same
world. It is a **consolidation** plan, not an ablation sweep: three moves, each
chosen to close a specific gap between "a result on one toy world" and "a
mechanism we can state."

It does **not** authorize any paid spend. Each paid gate below is sanctioned
separately, before its first paid arm, under the same meterless-quota discipline
as the boundary plan (serialized, attended, no re-rolls; the learner stays pinned
to claude/sonnet).

## The result this stands on

On `world-002-lantern`, with the decay seed fixed (`seed:1`) and the same
verdict classifier scoring every arm, a single flag — `--pacing-guard` — that
forces the tutor to release each exhibit on its scheduled turn moved the
grounding outcome from the unguarded **4/10** (the frozen E2 fans, CP95
[0.122, 0.738]) to a higher guard-on point estimate (the E2-guard fan,
**4/5 = 0.80**, CP95 [0.284, 0.995], Fisher p = 0.18) — **directional** under the
pre-registered bands, not a converged rate (the interval still overlaps the
unguarded base, and the one death came first, so the 5/5 convergence band was
unreachable). The point estimate moves the right way; the synthesis below tests
*why*.

Two properties make this cleaner than the program's earlier "architecture beats
baseline" claims, all of which came back null:

1. **The guard computes hidden state.** Its safe-release window is derived from
   the decay arithmetic (decay visibility is `CONDUCT` — the slippage is *not*
   printed in the transcript; the tutor must read it off the learner) and from
   the derivation distance `D` (computed off the proof DAG, not visible as text).
   The guard adds signal the base model cannot infer from the dialogue.
2. **The scorer is architecture-independent.** `diagnose.js` produces the verdict
   from the proof state; it does not know whether the guard was on. Frozen and
   guarded arms are scored by the same channel.

Those are exactly the two properties the recurring nulls (ontology ToM layer,
stall-watcher, adaptive-persona, repertoire ceiling) lacked — each of those
re-encoded what the model already inferred from context. So the lantern result is
a candidate *exception* to the program-wide pattern, and the first job is to find
out whether it really is one.

## The gap

Everything rides on one hand-authored proof structure (lantern: a single ~4-rule
chain, `bearing → lamp/tower → hand/key → light`, shadowed by a decoy chain that
yields a near-miss false secret). The verdict is **formal** — "the chain closed in
the transcript," not "a mind learned." And the one quantity we tried to turn into
a rate is noisy: the frozen replication pooled to 4/10 and *diverged* across its
two fans (0.60 then 0.20). So the demonstrated claim is narrow: *on this one
world, forcing on-time release improves derivation, and we can read why.*

The three steps below each attack one face of that gap. None of them tries to lift
the formal-vs-real limit — this apparatus measures derivation **form**, and the
recognition-transfer work already showed it does not carry a mentalistic load
(weighted κ ≈ 0.04). The generalization on offer is about the adaptive
**mechanism**, not about real learning. That boundary is deliberate and stays
stated.

---

## Step 1 — The hidden-signal contrast *(the synthesis; paid)*

**Claim under test.** Adaptive gains come from injecting signal the base model
cannot infer from the dialogue, *not* from re-representing what it already infers.
If true, a guard that shapes release from **hidden** state lifts grounding, while
a form-matched guard that shapes release from only **visible** transcript state
sits at the unguarded base rate.

**Design.** A three-way comparison on `world-002-lantern`, same `seed:1`, same
frozen p4 stack, scored by the same classifier:

| arm | source of the release window | status |
|---|---|---|
| baseline (no guard) | — | have it: frozen fans, 4/10 |
| **H** — hidden guard (`--pacing-guard`) | decay slippage + derivation distance `D` (both hidden) | have it: E2-guard fan |
| **V** — visible guard (new flag) | transcript-surface features only (turns since last release, whether the learner echoed/restated the prior exhibit, learner message-length / hedging trend) | **new k=5 fan** |

V is matched to H in **form** — same flag-gating, same "shape the window, don't
override," same `--release-authority` requirement, same number of decision points.
The *only* difference is the information source. V re-expresses what is already on
the page; H computes what is not.

**Engineering.** A new flag (`--pacing-guard-visible`, mutually exclusive with
`--pacing-guard`), gated in `llmRoles.js`/`pacing.js` behind a `visibleGuard`
predicate exactly as `pacingGuard` is gated, adding 0 lines to the no-guard path.
Its safety function takes only transcript-visible inputs. **Confound control:** V's
intervention frequency (window-narrowings, force-plays) must be reported alongside
H's, and tuned on a free mock pass so V narrows about as often as H — otherwise
the contrast is "V intervened more/less," not "V used worse signal."

**Pre-registered read (k=5 V-fan; CP95 verified `scipy.stats.beta.ppf`).** The
prediction is *inverted* from the guard fan — we expect V to stay low:

| V grounds | rate | CP95 | reading |
|---|---|---|---|
| ≤2/5 | ≤0.40 | [0.053, 0.853] @2/5 | V at the unguarded base rate → **hidden-signal principle supported** (if H is meanwhile above it) |
| 3/5 | 0.60 | [0.147, 0.947] | ambiguous — overlaps both baseline and H; underpowered, report as such |
| ≥4/5 | ≥0.80 | [0.284, 0.995] @4/5 | V matches H → **"structure per se helps," hidden-signal story rejected** (still a finding: the win is the scheduling discipline, not the signal) |

**Kill / scope.** One k=5 V-fan. If V and H land in the same band, the synthesis
claim is rejected and we stop — no rescue arms. No re-rolls.

**What it would let us claim.** This is the move that converts a stack of nulls
plus one positive into a single statable principle: *adaptivity comes from new
signal, not re-representation.* That claim does not depend on believing anything
about learning, and it explains the whole program in one sentence.

---

## Step 2 — One structurally different world *(generality; paid, gated on Step 1)*

**Claim under test.** The mechanism is not lantern-specific. The same
hold-to-cue → seat → ground dynamic, and the same guard lift, reproduce on a proof
structure of a *different shape*.

**Design.** Author **`world-003`** with a deliberately different DAG geometry.
Lantern is a single chain plus a decoy. The highest-value contrast for a *pacing*
mechanism is a **branching / AND-join** structure: the secret requires two
independent sub-chains (α and β) that must each ground and then converge. This
stresses the pacing problem the most — the tutor must hold *two* release schedules
to cue at once, and the corridor geometry is genuinely different, not just longer.

Then repeat the boundary→guard pipeline on it:

1. Lint world-003; re-run **E0 corridor cartography** for it (its safe corridor
   *will* differ — that is the point).
2. **Calibrate difficulty.** Confirm the unguarded baseline is non-degenerate
   (not 0/n or n/n) — otherwise floor/ceiling confounds the comparison. Tune decoy
   density / depth until the unguarded rate sits near a coin flip, matching
   lantern's regime.
3. Run the **baseline frozen fan** and the **H guard fan** on world-003.

**Pre-registered read.** Generality is claimed only if *both* hold: (a) the guard
lifts grounding above the world-003 unguarded baseline (same direction as
lantern), and (b) the failure-mode shift from Step 3 reproduces (early-reveal
deaths removed, decay-seating deaths exposed). If the guard does **not** lift on
world-003, that is a clean negative — the mechanism is shape-bound — and we report
it as the limit, not paper over it.

**Kill / scope.** Exactly **one** new world. "Travels" needs n=2 worlds (lantern +
one different shape), not a sweep. If world-003 reproduces, that is the
margin-of-generality result; if it does not, that is the boundary. Either way we
stop at one.

**Gated on Step 1.** Run only after Step 1 resolves. If Step 1 supports the
hidden-signal principle, world-003 tests its reach. If Step 1 rejects it (V ≈ H),
the framing changes — world-003 would be designed to probe "what scheduling
discipline buys," a different question — so do not author it until Step 1 lands.

---

## Step 3 — Report the failure-mode shift, not the rate *(mostly free; do first)*

**Claim under test.** The durable, generalizable observable is *which way runs
fail*, which is visible inside each single arm — far more stable than the success
rate, which needs cross-arm replication we cannot cheaply buy.

**Design.** Extend the existing E4a detector-split classifier
(`services/dramaticDerivation/boundaryClassifier.js`,
`scripts/derivation-detector-split.js`) to label every arm's outcome into a
failure-mode taxonomy read from `diagnosis.json` (release adherence + the `dCurve`
+ the verdict):

- **grounded** — chain closes, `D → 0`.
- **early-pull death** — an exhibit released ahead of cue (e.g. `p_bearing → t3`);
  learner plateaus; disengages late (~t12). The dominant frozen-fan death.
- **decay-seating death** — exhibit *held to cue* but slips before the learner
  seats it (`D` wobbles up); disengages early (~round 7). The guard-on death (the
  E2-guard r1 pattern).
- **aporia** — learner hits an impasse and cannot proceed.

Then build the **guard × failure-mode contingency table** across all arms (frozen
+ guard; both worlds, once Step 2 exists) and report the *shift* as the primary
result, with the success rate demoted to a secondary, explicitly-underpowered
figure.

**Pre-registered read.** The headline becomes "the guard removes the early-reveal
failure mode and exposes a decay-seating one" — a within-arm, replication-light
claim — rather than "the guard lifts the rate to X." This is already what the
traces show most plainly: every frozen death early-pulled `p_bearing`; the one
guard-on death held it to cue and died on seating.

**Cost.** Analysis over artifacts already on disk plus a classifier extension —
**no new paid arms.** This is why it goes first: it sharpens the metric *before*
any spend, and it is the cheapest of the three.

---

## Sequencing & sanction gating

Execution order is **3 → 1 → 2**, by cost and dependency, not by the numbering:

1. **Step 3 first (free).** Land the failure-mode metric on the artifacts we
   already have. This fixes the headline and de-risks the rest.
2. **Step 1 next (paid, one k=5 fan).** The synthesis. Needs its own sanction and
   the V-guard engineering + mock calibration before the first paid arm.
3. **Step 2 last (paid, most engineering).** Author world-003, redo corridor +
   difficulty calibration, then baseline + guard fans. Run only if Step 1 has
   resolved, with its own sanction.

Each paid gate: registration committed alone before the first paid arm (pre-tabled
CP95 + interpretation bands, like the boundary-plan registrations); arms serialized
and attended; verdicts read from source-of-truth `diagnosis.json`; no re-rolls
(crash/truncation = delete the arm dir, rerun the same label).

## What we will NOT do

- **Not** pour more paid arms into lantern chasing a tighter rate. The rate is the
  least durable thing we have (the frozen fan already showed it is noisy); more
  arms buy diminishing certainty on the wrong quantity.
- **Not** add more cells or guard variants on the existing world. Three moves,
  each closing a named gap; then stop and write.
- **Not** sweep multiple new worlds. One differently-shaped world tests travel;
  more is creep.
- **Not** try to make the formal verdict carry a learning / mind-reading load. The
  recognition transfer already failed (κ ≈ 0.04); the candid ceiling is derivation
  *form*. The generalization is about mechanism, and stays there.

## What this would and would not let us say

| limit on "limited successful tutor adaptation" (§6.13) | moved by |
|---|---|
| attribution to a stack, not a knob | **Step 1** — isolates the signal source as the active ingredient |
| lantern-specific | **Step 2** — n=2 worlds if it reproduces; a stated boundary if not |
| noisy n=1 rate | **Step 3** — shifts the headline to a stable within-arm observable |
| formal, not mentalistic | **unmoved, by design** — stated as the ceiling |
| positive path lightly exercised | partly **Step 1/2** (more grounded arms), but not the focus |

Best case across all three: *"forcing a tutor to act on state it cannot read off
the dialogue improves a formal derivation outcome, the gain is the new signal
rather than the added structure, it reproduces on a second proof shape, and it
shows up most stably as a shift in how runs fail."* That is a margin-of-generality
claim about adaptive mechanism — defensible, bounded, and folded into the one
paper.

---

## Step 1 registration — visible-guard (V) k=5 fan (2026-06-13)

Operator sanction: **"Steps 1 and 2 look fine — sanctioned to do those next."** This
is the separate pre-registration the plan requires before the first paid V arm
(§"Sequencing": *"Step 1 … needs its own sanction and the V-guard engineering + mock
calibration before the first paid arm"*). It pools **separately** from both the frozen
4/10 baseline and the E2 hidden-guard (H) fan, and is never folded into either.

**Zero-delta basis.** The arm command is the frozen p4 recipe verbatim plus exactly one
added flag, `--pacing-guard-visible` (its required companion `--release-authority` is
already in p4; the flag is mutually exclusive with `--pacing-guard` at parse time). No
other change. The guard logic lives entirely in `visiblePacing.js` + the `visibleGuard`
branches of `llmRoles.js`, all behind the `visibleGuard` predicate; the no-guard and
hidden-guard paths carry 0 added lines (verified by the import-audit test below and by
`git diff` on the no-guard path). V is the **form-match to H**: same flag-gating, same
"shape the window, don't override," same `--release-authority` requirement, same two
channels (a static system block + a per-turn note in the prompt, and a
block/force decision). The **only** difference is the information source — V reads
transcript-surface features (turns since last release, whether the learner echoed the
prior exhibit on the page, hedging/length trend); H reads the proof distance `D` and the
decay-driven stall, neither printed in the transcript.

**Audit invariant (enforced, free).** `visiblePacing.js` must not import the hidden
primitives (`slope.js`, `pacing.js`); `tests/dramaticDerivationVisiblePacing.test.js`
asserts this (test 1) and the decision logic (tests 2–7), 7/7 green. This is the
mechanical guarantee that V "sees only the page."

### The confound control, reframed (free pre-flight, done 2026-06-13)

The plan's confound control (§"Step 1 … Engineering") asked that V's intervention
frequency be *"tuned on a free mock pass so V narrows about as often as H — otherwise
the contrast is 'V intervened more/less,' not 'V used worse signal.'"* That instruction
is **degenerate as written**, and the reason is itself a finding about H:

> Across the whole E2 hidden-guard fan, **H fired 0 enforcement interventions over 87
> release decisions** (r1 disengaged t7; r2–r5 grounded t20). Zero blocks, zero
> force-plays. H's lift ran entirely through its **prompt** channel — the always-on
> static `SOLVENCY GUARD` block plus the per-turn window annotation — with the model
> *voluntarily* releasing on-cue (p_bearing t4, offset 0, where the unguarded baseline
> early-pulls t3, offset −1). H never had to override anything; it told the model what
> it could not see, and the model acted on it.

So "tune V to narrow as often as H" reduces to "tune V to a no-op," which would make the
contrast vacuous. The control's real purpose — *don't let a difference in intervention
frequency masquerade as a difference in signal quality* — is served instead by a
**counterfactual replay** of V's real decision function over the **frozen** baseline and
H transcripts (`scripts/derivation-visible-guard-calibrate.js`, $0, read-only). It
reconstructs, turn by turn, the exact `view`/`playable`/`validClaim`/`forcedPlay` the
live bridge passed the guard (mirrors `llmRoles.js:1235-1242, 1624`), calls the real
`visibleGuardDecision`, and counts where V *would* have intervened. A built-in self-check
asserts the reconstructed `playable.length` equals each frozen row's recorded
`windowSize`: **0 mismatches over all 235 decisions**, so the replay is faithful.

Result of the replay:

| group | arms | decisions | V would intervene | H enforced |
|---|---|---|---|---|
| baseline (unguarded 4/10) | 10 | 148 | 23 (blk 17 / push 6) | 0 |
| H (hidden guard) | 5 | 87 | 9 (blk 5 / push 4) | 0 |

V's enforcement propensity is ≈0.10–0.16/decision (≤4 fires per 20-turn arm),
overwhelmingly early blocks (a release declared before the learner echoed the prior
exhibit). **Crucially this is an upper bound on live-V enforcement:** those transcripts
were generated with no V-prompt steering the model. In a live V arm the model sees V's
per-turn "the page has not taken up the prior exhibit — hold" note — the same channel
through which H got voluntary compliance — so if the model trusts V's *visible* read as
it trusted H's *hidden* one, live-V's realized enforcement falls toward H's 0.

**The design decision this licenses.** Run the registered fan as the **true
architectural twin of H** — full V, enforcement channel live, exactly as `--pacing-guard`
ran with its enforcement live-but-unused. No threshold-fishing, no prompt-only crippling.
V's *realized* enforcement count in the live fan is then a reported **covariate** that
measures whether the model complies with a visible-page signal as it did with a
hidden-tempo one, and the primary read is conditioned on it (below).

### Pre-flight (free, done 2026-06-13)

- **Unit tests:** `tests/dramaticDerivationVisiblePacing.test.js` 7/7 (import-audit +
  feature + decision). Full `npm test` green (recorded in the commit).
- **Mock smoke** of the exact V command (`DERIVATION_LLM=mock`, throwaway label): runs
  end-to-end, "VISIBLE PACING GUARD ON" logged, V decision exercised (1 block, 2 pushes
  over 25 decisions), artifacts written; dir deleted.
- **Counterfactual replay:** faithful (0 window-mismatches / 235), V propensity
  ≈0.1/dec as tabled above.

### Design

k=5 exchangeable arms, decay `seed:1` fixed (same frozen seed as the baseline and H
fans — the only live variance is LLM conduct stochasticity), `world-002-lantern`,
learner pinned claude/sonnet. Labels `lantern-e2-visible-r1` … `r5`, group
`lantern-e2-visible`. `--critic off` (Fable backfill deferred, as for the other fans).
Meterless paid path → serialized, attended, no re-rolls (crash/truncation = delete the
arm dir, rerun the same label, note it).

### Pre-tabled k=5 Clopper–Pearson 95% (verified `scipy.stats.beta.ppf`)

The prediction is **inverted** from the H fan — the hidden-signal thesis predicts V stays
at the unguarded base rate while H sits above it. Fisher-exact one-sided columns: V
**above** baseline 4/10, and V **below** H 4/5.

| V grounds | rate | CP95 | Fisher vs baseline 4/10 (greater) | Fisher vs H 4/5 (V less) |
|---|---|---|---|---|
| 0/5 | 0.00 | [0.000, 0.522] | p=1.000 | p=0.024 |
| 1/5 | 0.20 | [0.005, 0.716] | p=0.916 | p=0.103 |
| 2/5 | 0.40 | [0.053, 0.853] | p=0.706 | p=0.262 |
| 3/5 | 0.60 | [0.147, 0.947] | p=0.427 | p=0.500 |
| 4/5 | 0.80 | [0.284, 0.995] | p=0.182 | p=0.778 |
| 5/5 | 1.00 | [0.478, 1.000] | p=0.042 | p=1.000 |

### Interpretation rule (pre-registered)

Read on grounding, **conditioned** on V's realized enforcement covariate:

- **≤2/5 — hidden-signal principle supported (directional at this n).** V sits at the
  unguarded base rate while H sat above it: the visible signal did not buy what the
  hidden signal did. Note the power limit honestly — V=2/5 vs H=4/5 is **not** a
  significant separation (p=0.26); the clean separation is only at V≤1/5 (V<H p≤0.10).
  The support is therefore *directional*, not converged, exactly as H's own 4/5 was.
  **Clean only if** V's realized enforcement landed in H's low regime (≈0–few): then the
  architectures and realized interventions matched and only the signal content differed.
  If V instead force-blocked heavily, down-scope to "V at baseline, but with more
  intervention than H" and do not claim the signal-source isolation.
- **3/5 — ambiguous.** Overlaps both baseline and H; underpowered; report as such, claim
  nothing.
- **≥4/5 — "structure per se helps," hidden-signal story rejected.** V matches H's point
  estimate (and separates up from baseline only at 5/5, p=0.042). Still a finding: the
  win is the scheduling discipline, not the hidden signal. Conditioned on *how* V
  grounded — via voluntary prompt compliance (realized enforcement ≈0) is the strong
  form; via heavy force-plays is the weak form and is reported as such.

### Kill / early-stop / no-re-roll

One k=5 V-fan, **no early-stop — run all five serially.** Unlike the E2 fan (one
win-band at 5/5, everything else null, so 0/3 killed it), V's outcome space is
informative across its whole range: V=2/5 vs ≤1/5 changes how clean the support read is
(only ≤1/5 separates V below H at p≤0.10), and 4/5 vs 5/5 changes whether the reject read
separates above baseline (only 5/5, p=0.042). Every arm at k=5 refines the band, so
there is no point at which a remaining arm is uninformative. No rescue arms in either
direction. No re-rolls; crash/truncation = delete the arm dir, rerun the same label, note
it in the outcome. If V and H land in the same band, the synthesis claim is rejected and
we stop — no tuning, no second fan.

---

## Step 1 outcome — V grounded 5/5 (added post-run 2026-06-13; pre-registered text above unaltered)

**Result.** The k=5 visible-guard fan **grounded 5/5** — `lantern-e2-visible-r1`–`r5`, every
arm forced-to-asserted at t20 with gap 0. This lands the pre-registered **≥4/5 → "structure
per se helps," hidden-signal story rejected** branch (§"Interpretation rule" above).

**Statistics (as pre-tabled).**
- Grounding 5/5: Clopper–Pearson 95% CI lower bound **0.478**.
- Vs unguarded baseline 4/10: **Fisher p = 0.042** — V separates *up* from baseline (the
  5/5-only separation the interpretation rule anticipated).
- V < H (5/5 vs 4/5): **Fisher p = 1.000** — V *matches* H; no separation below H. The hidden
  signal bought nothing the visible signal did not.

**Realized-enforcement covariate (the conditioning the rule requires).** V's live enforcement
landed at **7/100 decisions ≈ 0.07/decision** — five blocks + two pushes, per-arm
[3, 1, 1, 1, 1], all on the chain's release turns (t3/t4/t9). Low but **not zero** (H's was
0/87). So by the rule's own clause V grounded **predominantly** through voluntary prompt
compliance — the *strong* form — but conditioned on a small live-enforcement covariate, not
the pure zero-enforcement arm (that was H). The strong-form reading is reported with that
conditioning, not unconditionally.

**Reading recorded.** The §6.13.10 guard's lift is the **scheduling discipline**
(re-representation of what the page already carries), **not** the hidden proof-state. Both
guards eliminate the unguarded baseline's dominant early-pull death entirely (20-arm
contingency: unguarded 4 grounded / 6 early-pull / 0 decay-seating; pacing 4/0/1; visible
**5/0/0**), and the page-only guard does it from features the model already has in front of
it. This bounds — for this mechanism, in this world — the §6.13 claim that adaptive gains
come from signal the model cannot infer.

**Caveats carried (per the rule + §5.12.6).** k=5 power: "V matches H," not "beats it"
(p=1.000); V vs baseline significant only at exactly 5/5 (p=0.042). Enforcement low-not-zero
(covariate above). Visible-proxy *sufficiency* is world-specific — in world-002-lantern's
chain visible uptake tracks latent distance; a world decoupling them need not let V track H.
Scope otherwise as §6.13.10 (one world, frozen p4 stack, seed-1 conduct fan, formal verdicts).

**No re-rolls used; all five arms first-pass.** Spend meterless (Max-plan CLI), serialized at
first then — once the operator confirmed no quota constraint — fanned in parallel.

**Fable critic notice.** Each arm is registered for the standing pinned-Fable critic's notice
(`commentary.md`); the backfill is **deferred** — Fable 5 is currently unavailable
(`fable-mythos-access` gate), so the real notices land when it returns. No mock substitute
written.

**Folded into the paper** as **§6.13.11** + revision-history **v3.0.149**. Artifacts
`exports/dramatic-derivation/loop/lantern-e2-visible-r{1..5}/`; pooled contingency
`exports/dramatic-derivation/boundary-v-fan/detector-split-report.{md,json}`. **Step-1 paid
loop ended on this result.** Step 2 (branching-DAG world-003) remains human-gated under its
own fresh sanction.
