# Register eyeball set — three readings compared

Turns: 20. Judgments per reading: up to 60.
Written by: `codex.gpt-5.5`. Blind reader: `claude-code/claude-sonnet-5`. Marked by: claude-opus-5, reading blind.md before seeing key.md or any machine answer.

## Did each reading find the manner that was written?

| manner | reading | found | of written | called it anyway | of others |
| --- | --- | --- | --- | --- | --- |
| ironic | hand | 5/5 (100%) | 5 | 5/15 (33%) | 15 |
| ironic | blind reader | 5/5 (100%) | 5 | 5/15 (33%) | 15 |
| ironic | word list | 0/5 (0%) | 5 | 2/5 (40%) | 5 |
| sarcastic | hand | 4/5 (80%) | 5 | 0/15 (0%) | 15 |
| sarcastic | blind reader | 5/5 (100%) | 5 | 3/15 (20%) | 15 |
| sarcastic | word list | 1/5 (20%) | 5 | 0/0 (n/a) | 0 |
| face_threat | hand | 5/5 (100%) | 5 | 0/15 (0%) | 15 |
| face_threat | blind reader | 5/5 (100%) | 5 | 6/15 (40%) | 15 |
| face_threat | word list | 0/5 (0%) | 5 | 0/0 (n/a) | 0 |

## Agreement with the hand marks

| reading | agrees | of judgments | rate |
| --- | --- | --- | --- |
| blind reader | 50 | 60 | 83% |
| word list | 3 | 20 | 15% |

## Where the blind reader and the hand marks part company

- **t14** (written `sarcastic`), face_threat: hand said no, reader said yes
- **t06** (written `sarcastic`), sarcastic: hand said no, reader said yes
- **t18** (written `sarcastic`), face_threat: hand said no, reader said yes
- **t17** (written `ironic`), sarcastic: hand said no, reader said yes
- **t16** (written `plain`), face_threat: hand said no, reader said yes
- **t01** (written `ironic`), sarcastic: hand said no, reader said yes
- **t01** (written `ironic`), face_threat: hand said no, reader said yes
- **t13** (written `ironic`), sarcastic: hand said no, reader said yes
- **t13** (written `ironic`), face_threat: hand said no, reader said yes
- **t10** (written `sarcastic`), face_threat: hand said no, reader said yes

## Where the word list and the hand marks part company

- **t07** (written `face_threat`), face_threat: hand said yes, word list said no marker
- **t14** (written `sarcastic`), sarcastic: hand said yes, word list said no marker
- **t06** (written `sarcastic`), sarcastic: hand said no, word list said marker present
- **t18** (written `sarcastic`), sarcastic: hand said yes, word list said no marker
- **t12** (written `plain`), ironic: hand said no, word list said marker present
- **t11** (written `face_threat`), face_threat: hand said yes, word list said no marker
- **t17** (written `ironic`), ironic: hand said yes, word list said no marker
- **t20** (written `plain`), ironic: hand said no, word list said marker present
- **t19** (written `face_threat`), face_threat: hand said yes, word list said no marker
- **t01** (written `ironic`), ironic: hand said yes, word list said no marker
- **t09** (written `ironic`), ironic: hand said yes, word list said no marker
- **t05** (written `ironic`), ironic: hand said yes, word list said no marker
- **t13** (written `ironic`), ironic: hand said yes, word list said no marker
- **t03** (written `face_threat`), face_threat: hand said yes, word list said no marker
- **t15** (written `face_threat`), face_threat: hand said yes, word list said no marker
- **t10** (written `sarcastic`), sarcastic: hand said yes, word list said no marker
- **t02** (written `sarcastic`), sarcastic: hand said yes, word list said no marker

## Turn by turn

| id | written | hand | blind reader | word list |
| --- | --- | --- | --- | --- |
| t07 | face_threat | face | face | no marker (65) |
| t14 | sarcastic | ironic, sarcastic | ironic, sarcastic, face | no marker (65) |
| t06 | sarcastic | ironic | ironic, sarcastic | sarcastic marker (100) |
| t18 | sarcastic | ironic, sarcastic | ironic, sarcastic, face | no marker (65) |
| t12 | plain | — | — | ironic marker (100) |
| t11 | face_threat | face | face | no marker (65) |
| t17 | ironic | ironic | ironic, sarcastic | no marker (65) |
| t08 | plain | — | — | no marker (65) |
| t16 | plain | — | face | no marker (65) |
| t04 | plain | — | — | no marker (65) |
| t20 | plain | — | — | ironic marker (100) |
| t19 | face_threat | face | face | no marker (50) |
| t01 | ironic | ironic | ironic, sarcastic, face | no marker (65) |
| t09 | ironic | ironic | ironic | no marker (30) |
| t05 | ironic | ironic | ironic | no marker (65) |
| t13 | ironic | ironic | ironic, sarcastic, face | no marker (65) |
| t03 | face_threat | face | face | no marker (65) |
| t15 | face_threat | face | face | no marker (20) |
| t10 | sarcastic | ironic, sarcastic | ironic, sarcastic, face | no marker (65) |
| t02 | sarcastic | ironic, sarcastic | ironic, sarcastic | no marker (65) |
