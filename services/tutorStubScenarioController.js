import fs from 'node:fs';
import path from 'node:path';
import { clearLine, cursorTo, emitKeypressEvents, moveCursor } from 'node:readline';

import { listTutorStubCurriculumModules, loadTutorStubCurriculum } from './curriculum/tutorStubCurriculum.js';
import { projectTutorStubCurriculumCatalogLines } from './curriculum/tutorStubCurriculumCatalogPresentation.js';
import { loadWorld } from './dramaticDerivation/world.js';
import { TUTOR_STUB_LAUNCH_MODES, normalizeTutorStubLaunchMode } from './tutorStubLaunchMode.js';
import {
  projectTutorStubCurriculumPickerEntries,
  projectTutorStubCurriculumPickerLines,
  projectTutorStubLaunchModePickerLines,
  projectTutorStubScenarioPickerEntries,
  projectTutorStubScenarioPickerLines,
} from './tutorStubPickerPresentation.js';
import { groupTutorStubWorldEntries, projectTutorStubWorldCatalogLines } from './tutorStubWorldPresentation.js';

export function createTutorStubScenarioController({
  root,
  worldDir,
  input = process.stdin,
  output = process.stdout,
  colors = {},
  argv = process.argv.slice(2),
  learnerProfileListText,
}) {
  function worldFiles() {
    return fs
      .readdirSync(worldDir)
      .filter((file) => /^world-.*\.yaml$/.test(file))
      .sort((a, b) => a.localeCompare(b))
      .map((file) => path.join(worldDir, file));
  }

  function loadWorldSummaries() {
    return worldFiles().map((filePath) => ({ filePath, world: loadWorld(filePath) }));
  }

  function selectableWorldSummaries() {
    return loadWorldSummaries().filter(({ world }) => world.eligibility?.status === 'production');
  }

  function groupedWorldEntries() {
    return groupTutorStubWorldEntries(selectableWorldSummaries());
  }

  function printWorlds() {
    for (const line of projectTutorStubWorldCatalogLines(groupedWorldEntries(), { root })) console.log(line);
  }

  function printCurriculumModules(ref) {
    const bundle = loadTutorStubCurriculum(ref, { root });
    for (const line of projectTutorStubCurriculumCatalogLines(bundle, listTutorStubCurriculumModules(bundle))) {
      console.log(line);
    }
  }

  function printAutomatedLearnerProfiles() {
    console.log(learnerProfileListText());
  }

  function defaultLaunchModePickerAvailable() {
    return Boolean(argv.length === 0 && input.isTTY && output.isTTY && typeof input.setRawMode === 'function');
  }

  function clearRenderedMenu(lineCount) {
    if (!lineCount) return;
    moveCursor(output, 0, -lineCount);
    for (let index = 0; index < lineCount; index += 1) {
      cursorTo(output, 0);
      clearLine(output, 0);
      if (index < lineCount - 1) moveCursor(output, 0, 1);
    }
    if (lineCount > 1) moveCursor(output, 0, -(lineCount - 1));
  }

  async function pickTutorStubLaunchModeWithKeyboard(defaultMode = 'chat') {
    const defaultId = normalizeTutorStubLaunchMode(defaultMode);
    let selectedIndex = Math.max(
      0,
      TUTOR_STUB_LAUNCH_MODES.findIndex((entry) => entry.id === defaultId),
    );
    let renderedLineCount = 0;
    const renderMenu = () => {
      clearRenderedMenu(renderedLineCount);
      const lines = projectTutorStubLaunchModePickerLines({
        entries: TUTOR_STUB_LAUNCH_MODES,
        selectedIndex,
        columns: output.columns,
        colors,
      });
      for (const line of lines) output.write(`${line}\n`);
      renderedLineCount = lines.length;
    };

    const wasRaw = Boolean(input.isRaw);
    if (!wasRaw) input.setRawMode(true);

    return new Promise((resolve) => {
      let finished = false;
      const finish = (selection) => {
        if (finished) return;
        finished = true;
        input.removeListener('data', onData);
        if (!wasRaw) input.setRawMode(false);
        clearRenderedMenu(renderedLineCount);
        resolve(selection);
      };
      const moveSelection = (delta) => {
        selectedIndex = (selectedIndex + delta + TUTOR_STUB_LAUNCH_MODES.length) % TUTOR_STUB_LAUNCH_MODES.length;
        renderMenu();
      };
      const onData = (chunk) => {
        const characters = String(chunk || '');
        for (let index = 0; index < characters.length; index += 1) {
          const character = characters[index];
          if (character === '\u0003') return finish(null);
          if (character === '\u001b') {
            const arrowPrefix = characters[index + 1];
            const arrowDirection = characters[index + 2];
            if ((arrowPrefix === '[' || arrowPrefix === 'O') && ['A', 'B'].includes(arrowDirection)) {
              moveSelection(arrowDirection === 'A' ? -1 : 1);
              index += 2;
              continue;
            }
            return finish(null);
          }
          if (character === 'k') moveSelection(-1);
          else if (character === 'j') moveSelection(1);
          else if (character === '1') {
            selectedIndex = 0;
            renderMenu();
          } else if (character === '2') {
            selectedIndex = 1;
            renderMenu();
          } else if (character === '\r' || character === '\n') {
            return finish(TUTOR_STUB_LAUNCH_MODES[selectedIndex]);
          }
        }
        return undefined;
      };
      input.on('data', onData);
      input.resume();
      renderMenu();
    });
  }

  function resolveWorldRef(ref) {
    if (!ref || ref === 'none' || ref === 'off' || ref === 'false') return null;

    const directPath = path.resolve(root, ref);
    if (fs.existsSync(directPath)) return { filePath: directPath, world: loadWorld(directPath) };

    const byFileName = path.join(worldDir, ref.endsWith('.yaml') ? ref : `${ref}.yaml`);
    if (fs.existsSync(byFileName)) return { filePath: byFileName, world: loadWorld(byFileName) };

    const needle = ref.toLowerCase();
    const matches = loadWorldSummaries().filter(({ filePath, world }) => {
      const stem = path.basename(filePath, '.yaml').toLowerCase();
      return (
        world.id.toLowerCase() === needle ||
        stem === needle ||
        stem.startsWith(`world-${needle}-`) ||
        stem.endsWith(`-${needle}`) ||
        world.title.toLowerCase().includes(needle)
      );
    });
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      throw new Error(`Ambiguous --world "${ref}". Matches: ${matches.map((match) => match.world.id).join(', ')}`);
    }
    throw new Error(`Unknown --world "${ref}". Use --list-worlds to see available IDs.`);
  }

  function pickScrollableEntryWithKeyboard({ entries, selectedIndex, renderLines }) {
    if (!entries.length) return Promise.resolve(null);
    const viewportHeight = Math.min(
      entries.length,
      Math.max(4, Math.min(8, Math.max(4, Number(output.rows || 24) - 9))),
    );
    let viewportStart = Math.max(0, Math.min(selectedIndex, entries.length - viewportHeight));
    let renderedLineCount = 0;

    const keepSelectionVisible = () => {
      if (selectedIndex < viewportStart) viewportStart = selectedIndex;
      if (selectedIndex >= viewportStart + viewportHeight) viewportStart = selectedIndex - viewportHeight + 1;
    };
    const renderMenu = () => {
      keepSelectionVisible();
      clearRenderedMenu(renderedLineCount);
      const lines = renderLines({ selectedIndex, viewportStart, viewportHeight });
      for (const line of lines) output.write(`${line}\n`);
      renderedLineCount = lines.length;
    };

    emitKeypressEvents(input);
    const priorKeypressListeners = input.listeners('keypress');
    for (const listener of priorKeypressListeners) input.removeListener('keypress', listener);
    const wasRaw = Boolean(input.isRaw);
    if (!wasRaw) input.setRawMode(true);

    return new Promise((resolve) => {
      const finish = (selection) => {
        input.removeListener('keypress', onKeypress);
        for (const listener of priorKeypressListeners) input.on('keypress', listener);
        if (!wasRaw) input.setRawMode(false);
        clearRenderedMenu(renderedLineCount);
        resolve(selection);
      };
      const moveSelection = (delta) => {
        selectedIndex = (selectedIndex + delta + entries.length) % entries.length;
        renderMenu();
      };
      const onKeypress = (character, key = {}) => {
        if ((key.ctrl && key.name === 'c') || key.name === 'escape') return finish(null);
        if (key.name === 'up' || character === 'k') return moveSelection(-1);
        if (key.name === 'down' || character === 'j') return moveSelection(1);
        if (key.name === 'pageup') return moveSelection(-viewportHeight);
        if (key.name === 'pagedown') return moveSelection(viewportHeight);
        if (key.name === 'home') {
          selectedIndex = 0;
          return renderMenu();
        }
        if (key.name === 'end') {
          selectedIndex = entries.length - 1;
          return renderMenu();
        }
        if (key.name === 'return' || key.name === 'enter') return finish(entries[selectedIndex]);
        return undefined;
      };
      input.on('keypress', onKeypress);
      input.resume();
      renderMenu();
    });
  }

  function pickInitialScenarioWithKeyboard(defaultWorldRef) {
    const defaultBundle = resolveWorldRef(defaultWorldRef);
    const entries = projectTutorStubScenarioPickerEntries({ groupedEntries: groupedWorldEntries(), defaultBundle });
    return pickScrollableEntryWithKeyboard({
      entries,
      selectedIndex: Math.max(
        0,
        entries.findIndex((entry) => entry.id === defaultBundle?.world?.id),
      ),
      renderLines: ({ selectedIndex, viewportStart, viewportHeight }) =>
        projectTutorStubScenarioPickerLines({
          entries,
          selectedIndex,
          viewportStart,
          viewportHeight,
          columns: output.columns,
          colors,
        }),
    });
  }

  function pickWorkplanModuleWithKeyboard(defaultModuleRef = '') {
    const bundle = loadTutorStubCurriculum('workplan', { root });
    const entries = projectTutorStubCurriculumPickerEntries({
      modules: bundle.curriculum.modules || [],
      entries: listTutorStubCurriculumModules(bundle),
    });
    return pickScrollableEntryWithKeyboard({
      entries,
      selectedIndex: Math.max(
        0,
        entries.findIndex((entry) => entry.id === defaultModuleRef),
      ),
      renderLines: ({ selectedIndex, viewportStart, viewportHeight }) =>
        projectTutorStubCurriculumPickerLines({
          entries,
          selectedIndex,
          viewportStart,
          viewportHeight,
          columns: output.columns,
          colors,
        }),
    });
  }

  return {
    defaultLaunchModePickerAvailable,
    groupedWorldEntries,
    pickInitialScenarioWithKeyboard,
    pickTutorStubLaunchModeWithKeyboard,
    pickWorkplanModuleWithKeyboard,
    printAutomatedLearnerProfiles,
    printCurriculumModules,
    printWorlds,
    resolveWorldRef,
  };
}
