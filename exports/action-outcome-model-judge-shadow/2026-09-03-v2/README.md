# Opus-Sol action-outcome shadow judgment revision 2

**Verdict: revision 2 resolved the targeted stall-rule disagreements but still
failed the registered exploratory diagnostic.** The original human gates remain
pending, and the memory-controller study is not licensed.

The study gave the same 35 frozen public cases independently to
`codex.gpt-5.6-sol` and `claude-code.opus-5`, both at medium effort. All 70
planned calls completed, with no failed or missing calls and no retries. The run
used exactly 70 of its 70 allowed attempt reservations. The private report is
sealed at SHA-256
`422b21489d53dc87b9785875b20a52017e222a2651527142172e49e9855b71dd`.

## Three-way comparison

The middle column revalidates the archived v1 responses under quote-normalized
matching and makes zero model calls. It does not apply the new stall rule to old
responses; v2 is the fresh medium-effort run under the full revised instrument.

| Measure | Archived v1 | Quote-normalized v1 | Revision 2 |
|---|---:|---:|---:|
| Protocol-valid, Sol | 35/35 | 35/35 | 35/35 |
| Protocol-valid, Opus | 33/35 | 35/35 | 35/35 |
| Paired protocol-valid cases | 33/35 | 35/35 | 35/35 |
| Delivery exact agreement | 30/33 (90.9%) | 31/35 (88.6%) | 27/35 (77.1%) |
| Delivery Cohen's kappa | 0.791 | 0.735 | 0.200 |
| Outcome exact agreement | 17/33 (51.5%) | 18/35 (51.4%) | 24/35 (68.6%) |
| Outcome Cohen's kappa | 0.361 | 0.357 | 0.172 |
| Joint exact agreement | 17/33 (51.5%) | 18/35 (51.4%) | 24/35 (68.6%) |
| Joint Cohen's kappa | 0.361 | 0.357 | 0.172 |
| Paired measurement indeterminacy | 27/35 (77.1%) | 26/35 (74.3%) | 13/35 (37.1%) |
| Exact-consensus binary records | 5/35 | 5/35 | 0/35 |
| Registered verdict | failed | failed | failed |

Raw outcome agreement rose while outcome kappa fell because both revision-2
seats concentrated heavily on `inconclusive`: Sol used it 25 times and Opus 29
times. The revised instrument removed a systematic directional split, but the
result has little label diversity.

## Diagnosed cases

All eight original stall splits closed to exact `inconclusive` consensus:

| Case | Archived Sol | Archived Opus | Revision-2 Sol | Revision-2 Opus |
|---|---|---|---|---|
| case-0005 | failure | inconclusive | inconclusive | inconclusive |
| case-0006 | failure | inconclusive | inconclusive | inconclusive |
| case-0009 | failure | inconclusive | inconclusive | inconclusive |
| case-0018 | failure | inconclusive | inconclusive | inconclusive |
| case-0019 | success | inconclusive | inconclusive | inconclusive |
| case-0020 | failure | inconclusive | inconclusive | inconclusive |
| case-0021 | success | inconclusive | inconclusive | inconclusive |
| case-0031 | failure | inconclusive | inconclusive | inconclusive |

The three reverse-direction cases also closed to exact `inconclusive` consensus:

| Case | Archived Sol | Archived Opus | Revision-2 Sol | Revision-2 Opus |
|---|---|---|---|---|
| case-0022 | inconclusive | failure | inconclusive | inconclusive |
| case-0025 | partial | failure | inconclusive | inconclusive |
| case-0030 | inconclusive | failure | inconclusive | inconclusive |

No per-case dialogue text is included here.

## Quotation normalization and confidence

Quote normalization recovered 2/35 rows in the v1 re-score: case-0002 and
case-0011, both in the Opus seat. No revision-2 row carried a
quote-normalization note (0/35 rows and 0/70 votes); the new responses already
matched the packet's quotation marks.

| Run and seat | High | Medium | Low |
|---|---:|---:|---:|
| Archived v1 Sol | 34 | 1 | 0 |
| Archived v1 Opus | 8 | 27 | 0 |
| Quote-normalized v1 Sol | 34 | 1 | 0 |
| Quote-normalized v1 Opus | 8 | 27 | 0 |
| Revision-2 Sol | 29 | 6 | 0 |
| Revision-2 Opus | 18 | 14 | 3 |

## Interpretation

The stall rule did what it was designed to do: all 11 diagnosed directional
splits closed, raw outcome agreement increased by 17 percentage points, and
paired indeterminacy roughly halved. Revision 2 nevertheless missed the 80%
joint-agreement gate, the 20% indeterminacy ceiling, and the binary-yield gates.
Delivery agreement also fell, exposing a remaining judgment split about whether
a tutor-completed step followed by a hand-back counts as the requested action.

The zero binary yield is a property of this stall-heavy packet under the
registered rule, rather than a provider or runtime failure: once a report of
stopping before the step is correctly treated as unresolved, the packet contains
almost no observable successes or failures to recover. It cannot support an
action-family comparison.

This is an instrument change and exploratory model-measurement evidence. It does
not validate the outcome construct, satisfy the source study's human gates,
establish learning or transfer, compare action-family effectiveness, replace a
human construct anchor, or license the memory controller.
