export const TUTOR_STUB_LAUNCH_MODES = Object.freeze([
  {
    id: 'chat',
    label: 'Mixed tutor chat',
    description: 'Open the default human + AI learner-drafting conversation.',
  },
  {
    id: 'labelling-game',
    label: 'Labelling game',
    description: 'Human-label the superego taxonomy or tutor-stub impasse corpus.',
  },
]);

const TUTOR_STUB_LAUNCH_MODE_ALIASES = new Map([
  ['chat', 'chat'],
  ['default', 'chat'],
  ['tutor', 'chat'],
  ['tutor-chat', 'chat'],
  ['labelling', 'labelling-game'],
  ['labeling', 'labelling-game'],
  ['labelling-game', 'labelling-game'],
  ['labeling-game', 'labelling-game'],
]);

export function normalizeTutorStubLaunchMode(value, { allowEmpty = false } = {}) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/gu, '-');
  if (!normalized && allowEmpty) return '';
  const resolved = TUTOR_STUB_LAUNCH_MODE_ALIASES.get(normalized);
  if (!resolved) {
    throw new Error(`unknown --launch-mode "${value}"; use chat or labelling-game`);
  }
  return resolved;
}
