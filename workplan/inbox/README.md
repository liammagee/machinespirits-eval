# Inbox — the capture queue

Raw, un-triaged captures land here before they become real items. Capture is
cheap and commitment is separate: anything worth a second look goes here without
having to be fully shaped.

## What lands here
- **Daily-routine actions.** The research roundup's recommendations are dropped
  here, one file per action, de-duped (same spirit as the roundup's arxiv-id
  dedup — don't recapture an action already here or already an item).
- **By-the-way ideas.** Anything an agent or human notices mid-task that
  shouldn't derail the current work.

## File format
`inbox/<YYYY-MM-DD>-<short-slug>.md`:

```markdown
---
title: <one line>
source: daily-routine        # or manual / review
created: 2026-06-22
suggested_type: research     # a hint for triage, not binding
links:
  notes: notes/daily-notes/2026-06-20-research-roundup.html
---

One short paragraph: what the idea is and why it might matter. Link the source.
```

## Triage
Promotion to a real item is a deliberate step:

```bash
node scripts/workplan.js triage inbox/<file>.md
```

It shapes the capture into `items/<slug>.md` (you add `priority`, `owner`,
`verification`), then removes the inbox file. Or drop it: delete the file with a
one-line reason in the commit. A "no" is a fine outcome; an overflowing inbox
that never gets triaged is not.
