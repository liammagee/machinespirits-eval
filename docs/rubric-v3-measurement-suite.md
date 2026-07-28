# Rubric v3.0 measurement suite

Rubric v3.0 is an opt-in, prospective measurement epoch. It does not replace
the active v2.2 files and must not be mixed into Paper 2.0 analyses.

## Why v3.0 exists

The v2.2 tutor rubric did not have one unusually low eigenvalue. It had one
very large eigenvalue and seven small residual eigenvalues. On 1,584 scored
tutor turns:

- the first eigenvalue was 6.45 and PC1 explained 80.7% of variance;
- the remaining eigenvalues ranged from 0.46 to 0.08;
- only one eigenvalue exceeded 1;
- mean inter-dimension correlation was 0.776; and
- a forced two-factor rotation separated `content_accuracy` from the seven
  pedagogical dimensions.

That is evidence that the eight v2.2 tutor-turn dimensions mostly behaved as
one general quality judgment plus content accuracy. It is a discriminant
sensitivity problem: several labels did not yield several independently moving
signals.

The reproduction command remains:

```bash
EVAL_DB_PATH=/Users/lmagee/.machinespirits-data/evaluations.db \
  node scripts/analyze-rubric-pca.js --json
```

## What the suite measures

| Level | Evidence | Instrument | Question |
| --- | --- | --- | --- |
| Exact PR turn | Frozen prefix and exact candidate | PR benchmark rubric v1.0 | Should this next tutor turn pass its authored contract? |
| Tutor turn | Public prefix and exact tutor response | v3.0 tutor-turn rubric | How good is the teaching, and is its content accurate? |
| Tutor trajectory | Full public dialogue | v3.0 tutor-trajectory rubric | Did the tutor adapt, progress, and close well across turns? |
| Learner change | Public learner messages | v3.0 learner rubric | Is there visible understanding, revision, transfer, and agency? |
| Encounter | Full public dialogue | v3.0 dialogue rubric | Did reciprocal adaptation and joint progression emerge? |
| Hidden process | Ego-superego-revision trace | v3.0 deliberation rubric | Did critique and revision add value, and did the process learn? |
| Reliability | Repeated scores of identical items | Aggregate QA analysis | Do results survive scenario, generator, and judge changes? |

The learner instrument measures transcript-visible change. For a simulated
learner it is not evidence of durable human learning. Human post-test,
out-of-dialogue transfer, and delayed retention remain separate outcome
measures.

The suite manifest is
[`config/rubrics/v3.0/measurement-suite.yaml`](../config/rubrics/v3.0/measurement-suite.yaml).
The five runnable evaluation rubrics are in the same directory. The narrow PR
acceptance rubric remains
[`config/tutor-pr-benchmark-rubric.yaml`](../config/tutor-pr-benchmark-rubric.yaml)
and has its own version, 1.0.

## Scoring design

The tutor-turn instrument follows the observed factor structure directly:

- `overall_pedagogical_quality`: integer 1–10, weighted 85%; and
- `content_accuracy`: integer 1–5, weighted 15%.

Each component is normalized to 0–100 before weighting. Thus quality 10 plus
accuracy 1 yields 85, while both maxima yield 100. Raw component scores are
retained; the aggregate is never the only evidence.

Content accuracy has an explicit N/A state. A turn with no assessable factual
or domain claim is stored as `score: null, not_applicable: true`; it is excluded
from the weighted aggregate. It is never converted to a maximum score. This
prevents reflective questions and other claim-free turns from creating a false
accuracy ceiling.

The 1–10 quality scale creates headroom, but it does not by itself prove higher
sensitivity. Calibration must check observed spread, floor/ceiling compression,
known contrasts, and agreement.

The other instruments remain multi-dimensional because they use different
evidence and answer different questions. Their dimensions are not being
claimed as independent until calibration supports that interpretation.

## Runnable calibration pathway

This pathway is intentionally separable from model generation and ordinary
human labelling. Only the scoring steps call model CLIs; the audit and existing
PR calibration workflow are read-only/artifact-only.

### 1. Freeze a development corpus

Use a small set of exact responses rather than generating new full
conversations. Recommended first packet:

- 3–5 scenarios that include weak, middling, and strong responses;
- at least one factual-error contrast and one adaptation failure;
- 20–30 exact tutor responses or frozen dialogue prefixes;
- two candidate generators: Codex `gpt-5.6-terra` at medium effort and Claude
  Code `claude-sonnet-5` at medium effort; and
- no item that will later be used as held-out acceptance evidence.

The existing lightweight PR benchmark already freezes three accepted
transcript prefixes and runs those two generator families. Its attended command
is:

