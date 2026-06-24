# Ego/Superego History Window Review

Status: closed negative/limited result, 2026-06-24.

Question: do tutor ego/superego calls include prior ego/superego history inside the same exchange?

## Current behavior

The normal tutor path is `tutor-core/services/tutorDialogueEngine.js`.

- `conversationMode` defaults to `single-prompt`; only profiles with `conversation_mode: messages` pass chat-style `messageHistory` into `callAI`.
- In `single-prompt` mode, the ego generate, superego review, and ego revise calls are single user-prompt calls. The same-turn ego/superego exchange is serialized only inside the current prompt fields, not carried as prior `user` / `assistant` messages.
- In `messages` mode, the code maintains two small in-turn internal chains:
  - `egoInternalHistory`: starts with the ego's initial assistant response and is used for later ego revisions.
  - `superegoInternalHistory`: records prior superego review prompts/responses and is used for later superego reviews.
- The first superego review receives no prior superego history. The first ego revision receives the external message chain, the ego's initial assistant response, and the current superego feedback as a `user` message; it does not receive a unified transcript of the whole ego/superego deliberation.
- The Phase-2 `dialecticalEngine` path uses freshly rendered single prompts for `egoRespondsToSuperego` and `superegoEvaluatesRevision`; it records `dialogueTrace`, but that trace is not fed forward as chat-message history in later negotiation rounds.

Implementation references checked:

- `tutor-core/services/tutorDialogueEngine.js`: `callAI` / `_callAIOnce`, `egoGenerateSuggestions`, `superegoReview`, `egoRevise`, and the in-turn loop around `egoInternalHistory` / `superegoInternalHistory`.
- `tutor-core/services/dialecticalEngine.js`: `egoRespondsToSuperego`, `superegoEvaluatesRevision`, and `negotiateDialectically`.

## Proposed review

Add a configurable internal-history window that can pass a variable amount of same-turn ego/superego deliberation as explicit `user` / `assistant` style messages. This should be tested as an experimental condition, not silently applied globally.

Candidate dimensions:

- `internal_history_window: 0 | 1 | 2 | all`
- `internal_history_roles: ego_only | superego_only | unified_exchange`
- `internal_history_surface: serialized_prompt | chat_messages`

## Messages-style option

The option worth testing is not "more text in the prompt" in general, but a
messages-style API surface for internal deliberation. That means preserving prior
same-turn ego/superego moves as alternating chat messages, rather than embedding
all of them inside one large user prompt.

Candidate config:

```yaml
internal_history:
  enabled: false
  surface: messages      # prompt | messages
  window: 1              # 0 | 1 | 2 | all
  scope: unified_exchange # role_local | unified_exchange
  max_chars_per_message: 1200
```

Expected upside: the model may track commitments and revisions better when the
deliberation is represented as dialogue. This could reduce repeated feedback,
failed convergence, and verbose restatement loops.

Risk: chat history may increase prompt tokens, amplify anchoring/compliance, or
blur ego/superego role boundaries because the API sees only `user` and
`assistant` roles. The first pass should therefore be opt-in, token-limited, and
measured against latency/token/convergence outcomes as well as quality.

Primary comparison: hold prompt text, model, learner, scenarios, and max rounds fixed; vary only the internal-history window. Measure parse failure rate, convergence, superego approval/rejection pattern, revision magnitude, tutor quality, and whether the change reduces generic revision loops or instead causes overfitting/compliance.

Boundary: do not reinterpret historical runs. Existing logs remain artifacts of the old prompt assembly.

## First implementation probe

Branch: `codex/internal-history-messages`.

Implemented as an opt-in `internalHistory` / `internal_history` option. Defaults remain disabled. The first supported surface is:

```yaml
internal_history:
  enabled: true
  surface: messages
  scope: unified_exchange
  window: 1
  max_chars_per_message: 600
```

Small mocked probe, no paid API calls:

```bash
node scripts/probe-internal-history-messages.js
```

