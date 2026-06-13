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

---

## Step 2 registration — world-005-marrick, three-arm fan (baseline / H / V) (2026-06-13)

Operator sanction: **"Steps 1 and 2 look fine — sanctioned to do those next."** This is the
separate pre-registration the plan requires before the first paid Step-2 arm (§"Sequencing":
*"Step 2 … with its own sanction"*). The three world-005 fans pool **separately** from each
other and from every lantern fan, and are never folded into the lantern result. *(Naming: the
plan body says "world-003"; world-003-bitterwell and world-004-withercombe already exist, so the
new branching world is realized as **`world-005-marrick`**. Same world, the plan's intended
shape.)*

### The post-Step-1 reframe (why this is the design)

Step 1 **rejected** the hidden-signal principle: the visible guard V grounded 5/5 = the hidden
guard H (§6.13.11). The lift is **scheduling discipline** — a re-representation of what the page
already carries — not a hidden proof-state the model cannot infer. Step 1 left **one explicit
open caveat** (§6.13.11, carried verbatim): *"Visible-proxy sufficiency is world-specific — in
world-002-lantern's chain visible uptake tracks latent distance; a world decoupling them need not
let V track H."*

`world-005-marrick` is built to be exactly that world. Its distinctive geometry is a true
**AND-join**: the secret `struckBy(falseShilling, x)` requires `castBlankFor(coin, x)` **and**
`cutDieFor(coin, x)` for the *same* `x` — two independent depth-2 sub-chains (the cast blank α,
the cut die β) that must each ground and then converge. On this shape the visible proxy and the
true proof-distance **come apart**: a learner who has fully seated α looks confident and
recently-echoing (V reads "seated") while the global distance `D` is still high because β is
untouched (H reads "not seated"). Lantern (a single linear chain) could not pull them apart;
world-005 is engineered to.

So Step 2's question is **no longer** "does the hidden-signal mechanism travel" — Step 1 showed
there is no special hidden mechanism. It is: *on a proof shape that decouples the visible-uptake
proxy from latent proof-distance, does the page-only guard still suffice, or does the true-state
guard pull ahead?* The plan mandated this re-framing at §"Step 2 … Gated on Step 1": *"If Step 1
rejects it (V ≈ H), the framing changes — world-003 would be designed to probe 'what scheduling
discipline buys,' a different question."* The primary read remains the **failure-mode shift**
(Step 3's instrument), with the rate secondary and explicitly underpowered.

### world-005-marrick identity + difficulty calibration (free, done — committed ce7aea8a)

- **Shape.** 5 rules, 9 premises (α: alloy→crucible→caster; β: die-flaw→graver→holder; + 3 mirror
  premises), AND-join at R5. The mirror `struckBy(falseShilling, verrell)` is blocked
  **structurally**, not by pacing: striking needs both a cast blank and a cut die bound to the
  same hand, and the coin's own marks (weir crucible, worn burin) bind both halves to `edony`;
  Verrell is the town's clipper, never a striker.
- **Lint / recognition turn.** `plotLint` PASS; S first derivable **exactly at t22** (≥ `t_min`
  20); clean D-staircase 6→5(t4)→4(t8)→3(t10, α closes)→2(t14)→1(t18)→0(t22, β closes + join).
- **Concealment.** The five concealed tokens (`edony`, `weir`, `dross`, `burin`, `notch`) appear
  only in post-release premises — never in setting, background, question, rules, or learner voice.
  24/24 world-invariant tests green (6/6 for `world_005_marrick`).
- **Difficulty (E0 corridor).** λ=0 survival **30.4%** (190/625), λ=1 30.4%, λ=2 22.4% —
  **lantern-comparable** (lantern 32% @ λ0), non-degenerate, with distributed per-decision safe
  sets and minSlack 1 (decay-sensitive). Artifact:
  `exports/dramatic-derivation/boundary-marrick/corridor-map-world-005-marrick.md`.
- **The world is FROZEN.** The corridor map **is** the difficulty calibration (the plan's
  "tune decoy density until coin-flip" step, done free before spend). The baseline fan's result is
  **accepted as-is**: a degenerate baseline (0/5 or 5/5) is a *reported confound*, **not** a
  re-tune trigger. Re-tuning the world after seeing paid results would be a garden-of-forking-paths
  violation; the world does not change after this line.

### The three-arm fan

k=5 exchangeable arms per fan, decay `seed:1` fixed (only live variance = LLM-conduct
stochasticity), learner pinned **claude/sonnet**, `--critic off` (Fable backfill deferred). Each
arm is the **same full-charter conduct stack** the lantern E2 fan ran, verbatim —
`--superego --acts '{"minActTurns":3,"maxActTurns":8}' --decay '{"rate":0.75,"graceTurns":1,`
`"maxConcurrent":2,"startTurn":1,"mutateShare":1.0,"seed":1,"pool":"staged"}' --confront`
`--repair-clause --release-authority --plot --throughline --critic-feedback off --critic off`
(rut-watcher + act pacing + staged-mutation decay hygiene §13 + repair clause §12 + re-entry
jurisdiction + two-layer planning §11.6/§14 + release authority) — with only the world swapped to
`world-005-marrick` + its tutor script. `--release-authority` is already in the stack, so the
guard arms add **exactly one flag** each — the Step-1 zero-delta basis, verbatim. Provider env
mirrors lantern (`DERIVATION_PROVIDER=codex DERIVATION_LEARNER_PROVIDER=claude
DERIVATION_LEARNER_MODEL=sonnet`); labels follow the lantern scheme (see the fan table).

| fan | flag added to the p4 stack | k | labels | what it isolates |
|---|---|---|---|---|
| **baseline** | — (no guard) | 5 | `marrick-real-r1`…`r5` | the world-005 floor (is there anything to lift on this shape?) |
| **H** — hidden guard | `--pacing-guard` | 5 | `marrick-guard-r1`…`r5` | does the §6.13.10 true-state guard travel to the AND-join? |
| **V** — visible guard | `--pacing-guard-visible` | 5 | `marrick-visible-r1`…`r5` | does the page-only proxy still suffice where the shape decouples it from `D`? |

Labels mirror lantern's `lantern-e2-{real,guard,visible}` scheme exactly (world prefix swapped,
`e2` infix dropped — `marrick-` already disambiguates). The baseline carries the `-real-` infix so
`derivation-mine-conduct.js` tags it the **real** backend; the guard/visible fans bucket as
*"unknown"* in the conduct miner (the name-guess tagger keys only on `-real-`/`lantern-p[1-5]`,
exactly as lantern's own guard/visible arms did) — that is cosmetic, because the **primary read**
runs through `derivation-detector-split.js`, whose `guardStateOf(diagnosis)` reads the guard layer
straight off each arm's recorded `diagnosis.json` flags (`pacingGuard`→`pacing`,
`visibleGuard`→`visible`, else `unguarded`), **world-agnostically**. No analysis-code change: the
contingency table is built with `--arms marrick-real-r1,…,marrick-guard-r1,…,marrick-visible-r1,…`.

