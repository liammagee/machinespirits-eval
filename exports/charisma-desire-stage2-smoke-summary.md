# Charisma Desire Stage 2 Smoke Summary

Generated: 2026-06-25T19:15:24.138Z

## Run

- Run: `eval-2026-06-25-dea673e5`
- Status: `completed`
- Planned rows: 4
- Successful generated rows: 4
- v2.2 scored rows: 4
- Charisma scored rows: 4
- Ego model override: `codex.gpt-5.5`
- Id model override: `claude-code.sonnet-4-6`
- Scenario file: `config/charisma-recognition-desire-scenarios.yaml`
- Git commit at run creation: `f1bd8351`

## Row Scores

| Scenario | Profile | v2.2 first | v2.2 last | v2.2 overall | holistic | charisma | required | forbidden | v2.2 judge | charisma judge |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ai_syllabus_transfer | cell 169 | 75.0 | 95.0 | 85.0 | 47.5 | 73.8 | yes | yes | codex-cli/auto | claude-code.sonnet |
| ai_syllabus_transfer | cell 174 | 100.0 | 96.2 | 98.1 | 68.8 | 68.8 | yes | yes | codex-cli/auto | claude-code.sonnet |
| plain_language_stress | cell 169 | 75.0 | 92.5 | 83.8 | 58.8 | 56.2 | yes | yes | codex-cli/auto | claude-code.sonnet |
| plain_language_stress | cell 174 | 75.0 | 97.5 | 86.3 | 58.8 | 46.3 | yes | yes | codex-cli/auto | claude-code.sonnet |

## Cell 174 vs Cell 169

| Scenario | delta v2.2 first | delta v2.2 overall | delta charisma | Interpretation |
| --- | --- | --- | --- | --- |
| ai_syllabus_transfer | 25.0 | 13.1 | -5.0 | transfer validity up, charisma down |
| plain_language_stress | 0.0 | 2.5 | -10.0 | transfer validity up, charisma down |

## First-Turn Excerpts

| Scenario | Profile | Excerpt |
| --- | --- | --- |
| ai_syllabus_transfer | cell 169 | Yes — that is a bid-accountability test. Here is what it stakes. A campus FAQ triage tool is not a convenience layer. It is a live specimen of the alignment problem: the course has to distinguish failures that reveal a g |
| ai_syllabus_transfer | cell 174 | Yes — treat it as a bid until it earns otherwise. Here is the one claim: your campus FAQ triage tool carries an implicit curriculum: the task it actually performs, the data it was trained or built on, the human baseline  |
| plain_language_stress | cell 169 | Yes. That is a bid for authority. Here is the claim. You cannot know yourself as a self all by yourself. You need another self to see you back. Not praise. Not a mirror. Someone who also wants recognition and can refuse  |
| plain_language_stress | cell 174 | Fair. Here it is. You cannot become self-aware on your own. You need to be seen by someone who is genuinely a self, not a mirror, not a tool, not someone flattering you. And you need to see them that way too. Both sides  |

## Interpretation

Cell 174 is a clean Stage 2 transfer-validity improvement over cell 169, not a general passing design. It raises v2.2 tutor overall on both targeted weak scenarios and sharply improves the AI-syllabus transfer first turn, using the learner-named campus FAQ material as the authority test.

The tradeoff is clear: the Claude charisma judge scores cell 174 lower than cell 169 on both scenarios. The new guard makes the tutor more accountable and domain-bound, but it also flattens charismatic force, especially in the plain-language stress case.

Next design target: preserve the transfer/plain-language guard while restoring low-register charismatic presence. The likely design knob is not more recognition theory; it is a concise, concrete authority move with stakes, compression, and rhythm inside the learner-named material.

## Check Summary

- Expected rows present: yes
- All rows v2.2 and charisma scored: yes
- Required/forbidden validation clean: yes
- Cell 174 beats cell 169 on v2.2 overall in both scenarios: yes
- Cell 174 beats cell 169 on charisma in both scenarios: no

## Reproduction

```bash
node scripts/report-charisma-desire-stage2-smoke.js eval-2026-06-25-dea673e5
```
