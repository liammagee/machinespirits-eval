# Dramatic dialogue renderer

`services/dramaticDialogueRenderer.js` is the shared presentation boundary for
public tutor/learner dialogue. It renders one strict interchange as a single
dialogue, a frozen-learner contrast, or parallel arms.

## Contract

The root schema is `machinespirits.dramatic-dialogue-interchange.v1`. It carries:

- declared arms and one of `single`, `shared-learner`, or `parallel`;
- ordered turns and public learner/tutor messages;
- optional delivery labels, verdicts, rulings, typed labels, provenance, and
  plain-language glosses; and
- explicit empty lanes where one free-running dialogue ended sooner.

Validation rejects unknown fields at every level. In particular, private
prompts, deliberation, proof state, and hidden learner state are not renderer
inputs. Surface adapters must select public text and must supply every verdict
or ruling explicitly. The renderer does not score, adjudicate, infer an effect,
or declare a transcript canonical.

Verdicts and rulings are separate objects. A missing ruling stays missing; an
indeterminate ruling stays indeterminate. Provenance describes the supplied
message but does not turn an abridged quote into an exact one.

## Layouts

| Layout | Use | Constraint |
| --- | --- | --- |
| `single` | One ordinary dialogue | Every message belongs to its declared arm. |
| `shared-learner` | Frozen A/B or N-arm replay | Every turn has exactly one shared learner message; tutor messages belong to arms. |
| `parallel` | Free-running or crossed examples | Each arm retains its own learner/tutor sequence; shorter arms use explicit empty lanes. |

All layouts stack at narrow widths. Parallel layouts also expose arm labels
inside every lane so stacked dialogue does not lose its identity. Host pages may
toggle `data-dd-stack` and `data-dd-diff` on `body`, and may hide typed label
groups without changing the interchange.

## Comparison meaning

Layout is presentation grammar, not an evidence grade.

- A `shared-learner` view can support a candidate-next-turn attribution only
  when the originating harness actually freezes the public prefix, learner
  turn, model, and other declared factors.
- A `parallel` view can present either two divergent free-running dialogues or
  a registered crossed-action example. The study design, provenance, delivery
  record, and ruling determine which claim is licensed; the columns do not.
- A `single` view does not make a transcript representative, and no layout
  converts a missing or indeterminate ruling into a result.

Keep the comparison class next to the dialogue wherever it is rendered. That
prevents a visually compelling side-by-side from silently becoming a causal
claim.

## Current adapters and fixtures

- `buildTutorStubAbDramaticDialogue()` copies frozen learner turns and generated
  tutor candidates from the instrumentation A/B. Broken-rule clusters and
  rubric outcomes remain explicit adapter labels.
- `buildTutorStubShowcaseDramaticDialogue()` copies both sides of each
  free-running arm. Guard outcomes and each rubric version remain separate
  labels; judge reasoning remains a separate detail group.
- `buildStressComparisonDramaticDialogue()` maps planted stress-bench moments.
  Standing rulings remain separate from delivered verdicts.
- `notes/poetics/fixtures/adaptive-tutor-crossed-dialogue.json` supplies the crossed
  endgame example in the adaptive-tutor Techne report, including its two
  plain-language glosses.

## Documentation map

| Surface | Layout | What it establishes | What it does not establish |
| --- | --- | --- | --- |
| `docs/tutor-instrumentation-ab.md` | `shared-learner` | A frozen candidate-next-turn contrast under the A/B harness's declared controls | A complete dialogue, later learner response, or human-learning effect |
| `docs/tutor-instrumentation-showcase.md` | `parallel` | Two free-running product experiences plus cost, guard, repair, and closure telemetry | Causal attribution after the transcripts diverge |
| `notes/poetics/2026-08-29-adaptive-tutor-from-null-to-control.html` | `parallel` | A public rendering of the registered crossed-action endgame example | General transfer, classroom validity, or human learning |
| `notes/marketing/2026-08-30-adaptive-tutor-capability-showcase-brief.md` | Reuses all three as needed | A derivative capability and investor narrative grounded in the sources above | New empirical evidence |

Refresh or verify that managed Techne fixture with:

```bash
node scripts/sync-dramatic-dialogue-fixtures.js --write
node scripts/sync-dramatic-dialogue-fixtures.js --check
```

The synchronization command is intentionally direct rather than a package
alias: this is one bounded report fixture, not a new general build lifecycle.
