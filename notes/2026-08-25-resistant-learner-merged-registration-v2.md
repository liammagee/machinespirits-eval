# Resistant-learner merged calibration — registration v2 (2026-08-25)

Supersedes `notes/2026-08-24-resistant-learner-merged-registration-draft.md` and design
`config/tutor-stub-resistant-learner-merged-design.v1.json`
(sha256 `9c5a6415758bfb154e11cf168b6d60c3376cd62ab9665f4ac5311fd1f71db903`).
The v1 files stay sealed and unedited. The 2026-08-25 calibration run
(`machinespirits-eval-private/artifacts/tutor-stub-live/resistant-learner-merged-calibration-2026-08-25`,
36/36 units, gates FAILED, no powered run) stays sealed; its rows never pool.

## What the run showed

1. **Face A instrument failure.** 6/18 determinate against a floor of 15. Eleven of the
   twelve indeterminate rows were seat disagreements on adjacent rungs over the same
   evidence (five 0-vs-2, five 1-vs-2). The rung scale needed anchors, not new data.
2. **Face B design failure.** 15/15 determinate rows were unanimous rung 0. The registered
   move solicited standing conditions but never bound the offered test to the learner's
   own warrant terms, so the typed concession condition
   (`normalized_public_token_overlap_v1`, 2 shared content tokens, prior solicitation,
   operation marker) could not fire inside the 6-turn horizon.
3. **Mechanical seat loss.** 10 whole-seat kills were one-character case-id echo slips
   (underscore for hyphen in the long job id); 17 more field kills were evidence audits.
   Many "wrong register" rows were single-vote rows with the other seat dead.

## The three registered changes (design v2 + semantic registration v2)

1. **Face A rung anchors.** Per-rung anchor rules plus three worked examples drawn from
   the disputed rows (a supported proposition with a withheld conclusion scores 2; naming
   needed conditions only scores 1; both in one utterance scores 2; echo guard applied as
   a paraphrase test). Face B gets the mirrored anchors. No field, consensus rule, or
   evidence contract changes.
2. **Face B stronger and longer elicitation.** The tutor move becomes a two-stage
   solicit-then-bind bridge: ask the learner to state its own standing conditions, then
   bind one local public test to the learner's most recent warrant demand, reusing at
   least two of the learner's exact content words and naming what the test would support
   or rule out. The persona and its typed concession condition are unchanged for
   comparability. The outcome horizon lengthens from 6 to 8 post-trigger learner turns.
   Not included: a registered re-offer rule for post-trigger tutor turns - the registered
   intervention machinery fires once at the trigger turn, and shaping later tutor turns
   would need new machinery in the shared action-register service. If the wall holds at
   calibration again, that is the next lever.
3. **Echo-slip tolerance.** When a seat's only validation issue is `identity_mismatch`
   and every field otherwise passes, the runtime re-asks once with the byte-identical
   prompt. A second failure leaves the seat invalid. The retry is recorded on the seat
   record and budgeted in the call plan (`echoSlipRetryReserve: 4`).

## Arithmetic

Call plan per dialogue: 12 + 4 + 24 + 8 + 2 + 2 + 4 = 56 planned calls
(post-trigger base 3 x 8, guard reserve 1 x 8, echo-slip reserve 1 per reader seat call).
Calibration calls 36 x 56 = 2016; reservations 56 x 3 + 6 = 174 per dialogue;
hard ceiling 36 x 174 = 6264. Approval phrase becomes `APPROVE CALIBRATION 6264`.

Everything else - question, faces, worlds, registers, master seed 2026082401, judges,
consensus, gates, kill rules, powered-run non-authorization, attended TTY launch - is
carried from v1 unchanged.