```bash
npm run tutor:stub:pr-benchmark
```

Its human pass/fail calibration remains a separate, zero-call workflow:

```bash
npm run tutor:stub:pr-benchmark:calibrate -- --help
```

See [`docs/tutor-pr-benchmark-calibration.md`](tutor-pr-benchmark-calibration.md)
for independent coding, adjudication, and held-out acceptance.

For dialogue-level v3.0 calibration, choose an existing source run containing
the exact frozen transcripts. Do not regenerate those transcripts between
judges.

### 2. Score the frozen responses under v3.0

The version flag clones source rows into a derived run, so historical v2.2 rows
remain unchanged:

```bash
node scripts/eval-cli.js evaluate <source-run-id> \
  --rubric-version 3.0 \
  --judge-cli claude \
  --model claude-sonnet-5 \
  --effort medium \
  --parallelism 1
```

Record the derived run ID printed by the command. The stored tutor, learner,
dialogue, and deliberation version columns will read `3.0`.

### 3. Rejudge the identical items

Rejudge the v3.0 derived run with the other local CLI. Keep the version flag;
without it, the active v2.2 rubric would be used.

```bash
node scripts/eval-cli.js rejudge <v3-derived-run-id> \
  --rubric-version 3.0 \
  --judge-cli codex \
  --model gpt-5.6-terra \
  --effort medium \
  --source-judge claude-code/claude-sonnet-5@medium
```

Rejudgment creates new rows by default. This is required for same-response
inter-judge reliability; do not use `--overwrite`.

### 4. Run the zero-call sensitivity audit

```bash
npm run rubric:v3:audit -- \
  --runs <v3-derived-run-id> \
  --version 3.0
```

Machine-readable output:

```bash
npm run rubric:v3:audit -- \
  --runs <v3-derived-run-id> \
  --version 3.0 \
  --json
```

The report is read-only and makes no model calls. For every available
instrument it reports:

- complete observation count;
- scenario, generator, profile, and judge coverage;
- mean, standard deviation, observed range, floor rate, and ceiling rate;
- inter-dimension correlation, eigenvalues, and PC1 share when estimable; and
- same-item cross-judge correlation and mean absolute error.

The repository's established reliability analysis can also be run on the v3
epoch:

```bash
node scripts/analyze-judge-reliability.js --epoch 3.0
```

Reliability must match the same exact response across judges. Never compare
different responses merely because they share a profile or scenario.

### 5. Compare v2.2 and v3.0 without contaminating either epoch

Use the same frozen source responses, score into separate derived runs, and
report each version independently. The comparison is calibration evidence only.
Check:

1. rank preservation for obvious overall-quality contrasts;
2. whether v3.0 reduces ceiling concentration;
3. whether the 1–10 quality score uses meaningful headroom;
4. whether factual-error contrasts move accuracy without forcing quality to
   move identically;
5. cross-judge agreement on each raw component and the aggregate; and
6. disagreement cases against independent human anchors.

Do not choose a new scale because it correlates maximally with v2.2; perfect
correlation would reproduce the old instrument's limitations. Preserve enough
continuity to recognize clear good/bad cases while rewarding separation on
predeclared contrasts.

### 6. Promote only after held-out acceptance

The suite is report-only while `status: calibration` and
`active_by_default: false`. Before promotion:

1. freeze definitions and any proposed thresholds;
2. create a fresh held-out corpus not used to revise the rubric;
3. obtain independent human labels or ratings before revealing machine scores;
4. repeat both CLI judges on the exact same items;
5. review counts and disagreement examples, not only summary coefficients; and
6. promote the active files in a separate reviewed change.

Until then, v2.2 remains the active historical rubric and v3.0 is explicitly
prospective.

## Initial calibration targets

These are diagnostic targets, not automatic gates:

- enough score spread to avoid a dominant ceiling bin;
- quality/accuracy separation on authored factual-error contrasts;
- stable ordering of obvious anchor cases across judges;
- same-response cross-judge correlation reported with MAE and sample size;
- at least three scenarios and both candidate-generator families; and
- no interpretation of learner transcript scores as human learning outcomes.

With only two tutor-turn components, a low PC1 share is not the sole goal. A
two-variable PCA is largely a restatement of their correlation. The decisive
question is whether the two components respond differently when they should,
while the 1–10 quality factor uses enough of its range to distinguish meaningful
changes.

## Content-accuracy contrast and human-label harness

The committed packet contains 20 opaque-ID items: 15 development items and five
held-out items. Each split is balanced across correct content, minor error,
major error, appropriately qualified contested interpretation, and genuine
N/A. Authored targets stay out of the blinded JSONL and coder sheets.

