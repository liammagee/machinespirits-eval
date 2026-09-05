# Model second reads of the 7b and 7c blind packets (2026-09-03)

Card: `workplan/items/state-detection-without-word-lists.md`. User call,
2026-09-03: "do the blind second read kappa". Four paid reader calls, one
per packet per model, no retries. The reader sees the packet only, never
`blind-key.json`. The judge was codex.gpt-5.6-sol, so both readers are from
another family. Readers: claude-code.claude-sonnet-5 and
claude-code.claude-opus-5, via `scripts/score-blind-packet-model.js`;
compare via `scripts/stress-blind-packet.js compare`. Files sit next to each
packet: `reader-sonnet5*.{json,raw.txt,meta.json}`, `reader-opus5*`, and the
`-compare.md` sheets.

A model read does not close the human read. The human read on the 037
packets is still open.

## Agreement with the judge, repair HIT vs not-HIT (Cohen's kappa)

| Packet | Sonnet 5 | Opus 5 |
|---|---|---|
| 7b (hold rework, baked brief), 12 items | 0.50 | 0.80 |
| 7c (hold, overconfident brief), 12 items | 0.63 | 0.82 |

Per question, exact agreement out of 12:

| Question | 7b Sonnet | 7b Opus | 7c Sonnet | 7c Opus |
|---|---|---|---|---|
| realized | 11 | 11 | 12 | 12 |
| move (exact tag) | 7 | 11 | 8 | 10 |
| repair (HIT/PARTIAL/MISS) | 8 | 11 | 9 | 10 |
| uptake | 12 | 11 | 10 | 10 |
| eased | 10 | 12 | 12 | 10 |

Eased, re-scored 2026-09-05: the reader ruled that "eased" is not scored where the
learner's next line is scripted (the next plant or a held turn); on these packets that is
eight of twelve. On the four that remain, 4/4 in every column. Compare files regenerated;
the row above is the out-of-12 count as first reported.

Opus agrees with the codex judge at the level the arc set as its bar
(kappa 0.80 and above on both packets). Sonnet sits under it on both; its
disagreements are move tags (it reads `backtrack` where the judge reads
`off_track_probe` or `change_tone`, and `capitulate` or `more_words` where the
judge reads a repair). Same pattern as the step-4, step-6 and step-7 model
reads: Sonnet is the stricter tagger.

## Direction of the card effect, repair HIT per arm (6 plants each)

| Packet | Judge with / without | Sonnet with / without | Opus with / without |
|---|---|---|---|
| 7b | 5 / 4 | 4 / 2 | 5 / 3 |
| 7c | 5 / 3 | 4 / 4 | 4 / 3 |

Every reader keeps the with-arm at or above the without-arm. Sonnet on 7c
reads no gap (it marks the irritated plant PARTIAL in both arms and gives the
without-arm the opposed probe the judge denied it). Opus widens 7b (5 vs 3)
and narrows 7c (4 vs 3, reading the with-arm's irritated reply as `continue`).
Two dialogues per packet; direction only, no count is citable on its own.

## What this does and does not show

- Two model readers from another family than the judge land on the same
  side as the judge on both packets. The judge's rulings are not a codex
  quirk.
- Opus reaches the arc's agreement bar; Sonnet does not. If a model second
  read is used again on this bench, use Opus.
- Nothing here bears on whether the hold held: that is the trace question
  (verdict events, speech-check events), answered in the 7b and 7c notes.
- The human read stays open. A model read is a second opinion, not the
  second column the card asks for.