**Why V is in (and is not creep).** world-005 is the **one** sanctioned new world, and its
geometry was built to decouple V from H. baseline + H alone would re-confirm "discipline travels"
but **waste the decoupling shape** — leaving the §6.13.11 caveat (the single open question Step 1
flagged) untested on the very world built to test it. The primary V-vs-H contrast is therefore the
sharpest thing this world can buy; the baseline is the shared floor both guards are read against.
*(15 paid arms total — one fan more than the plan's literal "baseline + H." A 2-arm fallback
(baseline + H, 10 arms) is available if spend must be bounded; it answers "does the mechanism
travel" but not "does the visible proxy still suffice on a decoupling shape.")*

### Engineering status (no new guard code)

- **H** is world-parametrized (`pacing.js` reads `D`/decay off the world + proof DAG) — runs on
  world-005 **unchanged**.
- **V** uses the lantern-tuned `VISIBLE_GUARD_DEFAULTS` **unchanged** (no per-world threshold
  fishing — refitting V to world-005 would forfeit the form-match to H and the Step-1 zero-delta
  basis).
- The audit invariant (`visiblePacing.js` imports no hidden primitive;
  `tests/dramaticDerivationVisiblePacing.test.js`) is unchanged and green.
- The only world-005 engineering (world YAML, tutor script, corridor `observedConduct`
  world-membership guard) is committed at **ce7aea8a**; no `services/dramaticDerivation/` change.

### Pre-flight (free, done 2026-06-13)

- **Lint / tests / corridor:** `plotLint` PASS (S@t22), 24/24 world-invariant tests (6/6 for
  `world_005_marrick`), corridor 30.4%@λ0 (lantern-comparable). lantern `--validate` **5/5** after
  the `observedConduct` edit (the guard is a no-op for lantern — its arms belong to it).
- **Mock smoke** of all three arms on world-005 (`DERIVATION_LLM=mock`, full p4 stack, throwaway
  labels, dirs deleted): **all exit 0**; "PACING GUARD ON" and "VISIBLE PACING GUARD ON" both
  logged — the world-parametrized hidden guard and the page-only visible guard each execute on the
  AND-join world. Under mock + full decay every arm ends in **disengagement** (forced/asserted
  null) — and so does the **lantern** p4 stack under the identical mock stack: the deterministic
  mock conduct is non-adaptive to decay on *both* worlds, so this confirms plumbing, not conduct
  (real adaptive LLM conduct is what the paid fan measures). No world-005-specific defect.

### Confound control (V enforcement frequency) — post-hoc on world-005, mirroring Step 1

`scripts/derivation-visible-guard-calibrate.js` hardcodes the **lantern** frozen arms
(`BASELINE_ARMS = lantern-e2-real-r1..r10`, `H_ARMS = lantern-e2-guard-r1..r5`), so it **cannot**
pre-flight world-005 — there are no frozen world-005 arms yet. The control is therefore
**post-hoc**, exactly as Step 1 measured it: after the world-005 fans land,
counterfactual-replay V's real decision function over world-005's own frozen baseline + H
transcripts (same faithful-reconstruction self-check: reconstructed `playable.length` must equal
each row's recorded `windowSize`), and report V's **realized enforcement** as a covariate
(Step-1 reference: V live 7/100 ≈ 0.07/decision; H 0/87). The V grounding read below is
**conditioned** on this covariate — a heavy-force-play V is down-scoped, exactly as in §6.13.11.

### Pre-tabled k=5 Clopper–Pearson 95% (verified `scipy.stats.beta.ppf`)

Per-fan, identical for each of baseline / H / V (k=5 is k=5):

| grounds | rate | CP95 |
|---|---|---|
| 0/5 | 0.00 | [0.000, 0.522] |
| 1/5 | 0.20 | [0.005, 0.716] |
| 2/5 | 0.40 | [0.053, 0.853] |
| 3/5 | 0.60 | [0.147, 0.947] |
| 4/5 | 0.80 | [0.284, 0.995] |
| 5/5 | 1.00 | [0.478, 1.000] |

### Achievable k=5-vs-k=5 Fisher envelope (free, verified `scipy.stats.fisher_exact`, one-sided)

Because all three world-005 fans are k=5 (unlike Step 1, where V's k=5 was tested against the
k=10 lantern baseline), the between-fan Fisher tests are **k=5-vs-k=5**, where significance is
reachable only at a **≥3-grounding gap**:

| separation | Fisher p (greater) | |
|---|---|---|
| 5/5 vs 0/5 | 0.004 | **sig** |
| 5/5 vs 1/5 | 0.024 | **sig** |
| 4/5 vs 0/5 | 0.024 | **sig** |
| 5/5 vs 2/5 | 0.083 | ns |
| 4/5 vs 1/5 | 0.103 | ns |
| 3/5 vs 0/5 | 0.083 | ns |

So the *rate* can only separate at the extremes; a real 4-vs-1 (80% vs 20%) effect still returns
p=0.10. **This is why the rate is demoted** and the within-arm failure-mode shift is the primary
read.

### Interpretation rule (pre-registered)

**Primary — failure-mode shift (E4a detector-split, per arm, pooled into the guard × failure-mode
contingency table).** Generality of the §6.13.10/.11 scheduling-discipline result is claimed iff
**both**: (a) **H** (the true-state guard) removes the unguarded baseline's dominant **early-pull
death** on world-005 — the failure-mode shift reproduces — and (b) H's grounding point-estimate
lifts **above** the world-005 baseline (directional, same sign as lantern). If neither holds, the
mechanism is **shape-bound** — a clean negative reported as the limit, not papered over.

**Secondary — V vs H on the decoupling shape (the §6.13.11 caveat, now testable):**

- **V ≈ H, both lift above baseline** → visible-proxy sufficiency **travels** even to a shape that
  decouples it from latent distance; the §6.13.11 "world-specific" caveat is **not** realized here;
  the page-only proxy is robust. Strong generality of the Step-1 reading.
- **V < H, H lifts, V flat** → the §6.13.11 caveat **realized**: on an AND-join that lets a learner
  look seated on α while β is untouched, the hidden-`D` guard pulls ahead and the visible proxy
  fails to track. This **reinstates a bounded hidden-signal advantage exactly where geometry
  predicts it** — a clean, important boundary on Step-1's "it's just scheduling discipline" reading.
- **V ≈ H ≈ baseline (neither lifts)** → scheduling discipline is shape-bound; the mechanism does
  not travel to the AND-join. Clean negative.
- **V lifts, H flat** → anomaly (visible helps where true-state does not); report as such, no
  mechanism claim.

**Rate — secondary, explicitly underpowered.** Reported with CP95 (above); between-fan Fisher
one-sided per the envelope (significant only at a ≥3-grounding gap). The failure-mode shift is the
durable, replication-light observable; the rate is labeled underpowered wherever cited.

### Kill / scope / no-re-roll

- **Exactly one** new world (`world-005-marrick`). If it reproduces, that is the
  margin-of-generality result; if it does not, that is the boundary. **Either way we stop at one** —
  no second world, no rescue arms, no guard variants.
- **No re-rolls.** Crash/truncation = delete the arm dir, rerun the **same** label, note it in the
  outcome. No early-stop — run each fan's five arms (informative across the whole k=5 range).
- The three world-005 fans pool **separately** from each other and from all lantern fans.
- World **frozen** (above); `seed:1` fixed; learner pinned claude/sonnet; `--critic off`
  (Fable backfill deferred to its return, as for the lantern fans).

### Sequencing (spend discipline)

The default would be **serialized** (the three fans share the Max-plan quota window **and** feed
between-arm contrasts, so a concurrent fan-out risks differential attrition biasing the contrast).
**Operator decision (2026-06-13): run all three fans in parallel** — the same no-quota-constraint
election Step 1 used for its parallel fan. The differential-attrition risk is bounded by the
no-re-roll discipline: a quota-killed or truncated arm is **deleted and rerun under the same
label**, so each fan still lands k=5 regardless of when its arms complete, and the contrast stays
balanced. Attended (verdicts watched as they land, read from source-of-truth `diagnosis.json`);
the operator may pause/intervene at any point. Labels `marrick-{real,guard,visible}-r1..r5`, group
`marrick-generalization`, `seed:1`, learner pinned claude/sonnet, `--critic off`.

---

## Step 2 outcome — V grounded 0/5, H 5/5 (added post-run 2026-06-13; pre-registered text above unaltered)

**Result.** All fifteen arms ran first-pass, no re-rolls: **baseline 0/5, H (hidden,
`--pacing-guard`) 5/5, V (page-only, `--pacing-guard-visible`) 0/5.** Every H arm grounded at
**t22 with gap 0** (the AND-join's earliest-derivable turn); both baseline and V failed every arm.
This lands the pre-registered **primary** branch (H removes the baseline's death modes *and* lifts
above baseline → the §6.13.10/.11 scheduling-discipline mechanism **travels** to the AND-join) and,
on the secondary V-vs-H contrast, the pre-tabled **"V < H, H lifts, V flat → the §6.13.11 caveat
realized"** branch.

**Statistics (as pre-tabled).**
- Grounding: H 5/5 Clopper–Pearson 95% **[0.478, 1.000]**; baseline and V 0/5 **[0.000, 0.522]**.
- Between-fan Fisher (k=5-vs-k=5 — significance reachable only at the extremes, per the envelope):
  **H vs V p = 0.0079**, **H vs baseline p = 0.0079**, **V vs baseline p = 1.000** (two-sided;
  one-tailed 0.0040 / 0.0040 / 1.000). On the forked world the page-only guard is statistically
  indistinguishable from no guard; the hidden guard separates from both.

**Primary read (failure-mode shift — E4a detector-split, the durable observable).** Guard ×
failure-mode contingency over all 15 arms (`derivation-detector-split.js`, dry, keyed on mechanism
not verdict shape):

| guard state | grounded | early-pull death | decay-seating death | n |
|---|---|---|---|---|
| `unguarded` (baseline) | 0 | 2 | 3 | 5 |
| `visible` (page-only, V) | 0 | 5 | 0 | 5 |
| `pacing` (hidden, H) | 5 | 0 | 0 | 5 |

H clears **both** baseline failure modes — the 2 early-pull *and* the 3 decay-seating deaths all go
to 0 — and grounds 5/5. (Pre-registered (a) required only that H remove the baseline's *early-pull*
death; on world-005 the baseline death split 2 early-pull / 3 decay-seating rather than running
early-pull-dominant as on lantern, and H removes both — so the mechanism reproduces even more cleanly
than the rule demanded.) V is **not inert**: it converts baseline's mixed deaths into a **uniform
tempo-starved disengagement at t21**, one turn before the t22 join — but it never grounds, because at
the cusp it cannot see β still open behind a learner who looks seated on α.

**Realized-enforcement covariate (the conditioning the registration tabled).** Read live off each
arm's `releaseDeviations` (per-fan totals over k=5), not by counterfactual replay: **H grounded 5/5
while overriding zero release decisions** (forced 0, overridden 0, held 1) — pacing through voluntary
prompt compliance, exactly as on lantern (§6.13.11) — whereas **V overrode 16 decisions** (held 7
releases late; per-arm overrides [3, 3, 3, 2, 5]) and still grounded 0/5. On the forked world the
page-only guard does **not** under-fire — it intervenes *harder* than the guard that succeeds, and
fails anyway, because the surface feature it acts on is the wrong one. The latent-distance signal is
doing work the page cannot supply, not merely firing more often.

**Reading recorded.** This **bounds** §6.13.11; it does not overturn it. The scheduling-discipline
mechanism still travels — H grounds 5/5. What is now geometry-conditional is the **page-only proxy's
sufficiency**: enough on world-002-lantern's coupled (linear) chain, where visible uptake tracks
latent distance and V grounded 5/5 = H; **insufficient** on world-005-marrick's decoupled (forked)
AND-join, where V 0/5 ≪ H 5/5 and the **latent depth signal becomes necessary**. The §6.13.11 caveat
(*"a world decoupling them need not let V track H"*) is realized exactly where its geometry predicted
— a bounded hidden-signal advantage reinstated on the shape built to require it.

**Caveats carried (per the rule + §5.12.6).** Registered primary read at declared power: k=5 each, so
the H-vs-V and H-vs-baseline separations sit at the exact 5/5-vs-0/5 Fisher corner where p first
clears 0.05; the claim is "V fails where H grounds **on this world**," not a rate over worlds. The
boundary is established at **one** forked geometry (world-005-marrick, seed 1, frozen p4 stack) — the
page proxy's sufficiency is shown *not universal*, not shown to fail on *every* forked world. Verdicts
are formal throughout (off `diagnose.js`, architecture-independent of the guard). V is the §6.13.11
twin unchanged (`VISIBLE_GUARD_DEFAULTS` re-used, import audit `visiblePacing.js` ↛
`slope.js`/`pacing.js` green) — the **world** changed, not the proxy.

**No re-rolls used; all fifteen arms first-pass.** Spend meterless (Max-plan CLI); the three fans
fanned in parallel under the operator's no-quota-constraint election, pooled separately from each
other and from every lantern fan.

**Fable critic notice.** Each arm is registered for the standing pinned-Fable critic's notice
(`commentary.md`); the backfill is **deferred** — Fable 5 is currently unavailable — and lands when
it returns. No mock substitute written.

**Folded into the paper** as **§6.13.12** + revision-history **v3.0.150**. Artifacts
`exports/dramatic-derivation/loop/marrick-{real,guard,visible}-r{1..5}/`; contingency
`exports/dramatic-derivation/boundary-marrick/detector-split-report.{md,json}`. **Step-2 paid loop
ended on this result.** Per the kill rule above, we stop at one world — no second world, no rescue
arms, no guard variants.

---

## Step 3 registration — world-006-hethel, distractor world, three-arm fan (baseline / H / V) (2026-06-13)

Operator sanction: **"do the minimal defensible version of P2."** This is the separate
pre-registration the discipline requires before the first paid Step-3 arm (each paid loop carries
its own committed registration, pooled separately). The three world-006 fans pool **separately**
from each other, from every world-005-marrick fan, and from every lantern fan, and are never folded
into any of them.

This step is **not** a violation of the Step-2 kill rule ("stop at one world"). That rule closed the
*marrick question* — does the mechanism travel to a fork, does V track H on a fork-decoupling.
world-006 asks a **different** question that marrick's own result newly raised, and which marrick
cannot answer because of a confound in its design (below). It is separately sanctioned, carries its
own stop-at-one kill rule, and is the *minimal* world that resolves the confound — one new world,
the core three-arm contrast, no rescue arms, no guard variants.

### The post-Step-2 reframe (why this is the design)

Step 2 found **V 0/5 ≪ H 5/5** on `world-005-marrick` and read it as the §6.13.11 caveat realized:
the page-only proxy's sufficiency is **geometry-conditional** (enough on lantern's coupled linear
chain, insufficient on marrick's decoupled fork). But marrick changed **two things at once** versus
lantern:

1. **Geometry** — a forked **AND-join** (the secret needs two independent depth-2 sub-chains α ∧ β
   to converge for the *same* `x`), where lantern is a single linear chain; and
2. **Decoupling** — that fork lets a learner look seated (V reads "near-done": recent echo, low
   hedging) on α while the global proof-distance `D` is still maximal because β is untouched.

marrick's V-failure is consistent with **either** cause: the page proxy may fail because of the
**fork geometry** *per se*, or because of the **decoupling** of surface-confidence from `D`
*however that decoupling is produced*. The two are **confounded** in marrick. "It's
geometry-conditional" is the conservative reading marrick licenses; "it's decoupling-conditional" (a
wider boundary) is equally consistent with marrick's data and is **untested**.

`world-006-hethel` **de-confounds** these. It holds the geometry constant at the **lantern shape** —
a single **LINEAR** spine (R1→R5, depth 5), the very shape on which V already grounded **5/5 = H**
(§6.13.11) — and supplies the decoupling through a **distractor** instead of a fork: a fully
derivable **decoy** sub-chain (R6, R7) that grounds `liableFor(hethelSpan, reyner)`, a *complete,
satisfying, wrong* finding to a **dead predicate** (no rule consumes `liableFor`; the question
predicate is `felledBy`). The learner can climb the decoy early — the master is of record by t2,
owns his yard by t6, holds the bond by t8 — looking confident and recently-on-topic the whole way,
while `D`-to-the-secret never moves (no true-spine conjunct past the break-point has landed). The
visible features ("turns since last release / learner echo / low hedging") read "near-done"
**exactly while the learner is finished with the wrong chain** — the same V-misread marrick produced,
on a linear spine, with no fork.

So Step 3's question is: **is the V-failure mechanism (surface confidence decoupled from `D`)
geometry-independent?** marrick established it on a fork; world-006 asks whether it also bites on a
linear chain when the decoupling is supplied by a distractor.

- If **V breaks here** (V < H) → decoupling alone defeats the page proxy, fork or not; marrick's
  boundary is really about **decoupling** and generalizes to any decoupling shape. The §6.13.12
  boundary **widens**.
- If **V holds here** (V ≈ H) → a derivable decoy on a linear chain does **not** defeat V; marrick's
  V-failure required the **fork** specifically; the page proxy is robust to a distractor as long as
  the true spine is linear. The §6.13.12 boundary is **fork-specific** (narrower than
  "decoupling-conditional").

Either outcome **cleanly decomposes marrick's confound**. This is a confound-resolving probe, not a
second fork run to pad n; the registration commits to reporting whichever way it falls.

### world-006-hethel identity + difficulty calibration (free, done — committed ac8f63b7 + d7be7aac)

- **Shape.** 7 rules, 8 premises. TRUE spine: 5 rules (R1_cause → R2_mark → R3_yard → R4_drawn →
  R5_felled), a single **linear** chain of depth 5 with a final join of cause and hand at R5
  (`failedThrough(span, struckCentering) ∧ pulledCentering(x, span) → felledBy(span, x)`); 5 true
  premises (p_point, p_surface, p_mark, p_brand, p_carter). DISTRACTOR: 2 rules (R6_built, R7_liable)
  grounding `liableFor(hethelSpan, reyner)` from 3 decoy premises (m_record, m_yard, m_bond). The
  mirror `felledBy(hethelSpan, reyner)` is blocked **structurally**: striking the centering needs the
  hand that *pulled the falsework*, and the falsework was Caudle timber drawn by Oswin; Reyner owns
  the lodge-yard and the bond, never the Caudle cart. No rule consumes `liableFor` to make `felledBy`
  — the decoy is a complete derivation to a **dead** predicate. plotLint enforces the mirror
  non-entailment.
- **Lint / recognition turn.** `plotLint` PASS; S first derivable **exactly at t20** (≥ `t_min` 18),
  6 turns before cap 26. The peripeteia is the green crown-mortar (p_surface, cued t9): the arch was
  *struck*, not mis-built, so the liability the learner just grounded is shown beside the question
  (the bond answers who *pays*, never whose *hand*).
- **Concealment.** The three concealed tokens (`oswin`, `caudle`, `crowsfoot`) appear only in
  post-release premises/secret — never in setting, background, question, rules, or learner voice.
  (`reyner` / lodge-yard / crown-joint / "struck centering" are **public** — the town's named master,
  the obvious yard, the break-point, and the craft's name for the failure-mode, which the rules speak
  openly.) **30/30** world-invariant tests green (6/6 for `world_006_hethel`).
- **Difficulty (E0 corridor).** λ=0 survival **32.0%** (40/125), λ=1 32.0%, λ=2 19.2% —
  **lantern-comparable**, in fact numerically identical to lantern's recomputed 32.0%@λ0 (both
  **40/125** — both are linear spines with three tutor-cued releases, so both enumerate 5³=125
  licensed sequences), non-degenerate, with distributed per-decision safe sets (p_point {t4,t5,t6},
  p_surface {t8,t9}, p_brand {t15–t18}) and minSlack 0 (the knife edge is t4→t9, slack 0 —
  decay-sensitive). Artifact:
  `exports/dramatic-derivation/boundary-hethel/corridor-map-world-006-hethel.md`.
- **The world is FROZEN.** The corridor map **is** the difficulty calibration. The baseline fan's
  result is **accepted as-is**: a degenerate baseline (0/5 or 5/5) is a *reported confound*, **not** a
  re-tune trigger. Re-tuning the world after seeing paid results would be a garden-of-forking-paths
  violation; the world does not change after this line.

### The three-arm fan

k=5 exchangeable arms per fan, decay `seed:1` fixed (only live variance = LLM-conduct
stochasticity), learner pinned **claude/sonnet**, `--critic off` (Fable backfill deferred). Each arm
is the **same full-charter conduct stack** the lantern E2 and marrick fans ran, **verbatim** —
`--superego --acts '{"minActTurns":3,"maxActTurns":8}' --decay '{"rate":0.75,"graceTurns":1,`
`"maxConcurrent":2,"startTurn":1,"mutateShare":1.0,"seed":1,"pool":"staged"}' --confront`
`--repair-clause --release-authority --plot --throughline --critic-feedback off --critic off` — with
only the world swapped to `world-006-hethel` + its tutor script. `--release-authority` is already in
the stack, so the guard arms add **exactly one flag** each (the Step-1 zero-delta basis, verbatim).
Provider env mirrors lantern/marrick (`DERIVATION_PROVIDER=codex DERIVATION_LEARNER_PROVIDER=claude
DERIVATION_LEARNER_MODEL=sonnet`).

| fan | flag added to the p4 stack | k | labels | what it isolates |
|---|---|---|---|---|
| **baseline** | — (no guard) | 5 | `hethel-real-r1`…`r5` | the world-006 floor (does the distractor sink the unguarded stack?) |
| **H** — hidden guard | `--pacing-guard` | 5 | `hethel-guard-r1`…`r5` | does the §6.13.10 true-state guard travel to the distractor world? |
| **V** — visible guard | `--pacing-guard-visible` | 5 | `hethel-visible-r1`…`r5` | does the page-only proxy survive a decoupling that is **not** a fork? |

The baseline carries the `-real-` infix so `derivation-mine-conduct.js` tags it the **real** backend;
the guard/visible fans bucket *"unknown"* in the conduct miner (cosmetic — exactly as lantern's and
marrick's own guard/visible arms did), because the **primary read** runs through
`derivation-detector-split.js`, whose `guardStateOf(diagnosis)` reads the guard layer straight off
each arm's recorded `diagnosis.json` flags (`pacingGuard`→`pacing`, `visibleGuard`→`visible`, else
`unguarded`), **world-agnostically**. No analysis-code change: the contingency table is built with
`--arms hethel-real-r1,…,hethel-guard-r1,…,hethel-visible-r1,…`.

**Why V is in (and is not creep).** world-006 is the **one** sanctioned new world, and its distractor
was built to decouple V from `D` **without** a fork. baseline + H alone would re-confirm "discipline
travels" but **waste the decomposition** — leaving open the exact question marrick's confound raised
(geometry vs decoupling). The V-vs-H contrast on a linear-spine distractor is the sharpest thing this
world can buy; the baseline is the shared floor both guards are read against. *(15 paid arms total. A
2-arm fallback (baseline + H, 10 arms) is available if spend must be bounded; it answers "does the
mechanism travel to a distractor world" but not "does the page proxy survive non-fork decoupling.")*

### Engineering status (no new guard code)

- **H** is world-parametrized (`pacing.js` reads `D`/decay off the world + proof DAG) — runs on
  world-006 **unchanged**.
- **V** uses the lantern-tuned `VISIBLE_GUARD_DEFAULTS` **unchanged** (no per-world threshold fishing
  — refitting V to world-006 would forfeit the form-match to H and the Step-1 zero-delta basis).
- The audit invariant (`visiblePacing.js` imports no hidden primitive;
  `tests/dramaticDerivationVisiblePacing.test.js`) is unchanged and green.
- The only world-006 engineering (world YAML, tutor script, world-invariant test entry) is committed
  at **ac8f63b7** + **d7be7aac**; no `services/dramaticDerivation/` change in this arc.

### Pre-flight (free, done 2026-06-13)

- **Lint / tests / corridor:** `plotLint` PASS (S@t20), 30/30 world-invariant tests (6/6 for
  `world_006_hethel`), corridor 32.0%@λ0 (lantern-identical, 40/125).
- **Pre-spend gate — lantern `--validate` PASS (5/5).** Required because `services/dramaticDerivation/`
  changed since the last validated state (`e0891abf` added the guard-compiler replay slice).
  `npm run derivation:corridor -- --validate` reproduces all four lantern detector verdicts
  (`lantern-p2-plot-on` aporia@t8, `lantern-p3-repair-on` grounded, `lantern-p4-hygiene-on` grounded,
  `lantern-p5-mutation-on` aporia@t12) plus the full p5 re-simulation (verdict aporia@t12, dCurve
  true, grounded true, λ=[0,0,0,0,0]) — the shared engine is intact for the paid fan. The guard is a
  no-op for lantern; its arms belong to it.

### Confound control (V enforcement frequency) — post-hoc on world-006, mirroring Steps 1–2

`scripts/derivation-visible-guard-calibrate.js` hardcodes the **lantern** frozen arms, so it cannot
pre-flight world-006 — there are no frozen world-006 arms yet. The control is therefore **post-hoc**,
exactly as Steps 1–2 measured it: after the world-006 fans land, counterfactual-replay V's real
decision function over world-006's own frozen baseline + H transcripts (same faithful-reconstruction
self-check: reconstructed `playable.length` must equal each row's recorded `windowSize`), and report
V's **realized enforcement** as a covariate (Step-1 reference: V live ≈ 0.07/decision; H 0/87). The V
grounding read below is **conditioned** on this covariate — a heavy-force-play V is down-scoped,
exactly as in §6.13.11/.12.

### Pre-tabled k=5 Clopper–Pearson 95% (verified `scipy.stats.beta.ppf`)

Per-fan, identical for each of baseline / H / V (k=5 is k=5):

| grounds | rate | CP95 |
|---|---|---|
| 0/5 | 0.00 | [0.000, 0.522] |
| 1/5 | 0.20 | [0.005, 0.716] |
| 2/5 | 0.40 | [0.053, 0.853] |
| 3/5 | 0.60 | [0.147, 0.947] |
| 4/5 | 0.80 | [0.284, 0.995] |
| 5/5 | 1.00 | [0.478, 1.000] |

### Achievable k=5-vs-k=5 Fisher envelope (verified `scipy.stats.fisher_exact`, one-sided)

All three world-006 fans are k=5, so the between-fan Fisher tests are **k=5-vs-k=5**, where
significance is reachable only at a **≥3-grounding gap**:

| separation | Fisher p (greater) | |
|---|---|---|
| 5/5 vs 0/5 | 0.004 | **sig** |
| 5/5 vs 1/5 | 0.024 | **sig** |
| 4/5 vs 0/5 | 0.024 | **sig** |
| 5/5 vs 2/5 | 0.083 | ns |
| 4/5 vs 1/5 | 0.103 | ns |
| 3/5 vs 0/5 | 0.083 | ns |

The *rate* can only separate at the extremes; a real 4-vs-1 (80% vs 20%) effect still returns p=0.10.
**This is why the rate is demoted** and the within-arm failure-mode shift is the primary read.

### Interpretation rule (pre-registered)

**Primary — failure-mode shift (E4a detector-split, per arm, pooled into the guard × failure-mode
contingency table).** Generality of the §6.13.10/.11/.12 scheduling-discipline result to a
**distractor** world is claimed iff **both**: (a) **H** removes the unguarded baseline's dominant
death mode on world-006 (whatever it is — early-pull and/or decoy-seated disengagement), and (b) H's
grounding point-estimate lifts **above** the world-006 baseline (directional, same sign as
lantern/marrick). If neither holds, the mechanism is **distractor-bound** on this world — a clean
negative reported as the limit, not papered over.

**Secondary — V vs H on the distractor shape (the geometry-vs-decoupling decomposition):**

- **V ≈ H, both lift above baseline** → the page-only proxy **survives** a derivable decoy on a linear
  spine; marrick's V-failure was **fork-specific** (geometry), not decoupling-general. The §6.13.12
  boundary is **narrower** than "any decoupling defeats V" — it needs the fork. The page proxy is more
  robust than marrick alone implied.
- **V < H, H lifts, V flat** → the page-only proxy **breaks** under a distractor even on a linear
  chain; marrick's V-failure was **decoupling-general**, not fork-specific. The §6.13.12 boundary
  **widens**: any decoupling of surface-confidence from latent `D` defeats the page proxy, fork or not;
  the latent-depth signal becomes necessary wherever the page can be made to read "near-done" off the
  wrong chain.
- **V ≈ H ≈ baseline (neither lifts)** → scheduling discipline is bound to the worlds already shown; it
  does not travel to a distractor world. Clean negative.
- **V lifts, H flat** → anomaly (visible helps where true-state does not); report as such, no mechanism
  claim.

**Rate — secondary, explicitly underpowered.** Reported with CP95 (above); between-fan Fisher
one-sided per the envelope (significant only at a ≥3-grounding gap). The failure-mode shift is the
durable, replication-light observable; the rate is labeled underpowered wherever cited.

### Kill / scope / no-re-roll

- **Exactly one** new world (`world-006-hethel`). If V breaks, that widens the boundary; if V holds,
  that narrows it; **either way we stop at one** — no second distractor world, no rescue arms, no guard
  variants.
- **No re-rolls.** Crash/truncation = delete the arm dir, rerun the **same** label, note it in the
  outcome. No early-stop — run each fan's five arms (informative across the whole k=5 range).
- The three world-006 fans pool **separately** from each other and from all lantern and marrick fans.
- World **frozen** (above); `seed:1` fixed; learner pinned claude/sonnet; `--critic off` (Fable
  backfill deferred to its return, as for the lantern and marrick fans).

### Sequencing (spend discipline)

The default is **serialized** (the three fans share the Max-plan quota window **and** feed between-arm
contrasts, so a concurrent fan-out risks differential attrition biasing the contrast). As in
Steps 1–2, the operator may elect to **run all three fans in parallel** under a no-quota-constraint
window; the differential-attrition risk is bounded by the no-re-roll discipline (a quota-killed or
truncated arm is deleted and rerun under the same label, so each fan still lands k=5 and the contrast
stays balanced). Attended (verdicts watched as they land, read from source-of-truth `diagnosis.json`);
the operator may pause/intervene at any point. Labels `hethel-{real,guard,visible}-r1..r5`, group
`hethel-generalization`, `seed:1`, learner pinned claude/sonnet, `--critic off`. **The choice of
serialized vs parallel is the operator's at go-time.**

Outcome target (post-run, pre-registered text above unaltered): **§6.13.13** + revision-history
**v3.0.154** (exact version contingent on what lands first), the marrick outcome's structure mirrored.
No paper edit is made by this registration — it is forward-looking; the empirical claim is added only
after the run.

---
