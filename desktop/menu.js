// desktop/menu.js
//
// Pure application-menu template builder (no electron import). main passes the
// returned template to Menu.buildFromTemplate.
//
// The native "Go" menu mirrors the SAME nav source as the in-page rail: main
// fetches /_nav.html (railHtml's bare mode, generated from the NAV array in
// scripts/browse-poetics-scripts.js), parses it with parseNavHtml() here, and
// passes the result as `navItems`. One definition (NAV) → both the web rail and
// the desktop menu bar, kept in sync with no duplicate list.

function titleCase(s) {
  return String(s)
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Parse the shared rail markup (/_nav.html) into [{ route, label }]. */
export function parseNavHtml(html) {
  const items = [];
  const seen = new Set();
  const re = /<a\b[^>]*href="(\/[^"#?]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(String(html)))) {
    const route = m[1];
    if (route.startsWith('/api') || route.startsWith('/_') || route.startsWith('/components')) continue;
    const label = m[2]
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!label || seen.has(route)) continue;
    seen.add(route);
    items.push({ route, label });
  }
  return items;
}

export function buildMenuTemplate({
  actions = {},
  platform = process.platform,
  appName = 'Scriptorium',
  navItems = [],
} = {}) {
  const isMac = platform === 'darwin';

  const customItems = [];
  if (actions.openDataFolder) customItems.push({ label: 'Open Data Folder', click: actions.openDataFolder });
  if (actions.setupKeys) customItems.push({ label: 'Set Up API Keys…', click: actions.setupKeys });
  if (actions.clearKeys) customItems.push({ label: 'Clear Stored API Keys', click: actions.clearKeys });

  const template = [];

  if (isMac) {
    template.push({
      label: appName,
      submenu: [
        { role: 'about' },
        ...(customItems.length ? [{ type: 'separator' }, ...customItems] : []),
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  template.push({
    label: 'File',
    submenu: [
      ...customItems,
      ...(customItems.length ? [{ type: 'separator' }] : []),
      isMac ? { role: 'close' } : { role: 'quit' },
    ],
  });

  template.push({
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ],
  });

  const viewSubmenu = [];
  if (actions.goHome) {
    viewSubmenu.push({ label: 'Home', accelerator: 'CmdOrCtrl+Shift+H', click: actions.goHome }, { type: 'separator' });
  }
  viewSubmenu.push(
    { role: 'reload' },
    { role: 'forceReload' },
    { role: 'toggleDevTools' },
    { type: 'separator' },
    { role: 'resetZoom' },
    { role: 'zoomIn' },
    { role: 'zoomOut' },
    { type: 'separator' },
    { role: 'togglefullscreen' },
  );
  template.push({ label: 'View', submenu: viewSubmenu });

  // "Go" — navigate the window to any rail destination (mirrors the web nav).
  if (Array.isArray(navItems) && navItems.length && actions.navigate) {
    template.push({
      label: 'Go',
      submenu: navItems.map((it, i) => ({
        label: titleCase(it.label),
        // Board gets a dedicated, position-independent shortcut; the rest take ⌘1–⌘9.
        accelerator: it.route === '/board' ? 'CmdOrCtrl+B' : i < 9 ? `CmdOrCtrl+${i + 1}` : undefined,
        click: () => actions.navigate(it.route),
      })),
    });
  }

  template.push({
    label: 'Window',
    submenu: isMac
      ? [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }]
      : [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }],
  });

  return template;
}
