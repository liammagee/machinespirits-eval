# Tutor PR benchmark calibration

This is the human calibration lane for the lightweight tutor PR benchmark. It
compares the deterministic audit's decisions with independent judgments of the
same exact candidate, frozen public context, and turn-level criteria. Every
command in this lane is artifact-only: it does not launch Codex, Claude Code,
an API judge, a learner, or another conversation turn.

The live benchmark can be run earlier by one person and labelled later by
others. A calibration workspace contains a blinded packet, a separately hashed
machine key, one resumable sidecar per coder, optional adjudication, and a
report-only analysis.

## End-to-end pathway

### 1. Produce or locate a completed benchmark report

When the authenticated CLIs are available, run the benchmark as documented in
[`docs/tutor-pr-benchmark.md`](tutor-pr-benchmark.md). Keep the resulting
`report.json`; this is the only stage that makes model calls.

The remaining stages can happen later and alongside ordinary labelling work.
Choose a private workspace under Git's common report directory so it is shared
by linked worktrees but is not committed:

```bash
CALIBRATION_ROOT="$(git rev-parse --git-common-dir)/machinespirits-reports/tutor-pr-benchmark/calibration/dev-001"
```

### 2. Freeze a blinded development packet

```bash
npm run tutor:stub:pr-benchmark:calibrate -- prepare \
  --report /absolute/path/to/report.json \
  --purpose development \
  --out "$CALIBRATION_ROOT"
```

`prepare` makes zero model calls. It writes:

| Artifact | Visibility and purpose |
| --- | --- |
| `packet.json` | Give to coders. Contains only the frozen public context, exact candidate, criterion, and codebook. |
| `machine-key.json` | Keep from coders. Contains model identity, deterministic audit labels, failures, and source provenance. |
| `manifest.json` | Hashes the packet, machine key, config, source report, and item count. |
| `labels/rater-*.json` | One atomic, resumable sidecar per coder; created by `label`. |
| `adjudication.json` | Gold decisions only for disagreements or `unsure` labels. |
| `analysis.json` / `analysis.md` | Confusion metrics and inter-rater agreement; created by `analyze`. |

The packet and machine key must remain together in the workspace, but coders
should interact through the `label` command and should not inspect the key.

### 3. Label independently, at human pace

Each coder uses a stable local identity:

```bash
npm run tutor:stub:pr-benchmark:calibrate -- label \
  --workspace "$CALIBRATION_ROOT" \
  --coder coder-a
```

```bash
npm run tutor:stub:pr-benchmark:calibrate -- label \
  --workspace "$CALIBRATION_ROOT" \
  --coder coder-b
```

The CLI shows the frozen public prefix and exact candidate, then asks for
`pass`, `fail`, or `unsure` on each axis. It saves after every whole item. Enter
`q` at an axis prompt to pause; rerunning the same command skips saved items.

Coders may work concurrently because each identity writes a different atomic
sidecar. This lane does not use the evaluation database, browser labelling
server, localhost port, or model CLIs, so it can run alongside the consolidated
labelling game or other human review. Do not share a coder identity between
people or let one coder see another's labels before both finish.

Check progress at any time:

```bash
npm run tutor:stub:pr-benchmark:calibrate -- status \
  --workspace "$CALIBRATION_ROOT"
```

The computed terminal states are:

| State | Next action |
| --- | --- |
| `awaiting_labels` | Complete the first independent packet. |
| `awaiting_second_coder` | Complete another independent packet. |
| `awaiting_adjudication` | Resolve only the listed disagreements. |
| `ready_to_analyze` | Freeze the current human evidence into an analysis. |
| `complete` | Analysis matches the current packet, labels, and adjudication. |

Changing a coder or adjudication artifact after analysis changes the evidence
fingerprint and returns the workspace to `ready_to_analyze`.

### 4. Adjudicate disagreements

After both coders finish, a third identity reviews only disagreements:

```bash
npm run tutor:stub:pr-benchmark:calibrate -- adjudicate \
  --workspace "$CALIBRATION_ROOT" \
  --coder adjudicator-a
```

The adjudicator sees the frozen item and both coder values. Adjudication is
also atomic and resumable. A unanimous `unsure` still requires an explicit
gold `pass` or `fail`; it is not silently counted as agreement.

### 5. Analyze agreement with the deterministic audit

```bash
npm run tutor:stub:pr-benchmark:calibrate -- analyze \
  --workspace "$CALIBRATION_ROOT"
```

For each axis, the report gives the fail-positive confusion matrix, agreement,
precision, recall, specificity, first-two-coder agreement, and Cohen's kappa.
This is diagnostic evidence, not a pass/fail gate. Version 1 deliberately has
`analysis.enforcement: report_only`, unapproved threshold fields, and
`promotion_eligible: false`.

## Calibration discipline

Use development packets to revise case wording, label definitions, and audit
guards. Because those labels influenced the revision, they cannot validate the
result. Keep a short decision log for every guard or codebook change, including
which false positive or missed failure motivated it.

After the definitions are stable:

1. Write and review proposed thresholds in
   `config/tutor-pr-benchmark-calibration.yaml`; do not derive and validate them
   on the same packet.
2. Generate a fresh benchmark report whose candidate items were not in any
   development packet.
3. Prepare it with `--purpose acceptance` before opening any labels.
4. Run the same two-coder and adjudication process without changing the audits,
   codebook, or thresholds.
5. Review per-axis counts as well as rates. Six strong-preset candidates are a
   useful qualitative screen but too few to justify a stable automated
   threshold by themselves.
6. Move the local pre-push hook from `report_only` to `blocking` only in a
   separate reviewed change after the held-out acceptance evidence and failure
   policy have been approved.

If acceptance exposes a problem, record the result and return to development;
do not tune on the acceptance packet and continue calling it held out. Prepare
a new acceptance packet after the next frozen revision.

## Privacy and recovery

Candidates may contain exactly the leakage or unsupported claims the benchmark
is designed to catch. Keep workspaces in the Git-common private report area by
default. Do not commit or paste `packet.json`, `machine-key.json`, coder
sidecars, or rejected candidate text into a public PR without review.

The workspace is intentionally plain JSON. Backing up the whole directory
preserves every required hash-linked artifact. If a provenance check fails,
restore the original artifact or prepare a new workspace; do not edit hashes to
make a modified packet appear valid.
