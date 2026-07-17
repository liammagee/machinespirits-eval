# V32 staged diagnostic: failed, with measurable first-draft improvement

Date: 2026-07-17  
Status: failed non-held-out staged diagnostic; version retired  
Campaign: `first-draft-diagnostic-screens-v12`  
Frozen HEAD: `8c49f1b9af4678d51af0ab6357c7cf47487b5269`

V32 did not pass. The two staged Tallow/answer-seeking draws produced one
strictly accepted original and one rejected original, so the declared two-of-two
gate failed. It remains development evidence only: no strict confirmation,
held-out matrix, or acceptance claim is authorized.

It did, however, measurably improve first-draft realization over V31 on the
same frozen Tallow prefix. Strict original acceptance rose from 0/1 (0%) to
1/2 (50%), mean configuration realization rose from 0.667 to 1.0, and both V32
draws visibly realized the selected advocate/action configuration with valid
joint ownership. Safety and recovery remained unchanged at zero failures,
repairs, rewrites, fallbacks, adjudications, recognition corrections, and
transport normalizations. The outer-loop no-improvement counter therefore
resets to zero. This is an improvement, not a pass.

## Exact result

| Diagnostic | Seed | Result | Originals | Configuration | Latency | Tokens |
|---|---:|---|---:|---:|---:|---:|
| `tallow_answer_seeking_diagnostic_1` | 20262200 | pass | 1/1 | 1.0 | 12,415 ms | 16,680 |
| `tallow_answer_seeking_diagnostic_2` | 20262201 | fail | 0/1 | 1.0 | 6,069 ms | 16,389 |
| Aggregate | — | fail | 1/2 | 1.0 | 9,242 ms mean | 33,069 |

Aggregate token usage was 32,458 input and 611 output tokens. Both draws were
original-only joint-performance generations. There were two valid joint
outputs, two joint-ownership passes, and two source-surface-accessibility
passes. Transcript-specific uptake failures and final safety failures were
both zero.

The single strict failure cluster was:

- `turnProgressionAudit:handoff_loses_turn_focus:handoff` — 1 occurrence.

## Recognition failure and separate wording debt

The rejected handoff ended: “Next, compare the dark-charger stocktake with the
18:40 pen chart.” The public turn focus required `charger`, `being`, `dark`,
`during`, and `stocktake`. The deterministic recognizer kept `dark-charger` as
one token and therefore counted only `stocktake`. This is a typed recognition
false negative: the handoff retained the concrete focus, but the audit did not
recognize the constituents of the hyphenated compound.

That diagnosis does not reclassify V32. Its frozen result remains failed. A
later model-free recognition correction may re-audit the saved candidate, but
it would be audit-recognition evidence rather than a retroactive V32 generation
pass.

There is also separate open speaking debt in the second draft: “The dark
chargers did not stop Tallow Street’s brownout.” That wording is awkward and
can imply the wrong causal relationship. It did not trigger the strict failure
and must not be hidden by fixing the hyphen-recognition issue.

## Deterministic preflight and provenance

The frozen run used an executed, passing preflight certificate. It was not a
cache reuse. Nine deterministic commands ran sequentially once, without retry,
in 48,946 ms and made zero model calls. The four focused suites passed 436/436,
24/24, 4/4, and 49/49 tests; all four model-free fixtures passed.

- Frozen config:
  `config/tutor-stub-campaigns/first-draft-diagnostic-screens-v12.yaml`
  - SHA-256: `b73a98eb5d855a2010775820dc7410c2607e87c320492b6efcdfe055a5dca18a`
- Clean worktree porcelain SHA-256:
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- Campaign-level validation:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v12/campaign-validation.json`
  - SHA-256: `c67ed92c07c5648037c28aeed6fbab6ace54426079b2dbd4bd58b58e8a07045c`
- Iteration-bound validation:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v12/iteration-1/campaign-validation.json`
  - SHA-256: `5df1553cb8b1ce87f3d9b55c36758f563f79c0afdc6af411890988f51487613d`
- Preflight execution ledger:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v12/iteration-1/preflight-execution.json`
  - SHA-256: `1132f3c4b24d348a0a250834bc67de9a725f641199934abb72ae9f25e5d25673`
- Preflight certificate:
  `.tutor-stub-auto-eval/preflight-certificates/dc58fa9121070d4f96304fa573a274450161deeffc9b8aeb5e527d164fb73bb5.json`
  - disposition: `executed`
  - canonical certificate SHA-256: `0dec859fc2a305c6d71ee305f8b4146ce4c2db0b31b5f98061fded9ae0a7a8af`
  - file SHA-256: `460ffc993909917aaa19842f0bc87c9acfecf419bab18db7c37c0294df2512da`
- First diagnostic turn:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v12/iteration-1/tallow_answer_seeking_diagnostic_1/turn-5.json`
  - SHA-256: `f93bad77dba3171f70ea898baf380e9287f7079d574be1726b8b92576a351f16`
- Second diagnostic turn:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v12/iteration-1/tallow_answer_seeking_diagnostic_2/turn-5.json`
  - SHA-256: `fd15e08cb23168541eef44453c7e3ae7321b98274f1963789d5bad1be439dc9c`
- Working-screen result:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v12/iteration-1/working-screen-result.json`
  - SHA-256: `f878860372b0f9a2dc67872bf3601b25b74b27cd0eb66576863728dd27094647`

The certificate is preserved as provenance for the frozen V32 run. Result-note,
outer-manifest, validator, or outer-governance-test changes after that run are
validated separately and do not reuse the certificate as evidence for the
modified result boundary.

## Seed and next-step boundary

- `20262200` — artifact disposition `consumed_development`; passed its cell,
  then retired because the campaign failed.
- `20262201` — artifact disposition `consumed_development`; failed its cell and
  retired.

V32 is terminal failed-but-measurably-improved development evidence. Strict
four-cell/four-draw confirmation remains prohibited because both staged
diagnostics did not pass. Any recognition correction or speaking-wording
change must be isolated in a separately predeclared later version with fresh
development labels; this result update predeclares neither that version nor
any model call.
