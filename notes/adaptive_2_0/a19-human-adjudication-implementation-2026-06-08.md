# A19 Human Adjudication Implementation Provenance

Date: 2026-06-08.
Branch: `codex/a19-drama-axiom-framework`.
Source roadmap: `notes/adaptive_2_0/a19-human-adjudication-roadmap.html`.

## Interpretation Of The GPT Pro Roadmap

The roadmap is best treated as a methodological plan, not as a new empirical
claim. Its central recommendation is to move A19's next step from transfer
proof to construct-boundary validation. The preserved ambiguous v0.8 packet
should be used to test whether independent humans can distinguish
`learner_standing_repair` from nearby public repair types, especially
`claim_address_repair`.

This preserves the A19 exhaustion result:

- v0.8 has one local policy-headroom card, but it is not clean because it carries
  target-granularity risk;
- the remaining v0.8 siblings are recursive-full S0 ceilings;
- human adjudication can refine the codebook and validate construct boundaries;
- human adjudication cannot retroactively turn v0.8 into a clean transfer claim.

## Technical Harness Implemented

New versioned codebook:

- `exports/a19/adjudication-codebooks/learner-standing-v01.codebook.json`

New scripts:

- `scripts/create-a19-human-adjudication-assignment.js`
- `scripts/run-a19-human-adjudication-cli.js`
- `scripts/validate-a19-human-coder-file.js`
- `scripts/report-a19-human-boundary-adjudication.js`

New dashboard surface:

- `routes/a19AdjudicationRoutes.js`
- `public/adjudication/index.html`
- `server.js` mounts `/api/a19/adjudication` and `/adjudication`

Extended script:

- `scripts/merge-a19-adjudication-codes.js`

New package scripts:

- `npm run a19:adjudication-assign`
- `npm run a19:adjudicate`
- `npm run a19:adjudication-validate`
- `npm run a19:adjudication-merge`
- `npm run a19:human-boundary-report`
- `npm run test:a19:human-adjudication`
- `npm run test:a19:dashboard`

New tests:

- `tests/a19HumanAdjudication.test.js`

The harness covers assignment redaction, colorized interactive coder-file
creation, packet-hash validation, missing rationale rejection, duplicate coder
rejection, single-coder diagnostic status, two-plus-coder agreement-ready status,
raw-code preservation before answer-key mapping, and visible-alias-audit
propagation into the boundary report.

The web form intentionally lives on the existing eval dashboard server
(`server.js`) rather than adding another process. Locally it is available at
`/adjudication/` on the dashboard server, with API calls under
`/api/a19/adjudication`. This avoids extending the existing split between the
eval dashboard and the poetics workbench. Public exposure remains future work:
the dashboard already has bind-tied basic auth, but external coder use should
also add explicit coder/session assignment controls before any non-localhost
deployment.

## Frozen Assignment State

The real human assignment has been generated from the preserved v0.8 ambiguous
packet.

Coder-facing assignment:

- `exports/a19/human-coder-assignments/moral-disclosure-standing-repair-a.assignment.json`

Private assignment key:

- `exports/a19/human-coder-assignments/moral-disclosure-standing-repair-a.assignment-key.json`

Important: coders should not open the assignment key before coding.

Assignment identifiers:

- assignment ID: `a19-human-mdsr-a-2026-06-08`
- packet SHA-256:
  `2d8b95629cb0d773b7e05e38c9a7c009a4ae9cdbd70268362251890fe4389643`
- codebook ID: `learner-standing-v01`
- public arms: `arm_alpha`, `arm_beta`
- visible-alias hit count: 1

Leakage inspection of the coder-facing assignment:

- no `S0_no_policy` literal;
- no `S1_policy_memory` literal;
- no private-key literal;
- no explicit target/decoy alias list.

The one visible-alias hit remains in public transcript text and is part of what
coders should evaluate as possible, harmless, or decisive wording leakage.