The same script supports a real, capped provider comparison when `OPENROUTER_API_KEY` is available:

```bash
node scripts/probe-internal-history-messages.js --real
```

Probe conditions:

- Core tutor profile: `fast`
- `maxRounds: 1`
- ego output cap: `max_tokens: 256`
- superego output cap: `max_tokens: 256`
- internal history window: `1`
- internal history cap: `600` chars/message

Observed prompt-shape delta in the mock run:

- Baseline prompt total: 43,768 chars, approx. 10,943 prompt tokens.
- Internal-history prompt total: 44,860 chars, approx. 11,218 prompt tokens.
- Added context: 1,092 chars, approx. 275 prompt tokens, all from 1,016 chars of internal-history messages.
- The first ego call is unchanged. The first superego review receives the ego draft as an internal user message. The ego revision receives `system,user,assistant,user` messages carrying the bounded ego/superego exchange.

Interpretation: this is cheap enough to justify a small real comparison, but it is not a free performance win. It spends extra input context in exchange for a cleaner conversational representation of the internal deliberation. The next real test should look for fewer repeated revision loops, fewer parse/revision failures, and better final tutor quality per token.

Initial real-run status: not run from the bare shell because `OPENROUTER_API_KEY` was missing.

Update: `OPENROUTER_API_KEY` is available by loading `/Users/lmagee/Dev/machinespirits/machinespirits-eval/.env` with dotenv.

Real comparison, cheap model:

```bash
PROBE_EGO_MAX_TOKENS=768 PROBE_SUPEREGO_MAX_TOKENS=768 \
DOTENV_CONFIG_PATH=/Users/lmagee/Dev/machinespirits/machinespirits-eval/.env \
node -r dotenv/config scripts/probe-internal-history-messages.js --real
```

Result: the `fast` / Nemotron probe was noisy. Both arms had ego JSON-format retries; the baseline eventually succeeded with 3 API calls, while treatment reached internal-history messages only after additional captured retry calls. Treatment showed much larger captured prompt shape (+34,701 chars / approx. +8,678 prompt tokens), but that is dominated by retry noise rather than a clean internal-history effect.

Real comparison, cleaner model override:

```bash
PROBE_MODEL=openrouter.gpt-mini \
PROBE_EGO_MAX_TOKENS=768 PROBE_SUPEREGO_MAX_TOKENS=768 \
DOTENV_CONFIG_PATH=/Users/lmagee/Dev/machinespirits/machinespirits-eval/.env \
node -r dotenv/config scripts/probe-internal-history-messages.js --real
```

Result:

- Baseline: success, 3 API calls, 24.9s, 9,484 provider input tokens, 1,679 output tokens, cost 0.0050954.
- Treatment: success, 3 API calls, 26.0s, 9,934 provider input tokens, 1,503 output tokens, cost 0.0036751.
- Captured prompt-shape delta: +2,000 chars, approx. +500 prompt tokens, 1,938 chars of internal-history messages.

Interpretation: the cleaner single-run comparison does not support internal-history messages as a performance fix. It adds input context and slightly increases latency. The lower treatment cost in this one run came from fewer output tokens, not from a cheaper prompt path, so it should not be treated as robust. If pursued further, evaluate quality-per-token or convergence/revision quality, not raw speed.

## Quality / Stability / Revision Comparison

Added a repeated paired comparison:

```bash
PROBE_RUNS=3 \
PROBE_MODEL=openrouter.gpt-mini \
PROBE_EGO_MAX_TOKENS=768 \
PROBE_SUPEREGO_MAX_TOKENS=768 \
DOTENV_CONFIG_PATH=/Users/lmagee/Dev/machinespirits/machinespirits-eval/.env \
node -r dotenv/config scripts/compare-internal-history-quality.js --real
```

Artifacts:

- `exports/internal-history-quality/2026-06-23T18-33-21-419Z-real.json`
- `exports/internal-history-quality/2026-06-23T18-35-59-691Z-real.json`

The first 3-pair run used the initial quality proxy:

