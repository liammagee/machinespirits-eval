/**
 * The form detector as a LIVE sensor (step 4 of
 * workplan/items/state-detection-without-word-lists.md).
 *
 * Steps 1-3 read the form detector offline against recorded traces. Here it
 * replaces both word-list sensors in the running host: the pressure cascade
 * (v6-cascade) and the quiet detector (qd-v2). One read per learner turn
 * gives one state; the state maps onto the two existing card channels
 * (pressure kind → move card, quiet type → quiet card) so the card text and
 * the dose ladder are untouched. Only the sensor changes.
 *
 * Armed by TUTOR_STUB_FORM_DETECTOR=<artifact.json> under
 * TUTOR_STUB_MANNER_SWITCH=1. The host stamps every read in-trace as
 * `tutor_form_state`, and the `tutor_manner_switch` event's triggerVersion
 * names the form artifact instead of the cascade, so a reviewer can tell
 * from the trace alone which sensor fired.
 */

import fs from 'node:fs';
import path from 'node:path';

import { compileTutorStubFormDetector, readTutorStubFormState } from './tutorStubFormStateDetector.js';

export const TUTOR_STUB_FORM_LIVE_SCHEMA = 'machinespirits.tutor-stub.form-state-live.v1';

export function loadTutorStubFormDetector(artifactPath) {
  const absolute = path.resolve(artifactPath);
  const detector = compileTutorStubFormDetector(JSON.parse(fs.readFileSync(absolute, 'utf8')));
  return { ...detector, artifactPath: absolute };
}

/**
 * The sensor's context from the public transcript as it stands when the
 * learner's new line arrives: the last tutor line spoken, and every learner
 * line before this one. The host pushes the current pair only after the
 * tutor replies, so `history` never contains the line being read.
 */
export function formContextFromHistory(history = []) {
  let tutorText = '';
  const priorLearnerTexts = [];
  for (const message of Array.isArray(history) ? history : []) {
    if (!message) continue;
    if (message.role === 'assistant') tutorText = String(message.content || '');
    else if (message.role === 'user') priorLearnerTexts.push(String(message.content || ''));
  }
  return { tutorText, priorLearnerTexts };
}

/**
 * One live read. `pressureForSwitch` is what the manner switch consumes:
 * a pressure kind when the state has one, else 'neutral' (quiet states and
 * neutral both leave the move-card channel silent).
 */
export function readTutorStubFormStateLive(detector, learnerText, history = []) {
  const read = readTutorStubFormState(detector, String(learnerText || ''), formContextFromHistory(history));
  return { ...read, pressureForSwitch: read.pressure || 'neutral' };
}

/** The in-trace record of a read; class scores rounded so the line stays short. */
export function formLiveTraceEvent(read, turn) {
  const scores = Object.fromEntries(
    Object.entries(read.scores || {}).map(([state, p]) => [state, Math.round(Number(p) * 1000) / 1000]),
  );
  return {
    type: 'tutor_form_state',
    schema: TUTOR_STUB_FORM_LIVE_SCHEMA,
    turn,
    state: read.state,
    p: read.p === null || read.p === undefined ? null : Math.round(Number(read.p) * 1000) / 1000,
    pressure: read.pressure || null,
    quiet: read.quiet || null,
    version: read.version,
    featureVersion: read.featureVersion,
    scores,
  };
}
