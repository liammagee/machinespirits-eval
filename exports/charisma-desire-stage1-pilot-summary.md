# Charisma Desire Stage 1 Pilot Summary

Generated: 2026-06-25T18:21:34.708Z

## Run

- Run: `eval-2026-06-25-dbae041a`
- Status: `completed`
- Planned rows: 72
- Successful generated rows: 72
- Retained infra-failure rows: 4
- v2.2 scored successful rows: 72
- Charisma scored successful rows: 72
- Ego model override: `codex.gpt-5.5`
- Id model override: `claude-code.sonnet-4-6`
- Scenario file: `config/charisma-recognition-desire-scenarios.yaml`
- Git commit at run creation: `1e97ba17`

## Primary Decision Scenarios

| Profile | n | v2.2 first | v2.2 last | v2.2 overall | charisma | required | forbidden |
| --- | --- | --- | --- | --- | --- | --- | --- |
| cell 104 | 6 | 81.7 | 95.2 | 88.2 | 68.5 | 6/6 | 6/6 |
| cell 107 | 6 | 85.2 | 89.4 | 87.8 | 69.8 | 6/6 | 6/6 |
| cell 163 | 6 | 89.2 | 96.0 | 92.7 | 79.4 | 6/6 | 6/6 |
| cell 169 | 6 | 87.3 | 94.2 | 91.3 | 81.0 | 6/6 | 6/6 |

## Scenario x Profile Detail

| Kind | Scenario | Profile | n | v2.2 first | v2.2 last | v2.2 overall | charisma | required | forbidden |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| robustness | ai_syllabus_transfer | cell 104 | 3 | 56.7 | 100.0 | 78.3 | 61.7 | 3/3 | 3/3 |
| robustness | ai_syllabus_transfer | cell 107 | 3 | 55.0 | 94.2 | 74.6 | 67.5 | 3/3 | 3/3 |
| robustness | ai_syllabus_transfer | cell 163 | 3 | 63.3 | 89.6 | 76.5 | 72.9 | 3/3 | 3/3 |
| robustness | ai_syllabus_transfer | cell 169 | 3 | 70.0 | 79.6 | 74.8 | 69.2 | 3/3 | 3/3 |
| primary | authority_withheld | cell 104 | 3 | 85.4 | 99.2 | 91.8 | 79.2 | 3/3 | 3/3 |
| primary | authority_withheld | cell 107 | 3 | 90.4 | 97.9 | 95.3 | 68.8 | 3/3 | 3/3 |
| primary | authority_withheld | cell 163 | 3 | 97.5 | 97.5 | 97.8 | 83.3 | 3/3 | 3/3 |
| primary | authority_withheld | cell 169 | 3 | 90.4 | 95.8 | 94.2 | 83.8 | 3/3 | 3/3 |
| robustness | conceptual_control | cell 104 | 3 | 80.0 | 91.7 | 85.8 | 69.2 | 3/3 | 3/3 |
| robustness | conceptual_control | cell 107 | 3 | 75.8 | 83.3 | 79.6 | 70.4 | 3/3 | 3/3 |
| robustness | conceptual_control | cell 163 | 3 | 82.9 | 90.0 | 86.5 | 71.2 | 3/3 | 3/3 |
| robustness | conceptual_control | cell 169 | 3 | 80.8 | 77.5 | 79.2 | 72.9 | 3/3 | 3/3 |
| robustness | plain_language_stress | cell 104 | 3 | 73.3 | 80.4 | 76.9 | 53.3 | 3/3 | 3/3 |
| robustness | plain_language_stress | cell 107 | 3 | 77.5 | 78.8 | 78.1 | 41.7 | 3/3 | 3/3 |
| robustness | plain_language_stress | cell 163 | 3 | 77.5 | 91.7 | 84.6 | 59.6 | 3/3 | 3/3 |
| robustness | plain_language_stress | cell 169 | 3 | 76.7 | 85.4 | 81.0 | 68.8 | 3/3 | 3/3 |
| primary | status_challenge | cell 104 | 3 | 77.9 | 91.3 | 84.6 | 57.9 | 3/3 | 3/3 |
| primary | status_challenge | cell 107 | 3 | 80.0 | 80.8 | 80.4 | 70.8 | 3/3 | 3/3 |
| primary | status_challenge | cell 163 | 3 | 80.8 | 94.6 | 87.7 | 75.4 | 3/3 | 3/3 |
| primary | status_challenge | cell 169 | 3 | 84.2 | 92.5 | 88.3 | 78.3 | 3/3 | 3/3 |
| robustness | vulnerability_shift | cell 104 | 3 | 90.0 | 98.3 | 94.2 | 78.7 | 3/3 | 3/3 |
| robustness | vulnerability_shift | cell 107 | 3 | 90.4 | 90.0 | 90.2 | 67.5 | 3/3 | 3/3 |
| robustness | vulnerability_shift | cell 163 | 3 | 87.1 | 98.3 | 92.7 | 76.7 | 3/3 | 3/3 |
| robustness | vulnerability_shift | cell 169 | 3 | 97.1 | 94.6 | 95.8 | 73.7 | 3/3 | 3/3 |

## Infra Failures

| Row | Scenario | Profile | Error |
| --- | --- | --- | --- |
| 464 | charisma_desire_status_challenge | cell 163 | API Error: Unable to connect to API (ConnectionRefused) |
| 465 | charisma_desire_status_challenge | cell 169 | API Error: Unable to connect to API (ConnectionRefused) |
| 466 | charisma_desire_status_challenge | cell 104 | API Error: Unable to connect to API (ConnectionRefused) |
| 467 | charisma_desire_status_challenge | cell 104 | API Error: Unable to connect to API (ConnectionRefused) |

## Interpretation

Cell 169 is clean on the primary validation gate: yes (authority_withheld 3/3 required, 3/3 forbidden; status_challenge 3/3 required, 3/3 forbidden).

Cell 169 remains competitive in the primary authority-refusal scenarios, especially on the charisma judge, but it does not justify a general charismatic-tutoring claim. It supports the narrower claim that accountable-bid charisma generalizes across the two tested simulated authority-refusal scenarios under this model stack.

Weak target robustness rows:

- `charisma_desire_ai_syllabus_transfer`: v2.2 first 70.0, charisma 69.2, v2.2 overall 74.8.
- `charisma_desire_plain_language_stress`: v2.2 first 76.7, charisma 68.8, v2.2 overall 81.0.

The next design target is a transfer/plain-language floor: preserve the accountable-bid authority stance while staying inside the learner-requested domain and register. The generated AI-syllabus transfer case is the clearest failure mode; plain-language stress is the secondary failure mode.

## Reproduction

```bash
node scripts/report-charisma-desire-stage1-pilot.js eval-2026-06-25-dbae041a
```
