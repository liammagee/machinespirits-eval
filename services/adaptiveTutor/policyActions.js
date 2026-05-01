// Closed set of pedagogical actions the tutor can pick at each turn.
//
// Used as the policy-action enum across the adaptive cell:
// - mockLLM and realLLM both emit one of these labels per turn
// - constraintCheck conditions on these labels
// - analyze-strategy-shift.js scores them against scenario-defined expected shifts
//
// The 14 actions roughly mirror gpt-pro's policy taxonomy. They are *control
// labels*, not free-form descriptions; the prompt language tutoring teachers
// would actually use is in the tutor message text, not here.
//
// Two layers of metadata:
//   POLICY_ACTION_DESCRIPTIONS  — inline one-liners (always available; fallback)
//   POLICY_ACTION_DETAILS       — YAML-loaded richer cues (trigger conditions,
//                                 contraindications, expected next signal,
//                                 example utterance) for real-LLM prompting

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

export const POLICY_ACTIONS = Object.freeze([
  'ask_diagnostic_question',
  'mirror_and_extend',
  'scope_test',
  'repair_misrecognition',
  'give_worked_example',
  'lower_cognitive_load',
  'provide_hint',
  'request_elaboration',
  'acknowledge_and_redirect',
  'name_the_disagreement',
  'withhold_answer',
  'summarize_and_check',
  'pose_counterexample',
  'invite_objection',
]);

export const POLICY_ACTION_DESCRIPTIONS = Object.freeze({
  ask_diagnostic_question: 'Probe the learner with a question whose answer reveals what they actually believe.',
  mirror_and_extend: 'Restate the learner\'s point in tighter form and push it one logical step further.',
  scope_test: 'Propose a boundary or limit case to test whether the learner\'s claim still holds.',
  repair_misrecognition: 'Explicitly correct an earlier misread of the learner\'s position before continuing.',
  give_worked_example: 'Demonstrate a complete worked example end-to-end.',
  lower_cognitive_load: 'Slow the dialogue down or simplify the framing for an overloaded learner.',
  provide_hint: 'Offer a partial scaffold without giving away the answer.',
  request_elaboration: 'Ask the learner to expand their reasoning, not their conclusion.',
  acknowledge_and_redirect: 'Recognise an affective signal explicitly, then redirect productively.',
  name_the_disagreement: 'Make the substantive point of disagreement explicit instead of papering it over.',
  withhold_answer: 'Refuse to give the answer in order to keep the learner in productive struggle.',
  summarize_and_check: 'Consolidate the dialogue so far and verify shared understanding.',
  pose_counterexample: 'Present a counterexample that challenges the learner\'s current claim.',
  invite_objection: 'Explicitly invite the learner to push back ("what are you not buying here?").',
});

export const isPolicyAction = (s) => POLICY_ACTIONS.includes(s);

// ---------------------------------------------------------------------------
// Polished policy-action taxonomy (YAML-loaded)
// ---------------------------------------------------------------------------
//
// Loaded at module-import time from config/adaptive-policy-actions.yaml. The
// frozen POLICY_ACTIONS enum above is the source of truth for the closed set
// of labels; this loader only enriches metadata. If the YAML is missing,
// malformed, or fails the per-action shape check, we fall back to a thin
// adapter over POLICY_ACTION_DESCRIPTIONS so the mock smoke and any cell
// that doesn't need richer prompting continues to work without the file.

const __filename_local = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename_local);
const POLICY_ACTIONS_YAML_PATH = path.join(
  path.resolve(__dirname_local, '..', '..'),
  'config',
  'adaptive-policy-actions.yaml',
);

function buildFallbackDetails() {
  const out = {};
  for (const name of POLICY_ACTIONS) {
    out[name] = {
      name,
      description: POLICY_ACTION_DESCRIPTIONS[name] || '',
      trigger_conditions: [],
      contraindications: [],
      expected_next_learner_signal: '',
      example_tutor_move: '',
      _source: 'fallback',
    };
  }
  return out;
}

function validateYamlEntry(entry, knownNames) {
  if (!entry || typeof entry !== 'object') return false;
  if (typeof entry.name !== 'string' || !knownNames.has(entry.name)) return false;
  if (typeof entry.description !== 'string' || entry.description.trim().length === 0) return false;
  if (!Array.isArray(entry.trigger_conditions)) return false;
  if (!Array.isArray(entry.contraindications)) return false;
  if (typeof entry.expected_next_learner_signal !== 'string') return false;
  if (typeof entry.example_tutor_move !== 'string') return false;
  return true;
}

function loadPolicyActionDetails() {
  let raw;
  try {
    raw = fs.readFileSync(POLICY_ACTIONS_YAML_PATH, 'utf-8');
  } catch (err) {
    // File missing — fall back silently.
    return buildFallbackDetails();
  }
  let parsed;
  try {
    parsed = yaml.parse(raw);
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[policyActions] failed to parse ${POLICY_ACTIONS_YAML_PATH}: ${err.message}. Falling back to inline descriptions.`);
    }
    return buildFallbackDetails();
  }
  if (!parsed || !Array.isArray(parsed.actions)) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[policyActions] ${POLICY_ACTIONS_YAML_PATH} missing top-level 'actions' array. Falling back.`);
    }
    return buildFallbackDetails();
  }
  const knownNames = new Set(POLICY_ACTIONS);
  const out = buildFallbackDetails();
  let hydrated = 0;
  for (const entry of parsed.actions) {
    if (!validateYamlEntry(entry, knownNames)) continue;
    out[entry.name] = {
      name: entry.name,
      description: entry.description.trim(),
      trigger_conditions: entry.trigger_conditions.map((s) => String(s).trim()).filter(Boolean),
      contraindications: entry.contraindications.map((s) => String(s).trim()).filter(Boolean),
      expected_next_learner_signal: entry.expected_next_learner_signal.trim(),
      example_tutor_move: entry.example_tutor_move.trim(),
      _source: 'yaml',
    };
    hydrated += 1;
  }
  if (hydrated < POLICY_ACTIONS.length && process.env.NODE_ENV !== 'test') {
    console.warn(`[policyActions] hydrated ${hydrated}/${POLICY_ACTIONS.length} actions from YAML; remainder fell back to inline.`);
  }
  return out;
}

export const POLICY_ACTION_DETAILS = Object.freeze(loadPolicyActionDetails());

// Reload helper for tests / hot-reload scenarios. Returns a fresh details
// map without mutating the exported frozen one.
export function reloadPolicyActionDetails() {
  return loadPolicyActionDetails();
}
