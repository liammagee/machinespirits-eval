# Phase-2 drama progress log

**Status: diagnostic engineering and experiment log, 2026-05-22.**
This note records the de-confounded learning-drama work after
`PHASE2-FINDINGS.md` section 4 proposed a varied retest. It is not folded into
`docs/research/paper-full-2.0.md`, and the runs below are not paper claims.
The current purpose is to make the dramatic mechanism inspectable before scaling
script production or evaluation.

## 1. Why this path exists

The first Phase-2 transfer attempt failed on a narrow transcript sample:
homogeneous Hegel dialogues, one repeated dramatic shape, and a form/content
recursion in which the learned topic and the measured term were both
"recognition". The retest path therefore asks a narrower engineering question
first:

> Can the real tutor and learner architecture generate varied public teaching
> dramas in which later learner speech sometimes re-reads earlier learner speech,
> without that structure being faked by an off-stage script or a hidden label?

The retest still scores transcript form rather than learner interiority. Human
labels remain useful reader evidence, but the current diagnostic workflow treats
them as another perspective alongside independent critics. A separate
methodological decision is still needed before changing the original
human-agreement transfer-gate text in `PHASE2-DESIGN.md`.

## 2. Mechanism built so far

The current generator path is `scripts/generate-pedagogical-dramas.js` over the
real bilateral interaction engine, not a single model writing a fake dialogue.
The substantive steps taken are:

1. **Use the bilateral roles already in the repo.** Tutor and learner both keep
   Ego and Superego deliberation. Public speech comes from the Ego's final
   authority after interpreting Superego feedback; Superego feedback stays
   commentarial rather than becoming drafted public dialogue.
2. **Expose a play-like public layer.** The public sample can contain visible
   stage directions, while held-out artifacts preserve the full trace and
   role-specific transcripts under `*.full.md`, `*.stage.md`, `*.tutor.md`, and
   `*.learner.md`.
3. **Add a Director role.** The Director sets scene ecology, speaker order,
   register pressure, and occasional public interventions so every sample does
   not collapse into the same learner-first American tutor chat.
4. **Seed varied pedagogical setups.** `phase2-dramas-v2.yaml` defines D1-D6
   across mathematics, physics, poetry, biology, music theory, and philosophy.
   `phase2-dramas-v3.yaml` extends the setup set further. The spec seeds
   dramatic pressure and held-out design hypotheses; it does not label the form
   the generated transcript must achieve.
5. **Make learner look-back cues explicit and graded.** The Director can inject
   `none`, `anchor`, `revoice`, `reconsider`, or `reframe` revisit policies,
   anchored to earlier learner speech rather than tutor paraphrase.
6. **Fork paired continuations from one prefix.** Paired runs share the public
   prefix through tutor turn 2, then branch by revisit policy. That lets policy
   comparisons use the same scene and early dialogue instead of unrelated
   generations.
7. **Add admission checks.** Public samples warn on internal-process leaks,
   truncation, too few learner turns, failed revoice/reframe compliance, requested
   reframe cues downgraded by the anchor gate, and other quality hazards before
   scoring.

## 3. What recent probes found

### 3.1 Controls

The uncued D2/D4 control pair remained stable under both current external critics:

| Control transcript | Qwen | Gemini |
|---|---|---|
| D4/T01 | flat | flat |
| D2/T03 | trap | trap |

That matters because the scorer still distinguishes ordinary correction from
premature insight-declaration while the positive mechanism is being changed.

### 3.2 First wider paired continuation batch

A D1/D3/D6 paired target batch exposed a generator bug before it could serve as
clean evidence: a shared Director plan could carry a revisit cue into branch arms,
so a directory named `reframe` did not guarantee that the branch actually used a
reframe cue. Commit `c666ca3` strips shared revisit cues before applying the
requested branch policy.

The corrected wider batch then showed useful but non-final separation:

| Critic | `none` | `revoice` | `reconsider` | `reframe` requested |
|---|---|---|---|---|
| Qwen recognitions on D1/D3/D6 | 1/3 | 2/3 | 1/3 | 2/3 |
| Gemini recognitions on D1/D3/D6 | 0/3 | 1/3 | 0/3 | 1/3 |