## Pre-Human Baseline Report

A no-coder merge and boundary report have been generated to prove the harness is
ready but blocked on human input.

No-coder merge:

- `exports/a19/adjudication-reports/moral-disclosure-standing-repair-a.human-coders.json`
- status: `no_coder_files`

No-coder boundary report:

- `exports/a19/adjudication-reports/moral-disclosure-standing-repair-a.human-boundary-report.json`
- `exports/a19/adjudication-reports/moral-disclosure-standing-repair-a.human-boundary-report.md`
- status: `no_coder_files`

## Single-Coder Diagnostic State

After the first human-coding pass, the same harness produced one validated coder
file and a single-coder boundary report:

- coder file:
  `exports/a19/human-coder-submissions/moral-disclosure-standing-repair-a/coder-001.json`
- merged report:
  `exports/a19/adjudication-reports/moral-disclosure-standing-repair-a.human-coders.json`
- boundary report:
  `exports/a19/adjudication-reports/moral-disclosure-standing-repair-a.human-boundary-report.md`
- status: `single_coder_diagnostic_only`

The single coder preferred `arm_alpha` for the learner-standing target reason
and reported `alias_leakage_assessment = none_observed`. This supports codebook
revision and v0.9 family design only. It does not establish inter-rater
agreement, does not license an A19 transfer claim, and does not license Paper
2.0, atlas, or sidecar empirical claims.

## Human Coding Instructions

Use only these two files while coding:

1. `exports/a19/human-coder-assignments/moral-disclosure-standing-repair-a.assignment.json`
2. `exports/a19/adjudication-codebooks/learner-standing-v01.codebook.json`

Do not open these files until after all coder submissions are complete:

- `exports/a19/human-coder-assignments/moral-disclosure-standing-repair-a.assignment-key.json`
- `exports/a19/adjudication-packets/moral-disclosure-standing-repair-a.packet.json`
- any `*.human-coders.json` merge report
- any prior S0/S1 replay or blind-adjudication output for this packet

Recommended coder inclusion criteria:

- at least two independent coders are needed for agreement;
- three coders is preferred for a high-value boundary result;
- coders should be expert or semi-expert readers of the repair taxonomy;
- coders should not know which arm used policy memory;
- coders should not know the target/decoy alias list;
- coders should not inspect the private assignment key before submitting.

Each coder should run the interactive CLI rather than editing JSON directly:

```bash
npm run a19:adjudicate -- --coder-id coder-001
```

The command reads the blinded assignment and codebook, prompts through all
allowed labels, writes the coder file, and validates it immediately. By default
it writes to:

`exports/a19/human-coder-submissions/moral-disclosure-standing-repair-a/coder-001.json`

Use `--coder-id coder-002` and `--coder-id coder-003` for additional independent
coders. The command accepts `--assignment`, `--codebook`, `--out-dir`, `--out`,
`--coder-role`, and `--overwrite` if a later assignment needs the same workflow.

For each of `arm_alpha` and `arm_beta`, add one `arm_judgments` entry with:

- `arm_public_id`: `arm_alpha` or `arm_beta`;
- `primary_label`: one label from the codebook;
- `target_status`: `target`, `near_target`, `non_target`, or `unclear`;
- `target_granularity_risk`: `true` or `false`;
- `obligations`: each required obligation marked `present`, `partial`,
  `absent`, or `unclear`;
- `excluded_moves_present`: `["none"]` or one or more excluded moves from the
  codebook;
- `evidence_spans`: short public quotes supporting the judgment;
- `rationale`: 2-5 sentences;
- `confidence`: number from 0 to 1.

Pairwise judgment values:

- `better_arm_public_id`: `arm_alpha`, `arm_beta`, `neither`, or `unclear`;
- `better_for_target_reason`: `true` only if the arm is better specifically
  because it restores learner standing, not merely because it is warmer,
  clearer, more cautious, or more fluent;
