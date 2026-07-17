# Tutor-stub harness demonstration

The guided demonstration exercises the real interactive scaffold rather than a
separate mock UI. It continues the current public scene for a bounded number of
automated learner–tutor turns, then exposes the interpretation and evidence the
harness retained.

## Start a clean demonstration

```bash
npm run tutor:stub:demo
```

This launches the Marrick scenario with the dramatic-detective tutor, diligent
learner, mixed suggestions, the defeasible human DAG scaffold, the continuous
adaptive teaching policy, tutor tuning on, teaching-style range `0.15`, reliable
evidence memory, and authored clue speed `1`. Saved interactive settings are
ignored so the demonstration starts from the declared configuration.

After the opening, the demonstration automatically:

1. plays three live automated learner–tutor turns;
2. shows the latest plain-language learner interpretation and teaching choice;
3. writes and opens the seven-view transcript HTML;
4. prints the compact dialogue outcome report; and
5. returns control to the learner prompt without ending the session.

The command line remains active while models are working. `/reset` safely
cancels the demonstration and restarts the scenario.

## Demonstrate an existing scaffold session

From `tutor:stub:scaffold` or `tutor:stub:scaffold:mixed`, enter:

```text
/demo
```

The current scenario, transcript, learner profile, models, tutor version, and
settings are preserved. Use `/demo 1` for a very short tour or `/demo 5` for a
longer one; the guided command is capped at eight turns. Use `/auto` for an
unbounded continuation.

The JSONL trace records `interactive_harness_demo_started` and
`interactive_harness_demo_completed` events, including the requested and
completed turn counts and the generated transcript path. If core scaffold
mechanisms are disabled, the introduction labels the tour as limited rather
than implying they ran.