The controls still stayed flat/trap. The caution is load-bearing: all three
requested `reframe` arms in that corrected wider batch were downgraded at runtime
to `reconsider` because their selected anchors did not satisfy the strong
misframing gate. Commit `0c8b8a8` makes that downgrade a blocking quality warning
instead of a silent label mismatch.

### 3.3 Clean D1 positive-stress probe

D1 was tightened so its opening learner line must publicly own the decimal-check
misconception as an assumption, hunch, or first instinct. That preserved the
strong reframe gate rather than weakening it. D1 also exposed natural public
reframe wording the compliance detector had been missing, such as:

- "was only a check ... not a proof"
- "was treating a pattern as if it were already a proof. Better to suppose ..."

Commit `3c17e3d` adds those regression cases. On the clean D1 paired probe with
one fixed prefix and policies `none,revoice,reframe`, both external critics then
separated the uncued continuation from the cue-bearing continuations:

| Critic | Policy | Form | Recontextualization | Stated insight | Rupture |
|---|---|---|---:|---:|---:|
| Qwen | `none` | flat | 0 | 0 | 0 |
| Qwen | `revoice` | recognition | 100 | 0 | 75 |
| Qwen | `reframe` | recognition | 100 | 75 | 75 |
| Gemini | `none` | flat | 0 | 0 | 0 |
| Gemini | `revoice` | recognition | 75 | 0 | 50 |
| Gemini | `reframe` | recognition | 100 | 0 | 75 |

The inference is modest but useful: when the public learner transcript contains
an eligible misframing anchor, a visible revisit intervention can create the form
the poetics instrument is looking for without relying on a stated "aha".

### 3.4 Bounded D1/D3/D6 scale-up after the progress note

The next bounded target run kept D1/D3/D6 on paired
`none,revoice,reframe` continuations and generated a fresh uncued D2/D4 control
pair. It exposed two more ordinary public reframe forms that the admission
heuristic needed to accept:

- "I was making the clock do too much ... the sharper test is ..."
- "That framing asks the decimal check to do the proof work ..."

Those now have regression coverage. Revalidating the generated D6/D3/D1 reframe
samples against the updated warning logic returns no admission warnings.

The target scorer readout is:

| Critic | Policy | Recognition count on D6/D3/D1 |
|---|---|---|
| Qwen | `none` | 0/3 |
| Qwen | `revoice` | 2/3 scored; D3 parse failed twice |
| Qwen | `reframe` | 3/3 |
| Gemini | `none` | 0/3 |
| Gemini | `revoice` | 1/3 |
| Gemini | `reframe` | 3/3 |

The bounded target signal is therefore stronger for `reframe` than for
`revoice`, with `none` still flat across both critics. The fresh controls are less
settled than the earlier control probe: Gemini still reads D4 flat and D2 trap,
while Qwen reads D4 flat and D2 recognition. The D2 disagreement needs inspection
before that generated control pair is treated as a stable trap check.

Inspection shows why: in the disputed D2 generation, the final learner turn
returns to the earlier "neat spread" question and narrows it into a "roomier
rule" formulation, giving Qwen a real textual hook for over-attributed or genuine
re-reading. A tighter D2 trap probe still split Gemini/Qwen. A replacement search
over uncued v3 trap candidates is more promising: both critics read D10
(`history is written by the winners`) as trap in the first candidate draw, while
D16 (`10% brain myth`) split in the same way D2 did. A second uncued D10 draw
also lands as trap for both critics, making D10 the provisional replacement trap
control for the next bounded target/control batch.

### 3.5 Repo-local bounded v1 batch

The next run moved the accepted bounded artifacts out of `/tmp`. The manifest is
`PHASE2-BOUNDED-V1-MANIFEST.md`; the target artifacts live under
`phase2-bounded-targets-v1/`, and controls under
`phase2-bounded-controls-v1/`.

The accepted target draw required two admission fixes before scoring. D3's
quoted revoice opening contained an ellipsis that made the overlap probe stop too
early, and D1 used the natural replacement form "the stronger start is the
fraction assumption". `--reclean` now refreshes current quality warnings in
held-out traces and existing keys, so those exact generated branches were
revalidated without a paid regeneration.

