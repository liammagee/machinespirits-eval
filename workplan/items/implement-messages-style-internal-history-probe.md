---
id: implement-messages-style-internal-history-probe
title: Implement messages-style ego/superego history probe
status: review
type: experiment
priority: P2
owner: codex
source: manual
created: 2026-06-23
updated: 2026-06-23
verification: Opt-in messages-style internal-history config is implemented with
  defaults unchanged; mock/hermetic tests pass; a small token-limited comparison
  reports latency/tokens/convergence/revision behavior before any wider run.
claim_status: exploratory
branch: codex/internal-history-messages
links:
  notes: notes/2026-06-23-ego-superego-history-window-review.md
  items: review-ego-superego-internal-history-window
  code:
    - tutor-core/services/tutorDialogueEngine.js
    - tutor-core/services/tutorApiService.js
    - services/evaluationRunner.js
    - scripts/probe-internal-history-messages.js
    - scripts/compare-internal-history-quality.js
    - tests/internalHistoryMessages.test.js
tags:
  - ego-superego
  - messages-api
  - performance
  - token-budget
---

Implement the smallest useful messages-style internal-history probe. The default path must remain behaviorally unchanged. The experimental path should let a cell include a bounded same-turn ego/superego exchange as chat-style `user` / `assistant` messages, with a small `max_chars_per_message` cap so the first evaluation can inspect whether performance improves or merely spends more context.

Acceptance:

- Add an opt-in config surface for internal history, initially targeting `surface: messages`, `window: 1`, and a capped message length.
- Preserve current defaults and historical comparability.
- Add focused tests that prove message arrays differ only when the option is enabled.
- Run a small comparison with a limited output/token budget and report token/latency/convergence/revision differences.

Progress:

- Implemented opt-in `internalHistory` / `internal_history` support on branch `codex/internal-history-messages`; default behavior remains disabled.
- Added bounded unified same-turn ego/superego history as chat-style messages with `surface: messages`, `scope: unified_exchange`, `window`, and `max_chars_per_message`.
- Added pass-through for superego hyperparameter caps so small probes can limit all internal calls, not only initial ego generation.
- Added focused tests in `tests/internalHistoryMessages.test.js`.
- Ran `node scripts/probe-internal-history-messages.js` with mocked OpenRouter responses, `maxRounds: 1`, ego and superego `max_tokens: 256`, `window: 1`, and `max_chars_per_message: 600`.
- Mock probe result: treatment added 1,092 prompt chars, approx. 275 prompt tokens, and 1,016 chars of internal-history messages versus baseline. First ego call was unchanged; superego review received the ego draft as a message; ego revision received `system,user,assistant,user`.
- Added `node scripts/probe-internal-history-messages.js --real` for the same capped provider comparison.
- Memory note added: OpenRouter key is available by loading `/Users/lmagee/Dev/machinespirits/machinespirits-eval/.env` with dotenv.
- Real `fast` / Nemotron run at 768 output tokens was noisy: both arms hit ego JSON retries, so the result is not a clean internal-history comparison.
- Real `openrouter.gpt-mini` run at 768 output tokens was clean: baseline success with 3 API calls, 24.9s, 9,484 provider input tokens, cost 0.0050954; treatment success with 3 API calls, 26.0s, 9,934 provider input tokens, cost 0.0036751. Captured treatment overhead was +2,000 prompt chars / approx. +500 prompt tokens.
- Added `scripts/compare-internal-history-quality.js` for repeated paired runs capturing parse warnings, success, quality proxy, revision/convergence, latency, tokens, and cost.
- Real 3-pair `openrouter.gpt-mini` quality/stability run: both arms parse-clean and 100% successful; initial quality proxy tied at 93.3, with treatment getting 1/3 first-pass approvals. Manual inspection showed the proxy missed unsupported specifics.
- Tightened the quality proxy to penalize invalid `x:y` identifiers and unsupported fine-grained specifics. Second real 3-pair run: both arms still parse-clean and 100% successful; stricter quality proxy baseline 83.3 vs treatment 95.0, but both arms still showed some unsupported specifics on manual inspection. Treatment added about 493 captured prompt tokens and about 1,923 internal-history chars on average.
- Expanded `scripts/compare-internal-history-quality.js` to cover three scenarios (`recognition_retry`, `fractions_frustration`, `gradient_pacing`) and blind A/B judges (`openrouter.haiku`, `openrouter.gpt`).
- Real 6-pair / 12-judge comparison artifact: `exports/internal-history-quality/2026-06-23T20-18-21-502Z-real.json`.
- Multi-scenario result: both arms parse-clean and 100% successful; treatment won 8/12 blind judge comparisons, baseline won 2/12, and 2/12 were ties. Treatment first-pass approval was 4/6 vs baseline 1/6; average API calls dropped 2.83 -> 2.67. Judge-noted unsupported specifics dropped from 17 baseline flags to 7 treatment flags.
- Caveat: judge numeric quality scores were not scale-stable, so the reliable judge signal is winner/non-loss plus unsupported-specific counts. The script prompt and decision rule were tightened after the run.
- Committed the implementation and initial evaluation slice as `ae72e4f8` (`Add internal history messages probe`).
- Ran a larger real battery after that commit: 10 repetitions across three scenarios, `openrouter.gpt-mini` generation, blind judges `openrouter.gpt` and `openrouter.haiku`. Per user note, these aliases map to the Codex/GPT and Claude/Haiku judge families (`openai/gpt-5.2` and `anthropic/claude-haiku-4.5`).
- Large-run artifact: `exports/internal-history-quality/2026-06-23T21-11-48-342Z-real.json`.
- Large-run result: both arms parse-clean and 100% successful; treatment won 29/60 blind judge comparisons, baseline won 25/60, and 6/60 were ties. Treatment non-loss was 58.3%, below the 75% gate. Heuristic quality delta was only +0.63, below the +5 gate. Treatment first-pass approval improved from 30% to 60%, but average API calls were unchanged at 2.77.
- Scenario pattern: fraction frustration was the only scenario at the non-loss gate (75%) while staying token/latency neutral; recognition was mixed (55% non-loss); gradient pacing was negative (45% non-loss and +1,435 average input tokens).

Decision: do not enable by default and do not treat as generally worthwhile under the current config. Keep only as an opt-in instrumentation/probe switch unless a sharper scenario-targeting rule or different internal-history assembly policy clears the judge/non-loss gates in a larger run.
