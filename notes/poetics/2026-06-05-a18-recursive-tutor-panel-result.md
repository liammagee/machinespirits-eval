# A18.5 Recursive Tutor-Learning Panel Result

Date: 2026-06-05

## Claim Boundary

This is a simulated, counterfactual replay result. It is not evidence of human
learning, not evidence of model-weight learning, and not a deployed adaptive
tutor result. The unit is a transcript-family mechanism test: whether a bounded
policy learned from one failed tutoring attempt transfers to a held-out sibling
and survives blind critique as peripeteia-induced adaptation.

## Setup

- Chain: `exports/recursive-tutor-learning/a18-pilot-local`
- Local family gate before panel: `clean_survivor: 2`, `revise_again: 1`
- Panel script: `scripts/run-recursive-tutor-learning-panel.js`
- Panel report: `exports/recursive-tutor-learning/a18-pilot-local/a18.5-panel/a18.5-panel-report.json`
- Critics: `qwen/qwen3.7-max`, `google/gemini-3.5-flash`, `deepseek/deepseek-v4-pro`, `anthropic/claude-sonnet-4.6`, `codex`
- Gate: majority recognition and majority `peripeteia_induced` origin, family-level only.

The wrapper selected only local-gated clean survivors and packaged their revised
held-out public transcripts through the existing blind replay-panel machinery.
The critic saw only `sample/T*.txt`; family IDs, local gates, and replay
provenance stayed in the held-out key/report.

## Result

| Family | Held-out sibling | Recognition votes | Peripeteia-origin votes | Panel status |
| --- | --- | ---: | ---: | --- |
| `glyph_tail_owner` | `glyph_holdout_blue_gate` | 5/5 | 2/5 | `panel_origin_fail` |
| `window_scope_claim` | `window_holdout_mira_label` | 4/5 | 4/5 | `panel_pass` |

Status counts: `panel_pass: 1`, `panel_origin_fail: 1`.

## Interpretation

The positive result is bounded but real: one family (`window_scope_claim`) made
it through the full cheap-local then blind-panel chain. Its baseline held-out
transcript rejected locally, the policy-guided held-out replay survived locally,
and the blind panel attributed the public learner reframe to the tutor's
peripeteia-linked strategy by majority vote.

The limiting result is equally important: `glyph_tail_owner` was unanimously
recognized as a reframe, but the panel did not attribute the reframe to the
tutor's peripeteia-linked move by majority vote. Three critics classified origin
as `organic`; the recurring weakness was that the device was visible, but the
tutor's stock-taking contrast was not explicit enough for those critics. In
short: recognition can survive while origin attribution fails.

## Current Lesson

A18 now has evidence that recursive tutor-learning can produce a panel survivor
when the policy transfer makes the old warrant fail in public and the tutor names
why the prior route is insufficient. It does not yet support a reliability claim
across families. The next design move is to repair or redesign families where
the public device works but the tutor's stock-taking contrast remains too weak
for origin attribution.
