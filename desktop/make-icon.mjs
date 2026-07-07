// desktop/make-icon.mjs
//
// Rasterize desktop/icon.svg → desktop/icon.png (1024×1024) using Electron's
// renderer (so we don't need an external SVG rasterizer). Run via:
//   ./node_modules/.bin/electron desktop/make-icon.mjs
// then build the .icns with sips + iconutil (see desktop/README.md / the commit).

import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const svg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');
const html = `<!doctype html><meta charset="utf8"><body style="margin:0;padding:0">${svg}</body>`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    transparent: true,
    frame: false,
    backgroundColor: '#00000000',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  await win.loadURL('data:text/html,' + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 400)); // let fonts paint
  const img = await win.webContents.capturePage();
  const out = path.join(dir, 'icon.png');
  fs.writeFileSync(out, img.toPNG());
  const { width, height } = img.getSize();
  console.log(`wrote ${out} (${width}x${height})`);
  app.exit(0);
});
