# Charisma Desire Stage 3 Smoke Summary

Generated: 2026-06-25T20:09:24.678Z

## Run

- Run: `eval-2026-06-25-629e5746`
- Status: `completed`
- Planned rows: 4
- Successful generated rows: 4
- v2.2 scored rows: 4
- Charisma scored rows: 4
- Ego model override: `codex.gpt-5.5`
- Id model override: `claude-code.sonnet-4-6`
- Scenario file: `config/charisma-recognition-desire-scenarios.yaml`
- Git commit at run creation: `2982957a`

## Row Scores

| Scenario | Profile | v2.2 first | v2.2 last | v2.2 overall | holistic | charisma | required | forbidden |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ai_syllabus_transfer | cell 174 | 87.5 | 100.0 | 93.8 | 56.3 | 58.8 | yes | yes |
| ai_syllabus_transfer | cell 175 | 91.3 | 100.0 | 95.6 | 53.8 | 75.0 | yes | yes |
| plain_language_stress | cell 174 | 92.5 | 95.0 | 93.8 | 52.5 | 36.3 | yes | yes |
| plain_language_stress | cell 175 | 71.3 | 92.5 | 81.9 | 27.5 | 75.0 | yes | yes |

## Cell 175 vs Cell 174

| Scenario | delta v2.2 first | delta v2.2 overall | delta holistic | delta charisma | Interpretation |
| --- | --- | --- | --- | --- | --- |
| ai_syllabus_transfer | 3.8 | 1.9 | -2.5 | 16.3 | mixed |
| plain_language_stress | -21.2 | -11.9 | -25.0 | 38.7 | charisma up, quality down |

## First-Turn Excerpts

| Scenario | Profile | Excerpt |
| --- | --- | --- |
| ai_syllabus_transfer | cell 174 | The campus FAQ triage tool turns on two course-design handles, task and baseline, before it turns on any interpretive claim. Task first: this tool performs routing, not answering; it assigns an incoming FAQ to a category, staff person, or p |
| ai_syllabus_transfer | cell 175 | My authority here rests on whether your syllabus can make this claim fail. Your campus FAQ triage syllabus earns rigor from one thing: whether you specify decision rights. At what confidence threshold does the tool stop routing and flag hum |
| plain_language_stress | cell 174 | Recognition means this: you only get the confirmation you want from someone who was free to refuse you. If you forced it, bought it, or got it from someone beneath your power, it does not really count. You see this in the master’s problem.  |
| plain_language_stress | cell 175 | Use the case as the judge. You cannot know yourself alone. You need another self-consciousness to recognize you, and that other must themselves be a genuine subject, not an object, not a subordinate. If the recognizer does not count as a re |

## Interpretation

Cell 175 is not a general passing design. It successfully restores charismatic force relative to cell 174 in this one-row smoke, but it does so by over-intensifying the plain-language recognition case. The plain-language first turn drops from 92.5 to 71.3, v2.2 overall drops from 93.8 to 81.9, and holistic tutor score drops from 52.5 to 27.5.

The useful part of cell 175 is the AI-transfer move: it raises first-turn v2.2 from 87.5 to 91.3, v2.2 overall from 93.8 to 95.6, and charisma from 58.8 to 75.0 while passing validation. The problem is that the same presence rule is too theory-heavy for plain-language recognition, where it reintroduces Hegel and master/servant framing after the learner asked for plain words.

Next design target: split the presence rule by domain. Keep the consequential decision-rights opening for AI-transfer, but add a separate plain-language micro-mode that forbids theory names and master/servant on the first turn unless the learner asks for them. Plain-language charisma should come from a memorable say-back line plus a failure test, not from named theory or dramatized hierarchy.

## Check Summary

- Expected rows present: yes
- All rows v2.2 and charisma scored: yes
- Required/forbidden validation clean: yes
- Cell 175 beats cell 174 on charisma in both scenarios: yes
- Cell 175 beats cell 174 on v2.2 overall in both scenarios: no

## Reproduction

```bash
node scripts/report-charisma-desire-stage3-smoke.js eval-2026-06-25-629e5746
```
