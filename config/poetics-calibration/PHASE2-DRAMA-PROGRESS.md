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

### 3.6 Repo-local bounded v2 repeat

The repeat batch narrows the target comparison to `none` versus `reframe` and
repeats the bounded controls. Its manifest is
`PHASE2-BOUNDED-V2-MANIFEST.md`.

D1 again exercised the admission detector before scoring: its reframe says the
decimal scrap was "framed as proof when it is only a check". That is a public
framing-problem statement, so the detector now accepts both that form and the
older inverse "only a check, not a proof" form. The generated D1 branch was
revalidated with `--reclean`.

The v2 repeat target readout is:

| Critic | `none` on D6/D3/D1 | `reframe` on D6/D3/D1 |
|---|---|---|
| Qwen | trap, flat, flat | recognition, recognition, recognition |
| Gemini | trap, flat, flat | recognition, recognition, recognition |

The repeat controls hold:

| Control | Qwen | Gemini |
|---|---|---|
| D4 | flat | flat |
| D10 emphatic | trap | trap |

That is enough to stop demanding that every uncued target continuation be flat.
For this mechanism check the critical negative baseline is
**non-recognition** under `none`; the scorer's flat/trap split remains covered by
external controls. Across v1 and v2, `none` has produced zero recognitions under
both critics, while `reframe` strengthened from 2/3 in v1 to 3/3 in v2.

### 3.7 Scaled v3 target-variety batch

The first scale step widens targets before repeats. It takes the six v3
recognition-lean scenarios D7, D9, D11, D14, D17, and D18 across chemistry,
statistics, linguistics, ecology, geology, and law, preserving the v3 T-id offset
and comparing only paired `none` versus `reframe` continuations. The manifest is
`PHASE2-SCALED-V1-MANIFEST.md`.

The first attempted broad pass exposed the scaled target-eligibility issue more
sharply. D11 and D9 visibly owned their misconception but did not use the strong
anchor-gate self-framing markers, so requested reframes downgraded to reconsider;
the same run later stopped on a transient D17 Codex tutor-ego timeout. The v3
target voice constraints now ask for ordinary public markers such as "I thought",
"I assumed", or "first instinct" while leaving the instructional outcome open.
The retry kept strong reframe cues and reached all six targets.

The broader batch also extended the public admission detector rather than hiding
valid generated branches behind stale warnings. New accepted forms include:

- "called it sloppiness before checking the speaker's rule"
- "made significance stand in for importance"
- "the problem ... was taking this whole deep shape as proof"
- "that way of reading it mixes up the event with what the evidence has proved"
- "clear may mean not visible, not absent"

With those branches revalidated from held-out traces, the scaled target result is
clean:

| Critic | `none` recognitions on six v3 targets | `reframe` recognitions |
|---|---:|---:|
| Qwen | 0/6 | 6/6 |
| Gemini | 0/6 | 6/6 |

Fresh controls stayed separated for the same batch:

| Control | Qwen | Gemini |
|---|---|---|
| D4 flat | flat | flat |
| D10 emphatic trap | trap | trap |

This is the first evidence that the bounded decision generalises across new
disciplines and both tutor conditions under the current Director mechanism. It
is still diagnostic production evidence, not a transfer claim.

### 3.8 Scaled v3 stress slice

The next scale step exercised the remaining uncued v3 stress setups instead of
adding positive repeats immediately. Its manifest is
`PHASE2-SCALED-STRESS-V1-MANIFEST.md`; the committed artifacts live under
`phase2-scaled-stress-v1/`.

This slice covers D8, D12, D13, D15, and D16 across economics, computer science,
astronomy, art history, and psychology. It keeps the Director revisit policy at
`none`, so the batch asks whether impasse, sticky-flat, ordinary-flat, and
costume-trap material stays out of the recognitive band after the target
mechanism widened.

Both current critics agree:

| Scenario | Stress role | Qwen | Gemini |
|---|---|---|---|
| D8/T07 | impasse | flat | flat |
| D13/T09 | sticky flat | flat | flat |
| D15/T11 | impasse | flat | flat |
| D12/T15 | ordinary flat | flat | flat |
| D16/T17 | costume trap | trap | trap |

That closes the immediate stress-coverage gap left by the scaled target batch:
the six new positive v3 targets separate under `reframe`, while the remaining
uncued v3 stress slice contributes no recognitions under either critic.

### 3.9 Scaled v3 target repeat

The first repeat keeps the same six v3 positive setups and fixed-prefix
`none,reframe` comparison. Its manifest is `PHASE2-SCALED-V2-MANIFEST.md`; the
artifacts live under `phase2-scaled-targets-v2/`.

The repeat initially looked like a quality failure because every reframe branch
tripped the admission detector. Inspection showed that the generated branches
had used additional ordinary public forms the detector did not yet accept:
corrections counting as rules, sudden-event-first canyon wording, fact-like legal
framing, deer-count stopping points, visibility versus balance, and significance
being "too quick". Those forms now have regression coverage, and `--reclean`
refreshes the branch keys and held-out traces to clean status without a paid
regeneration.

The scored repeat is less perfect than scaled v1:

| Critic | `none` recognitions on six v3 targets | `reframe` recognitions |
|---|---:|---:|
| Qwen | 1/6 | 6/6 |
| Gemini | 1/6 | 4/6 |

Both critics read the same uncued D11/T08 linguistics branch as recognitive. That
branch is not a hidden cue leak: the learner publicly returns to its earlier
"outside the rules" worry and turns it into a repeated-versus-right-now dialect
pattern. Gemini also leaves the compressed D9/T10 statistics reframe and the
incremental D14/T16 ecology reframe flat, while Qwen reads both as recognitive.

Fresh controls beside the repeat still separate under both critics:

| Control | Qwen | Gemini |
|---|---|---|
| D4/T01 flat | flat | flat |
| D10/T14 emphatic trap | trap | trap |

The repeat therefore tightens the operating claim. The Director reframe cue still
adds positive pressure across the scaled v3 targets, but uncued recognition can
emerge from the bilateral roles themselves and not every accepted reframe branch
crosses every critic's recognitive threshold.

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

The next work now has a pre-specified production shape in
`PHASE2-PRODUCTION-V1-PLAN.md` and `scripts/run-poetics-production-batch.js`.
The broad run should use that runner rather than hand-assembling another probe:

1. Run `phase2-production-v1`, or run `--only target-r01` first if quota/runtime
   needs an attended checkpoint.
2. Keep `none` versus `reframe` as the first scaled target contrast and keep
   `revoice` as an exploratory weak arm.
3. Keep explicit flat and trap controls in each scored batch; do not infer
   control behavior from the uncued target arm alone.
4. Regenerate or exclude arms that quality warnings mark as downgraded,
   unrevoiced, unreframed, leaked, truncated, or too short.
5. Decide how the original Phase-2 human transfer gate should coexist with the
   current "human as perspective, not oracle" stance before making any larger
   transfer claim.

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
