import {
  MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
  MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
} from './tutorStubRegisterTemperature.js';
import { MAX_TUTOR_STUB_RELEASE_SPEED, MIN_TUTOR_STUB_RELEASE_SPEED } from './tutorStubReleasePacing.js';
import { MAX_TUTOR_STUB_MODEL_CALL_BUDGET } from './tutorStubLabs.js';
import { TUTOR_STUB_CLI_MOTION_IDS, TUTOR_STUB_CLI_THEME_IDS } from './tutorStubCliTheme.js';
import { TUTOR_STUB_VOICE_MODELS } from './tutorStubVoiceBridge.js';
import { renderTutorStubCliHelp } from './tutorStubCliHelp.js';
import { projectTutorStubFeatureMapLines } from './tutorStubFeatureMap.js';
import { projectTutorStubInteractiveHelpLines } from './tutorStubInteractiveHelp.js';
import { loadTutorStubReleaseNotes, normalizeTutorStubReleaseNotesHours } from './tutorStubReleaseNotes.js';
import { projectTutorStubReleaseNotesLines } from './tutorStubReleaseNotesPresentation.js';
import { projectTutorStubDagSnapshot, projectTutorStubDagSnapshotLines } from './tutorStubDagSnapshotPresentation.js';
import { tutorStubCapabilityFeatureRows } from './tutorStubCapabilities.js';
import { tutorStubCommandAvailable, tutorStubCommandHelpRows } from './tutorStubCommandRegistry.js';

export function createTutorStubPublicPresentationRuntime({
  C,
  DEFAULT_INTERACTIVE_DEMO_TURNS,
  ROOT,
  STUB,
  PROGRAM2_COMMITTEE_DEFAULTS,
  committedReleaseRows,
  nextReleaseRow,
  writeLine = console.log,
}) {
  function printHelp() {
    writeLine(
      renderTutorStubCliHelp({
        STUB,
        PROGRAM2_COMMITTEE_DEFAULTS,
        MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
        MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
        MIN_TUTOR_STUB_RELEASE_SPEED,
        MAX_TUTOR_STUB_RELEASE_SPEED,
        MAX_TUTOR_STUB_MODEL_CALL_BUDGET,
        TUTOR_STUB_CLI_THEME_IDS,
        TUTOR_STUB_CLI_MOTION_IDS,
        DEFAULT_INTERACTIVE_DEMO_TURNS,
        TUTOR_STUB_VOICE_MODELS,
      }),
    );
  }

  function buildTutorDagSnapshot(state, tutorTurn) {
    if (!state.dag || !state.world || !state.tutorDag) return null;
    return projectTutorStubDagSnapshot({
      dag: state.tutorDag,
      world: state.world,
      tutorTurn,
      releasedRows: committedReleaseRows(state, tutorTurn),
      nextRelease: nextReleaseRow(state),
    });
  }

  function printTutorDagSnapshot(snapshot) {
    for (const line of projectTutorStubDagSnapshotLines({ snapshot, colors: C })) writeLine(line);
  }

  function printTutorStubFeatureMap(state = null) {
    const featureRows = tutorStubCapabilityFeatureRows(state?.capabilities || null);
    let activeContext = null;
    if (state) {
      const mode = state.passthrough?.enabled ? 'passthrough' : state.interaction?.mode || 'learner';
      const content = state.curriculum?.module?.title
        ? `curriculum: ${state.curriculum.module.title}`
        : state.world?.title
          ? `scenario: ${state.world.title}`
          : `topic: ${state.topic}`;
      const hiddenAlwaysOnCapabilities = new Set(['public_dialogue', 'presentation', 'transcript']);
      const activeMechanisms = (state.capabilities?.active || [])
        .filter((id) => !hiddenAlwaysOnCapabilities.has(id))
        .map((id) => state.capabilities.capabilities[id]?.label)
        .filter(Boolean);
      activeContext = { mode, content, mechanisms: activeMechanisms };
    }
    const lines = projectTutorStubFeatureMapLines({ featureRows, activeContext, colors: C });
    for (const line of lines) writeLine(line);
  }

  function printInteractiveHelp(state = null) {
    const mode = state?.passthrough?.enabled ? 'passthrough' : 'normal';
    const commandOptions = { mode, capabilities: state?.capabilities || null };
    const commandAvailability =
      mode === 'normal'
        ? Object.fromEntries(
            ['/feedback', '/committee', '/random', '/suggest', '/board', '/proof'].map((token) => [
              token,
              tutorStubCommandAvailable(token, commandOptions),
            ]),
          )
        : {};
    const lines = projectTutorStubInteractiveHelpLines({
      mode,
      helpRows: tutorStubCommandHelpRows(commandOptions),
      commandAvailability,
      learningSummaryActive: Boolean(state?.capabilities?.capabilities?.learning_summary?.active),
      colors: C,
    });
    for (const line of lines) {
      writeLine(line);
    }
  }

  function printTutorStubReleaseNotes(hoursArg = '') {
    const hours = normalizeTutorStubReleaseNotesHours(hoursArg);
    const notes = loadTutorStubReleaseNotes({ cwd: ROOT, hours });
    const lines = projectTutorStubReleaseNotesLines({ notes, colors: C });
    for (const line of lines) writeLine(line);
    return notes;
  }

  return {
    buildTutorDagSnapshot,
    printInteractiveHelp,
    printTutorDagSnapshot,
    printTutorStubFeatureMap,
    printTutorStubReleaseNotes,
    printHelp,
  };
}
