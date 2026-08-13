# 099 — Codex report: main-block launch stopped before the first call

**Date:** 13 August 2026. **Authority:** GO note 097a at commit
`c49d0ab08d17731e36c62aeb8bfe9ab3c9463497`. **Boundary:** fail-closed
launcher refusal before output-directory creation, checkpoint creation,
generation, reader dispatch, assembly, scoring, or any model call.

## Outcome

The authorized command was executed verbatim from the worktree root:

```bash
node scripts/run-adaptive-warrant-outcome-main-block.js --accept-charges
```

It exited 1 with:

```text
[outcome-main-block] error: outcome main block refuses: --go-note must be docs/adaptation-refinement/relay/097a-reviewer-go-note-main-block.md
```

No live run started. No output directory, parent checkpoint, child checkpoint,
dialogue, reader response, quarantine artifact, assembly artifact, acceptance
audit, or score artifact was created. No process remains running. The worktree
was clean at launch and the launcher did not modify it.

The stop is a command/launcher contract mismatch. GO note 097a and the human
direction name the one-line command above, but the committed paid path also
requires explicit values for all of:

- `--go-note docs/adaptation-refinement/relay/097a-reviewer-go-note-main-block.md`;
- `--out <fresh-dir>`; and
- `--instrument-freeze <freeze>`.

The frozen instrument is present at the established path and matches its
registered digest, but neither GO note 097a nor the main-block manifest names a
main-block output directory. Supplying an invented output path or modifying the
committed launcher would exceed the verbatim launch instruction. The driver
therefore did not patch or relaunch.

## Frozen-plan status

| Boundary | Registered | Observed |
|---|---:|---:|
| Dialogues | 72 | 0 started; 0 complete; 0 failed |
| Decision cases in freeze | 576 | 0 assembled |
| Decision reader responses | 1,152 | 0 attempted; 0 complete; 0 failed |
| Full-contract acceptances | 1,152 | 0 audited |
| Presence reader responses | disabled | 0 attempted; 0 complete; 0 failed |

Assembly status against the 576-case freeze is **not started (0/576)**. No
freeze artifact exists for this take because generation never began. The
full-contract acceptance audit is **not run (0/1,152)** because no reader
responses exist.

## Counter arithmetic

No parent or child checkpoint was created, so there is no child-attempt delta
to reconcile. The arithmetic is:

```text
opening counter       5,274
generation attempts       0
decision attempts         0
run delta                 0
closing counter       5,274 / 19,337
remaining            14,063
```

The registered per-run absolute cap remains 3,360 and was not entered.

## Measures

No score artifact was produced. Observed M1–M6 values are **not available**.
Report-only M7/M8 values are also **not available** because no generation-time
events were produced; consequently there is nothing to label or compute as
`not reader-validated` for this take.

## Binding checks

| Artifact | SHA-256 |
|---|---|
| Main-block manifest | `33139d71aa96e7620998472a1b095b563f0cc10bde31ac089c64438b3f7c7438` |
| Parent launcher | `9984dc3401289a788c155760264e624d1fe4f6d6efced6bffe71aef8b79936c0` |
| Frozen decision-reader child | `c0a201300a66e32919d22aaac42e431f32bd1df595b582f7762928a148c2e6ad` |
| Source instrument freeze | `6a64b31fb57fa4a60e6ef4a42414c422d9b0e2964bdf6ee8491193fc026f3c5f` |
| GO note 097a | `2ccc4b346bcdfced5b4d91b7aa983c8d4b2117ae4f938e7883c66e3fcb1cff36` |
| Relay state read before launch | `d31b8e8c55c68d359c60594b25ec589d4eef6680739316df8efcb10b3f4d747f` |

The checked-out HEAD was the authorized commit
`c49d0ab08d17731e36c62aeb8bfe9ab3c9463497`; GO note 097a matched its
committed bytes. Seeds 524–535 were not touched. `STATE.md` was not edited.
Nothing was pushed.

## Required continuation boundary

Continuation requires a committed reviewer correction that either names the
complete paid command, including a fresh output directory and the frozen
instrument path, or authorizes a mechanical launcher repair that binds those
defaults. Any subsequent launch must remain within the 3,360-call run cap and
resume from the unchanged counter 5,274/19,337.
