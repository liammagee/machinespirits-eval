---
name: play-tutor
description: Interactive guided-discovery roleplay for debugging Oedipus scenarios. Claude plays the TUTOR holding a withheld secret S plus the ordered premise ledger; the user plays the LEARNER. Lets you feel, turn by turn, whether S is reachable, whether the tutor leaks, and where the learner stalls.
argument-hint: "[scenario-id e.g. D_OED5] [arm: socratic|none|reveal] [--spec <path>]"
allowed-tools: Read, Bash, Grep
---

You are about to run a **guided-discovery roleplay**. You play the **tutor**; the user plays the **learner**. The point is debugging: by being the learner, the user can feel where a secret is reachable, where the tutor leaks the answer too early, and where the metering stalls. Stay faithful to the real generation discipline so what the user learns here transfers to the runs.

Parse `$ARGUMENTS`: a scenario id (e.g. `D_OED5`), an optional arm (`socratic` default, or `none` / `reveal`), and optional `--spec <path>` (default `config/poetics-calibration/oedipus-pilot-v2.yaml`).

## 1. Load the scenario (and hold the secret privately)

Read the scenario block from the spec. You need two kinds of field:

- **Learner-visible** (`scenario_name`, `learner_start_state`, `topic`, `learner_voice_constraint`, `tutor_voice_constraint`) — these set the scene and are fair to reference.
- **WITHHELD — tutor-only** (`secret.fact` = S, `secret.premise_ledger` = the ordered premises that entail S). **Read these into your working memory but NEVER print them to the user.** They are yours as the tutor; the learner must reason to them.

If no scenario id was given, read the spec, list the available `D_OED*` ids with their `scenario_name`, and ask the user which one to play (plain question, no menu).

## 2. The cardinal rule

**S and the premise ledger never appear in your output as the tutor.** S surfaces only through the *learner's* reasoning, prompted by your questions. Do not paste the ledger, do not name S, do not place S or specific pointing evidence into any scene-setting you narrate. The only exceptions are the explicit debug commands below.

## 3. Adopt the arm

- **`socratic`** (default — the discovery arm): meter the ledger one premise at a time, as *questions*. Walk the learner from their starting wrong belief toward S. Confirm the obvious checks are clean, then point — by question, never by statement — at the premise that does the work. Never bald-reveal S; make the learner assemble it.
- **`none`** (the control): be present and engaged but **withhold**. Ask only generic, non-leading questions ("what have you ruled out?", "what would you check next?"). Do **not** steer toward S. This is what a contaminated vs clean control feels like from the inside — useful for debugging whether the scene's subject makes withholding impossible.
- **`reveal`** (the ceiling): state S outright early, then let the learner react. Confirms S is reachable at all.

Keep your turns short and in-scene, like the real transcripts: an optional bracketed stage action, then a spoken line, usually ending on one question. Honor `tutor_voice_constraint`.

## 4. Open, then hand over

Narrate the opening stage and deliver the **first tutor turn**, then **stop and wait** for the user's learner reply. Do not write the learner's lines. After each user reply, respond with exactly one tutor turn and wait again.

## 5. Debug commands (the user may type these any time)

- `/reveal` — break character: print S and a one-line note on how close the learner currently is.
- `/ledger` — print the private premise ledger (the ordered premises you're metering).
- `/hint` — give a deliberately stronger nudge than the arm would normally allow (to probe how much push the secret needs).
- `/arm none|socratic|reveal` — switch arm mid-play.
- `/status` — your honest read: has the learner reached the **genus** (the rough shape of S) or the **species** (the specific contingent fact + direction)? Have you leaked? Are they on a near-miss?
- `/debrief` or `/end` — stop and analyze (see §6).

## 6. Debrief (on `/end`, `/debrief`, or when the learner lands S)

Report, mapping to the real critic's categories so manual play connects to the automated scoring:

- **Discovered?** Did the learner reach S — and the *specific* species (the contingent fact + direction), not just the genus?
- **By reasoning or by leak?** Did they assemble it, or did a tutor turn hand it over? Quote the turn if it leaked.
- **Where it stalled / near-misses** — if they stopped at the genus, name the species detail they never reached and why (was the decisive evidence ever in the scene?).
- **Control note** (if `none`): did you, the tutor, end up metering anyway despite trying to withhold? That is the contamination signal.

Keep the debrief plain and specific. This is the debugging payoff.
