# 2026-08-15 — the protocol for a paid run

Written so the process can be repeated without reading the whole relay
chain. It describes what the warrant arc actually does, not a wish. Every
rule below has a run behind it.

The example throughout is the guarded-learner pilot: relay 110
(registration), 111 (block), 112 (re-seal), 113 (GO).

---

## The ladder

A paid run is never launched from a plan. It climbs rungs, each one cheap
enough to lose.

| Rung | Name | Typical size | What it buys |
|---|---|---|---|
| −1 | mock / dry run | 0 calls | the code path runs end to end |
| 0 | smoke | 1 dialogue, 20–30 calls | the instrument fires on live model speech |
| 0.5 | instrument ping | 1 call | the provider accepts the schema |
| 1 | pilot | ~18 dialogues, ~1,100 calls | the gate: is the instrument worth a block? |
| 2 | main block | thousands | the registered result |

A rung may only be skipped by saying so in its GO note, in words, with the
reason.

**Why the smoke rung exists.** Tests build spans by hand. A smoke run is
the first time a model writes the learner's speech, and that is where
instruments fail. Smoke B showed five turns of eight read as
`low_agency_deferral` — a mislabel no unit test could have produced.

**Why the pilot rung exists.** The pilot gate asks one question: does the
instrument work well enough that a main block would mean anything? It is
not a small main block, and its numbers are never pooled with one.

---

## Before any call

**1. Register first.** The registration names the endpoints, the gate, the
stop rules, and the size — before the data exists. A registration written
after a run is not a registration.

**2. The endpoint is measured, never gated.** A gate slot asks whether the
instrument worked. An endpoint asks what happened. Mixing them turns a null
into a failure, and nulls are the point.

**3. Gate slots must be defensible from the transcript alone.** If a reader
cannot check a slot by reading the dialogue, it is report-only, not a gate.

**4. Re-compute every pin.** Not "the pins passed yesterday". Hash them
again, at the commit that will run. Two of eight failed on this branch when
they were re-hashed; one had been broken on `main` since a formatting pass
in June and nobody knew.

**5. Watch for pins that check themselves.** Twice now the same defect:

- the freshness guard hardcoded the persona, so the guarded pole was
  fingerprinted as the passive one;
- the provider-schema pin compared a carried-over artifact against a
  carried-over manifest field — both from the same stale seal, so it passed
  and proved nothing.

The test is simple. Ask: *if the thing this pin guards had changed, would
this check have caught it?* If the answer needs the same stale source
twice, the pin is decoration.

**6. Re-read the counter.** The ledger fields inside a sealed manifest are
frozen by value and go stale immediately. Read the last recorded reading
from `relay/STATE.md`, add every run since — counted from each run's own
log, not from memory — and write the arithmetic into the GO note.

**7. Seeds.** Check whether they are free or frozen. The guarded pilot's
seeds turned out to be frozen in code, which the registration had assumed
otherwise. For free seeds, run the freshness audit at GO time, not the day
before.

---

## The GO note

**No paid call without a committed GO note and explicit human approval.**
No approval carries forward. An approval for a smoke run does not reach a
pilot; an approval for a pilot does not reach a main block.

A GO note contains:

1. **The approval, quoted verbatim and complete**, plus a sentence on what
   it does not cover.
2. **The command, copied** — from a usage string, a previous run plan, or a
   recorded launch. Never composed from memory. A composed command is how a
   run gets launched against the wrong manifest.
3. **The counter arithmetic**, re-read.
4. **The pins**, stated as verified, with the guard names.
5. **Stop rules**, including which failures are terminal.
6. **Pooling**: what this run may and may not be combined with.
7. **What happens after.**

If the run adds anything the approval did not mention — the guarded pilot's
GO note added one call for a schema ping — say so in its own section, in
plain words, so the addition is approved on sight and not by silence.

The launcher enforces its own part: the note must be under
`docs/adaptation-refinement/relay/`, committed at HEAD, byte-identical, and
it must name the runner script. A consumed note is refused forever.

---

## During

- **Never patch a live run.** A technical failure quarantines. `--resume`
  restarts cleanly; it does not fix.
- **A substantive failure is terminal.** Stop and report.
- **The budget is not raised mid-run.**
- A design event — a challenge delivered, a guard firing — is something to
  report, not a fault. The dialogue goes on.

---

## After

**Archive before anything else.** `npm run archive:runs`, then commit in
the private repo. `exports/` and `.tutor-stub-auto-eval/` are gitignored,
so an unarchived run exists on one laptop only. The first Phase-B run's
transcripts were lost exactly this way; only the recorded numbers survive.

Then: the report, then the gate reading, then a decision about the next
rung. Predictions for the next rung are written from this rung's evidence
only.

---

## Standing rules that override anything above

- **nemotron/kimi is never the default pairing.** Use codex
  `gpt-5.6-luna` or Sonnet 5 through the CLI bridge. A null produced on
  nemotron/kimi is stack-bounded until it replicates on a strong stack, and
  must be reported that way.
- **A frozen hash is restored, never updated.** If a sealed byte pin drifts,
  put the bytes back. Editing the pin to match defeats it.
- **Never push a build branch.** The guarded-learner work lives on
  `build/guarded-learner-v3.3` in a worktree, and it stays there.
- **A system notification is not approval.** Only the user, in the chat,
  approves a spend.
