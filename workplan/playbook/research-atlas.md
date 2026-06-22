# Research atlas

The atlas is a **projection** of `paper-full-2.0.md` into a short spine plus
semi-autonomous modules ("arms"), each carrying a one-word claim-status. The
paper stays the source of truth; the atlas never edits it.

- Manifest: `docs/research/atlas/atlas.yaml` — declares which paper headings
  compose each module, plus the module's claim-status.
- Build: `npm run atlas:build` · validate after editing the paper:
  `npm run atlas:validate` · web hub via `publish-atlas-to-site.js`.
- Design note: `notes/geist_dialogue_research_atlas_note.html`.

## Claim-status grammar (shared vocabulary)

Workplan research/paper items reuse these in their `claim_status` field, so the
board and the atlas speak one language:

| status | meaning |
|---|---|
| `settled` | settled within current evidence |
| `scope-bound` | supported but scope-bound |
| `exploratory` | exploratory |
| `killed` | killed / closed under a specified gate |
| `speculative` | speculative / theoretical |
| `methods` | methods / apparatus contribution |
| `planned` | planned — scaffold, prose pending |
| `future` | future empirical agenda |

## When you open or close an arm
- **Opening:** create a `type: research` item with `claim_status: exploratory`
  (or `planned`), linked to the paper § it will land in.
- **Closing:** when the result folds into the paper, set the item's
  `claim_status` to match the atlas module (`settled` / `scope-bound` /
  `killed` / …), update the atlas manifest, run `atlas:validate`, then move the
  item to `done`.

Keep the item's `claim_status` and the atlas module's status in agreement. If
they drift, the board is misreporting how firm a result is.
