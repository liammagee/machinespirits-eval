import { spawnSync } from 'node:child_process';

const CLIPBOARD_TIMEOUT_MS = 1500;

function clipboardCandidates(platform = process.platform, env = process.env) {
  const custom = String(env?.TUTOR_STUB_CLIPBOARD_COMMAND || '').trim();
  if (custom) return [{ command: custom, args: [], method: 'custom' }];
  if (platform === 'darwin') return [{ command: 'pbcopy', args: [], method: 'pbcopy' }];
  if (platform === 'win32') return [{ command: 'clip', args: [], method: 'clip' }];
  return [
    { command: 'wl-copy', args: [], method: 'wl-copy' },
    { command: 'xclip', args: ['-selection', 'clipboard'], method: 'xclip' },
    { command: 'xsel', args: ['--clipboard', '--input'], method: 'xsel' },
  ];
}

export function formatTutorStubDebugClipboardText({
  runId,
  selectedId,
  completedId = null,
  activeId = null,
  tracePath = null,
} = {}) {
  return [
    `debug id > ${selectedId || completedId || activeId || runId || 'no-trace'}`,
    `run id: ${runId || 'no-trace'}`,
    completedId ? `last completed turn: ${completedId}` : null,
    activeId ? `in-progress turn: ${activeId}` : null,
    `trace: ${tracePath || 'disabled for this run; rerun without --no-trace for a local JSONL trace'}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function copyTutorStubTextToClipboard(
  text,
  { platform = process.platform, env = process.env, spawn = spawnSync } = {},
) {
  const source = String(text || '');
  if (!source) return { copied: false, status: 'empty', method: null };
  if (String(env?.TUTOR_STUB_CLIPBOARD || '').trim() === '0') {
    return { copied: false, status: 'disabled', method: null };
  }

  let lastError = null;
  for (const candidate of clipboardCandidates(platform, env)) {
    const result = spawn(candidate.command, candidate.args, {
      input: source,
      encoding: 'utf8',
      timeout: CLIPBOARD_TIMEOUT_MS,
      windowsHide: true,
      stdio: ['pipe', 'ignore', 'ignore'],
    });
    if (!result?.error && result?.status === 0) {
      return { copied: true, status: 'copied', method: candidate.method };
    }
    lastError = result?.error?.message || `exit ${result?.status ?? 'unknown'}`;
  }

  return { copied: false, status: 'unavailable', method: null, error: lastError };
}
