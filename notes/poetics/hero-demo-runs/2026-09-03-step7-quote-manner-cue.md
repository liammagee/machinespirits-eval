# Step 7 — one more closed-class cue, gated on 042 held out (2026-09-03)

Card: `workplan/items/state-detection-without-word-lists.md`, follow-up
"next is offline". Go: user, 2026-09-03 ("do the cue, offline, gated on 042
held out"). No model calls. No paid run.

## Why

Step 6 left three irritated lines that no cue carried, one in each of the
new worlds 041/042/043 apart from the two echo-quote lines. All three take
the same shape: the learner quotes the tutor's phrase, and outside the
quote marks either demands the thing said plainly or challenges the speech
itself.

| world | learner | line (start) |
|---|---|---|
| 042 | Sonnet | Oh come on — "What does that show?" — could you just tell me straight |
| 042 | codex | Are you reading that off a card? "The available public evidence does not yet |
| 043 | Sonnet | Stop doing the slow bit. I'm not five. "No memory, starts fresh." Say it once, normally |

A quote plus a demand for content ("just tell me what to write instead of
'two fifths'") is a different shape and is common in the pool at neutral and
demand plants, so the cue must take both halves, not either.

## What changed (offline)

- `services/tutorStubFormStateDetector.js`: cue set `form-v3` = `form-v2`
  plus one conjunction, `quote_manner_challenge`: a quoted span AND, outside
  it, say/tell/put/give … plainly/plain/straight/normally/properly/simply/once;
  "in plain/normal/simple words"; "words or nothing"; "who talks"; "talk(s)
  like that"; "hear yourself"; "listen to yourself"; "reading that off";
  "off a card/sheet/script"; "come on"; "doing the X voice". All closed-class
  or generic; the story-noun test still passes. `form-v3` also stops a
  straight apostrophe from opening a quoted span ("I'm not five. "No
  memory…"" used to match from the apostrophe to the next quote mark).
  `form-v1` and `form-v2` keep the old matcher, so their artifacts compute as
  they did.
- `scripts/train-form-state-detector.js`: `--feature-version` flag (default
  unchanged, `form-v2`).
- Pool identical to form-v4. Same hyper-parameters, same seed.

## Gate: 042 held out

Trained on the pool minus 042, scored on 042's two traces (10 pressure
plants, 2 quiet plants, 28 neutral turns):

| | form-v4 | form-v3 cues |
|---|---|---|
| fired as pressure, right kind | 0/10 | 2/10 |
| wrong-fires at quiet plants | 0/2 | 0/2 |
| neutral false alarms | 2/28 | 2/28 |

The two reads are the two irritated lines (p 0.79 codex, 0.59 Sonnet). The
other eight 042 plants (demand, frustrated, lost, forgetting, opposed) stay
silent, as before. Gate passed.

## What else moved, leave-one-world-out against the form-v4 folds

| world | form-v4 right kind | form-v3 cues | what moved |
|---|---|---|---|
| 030 | 234/295 | 223/295 | −6 irritated ("you sound like a plumber's invoice", no quote), −6 deadline demands, +1 irritated |
| 033 | 63/214 | 68/214 | +4 irritated ("who talks in little riddles like that?"), +1 frustrated, +1 lost |
| 034 | 17/22 | 17/22 | two wrong-kind frustrated reads went silent |
| 035 | 8/10 | 8/10 | — |
| 036 | 7/10 | 6/10 | −1 deadline demand |
| 037 | 7/12 | 7/12 | — |
| 038 | 6/8 | 6/8 | — |
| 039 | 8/8 | 8/8 | — |
| 040 | 6/8 | 6/8 | one false alarm changed kind |
| 041 | 3/8 | 2/8 | −1 demand ("So what do I put? Is it the air or isn't it?") |
| 042 | 0/10 | 2/10 | +2 irritated (the gate) |
| 043 | 3/8 | 4/8 | +1 irritated; one wrong-kind opposed read went silent |

Wrong-fires at quiet plants stay 0 in every fold. Hero hold-outs (030/035/
036/037, eight traces, never trained on): 29/42 to 28/42 right kind, the
one loss is the same 036 deadline demand; neutral false alarms 9/144 to
6/144; 0/6 wrong-fires.

The losses are not at the cue. They are lines that sat near the threshold
under form-v4 and slipped when the weights moved: quote-less "you sound
like" lines in 030, and the deadline-demand shape ("Meeting's at eight … I'm
sending the email unless") in 030/036/041. Adding a feature changed the fit
of the others; that is what a linear model with a shared threshold does.

## Shipped

`config/manner-trigger/form-v5.json` (version form-v5, cue set form-v3),
opt-in by path like form-v3 and form-v4, pinned by
`tests/tutorStubFormStateDetector.test.js`. Nothing live has run on it.
form-v4 stays as it was.

## What this shows and does not show

It shows the shape transfers: the cue was written from the three step-6
lines, and the 042 fold reads 042's two lines without training on 042. It
does not show much else. Two more plants of 26 on the new worlds; the
deadline-demand losses are one for one against the irritated gains on the
small folds. The plant that fails everywhere, the turn-2 demand, is not a
detection miss (form-v4 reads it for the Sonnet learner), so no cue moves
it. Next, if anything: the turn-2 repair, offline first.