The persisted target readout is narrower than the best temp probe but still
separates cue intensity:

| Critic | `none` recognitions on D6/D3/D1 | `revoice` | `reframe` |
|---|---:|---:|---:|
| Qwen | 0/3 | 1/3 | 2/3 |
| Gemini | 0/3 | 0/3 | 2/3 |

Gemini initially failed to parse D1's math-heavy `none` score twice because raw
LaTeX backslashes leaked into its JSON evidence. The shared poetics JSON parser
now uses JSON repair before giving up; the retried artifact scores all three
`none` continuations as flat.

D4 remains the stable flat control on this accepted draw for both critics. A
fresh plain D10 draw did not hold as the trap control: Gemini called it trap,
while Qwen left its repeated "Oh, I get it" language in the flat band. D10 now
has a bounded voice pressure toward an emphatic premature breakthrough without a
revisit cue. The fresh `d10-emphatic` draw is trap for both critics:

| Control | Qwen | Gemini |
|---|---|---|
| D4 flat control | flat | flat |
| D10 plain draw | flat | trap |
| D10 emphatic draw | trap | trap |

The working inference is now more precise: `reframe` adds the strongest positive
pressure in the current target set, `revoice` is not yet a reliable weaker arm,
and trap control production needs explicit costume pressure if it is to stay
separate from ordinary flat correction across critics.

## 4. Guardrails learned the hard way

These are now operating constraints for the next runs:

- Compare **effective** policy, not branch-directory labels alone.
- Reject or regenerate a requested reframe branch if the anchor gate downgrades
  it.
- Reject or regenerate a revoice/reframe branch if the public learner turn does
  not visibly perform the cue.
- Keep paired continuations fixed-prefix while comparing cue intensity.
- Keep controls in the batch. A positive target set without flat/trap controls
  does not tell us whether the scorer has simply become permissive.
- Do not treat one human label stream as ground truth for the generator tuning
  loop. Preserve it as reader evidence and keep critics independent of generation
  where possible.
- Do not scale N before acceptance checks and artifact persistence are less
  dependent on ad hoc `/tmp` probes.

## 5. What remains to do

The next work should stay bounded:

1. Repeat the repo-local target/control batch once more to see whether the
   accepted `reframe` 2/3 signal and `d10-emphatic` trap control hold on a fresh
   draw.
2. Decide whether `revoice` remains an experimental weak arm or should be dropped
   from the first scaled production path in favour of `none` versus `reframe`.
3. Regenerate or exclude arms that quality warnings mark as downgraded,
   unrevoiced, unreframed, leaked, truncated, or too short.
4. Decide how the original Phase-2 human transfer gate should coexist with the
   current "human as perspective, not oracle" stance before making any larger
   transfer claim.
5. Only then increase script production and evaluation together, using the
   existing scorer/labeller interfaces rather than a separate closed-loop oracle.

## 6. Reproducible command shape

The current bounded paired run shape is:

```bash
CODEX_REASONING_EFFORT=high node scripts/generate-pedagogical-dramas.js \
  --generator codex \
  --spec config/poetics-calibration/phase2-dramas-v2.yaml \
  --only D1,D3,D6 \
  --max-turns 3 \
  --paired-continuation-policies none,revoice,reframe \
  --director-revisit-anchor misframing-candidate \
  --out-dir /tmp/<batch>/sample \
  --delib-dir /tmp/<batch>/delib \
  --transcripts-dir /tmp/<batch>/transcripts \
  --key /tmp/<batch>/key.yaml \
  --force
```

Score each accepted policy arm independently:

```bash
node scripts/score-poetics-phase2.js \
  --model qwen/qwen3.5-plus-02-15 \
  --sample-dir /tmp/<batch>/sample/revoice \
  --key /tmp/<batch>/key-revoice.yaml \
  --out /tmp/<batch>/score-revoice-qwen.json
```

Repeat with `google/gemini-3.5-flash` as the current second critic. Use
`--allow-quality-warnings` only when the exact generated trace has been
revalidated against newer warning logic and the held-out key is known to be stale;
otherwise let warnings block scoring.
