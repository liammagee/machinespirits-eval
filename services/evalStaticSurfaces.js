/**
 * The static UI surfaces, as [mountPath, dirRelativeToRoot].
 *
 * Kept in its own module rather than inside evalSurfaces.js so that reading the
 * list costs nothing. evalSurfaces.js pulls in every route module, which opens
 * the DB; tests that only want to know which directories get mounted should not
 * have to boot the server to find out.
 *
 * That matters because the list is a contract, not just a mount table. Each of
 * these directories is a plain file served off disk, so it cannot call
 * railHtml() and has to load the shared skin and nav scripts itself. Both
 * omissions are invisible at runtime — /tutor shipped for months with neither.
 * tests/staticSurfaceSkin.test.js reads this list so a new surface is checked
 * the moment it is mounted, instead of when someone remembers to add it to a
 * second copy.
 */
export const STATIC_SURFACES = [
  ['/tutor', 'public/tutor'], // shared browser + Electron tutor-stub session studio
  ['/pilot', 'public/pilot'], // participant-facing human-learner pilot UI
  ['/pilot-admin', 'public/pilot-admin'], // operator dashboard (token-gated API)
  ['/adjudication', 'public/adjudication'], // A19 blinded human-adjudication forms
  ['/human-coding-admin', 'public/human-coding-admin'], // consolidated human labelling game
  ['/eval', 'public/eval'], // static research explainers and companion notes
  ['/components', 'public/components'], // shared design system (techne.css) + UI components
  ['/docs', 'docs'], // documentation tree (poetics pre-mounts /docs/research)
];
