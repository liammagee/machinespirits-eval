// Build control bytes dynamically so the regex source itself remains readable
// to ESLint's no-control-regex rule.
const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);
const ANSI_CONTROL_PATTERN = new RegExp(
  `${ESC}(?:\\[[0-?]*[ -/]*[@-~]|\\][^${BEL}]*(?:${BEL}|${ESC}\\\\)|[@-_])`,
  'gu',
);

function removeUnsafeC0(value) {
  return [...value]
    .filter((character) => {
      const code = character.codePointAt(0);
      return !((code <= 31 && code !== 9 && code !== 10) || code === 127);
    })
    .join('');
}

/**
 * Project terminal-oriented CLI output onto portable plain text for HTTP
 * clients. Newlines and tabs remain meaningful; cursor, colour, OSC, carriage
 * return, and other C0 controls do not cross the transport boundary.
 */
export function stripTutorStubTerminalControl(value) {
  const withoutTerminalSequences = String(value || '')
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '')
    .replace(ANSI_CONTROL_PATTERN, '');
  return removeUnsafeC0(withoutTerminalSequences);
}

export default stripTutorStubTerminalControl;
