# HTTP model-work admission

HTTP routes that can start model-backed work must declare a policy in
`services/httpModelWorkAdmission.js` and complete admission before opening an
SSE response, creating a run, or invoking a provider.

## Cost classes

- `exact_test_plan` applies to evaluation batches. The server resolves profile
  and scenario IDs against the live registries, calculates the Cartesian test
  count, enforces `EVAL_API_MAX_PLANNED_TESTS`, and requires that live requests
  send the same value as `confirmTestCount`.
- `fixed_model_calls` applies to conversational work whose exact number of
  provider calls depends on deliberation or retry behavior. The server computes
  a conservative hard limit, enforces `HTTP_MAX_MODEL_CALLS` (default `48`), and
  requires live requests to send that limit as `confirmModelCallLimit`. A call
  budget is reserved immediately before each provider invocation.
- `bounded_session` and `bounded_process` document routes whose server-owned
  session, time, turn, USD, or subprocess contract already supplies the bound.

`dryRun: true` is confirmation-exempt only when the route's dry-run path makes
zero model calls. Admission plans include a schema, endpoint, bound,
confirmation mode, ceiling state, timestamp, and SHA-256 request hash.

## Examples

One live quick test:

```bash
curl -X POST http://127.0.0.1:3000/api/eval/quick \
  -H 'content-type: application/json' \
  -d '{"profile":"budget","scenario":"new_user_first_visit","confirmTestCount":1}'
```

A five-turn interaction uses the conservative bilateral limit
`3 + (6 × turns)`, so the confirmation is `33`:

```bash
curl 'http://127.0.0.1:3000/api/eval/stream/interact?profile=budget&persona=confused_novice&turns=5&confirmModelCallLimit=33'
```

Fresh prompt recommendations combine both cost classes: confirm the evaluation
test count and the one recommender call. Recommendations from an existing run
need only `confirmModelCallLimit: 1`.

## Adding a route

1. Add the endpoint and its cost class to `HTTP_MODEL_WORK_ENDPOINT_POLICIES`.
2. Attach the appropriate admission middleware before the route handler.
3. Reserve the admitted test or call budget immediately before every launch.
4. Include the admission plan in persisted metadata or the response.
5. Extend `tests/httpModelWorkAdmission.test.js`. Its source inventory fails
   when a direct evaluation/chat launch route lacks a policy or middleware.

Oversized plans can be allowed only when `allowOversizedPlan: true` accompanies
the server-configured `x-eval-override-token`; confirmation is still required.
