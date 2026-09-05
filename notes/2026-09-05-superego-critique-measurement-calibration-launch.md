# Superego critique measurement calibration: first-response failure

The separately authorized calibration launched on 2026-09-05 and stopped after
its first provider response. **Zero valid judgments were accepted.** The other
191 jobs were never dispatched; all 192 registered jobs remain scientifically
unfinished. No retry, replacement rating, new generation or four-arm replay ran.
This is a response-contract failure, not evidence about critique effectiveness
or semantic-judge accuracy.

## Authority and provenance

- Design: `notes/superego-critique-causal-replay-design.md`, calibration phase.
- GO: `notes/2026-09-05-superego-critique-measurement-calibration-go.md`.
- Separate user launch instruction: "Launch the calibration".
- PR #1038 merged at `1bbdb9f450ecdf5f714e69ed055dce900a56f67b` on
  2026-09-05T13:22:17Z. Its selected hosted checks passed before launch.
- Recorded launch commit: `4a33077ca46f7c74da7e8bafd61dd132b242a79a`;
  tree `9b739236fc2539bb784f603ce3d09638cca5cb75`; checkout clean.
  Provenance is recorded, not an approval condition.
- Admission: 2026-09-05T13:30:05.542Z. Seal: 2026-09-05T13:30:14.004Z.
- Preflight reproduced the reviewed 48-item/192-job plan exactly and verified
  all 319 source traces plus both original packet hashes. The design and GO
  matched their merged copies. No earlier calibration study state existed.

## Observed response and accounting

The first fixed job was
`scr-3adc328f0ebd/historical_revision/semantic_b`, presented as `s001`.
OpenRouter returned HTTP 200 from the pinned Anthropic route for
`anthropic/claude-sonnet-4.6`, with `finish_reason: stop` and no refusal.
The content enclosed its JSON answer in a Markdown code block. The registered
parser stopped with `Substantive failure: invalid structured output`.

A read-only diagnostic removed the Markdown wrapper in memory, without accepting
or changing the saved answer. The enclosed text parses as JSON, but two candidate
quotations fail the registered exact-substring check: one is an escaped JSON
field fragment; the other changes a typographic apostrophe in the source message
to a straight apostrophe. Removing the wrapper alone would therefore not pass
the existing evidence validator. These are formatting/evidence-location issues,
not a demonstrated substantive disagreement with a human reference. The raw
labels are unaccepted diagnostic content and are not reported as calibration
scores or model performance.

| Quantity | Observed |
| --- | ---: |
| Physical attempts / hard ceiling | 1 / 204 |
| Provider responses received | 1 |
| Accepted judgments | 0 / 192 |
| Failed judgment jobs | 1 |
| Never-dispatched jobs | 191 |
| Input tokens | 4,143 |
| Output tokens | 411 |
| Provider-reported cost | $0.018594 |
| Reported cost plus registered 10% allowance | $0.0204534 |
| Worst-case reservation retained | $0.090463 |
| Registered maximum | $15 |

The journal's `attempt_completed` means a durable provider response was received;
it does not mean a valid judgment was accepted. There are no unexplained pending
reservations. The original failed attempt remains counted; unspent capacity
cannot authorize resampling. The study sealed as `technical_failure` with
`recovery_permitted: false`, under the registered malformed-response stop rule.
Provider activity is inactive.

## Evidence and disposition

- Original run: `exports/superego-critique-measurement-calibration-20260905/` in
  `/private/tmp/superego-critique-measurement-review`.
- Status: that directory's `workflow-status.json`, retained without rewriting
  its original failure record.
- Raw request and response: `requests/1.json` and `responses/1.json`.
- Console record: the adjacent
  `exports/superego-critique-measurement-calibration-20260905.log`.
- Canonical study ledger:
  `/Users/lmagee/.machinespirits-data/paid-studies/superego-critique-measurement-calibration/study-ledger.jsonl`.
- Private archive: all 15 artifacts (2,602,212 bytes), including the blank
  human coding inputs, console record and canonical-ledger snapshot, verified
  byte-for-byte. The maintained archive check reports zero missing artifacts.
  Private commit `09368ef3a6fe7694b0c9a4acee59c9c4ed382d45` was pushed and its
  remote branch verified: `codex/superego-critique-calibration-archive`.
  The original run files and canonical study ledger were not rewritten.

The 48 original packet identities, raw traces, original replay attempt and GO
notes remain unchanged. No later judgments were collected, no human reference
labels were created and no causal or validity conclusion follows. This attempt
exposes brittleness in the response contract before the intended measurement
calibration could complete. Any continuation must preserve this response and
avoid a fresh draw for the failed job; the current registered rules do not
permit automatic continuation. The four-arm replay remains paused.
