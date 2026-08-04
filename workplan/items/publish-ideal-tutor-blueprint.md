---
id: publish-ideal-tutor-blueprint
title: "Publish the ideal-tutor blueprint to the public content site"
status: blocked
type: ops
priority: P2
owner: human
source: manual
created: 2026-08-04
updated: 2026-08-04
blocked_by: Human authorization to execute the outward production deployment from the staged content repository.
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
