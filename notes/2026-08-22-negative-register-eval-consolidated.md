# The Proper Eval of a Negative Register — Consolidated

Status: consolidation note, 2026-08-22. No new claim, no paid call. This
gathers a design that is currently spread over five documents, and states
the integration path that follows from it. Sources:

- `notes/2026-07-02-register-taxonomy-and-negative-registers-plan.md`
  (definition, rubric, addenda 8–15)
- `notes/2026-07-03-negative-register-effect-estimation-future-work.md`
  (two estimands, minimum grid)
- `docs/research/paper-full-2.0.md` §6.7, §8.9 (bounded claims)
- `notes/2026-08-06-sarcasm-determinate-negation-preregistration.md`,
  `notes/2026-08-07-sarcasm-precondition-preregistration.md`,
  `notes/2026-08-08-sarcasm-mood-floor-replication-preregistration.md`,
  `notes/2026-08-09-register-mock-praise-preregistration.md`,
  `notes/2026-08-09-register-strong-stack-replication-preregistration.md`
  (mechanism, precondition, device, stack boundary)
- `workplan/items/resistance-action-register-integration.md` (the
  integration programme this note feeds)

## 1. The goal, stated plainly

The goal is not to beat the warm tutor. Two standing premises:

1. **Diversity is its own virtue.** A tutor that can only be warm has no
   repertoire, whatever its mean score. The deliverable is a wider set of
   licensed stances, each real, each bounded.
2. **Models are coded to warmth.** The measured failure mode of every
   negative-register run so far is generation-side regression to warmth —
   "warm irony in costume" — not visible harm. A strong stack asked to be
   sarcastic tends to produce a warm tutor wearing the costume, so the
   register was never delivered and there was nothing to price.

Warm is therefore the reference condition, not the bar. What the eval must
establish is that the register is real (fidelity), licensed (precondition),
mechanism-bearing (the learner gets something from the form itself), and
bounded (harm and cost inside pre-set margins).

## 2. What a negative register is

A stance whose contract can be executed well while damaging recognition.
The defining hypothesis of the eval is **divergence**: execution quality
and recognitive cost are scored by separate instruments on the same slice,
and the interesting result is when they split. If they never split, that is
a finding about the instrument or the generator — never a safety pass.

A register is a triple: a trigger condition (the learner signal that
licenses it, with a quotable evidence span), a stance contract
(obligations and prohibitions, in `config/engagement-registers.yaml`), and
a register-conditional success criterion scored on the local slice.

## 3. The six parts of the proper eval

1. **Divergence, not victory.** Register-execution rubric and recognition
   guardrail on the same slice, always paired.
2. **Score the slice, never the transcript.** The adopting turn plus the
   learner's next turn. Whole-transcript scoring buries the register
   signal (established in the cells 180–194 arc).
3. **Three validity legs before any outcome claim.**
   - *Judge discriminant validity.* Judges must catch hand-authored
     known-corrosive exemplars and clear controls. Done: 3/3 caught, 0/2
     false alarms (`config/register-exemplars/corrosive-sarcasm.yaml`).
     gpt-mini was shown to be no measurement (identical scores on 35/49
     slices); a sonnet-class judge is required from the first row.
   - *Treatment fidelity.* The stance gate: a row counts as
     negative-register evidence only when the tutor visibly spoke the
     register. "Warm in costume" is a noncompliance exclusion. A person
     attack is a failed guardrail, counted separately — never successful
     sarcasm. Visible stance cues repaired fidelity to 15/15 across all
     five resistance targets.
   - *Stack boundedness.* The August grid turned out to run its tutor
     seats on the weak nemotron/kimi pairing. No fidelity or effect count
     generalizes until a strong writer replicates it. This leg is why the
     strong-stack replication card exists.
4. **Two estimands, always.** Assigned-arm (intention-to-treat) and
   faithful-arm (per-protocol), reported side by side, with exclusions and
   violations counted separately from both.
5. **A mechanism measure, not just conversion.** Sarcasm that teaches is
   determinate negation: each sarcastic turn names a claim the learner
   made and implicates its opposite, and the eval checks whether the
   learner later voices the corrected claim in their own words (negation
   recovery). If recovery does not co-move with outcomes, the reading
   fails even when scores rise. And a contract binds only where its
   precondition holds: a mood with no claim attached gives the tutor
   nothing to negate except the person, which the same contract forbids —
   so scenario design must plant a negatable claim, and profile-register
   fit is part of the design, not noise. The manner marker is scored as
   content delivery (it is the warrant for the derived claim), not as
   tone. At the device level, the manner rides on identifiable moves —
   the compliment granted and withdrawn in one sentence — and devices are
   tested prospectively, never tuned post hoc.
6. **Never router-organic.** Negative registers are experiment-assigned
   arms (`router_selectable: false`). Face-threat stays simulated-only.
   Irony and sarcasm stay opt-in, work-directed, and suppressed for
   protected affect or comprehension repair.

## 4. What this changes about the integration path

The integration card's Phase 4 crossed design and its verification clause
currently read as superiority tests against warm. Under §1 they should be
amended, prospectively and at zero cost, before the baseline pilot:

1. **The warm-baseline pilot stops being a kill gate.** A warm ceiling no
   longer ends the path; the pilot's job is pricing and margin-setting.
2. **Co-primary endpoints become capability plus bounded cost**: delivered
   register fidelity at the warranted moment (the thing the edged outcome
   study never measured, because its delivery swap never fired), and
   outcome non-inferiority inside a pre-set margin. Superiority is
   secondary. The harm boundary stays absolute.
3. **Register the diversity endpoints or they stay anecdote.** The
   evidence already points at two: demand held under boredom (the warm
   tutor eased its make-the-case demand from 1.04 to 0.38 per turn with
   the bored learner; the edged tutor held it), and breadth of learner
   response (the edged menu drew the most new learner material and moved
   the learner into questioning rather than silence). Both were
   descriptive last time; neither counts until frozen before the run.
4. **The promotion rule follows.** The shadow action-before-register path
   becomes authoritative when fidelity, harm, and bounded cost pass — a
   win over warm is not required. Cell-harness claims still go only
   through the claim-transfer rule, and nothing generalizes past the
   generation stack it ran on.

What the reframing cannot do: excuse the existing negative. The edged-menu
result (0.567 against 0.712, p = 0.043) stands as reported, and every new
endpoint must be frozen before any new row is bought.

## 5. Claim boundary

Everything above is simulated-only and non-human-facing. Nothing here
licenses "sarcasm works", "sarcasm is safe", router autonomy over negative
registers, or any human-learner claim. Human validity is a separate gate
(`workplan/items/a1-human-learner-validation.md`).
