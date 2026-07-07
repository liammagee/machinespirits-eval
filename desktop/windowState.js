// desktop/windowState.js
//
// Persist + restore the main window's bounds. Pure transforms (restoreBounds /
// serializeBounds) are unit-tested; load/save wrap them with fs.

import fs from 'node:fs';

export function restoreBounds(state, defaults) {
  const s = state && typeof state === 'object' ? state : {};
  const out = {
    width: Number.isFinite(s.width) ? s.width : defaults.width,
    height: Number.isFinite(s.height) ? s.height : defaults.height,
  };
  if (Number.isFinite(s.x) && Number.isFinite(s.y)) {
    out.x = s.x;
    out.y = s.y;
  }
  return out;
}

export function serializeBounds(bounds, isMaximized) {
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized: !!isMaximized,
  };
}

export function loadWindowState(file, defaults) {
  try {
    const state = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { bounds: restoreBounds(state, defaults), isMaximized: !!state.isMaximized };
  } catch {
    return { bounds: restoreBounds(null, defaults), isMaximized: false };
  }
}

export function saveWindowState(file, bounds, isMaximized) {
  try {
    fs.writeFileSync(file, JSON.stringify(serializeBounds(bounds, isMaximized)));
  } catch {
    /* best-effort */
  }
}
