# 076 — Codex report: learner-analysis coverage repair

Date: 2026-08-13

Authority: `STATE.md`, ruling 074a, and reviewer direction 075

Implementation commit: `48bf2e97c7cbccfadcb02a9f11bfe26c5be2e190`

## Outcome

Direction 075 is implemented in full. Learner-analysis coverage now fails closed at both the child seal and outcome launcher, with bounded fresh retries for the four authorized strict-analysis failure classes. The stopped v3 run remains untouched and no v4 launch is authorized by this work.

## Four-part repair

1. **Bounded strict-analysis retries.** Strict semantic analysis now retries a fresh analyzer dispatch at most twice after the initial attempt for `invalid_semantic_events`, `invalid_analysis_schema`, `empty_analysis_output`, or analyzer model-call failure. Every dispatch continues through the existing ordinary budget-reservation path under the 30-call dialogue cap. The strict parser, prompt, response schema, and public transcript are unchanged. Each attempt emits an index, status, failure code, and turn in the trace.

2. **Fail-closed child sealing.** Child sealing and corpus construction now use the same learner-analysis coverage calculation. A requested complete seal with coverage below 1 becomes the distinct noncomplete status `learner_analysis_incomplete`, records the unanalyzed job/turn pairs, names them in operator output, and exits nonzero.

3. **Fail-closed launcher guard.** Before accepting a child as complete, the outcome launcher independently checks the sealed child artifact for complete learner-analysis coverage. A miss is quarantined immediately with the affected turns named. The 144-dialogue case-count guard is unchanged.

4. **Regression coverage from the real failure.** The fixture contains the byte-for-byte budget reservation and turn-5 `invalid_semantic_events` records from stopped v3 dialogue 11, with source path and source-trace SHA-256 provenance. Tests cover retry success, persistent failure with the noncomplete child seal naming turn 5, launcher quarantine, and retry accounting within the ordinary dialogue cap.

## Counter re-pin

The outcome pilot manifest and exact-object guards are re-pinned as directed:

| Field | Value |
|---|---:|
| Counter before | 4,067 |
| Generation plan | 540 |
| Presence readers | 288 |
| Decision readers | 288 |
| Planned total | 1,116 |
| Counter after completion | 5,183 |
| Ceiling | 11,337 |
| Remaining after completion | 6,154 |

## Verification

- Focused repair suite: 21/21 passed, including all four required regression cases.
- Widened adaptive and auto-eval suite: 212/212 passed.
- ESLint passed for every modified JavaScript and test file.
- Cycle lint passed with zero unexpected cycles across 576 modules.
- `git diff --check` passed.
- The dialogue-11 fixture matches the two selected source trace records byte for byte; the source trace SHA-256 matches its seal.
- The manifest resolves exactly to generation 540, presence readers 288, decision readers 288, total 1,116, counter 4,067 to 5,183, ceiling 11,337, and remaining 6,154.

## Boundary and accounting report

- Paid/model calls: **0**.
- New dialogues, reader calls, or study launches: **0**.
- No v3 continuation and no v4 launch.
- No changes to `.tutor-stub-auto-eval/**`, the frozen study manifest, menu, worlds, reader implementations, learner-analysis prompt, strict parser, or strict schema.
- No push performed.
- A fresh reviewer GO remains required before any v4 launch.