- `alias_leakage_assessment`: `none_observed`,
  `harmless_generic_wording`, `possible_hint`, or
  `decisive_contamination`.

## Validation Commands For Completed Coder Files

Validate each coder independently:

```bash
npm run a19:adjudication-validate -- \
  --assignment exports/a19/human-coder-assignments/moral-disclosure-standing-repair-a.assignment.json \
  --coder exports/a19/human-coder-submissions/moral-disclosure-standing-repair-a/coder-001.json \
  --codebook exports/a19/adjudication-codebooks/learner-standing-v01.codebook.json
```

Merge all completed coders:

```bash
npm run a19:adjudication-merge -- \
  --packet exports/a19/adjudication-packets/moral-disclosure-standing-repair-a.packet.json \
  --assignment exports/a19/human-coder-assignments/moral-disclosure-standing-repair-a.assignment.json \
  --assignment-key exports/a19/human-coder-assignments/moral-disclosure-standing-repair-a.assignment-key.json \
  --coders exports/a19/human-coder-submissions/moral-disclosure-standing-repair-a/*.json \
  --out exports/a19/adjudication-reports/moral-disclosure-standing-repair-a.human-coders.json
```

Generate the boundary report:

```bash
npm run a19:human-boundary-report -- \
  --merged exports/a19/adjudication-reports/moral-disclosure-standing-repair-a.human-coders.json \
  --out-json exports/a19/adjudication-reports/moral-disclosure-standing-repair-a.human-boundary-report.json \
  --out-md exports/a19/adjudication-reports/moral-disclosure-standing-repair-a.human-boundary-report.md
```

## Signal To Continue

When human coding is complete, send this signal:

`A19 human adjudication ready`

Include the coder file paths. Example:

```text
A19 human adjudication ready
coder files:
- exports/a19/human-coder-submissions/moral-disclosure-standing-repair-a/coder-001.json
- exports/a19/human-coder-submissions/moral-disclosure-standing-repair-a/coder-002.json
```

If there is only one coder, send:

`A19 single-coder diagnostic ready`

That will let the next step run validation and preserve the single-coder result
without reporting agreement.

## Current Stop Condition

One human coder file has been returned and validated:

- `exports/a19/human-coder-submissions/moral-disclosure-standing-repair-a/coder-001.json`
- validation status: `pass`
- coder count: 1
- merge status: `single_coder_diagnostic_only`

Generated diagnostic artifacts:

- `exports/a19/adjudication-reports/moral-disclosure-standing-repair-a.human-coders.json`
- `exports/a19/adjudication-reports/moral-disclosure-standing-repair-a.human-boundary-report.json`
- `exports/a19/adjudication-reports/moral-disclosure-standing-repair-a.human-boundary-report.md`

Unblinded only after raw coder preservation:

- `arm_alpha` maps to `S1_policy_memory`;
- `arm_beta` maps to `S0_no_policy`.

Coder-001 classified `arm_alpha` as `advice_substitution` with
`target_status: near_target`, and `arm_beta` as `moral_flattery` with
`target_status: non_target`. The pairwise judgment preferred `arm_alpha` for the
target-construct reason. The coder reported `alias_leakage_assessment:
none_observed`.

Because there is only one coder, agreement statistics remain unavailable:

- pairwise mean Cohen kappa: `n/a`;
- nominal Krippendorff alpha: `n/a`;
- humans distinguish target from claim-address: `not_established`.

This licenses only a single-coder construct-boundary diagnostic, codebook
revision, and v0.9 family-design evidence. It does not license an A19 transfer
claim, Paper 2.0 claim, atlas projection, sidecar claim, human-learning claim,
deployed-tutor claim, model-weight-learning claim, or main-harness rate-effect
claim.

The next stop condition is independent coding by at least one additional coder,
preferably two, using the same assignment and codebook before any agreement or
construct-boundary stability result is reported.
