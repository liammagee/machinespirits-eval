---
id: tutor-stub-unified-session-surface
title: Ship tutor-stub as one shared web and Electron session surface
status: triaged
type: ops
priority: P1
owner: unassigned
source: review
created: 2026-07-22
updated: 2026-07-22
verification: "One web-stack /tutor surface starts and resumes sessions in browser and Electron, exposes safe lab/scenario/profile/model controls plus trace export, keeps credentials server-side, relocates every writable store through desktop path overrides, and passes route-parity, browser, packaged-desktop, keyboard/screen-reader, caption, microphone-consent, interruption, reduced-motion, no-colour, and text-fallback recovery smokes."
depends_on:
  - tutor-stub-capability-session-runtime
  - tutor-stub-safe-capability-labs
  - tutor-stub-session-recipes-explicit-resume
links:
  notes:
    - desktop/ARCHITECTURE.md
    - docs/tutor-stub-cli.md
  items:
    - scriptorium-responsive-shell-navigation
    - scriptorium-static-tools-desktop-quality
    - scriptorium-ux-safety-net
tags:
  - tutor-stub
  - super-app
  - scriptorium
  - electron
  - accessibility
  - voice
  - privacy
milestone: distribution
---

Expose the importable runtime through the existing Express/public stack so the
browser and Electron desktop app share one implementation. The terminal stays
the reference adapter; the new surface adds no forked tutor logic.

Treat voice, accessibility, and privacy as release gates: captions and text
must remain authoritative, microphone use requires visible consent and mute or
push-to-talk controls, raw audio and credentials never enter public traces,
and device/provider failures fall back to the same text session.
