// desktop/menu.js
//
// Pure application-menu template builder (no electron import). main passes the
// returned template to Menu.buildFromTemplate. Custom items appear only when a
// handler for them is supplied, so the same builder serves every phase.

export function buildMenuTemplate({ actions = {}, platform = process.platform, appName = 'Machine Spirits' } = {}) {
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

  template.push({
    label: 'Window',
    submenu: isMac
      ? [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }]
      : [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }],
  });

  return template;
}
