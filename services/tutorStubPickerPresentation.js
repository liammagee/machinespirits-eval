function pickerColors(colors = {}) {
  return {
    bold: colors.bold || '',
    brightYellow: colors.brightYellow || '',
    cyan: colors.cyan || '',
    dim: colors.dim || '',
    reset: colors.reset || '',
  };
}

function oneLine(value, { max = 220 } = {}) {
  const text = String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

function pickerWidth(columns, maximum) {
  return Math.max(58, Math.min(Number(columns || 100), maximum));
}

function viewportBoundaryLines({ entries, viewportStart, viewportHeight, colors }) {
  return {
    before: `${colors.dim}${viewportStart > 0 ? `  ↑ ${viewportStart} more` : '  '}${colors.reset}`,
    after: `${colors.dim}${
      viewportStart + viewportHeight < entries.length
        ? `  ↓ ${entries.length - viewportStart - viewportHeight} more`
        : '  '
    }${colors.reset}`,
  };
}

export function projectTutorStubScenarioPickerEntries({ groupedEntries = [], defaultBundle = null } = {}) {
  const entries = groupedEntries.map(({ filePath, world, isVariant }) => ({
    id: world.id,
    title: `${isVariant ? '↳ ' : ''}${world.title}`,
    discipline: world.discipline || 'Authored reasoning drama',
    question: world.question,
    description: tutorStubWorldPickerSummary(world) || world.setting || world.learnerVoice || world.question,
    filePath,
    world,
  }));
  if (defaultBundle && !entries.some((entry) => entry.id === defaultBundle.world.id)) {
    entries.unshift({
      id: defaultBundle.world.id,
      title: defaultBundle.world.title,
      discipline: defaultBundle.world.discipline || 'Custom reasoning drama',
      question: defaultBundle.world.question,
      description: defaultBundle.world.setting || defaultBundle.world.learnerVoice || defaultBundle.world.question,
      filePath: defaultBundle.filePath,
      world: defaultBundle.world,
    });
  }
  return entries;
}

export function projectTutorStubCurriculumPickerEntries({ modules = [], entries = [] } = {}) {
  const modulesById = new Map(modules.map((module) => [module.id, module]));
  return entries.map((entry) => ({
    ...entry,
    module: modulesById.get(entry.id) || null,
  }));
}

export function projectTutorStubLaunchModePickerLines({ entries, selectedIndex, columns, colors = {} }) {
  const C = pickerColors(colors);
  const width = pickerWidth(columns, 120);
  const selected = entries[selectedIndex];
  return Object.freeze([
    ...entries.map((entry, index) => {
      const active = index === selectedIndex;
      const plain = `${active ? '›' : ' '} ${entry.label.padEnd(20)} ${oneLine(entry.description, {
        max: Math.max(24, width - 26),
      })}`;
      return active ? `${C.cyan}${C.bold}${plain}${C.reset}` : plain;
    }),
    `${C.brightYellow}${C.bold}  launches >${C.reset} ${selected.label}`,
    `${C.dim}  ↑/↓ move · Enter launch · Esc quit · Mixed tutor chat is the default${C.reset}`,
  ]);
}

export function projectTutorStubScenarioPickerLines({
  entries,
  selectedIndex,
  viewportStart,
  viewportHeight,
  columns,
  colors = {},
}) {
  const C = pickerColors(colors);
  const width = pickerWidth(columns, 150);
  const visible = entries.slice(viewportStart, viewportStart + viewportHeight);
  const selectedEntry = entries[selectedIndex];
  const boundaries = viewportBoundaryLines({ entries, viewportStart, viewportHeight, colors: C });
  return Object.freeze([
    boundaries.before,
    ...visible.map((entry, visibleIndex) => {
      const absoluteIndex = viewportStart + visibleIndex;
      const selected = absoluteIndex === selectedIndex;
      const plain = `${selected ? '›' : ' '} ${entry.id.padEnd(29)} ${oneLine(entry.title, {
        max: Math.max(18, width - 35),
      })}`;
      return selected ? `${C.cyan}${C.bold}${plain}${C.reset}` : plain;
    }),
    boundaries.after,
    `${C.brightYellow}${C.bold}  question >${C.reset} ${oneLine(selectedEntry.question, {
      max: Math.max(36, width - 13),
    })}`,
    `${C.dim}  setting > ${oneLine(selectedEntry.description, { max: Math.max(36, width - 12) })}${C.reset}`,
    `${C.dim}  discipline > ${oneLine(selectedEntry.discipline, { max: Math.max(30, width - 15) })}${C.reset}`,
  ]);
}

export function projectTutorStubCurriculumPickerLines({
  entries,
  selectedIndex,
  viewportStart,
  viewportHeight,
  columns,
  colors = {},
}) {
  const C = pickerColors(colors);
  const width = pickerWidth(columns, 150);
  const visible = entries.slice(viewportStart, viewportStart + viewportHeight);
  const selectedEntry = entries[selectedIndex];
  const stateLabel = [selectedEntry.priority, selectedEntry.status, selectedEntry.owner].filter(Boolean).join(' · ');
  const verification = selectedEntry.module?.workplan_binding?.declared_completion_verification || '';
  const boundaries = viewportBoundaryLines({ entries, viewportStart, viewportHeight, colors: C });
  return Object.freeze(
    [
      boundaries.before,
      ...visible.map((entry, visibleIndex) => {
        const absoluteIndex = viewportStart + visibleIndex;
        const selected = absoluteIndex === selectedIndex;
        const plain = `${selected ? '›' : ' '} ${entry.id.padEnd(38)} ${oneLine(entry.title, {
          max: Math.max(18, width - 44),
        })}`;
        return selected ? `${C.cyan}${C.bold}${plain}${C.reset}` : plain;
      }),
      boundaries.after,
      `${C.brightYellow}${C.bold}  inquiry >${C.reset} ${oneLine(selectedEntry.essentialQuestion, {
        max: Math.max(36, width - 12),
      })}`,
      `${C.dim}  state > ${stateLabel || 'open'}${C.reset}`,
      verification
        ? `${C.dim}  verifies > ${oneLine(verification, { max: Math.max(34, width - 14) })}${C.reset}`
        : null,
    ].filter(Boolean),
  );
}
import { tutorStubWorldPickerSummary } from './tutorStubWorldPresentation.js';
