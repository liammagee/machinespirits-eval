# Contrastive Timing-Pair Design

Date: 2026-06-05

Builds on: `notes/poetics/2026-06-05-public-causal-bridge-criterion.md` (the
correlational seed) and the §6.10 disposition (`paper-full-2.0.md` 2419-2437).

## The question — and how it differs from the foreclosed P1

§6.10 asked: **is the learner's hidden interior repair independently measurable**
— does the latent (concealed) deliberation carry signal *separable from the
surface*? It failed its frozen offline gate and is closed ("no Stage 1, no live
run, no tuning retry"); the caveat explicitly forecloses re-running it on a
richer probe.

This design asks a **different question on a different axis**:

> Holding the public utterances constant, does the **sequential timing** of the
> tutor's pivotal (mechanism-change) move relative to the learner's reframe
> change whether blind critics **attribute** the reframe to the tutor's action
> (peripeteia-induced) rather than reading it as organic?

The variable here is **public, fully observable structure** — exactly what the
base reads — not a hidden interior. It is not a separability claim about latent
text; it is an **attribution** claim about how the critic reads observable
sequence. §6.10's foreclosure does not reach it: nothing latent is modelled, no
"richer probe" of the concealed interior is run. Frame per
`dramatic-form-not-mindreading`: this measures **critic attribution of dramatic
form**, never real learning or real causation. A positive timing effect says
"the critic reads peripeteia from public sequence," *not* "the tutor really
caused the reframe."

## Why now — the controlled successor to the public-causal-bridge note

The public-causal-bridge note observed, across the fixed held-out replay, that
**7/9 reached induced-origin and 2/9 only recognitive form** — and that the 2
failures "reached recognitive form but lacked the same causal bridge." But those
9 items differ in **content and domain** (carts, arrow-direction, music tempo):
the 7-vs-2 split is **confounded** — bridge-present items may also differ in
domain, quality, register. The note even diagnoses this as a generation problem
(authoring a real obstruction vs a "smoother reminder").

The timing-pair design **isolates the one variable**: take a *single* base
transcript and build a **matched set sharing the identical public utterances**,
differing only in the *placement* of the pivotal move. Any attribution
difference is then caused by timing alone — content held literally constant
(same utterance multiset). This is the clean, within-item version of what the
9-item contrast gestured at, and by construction it is immune to the
author-family / lexicon confounds that invalidated earlier cross-item
comparisons (`project_poetics_gpt_deconfound`, `project_critic_mirror_bias`).

## Design — a 2×2, not a single pair

A bare bridged-vs-decoupled pair is confoundable (a positive result could be
real peripeteia OR post-hoc gullibility — the critic inferring cause from mere
adjacency). The whole arc's lesson is that single contrasts get confounded, so
the unit is a **2×2 within one base transcript**:

|                | **adjacent timing** (obstruction → move → reframe) | **decoupled timing** (reframe precedes the move) |
| -------------- | --- | --- |
| **pivotal move** (real mechanism-change) | A · BRIDGED | B · DISPLACED-PIVOTAL |
| **neutral move** (length/register-matched reminder, no mechanism-work) | C · DECOY-BRIDGED | D · DISPLACED-NEUTRAL |

- **Move factor** (pivotal vs neutral) = the *content* of the tutor turn. Neutral
  is a matched placebo — same length/register, does no mechanism-work (the
  "smoother reminder" the bridge note named as the failure case). Same
  matched-control discipline as `prompts/tutor-ego-placebo.md`.
- **Timing factor** (adjacent vs decoupled) = pure **reorder**. Within a
  move-type the two timing arms have the **identical utterance multiset** — only
  the sequence differs. Decoupling = **post-emption**: place the learner's
  reframe-use *before* the tutor's pivotal move, so the reframe is public before
  the move that supposedly caused it (no causal bridge readable). (A
  *displacement* variant — move shifted far upstream with neutral turns
  interposed — is the robustness arm.)

## What each outcome means (the D6 gullibility discriminator)

Measure: the existing **blind 5-critic origin panel** (induced vs organic
majority), per cell → P(induced). Read the 2×2:

- **Real structural peripeteia (instrument valid).** Induced needs *both* a
  pivotal move *and* adjacent timing → a **move×timing interaction**: only cell A
  reads induced; B, C, D read organic. The critic tracks the genuine bridge
  (content × sequence). Aristotelian reversal *is* structural-sequential, so this
  is a legitimate positive.
- **Post-hoc gullibility (a D6 finding).** A **main effect of timing** with no
  move sensitivity → cells A *and* C both read induced: adjacency alone drives
  attribution, regardless of whether the move does mechanism-work. The critic is
  fooled by sequence — the controlled, measured form of the bridge note's
  "smoother reminder read as a bridge."
- **Content-only (timing is not a lever).** A **main effect of move** with no
  timing effect → attribution tracks content regardless of order; "strategic
  timing" is *not* a lever. The user's hypothesis would be false — still
  informative, and a clean null.

All three are publishable readings; the design is generative (no κ bar; divergence
is the finding — `feedback_dramatic_generative_not_oracle`).

## Guardrails (frozen up front)

- **Architecture-independent scoring.** The manipulation is on the *generator*
  (timing); the measure is the *independent* blind critic panel — not a shared
  channel (`closed-loop-eval-tells`). Cross-check **GPT vs Sonnet** critics (the
  de-confound) — the timing effect must survive critic-family swap.
- **Coherence manipulation-check (the load-bearing confound).** Reordering can
  produce a less *coherent* transcript; critics might down-vote induced for
  incoherence, not for a missing bridge. Every arm gets a blind **coherence /
  naturalness** rating; if decoupled arms are systematically less coherent, the
  timing effect is confounded with coherence and must be reported as such (or the
  reorder redesigned). Non-negotiable — without it a positive is uninterpretable.
- **Identity invariant.** Within a move-type, the two timing arms must have the
  identical utterance multiset (asserted by the generator, not assumed). Across
  move-types exactly one turn differs (the tutor move).
- **Single paper.** Lands as a §6.x of `paper-full-2.0.md` (poetics arc),
  positive *or* negative — no spin-off (`feedback_single_paper_discipline`). If it
  nulls or shows gullibility, that is a finding about the instrument, sibling to
  the §6.10 disposition, not a new claim set.
- **No ablation creep.** One 2×2, one base-item family scaled to a small N. Not a
  sweep of decoupling variants (displacement is a *robustness* arm, not a new
  cell family).

## Reuse (low build cost)

- **Generation:** the `turn_plan` `at:{turn}` placement primitive
  (`turnPlanSampler.js`) + the compose reorder machinery already place/relocate a
  move at a chosen turn. The timing-pair generator is a **pure reorder** over an
  existing transcript — zero-API; utterances reused verbatim.
- **Bridge tagging:** the `public_causal_bridge` ledger schema (bridge note
  §Implementation Rule) already names the turns to tag (obstruction /
  tutor_mechanism_change / learner_uses_changed_test).
- **Ontology cross-check:** `config/ontology/discursive-game-core.ttl` already
  has `ms:PublicCausalBridgeEvidence`, `ms:PeripeteiaOriginSurvivor`,
  `ms:WeakPublicCausalBridge` + the six bridge-component properties; and
  `adaptation-core` derives `PeripeteiaInducedRecognition` iff `chainComplete`
  (R2) — a *symbolic* prediction the generator can stamp per arm and the panel
  can be checked against.
- **Scoring:** the existing strict-origin blind panel (5-critic majority).

## Build sequence

1. **`services/ontology/timingPairGenerator.js` (zero-API, this step).** Input: a
   tagged base transcript (`{turns:[{role,text}], tags:{obstruction,pivotalMove,
   reframe}}`) + a matched `neutralMove` text. Output: the four arms by reorder +
   neutral-substitution, each carrying the symbolic `chainComplete` prediction
   and a `utteranceMultisetHash` for the identity invariant. Round-trip test:
   within-move-type timing arms hash-equal; the pivotal/neutral arms differ by
   exactly one turn; the bridged arm derives `chainComplete=true`, decoupled
   `chainBroken=true`. **No paid calls.**
2. **Adapter** from the held-out replay candidates
   (`exports/discursive-replay-loops/.../replayDir`) — which already carry the
   bridge ledger — into the generator's tagged-transcript input. Pick ~6 base
   items spanning the 3 domains (cart / arrow / tempo) so the effect isn't
   domain-specific.
3. **Small blind-panel pilot (PAID, human-gated).** 6 bases × 4 arms = 24
   transcripts → the existing 5-critic origin panel + coherence rating, GPT *and*
   Sonnet critic families. ~240 judge calls; attended + checkpointed per
   `feedback_attended_quota_runs`. Read the 2×2: interaction (valid) vs
   timing-main-effect (gullible) vs move-main-effect (timing-not-a-lever).

Steps 1-2 are zero-API and land first. Step 3 is the only metered part and waits
for an explicit go.

## Boundary

This tests whether **public timing moves critic attribution**, content held
constant. It does *not* claim the original tutor adapted online, does *not*
reopen the §6.10 hidden-interior question, and a positive result is an attribution
effect (how the critic reads form), not evidence of real causation or learning.
