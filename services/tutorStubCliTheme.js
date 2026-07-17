const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

export const TUTOR_STUB_CLI_THEME_IDS = ['nocturne', 'ember', 'parchment', 'high_contrast', 'mono'];
export const TUTOR_STUB_CLI_MOTION_IDS = ['auto', 'full', 'subtle', 'off'];

const THEMES = {
  nocturne: {
    label: 'Nocturne',
    description: 'Violet, cyan, and warm gold for dark terminals',
    colors: {
      accent: [183, 148, 246],
      accent2: [91, 205, 255],
      tutor: [203, 166, 247],
      learner: [107, 224, 166],
      coach: [255, 202, 112],
      success: [107, 224, 166],
      warning: [255, 202, 112],
      danger: [255, 109, 136],
      muted: [145, 148, 166],
      border: [104, 106, 126],
    },
    ansi: {
      accent: 95,
      accent2: 96,
      tutor: 95,
      learner: 92,
      coach: 93,
      success: 92,
      warning: 93,
      danger: 91,
      muted: 90,
      border: 90,
    },
  },
  ember: {
    label: 'Ember',
    description: 'Coral, amber, and rose with a theatrical warmth',
    colors: {
      accent: [255, 132, 94],
      accent2: [255, 191, 105],
      tutor: [255, 125, 138],
      learner: [126, 218, 159],
      coach: [255, 198, 109],
      success: [126, 218, 159],
      warning: [255, 198, 109],
      danger: [255, 91, 106],
      muted: [170, 145, 141],
      border: [137, 103, 99],
    },
    ansi: {
      accent: 91,
      accent2: 93,
      tutor: 91,
      learner: 92,
      coach: 93,
      success: 92,
      warning: 93,
      danger: 91,
      muted: 90,
      border: 90,
    },
  },
  parchment: {
    label: 'Parchment',
    description: 'Ink blue, sepia, and forest green for light terminals',
    colors: {
      accent: [69, 93, 143],
      accent2: [28, 121, 135],
      tutor: [98, 67, 144],
      learner: [35, 124, 83],
      coach: [158, 91, 34],
      success: [35, 124, 83],
      warning: [158, 91, 34],
      danger: [176, 48, 65],
      muted: [105, 98, 88],
      border: [139, 126, 107],
    },
    ansi: {
      accent: 34,
      accent2: 36,
      tutor: 35,
      learner: 32,
      coach: 33,
      success: 32,
      warning: 33,
      danger: 31,
      muted: 90,
      border: 90,
    },
  },
  high_contrast: {
    label: 'High Contrast',
    description: 'Bright ANSI colors with maximum terminal compatibility',
    colors: {},
    ansi: {
      accent: 96,
      accent2: 94,
      tutor: 95,
      learner: 92,
      coach: 93,
      success: 92,
      warning: 93,
      danger: 91,
      muted: 37,
      border: 97,
    },
  },
  mono: {
    label: 'Monochrome',
    description: 'Quiet typography without semantic color',
    colors: {},
    ansi: {},
  },
};

const THEME_ALIASES = new Map([
  ['default', 'nocturne'],
  ['night', 'nocturne'],
  ['dark', 'nocturne'],
  ['warm', 'ember'],
  ['light', 'parchment'],
  ['contrast', 'high_contrast'],
  ['high-contrast', 'high_contrast'],
  ['highcontrast', 'high_contrast'],
  ['monochrome', 'mono'],
  ['none', 'mono'],
]);

function normalizedWord(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/gu, '_');
}

export function normalizeTutorStubCliThemeId(value, { fallback = 'nocturne', strict = false } = {}) {
  const normalized = normalizedWord(value || fallback);
  const resolved = THEME_ALIASES.get(normalized) || normalized;
  if (TUTOR_STUB_CLI_THEME_IDS.includes(resolved)) return resolved;
  if (strict) {
    throw new Error(`theme must be one of: ${TUTOR_STUB_CLI_THEME_IDS.join(', ')}`);
  }
  return normalizeTutorStubCliThemeId(fallback, { fallback: 'nocturne', strict: true });
}

export function normalizeTutorStubCliMotion(value, { fallback = 'auto', strict = false } = {}) {
  const normalized = normalizedWord(value || fallback);
  if (TUTOR_STUB_CLI_MOTION_IDS.includes(normalized)) return normalized;
  if (strict) {
    throw new Error(`motion must be one of: ${TUTOR_STUB_CLI_MOTION_IDS.join(', ')}`);
  }
  return normalizeTutorStubCliMotion(fallback, { fallback: 'auto', strict: true });
}

function truthyEnvironmentValue(value) {
  if (value === undefined || value === null) return false;
  return !['', '0', 'false', 'no', 'off'].includes(String(value).trim().toLowerCase());
}

function colorModeFor({ output, env, noColor }) {
  const tty = Boolean(output?.isTTY);
  const term = String(env?.TERM || '').toLowerCase();
  const colorDisabled =
    noColor ||
    Object.prototype.hasOwnProperty.call(env || {}, 'NO_COLOR') ||
    String(env?.FORCE_COLOR || '') === '0' ||
    !tty ||
    term === 'dumb';
  if (colorDisabled) return 'none';
  if (term === 'linux' || term === 'vt100') return 'ansi16';
  return 'truecolor';
}

