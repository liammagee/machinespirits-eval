# Ego/Superego History Window Review

Status: observation + follow-up proposal, 2026-06-23.

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

Primary comparison: hold prompt text, model, learner, scenarios, and max rounds fixed; vary only the internal-history window. Measure parse failure rate, convergence, superego approval/rejection pattern, revision magnitude, tutor quality, and whether the change reduces generic revision loops or instead causes overfitting/compliance.

Boundary: do not reinterpret historical runs. Existing logs remain artifacts of the old prompt assembly.