- Parse stability: both arms were clean, 0 parse warnings, 100% success.
- Quality proxy: tied at 93.3 average.
- Revision/convergence: baseline revised in 3/3; treatment revised in 2/3 and got 1/3 first-pass superego approvals.
- Cost/latency: treatment was lower on average, but the difference was driven by the single first-pass approval, not a stable prompt-efficiency effect.

Manual inspection showed the initial quality proxy missed unsupported specifics such as invented quiz IDs, subsections, timestamps, and vignette/probe details. The scorer was tightened to penalize invalid `x:y` identifiers and unsupported fine-grained specifics. The second 3-pair run used that stricter proxy:

- Parse stability: both arms clean again, 0 parse warnings, 100% success.
- Quality proxy: baseline 83.3, treatment 95.0; paired average delta +11.7.
- Revision/convergence: both arms revised in 3/3; neither arm got a first-pass final approval.
- Prompt budget: treatment added about 493 captured prompt tokens and about 1,923 internal-history chars on average.
- Provider tokens/cost: treatment added about 451 input tokens, 40 output tokens, and 0.000192 cost on average.
- Latency: treatment averaged about 1.9s lower in this small run, but this is not strong enough to call a speed improvement.

Interpretation: internal-history messages did not hurt parse stability in the `gpt-mini` runs. There is weak evidence that they may help the revision loop produce fewer unsupported specifics under the stricter proxy, but manual spot-check still found unsupported specifics in both arms. This is not a performance fix. If retained, it should be evaluated as a quality-per-token tradeoff with a stronger quality judge and more scenarios.

## Additional Judges / Scenario Probe

Expanded `scripts/compare-internal-history-quality.js` to run three scenarios and blind paired judging:

```bash
PROBE_RUNS=2 \
PROBE_JUDGES=openrouter.haiku,openrouter.gpt \
PROBE_MODEL=openrouter.gpt-mini \
PROBE_EGO_MAX_TOKENS=768 \
PROBE_SUPEREGO_MAX_TOKENS=768 \
PROBE_JUDGE_MAX_TOKENS=700 \
DOTENV_CONFIG_PATH=/Users/lmagee/Dev/machinespirits/machinespirits-eval/.env \
node -r dotenv/config scripts/compare-internal-history-quality.js --real
```

Artifact:

- `exports/internal-history-quality/2026-06-23T20-18-21-502Z-real.json`

Design:

- Generation: `openrouter.gpt-mini`, profile `fast`, `maxRounds: 1`, ego/superego capped at 768 tokens.
- Treatment: `internalHistory.surface: messages`, `scope: unified_exchange`, `window: 1`, `max_chars_per_message: 600`.
- Scenarios: recognition/compliance retry, fraction-equivalence frustration, and gradient-descent pacing under over-advancement pressure.
- Judges: blind A/B comparisons by `openrouter.haiku` and `openrouter.gpt`.

Results:

- Parse stability: both arms had 100% success and 0 parse warnings across 6 paired comparisons.
- Blind judge preference: treatment won 8/12 comparisons, baseline won 2/12, and 2/12 were ties; treatment non-loss rate was 10/12.
- Scenario pattern:
  - Recognition retry: treatment 2 wins, baseline 1, tie 1; heuristic delta +15; treatment added about 499 input tokens.
  - Fraction frustration: treatment 2 wins, baseline 1, tie 1; heuristic delta +3.5; treatment avoided revision in both runs and averaged lower input tokens because it got first-pass approvals.
  - Gradient pacing: treatment won 4/4 judge comparisons; heuristic delta -2.5, but judges preferred the treatment's pacing and lower hallucination risk.
- Revision/convergence: baseline got first-pass final approval in 1/6 runs; treatment got first-pass final approval in 4/6 runs. Average API calls dropped from 2.83 to 2.67.
- Token/cost: average provider input delta was -200 tokens and average cost delta was -0.000416 per paired run, but this came from fewer/lighter revision loops. When the number of calls is the same, internal-history messages still add roughly 500 input tokens.
- Hallucinated specifics noted by judges: baseline 17 unsupported-specific flags vs treatment 7.
- Total run cost: about 0.0833 USD, including 0.0387 USD dialogue generation and 0.0446 USD judging.

