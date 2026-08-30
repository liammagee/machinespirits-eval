# Dramatic dialogue renderer

`services/dramaticDialogueRenderer.js` is the shared presentation boundary for
public tutor/learner dialogue. It renders one strict interchange as a single
dialogue, a frozen-learner contrast, or parallel free-running arms.

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

## Current adapters and fixtures

- `buildTutorStubAbDramaticDialogue()` copies frozen learner turns and delivered
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

Refresh or verify that managed Techne fixture with:

```bash
node scripts/sync-dramatic-dialogue-fixtures.js --write
node scripts/sync-dramatic-dialogue-fixtures.js --check
```

The synchronization command is intentionally direct rather than a package
alias: this is one bounded report fixture, not a new general build lifecycle.
