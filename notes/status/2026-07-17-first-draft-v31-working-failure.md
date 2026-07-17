# V31 first-draft working screen: hard-cell failure

Date: 2026-07-17  
Status: failed non-held-out working screen  
Campaign: `first-draft-working-screens-v11`  
Frozen HEAD: `959775961e500dd847fc43f47f86ba60fd9fff82`

V31's deterministic preflight passed cleanly once, without a retry. World
quality passed; the four named focused-test suites passed 434/434, 24/24, 4/4,
and 81/81 tests; and all four model-free fixtures passed. The suite-scoped
artifacts therefore resolve V30's diagnostic gap: this run reached tutor
generation with attributable preflight evidence.

The first hard Tallow/answer-seeking draw was then rejected by the unchanged
strict gates. It was safe and transcript-specific, but it did not fully realize
the selected advocate part or the `stage_next_step` handoff in their owned
spans. The result was 0/1 accepted originals and 0.667 mean configuration
realization. With only three draws remaining, the required 4/4 original gate
had become mathematically impossible; the maximum possible result was 3/4
(and the maximum possible configuration mean was 0.91675). The campaign
correctly stopped without starting Ravensmark, Larkspur, or Foxtrot.

This is a first-draft realization failure, not a safety or recovery failure:
there were zero final safety failures, mechanical repairs, model rewrites,
deterministic fallbacks, semantic-recognition corrections, semantic-adjudicator
calls, or transport normalizations. Original and total tutor latency were both
9,787 ms. The single call used 17,903 input tokens and 247 output tokens.

## Preserved evidence

- Frozen config:
  `config/tutor-stub-campaigns/first-draft-working-screens-v11.yaml`
  - SHA-256: `bae7c07b462a2cf11ba498f4d1001d9eff6490d106539edfe96db842616b8841`
- Clean campaign validation:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v11/campaign-validation.json`
  - SHA-256: `b8c7a63304b08c63a106c2b2d1db4f7e99d0274820acd501baabdfa2a375a552`
- Iteration-bound campaign validation:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v11/iteration-1/campaign-validation.json`
  - SHA-256: `55e06a77985e2b8f72d973b6d59f503e627b712bd987a98bfe9e1d80331a0f57`
- Preflight execution ledger:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v11/iteration-1/preflight-execution.json`
  - SHA-256: `a6c936df8593d191943d6c6a4d74b7ede4ba43255172ef53a8e0e1fdfc85f41c`
- Hard-cell turn artifact:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v11/iteration-1/tallow_answer_seeking/turn-5.json`
  - SHA-256: `b0c6d9444bc022a94cc4272398c2e051898fad17838dca11516c10d6d316c8a4`
- Working-screen result:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v11/iteration-1/working-screen-result.json`
  - SHA-256: `cf0bba78e8ddd209ff59a1a0accf021b4d19776ad6dda7a3d6422a1aee8d1a9a`

The four named focused suites have separate, exact stdout artifacts under the
iteration's `preflight/` directory:

- `02-focused-audit_contracts.stdout.log` — 434/434,
  `86f4a203c0487afc45ed2dbdb5d99ca0d51e2e5acc7fe9451b12ea6b986abf4f`
- `03-focused-interactive_modes.stdout.log` — 24/24,
  `6629246bf354b43fbddb476daabdaa0451aa788e77401c494490fbada342bd6e`
- `04-focused-adaptive_evidence.stdout.log` — 4/4,
  `1041cd9beab2c9b00a976e0d6cc0d94c42d154967817ba6d0efcd4f46747a96a`
- `05-focused-campaign_orchestration.stdout.log` — 81/81,
  `eaaeefa647a76580b1faae0447433065319d55d6d26817618209ab711e5b0c07`

## Failure and seed disposition

The dominant failure cluster was
`jointPerformanceAudit:composite_part_requirement_failed:actorial_part`
(three occurrences), followed by one missing selected actorial part and one
owned-span failure each for action family and actorial part. The strict gates
remain unchanged.

- `20262100` — Tallow / answer-seeking: consumed, failed, and retired
- `20262101` — Ravensmark / affective-resistant: unstarted, unconsumed, retired
- `20262102` — Larkspur / premature-closure: unstarted, unconsumed, retired
- `20262103` — Foxtrot / diligent: unstarted, unconsumed, retired

V31 is reusable diagnostic development evidence only. It is not a working
pass and not held-out acceptance evidence. No V32 config, screen, or seed is
predeclared in this result update.