Caveat: judge numeric quality scores were not scale-stable; at least one judge mixed 0-10 and 0-100 scoring despite the JSON field names. Treat the winner/non-loss tallies and unsupported-specifics counts as the reliable judge signal. The script prompt and decision rule were tightened afterward to request 0-100 scores explicitly and gate on blind winner tallies.

Decision:

- Do not enable this by default from this evidence. The sample is intentionally small, and the mechanism is still another context consumer.
- Keep it as an opt-in quality/convergence option for cases with a same-turn ego/superego revision loop, especially struggle/pacing cases where the superego critique can make the final ego call more grounded or avoid a revision call.
- Do not describe it as a general performance fix. It can reduce latency/tokens only when it improves first-pass approval or shortens the revision output; otherwise it adds context.
- Revisit only if a larger registered run preserves the pattern: parse stability non-worse, treatment non-loss rate >= 75% across independent judges, no scenario family where baseline clearly wins, and added input tokens stay bounded under the configured history cap.

## Large Run

Commit before run: `ae72e4f8` (`Add internal history messages probe`).

The larger battery uses the same three probe scenarios and the same `openrouter.gpt-mini` generation model, but increases to 10 repetitions per scenario. Per user note, treat the judge aliases as model-family mappings rather than unrelated judges:

- `openrouter.gpt` resolves to `openai/gpt-5.2` (Codex/GPT-family judge).
- `openrouter.haiku` resolves to `anthropic/claude-haiku-4.5` (Claude/Haiku-family judge).

Command:

```bash
PROBE_RUNS=10 \
PROBE_JUDGES=openrouter.gpt,openrouter.haiku \
PROBE_MODEL=openrouter.gpt-mini \
PROBE_EGO_MAX_TOKENS=768 \
PROBE_SUPEREGO_MAX_TOKENS=768 \
PROBE_JUDGE_MAX_TOKENS=700 \
DOTENV_CONFIG_PATH=/Users/lmagee/Dev/machinespirits/machinespirits-eval/.env \
node -r dotenv/config scripts/compare-internal-history-quality.js --real
```

Artifact:

- `exports/internal-history-quality/2026-06-23T21-11-48-342Z-real.json`

Overall result:

- Size: 30 paired comparisons, 60 blind judge comparisons.
- Parse stability: both arms stayed parse-clean, with 100% success and 0 parse warnings.
- Blind judge preference: treatment 29 wins, baseline 25 wins, 6 ties.
- Treatment non-loss rate: 58.3%, below the 75% opt-in/default gate.
- Treatment win rate: 48.3%, below the 60% judge-positive gate.
- Heuristic quality delta: +0.63 points, below the +5 heuristic-positive gate.
- Final approval rate: baseline 30%, treatment 60%.
- Average API calls: unchanged at 2.77 calls per run.
- Token/latency delta: treatment added about 393 input tokens and 1.01s latency on average.
- Cost delta: treatment averaged -0.000062 USD per paired run, driven by lower output tokens rather than less prompt context.
- Judge-noted unsupported specifics: baseline 74 flags, treatment 47 flags.
- Total cost: about 0.4232 USD, including 0.1907 USD dialogue generation and 0.2325 USD judging.

Judge-family split:

- `openrouter.gpt` / GPT-family: treatment 11 wins, baseline 13 wins, 6 ties; non-loss 56.7%.
- `openrouter.haiku` / Claude-family: treatment 18 wins, baseline 12 wins, 0 ties; non-loss 60.0%.

Scenario split:

