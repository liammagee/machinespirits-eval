/*
 * rail-inject.js — give the static tool surfaces the dashboard's nav rail.
 *
 * The poetics dashboard (scripts/browse-poetics-scripts.js) server-renders its
 * rail from railHtml(). The folded-in static surfaces (/chat, /adjudication,
 * /pilot-admin) are plain files served by services/evalSurfaces.js, so they
 * can't call railHtml() — instead they fetch it from the /_nav.html endpoint
 * (railHtml's `bare` mode: rail markup + .rail* CSS, the command palette, but no
 * shader canvas, x-ray overlay, grid/theme toggles, or dashboard display scripts)
 * and prepend it.
 *
 * railHtml() stays the single source of nav truth — there is no second copy of
 * the nav markup or styling here. Each host page satisfies the rail's token
 * contract (the moss shades, --brick, --prussian, --ease) in its own :root so
 * the rail themes correctly without a runtime shim.
 *
 * Usage (before </body>):
 *   <script src="/components/rail-inject.js" data-active="tutor" defer></script>
 *   - data-active : NAV key to highlight (tutor | adjudicate | pilot-admin | ...)
 *   - data-compact: drop the rail's ◐ glyph + MMXXVI stamp (for pages whose own
 *                   chrome already carries a brand mark, e.g. /chat)
 */
(function () {
  // Capture the script's data-* synchronously — document.currentScript is null
  // by the time the fetch().then() callbacks run.
  const script = document.currentScript;
  const active = (script && script.getAttribute('data-active')) || '';
  const compact = !!(script && script.getAttribute('data-compact'));

  // Idempotent: if a rail is already present (double-included tag, or a future
  // server-rendered host), do nothing.
  if (document.querySelector('.rail')) return;

  fetch('/_nav.html?active=' + encodeURIComponent(active))
    .then(function (r) {
      return r.ok ? r.text() : '';
    })
    .then(function (html) {
      if (!html) return;
      const tpl = document.createElement('template');
      tpl.innerHTML = html;
      const frag = tpl.content;
      const rail = frag.querySelector('.rail');
      if (!rail) return;

      // The host page already owns the <header> banner landmark. Recast the
      // injected rail as a labelled navigation landmark so we don't introduce a
      // second banner (the rail is navigation, after all).
      rail.setAttribute('role', 'navigation');
      rail.setAttribute('aria-label', 'Dashboard');

      // Sit in normal document flow at the top rather than fighting the host
      // page's own sticky header for the top:0 slot.
      rail.style.position = 'static';

      // Pages whose own chrome already shows a brand glyph + year stamp don't
      // need the rail's decorative duplicates — keep only the nav.
      if (compact) {
        frag.querySelectorAll('.rail__glyph, .rail__stamp').forEach(function (el) {
          el.remove();
        });
      }

      frag.querySelectorAll('script').forEach(function (scriptEl) {
        scriptEl.setAttribute('data-rail-script', '1');
      });
      document.body.insertBefore(frag, document.body.firstChild);

      // Scripts inserted from a <template> fragment do not execute by default.
      // Recreate the rail-owned executable scripts after insertion; JSON data
      // blocks stay inert and remain readable by the executable initializer.
      document.querySelectorAll('script[data-rail-script]').forEach(function (oldScript) {
        const type = (oldScript.getAttribute('type') || '').toLowerCase();
        if (type && type !== 'text/javascript' && type !== 'application/javascript') return;
        const next = document.createElement('script');
        Array.prototype.slice.call(oldScript.attributes).forEach(function (attr) {
          if (attr.name !== 'data-rail-script') next.setAttribute(attr.name, attr.value);
        });
        next.textContent = oldScript.textContent;
        oldScript.replaceWith(next);
      });
    })
    .catch(function () {});
})();