Prepare independent human work before inspecting machine scores:

```bash
npm run rubric:v3:accuracy -- prepare \
  --split development \
  --out-dir exports/rubric-v3-calibration/human-labelling

npm run rubric:v3:accuracy -- prepare \
  --split held_out \
  --out-dir exports/rubric-v3-calibration/human-labelling
```

Two people fill the `coder-a.csv` and `coder-b.csv` sheets independently. Use
`applicable` plus an integer 1–5, or `not_applicable` with a blank score. If
they disagree, copy a sheet, set `coder_id` to `adjudicated`, and enter the
resolved labels. The analysis command accepts the two coder files and optional
adjudication file through `--human`.

Score a split with the two local medium-effort judges:

```bash
npm run rubric:v3:accuracy -- score --split development \
  --judge-cli claude --model claude-sonnet-5 --effort medium \
  --out exports/rubric-v3-calibration/development-claude.json

npm run rubric:v3:accuracy -- score --split development \
  --judge-cli codex --model gpt-5.6-terra --effort medium \
  --out exports/rubric-v3-calibration/development-codex.json

npm run rubric:v3:accuracy -- analyze --split development \
  --scores exports/rubric-v3-calibration/development-claude.json,exports/rubric-v3-calibration/development-codex.json \
  --human exports/rubric-v3-calibration/human-labelling/development-human-labels-coder-a.csv,exports/rubric-v3-calibration/human-labelling/development-human-labels-coder-b.csv \
  --out exports/rubric-v3-calibration/development-analysis.json
```

The thresholds live in
[`content-accuracy-promotion-thresholds.yaml`](../config/rubrics/v3.0/content-accuracy-promotion-thresholds.yaml).
They were frozen in Git after development scoring and before held-out scoring.
Promotion always requires the machine gates plus two independent human coders
and a complete agreed or adjudicated anchor.

### Development result (2026-07-27)

On the 15 authored development items, Claude Sonnet 5 and Codex GPT-5.6 Terra
agreed on applicability for all items. Across the 12 jointly applicable items,
same-item agreement was r=.952, MAE=.17 on the 1–5 scale, exact agreement
91.7%, and within-one agreement 91.7%. Codex matched all authored targets;
Claude differed on one item by treating a small arithmetic-result error as
major rather than minor. These results pass the frozen machine thresholds, but
they do not satisfy the human gate and do not promote v3.0.

### Held-out machine result (2026-07-27)

The two model judges then scored the five-item held-out packet after the
threshold commit was pushed. They agreed on applicability and on all four raw
applicable scores, and both matched every authored anchor: r=1.00, MAE=0,
exact agreement 100%, and within-one agreement 100%. This clears the held-out
machine gates. `promotion_ready` remains false because both held-out human
coder sheets are deliberately blank.

## Separate follow-on instrument pilot

The follow-on instruments were scored separately on frozen dialogue rows from
three derived v3.0 runs. The packet includes two generator families, both
judges, five or more scenarios for the public instruments, and a distinct
three-dialogue `cell_8_recog_multi_psycho` source with configured tutor and
learner superegos for deliberation. No new conversations were generated.

| Instrument | Complete observations | Same-item pairs | Judge r | MAE (0–100) | PC1 | Eigenvalues |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Tutor trajectory | 19 | 9 | .942 | 7.50 | 79.3% | 2.38, .54, .08 |
| Learner turns | 54 | 24 | .765 | 10.36 | 76.2% | 3.05, .50, .33, .13 |
| Learner trajectory | 19 | 9 | .901 | 8.06 | 71.5% | 2.86, .77, .23, .14 |
| Pedagogical encounter | 18 | 9 | .967 | 9.44 | 91.5% | 2.74, .19, .06 |
| Tutor deliberation | 6 | 3 | .971 | 2.92 | 87.3% | 2.62, .38, .00 |
| Learner deliberation | 13 | 6 | .887 | 11.88 | 91.7% | 2.75, .15, .10 |

These are pilot diagnostics, not validation. Reliability is promising, but
each rubric has one dominant factor and none has a second eigenvalue above 1;
encounter and deliberation are especially compressed. The samples are also
small and opportunistic. Do not interpret the named dimensions as independent
measures yet.

The next calibration cycle should give each instrument its own authored
development/held-out contrasts and human sheets. Change one intended construct
at a time—for example adaptation without closure, revision without transfer,
joint progression without smooth coordination, and valuable critique without
material revision. If those contrasts still move all dimensions together,
collapse that instrument to one holistic score rather than preserving labels
that the judges cannot distinguish.
