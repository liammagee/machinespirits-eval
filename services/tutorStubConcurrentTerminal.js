import { clearLine, cursorTo, moveCursor } from 'node:readline';

export function createTutorStubConcurrentTerminal({ rl, output }) {
  const enabled = Boolean(rl && output?.isTTY);
  let closed = false;
  let surfaceVisible = false;
  let renderedRows = 0;
  let status = '';
  let palette = [];

  function surfaceRows() {
    return [...(status ? [status] : []), ...palette];
  }

  function clearSurface() {
    if (!enabled || !surfaceVisible) return;
    cursorTo(output, 0);
    clearLine(output, 0);
    for (let index = 0; index < renderedRows; index += 1) {
      moveCursor(output, 0, -1);
      cursorTo(output, 0);
      clearLine(output, 0);
    }
    surfaceVisible = false;
    renderedRows = 0;
  }

  function render() {
    if (!enabled || closed) return;
    if (surfaceVisible) clearSurface();
    const rows = surfaceRows();
    if (rows.length) output.write(`${rows.join('\n')}\n`);
    renderedRows = rows.length;
    rl.prompt(true);
    surfaceVisible = true;
  }

  return {
    enabled,
    show: render,
    acceptLine() {
      // Readline has already advanced below the submitted input. The former
      // status/palette rows are now ordinary scrollback and must not be
      // cursor-cleared. A palette belongs to the submitted line, so discard it.
      surfaceVisible = false;
      renderedRows = 0;
      palette = [];
    },
    setStatus(value) {
      status = String(value || '');
      if (surfaceVisible) render();
    },
    clearStatus() {
      status = '';
      if (surfaceVisible) render();
    },
    setPalette(lines) {
      const next = Array.isArray(lines) ? lines.map((line) => String(line)) : [];
      if (next.length === palette.length && next.every((line, index) => line === palette[index])) return;
      palette = next;
      if (surfaceVisible) render();
    },
    clearPalette() {
      if (!palette.length) return;
      palette = [];
      if (surfaceVisible) render();
    },
    print(callback) {
      if (!enabled || closed || !surfaceVisible) return callback();
      clearSurface();
      try {
        return callback();
      } finally {
        render();
      }
    },
    close() {
      clearSurface();
      status = '';
      palette = [];
      closed = true;
    },
    snapshot() {
      return {
        enabled,
        closed,
        surfaceVisible,
        statusVisible: Boolean(status && renderedRows),
        renderedRows,
        status,
        palette: [...palette],
      };
    },
  };
}
