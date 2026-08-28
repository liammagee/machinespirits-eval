---
id: publish-ideal-tutor-blueprint
title: "Publish the ideal-tutor blueprint to the public content site"
status: done
type: ops
priority: P2
owner: human
source: manual
created: 2026-08-04
updated: 2026-08-27
verification: "The current ideal-tutor blueprint passes its provenance check, the content-repository publish succeeds, and https://machinespirits.org/content/articles/ai-tutor/tutor-blueprint.html serves the self-contained recipe page rather than the site's missing-route response; record the content commit and deployment run before marking done."
links:
  notes:
    - notes/poetics/ideal-tutor-blueprint.html
    - DEPLOYMENT.md
  code:
    - notes/poetics/publish-blueprint-to-site.js
  prs:
    - 461
    - 464
    - 466
tags:
  - poetics
  - techne
  - publishing
  - blueprint
milestone: paper-2-0
---

PR #464 added the worktree-safe blueprint stager and staged the current recipe
into the sibling content repository, but deliberately left the outward publish
behind its human gate. A live check on 2026-08-04 returned `Cannot GET` at the
declared static-content URL, so the deployment remains real work rather than a
completed documentation note.

After explicit deployment authorization, run the source and provenance checks
documented in `DEPLOYMENT.md`, execute
`npm run poetics:publish-blueprint -- --publish`, record the content-repository
release commit and deployment run, and verify page content at the live URL. Do
not treat an HTTP 200 alone as success because unknown site routes may soft-200.

- 2026-08-27: DONE. Operator authorized the outward publish in session. The
  provenance check first reported stale (paper had moved v3.0.292 to
  v3.0.293 the same day); the only paper delta was the §6.28 frame-refuser
  depth follow-up paragraph, so the refresh was a restamp plus one clause
  added to the §6.28 bullet ("0 for 38 graded dialogues at calibration
  stage"), which traces verbatim to the new paragraph — delta claim-audit
  clean, all 16 data-refs resolve. Published via
  `npm run poetics:publish-blueprint -- --publish`: content-repo release
  commit d031478 (the publish commit also carried course-479 files already
  sitting in that repo's tree), validation workflow green, deploy run
  33132867779 (a first deploy attempt was refused because validation had
  not yet finished — expected guard, not a defect). Verified by page
  content at
  https://machinespirits.org/content/articles/ai-tutor/tutor-blueprint.html
  (126 KB, stamped v3.0.293, new clause present), not by HTTP status.
