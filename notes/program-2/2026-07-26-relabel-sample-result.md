# The 400-record relabel sample: the archive cannot supply labels

2026-07-26. Result of the proportionate version of the sweep planned in
`notes/program-2/2026-07-26-v2-relabel-distill-path.md` §7. 400 records drawn
uniformly (seed 1) from the training archive
`~/.machinespirits-data/step4-claim-runs-2026-07`, re-asked under
`v2_bridge_voiced`, 398 usable (2 unparsed v2 responses). 23 minutes, four
checkpointed passes, `codex/gpt-5.6-terra`.

The conclusion is that the classifier seat closes: this archive cannot be
relabelled into training targets, and the remaining ~4,500 records should not be
swept. The `v2_bridge_voiced` flip itself is untouched by this — see §4.

## 1. The edit accounts for almost none of the movement

The v2 clause adds a requirement to the `omits_warrant` definition and touches
nothing else. So records whose stored label was something *other* than
`omits_warrant` give a noise floor for this very field, rather than the sibling-
field proxy the pilot had to use:

| subset | n | label changed |
|---|---|---|
| v1 label was `omits_warrant` (the edit applies) | 116 | 45.7% |
| v1 label was anything else (the edit cannot apply) | 282 | **39.4%** |

Six points of separation. The instrument re-draws roughly two labels in five on a
re-ask regardless of which rubric it is given.

The 16-record pilot put the floor at 12.5% using the four unedited sibling fields.
On 398 records those same fields run 11.1%–25.9% (pooled 20.2%), and the
field-specific floor above is 39.4%. The pilot understated the floor by a factor
of about three, which is what a 16-record slice is worth.

## 2. A flow the edit is definitionally incapable of causing

Tightening the `omits_warrant` definition can only move records *out* of that
label. Observed:

- 53 records moved out of `omits_warrant`
- **41 records moved in** from labels whose clauses are byte-identical across
  versions

The inflow is four fifths the size of the outflow and none of it is attributable.
Adjacent unedited categories churn just as freely: `cites_public_evidence` retains
only 32.9% of itself, and 48.7% of it lands on `links_evidence_to_rule`. Both
clauses are unchanged.

## 3. The gate-level shift is not distinguishable from zero

| | |
|---|---|
| gate fired under v1 | 44.5% (177/398) |
| gate fired under v2 | 41.2% (164/398) |
| discordant | 53 went silent, 40 newly fire |
| net | −3.27 points, SE 2.42 → **1.35 SE from zero** |

The direction matches the prediction (v2 quiets turns) and the magnitude does not
contradict the ~1.1 point denominator estimate, but at this n the interval covers
zero and covers 5 points. The full 4,900-record sweep would give SE ≈ 0.9, so it
*could* resolve a 3-point shift — but that number is denominator bookkeeping, not
a finding, and §1 is why the corpus is unusable regardless.

## 4. What this does and does not overturn

**Does not touch the v2 flip.** The repair was justified by a different
measurement: cross-family agreement on `omits_warrant` rose 26.2% → 78.6%,
weighted κ 0.583, on a defined held-out set. That is inter-judge agreement about a
construct. This note measures whether re-asking a whole archived classification
reproduces itself, which is a different question with a different answer. New runs
should keep measuring the better-defined construct.

**Does close the archive as a label source.** A target that is ~60% stable to a
re-ask is not trainable. Majority-of-3 would help, but voting three noisy draws
into a label whose single-draw stability is that low is not a repair, and finding
that out costs several more hours of quota.

**Leaves the writer seat where it was.** Nothing here bears on it: the frozen SFT
and KTO corpora key on deterministic guard accounting with no classifier in the
path, and the Phase 5b/5c gaps (+0.236, +0.202) are between-arm comparisons that
lose the same turns in both arms.

## 5. Recommended stop

Do not sweep the remaining records. If a local model for the *when to intervene*
decision is still wanted, the missing piece is not labels — it is that nothing
grades the gate's decisions, so a local gate could not be evaluated against the
frontier one even with a perfect corpus. That grader is the smaller and
prior piece of work.

Reproduce:

```bash
node scripts/relabel-program2-evidence-use.js \
  --archive ~/.machinespirits-data/step4-claim-runs-2026-07 \
  --out exports/evidence-use-v2-relabel/step4-sample.jsonl \
  --sample 400 --seed 1 --report
```