- Recognition retry: treatment 11 wins, baseline 9; non-loss 55%; heuristic delta +4; latency/input tokens slightly lower for treatment.
- Fraction frustration: treatment 10 wins, baseline 5, ties 5; non-loss 75%; heuristic delta -2.6; latency lower and token cost roughly flat.
- Gradient pacing: treatment 8 wins, baseline 11, tie 1; non-loss 45%; heuristic delta +0.5; treatment added about 1,435 input tokens and 5.1s latency.

Large-run decision:

- Do not enable by default.
- Do not treat as generally worthwhile under the current config. The larger run does not reproduce the small-run judge advantage strongly enough.
- The only condition worth revisiting is narrow and scenario-specific: fraction-style frustration/remediation cases may benefit from the history surface because they reached the non-loss threshold while staying token/latency neutral. Recognition is mixed, and gradient/pacing is a clear caution case under this prompt shape.
- The implementation can remain useful as an opt-in instrumentation/probe switch, but the evidence does not justify adding this to standard cells without a sharper targeting rule or a different internal-history assembly policy.

## Rejudge: agy CLI + OpenRouter GLM 5.2

Before merge, rejudged the 30-pair large-run artifact without regenerating dialogues.

Source artifact:

- `exports/internal-history-quality/2026-06-23T21-11-48-342Z-real.json`

Rejudge artifact:

- `exports/internal-history-quality/2026-06-23T23-46-04-679Z-rejudge-agy-glm52.json`

Judges:

- `agy` CLI default model.
- `openrouter.glm5_2`, resolving to `z-ai/glm-5.2`.

Overall rejudge result:

- Parsed comparisons: 59/60; one GLM response was truncated/unterminated JSON in `fractions_frustration` iteration 3.
- Blind judge preference: treatment 30 wins, baseline 17 wins, 12 ties.
- Treatment win rate: 50.8%.
- Treatment non-loss rate: 71.2%, still below the 75% gate.
- Average treatment score delta: +4.81.
- Rejudge cost: about 0.0619 USD, all from the GLM OpenRouter calls.

Judge split:

- `agy`: treatment 15 wins, baseline 10 wins, 5 ties; non-loss 66.7%.
- `openrouter.glm5_2`: treatment 15 wins, baseline 7 wins, 7 ties; non-loss 75.9%, but one parse error.

Scenario split:

- Recognition retry: treatment 11 wins, baseline 4, 5 ties; non-loss 80.0%.
- Fraction frustration: treatment 6 wins, baseline 7, 6 ties; non-loss 63.2%; one parse error.
- Gradient pacing: treatment 13 wins, baseline 6, 1 tie; non-loss 70.0%.

Combined across the prior `gpt`/`haiku` panel and this `agy`/GLM panel:

- Parsed comparisons: 119.
- Treatment wins: 59; baseline wins: 42; ties: 18.
- Treatment win rate: 49.6%.
- Treatment non-loss rate: 64.7%.

Merge/paper interpretation:

- The rejudge weakens the earlier scenario-specific story rather than clarifying it. It flips gradient/pacing more positive than the `gpt`/`haiku` panel, but makes fraction frustration negative. That cross-judge instability is the key result.
- Do not report this as a main Paper 2.0 finding. It is a small branch-local probe with synthetic scenarios, one-off prompt assembly, ignored artifacts, and judge disagreement.
- If mentioned at all, keep it as an ancillary negative result or future-work note: exposing bounded same-turn ego/superego history as chat messages is parse-stable and sometimes improves first-pass approval, but does not produce robust cross-judge quality gains under the tested conditions.

## Closeout

Closeout branch: `codex/internal-history-closeout`.

Decision: close the review item as a negative/limited result. The implementation remains only an opt-in instrumentation/probe switch (`internal_history.enabled: true` with `surface: messages`, `scope: unified_exchange`, and a bounded `window`). Defaults stay unchanged. The evidence does not justify enabling internal-history messages by default, registering a standard evaluation cell around them, or folding the result into the main Paper 2.0 empirical claims.

No paid runs were launched during closeout. The only closeout change was to add a no-spend boundary test that locks the opt-in gate and the Phase-2 dialectical engine's prompt-only behavior.
