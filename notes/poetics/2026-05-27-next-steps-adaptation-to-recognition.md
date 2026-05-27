# Next Steps: From Tutor Adaptation To Reliable Recognition

Date: 2026-05-27

Status: operational checklist for the post-merge poetics sidecar. This note is
the explicit handoff from "we have mechanism-level tutor adaptation" to "we have
a robust architecture where adaptation reliably produces recognitive learner
form."

Update 2026-05-27: the first full gated loop over D42/D50/D53 produced one pass
out of two required. The next loop should use the stricter peripeteia ending
contract now encoded in the generator and rules critic: after performing the
new device, the learner must name the old check or pressure and state the
replacement check. Do not return to broad generation unless this focused loop
diagnostically saturates.

## Target Claim

The target claim is deliberately narrower than "the tutor is generally
adaptive":

> Under clean low-organic controls, a tutor-private peripeteia mechanism
> reliably produces a public tutor route change, learner performance of the new
> device, and learner re-reading of the prior difficulty.

That is the missing bridge between mechanism-level tutor adaptation and robust
recognition.

## What Counts As Success

A candidate run is a pass only if all gates clear.

1. **Clean controls.** `routine` and `none` arms are flat or negative under the
   critic consensus rule. No control arm may be claimable recognition, and no
   control branch may carry blocking quality warnings.
2. **Branch-valid adaptation.** `peripeteia-only` must consume a learner
   reversal-pressure event, declare a private route change, and produce a public
   mechanism shift.
3. **Actional bridge.** Critics must see learner public performance of the new
   device or criterion. A private tutor route change without learner action is
   not enough.
4. **Recognition-origin bridge.** Recognition should be classified as
   `peripeteia_induced`, not merely organic or ambiguous.
5. **Repeat stability.** The pass must hold across at least two repeats on the
   same anchor set, not one attractive draw.

Operationally, the first robust target is:

- anchor set: D42, D50, D53;
- arms: `routine`, `none`, `peripeteia-only`;
- critics: Qwen, Gemini, DeepSeek, Sonnet;
- pass threshold: no claimable control recognition; `peripeteia-only` claimable
  on each anchor; origin majority `peripeteia_induced`; all branches quality-ok;
  deterministic sidecar branch-validity true for every `peripeteia-only` item.

## Why We Should Not Broadly Generate

The previous arc already showed the failure mode. Broad scenario generation
mostly discovers new ways for controls to leak organic recognition or for
adaptive branches to look good privately but fail publicly. The loop should
therefore be gated:

1. generate a small candidate batch;
2. reject immediately if quality warnings or control leakage appear;
3. run tutor-adaptation diagnostics only if the controls pass;
4. score with external critics only when cheap structure and quality gates pass;
5. stop once a candidate either clears the robust target or fails for an
   informative reason.

The loop should be a search over mechanism constraints, not an unbounded search
over arbitrary examples.

## Execution Checklist

### A. Freeze Inputs

- Use D42/D50/D53 as the current clean mechanism anchors.
- Keep D54-D57 as boundary/design evidence only until revised; do not spend a
  full critic panel on them without a cheap clean-control pass.
- Keep D35/D47/D49 out of the clean denominator; they are useful stress or
  organic-boundary probes.

### B. Run A Narrow Iteration

Use only the three-arm contrast needed for the target:

```bash
npm run poetics:adaptation-loop -- \
  --batch-prefix phase2-adaptation-recognition-loop \
  --target-only D42,D50,D53 \
  --target-arms routine,none,peripeteia-only \
  --max-iterations 3 \
  --required-passes 2 \
  --skip-existing-scores
```

Each iteration should:

1. generate one repeat;
2. run the rules structural critic;
3. score with the configured critic panel;
4. ingest into the poetics sidecar DB;
5. run tutor-adaptation diagnostics;
6. annotate recognition-origin diagnostics;
7. evaluate the stop criteria.

### C. Diagnose Failure

If the iteration fails, classify the failure before trying another draw:

- **quality leak:** public transcript exposes hidden branch cue, inner trace, or
  no-cue reframe language;
- **control leak:** routine/none are already recognitive;
- **private-only adaptation:** tutor route changes in trace but not public
  response;
- **action gap:** tutor gives a device but the learner does not perform it;
- **organic recognition:** recognition appears but not because of the tutor
  peripeteia chain;
- **critic split:** Qwen/DeepSeek see recognition but Gemini/Sonnet do not, or
  vice versa.

### D. Correct The Mechanism, Not The Sample

Correction order:

1. strengthen public mechanism visibility;
2. force learner action after the new device;
3. force earned reorientation after the action;
4. only then revise scenario wording;
5. only then add new candidate anchors.

Do not fix failures by making the learner narrate "I get it" earlier. That
collapses the target back into public reframe manipulation.

### E. Promote The Durable Output

Once the loop passes:

- write a compact mechanism specification;
- export a curated state-action-outcome table;
- package raw run artifacts with `npm run poetics:package-run`;
- commit only the manifest and the report;
- promote the mechanism into the main adaptive tutor control loop.

## Termination Rule

Stop the loop when either condition is met:

1. **success:** two gated iterations pass the robust target over D42/D50/D53; or
2. **diagnostic saturation:** three consecutive iterations fail for the same
   failure class.

If diagnostic saturation occurs, the next work is architecture/prompt surgery,
not more generation.

## Current Expected Risk

The likely failure is not absence of tutor adaptation. The current sidecar has
already shown branch-valid tutor adaptation. The likely failure is the bridge:
getting the learner to perform the new public device and then re-read the prior
difficulty without smuggling a public reframe cue into the control arms.
