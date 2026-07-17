# V33 authored-prompt and transport baseline

Date: 2026-07-17  
Source: frozen V33 Tallow/answer-seeking turn 5 original call  
Request SHA-256: `e1b9a59ab8e9285db122cb21472feb0d91f4b891d0d8e7343399d085f155159e`

The request hash is over `JSON.stringify(request)` from the frozen V33 turn
artifact. No prompt or candidate was regenerated.

Token counts below are estimates using
`utf16-code-units-div-4-ceiling-v1`; provider input is the exact usage value
reported by Codex. The residual is inferred by subtraction and is not a direct
measurement of any one runtime component.

| Authored section | Chars | Estimated tokens |
|---|---:|---:|
| Base tutor rules | 3,311 | 828 |
| World / scene | 2,702 | 676 |
| Evidence / safety | 2,837 | 710 |
| Named tutor | 1,023 | 256 |
| Public history | 2,252 | 563 |
| Public evidence window | 1,113 | 279 |
| Classifier | 495 | 124 |
| Learner-DAG | 570 | 143 |
| Scaffold | 2,121 | 531 |
| Host plan | 2,927 | 732 |
| Transport tail | 367 | 92 |

- Authored total: 19,718 chars; 4,930 estimated tokens.
- Provider-observed input: 16,246 tokens.
- Inferred agent/runtime transport residual: 11,316 tokens.
- Cached input: unavailable in the preserved V33 artifact, therefore `null`.
- Uncached input: unavailable because cached input is unavailable, therefore
  `null` rather than 16,246.
- Output: 517 tokens.
- Reasoning output: unavailable in the preserved V33 artifact, therefore
  `null`.
- Total: 16,763 tokens.

The 35% authored-prompt reduction threshold is therefore at most 3,204
estimated tokens on this frozen measurement. The preferred target remains
2,500 or fewer.
