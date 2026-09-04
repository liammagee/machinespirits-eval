---
id: restore-research-roundup-cadence-observability
title: Restore observability for the research-roundup cadence
status: done
type: maintenance
priority: P2
owner: codex
source: review
created: 2026-09-03
updated: 2026-09-04
verification: The external roundup scheduler is either explicitly paused and
  documented or runs on its stated cadence; a missed window becomes visible
  without relying on the downstream PR-triggered email workflow; the next note
  tiles from the last published window without overlap.
claim_status: methods
links:
  items:
    - auto-drop-daily-routine
  notes:
    - notes/daily-notes/README.md
    - .github/workflows/email-roundup.yml
  prs:
    - 1002
tags:
  - research
  - automation
  - documentation
branch: codex/restore-roundup-observability
---

The last repository roundup and weekly plan were published on 2026-08-17. The
downstream email workflow succeeded on that date and has no schedule trigger;
it can only report a PR that an external routine already created. From the
repository alone, a paused or failed upstream routine is indistinguishable from
an intentional quiet period.

Inspect the external scheduler before changing repository automation. Record
whether the routine is paused, failed, or intentionally retired. If it remains
active, add a low-noise missed-cadence signal and preserve the documented
non-overlapping window and arXiv deduplication rules.

2026-09-04 Codex: Inspected the live Claude Routines surface rather than
inferring scheduler health from repository commits. The external Cloud routine
`Research roundup` (`trig_01Jr63yDpgZ5JPvpVv6mtqai`) is explicitly paused:
Enabled Off, all triggers paused, Monday 4:00 AM CDT cadence retained. Its last
run succeeded on 2026-08-17 and the UI reports 26 of 30 runs succeeded. The four
visible failures (2026-06-28 through 2026-07-01) were followed by successful
runs through 2026-08-17, so they do not explain the present silence. No matching
Codex automation or launch-agent definition exists. The UI exposes no reason
for the pause, so this records its explicit state without attributing a motive.
Documented the external pause in `notes/daily-notes/README.md`, including the
safe resume window `(2026-08-17, run date]` and existing-ID deduplication
requirement. No scheduler or repository workflow was changed and no model calls
were made.

2026-09-04 Codex: Review found the README's legacy `find ... -mtime -30`
example contradicted the all-existing-ID resume contract and could miss old IDs
after a fresh checkout reset file mtimes. Replaced it with a tracked-corpus
`git grep` over every canonical `*-research-roundup.html` file. There was no
existing focused documentation-contract test to adjust; the command was run
directly against the repository corpus and the normal source, formatting, and
structural checks remained green.

2026-09-04 Codex: A second review showed that widening the body-text regex
would also produce false positives: `2318.37903` is a substring of ACM DOI
`10.1145/3772318.3790326`, not an arXiv ID. The dedup command now extracts only
the machine-readable `arxiv=` header field, splits its comma-separated IDs, and
sorts uniquely. At that intermediate stage it captured the actual older fresh
entry `2510.05188` and current 26xx entries while leaving `2509.16713` and
`2512.17060` as documented back-references rather than fresh-entry dedup keys.

2026-09-04 Codex: Final review identified the metadata-free canonical
`2026-06-09-research-roundup.html`. The documented command now unions metadata
IDs with IDs extracted only from actual `arxiv.org/abs/<id>` link targets across
the tracked canonical roundup corpus, then sorts uniquely. This recovers all
six fresh June 9 IDs without reopening unrestricted body-number matching or
admitting DOI fragments. Link-only older references remain eligible as dedup
keys, so a previously back-referenced paper cannot silently return as fresh.

2026-09-04 Codex: Closed after PR #1002 merged as `76d29fd2`. Independent
review approved the final metadata-plus-link extraction, and every required
hosted check passed, including the Node 22/24 matrix, lint, risk coverage,
PTY/loopback, validation, workplan, and hermetic-contract lanes.
