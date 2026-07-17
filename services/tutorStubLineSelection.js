import { moveCursor } from 'node:readline';

function previousCharacterIndex(text, index) {
  let next = Math.max(0, Math.min(text.length, index)) - 1;
  if (next > 0 && /[\uDC00-\uDFFF]/u.test(text[next]) && /[\uD800-\uDBFF]/u.test(text[next - 1])) next -= 1;
  return Math.max(0, next);
}

function nextCharacterIndex(text, index) {
  const start = Math.max(0, Math.min(text.length, index));
  if (start >= text.length) return text.length;
  return start + (/[\uD800-\uDBFF]/u.test(text[start]) && /[\uDC00-\uDFFF]/u.test(text[start + 1]) ? 2 : 1);
}

function characterClass(character) {
  if (/\s/u.test(character)) return 'space';
  if (/^[\p{L}\p{N}_]$/u.test(character)) return 'word';
  return 'punctuation';
}

export function tutorStubWordBoundaryLeft(text, cursor) {
  let index = Math.max(0, Math.min(text.length, cursor));
  while (index > 0) {
    const previous = previousCharacterIndex(text, index);
    if (characterClass(text.slice(previous, index)) !== 'space') break;
    index = previous;
  }
  if (index <= 0) return 0;
  const previous = previousCharacterIndex(text, index);
  const targetClass = characterClass(text.slice(previous, index));
  while (index > 0) {
    const candidate = previousCharacterIndex(text, index);
    if (characterClass(text.slice(candidate, index)) !== targetClass) break;
    index = candidate;
  }
  return index;
}

export function tutorStubWordBoundaryRight(text, cursor) {
  let index = Math.max(0, Math.min(text.length, cursor));
  while (index < text.length) {
    const next = nextCharacterIndex(text, index);
    if (characterClass(text.slice(index, next)) !== 'space') break;
    index = next;
  }
  if (index >= text.length) return text.length;
  const next = nextCharacterIndex(text, index);
  const targetClass = characterClass(text.slice(index, next));
  while (index < text.length) {
    const candidate = nextCharacterIndex(text, index);
    if (characterClass(text.slice(index, candidate)) !== targetClass) break;
    index = candidate;
  }
  return index;
}

function printableInput(character, key = {}) {
  if (typeof character !== 'string' || !character || key.ctrl || key.meta) return false;
  return !new Set(['backspace', 'delete', 'enter', 'return', 'tab', 'escape']).has(key.name);
}

export function createTutorStubLineSelection({ rl, output }) {
  let anchor = null;
  let focus = null;
  let priorLine = String(rl?.line || '');
  let priorCursor = Number(rl?.cursor || 0);

  function range() {
    if (anchor === null || focus === null || anchor === focus) return null;
    return [Math.min(anchor, focus), Math.max(anchor, focus)];
  }

  function sync() {
    priorLine = String(rl?.line || '');
    priorCursor = Number(rl?.cursor || 0);
  }

  function clear({ refresh = false } = {}) {
    const hadSelection = Boolean(range());
    anchor = null;
    focus = null;
    if (refresh && hadSelection) refreshLine();
    sync();
    return hadSelection;
  }

  function decorateLine() {
    const selectedRange = range();
    if (!selectedRange || !output?.isTTY || typeof rl?.getCursorPos !== 'function') return false;
    const [start, end] = selectedRange;
    const selectedText = String(rl.line || '').slice(start, end);
    if (!selectedText) return false;
    const currentCursor = Number(rl.cursor || 0);
    const currentPosition = rl.getCursorPos();
    rl.cursor = start;
    const startPosition = rl.getCursorPos();
    rl.cursor = currentCursor;
    output.write('\x1b7');
    moveCursor(output, startPosition.cols - currentPosition.cols, startPosition.rows - currentPosition.rows);
    output.write(`\x1b[7m${selectedText}\x1b[27m`);
    output.write('\x1b8');
    return true;
  }

  function refreshLine() {
    if (typeof rl?._refreshLine === 'function') rl._refreshLine();
    else if (typeof rl?.prompt === 'function') rl.prompt(true);
    decorateLine();
  }

  function replaceSelection(text) {
    const selectedRange = range();
    if (!selectedRange) return false;
    const [start, end] = selectedRange;
    const insertion = String(text || '');
    rl.line = `${priorLine.slice(0, start)}${insertion}${priorLine.slice(end)}`;
    rl.cursor = start + insertion.length;
    anchor = null;
    focus = null;
    refreshLine();
    sync();
    return true;
  }

  function movementTarget(line, cursor, key = {}) {
    if (key.name === 'home') return 0;
    if (key.name === 'end') return line.length;
    if (key.name === 'left') {
      return key.meta || key.ctrl ? tutorStubWordBoundaryLeft(line, cursor) : previousCharacterIndex(line, cursor);
    }
    if (key.name === 'right') {
      return key.meta || key.ctrl ? tutorStubWordBoundaryRight(line, cursor) : nextCharacterIndex(line, cursor);
    }
    return cursor;
  }

  function handleKeypress(character, key = {}) {
    if (!rl) return false;
    const beforeLine = priorLine;
    const beforeCursor = priorCursor;
    const movementKey = ['left', 'right', 'home', 'end'].includes(key.name);
    const selectionMove = Boolean(key.shift && movementKey);
    const wordMove = Boolean((key.meta || key.ctrl) && ['left', 'right'].includes(key.name));
    const selectedRange = range();

    if (selectionMove) {
      const target = movementTarget(beforeLine, beforeCursor, key);
      rl.line = beforeLine;
      rl.cursor = target;
      if (anchor === null) anchor = beforeCursor;
      focus = target;
      refreshLine();
      sync();
      return true;
    }

    if (selectedRange && movementKey) {
      const [start, end] = selectedRange;
      rl.line = beforeLine;
      rl.cursor = key.name === 'left' || key.name === 'home' ? start : end;
      clear();
      refreshLine();
      sync();
      return true;
    }

    if (wordMove) {
      rl.line = beforeLine;
      rl.cursor = movementTarget(beforeLine, beforeCursor, key);
      clear();
      refreshLine();
      sync();
      return true;
    }

    if (selectedRange && ['backspace', 'delete'].includes(key.name)) return replaceSelection('');
    if (selectedRange && printableInput(character, key)) return replaceSelection(character);

    if (key.name === 'escape' || movementKey || key.name === 'tab' || key.ctrl || key.meta) clear();
    else if (anchor !== null && anchor === focus) clear();
    sync();
    return false;
  }

  return {
    handleKeypress,
    decorateLine,
    clear,
    sync,
    snapshot() {
      const selectedRange = range();
      return {
        active: Boolean(selectedRange),
        anchor,
        focus,
        range: selectedRange,
        text: selectedRange ? String(rl?.line || '').slice(...selectedRange) : '',
      };
    },
  };
}