function resolvedMotionFor({ requested, output, env }) {
  const normalized = normalizeTutorStubCliMotion(requested);
  if (normalized !== 'auto') return normalized;
  const reducedMotion =
    truthyEnvironmentValue(env?.NO_MOTION) ||
    truthyEnvironmentValue(env?.REDUCE_MOTION) ||
    String(env?.TERM || '').toLowerCase() === 'dumb';
  if (!output?.isTTY || truthyEnvironmentValue(env?.CI) || reducedMotion) return 'off';
  return 'subtle';
}

function truecolor(rgb) {
  return `\x1b[38;2;${rgb.join(';')}m`;
}

function ansi(code) {
  return `\x1b[${code}m`;
}

function colorToken(theme, name, colorMode) {
  if (colorMode === 'none') return '';
  if (theme === THEMES.mono) return name === 'muted' ? DIM : BOLD;
  if (colorMode === 'truecolor' && theme.colors[name]) return truecolor(theme.colors[name]);
  return ansi(theme.ansi[name] || 37);
}

function colorAliases(theme, colorMode) {
  const semantic = Object.fromEntries(
    ['accent', 'accent2', 'tutor', 'learner', 'coach', 'success', 'warning', 'danger', 'muted', 'border'].map(
      (name) => [name, colorToken(theme, name, colorMode)],
    ),
  );
  const enabled = colorMode !== 'none';
  return {
    reset: enabled ? RESET : '',
    dim: enabled ? DIM : '',
    bold: enabled ? BOLD : '',
    blue: semantic.accent2,
    red: semantic.danger,
    cyan: semantic.accent2,
    magenta: semantic.tutor,
    yellow: semantic.warning,
    green: semantic.learner,
    brightBlue: semantic.accent2,
    brightCyan: semantic.accent2,
    brightMagenta: semantic.tutor,
    brightYellow: semantic.coach,
    brightGreen: semantic.learner,
    ...semantic,
  };
}

export function createTutorStubCliPresentation({
  theme = 'nocturne',
  motion = 'auto',
  output = process.stdout,
  env = process.env,
  noColor = false,
} = {}) {
  const themeId = normalizeTutorStubCliThemeId(theme);
  const themeDefinition = THEMES[themeId];
  const colorMode = colorModeFor({ output, env, noColor });
  const requestedMotion = normalizeTutorStubCliMotion(motion);
  const resolvedMotion = resolvedMotionFor({ requested: requestedMotion, output, env });
  return {
    themeId,
    themeLabel: themeDefinition.label,
    themeDescription: themeDefinition.description,
    requestedMotion,
    motion: resolvedMotion,
    colorMode,
    interactive: Boolean(output?.isTTY),
    colors: colorAliases(themeDefinition, colorMode),
  };
}

export function tutorStubCliPresentationSnapshot(presentation) {
  return {
    theme: presentation.themeId,
    themeLabel: presentation.themeLabel,
    motion: presentation.requestedMotion,
    resolvedMotion: presentation.motion,
    colorMode: presentation.colorMode,
  };
}

export function tutorStubCliThemeOptions() {
  return TUTOR_STUB_CLI_THEME_IDS.map((id) => ({
    id,
    label: THEMES[id].label,
    description: THEMES[id].description,
  }));
}

export function tutorStubCliSpinnerFrames(presentation) {
  if (presentation.motion === 'full') return ['◐', '◓', '◑', '◒'];
  if (presentation.motion === 'subtle') return ['◆', '◇'];
  return ['·'];
}

export function tutorStubCliMotionInterval(presentation) {
  if (presentation.motion === 'full') return 220;
  if (presentation.motion === 'subtle') return 650;
  return 0;
}

export function stripTutorStubCliAnsi(value) {
  return String(value || '').replace(new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, 'gu'), '');
}

function truncateText(value, width) {
  const text = String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (text.length <= width) return text;
  if (width <= 1) return text.slice(0, width);
  return `${text.slice(0, Math.max(0, width - 1)).trimEnd()}…`;
}

export function tutorStubCliMasthead(
  { eyebrow = 'MACHINE SPIRITS', title = 'Live inquiry', subtitle = '', width = 64 } = {},
  presentation,
) {
  const colors = presentation.colors;
  const outerWidth = Math.max(40, Math.min(88, Number(width) || 64));
  const innerWidth = outerWidth - 4;
  const line = (text, color = '') => {
    const content = truncateText(text, innerWidth);
    const padding = ' '.repeat(Math.max(0, innerWidth - content.length));
    return `${colors.border}│${colors.reset} ${color}${content}${colors.reset}${padding} ${colors.border}│${colors.reset}`;
  };
  const top = `${colors.border}╭${'─'.repeat(outerWidth - 2)}╮${colors.reset}`;
  const bottom = `${colors.border}╰${'─'.repeat(outerWidth - 2)}╯${colors.reset}`;
  const rows = [top, line(eyebrow, `${colors.accent}${colors.bold}`), line(title, `${colors.tutor}${colors.bold}`)];
  if (subtitle) rows.push(line(subtitle, colors.muted));
  rows.push(bottom);
  return rows.join('\n');
}

export function tutorStubCliThemePreview(presentation) {
  const colors = presentation.colors;
  return [
    `${colors.tutor}${colors.bold}tutor${colors.reset}`,
    `${colors.learner}${colors.bold}learner${colors.reset}`,
    `${colors.coach}${colors.bold}coach${colors.reset}`,
    `${colors.success}helpful${colors.reset}`,
    `${colors.danger}not helpful${colors.reset}`,
  ].join(`${colors.muted} · ${colors.reset}`);
}
