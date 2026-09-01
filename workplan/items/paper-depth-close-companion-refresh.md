---
id: paper-depth-close-companion-refresh
title: Fold the depth-line construct close into the companion documents and republish
status: done
type: paper
priority: P1
owner: claude
source: manual
created: 2026-08-31
updated: 2026-08-31
verification: >-
  Atlas, arc (plus its standalone build), blueprint, the HOW-TO reading note
  and docs/ref-status.md inherit paper v3.0.299 and record the depth-line
  construct close with its claim discipline (calibration-lineage scope; the
  powered 0.114 base unexamined at the seam). Atlas validation, blueprint
  provenance refs, workplan validation and formatting checks pass; rebuilt
  artifacts reproduce; publication dry-runs target an isolated content
  worktree; live pages are verified by content, not HTTP status, after the
  operator authorizes the outward publish.
claim_status: methods
depends_on:
  - frame-refuser-depth-study
links:
  items:
    - frame-refuser-depth-study
    - paper-frame-refuser-closeout-publication
  paper:
    - docs/research/paper-full-2.0.md
  notes:
    - notes/2026-08-30-frame-refuser-depth-construct-finding.md
    - notes/poetics/ideal-tutor-blueprint.html
    - notes/poetics/2026-05-26-paper-to-dramatic-recognition-arc.html
tags:
  - paper
  - publishing
  - tutor-stub
  - frame-refusal
---

## Scope

Paper v3.0.299 (merged in PR #892) closed the frame-refuser depth line on a
construct finding. The companion surfaces still reflect v3.0.298, where the
depth question is described as open at the instrument's resolution. Carry
the close into each surface, rebuild, and republish under the existing
human publication gate. No new study, no historical rescoring, no treatment
claim, no abstract or headline-N change.

Surfaces: `docs/research/atlas/atlas.yaml` (resistant-learner-delivered-move
caveat, methodological map, abstract), the recognition-arc HTML and its
generated standalone, `notes/poetics/ideal-tutor-blueprint.html` (§6.28
lesson bullet, version stamp), `HOW-TO-BUILD-A-TUTOR.md` (reading note),
and `docs/ref-status.md` (regenerated, never hand-edited).

## Log

- 2026-08-31: Card opened after PR #892 merged (paper v3.0.299). Live check
  confirmed the previously published bundle serves v3.0.298.
- 2026-08-31: All five surfaces refreshed. Atlas: the
  resistant-learner-delivered-move caveat, the methodological map and the
  §6.25–§6.30 abstract now record the construct close; validation 19
  modules, 0 errors, 0 warnings. Arc: one new close paragraph after the
  successor-designs paragraph, claim cut restamped v3.0.299 in the TOC
  meta and colophon, standalone regenerated. Blueprint: hero rune
  restamped (v3.0.299, commit f0446729), the §6.28 lesson bullet and the
  timing-and-typing "Why" paragraph carry the close;
  `refresh-blueprint.js --check` reports provenance current, 16/16
  data-refs resolve. HOW-TO reading note: restamped, and the close added
  as a fourth build rule (construct limit — close the scale, do not
  re-anchor again). `docs/ref-status.md` regenerated (canonical paper
  anchor 3.0.299). Workplan validates 575/575; prettier clean; atlas
  spine and 19 module markdown builds reproduce; both site publishes pass
  `--dry-run` against the isolated staging target. Live publication still
  awaits the operator's explicit authorization.
- 2026-08-31: DONE — published live on the operator's explicit "publish".
  Staged from the eval checkout at merged main (1cef61d4, PRs #893/#894 in);
  both stagers dry-ran clean against the content-philosophy checkout, which
  was fast-forwarded to origin/master (513cdb8) and verified clean first.
  The planned isolated content worktree was dropped: `./publish` pushes the
  current branch and cannot run detached, and the clean tree plus the
  script's allowlist staging gave the same isolation. Exactly four files
  changed (both pages and their .md stubs; the 11 arc images were
  byte-identical). Content commit 3013725 pushed; the immediate deploy
  dispatch failed closed (revision had no successful validation workflow
  yet — dispatched too early), and the site's scheduled drift check
  deployed the revision one minute later. Live pages verified by content,
  not HTTP status: tutor-blueprint.html and dramatic-recognition-arc.html
  both serve v3.0.299 stamps only, no v3.0.298 remnant.
- 2026-08-31: Publication gap found and closed. The first pass ran only the
  two poetics stagers and missed the third publisher,
  `scripts/publish-atlas-to-site.js`, which carries the atlas hub, the
  spine plus 19 module PDFs, and the consolidated paper PDF. The live hub
  was still serving v3.0.298 and no v3.0.299 paper PDF existed on the
  site; the artifacts themselves were current (atlas.yaml 08:19, every PDF
  built 08:20–08:22). Staged (hub verified at v3.0.299 before push, 20
  refreshed PDFs, paper-2.0-v3.0.299.pdf new) and pushed as content commit
  41868f1. Deploy dispatched only after the content repo's validation
  workflow reported success — the earlier dispatch failed closed for
  exactly that reason. Verified live by content: geist-atlas.html serves
  v3.0.299 only; paper-2.0-v3.0.299.pdf, atlas/spine.pdf and a spot-checked
  module PDF all serve. Standing lesson for this card's successors: the
  companion bundle has three publishers, not two.
