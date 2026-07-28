/*
 * skin-early-apply.js — put the persisted skin + theme on <html> before paint.
 *
 * The server-rendered dashboard pages inline this same logic in their <head>
 * (scripts/browse-poetics-scripts.js, railHtml). The static surfaces served
 * straight off disk by services/evalSurfaces.js cannot call railHtml(), so they
 * load this file instead.
 *
 * Load it SYNCHRONOUSLY in <head>, before the stylesheets:
 *
 *   <script src="/components/skin-early-apply.js"></script>
 *
 * Not `defer`. A deferred script runs after the document parses, so the page
 * paints parchment and then snaps to stark. Running here costs one small
 * blocking request and shows the chosen skin on the first frame.
 *
 * Skin defaults to stark when it was never set, which is what the rail does.
 * Pages still need the matching :root[data-skin="stark"] tokens, either their
 * own or the ones in components/techne.css — this only sets the attribute those
 * blocks key off.
 */
(function () {
  try {
    const de = document.documentElement;
    if (localStorage.getItem('poetics-theme') === 'dark') de.setAttribute('data-theme', 'dark');
    let sk = localStorage.getItem('poetics-skin');
    if (sk === null) sk = 'stark';
    if (sk === 'stark') de.setAttribute('data-skin', 'stark');
  } catch (_e) {
    /* localStorage blocked — leave the page on its own defaults */
  }
})();
