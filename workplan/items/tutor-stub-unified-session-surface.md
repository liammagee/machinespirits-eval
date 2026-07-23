---
id: tutor-stub-unified-session-surface
title: Ship tutor-stub as one shared web and Electron session surface
status: review
type: ops
priority: P1
owner: codex
source: review
created: 2026-07-22
updated: 2026-07-23
verification: "One web-stack /tutor surface starts and resumes sessions in browser and Electron, exposes safe lab/scenario/profile/model controls plus trace export, keeps credentials server-side, relocates every writable store through desktop path overrides, and passes route-parity, browser, packaged-desktop, keyboard/screen-reader, caption, microphone-consent, interruption, reduced-motion, no-colour, and text-fallback recovery smokes."
depends_on:
  - tutor-stub-capability-session-runtime
  - tutor-stub-headless-session-transport
  - tutor-stub-process-session-factory
  - tutor-stub-safe-capability-labs
  - tutor-stub-session-recipes-explicit-resume
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/159
  notes:
    - desktop/ARCHITECTURE.md
    - docs/tutor-stub-cli.md
  items:
    - tutor-stub-headless-session-transport
    - tutor-stub-process-session-factory
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
branch: codex/tutor-stub-super-app-slices
---

Expose the importable runtime through the existing Express/public stack so the
browser and Electron desktop app share one implementation. The terminal stays
the reference adapter; the new surface adds no forked tutor logic.

Treat voice, accessibility, and privacy as release gates: captions and text
must remain authoritative, microphone use requires visible consent and mute or
push-to-talk controls, raw audio and credentials never enter public traces,
and device/provider failures fall back to the same text session.

## Progress

- 2026-07-23: The first transport slice is in review: a bounded in-process session
  host and versioned Express router over the shared runtime, with the real tutor
  engine kept behind an injected factory boundary.
- 2026-07-23: Headless transport PR #157 merged. A process-backed real tutor
  factory is now in review for the shared web and Electron servers; the visual
  `/tutor` surface remains downstream of safe lab/command metadata.
- 2026-07-23: Process factory PR #158 merged. Added the shared `/tutor` browser
  and Electron surface, learner-safe catalog, exact resume, reconnect/reset/end
  lifecycle, public trace export, status and stop-waiting recovery, theme and
  reduced-motion/forced-colour support, and consent-gated speech-to-editable-text
  input. The metered surface is administrator-only on public poetics binds.
- 2026-07-23: Static accessibility/security/parity tests, focused HTTP tests,
  and a live localhost desktop/mobile layout check pass without starting a paid
  tutor session.
- 2026-07-23: PR #159 merged the shared surface to `main`. Final acceptance
  passed the 6,477-test hermetic suite, 29 Electron-ABI tests, a signed packaged
  app smoke (10/10), and a live fake-provider browser flow covering
  start/reply/reset/end, learner-safe lab gating, text fallback, and clean
  shutdown with no browser warnings.
- 2026-07-23: Live consent-revocation testing found and fixed one post-merge UI
  defect: unchecking consent now disables the permission-triggering voice
  control while leaving text input available. The regression test passes; this
  card remains in review until that small follow-up commit is merged.
